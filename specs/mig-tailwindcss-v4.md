# Mig — Tailwind CSS v3 → v4

> ✅ **IMPLEMENTADO**


## Problema

O PR #217 (dependabot) bumpa `tailwindcss` de `3.4.19` para `4.3.0`. A v4 é uma
reescrita completa — **não é upgrade drop-in**. Mergear sem migração quebra o build:

- `tailwind.config.js` não é lido — toda a config de tokens, cores e animações some
- `@tailwind base/components/utilities` não existe mais — CSS não carrega
- PostCSS plugin muda de `tailwindcss` para `@tailwindcss/postcss`
- `darkMode: "class"` precisa de tratamento explícito

O projeto usa tokens de design via CSS variables (`--color-primary`, `--color-surface`…) e
shadcn/ui com variables HSL. Isso é compatível com a v4, mas precisa de migração.

---

## Objetivo

Migrar o frontend para Tailwind CSS v4 mantendo:
1. Todos os tokens de design (cores, fontes, animações)
2. Modo escuro via classe `.dark`
3. shadcn/ui funcionando
4. Build Vite sem erros
5. Nenhuma regressão visual

---

## Skills a invocar antes de implementar

- `/bora-ali-frontend` — estrutura do frontend, padrões de componentes
- `/impeccable` — verificar regressões visuais após migração
- `/frontend-testing` — rodar testes após migração

---

## Arquivos que serão mexidos

| Arquivo | O que muda |
|---------|-----------|
| `frontend/package.json` | Adicionar `@tailwindcss/vite`; remover `autoprefixer` |
| `frontend/vite.config.ts` | Adicionar plugin `@tailwindcss/vite` |
| `frontend/postcss.config.js` | Trocar `tailwindcss: {}` por `@tailwindcss/postcss: {}` |
| `frontend/tailwind.config.js` | **Deletar** — config migra para CSS |
| `frontend/src/index.css` | Substituir `@tailwind` directives; adicionar `@theme` |

---

## Passo a passo

### 1. Instalar dependências corretas

```bash
cd frontend/

# Adicionar plugin Vite oficial do Tailwind v4
npm install -D @tailwindcss/vite

# @tailwindcss/postcss já vem com tailwindcss v4 — verificar se foi incluído
npm install -D @tailwindcss/postcss

# autoprefixer não é mais necessário na v4 (prefixos embutidos)
npm uninstall autoprefixer
```

### 2. Atualizar `vite.config.ts`

```ts
// ANTES
import tailwindcss from "tailwindcss"; // não existia explicitamente

// DEPOIS — adicionar plugin oficial
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    tailwindcss(), // ← ANTES de react()
    react(),
    // ...
  ],
  // ...
});
```

### 3. Atualizar `postcss.config.js`

```js
// ANTES
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}

// DEPOIS
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
}
```

> **Nota**: se estiver usando o plugin Vite (`@tailwindcss/vite`), o PostCSS config pode ser
> removido inteiramente — o plugin Vite cuida de tudo. Manter apenas se houver uso de PostCSS
> fora do Vite.

### 4. Atualizar `src/index.css`

Substituir as três directives pelo import, e mover a config do `tailwind.config.js`
para um bloco `@theme`:

```css
/* ANTES */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* DEPOIS */
@import "tailwindcss";

/* Configuração de tema — substitui tailwind.config.js theme.extend */
@theme {
  /* Fontes */
  --font-fraunces: "Fraunces", Georgia, serif;
  --font-sans: "DM Sans", system-ui, -apple-system, "Segoe UI", sans-serif;

  /* Cores — apontam para as CSS vars já existentes em :root */
  --color-primary: var(--color-primary);
  --color-primary-dark: var(--color-primary-dark);
  --color-accent: var(--color-accent);
  --color-background: var(--color-background);
  --color-surface: var(--color-surface);
  --color-text: var(--color-text);
  --color-muted: var(--color-muted);
  --color-border: var(--color-border);
  --color-success: #16A34A;
  --color-warning: #F59E0B;
  --color-danger: #DC2626;

  /* shadcn/ui tokens — manter como estão (via hsl()) */
  --color-primary-foreground: hsl(var(--primary-foreground));
  --color-foreground: hsl(var(--foreground));
  --color-card: hsl(var(--card));
  --color-card-foreground: hsl(var(--card-foreground));
  --color-popover: hsl(var(--popover));
  --color-popover-foreground: hsl(var(--popover-foreground));
  --color-secondary: hsl(var(--secondary));
  --color-secondary-foreground: hsl(var(--secondary-foreground));
  --color-destructive: hsl(var(--destructive));
  --color-muted-foreground: hsl(var(--muted-foreground));
  --color-input: hsl(var(--input));
  --color-ring: hsl(var(--ring));

  /* Animações */
  --animate-fade-slide-up: fadeSlideUp 0.35s ease-out both;
  --animate-loading-bar: loadingBar 1.4s ease-in-out infinite;
  --animate-shimmer: shimmer 1.8s linear infinite;

  /* Keyframes */
  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes loadingBar { /* copiar do config atual */ }
  @keyframes shimmer    { /* copiar do config atual */ }
}

/* Dark mode — configurar variante (darkMode: "class" do v3) */
@variant dark (&:is(.dark *));

/* :root, .dark, body — manter como estão */
:root { /* ... tokens existentes ... */ }
.dark { /* ... tokens dark existentes ... */ }
```

> **Atenção**: No v4, `--color-*` no `@theme` conflita com variáveis nativas da v4
> (que também usa `--color-*`). Pode ser necessário usar `--tw-color-*` ou manter
> as variáveis CSS em `:root` e apenas referenciar no `@theme`. Testar após migração.

### 5. Deletar `tailwind.config.js`

```bash
rm frontend/tailwind.config.js
```

### 6. Verificar `content` (escaneamento de classes)

Na v4, o escaneamento de arquivos é automático via detecção do projeto. O `content`
do config antigo:

```js
content: ["./index.html", "./src/**/*.{ts,tsx}", "./@/**/*.{ts,tsx}"]
```

Deve funcionar automaticamente, mas se classes sumirem, adicionar ao CSS:

```css
@source "./src";
@source "./@";
```

### 7. Compatibilidade shadcn/ui

O shadcn/ui >= 0.9.x tem suporte a Tailwind v4. Verificar versão instalada:

```bash
cat frontend/package.json | grep '"shadcn\|@shadcn'
```

Se desatualizado, atualizar componentes shadcn via CLI:

```bash
npx shadcn@latest add --all --overwrite
```

---

## Riscos e pontos de atenção

| Risco | Detalhe | Mitigação |
|-------|---------|-----------|
| `--color-*` clash | v4 usa namespace `--color-*` internamente | Prefixar vars do projeto com `--ba-color-*` ou testar sem prefixo |
| Classes removidas | `ring-offset-*`, alguns `divide-*` tiveram comportamento alterado | `grep -r "ring-offset\|divide-" src/` antes de migrar |
| `darkMode: "class"` | Em v4 requer `@variant dark` explícito no CSS | Incluir `@variant dark (&:is(.dark *))` |
| shadcn/ui versão | Componentes gerados pelo shadcn antigo usam v3 syntax | Atualizar componentes ou adicionar compat layer |
| `font-family` | v4 usa `--font-*` no `@theme` — classe `font-fraunces` precisa mapear | Confirmar que `font-fraunces` ainda funciona |
| Animações | `keyframes` e `animation` movem para `@theme` com sintaxe diferente | Copiar exato do config atual e testar |
| `@apply` nos CSS | Algumas classes do v3 não existem mais no v4 | Buscar `@apply` no projeto e verificar cada classe |

---

## Sequência de verificação após migração

```bash
cd frontend/

# 1. Build deve passar sem erros
npm run build

# 2. Lint sem erros
npm run lint

# 3. Testes
npm run test

# 4. Dev server — inspecionar visualmente:
#    - PlacesPage (cards com cover_photo)
#    - Dark mode (trocar .dark class)
#    - Animações (fade-slide-up nos cards)
#    - Botões, badges, forms
#    - shadcn/ui components (Sheet, Dialog, Select)
npm run dev
```

---

## Classes a auditar manualmente

Classes usadas no projeto que podem ter mudado no v4:

```bash
# Verificar presença no código
grep -r "ring-offset\|divide-\|bg-opacity\|text-opacity\|border-opacity\|from-\|via-\|to-" \
  frontend/src --include="*.tsx" | grep -v test | wc -l
```

- `bg-opacity-*` → no v4 usa `bg-color/opacity` (ex: `bg-black/50`)
- `ring-offset-*` → comportamento alterado
- Gradientes `from-`/`via-`/`to-` → ainda funcionam mas verificar

---

## Referências

- [Tailwind CSS v4 Migration Guide](https://tailwindcss.com/docs/upgrade-guide)
- [Tailwind CSS v4 — @theme](https://tailwindcss.com/docs/theme)
- [shadcn/ui Tailwind v4 compat](https://ui.shadcn.com/docs/tailwind-v4)
- PR #217 (dependabot bump) — **NÃO MERGEAR** sem esta migração completa
