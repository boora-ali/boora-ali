# Frontend — Bora Ali

Ver invariantes globais em `../CLAUDE.md`. Este arquivo cobre padrões específicos do frontend.

## Estrutura

```
src/
  routes/         # LoginPage, RegisterPage, PlacesPage, PlaceDetailPage,
                  # New/EditPlacePage, New/EditVisitPage, AccountPage
  components/ui/  # Button, Input*, Select*, Textarea*, PasswordInput*,
                  # Card, Modal, LocationPicker, DateTimePicker, RatingInput, AuthImage
                  # * = forwardRef obrigatório (ver abaixo)
  components/places/  # PlaceForm, PlaceCard
  components/visits/  # VisitForm, VisitItemForm
  schemas/        # auth.ts, place.ts, visit.ts — Zod schemas + tipos inferidos
  services/       # api.ts, api-errors.ts, auth/places/visits/visit-items.service.ts,
                  # form-data.ts, geocoding.service.ts
  contexts/       # AuthContext.tsx, useAuth.ts
  utils/          # form-errors.ts, url.ts, formatters.ts, constants.ts
  locales/        # pt/en translation.json
```

**api.ts**: Bearer token, 401 → refresh → retry → logout. Detecta session codes.
**form-data.ts**: `toFormData()`, `hasFile()`, `stripStringImages()` — usado nos services com upload.

## Componentes padrão de estado

Use estes componentes antes de criar um loading/empty/error novo:

- `PageState` (`src/components/ui/PageState.tsx`)
  - padrão para estado de página inteira
  - cobre `loading`, `error` e `empty`
  - use quando a rota inteira depende do fetch
- `LoadingState` (`src/components/ui/LoadingState.tsx`)
  - skeleton de página inteira
  - mantenha para shells maiores e telas com estrutura fixa
- `EmptyState` (`src/components/ui/EmptyState.tsx`)
  - vazio padronizado
  - use quando a tela estiver sem dados reais
- `ErrorMessage` (`src/components/ui/ErrorMessage.tsx`)
  - erro simples de bloco ou de página
- `StatusPanel` (`src/components/ui/StatusPanel.tsx`)
  - shell centralizado para estados de auth/fluxos especiais
  - exemplo: verificação de email, share público, mensagens de estado com ações
- `SectionLoading` (`src/components/ui/SectionLoading.tsx`)
  - loading leve de seção, lista, sheet ou bloco interno
  - evita repetir texto + spinner pequeno em vários lugares
- `LoadingSpinner` (`src/components/ui/LoadingSpinner.tsx`)
  - spinner inline para botão ou indicador pequeno
  - use em submits e ações locais, não em page shell
- `ImageWithSpinner` (`src/components/ui/ImageWithSpinner.tsx`)
  - imagem autenticada com estado de carregamento embutido
  - aceita `fallback` quando não há `src`
- `useImagePreview` (`src/hooks/useImagePreview.ts`)
  - padrão para preview local com `blob:` e cleanup
  - use em forms que lidam com upload de imagem

Regra prática:
- página inteira: `PageState`
- estado centralizado especial: `StatusPanel`
- loading pequeno de seção: `SectionLoading`
- spinner de botão: `LoadingSpinner`
- imagem com fallback/preview: `ImageWithSpinner` + `useImagePreview`

## Formulários — padrão obrigatório

Todo formulário usa React Hook Form + Zod:

```ts
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { mySchema, type MyFormValues } from "../schemas/my-schema";
import { getApiErrorState } from "../services/api-errors";
import { applyApiErrors } from "../utils/form-errors";

const { register, handleSubmit, setError, control, formState: { errors, isSubmitting } } =
  useForm<MyFormValues>({ resolver: zodResolver(mySchema) });

const onSubmit = async (data: MyFormValues) => {
  try {
    await service.save(data);
  } catch (error) {
    const apiError = getApiErrorState(error, t("form.saveError"));
    setError("root", { message: apiError.message });
    applyApiErrors(setError, apiError.fieldErrors);
  }
};

// No JSX:
{errors.root && <ErrorMessage message={errors.root.message!} />}
```

**`register()` vs `Controller`**:
- `register()` → inputs HTML nativos (`<input>`, `<textarea>`)
- `Controller` → `RatingInput`, `DateTimePicker`, `Select` com cast de tipo, checkboxes controlados

## Schemas (`src/schemas/`)

Editar os existentes antes de criar novos:

| Arquivo | Schemas exportados |
|---------|-------------------|
| `auth.ts` | `loginSchema`, `registerSchema`, `changePasswordSchema`, `updateProfileSchema` |
| `place.ts` | `placeSchema` (lat/lng como `z.string()`, sem cover_photo) |
| `visit.ts` | `visitSchema`, `visitItemSchema` (sem photo — estado local) |

**Regra**: `cover_photo` e `photo` são **sempre estado local** (`File | null` + preview URL). Nunca registrar como campo RHF. Adicionar ao payload em `onFormSubmit`:
```ts
await onSubmit({ ...data, ...(file ? { photo: file } : {}) });
```

## Tipos: form vs API

| Campo | No form (Zod) | No type TS da API | Tratamento |
|-------|--------------|-------------------|-----------|
| `latitude` / `longitude` | `string \| null` | `string \| null` | nenhum (API e regex já retornam string) |
| `VisitItem.price` | `number \| null` | `string` | `String(price)` em `toPayload()` do service |
| `display_name`, `nickname` | `string \| undefined` | `string` | `data.field ?? ""` ao chamar o service |
| `cover_photo`, `photo` | estado local `File \| null` | `string` (URL) | spread condicional no submit |

## forwardRef — obrigatório em inputs

Componentes que recebem `register()` precisam de `forwardRef` para o `ref` chegar ao DOM:

```ts
export const Input = forwardRef<HTMLInputElement, Props>(({ label, error, ...rest }, ref) => (
  <label>
    <input ref={ref} {...rest} />
    {error && <span className="text-danger text-xs">{error}</span>}
  </label>
));
Input.displayName = "Input";
```

Componentes com forwardRef: `Input`, `Select`, `Textarea`, `PasswordInput`.
Qualquer novo componente que aceite `register()` deve seguir o mesmo padrão.

## VisitItemForm — submit externo via `form` attr

O `VisitItemForm` renderiza dentro de um `Modal` no `VisitForm`. O botão Salvar fica fora do `<form>`:

```tsx
// VisitItemForm.tsx
export const VISIT_ITEM_FORM_ID = "visit-item-form";
<form id={VISIT_ITEM_FORM_ID} onSubmit={handleSubmit(onSubmit)}>

// VisitForm.tsx — botão no Modal, fora do form
<Button type="submit" form={VISIT_ITEM_FORM_ID}>Salvar</Button>

// draftKey reseta o form ao abrir o modal
const [draftKey, setDraftKey] = useState(0);
function openAdd() { setDraftKey(k => k + 1); setModalOpen(true); }
<VisitItemForm key={draftKey} defaultValues={...} onSave={handleItemSave} />
```

## i18n

Toda string visível ao usuário: `t("chave")`. Adicionar em ambos:
- `src/locales/pt/translation.json`
- `src/locales/en/translation.json`

## useEffect com estado assíncrono — regra obrigatória

A regra `react-hooks/set-state-in-effect` bloqueia `setState` **síncrono** no corpo do efeito.

```ts
// ERRADO — dispara lint error:
useEffect(() => {
  setLoading(true);  // ← proibido
  fetch(url).then(res => setData(res));
}, [url]);

// CORRETO — setState de "loading" após registrar callbacks; estado único:
const [state, setState] = useState<{ status: "idle" | "loading" | "error"; data: T | null }>
  ({ status: "idle", data: null });
const prevKey = useRef<string | null>(null);

useEffect(() => {
  if (!url || prevKey.current === url) return;
  prevKey.current = url;

  fetch(url)
    .then(res => setState({ status: "idle", data: res }))
    .catch(() => setState({ status: "error", data: null }));

  setState({ status: "loading", data: null });  // após registrar callbacks
}, [url]);
```

## Checklist antes de buildar Docker

```bash
npm run build   # tsc -b + vite build — obrigatório, não substituir por tsc --noEmit
npm run lint
```
