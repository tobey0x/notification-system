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

# Copy startup script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Default command (start both queue consumer and Celery worker)
CMD ["/app/start.sh"]
