"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unsubscribeFromTopic = exports.subscribeToTopic = exports.sendToTopic = exports.sendPushNotification = void 0;
const push_service_1 = require("../services/push.service");
const logger_1 = require("../utils/logger");
const pushService = push_service_1.PushService.getInstance();
const sendPushNotification = async (request, reply) => {
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
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger_1.logger.error('Error sending push notification:', error);
        return reply.status(500).send({
            success: false,
            message: 'Failed to send push notification',
            error: errorMessage,
        });
    }
};
exports.sendPushNotification = sendPushNotification;
const sendToTopic = async (request, reply) => {
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
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger_1.logger.error('Error sending push notification to topic:', error);
        return reply.status(500).send({
            success: false,
            message: 'Failed to send push notification to topic',
            error: errorMessage,
        });
    }
};
exports.sendToTopic = sendToTopic;
const subscribeToTopic = async (request, reply) => {
    try {
        const { tokens, topic } = request.body;
        await pushService.subscribeToTopic(tokens, topic);
        return {
            success: true,
            message: `Successfully subscribed to topic: ${topic}`,
            data: { topic },
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger_1.logger.error('Error subscribing to topic:', error);
        return reply.status(500).send({
            success: false,
            message: 'Failed to subscribe to topic',
            error: errorMessage,
        });
    }
};
exports.subscribeToTopic = subscribeToTopic;
const unsubscribeFromTopic = async (request, reply) => {
    try {
        const { tokens, topic } = request.body;
        await pushService.unsubscribeFromTopic(tokens, topic);
        return {
            success: true,
            message: `Successfully unsubscribed from topic: ${topic}`,
            data: { topic },
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger_1.logger.error('Error unsubscribing from topic:', error);
        return reply.status(500).send({
            success: false,
            message: 'Failed to unsubscribe from topic',
            error: errorMessage,
        });
    }
};
exports.unsubscribeFromTopic = unsubscribeFromTopic;
