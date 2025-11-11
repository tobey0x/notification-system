package handlers


import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tobey0x/api-gateway/internal/cache"
	"github.com/tobey0x/api-gateway/internal/models"
	"github.com/tobey0x/api-gateway/internal/queue"
)


type HealthHandler struct {
	rabbitMQ *queue.RabbitMQClient
	redis    *cache.RedisClient
}


func NewHealthHandler(rabbitMQ *queue.RabbitMQClient, redis *cache.RedisClient) *HealthHandler {
	return &HealthHandler{
		rabbitMQ: rabbitMQ,
		redis:	  redis,
	}
}


func (h *HealthHandler) CheckHealth(c *gin.Context) {
	services := make(map[string]string)
	overallStatus := "healthy"


	if err := h.rabbitMQ.HealthCheck(); err != nil {
		services["rabbitmq"] = "unhealthy: " + err.Error()
		overallStatus = "degraded"
	} else {
		services["rabbitmq"] = "healthy"
	}


	if err := h.redis.HealthCheck(c.Request.Context()); err != nil {
		services["redis"] = "unhealthy: " + err.Error()
		overallStatus = "degraded"
	} else {
		services["redis"] = "healthy"
	}


	healthResponse := models.HealthResponse{
		Status: overallStatus,
		Timestamp: time.Now(),
		Services: services,
	}

	statusCode := http.StatusOK
	if overallStatus == "degraded" {
		statusCode = http.StatusServiceUnavailable
	}

	c.JSON(statusCode, models.SuccessResponse("Health check completed", healthResponse))
}