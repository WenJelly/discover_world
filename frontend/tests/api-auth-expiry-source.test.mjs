import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const source = readFileSync(new URL("../src/lib/api.ts", import.meta.url), "utf8")

test("protected request expiry handling is bound to the token used by that request", () => {
  assert.match(source, /let requestToken: string \| null = null;/)
  assert.match(source, /requestToken = getToken\(\);/)
  assert.match(
    source,
    /if \(options\.requireAuth && requestToken\) \{\s*notifyAuthExpired\(message, requestToken\);\s*\}/
  )
})
