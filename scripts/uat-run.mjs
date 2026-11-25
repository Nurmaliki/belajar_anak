import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

/**
 * UAT runner — Dunia Pintar 3D.
 * Mirrors docs/UAT.md. Runs VISIBLE (headed) so a stakeholder can watch, and
 * saves a screenshot per scenario to uat-artifacts/. Requires dev server :5175.
 */
const BASE = process.env.KIDS_URL ?? 'http://localhost:5175';
const ARTIFACTS = 'uat-artifacts';
mkdirSync(ARTIFACTS, { recursive: true });

let failures = 0;
const log = (ok, label, detail = '') => {
	console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
	if (!ok) failures++;
};

const browser = await chromium.launch({
	headless: false,
	slowMo: 60,
	args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
});
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

const state = () => page.evaluate(() => window.__duniaEngine.debugState());
const success = (s) => ['MISSION_SUCCESS', 'WORLD_EXPLORATION'].includes(s);

async function gotoKids(ready = 'canvas.world') {
	await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
	await page.waitForSelector(ready, { timeout: 30000 });
	await page.waitForTimeout(1200);
}
const shot = (step) => page.screenshot({ path: `${ARTIFACTS}/${step}.png` });

console.log('=== UAT 1 — Boot & menu ===');
await gotoKids();
log((await page.locator('canvas.world').count()) === 1, '1.1 kanvas 3D ter-mount');
log((await page.locator('.area').count()) === 5, '1.1 menu lima area tampil');
log((await page.screenshot()).length > 20000, '1.2 menu merender (bukan hitam)');
await shot('1-boot-menu');

await page.getByRole('button', { name: 'Main' }).click({ force: true });
await page.waitForTimeout(2200);

console.log('=== UAT 2 & 3 — Berhitung apel + tanpa hukuman ===');
let s = await state();
log(s.apples === 3 && s.mission === 'count-apples-3', '2.1 tiga apel + misi hitung', `mission=${s.mission}`);
log((await page.locator('.answer').count()) === 0, '2.2 tombol jawaban muncul hanya setelah semua apel');
await page.evaluate(() => window.__duniaEngine.debugState().pickables.forEach((id) => window.__duniaEngine.collectForTest(id)));
await page.waitForTimeout(700);
s = await state();
log(s.sessionCount === 3, '2.1 tiga apel terhitung', `count=${s.sessionCount}`);
log((await page.locator('.answer').count()) > 0, '2.2 tombol jawaban kini tampil');
await shot('2-counting');
await page.locator('.answer').filter({ hasText: '1' }).first().click();
await page.waitForTimeout(800);
s = await state();
log(s.phase === 'MISSION_ACTIVE', '3.1 jawaban salah: tetap dalam misi (tanpa hukuman)', s.phase);
log((await page.locator('.answer').count()) > 0, '3.1 retry tersedia');
await page.locator('.answer').filter({ hasText: '3' }).first().click();
await page.waitForTimeout(900);
const star = await page.locator('.star-chip').innerText();
log(/[1-9]/.test(star), '3.2 bintang diberikan', star.replace(/\s+/g, ' '));
await shot('3-star-awarded');
await page.waitForTimeout(2600);

console.log('=== UAT 4 — Menyusun kata ===');
await page.evaluate(() => window.__duniaEngine.startMissionForTest('assemble-baju'));
await page.waitForTimeout(1800);
log((await page.locator('.slot').count()) === 2, '4 dua slot suku kata tampil');
await page.evaluate(() => window.__duniaEngine.answerForTest('LA'));
await page.waitForTimeout(1100);
log((await state()).phase === 'MISSION_ACTIVE' && (await page.locator('.slot.filled').count()) === 0, '4.1 suku kata salah: slot tak terisi, retry');
await page.evaluate(() => window.__duniaEngine.answerForTest('BA'));
await page.waitForTimeout(600);
log((await page.locator('.slot.filled').count()) === 1, '4.2 suku kata pertama terisi');
await page.evaluate(() => window.__duniaEngine.answerForTest('JU'));
await page.waitForTimeout(1000);
log(success((await state()).phase), '4.2 kata BAJU tersusun, menang', (await state()).phase);
await shot('4-assemble-word');
await page.waitForTimeout(2600);

console.log('=== UAT 5 — Penjumlahan ===');
await page.evaluate(() => window.__duniaEngine.startMissionForTest('add-3-2'));
await page.waitForTimeout(1800);
log((await page.locator('.group').count()) === 2, '5.1 dua kelompok objek');
log((await page.locator('.obj').count()) === 5 && (await page.locator('.plus').count()) === 1, '5.1 total 5 objek + tanda plus');
await page.evaluate(() => window.__duniaEngine.answerForTest('4'));
await page.waitForTimeout(1000);
log((await state()).phase === 'MISSION_ACTIVE', '5.2 jawaban salah: tetap dalam misi');
await page.evaluate(() => window.__duniaEngine.answerForTest('5'));
await page.waitForTimeout(900);
log(success((await state()).phase), '5.3 jumlah benar menang');
await shot('5-addition');
await page.waitForTimeout(2600);

console.log('=== UAT 6 — Membandingkan ===');
await page.evaluate(() => window.__duniaEngine.startMissionForTest('compare-more'));
await page.waitForTimeout(1800);
log((await page.locator('.compare-group').count()) === 2, '6 dua kelompok tappable');
await page.evaluate(() => window.__duniaEngine.answerForTest('right'));
await page.waitForTimeout(1000);
log((await state()).phase === 'MISSION_ACTIVE', '6.1 pilih kelompok salah: retry');
await page.evaluate(() => window.__duniaEngine.answerForTest('left'));
await page.waitForTimeout(900);
log(success((await state()).phase), '6.2 kelompok lebih besar menang');
await shot('6-compare');
await page.waitForTimeout(2600);

console.log('=== UAT 7 — Mengurutkan ===');
await page.evaluate(() => window.__duniaEngine.startMissionForTest('sort-three'));
await page.waitForTimeout(1800);
log((await page.locator('.sort-slot').count()) === 3 && (await page.locator('.compare-group').count()) === 3, '7 tiga slot + tiga tumpukan');
await page.evaluate(() => window.__duniaEngine.answerForTest('3'));
await page.waitForTimeout(1000);
log((await state()).phase === 'MISSION_ACTIVE' && (await page.locator('.sort-slot.filled').count()) === 0, '7.1 pilihan salah: tak terisi, retry');
await page.evaluate(() => window.__duniaEngine.answerForTest('1'));
await page.waitForTimeout(600);
log((await page.locator('.sort-slot.filled').count()) === 1, '7.2 paling sedikit terisi duluan');
await page.evaluate(() => window.__duniaEngine.answerForTest('2'));
await page.waitForTimeout(500);
await page.evaluate(() => window.__duniaEngine.answerForTest('3'));
await page.waitForTimeout(900);
log((await page.locator('.sort-slot.filled').count()) === 3 && success((await state()).phase), '7.2 urut lengkap menang');
await shot('7-sort');
await page.waitForTimeout(2600);

console.log('=== UAT 8 — Pengurangan ===');
await page.evaluate(() => window.__duniaEngine.startMissionForTest('subtract-5-2'));
await page.waitForTimeout(1800);
const stay = await page.locator('.take-away .obj:not(.gone)').count();
const gone = await page.locator('.take-away .obj.gone').count();
log(stay === 3 && gone === 2, '8.1 tiga apel sisa + dua dicoret', `${stay} sisa, ${gone} dicoret`);
await page.evaluate(() => window.__duniaEngine.answerForTest('2'));
await page.waitForTimeout(1000);
log((await state()).phase === 'MISSION_ACTIVE', '8.2 jawab angka dicoret (salah): retry');
await page.evaluate(() => window.__duniaEngine.answerForTest('3'));
await page.waitForTimeout(900);
log(success((await state()).phase), '8.3 sisa benar menang');
await shot('8-subtract');
await page.waitForTimeout(2600);

console.log('=== UAT 9 — Huruf: gambar + suara, tanpa teks di layar ===');
await page.evaluate(() => window.__duniaEngine.startMissionForTest('letter-a'));
await page.waitForTimeout(1600);
const caption = (await page.locator('.prompt-caption').count()) ? await page.locator('.prompt-caption').innerText() : '';
log(caption.trim() === '', '9.1 prompt huruf tidak mencetak kata (pre-reader)', `caption="${caption}"`);
log((await page.locator('.prompt-icon').count()) === 1, '9.1 prompt menampilkan gambar');
await page.evaluate(() => window.__duniaEngine.answerForTest('A'));
await page.waitForTimeout(900);
log(success((await state()).phase), '9.2 jawaban benar menang');
await shot('9-letter');
await page.waitForTimeout(2600);

console.log('=== UAT 10 — Bimo, pemandu ramah ===');
await page.waitForTimeout(600);
const b0 = await state();
log(Number.isFinite(b0.bimoX) && b0.bimoState === 'idle', '10.1 Bimo hadir dan tenang', `${b0.bimoX},${b0.bimoZ}`);
await page.evaluate(() => window.__duniaEngine.greetBimoForTest());
await page.waitForTimeout(150);
log((await state()).bimoState === 'hop', '10.2 tap Bimo → melompat', (await state()).bimoState);
let landed = false;
for (let i = 0; i < 40 && !landed; i++) {
	await page.waitForTimeout(250);
	landed = (await state()).bimoState === 'idle';
}
log(landed, '10.2 Bimo tenang kembali');
await page.evaluate(() => window.__duniaEngine.startMissionForTest('subtract-4-1'));
await page.waitForTimeout(1600);
await page.evaluate(() => window.__duniaEngine.answerForTest('3'));
await page.waitForTimeout(300);
log((await state()).bimoState === 'cheer', '10.3 Bimo bersorak saat Bubu menang', (await state()).bimoState);
await shot('10-bimo-cheer');
await page.waitForTimeout(2600);

console.log('=== UAT 11 — Lemari aksesori: semuanya terbuka & tersimpan ===');
await page.getByRole('button', { name: 'Lemari Bubu' }).click();
await page.waitForTimeout(400);
log((await page.locator('.wardrobe').count()) === 1, '11.1 lemari terbuka dari HUD');
const offered = await page.locator('.wardrobe .item').count();
log(offered >= 7, '11.1 semua aksesori + "tanpa"', `${offered} tombol`);
log((await page.locator('.wardrobe [disabled]').count()) === 0, '11.1 TIDAK ADA yang terkunci/disabled');
await page.getByRole('button', { name: 'Mahkota' }).click();
await page.waitForTimeout(500);
const dressed = await state();
log(dressed.wearing === 'mahkota' && dressed.accessoryMeshes > 0, '11.2 mahkota terpasang (geometry nyata)', `${dressed.accessoryMeshes} meshes`);
await shot('11-wardrobe');
await page.getByRole('button', { name: 'Tutup lemari' }).click();
await page.waitForTimeout(300);
await gotoKids();
await page.waitForTimeout(2200);
const restored = await state();
log(restored.wearing === 'mahkota' && restored.accessoryMeshes > 0, '11.3 outfit bertahan setelah reload', `${restored.accessoryMeshes} meshes`);

console.log('=== UAT 12 — Dashboard orang tua ===');
await page.goto(BASE + "/parent", { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForSelector("#gate-input", { timeout: 30000 });
await page.waitForTimeout(400);
const gateLabel = await page.locator('label[for="gate-input"]').innerText();
const nums = gateLabel.match(/(\d+)\s*\+\s*(\d+)/);
if (!nums) log(false, '12.1 kunci orang tua terbaca', gateLabel);
else {
	const sum = Number(nums[1]) + Number(nums[2]);
	await page.locator('#gate-input').fill(String(sum));
	await page.getByRole('button', { name: 'Buka' }).click();
	await page.waitForTimeout(1200);
	const body = await page.locator('main.parent').innerText();
	log(!/Kunci Orang Tua/.test(body), '12.1 kunci terbuka dengan jawaban benar');
	log(/[1-9]/.test(await page.locator('.tile', { hasText: 'Bintang' }).first().innerText()), '12.2 bintang tampil');
	log(/count-apples-3/.test(await page.locator('.tile', { hasText: 'Misi selesai' }).first().innerText()), '12.2 misi selesai tampil');
	log((await page.locator('.area').count()) === 5, '12.3 satu baris per area', `${await page.locator('.area').count()} baris`);
	const counting = Number(await page.locator('.area[data-area="counting"] .area-bar').getAttribute('aria-valuenow'));
	log(counting > 0 && counting < 100, '12.3 progres area dalam persen', `${counting}%`);
	log((await page.locator('.recommend').count()) === 1, '12.4 rekomendasi "Coba berikutnya" tampil');
	const voice = await page.locator('[data-testid="voice-status"]').innerText();
	log(voice.trim().length >	0, '12.5 status suara perangkat ditampilkan', voice.replace(/\s+/g, ' '));
	await shot('12-dashboard');
}

console.log('=== UAT 13 — PWA installable & offline aset ===');
for (const f of ['/manifest.webmanifest', '/sw.js', '/icon-192.png', '/icon-512.png', '/og-image.png']) {
	const r = await page.request.get(BASE + f);
	log(r.ok(), `13.1 ${f} tersedia (${r.status()})`);
}
const manifest = await page.evaluate(async () => (await fetch('manifest.webmanifest').catch(() => null))?.status);
log(manifest === 200, '13.2 manifest dapat dimuat dari halaman', `status=${manifest}`);

console.log('=== UAT 14 — Ketahanan: penyimpanan gagal bukan akhir dunia ===');
await page.addInitScript(() => {
	Object.defineProperty(window, 'indexedDB', { configurable: true, value: undefined, writable: true });
});
await gotoKids();
await page.waitForTimeout(1800);
await page.getByRole('button', { name: 'Main' }).click({ force: true });
await page.waitForTimeout(2200);
log(Boolean(await page.evaluate(() => window.__duniaEngine)), '14.1 game tetap start tanpa IndexedDB');
await page.evaluate(() => window.__duniaEngine.startMissionForTest('color-merah'));
await page.waitForTimeout(1600);
await page.evaluate(() => window.__duniaEngine.answerForTest('Merah'));
let warned = false;
for (let i = 0; i < 16 && !warned; i++) {
	await page.waitForTimeout(250);
	warned = (await page.locator('.notice').count()) === 1;
}
log(warned, '14.2 kegagalan simpan menampilkan banner, bukan senyap');
const notice = warned ? await page.locator('.notice').innerText() : '';
log(/waktu terbuka|tidak tersedia/i.test(notice), '14.2 banner menjelaskan masalahnya', notice.replace(/\s+/g, ' '));
await shot('14-storage-fail');

log(errors.length === 0, 'tidak ada page error', errors.slice(0, 2).join(' | '));
await browser.close();
console.log(failures === 0 ? '\nALL PASSED' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
