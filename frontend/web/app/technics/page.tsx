"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ApiError,
  fetchMaintenanceActive,
  fetchMaintenanceData,
  type ApiMaintenanceData,
} from "@/lib/api";
import { useAuth } from "@/components/auth-provider";

export const dynamic = "force-static";

const DEFAULT_DESCRIPTION =
  "Мы обновляем сайт, чтобы он работал быстрее и стабильнее. Попробуй зайти чуть позже — всё вернём как можно скорее.";
const DEFAULT_REQUEST_ID = "MAINTENANCE_MODE_0";

const pluralRules = new Intl.PluralRules("ru");
type PluralForm = "one" | "few" | "many" | "other";
const unitLabels = {
  second: { one: "секунду", few: "секунды", many: "секунд", other: "секунды" },
  minute: { one: "минуту", few: "минуты", many: "минут", other: "минуты" },
  hour: { one: "час", few: "часа", many: "часов", other: "часа" },
  day: { one: "день", few: "дня", many: "дней", other: "дня" },
  month: { one: "месяц", few: "месяца", many: "месяцев", other: "месяца" },
  year: { one: "год", few: "года", many: "лет", other: "года" },
};

const formatUnit = (value: number, unit: keyof typeof unitLabels) => {
  const form = pluralRules.select(value);
  const normalizedForm: PluralForm =
    form === "one" || form === "few" || form === "many" || form === "other"
      ? form
      : "other";
  const label = unitLabels[unit][normalizedForm];
  return `${value} ${label}`;
};

const formatTimeLeft = (value?: string) => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return "скоро";
  }
  const end = new Date(trimmed);
  if (Number.isNaN(end.getTime())) {
    return "скоро";
  }
  const diffMs = end.getTime() - Date.now();
  if (diffMs <= 0) {
    return "скоро";
  }
  const seconds = Math.ceil(diffMs / 1000);
  if (seconds < 60) {
    return formatUnit(seconds, "second");
  }
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) {
    return formatUnit(minutes, "minute");
  }
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) {
    return formatUnit(hours, "hour");
  }
  const days = Math.ceil(hours / 24);
  if (days < 30) {
    return formatUnit(days, "day");
  }
  const months = Math.ceil(days / 30);
  if (months < 12) {
    return formatUnit(months, "month");
  }
  const years = Math.ceil(months / 12);
  return formatUnit(years, "year");
};

const DISABLE_MAINTENANCE_CHECKS = false;

export default function MaintenancePage() {
  const [maintenance, setMaintenance] = useState<ApiMaintenanceData | null>(
    null,
  );
  const [hasMaintenance, setHasMaintenance] = useState<boolean | null>(null);
  const router = useRouter();
  const { hasAdminAccess } = useAuth();

  useEffect(() => {
    if (DISABLE_MAINTENANCE_CHECKS) {
      setMaintenance(null);
      setHasMaintenance(false);
      return;
    }
    const controller = new AbortController();
    const load = async () => {
      try {
        const isActive = await fetchMaintenanceActive({
          signal: controller.signal,
        });
        if (!isActive) {
          setMaintenance(null);
          setHasMaintenance(false);
          return;
        }
        const data = await fetchMaintenanceData({ signal: controller.signal });
        setMaintenance(data);
        setHasMaintenance(true);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        if (
          error instanceof ApiError &&
          (error.status === 503 || error.status === 409 || error.status === 404)
        ) {
          setMaintenance(null);
          setHasMaintenance(false);
          return;
        }
        setMaintenance(null);
        setHasMaintenance(false);
      }
    };
    void load();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (hasMaintenance === false) {
      router.replace("/");
    }
  }, [hasMaintenance, router]);

  const hasMaintenanceData = hasMaintenance !== false;
  const description = maintenance?.description?.trim() || DEFAULT_DESCRIPTION;
  const requestId = maintenance?.id?.trim() || DEFAULT_REQUEST_ID;
  const timeLeft = useMemo(
    () => formatTimeLeft(hasMaintenanceData ? maintenance?.willEnd : undefined),
    [hasMaintenanceData, maintenance?.willEnd],
  );

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
              Техработы
            </div>

            <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
              Технические работы
            </h1>

            <p className="mt-4 max-w-xl text-base text-foreground/70 sm:text-lg">
              {description}
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => {
                  const url = new URL(window.location.href);
                  url.searchParams.set(
                    "maintenanceRefresh",
                    String(Date.now()),
                  );
                  window.location.assign(url.toString());
                }}
                className="inline-flex items-center justify-center rounded-full border border-foreground bg-foreground px-5 py-3 text-sm font-semibold text-background transition hover:opacity-90"
              >
                Обновить страницу
              </button>
              {hasAdminAccess ? (
                <Link
                  href="/admin"
                  className="inline-flex items-center justify-center rounded-full border border-foreground px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-foreground hover:text-background"
                >
                  В админ-панель
                </Link>
              ) : null}
            </div>

            <p className="mt-6 text-xs text-foreground/55">
              ID запроса:{" "}
              <span className="font-mono text-foreground/70">{requestId}</span>
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
                    Мы скоро вернёмся
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Идёт обновление. Спасибо за терпение.
                    <br />
                    Закончим примерно через: {timeLeft}
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
