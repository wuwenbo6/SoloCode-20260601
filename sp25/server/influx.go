package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	influxdb2 "github.com/influxdata/influxdb-client-go/v2"
	"github.com/influxdata/influxdb-client-go/v2/api"
	"github.com/influxdata/influxdb-client-go/v2/api/write"
	"github.com/influxdata/influxdb-client-go/v2/domain"
)

type InfluxRepo struct {
	client   influxdb2.Client
	writeAPI api.WriteAPIBlocking
	queryAPI api.QueryAPI
	org      string
	bucket   string
}

func NewInfluxRepo() (*InfluxRepo, error) {
	url := os.Getenv("INFLUX_URL")
	if url == "" {
		url = "http://localhost:8086"
	}
	token := os.Getenv("INFLUX_TOKEN")
	if token == "" {
		token = "my-super-secret-auth-token"
	}
	org := os.Getenv("INFLUX_ORG")
	if org == "" {
		org = "sensor-org"
	}
	bucket := os.Getenv("INFLUX_BUCKET")
	if bucket == "" {
		bucket = "sensor-data"
	}

	client := influxdb2.NewClient(url, token)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	ok, err := client.Ping(ctx)
	if err != nil || !ok {
		return nil, fmt.Errorf("failed to ping influxdb: %w", err)
	}

	ir := &InfluxRepo{
		client: client,
		org:    org,
		bucket: bucket,
	}

	if err := ir.ensureBucket(ctx); err != nil {
		log.Printf("warning: could not ensure bucket exists: %v", err)
	}

	ir.writeAPI = client.WriteAPIBlocking(org, bucket)
	ir.queryAPI = client.QueryAPI(org)

	return ir, nil
}

func (ir *InfluxRepo) ensureBucket(ctx context.Context) error {
	orgAPI := ir.client.OrganizationsAPI()
	orgObj, err := orgAPI.FindOrganizationByName(ctx, ir.org)
	if err != nil {
		orgObj, err = orgAPI.CreateOrganizationWithName(ctx, ir.org)
		if err != nil {
			return fmt.Errorf("failed to create org: %w", err)
		}
	}

	bucketsAPI := ir.client.BucketsAPI()
	_, err = bucketsAPI.FindBucketByName(ctx, ir.bucket)
	if err != nil {
		retention := domain.RetentionRule{EverySeconds: 2592000}
		_, err = bucketsAPI.CreateBucketWithName(ctx, orgObj, ir.bucket, retention)
		if err != nil {
			return fmt.Errorf("failed to create bucket: %w", err)
		}
		log.Printf("created influxdb bucket: %s", ir.bucket)
	}
	return nil
}

func (ir *InfluxRepo) Close() {
	ir.client.Close()
}

func (ir *InfluxRepo) WriteSensorData(data SensorData) error {
	p := influxdb2.NewPoint(
		"sensor_readings",
		map[string]string{
			"sensor_id": fmt.Sprintf("%d", data.ID),
		},
		map[string]interface{}{
			"temperature": data.Temperature,
			"pressure":    data.Pressure,
			"vibration":   data.Vibration,
		},
		time.UnixMilli(data.Timestamp),
	)
	return ir.writeAPI.WritePoint(context.Background(), p)
}

func (ir *InfluxRepo) WriteSensorDataBatch(batch []SensorData) error {
	points := make([]*write.Point, 0, len(batch))
	for _, data := range batch {
		p := influxdb2.NewPoint(
			"sensor_readings",
			map[string]string{
				"sensor_id": fmt.Sprintf("%d", data.ID),
			},
			map[string]interface{}{
				"temperature": data.Temperature,
				"pressure":    data.Pressure,
				"vibration":   data.Vibration,
			},
			time.UnixMilli(data.Timestamp),
		)
		points = append(points, p)
	}
	return ir.writeAPI.WritePoint(context.Background(), points...)
}

func (ir *InfluxRepo) QueryHistory(start, end time.Time, sensorIDs []int) ([]SensorData, error) {
	filter := ""
	if len(sensorIDs) > 0 {
		filter = "|> filter(fn: (r) => "
		for i, id := range sensorIDs {
			if i > 0 {
				filter += " or "
			}
			filter += fmt.Sprintf("r[\"sensor_id\"] == \"%d\"", id)
		}
		filter += ")"
	}

	query := fmt.Sprintf(`
		from(bucket: "%s")
		|> range(start: %s, stop: %s)
		|> filter(fn: (r) => r["_measurement"] == "sensor_readings")
		%s
		|> pivot(rowKey: ["_time", "sensor_id"], columnKey: ["_field"], valueColumn: "_value")
	`, ir.bucket, start.Format(time.RFC3339Nano), end.Format(time.RFC3339Nano), filter)

	result, err := ir.queryAPI.Query(context.Background(), query)
	if err != nil {
		return nil, fmt.Errorf("failed to query influxdb: %w", err)
	}

	var data []SensorData
	for result.Next() {
		record := result.Record()
		ts := record.Time()
		sensorIDStr, ok := record.ValueByKey("sensor_id").(string)
		if !ok {
			continue
		}
		var sensorID int
		fmt.Sscanf(sensorIDStr, "%d", &sensorID)

		temp, _ := record.ValueByKey("temperature").(float64)
		press, _ := record.ValueByKey("pressure").(float64)
		vib, _ := record.ValueByKey("vibration").(float64)

		data = append(data, SensorData{
			ID:          sensorID,
			Timestamp:   ts.UnixMilli(),
			Temperature: temp,
			Pressure:    press,
			Vibration:   vib,
		})
	}
	if result.Err() != nil {
		return nil, result.Err()
	}

	return data, nil
}
