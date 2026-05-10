import type { ImgHTMLAttributes } from "react";
import { useEffect, useState } from "react";

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

export function AuthImage({ src, ...props }: Props) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const apiPath = src ? toApiPath(src) : null;

  useEffect(() => {
    if (!apiPath) return;

    let active = true;
    let created: string | null = null;

    api
      .get<Blob>(apiPath, { responseType: "blob" })
      .then((res) => {
        if (!active) return;
        created = URL.createObjectURL(res.data);
        setObjectUrl(created);
      })
      .catch(() => {
        if (active) setObjectUrl(null);
      });

    return () => {
      active = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [apiPath]);

  if (!src) return null;

  return <img src={apiPath ? (objectUrl ?? undefined) : src} {...props} />;
}
