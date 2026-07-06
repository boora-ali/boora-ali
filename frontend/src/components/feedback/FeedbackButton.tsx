import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { FeedbackModal } from "./FeedbackModal";

export function FeedbackButton() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        className="h-auto px-0 py-0 text-sm font-medium text-muted hover:text-text"
        onClick={() => setOpen(true)}
      >
        {t("footer.feedback")}
      </Button>
      <FeedbackModal open={open} onOpenChange={setOpen} />
    </>
  );
}
