import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import config, { monolocale } from "$config";
import graph from "$graph/content";
import i18nit from "$i18n";

export async function getStaticPaths() {
	const memos = await getCollection("memo", memo => !memo.data.draft);

	return memos.map(memo => {
		let locale: string | undefined;
		let id: string;

		if (monolocale) {
			locale = undefined;
			id = memo.id;
		} else {
			const [language, ...ids] = memo.id.split("/");
			locale = config.i18n.defaultLocale === language ? undefined : language;
			id = ids.join("/");
		}

		return {
			params: { locale, id },
			props: {
				type: i18nit(locale || config.i18n.defaultLocale)(`navigation.memo`),
				title: memo.data.title,
				time: memo.data.timestamp.toISOString().split("T")[0].replace(/-/g, "/"),
				series: memo.data.series,
				tags: memo.data.tags
			}
		};
	});
}

/**
 * GET handler that generates and returns the Open Graph image for a memo.
 */
export const GET: APIRoute = async ({ params, props }) => {
	const image = await graph({
		locale: params.locale || config.i18n.defaultLocale,
		type: props.type,
		site: config.title,
		author: config.author.name,
		title: props.title,
		time: props.time,
		series: props.series,
		tags: props.tags
	});

	return new Response(new Uint8Array(image), { headers: { "Content-Type": "image/png" } });
};
