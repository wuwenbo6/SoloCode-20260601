package service

import (
	"errors"
	"sync"
	"time"

	"ssh-web-terminal/internal/model"
	"ssh-web-terminal/internal/repository"
)

type AccessService struct {
	accessRepo *repository.AccessRepository
	cache      *accessCache
}

type accessCache struct {
	mu      sync.RWMutex
	entries map[string]*cacheEntry
}

type cacheEntry struct {
	value     bool
	expiresAt time.Time
}

const cacheTTL = 500 * time.Millisecond

func newAccessCache() *accessCache {
	return &accessCache{
		entries: make(map[string]*cacheEntry),
	}
}

func (c *accessCache) get(userID, serverID uint) (bool, bool) {
	key := cacheKey(userID, serverID)
	c.mu.RLock()
	defer c.mu.RUnlock()

	entry, exists := c.entries[key]
	if !exists || time.Now().After(entry.expiresAt) {
		return false, false
	}
	return entry.value, true
}

func (c *accessCache) set(userID, serverID uint, value bool) {
	key := cacheKey(userID, serverID)
	c.mu.Lock()
	defer c.mu.Unlock()

	c.entries[key] = &cacheEntry{
		value:     value,
		expiresAt: time.Now().Add(cacheTTL),
	}
}

func (c *accessCache) invalidateUser(userID uint) {
	c.mu.Lock()
	defer c.mu.Unlock()

	prefix := userCachePrefix(userID)
	for k := range c.entries {
		if len(k) >= len(prefix) && k[:len(prefix)] == prefix {
			delete(c.entries, k)
		}
	}
}

func (c *accessCache) invalidateAll() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries = make(map[string]*cacheEntry)
}

func cacheKey(userID, serverID uint) string {
	return userCachePrefix(userID) + ":" + itoa(uint64(serverID))
}

func userCachePrefix(userID uint) string {
	return itoa(uint64(userID))
}

func itoa(n uint64) string {
	if n == 0 {
		return "0"
	}
	var buf [20]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	return string(buf[i:])
}

func NewAccessService(accessRepo *repository.AccessRepository) *AccessService {
	return &AccessService{
		accessRepo: accessRepo,
		cache:      newAccessCache(),
	}
}

func (s *AccessService) RequestAccess(userID, serverID uint, reason, duration string) (*model.AccessRequest, error) {
	if s.accessRepo.HasActiveGrant(userID, serverID) {
		return nil, errors.New("already have active access to this server")
	}

	expiresAt, err := parseDuration(duration)
	if err != nil {
		return nil, err
	}

	req := &model.AccessRequest{
		UserID:    userID,
		ServerID:  serverID,
		Reason:    reason,
		Status:    "pending",
		ExpiresAt: expiresAt,
	}

	if err := s.accessRepo.CreateRequest(req); err != nil {
		return nil, err
	}

	return req, nil
}

func (s *AccessService) ApproveRequest(requestID, reviewerID uint) (*model.AccessGrant, error) {
	req, err := s.accessRepo.FindRequestByID(requestID)
	if err != nil {
		return nil, err
	}

	if req.Status != "pending" {
		return nil, errors.New("request is not pending")
	}

	now := time.Now()
	req.Status = "approved"
	req.ReviewedBy = &reviewerID
	req.ReviewedAt = &now

	if err := s.accessRepo.UpdateRequest(req); err != nil {
		return nil, err
	}

	grant := &model.AccessGrant{
		UserID:    req.UserID,
		ServerID:  req.ServerID,
		RequestID: req.ID,
		ExpiresAt: req.ExpiresAt,
	}

	if err := s.accessRepo.CreateGrant(grant); err != nil {
		return nil, err
	}

	s.cache.invalidateUser(req.UserID)

	return grant, nil
}

func (s *AccessService) RejectRequest(requestID, reviewerID uint) error {
	req, err := s.accessRepo.FindRequestByID(requestID)
	if err != nil {
		return err
	}

	if req.Status != "pending" {
		return errors.New("request is not pending")
	}

	now := time.Now()
	req.Status = "rejected"
	req.ReviewedBy = &reviewerID
	req.ReviewedAt = &now

	return s.accessRepo.UpdateRequest(req)
}

func (s *AccessService) ListRequests(status string) ([]model.AccessRequest, error) {
	return s.accessRepo.ListRequests(status)
}

func (s *AccessService) HasAccess(userID, serverID uint) bool {
	if value, ok := s.cache.get(userID, serverID); ok {
		return value
	}

	result := s.accessRepo.HasActiveGrant(userID, serverID)
	s.cache.set(userID, serverID, result)
	return result
}

func (s *AccessService) ListUserGrants(userID uint) ([]model.AccessGrant, error) {
	return s.accessRepo.ListUserGrants(userID)
}

func (s *AccessService) CleanupExpired() {
	s.cache.invalidateAll()
	s.accessRepo.CleanupExpired()
}

func parseDuration(duration string) (time.Time, error) {
	now := time.Now()
	switch duration {
	case "1h":
		return now.Add(1 * time.Hour), nil
	case "4h":
		return now.Add(4 * time.Hour), nil
	case "8h":
		return now.Add(8 * time.Hour), nil
	case "1d":
		return now.Add(24 * time.Hour), nil
	case "7d":
		return now.Add(7 * 24 * time.Hour), nil
	case "30d":
		return now.Add(30 * 24 * time.Hour), nil
	default:
		return now.Add(24 * time.Hour), nil
	}
}
