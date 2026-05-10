# CLAUDE.md

**Bora Ali** — diário pessoal de lugares. `User → Place → Visit → VisitItem`.

## Stack
- **backend/**: Django + DRF + SimpleJWT + PostgreSQL + Valkey
- **frontend/**: React + Vite + TypeScript + Tailwind + react-hook-form + Zod, nginx (`/api/` → backend)
- **docker-compose.yml** (root): frontend, backend, postgres, valkey, VersityGW, Jaeger

## Commands

```bash
# backend/ (venv: backend/.venv)
pytest / pytest accounts/ / pytest -k test_name
python manage.py makemigrations && python manage.py migrate
 ruff format --check . && ruff check .
python manage.py makemessages -l pt_BR && python manage.py compilemessages

## Não mexer automaticamente

- `backend/*/migrations/`
- migrations antigas não devem ser reformadas por formatter/linter automático
- se uma migration precisar mudar, faça isso de forma manual e isolada

# frontend/
npm run dev / npm run build / npm run test / npm run lint
npx playwright test  # e2e (baseURL http://localhost:8181)

# root
docker compose up -d --build
bash scripts/test_nginx_security.sh  # requer stack rodando
locust -f locustfile_realistic.py --host=http://localhost --users 100 --spawn-rate 5 --run-time 15m --headless
```

Services: `localhost` (frontend) · `localhost/api/` · `localhost/api/health/` · `:8081` (VersityGW) · `:16686` (Jaeger)

## Regras que afetam todo código novo

**Ownership**: todo queryset filtra por `request.user` — nunca vazar dados de outro usuário.
- Place: `filter(user=request.user)` · Visit: `filter(place__user=...)` · VisitItem: `filter(visit__place__user=...)`

**public_id**: UUID exposto em todas URLs/payloads. `id` = PK interno só para FK. `lookup_field = "public_id"` nos ViewSets.

**Erros**: raise de `core.exceptions` (nunca DRF cru). Handler `core/exception_handler.semantic_exception_handler` → `{"code","detail"}`. Exceções disponíveis: `ActionFailedException`, `PermissionNotAllowedException`, `ForeignKeyException`, `InvalidPasswordException`, `InvalidCredentialsException`, `InvalidTokenException`, `SessionExpiredException`, `SessionInvalidatedException`, `SessionNotFoundException`, `UserNotFoundException`, `NoRecordFoundException`.

**Signals**: deleção de imagens no storage é feita via signals (nunca manualmente). `accounts/signals.py`: `cleanup_profile_photo` (post_delete UserProfile). `places/signals.py`: `cleanup_place_cover_photo`, `cleanup_visit_photo`, `cleanup_visit_item_photo` — todos usam `transaction.on_commit()` para garantir atomicidade.

**Imagens**: sempre via `core.image_service.ImageService` — nunca salvar direto no ImageField.
- Path: `users/{user_id}/{category}/{sha256[:16]}_{timestamp_ms}` (sem extensão)
- Categorias: `profiles` / `places/covers` / `visits/photos` / `visit_items/photos`
- Fernet por usuário: `HKDF(SHA256, salt=b"bora-ali-media-v1", info=user_id, ikm=SECRET_KEY)`
- Serializer: pop campo → `ImageService.save()` → set path. Update: deleta antigo antes. Create: salva model primeiro, depois imagem.
- `GET /api/media/<path>` autentica JWT, confere `user_id` no path, descriptografa, stream. Retorna 404 (nunca 403) para arquivo errado/outro usuário.

**Auth tokens**: `localStorage`. TTL access=30min. `ROTATE_REFRESH_TOKENS=True`. Logout blacklista refresh.

**Single-session**: `UserSession` por usuário com `session_key` rotativo no JWT, validado por `SingleSessionJWTAuthentication`. Valkey cache TTL=270s (`session_key:{user_id}`).

**Throttle**: login/register/me usam `AuthRateThrottle` (scope `"auth"`, `10/min`). CIDRs privados isentos via `THROTTLE_EXEMPT_CIDRS`. Em testes: `THROTTLE_EXEMPT_CIDRS=[]` + `CACHES=LocMemCache` + `REMOTE_ADDR="203.0.113.42"`.

**Maps**: `maps_url` → `latitude`/`longitude` via regex em `PlaceWriteSerializer._sync_coords()`. Coordenadas resolvidas de forma assíncrona via task Celery `resolve_place_coords` (retry exponencial: 60s, 120s, 240s). `Place.coords_status`: `pending` → `resolved` | `failed`.

**Celery**: broker/backend = Valkey (DB 2). Task `places.tasks.resolve_place_coords(place_pk)` — `bind=True, max_retries=3`. Disparada no save do Place quando `maps_url` presente. Config em `config/celery.py`, worker service no docker-compose.

**Storage**: `USE_VERSITYGW=True` (default) → S3Boto3 → VersityGW. `False` = filesystem local.

**i18n**: backend gettext + `LocaleMiddleware`. Frontend react-i18next, `frontend/src/locales/<lang>/translation.json`.

**DEBUG**: `DJANGO_DEBUG` default `"False"`. Setar `True` explicitamente no `.env` local.

## Backend Structure

```
backend/
  config/         # settings.py, urls.py, wsgi.py, celery.py, telemetry.py (OpenTelemetry/Jaeger), admin_site.py (BoraAliAdminSite), test_settings.py
  core/           # utilitários compartilhados (não em INSTALLED_APPS)
    models.py           # PublicIdModel (abstract)
    exceptions.py       # exceções semânticas tipadas
    exception_handler.py
    validators.py       # validate_image_upload(), validate_safe_url()
    image_service.py    # ImageService
    media_views.py      # serve_user_media → GET /api/media/<path>
    tests/              # test_security.py, test_media_views.py, test_upload_security.py, test_image_service.py, test_models.py
  accounts/       # UserSession, UserProfile, GoogleIdentity, SingleSessionJWTAuthentication
    authentication.py
    throttles.py        # AuthRateThrottle
    signals.py          # cleanup_profile_photo (post_delete)
    management/commands/create_load_test_users.py
    tests/              # test_auth.py, test_single_session.py, test_token_security.py, test_throttle.py, test_serializer_image.py
  places/         # Place (CoordsStatus enum), Visit, VisitItem
    managers.py         # PlaceQuerySet, VisitQuerySet, VisitItemQuerySet (sempre select_related)
    signals.py          # cleanup_place_cover_photo, cleanup_visit_photo, cleanup_visit_item_photo (transaction.on_commit)
    tasks.py            # resolve_place_coords — Celery task assíncrona para resolver coords via Maps URL
    maps.py             # extract_coords() — regex para extrair lat/lng de URLs do Google Maps
    tests/              # test_places.py, test_visits.py, test_visit_items.py, test_image_signals.py, test_serializer_images.py, test_celery_config.py
  entrypoint.sh   # migrate + compilemessages → exec gunicorn (PID 1)
```

Endpoints: `/api/health/` · `/api/auth/{register,login,refresh,logout,me,google}/` · `/api/places/` · `/api/places/{public_id}/visits/` · `/api/visits/{public_id}/items/` · `/api/media/<path>`

**Gunicorn**: 3 workers, 2 threads, gthread. Config em `Dockerfile CMD` e `docker-compose.yml` (manter em sincronia).

Detalhes completos de padrões backend em `backend/CLAUDE.md`.

## Frontend Structure

```
frontend/src/
  routes/       # LoginPage, RegisterPage, PlacesPage, PlaceDetailPage, New/EditPlacePage, New/EditVisitPage, AccountPage
  components/ui/  # Button, Input (forwardRef), Select (forwardRef), Textarea (forwardRef), PasswordInput (forwardRef),
                  # Card, Modal, LocationPicker, DateTimePicker, RatingInput, AuthImage, ...
  components/places/ · components/visits/
  schemas/      # auth.ts, place.ts, visit.ts — Zod schemas + tipos inferidos
  services/     # api.ts, api-errors.ts, auth/places/visits/visit-items.service.ts, form-data.ts
  contexts/     # AuthContext.tsx, useAuth.ts (hook), auth.ts
  utils/        # form-errors.ts (applyApiErrors), url.ts, formatters.ts, constants.ts
  locales/      # pt/en translation.json
```

- `api.ts`: Bearer token, 401 → refresh → logout, salva tokens rotacionados, detecta session codes.
- `api-errors.ts`: `getApiErrorState(error, fallback)` → `{ message, fieldErrors }` — usar em todo catch de form.
- `form-errors.ts`: `applyApiErrors(setError, fieldErrors)` — mapeia erros da API para campos RHF.
- `constants.ts`: `ACCESS_KEY`, `REFRESH_KEY`, `SESSION_INVALIDATED_KEY`, `PLACE_STATUSES`, `VISIT_ITEM_TYPES`.

**Formulários**: React Hook Form + Zod em todos. `useForm({ resolver: zodResolver(schema) })`. `Controller` para inputs customizados (RatingInput, DateTimePicker, Select tipado). `register()` para inputs HTML nativos. Fotos gerenciadas como estado local — nunca campo RHF. Ver `frontend/CLAUDE.md` para padrão completo.

**Tipos form vs API**: `latitude`/`longitude` = `string` em todo o frontend (Place type, schema, LocationPicker). `VisitItem.price` = `number` no form, convertido para `string` em `toPayload()` do service.

**nginx**: gzip; `/assets/` imutable cache 1y; `/index.html` no-cache; security headers em cada `location` (não herda).

**Visual**: primary `#EA1D2C`, bg `#FAFAFA`, mobile-first. Upload: dropzone dashed em PlaceForm/VisitForm/VisitItemForm.

## Testing

- `backend/pytest.ini` → `config.test_settings` (SQLite in-memory, MD5 hasher). Rodar de `backend/` com venv ativo.
- Fixtures: `model_bakery.baker`. Image tests: `@override_settings(SECRET_KEY=..., STORAGES={...})` + `tmp_path`.
- E2E: `frontend/e2e/`. Happy-path requer backend vivo. Negative/responsive: mock via `page.route`.
- Worktrees: `.worktrees/` → `git worktree add .worktrees/<branch> -b <branch>`

## Google OAuth

`POST /api/auth/google/` aceita `{ id_token }`. Cria/acha user, `is_google_account=True`, troca de senha bloqueada. Requer `GOOGLE_OAUTH_CLIENT_ID` + `VITE_GOOGLE_OAUTH_CLIENT_ID`.

## Production Checklist

- [ ] `DJANGO_SECRET_KEY` 50+ chars
- [ ] `POSTGRES_PORT=6543` (PgBouncer Supabase)
- [ ] `PUBLIC_BASE_URL` com domínio real
- [ ] Cloudflare: SSL Full Strict, `/api/*` bypass cache
- [ ] `REDIS_URL` apontando para Valkey do VPS

**Scripts**: `scripts/test_nginx_security.sh` (audit headers/segurança nginx), `scripts/ngrok-preprod.sh` (túnel ngrok para preprod), `scripts/po-to-i18n.cjs` (converte .po → JSON para frontend i18n).

**Fora do escopo**: microservices, websockets, social feeds, payments, PWA, Facebook/Apple OAuth.
