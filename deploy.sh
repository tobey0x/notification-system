#!/bin/bash

# Notification System Deployment Script
# Pure Docker CLI commands (no docker-compose dependency)

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Load environment variables from .env file
if [ -f .env ]; then
    set -a
    source .env
    set +a
else
    echo -e "${RED}Error: .env file not found${NC}"
    echo "Please create .env file from .env.example"
    exit 1
fi

# Variables
NETWORK_NAME="notification_network"
POSTGRES_VOLUME="postgres_data"
RABBITMQ_VOLUME="rabbitmq_data"
REDIS_VOLUME="redis_data"

# Image tags
API_GATEWAY_IMAGE="notification-api-gateway:latest"
USER_SERVICE_IMAGE="notification-user-service:latest"
EMAIL_SERVICE_IMAGE="notification-email-service:latest"
PUSH_SERVICE_IMAGE="notification-push-service:latest"

# Container names
POSTGRES_CONTAINER="notification_postgres"
RABBITMQ_CONTAINER="notification_rabbitmq"
REDIS_CONTAINER="notification_redis"
API_GATEWAY_CONTAINER="notification_api_gateway"
USER_SERVICE_CONTAINER="notification_user_service"
EMAIL_SERVICE_CONTAINER="notification_email_service"
PUSH_SERVICE_CONTAINER="notification_push_service"

# Function to print colored messages
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}$1${NC}"
}

# Function to show help
show_help() {
    cat << EOF
Notification System - Docker Deployment Script

Usage: ./deploy.sh [command]

Commands:
  build                 Build all service images
  network               Create Docker network
  volumes               Create Docker volumes
  start-infrastructure  Start infrastructure services (postgres, rabbitmq, redis)
  start-services        Start application services
  start                 Start all services (infrastructure + services)
  stop                  Stop all containers
  restart               Restart all services
  clean                 Stop and remove all containers, networks, and volumes
  logs                  Show logs for all containers
  ps                    List all containers
  health-check          Check health status of all services
  help                  Show this help message

Individual service commands:
  build-api-gateway     Build API Gateway image
  build-user-service    Build User Service image
  build-email-service   Build Email Service image
  build-push-service    Build Push Service image

Examples:
  ./deploy.sh build     # Build all images
  ./deploy.sh start     # Start all services
  ./deploy.sh stop      # Stop all services
  ./deploy.sh clean     # Remove everything

EOF
}

# Function to create network
create_network() {
    print_info "Creating Docker network..."
    if docker network inspect "$NETWORK_NAME" >/dev/null 2>&1; then
        print_success "Network $NETWORK_NAME already exists"
    else
        docker network create "$NETWORK_NAME"
        print_success "Network $NETWORK_NAME created"
    fi
}

# Function to create volumes
create_volumes() {
    print_info "Creating Docker volumes..."
    
    for volume in "$POSTGRES_VOLUME" "$RABBITMQ_VOLUME" "$REDIS_VOLUME"; do
        if docker volume inspect "$volume" >/dev/null 2>&1; then
            echo "  Volume $volume already exists"
        else
            docker volume create "$volume"
            echo "  Created volume $volume"
        fi
    done
    
    print_success "Volumes ready"
}

# Function to build API Gateway
build_api_gateway() {
    print_info "Building API Gateway..."
    cd api-gateway && docker build -t "$API_GATEWAY_IMAGE" -f DockerFile . && cd ..
    print_success "API Gateway image built"
}

# Function to build User Service
build_user_service() {
    print_info "Building User Service..."
    cd user-service-hng && docker build -t "$USER_SERVICE_IMAGE" . && cd ..
    print_success "User Service image built"
}

# Function to build Email Service
build_email_service() {
    print_info "Building Email Service..."
    cd email-service && docker build -t "$EMAIL_SERVICE_IMAGE" . && cd ..
    print_success "Email Service image built"
}

# Function to build Push Service
build_push_service() {
    print_info "Building Push Service..."
    cd push-service && docker build -t "$PUSH_SERVICE_IMAGE" . && cd ..
    print_success "Push Service image built"
}

# Function to build all images
build_all() {
    build_api_gateway
    build_user_service
    build_email_service
    build_push_service
    print_success "All images built successfully"
}

# Function to start PostgreSQL
start_postgres() {
    create_network
    create_volumes
    
    print_info "Starting PostgreSQL..."
    
    if docker ps -a --format '{{.Names}}' | grep -q "^${POSTGRES_CONTAINER}$"; then
        if docker start "$POSTGRES_CONTAINER" 2>/dev/null; then
            print_success "PostgreSQL started (existing container)"
            return
        else
            docker rm -f "$POSTGRES_CONTAINER" 2>/dev/null || true
        fi
    fi
    
    docker run -d \
        --name "$POSTGRES_CONTAINER" \
        --network "$NETWORK_NAME" \
        -v "${POSTGRES_VOLUME}:/var/lib/postgresql/data" \
        -e POSTGRES_USER="$POSTGRES_USER" \
        -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
        -e POSTGRES_DB="$POSTGRES_DB" \
        -p 5432:5432 \
        --restart unless-stopped \
        --health-cmd="pg_isready -U $POSTGRES_USER" \
        --health-interval=10s \
        --health-timeout=5s \
        --health-retries=5 \
        postgres:15-alpine
    
    print_success "PostgreSQL started"
}

# Function to start RabbitMQ
start_rabbitmq() {
    create_network
    create_volumes
    
    print_info "Starting RabbitMQ..."
    
    if docker ps -a --format '{{.Names}}' | grep -q "^${RABBITMQ_CONTAINER}$"; then
        if docker start "$RABBITMQ_CONTAINER" 2>/dev/null; then
            print_success "RabbitMQ started (existing container)"
            return
        else
            docker rm -f "$RABBITMQ_CONTAINER" 2>/dev/null || true
        fi
    fi
    
    docker run -d \
        --name "$RABBITMQ_CONTAINER" \
        --network "$NETWORK_NAME" \
        -v "${RABBITMQ_VOLUME}:/var/lib/rabbitmq" \
        -e RABBITMQ_DEFAULT_USER="$RABBITMQ_DEFAULT_USER" \
        -e RABBITMQ_DEFAULT_PASS="$RABBITMQ_DEFAULT_PASS" \
        -p 5672:5672 \
        -p 15672:15672 \
        --restart unless-stopped \
        --health-cmd="rabbitmq-diagnostics -q ping" \
        --health-interval=10s \
        --health-timeout=5s \
        --health-retries=5 \
        rabbitmq:3.12-management
    
    print_success "RabbitMQ started"
}

# Function to start Redis
start_redis() {
    create_network
    create_volumes
    
    print_info "Starting Redis..."
    
    if docker ps -a --format '{{.Names}}' | grep -q "^${REDIS_CONTAINER}$"; then
        if docker start "$REDIS_CONTAINER" 2>/dev/null; then
            print_success "Redis started (existing container)"
            return
        else
            docker rm -f "$REDIS_CONTAINER" 2>/dev/null || true
        fi
    fi
    
    docker run -d \
        --name "$REDIS_CONTAINER" \
        --network "$NETWORK_NAME" \
        -v "${REDIS_VOLUME}:/data" \
        -p 6379:6379 \
        --restart unless-stopped \
        --health-cmd="redis-cli ping" \
        --health-interval=10s \
        --health-timeout=5s \
        --health-retries=5 \
        redis:7-alpine
    
    print_success "Redis started"
}

# Function to start infrastructure
start_infrastructure() {
    start_postgres
    start_rabbitmq
    start_redis
    
    print_info "Waiting for infrastructure to be healthy..."
    sleep 5
    print_success "All infrastructure services started"
}

# Function to start User Service
start_user_service() {
    create_network
    
    print_info "Starting User Service..."
    
    if docker ps -a --format '{{.Names}}' | grep -q "^${USER_SERVICE_CONTAINER}$"; then
        if docker start "$USER_SERVICE_CONTAINER" 2>/dev/null; then
            print_success "User Service started (existing container)"
            return
        else
            docker rm -f "$USER_SERVICE_CONTAINER" 2>/dev/null || true
        fi
    fi
    
    docker run -d \
        --name "$USER_SERVICE_CONTAINER" \
        --network "$NETWORK_NAME" \
        -e DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_CONTAINER}:5432/${POSTGRES_DB}?schema=public" \
        -e ACCESS_SECRET="$ACCESS_SECRET" \
        -e REFRESH_SECRET="$REFRESH_SECRET" \
        -e PORT="$USER_SERVICE_PORT" \
        -p "${USER_SERVICE_PORT}:${USER_SERVICE_PORT}" \
        --restart unless-stopped \
        "$USER_SERVICE_IMAGE"
    
    print_success "User Service started"
}

# Function to start Email Service
start_email_service() {
    create_network
    
    print_info "Starting Email Service..."
    
    if docker ps -a --format '{{.Names}}' | grep -q "^${EMAIL_SERVICE_CONTAINER}$"; then
        if docker start "$EMAIL_SERVICE_CONTAINER" 2>/dev/null; then
            print_success "Email Service started (existing container)"
            return
        else
            docker rm -f "$EMAIL_SERVICE_CONTAINER" 2>/dev/null || true
        fi
    fi
    
    docker run -d \
        --name "$EMAIL_SERVICE_CONTAINER" \
        --network "$NETWORK_NAME" \
        -e RABBITMQ_HOST="$RABBITMQ_CONTAINER" \
        -e RABBITMQ_PORT=5672 \
        -e RABBITMQ_USER="$RABBITMQ_DEFAULT_USER" \
        -e RABBITMQ_PASSWORD="$RABBITMQ_DEFAULT_PASS" \
        -e CELERY_BROKER_URL="amqp://${RABBITMQ_DEFAULT_USER}:${RABBITMQ_DEFAULT_PASS}@${RABBITMQ_CONTAINER}:5672//" \
        -e CELERY_RESULT_BACKEND="redis://${REDIS_CONTAINER}:6379/0" \
        -e SMTP_HOST="$SMTP_HOST" \
        -e SMTP_PORT="$SMTP_PORT" \
        -e SMTP_USER="$SMTP_USER" \
        -e SMTP_PASS="$SMTP_PASS" \
        -e FROM_EMAIL="$FROM_EMAIL" \
        --restart unless-stopped \
        "$EMAIL_SERVICE_IMAGE"
    
    print_success "Email Service started"
}

# Function to start Push Service
start_push_service() {
    create_network
    
    print_info "Starting Push Service..."
    
    if docker ps -a --format '{{.Names}}' | grep -q "^${PUSH_SERVICE_CONTAINER}$"; then
        if docker start "$PUSH_SERVICE_CONTAINER" 2>/dev/null; then
            print_success "Push Service started (existing container)"
            return
        else
            docker rm -f "$PUSH_SERVICE_CONTAINER" 2>/dev/null || true
        fi
    fi
    
    docker run -d \
        --name "$PUSH_SERVICE_CONTAINER" \
        --network "$NETWORK_NAME" \
        -e RABBITMQ_URL="amqp://${RABBITMQ_DEFAULT_USER}:${RABBITMQ_DEFAULT_PASS}@${RABBITMQ_CONTAINER}:5672" \
        -e FIREBASE_PROJECT_ID="$FIREBASE_PROJECT_ID" \
        -e FIREBASE_PRIVATE_KEY="$FIREBASE_PRIVATE_KEY" \
        -e FIREBASE_CLIENT_EMAIL="$FIREBASE_CLIENT_EMAIL" \
        -e PORT="$PUSH_SERVICE_PORT" \
        -p "${PUSH_SERVICE_PORT}:${PUSH_SERVICE_PORT}" \
        --restart unless-stopped \
        "$PUSH_SERVICE_IMAGE"
    
    print_success "Push Service started"
}

# Function to start API Gateway
start_api_gateway() {
    create_network
    
    print_info "Starting API Gateway..."
    
    if docker ps -a --format '{{.Names}}' | grep -q "^${API_GATEWAY_CONTAINER}$"; then
        if docker start "$API_GATEWAY_CONTAINER" 2>/dev/null; then
            print_success "API Gateway started (existing container)"
            return
        else
            docker rm -f "$API_GATEWAY_CONTAINER" 2>/dev/null || true
        fi
    fi
    
    docker run -d \
        --name "$API_GATEWAY_CONTAINER" \
        --network "$NETWORK_NAME" \
        -e PORT="$PORT" \
        -e USER_SERVICE_URL="http://${USER_SERVICE_CONTAINER}:${USER_SERVICE_PORT}" \
        -e RABBITMQ_URL="$RABBITMQ_URL" \
        -e REDIS_URL="$REDIS_URL" \
        -e ACCESS_SECRET="$ACCESS_SECRET" \
        -e JWT_SECRET="$JWT_SECRET" \
        -p "${PORT}:${PORT}" \
        --restart unless-stopped \
        "$API_GATEWAY_IMAGE"
    
    print_success "API Gateway started"
}

# Function to start all application services
start_services() {
    start_user_service
    start_email_service
    start_push_service
    start_api_gateway
    print_success "All application services started"
}

# Function to start everything
start_all() {
    start_infrastructure
    start_services
    
    echo ""
    echo "========================================"
    echo "  Notification System Started"
    echo "========================================"
    echo "API Gateway:         http://localhost:${PORT}"
    echo "User Service:        http://localhost:${USER_SERVICE_PORT}"
    echo "Push Service:        http://localhost:${PUSH_SERVICE_PORT}"
    echo "RabbitMQ Management: http://localhost:15672"
    echo "========================================"
}

# Function to stop all containers
stop_all() {
    print_info "Stopping all containers..."
    
    for container in "$API_GATEWAY_CONTAINER" "$USER_SERVICE_CONTAINER" "$EMAIL_SERVICE_CONTAINER" \
                     "$PUSH_SERVICE_CONTAINER" "$POSTGRES_CONTAINER" "$RABBITMQ_CONTAINER" "$REDIS_CONTAINER"; do
        if docker stop "$container" 2>/dev/null; then
            echo "  Stopped $container"
        fi
    done
    
    print_success "All containers stopped"
}

# Function to clean everything
clean_all() {
    print_info "Cleaning up..."
    
    # Remove containers
    for container in "$API_GATEWAY_CONTAINER" "$USER_SERVICE_CONTAINER" "$EMAIL_SERVICE_CONTAINER" \
                     "$PUSH_SERVICE_CONTAINER" "$POSTGRES_CONTAINER" "$RABBITMQ_CONTAINER" "$REDIS_CONTAINER"; do
        docker rm -f "$container" 2>/dev/null && echo "  Removed $container" || true
    done
    
    # Remove network
    docker network rm "$NETWORK_NAME" 2>/dev/null && echo "  Removed network $NETWORK_NAME" || true
    
    # Remove volumes
    for volume in "$POSTGRES_VOLUME" "$RABBITMQ_VOLUME" "$REDIS_VOLUME"; do
        docker volume rm "$volume" 2>/dev/null && echo "  Removed volume $volume" || true
    done
    
    print_success "Cleanup complete"
}

# Function to show logs
show_logs() {
    print_info "Showing logs for all containers (Ctrl+C to stop)..."
    
    docker logs -f "$API_GATEWAY_CONTAINER" 2>&1 | sed 's/^/[API-GATEWAY] /' &
    docker logs -f "$USER_SERVICE_CONTAINER" 2>&1 | sed 's/^/[USER-SERVICE] /' &
    docker logs -f "$EMAIL_SERVICE_CONTAINER" 2>&1 | sed 's/^/[EMAIL-SERVICE] /' &
    docker logs -f "$PUSH_SERVICE_CONTAINER" 2>&1 | sed 's/^/[PUSH-SERVICE] /' &
    
    wait
}

# Function to list containers
list_containers() {
    echo "Notification System Containers:"
    docker ps -a --filter "name=notification_" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
}

# Function to check health
health_check() {
    echo "Checking service health..."
    echo ""
    echo "Infrastructure Services:"
    docker ps --filter "name=${POSTGRES_CONTAINER}" --format "  PostgreSQL: {{.Status}}"
    docker ps --filter "name=${RABBITMQ_CONTAINER}" --format "  RabbitMQ:   {{.Status}}"
    docker ps --filter "name=${REDIS_CONTAINER}" --format "  Redis:      {{.Status}}"
    echo ""
    echo "Application Services:"
    docker ps --filter "name=${USER_SERVICE_CONTAINER}" --format "  User Service:  {{.Status}}"
    docker ps --filter "name=${EMAIL_SERVICE_CONTAINER}" --format "  Email Service: {{.Status}}"
    docker ps --filter "name=${PUSH_SERVICE_CONTAINER}" --format "  Push Service:  {{.Status}}"
    docker ps --filter "name=${API_GATEWAY_CONTAINER}" --format "  API Gateway:   {{.Status}}"
    echo ""
    echo "Testing endpoints..."
    
    if curl -s "http://localhost:${PORT}/health" >/dev/null 2>&1; then
        print_success "API Gateway healthy"
    else
        print_error "API Gateway unhealthy"
    fi
    
    if curl -s "http://localhost:${USER_SERVICE_PORT}/health" >/dev/null 2>&1; then
        print_success "User Service healthy"
    else
        print_error "User Service unhealthy"
    fi
    
    if curl -s "http://localhost:${PUSH_SERVICE_PORT}/health" >/dev/null 2>&1; then
        print_success "Push Service healthy"
    else
        print_error "Push Service unhealthy"
    fi
}

# Main script logic
case "${1:-}" in
    build)
        build_all
        ;;
    build-api-gateway)
        build_api_gateway
        ;;
    build-user-service)
        build_user_service
        ;;
    build-email-service)
        build_email_service
        ;;
    build-push-service)
        build_push_service
        ;;
    network)
        create_network
        ;;
    volumes)
        create_volumes
        ;;
    start-infrastructure)
        start_infrastructure
        ;;
    start-services)
        start_services
        ;;
    start)
        start_all
        ;;
    stop)
        stop_all
        ;;
    restart)
        stop_all
        sleep 2
        start_all
        ;;
    clean)
        clean_all
        ;;
    logs)
        show_logs
        ;;
    ps)
        list_containers
        ;;
    health-check)
        health_check
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}Error: Unknown command '${1:-}'${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac
