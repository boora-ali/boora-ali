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

exec su-exec app "$@"
