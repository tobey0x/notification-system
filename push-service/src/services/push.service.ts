import { getMessaging, Messaging } from 'firebase-admin/messaging';
import { logger } from '../utils/logger';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { NotificationQueueMessage } from '../types/push.types';

// Types based on the system requirements
interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  clickAction?: string;
  priority?: 'normal' | 'high';
}

interface UserData {
  user_id: string;
  push_token?: string;
  preferences: {
    push: boolean;
  };
}

interface NotificationStatusUpdate {
  notification_id: string;
  status: 'delivered' | 'pending' | 'failed';
  timestamp?: string;
  error?: string;
}

// Configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000; // 1 second initial delay
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://user-service:3000';
const TEMPLATE_SERVICE_URL = process.env.TEMPLATE_SERVICE_URL || 'http://template-service:3000';
const API_GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://api-gateway:3000';

interface Template {
  template_code: string;
  title: string;
  body: string;
  image_url?: string;
  click_action?: string;
  variables: string[]; // List of required variables
}

export class PushService {
  private static instance: PushService;
  private messaging: Messaging;
  private isCircuitOpen = false;
  private failureCount = 0;
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly CIRCUIT_RESET_TIMEOUT = 60000; // 1 minute

  private constructor() {
    this.messaging = getMessaging();
  }

  public static getInstance(): PushService {
    if (!PushService.instance) {
      PushService.instance = new PushService();
    }
    return PushService.instance;
  }

  /**
   * Main method to send push notification to a user
   */
  public async sendToUser(
    userId: string,
    notification: PushNotificationPayload,
    notificationId: string = uuidv4(),
    retryCount: number = 0
  ): Promise<boolean> {
    // Check circuit breaker
    if (this.isCircuitOpen) {
      logger.warn('Circuit breaker is open, notification queued for retry later');
      await this.updateNotificationStatus(notificationId, 'pending');
      return false;
    }

    try {
      // 1. Get user data from User Service
      const user = await this.getUserData(userId);
      
      // Check if user has push enabled and has a token
      if (!user?.preferences?.push || !user.push_token) {
        logger.warn(`User ${userId} has push notifications disabled or no token`);
        await this.updateNotificationStatus(notificationId, 'failed', 'User has push disabled or no token');
        return false;
      }

      // 2. Send the push notification
      const success = await this.sendToDevice(user.push_token, notification, notificationId);
      
      if (success) {
        await this.updateNotificationStatus(notificationId, 'delivered');
        this.resetCircuitBreaker();
        return true;
      }
      
      return false;
    } catch (error) {
      this.handleError(error, notificationId, userId, notification, retryCount);
      return false;
    }
  }

  /**
   * Low-level method to send to a specific device token
   */
  public async sendToDevice(
    token: string,
    notification: PushNotificationPayload,
    notificationId: string = uuidv4()
  ): Promise<boolean> {
    try {
      // Build Firebase Cloud Messaging message
      // Format according to Firebase Admin SDK documentation
      const fcmMessage: any = {
        token,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: {
          ...notification.data,
          notificationId,
          ...(notification.clickAction && { click_action: notification.clickAction }),
        },
        android: {
          priority: (notification.priority === 'high' ? 'high' : 'normal') as 'normal' | 'high',
          notification: {
            ...(notification.imageUrl && { imageUrl: notification.imageUrl }),
          },
        },
        apns: {
          headers: {
            'apns-priority': notification.priority === 'high' ? '10' : '5',
          },
          payload: {
            aps: {
              alert: {
                title: notification.title,
                body: notification.body,
              },
              ...(notification.imageUrl && { 'mutable-content': 1 }),
            },
            ...(notification.imageUrl && {
              fcm_options: {
                image: notification.imageUrl,
              },
            }),
          },
        },
        webpush: {
          headers: {
            Urgency: notification.priority === 'high' ? 'high' : 'normal',
          },
          notification: {
            title: notification.title,
            body: notification.body,
            ...(notification.imageUrl && { icon: notification.imageUrl }),
            ...(notification.clickAction && { requireInteraction: true }),
          },
          ...(notification.clickAction && {
            fcm_options: {
              link: notification.clickAction,
            },
          }),
        },
      };

      await this.messaging.send(fcmMessage);
      logger.info(`Push notification sent successfully`, { notificationId, token: this.maskToken(token) });
      return true;
    } catch (error: any) {
      logger.error('Error sending push notification', {
        error: error.message,
        notificationId,
        token: this.maskToken(token),
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Get user data from User Service
   */
  private async getUserData(userId: string): Promise<UserData> {
    try {
      const response = await axios.get<UserData>(`${USER_SERVICE_URL}/api/v1/users/${userId}`, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000, // 5 seconds timeout
      });
      return response.data;
    } catch (error: any) {
      logger.error('Error fetching user data', {
        userId,
        error: error.message,
        status: error.response?.status,
      });
      throw new Error(`Failed to fetch user data: ${error.message}`);
    }
  }

  /**
   * Get template from Template Service
   */
  private async getTemplate(templateCode: string): Promise<Template> {
    try {
      const response = await axios.get<Template>(`${TEMPLATE_SERVICE_URL}/api/v1/templates/${templateCode}`, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000, // 5 seconds timeout
      });
      return response.data;
    } catch (error: any) {
      logger.error('Error fetching template', {
        templateCode,
        error: error.message,
        status: error.response?.status,
      });
      throw new Error(`Failed to fetch template: ${error.message}`);
    }
  }

  /**
   * Replace variables in template
   */
  private replaceVariables(template: string, variables: Record<string, any>): string {
    let result = template;
    // Replace {{variable}} patterns
    result = result.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] !== undefined ? String(variables[key]) : match;
    });
    return result;
  }

  /**
   * Process notification from queue message (API Gateway format)
   */
  public async processNotificationFromQueue(
    message: NotificationQueueMessage
  ): Promise<boolean> {
    const { user_id, template_code, variables, request_id, priority } = message;
    
    try {
      // Validate required fields
      if (!user_id || !template_code || !request_id) {
        throw new Error('Missing required fields: user_id, template_code, or request_id');
      }

      if (!variables || !variables.name) {
        throw new Error('Missing required variable: name');
      }

      // 1. Fetch template from Template Service
      const template = await this.getTemplate(template_code);
      
      // 2. Flatten variables for substitution (handle nested structure)
      // Variables can be: { name: string, link?: string, meta?: Record<string, any> }
      // We need to flatten for template substitution: { name, link, ...meta }
      const flattenedVariables: Record<string, any> = {
        name: variables.name,
        ...(variables.link && { link: variables.link }),
        ...(variables.meta && variables.meta),
      };
      
      // 3. Replace variables in template
      const title = this.replaceVariables(template.title, flattenedVariables);
      const body = this.replaceVariables(template.body, flattenedVariables);
      const imageUrl = template.image_url ? this.replaceVariables(template.image_url, flattenedVariables) : undefined;
      const clickAction = template.click_action ? this.replaceVariables(template.click_action, flattenedVariables) : undefined;
      
      // 4. Build notification payload
      // Use meta for data payload, or create empty object
      const notificationData: Record<string, string> = {};
      if (variables.meta) {
        // Convert meta values to strings for FCM data
        Object.entries(variables.meta).forEach(([key, value]) => {
          notificationData[key] = String(value);
        });
      }
      
      const notification: Omit<PushNotificationPayload, 'priority'> = {
        title,
        body,
        data: notificationData,
        imageUrl,
        clickAction,
      };
      
      // 5. Send to user (this will fetch push_token from User Service)
      const notificationPriority: 'normal' | 'high' = priority && priority > 5 ? 'high' : 'normal';
      const success = await this.sendToUser(user_id, {
        ...notification,
        priority: notificationPriority,
      }, request_id);
      
      return success;
    } catch (error: any) {
      logger.error('Error processing notification from queue', {
        user_id,
        template_code,
        request_id,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Update notification status in the API Gateway
   */
  private async updateNotificationStatus(
    notificationId: string,
    status: 'delivered' | 'pending' | 'failed',
    error?: string
  ): Promise<void> {
    try {
      const update: NotificationStatusUpdate = {
        notification_id: notificationId,
        status,
        timestamp: new Date().toISOString(),
      };

      if (error) {
        update.error = error;
      }

      await axios.post(
        `${API_GATEWAY_URL}/api/v1/notification/status`,
        update,
        { timeout: 3000 }
      );
    } catch (error: any) {
      logger.error('Error updating notification status', {
        notificationId,
        status,
        error: error.message,
      });
      // Don't throw, as this shouldn't fail the main operation
    }
  }

  /**
   * Handle errors and implement retry logic
   */
  private async handleError(
    error: any,
    notificationId: string,
    userId: string,
    notification: PushNotificationPayload,
    retryCount: number
  ): Promise<void> {
    const errorMessage = error.message || 'Unknown error';
    
    // Log the error
    logger.error('Push notification error', {
      notificationId,
      userId,
      error: errorMessage,
      retryCount,
      stack: error.stack,
    });

    // Update status to failed if max retries reached
    if (retryCount >= MAX_RETRIES) {
      await this.updateNotificationStatus(
        notificationId,
        'failed',
        `Max retries reached: ${errorMessage}`
      );
      return;
    }

    // Implement circuit breaker pattern
    this.failureCount++;
    if (this.failureCount >= this.CIRCUIT_BREAKER_THRESHOLD) {
      this.tripCircuitBreaker();
    }

    // Schedule retry with exponential backoff
    const delay = RETRY_DELAY_MS * Math.pow(2, retryCount);
    logger.info(`Scheduling retry ${retryCount + 1} in ${delay}ms`, { notificationId });
    
    setTimeout(async () => {
      await this.sendToUser(userId, notification, notificationId, retryCount + 1);
    }, delay);
  }

  /**
   * Circuit breaker pattern implementation
   */
  private tripCircuitBreaker(): void {
    this.isCircuitOpen = true;
    logger.error('Circuit breaker tripped - push notifications paused');
    
    // Schedule circuit reset
    setTimeout(() => {
      this.resetCircuitBreaker();
    }, this.CIRCUIT_RESET_TIMEOUT);
  }

  private resetCircuitBreaker(): void {
    this.isCircuitOpen = false;
    this.failureCount = 0;
    logger.info('Circuit breaker reset - push notifications resumed');
  }

  /**
   * Utility to mask tokens in logs for security
   */
  private maskToken(token: string): string {
    if (!token || token.length < 8) return '***';
    return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
  }

  public async sendToTopic(
    topic: string,
    notification: PushNotificationPayload
  ): Promise<boolean> {
    try {
      const message: any = {
        topic,
        notification: {
          title: notification.title,
          body: notification.body,
          ...(notification.imageUrl && { image: notification.imageUrl }),
        },
        data: notification.data || {},
        android: {
          priority: (notification.priority === 'high' ? 'high' : 'normal') as 'normal' | 'high',
        },
        apns: {
          headers: {
            'apns-priority': notification.priority === 'high' ? '10' : '5',
          },
        },
        webpush: {
          headers: {
            Urgency: notification.priority === 'high' ? 'high' : 'normal',
          },
        },
      };

      await this.messaging.send(message);
      logger.info(`Successfully sent message to topic ${topic}`);
      return true;
    } catch (error: any) {
      logger.error(`Error sending push notification to topic ${topic}:`, {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  public async subscribeToTopic(tokens: string | string[], topic: string): Promise<void> {
    try {
      await this.messaging.subscribeToTopic(tokens, topic);
      logger.info(`Successfully subscribed to topic: ${topic}`);
    } catch (error) {
      logger.error(`Error subscribing to topic ${topic}:`, error);
      throw error;
    }
  }

  public async unsubscribeFromTopic(tokens: string | string[], topic: string): Promise<void> {
    try {
      await this.messaging.unsubscribeFromTopic(tokens, topic);
      logger.info(`Successfully unsubscribed from topic: ${topic}`);
    } catch (error) {
      logger.error(`Error unsubscribing from topic ${topic}:`, error);
      throw error;
    }
  }
}
