import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { VisitItem, VisitItemType } from "../../types/visit-item";
import { VISIT_ITEM_TYPES } from "../../utils/constants";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RatingInput } from "../ui/RatingInput";
import { CharacterCount } from "../ui/CharacterCount";
import { Switch } from "@/components/ui/switch";
import { validateImageFile, ALLOWED_IMAGE_ACCEPT } from "../../utils/url";
import { AuthImage } from "../ui/AuthImage";
import { visitItemSchema, type VisitItemFormValues } from "../../schemas/visit";

type VisitItemPayload = Partial<Omit<VisitItem, "photo" | "price">> & { photo?: string | File; price?: number | string | null };

type Props = {
  defaultValues?: VisitItemPayload;
  onSave: (data: VisitItemPayload) => void;
  className?: string;
};

export const VISIT_ITEM_FORM_ID = "visit-item-form";

export function VisitItemForm({ defaultValues, onSave, className = "" }: Props) {
  const { t } = useTranslation();
  const existingPhoto = typeof defaultValues?.photo === "string" ? defaultValues.photo : null;
  const [preview, setPreview] = useState<string | null>(existingPhoto);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [removedPhoto, setRemovedPhoto] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const form = useForm<VisitItemFormValues>({
    resolver: zodResolver(visitItemSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      type: (defaultValues?.type ?? "other") as VisitItemType,
      rating: Number(defaultValues?.rating ?? 7),
      price: defaultValues?.price != null ? Number(defaultValues.price) : undefined,
      notes: defaultValues?.notes ?? "",
      would_order_again: defaultValues?.would_order_again ?? true,
    },
  });

  const { handleSubmit, control } = form;

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setPhotoFile(null);
      setPreview(existingPhoto);
      return;
    }
    const err = validateImageFile(file);
    if (err === "type") { toast.error(t("upload.invalidType")); setPhotoError(t("upload.invalidType")); e.target.value = ""; return; }
    if (err === "size") { toast.error(t("upload.tooLarge")); setPhotoError(t("upload.tooLarge")); e.target.value = ""; return; }
    setPhotoError("");
    setPhotoFile(file);
    setRemovedPhoto(false);
    setPreview(URL.createObjectURL(file));
  }

  const onFormSubmit = (data: VisitItemFormValues) => {
    onSave({
      ...data,
      price: data.price != null ? String(data.price) : null,
      ...(photoFile
        ? { photo: photoFile }
        : removedPhoto
        ? { photo: "" }
        : existingPhoto
        ? { photo: existingPhoto }
        : {}),
    });
  };

  return (
    <Form {...form}>
      <form id={VISIT_ITEM_FORM_ID} onSubmit={handleSubmit(onFormSubmit)} className={`min-h-0 space-y-2 ${className}`}>
        <div className="space-y-1">
          <span className="text-sm font-medium">{t("visitItemForm.photo")}</span>
          <input ref={fileRef} type="file" accept={ALLOWED_IMAGE_ACCEPT} className="hidden" onChange={handleFile} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="group relative flex h-20 w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border text-muted-foreground transition hover:border-primary/40 hover:text-primary sm:h-24"
          >
            {preview ? (
              <>
                <AuthImage src={preview} alt={t("visitItemForm.itemPhotoAlt")} className="h-full w-full object-cover" />
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
                setPreview(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
              className="text-xs text-muted-foreground transition hover:text-destructive"
            >
              {t("placeForm.removePhoto")}
            </button>
          )}
          {photoError && <p className="text-sm text-destructive">{photoError}</p>}
        </div>

        <FormField
          control={control}
          name="name"
          render={({ field }) => (
            <FormItem className="space-y-1">
              <FormLabel>{t("visitItemForm.name")}</FormLabel>
              <FormControl>
                <Input maxLength={200} className="h-10 py-2" {...field} />
              </FormControl>
              <CharacterCount value={field.value} max={200} />
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="type"
          render={({ field }) => (
            <FormItem className="space-y-1">
              <FormLabel>{t("visitItemForm.type")}</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {VISIT_ITEM_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {t(`itemType.${type.value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <Controller
          name="would_order_again"
          control={control}
          render={({ field }) => (
            <label className="flex items-center gap-2 cursor-pointer py-0.5">
              <Switch
                checked={!!field.value}
                onCheckedChange={field.onChange}
                aria-label={t("visitItemForm.wouldOrderAgain")}
              />
              <span className="text-sm font-medium">{t("visitItemForm.wouldOrderAgain")}</span>
            </label>
          )}
        />

        <FormField
          control={control}
          name="price"
          render={({ field }) => (
            <FormItem className="space-y-1">
              <FormLabel>{t("visitItemForm.price")}</FormLabel>
              <FormControl>
                <Input
                  className="h-10 py-2"
                  type="number"
                  min={0}
                  step={0.01}
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="rating"
          render={({ field }) => (
            <FormItem className="space-y-1">
              <FormLabel>{t("visitItemForm.rating")}</FormLabel>
              <FormControl>
                <RatingInput value={field.value} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="notes"
          render={({ field }) => (
            <FormItem className="space-y-1">
              <FormLabel>{t("visitItemForm.notes")}</FormLabel>
              <FormControl>
                <Textarea maxLength={5000} className="min-h-[64px] py-2" {...field} />
              </FormControl>
              <CharacterCount value={field.value} max={5000} />
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}
