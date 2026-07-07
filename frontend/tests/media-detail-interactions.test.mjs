import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("media detail dialog uses the reference card layout", async () => {
  const dialog = await readFile(
    new URL("../src/components/photo/PhotoDetailDialog.tsx", import.meta.url),
    "utf8"
  );
  const viewer = await readFile(
    new URL("../src/components/photo/PhotoViewer.tsx", import.meta.url),
    "utf8"
  );
  const photographer = await readFile(
    new URL("../src/components/photo/PhotographerInfo.tsx", import.meta.url),
    "utf8"
  );
  const metadata = await readFile(
    new URL("../src/components/photo/PhotoMetadata.tsx", import.meta.url),
    "utf8"
  );
  const stats = await readFile(
    new URL("../src/components/photo/PhotoStats.tsx", import.meta.url),
    "utf8"
  );
  const downloadButton = await readFile(
    new URL("../src/components/photo/DownloadButton.tsx", import.meta.url),
    "utf8"
  );

  assert.match(dialog, /fixedDesktopHeight: 760/);
  assert.match(dialog, /rightColumnWidth: 360/);
  assert.match(dialog, /cardWidth/);
  assert.match(dialog, /width: viewerLayout\?\.cardWidth/);
  assert.match(dialog, /height: viewerLayout\?\.cardHeight/);
  assert.match(dialog, /lg:grid-cols-\[auto_360px\]/);
  assert.doesNotMatch(dialog, /rounded-\[20px\]/);
  assert.match(dialog, /imageAspectRatio/);
  assert.match(dialog, /aspectRatio=\{imageAspectRatio\}/);
  assert.match(dialog, /viewerLayout/);
  assert.match(dialog, /viewerWidth/);
  assert.match(dialog, /rightPanelHeight/);
  assert.match(dialog, /viewportSize\.width >= 1024 \? viewerLayout\?\.viewerHeight : undefined/);
  assert.match(dialog, /height: rightPanelHeight/);
  assert.match(dialog, /尊重原创，请勿用于商业用途或二次修改后发布/);
  assert.match(dialog, /作品介绍/);
  assert.match(dialog, />互动</);
  assert.match(dialog, /text-\[24px\]/);
  assert.doesNotMatch(dialog, /text-\[26px\]/);
  assert.match(dialog, /REFERENCE_DETAIL_DEFAULTS/);
  assert.match(dialog, /晨曦映雪山/);
  assert.match(dialog, /清晨的第一缕阳光洒在雪山之巅/);
  assert.match(dialog, /稻城亚丁/);
  assert.match(dialog, /2_458/);
  assert.match(dialog, /18_732/);
  assert.match(dialog, /3_245/);
  assert.match(dialog, /47_815_065/);
  assert.match(dialog, /onToggleLike=\{handleToggleLike\}/);
  assert.match(dialog, /DownloadButton/);
  assert.doesNotMatch(dialog, /handleViewerDownload/);
  assert.doesNotMatch(dialog, /handleFullscreen/);
  assert.doesNotMatch(dialog, /onFullscreen=\{/);
  assert.doesNotMatch(dialog, /onDownload=\{/);
  assert.match(dialog, /className="absolute right-3 top-2[\s\S]*?size-7/);
  assert.match(dialog, /<X className="size-4"/);
  assert.match(dialog, /<PhotographerInfo[\s\S]*?className="lg:pr-10"/);
  assert.doesNotMatch(dialog, /lg:pt-12/);

  assert.match(viewer, /aspectRatio\?: number/);
  assert.match(viewer, /displayWidth\?: number/);
  assert.match(viewer, /height: displayHeight/);
  assert.match(viewer, /rounded-none/);
  assert.doesNotMatch(viewer, /rounded-\[12px\]/);
  assert.match(viewer, /object-contain/);
  assert.doesNotMatch(viewer, /object-cover/);
  assert.doesNotMatch(viewer, /{index} \/ {total}/);
  assert.doesNotMatch(viewer, /aria-label="上一张"/);
  assert.doesNotMatch(viewer, /aria-label="下一张"/);
  assert.doesNotMatch(viewer, /ChevronLeft|ChevronRight/);
  assert.doesNotMatch(viewer, /aria-label="全屏查看"/);
  assert.doesNotMatch(viewer, /aria-label="下载图片"/);
  assert.doesNotMatch(viewer, /Maximize2|bottom-4 right-4/);

  assert.match(photographer, /BadgeCheck/);
  assert.match(photographer, /author\?\.role\s*===\s*"admin"/);
  assert.match(photographer, /aria-label="管理员认证"/);
  assert.match(photographer, /<BadgeCheck[\s\S]*?\/>\s*<span[^>]*>\s*管理员\s*<\/span>/);
  assert.match(photographer, /text-yellow-500/);
  assert.doesNotMatch(photographer, /aria-label="已认证"/);
  assert.doesNotMatch(photographer, /bg-blue-100/);

  assert.match(metadata, /sm:grid-cols-3/);
  assert.match(metadata, /相机信息/);
  assert.match(metadata, /rounded-none/);
  assert.match(metadata, /gap-y-2\.5/);
  assert.match(metadata, /f\/8\.0/);
  assert.match(metadata, /Canon EOS R5/);
  assert.doesNotMatch(metadata, /wide/);

  assert.match(stats, /ThumbsUp/);
  assert.match(stats, /onToggleLike/);
  assert.doesNotMatch(stats, /rounded-full bg-rose-50/);
  assert.doesNotMatch(stats, /rounded-full bg-slate-100/);
  assert.match(stats, /active \? "fill-blue-500 text-blue-500"/);
  assert.match(stats, /cursor-pointer/);
  assert.match(stats, /motion\.span/);
  assert.doesNotMatch(stats, /isLike && activeClass/);
  assert.match(stats, /flex flex-wrap justify-start/);
  assert.match(stats, /size-8/);
  assert.match(stats, /active && activeClass/);
  assert.match(stats, /flex min-w-0 items-baseline justify-center gap-1\.5/);
  assert.match(stats, /text-\[11px\] leading-none text-slate-500/);
  assert.doesNotMatch(stats, /mt-0\.5 block text-\[11px\]/);
  assert.match(downloadButton, /下载原图/);
});

test("media detail dialog toggles backend likes optimistically", async () => {
  const dialog = await readFile(
    new URL("../src/components/photo/PhotoDetailDialog.tsx", import.meta.url),
    "utf8"
  );

  assert.match(dialog, /toggleMediaReaction/);
  assert.match(dialog, /setLiked\(nextLiked\)/);
  assert.match(dialog, /setStats\(\(current\) =>/);
  assert.match(dialog, /await toggleMediaReaction\(\{\s*id:\s*media\.id/);
  assert.match(dialog, /setLiked\(res\.active\)/);
  assert.match(dialog, /setStats\(res\.stats\)/);
  assert.doesNotMatch(dialog, /UI-only|TODO: persist/);
});

test("discover page stores updated media stats for cards and the open dialog", async () => {
  const page = await readFile(
    new URL("../src/pages/DiscoverPage.tsx", import.meta.url),
    "utf8"
  );
  const card = await readFile(
    new URL("../src/components/discover/DiscoverPictureCard.tsx", import.meta.url),
    "utf8"
  );

  assert.match(page, /assetOverrides/);
  assert.match(page, /fetchMediaAssetDetail/);
  assert.match(page, /activePictureId[\s\S]*fetchMediaAssetDetail\(\{\s*id:\s*activePictureId/);
  assert.match(page, /variantOption:\s*\{\s*compressType:\s*2\s*\}/);
  assert.match(page, /handleAssetChange\(detail\)/);
  assert.match(page, /setAssetOverrides/);
  assert.match(page, /pictures\.map\(\(picture\) =>/);
  assert.match(page, /assetOverrides\[picture\.id\]/);
  assert.match(page, /onAssetChange=\{handleAssetChange\}/);
  assert.doesNotMatch(page, /index=\{activeIndex/);
  assert.doesNotMatch(page, /total=\{filteredPictures\.length\}/);
  assert.doesNotMatch(page, /onPrevious=\{/);
  assert.doesNotMatch(page, /onNext=\{/);

  assert.match(card, /picture\.isLiked/);
  assert.match(card, /fill-current/);
});
