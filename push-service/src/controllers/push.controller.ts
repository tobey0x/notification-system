import { FastifyRequest, FastifyReply } from 'fastify';
import { PushService } from '../services/push.service';
import { logger } from '../utils/logger';

type SendPushRequest = {
  deviceToken: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  clickAction?: string;
};

type SubscribeRequest = {
  tokens: string | string[];
  topic: string;
};

const pushService = PushService.getInstance();

export const sendPushNotification = async (
  request: FastifyRequest<{ Body: SendPushRequest }>,
  reply: FastifyReply
) => {
  try {
    const { deviceToken, ...notification } = request.body;
    
    await pushService.sendToDevice(deviceToken, {
      title: notification.title,
      body: notification.body,
      data: notification.data,
      imageUrl: notification.imageUrl,
      clickAction: notification.clickAction,
    });

    return {
      success: true,
      message: 'Push notification sent successfully',
      data: { deviceToken },
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error sending push notification:', error);
    return reply.status(500).send({
      success: false,
      message: 'Failed to send push notification',
      error: errorMessage,
    });
  }
};

export const sendToTopic = async (
  request: FastifyRequest<{ Body: Omit<SendPushRequest, 'deviceToken'> & { topic: string } }>,
  reply: FastifyReply
) => {
  try {
    const { topic, ...notification } = request.body;
    
    await pushService.sendToTopic(topic, {
      title: notification.title,
      body: notification.body,
      data: notification.data,
      imageUrl: notification.imageUrl,
      clickAction: notification.clickAction,
    });

    return {
      success: true,
      message: `Push notification sent to topic: ${topic}`,
      data: { topic },
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error sending push notification to topic:', error);
    return reply.status(500).send({
      success: false,
      message: 'Failed to send push notification to topic',
      error: errorMessage,
    });
  }
};

export const subscribeToTopic = async (
  request: FastifyRequest<{ Body: SubscribeRequest }>,
  reply: FastifyReply
) => {
  try {
    const { tokens, topic } = request.body;
    
    await pushService.subscribeToTopic(tokens, topic);

    return {
      success: true,
      message: `Successfully subscribed to topic: ${topic}`,
      data: { topic },
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error subscribing to topic:', error);
    return reply.status(500).send({
      success: false,
      message: 'Failed to subscribe to topic',
      error: errorMessage,
    });
  }
};

export const unsubscribeFromTopic = async (
  request: FastifyRequest<{ Body: SubscribeRequest }>,
  reply: FastifyReply
) => {
  try {
    const { tokens, topic } = request.body;
    
    await pushService.unsubscribeFromTopic(tokens, topic);

    return {
      success: true,
      message: `Successfully unsubscribed from topic: ${topic}`,
      data: { topic },
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error unsubscribing from topic:', error);
    return reply.status(500).send({
      success: false,
      message: 'Failed to unsubscribe from topic',
      error: errorMessage,
    });
  }
};
