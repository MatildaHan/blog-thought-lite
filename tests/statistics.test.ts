import assert from "node:assert/strict";
import test from "node:test";
import { runningDays } from "../src/lib/statistics";

const launch = "2026-10-30T00:00:00+08:00";

test("runtime changes only after a complete day in the configured launch offset", () => {
	assert.equal(runningDays(launch, Date.parse("2026-10-30T23:59:59+08:00")), 0);
	assert.equal(runningDays(launch, Date.parse("2026-10-31T00:00:00+08:00")), 1);
	assert.equal(runningDays(launch, Date.parse("2026-10-31T16:00:00Z")), 2);
});

test("future launch dates cannot produce negative days", () => {
	assert.equal(runningDays(launch, Date.parse("2026-10-29T12:00:00+08:00")), 0);
});

test("invalid timestamps fail explicitly", () => {
	assert.throws(() => runningDays("invalid"), RangeError);
	assert.throws(() => runningDays(launch, Number.NaN), RangeError);
});
