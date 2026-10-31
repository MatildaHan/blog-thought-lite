import type { CollectionEntry } from "astro:content";
import { getRelativeLocaleUrl } from "astro:i18n";
import Time from "$lib/time";
import i18nit from "$i18n";

/** Link to a full entry on the list; moments have no separate detail routes. */
export function momentUrl(locale: string, id: string): string {
	return `${getRelativeLocaleUrl(locale, "/moment")}#${encodeURIComponent(`moment-${id}`)}`;
}

/** Optional titles are only used by the home page, heatmap and subscription feed. */
export function momentTitle(entry: CollectionEntry<"moment">, locale: string): string {
	return entry.data.title || `${i18nit(locale)("navigation.moment")} · ${Time.toDateString(entry.data.timestamp)}`;
}
