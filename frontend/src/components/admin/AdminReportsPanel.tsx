import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  Flag,
  Loader2,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { toast as sonner } from "sonner";

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
  fetchAdminModerationReportDetail,
  fetchAdminModerationReportList,
  resolveAdminModerationReport,
} from "@/lib/api";
import { formatRelativeTime, getAvatarFallback } from "@/lib/format";
import type { AdminModerationReportResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

type ReportFilters = {
  status: string;
  targetType: string;
  reporterUserId: string;
  targetId: string;
  createdAtFrom: string;
  createdAtTo: string;
};

type Resolution = "accepted" | "rejected" | "resolved";

const EMPTY_FILTERS: ReportFilters = {
  status: "open",
  targetType: "",
  reporterUserId: "",
  targetId: "",
  createdAtFrom: "",
  createdAtTo: "",
};

const STATUS_LABELS: Record<string, string> = {
  open: "待处理",
  accepted: "已采纳",
  rejected: "已驳回",
  resolved: "已处理",
};

const STATUS_CLASSES: Record<string, string> = {
  open: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  accepted: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  rejected: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  resolved: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
};

const POST_ACTIONS = [
  { value: "", label: "不处理内容" },
  { value: "hide_post", label: "隐藏动态" },
  { value: "restore_post", label: "恢复动态" },
  { value: "lock_forum_post", label: "锁定论坛帖" },
  { value: "unlock_forum_post", label: "解锁论坛帖" },
];

const COMMENT_ACTIONS = [
  { value: "", label: "不处理内容" },
  { value: "hide_comment", label: "隐藏评论" },
  { value: "restore_comment", label: "恢复评论" },
];

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function reportTargetLabel(targetType: string) {
  return targetType === "comment_record" ? "评论" : "动态";
}

function reportStatusLabel(status: string) {
  return STATUS_LABELS[status] ?? (status || "未知");
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
        STATUS_CLASSES[status] ?? STATUS_CLASSES.resolved
      )}
    >
      {reportStatusLabel(status)}
    </span>
  );
}

export function AdminReportsPanel() {
  const [draftFilters, setDraftFilters] = useState<ReportFilters>(EMPTY_FILTERS);
  const [filters, setFilters] = useState<ReportFilters>(EMPTY_FILTERS);
  const [pageNum, setPageNum] = useState(1);
  const [reports, setReports] = useState<AdminModerationReportResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<AdminModerationReportResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detailRequestVersion, setDetailRequestVersion] = useState(0);
  const [resolution, setResolution] = useState<Resolution>("accepted");
  const [action, setAction] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [resolving, setResolving] = useState(false);
  const detailRef = useRef<HTMLDivElement | null>(null);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const loadReports = useCallback(async () => {
    setListLoading(true);
    setListError("");
    try {
      const page = await fetchAdminModerationReportList({
        status: filters.status || undefined,
        targetType: filters.targetType || undefined,
        reporterUserId: filters.reporterUserId.trim() || undefined,
        targetId: filters.targetId.trim() || undefined,
        createdAtFrom: filters.createdAtFrom || undefined,
        createdAtTo: filters.createdAtTo || undefined,
        pageNum,
        pageSize: PAGE_SIZE,
      });
      const nextReports = page.list ?? [];
      setReports(nextReports);
      setTotal(page.total ?? 0);
      setSelectedId((current) =>
        nextReports.some((item) => item.id === current)
          ? current
          : nextReports[0]?.id ?? ""
      );
    } catch (error) {
      setListError(errorMessage(error, "举报工单加载失败，请稍后重试。"));
    } finally {
      setListLoading(false);
    }
  }, [filters, pageNum]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailError("");
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailError("");
    fetchAdminModerationReportDetail({ id: selectedId })
      .then((next) => {
        if (!cancelled) setDetail(next);
      })
      .catch((error) => {
        if (!cancelled) {
          setDetail(null);
          setDetailError(errorMessage(error, "工单详情加载失败。"));
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [detailRequestVersion, selectedId]);

  useEffect(() => {
    setResolution("accepted");
    setAction("");
    setResolutionNote("");
  }, [selectedId]);

  const availableActions = useMemo(
    () => (detail?.targetType === "comment_record" ? COMMENT_ACTIONS : POST_ACTIONS),
    [detail?.targetType]
  );

  const submitFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPageNum(1);
    setFilters({
      ...draftFilters,
      reporterUserId: draftFilters.reporterUserId.trim(),
      targetId: draftFilters.targetId.trim(),
    });
  };

  const clearFilters = () => {
    setDraftFilters(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
    setPageNum(1);
  };

  const selectReport = (id: string) => {
    setSelectedId(id);
    if (window.matchMedia("(max-width: 1023px)").matches) {
      window.requestAnimationFrame(() => {
        detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  };

  const canResolve =
    detail?.status === "open" &&
    !resolving &&
    (!action || resolutionNote.trim().length > 0);

  const handleResolve = async () => {
    if (!detail || !canResolve) return;
    setResolving(true);
    try {
      const next = await resolveAdminModerationReport({
        id: detail.id,
        resolution,
        resolutionNote: resolutionNote.trim() || undefined,
        action: action || undefined,
        targetType: detail.targetType,
        targetId: detail.targetId,
      });
      setDetail(next);
      setResolutionNote("");
      setAction("");
      sonner.success("举报工单已处理", {
        description: `${reportTargetLabel(next.targetType)}工单已更新为${reportStatusLabel(next.status)}。`,
      });
      await loadReports();
    } catch (error) {
      sonner.error("举报处理失败", {
        description: errorMessage(error, "请检查处理选项后重试。"),
      });
    } finally {
      setResolving(false);
    }
  };

  return (
    <section className="space-y-5" aria-labelledby="admin-reports-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Moderation queue
          </p>
          <h2 id="admin-reports-title" className="mt-1 text-xl font-semibold text-foreground">
            举报工单
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            查看举报上下文，记录结论，并按需同步治理目标内容。
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void loadReports()}>
          <RefreshCw className={cn("size-4", listLoading && "animate-spin")} />
          刷新
        </Button>
      </div>

      <form
        className="grid gap-3 border-y border-border bg-background py-4 sm:grid-cols-2 sm:rounded-lg sm:border sm:px-4 lg:grid-cols-6"
        onSubmit={submitFilters}
      >
        <div className="space-y-1.5">
          <Label htmlFor="report-status">状态</Label>
          <Select
            value={draftFilters.status || "all"}
            onValueChange={(value) =>
              value && setDraftFilters((current) => ({ ...current, status: value === "all" ? "" : value }))
            }
          >
            <SelectTrigger id="report-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectItem value="open">待处理</SelectItem>
              <SelectItem value="accepted">已采纳</SelectItem>
              <SelectItem value="rejected">已驳回</SelectItem>
              <SelectItem value="resolved">已处理</SelectItem>
              <SelectItem value="all">全部状态</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="report-target-type">目标类型</Label>
          <Select
            value={draftFilters.targetType || "all"}
            onValueChange={(value) =>
              value && setDraftFilters((current) => ({ ...current, targetType: value === "all" ? "" : value }))
            }
          >
            <SelectTrigger id="report-target-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectItem value="all">全部类型</SelectItem>
              <SelectItem value="post">动态</SelectItem>
              <SelectItem value="comment_record">评论</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reporter-id">举报人 ID</Label>
          <Input
            id="reporter-id"
            inputMode="numeric"
            value={draftFilters.reporterUserId}
            onChange={(event) => setDraftFilters((current) => ({ ...current, reporterUserId: event.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="report-target-id">目标 ID</Label>
          <Input
            id="report-target-id"
            inputMode="numeric"
            value={draftFilters.targetId}
            onChange={(event) => setDraftFilters((current) => ({ ...current, targetId: event.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="report-from">开始日期</Label>
          <Input
            id="report-from"
            type="date"
            value={draftFilters.createdAtFrom}
            onChange={(event) => setDraftFilters((current) => ({ ...current, createdAtFrom: event.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="report-to">结束日期</Label>
          <Input
            id="report-to"
            type="date"
            value={draftFilters.createdAtTo}
            onChange={(event) => setDraftFilters((current) => ({ ...current, createdAtTo: event.target.value }))}
          />
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-6 lg:justify-end">
          <Button type="button" variant="ghost" onClick={clearFilters}>
            <RotateCcw className="size-4" />
            清除筛选
          </Button>
          <Button type="submit">查询工单</Button>
        </div>
      </form>

      <div className="grid min-h-[34rem] overflow-hidden border-y border-border bg-background lg:grid-cols-[minmax(18rem,0.85fr)_minmax(24rem,1.15fr)] lg:rounded-xl lg:border">
        <div className="flex min-h-0 flex-col border-b border-border lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between border-b border-border px-4 py-3 text-sm">
            <span className="font-medium text-foreground">工单列表</span>
            <span className="text-muted-foreground">共 {total} 条</span>
          </div>
          <div className="relative min-h-[20rem] flex-1 overflow-y-auto">
            {listLoading && reports.length === 0 ? (
              <div className="space-y-1 p-2" aria-label="举报工单加载中">
                {Array.from({ length: 6 }, (_, index) => (
                  <div key={index} className="space-y-2 border-b border-border px-3 py-4">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))}
              </div>
            ) : listError && reports.length === 0 ? (
              <div className="flex min-h-[20rem] flex-col items-center justify-center px-6 text-center">
                <Flag className="size-6 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium text-foreground">工单加载失败</p>
                <p className="mt-1 text-sm text-muted-foreground">{listError}</p>
                <Button type="button" variant="outline" className="mt-4" onClick={() => void loadReports()}>
                  重新加载
                </Button>
              </div>
            ) : reports.length === 0 ? (
              <div className="flex min-h-[20rem] flex-col items-center justify-center px-6 text-center">
                <Flag className="size-6 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium text-foreground">没有符合条件的工单</p>
                <Button type="button" variant="ghost" className="mt-2" onClick={clearFilters}>
                  清除筛选
                </Button>
              </div>
            ) : (
              <div className={cn(listLoading && "opacity-60")}>
                {reports.map((report) => {
                  const selected = report.id === selectedId;
                  const reporterName = report.reporter?.nickname || report.reporter?.username || `用户 ${report.reporterUserId}`;
                  return (
                    <button
                      key={report.id}
                      type="button"
                      onClick={() => selectReport(report.id)}
                      className={cn(
                        "w-full border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                        selected && "bg-muted"
                      )}
                      aria-pressed={selected}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="line-clamp-1 text-sm font-medium text-foreground">{report.reason || "未填写原因"}</span>
                        <StatusBadge status={report.status} />
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{report.description || `${reportTargetLabel(report.targetType)} #${report.targetId}`}</p>
                      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                        <span className="truncate">{reporterName}</span>
                        <time dateTime={report.createdAt}>{formatRelativeTime(report.createdAt)}</time>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-border px-3 py-2">
            <Button type="button" variant="ghost" size="sm" disabled={pageNum <= 1 || listLoading} onClick={() => setPageNum((current) => Math.max(1, current - 1))}>
              <ChevronLeft className="size-4" />
              上一页
            </Button>
            <span className="text-xs text-muted-foreground">{pageNum} / {pageCount}</span>
            <Button type="button" variant="ghost" size="sm" disabled={pageNum >= pageCount || listLoading} onClick={() => setPageNum((current) => Math.min(pageCount, current + 1))}>
              下一页
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        <div ref={detailRef} className="min-h-[28rem] scroll-mt-28 p-5 sm:p-6">
          {!selectedId ? (
            <div className="flex min-h-[24rem] items-center justify-center text-sm text-muted-foreground">从左侧选择一条举报工单</div>
          ) : detailLoading ? (
            <div className="space-y-4" aria-label="举报详情加载中">
              <Skeleton className="h-7 w-1/3" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : detailError ? (
            <div className="flex min-h-[24rem] flex-col items-center justify-center text-center">
              <p className="text-sm font-medium text-foreground">详情加载失败</p>
              <p className="mt-1 text-sm text-muted-foreground">{detailError}</p>
              <Button type="button" variant="outline" className="mt-4" onClick={() => setDetailRequestVersion((current) => current + 1)}>
                重试
              </Button>
            </div>
          ) : detail ? (
            <div className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="size-10">
                    {detail.reporter?.avatarUrl ? <AvatarImage src={detail.reporter.avatarUrl} alt="" /> : null}
                    <AvatarFallback>
                      {getAvatarFallback(
                        detail.reporter?.nickname ||
                          detail.reporter?.username ||
                          "用户"
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{detail.reporter?.nickname || detail.reporter?.username || `用户 ${detail.reporterUserId}`}</p>
                    <p className="text-xs text-muted-foreground">举报人 ID {detail.reporterUserId}</p>
                  </div>
                </div>
                <StatusBadge status={detail.status} />
              </div>

              <dl className="grid gap-x-6 gap-y-4 border-y border-border py-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">举报原因</dt>
                  <dd className="mt-1 text-sm font-medium text-foreground">{detail.reason || "未填写"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">目标</dt>
                  <dd className="mt-1 text-sm font-medium text-foreground">{reportTargetLabel(detail.targetType)} #{detail.targetId}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs text-muted-foreground">补充说明</dt>
                  <dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground">{detail.description || "无补充说明"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">创建时间</dt>
                  <dd className="mt-1 text-sm text-foreground">{detail.createdAt || "未知"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">工单 ID</dt>
                  <dd className="mt-1 text-sm text-foreground">{detail.id}</dd>
                </div>
              </dl>

              {detail.status === "open" ? (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="report-resolution">处理结果</Label>
                      <Select value={resolution} onValueChange={(value) => value && setResolution(value as Resolution)}>
                        <SelectTrigger id="report-resolution" className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent alignItemWithTrigger={false}>
                          <SelectItem value="accepted">采纳举报</SelectItem>
                          <SelectItem value="rejected">驳回举报</SelectItem>
                          <SelectItem value="resolved">标记为已处理</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="report-action">联动治理动作</Label>
                      <Select value={action || "none"} onValueChange={(value) => value && setAction(value === "none" ? "" : value)}>
                        <SelectTrigger id="report-action" className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent alignItemWithTrigger={false}>
                          {availableActions.map((item) => <SelectItem key={item.value || "none"} value={item.value || "none"}>{item.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="report-resolution-note">处理说明</Label>
                    <textarea
                      id="report-resolution-note"
                      value={resolutionNote}
                      onChange={(event) => setResolutionNote(event.target.value)}
                      rows={4}
                      maxLength={500}
                      placeholder={action ? "执行内容治理动作时必须填写处理说明" : "记录判断依据，可选"}
                      className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                    />
                    <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                      <span>{action && !resolutionNote.trim() ? "请填写治理原因" : "处理结果将写入后台审计记录"}</span>
                      <span>{resolutionNote.length} / 500</span>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button type="button" disabled={!canResolve} onClick={() => void handleResolve()}>
                      {resolving ? <Loader2 className="size-4 animate-spin" /> : null}
                      提交处理结果
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 bg-muted/35 px-4 py-4">
                  <p className="text-sm font-medium text-foreground">处理记录</p>
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div><dt className="text-xs text-muted-foreground">处理结果</dt><dd className="mt-1 text-foreground">{reportStatusLabel(detail.resolution || detail.status)}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">处理人 ID</dt><dd className="mt-1 text-foreground">{detail.handlerUserId || "未知"}</dd></div>
                    <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">处理说明</dt><dd className="mt-1 whitespace-pre-wrap text-foreground">{detail.resolutionNote || "无"}</dd></div>
                    <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">处理时间</dt><dd className="mt-1 text-foreground">{detail.resolvedAt || detail.updatedAt || "未知"}</dd></div>
                  </dl>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
