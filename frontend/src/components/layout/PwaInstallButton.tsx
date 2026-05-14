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

type Props = {
  variant?: "fixed" | "inline";
};

export function PwaInstallButton({ variant = "fixed" }: Props) {
  const { t } = useTranslation();
  const { canInstall, hasNativePrompt, install, isAndroid, isIos, isStandalone } = usePwaInstall();
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const isInstructionOnly = isIos || (isAndroid && !hasNativePrompt);
  const buttonLabel = isIos ? t("pwa.iosButton") : t("pwa.install");
  const buttonAriaLabel = isIos ? t("pwa.iosButtonAria") : t("pwa.installAria");
  const instructionsTitle = isIos ? t("pwa.iosTitle") : t("pwa.androidTitle");
  const instructionsDescription = isIos ? t("pwa.iosDescription") : t("pwa.androidDescription");

  if (isStandalone || !canInstall) return null;

  async function handleClick() {
    if (isInstructionOnly) {
      setInstructionsOpen(true);
      return;
    }

    const didOpenPrompt = await install();
    if (!didOpenPrompt && isAndroid) {
      setInstructionsOpen(true);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={handleClick}
        className={
          variant === "fixed"
            ? "fixed bottom-[calc(env(safe-area-inset-bottom,0px)+1rem)] left-4 right-4 z-40 gap-2 rounded-xl border-border bg-surface/95 px-4 py-3 text-sm shadow-sm backdrop-blur sm:bottom-auto sm:left-auto sm:right-4 sm:top-4 sm:w-auto"
            : "w-full gap-2 rounded-xl border-border bg-surface/95 px-4 py-3 text-sm shadow-sm"
        }
        aria-label={buttonAriaLabel}
      >
        <Download className="h-4 w-4" />
        <span>{buttonLabel}</span>
      </Button>

      <Dialog open={instructionsOpen} onOpenChange={setInstructionsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{instructionsTitle}</DialogTitle>
            <DialogDescription>{instructionsDescription}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-text">
            {isIos ? (
              <>
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
              </>
            ) : (
              <>
                <div className="flex items-start gap-3 rounded-xl border border-border bg-background p-3">
                  <Share2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <p>{t("pwa.androidStepMenu")}</p>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-border bg-background p-3">
                  <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <p>{t("pwa.androidStepInstall")}</p>
                </div>
                <div className="rounded-xl border border-dashed border-border bg-background p-3">
                  <p>{t("pwa.androidStepFallback")}</p>
                </div>
              </>
            )}
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
