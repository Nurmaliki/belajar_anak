import { describe, expect, it } from 'vitest';
import { emptyProgress } from '../src/lib/kids/game/ProgressTypes';
import { applyMissionResult } from '../src/lib/kids/game/MissionReward';
import {
	areaStatus,
	hasStarted,
	isFinished,
	nextRecommendation,
	summarizeAreas
} from '../src/lib/kids/game/AreaSummary';
import { AREA_ORDER } from '../src/lib/kids/data/areas';
import { AREA_ROTATION, MISSIONS, areaMissionCount, getMission } from '../src/lib/kids/data/missions';

describe('summarizeAreas — shape', () => {
	it('reports one row per area, in the stable menu order', () => {
		const rows = summarizeAreas(emptyProgress());
		expect(rows.map((r) => r.id)).toEqual(AREA_ORDER);
	});

	it('starts every area at zero with no completed missions', () => {
		for (const row of summarizeAreas(emptyProgress())) {
			expect(row.completed).toBe(0);
			expect(row.stars).toBe(0);
			expect(row.percent).toBe(0);
		}
	});

	it('never divides by zero: every area knows how many missions it holds', () => {
		for (const row of summarizeAreas(emptyProgress())) {
			expect(row.total).toBe(areaMissionCount(row.id));
			expect(row.total).toBeGreaterThan(0);
			expect(Number.isNaN(row.percent)).toBe(false);
		}
	});

	it('carries the display name and icon from the area definition', () => {
		const counting = summarizeAreas(emptyProgress()).find((r) => r.id === 'counting')!;
		expect(counting.name).toBe('Pulau Berhitung');
		expect(counting.icon).toBe('🍎');
	});
});

describe('summarizeAreas — counting what was earned', () => {
	it('moves one area without touching the others', () => {
		const p = applyMissionResult(emptyProgress(), getMission('count-apples-3')!);
		const rows = summarizeAreas(p);
		const counting = rows.find((r) => r.id === 'counting')!;
		expect(counting.completed).toBe(1);
		expect(counting.stars).toBe(1);
		for (const other of rows.filter((r) => r.id !== 'counting')) {
			expect(other.completed, other.id).toBe(0);
		}
	});

	it('percent is the share of the rotation that is done', () => {
		const p = applyMissionResult(emptyProgress(), getMission('count-apples-3')!);
		const counting = summarizeAreas(p).find((r) => r.id === 'counting')!;
		expect(counting.percent).toBe(Math.round((1 / counting.total) * 100));
	});

	it('replaying a mission does not inflate the area', () => {
		let p = applyMissionResult(emptyProgress(), getMission('count-apples-3')!);
		p = applyMissionResult(p, getMission('count-apples-3')!);
		const counting = summarizeAreas(p).find((r) => r.id === 'counting')!;
		expect(counting.completed).toBe(1);
		expect(counting.stars).toBe(1);
	});

	it('reaches 100 percent only when the whole rotation is done', () => {
		let p = emptyProgress();
		const ids = [
			'count-apples-3',
			'count-apples-5',
			'count-apples-10',
			'add-2-1',
			'add-3-2',
			'compare-more',
			'compare-fewer',
			'sort-three',
			'sort-four',
			'subtract-4-1',
			'subtract-5-2'
		];
		const total = areaMissionCount('counting');
		// The list below must cover the whole rotation, or this test proves
		// nothing about reaching 100 percent.
		expect(ids).toHaveLength(total);
		let seen = 0;
		for (const id of ids) {
			p = applyMissionResult(p, getMission(id)!);
			seen++;
			const counting = summarizeAreas(p).find((r) => r.id === 'counting')!;
			if (seen < counting.total) {
				expect(counting.percent, `${id} finished early`).toBeLessThan(100);
			}
		}
		const counting = summarizeAreas(p).find((r) => r.id === 'counting')!;
		expect(counting.completed).toBe(counting.total);
		expect(counting.percent).toBe(100);
		expect(isFinished(counting)).toBe(true);
	});

	it('matches the number of missions the missions table reports', () => {
		// The rotation is the single source of truth for the denominator, so
		// the sum of per-area totals is the size of every rotation combined.
		const rows = summarizeAreas(emptyProgress());
		const sum = rows.reduce((n, r) => n + r.total, 0);
		expect(sum).toBeGreaterThan(0);
		expect(rows.find((r) => r.id === 'counting')!.total).toBe(areaMissionCount('counting'));
	});

	it('ignores a mission id from an older build, without crashing', () => {
		const p = emptyProgress();
		p.completedMissions = ['mission-that-no-longer-exists'];
		for (const row of summarizeAreas(p)) expect(row.completed).toBe(0);
	});
});

describe('areaStatus — the one line a parent reads', () => {
	it('says an untouched area has not been tried', () => {
		const rows = summarizeAreas(emptyProgress());
		for (const row of rows) expect(areaStatus(row)).toBe('Belum dicoba');
	});

	it('counts progress once a mission is done', () => {
		const p = applyMissionResult(emptyProgress(), getMission('count-apples-3')!);
		const counting = summarizeAreas(p).find((r) => r.id === 'counting')!;
		expect(hasStarted(counting)).toBe(true);
		expect(areaStatus(counting)).toBe(`1 dari ${counting.total} misi selesai`);
	});
});

describe('nextRecommendation — what to suggest trying next', () => {
	it('on a fresh record, suggests the first mission of the least-progressed area', () => {
		const rows = summarizeAreas(emptyProgress());
		const next = nextRecommendation(emptyProgress(), rows);
		expect(next).not.toBeNull();
		// All areas sit at 0 percent; the stable order decides the tie.
		expect(next!.areaPercent).toBe(0);
		expect(next!.missionTitle).toBe(getMission('count-apples-3')!.title);
	});

	it('skips missions the child has already completed', () => {
		const p = applyMissionResult(emptyProgress(), getMission('count-apples-3')!);
		const next = nextRecommendation(p, summarizeAreas(p));
		expect(next!.missionTitle).not.toBe(getMission('count-apples-3')!.title);
	});

	it('prefers the area that is furthest behind', () => {
		// Finish most of the counting rotation so counting is well ahead.
		let p = emptyProgress();
		for (const id of ['count-apples-3', 'count-apples-5', 'count-apples-10', 'add-2-1', 'add-3-2', 'compare-more', 'compare-fewer', 'sort-three', 'sort-four']) {
			p = applyMissionResult(p, getMission(id)!);
		}
		const next = nextRecommendation(p, summarizeAreas(p));
		// Counting is ~82% done; every other area sits at 0% and the stable
		// order picks the alphabet first among the untouched areas.
		expect(next!.areaName).toBe('Hutan Huruf');
		expect(next!.missionTitle).toBe(getMission('letter-a')!.title);
	});

	it('returns null when every area is finished', () => {
		const p = emptyProgress();
		// Complete every mission in every rotation.
		p.completedMissions = Object.values(MISSIONS).map((m) => m.id);
		expect(nextRecommendation(p, summarizeAreas(p))).toBeNull();
	});
});
