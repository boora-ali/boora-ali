"""Normalize EXIF orientation for stored media files in place.

Run inside the backend container:
    docker compose exec backend python manage.py normalize_media_orientation --dry-run
    docker compose exec backend python manage.py normalize_media_orientation
    docker compose exec backend python manage.py normalize_media_orientation --limit 10
"""

from __future__ import annotations

import io
from dataclasses import dataclass
from typing import Iterable

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand
from PIL import Image, ImageOps

from accounts.models import UserProfile
from core.image_service import ImageService
from places.models import Place, Visit, VisitItem

EXIF_ORIENTATION_TAG = 274


@dataclass(frozen=True)
class MediaTarget:
    label: str
    user_id: int
    path: str


def _iter_targets() -> Iterable[MediaTarget]:
    for user_id, path in UserProfile.objects.values_list("user_id", "profile_photo"):
        if path:
            yield MediaTarget("accounts.UserProfile.profile_photo", user_id, str(path))

    for user_id, path in Place.objects.values_list("user_id", "cover_photo"):
        if path:
            yield MediaTarget("places.Place.cover_photo", user_id, str(path))

    for user_id, path, path_fallback in Visit.objects.values_list(
        "place__user_id", "photo", "photo_path"
    ):
        resolved_path = path_fallback or path
        if resolved_path:
            yield MediaTarget("places.Visit.photo", user_id, str(resolved_path))

    for user_id, path, path_fallback in VisitItem.objects.values_list(
        "visit__place__user_id", "photo", "photo_path"
    ):
        resolved_path = path_fallback or path
        if resolved_path:
            yield MediaTarget("places.VisitItem.photo", user_id, str(resolved_path))


def _read_bytes(path: str) -> bytes:
    if hasattr(default_storage, "bucket"):
        return default_storage.bucket.Object(path).get()["Body"].read()
    with default_storage.open(path, "rb") as handle:
        return handle.read()


def _write_bytes(path: str, data: bytes, content_type: str) -> None:
    if hasattr(default_storage, "bucket"):
        default_storage.bucket.Object(path).put(Body=data, ContentType=content_type)
        return

    default_storage.delete(path)
    default_storage.save(path, ContentFile(data))


def _normalize_orientation(data: bytes) -> tuple[bytes, str, int | None]:
    with Image.open(io.BytesIO(data)) as img:
        orientation = img.getexif().get(EXIF_ORIENTATION_TAG)
        if orientation in (None, 1):
            return data, ImageService.detect_content_type(data), orientation

        normalized = ImageOps.exif_transpose(img)
        fmt = normalized.format or img.format or "JPEG"
        if normalized.mode not in ("RGB", "RGBA"):
            normalized = normalized.convert("RGB")
            fmt = "JPEG"

        buffer = io.BytesIO()
        save_kwargs = {"format": fmt, "optimize": True}
        if fmt in ("JPEG", "WEBP"):
            save_kwargs["quality"] = 82
        normalized.save(buffer, **save_kwargs)
        return (
            buffer.getvalue(),
            ImageService.detect_content_type(buffer.getvalue()),
            orientation,
        )


class Command(BaseCommand):
    help = "Normalize EXIF orientation for stored image fields in place."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would change; do not write to storage.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Stop after N unique media files (0 = no limit).",
        )

    def handle(self, *args, **opts):
        dry_run: bool = opts["dry_run"]
        limit: int = opts["limit"]

        stats = {
            "scanned": 0,
            "would_rewrite": 0,
            "rewritten": 0,
            "skipped_already_normal": 0,
            "skipped_missing": 0,
            "skipped_invalid": 0,
        }
        seen_paths: set[str] = set()

        for target in _iter_targets():
            if target.path in seen_paths:
                continue
            seen_paths.add(target.path)

            stats["scanned"] += 1
            if limit and stats["scanned"] > limit:
                stats["scanned"] -= 1
                break

            try:
                raw = _read_bytes(target.path)
            except Exception as exc:
                self.stderr.write(f"[err] cannot read {target.path}: {exc}")
                stats["skipped_missing"] += 1
                continue

            try:
                normalized, content_type, orientation = _normalize_orientation(raw)
            except Exception as exc:
                self.stderr.write(
                    f"[err] invalid image {target.path} ({target.label}): {exc}"
                )
                stats["skipped_invalid"] += 1
                continue

            if orientation in (None, 1):
                stats["skipped_already_normal"] += 1
                continue

            if dry_run:
                self.stdout.write(
                    f"[dry] would normalize {target.path} "
                    f"({target.label}, orientation={orientation})"
                )
                stats["would_rewrite"] += 1
                continue

            _write_bytes(target.path, normalized, content_type)
            self.stdout.write(
                f"[ok ] normalized {target.path} "
                f"({target.label}, orientation={orientation})"
            )
            stats["rewritten"] += 1

        self.stdout.write(self.style.SUCCESS(f"Done. {stats}"))
