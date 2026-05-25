import { useState, type ImgHTMLAttributes, type ReactNode } from "react";
import { AuthImage } from "./AuthImage";

type Props = ImgHTMLAttributes<HTMLImageElement> & {
  wrapperClassName?: string;
  spinnerClassName?: string;
  fallback?: ReactNode;
};

export function ImageWithSpinner({
  src,
  alt,
  loading = "eager",
  wrapperClassName = "relative block overflow-hidden",
  spinnerClassName = "",
  fallback = null,
  onLoad,
  onError,
  ...props
}: Props) {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);

  if (!src) {
    return fallback ? <div className={wrapperClassName}>{fallback}</div> : null;
  }
  const loaded = loadedSrc === src;

  return (
    <div className={wrapperClassName}>
      <AuthImage
        src={src}
        alt={alt}
        loading={loading}
        {...props}
        onLoad={(event) => {
          setLoadedSrc(src);
          onLoad?.(event);
        }}
        onError={(event) => {
          setLoadedSrc(src);
          onError?.(event);
        }}
      />
      {!loaded && (
        <div
          role="status"
          aria-label="Carregando imagem"
          className={`pointer-events-none absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-[1px] ${spinnerClassName}`}
        >
          <svg
            className="h-5 w-5 animate-spin text-primary"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-90"
              d="M4 12a8 8 0 018-8"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </svg>
        </div>
      )}
    </div>
  );
}
