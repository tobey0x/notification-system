#!/bin/bash
# Startup script for Celery worker
# Celery now consumes directly from RabbitMQ and handles API Gateway message format

# Start Celery worker
exec celery -A app.tasks worker --loglevel=info -Q email.queue
