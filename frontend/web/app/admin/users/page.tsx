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
import {
  banUser,
  fetchUserBanInfo,
  fetchUsers,
  unbanUser,
  type BanInfo,
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  const usersLoadGuardRef = useRef(false);
  const displayName = user?.displayName || user?.username || "";
  const initials = (displayName || "U").slice(0, 2).toUpperCase();
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
            fetchUserBanInfo(item.userID, { signal: controller.signal }),
          ),
        );
        if (controller.signal.aborted) {
          return;
        }
        if (banResults.some((result) => result.status === "rejected")) {
          toast.error(t("adminErrorLoadBanStatuses"));
        }
        const mapped = list.map((item, index) => {
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
      await banUser(banDialogUser.userID, reason, durationSeconds ?? 0);
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

  const handleAction = async (
    user: User,
    action: "block" | "unblock" | "message",
  ) => {
    if (action === "block") {
      openBanDialog(user);
      return;
    }

    if (action === "unblock") {
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

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      <div className="pointer-events-none absolute -top-40 right-0 h-[28rem] w-[28rem] rounded-full bg-foreground/5 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-[32rem] w-[32rem] rounded-full bg-foreground/10 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(0,0,0,0.04),transparent_45%,rgba(0,0,0,0.06))]" />

      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur">
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

            <div className="mt-4">
              <div className="space-y-3 sm:hidden">
                {currentPageUsers.map((user) => {
                  const ActionIcon =
                    user.status === "banned" ? CheckCircle2 : Ban;
                  const actionTitle =
                    user.status === "banned"
                      ? t("actionUnblock")
                      : t("actionBlock");

                  return (
                    <div
                      key={user.id}
                      className="rounded-2xl border border-border/60 bg-background/70 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold break-words">
                            {user.name}
                          </p>
                          <p className="text-xs text-muted-foreground break-all">
                            {user.email}
                          </p>
                          <p className="text-xs text-muted-foreground break-all">
                            {user.id}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${user.status === "banned" ? "bg-destructive/10 text-destructive" : "bg-foreground text-background"}`}
                        >
                          {user.status === "banned"
                            ? t("statusBanned")
                            : t("statusActive")}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{user.lastActive}</span>
                        <span className="text-foreground font-semibold">
                          {user.reports}
                        </span>
                      </div>
                      <div className="mt-3 flex justify-end gap-2">
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
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="hidden sm:block">
                <div className="overflow-hidden rounded-2xl border border-border/60">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-semibold">
                          {t("labelUser")}
                        </th>
                        <th className="px-4 py-3 font-semibold">
                          {t("labelEmail")}
                        </th>
                        <th className="px-4 py-3 font-semibold">
                          {t("labelStatus")}
                        </th>
                        <th className="px-4 py-3 font-semibold">
                          {t("labelLastActive")}
                        </th>
                        <th className="px-4 py-3 text-right font-semibold">
                          {t("labelReports")}
                        </th>
                        <th className="px-4 py-3 text-right font-semibold">
                          {t("labelActions")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentPageUsers.map((user) => {
                        const ActionIcon =
                          user.status === "banned" ? CheckCircle2 : Ban;
                        const actionTitle =
                          user.status === "banned"
                            ? t("actionUnblock")
                            : t("actionBlock");

                        return (
                          <tr
                            key={user.id}
                            className="border-t border-border/60"
                          >
                            <td className="px-4 py-4">
                              <div className="flex flex-col">
                                <span className="font-semibold">
                                  {user.name}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {user.username}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-muted-foreground">
                              {user.email}
                            </td>
                            <td className="px-4 py-4">
                              <span
                                className={`rounded-full px-3 py-1 text-xs font-semibold ${user.status === "banned" ? "bg-destructive/10 text-destructive" : "bg-foreground text-background"}`}
                              >
                                {user.status === "banned"
                                  ? t("statusBanned")
                                  : t("statusActive")}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-muted-foreground">
                              {user.lastActive}
                            </td>
                            <td className="px-4 py-4 text-right font-semibold">
                              {user.reports}
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  title={actionTitle}
                                  className="flex h-9 w-9 items-center justify-center rounded-full border border-border/70 text-foreground transition-all duration-300 hover:bg-foreground hover:text-background"
                                  onClick={() =>
                                    void handleAction(
                                      user,
                                      user.status === "banned"
                                        ? "unblock"
                                        : "block",
                                    )
                                  }
                                >
                                  <ActionIcon className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  title={t("actionMessage")}
                                  className="flex h-9 w-9 items-center justify-center rounded-full border border-border/70 text-foreground transition-all duration-300 hover:bg-foreground hover:text-background"
                                  onClick={() =>
                                    void handleAction(user, "message")
                                  }
                                >
                                  <MessageSquare className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
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
              {t("adminBanDialogDescription")} {banDialogUser?.name ?? ""}
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
    </div>
  );
}
