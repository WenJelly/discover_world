import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("community public feed exposes post type filter", async () => {
  const source = await readFile(
    new URL("../src/pages/CommunityPage.tsx", import.meta.url),
    "utf8"
  );

  assert.match(source, /POST_TYPE_FILTER_OPTIONS/);
  assert.match(source, /publicPostType,\s*setPublicPostType/);
  assert.match(source, /aria-label="动态类型筛选"/);
  assert.match(source, /postType:\s*publicPostType === "all" \? undefined : publicPostType/);
  assert.match(source, /\[publicCursor, publicPostType, publicSearchText, publicSort, toast\]/);
});
