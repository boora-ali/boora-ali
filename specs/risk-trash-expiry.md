# Risco #3 — Lixeira sem expiração automática ✅ IMPLEMENTADO

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

Backend:
- `/django-expert` — padrões Django, Celery tasks, signals, queryset delete vs individual delete
- `/django-patterns` — periodic tasks, loop individual vs queryset.delete(), iterator() em bulk ops
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
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.utils import timezone

from places.models import Place

_log = logging.getLogger("places.tasks")


@shared_task
def purge_expired_trash():
    """Permanent delete de lugares na lixeira há mais de TRASH_RETENTION_DAYS dias."""
    cutoff = timezone.now() - timedelta(days=settings.TRASH_RETENTION_DAYS)

    expired = Place.objects.deleted().filter(deleted_at__lt=cutoff)

    count = expired.count()
    if count == 0:
        return {"deleted": 0}

    deleted_count = 0
    # place.delete() individual — obrigatório para disparar post_delete signals.
    # signals.py registra cleanup_place_cover_photo, cleanup_visit_photo e
    # cleanup_visit_item_photo via post_delete. queryset.delete() não os dispara,
    # causando vazamento de storage em Place, Visit e VisitItem.
    for place in expired.select_related().iterator():
        place.delete()
        deleted_count += 1

    _log.info(
        "purge_expired_trash: %d lugares permanentemente deletados (cutoff=%s)",
        deleted_count, cutoff.date(),
    )
    return {"deleted": deleted_count}
```

> **Por que não usar `queryset.delete()`**: `signals.py` limpa storage via
> `post_delete` em Place, Visit e VisitItem. `queryset.delete()` pula esses
> signals, vazando imagens no S3/VersityGW. O loop individual é necessário.

### 3. Agendar via admin

1. Admin → **Operações** → **Tasks periódicas** → **Adicionar**
2. Nome: `Purge lixeira expirada`
3. Task: `places.tasks.purge_expired_trash`
4. Schedule: crontab `0 2 * * *` (2h da manhã)
5. Salvar

### 4. Notificar o usuário antes do purge

Versão completa com notificação agrupada por usuário integrada ao loop de deleção:

```python
# backend/places/tasks.py
import logging
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.db.models import Count
from django.utils import timezone

from places.models import Place

_log = logging.getLogger("places.tasks")


@shared_task
def purge_expired_trash():
    from notifications.service import notify, NotificationType

    cutoff = timezone.now() - timedelta(days=settings.TRASH_RETENTION_DAYS)
    expired = Place.objects.deleted().filter(deleted_at__lt=cutoff)

    count = expired.count()
    if count == 0:
        return {"deleted": 0}

    # Notificar por usuário antes de deletar
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

    # Deleção individual — dispara post_delete signals para limpeza de storage
    deleted_count = 0
    for place in expired.select_related().iterator():
        place.delete()
        deleted_count += 1

    _log.info(
        "purge_expired_trash: %d lugares permanentemente deletados (cutoff=%s)",
        deleted_count, cutoff.date(),
    )
    return {"deleted": deleted_count}
```

> `notify()` não cria duplicatas — se já existe notificação não lida do tipo `TRASH_EXPIRY`,
> a nova não é criada.

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
