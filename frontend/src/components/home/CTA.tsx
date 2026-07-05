import { ArrowRight, Upload } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function CTA() {
  const { user } = useAuth();
  return (
    <section className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
      <div className="flex flex-col items-center gap-5 text-center">
        <h2 className="max-w-xl text-2xl font-semibold tracking-tight text-foreground text-balance sm:text-3xl">
          把你的作品放进世界
        </h2>
        <p className="max-w-md text-sm text-muted-foreground text-pretty">
          上传即进入社区审核，通过后向所有人开放浏览与下载。
        </p>
        <a
          href="/upload"
          className="mt-2 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          aria-label={user ? "上传照片" : "开始上传"}
        >
          <Upload size={16} aria-hidden="true" />
          {user ? "上传照片" : "开始上传"}
          <ArrowRight size={16} aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}
