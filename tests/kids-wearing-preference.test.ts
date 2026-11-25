import { describe, expect, it } from 'vitest';
import {
	readWearingPreference,
	writeWearingPreference
} from '../src/lib/kids/game/ProgressTypes';

/**
 * The outfit lives in `localStorage`, not in the progress database.
 *
 * It used to live only in `ChildProgress.wearing`, which meant that every time
 * IndexedDB was unavailable — private mode, a full disk, a locked-down WebView —
 * the child's hat was gone on the next load, even though `localStorage` worked
 * perfectly. An outfit is not an achievement: there is no unlock condition and
 * nothing to lose, so it does not belong behind the database.
 *
 * These tests run in plain Node, where `localStorage` does not exist at all.
 * That is the point: every access must be guarded, because a browser in private
 * mode throws on *access*, not only on write.
 */

describe('the outfit preference never throws', () => {
	it('reads "none" where there is no localStorage', () => {
		expect(typeof localStorage).toBe('undefined');
		expect(readWearingPreference()).toBe('none');
	});

	it('writes nothing, and does not throw, where there is no localStorage', () => {
		expect(() => writeWearingPreference('mahkota')).not.toThrow();
		expect(readWearingPreference()).toBe('none');
	});
});

describe('the outfit preference round-trips where storage exists', () => {
	it('remembers what was written', () => {
		const store = new Map<string, string>();
		const original = globalThis.localStorage;
		Object.defineProperty(globalThis, 'localStorage', {
			configurable: true,
			value: {
				getItem: (k: string) => store.get(k) ?? null,
				setItem: (k: string, v: string) => void store.set(k, v)
			}
		});
		try {
			writeWearingPreference('syal-biru');
			expect(readWearingPreference()).toBe('syal-biru');
			writeWearingPreference('none');
			expect(readWearingPreference()).toBe('none');
		} finally {
			if (original === undefined) {
				Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: undefined });
			} else {
				Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: original });
			}
		}
	});

	it('survives a store that refuses to write', () => {
		const original = globalThis.localStorage;
		Object.defineProperty(globalThis, 'localStorage', {
			configurable: true,
			value: {
				getItem: () => {
					throw new Error('blocked');
				},
				setItem: () => {
					throw new Error('quota exceeded');
				}
			}
		});
		try {
			expect(() => writeWearingPreference('mahkota')).not.toThrow();
			expect(readWearingPreference()).toBe('none');
		} finally {
			if (original === undefined) {
				Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: undefined });
			} else {
				Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: original });
			}
		}
	});
});
