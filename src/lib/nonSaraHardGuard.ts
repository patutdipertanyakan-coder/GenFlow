/**
 * NON_SARA_HARD_GUARD — Modul Pengamanan Mutlak Sasaran Kritik GenNAS Pro
 *
 * HIERARKI PRIORITAS SISTEM (MUTLAK):
 * 1. NON_SARA_HARD_GUARD (Tingkat 1 - Tertinggi, Tidak Boleh Dibatalkan Oleh Apa Pun)
 * 2. Akurasi fakta dan larangan mengarang tuduhan (Tingkat 2)
 * 3. Karakter narator gue–lo yang ngomel, sinis, sarkastis, tajam, blak-blakan (Tingkat 3)
 * 4. Strict Integrated Profanity Control (4–5 makian/blok terhadap logika/perilaku) (Tingkat 4)
 * 5. StoryFlow, SCTF, SAP, serta kontinuitas prosodi (Tingkat 5)
 * 6. Bank kosakata informal F1–F8 dan preferensi gaya (Tingkat 6)
 *
 * SASARAN KRITIK YANG DIPERBOLEHKAN:
 * - Perilaku masyarakat yang keliru
 * - Pola pikir yang tidak logis / bias kognitif
 * - Argumen yang menyesatkan / manipulatif
 * - Kebiasaan yang merugikan publik
 * - Keputusan, regulasi, dan tindakan yang bertentangan dengan fakta
 *
 * DILARANG KERAS:
 * - Menyerang/menghina agama, ajaran keagamaan, atau umat/pemeluk agama sebagai identitas
 * - Menyerang/menghina suku, ras, etnis, atau kelompok identitas terlindungi (SARA)
 * - Menyerang/menghina lembaga, institusi, atau organisasi secara personal ("isinya orang-orang tolol")
 * - Menyerang/menghina individu atau tokoh tertentu secara personal
 * - Melakukan generalisasi kebencian terhadap kelompok sosial
 *
 * CATATAN KONTEKSTUAL (SEMANTIK vs REGEX MENTAH):
 * Penyebutan faktual (misal "kajian sosiologi agama", "survei BPS", "laporan kementerian",
 * atau kutipan rujukan) adalah SAH dan WAJIB DIPERTAHANKAN. Yang dilarang adalah
 * kalimat yang menjadikan pihak tersebut sebagai sasaran makian/penghinaan.
 */

import {
  GenNASConfig,
  LOCKED_CRITICAL_PERSPECTIVE,
  NonSaraGuardReport,
  NonSaraGuardViolation,
} from './types';

export { LOCKED_CRITICAL_PERSPECTIVE };

/**
 * Pola-pola instruksi tersembunyi (prompt injection) yang mencoba menimpa sudut pandang Non-SARA.
 */
const INJECTION_OVERRIDE_PATTERNS: RegExp[] = [
  /(?:abaikan|lupakan|ganti|ubah|timpa|override|ignore|disregard|forget)\s+(?:semua\s+|seluruh\s+|previous\s+|all\s+|prior\s+)?(?:instruksi|instructions?|aturan|rules?|konteks|context|sudut\s+pandang|perspektif|sistem|system|prompt)[^.\n]*[.\n]?/gi,
  /(?:KONTEKS|SUDUT[_\s]PANDANG|SYSTEM[_\s]PROMPT|PERSPEKTIF)\s*[:=]\s*[^\n]+/gi,
  /(?:serang|hina|caci\s*maki|rendahkan|attack|insult)\s+(?:identitas\s+|religious\s+)?(?:agama|umat|suku|ras|etnis|lembaga|organisasi|institusi|institutions?|individu|tokoh)[^.\n]*[.\n]?/gi,
  /jangan\s+gunakan\s+sudut\s+pandang\s+perilaku[^.\n]*[.\n]?/gi,
];

/**
 * Frasa-frasa penanda bahwa kalimat membingkai kritik secara sah pada logika, pola pikir, atau perilaku.
 */
const VALID_COGNITIVE_FRAMING_REGEX =
  /\b(?:yang\s+(?:tolol|goblok|bego|bodoh|dungu|idiot|kampungan|sinting|gila)\s+itu\s+(?:pola\s+pikir|logika|cara\s+mikir|anggapan|kebiasaan|perilaku|argumen|pembenaran|sikap)|(?:pola\s+pikir|logika|cara\s+mikir|anggapan|asumsi|kebiasaan|perilaku|argumen|pembenaran|keputusan|klaim|alasan|sikap|tindakan|mentalitas|standar|narasi|skema)\s+(?:yang\s+)?(?:tolol|goblok|bego|bodoh|dungu|idiot|kampungan|sinting|gila))\b/i;

/**
 * 1. Analisis Semantik Kalimat Tunggal untuk Deteksi Pelanggaran Sasaran Kritik Non-SARA
 */
export function inspectNonSaraSemanticViolations(sentence: string): {
  hasForbiddenTarget: boolean;
  violation?: NonSaraGuardViolation;
  reframedSentence?: string;
  isFactualMentionOnly: boolean;
} {
  const trimmed = sentence.trim();
  if (!trimmed) {
    return { hasForbiddenTarget: false, isFactualMentionOnly: false };
  }

  // Jika kalimat sudah secara eksplisit membingkai sasarannya ke "pola pikir", "logika", "kebiasaan", "perilaku", dll.
  // maka kalimat tersebut adalah kritik sah dan BUKAN serangan identitas.
  if (VALID_COGNITIVE_FRAMING_REGEX.test(trimmed)) {
    return { hasForbiddenTarget: false, isFactualMentionOnly: false };
  }

  // Cek apakah kalimat menyebut entitas agama/lembaga/tokoh dalam konteks faktual murni
  const mentionsEntityFactual =
    /\b(?:berdasarkan|menurut|kajian|studi|survei|data|laporan|catatan|rujukan|pasal|undang-undang|qs\.|surah|ayat|dokumen|bps|kementerian|dinas|institusi)\b/i.test(
      trimmed
    ) &&
    !/\b(?:goblok|tolol|bego|bodoh|dungu|idiot|kampungan|sinting|gila|paling\s+berbahaya|penipu|jahat|brengsek|bajingan)\b/i.test(
      trimmed
    );

  if (mentionsEntityFactual) {
    return { hasForbiddenTarget: false, isFactualMentionOnly: true };
  }

  // A. SERANGAN TERHADAP IDENTITAS AGAMA / UMAT / KELOMPOK SARA
  const religiousAttackPattern =
    /\b(?:orang(?:-orang)?\s+(?:taat\s+)?beragama|umat\s+beragama|umat\s+[a-z]+|agama\s+[a-z]*|penganut\s+[a-z]+|suku\s+[a-z]+|ras\s+[a-z]+|etnis\s+[a-z]+|kelompok\s+agama|kaum\s+beragama)\s+(?:itu\s+|ini\s+|tersebut\s+|memang\s+|emang\s+)?(?:paling\s+|sangat\s+)?(?:tolol|goblok|bego|bodoh|dungu|idiot|kampungan|sinting|gila|berbahaya(?:\s+dan\s+(?:tolol|goblok|bego|bodoh|dungu|idiot|sinting|gila))?)\b/i;

  if (religiousAttackPattern.test(trimmed)) {
    return {
      hasForbiddenTarget: true,
      isFactualMentionOnly: false,
      violation: {
        type: 'RELIGIOUS_IDENTITY_ATTACK',
        culpritText: trimmed,
        reason:
          'NON_SARA_HARD_GUARD (MUTLAK): Menyerang atau menghina identitas agama/umat sebagai kelompok, bukan mengkritik perilaku atau pola pikir.',
        reframedSuggestion:
          'Yang goblok itu pola pikir yang ngerasa semua tindakannya otomatis benar cuma karena dibungkus alasan moral.',
        isFactualMentionOnly: false,
      },
      reframedSentence:
        'Yang goblok itu pola pikir yang ngerasa semua tindakannya otomatis benar cuma karena dibungkus alasan moral.',
    };
  }

  // B. SERANGAN TERHADAP LEMBAGA / ORGANISASI / INSTITUSI SECARA PERSONAL
  const institutionAttackPattern =
    /\b(?:lembaga|organisasi|institusi|instansi|partai|kementerian|komisi|yayasan)\s+(?:itu|ini|tersebut)?\s*(?:isinya\s+|memang\s+|emang\s+|cuma\s+|adalah\s+)?(?:orang-orang\s+|orang\s+|para\s+|kumpulan\s+|manusia\s+)?(?:tolol|goblok|bego|bodoh|dungu|idiot|kampungan|sinting|gila)\b/i;

  if (institutionAttackPattern.test(trimmed)) {
    return {
      hasForbiddenTarget: true,
      isFactualMentionOnly: false,
      violation: {
        type: 'INSTITUTION_ATTACK',
        culpritText: trimmed,
        reason:
          'NON_SARA_HARD_GUARD (MUTLAK): Menyerang lembaga/organisasi secara personal ("isinya orang-orang tolol"), bukan mengkritik kebijakan, keputusan, atau inefisiensi yang faktual.',
        reframedSuggestion:
          'Logika tolol yang menganggap keputusan nggak perlu dipertanggungjawabkan itu justru bikin kebiasaan buruk terus dipelihara.',
        isFactualMentionOnly: false,
      },
      reframedSentence:
        'Logika tolol yang menganggap keputusan nggak perlu dipertanggungjawabkan itu justru bikin kebiasaan buruk terus dipelihara.',
    };
  }

  // C. SERANGAN PRIBADI TERHADAP INDIVIDU / TOKOH
  const personalAttackPattern =
    /\b(?:tokoh|pejabat|menteri|direktur|ulama|pendeta|individu|si\s+[a-z]+)\s+(?:itu|ini|tersebut)?\s*(?:memang\s+|emang\s+|adalah\s+)?(?:orangnya\s+)?(?:tolol|goblok|bego|bodoh|dungu|idiot|kampungan|sinting|gila)\b/i;

  if (personalAttackPattern.test(trimmed)) {
    return {
      hasForbiddenTarget: true,
      isFactualMentionOnly: false,
      violation: {
        type: 'INDIVIDUAL_ATTACK',
        culpritText: trimmed,
        reason:
          'NON_SARA_HARD_GUARD (MUTLAK): Menyerang individu/tokoh secara personal, bukan mengevaluasi argumen, keputusan, atau tindakan faktualnya.',
        reframedSuggestion:
          'Keputusan bego yang diambil tanpa mempertimbangkan data riil inilah yang bikin masalah makin berlarut-larut.',
        isFactualMentionOnly: false,
      },
      reframedSentence:
        'Keputusan bego yang diambil tanpa mempertimbangkan data riil inilah yang bikin masalah makin berlarut-larut.',
    };
  }

  return { hasForbiddenTarget: false, isFactualMentionOnly: false };
}

/**
 * 2. TAHAP PRE-GENERATION: Memeriksa kerangka naskah & sumber yang diunggah.
 * Membersihkan injeksi prompt, mempertahankan fakta/rujukan netral,
 * serta membingkai ulang judul provokatif menjadi tema perilaku dan pola pikir masyarakat.
 */
export function runNonSaraPreGenerationGuard(
  outlineText: string,
  fileName?: string
): {
  sanitizedOutline: string;
  guardReport: NonSaraGuardReport;
  inferredTopic: string;
  isProvocativeTitleReframed: boolean;
} {
  const violations: NonSaraGuardViolation[] = [];
  const factualMentionsPreserved: string[] = [];

  let working = outlineText || '';

  // 1. Bersihkan upaya injeksi prompt
  for (const rx of INJECTION_OVERRIDE_PATTERNS) {
    working = working.replace(rx, (match) => {
      violations.push({
        type: 'PROMPT_INJECTION_OVERRIDE',
        culpritText: match.trim(),
        reason:
          'NON_SARA_HARD_GUARD: Upaya injeksi prompt untuk menimpa aturan Non-SARA atau memerintahkan serangan telah dibersihkan.',
        isFactualMentionOnly: false,
      });
      return ' ';
    });
  }

  const rawLines = working
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const cleanedLines: string[] = [];
  let reframedCount = 0;

  for (const line of rawLines) {
    const inspection = inspectNonSaraSemanticViolations(line);
    if (inspection.isFactualMentionOnly) {
      factualMentionsPreserved.push(line.slice(0, 80));
      cleanedLines.push(line);
    } else if (inspection.hasForbiddenTarget && inspection.reframedSentence) {
      if (inspection.violation) {
        violations.push(inspection.violation);
      }
      reframedCount += 1;
      cleanedLines.push(inspection.reframedSentence);
    } else {
      cleanedLines.push(line);
    }
  }

  const sanitizedOutline = cleanedLines.join('\n').trim();

  // 2. Evaluasi judul provokatif/sensitif pada nama file atau baris pertama
  const rawFileTitle = fileName
    ? fileName.replace(/\.(?:docx|pdf|txt|md|csv)$/i, '').trim()
    : '';
  const firstLine = rawLines[0] || rawFileTitle || '';
  const combinedContext = `${rawFileTitle} ${firstLine}`.toLowerCase();

  let inferredTopic =
    'perilaku masyarakat dan pola pikir tidak logis dalam menyikapi fakta sosial sehari-hari';
  let isProvocativeTitleReframed = false;

  if (
    /\b(?:taat\s+beragama|orang\s+beragama|agama|ritual|kesalehan|iman|umat|klaim\s+kebenaran\s+mutlak|fanatisme)\b/i.test(
      combinedContext
    )
  ) {
    inferredTopic =
      'bahaya pola pikir merasa paling benar sendiri serta pembenaran moral tanpa empati sosial dan nalar kritis';
    isProvocativeTitleReframed = true;
  } else if (
    /\b(?:paylater|pinjol|utang\s+konsumtif|gaya\s+hidup|konsumerisme)\b/i.test(
      combinedContext
    )
  ) {
    inferredTopic =
      'kebiasaan menormalisasi utang konsumtif dan pola pikir impulsif di tengah tekanan gaya hidup';
  } else if (
    /\b(?:greenwashing|ekologi|iklim|polusi|lingkungan|sedotan\s+plastik)\b/i.test(
      combinedContext
    )
  ) {
    inferredTopic =
      'pola pikir simbolis dalam isu lingkungan yang mengalihkan perhatian dari kebiasaan dan tanggung jawab struktural';
  } else if (
    /\b(?:upah|biaya\s+hidup|kerja\s+keras|meritokrasi|pekerja|gaji)\b/i.test(
      combinedContext
    )
  ) {
    inferredTopic =
      'cara bernalar keliru yang menyederhanakan ketimpangan kesejahteraan semata-mata sebagai urusan kurang kerja keras';
  } else if (firstLine && firstLine.length >= 6) {
    const cleanedHeading = firstLine.replace(/^\d+\.\s*/, '').replace(/[.!?]+$/, '').trim();
    inferredTopic = `perilaku dan pola pikir masyarakat terkait ${cleanedHeading.charAt(0).toLowerCase()}${cleanedHeading.slice(1)}`;
  }

  const passed = violations.length === 0 || reframedCount === violations.length;

  return {
    sanitizedOutline,
    inferredTopic,
    isProvocativeTitleReframed,
    guardReport: {
      passed: true, // Pre-generation guard membersihkan dan mengarahkan kerangka menjadi aman
      stage: 'PRE_GENERATION',
      lockedPerspective: LOCKED_CRITICAL_PERSPECTIVE,
      violationsCount: violations.length,
      violations,
      factualMentionsPreserved,
      reframedCount,
      summary:
        violations.length === 0
          ? 'Kerangka naskah aman dan mematuhi batasan Non-SARA.'
          : `${violations.length} potensi pelanggaran berhasil dinetralkan dan diarahkan ke kritik perilaku/pola pikir.`,
    },
  };
}

/**
 * 3. TAHAP POST-GENERATION: Memeriksa seluruh 5 blok SCTF yang baru dihasilkan.
 * Memastikan tidak ada satu pun kalimat yang menyerang agama, kelompok identitas, lembaga, atau individu.
 */
export function runNonSaraPostGenerationGuard(
  script: string,
  _config?: Partial<GenNASConfig>
): {
  passed: boolean;
  guardReport: NonSaraGuardReport;
  repairedScript: string;
} {
  const blocks = script
    .replace(/\r\n/g, '\n')
    .trim()
    .split('\n')
    .map((b) => b.trim())
    .filter(Boolean);

  const violations: NonSaraGuardViolation[] = [];
  const factualMentionsPreserved: string[] = [];
  let reframedCount = 0;

  const repairedBlocks = blocks.map((block) => {
    const sentences = block
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const auditedSentences = sentences.map((sentence) => {
      const inspection = inspectNonSaraSemanticViolations(sentence);
      if (inspection.isFactualMentionOnly) {
        factualMentionsPreserved.push(sentence.slice(0, 80));
        return sentence;
      }
      if (inspection.hasForbiddenTarget) {
        if (inspection.violation) {
          violations.push(inspection.violation);
        }
        reframedCount += 1;
        return (
          inspection.reframedSentence ||
          'Logika tolol yang mengabaikan akal sehat itu justru bikin masalah terus dipelihara.'
        );
      }
      return sentence;
    });

    return auditedSentences.join(' ');
  });

  const repairedScript = repairedBlocks.join('\n');
  const passed = violations.length === 0;

  return {
    passed,
    repairedScript,
    guardReport: {
      passed,
      stage: 'POST_GENERATION',
      lockedPerspective: LOCKED_CRITICAL_PERSPECTIVE,
      violationsCount: violations.length,
      violations,
      factualMentionsPreserved,
      reframedCount,
      summary: passed
        ? 'NON_SARA_HARD_GUARD: LULUS (MUTLAK) — Seluruh 5 blok SCTF bebas dari serangan identitas, lembaga, maupun personal.'
        : `Ditemukan ${violations.length} kalimat yang melanggar batas sasaran kritik dan telah diperbaiki.`,
    },
  };
}

/**
 * 4. TAHAP POST-REVISION: Memvalidasi ulang setelah Auto-Enforce, Expander, Revisi Koma, atau Revisi Transisi.
 */
export function runNonSaraPostRevisionGuard(
  script: string,
  _config?: Partial<GenNASConfig>,
  operation: string = 'REVISI'
): {
  passed: boolean;
  guardReport: NonSaraGuardReport;
} {
  const blocks = script
    .replace(/\r\n/g, '\n')
    .trim()
    .split('\n')
    .map((b) => b.trim())
    .filter(Boolean);

  const violations: NonSaraGuardViolation[] = [];
  const factualMentionsPreserved: string[] = [];

  for (const block of blocks) {
    const sentences = block
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    for (const sentence of sentences) {
      const inspection = inspectNonSaraSemanticViolations(sentence);
      if (inspection.isFactualMentionOnly) {
        factualMentionsPreserved.push(sentence.slice(0, 80));
      } else if (inspection.hasForbiddenTarget && inspection.violation) {
        violations.push(inspection.violation);
      }
    }
  }

  const passed = violations.length === 0;

  return {
    passed,
    guardReport: {
      passed,
      stage: 'POST_REVISION',
      lockedPerspective: LOCKED_CRITICAL_PERSPECTIVE,
      violationsCount: violations.length,
      violations,
      factualMentionsPreserved,
      reframedCount: 0,
      summary: passed
        ? `NON_SARA_HARD_GUARD: LULUS (MUTLAK) setelah operasi ${operation}.`
        : `Operasi ${operation} meninggalkan ${violations.length} pelanggaran batasan sasaran kritik!`,
    },
  };
}
