import base64
import datetime
import json

import jwt
from django.contrib.auth import get_user_model
from model_bakery import baker
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


class ExpiredTokenTests(APITestCase):
    def setUp(self):
        self.user = baker.make(User, username="tokenuser")

    def _make_expired_token(self):
        from django.conf import settings

        payload = {
            "token_type": "access",
            "exp": int(
                (
                    datetime.datetime.now(datetime.UTC) - datetime.timedelta(hours=1)
                ).timestamp()
            ),
            "iat": int(
                (
                    datetime.datetime.now(datetime.UTC) - datetime.timedelta(hours=2)
                ).timestamp()
            ),
            "jti": "fakeexpiredjti",
            "user_id": self.user.pk,
        }
        return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")

    def test_expired_access_token_returns_401(self):
        token = self._make_expired_token()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        resp = self.client.get("/api/places/")
        self.assertEqual(resp.status_code, 401)

    def test_tampered_access_token_returns_401(self):
        refresh = RefreshToken.for_user(self.user)
        token = str(refresh.access_token)
        # Replace the signature part (after the second dot) with garbage
        header, payload, _ = token.split(".")
        tampered = f"{header}.{payload}.invalidsignatureXXXXXXXXXXXX"
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {tampered}")
        resp = self.client.get("/api/places/")
        self.assertEqual(resp.status_code, 401)

    def test_access_token_with_none_algorithm_returns_401(self):
        """alg:none algorithm confusion attack must be rejected."""
        payload = {
            "token_type": "access",
            "exp": int(
                (
                    datetime.datetime.now(datetime.UTC) + datetime.timedelta(hours=1)
                ).timestamp()
            ),
            "iat": int(datetime.datetime.now(datetime.UTC).timestamp()),
            "jti": "nonealg",
            "user_id": self.user.pk,
        }

        def b64(d):
            return (
                base64.urlsafe_b64encode(json.dumps(d).encode()).rstrip(b"=").decode()
            )

        token = f"{b64({'alg': 'none', 'typ': 'JWT'})}.{b64(payload)}."
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        resp = self.client.get("/api/places/")
        self.assertEqual(resp.status_code, 401)


class RefreshTokenReuseAfterLogoutTests(APITestCase):
    def setUp(self):
        self.user = baker.make(User, username="logoutuser")
        self.user.set_password("pass123")
        self.user.save()

    def test_refresh_token_rejected_after_logout(self):
        # 1. Login to obtain tokens
        resp = self.client.post(
            "/api/auth/login/",
            {"username": "logoutuser", "password": "pass123"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, f"Login failed: {resp.data}")
        refresh_token = resp.data["refresh"]
        access_token = resp.data["access"]

        # 2. Logout (blacklists the refresh token)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")
        logout_resp = self.client.post(
            "/api/auth/logout/", {"refresh": refresh_token}, format="json"
        )
        self.assertIn(
            logout_resp.status_code, [200, 205], f"Logout failed: {logout_resp.data}"
        )

        # 3. Attempt to refresh using the now-blacklisted token
        self.client.credentials()
        refresh_resp = self.client.post(
            "/api/auth/refresh/", {"refresh": refresh_token}, format="json"
        )
        self.assertEqual(
            refresh_resp.status_code,
            401,
            f"Blacklisted token still works: {refresh_resp.data}",
        )
