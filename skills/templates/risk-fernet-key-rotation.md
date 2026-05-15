# Risco #1 — Rotação do `SECRET_KEY` destrói todas as imagens

## Problema

A chave Fernet de criptografia de imagens é derivada diretamente do `SECRET_KEY` do Django
(`backend/core/image_service.py:44`):

```python
# core/image_service.py:44
return ImageService._derive_key(user_id, settings.SECRET_KEY).encrypt(data)
```

Derivação: `HKDF(SHA256, salt=b"bora-ali-media-v1", info=user_id, ikm=SECRET_KEY)`

Se `SECRET_KEY` precisar ser rotacionado (incidente de segurança, vazamento, rotação periódica),
**todas as imagens de todos os usuários ficam permanentemente ilegíveis**.
Não há estratégia de re-encrypt, nem versionamento de chave.

**Impacto**: rotação de `SECRET_KEY` = perda total de fotos de lugares, visitas e itens.

---

## Objetivo

Desacoplar a chave de criptografia de mídia do `SECRET_KEY` introduzindo
`MEDIA_ENCRYPTION_KEY` — uma env var independente, rotacionável sem afetar sessões,
CSRF, assinaturas Django, etc.

---

## Skills a invocar antes de implementar

- `/django-expert` — padrões Django, settings, service layer
- `/bora-ali-backend` — convenções do projeto (ImageService, exceptions, estrutura de settings)

---

## Arquivos que serão mexidos

| Arquivo | O que muda |
|---------|-----------|
| `backend/config/settings.py` | Adicionar `MEDIA_ENCRYPTION_KEY` (lido de env var) |
| `backend/core/image_service.py` | `_derive_key` usa `MEDIA_ENCRYPTION_KEY` em vez de `SECRET_KEY` |

---

## Implementação passo a passo

### 1. `settings.py` — nova variável de chave de mídia

```python
# backend/config/settings.py
MEDIA_ENCRYPTION_KEY = os.getenv("MEDIA_ENCRYPTION_KEY", "")

# Validação em produção (semelhante ao check do SECRET_KEY):
if not MEDIA_ENCRYPTION_KEY and not DEBUG:
    raise RuntimeError(
        "MEDIA_ENCRYPTION_KEY não definida. "
        "Gere com: python -c \"import secrets; print(secrets.token_hex(32))\""
    )
if not MEDIA_ENCRYPTION_KEY and DEBUG:
    import logging
    logging.getLogger(__name__).warning(
        "MEDIA_ENCRYPTION_KEY não definida — usando SECRET_KEY como fallback (apenas dev)."
    )
    MEDIA_ENCRYPTION_KEY = SECRET_KEY
```

### 2. `image_service.py` — usar `MEDIA_ENCRYPTION_KEY`

```python
# backend/core/image_service.py
from django.conf import settings

class ImageService:
    @staticmethod
    def _derive_key(user_id: int, _secret_key: str) -> Fernet:
        # ... lógica HKDF existente (não muda) ...

    @staticmethod
    def _media_key(user_id: int) -> Fernet:
        # Usa MEDIA_ENCRYPTION_KEY, não SECRET_KEY
        key = getattr(settings, "MEDIA_ENCRYPTION_KEY", None) or settings.SECRET_KEY
        return ImageService._derive_key(user_id, key)

    @staticmethod
    def encrypt(user_id: int, data: bytes) -> bytes:
        return ImageService._media_key(user_id).encrypt(data)

    @staticmethod
    def decrypt(user_id: int, data: bytes) -> bytes:
        return ImageService._media_key(user_id).decrypt(data)
```

> **Atenção**: verificar se `encrypt` e `decrypt` são chamados com `settings.SECRET_KEY`
> diretamente em algum ponto além de `image_service.py`. Buscar:
> ```bash
> grep -rn "SECRET_KEY\|_derive_key" backend/core/ backend/places/ backend/accounts/
> ```

### 3. Gerar `MEDIA_ENCRYPTION_KEY` para produção

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Adicionar ao `.env` de produção como `MEDIA_ENCRYPTION_KEY=<valor gerado>`.

> **CRÍTICO**: este valor deve ser diferente do `SECRET_KEY` e armazenado com o mesmo
> nível de segurança (vault, secrets manager). Perder este valor = perder todas as imagens.

### 4. Não há re-encrypt necessário

Imagens existentes foram criptografadas com `HKDF(ikm=SECRET_KEY_ANTIGO)`.
Ao mudar para `MEDIA_ENCRYPTION_KEY`, definir `MEDIA_ENCRYPTION_KEY` igual ao
`SECRET_KEY` atual **antes** de rotacionar o `SECRET_KEY`. Ordem:
1. Definir `MEDIA_ENCRYPTION_KEY = valor_atual_do_SECRET_KEY`
2. Deploy
3. Rotacionar `SECRET_KEY`
4. Deploy novamente

---

## Verificação

```bash
scripts/dev-check.sh backend
```

Teste manual:
```bash
cd backend
python manage.py test core.tests.test_image_service --verbosity=2
```

Verificar que upload e download de imagem funcionam após a mudança.
