import { useRef, useState, type ChangeEvent } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadMediaAsset } from "@/lib/api";
import { notifyMediaAssetUploaded } from "@/lib/media-events";
import { useToast } from "@/hooks/use-toast";

const MAX_FILE_SIZE = 20 * 1024 * 1024;

export type ImageAttachButtonProps = {
  onUploaded: (assetId: string) => void;
  disabled?: boolean;
};

/**
 * Lightweight inline image attach for contexts that only need to upload a
 * single image and collect its asset id (e.g. the post composer). For the
 * full metadata entry flow, use UploadDialog instead.
 */
export function ImageAttachButton({
  onUploaded,
  disabled,
}: ImageAttachButtonProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handlePick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

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
      const asset = await uploadMediaAsset(file, { visibility: "public" });
      notifyMediaAssetUploaded(asset);
      onUploaded(asset.id);
      toast({
        title: "图片已添加",
        description: asset.title ? `「${asset.title}」已上传。` : "图片已上传。",
        variant: "success",
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
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || uploading}
      >
        {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
        添加图片
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handlePick}
        className="sr-only"
        tabIndex={-1}
      />
    </>
  );
}
