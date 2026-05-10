# Frontend: Testes

## Unit (Vitest)

```bash
cd frontend
npm run test         # once
npm run test:watch   # watch
```

### vite.config.ts

```typescript
export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
  },
});
```

### src/test/setup.ts

```typescript
import "@testing-library/jest-dom";
```

### O que testar

```
LoginPage renderiza campos + submit
ProtectedRoute redireciona sem token
PublicRoute redireciona com token
PlaceCard renderiza nome, categoria, status
PlaceForm exige campo Nome
RatingInput não aceita < 0 ou > 10
api.ts adiciona Authorization header
api.ts salva tokens rotacionados da resposta
```

---

## E2E (Playwright)

```bash
npm run dev -- --port 8181   # dev server na porta correta
npx playwright test          # todos
npx playwright test auth-negative crud-negative responsive  # só mocks
```

### playwright.config.ts

```typescript
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: "http://localhost:8181" },
  webServer: {
    command: "npm run dev -- --port 8181",
    url: "http://localhost:8181",
    reuseExistingServer: true,
  },
});
```

### Estrutura

```
frontend/e2e/
  auth/        auth-negative.spec.ts
  crud/        crud-happy.spec.ts  crud-negative.spec.ts
  login/       login.spec.ts
  responsive.spec.ts
  support/
    auth.ts              # authenticateAsUser (live backend)
    api-seed.ts          # seedPlace, seedLoggedOutSession
    mock-auth.ts         # mockAuthenticatedSession (page.route + localStorage)
    error-fixtures.ts    # mockLoginUnauthorized, mockPlacePostBadRequest, etc.
    scenario-data.ts     # placeSeed, visitSeed, visitItemSeed
    google-gis-stub.ts   # stub do Google Identity Services
  fixtures/
    place-detail.json    # inclui public_id
    visit-detail.json    # inclui public_id
```

### Regras

- Mocks via `page.route` — nunca depender do backend para testes negativos
- Locators: `getByRole`, `getByLabel`, `getByText` — nunca `data-testid` ou `href`
- BDD: comentários `// Given / When / Then` em cada teste
- `page.route` para URLs com query params: usar regex `/\/api\/places\/(?:\?.*)?$/` em vez de glob

### mock-auth.ts — sessão autenticada sem backend

```typescript
export async function mockAuthenticatedSession(page: Page, overrides = {}) {
  const user = { id: 1, username: "tester", email: "tester@example.com",
                 is_google_account: false, ...overrides };
  await page.addInitScript((u) => {
    localStorage.setItem("boraali_access", "test-access-token");
    localStorage.setItem("boraali_refresh", "test-refresh-token");
  }, user);
  await page.route("**/api/auth/me/", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(user) })
  );
}
```

### Heurísticas de QA usadas

```
Boundary Value Analysis  → ratings 0/10/-1/11
State Transition         → session expiry flow
Error Guessing           → campos obrigatórios, cancel em modal, URL inválida
Equivalence Partitioning → credenciais válidas vs inválidas
```

### Cenários negativos implementados

```
auth-negative:
  1. Login 401 → "Credenciais inválidas" visível
  2. Login sem preencher campos → "Preencha todos os campos"
  3. Acesso sem token → redirect /login
  4. Sessão encerrada → banner amber em /login
  5. Conta Google → sem formulário de troca de senha

crud-negative:
  6. Criar lugar sem Nome → erro de campo obrigatório
  7. URL Instagram inválida → erro inline 400
  8. Server error 500 ao salvar lugar → mensagem genérica
  9. Cancelar exclusão de lugar → lugar permanece, sem DELETE
 10. Rating visita > 10 → erro "menor ou igual a 10"
 11. Rating visita < 0 → erro "maior ou igual a 0"
 12. Fechar modal consumível (ESC) → item não aparece
 13. Salvar consumível sem nome → "Nome do item é obrigatório"
 14. Falha de rede em /places → estado de erro visível
```
