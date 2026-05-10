import { createContext } from "react";
import type { User } from "../types/user";

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string, cfTurnstileResponse?: string) => Promise<void>;
  googleLogin: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<User>;
  setUser: (user: User) => void;
}

export const AuthCtx = createContext<AuthContextValue | null>(null);
