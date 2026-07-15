import assert from "node:assert/strict"
import test from "node:test"

import {
  notifyAuthExpired,
  TOKEN_KEY,
  USER_KEY,
} from "../src/lib/auth-session.ts"

class MemoryStorage {
  private readonly values = new Map<string, string>()

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  removeItem(key: string) {
    this.values.delete(key)
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}

function installWindow(localStorage: MemoryStorage, sessionStorage: MemoryStorage) {
  const events: Event[] = []
  const previousWindow = globalThis.window

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage,
      sessionStorage,
      dispatchEvent(event: Event) {
        events.push(event)
        return true
      },
    },
  })

  return {
    events,
    restore() {
      if (previousWindow === undefined) {
        Reflect.deleteProperty(globalThis, "window")
      } else {
        Object.defineProperty(globalThis, "window", {
          configurable: true,
          value: previousWindow,
        })
      }
    },
  }
}

test("a stale unauthorized response does not clear a newer login token", () => {
  const localStorage = new MemoryStorage()
  const sessionStorage = new MemoryStorage()
  localStorage.setItem(TOKEN_KEY, "new-token")
  localStorage.setItem(USER_KEY, "new-user")
  const browser = installWindow(localStorage, sessionStorage)

  try {
    const notified = notifyAuthExpired("旧登录已失效", "old-token")

    assert.equal(notified, false)
    assert.equal(localStorage.getItem(TOKEN_KEY), "new-token")
    assert.equal(localStorage.getItem(USER_KEY), "new-user")
    assert.equal(browser.events.length, 0)
  } finally {
    browser.restore()
  }
})

test("concurrent unauthorized responses for one token emit one expiry event", () => {
  const localStorage = new MemoryStorage()
  const sessionStorage = new MemoryStorage()
  localStorage.setItem(TOKEN_KEY, "failed-token")
  localStorage.setItem(USER_KEY, "current-user")
  const browser = installWindow(localStorage, sessionStorage)

  try {
    const firstNotified = notifyAuthExpired("登录已失效", "failed-token")
    const secondNotified = notifyAuthExpired("登录已失效", "failed-token")

    assert.equal(firstNotified, true)
    assert.equal(secondNotified, false)
    assert.equal(localStorage.getItem(TOKEN_KEY), null)
    assert.equal(localStorage.getItem(USER_KEY), null)
    assert.equal(browser.events.length, 1)
  } finally {
    browser.restore()
  }
})
