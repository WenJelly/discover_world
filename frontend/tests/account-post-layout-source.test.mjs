import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("profile post composer entry aligns with post card inner content", async () => {
  const accountSource = await readFile(
    new URL("../src/pages/AccountDetailPage.tsx", import.meta.url),
    "utf8"
  );
  const postCardSource = await readFile(
    new URL("../src/components/post/PostCard.tsx", import.meta.url),
    "utf8"
  );
  const entrySource =
    accountSource.match(
      /className="mb-6 flex justify-end pr-3 sm:pr-4"[\s\S]*?data-testid="profile-post-composer-entry"[\s\S]*?<\/Button>/
    )?.[0] ?? "";

  assert.match(postCardSource, /<article className="rounded-xl bg-card p-3 sm:p-4">/);
  assert.match(accountSource, /data-testid="profile-post-composer-entry"/);
  assert.notEqual(entrySource, "");
  assert.match(entrySource, /className="rounded-full px-5"/);
  assert.match(entrySource, />\s*有什么新鲜事\?\s*<\/Button>/);
  assert.doesNotMatch(entrySource, /<Send|<img|src="\/logo\.svg"/);
});
