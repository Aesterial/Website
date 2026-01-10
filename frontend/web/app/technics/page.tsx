import Image from "next/image";

export const dynamic = "force-static";

export default function MaintenancePage() {
  return (
    <main className="min-h-dvh bg-background text-foreground flex items-center justify-center px-4">
      <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="mt-1 h-10 w-10 rounded-xl border border-border flex items-center justify-center overflow-hidden">
            <Image
              src="/animated.gif"
              alt="Технические работы"
              width={40}
              height={40}
              unoptimized
              className="h-full w-full object-cover"
              priority
            />
          </div>

          <div className="flex-1">
            <h1 className="text-2xl font-semibold leading-tight">
              Технические работы
            </h1>
            <p className="mt-2 text-sm text-foreground/70">
              Мы обновляем сайт, чтобы он работал быстрее и стабильнее. Попробуй
              зайти чуть позже.
            </p>

        

            <p className="mt-4 text-xs text-foreground/60">
              Код ошибки: <span className="font-mono">MAINTENANCE_MODE_0</span>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
