import io

import pytest
from django.contrib.auth import get_user_model
from django.test import override_settings
from model_bakery import baker
from PIL import Image
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from core.image_service import ImageService

User = get_user_model()


def make_jpeg_bytes():
    buf = io.BytesIO()
    Image.new("RGB", (10, 10), color=(0, 255, 0)).save(buf, format="JPEG")
    buf.seek(0)
    return buf.read()


@pytest.fixture
def auth_client(client, django_user_model):
    user = baker.make(django_user_model, username="alice")
    user.set_password("pass")
    user.save()
    resp = client.post(
        "/api/auth/login/",
        {"username": "alice", "password": "pass"},
        content_type="application/json",
    )
    token = resp.json()["access"]
    client.defaults["HTTP_AUTHORIZATION"] = f"Bearer {token}"
    client._user = user
    return client


@pytest.fixture
def other_client(django_user_model):
    from django.test import Client

    c = Client()
    user = baker.make(django_user_model, username="bob")
    user.set_password("pass")
    user.save()
    resp = c.post(
        "/api/auth/login/",
        {"username": "bob", "password": "pass"},
        content_type="application/json",
    )
    token = resp.json()["access"]
    c.defaults["HTTP_AUTHORIZATION"] = f"Bearer {token}"
    c._user = user
    return c


@pytest.mark.django_db
@override_settings(
    SECRET_KEY="test-secret-key-long-enough-for-hkdf-derivation-1234",
    STORAGES={
        "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
        },
    },
)
def test_serve_own_file_returns_200(auth_client, tmp_path, settings):
    settings.MEDIA_ROOT = str(tmp_path)
    user = auth_client._user
    data = make_jpeg_bytes()
    path = ImageService.save(
        io.BytesIO(data), user_id=user.id, category="places/covers"
    )

    resp = auth_client.get(f"/api/media/{path}")
    assert resp.status_code == 200
    assert resp["X-Accel-Redirect"] == "/_r2_proxy/"
    assert path in resp["X-Accel-Target"]
    assert resp["Cache-Control"] == "private, max-age=3600, must-revalidate"


@pytest.mark.django_db
@override_settings(
    SECRET_KEY="test-secret-key-long-enough-for-hkdf-derivation-1234",
    STORAGES={
        "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
        },
    },
)
def test_serve_other_user_file_returns_404(
    auth_client, other_client, tmp_path, settings
):
    settings.MEDIA_ROOT = str(tmp_path)
    other_user = other_client._user
    data = make_jpeg_bytes()
    path = ImageService.save(
        io.BytesIO(data), user_id=other_user.id, category="places/covers"
    )

    resp = auth_client.get(f"/api/media/{path}")
    assert resp.status_code == 404


@pytest.mark.django_db
def test_serve_unauthenticated_returns_401(client, tmp_path, settings):
    settings.MEDIA_ROOT = str(tmp_path)
    resp = client.get("/api/media/users/1/places/covers/abc_def")
    assert resp.status_code == 401


@pytest.mark.django_db
@override_settings(
    SECRET_KEY="test-secret-key-long-enough-for-hkdf-derivation-1234",
    STORAGES={
        "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
        },
    },
)
def test_serve_nonexistent_file_returns_404(auth_client, tmp_path, settings):
    settings.MEDIA_ROOT = str(tmp_path)
    user = auth_client._user
    # A view emite X-Accel-Redirect sem verificar existência — nginx/storage decide.
    # Para arquivos locais, default_storage.url() retorna URL sem checar existência.
    resp = auth_client.get(f"/api/media/users/{user.id}/places/covers/nonexistent_000")
    assert resp.status_code == 200
    assert resp["X-Accel-Redirect"] == "/_r2_proxy/"


class CrossUserMediaAccessTests(APITestCase):
    """User B must not access User A's media paths."""

    def setUp(self):
        self.user_a = baker.make(User, username="media_owner")
        self.user_b = baker.make(User, username="media_attacker")

    def _token(self, user):
        return str(RefreshToken.for_user(user).access_token)

    def test_other_user_media_path_returns_404(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self._token(self.user_b)}")
        path = f"users/{self.user_a.id}/places/covers/fakefilehash_1234567890"
        resp = self.client.get(f"/api/media/{path}")
        self.assertEqual(resp.status_code, 404)

    def test_unauthenticated_media_access_returns_401(self):
        path = f"users/{self.user_a.id}/places/covers/fakefilehash_1234567890"
        resp = self.client.get(f"/api/media/{path}")
        self.assertEqual(resp.status_code, 401)

    def test_own_missing_media_returns_accel_redirect(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self._token(self.user_a)}")
        path = f"users/{self.user_a.id}/places/covers/nonexistent_file"
        resp = self.client.get(f"/api/media/{path}")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp["X-Accel-Redirect"], "/_r2_proxy/")
