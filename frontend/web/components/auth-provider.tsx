"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  AvatarUploadPayload,
  ApiPermissions,
  AuthorizationPayload,
  AuthUser,
  RegisterPayload,
} from "@/lib/api";
import {
  authorizeUser,
  deleteAvatar,
  fetchCurrentUser,
  fetchUserPermissions,
  logoutUser,
  registerUser,
  updateAvatar,
  updateDisplayName,
  updateProfileDescription,
} from "@/lib/api";

type AuthStatus = "loading" | "authenticated" | "anonymous";

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  permissions: ApiPermissions | null;
  login: (payload: AuthorizationPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: (options?: { silent?: boolean }) => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<AuthUser | null>;
  updateProfileDescription: (description: string) => Promise<AuthUser | null>;
  updateAvatar: (payload: AvatarUploadPayload) => Promise<AuthUser | null>;
  deleteAvatar: () => Promise<AuthUser | null>;
  hasAdminAccess: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type PermissionPath = Array<string | string[]>;

const adminPermissionPaths: PermissionPath[] = [
  ["all"],
  ["statistics", "all"],
  ["submissions", "view"],
  ["submissions", "accept"],
  ["submissions", "decline"],
  ["tickets", "accept"],
  ["tickets", ["viewList", "view_list"], "any"],
  ["users", "moderation", "all"],
  ["users", "moderation", "ban"],
  ["users", "moderation", ["banForever", "ban_forever"]],
  ["users", "moderation", "unban"],
  ["ranks", "all"],
  ["ranks", ["permsChange", "permissionsChange", "permissions_change"]],
];

const adminRoles = new Set([
  "root",
  "admin",
  "staff",
  "moderator",
  "support",
  "developer",
  "operator",
]);

const isAdminRole = (value: string | undefined): boolean => {
  if (!value) {
    return false;
  }
  return adminRoles.has(value.trim().toLowerCase());
};

const toRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as Record<string, unknown>;
};

const readPermissionFlag = (value: unknown, path: PermissionPath): boolean => {
  let current: unknown = value;
  for (const segment of path) {
    const record = toRecord(current);
    if (!record) {
      return false;
    }
    const keys = Array.isArray(segment) ? segment : [segment];
    let next: unknown = undefined;
    for (const key of keys) {
      if (key in record) {
        next = record[key];
        break;
      }
    }
    if (next === undefined) {
      return false;
    }
    current = next;
  }
  return current === true;
};

const hasAnyPermission = (
  permissions: ApiPermissions | null,
  paths: PermissionPath[],
): boolean => {
  if (!permissions) {
    return false;
  }
  return paths.some((path) => readPermissionFlag(permissions, path));
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [permissions, setPermissions] = useState<ApiPermissions | null>(null);

  const refreshUser = useCallback(
    async ({ silent }: { silent?: boolean } = {}) => {
      if (!silent) {
        setStatus("loading");
      }
      try {
        const current = await fetchCurrentUser();
        let currentPermissions: ApiPermissions | null = null;
        try {
          currentPermissions = await fetchUserPermissions(current.uid);
        } catch {
          currentPermissions = null;
        }
        setUser(current);
        setPermissions(currentPermissions);
        setStatus("authenticated");
      } catch {
        setUser(null);
        setPermissions(null);
        setStatus("anonymous");
      }
    },
    [],
  );

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(
    async (payload: AuthorizationPayload) => {
      await authorizeUser(payload);
      await refreshUser({ silent: true });
    },
    [refreshUser],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      await registerUser(payload);
      await refreshUser({ silent: true });
    },
    [refreshUser],
  );

  const logout = useCallback(async () => {
    try {
      await logoutUser();
    } catch {
      // Ignore logout errors and clear local state.
    } finally {
      setUser(null);
      setPermissions(null);
      setStatus("anonymous");
    }
  }, []);

  const handleUpdateDisplayName = useCallback(
    async (displayName: string) => {
      if (!user) {
        return null;
      }
      const updated = await updateDisplayName(displayName);
      setUser(updated);
      return updated;
    },
    [user],
  );

  const handleUpdateAvatar = useCallback(
    async (payload: AvatarUploadPayload) => {
      if (!user) {
        return null;
      }
      const updated = await updateAvatar(payload);
      setUser(updated);
      return updated;
    },
    [user],
  );

  const handleUpdateProfileDescription = useCallback(
    async (description: string) => {
      if (!user) {
        return null;
      }
      const updated = await updateProfileDescription(description);
      setUser(updated);
      return updated;
    },
    [user],
  );

  const handleDeleteAvatar = useCallback(async () => {
    if (!user) {
      return null;
    }
    const updated = await deleteAvatar();
    setUser(updated);
    return updated;
  }, [user]);

  const hasAdminAccess = useMemo(() => {
    if (hasAnyPermission(permissions, adminPermissionPaths)) {
      return true;
    }
    return isAdminRole(user?.rank?.name);
  }, [permissions, user?.rank?.name]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      permissions,
      login,
      register,
      logout,
      refreshUser,
      updateDisplayName: handleUpdateDisplayName,
      updateProfileDescription: handleUpdateProfileDescription,
      updateAvatar: handleUpdateAvatar,
      deleteAvatar: handleDeleteAvatar,
      hasAdminAccess,
    }),
    [
      status,
      user,
      permissions,
      login,
      register,
      logout,
      refreshUser,
      handleUpdateDisplayName,
      handleUpdateProfileDescription,
      handleUpdateAvatar,
      handleDeleteAvatar,
      hasAdminAccess,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
