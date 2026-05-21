import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet-async";
import { authService } from "../services/auth.service";
import { getApiErrorState } from "../services/api-errors";
import { Button } from "@/components/ui/button";

type Status = "loading" | "success" | "error" | "no-token";

export default function VerifyEmailPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [status, setStatus] = useState<Status>(token ? "loading" : "no-token");
  const [errorMessage, setErrorMessage] = useState("");
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const called = useRef(false);

  useEffect(() => {
    if (!token || called.current) return;
    called.current = true;

    authService
      .verifyEmail(token)
      .then(() => setStatus("success"))
      .catch((err) => {
        setErrorMessage(getApiErrorState(err, t("auth.verifyEmail.errorGeneric")).message);
        setStatus("error");
      });
  }, [token, t]);

  const handleResend = async () => {
    setResending(true);
    try {
      await authService.resendVerification();
      setResent(true);
    } catch {
      // resend requires auth; if not authenticated, just show login link
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <Helmet>
        <title>Bora Ali — Verificação de email</title>
      </Helmet>

      <div className="max-w-sm w-full text-center space-y-6">
        {status === "loading" && (
          <>
            <div className="flex justify-center">
              <svg className="h-10 w-10 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <p className="text-muted-foreground">{t("auth.verifyEmail.loading")}</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="text-5xl">✉️</div>
            <h1 className="font-fraunces text-2xl font-bold text-foreground">
              {t("auth.verifyEmail.successTitle")}
            </h1>
            <p className="text-muted-foreground">{t("auth.verifyEmail.successSubtitle")}</p>
            <Button asChild className="w-full">
              <Link to="/login">{t("auth.verifyEmail.goToLogin")}</Link>
            </Button>
          </>
        )}

        {(status === "error" || status === "no-token") && (
          <>
            <div className="text-5xl">⚠️</div>
            <h1 className="font-fraunces text-2xl font-bold text-foreground">
              {t("auth.verifyEmail.errorTitle")}
            </h1>
            <p className="text-muted-foreground">
              {status === "no-token" ? t("auth.verifyEmail.noToken") : errorMessage}
            </p>
            {resent ? (
              <p className="text-sm text-green-600">{t("auth.verifyEmail.resentSuccess")}</p>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={handleResend}
                disabled={resending}
              >
                {t("auth.verifyEmail.resend")}
              </Button>
            )}
            <Button asChild variant="ghost" className="w-full">
              <Link to="/login">{t("auth.verifyEmail.goToLogin")}</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
