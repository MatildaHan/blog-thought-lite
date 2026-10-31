<script lang="ts">
import Icon from "$components/Icon.svelte";
let { url, size = 36 }: { url: string; size?: number } = $props();
let failed = $state(false);
$effect(() => {
	void url;
	failed = false;
});
</script>

<span class="avatar" style:width={`${size}px`} style:height={`${size}px`} aria-hidden="true">
	<Icon name="lucide--user-round" size={size * 0.6} />
	{#if url && !failed}<img src={url} alt="" referrerpolicy="no-referrer" loading="lazy" onerror={() => (failed = true)} />{/if}
</span>

<style>
.avatar {
	position: relative;
	display: inline-flex;
	flex-shrink: 0;
	align-items: center;
	justify-content: center;
	border: 1px solid var(--weak-color);
	border-radius: 50%;
	overflow: hidden;
	color: var(--secondary-color);
}
img {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	object-fit: cover;
}
</style>
