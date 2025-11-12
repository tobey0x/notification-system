"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeConnection = exports.getChannel = exports.connectToRabbitMQ = void 0;
const amqplib_1 = require("amqplib");
const logger_1 = require("../utils/logger");
const queue_service_1 = require("../services/queue.service");
let channel = null;
let connection = null;
let isConnecting = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 5000; // 5 seconds
// Function to get the current channel
const getChannelInternal = () => {
    return channel;
};
// Set up the channel getter in queue.service
(0, queue_service_1.setChannelGetter)(getChannelInternal);
/**
 * Establishes a connection to RabbitMQ with retry logic
 */
const connectToRabbitMQ = async (maxRetries = 5, retryDelay = 5000) => {
    if (isConnecting) {
        logger_1.logger.info('Connection attempt already in progress');
        return;
    }
    isConnecting = true;
    try {
        const url = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
        logger_1.logger.info(`Connecting to RabbitMQ at ${url.replace(/:([^:]+)@/, ':***@')}`);
        const newConnection = (await (0, amqplib_1.connect)(url, {
            timeout: 10000, // 10 seconds connection timeout
            heartbeat: 30, // 30 seconds heartbeat
        }));
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
        logger_1.logger.info('Successfully connected to RabbitMQ and set up queues');
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger_1.logger.error(`Failed to connect to RabbitMQ: ${errorMessage}`);
        if (reconnectAttempts < maxRetries) {
            reconnectAttempts++;
            logger_1.logger.info(`Retrying connection (attempt ${reconnectAttempts}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            return (0, exports.connectToRabbitMQ)(maxRetries, retryDelay);
        }
        throw new Error(`Max retries (${maxRetries}) reached. Could not connect to RabbitMQ: ${errorMessage}`);
    }
    finally {
        isConnecting = false;
    }
};
exports.connectToRabbitMQ = connectToRabbitMQ;
/**
 * Sets up event handlers for the RabbitMQ connection
 */
const setupConnectionHandlers = (conn, ch) => {
    conn.on('close', async () => {
        logger_1.logger.warn('RabbitMQ connection closed');
        channel = null;
        connection = null;
        // Attempt to reconnect
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            logger_1.logger.info('Attempting to reconnect to RabbitMQ...');
            setTimeout(() => (0, exports.connectToRabbitMQ)(), RECONNECT_DELAY);
        }
    });
    conn.on('error', (err) => {
        logger_1.logger.error('RabbitMQ connection error:', { error: err.message });
    });
    ch.on('error', (err) => {
        logger_1.logger.error('RabbitMQ channel error:', { error: err.message });
    });
};
/**
 * Sets up the required queues
 */
const setupQueues = async (ch) => {
    try {
        // First, check if the queue exists and get its properties
        try {
            await ch.checkQueue(process.env.PUSH_QUEUE || 'push.queue');
            logger_1.logger.info(`Queue ${process.env.PUSH_QUEUE || 'push.queue'} already exists, using existing configuration`);
        }
        catch (error) {
            // Queue doesn't exist, create it with our configuration
            await ch.assertQueue(process.env.PUSH_QUEUE || 'push.queue', {
                durable: true,
                arguments: {
                    'x-message-ttl': 86400000, // 24 hours
                    'x-dead-letter-exchange': '', // Use default exchange
                    'x-dead-letter-routing-key': process.env.FAILED_QUEUE || 'failed.queue'
                }
            });
        }
        // Always assert the failed queue
        await ch.assertQueue(process.env.FAILED_QUEUE || 'failed.queue', {
            durable: true
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to set up queues';
        logger_1.logger.error(`Error setting up queues: ${errorMessage}`);
        throw error;
    }
};
/**
 * Sets up the message consumer
 */
const setupConsumer = async (ch) => {
    try {
        await ch.consume(process.env.PUSH_QUEUE || 'push.queue', async (msg) => {
            if (!msg || !channel) {
                logger_1.logger.error('Message or channel is null');
                return;
            }
            const messageId = msg.properties.messageId || 'unknown';
            const startTime = Date.now();
            try {
                const message = JSON.parse(msg.content.toString());
                logger_1.logger.info(`Processing message ${messageId}`, { messageId });
                await (0, queue_service_1.processPushNotification)(message);
                channel.ack(msg);
                const duration = Date.now() - startTime;
                logger_1.logger.info(`Successfully processed message ${messageId}`, { messageId, duration });
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                logger_1.logger.error(`Error processing message ${messageId}: ${errorMessage}`, {
                    messageId,
                    error: error instanceof Error ? error.stack : error,
                    messageContent: msg.content.toString()
                });
                try {
                    // Negative acknowledgment - don't requeue, let it go to DLQ
                    channel.nack(msg, false, false);
                }
                catch (nackError) {
                    logger_1.logger.error(`Failed to NACK message ${messageId}:`, nackError);
                }
            }
        }, { noAck: false });
        logger_1.logger.info('Consumer started successfully');
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to set up consumer';
        logger_1.logger.error(`Error setting up consumer: ${errorMessage}`);
        throw error;
    }
};
/**
 * Gets the current channel
 * @throws {Error} If the channel is not initialized
 */
const getChannel = () => {
    if (!channel) {
        throw new Error('RabbitMQ channel not initialized. Call connectToRabbitMQ() first.');
    }
    return channel;
};
exports.getChannel = getChannel;
const closeConnection = async () => {
    try {
        if (channel) {
            await channel.close();
            channel = null;
        }
        if (connection) {
            await connection.close();
            connection = null;
        }
    }
    catch (error) {
        logger_1.logger.error('Error closing RabbitMQ connection:', error);
        throw error;
    }
};
exports.closeConnection = closeConnection;
