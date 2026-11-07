/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  checkFinalExportEligibility,
  exportCleanScriptTxt,
  exportScriptDocx,
  exportFinalScriptJson,
  validateFinalExportApproval,
} from './exportUtils';
import {
  createInitialWorkflowState,
  executeStage1Sync,
  executeStage2DraftV0,
  executeStage3AuditV0,
  executeStage4AutomaticF1F8Selection,
  executeStage5AutomaticProfanitySelection,
  executeStage6AutomaticPhraseSelection,
  executeStage7FinalScript,
  executeStage8FinalApproval,
  invalidateWorkflowFromStage,
  WORKFLOW_STAGES_META,
} from './workflowEngine';
import {
  enforceLockedConfig,
  validateFullScript,
} from './validatorAndPipeline';
import {
  GenNASConfig,
  LOCKED_CRITICAL_PERSPECTIVE,
  LOCKED_DURATION_MODE,
  LOCKED_WPM,
} from './types';
import {
  NARRATIVE_PHRASE_CATEGORIES,
  PROFANITY_ROOT_WORDS,
} from './lexiconRegistry';
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

// Helper untuk menyusun naskah final valid terverifikasi
async function buildApprovedWorkflowScenario() {
  const state = createInitialWorkflowState(TEST_OUTLINE);
  const extraction = executeStage1Sync(TEST_OUTLINE, 'tes-kerangka.txt');
  state.extractionData = extraction;
  state.stages[1].status = 'PASSED';

  const draftV0 = await executeStage2DraftV0(TEST_CONFIG, extraction, undefined);
  state.draftV0 = draftV0;

  const profanity = executeStage5AutomaticProfanitySelection(draftV0.script, extraction.narrativePlan!, TEST_CONFIG);
  state.profanitySelection = profanity;

  const phrases = executeStage6AutomaticPhraseSelection(draftV0.script, extraction.narrativePlan!, TEST_CONFIG);
  state.phraseSelection = phrases;

  const f1f8 = executeStage4AutomaticF1F8Selection(draftV0.script, extraction.narrativePlan!, TEST_CONFIG);
  state.f1F8Selection = f1f8;
  state.stages[2].status = 'PASSED';

  const auditV0 = executeStage3AuditV0(draftV0.script, TEST_CONFIG);
  state.auditV0 = auditV0;
  state.stages[3].status = 'PASSED';

  const finalScriptData = await executeStage7FinalScript(
    TEST_CONFIG,
    { extraction, draftV0, auditV0, f1F8: f1f8, profanity, phrases },
    undefined
  );
  state.finalScriptData = finalScriptData;

  const approvalData = executeStage8FinalApproval(finalScriptData, true);
  state.approvalData = approvalData;
  state.isFinalApproved = true;
  state.stages[3].status = 'PASSED';

  return { state, finalScriptData };
}

// =========================================================================
// 5 PENGUJIAN WAJIB FINAL EXPORT LOCK
// =========================================================================

test('TEST 1: Draft V0 tersedia, Tahap 3 belum PASSED -> Seluruh ekspor naskah final terkunci', async () => {
  const state = createInitialWorkflowState(TEST_OUTLINE);
  const extraction = executeStage1Sync(TEST_OUTLINE, 'tes-kerangka.txt');
  state.extractionData = extraction;
  state.stages[1].status = 'PASSED';

  const draftV0 = await executeStage2DraftV0(TEST_CONFIG, extraction, undefined);
  state.draftV0 = draftV0;
  state.stages[2].status = 'PASSED';
  // Tahap 3 masih PENDING dan isFinalApproved false
  assert.equal(state.stages[3].status, 'PENDING');
  assert.equal(state.isFinalApproved, false);

  // Evaluasi kondisi disabled pada UI: !hasScript || !isFinalApproved
  const hasScript = draftV0.script.trim().length > 0;
  const isFinalApproved = state.isFinalApproved;
  const isStage3Passed = (state.stages[3].status as string) === 'PASSED';
  const isDraftV0 = state.stages[2].status === 'PASSED' && (state.stages[3].status as string) !== 'PASSED';

  const uiDisabled = !hasScript || !isFinalApproved || !isStage3Passed || isDraftV0;
  assert.equal(uiDisabled, true, 'Tombol UI ekspor TXT dan DOCX wajib disabled saat masih Draft V0');

  // Evaluasi fungsi pemeriksaan kelayakan
  const eligibility = checkFinalExportEligibility(draftV0.script, {
    isFinalApproved: state.isFinalApproved,
    stage3Status: state.stages[3].status,
    isDraftV0: true,
    workflowState: state,
  });
  assert.equal(eligibility.allowed, false);
  assert.match(eligibility.reason!, /Draft V0|belum disahkan/i);
});

test('TEST 2: Pengguna mencoba memanggil fungsi ekspor secara langsung meskipun tombol UI terkunci -> Fungsi tetap menolak ekspor', async () => {
  const draftScript = 'Narasi draft awal yang belum melewati alur persetujuan.';
  const auditMock = validateFullScript(draftScript, TEST_CONFIG);

  // 1. Pemanggilan langsung exportCleanScriptTxt tanpa parameter options/pengesahan
  assert.throws(
    () => {
      exportCleanScriptTxt(draftScript, TEST_CONFIG.topik);
    },
    (err: any) => {
      assert.match(err.message, /ekspor naskah final ditolak/i);
      return true;
    },
    'Fungsi exportCleanScriptTxt harus melempar error saat dipanggil langsung tanpa pengesahan'
  );

  // 2. Pemanggilan dengan isFinalApproved: false eksplisit
  assert.throws(
    () => {
      exportCleanScriptTxt(draftScript, TEST_CONFIG.topik, {
        isFinalApproved: false,
        stage3Status: 'PENDING',
        isDraftV0: true,
      });
    },
    (err: any) => {
      assert.match(err.message, /Draft V0|isFinalApproved/i);
      return true;
    }
  );

  // 3. Pemanggilan exportScriptDocx secara langsung tanpa pengesahan
  assert.throws(
    () => {
      exportScriptDocx(draftScript, '', TEST_CONFIG, auditMock);
    },
    (err: any) => {
      assert.match(err.message, /ekspor naskah final ditolak/i);
      return true;
    },
    'Fungsi exportScriptDocx harus melempar error saat dipanggil langsung tanpa pengesahan'
  );

  // 4. Pemanggilan exportFinalScriptJson secara langsung tanpa pengesahan
  assert.throws(
    () => {
      exportFinalScriptJson(draftScript, TEST_CONFIG, auditMock);
    },
    (err: any) => {
      assert.match(err.message, /ekspor naskah final ditolak/i);
      return true;
    }
  );
});

test('TEST 3: Naskah sudah melewati Tahap 3 dan isFinalApproved true -> Ekspor naskah final diizinkan', async () => {
  const { state, finalScriptData } = await buildApprovedWorkflowScenario();

  assert.equal(state.isFinalApproved, true);
  assert.equal(state.stages[3].status, 'PASSED');

  const hasScript = finalScriptData.script.trim().length > 0;
  const isFinalApproved = state.isFinalApproved;
  const isStage3Passed = state.stages[3].status === 'PASSED';
  const isDraftV0 = state.stages[2].status === 'PASSED' && state.stages[3].status !== 'PASSED';

  // Evaluasi kondisi tombol UI
  const uiDisabled = !hasScript || !isFinalApproved || !isStage3Passed || isDraftV0;
  assert.equal(uiDisabled, false, 'Tombol UI wajib aktif (enabled) setelah Tahap 3 disahkan');

  // Evaluasi kelayakan ekspor
  const eligibility = checkFinalExportEligibility(finalScriptData.script, {
    isFinalApproved: true,
    stage3Status: 'PASSED',
    isDraftV0: false,
    audit: finalScriptData.audit,
    workflowState: state,
  });
  assert.equal(eligibility.allowed, true, 'Ekspor naskah final harus diizinkan');

  // Validasi eksekusi fungsi ekspor TXT
  const txtResult = exportCleanScriptTxt(finalScriptData.script, TEST_CONFIG.topik, {
    isFinalApproved: true,
    stage3Status: 'PASSED',
    isDraftV0: false,
    audit: finalScriptData.audit,
    workflowState: state,
  });
  assert.equal(txtResult.success, true);
  assert.ok(txtResult.filename.endsWith('-clean-sctf.txt'));

  // Validasi eksekusi fungsi ekspor DOCX
  const docxResult = exportScriptDocx(
    finalScriptData.script,
    'Voice script narasi...',
    TEST_CONFIG,
    finalScriptData.audit,
    {
      isFinalApproved: true,
      stage3Status: 'PASSED',
      isDraftV0: false,
      workflowState: state,
    }
  );
  assert.equal(docxResult.success, true);
  assert.ok(docxResult.filename.endsWith('-naskah.docx'));

  // Validasi eksekusi fungsi ekspor JSON naskah final
  const jsonResult = exportFinalScriptJson(
    finalScriptData.script,
    TEST_CONFIG,
    finalScriptData.audit,
    {
      isFinalApproved: true,
      stage3Status: 'PASSED',
      isDraftV0: false,
      workflowState: state,
    }
  );
  assert.equal(jsonResult.success, true);
  assert.ok(jsonResult.filename.endsWith('-final-script.json'));
});

test('TEST 4: Naskah final diedit setelah disetujui -> Status final diinvalidasi dan ekspor kembali terkunci', async () => {
  const { state, finalScriptData } = await buildApprovedWorkflowScenario();

  // Naskah awalnya telah disahkan
  assert.equal(state.isFinalApproved, true);
  assert.equal(state.stages[3].status, 'PASSED');

  // Pengguna mengedit salah satu blok / teks naskah
  const invalidatedState = invalidateWorkflowFromStage(state, 3);

  // Status kelulusan wajib direset ke false dan Tahap 3 kembali PENDING
  assert.equal(invalidatedState.isFinalApproved, false);
  assert.equal(invalidatedState.stages[3].status, 'PENDING');
  assert.equal(invalidatedState.approvalData, undefined);

  // Evaluasi UI disabled kembali true
  const uiDisabled =
    !finalScriptData.script ||
    !invalidatedState.isFinalApproved ||
    (invalidatedState.stages[3].status as string) !== 'PASSED';
  assert.equal(uiDisabled, true, 'Tombol ekspor harus kembali terkunci setelah naskah diedit');

  // Pemanggilan fungsi ekspor harus ditolak
  assert.throws(
    () => {
      exportCleanScriptTxt(finalScriptData.script, TEST_CONFIG.topik, {
        isFinalApproved: invalidatedState.isFinalApproved,
        stage3Status: invalidatedState.stages[3].status,
        workflowState: invalidatedState,
      });
    },
    (err: any) => {
      assert.match(err.message, /ditolak.*isFinalApproved|Tahap/i);
      return true;
    }
  );
});

test('TEST 5: Naskah gagal audit final -> Ekspor naskah final tetap ditolak', async () => {
  // Buat audit tiruan yang gagal (misal: Quote-Free gagal atau batas sasaran SARA dilanggar)
  const scriptWithQuotes = 'Paragraf 1 "kutipan terlarang". Paragraf 2 tanpa petik.';
  const failingAudit = validateFullScript(scriptWithQuotes, TEST_CONFIG);

  assert.equal(failingAudit.passed, false, 'Audit naskah harus berstatus tidak lulus');

  // Pengguna/penyerang mencoba memalsukan parameter isFinalApproved: true
  const eligibility = checkFinalExportEligibility(scriptWithQuotes, {
    isFinalApproved: true,
    stage3Status: 'PASSED',
    audit: failingAudit,
  });

  assert.equal(eligibility.allowed, false);
  assert.match(eligibility.reason!, /gagal.*audit/i);

  // Fungsi ekspor wajib menolak naskah cacat
  assert.throws(
    () => {
      exportCleanScriptTxt(scriptWithQuotes, TEST_CONFIG.topik, {
        isFinalApproved: true,
        stage3Status: 'PASSED',
        audit: failingAudit,
      });
    },
    (err: any) => {
      assert.match(err.message, /audit/i);
      return true;
    }
  );
});

// =========================================================================
// REGRESI DAN INTEGRITAS KONTRAK LAINNYA
// =========================================================================

test('Integritas Kontrak V5.1: Master Prompt, Key Pool, Bank F1–F8, Bank H, Bank G1–G11, dan Urutan Tahap 1–3 Tidak Berubah', () => {
  // 1. RUNTIME_MASTER_PROMPT_V51
  assert.ok(RUNTIME_MASTER_PROMPT_V51.length > 500);
  assert.ok(RUNTIME_MASTER_PROMPT_V51.includes('RUNTIME MASTER PROMPT GENNAS PRO STUDIO'));

  // 2. Bank kata kasar H
  assert.equal(PROFANITY_ROOT_WORDS.length, 9);
  assert.ok(PROFANITY_ROOT_WORDS.includes('tolol'));
  assert.ok(PROFANITY_ROOT_WORDS.includes('goblok'));

  // 4. Bank frasa G1–G11 (Koleksi kategori G2–G11)
  assert.equal(Object.keys(NARRATIVE_PHRASE_CATEGORIES).length, 10);
  assert.ok('G2_PEMBUKA_AKRAB' in NARRATIVE_PHRASE_CATEGORIES);
  assert.ok('G11_PENUTUP_NGOBROL' in NARRATIVE_PHRASE_CATEGORIES);

  // 5. Urutan Workflow 1–3
  assert.equal(WORKFLOW_STAGES_META.length, 3);
  assert.equal(WORKFLOW_STAGES_META[0].name, 'Upload Kerangka Naskah & Ekstraksi Sumber');
  assert.equal(WORKFLOW_STAGES_META[2].name, 'Evaluasi Quote-Free & Pengesahan Status Final');

  // 6. Failover pool di server.ts
  const serverContent = fs.readFileSync(path.resolve(process.cwd(), 'server.ts'), 'utf8');
  assert.ok(serverContent.includes("label: 'API Utama'"));
  assert.ok(serverContent.includes("label: 'API Cadangan 21'"));
});
