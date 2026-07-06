import assert from "node:assert/strict";
import test from "node:test";

import {
  filterAndSortDiscoverPictures,
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

test("discover ranking ignores engagement counts", () => {
  const oldHighEngagement = picture(
    "old-high-engagement",
    100,
    10_000,
    "2026-07-01T00:00:00Z"
  );
  const newLowEngagement = picture(
    "new-low-engagement",
    1,
    0,
    "2026-07-02T00:00:00Z"
  );
  const pictures = [oldHighEngagement, newLowEngagement];

  const rankingStates: DiscoverSearchState[] = [
    { ...BASE_DISCOVER_STATE, tab: "rating" },
    { ...BASE_DISCOVER_STATE, tab: "upcoming" },
    { ...BASE_DISCOVER_STATE, tab: "editors" },
  ];

  for (const state of rankingStates) {
    assert.deepEqual(
      filterAndSortDiscoverPictures(pictures, state).map((item) => item.id),
      ["new-low-engagement", "old-high-engagement"]
    );
  }
});
