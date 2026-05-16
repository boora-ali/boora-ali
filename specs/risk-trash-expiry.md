# Risco #3 — Lixeira sem expiração automática

## Problema

Soft-deleted places (`deleted_at IS NOT NULL`) permanecem na lixeira indefinidamente.
Não há política de purge automático. Um usuário que deletou 500 lugares ao longo de meses
acumula registros para sempre, incluindo:
- Registros em `places_place`, `places_visit`, `places_visititem`
- Registros históricos correspondentes em `historical_places_*`
- Imagens no storage (S3/VersityGW) nunca removidas

**Endpoint existente:** `DELETE /api/places/{id}/permanent/` (manual, por lugar).
Não há expiração automática nem limpeza em lote.

---

## Objetivo

Adicionar task Celery periódica que converte em permanent delete os lugares soft-deletados
há mais de `TRASH_RETENTION_DAYS` dias (default: 30). A limpeza remove Place + cascade
(Visit, VisitItem) + imagens via `ImageService`.

---

## Skills a invocar antes de implementar

- `/django-expert` — padrões Django, Celery tasks, signals, queryset delete vs individual delete
- `/bora-ali-backend` — convenções do projeto (ImageService, Place/Visit/VisitItem, signals de cleanup)

> Pré-requisito: implementar `feat-notifications.md` antes (usado no passo 4).

---

## Arquivos que serão mexidos

| Arquivo | O que muda |
|---------|-----------|
| `backend/config/settings.py` | Adicionar `TRASH_RETENTION_DAYS` |
| `backend/places/tasks.py` | Adicionar task `purge_expired_trash` |

> **Agendamento**: configurar via admin → Operações → Tasks periódicas.
> Rodar 1x/dia (ex: crontab `0 2 * * *`).

---

## Implementação passo a passo

### 1. `settings.py` — configuração de retenção

```python
# backend/config/settings.py
TRASH_RETENTION_DAYS = int(os.getenv("TRASH_RETENTION_DAYS", "30"))
```

### 2. `tasks.py` — task de purge

```python
# backend/places/tasks.py
import logging
from django.conf import settings
from django.utils import timezone
from datetime import timedelta

_log = logging.getLogger("places.tasks")

@shared_task
def purge_expired_trash():
    """Permanent delete de lugares na lixeira há mais de TRASH_RETENTION_DAYS dias."""
    cutoff = timezone.now() - timedelta(days=settings.TRASH_RETENTION_DAYS)

    expired = Place.objects.deleted().filter(
        deleted_at__lt=cutoff,
    )

    count = expired.count()
    if count == 0:
        return {"deleted": 0}

    # Deletar imagens via storage antes do DELETE SQL
    # (signals de cleanup já disparam em .delete() individual, mas não em queryset.delete())
    for place in expired.iterator():
        if place.cover_photo:
            try:
                place.cover_photo.delete(save=False)
            except Exception as exc:
                _log.warning("Falha ao deletar imagem do place %s: %s", place.pk, exc)

        # Imagens de visits e visit_items via signals existentes
        # place.delete() dispara CASCADE e os signals de cleanup

    # Hard delete — CASCADE via DB para Visit e VisitItem
    deleted_count, _ = expired.delete()

    _log.info("purge_expired_trash: %d lugares permanentemente deletados (cutoff=%s)", deleted_count, cutoff.date())
    return {"deleted": deleted_count}
```

> **Atenção**: `queryset.delete()` não dispara signals individuais. Se os signals de cleanup
> de foto (em `places/signals.py`) usam `post_delete`, trocar o loop acima por iteração
> individual com `.delete()` para garantir que as imagens sejam removidas do storage.
>
> Verificar:
> ```bash
> grep -n "post_delete\|cleanup_photo\|cover_photo\|photo" backend/places/signals.py
> ```

### 3. Agendar via admin

1. Admin → **Operações** → **Tasks periódicas** → **Adicionar**
2. Nome: `Purge lixeira expirada`
3. Task: `places.tasks.purge_expired_trash`
4. Schedule: crontab `0 2 * * *` (2h da manhã)
5. Salvar

### 4. Notificar o usuário antes do purge

Antes de deletar, notificar via sistema de notificações (ver `feat-notifications.md`):

```python
# backend/places/tasks.py
from notifications.service import notify, NotificationType

@shared_task
def purge_expired_trash():
    cutoff = timezone.now() - timedelta(days=settings.TRASH_RETENTION_DAYS)
    expired = Place.objects.deleted().filter(deleted_at__lt=cutoff)

    count = expired.count()
    if count == 0:
        return {"deleted": 0}

    # Agrupar por usuário para notificar sem acumular
    from django.db.models import Count
    by_user = expired.values("user").annotate(total=Count("id"))
    for row in by_user:
        from django.contrib.auth import get_user_model
        user = get_user_model().objects.filter(pk=row["user"]).first()
        if user:
            notify(
                user=user,
                type=NotificationType.TRASH_EXPIRY,
                title="Lugares excluídos permanentemente",
                body=f"{row['total']} lugar(es) da lixeira foram removidos permanentemente.",
            )

    # ... loop de deleção de imagens e expired.delete() ...
```

> `notify()` não cria duplicatas — se já existe notificação não lida do tipo `TRASH_EXPIRY`,
> a nova não é criada. Ao expirar sem leitura (7 dias), na próxima execução da task uma nova
> notificação pode ser disparada.

### 5. `expires_at` no serializer da lixeira (opcional)

```python
# No serializer da lixeira — campo calculado:
expires_at = deleted_at + timedelta(days=TRASH_RETENTION_DAYS)
```

Permite o frontend mostrar "Será excluído permanentemente em X dias".

---

## Verificação

```bash
scripts/dev-check.sh backend
```

Teste manual:
```bash
cd backend
python manage.py shell -c "
from places.tasks import purge_expired_trash
result = purge_expired_trash.apply()
print(result.result)
"
```
