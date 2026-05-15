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

### Performance — Bottlenecks identificados

Ordenados do mais crítico (afeta toda listagem em prod) ao menos prioritário (otimização futura):

| Prioridade | Spec | Domínio | Verificação |
|-----------|------|---------|------------|
| 1 — crítico | `skills/templates/perf-deleted-at-index.md` | Backend | `dev-check.sh backend` |
| 2 — alto | `skills/templates/perf-select-related-user.md` | Backend | `dev-check.sh backend` |
| 3 — alto | `skills/templates/perf-cascade-delete.md` | Backend | `dev-check.sh backend` |
| 4 — médio | `skills/templates/perf-map-listall.md` | Frontend + Backend | `dev-check.sh frontend` + `dev-check.sh backend` |
| 5 — médio | `skills/templates/perf-image-serving.md` | Backend + Infra | `dev-check.sh backend` |
| 6 — médio | `skills/templates/perf-history-cleanup.md` | Backend | `dev-check.sh backend` |
| 7 — baixo | `skills/templates/perf-valkey-resilience.md` | Backend + Infra | `dev-check.sh backend` |
| 8 — baixo | `skills/templates/perf-text-search-trigram.md` | Backend | `dev-check.sh backend` |
| 9 — futuro | `skills/templates/perf-page-cache.md` | Frontend | `dev-check.sh frontend` |

Quando for implementar um bottleneck, leia o spec correspondente antes de tocar em qualquer arquivo.

### Features

> Pré-requisito para Riscos #5 e #6 — implementar antes deles.

Templates:
- `skills/templates/feat-notifications.md` — sistema de notificações in-app (backend + frontend)
- `skills/templates/feat-input-group-label.md` — InputGroup + Label em todos os formulários (frontend)

---

### Riscos arquiteturais identificados

Ordenados do mais crítico (quebra sistema em prod) ao menos prioritário (pode ficar para o futuro):

| Prioridade | Spec | Domínio | Verificação |
|-----------|------|---------|------------|
| 1 — crítico | `skills/templates/risk-fernet-key-rotation.md` | Backend | `dev-check.sh backend` |
| 2 — crítico | `skills/templates/risk-celery-dead-letter.md` | Backend | `dev-check.sh backend` |
| 3 — alto | `skills/templates/risk-email-verification.md` | Backend | `dev-check.sh backend` |
| 4 — alto | `skills/templates/risk-refresh-token-security.md` | Backend | `dev-check.sh backend` |
| 5 — médio ¹ | `skills/templates/risk-trash-expiry.md` | Backend | `dev-check.sh backend` |
| 6 — médio ¹ | `skills/templates/risk-account-deletion.md` | Backend + Frontend | `dev-check.sh backend` + `dev-check.sh frontend` |

> ¹ Depende de `feat-notifications.md` — implementar a feature antes.
> Risco #4 original (observabilidade) já endereçado: Sentry configurado em `backend/config/settings.py:16`.

Quando for implementar um risco, leia o spec correspondente antes de tocar em qualquer arquivo.

## Scripts

- `scripts/dev-check.sh`
- `scripts/po-to-i18n.cjs`
