<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { ProgressRepository } from '#lib/kids/storage/ProgressRepository';
	import type { ChildProgress } from '#lib/kids/game/ProgressTypes';
	import { numberWord } from '#lib/kids/data/numbers';
	import { areaStatus, nextRecommendation, summarizeAreas } from '#lib/kids/game/AreaSummary';
	import {
		learningSnapshot,
		practiceSuggestions,
		offlineIdeas
	} from '#lib/kids/game/ProgressInsights';
	import { resolveWearing } from '#lib/kids/data/accessories';
	import { AudioManager } from '#lib/kids/engine/AudioManager';

	/**
	 * Parent dashboard.
	 *
	 * Deliberately plain and quiet: it must not look like part of the game, or
	 * a child will want to be in it. Gated by a simple arithmetic question,
	 * which stops a preschooler without being security theatre.
	 */
	let unlocked = $state(false);
	let gateA = $state(0);
	let gateB = $state(0);
	let gateAnswer = $state('');
	let gateError = $state(false);

	const repo = new ProgressRepository();
	let progress = $state<ChildProgress | null>(null);
	let persistent = $state(false);
	let storageError = $state<string | null>(null);
	let resetArmed = $state(false);
	let resetDone = $state(false);
	/**
	 * What the browser says about Indonesian speech, in the parent's own words.
	 *
	 * `AudioManager.speechFallbackNote` existed for this purpose and was wired
	 * into `GameUI`, but nothing ever rendered it — so the dashboard showed a
	 * fixed sentence ("quality depends on your device") even on a browser with
	 * no speech synthesis at all, where narration is simply silent. Asking the
	 * manager here makes the disclosure true rather than reassuring.
	 */
	let voiceStatus = $state<string | null>(null);

	onMount(() => {
		newGate();
		void load();
		voiceStatus = describeSpeech();
	});

	/** Probe the device's speech support without playing anything. */
	function describeSpeech(): string {
		if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
			return 'Peramban ini tidak punya fitur suara, jadi narasi tidak akan terdengar.';
		}
		const audio = new AudioManager();
		const note = audio.speechFallbackNote;
		audio.dispose();
		if (!note) return 'Suara bahasa Indonesia tersedia di perangkat ini.';
		// "Loading voices…" is not a finding, it is a race; say nothing rather
		// than report a problem that will resolve itself.
		if (!audio.isSpeechAvailable) return 'Peramban ini tidak punya fitur suara, jadi narasi tidak akan terdengar.';
		return 'Tidak ada suara bahasa Indonesia terpasang. Narasi memakai suara bawaan dan bisa terdengar kurang tepat.';
	}

	function newGate() {
		// Two numbers a preschooler cannot reliably add.
		gateA = 3 + Math.floor(Math.random() * 6);
		gateB = 4 + Math.floor(Math.random() * 6);
		gateAnswer = '';
		gateError = false;
	}

	function checkGate() {
		if (Number(gateAnswer) === gateA + gateB) {
			unlocked = true;
			void load();
		} else {
			gateError = true;
			newGate();
		}
	}

	async function load() {
		await repo.open();
		persistent = repo.persistent;
		storageError = repo.error;
		progress = await repo.load();
	}

	async function resetProgress() {
		if (!resetArmed) {
			resetArmed = true;
			return;
		}
		await repo.reset();
		resetArmed = false;
		resetDone = true;
		await load();
	}

	const introduced = $derived(progress?.learningProgress.introducedNumbers ?? []);
	const correct = $derived(progress?.learningProgress.correctNumbers ?? []);
	const learnLetters = $derived(progress?.learningProgress.introducedLetters ?? []);
	const correctLetters = $derived(progress?.learningProgress.correctLetters ?? []);
	const syllables = $derived(progress?.learningProgress.introducedSyllables ?? []);
	const correctSyllables = $derived(progress?.learningProgress.correctSyllables ?? []);
	// The animals / shapes / colours lists exist because the missions used to
	// report `teaches: {}` — see the v4 migration. Reading them here is what
	// makes the fix visible to a parent; without this the data was recorded
	// and never shown.
	const animalsSeen = $derived(progress?.learningProgress.introducedAnimals ?? []);
	const animalsKnown = $derived(progress?.learningProgress.correctAnimals ?? []);
	const shapesSeen = $derived(progress?.learningProgress.introducedShapes ?? []);
	const shapesKnown = $derived(progress?.learningProgress.correctShapes ?? []);
	const colorsSeen = $derived(progress?.learningProgress.introducedColors ?? []);
	const colorsKnown = $derived(progress?.learningProgress.correctColors ?? []);
	const musicSeen = $derived(progress?.learningProgress.introducedMusic ?? []);
	const musicKnown = $derived(progress?.learningProgress.correctMusic ?? []);
	const minutes = $derived(Math.round((progress?.totalPlayTimeSeconds ?? 0) / 60));
	/** Per-area breakdown, derived from the completed missions. */
	const areas = $derived(progress ? summarizeAreas(progress) : []);
	/** What the record can honestly say about mastery, difficulty and coverage. */
	const snapshot = $derived(progress ? learningSnapshot(progress) : null);
	/** Missions still costing mistakes, hardest first — real practice, not a guess. */
	const practice = $derived(progress ? practiceSuggestions(progress) : []);
	/** Screen-free activities matched to what this child has played. */
	const ideas = $derived(progress ? offlineIdeas(progress) : []);
	/** What to suggest the child try next, or null when everything is done. */
	const next = $derived((progress && areas.length ? nextRecommendation(progress, areas) : null));
	/** What Bubu has on, as a name a parent can read. */
	const wornName = $derived(resolveWearing(progress?.wearing)?.name ?? 'Tanpa aksesori');

	function fmtNumbers(list: number[]): string {
		if (list.length === 0) return '—';
		return [...list].sort((a, b) => a - b).map(numberWord).join(', ');
	}

	function fmtList(list: string[]): string {
		return list.length === 0 ? '—' : list.join(', ');
	}
</script>

<svelte:head>
	<title>Untuk Orang Tua — Dunia Pintar 3D</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="parent">
	<header class="parent-head">
		<button class="back" onclick={() => goto('/')}>← Kembali ke permainan</button>
		<h1>Untuk Orang Tua</h1>
		<p class="sub">Ringkasan perkembangan belajar anak. Data hanya tersimpan di perangkat ini.</p>
	</header>

	{#if !unlocked}
		<section class="gate dp-card" aria-labelledby="gate-title">
			<h2 id="gate-title">Kunci Orang Tua</h2>
			<p>Untuk membuka, jawab pertanyaan berikut agar anak tidak masuk tanpa sengaja.</p>
			<div class="gate-form">
				<label for="gate-input">Berapa {gateA} + {gateB}?</label>
				<input
					id="gate-input"
					type="number"
					inputmode="numeric"
					bind:value={gateAnswer}
					onkeydown={(e) => e.key === 'Enter' && checkGate()}
				/>
				<button class="dp-btn" onclick={checkGate}>Buka</button>
			</div>
			{#if gateError}
				<p class="err" role="alert">Jawaban belum benar. Coba lagi.</p>
			{/if}
		</section>
	{:else}
		<section class="grid">
			<div class="tile dp-card">
				<h3>Bintang</h3>
				<p class="big">⭐ {progress?.totalStars ?? 0}</p>
			</div>
			<div class="tile dp-card">
				<h3>Misi selesai</h3>
				<p class="big">{progress?.completedMissions.length ?? 0}</p>
				<p class="small">{fmtList(progress?.completedMissions ?? [])}</p>
			</div>
			<div class="tile dp-card">
				<h3>Waktu bermain</h3>
				<p class="big">~{minutes} menit</p>
				<p class="small">Total perkiraan</p>
			</div>
			<div class="tile dp-card">
				<h3>Huruf dikenalkan</h3>
				<p class="big">{learnLetters.length}</p>
				<p class="small">{fmtList(learnLetters)}</p>
			</div>
			<div class="tile dp-card">
				<h3>Huruf dijawab benar</h3>
				<p class="big">{correctLetters.length}</p>
				<p class="small">{fmtList(correctLetters)}</p>
			</div>
			<div class="tile dp-card">
				<h3>Suku kata dikenalkan</h3>
				<p class="big">{syllables.length}</p>
				<p class="small">{fmtList(syllables)}</p>
			</div>
			<div class="tile dp-card">
				<h3>Hewan dikenal</h3>
				<p class="big">{animalsKnown.length}</p>
				<p class="small">
					Dikenalkan {animalsSeen.length}: {fmtList(animalsSeen)}
				</p>
			</div>
			<div class="tile dp-card">
				<h3>Warna dikenal</h3>
				<p class="big">{colorsKnown.length}</p>
				<p class="small">Dikenalkan {colorsSeen.length}: {fmtList(colorsSeen)}</p>
			</div>
			<div class="tile dp-card">
				<h3>Bentuk dikenal</h3>
				<p class="big">{shapesKnown.length}</p>
				<p class="small">Dikenalkan {shapesSeen.length}: {fmtList(shapesSeen)}</p>
			</div>
			<div class="tile dp-card">
				<h3>Nada dikenal</h3>
				<p class="big">{musicKnown.length}</p>
				<p class="small">Dikenalkan {musicSeen.length}: {fmtList(musicSeen)}</p>
			</div>
			<div class="tile dp-card">
				<h3>Aksesori dipakai</h3>
				<p class="big">{wornName}</p>
				<p class="small">Semua aksesori terbuka sejak awal; bintang hanya catatan, bukan syarat.</p>
			</div>
		</section>

		<section class="areas dp-card">
			<h2>Per Area Belajar</h2>
			<p class="legend">Semua area terbuka sejak awal; angka di bawah menunjukkan misi mana yang sudah diselesaikan.</p>
			<ul class="area-list">
				{#each areas as area (area.id)}
					<li class="area" data-area={area.id}>
						<span class="area-icon" aria-hidden="true">{area.icon}</span>
						<div class="area-main">
							<div class="area-head">
								<span class="area-name">{area.name}</span>
								<span class="area-status" class:done={area.percent === 100}>{areaStatus(area)}</span>
							</div>
							<div
								class="area-bar"
								role="progressbar"
								aria-valuemin="0"
								aria-valuemax="100"
								aria-valuenow={area.percent}
								aria-label="{area.name}: {areaStatus(area)}"
							>
								<span style="width:{area.percent}%"></span>
							</div>
						</div>
						<span class="area-stars" aria-label="{area.stars} bintang di {area.name}">⭐ {area.stars}</span>
					</li>
				{/each}
			</ul>
		</section>

		{#if next}
			<section class="recommend dp-card">
				<h2>Coba berikutnya</h2>
				<p class="legend">
					Area yang paling belum dikuasai memberi saran misi pertama yang belum selesai. Rekomendasi hanya
					saran — semua area tetap terbuka untuk dijelajahi.
				</p>
				<div class="next-row">
					<span class="area-icon" aria-hidden="true">{next.areaIcon}</span>
					<div class="next-main">
						<span class="area-name">{next.areaName}</span>
						<span class="mission-title">{next.missionTitle}</span>
					</div>
					<span class="next-percent">{next.areaPercent}%</span>
				</div>
			</section>
		{/if}

		{#if snapshot}
			<section class="mastery dp-card">
				<h2>Penguasaan</h2>
				<p class="legend legend--prose">
					Dihitung dari misi yang sudah diselesaikan. <strong>Dikuasai</strong> berarti selesai tanpa
					kesalahan yang tersisa; <strong>Sedang dilatih</strong> berarti masih ada kesalahan yang
					tersimpan. Angka diperbarui perlahan seiring anak berhasil mengulang.
				</p>
				<div class="mastery-grid">
					<div class="stat">
						<span class="stat-value">{snapshot.mastered}</span>
						<span class="stat-label">Dikuasai</span>
					</div>
					<div class="stat">
						<span class="stat-value">{snapshot.practising}</span>
						<span class="stat-label">Sedang dilatih</span>
					</div>
					<div class="stat">
						<span class="stat-value">{snapshot.untouched}</span>
						<span class="stat-label">Belum dicoba</span>
					</div>
					<div class="stat">
						<span class="stat-value">
							{snapshot.firstTryRate === null ? '—' : `${snapshot.firstTryRate}%`}
						</span>
						<span class="stat-label">Benar sekali coba</span>
					</div>
				</div>
				<p class="hint">
					{snapshot.areasStarted} dari {snapshot.areasTotal} area sudah dicoba, dan
					{snapshot.areasFinished} area selesai seluruh misinya.
					{#if snapshot.firstTryRate === null}
						Belum ada misi yang selesai, jadi belum ada angka untuk ditampilkan.
					{/if}
				</p>
				<!--
					Deliberately NOT a chart over time. The record stores which missions
					were finished but never when, so a trend line would be invented. The
					note below says so, rather than leaving a parent to assume the silence
					is an oversight.
				-->
				<p class="note small">
					Aplikasi ini tidak menampilkan grafik kemajuan per hari karena data waktu tidak disimpan —
					hanya hasil akhir tiap misi. Menampilkan grafiknya berarti mengarang polanya.
				</p>
			</section>

			{#if practice.length > 0}
				<section class="practice dp-card">
					<h2>Latihan yang Membantu</h2>
					<p class="legend legend--prose">
						Misi yang masih memakan kesalahan, paling sering salah lebih dulu. Mengulangnya membantu,
						dan tidak ada hukuman untuk mengulang.
					</p>
					<ul class="practice-list">
						{#each practice as item (item.areaName)}
							<li class="practice-item">
								<span class="area-icon" aria-hidden="true">{item.areaIcon}</span>
								<div>
									<span class="area-name">{item.areaName}</span>
									<ul class="practice-missions">
										{#each item.missionTitles as title (title)}
											<li>{title}</li>
										{/each}
									</ul>
								</div>
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			{#if ideas.length > 0}
				<section class="ideas dp-card">
					<h2>Ide Bermain Tanpa Layar</h2>
					<p class="legend legend--prose">
						Dipilih dari area yang sudah dicoba anak. Ini saran kegiatan bersama, bukan bagian dari
						permainan — aplikasi tidak mencatat apakah kegiatan ini dilakukan.
					</p>
					<ul class="idea-list">
						{#each ideas as idea (idea.headline)}
							<li class="idea">
								<span class="idea-head">{idea.headline}</span>
								<span class="idea-detail">{idea.detail}</span>
							</li>
						{/each}
					</ul>
				</section>
			{/if}
		{/if}

		<section class="numbers dp-card">
			<h2>Angka</h2>
			<p class="legend">
				<span class="dot introduced"></span> Dikenalkan (angka pernah ditampilkan)
				<span class="dot correct"></span> Dikuasai (anak menjawab benar)
			</p>
			<div class="num-grid">
				{#each Array.from({ length: 10 }, (_, i) => i + 1) as n (n)}
					<div class="num" class:introduced={introduced.includes(n)} class:correct={correct.includes(n)}>
						<span class="num-value">{n}</span>
						<span class="num-word">{numberWord(n)}</span>
					</div>
				{/each}
			</div>
			<p class="hint">
				Angka yang <strong>dikenalkan</strong>: {fmtNumbers(introduced)}.<br />
				Angka yang <strong>dikuasai</strong>: {fmtNumbers(correct)}.
			</p>
		</section>

		<section class="settings dp-card">
			<h2>Pengaturan &amp; Data</h2>
			<p class="note">
				Suara narasi memakai <em>fitur suara bawaan perangkat</em> (<code>speechSynthesis</code>), bukan rekaman.
			</p>
			{#if voiceStatus}
				<p class="note" data-testid="voice-status">{voiceStatus}</p>
			{/if}
			<p class="note">
				Penyimpanan: {persistent ? 'IndexedDB aktif (data tersimpan di perangkat ini).' : 'Tidak tersedia — data hanya ada selama sesi ini.'}
			</p>
			{#if storageError}
				<p class="err">{storageError}</p>
			{/if}
			{#if progress?.lastPlayedAt}
				<p class="note">Terakhir bermain: {new Date(progress.lastPlayedAt).toLocaleString()}</p>
			{/if}
			<div class="reset">
				<button class="dp-btn danger" onclick={resetProgress}>
					{resetArmed ? 'Yakin? Ketuk lagi untuk menghapus' : 'Hapus Progres'}
				</button>
				{#if resetDone}<span class="ok">Progres dihapus.</span>{/if}
			</div>
			<p class="note small">
				Halaman ini tidak mengumpulkan nama, usia, email, maupun data pribadi. Tidak ada iklan, pelacakan, atau koneksi
				ke server.
			</p>
		</section>
	{/if}
</main>

<style>
	.parent {
		position: absolute;
		inset: 0;
		overflow-y: auto;
		padding: clamp(1rem, 3vw, 2rem);
		background: #f4f7fb;
		color: var(--dp-ink);
		font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
	}
	.parent-head {
		max-width: 1000px;
		margin: 0 auto 1.2rem;
	}
	.back {
		min-height: 44px;
		padding: 0.5rem 1rem;
		border-radius: 999px;
		background: #fff;
		box-shadow: 0 2px 8px rgba(47, 36, 64, 0.12);
		font-weight: 700;
		color: var(--dp-ink-soft);
	}
	h1 {
		margin: 0.8rem 0 0.2rem;
		font-size: clamp(1.5rem, 4vw, 2rem);
	}
	.sub {
		margin: 0;
		color: #5b6b80;
	}
	.gate,
	.numbers,
	.settings,
	.mastery,
	.practice,
	.ideas {
		max-width: 720px;
		margin: 0 auto 1.2rem;
	}
	.gate-form {
		display: flex;
		gap: 0.8rem;
		align-items: center;
		flex-wrap: wrap;
		margin-top: 0.8rem;
	}
	.gate-form label {
		font-weight: 700;
		font-size: 1.1rem;
	}
	.gate-form input {
		width: 120px;
		min-height: 52px;
		font-size: 1.4rem;
		padding: 0 0.8rem;
		border: 2px solid #c9d4e3;
		border-radius: 12px;
		text-align: center;
	}
	.grid {
		max-width: 1000px;
		margin: 0 auto 1.2rem;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 1rem;
	}
	.tile h3 {
		margin: 0 0 0.4rem;
		font-size: 0.85rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #6b7c92;
	}
	.big {
		margin: 0;
		font-size: 2rem;
		font-weight: 800;
	}
	.small {
		margin: 0.2rem 0 0;
		font-size: 0.8rem;
		color: #7b8ba0;
		word-break: break-word;
	}
	.legend {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
		font-size: 0.85rem;
		color: #5b6b80;
		align-items: center;
	}
	/* A legend that is a sentence, not a row of colour keys. `display: flex`
	   turns every inline <strong> into its own column, which broke a paragraph
	   into ragged fragments. */
	.legend--prose {
		display: block;
		line-height: 1.55;
	}
	.dot {
		display: inline-block;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		margin-right: 0.3rem;
	}
	.dot.introduced {
		background: #ffd34d;
	}
	.dot.correct {
		background: #4fc26b;
	}
	.areas {
		max-width: 720px;
		margin: 0 auto 1.2rem;
	}
	.area-list {
		list-style: none;
		margin: 0.8rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}
	.area {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		padding: 0.6rem 0.8rem;
		border-radius: 12px;
		background: #eef2f7;
	}
	.area-icon {
		font-size: 1.5rem;
		line-height: 1;
	}
	.area-main {
		flex: 1 1 auto;
		min-width: 0;
	}
	.area-head {
		display: flex;
		justify-content: space-between;
		gap: 0.6rem;
		flex-wrap: wrap;
		margin-bottom: 0.35rem;
	}
	.area-name {
		font-weight: 700;
	}
	.area-status {
		font-size: 0.8rem;
		color: #6b7c92;
	}
	.area-status.done {
		color: #2f8a4a;
		font-weight: 700;
	}
	.area-bar {
		height: 10px;
		border-radius: 999px;
		background: #dde5ef;
		overflow: hidden;
	}
	.area-bar span {
		display: block;
		height: 100%;
		border-radius: 999px;
		background: linear-gradient(90deg, #ffd34d, #4fc26b);
	}
	.area-stars {
		font-size: 0.85rem;
		font-weight: 700;
		color: #7b8ba0;
		white-space: nowrap;
	}
	.recommend {
		max-width: 720px;
		margin: 0 auto 1.2rem;
	}
	.next-row {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		padding: 0.7rem 0.9rem;
		margin-top: 0.8rem;
		border-radius: 12px;
		background: #eef2f7;
		border-left: 5px solid #4fc26b;
	}
	.next-main {
		flex: 1 1 auto;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}
	.mission-title {
		color: #5b6b80;
	}
	.next-percent {
		font-size: 1.1rem;
		font-weight: 800;
		color: #2f8a4a;
		white-space: nowrap;
	}
	/* Mastery counts: four equal tiles, printable as plain numbers. */
	.mastery-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 0.7rem;
		margin: 0.9rem 0;
	}
	.stat {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.2rem;
		padding: 0.8rem 0.4rem;
		border-radius: 12px;
		background: #eef2f7;
	}
	.stat-value {
		font-size: 1.8rem;
		font-weight: 800;
		line-height: 1;
	}
	.stat-label {
		font-size: 0.8rem;
		color: #6b7c92;
		text-align: center;
	}

	.practice-list,
	.idea-list {
		list-style: none;
		margin: 0.8rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
	}
	.practice-item {
		display: flex;
		align-items: flex-start;
		gap: 0.8rem;
		padding: 0.7rem 0.9rem;
		border-radius: 12px;
		background: #fff6ea;
		border-left: 5px solid #ffb545;
	}
	.practice-missions {
		margin: 0.3rem 0 0;
		padding-left: 1.1rem;
		color: #5b6b80;
	}
	.idea {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.7rem 0.9rem;
		border-radius: 12px;
		background: #eef7ff;
		border-left: 5px solid #4aa8ff;
	}
	.idea-head {
		font-weight: 700;
	}
	.idea-detail {
		color: #5b6b80;
		line-height: 1.5;
	}

	.num-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(76px, 1fr));
		gap: 0.6rem;
		margin: 0.8rem 0;
	}
	.num {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 0.6rem 0.3rem;
		border-radius: 12px;
		background: #eef2f7;
		border: 3px solid transparent;
	}
	.num.introduced {
		border-color: #ffd34d;
		background: #fffbea;
	}
	.num.correct {
		border-color: #4fc26b;
		background: #eafaf0;
	}
	.num-value {
		font-size: 1.5rem;
		font-weight: 800;
	}
	.num-word {
		font-size: 0.72rem;
		color: #6b7c92;
	}
	.hint,
	.note {
		font-size: 0.86rem;
		color: #5b6b80;
		line-height: 1.5;
	}
	.reset {
		display: flex;
		gap: 1rem;
		align-items: center;
		flex-wrap: wrap;
		margin: 0.8rem 0;
	}
	.danger {
		background: #d9534f;
		color: #fff;
		min-height: 52px;
		font-size: 1rem;
		padding: 0 1.4rem;
	}
	.ok {
		color: #2f8a4a;
		font-weight: 700;
	}
	.err {
		color: #c0392b;
		font-weight: 600;
	}
</style>
