# Testing

## Backend (pytest)

```bash
cd backend && source .venv/bin/activate

pytest                          # todos
pytest accounts/                # app específico
pytest -k test_name             # teste específico
pytest --cov=.                  # com cobertura
```

Config: `backend/pytest.ini` → `config.test_settings` (SQLite in-memory, MD5 hasher).
Fixtures: `model_bakery.baker`. Image tests: `@override_settings(SECRET_KEY=..., STORAGES={...})` + `tmp_path`.

### Suíte de segurança

Cobre: autorização cruzada, token attacks, throttle, payloads inválidos, uploads maliciosos, mídia cross-user.

```bash
pytest core/tests/test_security.py \
       core/tests/test_upload_security.py \
       core/tests/test_media_views.py \
       accounts/tests/test_token_security.py \
       accounts/tests/test_throttle.py -v
```

| Arquivo | O que testa |
|---------|------------|
| `test_security.py` | Isolamento de dados, PATCH/DELETE cross-user → 404, payloads inválidos → 4xx |
| `test_upload_security.py` | SVG/HTML/PHP disfarçados de imagem → 400 (magic bytes check) |
| `test_media_views.py` | Mídia de outro usuário → 404, sem token → 401 |
| `test_token_security.py` | Token expirado/adulterado/alg:none → 401, refresh reuse após logout → 401 |
| `test_throttle.py` | Brute force login → 429 (`AuthRateThrottle`, scope `auth`) |
| `places/tests/test_celery_config.py` | Configuração Celery, task `resolve_place_coords`, retry exponencial |

**Nota sobre throttle em testes**: `AuthRateThrottle` isenta CIDRs privados. Para triggar 429:
```python
@override_settings(
    THROTTLE_EXEMPT_CIDRS=[],
    CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}},
)
# + passar REMOTE_ADDR="203.0.113.42" em cada request
```

## Frontend (Vitest)

```bash
cd frontend
npm run test           # uma vez
npm run test:watch     # watch mode
npm run test -- --coverage
```

## E2E (Playwright)

```bash
cd frontend
npx playwright test                          # todos (requer backend vivo na porta 8181)
npx playwright test auth-negative            # por nome
npx playwright test --grep "nega"            # regex
npm run dev -- --port 8181                   # dev server na porta correta
```

Config: `frontend/playwright.config.ts` → baseURL `http://localhost:8181`.
Specs: `frontend/e2e/` — `login/`, `crud/`, `auth/`, `responsive.spec.ts`.
Happy-path: requer backend vivo. Negative/responsive: mock via `page.route` (sem backend).

## Load test (Locust)

```bash
# Criar usuários de teste
docker exec -it bora-ali-backend-1 python manage.py create_load_test_users 100

# Rodar (15 minutos, 100 usuários)
locust -f locustfile_realistic.py --host=http://localhost \
  --users 100 --spawn-rate 5 --run-time 15m --headless \
  --csv=load-tests/results/realistic-100
```

Baseline local: 0% falhas, median 22ms, p95 55ms com 100 usuários.

## Escopo deste documento

Este arquivo é um runbook humano de teste.

- padrões curtos para a LLM ficam em [SKILLS.md](/home/smovisk/PycharmProjects/boora-ali/SKILLS.md)
- snippets por domínio ficam em `skills/templates/`
- se um teste operacional depender de script dedicado, ele só deve aparecer aqui quando o script existir no repo
