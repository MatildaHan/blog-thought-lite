import assert from "node:assert/strict";
import test from "node:test";
import { filterMemos, memoYears, type MemoItem } from "../src/lib/memo";

const entries: MemoItem[] = [
	{ id: "2026-09", url: "/memo/2026-09", title: "九月", series: "2026", timestamp: new Date("2026-09-30T00:00:00+08:00") },
	{ id: "2027-01", url: "/memo/2027-01", title: "一月", series: "2027", timestamp: new Date("2027-01-31T00:00:00+08:00") },
	{ id: "202610", url: "/memo/202610", title: "十月", series: "2026", timestamp: new Date("2026-10-31T00:00:00+08:00") }
];

test("new year series automatically becomes a unique, descending year filter", () => {
	assert.deepEqual(memoYears(entries), ["2027", "2026"]);
	assert.deepEqual(memoYears([]), []);
});

test("year filtering combines with descending monthly order without changing the source", () => {
	assert.deepEqual(
		filterMemos(entries, "2026").map(entry => entry.id),
		["202610", "2026-09"]
	);
	assert.deepEqual(
		filterMemos(entries, null).map(entry => entry.id),
		["2027-01", "202610", "2026-09"]
	);
	assert.equal(entries[0].id, "2026-09");
	assert.deepEqual(filterMemos(entries, "2028"), []);
});
