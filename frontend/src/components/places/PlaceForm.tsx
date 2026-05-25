import { useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { Place, PlaceStatus } from "../../types/place";
import { PLACE_STATUSES } from "../../utils/constants";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
} from "@/components/ui/input-group";
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
import { LocationPicker } from "../ui/LocationPicker";
import { ImageWithSpinner } from "../ui/ImageWithSpinner";
import { CharacterCount } from "../ui/CharacterCount";
import { FormSection } from "../ui/FormSection";
import { LottieState } from "../ui/LottieState";
import { LoadingSpinner } from "../ui/LoadingSpinner";
import { useImagePreview } from "../../hooks/useImagePreview";
import { reportApiError } from "../../utils/form-api-error";
import { Link2, MapPin, Map } from "lucide-react";
import {
  ALLOWED_IMAGE_ACCEPT,
  extractGoogleMapsCoords,
  isGoogleMapsUrl,
  validateImageFile,
} from "../../utils/url";
import { geocodeAddress } from "../../services/geocoding.service";
import { placeSchema, type PlaceFormValues } from "../../schemas/place";

type PlacePayload = Partial<Omit<Place, "cover_photo">> & { cover_photo?: string | File };

type Props = {
  initial?: Partial<Place>;
  onSubmit: (data: PlacePayload) => Promise<void>;
  onResolveMapsUrl?: (data: PlacePayload) => Promise<void>;
};

export function PlaceForm({ initial = {}, onSubmit, onResolveMapsUrl }: Props) {
  const { t } = useTranslation();
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [removedCover, setRemovedCover] = useState(false);
  const { preview, setPreview, setPreviewFromFile, clearPreview } = useImagePreview(initial.cover_photo ?? null);
  const [coverPhotoError, setCoverPhotoError] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [resolvingMapsUrl, setResolvingMapsUrl] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const geocodeAbortRef = useRef<AbortController | null>(null);
  const lastGeocodedAddressRef = useRef<string>("");

  const form = useForm<PlaceFormValues>({
    resolver: zodResolver(placeSchema),
    defaultValues: {
      name: initial.name ?? "",
      category: initial.category ?? "",
      address: initial.address ?? "",
      instagram_url: initial.instagram_url ?? "",
      maps_url: initial.maps_url ?? "",
      status: (initial.status ?? "want_to_visit") as PlaceStatus,
      notes: initial.notes ?? "",
      latitude: initial.latitude ?? undefined,
      longitude: initial.longitude ?? undefined,
    },
  });

  const { handleSubmit, setError, setValue, getValues, control, formState: { errors, isSubmitting } } = form;

  const mapsUrl = useWatch({ control, name: "maps_url" }) ?? "";
  const latitude = useWatch({ control, name: "latitude" });
  const longitude = useWatch({ control, name: "longitude" });
  const mapsUrlCoords = mapsUrl ? extractGoogleMapsCoords(mapsUrl) : null;
  const canResolveMapsUrl = Boolean(onResolveMapsUrl && mapsUrl && isGoogleMapsUrl(mapsUrl) && !mapsUrlCoords);

  const handleMapsUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setValue("maps_url", value, { shouldValidate: true });
    const coords = extractGoogleMapsCoords(value);
    if (coords) {
      setValue("latitude", coords.latitude);
      setValue("longitude", coords.longitude);
    }
  };

  const handleExtractCoords = useCallback(() => {
    if (!mapsUrl) return;
    const coords = extractGoogleMapsCoords(mapsUrl);
    if (coords) {
      setValue("latitude", coords.latitude);
      setValue("longitude", coords.longitude);
      return;
    }
    if (!isGoogleMapsUrl(mapsUrl)) {
      setError("maps_url", { message: t("placeForm.coordsNotFound") });
    }
  }, [mapsUrl, setValue, setError, t]);

  async function handleResolveMapsUrl() {
    if (!onResolveMapsUrl || !mapsUrl) return;
    await handleSubmit(async (formData) => {
      setResolvingMapsUrl(true);
      try {
        await onResolveMapsUrl({
          ...formData,
          ...(coverFile ? { cover_photo: coverFile } : {}),
        });
      } finally {
        setResolvingMapsUrl(false);
      }
    })();
  }

  async function handleAddressBlur() {
    const address = getValues("address")?.trim() ?? "";
    if (address.length < 5 || address === lastGeocodedAddressRef.current) return;
    geocodeAbortRef.current?.abort();
    const controller = new AbortController();
    geocodeAbortRef.current = controller;
    setGeocoding(true);
    const coords = await geocodeAddress(address, controller.signal);
    setGeocoding(false);
    if (!coords) return;
    lastGeocodedAddressRef.current = address;
    setValue("latitude", String(coords.lat));
    setValue("longitude", String(coords.lon));
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setCoverFile(null);
      setPreview(initial.cover_photo ?? null);
      return;
    }
    const err = validateImageFile(file);
    if (err === "type") { toast.error(t("upload.invalidType")); setCoverPhotoError(t("upload.invalidType")); e.target.value = ""; return; }
    if (err === "size") { toast.error(t("upload.tooLarge")); setCoverPhotoError(t("upload.tooLarge")); e.target.value = ""; return; }
    setCoverPhotoError("");
    setCoverFile(file);
    setPreviewFromFile(file);
  }

  const onFormSubmit = async (data: PlaceFormValues) => {
    try {
      await onSubmit({
        ...data,
        ...(coverFile ? { cover_photo: coverFile } : removedCover ? { cover_photo: "" } : {}),
      });
    } catch (error) {
      reportApiError({
        setError,
        error,
        fallbackMessage: t("placeForm.saveError"),
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onFormSubmit)} className="flex flex-col gap-4">
        <FormSection
          title={t("placeForm.sections.basic")}
          description={t("placeForm.sections.basicDescription")}
        >
          <FormField
            control={control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("placeForm.name")} <span className="text-primary ml-0.5" aria-hidden="true">*</span></FormLabel>
                <FormControl>
                  <Input maxLength={200} placeholder={t("placeForm.namePlaceholder")} {...field} />
                </FormControl>
                <CharacterCount value={field.value} max={200} />
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("placeForm.category")}</FormLabel>
                <FormControl>
                  <Input maxLength={100} placeholder={t("placeForm.categoryPlaceholder")} {...field} />
                </FormControl>
                <CharacterCount value={field.value} max={100} />
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("placeForm.status")}</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {PLACE_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {t(`status.${s.value}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="instagram_url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("placeForm.instagram")}</FormLabel>
                <FormControl>
                  <InputGroup>
                    <InputGroupAddon>
                      <Link2 size={16} className="text-muted-foreground" />
                    </InputGroupAddon>
                    <InputGroupInput maxLength={200} placeholder={t("placeForm.instagramPlaceholder")} {...field} />
                  </InputGroup>
                </FormControl>
                <CharacterCount value={field.value} max={200} />
                <FormMessage />
              </FormItem>
            )}
          />
        </FormSection>

        <FormSection
          title={t("placeForm.sections.location")}
          description={t("placeForm.sections.locationDescription")}
        >
        <FormField
          control={control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("placeForm.address")}</FormLabel>
              <FormControl>
                <InputGroup>
                  <InputGroupAddon>
                    <MapPin size={16} className="text-muted-foreground" />
                  </InputGroupAddon>
                  <InputGroupInput maxLength={300} placeholder={t("placeForm.addressPlaceholder")} {...field} onBlur={handleAddressBlur} />
                </InputGroup>
              </FormControl>
              <CharacterCount value={field.value} max={300} />
              {geocoding
                ? <p className="text-xs text-muted-foreground">{t("placeForm.geocoding")}</p>
                : <FormMessage />
              }
            </FormItem>
          )}
        />

        <div className="flex flex-col gap-1.5">
          <Label>{t("placeForm.maps")}</Label>
          <div className="flex gap-2">
            <InputGroup className="flex-1">
              <InputGroupAddon>
                <Map size={16} className="text-muted-foreground" />
              </InputGroupAddon>
              <InputGroupInput
                value={mapsUrl}
                onChange={handleMapsUrlChange}
                maxLength={2000}
              />
            </InputGroup>
            <button
              type="button"
              title={canResolveMapsUrl ? t("placeForm.saveAndResolveMapsUrl") : t("placeForm.extractCoords")}
              onClick={canResolveMapsUrl ? () => void handleResolveMapsUrl() : handleExtractCoords}
              disabled={!mapsUrl || resolvingMapsUrl}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition hover:border-primary/40 hover:text-primary disabled:opacity-50"
            >
              {resolvingMapsUrl ? (
                <LoadingSpinner className="h-4 w-4" />
              ) : (
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              )}
            </button>
          </div>
          <CharacterCount value={mapsUrl} max={2000} />
          {errors.maps_url && <p className="text-xs text-destructive mt-1">{errors.maps_url.message}</p>}
          {canResolveMapsUrl && <p className="text-xs text-muted-foreground">{t("placeForm.saveAndResolveMapsUrlHint")}</p>}
        </div>

        <LocationPicker
          label={t("placeForm.location")}
          hint={t("placeForm.locationHint")}
          clearLabel={t("placeForm.clearLocation")}
          useCurrentLocationLabel={t("placeForm.useCurrentLocation")}
          locatingLabel={t("placeForm.locating")}
          geolocationUnavailableMessage={t("placeForm.geolocationUnavailable")}
          geolocationDeniedMessage={t("placeForm.geolocationDenied")}
          geolocationErrorMessage={t("placeForm.geolocationError")}
          zoomInLabel={t("placeForm.zoomIn")}
          zoomOutLabel={t("placeForm.zoomOut")}
          latitude={latitude}
          longitude={longitude}
          onChange={({ latitude: lat, longitude: lng }) => {
            setValue("latitude", lat);
            setValue("longitude", lng);
          }}
        />
        </FormSection>

        <FormSection
          title={t("placeForm.sections.notes")}
          description={t("placeForm.sections.notesDescription")}
        >
        <FormField
          control={control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("placeForm.notes")}</FormLabel>
              <FormControl>
                <Textarea maxLength={5000} placeholder={t("placeForm.notesPlaceholder")} {...field} />
              </FormControl>
              <CharacterCount value={field.value} max={5000} />
              <FormMessage />
            </FormItem>
          )}
        />
        </FormSection>

        <FormSection
          title={t("placeForm.sections.photo")}
          description={t("placeForm.sections.photoDescription")}
        >
        <div className="flex flex-col gap-1.5">
          <Label>{t("placeForm.coverPhoto")}</Label>
          <input ref={fileRef} type="file" accept={ALLOWED_IMAGE_ACCEPT} className="hidden" onChange={handleFile} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="group relative flex h-36 w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border transition hover:border-primary/40"
          >
            {preview ? (
              <>
                <ImageWithSpinner
                  src={preview}
                  alt={t("placeForm.coverPreviewAlt")}
                  className="h-full w-full object-cover"
                  spinnerClassName="rounded-none"
                />
                {coverFile && (
                  <div className="absolute right-2 top-2 flex h-16 w-16 items-center justify-center rounded-xl border border-white/70 bg-background/90 shadow-sm">
                    <LottieState
                      animation="photo-uploading"
                      label={t("placeForm.uploadPhoto")}
                      fallback="+"
                      className="h-14 w-14"
                    />
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                  <span className="text-xs font-medium text-white">{t("placeForm.changePhoto")}</span>
                </div>
              </>
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-muted to-border/60 flex flex-col items-center justify-center gap-1">
                <span className="text-4xl opacity-20">🍽</span>
                <span className="text-xs text-muted-foreground transition group-hover:text-primary/70">{t("placeForm.uploadPhoto")}</span>
              </div>
            )}
          </button>
          {preview && (
            <button
              type="button"
              onClick={() => { setCoverFile(null); setRemovedCover(true); clearPreview(); }}
              className="text-xs text-muted-foreground transition hover:text-destructive"
            >
              {t("placeForm.removePhoto")}
            </button>
          )}
          {coverPhotoError && <p className="text-sm text-destructive">{coverPhotoError}</p>}
        </div>
        </FormSection>

        {errors.root && <p className="text-sm text-destructive">{errors.root.message}</p>}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && (
            <LoadingSpinner className="mr-2 h-4 w-4" />
          )}
          {t("placeForm.save")}
        </Button>
      </form>
    </Form>
  );
}
