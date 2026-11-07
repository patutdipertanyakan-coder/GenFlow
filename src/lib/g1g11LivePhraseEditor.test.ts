import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { masterLexiconRepository } from './masterLexiconRepository';
import {
  G1G11PhraseRepository,
  getActiveG1G11PhraseBank,
  validatePhraseSemanticAlignment,
  G1G11_CATEGORY_METADATA,
} from './g1g11PhraseRepository';
import { NARRATIVE_PHRASE_CATEGORIES } from './lexiconRegistry';
import {
  auditG1G11PhraseDistribution,
  enforceG1G11PhraseTarget,
} from './validatorAndPipeline';
import {
  executeStage6AutomaticPhraseSelection,
  applyG1G11PhraseOptimizationToScript,
} from './workflowEngine';
import { SourceGroundedPlan } from './types';

const MOCK_PLAN: SourceGroundedPlan = {
  main_topic: 'Pola Pikir Banyak Anak Banyak Rezeki',
  central_thesis: 'Doktrin banyak anak banyak rezeki tanpa perencanaan ekonomi memperparah kemiskinan struktural.',
  key_arguments: ['Biaya hidup naik', 'Upah stagnan', 'Pola pikir keliru'],
  supporting_evidence: ['Rp1.500.000 per bulan', '1990-an', '3,14%'],
  target_word_count: 1620,
  source_references: [],
  unresolved_claims: [],
  wpm: 135,
  duration_minutes: 12,
  locked_perspective_boundary: 'Perilaku & Pola Pikir Masyarakat (Non-SARA)',
  storyflow_plan: [
    { blockId: 1, stageName: 'Hook', weightPercent: 8, targetWords: 130, coreFocus: 'Paradoks', keyPoints: ['Paradoks'], groundedSourcePoints: [] },
    { blockId: 2, stageName: 'Akar Masalah', weightPercent: 17, targetWords: 275, coreFocus: 'Akar', keyPoints: ['Akar'], groundedSourcePoints: [] },
    { blockId: 3, stageName: 'Inti Masalah', weightPercent: 45, targetWords: 729, coreFocus: 'Inti', keyPoints: ['Inti'], groundedSourcePoints: [] },
    { blockId: 4, stageName: 'Penyelesaian', weightPercent: 20, targetWords: 324, coreFocus: 'Solusi', keyPoints: ['Solusi'], groundedSourcePoints: [] },
    { blockId: 5, stageName: 'Kesimpulan', weightPercent: 10, targetWords: 162, coreFocus: 'Kesimpulan', keyPoints: ['Kesimpulan'], groundedSourcePoints: [] },
  ],
};

before(async () => {
  await masterLexiconRepository.waitUntilReady();
  await G1G11PhraseRepository.getInstance().waitUntilReady();
});

async function seedSamplePhrasesIfNeeded() {
  const repo = G1G11PhraseRepository.getInstance();
  if (repo.getAllPhrases().length >= 12) return;
  const sampleData = [
    { targetCategoryCode: 'G2_PEMBUKA_AKRAB', phraseText: 'Kalau lo perhatiin baik-baik,...', action: 'NEW' },
    { targetCategoryCode: 'G2_PEMBUKA_AKRAB', phraseText: 'Pernah nggak lo kepikiran...', action: 'NEW' },
    { targetCategoryCode: 'G2_PEMBUKA_AKRAB', phraseText: 'Banyak yang ngira kalau...', action: 'NEW' },
    { targetCategoryCode: 'G3_AJAKAN_MASUK', phraseText: 'Coba lo bayangin,...', action: 'NEW' },
    { targetCategoryCode: 'G4_REFLEKSI_RINGAN', phraseText: 'Yang sering bikin kita nggak sadar,...', action: 'NEW' },
    { targetCategoryCode: 'G5_NARATOR_DEKAT', phraseText: 'Gue sendiri awalnya sempat ngira kalau...', action: 'NEW' },
    { targetCategoryCode: 'G6_TRANSISI_NATURAL', phraseText: 'Tapi tunggu dulu, persoalannya belum selesai di situ,...', action: 'NEW' },
    { targetCategoryCode: 'G7_PENEKANAN_SANTAI', phraseText: 'Dan ini bukan angka yang main-main,...', action: 'NEW' },
    { targetCategoryCode: 'G8_MEMATAHKAN_ARGUMEN', phraseText: 'Secara teori emang masuk akal, tapi...', action: 'NEW' },
    { targetCategoryCode: 'G9_ESKALASI_TENSI', phraseText: 'Makin kita telusuri, makin kelihatan kalau...', action: 'NEW' },
    { targetCategoryCode: 'G10_INTERAKSI_PENONTON', phraseText: 'Masuk akal, kan?', action: 'NEW' },
    { targetCategoryCode: 'G11_PENUTUP_NGOBROL', phraseText: 'Nah dari sini kita bisa mulai ngelihat...', action: 'NEW' },
  ];
  await repo.importUniversalCsvPhrases({
    fileName: 'test_seed.csv',
    rows: sampleData,
    affectedCategories: Object.keys(G1G11_CATEGORY_METADATA),
    untouchedCategories: [],
  });
}

test('1. CONTENT-ONLY UPDATE: Mengedit G2 tidak mengubah fungsi semantik, kategori, atau ID permanen G2', async () => {
  await seedSamplePhrasesIfNeeded();
  const repo = G1G11PhraseRepository.getInstance();
  const targetId = repo.getPhrasesByCategory('G2_PEMBUKA_AKRAB')[0].id;
  const original = repo.getPhraseById(targetId);
  assert.ok(original, 'Entri target harus ada di repository');

  const origCat = original.categoryCode;
  const origNum = original.categoryNum;
  const origFunc = original.semanticFunction;

  // Lakukan edit teks (content-only)
  const newText = 'Kalau lo perhatiin secara jeli di lingkungan sekitar,...';
  const updateResult = await repo.updatePhraseText(targetId, newText, 'Penyesuaian redaksi lisan');
  assert.equal(updateResult.success, true);

  const updated = repo.getPhraseById(targetId);
  assert.ok(updated);
  assert.equal(updated.id, targetId, 'ID permanen harus tetap identik');
  assert.equal(updated.categoryCode, origCat, 'Kategori tidak boleh berubah');
  assert.equal(updated.categoryNum, origNum, 'Nomor G tidak boleh berubah');
  assert.equal(updated.semanticFunction, origFunc, 'Fungsi semantik asli harus tetap identik');
  assert.equal(updated.currentText, newText, 'Teks aktif harus terbarui');
  assert.ok(updated.version >= 2, 'Versi harus bertambah');
});

test('2. ISOLASI ENTRI: Mengedit satu frasa tidak mengubah frasa lainnya di bank', async () => {
  await seedSamplePhrasesIfNeeded();
  const repo = G1G11PhraseRepository.getInstance();
  const g2s = repo.getPhrasesByCategory('G2_PEMBUKA_AKRAB');
  const targetId = g2s[0].id;
  const otherId = g2s[1].id;
  const g8Id = repo.getPhrasesByCategory('G8_MEMATAHKAN_ARGUMEN')[0].id;

  const otherBefore = repo.getPhraseById(otherId)!.currentText;
  const g8Before = repo.getPhraseById(g8Id)!.currentText;

  await repo.updatePhraseText(targetId, 'Pernah nggak sih lo kepikiran hal aneh kayak gini...');

  const otherAfter = repo.getPhraseById(otherId)!.currentText;
  const g8After = repo.getPhraseById(g8Id)!.currentText;

  assert.equal(otherAfter, otherBefore, 'Frasa lain dalam kategori yang sama tidak boleh berubah');
  assert.equal(g8After, g8Before, 'Frasa di kategori lain tidak boleh berubah');
});

test('3. INTEGRITAS G1 & IDENTITAS G2–G11: Aturan pengendali G1 dan metadata 10 kategori tetap identik', async () => {
  const repo = G1G11PhraseRepository.getInstance();

  // Memastikan tepat 10 kategori G2-G11 tetap tersedia pada metadata
  const categoryKeys = Object.keys(G1G11_CATEGORY_METADATA);
  assert.equal(categoryKeys.length, 10);
  assert.ok(categoryKeys.includes('G2_PEMBUKA_AKRAB'));
  assert.ok(categoryKeys.includes('G11_PENUTUP_NGOBROL'));

  // Memastikan metadata struktural untuk setiap kategori terdaftar lengkap
  for (const cat of categoryKeys) {
    const meta = G1G11_CATEGORY_METADATA[cat];
    assert.ok(meta, `Metadata kategori ${cat} harus terdaftar`);
    assert.ok(meta.label.startsWith('G'));
    assert.ok(meta.semanticFunction.length > 5);
  }
});

test('4. SINGLE RECORD UPDATE: Pembaruan memperbarui satu record tanpa membuat duplikasi entri', async () => {
  await seedSamplePhrasesIfNeeded();
  const repo = G1G11PhraseRepository.getInstance();
  const targetId = repo.getPhrasesByCategory('G4_REFLEKSI_RINGAN')[0].id;
  const totalBefore = repo.getAllPhrases().length;

  await repo.updatePhraseText(targetId, 'Yang seringkali bikin kita semua luput,...');

  const totalAfter = repo.getAllPhrases().length;
  assert.equal(totalAfter, totalBefore, 'Jumlah total entri di bank frasa tidak boleh bertambah (tidak ada duplikasi)');
});

test('5. CACHE INVALIDATION: Generasi berikutnya langsung membaca teks terbaru pasca update', async () => {
  await seedSamplePhrasesIfNeeded();
  const repo = G1G11PhraseRepository.getInstance();
  const targetId = repo.getPhrasesByCategory('G6_TRANSISI_NATURAL')[0].id;
  const updatedText = 'Nah masalah mendasarnya justru ada di sini...';

  await repo.updatePhraseText(targetId, updatedText);

  // Akses langsung melalui getActiveG1G11PhraseBank (yang dipakai generator dan audit)
  const activeBank = getActiveG1G11PhraseBank();
  const g6List = activeBank['G6_TRANSISI_NATURAL'] || [];

  assert.ok(
    g6List.includes(updatedText),
    'Active bank cache harus langsung memuat teks frasa yang baru diperbarui'
  );
});

test('6. RIWAYAT VERSI (HISTORY) & ROLLBACK: Versi terdahulu tersimpan dan dapat dipulihkan', async () => {
  await seedSamplePhrasesIfNeeded();
  const repo = G1G11PhraseRepository.getInstance();
  const targetId = repo.getPhrasesByCategory('G3_AJAKAN_MASUK')[0].id;
  const original = repo.getPhraseById(targetId)!;
  const originalText = original.originalText;

  // Edit ke versi 2
  await repo.updatePhraseText(targetId, 'Coba deh lo bayangin kalau kondisi ini berbalik,...');
  const v2Record = repo.getPhraseById(targetId)!;
  assert.ok(v2Record.history.length >= 1, 'Riwayat versi harus mencatat perubahan');

  // Rollback ke versi 1 (original)
  const rollbackResult = await repo.rollbackPhraseVersion(targetId, 1, 'Rollback uji coba');
  assert.equal(rollbackResult.success, true);

  const restoredRecord = repo.getPhraseById(targetId)!;
  assert.equal(
    restoredRecord.currentText,
    originalText,
    'Teks aktif setelah rollback harus kembali ke teks versi 1'
  );
});

test('7. INVARIANSI NASKAH LAMA: Naskah yang sudah pernah dibuat tidak berubah otomatis', async () => {
  const repo = G1G11PhraseRepository.getInstance();
  const preExistingScript =
    'Coba deh lo pikirin, doktrin lama ini terus diulang.\n' +
    'Padahal akar persoalannya ada pada ketimpangan upah.\n' +
    'Begitu kita bedah faktanya, data membuktikan biaya hidup melonjak.\n' +
    'Solusinya harus membongkar struktur insentif secara transparan.\n' +
    'Ujung-ujungnya kita sendiri yang mesti berani bersikap kritis.';

  const scriptBefore = preExistingScript;

  // Lakukan pengeditan pada beberapa frasa di bank
  await repo.updatePhraseText('G2_PEMBUKA_AKRAB_6', 'Coba perhatiin polanya secara jeli,...');
  await repo.updatePhraseText('G8_MEMATAHKAN_ARGUMEN_3', 'Secara akal sehat masuk akal, tapi faktanya,...');

  const scriptAfter = preExistingScript;
  assert.equal(
    scriptAfter,
    scriptBefore,
    'Naskah yang sudah pernah dibuat harus 100% identik dan tidak terpengaruh oleh pembaruan bank frasa'
  );
});

test('8. KETENTUAN 14: Validasi Keselarasan Fungsi Semantik menampilkan peringatan dan meminta konfirmasi', async () => {
  // G8 tanpa penanda sanggahan/kontras -> harus memicu peringatan
  const invalidG8 = validatePhraseSemanticAlignment('G8_MEMATAHKAN_ARGUMEN', 'Semua orang sangat setuju dan bergembira');
  assert.equal(invalidG8.isAligned, false);
  assert.equal(invalidG8.requiresConfirmation, true);
  assert.ok(invalidG8.warning?.includes('MEMATAHKAN ARGUMEN'));

  // G8 dengan penanda sanggahan yang tepat -> lolos
  const validG8 = validatePhraseSemanticAlignment('G8_MEMATAHKAN_ARGUMEN', 'Tapi kenyataannya di lapangan justru bertolak belakang,...');
  assert.equal(validG8.isAligned, true);
  assert.equal(validG8.requiresConfirmation, false);

  // Teks mengandung frasa formal/kaku -> memicu peringatan aturan G1
  const formalText = validatePhraseSemanticAlignment('G4_REFLEKSI_RINGAN', 'Oleh karena itu kita dapat melihat dampaknya');
  assert.equal(formalText.isAligned, false);
  assert.equal(formalText.requiresConfirmation, true);
  assert.ok(formalText.warning?.includes('formal/kaku'));
});

test('9. NON-FORCING & CONTEXTUAL SELECTION: Pengeditan frasa tidak menimbulkan kuota atau pemaksaan', async () => {
  const cleanScript = [
    'Banyak orang membicarakan pola asuh keluarga tanpa melihat realitas ekonomi.',
    'Ketika beban pengeluaran membengkak, tabungan keluarga tergerus habis.',
    'Data biaya hidup membuktikan lonjakan pengeluaran tanpa kenaikan gaji yang sepadan.',
    'Perbaikan tata kelola upah harus menjadi prioritas utama para pembuat kebijakan.',
    'Pilihan rasional menuntut kita melihat fakta secara jernih.',
  ].join('\n');

  // Enforcer Non-Forcing harus mempertahankan naskah 100% tanpa menyisipkan frasa buatan
  const enforced = enforceG1G11PhraseTarget(cleanScript);
  assert.equal(enforced, cleanScript, 'Enforcer tidak boleh menyisipkan frasa otomatis ke naskah yang sudah mengalir');

  // Audit Non-Forcing: 0 frasa tetap sah
  const audit = auditG1G11PhraseDistribution(cleanScript);
  assert.equal(audit.targetPhrasesTotal, 0);
  assert.ok(audit.blockAudits.every((b) => b.targetMet === true));
  assert.equal(audit.passed, true);
});

test('10. INTEGRITAS ALUR TAHAP 2, TAHAP 3, & NASKAH FINAL: Tetap menggunakan aturan arsitektur yang sama', async () => {
  const draft = [
    'Kalau lo perhatiin baik-baik, paradoks ini terus dibiarkan berlangsung.',
    'Penyebabnya bukan cuma kebetulan, melainkan pembiaran cara berpikir yang keliru.',
    'Begitu kita bedah datanya, ketimpangan upah riil terlihat sangat mencolok.',
    'Solusinya menuntut pembenahan nyata tanpa janji manis di atas kertas.',
    'Ujung-ujungnya lo sendiri yang bisa menilai mana argumen yang beneran masuk akal.',
  ].join('\n');

  // Stage 6 Contextual Selection berjalan dinamis
  const selection = executeStage6AutomaticPhraseSelection(draft, MOCK_PLAN, {} as any);
  assert.ok(selection.blockSelections.length === 5);

  // Naskah final tetap mempertahankan prinsip pelestarian naskah
  const optimized = applyG1G11PhraseOptimizationToScript(draft, selection);
  assert.ok(optimized.split('\n').length === 5);
  assert.ok(!optimized.includes('Goblok banget.'));
});

test('11. RESET TOTAL BANK FRASA: Mengosongkan seluruh entri frasa naratif G2–G11', async () => {
  const repo = G1G11PhraseRepository.getInstance();
  const clearRes = await repo.clearAllPhrases();
  assert.equal(clearRes.success, true);
  assert.equal(repo.getAllPhrases().length, 0);

  // Seluruh 10 kategori tetap tersedia
  const activeBank = getActiveG1G11PhraseBank();
  assert.equal(Object.keys(activeBank).length, 10);
  for (const catKey of Object.keys(activeBank)) {
    assert.deepEqual(activeBank[catKey], []);
  }
});
