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
import { Button } from "@/components/ui/button";

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
          <div className="min-h-[100dvh] bg-background px-5 py-6">
            <div className="mx-auto max-w-5xl space-y-4">
              <div className="h-12 w-48 rounded-full bg-border/50 animate-pulse" />
              <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="space-y-4 rounded-3xl border border-border bg-surface p-4 shadow-sm">
                  <div className="aspect-[4/3] rounded-2xl bg-border/30 animate-pulse" />
                  <div className="space-y-2.5">
                    <div className="h-2.5 w-16 rounded-full bg-border/50 animate-pulse" />
                    <div className="h-9 w-3/5 rounded-lg bg-border/50 animate-pulse" />
                    <div className="h-2.5 w-4/5 rounded-full bg-border/40 animate-pulse" />
                  </div>
                </div>
                <div className="space-y-4 rounded-3xl border border-border bg-surface p-5 shadow-sm">
                  <div className="h-2.5 w-24 rounded-full bg-border/50 animate-pulse" />
                  <div className="h-24 rounded-2xl bg-border/30 animate-pulse" />
                  <div className="h-10 rounded-2xl bg-border/30 animate-pulse" />
                  <div className="h-10 rounded-2xl bg-border/30 animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        )}
        error={!hasToken || isError ? " " : ""}
        errorNode={<NotFoundPage />}
      >
        {data ? (
          <div className="min-h-[100dvh] bg-background px-5 py-6">
            <div className="mx-auto max-w-5xl space-y-8">
              <header className="space-y-3">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-muted/70">
                  {t("share.snapshot_label")}
                </p>
                <div className="flex flex-wrap items-end gap-4">
                  <span className="flex h-16 w-16 items-center justify-center rounded-3xl border border-border bg-surface text-3xl shadow-sm">
                    <MapPin className="h-7 w-7 text-primary" />
                  </span>
                  <div>
                    <h1 className="font-fraunces text-3xl font-bold text-text sm:text-4xl">
                      {data.name}
                    </h1>
                    <p className="text-sm text-muted">
                      {data.category}
                      {" · "}
                      {data.status}
                    </p>
                  </div>
                </div>
              </header>

              <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <article className="overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
                  <div className="relative aspect-[4/3] bg-border/20">
                    {data.cover_photo_url ? (
                      <ImageWithSpinner
                        src={data.cover_photo_url}
                        alt={data.name}
                        wrapperClassName="absolute inset-0"
                        className="h-full w-full object-cover"
                        spinnerClassName="bg-black/10"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-border/20 to-border/50">
                        <MapPin className="h-14 w-14 text-muted/30" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-3 p-4 sm:p-5">
                    {data.address && <p className="text-sm text-muted">{data.address}</p>}
                    <p className="text-sm leading-7 text-text/80">
                      {data.category}
                    </p>
                  </div>
                </article>

                <aside className="space-y-4 rounded-3xl border border-border bg-surface p-5 shadow-sm">
                  <div className="space-y-2">
                    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-muted/70">
                      {t("share.snapshot_label")}
                    </p>
                    <p className="text-sm text-muted">
                      {data.address ? t("share.address_saved") : t("share.no_address")}
                    </p>
                  </div>

                  {(mapsHref || data.instagram_url) && (
                    <div className="space-y-2">
                      {mapsHref && (
                        <a
                          href={mapsHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-text transition hover:bg-surface"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface">
                            <MapPin className="h-4 w-4 text-primary" />
                          </span>
                          {t("share.view_maps")}
                        </a>
                      )}
                      {sanitizeUrl(data.instagram_url) && (
                        <a
                          href={sanitizeUrl(data.instagram_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-text transition hover:bg-surface"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface">
                            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-primary stroke-[1.8]">
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

                  <div className="rounded-2xl border border-border/70 bg-background px-4 py-3">
                    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-muted/70">
                      {t("share.location_hint")}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {data.latitude !== null && data.longitude !== null
                        ? `${data.latitude}, ${data.longitude}`
                        : t("share.no_coordinates")}
                    </p>
                  </div>
                </aside>
              </div>
            </div>
          </div>
        ) : null}
      </PageState>

      <div className="fixed bottom-0 left-0 right-0 border-t border-border/50 bg-background/90 px-5 pb-7 pt-4 backdrop-blur-md">
        <div className="mx-auto max-w-5xl">
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
              <Button
                type="button"
                onClick={handleImport}
                disabled={importing || isLoading || isError}
                className="h-12 flex-1 rounded-2xl text-sm font-medium tracking-wide"
              >
                {importing ? t("share.importing") : t("share.import_button")}
              </Button>
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
