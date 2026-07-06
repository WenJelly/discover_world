import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("navbar submits global searches to the search route", async () => {
  const navbar = await readFile(
    new URL("../src/components/Navbar.tsx", import.meta.url),
    "utf8"
  );

  assert.match(navbar, /const searchUrl = `\/search\?q=/);
  assert.doesNotMatch(navbar, /const searchUrl = `\/discover\?q=/);
  assert.match(navbar, /aria-label="搜索全站内容"/);
});

test("navbar search hides the native clear control and keeps one custom clear button", async () => {
  const navbar = await readFile(
    new URL("../src/components/Navbar.tsx", import.meta.url),
    "utf8"
  );
  const css = await readFile(new URL("../src/index.css", import.meta.url), "utf8");

  assert.match(navbar, /type="search"/);
  assert.match(navbar, /aria-label="清空搜索"/);
  assert.match(navbar, /onClick=\{clearSearch\}/);
  assert.match(css, /input\[type="search"\]::-webkit-search-cancel-button/);
  assert.match(css, /appearance:\s*none/);
});

test("app layout renders the global search page route", async () => {
  const searchPageUrl = new URL("../src/pages/SearchPage.tsx", import.meta.url);
  assert.equal(existsSync(searchPageUrl), true);

  const appLayout = await readFile(
    new URL("../src/app/AppLayout.tsx", import.meta.url),
    "utf8"
  );

  assert.match(appLayout, /import SearchPage from "@\/pages\/SearchPage"/);
  assert.match(appLayout, /pathname === "\/search"/);
  assert.match(appLayout, /<SearchPage \/>/);
});

test("frontend API exposes global search client", async () => {
  const api = await readFile(new URL("../src/lib/api.ts", import.meta.url), "utf8");
  const types = await readFile(new URL("../src/lib/types.ts", import.meta.url), "utf8");

  assert.match(types, /export interface GlobalSearchRequest/);
  assert.match(types, /export interface GlobalSearchResponse/);
  assert.match(api, /export function globalSearch/);
  assert.match(api, /"\/api\/search"/);
});

test("search page switches result groups instead of stacking every group", async () => {
  const searchPage = await readFile(
    new URL("../src/pages/SearchPage.tsx", import.meta.url),
    "utf8"
  );

  assert.match(searchPage, /type SearchGroupKey/);
  assert.match(searchPage, /activeGroup/);
  assert.match(searchPage, /role="tablist"/);
  assert.match(searchPage, /aria-selected=\{activeGroup === group\.key\}/);
  assert.doesNotMatch(
    searchPage,
    /<MediaResults items=\{result\.media\} \/>\s*<PostResults items=\{result\.posts\} \/>\s*<AlbumResults items=\{result\.albums\} \/>\s*<UserResults items=\{result\.users\} \/>/
  );
});

test("search user results link to the selected account profile", async () => {
  const searchPage = await readFile(
    new URL("../src/pages/SearchPage.tsx", import.meta.url),
    "utf8"
  );
  const accountPage = await readFile(
    new URL("../src/pages/AccountDetailPage.tsx", import.meta.url),
    "utf8"
  );

  assert.match(searchPage, /href=\{buildAccountProfileHref\(user\.id\)\}/);
  assert.match(searchPage, /function buildAccountProfileHref/);
  assert.match(accountPage, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(accountPage, /get\("userId"\)/);
});
