import { memo, useState } from "react";
import { ImageOff } from "lucide-react";
import type { PictureResponse } from "@/lib/types";

type PictureCardProps = {
  picture: PictureResponse;
};

function PictureCardImpl({ picture }: PictureCardProps) {
  const [errored, setErrored] = useState(false);
  const { picColor, thumbnailUrl, name } = picture;

  return (
    <a
      href="/discover"
      className="group relative block h-full overflow-hidden bg-muted"
      style={{ backgroundColor: picColor || undefined }}
    >
      {errored ? (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          <ImageOff size={32} />
        </div>
      ) : (
        <img
          src={thumbnailUrl}
          sizes="(min-width: 1024px) 42vw, 80vw"
          alt={name}
          loading="lazy"
          decoding="async"
          onError={() => setErrored(true)}
          className="h-full w-full object-cover"
        />
      )}
    </a>
  );
}

export const PictureCard = memo(PictureCardImpl);
