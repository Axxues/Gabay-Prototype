"""Verification service for generating, hashing, and validating one-time leadership appointment codes."""

import hashlib
import hmac
import secrets
import time
from typing import Dict, Optional, TypedDict


class CodeEntry(TypedDict):
    code_hash: str
    salt: str
    expires_at: float
    role_type: str
    unit_name: str


class VerificationService:
    """In-memory service managing verification codes with expiration and single-use semantics."""

    def __init__(self, expiry_seconds: int = 600):
        self.expiry_seconds = expiry_seconds
        self._store: Dict[str, CodeEntry] = {}

    def _hash_code(self, code: str, salt: str) -> str:
        return hashlib.sha256(f"{salt}:{code}".encode("utf-8")).hexdigest()

    def issue_code(
        self,
        email: str,
        role_type: str = "dean",
        unit_name: str = "",
    ) -> str:
        """Generate a cryptographically secure 6-digit code, store its hash, and return the plaintext code."""
        self.purge_expired()
        normalized_email = email.strip().lower()
        
        # 6-digit numeric string (100000 - 999999)
        code = f"{secrets.randbelow(900000) + 100000}"
        salt = secrets.token_hex(16)
        code_hash = self._hash_code(code, salt)
        expires_at = time.time() + self.expiry_seconds

        self._store[normalized_email] = {
            "code_hash": code_hash,
            "salt": salt,
            "expires_at": expires_at,
            "role_type": role_type,
            "unit_name": unit_name,
        }
        return code

    def verify_code(self, email: str, code: str) -> bool:
        """Verify the given code against the stored hash for this email. Single-use: consumes on success."""
        self.purge_expired()
        normalized_email = email.strip().lower()
        entry = self._store.get(normalized_email)
        if not entry:
            return False

        if time.time() > entry["expires_at"]:
            self._store.pop(normalized_email, None)
            return False

        expected_hash = self._hash_code(code.strip(), entry["salt"])
        if hmac.compare_digest(expected_hash, entry["code_hash"]):
            # Consume on successful verification
            self._store.pop(normalized_email, None)
            return True

        return False

    def purge_expired(self) -> None:
        """Remove all expired entries."""
        now = time.time()
        expired = [email for email, entry in self._store.items() if entry["expires_at"] <= now]
        for email in expired:
            self._store.pop(email, None)

    def clear(self) -> None:
        """Clear all entries (primarily for testing)."""
        self._store.clear()


# Singleton instance
verification_service = VerificationService()
