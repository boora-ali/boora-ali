from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APITestCase

# Simulate a public IP (non-exempt) so AuthRateThrottle does not bypass throttling.
# Uses TEST-NET-3 (203.0.113.0/24), a documentation-only range per RFC 5737.
_PUBLIC_IP = "203.0.113.42"


@override_settings(
    THROTTLE_EXEMPT_CIDRS=[],  # remove localhost exemption so tests can trigger 429
    CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}},
    REST_FRAMEWORK={
        "DEFAULT_THROTTLE_CLASSES": [
            "rest_framework.throttling.AnonRateThrottle",
            "accounts.throttles.AuthRateThrottle",
        ],
        "DEFAULT_THROTTLE_RATES": {"anon": "100/minute", "auth": "5/minute"},
    },
)
class LoginBruteForceThrottleTests(APITestCase):
    """Verify that repeated login attempts from a public IP trigger 429.

    AuthRateThrottle exempts private/loopback IPs to avoid false positives in
    development.  Tests therefore set REMOTE_ADDR to a non-routable public IP
    (RFC 5737 TEST-NET) and use override_settings to configure a low rate limit
    so the burst of 10 requests reliably crosses the threshold.
    """

    def setUp(self):
        cache.clear()

    def tearDown(self):
        cache.clear()

    def _post_login(self, payload):
        return self.client.post(
            "/api/auth/login/",
            payload,
            format="json",
            REMOTE_ADDR=_PUBLIC_IP,
        )

    def test_brute_force_login_triggers_429(self):
        """Exceeding auth throttle limit returns 429 Too Many Requests."""
        payload = {"username": "nonexistent", "password": "wrongpassword"}

        responses = []
        for _ in range(10):
            resp = self._post_login(payload)
            responses.append(resp.status_code)

        self.assertIn(
            429,
            responses,
            f"Expected at least one 429 after exceeding throttle limit. Got: {responses}",
        )

    def test_first_few_requests_are_not_throttled(self):
        """First requests return 401 (bad creds), not 429."""
        payload = {"username": "nonexistent", "password": "wrongpassword"}

        for i in range(3):
            resp = self._post_login(payload)
            self.assertNotEqual(
                resp.status_code,
                429,
                f"Request {i + 1} should not be throttled yet, got {resp.status_code}",
            )

    def test_throttled_login_includes_rate_limit_headers(self):
        """When login is throttled, the response includes retry metadata."""
        payload = {"username": "nonexistent", "password": "wrongpassword"}

        response = None
        for _ in range(10):
            response = self._post_login(payload)
            if response.status_code == 429:
                break

        assert response is not None
        assert response.status_code == 429
        assert response["Retry-After"].isdigit()
        assert response["X-RateLimit-Remaining"] == "0"
