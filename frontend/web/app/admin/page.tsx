"use client"

import { Logo } from "@/components/logo"
import { useTheme } from "@/components/theme-provider"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { motion } from "framer-motion"
import {
  Ban,
  BarChart3,
  Bell,
  CheckCircle2,
  Image as ImageIcon,
  Lock,
  LogOut,
  MessageSquare,
  Moon,
  Shield,
  Sun,
  TrendingUp,
  Users,
  UserX,
  Vote,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
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
} from "recharts"
import { toast } from "sonner"
import { useAuth } from "@/components/auth-provider"

// import { useRouter } from "next/navigation"

const sidebarItems = [
  { id: "submissions", label: "Одобрение проектов", icon: CheckCircle2, href: "/admin/submissions" },
  { id: "users", label: "Пользователи", icon: Users, href: "/admin/users" },
  { id: "voting", label: "Голосование", icon: Vote, href: "#voting" },
  { id: "stats", label: "Статистика", icon: BarChart3, href: "#stats" },
  { id: "media", label: "Медиа", icon: ImageIcon, href: "#media" },
]

const statsCards: Array<{
  id: StatCardId
  title: string
  value: string
  delta: string
  note: string
  icon: typeof Users
}> = [
  {
    id: "activeUsers",
    title: "Активные пользователи",
    value: "3 482",
    delta: "+12%",
    note: "за сутки",
    icon: Users,
  },
  {
    id: "offlineUsers",
    title: "Оффлайн",
    value: "214",
    delta: "-3%",
    note: "сейчас не в сети",
    icon: UserX,
  },
  {
    id: "newIdeas",
    title: "Новых идей",
    value: "128",
    delta: "+18%",
    note: "за сутки",
    icon: TrendingUp,
  },
  {
    id: "votes",
    title: "Голосов сегодня",
    value: "1 946",
    delta: "+9%",
    note: "с 00:00",
    icon: Vote,
  },
]

const users = [
  {
    id: "USR-4821",
    name: "Анна Романова",
    email: "anna.romanova@cityideas.ru",
    role: "Администратор",
    status: "active",
    lastActive: "2 мин назад",
    reports: 0,
  },
  {
    id: "USR-9182",
    name: "Максим Иванов",
    email: "m.ivanov@cityideas.ru",
    role: "Модератор",
    status: "active",
    lastActive: "12 мин назад",
    reports: 1,
  },
  {
    id: "USR-7710",
    name: "Екатерина Лаврова",
    email: "lavrova.k@cityideas.ru",
    role: "Горожанин",
    status: "offline",
    lastActive: "1 ч назад",
    reports: 2,
  },
  {
    id: "USR-2339",
    name: "Илья Смирнов",
    email: "smirnov.i@cityideas.ru",
    role: "Горожанин",
    status: "banned",
    lastActive: "3 дня назад",
    reports: 6,
  },
]

type User = (typeof users)[number]

type SubmissionState = "pending" | "approved" | "declined"

type UsersActivityResponse = {
  data?: Record<string, { active?: number; offline?: number }>
}

type VoteCategoriesResponse = {
  record?: Array<{ name?: string; posts?: number }>
}

type CountResponse = {
  count?: number
}

type IdeasRecapResponse = {
  approved?: number
  waiting?: number
  declined?: number
}

type EditorsGrade = {
  good?: number
  bad?: number
}

type EditorsGradeResponse = {
  photos?: EditorsGrade
  videos?: EditorsGrade
  graphics?: EditorsGrade
}

type MediaCoverageResponse = {
  medias?: Record<string, { photos?: number; videos?: number }>
}

type StatCardId = "activeUsers" | "offlineUsers" | "newIdeas" | "votes"

type StatsSummary = Record<StatCardId, number | null>

const timeRanges = [
  { id: "day", label: "24h", days: 1 },
  { id: "3d", label: "3d", days: 3 },
  { id: "week", label: "7d", days: 7 },
]

const votingRounds = [
  {
    title: "Освещение в Центральном районе",
    progress: 72,
    voters: "1 543",
    end: "18 ноя",
  },
  {
    title: "Пешеходные переходы у школ",
    progress: 48,
    voters: "987",
    end: "24 ноя",
  },
  {
    title: "Дворовые площадки и спорт",
    progress: 63,
    voters: "1 214",
    end: "30 ноя",
  },
]

const activitySeed = [
  { day: "Пн", active: 3120, offline: 420 },
  { day: "Вт", active: 3280, offline: 380 },
  { day: "Ср", active: 2950, offline: 460 },
  { day: "Чт", active: 3490, offline: 320 },
  { day: "Пт", active: 3710, offline: 290 },
  { day: "Сб", active: 3880, offline: 260 },
  { day: "Вс", active: 3420, offline: 340 },
]

const votingSeed = [
  { category: "Благоустройство", votes: 820 },
  { category: "Транспорт", votes: 640 },
  { category: "Экология", votes: 540 },
  { category: "Дворы", votes: 380 },
]

const statusSeed = [
  { name: "Pending", value: 0, key: "pending" },
  { name: "Approved", value: 0, key: "approved" },
  { name: "Declined", value: 0, key: "declined" },
]

const mediaSeed = [
  { week: "Нед 1", photos: 240, videos: 110 },
  { week: "Нед 2", photos: 280, videos: 140 },
  { week: "Нед 3", photos: 320, videos: 160 },
  { week: "Нед 4", photos: 360, videos: 180 },
]

const qualitySeed = [
  { key: "photos", label: "Photos", score: 0 },
  { key: "videos", label: "Videos", score: 0 },
  { key: "graphics", label: "Graphics", score: 0 },
]



const activityConfig = {
  active: {
    label: "Активные",
    color: "var(--foreground)",
  },
  offline: {
    label: "Оффлайн",
    color: "var(--muted-foreground)",
  },
}

const votingConfig = {
  votes: {
    label: "Голоса",
    color: "var(--foreground)",
  },
}

const statusConfig = {
  pending: { label: "Pending", color: "var(--chart-4)" },
  approved: { label: "Approved", color: "var(--chart-2)" },
  declined: { label: "Declined", color: "var(--chart-1)" },
}

const mediaConfig = {
  photos: { label: "Фото", color: "var(--foreground)" },
  videos: { label: "Видео", color: "var(--muted-foreground)" },
}

const sectionVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
}

const listVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
}

const submissionStatusLabels: Record<SubmissionState, string> = {
  pending: "Pending",
  approved: "Approved",
  declined: "Declined",
}

const dayLabelFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  day: "2-digit",
})
const timeLabelFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
})

const formatCompactNumber = (value: number) => {
  if (!Number.isFinite(value)) {
    return "0"
  }

  const abs = Math.abs(value)
  if (abs >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}m`
  }
  if (abs >= 1_000) {
    return `${(value / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`
  }
  return `${value}`
}

const formatCategoryLabel = (value: string) => {
  const trimmed = value.trim()
  if (trimmed.length <= 12) {
    return trimmed
  }
  return `${trimmed.slice(0, 9)}...`
}

const normalizeTimestampMs = (value: number) => (value > 1_000_000_000_000 ? value : value * 1000)

const formatActivityLabel = (timestampMs: number, rangeDays: number) => {
  const date = new Date(timestampMs)
  return rangeDays <= 1 ? timeLabelFormatter.format(date) : dayLabelFormatter.format(date)
}

const fullNumberFormatter = new Intl.NumberFormat("en-US")

const formatFullNumber = (value: number) => fullNumberFormatter.format(value)

const formatMediaLabel = (timestampMs: number) => dayLabelFormatter.format(new Date(timestampMs))

const toQualityScore = (grade?: EditorsGrade) => {
  const good = Number(grade?.good ?? 0)
  const bad = Number(grade?.bad ?? 0)
  const total = good + bad
  if (total <= 0) {
    return 0
  }
  return Math.round((good / total) * 100)
}

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8080"
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, "")

async function requestJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
    signal,
  })

  if (response.ok) {
    return (await response.json()) as T
  }

  let message = `Request failed (${response.status})`
  try {
    const data = (await response.json()) as { error?: string }
    if (data?.error) {
      message = data.error
    }
  } catch {
    const text = await response.text()
    if (text) {
      message = text
    }
  }
  throw new Error(message)
}

export default function AdminPage() {
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()
  const { logout, user } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [rangeDays, setRangeDays] = useState(timeRanges[2].days)
  const [statsSummary, setStatsSummary] = useState<StatsSummary>({
    activeUsers: null,
    offlineUsers: null,
    newIdeas: null,
    votes: null,
  })
  const [activityData, setActivityData] = useState(activitySeed)
  const [statusData, setStatusData] = useState(statusSeed)
  const [votingData, setVotingData] = useState(votingSeed)
  const [mediaData, setMediaData] = useState(mediaSeed)
  const [qualityScores, setQualityScores] = useState(qualitySeed)
  const [selectedUserId, setSelectedUserId] = useState(users[0].id)
  const [banReason, setBanReason] = useState("Спам, мультиаккаунты, повторные жалобы")
  // const push = useRouter();
  const displayName = user?.displayName || user?.username || ""

  const handleLogout = async () => {
    await logout()
    router.push("/")
  }

  useEffect(() => {
    setMounted(true)
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    const sinceMs = Date.now() - rangeDays * 24 * 60 * 60 * 1000
    const sinceParam = encodeURIComponent(new Date(sinceMs).toISOString())

    const load = async () => {
      const [
        activityResult,
        categoriesResult,
        votesDayResult,
        ideasDayResult,
        activeUsersResult,
        offlineUsersResult,
        ideasRecapResult,
        qualityRecapResult,
        mediaCoverageResult,
      ] = await Promise.allSettled([
        requestJson<UsersActivityResponse>(`/api/statistics/activity/users/${rangeDays}`, controller.signal),
        requestJson<VoteCategoriesResponse>("/api/statistics/categories/4", controller.signal),
        requestJson<CountResponse>("/api/statistics/votes", controller.signal),
        requestJson<CountResponse>("/api/statistics/ideas", controller.signal),
        requestJson<CountResponse>(`/api/statistics/users/active/${sinceParam}`, controller.signal),
        requestJson<CountResponse>(`/api/statistics/users/offline/${sinceParam}`, controller.signal),
        requestJson<IdeasRecapResponse>("/api/statistics/ideas/recap", controller.signal),
        requestJson<EditorsGradeResponse>("/api/statistics/quality/recap", controller.signal),
        requestJson<MediaCoverageResponse>("/api/statistics/media/coverage?limit=4", controller.signal),
      ])

      if (controller.signal.aborted) {
        return
      }

      if (activityResult.status === "fulfilled") {
        const entries = Object.entries(activityResult.value?.data ?? {})
          .map(([key, value]) => {
            const timestamp = Number(key)
            if (!Number.isFinite(timestamp)) {
              return null
            }
            return {
              timestamp: normalizeTimestampMs(timestamp),
              active: Number(value?.active ?? 0),
              offline: Number(value?.offline ?? 0),
            }
          })
          .filter((item): item is { timestamp: number; active: number; offline: number } => Boolean(item))
          .sort((a, b) => a.timestamp - b.timestamp)
          .map((item) => ({
            day: formatActivityLabel(item.timestamp, rangeDays),
            active: item.active,
            offline: item.offline,
          }))

        setActivityData(entries)
      } else if (activityResult.reason) {
        toast.error("Failed to load audience activity", {
          description: activityResult.reason instanceof Error ? activityResult.reason.message : undefined,
        })
      }

      if (categoriesResult.status === "fulfilled") {
        const records = categoriesResult.value?.record ?? []
        setVotingData(
          records.map((record) => ({
            category: record?.name ?? "Unknown",
            votes: record?.posts ?? 0,
          })),
        )
      } else if (categoriesResult.reason) {
        toast.error("Failed to load vote categories", {
          description: categoriesResult.reason instanceof Error ? categoriesResult.reason.message : undefined,
        })
      }

      if (votesDayResult.status !== "fulfilled" && votesDayResult.reason) {
        toast.error("Failed to load vote count", {
          description: votesDayResult.reason instanceof Error ? votesDayResult.reason.message : undefined,
        })
      }

      if (ideasDayResult.status !== "fulfilled" && ideasDayResult.reason) {
        toast.error("Failed to load ideas count", {
          description: ideasDayResult.reason instanceof Error ? ideasDayResult.reason.message : undefined,
        })
      }

      if (activeUsersResult.status !== "fulfilled" && activeUsersResult.reason) {
        toast.error("Failed to load active users", {
          description: activeUsersResult.reason instanceof Error ? activeUsersResult.reason.message : undefined,
        })
      }

      if (offlineUsersResult.status !== "fulfilled" && offlineUsersResult.reason) {
        toast.error("Failed to load offline users", {
          description: offlineUsersResult.reason instanceof Error ? offlineUsersResult.reason.message : undefined,
        })
      }

      if (ideasRecapResult.status === "fulfilled") {
        const approved = Number(ideasRecapResult.value?.approved ?? 0)
        const waiting = Number(ideasRecapResult.value?.waiting ?? 0)
        const declined = Number(ideasRecapResult.value?.declined ?? 0)

        setStatusData([
          { key: "pending", name: submissionStatusLabels.pending, value: waiting },
          { key: "approved", name: submissionStatusLabels.approved, value: approved },
          { key: "declined", name: submissionStatusLabels.declined, value: declined },
        ])
      } else if (ideasRecapResult.reason) {
        toast.error("Failed to load ideas recap", {
          description: ideasRecapResult.reason instanceof Error ? ideasRecapResult.reason.message : undefined,
        })
      }

      if (qualityRecapResult.status === "fulfilled") {
        const grade = qualityRecapResult.value ?? {}
        setQualityScores([
          { key: "photos", label: "Photos", score: toQualityScore(grade.photos) },
          { key: "videos", label: "Videos", score: toQualityScore(grade.videos) },
          { key: "graphics", label: "Graphics", score: toQualityScore(grade.graphics) },
        ])
      } else if (qualityRecapResult.reason) {
        toast.error("Failed to load quality recap", {
          description: qualityRecapResult.reason instanceof Error ? qualityRecapResult.reason.message : undefined,
        })
      }

      if (mediaCoverageResult.status === "fulfilled") {
        const records = Object.entries(mediaCoverageResult.value?.medias ?? {})
          .map(([key, value]) => {
            const timestamp = Number(key)
            if (!Number.isFinite(timestamp)) {
              return null
            }
            return {
              timestamp: normalizeTimestampMs(timestamp),
              photos: Number(value?.photos ?? 0),
              videos: Number(value?.videos ?? 0),
            }
          })
          .filter((item): item is { timestamp: number; photos: number; videos: number } => Boolean(item))
          .sort((a, b) => a.timestamp - b.timestamp)
          .map((item) => ({
            week: formatMediaLabel(item.timestamp),
            photos: item.photos,
            videos: item.videos,
          }))

        setMediaData(records)
      } else if (mediaCoverageResult.reason) {
        toast.error("Failed to load media coverage", {
          description: mediaCoverageResult.reason instanceof Error ? mediaCoverageResult.reason.message : undefined,
        })
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
          votesDayResult.status === "fulfilled" ? Number(votesDayResult.value?.count ?? 0) : prev.votes,
      }))
    }

    load()

    return () => controller.abort()
  }, [rangeDays])

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? users[0],
    [selectedUserId],
  );

  // const routerpusher = push.push('/');

  const handleUserAction = (user: User, action: "block" | "unblock" | "reset" | "message") => {
    if (action === "block") {
      toast.error("Пользователь заблокирован", {
        description: `${user.name} - Причина: ${banReason}`,
      })
      return
    }

    if (action === "unblock") {
      toast.success("Блокировка снята", {
        description: `${user.name} снова может входить`,
      })
      return
    }

    if (action === "reset") {
      toast.message("Пароль сброшен", {
        description: `Ссылка отправлена на ${user.email}`,
      })
      return
    }

    toast.message("Сообщение отправлено", {
      description: `Пользователь ${user.name} получил уведомление`,
    })
  }

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      <div className="pointer-events-none absolute -top-40 right-0 h-[28rem] w-[28rem] rounded-full bg-foreground/5 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-[32rem] w-[32rem] rounded-full bg-foreground/10 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(0,0,0,0.04),transparent_45%,rgba(0,0,0,0.06))]" />

      <aside className="relative z-30 w-full border-b border-border/60 bg-background/90 backdrop-blur lg:fixed lg:inset-y-0 lg:left-0 lg:w-72 lg:border-b-0 lg:border-r">
        <div className="flex flex-col gap-6 p-4 sm:p-6">
          <div className="flex items-center justify-between lg:justify-start lg:gap-3">
            <Link href="/" aria-label="Go to main site">
              <Logo className="h-9 w-9 text-foreground" showText={false} />
            </Link>
            <div className="leading-tight">
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Город идей</p>
              <p className="text-sm font-semibold">Админ-панель</p>
            </div>
            <div className="hidden items-center gap-2 lg:flex">
              <Shield className="h-4 w-4 text-foreground" />
              <span className="text-xs font-semibold">Система защищена</span>
            </div>
          </div>

          <nav className="flex gap-3 overflow-x-auto pb-2 text-sm lg:flex-col lg:gap-2 lg:pb-0">
            {sidebarItems.map((item) => {
              const content = (
                <>
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground text-background shadow-lg shadow-foreground/20 transition-transform duration-300 group-hover:scale-105">
                    <item.icon className="h-4 w-4" />
                  </span>
                  <span className="font-medium">{item.label}</span>
                </>
              )

              if (item.href.startsWith("/")) {
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="group flex shrink-0 items-center gap-3 rounded-2xl border border-border/60 bg-card/80 px-4 py-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-foreground/30 hover:bg-card lg:rounded-xl"
                  >
                    {content}
                  </Link>
                )
              }

              return (
                <a
                  key={item.id}
                  href={item.href}
                  className="group flex shrink-0 items-center gap-3 rounded-2xl border border-border/60 bg-card/80 px-4 py-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-foreground/30 hover:bg-card lg:rounded-xl"
                >
                  {content}
                </a>
              )
            })}
          </nav>

          <div className="rounded-2xl border border-border/60 bg-card/80 p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground text-background">
                <Bell className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">Уведомления</p>
                <p className="text-xs text-muted-foreground">3 новых события</p>
              </div>
            </div>
            <button
              type="button"
              className="mt-4 w-full rounded-xl border border-foreground/20 bg-background px-4 py-2 text-xs font-semibold transition-colors duration-300 hover:bg-foreground hover:text-background"
              onClick={() =>
                toast.message("Лента обновлена", {
                  description: "Все события синхронизированы",
                })
              }
            >
              Обновить ленту
            </button>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card/80 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Тема</p>
            <div className="mt-3 flex items-center justify-between gap-3 text-sm font-semibold">
              <span>{mounted ? (theme === "light" ? "Светлая" : "Темная") : "Тема"}</span>
              <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-border/70 bg-background px-4 text-xs font-semibold transition-colors duration-300 hover:bg-foreground hover:text-background"
              >
                {mounted ? (theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />) : null}
                Переключить
              </button>
            </div>
          </div>
        </div>
      </aside>

      <div className="relative z-20 flex min-h-screen flex-col lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <div className="flex items-center gap-4">
              <Link href="/" aria-label="Go to main site">
                <Logo className="h-9 w-9 text-foreground" showText={false} />
              </Link>
              <div>
                <p className="text-lg font-semibold">Город идей | Административная панель</p>
                <p className="text-xs text-muted-foreground">Контроль, аналитика и модерация</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background px-4 py-2 text-sm font-semibold transition-colors duration-300 hover:bg-foreground hover:text-background"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
              <div className="flex items-center gap-3 rounded-full border border-border/60 bg-card/90 px-4 py-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-background text-sm font-semibold">
                  A
                </span>
                <div className="text-right leading-tight">
                  <p className="text-sm font-semibold">{displayName || user?.username || "admin"}</p>
                  <p className="text-xs text-muted-foreground">{user?.rank?.name || "Admin"}</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 pb-16 pt-8 sm:px-6">
          <div className="mx-auto flex max-w-6xl flex-col gap-12">
            <motion.section
              id="users"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5 }}
              variants={sectionVariants}
              className="space-y-6 scroll-mt-28"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Пользователи</p>
                  <h2 className="text-2xl font-bold">Контроль доступа и модерация</h2>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href="/admin/users"
                    className="rounded-full border border-border/70 px-4 py-2 text-sm font-semibold transition-all duration-300 hover:bg-foreground hover:text-background"
                  >
                    Полная таблица
                  </Link>
                  <button
                    type="button"
                    className="rounded-full border border-border/70 px-4 py-2 text-sm font-semibold transition-all duration-300 hover:bg-foreground hover:text-background"
                    onClick={() =>
                      toast.message("Отчет сформирован", {
                        description: "Экспорт пользователей готов",
                      })
                    }
                  >
                    Экспорт
                  </button>
                  <button
                    type="button"
                    className="rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-foreground/30"
                    onClick={() =>
                      toast.success("Приглашение отправлено", {
                        description: "Новый администратор получит письмо",
                      })
                    }
                  >
                    Пригласить
                  </button>
                </div>
              </div>

              <div className="admin-moderation-grid grid grid-cols-1 gap-6">
                <div className="order-1 min-w-0 rounded-3xl border border-border/70 bg-card/90 p-6 shadow-[0_24px_60px_-45px_rgba(0,0,0,0.5)]">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Последние пользователи</p>
                    <span className="text-xs text-muted-foreground">Обновлено минуту назад</span>
                  </div>
                  <div className="mt-4">
                    <div className="space-y-3 sm:hidden">
                      {users.map((user) => {
                        const ActionIcon = user.status === "banned" ? CheckCircle2 : Ban
                        const actionTitle = user.status === "banned" ? "Unblock user" : "Block user"

                        return (
                          <div key={user.id} className="rounded-2xl border border-border/60 bg-background/70 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold break-words">{user.name}</p>
                                <p className="text-xs text-muted-foreground break-all">{user.email}</p>
                                <p className="text-xs text-muted-foreground">{user.lastActive}</p>
                              </div>
                              <span
                                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                  user.status === "active"
                                    ? "bg-foreground text-background"
                                    : user.status === "offline"
                                      ? "bg-muted text-foreground"
                                      : "bg-destructive/10 text-destructive"
                                }`}
                              >
                                {user.status === "active"
                                  ? "Active"
                                  : user.status === "offline"
                                    ? "Offline"
                                    : "Banned"}
                              </span>
                            </div>
                            <div className="mt-3 space-y-2 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground uppercase tracking-[0.2em]">Role</span>
                                <span className="text-sm font-semibold">{user.role}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground uppercase tracking-[0.2em]">Reports</span>
                                <span className="text-sm font-semibold">{user.reports}</span>
                              </div>
                            </div>
                            <div className="mt-4 flex justify-end gap-2">
                              <button
                                type="button"
                                title={actionTitle}
                                className="flex h-9 w-9 items-center justify-center rounded-full border border-border/70 text-foreground transition-all duration-300 hover:bg-foreground hover:text-background"
                                onClick={() =>
                                  handleUserAction(user, user.status === "banned" ? "unblock" : "block")
                                }
                              >
                                <ActionIcon className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                title="Message user"
                                className="flex h-9 w-9 items-center justify-center rounded-full border border-border/70 text-foreground transition-all duration-300 hover:bg-foreground hover:text-background"
                                onClick={() => handleUserAction(user, "message")}
                              >
                                <MessageSquare className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div className="hidden overflow-hidden rounded-2xl border border-border/60 sm:block">
                      <table className="w-full text-left text-sm">
                      <thead className="bg-muted/60 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3">Пользователь</th>
                          <th className="px-4 py-3">Роль</th>
                          <th className="px-4 py-3">Статус</th>
                          <th className="px-4 py-3 text-right">Жалобы</th>
                          <th className="px-4 py-3 text-right">Действия</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((user) => {
                          const ActionIcon = user.status === "banned" ? CheckCircle2 : Ban
                          const actionTitle = user.status === "banned" ? "Снять бан" : "Заблокировать"

                          return (
                            <tr key={user.id} className="border-t border-border/50">
                              <td className="px-4 py-4">
                                <div className="font-semibold">{user.name}</div>
                                <div className="text-xs text-muted-foreground">{user.email}</div>
                                <div className="text-xs text-muted-foreground">{user.lastActive}</div>
                              </td>
                              <td className="px-4 py-4 text-sm">{user.role}</td>
                              <td className="px-4 py-4">
                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                    user.status === "active"
                                      ? "bg-foreground text-background"
                                      : user.status === "offline"
                                        ? "bg-muted text-foreground"
                                        : "bg-destructive/10 text-destructive"
                                  }`}
                                >
                                  {user.status === "active" ? "активен" : user.status === "offline" ? "оффлайн" : "бан"}
                                </span>
                              </td>
                              <td className="px-4 py-4 text-right text-sm font-semibold">{user.reports}</td>
                              <td className="px-4 py-4">
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    title={actionTitle}
                                    className="flex h-9 w-9 items-center justify-center rounded-full border border-border/70 text-foreground transition-all duration-300 hover:bg-foreground hover:text-background"
                                    onClick={() =>
                                      handleUserAction(user, user.status === "banned" ? "unblock" : "block")
                                    }
                                  >
                                    <ActionIcon className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    title="Сообщение"
                                    className="flex h-9 w-9 items-center justify-center rounded-full border border-border/70 text-foreground transition-all duration-300 hover:bg-foreground hover:text-background"
                                    onClick={() => handleUserAction(user, "message")}
                                  >
                                    <MessageSquare className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="order-2 flex flex-col gap-6">
                  <div className="rounded-3xl border border-border/70 bg-card/90 p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">Блокировка пользоваzтеля</p>
                        <p className="text-xs text-muted-foreground">Текущий выбор</p>
                      </div>
                      <Ban className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="mt-4 space-y-3">
                      <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Пользователь</label>
                      <select
                        className="w-full rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm"
                        value={selectedUserId}
                        onChange={(event) => setSelectedUserId(event.target.value)}
                      >
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name}
                          </option>
                        ))}
                      </select>
                      <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Причина</label>
                      <textarea
                        className="min-h-[90px] w-full rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm"
                        value={banReason}
                        onChange={(event) => setBanReason(event.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Эта причина будет показана пользователю на странице блокировки.
                      </p>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        className="rounded-2xl border border-border/70 px-4 py-2 text-xs font-semibold transition-colors duration-300 hover:bg-foreground hover:text-background"
                        onClick={() => handleUserAction(selectedUser, "reset")}
                      >
                        Сбросить пароль
                      </button>
                      <button
                        type="button"
                        className="rounded-2xl bg-foreground px-4 py-2 text-xs font-semibold text-background transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-foreground/30"
                        onClick={() => handleUserAction(selectedUser, "block")}
                      >
                        Заблокировать
                      </button>
                      <button
                        type="button"
                        className="rounded-2xl border border-border/70 px-4 py-2 text-xs font-semibold transition-colors duration-300 hover:bg-foreground hover:text-background"
                        onClick={() => handleUserAction(selectedUser, "unblock")}
                      >
                        Снять бан
                      </button>
                      <button
                        type="button"
                        className="rounded-2xl border border-border/70 px-4 py-2 text-xs font-semibold transition-colors duration-300 hover:bg-foreground hover:text-background"
                        onClick={() => handleUserAction(selectedUser, "message")}
                      >
                        Отправить сообщение
                      </button>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-border/70 bg-card/90 p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">Быстрые действия</p>
                        <p className="text-xs text-muted-foreground">Администрирование</p>
                      </div>
                      <Shield className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="mt-4 space-y-3 text-sm">
                      {[
                        { icon: CheckCircle2, label: "Review approvals" },
                        { icon: Lock, label: "Security audit" },
                        { icon: MessageSquare, label: "Support inbox" },
                      ].map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          className="flex w-full items-center justify-between rounded-2xl border border-border/70 bg-background px-4 py-3 text-left text-xs font-semibold transition-all duration-300 hover:-translate-y-0.5 hover:border-foreground/30"
                          onClick={() => toast.message(item.label)}
                        >
                          <span className="flex items-center gap-2">
                            <item.icon className="h-4 w-4" />
                            {item.label}
                          </span>
                          <span className="text-muted-foreground">&gt;</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>

            <motion.section
              id="voting"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5 }}
              variants={sectionVariants}
              className="space-y-6 scroll-mt-28"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Голосование</p>
                  <h2 className="text-2xl font-bold">Активные кампании</h2>
                </div>
                <button
                  type="button"
                  className="rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-foreground/30"
                  onClick={() =>
                    toast.success("Голосование создано", {
                      description: "Черновик сохранен",
                    })
                  }
                >
                  Новое голосование
                </button>
              </div>

              <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
                <div className="rounded-3xl border border-border/70 bg-card/90 p-6">
                  <div className="space-y-6">
                    {votingRounds.map((vote) => (
                      <div key={vote.title} className="rounded-2xl border border-border/60 bg-background/70 p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-base font-semibold">{vote.title}</p>
                            <p className="text-xs text-muted-foreground">Завершение: {vote.end}</p>
                          </div>
                          <span className="rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-background">
                            Активно
                          </span>
                        </div>
                        <div className="mt-4">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Прогресс</span>
                            <span>{vote.progress}%</span>
                          </div>
                          <div className="mt-2 h-2 rounded-full bg-muted">
                            <div
                              className="h-2 rounded-full bg-foreground transition-all duration-500"
                              style={{ width: `${vote.progress}%` }}
                            />
                          </div>
                          <div className="mt-3 text-xs text-muted-foreground">Голосов: {vote.voters}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-6">
                  <div className="rounded-3xl border border-border/70 bg-card/90 p-6">
                    <p className="text-sm font-semibold">Тональность обсуждений</p>
                    <p className="text-xs text-muted-foreground">Последние 24 часа</p>
                    <div className="mt-4 space-y-3 text-sm">
                      {[
                        { label: "Позитив", value: "64%" },
                        { label: "Нейтрально", value: "25%" },
                        { label: "Негатив", value: "11%" },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center justify-between">
                          <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            {item.label}
                          </span>
                          <span className="text-sm font-semibold">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-border/70 bg-card/90 p-6">
                    <p className="text-sm font-semibold">Модерация идей</p>
                    <p className="text-xs text-muted-foreground">Требуют внимания</p>
                    <div className="mt-4 space-y-3 text-xs">
                      {[
                        "Проверить 6 новых жалоб",
                        "Закрыть 2 дубликата",
                        "Уточнить описание у 4 заявок",
                      ].map((item) => (
                        <div key={item} className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-foreground" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="mt-4 w-full rounded-2xl border border-border/70 px-4 py-2 text-xs font-semibold transition-colors duration-300 hover:bg-foreground hover:text-background"
                      onClick={() => toast.message("Открыт список модерации")}
                    >
                      Перейти к списку
                    </button>
                  </div>
                </div>
              </div>
            </motion.section>

            <motion.section
              id="stats"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5 }}
              variants={sectionVariants}
              className="space-y-6 scroll-mt-28"
            >
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Статистика</p>
                <h2 className="text-2xl font-bold">Метрики платформы</h2>
              </div>

              <motion.div
                variants={listVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.3 }}
                className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
              >
                {statsCards.map((card) => {
                  const value = statsSummary[card.id]
                  const displayValue = value == null ? card.value : formatFullNumber(value)

                  return (
                    <motion.div
                      key={card.title}
                      variants={cardVariants}
                      className="rounded-3xl border border-border/70 bg-card/90 p-5 shadow-[0_18px_40px_-30px_rgba(0,0,0,0.5)]"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-foreground text-background shadow-lg shadow-foreground/20">
                          <card.icon className="h-5 w-5" />
                        </div>
                        <span className="text-xs font-semibold text-muted-foreground">{card.delta}</span>
                      </div>
                      <div className="mt-4 text-2xl font-bold">{displayValue}</div>
                      <p className="text-sm font-semibold">{card.title}</p>
                      <p className="text-xs text-muted-foreground">{card.note}</p>
                    </motion.div>
                  )
                })}
              </motion.div>

              <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
                <div className="rounded-3xl border border-border/70 bg-card/90 p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold">Активность аудитории</p>
                      <p className="text-xs text-muted-foreground">Неделя в разрезе</p>
                    </div>
                    <div className="flex items-center gap-1 rounded-full border border-border/70 bg-background/70 p-1 text-xs font-semibold">
                      {timeRanges.map((range) => {
                        const isActive = rangeDays === range.days
                        return (
                          <button
                            key={range.id}
                            type="button"
                            onClick={() => setRangeDays(range.days)}
                            aria-pressed={isActive}
                            className={`rounded-full px-3 py-1 transition-all duration-300 ${
                              isActive
                                ? "bg-foreground text-background shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {range.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <ChartContainer config={activityConfig} className="mt-6 h-[240px]">
                    <AreaChart data={activityData} margin={{ left: 8, right: 16 }}>
                      <CartesianGrid strokeDasharray="4 4" vertical={false} />
                      <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        width={48}
                        tickMargin={8}
                        tickFormatter={formatCompactNumber}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Area
                        type="monotone"
                        dataKey="active"
                        stroke="var(--color-active)"
                        fill="var(--color-active)"
                        fillOpacity={0.18}
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="offline"
                        stroke="var(--color-offline)"
                        fill="var(--color-offline)"
                        fillOpacity={0.08}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ChartContainer>
                </div>

                <div className="rounded-3xl border border-border/70 bg-card/90 p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold">Статусы заявок</p>
                      <p className="text-xs text-muted-foreground">Общий баланс</p>
                    </div>
                    <BarChart3 className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <ChartContainer config={statusConfig} className="mt-6 h-[240px]">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent hideIndicator nameKey="key" />} />
                      <Pie
                        data={statusData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={70}
                        outerRadius={95}
                        stroke="transparent"
                      >
                        {statusData.map((entry) => (
                          <Cell key={entry.key} fill={`var(--color-${entry.key})`} />
                        ))}
                      </Pie>
                      <ChartLegend content={<ChartLegendContent nameKey="key" />} />
                    </PieChart>
                  </ChartContainer>
                </div>
              </div>

              <div className="rounded-3xl border border-border/70 bg-card/90 p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold">Голоса по категориям</p>
                    <p className="text-xs text-muted-foreground">Топ-4 направления</p>
                  </div>
                  <span className="rounded-full border border-border/70 px-3 py-1 text-xs font-semibold">Месяц</span>
                </div>
                <ChartContainer config={votingConfig} className="mt-6 h-[240px]">
                  <BarChart data={votingData} margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} />
                    <XAxis
                      dataKey="category"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      minTickGap={12}
                      tickFormatter={(value) => formatCategoryLabel(String(value))}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={48}
                      tickMargin={8}
                      tickFormatter={formatCompactNumber}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="votes" fill="var(--color-votes)" radius={[8, 8, 0, 0]} barSize={36} />
                  </BarChart>
                </ChartContainer>
              </div>
            </motion.section>

            <motion.section
              id="media"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5 }}
              variants={sectionVariants}
              className="space-y-6 scroll-mt-28"
            >
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Медиа</p>
                <h2 className="text-2xl font-bold">Визуальная аналитика</h2>
              </div>

              <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
                <div className="rounded-3xl border border-border/70 bg-card/90 p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold">Охват медиа</p>
                      <p className="text-xs text-muted-foreground">Последние 4 недели</p>
                    </div>
                    <span className="rounded-full border border-border/70 px-3 py-1 text-xs font-semibold">
                      28 дней
                    </span>
                  </div>
                  <ChartContainer config={mediaConfig} className="mt-6 h-[240px]">
                    <BarChart data={mediaData} margin={{ left: 8, right: 16 }}>
                      <CartesianGrid strokeDasharray="4 4" vertical={false} />
                      <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        width={48}
                        tickMargin={8}
                        tickFormatter={formatCompactNumber}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Bar dataKey="photos" fill="var(--color-photos)" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="videos" fill="var(--color-videos)" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                </div>

                <div className="rounded-3xl border border-border/70 bg-card/90 p-6">
                  <p className="text-sm font-semibold">Качество контента</p>
                  <p className="text-xs text-muted-foreground">Оценка редакторов</p>
                  <div className="mt-6 space-y-4 text-sm">
                    {qualityScores.map((item) => (
                      <div key={item.label} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{item.label}</span>
                          <span className="text-sm font-semibold">{item.score}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted">
                          <div className="h-2 rounded-full bg-foreground" style={{ width: `${item.score}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>


            </motion.section>
          </div>
        </main>
      </div>
    </div>
  )
}
