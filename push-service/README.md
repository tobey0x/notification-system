# Push Notification Service

A scalable push notification service built with TypeScript, Fastify, RabbitMQ, and Firebase Cloud Messaging (FCM).

## Features

- Send push notifications to individual devices or topics
- Subscribe/unsubscribe devices to/from topics
- Asynchronous message processing using RabbitMQ
- Error handling and dead-letter queue support
- Health check endpoint
- Request validation
- Structured logging

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- RabbitMQ server
- Firebase project with Cloud Messaging enabled

## Setup

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd push-service
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Create environment file:
   ```bash
   # Create .env file
   touch .env
   ```
   
   **📖 See [ENV_CONFIG.md](./ENV_CONFIG.md) for detailed configuration guide**
   
   Update the `.env` file with:
   - **User Service URL** - Where your User Service is running
   - **Template Service URL** - Where your Template Service is running
   - **API Gateway URL** - Where your API Gateway is running
   - **RabbitMQ URL** - Your RabbitMQ connection string
   - **Firebase Credentials** - Your Firebase project credentials
   - **Queue Names** - Should match your RabbitMQ setup
   
   **Quick Start**: Copy the example from [ENV_CONFIG.md](./ENV_CONFIG.md) and update with your values.

4. Build the project:
   ```bash
   npm run build
   ```

## Running the Service

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

## API Endpoints

- `POST /api/v1/push/send` - Send a push notification to a specific device
- `POST /api/v1/push/topic/send` - Send a push notification to a topic
- `POST /api/v1/push/topic/subscribe` - Subscribe devices to a topic
- `POST /api/v1/push/topic/unsubscribe` - Unsubscribe devices from a topic
- `GET /health` - Health check endpoint

## Environment Variables

All environment variables should be configured in a `.env` file. Copy `.env.example` to `.env` and update the values:

### Server Configuration
- `PORT` - Port to run the server on (default: 3001)
- `NODE_ENV` - Environment (development, production, test)

### Service URLs (Other Microservices)
- `USER_SERVICE_URL` - User Service URL (provides user data including push_token)
  - Default: `http://user-service:3000`
  - Example: `http://localhost:3002` (for local development)
  
- `TEMPLATE_SERVICE_URL` - Template Service URL (provides notification templates)
  - Default: `http://template-service:3000`
  - Example: `http://localhost:3003` (for local development)
  
- `API_GATEWAY_URL` - API Gateway URL (tracks notification status)
  - Default: `http://api-gateway:3000`
  - Example: `http://localhost:3000` (for local development)

### RabbitMQ Configuration
- `RABBITMQ_URL` - RabbitMQ connection URL
  - Default: `amqp://guest:guest@localhost:5672`
  - Format: `amqp://username:password@host:port`
  - Example: `amqp://admin:password@rabbitmq:5672`

### Queue Names
- `PUSH_QUEUE` - Queue name for push notifications
  - Default: `push.queue`
  - Should match the queue name used by API Gateway
  
- `FAILED_QUEUE` - Dead letter queue for failed messages
  - Default: `failed.queue`

### Firebase Cloud Messaging (FCM)
- `FIREBASE_PROJECT_ID` - Firebase project ID
  - Get from: Firebase Console > Project Settings > General
  
- `FIREBASE_PRIVATE_KEY` - Firebase private key
  - Get from: Firebase Console > Project Settings > Service Accounts
  - Format: `-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n`
  - Note: Keep the `\n` characters for proper formatting
  
- `FIREBASE_CLIENT_EMAIL` - Firebase client email
  - Get from: Firebase Console > Project Settings > Service Accounts
  - Format: `firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com`

### Logging
- `LOG_LEVEL` - Logging level (default: info)
  - Options: `error`, `warn`, `info`, `debug`

## Testing

```bash
npm test
```

## Deployment

1. Set up a production-ready Node.js environment
2. Configure environment variables
3. Use PM2 or similar process manager:
   ```bash
   npm install -g pm2
   pm2 start dist/index.js --name "push-service"
   pm2 save
   pm2 startup
   ```

## Monitoring

- Check logs: `pm2 logs push-service`
- Monitor processes: `pm2 monit`

## License

MIT
