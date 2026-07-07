import { ThumbsUp, Eye, Download } from "lucide-react";
import { useEffect, useRef } from "react";
import { motion, useAnimationControls, useReducedMotion } from "framer-motion";
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
  { key: "reactionCount", label: "点赞", icon: ThumbsUp, activeClass: "fill-blue-500 text-blue-500" },
  { key: "viewCount", label: "浏览", icon: Eye, activeClass: "" },
  { key: "downloadCount", label: "下载", icon: Download, activeClass: "" },
];

interface PhotoStatsProps {
  stats: MediaAssetStats;
  /** Highlights the like icon when the viewer has reacted. */
  isLiked?: boolean;
  likePending?: boolean;
  likeAnimationKey?: number;
  onToggleLike?: () => void;
  className?: string;
}

/** Three horizontal interaction stats: likes, views, downloads. */
export function PhotoStats({
  stats,
  isLiked = false,
  likePending = false,
  likeAnimationKey = 0,
  onToggleLike,
  className,
}: PhotoStatsProps) {
  const prefersReducedMotion = useReducedMotion();
  const likeControls = useAnimationControls();
  const lastLikeAnimationKeyRef = useRef(likeAnimationKey);

  useEffect(() => {
    if (likeAnimationKey <= 0 || likeAnimationKey === lastLikeAnimationKeyRef.current) {
      lastLikeAnimationKeyRef.current = likeAnimationKey;
      likeControls.set({ scale: 1, opacity: 1 });
      return;
    }

    lastLikeAnimationKeyRef.current = likeAnimationKey;

    if (prefersReducedMotion) {
      likeControls.set({ scale: 1, opacity: 1 });
      return;
    }

    void likeControls.start({
      scale: [1, 1.28, 0.86, 1.12, 1],
      opacity: 1,
      transition: { duration: 0.45, ease: "easeOut" as const },
    });
  }, [likeAnimationKey, likeControls, prefersReducedMotion]);

  return (
    <div className={cn("flex flex-wrap justify-start gap-x-8 gap-y-3", className)}>
      {STATS.map(({ key, label, icon: Icon, activeClass }) => {
        const active = key === "reactionCount" && isLiked;
        const isLike = key === "reactionCount";
        const iconTone = active ? "text-blue-500" : "text-slate-500";
        const content = (
          <>
            <span
              className={cn(
                "flex size-9 items-center justify-center",
                iconTone
              )}
            >
              {isLike ? (
                <motion.span
                  className="inline-flex"
                  initial={false}
                  animate={isLike ? likeControls : undefined}
                >
                  <Icon
                    className={cn("size-5", active && activeClass)}
                    aria-hidden="true"
                  />
                </motion.span>
              ) : (
                <Icon
                  className={cn("size-5", active && activeClass)}
                  aria-hidden="true"
                />
              )}
            </span>
            <span className="flex min-w-0 items-baseline justify-center gap-1.5">
              <span className="text-base font-semibold leading-none text-slate-950">
                {formatCount(stats[key] ?? 0)}
              </span>
              <span className="text-[11px] leading-none text-slate-500">{label}</span>
            </span>
          </>
        );

        if (isLike && onToggleLike) {
          return (
            <button
              key={key}
              type="button"
              className="flex min-w-[76px] cursor-pointer items-center justify-center gap-2 rounded-none px-0 py-1 text-center transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-default disabled:opacity-60"
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
          <div key={key} className="flex min-w-[76px] items-center justify-center gap-2 px-0 py-1 text-center">
            {content}
          </div>
        );
      })}
    </div>
  );
}
