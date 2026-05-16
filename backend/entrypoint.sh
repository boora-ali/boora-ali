#!/bin/sh
set -e

mkdir -p /app/staticfiles

chmod -R 777 /app/staticfiles || true
rm -rf /app/staticfiles/* || true
chmod -R 777 /app/staticfiles || true

python manage.py migrate --noinput
python manage.py collectstatic --noinput --clear
python manage.py compilemessages || true

chown -R app:app /app/staticfiles || true
chmod -R 775 /app/staticfiles || true

# X-Accel-Redirect temp dir: the named volume `media_temp` is created as
# root:root by Docker, but gunicorn runs as `app` via su-exec. Without this,
# Path.write_bytes() in core/media_views.py raises PermissionError -> HTTP 500.
mkdir -p /tmp/bora_ali_media
chown -R app:app /tmp/bora_ali_media || true
chmod 770 /tmp/bora_ali_media || true

exec su-exec app "$@"
