# Notification System Makefile
# Pure Docker CLI commands (no docker-compose dependency)

.PHONY: help build start stop restart clean logs ps network volumes build-all start-infrastructure start-services health-check

# Include environment variables from .env file
include .env
export

# Variables
NETWORK_NAME=notification_network
POSTGRES_VOLUME=postgres_data
RABBITMQ_VOLUME=rabbitmq_data
REDIS_VOLUME=redis_data

# Image tags
API_GATEWAY_IMAGE=notification-api-gateway:latest
USER_SERVICE_IMAGE=notification-user-service:latest
EMAIL_SERVICE_IMAGE=notification-email-service:latest
PUSH_SERVICE_IMAGE=notification-push-service:latest

# Container names
POSTGRES_CONTAINER=notification_postgres
RABBITMQ_CONTAINER=notification_rabbitmq
REDIS_CONTAINER=notification_redis
API_GATEWAY_CONTAINER=notification_api_gateway
USER_SERVICE_CONTAINER=notification_user_service
EMAIL_SERVICE_CONTAINER=notification_email_service
PUSH_SERVICE_CONTAINER=notification_push_service

# Default target
help:
	@echo "Notification System - Docker Deployment Commands"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@echo "  build                 Build all service images"
	@echo "  network               Create Docker network"
	@echo "  volumes               Create Docker volumes"
	@echo "  start-infrastructure  Start infrastructure services (postgres, rabbitmq, redis)"
	@echo "  start-services        Start application services"
	@echo "  start                 Start all services (infrastructure + services)"
	@echo "  stop                  Stop all containers"
	@echo "  restart            Restart all services"
	@echo "  clean              Stop and remove all containers, networks, and volumes"
	@echo "  logs               Show logs for all containers"
	@echo "  ps                 List all containers"
	@echo "  health-check       Check health status of all services"
	@echo ""
	@echo "Individual service targets:"
	@echo "  build-api-gateway  Build API Gateway image"
	@echo "  build-user-service Build User Service image"
	@echo "  build-email-service Build Email Service image"
	@echo "  build-push-service Build Push Service image"

# Network setup
network:
	@echo "Creating Docker network..."
	@docker network inspect $(NETWORK_NAME) >/dev/null 2>&1 || \
		docker network create $(NETWORK_NAME)
	@echo "✓ Network $(NETWORK_NAME) ready"

# Volume setup
volumes:
	@echo "Creating Docker volumes..."
	@docker volume inspect $(POSTGRES_VOLUME) >/dev/null 2>&1 || \
		docker volume create $(POSTGRES_VOLUME)
	@docker volume inspect $(RABBITMQ_VOLUME) >/dev/null 2>&1 || \
		docker volume create $(RABBITMQ_VOLUME)
	@docker volume inspect $(REDIS_VOLUME) >/dev/null 2>&1 || \
		docker volume create $(REDIS_VOLUME)
	@echo "✓ Volumes created"

# Build targets
build-api-gateway:
	@echo "Building API Gateway..."
	@cd api-gateway && docker build -t $(API_GATEWAY_IMAGE) -f DockerFile .
	@echo "✓ API Gateway image built"

build-user-service:
	@echo "Building User Service..."
	@cd user-service-hng && docker build -t $(USER_SERVICE_IMAGE) .
	@echo "✓ User Service image built"

build-email-service:
	@echo "Building Email Service..."
	@cd email-service && docker build -t $(EMAIL_SERVICE_IMAGE) .
	@echo "✓ Email Service image built"

build-push-service:
	@echo "Building Push Service..."
	@cd push-service && docker build -t $(PUSH_SERVICE_IMAGE) .
	@echo "✓ Push Service image built"

build-all: build-api-gateway build-user-service build-email-service build-push-service
	@echo "✓ All images built successfully"

build: build-all

# Infrastructure services
start-postgres: network volumes
	@echo "Starting PostgreSQL..."
	@docker ps -a --format '{{.Names}}' | grep -q $(POSTGRES_CONTAINER) && \
		(docker start $(POSTGRES_CONTAINER) || docker rm -f $(POSTGRES_CONTAINER) && false) || \
		docker run -d \
			--name $(POSTGRES_CONTAINER) \
			--network $(NETWORK_NAME) \
			-v $(POSTGRES_VOLUME):/var/lib/postgresql/data \
			-e POSTGRES_USER=$(POSTGRES_USER) \
			-e POSTGRES_PASSWORD=$(POSTGRES_PASSWORD) \
			-e POSTGRES_DB=$(POSTGRES_DB) \
			-p 5432:5432 \
			--restart unless-stopped \
			--health-cmd="pg_isready -U $(POSTGRES_USER)" \
			--health-interval=10s \
			--health-timeout=5s \
			--health-retries=5 \
			postgres:15-alpine
	@echo "✓ PostgreSQL started"

start-rabbitmq: network volumes
	@echo "Starting RabbitMQ..."
	@docker ps -a --format '{{.Names}}' | grep -q $(RABBITMQ_CONTAINER) && \
		(docker start $(RABBITMQ_CONTAINER) || docker rm -f $(RABBITMQ_CONTAINER) && false) || \
		docker run -d \
			--name $(RABBITMQ_CONTAINER) \
			--network $(NETWORK_NAME) \
			-v $(RABBITMQ_VOLUME):/var/lib/rabbitmq \
			-e RABBITMQ_DEFAULT_USER=$(RABBITMQ_DEFAULT_USER) \
			-e RABBITMQ_DEFAULT_PASS=$(RABBITMQ_DEFAULT_PASS) \
			-p 5672:5672 \
			-p 15672:15672 \
			--restart unless-stopped \
			--health-cmd="rabbitmq-diagnostics -q ping" \
			--health-interval=10s \
			--health-timeout=5s \
			--health-retries=5 \
			rabbitmq:3.12-management
	@echo "✓ RabbitMQ started"

start-redis: network volumes
	@echo "Starting Redis..."
	@docker ps -a --format '{{.Names}}' | grep -q $(REDIS_CONTAINER) && \
		(docker start $(REDIS_CONTAINER) || docker rm -f $(REDIS_CONTAINER) && false) || \
		docker run -d \
			--name $(REDIS_CONTAINER) \
			--network $(NETWORK_NAME) \
			-v $(REDIS_VOLUME):/data \
			-p 6379:6379 \
			--restart unless-stopped \
			--health-cmd="redis-cli ping" \
			--health-interval=10s \
			--health-timeout=5s \
			--health-retries=5 \
			redis:7-alpine
	@echo "✓ Redis started"

start-infrastructure: start-postgres start-rabbitmq start-redis
	@echo "Waiting for infrastructure to be healthy..."
	@sleep 5
	@echo "✓ All infrastructure services started"

# Application services
start-user-service: network
	@echo "Starting User Service..."
	@docker ps -a --format '{{.Names}}' | grep -q $(USER_SERVICE_CONTAINER) && \
		(docker start $(USER_SERVICE_CONTAINER) || docker rm -f $(USER_SERVICE_CONTAINER) && false) || \
		docker run -d \
			--name $(USER_SERVICE_CONTAINER) \
			--network $(NETWORK_NAME) \
			-e DATABASE_URL="postgresql://$(POSTGRES_USER):$(POSTGRES_PASSWORD)@$(POSTGRES_CONTAINER):5432/$(POSTGRES_DB)?schema=public" \
			-e ACCESS_SECRET="$(ACCESS_SECRET)" \
			-e REFRESH_SECRET="$(REFRESH_SECRET)" \
			-e PORT=$(USER_SERVICE_PORT) \
			-p $(USER_SERVICE_PORT):$(USER_SERVICE_PORT) \
			--restart unless-stopped \
			$(USER_SERVICE_IMAGE)
	@echo "✓ User Service started"

start-email-service: network
	@echo "Starting Email Service..."
	@docker ps -a --format '{{.Names}}' | grep -q $(EMAIL_SERVICE_CONTAINER) && \
		(docker start $(EMAIL_SERVICE_CONTAINER) || docker rm -f $(EMAIL_SERVICE_CONTAINER) && false) || \
		docker run -d \
			--name $(EMAIL_SERVICE_CONTAINER) \
			--network $(NETWORK_NAME) \
			-e RABBITMQ_HOST=$(RABBITMQ_CONTAINER) \
			-e RABBITMQ_PORT=5672 \
			-e RABBITMQ_USER=$(RABBITMQ_DEFAULT_USER) \
			-e RABBITMQ_PASSWORD=$(RABBITMQ_DEFAULT_PASS) \
			-e CELERY_BROKER_URL="amqp://$(RABBITMQ_DEFAULT_USER):$(RABBITMQ_DEFAULT_PASS)@$(RABBITMQ_CONTAINER):5672//" \
			-e CELERY_RESULT_BACKEND="redis://$(REDIS_CONTAINER):6379/0" \
			-e SMTP_HOST=$(SMTP_HOST) \
			-e SMTP_PORT=$(SMTP_PORT) \
			-e SMTP_USER=$(SMTP_USER) \
			-e SMTP_PASS=$(SMTP_PASS) \
			-e FROM_EMAIL=$(FROM_EMAIL) \
			--restart unless-stopped \
			$(EMAIL_SERVICE_IMAGE)
	@echo "✓ Email Service started"

start-push-service: network
	@echo "Starting Push Service..."
	@docker ps -a --format '{{.Names}}' | grep -q $(PUSH_SERVICE_CONTAINER) && \
		(docker start $(PUSH_SERVICE_CONTAINER) || docker rm -f $(PUSH_SERVICE_CONTAINER) && false) || \
		docker run -d \
			--name $(PUSH_SERVICE_CONTAINER) \
			--network $(NETWORK_NAME) \
			-e RABBITMQ_URL="amqp://$(RABBITMQ_DEFAULT_USER):$(RABBITMQ_DEFAULT_PASS)@$(RABBITMQ_CONTAINER):5672" \
			-e FIREBASE_PROJECT_ID="$(FIREBASE_PROJECT_ID)" \
			-e FIREBASE_PRIVATE_KEY="$(FIREBASE_PRIVATE_KEY)" \
			-e FIREBASE_CLIENT_EMAIL="$(FIREBASE_CLIENT_EMAIL)" \
			-e PORT=$(PUSH_SERVICE_PORT) \
			-p $(PUSH_SERVICE_PORT):$(PUSH_SERVICE_PORT) \
			--restart unless-stopped \
			$(PUSH_SERVICE_IMAGE)
	@echo "✓ Push Service started"

start-api-gateway: network
	@echo "Starting API Gateway..."
	@docker ps -a --format '{{.Names}}' | grep -q $(API_GATEWAY_CONTAINER) && \
		(docker start $(API_GATEWAY_CONTAINER) || docker rm -f $(API_GATEWAY_CONTAINER) && false) || \
		docker run -d \
			--name $(API_GATEWAY_CONTAINER) \
			--network $(NETWORK_NAME) \
			-e PORT=$(PORT) \
			-e USER_SERVICE_URL="http://$(USER_SERVICE_CONTAINER):$(USER_SERVICE_PORT)" \
			-e RABBITMQ_URL="$(RABBITMQ_URL)" \
			-e REDIS_URL="$(REDIS_URL)" \
			-e ACCESS_SECRET="$(ACCESS_SECRET)" \
			-e JWT_SECRET="$(JWT_SECRET)" \
			-p $(PORT):$(PORT) \
			--restart unless-stopped \
			$(API_GATEWAY_IMAGE)
	@echo "✓ API Gateway started"

start-services: start-user-service start-email-service start-push-service start-api-gateway
	@echo "✓ All application services started"

# Start everything
start: start-infrastructure start-services
	@echo ""
	@echo "========================================"
	@echo "  Notification System Started"
	@echo "========================================"
	@echo "API Gateway:         http://localhost:$(PORT)"
	@echo "User Service:        http://localhost:$(USER_SERVICE_PORT)"
	@echo "Push Service:        http://localhost:$(PUSH_SERVICE_PORT)"
	@echo "RabbitMQ Management: http://localhost:15672"
	@echo "========================================"

# Stop all containers
stop:
	@echo "Stopping all containers..."
	@docker stop $(API_GATEWAY_CONTAINER) 2>/dev/null || true
	@docker stop $(USER_SERVICE_CONTAINER) 2>/dev/null || true
	@docker stop $(EMAIL_SERVICE_CONTAINER) 2>/dev/null || true
	@docker stop $(PUSH_SERVICE_CONTAINER) 2>/dev/null || true
	@docker stop $(POSTGRES_CONTAINER) 2>/dev/null || true
	@docker stop $(RABBITMQ_CONTAINER) 2>/dev/null || true
	@docker stop $(REDIS_CONTAINER) 2>/dev/null || true
	@echo "✓ All containers stopped"

# Restart all services
restart: stop start

# Clean everything
clean:
	@echo "Cleaning up..."
	@docker rm -f $(API_GATEWAY_CONTAINER) 2>/dev/null || true
	@docker rm -f $(USER_SERVICE_CONTAINER) 2>/dev/null || true
	@docker rm -f $(EMAIL_SERVICE_CONTAINER) 2>/dev/null || true
	@docker rm -f $(PUSH_SERVICE_CONTAINER) 2>/dev/null || true
	@docker rm -f $(POSTGRES_CONTAINER) 2>/dev/null || true
	@docker rm -f $(RABBITMQ_CONTAINER) 2>/dev/null || true
	@docker rm -f $(REDIS_CONTAINER) 2>/dev/null || true
	@docker network rm $(NETWORK_NAME) 2>/dev/null || true
	@docker volume rm $(POSTGRES_VOLUME) 2>/dev/null || true
	@docker volume rm $(RABBITMQ_VOLUME) 2>/dev/null || true
	@docker volume rm $(REDIS_VOLUME) 2>/dev/null || true
	@echo "✓ Cleanup complete"

# Show logs
logs:
	@echo "Showing logs for all containers (Ctrl+C to stop)..."
	@docker logs -f $(API_GATEWAY_CONTAINER) 2>&1 | sed 's/^/[API-GATEWAY] /' &
	@docker logs -f $(USER_SERVICE_CONTAINER) 2>&1 | sed 's/^/[USER-SERVICE] /' &
	@docker logs -f $(EMAIL_SERVICE_CONTAINER) 2>&1 | sed 's/^/[EMAIL-SERVICE] /' &
	@docker logs -f $(PUSH_SERVICE_CONTAINER) 2>&1 | sed 's/^/[PUSH-SERVICE] /' &
	@wait

# List containers
ps:
	@echo "Notification System Containers:"
	@docker ps -a --filter "name=notification_" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Health check
health-check:
	@echo "Checking service health..."
	@echo ""
	@echo "Infrastructure Services:"
	@docker ps --filter "name=$(POSTGRES_CONTAINER)" --format "  PostgreSQL: {{.Status}}"
	@docker ps --filter "name=$(RABBITMQ_CONTAINER)" --format "  RabbitMQ:   {{.Status}}"
	@docker ps --filter "name=$(REDIS_CONTAINER)" --format "  Redis:      {{.Status}}"
	@echo ""
	@echo "Application Services:"
	@docker ps --filter "name=$(USER_SERVICE_CONTAINER)" --format "  User Service:  {{.Status}}"
	@docker ps --filter "name=$(EMAIL_SERVICE_CONTAINER)" --format "  Email Service: {{.Status}}"
	@docker ps --filter "name=$(PUSH_SERVICE_CONTAINER)" --format "  Push Service:  {{.Status}}"
	@docker ps --filter "name=$(API_GATEWAY_CONTAINER)" --format "  API Gateway:   {{.Status}}"
	@echo ""
	@echo "Testing endpoints..."
	@curl -s http://localhost:$(PORT)/health >/dev/null && echo "  ✓ API Gateway healthy" || echo "  ✗ API Gateway unhealthy"
	@curl -s http://localhost:$(USER_SERVICE_PORT)/health >/dev/null && echo "  ✓ User Service healthy" || echo "  ✗ User Service unhealthy"
	@curl -s http://localhost:$(PUSH_SERVICE_PORT)/health >/dev/null && echo "  ✓ Push Service healthy" || echo "  ✗ Push Service unhealthy"
