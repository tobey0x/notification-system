# 🔔 Notification System

A microservices-based notification platform supporting Email and Push notifications with JWT authentication, message queuing, and async processing.

## Features

- 🔐 JWT authentication (access/refresh tokens)
- 📧 Email notifications via SMTP
- 📱 Push notifications via Firebase FCM
- 🔄 Async processing with RabbitMQ
- ⚡ Redis caching
- 🐘 PostgreSQL database
- 🐳 Docker containerization

## System Architecture

```
                          ┌─────────────┐
                          │   Client    │
                          └──────┬──────┘
                                 │ HTTPS
                                 ▼
                       ┌───────────────────┐
                       │   API Gateway     │ (Go - Port 8080)
                       │ • Authentication  │
                       │ • Rate Limiting   │
                       │ • Validation      │
                       └─────────┬─────────┘
                                 │
                                 ▼
                       ┌───────────────────┐
                       │    RabbitMQ       │ (Message Broker)
                       │  • email.queue    │
                       │  • push.queue     │
                       └─────────┬─────────┘
                                 │
                 ┌───────────────┴──────────────┐
                 ▼                              ▼
      ┌────────────────────┐         ┌────────────────────┐
      │  Email Service     │         │  Push Service      │
      │  (Python/Celery)   │         │  (Node.js/FCM)     │
      └────────────────────┘         └────────────────────┘
                 
┌──────────────────┐         ┌──────────┐         ┌──────────┐
│  User Service    │────────▶│PostgreSQL│         │  Redis   │
│ (Node.js/Prisma) │         └──────────┘         └──────────┘
└──────────────────┘
```

## Technologies

| Component | Technology | Purpose |
|-----------|-----------|---------|
| API Gateway | Go, Gin | Request routing, auth, rate limiting |
| User Service | Node.js, Fastify, Prisma | User management, JWT tokens |
| Email Service | Python, Celery | Email delivery via SMTP |
| Push Service | Node.js, TypeScript, Firebase | Push notifications via FCM |
| Database | PostgreSQL 15 | User data storage |
| Cache | Redis 7 | Session caching |
| Message Broker | RabbitMQ 3.12 | Async task queuing |

## Quick Start

### Using Docker (Recommended)

1. **Clone and configure**
```bash
git clone https://github.com/tobey0x/notification-system.git
cd notification-system
cp .env.example .env
# Edit .env with your credentials
```

2. **Start all services**
```bash
docker-compose up -d --build
```

3. **Verify health**
```bash
curl http://localhost:8080/health
```

### Local Development

#### API Gateway (Go)
```bash
cd api-gateway
go mod download
go run cmd/server/main.go
```

#### User Service (Node.js)
```bash
cd user-service-hng
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

#### Email Service (Python)
```bash
cd email-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
celery -A app.tasks worker --loglevel=info
```

#### Push Service (Node.js)
```bash
cd push-service
npm install
npm run dev
```

## API Endpoints

Base URL: `http://localhost:8080`

### Authentication

#### Register User
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

**Response (201)**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "id": "uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "access_token": "eyJhbGc...",
    "refresh_token": "eyJhbGc..."
  }
}
```

**Errors**
- `400` - Invalid input (missing fields, weak password)
- `409` - Email already exists

#### Login
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

**Response (200)**
```json
{
  "success": true,
  "message": "User logged in successfully",
  "data": {
    "id": "uuid",
    "email": "john@example.com",
    "access_token": "eyJhbGc...",
    "refresh_token": "eyJhbGc..."
  }
}
```

**Errors**
- `400` - Invalid credentials
- `404` - User not found

### Notifications

All notification endpoints require authentication via Bearer token:
```http
Authorization: Bearer <access_token>
```

#### Create Email Notification
```http
POST /api/v1/notifications
Content-Type: application/json
Authorization: Bearer <access_token>

{
  "type": "email",
  "user_id": "user-uuid",
  "priority": "normal",
  "template_id": "welcome_email",
  "variables": {
    "user_name": "John Doe",
    "user_email": "john@example.com",
    "subject": "Welcome!",
    "message": "Welcome to our platform"
  }
}
```

**Response (200)**
```json
{
  "success": true,
  "message": "Notification request accepted",
  "data": {
    "notification_id": "uuid",
    "type": "email",
    "status": "pending",
    "message": "Notification queued for processing"
  }
}
```

#### Create Push Notification
```http
POST /api/v1/notifications
Content-Type: application/json
Authorization: Bearer <access_token>

{
  "type": "push",
  "user_id": "user-uuid",
  "priority": "high",
  "template_id": "new_message",
  "variables": {
    "title": "New Message",
    "body": "You have a new message!",
    "device_token": "firebase-device-token"
  }
}
```

**Response (200)**
```json
{
  "success": true,
  "message": "Notification request accepted",
  "data": {
    "notification_id": "uuid",
    "type": "push",
    "status": "pending"
  }
}
```

**Errors**
- `401` - Invalid or expired token
- `400` - Invalid request body
- `422` - Validation error

#### Field Validation

**Required Fields:**
- `type`: Must be `"email"` or `"push"`
- `user_id`: Valid UUID
- `priority`: Must be `"high"`, `"normal"`, or `"low"`
- `template_id`: Template identifier (string)
- `variables`: Object containing notification data

**Priority Levels:**
- `high` - Immediate delivery
- `normal` - Standard queue processing
- `low` - Background processing

### Health Check
```http
GET /health
```

**Response (200)**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2025-11-13T12:00:00Z",
    "services": {
      "rabbitmq": "healthy",
      "redis": "healthy"
    }
  }
}
```

## Environment Configuration

Create a `.env` file with the following variables:

```bash
# JWT Secrets (generate with: openssl rand -base64 32)
ACCESS_SECRET=your-access-secret-min-32-chars
REFRESH_SECRET=your-refresh-secret-min-32-chars
JWT_SECRET=your-jwt-secret-min-32-chars

# API Gateway
PORT=8080
USER_SERVICE_URL=http://user-service:3000

# Database
DATABASE_URL=postgresql://notif_user:password@postgres:5432/notificationdb
POSTGRES_USER=notif_user
POSTGRES_PASSWORD=password
POSTGRES_DB=notificationdb

# RabbitMQ
RABBITMQ_URL=amqp://admin:admin123@rabbitmq:5672/
RABBITMQ_DEFAULT_USER=admin
RABBITMQ_DEFAULT_PASS=admin123

# Redis
REDIS_URL=redis://redis:6379

# Email (Gmail SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password
FROM_EMAIL=your-email@gmail.com

# Push (Firebase)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour-Key\n-----END PRIVATE KEY-----\n"

# Service Ports
USER_SERVICE_PORT=3000
PUSH_SERVICE_PORT=3001
```

## Error Handling

All API responses follow this structure:

**Success Response**
```json
{
  "success": true,
  "message": "Success message",
  "data": { }
}
```

**Error Response**
```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error description"
}
```

**HTTP Status Codes**
- `200` - Success
- `201` - Created
- `400` - Bad Request (invalid input)
- `401` - Unauthorized (invalid/expired token)
- `404` - Not Found
- `409` - Conflict (duplicate resource)
- `422` - Unprocessable Entity (validation error)
- `500` - Internal Server Error

## Monitoring

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api-gateway
docker-compose logs -f user-service
docker-compose logs -f email-service
docker-compose logs -f push-service
```

### RabbitMQ Management
- URL: `http://localhost:15672`
- Username: `admin`
- Password: `admin123`

### Database Access
```bash
docker-compose exec postgres psql -U notif_user -d notificationdb
```

### Redis Access
```bash
docker-compose exec redis redis-cli
```

## Testing

### Quick Test Script
```bash
# Register user
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "Test123"
  }'

# Login and get token
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123"}' \
  | jq -r '.data.access_token')

# Send notification
curl -X POST http://localhost:8080/api/v1/notifications \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "email",
    "user_id": "user-uuid",
    "priority": "normal",
    "template_id": "welcome_email",
    "variables": {
      "subject": "Welcome",
      "message": "Test notification"
    }
  }'
```

## Troubleshooting

### Services won't start
```bash
docker-compose down -v
docker-compose up -d --build --force-recreate
```

### Check service health
```bash
docker-compose ps
curl http://localhost:8080/health
curl http://localhost:3000/health
curl http://localhost:3001/health
```

### Database issues
```bash
docker-compose exec user-service npx prisma migrate deploy
```

### RabbitMQ issues
```bash
docker-compose restart rabbitmq
docker-compose logs rabbitmq
```

## Project Structure

```
notification-system/
├── api-gateway/              # Go API Gateway
│   ├── cmd/server/          # Entry point
│   └── internal/            # Handlers, middleware
├── user-service-hng/        # Node.js User Service
│   ├── src/                 # Controllers, routes
│   └── prisma/              # Database schema
├── email-service/           # Python Email Service
│   ├── app/                 # Celery tasks
│   └── templates/           # Email templates
├── push-service/            # Node.js Push Service
│   └── src/                 # FCM integration
├── docker-compose.yml       # Service orchestration
└── .env.example            # Environment template
```

## Contributors

- **[Tobi](https//github.com/tobey0x)** - API Gateway, DevOps, CI/CD
- **[Aluminate](https://github.com/DammyCodes-all)** - User Service, Authentication
- **[Hafylola](https://github.com/hafylola)** - Email Service
- **[Ajao](https://github.com/AjaoPeter8)** - Push Service

## License

MIT License

---

**Live Deployment:** https://notification-system-production-65b2.up.railway.app

**Repository:** https://github.com/tobey0x/notification-system
