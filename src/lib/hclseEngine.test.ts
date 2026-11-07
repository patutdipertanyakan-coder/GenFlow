/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PENGUJIAN WAJIB HCLSE — HYBRID CONTEXTUAL LEXICON SELECTION ENGINE
 *
 * Menguji:
 * 1. Skenario A: Supabase memiliki ngebantah, dibilangin, bawain, obatin. Konteks menyangkal argumen -> ngebantah terpilih, lainnya ditolak.
 * 2. Skenario B: Supabase tidak memiliki kata menggerutu -> ngedumel terpilih dari GLOBAL_INFORMAL, label SELECTED_GLOBAL_INFORMAL, tidak didaftarkan otomatis ke Supabase.
 * 3. Pembatasan kata 'karena' berulang & penghubung mekanis.
 * 4. Sentence Flow & Soft-Start Engine di setiap tanda titik ('.').
 * 5. F7 Contextual Guard & Gue-Lo Informal Register Lock.
 * 6. Punctuation Lock (Hanya '.', ',', '?').
 * 7. Hitungan frekuensi aktual di Hybrid Lexicon Monitor.
 */

import 'dotenv/config';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { masterLexiconRepository } from './masterLexiconRepository';
import {
  scoreCandidateInContext,
  processDiscourseConnectors,
  applySentenceFlowSoftStart,
  enforceStrictPunctuationLock,
  runHybridContextualLexiconSelectionEngine,
} from './hybridContextualLexiconSelectionEngine';
import { analyzeNarrativeContext } from './f7ContextualGuardEngine';

describe('HYBRID CONTEXTUAL LEXICON SELECTION ENGINE (HCLSE)', () => {
  before(async () => {
    await masterLexiconRepository.waitUntilReady();
  });

  test('SKENARIO A: Pemilihan Presisi Kosakata Supabase (ngebantah vs dibilangin, bawain, obatin)', () => {
    const narrativeContext = analyzeNarrativeContext({
      topic: 'Sengketa Kebijakan Publik',
      outline: 'Pihak oposisi menolak dan menyangkal argumen pemerintah soal anggaran.',
      blockId: 3,
    });

    const targetSentence = 'Dia mencoba membantah data yang disampaikan di depan publik.';

    // 1. ngebantah -> Wajib LULUS & SELECTED_SUPABASE
    const scoreNgebantah = scoreCandidateInContext({
      candidateWord: 'ngebantah',
      supabaseId: 'lex-sup-001',
      category: 'F3',
      sourceType: 'SUPABASE',
      narrativeContext,
      targetSentence,
      blockId: 3,
    });

    assert.equal(scoreNgebantah.passedThreshold, true, 'ngebantah harus lolos threshold (>=80)');
    assert.equal(scoreNgebantah.status, 'SELECTED_SUPABASE', 'Status ngebantah harus SELECTED_SUPABASE');
    assert.equal(scoreNgebantah.meaningFitScore, 35, 'Skor makna ngebantah harus maksimal (35)');

    // 2. dibilangin -> Skor makna rendah karena kurang presisi
    const scoreDibilangin = scoreCandidateInContext({
      candidateWord: 'dibilangin',
      supabaseId: 'lex-sup-002',
      category: 'F2',
      sourceType: 'SUPABASE',
      narrativeContext,
      targetSentence,
      blockId: 3,
    });

    assert.equal(scoreDibilangin.meaningFitScore < 35, true, 'dibilangin harus bernilai makna lebih rendah dari ngebantah');

    // 3. bawain -> Wajib DITOLAK (makna membawa)
    const scoreBawain = scoreCandidateInContext({
      candidateWord: 'bawain',
      supabaseId: 'lex-sup-003',
      category: 'F2',
      sourceType: 'SUPABASE',
      narrativeContext,
      targetSentence,
      blockId: 3,
    });

    assert.equal(scoreBawain.passedThreshold, false, 'bawain harus ditolak (score < 80)');
    assert.equal(scoreBawain.meaningFitScore, 0, 'Skor makna bawain harus 0');

    // 4. obatin -> Wajib DITOLAK (makna mengobati)
    const scoreObatin = scoreCandidateInContext({
      candidateWord: 'obatin',
      supabaseId: 'lex-sup-004',
      category: 'F2',
      sourceType: 'SUPABASE',
      narrativeContext,
      targetSentence,
      blockId: 3,
    });

    assert.equal(scoreObatin.passedThreshold, false, 'obatin harus ditolak (score < 80)');
    assert.equal(scoreObatin.meaningFitScore, 0, 'Skor makna obatin harus 0');
  });

  test('SKENARIO B: Non-Forcing Hybrid Selection ke GLOBAL_INFORMAL (ngedumel)', () => {
    const narrativeContext = analyzeNarrativeContext({
      topic: 'Kekecewaan Layanan Publik',
      outline: 'Warga merasa kecewa dan menggerutu karena antrean sangat panjang.',
      blockId: 2,
    });

    const targetSentence = 'Banyak orang yang menggerutu di lokasi karena tidak ada kepastian.';

    // ngedumel -> Dipilih dari GLOBAL_INFORMAL
    const scoreNgedumel = scoreCandidateInContext({
      candidateWord: 'ngedumel',
      category: 'GLOBAL_INFORMAL',
      sourceType: 'GLOBAL_INFORMAL',
      narrativeContext,
      targetSentence,
      blockId: 2,
    });

    assert.equal(scoreNgedumel.passedThreshold, true, 'ngedumel dari GLOBAL_INFORMAL harus lolos threshold');
    assert.equal(scoreNgedumel.status, 'SELECTED_GLOBAL_INFORMAL', 'Status harus SELECTED_GLOBAL_INFORMAL');
    assert.equal(scoreNgedumel.meaningFitScore, 35, 'Skor makna ngedumel harus 35');
  });

  test('Semantic Discourse: Pembatasan kata "karena" berulang & penghubung mekanis', () => {
    const textWithRepeatKarena = 'Gue heran karena sistem ini rusak karena kelalaian pengawas karena tidak ada audit.';
    const processed = processDiscourseConnectors(textWithRepeatKarena);

    assert.equal(processed.includes('karena tidak ada audit'), false, 'Pengulangan kata "karena" ketiga harus dibatasi');
    assert.equal(processed.includes('soalnya') || processed.includes('gara-gara'), true, 'Varian informal (soalnya/gara-gara) digunakan menggantikan karena berulang');
  });

  test('Sentence Flow & Soft-Start Engine: Memeriksa pembukaan setiap kalimat setelah tanda titik "."', () => {
    const multiSentenceLine = 'Sistem ini bermasalah. Ingatlah bahwa kita harus bertindak. Ditegaskan bahwa fakta ini jelas.';
    const processed = applySentenceFlowSoftStart(multiSentenceLine);

    assert.equal(processed.includes('Ingatlah bahwa'), false, 'Frasa presenter "Ingatlah bahwa" harus dihaluskan');
    assert.equal(processed.includes('Coba lo pikir') || processed.includes('Nah'), true, 'Soft-start lisan harus diterapkan');
  });

  test('Punctuation Lock: Hanya mengizinkan titik, koma, dan tanda tanya', () => {
    const messyPunctuation = 'Gue kaget banget!! Masalah ini sangat parah--bahkan merugikan.**Lihat data ini!**';
    const cleaned = enforceStrictPunctuationLock(messyPunctuation);

    assert.equal(cleaned.includes('!'), false, 'Tanda seru harus dikonversi');
    assert.equal(cleaned.includes('**'), false, 'Double asterisk markdown harus dibersihkan');
    assert.equal(cleaned.includes('--'), false, 'Double dash harus diganti koma');
    assert.equal(cleaned.includes('.'), true, 'Tanda titik dipertahankan');
  });

  test('HCLSE Runner Utuh & Hybrid Lexicon Monitor Audit Traceability', () => {
    const sampleScript = [
      'Gue heran lihat cara mereka mengeluh soal masalah ini.',
      'Akar masalahnya karena pejabat sengaja menolak fakta karena takut terbongkar.',
      'Di inti persoalan, publik berani membantah argumen palsu tersebut.',
      'Langkah solusinya harus nyata, bukan sekadar janji kosmetik.',
      'Ujung-ujungnya, kita butuh jawaban jujur dari pengambil keputusan.'
    ].join('\n');

    const result = runHybridContextualLexiconSelectionEngine({
      script: sampleScript,
      topic: 'Akuntabilitas Kebijakan Publik',
      outline: 'Analisis kritis penolakan argumen dan kekecewaan publik terhadap pejabat.',
    });

    assert.equal(result.blocks.length, 5, 'Hasil harus memiliki tepat 5 blok SCTF');
    assert.equal(result.auditTraceability.totalConsidered > 0, true, 'Traceability harus mencatat kandidat yang dipertimbangkan');
    assert.equal(typeof result.auditTraceability.wordFrequencies['membantah'] === 'number' || typeof result.auditTraceability.wordFrequencies['ngebantah'] === 'number', true, 'Monitor harus mengukur frekuensi kata di naskah final');
  });
});
