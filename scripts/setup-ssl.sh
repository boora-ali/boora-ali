#!/bin/bash
# Roda UMA VEZ no servidor para obter o certificado Let's Encrypt.
# Pré-requisito: domínio booraali.com.br apontando para este servidor (porta 80 acessível).

set -euo pipefail

DOMAIN="booraali.com.br"
EMAIL="samuelviana2626@gmail.com"

echo "==> Instalando certbot..."
apt-get update -qq
apt-get install -y certbot

echo "==> Parando containers para liberar porta 80..."
docker compose -f /root/bora-ali/docker-compose.prod.yml down

echo "==> Obtendo certificado para $DOMAIN..."
certbot certonly \
  --standalone \
  --non-interactive \
  --agree-tos \
  --email "$EMAIL" \
  -d "$DOMAIN" \
  -d "www.$DOMAIN"

echo "==> Reiniciando stack com SSL..."
docker compose -f /root/bora-ali/docker-compose.prod.yml up -d --build

echo "==> Configurando renovação automática (cron)..."
# Renova e recarrega nginx sem derrubar o stack
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet && docker compose -f /root/bora-ali/docker-compose.prod.yml exec frontend nginx -s reload") | crontab -

echo "==> Pronto! SSL configurado para $DOMAIN"
echo "    Acesse: https://$DOMAIN"
