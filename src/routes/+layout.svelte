<script lang="ts">
	import { onMount } from 'svelte';
	let { children } = $props();

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

{@render children()}
