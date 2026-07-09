import type { ProfilePostResponse } from "@/lib/types";
import { parseServerTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PostCard } from "./PostCard";
import type { PostAuthor } from "./PostComposerDialog";

export type PostTimelineProps = {
  posts: ProfilePostResponse[];
  author?: PostAuthor | null;
  canManage?: boolean;
  onDeleted?: (id: string) => void;
  onUpdated?: (post: ProfilePostResponse) => void;
  onPinChanged?: (post: ProfilePostResponse) => void;
};

type PostGroup = {
  key: string;
  label: string;
  dateTime: string; // ISO date for <time dateTime>, "" when unparseable
  posts: ProfilePostResponse[];
};

function startOfDay(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function toISODate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function formatGroupLabel(postTime: number, now: Date): string {
  const today = startOfDay(now);
  const yesterday = today - 86_400_000;
  const postDay = startOfDay(new Date(postTime));

  if (postDay === today) return "今天";
  if (postDay === yesterday) return "昨天";

  const post = new Date(postTime);
  if (post.getFullYear() === now.getFullYear()) {
    return `${post.getMonth() + 1} 月 ${post.getDate()} 日`;
  }
  return `${post.getFullYear()} 年 ${post.getMonth() + 1} 月 ${post.getDate()} 日`;
}

// Posts arrive newest-first; walk them in order and start a new group whenever
// the calendar day changes, so the rail reads as a chronological log.
function groupPostsByDay(
  posts: ProfilePostResponse[],
  now: Date
): PostGroup[] {
  const groups: PostGroup[] = [];
  let current: PostGroup | null = null;

  for (const post of posts) {
    const ts = parseServerTime(post.createdAt);
    let key: string;
    let label: string;
    let dateTime: string;

    if (ts) {
      dateTime = toISODate(ts);
      key = dateTime;
      label = formatGroupLabel(ts, now);
    } else {
      dateTime = "";
      key = "unknown";
      label = "更早";
    }

    if (!current || current.key !== key) {
      current = { key, label, dateTime, posts: [] };
      groups.push(current);
    }
    current.posts.push(post);
  }

  return groups;
}

export function PostTimeline({
  posts,
  author,
  canManage = false,
  onDeleted,
  onUpdated,
  onPinChanged,
}: PostTimelineProps) {
  const now = new Date();
  const groups = groupPostsByDay(posts, now);

  return (
    <div className="relative">
      {/* Timeline rail — a quiet neutral axis. No color, no decoration. */}
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-2 left-4 top-2 -translate-x-1/2 w-px bg-border"
      />

      {groups.map((group, groupIndex) => (
        <section key={group.key} aria-label={group.label}>
          {/* Date marker — a hollow ring on the rail, acting as a tick. */}
          <div
            className={cn(
              "relative flex items-center pl-8",
              groupIndex === 0 ? "pb-2 pt-1" : "pb-2 pt-6"
            )}
          >
            <span
              aria-hidden
              className="absolute left-4 size-2.5 -translate-x-1/2 rounded-full border-2 border-muted-foreground/40 bg-background"
            />
            <time
              dateTime={group.dateTime || undefined}
              className="text-xs font-semibold text-muted-foreground"
            >
              {group.label}
            </time>
          </div>

          <ol className="space-y-3">
            {group.posts.map((post) => (
              <li key={post.id} className="relative pl-8">
                {/* Post node — small filled dot anchored to the rail, vertically
                    aligned with the card's avatar row. */}
                <span
                  aria-hidden
                  className="absolute left-4 top-7 size-1.5 -translate-x-1/2 rounded-full bg-muted-foreground/50 sm:top-8"
                />
                <PostCard
                  post={post}
                  author={author}
                  canManage={canManage}
                  onDeleted={onDeleted}
                  onUpdated={onUpdated}
                  onPinChanged={onPinChanged}
                />
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
