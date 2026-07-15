import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readdirSync, readFileSync } from "node:fs"
import { relative, resolve, sep } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import * as ts from "typescript"

const sourceRoot = fileURLToPath(new URL("../src", import.meta.url))

function readSource(relativePath) {
  return readFileSync(new URL(`../src/${relativePath}`, import.meta.url), "utf8")
}

function openingTags(source, tagName) {
  const result = []
  const sourceFile = ts.createSourceFile(
    "source.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )

  function visit(node) {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      node.tagName.getText(sourceFile) === tagName
    ) {
      result.push(node.getText(sourceFile))
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  return result
}

function allOpeningTags(source) {
  const result = []
  const sourceFile = ts.createSourceFile(
    "source.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )

  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      result.push(node.getText(sourceFile))
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return result
}

function walkTsxFiles(directory = sourceRoot) {
  const files = []

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...walkTsxFiles(absolutePath))
    } else if (entry.isFile() && entry.name.endsWith(".tsx")) {
      files.push({
        absolutePath,
        relativePath: relative(sourceRoot, absolutePath).split(sep).join("/"),
        source: readFileSync(absolutePath, "utf8"),
      })
    }
  }

  return files
}

function elementBlocks(source, tagName) {
  const result = []
  const openingNeedle = `<${tagName}`
  const closingNeedle = `</${tagName}>`
  let start = 0

  while ((start = source.indexOf(openingNeedle, start)) >= 0) {
    const end = source.indexOf(closingNeedle, start)
    assert.notEqual(end, -1, `${tagName} block starting at ${start}`)
    result.push(source.slice(start, end + closingNeedle.length))
    start = end + closingNeedle.length
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

function assertBusyButtons(relativePath, callbackNeedle, busyState, expectedCount) {
  const blocks = elementBlocks(readSource(relativePath), "Button").filter((block) =>
    block.includes(callbackNeedle)
  )
  assert.equal(blocks.length, expectedCount, `${relativePath}: ${callbackNeedle}`)

  for (const block of blocks) {
    const openingTag = openingTags(block, "Button")[0]
    assert.match(openingTag, new RegExp(`disabled=\\{${busyState}\\}`), block)
    assert.match(openingTag, new RegExp(`aria-busy=\\{${busyState}\\}`), block)
    assert.match(block, /<Spinner aria-label="加载中" \/>/, block)
  }
}

test("button foundations keep shadcn Button and provide Spinner plus interactive surface states", () => {
  const button = readSource("components/ui/button.tsx")
  const spinner = readSource("components/ui/spinner.tsx")
  const surface = readSource("lib/interactive-surface.ts")

  const buttonSha256 = createHash("sha256")
    .update(button.replaceAll("\r\n", "\n"))
    .digest("hex")

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

test("all business native buttons and role buttons use the registered interaction surface", () => {
  const businessFiles = walkTsxFiles().filter(
    ({ relativePath }) => relativePath !== "components/ui/sidebar.tsx"
  )
  const nativeButtons = businessFiles.flatMap(({ relativePath, source }) =>
    openingTags(source, "button").map((tag) => ({ relativePath, tag }))
  )

  assert.equal(
    nativeButtons.length,
    23,
    nativeButtons.map(({ relativePath, tag }) => `${relativePath}: ${tag}`).join("\n")
  )
  for (const { relativePath, tag } of nativeButtons) {
    assert.match(tag, /data-slot="interactive-surface"/, `${relativePath}: ${tag}`)
    assert.match(tag, /interactiveSurfaceClassName/, `${relativePath}: ${tag}`)
  }

  const roleButtons = walkTsxFiles().flatMap(({ relativePath, source }) =>
    allOpeningTags(source)
      .filter((tag) => /\brole\s*=\s*["']button["']/.test(tag))
      .map((tag) => ({ relativePath, tag }))
  )
  assert.deepEqual(
    roleButtons.map(({ relativePath }) => relativePath),
    ["components/upload/UploadDialog.tsx"]
  )
  assert.match(roleButtons[0].tag, /data-slot="interactive-surface"/)
  assert.match(roleButtons[0].tag, /interactiveSurfaceClassName/)
})

test("business Button calls do not recreate visual systems", () => {
  const businessFiles = walkTsxFiles().filter(
    ({ relativePath }) => !relativePath.startsWith("components/ui/")
  )
  const forbiddenClasses = [
    [
      "arbitrary height",
      /(?:^|[\s"'`])(?:[^\s"'`]+:)*h-\[[^\]]+\](?=$|[\s"'`}])/,
    ],
    [
      "fixed height h-6 through h-12",
      /(?:^|[\s"'`])(?:[^\s"'`]+:)*h-(?:[6-9]|1[0-2])(?=$|[\s"'`}])/,
    ],
    [
      "rounded styling",
      /(?:^|[\s"'`])(?:[^\s"'`]+:)*rounded(?:-[^\s"'`}]+)?(?=$|[\s"'`}])/,
    ],
    [
      "horizontal padding",
      /(?:^|[\s"'`])(?:[^\s"'`]+:)*(?:px|pl|pr|ps|pe)-[^\s"'`}]+(?=$|[\s"'`}])/,
    ],
    [
      "page color",
      /(?:^|[\s"'`])(?:[^\s"'`]+:)*(?:bg|text)-(?:blue|indigo|white|black|slate|red|rose|amber|green)(?:-[^\s"'`}]+)?(?=$|[\s"'`}])/,
    ],
  ]
  const violations = []

  for (const { relativePath, source } of businessFiles) {
    for (const tag of openingTags(source, "Button")) {
      for (const [contract, pattern] of forbiddenClasses) {
        if (pattern.test(tag)) violations.push(`${relativePath}: ${contract}: ${tag}`)
      }
      if (/\bsize\s*=\s*["']icon[^"']*["']/.test(tag) && !/\baria-label=/.test(tag)) {
        violations.push(`${relativePath}: icon Button requires aria-label: ${tag}`)
      }
    }
  }

  assert.deepEqual(violations, [])
})

test("retired page-specific button CSS is removed", () => {
  const css = readSource("index.css")

  assert.doesNotMatch(css, /discover-layout-switch__button/)
  assert.doesNotMatch(css, /discover-feedback__button/)
  assert.doesNotMatch(css, /discover-inline-error button/)
  assert.doesNotMatch(css, /search-clear-button/)
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
  const notifications = readSource(taskFiles[3])

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

  assert.match(notifications, /import \{ Spinner \} from "@\/components\/ui\/spinner"/)
  const loadMore = elementBlocks(notifications, "Button").find((block) =>
    block.includes('loadNotifications("append")')
  )
  assert.ok(loadMore, "NotificationsPage must expose a load-more Button")
  assert.match(openingTags(loadMore, "Button")[0], /disabled=\{loading\}/)
  assert.match(openingTags(loadMore, "Button")[0], /aria-busy=\{loading\}/)
  assert.match(loadMore, /<Spinner aria-label="加载中" \/>/)

  for (const relativePath of taskFiles) {
    assert.doesNotMatch(readSource(relativePath), /role\s*=\s*["']button["']/)
  }
})

test("account post upload and media actions use Button while semantic surfaces remain native", () => {
  const taskFiles = [
    "pages/AccountDetailPage.tsx",
    "components/post/PostComposerDialog.tsx",
    "components/post/PostImageAttach.tsx",
    "components/post/PostCard.tsx",
    "components/post/PostVisibilityMenu.tsx",
    "components/upload/UploadDialog.tsx",
    "components/photo/PhotoStats.tsx",
    "components/photo/PhotoDetailDialog.tsx",
    "components/photo/PhotographerInfo.tsx",
    "components/photo/DownloadButton.tsx",
    "components/ImagePreviewModal.tsx",
  ]

  for (const relativePath of taskFiles) {
    assertUsesShadcnButton(relativePath)
    for (const tag of openingTags(readSource(relativePath), "Spinner")) {
      assert.match(tag, /aria-label="加载中"/, `${relativePath}: ${tag}`)
    }
  }

  assertMarkedNativeSurfaces("pages/AccountDetailPage.tsx", 2)
  assertMarkedNativeSurfaces("components/post/PostComposerDialog.tsx", 0)
  assertMarkedNativeSurfaces("components/post/PostImageAttach.tsx", 1)
  assertMarkedNativeSurfaces("components/post/PostCard.tsx", 0)
  assertMarkedNativeSurfaces("components/post/PostVisibilityMenu.tsx", 1)
  assertMarkedNativeSurfaces("components/upload/UploadDialog.tsx", 0)
  assertMarkedNativeSurfaces("components/photo/PhotoStats.tsx", 0)
  assertMarkedNativeSurfaces("components/photo/PhotoDetailDialog.tsx", 0)
  assertMarkedNativeSurfaces("components/ImagePreviewModal.tsx", 0)

  const upload = readSource("components/upload/UploadDialog.tsx")
  assert.match(
    upload,
    /data-slot="interactive-surface"\s+role="button"|role="button"\s+data-slot="interactive-surface"/
  )
})

test("admin actions use Button and admin rows remain registered surfaces", () => {
  const taskFiles = [
    "components/admin/AdminHomepagePanel.tsx",
    "components/admin/AdminDashboardPanel.tsx",
    "components/admin/AdminForumModerationPanel.tsx",
    "components/admin/AdminReportsPanel.tsx",
    "components/admin/AdminContentModerationPanel.tsx",
    "components/admin/AdminTagManagementPanel.tsx",
    "components/admin/AdminAuditPanel.tsx",
    "components/admin/MediaPickerDialog.tsx",
    "components/admin/AdminMediaReviewPanel.tsx",
  ]

  for (const relativePath of taskFiles) {
    assertUsesShadcnButton(relativePath)
    for (const tag of openingTags(readSource(relativePath), "Spinner")) {
      assert.match(tag, /aria-label="加载中"/, `${relativePath}: ${tag}`)
    }
  }

  assertMarkedNativeSurfaces("components/admin/AdminHomepagePanel.tsx", 0)
  assertMarkedNativeSurfaces("components/admin/AdminDashboardPanel.tsx", 3)
  assertMarkedNativeSurfaces("components/admin/AdminForumModerationPanel.tsx", 1)
  assertMarkedNativeSurfaces("components/admin/AdminReportsPanel.tsx", 1)
  assertMarkedNativeSurfaces("components/admin/AdminContentModerationPanel.tsx", 3)
  assertMarkedNativeSurfaces("components/admin/AdminTagManagementPanel.tsx", 1)
  assertMarkedNativeSurfaces("components/admin/AdminAuditPanel.tsx", 1)
  assertMarkedNativeSurfaces("components/admin/MediaPickerDialog.tsx", 1)
  assertMarkedNativeSurfaces("components/admin/AdminMediaReviewPanel.tsx", 0)

  const audit = readSource("components/admin/AdminAuditPanel.tsx")
  assert.match(
    audit,
    /if \(queueLoadLogsRef\.current\) return;\s+setLogs\(/,
    "queued audit refresh must discard an obsolete successful response before committing logs"
  )
  assert.match(
    audit,
    /catch \(error\) \{\s+if \(queueLoadLogsRef\.current\) return;\s+setListError\(/,
    "queued audit refresh must discard an obsolete failed response before committing the error"
  )
  assert.match(
    audit,
    /finally \{\s+loadLogsInFlightRef\.current = false;\s+if \(queueLoadLogsRef\.current\) \{\s+queueLoadLogsRef\.current = false;\s+setListRequestVersion\(\(current\) => current \+ 1\);\s+\} else \{\s+setListLoading\(false\);\s+\}\s+\}/,
    "queued audit refresh must keep loading active until the latest request finishes"
  )
  assert.match(
    audit,
    /if \(listLoading\) return;\s+if \(logs\.length === 0\)/,
    "audit selection reconciliation must wait for the final list"
  )
  assert.match(
    audit,
    /if \(!logs\.some\(\(log\) => log\.id === selectedId\)\) \{\s+onSelectedIdChange\(logs\[0\]\.id\);/,
    "audit selection reconciliation must keep only IDs present in the latest list"
  )

  assertBusyButtons(
    "components/admin/AdminAuditPanel.tsx",
    "onClick={() => void loadLogs()}",
    "listLoading",
    2
  )
  assertBusyButtons(
    "components/admin/AdminContentModerationPanel.tsx",
    "onClick={() => void loadContent()}",
    "loading",
    2
  )
  assertBusyButtons(
    "components/admin/AdminReportsPanel.tsx",
    "onClick={() => void loadReports()}",
    "listLoading",
    2
  )
  assertBusyButtons(
    "components/admin/AdminTagManagementPanel.tsx",
    "onClick={() => void loadTags()}",
    "loading",
    2
  )
  assertBusyButtons(
    "components/admin/AdminForumModerationPanel.tsx",
    'onClick={() => void loadPosts("reset")}',
    "loading",
    2
  )
  assertBusyButtons(
    "components/admin/AdminDashboardPanel.tsx",
    "onClick={refreshAll}",
    "refreshBusy",
    1
  )

  for (const relativePath of [
    "components/admin/AdminAuditPanel.tsx",
    "components/admin/AdminContentModerationPanel.tsx",
    "components/admin/AdminReportsPanel.tsx",
    "components/admin/AdminTagManagementPanel.tsx",
    "components/admin/AdminForumModerationPanel.tsx",
    "components/admin/AdminDashboardPanel.tsx",
  ]) {
    const source = readSource(relativePath)
    assert.match(source, /const \w+InFlightRef = useRef\(false\);/, relativePath)
    assert.match(source, /if \(\w+InFlightRef\.current\)/, relativePath)
  }
  assertBusyButtons(
    "components/admin/AdminDashboardPanel.tsx",
    "onClick={() => void loadDashboard()}",
    "dashboardLoading",
    1
  )
  assertBusyButtons(
    "components/admin/AdminDashboardPanel.tsx",
    "onClick={() => void loadRecentLogs()}",
    "logsLoading",
    1
  )

  const homepage = readSource("components/admin/AdminHomepagePanel.tsx")
  const homepageButtons = elementBlocks(homepage, "Button")
  const removeFeatured = homepageButtons.find((block) => block.includes("移出精选"))
  assert.ok(removeFeatured)
  assert.match(homepage, /className="dark flex shrink-0 items-center gap-1"/)
  assert.match(openingTags(removeFeatured, "Button")[0], /variant="destructive"/)

  const forum = readSource("components/admin/AdminForumModerationPanel.tsx")
  const forumAction = elementBlocks(forum, "Button").find((block) =>
    block.includes("解锁帖子")
  )
  assert.ok(forumAction)
  assert.match(openingTags(forumAction, "Button")[0], /variant="outline"/)

  const reports = readSource("components/admin/AdminReportsPanel.tsx")
  const resolveReport = elementBlocks(reports, "Button").find((block) =>
    block.includes("提交处理结果")
  )
  assert.ok(resolveReport)
  assert.doesNotMatch(openingTags(resolveReport, "Button")[0], /variant=/)

  const content = readSource("components/admin/AdminContentModerationPanel.tsx")
  const moderateContent = elementBlocks(content, "Button").find((block) =>
    block.includes("恢复内容")
  )
  assert.ok(moderateContent)
  assert.match(
    openingTags(moderateContent, "Button")[0],
    /variant=\{selected\.status === "hidden" \? "outline" : "destructive"\}/
  )

  const tags = readSource("components/admin/AdminTagManagementPanel.tsx")
  const mergeTag = elementBlocks(tags, "Button").find((block) =>
    block.includes("确认合并")
  )
  assert.ok(mergeTag)
  assert.match(openingTags(mergeTag, "Button")[0], /variant="destructive"/)

  const mediaPicker = readSource("components/admin/MediaPickerDialog.tsx")
  const clearSearch = elementBlocks(mediaPicker, "Button").find((block) =>
    block.includes('aria-label="清空搜索"')
  )
  assert.ok(clearSearch)
  const clearSearchTag = openingTags(clearSearch, "Button")[0]
  assert.match(clearSearchTag, /variant="ghost"/)
  assert.match(clearSearchTag, /size="icon-sm"/)
  assert.match(clearSearchTag, /inset-y-0/)
  assert.match(clearSearchTag, /my-auto/)
  assert.doesNotMatch(clearSearchTag, /translate-y/)

  const mediaReview = readSource("components/admin/AdminMediaReviewPanel.tsx")
  assert.match(mediaReview, /type PendingReview = \{\s*id: string;\s*action: "approved" \| "rejected";\s*\};/)
  assert.match(mediaReview, /useState<PendingReview \| null>\(null\)/)
  assert.match(mediaReview, /const reviewInFlightRef = useRef\(false\);/)
  assert.match(mediaReview, /if \(reviewInFlightRef\.current\) return;/)
  const approve = elementBlocks(mediaReview, "Button").find((block) =>
    block.includes('handleReviewMedia(asset, "approved")')
  )
  const reject = elementBlocks(mediaReview, "Button").find((block) =>
    block.includes('handleReviewMedia(asset, "rejected")')
  )
  assert.ok(approve)
  assert.ok(reject)
  assert.match(openingTags(approve, "Button")[0], /disabled=\{pendingReview !== null\}/)
  assert.match(openingTags(approve, "Button")[0], /aria-busy=\{approving\}/)
  assert.match(approve, /\{approving \? \([\s\S]*<Spinner aria-label="加载中" \/>/)
  assert.doesNotMatch(openingTags(approve, "Button")[0], /variant=/)
  assert.match(openingTags(reject, "Button")[0], /disabled=\{pendingReview !== null\}/)
  assert.match(openingTags(reject, "Button")[0], /aria-busy=\{rejecting\}/)
  assert.match(reject, /\{rejecting \? \([\s\S]*<Spinner aria-label="加载中" \/>/)
  assert.match(openingTags(reject, "Button")[0], /variant="destructive"/)
})
