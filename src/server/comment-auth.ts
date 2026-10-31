import type { D1Database } from "@cloudflare/workers-types";
import config from "../../site.config";
import type { CommentUser } from "../lib/comments";
import { jsonResponse, readJson } from "./comment-http";

export interface AuthEnv {
	COMMENTS_DB?: D1Database;
	COMMENTS_ENABLED?: string;
	GITHUB_LOGIN_ENABLED?: string;
	GITHUB_CLIENT_ID?: string;
	GITHUB_CLIENT_SECRET?: string;
	GITHUB_AUTHOR_ID?: string;
}

type UserRow = Omit<CommentUser, "isAuthor">;
const SESSION_SECONDS = 14 * 86400;
const STATE_SECONDS = 600;
const CALLBACK = "/api/auth/github/callback";

export function githubEnabled(env: AuthEnv): boolean {
	return Boolean(
		config.comment?.enabled &&
			config.comment.github?.enabled &&
			env.COMMENTS_ENABLED !== "false" &&
			env.GITHUB_LOGIN_ENABLED !== "false" &&
			env.GITHUB_CLIENT_ID &&
			env.GITHUB_CLIENT_SECRET &&
			env.COMMENTS_DB
	);
}

export async function hashToken(value: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
	return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

function randomToken(): string {
	return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

function cookieName(request: Request, kind: "session" | "oauth"): string {
	return `${new URL(request.url).protocol === "https:" ? "__Host-" : ""}comment-${kind}`;
}

function readCookie(request: Request, kind: "session" | "oauth"): string {
	const name = `${cookieName(request, kind)}=`;
	const value =
		request.headers
			.get("Cookie")
			?.split(";")
			.map(part => part.trim())
			.find(part => part.startsWith(name))
			?.slice(name.length) || "";
	return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : "";
}

function cookie(request: Request, kind: "session" | "oauth", value: string, seconds: number): string {
	return `${cookieName(request, kind)}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}

export function publicUser(row: UserRow, env: AuthEnv): CommentUser {
	return { ...row, isAuthor: Boolean(env.GITHUB_AUTHOR_ID && row.id === env.GITHUB_AUTHOR_ID) };
}

export async function getCommentUser(request: Request, env: AuthEnv): Promise<CommentUser | null> {
	if (!githubEnabled(env)) return null;
	const token = readCookie(request, "session");
	if (!token) return null;
	const row = await env
		.COMMENTS_DB!.prepare(`SELECT u.github_id AS id, u.handle, u.name, u.avatar_url AS avatarUrl, u.description, u.homepage
			FROM comment_sessions s JOIN comment_users u ON u.github_id = s.user_id
			WHERE s.token_hash = ? AND s.expires_at > ?`)
		.bind(await hashToken(token), Date.now())
		.first<UserRow>();
	return row ? publicUser(row, env) : null;
}

/** Only HTTP(S) links are rendered in profiles. */
export function normalizeHomepage(value: string): string | null {
	const input = value.trim();
	if (!input) return "";
	if (input.length > 1000 || /[\p{Cc}\p{Cf}]/u.test(input)) return null;
	try {
		const url = new URL(input.includes(":") ? input : `https://${input}`);
		if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
		return url.href;
	} catch {
		return null;
	}
}

/** Persist a relative article path, never a caller-supplied redirect origin. */
function returnPath(request: Request, value: string | null): string {
	if (!value || value.length > 1000 || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
	const origin = new URL(request.url).origin;
	try {
		const url = new URL(value, origin);
		return url.origin === origin && /^\/(note|jotting|memo)\//.test(url.pathname) ? url.pathname : "/";
	} catch {
		return "/";
	}
}

function redirect(request: Request, path: string, error?: string): Response {
	const target = new URL(path, request.url);
	if (error) target.searchParams.set("commentAuth", error);
	target.hash = "comments";
	return new Response(null, {
		status: 303,
		headers: {
			Location: target.href,
			"Cache-Control": "no-store",
			"Referrer-Policy": "no-referrer",
			"Set-Cookie": cookie(request, "oauth", "", 0)
		}
	});
}

async function login(request: Request, env: AuthEnv): Promise<Response> {
	const now = Date.now();
	const state = randomToken();
	const verifier = randomToken();
	const path = returnPath(request, new URL(request.url).searchParams.get("returnTo"));
	// Bound state creation independently of comments, without retaining raw IPs.
	const ip = request.headers.get("CF-Connecting-IP") || "local";
	const key = `oauth:${await hashToken(`${env.GITHUB_CLIENT_SECRET}:${Math.floor(now / 86400000)}:${ip}`)}`;
	const count = await env
		.COMMENTS_DB!.prepare(`INSERT INTO comment_limits (key, expires_at, count) VALUES (?, ?, 1)
		ON CONFLICT(key) DO UPDATE SET count = CASE WHEN expires_at <= ? THEN 1 ELSE count + 1 END,
		expires_at = CASE WHEN expires_at <= ? THEN excluded.expires_at ELSE expires_at END RETURNING count`)
		.bind(key, now + 600000, now, now)
		.first<{ count: number }>();
	if (!count || count.count > 10) return jsonResponse({ error: "rate-limit" }, 429);
	await env.COMMENTS_DB!.batch([
		env
			.COMMENTS_DB!.prepare("INSERT INTO github_oauth_states VALUES (?, ?, ?, ?)")
			.bind(await hashToken(state), verifier, path, now + STATE_SECONDS * 1000),
		env.COMMENTS_DB!.prepare("DELETE FROM github_oauth_states WHERE expires_at <= ?").bind(now)
	]);
	const challenge = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
	const url = new URL("https://github.com/login/oauth/authorize");
	url.search = new URLSearchParams({
		client_id: env.GITHUB_CLIENT_ID!,
		redirect_uri: new URL(CALLBACK, request.url).href,
		state,
		code_challenge: btoa(String.fromCharCode(...new Uint8Array(challenge)))
			.replace(/\+/g, "-")
			.replace(/\//g, "_")
			.replace(/=+$/, ""),
		code_challenge_method: "S256",
		scope: ""
	}).toString();
	return new Response(null, {
		status: 302,
		headers: {
			Location: url.href,
			"Cache-Control": "no-store",
			"Referrer-Policy": "no-referrer",
			"Set-Cookie": cookie(request, "oauth", state, STATE_SECONDS)
		}
	});
}

async function callback(request: Request, env: AuthEnv): Promise<Response> {
	const url = new URL(request.url);
	const state = url.searchParams.get("state") || "";
	const bound = readCookie(request, "oauth");
	if (!bound || state !== bound) return redirect(request, "/", "failed");
	const transaction = await env
		.COMMENTS_DB!.prepare(`DELETE FROM github_oauth_states
		WHERE state_hash = ? AND expires_at > ? RETURNING verifier, return_path AS returnPath`)
		.bind(await hashToken(state), Date.now())
		.first<{ verifier: string; returnPath: string }>();
	if (!transaction) return redirect(request, "/", "failed");
	if (url.searchParams.has("error")) return redirect(request, transaction.returnPath, "cancelled");
	const code = url.searchParams.get("code");
	if (!code || code.length > 512) return redirect(request, transaction.returnPath, "failed");
	try {
		const response = await fetch("https://github.com/login/oauth/access_token", {
			method: "POST",
			headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				client_id: env.GITHUB_CLIENT_ID!,
				client_secret: env.GITHUB_CLIENT_SECRET!,
				code,
				code_verifier: transaction.verifier,
				redirect_uri: new URL(CALLBACK, request.url).href
			}),
			signal: AbortSignal.timeout(15000)
		});
		const tokens: { access_token?: string; token_type?: string } = await response.json();
		if (!response.ok || !tokens.access_token || tokens.token_type?.toLowerCase() !== "bearer") throw new Error("oauth");
		const profileResponse = await fetch("https://api.github.com/user", {
			headers: {
				Authorization: `Bearer ${tokens.access_token}`,
				Accept: "application/vnd.github+json",
				"User-Agent": "ThoughtLiteComments",
				"X-GitHub-Api-Version": "2026-03-10"
			},
			signal: AbortSignal.timeout(15000)
		});
		const profile: { id?: number; login?: string; name?: string; avatar_url?: string; bio?: string; blog?: string } =
			await profileResponse.json();
		if (
			!profileResponse.ok ||
			!Number.isSafeInteger(profile.id) ||
			profile.id! <= 0 ||
			!profile.login ||
			!/^[A-Za-z0-9-]{1,39}$/.test(profile.login)
		)
			throw new Error("profile");
		const clean = (value: string | undefined, max: number) =>
			Array.from((value || "").replace(/[\p{Cc}\p{Cf}]/gu, "").trim())
				.slice(0, max)
				.join("");
		const name = clean(profile.name, 40) || profile.login;
		const image = new URL(profile.avatar_url || "https://avatars.githubusercontent.com/");
		const avatar = image.protocol === "https:" && image.hostname === "avatars.githubusercontent.com" ? image.href : "";
		const now = Date.now();
		const session = randomToken();
		await env.COMMENTS_DB!.batch([
			env
				.COMMENTS_DB!.prepare(`INSERT INTO comment_users (github_id, handle, name, avatar_url, description, homepage, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(github_id) DO UPDATE SET handle=excluded.handle,
				name=excluded.name, avatar_url=excluded.avatar_url, description=excluded.description, updated_at=excluded.updated_at`)
				.bind(
					String(profile.id),
					profile.login,
					name,
					avatar,
					clean(profile.bio, 160),
					normalizeHomepage(profile.blog || "") || "",
					new Date(now).toISOString()
				),
			env
				.COMMENTS_DB!.prepare("INSERT INTO comment_sessions VALUES (?, ?, ?)")
				.bind(await hashToken(session), String(profile.id), now + SESSION_SECONDS * 1000),
			env
				.COMMENTS_DB!.prepare("DELETE FROM comment_sessions WHERE expires_at <= ? OR token_hash = ?")
				.bind(now, await hashToken(readCookie(request, "session")))
		]);
		const result = redirect(request, transaction.returnPath);
		result.headers.append("Set-Cookie", cookie(request, "session", session, SESSION_SECONDS));
		return result;
	} catch {
		return redirect(request, transaction.returnPath, "failed");
	}
}

export async function handleAuth(request: Request, env: AuthEnv): Promise<Response> {
	const url = new URL(request.url);
	if (url.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
		return jsonResponse({ error: "https-required" }, 400);
	const action = url.pathname.replace(/\/$/, "").slice("/api/auth/".length);
	const method = request.method;
	if (method === "POST" && request.headers.get("Origin") !== url.origin) return jsonResponse({ error: "origin" }, 403);
	if (action === "logout" && method === "POST") {
		const token = readCookie(request, "session");
		if (token && env.COMMENTS_DB)
			await env.COMMENTS_DB.prepare("DELETE FROM comment_sessions WHERE token_hash = ?")
				.bind(await hashToken(token))
				.run();
		const response = jsonResponse({ ok: true });
		response.headers.append("Set-Cookie", cookie(request, "session", "", 0));
		response.headers.append("Set-Cookie", cookie(request, "oauth", "", 0));
		return response;
	}
	if (!githubEnabled(env))
		return action === "session" && method === "GET" ? jsonResponse({ enabled: false, user: null }) : jsonResponse({ error: "unavailable" }, 503);
	if (action === "github/login" && method === "GET") return login(request, env);
	if (action === "github/callback" && method === "GET") return callback(request, env);
	if (action === "session" && method === "GET") return jsonResponse({ enabled: true, user: await getCommentUser(request, env) });
	if (action === "profile" && method === "POST") {
		const user = await getCommentUser(request, env);
		if (!user) return jsonResponse({ error: "unauthorized" }, 401);
		if (!request.headers.get("Content-Type")?.startsWith("application/json")) return jsonResponse({ error: "invalid" }, 415);
		let input: unknown;
		try {
			input = await readJson(request, 4096);
		} catch {
			return jsonResponse({ error: "invalid" }, 400);
		}
		if (!input || typeof input !== "object" || !("homepage" in input) || typeof input.homepage !== "string")
			return jsonResponse({ error: "invalid" }, 400);
		const homepage = normalizeHomepage(input.homepage);
		if (homepage === null) return jsonResponse({ error: "invalid" }, 400);
		await env
			.COMMENTS_DB!.prepare("UPDATE comment_users SET homepage = ?, updated_at = ? WHERE github_id = ?")
			.bind(homepage, new Date().toISOString(), user.id)
			.run();
		return jsonResponse({ user: { ...user, homepage } });
	}
	return jsonResponse({ error: "not-found" }, 404);
}
