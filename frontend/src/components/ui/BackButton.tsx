import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

type Props = {
  fallbackTo?: string;
  label?: string;
};

export function BackButton({ fallbackTo = "/places", label }: Props) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="gap-2 px-3 text-muted-foreground hover:text-foreground"
        onClick={() => {
          if (window.history.state?.idx > 0) {
            navigate(-1);
            return;
          }
          navigate(fallbackTo);
        }}
      >
        <span aria-hidden="true">&larr;</span>
        {label || t("common.back")}
      </Button>
      <Button variant="secondary" size="sm" asChild className="gap-2 px-3">
        <Link to="/places">
          <span aria-hidden="true">⌂</span>
          {t("common.home")}
        </Link>
      </Button>
    </div>
  );
}
