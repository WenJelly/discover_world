import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("register dialog submits username as account handle", () => {
  const source = readFileSync(new URL("../src/components/auth/AuthDialog.tsx", import.meta.url), "utf8");

  assert.match(
    source,
    /await register\(\{\s*username:\s*registerForm\.username\.trim\(\),\s*userEmail:/s
  );
});

test("account settings keeps username and nickname as separate fields", () => {
  const source = readFileSync(new URL("../src/components/Navbar.tsx", import.meta.url), "utf8");

  assert.match(source, /username:\s*user\?\.username\s*\|\|\s*""/);
  assert.match(source, /nickname:\s*user\?\.nickname\s*\|\|\s*user\?\.userName\s*\|\|\s*""/);
  assert.doesNotMatch(source, /username:\s*user\?\.userName\s*\|\|\s*""/);
});
