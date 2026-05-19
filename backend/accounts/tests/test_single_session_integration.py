import pytest
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from accounts.models import UserSession

pytestmark = pytest.mark.django_db


# Disable throttling for all integration tests
@pytest.fixture(autouse=True)
def disable_throttle(settings):
    settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]["auth"] = "10000/minute"


class TestSingleSessionIntegration:
    """Integration tests for single-session JWT feature."""

    def test_login_creates_user_session(self, api_client):
        """POST /api/auth/login/ creates a UserSession for the user."""
        r = api_client.post(
            "/api/auth/register/",
            {
                "username": "testuser",
                "email": "test@test.com",
                "password": "Strong-Pass1!",
                "confirm_password": "Strong-Pass1!",
                "terms_accepted": True,
            },
            format="json",
        )
        assert r.status_code == 201

        r = api_client.post(
            "/api/auth/login/",
            {"username": "testuser", "password": "Strong-Pass1!"},
            format="json",
        )
        assert r.status_code == 200

        from django.contrib.auth import get_user_model

        User = get_user_model()
        user = User.objects.get(username="testuser")
        assert UserSession.objects.filter(user=user).exists()

    def test_second_login_invalidates_first(self, api_client):
        """Logging in from device B invalidates device A's access token."""
        # Device A: register and login
        api_client.post(
            "/api/auth/register/",
            {
                "username": "alice",
                "email": "alice@test.com",
                "password": "Strong-Pass1!",
                "confirm_password": "Strong-Pass1!",
                "terms_accepted": True,
            },
            format="json",
        )
        device_a_response = api_client.post(
            "/api/auth/login/",
            {"username": "alice", "password": "Strong-Pass1!"},
            format="json",
        )
        device_a_access = device_a_response.data["access"]

        # Device B: login (simulated by same client, different credentials)
        device_b_response = api_client.post(
            "/api/auth/login/",
            {"username": "alice", "password": "Strong-Pass1!"},
            format="json",
        )
        device_b_access = device_b_response.data["access"]

        # Device A: try to use old token, should fail
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {device_a_access}")
        r = api_client.get("/api/auth/me/")
        assert r.status_code == 401
        assert r.data.get("code") == "session_expired"

        # Device B: use new token, should work
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {device_b_access}")
        r = api_client.get("/api/auth/me/")
        assert r.status_code == 200
        assert r.data["username"] == "alice"

    def test_refresh_rejected_after_new_login(self, api_client):
        """Device A's refresh token is rejected after device B logs in."""
        # Device A: register and login
        api_client.post(
            "/api/auth/register/",
            {
                "username": "bob",
                "email": "bob@test.com",
                "password": "Strong-Pass1!",
                "confirm_password": "Strong-Pass1!",
                "terms_accepted": True,
            },
            format="json",
        )
        device_a_response = api_client.post(
            "/api/auth/login/",
            {"username": "bob", "password": "Strong-Pass1!"},
            format="json",
        )
        # Capture device A's refresh token from cookie before it is overwritten
        device_a_refresh = device_a_response.cookies["boraali_refresh"].value

        # Device B: login (overwrites the cookie in the test client)
        api_client.post(
            "/api/auth/login/",
            {"username": "bob", "password": "Strong-Pass1!"},
            format="json",
        )

        # Manually set device A's stale cookie to simulate sending the old token
        api_client.cookies["boraali_refresh"] = device_a_refresh

        # Device A: try to refresh with stale token, should fail
        r = api_client.post("/api/auth/refresh/", format="json")
        assert r.status_code == 401
        assert r.data.get("code") == "session_invalidated"

    def test_new_session_works_normally(self, api_client):
        """After device B logs in, device B's tokens work fine on protected endpoints."""
        api_client.post(
            "/api/auth/register/",
            {
                "username": "charlie",
                "email": "charlie@test.com",
                "password": "Strong-Pass1!",
                "confirm_password": "Strong-Pass1!",
                "terms_accepted": True,
            },
            format="json",
        )

        # Login and get tokens
        device_response = api_client.post(
            "/api/auth/login/",
            {"username": "charlie", "password": "Strong-Pass1!"},
            format="json",
        )
        access = device_response.data["access"]

        # Use token to access protected endpoint
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        r = api_client.get("/api/auth/me/")
        assert r.status_code == 200
        assert r.data["username"] == "charlie"

    def test_session_key_embedded_in_token(self, api_client):
        """The JWT payload contains session_key matching the DB record after login."""
        api_client.post(
            "/api/auth/register/",
            {
                "username": "dave",
                "email": "dave@test.com",
                "password": "Strong-Pass1!",
                "confirm_password": "Strong-Pass1!",
                "terms_accepted": True,
            },
            format="json",
        )
        r = api_client.post(
            "/api/auth/login/",
            {"username": "dave", "password": "Strong-Pass1!"},
            format="json",
        )
        access_token_str = r.data["access"]

        # Decode token and check for session_key
        token = AccessToken(access_token_str)
        assert "session_key" in token
        assert token["session_key"] is not None

        # Verify it matches DB
        from django.contrib.auth import get_user_model

        User = get_user_model()
        user = User.objects.get(username="dave")
        assert str(user.active_session.session_key) == token["session_key"]

    def test_refresh_carries_session_key_forward(self, api_client):
        """After a successful refresh, the new refresh token still contains a (rotated) session_key."""
        api_client.post(
            "/api/auth/register/",
            {
                "username": "eve",
                "email": "eve@test.com",
                "password": "Strong-Pass1!",
                "confirm_password": "Strong-Pass1!",
                "terms_accepted": True,
            },
            format="json",
        )
        login_response = api_client.post(
            "/api/auth/login/",
            {"username": "eve", "password": "Strong-Pass1!"},
            format="json",
        )
        original_refresh = login_response.cookies["boraali_refresh"].value
        original_token = RefreshToken(original_refresh)
        original_session_key = original_token.get("session_key")

        # Refresh the token (cookie is sent automatically by the test client)
        r = api_client.post("/api/auth/refresh/", format="json")
        assert r.status_code == 200

        # New refresh token arrives as cookie
        new_refresh = r.cookies["boraali_refresh"].value
        new_token = RefreshToken(new_refresh)
        new_session_key = new_token.get("session_key")

        assert original_session_key is not None
        assert new_session_key is not None
        # Session key must rotate on every refresh to eliminate replay window.
        assert new_session_key != original_session_key

    def test_full_flow_same_session(self, api_client):
        """Full flow: Login → use API → refresh → use API again (all with same session)."""
        # Register
        api_client.post(
            "/api/auth/register/",
            {
                "username": "frank",
                "email": "frank@test.com",
                "password": "Strong-Pass1!",
                "confirm_password": "Strong-Pass1!",
                "terms_accepted": True,
            },
            format="json",
        )

        # Login (refresh comes as cookie)
        login_r = api_client.post(
            "/api/auth/login/",
            {"username": "frank", "password": "Strong-Pass1!"},
            format="json",
        )
        assert login_r.status_code == 200
        access1 = login_r.data["access"]
        assert "boraali_refresh" in login_r.cookies

        # Use API with first access token
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access1}")
        me_r1 = api_client.get("/api/auth/me/")
        assert me_r1.status_code == 200
        assert me_r1.data["username"] == "frank"

        # Refresh token (cookie sent automatically)
        api_client.credentials()  # Clear auth
        refresh_r = api_client.post("/api/auth/refresh/", format="json")
        assert refresh_r.status_code == 200
        access2 = refresh_r.data["access"]

        # Use API with new access token
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access2}")
        me_r2 = api_client.get("/api/auth/me/")
        assert me_r2.status_code == 200
        assert me_r2.data["username"] == "frank"

    def test_logout_still_works_with_sessions(self, api_client):
        """Logout blacklists the refresh token (existing behavior should still work)."""
        api_client.post(
            "/api/auth/register/",
            {
                "username": "grace",
                "email": "grace@test.com",
                "password": "Strong-Pass1!",
                "confirm_password": "Strong-Pass1!",
                "terms_accepted": True,
            },
            format="json",
        )
        login_r = api_client.post(
            "/api/auth/login/",
            {"username": "grace", "password": "Strong-Pass1!"},
            format="json",
        )
        access = login_r.data["access"]
        assert "boraali_refresh" in login_r.cookies

        # Logout (refresh token read from cookie on server side)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        logout_r = api_client.post("/api/auth/logout/", format="json")
        assert logout_r.status_code == 205

        # Try to refresh — cookie was cleared, so no token to send
        api_client.credentials()
        refresh_r = api_client.post("/api/auth/refresh/", format="json")
        assert refresh_r.status_code == 401

    def test_old_tokens_without_session_key_rejected(self, api_client, user):
        """Old tokens without session_key are rejected (device invalidation backward compat)."""
        # Create a fake old token without session_key
        old_token = RefreshToken.for_user(user)
        # No session_key claim (simulating old token format)

        # Try to use it
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(old_token)}")
        r = api_client.get("/api/auth/me/")
        # Should fail because UserSession doesn't exist for this user yet
        assert r.status_code == 401

    def test_session_key_rotation_on_each_login(self, api_client):
        """Each login generates a new, unique session_key."""
        api_client.post(
            "/api/auth/register/",
            {
                "username": "henry",
                "email": "henry@test.com",
                "password": "Strong-Pass1!",
                "confirm_password": "Strong-Pass1!",
                "terms_accepted": True,
            },
            format="json",
        )

        # First login
        r1 = api_client.post(
            "/api/auth/login/",
            {"username": "henry", "password": "Strong-Pass1!"},
            format="json",
        )
        token1 = AccessToken(r1.data["access"])
        session_key1 = token1["session_key"]

        # Second login
        r2 = api_client.post(
            "/api/auth/login/",
            {"username": "henry", "password": "Strong-Pass1!"},
            format="json",
        )
        token2 = AccessToken(r2.data["access"])
        session_key2 = token2["session_key"]

        # Both should be valid UUIDs but different
        assert session_key1 != session_key2
        assert len(session_key1) == 36  # UUID string format
        assert len(session_key2) == 36
