import assert from "node:assert/strict";
import test from "node:test";

import {
  DISCOVER_CATEGORY_OPTIONS,
  getDiscoverCategoryQuery,
  parseDiscoverSearch,
  resolveDiscoverPreviewIndex,
} from "../src/lib/discover.ts";

function categoryTitle(key: string) {
  return DISCOVER_CATEGORY_OPTIONS.find((item) => item.key === key)?.title;
}

test("discover category query is omitted for all categories", () => {
  assert.equal(getDiscoverCategoryQuery("all"), undefined);
});

test("discover category query maps category keys to backend category labels", () => {
  assert.equal(getDiscoverCategoryQuery("43"), categoryTitle("43"));
  assert.equal(getDiscoverCategoryQuery("5"), categoryTitle("5"));
});

test("discover category query works with parsed URL state", () => {
  const state = parseDiscoverSearch("?category=43");

  assert.equal(getDiscoverCategoryQuery(state.category), categoryTitle("43"));
});

test("discover preview resolves the selected asset after resorting", () => {
  const original = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const resorted = [{ id: "c" }, { id: "a" }, { id: "b" }];

  assert.equal(resolveDiscoverPreviewIndex(original, "b"), 1);
  assert.equal(resolveDiscoverPreviewIndex(resorted, "b"), 2);
  assert.equal(resolveDiscoverPreviewIndex(resorted, "missing"), -1);
  assert.equal(resolveDiscoverPreviewIndex(resorted, null), -1);
});
