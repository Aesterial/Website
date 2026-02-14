import { API_BASE_URL } from "@/lib/api-base";
import { emitMfaRequired, isMfaRequiredMessage } from "@/lib/mfa-required";
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

export type PasswordResetRequest = {
  email: string;
};

export type PasswordResetPayload = {
  email: string;
  password: string;
  token: string;
};

type ApiEmail = {
  address: string;
  verified: boolean;
};

export type ApiRank = {
  name: string;
  expires?: string | null;
};

export type ApiRankListItem = {
  name: string;
  description?: string;
  color?: number;
  added?: string;
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
  totp_enabled?: boolean | null;
  totpEnabled?: boolean | null;
  mfa_enabled?: boolean | null;
  mfaEnabled?: boolean | null;
  two_factor_enabled?: boolean | null;
  twoFactorEnabled?: boolean | null;
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
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
  coordinates?: [number, number] | [string, string];
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

type ApiUserPublicResponse = {
  data?: ApiUserPublic | null;
  tracing?: string;
};

type ApiPermissionsResponse = {
  data?: ApiPermissions | null;
  tracing?: string;
};

type ApiRankListEntry = {
  name?: string;
  description?: string;
  color?: number;
  added?: string | { seconds?: number | string; nanos?: number } | null;
};

type ApiRankListResponse = {
  ranks?: ApiRankListEntry[] | null;
  data?: ApiRankListEntry[] | null;
  items?: ApiRankListEntry[] | null;
  tracing?: string;
};

type ApiUsersResponse = {
  data?: ApiUserPublic[] | null;
  tracing?: string;
};

type ApiRankUsersResponse = {
  len?: number;
  users?: ApiUserPublic[] | null;
  tracing?: string;
};

type ApiProjectsResponse = {
  projects?: ApiProject[] | null;
  tracing?: string;
};

type ApiProjectResponse = {
  data?: ApiProject | null;
  project?: ApiProject | null;
  info?: ApiProject | null;
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

type ApiSubmissionResponse = {
  data?: ApiSubmissionTarget | null;
  tracing?: string;
};

export type ApiTicket = Record<string, unknown>;
export type ApiTicketMessage = Record<string, unknown>;

export type CreateTicketPayload = {
  name?: string;
  email?: string;
  topic: string;
  brief: string;
  content: string;
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
  emailVerified?: boolean;
  displayName?: string;
  description?: string;
  avatar?: ApiAvatar | null;
  rank?: ApiRank | null;
  totpEnabled?: boolean;
  joined?: string;
};

export type AuthChallengeType = "totp" | "email" | "unknown";

export type AuthChallenge = {
  type: AuthChallengeType;
  token?: string;
  verifyUrl?: string;
  resendUrl?: string;
  destination?: string;
  expiresAt?: string;
  length?: number;
  redirectUrl?: string;
  loginMethod?: "password" | "vk";
};

export type AuthResult = {
  status: "ok" | "challenge";
  challenge?: AuthChallenge;
  redirectUrl?: string;
};

export type TotpEnrollment = {
  secret?: string;
  otpauthUrl?: string;
  qrBase64?: string;
  manualUrl?: string;
  token?: string;
  digits?: number;
  period?: number;
};

export type TotpConfirmResult = {
  recoveryCodes: string[];
};

export type UserListItem = {
  userID: number;
  username: string;
  displayName?: string;
  avatar?: ApiAvatar | null;
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

export class MfaRequiredError extends ApiError {
  constructor(message: string) {
    super(StatusCodes.FORBIDDEN, message);
  }
}

function isApiUserResponse(
  payload: ApiUser | ApiUserResponse,
): payload is ApiUserResponse {
  return typeof payload === "object" && payload !== null && "data" in payload;
}

function isApiUserPublicResponse(
  payload: ApiUserPublic | ApiUserPublicResponse,
): payload is ApiUserPublicResponse {
  return typeof payload === "object" && payload !== null && "data" in payload;
}

function isPermissionsResponse(
  payload: ApiPermissions | ApiPermissionsResponse,
): payload is ApiPermissionsResponse {
  return typeof payload === "object" && payload !== null && "data" in payload;
}

const toRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as Record<string, unknown>;
};

const pickString = (
  record: Record<string, unknown> | null | undefined,
  keys: string[],
): string | undefined => {
  if (!record) {
    return undefined;
  }
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
};

const pickBoolean = (
  record: Record<string, unknown> | null | undefined,
  keys: string[],
): boolean | undefined => {
  if (!record) {
    return undefined;
  }
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") {
      return value;
    }
  }
  return undefined;
};

const pickNumber = (
  record: Record<string, unknown> | null | undefined,
  keys: string[],
): number | undefined => {
  if (!record) {
    return undefined;
  }
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
};

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

const toRankAdded = (value: ApiRankListEntry["added"]): string | undefined => {
  if (!value) {
    return undefined;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  if (typeof value !== "object") {
    return undefined;
  }
  const secondsRaw = value.seconds;
  const seconds =
    typeof secondsRaw === "number"
      ? secondsRaw
      : typeof secondsRaw === "string"
        ? Number(secondsRaw)
        : NaN;
  if (!Number.isFinite(seconds)) {
    return undefined;
  }
  return new Date(seconds * 1000).toISOString();
};

const toRankListItem = (value: ApiRankListEntry): ApiRankListItem | null => {
  const name = typeof value.name === "string" ? value.name.trim() : "";
  if (!name) {
    return null;
  }
  const description =
    typeof value.description === "string"
      ? value.description.trim() || undefined
      : undefined;
  const color = typeof value.color === "number" ? value.color : undefined;
  return {
    name,
    description,
    color,
    added: toRankAdded(value.added),
  };
};

const BAN_STORAGE_KEY = "banInfo";
const BANNED_ERROR_MATCH = "user is banned";

const includesAny = (value: string, patterns: string[]) =>
  patterns.some((pattern) => value.includes(pattern));

const sanitizeErrorByStatus = (status: number): string => {
  if (
    status === StatusCodes.BAD_REQUEST ||
    status === StatusCodes.UNPROCESSABLE_ENTITY
  ) {
    return "Invalid request data. Please check your input and try again.";
  }
  if (status === StatusCodes.UNAUTHORIZED) {
    return "Authentication required. Please sign in and try again.";
  }
  if (status === StatusCodes.FORBIDDEN) {
    return "Access denied. You do not have permission for this action.";
  }
  if (status === StatusCodes.NOT_FOUND) {
    return "Requested data was not found.";
  }
  if (status === StatusCodes.CONFLICT) {
    return "Data conflict. Please refresh and try again.";
  }
  if (status === StatusCodes.TOO_MANY_REQUESTS) {
    return "Too many requests. Please try again later.";
  }
  if (
    status === StatusCodes.BAD_GATEWAY ||
    status === StatusCodes.SERVICE_UNAVAILABLE ||
    status === StatusCodes.GATEWAY_TIMEOUT
  ) {
    return "Service is temporarily unavailable. Please try again later.";
  }
  if (status >= 500) {
    return "Server error. Please try again later.";
  }
  return "Request failed. Please try again.";
};

export const getPublicApiErrorMessage = (
  status: number,
  rawMessage?: string,
): string => {
  const normalized = rawMessage?.trim().toLowerCase() ?? "";

  if (normalized) {
    if (normalized.includes("mfa required")) {
      return "Additional verification is required.";
    }
    if (normalized.includes(BANNED_ERROR_MATCH)) {
      return "Access to this account is restricted.";
    }
    if (includesAny(normalized, ["record not found", "not found"])) {
      return "Requested data was not found.";
    }
    if (
      includesAny(normalized, [
        "invalid arguments",
        "required data missing",
        "passed data expired",
        "invalid argument",
      ])
    ) {
      return "Invalid request data. Please check your input and try again.";
    }
    if (
      includesAny(normalized, [
        "already exists",
        "already used",
        "conflict error",
        "data collides with exists one",
      ])
    ) {
      return "Data conflict. Please refresh and try again.";
    }
    if (
      includesAny(normalized, [
        "permissions denied",
        "failed to authorize",
        "unauthenticated",
      ])
    ) {
      return status === StatusCodes.UNAUTHORIZED
        ? "Authentication required. Please sign in and try again."
        : "Access denied. You do not have permission for this action.";
    }
    if (includesAny(normalized, ["service unavailable", "unavailable"])) {
      return "Service is temporarily unavailable. Please try again later.";
    }
    if (
      includesAny(normalized, [
        "server error while progress",
        "service not configured",
      ])
    ) {
      return "Server error. Please try again later.";
    }
    if (normalized.includes("not implemented")) {
      return "This action is not available right now.";
    }
  }

  return sanitizeErrorByStatus(status);
};

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

const includesMfaRequired = (value: unknown) => isMfaRequiredMessage(value);

const isMfaRequiredPayload = (payload: unknown): boolean => {
  if (includesMfaRequired(payload)) {
    return true;
  }
  const record = toRecord(payload);
  if (!record) {
    return false;
  }
  const required = pickBoolean(record, [
    "mfaRequired",
    "mfa_required",
    "twoFactorRequired",
    "two_factor_required",
    "totpRequired",
    "totp_required",
  ]);
  if (required) {
    return true;
  }
  const text = pickString(record, ["error", "message", "status", "result"]);
  return includesMfaRequired(text);
};

function isMfaRequiredResponse(
  status: number,
  data: { error?: string; data?: unknown; message?: string } | null,
  message: string,
): boolean {
  if (status !== StatusCodes.FORBIDDEN && status !== StatusCodes.UNAUTHORIZED) {
    return false;
  }
  if (includesMfaRequired(message)) {
    return true;
  }
  return (
    isMfaRequiredPayload(data) ||
    isMfaRequiredPayload(data?.data) ||
    includesMfaRequired(data?.error) ||
    includesMfaRequired(data?.message)
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
  const emailVerified = user.email?.verified ?? false;
  const settingsRecord = toRecord(settings);
  const userRecord = toRecord(user);
  const publicRecord = toRecord(publicUser);
  const securitySettings = user.settings ?? null;
  const totpEnabled = securitySettings?.totpEnabled ?? false;

  return {
    uid,
    username,
    email: user.email?.address,
    emailVerified,
    displayName,
    description,
    avatar,
    rank,
    totpEnabled,
    joined,
  };
}

const normalizeAuthChallengeType = (
  value?: string,
  destination?: string,
): AuthChallengeType => {
  const normalized = value?.trim().toLowerCase();
  if (normalized) {
    if (
      normalized.includes("totp") ||
      normalized.includes("auth") ||
      normalized.includes("app")
    ) {
      return "totp";
    }
    if (normalized.includes("mail") || normalized.includes("email")) {
      return "email";
    }
  }
  if (destination && destination.includes("@")) {
    return "email";
  }
  return "unknown";
};

const parseAuthChallenge = (
  record: Record<string, unknown> | null,
): AuthChallenge | null => {
  if (!record) {
    return null;
  }

  const required =
    pickBoolean(record, [
      "required",
      "require",
      "codeRequired",
      "code_required",
      "otpRequired",
      "otp_required",
      "twoFactorRequired",
      "two_factor_required",
      "mfaRequired",
      "mfa_required",
    ]) ?? false;
  const typeValue = pickString(record, [
    "type",
    "method",
    "channel",
    "delivery",
    "codeType",
    "code_type",
    "otpType",
    "otp_type",
    "mfaType",
    "mfa_type",
  ]);
  const token = pickString(record, [
    "token",
    "challenge",
    "challengeId",
    "challenge_id",
    "session",
    "sessionId",
    "session_id",
  ]);
  const verifyUrl = pickString(record, [
    "verifyUrl",
    "verify_url",
    "verificationUrl",
    "verification_url",
    "confirmUrl",
    "confirm_url",
    "checkUrl",
    "check_url",
  ]);
  const resendUrl = pickString(record, ["resendUrl", "resend_url", "resend"]);
  const destination = pickString(record, [
    "destination",
    "email",
    "maskedEmail",
    "masked_email",
    "address",
    "mail",
  ]);
  const expiresAt = pickString(record, [
    "expiresAt",
    "expires_at",
    "expires",
    "validUntil",
    "valid_until",
  ]);
  const length = pickNumber(record, [
    "length",
    "codeLength",
    "code_length",
    "digits",
  ]);

  if (!required && !typeValue && !token && !verifyUrl && !resendUrl) {
    return null;
  }

  return {
    type: normalizeAuthChallengeType(typeValue, destination),
    token,
    verifyUrl,
    resendUrl,
    destination,
    expiresAt,
    length,
  };
};

const extractAuthChallenge = (payload: unknown): AuthChallenge | null => {
  const root = toRecord(payload);
  if (!root) {
    return null;
  }
  const data = toRecord(root.data);
  const candidates = [
    toRecord(root.challenge),
    toRecord(root.twoFactor),
    toRecord(root.two_factor),
    toRecord(data?.challenge),
    toRecord(data?.twoFactor),
    toRecord(data?.two_factor),
    data,
    root,
  ];
  for (const candidate of candidates) {
    const parsed = parseAuthChallenge(candidate);
    if (parsed) {
      return parsed;
    }
  }

  const dataString =
    pickString(root, ["data", "status", "result"]) ??
    pickString(data, ["data", "status", "result"]);
  if (dataString) {
    const normalized = dataString.toLowerCase();
    if (normalized.includes("otp") || normalized.includes("code")) {
      return { type: normalizeAuthChallengeType(normalized, undefined) };
    }
  }
  return null;
};

const normalizeAuthResult = (payload: unknown): AuthResult => {
  const root = toRecord(payload);
  const data = root ? toRecord(root.data) : null;
  const redirectUrl =
    pickString(root, [
      "redirectUrl",
      "redirect_url",
      "returnUrl",
      "return_url",
      "nextUrl",
      "next_url",
      "next",
    ]) ??
    pickString(data, [
      "redirectUrl",
      "redirect_url",
      "returnUrl",
      "return_url",
      "nextUrl",
      "next_url",
      "next",
    ]);
  const challenge = extractAuthChallenge(payload);
  if (challenge) {
    return {
      status: "challenge",
      challenge: {
        ...challenge,
        redirectUrl: challenge.redirectUrl ?? redirectUrl,
      },
      redirectUrl,
    };
  }
  return { status: "ok", redirectUrl };
};

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
    let rawMessage = `Request failed (${response.status})`;
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
        rawMessage = text;
      } else if (response.statusText) {
        rawMessage = response.statusText;
      }
    }

    if (data?.error) {
      rawMessage = data.error;
    } else if (data?.message) {
      rawMessage = data.message;
    }

    if (isBannedResponse(response.status, data, rawMessage)) {
      await handleBannedUser({ signal: init?.signal });
    }

    const publicMessage = getPublicApiErrorMessage(response.status, rawMessage);
    if (isMfaRequiredResponse(response.status, data, rawMessage)) {
      emitMfaRequired({ reason: publicMessage });
      throw new MfaRequiredError(publicMessage);
    }
    throw new ApiError(response.status, publicMessage);
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
): Promise<AuthResult> {
  const response = await apiRequest<unknown>("/api/login/authorization", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return normalizeAuthResult(response);
}

export async function requestPasswordReset(
  payload: PasswordResetRequest,
): Promise<void> {
  const email = payload.email.trim();
  if (!email) {
    throw new Error("Email is required.");
  }
  await apiRequest("/api/login/reset-password/start", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(
  payload: PasswordResetPayload,
): Promise<void> {
  const email = payload.email.trim();
  const password = payload.password.trim();
  const token = payload.token.trim();
  if (!email || !password || !token) {
    throw new Error("Email, password, and token are required.");
  }
  await apiRequest("/api/login/reset-password", {
    method: "POST",
    body: JSON.stringify({ email, password, token }),
  });
}

export async function requestEmailVerification(payload: {
  email: string;
}): Promise<void> {
  const email = payload.email.trim();
  if (!email) {
    throw new Error("Email is required.");
  }
  await apiRequest("/api/login/verify-email/start", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function verifyEmail(payload: { token: string }): Promise<void> {
  const token = payload.token.trim();
  if (!token) {
    throw new Error("Token is required.");
  }
  await apiRequest("/api/login/verify-email", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export async function verifyAuthCode(payload: {
  code: string;
  challenge?: AuthChallenge | null;
}): Promise<AuthResult> {
  const code = payload.code.trim();
  if (!code) {
    throw new Error("Code is required.");
  }
  const endpoint =
    payload.challenge?.verifyUrl?.trim() || "/api/login/authorization/verify";
  const body: Record<string, unknown> = { code };
  if (payload.challenge?.token) {
    body.token = payload.challenge.token;
  }
  if (payload.challenge?.type && payload.challenge.type !== "unknown") {
    body.type = payload.challenge.type;
  }
  if (
    payload.challenge?.destination &&
    !payload.challenge.destination.includes("*")
  ) {
    body.destination = payload.challenge.destination;
  }
  if (payload.challenge?.loginMethod) {
    body.method = payload.challenge.loginMethod;
  }
  const response = await apiRequest<unknown>(endpoint, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return normalizeAuthResult(response);
}

export async function resendAuthCode(challenge: AuthChallenge): Promise<void> {
  const endpoint =
    challenge.resendUrl?.trim() || "/api/login/authorization/resend";
  const body: Record<string, unknown> = {};
  if (challenge.token) {
    body.token = challenge.token;
  }
  if (challenge.type && challenge.type !== "unknown") {
    body.type = challenge.type;
  }
  if (challenge.destination && !challenge.destination.includes("*")) {
    body.destination = challenge.destination;
  }
  await apiRequest(endpoint, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function checkMfaCode(payload: { code: string }): Promise<void> {
  const code = payload.code.trim();
  if (!code) {
    throw new Error("Code is required.");
  }
  await apiRequest("/api/login/2fa/check", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export async function startTotpEnrollment(): Promise<TotpEnrollment> {
  const payload = await apiRequest<Record<string, unknown>>(
    "/api/login/2fa/setup",
    {
      method: "POST",
    },
  );
  const record = toRecord(payload) ?? {};
  const data = toRecord(record.data) ?? record;
  return {
    secret:
      pickString(data, ["secret", "key"]) ??
      pickString(record, ["secret", "key"]),
    otpauthUrl:
      pickString(data, ["otpauthUrl", "otpauth_url", "uri", "otpauth"]) ??
      pickString(record, ["otpauthUrl", "otpauth_url", "uri", "otpauth"]),
    qrBase64:
      pickString(data, [
        "qrBase64",
        "qr_base64",
        "qr",
        "qrCode",
        "qr_code",
        "image",
        "imageBase64",
        "image_base64",
      ]) ??
      pickString(record, [
        "qrBase64",
        "qr_base64",
        "qr",
        "qrCode",
        "qr_code",
        "image",
        "imageBase64",
        "image_base64",
      ]),
    manualUrl:
      pickString(data, ["manualUrl", "manual_url", "url", "setupUrl"]) ??
      pickString(record, ["manualUrl", "manual_url", "url", "setupUrl"]),
    token:
      pickString(data, ["token", "challenge", "challengeId", "challenge_id"]) ??
      pickString(record, ["token", "challenge", "challengeId", "challenge_id"]),
    digits:
      pickNumber(data, ["digits", "length", "codeLength", "code_length"]) ??
      pickNumber(record, ["digits", "length", "codeLength", "code_length"]),
    period:
      pickNumber(data, ["period", "interval"]) ??
      pickNumber(record, ["period", "interval"]),
  };
}

const parseRecoveryCodes = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[\n,;]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

export async function confirmTotpEnrollment(payload: {
  code: string;
  token?: string;
}): Promise<TotpConfirmResult> {
  const code = payload.code.trim();
  if (!code) {
    throw new Error("Code is required.");
  }
  const body: Record<string, unknown> = { code };
  if (payload.token) {
    body.token = payload.token;
  }
  const response = await apiRequest<Record<string, unknown>>(
    "/api/login/2fa/confirm",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
  const record = toRecord(response) ?? {};
  const data = toRecord(record.data) ?? record;
  const codesFromData = parseRecoveryCodes(
    data.recoveryCodes ?? data.recovery_codes ?? data.codes ?? data.recovery,
  );
  const codes =
    codesFromData.length > 0
      ? codesFromData
      : parseRecoveryCodes(
          record.recoveryCodes ??
            record.recovery_codes ??
            record.codes ??
            record.recovery,
        );
  return { recoveryCodes: codes };
}

export async function disableTotp(payload?: { code?: string }): Promise<void> {
  const body: Record<string, unknown> = {};
  if (payload?.code) {
    body.code = payload.code.trim();
  }
  await apiRequest("/api/login/2fa/reset/recovery", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

type VkStartResponse = {
  authUrl?: string;
  auth_url?: string;
  state?: string;
};

type VkCallbackResponse = {
  redirectUrl?: string;
  redirect_url?: string;
  tracing?: string;
};

export async function startVkAuth(): Promise<{
  authUrl: string;
  state?: string;
}> {
  const payload = await apiRequest<VkStartResponse>("/api/login/vk/start", {
    method: "POST",
  });
  const authUrl = payload.authUrl ?? payload.auth_url ?? "";
  if (!authUrl) {
    throw new Error("VK auth URL is missing.");
  }
  return { authUrl, state: payload.state };
}

export async function completeVkAuth(
  code: string,
  state: string,
  device_id: string,
): Promise<AuthResult> {
  const payload = await apiRequest<VkCallbackResponse>(
    `/api/login/vk/callback`,
    {
      method: "POST",
      body: JSON.stringify({
        code,
        state,
        device_id,
      }),
    },
  );
  const result = normalizeAuthResult(payload);
  return {
    ...result,
    redirectUrl:
      result.redirectUrl ??
      payload.redirectUrl ??
      payload.redirect_url ??
      undefined,
  };
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
  const avatar = toAvatar(settings?.avatar) ?? null;
  const joined = payload.joined ?? payload.joinedAt;
  const banned = payload.banned ?? false;

  return {
    userID,
    username,
    displayName,
    avatar,
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

export async function fetchUserPublic(
  userID: number,
  options?: { signal?: AbortSignal },
): Promise<ApiUserPublic> {
  if (!Number.isFinite(userID) || userID <= 0) {
    throw new Error("User id is required.");
  }
  const payload = await apiRequest<ApiUserPublic | ApiUserPublicResponse>(
    `/api/user/${userID}`,
    {
      method: "GET",
      signal: options?.signal,
    },
  );
  const data = isApiUserPublicResponse(payload) ? payload.data : payload;
  if (!data) {
    throw new Error("Missing user payload.");
  }
  return data;
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

export async function updateUserPermission(
  userID: number,
  permission: string,
  state: boolean,
): Promise<void> {
  const trimmed = permission.trim();
  if (!Number.isFinite(userID) || userID <= 0) {
    throw new Error("User id is required.");
  }
  if (!trimmed) {
    throw new Error("Permission is required.");
  }
  await apiRequest(
    `/api/user/${userID}/permissions/patch/${encodeURIComponent(trimmed)}`,
    {
      method: "POST",
      body: JSON.stringify({ state }),
    },
  );
}

export async function setUserRank(
  userID: number,
  rank: string,
  expiresAt?: Date | string | null,
): Promise<void> {
  if (!Number.isFinite(userID) || userID <= 0) {
    throw new Error("User id is required.");
  }
  const trimmedRank = rank.trim();
  if (!trimmedRank) {
    throw new Error("Rank is required.");
  }
  const body: Record<string, unknown> = {
    userID,
    rank: trimmedRank,
  };
  if (expiresAt) {
    const dateValue =
      typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
    if (Number.isNaN(dateValue.getTime())) {
      throw new Error("Invalid expiration date.");
    }
    body.expires = dateValue.toISOString();
  }
  await apiRequest(`/api/user/${userID}/rank/set`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchRanksList(options?: {
  signal?: AbortSignal;
}): Promise<ApiRankListItem[]> {
  const payload = await apiRequest<ApiRankListResponse | ApiRankListEntry[]>(
    "/api/ranks/list",
    {
      method: "GET",
      signal: options?.signal,
    },
  );
  const records = Array.isArray(payload)
    ? payload
    : (payload?.ranks ?? payload?.data ?? payload?.items ?? []);
  return records
    .map(toRankListItem)
    .filter((item): item is ApiRankListItem => Boolean(item));
}

type RankCreatePayload = {
  name: string;
  description: string;
  color: number;
  permissions?: ApiPermissions;
};

export async function createRank(payload: RankCreatePayload): Promise<void> {
  const name = payload.name.trim();
  const description = payload.description.trim();
  if (!name) {
    throw new Error("Rank name is required.");
  }
  if (!description) {
    throw new Error("Rank description is required.");
  }
  if (!Number.isFinite(payload.color) || payload.color <= 0) {
    throw new Error("Rank color is required.");
  }
  await apiRequest("/api/ranks/create", {
    method: "POST",
    body: JSON.stringify({
      name,
      description,
      color: Math.floor(payload.color),
      permissions: payload.permissions,
    }),
  });
}

export async function updateRank(
  name: string,
  target: "name" | "description" | "color",
  value: string | number,
): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Rank name is required.");
  }
  const encodedName = encodeURIComponent(trimmed);
  const encodedTarget = encodeURIComponent(target);
  await apiRequest(`/api/ranks/${encodedName}/patch/${encodedTarget}`, {
    method: "PATCH",
    body: JSON.stringify({ name: trimmed, target, value }),
  });
}

export async function deleteRank(name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Rank name is required.");
  }
  const encoded = encodeURIComponent(trimmed);
  await apiRequest(`/api/ranks/${encoded}/delete`, {
    method: "DELETE",
  });
}

export async function fetchRankPermissions(
  name: string,
  options?: { signal?: AbortSignal },
): Promise<ApiPermissions | null> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Rank name is required.");
  }
  const encoded = encodeURIComponent(trimmed);
  const payload = await apiRequest<ApiPermissions | ApiPermissionsResponse>(
    `/api/ranks/${encoded}/perms`,
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

export async function updateRankPermission(
  name: string,
  permission: string,
  state: boolean,
): Promise<void> {
  const trimmedName = name.trim();
  const trimmedPerm = permission.trim();
  if (!trimmedName) {
    throw new Error("Rank name is required.");
  }
  if (!trimmedPerm) {
    throw new Error("Permission is required.");
  }
  const encodedName = encodeURIComponent(trimmedName);
  const encodedPerm = encodeURIComponent(trimmedPerm);
  await apiRequest(`/api/ranks/${encodedName}/perms/${encodedPerm}`, {
    method: "PATCH",
    body: JSON.stringify({
      name: trimmedName,
      perm: trimmedPerm,
      state,
    }),
  });
}

export async function fetchRankUsers(
  name: string,
  options?: { signal?: AbortSignal },
): Promise<UserListItem[]> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Rank name is required.");
  }

  const encoded = encodeURIComponent(trimmed);

  const payload = await apiRequest<ApiRankUsersResponse | ApiUserPublic[]>(
    `/api/ranks/${encoded}/users`,
    { method: "GET", signal: options?.signal },
  );

  const records: ApiUserPublic[] = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.users)
      ? payload.users
      : [];

  return records
    .map((u): UserListItem | null => toUserListItem(u))
    .filter((u): u is UserListItem => u !== null);
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

export async function deleteProfile(): Promise<void> {
  await apiRequest("/api/user/delete/profile", {
    method: "POST",
  });
}

export async function deleteUserDescription(userID: number): Promise<void> {
  await apiRequest(`/api/user/${userID}/delete/description`, {
    method: "POST",
  });
}

export async function deleteUserProfile(userID: number): Promise<void> {
  await apiRequest(`/api/user/${userID}/delete/profile`, {
    method: "POST",
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

export async function fetchProjectById(
  projectID: string,
  options?: { signal?: AbortSignal },
): Promise<ApiProject | null> {
  const encodedId = encodeURIComponent(projectID.trim());
  if (!encodedId) {
    throw new Error("Project id is required.");
  }
  const payload = await apiRequest<ApiProjectResponse | ApiProject>(
    `/api/projects/${encodedId}`,
    {
      method: "GET",
      signal: options?.signal,
    },
  );

  if (!payload || typeof payload !== "object") {
    return null;
  }

  if ("id" in payload || "info" in payload || "details" in payload) {
    return payload as ApiProject;
  }

  const wrapped = payload as ApiProjectResponse;
  return wrapped.data ?? wrapped.project ?? wrapped.info ?? null;
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
): Promise<{ id?: string; tracing?: string }> {
  const response = await apiRequest<unknown>("/api/projects/create", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const id = pickProjectId(response);
  const record = toTicketRecord(response);
  const tracing =
    typeof record?.tracing === "string" ? record.tracing.trim() : undefined;
  return { id: id ?? undefined, tracing };
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

export async function fetchSubmissionById(
  id: number,
  options?: { signal?: AbortSignal },
): Promise<ApiSubmissionTarget | null> {
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("Submission id is required.");
  }
  const payload = await apiRequest<ApiSubmissionResponse | ApiSubmissionTarget>(
    `/api/submissions/info/${id}`,
    {
      method: "GET",
      signal: options?.signal,
    },
  );
  if (
    payload &&
    typeof payload === "object" &&
    "data" in (payload as Record<string, unknown>)
  ) {
    return (payload as ApiSubmissionResponse).data ?? null;
  }
  return payload as ApiSubmissionTarget;
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

type TicketCreateResult = {
  id: string;
  token?: string;
};

const pickTicketToken = (payload: unknown): string | null => {
  const record = toTicketRecord(payload);
  if (!record) {
    return null;
  }
  const candidates = ["token", "requestorToken", "requestor_token"];
  for (const key of candidates) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
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
  }
  return null;
};

export async function createTicket(
  payload: CreateTicketPayload,
): Promise<TicketCreateResult> {
  const topic = payload.topic.trim();
  const brief = payload.brief.trim();
  const content = payload.brief.trim();
  if (!topic) {
    throw new Error("Ticket topic is required.");
  }
  if (!brief) {
    throw new Error("Ticket brief is required.");
  }
  if (!content) {
    throw new Error("Ticket content is required");
  }
  const body: Record<string, unknown> = { topic, brief, content };
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
  const token = pickTicketToken(response) ?? undefined;
  return { id, token };
}

const pickProjectId = (payload: unknown): string | null => {
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
  const candidates = ["id", "projectId", "project_id", "projectID"];
  for (const key of candidates) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  const nested = toTicketRecord(record.data ?? record.project ?? record.info);
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

const buildProjectPhotoKey = (projectId: string, photoId: string) =>
  `photos/${projectId}/${photoId}`;

const createPhotoId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export async function uploadProjectPhotos(
  projectId: string,
  files: File[],
): Promise<ApiAvatar[]> {
  const trimmedId = projectId.trim();
  if (!trimmedId) {
    throw new Error("Project id is required.");
  }
  const images = files.filter((file) => file.type.startsWith("image/"));
  if (images.length === 0) {
    return [];
  }

  const uploads = images.map(async (file) => {
    const contentType = file.type || "application/octet-stream";
    const key = buildProjectPhotoKey(trimmedId, createPhotoId());
    const presignResponse = await apiRequest<PresignResponse>(
      `/api/storage/presign/put?key=${encodeURIComponent(key)}&contentType=${encodeURIComponent(contentType)}`,
      {
        method: "GET",
      },
    );
    const presignUrl = presignResponse?.presign?.trim();
    if (!presignUrl) {
      throw new Error("Photo upload URL is missing.");
    }
    const uploadResponse = await fetch(presignUrl, {
      method: "PUT",
      body: file,
      credentials: "omit",
      headers: contentType ? { "Content-Type": contentType } : undefined,
    });
    if (!uploadResponse.ok) {
      throw new Error(`Photo upload failed (${uploadResponse.status}).`);
    }
    return { key, contentType };
  });

  return Promise.all(uploads);
}

export async function fetchTicketInfo(
  id: string,
  options?: { signal?: AbortSignal; token?: string },
): Promise<ApiTicket | null> {
  const encoded = encodeURIComponent(id);
  const query = options?.token
    ? `?token=${encodeURIComponent(options.token)}`
    : "";
  const payload = await apiRequest<unknown>(
    `/api/tickets/${encoded}/info${query}`,
    {
      method: "GET",
      signal: options?.signal,
    },
  );
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
  options?: { signal?: AbortSignal; token?: string },
): Promise<ApiTicketMessage[]> {
  const encoded = encodeURIComponent(id);
  const query = options?.token
    ? `?token=${encodeURIComponent(options.token)}`
    : "";
  const payload = await apiRequest<unknown>(
    `/api/tickets/${encoded}/messages/list${query}`,
    {
      method: "GET",
      signal: options?.signal,
    },
  );
  const record = toTicketRecord(payload);
  const resolveList = (value: unknown): ApiTicketMessage[] | null => {
    if (Array.isArray(value)) {
      return value as ApiTicketMessage[];
    }
    if (!value || typeof value !== "object") {
      return null;
    }
    const nested = value as Record<string, unknown>;
    const candidate =
      nested.list ??
      nested.messages ??
      nested.items ??
      nested.message_list ??
      nested.data;
    return Array.isArray(candidate) ? (candidate as ApiTicketMessage[]) : null;
  };

  const messages =
    resolveList(payload) ??
    resolveList(record?.data) ??
    resolveList(record) ??
    [];

  return messages;
}

export async function createTicketMessage(
  id: string,
  message: string,
  options?: { token?: string },
): Promise<void> {
  const trimmed = message.trim();
  if (!trimmed) {
    throw new Error("Ticket message is required.");
  }
  const encoded = encodeURIComponent(id);
  const body: Record<string, unknown> = { content: trimmed };
  if (options?.token) {
    body.token = options.token;
  }
  await apiRequest(`/api/tickets/${encoded}/messages/create`, {
    method: "POST",
    body: JSON.stringify(body),
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

export async function fetchTicketsALL(options?: {
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

export async function fetchTicketsSelf(options?: {
  signal?: AbortSignal;
}): Promise<ApiTicket[]> {
  const payload = await apiRequest<unknown>("/api/tickets/self", {
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
