package main

import (
	"log"
	"net/http"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/wuwenbo/rdt-simulator/backend/internal/api"
	"github.com/wuwenbo/rdt-simulator/backend/internal/model"
	"github.com/wuwenbo/rdt-simulator/backend/internal/simulator"
	"github.com/wuwenbo/rdt-simulator/backend/internal/storage"
)

func main() {
	store := storage.NewStorage()

	store.AddCLOSGroup(&model.CreateCLOSRequest{
		Name:   "Default",
		CBM:    0xFFFFF,
		BWMbps: 0,
		Color:  "#00E5FF",
	})

	store.AddCLOSGroup(&model.CreateCLOSRequest{
		Name:   "High Priority",
		CBM:    0xFFFF0,
		BWMbps: 5000,
		Color:  "#4CAF50",
	})

	store.AddCLOSGroup(&model.CreateCLOSRequest{
		Name:   "Low Priority",
		CBM:    0x00FFF,
		BWMbps: 2000,
		Color:  "#FF9800",
	})

	store.AddCLOSGroup(&model.CreateCLOSRequest{
		Name:   "Restricted",
		CBM:    0x000FF,
		BWMbps: 500,
		Color:  "#F44336",
	})

	store.AddCLOSGroup(&model.CreateCLOSRequest{
		Name:   "Throttled",
		CBM:    0x0000F,
		BWMbps: 0,
		Color:  "#FF6B6B",
	})

	defaultProcesses := []struct {
		name     string
		rmid     int
		closID   int
		llcLimit float64
		bwLimit  float64
		priority int
	}{
		{"nginx-web", 100, 1, 25, 3000, 1},
		{"mysql-db", 101, 1, 30, 4000, 1},
		{"redis-cache", 102, 1, 20, 2500, 2},
		{"python-worker", 103, 2, 15, 1500, 3},
		{"java-app", 104, 2, 18, 1800, 3},
		{"nodejs-api", 105, 0, 12, 1200, 2},
		{"batch-job", 106, 4, 10, 500, 3},
	}

	for _, p := range defaultProcesses {
		store.AddProcess(&model.CreateProcessRequest{
			Name:     p.name,
			RMID:     p.rmid,
			CLOSID:   p.closID,
			LLCLimit: p.llcLimit,
			BWLimit:  p.bwLimit,
			Priority: p.priority,
		})
	}

	hub := simulator.NewWSHub()
	sim := simulator.NewSimulator(store, hub)

	r := gin.Default()

	config := cors.DefaultConfig()
	config.AllowAllOrigins = true
	config.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
	config.AllowHeaders = []string{"Origin", "Content-Type", "Accept"}
	r.Use(cors.New(config))

	handler := api.NewHandler(store, sim, hub)
	handler.SetupRoutes(r)

	sim.Start()

	promHandler := api.NewPrometheusHandler(store)

	mux := http.NewServeMux()
	mux.HandleFunc("/ws/metrics", hub.HandleWebSocket)
	mux.Handle("/metrics", promHandler)
	mux.Handle("/", r)

	log.Println("Intel RDT Simulator starting on :8080")
	log.Println("WebSocket endpoint: ws://localhost:8080/ws/metrics")
	log.Println("API endpoint: http://localhost:8080/api")
	log.Println("Prometheus metrics: http://localhost:8080/metrics")

	if err := http.ListenAndServe(":8080", mux); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
