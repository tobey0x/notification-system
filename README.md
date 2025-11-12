# 📧 Email Service Demo

This is the **Email Service** microservice built with **Python + Celery**, designed for the distributed notification system group task.

---

## 🚀 Overview

This service:
- Listens to `email.queue` on **RabbitMQ**
- Sends emails using **Gmail SMTP**
- Supports template variables (e.g. `{{name}}`)
- Includes retry logic, circuit breaker, and `/health` endpoint
- Has CI/CD support via GitHub Actions
- Runs independently inside Docker
