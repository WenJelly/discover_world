import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("profile pictures tab owns the work upload entry", async () => {
  const source = await readFile(
    new URL("../src/pages/AccountDetailPage.tsx", import.meta.url),
    "utf8"
  );

  assert.match(source, /UploadDialog/);
  assert.match(source, /showUploadDialog/);
  assert.match(source, /setShowUploadDialog\(true\)/);
  assert.match(source, /handleProfileUploadComplete/);
  assert.match(source, /void loadPictures\(true\)/);
  assert.match(source, /void loadProfile\(\)/);
  assert.match(source, /onUploaded=\{handleProfileUploadComplete\}/);
});

test("navbar account menus no longer expose work upload", async () => {
  const source = await readFile(
    new URL("../src/components/Navbar.tsx", import.meta.url),
    "utf8"
  );

  assert.doesNotMatch(source, /components\/upload\/UploadDialog/);
  assert.doesNotMatch(source, /openUploadDialog/);
  assert.doesNotMatch(source, /urlUploadOpen/);
});
