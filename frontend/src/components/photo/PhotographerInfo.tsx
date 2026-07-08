import { BadgeCheck, Check, Loader2, MapPin } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getAvatarFallback } from "@/lib/format";
import type { AccountSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PhotographerInfoProps {
  author: AccountSummary | null;
  /** Author's region, e.g. "中国 · 四川". No backend field yet — optional. */
  location?: string;
  /** Whether the current viewer already follows this author. */
  isFollowing?: boolean;
  /** In-flight follow/unfollow request. */
  followPending?: boolean;
  /** Hide the follow button (e.g. viewing your own work). */
  hideFollow?: boolean;
  onToggleFollow?: () => void;
  className?: string;
}

/** Author identity block: avatar, name (+ verified), bio, region, follow CTA. */
export function PhotographerInfo({
  author,
  location,
  isFollowing = false,
  followPending = false,
  hideFollow = false,
  onToggleFollow,
  className,
}: PhotographerInfoProps) {
  const name = author?.nickname || author?.username || "林间摄影师";
  const bio = author?.bio || "摄影师 | 风光爱好者";
  const isAdminAuthor = author?.role === "admin";

  return (
    <div className={cn("flex items-start gap-3", className)}>
      <Avatar className="size-14 shrink-0">
        {author?.avatarUrl ? (
          <AvatarImage src={author.avatarUrl} alt={name} />
        ) : null}
        <AvatarFallback>{getAvatarFallback(name)}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <h3 className="truncate text-lg font-semibold leading-tight text-slate-950">
            {name}
          </h3>
          {isAdminAuthor ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-yellow-500">
              <BadgeCheck
                aria-label="管理员认证"
                role="img"
                className="size-[18px] fill-yellow-500/20"
                strokeWidth={2.4}
              />
              <span>管理员</span>
            </span>
          ) : null}
        </div>
        {bio ? (
          <p className="mt-1 line-clamp-1 text-[13px] text-slate-500">
            {bio}
          </p>
        ) : null}
        {location ? (
          <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-slate-500">
            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{location}</span>
          </p>
        ) : null}
      </div>

      {!hideFollow ? (
        <Button
          type="button"
          size="sm"
          variant={isFollowing ? "outline" : "default"}
          className={cn(
            "h-9 w-[72px] shrink-0 rounded-none px-0 text-sm font-medium",
            isFollowing
              ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              : "border border-[#b9c9ff] bg-white text-blue-600 hover:bg-blue-50 hover:text-blue-700"
          )}
          disabled={followPending}
          onClick={onToggleFollow}
          aria-pressed={isFollowing}
        >
          {followPending ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : null}
          {isFollowing && !followPending ? (
            <Check className="size-3.5" aria-hidden="true" />
          ) : null}
          {isFollowing ? "已关注" : "关注"}
        </Button>
      ) : null}
    </div>
  );
}
