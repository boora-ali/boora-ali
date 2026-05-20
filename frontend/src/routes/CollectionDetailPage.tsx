import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { collectionsService, type CollectionDetail } from "../services/collections.service";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingState } from "../components/ui/LoadingState";
import { BackButton } from "../components/ui/BackButton";
import { ErrorMessage } from "../components/ui/ErrorMessage";
import NotFoundPage from "./NotFoundPage";

export default function CollectionDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [state, setState] = useState<{
    status: "idle" | "loading" | "error";
    data: CollectionDetail | null;
  }>({ status: "idle", data: null });
  const [notFound, setNotFound] = useState(false);
  const prevId = useRef<string | null>(null);

  useEffect(() => {
    if (!id) return;
    if (prevId.current === id) return;
    prevId.current = id;

    collectionsService
      .get(id)
      .then((data) => setState({ status: "idle", data }))
      .catch((err) => {
        if (err?.isNotFound) {
          setNotFound(true);
        } else {
          setState({ status: "error", data: null });
        }
      });

    setState({ status: "loading", data: null });
  }, [id]);

  if (notFound) return <NotFoundPage />;
  if (state.status === "loading") return <LoadingState variant="detail" />;
  if (state.status === "error")
    return (
      <div className="max-w-2xl mx-auto p-4">
        <ErrorMessage message={t("common.loading")} />
      </div>
    );

  const collection = state.data;
  if (!collection) return null;

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <BackButton />
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{collection.emoji}</span>
            <div>
              <h1 className="font-fraunces text-3xl font-bold text-text">{collection.name}</h1>
              {collection.description && (
                <p className="mt-1 text-sm text-muted">{collection.description}</p>
              )}
            </div>
          </div>
          <p className="mt-2 text-sm text-muted">
            {collection.place_count} {t("collections.places_count")}
          </p>
        </CardContent>
      </Card>

      <h2 className="text-xl font-semibold">{t("collections.title")}</h2>

      {collection.places.length === 0 ? (
        <p className="text-sm text-muted text-center py-8">{t("collections.empty_places")}</p>
      ) : (
        <div className="space-y-2">
          {collection.places.map((place) => (
            <Link key={place.public_id} to={`/places/${place.public_id}`}>
              <Card className="hover:bg-surface/60 transition-colors cursor-pointer">
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-text truncate">{place.name}</p>
                      {place.category && (
                        <p className="text-sm text-muted truncate">{place.category}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
