package main

import (
	"log"
	"net"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"

	pb "recommendation-system/api/proto/user"
	"recommendation-system/internal/user"
	"recommendation-system/pkg/cache"
	"recommendation-system/pkg/config"
	"recommendation-system/pkg/database"
	"recommendation-system/pkg/grpcpool"
	"recommendation-system/pkg/lru"
)

func main() {
	cfg := config.Load()

	db, err := database.NewMySQL(cfg.MySQLDSN)
	if err != nil {
		log.Fatalf("Failed to connect to MySQL: %v", err)
	}

	redisClient := cache.NewRedisClient(cfg.RedisAddr, cfg.RedisPassword, cfg.RedisDB)

	localCache, err := lru.NewCache(1000, 5*time.Minute)
	if err != nil {
		log.Fatalf("Failed to create local cache: %v", err)
	}

	userService := user.NewService(db, redisClient, localCache)
	if err := userService.InitSchema(); err != nil {
		log.Fatalf("Failed to initialize schema: %v", err)
	}

	lis, err := net.Listen("tcp", cfg.ServicePorts.User)
	if err != nil {
		log.Fatalf("Failed to listen: %v", err)
	}

	grpcServer := grpc.NewServer(grpcpool.ServerOptions()...)
	pb.RegisterUserServiceServer(grpcServer, userService)
	reflection.Register(grpcServer)

	log.Printf("User Service starting on %s", cfg.ServicePorts.User)
	if err := grpcServer.Serve(lis); err != nil {
		log.Fatalf("Failed to serve: %v", err)
	}
}
