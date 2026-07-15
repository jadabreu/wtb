import test from "node:test";
import assert from "node:assert/strict";
import { extractPartialJsonStringValue } from "../lib/ai/streaming";

test("extracts a streaming message field from partial JSON", () => {
  assert.equal(extractPartialJsonStringValue('{"message":"Hello', "message"), "Hello");
});

test("decodes escaped characters in a streaming message field", () => {
  assert.equal(
    extractPartialJsonStringValue('{"message":"Line one\\nLine two with \\"quotes\\""}', "message"),
    'Line one\nLine two with "quotes"'
  );
});

test("returns empty string when the field is not ready", () => {
  assert.equal(extractPartialJsonStringValue('{"edit_set":', "message"), "");
});
