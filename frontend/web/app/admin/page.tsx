"use client";

import { Logo } from "@/components/logo";
import { useTheme } from "@/components/theme-provider";
import { motion } from "framer-motion";
import {
  Ban,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Globe,
  Image as ImageIcon,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Shield,
  Sparkles,
  Sun,
  TrendingUp,
  Users,
  UserX,
  Vote,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import {
  banUser,
  fetchUserBanInfo,
  fetchUsers,
  handleBannedUser,
  unbanUser,
  type BanInfo,
} from "@/lib/api";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Calendar } from "@/components/ui/calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

const sectionVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

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

type CountResponse = {
  count?: number;
};

type VoteCategoryRecord = { name?: string; posts?: number };
type TopCategoriesResponse = { record?: VoteCategoryRecord[] };

type IdeasRecapResponse = {
  approved?: number;
  waiting?: number;
  declined?: number;
};

type UsersActivityResponse = {
  data?: Record<string, { active?: number; offline?: number }>;
};

type Grade = { good?: number; bad?: number };
type EditorsGradeResponse = {
  photos?: Grade;
  videos?: Grade;
  graphics?: Grade;
};

type MediaCoverageResponse = {
  medias?: Record<string, { photos?: number; videos?: number }>;
};

type StatCardId = "activeUsers" | "offlineUsers" | "newIdeas" | "votes";
type StatsSummary = Record<StatCardId, number | null>;

type ActivityPoint = {
  label: string;
  timestamp: number;
  active: number;
  offline: number;
};
type VoteCategory = { category: string; votes: number };
type MediaCoveragePoint = {
  label: string;
  timestamp: number;
  photos: number;
  videos: number;
};
type QualityScore = { type: string; score: number };
type ActivityRange = "24h" | "3d" | "7d";

const userDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const formatUserDate = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return userDateFormatter.format(date);
};

const isBanActive = (banInfo: BanInfo | null) => {
  if (!banInfo) return false;
  if (!banInfo.expires) return true;
  const expiresAt = new Date(banInfo.expires).getTime();
  if (!Number.isFinite(expiresAt)) return true;
  return expiresAt > Date.now();
};

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8080";
const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL
).replace(/\/$/, "");
const BANNED_ERROR_MATCH = "user is banned";

const isBannedResponse = (
  status: number,
  data: { error?: string; data?: unknown; message?: string } | null,
  message: string,
) => {
  if (status !== 401 && status !== 403) {
    return false;
  }
  const includesBan = (value: unknown) =>
    typeof value === "string" &&
    value.toLowerCase().includes(BANNED_ERROR_MATCH);
  return (
    includesBan(data?.error) ||
    includesBan(data?.data) ||
    includesBan(data?.message) ||
    includesBan(message)
  );
};
async function requestJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
    signal,
  });

  if (response.ok) {
    return (await response.json()) as T;
  }

  let message = `Request failed (${response.status})`;
  let data: { error?: string; data?: unknown; message?: string } | null = null;
  try {
    data = (await response.json()) as {
      error?: string;
      data?: unknown;
      message?: string;
    };
  } catch {
    const text = await response.text();
    if (text) {
      message = text;
    }
  }
  if (data?.error) {
    message = data.error;
  } else if (data?.message) {
    message = data.message;
  }
  if (isBannedResponse(response.status, data, message)) {
    await handleBannedUser({ signal });
  }
  throw new Error(message);
}

export default function AdminPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { logout, user } = useAuth();
  const { language, setLanguage, t } = useLanguage();

  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("overview");

  const [statsSummary, setStatsSummary] = useState<StatsSummary>({
    activeUsers: null,
    offlineUsers: null,
    newIdeas: null,
    votes: null,
  });
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [banReason, setBanReason] = useState("");
  const [banDuration, setBanDuration] = useState(0);
  const [banUntilDate, setBanUntilDate] = useState<Date | undefined>();
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [banDialogUser, setBanDialogUser] = useState<User | null>(null);
  const [banDialogReason, setBanDialogReason] = useState("");
  const [banDialogDuration, setBanDialogDuration] = useState(0);
  const [banDialogDate, setBanDialogDate] = useState<Date | undefined>();
  const [banDialogLoading, setBanDialogLoading] = useState(false);

  const [voteCategories, setVoteCategories] = useState<VoteCategory[]>([]);
  const [ideasApproval, setIdeasApproval] = useState<{
    approved: number | null;
    waiting: number | null;
    declined: number | null;
  }>({
    approved: null,
    waiting: null,
    declined: null,
  });
  const [activityRange, setActivityRange] = useState<ActivityRange>("7d");
  const [activityPoints, setActivityPoints] = useState<ActivityPoint[]>([]);
  const [mediaCoveragePoints, setMediaCoveragePoints] = useState<
    MediaCoveragePoint[]
  >([]);
  const [qualityScores, setQualityScores] = useState<QualityScore[]>([]);
  const [audienceSnapshot, setAudienceSnapshot] = useState<{
    active: number | null;
    offline: number | null;
  }>({
    active: null,
    offline: null,
  });

  const displayName = user?.displayName || user?.username || "";
  const initials = (displayName || "U").slice(0, 2).toUpperCase();

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

  const sidebarItems = useMemo(
    () => [
      {
        id: "overview",
        label: t("adminStatsTitle"),
        icon: BarChart3,
        href: "#overview",
      },
      {
        id: "analytics",
        label: t("adminStatsActivityTitle"),
        icon: TrendingUp,
        href: "#analytics",
      },
      {
        id: "media",
        label: t("adminMediaTitle"),
        icon: ImageIcon,
        href: "#media",
      },
      {
        id: "users",
        label: t("adminAccessModerationTitle"),
        icon: Shield,
        href: "#users",
      },
      {
        id: "submissions",
        label: t("adminSubmissionsTitle"),
        icon: CheckCircle2,
        href: "/admin/submissions",
      },
    ],
    [language, t],
  );

  const statsCards = [
    {
      id: "activeUsers" as const,
      title: t("adminStatsActiveUsers"),
      icon: Users,
    },
    {
      id: "offlineUsers" as const,
      title: t("adminStatsOfflineUsers"),
      icon: UserX,
    },
    { id: "newIdeas" as const, title: t("adminStatsNewIdeas"), icon: Users },
    { id: "votes" as const, title: t("adminStatsVotes"), icon: Vote },
  ];

  const activityRanges = useMemo(
    () => [
      { id: "24h" as const, label: t("adminStatsRange24h"), days: 1 },
      { id: "3d" as const, label: t("adminStatsRange3d"), days: 3 },
      { id: "7d" as const, label: t("adminStatsRange7d"), days: 7 },
    ],
    [t],
  );

  const activityRangeDays =
    activityRanges.find((range) => range.id === activityRange)?.days ?? 7;

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

  const activityFallback = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
    });
    const now = new Date();
    const baseActive = statsSummary.activeUsers ?? 0;
    const baseOffline = statsSummary.offlineUsers ?? 0;

    return Array.from({ length: activityRangeDays }, (_, index) => {
      const date = new Date(now);
      const steps = Math.max(activityRangeDays - 1, 0);
      date.setDate(now.getDate() - (steps - index));
      const growth = index * 0.08;

      return {
        label: formatter.format(date),
        timestamp: date.getTime(),
        active: Math.max(0, Math.round(baseActive * (0.6 + growth))),
        offline: Math.max(0, Math.round(baseOffline * (0.7 - growth * 0.6))),
      };
    });
  }, [
    activityRangeDays,
    locale,
    statsSummary.activeUsers,
    statsSummary.offlineUsers,
  ]);

  const activityData = activityPoints.length
    ? activityPoints
    : activityFallback;

  const statusData = useMemo(
    () => [
      { status: t("statusPending"), value: ideasApproval.waiting ?? 0 },
      { status: t("statusApproved"), value: ideasApproval.approved ?? 0 },
      { status: t("statusDeclined"), value: ideasApproval.declined ?? 0 },
    ],
    [ideasApproval, t],
  );

  const votesByCategoryData = useMemo(
    () =>
      voteCategories.map((item) => ({
        category: item.category,
        votes: item.votes,
      })),
    [voteCategories],
  );

  const participationData = useMemo(() => {
    const active = audienceSnapshot.active ?? statsSummary.activeUsers ?? 0;
    const offline = audienceSnapshot.offline ?? statsSummary.offlineUsers ?? 0;
    return [
      { status: t("adminStatsActiveUsers"), value: active },
      { status: t("adminStatsOfflineUsers"), value: offline },
    ];
  }, [
    audienceSnapshot.active,
    audienceSnapshot.offline,
    statsSummary.activeUsers,
    statsSummary.offlineUsers,
    t,
  ]);

  const mediaCoverageData = useMemo(
    () => mediaCoveragePoints,
    [mediaCoveragePoints],
  );

  const qualityData = useMemo(() => {
    if (qualityScores.length) {
      return qualityScores;
    }
    return [
      { type: t("adminMediaLabelPhotos"), score: 0 },
      { type: t("adminMediaLabelVideos"), score: 0 },
      { type: t("adminMediaLabelGraphics"), score: 0 },
    ];
  }, [qualityScores, t]);

  const activityConfig = {
    active: {
      label: t("adminStatsActiveUsers"),
      color: "var(--color-chart-1)",
    },
    offline: {
      label: t("adminStatsOfflineUsers"),
      color: "var(--color-chart-2)",
    },
  };

  const votesByCategoryConfig = {
    votes: {
      label: t("adminStatsVotes"),
      color: "var(--color-chart-4)",
    },
  };

  const mediaCoverageConfig = {
    photos: {
      label: t("adminMediaLabelPhotos"),
      color: "var(--color-chart-1)",
    },
    videos: {
      label: t("adminMediaLabelVideos"),
      color: "var(--color-chart-2)",
    },
  };

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const sectionIds = ["overview", "analytics", "media", "users"];
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (visible?.target?.id) {
          setActiveSection(visible.target.id);
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );

    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));

    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const sinceMs = Date.now() - 24 * 60 * 60 * 1000;
    const sinceParam = encodeURIComponent(new Date(sinceMs).toISOString());
    const activityLimit = activityRangeDays;

    const load = async () => {
      const [
        votesDayResult,
        ideasDayResult,
        activeUsersResult,
        offlineUsersResult,
        categoriesResult,
        ideasRecapResult,
        usersActivityResult,
        qualityRecapResult,
        mediaCoverageResult,
      ] = await Promise.allSettled([
        requestJson<CountResponse>("/api/statistics/votes", controller.signal),
        requestJson<CountResponse>("/api/statistics/ideas", controller.signal),
        requestJson<CountResponse>(
          `/api/statistics/users/active/${sinceParam}`,
          controller.signal,
        ),
        requestJson<CountResponse>(
          `/api/statistics/users/offline/${sinceParam}`,
          controller.signal,
        ),
        requestJson<TopCategoriesResponse>(
          "/api/statistics/categories/5",
          controller.signal,
        ),
        requestJson<IdeasRecapResponse>(
          "/api/statistics/ideas/recap",
          controller.signal,
        ),
        requestJson<UsersActivityResponse>(
          `/api/statistics/activity/users/${activityLimit}`,
          controller.signal,
        ),
        requestJson<EditorsGradeResponse>(
          "/api/statistics/quality/recap",
          controller.signal,
        ),
        requestJson<MediaCoverageResponse>(
          "/api/statistics/media/coverage",
          controller.signal,
        ),
      ]);

      if (controller.signal.aborted) {
        return;
      }

      if (votesDayResult.status !== "fulfilled" && votesDayResult.reason) {
        toast.error(t("adminErrorLoadVoteCount"), {
          description:
            votesDayResult.reason instanceof Error
              ? votesDayResult.reason.message
              : undefined,
        });
      }

      if (ideasDayResult.status !== "fulfilled" && ideasDayResult.reason) {
        toast.error(t("adminErrorLoadIdeasCount"), {
          description:
            ideasDayResult.reason instanceof Error
              ? ideasDayResult.reason.message
              : undefined,
        });
      }

      if (
        activeUsersResult.status !== "fulfilled" &&
        activeUsersResult.reason
      ) {
        toast.error(t("adminErrorLoadActiveUsers"), {
          description:
            activeUsersResult.reason instanceof Error
              ? activeUsersResult.reason.message
              : undefined,
        });
      }

      if (
        offlineUsersResult.status !== "fulfilled" &&
        offlineUsersResult.reason
      ) {
        toast.error(t("adminErrorLoadOfflineUsers"), {
          description:
            offlineUsersResult.reason instanceof Error
              ? offlineUsersResult.reason.message
              : undefined,
        });
      }

      if (categoriesResult.status !== "fulfilled" && categoriesResult.reason) {
        toast.error(t("adminErrorLoadVoteCategories"), {
          description:
            categoriesResult.reason instanceof Error
              ? categoriesResult.reason.message
              : undefined,
        });
      }

      if (ideasRecapResult.status !== "fulfilled" && ideasRecapResult.reason) {
        toast.error(t("adminErrorLoadIdeasRecap"), {
          description:
            ideasRecapResult.reason instanceof Error
              ? ideasRecapResult.reason.message
              : undefined,
        });
      }

      if (
        usersActivityResult.status !== "fulfilled" &&
        usersActivityResult.reason
      ) {
        toast.error(t("adminErrorLoadAudience"), {
          description:
            usersActivityResult.reason instanceof Error
              ? usersActivityResult.reason.message
              : undefined,
        });
      }

      if (
        qualityRecapResult.status !== "fulfilled" &&
        qualityRecapResult.reason
      ) {
        toast.error(t("adminErrorLoadQualityRecap"), {
          description:
            qualityRecapResult.reason instanceof Error
              ? qualityRecapResult.reason.message
              : undefined,
        });
      }

      if (
        mediaCoverageResult.status !== "fulfilled" &&
        mediaCoverageResult.reason
      ) {
        toast.error(t("adminErrorLoadMediaCoverage"), {
          description:
            mediaCoverageResult.reason instanceof Error
              ? mediaCoverageResult.reason.message
              : undefined,
        });
      }

      setStatsSummary((prev) => ({
        activeUsers:
          activeUsersResult.status === "fulfilled"
            ? Number(activeUsersResult.value?.count ?? 0)
            : prev.activeUsers,
        offlineUsers:
          offlineUsersResult.status === "fulfilled"
            ? Number(offlineUsersResult.value?.count ?? 0)
            : prev.offlineUsers,
        newIdeas:
          ideasDayResult.status === "fulfilled"
            ? Number(ideasDayResult.value?.count ?? 0)
            : prev.newIdeas,
        votes:
          votesDayResult.status === "fulfilled"
            ? Number(votesDayResult.value?.count ?? 0)
            : prev.votes,
      }));

      if (categoriesResult.status === "fulfilled") {
        const mapped = (categoriesResult.value.record ?? []).map((item) => ({
          category: item.name || t("other"),
          votes: Number(item.posts ?? 0),
        }));
        setVoteCategories(mapped);
      }

      if (ideasRecapResult.status === "fulfilled") {
        setIdeasApproval({
          approved: Number(ideasRecapResult.value?.approved ?? 0),
          waiting: Number(ideasRecapResult.value?.waiting ?? 0),
          declined: Number(ideasRecapResult.value?.declined ?? 0),
        });
      }

      if (usersActivityResult.status === "fulfilled") {
        const formatter = new Intl.DateTimeFormat(locale, {
          month: "short",
          day: "numeric",
        });
        const mapped = Object.entries(usersActivityResult.value?.data ?? {})
          .map(([key, value]) => {
            const timestamp = Number(key) * 1000;
            if (!Number.isFinite(timestamp)) return null;
            const active = Number(value?.active ?? 0);
            const offline = Number(value?.offline ?? 0);
            return {
              label: formatter.format(new Date(timestamp)),
              timestamp,
              active,
              offline,
            };
          })
          .filter((item): item is ActivityPoint => Boolean(item))
          .sort((a, b) => a.timestamp - b.timestamp);

        setActivityPoints(mapped);

        const latest = mapped[mapped.length - 1];
        if (latest) {
          setAudienceSnapshot((prev) => ({
            active: latest.active ?? prev.active,
            offline: latest.offline ?? prev.offline,
          }));
        }
      }

      if (qualityRecapResult.status === "fulfilled") {
        const computeScore = (grade?: Grade) => {
          const good = Number(grade?.good ?? 0);
          const bad = Number(grade?.bad ?? 0);
          const total = good + bad;
          if (total === 0) return 0;
          return Math.round((good / total) * 100);
        };
        setQualityScores([
          {
            type: t("adminMediaLabelPhotos"),
            score: computeScore(qualityRecapResult.value.photos),
          },
          {
            type: t("adminMediaLabelVideos"),
            score: computeScore(qualityRecapResult.value.videos),
          },
          {
            type: t("adminMediaLabelGraphics"),
            score: computeScore(qualityRecapResult.value.graphics),
          },
        ]);
      }

      if (mediaCoverageResult.status === "fulfilled") {
        const formatter = new Intl.DateTimeFormat(locale, {
          month: "short",
          day: "numeric",
        });
        const mapped = Object.entries(mediaCoverageResult.value?.medias ?? {})
          .map(([key, value]) => {
            const timestamp = Number(key) * 1000;
            if (!Number.isFinite(timestamp)) return null;
            return {
              label: formatter.format(new Date(timestamp)),
              timestamp,
              photos: Number(value?.photos ?? 0),
              videos: Number(value?.videos ?? 0),
            };
          })
          .filter((item): item is MediaCoveragePoint => Boolean(item))
          .sort((a, b) => a.timestamp - b.timestamp);

        setMediaCoveragePoints(mapped);
      }

      setAudienceSnapshot((prev) => ({
        active:
          prev.active ??
          (activeUsersResult.status === "fulfilled"
            ? Number(activeUsersResult.value?.count ?? 0)
            : null),
        offline:
          prev.offline ??
          (offlineUsersResult.status === "fulfilled"
            ? Number(offlineUsersResult.value?.count ?? 0)
            : null),
      }));
    };

    void load();

    return () => controller.abort();
  }, [activityRangeDays, locale, t]);

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
    const durationSeconds = resolveBanDurationSeconds(
      banDialogDuration,
      banDialogDate,
    );
    if (banDialogDuration === -1 && durationSeconds == null) {
      toast.error(t("adminBanDateRequired"));
      return;
    }
    if (banDialogDuration === -1 && durationSeconds <= 0) {
      toast.error(t("adminBanDateInvalid"));
      return;
    }
    setBanDialogLoading(true);
    try {
      await banUser(banDialogUser.userID, reason, durationSeconds ?? 0);
      updateUserStatus(banDialogUser.userID, "banned");
      toast.error(t("adminToastUserBlocked"), {
        description: `${banDialogUser.name} - ${t("adminBanReason")}: ${reason}`,
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

  const handleUserAction = async (
    user: User,
    action: "block" | "unblock" | "reset" | "message",
  ) => {
    if (action === "block") {
      const reason = banReason.trim();
      if (!reason) {
        toast.error(t("adminBanReasonRequired"));
        return;
      }
      const durationSeconds = resolveBanDurationSeconds(
        banDuration,
        banUntilDate,
      );
      if (banDuration === -1 && durationSeconds == null) {
        toast.error(t("adminBanDateRequired"));
        return;
      }
      if (banDuration === -1 && durationSeconds <= 0) {
        toast.error(t("adminBanDateInvalid"));
        return;
      }
      try {
        await banUser(user.userID, reason, durationSeconds ?? 0);
        updateUserStatus(user.userID, "banned");
        toast.error(t("adminToastUserBlocked"), {
          description: `${user.name} - ${t("adminBanReason")}: ${reason}`,
        });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : t("adminErrorLoadUsers"),
        );
      }
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

    if (action === "reset") {
      toast.message(t("adminToastPasswordReset"), {
        description: user.name,
      });
      return;
    }

    toast.message(t("adminToastMessageSent"), {
      description: user.name,
    });
  };

  const handleSelectedAction = (action: "block" | "unblock" | "reset") => {
    const selectedUser = users.find((item) => item.userID === selectedUserId);
    if (!selectedUser) {
      toast.message(t("adminToastSelectUser"));
      return;
    }
    void handleUserAction(selectedUser, action);
  };

  const sidebar = (
    <motion.aside
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.3 }}
      className="relative z-40 flex h-full w-full max-w-[260px] flex-col gap-4 rounded-3xl border border-border/70 bg-gradient-to-b from-background/95 via-background/80 to-background/70 p-5 shadow-[0_16px_40px_-30px_rgba(0,0,0,0.6)] backdrop-blur"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Logo className="h-9 w-9 text-foreground" showText={false} />
        </div>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/80 text-sm hover:bg-foreground hover:text-background"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="space-y-1">
        {sidebarItems.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`flex items-center gap-3 rounded-2xl border border-border/60 px-4 py-2 text-sm font-semibold transition-colors duration-300 ${
                isActive
                  ? "bg-foreground text-background shadow-lg shadow-foreground/20"
                  : "bg-card/90 hover:bg-foreground/90 hover:text-background"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </motion.aside>
  );

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255, 255, 255, 0.12),transparent_32%),radial-gradient(circle_at_80%_0%,rgba(151, 151, 151, 0.15),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.02),transparent_50%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.03),transparent_50%)]" />

      {sidebarOpen ? (
        <div className="fixed inset-0 z-30 bg-background/70 backdrop-blur lg:hidden">
          <div className="absolute left-4 top-6">{sidebar}</div>
        </div>
      ) : null}

      <div className="relative flex">
        <div className="fixed left-6 top-6 hidden h-[calc(100vh-3rem)] lg:block">
          {sidebar}
        </div>

        <div className="flex min-h-screen w-full flex-col lg:pl-[320px]  rounded-bl-[48px] overflow-hidden">
          <header className="sticky top-0 z-20  backdrop-blur">
            <div className="px-4 py-3 sm:px-6 lg:px-10">
              <div className="relative overflow-hidden rounded-md border border-border/60 bg-card/80 shadow-[0_20px_40px_-32px_rgba(0,0,0,0.6)] sm:rounded-md">
                <div className="pointer-events-none absolute inset-x-2 top-0 h-[3px] rounded-md opacity-80 sm:rounded-full" />
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-4 lg:px-6">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSidebarOpen(true)}
                      className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-background/90 text-foreground shadow-sm hover:bg-foreground hover:text-background"
                      aria-label="Open menu"
                    >
                      <Menu className="h-5 w-5" />
                    </button>
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                          {t("adminPanel")}
                        </p>
                        <p className="text-base font-semibold leading-tight text-foreground">
                          {t("adminPanelSubtitle")}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
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
                          className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background px-4 py-2 text-sm font-semibold transition-all duration-300 hover:bg-foreground hover:text-background"
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
                          className="flex items-center gap-3 rounded-full border border-border/60 bg-background/90 px-4 py-2 text-sm font-semibold transition-colors duration-300 hover:bg-foreground hover:text-background"
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
                            <Shield className="h-4 w-4" />
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
              </div>
            </div>
          </header>

          <main className="px-4 pb-16 pt-8 sm:px-6 lg:px-10">
            <div className="mx-auto flex max-w-6xl flex-col gap-10">
              <motion.section
                id="overview"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5 }}
                variants={sectionVariants}
                className="space-y-6 scroll-mt-32"
              >
                <div>
                  <h2 className="text-3xl font-bold leading-tight">
                    {t("adminStatsSubtitle")}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("adminStatsActivitySubtitle")}
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {statsCards.map((card) => {
                    const value = statsSummary[card.id];
                    const displayValue =
                      value == null ? "-" : value.toLocaleString(locale);

                    return (
                      <div
                        key={card.id}
                        className="rounded-3xl border border-border/70 bg-card/90 p-5 shadow-[0_18px_40px_-30px_rgba(0,0,0,0.5)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_50px_-32px_rgba(0,0,0,0.6)]"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-foreground text-background shadow-lg shadow-foreground/20">
                            <card.icon className="h-5 w-5" />
                          </div>
                          <Sparkles className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="mt-4 text-2xl font-bold">
                          {displayValue}
                        </div>
                        <p className="text-sm font-semibold text-muted-foreground">
                          {card.title}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </motion.section>

              <motion.section
                id="analytics"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5 }}
                variants={sectionVariants}
                className="space-y-6 scroll-mt-32"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                      {t("adminStatsTitle")}
                    </p>
                    <h2 className="text-2xl font-bold">
                      {t("adminStatsActivityTitle")}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {t("adminStatsActivitySubtitle")}
                    </p>
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-[1.6fr,1fr]">
                  <div className="min-w-0 rounded-3xl border border-border/70 bg-card/90 p-6 shadow-[0_24px_60px_-45px_rgba(0,0,0,0.5)]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">
                          {t("adminStatsActivityTitle")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("adminStatsActivitySubtitle")}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 rounded-full border border-border/70 bg-background/60 p-1">
                        {activityRanges.map((range) => {
                          const isActive = range.id === activityRange;
                          return (
                            <button
                              key={range.id}
                              type="button"
                              className={`rounded-full px-3 py-1 text-xs font-semibold transition-all duration-300 ${
                                isActive
                                  ? "bg-foreground text-background shadow-sm"
                                  : "text-muted-foreground hover:text-foreground"
                              }`}
                              onClick={() => setActivityRange(range.id)}
                            >
                              {range.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <ChartContainer
                      config={activityConfig}
                      className="mt-4 h-[220px] sm:h-[260px]"
                    >
                      <AreaChart
                        data={activityData}
                        margin={{ left: 8, right: 8 }}
                      >
                        <defs>
                          <linearGradient
                            id="fillActive"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="var(--color-chart-1)"
                              stopOpacity={0.4}
                            />
                            <stop
                              offset="95%"
                              stopColor="var(--color-chart-1)"
                              stopOpacity={0.05}
                            />
                          </linearGradient>
                          <linearGradient
                            id="fillOffline"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="var(--color-chart-2)"
                              stopOpacity={0.35}
                            />
                            <stop
                              offset="95%"
                              stopColor="var(--color-chart-2)"
                              stopOpacity={0.05}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} />
                        <XAxis
                          dataKey="label"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11 }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          width={32}
                          tick={{ fontSize: 11 }}
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Area
                          type="monotone"
                          dataKey="active"
                          stroke="var(--color-chart-1)"
                          fill="url(#fillActive)"
                          strokeWidth={2}
                        />
                        <Area
                          type="monotone"
                          dataKey="offline"
                          stroke="var(--color-chart-2)"
                          fill="url(#fillOffline)"
                          strokeWidth={2}
                        />
                        <ChartLegend content={<ChartLegendContent />} />
                      </AreaChart>
                    </ChartContainer>
                  </div>

                  <div className="min-w-0 space-y-6">
                    <div className="rounded-3xl border border-border/70 bg-card/90 p-6">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">
                            {t("adminStatsStatusesTitle")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t("adminStatsStatusesSubtitle")}
                          </p>
                        </div>
                        <Vote className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <ChartContainer
                        config={{}}
                        className="mt-4 h-[200px] sm:h-[220px]"
                      >
                        <PieChart>
                          <ChartTooltip
                            content={<ChartTooltipContent nameKey="status" />}
                          />
                          <Pie
                            data={statusData}
                            dataKey="value"
                            nameKey="status"
                            innerRadius={55}
                            outerRadius={85}
                            strokeWidth={2}
                          >
                            {statusData.map((entry, index) => (
                              <Cell
                                key={entry.status}
                                fill={`var(--color-chart-${index + 1})`}
                                stroke="var(--color-background)"
                              />
                            ))}
                          </Pie>
                        </PieChart>
                      </ChartContainer>
                      <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                        {statusData.map((entry, index) => (
                          <div
                            key={entry.status}
                            className="flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{
                                  backgroundColor: `var(--color-chart-${index + 1})`,
                                }}
                              />
                              <span>{entry.status}</span>
                            </div>
                            <span className="font-semibold text-foreground">
                              {entry.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-border/70 bg-card/90 p-6">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">
                            {t("adminStatsActivityTitle")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t("adminStatsActivitySubtitle")}
                          </p>
                        </div>
                        <Users className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <ChartContainer
                        config={{}}
                        className="mt-4 h-[200px] sm:h-[220px]"
                      >
                        <PieChart>
                          <ChartTooltip
                            content={<ChartTooltipContent nameKey="status" />}
                          />
                          <Pie
                            data={participationData}
                            dataKey="value"
                            nameKey="status"
                            innerRadius={50}
                            outerRadius={80}
                            strokeWidth={2}
                          >
                            {participationData.map((entry, index) => (
                              <Cell
                                key={entry.status}
                                fill={`var(--color-chart-${index + 1})`}
                                stroke="var(--color-background)"
                              />
                            ))}
                          </Pie>
                        </PieChart>
                      </ChartContainer>
                      <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                        {participationData.map((entry, index) => (
                          <div
                            key={entry.status}
                            className="flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{
                                  backgroundColor: `var(--color-chart-${index + 1})`,
                                }}
                              />
                              <span>{entry.status}</span>
                            </div>
                            <span className="font-semibold text-foreground">
                              {entry.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-[1.2fr,1fr]">
                  <div className="min-w-0 rounded-3xl border border-border/70 bg-card/90 p-6 shadow-[0_24px_60px_-45px_rgba(0,0,0,0.5)]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">
                          {t("adminStatsVotesByCategoryTitle")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("adminStatsVotesByCategorySubtitle")}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {t("adminStatsNoteSinceMidnight")}
                      </span>
                    </div>
                    <ChartContainer
                      config={votesByCategoryConfig}
                      className="mt-4 h-[220px] sm:h-[240px]"
                    >
                      <BarChart
                        data={votesByCategoryData}
                        margin={{ left: 8, right: 8 }}
                      >
                        <CartesianGrid vertical={false} />
                        <XAxis
                          dataKey="category"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11 }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          width={36}
                          tick={{ fontSize: 11 }}
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="votes" radius={[10, 10, 0, 0]}>
                          {votesByCategoryData.map((item, index) => (
                            <Cell
                              key={item.category}
                              fill={`var(--color-chart-${index + 2})`}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ChartContainer>
                  </div>

                  <div className="min-w-0 rounded-3xl border border-border/70 bg-card/90 p-6">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">
                          {t("adminMediaQualityTitle")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("adminMediaQualitySubtitle")}
                        </p>
                      </div>
                      <Shield className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <ChartContainer
                      config={{}}
                      className="mt-4 h-[220px] w-full"
                    >
                      <BarChart
                        data={qualityData}
                        layout="vertical"
                        margin={{ left: 8, right: 8 }}
                      >
                        <CartesianGrid horizontal={false} />
                        <XAxis
                          type="number"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11 }}
                        />
                        <YAxis
                          type="category"
                          dataKey="type"
                          tickLine={false}
                          axisLine={false}
                          width={90}
                          tick={{ fontSize: 11 }}
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="score" radius={[0, 10, 10, 0]}>
                          {qualityData.map((item, index) => (
                            <Cell
                              key={item.type}
                              fill={`var(--color-chart-${index + 1})`}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ChartContainer>
                  </div>
                </div>
              </motion.section>

              <motion.section
                id="media"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5 }}
                variants={sectionVariants}
                className="space-y-6 scroll-mt-32"
              >
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                    {t("adminMediaTitle")}
                  </p>
                  <h2 className="text-2xl font-bold">
                    {t("adminMediaSubtitle")}
                  </h2>
                </div>
                <div className="grid gap-6 lg:grid-cols-[1.2fr,1fr]">
                  <div className="min-w-0 rounded-3xl border border-border/70 bg-card/90 p-6 shadow-[0_24px_60px_-45px_rgba(0,0,0,0.5)]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">
                          {t("adminMediaCoverageTitle")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("adminMediaCoverageSubtitle")}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {t("adminMediaCoverageRange")}
                      </span>
                    </div>
                    <ChartContainer
                      config={mediaCoverageConfig}
                      className="mt-4 h-[220px] sm:h-[240px]"
                    >
                      <AreaChart
                        data={mediaCoverageData}
                        margin={{ left: 8, right: 8 }}
                      >
                        <defs>
                          <linearGradient
                            id="fillPhotos"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="var(--color-chart-1)"
                              stopOpacity={0.35}
                            />
                            <stop
                              offset="95%"
                              stopColor="var(--color-chart-1)"
                              stopOpacity={0.05}
                            />
                          </linearGradient>
                          <linearGradient
                            id="fillVideos"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="var(--color-chart-2)"
                              stopOpacity={0.35}
                            />
                            <stop
                              offset="95%"
                              stopColor="var(--color-chart-2)"
                              stopOpacity={0.05}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} />
                        <XAxis
                          dataKey="label"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11 }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          width={32}
                          tick={{ fontSize: 11 }}
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Area
                          type="monotone"
                          dataKey="photos"
                          stroke="var(--color-chart-1)"
                          fill="url(#fillPhotos)"
                          strokeWidth={2}
                        />
                        <Area
                          type="monotone"
                          dataKey="videos"
                          stroke="var(--color-chart-2)"
                          fill="url(#fillVideos)"
                          strokeWidth={2}
                        />
                        <ChartLegend content={<ChartLegendContent />} />
                      </AreaChart>
                    </ChartContainer>
                  </div>

                  <div className="min-w-0 rounded-3xl border border-border/70 bg-card/90 p-6">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">
                          {t("adminMediaQualityTitle")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("adminMediaQualitySubtitle")}
                        </p>
                      </div>
                      <Shield className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        {t("adminMediaCoverageRange")}
                      </p>
                      <p className="text-sm">
                        {t("adminMediaCoverageSubtitle")}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.section>

              <motion.section
                id="users"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5 }}
                variants={sectionVariants}
                className="space-y-6 scroll-mt-32"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                      {t("labelUsers")}
                    </p>
                    <h2 className="text-2xl font-bold">
                      {t("adminAccessModerationTitle")}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {t("adminAccessModerationSubtitle")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      href="/admin/users"
                      className="rounded-full border border-border/70 px-4 py-2 text-sm font-semibold transition-all duration-300 hover:bg-foreground hover:text-background"
                    >
                      {t("adminUsersViewAll")}
                    </Link>
                    <Link
                      href="/admin/submissions"
                      className="rounded-full border border-border/70 px-4 py-2 text-sm font-semibold transition-all duration-300 hover:bg-foreground hover:text-background"
                    >
                      {t("adminSubmissionsTitle")}
                    </Link>
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
                  <div className="min-w-0 rounded-3xl border border-border/70 bg-card/90 p-6 shadow-[0_24px_60px_-45px_rgba(0,0,0,0.5)]">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">
                        {t("adminUsersListTitle")}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {t("adminUsersListSubtitle")}
                      </span>
                    </div>
                    <div className="mt-4 space-y-3">
                      {users.slice(0, 6).map((user) => {
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
                                <p className="break-words text-sm font-semibold">
                                  {user.name}
                                </p>
                                <p className="break-all text-xs text-muted-foreground">
                                  {user.email}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {user.lastActive}
                                </p>
                              </div>
                              <span
                                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                  user.status === "banned"
                                    ? "bg-destructive/10 text-destructive"
                                    : "bg-foreground text-background"
                                }`}
                              >
                                {user.status === "banned"
                                  ? t("statusBanned")
                                  : t("statusActive")}
                              </span>
                            </div>
                            <div className="mt-3 flex justify-end gap-2">
                              <button
                                type="button"
                                title={actionTitle}
                                className="flex h-9 w-9 items-center justify-center rounded-full border border-border/70 text-foreground transition-all duration-300 hover:bg-foreground hover:text-background"
                                onClick={() =>
                                  user.status === "banned"
                                    ? void handleUserAction(user, "unblock")
                                    : openBanDialog(user)
                                }
                              >
                                <ActionIcon className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                title={t("actionResetPassword")}
                                className="flex h-9 w-9 items-center justify-center rounded-full border border-border/70 text-foreground transition-all duration-300 hover:bg-foreground hover:text-background"
                                onClick={() =>
                                  void handleUserAction(user, "reset")
                                }
                              >
                                <Shield className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                title={t("actionMessage")}
                                className="flex h-9 w-9 items-center justify-center rounded-full border border-border/70 text-foreground transition-all duration-300 hover:bg-foreground hover:text-background"
                                onClick={() =>
                                  void handleUserAction(user, "message")
                                }
                              >
                                <MessageSquare className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="min-w-0 space-y-6">
                    <div className="rounded-3xl border border-border/70 bg-card/90 p-6">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">
                            {t("adminBanCardTitle")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t("adminBanCardSubtitle")}
                          </p>
                        </div>
                        <Ban className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="mt-4 space-y-3">
                        <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          {t("adminBanSelectUser")}
                        </label>
                        <select
                          className="w-full rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm"
                          value={selectedUserId ?? ""}
                          onChange={(event) => {
                            const nextValue = Number(event.target.value);
                            setSelectedUserId(
                              Number.isFinite(nextValue) ? nextValue : null,
                            );
                          }}
                        >
                          <option value="">{t("adminBanSelectUser")}</option>
                          {users.map((user) => (
                            <option key={user.id} value={user.userID}>
                              {user.name}
                            </option>
                          ))}
                        </select>
                        <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          {t("adminBanReason")}
                        </label>

                        <textarea
                          className="min-h-[90px] w-full rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm"
                          value={banReason}
                          onChange={(event) => {
                            setBanReason(event.target.value);
                          }}
                        />
                        <p className="text-xs text-muted-foreground">
                          {t("adminBanReasonHint")}
                        </p>
                        <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          {t("adminBanDurationLabel")}
                        </label>
                        <select
                          className="w-full rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm"
                          value={banDuration}
                          onChange={(event) => {
                            const nextValue = Number(event.target.value);
                            setBanDuration(
                              Number.isFinite(nextValue) ? nextValue : 0,
                            );
                            if (nextValue !== -1) {
                              setBanUntilDate(undefined);
                            }
                          }}
                        >
                          {banDurations.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        {banDuration === -1 ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm text-left"
                              >
                                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                                {banUntilDate
                                  ? banDateFormatter.format(banUntilDate)
                                  : t("adminBanPickDate")}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent
                              align="start"
                              className="w-auto p-0"
                            >
                              <Calendar
                                mode="single"
                                selected={banUntilDate}
                                onSelect={setBanUntilDate}
                                disabled={{ before: today }}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        ) : null}
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          className="rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-foreground/30"
                          onClick={() => handleSelectedAction("block")}
                        >
                          {t("actionBlock")}
                        </button>
                        <button
                          type="button"
                          className="rounded-full border border-border/70 px-4 py-2 text-xs font-semibold transition-all duration-300 hover:bg-foreground hover:text-background"
                          onClick={() => handleSelectedAction("unblock")}
                        >
                          {t("actionUnblock")}
                        </button>
                        <button
                          type="button"
                          className="col-span-2 rounded-full border border-border/70 px-4 py-2 text-xs font-semibold transition-all duration-300 hover:bg-foreground hover:text-background"
                          onClick={() => handleSelectedAction("reset")}
                        >
                          {t("actionResetPassword")}
                        </button>
                      </div>
                    </div>
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
      </div>
    </div>
  );
}
