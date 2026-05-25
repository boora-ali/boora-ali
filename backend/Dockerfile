FROM python:3.12-slim AS builder

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install gunicorn -r requirements.txt && \
    find /install -name "*.pyc" -delete && \
    find /install -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true && \
    find /install -name "tests" -type d -exec rm -rf {} + 2>/dev/null || true


FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HOME=/home/app \
    DJANGO_SETTINGS_MODULE=config.settings

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    libffi8 \
    gettext \
    gosu \
    wget \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local

WORKDIR /app
COPY . .

RUN groupadd -r app && useradd -r -m -d /home/app -g app app && \
    chmod +x /app/entrypoint.sh && \
    mkdir -p /app/staticfiles && \
    mkdir -p /home/app && \
    chown -R app:app /home/app && \
    chmod -R 777 /app/staticfiles

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8000/api/health/ || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["gunicorn", "config.wsgi:application", \
     "--bind", "0.0.0.0:8000", \
     "--workers", "2", \
     "--threads", "4", \
     "--worker-class", "gthread", \
     "--worker-tmp-dir", "/tmp", \
     "--timeout", "60", \
     "--log-level", "info", \
     "--access-logfile", "-", \
     "--error-logfile", "-"]
