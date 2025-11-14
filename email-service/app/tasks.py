
# app/tasks.py
import os
import json
import time
import traceback
import smtplib
from celery import Celery, Task
from dotenv import load_dotenv
import pika
import redis
from email.mime.text import MIMEText
from jinja2 import Environment, FileSystemLoader, select_autoescape

load_dotenv()

# Config (reads from .env)
RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
EXCHANGE = os.getenv("EXCHANGE", "notifications.direct")
EMAIL_QUEUE = os.getenv("QUEUE", "email.queue")
DLQ_ROUTING_KEY = os.getenv("DLQ_ROUTING_KEY", "failed")
DLQ_QUEUE = os.getenv("DLQ_QUEUE", "failed.queue")

SMTP_HOST = os.getenv("SMTP_HOST", "mailhog")
SMTP_PORT = int(os.getenv("SMTP_PORT", 1025))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", "noreply@notification-system.local")

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
redis_client = redis.from_url(REDIS_URL, decode_responses=True)

# Jinja2 template loader (templates folder is project_root/templates)
TEMPLATES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates")
jinja_env = Environment(
    loader=FileSystemLoader(TEMPLATES_DIR),
    autoescape=select_autoescape(["html", "xml"])
)

# Celery app (broker)
CELERY_BROKER = os.getenv("CELERY_BROKER_URL", RABBITMQ_URL)
celery_app = Celery("email_service", broker=CELERY_BROKER, backend="rpc://")

# Configure Celery to consume from email.queue
celery_app.conf.update(
    task_routes={
        'send_email_task': {'queue': EMAIL_QUEUE}
    },
    task_default_queue=EMAIL_QUEUE,
    task_default_exchange=EXCHANGE,
    task_default_exchange_type='direct',
    task_default_routing_key='email'
)

# Task base with retry defaults
class EmailTaskWithRetry(Task):
    autoretry_for = (smtplib.SMTPException, Exception)
    # We'll use manual retry in code to control backoff and catch MaxRetriesExceededError
    # But setting sensible defaults:
    default_retry_delay = 30  # seconds
    max_retries = 4
    # acks_late ensures message is acknowledged only after successful run
    ack_late = True

def render_template(template_name, variables):
    tpl = jinja_env.get_template(template_name)
    return tpl.render(**variables or {})

def publish_to_dlq(payload: dict):
    """Publish the failed payload to a DLQ (failed.queue) using pika."""
    try:
        params = pika.URLParameters(RABBITMQ_URL)
        conn = pika.BlockingConnection(params)
        ch = conn.channel()
        # ensure exchange exists
        ch.exchange_declare(exchange=EXCHANGE, exchange_type='direct', durable=True)
        # declare dlq queue (durable)
        ch.queue_declare(queue=DLQ_QUEUE, durable=True)
        # publish to the exchange using the DLQ routing key
        ch.basic_publish(
            exchange=EXCHANGE,
            routing_key=DLQ_ROUTING_KEY,
            body=json.dumps(payload),
            properties=pika.BasicProperties(delivery_mode=2)
        )
        conn.close()
        print("Published message to DLQ:", DLQ_QUEUE)
    except Exception as e:
        print("Failed to publish to DLQ:", e)
        traceback.print_exc()

def update_notification_status(notification_id: str, status: str, error: str = None):
    """Write simple status object to Redis (matches architecture)."""
    try:
        key = f"notification:status:{notification_id}"
        obj = {
            "notification_id": notification_id,
            "status": status,
            "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "error_message": error or ""
        }
        # TTL 7 days (in seconds)
        redis_client.setex(key, 7 * 24 * 3600, json.dumps(obj))
        print("Updated Redis status:", key, status)
    except Exception as e:
        print("Failed to update Redis status:", e)

@celery_app.task(bind=True, name="send_email_task", acks_late=True)
def send_email_task(self, payload: dict):
    """
    payload example:
    {
      "notification_id": "unique-123",
      "type": "email",
      "user_id": "user-456",
      "payload": {
         "template_id": "welcome",
         "to": "user@example.com",
         "subject": "Welcome!",
         "variables": {"name": "John"}
      },
      "priority": "high",
      "timestamp": "...",
      "retry_count": 0
    }
    """
    notification_id = payload.get("notification_id") or payload.get("request_id") or payload.get("messageId") or "unknown"
    try:
        # mark processing
        update_notification_status(notification_id, "processing")

        email_payload = payload.get("payload") or payload
        variables = email_payload.get("variables", {})
        
        # Extract recipient email - check both top level and variables
        to_email = email_payload.get("to") or variables.get("to") or variables.get("user_email")
        subject = email_payload.get("subject") or variables.get("subject") or "No Subject"
        template_name = email_payload.get("template_id") or email_payload.get("template") or "welcome.html"

        # Render template (may raise if template missing)
        html_body = render_template(template_name, variables)

        # Build MIME message
        msg = MIMEText(html_body, "html")
        msg["Subject"] = subject
        msg["From"] = FROM_EMAIL
        msg["To"] = to_email

        # Send via SMTP (Gmail example)
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30) as server:
            # if using TLS port
            try:
                server.starttls()
            except Exception:
                pass
            if SMTP_USER and SMTP_PASS:
                server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(FROM_EMAIL, [to_email], msg.as_string())

        # success
        update_notification_status(notification_id, "sent")
        print(f"[OK] Sent {notification_id} -> {to_email}")
        return {"status": "sent", "notification_id": notification_id}

    except Exception as exc:
        # Use Celery retry mechanism with exponential backoff logic
        try:
            # current retry count
            retries = self.request.retries or 0
            # exponential backoff: 2^retries * base (here base=30s)
            countdown = min(2 ** retries * 30, 600)  # cap at 10m
            print(f"[WARN] Error sending {notification_id}: {exc} — retrying in {countdown}s (attempt {retries+1})")
            raise self.retry(exc=exc, countdown=countdown)
        except self.MaxRetriesExceededError:
            # reached max retries — move to DLQ and mark failed in Redis
            print(f"[ERROR] Max retries exceeded for {notification_id}. Moving to DLQ.")
            update_notification_status(notification_id, "failed", error=str(exc))
            # include original payload + error metadata
            dlq_payload = {
                "failed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "notification_id": notification_id,
                "original_payload": payload,
                "error": str(exc)
            }
            publish_to_dlq(dlq_payload)
            return {"status": "failed", "notification_id": notification_id, "error": str(exc)}

