export type RegisterPayload = {
  username: string;
  password: string;
  email: string;
};

export type AuthorizationPayload = {
  usermail: string;
  password: string;
};

type ApiEmail = {
  address: string;
  verified: boolean;
};

export type ApiRank = {
  name: string;
  expires?: string | null;
};

export type ApiAvatar = {
  contentType: string;
  data: string;
};

type ApiUserSettings = {
  display_name?: string | null;
  displayName?: string | null;
  session_live_time?: number | null;
  sessionLiveTime?: number | null;
  avatar?: ApiAvatar | null;
};

type ApiUserPublic = {
  uid?: number;
  userID?: number;
  username?: string;
  settings?: ApiUserSettings | null;
  rank?: ApiRank | null;
  joined?: string;
  joinedAt?: string;
};

type ApiUser = {
  uid?: number;
  userID?: number;
  username?: string;
  public?: ApiUserPublic | null;
  email?: ApiEmail | null;
  settings?: ApiUserSettings | null;
  rank?: ApiRank | null;
  joined?: string;
  joinedAt?: string;
};

type ApiUserResponse = {
  data?: ApiUser | null;
  tracing?: string;
};

type ApiUsersResponse = {
  data?: ApiUserPublic[] | null;
  tracing?: string;
};

type ApiBanInfoResponse = {
  id?: string;
  reason?: string;
  at?: string;
  expires?: string | null;
  tracing?: string;
};

export type AuthUser = {
  uid: number;
  username: string;
  email?: string;
  displayName?: string;
  avatar?: ApiAvatar | null;
  rank?: ApiRank | null;
  joined?: string;
};

export type UserListItem = {
  userID: number;
  username: string;
  displayName?: string;
  rank?: ApiRank | null;
  joined?: string;
};

export type BanInfo = {
  id?: string;
  reason?: string;
  at?: string;
  expires?: string | null;
};

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function isApiUserResponse(
  payload: ApiUser | ApiUserResponse,
): payload is ApiUserResponse {
  return typeof payload === "object" && payload !== null && "data" in payload;
}

function toAvatar(value: unknown): ApiAvatar | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const payload = value as {
    contentType?: unknown;
    content_type?: unknown;
    data?: unknown;
  };
  const contentType =
    (typeof payload.contentType === "string" && payload.contentType.trim()) ||
    (typeof payload.content_type === "string" && payload.content_type.trim());
  const data = typeof payload.data === "string" ? payload.data.trim() : "";
  if (!contentType || !data) {
    return undefined;
  }
  return { contentType, data };
}

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8080";
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL;

const BAN_STORAGE_KEY = "banInfo";
const BANNED_ERROR_MATCH = "user is banned";

function isBannedResponse(
  status: number,
  data: { error?: string; data?: unknown; message?: string } | null,
  message: string,
): boolean {
  if (status !== 401 && status !== 403) {
    return false;
  }
  const includesBan = (value: unknown) =>
    typeof value === "string" &&
    value.toLowerCase().includes(BANNED_ERROR_MATCH);
  return (
    includesBan(data?.error) ||
    includesBan(data?.data) ||
    includesBan(data?.message) ||
    includesBan(message)
  );
}

function toAuthUser(payload: ApiUser | ApiUserResponse): AuthUser {
  const user: ApiUser | null = isApiUserResponse(payload)
    ? (payload.data ?? null)
    : payload;

  if (!user) {
    throw new Error("Missing user payload.");
  }

  const publicUser = user.public ?? undefined;
  const uid = publicUser?.uid ?? publicUser?.userID ?? user.uid ?? user.userID;
  const username = publicUser?.username ?? user.username;

  if (uid == null || !username) {
    throw new Error("Missing user fields.");
  }

  const settings = publicUser?.settings ?? user.settings;
  const displayName =
    settings?.display_name ?? settings?.displayName ?? undefined;
  const avatar = toAvatar(settings?.avatar);
  const rank = publicUser?.rank ?? user.rank ?? undefined;
  const joined =
    publicUser?.joined ?? publicUser?.joinedAt ?? user.joined ?? user.joinedAt;

  return {
    uid,
    username,
    email: user.email?.address,
    displayName,
    avatar,
    rank,
    joined,
  };
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    let data: { error?: string; data?: unknown; message?: string } | null =
      null;
    try {
      data = (await response.json()) as {
        error?: string;
        data?: unknown;
        message?: string;
      };
    } catch {
      const text = await response.text();
      if (text) {
        message = text;
      } else if (response.statusText) {
        message = response.statusText;
      }
    }

    if (data?.error) {
      message = data.error;
    } else if (data?.message) {
      message = data.message;
    }
    // все потрать детка все потрать у меня есть деньги детка все потрать (трать)
    if (isBannedResponse(response.status, data, message)) {
      await handleBannedUser({ signal: init?.signal });
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function handleBannedUser(options?: {
  signal?: AbortSignal | null;
}) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const response = await fetch(`${API_BASE_URL}/api/user/ban/info`, {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
      signal: options?.signal,
    });
    if (response.ok) {
      const payload = (await response.json()) as ApiBanInfoResponse;
      const banInfo: BanInfo = {
        id: payload?.id,
        reason: payload?.reason,
        at: payload?.at,
        expires: payload?.expires ?? null,
      };
      window.sessionStorage.setItem(BAN_STORAGE_KEY, JSON.stringify(banInfo));
    } else {
      window.sessionStorage.removeItem(BAN_STORAGE_KEY);
    }
  } catch {
    window.sessionStorage.removeItem(BAN_STORAGE_KEY);
  }

  if (window.location.pathname !== "/banned") {
    window.location.assign("/banned");
  }
}

export async function registerUser(payload: RegisterPayload): Promise<void> {
  await apiRequest("/api/login/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function authorizeUser(
  payload: AuthorizationPayload,
): Promise<void> {
  await apiRequest("/api/login/authorization", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

function toUserListItem(payload: ApiUserPublic): UserListItem | null {
  const userID = payload.userID ?? payload.uid;
  const username = payload.username;
  if (userID == null || !username) {
    return null;
  }

  const settings = payload.settings ?? undefined;
  const displayName =
    settings?.display_name ?? settings?.displayName ?? undefined;
  const joined = payload.joined ?? payload.joinedAt;

  return {
    userID,
    username,
    displayName,
    rank: payload.rank ?? undefined,
    joined,
  };
}

export async function logoutUser(): Promise<void> {
  await apiRequest("/api/login/logout", {
    method: "POST",
  });
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const payload = await apiRequest<ApiUser | ApiUserResponse>("/api/user", {
    method: "GET",
  });
  return toAuthUser(payload);
}

export async function fetchUsers(options?: {
  signal?: AbortSignal;
}): Promise<UserListItem[]> {
  const payload = await apiRequest<ApiUsersResponse | ApiUserPublic[]>(
    "/api/user/list",
    {
      method: "GET",
      signal: options?.signal,
    },
  );
  const records = Array.isArray(payload) ? payload : (payload.data ?? []);
  return records
    .map(toUserListItem)
    .filter((item): item is UserListItem => Boolean(item));
}

export async function fetchUserBanInfo(
  userID: number,
  options?: { signal?: AbortSignal },
): Promise<BanInfo | null> {
  try {
    const payload = await apiRequest<ApiBanInfoResponse>(
      `/api/user/${userID}/ban/info`,
      {
        method: "GET",
        signal: options?.signal,
      },
    );
    if (!payload) {
      return null;
    }
    return {
      id: payload.id,
      reason: payload.reason,
      at: payload.at,
      expires: payload.expires ?? null,
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function banUser(
  userID: number,
  reason: string,
  durationSeconds = 0,
): Promise<void> {
  const trimmed = reason.trim();
  if (!trimmed) {
    throw new Error("Ban reason is required.");
  }
  const duration = `${Math.max(0, Math.floor(durationSeconds))}s`;
  await apiRequest(`/api/user/${userID}/ban`, {
    method: "POST",
    body: JSON.stringify({ reason: trimmed, duration }),
  });
}

export async function unbanUser(userID: number): Promise<void> {
  await apiRequest(`/api/user/${userID}/unban`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function updateDisplayName(name: string): Promise<AuthUser> {
  const encoded = encodeURIComponent(name);
  await apiRequest(`/api/user/change/name/${encoded}`, {
    method: "PATCH",
  });
  return fetchCurrentUser();
}

export async function updateAvatar(payload: ApiAvatar): Promise<AuthUser> {
  const contentType = payload?.contentType?.trim();
  const data = payload?.data?.trim();
  if (!contentType || !data) {
    throw new Error("Avatar payload is required.");
  }
  await apiRequest("/api/user/avatar", {
    method: "POST",
    body: JSON.stringify({ contentType, data }),
  });
  return fetchCurrentUser();
}
