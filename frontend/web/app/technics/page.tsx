export const dynamic = "force-static";

export default function TechnicsPage() {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.18),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(14,116,144,0.18),transparent_45%),linear-gradient(160deg,rgba(15,23,42,0.06),rgba(255,255,255,0.92))] text-foreground">
      <div className="pointer-events-none absolute -top-24 right-[-10%] h-72 w-72 rounded-full bg-amber-300/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-20%] left-[-5%] h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/20 to-transparent" />

      <style>{`
        @keyframes rise {
          0% { opacity: 0; transform: translateY(18px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>

      <div className="relative mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
        <section className="space-y-6" style={{ animation: "rise 0.8s ease-out both" }}>
          <div className="inline-flex items-center gap-2 rounded-full border border-foreground/15 bg-white/70 px-4 py-2 text-xs uppercase tracking-[0.3em] shadow-sm">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Технический перерыв
          </div>

          <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
            Мы настраиваем инфраструктуру, чтобы идеи летали быстрее.
          </h1>
          <p className="max-w-xl text-base text-foreground/70">
            Сейчас идет обновление сервиса. Ничего не потеряется: заявки сохранены,
            уведомления вернутся в работу сразу после завершения техобслуживания.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-foreground/10 bg-white/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-foreground/60">Статус</p>
              <p className="mt-2 text-lg font-semibold">Обновление ядра</p>
              <p className="mt-1 text-sm text-foreground/60">Оценка: до 09:00 МСК</p>
            </div>
            <div className="rounded-2xl border border-foreground/10 bg-white/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-foreground/60">Контакт</p>
              <p className="mt-2 text-lg font-semibold">Команда поддержки</p>
              <p className="mt-1 text-sm text-foreground/60">support@example.com</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              className="inline-flex items-center justify-center rounded-full border border-foreground/20 px-5 py-2 text-sm font-semibold transition hover:bg-foreground hover:text-background"
              href="/"
            >
              На главную
            </a>
            <a
              className="inline-flex items-center justify-center rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background transition hover:opacity-90"
              href="/support"
            >
              Написать в поддержку
            </a>
          </div>

          <div className="grid gap-3 rounded-2xl border border-foreground/10 bg-white/70 p-4 text-sm text-foreground/70">
            <p className="text-xs uppercase tracking-[0.2em] text-foreground/60">
              Что уже сделано
            </p>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600">&#10003;</span>
              Миграция базы заявок
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600">&#10003;</span>
              Оптимизация очередей
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/20 text-amber-600">&#10003;</span>
              Проверка API и отчетов
            </div>
          </div>
        </section>

        <aside
          className="rounded-3xl border border-foreground/15 bg-white/80 p-5 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.35)]"
          style={{ animation: "rise 0.9s ease-out both", animationDelay: "0.1s" }}
        >
          <div className="relative overflow-hidden rounded-2xl border border-foreground/10 bg-gradient-to-br from-amber-50 via-white to-cyan-50">
            <img
              src="/animated.gif"
              alt="Анимация обслуживания"
              className="h-64 w-full object-cover"
              style={{ animation: "float 8s ease-in-out infinite" }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-4">
              <p className="text-xs uppercase tracking-[0.2em] text-white/80">Live</p>
              <p className="text-lg font-semibold text-white">Техслужба в эфире</p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-foreground/10 bg-white/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-foreground/60">
                Режим
              </p>
              <p className="mt-2 text-lg font-semibold">MAINTENANCE_MODE</p>
              <p className="mt-1 text-sm text-foreground/60">
                Автоматическое восстановление после апдейта.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-foreground/10 bg-white/70 p-4 text-sm">
                <p className="text-xs uppercase tracking-[0.2em] text-foreground/60">Сервис</p>
                <p className="mt-2 font-semibold">Трекинг идей</p>
              </div>
              <div className="rounded-2xl border border-foreground/10 bg-white/70 p-4 text-sm">
                <p className="text-xs uppercase tracking-[0.2em] text-foreground/60">Ответы</p>
                <p className="mt-2 font-semibold">Модерация и лайки</p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

