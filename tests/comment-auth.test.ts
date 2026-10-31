import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { fixture } from "./comment-fixture";
import { getCommentUser, handleAuth, hashToken, normalizeHomepage } from "../src/server/comment-auth";
import { handleComments, type CommentEnv } from "../functions/api/comments";
import config from "../site.config";

function authRequest(path: string, options: { method?: string; cookie?: string; body?: unknown; origin?: string } = {}) {
	return new Request(`https://blog.example/api/auth/${path}`, {
		method: options.method || "GET",
		headers: {
			Origin: options.origin || "https://blog.example",
			Cookie: options.cookie || "",
			"CF-Connecting-IP": "192.0.2.1",
			"Content-Type": "application/json"
		},
		body: options.body !== undefined ? JSON.stringify(options.body) : undefined
	});
}

function setup(t: TestContext) {
	const data = fixture();
	t.after(() => data.sqlite.close());
	Object.assign(data.env, { GITHUB_CLIENT_ID: "test-client", GITHUB_CLIENT_SECRET: "test-client-secret", GITHUB_AUTHOR_ID: "42" });
	return data;
}

async function begin(env: CommentEnv, returnTo = "/note/public") {
	const response = await handleAuth(authRequest(`github/login?${new URLSearchParams({ returnTo })}`), env);
	assert.equal(response.status, 302);
	const location = new URL(response.headers.get("Location")!);
	const state = location.searchParams.get("state")!;
	const cookie = response.headers.getSetCookie()[0].split(";")[0];
	return { response, location, state, cookie };
}

function mockGithub(t: TestContext, overrides: Record<string, unknown> = {}) {
	return t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
		if (String(input) === "https://github.com/login/oauth/access_token") {
			const body = new URLSearchParams(init?.body as URLSearchParams);
			assert.equal(body.get("client_secret"), "test-client-secret");
			assert.match(body.get("code_verifier")!, /^[A-Za-z0-9_-]{43}$/);
			assert.equal(body.get("redirect_uri"), "https://blog.example/api/auth/github/callback");
			return Response.json({ access_token: "github-secret-access-token", token_type: "bearer" });
		}
		assert.equal(String(input), "https://api.github.com/user");
		assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer github-secret-access-token");
		return Response.json({
			id: 42,
			login: "example-reader",
			name: "测试昵称",
			bio: "公开简介",
			blog: "example.com",
			avatar_url: "https://avatars.githubusercontent.com/u/42",
			...overrides
		});
	});
}

async function complete(env: CommentEnv, transaction: Awaited<ReturnType<typeof begin>>) {
	const response = await handleAuth(
		authRequest(`github/callback?${new URLSearchParams({ state: transaction.state, code: "temporary-code" })}`, { cookie: transaction.cookie }),
		env
	);
	const cookie = response.headers
		.getSetCookie()
		.find(value => value.startsWith("__Host-comment-session="))
		?.split(";")[0];
	assert.ok(cookie, "successful login returns a session cookie");
	return { response, cookie };
}

test("login binds a short-lived state to the browser, uses PKCE and requests no additional scopes", async t => {
	const { env, sqlite } = setup(t);
	const result = await begin(env, "//evil.example/steal");
	assert.equal(result.location.origin, "https://github.com");
	assert.equal(result.location.searchParams.get("scope"), "");
	assert.equal(result.location.searchParams.get("code_challenge_method"), "S256");
	assert.match(result.location.searchParams.get("code_challenge")!, /^[A-Za-z0-9_-]{43}$/);
	assert.ok(!result.location.href.includes("test-client-secret"));
	assert.match(result.response.headers.get("Set-Cookie")!, /HttpOnly; SameSite=Lax; Max-Age=600; Secure/);
	const state = sqlite.prepare("SELECT * FROM github_oauth_states").get()!;
	assert.equal(state.return_path, "/");
	assert.notEqual(state.state_hash, result.state);
	assert.equal(state.state_hash, await hashToken(result.state));
	const verifierHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(state.verifier as string));
	const expectedChallenge = btoa(String.fromCharCode(...new Uint8Array(verifierHash)))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
	assert.equal(result.location.searchParams.get("code_challenge"), expectedChallenge);
});

test("callback verifies identity, saves only public profile and hashed session, and consumes state once", async t => {
	mockGithub(t);
	const { env, sqlite } = setup(t);
	const transaction = await begin(env);
	const { response, cookie } = await complete(env, transaction);
	assert.equal(response.headers.get("Location"), "https://blog.example/note/public#comments");
	const user = await getCommentUser(authRequest("session", { cookie }), env);
	assert.equal(user?.id, "42");
	assert.equal(user?.isAuthor, true);
	assert.equal(user?.description, "公开简介");
	assert.equal(user?.homepage, "https://example.com/");
	const session = sqlite.prepare("SELECT * FROM comment_sessions").get()!;
	assert.notEqual(session.token_hash, cookie.split("=")[1]);
	assert.equal(session.token_hash, await hashToken(cookie.split("=")[1]));
	assert.ok(!JSON.stringify(sqlite.prepare("SELECT * FROM comment_users").all()).includes("github-secret-access-token"));
	assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM github_oauth_states").get()?.n, 0);
	const replay = await handleAuth(
		authRequest(`github/callback?state=${transaction.state}&code=temporary-code`, { cookie: transaction.cookie }),
		env
	);
	assert.ok(replay.headers.get("Location")!.includes("commentAuth=failed"));
	assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM comment_sessions").get()?.n, 1);
});

test("mismatched, missing, expired or cancelled authorization never creates a session", async t => {
	const { env, sqlite } = setup(t);
	const fetch = t.mock.method(globalThis, "fetch", async () => {
		throw new Error("must not exchange a code");
	});
	const transaction = await begin(env);
	const wrong = await handleAuth(authRequest("github/callback?state=wrong&code=x", { cookie: transaction.cookie }), env);
	assert.ok(wrong.headers.get("Location")!.includes("commentAuth=failed"));
	const missing = await handleAuth(authRequest(`github/callback?state=${transaction.state}&code=x`), env);
	assert.ok(missing.headers.get("Location")!.includes("commentAuth=failed"));
	sqlite.prepare("UPDATE github_oauth_states SET expires_at = 0").run();
	const expired = await handleAuth(authRequest(`github/callback?state=${transaction.state}&code=x`, { cookie: transaction.cookie }), env);
	assert.ok(expired.headers.get("Location")!.includes("commentAuth=failed"));
	const cancellation = await begin(env);
	const cancelled = await handleAuth(
		authRequest(`github/callback?state=${cancellation.state}&error=access_denied`, { cookie: cancellation.cookie }),
		env
	);
	assert.equal(cancelled.headers.get("Location"), "https://blog.example/note/public?commentAuth=cancelled#comments");
	assert.equal(fetch.mock.calls.length, 0);
	assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM comment_sessions").get()?.n, 0);
});

test("session expiry and logout revoke access, while cross-origin writes are rejected", async t => {
	mockGithub(t);
	const { env, sqlite } = setup(t);
	const { cookie } = await complete(env, await begin(env));
	assert.equal((await handleAuth(authRequest("logout", { method: "POST", cookie, origin: "https://evil.example" }), env)).status, 403);
	assert.ok(await getCommentUser(authRequest("session", { cookie }), env));
	const loggedOut = await handleAuth(authRequest("logout", { method: "POST", cookie }), env);
	assert.equal(loggedOut.status, 200);
	assert.ok(loggedOut.headers.getSetCookie().every(value => value.includes("Max-Age=0")));
	assert.equal(await getCommentUser(authRequest("session", { cookie }), env), null);
	const second = await complete(env, await begin(env));
	sqlite.prepare("UPDATE comment_sessions SET expires_at = 0").run();
	assert.equal(await getCommentUser(authRequest("session", { cookie: second.cookie }), env), null);
	assert.equal(
		(await handleAuth(authRequest("profile", { method: "POST", cookie: second.cookie, body: { homepage: "https://example.com" } }), env)).status,
		401
	);
});

test("profile editing accepts a safe homepage and cannot change identity or grant author status", async t => {
	mockGithub(t, { id: 99 });
	const { env } = setup(t);
	const { cookie } = await complete(env, await begin(env));
	for (const homepage of ["javascript:alert(1)", "data:text/html,x", "https://name:password@example.com", "https://example.com\n/path"]) {
		assert.equal((await handleAuth(authRequest("profile", { method: "POST", cookie, body: { homepage } }), env)).status, 400);
	}
	const saved = await handleAuth(
		authRequest("profile", { method: "POST", cookie, body: { homepage: "https://my.example", id: "42", isAuthor: true, name: "伪造博主" } }),
		env
	);
	assert.equal(saved.status, 200);
	const user = await getCommentUser(authRequest("session", { cookie }), env);
	assert.equal(user?.homepage, "https://my.example/");
	assert.equal(user?.id, "99");
	assert.equal(user?.name, "测试昵称");
	assert.equal(user?.isAuthor, false);
	await complete(env, await begin(env));
	assert.equal((await getCommentUser(authRequest("session", { cookie }), env))?.homepage, "https://my.example/");
});

test("authenticated comments use the verified identity, and matching anonymous nicknames stay anonymous", async t => {
	mockGithub(t);
	const { env, sqlite } = setup(t);
	const anonymous = crypto.randomUUID();
	sqlite
		.prepare("INSERT INTO comments (id,path,nickname,content,created_at) VALUES (?, ?, ?, ?, ?)")
		.run(anonymous, "/note/public", "测试昵称", "旧匿名留言", new Date().toISOString());
	const { cookie } = await complete(env, await begin(env));
	const request = new Request("https://blog.example/api/comments?path=%2Fnote%2Fpublic", {
		method: "POST",
		headers: { Origin: "https://blog.example", Cookie: cookie, "Content-Type": "application/json", "CF-Connecting-IP": "192.0.2.1" },
		body: JSON.stringify({ content: "已登录留言", nickname: "伪造昵称", userId: "99" })
	});
	assert.equal((await handleComments(request, env)).status, 201);
	const page = await (await handleComments(new Request(request.url, { headers: { Cookie: cookie } }), env)).json();
	assert.equal(page.user.id, "42");
	assert.equal(page.comments.find((comment: { id: string }) => comment.id === anonymous).user, null);
	const logged = page.comments.find((comment: { content: string }) => comment.content === "已登录留言");
	assert.equal(logged.user.id, "42");
	assert.equal(logged.nickname, "测试昵称");
	assert.equal(logged.user.isAuthor, true);
	assert.equal(page.siteKey, "");
});

test("login switch and missing credentials preserve guest mode; login attempts are rate limited", async t => {
	const { env } = setup(t);
	const settings = config.comment!.github!;
	settings.enabled = false;
	try {
		assert.equal((await (await handleAuth(authRequest("session"), env)).json()).enabled, false);
	} finally {
		settings.enabled = true;
	}
	assert.equal((await (await handleAuth(authRequest("session"), { ...env, GITHUB_CLIENT_SECRET: "" })).json()).enabled, false);
	for (let i = 0; i < 10; i++) assert.equal((await handleAuth(authRequest("github/login"), env)).status, 302);
	assert.equal((await handleAuth(authRequest("github/login"), env)).status, 429);
	assert.equal((await handleAuth(new Request("http://blog.example/api/auth/github/login"), env)).status, 400);
});

test("homepage normalization handles GitHub's bare domain while rejecting executable schemes", () => {
	assert.equal(normalizeHomepage("example.com"), "https://example.com/");
	assert.equal(normalizeHomepage("javascript:alert(1)"), null);
	assert.equal(normalizeHomepage(""), "");
});

test("GitHub login returns to the original memo detail", async t => {
	const { env } = setup(t);
	mockGithub(t);
	const transaction = await begin(env, "/memo/public");
	const result = await complete(env, transaction);
	assert.equal(result.response.headers.get("Location"), "https://blog.example/memo/public#comments");
});
