/** Completed days since launch; future launch dates remain at zero. */
export function runningDays(startedAt: string, now = Date.now()): number {
	const start = Date.parse(startedAt);
	if (!Number.isFinite(start) || !Number.isFinite(now)) throw new RangeError("Invalid site statistics timestamp");
	return Math.max(0, Math.floor((now - start) / 86400000));
}
