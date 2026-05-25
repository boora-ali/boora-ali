import io

import pytest
from django.core.files.storage import default_storage
from django.test import override_settings
from model_bakery import baker
from PIL import Image

pytestmark = pytest.mark.django_db

PAYLOAD = {
    "visited_at": "2026-04-29T12:00:00Z",
    "environment_rating": 8,
    "service_rating": 9,
    "overall_rating": 9,
    "would_return": True,
    "general_notes": "ok",
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
    buf.name = "visit.jpg"
    buf.content_type = "image/jpeg"
    buf.size = len(buf.getvalue())
    return buf


def test_create_visit_in_own_place(auth_client, user):
    p = baker.make("places.Place", user=user)
    r = auth_client.post(f"/api/places/{p.public_id}/visits/", PAYLOAD, format="json")
    assert r.status_code == 201
    assert "public_id" in r.data
    assert "id" not in r.data


def test_retrieve_visit_includes_items(auth_client, user):
    place = baker.make("places.Place", user=user)
    visit = baker.make("places.Visit", place=place)
    baker.make("places.VisitItem", visit=visit)

    response = auth_client.get(f"/api/visits/{visit.public_id}/")

    assert response.status_code == 200
    assert "items" in response.data
    assert len(response.data["items"]) == 1


@override_settings(**_STORAGE_SETTINGS)
def test_create_visit_photo_uses_image_service(auth_client, user, tmp_path, settings):
    settings.MEDIA_ROOT = str(tmp_path)
    place = baker.make("places.Place", user=user)
    photo = make_jpeg()
    raw = photo.getvalue()

    response = auth_client.post(
        f"/api/places/{place.public_id}/visits/",
        {**PAYLOAD, "photo": photo},
        format="multipart",
    )

    assert response.status_code == 201
    visit = place.visits.get(public_id=response.data["public_id"])
    assert visit.photo.name.startswith(f"users/{user.id}/visits/photos/")
    with default_storage.open(visit.photo.name, "rb") as stored_file:
        stored = stored_file.read()
    with Image.open(io.BytesIO(stored)) as image:
        assert image.format == "JPEG"
        assert image.size == (10, 10)
    assert stored == raw


def test_reject_foreign_place(auth_client, other_user):
    p = baker.make("places.Place", user=other_user)
    r = auth_client.post(f"/api/places/{p.public_id}/visits/", PAYLOAD, format="json")
    assert r.status_code == 404


def test_rating_out_of_range(auth_client, user):
    p = baker.make("places.Place", user=user)
    bad = {**PAYLOAD, "overall_rating": 11}
    response = auth_client.post(
        f"/api/places/{p.public_id}/visits/", bad, format="json"
    )
    assert response.status_code == 400


def test_negative_rating(auth_client, user):
    p = baker.make("places.Place", user=user)
    bad = {**PAYLOAD, "environment_rating": -1}
    response = auth_client.post(
        f"/api/places/{p.public_id}/visits/", bad, format="json"
    )
    assert response.status_code == 400
