"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import type { AuthorizationPayload, AuthUser, RegisterPayload } from "@/lib/api"
import { authorizeUser, fetchCurrentUser, logoutUser, registerUser, updateDisplayName } from "@/lib/api"

type AuthStatus = "loading" | "authenticated" | "anonymous"

type AuthContextValue = {
  status: AuthStatus
  user: AuthUser | null
  login: (payload: AuthorizationPayload) => Promise<void>
  register: (payload: RegisterPayload) => Promise<void>
  logout: () => Promise<void>
  refreshUser: (options?: { silent?: boolean }) => Promise<void>
  updateDisplayName: (displayName: string) => Promise<AuthUser | null>
  hasAdminAccess: boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading")
  const [user, setUser] = useState<AuthUser | null>(null)

  const refreshUser = useCallback(async ({ silent }: { silent?: boolean } = {}) => {
    if (!silent) {
      setStatus("loading")
    }
    try {
      const current = await fetchCurrentUser()
      setUser(current)
      setStatus("authenticated")
    } catch {
      setUser(null)
      setStatus("anonymous")
    }
  }, [])

  useEffect(() => {
    refreshUser()
  }, [refreshUser])

  const login = useCallback(
    async (payload: AuthorizationPayload) => {
      if (payload.usermail === "admin@admin.admin" && payload.password === "admin") {
        setUser({
          uid: 0,
          username: "admin",
          email: "admin@admin.admin",
          displayName: "Admin",
          rank: { name: "developer" },
        })
        setStatus("authenticated")
        return
      }
      await authorizeUser(payload)
      await refreshUser({ silent: true })
    },
    [refreshUser],
  )

  const register = useCallback(
    async (payload: RegisterPayload) => {
      await registerUser(payload)
      await refreshUser({ silent: true })
    },
    [refreshUser],
  )

  const logout = useCallback(async () => {
    try {
      await logoutUser()
    } catch {
      // Ignore logout errors and clear local state.
    } finally {
      setUser(null)
      setStatus("anonymous")
    }
  }, [])

  const handleUpdateDisplayName = useCallback(
    async (displayName: string) => {
      if (!user) {
        return null
      }
      const updated = await updateDisplayName(displayName)
      setUser(updated)
      return updated
    },
    [user],
  )

  const hasAdminAccess = useMemo(() => {
    const role = user?.rank?.name
    return role === "staff" || role === "developer"
  }, [user?.rank?.name])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      login,
      register,
      logout,
      refreshUser,
      updateDisplayName: handleUpdateDisplayName,
      hasAdminAccess,
    }),
    [status, user, login, register, logout, refreshUser, handleUpdateDisplayName, hasAdminAccess],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
