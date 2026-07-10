import assert from "node:assert/strict";
import test from "node:test";

import {
  POST_TYPE_FILTER_OPTIONS,
  POST_TYPE_OPTIONS,
  normalizePostType,
  postTypeLabel,
} from "../src/lib/post-type.ts";

test("post type helpers normalize known dynamic types", () => {
  assert.equal(normalizePostType("travel_share"), "travel_share");
  assert.equal(normalizePostType(" DAILY "), "daily");
  assert.equal(normalizePostType("guide"), "daily");
  assert.equal(normalizePostType(undefined), "daily");
});

test("post type labels and options expose daily and travel share", () => {
  assert.equal(postTypeLabel("daily"), "日常动态");
  assert.equal(postTypeLabel("travel_share"), "旅游分享");
  assert.deepEqual(
    POST_TYPE_OPTIONS.map((option) => option.value),
    ["daily", "travel_share"]
  );
  assert.deepEqual(
    POST_TYPE_FILTER_OPTIONS.map((option) => option.value),
    ["all", "daily", "travel_share"]
  );
});
