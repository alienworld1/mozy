import assert from "node:assert/strict";
import test from "node:test";
import { resolveMechanismStage } from "./scroll-stages";

test("maps bounded scroll progress to mechanism stages", () => {
  assert.equal(resolveMechanismStage(-1), 0);
  assert.equal(resolveMechanismStage(0.27), 0);
  assert.equal(resolveMechanismStage(0.28), 1);
  assert.equal(resolveMechanismStage(0.58), 2);
  assert.equal(resolveMechanismStage(0.81), 2);
  assert.equal(resolveMechanismStage(0.82), 3);
  assert.equal(resolveMechanismStage(2), 3);
});
