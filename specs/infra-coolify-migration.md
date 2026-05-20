# Migração para Coolify + Traefik

## Contexto

Atualmente o deploy é manual: SSH → `docker compose -f docker-compose.prod.yml pull && up`.
O nginx do container frontend gerencia SSL (Let's Encrypt montado como volume) e expõe as portas 80/443 diretamente no host.

**Objetivo:** migrar para Coolify como PaaS self-hosted. Traefik passa a ser o edge proxy (SSL, roteamento, ACME automático). Coolify gerencia deploys via webhook do GitHub.

---

## O que já está pronto no repositório

- `docker-compose.prod.yml` — atualizado para Coolify (labels Traefik, redes, expose em vez de ports)
- `frontend/nginx.conf` — SSL removido, `set_real_ip_from` para restaurar IP real via Traefik, tunnel via backend direto
- Backend exposto em `127.0.0.1:8001:8000` para SSH tunnel ao Django admin

---

## Riscos conhecidos

### 🔴 Volume do Postgres com nome diferente

O Docker nomeia volumes com prefixo do projeto (`<project>_bora_ali_pgdata`).
Se o Coolify usar um nome de projeto diferente do atual, o banco aparece vazio no primeiro deploy.

**Verificar antes do deploy:**
```bash
docker volume ls | grep pgdata
```

Se o nome for diferente do esperado (`bora_ali_pgdata`), fazer backup e recriar com nome correto:
```bash
# Backup
docker run --rm -v <volume_atual>:/data -v $(pwd):/backup alpine \
  tar czf /backup/pgdata-backup.tar.gz -C /data .

# Recriar com nome que o Coolify vai usar
docker volume create bora_ali_pgdata
docker run --rm -v bora_ali_pgdata:/data -v $(pwd):/backup alpine \
  tar xzf /backup/pgdata-backup.tar.gz -C /data
```

### 🟡 Downtime durante migração

Entre o `docker compose down` e o deploy no Coolify: ~5 a 15 minutos de site fora do ar.
Fazer fora do horário de pico.

### 🟡 Porta 8000 do Coolify vs backend

Coolify UI ocupa `0.0.0.0:8000` do host.
Backend exposto em `127.0.0.1:8001:8000` — sem conflito, mas lembrar que o tunnel muda de porta.

### 🟡 Traefik e certificado SSL

Let's Encrypt tem rate limit de 5 certificados por domínio por semana.
Se o deploy falhar e retentar várias vezes, pode bater o limite.
Usar `tls.certresolver=letsencrypt` apenas quando tudo estiver estável — testar com staging resolver antes se possível.

---

## Passo a passo

### Pré-requisitos (fazer antes de começar)

```bash
# 1. Confirmar nome do volume atual
docker volume ls | grep pgdata

# 2. Fazer backup do banco
docker exec <container_postgres> pg_dump -U bora bora_ali > backup-$(date +%Y%m%d).sql

# 3. Confirmar que as portas 80 e 443 não têm nada além do compose atual
ss -tlnp | grep -E ':80|:443'
```

---

### Etapa 1 — Parar o stack atual

```bash
cd /caminho/do/projeto
docker compose -f docker-compose.prod.yml down
# NÃO usar --volumes
```

Site fora do ar a partir daqui.

---

### Etapa 2 — Abrir porta temporária do Coolify

```bash
ufw allow 8000/tcp
ufw status
```

---

### Etapa 3 — Instalar Coolify

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Aguardar ~3 minutos. Ao terminar:
- Traefik já está ocupando as portas 80 e 443
- Rede `coolify` criada no Docker

---

### Etapa 4 — Setup inicial

Acessar `http://<ip-do-servidor>:8000`:

```
1. Criar conta admin
2. Settings → Configuration → Let's Encrypt Email → preencher
3. Servers → localhost → verificar status "healthy"
```

---

### Etapa 5 — Conectar GitHub

```
Sources → Add → GitHub App
→ Seguir OAuth → instalar no repositório boora-ali
```

---

### Etapa 6 — Criar projeto

```
Projects → New → "boora-ali"
→ New Resource → Docker Compose
→ Repositório: boora-ali → branch: main
→ Docker Compose Location: docker-compose.prod.yml
```

---

### Etapa 7 — Variáveis de ambiente

Copiar o `.env` atual e colar em **Environment Variables** no painel.

```bash
# Ver o .env atual
cat /caminho/do/projeto/.env
```

Variáveis obrigatórias (checar se todas estão):
- `POSTGRES_PASSWORD`
- `SECRET_KEY`
- `ALLOWED_HOSTS`
- `CORS_ALLOWED_ORIGINS`
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_S3_ENDPOINT_URL`
- `CLOUDFLARE_TURNSTILE_SECRET_KEY`
- `SENTRY_DSN`
- `DOMAIN` (usado nas labels Traefik — `booraali.com.br`)

---

### Etapa 8 — Configurar domínio

```
Serviço frontend → Domains
→ booraali.com.br → Save
→ www.booraali.com.br → Save
```

---

### Etapa 9 — Deploy

```
→ Deploy
→ Acompanhar logs em tempo real no painel
```

Checklist pós-deploy:
- [ ] Site carrega em `https://booraali.com.br`
- [ ] SSL válido (cadeado verde)
- [ ] Login funciona (JWT + Turnstile)
- [ ] Upload de imagem funciona (R2)
- [ ] `/admin/` acessível via tunnel: `ssh -L 8001:localhost:8001 user@servidor` → `http://localhost:8001/admin/`
- [ ] Celery processando tasks (checar logs do `celery-worker`)

---

### Etapa 10 — Fechar porta do Coolify

```bash
ufw delete allow 8000/tcp
```

Coolify fica acessível via subdomínio configurado (ex: `https://coolify.booraali.com.br`).

---

## Tunnel SSH após migração

```bash
# Mapear porta local 8001 → backend Django no servidor
ssh -L 8001:localhost:8001 user@servidor

# Acessar no browser local:
http://localhost:8001/admin/
```

Porta mudou de 8000 para 8001 para não conflitar com Coolify UI.

---

## Rollback

Se algo der errado antes do deploy no Coolify:

```bash
# Parar Coolify + Traefik
docker compose -f /data/coolify/docker-compose.yml down

# Voltar o nginx manualmente
docker compose -f docker-compose.prod.yml up -d
```

Se der errado após o deploy (dados OK, só roteamento):
- Ajustar labels no `docker-compose.prod.yml`
- Redeploy pelo painel do Coolify
