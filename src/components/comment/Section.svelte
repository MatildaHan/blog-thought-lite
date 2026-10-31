<script lang="ts">
// UI adapted from ThoughtLite's cloudflare Reply.svelte (GPL-3.0).
import { onMount, tick } from "svelte";
import Icon from "$components/Icon.svelte";
import i18nit from "$i18n";
import { commentLength, type CommentItem, type CommentPage, type CommentUser } from "$lib/comments";
import { renderComment } from "$lib/comment-markdown";
import { loadTurnstile } from "$lib/turnstile";
import Avatar from "./Avatar.svelte";
import Profile from "./Profile.svelte";

let { locale, path, maxLength }: { locale: string; path: string; maxLength: number } = $props();
const t = i18nit(locale);
const draftKey = `comment-draft:${path}`;
const emojis = ["😂", "😭", "❤️", "🙏", "😘", "😏", "😢", "😩", "😨", "😡"];
let content = $state("");
let nickname = $state("");
let preview = $state(false);
let emojiOpen = $state(false);
let comments: CommentItem[] = $state([]);
let nextCursor: string | null = $state(null);
let replying: CommentItem | null = $state(null);
let ascending = $state(false);
let loading = $state(true);
let submitting = $state(false);
let ready = $state(false);
let user: CommentUser | null = $state(null);
let githubEnabled = $state(false);
let profileOpen = $state(false);
let captcha = $state("");
let message = $state("");
let failure = $state(false);
let restored = $state(false);
let textarea: HTMLTextAreaElement;
let captchaElement: HTMLDivElement;
let widgetId: string | undefined;
let disposed = false;
let controller: AbortController | undefined;
const length = $derived(commentLength(content.trim()));
const list = $derived(ascending ? [...comments].reverse() : comments);

function storage(action: "get" | "set" | "remove", key: string, value = ""): string {
	try {
		if (action === "get") return localStorage.getItem(key) || "";
		if (action === "set") localStorage.setItem(key, value);
		else localStorage.removeItem(key);
	} catch {
		/* Storage can be disabled in private browsing. */
	}
	return "";
}

$effect(() => {
	if (!restored) return;
	const draft = content;
	const timer = setTimeout(() => {
		storage(draft.trim() ? "set" : "remove", draftKey, draft);
	}, 500);
	return () => clearTimeout(timer);
});

$effect(() => {
	void content;
	if (textarea) {
		textarea.style.height = "auto";
		textarea.style.height = `${textarea.scrollHeight}px`;
	}
});

function notify(key: string, error = true) {
	message = t(`comment.${key}`);
	failure = error;
}

async function setupCaptcha(siteKey: string) {
	if (!siteKey) return;
	if (widgetId !== undefined) {
		if (!captcha) window.turnstile?.reset(widgetId);
		return;
	}
	try {
		const turnstile = await loadTurnstile();
		await tick();
		if (disposed) return;
		widgetId = turnstile.render(captchaElement, {
			sitekey: siteKey,
			action: "comment",
			theme: "auto",
			callback: token => {
				captcha = token;
			},
			"expired-callback": () => {
				captcha = "";
			},
			"error-callback": () => {
				captcha = "";
				notify("verify.failure");
			}
		});
	} catch {
		if (!disposed) notify("verify.failure");
	}
}

async function load(more = false) {
	controller?.abort();
	controller = new AbortController();
	loading = true;
	const query = new URLSearchParams({ path });
	if (more && nextCursor) query.set("cursor", nextCursor);
	try {
		const response = await fetch(`/api/comments?${query}`, { signal: controller.signal });
		if (!response.ok) throw new Error("unavailable");
		const data: CommentPage = await response.json();
		if (disposed) return;
		comments = more ? [...comments, ...data.comments.filter(item => !comments.some(existing => existing.id === item.id))] : data.comments;
		nextCursor = data.nextCursor;
		ready = data.ready;
		user = data.user;
		githubEnabled = data.githubEnabled;
		if (!ready) notify(githubEnabled ? "auth.signinToComment" : "unavailable");
		else if (failure) {
			message = "";
			failure = false;
		}
		if (user && widgetId !== undefined) {
			window.turnstile?.remove(widgetId);
			widgetId = undefined;
			captcha = "";
		}
		if (!user) await setupCaptcha(data.siteKey);
	} catch (error) {
		if (!disposed && !(error instanceof DOMException && error.name === "AbortError")) notify("fetch.failure");
	} finally {
		if (!disposed) loading = false;
	}
}

async function submit(event: SubmitEvent) {
	event.preventDefault();
	if (submitting || !ready || (!user && (!captcha || !nickname.trim())) || !content.trim() || length > maxLength) return;
	submitting = true;
	message = "";
	failure = false;
	try {
		const response = await fetch(`/api/comments?${new URLSearchParams({ path })}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ nickname, content, captcha, parentId: replying?.id })
		});
		if (disposed) return;
		if (!response.ok) {
			const result = await response.json().catch(() => ({}));
			notify(result.error === "captcha" ? "verify.failure" : response.status === 429 ? "limit" : "failure");
			return;
		}
		if (!user) storage("set", "comment-nickname", nickname.trim());
		content = "";
		replying = null;
		preview = false;
		storage("remove", draftKey);
		await load();
		if (!failure) notify("success", false);
	} catch {
		if (!disposed) notify("failure");
	} finally {
		captcha = "";
		if (widgetId !== undefined) window.turnstile?.reset(widgetId);
		submitting = false;
	}
}

async function insertEmoji(emoji: string) {
	preview = false;
	await tick();
	const start = textarea.selectionStart ?? content.length;
	const end = textarea.selectionEnd ?? content.length;
	content = content.slice(0, start) + emoji + content.slice(end);
	emojiOpen = false;
	await tick();
	textarea.focus();
	textarea.setSelectionRange(start + emoji.length, start + emoji.length);
}

async function reply(comment: CommentItem) {
	replying = comment;
	preview = false;
	await tick();
	textarea.focus();
	document.getElementById("comments")?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function signin() {
	storage(content.trim() ? "set" : "remove", draftKey, content);
	location.assign(`/api/auth/github/login?${new URLSearchParams({ returnTo: path })}`);
}

onMount(() => {
	nickname = storage("get", "comment-nickname");
	content = storage("get", draftKey);
	restored = true;
	const url = new URL(location.href);
	const authFailed = url.searchParams.has("commentAuth");
	if (authFailed) {
		url.searchParams.delete("commentAuth");
		history.replaceState(history.state, "", url);
	}
	void load().then(() => {
		if (authFailed && !disposed) notify("auth.failure");
	});
	return () => {
		disposed = true;
		controller?.abort();
		if (widgetId !== undefined) window.turnstile?.remove(widgetId);
		// Persist the latest keystrokes even when navigating within the debounce delay.
		storage(content.trim() ? "set" : "remove", draftKey, content);
	};
});
</script>

<section id="comments" aria-label={t("comment.name")} class="comments">
	{#if replying}
		<div class="replying">
			<span>{t("comment.replyTo", { name: replying.nickname })}</span>
			<button type="button" onclick={() => (replying = null)} aria-label={t("comment.cancelReply")}><Icon name="lucide--x" size={18} /></button>
		</div>
	{/if}
	<form onsubmit={submit} aria-label={t("comment.form")}>
		<span aria-hidden="true" class="corner corner-top corner-start"></span>
		<span aria-hidden="true" class="corner corner-top corner-end"></span>
		<span aria-hidden="true" class="corner corner-bottom corner-start"></span>
		<span aria-hidden="true" class="corner corner-bottom corner-end"></span>
		<div class="editor">
			{#if preview}
				<div class="preview markdown" aria-label={t("comment.preview.name")}>
					{#await renderComment(content)}<span>{t("comment.loading")}</span>
					{:then html}{#if content.trim()}{@html html}{:else}<span class="text-secondary">{t("comment.preview.empty")}</span>{/if}{/await}
				</div>
			{:else}
				<textarea bind:this={textarea} bind:value={content} aria-label={t("comment.placeholder")} placeholder={`  ${t("comment.placeholder")}`} disabled={submitting} rows="3"></textarea>
			{/if}
		</div>
		<div class="toolbar" class:with-github={githubEnabled}>
			<div class="tools">
				<div class="emoji">
					<button type="button" aria-label={t("comment.emoji")} aria-expanded={emojiOpen} onclick={() => (emojiOpen = !emojiOpen)}><Icon name="lucide--smile" size={20} /></button>
					{#if emojiOpen}<div class="emoji-picker">
							{#each emojis as emoji}<button type="button" onclick={() => insertEmoji(emoji)} aria-label={emoji}>{emoji}</button>{/each}
						</div>{/if}
				</div>
				<label class="preview-control">
					<Icon name="lucide--file-search" size={20} />
					<input type="checkbox" bind:checked={preview} aria-label={t("comment.preview.name")} />
				</label>
			</div>
			<div class="send-tools">
				{#if user}
					<button type="button" class="profile-trigger" aria-label={t("comment.auth.profile")} onclick={() => (profileOpen = true)}><Avatar url={user.avatarUrl} size={20} /><span class="account-name">{user.name}</span></button>
				{:else}
					<input class="nickname" type="text" bind:value={nickname} maxlength="40" placeholder={t("comment.nickname")} aria-label={t("comment.nickname")} autocomplete="nickname" required disabled={submitting} />
					{#if githubEnabled}<button type="button" onclick={signin} aria-label={t("comment.auth.login")}><Icon name="simple-icons--github" size={20} /></button>{/if}
				{/if}
				<button type="submit" aria-label={t("comment.submit")} disabled={submitting || !ready || (!user && (!captcha || !nickname.trim())) || !content.trim() || length > maxLength}>
					<Icon name={submitting ? "lucide--loader-circle" : "lucide--send"} size={21} />
				</button>
			</div>
		</div>
	</form>
	{#if user}<Profile {user} {locale} {signin} refresh={() => load()} bind:open={profileOpen} />{/if}
	<div class="verification" bind:this={captchaElement}></div>
	<div class="feedback" aria-live="polite" aria-atomic="true">
		{#if message}<p class:error={failure}>{message}</p>{:else if loading}<p>{t("comment.loading")}</p>{:else if ready && !user && !captcha}<p>{t("comment.verify.progress")}</p>{/if}
		{#if length > maxLength}<p class="error">{t("comment.overlength", { count: length, max: maxLength })}</p>{/if}
	</div>
	<div class="list-heading">
		<span>{t("comment.name")} · {comments.length}{nextCursor ? "+" : ""}</span>
		<div class="tools">
			<button type="button" onclick={() => load()} disabled={loading || submitting} aria-label={t("comment.reload")}><Icon name="lucide--refresh-cw" size={18} /></button>
			<button type="button" onclick={() => (ascending = !ascending)} aria-label={t(ascending ? "comment.sort.desc" : "comment.sort.asc")}><Icon name={ascending ? "lucide--clock-arrow-down" : "lucide--clock-arrow-up"} size={18} /></button>
		</div>
	</div>
	{#each list as comment (comment.id)}
		<article class="comment" id={`comment-${comment.id}`}>
			<header>
				{#if comment.user}<Avatar url={comment.user.avatarUrl} />{/if}
				<div class="comment-identity">
					<div class="comment-meta">
						<b>{comment.nickname}</b>
						{#if comment.user?.isAuthor}<Icon name="lucide--signature" size={16} title={t("comment.auth.author")} />{/if}
						{#if comment.user?.homepage}<a href={comment.user.homepage} target="_blank" rel="noopener noreferrer nofollow ugc" aria-label={t("comment.auth.homepage")} class="homepage"><Icon name="lucide--house" size={16} /></a>{/if}
						<time datetime={comment.createdAt}>{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(comment.createdAt))}</time>
					</div>
					{#if comment.user?.description}<p class="profile-description">{comment.user.description}</p>{/if}
				</div>
			</header>
			{#if comment.parentNickname}<p class="text-secondary text-sm">{t("comment.replyTo", { name: comment.parentNickname })}</p>{/if}
			<div class="markdown comment-content">{#await renderComment(comment.content)}<p>{comment.content}</p>{:then html}{@html html}{/await}</div>
			<button type="button" class="reply-button" onclick={() => reply(comment)}>{t("comment.reply")}</button>
		</article>
	{/each}
	{#if nextCursor}<button type="button" class="more" disabled={loading} onclick={() => load(true)}>{t("comment.more")}</button>{/if}
</section>

<style>
.comments {
	margin-top: 0.5rem;
	scroll-margin-top: 5rem;
	min-width: 0;
}
form {
	--editor-color: color-mix(in srgb, var(--secondary-color) 75%, var(--background-color));
	position: relative;
	border: 2px solid transparent;
	padding: 0.9rem 1rem;
	color: var(--editor-color);
}
form:focus-within {
	--editor-color: var(--primary-color);
}
.corner {
	position: absolute;
	width: 0.5rem;
	height: 0.5rem;
	border-color: var(--shadow-color);
	border-style: solid;
	border-width: 0;
	pointer-events: none;
	transition:
		width 0.2s ease-out,
		height 0.2s ease-out,
		border-color 0.2s ease-out;
}
.corner-top {
	inset-block-start: -2px;
	border-block-start-width: 2px;
}
.corner-bottom {
	inset-block-end: -2px;
	border-block-end-width: 2px;
}
.corner-start {
	inset-inline-start: -2px;
	border-inline-start-width: 2px;
}
.corner-end {
	inset-inline-end: -2px;
	border-inline-end-width: 2px;
}
form:focus-within .corner {
	width: calc(50% + 2px);
	height: calc(50% + 2px);
	border-color: var(--secondary-color);
}
.editor {
	min-height: 5.5rem;
	margin-bottom: 0.9rem;
}
textarea {
	display: block;
	width: 100%;
	min-height: 5.5rem;
	resize: vertical;
	background: transparent;
	color: var(--editor-color);
	transition: color 0.2s ease-out;
	font: inherit;
	user-select: text;
	border: 0;
	outline: none;
	line-height: 1.7;
}
textarea::placeholder {
	color: var(--editor-color);
}
.preview {
	min-height: 5.5rem;
	overflow-wrap: anywhere;
	user-select: text;
}
.toolbar,
.tools,
.send-tools,
.preview-control,
.replying,
.list-heading {
	display: flex;
	align-items: center;
	gap: 0.7rem;
}
.toolbar,
.list-heading {
	justify-content: space-between;
}
.toolbar {
	transition: color 0.2s ease-out;
}
.tools {
	flex-shrink: 0;
}
.send-tools {
	min-width: 0;
}
.profile-trigger {
	display: flex;
	align-items: center;
	gap: 0.45rem;
	min-width: 0;
}
.account-name {
	max-width: 9rem;
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
	font-size: 0.875rem;
}
.nickname {
	width: 9rem;
	min-width: 0;
	border: 0;
	border-bottom: 2px solid var(--editor-color);
	padding: 0.1rem 0;
	background: transparent;
	color: inherit;
	font-size: 0.875rem;
	user-select: text;
	transition:
		color 0.2s ease-out,
		border-color 0.2s ease-out;
}
.nickname::placeholder {
	color: var(--editor-color);
}
.emoji {
	position: relative;
}
.emoji-picker {
	position: absolute;
	bottom: calc(100% + 0.8rem);
	inset-inline-start: -0.4rem;
	display: flex;
	flex-wrap: wrap;
	gap: 0.6rem;
	width: 14rem;
	padding: 0.7rem;
	background: var(--background-color);
	border: 1px solid var(--weak-color);
	box-shadow: 0 2px 8px #0002;
	z-index: 20;
}
.preview-control {
	cursor: pointer;
	gap: 0.45rem;
}
.preview-control input {
	appearance: none;
	position: relative;
	width: 1.8rem;
	height: 1rem;
	cursor: pointer;
	color: inherit;
	background: linear-gradient(currentColor, currentColor) center / 100% 2px no-repeat;
}
.preview-control input::before {
	content: "";
	position: absolute;
	top: 0;
	left: 0;
	width: 1rem;
	height: 1rem;
	border: 2px solid currentColor;
	border-radius: 50%;
	background: var(--background-color);
	transition: transform 0.15s;
}
.preview-control input:checked::before {
	transform: translateX(0.8rem);
}
.verification:empty {
	display: none;
}
.verification {
	margin-top: 0.6rem;
}
.feedback {
	color: var(--secondary-color);
	font-size: 0.8rem;
	min-height: 1.5rem;
	padding-top: 0.35rem;
}
.error {
	color: #a33c28;
}
:global([data-theme="dark"]) .error {
	color: #f0a18e;
}
.list-heading {
	margin-top: 1.5rem;
	font-size: 0.9rem;
}
.replying {
	justify-content: space-between;
	font-size: 0.85rem;
	padding: 0.5rem 0;
	overflow-wrap: anywhere;
}
.comment {
	margin-top: 1.2rem;
	padding-bottom: 1rem;
	border-bottom: 1px dashed var(--shadow-color);
}
.comment header {
	display: flex;
	flex-wrap: wrap;
	gap: 0.5rem 1rem;
	align-items: center;
	margin-bottom: 0.5rem;
}
.comment-identity {
	min-width: 0;
}
.comment-meta {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 0.35rem;
}
.homepage {
	display: inline-flex;
}
.profile-description {
	color: var(--secondary-color);
	font-size: 0.75rem;
	margin-top: 0.25rem;
	overflow-wrap: anywhere;
}
.comment header b {
	overflow-wrap: anywhere;
}
.comment time,
.reply-button {
	font-size: 0.75rem;
	color: var(--secondary-color);
}
.comment-content {
	user-select: text;
	overflow-wrap: anywhere;
}
.reply-button {
	margin-top: 0.5rem;
}
.more {
	margin: 1.2rem auto 0;
	font-size: 0.85rem;
}
@media (max-width: 400px) {
	form {
		padding: 0.75rem;
	}
	.toolbar {
		gap: 0.5rem;
	}
	.nickname {
		width: 6rem;
	}
	.tools,
	.send-tools {
		gap: 0.5rem;
	}
}
@media (max-width: 360px) {
	.toolbar.with-github .nickname {
		width: 4.5rem;
	}
	.account-name {
		max-width: 4.5rem;
	}
}
/* Below the wide-screen gutters, reserve room for the fixed article controls. */
@media (max-width: 1100px) {
	.comments {
		margin-inline-end: 3rem;
	}
}
@media (prefers-reduced-motion: reduce) {
	.corner,
	textarea,
	.toolbar,
	.nickname,
	.preview-control input::before {
		transition: none;
	}
}
</style>
