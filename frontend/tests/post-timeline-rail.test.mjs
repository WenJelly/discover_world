import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("post timeline rail is centered on its date and post nodes", async () => {
  const source = await readFile(
    new URL("../src/components/post/PostTimeline.tsx", import.meta.url),
    "utf8"
  );

  assert.match(
    source,
    /className="[^"]*left-4[^"]*-translate-x-1\/2[^"]*w-px[^"]*bg-border[^"]*"/
  );
  assert.match(
    source,
    /className="[^"]*left-4[^"]*size-2\.5[^"]*-translate-x-1\/2[^"]*rounded-full/
  );
  assert.match(
    source,
    /className="[^"]*left-4[^"]*size-1\.5[^"]*-translate-x-1\/2[^"]*rounded-full/
  );
});
