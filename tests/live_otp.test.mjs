import { test } from "node:test";
import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import { readOtp } from "../scripts/live_otp.mjs";

test("OTP input accepts split chunks without echo and restores terminal mode", async () => {
  const input = new PassThrough();
  const modes = [];
  input.isTTY = true;
  input.isRaw = false;
  input.setRawMode = (value) => modes.push(value);
  const pending = readOtp(input);
  input.write("1111");
  input.write("2222\r");
  assert.equal(await pending, "11112222");
  assert.deepEqual(modes, [true, false]);
  assert.equal(input.listenerCount("data"), 0);
  assert.equal(input.isPaused(), true);
});

test("invalid OTP input returns a generic error without including input", async () => {
  const input = new PassThrough();
  const pending = readOtp(input);
  input.end("not-a-code\n");
  await assert.rejects(pending, { message: "invalid_otp_input" });
});

test("OTP input expires and cleans up pending listeners", async () => {
  const input = new PassThrough();
  await assert.rejects(readOtp(input, 5), { message: "otp_timeout" });
  assert.equal(input.listenerCount("data"), 0);
  assert.equal(input.listenerCount("end"), 0);
  assert.equal(input.listenerCount("error"), 0);
});

test("oversized OTP input is bounded", async () => {
  const input = new PassThrough();
  const pending = readOtp(input);
  input.write("1".repeat(33));
  await assert.rejects(pending, { message: "invalid_otp_input" });
});

test("piped input can finish without a trailing newline", async () => {
  const input = new PassThrough();
  const pending = readOtp(input);
  input.end("11112222");
  assert.equal(await pending, "11112222");
});
