FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Copy dependencies and install them
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all project files
COPY . .

# Environment variables
ENV PYTHONUNBUFFERED=1

# Expose port for health check
EXPOSE 8000

# Default command (start Celery worker with explicit queue)
CMD ["celery", "-A", "app.tasks", "worker", "--loglevel=info", "-Q", "email.queue"]
