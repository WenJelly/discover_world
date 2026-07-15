import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ImagePlus, Link as LinkIcon, Upload, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { uploadMediaAsset, uploadMediaAssetByUrl } from "@/lib/api";
import { notifyMediaAssetUploaded } from "@/lib/media-events";
import { interactiveSurfaceClassName } from "@/lib/interactive-surface";
import {
  isSupportedUploadImageFile,
  MEDIA_UPLOAD_ACCEPT,
  type MediaUploadMetadata,
} from "@/lib/media-upload";
import type { MediaAssetResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const EXIT_ANIMATION_MS = 220;
const MAX_URL_LENGTH = 2048;

type UploadMode = "local" | "url";

export type UploadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded?: (asset: MediaAssetResponse) => void;
  defaultMetadata?: Partial<MediaUploadMetadata>;
};

type UploadStatus = "idle" | "preview" | "uploading" | "success";

function stripExtension(name: string) {
  const cleaned = name.trim();
  const dot = cleaned.lastIndexOf(".");
  return dot <= 0 ? cleaned : cleaned.slice(0, dot);
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function UploadDialog({
  open,
  onOpenChange,
  onUploaded,
  defaultMetadata,
}: UploadDialogProps) {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [previewUrl, setPreviewUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState("");
  const [mode, setMode] = useState<UploadMode>("local");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [uploadedAsset, setUploadedAsset] = useState<MediaAssetResponse | null>(
    null
  );

  const [title, setTitle] = useState(defaultMetadata?.title ?? "");
  const [description, setDescription] = useState(
    defaultMetadata?.description ?? ""
  );
  const [category, setCategory] = useState(defaultMetadata?.category ?? "");
  const [tags, setTags] = useState(
    defaultMetadata?.tags?.join(", ") ?? ""
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const objectUrlRef = useRef("");

  const revokePreview = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = "";
    }
  }, []);

  const resetForm = useCallback(() => {
    revokePreview();
    setStatus("idle");
    setPreviewUrl("");
    setFile(null);
    setFileUrl("");
    setMode("local");
    setError("");
    setUploadedAsset(null);
    setTitle(defaultMetadata?.title ?? "");
    setDescription(defaultMetadata?.description ?? "");
    setCategory(defaultMetadata?.category ?? "");
    setTags(defaultMetadata?.tags?.join(", ") ?? "");
    if (inputRef.current) inputRef.current.value = "";
  }, [
    revokePreview,
    defaultMetadata?.title,
    defaultMetadata?.description,
    defaultMetadata?.category,
    defaultMetadata?.tags,
  ]);

  // Reset to a fresh idle state once the dialog finishes closing so the next
  // open doesn't flash the previous upload's preview/success state.
  useEffect(() => {
    if (open) return;
    const id = window.setTimeout(() => resetForm(), EXIT_ANIMATION_MS);
    return () => window.clearTimeout(id);
  }, [open, resetForm]);

  // Never leak object URLs.
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const selectFile = useCallback(
    (selectedFile: File) => {
      if (!isSupportedUploadImageFile(selectedFile)) {
        setError("请选择 JPG、PNG 或 WebP 图片");
        return;
      }
      if (selectedFile.size > MAX_FILE_SIZE) {
        setError("图片大小不能超过 20MB");
        return;
      }
      revokePreview();
      const url = URL.createObjectURL(selectedFile);
      objectUrlRef.current = url;
      setPreviewUrl(url);
      setFile(selectedFile);
      setFileUrl("");
      setError("");
      setStatus("preview");
      if (!title && !defaultMetadata?.title) {
        setTitle(stripExtension(selectedFile.name) || "未命名作品");
      }
    },
    [revokePreview, title, defaultMetadata?.title]
  );

  const selectUrl = useCallback(() => {
    const trimmed = fileUrl.trim();
    if (!trimmed) {
      setError("请输入图片 URL");
      return;
    }
    if (trimmed.length > MAX_URL_LENGTH) {
      setError("URL 过长，请检查后再试");
      return;
    }
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      setError("请输入有效的图片 URL");
      return;
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      setError("仅支持 http 或 https 图片 URL");
      return;
    }
    revokePreview();
    setPreviewUrl(trimmed);
    setFile(null);
    setError("");
    setStatus("preview");
    if (!title && !defaultMetadata?.title) {
      setTitle(stripExtension(parsed.pathname.split("/").filter(Boolean).pop() ?? "") || "远程图片");
    }
  }, [fileUrl, revokePreview, title, defaultMetadata?.title]);

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = event.target.files?.[0];
      if (selectedFile) selectFile(selectedFile);
    },
    [selectFile]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      dragCounter.current = 0;
      setDragOver(false);
      const droppedFile = event.dataTransfer.files?.[0];
      if (droppedFile) selectFile(droppedFile);
    },
    [selectFile]
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDragEnter = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    dragCounter.current += 1;
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setDragOver(false);
    }
  }, []);

  const handleUpload = async () => {
    const isUrlMode = mode === "url";
    const sourceReady = isUrlMode ? fileUrl.trim().length > 0 : !!file;
    if (!sourceReady || !title.trim()) return;
    setStatus("uploading");
    setError("");
    try {
      const metadata: MediaUploadMetadata = {
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        category: category.trim() || undefined,
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        visibility: "public",
      };
      const asset = isUrlMode
        ? await uploadMediaAssetByUrl(fileUrl.trim(), metadata)
        : await uploadMediaAsset(file as File, metadata);
      notifyMediaAssetUploaded(asset);
      setUploadedAsset(asset);
      setStatus("success");
      onUploaded?.(asset);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败，请重试");
      setStatus("preview");
    }
  };

  const handleOpenChange = (next: boolean) => {
    // Don't let an in-flight upload be killed by ESC / backdrop / X.
    if (!next && status === "uploading") return;
    onOpenChange(next);
  };

  const triggerFilePicker = () => inputRef.current?.click();

  const handleDropzoneKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      triggerFilePicker();
    }
  };

  const removeFile = () => {
    revokePreview();
    setPreviewUrl("");
    setFile(null);
    setFileUrl("");
    setStatus("idle");
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const isUploading = status === "uploading";
  const isUrlMode = mode === "url";
  const canSubmit = isUrlMode
    ? fileUrl.trim().length > 0 && title.trim().length > 0
    : !!file && title.trim().length > 0;
  const textareaClass =
    "flex min-h-[84px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-blue-500 focus-visible:ring-3 focus-visible:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={!isUploading}
        className={cn(
          "flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden rounded-xl p-0 sm:max-w-xl"
        )}
      >
        <DialogHeader className="flex flex-col gap-1.5 border-b border-border px-6 py-5 pr-12 text-left">
          <DialogTitle className="text-base font-semibold leading-none">
            上传图片
          </DialogTitle>
          <DialogDescription>
            支持 JPG / PNG / WebP，单张最大 20MB。上传后进入社区审核，通过后向所有人公开。
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {status === "success" && uploadedAsset ? (
            <div className="flex flex-col items-center justify-center gap-4 py-6 text-center">
              <div className="flex size-11 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                <Check className="size-5" strokeWidth={2.5} />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">上传成功</p>
                <p className="text-sm text-muted-foreground">
                  「{uploadedAsset.title}」已提交，审核通过后向所有人公开。
                </p>
              </div>
            </div>
          ) : status === "idle" ? (
            <div className="space-y-4">
              <Tabs
                value={mode}
                onValueChange={(value) => {
                  const next = value as UploadMode;
                  if (next === mode) return;
                  // Switching sources invalidates the current preview — start
                  // fresh so we never submit a stale file/url from the other tab.
                  revokePreview();
                  setPreviewUrl("");
                  setFile(null);
                  setFileUrl("");
                  setStatus("idle");
                  setError("");
                  if (inputRef.current) inputRef.current.value = "";
                  setMode(next);
                }}
              >
                <TabsList aria-label="上传方式">
                  <TabsTrigger value="local">
                    <ImagePlus className="size-4" />
                    本地上传
                  </TabsTrigger>
                  <TabsTrigger value="url">
                    <LinkIcon className="size-4" />
                    URL 上传
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="local">
                  <div
                    data-slot="interactive-surface"
                    role="button"
                    tabIndex={0}
                    aria-label="选择图片文件"
                    onClick={triggerFilePicker}
                    onKeyDown={handleDropzoneKeyDown}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    className={cn(
                      "flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center hover:border-foreground/25 hover:bg-muted/60",
                      interactiveSurfaceClassName,
                      dragOver && "border-primary bg-muted/80"
                    )}
                  >
                    <input
                      ref={inputRef}
                      type="file"
                      accept={MEDIA_UPLOAD_ACCEPT}
                      onChange={handleInputChange}
                      className="sr-only"
                      tabIndex={-1}
                    />
                    <div className="flex size-11 items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm">
                      <ImagePlus className="size-5" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        点击选择或拖拽图片到此处
                      </p>
                      <p className="text-xs text-muted-foreground">
                        JPG / PNG / WebP · 最大 20MB
                      </p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="url">
                  <div className="space-y-3 rounded-lg border border-dashed border-border bg-muted/30 p-6">
                    <div className="flex size-11 items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm">
                      <LinkIcon className="size-5" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="upload-url">图片 URL</Label>
                      <Input
                        id="upload-url"
                        type="url"
                        inputMode="url"
                        autoComplete="off"
                        spellCheck={false}
                        value={fileUrl}
                        onChange={(event) => setFileUrl(event.target.value)}
                        placeholder="https://example.com/image.jpg"
                        maxLength={MAX_URL_LENGTH}
                      />
                      <p className="text-xs text-muted-foreground">
                        粘贴公开图片链接，图片来源需允许浏览器跨域读取。
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={selectUrl}
                      disabled={!fileUrl.trim()}
                    >
                      预览图片
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>

              {error ? (
                <p className="text-xs text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="relative overflow-hidden rounded-lg border border-border bg-muted">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="预览"
                      className="max-h-[260px] w-full object-cover"
                    />
                  ) : null}
                  {!isUploading ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon-sm"
                      onClick={removeFile}
                      className="absolute right-2 top-2"
                      aria-label="移除图片"
                    >
                      <X className="size-4" />
                    </Button>
                  ) : null}
                </div>
                {file ? (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="truncate">{file.name}</span>
                    <span aria-hidden>·</span>
                    <span className="shrink-0">
                      {formatFileSize(file.size)}
                    </span>
                  </p>
                ) : isUrlMode && fileUrl ? (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <LinkIcon className="size-3.5 shrink-0" />
                    <span className="truncate">{fileUrl.trim()}</span>
                  </p>
                ) : null}
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="upload-title">
                    标题 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="upload-title"
                    type="text"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="为这张图片起个名字"
                    maxLength={100}
                    aria-required
                    disabled={isUploading}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="upload-description">描述</Label>
                  <textarea
                    id="upload-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="介绍一下这张图片……"
                    rows={3}
                    maxLength={500}
                    disabled={isUploading}
                    className={textareaClass}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="upload-category">分类</Label>
                    <Input
                      id="upload-category"
                      type="text"
                      value={category}
                      onChange={(event) => setCategory(event.target.value)}
                      placeholder="风光、人像、街拍……"
                      maxLength={50}
                      disabled={isUploading}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="upload-tags">标签</Label>
                    <Input
                      id="upload-tags"
                      type="text"
                      value={tags}
                      onChange={(event) => setTags(event.target.value)}
                      placeholder="逗号分隔，如：自然, 日落"
                      maxLength={200}
                      disabled={isUploading}
                    />
                  </div>
                </div>
              </div>

              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border px-6 py-4">
          {status === "success" ? (
            <>
              <Button
                variant="outline"
                size="lg"
                onClick={resetForm}
              >
                继续上传
              </Button>
              <Button size="lg" onClick={() => handleOpenChange(false)}>
                完成
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="lg"
                onClick={() => handleOpenChange(false)}
                disabled={isUploading}
              >
                取消
              </Button>
              <Button
                size="lg"
                onClick={handleUpload}
                disabled={!canSubmit || isUploading}
                aria-busy={isUploading}
              >
                {isUploading ? (
                  <>
                    <Spinner aria-label="加载中" />
                    上传中…
                  </>
                ) : error ? (
                  <>
                    <Upload />
                    重试上传
                  </>
                ) : (
                  <>
                    <Upload />
                    上传图片
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
