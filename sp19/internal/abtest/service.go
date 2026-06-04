package abtest

import (
	"context"
	"crypto/sha256"
	"encoding/binary"
	"fmt"
	"strconv"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	pb "recommendation-system/api/proto/abtest"
	"recommendation-system/pkg/cache"
	"recommendation-system/pkg/lru"
	"recommendation-system/pkg/singleflight"
)

const (
	ImpressionsKey = "ab:stats:%s:impressions"
	ClicksKey      = "ab:stats:%s:clicks"
)

type Service struct {
	pb.UnimplementedABTestServiceServer
	db          *gorm.DB
	redisClient *cache.RedisClient
	localCache  *lru.Cache
	sfGroup     *singleflight.Group
}

func NewService(db *gorm.DB, redisClient *cache.RedisClient, localCache *lru.Cache) *Service {
	return &Service{
		db:          db,
		redisClient: redisClient,
		localCache:  localCache,
		sfGroup:     singleflight.NewGroup(),
	}
}

func (s *Service) GetUserGroup(ctx context.Context, req *pb.GetUserGroupRequest) (*pb.GetUserGroupResponse, error) {
	exp, err := s.getExperiment(ctx, req.ExperimentId)
	if err != nil {
		return nil, err
	}

	if exp == nil || !exp.Enabled {
		return &pb.GetUserGroupResponse{InExperiment: false}, nil
	}

	groups, err := exp.GetGroups()
	if err != nil {
		return nil, err
	}

	hash := s.hashUserID(req.UserId, req.ExperimentId)
	bucket := int(hash % 100)

	cumulative := 0
	for _, group := range groups {
		cumulative += int(group.TrafficPercentage)
		if bucket < cumulative {
			return &pb.GetUserGroupResponse{
				GroupId:      group.GroupID,
				GroupName:    group.Name,
				Variables:    group.Variables,
				InExperiment: true,
			}, nil
		}
	}

	return &pb.GetUserGroupResponse{InExperiment: false}, nil
}

func (s *Service) CreateExperiment(ctx context.Context, req *pb.CreateExperimentRequest) (*pb.Experiment, error) {
	expID := uuid.New().String()

	exp := &Experiment{
		ExperimentID: expID,
		Name:         req.Name,
		Description:  req.Description,
		Enabled:      true,
	}

	groups := make([]*Group, len(req.Groups))
	for i, g := range req.Groups {
		groups[i] = &Group{
			GroupID:           g.GroupId,
			Name:              g.Name,
			TrafficPercentage: g.TrafficPercentage,
			Variables:         g.Variables,
		}
	}

	if err := exp.SetGroups(groups); err != nil {
		return nil, err
	}

	if err := s.db.Create(exp).Error; err != nil {
		return nil, err
	}

	return s.toProtoExperiment(exp), nil
}

func (s *Service) GetExperiment(ctx context.Context, req *pb.GetExperimentRequest) (*pb.Experiment, error) {
	exp, err := s.getExperiment(ctx, req.ExperimentId)
	if err != nil {
		return nil, err
	}
	if exp == nil {
		return nil, fmt.Errorf("experiment not found")
	}
	return s.toProtoExperiment(exp), nil
}

func (s *Service) ListExperiments(ctx context.Context, req *pb.ListExperimentsRequest) (*pb.ListExperimentsResponse, error) {
	var experiments []Experiment
	var total int64

	query := s.db.Model(&Experiment{})
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
	query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&experiments)

	pbExperiments := make([]*pb.Experiment, len(experiments))
	for i, exp := range experiments {
		pbExperiments[i] = s.toProtoExperiment(&exp)
	}

	return &pb.ListExperimentsResponse{
		Experiments: pbExperiments,
		Total:       int32(total),
	}, nil
}

func (s *Service) RecordClick(ctx context.Context, req *pb.RecordClickRequest) (*pb.RecordClickResponse, error) {
	date := time.Now().Format("2006-01-02")
	key := fmt.Sprintf(ClicksKey, req.ExperimentId)
	field := fmt.Sprintf("%s:%s:%d", req.GroupId, date, req.ProductId)

	s.redisClient.HIncrBy(ctx, key, field, 1)

	go s.flushStatsToDB(req.ExperimentId, req.GroupId, 0, 1)

	return &pb.RecordClickResponse{Success: true}, nil
}

func (s *Service) RecordImpression(ctx context.Context, req *pb.RecordImpressionRequest) (*pb.RecordImpressionResponse, error) {
	date := time.Now().Format("2006-01-02")
	key := fmt.Sprintf(ImpressionsKey, req.ExperimentId)
	field := fmt.Sprintf("%s:%s", req.GroupId, date)

	s.redisClient.HIncrBy(ctx, key, field, int64(len(req.ProductIds)))

	go s.flushStatsToDB(req.ExperimentId, req.GroupId, len(req.ProductIds), 0)

	return &pb.RecordImpressionResponse{Success: true}, nil
}

func (s *Service) GetExperimentStats(ctx context.Context, req *pb.GetExperimentStatsRequest) (*pb.GetExperimentStatsResponse, error) {
	exp, err := s.getExperiment(ctx, req.ExperimentId)
	if err != nil {
		return nil, err
	}
	if exp == nil {
		return nil, fmt.Errorf("experiment not found")
	}

	groups, err := exp.GetGroups()
	if err != nil {
		return nil, err
	}

	groupStats := make([]*pb.GroupStats, 0, len(groups))

	for _, group := range groups {
		impressions, clicks, err := s.getGroupStats(ctx, req.ExperimentId, group.GroupID)
		if err != nil {
			continue
		}

		ctr := 0.0
		if impressions > 0 {
			ctr = float64(clicks) / float64(impressions) * 100
		}

		groupStats = append(groupStats, &pb.GroupStats{
			GroupId:     group.GroupID,
			GroupName:   group.Name,
			Impressions: impressions,
			Clicks:      clicks,
			Ctr:         ctr,
		})
	}

	return &pb.GetExperimentStatsResponse{
		ExperimentId: req.ExperimentId,
		GroupStats:   groupStats,
		Timestamp:    time.Now().Unix(),
	}, nil
}

func (s *Service) getExperiment(ctx context.Context, expID string) (*Experiment, error) {
	cacheKey := fmt.Sprintf("ab:exp:%s", expID)

	if val, ok := s.localCache.Get(cacheKey); ok {
		return val.(*Experiment), nil
	}

	result, err := s.sfGroup.Do(cacheKey, func() (interface{}, error) {
		if val, ok := s.localCache.Get(cacheKey); ok {
			return val.(*Experiment), nil
		}

		var exp Experiment
		if err := s.db.First(&exp, "experiment_id = ?", expID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return nil, nil
			}
			return nil, err
		}

		s.localCache.Set(cacheKey, &exp)
		s.redisClient.Set(ctx, cacheKey, &exp, 5*time.Minute)

		return &exp, nil
	})
	if err != nil {
		return nil, err
	}

	if result == nil {
		return nil, nil
	}
	return result.(*Experiment), nil
}

func (s *Service) getGroupStats(ctx context.Context, expID, groupID string) (int64, int64, error) {
	cacheKey := fmt.Sprintf("ab:stats:%s:%s", expID, groupID)

	if val, ok := s.localCache.Get(cacheKey); ok {
		stats := val.(map[string]int64)
		return stats["impressions"], stats["clicks"], nil
	}

	var stats []ExperimentStats
	if err := s.db.Where("experiment_id = ? AND group_id = ?", expID, groupID).Find(&stats).Error; err != nil {
		return 0, 0, err
	}

	var totalImpressions, totalClicks int64
	for _, s := range stats {
		totalImpressions += s.Impressions
		totalClicks += s.Clicks
	}

	impressionsKey := fmt.Sprintf(ImpressionsKey, expID)
	clicksKey := fmt.Sprintf(ClicksKey, expID)

	date := time.Now().Format("2006-01-02")
	impField := fmt.Sprintf("%s:%s", groupID, date)

	if redisImp, err := s.redisClient.HGet(ctx, impressionsKey, impField); err == nil {
		if imp, err := strconv.ParseInt(redisImp, 10, 64); err == nil {
			totalImpressions += imp
		}
	}

	clickFields, err := s.redisClient.HGetAll(ctx, clicksKey)
	if err == nil {
		prefix := fmt.Sprintf("%s:%s:", groupID, date)
		for field, val := range clickFields {
			if len(field) >= len(prefix) && field[:len(prefix)] == prefix {
				if click, err := strconv.ParseInt(val, 10, 64); err == nil {
					totalClicks += click
				}
			}
		}
	}

	statsCache := map[string]int64{
		"impressions": totalImpressions,
		"clicks":      totalClicks,
	}
	s.localCache.SetWithTTL(cacheKey, statsCache, 30*time.Second)

	return totalImpressions, totalClicks, nil
}

func (s *Service) flushStatsToDB(expID, groupID string, impressions, clicks int) {
	if impressions == 0 && clicks == 0 {
		return
	}

	today := time.Now().Truncate(24 * time.Hour)

	var stat ExperimentStats
	err := s.db.Where("experiment_id = ? AND group_id = ? AND date = ?", expID, groupID, today).First(&stat).Error

	if err == gorm.ErrRecordNotFound {
		stat = ExperimentStats{
			ExperimentID: expID,
			GroupID:      groupID,
			Impressions:  int64(impressions),
			Clicks:       int64(clicks),
			Date:         today,
		}
		s.db.Create(&stat)
	} else if err == nil {
		if impressions > 0 {
			stat.Impressions += int64(impressions)
		}
		if clicks > 0 {
			stat.Clicks += int64(clicks)
		}
		s.db.Save(&stat)
	}
}

func (s *Service) hashUserID(userID int64, salt string) uint32 {
	data := []byte(fmt.Sprintf("%d:%s", userID, salt))
	hash := sha256.Sum256(data)
	return binary.BigEndian.Uint32(hash[:4])
}

func (s *Service) toProtoExperiment(exp *Experiment) *pb.Experiment {
	groups, _ := exp.GetGroups()
	pbGroups := make([]*pb.Group, len(groups))
	for i, g := range groups {
		pbGroups[i] = &pb.Group{
			GroupId:           g.GroupID,
			Name:              g.Name,
			TrafficPercentage: g.TrafficPercentage,
			Variables:         g.Variables,
		}
	}

	return &pb.Experiment{
		ExperimentId: exp.ExperimentID,
		Name:         exp.Name,
		Description:  exp.Description,
		Groups:       pbGroups,
		Enabled:      exp.Enabled,
		CreatedAt:    exp.CreatedAt.Unix(),
		UpdatedAt:    exp.UpdatedAt.Unix(),
	}
}

func (s *Service) InitSchema() error {
	return s.db.AutoMigrate(&Experiment{}, &ExperimentStats{})
}

func (s *Service) CreateDefaultExperiment() error {
	var count int64
	s.db.Model(&Experiment{}).Count(&count)
	if count > 0 {
		return nil
	}

	exp := &Experiment{
		ExperimentID: "recommendation_algo",
		Name:         "Recommendation Algorithm Test",
		Description:  "AB test for recommendation algorithms",
		Enabled:      true,
	}

	groups := []*Group{
		{
			GroupID:           "control",
			Name:              "Control Group",
			TrafficPercentage: 50,
			Variables:         map[string]string{"algorithm": "hot"},
		},
		{
			GroupID:           "experiment",
			Name:              "Experiment Group",
			TrafficPercentage: 50,
			Variables:         map[string]string{"algorithm": "collaborative"},
		},
	}

	exp.SetGroups(groups)
	return s.db.Create(exp).Error
}
