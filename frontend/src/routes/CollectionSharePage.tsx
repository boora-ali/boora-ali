import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet-async";
import { FolderOpen, MapPin } from "lucide-react";
import { toast } from "sonner";
import { shareService, type CollectionShareDetail } from "../services/share.service";
import { ImageWithSpinner } from "../components/ui/ImageWithSpinner";
import { PageState } from "../components/ui/PageState";
import NotFoundPage from "./NotFoundPage";
import { getMapsHref, sanitizeUrl } from "../utils/url";
import { useAuth } from "../contexts/useAuth";
import { getApiErrorState } from "../services/api-errors";
import { Button } from "@/components/ui/button";

const SHARE_POLL_INTERVAL_MS = 1000;
const SHARE_POLL_TIMEOUT_MS = 15000;

export default function CollectionSharePage() {
  const { token } = useParams<{ token: string }>();
  const { t } = useTranslation();
  const nav = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<CollectionShareDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const hasToken = Boolean(token);
  const [loading, setLoading] = useState(hasToken);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;
    let attempts = 0;

    const load = async () => {
      attempts += 1;
      try {
        const result = await shareService.getCollectionShare(token);
        if (cancelled) return;
        setData(result);
        setLoading(false);
        window.clearInterval(interval);
      } catch {
        if (cancelled) return;
        if (attempts * SHARE_POLL_INTERVAL_MS >= SHARE_POLL_TIMEOUT_MS) {
          setNotFound(true);
          setLoading(false);
          window.clearInterval(interval);
        }
      }
    };

    void load();
    const interval = window.setInterval(() => {
      void load();
    }, SHARE_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [token]);

  const title = data ? `${data.name} — Bora Ali` : "Bora Ali";

  const places = useMemo(() => data?.places ?? [], [data]);

  async function handleSaveCollection() {
    if (!token) return;
    setSaving(true);
    try {
      const result = await shareService.saveCollectionShare(token);
      nav(`/collections/${result.public_id}`);
    } catch (err) {
      const apiError = getApiErrorState(err, t("collections.save_error"));
      toast.error(apiError.message);
    } finally {
      setSaving(false);
    }
  }

  if (!hasToken) {
    return <NotFoundPage />;
  }

  if (notFound) {
    return <NotFoundPage />;
  }

  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <PageState
        loading={loading && !data}
        loadingNode={(
          <div className="min-h-[100dvh] bg-background px-5 py-6">
            <div className="mx-auto max-w-5xl space-y-4">
              <div className="h-12 w-44 rounded-full bg-border/50 animate-pulse" />
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx} className="h-80 rounded-3xl border border-border bg-surface/60 animate-pulse" />
                ))}
              </div>
            </div>
          </div>
        )}
      >
        {data ? (
          <div className="min-h-[100dvh] bg-background px-5 py-6">
            <div className="mx-auto max-w-5xl space-y-8">
              <header className="space-y-3">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-muted/70">
                  {t("collections.snapshot_label")}
                </p>
                <div className="flex flex-wrap items-end gap-4">
                  <span className="flex h-16 w-16 items-center justify-center rounded-3xl border border-border bg-surface text-3xl shadow-sm">
                    {data.emoji}
                  </span>
                  <div>
                    <h1 className="font-fraunces text-3xl font-bold text-text">{data.name}</h1>
                    <p className="text-sm text-muted">
                      {data.description || t("collections.empty_description")}
                      {" · "}
                      {data.place_count} {t("collections.places_count")}
                    </p>
                  </div>
                </div>
              </header>

              {places.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-3xl border border-border bg-surface/70 px-6 py-16 text-center">
                  <FolderOpen className="h-8 w-8 text-muted" />
                  <p className="font-fraunces text-lg font-semibold text-text">{t("collections.empty_places")}</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {places.map((place) => {
                    const mapsHref = getMapsHref({
                      mapsUrl: place.maps_url,
                      latitude: place.latitude !== null && place.latitude !== undefined
                        ? Number(place.latitude)
                        : null,
                      longitude: place.longitude !== null && place.longitude !== undefined
                        ? Number(place.longitude)
                        : null,
                    });
                    const instagramHref = sanitizeUrl(place.instagram_url);

                    return (
                      <article
                        key={place.source_public_id}
                        className="overflow-hidden rounded-3xl border border-border bg-surface shadow-sm"
                      >
                        <div className="relative aspect-[4/3] bg-border/20">
                          {place.cover_photo_url ? (
                            <ImageWithSpinner
                              src={place.cover_photo_url}
                              alt={place.name}
                              wrapperClassName="absolute inset-0"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <MapPin className="h-10 w-10 text-muted/30" />
                            </div>
                          )}
                        </div>
                        <div className="space-y-2.5 p-4">
                          <div className="space-y-1">
                            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-muted/70">
                              {place.category}
                            </p>
                            <h2 className="font-fraunces text-lg font-semibold text-text">{place.name}</h2>
                            {place.address && <p className="text-sm text-muted">{place.address}</p>}
                          </div>

                          {place.notes && (
                            <p className="text-sm text-text/80 line-clamp-3">{place.notes}</p>
                          )}

                          <div className="flex flex-wrap gap-2 text-sm">
                            {mapsHref && (
                              <a
                                href={mapsHref}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="rounded-full border border-border px-3 py-1.5 text-muted transition hover:text-text"
                              >
                                {t("share.view_maps")}
                              </a>
                            )}
                            {instagramHref && (
                              <a
                                href={instagramHref}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="rounded-full border border-border px-3 py-1.5 text-muted transition hover:text-text"
                              >
                                {t("share.view_instagram")}
                              </a>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </PageState>

      {!notFound && data && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-border/50 bg-background/90 px-5 pb-7 pt-4 backdrop-blur-md">
          <div className="mx-auto max-w-5xl">
            {authLoading ? (
              <div className="h-12 rounded-2xl border border-border/60 bg-surface/70 animate-pulse" />
            ) : user ? (
              <Button
                type="button"
                className="h-12 w-full rounded-2xl text-sm font-medium tracking-wide"
                onClick={handleSaveCollection}
                disabled={saving}
              >
                {saving ? t("collections.saving") : t("collections.save_button")}
              </Button>
            ) : (
              <Link to={`/login?next=/share/collections/${token}`} className="block">
                <button
                  type="button"
                  className="flex h-12 w-full items-center justify-center rounded-2xl bg-primary text-sm font-medium tracking-wide text-white shadow-sm transition hover:bg-primary/90 active:scale-[0.98]"
                >
                  {t("collections.login_to_save")}
                </button>
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}
