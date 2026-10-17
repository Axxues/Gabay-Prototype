from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from app.main import app
from app.services.email_service import (
    render_activation_email_html,
    send_activation_email,
)

client = TestClient(app)


def test_render_activation_email_html_contains_branding_and_links():
    html = render_activation_email_html(
        recipient_name="Juan Dela Cruz",
        activation_url="http://localhost:5173/activate?token=test-12345",
    )
    assert "GABAY" in html
    assert "Juan Dela Cruz" in html
    assert "http://localhost:5173/activate?token=test-12345" in html
    assert "Activate Account" in html
    assert "chairperson" in html or "dean" in html


def test_send_activation_email_simulates_when_credentials_not_configured():
    with patch("app.services.email_service.get_settings") as mock_settings:
        mock_settings.return_value.smtp_user = None
        mock_settings.return_value.smtp_password = None

        result = send_activation_email(
            to_email="student@dmmmsu.edu.ph",
            recipient_name="Juan Dela Cruz",
            activation_url="http://localhost:5173/activate?token=test-12345",
        )
        assert result["success"] is True
        assert result.get("simulated") is True


def test_send_activation_email_dispatches_via_smtp():
    with patch("app.services.email_service.get_settings") as mock_settings, \
         patch("smtplib.SMTP_SSL") as mock_smtp_ssl:
        mock_settings.return_value.smtp_host = "smtp.gmail.com"
        mock_settings.return_value.smtp_port = 465
        mock_settings.return_value.smtp_user = "mailer@gmail.com"
        mock_settings.return_value.smtp_password = "apppassword1234"
        mock_settings.return_value.smtp_from = "GABAY LMS <mailer@gmail.com>"

        mock_server = MagicMock()
        mock_smtp_ssl.return_value.__enter__.return_value = mock_server

        result = send_activation_email(
            to_email="student@dmmmsu.edu.ph",
            recipient_name="Juan Dela Cruz",
            activation_url="http://localhost:5173/activate?token=test-12345",
        )

        assert result["success"] is True
        assert result.get("delivered") is True
        mock_server.login.assert_called_once_with("mailer@gmail.com", "apppassword1234")
        mock_server.send_message.assert_called_once()


def test_api_send_activation_email_endpoint_success():
    with patch("app.main.send_activation_email") as mock_send:
        mock_send.return_value = {"success": True, "delivered": True}
        response = client.post(
            "/api/auth/send-activation-email",
            json={
                "email": "student@dmmmsu.edu.ph",
                "recipient_name": "Juan Dela Cruz",
                "activation_url": "http://localhost:5173/activate?token=test-token-xyz",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        mock_send.assert_called_once_with(
            to_email="student@dmmmsu.edu.ph",
            recipient_name="Juan Dela Cruz",
            activation_url="http://localhost:5173/activate?token=test-token-xyz",
        )


def test_api_send_activation_email_rejects_invalid_payload():
    response = client.post(
        "/api/auth/send-activation-email",
        json={"email": "not-an-email"},
    )
    assert response.status_code == 422
