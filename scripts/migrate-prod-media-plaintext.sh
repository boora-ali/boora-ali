#!/usr/bin/env bash
set -Eeuo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
SERVICE="${SERVICE:-backend}"
PREFIX="${PREFIX:-users/}"
LIMIT="${LIMIT:-}"
MODE="${1:-dry-run}"

usage() {
  cat <<'EOF'
Usage:
  scripts/migrate-prod-media-plaintext.sh dry-run
  CONFIRM_MEDIA_MIGRATION=yes scripts/migrate-prod-media-plaintext.sh run

Optional env:
  COMPOSE_FILE=docker-compose.prod.yml
  SERVICE=backend
  PREFIX=users/
  LIMIT=10

What it does:
  Runs Django's migrate_decrypt_media command inside the backend container.
  It rewrites legacy Fernet-encrypted media in R2 as plaintext images with the
  correct Content-Type. Plaintext images are skipped or only have Content-Type fixed.
EOF
}

if [[ "$MODE" != "dry-run" && "$MODE" != "run" ]]; then
  usage
  exit 2
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "[err] compose file not found: $COMPOSE_FILE" >&2
  exit 2
fi

if [[ "$MODE" == "run" && "${CONFIRM_MEDIA_MIGRATION:-}" != "yes" ]]; then
  echo "[err] refusing to write without CONFIRM_MEDIA_MIGRATION=yes" >&2
  echo "      first run: scripts/migrate-prod-media-plaintext.sh dry-run" >&2
  exit 2
fi

compose=(docker compose -f "$COMPOSE_FILE")
cmd=(python manage.py migrate_decrypt_media --prefix "$PREFIX")

if [[ -n "$LIMIT" ]]; then
  cmd+=(--limit "$LIMIT")
fi

if [[ "$MODE" == "dry-run" ]]; then
  cmd+=(--dry-run)
fi

echo "[info] checking backend storage settings"
"${compose[@]}" exec -T "$SERVICE" python manage.py shell -c \
  "from django.conf import settings; from django.core.files.storage import default_storage; print({'USE_VERSITYGW': settings.USE_VERSITYGW, 'USE_R2': settings.USE_R2, 'bucket': getattr(settings, 'AWS_STORAGE_BUCKET_NAME', ''), 'endpoint': getattr(settings, 'AWS_S3_ENDPOINT_URL', ''), 'storage': type(default_storage).__name__})"

echo "[info] running: ${cmd[*]}"
"${compose[@]}" exec -T "$SERVICE" "${cmd[@]}"

if [[ "$MODE" == "dry-run" ]]; then
  echo "[ok] dry-run complete. Review output, then run:"
  echo "     CONFIRM_MEDIA_MIGRATION=yes scripts/migrate-prod-media-plaintext.sh run"
else
  echo "[ok] media migration complete"
fi
