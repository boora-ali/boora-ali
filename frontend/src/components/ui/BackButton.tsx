import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

type Props = {
  fallbackTo?: string;
  label?: string;
  onBeforeNavigate?: () => boolean;
};

export function BackButton({ fallbackTo = "/places", label, onBeforeNavigate }: Props) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const canNavigate = () => onBeforeNavigate?.() ?? true;

  function goBack() {
    if (!canNavigate()) return;
    if (window.history.state?.idx > 0) {
      navigate(-1);
      return;
    }
    navigate(fallbackTo);
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="gap-2 px-3 text-muted-foreground hover:text-foreground"
        onClick={goBack}
      >
        <span aria-hidden="true">&larr;</span>
        {label || t("common.back")}
      </Button>
      <Button variant="secondary" size="sm" className="gap-2 px-3" onClick={() => canNavigate() && navigate("/places")}>
        <span aria-hidden="true">⌂</span>
        {t("common.home")}
      </Button>
    </div>
  );
}
