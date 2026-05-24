import { useEffect, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { authService } from "../services/auth.service";
import { getApiErrorState } from "../services/api-errors";
import { applyApiErrors } from "../utils/form-errors";
import { validateImageFile, ALLOWED_IMAGE_ACCEPT } from "../utils/url";
import { useAuth } from "../contexts/useAuth";
import { BackButton } from "../components/ui/BackButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { PasswordInput } from "../components/ui/PasswordInput";
import { AuthImage } from "../components/ui/AuthImage";
import { CharacterCount } from "../components/ui/CharacterCount";
import { Label } from "@/components/ui/label";
import { PwaInstallButton } from "../components/layout/PwaInstallButton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  updateProfileSchema,
  changePasswordSchema,
  type UpdateProfileFormValues,
  type ChangePasswordFormValues,
} from "../schemas/auth";

export default function AccountPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, setUser, logout } = useAuth();
  const [photoObjectUrl, setPhotoObjectUrl] = useState<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState(user?.profile_photo_url ?? "");
  const [removedPhoto, setRemovedPhoto] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [profilePhotoError, setProfilePhotoError] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleteRequested, setDeleteRequested] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");

  const profileForm = useForm<UpdateProfileFormValues>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      username: user?.username ?? "",
      email: user?.email ?? "",
      display_name: user?.display_name ?? "",
      nickname: user?.nickname ?? "",
    },
  });

  const passwordForm = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      current_password: "",
      new_password: "",
      confirm_password: "",
    },
  });

  useEffect(() => {
    return () => {
      if (photoObjectUrl) {
        URL.revokeObjectURL(photoObjectUrl);
      }
    };
  }, [photoObjectUrl]);

  function setPhotoPreviewFromFile(file: File) {
    const objectUrl = URL.createObjectURL(file);
    setPhotoObjectUrl(objectUrl);
    setPhotoPreview(objectUrl);
  }

  function clearPhotoObjectUrl() {
    setPhotoObjectUrl(null);
  }

  const onPhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setPhoto(null);
      clearPhotoObjectUrl();
      setPhotoPreview(user?.profile_photo_url ?? "");
      setRemovedPhoto(false);
      return;
    }
    const err = validateImageFile(file);
    if (err === "type") {
      toast.error(t("upload.invalidType"));
      setProfilePhotoError(t("upload.invalidType"));
      event.target.value = "";
      return;
    }
    if (err === "size") {
      toast.error(t("upload.tooLarge"));
      setProfilePhotoError(t("upload.tooLarge"));
      event.target.value = "";
      return;
    }
    setProfilePhotoError("");
    setPhoto(file);
    setRemovedPhoto(false);
    setPhotoPreviewFromFile(file);
  };

  const onProfileSubmit = async (data: UpdateProfileFormValues) => {
    try {
      setProfileMessage("");
      const updatedUser = await authService.updateMe({
        username: data.username,
        email: data.email,
        display_name: data.display_name ?? "",
        nickname: data.nickname ?? "",
        ...(photo !== null ? { profile_photo: photo } : removedPhoto ? { profile_photo: null } : {}),
      });
      setUser(updatedUser);
      setPhoto(null);
      clearPhotoObjectUrl();
      setRemovedPhoto(false);
      setPhotoPreview(updatedUser.profile_photo_url);
      setProfileMessage(t("account.profile.saved"));
      profileForm.reset({
        username: updatedUser.username,
        email: updatedUser.email,
        display_name: updatedUser.display_name ?? "",
        nickname: updatedUser.nickname ?? "",
      });
    } catch (error) {
      const apiError = getApiErrorState(error, t("account.profile.error"));
      toast.error(apiError.message);
      profileForm.setError("root", { message: apiError.message });
      applyApiErrors(profileForm.setError, apiError.fieldErrors);
    }
  };

  const onPasswordSubmit = async (data: ChangePasswordFormValues) => {
    try {
      setPasswordMessage("");
      await authService.changePassword({
        current_password: data.current_password,
        new_password: data.new_password,
        confirm_password: data.confirm_password,
      });
      passwordForm.reset();
      setPasswordMessage(t("account.password.saved"));
    } catch (error) {
      const apiError = getApiErrorState(error, t("account.password.error"));
      toast.error(apiError.message);
      passwordForm.setError("root", { message: apiError.message });
      applyApiErrors(passwordForm.setError, apiError.fieldErrors);
    }
  };

  async function onDeleteAccount() {
    setIsDeleting(true);
    setDeleteError("");
    try {
      await authService.deleteAccount(user?.is_google_account ? undefined : { password: deletePassword });
      setDeleteRequested(true);
      setShowDeleteDialog(false);
      setDeletePassword("");
    } catch {
      setDeleteError(t("account.delete.error"));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 pb-8">
      <BackButton fallbackTo="/places" />
      <div>
        <h1 className="font-fraunces text-3xl font-bold text-foreground">{t("account.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("account.subtitle")}</p>
      </div>

      <PwaInstallButton variant="inline" />

      <Card>
        <CardContent className="pt-6">
          <Form {...profileForm}>
            <form className="space-y-4" onSubmit={profileForm.handleSubmit(onProfileSubmit)}>
              <div className="space-y-2">
                <Label>{t("account.profile.photo")}</Label>
                <Label className="group relative flex h-44 w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-background text-muted-foreground transition hover:border-primary/40 hover:text-primary sm:h-56">
                  {photoPreview ? (
                    <>
                      <AuthImage
                        src={photoPreview}
                        alt={t("account.photoAlt")}
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                        <span className="rounded-xl border border-white/30 bg-black/50 px-4 py-2 text-sm font-medium text-white">
                          {t("account.profile.changePhoto")}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1">
                      <span className="text-2xl leading-none">+</span>
                      <span className="text-xs">{t("account.profile.changePhoto")}</span>
                    </div>
                  )}
                  <input type="file" accept={ALLOWED_IMAGE_ACCEPT} className="sr-only" onChange={onPhotoChange} />
                </Label>
                {photoPreview && (
                  <button
                    type="button"
                    onClick={() => {
                      setPhoto(null);
                      clearPhotoObjectUrl();
                      setRemovedPhoto(true);
                      setPhotoPreview("");
                    }}
                    className="text-xs text-muted-foreground transition hover:text-destructive"
                  >
                    {t("account.profile.removePhoto")}
                  </button>
                )}
              </div>
              {profilePhotoError && <p className="text-sm text-destructive">{profilePhotoError}</p>}

              <FormField
                control={profileForm.control}
                name="display_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("account.profile.name")}</FormLabel>
                    <FormControl>
                      <Input maxLength={150} {...field} />
                    </FormControl>
                    <CharacterCount value={field.value} max={150} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={profileForm.control}
                name="nickname"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("account.profile.nickname")}</FormLabel>
                    <FormControl>
                      <Input maxLength={80} {...field} />
                    </FormControl>
                    <CharacterCount value={field.value} max={80} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={profileForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("account.profile.username")}</FormLabel>
                    <FormControl>
                      <Input maxLength={150} {...field} />
                    </FormControl>
                    <CharacterCount value={field.value} max={150} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={profileForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("account.profile.email")}</FormLabel>
                    <FormControl>
                      <Input type="email" maxLength={254} {...field} />
                    </FormControl>
                    <CharacterCount value={field.value} max={254} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              {profileMessage && <p className="text-sm font-medium text-primary">{profileMessage}</p>}
              {profileForm.formState.errors.root && (
                <p className="text-sm text-destructive">{profileForm.formState.errors.root.message}</p>
              )}
              <Button
                type="submit"
                className="w-full sm:w-auto"
                disabled={(!profileForm.formState.isDirty && !photo && !removedPhoto) || profileForm.formState.isSubmitting}
              >
                {profileForm.formState.isSubmitting && (
                  <svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {t("account.profile.save")}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {!user?.is_google_account && (
        <Card>
          <CardContent className="pt-6">
            <Form {...passwordForm}>
              <form className="space-y-4" onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}>
                <h2 className="text-lg font-semibold text-foreground">{t("account.password.title")}</h2>
                <FormField
                  control={passwordForm.control}
                  name="current_password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("account.password.current")}</FormLabel>
                      <FormControl>
                        <PasswordInput {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="new_password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("account.password.next")}</FormLabel>
                      <FormControl>
                        <PasswordInput {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="confirm_password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("account.password.confirm")}</FormLabel>
                      <FormControl>
                        <PasswordInput {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {passwordMessage && <p className="text-sm font-medium text-primary">{passwordMessage}</p>}
                {passwordForm.formState.errors.root && (
                  <p className="text-sm text-destructive">{passwordForm.formState.errors.root.message}</p>
                )}
                <Button
                  type="submit"
                  variant="secondary"
                  className="w-full sm:w-auto"
                  disabled={passwordForm.formState.isSubmitting}
                >
                  {t("account.password.save")}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      <Card className="border-destructive/40">
        <CardContent className="pt-6">
          <div className="space-y-2">
            <h3 className="font-medium text-destructive">{t("account.delete.title")}</h3>
            <p className="text-sm text-muted-foreground">{t("account.delete.description")}</p>
            <p className="text-xs text-muted-foreground">{t("account.delete.grace")}</p>
            {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
            {deleteRequested ? (
              <p className="text-sm font-medium text-primary">{t("account.delete.scheduled")}</p>
            ) : (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
              >
                {t("account.delete.button")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showDeleteDialog} onOpenChange={(open) => { if (!open) setShowDeleteDialog(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("account.delete.confirm.title")}</DialogTitle>
            <DialogDescription>{t("account.delete.confirm.description")}</DialogDescription>
          </DialogHeader>
          {!user?.is_google_account && (
            <div className="space-y-2">
              <Label htmlFor="delete-account-password">{t("account.delete.confirm.password")}</Label>
              <PasswordInput
                id="delete-account-password"
                value={deletePassword}
                onChange={(event) => setDeletePassword(event.target.value)}
                autoComplete="current-password"
              />
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="secondary" disabled={isDeleting} onClick={() => setShowDeleteDialog(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={isDeleting || (!user?.is_google_account && !deletePassword)}
              onClick={onDeleteAccount}
            >
              {isDeleting ? t("account.delete.deleting") : t("account.delete.confirm.action")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Button
        type="button"
        variant="destructive"
        onClick={async () => {
          await logout();
          navigate("/login", { replace: true });
        }}
        className="w-full sm:w-auto"
      >
        {t("account.menu.logout")}
      </Button>
    </div>
  );
}
