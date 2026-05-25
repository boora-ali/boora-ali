import hashlib
import hmac
import io
import json
import time
from unittest.mock import MagicMock, patch

import pytest
from django.conf import settings
from model_bakery import baker
from PIL import Image

from core.image_service import ImageService
from places.models import Collection, CollectionPlace, CollectionShare, Place

pytestmark = pytest.mark.django_db


def _make_share_sig(token: str, path: str, exp: int):
    msg = json.dumps([token, path, exp], separators=(",", ":")).encode()
    return hmac.new(
        settings.MEDIA_ENCRYPTION_KEY.encode(), msg, hashlib.sha256
    ).hexdigest()


def _make_jpeg_bytes():
    buf = io.BytesIO()
    Image.new("RGB", (8, 8), color=(0, 255, 0)).save(buf, format="JPEG")
    return buf.getvalue()


def test_collection_share_create_returns_token_and_url(auth_client, user):
    collection = baker.make(Collection, user=user)
    baker.make("places.Place", user=user, _quantity=2)
    r = auth_client.post(f"/api/collections/{collection.public_id}/share/")
    assert r.status_code == 201
    assert "token" in r.data
    assert "url" in r.data
    assert r.data["token"] in r.data["url"]
    assert CollectionShare.objects.filter(
        source_collection=collection, owner=user
    ).exists()


def test_collection_share_create_generates_new_token_each_time(auth_client, user):
    collection = baker.make(Collection, user=user)
    url = f"/api/collections/{collection.public_id}/share/"
    r1 = auth_client.post(url)
    r2 = auth_client.post(url)
    assert r1.status_code == 201
    assert r2.status_code == 201
    assert r1.data["token"] != r2.data["token"]


def test_collection_share_create_handles_long_maps_url(auth_client, user):
    collection = baker.make(Collection, user=user)
    place = baker.make(
        "places.Place",
        user=user,
        maps_url="https://maps.google.com/?q=" + "m" * 370,
    )
    baker.make(CollectionPlace, collection=collection, place=place)

    response = auth_client.post(f"/api/collections/{collection.public_id}/share/")

    assert response.status_code == 201
    assert "token" in response.data


def test_collection_share_create_requires_auth(api_client, user):
    collection = baker.make(Collection, user=user)
    r = api_client.post(f"/api/collections/{collection.public_id}/share/")
    assert r.status_code == 401


def test_collection_share_create_wrong_user_returns_404(auth_client, other_user):
    collection = baker.make(Collection, user=other_user)
    r = auth_client.post(f"/api/collections/{collection.public_id}/share/")
    assert r.status_code == 404


def test_collection_share_revoke_sets_inactive(auth_client, user):
    collection = baker.make(Collection, user=user)
    share = baker.make(
        CollectionShare,
        owner=user,
        source_collection=collection,
        snapshot_name=collection.name,
        is_active=True,
    )
    r = auth_client.delete(
        f"/api/collections/{collection.public_id}/share/{share.token}/"
    )
    assert r.status_code == 204
    share.refresh_from_db()
    assert share.is_active is False


def test_collection_share_detail_returns_snapshot_data(api_client, user):
    collection = baker.make(Collection, user=user, name="Coleção", emoji="⭐")
    place = baker.make(
        "places.Place",
        user=user,
        name="Café X",
        category="cafe",
        address="Rua A, 10",
        notes="snapshot",
        status="favorite",
    )
    baker.make(CollectionPlace, collection=collection, place=place)
    share = baker.make(
        CollectionShare,
        owner=user,
        source_collection=collection,
        snapshot_name="Coleção",
        snapshot_emoji="⭐",
        snapshot_description="descrição",
        is_active=True,
    )
    baker.make(
        "places.CollectionSharePlaceSnapshot",
        share=share,
        source_place_public_id=place.public_id,
        name=place.name,
        category=place.category,
        address=place.address,
        instagram_url="",
        maps_url="",
        status=place.status,
        notes="snapshot",
        source_cover_photo_path="",
        cover_photo_path="",
        order_index=0,
    )

    r = api_client.get(f"/api/share/collections/{share.token}/")
    assert r.status_code == 200
    assert r.data["name"] == "Coleção"
    assert r.data["emoji"] == "⭐"
    assert r.data["place_count"] == 1
    assert r.data["places"][0]["name"] == "Café X"


def test_collection_share_detail_inactive_returns_404(api_client, user):
    collection = baker.make(Collection, user=user)
    share = baker.make(
        CollectionShare,
        owner=user,
        source_collection=collection,
        snapshot_name=collection.name,
        is_active=False,
    )
    r = api_client.get(f"/api/share/collections/{share.token}/")
    assert r.status_code == 404


def test_collection_share_media_returns_decrypted_content(api_client, user):
    collection = baker.make(Collection, user=user)
    share = baker.make(
        CollectionShare,
        owner=user,
        source_collection=collection,
        snapshot_name=collection.name,
        is_active=True,
    )
    path = "users/1/collection_shares/token/place/covers/img"
    baker.make(
        "places.CollectionSharePlaceSnapshot",
        share=share,
        source_place_public_id=baker.make("places.Place", user=user).public_id,
        name="Café",
        category="cafe",
        address="Rua",
        status="favorite",
        source_cover_photo_path=path,
        cover_photo_path=path,
        order_index=0,
    )
    exp = int(time.time()) + 3600
    sig = _make_share_sig(share.token, path, exp)

    fake_decrypted = _make_jpeg_bytes()
    fake_raw = ImageService.encrypt(fake_decrypted, user_id=user.pk)
    mock_file = MagicMock()
    mock_file.read.return_value = fake_raw

    with patch("places.services.default_storage") as mock_storage:
        mock_storage.open.return_value = mock_file
        r = api_client.get(
            f"/api/share/collections/{share.token}/media/{path}?sig={sig}&exp={exp}"
        )

    assert r.status_code == 200
    assert r.content == fake_decrypted


def test_collection_share_media_inactive_returns_404(api_client, user):
    collection = baker.make(Collection, user=user)
    share = baker.make(
        CollectionShare,
        owner=user,
        source_collection=collection,
        snapshot_name=collection.name,
        is_active=False,
    )
    path = "users/1/collection_shares/token/place/covers/img"
    r = api_client.get(
        f"/api/share/collections/{share.token}/media/{path}?sig=badsig&exp=123"
    )
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# CollectionShareImportView — POST /api/share/collections/{token}/import/
# ---------------------------------------------------------------------------


def test_collection_share_import_creates_collection(auth_client, user, other_user):
    source_collection = baker.make(
        Collection, user=other_user, name="Coleção", emoji="⭐", description="descr"
    )
    place = baker.make(
        Place,
        user=other_user,
        name="Café X",
        address="Rua A, 10",
        category="cafe",
        status="favorite",
    )
    baker.make(CollectionPlace, collection=source_collection, place=place)
    share = baker.make(
        CollectionShare,
        owner=other_user,
        source_collection=source_collection,
        snapshot_name="Coleção",
        snapshot_emoji="⭐",
        snapshot_description="descr",
        is_active=True,
    )
    baker.make(
        "places.CollectionSharePlaceSnapshot",
        share=share,
        source_place_public_id=place.public_id,
        name=place.name,
        category=place.category,
        address=place.address,
        instagram_url="",
        maps_url="",
        coords_status="resolved",
        latitude=None,
        longitude=None,
        status="favorite",
        notes="snapshot",
        source_cover_photo_path="",
        cover_photo_path="",
        order_index=0,
    )

    r = auth_client.post(f"/api/share/collections/{share.token}/import/")
    assert r.status_code == 201
    assert "public_id" in r.data
    assert Collection.objects.filter(user=user, name="Coleção").exists()
    imported_collection = Collection.objects.get(public_id=r.data["public_id"])
    assert imported_collection.collection_places.count() == 1


def test_collection_share_import_reuses_existing_place(auth_client, user, other_user):
    source_collection = baker.make(
        Collection, user=other_user, name="Coleção", emoji="⭐"
    )
    existing_place = baker.make(
        Place,
        user=user,
        name="Repetido",
        address="Rua Repetida, 1",
        category="cafe",
        status="favorite",
    )
    place = baker.make(
        Place,
        user=other_user,
        name=existing_place.name,
        address=existing_place.address,
        category="cafe",
        status="favorite",
    )
    baker.make(CollectionPlace, collection=source_collection, place=place)
    share = baker.make(
        CollectionShare,
        owner=other_user,
        source_collection=source_collection,
        snapshot_name="Coleção",
        snapshot_emoji="⭐",
        snapshot_description="",
        is_active=True,
    )
    baker.make(
        "places.CollectionSharePlaceSnapshot",
        share=share,
        source_place_public_id=place.public_id,
        name=place.name,
        category=place.category,
        address=place.address,
        instagram_url="",
        maps_url="",
        coords_status="resolved",
        latitude=None,
        longitude=None,
        status="favorite",
        notes="",
        source_cover_photo_path="",
        cover_photo_path="",
        order_index=0,
    )

    r = auth_client.post(f"/api/share/collections/{share.token}/import/")
    assert r.status_code == 201
    imported_collection = Collection.objects.get(public_id=r.data["public_id"])
    imported_place = imported_collection.collection_places.first().place
    assert imported_place.pk == existing_place.pk


def test_collection_share_import_owner_returns_400(auth_client, user):
    source_collection = baker.make(Collection, user=user, name="Coleção", emoji="⭐")
    share = baker.make(
        CollectionShare,
        owner=user,
        source_collection=source_collection,
        snapshot_name="Coleção",
        is_active=True,
    )
    r = auth_client.post(f"/api/share/collections/{share.token}/import/")
    assert r.status_code == 400
    assert "dono" in r.data["detail"]
