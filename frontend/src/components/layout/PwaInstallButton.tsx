import { useState } from "react";
import { Download, Share2, Smartphone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePwaInstall } from "../../hooks/usePwaInstall";

export function PwaInstallButton() {
  const { t } = useTranslation();
  const { canInstall, install, isIos, isStandalone } = usePwaInstall();
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const buttonLabel = isIos ? t("pwa.iosButton") : t("pwa.install");
  const buttonAriaLabel = isIos ? t("pwa.iosButtonAria") : t("pwa.installAria");

  if (isStandalone || !canInstall) return null;

  async function handleClick() {
    if (isIos) {
      setInstructionsOpen(true);
      return;
    }

    await install();
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={handleClick}
        className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+1rem)] left-4 right-4 z-40 gap-2 rounded-xl border-border bg-surface/95 px-4 py-3 text-sm shadow-sm backdrop-blur sm:bottom-auto sm:left-auto sm:right-4 sm:top-4 sm:w-auto"
        aria-label={buttonAriaLabel}
      >
        <Download className="h-4 w-4" />
        <span>{buttonLabel}</span>
      </Button>

      <Dialog open={instructionsOpen} onOpenChange={setInstructionsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("pwa.iosTitle")}</DialogTitle>
            <DialogDescription>{t("pwa.iosDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-text">
            <div className="rounded-xl border border-border bg-background p-3">
              <p>{t("pwa.iosStepSafari")}</p>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-border bg-background p-3">
              <Share2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p>{t("pwa.iosStepShare")}</p>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-border bg-background p-3">
              <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p>{t("pwa.iosStepAdd")}</p>
            </div>
            <div className="rounded-xl border border-dashed border-border bg-background p-3">
              <p>{t("pwa.iosStepFallback")}</p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setInstructionsOpen(false)}>
              {t("common.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
