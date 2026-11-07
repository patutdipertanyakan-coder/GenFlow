import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { masterLexiconRepository } from './masterLexiconRepository';
import { G1G11PhraseRepository } from './g1g11PhraseRepository';
import {
  auditG1G11PhraseDistribution,
  enforceG1G11PhraseTarget,
} from './validatorAndPipeline';
import {
  applyG1G11PhraseOptimizationToScript,
  executeStage6AutomaticPhraseSelection,
} from './workflowEngine';
import { GenNASConfig, SourceGroundedPlan } from './types';

before(async () => {
  await masterLexiconRepository.waitUntilReady();
  await G1G11PhraseRepository.getInstance().waitUntilReady();
  await seedSamplePhrasesForNarrationTest();
});

async function seedSamplePhrasesForNarrationTest() {
  const repo = G1G11PhraseRepository.getInstance();
  const sampleData = [
    { targetCategoryCode: 'G2_PEMBUKA_AKRAB', phraseText: 'Kalau lo perhatiin baik-baik,...', action: 'NEW' },
    { targetCategoryCode: 'G3_AJAKAN_MASUK', phraseText: 'Coba lo bayangin,...', action: 'NEW' },
    { targetCategoryCode: 'G4_REFLEKSI_RINGAN', phraseText: 'Kalau dipikir-pikir,...', action: 'NEW' },
    { targetCategoryCode: 'G4_REFLEKSI_RINGAN', phraseText: 'Kalau dipikir lebih jauh,...', action: 'NEW' },
    { targetCategoryCode: 'G4_REFLEKSI_RINGAN', phraseText: 'Nah masalahnya,...', action: 'NEW' },
    { targetCategoryCode: 'G5_NARATOR_DEKAT', phraseText: 'Gue sendiri awalnya sempat ngira kalau...', action: 'NEW' },
    { targetCategoryCode: 'G6_TRANSISI_NATURAL', phraseText: 'Di sisi lain,...', action: 'NEW' },
    { targetCategoryCode: 'G6_TRANSISI_NATURAL', phraseText: 'Nah sekarang coba kita lihat...', action: 'NEW' },
    { targetCategoryCode: 'G7_PENEKANAN_SANTAI', phraseText: 'kelihatan banget,...', action: 'NEW' },
    { targetCategoryCode: 'G7_PENEKANAN_SANTAI', phraseText: 'Dan ini bukan hal sepele...', action: 'NEW' },
    { targetCategoryCode: 'G8_MEMATAHKAN_ARGUMEN', phraseText: 'Tapi kenyataannya nggak selalu kayak gitu...', action: 'NEW' },
    { targetCategoryCode: 'G8_MEMATAHKAN_ARGUMEN', phraseText: 'Secara teori emang masuk akal, tapi...', action: 'NEW' },
    { targetCategoryCode: 'G9_ESKALASI_TENSI', phraseText: 'Dan di titik inilah keadaan mulai berubah,...', action: 'NEW' },
    { targetCategoryCode: 'G9_ESKALASI_TENSI', phraseText: 'Makin kita telusuri, makin kelihatan kalau...', action: 'NEW' },
    { targetCategoryCode: 'G10_INTERAKSI_PENONTON', phraseText: 'Masuk akal, kan?', action: 'NEW' },
    { targetCategoryCode: 'G11_PENUTUP_NGOBROL', phraseText: 'Ujung-ujungnya,...', action: 'NEW' },
    { targetCategoryCode: 'G11_PENUTUP_NGOBROL', phraseText: 'Jadi, menurut lo sendiri gimana...', action: 'NEW' },
  ];
  await repo.importUniversalCsvPhrases({
    fileName: 'narration_test_seed.csv',
    rows: sampleData,
    affectedCategories: [
      'G2_PEMBUKA_AKRAB',
      'G3_AJAKAN_MASUK',
      'G4_REFLEKSI_RINGAN',
      'G5_NARATOR_DEKAT',
      'G6_TRANSISI_NATURAL',
      'G7_PENEKANAN_SANTAI',
      'G8_MEMATAHKAN_ARGUMEN',
      'G9_ESKALASI_TENSI',
      'G10_INTERAKSI_PENONTON',
      'G11_PENUTUP_NGOBROL',
    ],
    untouchedCategories: [],
  });
}

seedSamplePhrasesForNarrationTest();

after(async () => {
  await G1G11PhraseRepository.getInstance().clearAllPhrases();
});

const DUMMY_CONFIG: GenNASConfig = {
  topik: 'Pola Pikir Banyak Anak Banyak Rezeki',
  konteks: 'Perilaku & Pola Pikir Masyarakat (Non-SARA)',
  faktaTerverifikasi: 'Data menunjukkan biaya hidup naik Rp1.500.000 per bulan sejak 1990-an.',
  durasiMenit: 12,
  wpm: 135,
  modeDurasi: 'FLEKSIBEL',
  jumlahBlok: 5,
  struktur: [8, 17, 45, 20, 10],
  operasi: 'NASKAH_FINAL',
  allowEditorialRewrite: false,
  judulOutput: false,
  primaryModel: 'gemini-3-flash-preview',
  fallbackModel: 'gemini-3.8-flash',
};

const DUMMY_PLAN: SourceGroundedPlan = {
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

test('PENGUJIAN 1: Naskah yang membutuhkan beberapa transisi kontekstual berhasil diaudit secara wajar', async () => {
  const script = [
    'Kalau lo perhatiin baik-baik, banyak orang cuma ngelihat kulit luar dari persoalan ini.',
    'Nah masalahnya, waktu kita tarik ke belakang, akar persoalan ini tumbuh dari kebiasaan lama.',
    'Di sisi lain, waktu kita bedah datanya satu per satu, kelihatan banget ada ketimpangan.',
    'Kalau dipikir-pikir, langkah perbaikan harus dimulai dari keterbukaan mengoreksi kesalahan.',
    'Ujung-ujungnya, pilihan ada di tangan kita sendiri buat berhenti memelihara pola pikir keliru.'
  ].join('\n');

  const audit = auditG1G11PhraseDistribution(script);
  assert.equal(audit.passed, true);
  assert.equal(audit.blocksPassedCount, 5);
  assert.ok(audit.totalPhrasesFound >= 4);
});

test('PENGUJIAN 2: Naskah yang sudah mengalir tanpa tambahan frasa dipertahankan 100% tanpa perubahan paksa', async () => {
  const naturalFlowingScript = [
    'Biaya hidup terus melambung tinggi dan membebani masyarakat luas setiap harinya.',
    'Kondisi tersebut diperparah oleh kebiasaan mengabaikan perencanaan finansial yang matang.',
    'Data lapangan membuktikan lonjakan pengeluaran tidak sebanding dengan kenaikan upah riil.',
    'Perbaikan menyeluruh membutuhkan disiplin anggaran dan penghentian utang konsumtif.',
    'Keputusan akhir berada pada kesadaran setiap individu untuk hidup secara rasional.'
  ].join('\n');

  // Enforcer harus mematuhi prinsip Non-Forcing: 100% identik
  const enforced = enforceG1G11PhraseTarget(naturalFlowingScript, DUMMY_CONFIG);
  assert.equal(enforced, naturalFlowingScript, 'Naskah yang sudah alami tidak boleh diubah');

  // Audit harus menyatakan LULUS tanpa memaksakan kuota
  const audit = auditG1G11PhraseDistribution(naturalFlowingScript);
  assert.equal(audit.passed, true, 'Naskah tanpa frasa tambahan wajib tetap LULUS');
  assert.equal(audit.blockAudits.every((b) => b.passed), true);
});

test('PENGUJIAN 3: Blok yang tidak menggunakan frasa tambahan sama sekali tetap dinyatakan LULUS (0 frasa adalah sah)', async () => {
  const scriptWithEmptyPhrasesBlock = [
    'Kalau lo perhatiin baik-baik, persoalan ini sering dianggap sepele oleh banyak pihak.',
    'Akar persoalan ini sebenarnya berawal dari ketidakmampuan mengelola ekspektasi keluarga.', // 0 frasa dari G2-G11
    'Tapi kenyataannya nggak selalu kayak gitu waktu kita uji datanya secara empiris di lapangan.',
    'Solusi nyata menuntut keberanian mengubah pola konsumsi tanpa gengsi yang berlebihan.',
    'Ujung-ujungnya, semua kembali pada keberanian kita bersikap jujur pada realitas hidup.'
  ].join('\n');

  const audit = auditG1G11PhraseDistribution(scriptWithEmptyPhrasesBlock);
  assert.equal(audit.passed, true);
  // Blok 2 (indeks 1) tidak memiliki frasa G2-G11 tambahan, tetap harus targetMet = true dan passed = true
  assert.equal(audit.blockAudits[1].passed, true);
  assert.equal(audit.blockAudits[1].targetMet, true);
});

test('PENGUJIAN 4: Penggunaan beberapa kategori G berbeda dalam satu blok diperbolehkan dan sah', async () => {
  // Blok 3 menggunakan G6 (transisi), G8 (mematahkan argumen), dan G7 (penekanan) secara kontekstual
  const script = [
    'Kalau lo perhatiin baik-baik kebiasaan di sekitar kita, ada kejanggalan nyata.',
    'Kalau dipikir lebih jauh, akar kebiasaan ini sudah mengakar puluhan tahun lamanya.',
    'Nah sekarang coba kita lihat datanya secara terbuka di hadapan publik. Secara teori emang masuk akal, tapi kenyataannya nggak selalu kayak gitu waktu kita uji fakta di lapangan. Dan ini bukan hal sepele yang bisa kita lewatkan begitu saja tanpa evaluasi kritis.',
    'Kalau kita mau berbenah, langkah nyata harus diambil segera.',
    'Jadi, menurut lo sendiri gimana cara terbaik menyelesaikan masalah ini?'
  ].join('\n');

  const audit = auditG1G11PhraseDistribution(script);
  assert.equal(audit.passed, true);
  const block3 = audit.blockAudits[2];
  // Blok 3 memiliki beberapa kategori G
  assert.ok(block3.foundCategoryCodes.length >= 2);
  assert.equal(block3.passed, true);
});

test('PENGUJIAN 5: Penggunaan kategori G yang sama pada blok berbeda diperbolehkan (ketersediaan global)', async () => {
  // G8 digunakan di Blok 2 DAN di Blok 4 saat sama-sama membantah argumen keliru
  const script = [
    'Coba lo bayangin situasi di mana klaim manis selalu menutupi fakta yang sebenarnya.',
    'Secara teori emang masuk akal, tapi akar persoalan ini tetap tidak terselesaikan.', // G8 di Blok 2
    'Data lapangan menunjukkan bukti konkret tentang kerugian yang dialami masyarakat.',
    'Tapi kenyataannya nggak selalu kayak gitu saat solusi tambal sulam diterapkan di lapangan.', // G8 di Blok 4
    'Ujung-ujungnya, seluruh keputusan harus berpijak pada fakta yang teruji.'
  ].join('\n');

  const audit = auditG1G11PhraseDistribution(script);
  assert.equal(audit.passed, true);
  assert.ok(audit.blockAudits[1].foundCategoryCodes.includes('G8'));
  assert.ok(audit.blockAudits[3].foundCategoryCodes.includes('G8'));
});

test('PENGUJIAN 6: Penggunaan G8 ketika benar-benar terdapat argumen atau klaim yang perlu diuji', async () => {
  const script = [
    'Kalau lo perhatiin baik-baik, banyak pihak membuat klaim tanpa pembuktian.',
    'Banyak orang percaya bahwa masalah akan selesai dengan sendirinya tanpa usaha.',
    'Secara teori emang masuk akal, tapi argumen itu belum ngejawab satu hal penting soal ketimpangan data.', // G8 sah untuk uji klaim
    'Koreksi nyata harus dilakukan dengan membedah kelemahan argumen tersebut.',
    'Sekarang tinggal gimana kita melihat persoalan ini secara objektif.'
  ].join('\n');

  const audit = auditG1G11PhraseDistribution(script);
  assert.equal(audit.passed, true);
  assert.ok(audit.blockAudits[2].foundCategoryCodes.includes('G8'));
});

test('PENGUJIAN 7: Penggunaan G9 ketika eskalasi tensi narasi memang diperlukan', async () => {
  const script = [
    'Pernah nggak lo kepikiran kenapa masalah ini tidak pernah kunjung selesai?',
    'Awalnya mungkin kelihatan sepele, tapi akar persoalannya merambat ke ranah struktural.',
    'Makin kita telusuri, makin kelihatan kalau dampaknya makin parah dan puncaknya memukul warga kecil.', // G9 eskalasi tensi
    'Langkah penyelesaian harus mampu memutus rantai eskalasi tersebut.',
    'Ujung-ujungnya, kita butuh komitmen tegas untuk menyelesaikan persoalan ini.'
  ].join('\n');

  const audit = auditG1G11PhraseDistribution(script);
  assert.equal(audit.passed, true);
  assert.ok(audit.blockAudits[2].foundCategoryCodes.includes('G9'));
});

test('PENGUJIAN 8: Adaptasi frasa formal menjadi bahasa percakapan santai Gue-Lo (Prinsip B & G)', async () => {
  const scriptWithFormalStiffPhrases = [
    'Kalau lo perhatiin, masalah ini sudah lama terjadi.',
    'Latar belakang masalah ini cukup kompleks.',
    'Hal yang perlu diperhatikan adalah dampak ekonominya ke masyarakat.', // frasa formal
    'Solusi harus dirancang dengan cermat.',
    'Pada akhirnya, semua berpulang pada kesadaran kolektif kita.' // frasa formal
  ].join('\n');

  // Audit mendeteksi catatan adaptasi
  const audit = auditG1G11PhraseDistribution(scriptWithFormalStiffPhrases);
  const block3 = audit.blockAudits[2];
  const block5 = audit.blockAudits[4];
  assert.ok(block3.reasons.some((r) => r.includes('hal yang perlu diperhatikan')));
  assert.ok(block5.reasons.some((r) => r.includes('pada akhirnya')));

  // Optimizer menerapkan adaptasi lisan percakapan
  const adapted = applyG1G11PhraseOptimizationToScript(scriptWithFormalStiffPhrases);
  assert.ok(adapted.includes('Yang perlu lo lihat') || adapted.includes('yang perlu lo lihat'));
  assert.ok(adapted.includes('Ujung-ujungnya') || adapted.includes('ujung-ujungnya'));

  // Setelah diadaptasi, audit menjadi bersih
  const reAudit = auditG1G11PhraseDistribution(adapted);
  assert.equal(reAudit.blockAudits[2].reasons.length, 0);
  assert.equal(reAudit.blockAudits[4].reasons.length, 0);
});

test('PENGUJIAN 9: Pencegahan pengulangan frasa pembuka pada paragraf berurutan (Prinsip B & H)', async () => {
  const scriptWithRepeatedOpeners = [
    'Coba lo bayangin situasi ketika hidup serba kekurangan tanpa kepastian masa depan.', // Blok 1 diawali "Coba lo bayangin"
    'Coba lo bayangin gimana rasanya ketika semua tagihan menumpuk di akhir bulan.', // Blok 2 diawali "Coba lo bayangin" lagi (pengulangan berurutan!)
    'Di sisi lain, data empiris menunjukkan jurang ketimpangan yang semakin menganga.',
    'Solusi yang masuk akal adalah memprioritaskan kebutuhan pokok terlebih dahulu.',
    'Ujung-ujungnya, kendali masa depan berada di tangan kita masing-masing.'
  ].join('\n');

  const audit = auditG1G11PhraseDistribution(scriptWithRepeatedOpeners);
  assert.equal(audit.passed, false, 'Pengulangan pembuka pada paragraf berurutan harus terdeteksi');
  assert.ok(audit.reasons.some((r) => r.includes('Pengulangan frasa pembuka pada paragraf berurutan')));
});

test('PENGUJIAN 10: Pemeriksaan bahwa tidak ada target atau kuota tersembunyi dalam audit dan pipeline', async () => {
  const scriptWithZeroG = [
    'Biaya hidup melambung tinggi di perkotaan.',
    'Tekanan ekonomi membuat masyarakat semakin sulit menabung.',
    'Data riil memperlihatkan ketimpangan penghasilan dan pengeluaran warga.',
    'Langkah tepat adalah merancang anggaran keluarga secara disiplin.',
    'Kesadaran finansial merupakan kunci utama kesejahteraan bersama.'
  ].join('\n');

  const audit = auditG1G11PhraseDistribution(scriptWithZeroG);
  // Target total adalah 0 (tidak ada kuota tersembunyi)
  assert.equal(audit.targetPhrasesTotal, 0, 'Target kuota harus 0');
  // Semua blok harus passed: true dan targetMet: true
  for (const blockAudit of audit.blockAudits) {
    assert.equal(blockAudit.passed, true);
    assert.equal(blockAudit.targetMet, true);
    assert.ok(blockAudit.availableCategoryCodes.includes('G2'));
    assert.ok(blockAudit.availableCategoryCodes.includes('G8'));
    assert.ok(blockAudit.availableCategoryCodes.includes('G11'));
  }

  // Tahap 6 selection juga tidak membatasi kuota minimal
  const phraseSelection = executeStage6AutomaticPhraseSelection(scriptWithZeroG, DUMMY_PLAN, DUMMY_CONFIG);
  assert.equal(phraseSelection.blockSelections.length, 5);
  assert.ok(phraseSelection.summary.includes('G1–G11'));
});
