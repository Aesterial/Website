"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, Heart, MapPin, UserCircle2 } from "lucide-react";
import { Header } from "@/components/header";
import { useLanguage } from "@/components/language-provider";
import {
  fetchProjectById,
  fetchStoragePresignGet,
  type ApiProject,
  type ApiAvatar,
} from "@/lib/api";
import {
  build2GisLink,
  formatCoordinates,
  resolveCoordinates,
} from "@/lib/location";

type ProjectPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const CATEGORY_ENUM_MAP: Record<number, string> = {
  1: "improvement",
  2: "roadsidewalks",
  3: "lighting",
  4: "playgrounds",
  5: "parks",
  6: "other",
};

const CATEGORY_ALIAS_MAP: Record<string, string> = {
  improvement: "improvement",
  landscaping: "improvement",
  roadsidewalks: "roadsidewalks",
  roadsandsidewalks: "roadsidewalks",
  roads_and_sidewalks: "roadsidewalks",
  lighting: "lighting",
  playgrounds: "playgrounds",
  parks: "parks",
  parksandsquares: "parks",
  parks_and_squares: "parks",
  other: "other",
};

const UNKNOWN_LABEL = "-";

const parseTimestamp = (value: unknown): string => {
  if (typeof value === "string") {
    return value.trim();
  }
  if (value && typeof value === "object" && "seconds" in value) {
    const seconds = Number((value as { seconds?: number | string }).seconds);
    if (!Number.isNaN(seconds) && seconds > 0) {
      return new Date(seconds * 1000).toISOString();
    }
  }
  return "";
};

const formatDate = (value: string, formatter: Intl.DateTimeFormat) => {
  if (!value) {
    return UNKNOWN_LABEL;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return UNKNOWN_LABEL;
  }
  return formatter.format(date);
};

const toImageSrc = (photo?: ApiAvatar | null) => {
  if (!photo) {
    return "";
  }
  const raw = photo as ApiAvatar & {
    image_url?: string;
    imageUrl?: string;
    signedUrl?: string;
    presign?: string;
  };
  const directUrl =
    raw.url ??
    raw.image_url ??
    raw.imageUrl ??
    raw.signedUrl ??
    raw.presign ??
    "";
  const normalizedUrl = typeof directUrl === "string" ? directUrl.trim() : "";
  if (normalizedUrl) {
    return normalizedUrl;
  }
  const contentType =
    typeof raw.contentType === "string" ? raw.contentType.trim() : "";
  const base64 = typeof raw.data === "string" ? raw.data.trim() : "";
  if (contentType && base64) {
    return `data:${contentType};base64,${base64}`;
  }
  return "";
};

const toImageKey = (photo?: ApiAvatar | null) => {
  if (!photo) {
    return "";
  }
  const raw = photo as ApiAvatar & {
    object_key?: string;
    objectKey?: string;
  };
  const directKey = raw.key ?? raw.object_key ?? raw.objectKey ?? "";
  return typeof directKey === "string" ? directKey.trim() : "";
};

const getProjectInfo = (project?: ApiProject | null) =>
  project?.details ?? project?.info ?? null;

const resolveCategoryKey = (value: unknown) => {
  if (typeof value === "number") {
    return CATEGORY_ENUM_MAP[value];
  }
  if (typeof value === "string") {
    return CATEGORY_ALIAS_MAP[value.trim().toLowerCase()];
  }
  return undefined;
};

export default function ProjectPage({ params }: ProjectPageProps) {
  const { id } = use(params);
  const { language, t } = useLanguage();
  const [project, setProject] = useState<ApiProject | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageReloadTick, setImageReloadTick] = useState(0);
  const [didRetryImageLoad, setDidRetryImageLoad] = useState(false);
  const [resolvedImages, setResolvedImages] = useState<string[]>([]);

  const locale = useMemo(
    () => (language === "KZ" ? "kk-KZ" : language === "RU" ? "ru-RU" : "en-US"),
    [language],
  );
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
    [locale],
  );
  const categoryLabels = useMemo<Record<string, string>>(
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

  const retryImageLoad = useCallback(() => {
    if (didRetryImageLoad) {
      return;
    }
    setDidRetryImageLoad(true);
    window.setTimeout(() => {
      setImageReloadTick((prev) => prev + 1);
    }, 800);
  }, [didRetryImageLoad]);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    fetchProjectById(id, { signal: controller.signal })
      .then((payload) => {
        if (!controller.signal.aborted) {
          setProject(payload);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setProject(null);
          setError(err instanceof Error ? err.message : t("mapProjectsEmpty"));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });
    return () => controller.abort();
  }, [id, imageReloadTick, t]);

  useEffect(() => {
    setDidRetryImageLoad(false);
  }, [id]);

  useEffect(() => {
    if (!project) {
      setResolvedImages([]);
      return;
    }

    const controller = new AbortController();
    const info = getProjectInfo(project);
    const photos = Array.isArray(info?.photos) ? info.photos : [];
    if (photos.length === 0) {
      setResolvedImages([]);
      return () => controller.abort();
    }

    Promise.all(
      photos.map(async (photo) => {
        const direct = toImageSrc(photo);
        if (direct) {
          return direct;
        }
        const key = toImageKey(photo);
        if (!key) {
          return "";
        }
        try {
          return await fetchStoragePresignGet(key, {
            signal: controller.signal,
          });
        } catch {
          return "";
        }
      }),
    ).then((images) => {
      if (!controller.signal.aborted) {
        setResolvedImages(images.filter(Boolean));
      }
    });

    return () => controller.abort();
  }, [project, imageReloadTick]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-24 pb-12 px-4 sm:pt-28 sm:pb-16 sm:px-6">
          <div className="container mx-auto max-w-4xl">
            <div className="h-72 rounded-3xl bg-muted/60 animate-pulse" />
          </div>
        </main>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-24 pb-12 px-4 sm:pt-28 sm:pb-16 sm:px-6">
          <div className="container mx-auto max-w-lg text-center">
            <p className="text-lg font-semibold">
              {t("adminSubmissionNotFoundTitle")}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {error || t("adminSubmissionNotFoundSubtitle")}
            </p>
            <Link
              href="/voting"
              className="mt-6 inline-flex rounded-full border border-border/70 px-5 py-2 text-sm font-semibold transition-all duration-300 hover:bg-foreground hover:text-background"
            >
              {t("adminSubmissionBackToList")}
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const info = getProjectInfo(project);
  const title = info?.title?.trim() || UNKNOWN_LABEL;
  const description = info?.description?.trim() || t("mapProjectNoDescription");
  const categoryKey = resolveCategoryKey(info?.category);
  const category = categoryKey
    ? (categoryLabels[categoryKey] ?? categoryLabels.other)
    : categoryLabels.other;
  const location = info?.location ?? null;
  const coordinates = resolveCoordinates(location);
  const addressParts = [
    location?.street?.trim(),
    location?.house?.trim(),
  ].filter((part): part is string => Boolean(part));
  const locationLabel = addressParts.length
    ? addressParts.join(" ")
    : coordinates
      ? formatCoordinates(coordinates)
      : UNKNOWN_LABEL;
  const city = location?.city?.trim() || UNKNOWN_LABEL;
  const createdAtLabel = formatDate(
    parseTimestamp(project.createdAt ?? project.created_at),
    dateFormatter,
  );
  const votes = Number(project.likesCount ?? project.likes_count ?? 0);
  const author = project.author ?? null;
  const authorId = author?.userID ?? author?.uid;
  const authorName =
    author?.settings?.display_name ??
    author?.settings?.displayName ??
    author?.username ??
    UNKNOWN_LABEL;
  const coverImage = resolvedImages[0] ?? "/placeholder.svg";

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-12 px-4 sm:pt-28 sm:pb-16 sm:px-6">
        <div className="container mx-auto max-w-6xl space-y-6">
          <section className="rounded-3xl border border-border/70 bg-card/90 p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  {t("mapProjectDetailsTitle")}
                </p>
                <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{title}</h1>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/voting"
                  className="rounded-full border border-border/70 px-4 py-2 text-sm font-semibold transition-all duration-300 hover:bg-foreground hover:text-background"
                >
                  {t("adminSubmissionBackToList")}
                </Link>
              </div>
            </div>

            <div className="mt-5 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
              <div className="space-y-5">
                <div className="relative h-64 overflow-hidden rounded-2xl">
                  <img
                    src={coverImage}
                    alt={title}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={retryImageLoad}
                  />
                </div>
                {resolvedImages.length > 1 ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {resolvedImages.slice(1).map((image) => (
                      <div
                        key={image}
                        className="relative h-40 overflow-hidden rounded-2xl"
                      >
                        <img
                          src={image}
                          alt={title}
                          className="h-full w-full object-cover"
                          referrerPolicy="no-referrer"
                          onError={retryImageLoad}
                        />
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-border/60 bg-background/70 p-5">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  <span>{category}</span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {description}
                </p>

                <div className="mt-5 space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <UserCircle2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {t("adminSubmissionsInfoAuthor")}:
                    </span>
                    {typeof authorId === "number" ? (
                      <Link
                        href={`/users/${authorId}`}
                        className="font-semibold hover:underline"
                      >
                        {authorName}
                      </Link>
                    ) : (
                      <span className="font-semibold">{authorName}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {t("adminSubmissionsInfoDate")}:
                    </span>
                    <span className="font-semibold">{createdAtLabel}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {t("adminSubmissionsInfoLocation")}:
                    </span>
                    <span className="font-semibold">{locationLabel}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t("adminSubmissionsInfoCity")}: {city}
                  </div>
                  <div className="flex items-center gap-2">
                    <Heart className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{t("vote")}:</span>
                    <span className="font-semibold">{votes}</span>
                  </div>
                </div>

                {coordinates ? (
                  <a
                    href={build2GisLink(coordinates)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-5 inline-flex rounded-full border border-border/70 px-4 py-2 text-sm font-semibold transition-all duration-300 hover:bg-foreground hover:text-background"
                  >
                    {t("openIn2Gis")}
                  </a>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
