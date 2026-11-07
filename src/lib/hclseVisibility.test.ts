import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  runHybridContextualLexiconSelectionEngine,
  finalizeHCLSEAuditForScript,
} from './hybridContextualLexiconSelectionEngine';
import { executeStage2DraftV0, executeStage3AuditV0 } from './workflowEngine';
import { enforceLockedConfig, inferTopicFromOutline } from './validatorAndPipeline';

describe('HCLSE VISIBILITY & LIVE MONITOR INTEGRATION TESTS (V6.2.1)', () => {
  const sampleOutline = `
    Topik Utama: Penyalahgunaan Kekuasaan Berkedok Agama
    1. Hook: Banyak pihak memanfaatkan narasi suci untuk membungkam kebenaran.
    2. Akar Masalah: Pengikut sering menelan mentah-mentah tanpa berani membantah.
    3. Inti Masalah: Pemimpin memanfaatkan rasa takut jamaah demi kepentingan pribadi.
    4. Solusi: Masyarakat harus kritis dan berani mempertanyakan setiap klaim dogmatis.
    5. Kesimpulan: Jangan biarkan norma suci dijadikan alat legitimasi politik partisan.
  `.trim();

  test('1. Tahap 2 menghasilkan hclseAudit terstruktur pada return data workflow', async () => {
    const config = enforceLockedConfig({
      topik: 'Penyalahgunaan Kekuasaan',
      konteks: 'Perilaku & Pola Pikir Masyarakat (Non-SARA)',
      faktaTerverifikasi: sampleOutline,
      durasiMenit: 2,
      wpm: 135,
      modeDurasi: 'FLEKSIBEL',
      jumlahBlok: 5,
      struktur: [8, 17, 45, 20, 10],
      operasi: 'NASKAH_FINAL',
      allowEditorialRewrite: true,
      judulOutput: false,
      primaryModel: 'gemini-2.5-flash',
      fallbackModel: 'gemini-1.5-flash',
    });

    const extractionData = {
      extractedText: sampleOutline,
      wordCount: 50,
      charCount: 300,
      inferredTopic: 'Penyalahgunaan Kekuasaan',
      protectedTokens: [],
      protectedTokenItems: [],
      integrityStatus: 'VALID' as const,
      narrativePlan: {
        main_topic: 'Penyalahgunaan Kekuasaan',
        central_thesis: 'Masyarakat harus kritis',
        key_arguments: ['Sering membungkam kebenaran', 'Memanfaatkan rasa takut'],
        supporting_evidence: [],
        source_references: [],
        storyflow_plan: [],
        unresolved_claims: [],
        target_word_count: 270,
        wpm: 135,
        duration_minutes: 2,
        locked_perspective_boundary: 'Perilaku & Pola Pikir Masyarakat (Non-SARA)',
      },
    };

    const draft = await executeStage2DraftV0(config, extractionData as any);

    assert.ok(draft.hclseAudit, 'Draft V0 Tahap 2 wajib menyertakan hclseAudit');
    assert.ok(typeof draft.hclseAudit.totalConsidered === 'number', 'totalConsidered harus berupa angka');
    assert.ok(typeof draft.hclseAudit.totalSelectedSupabase === 'number', 'totalSelectedSupabase harus berupa angka');
    assert.ok(typeof draft.hclseAudit.totalSelectedGlobalInformal === 'number', 'totalSelectedGlobalInformal harus berupa angka');
    assert.ok(typeof draft.hclseAudit.totalRejected === 'number', 'totalRejected harus berupa angka');
  });

  test('2. Statistik Supabase, Global Informal, dan Kandidat Ditolak tercatat presisi', () => {
    const customOutline = sampleOutline + '\nPengikut merasa kecewa dan menggerutu atas kebohongan pemimpin.';
    const script = [
      'Banyak orang tergiur narasi instan padahal itu manipulasi.',
      'Ketika dibilangin mereka malah membantah padahal jelas salah. Dia menggerutu karena kecewa.',
      'Pemimpin manfaatin posisi untuk kepentingan sendiri.',
      'Kita harus kritis dan gak gampang percaya gitu aja.',
      'Kebenaran harus ditegakkan tanpa kompromi.',
    ].join('\n');

    const result = runHybridContextualLexiconSelectionEngine({
      script,
      topic: 'Manipulasi Narasi',
      outline: customOutline,
    });

    const audit = result.auditTraceability;

    assert.ok(audit.totalConsidered >= 1, 'Total kandidat dievaluasi > 0');
    assert.ok(audit.totalSelectedSupabase >= 1, 'Path A Supabase harus mendeteksi entri seperti ngebantah');
    assert.ok(audit.totalSelectedGlobalInformal >= 1, 'Path B Global Informal harus mendeteksi entri seperti ngedumel');
    assert.ok(audit.totalRejected >= 1, 'Kandidat tidak cocok seperti dibilangin harus masuk kategori ditolak');
  });

  test('3. Struktur Data 5 Tab Audit Blok lengkap dan dapat diakses', () => {
    const script = `
      Gue mau bahas soal manipulasi opini publik di media sosial.
      Padahal sudah jelas tapi mereka malah ngebantah bukannya mikir.
      Akhirnya dia cuma ngedumel sendiri tanpa solusi nyata.
      Makanya kita perlu sadar dan gak mau dimanfaatin lagi.
      Ujung-ujungnya kebenaran yang bakal menang.
    `;

    const result = runHybridContextualLexiconSelectionEngine({
      script,
      topic: 'Manipulasi Opini',
      outline: sampleOutline,
    });

    const audit = result.auditTraceability;

    for (let b = 1; b <= 5; b++) {
      const block = audit.blockBreakdown[b];
      assert.ok(block, `Block ${b} breakdown harus ada`);
      assert.equal(block.blockId, b, `Block ID harus ${b}`);
      assert.ok(Array.isArray(block.considered), `considered pada Blok ${b} harus berupa Array`);
      assert.ok(Array.isArray(block.selectedSupabase), `selectedSupabase pada Blok ${b} harus berupa Array`);
      assert.ok(Array.isArray(block.selectedGlobalInformal), `selectedGlobalInformal pada Blok ${b} harus berupa Array`);
      assert.ok(Array.isArray(block.rejected), `rejected pada Blok ${b} harus berupa Array`);
      assert.ok(typeof block.wordFrequencies === 'object', `wordFrequencies pada Blok ${b} harus berupa Object`);
    }
  });

  test('4. Perhitungan frekuensi kata berulang pada naskah final', () => {
    const script = `
      Malah malah malah karena karena ternyata ternyata ternyata ternyata.
      Gue tau lo gak suka tapi emang gitu kenyataannya.
    `;

    const dummyAudit = {
      topic: 'Uji Frekuensi',
      evaluatedAt: new Date().toISOString(),
      totalConsidered: 5,
      totalSelectedSupabase: 3,
      totalSelectedGlobalInformal: 1,
      totalRejected: 1,
      uniqueWordCount: 0,
      wordFrequencies: {},
      blockBreakdown: {},
      candidatesLog: [{ candidateWord: 'malah', status: 'SELECTED_SUPABASE' as const }],
    };

    const audit = finalizeHCLSEAuditForScript(script, dummyAudit as any, 'Uji Frekuensi');

    assert.equal(audit.wordFrequencies['malah'], 3, 'Kata "malah" harus dihitung 3 kali');
    assert.equal(audit.wordFrequencies['karena'], 2, 'Kata "karena" harus dihitung 2 kali');
    assert.equal(audit.wordFrequencies['ternyata'], 4, 'Kata "ternyata" harus dihitung 4 kali');
    assert.equal(audit.wordFrequencies['gue'], 1, 'Kata "gue" harus dihitung 1 kali');
  });

  test('5. Tahap 3 memfinalisasi audit HCLSE dengan status FINALIZED_TAHAP_3', () => {
    const script = `
      Gue mau bongkar logika keliru yang sering dipakai politikus.
      Bukannya ngaku salah mereka malah ngebantah pakai argumen muter-muter.
      Dia ngedumel sendiri pas ketahuan kebohongannya.
      Kita harus manfaatin momen ini buat edukasi publik.
      Jangan mau dibohongi lagi sama jualan narasi manis.
    `;

    const initialResult = runHybridContextualLexiconSelectionEngine({
      script,
      topic: 'Logika Politikus',
      outline: sampleOutline,
    });

    const finalized = finalizeHCLSEAuditForScript(script, initialResult.auditTraceability, 'Logika Politikus');

    assert.equal(finalized.finalizationStatus, 'FINALIZED_TAHAP_3', 'Status finalisasi harus FINALIZED_TAHAP_3');
    assert.ok(typeof finalized.totalActuallyUsedInFinal === 'number', 'totalActuallyUsedInFinal harus dihitung');
    assert.ok(finalized.uniqueWordCount > 0, 'uniqueWordCount harus > 0');
  });
});
