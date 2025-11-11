package cache


import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)


type RedisClient struct {
	client *redis.Client
}


func NewRedisClient(url string, db int) (*RedisClient, error) {
	opts, err := redis.ParseURL(url)
	if err != nil {
		return nil, fmt.Errorf("failed to parse Redis URL::: %w", err)
	}

	opts.DB = db

	client := redis.NewClient(opts)


	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	log.Println("✓ Redis client connected successfully")
	return &RedisClient{client: client}, nil
}


func (r *RedisClient) SetIdempotencyKey(ctx context.Context, key string, value interface{}, expiration time.Duration) error {
	return r.client.Set(ctx, fmt.Sprintf("idempotency:%s", key), value, expiration).Err()
}


func (r *RedisClient) GetIdempotencyKey(ctx context.Context, key string) (string, error) {
	val, err := r.client.Get(ctx, fmt.Sprintf("idempotency:%s", key)).Result()
	if err == redis.Nil {
		return "", nil
	}
	return val, err
}


func (r *RedisClient) SetNotificationStatus(ctx context.Context, notificationID string, status interface{}, expiration time.Duration) error {
	return  r.client.Set(ctx, fmt.Sprintf("notification:%s", notificationID), status, expiration).Err()
}


func (r *RedisClient) GetNotificationStatus(ctx context.Context, notificationID string) (string, error) {
	val, err := r.client.Get(ctx, fmt.Sprintf("notification:%s", notificationID)).Result()
	if err == redis.Nil {
		return "", fmt.Errorf("notification not found")
	}
	return val, err
}


func (r *RedisClient) IncrementRateLimit(ctx context.Context, userID string, window time.Duration) (int64, error) {
	key := fmt.Sprintf("ratelimt:%s", userID)
	pipe := r.client.Pipeline()

	incr := pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, window)


	_, err := pipe.Exec(ctx)
	if err != nil {
		return 0, err
	}

	return incr.Val(), nil
}


func (r *RedisClient) HealthCheck(ctx context.Context) error {
	return r.client.Ping(ctx).Err()
}


func (r *RedisClient) Close() error {
	if r.client != nil {
		if err := r.client.Close(); err != nil {
			log.Printf("Error closing Redis client: %v", err)
			return err
		}
	}
	log.Println("✓ Redis client closed")
	return nil
}