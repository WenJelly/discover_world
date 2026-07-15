export const TOKEN_KEY = "token"
export const USER_KEY = "auth_user"
export const AUTH_EXPIRED_EVENT = "discover-world:auth-expired"

export type AuthExpiredEventDetail = {
  message?: string
}

type AuthStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">

export type AuthStoragePair = {
  localStorage: AuthStorage
  sessionStorage: AuthStorage
}

function safeRemove(storage: AuthStorage, key: string) {
  try {
    storage.removeItem(key)
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

function safeGet(storage: AuthStorage, key: string) {
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

function getBrowserAuthStorage(): AuthStoragePair | null {
  if (typeof window === "undefined") {
    return null
  }

  return {
    localStorage: window.localStorage,
    sessionStorage: window.sessionStorage,
  }
}

function decodeBase64Url(value: string): string | null {
  if (typeof atob !== "function") {
    return null
  }

  const normalized = value.replaceAll("-", "+").replaceAll("_", "/")
  const padding = normalized.length % 4
  const padded = padding ? normalized.padEnd(normalized.length + 4 - padding, "=") : normalized

  try {
    return atob(padded)
  } catch {
    return null
  }
}

function readJwtPayload(token: string): Record<string, unknown> | null {
  const [, payload] = token.split(".")
  if (!payload) {
    return null
  }

  const decoded = decodeBase64Url(payload)
  if (!decoded) {
    return null
  }

  try {
    const parsed = JSON.parse(decoded)
    return parsed && typeof parsed === "object" ? parsed : null
  } catch {
    return null
  }
}

export function getTokenExpiresAt(token: string): number | null {
  const payload = readJwtPayload(token)
  const exp = payload?.exp
  const expSeconds = typeof exp === "string" ? Number(exp) : exp

  if (typeof expSeconds !== "number" || !Number.isFinite(expSeconds)) {
    return null
  }

  return expSeconds * 1000
}

export function isTokenUsable(token: string | null | undefined, nowMs = Date.now()) {
  if (!token) {
    return false
  }

  const expiresAt = getTokenExpiresAt(token)
  return expiresAt !== null && expiresAt > nowMs
}

export function clearAuthStorage(storage: AuthStoragePair | null = getBrowserAuthStorage()) {
  if (!storage) {
    return
  }

  safeRemove(storage.localStorage, TOKEN_KEY)
  safeRemove(storage.localStorage, USER_KEY)
  safeRemove(storage.sessionStorage, TOKEN_KEY)
  safeRemove(storage.sessionStorage, USER_KEY)
}

function getStoredToken(storage: AuthStoragePair) {
  return safeGet(storage.localStorage, TOKEN_KEY) ?? safeGet(storage.sessionStorage, TOKEN_KEY)
}

export function notifyAuthExpired(
  message = "登录已过期，请重新登录",
  failedToken?: string
) {
  const storage = getBrowserAuthStorage()
  if (failedToken !== undefined && (!storage || getStoredToken(storage) !== failedToken)) {
    return false
  }

  clearAuthStorage(storage)

  if (typeof window === "undefined") {
    return false
  }

  window.dispatchEvent(
    new CustomEvent<AuthExpiredEventDetail>(AUTH_EXPIRED_EVENT, {
      detail: { message },
    })
  )
  return true
}
