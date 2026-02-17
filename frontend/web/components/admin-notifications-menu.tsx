"use client";

import { Bell } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { useNotifications } from "@/components/notifications-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type AdminNotificationsMenuProps = {
  className?: string;
  align?: "start" | "center" | "end";
};

const formatNotificationDate = (value: string | undefined, language: string) => {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  const locale =
    language === "KZ" ? "kk-KZ" : language === "RU" ? "ru-RU" : "en-US";
  return parsed.toLocaleString(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const resolveNotificationText = (
  type: string | undefined,
  body: string | undefined,
  t: (key: string) => string,
) => {
  if (body) {
    return body;
  }
  const normalized = type?.trim().toLowerCase() ?? "";
  if (normalized === "message") {
    return t("notificationsTypeMessage");
  }
  if (normalized === "notify") {
    return t("notificationsTypeNotify");
  }
  return t("notificationsTypeDefault");
};

export function AdminNotificationsMenu({
  className,
  align = "end",
}: AdminNotificationsMenuProps) {
  const { language, t } = useLanguage();
  const {
    notifications,
    unreadCount,
    isLoading: notificationsLoading,
    refresh: refreshNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  const visibleNotifications = notifications.slice(0, 8);
  const unreadBadge = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-background text-foreground transition-all duration-300 hover:bg-foreground hover:text-background",
            className,
          )}
          aria-label={t("notificationsTitle")}
          title={t("notificationsTitle")}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 py-0.5 text-[10px] font-semibold text-background">
              {unreadBadge}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className="w-80 overflow-hidden p-0 shadow-none"
      >
        <div className="flex items-center justify-between px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {t("notificationsTitle")}
          </p>
          {unreadCount > 0 ? (
            <button
              type="button"
              onClick={() => void markAllAsRead()}
              className="text-xs font-semibold text-foreground/80 transition hover:text-foreground"
            >
              {t("notificationsMarkAllRead")}
            </button>
          ) : null}
        </div>
        <DropdownMenuSeparator />
        {notificationsLoading ? (
          <div className="px-3 py-4 text-sm text-muted-foreground">
            {t("notificationsLoading")}
          </div>
        ) : visibleNotifications.length === 0 ? (
          <div className="px-3 py-4 text-sm text-muted-foreground">
            {t("notificationsEmpty")}
          </div>
        ) : (
          <div className="max-h-72 overflow-y-auto">
            {visibleNotifications.map((notification) => {
              const isUnread = !notification.readAt;
              return (
                <DropdownMenuItem
                  key={notification.id}
                  className="flex items-start gap-2 py-3"
                  onSelect={(event) => {
                    event.preventDefault();
                    if (isUnread) {
                      void markAsRead(notification.id);
                    }
                  }}
                >
                  <span
                    className={cn(
                      "mt-1 h-2 w-2 shrink-0 rounded-full",
                      isUnread ? "bg-foreground" : "bg-muted-foreground/40",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-sm font-medium leading-snug">
                      {resolveNotificationText(
                        notification.type,
                        notification.body,
                        t,
                      )}
                    </span>
                    {notification.createdAt ? (
                      <span className="mt-1 block text-[11px] text-muted-foreground">
                        {formatNotificationDate(
                          notification.createdAt,
                          language,
                        )}
                      </span>
                    ) : null}
                  </span>
                </DropdownMenuItem>
              );
            })}
          </div>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            void refreshNotifications({ silent: true });
          }}
        >
          {t("notificationsRefresh")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
