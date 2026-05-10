import type { ReactElement } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/useAuth";
import { LoadingState } from "../ui/LoadingState";

export function ProtectedRoute({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen p-4">
        <LoadingState />
      </div>
    );
  }

  return user ? children : <Navigate to="/login" replace />;
}
