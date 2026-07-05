import { useEffect, useState } from "react";
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Heart,
  ImageOff,
  Share2,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  formatCount,
  formatDate,
  getAvatarFallback,
  getMediaDetailUrl,
} from "@/lib/format";
import type { MediaAssetResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

type MediaDetailDialogProps = {
  assets: MediaAssetResponse[];
  index: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onIndexChange: (index: number) => void;
};

function getOriginalUrl(asset: MediaAssetResponse): string {
  return asset.urls?.original || asset.urls?.detail || asset.url || "";
}

export function MediaDetailDialog({
  assets,
  index,
  open,
  onOpenChange,
  onIndexChange,
}: MediaDetailDialogProps) {
  const { toast } = useToast();
  const asset = assets[index];

  const [imgError, setImgError] = useState(false);
  // Local like state — UI-only until a backend /api/media/reaction/toggle exists.
  const [liked, setLiked] = useState(false);
  const [likeDelta, setLikeDelta] = useState(0);

  // Reset per-asset local state when the displayed asset changes.
  useEffect(() => {
    setImgError(false);
    setLiked(false);
    setLikeDelta(0);
  }, [asset?.id]);

  // Arrow-key navigation. base-ui Dialog handles ESC, focus trap, scroll lock.
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" && index > 0) {
        event.preventDefault();
        onIndexChange(index - 1);
      } else if (event.key === "ArrowRight" && index < assets.length - 1) {
        event.preventDefault();
        onIndexChange(index + 1);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, index, assets.length, onIndexChange]);

  if (!asset) return null;

  const owner = asset.owner;
  const ownerName = owner?.nickname || owner?.username || "匿名摄影师";
  const title = asset.title || asset.name || "未命名作品";
  const description = asset.description || asset.introduction;
  const stats = asset.stats;
  const reactionCount = (stats?.reactionCount ?? 0) + likeDelta;
  const canDownload = asset.permissions?.canDownload ?? true;
  const detailUrl = getMediaDetailUrl(asset);
  const hasPrev = index > 0;
  const hasNext = index < assets.length - 1;

  const handleLike = () => {
    // TODO: persist via /api/media/reaction/toggle once the backend exposes it.
    setLiked((v) => !v);
    setLikeDelta((d) => (liked ? d - 1 : d + 1));
  };

  const handleDownload = () => {
    const url = getOriginalUrl(asset);
    if (!url) {
      toast({
        title: "下载失败",
        description: "图片地址不可用",
        variant: "destructive",
      });
      return;
    }
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.rel = "noopener noreferrer";
    anchor.download = asset.originalFilename || `${title}.jpg`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const handleShare = async () => {
    const url = getOriginalUrl(asset);
    if (!url) {
      toast({
        title: "分享失败",
        description: "图片地址不可用",
        variant: "destructive",
      });
      return;
    }
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast({ title: "链接已复制", description: "已复制图片直链到剪贴板" });
    } catch {
      // share cancelled or clipboard denied — stay quiet
    }
  };

  const scrimButton =
    "inline-flex items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur-sm transition hover:bg-background focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-3xl gap-0 overflow-hidden p-0"
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">
          {description || `${title} — 作者 ${ownerName}`}
        </DialogDescription>

        {/* Photo stage */}
        <div className="relative flex max-h-[60vh] items-center justify-center bg-muted">
          {imgError || !detailUrl ? (
            <div className="flex h-48 w-full items-center justify-center text-muted-foreground">
              <ImageOff className="size-8" aria-hidden />
            </div>
          ) : (
            <img
              key={asset.id}
              src={detailUrl}
              alt={title}
              className="max-h-[60vh] max-w-full object-contain"
              onError={() => setImgError(true)}
            />
          )}

          {/* Close — sits over the photo with a scrim for contrast */}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className={cn(scrimButton, "absolute right-3 top-3 size-9")}
            aria-label="关闭"
          >
            <X className="size-4" aria-hidden />
          </button>

          {hasPrev ? (
            <button
              type="button"
              onClick={() => onIndexChange(index - 1)}
              className={cn(scrimButton, "absolute left-3 top-1/2 size-9 -translate-y-1/2")}
              aria-label="上一张"
            >
              <ChevronLeft className="size-5" aria-hidden />
            </button>
          ) : null}
          {hasNext ? (
            <button
              type="button"
              onClick={() => onIndexChange(index + 1)}
              className={cn(scrimButton, "absolute right-3 top-1/2 size-9 -translate-y-1/2")}
              aria-label="下一张"
            >
              <ChevronRight className="size-5" aria-hidden />
            </button>
          ) : null}
        </div>

        {/* Info panel */}
        <div className="max-h-[30vh] space-y-3 overflow-y-auto p-4 sm:p-5">
          {owner ? (
            <div className="flex items-center gap-2.5">
              <Avatar className="size-8">
                {owner.avatarUrl ? (
                  <AvatarImage src={owner.avatarUrl} alt={ownerName} />
                ) : null}
                <AvatarFallback className="text-xs">
                  {getAvatarFallback(ownerName)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-foreground">{ownerName}</span>
              {asset.createdAt ? (
                <>
                  <span className="text-sm text-muted-foreground" aria-hidden>
                    ·
                  </span>
                  <time
                    className="text-sm text-muted-foreground"
                    dateTime={asset.createdAt}
                  >
                    {formatDate(asset.createdAt)}
                  </time>
                </>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-1.5">
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            {description ? (
              <p className="text-sm leading-relaxed text-foreground/80">
                {description}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Heart className="size-4" aria-hidden />
              {formatCount(reactionCount)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Eye className="size-4" aria-hidden />
              {formatCount(stats?.viewCount ?? 0)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Bookmark className="size-4" aria-hidden />
              {formatCount(stats?.favoriteCount ?? 0)}
            </span>
          </div>

          {asset.tags && asset.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {asset.tags.slice(0, 8).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleLike}
              aria-pressed={liked}
              className={cn(liked && "text-rose-600 hover:text-rose-600")}
            >
              <Heart className={cn("size-4", liked && "fill-current")} aria-hidden />
              {liked ? "已点赞" : "点赞"}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleDownload}
              disabled={!canDownload}
              title={!canDownload ? "暂无下载权限" : undefined}
            >
              <Download className="size-4" aria-hidden />
              下载
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleShare}
            >
              <Share2 className="size-4" aria-hidden />
              分享
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
