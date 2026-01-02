export type RegisterPayload = {
  username: string
  password: string
  email: string
}

export type AuthorizationPayload = {
  usermail: string
  password: string
}

type ApiEmail = {
  address: string
  verified: boolean
}

type ApiRank = {
  name: string
  expires?: string | null
}

type ApiUserSettings = {
  display_name?: string | null
  displayName?: string | null
  session_live_time?: number | null
  sessionLiveTime?: number | null
  avatar?: unknown
}

type ApiUserPublic = {
  uid?: number
  userID?: number
  username?: string
  settings?: ApiUserSettings | null
  rank?: ApiRank | null
  joined?: string
  joinedAt?: string
}

type ApiUser = {
  uid?: number
  userID?: number
  username?: string
  public?: ApiUserPublic | null
  email?: ApiEmail | null
  settings?: ApiUserSettings | null
  rank?: ApiRank | null
  joined?: string
  joinedAt?: string
}

type ApiUserResponse = {
  data?: ApiUser | null
  tracing?: string
}

export type AuthUser = {
  uid: number
  username: string
  email?: string
  displayName?: string
  rank?: ApiRank | null
  joined?: string
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}


function isApiUserResponse(payload: ApiUser | ApiUserResponse): payload is ApiUserResponse {
  return typeof payload === "object" && payload !== null && "data" in payload
}

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8080"
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL

function toAuthUser(payload: ApiUser | ApiUserResponse): AuthUser {
  const user: ApiUser | null = isApiUserResponse(payload) ? (payload.data ?? null) : payload

  if (!user) {
    throw new Error("Missing user payload.")
  }

  const publicUser = user.public ?? undefined
  const uid = publicUser?.uid ?? publicUser?.userID ?? user.uid ?? user.userID
  const username = publicUser?.username ?? user.username

  if (uid == null || !username) {
    throw new Error("Missing user fields.")
  }

  const settings = publicUser?.settings ?? user.settings
  const displayName = settings?.display_name ?? settings?.displayName ?? undefined
  const rank = publicUser?.rank ?? user.rank ?? undefined
  const joined = publicUser?.joined ?? publicUser?.joinedAt ?? user.joined ?? user.joinedAt

  return {
    uid,
    username,
    email: user.email?.address,
    displayName,
    rank,
    joined,
  }
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const data = (await response.json()) as { error?: string }
      if (data?.error) {
        message = data.error
      }
    } catch {
      message = response.statusText || message
    }
    throw new ApiError(response.status, message)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export async function registerUser(payload: RegisterPayload): Promise<void> {
  await apiRequest("/api/login/register", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function authorizeUser(payload: AuthorizationPayload): Promise<void> {
  await apiRequest("/api/login/authorization", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function logoutUser(): Promise<void> {
  await apiRequest("/api/login/logout", {
    method: "POST",
  })
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const payload = await apiRequest<ApiUser | ApiUserResponse>("/api/user", { method: "GET" })
  return toAuthUser(payload)
}

export async function updateDisplayName(name: string): Promise<AuthUser> {
  const encoded = encodeURIComponent(name)
  await apiRequest(`/api/user/change/name/${encoded}`, {
    method: "PATCH",
  })
  return fetchCurrentUser()
}
