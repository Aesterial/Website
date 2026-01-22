import { API_BASE_URL } from "@/lib/api-base";
import { StatusCodes } from "http-status-codes";

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
  contentType?: string;
  data?: string;
  url?: string;
  key?: string;
};

type PresignResponse = {
  presign?: string;
  tracing?: string;
};

export type AvatarUploadPayload = {
  userId: number;
  file: File;
  contentType?: string;
  key?: string;
};

type ApiUserSettings = {
  display_name?: string | null;
  displayName?: string | null;
  description?: string | null;
  description_text?: string | null;
  descriptionText?: string | null;
  session_live_time?: number | null;
  sessionLiveTime?: number | null;
  avatar?: ApiAvatar | null;
};

export type ApiUserPublic = {
  uid?: number;
  userID?: number;
  username?: string;
  settings?: ApiUserSettings | null;
  rank?: ApiRank | null;
  joined?: string;
  joinedAt?: string;
  banned?: boolean;
};

export type ApiPermissions = {
  all?: boolean;
  tickets?: {
    viewList?: { any?: boolean };
    view_list?: { any?: boolean };
    accept?: boolean;
  };
  submissions?: { view?: boolean; accept?: boolean; decline?: boolean };
  statistics?: { all?: boolean };
  users?: {
    moderation?: {
      all?: boolean;
      ban?: boolean;
      banForever?: boolean;
      ban_forever?: boolean;
      unban?: boolean;
    };
  };
  ranks?: {
    all?: boolean;
    permsChange?: boolean;
    permissionsChange?: boolean;
    permissions_change?: boolean;
  };
  [key: string]: unknown;
};

export type ApiProjectLocation = {
  city?: string;
  street?: string;
  house?: string;
};

export type ApiProjectInfo = {
  title?: string;
  description?: string;
  photos?: ApiAvatar[] | null;
  category?: string | number;
  location?: ApiProjectLocation | null;
};

export type ApiProject = {
  id?: string;
  author?: ApiUserPublic | null;
  info?: ApiProjectInfo | null;
  details?: ApiProjectInfo | null;
  likesCount?: number;
  likes_count?: number;
  liked?: ApiUserPublic[] | null;
  createdAt?: string | { seconds?: number | string; nanos?: number } | null;
  created_at?: string | { seconds?: number | string; nanos?: number } | null;
  status?: string | number;
};

export type ApiSubmissionTarget = {
  id?: number | string;
  info?: ApiProject | null;
  state?: string;
  reason?: string | null;
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

type ApiPermissionsResponse = {
  data?: ApiPermissions | null;
  tracing?: string;
};

type ApiUsersResponse = {
  data?: ApiUserPublic[] | null;
  tracing?: string;
};

type ApiProjectsResponse = {
  projects?: ApiProject[] | null;
  tracing?: string;
};

type ApiTopProjectsResponse = {
  projects?: ApiProject[] | null;
  data?: ApiProject[] | null;
  items?: ApiProject[] | null;
  tracing?: string;
};

type ApiProjectCategoriesResponse = {
  categories?: string[] | null;
  tracing?: string;
};
type ApiSubmissionsResponse = {
  data?: ApiSubmissionTarget[] | null;
  tracing?: string;
};

export type ApiTicket = Record<string, unknown>;
export type ApiTicketMessage = Record<string, unknown>;

export type CreateTicketPayload = {
  name?: string;
  email?: string;
  topic: string;
  brief: string;
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
  description?: string;
  avatar?: ApiAvatar | null;
  rank?: ApiRank | null;
  joined?: string;
};

export type UserListItem = {
  userID: number;
  username: string;
  displayName?: string;
  banned: boolean;
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

function isPermissionsResponse(
  payload: ApiPermissions | ApiPermissionsResponse,
): payload is ApiPermissionsResponse {
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
    url?: unknown;
    key?: unknown;
  };
  const contentType =
    (typeof payload.contentType === "string" && payload.contentType.trim()) ||
    (typeof payload.content_type === "string" && payload.content_type.trim()) ||
    undefined;
  const data =
    typeof payload.data === "string" ? payload.data.trim() : undefined;
  const url = typeof payload.url === "string" ? payload.url.trim() : undefined;
  const key = typeof payload.key === "string" ? payload.key.trim() : undefined;
  if (!contentType && !data && !url && !key) {
    return undefined;
  }
  return {
    ...(contentType ? { contentType } : {}),
    ...(data ? { data } : {}),
    ...(url ? { url } : {}),
    ...(key ? { key } : {}),
  };
}

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
  const description =
    settings?.description ??
    settings?.description_text ??
    settings?.descriptionText ??
    undefined;
  const avatar = toAvatar(settings?.avatar);
  const rank = publicUser?.rank ?? user.rank ?? undefined;
  const joined =
    publicUser?.joined ?? publicUser?.joinedAt ?? user.joined ?? user.joinedAt;

  return {
    uid,
    username,
    email: user.email?.address,
    displayName,
    description,
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
  const banned = payload.banned ?? false;

  return {
    userID,
    username,
    displayName,
    banned,
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

export async function fetchUserPermissions(
  userID: number,
  options?: { signal?: AbortSignal },
): Promise<ApiPermissions | null> {
  const payload = await apiRequest<ApiPermissions | ApiPermissionsResponse>(
    `/api/user/${userID}/permissions`,
    {
      method: "GET",
      signal: options?.signal,
    },
  );
  if (!payload) {
    return null;
  }
  return isPermissionsResponse(payload) ? (payload.data ?? null) : payload;
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
  banned?: boolean,
  options?: { signal?: AbortSignal },
): Promise<BanInfo | null> {
  if (banned === false) {
    return null;
  }
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
    if (
      error instanceof ApiError &&
      error.status === StatusCodes.SERVICE_UNAVAILABLE
    ) {
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

export async function updateProfileDescription(
  description: string,
): Promise<AuthUser> {
  const encoded = encodeURIComponent(description);
  await apiRequest(`/api/user/change/description/${encoded}`, {
    method: "PATCH",
  });
  return fetchCurrentUser();
}

export async function updateAvatar(
  payload: AvatarUploadPayload,
): Promise<AuthUser> {
  if (!payload?.file) {
    throw new Error("Avatar file is required.");
  }
  if (!Number.isFinite(payload.userId) || payload.userId <= 0) {
    throw new Error("User id is required.");
  }
  const contentType =
    payload.contentType?.trim() ||
    payload.file.type ||
    "application/octet-stream";
  const key = payload.key?.trim() || `avatars/${payload.userId}/current`;
  const presignResponse = await apiRequest<PresignResponse>(
    `/api/storage/presign/put?key=${encodeURIComponent(key)}&contentType=${encodeURIComponent(contentType)}`,
    {
      method: "GET",
    },
  );
  const presignUrl = presignResponse?.presign?.trim();
  if (!presignUrl) {
    throw new Error("Avatar upload URL is missing.");
  }
  const uploadResponse = await fetch(presignUrl, {
    method: "PUT",
    body: payload.file,
    credentials: "omit",
    headers: contentType ? { "Content-Type": contentType } : undefined,
  });
  if (!uploadResponse.ok) {
    throw new Error(`Avatar upload failed (${uploadResponse.status}).`);
  }
  await apiRequest("/api/user/avatar", {
    method: "POST",
    body: JSON.stringify({ key, contentType }),
  });
  return fetchCurrentUser();
}

export async function deleteAvatar(): Promise<AuthUser> {
  await apiRequest("/api/user/delete/avatar", {
    method: "DELETE",
  });
  return fetchCurrentUser();
}

export async function deleteUserAvatar(userID: number): Promise<void> {
  await apiRequest(`/api/user/${userID}/delete/avatar`, {
    method: "DELETE",
  });
}

export async function fetchProjects(options?: {
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}): Promise<ApiProject[]> {
  const params = new URLSearchParams();
  if (typeof options?.limit === "number") {
    params.set("limit", String(options.limit));
  }
  if (typeof options?.offset === "number") {
    params.set("offset", String(options.offset));
  }
  const query = params.toString() ? `?${params.toString()}` : "";
  const payload = await apiRequest<ApiProjectsResponse>(
    `/api/projects${query}`,
    {
      method: "GET",
      signal: options?.signal,
    },
  );
  const records = payload?.projects ?? [];
  return Array.isArray(records) ? records : [];
}

export async function fetchTopProjects(options?: {
  limit?: number;
  city?: string;
  signal?: AbortSignal;
}): Promise<ApiProject[]> {
  const params = new URLSearchParams();
  if (typeof options?.limit === "number") {
    params.set("limit", String(options.limit));
  }
  if (options?.city) {
    params.set("city", options.city);
  }
  const query = params.toString() ? `?${params.toString()}` : "";
  const payload = await apiRequest<ApiTopProjectsResponse | ApiProject[]>(
    `/api/projects/top${query}`,
    {
      method: "GET",
      signal: options?.signal,
    },
  );
  if (Array.isArray(payload)) {
    return payload;
  }
  const records = payload?.projects ?? payload?.data ?? payload?.items ?? [];
  return Array.isArray(records) ? records : [];
}

export async function fetchArchivedProjects(options?: {
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}): Promise<ApiProject[]> {
  const params = new URLSearchParams();
  if (typeof options?.limit === "number") {
    params.set("limit", String(options.limit));
  }
  if (typeof options?.offset === "number") {
    params.set("offset", String(options.offset));
  }
  const query = params.toString() ? `?${params.toString()}` : "";
  const payload = await apiRequest<ApiProjectsResponse>(
    `/api/projects/archived${query}`,
    {
      method: "GET",
      signal: options?.signal,
    },
  );
  const records = payload?.projects ?? [];
  return Array.isArray(records) ? records : [];
}

export type CreateProjectPayload = {
  title: string;
  description?: string;
  photos?: ApiAvatar[];
  category: string;
  location: ApiProjectLocation;
};

export async function createProject(
  payload: CreateProjectPayload,
): Promise<void> {
  await apiRequest("/api/projects/create", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function changeProjectTitle(
  projectID: string,
  title: string,
): Promise<void> {
  const encodedId = encodeURIComponent(projectID);
  const encodedTitle = encodeURIComponent(title);
  await apiRequest(`/api/projects/${encodedId}/name/${encodedTitle}`, {
    method: "PATCH",
  });
}

export async function changeProjectDescription(
  projectID: string,
  description: string,
): Promise<void> {
  const encodedId = encodeURIComponent(projectID);
  const encodedDescription = encodeURIComponent(description);
  await apiRequest(
    `/api/project/${encodedId}/description/${encodedDescription}`,
    {
      method: "PATCH",
    },
  );
}

export async function deleteProject(projectID: string): Promise<void> {
  const encodedId = encodeURIComponent(projectID);
  await apiRequest(`/api/projects/${encodedId}/delete`, {
    method: "DELETE",
  });
}

export async function fetchProjectCategories(options?: {
  signal?: AbortSignal;
}): Promise<string[]> {
  const payload = await apiRequest<ApiProjectCategoriesResponse>(
    "/api/projects/categories",
    {
      method: "GET",
      signal: options?.signal,
    },
  );
  const categories = payload?.categories ?? [];
  return Array.isArray(categories) ? categories : [];
}

export async function fetchSubmissions(options?: {
  signal?: AbortSignal;
}): Promise<ApiSubmissionTarget[]> {
  const payload = await apiRequest<ApiSubmissionsResponse>(
    "/api/submissions/list",
    {
      method: "GET",
      signal: options?.signal,
    },
  );
  const records = payload?.data ?? [];
  return Array.isArray(records) ? records : [];
}

export async function approveSubmission(id: number): Promise<void> {
  await apiRequest(`/api/submissions/${id}/approve`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function declineSubmission(
  id: number,
  reason: string,
): Promise<void> {
  const trimmed = reason.trim();
  if (!trimmed) {
    throw new Error("Decline reason is required.");
  }
  await apiRequest(`/api/submissions/${id}/decline`, {
    method: "POST",
    body: JSON.stringify({ reason: trimmed }),
  });
}

export async function toggleProjectLike(projectID: string): Promise<void> {
  const encoded = encodeURIComponent(projectID);
  await apiRequest(`/api/projects/like/${encoded}`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function voteForProject(projectID: string): Promise<void> {
  const encoded = encodeURIComponent(projectID);
  await apiRequest(`/api/projects/${encoded}/vote`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

const toTicketRecord = (payload: unknown): Record<string, unknown> | null => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  return payload as Record<string, unknown>;
};

const pickTicketId = (payload: unknown): string | null => {
  if (typeof payload === "string" && payload.trim()) {
    return payload.trim();
  }
  if (typeof payload === "number" && Number.isFinite(payload)) {
    return String(payload);
  }
  const record = toTicketRecord(payload);
  if (!record) {
    return null;
  }
  const candidates = ["id", "ticketId", "ticket_id", "ticketID"];
  for (const key of candidates) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  const nested = toTicketRecord(record.data ?? record.ticket ?? record.info);
  if (!nested) {
    return null;
  }
  for (const key of candidates) {
    const value = nested[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return null;
};

export async function createTicket(
  payload: CreateTicketPayload,
): Promise<string> {
  const topic = payload.topic.trim();
  const brief = payload.brief.trim();
  if (!topic) {
    throw new Error("Ticket topic is required.");
  }
  if (!brief) {
    throw new Error("Ticket brief is required.");
  }
  const body: Record<string, unknown> = { topic, brief };
  const name = payload.name?.trim();
  const email = payload.email?.trim();
  if (name) {
    body.name = name;
  }
  if (email) {
    body.email = email;
  }

  const response = await apiRequest<unknown>("/api/tickets/create", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const id = pickTicketId(response);
  if (!id) {
    throw new Error("Ticket id is missing.");
  }
  return id;
}

export async function fetchTicketInfo(
  id: string,
  options?: { signal?: AbortSignal },
): Promise<ApiTicket | null> {
  const encoded = encodeURIComponent(id);
  const payload = await apiRequest<unknown>(`/api/tickets/${encoded}/info`, {
    method: "GET",
    signal: options?.signal,
  });
  const record = toTicketRecord(payload);
  if (!record) {
    return null;
  }
  const ticket =
    toTicketRecord(record.data ?? record.ticket ?? record.info) ?? record;
  return ticket as ApiTicket;
}

export async function fetchTicketMessages(
  id: string,
  options?: { signal?: AbortSignal },
): Promise<ApiTicketMessage[]> {
  const encoded = encodeURIComponent(id);
  const payload = await apiRequest<unknown>(
    `/api/tickets/${encoded}/messages/list`,
    {
      method: "GET",
      signal: options?.signal,
    },
  );
  const record = toTicketRecord(payload);
  const messages = Array.isArray(payload)
    ? payload
    : (record?.data ??
      record?.messages ??
      record?.list ??
      record?.items ??
      record?.message_list ??
      []);
  return Array.isArray(messages) ? (messages as ApiTicketMessage[]) : [];
}

export async function createTicketMessage(
  id: string,
  message: string,
): Promise<void> {
  const trimmed = message.trim();
  if (!trimmed) {
    throw new Error("Ticket message is required.");
  }
  const encoded = encodeURIComponent(id);
  await apiRequest(`/api/tickets/${encoded}/messages/create`, {
    method: "POST",
    body: JSON.stringify({ message: trimmed }),
  });
}

export async function closeTicket(id: string): Promise<void> {
  const encoded = encodeURIComponent(id);
  await apiRequest(`/api/tickets/${encoded}/close`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function acceptTicket(id: string): Promise<void> {
  const encoded = encodeURIComponent(id);
  await apiRequest(`/api/tickets/${encoded}/accept`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function fetchTickets(options?: {
  signal?: AbortSignal;
}): Promise<ApiTicket[]> {
  const payload = await apiRequest<unknown>("/api/tickets/list", {
    method: "GET",
    signal: options?.signal,
  });
  const record = toTicketRecord(payload);
  const tickets = Array.isArray(payload)
    ? payload
    : (record?.data ??
      record?.tickets ??
      record?.list ??
      record?.items ??
      record?.ticket_list ??
      []);
  return Array.isArray(tickets) ? (tickets as ApiTicket[]) : [];
}
