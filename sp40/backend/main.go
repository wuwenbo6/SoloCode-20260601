package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"robot-backend/robot"
	"robot-backend/server"
)

type corsHandler struct {
	handler http.Handler
}

func (c *corsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	origin := r.Header.Get("Origin")
	if origin == "" {
		origin = "*"
	}
	w.Header().Set("Access-Control-Allow-Origin", origin)
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Access-Control-Allow-Credentials", "true")
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	c.handler.ServeHTTP(w, r)
}

func main() {
	planner := robot.NewPathPlanner()
	manager := robot.NewRobotManager(planner)
	vid := robot.NewVideoGenerator()
	recorder := robot.NewVideoRecorder()
	srv := server.NewServer(manager, vid, planner, recorder)

	mux := http.NewServeMux()
	mux.HandleFunc("/ws", srv.HandleWS)

	handler := &corsHandler{handler: mux}

	httpServer := &http.Server{
		Addr:    ":8080",
		Handler: handler,
	}

	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh
		log.Println("shutting down...")

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := httpServer.Shutdown(ctx); err != nil {
			log.Printf("shutdown error: %v", err)
		}
	}()

	log.Println("server starting on :8080")
	if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server error: %v", err)
	}
	log.Println("server stopped")
}
