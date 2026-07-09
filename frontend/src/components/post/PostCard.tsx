import { useEffect, useState } from "react";
import {
  Bookmark,
  Flag,
  Heart,
  ImageOff,
  Loader2,
  MapPin,
  MessageCircle,
  Pin,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ApiError,
  createModerationReport,
  createPostComment,
  deletePost,
  fetchPostCommentCursorList,
  pinPost,
  togglePostFavorite,
  togglePostReaction,
  unpinPost,
  updatePost,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  formatCount,
  formatRelativeTime,
  getAvatarFallback,
  getMediaUrl,
} from "@/lib/format";
import type { MediaAssetResponse, ProfilePostResponse } from "@/lib/types";
import type { PostCommentResponse } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { PostAuthor } from "./PostComposerDialog";
import { PostVisibilityMenu } from "./PostVisibilityMenu";
import {
  normalizePostVisibilityValue,
  type PostVisibilityValue,
} from "./postVisibility";

export type PostCardProps = {
  post: ProfilePostResponse;
  author?: PostAuthor | null;
  canManage?: boolean;
  onDeleted?: (id: string) => void;
  onUpdated?: (post: ProfilePostResponse) => void;
  onPinChanged?: (post: ProfilePostResponse) => void;
};

type ReportTarget = {
  targetType: "post" | "comment_record";
  targetId: string;
  title: string;
};

const REPORT_REASON_OPTIONS = [
  { value: "spam", label: "垃圾广告" },
  { value: "abuse", label: "攻击骚扰" },
  { value: "illegal", label: "违法违规" },
  { value: "copyright", label: "版权问题" },
  { value: "other", label: "其他" },
];

function imageGridClass(count: number) {
  if (count <= 1) return "grid-cols-1";
  if (count === 2 || count === 4) return "grid-cols-2";
  return "grid-cols-3";
}

function imageItemClass(count: number) {
  if (count === 1) return "aspect-[16/10] max-h-[460px]";
  if (count === 2) return "aspect-[4/3]";
  return "aspect-square";
}

function PostImageGrid({ images }: { images: MediaAssetResponse[] }) {
  if (images.length === 0) return null;
  const visibleImages = images.slice(0, 9);
  return (
    <div
      className={cn(
        "mt-3 grid gap-1.5 overflow-hidden rounded-lg w-full",
        imageGridClass(visibleImages.length)
      )}
    >
      {visibleImages.map((image) => {
        const src = getMediaUrl(image);
        return (
          <div
            key={image.id}
            className={cn(
              "overflow-hidden border border-border bg-muted",
              imageItemClass(visibleImages.length)
            )}
          >
            {src ? (
              <img
                src={src}
                alt={image.title || image.originalFilename || "图片"}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
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

export function PostCard({
  post,
  author,
  canManage = false,
  onDeleted,
  onUpdated,
  onPinChanged,
}: PostCardProps) {
  const { toast } = useToast();
  const [stats, setStats] = useState(post.stats);
  const [liked, setLiked] = useState(Boolean(post.isLiked));
  const [favorited, setFavorited] = useState(Boolean(post.isFavorited));
  const [visibility, setVisibility] = useState(
    normalizePostVisibilityValue(post.visibility)
  );
  const [togglingLike, setTogglingLike] = useState(false);
  const [togglingFav, setTogglingFav] = useState(false);
  const [updatingVisibility, setUpdatingVisibility] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pinned, setPinned] = useState(Boolean(post.isPinned));
  const [pinning, setPinning] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<PostCommentResponse[]>([]);
  const [commentCursor, setCommentCursor] = useState("");
  const [commentHasMore, setCommentHasMore] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [reportReason, setReportReason] = useState("spam");
  const [reportDescription, setReportDescription] = useState("");
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    setStats(post.stats);
    setLiked(Boolean(post.isLiked));
    setFavorited(Boolean(post.isFavorited));
    setVisibility(normalizePostVisibilityValue(post.visibility));
    setPinned(Boolean(post.isPinned));
    setConfirmDelete(false);
    setCommentsOpen(false);
    setComments([]);
    setCommentCursor("");
    setCommentHasMore(false);
    setCommentText("");
  }, [
    post.id,
    post.isPinned,
    post.isLiked,
    post.isFavorited,
    post.stats,
    post.visibility,
  ]);

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

  const handleVisibilityChange = async (
    nextVisibility: PostVisibilityValue
  ) => {
    if (nextVisibility === visibility || updatingVisibility) return;

    const previousVisibility = visibility;
    setVisibility(nextVisibility);
    setUpdatingVisibility(true);
    try {
      const updated = await updatePost({
        id: post.id,
        content: post.content,
        location: post.location,
        visibility: nextVisibility,
      });
      setVisibility(normalizePostVisibilityValue(updated.visibility));
      onUpdated?.(updated);
      toast({
        title: "可见范围已更新",
        description:
          nextVisibility === "private"
            ? "这条动态现在仅自己可见。"
            : "这条动态现在公开展示。",
        variant: "success",
      });
    } catch (err) {
      setVisibility(previousVisibility);
      toast({
        title: "修改失败",
        description: err instanceof ApiError ? err.message : "请稍后重试。",
        variant: "destructive",
      });
    } finally {
      setUpdatingVisibility(false);
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

  const loadComments = async (mode: "reset" | "append" = "reset") => {
    if (commentsLoading) return;
    setCommentsLoading(true);
    try {
      const page = await fetchPostCommentCursorList({
        postId: post.id,
        cursor: mode === "append" ? commentCursor : "",
        pageSize: 20,
      });
      setComments((current) =>
        mode === "append" ? [...current, ...page.list] : page.list
      );
      setCommentCursor(page.nextCursor);
      setCommentHasMore(page.hasMore);
    } catch (err) {
      toast({
        title: "评论加载失败",
        description: err instanceof ApiError ? err.message : "请稍后重试。",
        variant: "destructive",
      });
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleCommentButtonClick = () => {
    const nextOpen = !commentsOpen;
    setCommentsOpen(nextOpen);
    if (nextOpen && comments.length === 0) {
      void loadComments("reset");
    }
  };

  const handleCommentSubmit = async () => {
    const content = commentText.trim();
    if (!content || commentSubmitting) return;

    setCommentSubmitting(true);
    try {
      const created = await createPostComment({ postId: post.id, content });
      setComments((current) => [created, ...current]);
      setCommentText("");
      setStats((current) => ({
        ...current,
        commentCount: current.commentCount + 1,
      }));
      toast({ title: "评论已发布", variant: "success" });
    } catch (err) {
      toast({
        title: "评论失败",
        description: err instanceof ApiError ? err.message : "请稍后重试。",
        variant: "destructive",
      });
    } finally {
      setCommentSubmitting(false);
    }
  };

  const openReportDialog = (target: ReportTarget) => {
    setReportTarget(target);
    setReportReason("spam");
    setReportDescription("");
  };

  const handleReportSubmit = async () => {
    if (!reportTarget || reporting) return;
    setReporting(true);
    try {
      await createModerationReport({
        targetType: reportTarget.targetType,
        targetId: reportTarget.targetId,
        reason: reportReason,
        description: reportDescription.trim() || undefined,
      });
      toast({ title: "举报已提交", variant: "success" });
      setReportTarget(null);
      setReportDescription("");
    } catch (err) {
      toast({
        title: "举报失败",
        description: err instanceof ApiError ? err.message : "请稍后重试。",
        variant: "destructive",
      });
    } finally {
      setReporting(false);
    }
  };

  const handlePinToggle = async () => {
    if (pinning) return;
    setPinning(true);
    try {
      const updated = pinned
        ? await unpinPost({ id: post.id })
        : await pinPost({ id: post.id });
      setPinned(Boolean(updated.isPinned));
      onPinChanged?.(updated);
      if (!onPinChanged) {
        onUpdated?.(updated);
      }
      toast({
        title: updated.isPinned ? "动态已置顶" : "已取消置顶",
        variant: "success",
      });
    } catch (err) {
      toast({
        title: pinned ? "取消置顶失败" : "置顶失败",
        description: err instanceof ApiError ? err.message : "请稍后重试。",
        variant: "destructive",
      });
    } finally {
      setPinning(false);
    }
  };

  const footerActionClass =
    "h-8 gap-1 rounded-md px-2 text-xs font-normal text-muted-foreground";
  const footerIconActionClass = "size-8 rounded-md text-muted-foreground";
  const ipRegion = (
    <div
      className="inline-flex h-8 shrink-0 items-center gap-1 text-xs text-muted-foreground"
      data-testid="post-ip-region"
    >
      <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
      <span>中国</span>
      <span aria-hidden>·</span>
      <span>上海</span>
    </div>
  );

  return (
    <>
    <article className="rounded-xl bg-card p-3 sm:p-4">
      <header className="flex items-center gap-3">
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
            {pinned ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                <Pin className="size-3" />
                置顶
              </span>
            ) : null}
            {visibility === "private" ? (
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
      </header>

      {post.content ? (
        <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
          {post.content}
        </p>
      ) : null}

      <PostImageGrid images={post.images} />

      <footer className="mt-3 w-full">
        <div
          className="flex flex-wrap items-start justify-between gap-2"
          data-testid="post-action-row"
        >
          <div
            className="flex min-w-0 items-center gap-0.5 sm:gap-1"
            data-testid="post-reactions"
          >
            <Button
              type="button"
              variant="ghost"
              size="default"
              onClick={handleLike}
              disabled={togglingLike}
              className={cn(
                footerActionClass,
                liked && "text-rose-600 hover:text-rose-600 hover:bg-rose-500/10"
              )}
              aria-pressed={liked}
            >
              <Heart
                className={cn("size-4", liked && "fill-current")}
                aria-hidden
              />
              <span className="tabular-nums">
                {formatCount(stats.reactionCount)}
              </span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="default"
              onClick={handleCommentButtonClick}
              className={cn(
                footerActionClass,
                commentsOpen && "bg-muted text-foreground"
              )}
              aria-label="评论动态"
              aria-expanded={commentsOpen}
            >
              <MessageCircle className="size-4" aria-hidden />
              <span className="tabular-nums">
                {formatCount(stats.commentCount)}
              </span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="default"
              onClick={handleFavorite}
              disabled={togglingFav}
              className={cn(
                footerActionClass,
                favorited &&
                  "text-amber-600 hover:text-amber-600 hover:bg-amber-500/10"
              )}
              aria-pressed={favorited}
            >
              <Bookmark
                className={cn("size-4", favorited && "fill-current")}
                aria-hidden
              />
              <span className="tabular-nums">
                {formatCount(stats.favoriteCount)}
              </span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() =>
                openReportDialog({
                  targetType: "post",
                  targetId: post.id,
                  title: "举报动态",
                })
              }
              className={footerIconActionClass}
              aria-label="举报动态"
              title="举报"
            >
              <Flag className="size-4" aria-hidden />
            </Button>

            {canManage ? (
              confirmDelete ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setConfirmDelete(false)}
                    disabled={deleting}
                    className={footerIconActionClass}
                    aria-label="取消删除"
                    title="取消删除"
                  >
                    <X className="size-4" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleDeleteClick}
                    disabled={deleting}
                    className={cn(
                      footerIconActionClass,
                      "text-destructive hover:bg-destructive/10 hover:text-destructive"
                    )}
                    aria-label="确认删除动态"
                    title="确认删除"
                  >
                    {deleting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" aria-hidden />
                    )}
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleDeleteClick}
                  className={cn(
                    footerIconActionClass,
                    "hover:text-destructive"
                  )}
                  aria-label="删除动态"
                  title="删除"
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              )
            ) : null}
          </div>

          <div
            className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-0.5 sm:gap-1"
            data-testid="post-right-actions"
          >
            {canManage ? (
              <div
                className="flex min-w-0 flex-wrap items-center justify-end gap-0.5 sm:gap-1"
                data-testid="post-management-actions"
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="default"
                  onClick={() => void handlePinToggle()}
                  disabled={pinning}
                  className={footerActionClass}
                  aria-label={pinned ? "取消置顶动态" : "置顶动态"}
                >
                  {pinning ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Pin className="size-4" />
                  )}
                  {pinned ? "取消置顶" : "置顶"}
                </Button>
                <PostVisibilityMenu
                  value={visibility}
                  onChange={(nextVisibility) =>
                    void handleVisibilityChange(nextVisibility)
                  }
                  ariaLabel="修改动态可见范围"
                  buttonClassName="min-w-0 flex-none"
                  loading={updatingVisibility}
                  disabled={updatingVisibility}
                />
              </div>
            ) : null}
            {ipRegion}
          </div>
        </div>

      </footer>

      {commentsOpen ? (
        <section
          className="mt-3 border-t border-border pt-3"
          aria-label="动态评论"
        >
          <div className="flex gap-2">
            <textarea
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              placeholder="写下你的评论"
              rows={2}
              maxLength={500}
              disabled={commentSubmitting}
              className="min-h-16 flex-1 resize-y rounded-md border border-border bg-background px-3 py-2 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-blue-500/20 disabled:opacity-60"
              aria-label="评论内容"
            />
            <Button
              type="button"
              size="sm"
              disabled={!commentText.trim() || commentSubmitting}
              onClick={() => void handleCommentSubmit()}
              className="self-start"
            >
              {commentSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              发布
            </Button>
          </div>

          <div className="mt-3 space-y-3">
            {commentsLoading && comments.length === 0 ? (
              <div className="flex justify-center py-4 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-label="评论加载中" />
              </div>
            ) : comments.length === 0 ? (
              <p className="rounded-md bg-muted/40 px-3 py-4 text-center text-sm text-muted-foreground">
                还没有评论。
              </p>
            ) : (
              comments.map((comment) => {
                const name =
                  comment.author?.nickname ||
                  comment.author?.username ||
                  "用户";
                return (
                  <article
                    key={comment.id}
                    className="rounded-lg bg-muted/35 px-3 py-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {name}
                        </p>
                        <time
                          dateTime={comment.createdAt}
                          className="text-xs text-muted-foreground"
                        >
                          {formatRelativeTime(comment.createdAt)}
                        </time>
                      </div>
                      <button
                        type="button"
                        className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-blue-500/20"
                        onClick={() =>
                          openReportDialog({
                            targetType: "comment_record",
                            targetId: comment.id,
                            title: "举报评论",
                          })
                        }
                        aria-label="举报评论"
                      >
                        <Flag className="size-3.5" aria-hidden />
                        举报
                      </button>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground">
                      {comment.content}
                    </p>
                  </article>
                );
              })
            )}
          </div>

          {commentHasMore ? (
            <div className="mt-3 flex justify-center">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={commentsLoading}
                onClick={() => void loadComments("append")}
              >
                {commentsLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                加载更多评论
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}
    </article>
    <Dialog
      open={Boolean(reportTarget)}
      onOpenChange={(open) => {
        if (!open && !reporting) {
          setReportTarget(null);
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{reportTarget?.title ?? "内容举报"}</DialogTitle>
          <DialogDescription>
            提交后管理员会在内容治理台处理该内容。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block text-sm font-medium text-foreground">
            举报原因
            <Select
              value={reportReason}
              onValueChange={(nextValue) => {
                if (nextValue) {
                  setReportReason(nextValue);
                }
              }}
              disabled={reporting}
            >
              <SelectTrigger
                className="mt-1 h-10 w-full rounded-md"
                aria-label="举报原因"
              >
                <SelectValue placeholder="选择举报原因" />
              </SelectTrigger>
              <SelectContent
                align="start"
                alignItemWithTrigger={false}
                sideOffset={6}
                className="z-[70]"
              >
                {REPORT_REASON_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="block text-sm font-medium text-foreground">
            补充说明
            <textarea
              value={reportDescription}
              onChange={(event) => setReportDescription(event.target.value)}
              disabled={reporting}
              rows={4}
              maxLength={500}
              placeholder="可选，说明具体问题"
              className="mt-1 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm leading-6 outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-blue-500/20 disabled:opacity-60"
            />
          </label>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={reporting}
            onClick={() => setReportTarget(null)}
          >
            取消
          </Button>
          <Button
            type="button"
            disabled={reporting}
            onClick={() => void handleReportSubmit()}
          >
            {reporting ? <Loader2 className="size-4 animate-spin" /> : null}
            提交举报
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
