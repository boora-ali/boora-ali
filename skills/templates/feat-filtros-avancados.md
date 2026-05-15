# Feat — Filtros Avançados de Places

## Problema

A listagem de places retorna todos os registros do usuário sem possibilidade de filtrar
por categoria, status, rating ou período de visita. Com o crescimento do diário, encontrar
places específicos exige scroll manual.

---

## Objetivo

1. Backend aceita query params para filtrar places: categoria, status, rating médio, período da última visita
2. Frontend exibe um Sheet/Drawer com controles de filtro e aplica os parâmetros na query

---

## Skills a invocar antes de implementar

Backend:
- `/django-expert` — queryset filtering, annotate, Q objects
- `/bora-ali-backend` — PlaceQuerySet em managers.py, convenções de viewset

Frontend:
- `/bora-ali-frontend` — React Query, serviços de API, roteamento
- `/frontend-design` — Sheet, Select, Slider, Badge (shadcn/ui)

> **Dependências**: nenhuma. Feature autossuficiente.
> **Relação com outros specs**: `perf-text-search-trigram.md` cobre busca textual — este spec cobre filtros estruturados.

---

## Arquivos que serão mexidos

| Arquivo | O que muda |
|---------|-----------|
| `backend/places/managers.py` | Adicionar métodos de filtro em `PlaceQuerySet` |
| `backend/places/views.py` | `PlaceViewSet.list()` lê query params e filtra |
| `backend/places/serializers.py` | `PlaceListSerializer` inclui `avg_rating` anotado |
| `frontend/src/api/places.ts` | `getPlaces()` aceita objeto `PlaceFilters` |
| `frontend/src/components/PlaceFilterSheet.tsx` | Sheet com form de filtros (novo) |
| `frontend/src/routes/PlaceListPage.tsx` | Integrar `PlaceFilterSheet` e passar filtros ativos |

---

## Implementação passo a passo

### 1. `managers.py` — filtros em `PlaceQuerySet`

```python
# backend/places/managers.py
from django.db.models import Avg, Q

class PlaceQuerySet(models.QuerySet):

    def with_avg_rating(self):
        return self.annotate(avg_rating=Avg("visits__overall_rating"))

    def filter_by_params(self, params: dict):
        qs = self.with_avg_rating()

        if category := params.get("category"):
            qs = qs.filter(category=category)

        if status := params.get("status"):
            qs = qs.filter(status=status)

        min_r = params.get("min_rating")
        max_r = params.get("max_rating")
        if min_r is not None:
            qs = qs.filter(avg_rating__gte=float(min_r))
        if max_r is not None:
            qs = qs.filter(avg_rating__lte=float(max_r))

        if date_from := params.get("date_from"):
            qs = qs.filter(visits__visited_at__date__gte=date_from).distinct()
        if date_to := params.get("date_to"):
            qs = qs.filter(visits__visited_at__date__lte=date_to).distinct()

        return qs
```

### 2. `views.py` — aplicar filtros no `list()`

```python
# backend/places/views.py
class PlaceViewSet(viewsets.ModelViewSet):

    def get_queryset(self):
        qs = Place.objects.filter(user=self.request.user, deleted_at__isnull=True)
        if self.action == "list":
            qs = qs.filter_by_params(self.request.query_params)
        return qs.select_related("user")
```

### 3. `serializers.py` — expor `avg_rating`

```python
# backend/places/serializers.py
class PlaceListSerializer(serializers.ModelSerializer):
    avg_rating = serializers.FloatField(read_only=True, default=None)

    class Meta:
        model = Place
        fields = ["public_id", "name", "category", "address", "status",
                  "cover_photo", "avg_rating", "created_at"]
```

### 4. Frontend — `api/places.ts`

```typescript
// frontend/src/api/places.ts
export interface PlaceFilters {
  category?: string;
  status?: string;
  min_rating?: number;
  max_rating?: number;
  date_from?: string;  // YYYY-MM-DD
  date_to?: string;
}

export const placesApi = {
  getPlaces: (filters: PlaceFilters = {}) =>
    api.get<Place[]>("/api/places/", { params: filters }),
};
```

### 5. Frontend — `PlaceFilterSheet.tsx`

```tsx
// frontend/src/components/PlaceFilterSheet.tsx
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

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
          <Select label={t("filters.category")} {...form.register("category")}
            options={PLACE_CATEGORIES} />
          <Select label={t("filters.status")} {...form.register("status")}
            options={PLACE_STATUSES} />
          {/* min/max rating com Slider ou Select 1-5 */}
          {/* date_from / date_to com DatePicker */}
          <Button type="submit" className="w-full">{t("filters.apply")}</Button>
          <Button type="button" variant="ghost" className="w-full"
            onClick={() => onApply({})}>{t("filters.clear")}</Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
```

### 6. `PlaceListPage.tsx` — integrar filtros

```tsx
const [filters, setFilters] = useState<PlaceFilters>({});
const [sheetOpen, setSheetOpen] = useState(false);

const { data } = useQuery({
  queryKey: ["places", filters],
  queryFn: () => placesApi.getPlaces(filters),
});

// Badge de "filtros ativos" no header
const activeCount = Object.values(filters).filter(Boolean).length;
```

### 7. Traduções i18n (pt-BR)

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
scripts/dev-check.sh backend
scripts/dev-check.sh frontend
```

Teste manual:
1. `GET /api/places/?category=restaurant` → só restaurantes
2. `GET /api/places/?status=visited&min_rating=4` → visitados com nota ≥ 4
3. `GET /api/places/?date_from=2024-01-01&date_to=2024-06-30` → visitados no período
4. Frontend: abrir Sheet, aplicar filtros, badge mostra contagem, limpar zera
