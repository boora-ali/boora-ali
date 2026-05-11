import { useState, type ChangeEvent } from "react";
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
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState(user?.profile_photo_url ?? "");
  const [profileMessage, setProfileMessage] = useState("");
  const [profilePhotoError, setProfilePhotoError] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");

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
  });

  const onPhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setPhoto(null);
      setPhotoPreview(user?.profile_photo_url ?? "");
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
    setPhotoPreview(URL.createObjectURL(file));
  };

  const onProfileSubmit = async (data: UpdateProfileFormValues) => {
    try {
      setProfileMessage("");
      const updatedUser = await authService.updateMe({
        username: data.username,
        email: data.email,
        display_name: data.display_name ?? "",
        nickname: data.nickname ?? "",
        ...(photo !== null && { profile_photo: photo }),
      });
      setUser(updatedUser);
      setPhoto(null);
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

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 pb-8">
      <BackButton fallbackTo="/places" />
      <div>
        <h1 className="font-fraunces text-3xl font-bold text-foreground">{t("account.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("account.subtitle")}</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Form {...profileForm}>
            <form className="space-y-4" onSubmit={profileForm.handleSubmit(onProfileSubmit)}>
              <div className="flex items-center gap-4">
                {photoPreview ? (
                  <AuthImage
                    src={photoPreview}
                    alt={t("account.photoAlt")}
                    className="h-20 w-20 rounded-2xl object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted text-sm font-semibold text-muted-foreground">
                    {t("common.photo")}
                  </div>
                )}
                <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-muted">
                  {t("account.profile.changePhoto")}
                  <input type="file" accept={ALLOWED_IMAGE_ACCEPT} className="sr-only" onChange={onPhotoChange} />
                </label>
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
                disabled={(!profileForm.formState.isDirty && !photo) || profileForm.formState.isSubmitting}
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
