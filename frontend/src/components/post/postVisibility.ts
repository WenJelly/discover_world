export type PostVisibilityValue = "public" | "private";

export function normalizePostVisibilityValue(
  value: string
): PostVisibilityValue {
  return value === "private" ? "private" : "public";
}
