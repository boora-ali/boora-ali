import type { PlaceStatus } from "../../types/place";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { Badge as ShadcnBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Eye, Check, Star, X } from "lucide-react";

const colorMap: Record<PlaceStatus, string> = {
  want_to_visit: "border-blue-600 bg-blue-600 text-white",
  visited: "border-yellow-500 bg-yellow-400 text-black",
  favorite: "border-primary bg-primary text-primary-foreground",
  would_not_return: "border-foreground bg-foreground text-background",
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
      className={cn("gap-1 whitespace-nowrap", colorMap[status])}
    >
      <Icon className="h-3 w-3" />
      {t(`status.${status}`)}
    </ShadcnBadge>
  );
}
