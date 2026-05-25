import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet-async";
import { MapPin, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { shareService, type ShareDetail } from "../services/share.service";
import { useAuth } from "../contexts/useAuth";
import { getMapsHref, sanitizeUrl } from "../utils/url";
import NotFoundPage from "./NotFoundPage";
import { getApiErrorState } from "../services/api-errors";
import { PageState } from "../components/ui/PageState";
import { ImageWithSpinner } from "../components/ui/ImageWithSpinner";

export default function SharePage() {
  const { token } = useParams<{ token: string }>();
  const { t } = useTranslation();
  const nav = useNavigate();
  const { user } = useAuth();

  const [data, setData] = useState<ShareDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [importing, setImporting] = useState(false);
  const hasToken = Boolean(token);

  useEffect(() => {
    if (!token) {
      return;
    }
    let cancelled = false;
    shareService
      .getShare(token)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsError(true);
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const title = data ? `${data.name} — Bora Ali` : "Bora Ali";
  const mapsHref = data
    ? getMapsHref({
        mapsUrl: data.maps_url,
        latitude: data.latitude,
        longitude: data.longitude,
      })
    : "";

  async function handleImport() {
    if (!token) return;
    setImporting(true);
    try {
      const result = await shareService.importShare(token);
      nav(`/places/${result.public_id}`, { state: { refreshAfterImport: true } });
    } catch (err) {
      const apiError = getApiErrorState(err, t("share.import_error"));
      toast.error(apiError.message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <PageState
        loading={hasToken && isLoading}
        loadingNode={(
          <div className="min-h-[100dvh] bg-background">
            <div className="relative h-[58dvh]">
              <div className="absolute inset-0 animate-pulse bg-border/40" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/5 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-background via-background/70 to-transparent" />
            </div>
            <div className="relative -mt-14 px-6 pb-36">
              <div className="space-y-4 pt-2">
                <div className="h-2.5 w-14 rounded-full bg-border/60 animate-pulse" />
                <div className="h-9 w-4/5 rounded-lg bg-border/50 animate-pulse" />
                <div className="h-2.5 w-1/2 rounded-full bg-border/40 animate-pulse" />
              </div>
            </div>
          </div>
        )}
        error={!hasToken || isError ? " " : ""}
        errorNode={<NotFoundPage />}
      >
        {data ? (
          <div className="min-h-[100dvh] bg-background">
            {/* Hero — foto que dissolve no creme */}
            <div className="relative h-[58dvh]">
              {data.cover_photo_url ? (
                <ImageWithSpinner
                  src={data.cover_photo_url}
                  alt={data.name}
                  wrapperClassName="absolute inset-0 overflow-hidden bg-gradient-to-br from-border/20 to-border/50"
                  className="h-full w-full object-cover"
                  spinnerClassName="bg-black/10"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-border/20 to-border/50 flex items-center justify-center">
                  <MapPin className="h-14 w-14 text-muted opacity-15" />
                </div>
              )}

              {/* Fade lateral escuro suave */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/5 to-transparent" />
              {/* Fade forte na base para o creme */}
              <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-background via-background/70 to-transparent" />
            </div>

            {/* Conteúdo editorial */}
            <div className="relative -mt-14 px-6 pb-36">
              <div className="animate-fade-slide-up">
                {/* Categoria — pequena, espaçada */}
                <p className="text-[0.6rem] font-semibold uppercase tracking-[0.22em] text-muted/80">
                  {data.category}
                </p>

                {/* Nome — editorial, dominante */}
                <h1 className="mt-1.5 font-fraunces text-[2.1rem] font-bold leading-[1.05] text-text">
                  {data.name}
                </h1>

                {/* Endereço */}
                {data.address && (
                  <p className="mt-3 flex items-start gap-1.5 text-sm text-muted leading-snug">
                    <MapPin className="mt-[2px] h-3.5 w-3.5 shrink-0 text-primary/50" />
                    {data.address}
                  </p>
                )}

                {/* Divisor */}
                <div className="mt-5 border-t border-border/50" />

                {/* Links externos — texto limpo com ícone pequeno */}
                {(mapsHref || data.instagram_url) && (
                  <div className="mt-4 flex flex-col gap-3">
                    {mapsHref && (
                      <a
                        href={mapsHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center gap-3 text-sm text-text/60 transition-colors hover:text-text"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/70 bg-surface shadow-sm transition group-hover:border-border">
                          <MapPin className="h-3.5 w-3.5 text-primary/70" />
                        </span>
                        {t("share.view_maps")}
                      </a>
                    )}
                    {sanitizeUrl(data.instagram_url) && (
                      <a
                        href={sanitizeUrl(data.instagram_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center gap-3 text-sm text-text/60 transition-colors hover:text-text"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/70 bg-surface shadow-sm transition group-hover:border-border">
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current stroke-[1.8]">
                            <rect x="3.75" y="3.75" width="16.5" height="16.5" rx="4.5" />
                            <circle cx="12" cy="12" r="3.5" />
                            <circle cx="17.5" cy="6.5" r="0.75" fill="currentColor" stroke="none" />
                          </svg>
                        </span>
                        {t("share.view_instagram")}
                      </a>
                    )}
                  </div>
                )}

                {/* Assinatura */}
                <p className="mt-8 text-[0.65rem] tracking-widest text-muted/40 uppercase">
                  Bora Ali
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </PageState>

      {/* CTA fixo — painel com glass */}
      <div className="fixed bottom-0 left-0 right-0 px-5 pb-7 pt-4 bg-background/85 backdrop-blur-md border-t border-border/40">
        <div className="max-w-lg mx-auto space-y-2.5">
          {user ? (
            <div className="flex gap-2.5">
              <button
                type="button"
                aria-label={t("common.back")}
                onClick={() => nav(-1)}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border/60 bg-surface/70 text-muted transition hover:bg-surface active:scale-[0.97]"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={importing || isLoading || isError}
                className="flex h-12 flex-1 items-center justify-center rounded-2xl bg-primary text-sm font-medium tracking-wide text-white shadow-sm transition hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50"
              >
                {importing ? t("share.importing") : t("share.import_button")}
              </button>
            </div>
          ) : (
            <Link to={`/login?next=/share/${token}`} className="block">
              <button
                type="button"
                className="flex h-12 w-full items-center justify-center rounded-2xl bg-primary text-sm font-medium tracking-wide text-white shadow-sm transition hover:bg-primary/90 active:scale-[0.98]"
              >
                {t("share.login_to_import")}
              </button>
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
