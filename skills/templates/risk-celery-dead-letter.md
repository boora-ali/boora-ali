# Risco #2 — Celery sem dead letter para `resolve_place_coords`

## Problema

`resolve_place_coords` (`backend/places/tasks.py:58`) esgota 3 tentativas com backoff
(60s, 120s, 240s) e ao falhar na última tentativa, apenas registra `coords_status = "failed"`
e retorna silenciosamente:

```python
# tasks.py:45-48
if self.request.retries >= self.max_retries:
    place.coords_status = CoordsStatus.FAILED
    place.save(update_fields=["coords_status"])
    return
```

Não há: alerta, notificação, log estruturado com nível ERROR, nem mecanismo de retry manual.
Em produção isso já acontece silenciosamente — usuários com `maps_url` válido podem ter
coordenadas nunca resolvidas sem saber.

**Impacto**: pins no mapa ficam sem posição; usuário não recebe feedback e não consegue
forçar re-resolução.

---

## Objetivo

1. Logar falha final como `ERROR` (capturável pelo Sentry)
2. Adicionar endpoint `POST /api/places/{id}/retry-coords/` para o usuário forçar nova tentativa
3. Adicionar action no admin para retry em lote

---

## Skills a invocar antes de implementar

- `/django-expert` — padrões Django, ORM, DRF ViewSet `@action`, admin actions
- `/bora-ali-backend` — convenções do projeto (exceptions, PlaceViewSet, estrutura de tasks)

---

## Arquivos que serão mexidos

| Arquivo | O que muda |
|---------|-----------|
| `backend/places/tasks.py` | Log ERROR na falha final da task |
| `backend/places/views.py` | Adicionar action `retry_coords` no `PlaceViewSet` |
| `backend/places/urls.py` | Registrar rota `/retry-coords/` (se não usar router automático) |
| `backend/places/admin.py` | Adicionar admin action para retry em lugares com `coords_status=failed` |

---

## Implementação passo a passo

### 1. `tasks.py` — log ERROR na falha final

```python
# backend/places/tasks.py
import logging

_log = logging.getLogger("places.tasks")

def _resolve_place_coords(self, place_pk: int):
    place = Place.objects.filter(pk=place_pk).first()
    if place is None or place.coords_status != CoordsStatus.PENDING:
        return

    try:
        response = _safe_maps_urlopen(place.maps_url)
        lat, lng = extract_coords(response.url)
        if lat is None or lng is None:
            raise ValueError("Coordenadas não encontradas na URL do Maps")
    except Exception as exc:
        if self.request.retries >= self.max_retries:
            place.coords_status = CoordsStatus.FAILED
            place.save(update_fields=["coords_status"])
            _log.error(                          # NOVO — capturado pelo Sentry
                "resolve_place_coords falhou após %d tentativas: place_pk=%s maps_url=%r exc=%s",
                self.max_retries + 1,
                place_pk,
                place.maps_url,
                exc,
            )
            return
        countdown = 60 * (2**self.request.retries)
        raise self.retry(exc=exc, countdown=countdown)

    place.latitude = Decimal(str(lat))
    place.longitude = Decimal(str(lng))
    place.coords_status = CoordsStatus.RESOLVED
    place.save(update_fields=["latitude", "longitude", "coords_status"])
```

### 2. `views.py` — action `retry_coords`

```python
# backend/places/views.py
from rest_framework.decorators import action
from rest_framework.response import Response
from .tasks import resolve_place_coords

class PlaceViewSet(viewsets.ModelViewSet):
    # ... código existente ...

    @action(detail=True, methods=["post"], url_path="retry-coords")
    def retry_coords(self, request, public_id=None):
        place = self.get_object()
        if not place.maps_url:
            return Response({"detail": "Este lugar não possui maps_url."}, status=400)
        if place.coords_status == CoordsStatus.RESOLVED:
            return Response({"detail": "Coordenadas já resolvidas."}, status=400)

        place.coords_status = CoordsStatus.PENDING
        place.save(update_fields=["coords_status"])
        resolve_place_coords.delay(place.pk)
        return Response({"detail": "Resolução de coordenadas enfileirada."})
```

### 3. `admin.py` — action de retry em lote

```python
# backend/places/admin.py
from .tasks import resolve_place_coords
from .models import CoordsStatus

@admin.action(description="Retentar resolução de coordenadas (failed)")
def retry_failed_coords(modeladmin, request, queryset):
    failed = queryset.filter(coords_status=CoordsStatus.FAILED, maps_url__isnull=False)
    count = 0
    for place in failed:
        place.coords_status = CoordsStatus.PENDING
        place.save(update_fields=["coords_status"])
        resolve_place_coords.delay(place.pk)
        count += 1
    modeladmin.message_user(request, f"{count} lugar(es) enfileirado(s) para retry.")

# Registrar no PlaceAdmin:
class PlaceAdmin(admin.ModelAdmin):
    actions = [retry_failed_coords]
```

---

## Verificação

```bash
scripts/dev-check.sh backend
```

Teste manual:
1. Criar lugar com `maps_url` inválida → aguardar `coords_status = failed`
2. Chamar `POST /api/places/{id}/retry-coords/` → verificar `coords_status = pending`
3. Verificar no Sentry que o log ERROR foi capturado na falha
