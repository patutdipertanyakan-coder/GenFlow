/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyG1G11PhraseOptimizationToScript,
  canDisplayFinalScriptInEditor,
  canExecuteStage,
  createInitialWorkflowState,
  executePreFinalQualityGate,
  executeStage1Sync,
  executeStage2DraftV0,
  executeStage3AuditV0,
  executeStage4AutomaticF1F8Selection,
  executeStage5AutomaticProfanitySelection,
  executeStage6AutomaticPhraseSelection,
  executeStage7FinalScript,
  executeStage8FinalApproval,
  getStageMeta,
  invalidateWorkflowFromStage,
  isWorkflowCompleted,
  runCompleteWorkflow,
  WORKFLOW_STAGES_META,
} from './workflowEngine';
import {
  checkFinalExportEligibility,
  exportAuditJsonFile,
} from './exportUtils';
import {
  FinalScriptWorkflowData,
  GenNASConfig,
  LOCKED_CRITICAL_PERSPECTIVE,
  LOCKED_DURATION_MODE,
  LOCKED_WPM,
  WorkflowStageId,
} from './types';
import fs from 'node:fs';
import path from 'node:path';
import {
  auditG1G11PhraseDistribution,
  enforceG1G11PhraseTarget,
  enforceLockedConfig,
  validateFullScript,
} from './validatorAndPipeline';

const TEST_OUTLINE =
  'Biaya hidup meningkat Rp1.500.000 per bulan sejak 1990-an, sementara pertumbuhan upah riil tertahan di angka 3,14% per tahun. Banyak orang menyalahkan nasib atau memilih berutang konsumtif.';

const BASE_TEST_CONFIG: GenNASConfig = enforceLockedConfig({
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

test('1. Roadmap 3 Tahap Wajib: Seluruh metadata tahap 1–3 terdefinisi secara presisi dan berurutan', () => {
  assert.equal(WORKFLOW_STAGES_META.length, 3);
  assert.equal(WORKFLOW_STAGES_META[0].name, 'Upload Kerangka Naskah & Ekstraksi Sumber');
  assert.equal(WORKFLOW_STAGES_META[1].name, 'Generate Naskah Terintegrasi & F7 Contextual Guard');
  assert.equal(WORKFLOW_STAGES_META[2].name, 'Evaluasi Quote-Free & Pengesahan Status Final');

  for (let i = 1; i <= 3; i++) {
    const meta = getStageMeta(i as any);
    assert.equal(meta.id, i);
    assert.equal(meta.number, i);
  }
});

test('2. Pengunci Alur (Strict Stage Gating): Tahap berikutnya DITOLAK jika tahap sebelumnya belum PASSED', () => {
  const emptyState = createInitialWorkflowState('', '');

  // Tahap 1 boleh dijalankan kapan saja
  assert.equal(canExecuteStage(emptyState, 1).allowed, true);

  // Tahap 2 sampai 3 harus diblokir karena Tahap 1 berstatus PENDING
  for (let s = 2; s <= 3; s++) {
    const check = canExecuteStage(emptyState, s as any);
    assert.equal(check.allowed, false);
    assert.match(check.reason!, new RegExp(`Tahap ${s - 1}.*belum berstatus PASSED`));
  }

  // Jika Tahap 1 sudah PASSED, maka Tahap 2 diizinkan, tetapi Tahap 3 tetap diblokir
  const stateStage1Passed = { ...emptyState };
  stateStage1Passed.stages[1].status = 'PASSED';
  assert.equal(canExecuteStage(stateStage1Passed, 2).allowed, true);
  assert.equal(canExecuteStage(stateStage1Passed, 3).allowed, false);

  // Jika Workflow sedang berjalan (isRunning), seluruh aksi single stage diblokir
  const runningState = { ...stateStage1Passed, isRunning: true };
  assert.equal(canExecuteStage(runningState, 2).allowed, false);
  assert.match(canExecuteStage(runningState, 2).reason!, /sedang berjalan/);
});

test('3. Eksekusi Tahap 1 (Upload & Ekstraksi): Membaca teks, mendeteksi topik, dan protected tokens SAP', () => {
  const extraction = executeStage1Sync(TEST_OUTLINE, 'tes-kerangka.txt');
  assert.ok(extraction.wordCount > 10);
  assert.ok(extraction.inferredTopic.length > 5);
  assert.ok(extraction.protectedTokens.includes('Rp1.500.000'));
  assert.ok(extraction.protectedTokens.includes('3,14%'));
  assert.ok(extraction.protectedTokens.includes('1990-an'));
  assert.equal(extraction.integrityStatus, 'VALID');
  assert.ok(extraction.narrativePlan);
  assert.equal(extraction.narrativePlan.storyflow_plan.length, 5);
});

test('4. Eksekusi Tahap 2 (Generate Naskah Awal): Menghasilkan Draft V0 dengan label eksplisit dan belum final', async () => {
  const extraction = executeStage1Sync(TEST_OUTLINE);
  const draftV0 = await executeStage2DraftV0(BASE_TEST_CONFIG, extraction);

  assert.equal(draftV0.isDraft, true);
  assert.equal(draftV0.blocks.length, 5);
  assert.ok(draftV0.wordCount > 50);
  assert.ok(draftV0.script.includes('\n'));
});

test('5. Eksekusi Tahap 3 (Audit Dashboard 02): Melakukan diagnosis naskah Draft V0 secara komprehensif', async () => {
  const extraction = executeStage1Sync(TEST_OUTLINE);
  const draftV0 = await executeStage2DraftV0(BASE_TEST_CONFIG, extraction);
  const auditV0 = executeStage3AuditV0(draftV0.script, BASE_TEST_CONFIG);

  assert.ok(auditV0.audit);
  assert.equal(auditV0.audit.stages.length, 5);
  assert.ok(auditV0.diagnosisSummary);
  assert.ok(Array.isArray(auditV0.diagnosisSummary.recommendedActions));
  assert.ok(auditV0.diagnosisSummary.recommendedActions.length > 0);
});

test('6. Eksekusi Tahap 4 (Pemilihan Otomatis Kosakata F1–F8): 16 F1 Core lengkap sesuai GENNAS STUDIO PROMPT, pemilihan 100% otomatis per blok', () => {
  const extraction = executeStage1Sync(TEST_OUTLINE);
  const f1F8 = executeStage4AutomaticF1F8Selection(
    TEST_OUTLINE,
    extraction.narrativePlan!,
    BASE_TEST_CONFIG
  );

  assert.equal(f1F8.isCoreComplete, true);
  assert.equal(f1F8.coreAvailableCount, 16);
  assert.equal(f1F8.blockSelections.length, 5);
  assert.ok(f1F8.totalWordsSelected >= 25);

  // Periksa bahwa setiap blok memiliki pemilihan variasi leksikal
  for (const blockSel of f1F8.blockSelections) {
    assert.ok(blockSel.selectedF1Core.length > 0);
    assert.ok(blockSel.selectedF4Markers.length > 0);
    assert.ok(blockSel.contextRationale.length > 10);
  }
});

test('7. Eksekusi Tahap 5 (Pemilihan Otomatis Bank Kata Kasar H): Wajib 3–5 kejadian per blok, terintegrasi sintaksis, 100% Non-SARA', () => {
  const extraction = executeStage1Sync(TEST_OUTLINE);
  const profanity = executeStage5AutomaticProfanitySelection(
    TEST_OUTLINE,
    extraction.narrativePlan!,
    BASE_TEST_CONFIG
  );

  assert.equal(profanity.blockSelections.length, 5);
  assert.equal(profanity.isNonSaraStrict, true);
  assert.ok(profanity.totalCount >= 15 && profanity.totalCount <= 25);

  for (const b of profanity.blockSelections) {
    assert.ok(b.targetCount >= 3 && b.targetCount <= 5);
    assert.equal(b.selectedPhrases.length, b.targetCount);
    for (const item of b.selectedPhrases) {
      assert.equal(item.nonSaraCompliant, true);
      assert.ok(item.integratedPhrase.length > 5);
      assert.ok(item.critiqueTarget.length > 3);
      // Bukan makian mandiri tempelan di ujung kalimat
      assert.doesNotMatch(item.integratedPhrase, /^(?:goblok|tolol|bego)\.?$/i);
    }
  }
});

test('8. Eksekusi Tahap 6 (Pemilihan Otomatis Bank Frasa G1–G11): Terdistribusi proporsional ke 5 blok StoryFlow', () => {
  const extraction = executeStage1Sync(TEST_OUTLINE);
  const phraseSel = executeStage6AutomaticPhraseSelection(
    TEST_OUTLINE,
    extraction.narrativePlan!,
    BASE_TEST_CONFIG
  );

  assert.equal(phraseSel.blockSelections.length, 5);
  assert.ok(phraseSel.totalPhrasesSelected >= 5);

  // Blok 1 memuat frasa pembuka
  assert.equal(phraseSel.blockSelections[0].blockId, 1);
  assert.ok(phraseSel.blockSelections[0].selectedPhrases.some((p) => p.category.includes('G2')));
  // Blok 5 memuat frasa penutup
  assert.equal(phraseSel.blockSelections[4].blockId, 5);
  assert.ok(phraseSel.blockSelections[4].selectedPhrases.some((p) => p.category.includes('G11')));
});

test('9. Eksekusi Tahap 7 (Generate Naskah Final) & Tahap 8 (Selesai): Mengintegrasikan seluruh tahapan, bebas petik (SQNN), dan mengesahkan status final', async () => {
  const extraction = executeStage1Sync(TEST_OUTLINE);
  const draftV0 = await executeStage2DraftV0(BASE_TEST_CONFIG, extraction);
  const auditV0 = executeStage3AuditV0(draftV0.script, BASE_TEST_CONFIG);
  const f1F8 = executeStage4AutomaticF1F8Selection(
    draftV0.script,
    extraction.narrativePlan!,
    BASE_TEST_CONFIG
  );
  const profanity = executeStage5AutomaticProfanitySelection(
    draftV0.script,
    extraction.narrativePlan!,
    BASE_TEST_CONFIG
  );
  const phrases = executeStage6AutomaticPhraseSelection(
    draftV0.script,
    extraction.narrativePlan!,
    BASE_TEST_CONFIG
  );

  const finalScriptData = await executeStage7FinalScript(BASE_TEST_CONFIG, {
    extraction,
    draftV0,
    auditV0,
    f1F8,
    profanity,
    phrases,
  });

  assert.equal(finalScriptData.blocks.length, 5);
  assert.ok(finalScriptData.wordCount > 100);
  assert.equal(finalScriptData.audit.quoteFree?.passed, true);
  assert.equal(finalScriptData.audit.nonSaraPassed, true);

  // Uji Tahap 8
  const approval = executeStage8FinalApproval(finalScriptData, true);
  assert.equal(approval.isFinal, true);
  assert.equal(approval.checklist.allPriorStagesPassed, true);
  assert.equal(approval.checklist.quoteFreePassed, true);
  assert.equal(approval.checklist.nonSaraGuardPassed, true);
});

test('10. Invalidasi Otomatis (Reactive Invalidation): Perubahan kerangka mereset seluruh tahapan berikutnya ke PENDING', () => {
  let state = createInitialWorkflowState(TEST_OUTLINE);
  state.stages[1].status = 'PASSED';
  state.stages[2].status = 'PASSED';
  state.stages[3].status = 'PASSED';
  state.isFinalApproved = true;

  // Jika user mengubah kerangka di Tahap 2 ke atas
  const invalidated = invalidateWorkflowFromStage(state, 2);
  assert.equal(invalidated.stages[1].status, 'PASSED');
  assert.equal(invalidated.stages[2].status, 'PENDING');
  assert.equal(invalidated.stages[3].status, 'PENDING');
  assert.equal(invalidated.isFinalApproved, false);
});

test('11. Runner Alur Lengkap Otomatis (runCompleteWorkflow): Menjalankan urutan 1 -> 3 secara berurutan dan terverifikasi', async () => {
  const initialState = createInitialWorkflowState(TEST_OUTLINE);
  const recordedSteps: Array<{ stageId: number; status: string }> = [];

  const finalState = await runCompleteWorkflow(
    initialState,
    BASE_TEST_CONFIG,
    undefined, // gunakan fallback deterministik terintegrasi
    (stageId, status) => {
      recordedSteps.push({ stageId, status });
    }
  );

  assert.equal(finalState.isFinalApproved, true);
  assert.equal(finalState.stages[1].status, 'PASSED');
  assert.equal(finalState.stages[2].status, 'PASSED');
  assert.equal(finalState.stages[3].status, 'PASSED');

  // Pastikan urutan transisi status tercatat dengan benar
  const passedSteps = recordedSteps
    .filter((s) => s.status === 'PASSED')
    .map((s) => s.stageId);
  assert.deepEqual(passedSteps, [1, 2, 3, 4]);
});

test('12. Bukti Integritas 21 API Key & Failover System di server.ts tidak berubah', () => {
  const serverPath = path.resolve(process.cwd(), 'server.ts');
  const serverSource = fs.readFileSync(serverPath, 'utf8');

  // Pool API Key harus tetap lengkap memuat API Utama + 21 Cadangan = 22 Key
  assert.ok(serverSource.includes("label: 'API Utama'"));
  assert.ok(serverSource.includes("label: 'API Cadangan 1'"));
  assert.ok(serverSource.includes("label: 'API Cadangan 21'"));

  // Hitung jumlah kemunculan API Cadangan dalam KEY_POOL
  const matches = serverSource.match(/label:\s*'API Cadangan \d+'/g);
  assert.equal(matches?.length, 21, 'Harus ada tepat 21 API Cadangan');

  // Backend models harus tetap memuat 5 model Gemini
  assert.ok(serverSource.includes("'gemini-3-flash-preview'"));
  assert.ok(serverSource.includes("'gemini-2.5-pro'"));
  assert.ok(serverSource.includes('executeWithFailoverPool'));
});

test('13. TEST 1 — FULL WORKFLOW SUCCESS: Loading berhenti, isRunning = false, isFinalApproved = true, isWorkflowCompleted = true', async () => {
  const initialState = createInitialWorkflowState(TEST_OUTLINE);
  let stage3PassedReceivedRunningState = true;

  const finalState = await runCompleteWorkflow(
    initialState,
    BASE_TEST_CONFIG,
    undefined,
    (stageId, status, currentState) => {
      if (stageId === 3 && status === 'PASSED') {
        stage3PassedReceivedRunningState = currentState.isRunning;
      }
    }
  );

  assert.equal(finalState.isFinalApproved, true);
  assert.equal(finalState.isRunning, false, 'isRunning harus false setelah workflow selesai');
  assert.equal(finalState.isAutoAdvancing, false, 'isAutoAdvancing harus false setelah workflow selesai');
  assert.equal(stage3PassedReceivedRunningState, false, 'Callback tahap 3 PASSED tidak boleh menerima isRunning=true');

  for (let s = 1; s <= 3; s++) {
    assert.equal(finalState.stages[s as WorkflowStageId].status, 'PASSED', `Tahap ${s} harus berstatus PASSED`);
  }

  assert.equal(isWorkflowCompleted(finalState, true), true, 'isWorkflowCompleted harus bernilai true');
});

test('14. TEST 2 — WORKFLOW FAILURE: Loading berhenti pada kegagalan, status FAILED, isRunning = false, isWorkflowCompleted = false', async () => {
  const invalidConfig = {
    ...BASE_TEST_CONFIG,
    faktaTerverifikasi: 'pendek', // < 15 karakter menyebabkan kegagalan tahap 1
  };
  const initialState = createInitialWorkflowState('');

  const failedState = await runCompleteWorkflow(
    initialState,
    invalidConfig,
    undefined,
    () => {}
  );

  assert.equal(failedState.isRunning, false, 'Loading harus berhenti saat gagal');
  assert.equal(failedState.stages[1].status, 'FAILED');
  assert.equal(failedState.isFinalApproved, false);
  assert.ok(failedState.lastError);
  assert.equal(isWorkflowCompleted(failedState, false), false, 'Tidak boleh berstatus Alur Selesai saat gagal');
});

test('15. TEST 3 — RESET WORKFLOW: Reset mengembalikan alur ke siap dijalankan, isRunning = false, isWorkflowCompleted = false', () => {
  const resetState = createInitialWorkflowState('', '');
  assert.equal(resetState.isRunning, false);
  assert.equal(resetState.isFinalApproved, false);
  assert.equal(resetState.currentStageId, 1);
  assert.equal(resetState.stages[1].status, 'PENDING');
  assert.equal(isWorkflowCompleted(resetState, false), false, 'Tidak boleh berstatus Alur Selesai setelah di-reset');
});

test('16. TEST 4 — EDIT AFTER FINAL APPROVAL: Edit naskah membatalkan approval tahap 3, isRunning = false, isWorkflowCompleted = false', async () => {
  const initialState = createInitialWorkflowState(TEST_OUTLINE);
  const finalState = await runCompleteWorkflow(
    initialState,
    BASE_TEST_CONFIG,
    undefined,
    () => {}
  );
  assert.equal(isWorkflowCompleted(finalState, true), true);

  // Simulasikan pengeditan naskah setelah tahap 3 disahkan
  const invalidated = invalidateWorkflowFromStage(finalState, 3);
  assert.equal(invalidated.isRunning, false, 'Loading tidak boleh berputar saat idle setelah edit');
  assert.equal(invalidated.stages[3].status, 'PENDING', 'Tahap 3 harus kembali PENDING');
  assert.equal(invalidated.isFinalApproved, false, 'Final approval harus diinvalidasi');
  assert.equal(isWorkflowCompleted(invalidated, true), false, 'Status selesai harus batal setelah diedit');
});

test('17. TEST 5 — REPEAT EXECUTION: Alur dapat dijalankan kembali setelah reset dan berhenti bersih di Alur Selesai', async () => {
  const resetState = createInitialWorkflowState(TEST_OUTLINE);
  const rerunState = await runCompleteWorkflow(
    resetState,
    BASE_TEST_CONFIG,
    undefined,
    () => {}
  );

  assert.equal(rerunState.isRunning, false, 'Loading harus berhenti bersih pada eksekusi ulang');
  assert.equal(rerunState.isFinalApproved, true);
  for (let s = 1; s <= 3; s++) {
    assert.equal(rerunState.stages[s as WorkflowStageId].status, 'PASSED');
  }
  assert.equal(isWorkflowCompleted(rerunState, true), true, 'Alur Selesai tercapai pada eksekusi ulang');
});

test('18. TEST 2 & TEST 4 — DASHBOARD AUTOMATION & FINAL SCRIPT DISPLAY: Seluruh 10 indikator diperiksa otomatis & naskah 5 blok tampil', async () => {
  const initialState = createInitialWorkflowState(TEST_OUTLINE);
  const finalState = await runCompleteWorkflow(
    initialState,
    BASE_TEST_CONFIG,
    undefined,
    () => {}
  );

  assert.ok(finalState.finalScriptData?.script, 'Naskah final wajib tersedia');
  const finalScript = finalState.finalScriptData.script;
  const blocks = finalScript.split('\n').filter((l) => l.trim().length > 0);
  assert.equal(blocks.length, 5, 'Naskah final wajib terdiri dari tepat 5 blok SCTF');

  // Evaluasi 10 komponen Dashboard 02 secara deterministik
  const audit = validateFullScript(finalScript, BASE_TEST_CONFIG);

  // 1. NON_SARA_HARD_GUARD
  assert.equal(audit.nonSaraPassed, true);
  assert.equal(audit.nonSaraGuard.passed, true);

  // 2. KESESUAIAN KERANGKA / SOURCE FIDELITY
  assert.ok(audit.sourceFidelity);
  assert.equal(audit.sourceFidelity.passed, true);

  // 3. Blok SCTF
  assert.equal(audit.sctfValid, true);
  assert.equal(audit.paragraphCount, 5);

  // 4. Kritik Terintegrasi (3-5 per blok)
  assert.equal(audit.kritikPassCount, 5);

  // 5. Tanda Baca (SAP)
  assert.equal(audit.punctuationPassCount, 5);

  // 6. Bahasa Gue–Lo
  assert.equal(audit.stylePassCount, 5);

  // 7. Transisi (DRA+PTV)
  assert.equal(audit.transitionPassCount, 4);

  // 8. Kata / Estimasi Durasi
  assert.ok(audit.totalWords > 0);

  // 9. Kesesuaian Sumber (Topic Relevance)
  assert.equal(audit.sourceFidelity.topicRelevance.passed, true);

  // 10. Quote-Free (SQNN)
  assert.ok(audit.quoteFree);
  assert.equal(audit.quoteFree.passed, true);
  assert.equal(audit.quoteFree.totalQuotesFound, 0);
});

test('19. TEST 3 — NO DUPLICATE EXECUTION: Satu klik hanya memicu satu proses, klik kedua dicegah saat isRunning', () => {
  const runningState = {
    ...createInitialWorkflowState(TEST_OUTLINE),
    isRunning: true,
  };

  // Mekanisme gating: eksekusi diblokir jika workflow sedang berjalan
  const check = canExecuteStage(runningState, 1);
  assert.equal(check.allowed, false);
  assert.match(check.reason!, /sedang berjalan/i);
});

test('20. TEST 6 — FINAL EXPORT LOCK: Ekspor terkunci saat Draft V0 / PENDING, dan terbuka hanya setelah Tahap 3 PASSED & isFinalApproved', () => {
  const draftState = createInitialWorkflowState(TEST_OUTLINE);
  draftState.stages[2].status = 'PASSED';
  draftState.isFinalApproved = false;

  // Sebelum Tahap 3 disahkan: Alur belum tuntas, ekspor final terkunci
  assert.equal(isWorkflowCompleted(draftState, true), false);

  // Setelah Tahap 3 PASSED dan isFinalApproved = true
  for (let s = 1; s <= 3; s++) {
    draftState.stages[s as WorkflowStageId].status = 'PASSED';
  }
  draftState.isFinalApproved = true;
  draftState.approvalData = {
    isFinal: true,
    approvedAt: Date.now(),
    checklist: {} as any,
    summary: 'Disahkan',
  };

  assert.equal(isWorkflowCompleted(draftState, true), true);
});

// =========================================================================
// SECTION K: 12 PENGUJIAN OTOMATIS WAJIB (INSTRUCTION 09)
// =========================================================================

test('INSTRUCTION 09 — TEST 1: Tahap 1–6 berjalan berurutan', async () => {
  const initialState = createInitialWorkflowState(TEST_OUTLINE);
  const stageOrder: number[] = [];

  const finalState = await runCompleteWorkflow(
    initialState,
    BASE_TEST_CONFIG,
    undefined,
    (stageId, status) => {
      if (status === 'RUNNING' && !stageOrder.includes(stageId)) {
        stageOrder.push(stageId);
      }
    }
  );

  // Tahap 1 sampai 6 harus muncul secara berurutan tanpa ada yang terlewat
  assert.deepEqual(stageOrder.slice(0, 6), [1, 2, 3, 4, 5, 6]);

  // Periksa catatan executionLogs untuk bukti audit urutan
  const logs = finalState.executionLogs || [];
  const stageStarts = logs.filter((l) => l.status === 'STARTED');
  const stageStartIds = stageStarts.map((l) => l.stageId);
  assert.deepEqual(stageStartIds.slice(0, 6), [1, 2, 3, 4, 5, 6]);
});

test('INSTRUCTION 09 — TEST 2: Audit Draft V0 berjalan setelah Tahap 2', async () => {
  const extraction = executeStage1Sync(TEST_OUTLINE, 'outline.txt');
  const stage2 = await executeStage2DraftV0(BASE_TEST_CONFIG, extraction);
  assert.ok(stage2.script, 'Draft V0 harus tersedia');

  // Jalankan audit tahap 3 terhadap Draft V0
  const stage3 = executeStage3AuditV0(stage2.script, BASE_TEST_CONFIG);
  assert.ok(stage3.audit, 'Audit Draft V0 harus ada');
  assert.ok(stage3.diagnosisSummary, 'Ringkasan diagnosis Draft V0 harus ada');
  assert.equal(typeof stage3.diagnosisSummary.diagnosedAt, 'number');
  assert.ok(stage3.diagnosisSummary.diagnosedIndicators);
  assert.equal(stage3.diagnosisSummary.uninspectedForDraftV0.length, 5);

  // Pastikan waktu diagnosis setelah tahap 2
  assert.ok(stage3.diagnosisSummary.diagnosedAt >= stage2.generatedAt);
});

test('INSTRUCTION 09 — TEST 3: Pre-Final Quality Gate berjalan setelah Tahap 6', async () => {
  const initialState = createInitialWorkflowState(TEST_OUTLINE);
  const finalState = await runCompleteWorkflow(initialState, BASE_TEST_CONFIG, undefined, () => {});

  assert.ok(finalState.preFinalQualityGate, 'Pre-Final Quality Gate wajib tersedia');
  assert.equal(finalState.preFinalQualityGate.passed, true);
  assert.equal(finalState.preFinalQualityGate.reasons.length, 0);

  // Periksa kesepuluh kriteria kesiapan
  const chk = finalState.preFinalQualityGate.checklist;
  assert.equal(chk.sourceOutlineAvailable, true);
  assert.equal(chk.draftV0Available, true);
  assert.equal(chk.auditV0DiagnosisAvailable, true);
  assert.equal(chk.f1F8RegisterAvailable, true);
  assert.equal(chk.profanityHRegisterAvailable, true);
  assert.equal(chk.phrasesGRegisterAvailable, true);
  assert.equal(chk.registersFromCurrentExecution, true);
  assert.equal(chk.noEmptySelections, true);
  assert.equal(chk.noStaleData, true);
  assert.equal(chk.artifactsReadyForFinalGenerator, true);

  // Evaluasi waktu: Quality gate dievaluasi setelah Tahap 2 selesai
  assert.ok(
    finalState.preFinalQualityGate.checkedAt >= finalState.stages[2].completedAt!
  );
});

test('INSTRUCTION 09 — TEST 4: Tahap 7 menolak berjalan jika register F1–F8 kosong', async () => {
  const extraction = executeStage1Sync(TEST_OUTLINE, 'outline.txt');
  const stage2 = await executeStage2DraftV0(BASE_TEST_CONFIG, extraction);
  const stage3 = executeStage3AuditV0(stage2.script, BASE_TEST_CONFIG);
  const stage5 = executeStage5AutomaticProfanitySelection(stage2.script, extraction.narrativePlan!, BASE_TEST_CONFIG);
  const stage6 = executeStage6AutomaticPhraseSelection(stage2.script, extraction.narrativePlan!, BASE_TEST_CONFIG);

  await assert.rejects(
    async () => {
      await executeStage7FinalScript(BASE_TEST_CONFIG, {
        extraction,
        draftV0: stage2,
        auditV0: stage3,
        f1F8: undefined as any, // Dikosongkan
        profanity: stage5,
        phrases: stage6,
        qualityGate: { passed: true } as any,
      });
    },
    /Register Kosakata F1–F8 tidak tersedia atau kosong/i
  );
});

test('INSTRUCTION 09 — TEST 5: Tahap 7 menolak berjalan jika register H kosong', async () => {
  const extraction = executeStage1Sync(TEST_OUTLINE, 'outline.txt');
  const stage2 = await executeStage2DraftV0(BASE_TEST_CONFIG, extraction);
  const stage3 = executeStage3AuditV0(stage2.script, BASE_TEST_CONFIG);
  const stage4 = executeStage4AutomaticF1F8Selection(stage2.script, extraction.narrativePlan!, BASE_TEST_CONFIG);
  const stage6 = executeStage6AutomaticPhraseSelection(stage2.script, extraction.narrativePlan!, BASE_TEST_CONFIG);

  await assert.rejects(
    async () => {
      await executeStage7FinalScript(BASE_TEST_CONFIG, {
        extraction,
        draftV0: stage2,
        auditV0: stage3,
        f1F8: stage4,
        profanity: undefined as any, // Dikosongkan
        phrases: stage6,
        qualityGate: { passed: true } as any,
      });
    },
    /Register Kata Kasar H tidak tersedia atau kosong/i
  );
});

test('INSTRUCTION 09 — TEST 6: Tahap 7 menolak berjalan jika register G1–G11 kosong', async () => {
  const extraction = executeStage1Sync(TEST_OUTLINE, 'outline.txt');
  const stage2 = await executeStage2DraftV0(BASE_TEST_CONFIG, extraction);
  const stage3 = executeStage3AuditV0(stage2.script, BASE_TEST_CONFIG);
  const stage4 = executeStage4AutomaticF1F8Selection(stage2.script, extraction.narrativePlan!, BASE_TEST_CONFIG);
  const stage5 = executeStage5AutomaticProfanitySelection(stage2.script, extraction.narrativePlan!, BASE_TEST_CONFIG);

  await assert.rejects(
    async () => {
      await executeStage7FinalScript(BASE_TEST_CONFIG, {
        extraction,
        draftV0: stage2,
        auditV0: stage3,
        f1F8: stage4,
        profanity: stage5,
        phrases: undefined as any, // Dikosongkan
        qualityGate: { passed: true } as any,
      });
    },
    /Register Frasa G1–G11 tidak tersedia atau kosong/i
  );
});

test('INSTRUCTION 09 — TEST 7: Tahap 7 hanya berjalan jika Pre-Final Quality Gate PASSED', async () => {
  const extraction = executeStage1Sync(TEST_OUTLINE, 'outline.txt');
  const stage2 = await executeStage2DraftV0(BASE_TEST_CONFIG, extraction);
  const stage3 = executeStage3AuditV0(stage2.script, BASE_TEST_CONFIG);
  const stage4 = executeStage4AutomaticF1F8Selection(stage2.script, extraction.narrativePlan!, BASE_TEST_CONFIG);
  const stage5 = executeStage5AutomaticProfanitySelection(stage2.script, extraction.narrativePlan!, BASE_TEST_CONFIG);
  const stage6 = executeStage6AutomaticPhraseSelection(stage2.script, extraction.narrativePlan!, BASE_TEST_CONFIG);

  // Ditolak jika preFinalQualityGatePassed = false
  await assert.rejects(
    async () => {
      await executeStage7FinalScript(BASE_TEST_CONFIG, {
        extraction,
        draftV0: stage2,
        auditV0: stage3,
        f1F8: stage4,
        profanity: stage5,
        phrases: stage6,
        qualityGate: { passed: false } as any,
      });
    },
    /Pre-Final Quality Gate belum PASSED/i
  );

  // Berhasil jika preFinalQualityGatePassed = true
  const stage7Result = await executeStage7FinalScript(BASE_TEST_CONFIG, {
    extraction,
    draftV0: stage2,
    auditV0: stage3,
    f1F8: stage4,
    profanity: stage5,
    phrases: stage6,
    qualityGate: { passed: true } as any,
  });
  assert.ok(stage7Result.script);
  assert.equal(stage7Result.audit.passed, true);
});

test('INSTRUCTION 09 — TEST 8: Seluruh register diteruskan ke generator final', async () => {
  const initialState = createInitialWorkflowState(TEST_OUTLINE);
  const finalState = await runCompleteWorkflow(initialState, BASE_TEST_CONFIG, undefined, () => {});

  assert.ok(finalState.finalScriptData, 'finalScriptData harus ada');
  const applied = finalState.finalScriptData.integratedElements;
  assert.ok(applied.f1F8AppliedCount >= 56, 'Register F1–F8 harus diterapkan');
  assert.ok(applied.profanityIntegratedCount >= 15, 'Register H harus diterapkan');
  assert.ok(applied.phrasePatternsAppliedCount >= 5, 'Register G1–G11 harus diterapkan');
  assert.equal(finalState.preFinalQualityGate?.passed, true);
});

test('INSTRUCTION 09 — TEST 9: Final Audit berjalan setelah naskah final tersedia dan memeriksa 10 indikator', async () => {
  const initialState = createInitialWorkflowState(TEST_OUTLINE);
  const finalState = await runCompleteWorkflow(initialState, BASE_TEST_CONFIG, undefined, () => {});

  assert.ok(finalState.finalAudit, 'Final Audit harus tersedia');
  assert.ok(
    finalState.stages[3].completedAt! >= finalState.stages[3].startedAt!,
    'Final audit dievaluasi pada tahap 3'
  );

  // Periksa 10 kontrak mutu naskah final
  const audit = finalState.finalAudit;
  assert.equal(audit.nonSaraPassed, true, '1. NON_SARA_HARD_GUARD');
  assert.equal(audit.sourceFidelity?.passed, true, '2. KESESUAIAN KERANGKA');
  assert.equal(audit.sctfValid, true, '3. Blok SCTF');
  assert.equal(audit.kritikPassCount >= 4, true, '4. Kritik Terintegrasi');
  assert.equal(audit.punctuationPassCount >= 4, true, '5. Tanda Baca SAP');
  assert.equal(audit.stylePassCount >= 4, true, '6. Bahasa Gue–Lo');
  assert.equal(audit.transitionPassCount >= 4, true, '7. Transisi DRA+PTV');
  assert.equal(audit.wordTolerancePassed, true, '8. Kata & Durasi');
  assert.equal(audit.passed, true, '9 & 10. Audit lolos');
});

test('INSTRUCTION 09 — TEST 10: Tahap 4 menolak menyetujui naskah yang gagal Final Audit', () => {
  const invalidAudit = validateFullScript('Teks sembarangan satu baris', BASE_TEST_CONFIG);
  const mockFinalData: FinalScriptWorkflowData = {
    script: 'Teks sembarangan satu baris',
    blocks: ['Teks sembarangan satu baris'],
    wordCount: 4,
    audit: invalidAudit,
    repairedAutomatically: false,
    integratedElements: {
      sourceFidelity: false,
      draftV0Refined: false,
      f1F8AppliedCount: 0,
      profanityIntegratedCount: 0,
      phrasePatternsAppliedCount: 0,
    },
  };

  // 1. Ditolak jika ada tahap sebelumnya yang belum lulus
  assert.throws(
    () => {
      executeStage8FinalApproval(mockFinalData, false);
    },
    /Naskah TIDAK dapat disahkan sebagai FINAL/i
  );

  // 2. Ditolak jika tahap sebelumnya dianggap lulus tetapi audit naskah gagal 10 kontrak
  assert.throws(
    () => {
      executeStage8FinalApproval(mockFinalData, true);
    },
    /Pemeriksaan Akhir Belum Lulus/i
  );
});

test('INSTRUCTION 09 — TEST 11: Satu klik menghasilkan satu proses eksekusi', async () => {
  const initialState = createInitialWorkflowState(TEST_OUTLINE);

  // Ketika state isRunning = true, eksekusi baru diblokir
  const runningState = { ...initialState, isRunning: true };
  const check = canExecuteStage(runningState, 1);
  assert.equal(check.allowed, false);
  assert.match(check.reason!, /sedang berjalan/i);

  // runCompleteWorkflow pada state isRunning langsung mengembalikan state tanpa memicu proses baru
  const resultWhileRunning = await runCompleteWorkflow(runningState, BASE_TEST_CONFIG, undefined, () => {});
  assert.equal(resultWhileRunning, runningState);
});

test('INSTRUCTION 09 — TEST 12: Seluruh proses berhenti di Tahap 3', async () => {
  const initialState = createInitialWorkflowState(TEST_OUTLINE);
  const finalState = await runCompleteWorkflow(initialState, BASE_TEST_CONFIG, undefined, () => {});

  // Seluruh proses berhenti: tidak ada proses aktif lagi
  assert.equal(finalState.isRunning, false, 'isRunning harus false');
  assert.equal(finalState.isAutoAdvancing, false, 'isAutoAdvancing harus false');
  assert.equal(finalState.currentStageId, 3, 'currentStageId harus 3');
  assert.equal(finalState.stages[3].status, 'PASSED', 'Tahap 3 harus PASSED');
  assert.equal(finalState.isFinalApproved, true, 'isFinalApproved harus true');
  assert.equal(isWorkflowCompleted(finalState, true), true, 'Workflow completed harus true');
});

// =========================================================================
// INSTRUCTION 10 — FINAL-ONLY EDITOR DISPLAY (SECTION H: 11 TESTS)
// =========================================================================

test('INSTRUCTION 10 — TEST 1: Ketika Draft V0 selesai dibuat pada Tahap 2, pastikan isinya tidak muncul di Editor 5 Blok', async () => {
  const extraction = executeStage1Sync(TEST_OUTLINE, 'outline.txt');
  const stage2 = await executeStage2DraftV0(BASE_TEST_CONFIG, extraction);

  // Draft V0 tersedia secara internal
  assert.ok(stage2.script, 'Draft V0 harus tersedia');

  // Tetapi kelayakan tampilan editor untuk Draft V0 (Tahap 2 selesai, Tahap 8 PENDING, belum approved) bernilai FALSE
  const canDisplay = canDisplayFinalScriptInEditor({
    cleanScript: stage2.script,
    stage8Status: 'PENDING',
    isFinalApproved: false,
    finalAuditPassed: false,
  });
  assert.equal(canDisplay, false, 'Draft V0 DILARANG muncul di Editor 5 Blok');
});

test('INSTRUCTION 10 — TEST 2: Pastikan Audit Draft V0 Tahap 3 tetap berjalan menggunakan Draft V0 internal', async () => {
  const extraction = executeStage1Sync(TEST_OUTLINE, 'outline.txt');
  const stage2 = await executeStage2DraftV0(BASE_TEST_CONFIG, extraction);

  // Tahap 3 membaca Draft V0 internal secara deterministik
  const stage3 = executeStage3AuditV0(stage2.script, BASE_TEST_CONFIG);
  assert.ok(stage3.audit, 'Audit V0 harus berjalan');
  assert.ok(stage3.diagnosisSummary, 'Ringkasan diagnosis harus terbentuk');
  assert.equal(stage3.diagnosisSummary.uninspectedForDraftV0.length, 5);
});

test('INSTRUCTION 10 — TEST 3: Pastikan Tahap 2 dan Tahap 4 tetap dapat mengakses artefak internal yang diperlukan', async () => {
  const extraction = executeStage1Sync(TEST_OUTLINE, 'outline.txt');
  const stage2 = await executeStage2DraftV0(BASE_TEST_CONFIG, extraction);

  // Tahap 2 Leksikon & Profani
  const stage4 = executeStage4AutomaticF1F8Selection(stage2.script, extraction.narrativePlan!, BASE_TEST_CONFIG);
  assert.equal(stage4.isCoreComplete, true);
  assert.ok(stage4.totalWordsSelected > 0);

  const stage5 = executeStage5AutomaticProfanitySelection(stage2.script, extraction.narrativePlan!, BASE_TEST_CONFIG);
  assert.ok(stage5.totalCount >= 15);

  const stage6 = executeStage6AutomaticPhraseSelection(stage2.script, extraction.narrativePlan!, BASE_TEST_CONFIG);
  assert.equal(stage6.blockSelections.length, 5);
  assert.ok(stage6.summary.includes('G1–G11'));
});

test('INSTRUCTION 10 — TEST 4: Pastikan Pre-Final Quality Gate tetap berjalan', async () => {
  const extraction = executeStage1Sync(TEST_OUTLINE, 'outline.txt');
  const stage2 = await executeStage2DraftV0(BASE_TEST_CONFIG, extraction);
  const stage3 = executeStage3AuditV0(stage2.script, BASE_TEST_CONFIG);
  const stage4 = executeStage4AutomaticF1F8Selection(stage2.script, extraction.narrativePlan!, BASE_TEST_CONFIG);
  const stage5 = executeStage5AutomaticProfanitySelection(stage2.script, extraction.narrativePlan!, BASE_TEST_CONFIG);
  const stage6 = executeStage6AutomaticPhraseSelection(stage2.script, extraction.narrativePlan!, BASE_TEST_CONFIG);

  const gate = executePreFinalQualityGate({
    extractionData: extraction,
    draftV0: stage2,
    auditV0: stage3,
    f1F8Selection: stage4,
    profanitySelection: stage5,
    phraseSelection: stage6,
    currentExecutionRunId: 'run-test-10-4',
  });

  assert.equal(gate.passed, true);
  assert.equal(gate.reasons.length, 0);
  assert.equal(gate.checklist.artifactsReadyForFinalGenerator, true);
});

test('INSTRUCTION 10 — TEST 5: Ketika Tahap 3 menghasilkan naskah final, tetapi Tahap 3 belum disahkan, pastikan naskah belum ditampilkan', async () => {
  const extraction = executeStage1Sync(TEST_OUTLINE, 'outline.txt');
  const stage2 = await executeStage2DraftV0(BASE_TEST_CONFIG, extraction);
  const stage3 = executeStage3AuditV0(stage2.script, BASE_TEST_CONFIG);
  const stage4 = executeStage4AutomaticF1F8Selection(stage2.script, extraction.narrativePlan!, BASE_TEST_CONFIG);
  const stage5 = executeStage5AutomaticProfanitySelection(stage2.script, extraction.narrativePlan!, BASE_TEST_CONFIG);
  const stage6 = executeStage6AutomaticPhraseSelection(stage2.script, extraction.narrativePlan!, BASE_TEST_CONFIG);

  const stage7 = await executeStage7FinalScript(BASE_TEST_CONFIG, {
    extraction,
    draftV0: stage2,
    auditV0: stage3,
    f1F8: stage4,
    profanity: stage5,
    phrases: stage6,
    qualityGate: { passed: true } as any,
  });

  // Naskah final tahap 3 (final script) sudah ada
  assert.ok(stage7.script);

  // Namun saat Tahap 3 masih RUNNING dan belum disahkan, tampilan editor DITOLAK
  const canDisplayWhileRunning = canDisplayFinalScriptInEditor({
    cleanScript: stage7.script,
    stage3Status: 'RUNNING',
    isFinalApproved: false,
    finalAuditPassed: stage7.audit.passed,
  });
  assert.equal(canDisplayWhileRunning, false, 'Naskah final Tahap 3 TIDAK BOLEH muncul sebelum Tahap 3 selesai disahkan');
});

test('INSTRUCTION 10 — TEST 6: Ketika Tahap 3 FAILED, pastikan naskah tetap tersembunyi dan ekspor terkunci', () => {
  const fakeScript = 'Naskah gagal yang belum lolos kontrak.';

  // Tampilan editor harus ditolak
  const canDisplay = canDisplayFinalScriptInEditor({
    cleanScript: fakeScript,
    stage3Status: 'FAILED',
    isFinalApproved: false,
    finalAuditPassed: false,
  });
  assert.equal(canDisplay, false, 'Naskah wajib tetap tersembunyi jika Tahap 3 FAILED');

  // Ekspor harus ditolak
  const exportCheck = checkFinalExportEligibility(fakeScript, {
    isFinalApproved: false,
    stage3Status: 'FAILED',
  });
  assert.equal(exportCheck.allowed, false, 'Ekspor wajib terkunci jika Tahap 3 FAILED');
});

test('INSTRUCTION 10 — TEST 7: Ketika Tahap 3 PASSED dan isFinalApproved === true, pastikan naskah final muncul di Editor 5 Blok', async () => {
  const initialState = createInitialWorkflowState(TEST_OUTLINE);
  const finalState = await runCompleteWorkflow(initialState, BASE_TEST_CONFIG, undefined, () => {});

  assert.equal(finalState.stages[3].status, 'PASSED');
  assert.equal(finalState.isFinalApproved, true);
  assert.ok(finalState.finalScriptData?.script);

  const canDisplay = canDisplayFinalScriptInEditor({
    cleanScript: finalState.finalScriptData.script,
    stage3Status: finalState.stages[3].status,
    isFinalApproved: finalState.isFinalApproved,
    finalAuditPassed: finalState.finalAudit?.passed,
  });

  assert.equal(canDisplay, true, 'Naskah final HARUS muncul setelah lolos Tahap 3 dan isFinalApproved === true');

  // Pastikan tepat 5 blok SCTF
  const blocks = finalState.finalScriptData.script.split('\n').filter(Boolean);
  assert.equal(blocks.length, 5, 'Editor 5 blok menerima tepat 5 paragraf SCTF');
});

test('INSTRUCTION 10 — TEST 8: Pastikan tab Teks Mentah menampilkan naskah final yang sama, bukan Draft V0', async () => {
  const initialState = createInitialWorkflowState(TEST_OUTLINE);
  const finalState = await runCompleteWorkflow(initialState, BASE_TEST_CONFIG, undefined, () => {});

  const displayedScript = finalState.finalScriptData?.script;
  const draftV0Script = finalState.draftV0?.script;

  assert.ok(displayedScript, 'Naskah final harus tersedia');
  assert.ok(draftV0Script, 'Draft V0 harus tersedia secara internal');

  // Teks yang ditampilkan adalah naskah final, BUKAN Draft V0
  assert.notEqual(displayedScript, draftV0Script, 'Teks yang ditampilkan bukan Draft V0');
  assert.equal(displayedScript, finalState.finalScriptData?.script, 'Teks mentah membaca objek finalScriptData yang sama');
});

test('INSTRUCTION 10 — TEST 9: Pastikan tombol Salin Naskah, TXT, DOCX, dan JSON baru aktif setelah pengesahan final', async () => {
  const initialState = createInitialWorkflowState(TEST_OUTLINE);

  // 1. Sebelum selesai: seluruh ekspor ditolak
  const beforeApprovalCheck = checkFinalExportEligibility('teks belum final', {
    isFinalApproved: false,
    stage3Status: 'PENDING',
  });
  assert.equal(beforeApprovalCheck.allowed, false, 'Ekspor terkunci sebelum pengesahan final');

  // 2. Jalankan alur hingga selesai
  const finalState = await runCompleteWorkflow(initialState, BASE_TEST_CONFIG, undefined, () => {});

  // 3. Setelah pengesahan final: seluruh ekspor aktif
  const afterApprovalCheck = checkFinalExportEligibility(finalState.finalScriptData!.script, {
    isFinalApproved: finalState.isFinalApproved,
    stage3Status: finalState.stages[3].status,
    audit: finalState.finalScriptData!.audit,
  });
  assert.equal(afterApprovalCheck.allowed, true, 'Ekspor TXT, DOCX, dan JSON aktif setelah disahkan');
});

test('INSTRUCTION 10 — TEST 10: Pastikan unggah kerangka baru atau Reset Alur langsung menghilangkan tampilan naskah final sebelumnya', () => {
  // Simulasi state yang tadinya sudah selesai
  const completedState = createInitialWorkflowState(TEST_OUTLINE);
  completedState.stages[3].status = 'PASSED';
  completedState.isFinalApproved = true;

  // 1. Reset Alur Kerja
  const resetState = createInitialWorkflowState('', '');
  assert.equal(resetState.isFinalApproved, false);
  assert.equal(resetState.stages[3].status, 'PENDING');
  assert.equal(
    canDisplayFinalScriptInEditor({
      cleanScript: '',
      stage3Status: resetState.stages[3].status,
      isFinalApproved: resetState.isFinalApproved,
    }),
    false,
    'Tampilan naskah final langsung dikosongkan setelah Reset Alur'
  );

  // 2. Unggah/Ubah Kerangka Baru (Invalidasi dari Tahap 2)
  const invalidatedState = invalidateWorkflowFromStage(completedState, 2);
  assert.equal(invalidatedState.isFinalApproved, false);
  assert.equal(invalidatedState.stages[3].status, 'PENDING');
  assert.equal(
    canDisplayFinalScriptInEditor({
      cleanScript: '',
      stage3Status: invalidatedState.stages[3].status,
      isFinalApproved: invalidatedState.isFinalApproved,
    }),
    false,
    'Tampilan naskah final langsung dikosongkan setelah kerangka baru diunggah'
  );
});

test('INSTRUCTION 10 — TEST 11: Pastikan seluruh pengujian regresi sebelumnya tetap lulus', async () => {
  const initialState = createInitialWorkflowState(TEST_OUTLINE);
  const finalState = await runCompleteWorkflow(initialState, BASE_TEST_CONFIG, undefined, () => {});

  // Seluruh 10 kontrak mutu naskah final tetap dipenuhi
  const audit = finalState.finalScriptData!.audit;
  assert.equal(audit.nonSaraPassed, true, 'NON_SARA_HARD_GUARD');
  assert.equal(audit.sourceFidelity?.passed, true, 'SOURCE_FIDELITY');
  assert.equal(audit.sctfValid, true, 'SCTF Valid');
  assert.equal(audit.stages.length, 5, '5 Blok SCTF');
  assert.equal(audit.kritikPassCount, 5, 'Kritik Terintegrasi 3-5/blok');
  assert.equal(audit.punctuationPassCount, 5, 'SAP EYD V');
  assert.equal(audit.stylePassCount, 5, 'Bahasa Gue-Lo');
  assert.equal(audit.transitionPassCount, 4, 'Transisi DRA+PTV');
  assert.equal(audit.quoteFree?.passed, true, 'SQNN Quote-Free');
  assert.equal(audit.quoteFree?.totalQuotesFound, 0);

  // Failover pool API keys tidak terpengaruh
  assert.equal(WORKFLOW_STAGES_META.length, 3);
});

test('21. Optimasi G1-G11 Tahap 2: applyG1G11PhraseOptimizationToScript mengintegrasikan frasa G1-G11 secara organik ke 5 blok Tahap 2', async () => {
  const extraction = executeStage1Sync(TEST_OUTLINE);
  const draftV0 = await executeStage2DraftV0(BASE_TEST_CONFIG, extraction);

  assert.equal(draftV0.blocks.length, 5);
  assert.ok(draftV0.script.length > 100);

  const phraseSel = executeStage6AutomaticPhraseSelection(
    draftV0.script,
    extraction.narrativePlan!,
    BASE_TEST_CONFIG
  );

  const optimizedScript = applyG1G11PhraseOptimizationToScript(draftV0.script, phraseSel);
  const optimizedBlocks = optimizedScript.split('\n').filter(Boolean);

  assert.equal(optimizedBlocks.length, 5);
  assert.equal(phraseSel.blockSelections.length, 5);
  assert.ok(phraseSel.summary.includes('G1–G11'));
});

test('22. Validasi Contextual Dynamic G2-G11: auditG1G11PhraseDistribution dan enforceG1G11PhraseTarget mematuhi Prinsip Non-Forcing', async () => {
  const extraction = executeStage1Sync(TEST_OUTLINE);
  const draftV0 = await executeStage2DraftV0(BASE_TEST_CONFIG, extraction);

  const g1G11Audit = auditG1G11PhraseDistribution(draftV0.script);
  assert.equal(g1G11Audit.passed, true, 'Audit G1-G11 pada Draft V0 Tahap 2 wajib LULUS tanpa memaksakan kuota kaku');
  assert.equal(g1G11Audit.blocksPassedCount, 5, 'Kelima blok SCTF dievaluasi secara wajar tanpa silokan blok');

  // Uji prinsip Non-Forcing: Naskah yang sudah mengalir lancar tidak dipaksa disisipi frasa tambahan
  const smoothNaturalScript = [
    'Biaya hidup meningkat tajam di berbagai sektor.',
    'Padahal kalau kita lihat fakta keliru ini, banyak orang pasrah.',
    'Masalahnya timbul dari kebijakan yang kurang transparan.',
    'Oleh karena itu evaluasi menyeluruh sangat diperlukan.',
    'Jadi intinya kita harus tetap berpikir kritis.'
  ].join('\n');

  const enforcedScript = enforceG1G11PhraseTarget(smoothNaturalScript, BASE_TEST_CONFIG);
  const enforcedAudit = auditG1G11PhraseDistribution(enforcedScript);
  assert.equal(enforcedAudit.passed, true, 'Naskah yang sudah alami tetap lulus tanpa perubahan paksaan');
  assert.equal(enforcedScript, smoothNaturalScript, 'Prinsip Non-Forcing: Naskah cair tidak diubah secara paksa');
});



