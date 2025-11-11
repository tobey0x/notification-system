package models


import "time"


type NotificationType string


const (
	NotificationTypeEmail NotificationType = "email"
	NotificationTypePush  NotificationType = "push"
)


type Priority string


const (
	PriorityHigh	Priority = "high"
	PriorityNormal	Priority = "normal"
	PriorityLow		Priority = "low"
)


type NotificationRequest struct {
	Type       NotificationType       `json:"type" binding:"required,oneof=email push"`
	UserID     string                 `json:"user_id" binding:"required"`
	Priority   Priority               `json:"priority" binding:"required,oneof=high normal low"`
	TemplateID string                 `json:"template_id" binding:"required"`
	Variables  map[string]interface{} `json:"variables"`
}


type NotificationMessage struct {
	NotificationID string                 `json:"notification_id"`
	Type           NotificationType       `json:"type"`
	UserID         string                 `json:"user_id"`
	Priority       Priority               `json:"priority"`
	TemplateID     string                 `json:"template_id"`
	Variables      map[string]interface{} `json:"variables"`
	Metadata       MessageMetadata        `json:"metadata"`
	RetryCount     int                    `json:"retry_count"`
	MaxRetries     int                    `json:"max_retries"`
}


type MessageMetadata struct {
	IPAddress string    `json:"ip_address"`
	UserAgent string    `json:"user_agent"`
	Timestamp time.Time `json:"timestamp"`
}


type NotificationStatus struct {
	NotificationID string           `json:"notification_id"`
	Type           NotificationType `json:"type"`
	UserID         string           `json:"user_id"`
	Status         string           `json:"status"` // pending, sent, failed, retry
	CreatedAt      time.Time        `json:"created_at"`
	UpdatedAt      time.Time        `json:"updated_at"`
	ErrorMessage   *string          `json:"error_message,omitempty"`
}


type NotificationResponse struct {
	NotificationID string           `json:"notification_id"`
	Type           NotificationType `json:"type"`
	Status         string           `json:"status"`
	Message        string           `json:"message"`
}


type HealthResponse struct {
	Status    string            `json:"status"`
	Timestamp time.Time         `json:"timestamp"`
	Services  map[string]string `json:"services"`
}