package middleware

import (
	"time"

	"github.com/gin-gonic/gin"
)

func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Authorization")
		c.Header("Access-Control-Max-Age", "86400")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

func ExpiredGrantCleanup() gin.HandlerFunc {
	return func(c *gin.Context) {
		go func() {
			if repo, ok := c.Get("accessRepo"); ok {
				if accessRepo, ok := repo.(interface{ CleanupExpired() }); ok {
					accessRepo.CleanupExpired()
				}
			}
		}()
		c.Next()
	}
}

func PeriodicCleanup(interval time.Duration, cleanupFunc func()) {
	ticker := time.NewTicker(interval)
	go func() {
		for range ticker.C {
			cleanupFunc()
		}
	}()
}
