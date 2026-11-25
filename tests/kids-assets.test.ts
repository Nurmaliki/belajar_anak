import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The asset loader must never make the app depend on a file that is not
 * shipped, and must not keep asking for a file that is not there. These tests
 * pin the second guarantee: once a URL is known to be absent, it is not
 * requested again — which is what kept `404 /models/Bubu.glb` out of every
 * reload's server log.
 *
 * The loader itself is mocked: real GLTF parsing needs a browser and a file,
 * and the behaviour under test is the request/no-request decision, not parsing.
 *
 * Note: the module reads `sessionStorage` through `globalThis`, so the stub
 * must be installed *before* the import — hence the dynamic import.
 */

const loadAsync = vi.fn();

vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
	GLTFLoader: class {
		loadAsync = loadAsync;
	}
}));

type Calls = { url: string; method: string }[];

let storage: Map<string, string>;
let calls: Calls;
let AssetManager: typeof import('../src/lib/kids/engine/AssetManager').AssetManager;

async function freshManager() {
	const mod = await import('../src/lib/kids/engine/AssetManager');
	return new mod.AssetManager();
}

beforeEach(async () => {
	vi.resetModules();
	loadAsync.mockReset();
	calls = [];
	storage = new Map();

	vi.stubGlobal('sessionStorage', {
		getItem: (k: string) => storage.get(k) ?? null,
		setItem: (k: string, v: string) => void storage.set(k, v),
		removeItem: (k: string) => void storage.delete(k),
		clear: () => storage.clear()
	});

	// The loader reports a missing file the same way GLTFLoader does: a
	// 404-shaped failure. `fetch` is what distinguishes "absent" from "bad".
	loadAsync.mockRejectedValue(new Error('404 Not Found'));

	vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
		calls.push({ url: String(input), method: init?.method ?? 'GET' });
		return new Response('', { status: 404 });
	});

	({ AssetManager } = await import('../src/lib/kids/engine/AssetManager'));
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('AssetManager — a model that is not shipped', () => {
	it('resolves to null when the model 404s, so the procedural bunny is used', async () => {
		const manager = new AssetManager();
		await expect(manager.loadBubuModel()).resolves.toBeNull();
	});

	it('remembers an absent model in session storage', async () => {
		const manager = new AssetManager();
		await manager.loadModel('/models/Bubu.glb');
		expect(storage.get('dunia-pintar:missing-model:/models/Bubu.glb')).toBe('1');
	});

	it('does not ask again in a later session once a 404 proved the file is absent', async () => {
		await new AssetManager().loadModel('/models/Bubu.glb');
		const afterFirst = calls.length;
		expect(afterFirst).toBeGreaterThan(0);

		// A new manager stands in for a page reload: same session storage,
		// fresh in-memory cache. It must go straight to the fallback.
		await expect(new AssetManager().loadModel('/models/Bubu.glb')).resolves.toBeNull();
		expect(calls.length, 'no request on the second visit').toBe(afterFirst);
		expect(loadAsync).toHaveBeenCalledTimes(1);
	});

	it('asks only once per URL within a single manager', async () => {
		const manager = new AssetManager();
		await manager.loadModel('/models/Bubu.glb');
		await manager.loadModel('/models/Bubu.glb');
		expect(loadAsync).toHaveBeenCalledTimes(1);
	});

	it('does not blacklist a different model just because one was missing', async () => {
		await new AssetManager().loadModel('/models/Bubu.glb');
		await new AssetManager().loadModel('/models/Other.glb');
		expect(calls.some((c) => c.url === '/models/Other.glb')).toBe(true);
	});

	it('still asks again when the failure was not a 404', async () => {
		// A corrupt file must not be permanently blacklisted: it can be fixed.
		await new AssetManager().loadModel('/models/Bubu.glb');
		expect(storage.has('dunia-pintar:missing-model:/models/Bubu.glb')).toBe(true);

		vi.stubGlobal('fetch', async () => new Response('not a gltf', { status: 200 }));
		vi.resetModules();
		const mod = await import('../src/lib/kids/engine/AssetManager');
		const manager = new mod.AssetManager();
		loadAsync.mockRejectedValue(new Error('parse error'));
		await expect(manager.loadModel('/models/New.glb')).resolves.toBeNull();
		expect(storage.has('dunia-pintar:missing-model:/models/New.glb')).toBe(false);
	});

	it('works when session storage is unavailable', async () => {
		vi.stubGlobal('sessionStorage', undefined);
		vi.resetModules();
		const mod = await import('../src/lib/kids/engine/AssetManager');
		await expect(new mod.AssetManager().loadBubuModel()).resolves.toBeNull();
	});
});
