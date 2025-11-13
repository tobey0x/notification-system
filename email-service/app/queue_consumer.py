"""
RabbitMQ Consumer Bridge
Consumes raw JSON messages from email.queue and converts them to Celery tasks.
This bridges the gap between API Gateway's raw JSON publishing and Celery's task format.
"""
import pika
import json
import os
import time
import signal
import sys
from dotenv import load_dotenv
from app.tasks import send_email_task

load_dotenv()

RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
QUEUE_NAME = os.getenv("EMAIL_QUEUE", "email.queue")

# Graceful shutdown
shutdown_requested = False

def signal_handler(sig, frame):
    global shutdown_requested
    print("\n[INFO] Shutdown signal received, finishing current messages...")
    shutdown_requested = True

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

def callback(ch, method, properties, body):
    """Process incoming messages and invoke Celery task"""
    try:
        message = json.loads(body.decode())
        print(f"[INFO] Received message: {message.get('notification_id', 'unknown')}")
        
        # Transform API Gateway format to Celery task format
        # API Gateway sends: {notification_id, type, user_id, template_id, variables, ...}
        # Celery task expects nested payload structure
        
        celery_payload = {
            "notification_id": message.get("notification_id"),
            "type": message.get("type"),
            "user_id": message.get("user_id"),
            "payload": {
                "template_id": message.get("template_id", "welcome.html"),
                "to": message.get("to") or message.get("variables", {}).get("email") or "default@example.com",
                "subject": message.get("subject", "Notification"),
                "variables": message.get("variables", {})
            },
            "priority": message.get("priority", "normal"),
            "timestamp": message.get("metadata", {}).get("timestamp") or message.get("timestamp"),
            "retry_count": message.get("retry_count", 0)
        }
        
        # Invoke Celery task asynchronously
        send_email_task.apply_async(args=[celery_payload], retry=False)
        
        # Acknowledge message
        ch.basic_ack(delivery_tag=method.delivery_tag)
        print(f"[OK] Queued Celery task for {celery_payload['notification_id']}")
        
    except Exception as e:
        print(f"[ERROR] Failed to process message: {e}")
        # Negative ack - requeue the message
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)

def main():
    """Start consuming messages from RabbitMQ"""
    while not shutdown_requested:
        try:
            print(f"[INFO] Connecting to RabbitMQ: {RABBITMQ_URL}")
            params = pika.URLParameters(RABBITMQ_URL)
            connection = pika.BlockingConnection(params)
            channel = connection.channel()
            
            # Ensure queue exists
            channel.queue_declare(queue=QUEUE_NAME, durable=True)
            channel.basic_qos(prefetch_count=10)
            
            print(f"[INFO] Waiting for messages on queue: {QUEUE_NAME}")
            channel.basic_consume(queue=QUEUE_NAME, on_message_callback=callback, auto_ack=False)
            
            # Start consuming (blocks until shutdown or connection error)
            while not shutdown_requested and channel._consumer_infos:
                connection.process_data_events(time_limit=1)
            
            print("[INFO] Closing connection...")
            connection.close()
            break
            
        except pika.exceptions.AMQPConnectionError as e:
            if not shutdown_requested:
                print(f"[WARN] Connection lost: {e}. Reconnecting in 5s...")
                time.sleep(5)
        except Exception as e:
            print(f"[ERROR] Unexpected error: {e}")
            if not shutdown_requested:
                time.sleep(5)
    
    print("[INFO] Consumer stopped gracefully")
    sys.exit(0)

if __name__ == "__main__":
    main()
