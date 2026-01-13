"use client";

import Image from "next/image";

export const dynamic = "force-static";

export default function MaintenancePage() {
  return (
    <main className="relative min-h-dvh bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-64 w-[680px] -translate-x-1/2 rounded-full bg-foreground/10 blur-3xl dark:bg-foreground/15" />
        <div className="absolute -bottom-28 left-10 h-72 w-72 rounded-full bg-foreground/5 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/20 to-transparent" />
      </div>

      <div className="relative mx-auto flex min-h-dvh max-w-6xl items-center justify-center px-4 py-10 sm:px-6">
        <div className="grid w-full items-center gap-8 lg:grid-cols-2 lg:gap-10">
          <section className="order-2 lg:order-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.35em] text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Maintenance
            </div>

            <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
              Технические работы
            </h1>

            <p className="mt-4 max-w-xl text-base text-foreground/70 sm:text-lg">
              Мы обновляем сайт, чтобы он работал быстрее и стабильнее. Попробуй
              зайти чуть позже — всё вернём как можно скорее.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center justify-center rounded-full border border-foreground bg-foreground px-5 py-3 text-sm font-semibold text-background transition hover:opacity-90"
              >
                Обновить страницу
              </button>
            </div>

            <p className="mt-6 text-xs text-foreground/55">
              Код ошибки:{" "}
              <span className="font-mono text-foreground/70">
                MAINTENANCE_MODE_0
              </span>
            </p>
          </section>

          <section className="order-1 lg:order-2">
            <div className="relative overflow-hidden rounded-[2rem] border border-border bg-card/60 p-4">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(800px_circle_at_30%_10%,rgba(0,0,0,0.08),transparent_55%)] dark:bg-[radial-gradient(800px_circle_at_30%_10%,rgba(255,255,255,0.10),transparent_55%)]" />

              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[1.6rem] border border-border bg-background">
                <Image
                  src="/animated.gif"
                  alt="Технические работы"
                  fill
                  unoptimized
                  priority
                  className="object-cover"
                />
              </div>

              <div className="relative mt-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">
                    Мы скоро вернёмся 👋
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground truncate">
                    Идёт обновление. Спасибо за терпение.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
