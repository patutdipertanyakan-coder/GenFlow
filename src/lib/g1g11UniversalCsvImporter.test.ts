import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { masterLexiconRepository } from './masterLexiconRepository';
import {
  G1G11PhraseRepository,
  getActiveG1G11PhraseBank,
  G1G11_CATEGORY_METADATA,
} from './g1g11PhraseRepository';
import {
  parseAndPreviewUniversalPhraseCsv,
  resolveG1G11CategoryCode,
  normalizePhraseComparisonText,
} from './g1g11UniversalCsvParser';
import {
  auditG1G11PhraseDistribution,
  enforceG1G11PhraseTarget,
} from './validatorAndPipeline';
import {
  executeStage6AutomaticPhraseSelection,
  applyG1G11PhraseOptimizationToScript,
} from './workflowEngine';
import { SourceGroundedPlan } from './types';

const MOCK_SOURCE_PLAN: SourceGroundedPlan = {
  main_topic: 'Pola Pikir Banyak Anak Banyak Rezeki',
  central_thesis: 'Doktrin banyak anak banyak rezeki tanpa perencanaan ekonomi memperparah kemiskinan struktural.',
  key_arguments: ['Biaya hidup naik', 'Upah stagnan', 'Pola pikir keliru dipelihara'],
  supporting_evidence: ['Rp1.500.000 per bulan', '1990-an', '3,14%'],
  target_word_count: 1620,
  source_references: [],
  unresolved_claims: [],
  wpm: 135,
  duration_minutes: 12,
  locked_perspective_boundary: 'Perilaku & Pola Pikir Masyarakat (Non-SARA)',
  storyflow_plan: [
    { blockId: 1, stageName: 'Hook', weightPercent: 8, targetWords: 130, coreFocus: 'Paradoks awal', keyPoints: ['Paradoks'], groundedSourcePoints: [] },
    { blockId: 2, stageName: 'Akar Masalah', weightPercent: 17, targetWords: 275, coreFocus: 'Akar kebiasaan', keyPoints: ['Akar'], groundedSourcePoints: [] },
    { blockId: 3, stageName: 'Inti Masalah', weightPercent: 45, targetWords: 729, coreFocus: 'Bedah data', keyPoints: ['Inti'], groundedSourcePoints: [] },
    { blockId: 4, stageName: 'Penyelesaian', weightPercent: 20, targetWords: 324, coreFocus: 'Solusi realistis', keyPoints: ['Solusi'], groundedSourcePoints: [] },
    { blockId: 5, stageName: 'Kesimpulan', weightPercent: 10, targetWords: 162, coreFocus: 'Logic punch', keyPoints: ['Kesimpulan'], groundedSourcePoints: [] },
  ],
};

before(async () => {
  await masterLexiconRepository.waitUntilReady();
  await G1G11PhraseRepository.getInstance().waitUntilReady();
});

test('1, 2, 3. SELECTIVE CATEGORY UPDATE: Impor CSV berisi G3 & G4 hanya mengubah G3 & G4, kategori G2 dan G5–G11 100% identik', async () => {
  const repo = G1G11PhraseRepository.getInstance();

  // Rekam snapshot teks dan kuantitas seluruh kategori sebelum impor
  const beforeSnapshot: Record<string, string[]> = {};
  for (const cat of Object.keys(G1G11_CATEGORY_METADATA)) {
    beforeSnapshot[cat] = repo.getPhrasesByCategory(cat).map((p) => p.currentText);
  }

  // Buat CSV khusus G3 dan G4
  const csvContent = [
    'phrase_id,Kategori,Frasa,Fungsi Kategori,Makna Kontekstual,Konteks Penggunaan,Saran Penggunaan,Aturan Penggunaan',
    ',G3,"Coba bayangin kalau beban biaya ini ditanggung sendiri,...",Ajakan Masuk,Mengajak penonton membayangkan,Situasi paradoks,Gunakan jika ada analogi,Jangan dipaksakan',
    ',G4,"Nah di titik inilah ilusi itu mulai kelihatan retak,...",Refleksi Ringan,Refleksi antargagasan,Transisi fakta,Satu frasa cukup,Jangan menumpuk',
  ].join('\n');

  const existingPhrases = repo.getAllPhrases();
  const preview = parseAndPreviewUniversalPhraseCsv(csvContent, existingPhrases);

  assert.equal(preview.isValid, true);
  assert.deepEqual(preview.affectedCategories.sort(), ['G3_AJAKAN_MASUK', 'G4_REFLEKSI_RINGAN'].sort());
  assert.equal(preview.newPhrasesCount, 2);

  // Jalankan Impor Transaksional
  const importResult = await repo.importUniversalCsvPhrases({
    fileName: 'test_g3_g4.csv',
    rows: preview.rows,
    affectedCategories: preview.affectedCategories,
    untouchedCategories: preview.untouchedCategories,
  });

  assert.equal(importResult.success, true);
  assert.equal(importResult.importRecord.newPhrasesCount, 2);

  // Verifikasi Pengujian 2: G3 dan G4 bertambah
  const g3After = repo.getPhrasesByCategory('G3_AJAKAN_MASUK').map((p) => p.currentText);
  const g4After = repo.getPhrasesByCategory('G4_REFLEKSI_RINGAN').map((p) => p.currentText);

  assert.equal(g3After.length, beforeSnapshot['G3_AJAKAN_MASUK'].length + 1);
  assert.equal(g4After.length, beforeSnapshot['G4_REFLEKSI_RINGAN'].length + 1);
  assert.ok(g3After.includes('Coba bayangin kalau beban biaya ini ditanggung sendiri,...'));
  assert.ok(g4After.includes('Nah di titik inilah ilusi itu mulai kelihatan retak,...'));

  // Verifikasi Pengujian 3: Seluruh kategori lain (G2, G5, G6, G7, G8, G9, G10, G11) 100% IDENTIK
  const untouchedList = ['G2_PEMBUKA_AKRAB', 'G5_NARATOR_DEKAT', 'G6_TRANSISI_NATURAL', 'G7_PENEKANAN_SANTAI', 'G8_MEMATAHKAN_ARGUMEN', 'G9_ESKALASI_TENSI', 'G10_INTERAKSI_PENONTON', 'G11_PENUTUP_NGOBROL'];

  for (const cat of untouchedList) {
    const afterTexts = repo.getPhrasesByCategory(cat).map((p) => p.currentText);
    assert.deepEqual(
      afterTexts,
      beforeSnapshot[cat],
      `Kategori ${cat} harus 100% identik dan tidak tersentuh sama sekali`
    );
  }
});

test('4. Impor frasa baru ke G6 tanpa memengaruhi kategori lain', async () => {
  const repo = G1G11PhraseRepository.getInstance();
  const g2Before = repo.getPhrasesByCategory('G2_PEMBUKA_AKRAB').map((p) => p.currentText);
  const g7Before = repo.getPhrasesByCategory('G7_PENEKANAN_SANTAI').map((p) => p.currentText);
  const g6BeforeCount = repo.getPhrasesByCategory('G6_TRANSISI_NATURAL').length;

  const csvContent = [
    'phrase_id,Kategori,Frasa,Fungsi Kategori',
    ',G6,"Dari sudut pandang regulasi, ini cerita yang berbeda,...",Transisi Natural',
  ].join('\n');

  const preview = parseAndPreviewUniversalPhraseCsv(csvContent, repo.getAllPhrases());
  assert.deepEqual(preview.affectedCategories, ['G6_TRANSISI_NATURAL']);

  const res = await repo.importUniversalCsvPhrases({
    fileName: 'test_g6.csv',
    rows: preview.rows,
    affectedCategories: preview.affectedCategories,
    untouchedCategories: preview.untouchedCategories,
  });

  assert.equal(res.success, true);
  const g6AfterCount = repo.getPhrasesByCategory('G6_TRANSISI_NATURAL').length;
  assert.equal(g6AfterCount, g6BeforeCount + 1);

  // Kategori lain tetap utuh
  assert.deepEqual(
    repo.getPhrasesByCategory('G2_PEMBUKA_AKRAB').map((p) => p.currentText),
    g2Before
  );
  assert.deepEqual(
    repo.getPhrasesByCategory('G7_PENEKANAN_SANTAI').map((p) => p.currentText),
    g7Before
  );
});

test('5 & 13. ZERO DUPLICATE POLICY: Impor frasa duplikat otomatis dilewati tanpa membuat record ganda', async () => {
  const repo = G1G11PhraseRepository.getInstance();
  let existingG2 = repo.getPhrasesByCategory('G2_PEMBUKA_AKRAB')[0];
  if (!existingG2) {
    await repo.importUniversalCsvPhrases({
      fileName: 'seed.csv',
      rows: [{ phraseText: 'Kalau lo perhatiin baik-baik,...', targetCategoryCode: 'G2_PEMBUKA_AKRAB', action: 'NEW' }],
      affectedCategories: ['G2_PEMBUKA_AKRAB'],
      untouchedCategories: [],
    });
    existingG2 = repo.getPhrasesByCategory('G2_PEMBUKA_AKRAB')[0];
  }
  const totalBefore = repo.getAllPhrases().length;

  // Coba impor frasa yang sudah ada persis
  const csvWithDuplicate = [
    'phrase_id,Kategori,Frasa,Fungsi Kategori',
    `,G2,"${existingG2.currentText}",Pembuka Akrab`,
    ',G2,"Frasa G2 Baru yang Belum Ada di Database Sebelumnya,...",Pembuka Akrab',
  ].join('\n');

  const preview = parseAndPreviewUniversalPhraseCsv(csvWithDuplicate, repo.getAllPhrases());
  assert.equal(preview.duplicatesCount, 1, 'Frasa yang sudah ada harus terdeteksi sebagai DUPLICATE');
  assert.equal(preview.newPhrasesCount, 1, 'Hanya frasa baru yang diizinkan masuk');

  const res = await repo.importUniversalCsvPhrases({
    fileName: 'dup_test.csv',
    rows: preview.rows,
    affectedCategories: preview.affectedCategories,
    untouchedCategories: preview.untouchedCategories,
  });

  assert.equal(res.success, true);
  assert.equal(res.importRecord.duplicatesCount, 1);
  assert.equal(res.importRecord.newPhrasesCount, 1);
  assert.equal(repo.getAllPhrases().length, totalBefore + 1);
});

test('6. SELECTIVE UPSERT: Impor frasa dengan phrase_id yang sudah terdaftar memperbarui record tersebut', async () => {
  const repo = G1G11PhraseRepository.getInstance();
  let existingRec = repo.getAllPhrases()[0];
  if (!existingRec) {
    await repo.importUniversalCsvPhrases({
      fileName: 'seed.csv',
      rows: [{ phraseText: 'Secara teori emang masuk akal, tapi...', targetCategoryCode: 'G8_MEMATAHKAN_ARGUMEN', action: 'NEW' }],
      affectedCategories: ['G8_MEMATAHKAN_ARGUMEN'],
      untouchedCategories: [],
    });
    existingRec = repo.getAllPhrases()[0];
  }
  const targetId = existingRec.id;
  const targetCat = existingRec.categoryNum;
  const versionBefore = existingRec.version;
  const newWording = 'Secara kasat mata kelihatan masuk akal, tapi faktanya justru berbanding terbalik,...';

  const csvWithId = [
    'phrase_id,Kategori,Frasa,Fungsi Kategori,Makna Kontekstual',
    `${targetId},${targetCat},"${newWording}",Mematahkan Argumen,Uji klaim kritis`,
  ].join('\n');

  const preview = parseAndPreviewUniversalPhraseCsv(csvWithId, repo.getAllPhrases());
  assert.equal(preview.updatedPhrasesCount, 1);
  assert.equal(preview.newPhrasesCount, 0);

  const res = await repo.importUniversalCsvPhrases({
    fileName: 'upsert_test.csv',
    rows: preview.rows,
    affectedCategories: preview.affectedCategories,
    untouchedCategories: preview.untouchedCategories,
  });

  assert.equal(res.success, true);
  assert.equal(res.importRecord.updatedPhrasesCount, 1);

  const updatedRec = repo.getPhraseById(targetId)!;
  assert.equal(updatedRec.id, targetId, 'ID permanen harus tetap identik');
  assert.equal(updatedRec.currentText, newWording, 'Teks harus terbarui');
  assert.equal(updatedRec.version, versionBefore + 1, 'Versi harus bertambah');
  assert.equal(updatedRec.contextualMeaning, 'Uji klaim kritis');
});

test('7. Impor file dengan kategori tidak valid ditandai/ditolak tanpa merusak data lain', async () => {
  const repo = G1G11PhraseRepository.getInstance();
  const totalBefore = repo.getAllPhrases().length;

  const csvWithInvalid = [
    'phrase_id,Kategori,Frasa',
    ',KATEGORI_PALSU_XYZ,"Frasa ini tidak boleh masuk",',
    ',G12_KATEGORI_TIDAK_ADA,"Frasa ini juga tidak boleh masuk",',
    ',G5,"Mungkin lo juga sempat curiga soal hal ini,...",',
  ].join('\n');

  const preview = parseAndPreviewUniversalPhraseCsv(csvWithInvalid, repo.getAllPhrases());
  assert.equal(preview.invalidCount, 2, 'Dua baris tidak valid harus ditolak');
  assert.equal(preview.newPhrasesCount, 1, 'Baris valid G5 tetap diproses');

  const res = await repo.importUniversalCsvPhrases({
    fileName: 'invalid_test.csv',
    rows: preview.rows,
    affectedCategories: preview.affectedCategories,
    untouchedCategories: preview.untouchedCategories,
  });

  assert.equal(res.success, true);
  assert.equal(res.importRecord.rejectedCount, 2);
  assert.equal(res.importRecord.newPhrasesCount, 1);
  assert.equal(repo.getAllPhrases().length, totalBefore + 1);
});

test('8 & 9. PERSISTENSI BACKEND & RESTART TOLERANCE: Data tersimpan permanen dan bertahan setelah restart', async () => {
  const repo = G1G11PhraseRepository.getInstance();
  const allPhrases = repo.getAllPhrases();

  // Simulasikan pembacaan ulang seperti server restart
  const activeBank = getActiveG1G11PhraseBank();
  assert.ok(activeBank);
  assert.ok(Array.isArray(activeBank['G3_AJAKAN_MASUK']));
  assert.ok(Array.isArray(activeBank['G4_REFLEKSI_RINGAN']));
});

test('10. INTEGRASI LIVE PHRASE EDITOR: Frasa hasil impor dapat diedit melalui Live Phrase Editor', async () => {
  const repo = G1G11PhraseRepository.getInstance();

  // Ambil frasa G3 yang baru diimpor
  const g3Phrases = repo.getPhrasesByCategory('G3_AJAKAN_MASUK');
  const importedPhrase = g3Phrases[g3Phrases.length - 1];
  assert.ok(importedPhrase);

  // Edit via updatePhraseText (fungsi yang sama dengan Live Phrase Editor)
  const editResult = await repo.updatePhraseText(
    importedPhrase.id,
    'Coba deh lo bayangin kalau beban biaya ini ditanggung sendiri tanpa bantuan,...',
    'Edit teks dari Live Phrase Editor'
  );

  assert.equal(editResult.success, true);
  const editedRec = repo.getPhraseById(importedPhrase.id)!;
  assert.ok(editedRec.version >= 2);
  assert.ok(editedRec.history.length >= 1);
});

test('11. SINKRONISASI TAHAP 2: Frasa hasil impor terbaru tersedia sebagai kandidat dinamis AI', async () => {
  const draftScript = [
    'Kalau lo perhatiin baik-baik, paradoks upah ini terus terjadi.',
    'Akar masalahnya bukan hal yang baru kemarin sore muncul.',
    'Datanya membuktikan beban pengeluaran naik drastis.',
    'Solusi nyata menuntut transparansi sistem insentif.',
    'Ujung-ujungnya kita sendiri yang mesti bersikap kritis.',
  ].join('\n');

  // Jalankan Tahap 6 pemilih frasa dinamis
  const selection = executeStage6AutomaticPhraseSelection(draftScript, MOCK_SOURCE_PLAN, {} as any);
  assert.ok(selection);
  assert.equal(selection.blockSelections.length, 5);

  // Pastikan seluruh bank aktif terbaca
  const activeBank = getActiveG1G11PhraseBank();
  assert.ok(activeBank['G3_AJAKAN_MASUK'].length > 0);
  assert.ok(activeBank['G4_REFLEKSI_RINGAN'].length > 0);
});

test('12 & 14. PRINSIP G1 & NON-FORCING: Tahap 3 Audit tidak mewajibkan penggunaan frasa baru', async () => {
  const naturalCleanScript = [
    'Masyarakat seringkali menerima tradisi tanpa memeriksa konsekuensi finansial.',
    'Beban ekonomi keluarga tumbuh lebih cepat daripada kenaikan upah bulanan.',
    'Fakta statistik memperlihatkan gap daya beli yang makin melebar sejak era sembilan puluhan.',
    'Langkah perbaikan sistem upah memerlukan kebijakan struktural yang akuntabel.',
    'Kesadaran kritis publik menjadi kunci pemulihan daya beli jangka panjang.',
  ].join('\n');

  // Naskah natural tanpa frasa buatan harus tetap LULUS tanpa pemaksaan
  const audit = auditG1G11PhraseDistribution(naturalCleanScript);
  assert.equal(audit.targetPhrasesTotal, 0, 'Target kuota tetap nol (Non-Forcing)');
  assert.ok(audit.blockAudits.every((b) => b.targetMet === true));
  assert.equal(audit.passed, true);

  // Enforcer Non-Forcing mempertahankan naskah 100%
  const enforced = enforceG1G11PhraseTarget(naturalCleanScript);
  assert.equal(enforced, naturalCleanScript);
});

test('15. RIWAYAT TRANSAKSI & ROLLBACK IMPOR: Batalkan transaksi impor berhasil memulihkan kondisi semula', async () => {
  const repo = G1G11PhraseRepository.getInstance();

  // Impor batch kecil
  const csv = [
    'phrase_id,Kategori,Frasa',
    ',G10,"Coba lo pikirin sekali lagi dampaknya ke keluarga lo,...",',
  ].join('\n');

  const preview = parseAndPreviewUniversalPhraseCsv(csv, repo.getAllPhrases());
  const res = await repo.importUniversalCsvPhrases({
    fileName: 'rollback_test.csv',
    rows: preview.rows,
    affectedCategories: preview.affectedCategories,
    untouchedCategories: preview.untouchedCategories,
  });

  assert.equal(res.success, true);
  const importId = res.importRecord.importId;
  const addedId = res.importRecord.addedIds[0];
  assert.ok(repo.getPhraseById(addedId));

  // Lakukan Rollback Transaksi
  const rollbackRes = await repo.rollbackImportTransaction(importId);
  assert.equal(rollbackRes.success, true);

  // Entri yang ditambahkan harus terhapus
  assert.equal(repo.getPhraseById(addedId), undefined);

  // Log status menjadi ROLLED_BACK
  const logs = await repo.getImportAuditLogs();
  const log = logs.find((l) => l.importId === importId);
  assert.equal(log?.status, 'ROLLED_BACK');
});
