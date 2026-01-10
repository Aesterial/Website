export const dynamic = "force-static";

export default function MaintenancePage() {
  return (
    <main className="min-h-dvh bg-background text-foreground flex items-center justify-center px-4">
      <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="mt-1 h-10 w-10 rounded-xl border border-border flex items-center justify-center">
            <span className="text-xl">🛠️</span>
          </div>

          <div className="flex-1">
            <h1 className="text-2xl font-semibold leading-tight">
              Технические работы
            </h1>
            <p className="mt-2 text-sm text-foreground/70">
              Мы обновляем сайт, чтобы он работал быстрее и стабильнее. Попробуй
              зайти чуть позже.
            </p>

            <div className="mt-4 rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-sm">
                Если это срочно — напиши в поддержку или проверь наш статус.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  className="inline-flex items-center justify-center rounded-xl border border-border px-4 py-2 text-sm hover:bg-muted transition"
                  href="/"
                >
                  На главную
                </a>
                <a
                  className="inline-flex items-center justify-center rounded-xl bg-foreground text-background px-4 py-2 text-sm hover:opacity-90 transition"
                  href="mailto:support@example.com"
                >
                  Написать в поддержку
                </a>
              </div>
              <p className="mt-3 text-xs text-foreground/60">
                (почту замени на свою)
              </p>
            </div>

            <p className="mt-4 text-xs text-foreground/60">
              Код ошибки: <span className="font-mono">MAINTENANCE_MODE</span>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
