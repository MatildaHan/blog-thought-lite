import type { PagesFunction, Response as CloudflareResponse } from "@cloudflare/workers-types";
import { handleAuth, type AuthEnv } from "../../../src/server/comment-auth";
import { jsonResponse } from "../../../src/server/comment-http";

export const onRequest: PagesFunction<AuthEnv> = async ({ request, env }) => {
	try {
		return (await handleAuth(request as unknown as Request, env)) as unknown as CloudflareResponse;
	} catch {
		return jsonResponse({ error: "unavailable" }, 503) as unknown as CloudflareResponse;
	}
};
