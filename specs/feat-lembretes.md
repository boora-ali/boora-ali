# Feat — Lembretes de Places

## Problema

O usuário adiciona lugares que quer visitar e nunca recebe um lembrete. Lugares visitados
há muito tempo podem merecer uma nova visita. Sem lembretes, o app é passivo — o usuário
precisa lembrar de abrir para consultar a lista.

---

## Objetivo

1. Task Celery periódica gera notificações para dois cenários:
   - **Não visitado**: place com `status=WANT_TO_VISIT` adicionado há mais de `N` dias
   - **Faz tempo**: place com `status=VISITED` cuja última visita foi há mais de `M` dias
2. Usuário pode configurar por place se quer ou não receber lembretes (campo `reminders_enabled`)
3. Notificações via sistema de notificações (`feat-notifications.md`)

---

## Skills a invocar antes de implementar

Backend:
- `/django-expert` — Celery beat, annotate, subquery, queryset filtering
- `/bora-ali-backend` — convenções (Place, Visit, tasks.py, signals.py)

> **Dependências**: `feat-notifications.md` — obrigatório. Task dispara `notify()`.
> **Pré-requisito**: configurar Celery Beat no admin antes de ativar.

---

## Arquivos que serão mexidos

| Arquivo | O que muda |
|---------|-----------|
| `backend/places/models.py` | Adicionar `reminders_enabled` em `Place` |
| `backend/config/settings.py` | Adicionar `REMINDER_WANT_TO_VISIT_DAYS`, `REMINDER_REVISIT_DAYS` |
| `backend/places/tasks.py` | Adicionar task `send_place_reminders` |
| `backend/places/migrations/` | `makemigrations places` após adicionar campo |
| `backend/places/serializers.py` | Expor `reminders_enabled` no serializer de detalhe |
| `frontend/src/routes/PlaceDetailPage.tsx` | Toggle para ativar/desativar lembrete do place |

---

## Implementação passo a passo

### 1. `settings.py` — configurar janelas de tempo

```python
# backend/config/settings.py
REMINDER_WANT_TO_VISIT_DAYS = int(os.getenv("REMINDER_WANT_TO_VISIT_DAYS", "30"))
REMINDER_REVISIT_DAYS = int(os.getenv("REMINDER_REVISIT_DAYS", "90"))
```

### 2. `models.py` — campo `reminders_enabled`

```python
# backend/places/models.py
class Place(PublicIdModel):
    # ... campos existentes ...
    reminders_enabled = models.BooleanField(default=True)
```

> Rodar `python manage.py makemigrations places` após adicionar o campo.

### 3. `tasks.py` — task de lembretes

```python
# backend/places/tasks.py
import logging
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.db.models import Exists, OuterRef, Subquery
from django.utils import timezone

from places.models import Place, PlaceStatus, Visit

_log = logging.getLogger("places.tasks")


@shared_task
def send_place_reminders():
    from notifications.service import notify, NotificationType

    now = timezone.now()
    want_cutoff = now - timedelta(days=settings.REMINDER_WANT_TO_VISIT_DAYS)
    revisit_cutoff = now - timedelta(days=settings.REMINDER_REVISIT_DAYS)

    # Usar ~Exists evita LEFT JOIN implícito e elimina a necessidade de distinct()
    has_visit = Visit.objects.live().filter(place=OuterRef("pk"))

    want_to_visit = Place.objects.live().filter(
        reminders_enabled=True,
        status=PlaceStatus.WANT_TO_VISIT,
        created_at__lt=want_cutoff,
    ).filter(~Exists(has_visit)).select_related("user")

    want_count = 0
    for place in want_to_visit.iterator():
        notify(
            user=place.user,
            type=NotificationType.REMINDER_WANT_TO_VISIT,
            title="Você ainda não foi lá!",
            body=f"Faz {settings.REMINDER_WANT_TO_VISIT_DAYS}+ dias que você adicionou {place.name}. Que tal visitar?",
            metadata={"place_public_id": str(place.public_id)},
        )
        want_count += 1

    last_visit_subq = Visit.objects.live().filter(
        place=OuterRef("pk")
    ).order_by("-visited_at").values("visited_at")[:1]

    revisit_candidates = Place.objects.live().filter(
        reminders_enabled=True,
        status=PlaceStatus.VISITED,
    ).annotate(
        last_visit=Subquery(last_visit_subq)
    ).filter(
        last_visit__lt=revisit_cutoff,
    ).select_related("user")

    revisit_count = 0
    for place in revisit_candidates.iterator():
        notify(
            user=place.user,
            type=NotificationType.REMINDER_REVISIT,
            title="Saudades de lá?",
            body=f"Faz um tempo que você não vai ao {place.name}. Vale uma nova visita!",
            metadata={"place_public_id": str(place.public_id)},
        )
        revisit_count += 1

    _log.info(
        "send_place_reminders: %d want-to-visit, %d revisit",
        want_count, revisit_count,
    )
```

### 4. Agendar via admin

1. Admin → **Operações** → **Tasks periódicas** → **Adicionar**
2. Nome: `Lembretes de places`
3. Task: `places.tasks.send_place_reminders`
4. Schedule: crontab `0 10 * * 1` (toda segunda-feira às 10h)
5. Salvar

### 5. `NotificationType` — adicionar novos tipos

```python
# notifications/constants.py (ou onde NotificationType está definido)
class NotificationType(str, Enum):
    # ... tipos existentes ...
    REMINDER_WANT_TO_VISIT = "reminder_want_to_visit"
    REMINDER_REVISIT = "reminder_revisit"
```

### 6. Frontend — toggle no PlaceDetail

```tsx
// frontend/src/routes/PlaceDetailPage.tsx
<div className="flex items-center justify-between">
  <span className="text-sm">{t("place.reminders_enabled")}</span>
  <Switch
    checked={place.reminders_enabled}
    onCheckedChange={(checked) =>
      updatePlace.mutate({ reminders_enabled: checked })
    }
  />
</div>
```

### 7. Traduções i18n (pt-BR)

```json
"place.reminders_enabled": "Receber lembretes",
"notification.reminder_want_to_visit.title": "Você ainda não foi lá!",
"notification.reminder_revisit.title": "Saudades de lá?"
```

---

## O que este feature não inclui (YAGNI)

- Configuração de frequência por usuário (semanal, mensal)
- Lembretes por horário ou localização
- Integração com calendário
- Push notifications mobile (apenas in-app via `feat-notifications.md`)

---

## Verificação

```bash
scripts/dev-check.sh backend
```

Teste manual:
```bash
cd backend
python manage.py shell -c "
from places.tasks import send_place_reminders
result = send_place_reminders.apply()
print(result.result)
"
```

1. Criar place com `status=WANT_TO_VISIT` e `created_at` retroativo (forçar no shell)
2. Rodar task → notificação gerada
3. Desativar `reminders_enabled` → place ignorado na próxima execução
