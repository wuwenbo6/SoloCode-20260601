package config

import (
	"os"
	"strconv"
)

type Config struct {
	MySQLDSN      string
	RedisAddr     string
	RedisPassword string
	RedisDB       int
	ServicePorts  ServicePorts
}

type ServicePorts struct {
	User           string
	Product        string
	Recommendation string
	ABTest         string
	Gateway        string
}

func Load() *Config {
	return &Config{
		MySQLDSN: getEnv("MYSQL_DSN", "root:password@tcp(127.0.0.1:3306)/recommendation?charset=utf8mb4&parseTime=True&loc=Local"),
		RedisAddr: getEnv("REDIS_ADDR", "127.0.0.1:6379"),
		RedisPassword: getEnv("REDIS_PASSWORD", ""),
		RedisDB: getEnvInt("REDIS_DB", 0),
		ServicePorts: ServicePorts{
			User:           getEnv("USER_SERVICE_PORT", ":50051"),
			Product:        getEnv("PRODUCT_SERVICE_PORT", ":50052"),
			Recommendation: getEnv("RECOMMENDATION_SERVICE_PORT", ":50053"),
			ABTest:         getEnv("ABTEST_SERVICE_PORT", ":50054"),
			Gateway:        getEnv("GATEWAY_PORT", ":8080"),
		},
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if v, err := strconv.Atoi(value); err == nil {
			return v
		}
	}
	return defaultValue
}
