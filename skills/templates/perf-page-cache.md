# Perf #5 — pageCache do frontend perdido na navegação

## Problema

`pageCache` em `PlacesPage.tsx` é um estado React local (`useState<Record<number, Place[]>>({})`).
Ao navegar para `/places/:id` e voltar, o componente é desmontado e remontado —
o cache é descartado e todas as páginas são refetchadas do zero.

**Sintoma**: usuário abre lugar na página 3, volta para lista → spinner + 3 requests à API.

**Arquivo problemático:** `frontend/src/routes/PlacesPage.tsx` linha 46

```ts
const [pageCache, setPageCache] = useState<Record<number, Place[]>>({});
```

---

## Objetivo

Persistir o cache de páginas **fora** do componente React, usando um store em memória no módulo
do service (singleton por session) ou `sessionStorage`. Ao voltar para `/places`, o cache
é restaurado e nenhum re-fetch ocorre para páginas já carregadas.

---

## Skills a invocar antes de implementar

- `/bora-ali-frontend` — convenções do frontend (placesService, PlacesPage, React Query, testes)
- `/frontend-design` — se houver alteração de UI junto com o cache

---

## Arquivos que serão mexidos

| Arquivo | O que muda |
|---------|-----------|
| `frontend/src/services/places.service.ts` | Adicionar `PlacePageCache` singleton com `get`, `set`, `invalidate` |
| `frontend/src/routes/PlacesPage.tsx` | Remover `pageCache` state; ler/escrever via `PlacePageCache` |

---

## Implementação passo a passo

### 1. Cache singleton no service

```ts
// frontend/src/services/places.service.ts

type CacheKey = string; // `${page}-${search}-${status}`

class PlacePageCache {
  private store: Map<CacheKey, Place[]> = new Map();

  key(page: number, search?: string, status?: string): CacheKey {
    return `${page}|${search ?? ""}|${status ?? ""}`;
  }

  get(page: number, search?: string, status?: string): Place[] | undefined {
    return this.store.get(this.key(page, search, status));
  }

  set(page: number, data: Place[], search?: string, status?: string): void {
    this.store.set(this.key(page, search, status), data);
  }

  invalidate(): void {
    this.store.clear();
  }
}

export const placePageCache = new PlacePageCache();
```

### 2. PlacesPage.tsx — usar o singleton

```tsx
// frontend/src/routes/PlacesPage.tsx

// REMOVER:
// const [pageCache, setPageCache] = useState<Record<number, Place[]>>({});

// No useEffect de fetch:
useEffect(() => {
  const cached = placePageCache.get(page, debouncedSearch, status);
  if (cached) {
    setData((prev) => ({ ...prev!, results: cached }));
    return;
  }

  let cancelled = false;
  startTransition(() => setLoading(true));
  placesService
    .list({ page, search: debouncedSearch || undefined, status: (status as PlaceStatus) || undefined })
    .then((nextData) => {
      if (cancelled) return;
      setData(nextData);
      placePageCache.set(page, nextData.results, debouncedSearch, status);
      setError("");
    })
    ...
}, [navigate, debouncedSearch, status, page, t, refreshTick]);

// No reset de filtros — invalidar o cache singleton também:
if (prevFilters.debouncedSearch !== debouncedSearch || ...) {
  placePageCache.invalidate();
  setPage(1);
}
```

> **Remover** `location.key` das deps do useEffect de list.
> Isso impedia que o cache do state funcionasse ao voltar — agora o singleton persiste.

### 3. Invalidar ao criar/editar/deletar lugar

O evento `PLACES_CHANGED_EVENT` já dispara `setRefreshTick` → o reset de filtros já chama
`placePageCache.invalidate()`. Nenhuma mudança adicional necessária.

---

## Verificação

```bash
scripts/dev-check.sh frontend
```

Teste manual:
1. Abrir `/places` → navegar até página 3
2. Abrir um lugar → voltar com o botão back
3. Verificar no DevTools Network que **nenhum** request novo para `/api/places/` foi feito para página 3
