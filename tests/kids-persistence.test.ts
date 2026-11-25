import { describe, expect, it } from 'vitest';
import { ProgressRepository } from '../src/lib/kids/storage/ProgressRepository';
import { emptyProgress } from '../src/lib/kids/game/ProgressTypes';
import { applyMissionResult } from '../src/lib/kids/game/MissionReward';
import { getMission } from '../src/lib/kids/data/missions';

/**
 * Regression tests for a bug found by the browser end-to-end test and invisible
 * to a node test that did not check for it:
 *
 * `save()` was handed a Svelte 5 `$state` value, which is a **Proxy**. IndexedDB
 * structured-clones whatever it stores, and `structuredClone` throws
 * `DataCloneError` on a Proxy. The write failed, the error was swallowed into
 * `lastError`, and the parent dashboard then read an empty database — the child
 * earned stars that were never saved.
 *
 * The repository now normalises to a plain object itself. These tests pin that:
 * a proxied record must save exactly like a plain one.
 */
describe('ProgressRepository.save — accepts reactive state', () => {
	/** A stand-in for Svelte's `$state` proxy: a Proxy over the same data. */
	function asProxy<T extends object>(value: T): T {
		return new Proxy(value, {});
	}

	it('structuredClone rejects a Proxy, which is why save() normalises', () => {
		const p = asProxy(emptyProgress());
		expect(() => structuredClone(p)).toThrow();
	});

	it('saves a proxied record without a clone error even when IndexedDB is absent', async () => {
		const repo = new ProgressRepository();
		await repo.open();
		const p = asProxy(emptyProgress());
		// Must not throw; in node there is no IndexedDB, so it returns false and
		// keeps the data in memory. The point is that no DataCloneError occurs.
		await expect(repo.save(p)).resolves.toBeTypeOf('boolean');
		expect(repo.error ?? '').not.toMatch(/clone/i);
		// The in-memory mirror still holds the record.
		expect((await repo.load()).version).toBeGreaterThan(0);
	});

	it('keeps the saved data readable after the proxy goes away', async () => {
		const repo = new ProgressRepository();
		await repo.open();
		let p = emptyProgress();
		p = applyMissionResult(p, getMission('letter-b')!);
		await repo.save(asProxy(p));
		const back = await repo.load();
		expect(back.totalStars).toBeGreaterThan(0);
		expect(back.completedMissions).toContain('letter-b');
		expect(back.learningProgress.correctLetters).toContain('B');
	});

	it('the stored record is detached from the caller’s object', async () => {
		const repo = new ProgressRepository();
		await repo.open();
		const p = applyMissionResult(emptyProgress(), getMission('color-merah')!);
		await repo.save(p);
		const starsAfterSave = (await repo.load()).totalStars;
		// Mutating the caller's object afterwards must not change what was saved.
		p.totalStars = 999;
		expect((await repo.load()).totalStars).toBe(starsAfterSave);
	});
});
