<script lang="ts">
	/**
	 * Mounts the 3D engine and the child-facing UI.
	 *
	 * This component owns exactly one long-lived object (the engine) and tears
	 * it down on unmount. It never touches Three.js directly — everything goes
	 * through `GameUI` and the engine's public methods.
	 */
	import { onMount } from 'svelte';
	import { GameEngine } from '#lib/kids/engine/GameEngine';
	import { GameUI } from '#lib/kids/ui/GameUI.svelte';
	import { ProgressRepository } from '#lib/kids/storage/ProgressRepository';
	import { applyMissionIntroduced, applyMissionResult, applyMissionWrong } from '#lib/kids/game/MissionReward';
	import { NO_ACCESSORY, resolveWearing } from '#lib/kids/data/accessories';
	import { readWearingPreference, writeWearingPreference } from '#lib/kids/game/ProgressTypes';
	import type { ChildProgress } from '#lib/kids/game/ProgressTypes';
	import type { MissionDefinition } from '#lib/kids/types';
	import MainMenu from './MainMenu.svelte';
	import GameHUD from './GameHUD.svelte';
	import MissionPanel from './MissionPanel.svelte';
	import Wardrobe from './Wardrobe.svelte';
	import TouchControls from './TouchControls.svelte';
	import type { AreaId } from '#lib/kids/types';
	import { nextMissionForArea } from '#lib/kids/data/missions';

	interface Props {
		oparent: () => void;
	}

	let { oparent }: Props = $props();

	const ui = new GameUI();
	const repo = new ProgressRepository();
	let canvas = $state<HTMLCanvasElement | null>(null);
	let engine: GameEngine | null = null;
	let showingMenu = $state(true);
	let helpOpen = $state(false);
	let paused = $state(false);
	/**
	 * The loaded progress record, kept in memory for the whole session.
	 *
	 * Every reward is applied to this and written back immediately, so a child
	 * who closes the tab mid-session still keeps what they earned. Play time is
	 * the one field added on top, at save time, because it accrues continuously.
	 */
	let progress = $state<ChildProgress | null>(null);
	/** Play seconds already banked into `progress` from earlier saves. */
	let bankedPlaySeconds = 0;

	onMount(() => {
		void startUp();
		return () => {
			teardown();
		};
	});

	async function startUp() {
		await repo.open();
		const loaded = await repo.load();
		progress = loaded;
		bankedPlaySeconds = loaded.totalPlayTimeSeconds;
		ui.setStars(loaded.totalStars);
		// Restore the sound preference the HUD toggle persists.
		try {
			const saved = localStorage.getItem('dunia-pintar-sound');
			if (saved === 'off') {
				ui.soundOn = false;
			}
		} catch {
			/* storage may be unavailable */
		}
		if (!canvas) return;
		try {
			engine = new GameEngine({
				canvas,
				ui,
				onExit: () => {
					showingMenu = true;
					helpOpen = false;
				},
				completedMissions: loaded.completedMissions,
				missionPerformance: loaded.missionPerformance,
				onMissionStart: (mission) => void recordIntroduced(mission),
				onMissionComplete: (mission) => void recordCompletion(mission),
				onMissionWrong: (missionId) => void recordWrong(missionId)
			});
			if (!ui.soundOn) engine.setSoundEnabled(false);
			// Put back the outfit from the last visit, silently: the child is
			// arriving, not choosing. `localStorage` wins because it is the copy
			// that is always writable; the progress record is only a fallback for
			// a device that has the database but cleared site data.
			const remembered = readWearingPreference();
			const outfit = remembered === 'none' ? loaded.wearing : remembered;
			engine.setWearing(resolveWearing(outfit)?.id ?? NO_ACCESSORY, false);
		} catch (e) {
			ui.setError(e instanceof Error ? e.message : 'Gagal memuat dunia 3D.');
		}
	}

	/** A mission started: mark what it shows as "introduced". */
	async function recordIntroduced(mission: MissionDefinition) {
		if (!progress) return;
		progress = applyMissionIntroduced(progress, mission);
		await save();
	}

	/**
	 * A mission was answered correctly.
	 *
	 * `applyMissionResult` awards the star once per mission id, so replaying a
	 * mission is still celebrated but never inflates the total.
	 */
	async function recordCompletion(mission: MissionDefinition) {
		if (!progress) return;
		progress = applyMissionResult(progress, mission);
		ui.setStars(progress.totalStars);
		await save();
	}

	/** A wrong answer: record it so the rotation can gently re-offer practice. */
	async function recordWrong(missionId: string) {
		if (!progress) return;
		progress = applyMissionWrong(progress, missionId);
		await save();
	}

	async function save() {
		if (!progress) return;
		const withTime: ChildProgress = {
			...progress,
			totalPlayTimeSeconds: bankedPlaySeconds + (engine?.playSeconds ?? 0)
		};
		const ok = await repo.save(withTime);
		reportSave(ok);
	}

	/**
	 * Say so when a star cannot survive this browser session.
	 *
	 * Not the same question as "did the write land". `repo.save` returns `false`
	 * whenever IndexedDB is unavailable, and in that case it also updates the
	 * in-memory mirror — which the UI then reads, so the star *looks* saved. It
	 * is not: close the tab and it is gone. `repo.persistent` is the honest
	 * signal, and it was never surfaced either, even though the dashboard
	 * already reads it. The child is not told (they can do nothing about it);
	 * the grown-up is, once per session, so it cannot become a nag.
	 */
	let saveWarned = false;
	function reportSave(ok: boolean) {
		if (saveWarned) return;
		if (ok && repo.persistent) return;
		saveWarned = true;
		ui.setNotice(
			repo.persistent
				? 'Bintang belum bisa disimpan di perangkat ini. Progres hanya bertahan selama halaman terbuka.'
				: 'Penyimpanan perangkat tidak tersedia. Progres hanya bertahan selama halaman terbuka.',
			'warn'
		);
	}

	function teardown() {
		void persist();
		engine?.dispose();
		engine = null;
	}

	/**
	 * Open the dressing-up box.
	 *
	 * A child may change outfit at any time — mid-mission included — because a
	 * wardrobe that opens only between activities is a gate by another name.
	 * The mission panel keeps working underneath; the box is a layer on top.
	 */
	function openWardrobe() {
		ui.toggleWardrobe(true);
	}

	function closeWardrobe() {
		ui.toggleWardrobe(false);
	}

	/**
	 * Put something on, and remember it.
	 *
	 * The engine builds the geometry and narrates; this only owns the saved
	 * preference, which is written immediately so a child who closes the tab
	 * finds the same hat next time.
	 */
	async function wear(accessoryId: string) {
		ui.wear(accessoryId);
		// Kept in `localStorage`, not the progress database: an outfit is a
		// preference, not a record, and it must survive even when IndexedDB is
		// refused. See `readWearingPreference`.
		writeWearingPreference(accessoryId);
		if (!progress) return;
		progress = ProgressRepository.setWearing(progress, accessoryId);
		await save();
	}

	/** Save the in-memory record plus accrued play time. */
	async function persist() {
		if (!progress) return;
		const next: ChildProgress = {
			...progress,
			totalPlayTimeSeconds: bankedPlaySeconds + (engine?.playSeconds ?? 0)
		};
		const ok = await repo.save(next);
		reportSave(ok);
		progress = next;
	}

	function play() {
		showingMenu = false;
		// Start the counting area's next unfinished mission, so "Main" keeps
		// making progress instead of replaying the same apples forever.
		const first = nextMissionForArea('counting', progress?.completedMissions ?? []);
		requestAnimationFrame(() => engine?.startMissionById(first));
	}

	function pickArea(id: AreaId) {
		showingMenu = false;
		const missionId = nextMissionForArea(id, progress?.completedMissions ?? []);
		requestAnimationFrame(() => engine?.startMissionById(missionId));
	}

	function toggleHelp() {
		helpOpen = !helpOpen;
	}

	function exitGame() {
		void persist();
		showingMenu = true;
		helpOpen = false;
		paused = false;
		engine?.abandonMissionToMenu?.();
	}

	function togglePause() {
		paused = !paused;
		if (paused) engine?.pause();
		else engine?.resume();
	}
</script>

<svelte:window onpagehide={() => void persist()} onvisibilitychange={() => {
	if (document.visibilityState === 'hidden') void persist();
}} />

<div class="stage">
	<canvas bind:this={canvas} class="world" aria-label="Dunia 3D Dunia Pintar"></canvas>

	{#if ui.error}
		<div class="fatal" role="alert">
			<div class="fatal-card dp-card">
				<h2>Dunia belum bisa dibuka</h2>
				<p>{ui.error}</p>
				<p class="fatal-hint">
					Coba gunakan browser yang mendukung WebGL (Chrome, Safari, atau Edge versi terbaru).
				</p>
				<button class="dp-btn" onclick={oparent}>Pengaturan Orang Tua</button>
			</div>
		</div>
	{:else if showingMenu}
		<MainMenu
			stars={ui.stars}
			onplay={play}
			onarea={pickArea}
			onparent={oparent}
			onnarrate={(text) => engine?.narrate(text)}
		/>
	{:else}
		<GameHUD
			stars={ui.stars}
			areaName={ui.areaName}
			missionTitle={ui.mission?.mission.title ?? null}
			soundOn={ui.soundOn}
			onreplay={() => ui.replayInstruction()}
			onhelp={toggleHelp}
			onexit={exitGame}
			ontogglesound={() => ui.toggleSound()}
			onwardrobe={() => openWardrobe()}
		/>

		{#if ui.mission}
			{#key ui.mission.mission.id}
				<MissionPanel
					view={ui.mission}
					onanswer={(v) => ui.answer(v)}
					onreplay={() => ui.replayInstruction()}
				/>
			{/key}
		{/if}

		{#if ui.notice}
			<!--
				A short, quiet line for a grown-up: "your stars could not be
				saved", "the 3D model is missing". `GameUI.setNotice` was always
				written and never rendered, so every one of those facts was
				swallowed. It sits above the mission card and never takes taps.
			-->
			<div class="notice" class:warn={ui.notice.tone === 'warn'} role="status" aria-live="polite">
				<span aria-hidden="true">{ui.notice.tone === 'warn' ? '⚠️' : ui.notice.tone === 'success' ? '✅' : 'ℹ️'}</span>
				<span>{ui.notice.text}</span>
			</div>
		{/if}

		{#if ui.touchEnabled}
			<TouchControls
				onjoystick={(x, y) => ui.feedJoystick(x, y)}
				onjump={() => ui.requestJump()}
				oninteract={() => ui.requestInteract()}
				disabled={paused}
				showInteract={!ui.mission}
			/>
		{/if}

		{#if ui.portrait && !ui.rotateHintDismissed}
			<div class="rotate-hint" role="status">
				<span class="rotate-icon" aria-hidden="true">🔄</span>
				<p>Putar layar untuk melihat dunia lebih luas</p>
				<button
					class="dp-btn dp-btn--ghost rotate-ok"
					onclick={() => ui.dismissRotateHint()}
					aria-label="Tutup saran memutar layar"
				>
					Oke
				</button>
			</div>
		{/if}

		{#if helpOpen}
			<div class="overlay" role="dialog" aria-modal="true" aria-label="Bantuan">
				<div class="dp-card help-card">
					<h2>Cara bermain</h2>
					<ul>
						<li><span aria-hidden="true">🕹️</span> Geser tuas atau tekan W A S D untuk berjalan.</li>
						<li><span aria-hidden="true">👆</span> Geser layar untuk melihat sekeliling.</li>
						<li><span aria-hidden="true">⬆️</span> Tekan tombol lompat atau Spasi.</li>
						<li>
							<span aria-hidden="true">🗺️</span> Berjalan ke tempat yang berwarna untuk mulai bermain.
						</li>
						<li>
							<span aria-hidden="true">🍎</span> Di kebun apel: ketuk semua apel, lalu pilih jumlahnya.
						</li>
						<li>
							<span aria-hidden="true">🔤</span> Di hutan huruf: dengar baik-baik, lalu pilih huruf atau
							suku katanya.
						</li>
						<li>
							<span aria-hidden="true">🐱</span> Di hutan hewan: dengarkan suaranya, lalu pilih hewannya.
						</li>
						<li><span aria-hidden="true">🔊</span> Tekan tombol ini untuk mendengar lagi.</li>
						<li><span aria-hidden="true">👒</span> Buka lemari untuk memakaikan topi dan syal Bubu.</li>
					</ul>
					<button class="dp-btn dp-btn--green" onclick={() => (helpOpen = false)}>Mengerti</button>
				</div>
			</div>
		{/if}

		{#if paused}
			<div class="overlay" role="dialog" aria-modal="true" aria-label="Jeda">
				<div class="dp-card help-card">
					<h2>Istirahat sebentar</h2>
					<div class="pause-actions">
						<button class="dp-btn dp-btn--green" onclick={togglePause}>Lanjut</button>
						<button class="dp-btn dp-btn--ghost" onclick={exitGame}>Ke Menu</button>
					</div>
				</div>
			</div>
		{/if}

		<button class="pause-btn" onclick={togglePause} aria-label={paused ? 'Lanjut' : 'Jeda'}>
			<span aria-hidden="true">{paused ? '▶' : '⏸'}</span>
		</button>

		{#if ui.wardrobeOpen}
			<Wardrobe
				wearing={ui.wearing}
				stars={ui.stars}
				onwear={(id) => void wear(id)}
				onclose={closeWardrobe}
			/>
		{/if}
	{/if}
</div>

<style>
	.stage {
		position: absolute;
		inset: 0;
		overflow: hidden;
	}
	.world {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}
	/* Adult-facing note. Above the HUD row, never over the answer buttons, and
	   it takes no taps so it cannot steal a touch meant for the game. */
	.notice {
		position: absolute;
		top: 88px;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 0.5rem;
		max-width: min(560px, 92vw);
		padding: 0.45rem 0.9rem;
		border-radius: 999px;
		background: rgba(255, 250, 242, 0.96);
		box-shadow: var(--dp-shadow-sm);
		color: var(--dp-ink);
		font-size: clamp(0.72rem, 2.4vw, 0.86rem);
		font-weight: 700;
		pointer-events: none;
		z-index: 18;
		animation: notice-in 200ms ease both;
	}
	.notice.warn {
		background: #fff3e0;
	}
	@keyframes notice-in {
		from {
			opacity: 0;
			transform: translate(-50%, -6px);
		}
		to {
			opacity: 1;
			transform: translate(-50%, 0);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.notice {
			animation: none;
		}
	}
	/* A gentle nudge to turn the device. Never a blocker: the game stays
	   playable in portrait, this only points out that landscape shows more. */
	.rotate-hint {
		position: absolute;
		left: 50%;
		top: clamp(4.2rem, 12vh, 6rem);
		transform: translateX(-50%);
		z-index: 16;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.6rem 0.9rem;
		border-radius: 999px;
		background: rgba(255, 250, 242, 0.97);
		box-shadow: var(--dp-shadow-sm);
		max-width: 92vw;
	}
	.rotate-hint p {
		margin: 0;
		font-size: clamp(0.78rem, 3vw, 0.95rem);
		font-weight: 800;
		color: var(--dp-ink);
	}
	.rotate-icon {
		font-size: 1.3rem;
		animation: spin 2.4s ease-in-out infinite;
	}
	@keyframes spin {
		0%,
		60% {
			transform: rotate(0deg);
		}
		80%,
		100% {
			transform: rotate(90deg);
		}
	}
	.rotate-ok {
		min-width: 64px;
		min-height: 44px;
		font-size: 0.9rem;
		flex: none;
	}

	.fatal {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		background: #dff1ff;
		padding: 1rem;
		z-index: 100;
	}
	.fatal-card {
		max-width: 520px;
		text-align: center;
	}
	.fatal-card h2 {
		margin-top: 0;
	}
	.fatal-hint {
		color: var(--dp-ink-soft);
		font-size: 0.9rem;
	}
	.overlay {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		background: rgba(47, 36, 64, 0.55);
		backdrop-filter: blur(4px);
		z-index: 60;
		padding: 1rem;
	}
	.help-card {
		max-width: 480px;
		width: 100%;
	}
	.help-card h2 {
		margin-top: 0;
		font-size: 1.6rem;
	}
	.help-card ul {
		list-style: none;
		padding: 0;
		margin: 0 0 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		font-size: 1.05rem;
		font-weight: 700;
		color: var(--dp-ink-soft);
	}
	.help-card li {
		display: flex;
		gap: 0.6rem;
		align-items: flex-start;
	}
	.pause-actions {
		display: flex;
		gap: 0.8rem;
		flex-wrap: wrap;
	}
	.pause-btn {
		position: absolute;
		right: clamp(0.6rem, 2vw, 1.1rem);
		bottom: clamp(0.6rem, 2vw, 1.1rem);
		width: 52px;
		height: 52px;
		border-radius: 50%;
		background: rgba(255, 250, 242, 0.92);
		box-shadow: var(--dp-shadow-sm);
		font-size: 1.2rem;
		z-index: 25;
	}
</style>
