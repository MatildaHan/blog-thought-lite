<script lang="ts">
import { onMount, tick } from "svelte";
import config from "$config";
import Pagination from "$components/Pagination.svelte";
import Sensitive from "$components/Sensitive.svelte";
import i18nit from "$i18n";

interface MomentItem {
	id: string;
	html: string;
	timestamp: Date;
	time: string;
	tags: string[];
	sensitive: boolean;
}

let { locale, moments, tags: tagList, path }: { locale: string; moments: MomentItem[]; tags: string[]; path: string } = $props();
const t = i18nit(locale);
let tags = $state<string[]>([]);
let page = $state(1);
let initialized = $state(false);
const size = config.pagination?.moment || 20;
const filtered = $derived(
	moments.filter(entry => tags.every(tag => entry.tags.includes(tag))).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
);
const pages = $derived(Math.max(1, Math.ceil(filtered.length / size)));
const list = $derived(filtered.slice((page - 1) * size, page * size));

function anchorId(): string {
	try {
		return decodeURIComponent(window.location.hash.slice(1));
	} catch {
		return "";
	}
}

onMount(() => {
	const readLocation = () => {
		const params = new URLSearchParams(window.location.search);
		tags = params.getAll("tag");
		const requested = Number(params.get("page") || 1);
		page = Math.max(1, Math.min(pages, Number.isFinite(requested) ? Math.floor(requested) : 1));
		const anchor = anchorId();
		const index = anchor ? filtered.findIndex(entry => entry.id === anchor) : -1;
		if (index >= 0) {
			page = Math.floor(index / size) + 1;
			void tick().then(() => document.getElementById(anchor)?.scrollIntoView());
		}
		initialized = true;
	};
	readLocation();
	window.addEventListener("popstate", readLocation);
	window.addEventListener("hashchange", readLocation);
	return () => {
		window.removeEventListener("popstate", readLocation);
		window.removeEventListener("hashchange", readLocation);
	};
});

$effect(() => {
	if (!initialized) return;
	const url = new URL(window.location.href);
	url.searchParams.delete("tag");
	for (const selectedTag of tags) url.searchParams.append("tag", selectedTag);
	url.searchParams.delete("page");
	if (page > 1) url.searchParams.set("page", String(page));
	if (url.hash && !list.some(entry => entry.id === anchorId())) url.hash = "";
	if (url.toString() !== window.location.href) {
		window.history.replaceState({ ...window.history.state, url: url.toString(), source: "swup" }, "", url);
	}
});

function switchTag(tag: string, turn?: boolean) {
	const included = tags.includes(tag);
	const selected = turn ?? !included;
	tags = selected ? (included ? tags : [...tags, tag]) : tags.filter(item => item !== tag);
	page = 1;
}
</script>

<div class="flex flex-col-reverse sm:flex-row gap-10 grow">
	<article class="flex flex-col gap-5 min-w-0 grow">
		{#each list as moment (moment.id)}
			<section id={moment.id} class="flex flex-col gap-1 border-b border-dashed border-b-weak pb-1 scroll-mt-16">
				<Sensitive {locale} sensitive={moment.sensitive} back={path}>
					<div class="markdown moment-content font-semibold text-primary">{@html moment.html}</div>
				</Sensitive>
				<div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.825rem] text-secondary">
					<time datetime={moment.timestamp.toISOString()} class="font-mono whitespace-nowrap">{moment.time}</time>
					<span class="inline-flex gap-1 flex-wrap">
						{#each moment.tags as tag}
							<button onclick={() => switchTag(tag, true)} aria-pressed={tags.includes(tag)}>#{tag}</button>
						{/each}
					</span>
				</div>
			</section>
		{:else}
			<div role="status" class="pt-[10vh] text-center text-secondary font-bold text-xl">{t("moment.empty")}</div>
		{/each}
		<Pagination {pages} bind:page />
	</article>

	<aside class="sm:basis-50 shrink-0 flex flex-col gap-5">
		<section>
			<h4>{t("moment.tag")}</h4>
			<p>
				{#each tagList as tag}
					<button class:selected={tags.includes(tag)} onclick={() => switchTag(tag)} aria-pressed={tags.includes(tag)}>{tag}</button>
				{/each}
			</p>
		</section>
	</aside>
</div>

<style>
.moment-content {
	line-height: 1.5;
	overflow-wrap: anywhere;
}

aside {
	section {
		display: flex;
		flex-direction: column;
		gap: 5px;

		p {
			display: flex;
			flex-direction: row;
			flex-wrap: wrap;
			gap: 5px;

			button {
				border-bottom: 1px solid var(--primary-color);
				padding: 0rem 0.35rem;
				font-size: 0.9rem;
				transition:
					color 0.1s ease-in-out,
					background-color 0.1s ease-in-out;

				&.selected {
					color: var(--background-color);
					background-color: var(--primary-color);
				}

				@media (min-width: 640px) {
					&:hover {
						color: var(--background-color);
						background-color: var(--primary-color);
					}
				}
			}
		}
	}
}
</style>
