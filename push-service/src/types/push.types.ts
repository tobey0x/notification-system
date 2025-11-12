// Message format from API Gateway (matches requirements)
export interface NotificationQueueMessage {
  notification_type: 'push';
  user_id: string; // UUID
  template_code: string; // Template identifier
  variables: {
    name: string;
    link?: string;
    meta?: Record<string, any>;
  };
  request_id: string;
  priority?: number;
  metadata?: Record<string, any>;
}

// Legacy type for direct device token messages (kept for backward compatibility)
export interface PushNotificationMessage {
  deviceToken: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  clickAction?: string;
}
