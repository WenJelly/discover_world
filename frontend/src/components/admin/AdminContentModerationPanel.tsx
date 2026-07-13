import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  MessageSquare,
  Newspaper,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { toast as sonner } from "sonner";

import { AdminForumModerationPanel } from "@/components/admin/AdminForumModerationPanel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  adminHideComment,
  adminHidePost,
  adminRestoreComment,
  adminRestorePost,
  fetchAdminContentList,
} from "@/lib/api";
import { formatRelativeTime, getAvatarFallback } from "@/lib/format";
import {
  getAdminContentKey,
  updateAdminContentStatus,
} from "@/lib/admin-moderation";
import type { AdminContentResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

type ModerationView = "content" | "forum";

type ContentFilters = {
  targetType: string;
  status: string;
  userId: string;
  searchText: string;
};

const EMPTY_FILTERS: ContentFilters = {
  targetType: "",
  status: "",
  userId: "",
  searchText: "",
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function targetLabel(targetType: string) {
  return targetType === "comment_record" ? "评论" : "动态";
}

function authorName(item: AdminContentResponse) {
  return item.author?.nickname || item.author?.username || "未知用户";
}

export function AdminContentModerationPanel() {
  const [view, setView] = useState<ModerationView>("content");
  const [draftFilters, setDraftFilters] = useState<ContentFilters>(EMPTY_FILTERS);
  const [filters, setFilters] = useState<ContentFilters>(EMPTY_FILTERS);
  const [pageNum, setPageNum] = useState(1);
  const [items, setItems] = useState<AdminContentResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [reason, setReason] = useState("");
  const [acting, setActing] = useState(false);

  const selected = useMemo(
    () =>
      items.find(
        (item) => getAdminContentKey(item.targetType, item.id) === selectedKey
      ) ?? null,
    [items, selectedKey]
  );
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const loadContent = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const page = await fetchAdminContentList({
        targetType: filters.targetType || undefined,
        status: filters.status || undefined,
        userId: filters.userId.trim() || undefined,
        searchText: filters.searchText.trim() || undefined,
        pageNum,
        pageSize: PAGE_SIZE,
      });
      const nextItems = page.list ?? [];
      setItems(nextItems);
      setTotal(page.total ?? 0);
      setSelectedKey((current) =>
        nextItems.some(
          (item) => getAdminContentKey(item.targetType, item.id) === current
        )
          ? current
          : nextItems[0]
            ? getAdminContentKey(nextItems[0].targetType, nextItems[0].id)
            : ""
      );
    } catch (loadError) {
      setError(errorMessage(loadError, "治理内容加载失败，请稍后重试。"));
    } finally {
      setLoading(false);
    }
  }, [filters, pageNum]);

  useEffect(() => {
    if (view === "content") void loadContent();
  }, [loadContent, view]);

  useEffect(() => {
    setReason("");
  }, [selectedKey]);

  const submitFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPageNum(1);
    setFilters({
      ...draftFilters,
      userId: draftFilters.userId.trim(),
      searchText: draftFilters.searchText.trim(),
    });
  };

  const clearFilters = () => {
    setDraftFilters(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
    setPageNum(1);
  };

  const handleModerate = async () => {
    if (!selected || !reason.trim() || acting) return;
    setActing(true);
    const restoring = selected.status === "hidden";
    try {
      const request = selected.targetType === "comment_record"
        ? restoring
          ? adminRestoreComment
          : adminHideComment
        : restoring
          ? adminRestorePost
          : adminHidePost;
      await request({ id: selected.id, reason: reason.trim() });
      const nextStatus = restoring ? "active" : "hidden";
      setItems((current) =>
        updateAdminContentStatus(current, selectedKey, nextStatus)
      );
      setReason("");
      sonner.success(
        `${targetLabel(selected.targetType)}已${restoring ? "恢复" : "隐藏"}`
      );
    } catch (actionError) {
      sonner.error("内容治理失败", {
        description: errorMessage(actionError, "请稍后重试。"),
      });
    } finally {
      setActing(false);
    }
  };

  return (
    <section className="space-y-5" aria-labelledby="admin-content-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Content governance
          </p>
          <h2 id="admin-content-title" className="mt-1 text-xl font-semibold text-foreground">
            内容治理
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            查询包含隐藏状态的后台内容，并记录每次治理原因。
          </p>
        </div>
        {view === "content" ? (
          <Button type="button" variant="outline" onClick={() => void loadContent()}>
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            刷新
          </Button>
        ) : null}
      </div>

      <div className="flex gap-1 border-b border-border" role="tablist" aria-label="治理内容类型">
        <button
          type="button"
          role="tab"
          aria-selected={view === "content"}
          onClick={() => setView("content")}
          className={cn(
            "flex h-10 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            view === "content"
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Newspaper className="size-4" />
          动态与评论
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "forum"}
          onClick={() => setView("forum")}
          className={cn(
            "flex h-10 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            view === "forum"
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <MessageSquare className="size-4" />
          论坛帖子
        </button>
      </div>

      {view === "forum" ? (
        <AdminForumModerationPanel />
      ) : (
        <>
          <form
            className="grid gap-3 border-y border-border bg-background py-4 sm:grid-cols-2 sm:rounded-lg sm:border sm:px-4 lg:grid-cols-[0.8fr_0.8fr_1fr_1.6fr_auto] lg:items-end"
            onSubmit={submitFilters}
          >
            <div className="space-y-1.5">
              <Label htmlFor="content-target-type">内容类型</Label>
              <Select
                value={draftFilters.targetType || "all"}
                onValueChange={(value) =>
                  value && setDraftFilters((current) => ({ ...current, targetType: value === "all" ? "" : value }))
                }
              >
                <SelectTrigger id="content-target-type" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectItem value="all">全部类型</SelectItem>
                  <SelectItem value="post">动态</SelectItem>
                  <SelectItem value="comment_record">评论</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="content-status">状态</Label>
              <Select
                value={draftFilters.status || "all"}
                onValueChange={(value) =>
                  value && setDraftFilters((current) => ({ ...current, status: value === "all" ? "" : value }))
                }
              >
                <SelectTrigger id="content-status" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="active">正常</SelectItem>
                  <SelectItem value="hidden">隐藏</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="content-user-id">作者 ID</Label>
              <Input
                id="content-user-id"
                inputMode="numeric"
                value={draftFilters.userId}
                onChange={(event) => setDraftFilters((current) => ({ ...current, userId: event.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="content-search">正文关键字</Label>
              <Input
                id="content-search"
                value={draftFilters.searchText}
                onChange={(event) => setDraftFilters((current) => ({ ...current, searchText: event.target.value }))}
                placeholder="搜索标题或正文"
              />
            </div>
            <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
              <Button type="button" variant="ghost" size="icon" aria-label="清除筛选" onClick={clearFilters}>
                <RotateCcw className="size-4" />
              </Button>
              <Button type="submit">查询</Button>
            </div>
          </form>

          <div className="grid min-h-[34rem] overflow-hidden border-y border-border bg-background lg:grid-cols-[minmax(18rem,0.85fr)_minmax(24rem,1.15fr)] lg:rounded-xl lg:border">
            <div className="flex min-h-0 flex-col border-b border-border lg:border-b-0 lg:border-r">
              <div className="flex items-center justify-between border-b border-border px-4 py-3 text-sm">
                <span className="font-medium text-foreground">内容列表</span>
                <span className="text-muted-foreground">共 {total} 条</span>
              </div>
              <div className="min-h-[20rem] flex-1 overflow-y-auto">
                {loading && items.length === 0 ? (
                  <div className="space-y-1 p-2" aria-label="治理内容加载中">
                    {Array.from({ length: 6 }, (_, index) => (
                      <div key={index} className="space-y-2 border-b border-border px-3 py-4">
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-2/3" />
                      </div>
                    ))}
                  </div>
                ) : error && items.length === 0 ? (
                  <div className="flex min-h-[20rem] flex-col items-center justify-center px-6 text-center">
                    <EyeOff className="size-6 text-muted-foreground" />
                    <p className="mt-3 text-sm font-medium text-foreground">内容加载失败</p>
                    <p className="mt-1 text-sm text-muted-foreground">{error}</p>
                    <Button type="button" variant="outline" className="mt-4" onClick={() => void loadContent()}>重新加载</Button>
                  </div>
                ) : items.length === 0 ? (
                  <div className="flex min-h-[20rem] flex-col items-center justify-center px-6 text-center">
                    <Eye className="size-6 text-muted-foreground" />
                    <p className="mt-3 text-sm font-medium text-foreground">没有符合条件的内容</p>
                    <Button type="button" variant="ghost" className="mt-2" onClick={clearFilters}>清除筛选</Button>
                  </div>
                ) : (
                  <div className={cn(loading && "opacity-60")}>
                    {items.map((item) => {
                      const itemKey = getAdminContentKey(item.targetType, item.id);
                      return (
                      <button
                        key={itemKey}
                        type="button"
                        onClick={() => setSelectedKey(itemKey)}
                        className={cn(
                          "w-full border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                          selectedKey === itemKey && "bg-muted"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-xs font-medium text-muted-foreground">{targetLabel(item.targetType)}</span>
                          <span className={cn(
                            "rounded-full px-2 py-0.5 text-[11px] font-medium",
                            item.status === "hidden"
                              ? "bg-rose-500/10 text-rose-700 dark:text-rose-300"
                              : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          )}>{item.status === "hidden" ? "隐藏" : "正常"}</span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm leading-5 text-foreground">{item.title || item.content || "无正文"}</p>
                        <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                          <span className="truncate">{authorName(item)}</span>
                          <time dateTime={item.createdAt}>{formatRelativeTime(item.createdAt)}</time>
                        </div>
                      </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between border-t border-border px-3 py-2">
                <Button type="button" variant="ghost" size="sm" disabled={pageNum <= 1 || loading} onClick={() => setPageNum((current) => Math.max(1, current - 1))}>
                  <ChevronLeft className="size-4" />上一页
                </Button>
                <span className="text-xs text-muted-foreground">{pageNum} / {pageCount}</span>
                <Button type="button" variant="ghost" size="sm" disabled={pageNum >= pageCount || loading} onClick={() => setPageNum((current) => Math.min(pageCount, current + 1))}>
                  下一页<ChevronRight className="size-4" />
                </Button>
              </div>
            </div>

            <div className="min-h-[28rem] p-5 sm:p-6">
              {!selected ? (
                <div className="flex min-h-[24rem] items-center justify-center text-sm text-muted-foreground">从左侧选择一条内容</div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-start gap-3">
                    <Avatar className="size-10">
                      {selected.author?.avatarUrl ? <AvatarImage src={selected.author.avatarUrl} alt="" /> : null}
                      <AvatarFallback>{getAvatarFallback(authorName(selected))}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{authorName(selected)}</p>
                        <span className="text-xs text-muted-foreground">{targetLabel(selected.targetType)} #{selected.id}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{selected.createdAt}</p>
                    </div>
                  </div>

                  <div className="border-y border-border py-5">
                    {selected.title ? <h3 className="text-base font-semibold text-foreground">{selected.title}</h3> : null}
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-foreground">{selected.content || "无正文"}</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="content-moderation-reason">治理原因</Label>
                    <textarea
                      id="content-moderation-reason"
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      rows={4}
                      maxLength={500}
                      placeholder={`说明${selected.status === "hidden" ? "恢复" : "隐藏"}该${targetLabel(selected.targetType)}的原因`}
                      className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                    />
                    <p className="text-right text-xs text-muted-foreground">{reason.length} / 500</p>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant={selected.status === "hidden" ? "outline" : "destructive"}
                      disabled={!reason.trim() || acting}
                      onClick={() => void handleModerate()}
                    >
                      {acting ? <Loader2 className="size-4 animate-spin" /> : null}
                      {selected.status === "hidden" ? "恢复内容" : "隐藏内容"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
