<script lang="ts">
import { onMount } from "svelte";
import Icon from "$components/Icon.svelte";
import { runningDays } from "$lib/statistics";
import i18nit from "$i18n";

let {
	locale,
	startedAt,
	initialDays,
	totalWords,
	updatedAt
}: { locale: string; startedAt: string; initialDays: number; totalWords: number; updatedAt: string } = $props();

const t = i18nit(locale);
const tooltipId = $props.id();
let days = $state(initialDays);
let visible = $state(false);

onMount(() => {
	const update = () => (days = runningDays(startedAt));
	update();
	const interval = window.setInterval(update, 60000);
	return () => window.clearInterval(interval);
});
</script>

<div class="statistics relative inline-flex items-center">
	<button type="button" aria-label={t("statistics.name")} aria-describedby={tooltipId} onmouseenter={() => (visible = true)} onmouseleave={() => (visible = false)} onfocus={() => (visible = true)} onblur={() => (visible = false)} onclick={() => (visible = true)} onkeydown={event => { if (event.key === "Escape") visible = false; }}>
		<Icon name="lucide--activity" />
	</button>
	<span id={tooltipId} role="tooltip" class:visible class="tooltip rounded-sm py-2 px-1.5 text-xs font-serif font-normal leading-tight">
		<span class="line"><span aria-hidden="true" class="bullet"></span>{t("statistics.running", { count: days })}</span>
		<span class="line"><span aria-hidden="true" class="bullet"></span>{t("statistics.words", { count: totalWords })}</span>
		<span class="line"><span aria-hidden="true" class="bullet"></span>{t("statistics.updated", { date: updatedAt })}</span>
	</span>
</div>

<style>
button {
	display: inline-flex;
	align-items: center;
	padding: 0;
}

.tooltip {
	position: absolute;
	bottom: calc(100% + 4px);
	left: 50%;
	transform: translateX(-50%);
	z-index: 2000;
	display: flex;
	flex-direction: column;
	gap: 3px;
	background: #2a2a28;
	color: #fffffd;
	text-align: start;
	white-space: nowrap;
	pointer-events: none;
	visibility: hidden;
	opacity: 0;
}

.tooltip.visible {
	visibility: visible;
	opacity: 1;
}

.line {
	display: flex;
	align-items: center;
	gap: 6px;
}

.bullet {
	flex-shrink: 0;
	width: 3px;
	height: 3px;
	border-radius: 50%;
	background: currentColor;
}

@media (max-width: 640px) {
	.tooltip {
		left: auto;
		right: 0;
		transform: none;
	}
}
</style>
