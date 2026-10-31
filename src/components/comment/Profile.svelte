<script lang="ts">
import Icon from "$components/Icon.svelte";
import i18nit from "$i18n";
import type { CommentUser } from "$lib/comments";
import Avatar from "./Avatar.svelte";

let {
	user,
	locale,
	refresh,
	signin,
	open = $bindable(false)
}: { user: CommentUser; locale: string; refresh: () => Promise<void>; signin: () => void; open?: boolean } = $props();
const t = i18nit(locale);
let dialog: HTMLDialogElement;
let homepage = $state("");
let busy = $state(false);
let error = $state("");

$effect(() => {
	if (open && dialog && !dialog.open) {
		homepage = user.homepage;
		error = "";
		dialog.showModal();
	} else if (!open && dialog?.open) dialog.close();
});

async function save(event: SubmitEvent) {
	event.preventDefault();
	if (busy) return;
	busy = true;
	error = "";
	try {
		const response = await fetch("/api/auth/profile", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ homepage })
		});
		if (!response.ok) {
			error = t(response.status === 400 ? "comment.auth.invalidHomepage" : "comment.auth.failure");
			return;
		}
		dialog.close();
		await refresh();
	} catch {
		error = t("comment.auth.failure");
	} finally {
		busy = false;
	}
}

async function logout() {
	if (busy) return;
	busy = true;
	error = "";
	try {
		const response = await fetch("/api/auth/logout", { method: "POST" });
		if (!response.ok) throw new Error("logout");
		dialog.close();
		await refresh();
	} catch {
		error = t("comment.auth.failure");
	} finally {
		busy = false;
	}
}
</script>

<dialog bind:this={dialog} aria-label={t("comment.auth.profile")} onclose={() => (open = false)}>
	<div class="profile-heading">
		<Avatar url={user.avatarUrl} size={42} />
		<div class="profile-name"><b>{user.name}</b><a href={`https://github.com/${user.handle}`} target="_blank" rel="noopener noreferrer">@{user.handle}</a></div>
		<button type="button" class="close" aria-label={t("comment.auth.close")} onclick={() => dialog.close()}><Icon name="lucide--x" size={20} /></button>
	</div>
	{#if user.description}<p class="description">{user.description}</p>{/if}
	<p class="hint">{t("comment.auth.source")}</p>
	<form onsubmit={save}>
		<label>{t("comment.auth.homepage")}<input type="url" bind:value={homepage} maxlength="1000" placeholder="https://" /></label>
		<p class="error" aria-live="polite">{error}</p>
		<div class="actions"><button type="button" disabled={busy} onclick={signin}>{t("comment.auth.sync")}</button><button type="button" disabled={busy} onclick={logout}>{t("comment.auth.logout")}</button><button type="submit" disabled={busy}>{t("comment.auth.save")}</button></div>
	</form>
</dialog>

<style>
dialog {
	position: fixed;
	inset: 0;
	margin: auto;
	width: min(26rem, calc(100% - 2rem));
	max-height: 85dvh;
	overflow: auto;
	padding: 1.25rem;
	border: 2px solid var(--weak-color);
	color: var(--primary-color);
	background: var(--background-color);
}
dialog::backdrop {
	background: #0005;
}
.profile-heading {
	display: flex;
	align-items: center;
	gap: 0.75rem;
}
.profile-name {
	display: flex;
	flex-direction: column;
	gap: 0.15rem;
	min-width: 0;
	overflow-wrap: anywhere;
}
.profile-name a,
.description,
.hint {
	color: var(--secondary-color);
	font-size: 0.8rem;
}
.close {
	margin-inline-start: auto;
}
.description {
	margin-top: 0.75rem;
	overflow-wrap: anywhere;
}
.hint {
	margin: 0.75rem 0 1rem;
}
label {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
	font-size: 0.875rem;
}
input {
	border: 0;
	border-bottom: 1px solid var(--weak-color);
	padding: 0.3rem 0;
	background: transparent;
	color: inherit;
	user-select: text;
	width: 100%;
}
.actions {
	display: flex;
	flex-wrap: wrap;
	justify-content: space-between;
	gap: 1rem;
	font-size: 0.8rem;
	margin-top: 0.5rem;
}
.error {
	min-height: 1.5rem;
	margin-top: 0.5rem;
	font-size: 0.8rem;
	color: #a33c28;
}
:global([data-theme="dark"]) .error {
	color: #f0a18e;
}
</style>
