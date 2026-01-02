"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { CalendarDays, ExternalLink, LogOut, MapPin, UserCircle2 } from "lucide-react"
import { Logo } from "@/components/logo"
import { useAuth } from "@/components/auth-provider"
import { submissions, statusMeta, type Submission, type SubmissionStatus } from "../data"

const statusBadgeStyles: Record<SubmissionStatus, string> = {
  pending: "bg-amber-500/10 text-amber-700",
  approved: "bg-emerald-500/10 text-emerald-700",
  declined: "bg-rose-500/10 text-rose-700",
}

const statusLabel: Record<SubmissionStatus, string> = {
  pending: "Ожидает решения",
  approved: "Одобрено",
  declined: "Отклонено",
}

type StatusPageProps = {
  status: SubmissionStatus
}

export default function SubmissionStatusPage({ status }: StatusPageProps) {
  const router = useRouter()
  const { logout } = useAuth()

  const handleLogout = async () => {
    await logout()
    router.push("/")
  }
  const filtered = useMemo(
    () => submissions.filter((item) => item.status === status),
    [status],
  )
  const [selectedId, setSelectedId] = useState<string | null>(filtered[0]?.id ?? null)

  useEffect(() => {
    setSelectedId(filtered[0]?.id ?? null)
  }, [filtered])

  const selected = filtered.find((item) => item.id === selectedId) ?? null

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
              <p className="text-lg font-semibold">{statusMeta[status].label}</p>
              <p className="text-xs text-muted-foreground">{statusMeta[status].description}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background px-4 py-2 text-sm font-semibold transition-all duration-300 hover:bg-foreground hover:text-background"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
            <Link
              href="/admin/submissions"
              className="rounded-full border border-border/70 px-4 py-2 text-sm font-semibold transition-all duration-300 hover:bg-foreground hover:text-background"
            >
              Категории
            </Link>
            <Link
              href="/admin"
              className="rounded-full border border-border/70 px-4 py-2 text-sm font-semibold transition-all duration-300 hover:bg-foreground hover:text-background"
            >
              Админка
            </Link>
          </div>
        </div>
      </header>

      <main className="px-4 pb-16 pt-8 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-8">
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="rounded-3xl border border-border/70 bg-card/90 p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Список проектов</p>
                <h1 className="text-2xl font-bold sm:text-3xl">{statusMeta[status].label}</h1>
              </div>
              <div className="text-sm text-muted-foreground">
                Всего: <span className="text-foreground font-semibold">{filtered.length}</span>
              </div>
            </div>
          </motion.section>

          {filtered.length === 0 ? (
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="rounded-3xl border border-border/70 bg-card/90 p-10 text-center"
            >
              <p className="text-lg font-semibold">В этой категории пока нет проектов.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Вернитесь позже или выберите другую категорию.
              </p>
              <Link
                href="/admin/submissions"
                className="mt-5 inline-flex rounded-full border border-border/70 px-5 py-2 text-sm font-semibold transition-all duration-300 hover:bg-foreground hover:text-background"
              >
                К списку категорий
              </Link>
            </motion.section>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
              <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.05 }}
                className="rounded-3xl border border-border/70 bg-card/90 p-5"
              >
                <div className="space-y-4">
                  {filtered.map((item) => (
                    <ProjectCard
                      key={item.id}
                      item={item}
                      selected={item.id === selectedId}
                      onSelect={() => setSelectedId(item.id)}
                      status={status}
                    />
                  ))}
                </div>
              </motion.section>

              <motion.aside
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="rounded-3xl border border-border/70 bg-card/90 p-6"
              >
                {selected ? (
                  <div className="space-y-5">
                    <div className="relative h-40 overflow-hidden rounded-2xl">
                      <img
                        src={selected.coverImage}
                        alt={selected.title}
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/10 to-transparent" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        <span>{selected.category}</span>
                        <span className="h-1 w-1 rounded-full bg-muted-foreground/60" />
                        <span className={`rounded-full px-2 py-0.5 font-semibold ${statusBadgeStyles[status]}`}>
                          {statusLabel[status]}
                        </span>
                      </div>
                      <h2 className="mt-2 text-xl font-semibold">{selected.title}</h2>
                      <p className="mt-2 text-sm text-muted-foreground">{selected.summary}</p>
                    </div>
                    <div className="grid gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <UserCircle2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Автор:</span>
                        <span className="font-semibold">{selected.authorName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Дата:</span>
                        <span className="font-semibold">{selected.submittedAt}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Локация:</span>
                        <span className="font-semibold">{selected.location}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">Источник: {selected.source}</div>
                    </div>
                    <Link
                      href={`/admin/submissions/${selected.id}`}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-foreground/30"
                    >
                      Открыть карточку проекта
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Выберите проект слева, чтобы увидеть сведения и перейти к полной карточке.
                  </p>
                )}
              </motion.aside>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

type ProjectCardProps = {
  item: Submission
  selected: boolean
  onSelect: () => void
  status: SubmissionStatus
}

function ProjectCard({ item, selected, onSelect, status }: ProjectCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full gap-4 rounded-3xl border border-border/60 bg-background/70 p-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-foreground/30 ${
        selected ? "ring-2 ring-foreground/15 border-foreground/40" : ""
      }`}
    >
      <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-2xl">
        <img src={item.coverImage} alt={item.title} className="h-full w-full object-cover" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <span>{item.category}</span>
          <span className={`rounded-full px-2 py-0.5 font-semibold ${statusBadgeStyles[status]}`}>
            {statusLabel[status]}
          </span>
        </div>
        <p className="mt-2 text-base font-semibold">{item.title}</p>
        <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
          <span>Автор: {item.authorName}</span>
          <span>Дата: {item.submittedAt}</span>
          <span>Локация: {item.location}</span>
        </div>
      </div>
    </button>
  )
}
