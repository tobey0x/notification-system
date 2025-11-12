"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.moveToFailedQueue = exports.processPushNotification = void 0;
exports.setChannelGetter = setChannelGetter;
const push_service_1 = require("./push.service");
const logger_1 = require("../utils/logger");
// Store the channel getter function
let _getChannel = null;
// This function will be called by rabbitmq.ts to provide the getChannel function
function setChannelGetter(getter) {
    _getChannel = getter;
}
/**
 * Process notification from queue (API Gateway format)
 * This is the main entry point for queue messages
 */
const processPushNotification = async (message) => {
    const pushService = push_service_1.PushService.getInstance();
    try {
        // Check if it's the new API Gateway format (has user_id and template_code)
        if ('user_id' in message && 'template_code' in message) {
            // New format: Fetch user data and template, process notification
            await pushService.processNotificationFromQueue(message);
            logger_1.logger.info(`Successfully processed push notification for user: ${message.user_id}, request: ${message.request_id}`);
        }
        else if ('deviceToken' in message) {
            // Legacy format: Direct device token (for backward compatibility)
            const legacyMessage = message;
            const { deviceToken, ...notification } = legacyMessage;
            await pushService.sendToDevice(deviceToken, {
                title: notification.title,
                body: notification.body,
                data: notification.data,
                imageUrl: notification.imageUrl,
                clickAction: notification.clickAction,
            });
            logger_1.logger.info(`Successfully processed push notification for device: ${deviceToken}`);
        }
        else {
            throw new Error('Invalid message format: missing user_id/template_code or deviceToken');
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorObj = error instanceof Error ? error : new Error(errorMessage);
        logger_1.logger.error(`Failed to process push notification:`, {
            message: 'user_id' in message ? message.user_id : 'deviceToken' in message ? message.deviceToken : 'unknown',
            error: errorObj.message,
            stack: errorObj.stack,
        });
        await (0, exports.moveToFailedQueue)(message, errorObj);
        throw errorObj; // Re-throw to trigger NACK in the consumer
    }
};
exports.processPushNotification = processPushNotification;
const moveToFailedQueue = async (message, error) => {
    if (!_getChannel) {
        logger_1.logger.error('RabbitMQ channel getter not initialized');
        return;
    }
    const channel = _getChannel();
    if (!channel) {
        logger_1.logger.error('Failed to get RabbitMQ channel for failed queue');
        return;
    }
    const failedQueue = process.env.FAILED_QUEUE || 'failed.queue';
    try {
        await channel.assertQueue(failedQueue, { durable: true });
        const errorPayload = {
            message,
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack
            },
            timestamp: new Date().toISOString()
        };
        const sent = channel.sendToQueue(failedQueue, Buffer.from(JSON.stringify(errorPayload)), { persistent: true });
        if (!sent) {
            throw new Error('Failed to send message to failed queue: channel is closed or queue is full');
        }
        logger_1.logger.info('Message moved to failed queue');
    }
    catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        logger_1.logger.error(`Failed to move message to failed queue (${failedQueue}):`, errorMessage);
        // If we can't send to the failed queue, at least log the error
        logger_1.logger.error('Original message that failed to be moved to failed queue:', {
            message,
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack
            },
            timestamp: new Date().toISOString()
        });
    }
};
exports.moveToFailedQueue = moveToFailedQueue;
