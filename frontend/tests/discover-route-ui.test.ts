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

test("discover scroll hides only the main navbar and keeps toolbar visible", async () => {
  const navbar = await readFile(
    new URL("../src/components/Navbar.tsx", import.meta.url),
    "utf8"
  );
  const discoverPage = await readFile(pageUrl, "utf8");
  const css = await readFile(new URL("../src/index.css", import.meta.url), "utf8");

  assert.match(navbar, /DISCOVER_NAVBAR_VISIBILITY_EVENT/);
  assert.match(navbar, /-translate-y-full/);
  assert.doesNotMatch(
    navbar,
    /fixed top-0 left-0 right-0 z-50[^`]*transition-transform[^`]*duration-\d+/s
  );
  assert.match(discoverPage, /DISCOVER_NAVBAR_VISIBILITY_EVENT/);
  assert.match(discoverPage, /discover-page--site-nav-hidden/);
  assert.match(css, /\.discover-page--site-nav-hidden \.discover-toolbar/);
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
    /\.discover-page--site-nav-hidden \.discover-toolbar\s*\{[^}]*top:\s*0;/s
  );
});

test("discover toolbar filters do not render caret arrows", async () => {
  const discoverPage = await readFile(pageUrl, "utf8");
  const css = await readFile(new URL("../src/index.css", import.meta.url), "utf8");

  assert.doesNotMatch(discoverPage, /className="arrow"/);
  assert.doesNotMatch(css, /\.discover-page \.arrow/);
});
