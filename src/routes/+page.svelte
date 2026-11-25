<script lang="ts">
	import { goto } from '$app/navigation';
	import KidsGame from '#lib/components/kids/KidsGame.svelte';
	import '#lib/kids/ui/kids.css';
</script>

<svelte:head>
	<title>Dunia Pintar 3D — Petualangan Belajar</title>
	<meta name="description" content="Petualangan belajar 3D untuk anak usia 3–5 tahun. Berhitung, mengenal huruf, dan warna bersama Bubu." />
	<meta name="theme-color" content="#9fd8ff" />
	<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no" />
</svelte:head>

<KidsGame oparent={() => goto('/parent')} />
