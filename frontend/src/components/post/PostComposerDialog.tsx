import { useEffect, useState } from "react";
import { Loader2, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ApiError, createPost } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { getAvatarFallback } from "@/lib/format";
import type { ProfilePostResponse } from "@/lib/types";
import { PostImageAttach, type AttachedImage } from "./PostImageAttach";

const MAX_CONTENT = 2000;
const MAX_LOCATION = 255;
const EXIT_ANIMATION_MS = 220;

export type PostAuthor = {
  username: string;
  avatarUrl: string;
  handle?: string;
};

export type PostComposerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPublished?: (post: ProfilePostResponse) => void;
  author?: PostAuthor | null;
};

const textareaClass =
  "flex min-h-[120px] w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-blue-500 focus-visible:ring-3 focus-visible:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30";

const selectClass =
  "flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-[border-color,box-shadow] focus-visible:border-blue-500 focus-visible:ring-3 focus-visible:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30";

export function PostComposerDialog({
  open,
  onOpenChange,
  onPublished,
  author,
}: PostComposerDialogProps) {
  const { toast } = useToast();
  const [content, setContent] = useState("");
  const [images, setImages] = useState<AttachedImage[]>([]);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [location, setLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Reset to a fresh state once the dialog finishes closing.
  useEffect(() => {
    if (open) return;
    const id = window.setTimeout(() => {
      setContent("");
      setImages([]);
      setVisibility("public");
      setLocation("");
      setError("");
    }, EXIT_ANIMATION_MS);
    return () => window.clearTimeout(id);
  }, [open]);

  const canSubmit =
    (content.trim().length > 0 || images.length > 0) && !submitting;

  const showApprovalWarning = visibility === "public" && images.length > 0;

  const handleOpenChange = (next: boolean) => {
    if (!next && submitting) return;
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      const post = await createPost({
        content: content.trim() || undefined,
        visibility,
        location: location.trim() || undefined,
        imageIds: images.map((image) => image.id),
      });
      toast({
        title: "动态已发布",
        description:
          visibility === "public"
            ? "审核通过后向所有人公开。"
            : "已设为仅自己可见。",
        variant: "success",
      });
      onPublished?.(post);
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "发布失败，请重试"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={!submitting}
        className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden rounded-xl p-0 sm:max-w-xl"
      >
        <DialogHeader className="flex flex-col gap-1.5 border-b border-border px-6 py-5 pr-12 text-left">
          <DialogTitle className="text-base font-semibold leading-none">
            发表新动态
          </DialogTitle>
          <DialogDescription>分享你的想法、见闻或作品。</DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="flex gap-3">
            <Avatar className="size-10 shrink-0">
              {author?.avatarUrl ? (
                <AvatarImage
                  src={author.avatarUrl}
                  alt={author.username}
                />
              ) : null}
              <AvatarFallback>
                {getAvatarFallback(author?.username ?? "用户")}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="truncate text-sm font-medium text-foreground">
                {author?.username ?? "用户"}
              </p>
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="分享你的想法……"
                maxLength={MAX_CONTENT}
                rows={5}
                disabled={submitting}
                autoFocus
                className={textareaClass}
              />
              <p className="text-right text-xs tabular-nums text-muted-foreground">
                <span
                  className={
                    content.length > MAX_CONTENT * 0.9
                      ? "text-amber-600"
                      : undefined
                  }
                >
                  {content.length}
                </span>
                {" / "}
                {MAX_CONTENT}
              </p>
            </div>
          </div>

          <PostImageAttach
            images={images}
            onAdd={(image) =>
              setImages((prev) =>
                prev.length >= 9 ? prev : [...prev, image]
              )
            }
            onRemove={(id) =>
              setImages((prev) => prev.filter((image) => image.id !== id))
            }
            disabled={submitting}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="post-visibility">可见范围</Label>
              <select
                id="post-visibility"
                value={visibility}
                onChange={(event) =>
                  setVisibility(
                    event.target.value === "private" ? "private" : "public"
                  )
                }
                disabled={submitting}
                className={selectClass}
              >
                <option value="public">公开</option>
                <option value="private">仅自己可见</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="post-location">位置</Label>
              <Input
                id="post-location"
                type="text"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="可选"
                maxLength={MAX_LOCATION}
                disabled={submitting}
              />
            </div>
          </div>

          {showApprovalWarning ? (
            <p className="text-xs text-amber-600" role="note">
              新上传的图片需通过审核才能用于公开动态；若尚未通过，发布会被拒绝。可先设为「仅自己可见」。
            </p>
          ) : null}

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter className="border-t border-border px-6 py-4">
          <Button
            variant="outline"
            size="lg"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            取消
          </Button>
          <Button size="lg" onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? (
              <>
                <Loader2 className="animate-spin" />
                发布中…
              </>
            ) : (
              <>
                <Send />
                发布
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
