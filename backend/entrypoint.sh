#!/bin/sh
set -e

mkdir -p /app/staticfiles

chown -R app:app /app/staticfiles
chmod -R 775 /app/staticfiles

python manage.py migrate --noinput
python manage.py collectstatic --noinput
python manage.py compilemessages

exec su-exec app "$@"
