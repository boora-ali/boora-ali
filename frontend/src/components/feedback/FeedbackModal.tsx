import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { reportApiError } from "../../utils/form-api-error";
import { submitFeedback, type FeedbackKind } from "../../services/feedback.service";

const feedbackKinds = ["suggestion", "bug"] as const satisfies readonly FeedbackKind[];

type FeedbackFormValues = {
  kind: FeedbackKind;
  message: string;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FeedbackModal({ open, onOpenChange }: Props) {
  const { t } = useTranslation();
  const schema = z.object({
    kind: z.enum(feedbackKinds),
    message: z
      .string()
      .trim()
      .min(1, t("feedback.errors.messageRequired"))
      .max(2000, t("feedback.errors.messageTooLong")),
  });
  const form = useForm<FeedbackFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { kind: "suggestion", message: "" },
  });

  useEffect(() => {
    if (!open) {
      form.reset({ kind: "suggestion", message: "" });
    }
  }, [form, open]);

  async function onSubmit(values: FeedbackFormValues) {
    try {
      form.clearErrors("root");
      await submitFeedback({
        kind: values.kind,
        message: values.message,
        page_url: window.location.href,
      });
      toast.success(t("feedback.success"));
      form.reset({ kind: "suggestion", message: "" });
      onOpenChange(false);
    } catch (error) {
      reportApiError({
        setError: form.setError,
        error,
        fallbackMessage: t("feedback.error"),
      });
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) form.reset({ kind: "suggestion", message: "" });
      }}
    >
      <DialogContent className="max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t("feedback.title")}</DialogTitle>
          <DialogDescription>{t("feedback.description")}</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <Controller
            control={form.control}
            name="kind"
            render={({ field }) => (
              <div className="space-y-2">
                <Label htmlFor="feedback-kind">{t("feedback.kindLabel")}</Label>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="feedback-kind">
                    <SelectValue placeholder={t("feedback.kindPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="suggestion">{t("feedback.kindSuggestion")}</SelectItem>
                    <SelectItem value="bug">{t("feedback.kindBug")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          />

          <div className="space-y-2">
            <Label htmlFor="feedback-message">{t("feedback.messageLabel")}</Label>
            <Textarea
              id="feedback-message"
              rows={5}
              maxLength={2000}
              placeholder={t("feedback.messagePlaceholder")}
              {...form.register("message")}
            />
            {form.formState.errors.message && (
              <p className="text-sm text-destructive">{form.formState.errors.message.message}</p>
            )}
          </div>

          {form.formState.errors.root && (
            <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? t("feedback.sending") : t("feedback.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
