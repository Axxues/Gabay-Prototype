from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from app.main import app
from app.services.email_service import (
    render_activation_email_html,
    send_activation_email,
    render_course_invitation_email_html,
    send_course_invitation_email,
)

client = TestClient(app, headers={"X-Gabay-Client-Key": "test-client-key"})


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


from app.services.email_service import (
    render_leadership_code_email_html,
    send_leadership_code_email,
)


def test_render_leadership_code_email_html_contains_branding_and_code():
    html = render_leadership_code_email_html(
        recipient_name="Dr. Maria Santos",
        code="784921",
        role_type="dean",
        unit_name="College of Computer Science",
    )
    assert "GABAY" in html
    assert "Dr. Maria Santos" in html
    assert "784921" in html
    assert "College Dean" in html
    assert "College of Computer Science" in html


def test_send_leadership_code_email_simulates_when_unconfigured():
    with patch("app.services.email_service.get_settings") as mock_settings:
        mock_settings.return_value.smtp_user = None
        mock_settings.return_value.smtp_password = None

        result = send_leadership_code_email(
            to_email="dean@dmmmsu.edu.ph",
            recipient_name="Dr. Maria Santos",
            code="123456",
            role_type="dean",
            unit_name="College of Computer Science",
        )
        assert result["success"] is True
        assert result.get("simulated") is True
        assert result.get("code") == "123456"


def test_api_send_leadership_code_endpoint_success():
    with patch("app.main.send_leadership_code_email") as mock_send:
        mock_send.return_value = {"success": True, "delivered": True}
        response = client.post(
            "/api/auth/send-leadership-code",
            json={
                "email": "chair@dmmmsu.edu.ph",
                "recipient_name": "Prof. Alan Turing",
                "role_type": "chairperson",
                "unit_name": "Department of Computer Science",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert mock_send.called
        call_kwargs = mock_send.call_args[1]
        assert call_kwargs["to_email"] == "chair@dmmmsu.edu.ph"
        assert len(call_kwargs["code"]) == 6


def test_render_course_invitation_email_html():
    html_output = render_course_invitation_email_html(
        recipient_name="Maria Santos",
        instructor_name="Prof. Alan Turing",
        course_code="CS 311",
        course_title="Software Engineering",
        section="BSCS 3A",
        term="1st Sem 2026-2027",
        join_url="https://gabay.dmmmsu.edu.ph/?action=join&courseId=c1&requestId=req-1",
    )
    assert "Maria Santos" in html_output
    assert "Prof. Alan Turing" in html_output
    assert "CS 311" in html_output
    assert "Software Engineering" in html_output
    assert "BSCS 3A" in html_output
    assert "JOIN CLASS" in html_output
    assert "action=join" in html_output


def test_send_course_invitation_email_simulates_when_unconfigured():
    with patch("app.services.email_service.get_settings") as mock_settings:
        mock_settings.return_value.smtp_user = ""
        mock_settings.return_value.smtp_password = ""
        res = send_course_invitation_email(
            to_email="student@dmmmsu.edu.ph",
            recipient_name="Maria Santos",
            instructor_name="Prof. Turing",
            course_code="CS 311",
            course_title="Software Engineering",
            section="3A",
            term="1st Sem",
            join_url="http://localhost:5173/?action=join&courseId=c1&requestId=req-1",
        )
        assert res["success"] is True
        assert res["simulated"] is True
        assert res["recipient"] == "student@dmmmsu.edu.ph"


