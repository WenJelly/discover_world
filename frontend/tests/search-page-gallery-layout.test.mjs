import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSearchSources() {
  const [page, css] = await Promise.all([
    readFile(new URL("../src/pages/SearchPage.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/index.css", import.meta.url), "utf8"),
  ]);

  return { page, css };
}

test("search media results use an asymmetric twelve-column gallery", async () => {
  const { page, css } = await readSearchSources();

  assert.match(page, /function getMediaCardVariant/);
  assert.match(page, /search-gallery-grid/);
  assert.match(page, /search-gallery-card--large/);
  assert.match(css, /\.search-gallery-grid\s*\{/);
  assert.match(css, /grid-template-columns:\s*repeat\(12,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /\.search-gallery-card\s*\{[\s\S]*grid-column:\s*span 3/);
  assert.match(css, /\.search-gallery-card--large\s*\{[\s\S]*grid-column:\s*span 6/);
  assert.match(css, /aspect-ratio:\s*4\s*\/\s*3/);
  assert.match(css, /aspect-ratio:\s*16\s*\/\s*9/);
});

test("search page uses neutral text tabs instead of saturated pill tabs", async () => {
  const { page } = await readSearchSources();

  assert.match(page, /className=\{`search-group-tab/);
  assert.doesNotMatch(page, /bg-rose-600\s+text-white/);
  assert.doesNotMatch(page, /border-2\s+border-slate-200/);
});

test("search page main input uses a gray interior", async () => {
  const { css } = await readSearchSources();

  assert.match(css, /\.search-main-input\s*\{[^}]*background:\s*oklch\(0\.94/);
  assert.doesNotMatch(css, /\.search-main-input\s*\{[^}]*background:\s*oklch\(0\.998/);
});
