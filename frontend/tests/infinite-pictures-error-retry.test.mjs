import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const hookUrl = new URL("../src/hooks/useInfinitePictures.ts", import.meta.url);

test("failed infinite picture loads stop sentinel auto retries until manual retry", async () => {
  const hook = await readFile(hookUrl, "utf8");

  assert.match(
    hook,
    /catch \(e\) \{[\s\S]*hasMoreRef\.current = false;[\s\S]*setState\(\(s\) => \(\{ \.\.\.s, hasMore: false, loading: false, error: err \}\)\);[\s\S]*\}/
  );
  assert.match(
    hook,
    /const retry = useCallback\(\(\) => \{[\s\S]*hasMoreRef\.current = true;[\s\S]*setState\(\(s\) => \(\{ \.\.\.s, hasMore: true, error: null \}\)\);[\s\S]*loadMore\(\);[\s\S]*\}, \[loadMore\]\);/
  );
});
