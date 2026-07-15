import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Merge,
  Pencil,
  RefreshCw,
  RotateCcw,
  Search,
  Tags,
} from "lucide-react";
import { toast as sonner } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { fetchAdminTagList, mergeAdminTag, updateAdminTag } from "@/lib/api";
import { formatRelativeTime } from "@/lib/format";
import { interactiveSurfaceClassName } from "@/lib/interactive-surface";
import type { AdminTagResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

type TagFilters = {
  name: string;
  tagType: string;
  status: 0 | 1;
};

type EditDraft = {
  name: string;
  slug: string;
  tagType: string;
  status: 0 | 1;
  reason: string;
};

const DEFAULT_FILTERS: TagFilters = {
  name: "",
  tagType: "",
  status: 1,
};

const TAG_TYPE_OPTIONS = [
  { value: "normal", label: "普通" },
  { value: "system", label: "系统" },
  { value: "ai", label: "机器生成" },
  { value: "topic", label: "话题" },
] as const;

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function tagTypeLabel(value: string) {
  return TAG_TYPE_OPTIONS.find((item) => item.value === value)?.label ?? value;
}

function toEditDraft(tag: AdminTagResponse): EditDraft {
  return {
    name: tag.name,
    slug: tag.slug,
    tagType: tag.tagType,
    status: tag.status === 0 ? 0 : 1,
    reason: "",
  };
}

export function AdminTagManagementPanel() {
  const [draftFilters, setDraftFilters] = useState<TagFilters>(DEFAULT_FILTERS);
  const [filters, setFilters] = useState<TagFilters>(DEFAULT_FILTERS);
  const [pageNum, setPageNum] = useState(1);
  const [tags, setTags] = useState<AdminTagResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [highlightedTagId, setHighlightedTagId] = useState("");

  const [editTag, setEditTag] = useState<AdminTagResponse | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [mergeSource, setMergeSource] = useState<AdminTagResponse | null>(null);
  const [targetSearch, setTargetSearch] = useState("");
  const [targetResults, setTargetResults] = useState<AdminTagResponse[]>([]);
  const [targetLoading, setTargetLoading] = useState(false);
  const [targetError, setTargetError] = useState("");
  const [mergeTarget, setMergeTarget] = useState<AdminTagResponse | null>(null);
  const [mergeReason, setMergeReason] = useState("");
  const [merging, setMerging] = useState(false);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const loadTags = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const page = await fetchAdminTagList({
        name: filters.name.trim() || undefined,
        tagType: filters.tagType || undefined,
        status: filters.status,
        pageNum,
        pageSize: PAGE_SIZE,
      });
      setTags(page.list ?? []);
      setTotal(page.total ?? 0);
    } catch (loadError) {
      setError(errorMessage(loadError, "标签列表加载失败，请稍后重试。"));
    } finally {
      setLoading(false);
    }
  }, [filters, pageNum]);

  useEffect(() => {
    void loadTags();
  }, [loadTags]);

  const submitFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setHighlightedTagId("");
    setPageNum(1);
    setFilters({ ...draftFilters, name: draftFilters.name.trim() });
  };

  const clearFilters = () => {
    setHighlightedTagId("");
    setDraftFilters(DEFAULT_FILTERS);
    setFilters(DEFAULT_FILTERS);
    setPageNum(1);
  };

  const openEdit = (tag: AdminTagResponse) => {
    setEditTag(tag);
    setEditDraft(toEditDraft(tag));
  };

  const handleEditOpenChange = (open: boolean) => {
    if (open || savingEdit) return;
    setEditTag(null);
    setEditDraft(null);
  };

  const editValid = Boolean(
    editTag &&
      editDraft?.name.trim() &&
      editDraft.slug.trim() &&
      editDraft.tagType.trim() &&
      editDraft.reason.trim()
  );

  const handleUpdateTag = async () => {
    if (!editTag || !editDraft || !editValid || savingEdit) return;
    setSavingEdit(true);
    try {
      const next = await updateAdminTag({
        id: editTag.id,
        name: editDraft.name.trim(),
        slug: editDraft.slug.trim(),
        tagType: editDraft.tagType.trim(),
        status: editDraft.status,
        reason: editDraft.reason.trim(),
      });
      if (next.status !== filters.status) {
        await loadTags();
      } else {
        setTags((current) =>
          current.map((item) => (item.id === next.id ? next : item))
        );
      }
      setHighlightedTagId(next.id);
      setEditTag(null);
      setEditDraft(null);
      sonner.success("标签已更新", { description: `“${next.name}”的信息已保存。` });
    } catch (updateError) {
      sonner.error("标签更新失败", {
        description: errorMessage(updateError, "请检查标签信息后重试。"),
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const openMerge = (tag: AdminTagResponse) => {
    setMergeSource(tag);
    setTargetSearch("");
    setTargetResults([]);
    setTargetError("");
    setMergeTarget(null);
    setMergeReason("");
  };

  const handleMergeOpenChange = (open: boolean) => {
    if (open || merging) return;
    setMergeSource(null);
    setMergeTarget(null);
    setTargetResults([]);
    setTargetError("");
    setMergeReason("");
  };

  const searchTargets = async () => {
    if (!mergeSource || targetLoading) return;
    setTargetLoading(true);
    setTargetError("");
    setMergeTarget(null);
    try {
      const page = await fetchAdminTagList({
        name: targetSearch.trim() || undefined,
        status: 1,
        pageNum: 1,
        pageSize: PAGE_SIZE,
      });
      setTargetResults(
        (page.list ?? []).filter((item) => item.id !== mergeSource.id)
      );
    } catch (searchError) {
      setTargetResults([]);
      setTargetError(errorMessage(searchError, "目标标签搜索失败，请稍后重试。"));
    } finally {
      setTargetLoading(false);
    }
  };

  const canMerge = Boolean(
    mergeSource &&
      mergeTarget &&
      mergeTarget.id !== mergeSource.id &&
      mergeReason.trim() &&
      !merging
  );

  const handleMerge = async () => {
    if (!mergeSource || !mergeTarget || !canMerge) return;
    setMerging(true);
    try {
      const next = await mergeAdminTag({
        sourceTagId: mergeSource.id,
        targetTagId: mergeTarget.id,
        reason: mergeReason.trim(),
      });
      setHighlightedTagId(next.id);
      setMergeSource(null);
      setMergeTarget(null);
      setTargetResults([]);
      setMergeReason("");
      sonner.success("标签已合并", {
        description: `标签关联已迁移到“${next.name}”。`,
      });
      if (pageNum === 1) {
        await loadTags();
      } else {
        setPageNum(1);
      }
    } catch (mergeError) {
      sonner.error("标签合并失败", {
        description: errorMessage(mergeError, "请检查目标标签后重试。"),
      });
    } finally {
      setMerging(false);
    }
  };

  const targetSummary = useMemo(
    () => targetResults.find((item) => item.id === mergeTarget?.id) ?? mergeTarget,
    [mergeTarget, targetResults]
  );

  return (
    <section className="space-y-5" aria-labelledby="admin-tags-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Tag operations</p>
          <h2 id="admin-tags-title" className="mt-1 text-xl font-semibold text-foreground">标签管理</h2>
          <p className="mt-1 text-sm text-muted-foreground">维护标签语义，通过停用或合并处理重复标签。</p>
        </div>
        <Button type="button" variant="outline" aria-busy={loading} onClick={() => void loadTags()}>
          <RefreshCw className={cn("size-4", loading && "animate-spin")} />刷新
        </Button>
      </div>

      <form
        className="grid gap-3 border-y border-border bg-background py-4 sm:grid-cols-2 sm:rounded-lg sm:border sm:px-4 lg:grid-cols-[minmax(12rem,1.4fr)_minmax(10rem,1fr)_minmax(9rem,0.8fr)_auto] lg:items-end"
        onSubmit={submitFilters}
      >
        <div className="space-y-1.5">
          <Label htmlFor="admin-tag-name">标签名称</Label>
          <Input id="admin-tag-name" value={draftFilters.name} onChange={(event) => setDraftFilters((current) => ({ ...current, name: event.target.value }))} placeholder="按名称搜索" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="admin-tag-type">标签类型</Label>
          <Select value={draftFilters.tagType || "any"} onValueChange={(value) => value && setDraftFilters((current) => ({ ...current, tagType: value === "any" ? "" : value }))}>
            <SelectTrigger id="admin-tag-type" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectItem value="any">任意类型</SelectItem>
              {TAG_TYPE_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="admin-tag-status">状态</Label>
          <Select value={String(draftFilters.status)} onValueChange={(value) => value && setDraftFilters((current) => ({ ...current, status: value === "0" ? 0 : 1 }))}>
            <SelectTrigger id="admin-tag-status" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectItem value="1">启用</SelectItem>
              <SelectItem value="0">停用</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="icon" aria-label="清除标签筛选" onClick={clearFilters}><RotateCcw className="size-4" /></Button>
          <Button type="submit">查询标签</Button>
        </div>
      </form>

      <div className="overflow-hidden border-y border-border bg-background sm:rounded-xl sm:border">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 text-sm">
          <span className="font-medium text-foreground">标签列表</span>
          <span className="text-muted-foreground">共 {total} 条</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="bg-muted/35 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">名称</th><th className="px-4 py-3 font-medium">Slug</th><th className="px-4 py-3 font-medium">类型</th><th className="px-4 py-3 font-medium">状态</th><th className="px-4 py-3 font-medium">创建时间</th><th className="px-4 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody className={cn(loading && tags.length > 0 && "opacity-60")}>
              {loading && tags.length === 0 ? Array.from({ length: 6 }, (_, index) => (
                <tr key={index} className="border-t border-border"><td className="px-4 py-4"><Skeleton className="h-4 w-24" /></td><td className="px-4 py-4"><Skeleton className="h-4 w-28" /></td><td className="px-4 py-4"><Skeleton className="h-4 w-16" /></td><td className="px-4 py-4"><Skeleton className="h-5 w-12" /></td><td className="px-4 py-4"><Skeleton className="h-4 w-20" /></td><td className="px-4 py-4"><Skeleton className="ml-auto h-8 w-24" /></td></tr>
              )) : tags.map((tag) => (
                <tr key={tag.id} className={cn("border-t border-border transition-colors", highlightedTagId === tag.id && "bg-blue-500/8")}>
                  <td className="px-4 py-4"><p className="font-medium text-foreground">{tag.name}</p><p className="mt-0.5 text-xs text-muted-foreground">ID {tag.id}</p></td>
                  <td className="px-4 py-4 font-mono text-xs text-foreground">{tag.slug || "-"}</td>
                  <td className="px-4 py-4 text-foreground">{tagTypeLabel(tag.tagType)}</td>
                  <td className="px-4 py-4"><span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", tag.status === 1 ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-slate-500/10 text-slate-600 dark:text-slate-300")}>{tag.status === 1 ? "启用" : "停用"}</span></td>
                  <td className="px-4 py-4 text-xs text-muted-foreground"><time dateTime={tag.createdAt}>{formatRelativeTime(tag.createdAt)}</time></td>
                  <td className="px-4 py-4"><div className="flex justify-end gap-1"><Button type="button" variant="ghost" size="sm" onClick={() => openEdit(tag)}><Pencil className="size-4" />编辑</Button><Button type="button" variant="ghost" size="sm" onClick={() => openMerge(tag)}><Merge className="size-4" />合并</Button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && error && tags.length === 0 ? (
          <div className="flex min-h-52 flex-col items-center justify-center px-6 text-center"><Tags className="size-6 text-muted-foreground" /><p className="mt-3 text-sm font-medium text-foreground">标签列表加载失败</p><p className="mt-1 text-sm text-muted-foreground">{error}</p><Button type="button" variant="outline" className="mt-4" aria-busy={loading} onClick={() => void loadTags()}>重新加载</Button></div>
        ) : !loading && !error && tags.length === 0 ? (
          <div className="flex min-h-52 flex-col items-center justify-center px-6 text-center"><Tags className="size-6 text-muted-foreground" /><p className="mt-3 text-sm font-medium text-foreground">没有符合条件的标签</p><Button type="button" variant="ghost" className="mt-2" onClick={clearFilters}>恢复默认筛选</Button></div>
        ) : null}
        <div className="flex items-center justify-between border-t border-border px-3 py-2">
          <Button type="button" variant="ghost" size="sm" disabled={pageNum <= 1 || loading} aria-busy={loading} onClick={() => { setHighlightedTagId(""); setPageNum((current) => Math.max(1, current - 1)); }}><ChevronLeft className="size-4" />上一页</Button>
          <span className="text-xs text-muted-foreground">{pageNum} / {pageCount}</span>
          <Button type="button" variant="ghost" size="sm" disabled={pageNum >= pageCount || loading} aria-busy={loading} onClick={() => { setHighlightedTagId(""); setPageNum((current) => Math.min(pageCount, current + 1)); }}>下一页<ChevronRight className="size-4" /></Button>
        </div>
      </div>

      <Dialog open={Boolean(editTag)} onOpenChange={handleEditOpenChange}>
        <DialogContent className="max-h-[85dvh] max-w-xl overflow-y-auto">
          <DialogHeader><DialogTitle>编辑标签</DialogTitle><DialogDescription>修改标签语义和状态，原因将写入操作审计。</DialogDescription></DialogHeader>
          {editDraft ? <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="edit-tag-name">名称</Label><Input id="edit-tag-name" value={editDraft.name} onChange={(event) => setEditDraft((current) => current ? { ...current, name: event.target.value } : current)} /></div>
            <div className="space-y-1.5"><Label htmlFor="edit-tag-slug">Slug</Label><Input id="edit-tag-slug" value={editDraft.slug} onChange={(event) => setEditDraft((current) => current ? { ...current, slug: event.target.value } : current)} /></div>
            <div className="space-y-1.5"><Label htmlFor="edit-tag-type">类型</Label><Select value={editDraft.tagType} onValueChange={(value) => value && setEditDraft((current) => current ? { ...current, tagType: value } : current)}><SelectTrigger id="edit-tag-type" className="w-full"><SelectValue /></SelectTrigger><SelectContent alignItemWithTrigger={false}>{TAG_TYPE_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label htmlFor="edit-tag-status">状态</Label><Select value={String(editDraft.status)} onValueChange={(value) => value && setEditDraft((current) => current ? { ...current, status: value === "0" ? 0 : 1 } : current)}><SelectTrigger id="edit-tag-status" className="w-full"><SelectValue /></SelectTrigger><SelectContent alignItemWithTrigger={false}><SelectItem value="1">启用</SelectItem><SelectItem value="0">停用</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="edit-tag-reason">修改原因</Label><textarea id="edit-tag-reason" value={editDraft.reason} onChange={(event) => setEditDraft((current) => current ? { ...current, reason: event.target.value } : current)} rows={4} maxLength={500} placeholder="说明本次修改的业务原因" className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30" /><p className="text-right text-xs text-muted-foreground">{editDraft.reason.length} / 500</p></div>
          </div> : null}
          <DialogFooter><Button type="button" variant="outline" disabled={savingEdit} onClick={() => handleEditOpenChange(false)}>取消</Button><Button type="button" disabled={!editValid || savingEdit} aria-busy={savingEdit} onClick={() => void handleUpdateTag()}>{savingEdit ? <Spinner aria-label="加载中" /> : null}保存标签</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(mergeSource)} onOpenChange={handleMergeOpenChange}>
        <DialogContent className="max-h-[85dvh] max-w-xl overflow-y-auto">
          <DialogHeader><DialogTitle>合并标签</DialogTitle><DialogDescription>将重复标签的所有关联迁移到保留标签。</DialogDescription></DialogHeader>
          {mergeSource ? <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label>源标签</Label><div className="rounded-lg border border-border bg-muted/35 px-3 py-2"><p className="text-sm font-medium text-foreground">{mergeSource.name}</p><p className="text-xs text-muted-foreground">{mergeSource.slug} · ID {mergeSource.id}</p></div></div><div className="space-y-1.5"><Label>目标标签</Label><div className="rounded-lg border border-border bg-muted/35 px-3 py-2"><p className="text-sm font-medium text-foreground">{targetSummary?.name || "尚未选择"}</p><p className="text-xs text-muted-foreground">{targetSummary ? `${targetSummary.slug} · ID ${targetSummary.id}` : "搜索并选择启用标签"}</p></div></div></div>
            <div className="space-y-1.5"><Label htmlFor="merge-target-search">搜索目标标签</Label><div className="flex gap-2"><Input id="merge-target-search" value={targetSearch} onChange={(event) => setTargetSearch(event.target.value)} placeholder="输入标签名称" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void searchTargets(); } }} /><Button type="button" variant="outline" disabled={targetLoading} aria-busy={targetLoading} onClick={() => void searchTargets()}>{targetLoading ? <Spinner aria-label="加载中" /> : <Search className="size-4" />}搜索</Button></div></div>
            {targetError ? <p className="text-sm text-destructive">{targetError}</p> : null}
            {targetResults.length > 0 ? <div className="max-h-52 overflow-y-auto rounded-lg border border-border" aria-label="目标标签搜索结果">{targetResults.map((tag) => <button key={tag.id} data-slot="interactive-surface" type="button" onClick={() => setMergeTarget(tag)} className={cn(interactiveSurfaceClassName, "flex w-full items-center justify-between gap-3 border-b border-border px-3 py-3 text-left last:border-b-0 hover:bg-muted/45 focus-visible:ring-inset", mergeTarget?.id === tag.id && "bg-muted")}><span><span className="block text-sm font-medium text-foreground">{tag.name}</span><span className="text-xs text-muted-foreground">{tag.slug} · {tagTypeLabel(tag.tagType)}</span></span><span className="text-xs text-muted-foreground">ID {tag.id}</span></button>)}</div> : null}
            <div className="space-y-1.5"><Label htmlFor="merge-tag-reason">合并原因</Label><textarea id="merge-tag-reason" value={mergeReason} onChange={(event) => setMergeReason(event.target.value)} rows={4} maxLength={500} placeholder="说明两个标签需要合并的原因" className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30" /><p className="text-right text-xs text-muted-foreground">{mergeReason.length} / 500</p></div>
            <div className="rounded-lg bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-800 dark:text-amber-200">提交后，源标签的标签关联将迁移到目标标签，源标签会被停用。此操作不会删除目标内容。</div>
          </div> : null}
          <DialogFooter><Button type="button" variant="outline" disabled={merging} onClick={() => handleMergeOpenChange(false)}>取消</Button><Button type="button" variant="destructive" disabled={!canMerge} aria-busy={merging} onClick={() => void handleMerge()}>{merging ? <Spinner aria-label="加载中" /> : <Merge className="size-4" />}确认合并</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
