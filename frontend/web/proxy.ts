import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const DEV_API_BASE_URL = "http://127.0.0.1:8080";
const CACHE_TTL_MS = 0.5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 1500;
const REFRESH_PARAM = "maintenanceRefresh";

let cachedActive: boolean | null = null;
let cachedAt = 0;
let pendingRequest: Promise<boolean> | null = null;
let requestToken = 0;

const DISABLE_MAINTENANCE_CHECKS = false;

const stripTrailingSlash = (value: string) => value.replace(/\/$/, "");

const ensureHttps = (value: string) => {
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

const resolveApiBaseUrl = (request: NextRequest) => {
  const envBase = (process.env.NEXT_PUBLIC_API_BASE_URL || "").trim();
  if (envBase) {
    return envBase;
  }
  if (process.env.NODE_ENV === "development") {
    return DEV_API_BASE_URL;
  }
  return request.nextUrl.origin;
};

const readActiveFlag = (payload: unknown): boolean | null => {
  if (typeof payload === "boolean") {
    return payload;
  }
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const record = payload as Record<string, unknown>;
  const candidates = ["has", "active", "data", "maintenance", "enabled"];
  for (const key of candidates) {
    const value = record[key];
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "number") {
      return value > 0;
    }
  }
  return null;
};

const isExplicitlyInactive = (payload: unknown) => {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  const record = payload as Record<string, unknown>;
  const message =
    typeof record.message === "string" ? record.message.toLowerCase() : "";
  const code = typeof record.code === "number" ? record.code : null;
  if (message.includes("maintenance is not active")) {
    return true;
  }
  if (code === 14 && message.includes("not active")) {
    return true;
  }
  return false;
};

const fetchMaintenanceActive = async (request: NextRequest) => {
  const base = resolveApiBaseUrl(request);
  const normalizedBase =
    process.env.NODE_ENV === "production" ? ensureHttps(base) : base;
  const url = `${stripTrailingSlash(normalizedBase)}/api/maintenance/active`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
    });
    if (response.status === 503) {
      return false;
    }
    const contentType = response.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    let payload: unknown = null;
    let parsed = false;
    if (isJson) {
      try {
        payload = (await response.json()) as unknown;
        parsed = true;
      } catch {
        parsed = false;
      }
    }
    const flag = readActiveFlag(payload);
    if (flag !== null) {
      return flag;
    }
    if (!response.ok && isExplicitlyInactive(payload)) {
      return false;
    }
    if (!response.ok) {
      return parsed;
    }
    return false;
  } catch {
    return true;
  } finally {
    clearTimeout(timeoutId);
  }
};

const getMaintenanceActive = async (
  request: NextRequest,
  forceRefresh = false,
) => {
  const now = Date.now();
  if (!forceRefresh && cachedActive !== null && now - cachedAt < CACHE_TTL_MS) {
    return cachedActive;
  }
  if (!forceRefresh && pendingRequest) {
    return pendingRequest;
  }
  const token = ++requestToken;
  const requestPromise = fetchMaintenanceActive(request)
    .then((result) => {
      if (token === requestToken) {
        cachedActive = result;
        cachedAt = Date.now();
      }
      return result;
    })
    .finally(() => {
      if (token === requestToken) {
        pendingRequest = null;
      }
    });
  pendingRequest = requestPromise;
  return requestPromise;
};

export async function proxy(request: NextRequest) {
  if (DISABLE_MAINTENANCE_CHECKS) {
    return NextResponse.next();
  }
  const { pathname, searchParams } = request.nextUrl;
  const forceRefresh = searchParams.has(REFRESH_PARAM);
  if (pathname === "/technics" || pathname.startsWith("/technics/")) {
    if (forceRefresh) {
      const isActive = await getMaintenanceActive(request, true);
      if (!isActive) {
        const url = request.nextUrl.clone();
        url.searchParams.delete(REFRESH_PARAM);
        url.pathname = "/";
        return NextResponse.redirect(url, 307);
      }
    }
    return NextResponse.next();
  }
  const isActive = await getMaintenanceActive(request, forceRefresh);
  if (isActive) {
    const url = request.nextUrl.clone();
    url.searchParams.delete(REFRESH_PARAM);
    url.pathname = "/technics";
    return NextResponse.redirect(url, 307);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)"],
};
