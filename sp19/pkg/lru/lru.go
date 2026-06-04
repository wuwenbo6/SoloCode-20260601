package lru

import (
	"math/rand"
	"sync"
	"time"

	lru "github.com/hashicorp/golang-lru/v2"
)

type Cache struct {
	cache      *lru.Cache[string, cacheItem]
	mu         sync.RWMutex
	maxSize    int
	ttl        time.Duration
	jitter     time.Duration
	onEvicted  func(key string, value interface{})
	randSource *rand.Rand
	randMu     sync.Mutex
}

type cacheItem struct {
	value     interface{}
	expiresAt time.Time
}

func NewCache(maxSize int, ttl time.Duration) (*Cache, error) {
	return NewCacheWithJitter(maxSize, ttl, ttl/5)
}

func NewCacheWithJitter(maxSize int, ttl time.Duration, jitter time.Duration) (*Cache, error) {
	c := &Cache{
		maxSize:    maxSize,
		ttl:        ttl,
		jitter:     jitter,
		randSource: rand.New(rand.NewSource(time.Now().UnixNano())),
	}

	lruCache, err := lru.NewWithEvict(maxSize, c.onEvict)
	if err != nil {
		return nil, err
	}

	c.cache = lruCache
	return c, nil
}

func (c *Cache) addJitter(ttl time.Duration) time.Duration {
	if c.jitter <= 0 {
		return ttl
	}

	c.randMu.Lock()
	jitterNs := c.randSource.Int63n(int64(c.jitter))
	c.randMu.Unlock()

	return ttl + time.Duration(jitterNs)
}

func (c *Cache) onEvict(key string, item cacheItem) {
	if c.onEvicted != nil {
		c.onEvicted(key, item.value)
	}
}

func (c *Cache) SetOnEvicted(f func(key string, value interface{})) {
	c.onEvicted = f
}

func (c *Cache) Get(key string) (interface{}, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	item, ok := c.cache.Get(key)
	if !ok {
		return nil, false
	}

	if !item.expiresAt.IsZero() && time.Now().After(item.expiresAt) {
		c.cache.Remove(key)
		return nil, false
	}

	return item.value, true
}

func (c *Cache) Set(key string, value interface{}) {
	ttl := c.addJitter(c.ttl)
	c.SetWithTTL(key, value, ttl)
}

func (c *Cache) SetWithTTL(key string, value interface{}, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()

	item := cacheItem{
		value: value,
	}

	if ttl > 0 {
		item.expiresAt = time.Now().Add(ttl)
	}

	c.cache.Add(key, item)
}

func (c *Cache) Delete(key string) bool {
	c.mu.Lock()
	defer c.mu.Unlock()

	return c.cache.Remove(key)
}

func (c *Cache) Contains(key string) bool {
	c.mu.RLock()
	defer c.mu.RUnlock()

	item, ok := c.cache.Peek(key)
	if !ok {
		return false
	}

	if !item.expiresAt.IsZero() && time.Now().After(item.expiresAt) {
		c.cache.Remove(key)
		return false
	}

	return true
}

func (c *Cache) Len() int {
	c.mu.RLock()
	defer c.mu.RUnlock()

	return c.cache.Len()
}

func (c *Cache) Purge() {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.cache.Purge()
}

func (c *Cache) Keys() []string {
	c.mu.RLock()
	defer c.mu.RUnlock()

	return c.cache.Keys()
}
