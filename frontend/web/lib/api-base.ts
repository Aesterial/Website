const DEV_API_BASE_URL = "http://127.0.0.1:8080";

export const stripTrailingSlash = (value: string) => value.replace(/\/$/, "");

export const ensureHttps = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (trimmed.startsWith("https://") || trimmed.startsWith("/")) {
    return trimmed;
  }
  if (trimmed.startsWith("http://")) {
    return `https://${trimmed.slice("http://".length)}`;
  }
  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }
  return `https://${trimmed}`;
};

const applyApiSubdomain = (origin: string) => {
  const normalizedOrigin = stripTrailingSlash(origin.trim());
  if (!normalizedOrigin) {
    return normalizedOrigin;
  }

  try {
    const url = new URL(ensureHttps(normalizedOrigin));
    if (!url.hostname.startsWith("api.")) {
      url.hostname = `api.${url.hostname}`;
    }
    return stripTrailingSlash(url.toString());
  } catch {
    return normalizedOrigin;
  }
};

export const resolveApiBaseUrl = (origin?: string) => {
  const envBase = (process.env.NEXT_PUBLIC_API_BASE_URL || "").trim();
  if (envBase) {
    return envBase;
  }
  if (process.env.NODE_ENV === "development") {
    return DEV_API_BASE_URL;
  }
  if (origin) {
    return applyApiSubdomain(origin);
  }
  if (typeof window !== "undefined" && window.location?.host) {
    return applyApiSubdomain(window.location.origin);
  }
  return "";
};

export const getApiBaseUrl = (origin?: string) => {
  const rawBaseUrl = resolveApiBaseUrl(origin);
  const normalizedBaseUrl =
    process.env.NODE_ENV === "production"
      ? ensureHttps(rawBaseUrl)
      : rawBaseUrl;
  return stripTrailingSlash(normalizedBaseUrl);
};

export const API_BASE_URL = getApiBaseUrl();

export const buildApiUrl = (path: string, baseUrl = API_BASE_URL) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (
    baseUrl.endsWith("/api") &&
    (normalizedPath === "/api" || normalizedPath.startsWith("/api/"))
  ) {
    return `${baseUrl}${normalizedPath.slice("/api".length)}`;
  }

  return `${baseUrl}${normalizedPath}`;
};
