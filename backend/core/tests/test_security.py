"""
Testes de segurança: isolamento de dados, uploads, URLs, autenticação e paginação.
"""

import io

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from model_bakery import baker
from PIL import Image
from rest_framework.test import APIClient, APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()

pytestmark = pytest.mark.django_db


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_jpeg_bytes(width=10, height=10) -> bytes:
    buf = io.BytesIO()
    img = Image.new("RGB", (width, height), color=(255, 0, 0))
    img.save(buf, format="JPEG")
    return buf.getvalue()


def _make_png_bytes(width=10, height=10) -> bytes:
    buf = io.BytesIO()
    img = Image.new("RGB", (width, height), color=(0, 255, 0))
    img.save(buf, format="PNG")
    return buf.getvalue()


def _make_svg_bytes() -> bytes:
    return b'<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100"/></svg>'


def _uploaded(data: bytes, name: str = "img.jpg", content_type: str = "image/jpeg"):
    return SimpleUploadedFile(name, data, content_type=content_type)


# ---------------------------------------------------------------------------
# Isolamento de dados entre usuários
# ---------------------------------------------------------------------------


class TestDataIsolation:
    def test_user_cannot_see_others_place(self, auth_client, other_user):
        place = baker.make("places.Place", user=other_user)
        r = auth_client.get(f"/api/places/{place.public_id}/")
        assert r.status_code == 404

    def test_user_cannot_edit_others_place(self, auth_client, other_user):
        place = baker.make("places.Place", user=other_user)
        r = auth_client.patch(
            f"/api/places/{place.public_id}/",
            {"name": "Hackeado"},
            format="json",
        )
        assert r.status_code == 404

    def test_user_cannot_delete_others_place(self, auth_client, other_user):
        place = baker.make("places.Place", user=other_user)
        r = auth_client.delete(f"/api/places/{place.public_id}/")
        assert r.status_code == 404

    def test_list_shows_only_own_places(self, auth_client, user, other_user):
        baker.make("places.Place", user=user, _quantity=2)
        baker.make("places.Place", user=other_user, _quantity=5)
        r = auth_client.get("/api/places/")
        assert r.status_code == 200
        assert r.data["count"] == 2

    def test_user_cannot_access_others_visit(self, auth_client, user, other_user):
        place = baker.make("places.Place", user=other_user)
        visit = baker.make("places.Visit", place=place)
        r = auth_client.patch(
            f"/api/visits/{visit.public_id}/",
            {"would_return": False},
            format="json",
        )
        assert r.status_code == 404

    def test_user_cannot_access_others_visit_item(self, auth_client, user, other_user):
        place = baker.make("places.Place", user=other_user)
        visit = baker.make("places.Visit", place=place)
        item = baker.make("places.VisitItem", visit=visit)
        r = auth_client.patch(
            f"/api/visit-items/{item.public_id}/",
            {"name": "Hackeado"},
            format="json",
        )
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# Autenticação exigida
# ---------------------------------------------------------------------------


class TestAuthRequired:
    def test_places_list_requires_auth(self):
        client = APIClient()
        assert client.get("/api/places/").status_code == 401

    def test_me_requires_auth(self):
        client = APIClient()
        assert client.get("/api/auth/me/").status_code == 401

    def test_password_change_requires_auth(self):
        client = APIClient()
        r = client.post(
            "/api/auth/password/",
            {"current_password": "x", "new_password": "y", "confirm_password": "y"},
            format="json",
        )
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# Validação de URL (scheme allowlist)
# ---------------------------------------------------------------------------


class TestURLValidation:
    def test_javascript_scheme_rejected_instagram(self, auth_client):
        r = auth_client.post(
            "/api/places/",
            {
                "name": "Café",
                "category": "café",
                "status": "want_to_visit",
                "instagram_url": "javascript:alert(1)",
            },
            format="json",
        )
        assert r.status_code == 400

    def test_data_scheme_rejected_maps(self, auth_client):
        r = auth_client.post(
            "/api/places/",
            {
                "name": "Café",
                "category": "café",
                "status": "want_to_visit",
                "maps_url": "data:text/html,<script>alert(1)</script>",
            },
            format="json",
        )
        assert r.status_code == 400

    def test_file_scheme_rejected(self, auth_client):
        r = auth_client.post(
            "/api/places/",
            {
                "name": "Café",
                "category": "café",
                "status": "want_to_visit",
                "maps_url": "file:///etc/passwd",
            },
            format="json",
        )
        assert r.status_code == 400

    def test_https_url_accepted(self, auth_client):
        r = auth_client.post(
            "/api/places/",
            {
                "name": "Café",
                "category": "café",
                "status": "want_to_visit",
                "maps_url": "https://maps.google.com/?q=-3.0,-60.0",
            },
            format="json",
        )
        assert r.status_code == 201


# ---------------------------------------------------------------------------
# Validação de upload de imagem
# ---------------------------------------------------------------------------


class TestImageUpload:
    def test_valid_jpeg_accepted(self, auth_client, user):
        place = baker.make("places.Place", user=user)
        visit = baker.make("places.Visit", place=place)
        data = {
            "photo": _uploaded(_make_jpeg_bytes(), "foto.jpg", "image/jpeg"),
            "name": "Item Teste",
            "type": "coffee",
        }
        r = auth_client.post(
            f"/api/visits/{visit.public_id}/items/",
            data,
            format="multipart",
        )
        assert r.status_code == 201

    def test_valid_png_accepted(self, auth_client, user):
        place = baker.make("places.Place", user=user)
        visit = baker.make("places.Visit", place=place)
        data = {
            "photo": _uploaded(_make_png_bytes(), "foto.png", "image/png"),
            "name": "Item Teste",
            "type": "drink",
        }
        r = auth_client.post(
            f"/api/visits/{visit.public_id}/items/",
            data,
            format="multipart",
        )
        assert r.status_code == 201

    def test_svg_rejected_by_content_type(self, auth_client, user):
        place = baker.make("places.Place", user=user)
        visit = baker.make("places.Visit", place=place)
        data = {
            "photo": _uploaded(_make_svg_bytes(), "evil.svg", "image/svg+xml"),
            "name": "Teste",
            "type": "other",
        }
        r = auth_client.post(
            f"/api/visits/{visit.public_id}/items/",
            data,
            format="multipart",
        )
        assert r.status_code == 400

    def test_svg_rejected_by_magic_bytes(self, auth_client, user):
        """SVG com content-type falsificado como image/jpeg ainda deve ser rejeitado."""
        place = baker.make("places.Place", user=user)
        visit = baker.make("places.Visit", place=place)
        data = {
            "photo": _uploaded(_make_svg_bytes(), "evil.jpg", "image/jpeg"),
            "name": "Teste",
            "type": "other",
        }
        r = auth_client.post(
            f"/api/visits/{visit.public_id}/items/",
            data,
            format="multipart",
        )
        assert r.status_code == 400

    def test_corrupted_file_rejected(self, auth_client, user):
        place = baker.make("places.Place", user=user)
        visit = baker.make("places.Visit", place=place)
        data = {
            "photo": _uploaded(
                b"\xff\xd8\xff" + b"\x00" * 100, "corrupted.jpg", "image/jpeg"
            ),
            "name": "Teste",
            "type": "other",
        }
        r = auth_client.post(
            f"/api/visits/{visit.public_id}/items/",
            data,
            format="multipart",
        )
        assert r.status_code == 400

    def test_oversized_file_rejected(self, auth_client, user):
        place = baker.make("places.Place", user=user)
        visit = baker.make("places.Visit", place=place)
        # Cria um arquivo fake > 10 MB com bytes válidos de JPEG no header
        big_data = _make_jpeg_bytes() + b"\x00" * (11 * 1024 * 1024)
        fake_file = SimpleUploadedFile("big.jpg", big_data, content_type="image/jpeg")
        # Sobrescreve size manualmente para simular o tamanho real
        fake_file.size = len(big_data)
        data = {"photo": fake_file, "name": "Teste", "type": "other"}
        r = auth_client.post(
            f"/api/visits/{visit.public_id}/items/",
            data,
            format="multipart",
        )
        assert r.status_code == 400


# ---------------------------------------------------------------------------
# Paginação e page size
# ---------------------------------------------------------------------------


class TestPagination:
    def test_list_is_paginated(self, auth_client, user):
        baker.make("places.Place", user=user, _quantity=25)
        r = auth_client.get("/api/places/")
        assert r.status_code == 200
        assert r.data["count"] == 25
        assert len(r.data["results"]) == 20

    def test_next_page_exists(self, auth_client, user):
        baker.make("places.Place", user=user, _quantity=25)
        r = auth_client.get("/api/places/")
        assert r.data["next"] is not None


# ---------------------------------------------------------------------------
# Limites de texto
# ---------------------------------------------------------------------------


class TestTextLimits:
    def test_notes_too_long_rejected(self, auth_client):
        r = auth_client.post(
            "/api/places/",
            {
                "name": "Café",
                "category": "café",
                "status": "want_to_visit",
                "notes": "x" * 5001,
            },
            format="json",
        )
        assert r.status_code == 400


# ---------------------------------------------------------------------------
# Cross-user PATCH/DELETE mutations
# ---------------------------------------------------------------------------


class TestCrossUserMutations:
    """PATCH/DELETE on resources belonging to another user must return 404."""

    def test_patch_other_user_place_returns_404(self, user, other_user, api_client):
        place = baker.make("places.Place", user=user)
        api_client.force_authenticate(other_user)
        r = api_client.patch(
            f"/api/places/{place.public_id}/", {"name": "hacked"}, format="json"
        )
        assert r.status_code == 404

    def test_delete_other_user_place_returns_404(self, user, other_user, api_client):
        place = baker.make("places.Place", user=user)
        api_client.force_authenticate(other_user)
        r = api_client.delete(f"/api/places/{place.public_id}/")
        assert r.status_code == 404

    def test_patch_other_user_visit_returns_404(self, user, other_user, api_client):
        place = baker.make("places.Place", user=user)
        visit = baker.make("places.Visit", place=place)
        api_client.force_authenticate(other_user)
        r = api_client.patch(
            f"/api/visits/{visit.public_id}/", {"notes": "hacked"}, format="json"
        )
        assert r.status_code == 404

    def test_delete_other_user_visit_returns_404(self, user, other_user, api_client):
        place = baker.make("places.Place", user=user)
        visit = baker.make("places.Visit", place=place)
        api_client.force_authenticate(other_user)
        r = api_client.delete(f"/api/visits/{visit.public_id}/")
        assert r.status_code == 404

    def test_patch_other_user_visit_item_returns_404(
        self, user, other_user, api_client
    ):
        place = baker.make("places.Place", user=user)
        visit = baker.make("places.Visit", place=place)
        item = baker.make("places.VisitItem", visit=visit)
        api_client.force_authenticate(other_user)
        r = api_client.patch(
            f"/api/visit-items/{item.public_id}/",
            {"description": "hacked"},
            format="json",
        )
        assert r.status_code == 404

    def test_delete_other_user_visit_item_returns_404(
        self, user, other_user, api_client
    ):
        place = baker.make("places.Place", user=user)
        visit = baker.make("places.Visit", place=place)
        item = baker.make("places.VisitItem", visit=visit)
        api_client.force_authenticate(other_user)
        r = api_client.delete(f"/api/visit-items/{item.public_id}/")
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# Payloads inválidos — nunca devem retornar 500
# ---------------------------------------------------------------------------


class InvalidPayloadTests(APITestCase):
    """Malformed or boundary payloads must never return 500."""

    def setUp(self):
        self.user = baker.make(User, username="payload_user")
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {str(refresh.access_token)}"
        )
        self.place = baker.make("places.Place", user=self.user)

    def _assert_not_500(self, resp):
        self.assertNotEqual(
            resp.status_code, 500, f"Got 500: {getattr(resp, 'data', resp.content)}"
        )

    def test_create_place_empty_body(self):
        resp = self.client.post("/api/places/", {}, format="json")
        self._assert_not_500(resp)

    def test_create_place_null_fields(self):
        resp = self.client.post(
            "/api/places/", {"name": None, "status": None}, format="json"
        )
        self._assert_not_500(resp)

    def test_create_place_very_long_name(self):
        resp = self.client.post(
            "/api/places/", {"name": "x" * 10_000, "status": "want"}, format="json"
        )
        self._assert_not_500(resp)

    def test_create_place_invalid_status(self):
        resp = self.client.post(
            "/api/places/", {"name": "Test", "status": "INVALID_STATUS"}, format="json"
        )
        self._assert_not_500(resp)
        self.assertIn(resp.status_code, [400, 422])

    def test_create_visit_invalid_rating(self):
        resp = self.client.post(
            f"/api/places/{self.place.public_id}/visits/",
            {"rating": 9999, "visited_at": "not-a-date"},
            format="json",
        )
        self._assert_not_500(resp)

    def test_patch_place_with_invalid_maps_url(self):
        resp = self.client.patch(
            f"/api/places/{self.place.public_id}/",
            {"maps_url": "javascript:alert(1)"},
            format="json",
        )
        self._assert_not_500(resp)
        self.assertIn(resp.status_code, [400, 422])

    def test_login_with_no_body(self):
        resp = self.client.post("/api/auth/login/", {}, format="json")
        self._assert_not_500(resp)
        self.assertEqual(resp.status_code, 400)

    def test_register_with_mismatched_passwords(self):
        resp = self.client.post(
            "/api/auth/register/",
            {
                "username": "newuser",
                "email": "new@test.com",
                "password": "pass123",
                "password_confirm": "different",
            },
            format="json",
        )
        self._assert_not_500(resp)
        self.assertIn(resp.status_code, [400, 422])
