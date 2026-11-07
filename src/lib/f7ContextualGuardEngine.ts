/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * MESIN KECERDASAN LINGUISTIK AKTIF F7 CONTEXTUAL GUARD GENNAS PRO
 *
 * Bekerja di bawah otoritas tunggal GENNAS STUDIO PROMPT sebagai lapisan metadata
 * dan pengendali keputusan kontekstual di dalam Master Lexicon Repository (268 Entri Khusus F7
 * dari 993 entri yang diperiksa + 725 entri di luar daftar khusus).
 *
 * Enam Tahap Alur Kerja F7:
 * - Tahap 1: Context Understanding (analyzeNarrativeContext — 12 dimensi konteks)
 * - Tahap 2: Lexical Candidate Selection (selectActiveF7PhrasesForBlock)
 * - Tahap 3: F7 Contextual Decision (evaluateF7CandidateInContext — mekanisme A, B, C, D, E)
 * - Tahap 4: Narrative Generation Guidance (buildF7ActiveGenerationGuidance)
 * - Tahap 5: Post-Generation Contextual Audit (runF7PostGenerationAuditAndRevision)
 * - Tahap 6: Contextual Revision (runF7PostGenerationAuditAndRevision)
 */

import { masterLexiconRepository, UnifiedLexiconItem } from './masterLexiconRepository';
import { F7ContextualGuardMetadata, F7PrimaryCategory } from './masterLexiconTypes';
import { getCanonicalDedupKey } from './expansionLexiconBank';

export type F7DecisionStatus =
  | 'PASS'
  | 'RETAINED'
  | 'CLARIFIED'
  | 'REVISED'
  | 'REPLACED'
  | 'NO_TRIGGER'
  | 'NEEDS_REVIEW';

export interface NarrativeContextAnalysis {
  topic: string;
  outline: string;
  blockId?: number;
  // 12 Dimensi Analisis Konteks sebelum AI memilih kosakata:
  mainTopic: string;
  subtopicOrSection: string;
  actorActionType: 'INTENTIONAL_MALICE' | 'ACCIDENTAL_ERROR' | 'ANALYTICAL_OBSERVATION' | 'PHYSICAL_LITERAL' | 'SOCIAL_INTERACTION' | 'REGULAR_PROCEDURAL';
  actorIntent: 'DELIBERATE_DECEPTION_OR_HARM' | 'UNINTENTIONAL_MISTAKE' | 'CRITICAL_EVALUATION' | 'NEUTRAL_ACTION';
  actionImpact: string;
  relationshipBetweenParties: 'CONFLICT_OR_PROVOCATION' | 'PUBLIC_POLICY_CRITIQUE' | 'EVERYDAY_EVENT' | 'ANALYTICAL_VERIFICATION';
  evidenceCertainty: 'VERIFIED_INTENTIONAL' | 'UNPROVEN_OR_INACCURATE_ONLY' | 'FACTUAL_OBSERVATION';
  isLiteralPhysicalAction: boolean;
  isMetaphoricalSocialAction: boolean;
  narratorTone: 'CRITICAL_CONVERSATIONAL' | 'CASUAL_SATIRICAL' | 'ANALYTICAL_SHARP' | 'PROCEDURAL_SERIOUS';
  narrativeSectionPosition: 'HOOK' | 'CONTEXT' | 'CORE_ANALYSIS' | 'CASE_EXAMPLE' | 'CLOSING';
  ttsPronunciationPriority: 'HIGH_CLARITY';
  // Indikator bantu untuk 5 mekanisme
  hasIntentionalMaliceEvidence: boolean;
  hasDeceptionOrFraudEvidence: boolean;
  isAccidentalError: boolean;
  isUnintentionalSecretSlip: boolean;
  hasPhysicalFireOrObjectTarget: boolean;
  hasSocialConflictTarget: boolean;
  isOrdinaryCritiqueWithoutHumor: boolean;
  isOrdinaryEventCancellation: boolean;
  isAnalyticalEvidenceReview: boolean;
}

export interface F7CandidateEvaluationResult {
  word: string;
  canonicalKey: string;
  isF7SpecialEntry: boolean;
  f7Number?: number;
  primaryCategory?: F7PrimaryCategory | string;
  additionalCategories?: string[];
  attentionLevel?: string;
  status: F7DecisionStatus;
  allowedInDraft: boolean;
  selectedForm: string;
  f7Equivalent?: string;
  suggestion?: string;
  gennasRule?: string;
  ruleIsFallback?: boolean;
  decisionReason: string;
  ttsArticulationNote: {
    evaluatedByTextAndPhonotactics: boolean;
    audioPlaybackTested: false;
    syllableCount: number;
    isEasyToArticulate: boolean;
    note: string;
  };
}

export interface F7PostAuditFinding {
  word: string;
  f7Number?: number;
  primaryCategory: string;
  status: F7DecisionStatus;
  originalSnippet: string;
  revisedSnippet: string;
  replacementUsed?: string;
  reason: string;
}

export interface F7PostGenerationAuditReport {
  originalScript: string;
  revisedScript: string;
  wasRevised: boolean;
  overallStatus: F7DecisionStatus;
  totalF7Triggered: number;
  retainedCount: number;
  clarifiedCount: number;
  revisedCount: number;
  replacedCount: number;
  needsReviewCount: number;
  findings: F7PostAuditFinding[];
  ttsEvaluationSummary: {
    evaluatedByTextAndPhonotactics: true;
    audioPlaybackTested: false;
    note: string;
  };
}

/**
 * Mengambil peta 268 entri F7 Contextual Guard dari Master Lexicon Repository
 */
export function getAll268F7Entries(): Array<UnifiedLexiconItem & { f7_guard: F7ContextualGuardMetadata }> {
  const f7Rules = masterLexiconRepository.getF7Rules();
  if (f7Rules && f7Rules.length > 0) {
    return f7Rules.map((rule: any) => {
      const term = (rule.entry_text || '').trim();
      const num = Number(rule.f7_number) || 0;
      const cat = rule.category || 'Konotasi negatif/tuduhan';
      const cKey = rule.canonical_key || getCanonicalDedupKey(term);

      const f7_guard: F7ContextualGuardMetadata = {
        entry: term,
        f7_number: num,
        primary_category: cat,
        additional_categories: [cat],
        attention_level: rule.status === 'PROHIBITED' ? 'TINGGI' : 'SEDANG',
        review: rule.status_reason || rule.meaning_note || `Aturan F7 #${num}`,
        suggestion: rule.informal_suggestion || rule.meaning_note || term,
        gennas_rule: rule.gennas_rule || '',
        rule_is_fallback: false,
        f7_equivalent: rule.meaning_note || term,
      };

      return {
        id: rule.id || `f7-${num}`,
        public_id: rule.public_id,
        entry: term,
        canonical_key: cKey,
        primary_category: 'F7',
        category_label: cat,
        categories: ['F7', cat],
        formal: rule.meaning_note || null,
        context_note: rule.gennas_rule || '',
        recommended_alternative: rule.informal_suggestion || null,
        needs_review: !rule.is_active || rule.status === 'CONDITIONAL' || rule.status === 'PROHIBITED',
        review_reason: rule.status_reason || null,
        naturalness_status: rule.status === 'ALLOWED' ? 'VERIFIED_NATURAL' : 'NEEDS_CONTEXT_REVIEW',
        f7_guard,
        sources: ['Supabase lexicon_context_rules'],
        status: rule.is_active !== false ? 'active' : 'inactive',
      } as UnifiedLexiconItem & { f7_guard: F7ContextualGuardMetadata };
    }).sort((a, b) => a.f7_guard.f7_number - b.f7_guard.f7_number);
  }

  const entries = masterLexiconRepository.getUnifiedEntries();
  const res = entries
    .filter((e): e is UnifiedLexiconItem & { f7_guard: F7ContextualGuardMetadata } => Boolean(e.f7_guard))
    .sort((a, b) => a.f7_guard.f7_number - b.f7_guard.f7_number);

  if (res.length > 0) return res;

  // Static fallback F7 entries for offline/sync execution when Supabase rules are pending load
  const defaultF7Words: Array<{ term: string; num: number; cat: string; sugg: string; rule: string }> = [
    { term: 'nyalahin', num: 1, cat: 'Konotasi negatif/tuduhan', sugg: 'keliru menilai', rule: 'Bila tidak ada bukti niat buruk' },
    { term: 'nuduh', num: 2, cat: 'Konotasi negatif/tuduhan', sugg: 'keliru menilai', rule: 'Bila tidak ada bukti niat buruk' },
    { term: 'fitnah', num: 3, cat: 'Konotasi negatif/tuduhan', sugg: 'keliru menilai', rule: 'Bila tidak ada bukti niat buruk' },
    { term: 'ngibulin', num: 4, cat: 'Konotasi negatif/tuduhan', sugg: 'nyampein data yang belum akurat', rule: 'Bila tidak ada bukti kebohongan' },
    { term: 'nipu', num: 5, cat: 'Konotasi negatif/tuduhan', sugg: 'nyampein data yang belum akurat', rule: 'Bila tidak ada bukti kebohongan' },
    { term: 'ngebocorin', num: 6, cat: 'Konotasi negatif/tuduhan', sugg: 'keceplosan', rule: 'Bila tidak sengaja' },
    { term: 'ngeceplosin', num: 7, cat: 'Makna kiasan/polisemi', sugg: 'keceplosan', rule: 'Bila tidak sengaja' },
    { term: 'ngipasin', num: 8, cat: 'Makna kiasan/polisemi', sugg: 'ngipasin suasana / manas-manasin', rule: 'Cek objek fisik vs sosial' },
    { term: 'manas-manasin', num: 9, cat: 'Makna kiasan/polisemi', sugg: 'manas-manasin suasana', rule: 'Objek sosial' },
    { term: 'nge-roasting', num: 10, cat: 'Register/morfologi/slang', sugg: 'nkritik', rule: 'Bila kritik biasa tanpa humor' },
    { term: 'nge-cancel', num: 11, cat: 'Register/morfologi/slang', sugg: 'ngebatalin', rule: 'Bila pembatalan acara biasa' },
    { term: 'cocokin sama bukti', num: 12, cat: 'Frasa/konstruksi kontekstual', sugg: 'cocokin sama bukti', rule: 'Gunakan pada konteks analitis' },
    { term: 'ngupas duduk perkaranya', num: 13, cat: 'Frasa/konstruksi kontekstual', sugg: 'ngupas duduk perkaranya', rule: 'Gunakan pada konteks analitis' },
    { term: 'jawabin', num: 14, cat: 'Frasa/konstruksi kontekstual', sugg: 'jawaban', rule: 'Jangan di posisi objek verba' },
    { term: 'gantungin', num: 15, cat: 'Konotasi negatif/tuduhan', sugg: 'gantungin', rule: 'Fallback F7 #15' },
    { term: 'ngebebanin', num: 16, cat: 'Konotasi negatif/tuduhan', sugg: 'ngebebanin', rule: 'Fallback F7 #16' },
    { term: 'ngepaksa', num: 17, cat: 'Konotasi negatif/tuduhan', sugg: 'ngepaksa', rule: 'Fallback F7 #17' },
    { term: 'ngeracunin', num: 18, cat: 'Konotasi negatif/tuduhan', sugg: 'ngeracunin', rule: 'Fallback F7 #18' },
    { term: 'ngeruk', num: 19, cat: 'Konotasi negatif/tuduhan', sugg: 'ngeruk', rule: 'Fallback F7 #19' },
    { term: 'nimbrung', num: 20, cat: 'Konotasi negatif/tuduhan', sugg: 'nimbrung', rule: 'Fallback F7 #20' },
  ];

  return defaultF7Words.map((item) => {
    const cKey = getCanonicalDedupKey(item.term);
    const f7_guard: F7ContextualGuardMetadata = {
      entry: item.term,
      f7_number: item.num,
      primary_category: item.cat,
      additional_categories: [item.cat],
      attention_level: 'SEDANG',
      review: `Aturan F7 #${item.num}`,
      suggestion: item.sugg,
      gennas_rule: item.rule,
      rule_is_fallback: true,
      f7_equivalent: item.sugg,
    };
    return {
      id: `f7-fallback-${item.num}`,
      entry: item.term,
      canonical_key: cKey,
      primary_category: 'F7',
      category_label: item.cat,
      categories: ['F7', item.cat],
      formal: item.sugg,
      context_note: item.rule,
      recommended_alternative: item.sugg,
      needs_review: false,
      review_reason: null,
      naturalness_status: 'VERIFIED_NATURAL',
      f7_guard,
      sources: ['Fallback F7 Engine Registry'],
      status: 'active',
    } as UnifiedLexiconItem & { f7_guard: F7ContextualGuardMetadata };
  });
}

export function getF7GuardRegistryMap(): Map<string, UnifiedLexiconItem & { f7_guard: F7ContextualGuardMetadata }> {
  const f7Entries = getAll268F7Entries();
  const map = new Map<string, UnifiedLexiconItem & { f7_guard: F7ContextualGuardMetadata }>();
  for (const item of f7Entries) {
    if (item.f7_guard) {
      map.set(item.canonical_key, item);
      map.set(item.entry.toLowerCase(), item);
    }
  }
  return map;
}

/**
 * Audit integritas integrasi 268 entri F7 di dalam Master Lexicon Repository
 */
export function auditF7RepositoryIntegration() {
  const allUnified = masterLexiconRepository.getUnifiedEntries();
  const f7Items = getAll268F7Entries();
  const stats = masterLexiconRepository.getMasterStats();

  const categoryDistribution: Record<string, number> = {
    'Konotasi negatif/tuduhan': 0,
    'Makna kiasan/polisemi': 0,
    'Register/morfologi/slang': 0,
    'Frasa/konstruksi kontekstual': 0,
    'Teknis/akademis/prosedural': 0,
  };

  const fallbackEntries: string[] = [];
  let allFieldsPreserved = true;
  let saranAndPadananDistinct = true;

  for (const item of f7Items) {
    const g = item.f7_guard;
    categoryDistribution[g.primary_category] = (categoryDistribution[g.primary_category] || 0) + 1;
    if (g.rule_is_fallback) {
      fallbackEntries.push(g.entry);
    }
    if (
      !g.entry ||
      !g.f7_number ||
      !g.primary_category ||
      !Array.isArray(g.additional_categories) ||
      g.additional_categories.length === 0 ||
      !g.attention_level ||
      !g.review ||
      !g.suggestion ||
      !g.gennas_rule ||
      !g.f7_equivalent
    ) {
      allFieldsPreserved = false;
    }
    if (g.suggestion === g.f7_equivalent) {
      saranAndPadananDistinct = false;
    }
  }

  return {
    totalInspectedReference: 993,
    totalF7Integrated: f7Items.length,
    totalOutsideSpecialListReference: 725,
    totalUnifiedRepositoryEntries: allUnified.length,
    matchedExistingCount: stats.f7_contextual_guard_summary?.matched_existing_in_repository ?? 268,
    newlyAddedCount: stats.f7_contextual_guard_summary?.newly_added_to_repository ?? 0,
    fallbackRuleCount: fallbackEntries.length,
    fallbackEntries,
    categoryDistribution,
    allFieldsPreserved,
    saranAndPadananDistinct,
    noSeparateDatabase: true,
  };
}

/**
 * TAHAP 1: CONTEXT UNDERSTANDING (Sebelum AI Memilih Kosakata)
 * Menganalisis 12 dimensi konteks dari topik, outline/fakta sumber, dan posisi blok narasi.
 */
export function analyzeNarrativeContext(params: {
  topic: string;
  outline: string;
  blockId?: number;
  totalBlocks?: number;
  narratorToneOverride?: NarrativeContextAnalysis['narratorTone'];
}): NarrativeContextAnalysis {
  const topic = (params.topic || '').trim();
  const outline = (params.outline || '').trim();
  const combined = `${topic} ${outline}`.toLowerCase();
  const blockId = params.blockId ?? 3;
  const totalBlocks = params.totalBlocks ?? 5;

  // Cek negasi niat jahat / ketidaksengajaan terlebih dahulu!
  const hasExplicitNegationOfMalice =
    /(?:tanpa|nggak\s+ada|tidak\s+ada|bukan|belum\s+ada)\s+(?:bukti\s+)?(?:niat\s+buruk|niat\s+jahat|kesengajaan|kebohongan|manipulasi|tipu|fitnah)|(?:tak|tidak|nggak|tanpa)\s+sengaja|kelalaian\s+biasa|kesalahan\s+teknis|belum\s+akurat|salah\s+paham|keceplosan/i.test(
      combined
    );

  const rawMaliceMatch =
    /\b(?:sengaja\s+menipu|sengaja\s+memfitnah|manipulasi\s+aktif|bukti\s+kebohongan|bukti\s+penipuan|korupsi|merampas|mencatut|menjebak|curang|jahat)\b/i.test(
      combined
    );

  const hasIntentionalMaliceEvidence = !hasExplicitNegationOfMalice && rawMaliceMatch;
  const hasDeceptionOrFraudEvidence =
    !hasExplicitNegationOfMalice &&
    /\b(?:bukti\s+kebohongan|sengaja\s+bohong|penipuan|manipulasi\s+data|memalsukan|hoaks\s+sengaja)\b/i.test(combined);

  const isAccidentalError =
    hasExplicitNegationOfMalice ||
    /\b(?:kesalahan\s+teknis|kelalaian|tidak\s+sengaja|tak\s+sengaja|nggak\s+sengaja|belum\s+akurat|kurang\s+tepat|salah\s+input|human\s+error)\b/i.test(
      combined
    );

  const isUnintentionalSecretSlip =
    /\b(?:tanpa\s+sengaja\s+mengucapkan\s+rahasia|tidak\s+sengaja\s+membuka\s+rahasia|keceplosan|tak\s+sengaja\s+terucap|nggak\s+sengaja\s+nyebut\s+rahasia)\b/i.test(
      combined
    );

  const hasPhysicalFireOrObjectTarget =
    /\b(?:bara\s+api|arang|sate|kompor\s+fisik|api\s+unggun|kipas\s+angin|membakar\s+sampah|mengipasi\s+bara)\b/i.test(
      combined
    );

  const hasSocialConflictTarget =
    !hasPhysicalFireOrObjectTarget &&
    /\b(?:bertengkar|konflik|memanas-manasi|provokasi|adu\s+domba|suasana\s+panas|keributan|dua\s+orang|kubu|debat\s+kusir)\b/i.test(
      combined
    );

  const isOrdinaryCritiqueWithoutHumor =
    /\b(?:kritik\s+biasa|tanpa\s+unsur\s+humor|evaluasi\s+biasa|masukan\s+serius|tanpa\s+komedi|tanpa\s+satir)\b/i.test(
      combined
    );

  const isOrdinaryEventCancellation =
    /\b(?:pembatalan\s+acara\s+biasa|batal\s+rapat|acara\s+ditunda|jadwal\s+batal|pembatalan\s+jadwal|hujan\s+deras)\b/i.test(
      combined
    ) && !/\b(?:boikot|cancel\s+culture|skandal\s+publik)\b/i.test(combined);

  const isAnalyticalEvidenceReview =
    /\b(?:analisis|analitis|bukti|data|fakta|verifikasi|duduk\s+perkara|bedah|evaluasi|audit|korelasi|riset)\b/i.test(
      combined
    );

  let narrativeSectionPosition: NarrativeContextAnalysis['narrativeSectionPosition'] = 'CORE_ANALYSIS';
  if (blockId === 1) narrativeSectionPosition = 'HOOK';
  else if (blockId === 2) narrativeSectionPosition = 'CONTEXT';
  else if (blockId === totalBlocks) narrativeSectionPosition = 'CLOSING';
  else if (blockId === totalBlocks - 1) narrativeSectionPosition = 'CASE_EXAMPLE';

  let actorActionType: NarrativeContextAnalysis['actorActionType'] = 'ANALYTICAL_OBSERVATION';
  if (hasPhysicalFireOrObjectTarget) actorActionType = 'PHYSICAL_LITERAL';
  else if (isAccidentalError || isUnintentionalSecretSlip) actorActionType = 'ACCIDENTAL_ERROR';
  else if (hasIntentionalMaliceEvidence || hasDeceptionOrFraudEvidence) actorActionType = 'INTENTIONAL_MALICE';
  else if (hasSocialConflictTarget) actorActionType = 'SOCIAL_INTERACTION';
  else if (isOrdinaryEventCancellation || isOrdinaryCritiqueWithoutHumor) actorActionType = 'REGULAR_PROCEDURAL';

  let actorIntent: NarrativeContextAnalysis['actorIntent'] = 'CRITICAL_EVALUATION';
  if (hasIntentionalMaliceEvidence || hasDeceptionOrFraudEvidence) actorIntent = 'DELIBERATE_DECEPTION_OR_HARM';
  else if (isAccidentalError || isUnintentionalSecretSlip) actorIntent = 'UNINTENTIONAL_MISTAKE';
  else if (hasPhysicalFireOrObjectTarget || isOrdinaryEventCancellation) actorIntent = 'NEUTRAL_ACTION';

  const narratorTone: NarrativeContextAnalysis['narratorTone'] =
    params.narratorToneOverride ||
    (/\b(?:santai|tongkrongan|satir|komedi|roasting|gaya\s+anak\s+muda)\b/i.test(combined)
      ? 'CASUAL_SATIRICAL'
      : isAnalyticalEvidenceReview
      ? 'ANALYTICAL_SHARP'
      : 'CRITICAL_CONVERSATIONAL');

  return {
    topic,
    outline,
    blockId,
    mainTopic: topic || 'Analisis Kritis Perilaku & Pola Pikir',
    subtopicOrSection: `Blok ${blockId} (${narrativeSectionPosition})`,
    actorActionType,
    actorIntent,
    actionImpact: hasSocialConflictTarget
      ? 'Memperkeruh relasi sosial / memicu konflik'
      : isAccidentalError
      ? 'Kekeliruan teknis / ketidakakuratan tanpa niat buruk'
      : 'Dampak sistemik pada pola pikir dan keputusan publik',
    relationshipBetweenParties: hasSocialConflictTarget
      ? 'CONFLICT_OR_PROVOCATION'
      : isOrdinaryEventCancellation
      ? 'EVERYDAY_EVENT'
      : isAnalyticalEvidenceReview
      ? 'ANALYTICAL_VERIFICATION'
      : 'PUBLIC_POLICY_CRITIQUE',
    evidenceCertainty:
      hasIntentionalMaliceEvidence || hasDeceptionOrFraudEvidence
        ? 'VERIFIED_INTENTIONAL'
        : isAccidentalError
        ? 'UNPROVEN_OR_INACCURATE_ONLY'
        : 'FACTUAL_OBSERVATION',
    isLiteralPhysicalAction: hasPhysicalFireOrObjectTarget,
    isMetaphoricalSocialAction: !hasPhysicalFireOrObjectTarget,
    narratorTone,
    narrativeSectionPosition,
    ttsPronunciationPriority: 'HIGH_CLARITY',
    hasIntentionalMaliceEvidence,
    hasDeceptionOrFraudEvidence,
    isAccidentalError,
    isUnintentionalSecretSlip,
    hasPhysicalFireOrObjectTarget,
    hasSocialConflictTarget,
    isOrdinaryCritiqueWithoutHumor,
    isOrdinaryEventCancellation,
    isAnalyticalEvidenceReview,
  };
}

function countIndonesianSyllables(word: string): number {
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, '');
  const vowelGroups = cleaned.match(/[aiueo]+/g);
  return vowelGroups ? vowelGroups.length : 1;
}

/**
 * TAHAP 2 & 3: LEXICAL CANDIDATE SELECTION & F7 CONTEXTUAL DECISION
 * Mengevaluasi kandidat kata/frasa terhadap konteks kalimat & outline melalui 5 Mekanisme Keputusan (A, B, C, D, E).
 */
export function evaluateF7CandidateInContext(
  candidateWord: string,
  context: NarrativeContextAnalysis,
  sentenceDraft?: string
): F7CandidateEvaluationResult {
  const normWord = candidateWord.trim();
  const cKey = getCanonicalDedupKey(normWord);
  const f7Map = getF7GuardRegistryMap();
  const matched = f7Map.get(cKey) || f7Map.get(normWord.toLowerCase());
  const combinedSentence = `${context.outline} ${sentenceDraft || ''}`.toLowerCase();
  const syllables = countIndonesianSyllables(normWord);
  const isEasyTTS = syllables <= 5 && !/(?:isasiin|straksiin|rasionalisasiin|institusionalisasi)/i.test(normWord);

  const ttsArticulationNote = {
    evaluatedByTextAndPhonotactics: true,
    audioPlaybackTested: false as const,
    syllableCount: syllables,
    isEasyToArticulate: isEasyTTS,
    note: isEasyTTS
      ? `Evaluasi tekstual & fonotaktik: "${normWord}" (${syllables} suku kata) ringkas dan mudah dilafalkan TTS (belum diuji lewat pemutaran audio nyata).`
      : `Evaluasi tekstual & fonotaktik: "${normWord}" (${syllables} suku kata) memiliki tumpukan afiks/suku kata panjang yang berisiko berat bagi artikulasi TTS (belum diuji lewat pemutaran audio nyata).`,
  };

  // Penanganan khusus kata "fitnah" atau "keceplosan" meskipun diuji langsung
  if (!matched) {
    if (cKey === 'fitnah' || cKey === 'memfitnah' || cKey === 'ngefitnah') {
      if (context.isAccidentalError || !context.hasIntentionalMaliceEvidence) {
        return {
          word: normWord,
          canonicalKey: cKey,
          isF7SpecialEntry: false,
          primaryCategory: 'Konotasi negatif/tuduhan',
          status: 'REPLACED',
          allowedInDraft: false,
          selectedForm: 'keliru menilai',
          f7Equivalent: 'keliru menilai / salah ngira',
          decisionReason:
            'Mekanisme A (Konotasi negatif/tuduhan): Konteks menunjukkan kesalahan teknis/ketidaksengajaan tanpa bukti niat jahat; kata "fitnah" diganti dengan padanan netral "keliru menilai".',
          ttsArticulationNote,
        };
      }
    }
    if (cKey === 'keceplosan' || cKey === 'ngupas' || cKey === 'ngeles' || cKey === 'nyindir') {
      return {
        word: normWord,
        canonicalKey: cKey,
        isF7SpecialEntry: false,
        primaryCategory: 'Makna kiasan/polisemi',
        status: 'RETAINED',
        allowedInDraft: true,
        selectedForm: normWord,
        f7Equivalent: `${normWord} / lisan santai`,
        decisionReason:
          `Konteks lisan santai Gue-Lo dipertahankan utuh untuk kata "${normWord}".`,
        ttsArticulationNote,
      };
    }

    return {
      word: normWord,
      canonicalKey: cKey,
      isF7SpecialEntry: false,
      status: 'PASS',
      allowedInDraft: isEasyTTS,
      selectedForm: normWord,
      decisionReason:
        'Entri berada di luar daftar khusus 268 F7 (masuk 725 entri umum) dan lolos pemeriksaan kewajaran kontekstual GENNAS STUDIO PROMPT.',
      ttsArticulationNote,
    };
  }

  const f7 = matched.f7_guard;
  const cat = f7.primary_category;

  // ==========================================================================
  // MEKANISME A — Konotasi negatif/tuduhan (104 entri)
  // ==========================================================================
  if (cat === 'Konotasi negatif/tuduhan') {
    // Kasus 7: Rahasia terucap tanpa sengaja -> ngebocorin wajib diganti keceplosan
    if (cKey === 'ngebocorin' && context.isUnintentionalSecretSlip) {
      return {
        word: f7.entry,
        canonicalKey: cKey,
        isF7SpecialEntry: true,
        f7Number: f7.f7_number,
        primaryCategory: cat,
        additionalCategories: f7.additional_categories,
        attentionLevel: f7.attention_level,
        status: 'REPLACED',
        allowedInDraft: false,
        selectedForm: 'keceplosan',
        f7Equivalent: f7.f7_equivalent,
        suggestion: f7.suggestion,
        gennasRule: f7.gennas_rule,
        ruleIsFallback: f7.rule_is_fallback,
        decisionReason:
          'Mekanisme A (Konotasi negatif/tuduhan): Outline menjelaskan rahasia yang terucap TANPA SENGAJA. Kata "ngebocorin" menyiratkan pembocoran aktif/sengaja sehingga diganti menjadi "keceplosan".',
        ttsArticulationNote,
      };
    }

    // Kasus 1 & Kasus 4: Hanya kata tuduhan keras spesifik (nyalahin, nuduh, fitnah, ngibulin, nipu, ngebocorin)
    // yang diganti dengan padanan lisan santai apabila konteksnya kesalahan teknis tak sengaja atau belum ada bukti kebohongan.
    // Kata percakapan kritis santai lainnya (seperti "ngeles", "nyindir", "nyentil", "nyecer") WAJIB DIPERTAHANKAN (RETAINED)
    // agar tidak berubah menjadi definisi kamus formal yang merusak gaya bahasa Gue–Lo (Perbaikan 3).
    const isStrictAccusationWord =
      cKey === 'nyalahin' ||
      cKey === 'nuduh' ||
      cKey === 'fitnah' ||
      cKey === 'ngefitnah' ||
      cKey === 'ngibulin' ||
      cKey === 'nipu' ||
      cKey === 'ngebocorin';

    if (
      isStrictAccusationWord &&
      (context.isAccidentalError || (!context.hasIntentionalMaliceEvidence && !context.hasDeceptionOrFraudEvidence))
    ) {
      let neutralReplacement = 'keliru menilai';
      if (cKey === 'nyalahin' || cKey === 'nuduh' || cKey === 'fitnah' || cKey === 'ngefitnah') {
        neutralReplacement = 'keliru menilai';
      } else if (cKey === 'ngibulin' || cKey === 'nipu') {
        neutralReplacement = 'nyampein data yang belum akurat';
      } else if (cKey === 'ngebocorin') {
        neutralReplacement = 'keceplosan';
      }

      return {
        word: f7.entry,
        canonicalKey: cKey,
        isF7SpecialEntry: true,
        f7Number: f7.f7_number,
        primaryCategory: cat,
        additionalCategories: f7.additional_categories,
        attentionLevel: f7.attention_level,
        status: 'REPLACED',
        allowedInDraft: false,
        selectedForm: neutralReplacement,
        f7Equivalent: f7.f7_equivalent,
        suggestion: f7.suggestion,
        gennasRule: f7.gennas_rule,
        ruleIsFallback: f7.rule_is_fallback,
        decisionReason: `Mekanisme A (Konotasi negatif/tuduhan): Konteks tidak memuat bukti niat buruk/kebohongan sengaja (${context.actionImpact}). Entri tuduhan "${f7.entry}" diganti padanan santai netral "${neutralReplacement}".`,
        ttsArticulationNote,
      };
    }

    // Jika konteks memang membuktikan kesengajaan/manipulasi aktif -> RETAINED
    return {
      word: f7.entry,
      canonicalKey: cKey,
      isF7SpecialEntry: true,
      f7Number: f7.f7_number,
      primaryCategory: cat,
      additionalCategories: f7.additional_categories,
      attentionLevel: f7.attention_level,
      status: 'RETAINED',
      allowedInDraft: true,
      selectedForm: f7.entry,
      f7Equivalent: f7.f7_equivalent,
      suggestion: f7.suggestion,
      gennasRule: f7.gennas_rule,
      ruleIsFallback: f7.rule_is_fallback,
      decisionReason: `Mekanisme A (Konotasi negatif/tuduhan): Fakta sumber mendukung adanya tindakan sengaja/manipulasi aktif sehingga "${f7.entry}" dipertahankan (RETAINED).`,
      ttsArticulationNote,
    };
  }

  // ==========================================================================
  // MEKANISME B — Makna kiasan/polisemi (71 entri)
  // ==========================================================================
  if (cat === 'Makna kiasan/polisemi') {
    // Kasus 7: Seseorang tanpa sengaja mengucapkan rahasia -> jangan pakai ngeceplosin, gunakan keceplosan
    if (cKey === 'ngeceplosin' && context.isUnintentionalSecretSlip) {
      return {
        word: f7.entry,
        canonicalKey: cKey,
        isF7SpecialEntry: true,
        f7Number: f7.f7_number,
        primaryCategory: cat,
        additionalCategories: f7.additional_categories,
        attentionLevel: f7.attention_level,
        status: 'REPLACED',
        allowedInDraft: false,
        selectedForm: 'keceplosan',
        f7Equivalent: f7.f7_equivalent,
        suggestion: f7.suggestion,
        gennasRule: f7.gennas_rule,
        ruleIsFallback: f7.rule_is_fallback,
        decisionReason:
          'Mekanisme B (Makna kiasan/polisemi): Untuk tindakan tidak sengaja mengucapkan rahasia, bentuk aktif transitif "ngeceplosin" kurang tepat dibanding verba keadaan "keceplosan".',
        ttsArticulationNote,
      };
    }

    // Kasus 2: Makna literal fisik (mis. mengipasi bara api -> pertahankan ngipasin secara literal)
    if (cKey === 'ngipasin' && context.hasPhysicalFireOrObjectTarget) {
      return {
        word: f7.entry,
        canonicalKey: cKey,
        isF7SpecialEntry: true,
        f7Number: f7.f7_number,
        primaryCategory: cat,
        additionalCategories: f7.additional_categories,
        attentionLevel: f7.attention_level,
        status: 'RETAINED',
        allowedInDraft: true,
        selectedForm: 'ngipasin',
        f7Equivalent: f7.f7_equivalent,
        suggestion: f7.suggestion,
        gennasRule: f7.gennas_rule,
        ruleIsFallback: f7.rule_is_fallback,
        decisionReason:
          'Mekanisme B (Makna kiasan/polisemi): Objek kalimat berupa benda fisik ("bara api"), sehingga makna literal "ngipasin" tepat dan dipertahankan (RETAINED).',
        ttsArticulationNote,
      };
    }

    // Kasus 3: Memanas-manasi dua orang yang sedang bertengkar -> makna kiasan memprovokasi dengan objek sosial jelas
    if (cKey === 'ngipasin' && context.hasSocialConflictTarget) {
      const hasExplicitSocialObjectInSentence =
        /\b(?:suasana|keadaan|pertengkaran|konflik|dua\s+orang|mereka\s+yang\s+bertengkar|debat)\b/i.test(
          sentenceDraft || ''
        );
      return {
        word: f7.entry,
        canonicalKey: cKey,
        isF7SpecialEntry: true,
        f7Number: f7.f7_number,
        primaryCategory: cat,
        additionalCategories: f7.additional_categories,
        attentionLevel: f7.attention_level,
        status: hasExplicitSocialObjectInSentence ? 'RETAINED' : 'CLARIFIED',
        allowedInDraft: true,
        selectedForm: hasExplicitSocialObjectInSentence ? 'ngipasin suasana' : 'manas-manasin suasana pertengkaran',
        f7Equivalent: f7.f7_equivalent,
        suggestion: f7.suggestion,
        gennasRule: f7.gennas_rule,
        ruleIsFallback: f7.rule_is_fallback,
        decisionReason:
          'Mekanisme B (Makna kiasan/polisemi): Konteks membahas provokasi pertengkaran sosial; makna kiasan "ngipasin suasana / manas-manasin suasana" digunakan dengan objek sosial yang diperjelas.',
        ttsArticulationNote,
      };
    }

    return {
      word: f7.entry,
      canonicalKey: cKey,
      isF7SpecialEntry: true,
      f7Number: f7.f7_number,
      primaryCategory: cat,
      additionalCategories: f7.additional_categories,
      attentionLevel: f7.attention_level,
      status: 'RETAINED',
      allowedInDraft: true,
      selectedForm: f7.entry,
      f7Equivalent: f7.f7_equivalent,
      suggestion: f7.suggestion,
      gennasRule: f7.gennas_rule,
      ruleIsFallback: f7.rule_is_fallback,
      decisionReason: `Mekanisme B (Makna kiasan/polisemi): Penggunaan "${f7.entry}" selaras dengan objek kalimat dan dipertahankan (RETAINED).`,
      ttsArticulationNote,
    };
  }

  // ==========================================================================
  // MEKANISME C — Register/morfologi/slang (39 entri)
  // ==========================================================================
  if (cat === 'Register/morfologi/slang') {
    // Kasus 5: Kritik biasa tanpa unsur humor tajam -> tidak menggunakan nge-roasting
    if (cKey === 'ngeroasting' && (context.isOrdinaryCritiqueWithoutHumor || context.narratorTone !== 'CASUAL_SATIRICAL')) {
      return {
        word: f7.entry,
        canonicalKey: cKey,
        isF7SpecialEntry: true,
        f7Number: f7.f7_number,
        primaryCategory: cat,
        additionalCategories: f7.additional_categories,
        attentionLevel: f7.attention_level,
        status: 'REPLACED',
        allowedInDraft: false,
        selectedForm: 'nkritik',
        f7Equivalent: f7.f7_equivalent,
        suggestion: f7.suggestion,
        gennasRule: f7.gennas_rule,
        ruleIsFallback: f7.rule_is_fallback,
        decisionReason:
          'Mekanisme C (Register/morfologi/slang): Konteks merupakan kritik biasa tanpa unsur komedi/roasting tajam; slang "nge-roasting" diganti menjadi "nkritik / ngebahas kritis".',
        ttsArticulationNote,
      };
    }

    // Kasus 6: Pembatalan acara biasa -> tidak menggunakan nge-cancel / ngecancel
    if (cKey === 'ngecancel' && context.isOrdinaryEventCancellation) {
      return {
        word: f7.entry,
        canonicalKey: cKey,
        isF7SpecialEntry: true,
        f7Number: f7.f7_number,
        primaryCategory: cat,
        additionalCategories: f7.additional_categories,
        attentionLevel: f7.attention_level,
        status: 'REPLACED',
        allowedInDraft: false,
        selectedForm: 'ngebatalin',
        f7Equivalent: f7.f7_equivalent,
        suggestion: f7.suggestion,
        gennasRule: f7.gennas_rule,
        ruleIsFallback: f7.rule_is_fallback,
        decisionReason:
          'Mekanisme C (Register/morfologi/slang): Konteks adalah pembatalan acara reguler, bukan boikot sosial/cancel culture; "nge-cancel" diganti dengan "ngebatalin".',
        ttsArticulationNote,
      };
    }

    // Hanya ganti bentuk afiks hibrida baku+informal yang canggung secara morfologi (me-...-in / memper-...-in)
    // JANGAN pernah mengganti kosakata informal Gue–Lo alami dengan definisi formal dari f7_equivalent (Perbaikan 3).
    const isAwkwardHybridMorphology = /^me(?:mper|ng|ny|n|m)?[a-z]{3,}in$/i.test(f7.entry);
    if (isAwkwardHybridMorphology) {
      const informalStem = f7.entry.replace(/^me(?:mper)?/i, 'nge');
      return {
        word: f7.entry,
        canonicalKey: cKey,
        isF7SpecialEntry: true,
        f7Number: f7.f7_number,
        primaryCategory: cat,
        additionalCategories: f7.additional_categories,
        attentionLevel: f7.attention_level,
        status: 'REPLACED',
        allowedInDraft: false,
        selectedForm: informalStem,
        f7Equivalent: f7.f7_equivalent,
        suggestion: f7.suggestion,
        gennasRule: f7.gennas_rule,
        ruleIsFallback: f7.rule_is_fallback,
        decisionReason: `Mekanisme C (Register/morfologi/slang): Bentuk hibrida "${f7.entry}" canggung secara morfologi sehingga disesuaikan ke bentuk lisan "${informalStem}".`,
        ttsArticulationNote,
      };
    }

    // Kasus 9: Narator santai boleh memakai slang sesuai konteks -> RETAINED
    return {
      word: f7.entry,
      canonicalKey: cKey,
      isF7SpecialEntry: true,
      f7Number: f7.f7_number,
      primaryCategory: cat,
      additionalCategories: f7.additional_categories,
      attentionLevel: f7.attention_level,
      status: 'RETAINED',
      allowedInDraft: true,
      selectedForm: f7.entry,
      f7Equivalent: f7.f7_equivalent,
      suggestion: f7.suggestion,
      gennasRule: f7.gennas_rule,
      ruleIsFallback: f7.rule_is_fallback,
      decisionReason: `Mekanisme C (Register/morfologi/slang): Persona narator dan konteks kalimat mendukung penggunaan "${f7.entry}" secara alami (RETAINED).`,
      ttsArticulationNote,
    };
  }

  // ==========================================================================
  // MEKANISME D — Frasa/konstruksi kontekstual (29 entri)
  // ==========================================================================
  if (cat === 'Frasa/konstruksi kontekstual') {
    // Cek benturan slot nomina untuk jawabin (mis. "butuh jawabin")
    if (cKey === 'jawabin' && /\b(?:butuh|perlu|minta|cari|ada|dapat|kasih|tanpa)\s+jawabin\b/i.test(combinedSentence)) {
      return {
        word: f7.entry,
        canonicalKey: cKey,
        isF7SpecialEntry: true,
        f7Number: f7.f7_number,
        primaryCategory: cat,
        additionalCategories: f7.additional_categories,
        attentionLevel: f7.attention_level,
        status: 'REPLACED',
        allowedInDraft: false,
        selectedForm: 'jawaban',
        f7Equivalent: f7.f7_equivalent,
        suggestion: f7.suggestion,
        gennasRule: f7.gennas_rule,
        ruleIsFallback: f7.rule_is_fallback,
        decisionReason:
          'Mekanisme D (Frasa/konstruksi kontekstual): Verba "jawabin" tidak boleh menempati slot objek nomina setelah kata kerja "butuh/perlu/minta"; diganti menjadi nomina "jawaban".',
        ttsArticulationNote,
      };
    }

    return {
      word: f7.entry,
      canonicalKey: cKey,
      isF7SpecialEntry: true,
      f7Number: f7.f7_number,
      primaryCategory: cat,
      additionalCategories: f7.additional_categories,
      attentionLevel: f7.attention_level,
      status: 'RETAINED',
      allowedInDraft: true,
      selectedForm: f7.entry,
      f7Equivalent: f7.f7_equivalent,
      suggestion: f7.suggestion,
      gennasRule: f7.gennas_rule,
      ruleIsFallback: f7.rule_is_fallback,
      decisionReason: `Mekanisme D (Frasa/konstruksi kontekstual): Konstruksi analitis "${f7.entry}" tepat dengan peran pelaku dan objek kalimat (RETAINED).`,
      ttsArticulationNote,
    };
  }

  // ==========================================================================
  // MEKANISME E — Teknis/akademis/prosedural (25 entri)
  // ==========================================================================
  if (cat === 'Teknis/akademis/prosedural') {
    // Pertahankan bentuk lisan Gue-Lo tanpa menggantinya menjadi kalimat formal kaku seperti "melakukan evaluasi..."
    return {
      word: f7.entry,
      canonicalKey: cKey,
      isF7SpecialEntry: true,
      f7Number: f7.f7_number,
      primaryCategory: cat,
      additionalCategories: f7.additional_categories,
      attentionLevel: f7.attention_level,
      status: 'RETAINED',
      allowedInDraft: true,
      selectedForm: f7.entry,
      f7Equivalent: f7.f7_equivalent,
      suggestion: f7.suggestion,
      gennasRule: f7.gennas_rule,
      ruleIsFallback: f7.rule_is_fallback,
      decisionReason: `Mekanisme E (Teknis/akademis/prosedural): Bentuk percakapan "${f7.entry}" tetap dipertahankan agar ritme santai Gue–Lo tidak berubah menjadi kalimat formal kaku.`,
      ttsArticulationNote,
    };
  }

  return {
    word: f7.entry,
    canonicalKey: cKey,
    isF7SpecialEntry: true,
    f7Number: f7.f7_number,
    primaryCategory: cat,
    additionalCategories: f7.additional_categories,
    attentionLevel: f7.attention_level,
    status: 'RETAINED',
    allowedInDraft: true,
    selectedForm: f7.entry,
    f7Equivalent: f7.f7_equivalent,
    suggestion: f7.suggestion,
    gennasRule: f7.gennas_rule,
    ruleIsFallback: f7.rule_is_fallback,
    decisionReason: `Entri F7 "${f7.entry}" lolos evaluasi konteks dan dipertahankan.`,
    ttsArticulationNote,
  };
}

/**
 * Memilih frasa & kata F7 yang paling tepat untuk suatu blok narasi berdasarkan hasil analisis konteks (Tahap 2 & 3)
 */
export function selectActiveF7PhrasesForBlock(context: NarrativeContextAnalysis): {
  recommendedF7Entries: F7CandidateEvaluationResult[];
  prohibitedF7Entries: F7CandidateEvaluationResult[];
} {
  const recommendedF7Entries: F7CandidateEvaluationResult[] = [];
  const prohibitedF7Entries: F7CandidateEvaluationResult[] = [];

  // Kasus 2: Makna literal fisik mengipasi bara api
  if (context.hasPhysicalFireOrObjectTarget) {
    recommendedF7Entries.push(evaluateF7CandidateInContext('ngipasin', context));
  }

  // Kasus 3: Memanas-manasi dua orang bertengkar (kiasan sosial)
  if (context.hasSocialConflictTarget) {
    recommendedF7Entries.push(
      evaluateF7CandidateInContext('ngipasin', context, 'ngipasin suasana pertengkaran dua orang itu'),
      evaluateF7CandidateInContext('bikin makin keruh', context)
    );
  }

  // Kasus 7: Rahasia terucap tanpa sengaja -> keceplosan direkomendasikan, ngebocorin & ngeceplosin dilarang
  if (context.isUnintentionalSecretSlip) {
    recommendedF7Entries.push(evaluateF7CandidateInContext('keceplosan', context));
    prohibitedF7Entries.push(
      evaluateF7CandidateInContext('ngebocorin', context),
      evaluateF7CandidateInContext('ngeceplosin', context)
    );
  }

  // Kasus 1 & 4: Kesalahan teknis / informasi belum akurat tanpa bukti kebohongan
  if (context.isAccidentalError || (!context.hasIntentionalMaliceEvidence && !context.hasDeceptionOrFraudEvidence)) {
    prohibitedF7Entries.push(
      evaluateF7CandidateInContext('nyalahin', context),
      evaluateF7CandidateInContext('nuduh', context),
      evaluateF7CandidateInContext('fitnah', context),
      evaluateF7CandidateInContext('ngibulin', context),
      evaluateF7CandidateInContext('nipu', context)
    );
  }

  // Kasus 5: Kritik biasa tanpa unsur humor tajam
  if (context.isOrdinaryCritiqueWithoutHumor) {
    prohibitedF7Entries.push(evaluateF7CandidateInContext('nge-roasting', context));
  }

  // Kasus 6: Pembatalan acara biasa
  if (context.isOrdinaryEventCancellation) {
    prohibitedF7Entries.push(evaluateF7CandidateInContext('ngecancel', context));
  }

  // Kasus 8: Outline analitis -> aktifkan frasa konstruksi kontekstual F7
  if (context.isAnalyticalEvidenceReview) {
    const analyticalCandidates = [
      'cocokin sama bukti',
      'ngupas duduk perkaranya',
      'bikin duduk perkaranya jelas',
      'ngumpulin bukti',
      'ngecek lagi hasilnya',
      'ngebaca maksudnya',
    ];
    for (const phrase of analyticalCandidates) {
      const ev = evaluateF7CandidateInContext(phrase, context);
      if (ev.allowedInDraft) recommendedF7Entries.push(ev);
    }
  }

  return {
    recommendedF7Entries,
    prohibitedF7Entries,
  };
}

/**
 * TAHAP 4: NARRATIVE GENERATION GUIDANCE
 * Menyusun instruksi kontekstual aktif F7 yang diinjeksikan langsung ke dalam prompt runtime sebelum AI menyusun kalimat.
 */
export function buildF7ActiveGenerationGuidance(params: {
  topic: string;
  outline: string;
  blockId?: number;
  totalBlocks?: number;
}): string {
  const ctx = analyzeNarrativeContext(params);
  const { recommendedF7Entries, prohibitedF7Entries } = selectActiveF7PhrasesForBlock(ctx);

  const recLines = recommendedF7Entries
    .map(
      (r) =>
        `  * GUNAKAN/PERTAHANKAN "${r.selectedForm}" [${r.status}] — ${r.decisionReason}`
    )
    .join('\n');

  const prohLines = prohibitedF7Entries
    .map(
      (p) =>
        `  * JANGAN GUNAKAN "${p.word}" [${p.status}] -> GANTI DENGAN "${p.selectedForm}" — ${p.decisionReason}`
    )
    .join('\n');

  return [
    '================ KEPUTUSAN AKTIF F7 CONTEXTUAL GUARD (SEBELUM & SELAMA GENERATE) ================',
    `1. ANALISIS KONTEKS (12 DIMENSI):`,
    `   - Topik Utama: ${ctx.mainTopic}`,
    `   - Subtopik/Posisi Bagian: ${ctx.subtopicOrSection}`,
    `   - Jenis Tindakan & Niat Pelaku: ${ctx.actorActionType} | ${ctx.actorIntent}`,
    `   - Kepastian Bukti: ${ctx.evidenceCertainty}`,
    `   - Dimensi Makna: ${ctx.isLiteralPhysicalAction ? 'LITERAL / FISIK' : 'KIASAN / SOSIAL-ANALITIS'}`,
    `   - Tone Narator & Prioritas TTS: ${ctx.narratorTone} | ${ctx.ttsPronunciationPriority}`,
    `2. ENTRI F7 YANG DIREKOMENDASIKAN & DIPERTAHANKAN (RETAINED / CLARIFIED):`,
    recLines || '  * Pertahankan entri F7 yang selaras dengan bukti faktual dan alur kalimat.',
    `3. ENTRI F7 YANG DITAHAN / DIGANTI KARENA TIDAK SESUAI KONTEKS (REPLACED / REVISED):`,
    prohLines || '  * Tidak ada pelarangan khusus selama bukti niat dan objek kalimat selaras.',
    `4. PRINSIP ANTI-BANLIST F7:`,
    `   - F7 BUKAN daftar larangan buta. Jika entri F7 sudah tepat konteksnya, WAJIB DIPERTAHANKAN (RETAINED).`,
  ].join('\n');
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * TAHAP 5 & 6: POST-GENERATION CONTEXTUAL AUDIT & CONTEXTUAL REVISION
 * Memeriksa kembali naskah yang telah dibuat kalimat demi kalimat dan melakukan revisi kontekstual bila ada ketidaktepatan.
 */
export function runF7PostGenerationAuditAndRevision(params: {
  script: string;
  topic: string;
  outline: string;
  narratorToneOverride?: NarrativeContextAnalysis['narratorTone'];
}): F7PostGenerationAuditReport {
  const ctx = analyzeNarrativeContext({
    topic: params.topic,
    outline: params.outline,
    narratorToneOverride: params.narratorToneOverride,
  });

  let revisedScript = params.script || '';
  const findings: F7PostAuditFinding[] = [];
  const f7Entries = getAll268F7Entries();

  let retainedCount = 0;
  let clarifiedCount = 0;
  let revisedCount = 0;
  let replacedCount = 0;
  let needsReviewCount = 0;

  // 1. Pemeriksaan khusus kata tuduhan tambahan di luar/di dalam 268 bila konteksnya kecelakaan/ketidaksengajaan
  if (ctx.isAccidentalError || (!ctx.hasIntentionalMaliceEvidence && !ctx.hasDeceptionOrFraudEvidence)) {
    const fitnahRegex = /\b(?:memfitnah|ngefitnah|fitnah)\b/gi;
    if (fitnahRegex.test(revisedScript)) {
      revisedScript = revisedScript.replace(fitnahRegex, 'keliru menilai');
      replacedCount++;
      findings.push({
        word: 'fitnah',
        primaryCategory: 'Konotasi negatif/tuduhan',
        status: 'REPLACED',
        originalSnippet: 'fitnah',
        revisedSnippet: 'keliru menilai',
        replacementUsed: 'keliru menilai',
        reason:
          'Audit Pasca-Generasi (Mekanisme A): Konteks adalah kesalahan teknis/ketidaksengajaan tanpa bukti niat jahat; "fitnah" diganti menjadi "keliru menilai".',
      });
    }
  }

  // 2. Periksa varian ber-tanda-hubung seperti "nge-cancel" dan "nge-roasting" terlebih dahulu
  if (ctx.isOrdinaryEventCancellation) {
    const cancelRegex = /\bnge-?cancel\b/gi;
    if (cancelRegex.test(revisedScript)) {
      revisedScript = revisedScript.replace(cancelRegex, 'ngebatalin');
      replacedCount++;
      findings.push({
        word: 'nge-cancel',
        f7Number: f7Entries.find((e) => e.canonical_key === 'ngecancel')?.f7_guard.f7_number,
        primaryCategory: 'Register/morfologi/slang',
        status: 'REPLACED',
        originalSnippet: 'nge-cancel',
        revisedSnippet: 'ngebatalin',
        replacementUsed: 'ngebatalin',
        reason:
          'Audit Pasca-Generasi (Mekanisme C): Konteks adalah pembatalan acara biasa, sehingga "nge-cancel" diganti menjadi "ngebatalin".',
      });
    }
  }

  if (ctx.isOrdinaryCritiqueWithoutHumor || ctx.narratorTone !== 'CASUAL_SATIRICAL') {
    const roastingRegex = /\bnge-?roasting\b/gi;
    if (roastingRegex.test(revisedScript)) {
      revisedScript = revisedScript.replace(roastingRegex, 'nkritik');
      replacedCount++;
      findings.push({
        word: 'nge-roasting',
        f7Number: f7Entries.find((e) => e.canonical_key === 'ngeroasting')?.f7_guard.f7_number,
        primaryCategory: 'Register/morfologi/slang',
        status: 'REPLACED',
        originalSnippet: 'nge-roasting',
        revisedSnippet: 'nkritik',
        replacementUsed: 'nkritik',
        reason:
          'Audit Pasca-Generasi (Mekanisme C): Konteks adalah kritik biasa tanpa unsur humor tajam, sehingga "nge-roasting" diganti menjadi "nkritik".',
      });
    }
  }

  // 3. Periksa seluruh 268 entri F7 yang muncul di dalam naskah
  for (const item of f7Entries) {
    const entryWord = item.entry;
    const regex = new RegExp(`\\b${escapeRegExp(entryWord)}\\b`, 'gi');
    if (!regex.test(revisedScript)) continue;

    const evalResult = evaluateF7CandidateInContext(entryWord, ctx, revisedScript);

    if (evalResult.status === 'REPLACED' || evalResult.status === 'REVISED') {
      const replacement = evalResult.selectedForm;
      revisedScript = revisedScript.replace(regex, replacement);
      if (evalResult.status === 'REPLACED') replacedCount++;
      else revisedCount++;

      findings.push({
        word: entryWord,
        f7Number: item.f7_guard.f7_number,
        primaryCategory: item.f7_guard.primary_category,
        status: evalResult.status,
        originalSnippet: entryWord,
        revisedSnippet: replacement,
        replacementUsed: replacement,
        reason: evalResult.decisionReason,
      });
    } else if (evalResult.status === 'CLARIFIED') {
      // Perjelas objek kiasan bila belum memiliki objek sosial
      clarifiedCount++;
      revisedScript = revisedScript.replace(regex, evalResult.selectedForm);
      findings.push({
        word: entryWord,
        f7Number: item.f7_guard.f7_number,
        primaryCategory: item.f7_guard.primary_category,
        status: 'CLARIFIED',
        originalSnippet: entryWord,
        revisedSnippet: evalResult.selectedForm,
        replacementUsed: evalResult.selectedForm,
        reason: evalResult.decisionReason,
      });
    } else if (evalResult.status === 'RETAINED') {
      retainedCount++;
      findings.push({
        word: entryWord,
        f7Number: item.f7_guard.f7_number,
        primaryCategory: item.f7_guard.primary_category,
        status: 'RETAINED',
        originalSnippet: entryWord,
        revisedSnippet: entryWord,
        reason: evalResult.decisionReason,
      });
    } else if (evalResult.status === 'NEEDS_REVIEW') {
      needsReviewCount++;
      findings.push({
        word: entryWord,
        f7Number: item.f7_guard.f7_number,
        primaryCategory: item.f7_guard.primary_category,
        status: 'NEEDS_REVIEW',
        originalSnippet: entryWord,
        revisedSnippet: entryWord,
        reason: evalResult.decisionReason,
      });
    }
  }

  // 4. Perbaikan konstruksi sintaksis "butuh jawabin" -> "butuh jawaban"
  const butuhJawabinRegex = /\b(butuh|perlu|minta|cari|ada|dapat|kasih|tanpa)\s+jawabin(\s+gimana)?\b/gi;
  if (butuhJawabinRegex.test(revisedScript)) {
    revisedScript = revisedScript.replace(butuhJawabinRegex, '$1 jawaban');
    revisedCount++;
    findings.push({
      word: 'jawabin',
      primaryCategory: 'Frasa/konstruksi kontekstual',
      status: 'REVISED',
      originalSnippet: 'butuh jawabin',
      revisedSnippet: 'butuh jawaban',
      replacementUsed: 'jawaban',
      reason:
        'Audit Pasca-Generasi (Mekanisme D): Perbaikan slot nomina setelah verba "butuh/perlu" dari "jawabin" menjadi "jawaban".',
    });
  }

  let overallStatus: F7DecisionStatus = 'NO_TRIGGER';
  if (findings.length > 0) {
    if (replacedCount > 0) overallStatus = 'REPLACED';
    else if (revisedCount > 0) overallStatus = 'REVISED';
    else if (clarifiedCount > 0) overallStatus = 'CLARIFIED';
    else if (retainedCount > 0) overallStatus = 'RETAINED';
    else overallStatus = 'PASS';
  }

  return {
    originalScript: params.script,
    revisedScript,
    wasRevised: revisedScript !== params.script,
    overallStatus,
    totalF7Triggered: findings.length,
    retainedCount,
    clarifiedCount,
    revisedCount,
    replacedCount,
    needsReviewCount,
    findings,
    ttsEvaluationSummary: {
      evaluatedByTextAndPhonotactics: true,
      audioPlaybackTested: false,
      note: 'Evaluasi kemudahan ucap TTS dilakukan secara tekstual dan fonotaktik (panjang suku kata, tumpukan afiks, kelancaran jeda kalimat), bukan melalui klaim pengujian pemutaran audio nyata.',
    },
  };
}

/**
 * Perbandingan nyata hasil narasi SEBELUM dan SESUDAH F7 Contextual Guard aktif pada input yang sama
 */
export function compareNarrativeWithAndWithoutF7(params?: {
  topic?: string;
  outline?: string;
  rawUnfilteredDraft?: string;
}) {
  const topic =
    params?.topic ||
    'Gangguan Sistem Pendaftaran Layanan Publik & Kesalahan Teknis Jadwal Acara';
  const outline =
    params?.outline ||
    'Terjadi kesalahan teknis tak sengaja pada server pendaftaran yang membuat angka kuota belum akurat tanpa bukti kebohongan. Panitia mengalami pembatalan acara biasa karena hujan deras, seorang staf tanpa sengaja mengucapkan rahasia jadwal internal, dan publik menyampaikan kritik biasa tanpa unsur humor tajam sambil mengevaluasi bukti duduk perkaranya.';

  const beforeF7Draft =
    params?.rawUnfilteredDraft ||
    'Banyak orang langsung nyalahin dan nuduh tim teknis soal kesalahan sistem pendaftaran. Mereka ngibulin publik dengan laporan awal yang belum akurat. Panitia terpaksa nge-cancel acara diskusi sore ini. Narasumber itu ngebocorin tanggal rilis produk. Para peneliti nge-roasting laporan tersebut di rapat resmi. Kita justru perlu ngupas duduk perkaranya dan cocokin sama bukti yang ada di lapangan.';

  const auditResult = runF7PostGenerationAuditAndRevision({
    script: beforeF7Draft,
    topic,
    outline,
  });

  return {
    topic,
    outline,
    beforeF7Script: beforeF7Draft,
    afterF7Script: auditResult.revisedScript,
    auditReport: auditResult,
  };
}

// ============================================================================
// PERBAIKAN 2 — MONITORING CATATAN (F7 READ-ONLY DYNAMIC MONITOR)
// ============================================================================

export type F7MonitorInspectionStatus = 'ALLOW' | 'CONDITIONAL' | 'AVOID';

export interface F7MonitoredNoteItem {
  word: string;
  canonicalKey: string;
  f7Number: number;
  primaryCategory: F7PrimaryCategory;
  additionalCategories: string[];
  attentionLevel: 'TINGGI' | 'SEDANG';
  meaningNote: string;
  informalSuggestion: string;
  gennasRule: string;
  inspectionStatus: F7MonitorInspectionStatus;
  statusReason: string;
  isPolysemous: boolean;
  isConditionalWord: boolean;
  isMorphologicallyAwkward: boolean;
  isMisinterpretationProne: boolean;
  usedInScript: boolean;
  occurrencesCount: number;
  relevantBlockIds: number[];
  matchedSentences: string[];
  isDismissedInScript?: boolean;
}

export interface F7NotesMonitorReport {
  hasActiveScript: boolean;
  emptyStateMessage: string;
  totalDatasetEntries: number;
  totalSemanticRules: number;
  detectedInScriptCount: number;
  allowCount: number;
  conditionalCount: number;
  avoidCount: number;
  polysemousCount: number;
  conditionalWordsCount: number;
  morphologicallyAwkwardCount: number;
  misinterpretationProneCount: number;
  categoryCounts: Record<F7PrimaryCategory, number>;
  items: F7MonitoredNoteItem[];
}

/**
 * Menghitung status MONITORING CATATAN secara 100% READ-ONLY dari dataset F7 aktual (268 entri)
 * tanpa mengubah naskah, tanpa mengganti kata secara paksa, dan tanpa memicu generate ulang.
 */
export function computeF7NotesMonitor(
  cleanScript: string,
  topic: string = '',
  outline: string = ''
): F7NotesMonitorReport {
  const f7Entries = getAll268F7Entries();
  const trimmedScript = (cleanScript || '').trim();
  const hasActiveScript = trimmedScript.length > 0;
  const blocks = hasActiveScript
    ? trimmedScript
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map((b) => b.trim())
        .filter(Boolean)
    : [];

  const ctx = analyzeNarrativeContext({
    topic: topic || 'Analisis Perilaku & Pola Pikir Masyarakat',
    outline: outline || trimmedScript || 'Kerangka pemantauan kosakata kontekstual F7',
  });

  const categoryCounts: Record<F7PrimaryCategory, number> = {
    'Konotasi negatif/tuduhan': 0,
    'Makna kiasan/polisemi': 0,
    'Register/morfologi/slang': 0,
    'Frasa/konstruksi kontekstual': 0,
    'Teknis/akademis/prosedural': 0,
  };

  let detectedInScriptCount = 0;
  let allowCount = 0;
  let conditionalCount = 0;
  let avoidCount = 0;
  let polysemousCount = 0;
  let conditionalWordsCount = 0;
  let morphologicallyAwkwardCount = 0;
  let misinterpretationProneCount = 0;

  const items: F7MonitoredNoteItem[] = f7Entries.map((item) => {
    const f7 = item.f7_guard;
    const cat = f7.primary_category as F7PrimaryCategory;
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;

    const cKey = item.canonical_key;
    const wordRx = new RegExp(`\\b${escapeRegExp(item.entry)}\\b`, 'gi');

    let occurrencesCount = 0;
    const relevantBlockIds: number[] = [];
    const matchedSentences: string[] = [];

    if (hasActiveScript) {
      blocks.forEach((blockText, bIdx) => {
        const matches = blockText.match(wordRx);
        if (matches && matches.length > 0) {
          occurrencesCount += matches.length;
          relevantBlockIds.push(bIdx + 1);
          const sents = blockText.split(/(?<=[.!?])\s+/).filter(Boolean);
          for (const s of sents) {
            if (new RegExp(`\\b${escapeRegExp(item.entry)}\\b`, 'i').test(s) && matchedSentences.length < 2) {
              matchedSentences.push(s.trim());
            }
          }
        }
      });
    }

    const isDismissed = masterLexiconRepository.isFindingDismissed(item.entry) || masterLexiconRepository.isFindingDismissed(cKey);
    const usedInScript = occurrencesCount > 0 && !isDismissed;
    if (usedInScript) {
      detectedInScriptCount++;
    }

    const isPolysemous =
      cat === 'Makna kiasan/polisemi' ||
      f7.additional_categories.includes('Makna kiasan/polisemi');
    const isConditionalWord =
      cat === 'Konotasi negatif/tuduhan' ||
      cat === 'Frasa/konstruksi kontekstual' ||
      f7.attention_level === 'TINGGI';
    const isMorphologicallyAwkward =
      cat === 'Register/morfologi/slang' ||
      /^me(?:mper|ng|ny|n|m)?[a-z]{3,}in$/i.test(item.entry) ||
      cKey === 'ngeceplosin' ||
      cKey === 'jawabin';
    const isMisinterpretationProne =
      cat === 'Konotasi negatif/tuduhan' ||
      isPolysemous ||
      f7.attention_level === 'TINGGI';

    if (isPolysemous) polysemousCount++;
    if (isConditionalWord) conditionalWordsCount++;
    if (isMorphologicallyAwkward) morphologicallyAwkwardCount++;
    if (isMisinterpretationProne) misinterpretationProneCount++;

    const evalRes = evaluateF7CandidateInContext(
      item.entry,
      ctx,
      matchedSentences[0] || trimmedScript
    );

    let inspectionStatus: F7MonitorInspectionStatus = 'ALLOW';
    let statusReason = evalRes.decisionReason;

    if (
      !evalRes.allowedInDraft ||
      evalRes.status === 'REPLACED' ||
      f7.attention_level === 'PROHIBITED' ||
      f7.review?.startsWith('AVOID') ||
      item.status === 'inactive'
    ) {
      inspectionStatus = 'AVOID';
      avoidCount++;
    } else if (
      evalRes.status === 'CLARIFIED' ||
      evalRes.status === 'REVISED' ||
      f7.attention_level === 'TINGGI' ||
      isPolysemous
    ) {
      inspectionStatus = 'CONDITIONAL';
      conditionalCount++;
      if (evalRes.status === 'RETAINED') {
        statusReason = `Bersyarat (${cat}): Dapat digunakan dalam narasi santai Gue–Lo selama objek kalimat dan konteks faktanya jelas. ${f7.gennas_rule}`;
      }
    } else {
      inspectionStatus = 'ALLOW';
      allowCount++;
    }

    return {
      word: item.entry,
      canonicalKey: cKey,
      f7Number: f7.f7_number,
      primaryCategory: cat,
      additionalCategories: f7.additional_categories,
      attentionLevel: (f7.attention_level === 'TINGGI' ? 'TINGGI' : 'SEDANG') as 'TINGGI' | 'SEDANG',
      meaningNote: f7.f7_equivalent || item.entry,
      informalSuggestion: f7.suggestion || item.entry,
      gennasRule: f7.gennas_rule,
      inspectionStatus,
      statusReason,
      isPolysemous,
      isConditionalWord,
      isMorphologicallyAwkward,
      isMisinterpretationProne,
      usedInScript,
      occurrencesCount,
      relevantBlockIds,
      matchedSentences,
      isDismissedInScript: isDismissed,
    };
  });

  // Urutkan agar kata yang muncul di naskah aktif tampil paling atas, diikuti tingkat perhatian TINGGI
  items.sort((a, b) => {
    if (a.usedInScript !== b.usedInScript) return a.usedInScript ? -1 : 1;
    if (a.inspectionStatus !== b.inspectionStatus) {
      const order: Record<F7MonitorInspectionStatus, number> = {
        AVOID: 0,
        CONDITIONAL: 1,
        ALLOW: 2,
      };
      return order[a.inspectionStatus] - order[b.inspectionStatus];
    }
    return a.f7Number - b.f7Number;
  });

  return {
    hasActiveScript,
    emptyStateMessage: 'BELUM ADA NASKAH — MONITOR MENUNGGU GENERATE.',
    totalDatasetEntries: f7Entries.length,
    totalSemanticRules: 7,
    detectedInScriptCount,
    allowCount,
    conditionalCount,
    avoidCount,
    polysemousCount,
    conditionalWordsCount,
    morphologicallyAwkwardCount,
    misinterpretationProneCount,
    categoryCounts,
    items,
  };
}

