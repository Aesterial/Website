"use client"

import { motion } from "framer-motion"
import Image from "next/image"
import Link from "next/link"
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
import { Logo } from "@/components/logo"
import { useTheme } from "@/components/theme-provider"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Toaster } from "@/components/ui/sonner"
import {
  BarChart3,
  Bell,
  Ban,
  CheckCircle2,
  Image as ImageIcon,
  Lock,
  MessageSquare,
  Moon,
  Shield,
  Sun,
  TrendingUp,
  Users,
  UserX,
  Vote,
} from "lucide-react"

const sidebarItems = [
  { id: "users", label: "Пользователи", icon: Users, href: "/admin/users" },
  { id: "voting", label: "Голосование", icon: Vote, href: "#voting" },
  { id: "stats", label: "Статистика", icon: BarChart3, href: "#stats" },
  { id: "media", label: "Медиа", icon: ImageIcon, href: "#media" },
]

const statsCards = [
  {
    title: "Активные пользователи",
    value: "3 482",
    delta: "+12%",
    note: "за 7 дней",
    icon: Users,
  },
  {
    title: "Оффлайн",
    value: "214",
    delta: "-3%",
    note: "сейчас не в сети",
    icon: UserX,
  },
  {
    title: "Новых идей",
    value: "128",
    delta: "+18%",
    note: "за сутки",
    icon: TrendingUp,
  },
  {
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

const activityData = [
  { day: "Пн", active: 3120, offline: 420 },
  { day: "Вт", active: 3280, offline: 380 },
  { day: "Ср", active: 2950, offline: 460 },
  { day: "Чт", active: 3490, offline: 320 },
  { day: "Пт", active: 3710, offline: 290 },
  { day: "Сб", active: 3880, offline: 260 },
  { day: "Вс", active: 3420, offline: 340 },
]

const votingData = [
  { category: "Благоустройство", votes: 820 },
  { category: "Транспорт", votes: 640 },
  { category: "Экология", votes: 540 },
  { category: "Дворы", votes: 380 },
]

const statusData = [
  { name: "Новые", value: 42, key: "new" },
  { name: "В работе", value: 68, key: "progress" },
  { name: "Решено", value: 31, key: "done" },
]

const mediaData = [
  { week: "Нед 1", photos: 240, videos: 110 },
  { week: "Нед 2", photos: 280, videos: 140 },
  { week: "Нед 3", photos: 320, videos: 160 },
  { week: "Нед 4", photos: 360, videos: 180 },
]

const mediaCards = [
  {
    title: "Фотоотчеты",
    subtitle: "Полевые обновления",
    image: "/aerial-view-of-city-block-kemerovo.jpg",
  },
  {
    title: "Видеоподборки",
    subtitle: "Визуальные истории",
    image: "/aerial-view-residential-area-kemerovo.jpg",
  },
  {
    title: "Снимки кварталов",
    subtitle: "Новые маршруты",
    image: "/aerial-satellite-view-kemerovo-city-block.jpg",
  },
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
  new: { label: "Новые", color: "var(--foreground)" },
  progress: { label: "В работе", color: "var(--muted-foreground)" },
  done: { label: "Решено", color: "var(--border)" },
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

export default function AdminPage() {
  const { theme, toggleTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState(users[0].id)
  const [banReason, setBanReason] = useState("Спам, мультиаккаунты, повторные жалобы")

  useEffect(() => {
    setMounted(true)
  }, [])

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? users[0],
    [selectedUserId],
  )

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
      <Toaster position="top-right" richColors closeButton />
      <div className="pointer-events-none absolute -top-40 right-0 h-[28rem] w-[28rem] rounded-full bg-foreground/5 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-[32rem] w-[32rem] rounded-full bg-foreground/10 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(0,0,0,0.04),transparent_45%,rgba(0,0,0,0.06))]" />

      <aside className="relative z-30 w-full border-b border-border/60 bg-background/90 backdrop-blur lg:fixed lg:inset-y-0 lg:left-0 lg:w-72 lg:border-b-0 lg:border-r">
        <div className="flex flex-col gap-6 p-6">
          <div className="flex items-center justify-between lg:justify-start lg:gap-3">
            <Logo className="h-9 w-9 text-foreground" showText={false} />
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
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
            <div className="flex items-center gap-4">
              <Logo className="h-9 w-9 text-foreground" showText={false} />
              <div>
                <p className="text-lg font-semibold">Город идей | Административная панель</p>
                <p className="text-xs text-muted-foreground">Контроль, аналитика и модерация</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-full border border-border/60 bg-card/90 px-4 py-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-background text-sm font-semibold">
                A
              </span>
              <div className="text-right leading-tight">
                <p className="text-sm font-semibold">admin</p>
                <p className="text-xs text-muted-foreground">Главный администратор</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 px-6 pb-16 pt-8">
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

              <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
                <div className="rounded-3xl border border-border/70 bg-card/90 p-6 shadow-[0_24px_60px_-45px_rgba(0,0,0,0.5)]">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Последние пользователи</p>
                    <span className="text-xs text-muted-foreground">Обновлено минуту назад</span>
                  </div>
                  <div className="mt-4 overflow-hidden rounded-2xl border border-border/60">
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

                <div className="flex flex-col gap-6">
                  <div className="rounded-3xl border border-border/70 bg-card/90 p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">Блокировка пользователя</p>
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
                        { icon: CheckCircle2, label: "Проверить жалобы" },
                        { icon: Lock, label: "Усилить модерацию" },
                        { icon: MessageSquare, label: "Шаблоны ответов" },
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
                {statsCards.map((card) => (
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
                    <div className="mt-4 text-2xl font-bold">{card.value}</div>
                    <p className="text-sm font-semibold">{card.title}</p>
                    <p className="text-xs text-muted-foreground">{card.note}</p>
                  </motion.div>
                ))}
              </motion.div>

              <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
                <div className="rounded-3xl border border-border/70 bg-card/90 p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold">Активность аудитории</p>
                      <p className="text-xs text-muted-foreground">Неделя в разрезе</p>
                    </div>
                    <span className="rounded-full border border-border/70 px-3 py-1 text-xs font-semibold">
                      7 дней
                    </span>
                  </div>
                  <ChartContainer config={activityConfig} className="mt-6 h-[240px]">
                    <AreaChart data={activityData} margin={{ left: 0, right: 0 }}>
                      <CartesianGrid strokeDasharray="4 4" vertical={false} />
                      <XAxis dataKey="day" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} width={30} />
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
                  <BarChart data={votingData} margin={{ left: 0, right: 0 }}>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} />
                    <XAxis dataKey="category" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} width={30} />
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
                    <BarChart data={mediaData} margin={{ left: 0, right: 0 }}>
                      <CartesianGrid strokeDasharray="4 4" vertical={false} />
                      <XAxis dataKey="week" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} width={30} />
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
                    {[
                      { label: "Фотоотчеты", score: "92%" },
                      { label: "Видеоистории", score: "87%" },
                      { label: "Графика", score: "78%" },
                    ].map((item) => (
                      <div key={item.label} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{item.label}</span>
                          <span className="text-sm font-semibold">{item.score}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted">
                          <div className="h-2 rounded-full bg-foreground" style={{ width: item.score }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <motion.div
                variants={listVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
                className="grid gap-4 md:grid-cols-3"
              >
                {mediaCards.map((card) => (
                  <motion.div
                    key={card.title}
                    variants={cardVariants}
                    className="group relative overflow-hidden rounded-3xl border border-border/70 bg-card/90"
                  >
                    <div className="relative h-48">
                      <Image
                        src={card.image}
                        alt={card.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 33vw"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent opacity-80 transition-opacity duration-300 group-hover:opacity-90" />
                    </div>
                    <div className="p-5">
                      <p className="text-sm font-semibold">{card.title}</p>
                      <p className="text-xs text-muted-foreground">{card.subtitle}</p>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </motion.section>
          </div>
        </main>
      </div>
    </div>
  )
}
