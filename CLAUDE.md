# Bora Ali

Diário pessoal de lugares. `User → Place → Visit → VisitItem`.

## Stack

- **backend/**: Django 5.2 + DRF + SimpleJWT + PostgreSQL + Valkey
- **frontend/**: React + Vite + TypeScript + Tailwind + RHF + Zod
- **infra**: nginx (`/api/` → backend:8000), docker-compose (frontend, backend, postgres, valkey, VersityGW)

## Comandos

```bash
# backend/ (ativar venv: backend/.venv)
pytest / pytest accounts/ / pytest -k test_name
python manage.py makemigrations && python manage.py migrate
ruff format --check . && ruff check .

# frontend/
npm run build   # SEMPRE antes de buildar Docker (usa tsc -b, pega mais erros que tsc --noEmit)
npm run dev / npm run lint / npm test

# root
docker compose up -d --build
```

## Invariantes globais — afetam TODO código novo

**Ownership**: queryset SEMPRE filtra por usuário.
```python
Place.objects.filter(user=request.user)
Visit.objects.filter(place__user=request.user)
VisitItem.objects.filter(visit__place__user=request.user)
```

**public_id**: UUID exposto em URLs/payloads. `id` = PK interno, só para FK internas. `lookup_field = "public_id"`.

**Erros backend**: sempre `from core.exceptions import ...` — nunca DRF cru nem `raise Exception`.

**Imagens**: sempre `core.image_service.ImageService` — nunca salvar direto no ImageField.

**Migrations**: nunca reformatar migrations antigas. Mudanças manuais e isoladas.

**Formulários frontend**: React Hook Form + Zod em todos. `applyApiErrors(setError, fieldErrors)` em todo catch.

## Skills — injeção incremental por domínio

Invocar antes de qualquer trabalho no domínio. Cada skill é self-contained, sem leituras secundárias.

| Domínio | Skill |
|---------|-------|
| Backend (models, API, auth, migrations, testes) | `/bora-ali-backend` |
| Frontend (forms, components, services, i18n) | `/bora-ali-frontend` |
| Serializers, viewsets, ORM avançado | `/django-expert` |
| Arquitetura, cache, signals, middleware | `/django-patterns` |
| Auditoria de segurança | `/security-review` |

## Referências detalhadas (ler só quando necessário)

```
backend/CLAUDE.md   → detalhes de auth, throttle, Celery, storage
frontend/CLAUDE.md  → detalhes de schemas, VisitItemForm, componentes forwardRef
skills/             → guias por domínio: models, api, tests, migrations, infra
```
