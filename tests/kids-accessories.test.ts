import { describe, expect, it } from 'vitest';
import {
	ACCESSORIES,
	NO_ACCESSORY,
	accessoriesForSlot,
	availableAccessories,
	getAccessory,
	resolveWearing,
	type AccessorySlot
} from '../src/lib/kids/data/accessories';

/**
 * The reward catalogue's *rules*, not its contents.
 *
 * The single most important test in this file is "nothing is ever withheld":
 * this project promises no locked content, and a helper that quietly starts
 * filtering by star count would break that promise without any symptom a
 * child could report. The test is written so it fails the moment a condition
 * is introduced.
 */
describe('the catalogue never withholds anything', () => {
	it('offers every accessory, with no progress argument at all', () => {
		// `availableAccessories` takes no parameters by design: there is no
		// star count to pass in, so there is no star count to gate on.
		expect(availableAccessories()).toHaveLength(ACCESSORIES.length);
	});

	it('never marks an accessory as locked, priced or coming soon', () => {
		for (const accessory of ACCESSORIES) {
			// A field named like a gate must not appear on the type or the data.
			const keys = Object.keys(accessory);
			for (const forbidden of ['locked', 'unlocked', 'required', 'price', 'minStars', 'unlockAt']) {
				expect(keys, `${accessory.id} has a gating field`).not.toContain(forbidden);
			}
		}
	});

	it('every accessory has a picture and a name a non-reader can use', () => {
		for (const accessory of ACCESSORIES) {
			expect(accessory.icon.length, `${accessory.id} icon`).toBeGreaterThan(0);
			expect(accessory.name.length, `${accessory.id} name`).toBeGreaterThan(0);
			expect(accessory.description.length, `${accessory.id} description`).toBeGreaterThan(0);
		}
	});

	it('ids are unique, so a saved preference resolves to one thing', () => {
		const ids = ACCESSORIES.map((a) => a.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(ids).not.toContain(NO_ACCESSORY);
	});

	it('covers every slot, so no row in the picker is empty', () => {
		const slots: AccessorySlot[] = ['head', 'neck', 'back'];
		for (const slot of slots) {
			expect(accessoriesForSlot(slot).length, slot).toBeGreaterThan(0);
		}
	});
});

describe('resolving what is worn', () => {
	it('finds a real accessory', () => {
		expect(getAccessory('topi-merah')?.name).toBe('Topi Merah');
	});

	it('treats "none" as wearing nothing', () => {
		expect(getAccessory(NO_ACCESSORY)).toBeNull();
		expect(resolveWearing(NO_ACCESSORY)).toBeNull();
	});

	it('treats null and undefined as wearing nothing', () => {
		expect(resolveWearing(null)).toBeNull();
		expect(resolveWearing(undefined)).toBeNull();
	});

	it('returns nothing for an id from an older build, rather than throwing', () => {
		// A child must never be blocked by a stale saved record.
		expect(() => resolveWearing('topi-yang-sudah-dihapus')).not.toThrow();
		expect(resolveWearing('topi-yang-sudah-dihapus')).toBeNull();
	});

	it('every catalogue id resolves back to itself', () => {
		for (const accessory of ACCESSORIES) {
			expect(resolveWearing(accessory.id)?.id).toBe(accessory.id);
		}
	});
});

describe('the catalogue covers the slots the renderer supports', () => {
	it('has at least one accessory for the head, which the picker anchors on', () => {
		const heads = accessoriesForSlot('head');
		expect(heads.length).toBeGreaterThanOrEqual(3);
	});

	it('every colour is a valid 24-bit number', () => {
		for (const accessory of ACCESSORIES) {
			expect(Number.isInteger(accessory.colors.primary), accessory.id).toBe(true);
			expect(accessory.colors.primary).toBeGreaterThanOrEqual(0);
			expect(accessory.colors.primary).toBeLessThanOrEqual(0xffffff);
			if (accessory.colors.secondary !== undefined) {
				expect(accessory.colors.secondary).toBeGreaterThanOrEqual(0);
				expect(accessory.colors.secondary).toBeLessThanOrEqual(0xffffff);
			}
		}
	});
});
