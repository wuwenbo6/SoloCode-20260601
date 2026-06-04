package main

import (
	"3d-printer-controller/internal/api"
	"3d-printer-controller/internal/database"
	"3d-printer-controller/internal/transport"
	"flag"
	"log"

	"github.com/gin-gonic/gin"
)

func main() {
	dbPath := flag.String("db", "printer.db", "Path to SQLite database file")
	port := flag.String("port", "8080", "Server port")
	flag.Parse()

	err := database.Init(*dbPath)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	wtServer := transport.GetWebTransportServer()
	wtServer.StartStream()

	r := gin.Default()

	apiHandler := api.NewAPI()
	apiHandler.SetupRoutes(r)

	log.Printf("Server starting on port %s...", *port)
	log.Printf("Database: %s", *dbPath)
	log.Printf("API Base URL: http://localhost:%s/api", *port)
	log.Printf("WebSocket Status: ws://localhost:%s/api/ws/status", *port)
	log.Printf("Video Stream: ws://localhost:%s/api/video/ws", *port)

	err = r.Run(":" + *port)
	if err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
