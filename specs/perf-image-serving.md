# Perf #3 — Serving de imagens via Django (sem offload para nginx)

> ✅ **IMPLEMENTADO**

## Problema

`GET /api/media/<path>` é tratado inteiramente pelo Django/Gunicorn:
autenticação JWT, verificação de `user_id` no path, descriptografia Fernet, e stream do arquivo.
Com apenas **3 workers × 2 threads** (gthread), downloads de imagem bloqueiam workers que
poderiam estar respondendo requests de API. Em cenário de 6 usuários baixando imagens simultaneamente,
a API trava.

**Arquivo problemático:** `backend/core/media_views.py` (view que serve o stream)
**Config Gunicorn:** `Dockerfile CMD` e `docker-compose.yml`

---

## Objetivo

Usar `X-Accel-Redirect` do nginx: Django autentica e autoriza, devolve header — nginx entrega
o arquivo em streaming sem ocupar o worker. O worker fica livre em < 5ms.

---

## Skills a invocar antes de implementar

- `/django-expert` — padrões Django, views de media, headers HTTP, configuração Gunicorn
- `/bora-ali-backend` — convenções do projeto (ImageService, media_views, estrutura nginx/docker)

---

## Arquivos que serão mexidos

| Arquivo | O que muda |
|---------|-----------|
| `backend/core/media_views.py` | Retornar `X-Accel-Redirect` em vez de stream quando `USE_X_ACCEL_REDIRECT=True` |
| `infra/nginx/nginx.conf` (ou equivalente) | Adicionar bloco `location /protected-media/` com `internal` |
| `backend/config/settings.py` | Adicionar `USE_X_ACCEL_REDIRECT` (default `False` em dev, `True` em prod) |
| `docker-compose.yml` | Verificar volume compartilhado entre Django e nginx (para storage local) |

---

## Implementação passo a passo

### 1. Django — view de mídia com X-Accel-Redirect

```python
# backend/core/media_views.py
import os
from django.conf import settings
from django.http import FileResponse, HttpResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def serve_media(request, path):
    # Verificar user_id no path (invariante de segurança)
    parts = path.split("/")
    if not parts or parts[0] != str(request.user.id):
        return HttpResponse(status=404)

    if getattr(settings, "USE_X_ACCEL_REDIRECT", False):
        # Deixar nginx fazer o stream
        response = HttpResponse()
        response["X-Accel-Redirect"] = f"/protected-media/{path}"
        response["Content-Type"] = ""  # nginx detecta automaticamente
        return response

    # Fallback: stream pelo Django (dev local / storage S3)
    # ... lógica existente de descriptografia e stream ...
    return _stream_file(request, path)
```

### 2. nginx — bloco `internal`

```nginx
# infra/nginx/nginx.conf (dentro do bloco server)
location /protected-media/ {
    internal;                              # só acessível via X-Accel-Redirect
    alias /app/media/;                     # ajustar para o volume montado
    add_header Cache-Control "private, max-age=3600";
}
```

### 3. settings.py

```python
# backend/config/settings.py
USE_X_ACCEL_REDIRECT = env.bool("USE_X_ACCEL_REDIRECT", default=False)
```

### 4. docker-compose.yml — volume compartilhado (só para storage local)

```yaml
services:
  backend:
    volumes:
      - media_files:/app/media
  nginx:
    volumes:
      - media_files:/app/media:ro   # read-only no nginx

volumes:
  media_files:
```

> **Nota**: quando `USE_VERSITYGW=True` (S3), o nginx não precisa do volume — o redirect
> aponta para uma URL pré-assinada ou para o proxy do VersityGW. Avaliar separadamente.

---

## Limitação conhecida

Fernet descriptografa o arquivo em memória antes de servir. Com X-Accel-Redirect o nginx
entrega o **arquivo criptografado** diretamente. Duas opções:
1. **Armazenar sem criptografia** e confiar na autenticação JWT (simplifica, perde criptografia em repouso)
2. **Descriptografar em Django, salvar temp file, redirecionar** (mantém criptografia, mais complexo)

Decidir com o usuário antes de implementar. O spec cobre a **opção 1** (sem criptografia em repouso)
por ser a mais simples e viável com nginx.

---

## Verificação

```bash
scripts/dev-check.sh backend
```

Teste manual: fazer `curl -H "Authorization: Bearer <token>" /api/media/<path>` e verificar
header `X-Accel-Redirect` na resposta quando `USE_X_ACCEL_REDIRECT=True`.
