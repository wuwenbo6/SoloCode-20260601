package main

import (
	"log"
	"os"

	"config-server/internal/config"
	"config-server/internal/etcd"
	"config-server/internal/handler"
	"config-server/internal/redis"

	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.Load()

	if key := os.Getenv("CONFIG_ENCRYPTION_KEY"); key != "" {
		cfg.Encryption.Key = key
	}

	etcdStore, err := etcd.NewStore(&cfg.Etcd, cfg.Encryption.Key)
	if err != nil {
		log.Fatalf("Failed to connect to etcd: %v", err)
	}
	defer etcdStore.Close()
	log.Println("Connected to etcd successfully")

	redisCache, err := redis.NewCache(&cfg.Redis)
	if err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	defer redisCache.Close()
	log.Println("Connected to Redis successfully")

	configHandler := handler.NewConfigHandler(etcdStore, redisCache, cfg)

	r := gin.Default()

	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Operator")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	api := r.Group("/api/v1")
	{
		api.POST("/configs", configHandler.CreateConfig)
		api.GET("/configs", configHandler.ListConfigs)
		api.GET("/configs/:key", configHandler.GetConfig)
		api.PUT("/configs/:key", configHandler.UpdateConfig)
		api.DELETE("/configs/:key", configHandler.DeleteConfig)

		api.GET("/configs/:key/versions", configHandler.GetVersions)
		api.POST("/configs/:key/rollback", configHandler.RollbackConfig)

		api.GET("/audit", configHandler.QueryAuditLogs)

		api.GET("/ws", configHandler.HandleWebSocket)
	}

	log.Printf("Server starting on port %s", cfg.Server.Port)
	if err := r.Run(cfg.Server.Port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
