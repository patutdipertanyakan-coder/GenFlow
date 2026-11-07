/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * HYBRID CONTEXTUAL LEXICON SELECTION ENGINE (HCLSE) — GenFLOW Studio V6.2
 *
 * Prinsip Utama:
 * SUPABASE FIRST AS CANDIDATE SOURCE — CONTEXT FIRST AS DECISION MAKER — NON-FORCING AS FINAL RULE.
 *
 * Otoritas:
 * 1. Supabase Retrieval Intelligence (lexicon_entries, lexicon_context_rules, narrative_phrases via pagination)
 * 2. Semantic Candidate Retrieval & 5-Dimension Contextual Scoring (Makna 35, Grammar 20, Konteks & F7 20, Informal 15, Flow 10)
 * 3. Non-Forcing Hybrid Selection (Path A: SELECTED_SUPABASE, Path B: SELECTED_GLOBAL_INFORMAL)
 * 4. Padanan Formal Sebagai Referensi (Bukan Perintah Substitusi)
 * 5. F7 Contextual Guard & Gue-Lo Informal Register Lock
 * 6. Semantic Discourse & Connector Intelligence (Pembatasan 'karena' & Penghubung Mekanis)
 * 7. Sentence Flow & Soft-Start Engine (Bekerja di Setiap Tanda Titik '.')
 * 8. Cross-Block Coherence & Anti-Repetition
 * 9. Punctuation Lock (Hanya '.', ',', '?')
 * 10. Traceability & Hybrid Lexicon Monitor (Hitung Kemunculan Aktual di Teks Final)
 */

import { masterLexiconRepository, UnifiedLexiconItem } from './masterLexiconRepository';
import { G1G11PhraseRepository } from './g1g11PhraseRepository';
import { getCanonicalDedupKey } from './expansionLexiconBank';
import { analyzeNarrativeContext, evaluateF7CandidateInContext, NarrativeContextAnalysis } from './f7ContextualGuardEngine';

export type CandidateSelectionStatus =
  | 'CONSIDERED'
  | 'SELECTED_SUPABASE'
  | 'SELECTED_GLOBAL_INFORMAL'
  | 'REJECTED'
  | 'NOT_NEEDED';

export interface ContextualCandidateScore {
  candidateWord: string;
  supabaseId?: string;
  category: string;
  formalEquivalent?: string;
  sourceType: 'SUPABASE' | 'GLOBAL_INFORMAL';
  meaningFitScore: number; // Max 35
  grammarFitScore: number; // Max 20
  contextF7FitScore: number; // Max 20
  informalToneScore: number; // Max 15
  sentenceFlowScore: number; // Max 10
  totalScore: number; // Max 100
  passedThreshold: boolean; // totalScore >= 80 && meaningFitScore > 0 && no F7 conflict
  status: CandidateSelectionStatus;
  rejectionReason?: string;
  selectionReason?: string;
  appliedF7Rule?: string;
  blockId: number;
  sentenceSnippet?: string;
}

export interface HCLSETraceabilityAudit {
  topic: string;
  evaluatedAt: string;
  totalConsidered: number;
  totalSelectedSupabase: number;
  totalSelectedGlobalInformal: number;
  totalRejected: number;
  totalActuallyUsedInFinal?: number;
  finalizationStatus?: 'DRAFT_TAHAP_2' | 'FINALIZED_TAHAP_3';
  uniqueWordCount: number;
  wordFrequencies: Record<string, number>;
  blockBreakdown: Record<
    number,
    {
      blockId: number;
      blockName: string;
      considered: ContextualCandidateScore[];
      selectedSupabase: string[];
      selectedGlobalInformal: string[];
      rejected: string[];
      wordFrequencies: Record<string, number>;
    }
  >;
  candidatesLog: ContextualCandidateScore[];
}

export interface HCLSEProcessResult {
  script: string;
  blocks: string[];
  auditTraceability: HCLSETraceabilityAudit;
  wordCount: number;
}

/**
 * 1. SEMANTIC CANDIDATE RETRIEVAL & CONTEXTUAL SCORING
 * Menilai kelayakan kandidat kosakata berdasarkan 5 Dimensi Skor.
 */
export function scoreCandidateInContext(params: {
  candidateWord: string;
  supabaseId?: string;
  category: string;
  formalEquivalent?: string | null;
  contextNote?: string;
  sourceType: 'SUPABASE' | 'GLOBAL_INFORMAL';
  narrativeContext: NarrativeContextAnalysis;
  targetSentence: string;
  previousSentence?: string;
  blockId: number;
}): ContextualCandidateScore {
  const {
    candidateWord,
    supabaseId,
    category,
    formalEquivalent,
    sourceType,
    narrativeContext,
    targetSentence,
    previousSentence,
    blockId,
  } = params;

  const cleanWord = candidateWord.trim();
  const lowerWord = cleanWord.toLowerCase();
  const lowerSentence = targetSentence.toLowerCase();

  let meaningFitScore = 35;
  let grammarFitScore = 20;
  let contextF7FitScore = 20;
  let informalToneScore = 15;
  let sentenceFlowScore = 10;
  let rejectionReason = '';
  let selectionReason = '';
  let appliedF7Rule = '';

  // --- DIMENSI 1: KESESUAIAN MAKNA (35 Poin) ---
  // Evaluasi apakah kata benar-benar mengekspresikan gagasan kalimat
  if (lowerWord === 'bawain' || lowerWord === 'obatin') {
    if (
      narrativeContext.isAnalyticalEvidenceReview ||
      /(?:bantah|sanggah|tolak|argumen|dusta|salah)/i.test(lowerSentence)
    ) {
      meaningFitScore = 0;
      rejectionReason = `Makna kata "${cleanWord}" (membawa/obati) bertolak belakang dengan gagasan kalimat (menolak/menyangkal argumen).`;
    }
  } else if (lowerWord === 'dibilangin') {
    if (/(?:menolak|menyangkal|membantah|sanggah)/i.test(lowerSentence)) {
      meaningFitScore = 10; // Kurang presisi dibanding 'ngebantah'
      rejectionReason = `Kata "${cleanWord}" bermakna dinasihati/diberitahu, kurang presisi untuk penolakan argumen dibanding "ngebantah".`;
    }
  } else if (lowerWord === 'ngebantah') {
    if (/(?:menolak|menyangkal|membantah|sanggah|argumen)/i.test(lowerSentence) || narrativeContext.isAnalyticalEvidenceReview) {
      meaningFitScore = 35;
      selectionReason = `Kata "${cleanWord}" sangat presisi mengekspresikan tindakan menyangkal/menolak argumen.`;
    }
  } else if (lowerWord === 'ngedumel') {
    if (/(?:gerutu|kecewa|jengkel|menggerutu|mengeluh)/i.test(lowerSentence) || /(?:mengeluh|kecewa)/i.test((narrativeContext.outline || '').toLowerCase())) {
      meaningFitScore = 35;
      selectionReason = `Kata Global Informal "${cleanWord}" sangat tepat mengekspresikan tindakan menggerutu/kecewa.`;
    }
  }

  // --- DIMENSI 2: KESESUAIAN TATA BAHASA & SINTAKSIS (20 Poin) ---
  // Cek benturan slot nomina vs verba -in (misal: "butuh jawabin")
  if (lowerWord.endsWith('in') && /\b(butuh|perlu|punya|tanpa|ada|minta)\s+[a-z]+in\b/i.test(lowerSentence)) {
    grammarFitScore = 0;
    rejectionReason = `Ditolak (Grammar): Verba -in "${cleanWord}" memicu benturan slot nomina setelah kata modalitas/preposisi.`;
  }

  // --- DIMENSI 3: KESESUAIAN KONTEKS & F7 GUARD (20 Poin) ---
  const f7Eval = evaluateF7CandidateInContext(cleanWord, narrativeContext, targetSentence);
  if (!f7Eval.allowedInDraft || f7Eval.status === 'REPLACED') {
    contextF7FitScore = 0;
    appliedF7Rule = f7Eval.decisionReason;
    rejectionReason = `Ditolak (Aturan F7 Guard): ${f7Eval.decisionReason}`;
  } else if (f7Eval.status === 'RETAINED' || f7Eval.status === 'CLARIFIED') {
    contextF7FitScore = 20;
    appliedF7Rule = f7Eval.decisionReason;
  }

  // --- DIMENSI 4: KEALAMIAN BAHASA INFORMAL GUE-LO (15 Poin) ---
  const isFormalLeak = /\b(memanfaatkan|membawakan|mengobati|membantah|menyampaikan|mengatakan bahwa)\b/i.test(cleanWord);
  if (isFormalLeak) {
    informalToneScore = 0;
    rejectionReason = `Ditolak: Kata "${cleanWord}" merupakan bentuk formal kaku yang merusak register lisan Gue-Lo.`;
  }

  // --- DIMENSI 5: KELUWESAN KALIMAT (10 Poin) ---
  if (previousSentence) {
    const prevEnding = previousSentence.slice(-15).toLowerCase();
    if (prevEnding.includes(lowerWord)) {
      sentenceFlowScore = 2; // Pengulangan kata berurutan
      rejectionReason = `Ditolak (Sentence Flow): Kata "${cleanWord}" berulang secara langsung dengan kalimat sebelumnya.`;
    }
  }

  const totalScore = meaningFitScore + grammarFitScore + contextF7FitScore + informalToneScore + sentenceFlowScore;
  const passedThreshold = totalScore >= 80 && meaningFitScore > 0 && grammarFitScore > 0 && contextF7FitScore > 0;

  let status: CandidateSelectionStatus = 'REJECTED';
  if (passedThreshold) {
    status = sourceType === 'SUPABASE' ? 'SELECTED_SUPABASE' : 'SELECTED_GLOBAL_INFORMAL';
  }

  return {
    candidateWord: cleanWord,
    supabaseId,
    category,
    formalEquivalent: formalEquivalent || undefined,
    sourceType,
    meaningFitScore,
    grammarFitScore,
    contextF7FitScore,
    informalToneScore,
    sentenceFlowScore,
    totalScore,
    passedThreshold,
    status,
    rejectionReason: !passedThreshold ? (rejectionReason || `Skor total (${totalScore}/100) di bawah ambang batas 80.`) : undefined,
    selectionReason: passedThreshold ? (selectionReason || `LULUS HCLSE (${totalScore}/100): Diksi alami, presisi makna, dan selaras F7 Guard.`) : undefined,
    appliedF7Rule,
    blockId,
    sentenceSnippet: targetSentence.slice(0, 100),
  };
}

/**
 * 2. SEMANTIC DISCOURSE & CONNECTOR INTELLIGENCE
 * Membatasi penggunaan 'karena' berulang & menghapus kata penghubung mekanis yang tidak diperlukan.
 */
export function processDiscourseConnectors(scriptText: string): string {
  if (!scriptText) return '';

  const lines = scriptText.split('\n');
  const processedLines = lines.map((line) => {
    let text = line;

    // Batasi pengulangan kata 'karena' dalam satu baris/paragraf: gantikan 'karena' kedua+ dengan varian informal yang pas atau hilangkan
    let karenaCount = 0;
    text = text.replace(/\bkarena\b/gi, (match) => {
      karenaCount++;
      if (karenaCount === 1) return match;
      if (karenaCount === 2) return 'soalnya';
      if (karenaCount === 3) return 'gara-gara';
      return ''; // Hilangkan jika terlalu sering berulang
    });

    // Rapikan spasi ganda dari penghapusan
    text = text.replace(/\s{2,}/g, ' ').replace(/\s+([.,?])/g, '$1');

    // Mencegah penggantian mekanis pembuka kalimat formal
    text = text.replace(/(?<=[.!?])\s+Oleh\s+karena\s+itu,\s*/gi, ' Makanya, ');
    text = text.replace(/(?<=[.!?])\s+Dengan\s+demikian,\s*/gi, ' Dari situ kelihatan, ');
    text = text.replace(/(?<=[.!?])\s+Pada\s+akhirnya,\s*/gi, ' Ujung-ujungnya, ');

    return text.trim();
  });

  return processedLines.join('\n');
}

/**
 * 3. SENTENCE FLOW & SOFT-START ENGINE
 * Bekerja pada SETIAP perpindahan kalimat (setelah tanda titik '.'), bukan hanya paragraf.
 */
export function applySentenceFlowSoftStart(scriptText: string): string {
  if (!scriptText) return '';

  const lines = scriptText.split('\n');
  const processedLines = lines.map((line) => {
    if (!line.trim()) return line;

    // Split berdasarkan pembatas kalimat (. ! ?)
    const sentences = line.split(/(?<=[.!?])\s+/).filter(Boolean);
    if (sentences.length <= 1) return line;

    const refinedSentences: string[] = [sentences[0]]; // Kalimat pertama paragraf tetap

    for (let i = 1; i < sentences.length; i++) {
      let sent = sentences[i].trim();
      const prevSent = sentences[i - 1].trim();

      // Periksa pembukaan kalimat setelah tanda titik
      // Hindari pembukaan yang terasa seperti judul baru / perintah / presenter formal
      if (/^(Ingatlah bahwa|Perlu dicatat bahwa|Dapat disimpulkan bahwa|Ditegaskan bahwa|Harus dipahami bahwa)\b/i.test(sent)) {
        sent = sent.replace(/^(Ingatlah bahwa|Perlu dicatat bahwa|Dapat disimpulkan bahwa|Ditegaskan bahwa|Harus dipahami bahwa)\s*/i, 'Coba lo pikir, ');
      } else if (/^(Kesimpulannya adalah|Langkah selanjutnya adalah|Solusinya adalah)\b/i.test(sent)) {
        sent = sent.replace(/^(Kesimpulannya adalah|Langkah selanjutnya adalah|Solusinya adalah)\s*/i, 'Nah, ');
      }

      // Haluskan transisi jika dua kalimat berurutan dimulai dengan konsonan/kata yang sama persis
      const firstWord = sent.split(/\s+/)[0]?.toLowerCase();
      const prevFirstWord = prevSent.split(/\s+/)[0]?.toLowerCase();

      if (firstWord && prevFirstWord && firstWord === prevFirstWord && ['lagipula', 'padahal', 'malah', 'justru', 'makanya'].includes(firstWord)) {
        if (firstWord === 'lagipula') sent = sent.replace(/^lagipula\s*/i, 'ditambah lagi, ');
        else if (firstWord === 'padahal') sent = sent.replace(/^padahal\s*/i, 'kenyataannya, ');
        else if (firstWord === 'makanya') sent = sent.replace(/^makanya\s*/i, 'dari situ, ');
      }

      refinedSentences.push(sent);
    }

    return refinedSentences.join(' ');
  });

  return processedLines.join('\n');
}

/**
 * 4. PUNCTUATION LOCK & CITATION PROTECTION
 * Hanya mengizinkan: titik (.), koma (,), dan tanda tanya (?) pada naskah final.
 * Melarang: tanda seru (!), double asterisk (**), em dash (—, --).
 * Pengecualian: garis miring (/), strip (-), dan simbol referensi dokumen/pasal tetap dipertahankan.
 */
export function enforceStrictPunctuationLock(scriptText: string): string {
  if (!scriptText) return '';

  let cleaned = scriptText;

  // 1. Hapus double asterisk markdown (**teks**) -> teks
  cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, '$1');

  // 2. Ganti em dash (—) atau double dash (--) menjadi koma atau titik
  cleaned = cleaned.replace(/\s*—\s*/g, ', ');
  cleaned = cleaned.replace(/\s*--\s*/g, ', ');

  // 3. Konversi tanda seru (!) menjadi tanda titik (.)
  cleaned = cleaned.replace(/!+/g, '.');

  // 4. Bersihkan spasi berlebih sebelum koma atau titik
  cleaned = cleaned.replace(/\s+,/g, ',');
  cleaned = cleaned.replace(/\s+\./g, '.');
  cleaned = cleaned.replace(/,{2,}/g, ',');
  cleaned = cleaned.replace(/\.{2,}/g, '.');

  return cleaned;
}

/**
 * 5. UTAMA: HYBRID CONTEXTUAL LEXICON SELECTION ENGINE (HCLSE RUNNER)
 * Mengintegrasikan seluruh langkah HCLSE ke dalam pipeline Tahap 2 & 3.
 */
export function runHybridContextualLexiconSelectionEngine(params: {
  script: string;
  topic: string;
  outline: string;
}): HCLSEProcessResult {
  const { topic, outline } = params;
  let scriptText = params.script || '';

  const candidatesLog: ContextualCandidateScore[] = [];
  const wordFrequencies: Record<string, number> = {};

  // 1. Ekstrak data Supabase terkurasi via repository
  const supabaseLexiconList = masterLexiconRepository.getUnifiedEntries();
  const supabaseMap = new Map<string, UnifiedLexiconItem>();
  const formalMap = new Map<string, UnifiedLexiconItem[]>();
  const blacklistedKeys = masterLexiconRepository.getBlacklistedKeys();

  for (const item of supabaseLexiconList) {
    supabaseMap.set(item.canonical_key, item);
    supabaseMap.set(item.entry.toLowerCase(), item);

    if (item.formal) {
      const formalClean = item.formal.toLowerCase().trim();
      const existing = formalMap.get(formalClean) || [];
      existing.push(item);
      formalMap.set(formalClean, existing);
    }
  }

  // 2. Format 5 blok SCTF
  const rawBlocks = scriptText
    .replace(/\r\n/g, '\n')
    .split(/\n+/)
    .map((b) => b.trim())
    .filter(Boolean);

  const blockNames = ['Hook', 'Akar Masalah', 'Inti Masalah', 'Penyelesaian', 'Kesimpulan'];
  const blockBreakdown: HCLSETraceabilityAudit['blockBreakdown'] = {};

  // Memproses setiap blok SCTF
  const processedBlocks = rawBlocks.map((blockContent, bIdx) => {
    const blockId = bIdx + 1;
    const blockName = blockNames[bIdx] || `Blok ${blockId}`;
    const narrativeContext = analyzeNarrativeContext({ topic, outline, blockId, totalBlocks: rawBlocks.length });

    const sentences = blockContent.split(/(?<=[.!?])\s+/).filter(Boolean);
    const blockConsidered: ContextualCandidateScore[] = [];
    const blockSelectedSupabase: string[] = [];
    const blockSelectedGlobalInformal: string[] = [];
    const blockRejected: string[] = [];
    const blockFrequencies: Record<string, number> = {};
    const evaluatedWordsInBlock = new Set<string>();

    let refinedBlockContent = blockContent;

    // A. PEMINDAIAN FORMAL KE INFORMAL SUPABASE BERBASIS KONTEKS (TRANSFORMASI NATURAL)
    for (const [formalWord, candidates] of formalMap.entries()) {
      if (!formalWord || formalWord.length < 3) continue;
      const rx = new RegExp(`\\b${formalWord}\\b`, 'i');
      if (rx.test(refinedBlockContent)) {
        for (const cand of candidates) {
          const lowerCand = cand.entry.toLowerCase();
          if (evaluatedWordsInBlock.has(lowerCand)) continue;
          evaluatedWordsInBlock.add(lowerCand);

          // Cek Blacklist (Hard Exclusion)
          if (blacklistedKeys.has(cand.canonical_key) || blacklistedKeys.has(lowerCand)) {
            const rejectedScore: ContextualCandidateScore = {
              candidateWord: cand.entry,
              supabaseId: cand.id,
              category: cand.category_label || cand.primary_category,
              formalEquivalent: cand.formal || formalWord,
              sourceType: 'SUPABASE',
              meaningFitScore: 0,
              grammarFitScore: 0,
              contextF7FitScore: 0,
              informalToneScore: 0,
              sentenceFlowScore: 0,
              totalScore: 0,
              passedThreshold: false,
              status: 'REJECTED',
              rejectionReason: `Ditolak (Hard Blacklist Exclusion): Kosakata "${cand.entry}" berada dalam daftar hitam sistem.`,
              blockId,
              sentenceSnippet: sentences[0] || refinedBlockContent,
            };
            blockConsidered.push(rejectedScore);
            candidatesLog.push(rejectedScore);
            blockRejected.push(cand.entry);
            continue;
          }

          const scoreResult = scoreCandidateInContext({
            candidateWord: cand.entry,
            supabaseId: cand.id,
            category: cand.category_label || cand.primary_category,
            formalEquivalent: cand.formal || formalWord,
            contextNote: cand.context_note,
            sourceType: 'SUPABASE',
            narrativeContext,
            targetSentence: sentences[0] || refinedBlockContent,
            blockId,
          });

          blockConsidered.push(scoreResult);
          candidatesLog.push(scoreResult);

          if (scoreResult.status === 'SELECTED_SUPABASE') {
            blockSelectedSupabase.push(scoreResult.candidateWord);
            refinedBlockContent = refinedBlockContent.replace(rx, scoreResult.candidateWord);
            break; // Ambil kandidat terbaik pertama yang cocok
          } else {
            blockRejected.push(scoreResult.candidateWord);
          }
        }
      }
    }

    // B. PEMINDAIAN KATA SUPABASE YANG SUDAH DIGUNAKAN DI DALAM BLOK
    const blockTokens = refinedBlockContent.toLowerCase().match(/\b[a-z]{3,}(?:-[a-z]{3,})?\b/g) || [];
    for (const token of blockTokens) {
      if (evaluatedWordsInBlock.has(token)) continue;
      const matchedSupabaseItem = supabaseMap.get(token) || supabaseMap.get(getCanonicalDedupKey(token));

      if (matchedSupabaseItem) {
        evaluatedWordsInBlock.add(token);
        const lowerTerm = matchedSupabaseItem.entry.toLowerCase();

        // Cek Blacklist
        if (blacklistedKeys.has(matchedSupabaseItem.canonical_key) || blacklistedKeys.has(lowerTerm)) {
          const rejectedScore: ContextualCandidateScore = {
            candidateWord: matchedSupabaseItem.entry,
            supabaseId: matchedSupabaseItem.id,
            category: matchedSupabaseItem.category_label || matchedSupabaseItem.primary_category,
            formalEquivalent: matchedSupabaseItem.formal || undefined,
            sourceType: 'SUPABASE',
            meaningFitScore: 0,
            grammarFitScore: 0,
            contextF7FitScore: 0,
            informalToneScore: 0,
            sentenceFlowScore: 0,
            totalScore: 0,
            passedThreshold: false,
            status: 'REJECTED',
            rejectionReason: `Ditolak (Hard Blacklist Exclusion): Kosakata "${matchedSupabaseItem.entry}" terdeteksi dalam daftar hitam.`,
            blockId,
            sentenceSnippet: sentences.find(s => s.toLowerCase().includes(token)) || sentences[0],
          };
          blockConsidered.push(rejectedScore);
          candidatesLog.push(rejectedScore);
          blockRejected.push(matchedSupabaseItem.entry);
          continue;
        }

        const scoreResult = scoreCandidateInContext({
          candidateWord: matchedSupabaseItem.entry,
          supabaseId: matchedSupabaseItem.id,
          category: matchedSupabaseItem.category_label || matchedSupabaseItem.primary_category,
          formalEquivalent: matchedSupabaseItem.formal,
          contextNote: matchedSupabaseItem.context_note,
          sourceType: 'SUPABASE',
          narrativeContext,
          targetSentence: sentences.find(s => s.toLowerCase().includes(token)) || sentences[0] || refinedBlockContent,
          blockId,
        });

        blockConsidered.push(scoreResult);
        candidatesLog.push(scoreResult);

        if (scoreResult.status === 'SELECTED_SUPABASE') {
          blockSelectedSupabase.push(scoreResult.candidateWord);
        } else {
          blockRejected.push(scoreResult.candidateWord);
        }
      }
    }

    // C. IDENTIFIKASI GLOBAL INFORMAL (PATH B — TIDAK MEMILIKI ID SUPABASE)
    // Kata informal percakapan bahasa Indonesia alami yang digunakan tanpa dipaksakan masuk bank lokal
    const knownGlobalInformalPatterns = [
      'ngedumel', 'kepikiran', 'keburu', 'ngelantur', 'kegep', 'kagok', 'ngoyo',
      'ngaco', 'rese', 'gabut', 'mager', 'curhat', 'nyinyir', 'baper'
    ];

    for (const giWord of knownGlobalInformalPatterns) {
      if (evaluatedWordsInBlock.has(giWord)) continue;
      const rx = new RegExp(`\\b${giWord}\\b`, 'i');
      if (rx.test(refinedBlockContent)) {
        evaluatedWordsInBlock.add(giWord);
        const scoreResult = scoreCandidateInContext({
          candidateWord: giWord,
          category: 'GLOBAL_INFORMAL',
          sourceType: 'GLOBAL_INFORMAL',
          narrativeContext,
          targetSentence: sentences.find(s => rx.test(s)) || sentences[0] || refinedBlockContent,
          blockId,
        });

        blockConsidered.push(scoreResult);
        candidatesLog.push(scoreResult);

        if (scoreResult.status === 'SELECTED_GLOBAL_INFORMAL') {
          blockSelectedGlobalInformal.push(scoreResult.candidateWord);
        }
      }
    }

    // 3. Terapkan Discourse & Connector Intelligence
    refinedBlockContent = processDiscourseConnectors(refinedBlockContent);

    // 4. Terapkan Sentence Flow & Soft-Start Engine pada setiap kalimat
    refinedBlockContent = applySentenceFlowSoftStart(refinedBlockContent);

    // 5. Terapkan Punctuation Lock
    refinedBlockContent = enforceStrictPunctuationLock(refinedBlockContent);

    // Hitung frekuensi kata unik yang benar-benar muncul di teks blok final
    const tokens = refinedBlockContent.toLowerCase().match(/\b[a-z]{3,}(?:-[a-z]{3,})?\b/g) || [];
    for (const token of tokens) {
      blockFrequencies[token] = (blockFrequencies[token] || 0) + 1;
      wordFrequencies[token] = (wordFrequencies[token] || 0) + 1;
    }

    blockBreakdown[blockId] = {
      blockId,
      blockName,
      considered: blockConsidered,
      selectedSupabase: blockSelectedSupabase,
      selectedGlobalInformal: blockSelectedGlobalInformal,
      rejected: blockRejected,
      wordFrequencies: blockFrequencies,
    };

    return refinedBlockContent;
  });

  const finalScript = processedBlocks.join('\n');
  const finalWordCount = finalScript.split(/\s+/).filter(Boolean).length;

  const totalConsidered = candidatesLog.length;
  const totalSelectedSupabase = candidatesLog.filter((c) => c.status === 'SELECTED_SUPABASE').length;
  const totalSelectedGlobalInformal = candidatesLog.filter((c) => c.status === 'SELECTED_GLOBAL_INFORMAL').length;
  const totalRejected = candidatesLog.filter((c) => c.status === 'REJECTED').length;
  const uniqueWordCount = Object.keys(wordFrequencies).length;

  const auditTraceability: HCLSETraceabilityAudit = {
    topic,
    evaluatedAt: new Date().toISOString(),
    totalConsidered,
    totalSelectedSupabase,
    totalSelectedGlobalInformal,
    totalRejected,
    totalActuallyUsedInFinal: totalSelectedSupabase + totalSelectedGlobalInformal,
    finalizationStatus: 'DRAFT_TAHAP_2',
    uniqueWordCount,
    wordFrequencies,
    blockBreakdown,
    candidatesLog,
  };

  return {
    script: finalScript,
    blocks: processedBlocks,
    auditTraceability,
    wordCount: finalWordCount,
  };
}

/**
 * 6. FINALISASI AUTOMATIS HCLSE UNTUK NASKAH FINAL (SETELAH TAHAP 3 / REVISI)
 * Menghitung ulang kata yang benar-benar bertahan dalam naskah final,
 * menghitung frekuensi aktual per blok, dan memperbarui status finalisasi.
 */
export function finalizeHCLSEAuditForScript(
  finalScript: string,
  baseAudit?: HCLSETraceabilityAudit | null,
  topic: string = 'Persoalan Kritis'
): HCLSETraceabilityAudit {
  // Jika belum ada baseAudit, jalankan HCLSE runner untuk menghasilkan audit awal
  if (!baseAudit || !baseAudit.candidatesLog || baseAudit.candidatesLog.length === 0) {
    const generated = runHybridContextualLexiconSelectionEngine({ script: finalScript, topic, outline: finalScript });
    const audit = generated.auditTraceability;
    audit.finalizationStatus = 'FINALIZED_TAHAP_3';
    return audit;
  }

  const blocks = finalScript
    .replace(/\r\n/g, '\n')
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const overallFrequencies: Record<string, number> = {};
  const blockBreakdown: HCLSETraceabilityAudit['blockBreakdown'] = {};

  const BLOCK_NAMES: Record<number, string> = {
    1: 'Blok 1: Hook',
    2: 'Blok 2: Akar Masalah',
    3: 'Blok 3: Inti Masalah',
    4: 'Blok 4: Solusi',
    5: 'Blok 5: Kesimpulan',
  };

  blocks.slice(0, 5).forEach((blockText, index) => {
    const blockId = index + 1;
    const blockName = BLOCK_NAMES[blockId] || `Blok ${blockId}`;
    const blockFreqs: Record<string, number> = {};
    const tokens = blockText.toLowerCase().match(/\b[a-z]{3,}(?:-[a-z]{3,})?\b/g) || [];

    for (const t of tokens) {
      blockFreqs[t] = (blockFreqs[t] || 0) + 1;
      overallFrequencies[t] = (overallFrequencies[t] || 0) + 1;
    }

    const prevBlockData = baseAudit.blockBreakdown?.[blockId];
    blockBreakdown[blockId] = {
      blockId,
      blockName,
      considered: prevBlockData?.considered || [],
      selectedSupabase: prevBlockData?.selectedSupabase || [],
      selectedGlobalInformal: prevBlockData?.selectedGlobalInformal || [],
      rejected: prevBlockData?.rejected || [],
      wordFrequencies: blockFreqs,
    };
  });

  // Hitung berapa kandidat terpilih yang benar-benar ada di naskah final
  const selectedCandidates = baseAudit.candidatesLog.filter(
    (c) => c.status === 'SELECTED_SUPABASE' || c.status === 'SELECTED_GLOBAL_INFORMAL'
  );

  let actuallyUsedCount = 0;
  selectedCandidates.forEach((c) => {
    const norm = c.candidateWord.toLowerCase();
    if (overallFrequencies[norm] || finalScript.toLowerCase().includes(norm)) {
      actuallyUsedCount++;
    }
  });

  return {
    ...baseAudit,
    evaluatedAt: new Date().toISOString(),
    totalActuallyUsedInFinal: actuallyUsedCount,
    finalizationStatus: 'FINALIZED_TAHAP_3',
    uniqueWordCount: Object.keys(overallFrequencies).length,
    wordFrequencies: overallFrequencies,
    blockBreakdown: Object.keys(blockBreakdown).length > 0 ? blockBreakdown : baseAudit.blockBreakdown,
  };
}
