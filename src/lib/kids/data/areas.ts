import type { AreaDefinition, AreaId } from '../types';

/**
 * The island's six areas.
 *
 * Positions form a rough ring around the spawn point at the origin, far enough
 * apart that the child has to walk somewhere new but close enough that a
 * three-year-old never wanders without a landmark in sight.
 */
export const AREAS: Record<AreaId, AreaDefinition> = {
	counting: {
		id: 'counting',
		name: 'Pulau Berhitung',
		tagline: 'Ayo menghitung apel!',
		icon: '🍎',
		position: { x: 0, z: -14 },
		color: 0xff8a3d
	},
	alphabet: {
		id: 'alphabet',
		name: 'Hutan Huruf',
		tagline: 'Ayo mengenal huruf!',
		icon: '🔤',
		position: { x: 16, z: -4 },
		color: 0x5bb8ff
	},
	reading: {
		id: 'reading',
		name: 'Kota Membaca',
		tagline: 'Ayo membaca kata!',
		icon: '📖',
		position: { x: 10, z: 14 },
		color: 0xb98cff
	},
	colors: {
		id: 'colors',
		name: 'Kebun Warna',
		tagline: 'Ayo mengenal warna dan bentuk!',
		icon: '🎨',
		position: { x: -10, z: 15 },
		color: 0xff6fae
	},
	animals: {
		id: 'animals',
		name: 'Hutan Hewan',
		tagline: 'Ayo mengenal hewan!',
		icon: '🐘',
		position: { x: -17, z: -3 },
		color: 0x4ed18a
	},
	music: {
		id: 'music',
		name: 'Pulau Musik',
		tagline: 'Ayo mendengar tinggi dan rendah nada!',
		icon: '🎵',
		// Placed between Huruf and Membaca, on the outer ring: every existing
		// area keeps its position, so a child who learned the island layout
		// still finds everything where it was. The only constraint is the
		// >8-unit separation the area test enforces.
		position: { x: 20, z: 9 },
		color: 0xffc93c
	}
};

/** Stable draw order for menus, so areas never reshuffle between renders. */
export const AREA_ORDER: AreaId[] = [
	'counting',
	'alphabet',
	'reading',
	'colors',
	'animals',
	'music'
];

export function areaList(): AreaDefinition[] {
	return AREA_ORDER.map((id) => AREAS[id]);
}

export function getArea(id: AreaId): AreaDefinition {
	return AREAS[id];
}
