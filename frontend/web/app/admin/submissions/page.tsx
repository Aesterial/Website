"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  ChevronDown,
  Clock,
  Globe,
  LogOut,
  Settings,
  XCircle,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import { fetchSubmissions } from "@/lib/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  mapSubmissionTarget,
  statusMeta,
  type Submission,
  type SubmissionStatus,
} from "./data";

const statusOrder: SubmissionStatus[] = ["pending", "approved", "declined"];

const statusIcons = {
  pending: Clock,
  approved: CheckCircle2,
  declined: XCircle,
};

const statusStyles: Record<SubmissionStatus, string> = {
  pending: "bg-amber-500/10 text-amber-700",
  approved: "bg-emerald-500/10 text-emerald-700",
  declined: "bg-rose-500/10 text-rose-700",
};

export default function SubmissionsLandingPage() {
  const router = useRouter();
  const { logout, user } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  const displayName = user?.displayName || user?.username || "";
  const initials = (displayName || "U").slice(0, 2).toUpperCase();
  const languageOptions = [
    { code: "RU" as const, label: "RU" },
    { code: "EN" as const, label: "EN" },
    { code: "KZ" as const, label: "KZ" },
  ];

  const locale = useMemo(
    () => (language === "KZ" ? "kk-KZ" : language === "RU" ? "ru-RU" : "en-US"),
    [language],
  );
  const categoryLabels = useMemo(
    () => ({
      improvement: t("landscaping"),
      roadsidewalks: t("roadsAndSidewalks"),
      lighting: t("lighting"),
      playgrounds: t("playgrounds"),
      parks: t("parksAndSquares"),
      other: t("other"),
    }),
    [t],
  );
  const resolveCategoryLabel = useCallback(
    (value: unknown) => {
      if (typeof value === "number") {
        const key = {
          1: "improvement",
          2: "roadsidewalks",
          3: "lighting",
          4: "playgrounds",
          5: "parks",
          6: "other",
        }[value];
        return key
          ? categoryLabels[key as keyof typeof categoryLabels]
          : categoryLabels.other;
      }
      if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (
          normalized &&
          Object.prototype.hasOwnProperty.call(categoryLabels, normalized)
        ) {
          return categoryLabels[normalized as keyof typeof categoryLabels];
        }
        return value.trim() || categoryLabels.other;
      }
      return categoryLabels.other;
    },
    [categoryLabels],
  );

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    fetchSubmissions({ signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) {
          return;
        }
        const mapped = data
          .map((item) =>
            mapSubmissionTarget(item, { locale, resolveCategoryLabel }),
          )
          .filter((item): item is Submission => Boolean(item));
        setSubmissions(mapped);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setSubmissions([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });
    return () => controller.abort();
  }, [locale, resolveCategoryLabel]);

  const counts = useMemo(
    () =>
      statusOrder.reduce<Record<SubmissionStatus, number>>(
        (acc, status) => {
          acc[status] = submissions.filter(
            (item) => item.status === status,
          ).length;
          return acc;
        },
        {} as Record<SubmissionStatus, number>,
      ),
    [submissions],
  );

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      <div className="pointer-events-none absolute -top-40 right-0 h-[28rem] w-[28rem] rounded-full bg-foreground/5 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-[32rem] w-[32rem] rounded-full bg-foreground/10 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(0,0,0,0.04),transparent_45%,rgba(0,0,0,0.06))]" />

      <header
        className="sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur"
        style={{ top: "var(--maintenance-banner-height)" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link href="/" aria-label="Go to main site">
              <Logo className="h-9 w-9 text-foreground" showText={false} />
            </Link>
            <div>
              <p className="text-lg font-semibold">{t("adminPanelTitle")}</p>
              <p className="text-xs text-muted-foreground">
                {t("adminSubmissionsSubtitle")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background px-4 py-2 text-sm font-semibold transition-all duration-300 hover:bg-foreground hover:text-background sm:hidden"
                >
                  <span>Menu</span>
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                side="bottom"
                className="w-52 sm:hidden"
              >
                <DropdownMenuItem asChild>
                  <Link href="/admin">
                    <Settings className="h-4 w-4" />
                    {t("adminPanel")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {languageOptions.map((option) => (
                  <DropdownMenuItem
                    key={option.code}
                    onSelect={() => setLanguage(option.code)}
                  >
                    <Globe className="h-4 w-4" />
                    {option.label}
                    {language === option.code ? " (current)" : ""}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/account">
                    <Settings className="h-4 w-4" />
                    {t("accountSettings")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    void handleLogout();
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  {t("logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="hidden items-center gap-3 sm:flex">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background px-4 py-2 text-sm font-semibold transition-all duration-300 hover:bg-foreground hover:text-background"
                  >
                    <Globe className="h-4 w-4" />
                    {language}
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[90px]">
                  {languageOptions.map((option) => (
                    <DropdownMenuItem
                      key={option.code}
                      onClick={() => setLanguage(option.code)}
                    >
                      {option.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-3 rounded-full border border-border/60 bg-card/90 px-4 py-2 text-sm font-semibold transition-all duration-300 hover:bg-foreground hover:text-background"
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="text-xs font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-semibold">
                      {displayName || user?.username || "admin"}
                    </span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem asChild>
                    <Link href="/account">
                      <Settings className="h-4 w-4" />
                      {t("accountSettings")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault();
                      void handleLogout();
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                    {t("logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Link
                href="/admin"
                className="rounded-full border border-border/70 px-4 py-2 text-sm font-semibold transition-all duration-300 hover:bg-foreground hover:text-background"
              >
                {t("adminPanel")}
              </Link>
            </div>
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
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  {t("adminSubmissionsSubtitle")}
                </p>
                <h1 className="text-2xl font-bold sm:text-3xl">
                  {t("adminSubmissionsTitle")}
                </h1>
              </div>
              <div className="text-sm text-muted-foreground">
                {t("adminSubmissionsCountLabel")}:{" "}
                <span className="text-foreground font-semibold">
                  {isLoading ? "..." : submissions.length}
                </span>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {statusOrder.map((status) => {
                const Icon = statusIcons[status];
                const meta = statusMeta[status];
                return (
                  <Link
                    key={status}
                    href={`/admin/submissions/${status}`}
                    className="group flex flex-col justify-between rounded-3xl border border-border/70 bg-background/70 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-foreground/30"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${statusStyles[status]}`}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="text-3xl font-semibold">
                        {counts[status]}
                      </span>
                    </div>
                    <div className="mt-4">
                      <p className="text-base font-semibold">
                        {t(meta.labelKey)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t(meta.descriptionKey)}
                      </p>
                    </div>
                    <div className="mt-4 text-xs font-semibold text-muted-foreground group-hover:text-foreground">
                      {t("adminSubmissionsOpenCategory")}
                    </div>
                  </Link>
                );
              })}
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="rounded-3xl border border-border/70 bg-card/90 p-6"
          >
            <h2 className="text-lg font-semibold">
              {t("adminSubmissionsHowTitle")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("adminSubmissionsHowText")}
            </p>
          </motion.section>
        </div>
      </main>
    </div>
  );
}
