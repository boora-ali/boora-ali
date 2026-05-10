import io

import pytest
from django.test import override_settings

from core.image_service import ImageService


@pytest.fixture
def fake_image_bytes():
    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (10, 10), color=(255, 0, 0)).save(buf, format="JPEG")
    buf.seek(0)
    return buf.read()


@pytest.mark.django_db
def test_make_path_format():
    path = ImageService.make_path(42, "places/covers", b"some-data")
    assert path.startswith("users/42/places/covers/")
    parts = path.split("/")[-1].split("_")
    assert len(parts) == 2
    assert len(parts[0]) == 16  # sha256[:16]
    assert len(parts[1]) == 16  # token_hex(8) = 16 hex chars


@pytest.mark.django_db
def test_different_content_different_path():
    p1 = ImageService.make_path(1, "cat", b"data-a")
    p2 = ImageService.make_path(1, "cat", b"data-b")
    assert p1.split("/")[-1][:16] != p2.split("/")[-1][:16]


@pytest.mark.django_db
@override_settings(SECRET_KEY="test-secret-key-long-enough-for-hkdf-derivation-1234")
def test_encrypt_decrypt_roundtrip():
    data = b"hello image bytes"
    encrypted = ImageService.encrypt(data, user_id=7)
    assert encrypted != data
    decrypted = ImageService.decrypt(encrypted, user_id=7)
    assert decrypted == data


@pytest.mark.django_db
@override_settings(SECRET_KEY="test-secret-key-long-enough-for-hkdf-derivation-1234")
def test_different_users_cannot_cross_decrypt():
    data = b"secret image"
    encrypted = ImageService.encrypt(data, user_id=1)
    from cryptography.fernet import InvalidToken

    with pytest.raises(InvalidToken):
        ImageService.decrypt(encrypted, user_id=2)


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
def test_save_returns_valid_path(tmp_path, settings, fake_image_bytes):
    settings.MEDIA_ROOT = str(tmp_path)
    f = io.BytesIO(fake_image_bytes)
    f.name = "photo.jpg"
    path = ImageService.save(f, user_id=5, category="places/covers")
    assert path.startswith("users/5/places/covers/")


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
def test_delete_removes_file(tmp_path, settings, fake_image_bytes):
    settings.MEDIA_ROOT = str(tmp_path)
    f = io.BytesIO(fake_image_bytes)
    f.name = "photo.jpg"
    path = ImageService.save(f, user_id=5, category="places/covers")
    from django.core.files.storage import default_storage

    assert default_storage.exists(path)
    ImageService.delete(path)
    assert not default_storage.exists(path)


@pytest.mark.django_db
def test_delete_empty_path_is_noop():
    ImageService.delete("")
    ImageService.delete(None)
