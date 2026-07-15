import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import test from "node:test"

function readSource(relativePath) {
  return readFileSync(new URL(`../src/${relativePath}`, import.meta.url), "utf8")
}

function openingTags(source, tagName) {
  const result = []
  const needle = `<${tagName}`
  let start = 0

  while ((start = source.indexOf(needle, start)) >= 0) {
    const boundary = source[start + needle.length]
    if (boundary && !/[\s/>]/.test(boundary)) {
      start += needle.length
      continue
    }

    let quote = null
    let braceDepth = 0
    let end = start + needle.length

    for (; end < source.length; end += 1) {
      const char = source[end]
      const previous = source[end - 1]
      if (quote) {
        if (char === quote && previous !== "\\") quote = null
        continue
      }
      if (char === '"' || char === "'" || char === "`") {
        quote = char
        continue
      }
      if (char === "{") braceDepth += 1
      if (char === "}") braceDepth -= 1
      if (char === ">" && braceDepth === 0) break
    }

    result.push(source.slice(start, end + 1))
    start = end + 1
  }

  return result
}

function assertMarkedNativeSurfaces(relativePath, expectedCount) {
  const tags = openingTags(readSource(relativePath), "button")
  assert.equal(tags.length, expectedCount, relativePath)
  for (const tag of tags) {
    assert.match(tag, /data-slot="interactive-surface"/, `${relativePath}: ${tag}`)
    assert.match(tag, /interactiveSurfaceClassName/, `${relativePath}: ${tag}`)
  }
}

function assertUsesShadcnButton(relativePath) {
  const source = readSource(relativePath)
  assert.match(source, /import \{ Button \} from "@\/components\/ui\/button";?/)
  assert.ok(openingTags(source, "Button").length > 0, relativePath)
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

test("public discovery and search keep only registered native interaction surfaces", () => {
  assertMarkedNativeSurfaces("pages/DiscoverPage.tsx", 0)
  assertMarkedNativeSurfaces("pages/SearchPage.tsx", 3)
  assertMarkedNativeSurfaces("pages/CommunityPage.tsx", 2)
  assertMarkedNativeSurfaces("components/home/InfiniteGallery.tsx", 0)
  assertMarkedNativeSurfaces("components/discover/DiscoverPictureCard.tsx", 1)
  assert.match(
    readSource("components/discover/DiscoverPictureCard.tsx"),
    /focus-visible:ring-inset/
  )
})

test("shell and auth use shadcn actions and keep notification rows as surfaces", () => {
  const taskFiles = [
    "components/Navbar.tsx",
    "components/auth/AuthDialog.tsx",
    "components/notifications/NotificationBell.tsx",
    "pages/NotificationsPage.tsx",
  ]
  const navbar = readSource(taskFiles[0])
  const auth = readSource(taskFiles[1])
  const notificationBell = readSource(taskFiles[2])

  for (const relativePath of taskFiles.slice(0, 3)) {
    assertUsesShadcnButton(relativePath)
  }

  assertMarkedNativeSurfaces(taskFiles[0], 0)
  assertMarkedNativeSurfaces(taskFiles[1], 0)
  assertMarkedNativeSurfaces(taskFiles[2], 1)
  assertMarkedNativeSurfaces(taskFiles[3], 1)

  const bellTrigger = openingTags(notificationBell, "Button").find((tag) =>
    tag.includes('aria-label="通知"')
  )
  assert.ok(bellTrigger, "NotificationBell must expose a shadcn bell trigger")
  assert.match(bellTrigger, /variant="ghost"/)
  assert.match(bellTrigger, /size="icon-lg"/)
  assert.match(
    notificationBell,
    /className="absolute -right-1 -top-1 min-w-4 rounded-full/
  )

  const desktopAuthButtons = openingTags(navbar, "Button").filter((tag) =>
    tag.includes("onClick={() => setAuthOpen(true)}")
  )
  assert.equal(desktopAuthButtons.length, 2)
  for (const tag of desktopAuthButtons) {
    assert.doesNotMatch(tag, /size="sm"/)
  }

  assert.match(auth, /import \{ Spinner \} from "@\/components\/ui\/spinner"/)
  assert.equal(openingTags(auth, "Spinner").length, 2)
  assert.match(auth, /aria-busy=\{loading === "login"\}/)
  assert.match(auth, /aria-busy=\{loading === "register"\}/)

  for (const relativePath of taskFiles) {
    assert.doesNotMatch(readSource(relativePath), /role\s*=\s*["']button["']/)
  }
})
