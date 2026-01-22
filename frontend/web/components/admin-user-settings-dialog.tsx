"use client";

import { useEffect, useMemo, useState } from "react";
import { Shield, UserX, Users } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useLanguage } from "@/components/language-provider";

export type AdminUserSettingsTarget = {
  userID: number;
  name: string;
  username?: string;
  role?: string;
};

type SettingsSection = "permissions" | "role" | "profile";

type AdminUserSettingsDialogProps = {
  open: boolean;
  user: AdminUserSettingsTarget | null;
  onOpenChange: (open: boolean) => void;
  onAction?: (action: SettingsSection, user: AdminUserSettingsTarget) => void;
};

export function AdminUserSettingsDialog({
  open,
  user,
  onOpenChange,
  onAction,
}: AdminUserSettingsDialogProps) {
  const { t } = useLanguage();
  const [section, setSection] = useState<SettingsSection>("permissions");

  useEffect(() => {
    if (open) {
      setSection("permissions");
    }
  }, [open, user?.name]);

  const sections = useMemo(
    () => [
      {
        id: "permissions" as const,
        label: t("adminUserSettingsPermissions"),
        hint: t("adminUserSettingsPermissionsHint"),
        actionLabel: t("adminUserSettingsPermissionsAction"),
        icon: Shield,
      },
      {
        id: "role" as const,
        label: t("adminUserSettingsRole"),
        hint: t("adminUserSettingsRoleHint"),
        actionLabel: t("adminUserSettingsRoleAction"),
        icon: Users,
      },
      {
        id: "profile" as const,
        label: t("adminUserSettingsProfile"),
        hint: t("adminUserSettingsProfileHint"),
        actionLabel: t("adminUserSettingsProfileAction"),
        icon: UserX,
      },
    ],
    [t],
  );

  const activeSection =
    sections.find((item) => item.id === section) ?? sections[0];

  if (!user) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl overflow-hidden p-0">
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr]">
          <div className="border-b border-border/60 bg-muted/30 p-4 md:border-b-0 md:border-r">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
              {t("adminUserSettingsTitle")}
            </p>
            <div className="mt-4 space-y-1">
              {sections.map((item) => {
                const isActive = item.id === section;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSection(item.id)}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm font-semibold transition ${
                      isActive
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  {activeSection.label}
                </p>
                <p className="text-lg font-semibold">{user.name}</p>
                {user.username ? (
                  <p className="text-xs text-muted-foreground">
                    @{user.username}
                  </p>
                ) : null}
              </div>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              {activeSection.hint}
            </p>

            {section === "role" && user.role ? (
              <div className="mt-4 rounded-2xl border border-border/60 bg-background/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  {t("labelRole")}
                </p>
                <p className="mt-2 text-sm font-semibold">{user.role}</p>
              </div>
            ) : null}

            <div className="mt-6">
              <button
                type="button"
                onClick={() => onAction?.(section, user)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  section === "profile"
                    ? "bg-destructive text-destructive-foreground hover:opacity-90"
                    : "bg-foreground text-background hover:opacity-90"
                }`}
              >
                {activeSection.actionLabel}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
