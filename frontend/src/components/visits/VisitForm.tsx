import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pencil, X } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { Visit } from "../../types/visit";
import type { VisitItem } from "../../types/visit-item";
import { DateTimePicker } from "../ui/DateTimePicker";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { VisitItemForm, VISIT_ITEM_FORM_ID } from "./VisitItemForm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ImageWithSpinner } from "../ui/ImageWithSpinner";
import { CharacterCount } from "../ui/CharacterCount";
import { FormSection } from "../ui/FormSection";
import { ResponsiveCardCarousel } from "../ui/ResponsiveCardCarousel";
import { useImagePreview } from "../../hooks/useImagePreview";
import { LoadingSpinner } from "../ui/LoadingSpinner";
import { reportApiError } from "../../utils/form-api-error";
import { visitItemsService } from "../../services/visit-items.service";
import { validateImageFile, ALLOWED_IMAGE_ACCEPT } from "../../utils/url";
import { visitSchema, type VisitFormValues } from "../../schemas/visit";
import { RatingInput } from "../ui/RatingInput";
import { Label } from "@/components/ui/label";

type VisitPayload = Partial<Omit<Visit, "photo">> & { photo?: string | File };
type ItemPayload = Partial<Omit<VisitItem, "photo" | "price">> & { photo?: string | File; price?: number | string | null };

type Props = {
  initial?: Partial<Visit>;
  initialItems?: ItemPayload[];
  onSubmit: (visit: VisitPayload, items: ItemPayload[]) => Promise<void>;
  onItemSave?: (item: ItemPayload, currentItem?: ItemPayload) => Promise<ItemPayload>;
};
function RatingDots({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 10 }).map((_, i) => (
        <span key={i} className={`h-1.5 w-1.5 rounded-full ${i < value ? "bg-primary" : "bg-border"}`} />
      ))}
    </div>
  );
}

function VisitItemPhoto({ photo, alt, fallbackText }: { photo?: string | File; alt: string; fallbackText: string }) {
  const initialPhoto = typeof photo === "string" ? photo : null;
  const { preview, setPreview, setPreviewFromFile } = useImagePreview(initialPhoto);

  useEffect(() => {
    if (photo instanceof File) {
      setPreviewFromFile(photo);
      return;
    }

    setPreview(initialPhoto);
  }, [initialPhoto, photo, setPreview, setPreviewFromFile]);

  if (preview) {
    return (
      <ImageWithSpinner
        src={preview}
        alt={alt}
        className="h-24 w-full object-cover"
        spinnerClassName="rounded-none"
      />
    );
  }

  return (
    <div className="flex h-24 w-full items-center justify-center bg-muted/10 text-xs text-muted-foreground">
      {fallbackText}
    </div>
  );
}

export function VisitForm({ initial = {}, initialItems = [], onSubmit, onItemSave }: Props) {
  const { t } = useTranslation();
  const [items, setItems] = useState<ItemPayload[]>(initialItems);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [removedPhoto, setRemovedPhoto] = useState(false);
  const { preview, setPreviewFromFile, clearPreview } = useImagePreview(initial.photo ?? null);
  const [isSavingItem, setIsSavingItem] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftKey, setDraftKey] = useState(0);

  const form = useForm<VisitFormValues>({
    resolver: zodResolver(visitSchema),
    defaultValues: {
      visited_at: initial.visited_at ?? new Date().toISOString(),
      environment_rating: Number(initial.environment_rating ?? 7),
      service_rating: Number(initial.service_rating ?? 7),
      overall_rating: Number(initial.overall_rating ?? 7),
      would_return: initial.would_return ?? true,
      general_notes: initial.general_notes ?? "",
    },
  });

  const { handleSubmit, setError, control, formState: { isSubmitting } } = form;

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) { setPhotoFile(null); setPreviewFromFile(null); return; }
    const err = validateImageFile(file);
    if (err === "type") { toast.error(t("upload.invalidType")); e.target.value = ""; return; }
    if (err === "size") { toast.error(t("upload.tooLarge")); e.target.value = ""; return; }
    setPhotoFile(file);
    setRemovedPhoto(false);
    setPreviewFromFile(file);
  }

  async function handleRemoveItem(index: number) {
    const item = items[index];
    if (item.public_id) {
      try {
        await visitItemsService.remove(item.public_id);
      } catch (error) {
        reportApiError({
          error,
          fallbackMessage: t("visitForm.removeItemError"),
        });
        return;
      }
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function openAdd() {
    setEditingIndex(null);
    setDraftKey((k) => k + 1);
    setModalOpen(true);
  }

  function openEdit(index: number) {
    setEditingIndex(index);
    setDraftKey((k) => k + 1);
    setModalOpen(true);
  }

  async function handleItemSave(data: ItemPayload) {
    const currentItem = editingIndex !== null ? items[editingIndex] : undefined;

    setIsSavingItem(true);

    try {
      const nextItem = onItemSave ? await onItemSave(data, currentItem) : data;

      if (editingIndex !== null) {
        setItems((prev) => prev.map((item, i) => (i === editingIndex ? nextItem : item)));
      } else {
        setItems((prev) => [...prev, nextItem]);
      }
      setModalOpen(false);
    } catch (error) {
      reportApiError({
        error,
        fallbackMessage: t("visitForm.saveError"),
      });
    } finally {
      setIsSavingItem(false);
    }
  }

  const onFormSubmit = async (data: VisitFormValues) => {
    try {
      await onSubmit(
        { ...data, ...(photoFile ? { photo: photoFile } : removedPhoto ? { photo: "" } : {}) },
        items,
      );
    } catch (error) {
      reportApiError({
        setError,
        error,
        fallbackMessage: t("visitForm.saveError"),
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onFormSubmit)} className="flex flex-col gap-4">
        <FormSection title={t("visitForm.sections.when")}>
        <FormField
          control={control}
          name="visited_at"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("visitForm.visitedAt")}</FormLabel>
              <FormControl>
                <DateTimePicker value={field.value} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        </FormSection>

        <FormSection title={t("visitForm.sections.experience")}>
        <FormField
          control={control}
          name="environment_rating"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("visitForm.environmentRating")}</FormLabel>
              <FormControl>
                <RatingInput value={field.value} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="service_rating"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("visitForm.serviceRating")}</FormLabel>
              <FormControl>
                <RatingInput value={field.value} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="overall_rating"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("visitForm.overallRating")}</FormLabel>
              <FormControl>
                <RatingInput value={field.value} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Controller
          name="would_return"
          control={control}
          render={({ field }) => (
            <Label className="flex items-center gap-2 cursor-pointer">
              <Switch
                checked={!!field.value}
                onCheckedChange={field.onChange}
              />
              {t("visitForm.wouldReturn")}
            </Label>
          )}
        />
        </FormSection>

        <FormSection title={t("visitForm.sections.notes")}>
        <FormField
          control={control}
          name="general_notes"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Textarea maxLength={5000} placeholder={t("visitForm.notesPlaceholder")} {...field} />
              </FormControl>
              <CharacterCount value={field.value} max={5000} />
              <FormMessage />
            </FormItem>
          )}
        />
        </FormSection>

        <FormSection title={t("visitForm.sections.photo")}>
        <div className="flex flex-col gap-1.5">
          <input ref={fileRef} type="file" accept={ALLOWED_IMAGE_ACCEPT} className="hidden" onChange={handleFile} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="group relative flex h-36 w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border text-muted-foreground transition hover:border-primary/40 hover:text-primary"
          >
            {preview ? (
              <>
                <ImageWithSpinner
                  src={preview}
                  alt={t("visitForm.visitPhotoAlt")}
                  className="h-full w-full object-cover"
                  spinnerClassName="rounded-none"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                  <span className="text-xs font-medium text-white">{t("placeForm.changePhoto")}</span>
                </div>
              </>
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-1">
                <span className="text-2xl leading-none">+</span>
                <span className="text-xs">{t("placeForm.uploadPhoto")}</span>
              </div>
            )}
          </button>
          {preview && (
            <button
              type="button"
              onClick={() => {
                setPhotoFile(null);
                setRemovedPhoto(true);
                clearPreview();
                if (fileRef.current) fileRef.current.value = "";
              }}
              className="text-xs text-muted-foreground transition hover:text-destructive"
            >
              {t("placeForm.removePhoto")}
            </button>
          )}
        </div>
        </FormSection>

        <FormSection title={t("visitForm.sections.consumed")} description={t("visitForm.consumedDescription")}>
        <div className="flex flex-col gap-2">
          {items.length > 0 && (
            <ResponsiveCardCarousel
              ariaLabel={t("visitForm.consumedTitle")}
              items={items}
              getKey={(item, i) => item.public_id ?? `${item.name ?? "item"}-${i}`}
              mobilePageSize={4}
              desktopPageSize={5}
              mobileColumns={2}
              desktopColumns={5}
              renderItem={(item, i) => (
                <div className="overflow-hidden rounded-xl border border-border bg-card text-sm">
                  <div className="relative">
                    {item.photo ? (
                      <VisitItemPhoto photo={item.photo} alt={item.name ?? ""} fallbackText={t("visitCard.noPhoto")} />
                    ) : (
                      <div className="flex h-24 w-full items-center justify-center bg-muted/10 text-xs text-muted-foreground">
                        {t("visitCard.noPhoto")}
                      </div>
                    )}
                    <div className="absolute right-1 top-1 flex gap-1">
                      <Button type="button" variant="ghost" size="sm" aria-label={t("common.edit")} onClick={() => openEdit(i)}
                        className="h-6 w-6 p-0 bg-black/50 text-white hover:bg-black/70 rounded-md">
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button type="button" variant="ghost" size="sm" aria-label={t("common.remove")} onClick={() => handleRemoveItem(i)}
                        className="h-6 w-6 p-0 bg-black/50 text-white hover:bg-black/70 rounded-md">
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-0.5 p-2">
                    <p className="truncate font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{t(`itemType.${item.type}`)}</p>
                    <RatingDots value={Number(item.rating ?? 0)} />
                  </div>
                </div>
              )}
            />
          )}
          <button
            type="button"
            onClick={openAdd}
            className="flex min-h-[110px] w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-muted-foreground transition hover:border-primary/40 hover:text-primary"
          >
            <span className="text-2xl leading-none">+</span>
            <span className="text-xs">{t("visitItemForm.addTitle")}</span>
          </button>
        </div>
        </FormSection>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && (
            <LoadingSpinner className="mr-2 h-4 w-4" />
          )}
          {t("visitForm.save")}
        </Button>
      </form>

      <Dialog open={modalOpen} onOpenChange={(o) => {
        if (!o) setModalOpen(false);
      }}>
        <DialogContent className="flex max-h-[calc(100svh-0.5rem)] flex-col gap-2 overflow-hidden p-3 sm:max-h-[calc(100vh-2rem)] sm:gap-3 sm:p-6">
          <DialogHeader className="shrink-0 pr-8">
            <DialogTitle>{editingIndex !== null ? t("visitItemForm.editTitle") : t("visitItemForm.addTitle")}</DialogTitle>
          </DialogHeader>
          <VisitItemForm
            key={draftKey}
            defaultValues={editingIndex !== null ? items[editingIndex] : undefined}
            onSave={handleItemSave}
            className="flex-1 overflow-y-auto overscroll-contain pr-1"
          />
          <DialogFooter className="shrink-0 pt-0">
            <Button variant="secondary" className="h-10" onClick={() => setModalOpen(false)} disabled={isSavingItem}>{t("common.cancel")}</Button>
            <Button type="submit" form={VISIT_ITEM_FORM_ID} className="h-10" disabled={isSavingItem}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Form>
  );
}
