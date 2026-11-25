/** Colour and shape content for Kebun Warna. */

export interface ColorEntry {
	id: string;
	/** Indonesian colour name. */
	name: string;
	hex: number;
}

export const COLORS: ColorEntry[] = [
	{ id: 'merah', name: 'Merah', hex: 0xe8453c },
	{ id: 'kuning', name: 'Kuning', hex: 0xf7c948 },
	{ id: 'biru', name: 'Biru', hex: 0x3d8bff },
	{ id: 'hijau', name: 'Hijau', hex: 0x47b85c },
	{ id: 'ungu', name: 'Ungu', hex: 0x9b6bde },
	{ id: 'oranye', name: 'Oranye', hex: 0xf58a1f }
];

export interface ShapeEntry {
	id: string;
	/** Indonesian shape name. */
	name: string;
	icon: string;
	/**
	 * How to draw the shape for real.
	 *
	 * The emoji is a fallback for text-only surfaces; in the mission panel the
	 * prompt must be the actual outline. `⭕ 🟦 🔺 ⭐` are coloured, so a square
	 * emoji is blue and a triangle emoji is red — the child is then asked to
	 * name a shape while the colour argues with them. Geometry has no colour.
	 */
	draw: 'circle' | 'square' | 'triangle' | 'star';
}

export const SHAPES: ShapeEntry[] = [
	{ id: 'lingkaran', name: 'Lingkaran', icon: '⭕', draw: 'circle' },
	{ id: 'kotak', name: 'Kotak', icon: '🟦', draw: 'square' },
	{ id: 'segitiga', name: 'Segitiga', icon: '🔺', draw: 'triangle' },
	{ id: 'bintang', name: 'Bintang', icon: '⭐', draw: 'star' }
];

export function getColor(id: string): ColorEntry | undefined {
	return COLORS.find((c) => c.id === id);
}

export function getShape(id: string): ShapeEntry | undefined {
	return SHAPES.find((s) => s.id === id);
}
