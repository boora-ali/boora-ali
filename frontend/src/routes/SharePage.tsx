import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet-async";
import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { shareService, type ShareDetail } from "../services/share.service";
import { useAuth } from "../contexts/useAuth";
import NotFoundPage from "./NotFoundPage";

export default function SharePage() {
  const { token } = useParams<{ token: string }>();
  const { t } = useTranslation();
  const nav = useNavigate();
  const { user } = useAuth();

  const [data, setData] = useState<ShareDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
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

  if (isError) return <NotFoundPage />;

  const title = data ? `${data.name} — Bora Ali` : "Bora Ali";

  async function handleImport() {
    if (!token) return;
    setImporting(true);
    setImportError(null);
    try {
      const result = await shareService.importShare(token);
      nav(`/places/${result.public_id}`);
    } catch {
      setImportError(t("share.import_error"));
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

      <div className="max-w-lg mx-auto pb-28">
        {/* Cover photo */}
        <div className="w-full aspect-[4/3] bg-border/40 overflow-hidden">
          {isLoading ? (
            <div className="w-full h-full bg-border/40 animate-pulse" />
          ) : data?.cover_photo_url ? (
            <img
              src={data.cover_photo_url}
              alt={data.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-5xl opacity-40 bg-gradient-to-br from-background to-border/60">
              🍽
            </div>
          )}
        </div>

        <div className="p-4 space-y-3">
          {isLoading ? (
            <>
              <div className="h-5 w-24 rounded-full bg-border/40 animate-pulse" />
              <div className="h-8 w-3/4 bg-border/40 animate-pulse rounded" />
              <div className="h-4 w-1/2 bg-border/40 animate-pulse rounded" />
              <div className="h-10 w-full mt-4 bg-border/40 animate-pulse rounded" />
            </>
          ) : data ? (
            <>
              <Badge variant="secondary">{data.category}</Badge>
              <h1 className="font-fraunces text-2xl font-bold leading-tight text-text">
                {data.name}
              </h1>
              {data.address && (
                <p className="text-sm text-muted">{data.address}</p>
              )}

              {(data.maps_url || data.instagram_url) && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {data.maps_url && (
                    <a
                      href={data.maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 border border-border rounded-full px-3 py-1.5 text-sm font-medium text-text hover:bg-surface transition"
                    >
                      <MapPin className="w-4 h-4" />
                      {t("share.view_maps")}
                    </a>
                  )}
                  {data.instagram_url && (
                    <a
                      href={data.instagram_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 border border-border rounded-full px-3 py-1.5 text-sm font-medium text-text hover:bg-surface transition"
                    >
                      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current stroke-2">
                        <rect x="3.75" y="3.75" width="16.5" height="16.5" rx="4.5" />
                        <circle cx="12" cy="12" r="3.5" />
                        <circle cx="17.5" cy="6.5" r="0.75" />
                      </svg>
                      {t("share.view_instagram")}
                    </a>
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border">
        <div className="max-w-lg mx-auto">
          {importError && (
            <p className="text-sm text-danger text-center mb-2">{importError}</p>
          )}
          {user ? (
            <Button
              className="w-full"
              onClick={handleImport}
              disabled={importing || isLoading || isError}
            >
              {importing ? t("share.importing") : t("share.import_button")}
            </Button>
          ) : (
            <Link to={`/login?next=/share/${token}`} className="block">
              <Button className="w-full" variant="outline">
                {t("share.login_to_import")}
              </Button>
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
