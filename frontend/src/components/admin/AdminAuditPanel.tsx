import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileJson,
  RefreshCw,
  RotateCcw,
  ScrollText,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  fetchAdminOperationLogDetail,
  fetchAdminOperationLogList,
} from "@/lib/api";
import { formatRelativeTime, getAvatarFallback } from "@/lib/format";
import { interactiveSurfaceClassName } from "@/lib/interactive-surface";
import {
  formatAdminOperationJson,
  getAdminOperationLabel,
} from "@/lib/admin-operation";
import type { AdminOperationLogResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

type AdminAuditPanelProps = {
  selectedId: string;
  onSelectedIdChange: (id: string) => void;
};

type AuditFilters = {
  operatorUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  createdAtFrom: string;
  createdAtTo: string;
};

const EMPTY_FILTERS: AuditFilters = {
  operatorUserId: "",
  action: "",
  targetType: "",
  targetId: "",
  createdAtFrom: "",
  createdAtTo: "",
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function operatorName(log: AdminOperationLogResponse) {
  return (
    log.operator?.nickname ||
    log.operator?.username ||
    `管理员 ${log.operatorUserId}`
  );
}

function JsonSnapshot({
  label,
  value,
}: {
  label: "Before" | "After" | "Metadata";
  value: string;
}) {
  const formatted = formatAdminOperationJson(value);
  return (
    <section className="min-w-0" aria-label={`${label} JSON`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </h4>
        {formatted.kind === "raw" ? (
          <span className="text-[11px] text-amber-700 dark:text-amber-300">
            原始文本
          </span>
        ) : null}
      </div>
      <pre
        className={cn(
          "max-h-80 overflow-auto rounded-lg border border-border bg-muted/35 p-3 font-mono text-xs leading-5 text-foreground",
          formatted.kind === "empty" && "font-sans text-muted-foreground"
        )}
      >
        {formatted.text}
      </pre>
    </section>
  );
}

export function AdminAuditPanel({
  selectedId,
  onSelectedIdChange,
}: AdminAuditPanelProps) {
  const [draftFilters, setDraftFilters] = useState<AuditFilters>(EMPTY_FILTERS);
  const [filters, setFilters] = useState<AuditFilters>(EMPTY_FILTERS);
  const [pageNum, setPageNum] = useState(1);
  const [logs, setLogs] = useState<AdminOperationLogResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [detail, setDetail] = useState<AdminOperationLogResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detailRequestVersion, setDetailRequestVersion] = useState(0);
  const [listRequestVersion, setListRequestVersion] = useState(0);
  const loadLogsInFlightRef = useRef(false);
  const queueLoadLogsRef = useRef(false);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const loadLogs = useCallback(async (queueIfBusy = false) => {
    if (loadLogsInFlightRef.current) {
      if (queueIfBusy) queueLoadLogsRef.current = true;
      return;
    }
    loadLogsInFlightRef.current = true;
    setListLoading(true);
    setListError("");
    try {
      const page = await fetchAdminOperationLogList({
        operatorUserId: filters.operatorUserId.trim() || undefined,
        action: filters.action.trim() || undefined,
        targetType: filters.targetType.trim() || undefined,
        targetId: filters.targetId.trim() || undefined,
        createdAtFrom: filters.createdAtFrom || undefined,
        createdAtTo: filters.createdAtTo || undefined,
        pageNum,
        pageSize: PAGE_SIZE,
      });
      if (queueLoadLogsRef.current) return;
      setLogs(page.list ?? []);
      setTotal(page.total ?? 0);
    } catch (error) {
      if (queueLoadLogsRef.current) return;
      setListError(errorMessage(error, "操作日志加载失败，请稍后重试。"));
    } finally {
      setListLoading(false);
      loadLogsInFlightRef.current = false;
      if (queueLoadLogsRef.current) {
        queueLoadLogsRef.current = false;
        setListRequestVersion((current) => current + 1);
      }
    }
  }, [filters, pageNum]);

  useEffect(() => {
    void loadLogs(true);
  }, [listRequestVersion, loadLogs]);

  useEffect(() => {
    if (!listLoading && logs.length > 0 && !selectedId) {
      onSelectedIdChange(logs[0].id);
    }
  }, [listLoading, logs, onSelectedIdChange, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailError("");
      setDetailLoading(false);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailError("");
    fetchAdminOperationLogDetail({ id: selectedId })
      .then((next) => {
        if (!cancelled) setDetail(next);
      })
      .catch((error) => {
        if (!cancelled) {
          setDetail(null);
          setDetailError(errorMessage(error, "操作日志详情加载失败。"));
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [detailRequestVersion, selectedId]);

  const submitFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSelectedIdChange("");
    setPageNum(1);
    setFilters({
      ...draftFilters,
      operatorUserId: draftFilters.operatorUserId.trim(),
      action: draftFilters.action.trim(),
      targetType: draftFilters.targetType.trim(),
      targetId: draftFilters.targetId.trim(),
    });
  };

  const clearFilters = () => {
    onSelectedIdChange("");
    setDraftFilters(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
    setPageNum(1);
  };

  const changePage = (next: number) => {
    onSelectedIdChange("");
    setPageNum(Math.min(pageCount, Math.max(1, next)));
  };

  return (
    <section className="space-y-5" aria-labelledby="admin-audit-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Operation audit
          </p>
          <h2 id="admin-audit-title" className="mt-1 text-xl font-semibold text-foreground">
            操作审计
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            查询管理员操作记录，核对变更前后快照和请求来源。
          </p>
        </div>
        <Button type="button" variant="outline" disabled={listLoading} aria-busy={listLoading} onClick={() => void loadLogs()}>
          {listLoading ? <Spinner aria-label="加载中" /> : <RefreshCw className="size-4" />}
          刷新
        </Button>
      </div>

      <form
        className="grid gap-3 border-y border-border bg-background py-4 sm:grid-cols-2 sm:rounded-lg sm:border sm:px-4 lg:grid-cols-6"
        onSubmit={submitFilters}
      >
        <div className="space-y-1.5">
          <Label htmlFor="audit-operator-id">管理员 ID</Label>
          <Input id="audit-operator-id" inputMode="numeric" value={draftFilters.operatorUserId} onChange={(event) => setDraftFilters((current) => ({ ...current, operatorUserId: event.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-action">操作类型</Label>
          <Input id="audit-action" value={draftFilters.action} onChange={(event) => setDraftFilters((current) => ({ ...current, action: event.target.value }))} placeholder="例如 tag.update" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-target-type">目标类型</Label>
          <Input id="audit-target-type" value={draftFilters.targetType} onChange={(event) => setDraftFilters((current) => ({ ...current, targetType: event.target.value }))} placeholder="例如 tag" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-target-id">目标 ID</Label>
          <Input id="audit-target-id" inputMode="numeric" value={draftFilters.targetId} onChange={(event) => setDraftFilters((current) => ({ ...current, targetId: event.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-from">开始日期</Label>
          <Input id="audit-from" type="date" value={draftFilters.createdAtFrom} onChange={(event) => setDraftFilters((current) => ({ ...current, createdAtFrom: event.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-to">结束日期</Label>
          <Input id="audit-to" type="date" value={draftFilters.createdAtTo} onChange={(event) => setDraftFilters((current) => ({ ...current, createdAtTo: event.target.value }))} />
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-6 lg:justify-end">
          <Button type="button" variant="ghost" onClick={clearFilters}><RotateCcw className="size-4" />清除筛选</Button>
          <Button type="submit">查询日志</Button>
        </div>
      </form>

      <div className="grid min-h-[36rem] overflow-hidden border-y border-border bg-background lg:grid-cols-[minmax(19rem,0.82fr)_minmax(26rem,1.18fr)] lg:rounded-xl lg:border">
        <div className="flex min-h-0 flex-col border-b border-border lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between border-b border-border px-4 py-3 text-sm">
            <span className="font-medium text-foreground">操作记录</span>
            <span className="text-muted-foreground">共 {total} 条</span>
          </div>
          <div className="relative min-h-[22rem] flex-1 overflow-y-auto">
            {listLoading && logs.length === 0 ? (
              <div className="space-y-1 p-2" aria-label="操作日志加载中">
                {Array.from({ length: 7 }, (_, index) => (
                  <div key={index} className="space-y-2 border-b border-border px-3 py-4">
                    <Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-1/2" />
                  </div>
                ))}
              </div>
            ) : listError && logs.length === 0 ? (
              <div className="flex min-h-[22rem] flex-col items-center justify-center px-6 text-center">
                <ScrollText className="size-6 text-muted-foreground" /><p className="mt-3 text-sm font-medium text-foreground">操作日志加载失败</p><p className="mt-1 text-sm text-muted-foreground">{listError}</p><Button type="button" variant="outline" className="mt-4" disabled={listLoading} aria-busy={listLoading} onClick={() => void loadLogs()}>{listLoading ? <Spinner aria-label="加载中" /> : null}重新加载</Button>
              </div>
            ) : logs.length === 0 ? (
              <div className="flex min-h-[22rem] flex-col items-center justify-center px-6 text-center">
                <ScrollText className="size-6 text-muted-foreground" /><p className="mt-3 text-sm font-medium text-foreground">没有符合条件的操作日志</p><Button type="button" variant="ghost" className="mt-2" onClick={clearFilters}>清除筛选</Button>
              </div>
            ) : (
              <div className={cn(listLoading && "opacity-60")}>
                {logs.map((log) => {
                  const selected = log.id === selectedId;
                  return (
                    <button key={log.id} data-slot="interactive-surface" type="button" aria-pressed={selected} onClick={() => onSelectedIdChange(log.id)} className={cn(interactiveSurfaceClassName, "w-full border-b border-border px-4 py-3 text-left hover:bg-muted/45 focus-visible:ring-inset", selected && "bg-muted")}>
                      <div className="flex items-start justify-between gap-3"><span className="line-clamp-1 text-sm font-medium text-foreground">{getAdminOperationLabel(log.action)}</span><time dateTime={log.createdAt} className="shrink-0 text-xs text-muted-foreground">{formatRelativeTime(log.createdAt)}</time></div>
                      <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{log.targetType || "未知目标"} #{log.targetId || "-"}</p>
                      <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">{operatorName(log)}{log.reason ? ` · ${log.reason}` : ""}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-border px-3 py-2">
            <Button type="button" variant="ghost" size="sm" disabled={pageNum <= 1 || listLoading} aria-busy={listLoading} onClick={() => changePage(pageNum - 1)}><ChevronLeft className="size-4" />上一页</Button>
            <span className="text-xs text-muted-foreground">{pageNum} / {pageCount}</span>
            <Button type="button" variant="ghost" size="sm" disabled={pageNum >= pageCount || listLoading} aria-busy={listLoading} onClick={() => changePage(pageNum + 1)}>下一页<ChevronRight className="size-4" /></Button>
          </div>
        </div>

        <div className="min-h-[30rem] p-5 sm:p-6">
          {!selectedId ? (
            <div className="flex min-h-[26rem] items-center justify-center text-sm text-muted-foreground">从左侧选择一条操作记录</div>
          ) : detailLoading ? (
            <div className="space-y-4" aria-label="操作日志详情加载中"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-24 w-full" /><div className="grid gap-4 sm:grid-cols-2"><Skeleton className="h-52 w-full" /><Skeleton className="h-52 w-full" /></div></div>
          ) : detailError ? (
            <div className="flex min-h-[26rem] flex-col items-center justify-center text-center"><p className="text-sm font-medium text-foreground">日志详情加载失败</p><p className="mt-1 text-sm text-muted-foreground">{detailError}</p><Button type="button" variant="outline" className="mt-4" onClick={() => setDetailRequestVersion((current) => current + 1)}>重试</Button></div>
          ) : detail ? (
            <div className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="size-10">{detail.operator?.avatarUrl ? <AvatarImage src={detail.operator.avatarUrl} alt="" /> : null}<AvatarFallback>{getAvatarFallback(operatorName(detail))}</AvatarFallback></Avatar>
                  <div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{operatorName(detail)}</p><p className="text-xs text-muted-foreground">管理员 ID {detail.operatorUserId}</p></div>
                </div>
                <span className="rounded-full bg-slate-500/10 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300">{getAdminOperationLabel(detail.action)}</span>
              </div>

              <dl className="grid gap-x-6 gap-y-4 border-y border-border py-4 sm:grid-cols-2">
                <div><dt className="text-xs text-muted-foreground">原始操作值</dt><dd className="mt-1 break-all font-mono text-xs text-foreground">{detail.action || "-"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">目标</dt><dd className="mt-1 text-sm text-foreground">{detail.targetType || "未知目标"} #{detail.targetId || "-"}</dd></div>
                <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">操作原因</dt><dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground">{detail.reason || "未填写"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">客户端 IP</dt><dd className="mt-1 font-mono text-xs text-foreground">{detail.clientIp || "未知"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">操作时间</dt><dd className="mt-1 text-sm text-foreground">{detail.createdAt || "未知"}</dd></div>
                <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">日志 ID</dt><dd className="mt-1 font-mono text-xs text-foreground">{detail.id}</dd></div>
              </dl>

              <div className="grid gap-5 xl:grid-cols-2"><JsonSnapshot label="Before" value={detail.beforeJson} /><JsonSnapshot label="After" value={detail.afterJson} /></div>
              <div className="border-t border-border pt-5"><JsonSnapshot label="Metadata" value={detail.metadataJson} /></div>
            </div>
          ) : (
            <div className="flex min-h-[26rem] flex-col items-center justify-center text-sm text-muted-foreground"><FileJson className="mb-3 size-6" />未找到操作日志详情</div>
          )}
        </div>
      </div>
    </section>
  );
}
