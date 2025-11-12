"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServer = void 0;
const fastify_1 = __importDefault(require("fastify"));
const helmet_1 = __importDefault(require("@fastify/helmet"));
const cors_1 = __importDefault(require("@fastify/cors"));
const logger_1 = require("../utils/logger");
const push_routes_1 = require("../routes/push.routes");
const createServer = async () => {
    const app = (0, fastify_1.default)({
        logger: false, // We're using our custom logger
        disableRequestLogging: process.env.NODE_ENV === 'production',
    });
    // Register plugins
    await app.register(cors_1.default, {
        origin: process.env.NODE_ENV === 'production'
            ? [/yourdomain\.com$/]
            : '*',
    });
    await app.register(helmet_1.default);
    // Health check endpoint
    app.get('/health', async () => ({
        status: 'ok',
        timestamp: new Date().toISOString(),
    }));
    // Register routes
    await app.register(push_routes_1.pushRoutes, { prefix: '/api/v1/push' });
    // Error handler
    app.setErrorHandler((error, request, reply) => {
        logger_1.logger.error(`Request ${request.id} failed: ${error.message}`);
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
exports.createServer = createServer;
