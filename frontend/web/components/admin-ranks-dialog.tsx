"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import {
  createRank,
  deleteRank,
  fetchRanksList,
  fetchRankPermissions,
  fetchRankUsers,
  updateRankPermission,
  updateRank,
  type ApiRankListItem,
  type ApiPermissions,
  type UserListItem,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

type AdminRanksDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type RankDraft = {
  name: string;
  description: string;
  color: string;
};

const toHexColor = (value?: number) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "";
  }
  const normalized = Math.max(0, Math.floor(value));
  return `#${normalized.toString(16).padStart(6, "0").slice(-6)}`;
};

const isValidHex = (value: string) => /^#[0-9a-fA-F]{6}$/.test(value);

const parseHexColor = (value: string) => {
  if (!isValidHex(value)) {
    return null;
  }
  return Number.parseInt(value.slice(1), 16);
};

type RankPanel = "details" | "permissions";

type PermissionEntry = {
  key: string;
  value: boolean;
};

const humanizePermissionPart = (value: string) =>
  value
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase();

const getPermissionLabel = (entry: PermissionEntry) => {
  const parts = entry.key.split(".");
  const labelParts = parts.length > 1 ? parts.slice(1) : parts;
  return labelParts.map(humanizePermissionPart).join(" / ");
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

const getUserInitials = (value: string) => {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "U";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

const normalizeRankName = (value?: string | null) =>
  value?.trim().toLowerCase() ?? "";

export function AdminRanksDialog({
  open,
  onOpenChange,
}: AdminRanksDialogProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [ranks, setRanks] = useState<ApiRankListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeId, setActiveId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<RankDraft>({
    name: "",
    description: "",
    color: "#64748b",
  });
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [panel, setPanel] = useState<RankPanel>("details");
  const [permissions, setPermissions] = useState<ApiPermissions | null>(null);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionsError, setPermissionsError] = useState<string | null>(null);
  const [permissionsUpdating, setPermissionsUpdating] = useState<Set<string>>(
    new Set(),
  );
  const [permissionsReloadKey, setPermissionsReloadKey] = useState(0);
  const [usersOpen, setUsersOpen] = useState(false);
  const [rankUsers, setRankUsers] = useState<UserListItem[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [usersReloadKey, setUsersReloadKey] = useState(0);

  useEffect(() => {
    if (open) {
      setPanel("details");
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetchRanksList({ signal: controller.signal })
      .then((data) => {
        if (!active) {
          return;
        }
        setRanks(data);
        setActiveId((prev) => {
          if (prev === "new") {
            return "new";
          }
          if (prev && data.some((rank) => rank.name === prev)) {
            return prev;
          }
          return data[0]?.name ?? "new";
        });
      })
      .catch((fetchError) => {
        if (!active) {
          return;
        }
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : t("adminUserSettingsRoleError"),
        );
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [open, reloadKey, t]);

  const activeRank = useMemo(
    () => ranks.find((rank) => rank.name === activeId) ?? null,
    [activeId, ranks],
  );
  const isCreating = !activeRank || activeId === "new";
  const requestorRankWeight = useMemo(() => {
    const requestorRank = normalizeRankName(user?.rank?.name);
    if (!requestorRank) {
      return null;
    }
    const requestorItem = ranks.find(
      (rank) => normalizeRankName(rank.name) === requestorRank,
    );
    return typeof requestorItem?.weight === "number"
      ? requestorItem.weight
      : null;
  }, [ranks, user?.rank?.name]);
  const canEditActiveRank = useMemo(() => {
    if (isCreating || !activeRank) {
      return true;
    }
    if (
      requestorRankWeight == null ||
      typeof activeRank.weight !== "number" ||
      !Number.isFinite(activeRank.weight)
    ) {
      return true;
    }
    return requestorRankWeight > activeRank.weight;
  }, [activeRank, isCreating, requestorRankWeight]);
  const detailsLocked = !isCreating && !canEditActiveRank;

  useEffect(() => {
    if (
      !open ||
      panel !== "permissions" ||
      !activeId ||
      activeId === "new" ||
      !canEditActiveRank
    ) {
      setPermissions(null);
      setPermissionsError(null);
      setPermissionsLoading(false);
      return;
    }
    let active = true;
    const controller = new AbortController();
    setPermissionsLoading(true);
    setPermissionsError(null);
    fetchRankPermissions(activeId, { signal: controller.signal })
      .then((data) => {
        if (active) {
          setPermissions(data ?? {});
        }
      })
      .catch((fetchError) => {
        if (active) {
          setPermissionsError(
            fetchError instanceof Error
              ? fetchError.message
              : t("adminRanksPermissionsError"),
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
  }, [activeId, canEditActiveRank, open, panel, permissionsReloadKey, t]);

  useEffect(() => {
    if (!usersOpen || !activeId || activeId === "new") {
      setRankUsers([]);
      setUsersError(null);
      setUsersLoading(false);
      return;
    }
    let active = true;
    const controller = new AbortController();
    setUsersLoading(true);
    setUsersError(null);
    fetchRankUsers(activeId, { signal: controller.signal })
      .then((data) => {
        if (active) {
          setRankUsers(data);
        }
      })
      .catch((fetchError) => {
        if (active) {
          setUsersError(
            fetchError instanceof Error
              ? fetchError.message
              : t("adminRanksUsersError"),
          );
        }
      })
      .finally(() => {
        if (active) {
          setUsersLoading(false);
        }
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [activeId, usersOpen, usersReloadKey, t]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (!activeId || activeId === "new") {
      setDraft({ name: "", description: "", color: "#64748b" });
      return;
    }
    const current = ranks.find((rank) => rank.name === activeId);
    if (!current) {
      return;
    }
    setDraft({
      name: current.name ?? "",
      description: current.description ?? "",
      color: toHexColor(current.color),
    });
  }, [activeId, open, ranks]);

  const previewColor = isValidHex(draft.color) ? draft.color : "#64748b";

  const hasChanges = useMemo(() => {
    if (isCreating) {
      return (
        draft.name.trim().length > 0 ||
        draft.description.trim().length > 0 ||
        draft.color.trim().length > 0
      );
    }
    if (!activeRank) {
      return false;
    }
    const originalColor = toHexColor(activeRank.color).toLowerCase();
    return (
      draft.name.trim() !== activeRank.name ||
      draft.description.trim() !== (activeRank.description ?? "") ||
      draft.color.trim().toLowerCase() !== originalColor
    );
  }, [activeRank, draft, isCreating]);

  const permissionEntries = useMemo(
    () => flattenPermissions(permissions ?? {}),
    [permissions],
  );
  const permissionGroups = useMemo(
    () => groupPermissions(permissionEntries),
    [permissionEntries],
  );
  const totalPermissions = permissionEntries.length;
  const activePermissions = permissionEntries.filter(
    (entry) => entry.value,
  ).length;

  const validateDraft = () => {
    const name = draft.name.trim();
    const description = draft.description.trim();
    if (!name) {
      toast.error(t("adminRanksNameRequired"));
      return null;
    }
    if (!description) {
      toast.error(t("adminRanksDescriptionRequired"));
      return null;
    }
    const colorValue = parseHexColor(draft.color.trim());
    if (colorValue === null || colorValue <= 0) {
      toast.error(t("adminRanksColorRequired"));
      return null;
    }
    return { name, description, colorValue };
  };

  const applyRankUpdate = (
    originalName: string,
    nextName: string,
    description: string,
    colorValue: number,
  ) => {
    setRanks((prev) =>
      prev.map((item) =>
        item.name === originalName
          ? { ...item, name: nextName, description, color: colorValue }
          : item,
      ),
    );
    setActiveId(nextName);
  };

  const handlePermissionToggle = async (entry: PermissionEntry) => {
    if (!activeId || permissionsUpdating.has(entry.key)) {
      return;
    }
    if (!canEditActiveRank) {
      toast.error(t("adminRanksEditDenied"));
      return;
    }
    const nextValue = !entry.value;
    setPermissionsUpdating((prev) => new Set(prev).add(entry.key));
    try {
      await updateRankPermission(activeId, entry.key, nextValue);
      setPermissions((prev) =>
        prev
          ? (updatePermissionValue(
              prev as Record<string, unknown>,
              entry.key.split("."),
              nextValue,
            ) as ApiPermissions)
          : prev,
      );
    } catch (permError) {
      toast.error(t("adminRanksPermissionsUpdateError"), {
        description: permError instanceof Error ? permError.message : undefined,
      });
    } finally {
      setPermissionsUpdating((prev) => {
        const next = new Set(prev);
        next.delete(entry.key);
        return next;
      });
    }
  };

  const handleSave = async () => {
    if (saving) {
      return;
    }
    if (detailsLocked) {
      toast.error(t("adminRanksEditDenied"));
      return;
    }
    const payload = validateDraft();
    if (!payload) {
      return;
    }
    if (
      isCreating &&
      ranks.some(
        (rank) => rank.name.toLowerCase() === payload.name.toLowerCase(),
      )
    ) {
      toast.error(t("adminRanksNameExists"));
      return;
    }
    if (
      !isCreating &&
      activeRank &&
      payload.name.toLowerCase() !== activeRank.name.toLowerCase() &&
      ranks.some(
        (rank) => rank.name.toLowerCase() === payload.name.toLowerCase(),
      )
    ) {
      toast.error(t("adminRanksNameExists"));
      return;
    }
    setSaving(true);
    try {
      if (isCreating || !activeRank) {
        await createRank({
          name: payload.name,
          description: payload.description,
          color: payload.colorValue,
        });
        setRanks((prev) => [
          {
            name: payload.name,
            description: payload.description,
            color: payload.colorValue,
          },
          ...prev.filter((item) => item.name !== payload.name),
        ]);
        setActiveId(payload.name);
        toast.success(t("adminRanksSaveSuccess"));
      } else {
        let currentName = activeRank.name;
        if (payload.name !== activeRank.name) {
          await updateRank(activeRank.name, "name", payload.name);
          currentName = payload.name;
        }
        if (payload.description !== (activeRank.description ?? "")) {
          await updateRank(currentName, "description", payload.description);
        }
        if (payload.colorValue !== activeRank.color) {
          await updateRank(currentName, "color", payload.colorValue);
        }
        applyRankUpdate(
          activeRank.name,
          currentName,
          payload.description,
          payload.colorValue,
        );
        toast.success(t("adminRanksSaveSuccess"));
      }
    } catch (saveError) {
      toast.error(t("adminRanksSaveError"), {
        description: saveError instanceof Error ? saveError.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!activeRank || deleting) {
      return;
    }
    if (!canEditActiveRank) {
      toast.error(t("adminRanksEditDenied"));
      return;
    }
    setDeleting(true);
    try {
      await deleteRank(activeRank.name);
      const nextRanks = ranks.filter((item) => item.name !== activeRank.name);
      setRanks(nextRanks);
      setActiveId((current) =>
        current === activeRank.name ? (nextRanks[0]?.name ?? "new") : current,
      );
      toast.success(t("adminRanksDeleteSuccess"));
      setDeleteOpen(false);
    } catch (deleteError) {
      toast.error(t("adminRanksDeleteError"), {
        description:
          deleteError instanceof Error ? deleteError.message : undefined,
      });
    } finally {
      setDeleting(false);
    }
  };

  const confirmDiscardChanges = () => {
    if (!hasChanges || saving || deleting) {
      return true;
    }
    if (typeof window === "undefined") {
      return true;
    }
    return window.confirm(t("adminRanksDiscardConfirm"));
  };

  const handleOpenUsers = () => {
    if (!activeId || activeId === "new") {
      toast.message(t("adminRanksUsersCreateHint"));
      return;
    }
    setUsersOpen(true);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !confirmDiscardChanges()) {
          return;
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="w-full sm:max-w-5xl overflow-hidden rounded-3xl border-border/70 bg-card/95 p-0 shadow-2xl">
        <DialogHeader className="border-b border-border/60 px-6 py-5">
          <DialogTitle className="text-lg font-semibold">
            {t("adminRanksDialogTitle")}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t("adminRanksDialogSubtitle")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 p-6 lg:grid-cols-[280px_1fr]">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                {t("adminRanksListTitle")}
              </p>
              <button
                type="button"
                onClick={() => {
                  if (!confirmDiscardChanges()) {
                    return;
                  }
                  setActiveId("new");
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-[11px] font-semibold transition hover:bg-foreground hover:text-background"
                disabled={saving || deleting}
              >
                <Plus className="h-3.5 w-3.5" />
                {t("adminRanksCreateAction")}
              </button>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-border/60 bg-background/70 p-3 text-sm text-muted-foreground">
                {t("adminUserSettingsRoleLoading")}
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-border/60 bg-background/70 p-3">
                <p className="text-sm text-destructive">
                  {t("adminUserSettingsRoleError")}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">{error}</p>
                <button
                  type="button"
                  onClick={() => setReloadKey((prev) => prev + 1)}
                  className="mt-3 rounded-full border border-border/70 px-3 py-1.5 text-xs font-semibold transition hover:bg-foreground hover:text-background"
                >
                  {t("adminUserSettingsRetry")}
                </button>
              </div>
            ) : ranks.length ? (
              <div className="space-y-2">
                {ranks.map((rank) => {
                  const isActive = rank.name === activeId;
                  return (
                    <button
                      key={rank.name}
                      type="button"
                      onClick={() => {
                        if (!confirmDiscardChanges()) {
                          return;
                        }
                        setActiveId(rank.name);
                      }}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-2xl border px-3 py-2 text-left transition",
                        isActive
                          ? "border-foreground bg-foreground text-background shadow-lg shadow-foreground/20"
                          : "border-border/60 bg-background/70 text-foreground hover:border-foreground/40",
                      )}
                      disabled={saving || deleting}
                    >
                      <span
                        className="mt-0.5 h-3 w-3 shrink-0 rounded-full border border-border/60"
                        style={{ backgroundColor: toHexColor(rank.color) }}
                      />
                      <span className="min-w-0">
                        <span className="block text-[13px] font-semibold">
                          {rank.name}
                        </span>
                        <span
                          className={cn(
                            "mt-1 block text-[11px]",
                            isActive
                              ? "text-background/70"
                              : "text-muted-foreground",
                          )}
                        >
                          {rank.description || t("adminRanksNoDescription")}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("adminUserSettingsRoleEmpty")}
              </p>
            )}
          </div>

          <div className="rounded-3xl border border-border/60 bg-background/70 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPanel("details")}
                  className={cn(
                    "rounded-full border px-3 py-1 text-[11px] font-semibold transition",
                    panel === "details"
                      ? "border-foreground bg-foreground text-background"
                      : "border-border/60 bg-background/70 text-muted-foreground hover:text-foreground",
                  )}
                  disabled={saving || deleting}
                >
                  {t("adminRanksDetailsTab")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!isCreating && !canEditActiveRank) {
                      toast.error(t("adminRanksEditDenied"));
                      return;
                    }
                    setPanel("permissions");
                  }}
                  className={cn(
                    "rounded-full border px-3 py-1 text-[11px] font-semibold transition",
                    panel === "permissions"
                      ? "border-foreground bg-foreground text-background"
                      : "border-border/60 bg-background/70 text-muted-foreground hover:text-foreground",
                  )}
                  disabled={saving || deleting}
                >
                  {t("adminRanksPermissionsTab")}
                </button>
              </div>
              <button
                type="button"
                onClick={handleOpenUsers}
                className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1 text-[11px] font-semibold transition hover:bg-foreground hover:text-background disabled:cursor-not-allowed disabled:opacity-60"
                disabled={saving || deleting}
              >
                <Users className="h-3.5 w-3.5" />
                {t("adminRanksUsersAction")}
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                  {isCreating
                    ? t("adminRanksCreateTitle")
                    : t("adminRanksEditTitle")}
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {isCreating ? t("adminRanksCreateAction") : activeRank?.name}
                </p>
              </div>
              <span className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                <span
                  className="h-3 w-3 rounded-full border border-border/60"
                  style={{ backgroundColor: previewColor }}
                />
                {draft.color || t("adminRanksColorAuto")}
              </span>
            </div>

            {panel === "details" ? (
              <>
                {detailsLocked ? (
                  <div className="mt-5 rounded-2xl border border-border/60 bg-background/70 p-3 text-sm text-muted-foreground">
                    {t("adminRanksEditDeniedHint")}
                  </div>
                ) : null}
                <div className="mt-5 space-y-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      {t("adminRanksNameLabel")}
                    </label>
                    <input
                      value={draft.name}
                      onChange={(event) =>
                        setDraft((prev) => ({
                          ...prev,
                          name: event.target.value,
                        }))
                      }
                      placeholder={t("adminRanksNamePlaceholder")}
                      className="mt-2 w-full rounded-2xl border border-border/60 bg-background px-3 py-2 text-sm"
                      disabled={saving || deleting || detailsLocked}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      {t("adminRanksDescriptionLabel")}
                    </label>
                    <textarea
                      value={draft.description}
                      onChange={(event) =>
                        setDraft((prev) => ({
                          ...prev,
                          description: event.target.value,
                        }))
                      }
                      placeholder={t("adminRanksDescriptionPlaceholder")}
                      rows={4}
                      className="mt-2 w-full rounded-2xl border border-border/60 bg-background px-3 py-2 text-sm"
                      disabled={saving || deleting || detailsLocked}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      {t("adminRanksColorLabel")}
                    </label>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <div
                        className="h-9 w-9 rounded-2xl border border-border/60"
                        style={{ backgroundColor: previewColor }}
                      />
                      <input
                        value={draft.color}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            color: event.target.value.trim(),
                          }))
                        }
                        placeholder={t("adminRanksColorPlaceholder")}
                        className="min-w-[140px] flex-1 rounded-2xl border border-border/60 bg-background px-3 py-2 text-sm"
                        disabled={saving || deleting || detailsLocked}
                      />
                      <input
                        type="color"
                        value={previewColor}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            color: event.target.value,
                          }))
                        }
                        className="h-9 w-12 cursor-pointer rounded-2xl border border-border/60 bg-background p-1"
                        disabled={saving || deleting || detailsLocked}
                      />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t("adminRanksColorHint")}
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
                  {!isCreating ? (
                    <button
                      type="button"
                      onClick={() => setDeleteOpen(true)}
                      className="inline-flex items-center gap-2 rounded-full border border-destructive/40 px-3 py-1.5 text-xs font-semibold text-destructive transition hover:bg-destructive hover:text-destructive-foreground"
                      disabled={saving || deleting || detailsLocked}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {t("adminRanksDelete")}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={
                      !hasChanges || saving || deleting || detailsLocked
                    }
                    className="rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition hover:shadow-lg hover:shadow-foreground/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? t("adminRanksSaving") : t("adminRanksSave")}
                  </button>
                </div>
              </>
            ) : (
              <div className="mt-5 space-y-4">
                {!isCreating && !canEditActiveRank ? (
                  <div className="rounded-2xl border border-border/60 bg-background/70 p-3 text-sm text-muted-foreground">
                    {t("adminRanksEditDeniedHint")}
                  </div>
                ) : null}
                {activeId === "new" ? (
                  <div className="rounded-2xl border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">
                    {t("adminRanksPermissionsCreateHint")}
                  </div>
                ) : !canEditActiveRank ? null : permissionsLoading ? (
                  <div className="rounded-2xl border border-border/60 bg-background/70 p-3 text-sm text-muted-foreground">
                    {t("adminRanksPermissionsLoading")}
                  </div>
                ) : permissionsError ? (
                  <div className="rounded-2xl border border-border/60 bg-background/70 p-3">
                    <p className="text-sm text-destructive">
                      {t("adminRanksPermissionsError")}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {permissionsError}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setPermissionsReloadKey((prev) => prev + 1)
                      }
                      className="mt-3 rounded-full border border-border/70 px-3 py-1.5 text-xs font-semibold transition hover:bg-foreground hover:text-background"
                    >
                      {t("adminUserSettingsRetry")}
                    </button>
                  </div>
                ) : permissionGroups.length ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground sm:text-xs">
                      <span className="rounded-full border border-border/60 bg-background/70 px-2.5 py-1 sm:px-3">
                        {t("labelTotal")}:{" "}
                        <span className="text-foreground">
                          {totalPermissions}
                        </span>
                      </span>
                      <span className="rounded-full border border-border/60 bg-background/70 px-2.5 py-1 sm:px-3">
                        {t("labelActive")}:{" "}
                        <span className="text-foreground">
                          {activePermissions}
                        </span>
                      </span>
                    </div>
                    <div className="max-h-[55vh] overflow-y-auto pr-2 sm:max-h-[60vh]">
                      <div className="space-y-4">
                        {permissionGroups.map((group) => {
                          const activeCount = group.items.filter(
                            (entry) => entry.value,
                          ).length;
                          return (
                            <div
                              key={group.key}
                              className="rounded-3xl border border-border/60 bg-background/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                            >
                              <div className="flex items-center justify-between gap-3 border-b border-border/60 px-3 py-2 sm:px-4 sm:py-3">
                                <div className="flex items-center gap-2">
                                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:text-xs">
                                    {group.key}
                                  </p>
                                  <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[9px] font-semibold text-muted-foreground sm:py-1 sm:text-[10px]">
                                    {group.items.length}
                                  </span>
                                </div>
                                <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[9px] font-semibold text-muted-foreground sm:py-1 sm:text-[10px]">
                                  {activeCount}/{group.items.length}
                                </span>
                              </div>
                              <div className="divide-y divide-border/60">
                                {group.items.map((entry) => (
                                  <div
                                    key={entry.key}
                                    className="flex items-start justify-between gap-3 px-3 py-2 transition hover:bg-muted/30 sm:gap-4 sm:px-4 sm:py-3"
                                  >
                                    <div className="min-w-0">
                                      <p className="break-words text-[13px] font-semibold sm:text-sm">
                                        {getPermissionLabel(entry)}
                                      </p>
                                      <p className="break-words text-[10px] text-muted-foreground/80 sm:text-[11px]">
                                        {entry.key}
                                      </p>
                                    </div>
                                    <Switch
                                      checked={entry.value}
                                      disabled={
                                        permissionsUpdating.has(entry.key) ||
                                        !canEditActiveRank
                                      }
                                      onCheckedChange={() =>
                                        void handlePermissionToggle(entry)
                                      }
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t("adminRanksPermissionsEmpty")}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("adminRanksDeleteTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("adminRanksDeleteHint")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>
                {t("adminDialogCancel")}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? t("adminRanksDeleting") : t("adminRanksDelete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Dialog open={usersOpen} onOpenChange={setUsersOpen}>
          <DialogContent className="max-w-3xl rounded-3xl border-border/70 bg-card/95">
            <DialogHeader>
              <DialogTitle>{t("adminRanksUsersTitle")}</DialogTitle>
              <DialogDescription>
                {activeId && activeId !== "new"
                  ? `${t("adminRanksUsersSubtitle")} ${activeId}`
                  : t("adminRanksUsersSubtitle")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {usersLoading ? (
                <div className="rounded-2xl border border-border/60 bg-background/70 p-3 text-sm text-muted-foreground">
                  {t("adminRanksUsersLoading")}
                </div>
              ) : usersError ? (
                <div className="rounded-2xl border border-border/60 bg-background/70 p-3">
                  <p className="text-sm text-destructive">
                    {t("adminRanksUsersError")}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {usersError}
                  </p>
                  <button
                    type="button"
                    onClick={() => setUsersReloadKey((prev) => prev + 1)}
                    className="mt-3 rounded-full border border-border/70 px-3 py-1.5 text-xs font-semibold transition hover:bg-foreground hover:text-background"
                  >
                    {t("adminUserSettingsRetry")}
                  </button>
                </div>
              ) : rankUsers.length ? (
                <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-2">
                  {rankUsers.map((userItem) => {
                    const label =
                      userItem.displayName || userItem.username || "User";
                    return (
                      <div
                        key={userItem.userID}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-sm"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-muted/40 text-xs font-semibold text-muted-foreground">
                            {getUserInitials(label)}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">
                              {label}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              @{userItem.username}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-1">
                            {userItem.rank?.name ?? t("labelUser")}
                          </span>
                          {userItem.banned ? (
                            <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2 py-1 text-destructive">
                              {t("statusBanned")}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("adminRanksUsersEmpty")}
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
