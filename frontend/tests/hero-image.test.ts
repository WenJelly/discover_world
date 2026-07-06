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

test("hero uses homepage admin config before falling back to latest media", async () => {
  const source = await readFile(
    new URL("../src/components/home/Hero.tsx", import.meta.url),
    "utf8"
  );

  assert.match(source, /fetchHomepageConfig/);
  assert.match(source, /config\.hero\.media/);
  assert.match(source, /fetchMediaAssetCursorList/);
  assert.match(source, /objectPosition:\s*`\$\{heroPhoto\.focalX\}% \$\{heroPhoto\.focalY\}%`/);
});

test("hero does not hide a cached image after its load event fires", async () => {
  const source = await readFile(
    new URL("../src/components/home/Hero.tsx", import.meta.url),
    "utf8"
  );

  assert.doesNotMatch(source, /useEffect\(\(\)\s*=>\s*{\s*setLoaded\(false\);\s*},\s*\[bgUrl\]\);/);
  assert.match(source, /const handleHeroImageRef/);
  assert.match(source, /node\.complete && node\.naturalWidth > 0/);
  assert.match(source, /ref=\{handleHeroImageRef\}/);
});
