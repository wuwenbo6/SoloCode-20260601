package main

import (
	"log"
	"os"
)

func main() {
	log.Printf("starting sensor monitor server...")

	var db *PostgresRepo
	db, err := NewPostgresRepo()
	if err != nil {
		log.Printf("warning: postgres not available, running without database: %v", err)
	} else {
		log.Printf("connected to postgresql")
		if err := db.InitSchema(); err != nil {
			log.Printf("warning: failed to init schema: %v", err)
		}

		migrationPath := "migrations/001_init.sql"
		if _, err := os.Stat(migrationPath); err == nil {
			if err := db.LoadMigration(migrationPath); err != nil {
				log.Printf("warning: failed to run migration: %v", err)
			} else {
				log.Printf("ran migration: %s", migrationPath)
			}
		}
	}

	var influx *InfluxRepo
	influx, err = NewInfluxRepo()
	if err != nil {
		log.Printf("warning: influxdb not available, running without time-series storage: %v", err)
	} else {
		log.Printf("connected to influxdb")
	}

	tm := NewThresholdManager(db)
	if db != nil {
		if err := tm.LoadFromDB(); err != nil {
			log.Printf("warning: failed to load thresholds from db: %v", err)
		}
	}

	ae := NewAlertEngine(db, tm)

	server := NewServer(db, influx, tm, ae)
	if err := server.Run(); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
