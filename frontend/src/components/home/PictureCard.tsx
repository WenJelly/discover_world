import { memo, useState } from "react";
import { Eye, Heart, ImageOff } from "lucide-react";
import type { PictureResponse } from "@/lib/types";

type PictureCardProps = {
  picture: PictureResponse;
};

function PictureCardImpl({ picture }: PictureCardProps) {
  const [errored, setErrored] = useState(false);
  const { user, tags, viewCount, likeCount, picColor, thumbnailUrl, name } =
    picture;

  return (
    <a
      href={`/picture/${picture.id}`}
      className="group relative block overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-900"
      style={{ backgroundColor: picColor || undefined }}
    >
      {errored ? (
        <div className="flex aspect-[3/4] items-center justify-center text-slate-400">
          <ImageOff size={32} />
        </div>
      ) : (
        <img
          src={thumbnailUrl}
          alt={name}
          loading="lazy"
          decoding="async"
          onError={() => setErrored(true)}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      )}

      <div className="pointer-events-none absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        {user && (
          <div className="flex items-center gap-2">
            {user.userAvatar && (
              <img
                src={user.userAvatar}
                alt={user.userName}
                className="h-6 w-6 rounded-full object-cover"
              />
            )}
            <span className="text-xs font-medium text-white">
              {user.userName}
            </span>
          </div>
        )}

        {tags && tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] text-white"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-1 flex items-center gap-3 text-[11px] text-white/80">
          <span className="flex items-center gap-0.5">
            <Eye size={12} />
            {viewCount}
          </span>
          <span className="flex items-center gap-0.5">
            <Heart size={12} />
            {likeCount}
          </span>
        </div>
      </div>
    </a>
  );
}

export const PictureCard = memo(PictureCardImpl);
