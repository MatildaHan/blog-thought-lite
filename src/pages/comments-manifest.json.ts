import { getCollection } from "astro:content";
import { getRelativeLocaleUrl } from "astro:i18n";
import config, { monolocale } from "$config";

/** Public URLs only: the API uses this to reject drafts and nonexistent pages. */
export async function GET() {
	const paths: string[] = [];
	if (config.comment?.enabled) {
		for (const section of ["note", "jotting"] as const) {
			const entries = await getCollection(section, entry => !entry.data.draft);
			for (const entry of entries) {
				const [language, ...segments] = entry.id.split("/");
				const locale = monolocale ? config.i18n.defaultLocale : language;
				const id = monolocale ? entry.id : segments.join("/");
				paths.push(new URL(getRelativeLocaleUrl(locale, `/${section}/${id}`), "https://manifest.local").pathname);
			}
		}
	}
	return Response.json(paths);
}
