package product

import (
	"context"
	"fmt"
	"math"
	"strconv"
	"time"

	"gorm.io/gorm"

	pb "recommendation-system/api/proto/product"
	brd "recommendation-system/api/proto/broadcast"
	"recommendation-system/pkg/broadcast"
	"recommendation-system/pkg/cache"
	"recommendation-system/pkg/lru"
	"recommendation-system/pkg/singleflight"
)

type Service struct {
	pb.UnimplementedProductServiceServer
	db           *gorm.DB
	redisClient  *cache.RedisClient
	localCache   *lru.Cache
	broadcaster  *broadcast.CacheBroadcaster
	sfGroup      *singleflight.Group
}

func NewService(db *gorm.DB, redisClient *cache.RedisClient, localCache *lru.Cache) *Service {
	s := &Service{
		db:          db,
		redisClient: redisClient,
		localCache:  localCache,
		sfGroup:     singleflight.NewGroup(),
	}
	s.broadcaster = broadcast.NewCacheBroadcaster(redisClient, localCache, "product-service")
	return s
}

func (s *Service) GetProduct(ctx context.Context, req *pb.GetProductRequest) (*pb.Product, error) {
	cacheKey := fmt.Sprintf("product:%d", req.ProductId)

	if val, ok := s.localCache.Get(cacheKey); ok {
		return val.(*pb.Product), nil
	}

	result, err := s.sfGroup.Do(cacheKey, func() (interface{}, error) {
		if val, ok := s.localCache.Get(cacheKey); ok {
			return val.(*pb.Product), nil
		}

		var product Product
		if err := s.db.First(&product, "product_id = ?", req.ProductId).Error; err != nil {
			return nil, err
		}

		pbProduct := s.toProtoProduct(&product)
		s.localCache.Set(cacheKey, pbProduct)
		s.redisClient.Set(ctx, cacheKey, pbProduct, 5*time.Minute)

		return pbProduct, nil
	})
	if err != nil {
		return nil, err
	}

	return result.(*pb.Product), nil
}

func (s *Service) ListProducts(ctx context.Context, req *pb.ListProductsRequest) (*pb.ListProductsResponse, error) {
	var products []Product
	query := s.db.Model(&Product{})

	if req.Category != "" {
		query = query.Where("category = ?", req.Category)
	}

	var total int64
	query.Count(&total)

	page := int(req.Page)
	if page <= 0 {
		page = 1
	}
	pageSize := int(req.PageSize)
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}

	offset := (page - 1) * pageSize
	query.Order("hot_score DESC").Offset(offset).Limit(pageSize).Find(&products)

	pbProducts := make([]*pb.Product, len(products))
	for i, p := range products {
		pbProducts[i] = s.toProtoProduct(&p)
	}

	return &pb.ListProductsResponse{
		Products: pbProducts,
		Total:    int32(total),
	}, nil
}

func (s *Service) CreateProduct(ctx context.Context, req *pb.CreateProductRequest) (*pb.Product, error) {
	product := &Product{
		Name:        req.Name,
		Description: req.Description,
		Price:       req.Price,
		Category:    req.Category,
		ViewCount:   0,
		HotScore:    0,
	}

	if err := s.db.Create(product).Error; err != nil {
		return nil, err
	}

	pbProduct := s.toProtoProduct(product)

	s.broadcaster.BroadcastUpdate(ctx, brd.CacheType_PRODUCT, strconv.FormatInt(product.ProductID, 10), brd.OperationType_CREATE)

	return pbProduct, nil
}

func (s *Service) UpdateProduct(ctx context.Context, req *pb.UpdateProductRequest) (*pb.Product, error) {
	product := &Product{ProductID: req.ProductId}
	if err := s.db.First(product).Error; err != nil {
		return nil, err
	}

	if req.Name != "" {
		product.Name = req.Name
	}
	if req.Description != "" {
		product.Description = req.Description
	}
	if req.Price > 0 {
		product.Price = req.Price
	}
	if req.Category != "" {
		product.Category = req.Category
	}

	if err := s.db.Save(product).Error; err != nil {
		return nil, err
	}

	pbProduct := s.toProtoProduct(product)

	cacheKey := fmt.Sprintf("product:%d", req.ProductId)
	s.localCache.Delete(cacheKey)
	s.redisClient.Del(ctx, cacheKey)
	s.broadcaster.BroadcastUpdate(ctx, brd.CacheType_PRODUCT, strconv.FormatInt(req.ProductId, 10), brd.OperationType_UPDATE)

	return pbProduct, nil
}

func (s *Service) DeleteProduct(ctx context.Context, req *pb.DeleteProductRequest) (*pb.DeleteProductResponse, error) {
	if err := s.db.Delete(&Product{}, "product_id = ?", req.ProductId).Error; err != nil {
		return &pb.DeleteProductResponse{Success: false}, err
	}

	cacheKey := fmt.Sprintf("product:%d", req.ProductId)
	s.localCache.Delete(cacheKey)
	s.redisClient.Del(ctx, cacheKey)
	s.broadcaster.BroadcastUpdate(ctx, brd.CacheType_PRODUCT, strconv.FormatInt(req.ProductId, 10), brd.OperationType_DELETE)

	return &pb.DeleteProductResponse{Success: true}, nil
}

func (s *Service) GetHotProducts(ctx context.Context, req *pb.GetHotProductsRequest) (*pb.GetHotProductsResponse, error) {
	cacheKey := fmt.Sprintf("hot_products:%s:%d", req.Category, req.Limit)

	if val, ok := s.localCache.Get(cacheKey); ok {
		return val.(*pb.GetHotProductsResponse), nil
	}

	result, err := s.sfGroup.Do(cacheKey, func() (interface{}, error) {
		if val, ok := s.localCache.Get(cacheKey); ok {
			return val.(*pb.GetHotProductsResponse), nil
		}

		var products []Product
		limit := int(req.Limit)
		if limit <= 0 {
			limit = 20
		}

		query := s.db.Model(&Product{})
		if req.Category != "" {
			query = query.Where("category = ?", req.Category)
		}

		query.Order("hot_score DESC").Limit(limit).Find(&products)

		pbProducts := make([]*pb.Product, len(products))
		for i, p := range products {
			pbProducts[i] = s.toProtoProduct(&p)
		}

		response := &pb.GetHotProductsResponse{Products: pbProducts}
		s.localCache.Set(cacheKey, response)
		s.redisClient.Set(ctx, cacheKey, response, 1*time.Minute)

		return response, nil
	})
	if err != nil {
		return nil, err
	}

	return result.(*pb.GetHotProductsResponse), nil
}

func (s *Service) IncrementViewCount(ctx context.Context, req *pb.IncrementViewCountRequest) (*pb.IncrementViewCountResponse, error) {
	product := &Product{ProductID: req.ProductId}
	if err := s.db.First(product).Error; err != nil {
		return &pb.IncrementViewCountResponse{Success: false}, err
	}

	product.ViewCount++
	product.HotScore = s.calculateHotScore(product.ViewCount, product.CreatedAt)

	if err := s.db.Save(product).Error; err != nil {
		return &pb.IncrementViewCountResponse{Success: false}, err
	}

	cacheKey := fmt.Sprintf("product:%d", req.ProductId)
	s.localCache.Delete(cacheKey)
	s.redisClient.Del(ctx, cacheKey)
	s.broadcaster.BroadcastUpdate(ctx, brd.CacheType_PRODUCT, strconv.FormatInt(req.ProductId, 10), brd.OperationType_UPDATE)

	hotCacheKey := fmt.Sprintf("hot_products::0")
	s.localCache.Delete(hotCacheKey)

	return &pb.IncrementViewCountResponse{Success: true}, nil
}

func (s *Service) GetProducts(ctx context.Context, req *pb.GetProductsRequest) (*pb.GetProductsResponse, error) {
	if len(req.ProductIds) == 0 {
		return &pb.GetProductsResponse{Products: []*pb.Product{}}, nil
	}

	var products []Product
	if err := s.db.Where("product_id IN ?", req.ProductIds).Find(&products).Error; err != nil {
		return nil, err
	}

	productMap := make(map[int64]*Product, len(products))
	for i := range products {
		productMap[products[i].ProductID] = &products[i]
	}

	pbProducts := make([]*pb.Product, 0, len(req.ProductIds))
	for _, id := range req.ProductIds {
		if p, ok := productMap[id]; ok {
			pbProducts = append(pbProducts, s.toProtoProduct(p))
		}
	}

	return &pb.GetProductsResponse{Products: pbProducts}, nil
}

func (s *Service) calculateHotScore(viewCount int64, createdAt time.Time) float64 {
	hours := time.Since(createdAt).Hours()
	if hours < 1 {
		hours = 1
	}

	decay := math.Pow(0.95, hours/24)
	return float64(viewCount) * decay
}

func (s *Service) toProtoProduct(p *Product) *pb.Product {
	return &pb.Product{
		ProductId:   p.ProductID,
		Name:        p.Name,
		Description: p.Description,
		Price:       p.Price,
		Category:    p.Category,
		ViewCount:   p.ViewCount,
		HotScore:    p.HotScore,
		CreatedAt:   p.CreatedAt.Unix(),
		UpdatedAt:   p.UpdatedAt.Unix(),
	}
}

func (s *Service) InitSchema() error {
	return s.db.AutoMigrate(&Product{})
}

func (s *Service) Close() {
	s.broadcaster.Close()
}
