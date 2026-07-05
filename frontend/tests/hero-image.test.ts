import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("hero image is framed slightly above center", async () => {
  const source = await readFile(
    new URL("../src/components/home/Hero.tsx", import.meta.url),
    "utf8"
  );

  assert.match(source, /object-cover object-\[center_58%\]/);
});
