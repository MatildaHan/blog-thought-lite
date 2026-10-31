import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import config from "../site.config";
import { handleComments } from "../functions/api/comments";
import { renderComment } from "../src/lib/comment-markdown";
import type { CommentPage } from "../src/lib/comments";
import { fixture } from "./comment-fixture";

function request(method = "GET", path = "/note/public", body?: Record<string, unknown>, origin = "https://blog.example") {
	return new Request(`https://blog.example/api/comments?${new URLSearchParams({ path })}`, {
		method,
		headers: { Origin: origin, "Content-Type": "application/json", "CF-Connecting-IP": "192.0.2.1" },
		body: body ? JSON.stringify(body) : undefined
	});
}

function verify(t: TestContext, valid = true) {
	t.mock.method(globalThis, "fetch", async () => Response.json({ success: valid, hostname: "blog.example", action: "comment" }));
}

const payload = { nickname: "读者", content: "一条 **想法**", captcha: "token" };

test("comments persist, identical content gets unique IDs, and replies stay on their page", async t => {
	verify(t);
	const { env, sqlite } = fixture();
	t.after(() => sqlite.close());
	const created = await handleComments(request("POST", "/note/public", payload), env);
	assert.equal(created.status, 201);
	const { id } = await created.json();
	const duplicate = await handleComments(request("POST", "/note/public", payload), env);
	assert.equal(duplicate.status, 201);
	assert.notEqual((await duplicate.json()).id, id);
	assert.equal((await handleComments(request("POST", "/jotting/public", { ...payload, parentId: id }), env)).status, 404);
	// A different client replies after the first client's rate limit.
	const replyRequest = request("POST", "/note/public", { ...payload, nickname: "另一位读者", parentId: id });
	replyRequest.headers.set("CF-Connecting-IP", "192.0.2.2");
	assert.equal((await handleComments(replyRequest, env)).status, 201);
	const page: CommentPage = await (await handleComments(request(), env)).json();
	assert.equal(page.comments.length, 3);
	assert.equal(page.comments.find(comment => comment.parentId === id)?.parentNickname, "读者");
	assert.equal(page.ready, true);
});

test("global and runtime switches block both reading and writing without deleting data", async t => {
	const { env, sqlite } = fixture();
	t.after(() => sqlite.close());
	const settings = config.comment!;
	settings.enabled = false;
	try {
		for (const method of ["GET", "POST"]) assert.equal((await handleComments(request(method), env)).status, 404);
	} finally {
		settings.enabled = true;
	}
	env.COMMENTS_ENABLED = "false";
	for (const method of ["GET", "POST"]) assert.equal((await handleComments(request(method), env)).status, 404);
	assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM comments").get()?.count, 0);
});

test("drafts, unknown pages, cross-origin writes, missing configuration, and malformed input are rejected", async t => {
	const { env, sqlite } = fixture();
	t.after(() => sqlite.close());
	assert.equal((await handleComments(request("GET", "/note/draft"), env)).status, 404);
	assert.equal((await handleComments(request("POST", "/note/public", payload, "https://evil.example"), env)).status, 403);
	assert.equal((await handleComments(request(), { ...env, COMMENTS_DB: undefined })).status, 503);
	assert.equal((await handleComments(request("POST", "/note/public", payload), { ...env, TURNSTILE_SECRET_KEY: "" })).status, 503);
	for (const invalid of [
		{ ...payload, content: " " },
		{ ...payload, content: "字".repeat(501) },
		{ ...payload, nickname: "a".repeat(41) },
		{ ...payload, nickname: "a\nadmin" },
		{ ...payload, captcha: "" },
		{ ...payload, parentId: "not-an-id" }
	])
		assert.equal((await handleComments(request("POST", "/note/public", invalid), env)).status, 400);
	const malformed = request("POST", "/note/public");
	assert.equal((await handleComments(malformed, env)).status, 400);
});

test("failed Turnstile and production use of public test keys cannot publish", async t => {
	verify(t, false);
	const { env, sqlite } = fixture();
	t.after(() => sqlite.close());
	assert.equal((await handleComments(request("POST", "/note/public", payload), env)).status, 403);
	env.TURNSTILE_SECRET_KEY = "1x0000000000000000000000000000000AA";
	assert.equal((await handleComments(request("POST", "/note/public", payload), env)).status, 503);
	assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM comments").get()?.count, 0);
});

test("a valid token for another hostname or action is rejected", async t => {
	t.mock.method(globalThis, "fetch", async () => Response.json({ success: true, hostname: "evil.example", action: "comment" }));
	const { env, sqlite } = fixture();
	t.after(() => sqlite.close());
	assert.equal((await handleComments(request("POST", "/note/public", payload), env)).status, 403);
});

test("rate limit is atomic and does not store the raw IP", async t => {
	verify(t);
	const { env, sqlite } = fixture();
	t.after(() => sqlite.close());
	const responses = await Promise.all(Array.from({ length: 6 }, () => handleComments(request("POST", "/note/public", payload), env)));
	assert.equal(responses.filter(response => response.status === 201).length, 3);
	assert.equal(responses.filter(response => response.status === 429).length, 3);
	const limits = sqlite.prepare("SELECT * FROM comment_limits").all();
	assert.equal(limits.length, 1);
	assert.match(limits[0].key as string, /^[a-f0-9]{64}$/);
	assert.ok(!JSON.stringify(limits).includes("192.0.2.1"));
});

test("cursor pagination has no gaps or duplicates even with matching timestamps", async t => {
	const { env, sqlite } = fixture();
	t.after(() => sqlite.close());
	const insert = sqlite.prepare("INSERT INTO comments (id, path, parent_id, nickname, content, created_at) VALUES (?, ?, NULL, ?, ?, ?)");
	for (let i = 0; i < 45; i++) insert.run(crypto.randomUUID(), "/note/public", "读者", String(i), "2026-10-30T00:00:00.000Z");
	const seen = new Set<string>();
	let cursor: string | null = null;
	do {
		const next = request();
		const url = new URL(next.url);
		if (cursor) url.searchParams.set("cursor", cursor);
		const page: CommentPage = await (await handleComments(new Request(url), env)).json();
		assert.ok(page.comments.length <= 20);
		for (const item of page.comments) {
			assert.ok(!seen.has(item.id));
			seen.add(item.id);
		}
		cursor = page.nextCursor;
	} while (cursor);
	assert.equal(seen.size, 45);
});

test("Markdown supports formatting while removing executable markup and tracking images", async () => {
	const html = await renderComment(
		"**粗体** [链接](https://example.com) [危险](javascript:alert%281%29)\n<script>alert(1)</script>\n<img src=x onerror=alert(1)>\n![追踪](https://evil.example/pixel)"
	);
	assert.ok(html.includes("<strong>粗体</strong>"));
	assert.ok(html.includes('href="https://example.com"'));
	assert.ok(html.includes("noopener"));
	assert.ok(!/javascript:|<script|<img|onerror=|evil\.example/.test(html));
});

test("published memo pages accept comments while draft memos remain unavailable", async t => {
	verify(t);
	const { env, sqlite } = fixture();
	t.after(() => sqlite.close());
	assert.equal((await handleComments(request("POST", "/memo/public", payload), env)).status, 201);
	const page: CommentPage = await (await handleComments(request("GET", "/memo/public"), env)).json();
	assert.equal(page.comments.length, 1);
	assert.equal((await handleComments(request("GET", "/memo/draft"), env)).status, 404);
});
