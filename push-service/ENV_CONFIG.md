# Environment Configuration Guide

This document explains where to input details from other services in the Push Service.

## Configuration File

Create a `.env` file in the root of the `push-service` directory (`stage_4/push-service/.env`) with the following variables:

## Required Environment Variables

### 1. Server Configuration
```env
PORT=3001
NODE_ENV=development
```

### 2. Service URLs (Other Microservices)

#### User Service
**Purpose**: Provides user data including `push_token`  
**Used in**: `src/services/push.service.ts` → `getUserData()`  
**Endpoint**: `GET /api/v1/users/{user_id}`

```env
USER_SERVICE_URL=http://user-service:3000
```

**For local development**:
```env
USER_SERVICE_URL=http://localhost:3002
```

**Where to get this**: 
- The URL where your User Service is running
- Should be accessible from the Push Service
- In Docker: use service name (e.g., `user-service`)
- In local dev: use `localhost` with the port

---

#### Template Service
**Purpose**: Provides notification templates with variable placeholders  
**Used in**: `src/services/push.service.ts` → `getTemplate()`  
**Endpoint**: `GET /api/v1/templates/{template_code}`

```env
TEMPLATE_SERVICE_URL=http://template-service:3000
```

**For local development**:
```env
TEMPLATE_SERVICE_URL=http://localhost:3003
```

**Where to get this**: 
- The URL where your Template Service is running
- Should be accessible from the Push Service
- In Docker: use service name (e.g., `template-service`)
- In local dev: use `localhost` with the port

---

#### API Gateway
**Purpose**: Tracks notification status  
**Used in**: `src/services/push.service.ts` → `updateNotificationStatus()`  
**Endpoint**: `POST /api/v1/notification/status`

```env
API_GATEWAY_URL=http://api-gateway:3000
```

**For local development**:
```env
API_GATEWAY_URL=http://localhost:3000
```

**Where to get this**: 
- The URL where your API Gateway is running
- Should be accessible from the Push Service
- In Docker: use service name (e.g., `api-gateway`)
- In local dev: use `localhost` with the port

---

### 3. RabbitMQ Configuration

#### RabbitMQ Connection URL
**Purpose**: Connects to RabbitMQ message queue  
**Used in**: `src/config/rabbitmq.ts` → `connectToRabbitMQ()`

```env
RABBITMQ_URL=amqp://guest:guest@localhost:5672
```

**Format**: `amqp://username:password@host:port`

**Examples**:
- Local: `amqp://guest:guest@localhost:5672`
- Docker: `amqp://admin:password@rabbitmq:5672`
- Cloud: `amqp://user:pass@rabbitmq.example.com:5672`

**Where to get this**: 
- From your RabbitMQ server configuration
- Default credentials: `guest/guest` (development only)
- Production: Use secure credentials

---

#### Queue Names
**Purpose**: Define queue names for message routing  
**Used in**: `src/config/rabbitmq.ts` → `setupQueues()`, `setupConsumer()`

```env
PUSH_QUEUE=push.queue
FAILED_QUEUE=failed.queue
```

**Important**: 
- `PUSH_QUEUE` should match the queue name used by API Gateway
- `FAILED_QUEUE` is for dead letter queue (failed messages)
- These should match your RabbitMQ exchange/queue setup

---

### 4. Firebase Cloud Messaging (FCM)

#### Firebase Project ID
**Purpose**: Identifies your Firebase project  
**Used in**: `src/config/firebase.ts` → `initializeFirebase()`

```env
FIREBASE_PROJECT_ID=your-project-id
```

**Where to get this**: 
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to Project Settings > General
4. Copy the "Project ID"

---

#### Firebase Private Key
**Purpose**: Authenticates with Firebase Admin SDK  
**Used in**: `src/config/firebase.ts` → `initializeFirebase()`

```env
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"
```

**Where to get this**: 
1. Go to Firebase Console > Project Settings > Service Accounts
2. Click "Generate new private key"
3. Download the JSON file
4. Copy the `private_key` value (including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`)
5. Keep the `\n` characters for proper formatting

**Important**: 
- Keep the key secure (never commit to git)
- Use environment variables or secrets management
- The `\n` characters are required for proper key parsing

---

#### Firebase Client Email
**Purpose**: Service account email for Firebase Admin SDK  
**Used in**: `src/config/firebase.ts` → `initializeFirebase()`

```env
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
```

**Where to get this**: 
1. Go to Firebase Console > Project Settings > Service Accounts
2. Copy the "Client email" value
3. Format: `firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com`

---

### 5. Logging

#### Log Level
**Purpose**: Controls logging verbosity  
**Used in**: `src/utils/logger.ts`

```env
LOG_LEVEL=info
```

**Options**: 
- `error` - Only errors
- `warn` - Warnings and errors
- `info` - Info, warnings, and errors (default)
- `debug` - All logs including debug messages

---

## Complete .env Example

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Service URLs (Other Microservices)
USER_SERVICE_URL=http://user-service:3000
TEMPLATE_SERVICE_URL=http://template-service:3000
API_GATEWAY_URL=http://api-gateway:3000

# RabbitMQ Configuration
RABBITMQ_URL=amqp://guest:guest@localhost:5672

# Queue Names
PUSH_QUEUE=push.queue
FAILED_QUEUE=failed.queue

# Firebase Cloud Messaging (FCM) Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com

# Logging
LOG_LEVEL=info
```

## Local Development Setup

For local development, update the service URLs to use `localhost`:

```env
USER_SERVICE_URL=http://localhost:3002
TEMPLATE_SERVICE_URL=http://localhost:3003
API_GATEWAY_URL=http://localhost:3000
RABBITMQ_URL=amqp://guest:guest@localhost:5672
```

## Docker Setup

For Docker deployment, use service names:

```env
USER_SERVICE_URL=http://user-service:3000
TEMPLATE_SERVICE_URL=http://template-service:3000
API_GATEWAY_URL=http://api-gateway:3000
RABBITMQ_URL=amqp://admin:password@rabbitmq:5672
```

## Verification

After setting up your `.env` file, verify the configuration:

1. **Check service connectivity**:
   - Ensure all service URLs are accessible
   - Test with `curl` or Postman

2. **Check RabbitMQ**:
   - Verify RabbitMQ is running
   - Check queue names match

3. **Check Firebase**:
   - Verify Firebase credentials are correct
   - Test Firebase Admin SDK initialization

4. **Start the service**:
   ```bash
   npm run dev
   ```

5. **Check logs**:
   - Look for successful connections to all services
   - Check for any connection errors

## Troubleshooting

### Service Connection Issues
- **Problem**: Cannot connect to User Service
  - **Solution**: Check `USER_SERVICE_URL` is correct and service is running
  - **Test**: `curl http://user-service:3000/health`

- **Problem**: Cannot connect to Template Service
  - **Solution**: Check `TEMPLATE_SERVICE_URL` is correct and service is running
  - **Test**: `curl http://template-service:3000/health`

- **Problem**: Cannot connect to API Gateway
  - **Solution**: Check `API_GATEWAY_URL` is correct and service is running
  - **Test**: `curl http://api-gateway:3000/health`

### RabbitMQ Connection Issues
- **Problem**: Cannot connect to RabbitMQ
  - **Solution**: Check `RABBITMQ_URL` is correct and RabbitMQ is running
  - **Test**: `rabbitmqadmin list queues`

### Firebase Issues
- **Problem**: Firebase initialization fails
  - **Solution**: Check all Firebase credentials are correct
  - **Verify**: Ensure private key format is correct (with `\n` characters)
  - **Test**: Check Firebase Console > Project Settings > Service Accounts

## Security Notes

1. **Never commit `.env` file to git**
2. **Use secrets management** in production (AWS Secrets Manager, Azure Key Vault, etc.)
3. **Rotate credentials** regularly
4. **Use secure passwords** for RabbitMQ
5. **Restrict Firebase permissions** to minimum required

