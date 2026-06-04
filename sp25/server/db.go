package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strconv"
	"time"

	_ "github.com/lib/pq"
)

type PostgresRepo struct {
	db *sql.DB
}

type AlertStats struct {
	ByLevel  map[string]int `json:"byLevel"`
	ByMetric map[string]int `json:"byMetric"`
	ByHour   map[string]int `json:"byHour"`
}

func NewPostgresRepo() (*PostgresRepo, error) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://postgres:postgres@localhost:5432/sensor_monitor?sslmode=disable"
	}

	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	return &PostgresRepo{db: db}, nil
}

func (r *PostgresRepo) Close() error {
	return r.db.Close()
}

func (r *PostgresRepo) InitSchema() error {
	schema := `
	CREATE TABLE IF NOT EXISTS alerts (
		id SERIAL PRIMARY KEY,
		sensor_id INTEGER NOT NULL,
		metric VARCHAR(50) NOT NULL,
		value DOUBLE PRECISION NOT NULL,
		threshold DOUBLE PRECISION NOT NULL,
		level VARCHAR(20) NOT NULL,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
		acknowledged BOOLEAN DEFAULT FALSE
	);
	CREATE INDEX IF NOT EXISTS idx_alerts_sensor_id ON alerts(sensor_id);
	CREATE INDEX IF NOT EXISTS idx_alerts_level ON alerts(level);
	CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at);
	CREATE INDEX IF NOT EXISTS idx_alerts_metric ON alerts(metric);

	CREATE TABLE IF NOT EXISTS thresholds (
		metric VARCHAR(50) PRIMARY KEY,
		min_value DOUBLE PRECISION NOT NULL,
		max_value DOUBLE PRECISION NOT NULL,
		warning_percent DOUBLE PRECISION NOT NULL
	);

	CREATE TABLE IF NOT EXISTS sensors (
		id INTEGER PRIMARY KEY,
		name VARCHAR(100) NOT NULL,
		area VARCHAR(100) NOT NULL,
		status VARCHAR(20) DEFAULT 'normal'
	);
	`
	_, err := r.db.Exec(schema)
	if err != nil {
		return fmt.Errorf("failed to init schema: %w", err)
	}
	return nil
}

func (r *PostgresRepo) InsertAlert(alert AlertPayload) error {
	_, err := r.db.Exec(
		`INSERT INTO alerts (sensor_id, metric, value, threshold, level) VALUES ($1, $2, $3, $4, $5)`,
		alert.SensorID, alert.Metric, alert.Value, alert.Threshold, alert.Level,
	)
	if err != nil {
		log.Printf("failed to insert alert: %v", err)
	}
	return err
}

type AlertQueryParams struct {
	SensorID int
	Level    string
	Start    string
	End      string
	Page     int
	Limit    int
}

func (r *PostgresRepo) QueryAlerts(params AlertQueryParams) ([]AlertRecord, int, error) {
	if params.Page < 1 {
		params.Page = 1
	}
	if params.Limit < 1 || params.Limit > 100 {
		params.Limit = 20
	}

	where := "WHERE 1=1"
	args := []interface{}{}
	argIdx := 1

	if params.SensorID > 0 {
		where += fmt.Sprintf(" AND sensor_id = $%d", argIdx)
		args = append(args, params.SensorID)
		argIdx++
	}
	if params.Level != "" {
		where += fmt.Sprintf(" AND level = $%d", argIdx)
		args = append(args, params.Level)
		argIdx++
	}
	if params.Start != "" {
		where += fmt.Sprintf(" AND created_at >= $%d", argIdx)
		args = append(args, params.Start)
		argIdx++
	}
	if params.End != "" {
		where += fmt.Sprintf(" AND created_at <= $%d", argIdx)
		args = append(args, params.End)
		argIdx++
	}

	var total int
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM alerts %s", where)
	err := r.db.QueryRow(countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	offset := (params.Page - 1) * params.Limit
	query := fmt.Sprintf(
		"SELECT id, sensor_id, metric, value, threshold, level, created_at, acknowledged FROM alerts %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d",
		where, argIdx, argIdx+1,
	)
	args = append(args, params.Limit, offset)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var records []AlertRecord
	for rows.Next() {
		var rec AlertRecord
		var createdAt time.Time
		var acknowledged bool
		err := rows.Scan(&rec.ID, &rec.SensorID, &rec.Metric, &rec.Value, &rec.Threshold, &rec.Level, &createdAt, &acknowledged)
		if err != nil {
			return nil, 0, err
		}
		rec.CreatedAt = createdAt.Format(time.RFC3339)
		rec.Acknowledged = acknowledged
		records = append(records, rec)
	}

	return records, total, nil
}

func (r *PostgresRepo) AcknowledgeAlert(id int) error {
	_, err := r.db.Exec("UPDATE alerts SET acknowledged = TRUE WHERE id = $1", id)
	return err
}

func (r *PostgresRepo) GetThresholds() ([]ThresholdConfig, error) {
	rows, err := r.db.Query("SELECT metric, min_value, max_value, warning_percent FROM thresholds")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var configs []ThresholdConfig
	for rows.Next() {
		var cfg ThresholdConfig
		err := rows.Scan(&cfg.Metric, &cfg.MinValue, &cfg.MaxValue, &cfg.WarningPercent)
		if err != nil {
			return nil, err
		}
		configs = append(configs, cfg)
	}
	return configs, nil
}

func (r *PostgresRepo) SetThreshold(cfg ThresholdConfig) error {
	_, err := r.db.Exec(
		`INSERT INTO thresholds (metric, min_value, max_value, warning_percent) VALUES ($1, $2, $3, $4)
		 ON CONFLICT (metric) DO UPDATE SET min_value = $2, max_value = $3, warning_percent = $4`,
		cfg.Metric, cfg.MinValue, cfg.MaxValue, cfg.WarningPercent,
	)
	return err
}

func (r *PostgresRepo) UpsertSensors(sensors []SensorInfo) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	for _, s := range sensors {
		_, err := tx.Exec(
			`INSERT INTO sensors (id, name, area, status) VALUES ($1, $2, $3, $4)
			 ON CONFLICT (id) DO UPDATE SET name = $2, area = $3, status = $4`,
			s.ID, s.Name, s.Area, s.Status,
		)
		if err != nil {
			tx.Rollback()
			return err
		}
	}
	return tx.Commit()
}

func (r *PostgresRepo) GetSensors() ([]SensorInfo, error) {
	rows, err := r.db.Query("SELECT id, name, area, status FROM sensors ORDER BY id")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sensors []SensorInfo
	for rows.Next() {
		var s SensorInfo
		err := rows.Scan(&s.ID, &s.Name, &s.Area, &s.Status)
		if err != nil {
			return nil, err
		}
		sensors = append(sensors, s)
	}
	return sensors, nil
}

func (r *PostgresRepo) UpdateSensorStatus(id int, status string) error {
	_, err := r.db.Exec("UPDATE sensors SET status = $1 WHERE id = $2", status, id)
	return err
}

func (r *PostgresRepo) GetAlertStats() (*AlertStats, error) {
	stats := &AlertStats{
		ByLevel:  make(map[string]int),
		ByMetric: make(map[string]int),
		ByHour:   make(map[string]int),
	}

	rows, err := r.db.Query("SELECT level, COUNT(*) FROM alerts GROUP BY level")
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var level string
		var count int
		if err := rows.Scan(&level, &count); err != nil {
			rows.Close()
			return nil, err
		}
		stats.ByLevel[level] = count
	}
	rows.Close()

	rows, err = r.db.Query("SELECT metric, COUNT(*) FROM alerts GROUP BY metric")
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var metric string
		var count int
		if err := rows.Scan(&metric, &count); err != nil {
			rows.Close()
			return nil, err
		}
		stats.ByMetric[metric] = count
	}
	rows.Close()

	rows, err = r.db.Query("SELECT EXTRACT(HOUR FROM created_at) as hour, COUNT(*) FROM alerts WHERE created_at > NOW() - INTERVAL '24 hours' GROUP BY hour ORDER BY hour")
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var hour float64
		var count int
		if err := rows.Scan(&hour, &count); err != nil {
			rows.Close()
			return nil, err
		}
		stats.ByHour[strconv.Itoa(int(hour))] = count
	}
	rows.Close()

	return stats, nil
}

func (r *PostgresRepo) RunMigration(migrationSQL string) error {
	_, err := r.db.Exec(migrationSQL)
	return err
}

func (r *PostgresRepo) LoadMigration(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("failed to read migration file: %w", err)
	}
	return r.RunMigration(string(data))
}

func parseIntOrDefault(s string, def int) int {
	v, err := strconv.Atoi(s)
	if err != nil {
		return def
	}
	return v
}

func marshalJSON(v interface{}) []byte {
	data, err := json.Marshal(v)
	if err != nil {
		log.Printf("failed to marshal json: %v", err)
		return []byte("{}")
	}
	return data
}
