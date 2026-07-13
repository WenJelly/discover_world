const OPERATION_LABELS: Record<string, string> = {
  "tag.update": "更新标签",
  "tag.merge": "合并标签",
  "content.feature": "设为精选",
  "content.unfeature": "取消精选",
  "moderation.report.resolve": "处理举报",
  "post.hide": "隐藏动态",
  "post.restore": "恢复动态",
  "comment.hide": "隐藏评论",
  "comment.restore": "恢复评论",
  "forum_post.lock": "锁定论坛帖子",
  "forum_post.unlock": "解锁论坛帖子",
  "forum_post.pin": "论坛分区置顶",
  "forum_post.unpin": "取消论坛置顶",
};

export function getAdminOperationLabel(action: string) {
  const value = action.trim();
  if (!value) return "未知操作";
  return OPERATION_LABELS[value] ?? value;
}

export type AdminOperationJsonView = {
  kind: "json" | "raw" | "empty";
  text: string;
};

export function formatAdminOperationJson(
  value: string | null | undefined
): AdminOperationJsonView {
  const raw = value?.trim() ?? "";
  if (!raw) return { kind: "empty", text: "无" };
  try {
    return {
      kind: "json",
      text: JSON.stringify(JSON.parse(raw), null, 2),
    };
  } catch {
    return { kind: "raw", text: raw };
  }
}
