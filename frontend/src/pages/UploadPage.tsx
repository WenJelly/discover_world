import { useState } from "react";
import { ImagePlus, Upload } from "lucide-react";
import { UploadDialog } from "@/components/upload/UploadDialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import type { MediaAssetResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

type AuditBadge = { label: string; className: string };

function auditBadge(status: string): AuditBadge {
  if (status === "approved") {
    return { label: "已通过", className: "bg-emerald-500/10 text-emerald-600" };
  }
  if (status === "rejected") {
    return { label: "未通过", className: "bg-destructive/10 text-destructive" };
  }
  return { label: "审核中", className: "bg-muted text-muted-foreground" };
}

function UploadListItem({ asset }: { asset: MediaAssetResponse }) {
  const thumb = asset.thumbnailUrl || asset.urls?.thumbnail || asset.url;
  const ext = (asset.fileExt || "").replace(/^\./, "").toUpperCase();
  const meta = [asset.category || "未分类", ext].filter(Boolean).join(" · ");
  const badge = auditBadge(asset.auditStatus);

  return (
    <li className="flex items-center gap-4 rounded-lg border border-border bg-card p-3 sm:p-4">
      <div className="size-14 shrink-0 overflow-hidden rounded-md bg-muted">
        {thumb ? (
          <img
            src={thumb}
            alt={asset.title}
            className="size-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <ImagePlus className="size-5" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {asset.title}
        </p>
        {meta ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{meta}</p>
        ) : null}
      </div>
      <span
        className={cn(
          "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium",
          badge.className
        )}
      >
        {badge.label}
      </span>
    </li>
  );
}

function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm">
        <ImagePlus className="size-6" />
      </div>
      <h2 className="mt-5 text-base font-medium text-foreground">
        还没有上传作品
      </h2>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        点击上方「上传图片」按钮，选择一张作品。上传后进入社区审核，通过后向所有人公开浏览与下载。
      </p>
      <Button size="lg" className="mt-6" onClick={onUpload}>
        <Upload />
        上传图片
      </Button>
    </div>
  );
}

export default function UploadPage() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploaded, setUploaded] = useState<MediaAssetResponse[]>([]);

  const handleUploaded = (asset: MediaAssetResponse) => {
    setUploaded((prev) => [asset, ...prev]);
    toast({
      title: "图片上传成功",
      description: `「${asset.title}」已提交，审核通过后向所有人公开。`,
      variant: "success",
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center bg-background px-4 pt-16">
        <div className="flex flex-col items-center text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Upload className="size-6" />
          </div>
          <h1 className="mt-5 text-xl font-semibold text-foreground">
            需要登录
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            登录后即可上传作品到社区。
          </p>
          <a
            href="/"
            className="mt-6 text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            返回首页
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-16">
      <header className="border-b border-border bg-background">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1.5">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                上传作品
              </h1>
              <p className="text-sm text-muted-foreground">
                分享你的摄影作品，上传后进入社区审核，通过后向所有人公开。
              </p>
            </div>
            <Button size="lg" onClick={() => setDialogOpen(true)}>
              <Upload />
              上传图片
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {uploaded.length === 0 ? (
          <EmptyState onUpload={() => setDialogOpen(true)} />
        ) : (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-muted-foreground">
                本次会话已上传 {uploaded.length} 张
              </h2>
            </div>
            <ul className="space-y-3">
              {uploaded.map((asset) => (
                <UploadListItem key={asset.id} asset={asset} />
              ))}
            </ul>
          </section>
        )}
      </main>

      <UploadDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onUploaded={handleUploaded}
      />
    </div>
  );
}
