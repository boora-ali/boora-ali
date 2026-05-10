# Backend — Bora Ali

Ver invariantes globais em `../CLAUDE.md`. Este arquivo cobre padrões específicos do backend.

## Apps e responsabilidades

```
config/       settings.py, urls.py, celery.py, telemetry.py (OpenTelemetry/Jaeger),
              admin_site.py (BoraAliAdminSite), test_settings.py
core/         Utilitários compartilhados (não em INSTALLED_APPS)
              PublicIdModel (abstract), exceptions, exception_handler,
              image_service, media_views, validators
accounts/     UserSession, UserProfile, GoogleIdentity,
              SingleSessionJWTAuthentication, throttles, signals
places/       Place (CoordsStatus enum), Visit, VisitItem
              managers.py — PlaceQuerySet, VisitQuerySet, VisitItemQuerySet (sempre select_related)
              signals.py  — cleanup_*photo via transaction.on_commit()
              tasks.py    — resolve_place_coords (Celery, bind=True, max_retries=3)
              maps.py     — extract_coords() via regex
```

Endpoints: `/api/health/` · `/api/auth/{register,login,refresh,logout,me,google}/` · `/api/places/` · `/api/places/{id}/visits/` · `/api/visits/{id}/items/` · `/api/media/<path>`

## Imagens — ImageService

```python
# Serializer: pop → save → set path
class PlaceWriteSerializer(serializers.ModelSerializer):
    def create(self, validated_data):
        cover_photo = validated_data.pop("cover_photo", None)
        instance = super().create(validated_data)  # salva model primeiro
        if cover_photo:
            ImageService.save(instance, cover_photo, category="places/covers")
        return instance

    def update(self, instance, validated_data):
        cover_photo = validated_data.pop("cover_photo", None)
        if cover_photo:
            ImageService.delete(instance.cover_photo)  # deleta antigo antes
            ImageService.save(instance, cover_photo, category="places/covers")
        return super().update(instance, validated_data)
```

Path: `users/{user_id}/{category}/{sha256[:16]}_{timestamp_ms}` (sem extensão).
Fernet por usuário: `HKDF(SHA256, salt=b"bora-ali-media-v1", info=user_id, ikm=SECRET_KEY)`.
`GET /api/media/<path>` → autentica JWT, confere `user_id` no path, descriptografa, stream. Retorna **404** (nunca 403).

## Auth — SingleSession

`UserSession` por usuário com `session_key` rotativo no JWT. Valkey cache TTL=270s (`session_key:{user_id}`).
`SingleSessionJWTAuthentication` valida `session_key` em toda request autenticada.
TTL access=30min. `ROTATE_REFRESH_TOKENS=True`. Logout blacklista refresh.

## Throttle

`AuthRateThrottle` (scope `"auth"`, 10/min) em login/register/me.
CIDRs privados isentos via `THROTTLE_EXEMPT_CIDRS`.
**Em testes**: `THROTTLE_EXEMPT_CIDRS=[]` + `CACHES=LocMemCache` + `REMOTE_ADDR="203.0.113.42"`.

## Google OAuth

`POST /api/auth/google/` aceita `{ id_token }`. Cria/acha user, `is_google_account=True`, troca de senha bloqueada.
Requer `GOOGLE_OAUTH_CLIENT_ID` no settings.

## Maps + Celery

`maps_url` → coords via regex em `PlaceWriteSerializer._sync_coords()`.
Quando `maps_url` presente no save → dispara `resolve_place_coords(place_pk)`.
Task: `bind=True`, `max_retries=3`, retry exponencial (60s, 120s, 240s).
`Place.coords_status`: `pending → resolved | failed`.
Broker/backend Valkey (DB 2). Config em `config/celery.py`.

## Storage

`USE_VERSITYGW=True` (default) → S3Boto3 → VersityGW. `False` = filesystem local.

## Testing

```bash
# Sempre de backend/ com venv ativo
pytest                      # todos
pytest accounts/            # app específico
pytest -k test_name         # filtro
pytest --tb=short           # traceback curto
```

- `pytest.ini` aponta para `config.test_settings` (SQLite in-memory, MD5 hasher)
- Fixtures: `model_bakery.baker` — não usar factories manuais
- Image tests: `@override_settings(SECRET_KEY=..., STORAGES={...})` + `tmp_path`
- Throttle tests: sempre setar `REMOTE_ADDR="203.0.113.42"` (IP público)
- Worktrees: `.worktrees/` → `git worktree add .worktrees/<branch> -b <branch>`

## Quando usar skills

| Situação | Skill |
|----------|-------|
| Criar serializer, viewset, router | `/django-expert` |
| Otimizar queryset (N+1, select_related) | `/django-expert` |
| Definir arquitetura de nova feature | `/django-patterns` |
| Implementar cache, signals, middleware | `/django-patterns` |
| Revisar código para vulnerabilidades | `/security-review` |
| Dúvida de segurança (CSRF, injection, perms) | `/security-review` |

## Gunicorn

3 workers, 2 threads, gthread. Config no `Dockerfile CMD` e `docker-compose.yml` — manter em sincronia.
