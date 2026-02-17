"use client";

import { useTheme } from "@/components/theme-provider";
import { AnimatePresence, motion } from "framer-motion";
import {
  Ban,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Globe,
  Image as ImageIcon,
  LogOut,
  MessageSquare,
  Moon,
  House,
  Shield,
  Sparkles,
  Settings,
  Sun,
  TrendingUp,
  Users,
  UserX,
  Vote,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { AdminRanksDialog } from "@/components/admin-ranks-dialog";
import { AdminNotificationsMenu } from "@/components/admin-notifications-menu";
import {
  AdminUserSettingsDialog,
  type AdminUserSettingsTarget,
} from "@/components/admin-user-settings-dialog";
import {
  TutorialProvider,
  type TutorialStep,
} from "@/components/tutorial/tutorial-provider";
import {
  banUser,
  deleteUserAvatar,
  deleteUserDescription,
  deleteUserProfile,
  fetchUserBanInfo,
  fetchUsers,
  getPublicApiErrorMessage,
  handleBannedUser,
  unbanUser,
  type BanInfo,
  type ApiAvatar,
} from "@/lib/api";
import { API_BASE_URL } from "@/lib/api-base";
import { emitMfaRequired, isMfaRequiredMessage } from "@/lib/mfa-required";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

const NO_DATA_LABEL = "нет информации";

const renderNoData = (heightClass: string) => (
  <div
    className={`mt-4 flex ${heightClass} items-center justify-center rounded-2xl border border-dashed border-border/60 text-sm text-muted-foreground`}
  >
    {NO_DATA_LABEL}
  </div>
);

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

const ADMIN_CACHE_TTL_MS = 5 * 60 * 1000;
const ADMIN_STATS_CACHE_PREFIX = "admin.stats.v1";
const ADMIN_USERS_CACHE_KEY = "admin.users.v2";

const readAdminCache = <T,>(key: string): T | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const writeAdminCache = (key: string, value: unknown) => {
  if (typeof window === "undefined") return;

  const payload = JSON.stringify(value);

  try {
    window.sessionStorage.setItem(key, payload);
    return;
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));

    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn(
        `[writeAdminCache] [-] failed to write sessionStorage for key "${key}"`,
        error,
      );
    }

    if (err instanceof DOMException && err.name === "SecurityError") return;

    try {
      window.localStorage.setItem(key, payload);

      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn(
          `[writeAdminCache] [+] fallback to localStorage succeeded for key "${key}"`,
        );
      }
    } catch (fallbackErr: unknown) {
      if (process.env.NODE_ENV !== "production") {
        const fe =
          fallbackErr instanceof Error
            ? fallbackErr
            : new Error(String(fallbackErr));

        // eslint-disable-next-line no-console
        console.warn(
          `[writeAdminCache] [-] fallback to localStorage failed for key "${key}"`,
          fe,
        );
      }
    }
  }
};

const adminTutorialSteps: TutorialStep[] = [
  {
    selector: '[data-tutorial="admin-functional-trigger"]',
    text: "\u041a\u043d\u043e\u043f\u043a\u0430 \u00ab\u0424\u0443\u043d\u043a\u0446\u0438\u043e\u043d\u0430\u043b\u00bb \u043e\u0442\u043a\u0440\u044b\u0432\u0430\u0435\u0442 \u0440\u0430\u0437\u0434\u0435\u043b\u044b \u0430\u043d\u0430\u043b\u0438\u0442\u0438\u043a\u0438 \u0438 \u043c\u043e\u0434\u0435\u0440\u0430\u0446\u0438\u0438.",
    position: "right",
  },
  {
    selector: '[data-tutorial="admin-theme-toggle"]',
    text: "\u041f\u0435\u0440\u0435\u043a\u043b\u044e\u0447\u0430\u0439 \u0442\u0435\u043c\u0443, \u0447\u0442\u043e\u0431\u044b \u043a\u043e\u043c\u0444\u043e\u0440\u0442\u043d\u0435\u0435 \u0447\u0438\u0442\u0430\u0442\u044c \u043e\u0442\u0447\u0435\u0442\u044b.",
    position: "bottom",
  },
  {
    selector: '[data-tutorial="admin-overview-stats"]',
    text: "\u0417\u0434\u0435\u0441\u044c \u043a\u043b\u044e\u0447\u0435\u0432\u044b\u0435 \u043c\u0435\u0442\u0440\u0438\u043a\u0438: \u0430\u043a\u0442\u0438\u0432\u043d\u044b\u0435 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0438, \u0438\u0434\u0435\u0438 \u0438 \u0433\u043e\u043b\u043e\u0441\u0430.",
    position: "bottom",
  },
  {
    selector: '[data-tutorial="admin-access-section"]',
    text: "\u041a\u043e\u043d\u0442\u0440\u043e\u043b\u044c \u0434\u043e\u0441\u0442\u0443\u043f\u0430 \u0438 \u043c\u043e\u0434\u0435\u0440\u0430\u0446\u0438\u044f \u2014 \u0442\u0443\u0442 \u0443\u043f\u0440\u0430\u0432\u043b\u044f\u0435\u043c \u043f\u0440\u0430\u0432\u0430\u043c\u0438 \u0438 \u0441\u043e\u0441\u0442\u043e\u044f\u043d\u0438\u044f\u043c\u0438 \u0430\u043a\u043a\u0430\u0443\u043d\u0442\u043e\u0432.",
    position: "bottom",
  },
  {
    selector: '[data-tutorial="admin-users-list"]',
    text: "Активность и статистика по пользователям и другим значениям.",
    position: "right",
  },
];

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

type QuickMenuItem = {
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
  section?: string;
};

type QuickMenuGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  items: QuickMenuItem[];
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

type AdminStatsCache = {
  timestamp: number;
  statsSummary: StatsSummary;
  voteCategories: VoteCategory[];
  ideasApproval: {
    approved: number | null;
    waiting: number | null;
    declined: number | null;
  };
  activityPoints: ActivityPoint[];
  mediaCoveragePoints: MediaCoveragePoint[];
  qualityScores: QualityScore[];
  audienceSnapshot: {
    active: number | null;
    offline: number | null;
  };
};

type AdminUsersCache = {
  timestamp: number;
  users: User[];
};

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

const isBanActive = (banInfo: BanInfo | null) => {
  if (!banInfo) return false;
  if (!banInfo.expires) return true;
  const expiresAt = new Date(banInfo.expires).getTime();
  if (!Number.isFinite(expiresAt)) return true;
  return expiresAt > Date.now();
};

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

const isMfaRequiredResponse = (
  status: number,
  data: { error?: string; data?: unknown; message?: string } | null,
  message: string,
) => {
  if (status !== 403) {
    return false;
  }
  return (
    isMfaRequiredMessage(message) ||
    isMfaRequiredMessage(data?.message) ||
    isMfaRequiredMessage(data?.error) ||
    isMfaRequiredMessage(data?.data)
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

  let rawMessage = `Request failed (${response.status})`;
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
      rawMessage = text;
    }
  }
  if (data?.error) {
    rawMessage = data.error;
  } else if (data?.message) {
    rawMessage = data.message;
  }
  if (isBannedResponse(response.status, data, rawMessage)) {
    await handleBannedUser({ signal });
  }
  const publicMessage = getPublicApiErrorMessage(response.status, rawMessage);
  if (isMfaRequiredResponse(response.status, data, rawMessage)) {
    emitMfaRequired({ reason: publicMessage });
  }
  throw new Error(publicMessage);
}

export default function AdminPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { logout, user } = useAuth();
  const { language, setLanguage, t } = useLanguage();

  const [mounted, setMounted] = useState(false);
  const [showHeaderNote, setShowHeaderNote] = useState(true);
  const [activeSection, setActiveSection] = useState("users");
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const [quickMenuExpanded, setQuickMenuExpanded] = useState<
    Record<string, boolean>
  >({
    main: true,
    analytics: false,
    moderation: false,
  });

  const [statsSummary, setStatsSummary] = useState<StatsSummary>({
    activeUsers: null,
    offlineUsers: null,
    newIdeas: null,
    votes: null,
  });
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
  // ----------------------
  const [headerCompact, setHeaderCompact] = useState(false);

  useEffect(() => {
    const onScroll = () => setHeaderCompact(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const updateHeaderNoteVisibility = () => {
      const left = quickMenuTriggerRef.current;
      const right = headerActionsRef.current;
      const note = headerNoteRef.current;
      if (!left || !right || !note) {
        return;
      }
      if (window.innerWidth <= 1202) {
        setShowHeaderNote(false);
        return;
      }
      const leftRect = left.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();
      const availableWidth = rightRect.left - leftRect.right;
      const neededWidth = note.scrollWidth + 300;
      setShowHeaderNote(availableWidth > neededWidth);
    };

    const observedElements = [
      headerBarRef.current,
      quickMenuTriggerRef.current,
      headerActionsRef.current,
      headerNoteRef.current,
    ].filter((node) => node !== null);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(updateHeaderNoteVisibility);
      observedElements.forEach((element) => observer?.observe(element));
    }

    window.addEventListener("resize", updateHeaderNoteVisibility);
    updateHeaderNoteVisibility();

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateHeaderNoteVisibility);
    };
  }, [language, t, mounted]);

  const headerVariants = {
    hidden: { opacity: 0, y: -10, filter: "blur(6px)" },
    visible: { opacity: 1, y: 0, filter: "blur(0px)" },
  };

  // -------------------------
  const [qualityScores, setQualityScores] = useState<QualityScore[]>([]);
  const [audienceSnapshot, setAudienceSnapshot] = useState<{
    active: number | null;
    offline: number | null;
  }>({
    active: null,
    offline: null,
  });

  const statsSnapshotRef = useRef({
    statsSummary,
    voteCategories,
    ideasApproval,
    activityPoints,
    mediaCoveragePoints,
    qualityScores,
    audienceSnapshot,
  });
  const statsLoadGuardRef = useRef(false);
  const usersLoadGuardRef = useRef(false);
  const headerBarRef = useRef<HTMLDivElement | null>(null);
  const quickMenuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const headerActionsRef = useRef<HTMLDivElement | null>(null);
  const headerNoteRef = useRef<HTMLParagraphElement | null>(null);

  const displayName = user?.displayName || user?.username || "";
  const initials = (displayName || "U").slice(0, 2).toUpperCase();
  const avatarSrc = resolveAvatarSrc(user?.avatar);

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

  const quickMenuGroups = useMemo<QuickMenuGroup[]>(
    () => [
      {
        id: "main",
        label: t("adminQuickGroupMain"),
        icon: Shield,
        items: [
          {
            id: "users",
            href: "#users",
            label: t("adminAccessModerationTitle"),
            icon: Shield,
            section: "users",
          },
          {
            id: "users-manage",
            href: "/admin/users",
            label: t("adminUsersManageTitle"),
            icon: Users,
          },
          {
            id: "support",
            href: "/admin/support",
            label: t("adminSupportTitle"),
            icon: MessageSquare,
          },
        ],
      },
      {
        id: "analytics",
        label: t("adminQuickGroupAnalytics"),
        icon: TrendingUp,
        items: [
          {
            id: "overview",
            href: "#overview",
            label: t("adminStatsTitle"),
            icon: BarChart3,
            section: "overview",
          },
          {
            id: "analytics",
            href: "#analytics",
            label: t("adminStatsActivityTitle"),
            icon: TrendingUp,
            section: "analytics",
          },
          {
            id: "media",
            href: "#media",
            label: t("adminMediaTitle"),
            icon: ImageIcon,
            section: "media",
          },
        ],
      },
      {
        id: "moderation",
        label: t("adminQuickGroupModeration"),
        icon: CheckCircle2,
        items: [
          {
            id: "submissions",
            href: "/admin/submissions",
            label: t("adminSubmissionsTitle"),
            icon: CheckCircle2,
          },
          {
            id: "submissions-pending",
            href: "/admin/submissions/pending",
            label: t("statusPending"),
            icon: Sparkles,
          },
          {
            id: "submissions-approved",
            href: "/admin/submissions/approved",
            label: t("statusApproved"),
            icon: Shield,
          },
          {
            id: "submissions-declined",
            href: "/admin/submissions/declined",
            label: t("statusDeclined"),
            icon: X,
          },
        ],
      },
    ],
    [t],
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
    activityRanges.find((range) => range.id === activityRange)?.days || 7;

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

  const activityData = activityPoints;
  const hasActivityData = activityPoints.some(
    (point) => point.active > 0 || point.offline > 0,
  );

  const statusData = useMemo(
    () => [
      { status: t("statusPending"), value: ideasApproval.waiting || 0 },
      { status: t("statusApproved"), value: ideasApproval.approved || 0 },
      { status: t("statusDeclined"), value: ideasApproval.declined || 0 },
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
      { status: t("adminStatsActiveUsersShort"), value: active },
      { status: t("adminStatsOfflineUsersShort"), value: offline },
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

  const hasStatusData = statusData.some((entry) => entry.value > 0);
  const hasParticipationData = participationData.some(
    (entry) => entry.value > 0,
  );
  const hasVotesByCategoryData = votesByCategoryData.some(
    (entry) => entry.votes > 0,
  );
  const hasQualityData = qualityData.some((entry) => entry.score > 0);
  const hasMediaCoverageData = mediaCoverageData.some(
    (entry) => entry.photos > 0 || entry.videos > 0,
  );

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
    statsSnapshotRef.current = {
      statsSummary,
      voteCategories,
      ideasApproval,
      activityPoints,
      mediaCoveragePoints,
      qualityScores,
      audienceSnapshot,
    };
  }, [
    statsSummary,
    voteCategories,
    ideasApproval,
    activityPoints,
    mediaCoveragePoints,
    qualityScores,
    audienceSnapshot,
  ]);

  useEffect(() => {
    const sectionIds = ["users", "overview", "analytics", "media"];
    let frame = 0;

    const resolveHeaderOffset = () => {
      const header = document.querySelector("header");
      const headerHeight = header?.getBoundingClientRect().height ?? 0;
      return headerHeight + 24;
    };

    const updateActiveSection = () => {
      const offset = resolveHeaderOffset();
      const scrollPosition = window.scrollY + offset;
      const elements = sectionIds
        .map((id) => document.getElementById(id))
        .filter((el): el is HTMLElement => Boolean(el));

      if (!elements.length) {
        return;
      }

      let nextId = elements[0].id;
      for (const element of elements) {
        if (element.offsetTop <= scrollPosition) {
          nextId = element.id;
        } else {
          break;
        }
      }

      setActiveSection(nextId);
    };

    const onScroll = () => {
      if (frame) {
        return;
      }
      frame = window.requestAnimationFrame(() => {
        updateActiveSection();
        frame = 0;
      });
    };

    updateActiveSection();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let controller = new AbortController();
    const cacheKey = `${ADMIN_STATS_CACHE_PREFIX}:${language}:${activityRangeDays}`;
    const cached = readAdminCache<AdminStatsCache>(cacheKey);

    if (cached && Date.now() - cached.timestamp < ADMIN_CACHE_TTL_MS) {
      setStatsSummary(cached.statsSummary);
      setVoteCategories(cached.voteCategories);
      setIdeasApproval(cached.ideasApproval);
      setActivityPoints(cached.activityPoints);
      setMediaCoveragePoints(cached.mediaCoveragePoints);
      setQualityScores(cached.qualityScores);
      setAudienceSnapshot(cached.audienceSnapshot);
      return () => {
        cancelled = true;
        controller.abort();
      };
    }

    const run = () => {
      if (cancelled) {
        return;
      }
      controller = new AbortController();
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
          requestJson<CountResponse>(
            "/api/statistics/votes",
            controller.signal,
          ),
          requestJson<CountResponse>(
            "/api/statistics/ideas",
            controller.signal,
          ),
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

        if (
          categoriesResult.status !== "fulfilled" &&
          categoriesResult.reason
        ) {
          toast.error(t("adminErrorLoadVoteCategories"), {
            description:
              categoriesResult.reason instanceof Error
                ? categoriesResult.reason.message
                : undefined,
          });
        }

        if (
          ideasRecapResult.status !== "fulfilled" &&
          ideasRecapResult.reason
        ) {
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

        const previous = statsSnapshotRef.current;

        const nextStatsSummary: StatsSummary = {
          activeUsers:
            activeUsersResult.status === "fulfilled"
              ? Number(activeUsersResult.value?.count || 0)
              : previous.statsSummary.activeUsers,
          offlineUsers:
            offlineUsersResult.status === "fulfilled"
              ? Number(offlineUsersResult.value?.count || 0)
              : previous.statsSummary.offlineUsers,
          newIdeas:
            ideasDayResult.status === "fulfilled"
              ? Number(ideasDayResult.value?.count || 0)
              : previous.statsSummary.newIdeas,
          votes:
            votesDayResult.status === "fulfilled"
              ? Number(votesDayResult.value?.count || 0)
              : previous.statsSummary.votes,
        };

        const nextVoteCategories =
          categoriesResult.status === "fulfilled"
            ? (categoriesResult.value.record || []).map((item) => ({
                category: item.name || t("other"),
                votes: Number(item.posts || 0),
              }))
            : previous.voteCategories;

        const nextIdeasApproval =
          ideasRecapResult.status === "fulfilled"
            ? {
                approved: Number(ideasRecapResult.value?.approved || 0),
                waiting: Number(ideasRecapResult.value?.waiting || 0),
                declined: Number(ideasRecapResult.value?.declined || 0),
              }
            : previous.ideasApproval;

        let nextActivityPoints = previous.activityPoints;
        let nextAudienceSnapshot = previous.audienceSnapshot;

        if (usersActivityResult.status === "fulfilled") {
          const rangeStart =
            Date.now() - activityRangeDays * 24 * 60 * 60 * 1000;
          const formatter = new Intl.DateTimeFormat(locale, {
            month: "short",
            day: "numeric",
          });
          const mapped = Object.entries(usersActivityResult.value?.data || {})
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
            .filter((item) => item.timestamp >= rangeStart)
            .sort((a, b) => a.timestamp - b.timestamp);

          nextActivityPoints = mapped;

          const latest = mapped[mapped.length - 1];
          if (latest) {
            nextAudienceSnapshot = {
              active: latest.active ?? nextAudienceSnapshot.active,
              offline: latest.offline ?? nextAudienceSnapshot.offline,
            };
          }
        }

        const nextQualityScores =
          qualityRecapResult.status === "fulfilled"
            ? (() => {
                const computeScore = (grade?: Grade) => {
                  const good = Number(grade?.good ?? 0);
                  const bad = Number(grade?.bad ?? 0);
                  const total = good + bad;
                  if (total === 0) return 0;
                  return Math.round((good / total) * 100);
                };
                return [
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
                ];
              })()
            : previous.qualityScores;

        const nextMediaCoveragePoints =
          mediaCoverageResult.status === "fulfilled"
            ? (() => {
                const formatter = new Intl.DateTimeFormat(locale, {
                  month: "short",
                  day: "numeric",
                });
                return Object.entries(mediaCoverageResult.value?.medias || {})
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
              })()
            : previous.mediaCoveragePoints;

        const fallbackActive =
          previous.audienceSnapshot.active ??
          (activeUsersResult.status === "fulfilled"
            ? Number(activeUsersResult.value?.count ?? 0)
            : null);
        const fallbackOffline =
          previous.audienceSnapshot.offline ??
          (offlineUsersResult.status === "fulfilled"
            ? Number(offlineUsersResult.value?.count ?? 0)
            : null);
        nextAudienceSnapshot = {
          active: nextAudienceSnapshot.active ?? fallbackActive,
          offline: nextAudienceSnapshot.offline ?? fallbackOffline,
        };

        setStatsSummary(nextStatsSummary);
        setVoteCategories(nextVoteCategories);
        setIdeasApproval(nextIdeasApproval);
        setActivityPoints(nextActivityPoints);
        setMediaCoveragePoints(nextMediaCoveragePoints);
        setQualityScores(nextQualityScores);
        setAudienceSnapshot(nextAudienceSnapshot);

        writeAdminCache(cacheKey, {
          timestamp: Date.now(),
          statsSummary: nextStatsSummary,
          voteCategories: nextVoteCategories,
          ideasApproval: nextIdeasApproval,
          activityPoints: nextActivityPoints,
          mediaCoveragePoints: nextMediaCoveragePoints,
          qualityScores: nextQualityScores,
          audienceSnapshot: nextAudienceSnapshot,
        });
      };
      void load();
    };

    if (statsLoadGuardRef.current) {
      run();
    } else {
      statsLoadGuardRef.current = true;
      queueMicrotask(run);
    }

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activityRangeDays, locale, language]);

  useEffect(() => {
    let cancelled = false;
    let controller = new AbortController();
    const cacheKey = `${ADMIN_USERS_CACHE_KEY}:${language}`;
    const cached = readAdminCache<AdminUsersCache>(cacheKey);

    if (cached && Date.now() - cached.timestamp < ADMIN_CACHE_TTL_MS) {
      setUsers(cached.users);
      return () => {
        cancelled = true;
        controller.abort();
      };
    }

    const run = () => {
      if (cancelled) {
        return;
      }
      controller = new AbortController();
      const loadUsers = async () => {
        try {
          const list = await fetchUsers({ signal: controller.signal });
          const banResults = await Promise.allSettled(
            list.map((item) =>
              fetchUserBanInfo(item.userID, item.banned, {
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
          writeAdminCache(cacheKey, {
            timestamp: Date.now(),
            users: mapped,
          });
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
    };

    if (usersLoadGuardRef.current) {
      run();
    } else {
      usersLoadGuardRef.current = true;
      queueMicrotask(run);
    }

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [language]);

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

  const handleUserAction = async (
    user: User,
    action: "unblock" | "reset" | "message",
  ) => {
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

  const toggleQuickMenuGroup = (groupId: string) => {
    setQuickMenuExpanded((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  return (
    <TutorialProvider steps={adminTutorialSteps} storageKey="admin-tutorial-v1">
      <div className="relative min-h-screen bg-background text-foreground">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255, 255, 255, 0.12),transparent_32%),radial-gradient(circle_at_80%_0%,rgba(151, 151, 151, 0.15),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.02),transparent_50%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.03),transparent_50%)]" />
        <header
          className="fixed inset-x-0 z-30 px-4 sm:px-6 lg:px-10"
          style={{ top: "var(--maintenance-banner-height)" }}
        >
          <motion.div
            initial="hidden"
            animate="visible"
            variants={headerVariants}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="mx-auto max-w-6xl pt-3 sm:pt-4"
          >
            <motion.div
              layout
              transition={{ type: "spring", stiffness: 520, damping: 44 }}
              className={[
                "relative overflow-hidden rounded-full border",
                "bg-background/85 backdrop-blur-xl",
                "shadow-[0_24px_60px_-38px_rgba(0,0,0,0.65)]",
                headerCompact ? "border-border/60" : "border-border/70",
              ].join(" ")}
            >
              <motion.div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-foreground/20"
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: headerCompact ? 0.5 : 0.75 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                style={{ transformOrigin: "0% 50%" }}
              />

              <motion.div
                layout
                ref={headerBarRef}
                className={[
                  "relative flex items-center gap-2",
                  headerCompact
                    ? "px-2 py-2 sm:px-3"
                    : "px-3 py-2.5 sm:px-4 sm:py-3",
                ].join(" ")}
              >
                <DropdownMenu
                  open={quickMenuOpen}
                  onOpenChange={setQuickMenuOpen}
                >
                  <DropdownMenuTrigger asChild>
                    <motion.button
                      ref={quickMenuTriggerRef}
                      type="button"
                      data-tutorial="admin-functional-trigger"
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      className="group relative inline-flex h-10 items-center gap-2 overflow-hidden rounded-full border border-border/70 bg-background px-3 text-foreground hover:bg-foreground hover:text-background sm:px-4"
                      aria-label={t("adminSidebarGroupFunctional")}
                      title={t("adminSidebarGroupFunctional")}
                    >
                      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.18),transparent_55%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                      <Sparkles className="relative h-4 w-4 shrink-0" />
                      <span className="relative hidden text-sm font-semibold sm:inline">
                        {t("adminSidebarGroupFunctional")}
                      </span>
                    </motion.button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent
                    align="start"
                    sideOffset={10}
                    className="w-[calc(100vw-1rem)] sm:w-[320px] max-w-[95vw] overflow-hidden rounded-2xl border-border/70 bg-background/95 p-0 shadow-[0_28px_70px_-45px_rgba(0,0,0,0.7)] backdrop-blur-xl"
                  >
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="relative"
                    >
                      <div className="pointer-events-none absolute -left-14 -top-12 h-28 w-28 rounded-full bg-foreground/10 blur-2xl" />
                      <div className="pointer-events-none absolute -right-16 top-8 h-32 w-32 rounded-full bg-foreground/10 blur-2xl" />

                      <div className="relative border-b border-border/70 px-4 pb-3 pt-4">
                        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                          {t("adminSidebarGroupFunctional")}
                        </p>
                        <p className="text-sm font-semibold">
                          {t("adminPanelTitle")}
                        </p>
                      </div>

                      <div className="max-h-[250px] space-y-2 overflow-y-auto p-2">
                        {quickMenuGroups.map((group) => {
                          const expanded = Boolean(quickMenuExpanded[group.id]);
                          const GroupIcon = group.icon;
                          return (
                            <div
                              key={group.id}
                              className="overflow-hidden rounded-xl border border-border/70 bg-background/80"
                            >
                              <button
                                type="button"
                                onClick={() => toggleQuickMenuGroup(group.id)}
                                className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
                                aria-expanded={expanded}
                              >
                                <GroupIcon className="h-4 w-4 shrink-0" />
                                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
                                  {group.label}
                                </span>
                                <ChevronDown
                                  className={`h-4 w-4 shrink-0 transition-transform ${
                                    expanded ? "rotate-180" : ""
                                  }`}
                                />
                              </button>

                              <AnimatePresence initial={false}>
                                {expanded ? (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{
                                      duration: 0.2,
                                      ease: "easeOut",
                                    }}
                                    className="space-y-1 border-t border-border/60 p-2"
                                  >
                                    {group.items.map((item) => {
                                      const Icon = item.icon;
                                      const isActiveSection =
                                        item.section &&
                                        activeSection === item.section;
                                      return (
                                        <DropdownMenuItem
                                          key={item.id}
                                          asChild
                                          className={`rounded-lg px-2.5 py-2 ${
                                            isActiveSection
                                              ? "bg-foreground text-background focus:bg-foreground focus:text-background"
                                              : ""
                                          }`}
                                          onSelect={() => {
                                            if (item.section) {
                                              setActiveSection(item.section);
                                            }
                                            setQuickMenuOpen(false);
                                          }}
                                        >
                                          <Link
                                            href={item.href}
                                            className="group flex items-center gap-2.5"
                                          >
                                            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background">
                                              <Icon className="h-3.5 w-3.5" />
                                            </span>
                                            <span className="min-w-0 truncate text-[13px] font-medium">
                                              {item.label}
                                            </span>
                                          </Link>
                                        </DropdownMenuItem>
                                      );
                                    })}
                                  </motion.div>
                                ) : null}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </div>

                      <div className="border-t border-border/70 p-2">
                        <DropdownMenuItem
                          asChild
                          className="rounded-lg px-2.5 py-2"
                          onSelect={() => {
                            setQuickMenuOpen(false);
                          }}
                        >
                          <Link
                            href="/"
                            className="group flex items-center gap-2.5"
                          >
                            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background">
                              <House className="h-3.5 w-3.5" />
                            </span>
                            <span className="min-w-0 truncate text-[13px] font-medium">
                              {t("userProfileBackHome")}
                            </span>
                          </Link>
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          className="rounded-lg px-2.5 py-2"
                          onSelect={(event) => {
                            event.preventDefault();
                            toggleTheme();
                            setQuickMenuOpen(false);
                          }}
                        >
                          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background">
                            {mounted ? (
                              theme === "light" ? (
                                <Moon className="h-3.5 w-3.5" />
                              ) : (
                                <Sun className="h-3.5 w-3.5" />
                              )
                            ) : (
                              <span className="block h-3.5 w-3.5" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                            {t("adminTheme")}:{" "}
                            {theme === "light"
                              ? t("adminThemeLight")
                              : t("adminThemeDark")}
                          </span>
                        </DropdownMenuItem>
                      </div>
                    </motion.div>
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="pointer-events-none absolute inset-x-0 hidden items-center justify-center px-24 md:flex">
                  <p
                    ref={headerNoteRef}
                    className={`truncate text-center text-sm text-muted-foreground transition-opacity duration-150 ${
                      showHeaderNote ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    {t("adminHeaderNote")}
                  </p>
                </div>

                <div
                  ref={headerActionsRef}
                  className="ml-auto flex items-center gap-2 sm:gap-3"
                >
                  <motion.button
                    type="button"
                    onClick={toggleTheme}
                    data-tutorial="admin-theme-toggle"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="hidden h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-background text-foreground hover:bg-foreground hover:text-background sm:inline-flex"
                    aria-label={t("adminThemeToggle")}
                    title={t("adminThemeToggle")}
                  >
                    {mounted ? (
                      theme === "light" ? (
                        <Moon className="h-4 w-4" />
                      ) : (
                        <Sun className="h-4 w-4" />
                      )
                    ) : null}
                  </motion.button>

                  <AdminNotificationsMenu />

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        className="hidden h-10 items-center gap-2 rounded-full border border-border/70 bg-background px-3 text-sm font-semibold hover:bg-foreground hover:text-background sm:inline-flex"
                      >
                        <Globe className="h-4 w-4" />
                        <span className="w-[28px] text-center">{language}</span>
                        <ChevronDown className="h-3 w-3" />
                      </motion.button>
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
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-background p-0 text-sm font-semibold hover:bg-foreground hover:text-background sm:w-auto sm:justify-start sm:gap-2 sm:px-2 sm:pr-3"
                      >
                        <Avatar className="h-8 w-8">
                          {avatarSrc ? (
                            <AvatarImage
                              src={avatarSrc}
                              alt={displayName || user?.username || "admin"}
                            />
                          ) : null}
                          <AvatarFallback className="text-[10px] font-semibold">
                            {initials}
                          </AvatarFallback>
                        </Avatar>

                        <span className="hidden max-w-[140px] truncate sm:block">
                          {displayName || user?.username || "admin"}
                        </span>
                        <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
                      </motion.button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem
                        onClick={() => {
                          setRanksDialogOpen(true);
                        }}
                      >
                        <Sparkles className="h-4 w-4" />
                        {t("adminRanksTitle")}
                      </DropdownMenuItem>
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
              </motion.div>
            </motion.div>
          </motion.div>
        </header>

        <main className="px-4 pb-16 pt-28 sm:px-6 sm:pt-32 lg:px-10">
          <div className="mx-auto flex max-w-6xl flex-col gap-10">
            <motion.section
              id="users"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5 }}
              variants={sectionVariants}
              className="space-y-6 scroll-mt-32"
            >
              <div
                className="flex flex-wrap items-center justify-between gap-4"
                data-tutorial="admin-access-section"
              >
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

              <div className="grid gap-6">
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
                      const initials = getUserInitials(user.name);
                      const avatarSrc = resolveAvatarSrc(user.avatar);

                      return (
                        <div
                          key={user.id}
                          className="rounded-2xl border border-border/60 bg-background/70 p-4"
                        >
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-start gap-3 min-w-0">
                              <Avatar className="h-10 w-10">
                                {avatarSrc ? (
                                  <AvatarImage
                                    src={avatarSrc}
                                    alt={user.name}
                                  />
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
                                  <span>•</span>
                                  <span>{user.role}</span>
                                  <span>•</span>
                                  <span>{user.lastActive}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
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
                              <div className="flex items-center gap-2">
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
                </div>
              </div>
            </motion.section>

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
              <div
                className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
                data-tutorial="admin-overview-stats"
              >
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
                <div
                  className="min-w-0 rounded-3xl border border-border/70 bg-card/90 p-6 shadow-[0_24px_60px_-45px_rgba(0,0,0,0.5)]"
                  data-tutorial="admin-users-list"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">
                        {t("adminStatsActivityTitle")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("adminStatsActivitySubtitle")}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1 rounded-full border border-border/70 bg-background/60 p-1">
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
                  {hasActivityData ? (
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
                  ) : (
                    renderNoData("h-[220px] sm:h-[260px]")
                  )}
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
                    {hasStatusData ? (
                      <>
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
                      </>
                    ) : (
                      renderNoData("h-[200px] sm:h-[220px]")
                    )}
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
                    {hasParticipationData ? (
                      <>
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
                              className="flex items-center gap-2"
                            >
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{
                                  backgroundColor: `var(--color-chart-${index + 1})`,
                                }}
                              />
                              <span>{entry.status}</span>
                              <span className="font-semibold text-foreground">
                                {entry.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      renderNoData("h-[200px] sm:h-[220px]")
                    )}
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
                  {hasVotesByCategoryData ? (
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
                  ) : (
                    renderNoData("h-[220px] sm:h-[240px]")
                  )}
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
                  {hasQualityData ? (
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
                  ) : (
                    renderNoData("h-[220px]")
                  )}
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
                  {hasMediaCoverageData ? (
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
                  ) : (
                    renderNoData("h-[220px] sm:h-[240px]")
                  )}
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
                    <p className="text-sm">{t("adminMediaCoverageSubtitle")}</p>
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
    </TutorialProvider>
  );
}
