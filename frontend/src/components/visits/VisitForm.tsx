import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Visit } from "../../types/visit";
import type { VisitItem } from "../../types/visit-item";
import { DateTimePicker } from "../ui/DateTimePicker";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
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
import { AuthImage } from "../ui/AuthImage";
import { CharacterCount } from "../ui/CharacterCount";
import { getApiErrorState } from "../../services/api-errors";
import { applyApiErrors } from "../../utils/form-errors";
import { visitItemsService } from "../../services/visit-items.service";
import { validateImageFile, ALLOWED_IMAGE_ACCEPT } from "../../utils/url";
import { visitSchema, type VisitFormValues } from "../../schemas/visit";
import { RatingInput } from "../ui/RatingInput";

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
  const previewUrl = useMemo(() => {
    if (!(photo instanceof File)) {
      return null;
    }

    return URL.createObjectURL(photo);
  }, [photo]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  if (typeof photo === "string") {
    return <AuthImage src={photo} alt={alt} className="h-24 w-full object-cover" />;
  }

  if (previewUrl) {
    return <img src={previewUrl} alt={alt} className="h-24 w-full object-cover" />;
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
  const [preview, setPreview] = useState<string | null>(initial.photo ?? null);
  const [removeError, setRemoveError] = useState("");
  const [itemSaveError, setItemSaveError] = useState("");
  const [isSavingItem, setIsSavingItem] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftKey, setDraftKey] = useState(0);
  const previewObjectUrlRef = useRef<string | null>(null);

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

  function setPreviewFromFile(file: File | null) {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }

    if (!file) {
      setPreview(initial.photo ?? null);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    previewObjectUrlRef.current = objectUrl;
    setPreview(objectUrl);
  }

  useEffect(() => {
    return () => {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
      }
    };
  }, []);

  const { handleSubmit, setError, control, formState: { errors, isSubmitting } } = form;

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) { setPhotoFile(null); setPreviewFromFile(null); return; }
    const err = validateImageFile(file);
    if (err === "type") { setError("root", { message: t("upload.invalidType") }); e.target.value = ""; return; }
    if (err === "size") { setError("root", { message: t("upload.tooLarge") }); e.target.value = ""; return; }
    setPhotoFile(file);
    setPreviewFromFile(file);
  }

  async function handleRemoveItem(index: number) {
    const item = items[index];
    if (item.public_id) {
      try {
        await visitItemsService.remove(item.public_id);
      } catch {
        setRemoveError(t("visitForm.removeItemError"));
        return;
      }
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function openAdd() {
    setEditingIndex(null);
    setItemSaveError("");
    setDraftKey((k) => k + 1);
    setModalOpen(true);
  }

  function openEdit(index: number) {
    setEditingIndex(index);
    setItemSaveError("");
    setDraftKey((k) => k + 1);
    setModalOpen(true);
  }

  async function handleItemSave(data: ItemPayload) {
    const currentItem = editingIndex !== null ? items[editingIndex] : undefined;

    setItemSaveError("");
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
      const apiError = getApiErrorState(error, t("visitForm.saveError"));
      setItemSaveError(apiError.message);
    } finally {
      setIsSavingItem(false);
    }
  }

  const onFormSubmit = async (data: VisitFormValues) => {
    try {
      await onSubmit(
        { ...data, ...(photoFile ? { photo: photoFile } : {}) },
        items,
      );
    } catch (error) {
      const apiError = getApiErrorState(error, t("visitForm.saveError"));
      setError("root", { message: apiError.message });
      applyApiErrors(setError, apiError.fieldErrors);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
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
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!!field.value}
                onChange={(e) => field.onChange(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              <span className="text-sm font-medium">{t("visitForm.wouldReturn")}</span>
            </label>
          )}
        />
        <FormField
          control={control}
          name="general_notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("visitForm.generalNotes")}</FormLabel>
              <FormControl>
                <Textarea maxLength={5000} {...field} />
              </FormControl>
              <CharacterCount value={field.value} max={5000} />
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-1.5">
          <span className="text-sm font-medium">{t("visitForm.photo")}</span>
          <input ref={fileRef} type="file" accept={ALLOWED_IMAGE_ACCEPT} className="hidden" onChange={handleFile} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="group relative flex h-36 w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border text-muted-foreground transition hover:border-primary/40 hover:text-primary"
          >
            {preview ? (
              <>
                <AuthImage src={preview} alt={t("visitForm.visitPhotoAlt")} className="h-full w-full object-cover" />
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
              onClick={() => { setPhotoFile(null); setPreview(null); }}
              className="text-xs text-muted-foreground transition hover:text-destructive"
            >
              {t("placeForm.removePhoto")}
            </button>
          )}
        </div>

        <div className="space-y-2">
          <span className="text-sm font-medium">{t("visitForm.consumedTitle")}</span>
          {removeError && <p className="text-sm text-destructive">{removeError}</p>}
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {items.map((item, i) => (
              <li key={i} className="overflow-hidden rounded-xl border border-border bg-card text-sm">
                <div className="relative">
                  {item.photo ? (
                    <VisitItemPhoto photo={item.photo} alt={item.name ?? ""} fallbackText={t("visitCard.noPhoto")} />
                  ) : (
                    <div className="flex h-24 w-full items-center justify-center bg-muted/10 text-xs text-muted-foreground">
                      {t("visitCard.noPhoto")}
                    </div>
                  )}
                  <div className="absolute right-1 top-1 flex gap-1">
                    <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(i)}
                      className="h-6 w-6 p-0 bg-black/50 text-white hover:bg-black/70 rounded-md">
                      ✎
                    </Button>
                    <Button type="button" variant="ghost" size="sm" aria-label="Remover" onClick={() => handleRemoveItem(i)}
                      className="h-6 w-6 p-0 bg-black/50 text-white hover:bg-black/70 rounded-md">
                      ✕
                    </Button>
                  </div>
                </div>
                <div className="space-y-0.5 p-2">
                  <p className="truncate font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{t(`itemType.${item.type}`)}</p>
                  <RatingDots value={Number(item.rating ?? 0)} />
                </div>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={openAdd}
                className="flex h-full min-h-[140px] w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-muted-foreground transition hover:border-primary/40 hover:text-primary"
              >
                <span className="text-2xl leading-none">+</span>
                <span className="text-xs">{t("visitItemForm.addTitle")}</span>
              </button>
            </li>
          </ul>
        </div>

        {errors.root && <p className="text-sm text-destructive">{errors.root.message}</p>}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && (
            <svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {t("visitForm.save")}
        </Button>
      </form>

      <Dialog open={modalOpen} onOpenChange={(o) => {
        if (!o) {
          setItemSaveError("");
          setModalOpen(false);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingIndex !== null ? t("visitItemForm.editTitle") : t("visitItemForm.addTitle")}</DialogTitle>
          </DialogHeader>
          <VisitItemForm
            key={draftKey}
            defaultValues={editingIndex !== null ? items[editingIndex] : undefined}
            onSave={handleItemSave}
          />
          {itemSaveError && <p className="text-sm text-destructive">{itemSaveError}</p>}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={isSavingItem}>{t("common.cancel")}</Button>
            <Button type="submit" form={VISIT_ITEM_FORM_ID} disabled={isSavingItem}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Form>
  );
}
