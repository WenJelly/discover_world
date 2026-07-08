import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("post image attach only creates local previews before publish", async () => {
  const source = await readFile(
    new URL("../src/components/post/PostImageAttach.tsx", import.meta.url),
    "utf8"
  );

  assert.doesNotMatch(source, /uploadMediaAsset/);
  assert.match(source, /URL\.createObjectURL\(file\)/);
  assert.match(source, /file,\s*thumbUrl:\s*objectUrl/);
});
