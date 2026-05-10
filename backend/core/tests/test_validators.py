import pytest
from rest_framework import serializers

from core.validators import validate_google_maps_url


@pytest.mark.parametrize(
    "url",
    [
        "https://www.google.com/maps/place/Foo/@-23.5,-46.6,17z",
        "https://maps.google.com/?q=-23.5,-46.6",
        "https://maps.app.goo.gl/abc123",
        "https://goo.gl/maps/xyz",
    ],
)
def test_accepts_google_maps_urls(url):
    assert validate_google_maps_url(url) == url


@pytest.mark.parametrize(
    "url",
    [
        "https://evil.com/maps",
        "https://google.com.evil.com/maps",
        "ftp://maps.google.com/",
        "javascript:alert(1)",
        "",
    ],
)
def test_rejects_non_google_urls(url):
    with pytest.raises(serializers.ValidationError):
        validate_google_maps_url(url)
