import { memo, useState } from "react";
import { Eye, Heart, ImageOff } from "lucide-react";
import type { PictureResponse } from "@/lib/types";

type PublicPictureCardProps = {
  picture: PictureResponse;
};

function formatCount(value: number) {
  if (value >= 10000) return `${(value / 10000).toFixed(1)}w`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return `${value}`;
}

function PublicPictureCardImpl({ picture }: PublicPictureCardProps) {
  const [errored, setErrored] = useState(false);
  const imageSrc = picture.thumbnailUrl || picture.url;
  const authorName = picture.user?.userName?.trim() || "匿名摄影师";
  const avatarSrc = picture.user?.userAvatar?.trim() || "";
  const avatarFallback = authorName.slice(0, 1).toUpperCase();

  return (
    <article
      className="public-discover-tile photo_thumbnail jg-entry entry-visible index_rating"
      style={{ backgroundColor: picture.picColor || "#b9c1c7" }}
    >
      <a
        href={`/media/${picture.id}`}
        className="photo_link"
        aria-label={`查看公开图片: ${picture.name || "未命名作品"}, 作者 ${authorName}`}
      >
        {errored || !imageSrc ? (
          <div className="public-discover-tile__fallback">
            <ImageOff size={30} aria-hidden="true" />
          </div>
        ) : (
          <img
            src={imageSrc}
            alt={picture.introduction || picture.name || authorName}
            loading="lazy"
            decoding="async"
            onError={() => setErrored(true)}
            className="copyright-contextmenu"
          />
        )}
      </a>

      <div className="info">
        <div className="credits">
          <span className="avatar" aria-hidden="true">
            {avatarSrc ? (
              <img src={avatarSrc} alt="" />
            ) : (
              <span className="avatar_fallback">{avatarFallback}</span>
            )}
          </span>
          <div className="photo_info_wrap">
            <span className="photographer">{authorName}</span>
            <span className="photo_caption">{picture.name || "未命名作品"}</span>
          </div>
        </div>

        <div className="right">
          <span className="metric" title={`浏览 ${picture.viewCount}`}>
            <Eye size={13} aria-hidden="true" />
            {formatCount(picture.viewCount)}
          </span>
          <span className="metric" title={`喜欢 ${picture.likeCount}`}>
            <Heart size={13} aria-hidden="true" />
            {formatCount(picture.likeCount)}
          </span>
        </div>
      </div>
    </article>
  );
}

export const PublicPictureCard = memo(PublicPictureCardImpl);
