# Perf #4 — Valkey como ponto único de falha

> ✅ **IMPLEMENTADO**

## Problema

O mesmo Valkey é usado para **três responsabilidades diferentes**:
1. Cache de `session_key` (DB padrão) — TTL 270s, validado em **toda** request autenticada
2. Broker do Celery (DB 2) — filas de tasks (`resolve_place_coords`)
3. Backend de resultados do Celery (DB 2) — resultado das tasks

Se o Valkey cair ou ficar lento:
- **Todas** as requests autenticadas falham (sessão não pode ser validada)
- Tasks Celery param de ser enfileiradas e processadas
- Não há fallback, circuit breaker, ou health check exposto

**Arquivos relevantes:**
- `backend/config/settings.py` — configuração do cache e Celery
- `backend/config/celery.py` — broker/backend Valkey
- `backend/accounts/` — `SingleSessionJWTAuthentication` usa o cache

---

## Objetivo

Separar as responsabilidades em DBs distintos e adicionar TTL de fallback para o cache de sessão,
reduzindo o impacto de falha parcial do Valkey.

---

## Skills a invocar antes de implementar

- `/django-expert` — configuração de cache Django, Celery broker/backend, health checks
- `/bora-ali-backend` — convenções do projeto (SingleSessionJWTAuthentication, settings, celery.py)

---

## Arquivos que serão mexidos

| Arquivo | O que muda |
|---------|-----------|
| `backend/config/settings.py` | Separar DBs: sessão → DB 0, Celery broker → DB 1, Celery results → DB 2 |
| `backend/config/celery.py` | Atualizar `broker_url` e `result_backend` para DB 1 e DB 2 |
| `backend/accounts/authentication.py` | Adicionar fallback de graceful degradation quando cache indisponível |
| `docker-compose.yml` | (opcional) Adicionar `healthcheck` no serviço Valkey |

---

## Implementação passo a passo

### 1. settings.py — separar DBs

```python
# backend/config/settings.py
VALKEY_HOST = env("VALKEY_HOST", default="valkey")
VALKEY_PORT = env.int("VALKEY_PORT", default=6379)

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": f"redis://{VALKEY_HOST}:{VALKEY_PORT}/0",  # DB 0 — sessões
        "TIMEOUT": 300,
    }
}

# Celery — DBs separados
CELERY_BROKER_URL = f"redis://{VALKEY_HOST}:{VALKEY_PORT}/1"      # DB 1 — broker
CELERY_RESULT_BACKEND = f"redis://{VALKEY_HOST}:{VALKEY_PORT}/2"  # DB 2 — results
```

### 2. config/celery.py — atualizar referências

```python
# backend/config/celery.py
app.config_from_object("django.conf:settings", namespace="CELERY")
# broker_url e result_backend já vêm do settings via namespace
```

### 3. accounts/authentication.py — graceful degradation

```python
# backend/accounts/authentication.py
from django.core.cache import cache, CacheKeyWarning
import warnings

class SingleSessionJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        result = super().authenticate(request)
        if result is None:
            return None

        user, token = result
        try:
            cached_key = cache.get(f"session_key:{user.pk}")
            token_key = token.payload.get("session_key")
            if cached_key is not None and cached_key != token_key:
                raise SessionInvalidatedException()
        except Exception as exc:
            # Se o cache está indisponível, logar mas não bloquear
            # (evita downtime total por falha de cache)
            if not isinstance(exc, SessionInvalidatedException):
                import logging
                logging.getLogger("accounts.auth").warning(
                    "Cache unavailable for session validation: %s", exc
                )
            else:
                raise

        return user, token
```

> **Trade-off**: graceful degradation significa que se o Valkey cair, sessões revogadas
> (ex: logout em outro dispositivo) podem continuar válidas até o access token expirar (30 min).
> Discutir com o usuário se esse trade-off é aceitável.

### 4. docker-compose.yml — healthcheck

```yaml
services:
  valkey:
    image: valkey/valkey:latest
    healthcheck:
      test: ["CMD", "valkey-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 5s
```

---

## Verificação

```bash
scripts/dev-check.sh backend
```

Teste manual: parar o Valkey (`docker compose stop valkey`) e verificar se a API
retorna 503 ou continua respondendo (depende do nível de graceful degradation escolhido).
