# Feat — Filtros Avançados de Places

## Problema

A listagem de places retorna todos os registros do usuário sem possibilidade de filtrar
por categoria, status, rating ou período de visita. Com o crescimento do diário, encontrar
places específicos exige scroll manual.

---

## Objetivo

1. Backend aceita query params para filtrar places: categoria, status, rating médio, período da última visita
2. Frontend exibe um Sheet/Drawer com controles de filtro e aplica os parâmetros na query
3. Badge no header indica quantidade de filtros ativos

---

## Skills a invocar antes de implementar

Backend:
- `/django-expert` — FilterSet com django-filters, annotate, Q objects
- `/bora-ali-backend` — PlaceFilter em filters.py, convenções de viewset

Frontend:
- `/bora-ali-frontend` — React Query, serviços de API, roteamento
- `/frontend-design` — Sheet, Select, Slider, Badge (shadcn/ui)

> **Dependências**: nenhuma. Feature autossuficiente.
> **Relação com outros specs**: `perf-text-search-trigram.md` cobre busca textual — este spec cobre filtros estruturados.

---

## Arquivos que serão mexidos

| Arquivo | O que muda |
|---------|-----------|
| `backend/places/filters.py` | Estender `PlaceFilter` com `min_rating`, `max_rating`, `date_from`, `date_to` |
| `backend/places/views.py` | `PlaceViewSet` já usa `filterset_class = PlaceFilter` — nada a mudar |
| `backend/places/serializers.py` | `PlaceListSerializer` inclui `avg_rating` anotado |
| `backend/places/managers.py` | `PlaceQuerySet.with_avg_rating()` como método reutilizável |
| `frontend/src/services/places.service.ts` | `getPlaces()` aceita objeto `PlaceFilters` |
| `frontend/src/components/PlaceFilterSheet.tsx` | Sheet com form de filtros (novo) |
| `frontend/src/routes/PlacesPage.tsx` | Integrar `PlaceFilterSheet` e passar filtros ativos |

---

## Implementação passo a passo

### 1. `managers.py` — `with_avg_rating()` no `PlaceQuerySet`

O projeto já tem `PlaceQuerySet` em `managers.py`. Adicionar o método de anotação:

```python
# backend/places/managers.py
from django.db.models import Avg

class PlaceQuerySet(models.QuerySet):
    # ... métodos existentes ...

    def with_avg_rating(self):
        return self.annotate(avg_rating=Avg("visits__overall_rating"))
```

### 2. `filters.py` — estender `PlaceFilter` com django-filters

O projeto já usa `django_filters` com `PlaceFilter`. Estender em vez de criar:

```python
# backend/places/filters.py
import django_filters
from django.db.models import Avg
from .models import Place, Visit, VisitItem


class PlaceFilter(django_filters.FilterSet):
    has_coords = django_filters.BooleanFilter(method="filter_has_coords")
    min_rating = django_filters.NumberFilter(method="filter_min_rating")
    max_rating = django_filters.NumberFilter(method="filter_max_rating")
    date_from = django_filters.DateFilter(method="filter_date_from")
    date_to = django_filters.DateFilter(method="filter_date_to")

    def filter_has_coords(self, queryset, name, value):
        if value:
            return queryset.filter(latitude__isnull=False, longitude__isnull=False)
        return queryset.filter(latitude__isnull=True)

    def filter_min_rating(self, queryset, name, value):
        return queryset.with_avg_rating().filter(avg_rating__gte=value)

    def filter_max_rating(self, queryset, name, value):
        return queryset.with_avg_rating().filter(avg_rating__lte=value)

    def filter_date_from(self, queryset, name, value):
        return queryset.filter(visits__visited_at__date__gte=value).distinct()

    def filter_date_to(self, queryset, name, value):
        return queryset.filter(visits__visited_at__date__lte=value).distinct()

    class Meta:
        model = Place
        fields = {"status": ["exact"], "category": ["exact", "icontains"]}
```

> `filter_min_rating` / `filter_max_rating` chamam `.with_avg_rating()` para evitar
> duplo `annotate` se ambos forem passados juntos — Django deduplica automaticamente.

### 3. `views.py` — nada a mudar

`PlaceViewSet` já declara `filterset_class = PlaceFilter` e `DjangoFilterBackend`.
Os novos filtros entram automaticamente.

### 4. `serializers.py` — expor `avg_rating`

```python
# backend/places/serializers.py
class PlaceListSerializer(serializers.ModelSerializer):
    avg_rating = serializers.FloatField(read_only=True, default=None)

    class Meta:
        model = Place
        fields = [
            "public_id", "name", "category", "address", "status",
            "cover_photo", "avg_rating", "created_at",
        ]
```

`avg_rating` será `None` quando não houver visitas (`.with_avg_rating()` retorna `NULL`).

### 5. Frontend — `services/places.service.ts`

```typescript
// frontend/src/services/places.service.ts
export interface PlaceFilters {
  category?: string;
  status?: string;
  min_rating?: number;
  max_rating?: number;
  date_from?: string;  // YYYY-MM-DD
  date_to?: string;
}

// Adicionar parâmetro a getPlaces (ou à função equivalente existente):
export const getPlaces = (filters: PlaceFilters = {}) =>
  api.get<Place[]>("/api/places/", { params: filters });
```

### 6. Frontend — `PlaceFilterSheet.tsx`

```tsx
// frontend/src/components/PlaceFilterSheet.tsx
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  filters: PlaceFilters;
  onApply: (f: PlaceFilters) => void;
}

export function PlaceFilterSheet({ open, onOpenChange, filters, onApply }: Props) {
  const form = useForm<PlaceFilters>({ defaultValues: filters });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader><SheetTitle>{t("filters.title")}</SheetTitle></SheetHeader>
        <form onSubmit={form.handleSubmit(onApply)} className="space-y-4 mt-4">
          {/* Select categoria, status */}
          {/* min_rating / max_rating: Select 1–5 */}
          {/* date_from / date_to: DatePicker */}
          <Button type="submit" className="w-full">{t("filters.apply")}</Button>
          <Button type="button" variant="ghost" className="w-full"
            onClick={() => { form.reset({}); onApply({}); }}>
            {t("filters.clear")}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
```

### 7. `PlacesPage.tsx` — integrar filtros

```tsx
const [filters, setFilters] = useState<PlaceFilters>({});
const [sheetOpen, setSheetOpen] = useState(false);

const { data } = useQuery({
  queryKey: ["places", filters],
  queryFn: () => getPlaces(filters),
});

// Badge de filtros ativos
const activeCount = Object.values(filters).filter((v) => v !== undefined && v !== "").length;
```

### 8. Traduções i18n (pt-BR)

```json
"filters.title": "Filtrar lugares",
"filters.category": "Categoria",
"filters.status": "Status",
"filters.min_rating": "Nota mínima",
"filters.max_rating": "Nota máxima",
"filters.date_from": "Visitado após",
"filters.date_to": "Visitado antes",
"filters.apply": "Aplicar",
"filters.clear": "Limpar filtros"
```

---

## O que este feature não inclui (YAGNI)

- Busca full-text por nome/endereço (coberta por `perf-text-search-trigram.md`)
- Salvar filtros favoritos
- Ordenação customizada (nome, data, rating)
- Filtro por cidade extraída do endereço

---

## Verificação

```bash
# backend/
pytest places/ -k filter
```

Teste manual:
1. `GET /api/places/?category=restaurant` → só restaurantes
2. `GET /api/places/?status=visited&min_rating=4` → visitados com nota ≥ 4
3. `GET /api/places/?date_from=2024-01-01&date_to=2024-06-30` → visitados no período
4. `GET /api/places/?min_rating=3&max_rating=5` → rating entre 3 e 5
5. Frontend: abrir Sheet, aplicar filtros, badge mostra contagem, limpar zera
