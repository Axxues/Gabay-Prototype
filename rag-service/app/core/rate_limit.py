"""In-memory IP-based sliding window rate limiter middleware for FastAPI."""

from collections import defaultdict
import time
from typing import Callable, Dict, List, Optional
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware


class RateLimiter:
    """In-memory sliding window rate limiter tracking request timestamps per client IP."""

    def __init__(self, max_requests: int = 30, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._history: Dict[str, List[float]] = defaultdict(list)

    def is_allowed(self, client_ip: str) -> tuple[bool, int]:
        """Check if request from client_ip is within the rate limit.

        Returns:
            Tuple of (is_allowed: bool, retry_after_seconds: int)
        """
        now = time.time()
        window_start = now - self.window_seconds

        # Prune timestamps outside current window
        timestamps = [ts for ts in self._history[client_ip] if ts > window_start]
        self._history[client_ip] = timestamps

        if len(timestamps) >= self.max_requests:
            oldest = timestamps[0]
            retry_after = max(1, int(oldest + self.window_seconds - now))
            return False, retry_after

        # Record this request
        self._history[client_ip].append(now)
        return True, 0

    def reset(self) -> None:
        """Clear all rate limit history."""
        self._history.clear()


# Module-level singleton
rate_limiter = RateLimiter(max_requests=30, window_seconds=60)


class RateLimiterMiddleware(BaseHTTPMiddleware):
    """FastAPI middleware applying IP rate limiting to chat endpoints."""

    def __init__(
        self,
        app,
        limiter: Optional[RateLimiter] = None,
        exempt_paths: Optional[set[str]] = None,
    ):
        super().__init__(app)
        self.limiter = limiter or rate_limiter
        self.exempt_paths = exempt_paths or {"/health", "/docs", "/openapi.json"}

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path

        # Exempt health checks and preflight OPTIONS requests
        if request.method == "OPTIONS" or path in self.exempt_paths:
            return await call_next(request)

        # Extract client IP (respecting X-Forwarded-For only if configured to trust proxy)
        from app.core.config import get_settings
        app_settings = get_settings()
        forwarded_for = request.headers.get("x-forwarded-for")
        if app_settings.trust_proxy and forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()
        elif request.client and request.client.host:
            client_ip = request.client.host
        else:
            client_ip = "unknown"

        allowed, retry_after = self.limiter.is_allowed(client_ip)
        if not allowed:
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Rate limit exceeded. Please wait a moment before sending another query.",
                },
                headers={
                    "Retry-After": str(retry_after),
                },
            )

        return await call_next(request)
