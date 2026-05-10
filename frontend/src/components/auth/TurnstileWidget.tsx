import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

declare global {
  interface Window {
    turnstile: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

const SCRIPT_ID = "cf-turnstile-script";

type Props = {
  onToken: (token: string) => void;
  onExpire?: () => void;
  onReady?: () => void;
  onError?: () => void;
  resetKey?: number;
};

export function TurnstileWidget({ onToken, onExpire, onReady, onError, resetKey }: Props) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    siteKey ? "loading" : "ready",
  );

  useEffect(() => {
    if (!siteKey) return;

    const render = () => {
      if (!containerRef.current || !window.turnstile) {
        setStatus("error");
        onError?.();
        return;
      }
      if (widgetIdRef.current) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token: string) => {
          setStatus("ready");
          onReady?.();
          onToken(token);
        },
        "expired-callback": () => {
          onExpire?.();
        },
        "error-callback": () => {
          setStatus("error");
          onError?.();
        },
        theme: "light",
      });
      setStatus("ready");
      onReady?.();
    };

    if (window.turnstile) {
      render();
    } else {
      let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement("script");
        script.id = SCRIPT_ID;
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        document.body.appendChild(script);
      }
      const handleError = () => {
        setStatus("error");
        onError?.();
      };
      script.addEventListener("load", render);
      script.addEventListener("error", handleError);
      return () => {
        script?.removeEventListener("load", render);
        script?.removeEventListener("error", handleError);
      };
    }

    return () => {
      if (widgetIdRef.current) {
        window.turnstile?.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, onToken, onExpire, onReady, onError, resetKey]);

  if (!siteKey) return null;

  return (
    <div className="min-h-[70px] rounded-xl border border-border bg-surface/60 p-2">
      {status === "loading" && (
        <p className="px-2 py-4 text-sm text-text/70">{t("auth.turnstile.loading")}</p>
      )}
      {status === "error" && (
        <p className="px-2 py-4 text-sm text-danger">{t("auth.turnstile.error")}</p>
      )}
      <div ref={containerRef} className={status === "error" ? "hidden" : ""} />
    </div>
  );
}
