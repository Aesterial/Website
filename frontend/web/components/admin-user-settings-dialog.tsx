"use client";

import { useEffect, useMemo, useState } from "react";
import { Shield, UserX, Users } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/components/language-provider";
import {
  fetchRanksList,
  fetchUserPermissions,
  updateUserPermission,
  type ApiRankListItem,
} from "@/lib/api";

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

type PermissionEntry = {
  key: string;
  value: boolean;
};

const flattenPermissions = (
  value: unknown,
  path: string[] = [],
): PermissionEntry[] => {
  if (typeof value === "boolean") {
    return [{ key: path.join("."), value }];
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }
  return Object.entries(value).flatMap(([key, entry]) =>
    flattenPermissions(entry, [...path, key]),
  );
};

const updatePermissionValue = (
  value: Record<string, unknown>,
  path: string[],
  nextValue: boolean,
): Record<string, unknown> => {
  const next = { ...value };
  let cursor: Record<string, unknown> = next;
  for (let i = 0; i < path.length - 1; i += 1) {
    const key = path[i];
    const current = cursor[key];
    if (current && typeof current === "object" && !Array.isArray(current)) {
      cursor[key] = { ...(current as Record<string, unknown>) };
    } else {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[path[path.length - 1]] = nextValue;
  return next;
};

const groupPermissions = (entries: PermissionEntry[]) => {
  const groups = new Map<string, PermissionEntry[]>();
  entries.forEach((entry) => {
    const groupKey = entry.key.split(".")[0] || "other";
    const list = groups.get(groupKey) ?? [];
    list.push(entry);
    groups.set(groupKey, list);
  });
  return Array.from(groups.entries())
    .map(([key, items]) => ({
      key,
      items: items.sort((a, b) => a.key.localeCompare(b.key)),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
};

export function AdminUserSettingsDialog({
  open,
  user,
  onOpenChange,
  onAction,
}: AdminUserSettingsDialogProps) {
  const { t } = useLanguage();
  const [section, setSection] = useState<SettingsSection>("permissions");
  const [permissions, setPermissions] = useState<Record<string, unknown> | null>(
    null,
  );
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionsError, setPermissionsError] = useState<string | null>(null);
  const [permissionsUpdating, setPermissionsUpdating] = useState<Set<string>>(
    new Set(),
  );
  const [permissionsReloadKey, setPermissionsReloadKey] = useState(0);

  const [ranks, setRanks] = useState<ApiRankListItem[]>([]);
  const [ranksLoading, setRanksLoading] = useState(false);
  const [ranksError, setRanksError] = useState<string | null>(null);
  const [ranksReloadKey, setRanksReloadKey] = useState(0);

  useEffect(() => {
    if (open) {
      setSection("permissions");
    }
  }, [open, user?.name]);

  useEffect(() => {
    if (!open || !user || section !== "permissions") {
      return;
    }
    let active = true;
    const controller = new AbortController();
    setPermissionsLoading(true);
    setPermissionsError(null);
    fetchUserPermissions(user.userID, { signal: controller.signal })
      .then((data) => {
        if (active) {
          setPermissions((data ?? {}) as Record<string, unknown>);
        }
      })
      .catch((error) => {
        if (active) {
          setPermissionsError(
            error instanceof Error
              ? error.message
              : t("adminUserSettingsPermissionsError"),
          );
        }
      })
      .finally(() => {
        if (active) {
          setPermissionsLoading(false);
        }
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [open, section, user?.userID, permissionsReloadKey, t]);

  useEffect(() => {
    if (!open || !user || section !== "role") {
      return;
    }
    let active = true;
    const controller = new AbortController();
    setRanksLoading(true);
    setRanksError(null);
    fetchRanksList({ signal: controller.signal })
      .then((data) => {
        if (active) {
          setRanks(data);
        }
      })
      .catch((error) => {
        if (active) {
          setRanksError(
            error instanceof Error
              ? error.message
              : t("adminUserSettingsRoleError"),
          );
        }
      })
      .finally(() => {
        if (active) {
          setRanksLoading(false);
        }
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [open, section, user?.userID, ranksReloadKey, t]);

  const permissionEntries = useMemo(
    () => flattenPermissions(permissions ?? {}),
    [permissions],
  );
  const permissionGroups = useMemo(
    () => groupPermissions(permissionEntries),
    [permissionEntries],
  );

  const handlePermissionToggle = async (entry: PermissionEntry) => {
    if (!user || permissionsUpdating.has(entry.key)) {
      return;
    }
    const nextValue = !entry.value;
    setPermissionsUpdating((prev) => new Set(prev).add(entry.key));
    try {
      await updateUserPermission(user.userID, entry.key, nextValue);
      setPermissions((prev) =>
        prev
          ? updatePermissionValue(prev, entry.key.split("."), nextValue)
          : prev,
      );
    } catch (error) {
      toast.error(t("adminUserSettingsPermissionsUpdateError"), {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setPermissionsUpdating((prev) => {
        const next = new Set(prev);
        next.delete(entry.key);
        return next;
      });
    }
  };

  const sections = useMemo(
    () => [
      {
        id: "permissions" as const,
        label: t("adminUserSettingsPermissions"),
        hint: t("adminUserSettingsPermissionsHint"),
        icon: Shield,
      },
      {
        id: "role" as const,
        label: t("adminUserSettingsRole"),
        hint: t("adminUserSettingsRoleHint"),
        icon: Users,
      },
      {
        id: "profile" as const,
        label: t("adminUserSettingsProfile"),
        hint: t("adminUserSettingsProfileHint"),
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

            {section === "permissions" ? (
              <div className="mt-4 space-y-4">
                {permissionsLoading ? (
                  <p className="text-sm text-muted-foreground">
                    {t("adminUserSettingsPermissionsLoading")}
                  </p>
                ) : permissionsError ? (
                  <div className="rounded-2xl border border-border/60 bg-background/80 p-4">
                    <p className="text-sm text-destructive">
                      {t("adminUserSettingsPermissionsError")}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {permissionsError}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setPermissionsReloadKey((prev) => prev + 1)
                      }
                      className="mt-3 rounded-full border border-border/70 px-4 py-2 text-xs font-semibold transition hover:bg-foreground hover:text-background"
                    >
                      {t("adminUserSettingsRetry")}
                    </button>
                  </div>
                ) : permissionGroups.length ? (
                  <div className="space-y-4">
                    {permissionGroups.map((group) => (
                      <div
                        key={group.key}
                        className="rounded-2xl border border-border/60 bg-background/80 p-4"
                      >
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          {group.key}
                        </p>
                        <div className="mt-3 space-y-3">
                          {group.items.map((entry) => (
                            <div
                              key={entry.key}
                              className="flex flex-wrap items-center justify-between gap-3"
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-semibold break-words">
                                  {entry.key}
                                </p>
                              </div>
                              <Switch
                                checked={entry.value}
                                disabled={permissionsUpdating.has(entry.key)}
                                onCheckedChange={() =>
                                  void handlePermissionToggle(entry)
                                }
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t("adminUserSettingsPermissionsEmpty")}
                  </p>
                )}
              </div>
            ) : null}

            {section === "role" ? (
              <div className="mt-4 space-y-4">
                {ranksLoading ? (
                  <p className="text-sm text-muted-foreground">
                    {t("adminUserSettingsRoleLoading")}
                  </p>
                ) : ranksError ? (
                  <div className="rounded-2xl border border-border/60 bg-background/80 p-4">
                    <p className="text-sm text-destructive">
                      {t("adminUserSettingsRoleError")}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {ranksError}
                    </p>
                    <button
                      type="button"
                      onClick={() => setRanksReloadKey((prev) => prev + 1)}
                      className="mt-3 rounded-full border border-border/70 px-4 py-2 text-xs font-semibold transition hover:bg-foreground hover:text-background"
                    >
                      {t("adminUserSettingsRetry")}
                    </button>
                  </div>
                ) : ranks.length ? (
                  <div className="space-y-3">
                    {ranks.map((rank) => {
                      const isCurrent = rank.name === user.role;
                      return (
                        <div
                          key={rank.name}
                          className={`rounded-2xl border p-4 text-sm transition ${
                            isCurrent
                              ? "border-foreground bg-foreground text-background"
                              : "border-border/60 bg-background/80 text-foreground"
                          }`}
                        >
                          <p className="font-semibold">{rank.name}</p>
                          {rank.description ? (
                            <p
                              className={`mt-1 text-xs ${
                                isCurrent
                                  ? "text-background/80"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {rank.description}
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t("adminUserSettingsRoleEmpty")}
                  </p>
                )}

                <p className="text-xs text-muted-foreground">
                  {t("adminUserSettingsRoleUnavailable")}
                </p>
              </div>
            ) : null}

            {section === "profile" ? (
              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => onAction?.("profile", user)}
                  className="rounded-full bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground transition hover:opacity-90"
                >
                  {t("adminUserSettingsProfileAction")}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
