<script lang="ts">
import { onMount } from "svelte";
import config from "$config";
import Pagination from "$components/Pagination.svelte";
import { filterMemos, type MemoItem } from "$lib/memo";
import i18nit from "$i18n";

let { locale, memos, years }: { locale: string; memos: MemoItem[]; years: string[] } = $props();
const t = i18nit(locale);
const size = config.pagination?.memo || 20;
let year = $state<string | null>(null);
let page = $state(1);
let initialized = $state(false);
const filtered = $derived(filterMemos(memos, year));
const pages = $derived(Math.max(1, Math.ceil(filtered.length / size)));
const list = $derived(filtered.slice((page - 1) * size, page * size));

onMount(() => {
	const readLocation = () => {
		const params = new URLSearchParams(window.location.search);
		year = params.get("series");
		const requested = Number(params.get("page") || 1);
		page = Math.max(1, Math.min(pages, Number.isFinite(requested) ? Math.floor(requested) : 1));
		initialized = true;
	};
	readLocation();
	window.addEventListener("popstate", readLocation);
	return () => window.removeEventListener("popstate", readLocation);
});

$effect(() => {
	if (!initialized) return;
	const url = new URL(window.location.href);
	url.searchParams.delete("series");
	if (year) url.searchParams.set("series", year);
	url.searchParams.delete("page");
	if (page > 1) url.searchParams.set("page", String(page));
	if (url.toString() !== window.location.href) {
		window.history.replaceState({ ...window.history.state, url: url.toString(), source: "swup" }, "", url);
	}
});

function chooseYear(value: string) {
	year = year === value ? null : value;
	page = 1;
}
</script>

<div class="flex flex-col-reverse sm:flex-row gap-10 grow">
	<article class="flex flex-col gap-5 min-w-0 grow">
		{#each list as memo (memo.id)}
			<section class="border-b border-dashed border-b-weak pb-1">
				<a href={memo.url} class="memo-title font-semibold text-primary link">{memo.series}｜{memo.title}</a>
			</section>
		{:else}
			<div role="status" class="pt-[10vh] text-center text-secondary font-bold text-xl">{t("memo.empty")}</div>
		{/each}
		<Pagination {pages} bind:page />
	</article>
	<aside class="sm:basis-50 shrink-0 flex flex-col gap-5">
		{#if years.length > 0}
			<section>
				<h4>{t("memo.year")}</h4>
				<p>
					{#each years as value}
						<button type="button" class:selected={year === value} aria-pressed={year === value} onclick={() => chooseYear(value)}>{value}</button>
					{/each}
				</p>
			</section>
		{/if}
	</aside>
</div>

<style>
.memo-title {
	line-height: 1.5;
	overflow-wrap: anywhere;
}

aside section {
	display: flex;
	flex-direction: column;
	gap: 5px;
}

aside p {
	display: flex;
	flex-wrap: wrap;
	gap: 5px;
}

aside button {
	border-bottom: 1px solid var(--primary-color);
	padding: 0 0.35rem;
	font-size: 0.9rem;
	transition: color 0.1s ease-in-out, background-color 0.1s ease-in-out;
}

aside button.selected {
	color: var(--background-color);
	background: var(--primary-color);
}

@media (min-width: 640px) {
	aside button:hover {
		color: var(--background-color);
		background: var(--primary-color);
	}
}

@media (prefers-reduced-motion: reduce) {
	aside button { transition: none; }
}
</style>
