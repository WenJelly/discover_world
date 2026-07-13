import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

function interfaceBody(sourceText, interfaceName) {
  const match = sourceText.match(
    new RegExp(`export interface ${interfaceName}[^\\{]*\\{([\\s\\S]*?)\\n\\}`)
  );
  assert.ok(match, `interface ${interfaceName} not found`);
  return match[1];
}

test("public media list client contract does not expose auditStatus", async () => {
  const [types, accountDetail] = await Promise.all([
    source("../src/lib/types.ts"),
    source("../src/pages/AccountDetailPage.tsx"),
  ]);

  assert.doesNotMatch(interfaceBody(types, "MediaAssetListReq"), /auditStatus/);
  assert.match(
    interfaceBody(types, "AdminQueryMediaAssetRequest"),
    /auditStatus\?:\s*string/
  );
  assert.doesNotMatch(accountDetail, /auditStatus\s*:/);
});
