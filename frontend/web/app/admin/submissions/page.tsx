"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { CheckCircle2, Clock, LogOut, XCircle } from "lucide-react"
import { Logo } from "@/components/logo"
import { useAuth } from "@/components/auth-provider"
import { submissions, statusMeta, type SubmissionStatus } from "./data"

const statusOrder: SubmissionStatus[] = ["pending", "approved", "declined"]

const statusIcons = {
  pending: Clock,
  approved: CheckCircle2,
  declined: XCircle,
}

const statusStyles: Record<SubmissionStatus, string> = {
  pending: "bg-amber-500/10 text-amber-700",
  approved: "bg-emerald-500/10 text-emerald-700",
  declined: "bg-rose-500/10 text-rose-700",
}

export default function SubmissionsLandingPage() {
  const router = useRouter()
  const { logout } = useAuth()

  const handleLogout = async () => {
    await logout()
    router.push("/")
  }

  const counts = statusOrder.reduce<Record<SubmissionStatus, number>>((acc, status) => {
    acc[status] = submissions.filter((item) => item.status === status).length
    return acc
  }, {} as Record<SubmissionStatus, number>)

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
              <p className="text-lg font-semibold">Модерация проектов</p>
              <p className="text-xs text-muted-foreground">Категории заявок и быстрый переход к проверке.</p>
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
              href="/admin"
              className="rounded-full border border-border/70 px-4 py-2 text-sm font-semibold transition-all duration-300 hover:bg-foreground hover:text-background"
            >
              Admin panel
            </Link>
          </div>
        </div>
      </header>

      <main className="px-4 pb-16 pt-8 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-8">
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="rounded-3xl border border-border/70 bg-card/90 p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Категории</p>
                <h1 className="text-2xl font-bold sm:text-3xl">Одобрение проектов</h1>
              </div>
              <div className="text-sm text-muted-foreground">
                Всего заявок:{" "}
                <span className="text-foreground font-semibold">{submissions.length}</span>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {statusOrder.map((status) => {
                const Icon = statusIcons[status]
                const meta = statusMeta[status]
                return (
                  <Link
                    key={status}
                    href={`/admin/submissions/${status}`}
                    className="group flex flex-col justify-between rounded-3xl border border-border/70 bg-background/70 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-foreground/30"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${statusStyles[status]}`}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="text-3xl font-semibold">{counts[status]}</span>
                    </div>
                    <div className="mt-4">
                      <p className="text-base font-semibold">{meta.label}</p>
                      <p className="text-xs text-muted-foreground">{meta.description}</p>
                    </div>
                    <div className="mt-4 text-xs font-semibold text-muted-foreground group-hover:text-foreground">
                      Открыть список →
                    </div>
                  </Link>
                )
              })}
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="rounded-3xl border border-border/70 bg-card/90 p-6"
          >
            <h2 className="text-lg font-semibold">Как работает модерация</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Открывайте категорию, выбирайте проект, изучайте подробности и отправляйте решение.
              Для отклонения требуется указать причину — она будет сохранена вместе с заявкой.
            </p>
          </motion.section>
        </div>
      </main>
    </div>
  )
}
