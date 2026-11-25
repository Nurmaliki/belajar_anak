<script lang="ts">
	import { onMount } from 'svelte';
	let { children, data } = $props();

	// Register the service worker for installable + offline play. A failure to
	// register (private mode, unsupported) is invisible — the game simply keeps
	// working from the network.
	onMount(() => {
		if ('serviceWorker' in navigator && import.meta.env.PROD) {
			navigator.serviceWorker.register('/sw.js').catch(() => {
				/* offline is a progressive enhancement */
			});
		}
	});
</script>

<svelte:head>
	<meta property="og:url" content={data?.origin ?? ''} />
	<meta property="og:image" content="{data?.origin ?? ''}/og-image.png" />
	<meta name="twitter:image" content="{data?.origin ?? ''}/og-image.png" />
</svelte:head>

{@render children()}

