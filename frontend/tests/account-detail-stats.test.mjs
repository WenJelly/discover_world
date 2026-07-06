import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("account detail uses stable backend media count instead of loaded picture page length", async () => {
  const source = await readFile(
    new URL("../src/pages/AccountDetailPage.tsx", import.meta.url),
    "utf8"
  );

  assert.match(source, /label:\s*"作品",\s*value:\s*profile\.imageCount/);
  assert.doesNotMatch(source, /label:\s*"作品",\s*value:\s*pictures\.length/);
});

test("account detail shows a yellow admin verification badge after nickname", async () => {
  const source = await readFile(
    new URL("../src/pages/AccountDetailPage.tsx", import.meta.url),
    "utf8"
  );

  assert.match(source, /BadgeCheck/);
  assert.match(source, /profile\.role\s*===\s*"admin"/);
  assert.match(source, /aria-label="管理员认证"/);
  assert.match(source, /<BadgeCheck[\s\S]*?\/>\s*<span[^>]*>\s*管理员\s*<\/span>/);
  assert.match(source, /text-yellow-500/);
});
