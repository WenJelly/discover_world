import assert from "node:assert/strict";
import test from "node:test";

import {
  DISCOVER_TABS,
  filterAndSortDiscoverPictures,
  parseDiscoverSearch,
  type DiscoverSearchState,
} from "../src/lib/discover.ts";
import type { PictureResponse } from "../src/lib/types.ts";

const BASE_DISCOVER_STATE: DiscoverSearchState = {
  tab: "rating",
  sort: "1",
  category: "all",
  photographerType: "0",
  layout: "justified",
};

function picture(
  id: string,
  likeCount: number,
  viewCount: number,
  createTime = "2026-07-01T00:00:00Z"
): PictureResponse {
  return {
    id,
    likeCount,
    viewCount,
    createTime,
    category: "",
    picWidth: 1200,
    picHeight: 800,
  } as PictureResponse;
}

test("discover rising ranking preserves backend order", () => {
  const backendRisingFirst = picture(
    "backend-rising-first",
    100,
    10_000,
    "2026-07-01T00:00:00Z"
  );
  const backendRisingSecond = picture(
    "backend-rising-second",
    1,
    0,
    "2026-07-02T00:00:00Z"
  );
  const pictures = [backendRisingFirst, backendRisingSecond];

  const rankingStates: DiscoverSearchState[] = [
    { ...BASE_DISCOVER_STATE, tab: "upcoming" },
  ];

  for (const state of rankingStates) {
    assert.deepEqual(
      filterAndSortDiscoverPictures(pictures, state).map((item) => item.id),
      ["backend-rising-first", "backend-rising-second"]
    );
  }
});

test("discover hot ranking preserves backend order until the list is reloaded", () => {
  const backendHotFirst = picture(
    "backend-hot-first",
    100,
    10_000,
    "2026-07-01T00:00:00Z"
  );
  const backendHotSecond = picture(
    "backend-hot-second",
    1,
    0,
    "2026-07-02T00:00:00Z"
  );

  assert.deepEqual(
    filterAndSortDiscoverPictures(
      [backendHotFirst, backendHotSecond],
      { ...BASE_DISCOVER_STATE, tab: "rating", sort: "1" }
    ).map((item) => item.id),
    ["backend-hot-first", "backend-hot-second"]
  );
});

test("discover navigation no longer exposes editor recommendations", () => {
  assert.equal(
    DISCOVER_TABS.some((tab) => tab.key === "editors" || tab.title === "编辑推荐"),
    false
  );
  assert.equal(parseDiscoverSearch("?t=editors").tab, "rating");
});
