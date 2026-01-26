import type {
  ApiAvatar,
  ApiProject,
  ApiProjectInfo,
  ApiSubmissionTarget,
} from "@/lib/api";
import { formatCoordinates, resolveCoordinates } from "@/lib/location";

export type SubmissionStatus = "approved" | "declined" | "pending";

export type Submission = {
  id: string;
  title: string;
  status: SubmissionStatus;
  declineReason?: string;
  authorName: string;
  authorId?: number;
  submittedAt: string;
  location: string;
  city: string;
  coordinates?: [number, number] | null;
  source: string;
  category: string;
  summary: string;
  description: string;
  coverImage: string;
  images: string[];
};

export type SubmissionMapperOptions = {
  locale: string;
  resolveCategoryLabel: (value: unknown) => string;
};

export const statusMeta: Record<
  SubmissionStatus,
  { labelKey: string; descriptionKey: string }
> = {
  approved: {
    labelKey: "statusApproved",
    descriptionKey: "adminStatusApprovedDesc",
  },
  pending: {
    labelKey: "statusPending",
    descriptionKey: "adminStatusPendingDesc",
  },
  declined: {
    labelKey: "statusDeclined",
    descriptionKey: "adminStatusDeclinedDesc",
  },
};

const UNKNOWN_LABEL = "-";
const FALLBACK_IMAGE = "/placeholder.svg";

const normalizeStatus = (value?: string): SubmissionStatus | null => {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (
    normalized === "waiting" ||
    normalized === "pending" ||
    normalized === "active"
  ) {
    return "pending";
  }
  if (normalized === "approved") {
    return "approved";
  }
  if (normalized === "declined") {
    return "declined";
  }
  return null;
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

const formatDate = (value: string, locale: string) => {
  if (!value) {
    return UNKNOWN_LABEL;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return UNKNOWN_LABEL;
  }
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const toImageSrc = (photo?: ApiAvatar | null) => {
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

const resolveProjectInfo = (
  project?: ApiProject | null,
): ApiProjectInfo | null => project?.info ?? project?.details ?? null;

const resolveAuthorName = (project?: ApiProject | null) => {
  const author = project?.author ?? null;
  const settings = author?.settings ?? undefined;
  return (
    settings?.display_name ??
    settings?.displayName ??
    author?.username ??
    UNKNOWN_LABEL
  );
};

const resolveAuthorId = (project?: ApiProject | null) => {
  const author = project?.author ?? null;
  const id = author?.userID ?? author?.uid;
  return typeof id === "number" ? id : undefined;
};

const toSummary = (description: string) => {
  if (!description) {
    return UNKNOWN_LABEL;
  }
  const trimmed = description.trim();
  if (trimmed.length <= 140) {
    return trimmed;
  }
  return `${trimmed.slice(0, 137).trimEnd()}...`;
};

export const mapSubmissionTarget = (
  payload: ApiSubmissionTarget,
  options: SubmissionMapperOptions,
): Submission | null => {
  const rawId = payload.id;
  const id =
    typeof rawId === "number"
      ? String(rawId)
      : typeof rawId === "string"
        ? rawId.trim()
        : "";
  if (!id) {
    return null;
  }

  const status = normalizeStatus(payload.state);
  if (!status) {
    return null;
  }

  const project = payload.info ?? null;
  const info = resolveProjectInfo(project);
  const title = info?.title?.trim() || UNKNOWN_LABEL;
  const description = info?.description?.trim() || "";
  const category = options.resolveCategoryLabel(info?.category);

  const location = info?.location ?? null;
  const coordinates = resolveCoordinates(location);
  const locationParts = [
    location?.street?.trim(),
    location?.house?.trim(),
  ].filter((part): part is string => Boolean(part));
  const locationLabel = locationParts.length
    ? locationParts.join(" ")
    : coordinates
      ? formatCoordinates(coordinates)
      : UNKNOWN_LABEL;
  const city = location?.city?.trim() || UNKNOWN_LABEL;

  const photos = Array.isArray(info?.photos) ? info?.photos : [];
  const images = photos.map(toImageSrc).filter(Boolean);
  if (images.length === 0) {
    images.push(FALLBACK_IMAGE);
  }

  const createdAt = formatDate(
    parseTimestamp(project?.createdAt ?? project?.created_at),
    options.locale,
  );

  const declineReason =
    status === "declined" && payload.reason?.trim()
      ? payload.reason.trim()
      : undefined;

  return {
    id,
    title,
    status,
    declineReason,
    authorName: resolveAuthorName(project),
    authorId: resolveAuthorId(project),
    submittedAt: createdAt,
    location: locationLabel,
    city,
    coordinates,
    source: UNKNOWN_LABEL,
    category,
    summary: toSummary(description),
    description: description || UNKNOWN_LABEL,
    coverImage: images[0] ?? FALLBACK_IMAGE,
    images,
  };
};
