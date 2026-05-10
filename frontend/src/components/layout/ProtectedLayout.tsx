import { type ReactNode } from "react";
import { AccountMenu } from "./AccountMenu";
import { Footer } from "./Footer";
import { TermsAcceptModal } from "../auth/TermsAcceptModal";
import { useAuth } from "../../contexts/useAuth";
import { PwaInstallButton } from "./PwaInstallButton";

export function ProtectedLayout({ children }: { children: ReactNode }) {
  const { user, refreshUser } = useAuth();
  const needsTerms = user !== null && user.terms_accepted_at === null;

  return (
    <div className="min-h-screen flex flex-col pt-16">
      <PwaInstallButton />
      <AccountMenu />
      <div className="flex-1">
        {children}
      </div>
      <Footer />
      {needsTerms && (
        <TermsAcceptModal onAccepted={refreshUser} />
      )}
    </div>
  );
}
