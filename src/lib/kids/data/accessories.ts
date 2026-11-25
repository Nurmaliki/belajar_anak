/**
 * The reward catalogue: what Bubu can wear.
 *
 * **Everything here is available from the first launch.** There is no unlock
 * condition, no price, and no "coming soon". That is not an oversight — it is
 * the one rule this project will not bend. `AGENTS.md` bans locked content,
 * and the roadmap's original wording ("reward unlock catalogue") was rejected
 * for this age group: a three-year-old cannot distinguish "you have not earned
 * this yet" from "you are not good enough", and the screen that follows is
 * tears, not motivation.
 *
 * So the catalogue does what a dressing-up box does. The stars are a *record*
 * of what the child did, shown beside the box; they are never a key.
 *
 * Kept free of Three.js and Svelte so the rules — and the no-gating rule in
 * particular — are testable in Node.
 */

/** Which part of Bubu an accessory attaches to. */
export type AccessorySlot = 'head' | 'neck' | 'back';

export interface Accessory {
	id: string;
	/** Shown in the picker. */
	name: string;
	/** Large glyph for the button, so a non-reader can choose. */
	icon: string;
	slot: AccessorySlot;
	/**
	 * Colours the renderer needs, as hex numbers.
	 *
	 * Data, not geometry: this module must stay importable in a Node test, so
	 * it describes *what* to build and the engine decides *how*.
	 */
	colors: {
		primary: number;
		secondary?: number;
	};
	/** What a grown-up would call it, for the parent dashboard. */
	description: string;
}

/** No accessory at all. Always offered first, always available. */
export const NO_ACCESSORY = 'none';

export const ACCESSORIES: readonly Accessory[] = [
	{
		id: 'topi-merah',
		name: 'Topi Merah',
		icon: '🧢',
		slot: 'head',
		colors: { primary: 0xe4572e, secondary: 0xffd6c2 },
		description: 'Topi baseball merah dengan brim lebar.'
	},
	{
		id: 'mahkota',
		name: 'Mahkota',
		icon: '👑',
		slot: 'head',
		colors: { primary: 0xffc93c, secondary: 0xff6fae },
		description: 'Mahkota emas dengan lima titik.'
	},
	{
		id: 'topi-pesta',
		name: 'Topi Pesta',
		icon: '🎉',
		slot: 'head',
		colors: { primary: 0x8f6bff, secondary: 0xffe066 },
		description: 'Topi kerucut warna ungu dengan pompom.'
	},
	{
		id: 'syal-biru',
		name: 'Syal Biru',
		icon: '🧣',
		slot: 'neck',
		colors: { primary: 0x4aa3ff, secondary: 0xd9efff },
		description: 'Syal lembut yang melingkar di leher.'
	},
	{
		id: 'syal-hijau',
		name: 'Syal Hijau',
		icon: '💚',
		slot: 'neck',
		colors: { primary: 0x4fc26b, secondary: 0xd9f7e1 },
		description: 'Syal hijau daun dengan ujung menggantung.'
	},
	{
		id: 'sayap-peri',
		name: 'Sayap Peri',
		icon: '🧚',
		slot: 'back',
		colors: { primary: 0xffb3d9, secondary: 0xfff2fa },
		description: 'Sepasang sayap kecil berkilau di punggung.'
	}
];

/** Look up an accessory by id; unknown ids mean "wearing nothing". */
export function getAccessory(id: string | null | undefined): Accessory | null {
	if (!id || id === NO_ACCESSORY) return null;
	return ACCESSORIES.find((a) => a.id === id) ?? null;
}

/** Accessories for one slot, plus the "nothing" option the picker needs. */
export function accessoriesForSlot(slot: AccessorySlot): Accessory[] {
	return ACCESSORIES.filter((a) => a.slot === slot);
}

/**
 * Every accessory, always.
 *
 * The function exists rather than callers reading `ACCESSORIES` directly so
 * the *rule* has one obvious home: if this ever grows a condition, every
 * caller is already the place to look, and the test that says "nothing is
 * ever withheld" names it.
 */
export function availableAccessories(): Accessory[] {
	return [...ACCESSORIES];
}

/**
 * What to wear now.
 *
 * A saved id that is no longer in the catalogue (an older build) resolves to
 * nothing rather than throwing — a child must never be blocked by a stale
 * record.
 */
export function resolveWearing(savedId: string | null | undefined): Accessory | null {
	return getAccessory(savedId);
}
