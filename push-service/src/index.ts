import 'dotenv/config';
import { createServer } from './config/server';
import { logger } from './utils/logger';
import { connectToRabbitMQ } from './config/rabbitmq';
import { initializeFirebase } from './config/firebase';

const start = async () => {
  try {
    // Initialize Firebase
    initializeFirebase();
    
    // Initialize RabbitMQ connection
    await connectToRabbitMQ();
    
    // Create and start Fastify server
    const server = await createServer();
    const port = Number(process.env.PORT) || 3001;
    
    await server.listen({ port, host: '0.0.0.0' });
    logger.info(`Server is running on http://localhost:${port}`);
  } catch (err) {
    logger.error('Error starting server:', err);
    process.exit(1);
  }
};

start();
