import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { authService } from "../../services/auth.service";
import { Button } from "@/components/ui/button";

interface Props {
  onAccepted: () => void;
}

export function TermsAcceptModal({ onAccepted }: Props) {
  const { t } = useTranslation();
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");

  async function handleAccept() {
    try {
      setError("");
      setAccepting(true);
      await authService.acceptTerms();
      onAccepted();
    } catch {
      setError(t("termsModal.error"));
    } finally {
      setAccepting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-3">
          <img
            src="/bora-ali-mark.svg"
            alt="Bora Ali"
            className="h-8 w-8 select-none object-contain"
            draggable={false}
          />
          <h2 className="font-fraunces text-xl font-bold text-text">
            {t("termsModal.title")}
          </h2>
        </div>

        <p className="mb-4 text-sm text-muted leading-relaxed">
          {t("termsModal.description")}
        </p>

        <div className="mb-5 flex flex-col gap-2 rounded-xl border border-border bg-background px-4 py-3 text-sm text-muted">
          <Link
            to="/termos-de-uso"
            target="_blank"
            className="flex items-center gap-2 hover:text-text transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
            </svg>
            {t("footer.terms")}
          </Link>
          <Link
            to="/politica-de-privacidade"
            target="_blank"
            className="flex items-center gap-2 hover:text-text transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            {t("footer.privacy")}
          </Link>
        </div>

        {error && (
          <p className="mb-3 rounded-xl border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <Button className="w-full" onClick={handleAccept} disabled={accepting}>
          {t("termsModal.accept")}
        </Button>

        <p className="mt-3 text-center text-xs text-muted">
          {t("termsModal.disclaimer")}
        </p>
      </div>
    </div>
  );
}
