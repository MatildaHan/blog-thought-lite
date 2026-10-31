import type { D1Database, Fetcher, PagesFunction, Response as CloudflareResponse, Request as CloudflareRequest } from "@cloudflare/workers-types";
import config from "../../site.config";
import { commentLength, maxCommentLength, type CommentItem, type CommentUser } from "../../src/lib/comments";
import { getCommentUser, githubEnabled, publicUser, type AuthEnv } from "../../src/server/comment-auth";
import { jsonResponse as respond, readJson } from "../../src/server/comment-http";

export interface CommentEnv extends AuthEnv {
	COMMENTS_DB?: D1Database;
	ASSETS: Fetcher;
	TURNSTILE_SITE_KEY?: string;
	TURNSTILE_SECRET_KEY?: string;
	/** Emergency runtime switch; site.config.ts remains the main switch. */
	COMMENTS_ENABLED?: string;
}

const PAGE_SIZE = 20;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const TEST_SECRET = "1x0000000000000000000000000000000AA";

type CommentRow = Omit<CommentItem, "user"> & {
	userId: string | null;
} & Omit<CommentUser, "id" | "isAuthor">;

/** Exposed for integration tests; Pages calls onRequest below. */
export async function handleComments(request: Request, env: CommentEnv): Promise<Response> {
	if (!config.comment?.enabled || env.COMMENTS_ENABLED === "false") return respond({ error: "disabled" }, 404);
	const url = new URL(request.url);
	if (request.method !== "GET" && request.method !== "POST") return respond({ error: "method" }, 405);
	if (request.method === "POST" && request.headers.get("Origin") !== url.origin) return respond({ error: "origin" }, 403);
	if (!env.COMMENTS_DB) return respond({ error: "unavailable" }, 503);

	const path = url.searchParams.get("path");
	if (!path || path.length > 1000) return respond({ error: "invalid" }, 400);
	// The build generates this manifest from public, non-draft entries. Fetching
	// static assets through ASSETS does not invoke this Function again.
	const manifest = await env.ASSETS.fetch(new Request(new URL("/comments-manifest.json", url)) as unknown as CloudflareRequest);
	if (!manifest.ok) return respond({ error: "unavailable" }, 503);
	const paths: unknown = await manifest.json();
	if (!Array.isArray(paths) || !paths.includes(path)) return respond({ error: "not-found" }, 404);

	const db = env.COMMENTS_DB;
	const local = LOCAL_HOSTS.has(url.hostname);
	const user = await getCommentUser(request, env);
	const guestReady = Boolean(env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY && (local || env.TURNSTILE_SECRET_KEY !== TEST_SECRET));
	const ready = guestReady || Boolean(user);

	if (request.method === "GET") {
		const cursor = url.searchParams.get("cursor") || "";
		if (cursor && !/^\d{4}-\d\d-\d\dT[\d:.]+Z\|[\da-f-]{36}$/.test(cursor)) return respond({ error: "invalid" }, 400);
		const [date, id] = cursor.split("|");
		const page = await db
			.prepare(`SELECT c.id, COALESCE(u.name, c.nickname) AS nickname, c.content, c.created_at AS createdAt,
				c.parent_id AS parentId, p.nickname AS parentNickname, u.github_id AS userId,
				u.handle, u.name, u.avatar_url AS avatarUrl, u.description, u.homepage
				FROM comments c LEFT JOIN comments p ON p.id = c.parent_id AND p.path = c.path
				LEFT JOIN comment_users u ON u.github_id = c.user_id
				WHERE c.path = ? AND (? = '' OR c.created_at < ? OR (c.created_at = ? AND c.id < ?))
				ORDER BY c.created_at DESC, c.id DESC LIMIT ?`)
			.bind(path, cursor, date || "", date || "", id || "", PAGE_SIZE + 1)
			.all<CommentRow>();
		const comments = page.results.slice(0, PAGE_SIZE).map(row => {
			const { userId, handle, name, avatarUrl, description, homepage, ...comment } = row;
			return { ...comment, user: userId ? publicUser({ id: userId, handle, name, avatarUrl, description, homepage }, env) : null };
		});
		const last = comments.at(-1);
		return respond({
			comments,
			nextCursor: page.results.length > PAGE_SIZE && last ? `${last.createdAt}|${last.id}` : null,
			siteKey: guestReady && !user ? env.TURNSTILE_SITE_KEY : "",
			ready,
			user,
			githubEnabled: githubEnabled(env)
		});
	}

	if (!ready) return respond({ error: "unavailable" }, 503);
	if (!request.headers.get("Content-Type")?.startsWith("application/json")) return respond({ error: "invalid" }, 415);
	let input: unknown;
	try {
		input = await readJson(request);
	} catch {
		return respond({ error: "invalid" }, 400);
	}
	if (!input || typeof input !== "object") return respond({ error: "invalid" }, 400);
	const { nickname, content, captcha, parentId } = input as Record<string, unknown>;
	if (
		(!user && (typeof nickname !== "string" || !nickname.trim() || commentLength(nickname.trim()) > 40 || /[\p{Cc}\p{Cf}]/u.test(nickname))) ||
		typeof content !== "string" ||
		!content.trim() ||
		commentLength(content.trim()) > maxCommentLength(config.comment.maxLength) ||
		(!user && (typeof captcha !== "string" || !captcha || captcha.length > 2048)) ||
		(parentId != null && (typeof parentId !== "string" || !/^[\da-f-]{36}$/.test(parentId)))
	)
		return respond({ error: "invalid" }, 400);

	const ip = request.headers.get("CF-Connecting-IP");
	if (!ip && !local) return respond({ error: "unavailable" }, 503);
	if (!user) {
		const verification = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: captcha, remoteip: ip || undefined })
		});
		const result: { success?: boolean; hostname?: string; action?: string } = await verification.json();
		if (!result.success || (!local && (result.hostname !== url.hostname || result.action !== "comment"))) {
			return respond({ error: "captcha" }, 403);
		}
	}

	// Store only a daily salted hash, never the raw IP address. Atomic upsert
	// prevents concurrent requests from bypassing the per-minute quota.
	const now = Date.now();
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(
			`${user ? env.GITHUB_CLIENT_SECRET : env.TURNSTILE_SECRET_KEY}:${Math.floor(now / 86400000)}:${user ? `github:${user.id}` : ip || "local"}`
		)
	);
	const key = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
	const limit = await db
		.prepare(`INSERT INTO comment_limits (key, expires_at, count) VALUES (?, ?, 1)
			ON CONFLICT(key) DO UPDATE SET
			count = CASE WHEN expires_at <= ? THEN 1 ELSE count + 1 END,
			expires_at = CASE WHEN expires_at <= ? THEN excluded.expires_at ELSE expires_at END
			RETURNING count`)
		.bind(key, now + 60000, now, now)
		.first<{ count: number }>();
	if (!limit || limit.count > 3) return respond({ error: "rate-limit" }, 429);
	if (parentId) {
		const parent = await db.prepare("SELECT id FROM comments WHERE id = ? AND path = ?").bind(parentId, path).first();
		if (!parent) return respond({ error: "not-found" }, 404);
	}
	const commentId = crypto.randomUUID();
	await db.batch([
		db
			.prepare("INSERT INTO comments (id, path, parent_id, nickname, content, created_at, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)")
			.bind(
				commentId,
				path,
				parentId || null,
				user ? user.name : (nickname as string).trim(),
				content.trim(),
				new Date(now).toISOString(),
				user?.id || null
			),
		db.prepare("DELETE FROM comment_limits WHERE expires_at < ?").bind(now - 86400000)
	]);
	return respond({ id: commentId }, 201);
}

export const onRequest: PagesFunction<CommentEnv> = async ({ request, env }) => {
	try {
		return (await handleComments(request as unknown as Request, env)) as unknown as CloudflareResponse;
	} catch {
		return respond({ error: "unavailable" }, 503) as unknown as CloudflareResponse;
	}
};
