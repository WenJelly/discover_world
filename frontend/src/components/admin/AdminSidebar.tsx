import {
  ArrowLeft,
  Flag,
  House,
  Images,
  LayoutDashboard,
  ScrollText,
  ShieldCheck,
  Tags,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  buildAdminTabHref,
  type AdminTab,
} from "@/lib/admin-navigation";

type AdminSidebarProps = {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
};

const ADMIN_GROUPS = [
  {
    label: "运营概览",
    items: [
      { id: "dashboard", label: "数据概览", icon: LayoutDashboard },
    ],
  },
  {
    label: "内容管理",
    items: [
      { id: "homepage", label: "首页配置", icon: House },
      { id: "media-review", label: "媒体审核", icon: Images },
      { id: "reports", label: "举报工单", icon: Flag },
      { id: "moderation", label: "内容治理", icon: ShieldCheck },
    ],
  },
  {
    label: "运营管理",
    items: [
      { id: "tags", label: "标签管理", icon: Tags },
      { id: "audit", label: "操作审计", icon: ScrollText },
    ],
  },
] satisfies Array<{
  label: string;
  items: Array<{ id: AdminTab; label: string; icon: typeof House }>;
}>;

export function AdminSidebar({ activeTab, onTabChange }: AdminSidebarProps) {
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar
      collapsible="icon"
      className="top-[var(--navbar-height,4rem)] h-[calc(100svh-var(--navbar-height,4rem))]"
    >
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        <div className="flex min-w-0 items-center gap-3 px-1">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <ShieldCheck className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-semibold">管理员控制台</p>
            <p className="truncate text-xs text-sidebar-foreground/60">
              内容与审核工作区
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {ADMIN_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const href = buildAdminTabHref(item.id);
                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        isActive={activeTab === item.id}
                        tooltip={item.label}
                        render={
                          <a
                            href={href}
                            onClick={(event) => {
                              event.preventDefault();
                              onTabChange(item.id);
                              setOpenMobile(false);
                            }}
                          />
                        }
                      >
                        <Icon aria-hidden="true" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="返回网站首页"
              render={<a href="/" />}
            >
              <ArrowLeft aria-hidden="true" />
              <span>返回网站首页</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
