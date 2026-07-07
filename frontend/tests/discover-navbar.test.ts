import assert from "node:assert/strict";
import test from "node:test";

import { shouldPinDiscoverToolbar } from "../src/lib/discover-navbar.ts";

test("discover toolbar pins only after the main navbar is almost out of view", () => {
  assert.equal(shouldPinDiscoverToolbar(0), false);
  assert.equal(shouldPinDiscoverToolbar(8), false);
  assert.equal(shouldPinDiscoverToolbar(48), false);
  assert.equal(shouldPinDiscoverToolbar(56), true);
});
