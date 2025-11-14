#!/bin/bash
# Startup script for email service
# API Gateway now publishes in Celery task format, so we only need Celery worker

# Start Celery worker
exec celery -A app.tasks worker --loglevel=info -Q email.queue
