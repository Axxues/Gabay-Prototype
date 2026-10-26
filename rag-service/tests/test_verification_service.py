"""Tests for leadership code verification service."""

import time
import pytest
from app.services.verification_service import VerificationService


def test_issue_code_generates_six_digits():
    svc = VerificationService(expiry_seconds=60)
    code = svc.issue_code("dean@dmmmsu.edu.ph", "dean", "CCS")
    assert len(code) == 6
    assert code.isdigit()


def test_verify_code_success_consumes_code():
    svc = VerificationService(expiry_seconds=60)
    code = svc.issue_code("dean@dmmmsu.edu.ph")
    
    # First attempt with right code succeeds
    assert svc.verify_code("dean@dmmmsu.edu.ph", code) is True
    
    # Second attempt fails (consumed / single-use)
    assert svc.verify_code("dean@dmmmsu.edu.ph", code) is False


def test_verify_code_wrong_code_fails():
    svc = VerificationService(expiry_seconds=60)
    svc.issue_code("dean@dmmmsu.edu.ph")
    assert svc.verify_code("dean@dmmmsu.edu.ph", "000000") is False


def test_verify_code_expired_fails():
    svc = VerificationService(expiry_seconds=-1)  # expired immediately
    code = svc.issue_code("dean@dmmmsu.edu.ph")
    assert svc.verify_code("dean@dmmmsu.edu.ph", code) is False


def test_verify_code_case_insensitive_email():
    svc = VerificationService(expiry_seconds=60)
    code = svc.issue_code("Dean@DMMMSU.edu.ph")
    assert svc.verify_code("dean@dmmmsu.edu.ph", code) is True
