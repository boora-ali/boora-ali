from __future__ import annotations

import urllib.request
from decimal import Decimal
from urllib.parse import urlparse

from celery import shared_task

from .maps import extract_coords
from .models import CoordsStatus, Place

_ALLOWED_MAPS_HOSTS = {
    "maps.google.com",
    "maps.app.goo.gl",
    "goo.gl",
    "www.google.com",
    "maps.googleapis.com",
}


def _safe_maps_urlopen(url: str, timeout: int = 5):
    parsed = urlparse(url)
    if parsed.scheme != "https":
        raise ValueError(f"URL scheme não permitido: {parsed.scheme!r}")
    host = parsed.hostname or ""
    if not any(
        host == allowed or host.endswith("." + allowed)
        for allowed in _ALLOWED_MAPS_HOSTS
    ):
        raise ValueError(f"Host não permitido para resolução de Maps: {host!r}")
    return urllib.request.urlopen(url, timeout=timeout)  # nosec B310


def _resolve_place_coords(self, place_pk: int):
    place = Place.objects.filter(pk=place_pk).first()
    if place is None or place.coords_status != CoordsStatus.PENDING:
        return

    try:
        response = _safe_maps_urlopen(place.maps_url)
        lat, lng = extract_coords(response.url)
        if lat is None or lng is None:
            raise ValueError("Coordenadas não encontradas na URL do Maps")
    except Exception as exc:  # pragma: no cover - covered through retry tests
        if self.request.retries >= self.max_retries:
            place.coords_status = CoordsStatus.FAILED
            place.save(update_fields=["coords_status"])
            return
        countdown = 60 * (2**self.request.retries)
        raise self.retry(exc=exc, countdown=countdown)

    place.latitude = Decimal(str(lat))
    place.longitude = Decimal(str(lng))
    place.coords_status = CoordsStatus.RESOLVED
    place.save(update_fields=["latitude", "longitude", "coords_status"])


@shared_task(bind=True, max_retries=3)
def resolve_place_coords(self, place_pk: int):
    return _resolve_place_coords(self, place_pk)
