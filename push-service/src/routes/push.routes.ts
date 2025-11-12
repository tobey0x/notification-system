import { FastifyInstance } from 'fastify';
import { 
  sendPushNotification,
  sendToTopic,
  subscribeToTopic,
  unsubscribeFromTopic
} from '../controllers/push.controller';

export function pushRoutes(fastify: FastifyInstance, _: any, done: Function) {
  // Send push notification to a specific device
  fastify.post('/push/device', sendPushNotification);
  
  // Send push notification to a topic
  fastify.post('/push/topic', sendToTopic);
  
  // Subscribe devices to a topic
  fastify.post('/push/subscribe', subscribeToTopic);
  
  // Unsubscribe devices from a topic
  fastify.post('/push/unsubscribe', unsubscribeFromTopic);
  done();
}
