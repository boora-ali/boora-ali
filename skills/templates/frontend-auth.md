# Frontend: Auth

## Contexto de UI

- auth usa base `shadcn/ui` via `@/components/ui/*`
- componentes de auth ficam em `frontend/src/components/auth/`
- ao validar regressão, conferir `frontend/@/components/ui/` antes de concluir que um componente base não existe

## Constantes — utils/constants.ts

```typescript
export const ACCESS_KEY = "boraali_access";
export const REFRESH_KEY = "boraali_refresh";
export const SESSION_INVALIDATED_KEY = "boraali_session_invalidated";
```

## api.ts — Axios com interceptor 401

```typescript
import axios from "axios";
import { ACCESS_KEY, REFRESH_KEY, SESSION_INVALIDATED_KEY } from "../utils/constants";

const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL ?? "" });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(ACCESS_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => {
    // salvar tokens rotacionados
    if (res.data?.access) localStorage.setItem(ACCESS_KEY, res.data.access);
    if (res.data?.refresh) localStorage.setItem(REFRESH_KEY, res.data.refresh);
    return res;
  },
  async (error) => {
    const original = error.config;
    const isAuthEndpoint =
      original.url?.endsWith("/auth/login/") ||
      original.url?.endsWith("/auth/register/");

    if (error.response?.status === 401 && !original._retry && !isAuthEndpoint) {
      original._retry = true;
      const code = error.response.data?.code;
      if (code === "session_expired" || code === "session_invalidated") {
        localStorage.setItem(SESSION_INVALIDATED_KEY, "true");
        localStorage.removeItem(ACCESS_KEY);
        localStorage.removeItem(REFRESH_KEY);
        window.location.href = "/login";
        return Promise.reject(error);
      }
      try {
        const refresh = localStorage.getItem(REFRESH_KEY);
        const { data } = await api.post("/api/auth/refresh/", { refresh });
        localStorage.setItem(ACCESS_KEY, data.access);
        if (data.refresh) localStorage.setItem(REFRESH_KEY, data.refresh);
        original.headers.Authorization = `Bearer ${data.access}`;
        return api(original);
      } catch {
        localStorage.removeItem(ACCESS_KEY);
        localStorage.removeItem(REFRESH_KEY);
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
```

## AuthContext — contexts/AuthContext.tsx

```typescript
import { createContext, useContext, useEffect, useState } from "react";
import { authService } from "../services/auth.service";

const AuthContext = createContext<{ user: User | null; loading: boolean }>({
  user: null, loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("boraali_access");
    if (!token) { setLoading(false); return; }
    authService.me().then(setUser).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
```

## Rotas protegidas — App.tsx

```typescript
function ProtectedRoute() {
  const token = localStorage.getItem("boraali_access");
  return token ? <Outlet /> : <Navigate to="/login" replace />;
}

function PublicRoute() {
  const token = localStorage.getItem("boraali_access");
  return token ? <Navigate to="/places" replace /> : <Outlet />;
}
```

## LoginPage — banner de sessão + validação de campos

```typescript
const invalidated = localStorage.getItem("boraali_session_invalidated");

// Limpar ao mostrar banner:
localStorage.removeItem("boraali_session_invalidated");

// Validação antes de chamar API:
if (!username.trim() || !password.trim()) {
  setError(t("auth.login.emptyFields"));
  return;
}
```

## RegisterPage — estado atual

- O formulário envia `username`, `email`, `password`, `confirm_password` e um campo escondido `website`.
- O campo `website` é o honeypot do cadastro e não deve ser exibido ao usuário.
- O submit continua no mesmo fluxo: `authService.register()` → `nav("/login")` quando aceita.
- `getApiErrorState()` já traduz o erro genérico de validação e o backend não expõe o honeypot na resposta.

## Google Sign-In Button

```tsx
// Carrega script GIS e renderiza botão do Google
// Envia id_token para POST /api/auth/google/
// Requer window.google.accounts.id.initialize + renderButton
```
