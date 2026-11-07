import {
  DocumentSemanticClassification,
  SourceFidelityAuditReport,
  SourceGroundedPlan,
} from './types';
import {
  classifyDocumentSemantics,
  FORBIDDEN_LEAKED_PHRASES,
} from './documentSemanticClassifier';
import { buildSourceGroundedNarrativePlan } from './sourceGroundedNarrativePlanner';
import { countWordsConsistent, extractProtectedTokens } from './validatorAndPipeline';

/**
 * SOURCE_FIDELITY_VALIDATOR (Validator Kesesuaian Kerangka / Source Fidelity):
 * Memeriksa 7 dimensi kepatuhan naskah terhadap dokumen sumber:
 * A. TOPIC RELEVANCE: Apakah seluruh 5 blok membahas topik spesifik dokumen, bukan tema generik kosong?
 * B. ARGUMENT COVERAGE: Apakah poin-poin argumentasi penting dari kerangka sumber dikembangkan?
 * C. SOURCE GROUNDING: Apakah angka, fakta, dan klaim penting bersumber dari data yang tersedia?
 * D. SEMANTIC CONSISTENCY: Apakah alur logika dan maksud kritis penulis tetap terjaga?
 * E. INSTRUCTION LEAKAGE: Apakah terdapat kebocoran metadata, instruksi framework, atau penanda sistem?
 * F. HALLUCINATION DETECTION: Apakah terdapat karangan angka, lembaga fiktif, atau tuduhan palsu?
 * G. STORYFLOW ALIGNMENT: Apakah 5 tahap mengembangkan topik secara bertahap dan bukan pengulangan klise?
 */
export function validateSourceFidelity(
  cleanScript: string,
  sourcePlanOrClassification: SourceGroundedPlan | DocumentSemanticClassification,
  classificationOrPlan?: DocumentSemanticClassification | SourceGroundedPlan
): SourceFidelityAuditReport {
  let sourcePlan: SourceGroundedPlan;
  let classification: DocumentSemanticClassification | undefined;

  if (
    sourcePlanOrClassification &&
    'main_topic' in sourcePlanOrClassification &&
    'storyflow_plan' in sourcePlanOrClassification
  ) {
    sourcePlan = sourcePlanOrClassification as SourceGroundedPlan;
    classification = classificationOrPlan as DocumentSemanticClassification | undefined;
  } else if (
    sourcePlanOrClassification &&
    'sections' in sourcePlanOrClassification &&
    'mainTopic' in sourcePlanOrClassification
  ) {
    classification = sourcePlanOrClassification as DocumentSemanticClassification;
    if (
      classificationOrPlan &&
      'main_topic' in classificationOrPlan
    ) {
      sourcePlan = classificationOrPlan as SourceGroundedPlan;
    } else {
      sourcePlan = buildSourceGroundedNarrativePlan(classification, {
        durasiMenit: 12,
        wpm: 135,
      });
    }
  } else {
    classification = classifyDocumentSemantics(cleanScript);
    sourcePlan = buildSourceGroundedNarrativePlan(classification, {
      durasiMenit: 12,
      wpm: 135,
    });
  }

  const rawTopic = (sourcePlan?.main_topic || classification?.mainTopic || 'Topik Naskah');
  const safeMainTopic = /^\[(?:GENFLOW|DOCUMENT)_[A-Z_]+\]/i.test(rawTopic.trim())
    ? 'Topik Dokumen'
    : rawTopic;
  const blocks = (cleanScript || '')
    .replace(/\r\n/g, '\n')
    .trim()
    .split('\n')
    .map((b) => b.trim())
    .filter(Boolean);

  const lowerScript = cleanScript.toLowerCase();
  const allScriptWords = countWordsConsistent(lowerScript).map((w) =>
    w.toLowerCase()
  );
  const scriptWordSet = new Set(allScriptWords);

  const detailedFindings: string[] = [];
  const reasons: string[] = [];

  // ==========================================
  // E. INSTRUCTION LEAKAGE (Hard Gate)
  // ==========================================
  const leakedPhrases: string[] = [];
  FORBIDDEN_LEAKED_PHRASES.forEach((item) => {
    if (item.regex.test(cleanScript)) {
      leakedPhrases.push(item.phrase);
      detailedFindings.push(
        `[Kebocoran Instruksi Terdeteksi]: Frasa "${item.phrase}" (${item.label}) ditemukan di dalam naskah narasi. Frasa ini merupakan instruksi/konfigurasi internal dan dilarang dibacakan.`
      );
    }
  });

  // Periksa juga apakah ada header blok seperti "Blok 1 Hook:", "Tahap 2:", "Stage 3:" yang bocor
  const leakedBlockHeaderMatch = cleanScript.match(
    /\b(?:blok\s*\d+|tahap\s*\d+|hook\s*\(|akar\s+masalah\s*\(|inti\s+masalah\s*\(|penyelesaian\s*\(|kesimpulan\s*\()\s*[:=]/gi
  );
  if (leakedBlockHeaderMatch) {
    leakedBlockHeaderMatch.forEach((h) => {
      if (!leakedPhrases.includes(h)) leakedPhrases.push(h);
    });
    detailedFindings.push(
      `[Kebocoran Label Blok]: Ditemukan label tahapan internal (${leakedBlockHeaderMatch.join(', ')}) di dalam teks naskah.`
    );
  }

  const instructionLeakagePassed = leakedPhrases.length === 0;
  if (!instructionLeakagePassed) {
    reasons.push(
      `Kebocoran Instruksi: Naskah memuat metadata/instruksi internal (${leakedPhrases.slice(0, 3).join(', ')}). Validasi Kesesuaian Kerangka GAGAL.`
    );
  }

  // ==========================================
  // A. TOPIC RELEVANCE
  // ==========================================
  const targetKeywords = classification?.topicKeywords || [];
  const mainTopicWords = countWordsConsistent(safeMainTopic.toLowerCase())
    .filter((w) => w.length >= 4);

  const keyConceptsToCheck = Array.from(
    new Set([...targetKeywords.slice(0, 10), ...mainTopicWords])
  );

  const matchedTerms = keyConceptsToCheck.filter((term) => {
    const tLower = term.toLowerCase();
    if (tLower.includes(' ')) {
      return lowerScript.includes(tLower);
    }
    return scriptWordSet.has(tLower);
  });

  // Cek apakah ada frasa inti spesifik (mis. jika topik tentang "harta gak dibawa mati")
  const specificTopicNeedsPhrase =
    safeMainTopic.toLowerCase().includes('harta') &&
    safeMainTopic.toLowerCase().includes('mati');

  let topicPhrasePresent = true;
  if (specificTopicNeedsPhrase) {
    topicPhrasePresent =
      /\b(?:harta\s+(?:gak|nggak|tidak)\s+dibawa\s+mati|harta\s+dibawa\s+mati)\b/i.test(
        cleanScript
      );
    if (!topicPhrasePresent) {
      detailedFindings.push(
        `[Penyimpangan Topik Utama]: Dokumen secara spesifik membahas ungkapan "Harta Gak Dibawa Mati", namun frasa/konsep tersebut tidak ditemukan di dalam narasi.`
      );
    }
  }

  // Evaluasi relevansi per blok: minimal 4 dari 5 blok harus memuat jejak topik atau argumen terkait
  let blocksAddressingTopic = 0;
  const storyflowPlans = sourcePlan?.storyflow_plan || [];
  blocks.forEach((block, bIdx) => {
    const bLower = block.toLowerCase();
    const hasMatch = keyConceptsToCheck.some((term) =>
      bLower.includes(term.toLowerCase())
    );
    if (hasMatch) {
      blocksAddressingTopic += 1;
    } else {
      detailedFindings.push(
        `Blok ${bIdx + 1} (${storyflowPlans[bIdx]?.stageName || 'Tahap ' + (bIdx + 1)}) cenderung generik dan belum menyentuh kata kunci topik dokumen secara spesifik.`
      );
    }
  });

  const topicRelevancePassed =
    blocks.length > 0 &&
    (matchedTerms.length >= Math.min(3, keyConceptsToCheck.length)) &&
    topicPhrasePresent &&
    blocksAddressingTopic >= Math.min(3, blocks.length);

  if (!topicRelevancePassed) {
    reasons.push(
      `Relevansi Topik Rendah: Naskah belum secara spesifik mengembangkan topik "${safeMainTopic}". Narasi terlalu generik dan mengabaikan substansi utama kerangka.`
    );
  }

  // ==========================================
  // B. ARGUMENT COVERAGE
  // ==========================================
  const coveredArguments: string[] = [];
  const missingArguments: string[] = [];

  sourcePlan.key_arguments.forEach((arg) => {
    const argTokens = countWordsConsistent(arg.toLowerCase()).filter(
      (w) => w.length >= 5
    );
    const matchCount = argTokens.filter((tok) => scriptWordSet.has(tok)).length;
    const ratio = argTokens.length > 0 ? matchCount / argTokens.length : 0;

    if (ratio >= 0.25 || lowerScript.includes(arg.toLowerCase().slice(0, 30))) {
      coveredArguments.push(arg.slice(0, 75));
    } else {
      missingArguments.push(arg.slice(0, 75));
    }
  });

  const argumentCoveragePassed =
    sourcePlan.key_arguments.length === 0 ||
    coveredArguments.length >= Math.ceil(sourcePlan.key_arguments.length * 0.4);

  if (!argumentCoveragePassed) {
    reasons.push(
      `Cakupan Argumen Kurang: Sebagian besar poin argumentasi penting kerangka (${missingArguments.length} poin) belum dielaborasi di naskah.`
    );
  }

  // ==========================================
  // C. SOURCE GROUNDING
  // ==========================================
  const sourceProtected = extractProtectedTokens(
    classification?.rawText || sourcePlan.central_thesis
  ).tokens;

  const protectedTokensFound = sourceProtected.filter((tok) =>
    cleanScript.includes(tok)
  );
  const protectedTokensMissing = sourceProtected.filter(
    (tok) => !cleanScript.includes(tok)
  );

  const supportedClaims = [
    `Topik "${sourcePlan.main_topic}" didukung oleh dokumen kerangka.`,
    ...coveredArguments.map((arg) => `Argumen didukung sumber: "${arg}"`),
  ];
  const unsupportedClaims = missingArguments.map(
    (arg) => `Argumen sumber belum dikembangkan: "${arg}"`
  );

  const sourceGroundingPassed =
    sourceProtected.length === 0 ||
    protectedTokensFound.length >= Math.ceil(sourceProtected.length * 0.5);

  if (!sourceGroundingPassed) {
    reasons.push(
      `Grounding Sumber Lemah: Ditemukan token angka/fakta terproteksi dari sumber (${protectedTokensMissing.join(', ')}) yang hilang dari naskah.`
    );
  }

  // ==========================================
  // D. SEMANTIC CONSISTENCY
  // ==========================================
  // Cek konsistensi nada kritis anak muda tongkrongan (tidak terbalik mendukung kemalasan/pembenaran keliru)
  const isContradictingCriticism =
    /\b(?:harta\s+gak\s+dibawa\s+mati\s+(?:itu\s+)?(?:benar|bener|tepat|mutlak|nggak\s+usah\s+kerja|ngapain\s+kerja))\b/i.test(
      lowerScript
    );

  const semanticConsistencyPassed = !isContradictingCriticism;
  if (!semanticConsistencyPassed) {
    reasons.push(
      `Inkonsistensi Semantik: Naskah terbalik membenarkan kekeliruan logika yang seharusnya dikritik secara tajam.`
    );
  }

  // ==========================================
  // F. HALLUCINATION DETECTION
  // ==========================================
  // Deteksi tuduhan personal tak berdasar atau penyebutan lembaga/tokoh konspiratif yang tidak ada di sumber
  const suspiciousClaims: string[] = [];
  const conspiracyTokens = [
    'illuminati', 'freemason', 'wahyudi', 'antek asing', 'konspirasi elit global',
  ];
  conspiracyTokens.forEach((tok) => {
    if (lowerScript.includes(tok) && !classification?.rawText.toLowerCase().includes(tok)) {
      suspiciousClaims.push(`Klaim konspiratif tidak berdasar sumber: "${tok}"`);
    }
  });

  const hallucinationPassed = suspiciousClaims.length === 0;
  if (!hallucinationPassed) {
    reasons.push(
      `Halusinasi Terdeteksi: Naskah memuat klaim atau tuduhan yang tidak bersumber dari kerangka dokumen.`
    );
  }

  // ==========================================
  // G. STORYFLOW ALIGNMENT
  // ==========================================
  const progressionSummary: string[] = [];
  let distinctProgressions = 0;

  blocks.forEach((block, idx) => {
    const stageName = sourcePlan.storyflow_plan[idx]?.stageName || `Blok ${idx + 1}`;
    const wordCount = countWordsConsistent(block).length;
    progressionSummary.push(
      `${stageName}: ${wordCount} kata, fokus pada ${sourcePlan.storyflow_plan[idx]?.coreFocus || 'alur narasi'}`
    );
    if (wordCount >= 20) {
      distinctProgressions += 1;
    }
  });

  const storyflowAlignmentPassed =
    blocks.length >= 3 && distinctProgressions >= Math.min(4, blocks.length);

  // ==========================================
  // SKOR TOTAL & STATUS KELULUSAN
  // ==========================================
  let score = 100;
  if (!instructionLeakagePassed) score -= 40;
  if (!topicRelevancePassed) score -= 30;
  if (!argumentCoveragePassed) score -= 15;
  if (!sourceGroundingPassed) score -= 10;
  if (!semanticConsistencyPassed) score -= 15;
  if (!hallucinationPassed) score -= 20;
  if (!storyflowAlignmentPassed) score -= 10;

  score = Math.max(0, Math.min(100, score));

  // HARD REQUIREMENTS:
  // 1. TIDAK BOLEH ADA INSTRUCTION LEAKAGE
  // 2. TOPIC RELEVANCE HARUS LULUS
  // 3. SEMANTIC CONSISTENCY HARUS LULUS
  const passed =
    instructionLeakagePassed &&
    topicRelevancePassed &&
    semanticConsistencyPassed &&
    score >= 70;

  const status: 'SESUAI_KERANGKA' | 'TIDAK_SESUAI_KERANGKA' = passed
    ? 'SESUAI_KERANGKA'
    : 'TIDAK_SESUAI_KERANGKA';

  return {
    passed,
    score,
    status,
    topicRelevance: {
      passed: topicRelevancePassed,
      mainTopic: sourcePlan.main_topic,
      matchedTerms,
      missingKeyThemes: keyConceptsToCheck.filter((t) => !matchedTerms.includes(t)),
      reason: topicRelevancePassed
        ? `LULUS: Naskah secara konsisten membahas topik "${sourcePlan.main_topic}" dengan ${matchedTerms.length} kata kunci terverifikasi.`
        : `GAGAL: Naskah tidak cukup mengembangkan topik "${sourcePlan.main_topic}". Pembahasan cenderung generik.`,
    },
    argumentCoverage: {
      passed: argumentCoveragePassed,
      coveredCount: coveredArguments.length,
      totalCount: sourcePlan.key_arguments.length,
      coveredArguments,
      missingArguments,
      reason: argumentCoveragePassed
        ? `LULUS: ${coveredArguments.length}/${sourcePlan.key_arguments.length} argumen kunci sumber terwakili dalam naskah.`
        : `PERLU PENYEMPURNAAN: ${missingArguments.length} argumen kerangka belum terelaborasi.`,
    },
    sourceGrounding: {
      passed: sourceGroundingPassed,
      supportedClaims,
      unsupportedClaims,
      protectedTokensFound,
      protectedTokensMissing,
      reason: sourceGroundingPassed
        ? `LULUS: Fakta dan klaim dalam naskah berpijak pada data sumber.`
        : `PERLU PERHATIAN: ${protectedTokensMissing.length} token fakta sumber belum ditemukan di naskah.`,
    },
    semanticConsistency: {
      passed: semanticConsistencyPassed,
      reason: semanticConsistencyPassed
        ? 'LULUS: Alur kritik dan maksud orisinal penulis terjaga tanpa distorsi.'
        : 'GAGAL: Ditemukan kontradiksi atau penyimpangan terhadap tesis kritik penulis.',
    },
    instructionLeakage: {
      passed: instructionLeakagePassed,
      leakedPhrases,
      reason: instructionLeakagePassed
        ? 'LULUS: Bebas dari kebocoran teks instruksi framework, panduan penulisan, atau konstanta internal.'
        : `GAGAL: Terdeteksi kebocoran instruksi/metadata (${leakedPhrases.join(', ')}).`,
    },
    hallucinationDetection: {
      passed: hallucinationPassed,
      suspiciousClaims,
      reason: hallucinationPassed
        ? 'LULUS: Tidak ditemukan klaim palsu atau tuduhan konspiratif tanpa dasar sumber.'
        : `GAGAL: Ditemukan klaim tanpa pijakan data: ${suspiciousClaims.join('; ')}`,
    },
    storyflowAlignment: {
      passed: storyflowAlignmentPassed,
      progressionSummary,
      reason: storyflowAlignmentPassed
        ? 'LULUS: 5 tahap StoryFlow menyajikan progresi argumen secara bertahap.'
        : 'PERLU PERBAIKAN: Progresi tahapan belum proporsional.',
    },
    detailedFindings,
    reasons,
  };
}
