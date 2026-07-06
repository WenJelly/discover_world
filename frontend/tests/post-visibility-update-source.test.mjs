import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("post visibility updates are wired from card to API and account state", async () => {
  const [typesSource, apiSource, cardSource, timelineSource, accountSource] =
    await Promise.all([
      source("../src/lib/types.ts"),
      source("../src/lib/api.ts"),
      source("../src/components/post/PostCard.tsx"),
      source("../src/components/post/PostTimeline.tsx"),
      source("../src/pages/AccountDetailPage.tsx"),
    ]);

  assert.match(typesSource, /export interface UpdatePostRequest/);
  assert.match(apiSource, /UpdatePostRequest/);
  assert.match(apiSource, /export async function updatePost/);
  assert.match(apiSource, /"\/api\/post\/update"/);
  assert.match(apiSource, /return normalizeProfilePost\(resp\)/);

  assert.match(cardSource, /canManage\?: boolean/);
  assert.match(cardSource, /onUpdated\?: \(post: ProfilePostResponse\) => void/);
  assert.match(cardSource, /aria-label="修改动态可见范围"/);
  assert.match(cardSource, /updatePost\(\{/);
  assert.match(cardSource, /id:\s*post\.id/);
  assert.match(cardSource, /visibility:\s*nextVisibility/);
  assert.match(cardSource, /onUpdated\?\.\(updated\)/);

  assert.match(timelineSource, /canManage\?: boolean/);
  assert.match(timelineSource, /onUpdated\?: \(post: ProfilePostResponse\) => void/);
  assert.match(timelineSource, /canManage=\{canManage\}/);
  assert.match(timelineSource, /onUpdated=\{onUpdated\}/);

  assert.match(accountSource, /handlePostUpdated/);
  assert.match(accountSource, /prev\.map\(\(item\) => \(item\.id === post\.id \? post : item\)\)/);
  assert.match(accountSource, /canManage=\{isOwnProfile\}/);
  assert.match(accountSource, /onUpdated=\{handlePostUpdated\}/);
});
