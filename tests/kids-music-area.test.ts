import { describe, expect, it } from 'vitest';
import { PitchSession } from '../src/lib/kids/activities/music/PitchSession';
import { pitchMission } from '../src/lib/kids/activities/music/pitchMission';
import { HIGH, LOW, PITCHES, getPitch, RHYTHMS } from '../src/lib/kids/data/music';
import { AREAS, AREA_ORDER } from '../src/lib/kids/data/areas';
import { AREA_ROTATION, AREA_START_MISSION, getMission, MISSIONS } from '../src/lib/kids/data/missions';
import { emptyProgress } from '../src/lib/kids/game/ProgressTypes';
import { applyMissionResult } from '../src/lib/kids/game/MissionReward';
import { summarizeAreas } from '../src/lib/kids/game/AreaSummary';

describe('music content', () => {
	it('offers a high and a low pitch, and the high one is genuinely higher', () => {
		expect(HIGH.frequency).toBeGreaterThan(LOW.frequency);
	});

	it('each pitch has a label and an icon', () => {
		for (const p of PITCHES) {
			expect(p.name.length).toBeGreaterThan(0);
			expect(p.icon.length).toBeGreaterThan(0);
		}
	});

	it('the two pitches sit in different bands, so a picture can show the idea', () => {
		expect(new Set(PITCHES.map((p) => p.band)).size).toBe(PITCHES.length);
	});

	it('looks a pitch up by id', () => {
		expect(getPitch('tinggi')?.name).toBe('Tinggi');
		expect(getPitch('nope')).toBeUndefined();
	});

	it('only offers beat lengths the game can draw', () => {
		for (const r of RHYTHMS) expect(r.beats).toBeGreaterThan(0);
	});
});

describe('PitchSession — a comparison needs two sounds', () => {
	const make = () => new PitchSession({ answer: 'tinggi', choices: ['Tinggi', 'Rendah'] });

	it('refuses every answer until both tones have played', () => {
		const s = make();
		// Not heard at all.
		expect(s.answer('Tinggi').refused).toBe(true);
		// Heard one of two: a comparison is not possible yet.
		s.markSoundHeard();
		expect(s.fullyHeard).toBe(false);
		expect(s.answer('Tinggi').refused).toBe(true);
		expect(s.wrongAttempts).toBe(0);
	});

	it('unlocks exactly when the second tone has played', () => {
		const s = make();
		s.markSoundHeard();
		s.markSoundHeard();
		expect(s.fullyHeard).toBe(true);
		expect(s.answer('Tinggi').correct).toBe(true);
	});

	it('never counts more than the two sounds it plays', () => {
		const s = make();
		for (let i = 0; i < 10; i++) s.markSoundHeard();
		expect(s.soundsHeard).toBe(2);
	});

	it('a wrong pick latches, and recovers without losing anything', () => {
		const s = make();
		s.markSoundHeard();
		s.markSoundHeard();
		expect(s.answer('Rendah').correct).toBe(false);
		expect(s.currentStep).toBe('answered-wrong');
		expect(s.wrongChoices).toEqual(['Rendah']);
		s.acknowledgeWrong();
		expect(s.answer('Tinggi').correct).toBe(true);
	});

	it('accepts the answer case-insensitively, so a label change cannot break it', () => {
		const s = make();
		s.markSoundHeard();
		s.markSoundHeard();
		expect(s.answer('tinggi').correct).toBe(true);
	});

	it('a second tap after success does not award twice', () => {
		const s = make();
		s.markSoundHeard();
		s.markSoundHeard();
		s.answer('Tinggi');
		expect(s.answer('Tinggi').refused).toBe(true);
	});

	it('refuses a value that is not a button', () => {
		const s = make();
		s.markSoundHeard();
		s.markSoundHeard();
		expect(s.answer('Sedang').refused).toBe(true);
		expect(s.wrongChoices).toEqual([]);
	});

	it('a replay re-arms the count, so the buttons lock again', () => {
		const s = make();
		s.markSoundHeard();
		s.markSoundHeard();
		s.resetHeard();
		expect(s.fullyHeard).toBe(false);
		expect(s.answer('Tinggi').refused).toBe(true);
	});

	it('refuses a question offering two identical sounds', () => {
		expect(() => new PitchSession({ answer: 'tinggi', choices: ['Tinggi', 'Tinggi'] })).toThrow();
	});

	it('refuses a question that does not offer both bands', () => {
		expect(() => new PitchSession({ answer: 'tinggi', choices: ['Tinggi', 'Sedang'] })).toThrow(/both/);
	});

	it('refuses a question with more than two sounds', () => {
		expect(() =>
			new PitchSession({ answer: 'tinggi', choices: ['Tinggi', 'Rendah', 'Sedang'] })
		).toThrow();
	});

	it('refuses an unknown answer band', () => {
		expect(() =>
			new PitchSession({ answer: 'sedang' as 'tinggi', choices: ['Tinggi', 'Rendah'] })
		).toThrow();
	});
});

describe('pitchMission — builder', () => {
	const base = {
		id: 'pitch-x',
		title: 'Mana yang Lebih Tinggi?',
		instruction: 'Dengarkan.',
		answer: 'tinggi' as const,
		lowFrequency: LOW.frequency,
		highFrequency: HIGH.frequency
	};

	it('derives the two labels itself', () => {
		const m = pitchMission(base);
		expect(m.choices).toEqual(['Tinggi', 'Rendah']);
		expect(m.targetAnswer).toBe('Tinggi');
	});

	it('shows no picture, because one would answer the question', () => {
		expect(pitchMission(base).prompt).toBeUndefined();
	});

	it('carries both frequencies', () => {
		const m = pitchMission(base);
		expect(m.pitches).toEqual({ low: LOW.frequency, high: HIGH.frequency });
	});

	it('records the concept it teaches', () => {
		expect(pitchMission(base).teaches?.music).toEqual(['Tinggi']);
	});

	it('throws when the "high" tone is not actually higher', () => {
		expect(() => pitchMission({ ...base, highFrequency: LOW.frequency })).toThrow(/higher/);
	});
});

describe('Pulau Musik is a real area', () => {
	it('is in the area order and has a definition', () => {
		expect(AREA_ORDER).toContain('music');
		expect(AREAS.music.id).toBe('music');
		expect(AREAS.music.name).toBe('Pulau Musik');
	});

	it('sits inside the island and apart from every other area', () => {
		const m = AREAS.music;
		expect(Math.hypot(m.position.x, m.position.z)).toBeLessThan(34);
		for (const id of AREA_ORDER) {
			if (id === 'music') continue;
			const other = AREAS[id];
			const d = Math.hypot(m.position.x - other.position.x, m.position.z - other.position.z);
			expect(d, `music is too close to ${id}`).toBeGreaterThan(8);
		}
	});

	it('has a rotation and a start mission that exist', () => {
		expect(AREA_ROTATION.music.length).toBeGreaterThan(0);
		const start = AREA_START_MISSION.music;
		expect(getMission(start), 'the music start mission is missing').toBeDefined();
		expect(getMission(start)!.area).toBe('music');
	});

	it('every mission in its rotation exists and belongs to it', () => {
		for (const id of AREA_ROTATION.music) {
			const m = getMission(id);
			expect(m, `${id} is missing`).toBeDefined();
			expect(m!.area).toBe('music');
		}
	});

	it('every music mission is a pitch comparison', () => {
		const musicMissions = Object.values(MISSIONS).filter((m) => m.area === 'music');
		expect(musicMissions.length).toBeGreaterThan(0);
		for (const m of musicMissions) {
			expect(m.kind, `${m.id} is not a pitch question`).toBe('compare-pitch');
			expect(m.pitches, `${m.id} has no tones`).toBeTruthy();
		}
	});
});

describe('finishing a music mission reaches the dashboard', () => {
	it('records the musical concept as correct', () => {
		const mission = getMission(AREA_START_MISSION.music)!;
		const p = applyMissionResult(emptyProgress(), mission);
		expect(p.learningProgress.correctMusic).toEqual(['Tinggi']);
		expect(p.learningProgress.introducedMusic).toEqual(['Tinggi']);
	});

	it('the area appears in the parent summary with its own total', () => {
		const mission = getMission(AREA_START_MISSION.music)!;
		const p = applyMissionResult(emptyProgress(), mission);
		const rows = summarizeAreas(p);
		const music = rows.find((r) => r.id === 'music');
		expect(music, 'music is missing from the parent summary').toBeDefined();
		expect(music!.total).toBe(AREA_ROTATION.music.length);
		expect(music!.completed).toBe(1);
		expect(music!.percent).toBeGreaterThan(0);
	});
});
