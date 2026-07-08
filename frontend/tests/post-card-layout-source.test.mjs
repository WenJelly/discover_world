import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("post card renders profile dynamic metadata and bottom action layout", async () => {
  const source = await readFile(
    new URL("../src/components/post/PostCard.tsx", import.meta.url),
    "utf8"
  );

  assert.doesNotMatch(source, /IP：中国/);
  assert.match(source, /<header className="flex items-center gap-3">/);
  assert.match(
    source,
    /data-testid="post-ip-region"[\s\S]*<MapPin className="size-3\.5 shrink-0" aria-hidden="true" \/>[\s\S]*<span>中国<\/span>/
  );
  assert.match(source, /上海/);
  assert.match(
    source,
    /const likedByNames = likedBy/
  );
  assert.match(source, /\{likedByNames\} 点赞了/);

  assert.match(source, /data-testid="post-action-row"/);
  assert.match(source, /data-testid="post-reactions"/);
  assert.match(source, /data-testid="post-right-actions"/);
  assert.match(
    source,
    /data-testid="post-management-actions"[\s\S]*aria-label="修改动态可见范围"[\s\S]*aria-label="删除动态"[\s\S]*<\/div>[\s\S]*\{ipRegion\}/
  );
  assert.doesNotMatch(source, /data-testid="post-visitor-actions"/);
  assert.match(source, /aria-label="删除动态"[\s\S]*<Trash2[\s\S]*删除/);
  assert.doesNotMatch(source, /<select[\s\S]*aria-label="修改动态可见范围"/);
  assert.match(source, /aria-label="修改动态可见范围"[\s\S]*aria-expanded=\{visibilityMenuOpen\}/);
  assert.match(source, /const visibilityMenuRef = useRef<HTMLDivElement \| null>\(null\)/);
  assert.match(source, /document\.addEventListener\("pointerdown", handlePointerDown\)/);
  assert.match(source, /document\.addEventListener\("keydown", handleKeyDown\)/);
  assert.match(source, /className="absolute right-0 top-full[\s\S]*mt-1/);
  assert.doesNotMatch(source, /className="absolute bottom-full/);

  assert.doesNotMatch(
    source,
    /function PostImageGrid[\s\S]*rounded-md[\s\S]*function normalizePostVisibilityValue/
  );
});
