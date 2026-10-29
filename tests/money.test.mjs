import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

async function load(file) {
  const source = await readFile(new URL(file, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
  );
}
const { money } = await load("../apps/web/src/lib/api.ts");
const { sumMoney } = await load("../apps/web/src/lib/types.ts");

test("largest supported financial amount keeps all cents in display", () => {
  assert.equal(money("99999999999999.99", "DOP"), "RD$99,999,999,999,999.99");
});
test("negative subunit amounts keep sign and cents", () => {
  assert.equal(money("-0.01", "DOP"), "-RD$0.01");
  assert.equal(money("-1000.10", "DOP"), "-RD$1,000.10");
});
test("presentation rejects malformed money instead of fabricating zero", () => {
  assert.equal(money("not money"), "—");
  assert.equal(money("NaN"), "—");
});
test("contribution totals use exact integer cents", () => {
  assert.equal(sumMoney(Array(1000).fill("0.01")), "10.00");
  assert.equal(sumMoney(["99999999999999.99", "-99999999999999.98"]), "0.01");
});
