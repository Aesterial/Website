"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/logo";
import { useTheme } from "@/components/theme-provider";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { AdminRanksDialog } from "@/components/admin-ranks-dialog";
import {
  AdminUserSettingsDialog,
  type AdminUserSettingsTarget,
} from "@/components/admin-user-settings-dialog";
import {
  banUser,
  deleteUserAvatar,
  deleteUserDescription,
  deleteUserProfile,
  fetchUserBanInfo,
  fetchUsers,
  unbanUser,
  type BanInfo,
  type ApiAvatar,
} from "@/lib/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Ban,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Globe,
  LogOut,
  MessageSquare,
  Moon,
  Settings,
  Search,
  Sun,
  Users,
} from "lucide-react";

type UserStatus = "active" | "banned";

type User = {
  id: string;
  userID: number;
  name: string;
  username: string;
  email: string;
  role: string;
  status: UserStatus;
  lastActive: string;
  reports: number;
  avatar?: ApiAvatar | null;
};

type StatusFilter = "all" | UserStatus;

const userDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const formatUserDate = (value?: string) => {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return userDateFormatter.format(date);
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

const resolveAvatarSrc = (
  avatar?: { url?: string; contentType?: string; data?: string } | null,
) => {
  if (!avatar) {
    return "";
  }
  if (avatar.url) {
    return avatar.url;
  }
  if (avatar.contentType && avatar.data) {
    return `data:${avatar.contentType};base64,${avatar.data}`;
  }
  return "";
};

const isBanActive = (banInfo: BanInfo | null) => {
  if (!banInfo) {
    return false;
  }
  if (!banInfo.expires) {
    return true;
  }
  const expiresAt = new Date(banInfo.expires).getTime();
  if (!Number.isFinite(expiresAt)) {
    return true;
  }
  return expiresAt > Date.now();
};

export default function AdminUsersPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { logout, user } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<User[]>([]);
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [banDialogUser, setBanDialogUser] = useState<User | null>(null);
  const [banDialogReason, setBanDialogReason] = useState("");
  const [banDialogDuration, setBanDialogDuration] = useState(0);
  const [banDialogDate, setBanDialogDate] = useState<Date | undefined>();
  const [banDialogLoading, setBanDialogLoading] = useState(false);
  const [deleteProfileDialogOpen, setDeleteProfileDialogOpen] = useState(false);
  const [deleteProfileDialogUser, setDeleteProfileDialogUser] =
    useState<AdminUserSettingsTarget | null>(null);
  const [deleteProfileInput, setDeleteProfileInput] = useState("");
  const [deleteProfileError, setDeleteProfileError] = useState<string | null>(
    null,
  );
  const [deleteProfileLoading, setDeleteProfileLoading] = useState(false);
  const [settingsUser, setSettingsUser] =
    useState<AdminUserSettingsTarget | null>(null);
  const [ranksDialogOpen, setRanksDialogOpen] = useState(false);
  const usersLoadGuardRef = useRef(false);
  const displayName = user?.displayName || user?.username || "";
  const initials = (displayName || "U").slice(0, 2).toUpperCase();
  const avatarSrc = resolveAvatarSrc(user?.avatar);
  const statusLabels: Record<StatusFilter, string> = {
    all: t("statusAll"),
    active: t("statusActive"),
    banned: t("statusBanned"),
  };
  const languageOptions = [
    { code: "RU" as const, label: "RU" },
    { code: "EN" as const, label: "EN" },
    { code: "KZ" as const, label: "KZ" },
  ];
  const locale =
    language === "KZ" ? "kk-KZ" : language === "RU" ? "ru-RU" : "en-US";
  const banDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    [locale],
  );
  const today = useMemo(() => {
    const value = new Date();
    value.setHours(0, 0, 0, 0);
    return value;
  }, []);
  const resolveBanDurationSeconds = (
    durationValue: number,
    untilDate?: Date,
  ) => {
    if (durationValue !== -1) {
      return durationValue;
    }
    if (!untilDate) {
      return null;
    }
    const end = new Date(untilDate);
    end.setHours(23, 59, 59, 999);
    const diffMs = end.getTime() - Date.now();
    if (diffMs <= 0) {
      return 0;
    }
    return Math.ceil(diffMs / 1000);
  };
  const banDurations = useMemo(
    () => [
      { value: 0, label: t("adminBanDurationPermanent") },
      { value: 60 * 60 * 24, label: t("adminBanDuration24h") },
      { value: 60 * 60 * 24 * 7, label: t("adminBanDuration7d") },
      { value: 60 * 60 * 24 * 30, label: t("adminBanDuration30d") },
      { value: -1, label: t("adminBanDurationCustom") },
    ],
    [t],
  );

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const loadUsers = async () => {
      try {
        const list = await fetchUsers({ signal: controller.signal });
        const banResults = await Promise.allSettled(
          list.map((item) =>
            fetchUserBanInfo(item.userID, undefined, {
              signal: controller.signal,
            }),
          ),
        );
        if (controller.signal.aborted) {
          return;
        }
        if (banResults.some((result) => result.status === "rejected")) {
          toast.error(t("adminErrorLoadBanStatuses"));
        }
        const mapped: User[] = list.map((item, index) => {
          const banInfo =
            banResults[index].status === "fulfilled"
              ? banResults[index].value
              : null;
          const isBanned = isBanActive(banInfo);
          return {
            id: `USR-${item.userID}`,
            userID: item.userID,
            name: item.displayName || item.username,
            username: item.username,
            email: item.username || "-",
            role: item.rank?.name || t("labelUser"),
            status: isBanned ? "banned" : "active",
            lastActive: formatUserDate(item.joined),
            reports: 0,
            avatar: item.avatar ?? null,
          };
        });
        setUsers(mapped);
      } catch (error) {
        if (!controller.signal.aborted) {
          toast.error(t("adminErrorLoadUsers"), {
            description: error instanceof Error ? error.message : undefined,
          });
          setUsers([]);
        }
      }
    };

    void loadUsers();
    return () => controller.abort();
  }, [t]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter]);

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return users.filter((user) => {
      const matchesQuery =
        !normalized ||
        user.name.toLowerCase().includes(normalized) ||
        user.username.toLowerCase().includes(normalized) ||
        user.email.toLowerCase().includes(normalized);
      const matchesStatus =
        statusFilter === "all" || user.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [query, statusFilter, users]);

  const counts = useMemo(() => {
    return {
      total: users.length,
      active: users.filter((user) => user.status === "active").length,
      banned: users.filter((user) => user.status === "banned").length,
    };
  }, [users]);

  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart =
    filteredUsers.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const pageEnd = Math.min(safePage * pageSize, filteredUsers.length);
  const currentPageUsers = filteredUsers.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  const updateUserStatus = (userID: number, status: UserStatus) => {
    setUsers((prev) =>
      prev.map((item) => (item.userID === userID ? { ...item, status } : item)),
    );
  };

  const openBanDialog = (target: User) => {
    setBanDialogUser(target);
    setBanDialogReason("");
    setBanDialogDuration(0);
    setBanDialogDate(undefined);
    setBanDialogOpen(true);
  };

  const handleConfirmBan = async () => {
    if (!banDialogUser) {
      return;
    }
    const reason = banDialogReason.trim();
    if (!reason) {
      toast.error(t("adminBanReasonRequired"));
      return;
    }
    const durationSeconds: number | null = resolveBanDurationSeconds(
      banDialogDuration,
      banDialogDate,
    );

    if (banDialogDuration === -1) {
      if (durationSeconds == null) {
        toast.error(t("adminBanDateRequired"));
        return;
      }
      if (durationSeconds <= 0) {
        toast.error(t("adminBanDateInvalid"));
        return;
      }
    }

    setBanDialogLoading(true);
    try {
      await banUser(banDialogUser.userID, reason, durationSeconds || 0);
      updateUserStatus(banDialogUser.userID, "banned");
      toast.error(t("adminToastUserBlocked"), {
        description: banDialogUser.name,
      });
      setBanDialogOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("adminErrorLoadUsers"),
      );
    } finally {
      setBanDialogLoading(false);
    }
  };

  const handleConfirmDeleteProfile = async () => {
    if (!deleteProfileDialogUser) {
      return;
    }
    const expectedUsername = deleteProfileDialogUser.username || "";
    if (deleteProfileInput.trim() !== expectedUsername) {
      setDeleteProfileError(t("adminUserDeleteProfileMismatch"));
      return;
    }
    setDeleteProfileError(null);
    setDeleteProfileLoading(true);
    try {
      await deleteUserProfile(deleteProfileDialogUser.userID);
      setUsers((prev) =>
        prev.filter((item) => item.userID !== deleteProfileDialogUser.userID),
      );
      toast.success(t("adminUserDeleteProfileSuccess"), {
        description: deleteProfileDialogUser.name,
      });
      setDeleteProfileDialogOpen(false);
      setSettingsUser(null);
    } catch (error) {
      setDeleteProfileError(
        error instanceof Error
          ? error.message
          : t("adminUserDeleteProfileError"),
      );
    } finally {
      setDeleteProfileLoading(false);
    }
  };

  const handleAction = async (
    user: User,
    action: "block" | "unblock" | "message",
  ) => {
    if (action === "block") {
      openBanDialog(user);
      return;
    }

    if (action === "unblock") {
      if (user.status !== "banned") {
        return;
      }
      try {
        await unbanUser(user.userID);
        updateUserStatus(user.userID, "active");
        toast.success(t("adminToastUserUnblocked"), {
          description: user.name,
        });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : t("adminErrorLoadUsers"),
        );
      }
      return;
    }

    toast.message(t("adminToastMessageSent"), {
      description: user.name,
    });
  };

  const handleSettingsAction = async (
    action:
      | "permissions"
      | "role"
      | "profile"
      | "profileDescription"
      | "profileDelete",
    user: AdminUserSettingsTarget,
  ) => {
    if (action === "profile") {
      try {
        await deleteUserAvatar(user.userID);
        toast.success(t("adminUserAvatarResetSuccess"), {
          description: user.name,
        });
      } catch (error) {
        toast.error(t("adminUserAvatarResetError"), {
          description: error instanceof Error ? error.message : undefined,
        });
      }
      return;
    }
    if (action === "profileDescription") {
      try {
        await deleteUserDescription(user.userID);
        toast.success(t("adminUserDescriptionDeleteSuccess"), {
          description: user.name,
        });
      } catch (error) {
        toast.error(t("adminUserDescriptionDeleteError"), {
          description: error instanceof Error ? error.message : undefined,
        });
      }
      return;
    }
    if (action === "profileDelete") {
      setDeleteProfileDialogUser(user);
      setDeleteProfileInput("");
      setDeleteProfileError(null);
      setDeleteProfileDialogOpen(true);
      return;
    }
    const labelMap = {
      permissions: t("adminUserSettingsPermissions"),
      role: t("adminUserSettingsRole"),
      profile: t("adminUserSettingsProfile"),
    };
    toast.message(labelMap[action], {
      description: user.name,
    });
  };

  const handleRoleUpdated = (userID: number, role: string) => {
    setUsers((prev) =>
      prev.map((item) => (item.userID === userID ? { ...item, role } : item)),
    );
    setSettingsUser((prev) =>
      prev && prev.userID === userID ? { ...prev, role } : prev,
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      <div className="pointer-events-none absolute -top-40 right-0 h-[28rem] w-[28rem] rounded-full bg-foreground/5 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-[32rem] w-[32rem] rounded-full bg-foreground/10 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(0,0,0,0.04),transparent_45%,rgba(0,0,0,0.06))]" />

      <header
        className="sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur"
        style={{ top: "var(--maintenance-banner-height)" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link href="/" aria-label="Go to main site">
              <Logo className="h-9 w-9 text-foreground" showText={false} />
            </Link>
            <div>
              <p className="text-lg font-semibold">{t("adminPanelTitle")}</p>
              <p className="text-xs text-muted-foreground">
                {t("adminUsersManageTitle")}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-border/70 bg-background px-4 text-xs font-semibold transition-colors duration-300 hover:bg-foreground hover:text-background"
            >
              {mounted ? (
                theme === "light" ? (
                  <Moon className="h-4 w-4" />
                ) : (
                  <Sun className="h-4 w-4" />
                )
              ) : null}
              {t("adminThemeToggle")}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-border/70 bg-background px-4 text-xs font-semibold transition-colors duration-300 hover:bg-foreground hover:text-background"
                >
                  <Globe className="h-4 w-4" />
                  {language}
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[90px]">
                {languageOptions.map((option) => (
                  <DropdownMenuItem
                    key={option.code}
                    onClick={() => setLanguage(option.code)}
                  >
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-3 rounded-full border border-border/60 bg-card/90 px-4 py-2 text-sm font-semibold transition-colors duration-300 hover:bg-foreground hover:text-background"
                >
                  <Avatar className="h-9 w-9">
                    {avatarSrc ? (
                      <AvatarImage
                        src={avatarSrc}
                        alt={displayName || user?.username || "admin"}
                      />
                    ) : null}
                    <AvatarFallback className="text-xs font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-semibold">
                    {displayName || user?.username || "admin"}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem asChild>
                  <Link href="/account">
                    <Settings className="h-4 w-4" />
                    {t("accountSettings")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    void handleLogout();
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  {t("logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="px-4 pb-16 pt-8 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          <motion.section
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="rounded-3xl border border-border/70 bg-card/90 p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  {t("labelUsers")}
                </p>
                <h2 className="text-2xl font-bold">
                  {t("adminUsersManageTitle")}
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href="/admin"
                  className="rounded-full border border-border/70 px-4 py-2 text-sm font-semibold transition-all duration-300 hover:bg-foreground hover:text-background"
                >
                  {t("adminPanel")}
                </Link>
                <button
                  type="button"
                  className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-foreground/30"
                  onClick={() =>
                    toast.message(t("adminExport"), {
                      description: t("adminExportHint"),
                    })
                  }
                >
                  {t("adminExport")}
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { label: t("labelTotal"), value: counts.total },
                { label: t("labelActive"), value: counts.active },
                { label: t("labelBanned"), value: counts.banned },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-border/60 bg-background/70 p-4"
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold">{item.value}</p>
                </div>
              ))}
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="rounded-3xl border border-border/70 bg-card/90 p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  {t("labelSearch")}
                </p>
                <h3 className="text-lg font-semibold">
                  {t("adminUsersManageSubtitle")}
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t("adminUsersSearchPlaceholder")}
                    className="h-10 w-full rounded-full border border-border/70 bg-background pl-9 pr-4 text-sm sm:w-64"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as StatusFilter)
                  }
                  className="h-10 w-full rounded-full border border-border/70 bg-background px-4 text-sm sm:w-auto"
                >
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="rounded-3xl border border-border/70 bg-card/90 p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>
                  {t("labelShowing")} {pageStart}-{pageEnd} {t("labelOf")}{" "}
                  {filteredUsers.length}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {t("adminUsersFilterLabel")}: {statusLabels[statusFilter]}
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {currentPageUsers.map((user) => {
                const ActionIcon =
                  user.status === "banned" ? CheckCircle2 : Ban;
                const actionTitle =
                  user.status === "banned"
                    ? t("actionUnblock")
                    : t("actionBlock");
                const initials = getUserInitials(user.name);
                const rowAvatarSrc = resolveAvatarSrc(user.avatar);

                return (
                  <div
                    key={user.id}
                    className="rounded-2xl border border-border/60 bg-background/70 p-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex items-start gap-3 min-w-0">
                        <Avatar className="h-10 w-10">
                          {rowAvatarSrc ? (
                            <AvatarImage src={rowAvatarSrc} alt={user.name} />
                          ) : null}
                          <AvatarFallback className="text-xs font-semibold">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">
                            {user.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            @{user.username}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span className="truncate">{user.email}</span>
                            <span>|</span>
                            <span>{user.role}</span>
                            <span>|</span>
                            <span>{user.id}</span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {user.lastActive}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${user.status === "banned" ? "bg-destructive/10 text-destructive" : "bg-foreground text-background"}`}
                        >
                          {user.status === "banned"
                            ? t("statusBanned")
                            : t("statusActive")}
                        </span>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{t("labelReports")}:</span>
                          <span className="text-foreground font-semibold">
                            {user.reports}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            title={actionTitle}
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-border/70 text-foreground transition-all duration-300 hover:bg-foreground hover:text-background"
                            onClick={() =>
                              void handleAction(
                                user,
                                user.status === "banned" ? "unblock" : "block",
                              )
                            }
                          >
                            <ActionIcon className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            title={t("actionMessage")}
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-border/70 text-foreground transition-all duration-300 hover:bg-foreground hover:text-background"
                            onClick={() => void handleAction(user, "message")}
                          >
                            <MessageSquare className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            title={t("adminUserSettingsTitle")}
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-border/70 text-foreground transition-all duration-300 hover:bg-foreground hover:text-background"
                            onClick={() =>
                              setSettingsUser({
                                userID: user.userID,
                                name: user.name,
                                username: user.username,
                                role: user.role,
                              })
                            }
                          >
                            <Settings className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {filteredUsers.length === 0 && (
              <div className="mt-6 text-center text-sm text-muted-foreground">
                {t("adminUsersEmpty")}
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                {t("labelPage")} {safePage} {t("labelOf")} {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-full border border-border/70 px-4 py-2 text-xs font-semibold transition-colors duration-300 hover:bg-foreground hover:text-background disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={safePage <= 1}
                >
                  {t("adminPaginationPrev")}
                </button>
                <button
                  type="button"
                  className="rounded-full border border-border/70 px-4 py-2 text-xs font-semibold transition-colors duration-300 hover:bg-foreground hover:text-background disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() =>
                    setPage((prev) => Math.min(totalPages, prev + 1))
                  }
                  disabled={safePage >= totalPages}
                >
                  {t("adminPaginationNext")}
                </button>
              </div>
            </div>
          </motion.section>
        </div>
      </main>
      <Dialog
        open={banDialogOpen}
        onOpenChange={(open) => {
          setBanDialogOpen(open);
          if (!open) {
            setBanDialogUser(null);
            setBanDialogReason("");
            setBanDialogDuration(0);
            setBanDialogDate(undefined);
            setBanDialogLoading(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("adminBanDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("adminBanDialogDescription")} {banDialogUser?.name || ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {t("adminBanReason")}
            </label>

            <Textarea
              value={banDialogReason}
              onChange={(event) => {
                setBanDialogReason(event.target.value);
              }}
              placeholder={t("adminBanReason")}
              rows={4}
            />
            <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {t("adminBanDurationLabel")}
            </label>
            <select
              className="w-full rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm"
              value={banDialogDuration}
              onChange={(event) => {
                const nextValue = Number(event.target.value);
                setBanDialogDuration(
                  Number.isFinite(nextValue) ? nextValue : 0,
                );
                if (nextValue !== -1) {
                  setBanDialogDate(undefined);
                }
              }}
            >
              {banDurations.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {banDialogDuration === -1 ? (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm text-left"
                  >
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    {banDialogDate
                      ? banDateFormatter.format(banDialogDate)
                      : t("adminBanPickDate")}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={banDialogDate}
                    onSelect={setBanDialogDate}
                    disabled={{ before: today }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            ) : null}
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setBanDialogOpen(false)}
              className="rounded-full border border-border/70 px-4 py-2 text-sm font-semibold transition-colors duration-300 hover:bg-foreground hover:text-background"
              disabled={banDialogLoading}
            >
              {t("adminDialogCancel")}
            </button>
            <button
              type="button"
              onClick={() => void handleConfirmBan()}
              className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-foreground/30 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={banDialogLoading || !banDialogUser}
            >
              {t("actionBlock")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={deleteProfileDialogOpen}
        onOpenChange={(open) => {
          setDeleteProfileDialogOpen(open);
          if (!open) {
            setDeleteProfileDialogUser(null);
            setDeleteProfileInput("");
            setDeleteProfileError(null);
            setDeleteProfileLoading(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("adminUserDeleteProfileTitle")}</DialogTitle>
            <DialogDescription>
              {t("adminUserDeleteProfileDescription")}{" "}
              <span className="font-semibold text-foreground">
                {deleteProfileDialogUser?.username ?? ""}
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <input
              value={deleteProfileInput}
              onChange={(event) => setDeleteProfileInput(event.target.value)}
              placeholder={t("adminUserDeleteProfilePlaceholder")}
              className="w-full rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm"
            />
            {deleteProfileError ? (
              <p className="text-xs text-destructive">{deleteProfileError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setDeleteProfileDialogOpen(false)}
              className="rounded-full border border-border/70 px-4 py-2 text-sm font-semibold transition-colors duration-300 hover:bg-foreground hover:text-background"
              disabled={deleteProfileLoading}
            >
              {t("adminUserDeleteProfileCancel")}
            </button>
            <button
              type="button"
              onClick={() => void handleConfirmDeleteProfile()}
              className="rounded-full bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground transition-opacity duration-300 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={
                deleteProfileLoading ||
                !deleteProfileDialogUser ||
                deleteProfileInput.trim() !==
                  (deleteProfileDialogUser?.username ?? "")
              }
            >
              {t("adminUserDeleteProfileAction")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AdminUserSettingsDialog
        open={Boolean(settingsUser)}
        user={settingsUser}
        onOpenChange={(open) => {
          if (!open) {
            setSettingsUser(null);
          }
        }}
        onAction={handleSettingsAction}
        onOpenRanksDialog={() => setRanksDialogOpen(true)}
        onRoleUpdated={handleRoleUpdated}
      />
      <AdminRanksDialog
        open={ranksDialogOpen}
        onOpenChange={setRanksDialogOpen}
      />
    </div>
  );
}
