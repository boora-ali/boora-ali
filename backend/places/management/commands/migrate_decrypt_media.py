"""Decrypt all Fernet-encrypted media in R2 in-place and re-upload as plaintext
with the correct Content-Type. Idempotent: already-plaintext files are skipped.

Run inside the backend container:
    docker compose exec backend python manage.py migrate_decrypt_media --dry-run
    docker compose exec backend python manage.py migrate_decrypt_media
    docker compose exec backend python manage.py migrate_decrypt_media --limit 10
    docker compose exec backend python manage.py migrate_decrypt_media --prefix users/6/
"""

from __future__ import annotations

import io
from typing import Iterable

from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand, CommandError
from PIL import Image

from core.image_service import ImageService

_CONTENT_TYPES = {
    "JPEG": "image/jpeg",
    "PNG": "image/png",
    "WEBP": "image/webp",
}


def _inspect(data: bytes) -> tuple[bool, str | None]:
    """Return (is_image, content_type)."""
    try:
        img = Image.open(io.BytesIO(data))
        fmt = img.format
        img.verify()
        return True, _CONTENT_TYPES.get(fmt, "application/octet-stream")
    except Exception:
        return False, None


def _iter_keys(prefix: str) -> Iterable[str]:
    """Yield every S3 key under `prefix`. Requires S3Boto3Storage."""
    if not hasattr(default_storage, "bucket"):
        raise CommandError(
            "default_storage has no .bucket attribute — only S3-compatible "
            "storage is supported (cannot run on local filesystem)."
        )
    for obj in default_storage.bucket.objects.filter(Prefix=prefix):
        yield obj.key


class Command(BaseCommand):
    help = "Decrypt legacy Fernet-encrypted media in object storage in-place."

    def add_arguments(self, parser):
        parser.add_argument(
            "--prefix",
            default="users/",
            help="Object key prefix to scan (default: 'users/').",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would change; do not write to storage.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Stop after N processed objects (0 = no limit).",
        )

    def handle(self, *args, **opts):
        prefix: str = opts["prefix"]
        dry_run: bool = opts["dry_run"]
        limit: int = opts["limit"]

        stats = {
            "scanned": 0,
            "skipped_plaintext": 0,
            "rewrote": 0,
            "would_rewrite": 0,
            "fixed_content_type": 0,
            "failed_decrypt": 0,
            "failed_parse_user": 0,
            "decrypted_but_not_image": 0,
        }

        bucket = default_storage.bucket

        for key in _iter_keys(prefix):
            stats["scanned"] += 1
            if limit and stats["scanned"] > limit:
                stats["scanned"] -= 1
                break

            try:
                obj = bucket.Object(key).get()
                data = obj["Body"].read()
                existing_ct = obj.get("ContentType") or ""
            except Exception as exc:
                self.stderr.write(f"[err] cannot read {key}: {exc}")
                continue

            is_image, content_type = _inspect(data)

            if is_image:
                if existing_ct == content_type:
                    stats["skipped_plaintext"] += 1
                    continue
                if dry_run:
                    self.stdout.write(
                        f"[dry] would fix Content-Type {key}: "
                        f"{existing_ct!r} -> {content_type!r}"
                    )
                    stats["fixed_content_type"] += 1
                    continue
                bucket.Object(key).copy_from(
                    CopySource={"Bucket": bucket.name, "Key": key},
                    MetadataDirective="REPLACE",
                    ContentType=content_type,
                )
                self.stdout.write(
                    f"[ok ] fixed Content-Type {key} -> {content_type}"
                )
                stats["fixed_content_type"] += 1
                continue

            try:
                user_id = int(key.split("/")[1])
            except (IndexError, ValueError):
                self.stderr.write(f"[err] cannot parse user_id from {key}")
                stats["failed_parse_user"] += 1
                continue

            try:
                plaintext = ImageService.decrypt(data, user_id)
            except Exception as exc:
                self.stderr.write(f"[err] decrypt failed for {key}: {exc}")
                stats["failed_decrypt"] += 1
                continue

            is_image, content_type = _inspect(plaintext)
            if not is_image:
                self.stderr.write(
                    f"[err] decrypted bytes are not a valid image: {key}"
                )
                stats["decrypted_but_not_image"] += 1
                continue

            if dry_run:
                self.stdout.write(
                    f"[dry] would rewrite {key} as {content_type} "
                    f"({len(plaintext)} bytes)"
                )
                stats["would_rewrite"] += 1
                continue

            bucket.Object(key).put(Body=plaintext, ContentType=content_type)
            self.stdout.write(
                f"[ok ] rewrote {key} -> {content_type} ({len(plaintext)} bytes)"
            )
            stats["rewrote"] += 1

        self.stdout.write(self.style.SUCCESS(f"Done. {stats}"))
