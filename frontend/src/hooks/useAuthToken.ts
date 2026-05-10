import { useEffect, useState } from "react";
import { ACCESS_KEY } from "../utils/constants";
import { AUTH_STATE_CHANGED_EVENT } from "../utils/client-state";

export function useAuthToken() {
  const [token, setToken] = useState(() => localStorage.getItem(ACCESS_KEY));

  useEffect(() => {
    function syncToken() {
      setToken(localStorage.getItem(ACCESS_KEY));
    }

    window.addEventListener(AUTH_STATE_CHANGED_EVENT, syncToken);
    window.addEventListener("storage", syncToken);
    return () => {
      window.removeEventListener(AUTH_STATE_CHANGED_EVENT, syncToken);
      window.removeEventListener("storage", syncToken);
    };
  }, []);

  return token;
}
