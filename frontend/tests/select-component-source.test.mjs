import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const srcRoot = new URL("../src/", import.meta.url);

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

async function collectSourceFiles(dirUrl) {
  const entries = await readdir(dirUrl, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const childUrl = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, dirUrl);
    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(childUrl)));
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      files.push(childUrl);
    }
  }
  return files;
}

test("shadcn select component replaces native selects", async () => {
  const [selectSource, communitySource, postCardSource] = await Promise.all([
    source("../src/components/ui/select.tsx"),
    source("../src/pages/CommunityPage.tsx"),
    source("../src/components/post/PostCard.tsx"),
  ]);

  assert.match(selectSource, /@base-ui\/react\/select/);
  assert.doesNotMatch(selectSource, /SelectField/);
  assert.match(selectSource, /const Select = SelectPrimitive\.Root/);
  assert.match(selectSource, /function SelectTrigger\(/);
  assert.match(selectSource, /function SelectContent\(/);
  assert.match(selectSource, /function SelectItem\(/);
  assert.match(selectSource, /function SelectValue\(/);
  assert.match(selectSource, /SelectPrimitive\.Portal/);
  assert.match(selectSource, /SelectPrimitive\.Popup/);
  assert.match(selectSource, /SelectPrimitive\.Item/);

  assert.match(
    communitySource,
    /import \{[\s\S]*Select,[\s\S]*SelectContent,[\s\S]*SelectItem,[\s\S]*SelectTrigger,[\s\S]*SelectValue[\s\S]*\} from "@\/components\/ui\/select"/
  );
  assert.match(
    postCardSource,
    /import \{[\s\S]*Select,[\s\S]*SelectContent,[\s\S]*SelectItem,[\s\S]*SelectTrigger,[\s\S]*SelectValue[\s\S]*\} from "@\/components\/ui\/select"/
  );
  assert.doesNotMatch(communitySource, /SelectField/);
  assert.doesNotMatch(postCardSource, /SelectField/);
  assert.match(communitySource, /aria-label="选择论坛分区"/);
  assert.match(communitySource, /aria-label="动态类型筛选"/);
  assert.match(communitySource, /aria-label="公开动态排序"/);
  assert.match(postCardSource, /aria-label="举报原因"/);
  assert.equal(
    (communitySource.match(/alignItemWithTrigger=\{false\}/g) ?? []).length,
    3
  );
  assert.equal(
    (postCardSource.match(/alignItemWithTrigger=\{false\}/g) ?? []).length,
    1
  );
  assert.match(postCardSource, /sideOffset=\{6\}/);

  const files = await collectSourceFiles(srcRoot);
  const offenders = [];
  for (const file of files) {
    const content = await readFile(file, "utf8");
    if (/<\/?(select|option)\b/.test(content)) {
      offenders.push(join("src", file.pathname.split("/src/")[1]));
    }
  }

  assert.deepEqual(offenders, []);
});
