import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { authService } from "../services/auth.service";
import { Button } from "@/components/ui/button";
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
import { CharacterCount } from "../components/ui/CharacterCount";
import { TurnstileWidget } from "../components/auth/TurnstileWidget";
import { getApiErrorState } from "../services/api-errors";
import { applyApiErrors } from "../utils/form-errors";
import { Footer } from "../components/layout/Footer";
import { registerSchema, type RegisterFormValues } from "../schemas/auth";

export default function RegisterPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileError, setTurnstileError] = useState(false);
  const [turnstileReset, setTurnstileReset] = useState(0);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { website: "" },
    mode: "onChange",
  });

  const hasTurnstile = !!import.meta.env.VITE_TURNSTILE_SITE_KEY;

  const handleTurnstileToken = useCallback((token: string) => {
    setTurnstileError(false);
    setTurnstileToken(token);
  }, []);
  const handleTurnstileExpire = useCallback(() => setTurnstileToken(""), []);
  const handleTurnstileReady = useCallback(() => setTurnstileError(false), []);
  const handleTurnstileError = useCallback(() => {
    setTurnstileToken("");
    setTurnstileError(true);
  }, []);

  const onSubmit = async (data: RegisterFormValues) => {
    if (hasTurnstile && !turnstileToken) {
      form.setError("root", {
        message: t(turnstileError ? "auth.register.turnstileUnavailable" : "auth.register.turnstileRequired"),
      });
      return;
    }
    try {
      form.clearErrors("root");
      await authService.register({
        username: data.username,
        email: data.email,
        password: data.password,
        confirm_password: data.confirm_password,
        website: data.website,
        cf_turnstile_response: turnstileToken || undefined,
        terms_accepted: true,
      });
      nav("/login");
    } catch (error) {
      const apiError = getApiErrorState(error, t("auth.register.error"));
      form.setError("root", { message: apiError.message });
      applyApiErrors(form.setError, apiError.fieldErrors);
      setTurnstileReset((n) => n + 1);
      setTurnstileToken("");
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 max-w-sm w-full mx-auto p-6 mt-16 space-y-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <h1 className="font-fraunces text-3xl font-bold text-center text-foreground">
              {t("auth.register.title")}
            </h1>
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("auth.register.username")}</FormLabel>
                  <FormControl>
                    <Input maxLength={150} {...field} />
                  </FormControl>
                  <CharacterCount value={field.value} max={150} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("auth.register.email")}</FormLabel>
                  <FormControl>
                    <Input type="email" maxLength={254} {...field} />
                  </FormControl>
                  <CharacterCount value={field.value} max={254} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("auth.register.password")}</FormLabel>
                  <FormControl>
                    <PasswordInput {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirm_password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("auth.register.confirmPassword")}</FormLabel>
                  <FormControl>
                    <PasswordInput {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="hidden"
              {...form.register("website")}
            />
            <TurnstileWidget
              onToken={handleTurnstileToken}
              onExpire={handleTurnstileExpire}
              onReady={handleTurnstileReady}
              onError={handleTurnstileError}
              resetKey={turnstileReset}
            />
            <Controller
              name="terms_accepted"
              control={form.control}
              render={({ field }) => (
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!field.value}
                    onChange={(e) => {
                      field.onChange(e.target.checked || undefined);
                      if (e.target.checked) form.clearErrors("root");
                    }}
                    className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                  />
                  <span className="text-sm text-muted-foreground leading-snug">
                    {t("auth.register.termsAccept")}{" "}
                    <Link to="/termos-de-uso" target="_blank" className="text-primary font-medium hover:underline">
                      {t("auth.register.termsLink")}
                    </Link>{" "}
                    {t("auth.register.termsAnd")}{" "}
                    <Link to="/politica-de-privacidade" target="_blank" className="text-primary font-medium hover:underline">
                      {t("auth.register.privacyLink")}
                    </Link>
                  </span>
                </label>
              )}
            />
            {form.formState.errors.root && (
              <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={!form.formState.isValid || form.formState.isSubmitting}
            >
              {form.formState.isSubmitting && (
                <svg className="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {t("auth.register.submit")}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {t("auth.register.hasAccount")}{" "}
              <Link to="/login" className="text-primary font-medium">
                {t("auth.register.signIn")}
              </Link>
            </p>
          </form>
        </Form>
      </div>
      <Footer />
    </div>
  );
}
