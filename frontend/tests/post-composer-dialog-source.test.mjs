import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("post composer entry and dialog match the fresh-news card shape", async () => {
  const accountSource = await readFile(
    new URL("../src/pages/AccountDetailPage.tsx", import.meta.url),
    "utf8"
  );
  const dialogSource = await readFile(
    new URL("../src/components/post/PostComposerDialog.tsx", import.meta.url),
    "utf8"
  );
  const entrySource =
    accountSource.match(
      /className="mb-6 flex justify-end pr-3 sm:pr-4"[\s\S]*?data-testid="profile-post-composer-entry"[\s\S]*?<\/Button>/
    )?.[0] ?? "";

  assert.notEqual(entrySource, "");
  assert.match(entrySource, /className="mb-6 flex justify-end pr-3 sm:pr-4"/);
  assert.match(entrySource, />\s*有什么新鲜事\?\s*</);
  assert.match(entrySource, /aria-label="打开发布动态面板"/);
  assert.doesNotMatch(entrySource, /<Send|<img|src="\/logo\.svg"/);
  assert.doesNotMatch(accountSource, /发表新动态/);

  assert.match(dialogSource, /<DialogTitle[\s\S]*分享新鲜事/);
  assert.doesNotMatch(dialogSource, /<DialogTitle[\s\S]*发动态/);
  assert.match(dialogSource, /showCloseButton=\{false\}/);
  assert.match(dialogSource, /<DialogClose[\s\S]*aria-label="关闭弹窗"/);
  assert.match(dialogSource, /className="inline-flex size-8/);
  assert.match(dialogSource, /placeholder="有什么新鲜事想分享？"/);
  assert.match(dialogSource, /max-h-\[min\(94dvh,860px\)\]/);
  assert.doesNotMatch(dialogSource, /min-h-\[min\(78dvh,720px\)\]/);
  assert.doesNotMatch(dialogSource, /className="flex-1 overflow-y-auto/);
  assert.match(dialogSource, /className="min-h-0 overflow-y-auto px-4 pb-3"/);
  assert.match(dialogSource, /data-testid="post-composer-content-area"/);
  assert.match(dialogSource, /data-testid="post-composer-text-area"/);
  assert.match(dialogSource, /data-testid="post-composer-image-area"/);
  assert.match(dialogSource, /const denseImageGrid = images\.length >= 7/);
  assert.match(dialogSource, /const textAreaClassName = denseImageGrid \? "min-h-\[160px\]" : "min-h-\[210px\]"/);
  assert.match(dialogSource, /min-h-\[210px\]/);
  assert.match(dialogSource, /rows=\{denseImageGrid \? 5 : 7\}/);
  assert.match(dialogSource, /className=\{images\.length > 0 \? "mt-3" : ""\}/);
  assert.doesNotMatch(dialogSource, /min-h-\[360px\]/);
  assert.doesNotMatch(dialogSource, /MAX_CONTENT/);
  assert.doesNotMatch(dialogSource, /maxLength=\{MAX_CONTENT\}/);
  assert.doesNotMatch(dialogSource, /tabular-nums/);
  assert.match(dialogSource, /import \{ PostVisibilityMenu \} from "\.\/PostVisibilityMenu"/);
  assert.match(dialogSource, /data-testid="post-composer-author-row"/);
  assert.match(dialogSource, /data-testid="post-composer-author-text"/);
  assert.match(dialogSource, /<PostVisibilityMenu[\s\S]*value=\{visibility\}[\s\S]*onChange=\{setVisibility\}[\s\S]*ariaLabel="选择动态可见范围"/);
  assert.doesNotMatch(dialogSource, /<select[\s\S]*id="post-visibility"/);
  assert.match(dialogSource, /showAddTile=\{false\}/);
  assert.match(dialogSource, /ImagePlus/);
  assert.match(dialogSource, /Hash/);
  assert.match(dialogSource, /MapPin/);
  assert.match(dialogSource, /AtSign/);
  assert.doesNotMatch(dialogSource, /审核通过后向所有人公开/);
});

test("post composer uploads selected preview images only during publish", async () => {
  const source = await readFile(
    new URL("../src/components/post/PostComposerDialog.tsx", import.meta.url),
    "utf8"
  );

  assert.match(source, /import \{[^}]*uploadMediaAsset[^}]*\} from "@\/lib\/api"/s);
  assert.match(source, /const uploadedImageIds: string\[\] = \[\]/);
  assert.match(source, /for \(const image of images\)/);
  assert.match(source, /await uploadMediaAsset\(image\.file,\s*\{\s*visibility:\s*"public",\s*assetUsage:\s*"post",\s*\}\)/s);
  assert.match(source, /imageIds: uploadedImageIds/);
  assert.doesNotMatch(source, /imageIds: images\.map/);
});

test("post image attach supports multi-select and caps dynamic media at nine", async () => {
  const source = await readFile(
    new URL("../src/components/post/PostImageAttach.tsx", import.meta.url),
    "utf8"
  );

  assert.match(source, /export const POST_MAX_IMAGES = 9/);
  assert.match(source, /const pickedFiles = Array\.from\(event\.target\.files \?\? \[\]\)/);
  assert.match(source, /const selectedFiles = pickedFiles\.slice\(0, remaining\)/);
  assert.match(source, /multiple/);
  assert.match(source, /imageGridClass\(images\.length\)/);
  assert.match(source, /grid-cols-3/);
  assert.match(source, /count >= 7/);
  assert.match(source, /max-w-\[420px\]/);
  assert.match(source, /count >= 4/);
  assert.match(source, /max-w-\[450px\]/);
  assert.match(source, /max-w-\[480px\]/);
  assert.doesNotMatch(source, /grid-rows-3/);
  assert.match(source, /images\.length === 1/);
  assert.match(source, /inline-block/);
  assert.match(source, /max-w-\[360px\]/);
  assert.match(source, /max-h-\[220px\]/);
  assert.match(source, /object-contain/);
  assert.doesNotMatch(source, /group relative flex w-full items-center justify-center overflow-hidden rounded-lg border/);
  assert.doesNotMatch(source, /aspect-\[4\/3\]/);
  assert.doesNotMatch(source, /max-h-\[280px\]/);
  assert.match(source, /images\.length > 1/);
  assert.match(source, /images\.slice\(0, POST_MAX_IMAGES\)\.map/);
  assert.match(source, /aspect-square/);
  assert.doesNotMatch(source, /Array\.from\(\{ length: POST_MAX_IMAGES \}/);
  assert.doesNotMatch(source, /invisible/);
  assert.doesNotMatch(source, /count === 4/);
  assert.doesNotMatch(source, /grid-cols-2/);
  assert.doesNotMatch(source, /max-w-\[390px\]/);
  assert.match(source, /imageItemClass\(images\.length\)/);
  assert.doesNotMatch(source, /公开动态的图片需通过审核/);
});
