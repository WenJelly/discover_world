import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("profile post pin changes silently refresh the current account timeline", async () => {
  const [cardSource, timelineSource, accountSource] = await Promise.all([
    source("../src/components/post/PostCard.tsx"),
    source("../src/components/post/PostTimeline.tsx"),
    source("../src/pages/AccountDetailPage.tsx"),
  ]);

  assert.match(cardSource, /onPinChanged\?: \(post: ProfilePostResponse\) => void/);
  assert.match(cardSource, /onPinChanged\?\.\(updated\)/);

  assert.match(timelineSource, /onPinChanged\?: \(post: ProfilePostResponse\) => void/);
  assert.match(timelineSource, /onPinChanged=\{onPinChanged\}/);

  assert.match(accountSource, /type LoadPostsOptions = \{\s*silent\?: boolean;\s*\}/);
  assert.match(accountSource, /async \(reset = false, options: LoadPostsOptions = \{\}\)/);
  assert.match(accountSource, /if \(reset && !options\.silent\) \{/);
  assert.match(accountSource, /if \(reset && !options\.silent\) \{\s*setPosts\(\[\]\);/);
  assert.match(accountSource, /const handlePostPinChanged = \(post: ProfilePostResponse\) => \{/);
  assert.match(accountSource, /void loadPosts\(true, \{ silent: true \}\)/);
  assert.match(accountSource, /onPinChanged=\{handlePostPinChanged\}/);
});
