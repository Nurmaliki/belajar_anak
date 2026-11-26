<script lang="ts">
	/**
	 * The mission panel.
	 *
	 * Shows three things without words: how far along the child is, whether to
	 * keep collecting or answer, and which answer was chosen.
	 *
	 * Two shapes share this panel, decided by `view.mission.kind`:
	 *  - **Counting** shows apples as progress dots and number buttons, each
	 *    carrying a numeral *and* that many pips, so "3" is readable as a
	 *    quantity by a child who does not know digits yet.
	 *  - **Questions** (letter, syllable, picture) show the prompt large and
	 *    the choices as big labelled buttons, because there is nothing to
	 *    collect and the whole task is picking the right one.
	 */
	import type { MissionPanelView } from '#lib/kids/ui/GameUI.svelte';
	import { numberWord } from '#lib/kids/data/numbers';
	import { COLORS } from '#lib/kids/data/colors';

	interface Props {
		view: MissionPanelView;
		onanswer: (value: string) => void;
		onreplay: () => void;
	}

	let { view, onanswer, onreplay }: Props = $props();

	const isCounting = $derived(view.mission.kind === 'count-and-answer');
	const isBuilding = $derived(view.mission.kind === 'assemble-word');
	const isAdding = $derived(view.mission.kind === 'add-groups');
	const isSubtracting = $derived(view.mission.kind === 'subtract-groups');
	const isComparing = $derived(view.mission.kind === 'compare-groups');
	const isSorting = $derived(view.mission.kind === 'sort-groups');
	const isBySound = $derived(view.mission.kind === 'pick-by-sound');
	const isPattern = $derived(view.mission.kind === 'continue-pattern');
	const isPitch = $derived(view.mission.kind === 'compare-pitch');
	const dots = $derived(Array.from({ length: view.total }, (_, i) => i < view.collected));
	const showAnswers = $derived(!isCounting || view.canAnswer || view.feedback !== null);
	const progressPct = $derived(Math.round((view.collected / Math.max(1, view.total)) * 100));

	/** Slots for an assemble-word mission: filled ones, then empty ones. */
	const slots = $derived(view.slots ?? []);
	const placed = $derived(view.placed ?? []);

	/** The line being built in a sort mission, and how many slots it holds. */
	const sorted = $derived(view.sorted ?? []);
	const sortSlots = $derived(view.sort ?? []);

	/**
	 * Groups still waiting to be placed, in the order the mission offers them.
	 *
	 * A size already placed disappears from the choices, so the child never
	 * taps the same pile twice and the remaining decision stays small.
	 */
	const sortChoices = $derived((view.mission.choices ?? []).filter((c) => !sorted.includes(Number(c))));

	/**
	 * What to print in the prompt area. Explicit data on the mission, never a
	 * guess from its title — the panel has no business inferring content.
	 */
	const prompt = $derived(view.mission.prompt ?? { icon: '❓', caption: '' });

	/** The starting group of a subtraction, split into the ones that stay and
	 *  the ones that leave. Drawing both is what makes the question sensible
	 *  without the minus sign. */
	const subStart = $derived(view.subtract?.start ?? 0);
	const subRemoved = $derived(view.subtract?.removed ?? 0);
	const subStays = $derived(Math.max(0, subStart - subRemoved));

	/** The accessible name for an answer button. */
	function label(choice: string): string {
		if (isCounting) return `${choice}, ${numberWord(Number(choice))}`;
		return choice;
	}

	/**
	 * The CSS colour behind a colour name, for pattern swatches.
	 *
	 * Looks the name up in the same catalogue the missions were built from, so a
	 * renamed colour shows up as the right swatch rather than a mystery blob.
	 * An unknown name renders neutral grey instead of throwing, because a
	 * washed-out swatch is a cosmetic bug and a crash is not.
	 */
	function swatch(name: string): string {
		const entry = COLORS.find((c) => c.name === name);
		return entry ? `#${entry.hex.toString(16).padStart(6, '0')}` : '#c9c2d4';
	}

	/** The items a pattern shows, then one empty slot where the answer goes. */
	const patternShown = $derived(view.shown ?? []);
</script>

<div class="mission">
	<div class="card" class:correct={view.feedback === 'correct'} class:wrong={view.feedback === 'wrong'}>
		<div class="head">
			<h2 class="title">{view.mission.title}</h2>
			<button class="dp-btn dp-btn--ghost dp-btn--round listen" onclick={onreplay} aria-label="Dengar lagi">
				<span aria-hidden="true">🔊</span>
			</button>
		</div>

		{#if isCounting}
			<!-- Progress as dots: a child counts filled circles without reading. -->
			<div class="dots" role="img" aria-label="{view.collected} dari {view.total} apel terkumpul">
				{#each dots as filled, i (i)}
					<span class="dot" class:filled style="transition-delay:{i * 40}ms" aria-hidden="true">🍎</span>
				{/each}
			</div>
			<div class="bar" aria-hidden="true"><span style="width:{progressPct}%"></span></div>

			{#if !showAnswers}
				<p class="hint">Ketuk apel untuk menghitung</p>
			{:else}
				<div class="answers" role="group" aria-label="Pilih jumlah apel">
					{#each view.mission.choices as choice, i (choice)}
						{@const isWrong = view.wrongChoices.includes(choice)}
						<button
							class="answer"
							class:chosen={view.selected === choice && view.feedback === 'correct'}
							class:rejected={isWrong && view.feedback !== 'correct'}
							disabled={view.feedback === 'correct'}
							onclick={() => onanswer(choice)}
							aria-label={label(choice)}
							style="--i:{i}"
						>
							<span class="num">{choice}</span>
							<span class="pips" aria-hidden="true">
								{#each Array(Math.min(Number(choice), 5)) as _, k (k)}
									<span class="pip"></span>
								{/each}
							</span>
						</button>
					{/each}
				</div>
			{/if}
		{:else if isBySound}
			<!--
				A question asked by ear: one big speaker, no picture. The buttons
				stay disabled until the cry has actually played, so a child who
				tapped into silence is asked again rather than marked wrong.
				Showing the animal here would be the one thing that ruins it.
			-->
			<button
				class="speaker"
				class:heard={view.soundHeard}
				onclick={onreplay}
				aria-label="Dengarkan suara hewan lagi"
			>
				<span class="speaker-icon" aria-hidden="true">{view.soundHeard ? '🔊' : '👂'}</span>
				<span class="speaker-text">
					{view.soundHeard ? 'Dengarkan lagi' : 'Dengarkan suaranya…'}
				</span>
			</button>
			<div class="answers answers--words" role="group" aria-label="Pilih hewan yang bersuara">
				{#each view.mission.choices as choice, k (choice)}
					{@const isWrong = view.wrongChoices.includes(choice)}
					<button
						class="answer answer--word"
						class:chosen={view.selected === choice && view.feedback === 'correct'}
						class:rejected={isWrong && view.feedback !== 'correct'}
						disabled={!view.soundHeard || view.feedback === 'correct'}
						onclick={() => onanswer(choice)}
						aria-label={choice}
						style="--i:{k}"
					>
						<span class="word">{choice}</span>
					</button>
				{/each}
			</div>
		{:else if isPattern}
			<!--
				A repeating sequence with one slot left blank. The swatches use the
				same colours as the answer buttons, so the rule is visible without
				any reading: red, yellow, red, yellow, red, ?
			-->
			<div class="pattern" role="img" aria-label="Pola warna, satu warna belum terisi">
				{#each patternShown as name, i (i)}
					<span class="swatch" style="--sw:{swatch(name)}" aria-hidden="true"></span>
				{/each}
				<span class="swatch swatch--gap" aria-hidden="true">?</span>
			</div>
			<div class="answers answers--words" role="group" aria-label="Pilih warna berikutnya">
				{#each view.mission.choices as choice, k (choice)}
					{@const isWrong = view.wrongChoices.includes(choice)}
					<button
						class="answer answer--word answer--swatch"
						class:chosen={view.selected === choice && view.feedback === 'correct'}
						class:rejected={isWrong && view.feedback !== 'correct'}
						disabled={view.feedback === 'correct'}
						onclick={() => onanswer(choice)}
						aria-label={choice}
						style="--i:{k};--sw:{swatch(choice)}"
					>
						<span class="chip" aria-hidden="true"></span>
						<span class="word">{choice}</span>
					</button>
				{/each}
			</div>
		{:else if isPitch}
			<!--
				Two tones, one question. The buttons stay locked until *both*
				notes have played — a comparison needs two things to compare,
				and a child who heard one note has not been asked anything.
				The panel shows how many are done so the wait is visible.
			-->
			<button
				class="speaker"
				class:heard={view.pitchReady}
				onclick={onreplay}
				aria-label="Dengarkan dua nada lagi"
			>
				<span class="speaker-icon" aria-hidden="true">{view.pitchReady ? '🎵' : '👂'}</span>
				<span class="speaker-text">
					{view.pitchReady ? 'Dengarkan lagi' : 'Dengarkan nadanya…'}
				</span>
			</button>
			<div class="pitch-dots" role="img" aria-label="{view.pitchHeard ?? 0} dari 2 nada sudah dimainkan">
				{#each [0, 1] as i (i)}
					<span
						class="pitch-dot"
						class:played={(view.pitchHeard ?? 0) > i}
						style="--h:{i === 0 ? 0.45 : 1}"
						aria-hidden="true"
					></span>
				{/each}
			</div>
			<div class="answers answers--words" role="group" aria-label="Pilih nada yang lebih tinggi atau rendah">
				{#each view.mission.choices as choice, k (choice)}
					{@const isWrong = view.wrongChoices.includes(choice)}
					<button
						class="answer answer--word"
						class:chosen={view.selected === choice && view.feedback === 'correct'}
						class:rejected={isWrong && view.feedback !== 'correct'}
						disabled={!view.pitchReady || view.feedback === 'correct'}
						onclick={() => onanswer(choice)}
						aria-label={choice}
						style="--i:{k}"
					>
						<span class="word">{choice}</span>
					</button>
				{/each}
			</div>
		{:else if isComparing}
			<!-- Two groups, both tappable. The child answers by pointing at
			     objects, so no number reading is required. -->
			<div class="compare" role="group" aria-label="Pilih kelompok apel">
				{#each ['left', 'right'] as side, s (side)}
					{@const count = side === 'left' ? (view.compare?.left ?? 0) : (view.compare?.right ?? 0)}
					{@const isWrong = view.wrongChoices.includes(side)}
					<button
						class="compare-group"
						class:chosen={view.feedback === 'correct'}
						class:rejected={isWrong && view.feedback !== 'correct'}
						disabled={view.feedback === 'correct'}
						onclick={() => onanswer(side)}
						aria-label="{side === 'left' ? 'Kelompok kiri' : 'Kelompok kanan'}, {count} apel"
						style="--i:{s}"
					>
						{#each Array(count) as _, i (i)}
							<span class="obj" aria-hidden="true">🍎</span>
						{/each}
					</button>
				{/each}
			</div>
		{:else if isSorting}
			<!-- Sort: the line being built, then the piles still to place.
			     Fewest first, and only the next slot can be filled. -->
			<div class="sorted" role="img" aria-label="{sorted.length} dari {sortSlots.length} kelompok sudah diurutkan">
				{#each sortSlots as _, i (i)}
					<span class="sort-slot" class:filled={i < sorted.length}>
						{#if i < sorted.length}
							{#each Array(sorted[i]) as _, k (k)}
								<span class="obj" aria-hidden="true">🍎</span>
							{/each}
						{:else}
							<span class="sort-dot" aria-hidden="true">·</span>
						{/if}
					</span>
				{/each}
			</div>
			<div class="compare" role="group" aria-label="Pilih kelompok yang paling sedikit">
				{#each sortChoices as choice, s (choice)}
					{@const count = Number(choice)}
					{@const isWrong = view.wrongChoices.includes(choice)}
					<button
						class="compare-group"
						class:chosen={view.feedback === 'correct'}
						class:rejected={isWrong && view.feedback !== 'correct'}
						disabled={view.feedback === 'correct'}
						onclick={() => onanswer(choice)}
						aria-label="{count} apel"
						style="--i:{s}"
					>
						{#each Array(count) as _, i (i)}
							<span class="obj" aria-hidden="true">🍎</span>
						{/each}
					</button>
				{/each}
			</div>
		{:else if isAdding}
			<!-- Two countable groups and a plus sign. A child adds by counting
			     objects, not by reading digits. -->
			<div class="add" role="img" aria-label="{view.addends?.[0]} tambah {view.addends?.[1]}">
				<span class="group" aria-hidden="true">
					{#each Array(view.addends?.[0] ?? 0) as _, i (i)}
						<span class="obj">🍎</span>
					{/each}
				</span>
				<span class="plus" aria-hidden="true">+</span>
				<span class="group" aria-hidden="true">
					{#each Array(view.addends?.[1] ?? 0) as _, i (i)}
						<span class="obj">🍎</span>
					{/each}
				</span>
			</div>
			<div class="answers" role="group" aria-label="Pilih jumlah semua apel">
				{#each view.mission.choices as choice, k (choice)}
					{@const isWrong = view.wrongChoices.includes(choice)}
					<button
						class="answer"
						class:chosen={view.selected === choice && view.feedback === 'correct'}
						class:rejected={isWrong && view.feedback !== 'correct'}
						disabled={view.feedback === 'correct'}
						onclick={() => onanswer(choice)}
						aria-label="{choice}, {numberWord(Number(choice))}"
						style="--i:{k}"
					>
						<span class="num">{choice}</span>
						<span class="pips" aria-hidden="true">
							{#each Array(Math.min(Number(choice), 5)) as _, p (p)}
								<span class="pip"></span>
							{/each}
						</span>
					</button>
				{/each}
			</div>
		{:else if isSubtracting}
			<!-- Some apples stay, some are crossed out and carried away. A child
			     answers by counting what is left, not by reading a minus sign. -->
			<div
				class="take-away"
				role="img"
				aria-label="Ada {subStart} apel, {subRemoved} diambil, sisa {subStays} apel"
			>
				{#each Array(subStays) as _, i (i)}
					<span class="obj" aria-hidden="true">🍎</span>
				{/each}
				{#each Array(subRemoved) as _, i (i)}
					<span class="obj gone" aria-hidden="true">🍎</span>
				{/each}
			</div>
			<div class="answers" role="group" aria-label="Pilih jumlah apel yang tersisa">
				{#each view.mission.choices as choice, k (choice)}
					{@const isWrong = view.wrongChoices.includes(choice)}
					<button
						class="answer"
						class:chosen={view.selected === choice && view.feedback === 'correct'}
						class:rejected={isWrong && view.feedback !== 'correct'}
						disabled={view.feedback === 'correct'}
						onclick={() => onanswer(choice)}
						aria-label="{choice}, {numberWord(Number(choice))}"
						style="--i:{k}"
					>
						<span class="num">{choice}</span>
						<span class="pips" aria-hidden="true">
							{#each Array(Math.min(Number(choice), 5)) as _, p (p)}
								<span class="pip"></span>
							{/each}
						</span>
					</button>
				{/each}
			</div>
		{:else if isBuilding}
			<!-- Assemble a word: one slot per syllable, filled left to right. -->
			<div class="prompt" role="img" aria-label="Susun kata {view.mission.title}">
				<span class="prompt-icon" aria-hidden="true">{view.mission.prompt?.icon ?? '📖'}</span>
			</div>
			<div class="slots" role="img" aria-label="{placed.length} dari {slots.length} suku kata terisi">
				{#each slots as _, i (i)}
					<span class="slot" class:filled={i < placed.length}>
						{placed[i] ?? '·'}
					</span>
				{/each}
			</div>
			<div class="answers answers--words" role="group" aria-label="Pilih suku kata">
				{#each view.mission.choices as choice, k (choice)}
					{@const isWrong = view.wrongChoices.includes(choice)}
					<button
						class="answer answer--word"
						class:chosen={view.feedback === 'correct' && placed.includes(choice)}
						class:rejected={isWrong && view.feedback !== 'correct'}
						disabled={view.feedback === 'correct'}
						onclick={() => onanswer(choice)}
						aria-label={choice}
						style="--i:{k}"
					>
						<span class="word">{choice}</span>
					</button>
				{/each}
			</div>
		{:else}
			<!-- Question missions: one large prompt, then the choices. -->
			{@const shape = prompt.caption.startsWith('@shape:') ? prompt.caption.slice(7) : null}
			{@const isSwatch = prompt.caption.startsWith('#')}
			<div
				class="prompt"
				role="img"
				aria-label={shape
					? 'Gambar bentuk'
					: isSwatch
						? 'Contoh warna'
						: prompt.caption || view.mission.title}
			>
				{#if shape}
					<!-- Drawn, not emoji: an emoji square is blue and an emoji
					     triangle is red, so colour fights the shape being asked
					     about. One flat tone, one outline. -->
					<span class="prompt-shape" data-shape={shape} aria-hidden="true"></span>
				{:else}
					<span
						class="prompt-icon"
						class:swatch={isSwatch}
						style={isSwatch ? `--swatch:${prompt.caption}` : ''}
						aria-hidden="true"
					>
						{isSwatch ? '' : prompt.icon}
					</span>
					{#if prompt.caption && !isSwatch}
						<span class="prompt-caption" aria-hidden="true">{prompt.caption}</span>
					{/if}
				{/if}
			</div>
			<div class="answers answers--words" role="group" aria-label="Pilih jawaban">
				{#each view.mission.choices as choice, i (choice)}
					{@const isWrong = view.wrongChoices.includes(choice)}
					<button
						class="answer answer--word"
						class:chosen={view.selected === choice && view.feedback === 'correct'}
						class:rejected={isWrong && view.feedback !== 'correct'}
						disabled={view.feedback === 'correct'}
						onclick={() => onanswer(choice)}
						aria-label={label(choice)}
						style="--i:{i}"
					>
						<span class="word">{choice}</span>
					</button>
				{/each}
			</div>
		{/if}

		<!--
			Feedback covers the card rather than sitting beside it.

			It is a full-size layer so nothing underneath can be tapped while
			the child is being told the answer — including the answer buttons
			themselves. Without it, a quick hand can fire a second tap at the
			moment the panel re-renders, and the panel swaps layout
			mid-gesture, which reads to a browser as the element vanishing.
		-->
		{#if view.feedback !== null}
			<div
				class="feedback"
				class:ok={view.feedback === 'correct'}
				class:no={view.feedback === 'wrong'}
				role="status"
				aria-live="polite"
			>
				<span class="feedback-icon" aria-hidden="true">{view.feedback === 'correct' ? '⭐' : '🙂'}</span>
				<span class="feedback-text">
					{view.feedback === 'correct' ? 'Hebat!' : 'Coba lagi, ya!'}
				</span>
			</div>
		{/if}
	</div>
</div>

<style>
	.mission {
		position: absolute;
		left: 50%;
		bottom: clamp(0.8rem, 3vh, 2rem);
		transform: translateX(-50%);
		width: min(680px, 94vw);
		pointer-events: none;
		z-index: 15;
		/* The card rises into place when a mission starts, so a child looking
		   at the world notices that something new is asking for their
		   attention. Movement, not decoration: no motion without meaning. */
		animation: card-in 340ms cubic-bezier(0.2, 1.25, 0.4, 1) both;
	}
	@keyframes card-in {
		from {
			opacity: 0;
			transform: translate(-50%, 26px) scale(0.94);
		}
		to {
			opacity: 1;
			transform: translate(-50%, 0) scale(1);
		}
	}
	/* A repeat visit to the same game should feel like a fresh start, so the
	   card settles rather than sitting perfectly still. Any child who has
	   asked their device for less motion keeps a plain, instant panel. */
	@media (prefers-reduced-motion: reduce) {
		.mission {
			animation: none;
		}
	}
	.card {
		pointer-events: auto;
		/* Anchors the feedback layer below. */
		position: relative;
		background: rgba(255, 250, 242, 0.97);
		border-radius: var(--dp-radius);
		box-shadow: var(--dp-shadow);
		padding: clamp(0.8rem, 2.4vw, 1.3rem);
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		transition: background 200ms ease;
	}
	.card.correct {
		background: #e8ffe9;
		animation: celebrate-pop 460ms cubic-bezier(0.2, 1.6, 0.4, 1) both;
	}
	@keyframes celebrate-pop {
		0% {
			transform: scale(1);
		}
		45% {
			transform: scale(1.035);
			box-shadow:
				0 0 0 8px rgba(79, 194, 107, 0.3),
				var(--dp-shadow);
		}
		100% {
			transform: scale(1);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.card.correct {
			animation: none;
		}
	}
	.card.wrong {
		animation: shake 420ms ease;
	}
	@keyframes shake {
		0%,
		100% {
			transform: translateX(0);
		}
		20% {
			transform: translateX(-10px);
		}
		40% {
			transform: translateX(9px);
		}
		60% {
			transform: translateX(-6px);
		}
		80% {
			transform: translateX(4px);
		}
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
	}
	.title {
		margin: 0;
		font-size: clamp(1.05rem, 3.6vw, 1.5rem);
		font-weight: 900;
		color: var(--dp-ink);
	}
	.listen {
		width: 56px;
		height: 56px;
		min-width: 56px;
		font-size: 1.35rem;
		flex: none;
	}
	.dots {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		justify-content: center;
	}
	.dot {
		font-size: clamp(1.4rem, 5vw, 2rem);
		line-height: 1;
		filter: grayscale(1);
		opacity: 0.28;
		transform: scale(0.85);
		transition:
			opacity 200ms ease,
			transform 260ms cubic-bezier(0.2, 1.6, 0.4, 1),
			filter 200ms ease;
	}
	.dot.filled {
		filter: none;
		opacity: 1;
		transform: scale(1);
	}
	.bar {
		height: 12px;
		border-radius: 999px;
		background: #e6dccb;
		overflow: hidden;
	}
	.bar span {
		display: block;
		height: 100%;
		border-radius: 999px;
		background: linear-gradient(90deg, var(--dp-yellow), var(--dp-orange));
		transition: width 260ms ease;
	}
	.hint {
		margin: 0;
		text-align: center;
		font-size: clamp(0.85rem, 2.8vw, 1.05rem);
		font-weight: 800;
		color: var(--dp-ink-soft);
	}
	.prompt {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.1rem 0 0.3rem;
	}
	.prompt-icon {
		font-size: clamp(2.6rem, 11vw, 4rem);
		line-height: 1;
	}
	/* Two tappable groups; each button *is* the group. Targets stay large
	   enough to hit with a whole hand. */
	.compare {
		display: flex;
		gap: clamp(0.5rem, 2vw, 1rem);
		justify-content: center;
		align-items: stretch;
		width: 100%;
	}
	.compare-group {
		flex: 1 1 0;
		min-height: 84px;
		display: flex;
		flex-wrap: wrap;
		align-content: center;
		justify-content: center;
		gap: 0.15rem;
		padding: 0.6rem 0.5rem;
		background: #fff2d6;
		border: 3px dashed #e8c98a;
		border-radius: var(--dp-radius-sm);
		cursor: pointer;
		transition:
			transform 160ms ease,
			border-color 160ms ease;
	}
	.compare-group:not(:disabled):active {
		transform: scale(0.97);
	}
	.compare-group.chosen {
		border-style: solid;
		border-color: var(--dp-green-deep);
	}
	.compare-group.rejected {
		animation: shake 420ms ease;
		border-color: var(--dp-orange);
	}
	.compare-group .obj {
		font-size: clamp(1.1rem, 4vw, 1.5rem);
	}

	/* The line built by a sort mission, fewest pile first. Each slot shows the
	   actual apples, so the order is readable without digits. */
	.sorted {
		display: flex;
		flex-wrap: wrap;
		gap: clamp(0.3rem, 1.5vw, 0.6rem);
		justify-content: center;
		align-items: stretch;
		padding: 0.2rem 0;
	}
	.sort-slot {
		display: flex;
		flex-wrap: wrap;
		align-content: center;
		justify-content: center;
		gap: 0.1rem;
		min-width: clamp(48px, 11vw, 66px);
		min-height: 56px;
		padding: 0.3rem 0.4rem;
		border-radius: var(--dp-radius-sm);
		background: #f3ead9;
		border-bottom: 4px solid #ddcfb6;
		transition:
			background 200ms ease,
			border-color 200ms ease;
	}
	.sort-slot.filled {
		background: #fff6d9;
		border-bottom-color: var(--dp-orange);
	}
	.sort-dot {
		font-size: clamp(1.2rem, 4vw, 1.6rem);
		font-weight: 900;
		color: #b8ab98;
		line-height: 1;
	}

	/* Two countable groups joined by a plus sign. */
	.add {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: clamp(0.4rem, 2vw, 0.9rem);
		flex-wrap: wrap;
		padding: 0.2rem 0;
	}
	.group {
		display: flex;
		gap: 0.15rem;
		padding: 0.35rem 0.5rem;
		border-radius: var(--dp-radius-sm);
		background: #fff2d6;
		border: 3px dashed #e8c98a;
	}
	.obj {
		font-size: clamp(1.2rem, 4.5vw, 1.7rem);
		line-height: 1;
	}
	.plus {
		font-size: clamp(1.5rem, 5vw, 2.1rem);
		font-weight: 900;
		color: var(--dp-orange-deep);
	}

	/* A subtraction: the apples that stay, then the ones taken away, dimmed
	   and struck through. Order matters — the left group is what is left. */
	.take-away {
		display: flex;
		flex-wrap: wrap;
		gap: clamp(0.2rem, 1.4vw, 0.45rem);
		justify-content: center;
		align-items: center;
		padding: 0.55rem 0.8rem;
		border-radius: var(--dp-radius-sm);
		background: #fff2d6;
		border: 3px dashed #e8c98a;
	}
	.take-away .obj.gone {
		position: relative;
		opacity: 0.42;
		filter: grayscale(0.4);
	}
	.take-away .obj.gone::after {
		content: '';
		position: absolute;
		left: -6%;
		right: -6%;
		top: 50%;
		height: 3px;
		border-radius: 2px;
		background: var(--dp-orange-deep);
		transform: rotate(-18deg);
	}

	/* One slot per syllable. Empty slots show a dot so the child sees how
	   many syllables there are before touching anything. */
	.slots {
		display: flex;
		justify-content: center;
		gap: 0.4rem;
	}
	.slot {
		min-width: clamp(56px, 15vw, 78px);
		padding: 0.3rem 0.4rem;
		text-align: center;
		font-size: clamp(1.3rem, 5vw, 1.9rem);
		font-weight: 900;
		line-height: 1.1;
		color: #b8ab98;
		background: #f3ead9;
		border-radius: var(--dp-radius-sm);
		border-bottom: 4px solid #ddcfb6;
		transition:
			background 200ms ease,
			color 200ms ease;
	}
	.slot.filled {
		color: var(--dp-ink);
		background: #fff6d9;
		border-bottom-color: var(--dp-orange);
	}

	.prompt-caption {
		font-size: clamp(1.3rem, 5vw, 2rem);
		font-weight: 900;
		color: var(--dp-ink);
		letter-spacing: 0.02em;
	}
	/* The shape, as an outline. Equal-area-ish and all one colour, so the child
	   is deciding on shape alone. */
	.prompt-shape {
		width: clamp(4rem, 16vw, 6rem);
		height: clamp(4rem, 16vw, 6rem);
		background: var(--dp-blue);
		box-shadow: inset 0 -6px 0 rgba(0, 0, 0, 0.14);
	}
	.prompt-shape[data-shape='circle'] {
		border-radius: 50%;
	}
	.prompt-shape[data-shape='square'] {
		border-radius: 10px;
	}
	.prompt-shape[data-shape='triangle'] {
		background: var(--dp-blue);
		clip-path: polygon(50% 3%, 97% 95%, 3% 95%);
		/* A clip-path removes the inset shadow, so the base tone carries it. */
		box-shadow: none;
	}
	.prompt-shape[data-shape='star'] {
		clip-path: polygon(
			50% 2%,
			61% 36%,
			97% 36%,
			68% 58%,
			79% 93%,
			50% 72%,
			21% 93%,
			32% 58%,
			3% 36%,
			39% 36%
		);
		box-shadow: none;
	}
	/* A colour has no emoji, so the prompt is a solid swatch of that colour. */
	.prompt-icon.swatch {
		width: clamp(3.4rem, 13vw, 5rem);
		height: clamp(3.4rem, 13vw, 5rem);
		border-radius: 50%;
		background: var(--swatch);
		box-shadow:
			inset 0 -6px 0 rgba(0, 0, 0, 0.12),
			var(--dp-shadow-sm);
	}
	/* A question asked by ear: the speaker *is* the prompt, so it is a real
	   button (min 64px tall) rather than decoration. It pulses until heard,
	   because a silent child needs to know where to tap. */
	.speaker {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		min-height: var(--dp-target);
		padding: 0.7rem 1.2rem;
		border-radius: var(--dp-radius);
		background: linear-gradient(180deg, #eaf6ff, #d5ecff);
		border: 3px solid #a7d5ff;
		font-size: clamp(1rem, 3.4vw, 1.25rem);
		font-weight: 800;
		color: var(--dp-ink-soft);
	}
	.speaker.heard {
		background: linear-gradient(180deg, #effff3, #d8f7e2);
		border-color: #9fe0b4;
	}
	.speaker-icon {
		font-size: 1.6em;
		line-height: 1;
	}
	/* Only the unheard state animates: once heard, the prompt has done its job
	   and motion would compete with the answer buttons. */
	.speaker:not(.heard) .speaker-icon {
		animation: nudge 1.6s ease-in-out infinite;
	}
	@keyframes nudge {
		0%,
		100% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.16);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.speaker:not(.heard) .speaker-icon {
			animation: none;
		}
	}

	/* One dot per tone, at the height of the note it stands for: the waiting
	   state doubles as a picture of "low, then high". */
	.pitch-dots {
		display: flex;
		justify-content: center;
		align-items: flex-end;
		gap: 0.7rem;
		height: 2.2rem;
	}
	.pitch-dot {
		width: 1.1rem;
		height: calc(1.1rem + var(--h) * 0.9rem);
		border-radius: 999px;
		background: #d8d0dd;
		transition: background 200ms ease;
	}
	.pitch-dot.played {
		background: var(--dp-purple);
	}

	/* A pattern: coloured chips in a row, then one question-mark slot. */
	.pattern {
		display: flex;
		flex-wrap: wrap;
		gap: clamp(0.2rem, 1.2vw, 0.4rem);
		justify-content: center;
		align-items: center;
		padding: 0.5rem 0.6rem;
		border-radius: var(--dp-radius-sm);
		background: #fff2d6;
		border: 3px dashed #e8c98a;
	}
	.swatch {
		width: clamp(1.7rem, 6vw, 2.4rem);
		height: clamp(1.7rem, 6vw, 2.4rem);
		border-radius: 50%;
		background: var(--sw);
		box-shadow: inset 0 -3px 0 rgba(0, 0, 0, 0.16);
	}
	.swatch--gap {
		background: #fffaf2;
		border: 3px dashed #c9b79a;
		box-shadow: none;
		display: grid;
		place-items: center;
		font-size: clamp(1rem, 3.6vw, 1.4rem);
		font-weight: 900;
		color: #b8a488;
	}
	/* A swatch button carries the colour it names, so the child matches by
	   sight. The name stays as the accessible label, not printed content. */
	.answer--swatch {
		flex-direction: row;
		gap: 0.5rem;
	}
	.answer--swatch .chip {
		width: 1.5em;
		height: 1.5em;
		border-radius: 50%;
		background: var(--sw);
		box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.18);
		flex: 0 0 auto;
	}

	.answers {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: clamp(0.4rem, 1.6vw, 0.8rem);
	}
	.answer {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.15rem;
		min-width: clamp(70px, 15vw, 96px);
		min-height: clamp(78px, 17vw, 104px);
		padding: 0.5rem;
		border-radius: var(--dp-radius-sm);
		background: linear-gradient(180deg, #ffffff, #fff0d8);
		box-shadow: var(--dp-shadow-sm);
		border-bottom: 6px solid var(--dp-orange);
		animation: pop 300ms cubic-bezier(0.2, 1.5, 0.4, 1) both;
		animation-delay: calc(var(--i) * 50ms);
	}
	@keyframes pop {
		from {
			opacity: 0;
			transform: scale(0.7) translateY(12px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}
	.answer:hover:not(:disabled) {
		transform: translateY(-3px);
	}
	.answer.chosen {
		background: linear-gradient(180deg, #b6ffc4, #7ee29a);
		border-bottom-color: var(--dp-green-deep);
		box-shadow:
			0 0 0 6px rgba(79, 194, 107, 0.35),
			var(--dp-shadow-sm);
	}
	.answer.rejected {
		opacity: 0.5;
		border-bottom-color: #c9c0b4;
	}
	.num {
		font-size: clamp(1.9rem, 7vw, 2.7rem);
		font-weight: 900;
		line-height: 1;
		color: var(--dp-ink);
	}
	.answer--word {
		min-width: clamp(88px, 20vw, 140px);
	}
	.word {
		font-size: clamp(1.5rem, 5.5vw, 2.2rem);
		font-weight: 900;
		line-height: 1;
		color: var(--dp-ink);
	}
	.pips {
		display: flex;
		gap: 3px;
		height: 8px;
	}
	.pip {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--dp-orange-deep);
	}
	.answer.chosen .pip {
		background: var(--dp-green-deep);
	}

	/* Feedback layer: swallows taps and shows the verdict without words. */
	.feedback {
		position: absolute;
		inset: 0;
		/* Above the answer buttons, below nothing else on the page. */
		z-index: 2;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.2rem;
		border-radius: var(--dp-radius);
		background: rgba(232, 255, 233, 0.94);
		animation: feedback-in 220ms ease both;
	}
	.feedback.no {
		background: rgba(255, 245, 232, 0.94);
	}
	@keyframes feedback-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.feedback {
			animation: none;
		}
	}
	.feedback-icon {
		font-size: clamp(2.2rem, 9vw, 3.2rem);
		line-height: 1;
	}
	.feedback-text {
		font-size: clamp(1rem, 3.6vw, 1.4rem);
		font-weight: 900;
		color: var(--dp-ink);
	}
</style>
