import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const DEV_API_BASE_URL = "http://127.0.0.1:8080";
const REQUEST_TIMEOUT_MS = 1500;
const REFRESH_PARAM = "maintenanceRefresh";
const LOGIN_CHECK_PATH = "/api/login/check";
const ALLOW_SERVER_ACTIONS = process.env.NEXT_ALLOW_SERVER_ACTIONS === "1";

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

type AuthCheckStatus =
  | "authenticated"
  | "anonymous"
  | "mfa_required"
  | "unknown";

const fetchAuthStatus = async (
  request: NextRequest,
): Promise<AuthCheckStatus> => {
  const base = resolveApiBaseUrl(request);
  const normalizedBase =
    process.env.NODE_ENV === "production" ? ensureHttps(base) : base;
  const url = `${stripTrailingSlash(normalizedBase)}${LOGIN_CHECK_PATH}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Cookie: request.headers.get("cookie") ?? "",
      },
      cache: "no-store",
      signal: controller.signal,
    });
    if (response.status === 200) {
      return "authenticated";
    }
    if (response.status === 400) {
      return "anonymous";
    }
    if (response.status === 403) {
      return "mfa_required";
    }
    return "unknown";
  } catch {
    return "unknown";
  } finally {
    clearTimeout(timeoutId);
  }
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
        Cookie: request.headers.get("cookie") ?? "",
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
    if (isJson) {
      try {
        payload = (await response.json()) as unknown;
      } catch {
        payload = null;
      }
    }
    const flag = readActiveFlag(payload);
    if (flag !== null) {
      return flag;
    }
    if (!response.ok) {
      return false;
    }
    return false;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
};

const getMaintenanceActive = async (request: NextRequest) =>
  fetchMaintenanceActive(request);

const isMaintenanceBypassPath = (pathname: string) => {
  if (pathname === "/technics" || pathname.startsWith("/technics/")) {
    return true;
  }
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return true;
  }
  if (pathname === "/login" || pathname.startsWith("/login/")) {
    return true;
  }
  if (pathname === "/auth" || pathname.startsWith("/auth/")) {
    return true;
  }
  return false;
};

export async function proxy(request: NextRequest) {
  const nextActionId = request.headers.get("next-action");
  if (nextActionId && !ALLOW_SERVER_ACTIONS) {
    return new NextResponse("Server action not found.", {
      status: 404,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  }

  const authStatus = await fetchAuthStatus(request);
  const requiresMfa = authStatus === "mfa_required";

  if (DISABLE_MAINTENANCE_CHECKS) {
    const response = NextResponse.next();
    response.headers.set("x-auth-status", authStatus);
    response.headers.set("x-mfa-required", requiresMfa ? "1" : "0");
    return response;
  }
  const { pathname, searchParams } = request.nextUrl;
  const forceRefresh = searchParams.has(REFRESH_PARAM);
  if (isMaintenanceBypassPath(pathname)) {
    if (forceRefresh) {
      const isActive = await getMaintenanceActive(request);
      if (
        (pathname === "/technics" || pathname.startsWith("/technics/")) &&
        !isActive
      ) {
        const url = request.nextUrl.clone();
        url.searchParams.delete(REFRESH_PARAM);
        url.pathname = "/";
        const response = NextResponse.redirect(url, 307);
        response.headers.set("x-auth-status", authStatus);
        response.headers.set("x-mfa-required", requiresMfa ? "1" : "0");
        return response;
      }
    }
    const response = NextResponse.next();
    response.headers.set("x-auth-status", authStatus);
    response.headers.set("x-mfa-required", requiresMfa ? "1" : "0");
    return response;
  }
  const isActive = await getMaintenanceActive(request);
  if (isActive) {
    const url = request.nextUrl.clone();
    url.searchParams.delete(REFRESH_PARAM);
    url.pathname = "/technics";
    const response = NextResponse.redirect(url, 307);
    response.headers.set("x-auth-status", authStatus);
    response.headers.set("x-mfa-required", requiresMfa ? "1" : "0");
    return response;
  }
  const response = NextResponse.next();
  response.headers.set("x-auth-status", authStatus);
  response.headers.set("x-mfa-required", requiresMfa ? "1" : "0");
  return response;
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)"],
};
