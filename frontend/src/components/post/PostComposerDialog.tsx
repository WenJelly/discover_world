import { useEffect, useRef, useState } from "react";
import { toast as sonner } from "sonner";
import {
  AtSign,
  Hash,
  ImagePlus,
  Send,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ApiError, createPost, uploadMediaAsset } from "@/lib/api";
import { notifyMediaAssetUploaded } from "@/lib/media-events";
import { getAvatarFallback } from "@/lib/format";
import { POST_TYPE_OPTIONS } from "@/lib/post-type";
import type { PostType, ProfilePostResponse } from "@/lib/types";
import {
  POST_MAX_IMAGES,
  PostImageAttach,
  type AttachedImage,
} from "./PostImageAttach";
import { PostVisibilityMenu } from "./PostVisibilityMenu";

const EXIT_ANIMATION_MS = 220;
const POST_IMAGE_INPUT_ID = "post-composer-image-input";

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

function revokeImagePreview(image: AttachedImage) {
  URL.revokeObjectURL(image.thumbUrl);
}

export function PostComposerDialog({
  open,
  onOpenChange,
  onPublished,
  author,
}: PostComposerDialogProps) {
  const [content, setContent] = useState("");
  const [images, setImages] = useState<AttachedImage[]>([]);
  const [postType, setPostType] = useState<PostType>("daily");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Reset to a fresh state once the dialog finishes closing.
  useEffect(() => {
    if (open) return;
    const id = window.setTimeout(() => {
      setContent("");
      images.forEach(revokeImagePreview);
      setImages([]);
      setPostType("daily");
      setVisibility("public");
      setError("");
    }, EXIT_ANIMATION_MS);
    return () => window.clearTimeout(id);
  }, [images, open]);

  const canSubmit =
    (content.trim().length > 0 || images.length > 0) && !submitting;
  const denseImageGrid = images.length >= 7;
  const textAreaClassName = denseImageGrid ? "min-h-[160px]" : "min-h-[210px]";

  const handleOpenChange = (next: boolean) => {
    if (!next && submitting) return;
    onOpenChange(next);
  };

  const handleImageToolClick = () => {
    if (images.length >= POST_MAX_IMAGES) {
      sonner.warning("图片已达上限", {
        description: `一条动态最多 ${POST_MAX_IMAGES} 张图片。`,
      });
      return;
    }
    document.getElementById(POST_IMAGE_INPUT_ID)?.click();
  };

  const insertTextAtCursor = (insertText: string, caretOffset = insertText.length) => {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? content.length;
    const end = textarea?.selectionEnd ?? content.length;
    const next = `${content.slice(0, start)}${insertText}${content.slice(end)}`;
    const caret = Math.min(start + caretOffset, next.length);

    setContent(next);
    window.requestAnimationFrame(() => {
      const current = textareaRef.current;
      current?.focus();
      current?.setSelectionRange(caret, caret);
    });
  };

  const handleRemoveImage = (clientId: string) => {
    setImages((prev) => {
      const removed = prev.find((image) => image.clientId === clientId);
      if (removed) {
        revokeImagePreview(removed);
      }
      return prev.filter((image) => image.clientId !== clientId);
    });
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      const uploadedImageIds: string[] = [];
      for (const image of images) {
        if (image.id) {
          uploadedImageIds.push(image.id);
          continue;
        }

        const asset = await uploadMediaAsset(image.file, {
          visibility: "public",
          assetUsage: "post",
        });
        notifyMediaAssetUploaded(asset);
        uploadedImageIds.push(asset.id);
        setImages((prev) =>
          prev.map((item) =>
            item.clientId === image.clientId ? { ...item, id: asset.id } : item
          )
        );
      }

      const post = await createPost({
        content: content.trim() || undefined,
        postType,
        visibility,
        imageIds: uploadedImageIds,
      });
      sonner.success("动态已发布", {
        description:
          visibility === "public"
            ? "所有人都可以看到这条动态。"
            : "这条动态仅自己可见。",
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
        showCloseButton={false}
        className="flex max-h-[min(94dvh,860px)] w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden rounded-2xl border-border bg-card p-0 shadow-[0_12px_40px_rgba(15,20,25,0.16)] sm:max-w-[600px]"
      >
        <DialogHeader className="flex-row items-center justify-between gap-3 border-b border-border px-4 py-3 text-left">
          <div>
            <DialogTitle className="text-lg font-semibold leading-none">
              分享新鲜事
            </DialogTitle>
            <DialogDescription className="sr-only">
              发布一条新的个人动态
            </DialogDescription>
          </div>
          <DialogClose
            aria-label="关闭弹窗"
            disabled={submitting}
            className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-blue-500/20 disabled:pointer-events-none disabled:opacity-50"
          >
            <X className="size-4" />
          </DialogClose>
        </DialogHeader>

        <div
          className="flex min-h-10 items-center gap-3 px-4 pb-2 pt-4"
          data-testid="post-composer-author-row"
        >
          <Avatar className="size-10 shrink-0">
            {author?.avatarUrl ? (
              <AvatarImage src={author.avatarUrl} alt={author.username} />
            ) : null}
            <AvatarFallback>
              {getAvatarFallback(author?.username ?? "用户")}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
            <div className="min-w-0" data-testid="post-composer-author-text">
              <p className="truncate text-[15px] font-semibold leading-tight text-foreground">
                {author?.username ?? "用户"}
              </p>
              {author?.handle ? (
                <p className="mt-0.5 truncate text-xs leading-tight text-muted-foreground">
                  {author.handle}
                </p>
              ) : null}
            </div>
            <PostVisibilityMenu
              value={visibility}
              onChange={setVisibility}
              ariaLabel="选择动态可见范围"
              disabled={submitting}
              buttonClassName="min-w-[6.75rem] shrink-0"
              menuClassName="z-30"
            />
          </div>
        </div>

        <div className="px-4 pb-2">
          <div
            className="inline-flex h-9 rounded-full border border-border bg-muted/40 p-0.5"
            role="group"
            aria-label="选择动态类型"
          >
            {POST_TYPE_OPTIONS.map((option) => {
              const active = option.value === postType;
              return (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={active ? "secondary" : "ghost"}
                  onClick={() => setPostType(option.value)}
                  disabled={submitting}
                  aria-pressed={active}
                >
                  {option.label}
                </Button>
              );
            })}
          </div>
        </div>

        <div
          className="min-h-0 overflow-y-auto px-4 pb-3"
          data-testid="post-composer-content-area"
        >
          <div
            className={textAreaClassName}
            data-testid="post-composer-text-area"
          >
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="有什么新鲜事想分享？"
              rows={denseImageGrid ? 5 : 7}
              disabled={submitting}
              autoFocus
              aria-label="动态内容"
              className={`${textAreaClassName} w-full resize-none border-0 bg-transparent px-0 py-2 text-lg leading-relaxed text-foreground outline-none placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-60`}
            />

            {error ? (
              <p className="mt-3 text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <div
            className={images.length > 0 ? "mt-3" : ""}
            data-testid="post-composer-image-area"
          >
            <PostImageAttach
              images={images}
              onAdd={(image) =>
                setImages((prev) =>
                  prev.length >= POST_MAX_IMAGES ? prev : [...prev, image]
                )
              }
              onRemove={handleRemoveImage}
              disabled={submitting}
              inputId={POST_IMAGE_INPUT_ID}
              showAddTile={false}
            />
          </div>
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-3 border-t border-border px-4 py-3 sm:justify-between">
          <div className="flex min-w-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleImageToolClick}
              disabled={submitting || images.length >= POST_MAX_IMAGES}
              aria-label="添加图片"
              title="图片"
            >
              <ImagePlus className="size-[18px]" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => insertTextAtCursor("#在这里输入话题# ", 1)}
              disabled={submitting}
              aria-label="插入话题"
              title="话题"
            >
              <Hash className="size-[18px]" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => insertTextAtCursor("@", 1)}
              disabled={submitting}
              aria-label="提醒谁看"
              title="提醒谁看"
            >
              <AtSign className="size-[18px]" />
            </Button>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            aria-busy={submitting}
          >
            {submitting ? (
              <>
                <Spinner />
                发布中...
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
