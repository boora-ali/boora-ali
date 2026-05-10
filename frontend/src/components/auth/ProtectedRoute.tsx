import type { ReactElement } from "react";
import { Navigate } from "react-router-dom";
import { useAuthToken } from "../../hooks/useAuthToken";

export function ProtectedRoute({ children }: { children: ReactElement }) {
  const token = useAuthToken();
  return token ? children : <Navigate to="/login" replace />;
}
