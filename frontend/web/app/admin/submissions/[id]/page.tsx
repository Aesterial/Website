"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  LogOut,
  MapPin,
  UserCircle2,
  XCircle,
} from "lucide-react"
import { Logo } from "@/components/logo"
import { useAuth } from "@/components/auth-provider"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { statusMeta, submissions, type SubmissionStatus } from "../data"

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

type SubmissionDetailPageProps = {
  params: {
    id: string
  }
}

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8080"
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, "")

async function postDecision(path: string, payload?: unknown) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: payload ? JSON.stringify(payload) : undefined,
  })

  if (response.ok) {
    return
  }

  let message = `Ошибка запроса (${response.status})`
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

export default function SubmissionDetailPage({ params }: SubmissionDetailPageProps) {
  const router = useRouter()
  const { logout } = useAuth()

  const handleLogout = async () => {
    await logout()
    router.push("/")
  }
  const submission = useMemo(() => submissions.find((item) => item.id === params.id) ?? null, [params.id])
  const [currentStatus, setCurrentStatus] = useState<SubmissionStatus | null>(submission?.status ?? null)
  const [actionLoading, setActionLoading] = useState<"approve" | "decline" | null>(null)
  const [declineOpen, setDeclineOpen] = useState(false)
  const [declineReason, setDeclineReason] = useState("")
  const [declineError, setDeclineError] = useState<string | null>(null)

  if (!submission) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center gap-4 px-4 text-center">
        <Link href="/" aria-label="Go to main site">
          <Logo className="h-10 w-10 text-foreground" showText={false} />
        </Link>
        <div>
          <p className="text-lg font-semibold">Проект не найден.</p>
          <p className="text-sm text-muted-foreground">Проверьте ссылку или вернитесь к списку.</p>
        </div>
        <Link
          href="/admin/submissions"
          className="rounded-full border border-border/70 px-5 py-2 text-sm font-semibold transition-all duration-300 hover:bg-foreground hover:text-background"
        >
          Вернуться к категориям
        </Link>
      </div>
    )
  }

  const activeStatus = currentStatus ?? submission.status
  const statusInfo = statusMeta[activeStatus]
  const statusClass = statusBadgeStyles[activeStatus]
  const statusText = statusLabel[activeStatus]
  const isApproving = actionLoading === "approve"
  const isDeclining = actionLoading === "decline"

  const handleApprove = async () => {
    if (activeStatus === "approved") {
      return
    }
    setActionLoading("approve")
    try {
      await postDecision(`/api/submissions/${submission.id}/approve`)
      setCurrentStatus("approved")
      toast.success("Проект одобрен", {
        description: "Решение отправлено в систему.",
      })
    } catch (error) {
      toast.error("Не удалось одобрить", {
        description: error instanceof Error ? error.message : "Попробуйте еще раз.",
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleDecline = async () => {
    const reason = declineReason.trim()
    if (!reason) {
      setDeclineError("Укажите причину отклонения.")
      return
    }
    setDeclineError(null)
    setActionLoading("decline")
    try {
      await postDecision(`/api/submissions/${submission.id}/decline`, { reason })
      setCurrentStatus("declined")
      setDeclineOpen(false)
      setDeclineReason("")
      toast.success("Проект отклонен", {
        description: "Причина сохранена и отправлена заявителю.",
      })
    } catch (error) {
      toast.error("Не удалось отклонить", {
        description: error instanceof Error ? error.message : "Попробуйте еще раз.",
      })
    } finally {
      setActionLoading(null)
    }
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
              <p className="text-lg font-semibold">Карточка проекта</p>
              <p className="text-xs text-muted-foreground">{statusInfo.label}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background px-4 py-2 text-sm font-semibold transition-all duration-300 hover:bg-foreground hover:text-background"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
            <Link
              href={`/admin/submissions/${activeStatus}`}
              className="rounded-full border border-border/70 px-4 py-2 text-sm font-semibold transition-all duration-300 hover:bg-foreground hover:text-background"
            >
              Назад к списку
            </Link>
            <Link
              href="/admin/submissions"
              className="rounded-full border border-border/70 px-4 py-2 text-sm font-semibold transition-all duration-300 hover:bg-foreground hover:text-background"
            >
              Категории
            </Link>
          </div>
        </div>
      </header>

      <main className="px-4 pb-16 pt-8 sm:px-6">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.6fr_0.7fr]">
          <section className="rounded-3xl border border-border/70 bg-card/90 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  <span>{submission.category}</span>
                  <span className={`rounded-full px-2 py-0.5 font-semibold ${statusClass}`}>{statusText}</span>
                </div>
                <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{submission.title}</h1>
                <p className="mt-3 text-sm text-muted-foreground">{submission.summary}</p>
              </div>
              <Link
                href="#media"
                className="inline-flex items-center gap-2 rounded-full border border-border/70 px-4 py-2 text-xs font-semibold transition-all duration-300 hover:bg-foreground hover:text-background"
              >
                Перейти к фото
                <ExternalLink className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-6 grid gap-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <UserCircle2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Автор:</span>
                <span className="font-semibold">{submission.authorName}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Дата:</span>
                <span className="font-semibold">{submission.submittedAt}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Локация:</span>
                <span className="font-semibold">{submission.location}</span>
              </div>
              <div className="text-xs text-muted-foreground">Город: {submission.city}</div>
              <div className="text-xs text-muted-foreground">Источник: {submission.source}</div>
            </div>

            <div className="mt-6 rounded-2xl border border-border/70 bg-background/70 p-5">
              <p className="text-sm font-semibold">Описание проекта</p>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{submission.description}</p>
            </div>

            <div id="media" className="mt-6">
              <p className="text-sm font-semibold">Материалы</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {submission.images.map((image) => (
                  <div key={image} className="relative h-48 overflow-hidden rounded-2xl">
                    <img src={image} alt={submission.title} className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          </section>

          <aside className="rounded-3xl border border-border/70 bg-card/90 p-6 lg:sticky lg:top-24 h-fit">
            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Статус</p>
                <div className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>
                  {statusText}
                </div>
              </div>

              <div className="grid gap-3">
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={isApproving || isDeclining || activeStatus === "approved"}
                  className="flex items-center justify-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-foreground/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {activeStatus === "approved" ? "Проект уже одобрен" : isApproving ? "Отправка..." : "Одобрить"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeclineError(null)
                    setDeclineOpen(true)
                  }}
                  disabled={isApproving || isDeclining || activeStatus === "declined"}
                  className="flex items-center justify-center gap-2 rounded-full border border-border/70 px-4 py-2 text-sm font-semibold text-foreground transition-all duration-300 hover:bg-foreground hover:text-background disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <XCircle className="h-4 w-4" />
                  {activeStatus === "declined" ? "Проект отклонен" : "Отклонить"}
                </button>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/70 p-4 text-xs text-muted-foreground">
                При отклонении нужно указать причину. Она будет отправлена вместе с результатом
                проверки проекта.
              </div>
            </div>
          </aside>
        </div>
      </main>

      <Dialog
        open={declineOpen}
        onOpenChange={(open) => {
          setDeclineOpen(open)
          if (!open) {
            setDeclineReason("")
            setDeclineError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Причина отклонения</DialogTitle>
            <DialogDescription>
              Укажите конкретную причину, чтобы заявитель понял, что нужно исправить.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Textarea
              value={declineReason}
              onChange={(event) => setDeclineReason(event.target.value)}
              placeholder="Например: нет подтверждающих фото или заявка не соответствует регламенту."
              rows={4}
            />
            {declineError ? <p className="text-sm text-destructive">{declineError}</p> : null}
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setDeclineOpen(false)}
              className="rounded-full border border-border/70 px-4 py-2 text-sm font-semibold transition-colors duration-300 hover:bg-foreground hover:text-background"
              disabled={isDeclining}
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleDecline}
              disabled={isDeclining}
              className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-foreground/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDeclining ? "Отправка..." : "Отклонить проект"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
