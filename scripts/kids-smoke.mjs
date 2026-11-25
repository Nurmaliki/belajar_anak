import { chromium } from 'playwright';

/**
 * End-to-end test for Dunia Pintar 3D.
 *
 * Runs against a live dev server and exercises the real game: render → move →
 * collect → answer → reward → **persistence**, then walks every new mission
 * kind (letter, syllable, picture) through the same engine paths the child's
 * taps use.
 *
 * The readback of the WebGL canvas is not used for assertions (it is blank
 * without `preserveDrawingBuffer`); screenshots are checked by byte length
 * instead.
 */
const BASE = process.env.KIDS_URL ?? 'http://localhost:5175';

let failures = 0;
function log(ok, label, detail = '') {
	console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
	if (!ok) failures++;
}

const browser = await chromium.launch({
	args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
});
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

const state = () => page.evaluate(() => window.__duniaEngine.debugState());
const pos = () => page.evaluate(() => window.__duniaEngine.getBubuPositionForTest());

/**
 * Open a page and wait for something real to be ready.
 *
 * `networkidle` is not usable against the Vite dev server: its HMR websocket
 * never goes idle, so the wait can take 10 s or time out entirely. Waiting on
 * `domcontentloaded` plus a concrete readiness signal (the canvas, or the engine
 * hook) is both faster and deterministic.
 */
async function gotoKids(url, ready) {
	await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
	await page.waitForSelector(ready, { timeout: 30000 });
}

await gotoKids(BASE, 'canvas.world');
await page.waitForTimeout(1200);

// --- boot ---------------------------------------------------------------
log((await page.locator('canvas.world').count()) === 1, 'canvas mounted');
const gl = await page.evaluate(() => {
	const c = document.querySelector('canvas.world');
	const g = c?.getContext('webgl2') || c?.getContext('webgl');
	return g ? g.getParameter(g.VERSION) : null;
});
log(!!gl, 'WebGL context', gl ?? 'none');
log((await page.screenshot()).length > 20000, 'main menu renders');

// The menu offers all five areas now that each has missions.
log((await page.locator('.area').count()) === 5, 'menu lists five areas');

await page.getByRole('button', { name: 'Main' }).click({ force: true });
await page.waitForTimeout(2500);

// --- counting mission ---------------------------------------------------
const s0 = await state();
log(s0.apples === 3, 'three apples spawned', `apples=${s0.apples}`);
log(s0.phase === 'MISSION_ACTIVE' || s0.phase === 'MISSION_INTRO', 'mission started', s0.phase);
log(s0.mission === 'count-apples-3', 'Main starts the first counting mission', s0.mission);
log((await page.locator('.mission').count()) === 1, 'mission panel visible');
log((await page.locator('.answer').count()) === 0, 'answer buttons hidden until all collected');

// --- movement -----------------------------------------------------------
// Under SwiftShader the page can run at 2–3 FPS, so a fixed hold sometimes
// produces almost no movement. Poll until Bubu has clearly walked instead of
// asserting on one sample; the point is that input reaches the controller.
const p0 = await pos();
let moved = 0;
await page.keyboard.down('KeyW');
for (let i = 0; i < 12 && moved < 1.5; i++) {
	await page.waitForTimeout(500);
	const p = await pos();
	moved = Math.hypot(p.x - p0.x, p.z - p0.z);
}
await page.keyboard.up('KeyW');
await page.waitForTimeout(300);
log(moved > 0.5, 'Bubu walks with W', `${moved.toFixed(2)} units`);

// --- counting (via the engine's own tap path) ---------------------------
await page.evaluate(() => {
	const ids = window.__duniaEngine.debugState().pickables;
	for (const id of ids) window.__duniaEngine.collectForTest(id);
});
await page.waitForTimeout(600);
const s1 = await state();
log(s1.sessionCount === 3, 'all three apples counted', `count=${s1.sessionCount}`);
log(s1.canAnswer === true, 'answer buttons unlocked after collecting');
log((await page.locator('.answer').count()) > 0, 'answer buttons now visible');

// --- duplicate counting is refused -------------------------------------
await page.evaluate(() => {
	window.__duniaEngine.collectForTest('apple-0');
	window.__duniaEngine.collectForTest('apple-0');
});
const s2 = await state();
log(s2.sessionCount === 3, 'duplicate taps do not inflate the count', `count=${s2.sessionCount}`);

// --- wrong answer allows retry -----------------------------------------
await page.locator('.answer', { hasText: '1' }).first().click();
await page.waitForTimeout(700);
const s3 = await state();
log(s3.phase === 'MISSION_ACTIVE', 'wrong answer keeps the child in the mission', s3.phase);
log((await page.locator('.answer').count()) > 0, 'retry available after a wrong answer');

// --- correct answer rewards --------------------------------------------
await page.waitForTimeout(600);
await page.locator('.answer', { hasText: '3' }).first().click();
await page.waitForTimeout(500);
const stars = await page.locator('.star-chip').innerText();
log(/[1-9]/.test(stars), 'a star is awarded', stars.replace(/\s+/g, ' '));

// --- persistence: the dashboard must see what was earned ----------------
// This is the check that would have caught stars living only in memory.
await page.waitForTimeout(2500);
await gotoKids(`${BASE}/parent`, '#gate-input');
await page.waitForTimeout(400);

// Solve the parent gate: read the two numbers off the screen.
const gateLabel = await page.locator('label[for="gate-input"]').innerText();
const nums = gateLabel.match(/(\d+)\s*\+\s*(\d+)/);
if (!nums) {
	log(false, 'parent gate question is readable', gateLabel);
} else {
	const sum = Number(nums[1]) + Number(nums[2]);
	await page.locator('#gate-input').fill(String(sum));
	await page.getByRole('button', { name: 'Buka' }).click();
	await page.waitForTimeout(1200);

	const body = await page.locator('main.parent').innerText();
	log(!/Kunci Orang Tua/.test(body), 'parent gate opens with the right answer');
	const starTile = await page.locator('.tile', { hasText: 'Bintang' }).first().innerText();
	log(/[1-9]/.test(starTile), 'dashboard shows the earned star', starTile.replace(/\s+/g, ' '));
	const missionTile = await page.locator('.tile', { hasText: 'Misi selesai' }).first().innerText();
	log(/count-apples-3/.test(missionTile), 'dashboard lists the completed mission', missionTile.replace(/\s+/g, ' '));
	const numberGrid = await page.locator('.num.correct').count();
	log(numberGrid >= 1, 'dashboard marks the counted number as mastered', `${numberGrid} mastered`);

	// Per-area breakdown: one row per area, and the counting row must show
	// real progress rather than an empty bar.
	const areaRows = await page.locator('.area').count();
	log(areaRows === 5, 'dashboard shows one row per learning area', `${areaRows} rows`);
	const countingRow = await page.locator('.area[data-area="counting"]').innerText();
	log(
		/[1-9]\d* dari \d+ misi selesai/.test(countingRow),
		'dashboard shows counting progress as a fraction',
		countingRow.replace(/\s+/g, ' ')
	);
	const countingPct = Number(
		await page.locator('.area[data-area="counting"] .area-bar').getAttribute('aria-valuenow')
	);
	log(countingPct > 0 && countingPct < 100, 'counting progress is a real percentage', `${countingPct}%`);
	const untouched = await page.locator('.area-status', { hasText: 'Belum dicoba' }).count();
	log(untouched >= 1, 'an untouched area is labelled as not tried', `${untouched} areas`);

	// The dashboard must say what the device can actually do about speech,
	// instead of a fixed reassurance. Before this, the line was hard-coded.
	const voice = await page.locator('[data-testid="voice-status"]').innerText();
	log(voice.trim().length > 0, 'dashboard reports the device speech status', voice.replace(/\s+/g, ' '));
}

// --- the notice banner is real -------------------------------------------
// `GameUI.setNotice` was written and rendered nowhere, so "your star could not
// be saved" was silently swallowed. Break IndexedDB before the game boots: the
// repository falls back to memory, `save()` returns false, and the banner must
// appear. This is the only path where the child is not told but the grown-up is.
await page.addInitScript(() => {
	// A repository opened against a throwing factory behaves like private mode.
	Object.defineProperty(window, 'indexedDB', {
		configurable: true,
		value: undefined,
		writable: true
	});
});
await gotoKids(BASE, 'canvas.world');
await page.waitForTimeout(1800);
await page.getByRole('button', { name: 'Main' }).click({ force: true });
await page.waitForTimeout(2500);
{
	// Answer a counting mission to force a save attempt.
	const engineReady = await page.evaluate(() => Boolean(window.__duniaEngine));
	log(engineReady, 'the game still starts when storage is unavailable');
	await page.evaluate(() => window.__duniaEngine.startMissionForTest('color-merah'));
	await page.waitForTimeout(1600);
	await page.evaluate(() => window.__duniaEngine.answerForTest('Merah'));
	await page.waitForTimeout(1400);
	let warned = false;
	for (let i = 0; i < 16 && !warned; i++) {
		await page.waitForTimeout(250);
		warned = (await page.locator('.notice').count()) === 1;
	}
	log(warned, 'a failed save shows a notice instead of vanishing silently');
	const text = warned ? await page.locator('.notice').innerText() : '';
	log(
		/waktu terbuka|tidak tersedia/i.test(text),
		'the notice says what went wrong',
		text.replace(/\s+/g, ' ')
	);
}

// --- the new mission kinds ---------------------------------------------
await gotoKids(BASE, 'canvas.world');
await page.waitForTimeout(1500);
await page.getByRole('button', { name: 'Main' }).click({ force: true });
await page.waitForTimeout(2000);

for (const [missionId, area, expectedAnswer, label] of [
	['letter-a', 'alphabet', 'A', 'letter mission'],
	['read-ba', 'reading', 'BA', 'syllable mission'],
	['animal-sapi', 'animals', 'Sapi', 'animal picture mission'],
	['color-merah', 'colors', 'Merah', 'colour picture mission'],
	['shape-segitiga', 'colors', 'Segitiga', 'shape picture mission']
]) {
	await page.evaluate((id) => window.__duniaEngine.startMissionForTest(id), missionId);
	await page.waitForTimeout(1800);
	const st = await state();
	log(st.mission === missionId, `${label} starts`, st.mission ?? 'none');
	log(st.missionKind !== 'count-and-answer', `${label} is not a counting mission`, st.missionKind);

	// A question mission has no apples and its buttons are live immediately.
	log(st.apples === 0, `${label} spawns no apples`, `apples=${st.apples}`);
	const buttons = await page.locator('.answer').count();
	log(buttons >= 2, `${label} shows answer buttons immediately`, `${buttons} buttons`);

	// Prompt is rendered from the mission's own data.
	log((await page.locator('.prompt').count()) === 1, `${label} shows a prompt`);

	// Wrong first, to prove the retry path for this kind too.
	const wrong = expectedAnswer === 'A' ? 'B' : 'A';
	await page.evaluate((w) => window.__duniaEngine.answerForTest(w), wrong);
	await page.waitForTimeout(1100);
	const afterWrong = await state();
	log(
		afterWrong.phase === 'MISSION_ACTIVE' || afterWrong.phase === 'MISSION_INTRO',
		`${label}: wrong answer is not a dead end`,
		afterWrong.phase
	);

	await page.evaluate((a) => window.__duniaEngine.answerForTest(a), expectedAnswer);
	await page.waitForTimeout(900);
	const afterRight = await state();
	log(
		afterRight.phase === 'MISSION_SUCCESS' || afterRight.phase === 'WORLD_EXPLORATION',
		`${label}: correct answer succeeds`,
		afterRight.phase
	);
	await page.waitForTimeout(2400);
}

// The panel must have closed itself after the last success.
log((await page.locator('.mission').count()) === 0, 'panel closes after a mission completes');

// --- the rotation advances within a session ------------------------------
// The engine used to snapshot the completed list at construction, so finishing
// a mission and walking back into the same area handed the child that same
// mission again — it only advanced after a page reload. `markMissionComplete`
// now updates the engine's own list the moment the star is awarded.
{
	const offeredBefore = await page.evaluate(() =>
		window.__duniaEngine.nextMissionForTest('alphabet')
	);
	log(
		offeredBefore !== 'letter-a',
		'a finished mission is not offered again in the same session',
		`offered ${offeredBefore}`
	);
	log(
		offeredBefore !== null,
		'the area still has something to offer',
		`offered ${offeredBefore}`
	);

	// After winning, the child was left standing on the stage with no new task:
	// `endMissionUi` latched the area as "already entered", so the area could not
	// re-offer until they walked out and back. A four-year-old will not guess
	// that. Starting a mission while standing in the area must work immediately.
	const before = await page.evaluate(() => window.__duniaEngine.debugState().mission);
	await page.evaluate((id) => window.__duniaEngine.startMissionForTest(id), offeredBefore);
	await page.waitForTimeout(1600);
	const after = await page.evaluate(() => window.__duniaEngine.debugState());
	log(
		after.mission === offeredBefore,
		'the next mission actually starts on the same spot',
		`was ${before}, now ${after.mission}`
	);
	log(
		after.phase === 'MISSION_ACTIVE' || after.phase === 'MISSION_INTRO',
		'starting a mission leaves a live phase, not a stuck one',
		after.phase
	);
	await page.evaluate(() => window.__duniaEngine.abandonMissionForTest());
	await page.waitForTimeout(700);
}

// --- winning during the intro still lands in MISSION_SUCCESS --------------
// A question mission's buttons are live while the 1.4 s intro is still running.
// A fast correct tap used to transition MISSION_INTRO -> MISSION_SUCCESS, an
// edge missing from the table: refused silently, so the star was awarded but the
// celebration guard never engaged.
await page.evaluate(() => window.__duniaEngine.startMissionForTest('color-biru'));
await page.waitForTimeout(500);
{
	const st = await state();
	log(st.phase === 'MISSION_INTRO', 'the answer buttons are live during the intro', st.phase);
	await page.evaluate(() => window.__duniaEngine.answerForTest('Biru'));
	await page.waitForTimeout(500);
	const won = await state();
	log(
		won.phase === 'MISSION_SUCCESS' || won.phase === 'WORLD_EXPLORATION',
		'winning from the intro reaches a real success phase',
		won.phase
	);
}
await page.waitForTimeout(2600);

// --- the prompt must not print its own answer ----------------------------
// A pre-reader sees pictures; a reader must not be able to skip the task.
await page.evaluate(() => window.__duniaEngine.startMissionForTest('letter-a'));
await page.waitForTimeout(1500);
{
	const caption = (await page.locator('.prompt-caption').count())
		? await page.locator('.prompt-caption').innerText()
		: '';
	log(caption.trim() === '', 'a letter prompt prints no word', `caption="${caption}"`);
	log((await page.locator('.prompt-icon').count()) === 1, 'a letter prompt still shows a picture');
}

await page.evaluate(() => window.__duniaEngine.startMissionForTest('shape-segitiga'));
await page.waitForTimeout(1500);
{
	// A drawn shape, not an emoji.
	log(
		(await page.locator('.prompt-shape[data-shape="triangle"]').count()) === 1,
		'a shape prompt is drawn geometry, not an emoji'
	);
	log(
		(await page.locator('.prompt-caption').count()) === 0,
		'a shape prompt does not print the shape name'
	);
}
await page.waitForTimeout(2400);

// --- assemble-word mission --------------------------------------------
// The one kind where the child taps several times before winning.
await page.evaluate(() => window.__duniaEngine.startMissionForTest('assemble-baju'));
await page.waitForTimeout(1800);
let bs = await state();
log(bs.mission === 'assemble-baju', 'assemble-word mission starts', bs.mission ?? 'none');
log(bs.missionKind === 'assemble-word', 'mission kind is assemble-word', bs.missionKind);
log((await page.locator('.slot').count()) === 2, 'two syllable slots are shown', `${await page.locator('.slot').count()} slots`);
log((await page.locator('.slot.filled').count()) === 0, 'no slot is filled before any pick');

// A wrong syllable must not fill a slot or end the mission.
await page.evaluate(() => window.__duniaEngine.answerForTest('LA'));
await page.waitForTimeout(1100);
bs = await state();
log(bs.phase === 'MISSION_ACTIVE', 'wrong syllable keeps the child in the mission', bs.phase);
log((await page.locator('.slot.filled').count()) === 0, 'wrong syllable fills no slot');

// Place BA, then JU.
await page.evaluate(() => window.__duniaEngine.answerForTest('BA'));
await page.waitForTimeout(700);
log((await page.locator('.slot.filled').count()) === 1, 'first syllable fills one slot');
bs = await state();
log(bs.phase !== 'MISSION_SUCCESS' && bs.buildStep === 'building', 'mission continues after the first syllable', bs.buildStep);

await page.evaluate(() => window.__duniaEngine.answerForTest('JU'));
await page.waitForTimeout(900);
bs = await state();
log(bs.phase === 'MISSION_SUCCESS' || bs.phase === 'WORLD_EXPLORATION', 'assembling the whole word wins', bs.phase);
await page.waitForTimeout(2600);
log((await page.locator('.mission').count()) === 0, 'assemble panel closes after completion');

// --- add-groups mission ------------------------------------------------
await page.evaluate(() => window.__duniaEngine.startMissionForTest('add-3-2'));
await page.waitForTimeout(1800);
let as = await state();
log(as.mission === 'add-3-2', 'add-groups mission starts', as.mission ?? 'none');
log(as.missionKind === 'add-groups', 'mission kind is add-groups', as.missionKind);
log((await page.locator('.group').count()) === 2, 'two countable groups are drawn');
const objCount = await page.locator('.obj').count();
log(objCount === 5, 'the groups total five objects', `${objCount} objects`);
log((await page.locator('.plus').count()) === 1, 'a plus sign sits between the groups');

// A wrong sum must be survivable.
await page.evaluate(() => window.__duniaEngine.answerForTest('4'));
await page.waitForTimeout(1100);
as = await state();
log(as.phase === 'MISSION_ACTIVE', 'wrong sum keeps the child in the mission', as.phase);

await page.evaluate(() => window.__duniaEngine.answerForTest('5'));
await page.waitForTimeout(900);
as = await state();
log(as.phase === 'MISSION_SUCCESS' || as.phase === 'WORLD_EXPLORATION', 'the right sum wins', as.phase);
await page.waitForTimeout(2600);

// --- compare-groups mission --------------------------------------------
await page.evaluate(() => window.__duniaEngine.startMissionForTest('compare-more'));
await page.waitForTimeout(1800);
let cs = await state();
log(cs.mission === 'compare-more', 'compare-groups mission starts', cs.mission ?? 'none');
log(cs.missionKind === 'compare-groups', 'mission kind is compare-groups', cs.missionKind);
log((await page.locator('.compare-group').count()) === 2, 'two tappable groups are shown');
const cmpObjs = await page.locator('.compare-group .obj').count();
log(cmpObjs === 6, 'the groups hold 4 and 2 objects', `${cmpObjs} objects`);

// Tapping the smaller group is wrong but survivable.
await page.evaluate(() => window.__duniaEngine.answerForTest('right'));
await page.waitForTimeout(1100);
cs = await state();
log(cs.phase === 'MISSION_ACTIVE', 'wrong group keeps the child in the mission', cs.phase);

// Tapping the larger group wins.
await page.evaluate(() => window.__duniaEngine.answerForTest('left'));
await page.waitForTimeout(900);
cs = await state();
log(cs.phase === 'MISSION_SUCCESS' || cs.phase === 'WORLD_EXPLORATION', 'the larger group wins', cs.phase);
await page.waitForTimeout(2600);
log((await page.locator('.mission').count()) === 0, 'compare panel closes after completion');

// --- sort-groups mission -----------------------------------------------
// The one counting kind where the child taps several times, fewest first.
await page.evaluate(() => window.__duniaEngine.startMissionForTest('sort-three'));
await page.waitForTimeout(1800);
let ss = await state();
log(ss.mission === 'sort-three', 'sort-groups mission starts', ss.mission ?? 'none');
log(ss.missionKind === 'sort-groups', 'mission kind is sort-groups', ss.missionKind);
log((await page.locator('.sort-slot').count()) === 3, 'three sort slots are shown', `${await page.locator('.sort-slot').count()} slots`);
log((await page.locator('.sort-slot.filled').count()) === 0, 'no sort slot is filled before any pick');
log((await page.locator('.compare-group').count()) === 3, 'three tappable piles are offered');

// Tapping the biggest pile first is wrong but survivable, and fills nothing.
await page.evaluate(() => window.__duniaEngine.answerForTest('3'));
await page.waitForTimeout(1100);
ss = await state();
log(ss.phase === 'MISSION_ACTIVE', 'wrong pile keeps the child in the mission', ss.phase);
log((await page.locator('.sort-slot.filled').count()) === 0, 'wrong pile fills no sort slot');

// The fewest pile lands first, and the mission continues.
await page.evaluate(() => window.__duniaEngine.answerForTest('1'));
await page.waitForTimeout(700);
log((await page.locator('.sort-slot.filled').count()) === 1, 'first pile fills one sort slot');
ss = await state();
log(ss.phase !== 'MISSION_SUCCESS' && ss.sortStep === 'sorting', 'mission continues after the first pile', ss.sortStep);
log((await page.locator('.compare-group').count()) === 2, 'a placed pile is no longer offered');

// The rest of the line wins.
await page.evaluate(() => window.__duniaEngine.answerForTest('2'));
await page.waitForTimeout(600);
await page.evaluate(() => window.__duniaEngine.answerForTest('3'));
await page.waitForTimeout(900);
log((await page.locator('.sort-slot.filled').count()) === 3, 'the completed line fills every sort slot');
ss = await state();
log(ss.phase === 'MISSION_SUCCESS' || ss.phase === 'WORLD_EXPLORATION', 'ordering every pile wins', ss.phase);
await page.waitForTimeout(2600);
log((await page.locator('.mission').count()) === 0, 'sort panel closes after completion');

// --- subtract-groups mission -------------------------------------------
await page.evaluate(() => window.__duniaEngine.startMissionForTest('subtract-5-2'));
await page.waitForTimeout(1800);
let sub = await state();
log(sub.mission === 'subtract-5-2', 'subtract-groups mission starts', sub.mission ?? 'none');
log(sub.missionKind === 'subtract-groups', 'mission kind is subtract-groups', sub.missionKind);
const stayObjs = await page.locator('.take-away .obj:not(.gone)').count();
const goneObjs = await page.locator('.take-away .obj.gone').count();
log(stayObjs === 3 && goneObjs === 2, 'five apples are drawn, two crossed out', `${stayObjs} stay, ${goneObjs} gone`);
log((await page.locator('.answers .answer').count()) === 3, 'three number buttons are offered');

// The number taken away is on the buttons as a distractor and must be wrong.
await page.evaluate(() => window.__duniaEngine.answerForTest('2'));
await page.waitForTimeout(1100);
sub = await state();
log(sub.phase === 'MISSION_ACTIVE', 'wrong remainder keeps the child in the mission', sub.phase);

await page.evaluate(() => window.__duniaEngine.answerForTest('3'));
await page.waitForTimeout(900);
sub = await state();
log(sub.phase === 'MISSION_SUCCESS' || sub.phase === 'WORLD_EXPLORATION', 'the right remainder wins', sub.phase);
await page.waitForTimeout(2600);
log((await page.locator('.mission').count()) === 0, 'subtract panel closes after completion');

// --- Bimo, the visible guide -------------------------------------------
// He has no mechanics, so what is asserted is that he is alive: present,
// turning towards Bubu, greeting when tapped, and cheering on a win.
await gotoKids(BASE, 'canvas.world');
await page.waitForTimeout(1500);
await page.getByRole('button', { name: 'Main' }).click({ force: true });
await page.waitForTimeout(2000);

const bimoBefore = await state();
log(Number.isFinite(bimoBefore.bimoX) && Number.isFinite(bimoBefore.bimoZ), 'Bimo is placed in the world', `${bimoBefore.bimoX}, ${bimoBefore.bimoZ}`);
log(bimoBefore.bimoState === 'idle', 'Bimo starts idle on his stump', bimoBefore.bimoState);

// Walking Bubu across the plaza must make him turn. Poll rather than sample
// once: the yaw eases in over several frames.
const yawAtSpawn = bimoBefore.bimoYaw;
for (let i = 0; i < 25; i++) {
	await page.keyboard.down('KeyD');
	await page.waitForTimeout(120);
	await page.keyboard.up('KeyD');
	await page.waitForTimeout(60);
	const now = await state();
	if (Math.abs(now.bimoYaw - yawAtSpawn) > 0.12) break;
}
const afterWalk = await state();
log(
	Math.abs(afterWalk.bimoYaw - yawAtSpawn) > 0.12,
	'Bimo turns to watch Bubu as she walks',
	`yaw ${yawAtSpawn.toFixed(2)} → ${afterWalk.bimoYaw.toFixed(2)}`
);

await page.evaluate(() => window.__duniaEngine.greetBimoForTest());
await page.waitForTimeout(150);
const greeter = await state();
log(greeter.bimoState === 'hop', 'tapping Bimo makes him hop', greeter.bimoState);

// Poll for the landing rather than assuming wall-clock equals simulation time:
// `GameLoop` clamps each frame's delta to 80 ms, so at the ~3 fps SwiftShader
// manages, one second of real time advances the simulation far less than a
// second. Sleeping 1200 ms and expecting him down is exactly the mistake this
// project's own README warns about.
let landed = false;
for (let i = 0; i < 40 && !landed; i++) {
	await page.waitForTimeout(250);
	landed = (await state()).bimoState === 'idle';
}
log(landed, 'Bimo settles back after greeting');

// A win makes him cheer.
await page.evaluate(() => window.__duniaEngine.startMissionForTest('subtract-4-1'));
await page.waitForTimeout(1800);
await page.evaluate(() => window.__duniaEngine.answerForTest('3'));
await page.waitForTimeout(300);
const cheering = await state();
log(cheering.bimoState === 'cheer', 'Bimo cheers when Bubu wins', cheering.bimoState);
await page.waitForTimeout(2600);

// --- the dressing-up box -----------------------------------------------
// Every accessory must be offered, and putting one on must survive a reload.
// This is the test that would catch content quietly becoming locked.
await gotoKids(BASE, 'canvas.world');
await page.waitForTimeout(1500);
await page.getByRole('button', { name: 'Main' }).click({ force: true });
await page.waitForTimeout(2000);

await page.getByRole('button', { name: 'Lemari Bubu' }).click();
await page.waitForTimeout(400);
log((await page.locator('.wardrobe').count()) === 1, 'the wardrobe opens from the HUD');
const offered = await page.locator('.wardrobe .item').count();
log(offered >= 7, 'every accessory is offered, plus "tanpa"', `${offered} buttons`);
log(
	(await page.locator('.wardrobe [disabled]').count()) === 0,
	'nothing in the wardrobe is locked or disabled'
);

await page.getByRole('button', { name: 'Mahkota' }).click();
await page.waitForTimeout(500);
const dressed = await state();
log(dressed.wearing === 'mahkota', 'choosing an accessory puts it on', dressed.wearing);
log(dressed.accessoryMeshes > 0, 'the accessory is real geometry, not just state', `${dressed.accessoryMeshes} meshes`);

await page.getByRole('button', { name: 'Tutup lemari' }).click();
await page.waitForTimeout(300);
log((await page.locator('.wardrobe').count()) === 0, 'the wardrobe closes');

// Reload: the outfit must still be on, restored silently.
await gotoKids(BASE, 'canvas.world');
await page.waitForTimeout(2200);
const restored = await state();
log(restored.wearing === 'mahkota', 'the outfit survives a reload', restored.wearing);
log(restored.accessoryMeshes > 0, 'the restored outfit is rebuilt', `${restored.accessoryMeshes} meshes`);

// --- portrait hint ------------------------------------------------------
// A narrow, tall viewport should suggest rotating; desktop should not.
// The hint is bound to the 3D world, not the main menu, so the child must be
// *in* the world for it to appear. Poll rather than sampling once: under
// SwiftShader the Svelte re-render and the CSS layout settle a beat after the
// resize event fires.
await page.getByRole('button', { name: 'Main' }).click({ force: true });
await page.waitForTimeout(2000);
await page.setViewportSize({ width: 390, height: 844 });
let hintShown = false;
for (let i = 0; i < 20 && !hintShown; i++) {
	await page.waitForTimeout(250);
	hintShown = (await page.locator('.rotate-hint').count()) === 1;
}
log(hintShown, 'portrait viewport shows the rotate hint');
if (hintShown) {
	await page.getByRole('button', { name: 'Tutup saran memutar layar' }).click();
	await page.waitForTimeout(400);
}
log((await page.locator('.rotate-hint').count()) === 0, 'rotate hint can be dismissed');
await page.setViewportSize({ width: 1280, height: 800 });
await page.waitForTimeout(600);
log((await page.locator('.rotate-hint').count()) === 0, 'landscape hides the rotate hint');

log(errors.length === 0, 'no page errors', errors.slice(0, 2).join(' | '));

await page.screenshot({ path: '/tmp/kids-final.png' });
await browser.close();

console.log(failures === 0 ? '\nALL PASSED' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
