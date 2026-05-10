import io

from django.contrib.auth import get_user_model
from django.test import override_settings
from model_bakery import baker
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()

STORAGE_OVERRIDE = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "media": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
}


def _auth_header(user):
    return f"Bearer {str(RefreshToken.for_user(user).access_token)}"


@override_settings(USE_VERSITYGW=False, STORAGES=STORAGE_OVERRIDE)
class MaliciousUploadTests(APITestCase):
    def setUp(self):
        self.user = baker.make(User, username="upload_attacker")
        self.client.credentials(HTTP_AUTHORIZATION=_auth_header(self.user))
        self.place = baker.make("places.Place", user=self.user)
        self.visit = baker.make("places.Visit", place=self.place)

    def test_svg_file_rejected(self):
        svg_content = (
            b"<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"
        )
        f = io.BytesIO(svg_content)
        f.name = "evil.svg"
        resp = self.client.patch(
            f"/api/places/{self.place.public_id}/",
            {"cover_photo": f},
            format="multipart",
        )
        self.assertIn(resp.status_code, [400, 415, 422])

    def test_svg_disguised_as_jpeg_rejected(self):
        svg_content = (
            b"<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"
        )
        f = io.BytesIO(svg_content)
        f.name = "photo.jpg"
        resp = self.client.patch(
            f"/api/places/{self.place.public_id}/",
            {"cover_photo": f},
            format="multipart",
        )
        self.assertIn(resp.status_code, [400, 415, 422])

    def test_html_file_rejected(self):
        html_content = b"<!DOCTYPE html><html><script>alert(1)</script></html>"
        f = io.BytesIO(html_content)
        f.name = "page.jpg"
        resp = self.client.patch(
            f"/api/places/{self.place.public_id}/",
            {"cover_photo": f},
            format="multipart",
        )
        self.assertIn(resp.status_code, [400, 415, 422])

    def test_php_file_rejected(self):
        php_content = b"<?php system($_GET['cmd']); ?>"
        f = io.BytesIO(php_content)
        f.name = "shell.jpg"
        resp = self.client.patch(
            f"/api/places/{self.place.public_id}/",
            {"cover_photo": f},
            format="multipart",
        )
        self.assertIn(resp.status_code, [400, 415, 422])

    def test_text_file_rejected(self):
        f = io.BytesIO(b"not an image at all")
        f.name = "file.txt"
        resp = self.client.patch(
            f"/api/places/{self.place.public_id}/",
            {"cover_photo": f},
            format="multipart",
        )
        self.assertIn(resp.status_code, [400, 415, 422])

    def test_empty_file_rejected(self):
        f = io.BytesIO(b"")
        f.name = "empty.jpg"
        resp = self.client.patch(
            f"/api/places/{self.place.public_id}/",
            {"cover_photo": f},
            format="multipart",
        )
        self.assertIn(resp.status_code, [400, 415, 422])

    def test_visit_photo_svg_rejected(self):
        svg_content = b"<svg xmlns='http://www.w3.org/2000/svg'></svg>"
        f = io.BytesIO(svg_content)
        f.name = "evil.svg"
        resp = self.client.patch(
            f"/api/visits/{self.visit.public_id}/",
            {"photo": f},
            format="multipart",
        )
        self.assertIn(resp.status_code, [400, 415, 422])
