import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

type Props = {
  onSuccess: (idToken: string) => void | Promise<void>;
};

const GOOGLE_SCRIPT_ID = "google-gis-client";
const MIN_GOOGLE_BUTTON_WIDTH = 240;
const DEFAULT_GOOGLE_BUTTON_WIDTH = 320;
const MAX_GOOGLE_BUTTON_WIDTH = 400;

type GoogleCredentialHandler = (credential: string) => void;
type GoogleInitialize = NonNullable<Window["google"]>["accounts"]["id"]["initialize"];

let activeGoogleCredentialHandler: GoogleCredentialHandler | null = null;
let initializedGoogleClientId = "";
let initializedGoogleInitialize: GoogleInitialize | null = null;

export function GoogleSignInButton({ onSuccess }: Props) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const onSuccessRef = useRef(onSuccess);
  const clientId = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID;
  const [loading, setLoading] = useState(!!clientId);
  const [error, setError] = useState("");

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  useEffect(() => {
    if (!clientId) {
      return;
    }

    let cancelled = false;
    let credentialHandler: GoogleCredentialHandler | null = null;

    const initializeGoogle = () => {
      if (cancelled) return;

      const google = window.google;
      if (!google?.accounts?.id || !containerRef.current) {
        setLoading(false);
        setError(t("auth.login.googleError"));
        return;
      }

      containerRef.current.innerHTML = "";
      credentialHandler = (credential) => {
        void onSuccessRef.current(credential);
      };
      activeGoogleCredentialHandler = credentialHandler;

      if (
        initializedGoogleClientId !== clientId ||
        initializedGoogleInitialize !== google.accounts.id.initialize
      ) {
        google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response.credential) {
              activeGoogleCredentialHandler?.(response.credential);
            }
          },
        });
        initializedGoogleClientId = clientId;
        initializedGoogleInitialize = google.accounts.id.initialize;
      }

      const buttonWidth = Math.min(
        Math.max(containerRef.current.clientWidth || DEFAULT_GOOGLE_BUTTON_WIDTH, MIN_GOOGLE_BUTTON_WIDTH),
        MAX_GOOGLE_BUTTON_WIDTH
      );
      google.accounts.id.renderButton(containerRef.current, {
        theme: "filled_blue",
        size: "large",
        shape: "pill",
        text: "continue_with",
        logo_alignment: "left",
        width: buttonWidth,
      });
      setLoading(false);
    };

    if (window.google?.accounts?.id) {
      initializeGoogle();
      return () => {
        cancelled = true;
      };
    }

    let script = document.getElementById(GOOGLE_SCRIPT_ID) as HTMLScriptElement | null;
    const handleLoad = () => initializeGoogle();
    const handleError = () => {
      if (cancelled) return;
      setLoading(false);
      setError(t("auth.login.googleError"));
    };

    if (!script) {
      script = document.createElement("script");
      script.id = GOOGLE_SCRIPT_ID;
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }

    script.addEventListener("load", handleLoad);
    script.addEventListener("error", handleError);

    return () => {
      cancelled = true;
      if (credentialHandler && activeGoogleCredentialHandler === credentialHandler) {
        activeGoogleCredentialHandler = null;
      }
      script?.removeEventListener("load", handleLoad);
      script?.removeEventListener("error", handleError);
    };
  }, [clientId, t]);

  if (!clientId) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface/70 p-3 shadow-sm">
      <p className="text-sm font-medium text-text">{t("auth.login.google")}</p>
      {loading && <p className="text-sm text-text/75">{t("auth.login.googleLoading")}</p>}
      <div ref={containerRef} />
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
