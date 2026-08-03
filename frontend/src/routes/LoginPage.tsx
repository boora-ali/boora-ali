import { useCallback, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";
import { useAuth } from "../contexts/useAuth";
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
import { LanguageToggle } from "../components/ui/LanguageToggle";
import { GoogleSignInButton } from "../components/auth/GoogleSignInButton";
import { TurnstileWidget } from "../components/auth/TurnstileWidget";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { LottieState } from "../components/ui/LottieState";
import { reportApiError } from "../utils/form-api-error";
import { SESSION_INVALIDATED_KEY } from "../utils/constants";
import { Footer } from "../components/layout/Footer";
import { loginSchema, type LoginFormValues } from "../schemas/auth";
import "./AuthPage.css";

export default function LoginPage() {
  const { t } = useTranslation();
  const { login, googleLogin } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileError, setTurnstileError] = useState(false);
  const [turnstileReset, setTurnstileReset] = useState(0);
  const showEmailSentMessage = (location.state as { emailSent?: boolean } | null)?.emailSent === true;
  const [showSessionMessage] = useState(() => {
    if (localStorage.getItem(SESSION_INVALIDATED_KEY)) {
      localStorage.removeItem(SESSION_INVALIDATED_KEY);
      return true;
    }
    return false;
  });

  const form = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

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

  const hasTurnstile = !!import.meta.env.VITE_TURNSTILE_SITE_KEY;

  const onSubmit = async (data: LoginFormValues) => {
    if (hasTurnstile && !turnstileToken && !turnstileError) {
      toast.error(t("auth.login.turnstileRequired"));
      form.setError("root", { message: t("auth.login.turnstileRequired") });
      return;
    }
    try {
      form.clearErrors("root");
      await login(data.username, data.password, turnstileToken || undefined);
      nav("/places");
    } catch (error) {
      reportApiError({
        setError: form.setError,
        error,
        fallbackMessage: t("auth.login.error"),
        mapMessage: (apiError) =>
          apiError.code === "email_not_verified"
            ? t("auth.login.emailNotVerified")
            : apiError.message,
      });
      setTurnstileReset((n) => n + 1);
      setTurnstileToken("");
    }
  };

  return (
    <div className="auth-page">
      <Helmet>
        <title>Boora Ali — Entre na sua conta</title>
        <meta name="description" content="Acesse seu diário de lugares e experiências. Salve e reviva memórias dos lugares que você visitou." />
        <link rel="canonical" href="https://booraali.com.br/login" />
      </Helmet>
      <main className="auth-page__main">
        <aside className="auth-page__aside">
          <Link to="/" className="auth-page__brand">
            Boora Ali
          </Link>
          <LottieState
            animation="login-pin"
            label="Boora Ali"
            className="auth-page__hero-mark"
          />
          <div className="auth-page__aside-copy">
            <p className="auth-page__eyebrow">BORA ALI / ENTRAR</p>
            <h2>{t("auth.login.title")}</h2>
            <p>{t("auth.login.subtitle")}</p>
          </div>
        </aside>
        <section className="auth-page__form-area" aria-labelledby="login-title">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="auth-page__form space-y-5">
              <div className="auth-page__title-row">
                <h1 id="login-title" className="auth-page__title">{t("auth.login.title")}</h1>
                <LottieState
                  animation="login-pin"
                  label="Boora Ali"
                  className="auth-page__title-mark"
                />
              </div>
              <p className="auth-page__subtitle">{t("auth.login.subtitle")}</p>
            {showEmailSentMessage && (
              <div className="auth-page__notice auth-page__notice--info">
                {t("auth.login.emailSent")}
              </div>
            )}
            {showSessionMessage && (
              <div className="auth-page__notice auth-page__notice--warning">
                {t("auth.login.sessionExpired")}
              </div>
            )}
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("auth.login.username")}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("auth.login.password")}</FormLabel>
                  <FormControl>
                    <PasswordInput {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <TurnstileWidget
              onToken={handleTurnstileToken}
              onExpire={handleTurnstileExpire}
              onReady={handleTurnstileReady}
              onError={handleTurnstileError}
              resetKey={turnstileReset}
            />
            {form.formState.errors.root && (
              <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
            )}
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && (
                <LoadingSpinner className="mr-2 h-4 w-4" />
              )}
              {t("auth.login.submit")}
            </Button>
            <GoogleSignInButton
              onSuccess={async (idToken) => {
                try {
                  form.clearErrors("root");
                  await googleLogin(idToken);
                  nav("/places");
                } catch (error) {
                  reportApiError({
                    setError: form.setError,
                    error,
                    fallbackMessage: t("auth.login.googleError"),
                  });
                }
              }}
            />
            <p className="text-center text-sm text-muted-foreground">
              {t("auth.login.noAccount")}{" "}
              <Link to="/register" className="font-semibold text-primary">
                {t("auth.login.register")}
              </Link>
            </p>
            <div className="flex justify-center pt-1">
              <LanguageToggle />
            </div>
            </form>
          </Form>
        </section>
      </main>
      <Footer />
    </div>
  );
}
