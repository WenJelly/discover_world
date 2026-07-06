import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("post image attach uploads media with post asset usage", async () => {
  const source = await readFile(
    new URL("../src/components/post/PostImageAttach.tsx", import.meta.url),
    "utf8"
  );

  assert.match(source, /uploadMediaAsset\(file,\s*\{\s*visibility:\s*"public",\s*assetUsage:\s*"post",\s*\}\)/s);
});
