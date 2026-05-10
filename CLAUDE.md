# Bora Ali

Diário pessoal de lugares. `User → Place → Visit → VisitItem`.

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

- queryset sempre filtrado por `request.user`
- `public_id` exposto; `id` só interno
- exceções backend via `core.exceptions`
- imagens via `core.image_service.ImageService`
- não mexer automaticamente em `backend/*/migrations/`
- forms frontend com React Hook Form + Zod

## Carregamento gradual

- este arquivo: só contexto mínimo do repo
- [SKILLS.md](/home/smovisk/PycharmProjects/boora-ali/SKILLS.md): roteador curto para a LLM
- `skills/templates/`: abrir só o template do domínio em uso
- [backend/CLAUDE.md](/home/smovisk/PycharmProjects/boora-ali/backend/CLAUDE.md): detalhes backend sob demanda
- [frontend/CLAUDE.md](/home/smovisk/PycharmProjects/boora-ali/frontend/CLAUDE.md): detalhes frontend sob demanda
- `docs/*.md`: runbooks humanos, não contexto base

## Sincronia

`AGENTS.md` deve permanecer idêntico a este arquivo.
