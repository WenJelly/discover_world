import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Flag,
  Image,
  Images,
  Newspaper,
  RefreshCw,
  ScrollText,
  Users,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchAdminDashboard,
  fetchAdminOperationLogList,
} from "@/lib/api";
import { formatRelativeTime, getAvatarFallback } from "@/lib/format";
import type { AdminTab } from "@/lib/admin-navigation";
import { getAdminOperationLabel } from "@/lib/admin-operation";
import type {
  AdminDashboardResponse,
  AdminOperationLogResponse,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type AdminDashboardPanelProps = {
  onNavigate: (tab: AdminTab) => void;
  onOpenAuditLog: (id: string) => void;
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatCount(value: number | undefined) {
  return new Intl.NumberFormat("zh-CN").format(value ?? 0);
}

export function AdminDashboardPanel({
  onNavigate,
  onOpenAuditLog,
}: AdminDashboardPanelProps) {
  const [dashboard, setDashboard] = useState<AdminDashboardResponse | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");
  const [recentLogs, setRecentLogs] = useState<AdminOperationLogResponse[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState("");

  const loadDashboard = useCallback(async () => {
    setDashboardLoading(true);
    setDashboardError("");
    try {
      setDashboard(await fetchAdminDashboard());
    } catch (error) {
      setDashboardError(errorMessage(error, "运营数据加载失败，请稍后重试。"));
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  const loadRecentLogs = useCallback(async () => {
    setLogsLoading(true);
    setLogsError("");
    try {
      const page = await fetchAdminOperationLogList({ pageNum: 1, pageSize: 5 });
      setRecentLogs(page.list ?? []);
    } catch (error) {
      setLogsError(errorMessage(error, "最近操作加载失败，请稍后重试。"));
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
    void loadRecentLogs();
  }, [loadDashboard, loadRecentLogs]);

  const refreshAll = () => {
    void loadDashboard();
    void loadRecentLogs();
  };

  return (
    <section className="space-y-8" aria-labelledby="admin-dashboard-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Operations overview
          </p>
          <h2
            id="admin-dashboard-title"
            className="mt-1 text-xl font-semibold text-foreground"
          >
            数据概览
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            先处理需要行动的事项，再查看站点规模与最近变更。
          </p>
        </div>
        <Button type="button" variant="outline" onClick={refreshAll}>
          <RefreshCw
            className={cn(
              "size-4",
              (dashboardLoading || logsLoading) && "animate-spin"
            )}
          />
          刷新
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)]">
        <div className="space-y-6">
          <section aria-labelledby="admin-dashboard-tasks">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 id="admin-dashboard-tasks" className="text-sm font-semibold text-foreground">
                待办事项
              </h3>
              <span className="text-xs text-muted-foreground">需要管理员处理</span>
            </div>
            <div className="overflow-hidden border-y border-border bg-background sm:rounded-xl sm:border">
              {dashboardLoading && !dashboard ? (
                <div className="space-y-0" aria-label="运营待办加载中">
                  {[0, 1].map((item) => (
                    <div key={item} className="flex items-center gap-4 border-b border-border px-4 py-5 last:border-b-0">
                      <Skeleton className="size-10 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-3 w-40" />
                      </div>
                      <Skeleton className="h-7 w-12" />
                    </div>
                  ))}
                </div>
              ) : dashboardError && !dashboard ? (
                <div className="flex min-h-40 flex-col items-center justify-center px-6 text-center">
                  <p className="text-sm font-medium text-foreground">待办数据加载失败</p>
                  <p className="mt-1 text-sm text-muted-foreground">{dashboardError}</p>
                  <Button type="button" variant="outline" className="mt-4" onClick={() => void loadDashboard()}>
                    重新加载
                  </Button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => onNavigate("media-review")}
                    className="flex w-full items-center gap-4 border-b border-border px-4 py-5 text-left transition-colors hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <span className="flex size-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300">
                      <Images className="size-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-foreground">待审核媒体</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">查看新上传作品并给出审核结论</span>
                    </span>
                    <span className="text-2xl font-semibold tabular-nums text-foreground">
                      {formatCount(dashboard?.pendingMediaCount)}
                    </span>
                    <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate("reports")}
                    className="flex w-full items-center gap-4 px-4 py-5 text-left transition-colors hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <span className="flex size-10 items-center justify-center rounded-lg bg-rose-500/10 text-rose-700 dark:text-rose-300">
                      <Flag className="size-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-foreground">待处理举报</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">核对举报上下文并记录处理结果</span>
                    </span>
                    <span className="text-2xl font-semibold tabular-nums text-foreground">
                      {formatCount(dashboard?.openReportCount)}
                    </span>
                    <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
          </section>

          <section aria-labelledby="admin-dashboard-scale">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 id="admin-dashboard-scale" className="text-sm font-semibold text-foreground">
                站点规模
              </h3>
              <span className="text-xs text-muted-foreground">当前公开数据</span>
            </div>
            <div className="grid overflow-hidden border-y border-border bg-background sm:grid-cols-3 sm:rounded-xl sm:border">
              <div className="border-b border-border px-4 py-5 sm:border-r sm:border-b-0">
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Users className="size-4" aria-hidden="true" />活跃用户
                </p>
                <p className="mt-3 text-2xl font-semibold tabular-nums text-foreground">
                  {dashboardLoading && !dashboard ? <Skeleton className="h-8 w-20" /> : formatCount(dashboard?.activeUserCount)}
                </p>
              </div>
              <a href="/discover" className="border-b border-border px-4 py-5 transition-colors hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:border-r sm:border-b-0">
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Image className="size-4" aria-hidden="true" />公开作品
                </span>
                <span className="mt-3 flex items-end justify-between gap-2 text-2xl font-semibold tabular-nums text-foreground">
                  {dashboardLoading && !dashboard ? <Skeleton className="h-8 w-20" /> : formatCount(dashboard?.publicMediaCount)}
                  <ArrowRight className="mb-1 size-4 text-muted-foreground" aria-hidden="true" />
                </span>
              </a>
              <a href="/community" className="px-4 py-5 transition-colors hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Newspaper className="size-4" aria-hidden="true" />公开动态
                </span>
                <span className="mt-3 flex items-end justify-between gap-2 text-2xl font-semibold tabular-nums text-foreground">
                  {dashboardLoading && !dashboard ? <Skeleton className="h-8 w-20" /> : formatCount(dashboard?.publicPostCount)}
                  <ArrowRight className="mb-1 size-4 text-muted-foreground" aria-hidden="true" />
                </span>
              </a>
            </div>
          </section>
        </div>

        <section aria-labelledby="admin-dashboard-recent" className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 id="admin-dashboard-recent" className="text-sm font-semibold text-foreground">最近操作</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">最近 5 条管理员变更记录</p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => onNavigate("audit")}>
              查看全部操作日志
              <ArrowRight className="size-4" />
            </Button>
          </div>
          <div className="min-h-[26rem] overflow-hidden border-y border-border bg-background sm:rounded-xl sm:border">
            {logsLoading && recentLogs.length === 0 ? (
              <div className="space-y-0" aria-label="最近操作加载中">
                {Array.from({ length: 5 }, (_, index) => (
                  <div key={index} className="flex gap-3 border-b border-border px-4 py-4 last:border-b-0">
                    <Skeleton className="size-9 rounded-full" />
                    <div className="flex-1 space-y-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-full" /></div>
                  </div>
                ))}
              </div>
            ) : logsError && recentLogs.length === 0 ? (
              <div className="flex min-h-[26rem] flex-col items-center justify-center px-6 text-center">
                <ScrollText className="size-6 text-muted-foreground" aria-hidden="true" />
                <p className="mt-3 text-sm font-medium text-foreground">最近操作加载失败</p>
                <p className="mt-1 text-sm text-muted-foreground">{logsError}</p>
                <Button type="button" variant="outline" className="mt-4" onClick={() => void loadRecentLogs()}>重新加载</Button>
              </div>
            ) : recentLogs.length === 0 ? (
              <div className="flex min-h-[26rem] flex-col items-center justify-center px-6 text-center text-sm text-muted-foreground">
                <ScrollText className="mb-3 size-6" aria-hidden="true" />
                暂无管理员操作记录
              </div>
            ) : (
              <div className={cn(logsLoading && "opacity-60")}>
                {recentLogs.map((log) => {
                  const operatorName = log.operator?.nickname || log.operator?.username || `管理员 ${log.operatorUserId}`;
                  return (
                    <button
                      key={log.id}
                      type="button"
                      onClick={() => onOpenAuditLog(log.id)}
                      className="flex w-full gap-3 border-b border-border px-4 py-4 text-left transition-colors last:border-b-0 hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      <Avatar className="size-9">
                        {log.operator?.avatarUrl ? <AvatarImage src={log.operator.avatarUrl} alt="" /> : null}
                        <AvatarFallback>{getAvatarFallback(operatorName)}</AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-3">
                          <span className="truncate text-sm font-medium text-foreground">{getAdminOperationLabel(log.action)}</span>
                          <time dateTime={log.createdAt} className="shrink-0 text-xs text-muted-foreground">{formatRelativeTime(log.createdAt)}</time>
                        </span>
                        <span className="mt-1 block line-clamp-1 text-xs text-muted-foreground">
                          {operatorName} · {log.targetType || "未知目标"} #{log.targetId || "-"}
                        </span>
                        {log.reason ? <span className="mt-1 block line-clamp-1 text-xs text-muted-foreground">{log.reason}</span> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
