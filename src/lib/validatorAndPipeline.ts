import {
  ABTransitionVariant,
  BlockAudit,
  BlockPostProductionMetadata,
  BlockPostProductionOperation,
  DiscourseRelation,
  DocumentIntegrityReport,
  DocumentIntegrityStatus,
  DurationMode,
  FullScriptAudit,
  GenNASConfig,
  LOCKED_CRITICAL_PERSPECTIVE,
  LOCKED_DURATION_MODE,
  LOCKED_WPM,
  ProfanityEvent,
  ProtectedTokenCategory,
  ProtectedTokenItem,
  ProtectedTokenMap,
  PunctuationIssue,
  ReferenceMetadataCategory,
  ReferenceMetadataItem,
  StageConfig,
  StoryFlowRebalanceResult,
  StyleIssue,
  SuspiciousTokenDetail,
  TransitionAudit,
  VoiceChunk,
  NonSaraGuardReport,
  NonSaraGuardViolation,
  G1G11AuditReport,
  G1G11BlockAudit,
  G1G11PhraseOccurrence,
} from './types';
import {
  inspectNonSaraSemanticViolations,
  runNonSaraPostGenerationGuard,
  runNonSaraPostRevisionGuard,
  runNonSaraPreGenerationGuard,
} from './nonSaraHardGuard';
import {
  analyzeNarrativeContext,
  selectActiveF7PhrasesForBlock,
  runF7PostGenerationAuditAndRevision,
} from './f7ContextualGuardEngine';
export {
  inspectNonSaraSemanticViolations,
  runNonSaraPostGenerationGuard,
  runNonSaraPostRevisionGuard,
  runNonSaraPreGenerationGuard,
};
import {
  detectBinaryCorruption,
  auditUniqueCharacterTokens,
  auditDocxReportedTokens,
  evaluateDocumentIntegrity,
  LEGITIMATE_TYPOGRAPHIC_CHARS_REGEX,
} from './documentValidator';
export {
  detectBinaryCorruption,
  auditUniqueCharacterTokens,
  auditDocxReportedTokens,
  evaluateDocumentIntegrity,
  LEGITIMATE_TYPOGRAPHIC_CHARS_REGEX,
};
import {
  auditCoreLexiconCompleteness,
  FORBIDDEN_STANDALONE_PROFANITY_PATTERNS,
  PROFANITY_ROOT_WORDS,
  RISKY_META_PRESENTER_SIGNPOSTS,
  NARRATIVE_PHRASE_CATEGORIES,
} from './lexiconRegistry';
import { masterLexiconRepository } from './masterLexiconRepository';
import { getActiveG1G11PhraseBank } from './g1g11PhraseRepository';
import {
  classifyDocumentSemantics,
  FORBIDDEN_LEAKED_PHRASES,
} from './documentSemanticClassifier';
import {
  buildSourceGroundedNarrativePlan,
} from './sourceGroundedNarrativePlanner';
import {
  validateSourceFidelity,
} from './sourceFidelityValidator';
import {
  applySQNN,
  validateQuoteFreeNarration,
  DOUBLE_QUOTE_CHARS_REGEX,
} from './sqnnEngine';
import {
  applyLanguagePurityAndSanitization,
  auditLanguageIntegrity,
  eliminateInternalMarkers,
  dissolveResearcherAttributions,
  replaceForeignWordsAndAcronyms,
  normalizeInformalMorphology,
  normalizeSlashedWords,
  deduplicateRepeatedSentences,
  FOREIGN_WORD_DICTIONARY,
  ORAL_ACRONYM_DICTIONARY,
  INVALID_INFORMAL_MORPHOLOGY_MAP,
} from './languageIntegrityEngine';
export {
  classifyDocumentSemantics,
  buildSourceGroundedNarrativePlan,
  validateSourceFidelity,
  FORBIDDEN_LEAKED_PHRASES,
  applySQNN,
  validateQuoteFreeNarration,
  DOUBLE_QUOTE_CHARS_REGEX,
  applyLanguagePurityAndSanitization,
  auditLanguageIntegrity,
  eliminateInternalMarkers,
  dissolveResearcherAttributions,
  replaceForeignWordsAndAcronyms,
  normalizeInformalMorphology,
  normalizeSlashedWords,
  deduplicateRepeatedSentences,
  FOREIGN_WORD_DICTIONARY,
  ORAL_ACRONYM_DICTIONARY,
  INVALID_INFORMAL_MORPHOLOGY_MAP,
};


export const DEFAULT_STAGE_NAMES = [
  {
    name: 'Hook',
    defaultWeight: 8,
    description:
      'Buka dengan paradoks, kejanggalan, atau pertanyaan relevan yang langsung nyentil logika penonton.',
  },
  {
    name: 'Akar Masalah',
    defaultWeight: 17,
    description:
      'Jelaskan latar belakang, kesalahpahaman umum, dan sebab struktural yang nyambung langsung dari hook.',
  },
  {
    name: 'Inti Masalah',
    defaultWeight: 45,
    description:
      'Bedah bukti, mekanisme, data terverifikasi, kontra-argumen, dan konsekuensi nyata secara mendalam.',
  },
  {
    name: 'Penyelesaian',
    defaultWeight: 20,
    description:
      'Evaluasi solusi realistis, keterbatasan kebijakan, trade-off, dan siapa pihak yang paling terdampak.',
  },
  {
    name: 'Kesimpulan',
    defaultWeight: 10,
    description:
      'Sintesis tajam dan pedas untuk ngajak penonton mikir kritis tanpa mengulang kalimat mentah.',
  },
];

export { LOCKED_CRITICAL_PERSPECTIVE, LOCKED_WPM, LOCKED_DURATION_MODE };

/**
 * Algoritma Pembagian Bobot 5 Tahap StoryFlow (Tombol "Ubah"):
 * - Jumlah 5 tahap wajib tepat 100%.
 * - Tidak boleh ada bobot negatif atau <= 0 (minimal 1% per tahap).
 * - Mempertahankan secara mutlak seluruh bobot tahap yang telah diedit/dikunci pengguna (mis. Inti Masalah = 60%).
 * - Menyesuaikan bobot tahap lain yang tidak dikunci secara proporsional agar total tetap 100%.
 * - Mengembalikan error eksplisit jika kombinasi yang dikunci tidak memungkinkan total 100%.
 */
export function rebalanceStoryFlowWeights(
  baseWeights: number[] = [8, 17, 45, 20, 10],
  draftWeights: number[] = [8, 17, 45, 20, 10],
  lockedIndices: number[] = []
): StoryFlowRebalanceResult {
  const count = 5;
  const safeBase = Array.from({ length: count }, (_, i) =>
    Math.max(1, Number(baseWeights[i]) || DEFAULT_STAGE_NAMES[i]?.defaultWeight || 10)
  );
  const cleanDraft = Array.from({ length: count }, (_, i) =>
    Number(draftWeights[i])
  );

  // Cek apakah ada nilai negatif, nol, atau NaN
  for (let i = 0; i < count; i++) {
    if (!Number.isFinite(cleanDraft[i]) || cleanDraft[i] < 1) {
      return {
        valid: false,
        weights: cleanDraft.map((v) => (Number.isFinite(v) ? Math.round(v) : 0)),
        lockedIndices,
        error: `Bobot Tahap ${i + 1} (${DEFAULT_STAGE_NAMES[i]?.name || ''}) tidak boleh bernilai negatif atau kurang dari 1%.`,
      };
    }
    if (cleanDraft[i] > 96) {
      return {
        valid: false,
        weights: cleanDraft.map((v) => Math.round(v)),
        lockedIndices,
        error: `Bobot Tahap ${i + 1} (${DEFAULT_STAGE_NAMES[i]?.name || ''}) maksimal 96% agar empat tahap lainnya tetap memiliki minimal masing-masing 1%.`,
      };
    }
  }

  const roundedDraft = cleanDraft.map((v) => Math.round(v));
  const uniqueLocked = Array.from(
    new Set(lockedIndices.filter((idx) => idx >= 0 && idx < count))
  );

  // Jika belum ada tahap yang dikunci khusus, periksa apakah draft sudah berjumlah 100%
  if (uniqueLocked.length === 0) {
    const sum = roundedDraft.reduce((a, b) => a + b, 0);
    if (sum === 100) {
      return {
        valid: true,
        weights: roundedDraft,
        lockedIndices: [],
      };
    }
    // Normalisasi proporsional ke 100%
    const rawShares = roundedDraft.map((w) => (w / sum) * 100);
    const floors = rawShares.map((s) => Math.max(1, Math.floor(s)));
    let rem = 100 - floors.reduce((a, b) => a + b, 0);
    const order = rawShares
      .map((s, idx) => ({ idx, frac: s - Math.floor(s) }))
      .sort((a, b) => b.frac - a.frac);
    let cursor = 0;
    while (rem > 0) {
      floors[order[cursor % order.length].idx] += 1;
      rem -= 1;
      cursor += 1;
    }
    while (rem < 0) {
      const target = order.find((o) => floors[o.idx] > 1);
      if (!target) break;
      floors[target.idx] -= 1;
      rem += 1;
    }
    return {
      valid: true,
      weights: floors,
      lockedIndices: [],
    };
  }

  const lockedSum = uniqueLocked.reduce((acc, idx) => acc + roundedDraft[idx], 0);
  const unlockedIndices = Array.from({ length: count }, (_, i) => i).filter(
    (i) => !uniqueLocked.includes(i)
  );

  if (unlockedIndices.length === 0) {
    if (lockedSum !== 100) {
      return {
        valid: false,
        weights: roundedDraft,
        lockedIndices: uniqueLocked,
        error: `Kelima tahap telah diedit dengan total ${lockedSum}%. Jumlah lima tahap wajib tepat 100%.`,
      };
    }
    return {
      valid: true,
      weights: roundedDraft,
      lockedIndices: uniqueLocked,
    };
  }

  const remainingBudget = 100 - lockedSum;
  const minRequiredForUnlocked = unlockedIndices.length;

  if (remainingBudget < minRequiredForUnlocked) {
    return {
      valid: false,
      weights: roundedDraft,
      lockedIndices: uniqueLocked,
      error: `Total tahap yang diedit (${lockedSum}%) menyisakan ${remainingBudget}%, sedangkan ${unlockedIndices.length} tahap lain membutuhkan minimal ${minRequiredForUnlocked}% agar jumlah total tetap 100%.`,
    };
  }

  // Distribusikan remainingBudget secara proporsional ke tahap yang tidak dikunci
  const resultWeights = [...roundedDraft];
  const unlockedRefWeights = unlockedIndices.map((idx) => safeBase[idx]);
  const refSum = unlockedRefWeights.reduce((a, b) => a + b, 0) || unlockedIndices.length;

  const exactShares = unlockedIndices.map((idx, pos) => ({
    idx,
    exact: (unlockedRefWeights[pos] / refSum) * remainingBudget,
  }));

  // Pastikan setiap tahap unlocked minimal mendapat 1%
  const allocated = exactShares.map((item) => ({
    idx: item.idx,
    val: Math.max(1, Math.floor(item.exact)),
    frac: item.exact - Math.floor(item.exact),
  }));

  let currentUnlockedSum = allocated.reduce((acc, item) => acc + item.val, 0);
  let diff = remainingBudget - currentUnlockedSum;

  // Urutkan berdasarkan pecahan terbesar (Largest Remainder Method)
  const byRemainderDesc = [...allocated].sort((a, b) => b.frac - a.frac);
  let step = 0;
  while (diff > 0) {
    byRemainderDesc[step % byRemainderDesc.length].val += 1;
    diff -= 1;
    step += 1;
  }

  const byValDesc = [...allocated].sort((a, b) => b.val - a.val);
  step = 0;
  while (diff < 0) {
    const candidate = byValDesc.find((item) => item.val > 1);
    if (!candidate) break;
    candidate.val -= 1;
    diff += 1;
    step += 1;
  }

  for (const item of allocated) {
    resultWeights[item.idx] = item.val;
  }

  return {
    valid: true,
    weights: resultWeights,
    lockedIndices: uniqueLocked,
  };
}

/**
 * Sanitasi kerangka naskah dari upaya prompt-injection yang mencoba mengganti sudut pandang terkunci
 * ("Perilaku & Pola Pikir Masyarakat (Non-SARA)") atau memerintahkan serangan terhadap identitas/SARA/lembaga.
 */
export function sanitizeOutlineAgainstPromptInjection(outlineText: string): {
  sanitizedText: string;
  injectionDetected: boolean;
  removedInstructions: string[];
} {
  if (!outlineText || typeof outlineText !== 'string') {
    return {
      sanitizedText: '',
      injectionDetected: false,
      removedInstructions: [],
    };
  }

  const removedInstructions: string[] = [];
  const injectionPatterns: RegExp[] = [
    /(?:abaikan|lupakan|ganti|ubah|timpa|override|ignore|disregard|forget)\s+(?:semua\s+|seluruh\s+|previous\s+|all\s+|prior\s+)?(?:instruksi|instructions?|aturan|rules?|konteks|context|sudut\s+pandang|perspektif|sistem|system|prompt)[^.\n]*[.\n]?/gi,
    /(?:KONTEKS|SUDUT[_\s]PANDANG|SYSTEM[_\s]PROMPT|PERSPEKTIF)\s*[:=]\s*[^\n]+/gi,
    /(?:serang|hina|caci\s*maki|rendahkan|attack|insult)\s+(?:identitas\s+|religious\s+)?(?:agama|umat|suku|ras|etnis|lembaga|organisasi|institusi|institutions?|individu|tokoh)[^.\n]*[.\n]?/gi,
    /jangan\s+gunakan\s+sudut\s+pandang\s+perilaku[^.\n]*[.\n]?/gi,
  ];

  let working = outlineText;
  for (const rx of injectionPatterns) {
    working = working.replace(rx, (match) => {
      removedInstructions.push(match.trim());
      return ' ';
    });
  }

  const sanitizedText = working
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim();

  return {
    sanitizedText,
    injectionDetected: removedInstructions.length > 0,
    removedInstructions,
  };
}

/**
 * Penentuan Topik & Konteks Judul Secara Otomatis dari Kerangka Naskah:
 * - Pengguna tidak perlu mengisi judul/topik secara manual.
 * - Jika terdapat judul dokumen (atau judul provokatif seperti "10. Mengapa Orang taat beragama itu bisa paling berbahaya"),
 *   judul tersebut diperlakukan sebagai informasi konteks internal, BUKAN fakta yang otomatis terbukti.
 * - Tema utama selalu diarahkan pada Perilaku & Pola Pikir Masyarakat (Non-SARA).
 */
export function inferTopicFromOutline(
  outlineText: string,
  fileName?: string
): {
  inferredTopic: string;
  documentTitleContext: string | null;
  isProvocativeTitleReframed: boolean;
} {
  const { sanitizedText } = sanitizeOutlineAgainstPromptInjection(
    outlineText || ''
  );
  const referenceCleanedOutline = stripReferenceMetadataFromSourceText(sanitizedText);
  const allRawLines = (referenceCleanedOutline || sanitizedText)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  // Cari apakah ada field TOPIC_TITLE atau TOPIC_STATEMENT yang eksplisit dalam format GENFLOW
  let explicitTopicTitle: string | null = null;
  for (const line of allRawLines) {
    const match = line.match(/^(?:TOPIC_TITLE|TOPIC_STATEMENT|JUDUL_TOPIK|TOPIK_UTAMA)\s*[:=]\s*(.+)$/i);
    if (match) {
      const val = match[1].replace(/^\[|\]$/g, '').trim();
      if (val && !/^(?:JUDUL TOPIK|Jelaskan topik|BELUM DIBERIKAN)/i.test(val)) {
        explicitTopicTitle = val;
        break;
      }
    }
  }

  // Filter baris metadata / tag container [GENFLOW_DOCUMENT_START], [GF-01], dsb.
  const lines = allRawLines.filter(
    (l) =>
      !/^\[(?:GENFLOW|DOCUMENT)_[A-Z_]+\]/i.test(l) &&
      !/^\[GF-[0-9A-Z_-]+\]/i.test(l) &&
      !/^(?:SCHEMA_ID|DOCUMENT_TYPE|DOCUMENT_STATUS|FORMAT_NOTE|A\.\s*INPUT\s+UTAMA)\b/i.test(l) &&
      !/^\[(?:JUDUL\s+TOPIK|RINGKASAN|DRAFT|Jelaskan)[^\]]*\]$/i.test(l)
  );

  const rawFileTitle = fileName
    ? fileName.replace(/\.(?:docx|pdf|txt|md|csv)$/i, '').trim()
    : '';
  const firstLine = explicitTopicTitle || lines[0] || rawFileTitle || '';

  const looksLikeHeading =
    Boolean(explicitTopicTitle) ||
    /^\d+\.\s+/.test(firstLine) ||
    (firstLine.length > 0 &&
      firstLine.length <= 110 &&
      !/[.!]$/.test(firstLine) &&
      lines.length >= 1);

  const documentTitleContext = explicitTopicTitle || (looksLikeHeading
    ? firstLine.replace(/^\d+\.\s*/, '').trim()
    : rawFileTitle || null);

  const combinedPreview = `${rawFileTitle} ${firstLine} ${lines.slice(0, 3).join(' ')}`.toLowerCase();

  // Cek apakah dokumen secara spesifik membahas ungkapan "Harta Gak Dibawa Mati"
  if (
    combinedPreview.includes('harta gak dibawa mati') ||
    combinedPreview.includes('harta tidak dibawa mati')
  ) {
    return {
      inferredTopic:
        'pola pikir dan kritik nalar di balik ungkapan "Harta Gak Dibawa Mati"',
      documentTitleContext:
        documentTitleContext ||
        'Pembodohan Religius Logika Hancur di Balik Harta Gak Dibawa Mati',
      isProvocativeTitleReframed: false,
    };
  }

  // Cek apakah judul secara provokatif menyerang langsung identitas ketaatan beragama (seperti kasus "Orang taat beragama itu bisa paling berbahaya")
  const isDirectReligiousIdentityAttack =
    /\b(?:mengapa\s+orang\s+taat\s+beragama|orang\s+taat\s+beragama\s+itu\s+bisa\s+paling\s+berbahaya)\b/i.test(
      combinedPreview
    );

  if (isDirectReligiousIdentityAttack) {
    return {
      inferredTopic:
        'bahaya pola pikir merasa paling benar sendiri serta pembenaran moral tanpa empati sosial dan nalar kritis',
      documentTitleContext,
      isProvocativeTitleReframed: true,
    };
  }

  if (
    /\b(?:paylater|pinjol|utang\s+konsumtif|gaya\s+hidup|konsumerisme)\b/i.test(
      combinedPreview
    )
  ) {
    return {
      inferredTopic:
        'kebiasaan menormalisasi utang konsumtif dan pola pikir impulsif di tengah tekanan gaya hidup',
      documentTitleContext,
      isProvocativeTitleReframed: false,
    };
  }

  if (
    /\b(?:greenwashing|ekologi|iklim|polusi|lingkungan|sedotan\s+plastik)\b/i.test(
      combinedPreview
    )
  ) {
    return {
      inferredTopic:
        'pola pikir simbolis dalam isu lingkungan yang mengalihkan perhatian dari kebiasaan dan tanggung jawab struktural',
      documentTitleContext,
      isProvocativeTitleReframed: false,
    };
  }

  if (
    /\b(?:upah|biaya\s+hidup|kerja\s+keras|meritokrasi|pekerja|gaji)\b/i.test(
      combinedPreview
    )
  ) {
    return {
      inferredTopic:
        'cara bernalar keliru yang menyederhanakan ketimpangan kesejahteraan semata-mata sebagai urusan kurang kerja keras',
      documentTitleContext,
      isProvocativeTitleReframed: false,
    };
  }

  // Ekstraksi topik dari judul / heading kerangka naskah
  if (documentTitleContext && documentTitleContext.length >= 6) {
    const cleanedHeading = documentTitleContext
      .replace(/\[(?:GENFLOW|DOCUMENT)_[A-Z_]+\]/gi, '')
      .replace(/^\[GF-[0-9A-Z_-]+\]/gi, '')
      .replace(/^\d+\.\s*/, '')
      .replace(/[.!?]+$/, '')
      .trim();
    if (cleanedHeading && !/genflow/i.test(cleanedHeading)) {
      return {
        inferredTopic: cleanedHeading,
        documentTitleContext,
        isProvocativeTitleReframed: false,
      };
    }
  }

  return {
    inferredTopic: 'topik kerangka naskah',
    documentTitleContext: null,
    isProvocativeTitleReframed: false,
  };
}

/**
 * Pengunci Konfigurasi Sistem:
 * Memastikan konteks selalu terkunci pada LOCKED_CRITICAL_PERSPECTIVE ("Perilaku & Pola Pikir Masyarakat (Non-SARA)")
 * dan topik ditentukan otomatis dari kerangka naskah.
 */
export function enforceLockedConfig(
  rawConfig: Partial<GenNASConfig> = {}
): GenNASConfig {
  const defaultOutline =
    'Biaya hidup meningkat Rp1.500.000 per bulan sejak 1990-an, sementara pertumbuhan upah riil tertahan di angka 3,14% per tahun. Banyak orang masih terjebak pola pikir yang menyalahkan korban tanpa memeriksa kebiasaan dan cara bernalar yang keliru.';
  const isExplicitlyEmpty =
    rawConfig.faktaTerverifikasi !== undefined &&
    rawConfig.faktaTerverifikasi.trim() === '';

  if (isExplicitlyEmpty) {
    return {
      topik: '',
      konteks: LOCKED_CRITICAL_PERSPECTIVE,
      faktaTerverifikasi: '',
      durasiMenit: Math.max(1, Number(rawConfig.durasiMenit) || 12),
      wpm: LOCKED_WPM,
      modeDurasi: LOCKED_DURATION_MODE,
      jumlahBlok: Math.max(1, Number(rawConfig.jumlahBlok) || 5),
      struktur:
        Array.isArray(rawConfig.struktur) && rawConfig.struktur.length === 5
          ? rawConfig.struktur.map(Number)
          : [8, 17, 45, 20, 10],
      operasi: rawConfig.operasi || 'NASKAH_FINAL',
      inputNaskah: rawConfig.inputNaskah || '',
      allowEditorialRewrite: Boolean(rawConfig.allowEditorialRewrite),
      judulOutput: Boolean(rawConfig.judulOutput),
      primaryModel: rawConfig.primaryModel || 'gemini-3-flash-preview',
      fallbackModel: rawConfig.fallbackModel || 'gemini-3.8-flash',
      seed: rawConfig.seed !== undefined ? Number(rawConfig.seed) : undefined,
    };
  }

  const rawOutline = rawConfig.faktaTerverifikasi?.trim() || defaultOutline;
  const { sanitizedText } = sanitizeOutlineAgainstPromptInjection(rawOutline);
  const effectiveOutline = sanitizedText || defaultOutline;
  const { inferredTopic } = inferTopicFromOutline(effectiveOutline);

  return {
    topik: inferredTopic,
    konteks: LOCKED_CRITICAL_PERSPECTIVE,
    faktaTerverifikasi: effectiveOutline,
    durasiMenit: Math.max(1, Number(rawConfig.durasiMenit) || 12),
    wpm: LOCKED_WPM,
    modeDurasi: LOCKED_DURATION_MODE,
    jumlahBlok: Math.max(1, Number(rawConfig.jumlahBlok) || 5),
    struktur:
      Array.isArray(rawConfig.struktur) && rawConfig.struktur.length > 0
        ? rawConfig.struktur.map(Number)
        : [8, 17, 45, 20, 10],
    operasi: rawConfig.operasi || 'NASKAH_FINAL',
    inputNaskah: rawConfig.inputNaskah || '',
    allowEditorialRewrite: Boolean(rawConfig.allowEditorialRewrite),
    judulOutput: Boolean(rawConfig.judulOutput),
    primaryModel: rawConfig.primaryModel || 'gemini-3-flash-preview',
    fallbackModel: rawConfig.fallbackModel || 'gemini-3.8-flash',
    seed: rawConfig.seed !== undefined ? Number(rawConfig.seed) : undefined,
  };
}

/**
 * Validator Semantik Sasaran Kritik (Non-SARA, Non-Lembaga, Non-Individu):
 * Memastikan kata kasar HANYA mengkritik perilaku, pola pikir, logika, kebiasaan, argumen, tindakan, atau keputusan.
 * Menolak kalimat seperti:
 * - "Orang beragama itu goblok dan berbahaya."
 * - "Lembaga itu isinya orang-orang tolol."
 */
export function inspectCritiqueTargetViolations(sentence: string): {
  hasForbiddenTarget: boolean;
  violationReason?: string;
  reframedSentence?: string;
} {
  const trimmed = sentence.trim();
  if (!trimmed) {
    return { hasForbiddenTarget: false };
  }

  // Pastikan kalimat yang sudah membingkai sasaran pada "pola pikir", "logika", "cara mikir", "anggapan", "kebiasaan", "perilaku", "argumen", "pembenaran" tidak terkena false positive
  const hasExplicitValidCognitiveFraming =
    /\b(?:yang\s+(?:tolol|goblok|bego|bodoh|dungu|idiot|kampungan|sinting|gila)\s+itu\s+(?:pola\s+pikir|logika|cara\s+mikir|anggapan|kebiasaan|perilaku|argumen|pembenaran|sikap)|(?:pola\s+pikir|logika|cara\s+mikir|anggapan|asumsi|kebiasaan|perilaku|argumen|pembenaran|keputusan|klaim|alasan|sikap|tindakan|mentalitas|standar|narasi|skema)\s+(?:yang\s+)?(?:tolol|goblok|bego|bodoh|dungu|idiot|kampungan|sinting|gila))\b/i.test(
      trimmed
    );

  // 1. Serangan terhadap identitas agama / umat / suku / ras / etnis / kelompok terlindungi
  const saraAttackPattern =
    /\b(?:orang(?:-orang)?\s+(?:taat\s+)?beragama|umat\s+beragama|umat\s+[a-z]+|agama\s+[a-z]*|penganut\s+[a-z]+|suku\s+[a-z]+|ras\s+[a-z]+|etnis\s+[a-z]+|kelompok\s+agama|kaum\s+beragama)\s+(?:itu\s+|ini\s+|tersebut\s+|memang\s+|emang\s+)?(?:paling\s+|sangat\s+)?(?:tolol|goblok|bego|bodoh|dungu|idiot|kampungan|sinting|gila|berbahaya(?:\s+dan\s+(?:tolol|goblok|bego|bodoh|dungu|idiot|sinting|gila))?)\b/i;

  if (saraAttackPattern.test(trimmed) && !hasExplicitValidCognitiveFraming) {
    return {
      hasForbiddenTarget: true,
      violationReason:
        'DILARANG (Batasan Sasaran Kritik Non-SARA): Menjadikan identitas agama, umat, suku, ras, atau kelompok terlindungi sebagai sasaran makian/penghinaan.',
      reframedSentence:
        'Yang goblok itu pola pikir yang ngerasa semua tindakannya otomatis benar cuma karena dibungkus alasan moral.',
    };
  }

  // 2. Serangan langsung terhadap lembaga, organisasi, institusi, atau individu sebagai "orang-orang tolol/goblok"
  const institutionOrPersonAttackPattern =
    /\b(?:lembaga|organisasi|institusi|instansi|partai|kementerian|komisi|yayasan|tokoh|pejabat|ulama|pendeta|individu)\s+(?:itu|ini|tersebut)?\s*(?:isinya\s+|memang\s+|emang\s+|cuma\s+|adalah\s+)?(?:orang-orang\s+|orang\s+|para\s+|kumpulan\s+|manusia\s+)?(?:tolol|goblok|bego|bodoh|dungu|idiot|kampungan|sinting|gila)\b/i;

  const directPeopleInsultPattern =
    /\b(?:isinya\s+)?(?:orang-orang|orang|manusia|individu|tokoh|pejabat)\s+(?:itu\s+|ini\s+)?(?:memang\s+|emang\s+)?(?:tolol|goblok|bego|bodoh|dungu|idiot|kampungan|sinting|gila)\b/i;

  if (
    (institutionOrPersonAttackPattern.test(trimmed) ||
      directPeopleInsultPattern.test(trimmed)) &&
    !hasExplicitValidCognitiveFraming
  ) {
    return {
      hasForbiddenTarget: true,
      violationReason:
        'DILARANG (Batasan Sasaran Kritik Non-Lembaga/Individu): Menyerang lembaga, organisasi, atau individu secara personal tanpa mengarahkannya pada logika, keputusan, atau kebiasaan.',
      reframedSentence:
        'Logika tolol yang menganggap keputusan nggak perlu dipertanggungjawabkan itu justru bikin kebiasaan buruk terus dipelihara.',
    };
  }

  return { hasForbiddenTarget: false };
}

/**
 * PERBAIKAN 1 — FILTER REFERENSI, DOI, URL, DAN ALAMAT BUKTI
 * Memisahkan Metadata Referensi (DOI, URL HTTP/HTTPS, domain/website, path file,
 * kode referensi daftar pustaka, nomor sitasi, dan label referensi) dari Fakta Substantif
 * agar TIDAK PERNAH masuk ke Protected Facts narasi, prompt narasi, Draft V0, 5 blok SCTF,
 * Naskah Final, maupun file hasil ekspor TXT/DOCX.
 */
const REFERENCE_METADATA_RULES: Array<{
  category: ReferenceMetadataCategory;
  regex: RegExp;
}> = [
  {
    // 1. URL HTTP/HTTPS, FTP, file://, atau www.
    category: 'URL',
    regex:
      /\b(?:https?:\/\/|ftp:\/\/|file:\/\/\/|www\.)[A-Za-z0-9._~:/?#[\]@!$&'()*+,;=%-]+/gi,
  },
  {
    // 2. DOI (Digital Object Identifier): 10.xxxx/... atau doi:10.xxxx/...
    category: 'DOI',
    regex:
      /\b(?:doi\s*[:=]?\s*)?10\.\d{4,9}\/[A-Za-z0-9._;()/:+-]+/gi,
  },
  {
    // 3. Alamat website / domain mandiri dengan path opsional (mis. example.com/data, jurnal.ac.id/artikel)
    category: 'Domain / Website',
    regex:
      /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|org|net|edu|gov|mil|int|ac\.id|co\.id|go\.id|or\.id|sch\.id|web\.id|desa\.id|id|io|ai|co|info|biz|journal|pub)(?:\/[A-Za-z0-9._~:/?#[\]@!$&'()*+,;=%-]*)?\b/gi,
  },
  {
    // 4. Path file / alamat direktori lokal atau server (C:\..., /var/..., /Users/...)
    category: 'Path / Direktori',
    regex:
      /\b[A-Za-z]:\\(?:[^\\/:*?"<>|\r\n\s]+\\)+[^\\/:*?"<>|\r\n\s]*|(?:^|(?<=\s))\/(?:var|usr|home|etc|opt|tmp|Users|Documents|Downloads|app|src|public|storage|mnt|media)\/[^\s<>"{}|\\^`[\]]+/g,
  },
  {
    // 5. Nomor sitasi kurung siku [1], [12, 15] & kode pustaka ISSN/ISBN/PMID/arXiv
    category: 'Sitasi / Nomor Referensi',
    regex:
      /\[\s*\d{1,4}(?:\s*[,–-]\s*\d{1,4})*\s*\]|\b(?:ISSN|ISBN|PMID|arXiv|e-ISSN|p-ISSN)\s*[:=]?\s*[0-9Xx.:-]{4,25}\b/gi,
  },
  {
    // 6. Penanda / label referensi eksplisit (mis. "— Referensi", "Daftar Pustaka:", "Alamat Bukti:")
    category: 'Label Referensi',
    regex:
      /(?:[—–-]\s*)?\b(?:Referensi|Daftar\s+Pustaka|Bibliografi|Alamat\s+Bukti|Sumber\s+Bukti|Tautan\s+Referensi|Link\s+Bukti)\b\s*[:=-]?/gi,
  },
];

export function extractAndSeparateReferenceMetadata(text: string): {
  cleanedText: string;
  referenceMetadata: ReferenceMetadataItem[];
} {
  if (!text || typeof text !== 'string') {
    return { cleanedText: '', referenceMetadata: [] };
  }

  const rawRefSpans: ReferenceMetadataItem[] = [];
  const overlapsRef = (start: number, end: number): boolean =>
    rawRefSpans.some((s) => start < s.endIndex && end > s.startIndex);

  for (const rule of REFERENCE_METADATA_RULES) {
    const rx = new RegExp(rule.regex.source, rule.regex.flags);
    let match: RegExpExecArray | null;
    while ((match = rx.exec(text)) !== null) {
      let value = match[0];
      const startIndex = match.index;
      // Bersihkan tanda baca penutup kalimat yang tidak sengaja menempel di ujung URL/DOI/Domain
      if (
        rule.category === 'URL' ||
        rule.category === 'DOI' ||
        rule.category === 'Domain / Website' ||
        rule.category === 'Path / Direktori'
      ) {
        value = value.replace(/[.,;:!?)]+$/, '');
      }
      const endIndex = startIndex + value.length;
      if (value.length === 0) continue;

      if (!overlapsRef(startIndex, endIndex)) {
        rawRefSpans.push({
          value,
          category: rule.category,
          startIndex,
          endIndex,
        });
      }
    }
  }

  rawRefSpans.sort((a, b) => a.startIndex - b.startIndex);

  let cleanedBuilder = '';
  let cursor = 0;
  for (const span of rawRefSpans) {
    cleanedBuilder += text.slice(cursor, span.startIndex) + ' ';
    cursor = span.endIndex;
  }
  cleanedBuilder += text.slice(cursor);

  const cleanedText = cleanedBuilder
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*([—–-])\s*(?=[.,;:\n]|$)/g, '')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .trim();

  return {
    cleanedText,
    referenceMetadata: rawRefSpans,
  };
}

/**
 * Membersihkan teks sumber dari DOI, URL, domain, path file, dan label referensi
 * sebelum dikirim ke perencana narasi, prompt AI, atau generator deterministik.
 */
export function stripReferenceMetadataFromSourceText(text: string): string {
  return extractAndSeparateReferenceMetadata(text).cleanedText;
}

/**
 * Pemeriksaan akhir (final sanitizer) untuk memastikan naskah narasi (Draft V0, 5 blok SCTF,
 * Naskah Final, dan ekspor TXT/DOCX) 100% bebas dari kebocoran URL, DOI, domain, atau alamat referensi.
 */
export function sanitizeNarrativeFromReferenceLeakage(script: string): string {
  if (!script || typeof script !== 'string') return '';
  const lines = script.split('\n');
  const cleanedLines = lines.map((line) => {
    let { cleanedText } = extractAndSeparateReferenceMetadata(line);
    cleanedText = applyLanguagePurityAndSanitization(cleanedText);
    cleanedText = cleanedText
      .replace(/\s+\b(?:pada|di|dalam|melalui|lewat|via)\s+DOI\b/gi, '')
      .replace(/\s+\bDOI\b(?=\s*[.,;!?]|$)/gi, '')
      .replace(/\s+([.,;!?])/g, '$1')
      .replace(/\s{2,}/g, ' ')
      .trim();
    return cleanedText;
  });
  return applyLanguagePurityAndSanitization(cleanedLines.join('\n'));
}

/**
 * Aturan pencocokan terstruktur SAP Protected Token Detector (berurutan berdasarkan spesifisitas).
 * DILARANG menangkap DOI, URL HTTP/HTTPS, alamat domain, path file, seluruh paragraf,
 * kalimat kutipan bebas, atau byte biner acak.
 */
const PROTECTED_TOKEN_RULES: Array<{
  category: ProtectedTokenCategory;
  regex: RegExp;
}> = [
  {
    // 1. Nominal mata uang: Rp1.500.000, Rp 2.450.000,00, USD 1.200, 1.500.000 rupiah
    category: 'Mata uang',
    regex:
      /\b(?:Rp\.?\s*|IDR\s*|USD\s*|US\$\s*)\d{1,3}(?:\.\d{3})+(?:,\d{1,4})?(?:\s*(?:ribu|juta|miliar|triliun))?\b|\b(?:Rp\.?\s*|IDR\s*|USD\s*|US\$\s*)\d+(?:,\d{1,4})?(?:\s*(?:ribu|juta|miliar|triliun))?\b|\b\d{1,3}(?:\.\d{3})+(?:,\d{1,4})?\s+rupiah\b/g,
  },
  {
    // 2. Tanggal lengkap: 17 Agustus 1945, 5 Februari 2026, 2026-10-29, 12/05/2024
    category: 'Tanggal',
    regex:
      /\b(?:0?[1-9]|[12]\d|3[01])\s+(?:Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember|Jan|Feb|Mar|Apr|Jun|Jul|Agu|Ags|Sep|Okt|Nov|Des)\s+(?:18|19|20)\d{2}\b|\b(?:18|19|20)\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])\b|\b(?:0?[1-9]|[12]\d|3[01])\/(?:0?[1-9]|1[0-2])\/(?:18|19|20)\d{2}\b/g,
  },
  {
    // 3. Tahun dan periode: 1990-an, 2020-an, 1998–2024, abad ke-21
    category: 'Periode',
    regex:
      /\b(?:18|19|20)\d{2}-an\b|\b(?:18|19|20)\d{2}\s*[–-]\s*(?:18|19|20)\d{2}\b|\babad\s+ke-\d{1,2}\b/g,
  },
  {
    // 4. Persentase: 71,5%, 8,25%, 3,14%, 100%, 0,5%
    category: 'Persentase',
    regex: /\b\d{1,3}(?:\.\d{3})*(?:,\d+)?%|\b\d+(?:[.,]\d+)?%/g,
  },
  {
    // 5. Angka ribuan bertitik: 1.500.000, 250.000
    category: 'Angka ribuan',
    regex: /\b\d{1,3}(?:\.\d{3})+(?:,\d+)?\b/g,
  },
  {
    // 6. Angka desimal berkoma: 3,14, 8,25, 0,05, 2,75
    category: 'Desimal',
    regex: /\b\d+,\d+\b/g,
  },
  {
    // 7. Regulasi, pasal, dan rujukan substantif (TANPA URL dan TANPA DOI)
    category: 'Referensi',
    regex:
      /\bUU\s+No\.\s*\d+\s*(?:Tahun\s*\d{4}|\/\d{4})\b|\bPasal\s+\d+(?:\s+ayat\s+\(\d+\))?\b|\b(?:QS\.|Q\.S\.|HR\.)\s*[A-Z][A-Za-z0-9'-]{1,20}(?::\s*\d+(?:-\d+)?)?\b|\([A-Z][A-Za-zÀ-ÿ\s.&-]{1,25},\s*(?:18|19|20)\d{2}[a-z]?\)/g,
  },
  {
    // 8. Singkatan lembaga dan kode teknis yang valid (BPS, OJK, KPK, BI, Kemenkeu, Bappenas, dll.)
    category: 'Kode teknis',
    regex:
      /\b(?:EYD\s+V|COVID-19|SARS-CoV-2|ISO-\d{3,5}|SNI\s+\d+(?:[-:]\d+)*|H2O|CO2|PM2\.5|B2B|B2C|PDB|UMR|UMK|APBN|APBD|BPS|OJK|KPK|WHO|IMF|BI|LPS|BPK|PPATK|KPPU|Bappenas|Kemenkeu|Kemendag|Kemenaker)\b/g,
  },
  {
    // 9. Istilah ilmiah & konsep terproteksi
    category: 'Istilah ilmiah',
    regex:
      /\b(?:Homo\s+sapiens|status\s+quo|ad\s+hominem|straw\s+man|confirmation\s+bias|moral\s+hazard|echo\s+chamber|cognitive\s+dissonance|zero-sum\s+game|lex\s+specialis|ceteris\s+paribus)\b/gi,
  },
];

export interface BinarySignalDetectionResult {
  hasIllegalControlChars: boolean;
  hasReplacementChars: boolean;
  hasBinaryFragments: boolean;
  isFatal: boolean;
  suspiciousGarbageRatio: number;
  suspiciousTokensCount: number;
  suspiciousTokens: SuspiciousTokenDetail[];
  reasons: string[];
  warnings: string[];
}

/**
 * Deteksi apakah teks mengandung signature biner, karakter kontrol ilegal, atau fragmen kompresi.
 * Menggunakan engine terpadu DocumentValidator (src/lib/documentValidator.ts) untuk memisahkan
 * kerusakan biner nyata dari karakter unik / tipografi sah.
 */
export function detectBinaryOrCorruptedSignals(text: string): BinarySignalDetectionResult {
  const binaryAudit = detectBinaryCorruption(text);
  const tokenAudit = auditUniqueCharacterTokens(text);

  const isFatal = binaryAudit.isBinaryCorrupt;
  const reasons = [...binaryAudit.fatalReasons];
  const warnings = [...tokenAudit.warnings];

  return {
    hasIllegalControlChars: binaryAudit.hasIllegalControlChars,
    hasReplacementChars: binaryAudit.hasReplacementChars,
    hasBinaryFragments: binaryAudit.hasBinaryArchiveSignature || binaryAudit.hasUnparsedXmlFragments,
    isFatal,
    suspiciousGarbageRatio: tokenAudit.suspiciousGarbageRatio,
    suspiciousTokensCount: tokenAudit.suspiciousTokensCount,
    suspiciousTokens: tokenAudit.suspiciousTokens,
    reasons,
    warnings,
  };
}

/**
 * 1) InputGuard & SourceFacts: SAP Protected Token Detector.
 * Hanya mengekstrak token fakta substantif terstruktur dari teks yang telah divalidasi,
 * serta mengisolasi Metadata Referensi (DOI, URL, domain, path file, sitasi) agar tidak masuk narasi.
 */
export function extractProtectedTokens(text: string): ProtectedTokenMap {
  if (!text || typeof text !== 'string') {
    return {
      placeholders: {},
      tokens: [],
      items: [],
      occurrences: [],
      maskedText: '',
      referenceMetadata: [],
      cleanedSubstantiveText: '',
      integrity: {
        status: 'VALID',
        valid: true,
        hasIllegalControlChars: false,
        hasReplacementChars: false,
        hasBinaryFragments: false,
        allTokensAreExactSubstrings: true,
        allTokenIndicesValid: true,
        roundTripRestoreExact: true,
        suspiciousGarbageRatio: 0,
        suspiciousTokensCount: 0,
        suspiciousTokens: [],
        warnings: [],
        errors: [],
      },
    };
  }

  // Tolak deteksi token HANYA jika dokumen mengalami korupsi biner fatal (status ERROR)
  const binaryCheck = detectBinaryOrCorruptedSignals(text);
  if (binaryCheck.isFatal) {
    const failedIntegrity: DocumentIntegrityReport = {
      status: 'ERROR',
      valid: false,
      hasIllegalControlChars: binaryCheck.hasIllegalControlChars,
      hasReplacementChars: binaryCheck.hasReplacementChars,
      hasBinaryFragments: binaryCheck.hasBinaryFragments,
      allTokensAreExactSubstrings: true,
      allTokenIndicesValid: true,
      roundTripRestoreExact: true,
      suspiciousGarbageRatio: binaryCheck.suspiciousGarbageRatio,
      suspiciousTokensCount: binaryCheck.suspiciousTokensCount,
      suspiciousTokens: binaryCheck.suspiciousTokens,
      warnings: binaryCheck.warnings,
      errors: binaryCheck.reasons,
    };
    return {
      placeholders: {},
      tokens: [],
      items: [],
      occurrences: [],
      maskedText: text,
      referenceMetadata: [],
      cleanedSubstantiveText: text,
      integrity: failedIntegrity,
    };
  }

  // Tahap Filter Referensi: isolasi seluruh DOI, URL, domain, path file, sitasi kurung siku, dan label referensi
  const { cleanedText: cleanedSubstantiveText, referenceMetadata } =
    extractAndSeparateReferenceMetadata(text);

  const isInsideReferenceSpan = (start: number, end: number): boolean => {
    return referenceMetadata.some(
      (ref) => start < ref.endIndex && end > ref.startIndex
    );
  };

  // Kumpulkan seluruh span kandidat fakta substantif tanpa tumpang tindih
  const rawSpans: Array<{
    value: string;
    category: ProtectedTokenCategory;
    startIndex: number;
    endIndex: number;
  }> = [];

  const isOverlapping = (start: number, end: number): boolean => {
    return rawSpans.some(
      (existing) => start < existing.endIndex && end > existing.startIndex
    );
  };

  for (const rule of PROTECTED_TOKEN_RULES) {
    const rx = new RegExp(rule.regex.source, rule.regex.flags);
    let match: RegExpExecArray | null;
    while ((match = rx.exec(text)) !== null) {
      const value = match[0];
      const startIndex = match.index;
      const endIndex = startIndex + value.length;

      // Pastikan panjang wajar, benar-benar substring dari teks sumber, dan BUKAN bagian dari DOI/URL/Referensi
      if (
        value.length === 0 ||
        value.length > 80 ||
        text.slice(startIndex, endIndex) !== value ||
        isInsideReferenceSpan(startIndex, endIndex)
      ) {
        continue;
      }

      if (!isOverlapping(startIndex, endIndex)) {
        rawSpans.push({
          value,
          category: rule.category,
          startIndex,
          endIndex,
        });
      }
    }
  }

  // Urutkan berdasarkan posisi aktual di dalam teks (startIndex menaik)
  rawSpans.sort((a, b) => a.startIndex - b.startIndex);

  const placeholders: Record<string, string> = {};
  const occurrences: ProtectedTokenItem[] = [];
  const uniqueMap = new Map<string, ProtectedTokenItem>();

  let maskedBuilder = '';
  let cursor = 0;

  rawSpans.forEach((span, idx) => {
    const placeholder = `__PROT_${idx}__`;
    placeholders[placeholder] = span.value;

    maskedBuilder += text.slice(cursor, span.startIndex) + placeholder;
    cursor = span.endIndex;

    const occurrenceItem: ProtectedTokenItem = {
      placeholder,
      value: span.value,
      category: span.category,
      startIndex: span.startIndex,
      endIndex: span.endIndex,
      count: 1,
    };
    occurrences.push(occurrenceItem);

    const existingUnique = uniqueMap.get(span.value);
    if (existingUnique) {
      existingUnique.count += 1;
    } else {
      uniqueMap.set(span.value, { ...occurrenceItem });
    }

    // Jika token adalah Persentase berdesimal koma (mis. "8,25%"), daftarkan juga angka desimal substantifnya ("8,25")
    // ke dalam daftar Fakta Terlindungi (items & tokens) tanpa mengganggu non-overlapping occurrences/maskedText
    if (span.category === 'Persentase' && /^\d+,\d+%$/.test(span.value)) {
      const decimalVal = span.value.slice(0, -1);
      const existingDecimal = uniqueMap.get(decimalVal);
      if (existingDecimal) {
        existingDecimal.count += 1;
      } else {
        uniqueMap.set(decimalVal, {
          placeholder: `${placeholder}_DEC`,
          value: decimalVal,
          category: 'Desimal',
          startIndex: span.startIndex,
          endIndex: span.endIndex - 1,
          count: 1,
        });
      }
    }
  });

  maskedBuilder += text.slice(cursor);

  const items = Array.from(uniqueMap.values());
  const tokens = items.map((item) => item.value);

  const result: ProtectedTokenMap = {
    placeholders,
    tokens,
    items,
    occurrences,
    maskedText: maskedBuilder,
    referenceMetadata,
    cleanedSubstantiveText,
  };

  result.integrity = validateTextAndTokenIntegrity(text, result);
  return result;
}

export function restoreProtectedTokens(
  maskedText: string,
  map: ProtectedTokenMap
): string {
  let restored = maskedText;
  for (const [key, val] of Object.entries(map.placeholders)) {
    restored = restored.split(key).join(val);
  }
  return restored;
}

/**
 * Validasi Integritas Teks & SAP Protected Tokens (6 Pemeriksaan Wajib Sebelum Generasi AI):
 * 1. Tidak terdapat karakter kontrol ilegal atau karakter pengganti (\uFFFD) hasil decoding gagal.
 * 2. Tidak terdapat fragmen biner yang terbaca sebagai teks.
 * 3. Setiap Protected Token berasal dari teks dokumen yang benar.
 * 4. Rentang indeks token sesuai dengan posisi aktual dalam teks.
 * 5. Proses perlindungan dan pemulihan token tidak mengubah angka, tanda baca, simbol %, nama, atau istilah teknis.
 * 6. Jika parsing gagal atau mencurigakan, laporkan error eksplisit.
 */
export function validateTextAndTokenIntegrity(
  text: string,
  existingMap?: ProtectedTokenMap
): DocumentIntegrityReport {
  const tokenMap =
    existingMap ||
    (() => {
      // Hindari rekursi jika dipanggil langsung tanpa map
      return extractProtectedTokens(text);
    })();

  let allTokensAreExactSubstrings = true;
  let allTokenIndicesValid = true;

  // Cek 3: Setiap Protected Token di items wajib merupakan substring sah dari teks asli
  for (const item of tokenMap.items) {
    if (!item.value || !text.includes(item.value)) {
      allTokensAreExactSubstrings = false;
    }
  }

  // Cek 4: Rentang indeks setiap kemunculan token wajib sesuai posisi aktual di dalam teks dan tidak tumpang tindih
  for (let i = 0; i < tokenMap.occurrences.length; i++) {
    const occ = tokenMap.occurrences[i];
    const validBounds =
      occ.startIndex >= 0 &&
      occ.endIndex > occ.startIndex &&
      occ.endIndex <= text.length &&
      occ.endIndex - occ.startIndex === occ.value.length;
    const exactSlice =
      validBounds && text.slice(occ.startIndex, occ.endIndex) === occ.value;
    const nonOverlapping =
      i === 0 || occ.startIndex >= tokenMap.occurrences[i - 1].endIndex;

    if (!validBounds || !exactSlice || !nonOverlapping) {
      allTokenIndicesValid = false;
    }
  }

  // Cek 5: Perlindungan (masking) dan pemulihan (restoring) wajib menghasilkan teks yang 100% identik
  const restored = restoreProtectedTokens(tokenMap.maskedText, tokenMap);
  const roundTripRestoreExact = restored === text;

  return evaluateDocumentIntegrity(text, {
    allTokensAreExactSubstrings,
    allTokenIndicesValid,
    roundTripRestoreExact,
  });
}

/**
 * 2) StoryPlanner: Hitung target kata berdasarkan durasi & WPM (135 default) serta normalisasi 5 tahap
 */
export function calculateStageTargets(
  durasiMenit: number,
  wpm: number = 135,
  rawWeights: number[] = [8, 17, 45, 20, 10],
  jumlahBlok: number = 5
): { totalTargetWords: number; stages: StageConfig[] } {
  const safeDuration = Math.max(1, durasiMenit || 12);
  const safeWpm = Math.max(60, Math.min(260, wpm || 135));
  const totalTargetWords = Math.round(safeDuration * safeWpm);

  const weights: number[] = [];
  for (let i = 0; i < jumlahBlok; i++) {
    weights.push(
      rawWeights[i] !== undefined && rawWeights[i] > 0
        ? rawWeights[i]
        : DEFAULT_STAGE_NAMES[i]?.defaultWeight || Math.round(100 / jumlahBlok)
    );
  }

  const weightSum = weights.reduce((a, b) => a + b, 0) || 100;
  const normalizedPercentages = weights.map((w) =>
    Number(((w / weightSum) * 100).toFixed(2))
  );

  // Hitung target kata per tahap dengan pembulatan yang dijamin berjumlah tepat totalTargetWords
  const preliminaryWords = weights.map((w) =>
    Math.floor((w / weightSum) * totalTargetWords)
  );
  let remainder =
    totalTargetWords - preliminaryWords.reduce((a, b) => a + b, 0);

  // Distribusikan sisa pembulatan ke blok terbesar (biasanya Inti Masalah)
  let cursor = 0;
  const sortedIndices = weights
    .map((w, i) => ({ w, i }))
    .sort((a, b) => b.w - a.w)
    .map((x) => x.i);

  while (remainder > 0) {
    const targetIdx = sortedIndices[cursor % sortedIndices.length];
    preliminaryWords[targetIdx] += 1;
    remainder -= 1;
    cursor += 1;
  }

  const stages: StageConfig[] = weights.map((_, i) => ({
    id: i + 1,
    name: DEFAULT_STAGE_NAMES[i]?.name || `Tahap ${i + 1}`,
    weightPercent: normalizedPercentages[i],
    targetWords: preliminaryWords[i],
    description:
      DEFAULT_STAGE_NAMES[i]?.description ||
      'Kembangkan argumen sebab-akibat secara logis dan kritis.',
  }));

  return { totalTargetWords, stages };
}

/**
 * Tokenisasi kata konsisten: mempertahankan angka (1.500.000, 3,14, 1990-an), nama, kata berafiks/reduplikasi
 */
export function countWordsConsistent(text: string): string[] {
  const cleaned = text.trim();
  if (!cleaned) return [];
  const matches = cleaned.match(
    /(?:Rp\s*)?\d{1,3}(?:\.\d{3})+(?:,\d+)?%?|\d+,\d+%?|(?:19|20)\d{2}-an|[A-Za-zÀ-ÿ0-9]+(?:[-'][A-Za-zÀ-ÿ0-9]+)*/g
  );
  return matches || [];
}

/**
 * 5) StoryFlow / SCTF Parser & Validator (Strict Compact Text Formatting)
 * Satu blok = satu baris teks. Antarblok dipisahkan TEPAT satu \n, TANPA baris kosong (\n\n).
 */
export function parseAndValidateSCTF(
  rawScript: string,
  expectedBlocks: number = 5
): {
  valid: boolean;
  blocks: string[];
  rawLines: string[];
  errors: string[];
} {
  const errors: string[] = [];
  if (!rawScript || !rawScript.trim()) {
    return {
      valid: false,
      blocks: [],
      rawLines: [],
      errors: ['Naskah kosong.'],
    };
  }

  // Normalisasi \r\n ke \n dan trim tepi luar tanpa menghapus newline internal secara diam-diam
  const normalized = rawScript.replace(/\r\n/g, '\n').trim();
  const rawLines = normalized.split('\n');

  const hasEmptyLine = rawLines.some((line) => line.trim().length === 0);
  if (hasEmptyLine) {
    errors.push(
      'Pelanggaran SCTF: Ditemukan baris kosong atau double newline (\\n\\n) di antara blok. Antarblok wajib dipisahkan tepat SATU newline (\\n).'
    );
  }

  const nonEmptyBlocks = rawLines
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (rawLines.length !== expectedBlocks) {
    errors.push(
      `Pelanggaran SCTF: Jumlah baris mentah adalah ${rawLines.length} (ditemukan ${nonEmptyBlocks.length} blok berisi teks), sedangkan kontrak meminta tepat ${expectedBlocks} baris/blok.`
    );
  }

  // Cek apakah ada heading/markdown/numbering di awal baris
  nonEmptyBlocks.forEach((block, idx) => {
    if (/^(?:#+|\*|-|\d+\.|\[?(?:Blok|Tahap|Hook|Paragraf)\s*\d*\]?:)/i.test(block)) {
      errors.push(
        `Pelanggaran SCTF pada Blok ${idx + 1}: Ditemukan label tahap, bullet, atau heading Markdown di awal blok.`
      );
    }
  });

  return {
    valid: errors.length === 0 && rawLines.length === expectedBlocks && !hasEmptyLine,
    blocks: nonEmptyBlocks,
    rawLines,
    errors,
  };
}

/**
 * Pemulihan & Pencegahan Potongan Kalimat:
 * Mencegah dan memperbaiki potongan kalimat di awal blok (misal awalan "nya", ", nya", atau potongan kata).
 */
export function healChoppedPrefixes(rawBlock: string, blockIndex: number = 0): string {
  let cleaned = rawBlock.trim();

  // 1. Jika blok diawali dengan tanda baca gantung (koma, titik, strip)
  cleaned = cleaned.replace(/^[,.\-–—:;]+\s*/, '');

  // 2. Jika blok diawali dengan kata yang terpotong suku kata awalnya ("nyelesaiannya", "simpulannya", "masalahannya")
  cleaned = cleaned
    .replace(/^nyelesaiannya\b/i, 'Penyelesaiannya')
    .replace(/^simpulannya\b/i, 'Kesimpulannya')
    .replace(/^masalahannya\b/i, 'Permasalahannya');

  // 3. Jika blok diawali dengan akhiran gantung "nya" (misal "nya kita harus...", "nya, kita...")
  // Akibat kata "Penyelesaian" atau "Kesimpulan" terpotong sebelumnya
  if (/^nya\b/i.test(cleaned)) {
    if (blockIndex === 3) {
      cleaned = cleaned.replace(/^nya([,\s]+|$)/i, 'Penyelesaiannya$1');
    } else if (blockIndex === 4) {
      cleaned = cleaned.replace(/^nya([,\s]+|$)/i, 'Kesimpulannya$1');
    } else if (blockIndex === 1) {
      cleaned = cleaned.replace(/^nya([,\s]+|$)/i, 'Masalahnya$1');
    } else {
      cleaned = cleaned.replace(/^nya([,\s]+|$)/i, 'Sebenarnya$1');
    }
  }

  // 4. Pastikan huruf pertama blok adalah huruf kapital
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  return cleaned;
}

/**
 * Format array blok menjadi clean_script SCTF murni (tepat n baris, 1 newline, tanpa baris kosong)
 * PERBAIKAN PERMANEN: Hanya menghapus metadata/label tahap jika terdapat delimiter eksplisit (: atau []),
 * jangan pernah memotong kata sah seperti "Penyelesaiannya" atau "Kesimpulannya"!
 */
export function formatBlocksToSCTF(blocks: string[]): string {
  return blocks
    .map((b, idx) => {
      let line = b
        .replace(/\r\n/g, ' ')
        .replace(/\n+/g, ' ');

      // 1. Hapus heading markdown (# ## ###) atau bullet list (* -) di awal baris
      line = line.replace(/^(?:#+|\*|-)\s+/g, '');

      // 2. Hapus format [Blok 1]: atau [Tahap 1 - Hook]: atau [Penyelesaian]:
      line = line.replace(
        /^\[(?:Blok|Tahap|Hook|Akar Masalah|Inti Masalah|Penyelesaian|Kesimpulan|Paragraf)\s*\d*[^\]]*\]\s*[:\-–]?\s*/i,
        ''
      );

      // 3. Hapus penomoran di awal baris seperti "1. " atau "1) "
      line = line.replace(/^\d+[\.\)]\s*/g, '');

      // 4. Hapus format "Blok 1:" atau "Tahap 1 - Hook:" (wajib ada angka atau delimiter)
      line = line.replace(/^(?:Blok|Tahap)\s*\d+\s*[:\-–]\s*/i, '');

      // 5. Hapus label eksplisit yang diakhiri titik dua (Hook:, Akar Masalah:, Inti Masalah:, Penyelesaian:, Kesimpulan:)
      // PENTING: Wajib ada tanda titik dua (:), sehingga "Penyelesaiannya ..." TIDAK AKAN PERNAH TERPOTONG!
      line = line.replace(
        /^(?:Hook|Akar Masalah|Inti Masalah|Penyelesaian|Kesimpulan)\s*:\s*/i,
        ''
      );

      // 5b. Hapus kebocoran tag dokumen/framework seperti [GENFLOW_DOCUMENT_START], [GF-01], dll.
      line = line
        .replace(/\[(?:GENFLOW|DOCUMENT)_[A-Z_]+\]/gi, '')
        .replace(/\[GF-[0-9A-Z_-]+\]/gi, '');

      // 6. Rapikan spasi dan bersihkan potongan kalimat gantung
      line = line.replace(/\s+/g, ' ').trim();
      return healChoppedPrefixes(line, idx);
    })
    .filter(Boolean)
    .join('\n');
}

/**
 * Pemecah kalimat yang menghormati angka desimal/ribuan (1.500.000, 3,14) dan singkatan
 */
export function splitIntoSentences(blockText: string): string[] {
  const protectedMap = extractProtectedTokens(blockText);
  const masked = protectedMap.maskedText;
  const rawParts = masked
    .split(/(?<=[.!?])\s+/)
    .map((s) => restoreProtectedTokens(s, protectedMap).trim())
    .filter(Boolean);
  return rawParts;
}

/**
 * 8) Integrated Profanity Control: Deteksi span kata kasar, evaluasi ambiguitas "gila",
 * larangan kalimat mandiri ("Goblok banget."), cek keterpaduan sintaksis & sasaran argumen.
 */
export function analyzeBlockProfanity(
  blockText: string,
  blockIndex: number
): {
  events: ProfanityEvent[];
  validCount: number;
  passed: boolean;
  distributionPassed: boolean;
  reasons: string[];
} {
  const sentences = splitIntoSentences(blockText);
  const events: ProfanityEvent[] = [];
  let charOffset = 0;

  // Regex untuk menangkap span ungkapan kasar (mis. "pola pikir tolol", "logika goblok banget", "argumen bego", atau kata dasar)
  const profanitySpanRegex =
    /\b(?:(?:pola pikir|logika|argumen|anggapan|asumsi|kebijakan|keputusan|aturan|klaim|alasan|cara mikir|langkah|narasi|sikap|standar|skema|mentalitas|pembenaran|tindakan|sistem)\s+(?:yang\s+)?)?(?:tolol|goblok|bego|bodoh|dungu|idiot|kampungan|sinting|gila)(?:\s+(?:banget|parah|bener|sih))?\b/gi;

  sentences.forEach((sentence, sIdx) => {
    const trimmedSentence = sentence.trim();
    const sentenceStartInBlock = blockText.indexOf(trimmedSentence, charOffset);
    if (sentenceStartInBlock !== -1) {
      charOffset = sentenceStartInBlock + trimmedSentence.length;
    }

    // Cek apakah kalimat ini merupakan kalimat makian mandiri yang dilarang ("Goblok banget.", "Tolol banget.", "Dasar idiot.")
    const isStandaloneSentence = FORBIDDEN_STANDALONE_PROFANITY_PATTERNS.some(
      (rx) => rx.test(trimmedSentence)
    );

    // Cek apakah ada deretan kata kasar beruntun tanpa jeda argumen ("goblok tolol bego" atau "goblok, tolol, bego")
    const isClusteredSpam =
      /\b(tolol|goblok|bego|bodoh|dungu|idiot|kampungan|sinting|gila)(?:\s*,\s*|\s+dan\s+|\s+)(tolol|goblok|bego|bodoh|dungu|idiot|kampungan|sinting|gila)\b/i.test(
        trimmedSentence
      );

    let match: RegExpExecArray | null;
    profanitySpanRegex.lastIndex = 0;

    while ((match = profanitySpanRegex.exec(trimmedSentence)) !== null) {
      const spanText = match[0];
      const matchIndex = match.index;
      const rootMatch = spanText.match(
        /\b(tolol|goblok|bego|bodoh|dungu|idiot|kampungan|sinting|gila)\b/i
      );
      const rootWord = rootMatch ? rootMatch[1].toLowerCase() : spanText.toLowerCase();

      // Cek apakah berada di dalam kutipan langsung "..."
      const beforeText = trimmedSentence.slice(0, matchIndex);
      const quoteCountBefore = (beforeText.match(/"/g) || []).length;
      const isInsideQuotes = quoteCountBefore % 2 === 1;

      // Evaluasi kontekstual khusus untuk kata "gila"
      let isAmbiguousNonProfane = false;
      let ambiguityReason = '';

      if (rootWord === 'gila') {
        const lowerSentence = trimmedSentence.toLowerCase();
        const windowAround = lowerSentence.slice(
          Math.max(0, matchIndex - 28),
          Math.min(lowerSentence.length, matchIndex + spanText.length + 28)
        );

        // 1. Intensifier positif/seru atau interjeksi awal ("Gila, keren", "Gila sih", "Gila nggak tuh", "Gila kan", "untung gila", "keren gila", "seru gila")
        const isExclamationOrIntensifier =
          /^(?:wah\s+|eh\s+)?gila(?:\s*,|\s+sih|\s+nggak\s+tuh|\s+kan|\s+banget\s+keren|\s+keren|\s+seru)/i.test(
            trimmedSentence
          ) ||
          /\b(?:keren|seru|cakep|mantap|enak|laku|cepat|tinggi|untung|kaya)\s+gila\b/i.test(
            windowAround
          ) ||
          /\bgila\s+(?:nggak\s+tuh|sih|kan|keren|seru|beneran\s+keren)\b/i.test(
            windowAround
          );

        // 2. Makna medis / gangguan jiwa harfiah
        const isMedicalSense =
          /\b(?:rumah\s+sakit\s+jiwa|orang\s+gila|pasien\s+gila|sakit\s+jiwa|gangguan\s+jiwa|dokter\s+jiwa)\b/i.test(
            windowAround
          );

        if (isExclamationOrIntensifier) {
          isAmbiguousNonProfane = true;
          ambiguityReason =
            'Kata "gila" di sini berfungsi sebagai intensifier/eksklamasi percakapan ("Gila, keren" / "Gila sih"), bukan makian kritis terhadap argumen.';
        } else if (isMedicalSense) {
          isAmbiguousNonProfane = true;
          ambiguityReason =
            'Kata "gila" di sini bermakna harfiah/medis, bukan makian terhadap logika atau argumen.';
        }
      }

      // Cek apakah makian hanya tempelan di ujung kalimat pendek tanpa klausa penjelas (punchline filler)
      const wordsInSentence = countWordsConsistent(trimmedSentence);
      const isShortEndFiller =
        !isStandaloneSentence &&
        wordsInSentence.length <= 4 &&
        new RegExp(`${spanText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[.!?]*$`, 'i').test(
          trimmedSentence
        );

      const isStandaloneViolation = isStandaloneSentence || isShortEndFiller;

      // Cek apakah kalimat menyerang sasaran terlarang (SARA, agama, suku, lembaga, atau individu)
      const targetSafety = inspectCritiqueTargetViolations(trimmedSentence);
      const isForbiddenTargetViolation = targetSafety.hasForbiddenTarget;

      // Identifikasi sasaran kritik dalam kalimat (Fokus pada Perilaku & Pola Pikir Masyarakat Non-SARA)
      const targetMatch = trimmedSentence.match(
        /\b(pola pikir|logika|argumen|anggapan|asumsi|kebiasaan|perilaku|keputusan|aturan|klaim|alasan|cara mikir|cara bernalar|langkah|narasi|sikap|standar|skema|mentalitas|pembenaran|tindakan|sistem|kebijakan|wacana)\b/i
      );
      const targetConcept = isForbiddenTargetViolation
        ? 'pelanggaran-sasaran-terlarang'
        : targetMatch
          ? targetMatch[1].toLowerCase()
          : wordsInSentence.length >= 6
            ? 'perilaku-dan-pola-pikir-kontekstual'
            : 'tidak-jelas';

      const valid =
        !isStandaloneViolation &&
        !isAmbiguousNonProfane &&
        !isClusteredSpam &&
        !isInsideQuotes &&
        !isForbiddenTargetViolation &&
        wordsInSentence.length >= 5;

      let reason =
        'Terintegrasi secara sintaksis & semantis mengkritik perilaku/pola pikir/logika/argumen (Non-SARA).';
      if (isForbiddenTargetViolation) {
        reason =
          targetSafety.violationReason ||
          'DILARANG: Sasaran kritik menyerang identitas SARA, lembaga, atau individu.';
      } else if (isStandaloneViolation) {
        reason =
          'DILARANG (H4): Makian berdiri sendiri atau menjadi punchline tempelan tanpa klausa argumen.';
      } else if (isAmbiguousNonProfane) {
        reason = ambiguityReason;
      } else if (isClusteredSpam) {
        reason =
          'DILARANG (H6): Menumpuk beberapa kata kasar berderet dalam satu frasa untuk mengakali kuota.';
      } else if (isInsideQuotes) {
        reason =
          'DILARANG (H2): Kata berada di dalam kutipan sumber, bukan evaluasi kritis narator.';
      } else if (wordsInSentence.length < 5) {
        reason =
          'Kalimat terlalu pendek untuk mengintegrasikan sasaran kritik yang jelas.';
      }

      const startChar =
        (sentenceStartInBlock !== -1 ? sentenceStartInBlock : 0) + matchIndex;
      events.push({
        spanId: `B${blockIndex + 1}-S${sIdx + 1}-P${events.length + 1}`,
        blockIndex,
        sentenceIndex: sIdx,
        startChar,
        endChar: startChar + spanText.length,
        text: spanText,
        rootWord,
        surroundingClause: trimmedSentence,
        targetConcept,
        valid,
        isStandaloneViolation,
        isAmbiguousNonProfane,
        isClusteredViolation: isClusteredSpam,
        isForbiddenTargetViolation,
        reason,
      });
    }
  });

  const validEvents = events.filter((e) => e.valid);
  const hasInvalidViolation = events.some(
    (e) =>
      e.isStandaloneViolation ||
      e.isClusteredViolation ||
      Boolean(e.isForbiddenTargetViolation)
  );
  const hasForbiddenTarget = events.some((e) =>
    Boolean(e.isForbiddenTargetViolation)
  );

  // Cek juga apabila ada kalimat dalam blok yang melanggar sasaran kritik meskipun tidak tertangkap span standar
  const sentenceTargetViolations = sentences
    .map((s) => inspectCritiqueTargetViolations(s))
    .filter((v) => v.hasForbiddenTarget);

  const anyTargetViolation =
    hasForbiddenTarget || sentenceTargetViolations.length > 0;

  // Cek sebaran: untuk 4-5 kejadian (H1), harus tersebar di minimal 2 kalimat berbeda jika blok punya >= 2 kalimat
  const uniqueSentencesWithValid = new Set(
    validEvents.map((e) => e.sentenceIndex)
  );
  const distributionPassed =
    sentences.length <= 1
      ? validEvents.length >= 4 &&
        validEvents.length <= 5 &&
        !hasInvalidViolation &&
        !anyTargetViolation
      : uniqueSentencesWithValid.size >= Math.min(2, validEvents.length) &&
        !hasInvalidViolation &&
        !anyTargetViolation;

  const passed =
    validEvents.length >= 4 &&
    validEvents.length <= 5 &&
    !hasInvalidViolation &&
    !anyTargetViolation &&
    distributionPassed;

  const reasons: string[] = [];
  if (anyTargetViolation) {
    reasons.push(
      `Blok ${blockIndex + 1} melanggar Batasan Mutlak Sasaran Kritik: dilarang menyerang identitas agama/SARA, lembaga, atau individu; arahkan kritik pada perilaku, pola pikir, logika, atau kebiasaan.`
    );
  }
  if (validEvents.length < 4) {
    reasons.push(
      `Blok ${blockIndex + 1} baru memiliki ${validEvents.length} makian valid (wajib 4–5 per blok sesuai aturan H1).`
    );
  }
  if (validEvents.length > 5) {
    reasons.push(
      `Blok ${blockIndex + 1} memiliki ${validEvents.length} makian valid (melebihi batas maksimal 5 per blok sesuai aturan H1).`
    );
  }
  if (hasInvalidViolation && !anyTargetViolation) {
    reasons.push(
      `Blok ${blockIndex + 1} mengandung makian tempelan/mandiri atau rentetan makian berderet yang melanggar aturan H4/H6.`
    );
  }
  if (!distributionPassed && validEvents.length >= 4 && !anyTargetViolation) {
    reasons.push(
      `Blok ${blockIndex + 1} menumpuk semua makian dalam satu kalimat; wajib disebar ke bagian berbeda dalam blok.`
    );
  }

  return {
    events,
    validCount: validEvents.length,
    passed,
    distributionPassed,
    reasons,
  };
}

/**
 * 4) SAP — Syntax-Aware Punctuation Validator & Revisi Koma (EYD V)
 * Melindungi angka/desimal/ribuan/tahun, mengecek anak kalimat di depan induk vs induk di depan anak kalimat,
 * koma subjek-predikat, dan koma setelah preposisi.
 */
export function inspectPunctuationIssues(blockText: string): PunctuationIssue[] {
  const issues: PunctuationIssue[] = [];
  const sentences = splitIntoSentences(blockText);

  sentences.forEach((sentence) => {
    const trimmed = sentence.trim();

    // 1. Anak kalimat di depan induk kalimat tanpa koma ("Kalau lo kerja keras peluang belum tentu terbuka.")
    const frontedMatch = trimmed.match(
      /^(Kalau|Ketika|Saat|Meskipun|Walaupun|Karena|Begitu|Selama|Andai)\s+([^,.!?]{10,120})([.!?]?)$/i
    );
    if (frontedMatch) {
      // Cek apakah ada klausa induk setelah klausa syarat
      const body = frontedMatch[2];
      const splitPoint = body.match(
        /^(.+?\b(?:keras|judulnya|luarnya|atas|awal|gini|gitu|terus|data|fakta|aturan|kebijakan|sistem|sederhana))\s+((?:lo|gue|kita|mereka|orang|peluang|masalahnya|hasilnya|dampaknya|kondisi|kebijakan|aturan)\b.+)$/i
      );
      if (splitPoint) {
        issues.push({
          type: 'MISSING_FRONTED_CLAUSE_COMMA',
          sentence: trimmed,
          suggestion: `${frontedMatch[1]} ${splitPoint[1]}, ${splitPoint[2]}${frontedMatch[3] || '.'}`,
          description:
            'Anak kalimat mendahului induk kalimat wajib dipisahkan dengan tanda koma (EYD V).',
        });
      }
    }

    // 2. Induk kalimat mendahului anak kalimat tetapi diberi koma yang tidak perlu sebelum "kalau/karena/ketika/saat"
    const backClauseComma = trimmed.match(
      /^([^,]{10,120}),\s+(kalau|karena|ketika|saat|agar|supaya)\s+(.+)$/i
    );
    if (backClauseComma) {
      // Pastikan bagian pertama bukan anak kalimat yang dibuka dengan "Kalau/Ketika/Walaupun"
      if (
        !/^(?:kalau|ketika|saat|meskipun|walaupun|karena|begitu|selama)\b/i.test(
          backClauseComma[1].trim()
        )
      ) {
        issues.push({
          type: 'UNNECESSARY_BACK_CLAUSE_COMMA',
          sentence: trimmed,
          suggestion: `${backClauseComma[1]} ${backClauseComma[2]} ${backClauseComma[3]}`,
          description:
            'Tidak perlu tanda koma ketika induk kalimat mendahului anak kalimat (EYD V).',
        });
      }
    }

    // 3. Koma otomatis yang salah setelah preposisi/negasi ('di,', 'ke,', 'dari,', 'untuk,', 'nggak,', 'lebih,', 'paling,')
    const prepCommaMatch = trimmed.match(
      /\b(di|ke|dari|untuk|nggak|lebih|paling),\s+([a-zA-ZÀ-ÿ]+)/i
    );
    if (prepCommaMatch) {
      issues.push({
        type: 'PREPOSITION_COMMA_ERROR',
        sentence: trimmed,
        suggestion: trimmed.replace(
          /\b(di|ke|dari|untuk|nggak|lebih|paling),\s+/gi,
          '$1 '
        ),
        description: `Jangan menaruh koma otomatis setelah kata "${prepCommaMatch[1]}".`,
      });
    }

    // 4. Koma yang memisahkan subjek sederhana dan predikat secara keliru
    const subjPredComma = trimmed.match(
      /^((?:Pekerja|Pemerintah|Masyarakat|Kebijakan|Masalah|Aturan|Penonton|Orang|Mereka|Kita|Gue|Lo)(?:\s+[a-zA-ZÀ-ÿ]+){0,2}),\s+((?:selalu|sering|malah|justru|nggak|udah|bikin|ngeliat|ngasih|harus|bakal|bisa)\b.+)$/i
    );
    if (subjPredComma) {
      issues.push({
        type: 'SUBJECT_PREDICATE_COMMA_ERROR',
        sentence: trimmed,
        suggestion: `${subjPredComma[1]} ${subjPredComma[2]}`,
        description:
          'Jangan memisahkan subjek dengan predikat menggunakan tanda koma tanpa konstruksi sisipan yang sah.',
      });
    }

    // 5. Koma yang memisahkan predikat verba transitif dan objek langsung secara keliru
    const predObjComma = trimmed.match(
      /\b(membahas|mengkritik|menolak|melihat|ngeliat|mikirin|ngejelasin|nyalahin|ngebongkar|membuat|menciptakan|mengubah|menuntut|menyalahkan|memeriksa|mengabaikan),\s+(?!(?:kalau|bahwa|karena|tapi|tetapi|namun|sedangkan|meskipun|walaupun|ketika|saat|jika|andai|seolah|padahal|apa|siapa|kenapa|mengapa|bagaimana|di\s+mana)\b)([a-zA-ZÀ-ÿ]+(?:\s+[a-zA-ZÀ-ÿ]+){1,6})/i
    );
    if (predObjComma) {
      issues.push({
        type: 'PREDICATE_OBJECT_COMMA_ERROR',
        sentence: trimmed,
        suggestion: trimmed.replace(
          new RegExp(`\\b(${predObjComma[1]}),\\s+`, 'i'),
          '$1 '
        ),
        description:
          'Jangan memisahkan predikat verba transitif dan objek langsung menggunakan tanda koma.',
      });
    }
  });

  return issues;
}

/**
 * Operasi REVISI_KOMA (Punctuation-Only):
 * Memperbaiki tanda baca berdasarkan EYD V & SAP TANPA mengubah satu kata pun,
 * tanpa mengubah ejaan informal, tanpa mengubah angka terproteksi ("1.500.000", "3,14", "1990-an"),
 * dan tanpa menambah/mengurangi kata kasar.
 */
export function applyRevisiKoma(rawScript: string): string {
  const lines = rawScript.replace(/\r\n/g, '\n').trim().split('\n');

  const revisedLines = lines.map((line) => {
    const protectedMap = extractProtectedTokens(line);
    let masked = protectedMap.maskedText;

    // 1. Hapus koma salah setelah preposisi/negasi: di, ke, dari, untuk, nggak, lebih, paling
    masked = masked.replace(
      /\b(di|ke|dari|untuk|nggak|lebih|paling),\s+/gi,
      '$1 '
    );

    // 2. Hapus koma yang memisahkan subjek sederhana dan predikat di awal kalimat
    masked = masked.replace(
      /(^|[.!?]\s+)((?:Pekerja|Pemerintah|Masyarakat|Kebijakan|Masalah|Aturan|Penonton|Orang|Mereka|Kita|Gue|Lo)(?:\s+[a-zA-ZÀ-ÿ]+){0,2}),\s+((?:selalu|sering|malah|justru|nggak|udah|bikin|ngeliat|ngasih|harus|bakal|bisa)\b)/gi,
      '$1$2 $3'
    );

    // 2b. Hapus koma yang memisahkan predikat verba transitif dan objek langsung
    masked = masked.replace(
      /\b(membahas|mengkritik|menolak|melihat|ngeliat|mikirin|ngejelasin|nyalahin|ngebongkar|membuat|menciptakan|mengubah|menuntut|menyalahkan|memeriksa|mengabaikan),\s+(?!(?:kalau|bahwa|karena|tapi|tetapi|namun|sedangkan|meskipun|walaupun|ketika|saat|jika|andai|seolah|padahal|apa|siapa|kenapa|mengapa|bagaimana|di\s+mana)\b)/gi,
      '$1 '
    );

    // 3. Hapus koma sebelum anak kalimat ("... , kalau/karena/ketika/saat/agar/supaya ...") jika induk kalimat di depan
    masked = masked
      .split(/(?<=[.!?])\s+/)
      .map((sent) => {
        if (
          !/^(?:kalau|ketika|saat|meskipun|walaupun|karena|begitu|selama)\b/i.test(
            sent.trim()
          )
        ) {
          return sent.replace(
            /,\s+(kalau|karena|ketika|saat|agar|supaya)\b/gi,
            ' $1'
          );
        }
        return sent;
      })
      .join(' ');

    // 4. Tambahkan koma setelah anak kalimat di depan induk kalimat ("Kalau lo kerja keras peluang belum tentu terbuka")
    masked = masked
      .split(/(?<=[.!?])\s+/)
      .map((sent) => {
        const fronted = sent.match(
          /^(Kalau|Ketika|Saat|Meskipun|Walaupun|Karena|Begitu|Selama|Andai)\s+([^,.!?]+?)([.!?]?)$/i
        );
        if (fronted) {
          const body = fronted[2];
          const splitPoint = body.match(
            /^(.+?\b(?:keras|judulnya|luarnya|atas|awal|gini|gitu|terus|data|fakta|aturan|kebijakan|sistem|sederhana))\s+((?:lo|gue|kita|mereka|orang|peluang|masalahnya|hasilnya|dampaknya|kondisi|kebijakan|aturan)\b.+)$/i
          );
          if (splitPoint) {
            return `${fronted[1]} ${splitPoint[1]}, ${splitPoint[2]}${fronted[3] || '.'}`;
          }
        }
        return sent;
      })
      .join(' ');

    // 5. Tambahkan koma sebelum konjungsi pertentangan ("tapi", "tetapi", "melainkan", "sedangkan") bila belum ada koma
    masked = masked.replace(
      /([a-zA-ZÀ-ÿ0-9_])\s+(tapi|tetapi|melainkan|sedangkan)\s+/gi,
      '$1, $2 '
    );

    // 6. Rapikan spasi ganda atau spasi sebelum tanda baca
    masked = masked
      .replace(/\s+([,.!?])/g, '$1')
      .replace(/([,.!?])(?=[A-Za-zÀ-ÿ])/g, '$1 ')
      .replace(/\s+/g, ' ')
      .trim();

    return restoreProtectedTokens(masked, protectedMap);
  });

  return revisedLines.join('\n');
}

/**
 * 6) DRA + PTV (Discourse Relation Analysis + Paragraph Transition Validator)
 */
export function analyzeTransitions(blocks: string[]): TransitionAudit[] {
  const transitions: TransitionAudit[] = [];

  for (let i = 1; i < blocks.length; i++) {
    const prevSentences = splitIntoSentences(blocks[i - 1]);
    const currSentences = splitIntoSentences(blocks[i]);
    const previousEnding =
      prevSentences[prevSentences.length - 1] || blocks[i - 1].slice(-120);
    const currentOpening = currSentences[0] || blocks[i].slice(0, 120);
    const lowerOpening = currentOpening.toLowerCase();

    const matchedSignpost = RISKY_META_PRESENTER_SIGNPOSTS.find((phrase) =>
      lowerOpening.includes(phrase)
    );

    let relation: DiscourseRelation = 'ELABORATION';
    if (/^(?:tapi|namun|padahal|sebaliknya|ironisnya|masalahnya)\b/i.test(currentOpening)) {
      relation = 'CONTRAST';
    } else if (
      /^(?:makanya|jadi|dari situ|akibatnya|dampaknya|ujung-ujungnya|efeknya)\b/i.test(
        currentOpening
      )
    ) {
      relation = i === blocks.length - 1 ? 'CONCLUSION' : 'CAUSE_EFFECT';
    } else if (/^(?:misalnya|contohnya|bayangin|ibaratnya)\b/i.test(currentOpening)) {
      relation = 'EXAMPLE';
    } else if (i === blocks.length - 1) {
      relation = 'CONCLUSION';
    } else if (/^(?:terus|selain itu|bukan cuma itu|belum lagi)\b/i.test(currentOpening)) {
      relation = 'CONTINUATION';
    }

    const isMetaPresenterSignpost = Boolean(matchedSignpost);

    // Cek apakah pembuka blok sama sekali tidak berkaitan dengan blok sebelumnya (tidak ada konektor wacana, tidak ada jembatan percakapan/argumen, dan 0 kata kunci bersama)
    const hasDiscourseConnector =
      /^(?:tapi|namun|padahal|sebaliknya|ironisnya|masalahnya|makanya|jadi|dari situ|akibatnya|dampaknya|ujung-ujungnya|efeknya|misalnya|contohnya|bayangin|ibaratnya|terus|selain itu|bukan cuma itu|belum lagi|kalau|ketika|saat|waktu|begitu|soal|nah|apalagi|soalnya|karena|penyelesaiannya|kesimpulannya|akar|inti|solusi|langkah|faktanya|realitanya|data|bukti|artinya|singkatnya|intinya|sebenernya|sebenarnya)\b/i.test(
        currentOpening
      );
    const hasArgumentBridge =
      /\b(?:gue|lo|kita|mereka|orang|masyarakat|pekerja|kebijakan|pola pikir|logika|argumen|masalah|solusi|fakta|data|aturan|keputusan|perilaku|kebiasaan|upah|biaya|sistem|langkah|bukti|dampak|akibat|sebab|akar|inti|kesimpulan|penyelesaian|kritis|korban|publik|sosial|ekonomi|kerja|hidup|negara|hukum|moral|persoalan|situasi|kondisi)\b/i.test(
        currentOpening
      );

    const stopWords = new Set([
      'yang',
      'dari',
      'dalam',
      'dengan',
      'untuk',
      'pada',
      'akan',
      'bisa',
      'atau',
      'tapi',
      'karena',
      'kalau',
      'saat',
      'waktu',
      'buat',
      'sama',
      'udah',
      'sudah',
      'belum',
      'tidak',
      'bukan',
      'nggak',
      'enggak',
      'lebih',
      'paling',
      'sangat',
      'cukup',
      'masih',
      'harus',
      'selalu',
      'sering',
      'selama',
      'tanpa',
      'secara',
      'antara',
    ]);
    const prevContentWords = new Set(
      countWordsConsistent(blocks[i - 1])
        .map((w) => w.toLowerCase())
        .filter((w) => w.length >= 4 && !stopWords.has(w))
    );
    const currContentWords = countWordsConsistent(currentOpening)
      .map((w) => w.toLowerCase())
      .filter((w) => w.length >= 4 && !stopWords.has(w));
    const hasSharedLexicalBridge = currContentWords.some((w) =>
      prevContentWords.has(w)
    );

    const isDisconnectedOpening =
      !isMetaPresenterSignpost &&
      !hasDiscourseConnector &&
      !hasArgumentBridge &&
      !hasSharedLexicalBridge;

    if (isDisconnectedOpening) {
      relation = 'NEW_TOPIC';
    }

    const passed = !isMetaPresenterSignpost && !isDisconnectedOpening;

    transitions.push({
      fromBlock: i,
      toBlock: i + 1,
      relation,
      previousEnding,
      currentOpening,
      isMetaPresenterSignpost,
      isDisconnectedOpening,
      detectedSignpostPhrase: matchedSignpost,
      passed,
      suggestion: isMetaPresenterSignpost
        ? 'Ganti pembuka metapresenter ("kita lanjut lagi / masuk ke bab") dengan kalimat yang langsung menyambung sebab-akibat atau kontras argumen dari akhir blok sebelumnya.'
        : isDisconnectedOpening
        ? 'Pembuka blok tidak berkaitan dengan blok sebelumnya. Tambahkan jembatan kausal, kontras, atau kesinambungan argumen dari akhir blok sebelumnya.'
        : undefined,
    });
  }

  return transitions;
}

/**
 * Operasi REVISI_TRANSISI:
 * Hanya merevisi area kalimat pembuka blok yang terdeteksi memakai signpost metapresenter
 * tanpa menulis ulang seluruh blok atau mengubah fakta/jumlah makian.
 */
export function applyRevisiTransisi(rawScript: string): string {
  const blocks = rawScript
    .replace(/\r\n/g, '\n')
    .trim()
    .split('\n')
    .map((b) => b.trim())
    .filter(Boolean);

  const updated = blocks.map((block, idx) => {
    if (idx === 0) return block;
    let modified = block;
    for (const signpost of RISKY_META_PRESENTER_SIGNPOSTS) {
      const rx = new RegExp(
        `^(?:${signpost.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?:\\s+buat\\s+[^,.]+|\\s*,)?\\s*`,
        'i'
      );
      if (rx.test(modified)) {
        modified = modified.replace(rx, '').trim();
        if (modified.length > 0) {
          modified = modified.charAt(0).toUpperCase() + modified.slice(1);
        }
      }
    }
    return modified.replace(/\s+/g, ' ').trim();
  });

  return formatBlocksToSCTF(updated);
}

/**
 * 7) Analisis Gaya Bahasa Gue–Lo & Leksikon Informal (G1–G7)
 */
export function analyzeBlockStyle(blockText: string): {
  conversationalMarkersFound: string[];
  informalVerbsFound: string[];
  coreLexiconUsed: string[];
  extendedLexiconUsed: string[];
  expansionLexiconUsed: string[];
  formalPronounsFound: string[];
  styleIssues: StyleIssue[];
  stylePassed: boolean;
} {
  const protectedMap = extractProtectedTokens(blockText);
  // Abaikan teks di dalam kutipan langsung "..." saat memeriksa sapaan formal saya/Anda di luar kutipan
  const textWithoutDirectQuotes = protectedMap.maskedText.replace(
    /"[^"\n]{1,240}"/g,
    ' '
  );
  const unquotedText = textWithoutDirectQuotes.toLowerCase();
  const words = countWordsConsistent(unquotedText).map((w) => w.toLowerCase());
  const wordSet = new Set(words);

  const allActive = masterLexiconRepository.getUnifiedEntries();
  let conversationalMarkers = allActive.filter(e => e.primary_category === 'F4').map(e => e.entry);
  let informalVerbs = allActive.filter(e => e.primary_category === 'F5').map(e => e.entry);

  if (conversationalMarkers.length === 0) {
    conversationalMarkers = ['gue', 'lo', 'nggak', 'udah', 'emang', 'kayak', 'soalnya', 'malah', 'ujung-ujungnya', 'buat', 'tapi', 'nah', 'kan', 'deh', 'sih', 'dong', 'tuh'];
  }
  if (informalVerbs.length === 0) {
    informalVerbs = ['bikin', 'ngeliat', 'mikirin', 'ngejelasin', 'ngasih', 'nyalahin', 'ngebongkar', 'ngomongin', 'membenarkan', 'terjebak', 'menyingkirkan', 'memutar', 'membuang', 'mengatur'];
  }

  const conversationalMarkersFound: string[] = [];
  conversationalMarkers.forEach((marker: string) => {
    const mLower = marker.toLowerCase();
    if (mLower.includes(' ')) {
      if (unquotedText.includes(mLower)) {
        conversationalMarkersFound.push(marker);
      }
    } else if (wordSet.has(mLower)) {
      conversationalMarkersFound.push(marker);
    }
  });

  const informalVerbsFound: string[] = [];
  informalVerbs.forEach((verb: string) => {
    const vLower = verb.toLowerCase();
    if (vLower.includes(' ')) {
      if (unquotedText.includes(vLower)) {
        informalVerbsFound.push(verb);
      }
    } else if (wordSet.has(vLower)) {
      informalVerbsFound.push(verb);
    }
  });

  const coreLexiconUsed: string[] = [];
  const extendedLexiconUsed: string[] = [];
  const expansionLexiconUsed: string[] = [];

  const activeUnified = masterLexiconRepository.getUnifiedEntries();
  activeUnified.forEach((item) => {
    const lower = item.entry.toLowerCase();
    const withoutHyphen = lower.replace(/-/g, '');
    if (
      wordSet.has(lower) ||
      wordSet.has(withoutHyphen) ||
      (lower.includes(' ') && unquotedText.includes(lower))
    ) {
      if (item.primary_category === 'F1' || item.categories.includes('F1')) {
        if (!coreLexiconUsed.includes(item.entry)) coreLexiconUsed.push(item.entry);
      } else if (['F2', 'F3', 'F5'].includes(item.primary_category)) {
        if (!extendedLexiconUsed.includes(item.entry)) extendedLexiconUsed.push(item.entry);
      } else {
        if (!expansionLexiconUsed.includes(item.entry)) expansionLexiconUsed.push(item.entry);
      }
    }
  });

  // Cek kata ganti formal "saya" atau "Anda" di luar kutipan
  const formalPronounsFound: string[] = [];
  if (/\bsaya\b/i.test(unquotedText)) formalPronounsFound.push('saya');
  if (/\banda\b/i.test(unquotedText)) formalPronounsFound.push('Anda');

  const styleIssues: StyleIssue[] = [];
  if (formalPronounsFound.length > 0) {
    styleIssues.push({
      type: 'FORMAL_PRONOUN_DETECTED',
      description: `Ditemukan sapaan formal (${formalPronounsFound.join(', ')}) di luar kutipan. Wajib konsisten menggunakan gue–lo.`,
      tokensFound: formalPronounsFound,
    });
  }

  if (conversationalMarkersFound.length < 2) {
    styleIssues.push({
      type: 'INSUFFICIENT_CONVERSATIONAL_MARKERS',
      description: `Blok hanya memiliki ${conversationalMarkersFound.length} penanda percakapan (minimal 2 per blok, mis. gue, lo, nggak, udah, emang, kayak, soalnya, malah).`,
      tokensFound: conversationalMarkersFound,
    });
  }

  if (informalVerbsFound.length < 1) {
    styleIssues.push({
      type: 'INSUFFICIENT_INFORMAL_VERBS',
      description:
        'Blok belum memiliki kata kerja informal (minimal 1 per blok dari bank F1/F2/F3/F5, mis. bikin, ngeliat, mikirin, ngejelasin, ngasih).',
      tokensFound: [],
    });
  }

  // Cek apakah ada audio tags ([shouts], [sighs], <break>) di dalam clean_script
  const audioTagMatches = blockText.match(
    /\[(?:shouts|sighs|laughs|whispers|pause|clears throat|gasp)\]|<break[^>]*>/gi
  );
  if (audioTagMatches && audioTagMatches.length > 0) {
    styleIssues.push({
      type: 'AUDIO_TAG_IN_CLEAN_SCRIPT',
      description:
        'DILARANG menyisipkan audio tags ([shouts], dll.) atau SSML <break> di dalam clean_script.',
      tokensFound: audioTagMatches,
    });
  }

  // Cek kapital semua untuk kata kasar ("GOBLOK!", "TOLOL!")
  const allCapsMatches = blockText.match(
    /\b(?:GOBLOK|TOLOL|BEGO|BODOH|DUNGU|IDIOT|SINTING)\b/g
  );
  if (allCapsMatches && allCapsMatches.length > 0) {
    styleIssues.push({
      type: 'ALL_CAPS_SHOUTING',
      description:
        'Hindari penulisan makian dengan huruf kapital semua (H7: emosi muncul dari argumen, bukan trik kapital/tanda seru).',
      tokensFound: allCapsMatches,
    });
  }

  // Cek penumpukan kosakata/partikel informal yang tidak wajar (mis. deretan >= 3 partikel filler berturut-turut atau repetisi verba informal kembar)
  const unnaturalParticleStack = blockText.match(
    /\b(?:sih|kok|dong|deh|tuh|nih|kan|banget|kayak|emang)\s+(?:sih|kok|dong|deh|tuh|nih|kan|banget|kayak|emang)\s+(?:sih|kok|dong|deh|tuh|nih|kan|banget|kayak|emang)(?:\s+(?:sih|kok|dong|deh|tuh|nih|kan|banget|kayak|emang))*\b/gi
  );
  const repeatedInformalVerb = blockText.match(
    /\b(ngeliat|mikirin|ngejelasin|nyalahin|ngebongkar|bikin|ngasih|ngomongin)\s+\1\b/gi
  );
  const unnaturalMatches = [
    ...(unnaturalParticleStack || []),
    ...(repeatedInformalVerb || []),
  ];
  if (unnaturalMatches.length > 0) {
    styleIssues.push({
      type: 'UNNATURAL_INFORMAL_USAGE',
      description:
        'Terdeteksi penumpukan partikel/kosakata informal secara tidak wajar dalam satu frasa (melanggar aturan F7 kewajaran kalimat lisan).',
      tokensFound: unnaturalMatches,
    });
  }

  const stylePassed = styleIssues.length === 0;

  return {
    conversationalMarkersFound,
    informalVerbsFound,
    coreLexiconUsed,
    extendedLexiconUsed,
    expansionLexiconUsed,
    formalPronounsFound,
    styleIssues,
    stylePassed,
  };
}

/**
 * VALIDATOR DETERMINISTIK BANK FRASA G2-G11 (UNIFIED G1–G11 CONTEXTUAL NARRATION SYSTEM)
 * - G1 merupakan aturan pengendali utama (prinsip pemilihan, rotasi, adaptasi lisan, dan non-forcing).
 * - G2–G11 merupakan 10 kategori fungsi frasa naratif yang tersedia secara global untuk kelima blok StoryFlow.
 * - Memeriksa:
 *   1. Kewajaran penggunaan frasa & adaptasi lisan informal (Gue-Lo).
 *   2. Kecocokan fungsi G dengan makna kalimat.
 *   3. Kesinambungan antargagasan & hubungan antarkalimat.
 *   4. Pencegahan pengulangan frasa pembuka/transisi pada paragraf berurutan.
 *   5. Pencegahan penumpukan pembuka yang tidak alami.
 *   6. Deteksi frasa formal kaku yang belum diadaptasi ke percakapan (mis. "pada akhirnya", "hal yang perlu diperhatikan").
 * - PRINSIP NON-FORCING MUTLAK:
 *   - TANPA target minimal jumlah penggunaan.
 *   - TANPA kuota frasa per blok.
 *   - TANPA kewajiban menggunakan seluruh fungsi G2–G11.
 *   - Blok dengan 0 frasa tambahan LULUS 100% jika naskahnya sudah mengalir alami.
 */
export function auditG1G11PhraseDistribution(script: string): G1G11AuditReport {
  if (!script || typeof script !== 'string') {
    return {
      passed: false,
      totalPhrasesFound: 0,
      targetPhrasesTotal: 0,
      blocksPassedCount: 0,
      blockAudits: [],
      summary: 'Naskah kosong atau tidak valid.',
      reasons: ['Script kosong'],
    };
  }

  const jumlahBlok = 5;
  const sctfCheck = parseAndValidateSCTF(script, jumlahBlok);
  const blocks = sctfCheck.blocks;

  const blockAudits: G1G11BlockAudit[] = [];
  let totalPhrasesFound = 0;
  let blocksPassedCount = 0;
  const overallReasons: string[] = [];

  const allGCodes = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11'];
  const globalSeenPhrases = new Map<string, number>();
  const blockOpeningPhrases: Array<string | null> = [];

  for (let i = 0; i < jumlahBlok; i++) {
    const blockText = blocks[i] || '';
    const lowerBlock = blockText.toLowerCase();
    const foundPhrases: G1G11PhraseOccurrence[] = [];
    const foundCategoryCodesSet = new Set<string>();

    const activeCategories = getActiveG1G11PhraseBank();
    for (const [catKey, phrases] of Object.entries(activeCategories)) {
      const codeMatch = catKey.match(/^(G\d+)_/);
      const code = (codeMatch ? codeMatch[1] : catKey) as G1G11PhraseOccurrence['categoryCode'];

      for (const rawPhrase of phrases) {
        const cleanPhrase = rawPhrase
          .replace(/^[–—\s]+/, '')
          .replace(/[,.!?…\s]+$/, '')
          .trim();
        if (!cleanPhrase || cleanPhrase.length < 3) continue;

        const phraseLower = cleanPhrase.toLowerCase();
        if (lowerBlock.includes(phraseLower)) {
          foundPhrases.push({
            category: catKey,
            categoryCode: code,
            phrase: cleanPhrase,
            matchedText: cleanPhrase,
          });
        }
      }
    }

    // Filter out shadowed sub-phrases (misal: "tapi" atau "mungkin" yang merupakan bagian dari "Awalnya mungkin kelihatan sepele, tapi")
    const distinctPhrases = foundPhrases.filter((p) => {
      const pLower = p.phrase.toLowerCase();
      return !foundPhrases.some(
        (other) =>
          other !== p &&
          other.phrase.length > p.phrase.length &&
          other.phrase.toLowerCase().includes(pLower)
      );
    });

    for (const dp of distinctPhrases) {
      foundCategoryCodesSet.add(dp.categoryCode);
      const curCount = globalSeenPhrases.get(dp.phrase.toLowerCase()) || 0;
      globalSeenPhrases.set(dp.phrase.toLowerCase(), curCount + 1);
    }

    // Deteksi G1 (Pola Lisan Percakapan Gue-Lo sebagai Prinsip Pengendali)
    if (
      /\b(?:coba\s+lo|menurut\s+gue|gue\s+rasa|jujur\s+aja|lo\s+pernah|kalau\s+lo|bayangin\s+deh|kalau\s+dipikir|inget\s+nggak|coba\s+deh)\b/i.test(
        blockText
      )
    ) {
      foundCategoryCodesSet.add('G1');
      if (!distinctPhrases.some((p) => p.categoryCode === 'G1')) {
        distinctPhrases.push({
          category: 'G1_IDENTITAS_LISAN',
          categoryCode: 'G1',
          phrase: 'Pola lisan dialogis (gue/lo)',
          matchedText: 'G1 Conversational Pattern',
        });
      }
    }

    // Rekam frasa pembuka blok untuk evaluasi pengulangan pada paragraf berurutan
    const firstSent = blockText.split(/[.!?]\s+/)[0]?.trim().toLowerCase() || '';
    const detectedOpening = distinctPhrases.find(
      (p) => p.phrase.length >= 6 && firstSent.startsWith(p.phrase.toLowerCase().slice(0, 15))
    );
    blockOpeningPhrases.push(detectedOpening ? detectedOpening.phrase.toLowerCase() : null);

    const foundCategoryCodes = Array.from(foundCategoryCodesSet);
    totalPhrasesFound += distinctPhrases.length;

    const blockReasons: string[] = [];

    // Evaluasi 1: Penumpukan pembuka yang tidak alami (>= 4 frasa pembuka bertumpuk dalam paragraf pendek)
    const hasUnnaturalStacking = distinctPhrases.length >= 4 && blockText.length < 180;
    if (hasUnnaturalStacking) {
      blockReasons.push(
        `Blok ${i + 1}: Terdeteksi penumpukan frasa pembuka yang tidak alami (${distinctPhrases.length} frasa dalam paragraf pendek).`
      );
      overallReasons.push(`Blok ${i + 1}: Penumpukan frasa tidak wajar.`);
    }

    // Evaluasi 2: Pengulangan frasa persis dalam satu blok
    const blockPhrasesSeen = new Set<string>();
    let hasBlockRepetition = false;
    for (const p of distinctPhrases) {
      const key = p.phrase.toLowerCase();
      if (key !== 'pola lisan dialogis (gue/lo)' && blockPhrasesSeen.has(key)) {
        hasBlockRepetition = true;
        blockReasons.push(`Blok ${i + 1}: Pengulangan frasa "${p.phrase}" dalam satu blok.`);
        overallReasons.push(`Blok ${i + 1}: Pengulangan frasa "${p.phrase}".`);
      }
      blockPhrasesSeen.add(key);
    }

    // Evaluasi 3: Deteksi frasa formal kaku yang belum diadaptasi ke percakapan santai (Prinsip B & G)
    if (/\bpada\s+akhirnya\b/i.test(blockText)) {
      blockReasons.push(`Blok ${i + 1}: Frasa formal "pada akhirnya" perlu diadaptasi menjadi percakapan "ujung-ujungnya" (Prinsip G1).`);
    }
    if (/\bhal\s+yang\s+perlu\s+diperhatikan\b/i.test(blockText)) {
      blockReasons.push(`Blok ${i + 1}: Frasa kaku "hal yang perlu diperhatikan" perlu diadaptasi menjadi "yang perlu lo lihat" (Prinsip G1).`);
    }

    const blockPassed = !hasUnnaturalStacking && !hasBlockRepetition;
    if (blockPassed) {
      blocksPassedCount++;
    }

    blockAudits.push({
      blockId: i + 1,
      stageName: DEFAULT_STAGE_NAMES[i]?.name || `Blok ${i + 1}`,
      expectedCategoryCodes: allGCodes,
      availableCategoryCodes: allGCodes,
      foundPhrases: distinctPhrases,
      foundCategoryCodes,
      passed: blockPassed,
      targetMet: true, // Non-Forcing: 0 frasa tambahan tetap sah jika narasi sudah alami
      reasons: blockReasons,
    });
  }

  // Evaluasi 4: Pencegahan pengulangan frasa pembuka dan transisi pada paragraf berurutan (Prinsip B & H)
  for (let i = 1; i < jumlahBlok; i++) {
    const prevOp = blockOpeningPhrases[i - 1];
    const curOp = blockOpeningPhrases[i];
    if (prevOp && curOp && prevOp === curOp && prevOp.length > 8) {
      overallReasons.push(
        `Pengulangan frasa pembuka pada paragraf berurutan (Blok ${i} dan Blok ${i + 1} sama-sama diawali "${prevOp}").`
      );
    }
  }

  // Evaluasi 5: Pengulangan frasa persis yang berlebihan di seluruh naskah (> 2x)
  for (const [pText, pCount] of globalSeenPhrases.entries()) {
    if (pCount > 2 && pText.length > 15) {
      overallReasons.push(`Pengulangan berlebihan untuk frasa "${pText}" (${pCount}x di seluruh naskah).`);
    }
  }

  const passed = blocksPassedCount === jumlahBlok && overallReasons.length === 0;
  const summary = passed
    ? `Audit Unified G1–G11 Contextual Narration LULUS: ${totalPhrasesFound} frasa naratif terintegrasi secara wajar dan alami tanpa pengulangan, penumpukan, atau kekakuan bahasa lisan.`
    : `Audit Unified G1–G11 DITEMUKAN CATATAN: ${overallReasons.join('; ')}`;

  return {
    passed,
    totalPhrasesFound,
    targetPhrasesTotal: 0, // Tanpa target kuota kaku
    blocksPassedCount,
    blockAudits,
    summary,
    reasons: overallReasons,
  };
}

/**
 * CONTEXTUAL DYNAMIC PHRASE SELECTION & OPTIMIZATION (G2–G11 — NON-FORCING PRINCIPLE)
 * Mematuhi prinsip Non-Forcing secara mutlak:
 * TIDAK menyisipkan konjungsi berdasarkan kata pemicu ("tidak", "bukan", "masalah", "dampak", "akibat", dll).
 * Pemilihan dan penyatuan frasa dilakukan secara kontekstual oleh AI generation engine.
 * Naskah yang sudah alami dan mengalir lancar dipertahankan 100% tanpa perubahan.
 */
export function enforceG1G11PhraseTarget(
  script: string,
  _config?: Partial<GenNASConfig>
): string {
  if (!script || !script.trim()) return script;

  const jumlahBlok = 5;
  const sctf = parseAndValidateSCTF(script, jumlahBlok);
  if (!sctf.valid) return script;

  // Prinsip Non-Forcing Mutlak: Jangan ubah naskah secara otomatis berbasis kata pemicu regex.
  // Pertahankan struktur 5 blok SCTF dan teks naskah 100% utuh sebagaimana mestinya.
  return formatBlocksToSCTF(sctf.blocks);
}

/**
 * 9) DeterministicValidator: Audit menyeluruh untuk naskah GenNAS Pro V5.1
 */
export function validateFullScript(
  rawScript: string,
  config: Partial<GenNASConfig> = {}
): FullScriptAudit {
  const durasiMenit = config.durasiMenit || 12;
  const wpm = config.wpm || 135;
  const jumlahBlok = config.jumlahBlok || 5;
  const modeDurasi: DurationMode = config.modeDurasi || 'FLEKSIBEL';
  const struktur = config.struktur || [8, 17, 45, 20, 10];

  const { totalTargetWords, stages: stageConfigs } = calculateStageTargets(
    durasiMenit,
    wpm,
    struktur,
    jumlahBlok
  );

  const sctfCheck = parseAndValidateSCTF(rawScript, jumlahBlok);
  const blocks = sctfCheck.blocks;

  const stageAudits: BlockAudit[] = blocks.map((blockText, idx) => {
    const stageMeta = stageConfigs[idx] || {
      id: idx + 1,
      name: `Blok ${idx + 1}`,
      weightPercent: Math.round(100 / jumlahBlok),
      targetWords: Math.round(totalTargetWords / jumlahBlok),
      description: '',
    };

    const wordTokens = countWordsConsistent(blockText);
    const sentences = splitIntoSentences(blockText);
    const profanityCheck = analyzeBlockProfanity(blockText, idx);
    const styleCheck = analyzeBlockStyle(blockText);
    const punctuationIssues = inspectPunctuationIssues(blockText);
    const punctuationPassed = punctuationIssues.length === 0;

    const repairSuggestions: string[] = [
      ...profanityCheck.reasons,
      ...styleCheck.styleIssues.map((s) => s.description),
      ...punctuationIssues.map((p) => p.description),
    ];

    const blockPassed =
      profanityCheck.passed && styleCheck.stylePassed && punctuationPassed;

    return {
      id: idx + 1,
      stageName: stageMeta.name,
      targetWeightPercent: stageMeta.weightPercent,
      targetWords: stageMeta.targetWords,
      words: wordTokens.length,
      sentenceCount: sentences.length,
      text: blockText,
      profanityEvents: profanityCheck.events,
      validProfanityCount: profanityCheck.validCount,
      totalProfanityCandidates: profanityCheck.events.length,
      profanityPassed: profanityCheck.passed,
      profanityDistributionPassed: profanityCheck.distributionPassed,
      conversationalMarkersFound: styleCheck.conversationalMarkersFound,
      informalVerbsFound: styleCheck.informalVerbsFound,
      coreLexiconUsed: styleCheck.coreLexiconUsed,
      extendedLexiconUsed: styleCheck.extendedLexiconUsed,
      expansionLexiconUsed: styleCheck.expansionLexiconUsed,
      formalPronounsFound: styleCheck.formalPronounsFound,
      stylePassed: styleCheck.stylePassed,
      styleIssues: styleCheck.styleIssues,
      punctuationIssues,
      punctuationPassed,
      passed: blockPassed,
      repairSuggestions,
    };
  });

  const totalWords = stageAudits.reduce((sum, b) => sum + b.words, 0);
  stageAudits.forEach((b) => {
    b.actualWeightPercent =
      totalWords > 0 ? Number(((b.words / totalWords) * 100).toFixed(1)) : 0;
  });
  const estimatedDurationMinutes = Number((totalWords / wpm).toFixed(2));
  const estMinWhole = Math.floor(totalWords / wpm);
  const estSecRem = Math.round(((totalWords / wpm) - estMinWhole) * 60);
  const estimatedDurationFormatted = `${estMinWhole}m ${estSecRem}s (estimasi ${wpm} WPM)`;

  // Cek toleransi kata sesuai modeDurasi (KETAT: ±5%, FLEKSIBEL: longgar demi substansi)
  const deltaRatio =
    totalTargetWords > 0
      ? Math.abs(totalWords - totalTargetWords) / totalTargetWords
      : 0;
  const wordTolerancePassed =
    modeDurasi === 'KETAT' ? deltaRatio <= 0.05 : totalWords > 0;

  const transitions = analyzeTransitions(blocks);
  const transitionPassCount = transitions.filter((t) => t.passed).length;
  const allTransitionsPassed = transitions.every((t) => t.passed);

  const kritikPassCount = stageAudits.filter((s) => s.profanityPassed).length;
  const stylePassCount = stageAudits.filter((s) => s.stylePassed).length;
  const punctuationPassCount = stageAudits.filter(
    (s) => s.punctuationPassed
  ).length;

  // Cek protected tokens dari faktaTerverifikasi jika ada
  const sourceProtected = config.faktaTerverifikasi
    ? extractProtectedTokens(config.faktaTerverifikasi).tokens
    : [];
  const factualWarnings: string[] = [];
  let protectedTokensIntact = true;
  sourceProtected.forEach((tok) => {
    if (rawScript && !rawScript.includes(tok)) {
      factualWarnings.push(
        `Perhatian Fakta: Token sumber "${tok}" dari Fakta Terverifikasi belum ditemukan persis di dalam naskah.`
      );
    }
  });

  const lexiconAudit = auditCoreLexiconCompleteness();
  const lockedConfig = enforceLockedConfig(config);

  // NON_SARA_HARD_GUARD — Validasi Mutlak Tahap Post-Generation
  const postGenGuard = runNonSaraPostGenerationGuard(rawScript, lockedConfig);

  const critiqueTargetWarnings: string[] = [];
  postGenGuard.guardReport.violations.forEach((v) => {
    critiqueTargetWarnings.push(`${v.reason} ("${v.culpritText}")`);
  });

  stageAudits.forEach((stage) => {
    const sents = splitIntoSentences(stage.text);
    sents.forEach((sent) => {
      const check = inspectNonSaraSemanticViolations(sent);
      if (check.hasForbiddenTarget && check.violation) {
        const warningMsg = `Blok ${stage.id}: ${check.violation.reason} ("${sent}")`;
        if (!critiqueTargetWarnings.includes(warningMsg)) {
          critiqueTargetWarnings.push(warningMsg);
        }
      }
    });
  });

  const critiqueTargetPassed =
    postGenGuard.passed && critiqueTargetWarnings.length === 0;
  const nonSaraPassed = postGenGuard.passed;

  const overallRepairSuggestions: string[] = [
    ...sctfCheck.errors,
    ...critiqueTargetWarnings,
    ...stageAudits.flatMap((s) => s.repairSuggestions),
    ...transitions
      .filter((t) => !t.passed && t.suggestion)
      .map((t) => `Transisi Blok ${t.fromBlock}→${t.toBlock}: ${t.suggestion}`),
  ];

  // KESESUAIAN KERANGKA / SOURCE FIDELITY VALIDATOR (7 Dimensi Wajib)
  const semanticClassification = classifyDocumentSemantics(
    config.faktaTerverifikasi || '',
    config.topik
  );
  const narrativePlan = buildSourceGroundedNarrativePlan(
    semanticClassification,
    lockedConfig
  );
  const sourceFidelity = validateSourceFidelity(
    rawScript,
    narrativePlan,
    semanticClassification
  );

  if (!sourceFidelity.passed) {
    sourceFidelity.reasons.forEach((r) => {
      overallRepairSuggestions.unshift(`Kesesuaian Kerangka: ${r}`);
    });
  }

  // 8. UNIFIED QUOTE-FREE NARRATION SYSTEM (SQNN) — QUOTE_FREE_VALIDATOR
  const quoteFreeAudit = validateQuoteFreeNarration(rawScript);
  if (!quoteFreeAudit.passed) {
    quoteFreeAudit.details.forEach((d) => {
      overallRepairSuggestions.unshift(`Quote-Free: ${d}`);
    });
  }

  // 9. F7 CONTEXTUAL GUARD POST-GENERATION AUDIT
  const f7ContextualGuard = runF7PostGenerationAuditAndRevision({
    script: rawScript,
    topic: lockedConfig.topik || '',
    outline: lockedConfig.faktaTerverifikasi || '',
  });

  // 10. KEMURNIAN BAHASA INDONESIA, ZERO-LEAKAGE MARKER, ATRIBUSI PENELITI, & KONTROL MORFOLOGI
  const languageIntegrity = auditLanguageIntegrity(rawScript);
  if (!languageIntegrity.passed) {
    languageIntegrity.findings.forEach((f) => {
      overallRepairSuggestions.unshift(`Kemurnian Bahasa: ${f}`);
    });
  }

  // 11. VALIDASI DETERMINISTIK FREKUENSI FRASA G1-G11
  const g1G11Audit = auditG1G11PhraseDistribution(rawScript);
  if (!g1G11Audit.passed) {
    g1G11Audit.reasons.forEach((r) => {
      overallRepairSuggestions.push(`Bank Frasa G1-G11: ${r}`);
    });
  }

  // HIERARKI PRIORITAS SISTEM:
  // 1. NON_SARA_HARD_GUARD (Mutlak — kegagalan Non-SARA membatalkan kelulusan naskah)
  // 2. KESESUAIAN KERANGKA / SOURCE FIDELITY (Mutlak — bebas kebocoran instruksi & relevan dengan sumber)
  // 3. KEMURNIAN BAHASA & ZERO-LEAKAGE MARKER (Mutlak — bebas istilah asing tidak perlu, marker, atribusi peneliti)
  // 4. Akurasi fakta & larangan mengarang tuduhan
  // 5. Karakter narator gue–lo ngomel
  // 6. Strict Integrated Profanity Control (3–5 makian valid/blok)
  // 7. StoryFlow, SCTF, SAP
  // 8. UNIFIED QUOTE-FREE NARRATION (Mutlak — 100% bebas tanda petik ganda)
  // 9. Bank kosakata F1–F8
  const passed =
    sourceFidelity.passed &&
    nonSaraPassed &&
    critiqueTargetPassed &&
    sctfCheck.valid &&
    kritikPassCount === jumlahBlok &&
    stylePassCount === jumlahBlok &&
    punctuationPassCount === jumlahBlok &&
    allTransitionsPassed &&
    lexiconAudit.isComplete &&
    wordTolerancePassed &&
    quoteFreeAudit.passed &&
    languageIntegrity.passed &&
    g1G11Audit.passed;

  return {
    passed,
    sctfValid: sctfCheck.valid,
    sctfErrors: sctfCheck.errors,
    paragraphCount: blocks.length,
    expectedParagraphCount: jumlahBlok,
    totalWords,
    targetTotalWords: totalTargetWords,
    wordTolerancePassed,
    estimatedDurationMinutes,
    estimatedDurationFormatted,
    wpmUsed: wpm,
    kritikPassCount,
    stylePassCount,
    punctuationPassCount,
    transitionPassCount,
    stages: stageAudits,
    transitions,
    factualWarnings,
    protectedTokensChecked: sourceProtected,
    protectedTokensIntact,
    lockedPerspective: LOCKED_CRITICAL_PERSPECTIVE,
    inferredTopic: lockedConfig.topik,
    critiqueTargetPassed,
    critiqueTargetWarnings,
    nonSaraPassed,
    nonSaraGuard: postGenGuard.guardReport,
    lexiconAudit,
    repairSuggestions: overallRepairSuggestions,
    sourceFidelity,
    semanticClassification,
    narrativePlan,
    quoteFree: quoteFreeAudit,
    f7ContextualGuard,
    languageIntegrity,
    g1G11Audit,
    testsNotRun: ['AudioQA_Real_LUFS (membutuhkan file audio hasil render TTS)'],
  };
}

/**
 * 10) TargetedRepair (AUTO_ENFORCE):
 * Memperbaiki pelanggaran pada blok secara terarah dengan perubahan paling kecil:
 * - Menghapus kalimat makian mandiri ("Goblok banget.", "Tolol banget.")
 * - Mengonversi sapaan formal ("saya/Anda") di luar kutipan menjadi "gue/lo"
 * - Menghapus audio tags dari clean_script
 * - Menyesuaikan jumlah makian terintegrasi agar tepat 3–5 kejadian valid per blok dan tersebar di kalimat berbeda
 * - Memperbaiki tanda baca SAP dan transisi metapresenter
 */
export function applyAutoEnforce(
  rawScript: string,
  config: Partial<GenNASConfig> = {}
): string {
  const sanitizedInput = applyLanguagePurityAndSanitization(rawScript);
  const jumlahBlok = config.jumlahBlok || 5;

  // F7 CONTEXTUAL GUARD: Revisi kontekstual terlebih dahulu jika ada penggunaan F7 yang tidak sesuai konteks
  const f7PrePass = runF7PostGenerationAuditAndRevision({
    script: sanitizedInput,
    topic: config.topik || '',
    outline: config.faktaTerverifikasi || '',
  }).revisedScript;

  // SQNN LAPISAN KEDUA: Jika naskah memuat tanda petik ganda, normalisasi semantik terlebih dahulu
  const preNormalized = DOUBLE_QUOTE_CHARS_REGEX.test(f7PrePass)
    ? applySQNN(f7PrePass, config).normalizedScript
    : f7PrePass;

  let blocks = preNormalized
    .replace(/\r\n/g, '\n')
    .trim()
    .split('\n')
    .map((b) => b.trim())
    .filter(Boolean);

  // Jika jumlah blok kurang dari jumlahBlok, bagi blok terpanjang pada batas kalimat
  while (blocks.length < jumlahBlok && blocks.some((b) => splitIntoSentences(b).length >= 2)) {
    let longestIdx = 0;
    let maxSents = 0;
    blocks.forEach((b, i) => {
      const sLen = splitIntoSentences(b).length;
      if (sLen > maxSents) {
        maxSents = sLen;
        longestIdx = i;
      }
    });
    const sents = splitIntoSentences(blocks[longestIdx]);
    const mid = Math.ceil(sents.length / 2);
    const firstHalf = sents.slice(0, mid).join(' ');
    const secondHalf = sents.slice(mid).join(' ');
    blocks.splice(longestIdx, 1, firstHalf, secondHalf);
  }

  // Jika jumlah blok lebih dari jumlahBlok, gabungkan blok kelebihan ke blok sebelumnya
  while (blocks.length > jumlahBlok) {
    const tail = blocks.pop()!;
    blocks[blocks.length - 1] = `${blocks[blocks.length - 1]} ${tail}`.trim();
  }

  const repairedBlocks = blocks.map((block, bIdx) => {
    const prot = extractProtectedTokens(block);
    let working = prot.maskedText;

    // 1. Bersihkan audio tags dari clean_script
    working = working.replace(
      /\s*\[(?:shouts|sighs|laughs|whispers|pause|clears throat|gasp)\]\s*|\s*<break[^>]*>\s*/gi,
      ' '
    );

    // 2. Konversi sapaan formal saya/Anda di luar kutipan langsung menjadi gue/lo
    const quotePlaceholders: Record<string, string> = {};
    let qIdx = 0;
    working = working.replace(/"[^"\n]{1,240}"/g, (m) => {
      const qKey = `__QUOTE_${qIdx++}__`;
      quotePlaceholders[qKey] = m;
      return qKey;
    });

    working = working
      .replace(/\bSaya\b/g, 'Gue')
      .replace(/\bsaya\b/g, 'gue')
      .replace(/\bAnda\b/g, 'lo')
      .replace(/\banda\b/g, 'lo');

    // 3. Turunkan kapital semua pada makian ("GOBLOK" -> "goblok")
    working = working.replace(
      /\b(GOBLOK|TOLOL|BEGO|BODOH|DUNGU|IDIOT|KAMPUNGAN|SINTING)\b/g,
      (m) => m.toLowerCase()
    );

    // 3b. Bersihkan kebocoran teks instruksi/framework/metadata internal dari narasi
    working = working
      .replace(/\[(?:GENFLOW|DOCUMENT)_[A-Z_]+\]/gi, '')
      .replace(/\[GF-[0-9A-Z_-]+\]/gi, '')
      .replace(/\bmaster\s+framework\b/gi, 'pembahasan ini')
      .replace(/\bperencanaan\s+naskah\s*(?:youtube)?\s*presisi\b/gi, 'alur pembahasan')
      .replace(/\bdokumen\s+kerangka\s*(?:kerja)?\b/gi, 'kerangka masalah')
      .replace(/\bperilaku\s*(?:&|dan)\s*pola\s*pikir\s*masyarakat\s*\(non-sara\)\b/gi, 'pola pikir dan cara bernalar yang keliru di masyarakat')
      .replace(/\bnon[_\s-]sara[_\s-]hard[_\s-]guard\b/gi, 'batasan nalar kritis')
      .replace(/\b(?:blok\s*\d+|tahap\s*\d+|hook\s*\(|akar\s+masalah\s*\(|inti\s+masalah\s*\(|penyelesaian\s*\(|kesimpulan\s*\()\s*[:=]/gi, '');

    for (const [qKey, qVal] of Object.entries(quotePlaceholders)) {
      working = working.split(qKey).join(qVal);
    }

    working = restoreProtectedTokens(working, prot);

    // 4. Hapus kalimat makian mandiri ("Goblok banget.", "Tolol banget.", "Bego banget.", "Dasar idiot.")
    // serta arahkan ulang kalimat yang melanggar Batasan Mutlak Sasaran Kritik (SARA / Lembaga / Individu)
    // ke sasaran perilaku, pola pikir, logika, dan kebiasaan!
    let sentences = splitIntoSentences(working)
      .filter(
        (s) =>
          !FORBIDDEN_STANDALONE_PROFANITY_PATTERNS.some((rx) =>
            rx.test(s.trim())
          )
      )
      .map((s) => {
        const targetCheck = inspectCritiqueTargetViolations(s);
        if (targetCheck.hasForbiddenTarget && targetCheck.reframedSentence) {
          return targetCheck.reframedSentence;
        }
        return s;
      });

    // 5. Cek jumlah makian valid saat ini
    let currentJoined = sentences.join(' ');
    let profCheck = analyzeBlockProfanity(currentJoined, bIdx);

    // Jika makian berlebih (> 5), netralkan kelebihan makian pada kalimat akhir menjadi kata sifat kritis non-kasar
    if (profCheck.validCount > 5) {
      const excessEvents = profCheck.events.filter((e) => e.valid).slice(5);
      excessEvents.forEach((ev) => {
        currentJoined = currentJoined.replace(
          ev.text,
          ev.text.replace(
            /\b(tolol|goblok|bego|bodoh|dungu|idiot|kampungan|sinting|gila)\b/i,
            'keliru'
          )
        );
      });
      sentences = splitIntoSentences(currentJoined);
      profCheck = analyzeBlockProfanity(currentJoined, bIdx);
    }

    // Jika makian valid kurang dari 4, integrasikan secara gramatikal pada kata sasaran kritik yang sudah ada
    if (profCheck.validCount < 4) {
      const targetReplacements: Array<{ rx: RegExp; replace: string }> = [
        { rx: /\b(logika)(?!\s+(?:goblok|tolol|bego|bodoh|dungu))\b/i, replace: 'logika goblok' },
        { rx: /\b(anggapan)(?!\s+(?:goblok|tolol|bego|bodoh|dungu))\b/i, replace: 'anggapan tolol' },
        { rx: /\b(keputusan)(?!\s+(?:goblok|tolol|bego|bodoh|dungu))\b/i, replace: 'keputusan bego' },
        { rx: /\b(argumen)(?!\s+(?:goblok|tolol|bego|bodoh|dungu))\b/i, replace: 'argumen dungu' },
        { rx: /\b(asumsi)(?!\s+(?:goblok|tolol|bego|bodoh|dungu))\b/i, replace: 'asumsi bodoh' },
        { rx: /\b(pola\s+pikir)(?!\s+(?:goblok|tolol|bego|bodoh|dungu))\b/i, replace: 'pola pikir tolol' },
        { rx: /\b(cara\s+mikir)(?!\s+(?:goblok|tolol|bego|bodoh|dungu))\b/i, replace: 'cara mikir goblok' },
        { rx: /\b(alasan)(?!\s+(?:goblok|tolol|bego|bodoh|dungu))\b/i, replace: 'alasan bego' },
        { rx: /\b(klaim)(?!\s+(?:goblok|tolol|bego|bodoh|dungu))\b/i, replace: 'klaim bodoh' },
        { rx: /\b(kebijakan)(?!\s+(?:goblok|tolol|bego|bodoh|dungu))\b/i, replace: 'kebijakan bego' },
        { rx: /\b(pembenaran)(?!\s+(?:goblok|tolol|bego|bodoh|dungu|idiot))\b/i, replace: 'pembenaran idiot' },
        { rx: /\b(sikap)(?!\s+(?:goblok|tolol|bego|bodoh|dungu))\b/i, replace: 'sikap bodoh' },
      ];

      let needed = 4 - profCheck.validCount;
      for (let sIdx = 0; sIdx < sentences.length && needed > 0; sIdx++) {
        const hasProf = PROFANITY_ROOT_WORDS.some((w) =>
          new RegExp(`\\b${w}\\b`, 'i').test(sentences[sIdx])
        );
        if (!hasProf) {
          for (const item of targetReplacements) {
            if (item.rx.test(sentences[sIdx])) {
              sentences[sIdx] = sentences[sIdx].replace(item.rx, item.replace);
              needed--;
              break;
            }
          }
        }
      }
    }

    return sentences.join(' ');
  });

  // Terapkan revisi transisi, revisi koma, penguatan frasa G1-G11, SQNN normalisasi akhir, dan filter anti-kebocoran referensi/DOI/URL
  const transitionCleaned = applyRevisiTransisi(formatBlocksToSCTF(repairedBlocks));
  const commaCleaned = applyRevisiKoma(transitionCleaned);
  const g1G11Enforced = enforceG1G11PhraseTarget(commaCleaned, config);
  const sqnnCleaned = DOUBLE_QUOTE_CHARS_REGEX.test(g1G11Enforced)
    ? applySQNN(g1G11Enforced, config).normalizedScript
    : g1G11Enforced;
  const referenceCleaned = sanitizeNarrativeFromReferenceLeakage(sqnnCleaned);
  let finalScript = formatBlocksToSCTF(referenceCleaned.split('\n'));

  return applyLanguagePurityAndSanitization(finalScript);
}

/**
 * Operasi EXPANDER:
 * Memvalidasi dan memastikan naskah tetap terstruktur, murni secara bahasa, dan mematuhi aturan H
 * TANPA menyisipkan kalimat template buatan backend.
 */
export function applyExpanderDeterministic(
  rawScript: string,
  config: Partial<GenNASConfig> = {}
): string {
  return applyAutoEnforce(rawScript, config);
}

/**
 * 11) VoiceScriptCompiler:
 * Menghasilkan voice_script terpisah dari clean_script.
 * Menormalisasi angka ribuan, desimal, persentase, tahun 1990-an, dan Rp agar siap diucapkan TTS ElevenLabs v4,
 * tanpa mengubah fakta atau menambahkan tag [shouts] sembarangan.
 */
const SATUAN = [
  '',
  'satu',
  'dua',
  'tiga',
  'empat',
  'lima',
  'enam',
  'tujuh',
  'delapan',
  'sembilan',
  'sepuluh',
  'sebelas',
];

export function numberToIndonesianWords(n: number): string {
  if (n < 0) return `minus ${numberToIndonesianWords(Math.abs(n))}`;
  if (n === 0) return 'nol';
  if (n < 12) return SATUAN[n];
  if (n < 20) return `${SATUAN[n - 10]} belas`;
  if (n < 100) {
    const puluh = Math.floor(n / 10);
    const sisa = n % 10;
    return `${SATUAN[puluh]} puluh${sisa > 0 ? ' ' + SATUAN[sisa] : ''}`;
  }
  if (n < 200) {
    const sisa = n - 100;
    return `seratus${sisa > 0 ? ' ' + numberToIndonesianWords(sisa) : ''}`;
  }
  if (n < 1000) {
    const ratus = Math.floor(n / 100);
    const sisa = n % 100;
    return `${SATUAN[ratus]} ratus${sisa > 0 ? ' ' + numberToIndonesianWords(sisa) : ''}`;
  }
  if (n < 2000) {
    const sisa = n - 1000;
    return `seribu${sisa > 0 ? ' ' + numberToIndonesianWords(sisa) : ''}`;
  }
  if (n < 1_000_000) {
    const ribu = Math.floor(n / 1000);
    const sisa = n % 1000;
    return `${numberToIndonesianWords(ribu)} ribu${sisa > 0 ? ' ' + numberToIndonesianWords(sisa) : ''}`;
  }
  if (n < 1_000_000_000) {
    const juta = Math.floor(n / 1_000_000);
    const sisa = n % 1_000_000;
    return `${numberToIndonesianWords(juta)} juta${sisa > 0 ? ' ' + numberToIndonesianWords(sisa) : ''}`;
  }
  if (n < 1_000_000_000_000) {
    const miliar = Math.floor(n / 1_000_000_000);
    const sisa = n % 1_000_000_000;
    return `${numberToIndonesianWords(miliar)} miliar${sisa > 0 ? ' ' + numberToIndonesianWords(sisa) : ''}`;
  }
  return String(n);
}

export function compileVoiceScript(
  cleanScript: string,
  options: { enableSubtleAudioTags?: boolean } = {}
): string {
  const sanitized = applyLanguagePurityAndSanitization(cleanScript);
  const blocks = sanitized
    .replace(/\r\n/g, '\n')
    .trim()
    .split('\n')
    .map((b) => b.trim())
    .filter(Boolean);

  const compiledBlocks = blocks.map((block, idx) => {
    let text = block;

    // 1. Tahun dekade seperti 1990-an -> sembilan belas sembilan puluhan / 2020-an -> dua ribu dua puluhan
    text = text.replace(/\b(19|20)(\d{2})-an\b/g, (_, prefix, tail) => {
      const fullYear = parseInt(`${prefix}${tail}`, 10);
      if (prefix === '19') {
        const tailNum = parseInt(tail, 10);
        return `sembilan belas ${numberToIndonesianWords(tailNum)}-an`;
      }
      return `${numberToIndonesianWords(fullYear)}-an`;
    });

    // 2. Mata uang Rp1.500.000 -> satu juta lima ratus ribu rupiah
    text = text.replace(
      /\bRp\s*(\d{1,3}(?:\.\d{3})+)(?:,00)?\b/g,
      (_, numStr) => {
        const rawNum = parseInt(numStr.replace(/\./g, ''), 10);
        if (!isNaN(rawNum)) {
          return `${numberToIndonesianWords(rawNum)} rupiah`;
        }
        return _;
      }
    );

    // 3. Angka ribuan dengan titik: 1.500.000 -> satu juta lima ratus ribu
    text = text.replace(/\b(\d{1,3}(?:\.\d{3})+)\b/g, (_, numStr) => {
      const rawNum = parseInt(numStr.replace(/\./g, ''), 10);
      if (!isNaN(rawNum)) {
        return numberToIndonesianWords(rawNum);
      }
      return _;
    });

    // 4. Desimal dengan koma & persen opsional: 3,14 -> tiga koma satu empat | 45,5% -> empat puluh lima koma lima persen
    text = text.replace(/\b(\d+),(\d+)\b(%?)/g, (_, whole, dec, pct) => {
      const wholeWords = numberToIndonesianWords(parseInt(whole, 10));
      const decWords = dec
        .split('')
        .map((d: string) =>
          d === '0' ? 'nol' : numberToIndonesianWords(parseInt(d, 10))
        )
        .join(' ');
      return `${wholeWords} koma ${decWords}${pct ? ' persen' : ''}`;
    });

    // 5. Persentase bulat: 45% -> empat puluh lima persen
    text = text.replace(/\b(\d+)%/g, (_, num) => {
      return `${numberToIndonesianWords(parseInt(num, 10))} persen`;
    });

    // 6. Opsional: Audio tags ElevenLabs v4 yang hemat (HANYA di voice_script, tidak pernah [shouts])
    if (options.enableSubtleAudioTags && idx === 1) {
      text = `[sighs] ${text}`;
    }

    return text;
  });

  return compiledBlocks.join('\n\n');
}

/**
 * 12) ElevenLabsService Chunker:
 * Memecah voice_script pada batas kalimat alami (bukan paksaan 5 paragraf mentah)
 * dengan menyertakan previous_text dan next_text agar kontinuitas prosodi terjaga.
 */
export function buildElevenLabsChunks(
  voiceScript: string,
  maxCharsPerChunk: number = 950,
  wpm: number = 135
): VoiceChunk[] {
  const blocks = voiceScript
    .replace(/\r\n/g, '\n')
    .split(/\n+/)
    .map((b) => b.trim())
    .filter(Boolean);

  const chunks: VoiceChunk[] = [];

  blocks.forEach((blockText, bIdx) => {
    const sentences = splitIntoSentences(blockText);
    let currentSentences: string[] = [];
    let startSentIdx = 1;

    sentences.forEach((sent, sIdx) => {
      const candidate = [...currentSentences, sent].join(' ');
      if (candidate.length > maxCharsPerChunk && currentSentences.length > 0) {
        const chunkText = currentSentences.join(' ');
        const wordCount = countWordsConsistent(chunkText).length;
        chunks.push({
          chunkId: `CHK-${chunks.length + 1}`,
          blockId: bIdx + 1,
          sentenceRange: `S${startSentIdx}–S${sIdx}`,
          text: chunkText,
          charCount: chunkText.length,
          estimatedSeconds: Math.max(2, Math.round((wordCount / wpm) * 60)),
        });
        currentSentences = [sent];
        startSentIdx = sIdx + 1;
      } else {
        currentSentences.push(sent);
      }
    });

    if (currentSentences.length > 0) {
      const chunkText = currentSentences.join(' ');
      const wordCount = countWordsConsistent(chunkText).length;
      chunks.push({
        chunkId: `CHK-${chunks.length + 1}`,
        blockId: bIdx + 1,
        sentenceRange: `S${startSentIdx}–S${sentences.length}`,
        text: chunkText,
        charCount: chunkText.length,
        estimatedSeconds: Math.max(2, Math.round((wordCount / wpm) * 60)),
      });
    }
  });

  // Isi previous_text dan next_text dari kalimat tetangga untuk menjaga prosody continuity
  return chunks.map((chunk, idx) => ({
    ...chunk,
    previous_text: idx > 0 ? chunks[idx - 1].text.slice(-220) : undefined,
    next_text:
      idx < chunks.length - 1 ? chunks[idx + 1].text.slice(0, 220) : undefined,
  }));
}

/**
 * Uji A/B Transisi P1 -> P2 sesuai Bagian I.7:
 * (A) teks asli dengan separator asli
 * (B) tanpa jeda paragraf
 * (C) pembuka revisi dengan separator
 * (D) pembuka revisi tanpa separator
 */
export function buildABTransitionVariants(
  cleanScript: string
): ABTransitionVariant[] {
  const blocks = cleanScript
    .replace(/\r\n/g, '\n')
    .trim()
    .split('\n')
    .filter(Boolean);

  const b1Sents = splitIntoSentences(blocks[0] || '');
  const b2Sents = splitIntoSentences(blocks[1] || '');

  const p1Ending =
    b1Sents[b1Sents.length - 1] ||
    'Anggapan tolol kayak gini bikin orang lupa kalau kesempatan tiap orang nggak sama.';
  const p2OpeningOriginal =
    b2Sents[0] ||
    'Dari situ kelihatan kalau masalahnya bukan cuma soal rajin atau malas, tapi juga akses kerja yang timpang.';

  const revisedScript = applyRevisiTransisi(cleanScript);
  const revBlocks = revisedScript.split('\n').filter(Boolean);
  const revB2Sents = splitIntoSentences(revBlocks[1] || '');
  const p2OpeningRevised =
    revB2Sents[0] !== p2OpeningOriginal
      ? revB2Sents[0]
      : `Dari situ kelihatan jelas kalau ${p2OpeningOriginal.charAt(0).toLowerCase()}${p2OpeningOriginal.slice(1)}`;

  return [
    {
      variant: 'A',
      label: 'Varian A — Teks Asli + Separator Paragraf (\\n)',
      description:
        'Transisi akhir Blok 1 ke awal Blok 2 menggunakan kalimat pembuka asli dengan pemisah baris standar.',
      p1Ending,
      p2Opening: p2OpeningOriginal,
      separatorUsed: '\\n',
      combinedPreview: `${p1Ending}\n${p2OpeningOriginal}`,
      prosodyContinuityNotes: {
        loudnessRisk: 'Sedang',
        pitchResetRisk: 'Sedang',
        timbreNotes:
          'Karakter vokal mengikuti dinamika pembuka kalimat asli setelah jeda baris.',
        speedNotes:
          'Jeda natural antarblok sebelum masuk ke klausa pertama Blok 2.',
      },
    },
    {
      variant: 'B',
      label: 'Varian B — Teks Asli Tanpa Jeda Paragraf (Spasi Tunggal)',
      description:
        'Menguji apakah penggabungan akhir Blok 1 dan awal Blok 2 tanpa newline mengurangi lonjakan intonasi awal.',
      p1Ending,
      p2Opening: p2OpeningOriginal,
      separatorUsed: ' (spasi)',
      combinedPreview: `${p1Ending} ${p2OpeningOriginal}`,
      prosodyContinuityNotes: {
        loudnessRisk: 'Rendah',
        pitchResetRisk: 'Rendah',
        timbreNotes:
          'Kontinuitas napas lebih rapat karena model membaca sebagai satu aliran paragraf.',
        speedNotes:
          'Tempo antarblok mengalir langsung tanpa jeda paragraf tambahan.',
      },
    },
    {
      variant: 'C',
      label: 'Varian C — Pembuka Revisi DRA+PTV + Separator Paragraf (\\n)',
      description:
        'Menggunakan pembuka hasil revisi kohesi wacana (tanpa signpost presenter) dengan pemisah baris standar.',
      p1Ending,
      p2Opening: p2OpeningRevised,
      separatorUsed: '\\n',
      combinedPreview: `${p1Ending}\n${p2OpeningRevised}`,
      prosodyContinuityNotes: {
        loudnessRisk: 'Rendah',
        pitchResetRisk: 'Sedang',
        timbreNotes:
          'Menghindari nada pengumuman presenter di awal paragraf sambil mempertahankan jeda wacana.',
        speedNotes: 'Transisi ritme terkendali dengan jeda paragraf yang wajar.',
      },
    },
    {
      variant: 'D',
      label: 'Varian D — Pembuka Revisi DRA+PTV Tanpa Jeda Paragraf',
      description:
        'Kombinasi pembuka kohesif DRA+PTV dan penyatuan aliran teks tanpa newline untuk uji kontinuitas prosodi maksimum.',
      p1Ending,
      p2Opening: p2OpeningRevised,
      separatorUsed: ' (spasi)',
      combinedPreview: `${p1Ending} ${p2OpeningRevised}`,
      prosodyContinuityNotes: {
        loudnessRisk: 'Rendah',
        pitchResetRisk: 'Rendah',
        timbreNotes:
          'Paling minim risiko reset intonasi; tetap wajib ditinjau telinga pada voice ID target.',
        speedNotes: 'Kecepatan bicara konsisten dari akhir P1 menuju awal P2.',
      },
    },
  ];
}

/**
 * Generator Deterministik Berbasis Fakta & Konteks (Digunakan sebagai baseline seed / fallback terverifikasi)
 * Menghasilkan tepat n blok SCTF yang memenuhi seluruh aturan V5.1:
 * - 5 tahap StoryFlow [8%, 17%, 45%, 20%, 10%]
 * - Gue–lo ngomel kritis & kontekstual
 * - 3–5 makian terintegrasi per blok (tersebar di kalimat berbeda, tanpa makian tempelan)
 * - Kosakata informal kontekstual dari bank F1–F8
 * - EYD V (SAP) dan transisi DRA+PTV tanpa signpost metapresenter
/**
 * GENERATOR DETERMINISTIK TELAH DIHAPUS SECARA FISIK.
 * Seluruh substansi narasi wajib bersumber dari data Supabase dan proses generasi AI.
 * Tidak ada satu pun kalimat template yang disisipkan oleh backend.
 */
export function generateDeterministicSCTFScript(
  _rawConfig: Partial<GenNASConfig> = {}
): string {
  throw new Error(
    'generateDeterministicSCTFScript telah dihapus: Seluruh narasi wajib bersumber dari database Supabase.'
  );
}

// ============================================================================
// BLOCK-LEVEL POST-PRODUCTION ENGINE — PERDALAM & TRANSISI PER BLOK (TERISOLASI)
// ============================================================================

const STIFF_FORMAL_CONNECTOR_PREFIX_REGEX =
  /^(?:selanjutnya|di\s+sisi\s+lain|dengan\s+demikian|oleh\s+karena\s+itu|kesimpulannya\s+adalah|berikutnya|pertama-tama|sebagai\s+tambahan|lebih\s+lanjut\s+lagi|dapat\s+disimpulkan\s+bahwa)\s*,?\s*/i;

function extractKeyContentWordFromBlock(blockText: string, fallback: string = 'persoalan'): string {
  const stopWords = new Set([
    'yang', 'dari', 'dalam', 'dengan', 'untuk', 'pada', 'akan', 'bisa', 'atau',
    'tapi', 'karena', 'kalau', 'saat', 'waktu', 'buat', 'sama', 'udah', 'sudah',
    'belum', 'tidak', 'bukan', 'nggak', 'enggak', 'lebih', 'paling', 'sangat',
    'cukup', 'masih', 'harus', 'selalu', 'sering', 'selama', 'tanpa', 'secara',
    'antara', 'mereka', 'kita', 'kamu', 'anda', 'saya', 'begitu', 'seperti',
    'ketika', 'padahal', 'soalnya', 'makanya', 'ujung', 'ujungnya', 'coba',
    'lihat', 'ngeliat', 'ngelihat', 'pikirin', 'mikirin', 'banget', 'kayak',
  ]);
  const profSet = new Set(PROFANITY_ROOT_WORDS.map((w) => w.toLowerCase()));
  const words = countWordsConsistent(blockText)
    .map((w) => w.toLowerCase().replace(/[^a-z0-9]/gi, ''))
    .filter((w) => w.length >= 5 && !stopWords.has(w) && !profSet.has(w));
  return words[0] || fallback;
}

/**
 * Penegakan aturan V5.1 yang diisolasi HANYA untuk 1 blok tunggal (`blockIndex`).
 * Menjamin:
 * - Gaya bahasa gue-lo (tanpa saya/Anda di luar kutipan)
 * - 3–5 makian terintegrasi Non-SARA yang tersebar di kalimat berbeda
 * - Minimal 2 penanda percakapan & 1 verba informal
 * - Bebas tanda petik ganda (SQNN Quote-Free)
 * - F7 Contextual Guard
 * - Seluruh token terproteksi (angka, Rp, %, tahun) dari `originalBlockText` tetap utuh 100%
 * - Format 1 baris SCTF bersih
 */
export function applySingleBlockEnforce(
  blockText: string,
  blockIndex: number,
  config: Partial<GenNASConfig> = {},
  originalBlockText?: string
): string {
  const locked = enforceLockedConfig(config);

  // 1. Normalisasi baris menjadi 1 blok tunggal
  let workingBlock = blockText
    .replace(/\r\n/g, ' ')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!workingBlock && originalBlockText) {
    workingBlock = originalBlockText.replace(/\r\n/g, ' ').replace(/\n+/g, ' ').trim();
  }

  // 2. F7 Contextual Guard pada blok ini
  workingBlock = runF7PostGenerationAuditAndRevision({
    script: workingBlock,
    topic: locked.topik || '',
    outline: locked.faktaTerverifikasi || '',
  }).revisedScript;

  // 3. SQNN Quote-Free pada blok ini
  if (DOUBLE_QUOTE_CHARS_REGEX.test(workingBlock)) {
    workingBlock = applySQNN(workingBlock, locked).normalizedScript;
  }

  // 4. Masking Protected Tokens sebelum sanitasi tekstual
  const prot = extractProtectedTokens(workingBlock);
  let masked = prot.maskedText;

  // Bersihkan audio tags
  masked = masked.replace(
    /\s*\[(?:shouts|sighs|laughs|whispers|pause|clears throat|gasp)\]\s*|\s*<break[^>]*>\s*/gi,
    ' '
  );

  // Konversi saya/Anda -> gue/lo
  masked = masked
    .replace(/\bSaya\b/g, 'Gue')
    .replace(/\bsaya\b/g, 'gue')
    .replace(/\bAnda\b/g, 'lo')
    .replace(/\banda\b/g, 'lo');

  // Turunkan huruf kapital penuh pada kata kasar
  masked = masked.replace(
    /\b(GOBLOK|TOLOL|BEGO|BODOH|DUNGU|IDIOT|KAMPUNGAN|SINTING)\b/g,
    (m) => m.toLowerCase()
  );

  // Bersihkan kebocoran label internal framework
  masked = masked
    .replace(/\bmaster\s+framework\b/gi, 'pembahasan ini')
    .replace(/\bperencanaan\s+naskah\s*(?:youtube)?\s*presisi\b/gi, 'alur pembahasan')
    .replace(/\bdokumen\s+kerangka\s*(?:kerja)?\b/gi, 'kerangka masalah')
    .replace(
      /\bperilaku\s*(?:&|dan)\s*pola\s*pikir\s*masyarakat\s*\(non-sara\)\b/gi,
      'pola pikir dan cara bernalar yang keliru di masyarakat'
    )
    .replace(/\bnon[_\s-]sara[_\s-]hard[_\s-]guard\b/gi, 'batasan nalar kritis')
    .replace(
      /\b(?:blok\s*\d+|tahap\s*\d+|hook\s*\(|akar\s+masalah\s*\(|inti\s+masalah\s*\(|penyelesaian\s*\(|kesimpulan\s*\()\s*[:=]/gi,
      ''
    );

  let unmasked = restoreProtectedTokens(masked, prot);

  // 5. Bersihkan signpost metapresenter di awal kalimat pembuka blok (untuk blok > 0)
  if (blockIndex > 0) {
    for (const signpost of RISKY_META_PRESENTER_SIGNPOSTS) {
      const rx = new RegExp(
        `^(?:${signpost.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?:\\s+buat\\s+[^,.]+|\\s*,)?\\s*`,
        'i'
      );
      if (rx.test(unmasked)) {
        unmasked = unmasked.replace(rx, '').trim();
        if (unmasked.length > 0) {
          unmasked = unmasked.charAt(0).toUpperCase() + unmasked.slice(1);
        }
      }
    }
  }

  // 6. Filter kalimat makian mandiri & reframe pelanggaran Non-SARA
  let sentences = splitIntoSentences(unmasked)
    .filter(
      (s) =>
        !FORBIDDEN_STANDALONE_PROFANITY_PATTERNS.some((rx) => rx.test(s.trim()))
    )
    .map((s) => {
      const targetCheck = inspectCritiqueTargetViolations(s);
      if (targetCheck.hasForbiddenTarget && targetCheck.reframedSentence) {
        return targetCheck.reframedSentence;
      }
      const nonSaraCheck = inspectNonSaraSemanticViolations(s);
      if (nonSaraCheck.hasForbiddenTarget && nonSaraCheck.reframedSentence) {
        return nonSaraCheck.reframedSentence;
      }
      return s;
    });

  // 7. Pastikan seluruh token terproteksi (angka/Rp/%/tahun) dari originalBlockText tetap utuh
  if (originalBlockText) {
    const origProtected = extractProtectedTokens(originalBlockText).tokens;
    const currentTextCheck = sentences.join(' ');
    const missingTokens = origProtected.filter((tok) => !currentTextCheck.includes(tok));
    if (missingTokens.length > 0) {
      const origSentences = splitIntoSentences(originalBlockText);
      missingTokens.forEach((tok) => {
        if (!sentences.join(' ').includes(tok)) {
          const matchingOrigSent = origSentences.find((os) => os.includes(tok));
          if (matchingOrigSent) {
            const cleanOrig = applySQNN(matchingOrigSent, locked).normalizedScript;
            if (sentences.length >= 2) {
              sentences.splice(sentences.length - 1, 0, cleanOrig);
            } else {
              sentences.push(cleanOrig);
            }
          }
        }
      });
    }
  }

  // 8. Kendalikan kuota 4–5 makian terintegrasi per blok (Aturan H1–H8)
  // Normalisasi makian ganda dalam 1 kalimat
  sentences = sentences.map((sent) => {
    let foundInSent = 0;
    return sent.replace(
      /\b(tolol|goblok|bego|bodoh|dungu|idiot|kampungan|sinting|gila)\b/gi,
      (match: string) => {
        foundInSent += 1;
        return foundInSent > 1 ? 'keliru' : match.toLowerCase();
      }
    );
  });

  let currentJoined = sentences.join(' ');
  let profCheck = analyzeBlockProfanity(currentJoined, blockIndex);

  // Jika melebihi kuota 5 makian, netralkan kelebihan
  if (profCheck.validCount > 5) {
    const excessEvents = profCheck.events.filter((e) => e.valid).slice(5);
    excessEvents.forEach((ev) => {
      currentJoined = currentJoined.replace(
        ev.text,
        ev.text.replace(
          /\b(tolol|goblok|bego|bodoh|dungu|idiot|kampungan|sinting|gila)\b/i,
          'keliru'
        )
      );
    });
    sentences = splitIntoSentences(currentJoined);
    profCheck = analyzeBlockProfanity(currentJoined, blockIndex);
  }

  // Jika kurang dari kuota 4, lakukan kualifikasi target kritik pada kata yang SUDAH ada dalam kalimat naskah asli
  // Dilarang menyisipkan kalimat template!
  if (profCheck.validCount < 4) {
    let needed = 4 - profCheck.validCount;
    for (let sIdx = 0; sIdx < sentences.length && needed > 0; sIdx++) {
      const hasProf = PROFANITY_ROOT_WORDS.some((w) =>
        new RegExp(`\\b${w}\\b`, 'i').test(sentences[sIdx])
      );
      if (!hasProf) {
        let sent = sentences[sIdx];
        if (/\basumsi\b/i.test(sent) && !/\basumsi bodoh\b/i.test(sent)) {
          sentences[sIdx] = sent.replace(/\basumsi\b/i, 'asumsi bodoh');
          needed -= 1;
        } else if (/\bargumen\b/i.test(sent) && !/\bargumen dungu\b/i.test(sent)) {
          sentences[sIdx] = sent.replace(/\bargumen\b/i, 'argumen dungu');
          needed -= 1;
        } else if (/\bkeputusan\b/i.test(sent) && !/\bkeputusan bego\b/i.test(sent)) {
          sentences[sIdx] = sent.replace(/\bkeputusan\b/i, 'keputusan bego');
          needed -= 1;
        } else if (/\banggapan\b/i.test(sent) && !/\banggapan tolol\b/i.test(sent)) {
          sentences[sIdx] = sent.replace(/\banggapan\b/i, 'anggapan tolol');
          needed -= 1;
        } else if (/\blogika\b/i.test(sent) && !/\blogika goblok\b/i.test(sent)) {
          sentences[sIdx] = sent.replace(/\blogika\b/i, 'logika goblok');
          needed -= 1;
        } else if (/\bkebiasaan\b/i.test(sent) && !/\bkebiasaan konyol\b/i.test(sent)) {
          sentences[sIdx] = sent.replace(/\bkebiasaan\b/i, 'kebiasaan konyol');
          needed -= 1;
        }
      }
    }
  }

  // 9. Pastikan gaya bahasa santai/percakapan
  let rejoined = sentences.join(' ');

  // 10. Revisi koma SAP, SQNN final, dan filter anti-kebocoran referensi/DOI/URL pada blok tunggal
  const commaCleaned = applyRevisiKoma(rejoined);
  const sqnnCleaned = DOUBLE_QUOTE_CHARS_REGEX.test(commaCleaned)
    ? applySQNN(commaCleaned, locked).normalizedScript
    : commaCleaned;
  const referenceSanitizedBlock = sanitizeNarrativeFromReferenceLeakage(sqnnCleaned);

  return referenceSanitizedBlock.replace(/\r\n/g, ' ').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Fungsi Pascaproduksi Blok: PERDALAM (Deterministik & Kontekstual)
 * - Hanya memperdalam blok yang dipilih (`blockIndex` 0..4).
 * - Keempat blok lainnya dijamin 100% TIDAK BERUBAH.
 * - Tidak menjalankan ulang Workflow Engine Tahap 1–8.
 */
export function applyBlockPerdalamDeterministic(
  rawScript: string,
  blockIndex: number,
  config: Partial<GenNASConfig> = {}
): {
  updatedScript: string;
  updatedBlock: string;
  blocks: string[];
  metadata: BlockPostProductionMetadata;
} {
  const locked = enforceLockedConfig(config);
  const jumlahBlok = locked.jumlahBlok || 5;
  const sctf = parseAndValidateSCTF(rawScript, jumlahBlok);
  const blocks = [...sctf.blocks];
  while (blocks.length < jumlahBlok) {
    blocks.push('');
  }
  const originalBlocks = [...blocks];

  const safeIdx = Math.max(0, Math.min(jumlahBlok - 1, blockIndex));
  const originalBlock = originalBlocks[safeIdx] || '';

  const stagePlan = calculateStageTargets(
    locked.durasiMenit,
    locked.wpm,
    locked.struktur,
    jumlahBlok
  );
  const stageMeta = stagePlan.stages[safeIdx] || {
    id: safeIdx + 1,
    name: `Blok ${safeIdx + 1}`,
    weightPercent: 20,
    targetWords: 300,
    description: '',
  };

  const wordsBefore = countWordsConsistent(originalBlock).length;
  const totalWordsBefore = originalBlocks.reduce(
    (sum, b) => sum + countWordsConsistent(b).length,
    0
  );
  const actualWeightPercentBefore =
    totalWordsBefore > 0
      ? Number(((wordsBefore / totalWordsBefore) * 100).toFixed(1))
      : 0;

  // Mode lokal deterministik: Perapian struktur dan penegakan aturan tanpa menyisipkan kalimat template baru.
  // Seluruh penambahan narasi baru wajib melalui AI dengan konteks data Supabase.
  const enforcedBlock = applySingleBlockEnforce(
    originalBlock,
    safeIdx,
    locked,
    originalBlock
  );

  blocks[safeIdx] = enforcedBlock;

  // Jaminan mutlak: blok selain safeIdx 100% tidak berubah
  for (let i = 0; i < jumlahBlok; i++) {
    if (i !== safeIdx) {
      blocks[i] = originalBlocks[i];
    }
  }

  const updatedScript = formatBlocksToSCTF(blocks);
  const wordsAfter = countWordsConsistent(enforcedBlock).length;
  const totalWordsAfter = blocks.reduce(
    (sum, b) => sum + countWordsConsistent(b).length,
    0
  );
  const actualWeightPercentAfter =
    totalWordsAfter > 0
      ? Number(((wordsAfter / totalWordsAfter) * 100).toFixed(1))
      : 0;

  const origProtected = extractProtectedTokens(originalBlock).tokens;
  const protectedTokensIntact = origProtected.every((tok) =>
    enforcedBlock.includes(tok)
  );
  const nonTargetBlocksUnchanged = blocks.every(
    (b, idx) => idx === safeIdx || b === originalBlocks[idx]
  );

  const fullAudit = validateFullScript(updatedScript, locked);
  const blockAudit = fullAudit.stages[safeIdx];
  const validationPassed = Boolean(
    blockAudit?.passed &&
      fullAudit.nonSaraPassed &&
      fullAudit.quoteFree?.passed &&
      protectedTokensIntact &&
      nonTargetBlocksUnchanged
  );

  const wordDelta = wordsAfter - wordsBefore;
  const targetMet = wordsAfter >= Math.round(stageMeta.targetWords * 0.85);

  const metadata: BlockPostProductionMetadata = {
    blockIndex: safeIdx,
    blockId: safeIdx + 1,
    stageName: stageMeta.name,
    operation: 'PERDALAM',
    wordsBefore,
    wordsAfter,
    wordDelta,
    targetWords: stageMeta.targetWords,
    targetWeightPercent: stageMeta.weightPercent,
    actualWeightPercentBefore,
    actualWeightPercentAfter,
    targetMet,
    factsPreserved: protectedTokensIntact,
    protectedTokensChecked: origProtected,
    protectedTokensIntact,
    validationPassed,
    nonTargetBlocksUnchanged,
    workflowStagesUntouched: true,
    timestamp: Date.now(),
    summary: `Blok ${safeIdx + 1} (${stageMeta.name}) diperdalam & dirapikan: ${wordsBefore} → ${wordsAfter} kata. 4 blok lainnya tetap utuh.`,
  };

  return {
    updatedScript,
    updatedBlock: enforcedBlock,
    blocks,
    metadata,
  };
}

/**
 * Fungsi Pascaproduksi Blok: TRANSISI (Deterministik & Kontekstual)
 * - Hanya membersihkan penanda presenter kaku pada blok yang dipilih (`blockIndex` 0..4)
 *   tanpa menyisipkan kalimat template yang telah disiapkan sebelumnya.
 * - Keempat blok lainnya dijamin 100% TIDAK BERUBAH.
 * - Tidak menjalankan ulang Workflow Engine Tahap 1–8.
 */
export function applyBlockTransisiDeterministic(
  rawScript: string,
  blockIndex: number,
  config: Partial<GenNASConfig> = {}
): {
  updatedScript: string;
  updatedBlock: string;
  blocks: string[];
  metadata: BlockPostProductionMetadata;
} {
  const locked = enforceLockedConfig(config);
  const jumlahBlok = locked.jumlahBlok || 5;
  const sctf = parseAndValidateSCTF(rawScript, jumlahBlok);
  const blocks = [...sctf.blocks];
  while (blocks.length < jumlahBlok) {
    blocks.push('');
  }
  const originalBlocks = [...blocks];

  const safeIdx = Math.max(0, Math.min(jumlahBlok - 1, blockIndex));
  const originalBlock = originalBlocks[safeIdx] || '';

  const stagePlan = calculateStageTargets(
    locked.durasiMenit,
    locked.wpm,
    locked.struktur,
    jumlahBlok
  );
  const stageMeta = stagePlan.stages[safeIdx] || {
    id: safeIdx + 1,
    name: `Blok ${safeIdx + 1}`,
    weightPercent: 20,
    targetWords: 300,
    description: '',
  };

  const wordsBefore = countWordsConsistent(originalBlock).length;
  const totalWordsBefore = originalBlocks.reduce(
    (sum, b) => sum + countWordsConsistent(b).length,
    0
  );
  const actualWeightPercentBefore =
    totalWordsBefore > 0
      ? Number(((wordsBefore / totalWordsBefore) * 100).toFixed(1))
      : 0;

  let sentences = splitIntoSentences(originalBlock).map((s) =>
    s.replace(STIFF_FORMAL_CONNECTOR_PREFIX_REGEX, '').trim()
  );
  if (sentences.length === 0 && originalBlock.trim()) {
    sentences = [originalBlock.trim()];
  }

  // Membersihkan signpost metapresenter pada kalimat pembuka secara langsung tanpa template
  if (sentences.length > 0) {
    let first = sentences[0];
    for (const signpost of RISKY_META_PRESENTER_SIGNPOSTS) {
      const rx = new RegExp(
        `^(?:${signpost.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?:\\s+buat\\s+[^,.]+|\\s*,)?\\s*`,
        'i'
      );
      if (rx.test(first)) {
        first = first.replace(rx, '').trim();
      }
    }
    if (first.length > 0) {
      sentences[0] = first.charAt(0).toUpperCase() + first.slice(1);
    }
  }

  const candidateBlock = sentences.join(' ');
  const enforcedBlock = applySingleBlockEnforce(
    candidateBlock,
    safeIdx,
    locked,
    originalBlock
  );

  blocks[safeIdx] = enforcedBlock;

  // Jaminan mutlak: blok selain safeIdx 100% tidak berubah
  for (let i = 0; i < jumlahBlok; i++) {
    if (i !== safeIdx) {
      blocks[i] = originalBlocks[i];
    }
  }

  const updatedScript = formatBlocksToSCTF(blocks);
  const wordsAfter = countWordsConsistent(enforcedBlock).length;
  const totalWordsAfter = blocks.reduce(
    (sum, b) => sum + countWordsConsistent(b).length,
    0
  );
  const actualWeightPercentAfter =
    totalWordsAfter > 0
      ? Number(((wordsAfter / totalWordsAfter) * 100).toFixed(1))
      : 0;

  const origProtected = extractProtectedTokens(originalBlock).tokens;
  const protectedTokensIntact = origProtected.every((tok) =>
    enforcedBlock.includes(tok)
  );
  const nonTargetBlocksUnchanged = blocks.every(
    (b, idx) => idx === safeIdx || b === originalBlocks[idx]
  );

  const fullAudit = validateFullScript(updatedScript, locked);
  const blockAudit = fullAudit.stages[safeIdx];

  // Cek apakah transisi yang berkaitan dengan blok ini lulus DRA+PTV
  const relatedTransitions = fullAudit.transitions.filter(
    (t) => t.fromBlock === safeIdx + 1 || t.toBlock === safeIdx + 1
  );
  const transitionsPassed = relatedTransitions.every((t) => t.passed);

  const validationPassed = Boolean(
    blockAudit?.passed &&
      transitionsPassed &&
      fullAudit.nonSaraPassed &&
      fullAudit.quoteFree?.passed &&
      protectedTokensIntact &&
      nonTargetBlocksUnchanged
  );

  const wordDelta = wordsAfter - wordsBefore;
  const targetMet = wordsAfter >= Math.round(stageMeta.targetWords * 0.85);

  const transitionPartsUpdated = `Pembersihan Signpost Metapresenter Blok ${safeIdx + 1}`;
  const origSents = splitIntoSentences(originalBlock);
  const updatedSentsFinal = splitIntoSentences(enforcedBlock);
  const openingBefore = origSents[0] || '';
  const openingAfter = updatedSentsFinal[0] || '';
  const closingBefore = origSents[origSents.length - 1] || '';
  const closingAfter = updatedSentsFinal[updatedSentsFinal.length - 1] || '';

  const metadata: BlockPostProductionMetadata = {
    blockIndex: safeIdx,
    blockId: safeIdx + 1,
    stageName: stageMeta.name,
    operation: 'TRANSISI',
    wordsBefore,
    wordsAfter,
    wordDelta,
    targetWords: stageMeta.targetWords,
    targetWeightPercent: stageMeta.weightPercent,
    actualWeightPercentBefore,
    actualWeightPercentAfter,
    targetMet,
    transitionPartsUpdated,
    openingBefore,
    openingAfter,
    closingBefore,
    closingAfter,
    factsPreserved: protectedTokensIntact,
    protectedTokensChecked: origProtected,
    protectedTokensIntact,
    validationPassed,
    nonTargetBlocksUnchanged,
    workflowStagesUntouched: true,
    timestamp: Date.now(),
    summary: `Transisi Blok ${safeIdx + 1} (${stageMeta.name}) diperhalus [${transitionPartsUpdated}]: ${wordsBefore} → ${wordsAfter} kata. Fakta & 4 blok lainnya tetap utuh.`,
  };

  return {
    updatedScript,
    updatedBlock: enforcedBlock,
    blocks,
    metadata,
  };
}

/**
 * Mengintegrasikan hasil LLM untuk 1 blok tunggal (PERDALAM / TRANSISI) dengan
 * pengaman deterministik sehingga:
 * 1. Hanya blok target (`blockIndex`) yang berubah; 4 blok lainnya dijamin identik.
 * 2. Jika output LLM gagal menjaga fakta/token terproteksi atau gagal validasi, fallback ke engine deterministik per blok.
 */
export function finalizeBlockPostProductionLLMOutput(params: {
  rawScript: string;
  candidateBlockFromLLM: string;
  blockIndex: number;
  operation: BlockPostProductionOperation;
  config: Partial<GenNASConfig>;
  modelUsed?: string;
}): {
  updatedScript: string;
  updatedBlock: string;
  blocks: string[];
  metadata: BlockPostProductionMetadata;
} {
  const {
    rawScript,
    candidateBlockFromLLM,
    blockIndex,
    operation,
    config,
    modelUsed,
  } = params;

  const locked = enforceLockedConfig(config);
  const jumlahBlok = locked.jumlahBlok || 5;
  const sctf = parseAndValidateSCTF(rawScript, jumlahBlok);
  const originalBlocks = [...sctf.blocks];
  while (originalBlocks.length < jumlahBlok) {
    originalBlocks.push('');
  }

  const safeIdx = Math.max(0, Math.min(jumlahBlok - 1, blockIndex));
  const originalBlock = originalBlocks[safeIdx] || '';

  const cleanedCandidate = (candidateBlockFromLLM || '')
    .replace(/\r\n/g, ' ')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Jika output LLM kosong atau terlalu pendek, gunakan deterministic block engine
  if (
    !cleanedCandidate ||
    countWordsConsistent(cleanedCandidate).length <
      Math.max(20, Math.floor(countWordsConsistent(originalBlock).length * 0.75))
  ) {
    const fallbackRes =
      operation === 'PERDALAM'
        ? applyBlockPerdalamDeterministic(rawScript, safeIdx, locked)
        : applyBlockTransisiDeterministic(rawScript, safeIdx, locked);
    fallbackRes.metadata.modelUsed = modelUsed;
    return fallbackRes;
  }

  const enforcedBlock = applySingleBlockEnforce(
    cleanedCandidate,
    safeIdx,
    locked,
    originalBlock
  );

  // Untuk operasi PERDALAM, pastikan jumlah kata benar-benar bertambah dibanding kondisi awal
  const wordsBefore = countWordsConsistent(originalBlock).length;
  const wordsCandidate = countWordsConsistent(enforcedBlock).length;
  if (operation === 'PERDALAM' && wordsCandidate <= wordsBefore) {
    const fallbackRes = applyBlockPerdalamDeterministic(
      rawScript,
      safeIdx,
      locked
    );
    fallbackRes.metadata.modelUsed = modelUsed;
    return fallbackRes;
  }

  const blocks = [...originalBlocks];
  blocks[safeIdx] = enforcedBlock;

  // Jaminan mutlak: 4 blok lainnya tidak berubah
  for (let i = 0; i < jumlahBlok; i++) {
    if (i !== safeIdx) {
      blocks[i] = originalBlocks[i];
    }
  }

  const updatedScript = formatBlocksToSCTF(blocks);
  const fullAudit = validateFullScript(updatedScript, locked);
  const blockAudit = fullAudit.stages[safeIdx];

  const origProtected = extractProtectedTokens(originalBlock).tokens;
  const protectedTokensIntact = origProtected.every((tok) =>
    enforcedBlock.includes(tok)
  );
  const relatedTransitions = fullAudit.transitions.filter(
    (t) => t.fromBlock === safeIdx + 1 || t.toBlock === safeIdx + 1
  );
  const transitionsPassed = relatedTransitions.every((t) => t.passed);

  if (
    !blockAudit?.passed ||
    !fullAudit.nonSaraPassed ||
    !fullAudit.quoteFree?.passed ||
    !protectedTokensIntact ||
    !transitionsPassed
  ) {
    const fallbackRes =
      operation === 'PERDALAM'
        ? applyBlockPerdalamDeterministic(rawScript, safeIdx, locked)
        : applyBlockTransisiDeterministic(rawScript, safeIdx, locked);
    fallbackRes.metadata.modelUsed = modelUsed;
    return fallbackRes;
  }

  const stagePlan = calculateStageTargets(
    locked.durasiMenit,
    locked.wpm,
    locked.struktur,
    jumlahBlok
  );
  const stageMeta = stagePlan.stages[safeIdx] || {
    id: safeIdx + 1,
    name: `Blok ${safeIdx + 1}`,
    weightPercent: 20,
    targetWords: 300,
    description: '',
  };

  const totalWordsBefore = originalBlocks.reduce(
    (sum, b) => sum + countWordsConsistent(b).length,
    0
  );
  const totalWordsAfter = blocks.reduce(
    (sum, b) => sum + countWordsConsistent(b).length,
    0
  );
  const actualWeightPercentBefore =
    totalWordsBefore > 0
      ? Number(((wordsBefore / totalWordsBefore) * 100).toFixed(1))
      : 0;
  const actualWeightPercentAfter =
    totalWordsAfter > 0
      ? Number(((wordsCandidate / totalWordsAfter) * 100).toFixed(1))
      : 0;

  const origSents = splitIntoSentences(originalBlock);
  const newSents = splitIntoSentences(enforcedBlock);

  const transitionPartsMap: Record<number, string> = {
    0: 'Penutup Blok 1 (Hook) → Pembuka Blok 2 (Akar Masalah)',
    1: 'Pembuka ← Blok 1 (Hook) & Penutup → Blok 3 (Inti Masalah)',
    2: 'Pembuka ← Blok 2 (Akar Masalah) & Penutup → Blok 4 (Penyelesaian)',
    3: 'Pembuka ← Blok 3 (Inti Masalah) & Penutup → Blok 5 (Kesimpulan)',
    4: 'Pembuka ← Blok 4 (Penyelesaian) & Penguatan Penutup Final',
  };

  const wordDelta = wordsCandidate - wordsBefore;
  const targetMet = wordsCandidate >= Math.round(stageMeta.targetWords * 0.85);

  const metadata: BlockPostProductionMetadata = {
    blockIndex: safeIdx,
    blockId: safeIdx + 1,
    stageName: stageMeta.name,
    operation,
    wordsBefore,
    wordsAfter: wordsCandidate,
    wordDelta,
    targetWords: stageMeta.targetWords,
    targetWeightPercent: stageMeta.weightPercent,
    actualWeightPercentBefore,
    actualWeightPercentAfter,
    targetMet,
    transitionPartsUpdated:
      operation === 'TRANSISI' ? transitionPartsMap[safeIdx] : undefined,
    openingBefore: origSents[0] || '',
    openingAfter: newSents[0] || '',
    closingBefore: origSents[origSents.length - 1] || '',
    closingAfter: newSents[newSents.length - 1] || '',
    factsPreserved: protectedTokensIntact,
    protectedTokensChecked: origProtected,
    protectedTokensIntact,
    validationPassed: true,
    nonTargetBlocksUnchanged: true,
    workflowStagesUntouched: true,
    modelUsed,
    timestamp: Date.now(),
    summary:
      operation === 'PERDALAM'
        ? `Blok ${safeIdx + 1} (${stageMeta.name}) diperdalam: ${wordsBefore} → ${wordsCandidate} kata (${wordDelta >= 0 ? `+${wordDelta}` : wordDelta} kata, target ${stageMeta.targetWords} kata). 4 blok lainnya tetap utuh.`
        : `Transisi Blok ${safeIdx + 1} (${stageMeta.name}) diperhalus [${transitionPartsMap[safeIdx]}]: ${wordsBefore} → ${wordsCandidate} kata. Fakta & 4 blok lainnya tetap utuh.`,
  };

  return {
    updatedScript,
    updatedBlock: enforcedBlock,
    blocks,
    metadata,
  };
}

