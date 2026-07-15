import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import test from "node:test"

function readSource(relativePath) {
  return readFileSync(new URL(`../src/${relativePath}`, import.meta.url), "utf8")
}

test("button foundations keep shadcn Button and provide Spinner plus interactive surface states", () => {
  const button = readSource("components/ui/button.tsx")
  const spinner = readSource("components/ui/spinner.tsx")
  const surface = readSource("lib/interactive-surface.ts")

  const buttonSha256 = createHash("sha256").update(button).digest("hex")

  assert.equal(
    buttonSha256,
    "d14549ab3ba7a9d5d1f424c2599233bffa0b317121abf3b6efa2fb902d5e2781",
    "components/ui/button.tsx must remain exactly the approved generated shadcn base-nova Button"
  )
  assert.match(spinner, /import \{ Loader2Icon \} from "lucide-react"/)
  assert.match(
    spinner,
    /<Loader2Icon data-slot="spinner" role="status" aria-label="Loading" className=\{cn\("size-4 animate-spin", className\)\} \{\.\.\.props\} \/>/
  )
  assert.equal(
    surface,
    `const interactiveSurfaceClassName =
  "outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"

export { interactiveSurfaceClassName }
`
  )
})
