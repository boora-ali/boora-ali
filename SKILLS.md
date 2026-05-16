# Bora Ali Skills

Contrato mínimo do repo.

## Uso

1. Leia este arquivo.
2. Escolha o domínio.
3. Abra só o template necessário em `skills/templates/`.
4. Rode a verificação do domínio antes de concluir.

## Regras globais

- queryset sempre filtrado por `request.user`
- `public_id` exposto; `id` só interno
- exceções via `core.exceptions`
- imagens via `ImageService`
- não mexer automaticamente em `backend/*/migrations/`
- forms frontend com React Hook Form + Zod

## Domínios

### Backend

Templates:
- `skills/templates/backend-api.md`
- `skills/templates/backend-auth.md`
- `skills/templates/backend-images.md`
- `skills/templates/backend-models.md`
- `skills/templates/backend-tests.md`

Verificação:
```bash
scripts/dev-check.sh backend
```

### Frontend

Base UI:
- `shadcn/ui` ativo
- registry em `frontend/components.json`
- base em `frontend/@/components/ui/`
- produto em `frontend/src/components/`

Templates:
- `skills/templates/frontend-auth.md`
- `skills/templates/frontend-components.md`
- `skills/templates/frontend-tests.md`

Verificação:
```bash
scripts/dev-check.sh frontend
```

### Infra

Template:
- `skills/templates/infra-stack.md`

Verificação:
```bash
scripts/dev-check.sh repo
```

## Scripts

- `scripts/dev-check.sh`
- `scripts/po-to-i18n.cjs`
