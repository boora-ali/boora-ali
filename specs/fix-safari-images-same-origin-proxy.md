# Fix — Imagens quebradas no Safari/Edge (Same-Origin Proxy)

> ⏳ **PENDENTE** — Bug confirmado: imagens não carregam em Safari/Edge (iOS WebKit)

## Problema

Em produção, `build_public_media_url` retorna URLs presigned **diretamente do R2** (domínio
`*.r2.cloudflarestorage.com`). O frontend renderiza `<img src="https://r2.cloudflarestorage.com/...">`.

```
Serializer → build_public_media_url()
  → _use_s3_signing() = True
  → _build_signed_url() → "https://<account>.r2.cloudflarestorage.com/bucket/users/..."
  → <img src="https://r2.cloudflarestorage.com/...">  ← cross-origin!
```

O `nginx.conf` define `Cross-Origin-Opener-Policy: same-origin-allow-popups` na página.
Safari/WebKit (iOS) — e Edge no iOS, que obrigatoriamente usa WebKit — enforça
**`Cross-Origin-Resource-Policy`** em recursos embutidos em páginas com COOP.
O R2 não retorna `Cross-Origin-Resource-Policy: cross-origin`.
Safari bloqueia o carregamento das imagens.

**Chrome** (Blink) é permissivo com CORP em `<img>` sem atributo `crossOrigin`.
**Safari e Edge iOS** (WebKit) são estritos. Resultado: imagens quebradas só nesses browsers.

### Por que JWT não resolve

`<img src="/api/media/...">` é uma requisição nativa do browser — não passa pelo
`api.ts`, não envia `Authorization: Bearer`. A view atual com `IsAuthenticated` retornaria
401/404 para toda imagem. Por isso o mecanismo de autenticação precisa ser via URL (HMAC).

---

## Objetivo

Servir imagens sempre via mesmo domínio (`booraali.com.br/api/media/<path>`) usando
**assinatura HMAC na query string** para autenticação — sem precisar de header
`Authorization: Bearer` (que `<img src>` não consegue enviar).

### Garantias mantidas

1. Imagem só acessível por quem recebeu a URL assinada (obtida via API autenticada com JWT)
2. URL expira em 1h (TTL configurável)
3. HMAC vincula path + expiração — não é possível forjar ou reutilizar com path diferente
4. Sem CORS/CORP issue: origem da imagem = mesma origem da página
5. `/_r2_proxy/` continua sendo o único ponto de acesso ao R2 (sem URL do R2 exposta ao cliente)

---

## Arquivos alterados

| Arquivo | O que muda |
|---------|-----------|
| `backend/core/storage_urls.py` | `build_public_media_url` gera URL same-origin com HMAC |
| `backend/core/media_views.py` | `serve_user_media` aceita HMAC query-param (+ fallback JWT para testes) |
| `frontend/nginx.conf` | `/_r2_proxy/` ganha `Cross-Origin-Resource-Policy` + Cache-Control corrigido |
| `backend/core/tests/test_media_views.py` | Casos de teste HMAC |
| `backend/core/tests/test_storage_urls.py` | Casos de teste geração de URL |

---

## Passo a passo

### 1. HMAC signing em `storage_urls.py`

```python
# backend/core/storage_urls.py  (adicionar ao arquivo existente)
import hashlib
import hmac
import time
from functools import lru_cache

_MEDIA_URL_TTL = 3600  # 1 hora


@lru_cache(maxsize=1)
def _media_signing_key() -> bytes:
    """
    Deriva a chave HMAC a partir de MEDIA_ENCRYPTION_KEY (ou SECRET_KEY como fallback).
    @lru_cache: calculado uma vez por processo — SHA256 não precisa repetir a cada request.
    """
    from django.conf import settings
    key = getattr(settings, "MEDIA_ENCRYPTION_KEY", None) or settings.SECRET_KEY
    return hashlib.sha256(f"bora-ali-media-url-v1:{key}".encode()).digest()


def sign_media_url(path: str, ttl: int = _MEDIA_URL_TTL) -> tuple[int, str]:
    """
    Retorna (exp, sig) onde:
      exp = unix timestamp de expiração
      sig = HMAC-SHA256 hex de '<path>:<exp>'
    """
    exp = int(time.time()) + ttl
    message = f"{path}:{exp}".encode()
    sig = hmac.new(_media_signing_key(), message, hashlib.sha256).hexdigest()
    return exp, sig


def verify_media_url(path: str, exp: int, sig: str) -> bool:
    """
    Valida assinatura e expiração. Retorna False se expirado ou sig inválida.
    hmac.compare_digest: resistência a timing attacks.
    """
    if int(time.time()) > exp:
        return False
    message = f"{path}:{exp}".encode()
    expected = hmac.new(_media_signing_key(), message, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, sig)
```

```python
# Modificar build_public_media_url — substituir bloco _use_s3_signing():

def build_public_media_url(file_field, request=None) -> str:
    if not file_field:
        return ""

    name = getattr(file_field, "name", "").lstrip("/")
    if not name:
        return ""

    # Sempre retornar URL same-origin com HMAC para evitar CORP cross-origin.
    # Funciona em todos os browsers incluindo Safari/Edge iOS.
    # <img src> não envia Bearer token — autenticação é via HMAC na query string.
    exp, sig = sign_media_url(name)
    path = f"/api/media/{name}"
    signed = f"{path}?exp={exp}&sig={sig}"

    if request:
        return request.build_absolute_uri(signed)
    return signed


# _use_s3_signing(), _build_signed_url(), _get_s3_presign_client(), _resolve_public_endpoint()
# permanecem — usados internamente pelo serve_user_media via X-Accel-Redirect.
```

### 2. `serve_user_media` — aceitar autenticação por HMAC URL

```python
# backend/core/media_views.py  (substituição completa da view)

import logging
import posixpath

from django.core.files.storage import default_storage
from django.http import Http404, HttpResponse
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny

from core.storage_urls import _build_signed_url, _use_s3_signing, verify_media_url

logger = logging.getLogger(__name__)


@api_view(["GET"])
@authentication_classes([])     # sem auth de header — auth é via HMAC na URL
@permission_classes([AllowAny])
def serve_user_media(request, path):
    path = posixpath.normpath("/" + path).lstrip("/")

    # — Validação de estrutura do path —
    parts = path.split("/")
    if len(parts) < 3 or parts[0] != "users":
        raise Http404

    try:
        int(parts[1])  # user_id deve ser inteiro
    except (IndexError, ValueError):
        raise Http404

    # — Autenticação via HMAC query params —
    exp_str = request.GET.get("exp", "")
    sig = request.GET.get("sig", "")

    if exp_str and sig:
        # Caminho principal: <img src="/api/media/...?exp=&sig=">
        try:
            exp = int(exp_str)
        except ValueError:
            raise Http404

        if not verify_media_url(path, exp, sig):
            raise Http404  # expirado ou sig inválida → 404 (nunca 403)

    else:
        # Fallback JWT Bearer: para testes automatizados e acesso programático (ex: curl).
        # NÃO é usado por <img src> em produção.
        from accounts.authentication import SingleSessionJWTAuthentication
        try:
            result = SingleSessionJWTAuthentication().authenticate(request)
        except Exception:
            raise Http404

        # result é None quando não há header Authorization (sem tentar auth)
        if result is None:
            raise Http404

        user, _ = result
        # Verificar que user_id no path pertence ao usuário autenticado
        if int(parts[1]) != user.id:
            raise Http404

    # — Servir via X-Accel-Redirect → /_r2_proxy/ → R2 —
    try:
        if _use_s3_signing():
            media_url = _build_signed_url(path)
        else:
            media_url = default_storage.url(path)
        if not media_url:
            raise Http404
    except Http404:
        raise
    except Exception:
        logger.warning("Failed to build media URL for %s", path, exc_info=True)
        raise Http404

    response = HttpResponse()
    response["X-Accel-Redirect"] = "/_r2_proxy/"
    response["X-Accel-Target"] = media_url
    # Nota: com X-Accel-Redirect, nginx descarta headers do Django e usa os do /_r2_proxy/.
    # Este Cache-Control não chega ao browser — está aqui apenas para dev local (sem nginx).
    response["Cache-Control"] = "private, max-age=3600, must-revalidate"
    return response
```

> **Invariante de segurança mantida**: `path` sempre contém `users/{user_id}/` — quem tem
> a URL HMAC foi quem recebeu da API autenticada com JWT. 404 para qualquer falha (nunca 403).

### 3. `nginx.conf` — corrigir `/_r2_proxy/`

Localizar bloco `location /_r2_proxy/` e substituir:

```nginx
# ANTES
location /_r2_proxy/ {
    internal;
    resolver 1.1.1.1 valid=30s;
    set $r2_target $upstream_http_x_accel_target;
    proxy_pass $r2_target;
    proxy_ssl_server_name on;
    proxy_set_header Authorization "";
    proxy_hide_header x-amz-request-id;
    proxy_hide_header x-amz-id-2;
    add_header Cache-Control "private, max-age=31536000, immutable" always;
    add_header X-Content-Type-Options "nosniff" always;
}

# DEPOIS
location /_r2_proxy/ {
    internal;
    resolver 1.1.1.1 valid=30s;
    set $r2_target $upstream_http_x_accel_target;
    proxy_pass $r2_target;
    proxy_ssl_server_name on;
    proxy_set_header Authorization "";
    proxy_hide_header x-amz-request-id;
    proxy_hide_header x-amz-id-2;
    add_header Cache-Control "private, max-age=3600, must-revalidate" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Cross-Origin-Resource-Policy "same-origin" always;
}
```

**O que mudou:**
- `Cache-Control`: `max-age=31536000, immutable` → `max-age=3600, must-revalidate`
  - `immutable` era incorreto: URLs com HMAC diferente podem retornar imagem diferente
  - `max-age=3600` = TTL do HMAC (browser não vai revalidar antes de expirar)
- `Cross-Origin-Resource-Policy: same-origin`: **o fix principal** — WebKit/Safari aceita
  embutir o recurso porque agora origem da imagem = origem da página

> **Por que `same-origin` e não `cross-origin`?**
> A imagem agora é servida de `booraali.com.br` (same-origin com a página).
> `same-origin` é mais restritivo e correto: apenas o próprio site pode embutir o recurso.

---

## Fluxo após a correção

```
1. GET /api/places/  (Authorization: Bearer <jwt>)
   → Serializer.get_cover_photo()
   → build_public_media_url()
   → sign_media_url(path)
   → retorna "/api/media/users/1/places/covers/abc?exp=1716900000&sig=abcdef..."

2. <img src="/api/media/users/1/places/covers/abc?exp=...&sig=...">
   → SAME-ORIGIN request (sem CORS/CORP issue)
   → nginx /api/ → Django serve_user_media
   → verify_media_url(path, exp, sig) ✓
   → X-Accel-Redirect: /_r2_proxy/
   → nginx /_r2_proxy/ → proxy_pass R2 presigned URL
   → Browser recebe imagem + CORP: same-origin

3. Safari ✓  Edge ✓  Chrome ✓
```

---

## Atenção no deploy

**Janela de ~20min com imagens quebradas no Safari após deploy:**
React Query cacheia a resposta das APIs (TTL ~20min). URLs antigas — diretas para R2 —
continuarão no cache do cliente até expirar. Nessa janela, Safari ainda verá URLs
cross-origin. Sem mitigação necessária: aceitável para app pessoal.

**`AuthImage` component:** verificar se o componente faz fetch manual com Bearer token
para servir imagens. Após o fix, `<img src>` funciona diretamente via HMAC — se AuthImage
adicionou lógica de auth manual, pode ser simplificado ou removido.

---

## Testes obrigatórios

### `backend/core/tests/test_storage_urls.py`

```python
# Casos novos a adicionar:
- test_sign_media_url_returns_exp_and_sig()
- test_verify_media_url_valid()
- test_verify_media_url_expired()
- test_verify_media_url_wrong_sig()
- test_verify_media_url_wrong_path()  # sig de path A não vale para path B
- test_build_public_media_url_returns_same_origin()
- test_build_public_media_url_includes_exp_and_sig()
- test_build_public_media_url_with_request_uses_absolute_uri()
```

### `backend/core/tests/test_media_views.py`

```python
# Casos novos a adicionar:
- test_serve_user_media_with_valid_hmac_returns_200()
- test_serve_user_media_with_expired_hmac_returns_404()
- test_serve_user_media_with_invalid_sig_returns_404()
- test_serve_user_media_with_jwt_fallback_returns_200()  # compatibilidade de testes
- test_serve_user_media_with_jwt_wrong_user_returns_404()
- test_serve_user_media_no_auth_returns_404()
- test_serve_user_media_path_traversal_returns_404()
- test_serve_user_media_returns_x_accel_redirect()
```

---

## Riscos e mitigações

| Risco | Detalhe | Mitigação |
|-------|---------|-----------|
| URL HMAC vazando em logs | `/api/media/...?sig=` pode aparecer em access logs | TTL=1h limita impacto. Aceitável. |
| Replay attack | URL válida por 1h pode ser reusada por terceiro | TTL curto + HTTPS. Aceito. |
| MEDIA_ENCRYPTION_KEY rotation | Rotação invalida todas as URLs em cache | TTL=1h limita impacto |
| Timing attack em `verify_media_url` | `hmac.compare_digest` já protege | ✅ já implementado |
| Frontend cache de URL expirada | React Query cacheia resposta da API com URL válida | TTL 1h >> TTL do cache (20min) |
| Dev local sem S3 | `_use_s3_signing()` False → `default_storage.url(path)` | Funciona; HMAC ainda válido |

---

## Verificação após implementação

```bash
# Backend
cd backend/
pytest core/tests/test_media_views.py core/tests/test_storage_urls.py -v

# Todos os testes
pytest

# Verificar que URL gerada é same-origin
python manage.py shell -c "
from core.storage_urls import build_public_media_url
from unittest.mock import Mock
field = Mock(); field.name = 'users/1/places/covers/abc_123'
print(build_public_media_url(field))
# deve imprimir: /api/media/users/1/places/covers/abc_123?exp=...&sig=...
"

# Verificar flow completo em dev
curl -H "Authorization: Bearer <token>" \
  "http://localhost:8000/api/media/users/1/places/covers/abc_123?exp=<exp>&sig=<sig>" \
  -v  # deve ter X-Accel-Redirect: /_r2_proxy/ no response

# Frontend
cd frontend/
npm run build
npm run lint
npm run test
```

---

## Referências

- [MDN — Cross-Origin-Resource-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Resource-Policy)
- [WebKit COOP + CORP enforcement](https://webkit.org/blog/11545/updates-to-the-storage-access-api/)
- `specs/perf-image-serving.md` — contexto da impl X-Accel-Redirect (✅ já implementado)
- `backend/core/media_views.py` — view atual
- `backend/core/storage_urls.py` — `build_public_media_url` atual
- `frontend/nginx.conf` — `/_r2_proxy/` location atual
