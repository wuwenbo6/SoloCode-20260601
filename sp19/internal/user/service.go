package user

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"gorm.io/gorm"

	pb "recommendation-system/api/proto/user"
	brd "recommendation-system/api/proto/broadcast"
	"recommendation-system/pkg/broadcast"
	"recommendation-system/pkg/cache"
	"recommendation-system/pkg/lru"
	"recommendation-system/pkg/singleflight"
)

type Service struct {
	pb.UnimplementedUserServiceServer
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
	s.broadcaster = broadcast.NewCacheBroadcaster(redisClient, localCache, "user-service")
	return s
}

func (s *Service) GetUser(ctx context.Context, req *pb.GetUserRequest) (*pb.User, error) {
	cacheKey := fmt.Sprintf("user:%d", req.UserId)

	if val, ok := s.localCache.Get(cacheKey); ok {
		return val.(*pb.User), nil
	}

	result, err := s.sfGroup.Do(cacheKey, func() (interface{}, error) {
		if val, ok := s.localCache.Get(cacheKey); ok {
			return val.(*pb.User), nil
		}

		var user User
		if err := s.db.First(&user, "user_id = ?", req.UserId).Error; err != nil {
			return nil, err
		}

		pbUser := s.toProtoUser(&user)
		s.localCache.Set(cacheKey, pbUser)
		s.redisClient.Set(ctx, cacheKey, pbUser, 5*time.Minute)

		return pbUser, nil
	})
	if err != nil {
		return nil, err
	}

	return result.(*pb.User), nil
}

func (s *Service) CreateUser(ctx context.Context, req *pb.CreateUserRequest) (*pb.User, error) {
	user := &User{
		Username: req.Username,
		Email:    req.Email,
	}

	if err := s.db.Create(user).Error; err != nil {
		return nil, err
	}

	pbUser := s.toProtoUser(user)

	s.broadcaster.BroadcastUpdate(ctx, brd.CacheType_USER, strconv.FormatInt(user.UserID, 10), brd.OperationType_CREATE)

	return pbUser, nil
}

func (s *Service) UpdateUser(ctx context.Context, req *pb.UpdateUserRequest) (*pb.User, error) {
	user := &User{UserID: req.UserId}
	if err := s.db.First(user).Error; err != nil {
		return nil, err
	}

	if req.Username != "" {
		user.Username = req.Username
	}
	if req.Email != "" {
		user.Email = req.Email
	}

	if err := s.db.Save(user).Error; err != nil {
		return nil, err
	}

	pbUser := s.toProtoUser(user)

	cacheKey := fmt.Sprintf("user:%d", req.UserId)
	s.localCache.Delete(cacheKey)
	s.redisClient.Del(ctx, cacheKey)
	s.broadcaster.BroadcastUpdate(ctx, brd.CacheType_USER, strconv.FormatInt(req.UserId, 10), brd.OperationType_UPDATE)

	return pbUser, nil
}

func (s *Service) DeleteUser(ctx context.Context, req *pb.DeleteUserRequest) (*pb.DeleteUserResponse, error) {
	if err := s.db.Delete(&User{}, "user_id = ?", req.UserId).Error; err != nil {
		return &pb.DeleteUserResponse{Success: false}, err
	}

	cacheKey := fmt.Sprintf("user:%d", req.UserId)
	s.localCache.Delete(cacheKey)
	s.redisClient.Del(ctx, cacheKey)
	s.broadcaster.BroadcastUpdate(ctx, brd.CacheType_USER, strconv.FormatInt(req.UserId, 10), brd.OperationType_DELETE)

	return &pb.DeleteUserResponse{Success: true}, nil
}

func (s *Service) RecordBrowseHistory(ctx context.Context, req *pb.BrowseHistoryRequest) (*pb.BrowseHistoryResponse, error) {
	history := &BrowseHistory{
		UserID:    req.UserId,
		ProductID: req.ProductId,
	}

	if err := s.db.Create(history).Error; err != nil {
		return &pb.BrowseHistoryResponse{Success: false}, err
	}

	s.broadcaster.BroadcastUpdate(ctx, brd.CacheType_BROWSE_HISTORY, strconv.FormatInt(req.UserId, 10), brd.OperationType_UPDATE)

	return &pb.BrowseHistoryResponse{Success: true}, nil
}

func (s *Service) GetBrowseHistory(ctx context.Context, req *pb.GetBrowseHistoryRequest) (*pb.GetBrowseHistoryResponse, error) {
	cacheKey := fmt.Sprintf("browse:%d", req.UserId)

	if val, ok := s.localCache.Get(cacheKey); ok {
		return val.(*pb.GetBrowseHistoryResponse), nil
	}

	result, err := s.sfGroup.Do(cacheKey, func() (interface{}, error) {
		if val, ok := s.localCache.Get(cacheKey); ok {
			return val.(*pb.GetBrowseHistoryResponse), nil
		}

		var histories []BrowseHistory
		limit := int(req.Limit)
		if limit <= 0 {
			limit = 20
		}

		if err := s.db.Where("user_id = ?", req.UserId).
			Order("browsed_at DESC").
			Limit(limit).
			Find(&histories).Error; err != nil {
			return nil, err
		}

		productIDs := make([]int64, len(histories))
		for i, h := range histories {
			productIDs[i] = h.ProductID
		}

		response := &pb.GetBrowseHistoryResponse{ProductIds: productIDs}
		s.localCache.Set(cacheKey, response)
		s.redisClient.Set(ctx, cacheKey, response, 5*time.Minute)

		return response, nil
	})
	if err != nil {
		return nil, err
	}

	return result.(*pb.GetBrowseHistoryResponse), nil
}

func (s *Service) toProtoUser(u *User) *pb.User {
	return &pb.User{
		UserId:    u.UserID,
		Username:  u.Username,
		Email:     u.Email,
		CreatedAt: u.CreatedAt.Unix(),
		UpdatedAt: u.UpdatedAt.Unix(),
	}
}

func (s *Service) InitSchema() error {
	return s.db.AutoMigrate(&User{}, &BrowseHistory{})
}

func (s *Service) Close() {
	s.broadcaster.Close()
}

func (s *Service) MarshalJSON() ([]byte, error) {
	return json.Marshal(s)
}
