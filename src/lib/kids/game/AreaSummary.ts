import type { ChildProgress } from './ProgressTypes';
import type { AreaId } from '../types';
import { AREA_ORDER, getArea } from '../data/areas';
import { MISSIONS, AREA_ROTATION, areaMissionCount } from '../data/missions';

/**
 * Per-area progress, computed from the stored record.
 *
 * Kept pure and free of IndexedDB and Svelte so the arithmetic that a parent
 * reads as "how is my child doing in each area?" can be unit tested directly.
 * The dashboard only renders what this returns.
 *
 * Why derive rather than store: `completedMissions` already records every win,
 * and each mission carries its `area`. Storing a per-area tally as well would
 * give two sources of truth that can drift apart — the exact failure this
 * project already hit once with stars in memory versus stars in the database.
 */
export interface AreaSummary {
	id: AreaId;
	/** Display name, e.g. "Pulau Berhitung". */
	name: string;
	/** Icon, so a parent scans the list by picture as the child would. */
	icon: string;
	/** Missions in this area's rotation. */
	total: number;
	/** How many of them the child has finished at least once. */
	completed: number;
	/** Stars earned in this area (awarded once per mission id). */
	stars: number;
	/** 0–100, rounded. Never NaN, even for an area with no missions. */
	percent: number;
}

/** A mission id → its area, built once from the mission table. */
const MISSION_AREA: Map<string, AreaId> = new Map(
	Object.values(MISSIONS).map((m) => [m.id, m.area] as const)
);

/**
 * How many missions each area really offers.
 *
 * `areaMissionCount` reports the rotation length; missions are counted from
 * the rotation on purpose, so a mission that exists in the table but was never
 * added to a rotation cannot inflate the denominator and leave a child stuck
 * at "7 of 9" forever.
 */
function areaTotals(): Record<AreaId, number> {
	const totals = {} as Record<AreaId, number>;
	for (const id of AREA_ORDER) totals[id] = areaMissionCount(id);
	return totals;
}

export function summarizeAreas(progress: ChildProgress): AreaSummary[] {
	const totals = areaTotals();
	const completedByArea = new Map<AreaId, string[]>();
	for (const missionId of progress.completedMissions) {
		const area = MISSION_AREA.get(missionId);
		// A mission id from an older build that no longer exists is skipped
		// rather than counted against an area it cannot be matched to.
		if (!area) continue;
		const list = completedByArea.get(area) ?? [];
		if (!list.includes(missionId)) list.push(missionId);
		completedByArea.set(area, list);
	}

	return AREA_ORDER.map((id) => {
		const def = getArea(id);
		const completedIds = completedByArea.get(id) ?? [];
		const total = totals[id];
		const stars = completedIds.reduce((sum, missionId) => {
			const mission = MISSIONS[missionId];
			return sum + (mission?.stars ?? 0);
		}, 0);
		const completed = completedIds.length;
		const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
		return {
			id,
			name: def.name,
			icon: def.icon,
			total,
			completed,
			stars,
			percent
		};
	});
}

/** An area is "started" once at least one of its missions is finished. */
export function hasStarted(area: AreaSummary): boolean {
	return area.completed > 0;
}

/** An area is "finished" when every mission in its rotation is done. */
export function isFinished(area: AreaSummary): boolean {
	return area.total > 0 && area.completed >= area.total;
}

/** A one-line, parent-facing status for an area. */
export function areaStatus(area: AreaSummary): string {
	if (area.total === 0) return 'Belum ada misi';
	if (isFinished(area)) return 'Semua misi selesai';
	if (!hasStarted(area)) return 'Belum dicoba';
	return `${area.completed} dari ${area.total} misi selesai`;
}

/**
 * What the child should try next.
 *
 * Picks the lowest-progress area that is not yet finished, then returns the
 * first mission in that area's rotation the child has not completed. When
 * every area is done, returns null. The parent can show this as "Coba berikutnya".
 *
 * Pure, no side-effects — unit-testable in isolation.
 */
export interface NextMission {
	areaName: string;
	areaIcon: string;
	missionTitle: string;
	areaPercent: number;
}

export function nextRecommendation(
	progress: ChildProgress,
	summaries: AreaSummary[]
): NextMission | null {
	const candidates = summaries
		.filter((a) => a.total > 0 && !isFinished(a))
		.sort((a, b) => a.percent - b.percent);

	if (candidates.length === 0) return null;

	const target = candidates[0];
	// Find the rotation order for this area.
	const areaRotation = AREA_ROTATION[target.id] ?? [];
	const completed = new Set(progress.completedMissions);
	for (const id of areaRotation) {
		if (!completed.has(id)) {
			const mission = MISSIONS[id];
			return mission
				? {
						areaName: target.name,
						areaIcon: target.icon,
						missionTitle: mission.title,
						areaPercent: target.percent
					}
				: null;
		}
	}
	return null;
}
