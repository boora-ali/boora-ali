import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet-async";
import { authService } from "../services/auth.service";
import { getApiErrorState } from "../services/api-errors";
import { Button } from "@/components/ui/button";
import { StatusPanel } from "../components/ui/StatusPanel";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";

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
        <title>Boora Ali — Verificação de email</title>
      </Helmet>
      <StatusPanel
        icon={
          status === "loading" ? (
            <LoadingSpinner className="h-10 w-10 text-primary" />
          ) : status === "success" ? (
            <div className="text-5xl">✉️</div>
          ) : (
            <div className="text-5xl">⚠️</div>
          )
        }
        title={
          status === "success"
            ? t("auth.verifyEmail.successTitle")
            : t("auth.verifyEmail.errorTitle")
        }
        description={
          status === "loading"
            ? t("auth.verifyEmail.loading")
            : status === "success"
              ? t("auth.verifyEmail.successSubtitle")
              : status === "no-token"
                ? t("auth.verifyEmail.noToken")
                : errorMessage
        }
        actions={
          status === "loading" ? null : status === "success" ? (
            <Button asChild className="w-full">
              <Link to="/login">{t("auth.verifyEmail.goToLogin")}</Link>
            </Button>
          ) : (
            <>
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
          )
        }
      />
    </div>
  );
}
