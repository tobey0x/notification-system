"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const server_1 = require("./config/server");
const logger_1 = require("./utils/logger");
const rabbitmq_1 = require("./config/rabbitmq");
const firebase_1 = require("./config/firebase");
const start = async () => {
    try {
        // Initialize Firebase
        (0, firebase_1.initializeFirebase)();
        // Initialize RabbitMQ connection
        await (0, rabbitmq_1.connectToRabbitMQ)();
        // Create and start Fastify server
        const server = await (0, server_1.createServer)();
        const port = Number(process.env.PORT) || 3001;
        await server.listen({ port, host: '0.0.0.0' });
        logger_1.logger.info(`Server is running on http://localhost:${port}`);
    }
    catch (err) {
        logger_1.logger.error('Error starting server:', err);
        process.exit(1);
    }
};
start();
