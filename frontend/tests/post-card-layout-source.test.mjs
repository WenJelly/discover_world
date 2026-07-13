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
    /const ipDisplayLocation = post\.ipRegion\?\.displayLocation\?\.trim\(\)/
  );
  assert.match(
    source,
    /ipDisplayLocation \? \([\s\S]*data-testid="post-ip-region"[\s\S]*<MapPin className="size-3\.5 shrink-0" aria-hidden="true" \/>[\s\S]*\{ipDisplayLocation\}/
  );
  assert.doesNotMatch(source, /<span>中国<\/span>|<span>上海<\/span>/);
  assert.doesNotMatch(source, /post\.location|location:\s*post\.location/);
  assert.doesNotMatch(source, /const likedByNames = likedBy/);
  assert.doesNotMatch(source, /点赞了/);

  assert.match(source, /data-testid="post-action-row"/);
  assert.match(
    source,
    /className="flex flex-wrap items-start justify-between gap-2"[\s\S]*data-testid="post-action-row"/
  );
  assert.match(
    source,
    /const footerActionClass =\s*"h-8 gap-1 rounded-md px-2 text-xs font-normal text-muted-foreground"/
  );
  assert.match(
    source,
    /const footerIconActionClass =\s*"size-8 rounded-md text-muted-foreground"/
  );
  assert.doesNotMatch(source, /const actionClass/);
  assert.doesNotMatch(source, /py-1 text-sm text-muted-foreground/);
  assert.match(source, /data-testid="post-reactions"/);
  assert.match(
    source,
    /className="flex min-w-0 items-center gap-0\.5 sm:gap-1"[\s\S]*data-testid="post-reactions"/
  );
  assert.doesNotMatch(source, /size-\[18px\]/);
  assert.match(
    source,
    /<Button[\s\S]*variant="ghost"[\s\S]*size="default"[\s\S]*className=\{cn\(\s*footerActionClass/
  );
  assert.match(source, /<Heart[\s\S]*className=\{cn\("size-4", liked && "fill-current"\)\}/);
  assert.match(source, /<MessageCircle className="size-4" aria-hidden \/>/);
  assert.match(source, /<Bookmark[\s\S]*className=\{cn\("size-4", favorited && "fill-current"\)\}/);

  const reactionsStart = source.indexOf('data-testid="post-reactions"');
  const rightActionsStart = source.indexOf('data-testid="post-right-actions"');
  assert.ok(reactionsStart > 0);
  assert.ok(rightActionsStart > reactionsStart);
  const reactionsSource = source.slice(reactionsStart, rightActionsStart);
  assert.match(reactionsSource, /aria-label="举报动态"/);
  assert.match(reactionsSource, /aria-label="删除动态"/);
  assert.match(reactionsSource, /aria-label="确认删除动态"/);
  assert.match(reactionsSource, /aria-label="取消删除"/);
  assert.match(reactionsSource, /size="icon"/);
  assert.doesNotMatch(reactionsSource, />举报</);
  assert.doesNotMatch(reactionsSource, />删除</);

  assert.match(source, /data-testid="post-right-actions"/);
  assert.match(
    source,
    /<Button[\s\S]*aria-label=\{pinned \? "取消置顶动态" : "置顶动态"\}/
  );
  const rightActionsSource = source.slice(rightActionsStart, source.indexOf("{ipRegion}", rightActionsStart));
  assert.doesNotMatch(rightActionsSource, /aria-label="举报动态"/);
  assert.doesNotMatch(rightActionsSource, /aria-label="删除动态"/);
  assert.doesNotMatch(rightActionsSource, />举报</);
  assert.doesNotMatch(rightActionsSource, />删除</);
  assert.match(
    source,
    /data-testid="post-management-actions"[\s\S]*ariaLabel="修改动态可见范围"[\s\S]*<\/div>[\s\S]*\{ipRegion\}/
  );
  assert.doesNotMatch(source, /data-testid="post-visitor-actions"/);
  assert.doesNotMatch(source, />确认删除</);
  assert.doesNotMatch(source, /<select[\s\S]*aria-label="修改动态可见范围"/);
  assert.match(source, /import \{[\s\S]*PostVisibilityMenu[\s\S]*\} from "\.\/PostVisibilityMenu"/);
  assert.match(source, /<PostVisibilityMenu[\s\S]*ariaLabel="修改动态可见范围"[\s\S]*loading=\{updatingVisibility\}/);
  assert.match(
    source,
    /<PostVisibilityMenu[\s\S]*buttonClassName="min-w-0 flex-none"/
  );
  assert.doesNotMatch(source, /className="absolute bottom-full/);

  assert.doesNotMatch(
    source,
    /function PostImageGrid[\s\S]*rounded-md[\s\S]*function normalizePostVisibilityValue/
  );
  assert.doesNotMatch(source, /max-w-\[540px\]/);
  assert.match(
    source,
    /"mt-3 grid gap-1\.5 overflow-hidden rounded-lg w-full"/
  );
  assert.match(
    source,
    /<footer className="mt-3 w-full">/
  );
  assert.match(
    source,
    /className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-0\.5 sm:gap-1"[\s\S]*data-testid="post-right-actions"/
  );
  assert.match(
    source,
    /className="flex min-w-0 flex-wrap items-center justify-end gap-0\.5 sm:gap-1"[\s\S]*data-testid="post-management-actions"/
  );

  const visibilitySource = await readFile(
    new URL("../src/components/post/PostVisibilityMenu.tsx", import.meta.url),
    "utf8"
  );
  assert.match(visibilitySource, /import \{ Button \} from "@\/components\/ui\/button"/);
  assert.match(
    visibilitySource,
    /<Button[\s\S]*variant="ghost"[\s\S]*size="default"[\s\S]*className=\{cn\([\s\S]*"h-8 min-w-\[7\.5rem\] justify-start gap-1 rounded-md px-2 text-xs font-normal text-muted-foreground/
  );
  assert.doesNotMatch(visibilitySource, /<button[\s\S]*aria-label=\{ariaLabel\}/);
});
