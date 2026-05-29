import { Bell } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNotifications } from "../../hooks/useNotifications";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NotificationBellProps {
  triggerClassName?: string;
}

export function NotificationBell({ triggerClassName }: NotificationBellProps) {
  const { t } = useTranslation();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className={cn("relative h-10 w-10 rounded-xl hover:bg-background", triggerClassName)}>
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-medium text-text">{t("notifications.title")}</span>
          {unreadCount > 0 && (
            <button
              type="button"
              className="text-xs text-muted-foreground transition hover:text-foreground"
              onClick={markAllRead}
            >
              {t("notifications.markAllRead")}
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              {t("notifications.empty")}
            </p>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                className="w-full cursor-pointer border-b border-border px-4 py-3 text-left transition hover:bg-muted/50"
                onClick={() => markRead(n.id)}
              >
                <p className="text-sm font-medium text-text">{n.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
