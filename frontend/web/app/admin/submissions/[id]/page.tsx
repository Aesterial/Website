"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarDays,
  ChevronDown,
  CheckCircle2,
  ExternalLink,
  Globe,
  LogOut,
  MapPin,
  Settings,
  UserCircle2,
  XCircle,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import {
  approveSubmission,
  declineSubmission,
  fetchSubmissionById,
} from "@/lib/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  mapSubmissionTarget,
  statusMeta,
  type Submission,
  type SubmissionStatus,
} from "../data";
import { build2GisLink, formatCoordinates } from "@/lib/location";
import { useReverseGeocode } from "@/hooks/use-reverse-geocode";

const statusBadgeStyles: Record<SubmissionStatus, string> = {
  pending: "bg-amber-500/10 text-amber-700",
  approved: "bg-emerald-500/10 text-emerald-700",
  declined: "bg-rose-500/10 text-rose-700",
};

type SubmissionDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default function SubmissionDetailPage({
  params,
}: SubmissionDetailPageProps) {
  const { id } = use(params);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const router = useRouter();
  const { logout, user } = useAuth();
  const { language, setLanguage, t } = useLanguage();
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

  const [currentStatus, setCurrentStatus] = useState<SubmissionStatus | null>(
    null,
  );
  const [actionLoading, setActionLoading] = useState<
    "approve" | "decline" | null
  >(null);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [currentDeclineReason, setCurrentDeclineReason] = useState("");
  const [declineError, setDeclineError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    const submissionId = Number(id);
    if (!Number.isFinite(submissionId) || submissionId <= 0) {
      setSubmission(null);
      setIsLoading(false);
      return () => controller.abort();
    }
    fetchSubmissionById(submissionId, { signal: controller.signal })
      .then((item) => {
        if (controller.signal.aborted) {
          return;
        }
        const mapped = item
          ? mapSubmissionTarget(item, { locale, resolveCategoryLabel })
          : null;
        setSubmission(mapped);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setSubmission(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });
    return () => controller.abort();
  }, [id, locale, resolveCategoryLabel]);

  useEffect(() => {
    setCurrentStatus(submission?.status ?? null);
    setCurrentDeclineReason(submission?.declineReason ?? "");
  }, [submission]);
  const { label: resolvedLocation, loading: resolvedLocationLoading } =
    useReverseGeocode(submission?.coordinates ?? null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center gap-4 px-4 text-center">
        <Link href="/" aria-label="Go to main site">
          <Logo className="h-10 w-10 text-foreground" showText={false} />
        </Link>
        <div>
          <p className="text-lg font-semibold">
            {t("adminSubmissionNotFoundTitle")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("adminSubmissionNotFoundSubtitle")}
          </p>
        </div>
        <Link
          href="/admin/submissions"
          className="rounded-full border border-border/70 px-5 py-2 text-sm font-semibold transition-all duration-300 hover:bg-foreground hover:text-background"
        >
          {t("adminSubmissionBackToList")}
        </Link>
      </div>
    );
  }

  const activeStatus = currentStatus ?? submission.status;
  const statusInfo = statusMeta[activeStatus];
  const statusClass = statusBadgeStyles[activeStatus];
  const statusText =
    activeStatus === "approved"
      ? t("statusApproved")
      : activeStatus === "declined"
        ? t("statusDeclined")
        : t("statusPending");
  const declineReasonValue = (
    currentDeclineReason ||
    submission.declineReason ||
    ""
  ).trim();
  const showDeclineReason =
    activeStatus === "declined" && Boolean(declineReasonValue);
  const isApproving = actionLoading === "approve";
  const isDeclining = actionLoading === "decline";
  const locationLabel =
    resolvedLocation ||
    (submission.coordinates
      ? formatCoordinates(submission.coordinates)
      : submission.location);

  const handleApprove = async () => {
    if (activeStatus === "approved") {
      return;
    }
    setActionLoading("approve");
    try {
      const submissionId = Number(submission.id);
      if (!Number.isFinite(submissionId)) {
        throw new Error("Invalid submission id.");
      }
      await approveSubmission(submissionId);
      setCurrentStatus("approved");
      toast.success(t("adminSubmissionApproveSuccessTitle"), {
        description: t("adminSubmissionApproveSuccessDesc"),
      });
    } catch (error) {
      toast.error(t("adminSubmissionApproveErrorTitle"), {
        description:
          error instanceof Error
            ? error.message
            : t("adminSubmissionApproveErrorDesc"),
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async () => {
    const reason = declineReason.trim();
    if (!reason) {
      setDeclineError(t("adminSubmissionDeclineReasonError"));
      return;
    }
    setDeclineError(null);
    setActionLoading("decline");
    try {
      const submissionId = Number(submission.id);
      if (!Number.isFinite(submissionId)) {
        throw new Error("Invalid submission id.");
      }
      await declineSubmission(submissionId, reason);
      setCurrentStatus("declined");
      setCurrentDeclineReason(reason);
      setDeclineOpen(false);
      setDeclineReason("");
      toast.success(t("adminSubmissionDeclineSuccessTitle"), {
        description: t("adminSubmissionDeclineSuccessDesc"),
      });
    } catch (error) {
      toast.error(t("adminSubmissionDeclineErrorTitle"), {
        description:
          error instanceof Error
            ? error.message
            : t("adminSubmissionDeclineErrorDesc"),
      });
    } finally {
      setActionLoading(null);
    }
  };

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
              <p className="text-lg font-semibold">{t("adminPanelTitle")}</p>
              <p className="text-xs text-muted-foreground">
                {t(statusInfo.labelKey)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
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
              href={`/admin/submissions/${activeStatus}`}
              className="rounded-full border border-border/70 px-4 py-2 text-sm font-semibold transition-all duration-300 hover:bg-foreground hover:text-background"
            >
              {t("adminSubmissionBackToList")}
            </Link>
            <Link
              href="/admin/submissions"
              className="rounded-full border border-border/70 px-4 py-2 text-sm font-semibold transition-all duration-300 hover:bg-foreground hover:text-background"
            >
              {t("adminSubmissionsAll")}
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
                  <span
                    className={`rounded-full px-2 py-0.5 font-semibold ${statusClass}`}
                  >
                    {statusText}
                  </span>
                </div>
                <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
                  {submission.title}
                </h1>
                <p className="mt-3 text-sm text-muted-foreground">
                  {submission.summary}
                </p>
              </div>
              <Link
                href="#media"
                className="inline-flex items-center gap-2 rounded-full border border-border/70 px-4 py-2 text-xs font-semibold transition-all duration-300 hover:bg-foreground hover:text-background"
              >
                {t("adminSubmissionsMediaJump")}
                <ExternalLink className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-6 grid gap-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <UserCircle2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {t("adminSubmissionsInfoAuthor")}:
                </span>
                {submission.authorId ? (
                  <Link
                    href={`/users/${submission.authorId}`}
                    className="font-semibold hover:underline"
                  >
                    {submission.authorName}
                  </Link>
                ) : (
                  <span className="font-semibold">{submission.authorName}</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {t("adminSubmissionsInfoDate")}:
                </span>
                <span className="font-semibold">{submission.submittedAt}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {t("adminSubmissionsInfoLocation")}:
                </span>
                <span className="font-semibold">{locationLabel}</span>
                {resolvedLocationLoading ? (
                  <span className="text-xs text-muted-foreground">
                    {t("locationResolving")}
                  </span>
                ) : null}
                {submission.coordinates ? (
                  <a
                    href={build2GisLink(submission.coordinates)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center rounded-full border border-border/70 px-3 py-1 text-xs font-semibold text-foreground transition-colors duration-300 hover:bg-foreground hover:text-background"
                  >
                    {t("openIn2Gis")}
                  </a>
                ) : null}
              </div>
              <div className="text-xs text-muted-foreground">
                {t("adminSubmissionsInfoCity")}: {submission.city}
              </div>
              <div className="text-xs text-muted-foreground">
                {t("adminSubmissionsInfoSource")}: {submission.source}
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-border/70 bg-background/70 p-5">
              <p className="text-sm font-semibold">
                {t("adminSubmissionsDetailsTitle")}
              </p>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {submission.description}
              </p>
            </div>

            {showDeclineReason ? (
              <div className="mt-6 rounded-2xl border border-border/70 bg-background/70 p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  {t("adminSubmissionDeclineReasonLabel")}
                </p>
                <p className="mt-2 text-sm text-foreground">
                  {declineReasonValue}
                </p>
              </div>
            ) : null}

            <div id="media" className="mt-6">
              <p className="text-sm font-semibold">{t("adminMediaTitle")}</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {submission.images.map((image) => (
                  <div
                    key={image}
                    className="relative h-48 overflow-hidden rounded-2xl"
                  >
                    <img
                      src={image}
                      alt={submission.title}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>

          <aside className="rounded-3xl border border-border/70 bg-card/90 p-6 lg:sticky lg:top-24 h-fit">
            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  {t("labelStatus")}
                </p>
                <div
                  className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}
                >
                  {statusText}
                </div>
              </div>

              <div className="grid gap-3">
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={
                    isApproving || isDeclining || activeStatus === "approved"
                  }
                  className="flex items-center justify-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-foreground/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {activeStatus === "approved"
                    ? t("adminSubmissionApproveDone")
                    : isApproving
                      ? t("adminSubmissionSending")
                      : t("actionApprove")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeclineError(null);
                    setDeclineOpen(true);
                  }}
                  disabled={
                    isApproving || isDeclining || activeStatus === "declined"
                  }
                  className="flex items-center justify-center gap-2 rounded-full border border-border/70 px-4 py-2 text-sm font-semibold text-foreground transition-all duration-300 hover:bg-foreground hover:text-background disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <XCircle className="h-4 w-4" />
                  {activeStatus === "declined"
                    ? t("adminSubmissionDeclineDone")
                    : t("actionDecline")}
                </button>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/70 p-4 text-xs text-muted-foreground">
                {t("adminSubmissionActionNote")}
              </div>
            </div>
          </aside>
        </div>
      </main>

      <Dialog
        open={declineOpen}
        onOpenChange={(open) => {
          setDeclineOpen(open);
          if (!open) {
            setDeclineReason("");
            setDeclineError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("adminSubmissionDeclineReasonLabel")}</DialogTitle>
            <DialogDescription>
              {t("adminSubmissionDeclineReasonHelp")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Textarea
              value={declineReason}
              onChange={(event) => setDeclineReason(event.target.value)}
              placeholder={t("adminSubmissionDeclineReasonPlaceholder")}
              rows={4}
            />
            {declineError ? (
              <p className="text-sm text-destructive">{declineError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setDeclineOpen(false)}
              className="rounded-full border border-border/70 px-4 py-2 text-sm font-semibold transition-colors duration-300 hover:bg-foreground hover:text-background"
              disabled={isDeclining}
            >
              {t("adminDialogCancel")}
            </button>
            <button
              type="button"
              onClick={handleDecline}
              disabled={isDeclining}
              className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-foreground/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDeclining ? t("adminSubmissionSending") : t("adminDialogSend")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
