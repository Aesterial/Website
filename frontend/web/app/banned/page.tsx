"use client"

import { motion } from "framer-motion"
import { Ban, ShieldAlert } from "lucide-react"
import Link from "next/link"

const banReason = "Спам, мультиаккаунты, повторные жалобы"

export default function BannedPage() {
  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      <div className="pointer-events-none absolute -top-32 right-0 h-[26rem] w-[26rem] rounded-full bg-foreground/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-[30rem] w-[30rem] rounded-full bg-foreground/5 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(0,0,0,0.06),_transparent_55%)]" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-lg rounded-[2.5rem] border border-border/70 bg-card/90 p-8 text-center shadow-[0_30px_70px_-50px_rgba(0,0,0,0.7)]"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-foreground text-background shadow-xl shadow-foreground/30"
          >
            <Ban className="h-7 w-7" />
          </motion.div>

          <h1 className="text-3xl font-bold">Вы забанены!</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Доступ к аккаунту временно ограничен. Если считаете блокировку ошибочной, напишите в поддержку.
          </p>

          <div className="mt-6 rounded-2xl border border-border/70 bg-background/70 px-5 py-4 text-left">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Причина</p>
                <p className="text-sm">{banReason}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-center">
            <img
              src="https://media.tenor.com/jTDsbgJ8cw4AAAAM/telegram-nekochan.gif"
              alt="Nekochan!!!"
              className="h-32 w-32"
              loading="lazy"
            />
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/"
              className="rounded-full border border-border/70 px-6 py-2 text-sm font-semibold transition-all duration-300 hover:bg-foreground hover:text-background"
            >
              На главную
            </Link>
            <a
              href="https://t.me/gorodidei_support_bot"
              className="rounded-full bg-foreground px-6 py-2 text-sm font-semibold text-background transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-foreground/30"
            >
              Связаться с поддержкой
            </a>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
