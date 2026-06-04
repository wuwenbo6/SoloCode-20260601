package main

import (
	"context"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/keepalive"

	abtestpb "recommendation-system/api/proto/abtest"
	productpb "recommendation-system/api/proto/product"
	recpb "recommendation-system/api/proto/recommendation"
	userpb "recommendation-system/api/proto/user"
	"recommendation-system/pkg/config"
)

func main() {
	cfg := config.Load()

	ctx := context.Background()
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	mux := runtime.NewServeMux(
		runtime.WithIncomingHeaderMatcher(func(key string) (string, bool) {
			return key, true
		}),
		runtime.WithOutgoingHeaderMatcher(func(key string) (string, bool) {
			return strings.ToLower(key), true
		}),
	)

	kaParams := keepalive.ClientParameters{
		Time:                10 * time.Second,
		Timeout:             3 * time.Second,
		PermitWithoutStream: true,
	}

	opts := []grpc.DialOption{
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithKeepaliveParams(kaParams),
	}

	if err := userpb.RegisterUserServiceHandlerFromEndpoint(ctx, mux, "localhost"+cfg.ServicePorts.User, opts); err != nil {
		log.Fatalf("Failed to register user service gateway: %v", err)
	}

	if err := productpb.RegisterProductServiceHandlerFromEndpoint(ctx, mux, "localhost"+cfg.ServicePorts.Product, opts); err != nil {
		log.Fatalf("Failed to register product service gateway: %v", err)
	}

	if err := recpb.RegisterRecommendationServiceHandlerFromEndpoint(ctx, mux, "localhost"+cfg.ServicePorts.Recommendation, opts); err != nil {
		log.Fatalf("Failed to register recommendation service gateway: %v", err)
	}

	if err := abtestpb.RegisterABTestServiceHandlerFromEndpoint(ctx, mux, "localhost"+cfg.ServicePorts.ABTest, opts); err != nil {
		log.Fatalf("Failed to register abtest service gateway: %v", err)
	}

	corsMux := withCORS(mux)

	log.Printf("gRPC Gateway starting on %s", cfg.ServicePorts.Gateway)
	log.Printf("Endpoints:")
	log.Printf("  User Service:         GET/POST/PUT/DELETE /v1/users/*")
	log.Printf("  Product Service:      GET/POST/PUT/DELETE /v1/products/*")
	log.Printf("  Recommendation Service: GET/POST /v1/recommendations/*")
	log.Printf("  AB Test Service:      GET/POST /v1/abtest/*")

	if err := http.ListenAndServe(cfg.ServicePorts.Gateway, corsMux); err != nil {
		log.Fatalf("Failed to serve gateway: %v", err)
	}
}

func withCORS(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		h.ServeHTTP(w, r)
	})
}
