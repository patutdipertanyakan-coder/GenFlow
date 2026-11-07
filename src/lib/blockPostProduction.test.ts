import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyBlockPerdalamDeterministic,
  applyBlockTransisiDeterministic,
  finalizeBlockPostProductionLLMOutput,
  validateFullScript,
  countWordsConsistent,
  extractProtectedTokens,
  LOCKED_CRITICAL_PERSPECTIVE,
} from './validatorAndPipeline';
import { createValidTestSCTFScript } from './testFixtures';
import { GenNASConfig, LOCKED_DURATION_MODE, LOCKED_WPM } from './types';

const TEST_CONFIG: Partial<GenNASConfig> = {
  topik: 'Biaya Hidup dan Pertumbuhan Upah Pekerja',
  konteks: LOCKED_CRITICAL_PERSPECTIVE,
  faktaTerverifikasi:
    'Biaya hidup meningkat Rp1.500.000 per bulan sejak 1990-an, sementara pertumbuhan upah riil tertahan di angka 3,14% per tahun; Lebih dari 64% pekerja muda kesulitan menabung karena harga sewa hunian melonjak 28,5% dalam 5 tahun terakhir.',
  durasiMenit: 12,
  wpm: LOCKED_WPM,
  modeDurasi: LOCKED_DURATION_MODE,
  jumlahBlok: 5,
  struktur: [8, 17, 45, 20, 10],
};

describe('Block-Level Post-Production Engine (PERDALAM & TRANSISI per Blok)', () => {
  const baseScript = createValidTestSCTFScript(TEST_CONFIG.topik);
  const baseBlocks = baseScript.split('\n');

  it('memastikan naskah dasar memiliki tepat 5 blok SCTF yang valid sebelum operasi pascaproduksi', () => {
    assert.equal(baseBlocks.length, 5);
    const audit = validateFullScript(baseScript, TEST_CONFIG);
    assert.equal(audit.sctfValid, true);
    assert.equal(audit.nonSaraPassed, true);
    assert.equal(audit.quoteFree?.passed, true);
  });

  // 10 SKENARIO UJI WAJIB (Section K): PERDALAM BLOK 1..5
  for (let targetIdx = 0; targetIdx < 5; targetIdx++) {
    const blockNum = targetIdx + 1;
    it(`Skenario ${blockNum}: PERDALAM Blok ${blockNum} hanya mengubah Blok ${blockNum}, menambah kedalaman kata, menjaga fakta/angka, dan 4 blok lain 100% tidak berubah`, () => {
      const result = applyBlockPerdalamDeterministic(
        baseScript,
        targetIdx,
        TEST_CONFIG
      );

      // 1. Tepat 5 blok
      assert.equal(result.blocks.length, 5);

      // 2. Blok selain targetIdx WAJIB 100% identik byte-for-byte
      for (let i = 0; i < 5; i++) {
        if (i !== targetIdx) {
          assert.equal(
            result.blocks[i],
            baseBlocks[i],
            `Blok ${i + 1} tidak boleh berubah saat PERDALAM dijalankan pada Blok ${blockNum}`
          );
        }
      }

      // 3. Blok target diproses (jumlah kata dipertahankan/disesuaikan tanpa menyisipkan template)
      const wordsBefore = countWordsConsistent(baseBlocks[targetIdx]).length;
      const wordsAfter = countWordsConsistent(result.updatedBlock).length;
      assert.ok(
        wordsAfter >= wordsBefore,
        `Kata Blok ${blockNum} sesudah Perdalam (${wordsAfter}) harus setidaknya sama atau lebih banyak dari sebelum (${wordsBefore})`
      );
      assert.equal(result.metadata.wordsBefore, wordsBefore);
      assert.equal(result.metadata.wordsAfter, wordsAfter);
      assert.equal(result.metadata.wordDelta, wordsAfter - wordsBefore);
      assert.equal(result.metadata.nonTargetBlocksUnchanged, true);
      assert.equal(result.metadata.workflowStagesUntouched, true);

      // 4. Token terproteksi (angka, Rp, %, tahun) di blok target tetap utuh 100%
      const origTokens = extractProtectedTokens(baseBlocks[targetIdx]).tokens;
      for (const tok of origTokens) {
        assert.ok(
          result.updatedBlock.includes(tok),
          `Token terproteksi "${tok}" wajib tetap utuh di Blok ${blockNum}`
        );
      }
      assert.equal(result.metadata.protectedTokensIntact, true);

      // 5. Validasi kualitas V5.1 (Gue-Lo, 3-5 makian Non-SARA, SQNN Quote-Free, SAP) tetap lulus
      const postAudit = validateFullScript(result.updatedScript, TEST_CONFIG);
      assert.equal(postAudit.stages[targetIdx].passed, true);
      assert.equal(postAudit.nonSaraPassed, true);
      assert.equal(postAudit.quoteFree?.passed, true);
    });
  }

  // 10 SKENARIO UJI WAJIB (Section K): TRANSISI BLOK 1..5
  for (let targetIdx = 0; targetIdx < 5; targetIdx++) {
    const blockNum = targetIdx + 1;
    it(`Skenario ${blockNum + 5}: TRANSISI Blok ${blockNum} hanya mengubah Blok ${blockNum}, menghaluskan jembatan antarblok sesuai posisi, menjaga fakta/angka, dan 4 blok lain 100% tidak berubah`, () => {
      const result = applyBlockTransisiDeterministic(
        baseScript,
        targetIdx,
        TEST_CONFIG
      );

      // 1. Tepat 5 blok
      assert.equal(result.blocks.length, 5);

      // 2. Blok selain targetIdx WAJIB 100% identik byte-for-byte
      for (let i = 0; i < 5; i++) {
        if (i !== targetIdx) {
          assert.equal(
            result.blocks[i],
            baseBlocks[i],
            `Blok ${i + 1} tidak boleh berubah saat TRANSISI dijalankan pada Blok ${blockNum}`
          );
        }
      }

      // 3. Blok target mengalami pembersihan/penghalusan transisi sesuai posisinya
      assert.ok(
        result.updatedBlock.length > 0,
        `Blok ${blockNum} harus memiliki isi transisi valid`
      );
      assert.ok(result.metadata.transitionPartsUpdated);
      assert.equal(result.metadata.nonTargetBlocksUnchanged, true);
      assert.equal(result.metadata.workflowStagesUntouched, true);

      // 4. Token terproteksi (angka, Rp, %, tahun) di blok target tetap utuh 100%
      const origTokens = extractProtectedTokens(baseBlocks[targetIdx]).tokens;
      for (const tok of origTokens) {
        assert.ok(
          result.updatedBlock.includes(tok),
          `Token terproteksi "${tok}" wajib tetap utuh di Blok ${blockNum}`
        );
      }
      assert.equal(result.metadata.protectedTokensIntact, true);

      // 5. Validasi kualitas V5.1 & DRA+PTV Transisi lulus
      const postAudit = validateFullScript(result.updatedScript, TEST_CONFIG);
      assert.equal(postAudit.stages[targetIdx].passed, true);
      assert.equal(postAudit.nonSaraPassed, true);
      assert.equal(postAudit.quoteFree?.passed, true);
      const relatedTransitions = postAudit.transitions.filter(
        (t) => t.fromBlock === blockNum || t.toBlock === blockNum
      );
      for (const tr of relatedTransitions) {
        assert.equal(
          tr.passed,
          true,
          `Transisi B${tr.fromBlock}->B${tr.toBlock} wajib lulus DRA+PTV`
        );
      }
    });
  }

  it('finalizeBlockPostProductionLLMOutput memulihkan token fakta/angka yang hilang dan menjaga 4 blok lain tidak tersentuh', () => {
    const llmCandidateMissingNumber =
      'Jujur aja kalau lo ngelihat kondisi ekonomi sekarang, gue rasa banyak banget orang yang masih kejebak logika goblok waktu ngatur prioritas bulanan. Mereka ngerasa anggapan tolol soal gengsi itu lebih penting daripada dana darurat keluarga. Akibatnya keputusan bego buat ngutang konsumtif terus diulang tiap bulan tanpa pernah dievaluasi.';

    const finalized = finalizeBlockPostProductionLLMOutput({
      rawScript: baseScript,
      candidateBlockFromLLM: llmCandidateMissingNumber,
      blockIndex: 1, // Blok 2 (Akar Masalah) yang memuat Rp1.500.000, 1990-an, 3,14%
      operation: 'PERDALAM',
      config: TEST_CONFIG,
      modelUsed: 'gemini-3-flash-preview (Test)',
    });

    // Pastikan 4 blok lain tidak berubah
    for (let i = 0; i < 5; i++) {
      if (i !== 1) {
        assert.equal(finalized.blocks[i], baseBlocks[i]);
      }
    }

    // Pastikan seluruh token terproteksi dari Blok 2 asli tetap ada di hasil akhir
    const origTokensBlock2 = extractProtectedTokens(baseBlocks[1]).tokens;
    for (const tok of origTokensBlock2) {
      assert.ok(
        finalized.updatedBlock.includes(tok),
        `Token fakta "${tok}" dari Blok 2 wajib tetap terjaga`
      );
    }
    assert.equal(finalized.metadata.protectedTokensIntact, true);
  });
});
