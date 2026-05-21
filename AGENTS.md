# Bora Ali

Diário pessoal de lugares. `User → Place → Visit → VisitItem`.

Camada social: `UserProfile.username/is_public` + `Place.is_public` + `Follow` → feed de amigos.
Estabelecimentos: app `establishments` → `EstablishmentProfile` + `MenuItem` + `PromotionCampaign`.

## Stack

- `backend/`: Django + DRF + SimpleJWT + PostgreSQL + Valkey
- `frontend/`: React + Vite + TypeScript + Tailwind + RHF + Zod
- `infra`: nginx, docker-compose, VersityGW no dev local

## Comandos

```bash
# backend/
pytest
python manage.py makemigrations && python manage.py migrate
ruff format --check . && ruff check .

# frontend/
npm run dev
npm run lint
npm run test
npm run build

# root
docker compose up -d --build
```

## Invariantes globais

- queryset sempre filtrado por `request.user` (exceto views `permission_classes = []`)
- `public_id` exposto; `id` só interno
- exceções backend via `core.exceptions`
- imagens via `core.image_service.ImageService` — `save(file_obj, user_id, category)`, `decrypt(data, user_id)`, `delete(path)`
- `MutationMixin` vem de `core.views`, não de `core.viewsets`
- rotas públicas: `/api/u/<username>/`, `/api/e/<username>/`, `/api/feed/`
- não mexer automaticamente em `backend/*/migrations/`
- forms frontend com React Hook Form + Zod
- `onSuccess` em `useQuery` foi removido no React Query v5 — usar `useEffect`

## Carregamento gradual

- este arquivo: só contexto mínimo do repo
- [SKILLS.md](/home/smovisk/PycharmProjects/boora-ali/SKILLS.md): roteador curto para a LLM
- `skills/templates/`: abrir só o template do domínio em uso
- [backend/CLAUDE.md](/home/smovisk/PycharmProjects/boora-ali/backend/CLAUDE.md): detalhes backend sob demanda
- [frontend/CLAUDE.md](/home/smovisk/PycharmProjects/boora-ali/frontend/CLAUDE.md): detalhes frontend sob demanda
- `docs/*.md`: runbooks humanos, não contexto base

## Sincronia

`AGENTS.md` deve permanecer idêntico a este arquivo.
