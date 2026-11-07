import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyDocumentSemantics,
  FORBIDDEN_LEAKED_PHRASES,
} from './documentSemanticClassifier';
import {
  buildSourceGroundedNarrativePlan,
} from './sourceGroundedNarrativePlanner';
import {
  validateSourceFidelity,
} from './sourceFidelityValidator';
import {
  validateFullScript,
} from './validatorAndPipeline';
import { createValidTestSCTFScript } from './testFixtures';

// Representative model document matching the user's uploaded structure:
// "04. Pembodohan Religius Logika Hancur di Balik Harta Gak Dibawa Mati.docx"
const SAMPLE_REPRESENTATIVE_DOCX_TEXT = `
MASTER FRAMEWORK
PERENCANAAN NASKAH YOUTUBE PRESISI
KONFIGURASI SISTEM: GenNAS Pro V5.1
TARGET AUDIT: Perilaku & Pola Pikir Masyarakat (Non-SARA)

JUDUL DOKUMEN: 04. Pembodohan Religius Logika Hancur di Balik Harta Gak Dibawa Mati
TESIS: Slogan 'harta gak dibawa mati' sering disalahgunakan sebagai tameng pembenaran kemalasan finansial, penolakan investasi masa depan keluarga, dan manipulasi donasi tanpa transparansi.

CATATAN EDITORIAL:
- Jangan sebut nama ustadz atau ormas tertentu.
- Fokus pada manipulasi psikologis dan kelumpuhan nalar ekonomi audiens.
- Gunakan gaya gue-lo lugas dan sarkastis.

STRUKTUR ARGUMEN DAN POIN KRITIS:
1. Fenomena Pembenaran Kemalasan: Orang enggan bekerja keras atau menabung darurat berdalih bahwa dunia cuma sementara.
2. Dampak Finansial Riil: Saat anggota keluarga sakit atau butuh biaya sekolah, mereka kebingungan dan membebani orang lain karena tidak punya mitigasi finansial.
3. Manipulasi Donasi & Eksploitasi Emosi: Oknum predator finansial memanfaatkan doktrin lepas duniawi agar jamaah menyetor tabungan terakhir mereka ke rekening pribadi berkedok sedekah instan.
4. Perbandingan Rasional: Generasi tangguh meninggalkan keturunan yang mandiri, bukan meninggalkan hutang dan kemiskinan dengan alibi kesalehan semu.

DATA DAN FAKTA PENDUKUNG:
- Survei OJK: Literasi keuangan masyarakat bawah masih di bawah 40%.
- Banyak kasus dana umrah atau investasi bodong berkedok donasi keagamaan nilainya menembus ratusan miliar rupiah.
- Realitas biaya rawat inap dan inflasi pendidikan 10-15% per tahun yang tidak bisa dibayar dengan dalih kepasrahan fatalistik.
`;

test('classifyDocumentSemantics correctly categorizes sections without leaking instructions', () => {
  const classification = classifyDocumentSemantics(
    SAMPLE_REPRESENTATIVE_DOCX_TEXT,
    '04. Pembodohan Religius Logika Hancur di Balik Harta Gak Dibawa Mati.docx'
  );

  // Instructions should contain the framework headers
  assert.ok(classification.instructions.length > 0, 'Should find document instructions');
  assert.ok(
    classification.instructions.some((i) => i.includes('MASTER FRAMEWORK')),
    'Should identify MASTER FRAMEWORK as instruction'
  );
  assert.ok(
    classification.instructions.some((i) => i.includes('PERENCANAAN NASKAH YOUTUBE PRESISI')),
    'Should identify PERENCANAAN NASKAH YOUTUBE PRESISI as instruction'
  );

  // Main topic should capture the actual subject
  assert.ok(
    classification.mainTopic.toLowerCase().includes('harta gak dibawa mati') ||
    classification.mainTopic.toLowerCase().includes('pembodohan'),
    `Main topic should capture subject, got: ${classification.mainTopic}`
  );

  // Central thesis should be extracted
  assert.ok(classification.centralThesis.length > 0, 'Central thesis should not be empty');

  // Key arguments should be detected
  assert.ok(classification.keyArguments.length >= 2, 'Should detect multiple key arguments');

  // Supporting evidence should be detected
  assert.ok(classification.supportingEvidence.length >= 1, 'Should detect supporting evidence');

  // Non-instruction sections should NOT contain forbidden framework phrases
  const substantiveText = classification.sections
    .filter((s) => !s.isInstruction)
    .map((s) => s.rawText)
    .join('\n');
  for (const forbidden of FORBIDDEN_LEAKED_PHRASES) {
    assert.equal(
      substantiveText.includes(forbidden.phrase),
      false,
      `Substantive text must not contain leaked instruction: ${forbidden.phrase}`
    );
  }
});

test('buildSourceGroundedNarrativePlan maps 5-stage StoryFlow with specific factual boundaries', () => {
  const classification = classifyDocumentSemantics(
    SAMPLE_REPRESENTATIVE_DOCX_TEXT,
    '04. Pembodohan Religius Logika Hancur di Balik Harta Gak Dibawa Mati.docx'
  );

  const plan = buildSourceGroundedNarrativePlan(
    classification,
    { durasiMenit: 12, wpm: 135 }
  );

  assert.equal(plan.storyflow_plan.length, 5, 'Should have exactly 5 StoryFlow stages');
  assert.equal(plan.locked_perspective_boundary, 'Perilaku & Pola Pikir Masyarakat (Non-SARA)');
  assert.ok(plan.unresolved_claims.length > 0);
  assert.ok(plan.source_references.length > 0);
});

test('validateSourceFidelity detects leaked instruction phrases and rejects script', () => {
  const classification = classifyDocumentSemantics(
    SAMPLE_REPRESENTATIVE_DOCX_TEXT,
    '04. Pembodohan Religius Logika Hancur di Balik Harta Gak Dibawa Mati.docx'
  );

  const plan = buildSourceGroundedNarrativePlan(classification, { durasiMenit: 12, wpm: 135 });

  // Bad script with leaked instructions
  const badScript = `
    [S - STOPPER]
    MASTER FRAMEWORK kali ini kita bahas PERENCANAAN NASKAH YOUTUBE PRESISI.
    Gue mau bongkar soal Perilaku & Pola Pikir Masyarakat (Non-SARA) yang kacau banget.
    Goblok banget orang yang mikir kayak gini.
  `;

  const report = validateSourceFidelity(badScript, plan, classification);
  assert.equal(report.passed, false, 'Leaked script must fail source fidelity');
  assert.equal(report.instructionLeakage.passed, false, 'Instruction leakage check must fail');
  assert.ok(
    report.instructionLeakage.leakedPhrases.length >= 2,
    `Should detect multiple leaked phrases, found: ${report.instructionLeakage.leakedPhrases}`
  );
});

test('validateSourceFidelity passes grounded script with zero leaked instructions', () => {
  const classification = classifyDocumentSemantics(
    SAMPLE_REPRESENTATIVE_DOCX_TEXT,
    '04. Pembodohan Religius Logika Hancur di Balik Harta Gak Dibawa Mati.docx'
  );

  const plan = buildSourceGroundedNarrativePlan(classification, { durasiMenit: 12, wpm: 135 });

  // Good script specifically arguing the substance with 5 paragraphs
  const goodScript = `Pernah gak lo denger orang ngomong sok bijak: 'Ngapain capek kerja, harta gak dibawa mati'? Gobloknya, kalimat ini dipakai buat tameng kemalasan finansial dan penolakan investasi masa depan keluarga. Pas anak sakit atau butuh uang kuliah, mendadak bingung dan nyusahin orang lain.

Mari kita bedah fenomena fatalistik ini secara rasional. Survei OJK mencatat literasi keuangan masih minim di bawah 40 persen. Banyak yang terbuai doktrin lepas duniawi, tapi saat realitas biaya rumah sakit dan inflasi pendidikan datang, dalih kepasrahan itu runtuh seketika. Manipulasi donasi juga marak karena emosi jamaah dieksploitasi oleh oknum predator finansial berkedok kesalehan semu.

Logika hancur ini bikin generasi kita rapuh dan mewariskan kemiskinan serta hutang. Slogan harta gak dibawa mati cuma ilusi murahan pembodohan. Kenapa bisa begitu dungu membenarkan kemalasan berdalih kesalehan semu padahal dunia butuh tanggung jawab nyata?

Tarik napas dulu. Pikirin ini baik-baik: apakah membiarkan anak lo menderita kelaparan itu bentuk ketakwaan sejati? Jelas bukan, itu cuma pelarian pecundang yang malas mikir keras.

Mulai hari ini, bangun literasi finansial lo, siapkan dana darurat, dan jangan mau lagi dibodohi slogan pasrah yang merusak masa depan lo dan keluarga lo!`;

  const report = validateSourceFidelity(goodScript, plan, classification);
  assert.equal(report.instructionLeakage.passed, true, 'Instruction leakage should pass');
  assert.ok(report.topicRelevance.passed, 'Topic relevance should pass');
});

test('Grounded zero-leakage script passes fidelity and leakage audit', () => {
  const script = createValidTestSCTFScript('Harta Gak Dibawa Mati dan Finansial');

  // Must not have forbidden instructions
  for (const item of FORBIDDEN_LEAKED_PHRASES) {
    assert.equal(
      script.includes(item.phrase),
      false,
      `Generated script must not contain leaked instruction: ${item.phrase}`
    );
  }

  // Must discuss the actual slogan and arguments
  assert.ok(
    script.toLowerCase().includes('harta') ||
    script.toLowerCase().includes('mati') ||
    script.toLowerCase().includes('finansial') ||
    script.toLowerCase().includes('donasi'),
    'Script must mention the core substance'
  );

  // Audit via validateFullScript
  const audit = validateFullScript(script, {
    durasiMenit: 12,
    wpm: 135,
    faktaTerverifikasi: SAMPLE_REPRESENTATIVE_DOCX_TEXT,
  });
  assert.equal(audit.sourceFidelity?.instructionLeakage.passed, true, 'Instruction leakage must pass');
  assert.equal(audit.sourceFidelity?.passed, true, 'Source fidelity must pass');
  assert.equal(audit.passed, true, 'Full audit must pass');
});
