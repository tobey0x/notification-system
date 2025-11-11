# API Gateway Service

> Entry point for the Distributed Notification System

## 📋 Overview

The API Gateway serves as the central entry point for all notification requests in the distributed notification system. It handles request validation, authentication, routing to message queues, and tracks notification status.

## ✨ Features

- ✅ RESTful API for notification management
- ✅ JWT-based authentication & authorization
- ✅ Request validation and sanitization
- ✅ Idempotency support via `X-Idempotency-Key` header
- ✅ Rate limiting (100 requests/minute per user)
- ✅ Routing to email and push queues via RabbitMQ
- ✅ Redis-based caching and status tracking
- ✅ Health check endpoint
- ✅ CORS support
- ✅ Structured logging with request correlation
- ✅ Docker support with multi-stage builds

## 🏗️ Architecture

```
Client Request
     ↓
API Gateway (Port 8080)
     ↓
Authentication Middleware
     ↓
Rate Limiting Middleware
     ↓
Handlers
     ↓
├─→ RabbitMQ (email.queue / push.queue)
└─→ Redis (status tracking / caching)
```

## 🚀 Quick Start

### Prerequisites

- Go 1.21+
- Docker & Docker Compose
- Redis
- RabbitMQ

### Installation

1. **Clone the repository**
   ```bash
   cd notification-system/api-gateway
   ```

2. **Install dependencies**
   ```bash
   go mod download
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start infrastructure services**
   ```bash
   cd ..
   docker-compose up -d redis rabbitmq
   ```

5. **Run the API Gateway**
   ```bash
   cd api-gateway
   go run cmd/server/main.go
   ```

The service will start on `http://localhost:8080`

### Using Docker

```bash
# Build the image
docker build -t api-gateway:latest -f DockerFile .

# Run the container
docker run -p 8080:8080 \
  -e RABBITMQ_URL=amqp://admin:admin@rabbitmq:5672/ \
  -e REDIS_URL=redis://redis:6379 \
  -e JWT_SECRET=your-secret-key \
  api-gateway:latest
```

## 📡 API Endpoints

### Health Check

```http
GET /health
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2025-11-11T10:30:00Z",
    "services": {
      "rabbitmq": "healthy",
      "redis": "healthy"
    }
  },
  "message": "Health check completed"
}
```

### Create Notification

```http
POST /api/v1/notifications
Authorization: Bearer <jwt_token>
X-Idempotency-Key: unique-request-id (optional)
Content-Type: application/json
```

**Request Body:**
```json
{
  "type": "email",
  "user_id": "user123",
  "priority": "high",
  "template_id": "welcome_email",
  "variables": {
    "name": "John Doe",
    "link": "https://example.com/verify"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "notification_id": "550e8400-e29b-41d4-a716-446655440000",
    "type": "email",
    "status": "pending",
    "message": "Notification queued for processing"
  },
  "message": "Notification request accepted"
}
```

### Get Notification Status

```http
GET /api/v1/notifications/:id
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "notification_id": "550e8400-e29b-41d4-a716-446655440000",
    "type": "email",
    "user_id": "user123",
    "status": "sent",
    "created_at": "2025-11-11T10:30:00Z",
    "updated_at": "2025-11-11T10:30:15Z"
  },
  "message": "Notification status retrieved"
}
```

### List Notifications

```http
GET /api/v1/notifications?page=1&limit=20
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "data": [],
  "message": "Notification retrieved",
  "meta": {
    "total": 0,
    "limit": 20,
    "page": 1,
    "total_pages": 0,
    "has_next": false,
    "has_previous": false
  }
}
```

## 🔐 Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the `Authorization` header:

```
Authorization: Bearer your-jwt-token
```

**JWT Claims Structure:**
```json
{
  "user_id": "user123",
  "email": "user@example.com",
  "roles": ["user"],
  "exp": 1699804800
}
```

## 🎯 Request/Response Format

All API responses follow this structure:

```json
{
  "success": boolean,
  "data": any,
  "error": string | null,
  "message": string,
  "meta": {
    "total": number,
    "limit": number,
    "page": number,
    "total_pages": number,
    "has_next": boolean,
    "has_previous": boolean
  } | null
}
```

**Note:** All field names use `snake_case` as per project specifications.

## 🛡️ Idempotency

Prevent duplicate notifications by including an `X-Idempotency-Key` header:

```http
POST /api/v1/notifications
X-Idempotency-Key: unique-request-123
```

- Keys are cached for 24 hours
- Duplicate requests return the original notification ID
- Use UUIDs or unique request identifiers

## ⚡ Rate Limiting

- **Limit:** 100 requests per minute per user
- **Headers:**
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Requests remaining
  - `X-RateLimit-Reset`: Unix timestamp when limit resets
- **Response on limit exceeded:** `429 Too Many Requests`

## 🔧 Configuration

Environment variables (see `.env.example`):

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `8080` |
| `ENV` | Environment (development/production) | `development` |
| `RABBITMQ_URL` | RabbitMQ connection URL | `amqp://admin:admin@localhost:5672/` |
| `RABBITMQ_EXCHANGE` | Exchange name | `notification.direct` |
| `RABBITMQ_EMAIL_QUEUE` | Email queue name | `email.queue` |
| `RABBITMQ_PUSH_QUEUE` | Push queue name | `push.queue` |
| `RABBITMQ_FAILED_QUEUE` | Failed messages queue | `failed.queue` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `REDIS_DB` | Redis database number | `0` |
| `JWT_SECRET` | JWT signing secret | `change-in-prod` |

## 🧪 Testing

```bash
# Run all tests
go test ./... -v

# Run with coverage
go test ./... -v -race -coverprofile=coverage.out

# View coverage report
go tool cover -html=coverage.out
```

## 📦 Project Structure

```
api-gateway/
├── cmd/
│   └── server/
│       └── main.go              # Application entry point
├── internal/
│   ├── cache/
│   │   └── redis.go             # Redis client
│   ├── config/
│   │   └── config.go            # Configuration management
│   ├── handlers/
│   │   ├── health.go            # Health check handler
│   │   ├── health_test.go       # Health tests
│   │   ├── notifications.go     # Notification handlers
│   │   └── notifications_test.go # Notification tests
│   ├── middleware/
│   │   ├── auth.go              # JWT authentication
│   │   └── rate_limit.go        # Rate limiting
│   ├── models/
│   │   ├── request.go           # Request models
│   │   └── response.go          # Response models
│   └── queue/
│       └── rabbitmq.go          # RabbitMQ client
├── .env.example                  # Environment template
├── .gitignore
├── DockerFile                    # Docker build configuration
├── go.mod
├── go.sum
└── README.md
```

## 🐛 Troubleshooting

### RabbitMQ Connection Failed
```
Error: Failed to connect to RabbitMQ
```
**Solution:** Ensure RabbitMQ is running and `RABBITMQ_URL` is correct.

### Redis Connection Failed
```
Error: Failed to connect to Redis
```
**Solution:** Ensure Redis is running and `REDIS_URL` is correct.

### Authentication Failed
```
Error: Invalid or expired token
```
**Solution:** Verify JWT token is valid and not expired. Check `JWT_SECRET` matches token issuer.

### Rate Limit Exceeded
```
Error: Rate limit exceeded
```
**Solution:** Wait for the rate limit window to reset (check `X-RateLimit-Reset` header).

## 📊 Monitoring

### Health Checks

The `/health` endpoint returns:
- `200 OK`: All services healthy
- `503 Service Unavailable`: One or more services degraded

### Logs

Logs include:
- Request method, path, and status code
- Response latency
- Client IP address
- Error messages

Example:
```
[POST] /api/v1/notifications 127.0.0.1 | 202 | 45.2ms |
```

## 🚀 Deployment

### CI/CD Pipeline

The project includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that:
1. Lints code with golangci-lint
2. Runs tests with coverage
3. Builds the application
4. Builds and pushes Docker image
5. Deploys to production server

### Required Secrets

Configure these in GitHub repository secrets:
- `SERVER_HOST`: Deployment server hostname
- `SERVER_USER`: SSH username
- `SSH_PRIVATE_KEY`: SSH private key
- `API_GATEWAY_URL`: Production API URL
- `SLACK_WEBHOOK`: Slack notification webhook (optional)

## 📝 Development

### Adding New Endpoints

1. Create handler in `internal/handlers/`
2. Add route in `cmd/server/main.go`
3. Create tests in `internal/handlers/*_test.go`
4. Update this README

### Code Style

- Follow Go best practices
- Use `snake_case` for JSON fields
- Add comments for exported functions
- Write tests for new features

## 📄 License

Part of the HNGi13 Notification System project.

## 🔗 Related Services

- **User Service** - Manages user data and preferences
- **Email Service** - Processes email notifications
- **Push Service** - Sends push notifications
- **Template Service** - Manages notification templates
