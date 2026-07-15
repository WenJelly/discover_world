import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

function readSource(relativePath) {
  return readFileSync(new URL(`../src/${relativePath}`, import.meta.url), "utf8")
}

test("button foundations keep shadcn Button and provide Spinner plus interactive surface states", () => {
  const button = readSource("components/ui/button.tsx")
  const spinner = readSource("components/ui/spinner.tsx")
  const surface = readSource("lib/interactive-surface.ts")

  assert.match(button, /import \{ Button as ButtonPrimitive \} from "@base-ui\/react\/button"/)
  assert.match(button, /default: "bg-primary text-primary-foreground hover:bg-primary\/80"/)
  assert.match(button, /destructive:/)
  assert.match(spinner, /data-slot="spinner"/)
  assert.match(spinner, /role="status"/)
  assert.match(spinner, /className=\{cn\("size-4 animate-spin", className\)\}/)
  assert.match(surface, /focus-visible:ring-3/)
  assert.match(surface, /focus-visible:ring-ring\/50/)
  assert.match(surface, /disabled:pointer-events-none/)
})
