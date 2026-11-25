<script lang="ts">
	/**
	 * Main menu.
	 *
	 * Two things matter here: a huge Play button that needs no reading, and a
	 * row of area shortcuts with icons large enough to recognise. Every area
	 * button also speaks its name, so a non-reading child still knows where
	 * each one goes.
	 */
	import { areaList } from '#lib/kids/data/areas';
	import type { AreaId } from '#lib/kids/types';

	interface Props {
		stars: number;
		onplay: () => void;
		onarea: (id: AreaId) => void;
		onparent: () => void;
		onnarrate: (text: string) => void;
	}

	let { stars, onplay, onarea, onparent, onnarrate }: Props = $props();

	const areas = areaList();

	function pickArea(id: AreaId, name: string) {
		onnarrate(name);
		onarea(id);
	}
</script>

<div class="menu">
	<div class="stars" aria-label="Bintang: {stars}">
		<span class="star-icon" aria-hidden="true">⭐</span>
		<span class="star-count">{stars}</span>
	</div>

	<header class="brand">
		<h1 class="logo">
			<span class="line1">Dunia</span>
			<span class="line2">Pintar 3D</span>
		</h1>
		<p class="tagline">Petualangan belajar bersama Bubu</p>
	</header>

	<div class="bubu" aria-hidden="true">
		<div class="bubu-ear left"></div>
		<div class="bubu-ear right"></div>
		<div class="bubu-head">
			<span class="eye left"></span>
			<span class="eye right"></span>
			<span class="nose"></span>
		</div>
		<div class="bubu-body"></div>
	</div>

	<button class="dp-btn play" onclick={onplay} aria-label="Main">
		<span class="play-icon" aria-hidden="true">▶</span>
		<span>Main</span>
	</button>

	<div class="areas" role="group" aria-label="Pilih tempat belajar">
		{#each areas as area (area.id)}
			<button
				class="area"
				style="--c:{`#${area.color.toString(16).padStart(6, '0')}`}"
				onclick={() => pickArea(area.id, area.name)}
				aria-label={area.name}
			>
				<span class="area-icon" aria-hidden="true">{area.icon}</span>
				<span class="area-name">{area.name}</span>
			</button>
		{/each}
	</div>

	<button class="parent-link" onclick={onparent}>
		<span aria-hidden="true">👨‍👩‍👧</span> Untuk Orang Tua
	</button>
</div>

<style>
	.menu {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: clamp(0.6rem, 2vh, 1.4rem);
		padding: clamp(1rem, 4vw, 2.5rem);
		overflow-y: auto;
		background:
			radial-gradient(circle at 50% 8%, #fff6d9 0%, transparent 55%),
			linear-gradient(180deg, #a9dcff 0%, #cdefff 45%, #e9fbe0 100%);
	}

	.stars {
		position: absolute;
		top: clamp(0.8rem, 2.5vh, 1.6rem);
		right: clamp(0.8rem, 3vw, 1.8rem);
		display: flex;
		align-items: center;
		gap: 0.35em;
		padding: 0.4em 1em;
		border-radius: 999px;
		background: rgba(255, 250, 242, 0.95);
		box-shadow: var(--dp-shadow-sm);
		font-size: clamp(1.3rem, 4vw, 1.9rem);
		font-weight: 900;
	}
	.star-icon {
		font-size: 1.1em;
	}

	.brand {
		text-align: center;
		margin-bottom: 0.2rem;
	}
	.logo {
		margin: 0;
		line-height: 0.9;
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	.line1 {
		font-size: clamp(2.6rem, 11vw, 5.4rem);
		font-weight: 900;
		color: var(--dp-orange);
		text-shadow:
			0 4px 0 #fff,
			0 8px 0 rgba(47, 36, 64, 0.18);
		letter-spacing: -0.01em;
	}
	.line2 {
		font-size: clamp(3rem, 13vw, 6.4rem);
		font-weight: 900;
		color: var(--dp-purple);
		text-shadow:
			0 4px 0 #fff,
			0 9px 0 rgba(47, 36, 64, 0.18);
		letter-spacing: -0.02em;
	}
	.tagline {
		margin: 0.8rem 0 0;
		font-size: clamp(0.95rem, 3vw, 1.35rem);
		font-weight: 800;
		color: var(--dp-ink-soft);
	}

	/* A CSS Bubu, so the menu has a character before WebGL even starts. */
	.bubu {
		position: relative;
		width: 96px;
		height: 96px;
		margin: 0.2rem 0 0.4rem;
		animation: bob 2.4s ease-in-out infinite;
	}
	@keyframes bob {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-8px);
		}
	}
	.bubu-head {
		position: absolute;
		left: 50%;
		top: 22px;
		width: 76px;
		height: 66px;
		margin-left: -38px;
		border-radius: 50%;
		background: #fdf6ee;
		box-shadow: inset 0 -8px 0 #efe2d2;
	}
	.bubu-body {
		position: absolute;
		left: 50%;
		bottom: 0;
		width: 62px;
		height: 44px;
		margin-left: -31px;
		border-radius: 50%;
		background: #fdf6ee;
		box-shadow: inset 0 -6px 0 #efe2d2;
	}
	.bubu-ear {
		position: absolute;
		width: 18px;
		height: 46px;
		border-radius: 12px;
		background: #fdf6ee;
		top: -14px;
		box-shadow: inset 0 4px 0 #ffb3c7;
	}
	.bubu-ear.left {
		left: 22px;
		transform: rotate(-12deg);
	}
	.bubu-ear.right {
		right: 22px;
		transform: rotate(12deg);
	}
	.eye {
		position: absolute;
		top: 24px;
		width: 10px;
		height: 12px;
		border-radius: 50%;
		background: #2b2230;
	}
	.eye.left {
		left: 18px;
	}
	.eye.right {
		right: 18px;
	}
	.nose {
		position: absolute;
		left: 50%;
		top: 40px;
		width: 10px;
		height: 8px;
		margin-left: -5px;
		border-radius: 50%;
		background: #ff8fa8;
	}

	.play {
		font-size: clamp(1.8rem, 6vw, 2.8rem);
		padding: 0 3rem;
		min-height: clamp(84px, 13vh, 110px);
		background: linear-gradient(180deg, #67d97f, var(--dp-green-deep));
		animation: pulse 2.6s ease-in-out infinite;
	}
	.play-icon {
		font-size: 0.8em;
	}
	@keyframes pulse {
		0%,
		100% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.035);
		}
	}

	.areas {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: clamp(0.5rem, 1.6vw, 1rem);
		max-width: 820px;
	}
	.area {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		min-width: 108px;
		min-height: var(--dp-target);
		padding: 0.7rem 0.9rem;
		border-radius: var(--dp-radius-sm);
		background: #fff;
		box-shadow: var(--dp-shadow-sm);
		border-bottom: 6px solid var(--c);
	}
	.area:hover {
		transform: translateY(-3px);
	}
	.area-icon {
		font-size: clamp(1.7rem, 5vw, 2.3rem);
		line-height: 1;
	}
	.area-name {
		font-size: clamp(0.68rem, 2vw, 0.82rem);
		font-weight: 900;
		color: var(--dp-ink);
		text-align: center;
		max-width: 110px;
	}

	.parent-link {
		margin-top: 0.3rem;
		min-height: 48px;
		padding: 0 1.2rem;
		border-radius: 999px;
		font-size: 0.95rem;
		font-weight: 800;
		color: var(--dp-ink-soft);
		background: rgba(255, 255, 255, 0.7);
	}

	@media (max-height: 640px) {
		.bubu {
			display: none;
		}
		.tagline {
			display: none;
		}
	}
</style>
