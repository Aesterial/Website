"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Logo } from "@/components/logo"
import { useTheme } from "@/components/theme-provider"
import { useAuth } from "@/components/auth-provider"
import {
  Ban,
  CheckCircle2,
  LogOut,
  MessageSquare,
  Moon,
  Search,
  Sun,
  Users,
} from "lucide-react"

const nameSeeds = [
  "Анна Романова",
  "Максим Иванов",
  "Екатерина Лаврова",
  "Илья Смирнов",
  "Мария Орлова",
  "Денис Кузнецов",
  "Ольга Петрова",
  "Сергей Сафонов",
  "Полина Назарова",
  "Артем Васильев",
  "Юлия Пономарева",
  "Никита Соколов",
  "Надежда Волкова",
  "Кирилл Белов",
  "Алена Филиппова",
  "Тимур Морозов",
  "Владимир Гончаров",
  "Елена Тимофеева",
  "Павел Жуков",
  "Светлана Котова",
  "Алексей Новиков",
  "Вероника Селезнева",
  "Роман Михайлов",
  "Ксения Логинова",
]

const roleCycle = ["Администратор", "Модератор", "Горожанин"]
const statusCycle = ["active", "active", "offline", "banned", "active", "offline"]
const lastActiveCycle = ["2 мин назад", "14 мин назад", "1 ч назад", "3 ч назад", "вчера", "3 дня назад"]

const users = nameSeeds.map((name, index) => ({
  id: `USR-${4200 + index}`,
  name,
  email: `user${index + 1}@cityideas.ru`,
  role: roleCycle[index % roleCycle.length],
  status: statusCycle[index % statusCycle.length],
  lastActive: lastActiveCycle[index % lastActiveCycle.length],
  reports: (index * 2) % 7,
}))

type User = (typeof users)[number]
type StatusFilter = "all" | "active" | "offline" | "banned"

const statusLabels: Record<StatusFilter, string> = {
  all: "Все",
  active: "Активные",
  offline: "Оффлайн",
  banned: "Заблокированные",
}

export default function AdminUsersPage() {
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()
  const { logout } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [page, setPage] = useState(1)


  const handleLogout = async () => {
    await logout()
    router.push("/")
  }
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setPage(1)
  }, [query, statusFilter])

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return users.filter((user) => {
      const matchesQuery =
        !normalized ||
        user.name.toLowerCase().includes(normalized) ||
        user.email.toLowerCase().includes(normalized)
      const matchesStatus = statusFilter === "all" || user.status === statusFilter
      return matchesQuery && matchesStatus
    })
  }, [query, statusFilter])

  const counts = useMemo(() => {
    return {
      total: users.length,
      active: users.filter((user) => user.status === "active").length,
      offline: users.filter((user) => user.status === "offline").length,
      banned: users.filter((user) => user.status === "banned").length,
    }
  }, [])

  const pageSize = 8
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageStart = filteredUsers.length === 0 ? 0 : (safePage - 1) * pageSize + 1
  const pageEnd = Math.min(safePage * pageSize, filteredUsers.length)
  const currentPageUsers = filteredUsers.slice((safePage - 1) * pageSize, safePage * pageSize)

  const handleAction = (user: User, action: "block" | "unblock" | "message") => {
    if (action === "block") {
      toast.error("Пользователь заблокирован", {
        description: `${user.name} - ограничения применены`,
      })
      return
    }

    if (action === "unblock") {
      toast.success("Блокировка снята", {
        description: `${user.name} снова может входить`,
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

      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link href="/" aria-label="Go to main site">
              <Logo className="h-9 w-9 text-foreground" showText={false} />
            </Link>
            <div>
              <p className="text-lg font-semibold">Таблица пользователей</p>
              <p className="text-xs text-muted-foreground">Город идей | Админ-панель</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-border/70 bg-background px-4 text-xs font-semibold transition-colors duration-300 hover:bg-foreground hover:text-background"
            >
              {mounted ? (theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />) : null}
              Тема
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-border/70 bg-background px-4 text-xs font-semibold transition-colors duration-300 hover:bg-foreground hover:text-background"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
            <div className="flex items-center gap-3 rounded-full border border-border/60 bg-card/90 px-4 py-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-background text-sm font-semibold">
                A
              </span>
              <div className="text-right leading-tight">
                <p className="text-sm font-semibold">admin</p>
                <p className="text-xs text-muted-foreground">Super admin</p>
              </div>
            </div>
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
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Статистика</p>
                <h2 className="text-2xl font-bold">База пользователей</h2>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href="/admin"
                  className="rounded-full border border-border/70 px-4 py-2 text-sm font-semibold transition-all duration-300 hover:bg-foreground hover:text-background"
                >
                  Назад в админку
                </Link>
                <button
                  type="button"
                  className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-foreground/30"
                  onClick={() =>
                    toast.message("Экспорт готов", {
                      description: "Файл пользователей сформирован",
                    })
                  }
                >
                  Экспорт
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Всего", value: counts.total },
                { label: "Активные", value: counts.active },
                { label: "Оффлайн", value: counts.offline },
                { label: "Заблокированы", value: counts.banned },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-border/60 bg-background/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{item.label}</p>
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
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Фильтры</p>
                <h3 className="text-lg font-semibold">Поиск и сегменты</h3>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Имя или почта"
                    className="h-10 w-full rounded-full border border-border/70 bg-background pl-9 pr-4 text-sm sm:w-64"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
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
                  Показано {pageStart}-{pageEnd} из {filteredUsers.length}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                Статус: {statusLabels[statusFilter]}
              </div>
            </div>

            <div className="mt-4">
              <div className="space-y-3 sm:hidden">
                {currentPageUsers.map((user) => {
                  const ActionIcon = user.status === "banned" ? CheckCircle2 : Ban
                  const actionTitle = user.status === "banned" ? "Unblock user" : "Block user"

                  return (
                    <div key={user.id} className="rounded-2xl border border-border/60 bg-background/70 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold break-words">{user.name}</p>
                          <p className="text-xs text-muted-foreground break-all">{user.email}</p>
                          <p className="text-xs text-muted-foreground break-all">{user.id}</p>
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
                          <span className="text-muted-foreground uppercase tracking-[0.2em]">Last active</span>
                          <span className="text-sm font-semibold">{user.lastActive}</span>
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
                          onClick={() => handleAction(user, user.status === "banned" ? "unblock" : "block")}
                        >
                          <ActionIcon className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Message user"
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-border/70 text-foreground transition-all duration-300 hover:bg-foreground hover:text-background"
                          onClick={() => handleAction(user, "message")}
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
                    <th className="px-4 py-3">Активность</th>
                    <th className="px-4 py-3 text-right">Жалобы</th>
                    <th className="px-4 py-3 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {currentPageUsers.map((user) => {
                    const ActionIcon = user.status === "banned" ? CheckCircle2 : Ban
                    const actionTitle = user.status === "banned" ? "Снять бан" : "Заблокировать"

                    return (
                      <tr key={user.id} className="border-t border-border/50">
                        <td className="px-4 py-4">
                          <div className="font-semibold">{user.name}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                          <div className="text-xs text-muted-foreground">{user.id}</div>
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
                            {user.status === "active"
                              ? "активен"
                              : user.status === "offline"
                                ? "оффлайн"
                                : "бан"}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-muted-foreground">{user.lastActive}</td>
                        <td className="px-4 py-4 text-right text-sm font-semibold">{user.reports}</td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              title={actionTitle}
                              className="flex h-9 w-9 items-center justify-center rounded-full border border-border/70 text-foreground transition-all duration-300 hover:bg-foreground hover:text-background"
                              onClick={() =>
                                handleAction(user, user.status === "banned" ? "unblock" : "block")
                              }
                            >
                              <ActionIcon className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              title="Сообщение"
                              className="flex h-9 w-9 items-center justify-center rounded-full border border-border/70 text-foreground transition-all duration-300 hover:bg-foreground hover:text-background"
                              onClick={() => handleAction(user, "message")}
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

            {filteredUsers.length === 0 && (
              <div className="mt-6 text-center text-sm text-muted-foreground">
                Ничего не найдено по вашему запросу.
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                Страница {safePage} из {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-full border border-border/70 px-4 py-2 text-xs font-semibold transition-colors duration-300 hover:bg-foreground hover:text-background disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={safePage <= 1}
                >
                  Назад
                </button>
                <button
                  type="button"
                  className="rounded-full border border-border/70 px-4 py-2 text-xs font-semibold transition-colors duration-300 hover:bg-foreground hover:text-background disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={safePage >= totalPages}
                >
                  Далее
                </button>
              </div>
            </div>
          </motion.section>
        </div>
      </main>
    </div>
  )
}
