package redis

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"config-server/internal/config"
	"config-server/internal/model"

	"github.com/redis/go-redis/v9"
)

type Cache struct {
	client *redis.Client
	ttl    time.Duration
}

func NewCache(cfg *config.RedisConfig) (*Cache, error) {
	client := redis.NewClient(&redis.Options{
		Addr:     cfg.Addr,
		Password: cfg.Password,
		DB:       cfg.DB,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, err
	}

	return &Cache{
		client: client,
		ttl:    time.Duration(cfg.TTL) * time.Second,
	}, nil
}

func (c *Cache) Close() error {
	return c.client.Close()
}

func (c *Cache) getKey(key string) string {
	return fmt.Sprintf("config:%s", key)
}

func (c *Cache) Get(ctx context.Context, key string) (*model.ConfigItem, error) {
	cacheKey := c.getKey(key)
	data, err := c.client.Get(ctx, cacheKey).Bytes()
	if err == redis.Nil {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	var item model.ConfigItem
	if err := json.Unmarshal(data, &item); err != nil {
		return nil, err
	}
	return &item, nil
}

func (c *Cache) Set(ctx context.Context, key string, item *model.ConfigItem) error {
	cacheKey := c.getKey(key)
	data, err := json.Marshal(item)
	if err != nil {
		return err
	}
	return c.client.Set(ctx, cacheKey, data, c.ttl).Err()
}

func (c *Cache) Delete(ctx context.Context, key string) error {
	cacheKey := c.getKey(key)
	return c.client.Del(ctx, cacheKey).Err()
}

func (c *Cache) SetTTL(ttl int) {
	c.ttl = time.Duration(ttl) * time.Second
}
