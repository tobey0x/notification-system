"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.pushRoutes = void 0;
const pushController = __importStar(require("../controllers/push.controller"));
const pushRoutes = (fastify, _opts, done) => {
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
exports.pushRoutes = pushRoutes;
