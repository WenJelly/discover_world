import { Heart, Eye, Download } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { formatCount } from "@/lib/format";
import type { MediaAssetStats } from "@/lib/types";
import { cn } from "@/lib/utils";

interface StatDef {
  key: keyof Pick<MediaAssetStats, "reactionCount" | "viewCount" | "downloadCount">;
  label: string;
  icon: LucideIcon;
  /** Applied to the icon when this stat is "active" (e.g. liked). */
  activeClass: string;
}

const STATS: StatDef[] = [
  { key: "reactionCount", label: "点赞", icon: Heart, activeClass: "fill-rose-500 text-rose-500" },
  { key: "viewCount", label: "浏览", icon: Eye, activeClass: "" },
  { key: "downloadCount", label: "下载", icon: Download, activeClass: "" },
];

interface PhotoStatsProps {
  stats: MediaAssetStats;
  /** Highlights the like icon when the viewer has reacted. */
  isLiked?: boolean;
  likePending?: boolean;
  onToggleLike?: () => void;
  className?: string;
}

/** Three horizontal interaction stats: likes, views, downloads. */
export function PhotoStats({
  stats,
  isLiked = false,
  likePending = false,
  onToggleLike,
  className,
}: PhotoStatsProps) {
  return (
    <div className={cn("flex flex-wrap justify-start gap-x-8 gap-y-3", className)}>
      {STATS.map(({ key, label, icon: Icon, activeClass }) => {
        const active = key === "reactionCount" && isLiked;
        const isLike = key === "reactionCount";
        const iconTone = isLike
          ? "rounded-full bg-rose-50 text-rose-500"
          : "rounded-full bg-slate-100 text-slate-500";
        const content = (
          <>
            <span
              className={cn(
                "flex size-8 items-center justify-center",
                iconTone
              )}
            >
              <Icon
                className={cn("size-4", isLike && activeClass, active && activeClass)}
                aria-hidden="true"
              />
            </span>
            <span className="min-w-0">
              <span className="block text-base font-semibold leading-none text-slate-950">
                {formatCount(stats[key] ?? 0)}
              </span>
              <span className="mt-0.5 block text-[11px] text-slate-500">{label}</span>
            </span>
          </>
        );

        if (isLike && onToggleLike) {
          return (
            <button
              key={key}
              type="button"
              className="flex min-w-[76px] items-center justify-start gap-2 rounded-none px-0 py-1 text-left transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-60"
              onClick={onToggleLike}
              disabled={likePending}
              aria-pressed={isLiked}
              aria-label={isLiked ? "取消点赞" : "点赞"}
            >
              {content}
            </button>
          );
        }

        return (
          <div key={key} className="flex min-w-[76px] items-center justify-start gap-2 px-0 py-1">
            {content}
          </div>
        );
      })}
    </div>
  );
}
