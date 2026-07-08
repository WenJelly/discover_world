import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("profile posts expose backend liked user summaries for the like caption", async () => {
  const [api, backendTypes, frontendTypes, reactionModel, postLogic] =
    await Promise.all([
      source("../../api/discover_world.api"),
      source("../../internal/types/types.go"),
      source("../src/lib/types.ts"),
      source("../../model/reactionmodel.go"),
      source("../../internal/logic/post/common.go"),
    ]);

  assert.match(api, /LikedBy\s+\[\]AccountSummary\s+`json:"likedBy"`/);
  assert.match(backendTypes, /LikedBy\s+\[\]AccountSummary\s+`json:"likedBy"`/);
  assert.match(frontendTypes, /likedBy:\s*AccountSummary\[\]/);
  assert.match(reactionModel, /FindActiveUserIDsByTargets/);
  assert.match(postLogic, /likedByByPost/);
  assert.match(postLogic, /LikedBy:\s+likedBy/);
  assert.match(postLogic, /nonNilAccountSummaries/);
});
