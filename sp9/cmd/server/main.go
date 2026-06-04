package main

import (
	"flag"
	"fmt"
	"lisp-mapserver/internal/api"
	"lisp-mapserver/internal/heartbeat"
	"lisp-mapserver/internal/lisp"
	"lisp-mapserver/internal/mapping"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	lispAddr := flag.String("lisp-addr", ":4342", "LISP protocol listen address")
	httpAddr := flag.String("http-addr", ":8080", "HTTP API and dashboard listen address")
	checkInterval := flag.Duration("check-interval", 5*time.Second, "ETR heartbeat check interval")
	offlineTimeout := flag.Duration("offline-timeout", 15*time.Second, "Time without heartbeat before ETR is marked offline")
	flag.Parse()

	store := mapping.NewStore()

	lispHandler, err := lisp.NewHandler(store, *lispAddr)
	if err != nil {
		log.Fatalf("Failed to create LISP handler: %v", err)
	}

	hbConfig := heartbeat.Config{
		CheckInterval:   *checkInterval,
		OfflineTimeout:  *offlineTimeout,
		CleanupInterval: 60 * time.Second,
		CleanupAfter:    10 * time.Minute,
	}
	hbMonitor := heartbeat.NewMonitor(store, hbConfig)

	apiServer := api.NewServer(store)

	mux := http.NewServeMux()
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		apiServer.Handler().ServeHTTP(w, r)
	})
	mux.Handle("/", http.FileServer(http.Dir("web/static")))

	if err := lispHandler.Start(); err != nil {
		log.Fatalf("Failed to start LISP handler: %v", err)
	}
	hbMonitor.Start()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		log.Printf("[http] server starting on %s", *httpAddr)
		if err := http.ListenAndServe(*httpAddr, mux); err != nil {
			log.Fatalf("HTTP server error: %v", err)
		}
	}()

	fmt.Println()
	fmt.Println("╔══════════════════════════════════════════════════════╗")
	fmt.Println("║           LISP Map-Server Started                   ║")
	fmt.Println("╠══════════════════════════════════════════════════════╣")
	fmt.Printf("║  LISP Protocol : udp://%s                   ║\n", *lispAddr)
	fmt.Printf("║  Web Dashboard : http://localhost%s               ║\n", *httpAddr)
	fmt.Printf("║  Heartbeat Check: every %s                     ║\n", hbConfig.CheckInterval)
	fmt.Printf("║  Offline Timeout: %s                           ║\n", hbConfig.OfflineTimeout)
	fmt.Println("╚══════════════════════════════════════════════════════╝")
	fmt.Println()

	<-sigChan
	log.Println("Shutting down...")

	hbMonitor.Stop()
	lispHandler.Stop()

	log.Println("Server stopped.")
}
