/** Animal content for Hutan Hewan. */

export interface AnimalEntry {
	id: string;
	/** Indonesian name, as spoken. */
	name: string;
	icon: string;
	/** Spoken onomatopoeia used in Indonesian children's books. */
	sound: string;
}

export const ANIMALS: AnimalEntry[] = [
	{ id: 'kucing', name: 'Kucing', icon: '🐱', sound: 'Meong' },
	{ id: 'anjing', name: 'Anjing', icon: '🐶', sound: 'Guk guk' },
	{ id: 'sapi', name: 'Sapi', icon: '🐄', sound: 'Moo' },
	{ id: 'kambing', name: 'Kambing', icon: '🐐', sound: 'Mbek' },
	{ id: 'ayam', name: 'Ayam', icon: '🐔', sound: 'Kukuruyuk' },
	{ id: 'bebek', name: 'Bebek', icon: '🦆', sound: 'Kwek kwek' },
	{ id: 'gajah', name: 'Gajah', icon: '🐘', sound: 'Meraung' },
	{ id: 'singa', name: 'Singa', icon: '🦁', sound: 'Aaum' }
];

export function getAnimal(id: string): AnimalEntry | undefined {
	return ANIMALS.find((a) => a.id === id);
}
