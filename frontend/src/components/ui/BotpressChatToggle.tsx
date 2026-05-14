import { Bot, User } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

declare global {
  interface Window {
    botpressWebChat?: { sendEvent: (event: { type: string; [k: string]: unknown }) => void };
    botpress?: { open: () => void; close: () => void };
  }
}

type Mode = "ai" | "human";

export function BotpressChatToggle() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>("ai");

  const toggle = (next: Mode) => {
    setMode(next);
    if (window.botpressWebChat) {
      window.botpressWebChat.sendEvent({ type: "show" });
    } else if (window.botpress) {
      window.botpress.open();
    }
  };

  const options: { value: Mode; icon: React.ReactNode; label: string }[] = [
    { value: "ai", icon: <Bot className="h-4 w-4" />, label: t("chat.aiMode") },
    { value: "human", icon: <User className="h-4 w-4" />, label: t("chat.humanMode") },
  ];

  return (
    <div
      className="inline-flex rounded-xl border border-border bg-surface p-1 shadow-sm"
      role="group"
      aria-label={t("chat.toggleLabel")}
    >
      {options.map(({ value, icon, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => toggle(value)}
          aria-pressed={mode === value}
          aria-label={label}
          className={`flex items-center justify-center rounded-lg p-1.5 transition-colors duration-150 ${
            mode === value
              ? "bg-primary text-white shadow-sm"
              : "text-text hover:bg-background"
          }`}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}
