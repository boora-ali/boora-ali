import { useContext } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DarkModeToggle } from "../ui/DarkModeToggle";
import { BotpressChatToggle } from "../ui/BotpressChatToggle";
import { AuthCtx } from "../../contexts/auth";

export function Footer() {
  const { t } = useTranslation();
  const user = useContext(AuthCtx)?.user ?? null;

  return (
    <footer className="border-t border-border py-4 px-4">
      <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-muted">
        {!user && <DarkModeToggle />}
        <BotpressChatToggle />
        <Link to="/termos-de-uso" className="hover:text-text transition-colors">
          {t("footer.terms")}
        </Link>
        <Link to="/politica-de-privacidade" className="hover:text-text transition-colors">
          {t("footer.privacy")}
        </Link>
        <a
          href="mailto:samuelviana.dev@gmail.com"
          className="hover:text-text transition-colors"
        >
          {t("footer.contact")}
        </a>
        <a
          href="https://www.linkedin.com/in/ssamuelsilva/"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-text transition-colors"
        >
          LinkedIn
        </a>
        <span className="text-xs">&copy; {new Date().getFullYear()} Bora Ali &mdash; {t("footer.rights")}</span>
      </div>
    </footer>
  );
}
