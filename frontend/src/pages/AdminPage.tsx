import { useCallback, useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";

import { AdminContentModerationPanel } from "@/components/admin/AdminContentModerationPanel";
import { AdminAuditPanel } from "@/components/admin/AdminAuditPanel";
import { AdminDashboardPanel } from "@/components/admin/AdminDashboardPanel";
import { AdminHomepagePanel } from "@/components/admin/AdminHomepagePanel";
import { AdminMediaReviewPanel } from "@/components/admin/AdminMediaReviewPanel";
import { AdminReportsPanel } from "@/components/admin/AdminReportsPanel";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminTagManagementPanel } from "@/components/admin/AdminTagManagementPanel";
import { Button } from "@/components/ui/button";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useAuth } from "@/context/AuthContext";
import {
  buildAdminTabHref,
  parseAdminLogId,
  parseAdminTab,
  type AdminTab,
} from "@/lib/admin-navigation";

function isAdminRole(role?: string | null) {
  return (role ?? "").trim().toLowerCase() === "admin";
}

const ADMIN_SECTION_COPY: Record<
  AdminTab,
  { title: string; description: string }
> = {
  dashboard: {
    title: "数据概览",
    description: "查看后台待办与站点运营数据。",
  },
  homepage: {
    title: "首页内容管理",
    description: "配置 Hero 大图与精选作品流。",
  },
  "media-review": {
    title: "媒体审核",
    description: "处理待审核作品并记录审核结论。",
  },
  reports: {
    title: "举报工单",
    description: "查看用户举报并完成处理与内容治理。",
  },
  moderation: {
    title: "内容治理",
    description: "管理动态、评论和论坛帖的公开状态。",
  },
  tags: {
    title: "标签管理",
    description: "维护标签信息、状态与合并关系。",
  },
  audit: {
    title: "操作审计",
    description: "查询管理员操作记录与变更快照。",
  },
};

function navigateTo(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new Event("popstate"));
  window.scrollTo({ top: 0 });
}

export default function AdminPage() {
  const { user, isAuthenticated } = useAuth();
  const isAdmin =
    isAuthenticated && isAdminRole(user?.role || user?.userRole);
  const [activeTab, setActiveTab] = useState<AdminTab>(() =>
    parseAdminTab(new URLSearchParams(window.location.search).get("tab"))
  );
  const [activeLogId, setActiveLogId] = useState(() =>
    parseAdminLogId(new URLSearchParams(window.location.search).get("logId"))
  );

  useEffect(() => {
    const syncTabFromLocation = () => {
      const params = new URLSearchParams(window.location.search);
      setActiveTab(parseAdminTab(params.get("tab")));
      setActiveLogId(parseAdminLogId(params.get("logId")));
    };
    window.addEventListener("popstate", syncTabFromLocation);
    return () => window.removeEventListener("popstate", syncTabFromLocation);
  }, []);

  const handleTabChange = useCallback((tab: AdminTab) => {
    const href = buildAdminTabHref(tab);
    window.history.pushState({}, "", href);
    setActiveTab(tab);
    setActiveLogId("");
    window.scrollTo({ top: 0 });
  }, []);

  const handleAuditLogOpen = useCallback((id: string) => {
    const href = buildAdminTabHref("audit", { logId: id });
    window.history.pushState({}, "", href);
    setActiveTab("audit");
    setActiveLogId(id);
    window.scrollTo({ top: 0 });
  }, []);

  const handleAuditLogChange = useCallback((id: string) => {
    const href = buildAdminTabHref("audit", { logId: id });
    window.history.replaceState({}, "", href);
    setActiveLogId(id);
  }, []);

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 pt-16 dark:bg-slate-950">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
            <ShieldAlert className="size-7" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            无权访问
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            该页面仅站点管理员可见。如果你认为这是一个错误，请联系管理员。
          </p>
          <Button type="button" className="mt-6" onClick={() => navigateTo("/")}>
            返回首页
          </Button>
        </div>
      </div>
    );
  }

  const sectionCopy = ADMIN_SECTION_COPY[activeTab];

  return (
    <SidebarProvider className="min-h-[calc(100svh-var(--navbar-height,4rem))] pt-[var(--navbar-height,4rem)]">
      <AdminSidebar activeTab={activeTab} onTabChange={handleTabChange} />
      <SidebarInset className="min-w-0 bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
        <header className="sticky top-[var(--navbar-height,4rem)] z-20 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:px-6">
          <SidebarTrigger aria-label="切换后台侧边栏" />
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-foreground">
              {sectionCopy.title}
            </h1>
            <p className="hidden truncate text-xs text-muted-foreground sm:block">
              {sectionCopy.description}
            </p>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
          {activeTab === "dashboard" ? (
            <AdminDashboardPanel
              onNavigate={handleTabChange}
              onOpenAuditLog={handleAuditLogOpen}
            />
          ) : activeTab === "homepage" ? (
            <AdminHomepagePanel />
          ) : activeTab === "media-review" ? (
            <AdminMediaReviewPanel />
          ) : activeTab === "reports" ? (
            <AdminReportsPanel />
          ) : activeTab === "moderation" ? (
            <AdminContentModerationPanel />
          ) : activeTab === "tags" ? (
            <AdminTagManagementPanel />
          ) : activeTab === "audit" ? (
            <AdminAuditPanel
              selectedId={activeLogId}
              onSelectedIdChange={handleAuditLogChange}
            />
          ) : (
            <div className="flex min-h-[24rem] items-center justify-center border-y border-border bg-background text-sm text-muted-foreground sm:rounded-xl sm:border">
              {sectionCopy.title}将在当前阶段完成
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
