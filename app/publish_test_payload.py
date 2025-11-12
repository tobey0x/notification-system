
import pika
from dotenv import load_dotenv
import os
import json

load_dotenv()
RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
EXCHANGE = os.getenv("EXCHANGE", "notifications.direct")
ROUTING_KEY = os.getenv("ROUTING_KEY", "email")

params = pika.URLParameters(RABBITMQ_URL)
conn = pika.BlockingConnection(params)
ch = conn.channel()
ch.exchange_declare(exchange=EXCHANGE, exchange_type='direct', durable=True)

payload = {
    "notification_id": "test-001",
    "type": "email",
    "user_id": "u-1",
    "payload": {
        "template_id": "welcome.html",
        "to": "inuwahafsah@gmail.com",
        "subject": "Hello from Email Service",
        "variables": {"name": "Hafsah"}
    },
    "timestamp": "2025-11-12T00:00:00Z",
    "retry_count": 2
}

ch.basic_publish(exchange=EXCHANGE, routing_key="email", body=json.dumps(payload), properties=pika.BasicProperties(delivery_mode=2))
print("Published test payload")
conn.close()

from email_sender import send_email

