import { useCallback, useEffect, useState, type ReactNode } from "react";
import { authService } from "../services/auth.service";
import { ACCESS_KEY } from "../utils/constants";
import type { User } from "../types/user";
import { AuthCtx } from "./auth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(() =>
    Boolean(localStorage.getItem(ACCESS_KEY)),
  );

  useEffect(() => {
    if (!localStorage.getItem(ACCESS_KEY)) return;

    authService
      .me()
      .then(setUser)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(
    async (u: string, p: string, cfTurnstileResponse?: string) => {
      await authService.login(u, p, cfTurnstileResponse);
      setUser(await authService.me());
    },
    [],
  );

  const googleLogin = useCallback(async (idToken: string) => {
    await authService.googleLogin(idToken);
    setUser(await authService.me());
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const nextUser = await authService.me();
    setUser(nextUser);
    return nextUser;
  }, []);

  return (
    <AuthCtx.Provider
      value={{
        user,
        loading,
        login,
        googleLogin,
        logout,
        refreshUser,
        setUser,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}
