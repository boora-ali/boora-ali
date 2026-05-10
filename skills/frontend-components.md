# Frontend: Componentes e Padrões

## Modal — ESC + backdrop

```tsx
// components/ui/Modal.tsx
import { useEffect } from "react";

export function Modal({ open, onClose, title, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
         onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
           onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}
```

## Confirmação de exclusão — padrão

Aplicar em PlaceDetailPage (excluir lugar) e VisitCard (excluir visita):

```tsx
const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

// Botão de excluir abre o modal:
<Button variant="danger" onClick={() => setDeleteConfirmOpen(true)}>Excluir</Button>

// Modal com confirmação:
<Modal open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} title="Excluir lugar">
  <p className="text-sm text-muted">{t("placeDetail.deleteConfirmMessage")}</p>
  <div className="flex gap-2 pt-4">
    <Button variant="secondary" onClick={() => setDeleteConfirmOpen(false)}>Cancelar</Button>
    <Button variant="danger" onClick={async () => {
      await placesService.remove(place.public_id);
      nav("/places");
    }}>Excluir</Button>
  </div>
</Modal>
```

## AuthImage — imagens autenticadas

```tsx
// components/ui/AuthImage.tsx
// Usa api.get(src, { responseType: "blob" }) para buscar imagem com token JWT
// Cria object URL e seta em <img src>
// Necessário porque /api/media/* exige Authorization header
```

## Formulário de visit item — validação de nome obrigatório

O `saveItem` no `VisitForm` valida antes de adicionar ao array:

```typescript
function saveItem() {
  if (!draftItem.name?.trim()) {
    setItemNameError(t("visitItemForm.nameRequired"));
    return;
  }
  setItemNameError("");
  // ... adiciona item
}
```

## Botão "+ Adicionar consumível" no header do form

Exibir apenas quando `items.length === 0`. Quando há items, o card `+` no final da grade já serve.

## Rotas

```
/                  → redirect baseado em token
/login             → LoginPage (público)
/register          → RegisterPage (público)
/places            → PlacesPage (privado)
/places/new        → NewPlacePage (privado)
/places/:id        → PlaceDetailPage (privado)
/places/:id/edit   → EditPlacePage (privado)
/places/:id/visits/new → NewVisitPage (privado)
/visits/:id/edit   → EditVisitPage (privado)
/account           → AccountPage (privado)
```

## form-data.ts

```typescript
export function toFormData(data: Record<string, unknown>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) {
    if (v instanceof File) fd.append(k, v);
    else if (v !== undefined && v !== null) fd.append(k, String(v));
  }
  return fd;
}

export function hasFile(data: Record<string, unknown>): boolean {
  return Object.values(data).some((v) => v instanceof File);
}
```

## api-errors.ts

```typescript
export function getApiErrorState(error: unknown, fallback: string) {
  const data = (error as AxiosError)?.response?.data as Record<string, unknown> | undefined;
  const message = (data?.detail as string) ?? fallback;
  const fieldErrors: Record<string, string> = {};
  for (const [key, val] of Object.entries(data ?? {})) {
    if (key !== "detail" && key !== "code" && Array.isArray(val)) {
      fieldErrors[key] = String((val as unknown[])[0]);
    }
  }
  return { message, fieldErrors };
}
```
