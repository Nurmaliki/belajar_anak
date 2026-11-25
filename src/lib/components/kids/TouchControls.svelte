<script lang="ts">
	/**
	 * On-screen touch controls: joystick plus jump.
	 *
	 * The interact button is deliberately omitted while a mission is running:
	 * in a mission the child taps the apples directly, and a stray interact
	 * button would just pick whatever is under the crosshair.
	 */
	import VirtualJoystick from './VirtualJoystick.svelte';

	interface Props {
		onjoystick: (x: number, y: number) => void;
		onjump: () => void;
		oninteract: () => void;
		disabled?: boolean;
		showInteract?: boolean;
	}

	let { onjoystick, onjump, oninteract, disabled = false, showInteract = true }: Props = $props();
</script>

<div class="touch" class:disabled>
	<div class="stick">
		<VirtualJoystick onchange={onjoystick} {disabled} />
	</div>
	<div class="actions">
		{#if showInteract}
			<button class="dp-btn dp-btn--green action" onclick={oninteract} aria-label="Ambil">
				<span aria-hidden="true">✋</span>
			</button>
		{/if}
		<button class="dp-btn dp-btn--blue action" onclick={onjump} aria-label="Lompat">
			<span aria-hidden="true">⬆️</span>
		</button>
	</div>
</div>

<style>
	.touch {
		position: absolute;
		inset: auto 0 0 0;
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		padding: clamp(0.8rem, 3vw, 1.8rem);
		padding-bottom: max(clamp(0.8rem, 3vw, 1.8rem), env(safe-area-inset-bottom));
		pointer-events: none;
		z-index: 10;
	}
	.touch.disabled {
		opacity: 0.35;
	}
	.stick,
	.actions {
		pointer-events: auto;
	}
	.actions {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		align-items: flex-end;
	}
	.action {
		width: clamp(68px, 15vw, 88px);
		height: clamp(68px, 15vw, 88px);
		min-width: clamp(68px, 15vw, 88px);
		font-size: clamp(1.6rem, 5vw, 2rem);
	}
</style>
