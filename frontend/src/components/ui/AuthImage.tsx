import type { ImgHTMLAttributes } from "react";

type Props = ImgHTMLAttributes<HTMLImageElement>;

export function AuthImage({ src, loading = "lazy", ...props }: Props) {
  if (!src) return null;
  return <img src={src} loading={loading} {...props} />;
}
