# Perf #2 — Soft delete em cascata com histórico O(N)

## Problema

`save_deleted_at_with_history()` em `backend/places/views.py` (linha 26–29) itera cada instância
individualmente e chama `.save()` — o que dispara um `UPDATE` por registro **e** um `INSERT`
no `simple_history`. Para um lugar com 50 visitas e 200 items, isso gera 251 queries dentro
de uma única transaction.

```python
# views.py:26 — O(N) queries
def save_deleted_at_with_history(queryset, deleted_at):
    for instance in queryset.iterator():
        instance.deleted_at = deleted_at
        instance.save(update_fields=["deleted_at"])
```

Chamada em:
- `PlaceViewSet.perform_destroy` — VisitItems + Visits + Place
- `PlaceViewSet.restore` — Visits + VisitItems
- `VisitViewSet.perform_destroy` — VisitItems

---

## Objetivo

Substituir o loop por `queryset.update()` + inserção em lote no histórico (`bulk_create`).
Mantém integridade do `simple_history` sem N round-trips ao banco.

---

## Skills a invocar antes de implementar

- `/django-expert` — ORM bulk operations, `queryset.update()`, `bulk_create`, simple_history
- `/bora-ali-backend` — convenções do projeto (PlaceViewSet, VisitViewSet, soft delete pattern)

---

## Arquivos que serão mexidos

| Arquivo | O que muda |
|---------|-----------|
| `backend/places/views.py` | Reescrever `save_deleted_at_with_history` usando `update()` + `bulk_create` do histórico |

---

## Implementação passo a passo

### 1. Nova implementação de `save_deleted_at_with_history`

```python
# backend/places/views.py
from django.utils import timezone


def save_deleted_at_with_history(queryset, deleted_at):
    """Soft-delete/restore em lote preservando simple_history."""
    model = queryset.model
    HistoricalRecord = model.history.model

    instances = list(queryset.select_for_update())
    if not instances:
        return

    # 1. bulk UPDATE — 1 query
    queryset.update(deleted_at=deleted_at)

    # 2. registrar histórico em lote — 1 INSERT
    now = timezone.now()
    history_records = [
        HistoricalRecord(
            **{
                field.attname: getattr(instance, field.attname)
                for field in model._meta.concrete_fields
            },
            deleted_at=deleted_at,
            history_date=now,
            history_type="~",
            history_user=None,
        )
        for instance in instances
    ]
    HistoricalRecord.objects.bulk_create(history_records)
```

> **Atenção**: `simple_history` adiciona campos extras no modelo histórico (`history_date`,
> `history_type`, `history_user`, `history_id`, `history_change_reason`). Conferir os field names
> exatos rodando `python manage.py shell -c "from places.models import Place; print([f.name for f in Place.history.model._meta.fields])"`.

### 2. Alternativa mais simples (sem replicar campos manualmente)

Se o modelo histórico tiver muitos campos customizados, usar o método helper do simple_history:

```python
def save_deleted_at_with_history(queryset, deleted_at):
    instances = list(queryset)
    if not instances:
        return
    queryset.update(deleted_at=deleted_at)
    for instance in instances:
        instance.deleted_at = deleted_at
    # bulk_create usando o manager histórico
    queryset.model.history.model.objects.bulk_create([
        queryset.model.history.model.get_default_history_attrs(inst, "~")
        for inst in instances
    ], ignore_conflicts=False)
```

Verificar se a versão do `simple_history` instalada expõe `get_default_history_attrs` antes de usar.

---

## Verificação

```bash
# Checar API e tests
scripts/dev-check.sh backend
```

Teste extra — confirmar que o histórico é criado:
```bash
cd backend
python manage.py shell -c "
from places.models import Place, Visit, VisitItem
p = Place.objects.filter(deleted_at__isnull=True).first()
print('Visits:', Visit.objects.filter(place=p).count())
print('Items:', VisitItem.objects.filter(visit__place=p).count())
"
```
Depois deletar via API e verificar `Place.history.all()` / `Visit.history.all()`.
