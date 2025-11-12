import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import * as pushController from '../controllers/push.controller';

export const pushRoutes = (
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions,
  done: () => void
) => {
  // Send push notification to a specific device
  fastify.post('/send', {
    schema: {
      body: {
        type: 'object',
        required: ['deviceToken', 'title', 'body'],
        properties: {
          deviceToken: { type: 'string' },
          title: { type: 'string' },
          body: { type: 'string' },
          data: { type: 'object' },
          imageUrl: { type: 'string' },
          clickAction: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object' },
          },
        },
      },
    },
    handler: pushController.sendPushNotification,
  });

  // Send push notification to a topic
  fastify.post('/topic/send', {
    schema: {
      body: {
        type: 'object',
        required: ['topic', 'title', 'body'],
        properties: {
          topic: { type: 'string' },
          title: { type: 'string' },
          body: { type: 'string' },
          data: { type: 'object' },
          imageUrl: { type: 'string' },
          clickAction: { type: 'string' },
        },
      },
    },
    handler: pushController.sendToTopic,
  });

  // Subscribe devices to a topic
  fastify.post('/topic/subscribe', {
    schema: {
      body: {
        type: 'object',
        required: ['tokens', 'topic'],
        properties: {
          tokens: {
            oneOf: [
              { type: 'string' },
              { type: 'array', items: { type: 'string' } },
            ],
          },
          topic: { type: 'string' },
        },
      },
    },
    handler: pushController.subscribeToTopic,
  });

  // Unsubscribe devices from a topic
  fastify.post('/topic/unsubscribe', {
    schema: {
      body: {
        type: 'object',
        required: ['tokens', 'topic'],
        properties: {
          tokens: {
            oneOf: [
              { type: 'string' },
              { type: 'array', items: { type: 'string' } },
            ],
          },
          topic: { type: 'string' },
        },
      },
    },
    handler: pushController.unsubscribeFromTopic,
  });

  done();
};
