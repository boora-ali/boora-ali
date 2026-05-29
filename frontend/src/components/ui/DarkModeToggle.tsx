import { SunMedium, MoonStar } from "lucide-react";
import { useDarkMode } from "../../hooks/useDarkMode";
import { useTranslation } from "react-i18next";
import { Switch } from "@/components/ui/switch";

export function DarkModeToggle() {
  const { dark, toggle } = useDarkMode();
  const { t } = useTranslation();

  return (
    <div className="inline-flex items-center gap-1.5">
      <SunMedium className={`h-4 w-4 ${dark ? "text-muted" : "text-primary"}`} />
      <Switch checked={dark} onCheckedChange={toggle} aria-label={t("darkMode.toggle")} />
      <MoonStar className={`h-4 w-4 ${dark ? "text-primary" : "text-muted"}`} />
    </div>
  );
}
