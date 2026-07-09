import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageUrl = new URL("../src/pages/DiscoverPage.tsx", import.meta.url);
const oldPageUrl = new URL("../src/pages/PublicGalleryPage.tsx", import.meta.url);
const libUrl = new URL("../src/lib/discover.ts", import.meta.url);
const oldLibUrl = new URL("../src/lib/public-discover.ts", import.meta.url);
const cardUrl = new URL(
  "../src/components/discover/DiscoverPictureCard.tsx",
  import.meta.url
);
const oldCardUrl = new URL(
  "../src/components/public/PublicPictureCard.tsx",
  import.meta.url
);

test("discover page uses discover route and keeps public route compatibility", async () => {
  assert.equal(existsSync(pageUrl), true);
  assert.equal(existsSync(oldPageUrl), false);

  const appLayout = await readFile(
    new URL("../src/app/AppLayout.tsx", import.meta.url),
    "utf8"
  );

  assert.match(appLayout, /import DiscoverPage from "@\/pages\/DiscoverPage"/);
  assert.match(appLayout, /pathname === "\/discover"/);
  assert.match(appLayout, /pathname === "\/public"/);
  assert.match(appLayout, /<DiscoverPage \/>/);
});

test("app layout moves focus to main content after route changes", async () => {
  const appLayout = await readFile(
    new URL("../src/app/AppLayout.tsx", import.meta.url),
    "utf8"
  );

  assert.match(appLayout, /const mainRef = useRef<HTMLElement>\(null\)/);
  assert.match(appLayout, /mainRef\.current\?\.focus\(\{\s*preventScroll:\s*true\s*\}\)/);
  assert.match(appLayout, /window\.requestAnimationFrame\(focusMainContent\)/);
  assert.match(appLayout, /<main[^>]*ref=\{mainRef\}[^>]*tabIndex=\{-1\}/s);
  assert.match(appLayout, /aria-live="polite"/);
});

test("discover code is named around discover instead of public gallery", async () => {
  assert.equal(existsSync(libUrl), true);
  assert.equal(existsSync(oldLibUrl), false);
  assert.equal(existsSync(cardUrl), true);
  assert.equal(existsSync(oldCardUrl), false);

  const discoverPage = await readFile(pageUrl, "utf8");
  const discoverCard = await readFile(cardUrl, "utf8");
  const css = await readFile(new URL("../src/index.css", import.meta.url), "utf8");

  assert.match(discoverPage, /export default function DiscoverPage/);
  assert.match(discoverPage, /DiscoverPictureCard/);
  assert.match(discoverPage, /"@\/lib\/discover"/);
  assert.match(discoverPage, /return `\/discover\$\{query\}`/);
  assert.doesNotMatch(discoverPage, /PublicGalleryPage|PublicPictureCard|public-discover/);

  assert.match(discoverCard, /type DiscoverPictureCardProps/);
  assert.match(discoverCard, /export const DiscoverPictureCard/);
  assert.match(discoverCard, /discover-tile/);
  assert.doesNotMatch(discoverCard, /PublicPictureCard|public-discover-tile/);

  assert.match(css, /\.discover-page/);
  assert.match(css, /\.discover-page \.discover-toolbar/);
  assert.doesNotMatch(css, /\.public-discover-page|\.public-discover-tile/);
});

test("navbar exposes discover and stays opaque white", async () => {
  const navbar = await readFile(
    new URL("../src/components/Navbar.tsx", import.meta.url),
    "utf8"
  );

  assert.match(navbar, /name: "发现",\s*href: "\/discover"/);
  assert.doesNotMatch(navbar, /name: "公开",\s*href: "\/public"/);
  assert.match(navbar, /const searchUrl = `\/search\?q=/);
  assert.match(navbar, /border-b border-slate-200\/60 bg-white/);
  const headerClass = navbar.match(/<header\s+className=\{`([\s\S]*?)`\}/)?.[1] ?? "";
  assert.doesNotMatch(headerClass, /\bshadow-[^\s`]+/);
  assert.doesNotMatch(navbar, /border-transparent bg-transparent|bg-white\/75|backdrop-blur-xl/);
});

test("discover route lets the main navbar scroll in normal document flow", async () => {
  const appLayout = await readFile(
    new URL("../src/app/AppLayout.tsx", import.meta.url),
    "utf8"
  );
  const navbar = await readFile(
    new URL("../src/components/Navbar.tsx", import.meta.url),
    "utf8"
  );

  assert.match(appLayout, /<Navbar fixed=\{!isDiscoverRoute && !isLegacyPublicRoute\} \/>/);
  assert.match(navbar, /type NavbarProps = \{\s*fixed\?: boolean;/s);
  assert.match(navbar, /fixed = true/);
  assert.match(navbar, /fixed \? "fixed top-0 left-0 right-0" : "relative"/);
});

test("navbar routes home directly and removes guide/share entries", async () => {
  const navbar = await readFile(
    new URL("../src/components/Navbar.tsx", import.meta.url),
    "utf8"
  );

  assert.match(navbar, /name: "首页",\s*href: "\/"/);
  assert.doesNotMatch(navbar, /name: "产品功能"/);
  assert.doesNotMatch(navbar, /children:\s*\[/);
  assert.doesNotMatch(navbar, /智能自动化 Pipeline|实时监控看板/);
  assert.doesNotMatch(navbar, /旅游攻略|心得分享|攻略、心得/);
  assert.doesNotMatch(navbar, /href: "\/#architecture"|href: "\/#pricing"/);
});

test("discover toolbar becomes sticky only after the main navbar scrolls away", async () => {
  const discoverPage = await readFile(pageUrl, "utf8");
  const css = await readFile(new URL("../src/index.css", import.meta.url), "utf8");

  assert.match(discoverPage, /shouldPinDiscoverToolbar/);
  assert.match(discoverPage, /discover-page--toolbar-pinned/);
  assert.doesNotMatch(discoverPage, /discover-page--site-nav-hidden/);
  assert.match(
    css,
    /\.discover-page\s*\{(?<styles>[^}]*)\}/s
  );
  const pageStyles = css.match(/\.discover-page\s*\{(?<styles>[^}]*)\}/s)
    ?.groups?.styles ?? "";
  assert.doesNotMatch(pageStyles, /padding-top:\s*4rem/);

  const toolbarStyles =
    css.match(/\.discover-page \.discover-toolbar\s*\{(?<styles>[^}]*)\}/)
      ?.groups?.styles ?? "";
  assert.match(toolbarStyles, /position:\s*static;/);
  assert.doesNotMatch(toolbarStyles, /position:\s*sticky;/);

  assert.match(
    css,
    /\.discover-page--toolbar-pinned \.discover-toolbar\s*\{[^}]*position:\s*sticky;[^}]*top:\s*0;/s
  );
});

test("discover toolbar stays opaque white like the reference site", async () => {
  const css = await readFile(new URL("../src/index.css", import.meta.url), "utf8");

  assert.match(
    css,
    /\.discover-page \.discover-toolbar\s*\{[^}]*background:\s*#fff;/s
  );
  assert.doesNotMatch(
    css,
    /\.discover-page \.discover-toolbar\s*\{[^}]*backdrop-filter:/s
  );
  assert.match(
    css,
    /\.discover-page--toolbar-pinned \.discover-toolbar\s*\{[^}]*top:\s*0;/s
  );
});

test("discover toolbar filters do not render caret arrows", async () => {
  const discoverPage = await readFile(pageUrl, "utf8");
  const css = await readFile(new URL("../src/index.css", import.meta.url), "utf8");

  assert.doesNotMatch(discoverPage, /className="arrow"/);
  assert.doesNotMatch(css, /\.discover-page \.arrow/);
});

test("discover toolbar controls stay visible on every tab and use quiet layout icons", async () => {
  const discoverPage = await readFile(pageUrl, "utf8");
  const css = await readFile(new URL("../src/index.css", import.meta.url), "utf8");

  assert.doesNotMatch(discoverPage, /canShowQueryBar/);
  assert.match(discoverPage, /GalleryHorizontal/);
  assert.match(discoverPage, /Grid2X2/);
  assert.match(discoverPage, /<Icon size=\{18\} strokeWidth=\{2\} aria-hidden="true" \/>/);
  assert.doesNotMatch(discoverPage, /Rows3|LayoutGrid/);

  const switchStyles =
    css.match(/\.discover-page \.discover-layout-switch\s*\{(?<styles>[^}]*)\}/)
      ?.groups?.styles ?? "";
  assert.doesNotMatch(switchStyles, /\bborder\s*:/);
  assert.match(switchStyles, /\bgap:\s*2px;/);
  assert.doesNotMatch(switchStyles, /\bbackground\s*:/);
  const activeButtonStyles =
    css.match(
      /\.discover-page \.discover-layout-switch__button:hover,\s*\.discover-page \.discover-layout-switch__button\.selected\s*\{(?<styles>[^}]*)\}/
    )?.groups?.styles ?? "";
  assert.doesNotMatch(activeButtonStyles, /\bbackground(?:-color)?\s*:/);
  assert.match(
    css,
    /\.discover-page \.px_tabs a\s*\{[^}]*font-weight:\s*700;/s
  );
});

test("discover toolbar controls align to the gallery content edge", async () => {
  const css = await readFile(new URL("../src/index.css", import.meta.url), "utf8");

  const pageStyles = css.match(/\.discover-page\s*\{(?<styles>[^}]*)\}/s)
    ?.groups?.styles ?? "";
  const toolbarInnerStyles =
    css.match(/\.discover-page \.discover-toolbar__inner\s*\{(?<styles>[^}]*)\}/)
      ?.groups?.styles ?? "";
  const leftNavigationStyles =
    css.match(/\.discover-page \.discover_layout_navigation\s*\{(?<styles>[^}]*)\}/)
      ?.groups?.styles ?? "";
  const rightNavigationStyles =
    css.match(/\.discover-page \.discover-filter-navigation\s*\{(?<styles>[^}]*)\}/)
      ?.groups?.styles ?? "";
  const photoGridStyles =
    css.match(/\.discover-page \.photo_grid_region\s*\{(?<styles>[^}]*)\}/)
      ?.groups?.styles ?? "";

  assert.match(pageStyles, /--discover-content-edge:\s*40px;/);
  assert.match(toolbarInnerStyles, /padding:\s*0 var\(--discover-content-edge\);/);
  assert.match(leftNavigationStyles, /left:\s*var\(--discover-content-edge\);/);
  assert.match(rightNavigationStyles, /right:\s*var\(--discover-content-edge\);/);
  assert.match(
    photoGridStyles,
    /padding:\s*20px var\(--discover-content-edge\) 56px;/
  );
  assert.match(
    css,
    /@media only screen and \(max-width: 1024px\)\s*\{[\s\S]*?\.discover-page\s*\{[^}]*--discover-content-edge:\s*20px;/
  );
  assert.match(
    css,
    /@media only screen and \(max-width: 720px\)\s*\{[\s\S]*?\.discover-page\s*\{[^}]*--discover-content-edge:\s*5px;/
  );
});

test("discover category filters are sent to cursor requests before local filtering", async () => {
  const discoverPage = await readFile(pageUrl, "utf8");
  const discoverLib = await readFile(libUrl, "utf8");

  assert.match(discoverLib, /export function getDiscoverCategoryQuery/);
  assert.match(discoverPage, /getDiscoverCategoryQuery/);
  assert.match(discoverPage, /const discoverCategoryQuery = useMemo/);
  assert.match(discoverPage, /category:\s*discoverCategoryQuery/);
});

test("discover hot feed is requested from the backend and refreshed only by toolbar clicks", async () => {
  const discoverPage = await readFile(pageUrl, "utf8");
  const hook = await readFile(
    new URL("../src/hooks/useInfinitePictures.ts", import.meta.url),
    "utf8"
  );
  const types = await readFile(new URL("../src/lib/types.ts", import.meta.url), "utf8");

  assert.match(discoverPage, /const discoverMediaSort = useMemo/);
  assert.match(discoverPage, /sort:\s*discoverMediaSort/);
  assert.match(discoverPage, /const \[discoverRefreshKey, setDiscoverRefreshKey\]/);
  assert.match(discoverPage, /refreshKey:\s*discoverRefreshKey/);
  assert.match(discoverPage, /setDiscoverRefreshKey\(\(value\) => value \+ 1\)/);

  assert.match(hook, /sort\?: string/);
  assert.match(hook, /refreshKey\?: number/);
  assert.match(hook, /sort,\s*$/m);
  assert.match(types, /sort\?: string/);
});

test("discover fresh feed is requested by creation time", async () => {
  const discoverPage = await readFile(pageUrl, "utf8");

  assert.match(discoverPage, /discoverState\.tab === "fresh"[\s\S]*return "created"/);
});

test("discover rising feed is requested from the backend", async () => {
  const discoverPage = await readFile(pageUrl, "utf8");

  assert.match(discoverPage, /discoverState\.tab === "upcoming"[\s\S]*return "rising"/);
});

test("discover preview is anchored by asset id when detail updates resort the list", async () => {
  const discoverPage = await readFile(pageUrl, "utf8");
  const discoverLib = await readFile(libUrl, "utf8");

  assert.match(discoverLib, /export function resolveDiscoverPreviewIndex/);
  assert.match(discoverPage, /const \[activePictureId, setActivePictureId\]/);
  assert.match(
    discoverPage,
    /const activeIndex = useMemo\(\s*\(\) =>\s*resolveDiscoverPreviewIndex\(filteredPictures, activePictureId\)/s
  );
  assert.match(discoverPage, /const handleOpenPicture = \(picture: MediaAssetResponse\) => \{\s*setActivePictureId\(picture\.id\);/s);
  assert.match(discoverPage, /onOpen=\{handleOpenPicture\}/);
  assert.doesNotMatch(discoverPage, /const \[previewIndex, setPreviewIndex\]/);
});

test("discover metadata overlay stays hover-only and is hidden behind detail preview", async () => {
  const discoverPage = await readFile(pageUrl, "utf8");
  const css = await readFile(new URL("../src/index.css", import.meta.url), "utf8");

  assert.match(discoverPage, /discover-page--preview-open/);
  assert.match(
    css,
    /@media\s*\(\s*hover:\s*hover\s*\)\s*and\s*\(\s*pointer:\s*fine\s*\)\s*\{[\s\S]*\.discover-page \.discover-tile:hover \.info/s
  );
  assert.doesNotMatch(css, /\.discover-page \.discover-tile:focus-within \.info/);
  assert.doesNotMatch(css, /\.discover-page \.discover-tile:focus-within img/);
  assert.match(css, /\.discover-page \.photo_link:focus-visible \+ \.info/);
  assert.doesNotMatch(
    css,
    /@media only screen and \(max-width: 720px\)\s*\{[\s\S]*?\.discover-page \.info\s*\{[\s\S]*?opacity:\s*1;[\s\S]*?\}/s
  );
  assert.match(
    css,
    /\.discover-page--preview-open \.discover-tile \.info\s*\{[\s\S]*?opacity:\s*0;/s
  );
});
