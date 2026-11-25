<script lang="ts">
	/**
	 * The dressing-up box.
	 *
	 * A wardrobe, not a prize shelf. Every accessory is offered from the first
	 * launch, with no lock, price or progress bar — a child who cannot read
	 * sees only pictures of hats they may put on right now.
	 *
	 * The star count is shown as a *record* of what they have done, never as a
	 * total to reach. That distinction is the whole point: see
	 * `data/accessories.ts` and `AGENTS.md`.
	 */
	import { ACCESSORIES, NO_ACCESSORY, type AccessorySlot } from '#lib/kids/data/accessories';

	interface Props {
		/** The accessory the engine says is on, by id. */
		wearing: string;
		/** Stars earned, shown as a keepsake count. */
		stars: number;
		onwear: (id: string) => void;
		onclose: () => void;
	}

	let { wearing, stars, onwear, onclose }: Props = $props();

	const SLOTS: { id: AccessorySlot; label: string }[] = [
		{ id: 'head', label: 'Kepala' },
		{ id: 'neck', label: 'Leher' },
		{ id: 'back', label: 'Punggung' }
	];

	/** Accessories grouped by slot, so the picker reads in short rows. */
	const bySlot = $derived(
		SLOTS.map((slot) => ({
			...slot,
			items: ACCESSORIES.filter((a) => a.slot === slot.id)
		}))
	);

	function choose(id: string): void {
		onwear(id);
	}
</script>

<div class="wardrobe-backdrop" role="presentation" onclick={onclose}></div>

<div
	class="wardrobe"
	role="dialog"
	aria-modal="true"
	aria-labelledby="wardrobe-title"
	tabindex="-1"
	onkeydown={(e) => e.key === 'Escape' && onclose()}
>
	<header class="wardrobe-head">
		<h2 id="wardrobe-title">Lemari Bubu</h2>
		<span class="stars" aria-label="{stars} bintang terkumpul">⭐ {stars}</span>
		<button class="dp-btn dp-btn--ghost dp-btn--round close" onclick={onclose} aria-label="Tutup lemari">
			<span aria-hidden="true">✕</span>
		</button>
	</header>

	<p class="lede">Pilih apa saja! Semua boleh dipakai kapan saja.</p>

	{#each bySlot as slot (slot.id)}
		<div class="slot-row">
			<h3 class="slot-label">{slot.label}</h3>
			<div class="items" role="group" aria-label="Aksesori untuk {slot.label.toLowerCase()}">
				{#if slot.id === 'head'}
					<!-- "Nothing on the head" belongs beside the hats. -->
					<button
						class="item item--none"
						class:active={wearing === NO_ACCESSORY}
						aria-pressed={wearing === NO_ACCESSORY}
						onclick={() => choose(NO_ACCESSORY)}
					>
						<span class="glyph" aria-hidden="true">🚫</span>
						<span class="name">Tanpa</span>
					</button>
				{/if}
				{#each slot.items as item (item.id)}
					<button
						class="item"
						class:active={wearing === item.id}
						aria-pressed={wearing === item.id}
						title={item.description}
						onclick={() => choose(item.id)}
					>
						<span class="glyph" aria-hidden="true">{item.icon}</span>
						<span class="name">{item.name}</span>
					</button>
				{/each}
			</div>
		</div>
	{/each}
</div>

<style>
	.wardrobe-backdrop {
		position: absolute;
		inset: 0;
		background: rgba(30, 20, 40, 0.35);
		z-index: 30;
		animation: fade-in 160ms ease both;
	}
	@keyframes fade-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	.wardrobe {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		width: min(620px, 94vw);
		max-height: min(84vh, 640px);
		overflow-y: auto;
		z-index: 31;
		background: rgba(255, 250, 242, 0.98);
		border-radius: var(--dp-radius);
		box-shadow: var(--dp-shadow);
		padding: clamp(0.9rem, 3vw, 1.4rem);
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		animation: rise 260ms cubic-bezier(0.2, 1.3, 0.4, 1) both;
	}
	@keyframes rise {
		from {
			opacity: 0;
			transform: translate(-50%, calc(-50% + 18px)) scale(0.96);
		}
		to {
			opacity: 1;
			transform: translate(-50%, -50%) scale(1);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.wardrobe,
		.wardrobe-backdrop {
			animation: none;
		}
	}
	.wardrobe-head {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	h2 {
		margin: 0;
		flex: 1 1 auto;
		font-size: clamp(1.1rem, 4vw, 1.5rem);
		font-weight: 900;
		color: var(--dp-ink);
	}
	.stars {
		font-weight: 900;
		color: var(--dp-ink-soft);
		white-space: nowrap;
	}
	.close {
		width: 56px;
		height: 56px;
		min-width: 56px;
		font-size: 1.2rem;
		flex: none;
	}
	.lede {
		margin: 0;
		font-size: clamp(0.85rem, 2.8vw, 1rem);
		font-weight: 700;
		color: var(--dp-ink-soft);
	}
	.slot-label {
		margin: 0 0 0.35rem;
		font-size: 0.78rem;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: #8b7f70;
	}
	.items {
		display: flex;
		flex-wrap: wrap;
		gap: clamp(0.4rem, 1.6vw, 0.7rem);
	}
	/* Targets are at least 72 px: a whole hand, not a fingertip. */
	.item {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.15rem;
		min-width: 76px;
		min-height: 76px;
		padding: 0.45rem 0.6rem;
		border-radius: var(--dp-radius-sm);
		background: linear-gradient(180deg, #ffffff, #fff0d8);
		box-shadow: var(--dp-shadow-sm);
		border-bottom: 5px solid var(--dp-orange);
		cursor: pointer;
		transition: transform 140ms ease;
	}
	.item:hover {
		transform: translateY(-2px);
	}
	.item:active {
		transform: scale(0.97);
	}
	.item.active {
		background: linear-gradient(180deg, #b6ffc4, #7ee29a);
		border-bottom-color: var(--dp-green-deep);
		box-shadow:
			0 0 0 4px rgba(79, 194, 107, 0.35),
			var(--dp-shadow-sm);
	}
	.item--none {
		background: linear-gradient(180deg, #ffffff, #eee6da);
		border-bottom-color: #b8ab98;
	}
	.glyph {
		font-size: clamp(1.6rem, 6vw, 2.1rem);
		line-height: 1;
	}
	.name {
		font-size: 0.72rem;
		font-weight: 800;
		color: var(--dp-ink);
		text-align: center;
	}
</style>
