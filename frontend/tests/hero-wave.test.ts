import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  HERO_WAVE_ASPECT_CLASS,
  HERO_WAVE_PATH,
  HERO_WAVE_VIEW_BOX,
} from "../src/lib/hero-wave.ts";

test("hero wave uses the sampled 500px mask geometry", () => {
  assert.equal(HERO_WAVE_VIEW_BOX, "0 0 1920 128");
  assert.equal(HERO_WAVE_ASPECT_CLASS, "aspect-[15/1]");

  assert.match(HERO_WAVE_PATH, /^M0 50 L24 55 L48 61/);
  assert.match(HERO_WAVE_PATH, /L552 126 L576 127 L600 127 L624 127/);
  assert.match(HERO_WAVE_PATH, /L1488 8 L1512 8 L1536 7 L1560 7/);
  assert.match(HERO_WAVE_PATH, /L1872 39 L1896 44 L1919 50 L1920 128 L0 128 Z$/);
});

test("hero wave avoids exposing a straight bottom seam", async () => {
  const source = await readFile(
    new URL("../src/components/home/Hero.tsx", import.meta.url),
    "utf8"
  );

  assert.match(source, /"absolute -bottom-px left-0 right-0 z-\[1\] w-full"/);
  assert.match(source, /className="block h-full w-full"/);
});
