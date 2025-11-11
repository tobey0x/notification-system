package handlers


import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/tobey0x/api-gateway/internal/cache"
	"github.com/tobey0x/api-gateway/internal/models"
	"github.com/tobey0x/api-gateway/internal/queue"
)


type NotificationHndler struct {
	rabbitMQ	*queue.RabbitMQClient
	redis		*cache.RedisClient
}


func NewNotificationHandler(rabbitMQ *queue.RabbitMQClient, redis *cache.RedisClient) *NotificationHndler {
	return &NotificationHndler{
		rabbitMQ: rabbitMQ,
		redis: redis,
	}
}


// CreateNotification handles POST /api/v1/notifications
func (h *NotificationHndler) CreateNotifiation(c *gin.Context) {
	var req models.NotificationRequest


	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse("Invalid request body", err))
		return
	}


	notificationID := uuid.New().String()


	idempotentKey := c.GetHeader("X-Idempotency-Key")
	if idempotentKey != "" {
		
		existingID, err := h.redis.GetIdempotencyKey(c.Request.Context(), idempotentKey)

		if err == nil && existingID != "" {
			c.JSON(http.StatusOK, models.SuccessResponse(
				"Notification already processed (idempotent)",
				models.NotificationResponse{
					NotificationID: existingID,
					Type: req.Type,
					Status: "pending",
					Message: "Notification request accepted (duplicate request)",
				},
			))
			return
		}

		_ = h.redis.SetIdempotencyKey(c.Request.Context(), idempotentKey, notificationID, 24*time.Hour)
	}


	message := models.NotificationMessage{
		NotificationID: notificationID,
		Type: req.Type,
		UserID: req.UserID,
		Priority: req.Priority,
		TemplateID: req.TemplateID,
		Variables: req.Variables,
		Metadata: models.MessageMetadata{
			IPAddress: c.ClientIP(),
			UserAgent: c.Request.UserAgent(),
			Timestamp: time.Now(),
		},
		RetryCount: 0,
		MaxRetries: 3,
	}


	routingKey := string(req.Type)


	if err := h.rabbitMQ.Publish(c.Request.Context(), routingKey, message); err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse("Failed to queue notification", err))
		return
	}


	status := models.NotificationStatus{
		NotificationID: notificationID,
		Type:           req.Type,
		UserID:         req.UserID,
		Status:         "pending",
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}
	_ = h.redis.SetNotificationStatus(c.Request.Context(), notificationID, status, 7*24*time.Hour)

	c.JSON(http.StatusAccepted, models.SuccessResponse(
		"Notification request accepted",
		models.NotificationResponse{
			NotificationID: notificationID,
			Type:           req.Type,
			Status:         "pending",
			Message:        "Notification queued for processing",
		},
	))
}


// GetNotificationStatus handles GET /api/v1/notifications/:id
func (h *NotificationHndler) GetNotificationStatus(c *gin.Context) {
	notificationID := c.Param("id")

	status, err := h.redis.GetNotificationStatus(c.Request.Context(), notificationID)
	if err != nil {
		c.JSON(http.StatusNotFound, models.ErrorResponse("Notification not found", err))
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse("Notification status retrieved", status))
}


// ListNotifications handles GET /api/v1/notifications (placeholder)
func (h *NotificationHndler) ListNotifications(c *gin.Context) {
	// This would typically query a database
	// For now, return a placeholder response
	c.JSON(http.StatusOK, models.SuccessResponseWithMeta(
		"Notification retrieved",
		[]interface{}{},
		models.CalculatePagination(0, 1, 20),
	))
}