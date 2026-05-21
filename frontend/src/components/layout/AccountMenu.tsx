import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../contexts/useAuth";
import { AuthImage } from "../ui/AuthImage";
import { LanguageToggle } from "../ui/LanguageToggle";
import { DarkModeToggle } from "../ui/DarkModeToggle";
import { NotificationBell } from "./NotificationBell";

export function AccountMenu() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const displayName = user?.display_name || user?.nickname || user?.username || t("account.menu.account");

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  if (pathname === "/account") return null;

  return (
    <div ref={menuRef} className="fixed right-4 top-4 z-40 flex items-center gap-2">
      <NotificationBell />
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-11 min-w-11 items-center justify-center rounded-xl border border-border bg-surface px-2 text-sm font-semibold text-text shadow-sm transition hover:border-muted/50 hover:bg-background"
        aria-label={t("account.menu.open")}
        aria-expanded={open}
      >
        {user?.profile_photo_url ? (
          <AuthImage
            src={user.profile_photo_url}
            alt={t("account.photoAlt")}
            className="h-8 w-8 rounded-lg object-cover"
          />
        ) : (
          <img
            src="/bora-ali-mark.svg"
            alt="Bora Ali"
            className="h-8 w-8 select-none object-contain"
            draggable={false}
          />
        )}
      </button>

      {open && (
        <div className="mt-2 w-72 rounded-2xl border border-border bg-surface p-3 shadow-lg">
          <div className="flex items-center gap-3 border-b border-border pb-3">
            {user?.profile_photo_url ? (
              <AuthImage
                src={user.profile_photo_url}
                alt={t("account.photoAlt")}
                className="h-11 w-11 rounded-xl object-cover"
              />
            ) : (
              <img
                src="/bora-ali-mark.svg"
                alt="Bora Ali"
                className="h-11 w-11 select-none object-contain"
                draggable={false}
              />
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text">{displayName}</p>
              <p className="truncate text-xs text-muted">{user?.email}</p>
            </div>
          </div>

          <div className="space-y-2 py-3">
            {pathname !== "/account" && (
              <Link
                to="/account"
                onClick={() => setOpen(false)}
                className="block rounded-xl px-3 py-2 text-sm font-medium text-text transition hover:bg-background"
              >
                {t("account.menu.account")}
              </Link>
            )}
            {pathname !== "/places/trash" && (
              <Link
                to="/places/trash"
                onClick={() => setOpen(false)}
                className="block rounded-xl px-3 py-2 text-sm font-medium text-text transition hover:bg-background"
              >
                {t("account.menu.trash")}
              </Link>
            )}
            <div className="flex items-center justify-between gap-3 px-3">
              <span className="text-sm text-muted">{t("account.menu.language")}</span>
              <LanguageToggle />
            </div>
            <div className="flex items-center justify-between gap-3 px-3">
              <span className="text-sm text-muted">{t("darkMode.label")}</span>
              <DarkModeToggle />
            </div>
          </div>

          <button
            type="button"
            onClick={async () => {
              setOpen(false);
              await logout();
              navigate("/login", { replace: true });
            }}
            className="w-full rounded-xl border border-border px-3 py-2 text-sm font-medium text-text transition hover:border-muted/50 hover:bg-background"
          >
            {t("account.menu.logout")}
          </button>
        </div>
      )}
    </div>
  );
}
