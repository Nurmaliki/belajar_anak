import { describe, expect, it } from 'vitest';
import { emptyProgress, type ChildProgress } from '../src/lib/kids/game/ProgressTypes';
import { applyMissionResult, applyMissionWrong } from '../src/lib/kids/game/MissionReward';
import {
	learningSnapshot,
	offlineIdeas,
	practiceSuggestions,
	summarizeMissions
} from '../src/lib/kids/game/ProgressInsights';
import { getMission } from '../src/lib/kids/data/missions';

/** Finish a mission cleanly. */
function clean(p: ChildProgress, id: string): ChildProgress {
	return applyMissionResult(p, getMission(id)!);
}

/** Finish a mission after `wrong` mistakes. */
function struggled(p: ChildProgress, id: string, wrong: number): ChildProgress {
	let next = p;
	for (let i = 0; i < wrong; i++) next = applyMissionWrong(next, id);
	return applyMissionResult(next, getMission(id)!);
}

describe('summarizeMissions', () => {
	it('lists every mission in every rotation, once', () => {
		const rows = summarizeMissions(emptyProgress());
		const ids = rows.map((r) => r.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(ids.length).toBeGreaterThan(0);
	});

	it('marks everything untouched on a fresh save', () => {
		for (const row of summarizeMissions(emptyProgress())) {
			expect(row.confidence).toBe('untouched');
			expect(row.completedCount).toBe(0);
		}
	});

	it('a clean completion is mastered', () => {
		const rows = summarizeMissions(clean(emptyProgress(), 'count-apples-3'));
		const row = rows.find((r) => r.id === 'count-apples-3')!;
		expect(row.confidence).toBe('mastered');
		expect(row.firstTry).toBe(true);
		expect(row.wrongCount).toBe(0);
	});

	it('a completion after mistakes is practising, not mastered', () => {
		const rows = summarizeMissions(struggled(emptyProgress(), 'count-apples-3', 2));
		const row = rows.find((r) => r.id === 'count-apples-3')!;
		expect(row.confidence).toBe('practising');
		expect(row.firstTry).toBe(false);
		expect(row.wrongCount).toBeGreaterThan(0);
	});

	it('records the mission title and area for the parent to read', () => {
		const row = summarizeMissions(emptyProgress()).find((r) => r.id === 'pitch-tinggi')!;
		expect(row.title).toBe('Mana yang Lebih Tinggi?');
		expect(row.area).toBe('music');
	});
});

describe('learningSnapshot', () => {
	it('reports a total that matches the mission list', () => {
		const snap = learningSnapshot(emptyProgress());
		expect(snap.total).toBe(summarizeMissions(emptyProgress()).length);
		expect(snap.completed).toBe(0);
		expect(snap.untouched).toBe(snap.total);
	});

	it('says "no answer" rather than 0% when nothing is finished', () => {
		// A percentage of nothing is not a failing grade.
		expect(learningSnapshot(emptyProgress()).firstTryRate).toBeNull();
	});

	it('counts mastered, practising and untouched as a partition of the total', () => {
		let p = clean(emptyProgress(), 'count-apples-3');
		p = struggled(p, 'count-apples-5', 2);
		const snap = learningSnapshot(p);
		expect(snap.mastered + snap.practising + snap.untouched).toBe(snap.total);
		expect(snap.completed).toBe(snap.mastered + snap.practising);
	});

	it('firstTryRate is the clean share of finished missions', () => {
		let p = clean(emptyProgress(), 'count-apples-3');
		p = struggled(p, 'count-apples-5', 2);
		const snap = learningSnapshot(p);
		// 1 clean of 2 finished.
		expect(snap.firstTryRate).toBe(50);
	});

	it('counts areas started and finished', () => {
		let p = clean(emptyProgress(), 'count-apples-3');
		let snap = learningSnapshot(p);
		expect(snap.areasStarted).toBe(1);
		expect(snap.areasFinished).toBe(0);

		p = clean(p, 'count-apples-5');
		snap = learningSnapshot(p);
		expect(snap.areasStarted).toBe(1);
		expect(snap.areasFinished).toBe(0);
	});

	it('an area with every mission done counts as finished', () => {
		// Music has two missions, the smallest area — finish both.
		let p = clean(emptyProgress(), 'pitch-tinggi');
		expect(learningSnapshot(p).areasFinished).toBe(0);
		p = clean(p, 'pitch-rendah');
		expect(learningSnapshot(p).areasFinished).toBe(1);
	});

	it('never reports more areas than exist', () => {
		const snap = learningSnapshot(emptyProgress());
		expect(snap.areasStarted).toBeLessThanOrEqual(snap.areasTotal);
		expect(snap.areasFinished).toBeLessThanOrEqual(snap.areasTotal);
	});
});

describe('practiceSuggestions', () => {
	it('suggests nothing when nothing has been struggled with', () => {
		expect(practiceSuggestions(emptyProgress())).toEqual([]);
		expect(practiceSuggestions(clean(emptyProgress(), 'count-apples-3'))).toEqual([]);
	});

	it('suggests the mission the child struggled with', () => {
		const p = struggled(emptyProgress(), 'count-apples-5', 3);
		const out = practiceSuggestions(p);
		expect(out.length).toBe(1);
		expect(out[0].areaName).toBe('Pulau Berhitung');
		expect(out[0].missionTitles).toContain('Kumpulkan lima apel');
	});

	it('never suggests a mastered mission', () => {
		let p = struggled(emptyProgress(), 'count-apples-5', 3);
		p = clean(p, 'count-apples-3');
		const titles = practiceSuggestions(p).flatMap((s) => s.missionTitles);
		expect(titles).not.toContain('Kumpulkan tiga apel');
	});

	it('orders areas by total mistakes, hardest first', () => {
		let p = struggled(emptyProgress(), 'count-apples-5', 1);
		p = struggled(p, 'letter-a', 5);
		const out = practiceSuggestions(p);
		expect(out[0].areaName).toBe('Hutan Huruf');
	});

	it('caps the number of areas and missions it reports', () => {
		let p = struggled(emptyProgress(), 'count-apples-3', 2);
		p = struggled(p, 'count-apples-5', 2);
		p = struggled(p, 'letter-a', 2);
		p = struggled(p, 'letter-b', 2);
		p = struggled(p, 'pitch-tinggi', 2);
		const out = practiceSuggestions(p, 2);
		expect(out.length).toBeLessThanOrEqual(2);
		for (const s of out) expect(s.missionTitles.length).toBeLessThanOrEqual(3);
	});

	it('the same save always gives the same suggestion', () => {
		const p = struggled(emptyProgress(), 'count-apples-5', 2);
		expect(practiceSuggestions(p)).toEqual(practiceSuggestions(p));
	});
});

describe('offlineIdeas', () => {
	it('always offers at least one idea', () => {
		expect(offlineIdeas(emptyProgress()).length).toBeGreaterThan(0);
	});

	it('only suggests areas the child has actually touched', () => {
		const p = clean(emptyProgress(), 'pitch-tinggi');
		const ideas = offlineIdeas(p);
		const text = ideas.map((i) => i.headline).join(' | ');
		expect(text).toContain('Nada');
		expect(text, 'suggested counting before it was played').not.toContain('Hitung benda');
	});

	it('every idea has a headline and a detail worth reading', () => {
		let p = clean(emptyProgress(), 'count-apples-3');
		p = clean(p, 'pitch-tinggi');
		for (const idea of offlineIdeas(p)) {
			expect(idea.headline.length).toBeGreaterThan(0);
			expect(idea.detail.length).toBeGreaterThan(20);
		}
	});

	it('does not repeat the same idea twice', () => {
		let p = clean(emptyProgress(), 'count-apples-3');
		p = clean(p, 'count-apples-5');
		const headlines = offlineIdeas(p).map((i) => i.headline);
		expect(new Set(headlines).size).toBe(headlines.length);
	});
});
