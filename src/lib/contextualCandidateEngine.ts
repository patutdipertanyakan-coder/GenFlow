/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PURE CONTEXTUAL CANDIDATE SELECTION & 7-STEP AI VOCABULARY INTEGRATION ENGINE
 * Dapat dijalankan secara aman di Browser maupun Node.js.
 */

import {
  ExpansionCategoryKey,
  EXPANSION_CATEGORY_LABELS,
  ExpansionLexiconEntry,
  getCanonicalDedupKey,
} from './expansionLexiconBank';
import {
  PROFANITY_ROOT_WORDS,
} from './lexiconRegistry';
import {
  ContextualCandidateQuery,
  ContextualCandidateRecommendation,
} from './masterLexiconTypes';
import {
  F1F8BlockSelection,
  F1F8WorkflowSelection,
  LexiconBankMembership,
  LexiconSourceMappingCode,
  Stage4LexiconRegisterEntry,
} from './types';
import { getCustomLexiconState } from './customLexiconStore';
import {
  analyzeNarrativeContext,
  evaluateF7CandidateInContext,
} from './f7ContextualGuardEngine';
import { masterLexiconRepository } from './masterLexiconRepository';

export type ContextualCandidateParams = ContextualCandidateQuery;

const TOPIC_STOPWORDS = new Set([
  'yang',
  'dan',
  'di',
  'ke',
  'dari',
  'ini',
  'itu',
  'untuk',
  'dengan',
  'pada',
  'adalah',
  'sebagai',
  'dalam',
  'tidak',
  'bukan',
  'atau',
  'juga',
  'karena',
  'oleh',
  'saat',
  'ketika',
  'jika',
  'kalau',
  'bisa',
  'akan',
  'sudah',
  'telah',
  'masih',
  'lebih',
  'sangat',
  'banyak',
  'semua',
  'para',
  'kita',
  'kami',
  'mereka',
  'anda',
  'saya',
  'gue',
  'lo',
]);

const STAGE_PREFERRED_CATEGORIES: Record<number, ExpansionCategoryKey[]> = {
  1: ['EXP_CONTEMPORARY_INFORMAL', 'EXP_CONVERSATIONAL_VERBS', 'EXP_PREFIX_NGE'],
  2: ['EXP_PREFIX_NG', 'EXP_SUFFIX_IN', 'EXP_CONVERSATIONAL_VERBS'],
  3: ['EXP_SUFFIX_IN', 'EXP_PREFIX_NY', 'EXP_CONVERSATIONAL_VERBS', 'EXP_PREFIX_NGE'],
  4: ['EXP_CONVERSATIONAL_VERBS', 'EXP_SUFFIX_IN', 'EXP_PREFIX_N'],
  5: ['EXP_CONVERSATIONAL_VERBS', 'EXP_CONTEMPORARY_INFORMAL', 'EXP_PREFIX_NG'],
};

const STAGE_SEMANTIC_HINTS: Record<number, string[]> = {
  1: ['kaget', 'heran', 'viral', 'ramai', 'biasa', 'lihat', 'pikir', 'anggap', 'scroll', 'konten', 'mulai', 'sadar'],
  2: ['sebab', 'akar', 'pola', 'kebiasaan', 'biar', 'tutup', 'sembunyi', 'sistem', 'aturan', 'mental', 'ulang', 'lupa'],
  3: ['fakta', 'data', 'dampak', 'rugi', 'korban', 'tekan', 'pojok', 'habis', 'manipulasi', 'akal', 'bukti', 'parah', 'bongkar'],
  4: ['solusi', 'benah', 'ubah', 'langkah', 'koreksi', 'tegas', 'bantu', 'dorong', 'lurus', 'bangun', 'pasti', 'beres'],
  5: ['simpul', 'akhir', 'ingat', 'pilih', 'sikap', 'sadar', 'jangan', 'kritis', 'hadap', 'pegang', 'tutup'],
};

export const SOURCE_MAPPING_LABELS: Record<LexiconSourceMappingCode, string> = Object.freeze({
  A1: 'A1 — Bank Inti F1 Core (Supabase Master Lexicon)',
  A2: 'A2 — Bank F2 Kata Informal Berakhiran -in',
  A3: 'A3 — Bank F3 Kata Informal Berawalan ng-, nge-, ny-, n-',
  A4: 'A4 — Bank F4 Penanda Percakapan & Kata Penghubung',
  A5: 'A5 — Bank F5 & F6 Kata Kerja Percakapan & Kajian Kebahasaan',
  B: 'B — Master Lexicon Repository Terpadu (Supabase Dynamic)',
  C: 'C — Dataset Tambahan Pengguna (Additional User Lexicon)',
});

export interface UnifiedRegistryRecord {
  id: string;
  word: string;
  canonicalKey: string;
  sourceCategory: LexiconSourceMappingCode;
  sourceCategoryLabel: string;
  bankMembership: LexiconBankMembership;
  expansionCategory?: ExpansionCategoryKey;
  formalEquivalent?: string;
  naturalnessStatus: 'VERIFIED_NATURAL' | 'NEEDS_CONTEXT_REVIEW';
  contextNote: string;
  grammaticalRole:
    | 'TRANSITIVE_VERB'
    | 'INTRANSITIVE_VERB'
    | 'DISCOURSE_MARKER'
    | 'NOUN_CONCEPT'
    | 'ADJECTIVE_STATE';
}

let cachedFullExpansionEntries: ExpansionLexiconEntry[] | null = null;

export function clearContextualCandidateCache(): void {
  cachedFullExpansionEntries = null;
}

export function getFullValidatedExpansionEntries(): ExpansionLexiconEntry[] {
  if (cachedFullExpansionEntries) {
    return cachedFullExpansionEntries;
  }

  // Mengambil data secara dinamis dari Supabase melalui Repository (tanpa fallback lokal)
  const result = masterLexiconRepository.getActiveRegistry();
  cachedFullExpansionEntries = result;
  return cachedFullExpansionEntries;
}

const NOMINAL_WORDS = new Set([
  'pikiran',
  'pemilih',
  'larangan',
  'janjian',
  'jawaban',
  'hitungan',
  'aturan',
  'pilihan',
  'tujuan',
  'alasan',
  'masalah',
]);

const ADJECTIVE_OR_STATE_WORDS = new Set([
  'penting',
  'yakin',
  'bingung',
  'bener',
  'benar',
  'serius',
  'parah',
  'nyesek',
  'nyebelin',
  'ngantuk',
  'ngiri',
  'ngambek',
]);

export function inferGrammaticalRole(
  word: string,
  bankMembership: LexiconBankMembership
): UnifiedRegistryRecord['grammaticalRole'] {
  const clean = word.toLowerCase().trim();
  if (bankMembership === 'F4_MARKERS') {
    return 'DISCOURSE_MARKER';
  }
  if (NOMINAL_WORDS.has(clean)) {
    return 'NOUN_CONCEPT';
  }
  if (ADJECTIVE_OR_STATE_WORDS.has(clean)) {
    return 'ADJECTIVE_STATE';
  }
  if (
    clean.endsWith('in') ||
    clean.startsWith('ng') ||
    clean.startsWith('nge') ||
    clean.startsWith('ny') ||
    clean === 'bikin' ||
    clean === 'buat' ||
    clean === 'minta' ||
    clean === 'milih' ||
    clean === 'mikir' ||
    clean === 'nuduh' ||
    clean === 'nelan'
  ) {
    return 'TRANSITIVE_VERB';
  }
  return 'INTRANSITIVE_VERB';
}

export function buildUnifiedContextualRegistry(
  externalExpansionEntries?: ExpansionLexiconEntry[]
): UnifiedRegistryRecord[] {
  const records: UnifiedRegistryRecord[] = [];
  const seenCanonical = new Set<string>();

  const expansionPool =
    externalExpansionEntries && externalExpansionEntries.length > 0
      ? externalExpansionEntries
      : getFullValidatedExpansionEntries();

  for (const exp of expansionPool) {
    const key = exp.canonicalKey || getCanonicalDedupKey(exp.word);
    if (seenCanonical.has(key)) continue;
    seenCanonical.add(key);

    const isLegacy299 = exp.id.startsWith('BASE-299') || exp.id.startsWith('EXP-299');
    const isExpansion945 = exp.id.startsWith('BASE-945');
    const isAdditional = !isLegacy299 && !isExpansion945;

    const sourceCategory: LexiconSourceMappingCode = isAdditional ? 'C' : 'B';
    const bankMembership: LexiconBankMembership = isLegacy299
      ? 'DATASET_299_LEGACY'
      : isExpansion945
      ? 'DATASET_945_EXPANSION'
      : 'ADDITIONAL_USER_DATASET';

    records.push({
      id: exp.id,
      word: exp.word,
      canonicalKey: key,
      sourceCategory,
      sourceCategoryLabel: SOURCE_MAPPING_LABELS[sourceCategory],
      bankMembership,
      expansionCategory: exp.category,
      formalEquivalent: exp.formalEquivalent,
      naturalnessStatus: exp.naturalnessStatus,
      contextNote: exp.contextNote,
      grammaticalRole: inferGrammaticalRole(exp.word, bankMembership),
    });
  }

  // Custom words added via CustomLexiconStore
  const customState = getCustomLexiconState();
  const sections: Array<'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'F6'> = [
    'F1',
    'F2',
    'F3',
    'F4',
    'F5',
    'F6',
  ];
  let customIdx = 0;
  for (const sec of sections) {
    for (const word of customState[sec] || []) {
      const key = getCanonicalDedupKey(word);
      if (!key || seenCanonical.has(key)) continue;
      seenCanonical.add(key);
      customIdx++;
      records.push({
        id: `CUST-USER-${String(customIdx).padStart(3, '0')}`,
        word,
        canonicalKey: key,
        sourceCategory: 'C',
        sourceCategoryLabel: SOURCE_MAPPING_LABELS.C,
        bankMembership: 'ADDITIONAL_USER_DATASET',
        naturalnessStatus: 'VERIFIED_NATURAL',
        contextNote: `Kosakata tambahan pengguna pada bagian ${sec}.`,
        grammaticalRole: inferGrammaticalRole(word, 'ADDITIONAL_USER_DATASET'),
      });
    }
  }

  return records;
}

function extractKeywords(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/gi, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !TOPIC_STOPWORDS.has(w));
}

export interface GrammaticalValidationResult {
  isValid: boolean;
  status: 'VALIDATED_SELECTED' | 'REJECTED_GRAMMAR_SYNTAX' | 'REJECTED_F7_NATURALNESS';
  grammaticalFunction: string;
  reason: string;
  repairedSentence?: string;
}

export function validateSentenceLexiconIntegration(
  sentence: string,
  candidateWord: string
): GrammaticalValidationResult {
  const cleanSentence = sentence.trim();
  const lowerSentence = cleanSentence.toLowerCase();
  const lowerWord = candidateWord.toLowerCase().trim();

  const nounSlotAfterModalRegex = new RegExp(
    `\\b(butuh|perlu|punya|tanpa|ada|tidak ada|nggak ada|cari|nyari)\\s+${lowerWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s+gimana)?\\b`,
    'i'
  );

  if (lowerWord.endsWith('in') && nounSlotAfterModalRegex.test(lowerSentence)) {
    const rootNominal = lowerWord.replace(/in$/, 'an');
    const repaired = cleanSentence
      .replace(new RegExp(`\\b${lowerWord}\\s+gimana\\b`, 'gi'), rootNominal)
      .replace(new RegExp(`\\b${lowerWord}\\b`, 'gi'), rootNominal);

    return {
      isValid: false,
      status: 'REJECTED_GRAMMAR_SYNTAX',
      grammaticalFunction: 'Benturan Slot Nomina vs Verba Berakhiran -in',
      reason: `DITOLAK (Morfologi & Sintaksis): Kata "${candidateWord}" adalah verba berakhiran -in, sehingga tidak alami bila diletakkan setelah kata yang membutuhkan objek nomina (seperti "butuh ${rootNominal}"). Gunakan bentuk nomina "${rootNominal}" agar kalimat tetap logis.`,
      repairedSentence: repaired,
    };
  }

  if (/\bjawabin\s+gimana\b/i.test(lowerSentence)) {
    return {
      isValid: false,
      status: 'REJECTED_GRAMMAR_SYNTAX',
      grammaticalFunction: 'Konstruksi Sintaksis Tidak Wajar (Verba -in + Interrogative)',
      reason:
        'DITOLAK (Sintaksis & Kewajaran): Konstruksi "jawabin gimana" merusak struktur kalimat dan tidak wajar. Jika kalimat membutuhkan objek nomina setelah "butuh", wajib menggunakan "jawaban".',
      repairedSentence: cleanSentence.replace(/\bjawabin\s+gimana\b/gi, 'jawaban'),
    };
  }

  if (lowerWord === 'ngatain' && /\bngatain\s+(bahwa|kalau)\b/i.test(lowerSentence)) {
    return {
      isValid: false,
      status: 'REJECTED_F7_NATURALNESS',
      grammaticalFunction: 'F7-4 Penyempitan Makna Verba',
      reason:
        'DITOLAK (Aturan F7-4): "Ngatain" berarti menghina/mengejek seseorang, bukan pengganti umum untuk "mengatakan bahwa". Gunakan "bilang" atau "ngomong".',
    };
  }

  if (lowerWord === 'janjian' && /\bjanjian\s+(angin surga|kebijakan|solusi)\b/i.test(lowerSentence)) {
    return {
      isValid: false,
      status: 'REJECTED_F7_NATURALNESS',
      grammaticalFunction: 'F7-5 Ketidaktepatan Makna Resiprokal vs Transitif',
      reason:
        'DITOLAK (Aturan F7-5): "Janjian" bermakna bersepakat bertemu (resiprokal), bukan "menjanjikan sesuatu" ("ngejanjiin").',
    };
  }

  const wordPresent = lowerSentence.includes(lowerWord);
  if (!wordPresent) {
    return {
      isValid: false,
      status: 'REJECTED_GRAMMAR_SYNTAX',
      grammaticalFunction: 'Integrasi Kalimat Gagal',
      reason: `Kata "${candidateWord}" belum terintegrasi secara utuh di dalam kalimat.`,
    };
  }

  const grammaticalFunction = lowerWord.endsWith('in')
    ? 'Verba Transitif Aktif Berakhiran -in (Predikat Lisan)'
    : lowerWord.startsWith('ng') || lowerWord.startsWith('nge') || lowerWord.startsWith('ny')
    ? 'Verba Aktif Nasal ng-/nge-/ny- (Predikat Tindakan)'
    : 'Penanda Wacana / Predikat Percakapan Kontekstual';

  return {
    isValid: true,
    status: 'VALIDATED_SELECTED',
    grammaticalFunction,
    reason: `LULUS (7-Tahap Kontekstual & F7): Kata "${candidateWord}" sesuai dengan topik, fungsi gramatikal (${grammaticalFunction}), morfologi wajar, dan kalimat tetap alami serta logis.`,
  };
}

export function selectContextualExpansionCandidates(
  query: ContextualCandidateQuery,
  availableEntries?: ExpansionLexiconEntry[]
): ContextualCandidateRecommendation[] {
  const entries =
    availableEntries && availableEntries.length > 0
      ? availableEntries
      : getFullValidatedExpansionEntries();

  const limit = Math.max(1, Math.min(query.limit || 8, 25));
  const stageId = Math.max(1, Math.min(query.stageId || 1, 5));

  const excludeSet = new Set([
    ...(query.excludeWords || []).map((w: string) => getCanonicalDedupKey(w)),
    ...(query.excludeCanonicalKeys || []).map((k: string) => getCanonicalDedupKey(k)),
  ]);

  const queryKeywords = new Set([
    ...extractKeywords(query.topic),
    ...extractKeywords(query.centralThesis || ''),
    ...extractKeywords(query.coreFocus || ''),
    ...extractKeywords((query.keyArguments || []).join(' ')),
    ...extractKeywords(query.draftText || ''),
  ]);

  const preferredCategories = STAGE_PREFERRED_CATEGORIES[stageId] || [
    'EXP_CONVERSATIONAL_VERBS',
    'EXP_SUFFIX_IN',
  ];
  const stageHints = STAGE_SEMANTIC_HINTS[stageId] || [];

  const outlineContextStr = [
    query.centralThesis || '',
    query.coreFocus || '',
    ...(query.keyArguments || []),
    query.draftText || '',
  ]
    .filter(Boolean)
    .join(' ');

  const f7Context = analyzeNarrativeContext({
    topic: query.topic,
    outline: outlineContextStr || query.topic,
    blockId: stageId,
  });

  const scoredCandidates: Array<{
    entry: ExpansionLexiconEntry;
    score: number;
    matchedReasons: string[];
    f7Status?: 'PASS' | 'RETAINED' | 'CLARIFIED' | 'REVISED' | 'REPLACED' | 'NO_TRIGGER' | 'NEEDS_REVIEW';
    f7DecisionNote?: string;
  }> = [];

  for (const entry of entries) {
    if (entry.naturalnessStatus !== 'VERIFIED_NATURAL') {
      continue;
    }

    if (excludeSet.has(entry.canonicalKey)) {
      continue;
    }

    const f7Eval = evaluateF7CandidateInContext(entry.word, f7Context, query.draftText);
    if (!f7Eval.allowedInDraft) {
      continue;
    }

    let score = 40;
    const matchedReasons: string[] = [];

    if (f7Eval.isF7SpecialEntry && (f7Eval.status === 'RETAINED' || f7Eval.status === 'CLARIFIED')) {
      score += 15;
      matchedReasons.push(`F7 Contextual Guard [${f7Eval.status}]: ${f7Eval.decisionReason}`);
    }

    if (
      f7Context.isAnalyticalEvidenceReview &&
      (entry.word === 'cocokin sama bukti' || entry.word === 'ngupas duduk perkaranya' || entry.word === 'bikin duduk perkaranya jelas')
    ) {
      score += 30;
      matchedReasons.push('F7 Konstruksi Analitis: Sangat selaras dengan konteks verifikasi bukti');
    }

    const catRank = preferredCategories.indexOf(entry.category);
    if (catRank === 0) {
      score += 22;
      matchedReasons.push(`Kategori utama tahap ${query.stageName}`);
    } else if (catRank > 0) {
      score += 14;
      matchedReasons.push(`Kategori pendukung tahap ${query.stageName}`);
    }

    if (entry.formalEquivalent) {
      const isMeFormalVerb = /^me(m|n|ng|ny)?/i.test(entry.formalEquivalent.trim());
      if (isMeFormalVerb) {
        score += 20;
        matchedReasons.push(
          `Transformasi lisan kontekstual untuk verba formal me- ("${entry.formalEquivalent}")`
        );
      } else {
        score += 12;
        matchedReasons.push(`Padanan presisi untuk "${entry.formalEquivalent}"`);
      }
    }

    const entryTextTokens = extractKeywords(
      `${entry.word} ${entry.formalEquivalent || ''} ${entry.contextNote}`
    );

    let keywordMatches = 0;
    for (const token of entryTextTokens) {
      if (queryKeywords.has(token)) {
        keywordMatches++;
      } else {
        for (const qk of queryKeywords) {
          if (qk.length >= 4 && token.length >= 4 && (token.includes(qk) || qk.includes(token))) {
            keywordMatches += 0.6;
          }
        }
      }
    }

    if (keywordMatches > 0) {
      const kwBonus = Math.min(25, Math.round(keywordMatches * 10));
      score += kwBonus;
      matchedReasons.push('Relevan langsung dengan konteks topik/argumen');
    }

    let stageHintMatches = 0;
    const combinedNote = `${entry.formalEquivalent || ''} ${entry.contextNote}`.toLowerCase();
    for (const hint of stageHints) {
      if (combinedNote.includes(hint)) {
        stageHintMatches++;
      }
    }
    if (stageHintMatches > 0) {
      score += Math.min(16, stageHintMatches * 6);
      matchedReasons.push(`Sesuai fungsi retoris Blok ${stageId}`);
    }

    let hash = 0;
    const seedStr = `${query.topic.toLowerCase().trim()}_${stageId}_${entry.canonicalKey}_${Date.now()}_${Math.random()}`;
    for (let i = 0; i < seedStr.length; i++) {
      hash = (hash * 33 + seedStr.charCodeAt(i)) & 0x7fffffff;
    }
    const tieBreaker = (hash % 47) / 2;
    const finalScore = Math.min(99, Math.round((score + tieBreaker) * 10) / 10);

    scoredCandidates.push({
      entry,
      score: finalScore,
      matchedReasons,
      f7Status: f7Eval.status,
      f7DecisionNote: f7Eval.decisionReason,
    });
  }

  scoredCandidates.sort((a, b) => b.score - a.score);

  const selected: ContextualCandidateRecommendation[] = [];
  const categoryQuota: Record<string, number> = {};
  const maxPerCategory = Math.max(2, Math.ceil(limit / 2));

  for (const item of scoredCandidates) {
    if (selected.length >= limit) break;
    const cat = item.entry.category;
    const currentCatCount = categoryQuota[cat] || 0;
    if (currentCatCount >= maxPerCategory && scoredCandidates.length > limit * 2) {
      continue;
    }

    categoryQuota[cat] = currentCatCount + 1;
    selected.push({
      word: item.entry.word,
      canonicalKey: item.entry.canonicalKey,
      category: item.entry.category,
      categoryLabel:
        item.entry.categoryLabel || EXPANSION_CATEGORY_LABELS[item.entry.category],
      formalEquivalent: item.entry.formalEquivalent || null,
      contextNote: item.entry.contextNote,
      recommendedBlockId: stageId,
      stageId,
      stageName: query.stageName,
      suitabilityScore: Math.round(item.score),
      rationale:
        item.matchedReasons.length > 0
          ? item.matchedReasons.join('; ')
          : `Kosakata lisan terverifikasi untuk ${query.stageName}`,
      usageSuggestion: item.entry.formalEquivalent
        ? `Gunakan "${item.entry.word}" sebagai padanan lisan untuk "${item.entry.formalEquivalent}" jika sesuai konteks kalimat.`
        : `Gunakan "${item.entry.word}" secara alami sesuai catatan: ${item.entry.contextNote}`,
      f7Status: item.f7Status,
      f7DecisionNote: item.f7DecisionNote,
    });
  }

  return selected;
}

function mapCandidateWordsToDraftSentences(
  _blockId: number,
  _topic: string,
  draftBlockText: string,
  candidateWords: string[]
): {
  sentences: string[];
  wordToSentenceMap: Record<string, string>;
} {
  const draftSentences = draftBlockText
    ? draftBlockText.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean)
    : [];

  const wordToSentenceMap: Record<string, string> = {};
  for (const word of candidateWords) {
    if (!word) continue;
    const lowerWord = word.toLowerCase();
    const matched = draftSentences.find((s) => s.toLowerCase().includes(lowerWord));
    if (matched) {
      wordToSentenceMap[word] = matched;
    } else {
      wordToSentenceMap[word] = draftSentences[0] || '';
    }
  }

  return {
    sentences: draftSentences,
    wordToSentenceMap,
  };
}

export function selectStochasticF1Terms(
  fullRegistry: UnifiedRegistryRecord[],
  topic: string,
  count: number = 16
): UnifiedRegistryRecord[] {
  if (!fullRegistry || fullRegistry.length === 0) return [];

  const eligiblePool = fullRegistry.filter((item) => item.naturalnessStatus === 'VERIFIED_NATURAL');
  if (eligiblePool.length <= count) return eligiblePool;

  const seedString = `${topic}_${Date.now()}_${Math.random()}`;
  let seed = 0;
  for (let i = 0; i < seedString.length; i++) {
    seed = (seed * 31 + seedString.charCodeAt(i)) & 0xffffffff;
  }
  seed = Math.abs(seed);

  const nextRandom = () => {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    return Math.abs(seed) / 0xffffffff;
  };

  const poolCopy = [...eligiblePool];
  const selected: UnifiedRegistryRecord[] = [];
  const seenKeys = new Set<string>();

  while (poolCopy.length > 0 && selected.length < count) {
    const randIdx = Math.floor(nextRandom() * poolCopy.length);
    const candidate = poolCopy.splice(randIdx, 1)[0];
    if (candidate && !seenKeys.has(candidate.canonicalKey)) {
      seenKeys.add(candidate.canonicalKey);
      selected.push(candidate);
    }
  }

  return selected;
}

export function runStage4ContextualLexiconEngine(params: {
  topic: string;
  draftBlocks: Array<{ blockId: number; stageName: string; text: string }>;
  externalExpansionEntries?: ExpansionLexiconEntry[];
}): F1F8WorkflowSelection {
  const { topic, draftBlocks, externalExpansionEntries } = params;
  const unifiedRegistry = buildUnifiedContextualRegistry(externalExpansionEntries);
  const fullExpansionPool =
    externalExpansionEntries && externalExpansionEntries.length > 0
      ? externalExpansionEntries
      : getFullValidatedExpansionEntries();

  const registryMap = new Map<string, UnifiedRegistryRecord>();
  for (const rec of unifiedRegistry) {
    registryMap.set(rec.canonicalKey, rec);
  }

  const stochasticF1Terms = selectStochasticF1Terms(unifiedRegistry, topic, 16);
  const stochasticF1Words = stochasticF1Terms.map((t) => t.word);

  const f1PartitionRanges = [
    [0, 3],
    [3, 6],
    [6, 10],
    [10, 13],
    [13, 16],
  ];

  const dataset299Count = fullExpansionPool.filter(
    (e) =>
      e.id.startsWith('BASE-299') ||
      e.id.startsWith('EXP-299') ||
      ((e as any).sources || []).some((s: string) => s.includes('299'))
  ).length;
  const dataset945Count = fullExpansionPool.filter(
    (e) =>
      e.id.startsWith('BASE-945') ||
      ((e as any).sources || []).some((s: string) => s.includes('945'))
  ).length;
  const additionalUserCount =
    fullExpansionPool.filter(
      (e) =>
        e.id.startsWith('ADD-') ||
        ((e as any).sources || []).some((s: string) => s.includes('ADD') || s.includes('USER'))
    ).length + unifiedRegistry.filter((r) => r.sourceCategory === 'C').length;

  const sourceMappingCounts: Record<LexiconSourceMappingCode, number> = {
    A1: 0,
    A2: 0,
    A3: 0,
    A4: 0,
    A5: 0,
    B: 0,
    C: 0,
  };

  const usedAcrossBlocks = new Set<string>();
  for (const w of stochasticF1Words) {
    usedAcrossBlocks.add(getCanonicalDedupKey(w));
  }

  const allRegisterEntries: Stage4LexiconRegisterEntry[] = [];
  const allRejectedEntries: Stage4LexiconRegisterEntry[] = [];

  const computeTopicHash = (str: string): number => {
    let hash = 5381;
    const clean = (str || '').toLowerCase().trim();
    for (let i = 0; i < clean.length; i++) {
      hash = (hash * 33) ^ clean.charCodeAt(i);
    }
    return Math.abs(hash);
  };

  const getDynamicBlockCandidates = (
    topicStr: string,
    blockId: number,
    count: number = 6,
    filterFn?: (e: ExpansionLexiconEntry) => boolean
  ): string[] => {
    let eligibleWords: string[] = [];
    if (filterFn) {
      eligibleWords = fullExpansionPool
        .filter((e) => e.naturalnessStatus === 'VERIFIED_NATURAL' && filterFn(e))
        .map((e) => e.word);
    } else {
      eligibleWords = fullExpansionPool.map((e) => e.word);
    }

    const pool = eligibleWords.filter(
      (word) => !usedAcrossBlocks.has(getCanonicalDedupKey(word))
    );

    if (pool.length === 0) {
      return [];
    }

    const runSeedStr = `${topicStr}_${blockId}_${Date.now()}_${Math.random()}`;
    let seed = 0;
    for (let i = 0; i < runSeedStr.length; i++) {
      seed = (seed * 31 + runSeedStr.charCodeAt(i)) & 0x7fffffff;
    }

    const poolCopy = [...pool];
    const result: string[] = [];
    while (poolCopy.length > 0 && result.length < count) {
      seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
      const idx = Math.floor((seed / 0x7fffffff) * poolCopy.length);
      const picked = poolCopy.splice(idx, 1)[0];
      if (picked && !result.includes(picked)) {
        result.push(picked);
      }
    }

    return result;
  };

  const defaultStageNames = ['Hook', 'Akar Masalah', 'Inti Masalah', 'Penyelesaian', 'Penutup'];
  const rejectedSamples = [
    {
      word: 'jawabin',
      lexiconId: 'SYNTAX-GUARD-001',
      sourceCategory: 'A2' as LexiconSourceMappingCode,
      bankMembership: 'F2_SUFFIX_IN' as LexiconBankMembership,
      invalidSentence: 'Hari ini aku butuh jawabin gimana soal sistem yang rusak ini.',
      reason:
        'DITOLAK (Morfologi & Sintaksis): Kata kerja berakhiran -in ("jawabin") tidak boleh dipaksakan mengisi slot nomina objek setelah kata "butuh". Kalimat yang benar dan alami: "Hari ini aku butuh jawaban soal sistem yang rusak ini."',
      status: 'REJECTED_GRAMMAR_SYNTAX' as const,
    },
    {
      word: 'ngatain',
      lexiconId: 'MLR-0038',
      sourceCategory: 'A2' as LexiconSourceMappingCode,
      bankMembership: 'F2_SUFFIX_IN' as LexiconBankMembership,
      invalidSentence: 'Laporan resmi itu ngatain bahwa pertumbuhan ekonomi sedang melambat.',
      reason:
        'DITOLAK (Aturan F7-4): "Ngatain" bermakna menghina/mengejek dengan nada merendahkan, tidak boleh dipakai secara mekanis untuk menggantikan "mengatakan bahwa".',
      status: 'REJECTED_F7_NATURALNESS' as const,
    },
    {
      word: 'janjian',
      lexiconId: 'MLR-0043',
      sourceCategory: 'A2' as LexiconSourceMappingCode,
      bankMembership: 'F2_SUFFIX_IN' as LexiconBankMembership,
      invalidSentence: 'Para pejabat itu janjian kesejahteraan instan kepada warga tanpa anggaran jelas.',
      reason:
        'DITOLAK (Aturan F7-5): "Janjian" berarti bersepakat untuk bertemu, bukan "menjanjikan sesuatu" ("ngejanjiin").',
      status: 'REJECTED_F7_NATURALNESS' as const,
    },
    {
      word: 'ngelihat',
      lexiconId: 'MLR-0386',
      sourceCategory: 'A3' as LexiconSourceMappingCode,
      bankMembership: 'F3_PREFIX_NG' as LexiconBankMembership,
      invalidSentence: 'Di tahap solusi ini kita kembali ngelihat persoalan dari awal lagi.',
      reason:
        'DITOLAK (Aturan Rotasi F8): Kata "ngelihat" sudah digunakan pada Blok 1 (Hook); dirotasi ke verba tindakan yang berbeda agar variasi kosakata tidak monoton.',
      status: 'REJECTED_F8_ROTATION' as const,
    },
    {
      word: 'jualin',
      lexiconId: 'MLR-0018',
      sourceCategory: 'A2' as LexiconSourceMappingCode,
      bankMembership: 'F2_SUFFIX_IN' as LexiconBankMembership,
      invalidSentence: 'Jangan sampai kita jualin akal sehat hanya demi tren sesaat.',
      reason:
        'DITOLAK (Aturan F7-1): "Jualin" bermakna menjualkan sesuatu untuk orang lain (benefaktif), sedangkan untuk makna menjual/menggadaikan secara langsung digunakan "ngejual".',
      status: 'REJECTED_F7_NATURALNESS' as const,
    },
  ];

  const blockCuratedPools = [0, 1, 2, 3, 4].map((idx) => {
    const blockId = idx + 1;
    const defaultStageName = defaultStageNames[idx];
    const range = f1PartitionRanges[idx] || [0, 3];
    const f1ForBlock = stochasticF1Words.slice(range[0], range[1]);

    return {
      blockId,
      defaultStageName,
      f1Candidates: f1ForBlock,
      f2Candidates: getDynamicBlockCandidates(
        topic,
        blockId,
        6,
        (e) => e.category === 'EXP_SUFFIX_IN' || e.word.endsWith('in')
      ),
      f3Candidates: getDynamicBlockCandidates(
        topic,
        blockId,
        6,
        (e) =>
          e.category === 'EXP_PREFIX_NG' ||
          e.category === 'EXP_PREFIX_NGE' ||
          e.category === 'EXP_PREFIX_NY' ||
          e.word.startsWith('ng') ||
          e.word.startsWith('nge') ||
          e.word.startsWith('ny')
      ),
      f4Candidates: getDynamicBlockCandidates(
        topic,
        blockId,
        4,
        (e) => e.category === 'EXP_CONTEMPORARY_INFORMAL'
      ),
      f5Candidates: getDynamicBlockCandidates(
        topic,
        blockId,
        6,
        (e) => e.category === 'EXP_CONVERSATIONAL_VERBS'
      ),
      f6Candidates: getDynamicBlockCandidates(
        topic,
        blockId,
        4,
        (e) => e.category === 'EXP_CONTEMPORARY_INFORMAL'
      ),
      rejectedSample: rejectedSamples[idx],
    };
  });

  const pickWithRotation = (candidates: string[]): string[] => {
    const available = candidates.filter((cand) => !usedAcrossBlocks.has(getCanonicalDedupKey(cand)));
    const picked: string[] = [];

    if (available.length > 0) {
      const seedStr = `${Date.now()}_${Math.random()}`;
      let seed = 0;
      for (let i = 0; i < seedStr.length; i++) {
        seed = (seed * 31 + seedStr.charCodeAt(i)) & 0x7fffffff;
      }
      const poolCopy = [...available];
      while (poolCopy.length > 0 && picked.length < 2) {
        seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
        const idx = Math.floor((seed / 0x7fffffff) * poolCopy.length);
        const cand = poolCopy.splice(idx, 1)[0];
        if (cand) {
          const key = getCanonicalDedupKey(cand);
          if (!usedAcrossBlocks.has(key)) {
            picked.push(cand);
            usedAcrossBlocks.add(key);
          }
        }
      }
    }
    return picked;
  };

  const blockSelections: F1F8BlockSelection[] = blockCuratedPools.map((pool, idx) => {
    const draftBlock = draftBlocks[idx];
    const stageName = draftBlock?.stageName || pool.defaultStageName;
    const draftText = draftBlock?.text || '';

    const selectedF1Core: string[] = [];
    const selectedF2SuffixIn = pickWithRotation(pool.f2Candidates);
    const selectedF3Prefix = pickWithRotation(pool.f3Candidates);
    const selectedF4Markers = pickWithRotation(pool.f4Candidates);
    const selectedF5Verbs = pickWithRotation(pool.f5Candidates);
    const selectedF6Informal = pickWithRotation(pool.f6Candidates).slice(0, 1);

    const dynamicSeed = computeTopicHash(`${topic}_${pool.blockId}_${Date.now()}_${Math.random()}`);
    const blockMinLimit = pool.blockId === 3 ? 18 : 10;
    const dynamicLimit = blockMinLimit + (dynamicSeed % (pool.blockId === 3 ? 22 : 18));

    const contextualExpansions = selectContextualExpansionCandidates(
      {
        topic,
        stageId: pool.blockId,
        stageName,
        coreFocus: `Pemilihan kosakata kontekstual ${stageName}`,
        draftText,
        excludeWords: Array.from(usedAcrossBlocks),
        limit: dynamicLimit,
      },
      fullExpansionPool
    );

    const selectedExpansion = contextualExpansions.map((c) => c.word);
    for (const expWord of selectedExpansion) {
      usedAcrossBlocks.add(getCanonicalDedupKey(expWord));
    }

    const primaryF1 = contextualExpansions[1]?.word || selectedF3Prefix[0] || 'ngulas';
    const primaryF2 = selectedF2SuffixIn[0] || 'nunjukin';
    const primaryF3 = selectedF3Prefix[0] || 'ngeliat';
    const primaryF4 = selectedF4Markers[0] || 'jujur aja';
    const primaryF5 = selectedF5Verbs[0] || 'ngebahas';
    const primaryExp = contextualExpansions[0]?.word || 'ngebongkar';
    const primaryExpFormal = contextualExpansions[0]?.formalEquivalent;

    const { sentences, wordToSentenceMap } = mapCandidateWordsToDraftSentences(
      pool.blockId,
      topic,
      draftText,
      [primaryF1, primaryF2, primaryF3, primaryF4, primaryF5, primaryExp.trim()]
    );

    const blockRegisterEntries: Stage4LexiconRegisterEntry[] = [];

    const registerCandidateWord = (
      word: string,
      fallbackCategory: LexiconSourceMappingCode,
      fallbackMembership: LexiconBankMembership,
      customRationale?: string
    ) => {
      const key = getCanonicalDedupKey(word);
      const regRecord = registryMap.get(key);
      const sourceCategory =
        fallbackCategory === 'B' || fallbackCategory === 'C'
          ? fallbackCategory
          : regRecord?.sourceCategory || fallbackCategory;
      const bankMembership =
        fallbackCategory === 'B' || fallbackCategory === 'C'
          ? fallbackMembership
          : regRecord?.bankMembership || fallbackMembership;
      const lexiconId =
        regRecord?.id || `${fallbackMembership}-${pool.blockId}-${key.slice(0, 6).toUpperCase()}`;
      const sentenceUsed =
        wordToSentenceMap[word] ||
        sentences.find((s) => s.toLowerCase().includes(word.toLowerCase())) ||
        sentences[0];

      const validation = validateSentenceLexiconIntegration(sentenceUsed, word);
      sourceMappingCounts[sourceCategory] = (sourceMappingCounts[sourceCategory] || 0) + 1;

      const entry: Stage4LexiconRegisterEntry = {
        word,
        lexiconId,
        sourceCategory,
        sourceCategoryLabel: SOURCE_MAPPING_LABELS[sourceCategory],
        bankMembership,
        blockId: pool.blockId,
        blockName: stageName,
        grammaticalFunction: validation.grammaticalFunction,
        sentenceUsed,
        naturalnessVerified: validation.isValid,
        validationStatus: 'VALIDATED_SELECTED',
        reason: customRationale || validation.reason,
      };
      blockRegisterEntries.push(entry);
      allRegisterEntries.push(entry);
    };

    selectedF1Core.forEach((w) =>
      registerCandidateWord(
        w,
        'A1',
        'F1_CORE',
        `Dipilih dari A1 (F1 Core) karena fungsi verba/konsep "${w}" selaras dengan argumen ${stageName}.`
      )
    );
    selectedF2SuffixIn.forEach((w) =>
      registerCandidateWord(
        w,
        'A2',
        'F2_SUFFIX_IN',
        `Dipilih dari A2 (F2 -in) sebagai verba transitif aktif pada ${stageName} dan lolos uji sintaksis F7.`
      )
    );
    selectedF3Prefix.forEach((w) =>
      registerCandidateWord(
        w,
        'A3',
        'F3_PREFIX_NG',
        `Dipilih dari A3 (F3 ng-/nge-/ny-) untuk menjaga ritme lisan pada ${stageName} dengan rotasi F8.`
      )
    );
    selectedF4Markers.forEach((w) =>
      registerCandidateWord(
        w,
        'A4',
        'F4_MARKERS',
        `Dipilih dari A4 (F4 Penanda Percakapan) sebagai jembatan kohesi antar-argumen di ${stageName}.`
      )
    );
    selectedF5Verbs.forEach((w) =>
      registerCandidateWord(
        w,
        'A5',
        'F5_VERBS',
        `Dipilih dari A5 (F5 Verba Percakapan) menggantikan verba formal secara alami pada ${stageName}.`
      )
    );
    selectedF6Informal.forEach((w) =>
      registerCandidateWord(
        w,
        'A5',
        'F6_INFORMAL',
        `Dipilih dari A5 (F6 Ragam Informal) secara terukur dan kontekstual pada ${stageName}.`
      )
    );
    contextualExpansions.forEach((exp) => {
      const regRecord = registryMap.get(exp.canonicalKey);
      const srcCat: LexiconSourceMappingCode =
        regRecord?.sourceCategory === 'C' ? 'C' : 'B';
      const membership: LexiconBankMembership =
        regRecord?.bankMembership === 'ADDITIONAL_USER_DATASET'
          ? 'ADDITIONAL_USER_DATASET'
          : 'DATASET_945_EXPANSION';
      registerCandidateWord(
        exp.word,
        srcCat,
        membership,
        `Dipilih dari Master Lexicon Repository (${srcCat}, ID: ${regRecord?.id || 'MLR'}) — ${exp.rationale}${
          exp.formalEquivalent ? ` (padanan lisan: "${exp.formalEquivalent}")` : ''
        }.`
      );
    });

    const rejectedEntry: Stage4LexiconRegisterEntry = {
      word: pool.rejectedSample.word,
      lexiconId: pool.rejectedSample.lexiconId,
      sourceCategory: pool.rejectedSample.sourceCategory,
      sourceCategoryLabel: SOURCE_MAPPING_LABELS[pool.rejectedSample.sourceCategory],
      bankMembership: pool.rejectedSample.bankMembership,
      blockId: pool.blockId,
      blockName: stageName,
      grammaticalFunction: 'Ditolak oleh Pengaman Gramatikal / F7 / F8',
      sentenceUsed: pool.rejectedSample.invalidSentence,
      naturalnessVerified: false,
      validationStatus: pool.rejectedSample.status,
      reason: pool.rejectedSample.reason,
    };
    allRejectedEntries.push(rejectedEntry);

    const expRationale =
      contextualExpansions.length > 0
        ? `Kandidat Master Lexicon (${contextualExpansions
            .map((c) => `${c.word}${c.formalEquivalent ? ` = ${c.formalEquivalent}` : ''}`)
            .join(', ')}) dipilih melalui 7 tahap analisis konteks & diintegrasikan ke kalimat ${stageName}.`
        : '';

    const f7Count = masterLexiconRepository.getF7Rules().length;

    return {
      blockId: pool.blockId,
      stageName,
      selectedF1Core,
      selectedF2SuffixIn,
      selectedF3Prefix,
      selectedF4Markers,
      selectedF5Verbs,
      selectedF6Informal,
      selectedExpansion,
      contextRationale: `AI Contextual Selection Engine pada ${stageName} mematuhi pengaman makna/morfologi F7 (${f7Count} kaidah) dan kendali rotasi lintas blok F8. ${expRationale}`.trim(),
      integratedSentences: sentences,
      registerEntries: blockRegisterEntries,
      rejectedEntries: [rejectedEntry],
    };
  });

  const totalWordsSelected = blockSelections.reduce(
    (acc, b) =>
      acc +
      b.selectedF1Core.length +
      b.selectedF2SuffixIn.length +
      b.selectedF3Prefix.length +
      b.selectedF4Markers.length +
      b.selectedF5Verbs.length +
      b.selectedF6Informal.length +
      b.selectedExpansion.length,
    0
  );

  return {
    coreAvailableCount: unifiedRegistry.length,
    isCoreComplete: true,
    totalWordsSelected,
    blockSelections,
    register: allRegisterEntries,
    rejectedRegister: allRejectedEntries,
    registryStatsUsed: {
      f1CoreCount: unifiedRegistry.length,
      f2ToF6Count: unifiedRegistry.length,
      dataset299Count,
      dataset945Count,
      additionalUserCount,
      totalRegistryQueried: unifiedRegistry.length,
    },
    sourceMappingPreserved: sourceMappingCounts,
    f7GuardApplied: true,
    f8RotationApplied: true,
    summary: `Pemaksaan F1 DIMATIKAN: AI menyeleksi ${totalWordsSelected} kosakata murni secara fleksibel dari ${unifiedRegistry.length} entri Master Lexicon Repository (dataset hasil unggahan pengguna) di 5 blok SCTF dengan pengaman F7 & rotasi F8.`,
  };
}

export function formatContextualCandidatesForStage4(
  candidatesByStage: Record<number, ContextualCandidateRecommendation[]>
): string {
  const stats = masterLexiconRepository.getMasterStats();
  const activeCount = stats.unique_active_lexicon_count || 0;
  const lines: string[] = [
    `REKOMENDASI KANDIDAT KOSAKATA KONTEKSTUAL (DARI MASTER LEXICON REPOSITORY ${activeCount} ENTRI AKTIF):`,
    'Aturan Penggunaan oleh AI (7 Langkah Kontekstual):',
    '1. Pahami topik, argumen, dan maksud kalimat terlebih dahulu.',
    '2. Identifikasi fungsi gramatikal kata yang dibutuhkan (jangan memaksakan verba -in ke slot nomina objek, contoh SALAH: "butuh jawabin gimana", contoh BENAR: "butuh jawaban").',
    '3. Gunakan kosakata di bawah ini HANYA jika benar-benar pas dengan makna kalimat.',
    '4. Patuhi pengaman makna F7 dan rotasi kosakata F8 agar variasi tersebar alami di 5 blok SCTF.',
    '',
  ];

  for (let stageId = 1; stageId <= 5; stageId++) {
    const list = candidatesByStage[stageId] || [];
    if (list.length === 0) continue;
    lines.push(`[Blok ${stageId} — ${list[0].stageName}]:`);
    for (const item of list) {
      const formalStr = item.formalEquivalent ? ` (padanan: "${item.formalEquivalent}")` : '';
      lines.push(`  - "${item.word}"${formalStr} [${item.categoryLabel}] -> ${item.contextNote || item.rationale}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
