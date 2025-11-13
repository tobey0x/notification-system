import { Channel, connect, ConsumeMessage, Connection as AmqpConnection, Options } from 'amqplib';

// Use the base AmqpConnection type but add the close method
type Connection = AmqpConnection & {
  close(): Promise<void>;
  createChannel(): Promise<Channel>;
};

import { logger } from '../utils/logger';
import { processPushNotification, setChannelGetter } from '../services/queue.service';

let channel: Channel | null = null;
let connection: Connection | null = null;
let isConnecting = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 5000; // 5 seconds

// Function to get the current channel
const getChannelInternal = (): Channel | null => {
  return channel;
};

// Set up the channel getter in queue.service
setChannelGetter(getChannelInternal);

/**
 * Establishes a connection to RabbitMQ with retry logic
 */
export const connectToRabbitMQ = async (maxRetries = 5, retryDelay = 5000): Promise<void> => {
  if (isConnecting) {
    logger.info('Connection attempt already in progress');
    return;
  }

  isConnecting = true;
  
  try {
    const url = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
    logger.info(`Connecting to RabbitMQ at ${url.replace(/:([^:]+)@/, ':***@')}`);
    
    const newConnection = (await connect(url, {
      timeout: 10000, // 10 seconds connection timeout
      heartbeat: 30, // 30 seconds heartbeat
    } as Options.Connect)) as unknown as Connection;
    
    const newChannel = await newConnection.createChannel();
    
    // Configure channel
    await newChannel.prefetch(10); // Process 10 messages at a time
    
    // Store the new connection and channel
    connection = newConnection;
    channel = newChannel;
    reconnectAttempts = 0; // Reset reconnect attempts on successful connection
    
    // Set up connection event handlers
    setupConnectionHandlers(newConnection, newChannel);
    
    // Set up queues and consumer
    await setupQueues(newChannel);
    await setupConsumer(newChannel);
    
    logger.info('Successfully connected to RabbitMQ and set up queues');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Failed to connect to RabbitMQ: ${errorMessage}`);
    
    if (reconnectAttempts < maxRetries) {
      reconnectAttempts++;
      logger.info(`Retrying connection (attempt ${reconnectAttempts}/${maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return connectToRabbitMQ(maxRetries, retryDelay);
    }
    
    throw new Error(`Max retries (${maxRetries}) reached. Could not connect to RabbitMQ: ${errorMessage}`);
  } finally {
    isConnecting = false;
  }
};

/**
 * Sets up event handlers for the RabbitMQ connection
 */
const setupConnectionHandlers = (conn: Connection, ch: Channel): void => {
  conn.on('close', async () => {
    logger.warn('RabbitMQ connection closed');
    channel = null;
    connection = null;
    
    // Attempt to reconnect
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      logger.info('Attempting to reconnect to RabbitMQ...');
      setTimeout(() => connectToRabbitMQ(), RECONNECT_DELAY);
    }
  });
  
  conn.on('error', (err) => {
    logger.error('RabbitMQ connection error:', { error: err.message });
  });
  
  ch.on('error', (err) => {
    logger.error('RabbitMQ channel error:', { error: err.message });
  });
};

/**
 * Sets up the required queues
 */
const setupQueues = async (ch: Channel): Promise<void> => {
  try {
    // assertQueue is idempotent - it creates the queue if it doesn't exist,
    // or returns the existing queue if it does
    await ch.assertQueue(process.env.PUSH_QUEUE || 'push.queue', { 
      durable: true,
      arguments: {
        'x-message-ttl': 86400000, // 24 hours
        'x-dead-letter-exchange': '', // Use default exchange
        'x-dead-letter-routing-key': process.env.FAILED_QUEUE || 'failed.queue'
      }
    });

    // Always assert the failed queue
    await ch.assertQueue(process.env.FAILED_QUEUE || 'failed.queue', { 
      durable: true 
    });
    
    logger.info(`Queues set up successfully: ${process.env.PUSH_QUEUE || 'push.queue'}, ${process.env.FAILED_QUEUE || 'failed.queue'}`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to set up queues';
    logger.error(`Error setting up queues: ${errorMessage}`);
    throw error;
  }
};

/**
 * Sets up the message consumer
 */
const setupConsumer = async (ch: Channel): Promise<void> => {
  try {
    await ch.consume(
      process.env.PUSH_QUEUE || 'push.queue',
      async (msg: ConsumeMessage | null) => {
        if (!msg || !channel) {
          logger.error('Message or channel is null');
          return;
        }
        
        const messageId = msg.properties.messageId || 'unknown';
        const startTime = Date.now();
        
        try {
          const message = JSON.parse(msg.content.toString());
          logger.info(`Processing message ${messageId}`, { messageId });
          
          await processPushNotification(message);
          
          channel.ack(msg);
          const duration = Date.now() - startTime;
          logger.info(`Successfully processed message ${messageId}`, { messageId, duration });
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logger.error(`Error processing message ${messageId}: ${errorMessage}`, {
            messageId,
            error: error instanceof Error ? error.stack : error,
            messageContent: msg.content.toString()
          });
          
          try {
            // Negative acknowledgment - don't requeue, let it go to DLQ
            channel.nack(msg, false, false);
          } catch (nackError) {
            logger.error(`Failed to NACK message ${messageId}:`, nackError);
          }
        }
      },
      { noAck: false }
    );
    
    logger.info('Consumer started successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to set up consumer';
    logger.error(`Error setting up consumer: ${errorMessage}`);
    throw error;
  }
};

/**
 * Gets the current channel
 * @throws {Error} If the channel is not initialized
 */
export const getChannel = (): Channel => {
  if (!channel) {
    throw new Error('RabbitMQ channel not initialized. Call connectToRabbitMQ() first.');
  }
  return channel;
};

export const closeConnection = async (): Promise<void> => {
  try {
    if (channel) {
      await channel.close();
      channel = null;
    }
    
    if (connection) {
      await (connection as Connection).close();
      connection = null;
    }
  } catch (error) {
    logger.error('Error closing RabbitMQ connection:', error);
    throw error;
  }
};
