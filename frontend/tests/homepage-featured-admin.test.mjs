import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("homepage gallery prefers admin featured media before latest fallback", async () => {
  const source = await readFile(
    new URL("../src/components/home/InfiniteGallery.tsx", import.meta.url),
    "utf8"
  );

  assert.match(source, /fetchHomepageConfig/);
  assert.match(source, /configuredFeatured/);
  assert.match(source, /configuredFeatured\.length > 0 \? configuredFeatured : pictures/);
  assert.match(source, /由站点管理员精选的公开作品/);
  assert.match(source, /来自社区的最新公开作品/);
});

test("homepage gallery marquee keeps moving after it leaves the viewport", async () => {
  const source = await readFile(
    new URL("../src/components/home/InfiniteGallery.tsx", import.meta.url),
    "utf8"
  );

  assert.doesNotMatch(source, /IntersectionObserver/);
  assert.doesNotMatch(source, /setIsVisible|isVisible/);
  assert.doesNotMatch(
    source,
    /cancelAnimationFrame\(frameRef\.current\)[\s\S]*lastFrameRef\.current = null/
  );
});
