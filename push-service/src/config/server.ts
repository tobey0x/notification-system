import fastify from 'fastify';
import fastifyHelmet from '@fastify/helmet';
import fastifyCors from '@fastify/cors';
import { logger } from '../utils/logger';
import { pushRoutes } from '../routes/push.routes';

export const createServer = async () => {
  const app = fastify({
    logger: false, // We're using our custom logger
    disableRequestLogging: process.env.NODE_ENV === 'production',
  });

  // Register plugins
  await app.register(fastifyCors, {
    origin: process.env.NODE_ENV === 'production' 
      ? [/yourdomain\.com$/] 
      : '*',
  });
  
  await app.register(fastifyHelmet);

  // Health check endpoint
  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));

  // Register routes
  await app.register(pushRoutes, { prefix: '/api/v1/push' });

  // Error handler
  app.setErrorHandler((error, request, reply) => {
    logger.error(`Request ${request.id} failed: ${error.message}`);
    
    // Handle validation errors
    if (error.validation) {
      return reply.status(400).send({
        success: false,
        message: 'Validation error',
        error: error.message,
        validation: error.validation,
      });
    }

    // Handle other errors
    reply.status(500).send({
      success: false,
      message: 'Internal server error',
    });
  });

  return app;
};
