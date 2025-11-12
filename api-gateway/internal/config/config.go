package config

import (
	"log"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)


type Config struct {
	Server		ServerConfig
	RabbitMQ	RabbitMQConfig
	Redis		RedisConfig
	Auth		AuthConfig
	UserService	UserServiceConfig
}


type ServerConfig struct {
	Port		string
	Environment	string
}


type RabbitMQConfig struct {
	URL			string
	Exchange	string
	EmailQueue	string
	PushQueue	string
	FailedQueue	string
}


type RedisConfig struct {
	URL			string
	DB			int
}


type AuthConfig struct {
	JWTSecret		string
	AccessSecret	string  // User Service uses different secrets
}

type UserServiceConfig struct {
	URL		string
}

func Load() *Config {
	_ = godotenv.Load()

	return &Config{
		Server: ServerConfig{
			Port: getEnv("PORT", "8080"),
			Environment: getEnv("ENV", "development"),
		},

		RabbitMQ: RabbitMQConfig{
			URL:		getEnv("RABBITMQ_URL", "amqp://admin:admin@localhost:5672/"),
			Exchange: 	getEnv("RABBITMQ_EXCHANGE", "notification.direct"),
			EmailQueue: getEnv("RABBITMQ_EMAIL_QUEUE", "email.queue"),
			PushQueue: 	getEnv("RABBITMQ_PUSH_QUEUE", "push.queue"),
			FailedQueue: getEnv("RABBITMQ_FAILED_QUEUE", "failed.queue"),
		},
		Redis: RedisConfig{
			URL:	getEnv("REDIS_URL", "redis://localhost:6379"),
			DB: 	getEnvAsInt("REDIS_DB", 0),
		},
		Auth: AuthConfig{
			JWTSecret:    getEnv("JWT_SECRET", "change-in-prod"),
			AccessSecret: getEnv("ACCESS_SECRET", "your-access-secret"),
		},
		UserService: UserServiceConfig{
			URL: getEnv("USER_SERVICE_URL", "http://localhost:3000"),
		},
	}
}


func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}


func getEnvAsInt(key string, defaultValue int) int {
	valueStr := os.Getenv(key)
	if valueStr == "" {
		return defaultValue
	}
	value, err := strconv.Atoi(valueStr)
	if err != nil {
		log.Printf("Warning: Invalid integer value for %s, using default: %d", key, defaultValue)
	}
	return value
}