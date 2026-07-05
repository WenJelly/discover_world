import { useEffect, useState } from "react";
import { fetchOverviewStats } from "@/lib/api";
import { formatCount } from "@/lib/format";
import type { OverviewStatsResponse } from "@/lib/types";

export default function Stats() {
  const [stats, setStats] = useState<OverviewStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchOverviewStats()
      .then((resp) => {
        if (!cancelled) {
          setStats(resp);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const items = [
    { label: "公开作品", value: stats?.publicMediaAssetCount ?? 0 },
    { label: "创作者", value: stats?.creatorCount ?? 0 },
    { label: "公开动态", value: stats?.publicPostCount ?? 0 },
    { label: "公开相册", value: stats?.publicAlbumCount ?? 0 },
  ];

  return (
    <section className="border-y border-border bg-muted">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-6 py-8 sm:gap-x-12">
        {loading ? (
          <span className="text-sm text-muted-foreground">加载中…</span>
        ) : (
          items.map((s) => (
            <span
              key={s.label}
              className="inline-flex items-baseline gap-1.5 text-sm"
            >
              <span className="text-base font-semibold tabular-nums text-foreground">
                {formatCount(s.value)}
              </span>
              <span className="text-muted-foreground">{s.label}</span>
            </span>
          ))
        )}
      </div>
    </section>
  );
}
