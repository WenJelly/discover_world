import { Aperture, Camera, Clock3, Crosshair, Focus } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Camera / shooting parameters for a photo. Values come from backend EXIF
 * metadata; missing fields render as "—".
 */
export interface PhotoExif {
  aperture?: string;
  focalLength?: string;
  shutterSpeed?: string;
  iso?: string;
  cameraModel?: string;
  lensModel?: string;
}

interface ExifField {
  key: keyof PhotoExif;
  label: string;
  icon?: LucideIcon;
  iso?: boolean;
}

const EXIF_FIELDS: ExifField[] = [
  { key: "aperture", label: "光圈", icon: Aperture },
  { key: "focalLength", label: "焦距", icon: Focus },
  { key: "shutterSpeed", label: "快门速度", icon: Clock3 },
  { key: "iso", label: "ISO", iso: true },
  { key: "cameraModel", label: "相机型号", icon: Camera },
  { key: "lensModel", label: "镜头型号", icon: Crosshair },
];

interface PhotoMetadataProps {
  exif: PhotoExif;
  className?: string;
}

/** EXIF / "相机信息" panel. Renders all six fields; unknown values show "—". */
export function PhotoMetadata({ exif, className }: PhotoMetadataProps) {
  return (
    <section className={cn("space-y-2.5", className)}>
      <h3 className="text-sm font-semibold text-slate-950">相机信息</h3>
      <div className="rounded-none border border-[#dfe3ea] bg-[#fbfcff] p-2.5">
        <dl className="grid grid-cols-1 gap-x-3 gap-y-2.5 sm:grid-cols-3">
          {EXIF_FIELDS.map(({ key, label, icon: Icon, iso }) => {
            const value = exif[key] || "—";
            return (
              <div
                key={key}
                className="flex min-w-0 items-start gap-2"
              >
                {iso ? (
                  <span className="mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-none border border-slate-500 text-[8px] font-semibold leading-none text-slate-600">
                    ISO
                  </span>
                ) : Icon ? (
                  <Icon
                    className="mt-0.5 size-[18px] shrink-0 text-slate-600"
                    aria-hidden="true"
                  />
                ) : null}
                <div className="min-w-0">
                  <dt className="text-[11px] text-slate-500">{label}</dt>
                  <dd
                    className="mt-0.5 break-words text-xs font-medium leading-snug text-slate-950"
                    title={value}
                  >
                    {value}
                  </dd>
                </div>
              </div>
            );
          })}
        </dl>
      </div>
    </section>
  );
}
