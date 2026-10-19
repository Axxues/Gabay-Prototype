"""Email dispatch service for GABAY LMS user registration and account activation."""

import html
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Dict

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def render_activation_email_html(recipient_name: str, activation_url: str) -> str:
    """Generate a clean, responsive, and stylish HTML email template for account activation."""
    safe_name = html.escape(recipient_name or "Student / Faculty")
    safe_url = html.escape(activation_url)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Activate Your GABAY Account</title>
  <style>
    body {{
      margin: 0;
      padding: 0;
      background-color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      -webkit-font-smoothing: antialiased;
    }}
    .wrapper {{
      width: 100%;
      table-layout: fixed;
      background-color: #f1f5f9;
      padding: 40px 16px;
    }}
    .container {{
      max-width: 580px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.05);
    }}
    .header {{
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      padding: 36px 32px 28px;
      text-align: center;
      color: #ffffff;
    }}
    .logo-badge {{
      display: inline-block;
      font-size: 26px;
      font-weight: 900;
      letter-spacing: 2px;
      color: #10b981;
      text-transform: uppercase;
      margin-bottom: 6px;
    }}
    .header-subtitle {{
      font-size: 13px;
      color: #94a3b8;
      margin: 0;
      letter-spacing: 0.5px;
    }}
    .content {{
      padding: 36px 32px;
    }}
    h1 {{
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 0;
      margin-bottom: 16px;
    }}
    p {{
      font-size: 14px;
      line-height: 1.6;
      color: #475569;
      margin: 0 0 16px;
    }}
    .btn-container {{
      text-align: center;
      margin: 32px 0;
    }}
    .btn {{
      display: inline-block;
      background-color: #0f172a;
      color: #ffffff !important;
      font-weight: 700;
      font-size: 14px;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 10px;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);
    }}
    .steps-box {{
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px;
      margin: 28px 0;
    }}
    .steps-title {{
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
    }}
    .step-item {{
      font-size: 13px;
      color: #475569;
      margin-bottom: 8px;
      padding-left: 20px;
      position: relative;
    }}
    .step-item:last-child {{
      margin-bottom: 0;
    }}
    .step-num {{
      position: absolute;
      left: 0;
      font-weight: 700;
      color: #10b981;
    }}
    .url-fallback {{
      font-size: 11px;
      color: #94a3b8;
      word-break: break-all;
      background-color: #f8fafc;
      padding: 10px 14px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }}
    .footer {{
      border-top: 1px solid #e2e8f0;
      padding: 24px 32px;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
      background-color: #f8fafc;
    }}
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div class="logo-badge">GABAY</div>
        <div class="header-subtitle">Institutional Learning Management System</div>
      </div>
      <div class="content">
        <h1>Welcome to GABAY, {safe_name}!</h1>
        <p>Thank you for submitting your account registration. To verify your institutional email address and continue with the account setup, please click the button below:</p>
        
        <div class="btn-container">
          <a href="{safe_url}" class="btn" target="_blank">Activate Account</a>
        </div>

        <div class="steps-box">
          <div class="steps-title">What happens next?</div>
          <div class="step-item"><span class="step-num">1.</span> Click the activation button above to verify your email.</div>
          <div class="step-item"><span class="step-num">2.</span> Your application will be forwarded to your department chairperson or college dean for review.</div>
          <div class="step-item"><span class="step-num">3.</span> Once approved, your institutional account will be unlocked and ready for sign in.</div>
        </div>

        <p style="font-size: 12px; color: #64748b;">If the button above does not work, copy and paste this verification URL into your web browser:</p>
        <div class="url-fallback">{safe_url}</div>

        <p style="font-size: 12px; color: #94a3b8; margin-top: 24px; margin-bottom: 0;">
          This activation link is valid for 30 days. If you did not submit this registration, please disregard this email.
        </p>
      </div>
      <div class="footer">
        &copy; GABAY LMS &bull; Don Mariano Marcos Memorial State University<br>
        Automated Institutional Notification &bull; Please do not reply to this email
      </div>
    </div>
  </div>
</body>
</html>"""


def send_activation_email(
    to_email: str,
    recipient_name: str,
    activation_url: str,
) -> Dict[str, Any]:
    """Send an account activation email using SMTP credentials, or simulate if unconfigured."""
    settings = get_settings()

    # If SMTP is not yet configured, gracefully simulate
    if not settings.smtp_user or not settings.smtp_password:
        logger.info(
            "SMTP credentials not configured in .env. Simulating activation email dispatch to %s (URL: %s)",
            to_email,
            activation_url,
        )
        return {
            "success": True,
            "delivered": False,
            "simulated": True,
            "recipient": to_email,
            "message": "Activation email simulated (SMTP credentials not yet configured).",
        }

    html_content = render_activation_email_html(
        recipient_name=recipient_name,
        activation_url=activation_url,
    )
    plain_content = (
        f"Hello {recipient_name},\n\n"
        f"Thank you for registering for GABAY LMS. Please verify your email by opening the activation link below:\n\n"
        f"{activation_url}\n\n"
        f"After verification, your account application will be reviewed by your department chairperson or college dean.\n\n"
        f"GABAY Institutional LMS"
    )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Activate Your GABAY Account"
    msg["From"] = settings.smtp_from or settings.smtp_user
    msg["To"] = to_email

    msg.attach(MIMEText(plain_content, "plain", "utf-8"))
    msg.attach(MIMEText(html_content, "html", "utf-8"))

    try:
        host = settings.smtp_host or "smtp.gmail.com"
        port = settings.smtp_port or 465

        if port == 465:
            with smtplib.SMTP_SSL(host, port, timeout=15) as server:
                server.login(settings.smtp_user, settings.smtp_password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=15) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(settings.smtp_user, settings.smtp_password)
                server.send_message(msg)

        logger.info("Successfully sent activation email to %s", to_email)
        return {
            "success": True,
            "delivered": True,
            "recipient": to_email,
            "message": "Activation email dispatched successfully.",
        }
    except Exception as exc:
        logger.error("Failed to send activation email to %s: %s", to_email, exc, exc_info=True)
        return {
            "success": False,
            "delivered": False,
            "error": str(exc),
            "recipient": to_email,
            "message": f"Failed to deliver activation email: {exc}",
        }


def render_leadership_code_email_html(
    recipient_name: str,
    code: str,
    role_type: str,
    unit_name: str,
) -> str:
    """Generate HTML email template for 6-digit leadership appointment verification."""
    safe_name = html.escape(recipient_name or "Academic Leader")
    safe_code = html.escape(code)
    role_label = "College Dean" if role_type == "dean" else "Department Chairperson"
    safe_unit = html.escape(unit_name or "Assigned Academic Unit")

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GABAY Leadership Appointment Verification</title>
  <style>
    body {{
      margin: 0;
      padding: 0;
      background-color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      -webkit-font-smoothing: antialiased;
    }}
    .wrapper {{
      width: 100%;
      table-layout: fixed;
      background-color: #f1f5f9;
      padding: 40px 16px;
    }}
    .container {{
      max-width: 580px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.05);
    }}
    .header {{
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      padding: 36px 32px 28px;
      text-align: center;
      color: #ffffff;
    }}
    .logo-badge {{
      display: inline-block;
      font-size: 26px;
      font-weight: 900;
      letter-spacing: 2px;
      color: #10b981;
      text-transform: uppercase;
      margin-bottom: 6px;
    }}
    .header-subtitle {{
      font-size: 13px;
      color: #94a3b8;
      margin: 0;
      letter-spacing: 0.5px;
    }}
    .content {{
      padding: 36px 32px;
    }}
    h1 {{
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 0;
      margin-bottom: 16px;
    }}
    p {{
      font-size: 14px;
      line-height: 1.6;
      color: #475569;
      margin: 0 0 16px;
    }}
    .code-box {{
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      border-radius: 14px;
      padding: 24px;
      text-align: center;
      margin: 28px 0;
      box-shadow: 0 4px 14px rgba(15, 23, 42, 0.15);
    }}
    .code-label {{
      font-size: 11px;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 8px;
    }}
    .code-number {{
      font-size: 34px;
      font-weight: 900;
      color: #10b981;
      letter-spacing: 8px;
      font-family: monospace, monospace;
    }}
    .unit-tag {{
      display: inline-block;
      background-color: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 4px 10px;
      font-weight: 600;
      font-size: 12px;
      color: #0f172a;
    }}
    .notice-box {{
      background-color: #f8fafc;
      border-left: 4px solid #10b981;
      border-radius: 8px;
      padding: 14px 18px;
      margin: 20px 0;
      font-size: 13px;
      color: #334155;
    }}
    .footer {{
      border-top: 1px solid #e2e8f0;
      padding: 24px 32px;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
      background-color: #f8fafc;
    }}
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div class="logo-badge">GABAY</div>
        <div class="header-subtitle">Institutional Academic Administration</div>
      </div>
      <div class="content">
        <h1>Leadership Account Verification</h1>
        <p>Dear {safe_name},</p>
        <p>
          An appointment for the position of <strong>{role_label}</strong> for 
          <span class="unit-tag">{safe_unit}</span> has been initiated in GABAY LMS.
        </p>
        <p>
          To complete your leadership account setup and finalize your institutional appointment, please provide the 6-digit verification code below to the University Administrator:
        </p>

        <div class="code-box">
          <div class="code-label">Verification Code</div>
          <div class="code-number">{safe_code}</div>
        </div>

        <div class="notice-box">
          <strong>Security Notice:</strong> This 6-digit verification code expires in 15 minutes. The Administrator must enter this code on the leadership provisioning portal to verify and activate your administrative credentials.
        </div>

        <p style="font-size: 12px; color: #94a3b8; margin-top: 24px; margin-bottom: 0;">
          If you are not expecting this appointment, please contact the University ICT or Administration Office immediately.
        </p>
      </div>
      <div class="footer">
        &copy; GABAY LMS &bull; Don Mariano Marcos Memorial State University<br>
        Automated Institutional Notification &bull; Please do not reply to this email
      </div>
    </div>
  </div>
</body>
</html>"""


def send_leadership_code_email(
    to_email: str,
    recipient_name: str,
    code: str,
    role_type: str = "dean",
    unit_name: str = "",
) -> Dict[str, Any]:
    """Send 6-digit leadership verification code email via SMTP or simulate if unconfigured."""
    settings = get_settings()

    if not settings.smtp_user or not settings.smtp_password:
        logger.info(
            "SMTP credentials not configured. Simulating leadership verification code dispatch to %s (Code: %s, Role: %s, Unit: %s)",
            to_email,
            code,
            role_type,
            unit_name,
        )
        return {
            "success": True,
            "delivered": False,
            "simulated": True,
            "recipient": to_email,
            "code": code,
            "message": "Leadership verification code email simulated (SMTP credentials not configured).",
        }

    html_content = render_leadership_code_email_html(
        recipient_name=recipient_name,
        code=code,
        role_type=role_type,
        unit_name=unit_name,
    )
    role_label = "College Dean" if role_type == "dean" else "Department Chairperson"
    plain_content = (
        f"Dear {recipient_name},\n\n"
        f"An appointment for {role_label} of {unit_name} has been initiated in GABAY LMS.\n\n"
        f"Your 6-Digit Verification Code: {code}\n\n"
        f"Please provide this code to the Administrator to verify and complete your leadership appointment.\n"
        f"This code will expire in 15 minutes.\n\n"
        f"GABAY Institutional LMS"
    )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"GABAY Leadership Appointment Verification: {code}"
    msg["From"] = settings.smtp_from or settings.smtp_user
    msg["To"] = to_email

    msg.attach(MIMEText(plain_content, "plain", "utf-8"))
    msg.attach(MIMEText(html_content, "html", "utf-8"))

    try:
        host = settings.smtp_host or "smtp.gmail.com"
        port = settings.smtp_port or 465

        if port == 465:
            with smtplib.SMTP_SSL(host, port, timeout=15) as server:
                server.login(settings.smtp_user, settings.smtp_password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=15) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(settings.smtp_user, settings.smtp_password)
                server.send_message(msg)

        logger.info("Successfully sent leadership verification code to %s", to_email)
        return {
            "success": True,
            "delivered": True,
            "recipient": to_email,
            "code": code,
            "message": "Leadership verification code dispatched successfully.",
        }
    except Exception as exc:
        logger.error("Failed to send leadership verification email to %s: %s", to_email, exc, exc_info=True)
        return {
            "success": False,
            "delivered": False,
            "error": str(exc),
            "recipient": to_email,
            "code": code,
            "message": f"Failed to deliver leadership verification email: {exc}",
        }

