package broadcast

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"recommendation-system/api/proto/broadcast"
	"recommendation-system/pkg/cache"
	"recommendation-system/pkg/lru"
)

type CacheBroadcaster struct {
	redisClient    *cache.RedisClient
	localCache     *lru.Cache
	serviceName    string
	subscribeChan  chan *broadcast.CacheUpdateRequest
	broadcastAddrs []string
	mu             sync.RWMutex
	clients        map[string]broadcast.CacheBroadcastServiceClient
}

func NewCacheBroadcaster(redisClient *cache.RedisClient, localCache *lru.Cache, serviceName string) *CacheBroadcaster {
	b := &CacheBroadcaster{
		redisClient:   redisClient,
		localCache:    localCache,
		serviceName:   serviceName,
		subscribeChan: make(chan *broadcast.CacheUpdateRequest, 100),
		clients:       make(map[string]broadcast.CacheBroadcastServiceClient),
	}

	go b.subscribeToRedisChannel()
	go b.processCacheUpdates()

	return b
}

func (b *CacheBroadcaster) subscribeToRedisChannel() {
	pubsub := b.redisClient.Subscribe(context.Background(), "cache_updates")
	defer pubsub.Close()

	ch := pubsub.Channel()
	for msg := range ch {
		var req broadcast.CacheUpdateRequest
		if err := json.Unmarshal([]byte(msg.Payload), &req); err != nil {
			log.Printf("Failed to unmarshal cache update: %v", err)
			continue
		}

		select {
		case b.subscribeChan <- &req:
		default:
			log.Printf("Cache update channel full, dropping update")
		}
	}
}

func (b *CacheBroadcaster) processCacheUpdates() {
	for req := range b.subscribeChan {
		cacheKey := b.buildCacheKey(req.CacheType, req.Key)

		switch req.Operation {
		case broadcast.OperationType_CREATE, broadcast.OperationType_UPDATE:
			b.localCache.Delete(cacheKey)
		case broadcast.OperationType_DELETE, broadcast.OperationType_INVALIDATE:
			b.localCache.Delete(cacheKey)
		}

		log.Printf("[%s] Cache invalidated for key: %s (type: %v, op: %v)",
			b.serviceName, cacheKey, req.CacheType, req.Operation)
	}
}

func (b *CacheBroadcaster) BroadcastUpdate(ctx context.Context, cacheType broadcast.CacheType, key string, op broadcast.OperationType) error {
	req := &broadcast.CacheUpdateRequest{
		CacheType: cacheType,
		Key:       key,
		Operation: op,
		Timestamp: time.Now().UnixNano(),
	}

	data, err := json.Marshal(req)
	if err != nil {
		return fmt.Errorf("failed to marshal cache update: %w", err)
	}

	if err := b.redisClient.Publish(ctx, "cache_updates", data); err != nil {
		return fmt.Errorf("failed to publish cache update: %w", err)
	}

	return nil
}

func (b *CacheBroadcaster) buildCacheKey(cacheType broadcast.CacheType, key string) string {
	prefix := ""
	switch cacheType {
	case broadcast.CacheType_USER:
		prefix = "user:"
	case broadcast.CacheType_PRODUCT:
		prefix = "product:"
	case broadcast.CacheType_RECOMMENDATION:
		prefix = "rec:"
	case broadcast.CacheType_BROWSE_HISTORY:
		prefix = "browse:"
	}
	return prefix + key
}

func (b *CacheBroadcaster) InvalidateLocalCache(cacheType broadcast.CacheType, key string) {
	cacheKey := b.buildCacheKey(cacheType, key)
	b.localCache.Delete(cacheKey)
}

func (b *CacheBroadcaster) Close() {
	close(b.subscribeChan)
}
