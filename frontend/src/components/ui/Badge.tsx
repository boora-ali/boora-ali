import type { PlaceStatus } from "../../types/place";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { Badge as ShadcnBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Eye, Check, Star, X } from "lucide-react";

const colorMap: Record<PlaceStatus, string> = {
  want_to_visit: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50",
  visited: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50",
  favorite: "bg-red-50 text-primary border-red-200 hover:bg-red-50",
  would_not_return: "bg-zinc-100 text-zinc-500 border-zinc-200 hover:bg-zinc-100",
};

const icons: Record<PlaceStatus, ComponentType<{ className?: string }>> = {
  want_to_visit: Eye,
  visited: Check,
  favorite: Star,
  would_not_return: X,
};

export function Badge({ status }: { status: PlaceStatus }) {
  const { t } = useTranslation();
  const Icon = icons[status];
  return (
    <ShadcnBadge
      variant="outline"
      className={cn("gap-1 whitespace-nowrap font-medium", colorMap[status])}
    >
      <Icon className="h-3 w-3" />
      {t(`status.${status}`)}
    </ShadcnBadge>
  );
}
