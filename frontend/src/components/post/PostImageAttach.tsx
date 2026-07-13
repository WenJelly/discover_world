import { useId, useRef, type ChangeEvent } from "react";
import { ImagePlus, X } from "lucide-react";
import { toast as sonner } from "sonner";
import { cn } from "@/lib/utils";

export const POST_MAX_IMAGES = 9;
const MAX_FILE_SIZE = 20 * 1024 * 1024;

export type AttachedImage = {
  clientId: string;
  id?: string;
  file: File;
  thumbUrl: string;
  fileName: string;
};

export type PostImageAttachProps = {
  images: AttachedImage[];
  onAdd: (image: AttachedImage) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
  inputId?: string;
  showAddTile?: boolean;
  className?: string;
};

function imageGridClass(count: number) {
  if (count >= 7) return "grid-cols-3 max-w-[420px] gap-1.5";
  if (count >= 4) return "grid-cols-3 max-w-[450px] gap-1.5";
  return count > 1 ? "grid-cols-3 max-w-[480px] gap-1.5" : "";
}

function imageItemClass(count: number) {
  if (count === 1) return "max-h-[220px] max-w-[360px]";
  return "aspect-square";
}

/**
 * Multi-image attach for the post composer. It only creates local previews on
 * selection; publishing owns the actual media upload and post creation.
 */
export function PostImageAttach({
  images,
  onAdd,
  onRemove,
  disabled,
  inputId,
  showAddTile = true,
  className,
}: PostImageAttachProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const generatedInputId = useId();
  const resolvedInputId = inputId ?? generatedInputId;
  const reached = images.length >= POST_MAX_IMAGES;

  const handlePick = async (event: ChangeEvent<HTMLInputElement>) => {
    const pickedFiles = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (pickedFiles.length === 0) return;

    if (images.length >= POST_MAX_IMAGES) {
      sonner.warning("图片已达上限", {
        description: `一条动态最多 ${POST_MAX_IMAGES} 张图片。`,
      });
      return;
    }

    const remaining = POST_MAX_IMAGES - images.length;
    const selectedFiles = pickedFiles.slice(0, remaining);
    if (pickedFiles.length > remaining) {
      sonner.warning("已达到图片上限", {
        description: `本次只添加前 ${remaining} 张，一条动态最多 ${POST_MAX_IMAGES} 张图片。`,
      });
    }

    const validFiles = selectedFiles.filter((file) => {
      if (!file.type.startsWith("image/")) {
        sonner.warning("请选择图片文件", {
          description: `${file.name} 不是支持的图片格式。`,
        });
        return false;
      }
      if (file.size > MAX_FILE_SIZE) {
        sonner.warning("图片过大", {
          description: `${file.name} 超过 20MB，已跳过。`,
        });
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    for (const file of validFiles) {
      const objectUrl = URL.createObjectURL(file);
      onAdd({
        clientId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        thumbUrl: objectUrl,
        fileName: file.name,
      });
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {images.length > 0 ? (
        images.length === 1 ? (
          <div
            className={cn(
              "group relative inline-block align-top",
              imageItemClass(images.length)
            )}
          >
            {images[0].thumbUrl ? (
              <img
                src={images[0].thumbUrl}
                alt={images[0].fileName}
                loading="lazy"
                className="block h-auto max-h-[220px] w-auto max-w-[360px] object-contain"
              />
            ) : (
              <div className="flex size-full min-h-24 items-center justify-center text-muted-foreground">
                <ImagePlus className="size-6" />
              </div>
            )}
            <button
              type="button"
              onClick={() => onRemove(images[0].clientId)}
              disabled={disabled}
              className="absolute right-1.5 top-1.5 inline-flex size-6 items-center justify-center rounded-full bg-slate-950/65 text-white shadow-sm backdrop-blur-sm transition hover:bg-slate-950/80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-blue-500/20 disabled:opacity-50"
              aria-label="移除图片"
            >
              <X className="size-3" />
            </button>
          </div>
        ) : images.length > 1 ? (
          <div className={cn("grid", imageGridClass(images.length))}>
            {images.slice(0, POST_MAX_IMAGES).map((image) => (
              <div
                key={image.clientId}
                className={cn(
                  "group relative overflow-hidden bg-muted",
                  imageItemClass(images.length)
                )}
              >
                {image.thumbUrl ? (
                  <img
                    src={image.thumbUrl}
                    alt={image.fileName}
                    loading="lazy"
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full min-h-24 items-center justify-center text-muted-foreground">
                    <ImagePlus className="size-6" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => onRemove(image.clientId)}
                  disabled={disabled}
                  className="absolute right-1.5 top-1.5 inline-flex size-6 items-center justify-center rounded-full bg-slate-950/65 text-white shadow-sm backdrop-blur-sm transition hover:bg-slate-950/80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-blue-500/20 disabled:opacity-50"
                  aria-label="移除图片"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        ) : null
      ) : null}

      {showAddTile ? (
        <div className="flex flex-wrap gap-2">
          {!reached ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={disabled}
              className="flex size-20 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border bg-muted/30 text-muted-foreground outline-none transition-colors hover:border-foreground/25 hover:bg-muted/60 focus-visible:border-blue-500 focus-visible:ring-3 focus-visible:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="添加图片"
            >
              <ImagePlus className="size-5" />
              <span className="text-[10px] tabular-nums">
                {images.length}/{POST_MAX_IMAGES}
              </span>
            </button>
          ) : null}
        </div>
      ) : null}

      <input
        id={resolvedInputId}
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        disabled={disabled || reached}
        className="sr-only"
        tabIndex={-1}
        onChange={handlePick}
      />

      {images.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          已添加 {images.length}/{POST_MAX_IMAGES} 张图片。
        </p>
      ) : null}
    </div>
  );
}
