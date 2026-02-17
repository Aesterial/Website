"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  CalendarDays,
  ChevronDown,
  ExternalLink,
  Globe,
  LogOut,
  MapPin,
  Settings,
  UserCircle2,
} from "lucide-react";
import { AdminNotificationsMenu } from "@/components/admin-notifications-menu";
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
} from "../data";

const statusBadgeStyles: Record<SubmissionStatus, string> = {
  pending: "bg-amber-500/10 text-amber-700",
  approved: "bg-emerald-500/10 text-emerald-700",
  declined: "bg-rose-500/10 text-rose-700",
};

type StatusPageProps = {
  status: SubmissionStatus;
};

export default function SubmissionStatusPage({ status }: StatusPageProps) {
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

  const statusLabel: Record<SubmissionStatus, string> = {
    pending: t("statusPending"),
    approved: t("statusApproved"),
    declined: t("statusDeclined"),
  };

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

  const filtered = useMemo(
    () => submissions.filter((item) => item.status === status),
    [status, submissions],
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    filtered[0]?.id ?? null,
  );

  useEffect(() => {
    setSelectedId(filtered[0]?.id ?? null);
  }, [filtered]);

  const selected = filtered.find((item) => item.id === selectedId) ?? null;
  const statusInfo = statusMeta[status];

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
              <p className="text-lg font-semibold">{t(statusInfo.labelKey)}</p>
              <p className="text-xs text-muted-foreground">
                {t(statusInfo.descriptionKey)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <AdminNotificationsMenu />
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
            </div>
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
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  {t("adminSubmissionsListTitle")}
                </p>
                <h1 className="text-2xl font-bold sm:text-3xl">
                  {t(statusInfo.labelKey)}
                </h1>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span>
                  {t("adminSubmissionsTotalLabel")}:{" "}
                  <span className="text-foreground font-semibold">
                    {filtered.length}
                  </span>
                </span>
                <Link
                  href="/admin/submissions"
                  className="rounded-full border border-border/70 px-4 py-2 text-xs font-semibold transition-all duration-300 hover:bg-foreground hover:text-background"
                >
                  {t("adminSubmissionsBackToCategories")}
                </Link>
              </div>
            </div>
          </motion.section>

          {isLoading ? (
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="rounded-3xl border border-border/70 bg-card/90 p-10 text-center"
            >
              <p className="text-sm text-muted-foreground">Loading...</p>
            </motion.section>
          ) : filtered.length === 0 ? (
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="rounded-3xl border border-border/70 bg-card/90 p-10 text-center"
            >
              <p className="text-lg font-semibold">
                {t("adminSubmissionsEmptyTitle")}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("adminSubmissionsEmptySubtitle")}
              </p>
              <Link
                href="/admin/submissions"
                className="mt-5 inline-flex rounded-full border border-border/70 px-5 py-2 text-sm font-semibold transition-all duration-300 hover:bg-foreground hover:text-background"
              >
                {t("adminSubmissionsBackToCategories")}
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
                      statusText={statusLabel[status]}
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
                        <span
                          className={`rounded-full px-2 py-0.5 font-semibold ${statusBadgeStyles[status]}`}
                        >
                          {statusLabel[status]}
                        </span>
                      </div>
                      <h2 className="mt-2 text-xl font-semibold">
                        {selected.title}
                      </h2>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {selected.summary}
                      </p>
                    </div>
                    <div className="grid gap-3 text-sm">
                      <div className="flex min-w-0 items-center gap-2">
                        <UserCircle2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {t("adminSubmissionsInfoAuthor")}:
                        </span>
                        {selected.authorId ? (
                          <Link
                            href={`/users/${selected.authorId}`}
                            className="min-w-0 truncate font-semibold hover:underline"
                          >
                            {selected.authorName}
                          </Link>
                        ) : (
                          <span className="min-w-0 truncate font-semibold">
                            {selected.authorName}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {t("adminSubmissionsInfoDate")}:
                        </span>
                        <span className="font-semibold">
                          {selected.submittedAt}
                        </span>
                      </div>
                      <div className="flex min-w-0 items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {t("adminSubmissionsInfoLocation")}:
                        </span>
                        <span className="min-w-0 break-all font-semibold">
                          {selected.location}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground break-all">
                        {t("adminSubmissionsInfoSource")}: {selected.source}
                      </div>
                    </div>
                    <Link
                      href={`/admin/submissions/${selected.id}`}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-foreground/30"
                    >
                      {t("adminSubmissionsOpenProject")}
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t("adminSubmissionsSelectHint")}
                  </p>
                )}
              </motion.aside>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

type ProjectCardProps = {
  item: Submission;
  selected: boolean;
  onSelect: () => void;
  status: SubmissionStatus;
  statusText: string;
};

function ProjectCard({
  item,
  selected,
  onSelect,
  status,
  statusText,
}: ProjectCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full gap-4 overflow-hidden rounded-3xl border border-border/60 bg-background/70 p-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-foreground/30 ${
        selected ? "ring-2 ring-foreground/15 border-foreground/40" : ""
      }`}
    >
      <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-2xl">
        <img
          src={item.coverImage}
          alt={item.title}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <span className="min-w-0 max-w-full break-all">{item.category}</span>
          <span
            className={`rounded-full px-2 py-0.5 font-semibold ${statusBadgeStyles[status]}`}
          >
            {statusText}
          </span>
        </div>
        <p className="mt-2 break-words text-base font-semibold">{item.title}</p>
        <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
          <span className="truncate">{item.authorName}</span>
          <span>{item.submittedAt}</span>
          <span className="break-all">{item.location}</span>
        </div>
      </div>
    </button>
  );
}
