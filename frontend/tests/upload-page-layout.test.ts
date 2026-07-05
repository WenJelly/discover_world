import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("upload page content starts below the fixed navbar", async () => {
  const source = await readFile(
    new URL("../src/pages/UploadPage.tsx", import.meta.url),
    "utf8"
  );

  assert.match(source, /className="min-h-screen bg-background pt-16"/);
  assert.match(
    source,
    /className="flex min-h-\[80vh\] items-center justify-center bg-background px-4 pt-16"/
  );
});
