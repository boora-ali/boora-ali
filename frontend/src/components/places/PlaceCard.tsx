import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Place } from "../../types/place";
import { Badge } from "../ui/Badge";
import { sanitizeUrl } from "../../utils/url";
import { AuthImage } from "../ui/AuthImage";

export function PlaceCard({ place, index = 0 }: { place: Place; index?: number }) {
  const { t } = useTranslation();

  return (
    <article
      className="bg-surface rounded-2xl border border-border shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 overflow-hidden group animate-fade-slide-up"
      style={{ animationDelay: `${index * 55}ms` }}
    >
      <Link to={`/places/${place.public_id}`} className="block">
        <div className="relative overflow-hidden">
          {place.cover_photo ? (
            <>
              <AuthImage
                src={place.cover_photo}
                alt={place.name}
                className="w-full h-44 object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
              <div className="absolute bottom-2.5 left-3">
                <Badge status={place.status} />
              </div>
            </>
          ) : (
            <div className="w-full h-44 bg-gradient-to-br from-background to-border/60 flex items-center justify-center">
              <span className="text-4xl opacity-20">🍽</span>
              <div className="absolute bottom-2.5 left-3">
                <Badge status={place.status} />
              </div>
            </div>
          )}
        </div>
      </Link>

      <div className="space-y-3 p-4">
        <Link to={`/places/${place.public_id}`} className="block">
          <h3 className="font-fraunces font-semibold text-[1.05rem] leading-snug truncate text-text">
            {place.name}
          </h3>
          <p className="text-muted text-sm mt-0.5">{place.category}</p>
          {place.address && (
            <p className="text-muted text-xs mt-1 truncate">{place.address}</p>
          )}
          {place.notes && (
            <p className="mt-2 line-clamp-2 text-sm text-text/90">{place.notes}</p>
          )}
        </Link>

        <div className="flex flex-wrap gap-2">
          {sanitizeUrl(place.instagram_url) && (
            <a
              href={sanitizeUrl(place.instagram_url)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-text transition hover:bg-surface"
              aria-label={t("placeDetail.instagram")}
              onClick={(event) => event.stopPropagation()}
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current stroke-2">
                <rect x="3.75" y="3.75" width="16.5" height="16.5" rx="4.5" />
                <circle cx="12" cy="12" r="3.5" />
                <circle cx="17.5" cy="6.5" r="0.75" />
              </svg>
              {t("placeDetail.instagram")}
            </a>
          )}

          {sanitizeUrl(place.maps_url) && (
            <a
              href={sanitizeUrl(place.maps_url)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-text transition hover:bg-surface"
              aria-label={t("placeDetail.maps")}
              onClick={(event) => event.stopPropagation()}
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current stroke-2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              {t("placeDetail.maps")}
            </a>
          )}

          <Link
            to={`/places/${place.public_id}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/15"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current stroke-2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
            {t("common.open")}
          </Link>
        </div>
      </div>
    </article>
  );
}
