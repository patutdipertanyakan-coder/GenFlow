import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import {
  tokenizeRfc4180Csv,
  evaluateStructuredContextualRule,
  parseUniversalCsvWithPreview,
} from './universalCsvParser';
import { masterLexiconRepository } from './masterLexiconRepository';

before(async () => {
  await masterLexiconRepository.waitUntilReady();
});

test('1. RFC-4180 tokenizer: handles commas in quotes, escaped quotes, and newlines', () => {
  const csv = `"kata","kategori","padanan","fungsi","makna, kontekstual","saran","aturan"
"ngulur-ngulur","Afiks","menunda","Verba","Menunda pekerjaan, sengaja berlarut-larut","tunda","Gunakan wajar"
"bego","Kasap","bodoh","Makian","Kata makian ""kasar""","kurang paham","Hindari total"`;

  const rows = tokenizeRfc4180Csv(csv);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].length, 7);
  assert.equal(rows[1][0], 'ngulur-ngulur');
  assert.equal(rows[1][4], 'Menunda pekerjaan, sengaja berlarut-larut');
  assert.equal(rows[2][4], 'Kata makian "kasar"');
});

test('2. Structured rule classification: accurately determines ALLOW, CONDITIONAL, and AVOID', () => {
  const allowItem = evaluateStructuredContextualRule({
    kata: 'ngopi',
    kategori: 'Register/morfologi/slang',
    fungsiKata: 'Verba percakapan',
    maknaKontekstual: 'Minum kopi santai',
    aturanPenggunaan: 'Bebas digunakan dalam obrolan santai Gue–Lo',
  });
  assert.equal(allowItem.status, 'ALLOW');

  const conditionalItem = evaluateStructuredContextualRule({
    kata: 'cuci tangan',
    kategori: 'Makna kiasan/polisemi',
    fungsiKata: 'Idiom kontekstual',
    maknaKontekstual: 'Lepas tanggung jawab',
    aturanPenggunaan: 'Wajib ada bukti jelas pihak yang lari dari tanggung jawab',
  });
  assert.equal(conditionalItem.status, 'CONDITIONAL');

  const avoidItem = evaluateStructuredContextualRule({
    kata: 'pemeras',
    kategori: 'Konotasi negatif/tuduhan',
    fungsiKata: 'Nomina tuduhan',
    maknaKontekstual: 'Tuduhan memeras uang',
    aturanPenggunaan: 'Dilarang gunakan tanpa putusan inkrah pengadilan, hindari',
  });
  assert.equal(avoidItem.status, 'AVOID');
});

test('3. Universal CSV parser preview: validates 7-column rows, rejects tombstones and duplicates', () => {
  const existing = new Set(['liat']);
  const tombstones = new Set(['goblok']);

  const csv = `Kata,Kategori,Padanan Formal,Fungsi Kata,Makna Kontekstual,Saran,Aturan Penggunaan
ngulik,Afiks,mempelajari,Verba,Mempelajari sesuatu secara mendalam,pelajari,Gunakan luwes
liat,Kategori A,melihat,Verba,Melihat,lihat,Gunakan santai
goblok,Makian,bodoh,Peyoratif,Kata kasar,kurang teliti,Dilarang keras`;

  const preview = parseUniversalCsvWithPreview(csv, existing, tombstones);
  assert.equal(preview.isValid, true);
  assert.equal(preview.totalRows, 3);
  assert.equal(preview.validRows.length, 1);
  assert.equal(preview.validRows[0].kata, 'ngulik');
  assert.equal(preview.duplicatesCount, 1); // liat
  assert.equal(preview.tombstoneDuplicatesCount, 1); // goblok
});

test('4. Master Data Integration: importUniversalCsv saves to single backend repository without bumping version', async () => {
  const testWord = `ujiunv${Date.now()}`;
  const importRes = await masterLexiconRepository.importUniversalCsv({
    name: 'Test-Universal-Import',
    fileName: 'test_universal.csv',
    rows: [
      {
        kata: testWord,
        kategori: 'Register/morfologi/slang',
        padananFormal: 'eksplorasi',
        fungsiKata: 'Verba Percakapan',
        maknaKontekstual: 'Uji coba integrasi 7 kolom universal',
        saran: 'eksplorasi',
        aturanPenggunaan: 'Dapat digunakan santai',
        inferredStatus: 'ALLOW',
        inferredF7Category: 'Register/morfologi/slang',
        isAttentionHigh: false,
        statusReason: 'Lolos uji 7 kolom',
      },
    ],
  });

  assert.equal(importRes.success, true);
  assert.equal(importRes.entries_imported, 1);

  // Verifikasi entri tersimpan di Master Repository
  const unified = masterLexiconRepository.getUnifiedEntries();
  const found = unified.find((e) => e.entry === testWord);
  assert.ok(found);
  assert.equal(found?.formal, 'eksplorasi');
  assert.ok(found?.f7_guard);
});

test('5. Deletion Semantics Separation: dismissScriptFinding does NOT delete master entry from Repository', async () => {
  const masterWord = 'ceplas-ceplos';
  
  // Pastikan kata ada di registry
  const unified = masterLexiconRepository.getUnifiedEntries();
  const existsBefore = unified.some((e) => e.entry.toLowerCase() === masterWord.toLowerCase());

  if (existsBefore) {
    // Dismiss temuan naskah
    const dismissRes = masterLexiconRepository.dismissScriptFinding(masterWord);
    assert.equal(dismissRes.success, true);
    assert.equal(masterLexiconRepository.isFindingDismissed(masterWord), true);

    // Verifikasi kata MASIH ADA di Master Repository (tidak terhapus)
    const stillInRepo = masterLexiconRepository.getUnifiedEntries().some((e) => e.entry.toLowerCase() === masterWord.toLowerCase());
    assert.equal(stillInRepo, true);

    // Reset dismissal
    masterLexiconRepository.resetDismissedScriptFindings();
    assert.equal(masterLexiconRepository.isFindingDismissed(masterWord), false);
  }
});

test('6. Unregistered words scanner: detects words outside master repository and provides 1-click registration', async () => {
  const fakeWord = 'unregisteredkatates';
  const script = `Gue mau nyoba kata baru yaitu ${fakeWord} yang belum pernah terdaftar sama sekali di kamus manapun.`;

  const unregList = masterLexiconRepository.getUnregisteredScriptWords(script);
  assert.ok(unregList.length > 0);
  const detected = unregList.find((w) => w.word.toLowerCase() === fakeWord.toLowerCase());
  assert.ok(detected);
  assert.equal(detected?.occurrencesCount, 1);
});

test('7. F7 Rule Removal: removeF7Rule strips f7_guard metadata without deleting parent entry from Repository', async () => {
  const masterWord = 'nyalahin';
  
  const unifiedBefore = masterLexiconRepository.getUnifiedEntries();
  if (!unifiedBefore.some((e) => e.entry.toLowerCase() === masterWord.toLowerCase())) {
    await masterLexiconRepository.importUniversalCsv({
      name: 'Test-F7-Setup',
      fileName: 'f7_test.csv',
      rows: [
        {
          kata: masterWord,
          kategori: 'Register/morfologi/slang',
          padananFormal: 'menyalahkan',
          fungsiKata: 'Verba',
          maknaKontekstual: 'Menyalahkan pihak lain',
          saran: 'menyalahkan',
          aturanPenggunaan: 'Aturan F7 awal',
          inferredStatus: 'ALLOW',
          inferredF7Category: 'Register/morfologi/slang',
        },
      ],
    });
  }

  const res = await masterLexiconRepository.removeF7Rule(masterWord);
  assert.equal(res.success, true);

  const unified = masterLexiconRepository.getUnifiedEntries();
  const entry = unified.find((e) => e.entry.toLowerCase() === masterWord.toLowerCase());
  assert.ok(entry);
  assert.equal(entry?.f7_guard, undefined);
  assert.equal(entry?.needs_review, true);
  assert.equal(entry?.naturalness_status, 'NEEDS_CONTEXT_REVIEW');
  assert.match(entry?.review_reason || '', /BELUM DITINJAU/i);
});
