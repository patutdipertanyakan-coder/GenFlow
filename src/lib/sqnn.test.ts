import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applySQNN,
  classifyQuoteSemanticFunction,
  DOUBLE_QUOTE_CHARS_REGEX,
  normalizeQuotesSemanticallyInBlock,
  validateQuoteFreeNarration,
} from './sqnnEngine';
import {
  applyAutoEnforce,
  applyExpanderDeterministic,
  enforceLockedConfig,
  validateFullScript,
} from './validatorAndPipeline';
import { createValidTestSCTFScript } from './testFixtures';
import { LOCKED_CRITICAL_PERSPECTIVE } from './types';

test('1. Slogan dengan tanda petik: normalisasi kalimat sakti menjadi slogan naratif lisan', () => {
  const input =
    'Lo pasti sering denger kalimat sakti "banyak anak banyak rezeki" tiap kali ada keluarga yang kondisinya pas-pasan.';
  const result = normalizeQuotesSemanticallyInBlock(input, 0);

  assert.equal(DOUBLE_QUOTE_CHARS_REGEX.test(result.normalizedText), false);
  assert.match(result.normalizedText, /slogan banyak anak banyak rezeki/i);
  assert.match(result.normalizedText, /keluarga yang kondisinya pas-pasan/i);
  assert.equal(result.quotesTransformedCount, 1);
  assert.equal(result.findings[0]?.quoteType, 'SLOGAN');
});

test('2. Kutipan populer dalam kalimat informal: transformasi "rezeki udah ada yang ngatur" & "kerja keras pasti bikin kaya"', () => {
  // Contoh B
  const inputB =
    'Mereka ngumpet di balik kalimat "rezeki udah ada yang ngatur" tanpa mikirin kesiapan finansial.';
  const resultB = normalizeQuotesSemanticallyInBlock(inputB, 0);

  assert.equal(DOUBLE_QUOTE_CHARS_REGEX.test(resultB.normalizedText), false);
  assert.match(resultB.normalizedText, /berlindung di balik anggapan bahwa rezeki udah ada yang ngatur/i);
  assert.match(resultB.normalizedText, /tanpa mikirin kesiapan finansial/i);

  // Contoh C
  const inputC =
    'Orang sering bilang "kerja keras pasti bikin kaya", padahal kenyataannya nggak sesederhana itu.';
  const resultC = normalizeQuotesSemanticallyInBlock(inputC, 0);

  assert.equal(DOUBLE_QUOTE_CHARS_REGEX.test(resultC.normalizedText), false);
  assert.match(resultC.normalizedText, /menganggap kerja keras pasti bikin kaya/i);
  assert.match(resultC.normalizedText, /padahal kenyataannya nggak sesederhana itu/i);
});

test('3. Kutipan langsung yang memiliki sumber: atribusi narasumber dan data dipertahankan utuh', () => {
  const input =
    'Menurut catatan resmi BPS, "pertumbuhan ekonomi tertahan di angka 5,05% sepanjang 2024", tapi kebijakan pemerintah malah jalan di tempat.';
  const result = normalizeQuotesSemanticallyInBlock(input, 0);

  assert.equal(DOUBLE_QUOTE_CHARS_REGEX.test(result.normalizedText), false);
  // Atribusi BPS harus tetap ada
  assert.match(result.normalizedText, /BPS/);
  // Angka persentase harus tetap ada
  assert.match(result.normalizedText, /5,05%/);
  assert.match(result.normalizedText, /2024/);
  assert.equal(result.findings[0]?.hasAttribution, true);
});

test('4. Tanda petik lurus dan melengkung (“...” / „...” / «...»): semua varian dibersihkan secara semantik', () => {
  const straight = 'Lo sering denger ungkapan "harta gak dibawa mati" di tongkrongan.';
  const curly = 'Lo sering denger ungkapan “harta gak dibawa mati” di tongkrongan.';
  const germanic = 'Lo sering denger ungkapan „harta gak dibawa mati” di tongkrongan.';
  const guillemets = 'Lo sering denger ungkapan «harta gak dibawa mati» di tongkrongan.';

  const resStraight = normalizeQuotesSemanticallyInBlock(straight, 0);
  const resCurly = normalizeQuotesSemanticallyInBlock(curly, 0);
  const resGermanic = normalizeQuotesSemanticallyInBlock(germanic, 0);
  const resGuillemets = normalizeQuotesSemanticallyInBlock(guillemets, 0);

  assert.equal(DOUBLE_QUOTE_CHARS_REGEX.test(resStraight.normalizedText), false);
  assert.equal(DOUBLE_QUOTE_CHARS_REGEX.test(resCurly.normalizedText), false);
  assert.equal(DOUBLE_QUOTE_CHARS_REGEX.test(resGermanic.normalizedText), false);
  assert.equal(DOUBLE_QUOTE_CHARS_REGEX.test(resGuillemets.normalizedText), false);

  assert.match(resStraight.normalizedText, /ungkapan harta gak dibawa mati/i);
  assert.match(resCurly.normalizedText, /ungkapan harta gak dibawa mati/i);
  assert.match(resGermanic.normalizedText, /ungkapan harta gak dibawa mati/i);
  assert.match(resGuillemets.normalizedText, /ungkapan harta gak dibawa mati/i);
});

test('5. Kalimat dengan beberapa pasangan tanda petik dalam satu blok', () => {
  const input =
    'Banyak orang membela diri pakai kalimat sakti "banyak anak banyak rezeki", terus di saat yang sama mereka ngumpet di balik kalimat "rezeki udah ada yang ngatur", padahal tetangga mereka sering bilang "kerja keras pasti bikin kaya" buat nutupin masalah riil.';
  const result = normalizeQuotesSemanticallyInBlock(input, 0);

  assert.equal(DOUBLE_QUOTE_CHARS_REGEX.test(result.normalizedText), false);
  assert.equal(result.quotesTransformedCount, 3);
  assert.match(result.normalizedText, /slogan banyak anak banyak rezeki/i);
  assert.match(result.normalizedText, /berlindung di balik anggapan bahwa rezeki udah ada yang ngatur/i);
  assert.match(result.normalizedText, /menganggap kerja keras pasti bikin kaya/i);
});

test('6. Kalimat yang mengandung SAP Protected Tokens: Rp1.500.000, 3,14%, tahun 1990-an tetap 100% utuh', () => {
  const input =
    'Waktu upah riil mandek di angka 3,14% sejak 1990-an dan biaya sewa tembus Rp1.500.000, pejabat sering bilang "masyarakat harus lebih hemat" tanpa ngasih solusi.';
  const result = normalizeQuotesSemanticallyInBlock(input, 0);

  assert.equal(DOUBLE_QUOTE_CHARS_REGEX.test(result.normalizedText), false);
  assert.match(result.normalizedText, /3,14%/);
  assert.match(result.normalizedText, /1990-an/);
  assert.match(result.normalizedText, /Rp1\.500\.000/);
});

test('7. Kalimat dengan makian terintegrasi: 3–5 makian valid per blok tetap utuh dan terintegrasi', () => {
  const block = [
    'Kalau lo perhatiin cara orang ngeles, logika goblok yang bilang "rezeki udah ada yang ngatur" itu jelas nutupin kemalasan.',
    'Banyak orang nelan mentah-mentah anggapan tolol kalau hidup pas-pasan itu lebih mulia daripada berikhtiar.',
    'Keputusan bego buat ngorbanin gizi anak demi gengsi semu malah dibela mati-matian.',
  ].join(' ');

  const result = normalizeQuotesSemanticallyInBlock(block, 0);

  assert.equal(DOUBLE_QUOTE_CHARS_REGEX.test(result.normalizedText), false);
  // Makian harus tetap ada dan terintegrasi dalam klausa
  assert.match(result.normalizedText, /logika goblok/i);
  assert.match(result.normalizedText, /anggapan tolol/i);
  assert.match(result.normalizedText, /keputusan bego/i);
});

test('8. Lima blok SCTF lengkap: pipeline SQNN memvalidasi dan meluluskan naskah utuh', () => {
  const faktaTerverifikasi =
    'Biaya hidup meningkat Rp1.500.000 per bulan sejak 1990-an, sementara pertumbuhan upah riil tertahan di angka 3,14% per tahun.';
  const defaultScript = applyAutoEnforce(
    createValidTestSCTFScript(faktaTerverifikasi),
    { faktaTerverifikasi, durasiMenit: 2, allowEditorialRewrite: true }
  );

  // Pastikan naskah deterministik default 100% bebas tanda petik
  assert.equal(DOUBLE_QUOTE_CHARS_REGEX.test(defaultScript), false);

  const audit = validateFullScript(
    defaultScript,
    enforceLockedConfig({ faktaTerverifikasi, durasiMenit: 2, allowEditorialRewrite: true })
  );
  assert.equal(audit.sctfValid, true);
  assert.equal(audit.paragraphCount, 5);
  assert.equal(audit.quoteFree?.passed, true);
  assert.equal(audit.quoteFree?.status, 'QUOTE-FREE LULUS');
  assert.equal(audit.passed, true);
});

test('9. Hasil Perbaiki (applyAutoEnforce) dan Perdalam (applyExpanderDeterministic): mempertahankan status Quote-Free LULUS', () => {
  const scriptWithQuotes = [
    'Kalau lo perhatiin baik-baik, banyak yang ngumpet di balik kalimat "rezeki udah ada yang ngatur" seolah itu dalil paling sakti. Logika goblok kayak gini bikin orang malas mikir, anggapan tolol itu terus dipelihara, dan keputusan bego tersebut malah merugikan keluarga.',
    'Dari situ kelihatan jelas kalau akar masalahnya bukan cuma soal nasib, tapi cara mikir masyarakat. Selama bertahun-tahun asumsi bodoh dibela, argumen dungu dipertahankan, dan mentalitas kampungan bikin nalar kritis mati.',
    'Masalahnya makin kelihatan waktu orang sering bilang "kerja keras pasti bikin kaya" padahal fakta lapangan beda. Pembenaran idiot terus dipakai, pola pikir tolol bikin utang numpuk, dan skema gila membenarkan standar ganda ini.',
    'Kalau kita mau ngebenerin situasi ini, kita harus berani ngoreksi alasan bego yang ada. Sikap sinting membiarkan pembenaran sepihak harus dihentikan, dan klaim goblok tanpa bukti harus ditolak tegas.',
    'Ujung-ujungnya fenomena ini nunjukin kalau narasi idiot harus dilawan, pembenaran gila harus dikoreksi, dan langkah bodoh mempertahankan cara bernalar keliru harus diakhiri sekarang juga.',
  ].join('\n');

  // Sebelum auto-enforce: scriptWithQuotes punya tanda petik
  assert.equal(DOUBLE_QUOTE_CHARS_REGEX.test(scriptWithQuotes), true);

  // Auto-enforce membersihkan tanda petik secara semantik
  const enforced = applyAutoEnforce(scriptWithQuotes, { jumlahBlok: 5 });
  assert.equal(DOUBLE_QUOTE_CHARS_REGEX.test(enforced), false);

  const enforcedAudit = validateFullScript(enforced);
  assert.equal(enforcedAudit.quoteFree?.passed, true);
  assert.equal(enforcedAudit.quoteFree?.status, 'QUOTE-FREE LULUS');

  // Expander juga harus tetap quote-free
  const expanded = applyExpanderDeterministic(enforced, { jumlahBlok: 5 });
  assert.equal(DOUBLE_QUOTE_CHARS_REGEX.test(expanded), false);

  const expandedAudit = validateFullScript(expanded);
  assert.equal(expandedAudit.quoteFree?.passed, true);
});

test('10. Hasil penyuntingan manual: deteksi tanda petik yang dimasukkan manual dan penolakan kelulusan jika belum diperbaiki', () => {
  const cleanScript = createValidTestSCTFScript('Data riil upah stagnan 3,14%.');

  // Pengguna secara sengaja menyisipkan tanda petik manual
  const lines = cleanScript.split('\n');
  lines[0] = lines[0] + ' Dia berseru "ini gila!" di depan umum.';
  const editedWithQuote = lines.join('\n');

  const audit = validateQuoteFreeNarration(editedWithQuote);
  assert.equal(audit.passed, false);
  assert.equal(audit.status, 'QUOTE-FREE PERLU PERBAIKAN');
  assert.equal(audit.totalQuotesFound >= 1, true);

  // Validasi FullScript juga wajib gagal ketika Quote-Free gagal
  const fullAudit = validateFullScript(editedWithQuote);
  assert.equal(fullAudit.quoteFree?.passed, false);
  assert.equal(fullAudit.passed, false);

  // Namun setelah SQNN dijalankan, naskah kembali lulus
  const normalized = applySQNN(editedWithQuote).normalizedScript;
  assert.equal(DOUBLE_QUOTE_CHARS_REGEX.test(normalized), false);
  const reAudit = validateFullScript(normalized);
  assert.equal(reAudit.quoteFree?.passed, true);
});

test('11. Source Fidelity dan NON_SARA_HARD_GUARD: transformasi normalisasi tidak memicu pelanggaran Non-SARA', () => {
  const input =
    'Sebagian orang berlindung di balik ungkapan "harta gak dibawa mati" buat membenarkan kemalasan finansial.';
  const result = normalizeQuotesSemanticallyInBlock(input, 0);

  assert.equal(DOUBLE_QUOTE_CHARS_REGEX.test(result.normalizedText), false);

  // Periksa apakah ada pelanggaran SARA yang timbul
  const auditReport = validateQuoteFreeNarration(result.normalizedText);
  assert.equal(auditReport.passed, true);
  assert.equal(auditReport.status, 'QUOTE-FREE LULUS');
});

test('12. Pencegahan fragmen kata atau kalimat tidak lengkap pasca normalisasi', () => {
  const inputA =
    'Mereka sering bilang, "kita harus pasrah", padahal masalahnya ada di kebijakan.';
  const resultA = normalizeQuotesSemanticallyInBlock(inputA, 0);

  // Tidak boleh ada koma ganda ", ," atau spasi sebelum koma " ,"
  assert.equal(/\s+,/.test(resultA.normalizedText), false);
  assert.equal(/,\s*,/.test(resultA.normalizedText), false);
  assert.match(resultA.normalizedText, /sering menganggap kita harus pasrah, padahal masalahnya/i);

  const inputB =
    'Tetangga bilang: "kita harus siap hadapi kenyataan", padahal data membuktikan sebaliknya.';
  const resultB = normalizeQuotesSemanticallyInBlock(inputB, 0);
  assert.equal(/\s+,/.test(resultB.normalizedText), false);
  assert.equal(/,\s*,/.test(resultB.normalizedText), false);
  assert.match(resultB.normalizedText, /bilang kalau kita harus siap hadapi kenyataan, padahal data/i);
});
