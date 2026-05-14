import type { ImgHTMLAttributes } from "react";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { api } from "../../services/api";

type Props = ImgHTMLAttributes<HTMLImageElement>;

function toApiPath(src: string): string | null {
  try {
    const url = new URL(src, window.location.origin);
    if (!url.pathname.startsWith("/api/media/")) return null;
    return `${url.pathname.slice("/api".length)}${url.search}`;
  } catch {
    return src.startsWith("/api/media/") ? src.slice("/api".length) : null;
  }
}

type FetchState = { status: "idle" | "loading" | "error"; objectUrl: string | null };

export function AuthImage({ src, className, ...props }: Props) {
  const apiPath = src ? toApiPath(src) : null;
  const [state, setState] = useState<FetchState>({ status: "idle", objectUrl: null });
  const prevApiPath = useRef<string | null>(null);

  useEffect(() => {
    if (!apiPath) return;
    if (prevApiPath.current === apiPath) return;
    prevApiPath.current = apiPath;

    let active = true;
    let created: string | null = null;

    api
      .get<Blob>(apiPath, { responseType: "blob" })
      .then((res) => {
        if (!active) return;
        created = URL.createObjectURL(res.data);
        setState({ status: "idle", objectUrl: created });
      })
      .catch(() => {
        if (active) setState({ status: "error", objectUrl: null });
      });

    setState({ status: "loading", objectUrl: null });

    return () => {
      active = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [apiPath]);

  if (!src) return null;

  if (!apiPath) return <img src={src} className={className} {...props} />;

  if (state.status === "loading") {
    return (
      <div className={`flex items-center justify-center bg-surface/30 ${className ?? ""}`}>
        <Loader2 className="h-6 w-6 animate-spin text-muted/50" />
      </div>
    );
  }

  if (!state.objectUrl) return null;

  return <img src={state.objectUrl} className={className} {...props} />;
}
