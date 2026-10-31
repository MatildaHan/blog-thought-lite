export interface MemoItem {
	id: string;
	url: string;
	title: string;
	series: string;
	timestamp: Date;
}

/** Only published, localized entries should be passed by the page. */
export function memoYears(entries: readonly Pick<MemoItem, "series">[]): string[] {
	return [...new Set(entries.map(entry => entry.series))].sort((a, b) => b.localeCompare(a));
}

export function filterMemos(entries: readonly MemoItem[], year: string | null): MemoItem[] {
	return entries
		.filter(entry => !year || entry.series === year)
		.sort((a, b) => b.series.localeCompare(a.series) || b.timestamp.getTime() - a.timestamp.getTime() || a.id.localeCompare(b.id));
}
