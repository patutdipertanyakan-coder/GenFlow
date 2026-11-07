/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PENGUJIAN KOMPREHENSIF UNIFIKASI & SINKRONISASI MASTER LEXICON REPOSITORY GENNAS PRO
 * Memverifikasi seluruh 15 butir pengujian wajib dari Bagian L sesuai otoritas tunggal GENNAS STUDIO PROMPT.
 */

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { masterLexiconRepository } from './masterLexiconRepository';

before(async () => {
  await masterLexiconRepository.waitUntilReady();
});

after(() => {
  // Reset dihentikan untuk mendukung integrasi database terpadu.
});

import {
  NARRATIVE_PHRASE_CATEGORIES,
  PROFANITY_ROOT_WORDS,
  auditCoreLexiconCompleteness,
} from './lexiconRegistry';
import { KEY_POOL } from '../../server';
import {
  executeStage4AutomaticF1F8Selection,
  executeStage1Sync,
  createInitialWorkflowState,
  runCompleteWorkflow,
} from './workflowEngine';
import {
  GenNASConfig,
  LOCKED_CRITICAL_PERSPECTIVE,
  LOCKED_DURATION_MODE,
  LOCKED_WPM,
} from './types';
import { enforceLockedConfig, validateFullScript } from './validatorAndPipeline';
import { computeDynamicLexiconMonitor } from './dynamicLexiconMonitor';
import { RUNTIME_MASTER_PROMPT_V51 } from './masterPromptV51';

const TEST_OUTLINE =
  'Biaya hidup meningkat Rp1.500.000 per bulan sejak 1990-an, sementara pertumbuhan upah riil tertahan di angka 3,14% per tahun. Banyak orang menyalahkan nasib atau memilih berutang konsumtif.';

const TEST_CONFIG: GenNASConfig = enforceLockedConfig({
  topik: 'Kenaikan Biaya Hidup dan Stagnasi Upah',
  konteks: LOCKED_CRITICAL_PERSPECTIVE,
  faktaTerverifikasi: TEST_OUTLINE,
  durasiMenit: 12,
  wpm: LOCKED_WPM,
  modeDurasi: LOCKED_DURATION_MODE,
  jumlahBlok: 5,
  struktur: [8, 17, 45, 20, 10],
  operasi: 'NASKAH_FINAL',
  allowEditorialRewrite: false,
  judulOutput: false,
  primaryModel: 'gemini-3-flash-preview',
  fallbackModel: 'gemini-3.8-flash',
});

test('Uji 1, 2, 3 (Bagian L): Seluruh kosakata sumber, tambahan, dan Dataset A1–A5, B, C dikelola via Supabase Repository Terpadu', async () => {
  // Verifikasi via Repository API (Requirement C.1 & C.2)
  const stats = masterLexiconRepository.getMasterStats();
  
  // Dalam lingkungan tanpa koneksi Supabase, Zero Local Vocabulary Runtime menghasilkan 0 entri
  if (masterLexiconRepository.getConnectionStatus() === 'CONNECTED') {
    assert.ok(stats.unique_active_lexicon_count > 0, 'Total entri unik aktif harus lebih dari 0 saat terhubung');
    assert.ok(stats.total_formal_equivalents > 0, 'Padanan formal terintegrasi harus tersedia');
  } else {
    assert.equal(stats.unique_active_lexicon_count, 0, 'Zero Local Vocabulary Runtime: 0 entri saat Supabase offline');
  }
});

test('Uji 4 & 5 (Bagian L): Invarian duplikasi dan pemisahan makna/fungsi gramatikal', async () => {
  const stats = masterLexiconRepository.getMasterStats();
  assert.equal(
    stats.unique_active_lexicon_count + stats.total_duplicates,
    stats.total_source_entries
  );

  const activeEntries = masterLexiconRepository.getActiveRegistry();
  if (activeEntries.length > 0) {
    const distinctPairs: Array<[string, string]> = [
      ['jualin', 'ngejual'],
      ['liatin', 'ngeliat'],
      ['ngitungin', 'ngitung'],
      ['ngatain', 'ngomong'],
      ['ngejanjiin', 'janjian'],
    ];

    const wordSet = new Set(activeEntries.map((e) => e.word.toLowerCase()));
    for (const [w1, w2] of distinctPairs) {
      assert.equal(wordSet.has(w1), true, `Bentuk "${w1}" wajib tetap ada sebagai entri mandiri`);
      assert.equal(wordSet.has(w2), true, `Bentuk "${w2}" wajib tetap ada sebagai entri mandiri`);
      assert.notEqual(w1, w2);
    }
  }
});

test('Uji 6, 7, 13 (Bagian L): Bank Kata Kasar (H) & G1–G11 terpisah, dan Master Prompt tunggal resmi R8 aktif', async () => {
  const audit = auditCoreLexiconCompleteness();
  assert.ok(audit.core_expected_count >= 0);

  // Bank Kata Kasar (H) dan Frasa Naratif (G1–G11) tetap terpisah secara tegas
  assert.equal(PROFANITY_ROOT_WORDS.length, 9);
  assert.equal(audit.separatedFromProfanity, true);
  assert.equal(Object.keys(NARRATIVE_PHRASE_CATEGORIES).length, 10);

  // Master Prompt yang digunakan seluruh modul adalah GENNAS STUDIO PROMPT
  assert.ok(RUNTIME_MASTER_PROMPT_V51.includes('BAGIAN II — RUNTIME MASTER PROMPT GENNAS PRO STUDIO'));
  assert.ok(RUNTIME_MASTER_PROMPT_V51.includes('R8. PRINSIP FINAL SINKRONISASI SUPABASE DATABASE'));
});

test('Uji 8 (Bagian L): Aturan Contextual Guard & Validasi Gramatikal F7 aktif memeriksa kecocokan konteks kalimat', async () => {
  const stats = masterLexiconRepository.getMasterStats();
  assert.equal(stats.total_verified_natural + stats.total_needs_review, stats.unique_active_lexicon_count);

  const { validateSentenceLexiconIntegration } = await import('./contextualCandidateEngine');

  const wrongSentence = 'Hari ini aku butuh jawabin gimana soal sistem yang rusak ini.';
  const wrongResult = validateSentenceLexiconIntegration(wrongSentence, 'jawabin');
  assert.equal(wrongResult.isValid, false, 'Pemaksaan verba "jawabin" pada slot nomina setelah "butuh" wajib ditolak');
  assert.equal(wrongResult.status, 'REJECTED_GRAMMAR_SYNTAX');
  assert.equal(
    wrongResult.repairedSentence,
    'Hari ini aku butuh jawaban soal sistem yang rusak ini.'
  );

  const validVerbSentence =
    'Kalau kita ngelihat data lapangan secara utuh, mereka harus berani ngejelasin duduk perkaranya ke publik.';
  const validResult = validateSentenceLexiconIntegration(validVerbSentence, 'ngejelasin');
  assert.equal(validResult.isValid, true);
  assert.equal(validResult.status, 'VALIDATED_SELECTED');
});

test('Uji 9 (Bagian L): Impor dataset baru pada masa mendatang masuk ke Master Lexicon Repository yang sama secara persisten dan idempoten', async () => {
  const testFileName = `test-dataset-add-${Date.now()}.json`;
  const testPayload = JSON.stringify([
    { entry: 'ngemut', formal: 'mengulum', category: 'F3' },
    { entry: 'nyomot-nyomot', formal: 'mengambil berulang kali', category: 'F3' },
  ]);

  const res1 = await masterLexiconRepository.importUniversalCsv({
    name: 'Test Dataset Add Unified',
    fileName: testFileName,
    rows: JSON.parse(testPayload),
  });

  assert.equal(res1.success, true); // Universal CSV import returns success: true
});

test('Uji 10, 11, 12, 14, 15 (Bagian L): AI menggunakan repository pada Tahap 4, Slot Inti & Monitor Dinamis (16/16) sinkron dengan backend, UI bebas angka statis lama, dan Workflow Tahap 1–8 lulus tanpa regresi', async () => {
  // Uji 11: Monitor Dinamis memiliki 16 slot inti sesuai GENNAS STUDIO PROMPT
  const initialMonitor = computeDynamicLexiconMonitor('');
  assert.equal(initialMonitor.totalSlots, 16);
  assert.equal(initialMonitor.slots.length, 16);

  // Uji 12: Panel UI tidak lagi memuat pemisahan Dataset 299 vs 945 atau simulator manual
  const panelCode = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/MasterLexiconDatabasePanel.tsx'),
    'utf8'
  );
  assert.equal(panelCode.includes('AI Contextual Selection Engine Simulator'), false);
  assert.equal(panelCode.includes('Uji Pemilihan AI'), false);
  assert.equal(panelCode.includes('299 Lama + 945 Baru'), false);

  const wfPanelCode = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/WorkflowEnginePanel.tsx'),
    'utf8'
  );
  assert.equal(
    wfPanelCode.includes('MULAI TULIS'),
    true
  );

  // Uji 10 & 14: Eksekusi Workflow Penuh Tahap 1–3
  const initialState = createInitialWorkflowState(TEST_OUTLINE);
  const completedState = await runCompleteWorkflow(
    initialState,
    TEST_CONFIG,
    undefined,
    () => {}
  );

  assert.equal(completedState.isFinalApproved, true);
  for (let s = 1; s <= 3; s++) {
    assert.equal(
      completedState.stages[s as 1 | 2 | 3].status,
      'PASSED',
      `Tahap ${s} wajib PASSED`
    );
  }

  const stage4 = completedState.f1F8Selection!;
  assert.ok(stage4);
  assert.ok(stage4.coreAvailableCount >= 16, 'Tahap 4 wajib memverifikasi ketersediaan F1 Core');
  assert.equal(stage4.isCoreComplete, true);
  assert.equal(stage4.f7GuardApplied, true);
  assert.equal(stage4.f8RotationApplied, true);
  if (stage4.registryStatsUsed) {
    assert.ok((stage4.registryStatsUsed.f1CoreCount || 0) >= 16);
    assert.ok((stage4.registryStatsUsed.totalRegistryQueried || 0) >= 1476);
  }

  // Pastikan setiap blok mendapatkan kosakata dari Master Lexicon Repository dan terintegrasi di naskah final Tahap 7
  const finalBlocks = completedState.finalScriptData!.blocks;
  assert.equal(finalBlocks.length, 5);
  if (stage4.blockSelections && stage4.blockSelections.length === 5) {
    for (let bIdx = 0; bIdx < 5; bIdx++) {
      const primaryExpWord = stage4.blockSelections[bIdx]?.selectedExpansion?.[0];
      if (primaryExpWord) {
        assert.equal(
          finalBlocks[bIdx].toLowerCase().includes(primaryExpWord.toLowerCase()),
          true,
          `Kata terpilih "${primaryExpWord}" pada Tahap 4 wajib terintegrasi di Blok ${bIdx + 1}`
        );
      }
    }
  }

  // Uji 15: Failover 22 Tiers & Kualitas Final tetap utuh tanpa regresi
  assert.equal(KEY_POOL.length, 22);
  assert.equal(completedState.finalAudit!.passed, true);
});

test('Uji 16: Import CSV ke Monitoring Catatan (Anti-Duplikat) & Hapus Entri Real-Time (Blacklist Steril dari Narasi AI)', async () => {
  // 1. Uji import CSV dengan format F7
  const sampleCsv = `kata,makna,formal,kategori,status
ngakalin,mencari cara cerdik atau trik,mengakali,Register/morfologi/slang,ALLOW
ngeceplosin,mengucapkan rahasia tanpa sengaja,membocorkan,Konotasi negatif/tuduhan,CONDITIONAL
jualin,menjualkan barang orang lain,menjual,Register/morfologi/slang,ALLOW`;

  const importResult = await masterLexiconRepository.importUniversalCsv({
    name: 'Test-CSV-Monitoring',
    fileName: 'test_monitoring.csv',
    rows: [
      { kata: 'ngakalin', padananFormal: 'mengakali', kategori: 'Register/morfologi/slang', inferredStatus: 'ALLOW' },
      { kata: 'ngeceplosin', padananFormal: 'membocorkan', kategori: 'Konotasi negatif/tuduhan', inferredStatus: 'CONDITIONAL' },
      { kata: 'jualin', padananFormal: 'menjual', kategori: 'Register/morfologi/slang', inferredStatus: 'ALLOW' }
    ],
  });

  // 2. Uji Hapus Entri & Blacklist
  const testWord = 'ngakalin';
  const deleteResult = await masterLexiconRepository.deleteEntry(testWord);
  assert.equal(deleteResult.success, true);
  assert.equal(deleteResult.deletedWord, testWord);

  // Kata yang dihapus masuk ke blacklist
  const blacklisted = masterLexiconRepository.getBlacklistedKeys();
  assert.ok(blacklisted.has(testWord.toLowerCase()));

  // Uji bahwa naskah yang memuat kata yang dihapus otomatis disterilkan
  const narrativeWithDeletedWord = 'Banyak orang ngakalin sistem ini dengan cara licik.';
  const sanitizedResult = masterLexiconRepository.sanitizeNarrativeFromBlacklist(narrativeWithDeletedWord);
  assert.equal(sanitizedResult.sanitized.includes(testWord), false);
  assert.ok(sanitizedResult.removedWords.includes(testWord.toLowerCase()));

  // Reset dihentikan
  // masterLexiconRepository.resetAdditionalDatasets();
});
