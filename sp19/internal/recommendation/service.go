package recommendation

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"sync/atomic"
	"time"

	pb "recommendation-system/api/proto/abtest"
	prodpb "recommendation-system/api/proto/product"
	recpb "recommendation-system/api/proto/recommendation"
	userpb "recommendation-system/api/proto/user"
	"recommendation-system/pkg/broadcast"
	"recommendation-system/pkg/cache"
	"recommendation-system/pkg/lru"
	"recommendation-system/pkg/singleflight"
)

const (
	ExperimentID        = "recommendation_algo"
	ClickChannel           = "user:click:"
	RecommendationTimeout = 1 * time.Second
)

type Service struct {
	recpb.UnimplementedRecommendationServiceServer
	redisClient    *cache.RedisClient
	localCache     *lru.Cache
	broadcaster      *broadcast.CacheBroadcaster
	userClient       userpb.UserServiceClient
	productClient     prodpb.ProductServiceClient
	abtestClient    pb.ABTestServiceClient
	requestCounter    int64
	sfGroup        *singleflight.Group
	streamSubscribers map[int64][]*streamSubscriber
	streamMu        sync.RWMutex
}

type streamSubscriber struct {
	stream  recpb.RecommendationService_StreamRecommendationsServer
	userID  int64
	limit   int
	done    chan struct{}
}

func NewService(
	redisClient *cache.RedisClient,
	localCache *lru.Cache,
	userClient userpb.UserServiceClient,
	productClient prodpb.ProductServiceClient,
	abtestClient pb.ABTestServiceClient,
) *Service {
	s := &Service{
		redisClient:       redisClient,
		localCache:      localCache,
		userClient:      userClient,
		productClient: productClient,
		abtestClient:  abtestClient,
		sfGroup:        singleflight.NewGroup(),
		streamSubscribers: make(map[int64][]*streamSubscriber),
	}
	s.broadcaster = broadcast.NewCacheBroadcaster(redisClient, localCache, "recommendation-service")
	go s.listenClickEvents()
	return s
}

func (s *Service) GetRecommendations(ctx context.Context, req *recpb.GetRecommendationsRequest) (*recpb.GetRecommendationsResponse, error) {
	requestID := atomic.AddInt64(&s.requestCounter, 1)
	limit := int(req.Limit)
	if limit <= 0 {
		limit = 10
	}

	algo := req.Algorithm
	groupName := "default"
	groupID := "default"

	if algo == "" {
		groupResp, err := s.abtestClient.GetUserGroup(ctx, &pb.GetUserGroupRequest{
			ExperimentId: ExperimentID,
			UserId:       req.UserId,
		})
		if err == nil && groupResp.InExperiment {
			groupID = groupResp.GroupId
			groupName = groupResp.GroupName
			if alg, ok := groupResp.Variables["algorithm"]; ok {
				algo = alg
			}
		}
	}

	resultChan := make(chan *recpb.GetRecommendationsResponse, 1)
	errChan := make(chan error, 1)

	go func() {
		products, err := s.getRecommendationsInternal(ctx, req.UserId, limit, algo)
		if err != nil {
			errChan <- err
			return
		}
		resultChan <- &recpb.GetRecommendationsResponse{
			Recommendations:  products,
			AlgorithmUsed:    algo,
			ExperimentGroup: groupName,
			RequestId:        requestID,
			IsFallback:       false,
		}
	}()

	select {
	case resp := <-resultChan:
		go func() {
			productIDs := make([]int64, len(resp.Recommendations))
			for i, p := range resp.Recommendations {
				productIDs[i] = p.Product.ProductId
			}
			s.abtestClient.RecordImpression(context.Background(), &pb.RecordImpressionRequest{
				ExperimentId: ExperimentID,
				UserId:       req.UserId,
				GroupId:      groupID,
				ProductIds:   productIDs,
				RequestId:    requestID,
			})
		}()
		return resp, nil
	case <-time.After(RecommendationTimeout):
		products, err := s.getFallbackRecommendations(ctx, limit)
		if err != nil {
			return nil, err
		}
		return &recpb.GetRecommendationsResponse{
			Recommendations:  products,
			AlgorithmUsed:    "fallback_hot",
			ExperimentGroup: groupName,
			RequestId:        requestID,
			IsFallback:       true,
		}, nil
	case err := <-errChan:
		products, fallbackErr := s.getFallbackRecommendations(ctx, limit)
		if fallbackErr != nil {
			return nil, err
		}
		return &recpb.GetRecommendationsResponse{
			Recommendations:  products,
			AlgorithmUsed:    "fallback_hot",
			ExperimentGroup: groupName,
			RequestId:        requestID,
			IsFallback:       true,
		}, nil
	}
}

func (s *Service) getRecommendationsInternal(ctx context.Context, userID int64, limit int, algo string) ([]*recpb.RecommendedProduct, error) {
	switch algo {
	case "collaborative":
		products, err := s.getCollaborativeRecommendations(ctx, userID, limit)
		if err != nil || len(products) == 0 {
			return s.getHotRecommendationsWithReason(ctx, limit)
		}
		return products, nil
	default:
		return s.getHotRecommendationsWithReason(ctx, limit)
	}
}

func (s *Service) RecordClick(ctx context.Context, req *recpb.RecordClickRequest) (*recpb.RecordClickResponse, error) {
	groupResp, err := s.abtestClient.GetUserGroup(ctx, &pb.GetUserGroupRequest{
		ExperimentId: ExperimentID,
		UserId:       req.UserId,
	})
	if err == nil && groupResp.InExperiment {
		go s.abtestClient.RecordClick(context.Background(), &pb.RecordClickRequest{
			ExperimentId: ExperimentID,
			UserId:       req.UserId,
			GroupId:      groupResp.GroupId,
			ProductId:    req.ProductId,
			RequestId:    req.RequestId,
		})
	}

	go s.userClient.RecordBrowseHistory(context.Background(), &userpb.BrowseHistoryRequest{
		UserId:    req.UserId,
		ProductId: req.ProductId,
	})

	go s.productClient.IncrementViewCount(context.Background(), &prodpb.IncrementViewCountRequest{
		ProductId: req.ProductId,
	})

	go s.publishClickEvent(req.UserId, req.ProductId)

	return &recpb.RecordClickResponse{Success: true}, nil
}

func (s *Service) StreamRecommendations(req *recpb.StreamRecommendationsRequest, stream recpb.RecommendationService_StreamRecommendationsServer) error {
	userID := req.UserId
	limit := int(req.Limit)
	if limit <= 0 {
		limit = 10
	}

	sub := &streamSubscriber{
		stream: stream,
		userID: userID,
		limit:  limit,
		done:   make(chan struct{}),
	}

	s.streamMu.Lock()
	s.streamSubscribers[userID] = append(s.streamSubscribers[userID], sub)
	s.streamMu.Unlock()

	defer func() {
		s.streamMu.Lock()
		subs := s.streamSubscribers[userID]
		for i, existing := range subs {
			if existing == sub {
				s.streamSubscribers[userID] = append(subs[:i], subs[i+1:]...)
				break
			}
		}
		if len(s.streamSubscribers[userID]) == 0 {
			delete(s.streamSubscribers, userID)
		}
		s.streamMu.Unlock()
		close(sub.done)
	}()

	initialResp, err := s.GetRecommendations(stream.Context(), &recpb.GetRecommendationsRequest{
		UserId: userID,
		Limit:  int32(limit),
	})
	if err != nil {
		return err
	}
	if err := stream.Send(initialResp); err != nil {
		return err
	}

	<-stream.Context().Done()
	return nil
}

func (s *Service) publishClickEvent(userID, productID int64) {
	event := map[string]interface{}{
		"user_id":    userID,
		"product_id": productID,
		"timestamp":  time.Now().Unix(),
	}
	s.redisClient.Publish(context.Background(), ClickChannel+fmt.Sprint(userID), event)
}

func (s *Service) listenClickEvents() {
	pubsub := s.redisClient.Subscribe(context.Background(), ClickChannel+"*")
	defer pubsub.Close()

	ch := pubsub.Channel()
	for range ch {
		s.streamMu.RLock()
		for _, subs := range s.streamSubscribers {
			for _, sub := range subs {
				select {
				case <-sub.done:
					continue
				default:
					go s.pushUpdateToSubscriber(sub)
				}
			}
		}
		s.streamMu.RUnlock()
	}
}

func (s *Service) pushUpdateToSubscriber(sub *streamSubscriber) {
	ctx, cancel := context.WithTimeout(context.Background(), RecommendationTimeout)
	defer cancel()

	resp, err := s.GetRecommendations(ctx, &recpb.GetRecommendationsRequest{
		UserId: sub.userID,
		Limit:  int32(sub.limit),
	})
	if err != nil {
		return
	}

	sub.stream.Send(resp)
}

func (s *Service) getCollaborativeRecommendations(ctx context.Context, userID int64, limit int) ([]*recpb.RecommendedProduct, error) {
	cacheKey := fmt.Sprintf("rec:collab:%d:%d", userID, limit)

	if val, ok := s.localCache.Get(cacheKey); ok {
		return val.([]*recpb.RecommendedProduct), nil
	}

	result, err := s.sfGroup.Do(cacheKey, func() (interface{}, error) {
		if val, ok := s.localCache.Get(cacheKey); ok {
			return val.([]*recpb.RecommendedProduct), nil
		}

		historyResp, err := s.userClient.GetBrowseHistory(ctx, &userpb.GetBrowseHistoryRequest{
			UserId: userID,
			Limit:  50,
		})
		if err != nil {
			return nil, err
		}

		if len(historyResp.ProductIds) == 0 {
			return []*recpb.RecommendedProduct{}, nil
		}

		userHistory := make(map[int64]bool)
		browsedProducts := make([]*prodpb.Product, 0, len(historyResp.ProductIds))
		for _, pid := range historyResp.ProductIds {
			userHistory[pid] = true
		}

		productsResp, err := s.productClient.GetProducts(ctx, &prodpb.GetProductsRequest{
			ProductIds: historyResp.ProductIds,
		})
		if err == nil {
			browsedProducts = productsResp.Products
		}

		similarScores := make(map[int64]float64)
		coOccurrence := make(map[int64]map[int64]int)

		for _, viewedProductID := range historyResp.ProductIds {
			coOccurrence[viewedProductID] = make(map[int64]int)
		}

		hotResp, err := s.productClient.GetHotProducts(ctx, &prodpb.GetHotProductsRequest{Limit: 100})
		if err != nil {
			return nil, err
		}

		for _, p := range hotResp.Products {
			if !userHistory[p.ProductId] {
				similarity := 0.0

				if len(browsedProducts) > 0 {
					for _, bp := range browsedProducts {
						if bp.Category == p.Category {
							similarity += 0.5
							break
						}
					}
				}

				similarScores[p.ProductId] = similarity + float64(p.HotScore)/1000.0
			}
		}

		candidateProducts := make([]int64, 0, len(similarScores))
		for pid := range similarScores {
			candidateProducts = append(candidateProducts, pid)
		}

		sort.Slice(candidateProducts, func(i, j int) bool {
			return similarScores[candidateProducts[i]] > similarScores[candidateProducts[j]]
		})

		if len(candidateProducts) > limit {
			candidateProducts = candidateProducts[:limit]
		}

		productsResp, err = s.productClient.GetProducts(ctx, &prodpb.GetProductsRequest{
			ProductIds: candidateProducts,
		})
		if err != nil {
			return nil, err
		}

		result := make([]*recpb.RecommendedProduct, 0, len(productsResp.Products))
		for _, p := range productsResp.Products {
			reason := "基于您的浏览历史推荐"
			if len(browsedProducts) > 0 {
				for _, bp := range browsedProducts {
					if bp.Category == p.Category {
						reason = fmt.Sprintf("因为您浏览过%s类商品", bp.Category)
						break
					}
				}
			}
			result = append(result, &recpb.RecommendedProduct{
				Product: p,
				Reason:  reason,
				Score:   similarScores[p.ProductId],
			})
		}

		if len(result) > 0 {
			s.localCache.Set(cacheKey, result)
			s.redisClient.Set(ctx, cacheKey, result, 5*time.Minute)
		}

		return result, nil
	})

	if err != nil {
		return nil, err
	}

	return result.([]*recpb.RecommendedProduct), nil
}

func (s *Service) getHotRecommendationsWithReason(ctx context.Context, limit int) ([]*recpb.RecommendedProduct, error) {
	cacheKey := fmt.Sprintf("rec:hot:%d", limit)

	if val, ok := s.localCache.Get(cacheKey); ok {
		return val.([]*recpb.RecommendedProduct), nil
	}

	result, err := s.sfGroup.Do(cacheKey, func() (interface{}, error) {
		if val, ok := s.localCache.Get(cacheKey); ok {
			return val.([]*recpb.RecommendedProduct), nil
		}

		resp, err := s.productClient.GetHotProducts(ctx, &prodpb.GetHotProductsRequest{
			Limit: int32(limit),
		})
		if err != nil {
			return nil, err
		}

		result := make([]*recpb.RecommendedProduct, 0, len(resp.Products))
		for i, p := range resp.Products {
			reason := "热门推荐"
			if i < 3 {
				reason = fmt.Sprintf("热门商品 Top %d", i+1)
			}
			result = append(result, &recpb.RecommendedProduct{
				Product: p,
				Reason:  reason,
				Score:   p.HotScore,
			})
		}

		s.localCache.Set(cacheKey, result)
		s.redisClient.Set(ctx, cacheKey, result, 1*time.Minute)

		return result, nil
	})

	if err != nil {
		return nil, err
	}

	return result.([]*recpb.RecommendedProduct), nil
}

func (s *Service) getFallbackRecommendations(ctx context.Context, limit int) ([]*recpb.RecommendedProduct, error) {
	resp, err := s.productClient.GetHotProducts(ctx, &prodpb.GetHotProductsRequest{Limit: int32(limit),
	})
	if err != nil {
		return nil, err
	}

	result := make([]*recpb.RecommendedProduct, 0, len(resp.Products))
	for _, p := range resp.Products {
		result = append(result, &recpb.RecommendedProduct{
			Product: p,
			Reason:  "热门推荐",
			Score:   p.HotScore,
		})
	}

	return result, nil
}

func (s *Service) Close() {
	s.broadcaster.Close()
}
