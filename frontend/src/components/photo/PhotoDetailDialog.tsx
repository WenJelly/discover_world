import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Calendar,
  Globe,
  Lock,
  MoreHorizontal,
  Share2,
  ShieldCheck,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { toggleMediaReaction } from "@/lib/api";
import { getMediaDetailUrl } from "@/lib/format";
import type { MediaAssetResponse, MediaAssetStats } from "@/lib/types";

import { DownloadButton } from "./DownloadButton";
import { PhotoMetadata, type PhotoExif } from "./PhotoMetadata";
import { parseExif } from "./photo-utils";
import { PhotographerInfo } from "./PhotographerInfo";
import { PhotoStats } from "./PhotoStats";
import { PhotoViewer } from "./PhotoViewer";

interface PhotoDetailDialogProps {
  /** The photo to display. When null the dialog stays closed. */
  media: MediaAssetResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;

  /** Author region, e.g. "中国 · 四川". No backend field yet. */
  authorLocation?: string;
  /** Whether the viewer already follows the author. */
  isFollowing?: boolean;
  followPending?: boolean;
  /** Hide the follow button (e.g. viewing your own work). */
  hideFollow?: boolean;
  onToggleFollow?: () => void;

  /** Marks the photo with a VIP badge. No backend field yet. */
  isVip?: boolean;
  /** Pushes stat/reaction changes back to the owning gallery card. */
  onAssetChange?: (asset: MediaAssetResponse) => void;
}

const VISIBILITY_LABELS: Record<string, { label: string; icon: typeof Globe }> = {
  public: { label: "公开", icon: Globe },
  private: { label: "私密", icon: Lock },
};

const EMPTY_STATS: MediaAssetStats = {
  viewCount: 0,
  reactionCount: 0,
  favoriteCount: 0,
  commentCount: 0,
  shareCount: 0,
  downloadCount: 0,
};

const DETAIL_CARD = {
  maxViewportWidthRatio: 0.96,
  fixedDesktopHeight: 760,
  mobileHeightRatio: 0.9,
  desktopPadding: 40,
  mobilePadding: 32,
  tabletPadding: 40,
  desktopGap: 18,
  rightColumnWidth: 360,
  leftCaptionHeight: 34,
  minViewerWidth: 280,
  minViewerHeight: 320,
};

const REFERENCE_DETAIL_DEFAULTS = {
  title: "晨曦映雪山",
  description:
    "清晨的第一缕阳光洒在雪山之巅，湖面如镜，倒映出山峦与云彩的静谧之美。拍摄于四川稻城亚丁景区，海拔约4200米。",
  tags: ["风光摄影", "雪山", "日出", "稻城亚丁"],
  authorLocation: "中国 · 四川",
  isVip: true,
  createdAt: "2024-05-18 08:42:00",
  fileSize: 47_815_065,
  stats: {
    viewCount: 18_732,
    reactionCount: 2_458,
    favoriteCount: 0,
    commentCount: 0,
    shareCount: 0,
    downloadCount: 3_245,
  } satisfies MediaAssetStats,
};

function formatDetailDateTime(value: string) {
  if (!value) return "";
  const parsed = Date.parse(value.replace(" ", "T"));
  if (!Number.isFinite(parsed)) return value;

  const date = new Date(parsed);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}年${pad(date.getMonth() + 1)}月${pad(
    date.getDate()
  )}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getDimensionRatio(width?: number, height?: number) {
  if (!width || !height || width <= 0 || height <= 0) return undefined;
  return width / height;
}

function getImageAspectRatio(media: MediaAssetResponse | null) {
  const candidates = [
    media?.aspectRatio,
    media?.picScale,
    getDimensionRatio(media?.width, media?.height),
    getDimensionRatio(media?.picWidth, media?.picHeight),
  ];
  const ratio = candidates.find(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value) && value > 0
  );
  return ratio ?? 4 / 5;
}

function getViewportSize() {
  if (typeof window === "undefined") return { width: 0, height: 0 };
  return { width: window.innerWidth, height: window.innerHeight };
}

function getViewerLayout(
  viewport: { width: number; height: number },
  aspectRatio: number
) {
  if (!viewport.width || !viewport.height) return null;

  const isDesktop = viewport.width >= 1024;
  const maxCardWidth = viewport.width * DETAIL_CARD.maxViewportWidthRatio;
  const cardHeight = isDesktop
    ? Math.min(DETAIL_CARD.fixedDesktopHeight, viewport.height - 40)
    : viewport.height * DETAIL_CARD.mobileHeightRatio;
  const padding = isDesktop
    ? DETAIL_CARD.desktopPadding
    : viewport.width >= 640
      ? DETAIL_CARD.tabletPadding
      : DETAIL_CARD.mobilePadding;
  const targetViewerHeight = Math.max(
    DETAIL_CARD.minViewerHeight,
    cardHeight - padding - DETAIL_CARD.leftCaptionHeight
  );
  const naturalViewerWidth = targetViewerHeight * aspectRatio;
  const naturalCardWidth = isDesktop
    ? naturalViewerWidth +
      DETAIL_CARD.rightColumnWidth +
      DETAIL_CARD.desktopGap +
      padding
    : naturalViewerWidth + padding;
  const maxViewerWidth = isDesktop
    ? Math.max(
        DETAIL_CARD.minViewerWidth,
        maxCardWidth -
          DETAIL_CARD.rightColumnWidth -
          DETAIL_CARD.desktopGap -
          padding
      )
    : Math.max(DETAIL_CARD.minViewerWidth, maxCardWidth - padding);
  const viewerWidth = Math.min(naturalViewerWidth, maxViewerWidth);
  const viewerHeight = viewerWidth / aspectRatio;
  const cardWidth = Math.min(naturalCardWidth, maxCardWidth);

  return { viewerWidth, viewerHeight, cardWidth, cardHeight };
}

/**
 * Photo detail modal — a large, centered dialog with a left image stage and a
 * right info column (author, meta, description, EXIF, stats, actions).
 *
 * The open/close fade+scale is driven by Framer Motion via a self-managed
 * portal so the exit animation runs before unmount.
 */
export function PhotoDetailDialog({
  media,
  open,
  onOpenChange,
  authorLocation = REFERENCE_DETAIL_DEFAULTS.authorLocation,
  isFollowing,
  followPending,
  hideFollow,
  onToggleFollow,
  isVip = REFERENCE_DETAIL_DEFAULTS.isVip,
  onAssetChange,
}: PhotoDetailDialogProps) {
  const prefersReducedMotion = useReducedMotion();
  const { toast } = useToast();
  const contentRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Local like/stats mirror so the UI reflects reactions immediately. Seeded
  // from the incoming media and re-synced whenever the target photo changes.
  const [liked, setLiked] = useState(false);
  const [stats, setStats] = useState<MediaAssetStats | null>(null);
  const [likePending, setLikePending] = useState(false);
  const [viewportSize, setViewportSize] = useState(getViewportSize);

  useEffect(() => {
    if (!media) return;
    setLiked(media.isLiked ?? false);
    setStats(media.stats ?? null);
  }, [media]);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  // ESC to close. Only while open.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  // Lock body scroll while the dialog is open.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Move focus into the dialog on open.
  useEffect(() => {
    if (open) closeButtonRef.current?.focus();
  }, [open, media?.id]);

  useEffect(() => {
    if (!open) return;
    const updateViewportSize = () => setViewportSize(getViewportSize());
    updateViewportSize();
    window.addEventListener("resize", updateViewportSize);
    return () => window.removeEventListener("resize", updateViewportSize);
  }, [open]);

  const detailUrl = useMemo(() => getMediaDetailUrl(media), [media]);
  const originalUrl = media?.urls?.original || media?.url || detailUrl;
  const canDownload = media?.permissions?.canDownload ?? true;
  const displayTitle =
    media?.title?.trim() ||
    media?.name?.trim() ||
    REFERENCE_DETAIL_DEFAULTS.title;
  const displayDescription =
    media?.description?.trim() ||
    media?.introduction?.trim() ||
    REFERENCE_DETAIL_DEFAULTS.description;
  const displayCreatedAt =
    media?.createdAt?.trim() ||
    media?.createTime?.trim() ||
    REFERENCE_DETAIL_DEFAULTS.createdAt;
  const displayFileSize =
    media?.fileSize || media?.picSize || REFERENCE_DETAIL_DEFAULTS.fileSize;
  const exif: PhotoExif = useMemo(
    () => parseExif(media?.metadataJson),
    [media?.metadataJson]
  );
  const displayTags = useMemo(() => {
    const tags = media?.tags?.filter(Boolean) ?? [];
    const category = media?.category?.trim();
    const sourceTags = [category, ...tags].filter(
      (tag, tagIndex, list): tag is string =>
        Boolean(tag) && list.indexOf(tag) === tagIndex
    );
    return sourceTags.length > 0 ? sourceTags : REFERENCE_DETAIL_DEFAULTS.tags;
  }, [media?.category, media?.tags]);
  const displayStats = stats ?? REFERENCE_DETAIL_DEFAULTS.stats ?? EMPTY_STATS;
  const imageAspectRatio = getImageAspectRatio(media);
  const viewerLayout = useMemo(
    () => getViewerLayout(viewportSize, imageAspectRatio),
    [imageAspectRatio, viewportSize]
  );
  const rightPanelHeight =
    viewportSize.width >= 1024 ? viewerLayout?.viewerHeight : undefined;

  const handleToggleLike = async () => {
    if (!media || likePending) return;
    setLikePending(true);
    // Optimistic update, rolled back on failure.
    const nextLiked = !liked;
    setLiked(nextLiked);
    setStats((current) =>
      current
        ? {
            ...current,
            reactionCount: Math.max(
              0,
              current.reactionCount + (nextLiked ? 1 : -1)
            ),
          }
        : current
    );
    try {
      const res = await toggleMediaReaction({ id: media.id });
      setLiked(res.active);
      setStats(res.stats);
      onAssetChange?.({
        ...media,
        isLiked: res.active,
        stats: res.stats,
        likeCount: res.stats.reactionCount,
        viewCount: res.stats.viewCount,
      });
    } catch (error) {
      setLiked(!nextLiked);
      setStats(media.stats ?? null);
      toast({
        title: "操作失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setLikePending(false);
    }
  };

  const handleShare = async () => {
    if (!media) return;
    const shareUrl = typeof window !== "undefined" ? window.location.href : "";
    const title = media.title || "分享作品";
    try {
      if (navigator.share) {
        await navigator.share({ title, url: shareUrl });
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: "链接已复制", variant: "success" });
    } catch {
      // User dismissed the share sheet, or clipboard was blocked — ignore.
    }
  };

  const handleDownloaded = () => {
    setStats((current) =>
      current
        ? { ...current, downloadCount: current.downloadCount + 1 }
        : current
    );
  };

  const visibility =
    VISIBILITY_LABELS[media?.visibility ?? "public"] ??
    VISIBILITY_LABELS.public;
  const VisibilityIcon = visibility.icon;

  const duration = prefersReducedMotion ? 0 : 0.2;

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && media ? (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-3 sm:p-5 lg:p-7"
          role="dialog"
          aria-modal="true"
          aria-label={displayTitle || "作品详情"}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-slate-950/80"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration }}
            onClick={close}
            aria-hidden="true"
          />

          {/* Card */}
          <motion.div
            ref={contentRef}
            className="relative z-10 grid max-w-[96vw] grid-rows-[minmax(320px,1fr)_auto] overflow-hidden rounded-none bg-[#fbfcff] p-4 shadow-[0_24px_72px_rgba(15,23,42,0.32)] sm:p-5 lg:grid-cols-[auto_360px] lg:grid-rows-1 lg:gap-[18px] lg:p-5"
            style={{
              width: viewerLayout?.cardWidth,
              height: viewerLayout?.cardHeight,
            }}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Close button */}
            <button
              ref={closeButtonRef}
              type="button"
              onClick={close}
              aria-label="关闭"
              className="absolute right-3 top-2 z-30 flex size-7 items-center justify-center rounded-full bg-transparent text-slate-950 transition hover:bg-slate-100 focus-visible:outline-none"
            >
              <X className="size-4" aria-hidden="true" />
            </button>

            {/* Left: image stage */}
            <div className="flex min-h-0 flex-col items-start justify-between gap-3.5">
              <PhotoViewer
                src={detailUrl}
                alt={displayTitle || "作品"}
                aspectRatio={imageAspectRatio}
                displayWidth={viewerLayout?.viewerWidth}
                displayHeight={viewerLayout?.viewerHeight}
                placeholderColor={media.dominantColor || media.picColor}
                className="min-h-0"
              />
              <div className="flex w-full shrink-0 items-center gap-2 pl-1 text-xs text-slate-500">
                <ShieldCheck className="size-4 text-blue-500" aria-hidden="true" />
                <span>尊重原创，请勿用于商业用途或二次修改后发布</span>
              </div>
            </div>

            {/* Right: info column */}
            <div
              className="flex min-h-0 flex-col lg:pl-0"
              style={{ height: rightPanelHeight }}
            >
              <div className="min-h-0 flex-1 overflow-y-auto pr-0 pt-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:pt-1">
                <div>
                  <PhotographerInfo
                    author={media.owner}
                    location={authorLocation}
                    isFollowing={isFollowing}
                    followPending={followPending}
                    hideFollow={hideFollow}
                    onToggleFollow={onToggleFollow}
                    className="lg:pr-10"
                  />

                      <section className="mt-6 space-y-2.5">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <h2 className="text-[24px] font-semibold leading-[1.08] text-slate-950">
                            {displayTitle}
                          </h2>
                      {isVip ? (
                        <span className="rounded-none bg-[#ffedd8] px-2 py-0.5 text-xs font-semibold leading-none text-[#e88927]">
                          VIP
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-slate-500">
                      {displayCreatedAt ? (
                        <span className="inline-flex items-center gap-2">
                          <Calendar className="size-4" aria-hidden="true" />
                          {formatDetailDateTime(displayCreatedAt)}
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-2">
                        <VisibilityIcon className="size-4" aria-hidden="true" />
                        {visibility.label}
                      </span>
                    </div>
                  </section>

                  {displayDescription || displayTags.length > 0 ? (
                    <>
                      <div className="mt-4 h-px bg-[#dfe3ea]" />
                      <section className="mt-4 space-y-2.5">
                        <h3 className="text-sm font-semibold text-slate-950">
                          作品介绍
                        </h3>
                        {displayDescription ? (
                          <p className="whitespace-pre-line text-sm leading-6 text-slate-500">
                            {displayDescription}
                          </p>
                        ) : null}
                        {displayTags.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm font-semibold">
                            {displayTags.map((tag, tagIndex) => (
                              <span
                                key={`${tag}-${tagIndex}`}
                                className={
                                  tagIndex === 0 ? "text-slate-950" : "text-blue-600"
                                }
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </section>
                    </>
                  ) : null}

                  <div className="mt-4 h-px bg-[#dfe3ea]" />

                  <PhotoMetadata exif={exif} className="mt-4" />

                  <div className="mt-4 h-px bg-[#dfe3ea]" />

                  <section className="mt-4 space-y-2.5">
                    <h3 className="text-sm font-semibold text-slate-950">
                      互动
                    </h3>
                    <PhotoStats
                      stats={displayStats}
                      isLiked={liked}
                      likePending={likePending}
                      onToggleLike={handleToggleLike}
                    />
                  </section>
                </div>
              </div>

              <div className="grid shrink-0 grid-cols-[92px_minmax(0,1fr)_56px] gap-2 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleShare}
                  className="h-10 rounded-none border-[#d8dee8] bg-[#fbfcff] text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Share2 className="size-4" aria-hidden="true" />
                  分享
                </Button>
                <DownloadButton
                  url={originalUrl}
                  filename={media.originalFilename || media.title}
                  fileSize={displayFileSize}
                  canDownload={canDownload}
                  onDownloaded={handleDownloaded}
                  className="h-10 rounded-none bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700"
                />
                <Button
                  type="button"
                  variant="outline"
                  aria-label="更多操作"
                  className="h-10 rounded-none border-[#d8dee8] bg-[#fbfcff] text-slate-700 hover:bg-slate-50"
                >
                  <MoreHorizontal className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
