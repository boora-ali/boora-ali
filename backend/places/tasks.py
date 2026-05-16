from __future__ import annotations

import logging
import urllib.request
from datetime import timedelta
from decimal import Decimal
from urllib.parse import urlparse

from celery import shared_task
from django.conf import settings
from django.utils import timezone

from .maps import extract_coords
from .models import CoordsStatus, Place

_log = logging.getLogger("places.tasks")

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
            _log.error(
                "resolve_place_coords falhou após %d tentativas: place_pk=%s maps_url=%r exc=%s",
                self.max_retries + 1,
                place_pk,
                place.maps_url,
                exc,
            )
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


@shared_task
def cleanup_old_history():
    from .models import Visit, VisitItem

    cutoff = timezone.now() - timedelta(days=settings.HISTORY_RETENTION_DAYS)

    deleted = {
        "place": Place.history.filter(history_date__lt=cutoff).delete()[0],
        "visit": Visit.history.filter(history_date__lt=cutoff).delete()[0],
        "visit_item": VisitItem.history.filter(history_date__lt=cutoff).delete()[0],
    }

    _log.info("History cleanup complete: %s", deleted)
    return deleted
