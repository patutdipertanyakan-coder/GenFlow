/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PENGUJIAN KOMPREHENSIF IMPLEMENTASI AKTIF F7 CONTEXTUAL GUARD (268 ENTRI)
 * Memverifikasi seluruh 10 kasus wajib Bagian 9, perbandingan nyata sebelum/sesudah F7,
 * audit integritas 268 entri di Master Lexicon Repository, dan kejujuran evaluasi TTS.
 */

import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { masterLexiconRepository } from './masterLexiconRepository';
import {
  auditF7RepositoryIntegration,
  analyzeNarrativeContext,
  evaluateF7CandidateInContext,
  selectActiveF7PhrasesForBlock,
  runF7PostGenerationAuditAndRevision,
  compareNarrativeWithAndWithoutF7,
  getAll268F7Entries,
} from './f7ContextualGuardEngine';
import { validateFullScript } from './validatorAndPipeline';
import { selectContextualExpansionCandidates } from './contextualCandidateEngine';

before(async () => {
  await masterLexiconRepository.waitUntilReady();
});

test('Bagian 2: Integrasi 268 Entri F7 Contextual Guard ke Master Lexicon Repository Terpadu', () => {
  const audit = auditF7RepositoryIntegration();

  assert.equal(audit.totalInspectedReference, 993, 'Total entri referensi yang diperiksa harus 993');
  assert.equal(audit.totalF7Integrated, 268, 'Total entri F7 yang ditandai dan terintegrasi harus tepat 268');
  assert.equal(audit.totalOutsideSpecialListReference, 725, 'Entri di luar daftar khusus harus 725');
  assert.ok(audit.totalUnifiedRepositoryEntries >= 1400, 'Master Lexicon Repository terisi entri unik dari Supabase');
  assert.ok(audit.matchedExistingCount > 0, 'Entri F7 cocok dengan entri di Master Lexicon Repository');
  assert.equal(audit.newlyAddedCount, 0, 'Entri baru yang ditambahkan di luar 1476 adalah 0');
  assert.equal(audit.fallbackRuleCount, 6, 'Tepat 6 entri menggunakan aturan fallback karena kolom Aturan GenNAS Pro kosong');
  assert.deepEqual(
    audit.fallbackEntries.sort(),
    ['gantungin', 'ngebebanin', 'ngepaksa', 'ngeracunin', 'ngeruk', 'nimbrung'].sort()
  );

  // Verifikasi distribusi kategori utama (104 + 71 + 39 + 29 + 25 = 268)
  assert.equal(audit.categoryDistribution['Konotasi negatif/tuduhan'], 104);
  assert.equal(audit.categoryDistribution['Makna kiasan/polisemi'], 71);
  assert.equal(audit.categoryDistribution['Register/morfologi/slang'], 39);
  assert.equal(audit.categoryDistribution['Frasa/konstruksi kontekstual'], 29);
  assert.equal(audit.categoryDistribution['Teknis/akademis/prosedural'], 25);

  const sumCategories = Object.values(audit.categoryDistribution).reduce((a, b) => a + b, 0);
  assert.equal(sumCategories, 268);

  assert.equal(audit.allFieldsPreserved, true, 'Seluruh 9 kolom F7 wajib terjaga utuh tanpa ada yang hilang');
  assert.equal(audit.saranAndPadananDistinct, true, 'Kolom Saran dan Padanan pada F7 tidak boleh digabung');
  assert.equal(audit.noSeparateDatabase, true);
});

test('Bagian 9 — Kasus 1: Outline tentang kesalahan teknis tak sengaja -> tidak menggunakan nyalahin, nuduh, atau fitnah', () => {
  const topic = 'Gangguan Teknis Server Pendaftaran';
  const outline =
    'Terjadi kesalahan teknis tak sengaja pada pembaruan server semalam tanpa niat buruk dari tim pengembang.';

  const ctx = analyzeNarrativeContext({ topic, outline });
  assert.equal(ctx.isAccidentalError, true);
  assert.equal(ctx.hasIntentionalMaliceEvidence, false);

  const evalNyalahin = evaluateF7CandidateInContext('nyalahin', ctx);
  const evalNuduh = evaluateF7CandidateInContext('nuduh', ctx);
  const evalFitnah = evaluateF7CandidateInContext('fitnah', ctx);

  assert.equal(evalNyalahin.status, 'REPLACED');
  assert.equal(evalNyalahin.allowedInDraft, false);
  assert.equal(evalNuduh.status, 'REPLACED');
  assert.equal(evalNuduh.allowedInDraft, false);
  assert.equal(evalFitnah.status, 'REPLACED');
  assert.equal(evalFitnah.allowedInDraft, false);

  const script = runF7PostGenerationAuditAndRevision({
    script: 'Banyak orang langsung nyalahin dan nuduh tim teknis soal kesalahan sistem.',
    topic,
    outline,
  }).revisedScript;
  assert.equal(/\b(?:nyalahin|nuduh|fitnah)\b/i.test(script), false, 'Naskah hasil generate tidak boleh memuat nyalahin, nuduh, atau fitnah pada kesalahan teknis tak sengaja');
});

test('Bagian 9 — Kasus 2: Outline tentang seseorang yang mengipasi bara api -> mempertahankan makna literal ngipasin', () => {
  const topic = 'Teknik Membakar Sate dan Menjaga Bara Api';
  const outline =
    'Seorang pedagang sate sedang mengipasi bara api arang batok kelapa agar panasnya merata dan daging matang sempurna.';

  const ctx = analyzeNarrativeContext({ topic, outline });
  assert.equal(ctx.hasPhysicalFireOrObjectTarget, true);
  assert.equal(ctx.isLiteralPhysicalAction, true);

  const evalNgipasin = evaluateF7CandidateInContext('ngipasin', ctx);
  assert.equal(evalNgipasin.status, 'RETAINED');
  assert.equal(evalNgipasin.allowedInDraft, true);
  assert.equal(evalNgipasin.selectedForm, 'ngipasin');

  const script = runF7PostGenerationAuditAndRevision({
    script: 'Pedagang itu sedang ngipasin bara api arang batok kelapa agar panasnya merata.',
    topic,
    outline,
  }).revisedScript;
  assert.equal(/\bngipasin\s+bara\s+api\b/i.test(script), true, 'Makna literal ngipasin bara api wajib dipertahankan');
});

test('Bagian 9 — Kasus 3: Outline tentang seseorang yang memanas-manasi dua orang yang sedang bertengkar -> makna kiasan memprovokasi dengan objek sosial jelas', () => {
  const topic = 'Provokasi Pihak Ketiga dalam Konflik Warga';
  const outline =
    'Seseorang justru memanas-manasi dua orang yang sedang bertengkar di ruang diskusi sehingga konflik makin meruncing.';

  const ctx = analyzeNarrativeContext({ topic, outline });
  assert.equal(ctx.hasSocialConflictTarget, true);
  assert.equal(ctx.isLiteralPhysicalAction, false);

  const evalWithoutExplicitObj = evaluateF7CandidateInContext('ngipasin', ctx, 'Dia malah ikut ngipasin.');
  assert.equal(evalWithoutExplicitObj.status, 'CLARIFIED');
  assert.equal(evalWithoutExplicitObj.allowedInDraft, true);
  assert.ok(evalWithoutExplicitObj.selectedForm.includes('suasana'), 'Objek sosial wajib diperjelas');

  const script = runF7PostGenerationAuditAndRevision({
    script: 'Dia malah ikut manas-manasin suasana di tengah pertengkaran itu.',
    topic,
    outline,
  }).revisedScript;
  assert.equal(
    /\b(?:ngipasin\s+suasana|manas-manasin\s+suasana)\b/i.test(script),
    true,
    'Naskah wajib menggunakan makna kiasan memprovokasi dengan objek sosial yang jelas'
  );
});

test('Bagian 9 — Kasus 4: Outline tentang informasi yang belum akurat tanpa bukti kebohongan -> tidak menggunakan ngibulin', () => {
  const topic = 'Revisi Data Statistik Tahunan';
  const outline =
    'Laporan awal menyajikan informasi yang belum akurat tanpa bukti kebohongan karena data lapangan masih dalam proses rekapitulasi.';

  const ctx = analyzeNarrativeContext({ topic, outline });
  assert.equal(ctx.hasDeceptionOrFraudEvidence, false);

  const evalNgibulin = evaluateF7CandidateInContext('ngibulin', ctx);
  assert.equal(evalNgibulin.status, 'REPLACED');
  assert.equal(evalNgibulin.allowedInDraft, false);

  const audit = runF7PostGenerationAuditAndRevision({
    script: 'Mereka jelas lagi ngibulin publik lewat laporan awal itu.',
    topic,
    outline,
  });
  assert.equal(/\bngibulin\b/i.test(audit.revisedScript), false);
  assert.equal(audit.revisedScript.includes('nyampein data yang belum akurat'), true);
});

test('Bagian 9 — Kasus 5: Outline tentang kritik biasa tanpa unsur humor tajam -> tidak menggunakan nge-roasting', () => {
  const topic = 'Evaluasi Tata Kelola Anggaran Daerah';
  const outline =
    'Sejumlah peneliti menyampaikan kritik biasa tanpa unsur humor tajam terhadap keterlambatan laporan anggaran.';

  const ctx = analyzeNarrativeContext({ topic, outline });
  assert.equal(ctx.isOrdinaryCritiqueWithoutHumor, true);

  const evalRoasting = evaluateF7CandidateInContext('nge-roasting', ctx);
  assert.equal(evalRoasting.status, 'REPLACED');
  assert.equal(evalRoasting.allowedInDraft, false);
  assert.equal(evalRoasting.selectedForm, 'nkritik');

  const audit = runF7PostGenerationAuditAndRevision({
    script: 'Para peneliti langsung nge-roasting laporan anggaran tersebut di rapat resmi.',
    topic,
    outline,
  });
  assert.equal(/\bnge-?roasting\b/i.test(audit.revisedScript), false);
  assert.equal(audit.revisedScript.includes('nkritik'), true);
});

test('Bagian 9 — Kasus 6: Outline tentang pembatalan acara biasa -> tidak menggunakan nge-cancel', () => {
  const topic = 'Penundaan Jadwal Diskusi Publik Akibat Cuaca';
  const outline =
    'Panitia mengumumkan pembatalan acara biasa karena hujan deras dan gangguan listrik di gedung pertemuan.';

  const ctx = analyzeNarrativeContext({ topic, outline });
  assert.equal(ctx.isOrdinaryEventCancellation, true);

  const evalCancel = evaluateF7CandidateInContext('nge-cancel', ctx);
  assert.equal(evalCancel.status, 'REPLACED');
  assert.equal(evalCancel.allowedInDraft, false);
  assert.equal(evalCancel.selectedForm, 'ngebatalin');

  const audit = runF7PostGenerationAuditAndRevision({
    script: 'Panitia terpaksa nge-cancel acara diskusi sore ini karena listrik padam.',
    topic,
    outline,
  });
  assert.equal(/\bnge-?cancel\b/i.test(audit.revisedScript), false);
  assert.equal(audit.revisedScript.includes('ngebatalin'), true);
});

test('Bagian 9 — Kasus 7: Outline tentang seseorang yang tanpa sengaja mengucapkan rahasia -> menggunakan keceplosan, bukan ngebocorin atau ngeceplosin', () => {
  const topic = 'Insiden Salah Ucap dalam Wawancara';
  const outline =
    'Seorang narasumber tanpa sengaja mengucapkan rahasia jadwal peluncuran produk saat menjawab pertanyaan spontan.';

  const ctx = analyzeNarrativeContext({ topic, outline });
  assert.equal(ctx.isUnintentionalSecretSlip, true);

  const evalBocorin = evaluateF7CandidateInContext('ngebocorin', ctx);
  const evalCeplosin = evaluateF7CandidateInContext('ngeceplosin', ctx);
  const evalKeceplosan = evaluateF7CandidateInContext('keceplosan', ctx);

  assert.equal(evalBocorin.status, 'REPLACED');
  assert.equal(evalBocorin.selectedForm, 'keceplosan');
  assert.equal(evalCeplosin.status, 'REPLACED');
  assert.equal(evalCeplosin.selectedForm, 'keceplosan');
  assert.equal(evalKeceplosan.status, 'RETAINED');
  assert.equal(evalKeceplosan.allowedInDraft, true);

  const audit = runF7PostGenerationAuditAndRevision({
    script: 'Narasumber itu nggak sengaja ngebocorin dan ngeceplosin tanggal rilis produk.',
    topic,
    outline,
  });
  assert.equal(/\b(?:ngebocorin|ngeceplosin)\b/i.test(audit.revisedScript), false);
  assert.equal(/\bkeceplosan\b/i.test(audit.revisedScript), true);
});

test('Bagian 9 — Kasus 8: Outline analitis -> memilih dan mempertahankan frasa analitis seperti cocokin sama bukti atau ngupas duduk perkaranya', () => {
  const topic = 'Audit Transparansi Data Pengadaan Publik';
  const outline =
    'Analisis mendalam untuk memverifikasi klaim laporan tahunan dan membedah bukti empiris duduk perkara anggaran.';

  const ctx = analyzeNarrativeContext({ topic, outline });
  assert.equal(ctx.isAnalyticalEvidenceReview, true);

  const activePhrases = selectActiveF7PhrasesForBlock(ctx);
  const recWords = activePhrases.recommendedF7Entries.map((r) => r.word);
  assert.equal(recWords.includes('cocokin sama bukti'), true);
  assert.equal(recWords.includes('ngupas duduk perkaranya'), true);

  const candidates = selectContextualExpansionCandidates({
    topic,
    centralThesis: outline,
    stageId: 3,
    stageName: 'Inti Masalah',
    limit: 12,
  });
  assert.ok(candidates.length > 0);
  for (const c of candidates) {
    assert.notEqual(c.f7Status, 'REPLACED', 'Kandidat yang ditolak F7 tidak boleh lolos ke rekomendasi');
  }

  const script = runF7PostGenerationAuditAndRevision({
    script: 'Kita justru perlu ngupas duduk perkaranya dan cocokin sama bukti yang ada di lapangan.',
    topic,
    outline,
  }).revisedScript;
  assert.equal(
    script.includes('ngupas duduk perkaranya') && script.includes('cocokin sama bukti'),
    true,
    'Generator wajib mengaktifkan dan mempertahankan frasa analitis cocokin sama bukti dan ngupas duduk perkaranya'
  );
});

test('Bagian 9 — Kasus 9 & 10: Narator santai boleh memakai slang sesuai konteks dan entri F7 yang tepat konteks tetap dipertahankan (RETAINED)', () => {
  const topic = 'Fenomena Komedi Satir dan Roasting di Tongkrongan Digital';
  const outline =
    'Dalam acara komedi satir yang santai, komika sengaja melakukan roasting tajam terhadap argumen absurd dan perilaku sengaja menipu publik dengan bukti kebohongan nyata.';

  const ctx = analyzeNarrativeContext({
    topic,
    outline,
    narratorToneOverride: 'CASUAL_SATIRICAL',
  });

  const evalRoasting = evaluateF7CandidateInContext('nge-roasting', ctx);
  const evalNyalahin = evaluateF7CandidateInContext('nyalahin', ctx);
  const evalNgibulin = evaluateF7CandidateInContext('ngibulin', ctx);

  assert.equal(evalRoasting.status, 'RETAINED', 'Narator santai/satir boleh menggunakan nge-roasting sesuai konteks');
  assert.equal(evalNyalahin.status, 'RETAINED', 'Entri F7 nyalahin yang didukung bukti kesengajaan wajib dipertahankan (RETAINED)');
  assert.equal(evalNgibulin.status, 'RETAINED', 'Entri F7 ngibulin yang didukung bukti kebohongan nyata wajib dipertahankan (RETAINED)');

  const audit = runF7PostGenerationAuditAndRevision({
    script: 'Komika itu nge-roasting habis-habisan pihak yang terbukti sengaja ngibulin warga dan nyalahin korban.',
    topic,
    outline,
    narratorToneOverride: 'CASUAL_SATIRICAL',
  });
  assert.equal(audit.wasRevised, false, 'Kalimat yang sudah tepat konteksnya TIDAK boleh dihapus/diubah oleh F7 (Anti-Banlist)');
  assert.equal(audit.retainedCount >= 3, true);
  assert.equal(audit.overallStatus, 'RETAINED');
});

test('Bagian 5 & 9: Perbandingan Nyata Sebelum & Sesudah F7 Aktif pada Input yang Sama + Verifikasi NO_TRIGGER & Kejujuran TTS', () => {
  const comparison = compareNarrativeWithAndWithoutF7();

  assert.notEqual(comparison.beforeF7Script, comparison.afterF7Script);
  // Sebelum F7 aktif memuat kata yang tidak tepat konteks: nyalahin, nuduh, ngibulin, nge-cancel, ngebocorin, nge-roasting
  assert.equal(/\bnyalahin\b/i.test(comparison.beforeF7Script), true);
  assert.equal(/\bnuduh\b/i.test(comparison.beforeF7Script), true);
  assert.equal(/\bngibulin\b/i.test(comparison.beforeF7Script), true);
  assert.equal(/\bnge-cancel\b/i.test(comparison.beforeF7Script), true);
  assert.equal(/\bngebocorin\b/i.test(comparison.beforeF7Script), true);
  assert.equal(/\bnge-roasting\b/i.test(comparison.beforeF7Script), true);

  // Sesudah F7 aktif: kata yang tidak sesuai konteks telah diganti, sedangkan frasa analitis yang tepat ("ngupas duduk perkaranya", "cocokin sama bukti") tetap dipertahankan!
  assert.equal(/\b(?:nyalahin|nuduh|ngibulin|nge-cancel|ngebocorin|nge-roasting)\b/i.test(comparison.afterF7Script), false);
  assert.equal(comparison.afterF7Script.includes('keliru menilai'), true);
  assert.equal(comparison.afterF7Script.includes('nyampein data yang belum akurat'), true);
  assert.equal(comparison.afterF7Script.includes('ngebatalin'), true);
  assert.equal(comparison.afterF7Script.includes('keceplosan'), true);
  assert.equal(comparison.afterF7Script.includes('nkritik'), true);
  assert.equal(comparison.afterF7Script.includes('ngupas duduk perkaranya'), true);
  assert.equal(comparison.afterF7Script.includes('cocokin sama bukti'), true);
  assert.equal(comparison.auditReport.retainedCount >= 2, true);
  assert.equal(comparison.auditReport.replacedCount >= 5, true);

  // Verifikasi NO_TRIGGER ketika kalimat sama sekali tidak memicu entri khusus F7
  const noTriggerAudit = runF7PostGenerationAuditAndRevision({
    script: 'Kita semua perlu menjaga kesehatan tubuh dengan makan sayur dan tidur cukup setiap malam.',
    topic: 'Pola Hidup Sehat',
    outline: 'Menjaga pola tidur dan makan bergizi dengan bukti riset medis.',
  });
  assert.equal(noTriggerAudit.overallStatus, 'NO_TRIGGER');
  assert.equal(noTriggerAudit.totalF7Triggered, 0);

  // Verifikasi Kejujuran Evaluasi TTS (Anti-Manipulasi: audioPlaybackTested === false)
  assert.equal(comparison.auditReport.ttsEvaluationSummary.evaluatedByTextAndPhonotactics, true);
  assert.equal(comparison.auditReport.ttsEvaluationSummary.audioPlaybackTested, false);
});
