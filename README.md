# 📍 Bora Ali

Diário pessoal de lugares — cafés, restaurantes, bares. Catalogue, avalie, registre visitas e itens pedidos.

**Stack**: Django + DRF + SimpleJWT + PostgreSQL + Valkey · Celery (tarefas assíncronas) · React + Vite + TypeScript + Tailwind · nginx · Cloudflare R2 (produção) · VersityGW (desenvolvimento local) · Jaeger


Leitura rápida:
- [Arquitetura & modelo de dados](docs/architecture.md)
- [Guia de desenvolvimento](docs/development.md)
- [Testes](docs/testing.md)
- [SKILLS.md](SKILLS.md) para contrato curto da LLM

Superfícies do repo:
- `README.md`: visão geral humana
- `docs/*.md`: runbooks humanos
- `SKILLS.md`: contrato mínimo para a LLM
- `skills/templates/*`: snippets e padrões de implementação

---

## Quick Start

### Pré-requisitos

- Python 3.8+ · Node.js 18+ · Docker & Docker Compose

### 1. Clonar e configurar .env

```bash
git clone <repository-url> && cd bora-ali
cp backend/.env.dev.example backend/.env
cp frontend/.env.development frontend/.env
```

### 2. Subir infra + criar bucket

```bash
docker compose up -d postgres valkey storage jaeger

export AWS_ACCESS_KEY_ID=minioadmin AWS_SECRET_ACCESS_KEY=minioadmin AWS_DEFAULT_REGION=us-east-1
aws --endpoint-url http://localhost:8081 --region us-east-1 s3api create-bucket --bucket bora-ali
```

### 3. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

API: `http://localhost:8000/api/` · Docs: `http://localhost:8000/api/docs/`

### 4. Frontend

```bash
cd frontend && npm install && npm run dev
```

App: `http://localhost:5173`

### Alternativa: stack completa via Docker

```bash
docker compose up -d --build   # frontend em http://localhost
```

### Storage: dev vs produção

- Desenvolvimento local: `VersityGW` como endpoint S3 compatível, exposto em `:8081`.
- Produção: `Cloudflare R2` para mídias; `VersityGW` não entra no deploy real.

---

## Endpoints da API

### Auth

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/auth/register/` | Registrar com honeypot + throttle |
| POST | `/api/auth/login/` | Login → access + refresh token |
| POST | `/api/auth/refresh/` | Renovar access token |
| POST | `/api/auth/logout/` | Logout (blacklista refresh) |
| GET | `/api/auth/me/` | Dados do usuário autenticado |
| POST | `/api/auth/google/` | Login com Google (`{ id_token }`) |

### Proteções de Auth

- `register`, `login`, `password` e `google auth` usam throttle no backend.
- O cadastro inclui um honeypot oculto para bloquear bot simples sem impacto visível na UI.
- Session invalidada continua redirecionando para `/login` com banner no cliente.

### Lugares / Visitas / Itens

| Método | Endpoint |
|--------|----------|
| GET/POST | `/api/places/` |
| GET/PATCH/DELETE | `/api/places/{public_id}/` |
| GET/POST | `/api/places/{public_id}/visits/` |
| GET/PATCH/DELETE | `/api/visits/{public_id}/` |
| GET/POST | `/api/visits/{public_id}/items/` |
| PATCH/DELETE | `/api/visits/{public_id}/items/{public_id}/` |
| GET | `/api/media/{path}` — imagem descriptografada (JWT obrigatório) |

Paginação: 20 itens/página. Todos os recursos filtrados por `request.user`.

---

## Deployment

### Stack de produção

```
Usuário
  → Cloudflare (DNS / proxy / SSL / cache control / Turnstile)
  → Contabo VPS
      ├── frontend container (nginx servindo o build do Vite)
      ├── backend container (Django + Gunicorn)
      ├── celery-worker
      ├── PostgreSQL
      └── Valkey
  → Cloudflare R2 (fotos e mídias privadas, via S3-compatible API)
```

Notas:

- O deploy real não usa Supabase.
- O banco de produção fica no próprio stack Docker da VPS.
- O `docker-compose.prod.yml` reflete melhor a topologia atual do que o `docker-compose.yml`, que existe para desenvolvimento local.
- Em produção o backend fala com o R2 via `django-storages` / S3 API compatível; em dev, o fallback é `VersityGW`.

### Checklist antes de subir

- [ ] `DJANGO_SECRET_KEY` 50+ chars
- [ ] `DJANGO_DEBUG=False` (já é o default)
- [ ] `POSTGRES_HOST` e `POSTGRES_PORT` apontando para o PostgreSQL da VPS/stack atual
- [ ] `PUBLIC_BASE_URL` com domínio real
- [ ] `USE_VERSITYGW=False` em produção
- [ ] `AWS_S3_ENDPOINT_URL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` e `AWS_STORAGE_BUCKET_NAME` configurados para o Cloudflare R2
- [ ] Cloudflare: SSL Full Strict e bypass de cache para `/api/*`
- [ ] `REDIS_URL` apontando para Valkey do VPS
- [ ] `GOOGLE_OAUTH_CLIENT_ID` + `VITE_GOOGLE_OAUTH_CLIENT_ID` (se usar OAuth)

---

**Fora do escopo**: microservices, websockets, social feeds, payments, PWA, Facebook/Apple OAuth.
