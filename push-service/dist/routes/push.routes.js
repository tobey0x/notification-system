"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pushRoutes = pushRoutes;
const push_controller_1 = require("../controllers/push.controller");
function pushRoutes(fastify, _, done) {
    // Send push notification to a specific device
    fastify.post('/push/device', push_controller_1.sendPushNotification);
    // Send push notification to a topic
    fastify.post('/push/topic', push_controller_1.sendToTopic);
    // Subscribe devices to a topic
    fastify.post('/push/subscribe', push_controller_1.subscribeToTopic);
    // Unsubscribe devices from a topic
    fastify.post('/push/unsubscribe', push_controller_1.unsubscribeFromTopic);
    done();
}
