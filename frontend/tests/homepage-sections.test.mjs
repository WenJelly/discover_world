import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

test("AppLayout imports all seven homepage sections", async () => {
  const src = await readFile(
    path.join(rootDir, "src/app/AppLayout.tsx"),
    "utf8"
  );
  assert.match(src, new RegExp('from "@/components/home/Hero"'));
  assert.match(src, new RegExp('from "@/components/home/InfiniteGallery"'));
  assert.match(src, new RegExp('from "@/components/home/Features"'));
  assert.match(src, new RegExp('from "@/components/home/CategoryExplorer"'));
  assert.match(src, new RegExp('from "@/components/home/Stats"'));
  assert.match(src, new RegExp('from "@/components/home/CTA"'));
  assert.match(src, new RegExp('from "@/components/Footer"'));
});

test("AppLayout renders Navbar and all sections in order", async () => {
  const src = await readFile(
    path.join(rootDir, "src/app/AppLayout.tsx"),
    "utf8"
  );
  assert.match(
    src,
    new RegExp(
      "<Navbar[\\s\\S]*?<Hero[\\s\\S]*?<InfiniteGallery[\\s\\S]*?<Features[\\s\\S]*?<CategoryExplorer[\\s\\S]*?<Stats[\\s\\S]*?<CTA[\\s\\S]*?<Footer"
    )
  );
});
