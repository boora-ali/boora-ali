import io

import pytest
from django.core.files.storage import default_storage
from django.test import override_settings
from model_bakery import baker
from PIL import Image

pytestmark = pytest.mark.django_db

PAYLOAD = {
    "name": "Espresso",
    "type": "coffee",
    "rating": 9,
    "price": "12.50",
    "would_order_again": True,
}


_STORAGE_SETTINGS = dict(
    SECRET_KEY="test-secret-key-long-enough-for-hkdf-derivation-1234",
    STORAGES={
        "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
        },
    },
)


def make_jpeg():
    buf = io.BytesIO()
    Image.new("RGB", (10, 10)).save(buf, format="JPEG")
    buf.seek(0)
    buf.name = "item.jpg"
    buf.content_type = "image/jpeg"
    buf.size = len(buf.getvalue())
    return buf


def test_create_in_own_visit(auth_client, user):
    v = baker.make("places.Visit", place__user=user)
    r = auth_client.post(f"/api/visits/{v.public_id}/items/", PAYLOAD, format="json")
    assert r.status_code == 201
    assert "public_id" in r.data
    assert "id" not in r.data


@override_settings(**_STORAGE_SETTINGS)
def test_create_item_photo_uses_image_service(auth_client, user, tmp_path, settings):
    settings.MEDIA_ROOT = str(tmp_path)
    visit = baker.make("places.Visit", place__user=user)
    photo = make_jpeg()
    raw = photo.getvalue()

    response = auth_client.post(
        f"/api/visits/{visit.public_id}/items/",
        {**PAYLOAD, "photo": photo},
        format="multipart",
    )

    assert response.status_code == 201
    item = visit.items.get(public_id=response.data["public_id"])
    assert item.photo.name.startswith(f"users/{user.id}/visit_items/photos/")
    with default_storage.open(item.photo.name, "rb") as stored_file:
        stored = stored_file.read()
    with Image.open(io.BytesIO(stored)) as image:
        assert image.format == "JPEG"
        assert image.size == (10, 10)
    assert stored != raw  # compression altered the bytes


def test_reject_foreign_visit(auth_client, other_user):
    v = baker.make("places.Visit", place__user=other_user)
    response = auth_client.post(
        f"/api/visits/{v.public_id}/items/", PAYLOAD, format="json"
    )
    assert response.status_code == 404


def test_negative_price_rejected(auth_client, user):
    v = baker.make("places.Visit", place__user=user)
    bad = {**PAYLOAD, "price": "-1.00"}
    response = auth_client.post(f"/api/visits/{v.public_id}/items/", bad, format="json")
    assert response.status_code == 400


def test_rating_out_of_range(auth_client, user):
    v = baker.make("places.Visit", place__user=user)
    bad = {**PAYLOAD, "rating": 11}
    response = auth_client.post(f"/api/visits/{v.public_id}/items/", bad, format="json")
    assert response.status_code == 400
