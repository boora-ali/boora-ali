# Risco #6 — Refresh token de 7 dias sem revogação por inatividade

## Problema

`REFRESH_TOKEN_LIFETIME = timedelta(days=7)` (`settings.py:522`).
Um refresh token roubado que **não é usado** permanece válido por até 7 dias.

O `SingleSession` revoga ao usar o refresh (rotate + blacklist), mas um token
comprometido que o atacante guarda sem usar fica válido o período completo.
Não há: device fingerprinting, IP binding, nem idle timeout.

Adicionalmente, `token_blacklist_outstandingtoken` acumula todos os tokens emitidos
sem limpeza automática — crescimento unbounded similar ao `simple_history`.

---

## Objetivo

1. Reduzir `REFRESH_TOKEN_LIFETIME` para valor mais conservador (ex: 2 dias)
2. Adicionar task periódica de limpeza de outstanding tokens expirados (já suportado pelo simplejwt)
3. (Opcional) Registrar `last_used_at` no `UserSession` para idle detection

---

## Skills a invocar antes de implementar

- `/django-expert` — padrões Django, SimpleJWT, Celery tasks
- `/bora-ali-backend` — convenções do projeto (SingleSession, UserSession, estrutura de tasks)

---

## Arquivos que serão mexidos

| Arquivo | O que muda |
|---------|-----------|
| `backend/config/settings.py` | Reduzir `REFRESH_TOKEN_LIFETIME`; adicionar `OUTSTANDING_TOKEN_CLEANUP_ENABLED` |
| `backend/accounts/tasks.py` | Adicionar task `cleanup_expired_tokens` |

---

## Implementação passo a passo

### 1. `settings.py` — reduzir TTL do refresh token

```python
# backend/config/settings.py
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=2),  # era 7 — reduzido para limitar janela de exposição
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "ALGORITHM": "HS256",
    "ALLOWED_ALGORITHMS": ["HS256"],
}
```

> **Trade-off**: usuários que ficam sem usar o app por mais de 2 dias precisarão fazer
> login novamente. Para um diário pessoal de uso irregular, considerar 3–5 dias como
> compromisso entre segurança e UX. Discutir com o usuário antes de aplicar.

### 2. `tasks.py` — limpeza de tokens expirados

`simplejwt` oferece o management command `flushexpiredtokens` nativamente.
Encapsular numa task Celery para agendar via admin:

```python
# backend/accounts/tasks.py (criar se não existir)
from celery import shared_task
import logging

_log = logging.getLogger("accounts.tasks")

@shared_task
def cleanup_expired_tokens():
    """Remove outstanding tokens expirados da blacklist do simplejwt."""
    from django.core.management import call_command
    from io import StringIO

    out = StringIO()
    call_command("flushexpiredtokens", stdout=out)
    result = out.getvalue().strip()
    _log.info("cleanup_expired_tokens: %s", result or "concluído")
    return result
```

### 3. Agendar via admin

1. Admin → **Operações** → **Tasks periódicas** → **Adicionar**
2. Nome: `Limpar tokens expirados`
3. Task: `accounts.tasks.cleanup_expired_tokens`
4. Schedule: crontab `0 4 * * *` (4h da manhã, 1x/dia)
5. Salvar

### 4. (Opcional) `last_used_at` em `UserSession`

```python
# backend/accounts/models.py — em UserSession
last_used_at = models.DateTimeField(auto_now=True, null=True)
```

```python
# backend/accounts/authentication.py — após validar sessão:
user.session.last_used_at = timezone.now()
user.session.save(update_fields=["last_used_at"])
```

Permite no admin identificar sessões inativas e, no futuro, implementar idle timeout
(`if last_used_at < now - idle_timeout: raise SessionInvalidatedException()`).

> **Atenção**: `auto_now=True` gera um UPDATE por request autenticada — avaliar impacto
> em produção antes de ativar. Alternativa: atualizar com frequência reduzida (a cada 5 min).

---

## Verificação

```bash
scripts/dev-check.sh backend
```

Teste manual:
```bash
cd backend
python manage.py shell -c "
from accounts.tasks import cleanup_expired_tokens
result = cleanup_expired_tokens.apply()
print(result.result)
"
```

Verificar que `token_blacklist_outstandingtoken` reduz após execução (se houver tokens expirados).
