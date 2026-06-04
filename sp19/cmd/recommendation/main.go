package main

import (
	"log"
	"net"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"

	abtestpb "recommendation-system/api/proto/abtest"
	productpb "recommendation-system/api/proto/product"
	recpb "recommendation-system/api/proto/recommendation"
	userpb "recommendation-system/api/proto/user"
	"recommendation-system/internal/recommendation"
	"recommendation-system/pkg/cache"
	"recommendation-system/pkg/config"
	"recommendation-system/pkg/grpcpool"
	"recommendation-system/pkg/lru"
)

func main() {
	cfg := config.Load()

	redisClient := cache.NewRedisClient(cfg.RedisAddr, cfg.RedisPassword, cfg.RedisDB)

	localCache, err := lru.NewCache(1000, 5*time.Minute)
	if err != nil {
		log.Fatalf("Failed to create local cache: %v", err)
	}

	userConn, err := grpcpool.NewClientConn("localhost" + cfg.ServicePorts.User)
	if err != nil {
		log.Fatalf("Failed to connect to user service: %v", err)
	}
	defer userConn.Close()
	userClient := userpb.NewUserServiceClient(userConn)

	productConn, err := grpcpool.NewClientConn("localhost" + cfg.ServicePorts.Product)
	if err != nil {
		log.Fatalf("Failed to connect to product service: %v", err)
	}
	defer productConn.Close()
	productClient := productpb.NewProductServiceClient(productConn)

	abtestConn, err := grpcpool.NewClientConn("localhost" + cfg.ServicePorts.ABTest)
	if err != nil {
		log.Fatalf("Failed to connect to abtest service: %v", err)
	}
	defer abtestConn.Close()
	abtestClient := abtestpb.NewABTestServiceClient(abtestConn)

	recService := recommendation.NewService(
		redisClient,
		localCache,
		userClient,
		productClient,
		abtestClient,
	)
	defer recService.Close()

	lis, err := net.Listen("tcp", cfg.ServicePorts.Recommendation)
	if err != nil {
		log.Fatalf("Failed to listen: %v", err)
	}

	grpcServer := grpc.NewServer(grpcpool.ServerOptions()...)
	recpb.RegisterRecommendationServiceServer(grpcServer, recService)
	reflection.Register(grpcServer)

	log.Printf("Recommendation Service starting on %s", cfg.ServicePorts.Recommendation)
	if err := grpcServer.Serve(lis); err != nil {
		log.Fatalf("Failed to serve: %v", err)
	}
}
