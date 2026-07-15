import { useCallback, useEffect, useRef, useState } from "react";
import {
  MessageSquare,
  Pin,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { toast as sonner } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  adminLockForumPost,
  adminPinForumPost,
  adminUnlockForumPost,
  adminUnpinForumPost,
  fetchForumBoardList,
  fetchForumPostCursorList,
} from "@/lib/api";
import { formatRelativeTime } from "@/lib/format";
import { interactiveSurfaceClassName } from "@/lib/interactive-surface";
import type { ForumBoardResponse, ForumPostResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function AdminForumModerationPanel() {
  const [boards, setBoards] = useState<ForumBoardResponse[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState("");
  const [posts, setPosts] = useState<ForumPostResponse[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [cursor, setCursor] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [actingAction, setActingAction] = useState<"lock" | "unlock" | "pin" | "unpin" | "">("");
  const [resetRequestVersion, setResetRequestVersion] = useState(0);
  const loadPostsInFlightRef = useRef(false);
  const queueResetPostsRef = useRef(false);

  const selected = posts.find((item) => item.post.id === selectedId) ?? null;
  const lockAction = selected?.isLocked ? "unlock" : "lock";
  const pinAction = selected?.isBoardPinned ? "unpin" : "pin";
  const lockActing = actingAction === "lock" || actingAction === "unlock";
  const pinActing = actingAction === "pin" || actingAction === "unpin";

  useEffect(() => {
    fetchForumBoardList({ pageSize: 50 })
      .then((response) => {
        const nextBoards = response.list ?? [];
        setBoards(nextBoards);
        setSelectedBoardId((current) => current || nextBoards[0]?.id || "");
      })
      .catch(() => {
        setBoards([]);
      });
  }, []);

  const loadPosts = useCallback(
    async (mode: "reset" | "append" = "reset") => {
      if (loadPostsInFlightRef.current) {
        if (mode === "reset") queueResetPostsRef.current = true;
        return;
      }
      loadPostsInFlightRef.current = true;
      if (mode === "append") setLoadingMore(true);
      else setLoading(true);
      setError("");
      try {
        const page = await fetchForumPostCursorList({
          boardId: selectedBoardId || undefined,
          cursor: mode === "append" ? cursor : "",
          pageSize: PAGE_SIZE,
          variantOption: { compressType: 2 },
        });
        const next = page.list ?? [];
        setPosts((current) => (mode === "append" ? [...current, ...next] : next));
        setCursor(page.nextCursor || "");
        setHasMore(Boolean(page.hasMore));
        setSelectedId((current) => {
          const combined = mode === "append" ? [...posts, ...next] : next;
          return combined.some((item) => item.post.id === current)
            ? current
            : combined[0]?.post.id ?? "";
        });
      } catch (loadError) {
        setError(errorMessage(loadError, "论坛帖子加载失败，请稍后重试。"));
      } finally {
        setLoading(false);
        setLoadingMore(false);
        loadPostsInFlightRef.current = false;
        if (queueResetPostsRef.current) {
          queueResetPostsRef.current = false;
          setResetRequestVersion((current) => current + 1);
        }
      }
    },
    [cursor, posts, selectedBoardId]
  );

  useEffect(() => {
    void loadPosts("reset");
    // Board changes reset the cursor and reload from the beginning.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [resetRequestVersion, selectedBoardId]);

  const applyAction = async (action: "lock" | "unlock" | "pin" | "unpin") => {
    if (!selected || !reason.trim() || actingAction) return;
    setActingAction(action);
    try {
      const request = { id: selected.post.id, reason: reason.trim() };
      if (action === "lock") await adminLockForumPost(request);
      if (action === "unlock") await adminUnlockForumPost(request);
      if (action === "pin") await adminPinForumPost(request);
      if (action === "unpin") await adminUnpinForumPost(request);

      setPosts((current) =>
        current.map((item) =>
          item.post.id === selected.post.id
            ? {
                ...item,
                isLocked:
                  action === "lock"
                    ? true
                    : action === "unlock"
                      ? false
                      : item.isLocked,
                isBoardPinned:
                  action === "pin"
                    ? true
                    : action === "unpin"
                      ? false
                      : item.isBoardPinned,
              }
            : item
        )
      );
      setReason("");
      sonner.success("论坛帖子状态已更新");
    } catch (actionError) {
      sonner.error("论坛治理失败", {
        description: errorMessage(actionError, "请稍后重试。"),
      });
    } finally {
      setActingAction("");
    }
  };

  return (
    <div className="grid min-h-[34rem] overflow-hidden border-y border-border bg-background lg:grid-cols-[minmax(18rem,0.85fr)_minmax(24rem,1.15fr)] lg:rounded-xl lg:border">
      <div className="flex min-h-0 flex-col border-b border-border lg:border-b-0 lg:border-r">
        <div className="space-y-3 border-b border-border p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">论坛帖子</p>
              <p className="text-xs text-muted-foreground">按分区查看并执行锁定或置顶。</p>
            </div>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="刷新论坛帖子" disabled={loading} aria-busy={loading} onClick={() => void loadPosts("reset")}>
              {loading ? <Spinner aria-label="加载中" /> : <RefreshCw className="size-4" />}
            </Button>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-forum-board">论坛分区</Label>
            <Select
              value={selectedBoardId || "all"}
              onValueChange={(value) => {
                if (!value) return;
                setCursor("");
                setPosts([]);
                setSelectedBoardId(value === "all" ? "" : value);
              }}
            >
              <SelectTrigger id="admin-forum-board" className="w-full">
                <SelectValue placeholder="全部分区" />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectItem value="all">全部分区</SelectItem>
                {boards.map((board) => (
                  <SelectItem key={board.id} value={board.id}>{board.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="min-h-[20rem] flex-1 overflow-y-auto">
          {loading && posts.length === 0 ? (
            <div className="space-y-1 p-2">
              {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="space-y-2 border-b border-border px-3 py-4">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                </div>
              ))}
            </div>
          ) : error && posts.length === 0 ? (
            <div className="flex min-h-[20rem] flex-col items-center justify-center px-6 text-center">
              <MessageSquare className="size-6 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium text-foreground">论坛帖子加载失败</p>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              <Button type="button" variant="outline" className="mt-4" disabled={loading} aria-busy={loading} onClick={() => void loadPosts("reset")}>{loading ? <Spinner aria-label="加载中" /> : null}重新加载</Button>
            </div>
          ) : posts.length === 0 ? (
            <div className="flex min-h-[20rem] items-center justify-center px-6 text-sm text-muted-foreground">当前分区暂无帖子</div>
          ) : (
            posts.map((item) => (
              <button
                key={item.post.id}
                data-slot="interactive-surface"
                type="button"
                aria-pressed={selectedId === item.post.id}
                onClick={() => {
                  setSelectedId(item.post.id);
                  setReason("");
                }}
                className={cn(
                  interactiveSurfaceClassName,
                  "w-full border-b border-border px-4 py-3 text-left hover:bg-muted/50 focus-visible:ring-inset",
                  selectedId === item.post.id && "bg-muted"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="line-clamp-1 text-sm font-medium text-foreground">{item.title}</p>
                  <div className="flex shrink-0 gap-1">
                    {item.isLocked ? <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-700 dark:text-amber-300">已锁定</span> : null}
                    {item.isBoardPinned ? <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] text-blue-700 dark:text-blue-300">置顶</span> : null}
                  </div>
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.post.content || "无正文"}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{item.board.name}</span>
                  <time dateTime={item.lastActivityAt}>{formatRelativeTime(item.lastActivityAt)}</time>
                </div>
              </button>
            ))
          )}
        </div>
        {hasMore ? (
          <div className="border-t border-border p-2 text-center">
            <Button type="button" variant="ghost" size="sm" disabled={loadingMore} aria-busy={loadingMore} onClick={() => void loadPosts("append")}>
              {loadingMore ? <Spinner aria-label="加载中" /> : null}
              加载更多
            </Button>
          </div>
        ) : null}
      </div>

      <div className="min-h-[28rem] p-5 sm:p-6">
        {!selected ? (
          <div className="flex min-h-[24rem] items-center justify-center text-sm text-muted-foreground">选择一篇论坛帖子进行治理</div>
        ) : (
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{selected.board.name}</span>
                <span aria-hidden="true">·</span>
                <span>帖子 #{selected.post.id}</span>
              </div>
              <h3 className="mt-2 text-lg font-semibold text-foreground">{selected.title}</h3>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">{selected.post.content || "无正文"}</p>
            </div>

            <div className="grid gap-3 border-y border-border py-4 sm:grid-cols-2">
              <div className="flex items-center gap-2 text-sm text-foreground">
                <ShieldCheck className="size-4 text-muted-foreground" />
                {selected.isLocked ? "当前已锁定" : "当前允许评论"}
              </div>
              <div className="flex items-center gap-2 text-sm text-foreground">
                <Pin className="size-4 text-muted-foreground" />
                {selected.isBoardPinned ? "当前分区置顶" : "当前未置顶"}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="forum-moderation-reason">治理原因</Label>
              <textarea
                id="forum-moderation-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={4}
                maxLength={500}
                placeholder="说明锁定、解锁或置顶的原因"
                className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
              />
              <p className="text-right text-xs text-muted-foreground">{reason.length} / 500</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={!reason.trim() || lockActing || pinActing} aria-busy={lockActing} onClick={() => void applyAction(lockAction)}>
                {lockActing ? <><Spinner aria-label="加载中" />{actingAction === "unlock" ? "解锁中" : "锁定中"}</> : selected.isLocked ? "解锁帖子" : "锁定帖子"}
              </Button>
              <Button type="button" variant="outline" disabled={!reason.trim() || lockActing || pinActing} aria-busy={pinActing} onClick={() => void applyAction(pinAction)}>
                {pinActing ? <><Spinner aria-label="加载中" />{actingAction === "unpin" ? "取消置顶中" : "置顶中"}</> : selected.isBoardPinned ? "取消分区置顶" : "分区置顶"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
