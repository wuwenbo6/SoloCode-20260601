package main

import (
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"

	"drone-fpv-backend/handler"
	"drone-fpv-backend/service"
	"drone-fpv-backend/ws"

	"github.com/gin-gonic/gin"
)

func main() {
	log.SetFlags(log.LstdFlags | log.Lmicroseconds)
	log.Println("[Main] Starting Drone FPV Backend...")

	gs := service.NewGStreamerService()
	gimbalSvc := service.NewGimbalService()
	ts := service.NewTelemetryService(gimbalSvc)

	ts.Start()

	wt := service.NewWebTransportServer(gs, ts, "0.0.0.0:4433")

	hub := ws.NewHub(gimbalSvc)
	go hub.Run()

	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Logger())
	r.Use(gin.Recovery())

	streamHandler := handler.NewStreamHandler(gs, wt)
	streamHandler.RegisterRoutes(r)

	telemetryHandler := handler.NewTelemetryHandler(ts, gimbalSvc)
	telemetryHandler.RegisterRoutes(r)

	r.GET("/ws/headtrack", func(c *gin.Context) {
		hub.HandleWebSocket(c.Writer, c.Request)
	})

	frontendDist := filepath.Join("..", "frontend", "dist")
	if info, err := os.Stat(frontendDist); err == nil && info.IsDir() {
		r.Static("/assets", filepath.Join(frontendDist, "assets"))
		r.StaticFile("/vite.svg", filepath.Join(frontendDist, "vite.svg"))
		r.NoRoute(func(c *gin.Context) {
			indexPath := filepath.Join(frontendDist, "index.html")
			if _, err := os.Stat(indexPath); err == nil {
				c.File(indexPath)
			} else {
				c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			}
		})
		log.Println("[Main] Serving frontend from", frontendDist)
	} else {
		log.Println("[Main] Frontend dist not found, API-only mode")
	}

	go func() {
		log.Println("[Main] HTTP server starting on :8080")
		if err := r.Run(":8080"); err != nil && err != http.ErrServerClosed {
			log.Fatal("[Main] HTTP server error:", err)
		}
	}()

	go func() {
		log.Println("[Main] WebTransport server starting on :4433")
		if err := wt.Start(); err != nil {
			log.Println("[Main] WebTransport server error:", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("[Main] Shutting down...")
	gs.Stop()
	wt.Stop()
	log.Println("[Main] Server stopped")
}
