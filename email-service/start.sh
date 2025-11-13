#!/bin/bash
# Startup script to run both queue consumer and Celery worker

# Start Celery worker in background
celery -A app.tasks worker --loglevel=info -Q email.queue &
CELERY_PID=$!

# Start queue consumer in foreground
python -m app.queue_consumer

# If queue consumer exits, kill Celery worker
kill $CELERY_PID 2>/dev/null
