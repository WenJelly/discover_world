import type { PictureResponse } from "./types";

export const DISCOVER_TABS = [
  { key: "rating", title: "热门" },
  { key: "upcoming", title: "排名上升" },
  { key: "fresh", title: "新作" },
  { key: "set", title: "影集" },
  { key: "story", title: "专栏" },
] as const;

export const DISCOVER_SORT_OPTIONS = [
  { key: "1", title: "热度排序" },
  { key: "2", title: "时间排序" },
] as const;

export const DISCOVER_PHOTOGRAPHER_OPTIONS = [
  { key: "0", title: "全部摄影师" },
  { key: "1", title: "值得关注" },
] as const;

export const DISCOVER_CATEGORY_OPTIONS = [
  { key: "all", title: "全部类别" },
  { key: "0", title: "未分类" },
  { key: "11", title: "极简抽象" },
  { key: "14", title: "植物" },
  { key: "15", title: "微距" },
  { key: "16", title: "肖像" },
  { key: "17", title: "舞台演出" },
  { key: "19", title: "静物（美食）" },
  { key: "2", title: "动物" },
  { key: "22", title: "水下" },
  { key: "3", title: "黑白" },
  { key: "36", title: "建筑" },
  { key: "43", title: "自然风光" },
  { key: "45", title: "人文纪实" },
  { key: "46", title: "航拍" },
  { key: "47", title: "夜景" },
  { key: "5", title: "城市风光" },
  { key: "9", title: "时尚" },
] as const;

export const DISCOVER_LAYOUT_OPTIONS = [
  { key: "justified", title: "等高瀑布流" },
  { key: "grid", title: "规整展示" },
] as const;

export type DiscoverTabKey = (typeof DISCOVER_TABS)[number]["key"];
export type DiscoverSortKey = (typeof DISCOVER_SORT_OPTIONS)[number]["key"];
export type DiscoverPhotographerKey =
  (typeof DISCOVER_PHOTOGRAPHER_OPTIONS)[number]["key"];
export type DiscoverCategoryKey =
  (typeof DISCOVER_CATEGORY_OPTIONS)[number]["key"];
export type DiscoverLayoutKey = (typeof DISCOVER_LAYOUT_OPTIONS)[number]["key"];

export type DiscoverSearchState = {
  tab: DiscoverTabKey;
  sort: DiscoverSortKey;
  category: DiscoverCategoryKey;
  photographerType: DiscoverPhotographerKey;
  layout: DiscoverLayoutKey;
};

export type JustifiedLayoutItem = {
  picture: PictureResponse;
  displayWidth: number;
  displayHeight: number;
};

export type JustifiedLayoutRow = {
  height: number;
  items: JustifiedLayoutItem[];
};

const VALID_TABS = new Set<string>(DISCOVER_TABS.map((item) => item.key));
const VALID_CATEGORIES = new Set<string>(
  DISCOVER_CATEGORY_OPTIONS.map((item) => item.key)
);
const VALID_LAYOUTS = new Set<string>(DISCOVER_LAYOUT_OPTIONS.map((item) => item.key));

const CATEGORY_ALIASES: Record<string, string[]> = {
  "0": ["未分类"],
  "11": ["极简抽象", "抽象"],
  "14": ["植物"],
  "15": ["微距"],
  "16": ["肖像", "人像"],
  "17": ["舞台演出"],
  "19": ["静物（美食）", "静物", "美食"],
  "2": ["动物"],
  "22": ["水下"],
  "3": ["黑白"],
  "36": ["建筑"],
  "43": ["自然风光", "风光"],
  "45": ["人文纪实", "纪实"],
  "46": ["航拍"],
  "47": ["夜景"],
  "5": ["城市风光", "城市"],
  "9": ["时尚"],
};

function normalizeLabel(value: string | undefined | null) {
  return (value || "").replace(/\s+/g, "").trim().toLowerCase();
}

function getTimeValue(picture: PictureResponse) {
  const parsed = Date.parse(picture.createTime || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function getAspectRatio(picture: PictureResponse) {
  if (picture.picWidth > 0 && picture.picHeight > 0) {
    return Math.max(0.6, Math.min(picture.picWidth / picture.picHeight, 2.4));
  }

  return 4 / 3;
}

function getHotScore(picture: PictureResponse) {
  return getTimeValue(picture);
}

function getUpcomingScore(picture: PictureResponse) {
  return getTimeValue(picture);
}

export function parseDiscoverSearch(search: string): DiscoverSearchState {
  const params = new URLSearchParams(search);
  const tab = params.get("t") || "rating";
  const sort = params.get("sort") || "1";
  const category = params.get("category") || "all";
  const photographerType = params.get("m") || "0";
  const layout = params.get("layout") || "justified";

  return {
    tab: VALID_TABS.has(tab) ? (tab as DiscoverTabKey) : "rating",
    sort: sort === "2" ? "2" : "1",
    category: VALID_CATEGORIES.has(category)
      ? (category as DiscoverCategoryKey)
      : "all",
    photographerType: photographerType === "1" ? "1" : "0",
    layout: VALID_LAYOUTS.has(layout) ? (layout as DiscoverLayoutKey) : "justified",
  };
}

export function buildDiscoverSearch(state: DiscoverSearchState) {
  const params = new URLSearchParams();

  if (state.tab !== "rating") {
    params.set("t", state.tab);
  }
  if (state.sort !== "1") {
    params.set("sort", state.sort);
  }
  if (state.category !== "all") {
    params.set("category", state.category);
  }
  if (state.photographerType !== "0") {
    params.set("m", state.photographerType);
  }
  if (state.layout !== "justified") {
    params.set("layout", state.layout);
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

export function getDiscoverCategoryQuery(category: DiscoverCategoryKey) {
  if (category === "all") {
    return undefined;
  }

  return DISCOVER_CATEGORY_OPTIONS.find((item) => item.key === category)?.title;
}

export function resolveDiscoverPreviewIndex<T extends { id: string }>(
  pictures: T[],
  selectedAssetId: string | null
) {
  if (!selectedAssetId) {
    return -1;
  }

  return pictures.findIndex((picture) => picture.id === selectedAssetId);
}

export function matchesDiscoverCategory(
  picture: PictureResponse,
  category: DiscoverCategoryKey
) {
  if (category === "all") {
    return true;
  }

  const target = normalizeLabel(picture.category);
  const aliases = CATEGORY_ALIASES[category] || [];

  return aliases.some((alias) => normalizeLabel(alias) === target);
}

export function matchesDiscoverPhotographer(
  picture: PictureResponse,
  photographerType: DiscoverPhotographerKey
) {
  if (photographerType !== "1") {
    return true;
  }

  return picture.likeCount >= 24 || picture.viewCount >= 240;
}

export function filterAndSortDiscoverPictures(
  pictures: PictureResponse[],
  state: DiscoverSearchState
) {
  const filtered = pictures
    .filter((picture) => matchesDiscoverCategory(picture, state.category))
    .filter((picture) =>
      matchesDiscoverPhotographer(picture, state.photographerType)
    );

  if (
    (state.tab === "rating" && state.sort === "1") ||
    state.tab === "upcoming"
  ) {
    return filtered;
  }

  return filtered.sort((left, right) => {
    if (state.tab === "fresh" || state.sort === "2") {
      return getTimeValue(right) - getTimeValue(left);
    }
    if (state.tab === "upcoming") {
      return getUpcomingScore(right) - getUpcomingScore(left);
    }

    return getHotScore(right) - getHotScore(left);
  });
}

function buildRow(
  pictures: PictureResponse[],
  containerWidth: number,
  height: number,
  gap: number,
  justify = true
) {
  const safeHeight = Math.max(1, Math.round(height));
  const gapWidth = gap * Math.max(0, pictures.length - 1);
  const targetWidth = Math.max(1, containerWidth - gapWidth);
  let consumedWidth = 0;

  const items = pictures.map((picture, index) => {
    const remaining = pictures.length - index - 1;
    const computedWidth =
      justify && remaining === 0
        ? Math.max(1, targetWidth - consumedWidth)
        : Math.max(1, Math.round(getAspectRatio(picture) * safeHeight));

    consumedWidth += computedWidth;

    return {
      picture,
      displayWidth: computedWidth,
      displayHeight: safeHeight,
    };
  });

  return {
    height: safeHeight,
    items,
  };
}

export function buildJustifiedRows(
  pictures: PictureResponse[],
  containerWidth: number,
  targetRowHeight: number,
  gap: number
) {
  if (containerWidth <= 0 || pictures.length === 0) {
    return [] satisfies JustifiedLayoutRow[];
  }

  const rows: JustifiedLayoutRow[] = [];
  let rowPictures: PictureResponse[] = [];
  let aspectRatioSum = 0;

  for (const picture of pictures) {
    rowPictures.push(picture);
    aspectRatioSum += getAspectRatio(picture);

    const innerWidth = containerWidth - gap * Math.max(0, rowPictures.length - 1);
    const suggestedHeight = innerWidth / aspectRatioSum;
    const shouldCommit =
      suggestedHeight <= targetRowHeight * 1.15 || rowPictures.length >= 4;

    if (shouldCommit) {
      rows.push(buildRow(rowPictures, containerWidth, suggestedHeight, gap));
      rowPictures = [];
      aspectRatioSum = 0;
    }
  }

  if (rowPictures.length > 0) {
    const innerWidth = containerWidth - gap * Math.max(0, rowPictures.length - 1);
    const looseHeight = innerWidth / Math.max(aspectRatioSum, 0.1);
    rows.push(
      buildRow(
        rowPictures,
        containerWidth,
        Math.min(targetRowHeight, looseHeight),
        gap,
        false
      )
    );
  }

  return rows;
}

function buildRegularColumnWidths(containerWidth: number, columns: number, gap: number) {
  const availableWidth = Math.max(1, containerWidth - gap * Math.max(0, columns - 1));
  const baseWidth = Math.max(1, Math.floor(availableWidth / columns));
  const remainder = Math.max(0, availableWidth - baseWidth * columns);

  return Array.from({ length: columns }, (_, index) =>
    index >= columns - remainder ? baseWidth + 1 : baseWidth
  );
}

export function buildRegularGridRows(
  pictures: PictureResponse[],
  containerWidth: number,
  gap: number,
  minTileWidth: number
) {
  if (containerWidth <= 0 || pictures.length === 0) {
    return [] satisfies JustifiedLayoutRow[];
  }

  const columns = Math.max(
    1,
    Math.floor((containerWidth + gap) / (Math.max(1, minTileWidth) + gap))
  );
  const columnWidths = buildRegularColumnWidths(containerWidth, columns, gap);
  const rows: JustifiedLayoutRow[] = [];

  for (let index = 0; index < pictures.length; index += columns) {
    const rowPictures = pictures.slice(index, index + columns);
    const items = rowPictures.map((picture, columnIndex) => {
      const width = columnWidths[columnIndex] || columnWidths[columnWidths.length - 1];

      return {
        picture,
        displayWidth: width,
        displayHeight: width,
      };
    });

    rows.push({
      height: Math.max(...items.map((item) => item.displayHeight)),
      items,
    });
  }

  return rows;
}
