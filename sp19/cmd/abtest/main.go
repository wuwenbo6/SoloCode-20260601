package main

import (
	"log"
	"net"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"

	pb "recommendation-system/api/proto/abtest"
	"recommendation-system/internal/abtest"
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

	abtestService := abtest.NewService(db, redisClient, localCache)
	if err := abtestService.InitSchema(); err != nil {
		log.Fatalf("Failed to initialize schema: %v", err)
	}

	if err := abtestService.CreateDefaultExperiment(); err != nil {
		log.Printf("Warning: Failed to create default experiment: %v", err)
	}

	lis, err := net.Listen("tcp", cfg.ServicePorts.ABTest)
	if err != nil {
		log.Fatalf("Failed to listen: %v", err)
	}

	grpcServer := grpc.NewServer(grpcpool.ServerOptions()...)
	pb.RegisterABTestServiceServer(grpcServer, abtestService)
	reflection.Register(grpcServer)

	log.Printf("AB Test Service starting on %s", cfg.ServicePorts.ABTest)
	if err := grpcServer.Serve(lis); err != nil {
		log.Fatalf("Failed to serve: %v", err)
	}
}
