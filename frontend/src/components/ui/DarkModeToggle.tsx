import { useDarkMode } from "../../hooks/useDarkMode";
import { useTranslation } from "react-i18next";
import { Switch } from "@/components/ui/switch";

export function DarkModeToggle() {
  const { dark, toggle } = useDarkMode();
  const { t } = useTranslation();

  return (
    <Switch
      checked={dark}
      onCheckedChange={toggle}
      aria-label={t("darkMode.toggle")}
    />
  );
}
