import type { ChildProgress } from './ProgressTypes';
import type { AreaId } from '../types';
import { AREA_ORDER, getArea } from '../data/areas';
import { MISSIONS, AREA_ROTATION } from '../data/missions';

/**
 * What the recorded performance actually says, for the parent dashboard.
 *
 * **This module does not draw a trend line, and that is deliberate.**
 *
 * A "progress over time" chart is the obvious thing to add, and it cannot be
 * built honestly here. The stored record has no timestamps per mission: it
 * knows *which* missions were finished, never *when*. `lastPlayedAt` is a
 * single value for the whole save. Any week-by-week line drawn from this data
 * would be invented — the shape would come from the chart, not from the child.
 *
 * What *is* recorded, and has been since progress version 3, is per-mission
 * performance: how many wrong answers before it was solved, and whether it was
 * solved on the first attempt. That is real evidence of difficulty, and it can
 * be summarised truthfully. So this module answers the questions the data can
 * actually support:
 *
 *  - Which missions were hard, and which were easy?
 *  - Is the child answering on the first try more often than not?
 *  - Which areas are mastered, and which are untouched?
 *
 * Everything here is pure and free of IndexedDB and Svelte, so a parent-facing
 * claim can be unit tested rather than eyeballed.
 */

/** How a single mission went, as far as the record can tell. */
export type MissionConfidence = 'mastered' | 'practising' | 'untouched';

export interface MissionPerformanceSummary {
	id: string;
	title: string;
	area: AreaId;
	/** Wrong answers recorded across all attempts. */
	wrongCount: number;
	/** Times the mission was completed. */
	completedCount: number;
	/** True when every recorded completion was clean. */
	firstTry: boolean;
	confidence: MissionConfidence;
}

/**
 * A mission is "mastered" when it has been completed and no wrong answer is
 * outstanding, "practising" when it has been attempted but is still costing
 * mistakes, and "untouched" when it has never been finished.
 *
 * `wrongCount` halves on every completion (see `ProgressRepository`), so a
 * mission a child has since mastered stops being flagged on its own. This
 * function reads that signal rather than adding a second, competing one.
 */
function confidenceOf(completedCount: number, wrongCount: number): MissionConfidence {
	if (completedCount === 0) return 'untouched';
	return wrongCount > 0 ? 'practising' : 'mastered';
}

/** Per-mission performance, for every mission in the game. */
export function summarizeMissions(progress: ChildProgress): MissionPerformanceSummary[] {
	const out: MissionPerformanceSummary[] = [];
	for (const id of AREA_ORDER) {
		for (const missionId of AREA_ROTATION[id]) {
			const mission = MISSIONS[missionId];
			if (!mission) continue;
			const perf = progress.missionPerformance[missionId];
			const completedCount = perf?.completedCount ?? 0;
			const wrongCount = perf?.wrongCount ?? 0;
			out.push({
				id: missionId,
				title: mission.title,
				area: mission.area,
				wrongCount,
				completedCount,
				firstTry: perf?.firstTry ?? false,
				confidence: confidenceOf(completedCount, wrongCount)
			});
		}
	}
	return out;
}

export interface LearningSnapshot {
	/** Missions finished at least once. */
	completed: number;
	/** Missions in the whole game. */
	total: number;
	/** Missions finished with no outstanding mistakes. */
	mastered: number;
	/** Missions attempted but still costing mistakes. */
	practising: number;
	/** Missions never finished. */
	untouched: number;
	/**
	 * Share of *finished* missions that were clean, 0–100.
	 *
	 * `null` when nothing has been finished yet — a percentage of nothing is
	 * not 0%, it is "no answer", and printing 0% would tell a parent their
	 * child is failing when they have simply not started.
	 */
	firstTryRate: number | null;
	/** Areas with every mission finished. */
	areasFinished: number;
	/** Areas with at least one mission finished. */
	areasStarted: number;
	/** Areas in the game. */
	areasTotal: number;
}

export function learningSnapshot(progress: ChildProgress): LearningSnapshot {
	const missions = summarizeMissions(progress);
	const mastered = missions.filter((m) => m.confidence === 'mastered').length;
	const practising = missions.filter((m) => m.confidence === 'practising').length;
	const completed = missions.filter((m) => m.completedCount > 0).length;
	const untouched = missions.length - completed;
	const finished = missions.filter((m) => m.completedCount > 0);
	const clean = finished.filter((m) => m.firstTry).length;

	return {
		completed,
		total: missions.length,
		mastered,
		practising,
		untouched,
		firstTryRate: finished.length > 0 ? Math.round((clean / finished.length) * 100) : null,
		areasFinished: AREA_ORDER.filter((id) => {
			const rotation = AREA_ROTATION[id];
			return rotation.length > 0 && rotation.every((m) => progress.completedMissions.includes(m));
		}).length,
		areasStarted: AREA_ORDER.filter((id) =>
			AREA_ROTATION[id].some((m) => progress.completedMissions.includes(m))
		).length,
		areasTotal: AREA_ORDER.length
	};
}

export interface PracticeSuggestion {
	/** The area to revisit. */
	areaName: string;
	areaIcon: string;
	/** Mission ids worth another go, hardest first. */
	missionTitles: string[];
}

/**
 * Missions worth practising, grouped by area, hardest first.
 *
 * Descending `wrongCount` is the whole ordering rule: the missions that cost
 * the most mistakes are the ones where practice helps most. Ties keep rotation
 * order so the dashboard is stable between visits.
 *
 * Returns at most `limit` areas and at most three missions per area — a list a
 * parent can act on, not a report to work through.
 */
export function practiceSuggestions(progress: ChildProgress, limit = 2): PracticeSuggestion[] {
	const missions = summarizeMissions(progress);
	const byArea = new Map<AreaId, MissionPerformanceSummary[]>();

	for (const mission of missions) {
		if (mission.confidence !== 'practising') continue;
		const list = byArea.get(mission.area) ?? [];
		list.push(mission);
		byArea.set(mission.area, list);
	}

	const rows: (PracticeSuggestion & { totalWrong: number })[] = [];
	for (const [area, list] of byArea) {
		const def = getArea(area);
		const ordered = [...list].sort((a, b) => b.wrongCount - a.wrongCount);
		rows.push({
			areaName: def.name,
			areaIcon: def.icon,
			missionTitles: ordered.slice(0, 3).map((m) => m.title),
			totalWrong: ordered.reduce((sum, m) => sum + m.wrongCount, 0)
		});
	}

	return rows
		.sort((a, b) => b.totalWrong - a.totalWrong)
		.slice(0, limit)
		.map(({ areaName, areaIcon, missionTitles }) => ({ areaName, areaIcon, missionTitles }));
}

/**
 * Offline activity ideas, chosen from what the child has actually practised.
 *
 * The dashboard's job is not only to report; a parent who has just read "your
 * child has practised 4 colours" benefits from knowing what to do about it
 * away from a screen. Each idea is tied to a real area this child has touched,
 * so the list is specific rather than a generic poster of suggestions.
 *
 * Returned as plain strings: there is no state, no progress, nothing to save.
 * These are things a parent does with their child, and the app must not pretend
 * to track them.
 */
export interface OfflineIdea {
	headline: string;
	detail: string;
}

export function offlineIdeas(progress: ChildProgress): OfflineIdea[] {
	const ideas: OfflineIdea[] = [];
	const started = (id: AreaId) =>
		AREA_ROTATION[id].some((m) => progress.completedMissions.includes(m));
	const lp = progress.learningProgress;

	if (started('counting') || lp.introducedNumbers.length > 0) {
		ideas.push({
			headline: 'Hitung benda di rumah',
			detail:
				'Hitung sendok, sepatu, atau buah di meja bersama anak. Sentuh satu per satu sambil menyebut angkanya — sama seperti saat mengetuk apel di pulau.'
		});
	}
	if (started('alphabet') || lp.introducedLetters.length > 0) {
		const known = lp.correctLetters.slice(0, 3);
		ideas.push({
			headline: 'Cari huruf di sekitar',
			detail: known.length
				? `Cari huruf ${known.join(', ')} pada kemasan, buku, atau papan nama. Anak yang mengenali huruf di rumah akan lebih cepat mengenalinya lagi.`
				: 'Cari huruf pertama dari nama anak pada kemasan atau buku di rumah.'
		});
	}
	if (started('reading') || lp.introducedSyllables.length > 0) {
		ideas.push({
			headline: 'Pecah kata jadi suku kata',
			detail:
				'Ucapkan kata dengan lambat sambil bertepuk: "BA-JU". Bertepuk per suku kata membuat irama kata terdengar, jauh sebelum anak bisa membacanya.'
		});
	}
	if (started('colors') || lp.introducedColors.length > 0) {
		ideas.push({
			headline: 'Bermain pola warna',
			detail:
				'Susun kancing, tutup botol, atau balok: merah, kuning, merah, kuning — lalu tanya warna apa berikutnya. Sama seperti pola di Kebun Warna.'
		});
	}
	if (started('animals') || lp.introducedAnimals.length > 0) {
		ideas.push({
			headline: 'Tebak suara hewan',
			detail:
				'Tirukan suara hewan dan minta anak menebak hewannya, lalu bergantian. Ini melatih pendengaran dan kosakata sekaligus.'
		});
	}
	if (started('music') || lp.introducedMusic.length > 0) {
		ideas.push({
			headline: 'Nada tinggi dan rendah',
			detail:
				'Ketuk gelas atau meja dengan tinggi berbeda, atau nyanyikan "naik" dengan suara tinggi lalu "turun" dengan suara rendah. Tanya mana yang lebih tinggi.'
		});
	}

	// A child who has not started anything still deserves an idea rather than
	// an empty section — silence here would read as "nothing to do".
	if (ideas.length === 0) {
		ideas.push({
			headline: 'Mulai dari menghitung',
			detail:
				'Di pulau, anak belajar paling cepat lewat menghitung benda. Di rumah, hitung lima benda bersama anak sambil menyentuhnya satu per satu.'
		});
	}

	return ideas;
}
