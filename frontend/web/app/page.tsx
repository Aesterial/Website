"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Header, cities } from "@/components/header";
import { GradientButton } from "@/components/gradient-button";
import { MapLibreMap, type MapMarker } from "@/components/maplibre-map";
import { useLanguage } from "@/components/language-provider";
import { fetchTopProjects, type ApiProject } from "@/lib/api";
import { ArrowRight, MapPin, Users, Lightbulb } from "lucide-react";
import type { Variants } from "framer-motion";
import { Logo } from "@/components/logo";
import { useAuth } from "@/components/auth-provider";

const art = String.raw`⠀⠀⠀⠀⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣶⣤⣄⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⣿⠛⠻⢷⣤⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⡇⠀⠈⠛⠷⣤⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⣿⡄⠀⠀⠈⠻⣦⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⠘⣧⠀⢀⣄⡀⠈⠻⢦⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠘⣧⠀⢀⡀⠀⠈⠙⢷⣄⠀⠀⠀⠀⠀⠀⠀⢸⡿⢿⡀⠘⡏⠛⢦⠀⠀⠙⢷⡄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⢹⣇⢸⡏⠳⣄⠀⢺⡿⣦⡀⣀⣤⡶⠾⠛⠛⠻⡄⠙⠀⣸⡄⠈⠳⡄⠀⠈⠻⣆⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⢻⡄⢳⡀⢈⣷⠀⠻⠀⠉⠁⠀⠀⠀⠀⠀⠀⠀⡄⠀⠀⠉⠳⢤⣻⡀⠀⠀⠹⣧⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠈⣧⠀⣷⠟⠁⠀⠚⠃⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠘⢷⡄⠀⠀⠘⣧⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⢺⣯⣾⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠹⣧⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⣸⡏⠙⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢹⣆⠀⠀⠀⠀⠀
⠀⠀⠀⠀⢠⡿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⣿⠀⠀⠀⠀⠀
⠀⠀⠀⠀⣾⠁⢀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢹⡇⠀⠀⠀⠀
⠀⠀⠀⣸⡇⠀⢺⣆⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⠀⠀⠀⠀⠀⢸⡇⠀⠀⠀⠀
⢀⣠⣿⢿⡁⠀⠀⢻⣶⣤⣄⣀⣤⣴⡿⠂⠀⠀⠀⠀⠀⠀⢴⣦⣀⠀⠀⠀⢀⣠⣴⡛⠁⠀⠀⠀⠀⢸⡇⠀⠀⠀⠀
⢸⣍⠙⠓⠉⠀⠀⣸⡆⠈⠉⠉⣻⡄⠀⠀⠀⣶⠦⣤⣄⠀⠀⠉⠙⣿⠛⠛⠉⠁⣠⡇⠀⠀⠀⠀⣤⣿⣧⠀⠀⠀⠀
⠀⠙⢷⣦⡀⠀⢹⡇⠀⠀⠀⣰⠿⠁⠀⠀⠀⠛⢶⠛⠁⠀⠀⠀⠰⣟⡀⠀⠀⠰⣇⠀⠀⠀⠀⠀⢀⣴⡏⠀⠀⠀⠀
⠀⠀⠀⠘⢧⣀⡞⠋⠀⠀⠰⡇⠀⠀⠀⠀⠀⣴⠿⠦⠀⠀⠀⠀⠀⣸⠇⠀⠀⢀⡿⠃⠀⠀⢀⣀⣀⣼⠇⠀⠀⠀⠀
⠀⠀⠀⠀⠈⠻⢧⣀⠠⢤⡾⠛⠀⠀⠀⠀⠀⠀⠀⠀⡞⠛⠳⢦⡈⣧⠀⠀⠀⠘⢦⡀⠀⣠⡾⠛⠋⠁⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠙⠻⢾⣆⡀⠀⠀⠀⠀⠀⠀⠀⠀⣇⠀⠀⠀⠹⣎⣆⠀⢀⣢⣼⡷⠞⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⢙⡿⠶⠦⣤⡀⠀⠀⠀⢹⣄⠀⠀⠀⠈⢻⡿⣿⡉⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣴⠏⠀⠀⢀⡆⠀⠀⠀⠀⠀⠹⣆⠀⠀⠀⠀⠹⣮⠻⣦⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⣠⡾⠁⠀⠀⠀⣾⠁⠀⠀⠀⠀⠀⠀⠘⢧⡀⠀⠀⠀⠀⠀⣿⠀⠀⠀⠀⠀⠀⠀⣀⣶⠿⢷⣤
⠀⠀⠀⠀⠀⠀⠀⠀⡟⠀⠀⣀⣤⢾⡏⠀⠀⠀⠀⠀⠀⠀⠀⠀⠙⠲⢤⣤⣤⡾⠋⠀⠀⠀⠀⠀⢀⣾⠏⠀⠀⢀⣿
⠀⠀⠀⠀⠀⠀⠀⠀⠻⠖⠛⠋⠀⣼⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠸⣧⠀⠀⠀⠀⠀⠀⣴⠟⠁⠀⠀⣠⡾⠃
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⡏⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⠀⠀⠀⢀⣰⠾⠁⠀⣀⣤⠾⠋⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣼⠇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢿⡦⠶⠾⣛⣁⣤⠶⠟⠋⠁⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⠀⠀⣀⣤⣤⣤⡤⠤⠤⠤⣤⣤⣄⣀⠀⢾⡶⠶⠛⠛⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⡏⠀⠀⣸⡏⠀⠀⠀⠀⠀⠀⠀⠀⢷⡀⠀⢸⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠸⣷⠀⢠⡿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠸⣧⠀⣸⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠙⠻⠛⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠹⠿⠟⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀`;

const lines = art.split("\n");
const n = Math.max(lines.length - 1, 1);

for (let i = 0; i < lines.length; i++) {
  const hue = Math.round((i / n) * 360);
  const style = [
    `color: hsl(${hue} 95% 70%)`,
    `background: #05060a`,
    `font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`,
    `font-size: 12px`,
    `line-height: 12px`,
    `white-space: pre`,
    `text-shadow: 0 0 10px hsla(${hue}, 95%, 70%, .55), 0 0 2px hsla(${hue}, 95%, 70%, .9)`,
    `padding: 0 6px`,
  ].join("; ");
  console.log(`%c${lines[i]}`, style);
}

const easeOut: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const containerVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.45,
      ease: easeOut,
      when: "beforeChildren",
      staggerChildren: 0.08,
    },
  },
};

export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.1,
      ease: easeOut,
    },
  },
};

type PopularIdea = {
  rank: number;
  address: string;
};

const POPULAR_IDEAS_LIMIT = 3;
const FALLBACK_ADDRESS = "/";

const getPopularAddress = (project?: ApiProject | null) => {
  if (!project) {
    return FALLBACK_ADDRESS;
  }
  const info = project.details ?? project.info ?? null;
  const location = info?.location ?? null;
  const addressParts = [
    location?.street?.trim(),
    location?.house?.trim(),
  ].filter((part): part is string => Boolean(part));
  if (addressParts.length) {
    return addressParts.join(" ");
  }
  const title = info?.title?.trim();
  return title || FALLBACK_ADDRESS;
};

const MAP_PROJECTS_LIMIT = 12;
const DEFAULT_CITY_CENTER: [number, number] = [86.0877, 55.3541];
const COORDINATE_JITTER_RANGE = 0.04;

const normalizeLocation = (value?: string | null) =>
  value?.trim().toLowerCase() ?? "";

const parseCoordinate = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.replace(",", ".").trim();
    if (!normalized) {
      return null;
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const resolveCoordinates = (
  location?: Record<string, unknown> | null,
): [number, number] | null => {
  if (!location) {
    return null;
  }
  const lat = parseCoordinate(
    location.lat ?? location.latitude ?? location.y ?? location.latDeg,
  );
  const lng = parseCoordinate(
    location.lng ?? location.lon ?? location.longitude ?? location.x,
  );
  if (lat != null && lng != null) {
    return [lng, lat];
  }

  const coords = location.coordinates ?? location.coord ?? location.location;
  if (Array.isArray(coords) && coords.length >= 2) {
    const first = parseCoordinate(coords[0]);
    const second = parseCoordinate(coords[1]);
    if (first != null && second != null) {
      const isLatFirst = Math.abs(first) <= 90 && Math.abs(second) <= 180;
      const isLngFirst = Math.abs(first) <= 180 && Math.abs(second) <= 90;
      if (isLngFirst) {
        return [first, second];
      }
      if (isLatFirst) {
        return [second, first];
      }
    }
  }

  return null;
};

const hashSeed = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const applyCoordinateJitter = (
  center: [number, number],
  seed: string,
): [number, number] => {
  if (!seed) {
    return center;
  }
  const hash = hashSeed(seed);
  const offsetLng = ((hash % 1000) / 1000 - 0.5) * COORDINATE_JITTER_RANGE;
  const offsetLat =
    (((hash >> 10) % 1000) / 1000 - 0.5) * COORDINATE_JITTER_RANGE;
  return [center[0] + offsetLng, center[1] + offsetLat];
};

const resolveCityCenter = (city?: string | null) => {
  const normalized = normalizeLocation(city);
  if (!normalized) {
    return DEFAULT_CITY_CENTER;
  }
  return DEFAULT_CITY_CENTER;
};

const getProjectInfo = (project?: ApiProject | null) =>
  project?.details ?? project?.info ?? null;

const cardGlowStyle = {
  "--x": "50%",
  "--y": "50%",
} as CSSProperties;

const updateCardGlow = (event: MouseEvent<HTMLDivElement>) => {
  const rect = event.currentTarget.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  event.currentTarget.style.setProperty("--x", `${x}px`);
  event.currentTarget.style.setProperty("--y", `${y}px`);
};

const resetCardGlow = (event: MouseEvent<HTMLDivElement>) => {
  event.currentTarget.style.setProperty("--x", "50%");
  event.currentTarget.style.setProperty("--y", "50%");
};

export default function HomePage() {
  const [popularIdeas, setPopularIdeas] = useState<PopularIdea[]>([]);
  const [popularLoading, setPopularLoading] = useState(true);
  const [mapMarkers, setMapMarkers] = useState<MapMarker[]>([]);
  const [mapLoading, setMapLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<ApiProject | null>(
    null,
  );
  const [selectedProjectLoading, setSelectedProjectLoading] = useState(false);
  const [selectedCity, setSelectedCity] = useState<string>(cities[0] ?? "");
  const projectDetailsCacheRef = useRef(new Map<string, ApiProject>());
  const { t } = useLanguage();
  const { status } = useAuth();
  const currentYear = new Date().getFullYear();
  const mapCenter = useMemo(
    () => resolveCityCenter(selectedCity),
    [selectedCity],
  );
  const startHref = status === "authenticated" ? "/voting" : "/auth";

  useEffect(() => {
    const savedCity = localStorage.getItem("city");
    if (savedCity) {
      setSelectedCity(savedCity);
    }
  }, []);

  useEffect(() => {
    if (!selectedCity) {
      return;
    }
    const controller = new AbortController();
    setPopularLoading(true);
    setMapLoading(true);
    setSelectedProject(null);
    projectDetailsCacheRef.current.clear();

    const loadTopProjects = async () => {
      try {
        const projects = await fetchTopProjects({
          limit: MAP_PROJECTS_LIMIT,
          city: selectedCity,
          signal: controller.signal,
        });
        if (controller.signal.aborted) {
          return;
        }
        const mapped = projects
          .slice(0, POPULAR_IDEAS_LIMIT)
          .map((project, index) => ({
            rank: index + 1,
            address: getPopularAddress(project),
          }));
        setPopularIdeas(mapped);

        const markers: MapMarker[] = projects.flatMap((project) => {
          const info = getProjectInfo(project);
          const id = project.id?.toString();

          if (!id) return [];

          const center = resolveCityCenter(selectedCity);
          const location = info?.location as
            | Record<string, unknown>
            | undefined;

          const coordinates =
            resolveCoordinates(location) ?? applyCoordinateJitter(center, id);

          const marker: MapMarker = {
            id,
            coordinates,
            title: info?.title?.trim() || getPopularAddress(project),
          };

          const trimmedDescription = info?.description?.trim();
          if (trimmedDescription) {
            marker.description = trimmedDescription;
          }

          return [marker];
        });

        setMapMarkers(markers);
      } catch {
        if (!controller.signal.aborted) {
          setPopularIdeas([]);
          setMapMarkers([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setPopularLoading(false);
          setMapLoading(false);
        }
      }
    };

    void loadTopProjects();

    return () => controller.abort();
  }, [selectedCity]);

  const projectDetailsRequestRef = useRef(0);

  const handleMarkerClick = async (marker: MapMarker) => {
    const cached = projectDetailsCacheRef.current.get(marker.id);
    if (cached) {
      setSelectedProject(cached);
      return;
    }

    const requestId = projectDetailsRequestRef.current + 1;
    projectDetailsRequestRef.current = requestId;
    setSelectedProjectLoading(true);

    try {
      const projects = await fetchTopProjects({
        limit: MAP_PROJECTS_LIMIT,
        city: selectedCity,
      });
      if (projectDetailsRequestRef.current !== requestId) {
        return;
      }
      const match =
        projects.find((project) => project.id?.toString() === marker.id) ??
        null;
      if (match) {
        projectDetailsCacheRef.current.set(marker.id, match);
      }
      setSelectedProject(match);
    } catch {
      if (projectDetailsRequestRef.current === requestId) {
        setSelectedProject(null);
      }
    } finally {
      if (projectDetailsRequestRef.current === requestId) {
        setSelectedProjectLoading(false);
      }
    }
  };

  const selectedProjectSummary = useMemo(() => {
    if (!selectedProject) {
      return null;
    }
    const info = getProjectInfo(selectedProject);
    return {
      title: info?.title?.trim() || t("ideas"),
      description: info?.description?.trim() || t("mapProjectNoDescription"),
      address: getPopularAddress(selectedProject),
    };
  }, [selectedProject, t]);

  const hasMapMarkers = mapMarkers.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <section className="pt-24 pb-16 px-4 sm:pt-28 sm:pb-20 sm:px-6 lg:pt-32">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-10 items-center lg:gap-16">
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <motion.h1
                variants={itemVariants}
                className="text-3xl sm:text-4xl lg:text-6xl font-bold leading-tight mb-6 text-balance"
              >
                {t("heroTitle")}
              </motion.h1>

              <motion.p
                variants={itemVariants}
                className="text-base text-muted-foreground mb-8 leading-relaxed sm:text-lg lg:text-xl max-w-xl"
              >
                {t("heroSubtitle")}
              </motion.p>

              <motion.div variants={itemVariants}>
                <Link href="/voting">
                  <GradientButton className="w-full justify-center sm:w-auto">
                    {t("start")}
                  </GradientButton>
                </Link>
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              <div className="space-y-4">
                <MapLibreMap
                  center={mapCenter}
                  zoom={12}
                  markers={mapMarkers}
                  onMarkerClick={handleMarkerClick}
                />
                <div className="rounded-2xl border border-border/70 bg-card/90 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                    {t("mapProjectDetailsTitle")}
                  </p>
                  {mapLoading ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {t("mapProjectsLoading")}
                    </p>
                  ) : selectedProjectLoading ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {t("mapProjectLoading")}
                    </p>
                  ) : selectedProjectSummary ? (
                    <div className="mt-3 space-y-2">
                      <p className="text-sm font-semibold">
                        {selectedProjectSummary.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedProjectSummary.address}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {selectedProjectSummary.description}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {hasMapMarkers
                        ? t("mapProjectSelectPrompt")
                        : t("mapProjectsEmpty")}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-16 px-4 bg-background sm:py-20 sm:px-6">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-10 items-center lg:gap-16">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl sm:text-4xl lg:text-6xl font-bold mb-8 sm:mb-12">
                {t("voting")}
              </h2>

              <p className="text-muted-foreground italic mb-6 text-sm sm:text-base">
                {t("mostPopularIdeas")}
              </p>

              <motion.div
                className="bg-card rounded-3xl p-4 mb-8 shadow-sm border border-border sm:p-6"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
              >
                <div className="space-y-5">
                  {popularLoading ? (
                    <p className="text-sm text-muted-foreground">
                      Загружаем идеи...
                    </p>
                  ) : popularIdeas.length ? (
                    popularIdeas.map((idea, index) => (
                      <motion.div
                        key={idea.rank}
                        className="flex flex-col items-start gap-2 cursor-pointer hover:bg-muted/50 rounded-xl p-3 -mx-3 transition-colors duration-300 sm:flex-row sm:items-center sm:gap-4"
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.3 + index * 0.1 }}
                        whileHover={{ x: 8 }}
                      >
                        <span className="text-lg font-bold sm:text-2xl">
                          {idea.rank}.
                        </span>
                        <span className="text-sm font-semibold break-words sm:text-lg">
                          {idea.address}
                        </span>
                      </motion.div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      нет информации
                    </p>
                  )}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5 }}
              >
                <Link href="/voting">
                  <GradientButton className="w-full justify-center sm:w-auto">
                    {t("vote")}
                  </GradientButton>
                </Link>
              </motion.div>
            </motion.div>

            <motion.div
              className="flex justify-center"
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              <div className="relative">
                <div className="relative w-[72vw] max-w-[280px] h-[420px] bg-foreground rounded-[3.5rem] p-3 shadow-2xl sm:w-64 sm:h-[520px] lg:w-72 lg:h-[580px]">
                  <div className="absolute -right-1 top-28 w-1 h-12 bg-foreground rounded-l-sm" />
                  <div className="absolute -left-1 top-24 w-1 h-8 bg-foreground rounded-r-sm" />
                  <div className="absolute -left-1 top-36 w-1 h-16 bg-foreground rounded-r-sm" />

                  <div className="bg-background w-full h-full rounded-[3rem] overflow-hidden relative">
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 w-28 h-8 bg-foreground rounded-full" />

                    <div className="pt-14 px-3 h-full flex flex-col items-center justify-center sm:pt-16 sm:px-4">
                      <motion.div
                        className="text-center"
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{
                          duration: 2,
                          repeat: Number.POSITIVE_INFINITY,
                        }}
                      >
                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center">
                          <MapPin className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {t("ideas")}
                        </p>
                      </motion.div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-16 px-4 bg-background sm:py-20 sm:px-6">
        <div className="container mx-auto">
          <motion.div
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 sm:gap-8"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {[
              {
                icon: Lightbulb,
                titleKey: "suggestIdea",
                description:
                  "Делитесь своими предложениями по улучшению города",
              },
              {
                icon: Users,
                titleKey: "vote",
                description: "Поддерживайте лучшие инициативы других жителей",
              },
              {
                icon: MapPin,
                titleKey: "ideas",
                description: "Указывайте конкретные места для реализации идей",
              },
            ].map((feature) => (
              <motion.div
                key={feature.titleKey}
                variants={itemVariants}
                whileHover={{ y: -8 }}
                onMouseMove={updateCardGlow}
                onMouseLeave={resetCardGlow}
                style={cardGlowStyle}
                className="group relative overflow-hidden rounded-[2rem] border border-border/60 bg-card/80 p-6 shadow-[0_24px_55px_-40px_rgba(0,0,0,0.45)] transition-all duration-500 hover:shadow-[0_35px_70px_-45px_rgba(0,0,0,0.6)] dark:border-white/10 dark:shadow-[0_30px_70px_-50px_rgba(0,0,0,0.9)] before:content-[''] before:absolute before:inset-0 before:pointer-events-none before:opacity-0 before:transition-opacity before:duration-300 before:bg-[radial-gradient(520px_circle_at_var(--x)_var(--y),_rgba(0,0,0,0.16),_transparent_45%)] dark:before:bg-[radial-gradient(520px_circle_at_var(--x)_var(--y),_rgba(255,255,255,0.2),_transparent_45%)] group-hover:before:opacity-100 after:content-[''] after:absolute after:inset-0 after:pointer-events-none after:opacity-60 after:bg-[linear-gradient(130deg,_rgba(255,255,255,0.28),_rgba(255,255,255,0)_55%)] dark:after:bg-[linear-gradient(130deg,_rgba(255,255,255,0.12),_rgba(255,255,255,0)_55%)] sm:p-8"
              >
                <div className="relative z-10">
                  <div className="relative mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground text-background shadow-[0_12px_28px_-12px_rgba(0,0,0,0.45)] transition-transform duration-300 group-hover:scale-105 sm:h-14 sm:w-14">
                    <span className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_30%_20%,_rgba(255,255,255,0.55),_transparent_60%)] opacity-70" />
                    <feature.icon className="relative h-6 w-6 sm:h-7 sm:w-7" />
                  </div>
                  <h3 className="text-lg font-bold mb-3 sm:text-xl">
                    {t(feature.titleKey)}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed sm:text-base">
                    {feature.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="py-16 px-4 sm:py-24 sm:px-6">
        <div className="container mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl font-bold mb-6 sm:text-4xl">
              {t("cityOfIdeas")}
            </h2>
            <p className="text-base text-muted-foreground mb-8 max-w-2xl mx-auto sm:text-lg lg:text-xl sm:mb-10">
              {t("heroSubtitle")}
            </p>
            <Link href={startHref}>
              <GradientButton className="w-full justify-center sm:w-auto">
                {t("start")}
                <ArrowRight className="w-5 h-5" />
              </GradientButton>
            </Link>
          </motion.div>
        </div>
      </section>

      <motion.footer
        className="relative border-t border-border bg-background"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 left-1/2 h-48 w-[520px] -translate-x-1/2 rounded-full bg-foreground/5 blur-3xl dark:bg-foreground/10" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/15 to-transparent" />
        </div>

        <div className="container mx-auto px-4 py-8 sm:px-6">
          <motion.div
            variants={itemVariants}
            className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Logo className="h-8 w-8 shrink-0" showText={false} />
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">
                  {t("cityOfIdeas")}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {t("heroSubtitle")}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/suggest"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-muted/60"
              >
                {t("suggestIdea")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </motion.div>

          <motion.div
            variants={itemVariants}
            className="mt-5 flex flex-col gap-2 border-t border-border/60 pt-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between"
          >
            <span>
              © {currentYear} {t("cityOfIdeas")}
            </span>

            <Link
              href="/support"
              className="inline-flex items-center gap-2 hover:text-foreground transition"
            >
              {t("askQuestion")}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </motion.div>
        </div>
      </motion.footer>
    </div>
  );
}
