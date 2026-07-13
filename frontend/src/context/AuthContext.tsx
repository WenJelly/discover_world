import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { toast as sonner } from "sonner"

import { loginUser, registerUser, fetchUserProfile } from "@/lib/api"
import { mergeAccountDetailIntoAuthUser, toAuthUser } from "@/lib/auth-user"
import {
  AUTH_EXPIRED_EVENT,
  type AuthExpiredEventDetail,
  clearAuthStorage,
  getTokenExpiresAt,
  isTokenUsable,
  notifyAuthExpired,
  TOKEN_KEY,
  USER_KEY,
} from "@/lib/auth-session"
import type {
  AuthUser,
  DetailUserResponse,
  LoginRequest,
  RegisterRequest,
  RegisterResponse,
} from "@/lib/types"

type AuthContextValue = {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  login: (
    req: LoginRequest,
    options?: {
      remember?: boolean
    }
  ) => Promise<AuthUser>
  register: (req: RegisterRequest) => Promise<RegisterResponse>
  logout: () => void
  refreshUser: () => Promise<void>
  applyAccountDetail: (detail: DetailUserResponse) => AuthUser | null
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function safeGet(storage: Storage, key: string) {
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(storage: Storage, key: string, value: string) {
  try {
    storage.setItem(key, value)
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

function safeRemove(storage: Storage, key: string) {
  try {
    storage.removeItem(key)
  } catch {
    // Ignore unavailable storage.
  }
}

function readStoredAuth() {
  if (typeof window === "undefined") {
    return {
      token: null,
      user: null,
    }
  }

  const token = safeGet(localStorage, TOKEN_KEY) ?? safeGet(sessionStorage, TOKEN_KEY)
  const rawUser = safeGet(localStorage, USER_KEY) ?? safeGet(sessionStorage, USER_KEY)

  if (!token || !rawUser) {
    return {
      token: null,
      user: null,
    }
  }

  if (!isTokenUsable(token)) {
    clearStoredAuth()
    return {
      token: null,
      user: null,
    }
  }

  try {
    return {
      token,
      user: JSON.parse(rawUser) as AuthUser,
    }
  } catch {
    clearStoredAuth()
    return {
      token: null,
      user: null,
    }
  }
}

function persistAuth(token: string, user: AuthUser, remember: boolean) {
  const targetStorage = remember ? localStorage : sessionStorage
  const staleStorage = remember ? sessionStorage : localStorage

  safeRemove(staleStorage, TOKEN_KEY)
  safeRemove(staleStorage, USER_KEY)
  safeSet(targetStorage, TOKEN_KEY, token)
  safeSet(targetStorage, USER_KEY, JSON.stringify(user))
}

function persistCurrentUser(user: AuthUser) {
  const inLocalStorage = safeGet(localStorage, TOKEN_KEY) ?? safeGet(localStorage, USER_KEY)
  const targetStorage = inLocalStorage ? localStorage : sessionStorage
  safeSet(targetStorage, USER_KEY, JSON.stringify(user))
}

function clearStoredAuth() {
  clearAuthStorage()
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState(readStoredAuth)

  const clearAuthState = useCallback(() => {
    clearStoredAuth()
    setAuth({
      token: null,
      user: null,
    })
  }, [])

  const login = useCallback(
    async (req: LoginRequest, options: { remember?: boolean } = {}) => {
      const resp = await loginUser(req)
      const nextUser = toAuthUser(resp)

      persistAuth(resp.token, nextUser, options.remember ?? true)
      setAuth({
        token: resp.token,
        user: nextUser,
      })

      return nextUser
    },
    []
  )

  const register = useCallback((req: RegisterRequest) => registerUser(req), [])

  const logout = useCallback(() => {
    clearAuthState()
  }, [clearAuthState])

  const refreshUser = useCallback(async () => {
    if (!auth.user?.id || !auth.token) {
      return
    }

    try {
      const profile = await fetchUserProfile({ id: auth.user.id })
      const updatedUser = mergeAccountDetailIntoAuthUser(auth.user, profile)
      persistCurrentUser(updatedUser)

      setAuth({
        token: auth.token,
        user: updatedUser,
      })
    } catch (error) {
      console.error('Failed to refresh user:', error)
    }
  }, [auth.user, auth.token])

  const applyAccountDetail = useCallback(
    (detail: DetailUserResponse) => {
      if (!auth.user || !auth.token) {
        return null
      }

      const updatedUser = mergeAccountDetailIntoAuthUser(auth.user, detail)
      persistCurrentUser(updatedUser)
      setAuth({
        token: auth.token,
        user: updatedUser,
      })
      return updatedUser
    },
    [auth.user, auth.token]
  )

  useEffect(() => {
    function handleAuthExpired(event: Event) {
      clearAuthState()
      const detail = (event as CustomEvent<AuthExpiredEventDetail>).detail
      sonner.error("登录已过期", {
        description: detail?.message ?? "请重新登录后继续操作。",
      })
    }

    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired)

    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired)
    }
  }, [clearAuthState])

  useEffect(() => {
    if (!auth.token) {
      return
    }

    const expiresAt = getTokenExpiresAt(auth.token)
    if (!expiresAt || expiresAt <= Date.now()) {
      notifyAuthExpired("登录已过期，请重新登录")
      return
    }

    const timeoutId = window.setTimeout(() => {
      notifyAuthExpired("登录已过期，请重新登录")
    }, Math.min(expiresAt - Date.now(), 2_147_483_647))

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [auth.token])

  const value = useMemo(
    () => ({
      user: auth.user,
      token: auth.token,
      isAuthenticated: Boolean(auth.token && auth.user),
      login,
      register,
      logout,
      refreshUser,
      applyAccountDetail,
    }),
    [auth.token, auth.user, applyAccountDetail, login, logout, register, refreshUser]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }

  return context
}
