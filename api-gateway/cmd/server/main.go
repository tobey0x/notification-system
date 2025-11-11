package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tobey0x/api-gateway/internal/cache"
	"github.com/tobey0x/api-gateway/internal/config"
	"github.com/tobey0x/api-gateway/internal/handlers"
	"github.com/tobey0x/api-gateway/internal/queue"
)


func main() {
	cfg := config.Load()


	if cfg.Server.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}


	rabbitMQ, err := queue.NewRabbitMQClient(
		cfg.RabbitMQ.URL,
		cfg.RabbitMQ.Exchange,
		cfg.RabbitMQ.EmailQueue,
		cfg.RabbitMQ.PushQueue,
		cfg.RabbitMQ.FailedQueue,
	)
	if err != nil {
		log.Fatalf("Failed to initialize RabbitMQ: %v", err)
	}
	defer rabbitMQ.Close()

	redisClient, err := cache.NewRedisClient(cfg.Redis.URL, cfg.Redis.DB)
	if err != nil {
		log.Fatalf("Failed to initialize Redis: %v", err)
	}
	defer redisClient.Close()


	healthHandler := handlers.NewHealthHandler(rabbitMQ, redisClient)
	notificationHandler := handlers.NewNotificationHandler(rabbitMQ, redisClient)


	router := gin.Default()


	router.Use(corsMiddleware())
	router.Use(logginMiddleware())


	router.GET("/health", healthHandler.CheckHealth)


	v1 := router.Group("/api/v1")
	{
		v1.POST("/notifications", notificationHandler.CreateNotifiation)
		v1.GET("/notifications/:id", notificationHandler.GetNotificationStatus)
		v1.GET("/notifications", notificationHandler.ListNotifications)
	}


	srv := &http.Server{
		Addr: fmt.Sprintf(":%s", cfg.Server.Port),
		Handler: router,
		ReadTimeout: 10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout: 0 * time.Second,
	}


	go func() {
		log.Printf("🚀 API Gateway starting on port %s (env: %s)", cfg.Server.Port, cfg.Server.Environment)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()


	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")


	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("Server forced to shutdown:", err)
	}

	log.Println("✓ Server exited gracefully")
}


func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With, X-Idempotency-Key")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}


		c.Next()
	}
}


func logginMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		raw := c.Request.URL.RawQuery


		c.Next()


		latency := time.Since(start)
		statusCode := c.Writer.Status()
		clientIP := c.ClientIP()
		method := c.Request.Method


		if raw != "" {
			path = path + "?" + raw
		}

		log.Printf("[%s] %s %s | %d | %v | %s",
			method,
			path,
			clientIP,
			statusCode,
			latency,
			c.Errors.String(),
		)
	}
}