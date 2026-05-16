# Perf #9 — `simple_history` crescendo sem poda

> ✅ **IMPLEMENTADO**

## Problema

`HistoricalRecords` está ativo em `Place`, `Visit` e `VisitItem` (`places/models.py` linhas 54, 134, 213).
Cada `.save()` insere um registro nas tabelas históricas (`historical_places_place`,
`historical_places_visit`, `historical_places_visititem`).

Sem política de retenção, essas tabelas crescem indefinidamente. Em 12–18 meses de produção,
é comum as tabelas históricas superarem o tamanho das tabelas principais.

**Impacto operacional**:
- Backup mais lento e pesado
- Admin Django lento ao abrir histórico de registros com muitas versões
- Crescimento de storage sem bound

---

## Objetivo

Adicionar task Celery periódica que apaga registros históricos com mais de `N` dias,
usando o método nativo do `simple_history`. Configurável via env var `HISTORY_RETENTION_DAYS`
(default: 90 dias).

---

## Skills a invocar antes de implementar

- `/django-expert` — Celery tasks periódicas, simple_history, queryset bulk delete
- `/bora-ali-backend` — convenções do projeto (estrutura de tasks, agendamento via admin)

---

## Arquivos que serão mexidos

| Arquivo | O que muda |
|---------|-----------|
| `backend/places/tasks.py` | Adicionar task `cleanup_old_history` |
| `backend/config/settings.py` | Adicionar `HISTORY_RETENTION_DAYS` |

> **Agendamento**: configurar via admin → Operações → Tasks periódicas (django_celery_beat).
> Não requer migration — somente nova task + beat schedule via admin.

---

## Implementação passo a passo

### 1. `settings.py` — variável de retenção

```python
# backend/config/settings.py
HISTORY_RETENTION_DAYS = int(os.getenv("HISTORY_RETENTION_DAYS", "90"))
```

### 2. `tasks.py` — task de limpeza

```python
# backend/places/tasks.py
from django.conf import settings
from django.utils import timezone
from datetime import timedelta

@shared_task
def cleanup_old_history():
    """Remove historical records older than HISTORY_RETENTION_DAYS."""
    from .models import Place, Visit, VisitItem

    cutoff = timezone.now() - timedelta(days=settings.HISTORY_RETENTION_DAYS)

    deleted = {
        "place": Place.history.filter(history_date__lt=cutoff).delete()[0],
        "visit": Visit.history.filter(history_date__lt=cutoff).delete()[0],
        "visit_item": VisitItem.history.filter(history_date__lt=cutoff).delete()[0],
    }

    import logging
    logging.getLogger("places.tasks").info(
        "History cleanup complete: %s", deleted
    )
    return deleted
```

### 3. Agendar via admin

1. Abrir `/admin/` → **Operações** → **Tasks periódicas** → **Adicionar**
2. Nome: `Limpar histórico antigo`
3. Task: `places.tasks.cleanup_old_history`
4. Schedule: **Intervalo** — `1 day` (ou crontab `0 3 * * *` para 3h da manhã)
5. Salvar

> **Alternativa**: registrar via código em `places/apps.py` com `django_celery_beat`
> para não depender de configuração manual no admin.

### 4. (Opcional) Primeira execução manual para drain inicial

```bash
cd backend
python manage.py shell -c "
from places.tasks import cleanup_old_history
result = cleanup_old_history.apply()
print(result.result)
"
```

---

## Verificação

```bash
scripts/dev-check.sh backend
```

Teste manual — verificar contagem antes e depois:
```bash
cd backend
python manage.py shell -c "
from places.models import Place, Visit, VisitItem
print('Place history:', Place.history.count())
print('Visit history:', Visit.history.count())
print('VisitItem history:', VisitItem.history.count())
"
```
