import type { LayoutServerLoad } from './$types';

/**
 * Resolve the request origin so social-share tags (og:image) can be absolute.
 * Open Graph requires an absolute URL; a relative one is dropped by crawlers.
 */
export const load: LayoutServerLoad = ({ url }) => {
	return { origin: url.origin };
};
