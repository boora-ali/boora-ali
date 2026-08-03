import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../contexts/useAuth";
import { ImageWithSpinner } from "../ui/ImageWithSpinner";
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
    <div ref={menuRef} className="fixed right-4 top-4 z-40">
      <div className="inline-flex items-center border-[3px] border-foreground bg-surface shadow-[3px_3px_0_var(--color-shadow)]">
        <NotificationBell />
        <span className="h-6 w-px shrink-0 bg-border/60" aria-hidden="true" />
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="m-1 inline-flex h-9 min-w-9 items-center justify-center border-[3px] border-transparent px-1.5 text-sm font-semibold text-text transition hover:border-foreground hover:bg-background"
          aria-label={t("account.menu.open")}
          aria-expanded={open}
        >
        <ImageWithSpinner
          src={user?.profile_photo_url || undefined}
          alt={t("account.photoAlt")}
          wrapperClassName="h-8 w-8"
          className="h-8 w-8 object-cover"
          spinnerClassName="rounded-none"
          fallback={
            <img
              src="/bora-ali-mark.svg"
              alt="Boora Ali"
              className="h-8 w-8 select-none object-contain"
              draggable={false}
            />
          }
        />
        </button>
      </div>

      {open && (
        <div className="mt-2 w-72 border-[3px] border-foreground bg-surface p-3 shadow-[6px_6px_0_var(--color-shadow)]">
          <div className="flex items-center gap-3 border-b-[3px] border-foreground pb-3">
            <ImageWithSpinner
              src={user?.profile_photo_url || undefined}
              alt={t("account.photoAlt")}
              wrapperClassName="h-11 w-11"
              className="h-11 w-11 object-cover"
              spinnerClassName="rounded-none"
              fallback={
                <img
                  src="/bora-ali-mark.svg"
                  alt="Boora Ali"
                  className="h-11 w-11 select-none object-contain"
                  draggable={false}
                />
              }
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text">{displayName}</p>
              <p className="truncate text-xs text-muted">{user?.email}</p>
            </div>
          </div>

          <div className="space-y-2 py-3">
            <Link
              to="/account"
              onClick={() => setOpen(false)}
              className="block border-[3px] border-transparent px-3 py-2 text-sm font-medium text-text transition hover:border-foreground hover:bg-background"
            >
              {t("account.menu.account")}
            </Link>
            {pathname !== "/places/trash" && (
              <Link
                to="/places/trash"
                onClick={() => setOpen(false)}
                className="block border-[3px] border-transparent px-3 py-2 text-sm font-medium text-text transition hover:border-foreground hover:bg-background"
              >
                {t("account.menu.trash")}
              </Link>
            )}
            <div className="flex items-center justify-between gap-3 px-3">
              <span className="text-sm text-muted">{t("account.menu.language")}</span>
              <LanguageToggle />
            </div>
            <div className="flex items-center px-3">
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
            className="w-full border-[3px] border-foreground bg-surface px-3 py-2 text-sm font-medium text-text shadow-[3px_3px_0_var(--color-shadow)] transition-[transform,box-shadow,background-color] hover:translate-x-px hover:translate-y-px hover:bg-background hover:shadow-[2px_2px_0_var(--color-shadow)]"
          >
            {t("account.menu.logout")}
          </button>
        </div>
      )}
    </div>
  );
}
