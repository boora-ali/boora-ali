# Infra: Docker Compose + Valkey + VersityGW + Jaeger

## Serviços em execução

| Serviço | URL | Uso |
|---------|-----|-----|
| Frontend (nginx) | `http://localhost` | SPA React |
| Backend API | `http://localhost/api/` | Django via nginx proxy |
| Health check | `http://localhost/api/health/` | `{"status":"ok"}` — sem auth |
| VersityGW S3 | `http://localhost:8081` | S3 API (boto3) |
| VersityGW WebGUI | `http://localhost:8082` | Interface web do storage |
| Jaeger UI | `http://localhost:16686` | Traces OpenTelemetry |
| Valkey | `localhost:6379` | Cache interno (não exposto externamente) |

## docker-compose.yml — serviços principais

```yaml
services:
  valkey:
    image: valkey/valkey:9.0.3-alpine
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: "0.1"
          memory: 128M
    command: valkey-server --maxmemory 100mb --maxmemory-policy allkeys-lru
    healthcheck:
      test: ["CMD", "valkey-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: "1.8"
          memory: 3372M   # 3500M total - 128M Valkey
    environment:
      REDIS_URL: redis://valkey:6379/1
      POSTGRES_HOST: postgres
    depends_on:
      postgres:
        condition: service_healthy
      valkey:
        condition: service_healthy

  frontend:
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 256M
```

## Dockerfile backend — padrão correto

```dockerfile
ENTRYPOINT ["./entrypoint.sh"]   # migrate + compilemessages, depois exec "$@"
CMD ["gunicorn", "config.wsgi:application",
     "--bind", "0.0.0.0:8000",
     "--workers", "3",
     "--threads", "2",
     "--worker-class", "gthread",
     "--timeout", "60",
     "--log-level", "info",
     "--access-logfile", "-",
     "--error-logfile", "-"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget -qO- http://localhost:8000/api/health/ || exit 1
```

**Regras:**
- `ENTRYPOINT` = fixo (sempre roda migrations). `CMD` = substituível por orquestrador.
- `exec "$@"` no entrypoint.sh garante que gunicorn seja PID 1 (recebe sinais do Docker corretamente).
- `docker-compose.yml` não tem `command:` — herda o CMD do Dockerfile. Manter em sync.

## Gunicorn — dimensionamento

| VPS | Workers | Threads | Worker class |
|-----|---------|---------|--------------|
| 2 vCPU / 4 GB | 3 | 2 | gthread |
| 4 vCPU / 8 GB | 5 | 2 | gthread |

Regra geral: `workers = (2 × vCPUs) + 1`. Com I/O remoto (Supabase, R2), gthread aproveita melhor que sync.

## Valkey — uso no projeto

**Cache de sessão** (`accounts/authentication.py`):
```python
cache_key = f"session_key:{user.pk}"
# TTL = 270s (abaixo do lifetime do access token SimpleJWT)
# Invalidado imediatamente em UserSession.rotate() (novo login)
```

**Cache configurado em** `settings.py`:
```python
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": os.getenv("REDIS_URL", "redis://127.0.0.1:6379/1"),
    }
}
```

## Protecao de cadastro

- O form de registro carrega um honeypot oculto `website`.
- O backend rejeita cadastro quando o campo oculto vem preenchido.
- O stack já tem throttle de auth em `register`, `login`, `password` e `google login`.

## PostgreSQL — conexões

```python
DATABASES = {
    "default": {
        ...
        "CONN_MAX_AGE": 60,  # reutiliza conexão por thread por 60s
    }
}
```

Em produção com Supabase: usar porta `6543` (PgBouncer transaction mode), não `5432`.

## nginx (frontend/nginx.conf)

```nginx
gzip on;
gzip_comp_level 6;
gzip_types text/css application/javascript application/json image/svg+xml;

location /assets/ {
    # Vite gera nomes com hash — imutável por 1 ano
    add_header Cache-Control "public, max-age=31536000, immutable" always;
}

location = /index.html {
    # SPA entry — nunca cachear
    add_header Cache-Control "no-cache, no-store, must-revalidate" always;
}
```

**Atenção**: `add_header` não herda entre locations. Re-declarar security headers em cada location que define os próprios.

## VersityGW — criar bucket (obrigatório na primeira vez)

```bash
export AWS_ACCESS_KEY_ID=minioadmin
export AWS_SECRET_ACCESS_KEY=minioadmin
export AWS_DEFAULT_REGION=us-east-1

aws --endpoint-url http://localhost:8081 --region us-east-1 \
  s3api create-bucket --bucket bora-ali

# Verificar:
aws --endpoint-url http://localhost:8081 --region us-east-1 s3 ls
```

**Não usar `aws s3 mb`** — pode enviar `LocationConstraint` incompatível.

## Load test

```bash
# Pré-requisito
docker exec -it bora-ali-backend-1 python manage.py create_load_test_users 100

# Rodar
locust -f locustfile_realistic.py --host=http://localhost \
  --users 100 --spawn-rate 5 --run-time 15m --headless \
  --csv=load-tests/results/realistic-100
```

Resultados baseline (local, sem Supabase/R2):
- `GET /api/places/` → 21ms median, 36ms p95
- Login → 540ms median (PBKDF2/Argon2 — esperado)
- 0% falhas com 100 usuários

## Produção — checklist de infra

- [ ] `REDIS_URL` apontando para Valkey local no VPS (não expor porta externamente)
- [ ] `POSTGRES_PORT=6543` (PgBouncer Supabase)
- [ ] Cloudflare na frente: proxy ligado, SSL Full Strict
- [ ] Page Rule: `/api/*` → Cache Level Bypass
- [ ] `DJANGO_SECRET_KEY` forte, `DJANGO_DEBUG=False` (já é o default)
- [ ] `PUBLIC_BASE_URL` com domínio real para `ALLOWED_HOSTS`

## OpenTelemetry

```env
OTEL_SERVICE_NAME=bora-ali
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318/v1/traces
```

Rastreia automaticamente requests HTTP, queries SQL e logs correlacionados. Jaeger UI: `http://localhost:16686`.
