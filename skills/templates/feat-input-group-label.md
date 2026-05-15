# Frontend — InputGroup + Label em todos os formulários

## Objetivo

Instalar os componentes shadcn `input-group` e `label` e aplicá-los em todos os formulários
do sistema, seguindo dois princípios:

1. **`Label`** — indicador explícito de campo em todo `<input>`, `<textarea>` e `<select>`,
   substituindo todos os `<label>` raw e `<span>` usados como labels. Uniformiza acessibilidade.
2. **`InputGroup`** — agrupa visualmente inputs que têm addons (ícones, prefixos de moeda,
   botões embutidos), substituindo o `PasswordInput` atual e enriquecendo campos de URL e preço.

---

## Skills a invocar antes de implementar

- `/bora-ali-frontend` — convenções do projeto (FormField, Controller, forwardRef, i18n)
- `/frontend-design` — decisões visuais de ícones, espaçamento e consistência de addon

---

## Diretrizes de design (aplicar com `/frontend-design`)

Antes de implementar, invocar `/frontend-design` para validar as escolhas visuais abaixo.
Não tratar como defaults automáticos — revisar no contexto do tema atual do projeto.

### Labels
- `<Label>` e `<FormLabel>` devem ter peso e cor consistentes em todos os formulários.
  Verificar se o token de fonte do shadcn (`text-sm font-medium`) está alinhado com o design
  atual do projeto ou se precisa de override global via `label.tsx`.
- Espaçamento entre `Label` e o campo abaixo deve ser uniforme (`gap` ou `space-y`) —
  não deixar cada arquivo definir sua própria margem.

### InputGroup — addons visuais
- **Ícones**: usar tamanho `16px` para todos os addons de ícone (Lucide). Cor: `text-muted-foreground`
  em repouso, `text-foreground` ao focar o grupo. O shadcn `InputGroup` gerencia o foco via
  `data-slot="input-group-control"` — conferir se o tema atual aplica a ring no grupo inteiro.
- **Separador visual**: decidir se o addon recebe uma borda separadora (`border-r`, `border-l`)
  ou se o fundo do addon (`bg-muted/40`) já é suficiente para diferenciar do campo.
- **Prefixo de moeda** (`R$`): `text-sm font-medium text-muted-foreground` — não usar fonte menor
  que o input para não parecer nota de rodapé.

### Foco e acessibilidade
- O `focus-visible:ring` deve envolver o `InputGroup` inteiro, não só o `InputGroupInput`.
  Verificar no tema se `data-slot="input-group"` já recebe esse estilo ou se precisa de patch
  em `input-group.tsx`.
- `PasswordInput` — o botão do olho usa `tabIndex={-1}` para não entrar no fluxo de tab,
  mas deve ser alcançável via mouse/touch. Confirmar que o aria-label está traduzido nos dois idiomas.

### Consistência entre formulários
- Todos os uploads de foto (`PlaceForm`, `VisitForm`, `VisitItemForm`, `AccountPage`) usam
  a mesma área dashed. Após a troca de `<label>` por `<Label>`, conferir que o cursor e o
  hover continuam consistentes — `<Label>` do shadcn adiciona `cursor-pointer` por padrão,
  o que pode duplicar ou conflitar com classes existentes.

---

## Instalação

```bash
cd frontend
npx shadcn@latest add input-group
npx shadcn@latest add label
```

Verificar que `src/components/ui/input-group.tsx` e `src/components/ui/label.tsx` foram gerados.

---

## Regra global: FormLabel vs Label

> **Dentro de `<FormField>`**: manter `FormLabel` (de `@/components/ui/form`) — ele já encapsula
> `Label` do Radix e adiciona estado de erro automático do React Hook Form.
>
> **Fora de `<FormField>`**: usar `<Label>` diretamente (de `@/components/ui/label`).
> Isso inclui: switches com `Controller`, checkboxes, upload de foto, labels de seção, `DateTimePicker`.

---

## Arquivos que serão mexidos

| Arquivo | O que muda |
|---------|-----------|
| `src/components/ui/PasswordInput.tsx` | Reescrever com `InputGroup` + `InputGroupInput` + `InputGroupAddon` |
| `src/components/ui/DateTimePicker.tsx` | `<label>` raw → `<Label>` (2 ocorrências) |
| `src/routes/RegisterPage.tsx` | `<label>` raw dos termos → `<Label>` |
| `src/routes/AccountPage.tsx` | `<label>` raw do upload de foto → `<Label>` |
| `src/components/places/PlaceForm.tsx` | `InputGroup` em Instagram, Endereço e Maps URL; `<span>` de labels soltos → `<Label>` |
| `src/components/visits/VisitForm.tsx` | `<label>` raw do switch → `<Label>`; `<span>` de labels soltos → `<Label>` |
| `src/components/visits/VisitItemForm.tsx` | `InputGroup` no Preço; `<label>` raw do switch → `<Label>`; `<span>` de label do foto → `<Label>` |

---

## Implementação passo a passo

### 1. `PasswordInput.tsx` — reescrever com InputGroup

```tsx
// src/components/ui/PasswordInput.tsx
import { forwardRef, useState } from "react";
import type { InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
} from "@/components/ui/input-group";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export const PasswordInput = forwardRef<HTMLInputElement, Props>((props, ref) => {
  const [visible, setVisible] = useState(false);
  return (
    <InputGroup>
      <InputGroupInput ref={ref} type={visible ? "text" : "password"} {...props} />
      <InputGroupAddon>
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="flex h-full items-center px-3 text-muted-foreground hover:text-foreground"
          tabIndex={-1}
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </InputGroupAddon>
    </InputGroup>
  );
});
PasswordInput.displayName = "PasswordInput";
```

> `PasswordInput` continua recebendo `register()` via `forwardRef` — sem mudança de contrato
> para `LoginPage`, `RegisterPage` e `AccountPage`.

---

### 2. `PlaceForm.tsx` — InputGroup + Label

**Campos dentro de `FormField`** (Instagram, Endereço) — trocar `<Input>` por `InputGroup`:

```tsx
import { Instagram, MapPin, Map } from "lucide-react";
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group";

// Campo instagram_url
<InputGroup>
  <InputGroupAddon>
    <Instagram size={15} className="text-muted-foreground" />
  </InputGroupAddon>
  <InputGroupInput maxLength={200} {...field} />
</InputGroup>

// Campo address (manter onBlur={handleAddressBlur})
<InputGroup>
  <InputGroupAddon>
    <MapPin size={15} className="text-muted-foreground" />
  </InputGroupAddon>
  <InputGroupInput maxLength={300} onBlur={handleAddressBlur} {...field} />
</InputGroup>
```

**Campo `maps_url`** — está fora de `FormField`, usa `<span>` como label e `Input` solto.
Trocar ambos:

```tsx
import { Label } from "@/components/ui/label";

// ANTES (linha ~275):
<span className="text-sm font-medium">{t("placeForm.maps")}</span>
<div className="flex gap-2">
  <Input value={mapsUrl} onChange={handleMapsUrlChange} maxLength={2000} className="flex-1" />
  <button ...>...</button>   {/* botão de resolver URL — não mexer */}
</div>

// DEPOIS:
<Label>{t("placeForm.maps")}</Label>
<div className="flex gap-2">
  <InputGroup className="flex-1">
    <InputGroupAddon>
      <Map size={15} className="text-muted-foreground" />
    </InputGroupAddon>
    <InputGroupInput value={mapsUrl} onChange={handleMapsUrlChange} maxLength={2000} />
  </InputGroup>
  <button ...>...</button>   {/* botão de resolver URL — não mexer */}
</div>
```

**Label da foto de capa** — `<span>` solto na linha ~352:

```tsx
// ANTES:
<span className="text-sm font-medium">{t("placeForm.coverPhoto")}</span>

// DEPOIS:
<Label>{t("placeForm.coverPhoto")}</Label>
```

---

### 3. `VisitForm.tsx` — Label

**Switch `wouldReturn`** — `<label>` raw (linha ~286):

```tsx
import { Label } from "@/components/ui/label";

// ANTES:
<label className="flex items-center gap-2 cursor-pointer">
  <Switch checked={!!field.value} onCheckedChange={field.onChange} aria-label={t("visitForm.wouldReturn")} />
  <span className="text-sm font-medium">{t("visitForm.wouldReturn")}</span>
</label>

// DEPOIS:
<Label className="flex items-center gap-2 cursor-pointer">
  <Switch checked={!!field.value} onCheckedChange={field.onChange} />
  {t("visitForm.wouldReturn")}
</Label>
```

**Label da foto da visita** — `<span>` solto (linha ~317):

```tsx
// ANTES:
<span className="text-sm font-medium">{t("visitForm.photo")}</span>

// DEPOIS:
<Label>{t("visitForm.photo")}</Label>
```

**Label do título de itens** — `<span>` solto (linha ~357):

```tsx
// ANTES:
<span className="text-sm font-medium">{t("visitForm.consumedTitle")}</span>

// DEPOIS:
<Label>{t("visitForm.consumedTitle")}</Label>
```

---

### 4. `VisitItemForm.tsx` — InputGroup + Label

**Campo `price`** — `InputGroup` com prefixo de moeda:

```tsx
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group";

// Substituir <Input type="number" ...>:
<InputGroup>
  <InputGroupAddon>
    <span className="text-sm text-muted-foreground">R$</span>
  </InputGroupAddon>
  <InputGroupInput
    type="number"
    min={0}
    step={0.01}
    value={field.value ?? ""}
    onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
  />
</InputGroup>
```

**Switch `would_order_again`** — `<label>` raw (linha ~179):

```tsx
import { Label } from "@/components/ui/label";

// ANTES:
<label className="flex items-center gap-2 cursor-pointer py-0.5">

// DEPOIS:
<Label className="flex items-center gap-2 cursor-pointer py-0.5">
```

**Label da foto do item** — `<span>` solto (linha ~99):

```tsx
// ANTES:
<span className="text-sm font-medium">{t("visitItemForm.photo")}</span>

// DEPOIS:
<Label>{t("visitItemForm.photo")}</Label>
```

---

### 5. `RegisterPage.tsx` — Label

**Checkbox de termos** (linha ~164):

```tsx
import { Label } from "@/components/ui/label";

// ANTES:
<label className="flex items-start gap-2 cursor-pointer">

// DEPOIS:
<Label className="flex items-start gap-2 cursor-pointer">
```

---

### 6. `AccountPage.tsx` — Label

**Área de upload de foto de perfil** (linha ~171):

```tsx
import { Label } from "@/components/ui/label";

// ANTES:
<label className="group relative flex h-44 w-full cursor-pointer ...">

// DEPOIS:
<Label className="group relative flex h-44 w-full cursor-pointer ...">
```

---

### 7. `DateTimePicker.tsx` — Label

```tsx
import { Label } from "@/components/ui/label";

// ANTES (linha ~68):
<label className="block text-sm font-medium">{label}</label>

// DEPOIS:
<Label className="block text-sm font-medium">{label}</Label>

// ANTES (linha ~97):
<label className="mb-2 block text-sm font-medium">

// DEPOIS:
<Label className="mb-2 block text-sm font-medium">
```

---

## Mapa completo de ocorrências

| Arquivo | Tipo | Linha aprox. | Ação |
|---------|------|-------------|------|
| `PasswordInput.tsx` | `Input` solto com botão | — | `InputGroup` completo |
| `PlaceForm.tsx` | `Input` instagram_url | 239 | `InputGroup` + ícone Instagram |
| `PlaceForm.tsx` | `Input` address | 259 | `InputGroup` + ícone MapPin |
| `PlaceForm.tsx` | `Input` maps_url (fora de FormField) | 277 | `InputGroup` + ícone Map |
| `PlaceForm.tsx` | `<span>` label maps | 275 | `<Label>` |
| `PlaceForm.tsx` | `<span>` label coverPhoto | 352 | `<Label>` |
| `VisitForm.tsx` | `<label>` switch wouldReturn | 286 | `<Label>` |
| `VisitForm.tsx` | `<span>` label photo | 317 | `<Label>` |
| `VisitForm.tsx` | `<span>` label consumedTitle | 357 | `<Label>` |
| `VisitItemForm.tsx` | `<span>` label photo | 99 | `<Label>` |
| `VisitItemForm.tsx` | `Input` price | 197 | `InputGroup` + prefixo R$ |
| `VisitItemForm.tsx` | `<label>` switch wouldOrderAgain | 179 | `<Label>` |
| `RegisterPage.tsx` | `<label>` checkbox termos | 164 | `<Label>` |
| `AccountPage.tsx` | `<label>` upload foto | 171 | `<Label>` |
| `DateTimePicker.tsx` | `<label>` interno | 68, 97 | `<Label>` |

---

## Verificação

```bash
cd frontend
npm run lint
npm run test
npm run build
```

Rodar nessa ordem: lint primeiro (erros de import/tipo), depois testes (quebras de comportamento),
depois build (confirmação final de compilação). Corrigir qualquer falha antes de considerar pronto.

Checar visualmente:
- Senha: olho aparece dentro do campo, não ao lado
- Instagram/Endereço em `PlaceForm`: ícone alinhado à esquerda do input
- Maps URL: ícone à esquerda + botão de resolver à direita do grupo
- Preço em `VisitItemForm`: "R$" colado à esquerda
- Switches e checkboxes: clicar na label inteira continua ativando o controle
- Upload de foto: área clicável ainda funciona (o `<Label>` ativa o `<input type="file">`)
