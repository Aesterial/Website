"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Heart, ListFilter, MapPin, Sparkles } from "lucide-react";
import { Header, cities as availableCities } from "@/components/header";
import { GradientButton } from "@/components/gradient-button";
import { useAuth } from "@/components/auth-provider";
import { useLanguage } from "@/components/language-provider";
import {
  fetchProjects,
  fetchSubmissions,
  toggleProjectLike,
  voteForProject,
  type ApiProject,
  type ApiSubmissionTarget,
} from "@/lib/api";
import type { Variants } from "framer-motion";

interface IdeaCard {
  id: string;
  title: string;
  address: string;
  description: string;
  mapImage: string;
  photoImage: string;
  category: string;
  city: string;
  votes: number;
  likes: number;
  isLiked: boolean;
  isVoted: boolean;
  createdAt: string;
}

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
  благоустройство: "improvement",
  roadsidewalks: "roadsidewalks",
  roadsandsidewalks: "roadsidewalks",
  roads_and_sidewalks: "roadsidewalks",
  "дороги и тротуары": "roadsidewalks",
  lighting: "lighting",
  освещение: "lighting",
  playgrounds: "playgrounds",
  "детские площадки": "playgrounds",
  parks: "parks",
  parksandsquares: "parks",
  parks_and_squares: "parks",
  "парки и скверы": "parks",
  other: "other",
  другое: "other",
};

const UNKNOWN_CITY_LABEL = "Не указан";
const UNKNOWN_ADDRESS_LABEL = "Адрес не указан";

const extractUserId = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const payload = value as {
    uid?: unknown;
    userID?: unknown;
    userId?: unknown;
  };
  const id = payload.uid ?? payload.userID ?? payload.userId;
  return typeof id === "number" ? id : null;
};

const toImageSrc = (
  photo?: {
    contentType?: string;
    data?: string;
    url?: string;
  } | null,
) => {
  if (!photo) {
    return "";
  }
  if (photo.url) {
    return photo.url;
  }
  if (photo.contentType && photo.data) {
    return `data:${photo.contentType};base64,${photo.data}`;
  }
  return "";
};

const parseTimestamp = (value: unknown) => {
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object" && "seconds" in value) {
    const seconds = Number((value as { seconds?: number | string }).seconds);
    if (!Number.isNaN(seconds) && seconds > 0) {
      return new Date(seconds * 1000).toISOString();
    }
  }
  return "";
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2,
    },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

const sortOptions = [
  { id: "popular", label: "По голосам" },
  { id: "likes", label: "По лайкам" },
  { id: "newest", label: "Новые" },
] as const;

type CityFilter = "all" | string;
const normalizeKey = (value: string) => value.trim().toLowerCase();
const ALL_FILTER = "all";

export default function VotingPage() {
  const [ideas, setIdeas] = useState<IdeaCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState(ALL_FILTER);
  const [selectedCity, setSelectedCity] = useState<CityFilter>(ALL_FILTER);
  const [sortBy, setSortBy] =
    useState<(typeof sortOptions)[number]["id"]>("popular");
  const { user } = useAuth();
  const { t } = useLanguage();
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

  const loadIdeas = useCallback(
    async (signal?: AbortSignal) => {
      setIsLoading(true);
      setLoadError(null);

      const resolveCategoryLabel = (value: unknown) => {
        let key: string | undefined;
        if (typeof value === "number") {
          key = CATEGORY_ENUM_MAP[value];
        } else if (typeof value === "string") {
          key = CATEGORY_ALIAS_MAP[normalizeKey(value)];
        }

        if (key && categoryLabels[key]) {
          return categoryLabels[key];
        }
        if (typeof value === "string" && value.trim()) {
          return value.trim();
        }
        return categoryLabels.other;
      };

      const mapProjectToIdea = (project?: ApiProject | null) => {
        const id = project?.id?.trim();
        if (!id) {
          return null;
        }
        const info = project.info ?? null;
        const title = info?.title?.trim() || "Без названия";
        const description =
          info?.description?.trim() || "Описание пока не добавлено.";
        const location = info?.location ?? null;
        const city = location?.city?.trim() || UNKNOWN_CITY_LABEL;
        const addressParts = [
          location?.street?.trim(),
          location?.house?.trim(),
        ].filter((part): part is string => Boolean(part));
        const address = addressParts.length
          ? addressParts.join(" ")
          : UNKNOWN_ADDRESS_LABEL;

        const photos = Array.isArray(info?.photos) ? info?.photos : [];
        const mapImage = toImageSrc(photos[0]) || "/placeholder.svg";
        const photoImage =
          toImageSrc(photos[1] ?? photos[0]) || "/placeholder.svg";

        const likesCount = Number(
          project.likesCount ?? project.likes_count ?? 0,
        );
        const liked = Array.isArray(project.liked) ? project.liked : [];
        const userId = user?.uid ?? null;
        const isLiked =
          userId !== null
            ? liked.some((item) => extractUserId(item) === userId)
            : false;

        return {
          id,
          title,
          address,
          description,
          mapImage,
          photoImage,
          category: resolveCategoryLabel(info?.category),
          city,
          votes: likesCount,
          likes: likesCount,
          isLiked,
          isVoted: isLiked,
          createdAt:
            parseTimestamp(project.createdAt ?? project.created_at) || "",
        };
      };

      try {
        const [projectsResult, submissionsResult] = await Promise.allSettled([
          fetchProjects({ signal }),
          fetchSubmissions({ signal }),
        ]);

        if (signal?.aborted) {
          return;
        }

        const projects =
          projectsResult.status === "fulfilled" ? projectsResult.value : [];
        const submissions =
          submissionsResult.status === "fulfilled"
            ? submissionsResult.value
            : [];

        const merged = new Map<string, IdeaCard>();
        const addIdea = (idea: IdeaCard | null) => {
          if (idea) {
            merged.set(idea.id, idea);
          }
        };

        submissions.forEach((item: ApiSubmissionTarget) => {
          const state = item?.state?.trim().toLowerCase();
          if (state === "declined") {
            return;
          }
          addIdea(mapProjectToIdea(item.info));
        });

        projects.forEach((project) => {
          addIdea(mapProjectToIdea(project));
        });

        setIdeas(Array.from(merged.values()));

        if (
          projectsResult.status === "rejected" &&
          submissionsResult.status === "rejected"
        ) {
          const reason =
            projectsResult.reason instanceof Error
              ? projectsResult.reason.message
              : submissionsResult.reason instanceof Error
                ? submissionsResult.reason.message
                : "Не удалось загрузить идеи.";
          setLoadError(reason);
        }
      } catch (error) {
        if (!signal?.aborted) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Не удалось загрузить идеи.",
          );
          setIdeas([]);
        }
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
        }
      }
    },
    [categoryLabels, user?.uid],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadIdeas(controller.signal);
    return () => controller.abort();
  }, [loadIdeas]);

  const totalVotes = useMemo(
    () => ideas.reduce((sum, idea) => sum + idea.votes, 0),
    [ideas],
  );
  const totalLikes = useMemo(
    () => ideas.reduce((sum, idea) => sum + idea.likes, 0),
    [ideas],
  );

  const updateIdea = (id: string, update: (idea: IdeaCard) => IdeaCard) => {
    let snapshot: IdeaCard | null = null;
    setIdeas((current) =>
      current.map((idea) => {
        if (idea.id !== id) {
          return idea;
        }
        snapshot = idea;
        return update(idea);
      }),
    );
    return snapshot;
  };

  const toggleLike = async (id: string) => {
    const snapshot = updateIdea(id, (idea) => {
      const nextLiked = !idea.isLiked;
      const nextLikes = Math.max(0, idea.likes + (nextLiked ? 1 : -1));
      return {
        ...idea,
        isLiked: nextLiked,
        likes: nextLikes,
      };
    });

    if (!snapshot) {
      return;
    }

    try {
      await toggleProjectLike(id);
    } catch {
      setIdeas((current) =>
        current.map((idea) => (idea.id === id ? snapshot : idea)),
      );
    }
  };

  const handleVote = async (id: string) => {
    let wasUpdated = false;
    const snapshot = updateIdea(id, (idea) => {
      if (idea.isVoted) {
        return idea;
      }
      wasUpdated = true;
      return { ...idea, isVoted: true, votes: idea.votes + 1 };
    });

    if (!snapshot || !wasUpdated) {
      return;
    }

    try {
      await voteForProject(id);
    } catch {
      setIdeas((current) =>
        current.map((idea) => (idea.id === id ? snapshot : idea)),
      );
    }
  };

  const resetFilters = () => {
    setSelectedCategory(ALL_FILTER);
    setSelectedCity(ALL_FILTER);
  };

  const hasFilters =
    selectedCategory !== ALL_FILTER || selectedCity !== ALL_FILTER;
  const handleReload = () => {
    void loadIdeas();
  };

  const categories = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    ideas.forEach((idea) => {
      const key = normalizeKey(idea.category);
      const entry = counts.get(key);
      if (entry) {
        entry.count += 1;
      } else {
        counts.set(key, { label: idea.category, count: 1 });
      }
    });
    return [
      {
        id: "all",
        label: "Все категории",
        count: ideas.length,
      },
      ...Array.from(counts.entries()).map(([id, data]) => ({
        id,
        label: data.label,
        count: data.count,
      })),
    ];
  }, [ideas]);

  const cityOptions = useMemo(() => {
    const dynamicCities = ideas
      .map((idea) => idea.city)
      .filter((city) => Boolean(city) && city !== UNKNOWN_CITY_LABEL);
    const merged = Array.from(new Set([...availableCities, ...dynamicCities]));
    return [
      { id: "all", label: "Все города" },
      ...merged.map((city) => ({ id: city, label: city })),
    ];
  }, [ideas]);

  const selectedCategoryLabel = useMemo(() => {
    return (
      categories.find((category) => category.id === selectedCategory)?.label ??
      "Все категории"
    );
  }, [categories, selectedCategory]);

  const selectedCityLabel = useMemo(() => {
    return selectedCity === ALL_FILTER ? "Все города" : selectedCity;
  }, [selectedCity]);

  const visibleIdeas = useMemo(() => {
    return ideas.filter((idea) => {
      const categoryOk =
        selectedCategory === ALL_FILTER ||
        normalizeKey(idea.category) === selectedCategory;
      const cityOk = selectedCity === ALL_FILTER || idea.city === selectedCity;
      return categoryOk && cityOk;
    });
  }, [ideas, selectedCategory, selectedCity]);

  const sortedIdeas = useMemo(() => {
    const data = [...visibleIdeas];
    const toTime = (value: string) => {
      const time = Date.parse(value);
      return Number.isNaN(time) ? 0 : time;
    };
    switch (sortBy) {
      case "likes":
        return data.sort((a, b) => b.likes - a.likes);
      case "newest":
        return data.sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt));
      case "popular":
      default:
        return data.sort((a, b) => b.votes - a.votes);
    }
  }, [sortBy, visibleIdeas]);

  const maxVotes = useMemo(() => {
    return Math.max(...visibleIdeas.map((idea) => idea.votes), 0);
  }, [visibleIdeas]);

  const renderSidebarContent = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-2">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Фильтры
        </p>
        {hasFilters ? (
          <button
            type="button"
            onClick={resetFilters}
            className="text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            Сбросить
          </button>
        ) : null}
      </div>

      <div className="rounded-[2rem] border border-border/60 bg-card/90 p-5 shadow-[0_18px_40px_-32px_rgba(0,0,0,0.55)]">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Категории
        </p>
        <div className="mt-4 space-y-2">
          {categories.map((category) => {
            const isActive = selectedCategory === category.id;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => setSelectedCategory(category.id)}
                className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-2 text-sm font-semibold transition-all duration-300 ${
                  isActive
                    ? "border-foreground bg-foreground text-background shadow-lg shadow-foreground/25"
                    : "border-border/60 bg-background/70 text-foreground hover:border-foreground/40 hover:bg-foreground hover:text-background"
                }`}
              >
                <span className="truncate">{category.label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    isActive
                      ? "bg-background/20 text-background"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {category.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-[2rem] border border-border/60 bg-card/90 p-5 shadow-[0_18px_40px_-32px_rgba(0,0,0,0.55)]">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Селектор города
        </p>
        <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Город
        </label>
        <div className="relative mt-3">
          <MapPin className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <select
            value={selectedCity}
            onChange={(event) =>
              setSelectedCity(event.target.value as CityFilter)
            }
            className="w-full appearance-none rounded-2xl border border-border/60 bg-background px-10 py-3 text-sm font-semibold text-foreground shadow-sm transition focus:outline-none focus:ring-2 focus:ring-foreground/20"
          >
            {cityOptions.map((city) => (
              <option key={city.id} value={city.id}>
                {city.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative min-h-screen bg-background">
      <Header />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 right-[-10%] h-72 w-72 rounded-full bg-foreground/5 blur-3xl" />
        <div className="absolute top-40 left-[-8%] h-64 w-64 rounded-full bg-foreground/10 blur-3xl" />
        <div className="absolute bottom-0 right-8 h-72 w-72 rounded-full bg-foreground/5 blur-3xl" />
      </div>

      <main className="relative pt-24 pb-16 px-4 sm:pt-28 sm:pb-20 sm:px-6">
        <div className="relative">
          <motion.aside
            className="hidden lg:flex lg:fixed lg:left-6 lg:top-28 lg:h-[calc(100vh-7rem)] lg:w-[280px] lg:flex-col lg:gap-6 lg:overflow-y-auto lg:rounded-3xl lg:border lg:border-border/70 lg:bg-background/90 lg:p-5 lg:shadow-[0_16px_40px_-30px_rgba(0,0,0,0.6)] lg:backdrop-blur"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
          >
            {renderSidebarContent()}
          </motion.aside>

          <div className="lg:pl-[320px]">
            <div className="container mx-auto max-w-6xl">
              <motion.div
                className="flex flex-col gap-6"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/80 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5" />
                    Открытое голосование
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
                    Показано {sortedIdeas.length} идей
                  </span>
                </div>

                <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                  <div className="max-w-3xl space-y-3">
                    <h1 className="text-3xl font-bold sm:text-4xl lg:text-5xl">
                      {t("voting")}
                    </h1>
                    <p className="text-sm text-muted-foreground sm:text-base">
                      Выбирай идеи для своего города и голосуй за лучшие.
                    </p>
                  </div>

                  <div className="grid w-full max-w-md grid-cols-1 gap-3 sm:max-w-none sm:grid-cols-3">
                    <div className="rounded-2xl border border-border/60 bg-card/80 p-3 text-center shadow-[0_16px_36px_-28px_rgba(0,0,0,0.5)]">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                        Идей
                      </p>
                      <p className="text-2xl font-semibold">{ideas.length}</p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-card/80 p-3 text-center shadow-[0_16px_36px_-28px_rgba(0,0,0,0.5)]">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                        Голосов
                      </p>
                      <p className="text-2xl font-semibold">{totalVotes}</p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-card/80 p-3 text-center shadow-[0_16px_36px_-28px_rgba(0,0,0,0.5)]">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                        Лайков
                      </p>
                      <p className="text-2xl font-semibold">{totalLikes}</p>
                    </div>
                  </div>
                </div>
              </motion.div>

              <div className="mt-10 flex flex-col gap-8">
                <motion.aside
                  className="space-y-6 lg:hidden"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  {renderSidebarContent()}
                </motion.aside>

                <section className="space-y-6">
                  <motion.div
                    className="rounded-[2rem] border border-border/60 bg-card/90 px-5 py-4 shadow-[0_18px_40px_-32px_rgba(0,0,0,0.55)]"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-foreground text-background">
                          <ListFilter className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                            Сортировка
                          </p>
                          <p className="text-sm font-semibold">
                            Выбери режим показа идей
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 rounded-full bg-background/70 p-1">
                        {sortOptions.map((option) => {
                          const isActive = sortBy === option.id;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => setSortBy(option.id)}
                              className={`rounded-full border px-4 py-2 text-xs font-semibold transition-all duration-300 ${
                                isActive
                                  ? "border-foreground bg-foreground text-background shadow-lg shadow-foreground/20"
                                  : "border-border/70 bg-background/70 text-foreground hover:bg-foreground hover:text-background"
                              }`}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-muted/70 px-3 py-1 font-semibold text-muted-foreground">
                        Показано {sortedIdeas.length} идей
                      </span>
                      <span className="rounded-full border border-border/70 bg-background/70 px-3 py-1 font-semibold text-muted-foreground">
                        {selectedCategoryLabel}
                      </span>
                      <span className="rounded-full border border-border/70 bg-background/70 px-3 py-1 font-semibold text-muted-foreground">
                        {selectedCityLabel}
                      </span>
                    </div>
                  </motion.div>

                  {loadError ? (
                    <motion.div
                      className="rounded-[2rem] border border-destructive/50 bg-destructive/10 px-5 py-4 text-sm text-destructive shadow-[0_18px_40px_-32px_rgba(0,0,0,0.45)]"
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span>Не удалось загрузить идеи: {loadError}</span>
                        <button
                          type="button"
                          onClick={handleReload}
                          className="rounded-full border border-destructive/60 px-4 py-2 text-xs font-semibold text-destructive transition-all duration-300 hover:bg-destructive hover:text-destructive-foreground"
                        >
                          Повторить
                        </button>
                      </div>
                    </motion.div>
                  ) : null}

                  <motion.div
                    key={`${selectedCategory}-${selectedCity}-${sortBy}`}
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="space-y-6"
                  >
                    <AnimatePresence mode="popLayout">
                      {isLoading ? (
                        <motion.div
                          key="loading"
                          variants={cardVariants}
                          className="rounded-[2rem] border border-dashed border-border/70 bg-card/60 p-6 text-sm text-muted-foreground"
                        >
                          Идеи загружаются...
                        </motion.div>
                      ) : sortedIdeas.length ? (
                        sortedIdeas.map((idea) => {
                          const voteShare = maxVotes
                            ? Math.round((idea.votes / maxVotes) * 100)
                            : 0;
                          return (
                            <motion.article
                              key={idea.id}
                              variants={cardVariants}
                              layout
                              className="group relative overflow-hidden rounded-[2.5rem] border border-border/60 bg-card/90 p-6 shadow-[0_20px_50px_-34px_rgba(0,0,0,0.5)] transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_28px_60px_-36px_rgba(0,0,0,0.6)]"
                            >
                              <span className="absolute left-0 top-0 h-full w-1.5 bg-foreground/20" />
                              <div className="relative flex flex-col gap-6 xl:flex-row">
                                <div className="flex-1 space-y-4">
                                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                                    <span className="rounded-full bg-foreground/10 px-3 py-1 text-foreground">
                                      {idea.category}
                                    </span>
                                    <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-3 py-1 text-muted-foreground">
                                      <MapPin className="h-3.5 w-3.5" />
                                      {idea.city}
                                    </span>
                                  </div>
                                  <div>
                                    <h3 className="text-xl font-bold sm:text-2xl">
                                      {idea.title}
                                    </h3>
                                    <p className="mt-2 text-sm text-muted-foreground">
                                      {idea.address}
                                    </p>
                                  </div>
                                  <p className="text-sm text-foreground/90">
                                    {idea.description}
                                  </p>

                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                      <span>{idea.votes} голосов</span>
                                      <span>{voteShare}%</span>
                                    </div>
                                    <div className="h-2 w-full rounded-full bg-muted/60">
                                      <div
                                        className="h-full rounded-full bg-foreground"
                                        style={{ width: `${voteShare}%` }}
                                      />
                                    </div>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:w-64">
                                  <motion.div
                                    className="relative h-28 overflow-hidden rounded-2xl border border-border/60 shadow-md sm:h-32"
                                    whileHover={{ scale: 1.03 }}
                                    transition={{ duration: 0.3 }}
                                  >
                                    <img
                                      src={idea.mapImage || "/placeholder.svg"}
                                      alt={`Карта - ${idea.title}`}
                                      className="h-full w-full object-cover"
                                    />
                                    <span className="absolute bottom-2 left-2 rounded-full bg-background/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                                      Карта
                                    </span>
                                    <div className="absolute bottom-3 right-3 h-3 w-3 rounded-full bg-foreground ring-2 ring-background shadow-lg" />
                                  </motion.div>
                                  <motion.div
                                    className="relative h-28 overflow-hidden rounded-2xl border border-border/60 shadow-md sm:h-32"
                                    whileHover={{ scale: 1.03 }}
                                    transition={{ duration: 0.3 }}
                                  >
                                    <img
                                      src={
                                        idea.photoImage || "/placeholder.svg"
                                      }
                                      alt={`Фото - ${idea.title}`}
                                      className="h-full w-full object-cover"
                                    />
                                    <span className="absolute bottom-2 left-2 rounded-full bg-background/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                                      Фото
                                    </span>
                                  </motion.div>
                                </div>
                              </div>

                              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border/60 pt-4">
                                <motion.button
                                  onClick={() => toggleLike(idea.id)}
                                  className={`flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition-all duration-300 ${
                                    idea.isLiked
                                      ? "border-foreground bg-foreground text-background"
                                      : "border-border/70 bg-background/70 text-muted-foreground hover:border-foreground hover:text-foreground"
                                  }`}
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                >
                                  <Heart
                                    className={`h-4 w-4 ${
                                      idea.isLiked ? "fill-current" : ""
                                    }`}
                                  />
                                  <span>{idea.likes}</span>
                                </motion.button>

                                <div className="flex flex-wrap items-center gap-3">
                                  <span className="rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs font-semibold text-muted-foreground">
                                    {idea.votes} голосов
                                  </span>
                                  <GradientButton
                                    className="px-5 py-2 text-xs sm:px-6 sm:py-3 sm:text-sm"
                                    onClick={() => handleVote(idea.id)}
                                    disabled={idea.isVoted}
                                  >
                                    {idea.isVoted ? "Голос учтен" : t("vote")}
                                  </GradientButton>
                                </div>
                              </div>
                            </motion.article>
                          );
                        })
                      ) : (
                        <motion.div
                          key="empty"
                          variants={cardVariants}
                          className="rounded-[2rem] border border-dashed border-border/70 bg-card/60 p-6 text-sm text-muted-foreground"
                        >
                          Идеи по этим фильтрам пока не найдены.
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
