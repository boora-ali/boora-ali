import type { ReactElement } from "react";
import { Navigate } from "react-router-dom";
import { useAuthToken } from "../../hooks/useAuthToken";

export function PublicRoute({ children }: { children: ReactElement }) {
  const token = useAuthToken();
  return token ? <Navigate to="/places" replace /> : children;
}
