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
        size="sm"
        onClick={handleClick}
        className="fixed left-4 top-4 z-40 gap-2 rounded-xl border-border bg-surface/95 shadow-sm backdrop-blur"
        aria-label={t("pwa.installAria")}
      >
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">{t("pwa.install")}</span>
      </Button>

      <Dialog open={instructionsOpen} onOpenChange={setInstructionsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("pwa.iosTitle")}</DialogTitle>
            <DialogDescription>{t("pwa.iosDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-text">
            <div className="flex items-start gap-3 rounded-xl border border-border bg-background p-3">
              <Share2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p>{t("pwa.iosStepShare")}</p>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-border bg-background p-3">
              <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p>{t("pwa.iosStepAdd")}</p>
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
