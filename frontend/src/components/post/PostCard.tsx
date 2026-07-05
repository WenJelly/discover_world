import { useEffect, useState } from "react";
import {
  Bookmark,
  Heart,
  ImageOff,
  Loader2,
  MapPin,
  MessageCircle,
  Pin,
  Trash2,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ApiError,
  deletePost,
  togglePostFavorite,
  togglePostReaction,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  formatCount,
  formatRelativeTime,
  getAvatarFallback,
  getMediaUrl,
} from "@/lib/format";
import type { MediaAssetResponse, ProfilePostResponse } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { PostAuthor } from "./PostComposerDialog";

export type PostCardProps = {
  post: ProfilePostResponse;
  author?: PostAuthor | null;
  onDeleted?: (id: string) => void;
};

function imageGridClass(count: number) {
  if (count <= 1) return "grid-cols-1";
  if (count === 2) return "grid-cols-2";
  if (count === 3) return "grid-cols-3";
  if (count === 4) return "grid-cols-2";
  return "grid-cols-3";
}

function PostImageGrid({ images }: { images: MediaAssetResponse[] }) {
  if (images.length === 0) return null;
  const single = images.length === 1;
  return (
    <div className={cn("mt-3 grid gap-1", imageGridClass(images.length))}>
      {images.map((image) => {
        const src = getMediaUrl(image);
        return (
          <div
            key={image.id}
            className={cn(
              "overflow-hidden rounded-md border border-border bg-muted",
              single ? "max-h-[420px]" : "aspect-square"
            )}
          >
            {src ? (
              <img
                src={src}
                alt={image.title || image.originalFilename || "图片"}
                loading="lazy"
                decoding="async"
                className={cn(
                  "h-full w-full object-cover",
                  single ? "max-h-[420px]" : ""
                )}
              />
            ) : (
              <div className="flex h-full min-h-[80px] items-center justify-center text-muted-foreground">
                <ImageOff className="size-6" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function PostCard({ post, author, onDeleted }: PostCardProps) {
  const { toast } = useToast();
  const [stats, setStats] = useState(post.stats);
  const [liked, setLiked] = useState(Boolean(post.isLiked));
  const [favorited, setFavorited] = useState(Boolean(post.isFavorited));
  const [togglingLike, setTogglingLike] = useState(false);
  const [togglingFav, setTogglingFav] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setStats(post.stats);
    setLiked(Boolean(post.isLiked));
    setFavorited(Boolean(post.isFavorited));
    setConfirmDelete(false);
  }, [post.id, post.isLiked, post.isFavorited, post.stats]);

  const handleLike = async () => {
    if (togglingLike) return;
    const prevLiked = liked;
    const prevStats = stats;
    setLiked(!prevLiked);
    setStats((current) => ({
      ...current,
      reactionCount: Math.max(
        0,
        current.reactionCount + (prevLiked ? -1 : 1)
      ),
    }));
    setTogglingLike(true);
    try {
      const res = await togglePostReaction(post.id, "like");
      setLiked(res.active);
      setStats(res.stats);
    } catch (err) {
      setLiked(prevLiked);
      setStats(prevStats);
      toast({
        title: "操作失败",
        description: err instanceof ApiError ? err.message : "请稍后重试。",
        variant: "destructive",
      });
    } finally {
      setTogglingLike(false);
    }
  };

  const handleFavorite = async () => {
    if (togglingFav) return;
    const prevFav = favorited;
    const prevStats = stats;
    setFavorited(!prevFav);
    setStats((current) => ({
      ...current,
      favoriteCount: Math.max(
        0,
        current.favoriteCount + (prevFav ? -1 : 1)
      ),
    }));
    setTogglingFav(true);
    try {
      const res = await togglePostFavorite(post.id);
      setFavorited(res.active);
      setStats(res.stats);
    } catch (err) {
      setFavorited(prevFav);
      setStats(prevStats);
      toast({
        title: "操作失败",
        description: err instanceof ApiError ? err.message : "请稍后重试。",
        variant: "destructive",
      });
    } finally {
      setTogglingFav(false);
    }
  };

  const handleDeleteClick = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await deletePost(post.id);
      toast({ title: "动态已删除", variant: "success" });
      onDeleted?.(post.id);
    } catch (err) {
      toast({
        title: "删除失败",
        description: err instanceof ApiError ? err.message : "请稍后重试。",
        variant: "destructive",
      });
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  const actionClass =
    "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-blue-500/20 disabled:pointer-events-none disabled:opacity-50";

  return (
    <article className="rounded-xl bg-card p-3 sm:p-4">
      <header className="flex items-start gap-3">
        <Avatar className="size-10 shrink-0">
          {author?.avatarUrl ? (
            <AvatarImage src={author.avatarUrl} alt={author.username} />
          ) : null}
          <AvatarFallback>
            {getAvatarFallback(author?.username ?? "用户")}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-sm font-semibold text-foreground">
              {author?.username ?? "用户"}
            </span>
            {author?.handle ? (
              <span className="text-sm text-muted-foreground">
                {author.handle}
              </span>
            ) : null}
            <span className="text-sm text-muted-foreground" aria-hidden>
              ·
            </span>
            <time
              dateTime={post.createdAt}
              className="text-sm text-muted-foreground"
            >
              {formatRelativeTime(post.createdAt)}
            </time>
            {post.isPinned ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                <Pin className="size-3" />
                置顶
              </span>
            ) : null}
            {post.visibility === "private" ? (
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                仅自己可见
              </span>
            ) : null}
          </div>
          {post.location ? (
            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3" aria-hidden />
              <span className="truncate">{post.location}</span>
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {confirmDelete ? (
            <>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="inline-flex items-center rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-blue-500/20"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleDeleteClick}
                disabled={deleting}
                className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-destructive/20 disabled:opacity-50"
              >
                {deleting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
                确认删除
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleDeleteClick}
              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-blue-500/20"
              aria-label="删除动态"
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
      </header>

      {post.content ? (
        <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
          {post.content}
        </p>
      ) : null}

      <PostImageGrid images={post.images} />

      <footer className="mt-3 flex items-center gap-1">
        <button
          type="button"
          onClick={handleLike}
          disabled={togglingLike}
          className={cn(
            actionClass,
            liked && "text-rose-600 hover:text-rose-600 hover:bg-rose-500/10"
          )}
          aria-pressed={liked}
        >
          <Heart
            className={cn("size-[18px]", liked && "fill-current")}
            aria-hidden
          />
          <span className="tabular-nums">
            {formatCount(stats.reactionCount)}
          </span>
        </button>

        <span
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground"
          title="评论功能即将上线"
        >
          <MessageCircle className="size-[18px]" aria-hidden />
          <span className="tabular-nums">
            {formatCount(stats.commentCount)}
          </span>
        </span>

        <button
          type="button"
          onClick={handleFavorite}
          disabled={togglingFav}
          className={cn(
            actionClass,
            favorited &&
              "text-amber-600 hover:text-amber-600 hover:bg-amber-500/10"
          )}
          aria-pressed={favorited}
        >
          <Bookmark
            className={cn("size-[18px]", favorited && "fill-current")}
            aria-hidden
          />
          <span className="tabular-nums">
            {formatCount(stats.favoriteCount)}
          </span>
        </button>
      </footer>
    </article>
  );
}
