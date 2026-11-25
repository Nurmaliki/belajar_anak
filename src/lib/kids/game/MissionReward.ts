import type { ChildProgress } from '../game/ProgressTypes';
import { ProgressRepository } from '../storage/ProgressRepository';
import type { AreaId, MissionDefinition } from '../types';
import { getArea, AREA_ORDER } from '../data/areas';

/**
 * The single place a finished mission turns into a saved record.
 *
 * Kept pure and free of IndexedDB so it can be unit tested directly: the
 * repository only stores what this returns. Before this existed, the engine
 * incremented a stars counter in memory and the parent dashboard read zeros
 * from the database — the two disagreed and nothing noticed.
 *
 * Rules encoded here:
 *  - Stars are awarded **once per mission id**. Replaying a mission is
 *    encouraged and still feels rewarding through the celebration, but it does
 *    not inflate the star count.
 *  - What a mission teaches is recorded as *correct* only when the child
 *    answered it correctly, which is what "mastered" means on the dashboard.
 *  - Finishing a mission unlocks its area, and the first completion of any
 *    mission also unlocks the area it belongs to.
 */
export interface MissionResult {
	mission: MissionDefinition;
}

export function applyMissionResult(progress: ChildProgress, mission: MissionDefinition): ChildProgress {
	let next = ProgressRepository.completeMission(progress, mission.id, mission.stars);
	next = ProgressRepository.unlockArea(next, mission.area);
	next = ProgressRepository.recordCompleted(next, mission.id);

	const teaches = mission.teaches;
	if (teaches) {
		for (const n of teaches.numbers ?? []) {
			next = ProgressRepository.correctNumber(next, n);
		}
		for (const l of teaches.letters ?? []) {
			next = ProgressRepository.correctLetter(next, l);
		}
		for (const s of teaches.syllables ?? []) {
			next = ProgressRepository.correctSyllable(next, s);
		}
	}
	return next;
}

/**
 * Record that the child answered a mission wrongly.
 *
 * Kept alongside `applyMissionResult` so the engine can report attempts
 * through the same pure path the host already uses for stars — the engine
 * never touches storage, and this keeps the adaptive signal in the same
 * versioned, validated record as everything else.
 */
export function applyMissionWrong(progress: ChildProgress, missionId: string): ChildProgress {
	return ProgressRepository.recordWrong(progress, missionId);
}

/**
 * Record that the child was *shown* the content of a mission.
 *
 * Called when a mission starts, not when it ends: "introduced" should reflect
 * what the child has seen, and a child who wanders off midway has still seen
 * the letter.
 */
export function applyMissionIntroduced(
	progress: ChildProgress,
	mission: MissionDefinition
): ChildProgress {
	let next = progress;
	const teaches = mission.teaches;
	if (teaches) {
		for (const n of teaches.numbers ?? []) next = ProgressRepository.introduceNumber(next, n);
		for (const l of teaches.letters ?? []) next = ProgressRepository.introduceLetter(next, l);
		for (const s of teaches.syllables ?? []) {
			next = ProgressRepository.introduceSyllable(next, s);
		}
	}
	return next;
}

/**
 * Areas the child has earned access to.
 *
 * Currently every area is open from the start — a locked gate in front of a
 * preschooler produces tears, not motivation. The function exists so the
 * dashboard can tell a parent which areas the child has actually visited, and
 * so a future "unlock as a reward" feature has one place to change.
 */
export function unlockedAreas(progress: ChildProgress): AreaId[] {
	const seen = new Set(progress.unlockedAreas);
	return AREA_ORDER.filter((id) => seen.has(id));
}

/** Human-readable area name, for the dashboard. */
export function areaName(id: string): string {
	const known = AREA_ORDER.find((a) => a === id);
	return known ? getArea(known).name : id;
}
