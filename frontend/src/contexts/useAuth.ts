import { useContext } from "react";
import { AuthCtx } from "./auth";

export const useAuth = () => {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth outside provider");
  return ctx;
};
