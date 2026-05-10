# Development

## Setup completo (sem Docker)

Este fluxo é para desenvolvimento local. Aqui o storage de mídia é `VersityGW`, não `Cloudflare R2`.

```bash
# 1. Serviços de infra
docker compose up -d postgres valkey storage jaeger

# 2. Criar bucket no VersityGW (só na primeira vez)
export AWS_ACCESS_KEY_ID=minioadmin
export AWS_SECRET_ACCESS_KEY=minioadmin
export AWS_DEFAULT_REGION=us-east-1
aws --endpoint-url http://localhost:8081 --region us-east-1 s3api create-bucket --bucket bora-ali
# Não usar `aws s3 mb` — envia LocationConstraint incompatível

# 3. Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver  # http://localhost:8000/api/

# 3b. Celery worker (em outro terminal, backend/ com venv ativo)
celery -A config worker -l info

# 4. Frontend
cd frontend
npm install
npm run dev  # http://localhost:5173
```

## Variáveis de ambiente

| Modo | Arquivo backend | Arquivo frontend |
|------|----------------|-----------------|
| dev | `backend/.env` (de `.env.dev.example`) | `frontend/.env` (de `.env.development`) |
| preprod (ngrok) | `backend/.env` (de `.env.preprod.example`) | `frontend/.env.preprod` |
| prod | `backend/.env` (de `.env.prod.example`) | `frontend/.env.production` |

### Perfis de storage

- Dev local:
  - `USE_VERSITYGW=True`
  - `AWS_S3_ENDPOINT_URL=http://localhost:8081`
  - bucket local servido pelo container `storage`
- Produção:
  - `USE_VERSITYGW=False`
  - `AWS_S3_ENDPOINT_URL=https://...r2.cloudflarestorage.com`
  - credenciais reais do bucket no Cloudflare R2

**Preprod**: hoje não existe mais fluxo documentado com `ngrok` dentro do repo. Se precisar expor preprod temporariamente, trate isso como operação externa ao projeto e documente o comando real usado antes de reintroduzir esse passo aqui.

O fluxo ativo de desenvolvimento continua sendo:
- backend local em `localhost:8000`
- frontend Vite em `localhost:5173`
- stack Docker completa em `localhost`

## Comandos úteis

```bash
# Backend (backend/ com venv ativo)
python manage.py makemigrations && python manage.py migrate
python manage.py createsuperuser
python manage.py makemessages -l pt_BR && python manage.py compilemessages
ruff format --check . && ruff check .

# VersityGW — inspecionar storage
aws --endpoint-url http://localhost:8081 --region us-east-1 s3 ls
aws --endpoint-url http://localhost:8081 --region us-east-1 s3 ls s3://bora-ali/
docker compose logs -f storage

# Frontend (frontend/)
npm run dev:local       # bind local explícito
npm run build
npm run lint
```

## Stack full via Docker

```bash
docker compose up -d --build   # sobe tudo (frontend, backend, postgres, valkey, VersityGW, Jaeger)
docker compose logs -f backend
docker exec -it bora-ali-backend-1 python manage.py migrate
```

## Produção

Produção não usa `VersityGW` nem Supabase.

- Compose de referência: [docker-compose.prod.yml](/home/smovisk/PycharmProjects/bora-ali/docker-compose.prod.yml)
- Banco: PostgreSQL no próprio stack da VPS
- Cache/broker: Valkey no próprio stack da VPS
- Storage: Cloudflare R2
- Edge: Cloudflare
- Host principal: Contabo VPS

Checklist mínimo de produção:

- `USE_VERSITYGW=False`
- `AWS_S3_ENDPOINT_URL` apontando para o endpoint do R2
- `AWS_ACCESS_KEY_ID` e `AWS_SECRET_ACCESS_KEY` válidos
- `POSTGRES_HOST=postgres` e `POSTGRES_PORT=5432` no compose de produção atual
- `PUBLIC_BASE_URL` com domínio final

Gunicorn: 3 workers, 2 threads, gthread. Config em `Dockerfile CMD` e `docker-compose.yml` (manter em sincronia). `entrypoint.sh` roda `migrate` + `compilemessages` antes de iniciar (PID 1).

## Guia operacional do repo

Separação de responsabilidade:

- [SKILLS.md](/home/smovisk/PycharmProjects/boora-ali/SKILLS.md): contrato curto para a LLM
- `skills/templates/`: padrões/snippets por domínio
- `docs/development.md`: runbook humano de setup, execução e operação local
- `docs/testing.md`: runbook humano de testes

## Observability (OpenTelemetry)

Adicione ao `backend/.env`:
```env
OTEL_SERVICE_NAME=bora-ali
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
```

Jaeger UI: `http://localhost:16686`. Rastreia requests HTTP, queries SQL (psycopg) e logs correlacionados.

## i18n

- Backend: GNU gettext + `LocaleMiddleware`. `python manage.py makemessages -l pt_BR && compilemessages`
- Frontend: react-i18next. Traduções em `frontend/src/locales/<lang>/translation.json`. Língua em `localStorage.boraali_lang`.
- Converter `.po` → JSON para frontend: `node scripts/po-to-i18n.cjs`

## Visual Identity

- Primary: `#EA1D2C` · Background: `#FAFAFA` · Mobile-first
- Upload de foto: dropzone dashed em PlaceForm, VisitForm e VisitItemForm (click to upload, hover to change, link to remove)
