// Adapted from ThoughtLite's cloudflare branch (GPL-3.0).
import { unified } from "unified";
import parse from "remark-parse";
import gfm from "remark-gfm";
import emoji from "remark-gemoji";
import rehype from "remark-rehype";
import links from "rehype-external-links";
import stringify from "rehype-stringify";
import sanitize from "rehype-sanitize";

// Discard raw HTML and sanitize dangerous URLs. Render images as text to avoid
// fetching third-party tracking pixels from anonymous comments.
const markdown = unified()
	.use(parse)
	.use(gfm)
	.use(emoji)
	.use(rehype, {
		handlers: {
			image: (_state, node) => ({ type: "text", value: node.alt || "" })
		}
	})
	.use(sanitize)
	.use(links, { target: "_blank", rel: ["nofollow", "noopener", "noreferrer", "ugc"] })
	.use(stringify);

export async function renderComment(content: string): Promise<string> {
	return String(await markdown.process(content));
}
