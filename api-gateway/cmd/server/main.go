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
	"github.com/tobey0x/api-gateway/internal/middleware"
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
	userHandler := handlers.NewUserHandler(cfg.UserService.URL)

	// Initialize middleware
	authMiddleware := middleware.NewAuthMiddleware(cfg.Auth.JWTSecret, cfg.Auth.AccessSecret, cfg.UserService.URL)
	rateLimiter := middleware.NewRateLimiter(redisClient, 100, time.Minute)

	log.Printf("✓ User Service integration configured at: %s", cfg.UserService.URL)

	router := gin.Default()

	// Global middleware
	router.Use(corsMiddleware())
	router.Use(logginMiddleware())

	// Public routes
	router.GET("/health", healthHandler.CheckHealth)

	// API v1 routes
	v1 := router.Group("/api/v1")
	{
		// Auth routes - proxied to User Service (User Service handles auth)
		auth := v1.Group("/auth")
		{
			auth.POST("/register", userHandler.ProxyToUserService)
			auth.POST("/login", userHandler.ProxyToUserService)
			auth.POST("/refresh", userHandler.ProxyToUserService)
			auth.POST("/logout", userHandler.ProxyToUserService)
		}

		// User routes - proxied to User Service (User Service handles auth via verifyToken middleware)
		// We apply rate limiting at gateway level but let User Service handle authentication
		users := v1.Group("/users")
		users.Use(rateLimiter.RateLimit())
		{
			users.GET("/profile", userHandler.ProxyToUserService)
			users.GET("/profile/:id", userHandler.ProxyToUserService)
			users.GET("/preference/:id", userHandler.ProxyToUserService)
			users.PATCH("/preference/:id", userHandler.ProxyToUserService)
			users.POST("/preference/:id", userHandler.ProxyToUserService)
			users.POST("/push-token", userHandler.ProxyToUserService)
			users.PATCH("/push-token/:id", userHandler.ProxyToUserService)
			users.DELETE("/push-token/:id", userHandler.ProxyToUserService)
		}

		// Notification routes - handled by API Gateway (requires authentication at gateway)
		notifications := v1.Group("/notifications")
		notifications.Use(authMiddleware.RequireAuth())
		notifications.Use(rateLimiter.RateLimit())
		{
			notifications.POST("", notificationHandler.CreateNotifiation)
			notifications.GET("/:id", notificationHandler.GetNotificationStatus)
			notifications.GET("", notificationHandler.ListNotifications)
		}
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