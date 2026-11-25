<script lang="ts">
	/**
	 * In-game HUD.
	 *
	 * Kept to the four things a child needs: where they are, how many stars they
	 * have, and buttons to hear the instruction again and to leave. Every
	 * control is icon-first, since the player probably cannot read.
	 */
	interface Props {
		stars: number;
		areaName: string | null;
		missionTitle: string | null;
		soundOn: boolean;
		onreplay: () => void;
		onhelp: () => void;
		onexit: () => void;
		ontogglesound: () => void;
		/** Open the dressing-up box. Always available, never gated. */
		onwardrobe: () => void;
	}

	let {
		stars,
		areaName,
		missionTitle,
		soundOn,
		onreplay,
		onhelp,
		onexit,
		ontogglesound,
		onwardrobe
	}: Props = $props();
</script>

<div class="hud">
	<div class="hud-left">
		<button class="dp-btn dp-btn--ghost dp-btn--round hud-btn" onclick={onexit} aria-label="Keluar">
			<span aria-hidden="true">🏠</span>
		</button>
		<button
			class="dp-btn dp-btn--ghost dp-btn--round hud-btn"
			onclick={ontogglesound}
			aria-label={soundOn ? 'Matikan suara' : 'Nyalakan suara'}
			aria-pressed={soundOn}
		>
			<span aria-hidden="true">{soundOn ? '🔊' : '🔇'}</span>
		</button>
		<button
			class="dp-btn dp-btn--ghost dp-btn--round hud-btn"
			onclick={onwardrobe}
			aria-label="Lemari Bubu"
		>
			<span aria-hidden="true">👒</span>
		</button>
	</div>

	<div class="hud-center">
		{#if areaName || missionTitle}
			<div class="chip">
				{#if areaName}<span class="chip-area">{areaName}</span>{/if}
				{#if missionTitle}<span class="chip-mission">{missionTitle}</span>{/if}
			</div>
		{/if}
	</div>

	<div class="hud-right">
		<div class="star-chip" aria-label="Bintang: {stars}">
			<span aria-hidden="true">⭐</span>
			<span>{stars}</span>
		</div>
		<button
			class="dp-btn dp-btn--ghost dp-btn--round hud-btn"
			onclick={onreplay}
			aria-label="Dengar lagi"
		>
			<span aria-hidden="true">🔁</span>
		</button>
		<button class="dp-btn dp-btn--ghost dp-btn--round hud-btn" onclick={onhelp} aria-label="Bantuan">
			<span aria-hidden="true">❓</span>
		</button>
	</div>
</div>

<style>
	.hud {
		position: absolute;
		inset: 0 0 auto 0;
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.6rem;
		padding: clamp(0.6rem, 2vw, 1.1rem);
		pointer-events: none;
		z-index: 20;
	}
	.hud-left,
	.hud-right {
		display: flex;
		gap: 0.5rem;
		pointer-events: auto;
	}
	.hud-center {
		flex: 1;
		display: flex;
		justify-content: center;
		pointer-events: none;
	}
	.hud-btn {
		font-size: 1.5rem;
		width: clamp(56px, 9vw, 68px);
		height: clamp(56px, 9vw, 68px);
		min-width: clamp(56px, 9vw, 68px);
	}
	.star-chip {
		display: flex;
		align-items: center;
		gap: 0.3em;
		padding: 0 1em;
		min-height: clamp(56px, 9vw, 68px);
		border-radius: 999px;
		background: rgba(255, 250, 242, 0.96);
		box-shadow: var(--dp-shadow-sm);
		font-size: clamp(1.2rem, 4vw, 1.7rem);
		font-weight: 900;
		pointer-events: auto;
	}
	.chip {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.1rem;
		padding: 0.5rem 1.3rem;
		border-radius: 999px;
		background: rgba(47, 36, 64, 0.62);
		backdrop-filter: blur(6px);
		color: #fff;
		text-align: center;
		max-width: min(60vw, 520px);
	}
	.chip-area {
		font-size: clamp(0.8rem, 2.4vw, 1rem);
		font-weight: 800;
		opacity: 0.9;
	}
	.chip-mission {
		font-size: clamp(0.95rem, 3vw, 1.3rem);
		font-weight: 900;
	}
	@media (max-width: 480px) {
		.chip-area {
			display: none;
		}
	}
</style>
