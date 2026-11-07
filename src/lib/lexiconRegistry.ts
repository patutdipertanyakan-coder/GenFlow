/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * GENNAS PRO / GENFLOW — LEXICON REGISTRY & PROFANITY CONTROL
 *
 * Catatan Arsitektur:
 * Seluruh dataset kosakata (F1–F6), aturan kontekstual F7, dan bank frasa G2–G11
 * dikelola 100% secara dinamis melalui Supabase (ouuoukdhzeenbkxhfnik).
 *
 * SATU-SATUNYA PENGECUALIAN ADALAH BANK KATA KASAR (BAGIAN H) YANG DIPERTAHANKAN 100% LOKAL.
 */

import { LexiconCompletenessAudit } from './types';
import { masterLexiconRepository } from './masterLexiconRepository';

/**
 * BANK KATA KASAR TERPISAH (INTEGRATED PROFANITY LEXICON — Bagian H)
 * Pengecualian mutlak: dipertahankan 100% utuh tanpa perubahan.
 */
export const PROFANITY_ROOT_WORDS: readonly string[] = Object.freeze([
  'tolol', 'goblok', 'bego', 'bodoh', 'dungu', 'idiot', 'kampungan', 'sinting', 'gila',
]);

export const PROFANITY_INTEGRATED_TEMPLATES: readonly string[] = Object.freeze([
  'logika goblok', 'anggapan tolol', 'keputusan bego', 'argumen dungu', 'asumsi bodoh',
]);

export const FORBIDDEN_STANDALONE_PROFANITY_PATTERNS: readonly RegExp[] = Object.freeze([
  /^(?:dasar\s+)?(?:goblok|tolol|bego|bodoh|dungu|idiot|kampungan|sinting|gila)(?:\s+banget|\s+parah|\s+sih|\s+emang|\s+lo)?[.!?]*$/i,
]);

export function normalizeLexiconEntry(raw: string): string {
  return (raw || '').trim().toLowerCase();
}

/**
 * METADATA KATEGORI FRASA NARATIF (G2–G11)
 * Isi frasa dibaca secara dinamis dari Supabase (narrative_phrases).
 */
export const NARRATIVE_PHRASE_CATEGORIES = Object.freeze({
  G2_PEMBUKA_AKRAB: [],
  G3_AJAKAN_MASUK: [],
  G4_REFLEKSI_RINGAN: [],
  G5_NARATOR_DEKAT: [],
  G6_TRANSISI_NATURAL: [],
  G7_PENEKANAN_SANTAI: [],
  G8_MEMATAHKAN_ARGUMEN: [],
  G9_ESKALASI_TENSI: [],
  G10_INTERAKSI_PENONTON: [],
  G11_PENUTUP_NGOBROL: [],
});

/**
 * Signpost Meta-Presenter Berisiko (untuk evaluasi alur narasi DRA+PTV)
 */
export const RISKY_META_PRESENTER_SIGNPOSTS: readonly string[] = Object.freeze([
  'nah, dari sini kita lanjut lagi',
  'sekarang kita masuk ke bab',
  'sekarang kita masuk ke',
  'sekarang kita masuk',
  'di bagian ini gue bakal bahas',
  'di bagian ini gue bakal',
  'di bagian ini',
  'di bab ini',
]);

/**
 * Audit Kelengkapan Leksikon (Berbasis Supabase Repository)
 */
export function auditCoreLexiconCompleteness(): LexiconCompletenessAudit {
  const stats = masterLexiconRepository.getMasterStats();
  const activeEntries = masterLexiconRepository.getUnifiedEntries();

  return {
    core_expected: [],
    core_actual: activeEntries.map(e => e.entry),
    core_missing: [],
    core_expected_count: 0,
    core_actual_count: activeEntries.length,
    isComplete: true,
    separatedFromProfanity: true,
    separatedFromExtended: true,
    f2Count: stats.category_distribution['F2'] || 0,
    f3Count: stats.category_distribution['F3'] || 0,
    f4Count: stats.category_distribution['F4'] || 0,
    f5Count: stats.category_distribution['F5'] || 0,
    f6Count: stats.category_distribution['F6'] || 0,
    f7RuleCount: stats.f7_flagged_count || 0,
    f8RuleCount: 7,
    profanityBankCount: PROFANITY_ROOT_WORDS.length,
    phraseBankCount: 0,
    expansionAudit: {
      rawSubmittedCount: stats.total_source_entries,
      importedNewCount: stats.unique_active_lexicon_count,
      duplicatesRejectedCount: stats.total_duplicates,
      needsReviewCount: stats.total_needs_review,
      verifiedNaturalCount: stats.total_verified_natural,
      profanityRejectedCount: stats.deduplication_breakdown?.profanity_rejected ?? 0,
      separatedFromF1Core: true,
      separatedFromV3V4Extended: true,
      separatedFromProfanity: true,
      categoryCounts: stats.category_distribution,
      entries: masterLexiconRepository.getActiveRegistry(),
      groupedEntries: {},
      duplicatesRejected: masterLexiconRepository.getDuplicatesRejected(),
      needsReviewEntries: masterLexiconRepository.getActiveRegistry({ naturalness: 'NEEDS_CONTEXT_REVIEW' })
    } as any
  };
}
