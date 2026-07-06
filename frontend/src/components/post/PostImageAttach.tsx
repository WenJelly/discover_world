import { useRef, useState, type ChangeEvent } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { uploadMediaAsset } from "@/lib/api";
import { notifyMediaAssetUploaded } from "@/lib/media-events";
import { useToast } from "@/hooks/use-toast";

const MAX_IMAGES = 9;
const MAX_FILE_SIZE = 20 * 1024 * 1024;

export type AttachedImage = {
  id: string;
  thumbUrl: string;
  fileName: string;
};

export type PostImageAttachProps = {
  images: AttachedImage[];
  onAdd: (image: AttachedImage) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
};

/**
 * Multi-image attach for the post composer. Uploads each image via the media
 * endpoint and collects the returned asset IDs; the post-create call references
 * those IDs. Shows thumbnails with remove, enforces the 9-image cap.
 */
export function PostImageAttach({
  images,
  onAdd,
  onRemove,
  disabled,
}: PostImageAttachProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const reached = images.length >= MAX_IMAGES;

  const handlePick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (images.length >= MAX_IMAGES) {
      toast({
        title: "图片已达上限",
        description: `一条动态最多 ${MAX_IMAGES} 张图片。`,
        variant: "destructive",
      });
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast({
        title: "请选择图片文件",
        description: "仅支持 JPG / PNG / GIF / WebP。",
        variant: "destructive",
      });
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "图片过大",
        description: "单张不能超过 20MB。",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const asset = await uploadMediaAsset(file, {
        visibility: "public",
        assetUsage: "post",
      });
      notifyMediaAssetUploaded(asset);
      onAdd({
        id: asset.id,
        thumbUrl:
          asset.thumbnailUrl ||
          asset.urls?.thumbnail ||
          asset.urls?.preview ||
          asset.url,
        fileName: asset.originalFilename || file.name,
      });
    } catch (err) {
      toast({
        title: "上传失败",
        description: err instanceof Error ? err.message : "请稍后重试。",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {images.map((image) => (
          <div
            key={image.id}
            className="group relative size-20 overflow-hidden rounded-md border border-border bg-muted"
          >
            {image.thumbUrl ? (
              <img
                src={image.thumbUrl}
                alt={image.fileName}
                loading="lazy"
                className="size-full object-cover"
              />
            ) : (
              <div className="flex size-full items-center justify-center text-muted-foreground">
                <ImagePlus className="size-5" />
              </div>
            )}
            <button
              type="button"
              onClick={() => onRemove(image.id)}
              disabled={disabled}
              className="absolute right-1 top-1 inline-flex size-5 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm backdrop-blur-sm transition hover:bg-background focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-blue-500/20 disabled:opacity-50"
              aria-label="移除图片"
            >
              <X className="size-3" />
            </button>
          </div>
        ))}

        {!reached ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || uploading}
            className="flex size-20 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border bg-muted/30 text-muted-foreground outline-none transition-colors hover:border-foreground/25 hover:bg-muted/60 focus-visible:border-blue-500 focus-visible:ring-3 focus-visible:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="添加图片"
          >
            {uploading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <ImagePlus className="size-5" />
            )}
            <span className="text-[10px] tabular-nums">
              {images.length}/{MAX_IMAGES}
            </span>
          </button>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        onChange={handlePick}
      />

      {images.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          公开动态的图片需通过审核；若尚未通过，可先设为「仅自己可见」。
        </p>
      ) : null}
    </div>
  );
}
