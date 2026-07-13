export function getAdminContentKey(targetType: string, id: string) {
  return `${targetType}:${id}`;
}

export function updateAdminContentStatus<
  T extends { id: string; targetType: string; status: string },
>(items: T[], selectedKey: string, status: string): T[] {
  return items.map((item) =>
    getAdminContentKey(item.targetType, item.id) === selectedKey
      ? { ...item, status }
      : item
  );
}
