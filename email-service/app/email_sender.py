import smtplib
from email.mime.text import MIMEText
from jinja2 import Template
import os
import os
from dotenv import load_dotenv
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Load environment variables
load_dotenv()

EMAIL_HOST = os.getenv("EMAIL_HOST")
EMAIL_PORT = int(os.getenv("EMAIL_PORT"))
EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS") == "True"
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD")

def send_email(to_email, subject, html_content):
    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = EMAIL_HOST_USER
        msg["To"] = to_email
        msg["Subject"] = subject

        msg.attach(MIMEText(html_content, "html"))

        with smtplib.SMTP(EMAIL_HOST, EMAIL_PORT) as server:
            if EMAIL_USE_TLS:
                server.starttls()
            server.login(EMAIL_HOST_USER, EMAIL_HOST_PASSWORD)
            server.send_message(msg)

        print(f"✅ Email sent successfully to {to_email}")
        return True
    except Exception as e:
        print(f"❌ Failed to send email: {e}")
        return False


SMTP_HOST = os.getenv("SMTP_HOST", "localhost")
SMTP_PORT = int(os.getenv("SMTP_PORT", 1025))
FROM_EMAIL = os.getenv("FROM_EMAIL", "no-reply@example.com")

def send_email(to_email, subject, template_path, variables):
    # Load template
    with open(template_path) as f:
        content = f.read()
    body = Template(content).render(**variables)

    # Prepare email
    msg = MIMEText(body, "html")
    msg["Subject"] = subject
    msg["From"] = FROM_EMAIL
    msg["To"] = to_email

    # Send via SMTP
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.sendmail(FROM_EMAIL, [to_email], msg.as_string())
        print(f"Email sent to {to_email}")
