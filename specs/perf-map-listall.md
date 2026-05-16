# Perf #1 — listAll sem paginação para o mapa

> ✅ **IMPLEMENTADO**

## Problema

`PlacesPage.tsx` chama `placesService.listAll()` em todo render de filtro/busca para popular os pins do mapa.
Essa chamada não tem paginação — retorna **todos** os lugares do usuário em um único request.
Com centenas de registros, isso aumenta latência, payload e memória no navegador.

**Arquivo problemático:** `frontend/src/routes/PlacesPage.tsx` linhas 106–119

```ts
// Hoje — sem limite, sem paginação
placesService.listAll({ search: debouncedSearch || undefined, status: ... })
```

---

## Objetivo

Carregar apenas os lugares **com coordenadas válidas** (`coords_status = resolved`, `latitude != null`)
e só quando o mapa estiver visível (`showMap === true`).

---

## Skills a invocar antes de implementar

Backend:
- `/django-expert` — filtros DRF, queryset otimizado
- `/bora-ali-backend` — convenções do projeto (PlaceViewSet, serializers, public_id)

Frontend:
- `/bora-ali-frontend` — convenções do frontend (placesService, React Query, testes)
- `/frontend-design` — componentes shadcn/ui se houver alteração de UI no mapa

---

## Arquivos que serão mexidos

| Arquivo | O que muda |
|---------|-----------|
| `frontend/src/services/places.service.ts` | Adicionar `listMapPins()`: `?coords_status=resolved&has_coords=true&page_size=500` |
| `frontend/src/routes/PlacesPage.tsx` | Trocar `listAll` por `listMapPins`; mover o useEffect do mapa para depender de `showMap` |
| `backend/places/filters.py` | Adicionar filtro `has_coords` (booleano: `latitude__isnull=False`) |
| `backend/places/views.py` | Garantir que `PlaceViewSet.get_queryset` para `list` não quebra com o novo filtro |

---

## Implementação passo a passo

### 1. Backend — filtro `has_coords`

```python
# backend/places/filters.py
import django_filters
from .models import Place

class PlaceFilter(django_filters.FilterSet):
    # ... filtros existentes ...
    has_coords = django_filters.BooleanFilter(
        method="filter_has_coords", label="Has coordinates"
    )

    def filter_has_coords(self, queryset, name, value):
        if value:
            return queryset.filter(latitude__isnull=False, longitude__isnull=False)
        return queryset.filter(latitude__isnull=True)
```

### 2. Frontend — `listMapPins` no service

```ts
// frontend/src/services/places.service.ts
async listMapPins(params?: { search?: string; status?: PlaceStatus }): Promise<Place[]> {
  const res = await api.get<Page<Place>>("/api/places/", {
    params: { ...params, has_coords: true, page_size: 500, ordering: "name" },
  });
  return res.data.results;
}
```

### 3. Frontend — PlacesPage.tsx

```tsx
// Mover e condicionar o useEffect do mapa
useEffect(() => {
  if (!showMap) return;          // só carrega quando mapa aberto
  let cancelled = false;
  placesService
    .listMapPins({ search: debouncedSearch || undefined, status: (status as PlaceStatus) || undefined })
    .then((places) => { if (!cancelled) setMapPlaces(places); })
    .catch(() => { if (!cancelled) setMapPlaces([]); });
  return () => { cancelled = true; };
}, [showMap, debouncedSearch, status, refreshTick]);
```

**Remover** `location.key` da dep do useEffect do mapa (não precisa refetch a cada navegação).

---

## Verificação

```bash
scripts/dev-check.sh backend
scripts/dev-check.sh frontend
```

Teste manual: abrir o mapa com 0 e com N lugares — verificar no DevTools Network que `has_coords=true` vai no request e que o payload é menor.
