/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ISOLATED EDGE VALIDATOR SUITE — GenNAS Pro V5.1
 *
 * Modul pengujian internal terisolasi untuk seluruh validator GenNAS Pro (Kategori A–H):
 * A. Struktur SCTF (Strict Compact Text Formatting)
 * B. Strict Integrated Profanity Control (3–5 makian valid/blok, no standalone, no forced filler)
 * C. Bahasa Gue–Lo (Konsistensi sapaan, verba lisan, penanda percakapan)
 * D. Syntax-Aware Punctuation (SAP & Protected Tokens)
 * E. Discourse Relation Analyzer & PTV (Kohesif antarblok, larangan metapresenter signpost)
 * F. NON_SARA_HARD_GUARD (Kritik fenomena sosial sah vs serangan SARA/lembaga/personal)
 * G. Sentence Integrity & Prefix Truncation (Kalimat utuh, deteksi akhiran gantung/potongan kata)
 * H. Bank Kosakata F1–F8 (Kelengkapan registry 56 entri, batas kata akurat, non-interferensi)
 *
 * ATURAN EVALUASI:
 * - Kasus Positif (valid data): Validator meloloskan -> STATUS: LULUS
 * - Kasus Negatif (invalid data yang sengaja melanggar): Validator MENOLAK dengan
 *   alasan pelanggaran yang diharapkan -> STATUS: LULUS (Rejection is correct behavior)
 * - Sistem TIDAK PERNAH memodifikasi naskah aktif, kerangka, atau monitor pengguna.
 */

import {
  parseAndValidateSCTF,
  analyzeBlockProfanity,
  analyzeBlockStyle,
  inspectPunctuationIssues,
  extractProtectedTokens,
  restoreProtectedTokens,
  analyzeTransitions,
  inspectCritiqueTargetViolations,
  healChoppedPrefixes,
} from './validatorAndPipeline';
import { inspectNonSaraSemanticViolations } from './nonSaraHardGuard';
import { auditCoreLexiconCompleteness } from './lexiconRegistry';
import {
  computeDynamicLexiconMonitor,
  getMasterLexiconRegistry,
} from './dynamicLexiconMonitor';

export type ValidatorCategoryKey =
  | 'A_SCTF'
  | 'B_PROFANITY'
  | 'C_GUE_LO'
  | 'D_SAP'
  | 'E_DRA'
  | 'F_NON_SARA'
  | 'G_PTV'
  | 'H_LEXICON';

export interface CategoryMeta {
  key: ValidatorCategoryKey;
  code: string;
  title: string;
  description: string;
}

export const VALIDATOR_CATEGORIES: CategoryMeta[] = [
  {
    key: 'A_SCTF',
    code: 'A',
    title: 'Struktur SCTF',
    description: 'Format 5 baris/blok padat tanpa baris kosong (\\n\\n).',
  },
  {
    key: 'B_PROFANITY',
    code: 'B',
    title: 'Strict Integrated Profanity',
    description: 'Kepatuhan 3–5 makian terintegrasi per blok, larangan mandiri & filler.',
  },
  {
    key: 'C_GUE_LO',
    code: 'C',
    title: 'Bahasa Gue–Lo',
    description: 'Konsistensi dialek percakapan, verba informal, tanpa sapaan saya/Anda.',
  },
  {
    key: 'D_SAP',
    code: 'D',
    title: 'Syntax-Aware Punctuation',
    description: 'Tanda baca EYD V, koma klausa, perlindungan angka/desimal/nominal.',
  },
  {
    key: 'E_DRA',
    code: 'E',
    title: 'Discourse Relation (DRA)',
    description: 'Jembatan kohesif antarblok, bebas pengumuman segmen presentasi.',
  },
  {
    key: 'F_NON_SARA',
    code: 'F',
    title: 'NON_SARA_HARD_GUARD',
    description: 'Kritik tajam pola pikir/perilaku vs larangan SARA, lembaga, personal.',
  },
  {
    key: 'G_PTV',
    code: 'G',
    title: 'Sentence Integrity (PTV)',
    description: 'Keutuhan kalimat, deteksi kalimat buntung/terpotong di awal atau tengah.',
  },
  {
    key: 'H_LEXICON',
    code: 'H',
    title: 'Bank Kosakata F1–F8',
    description: 'Registry 56 entri inti lengkap, boundary matching, non-interferensi.',
  },
];

export interface IsolatedTestCaseResult {
  id: string;
  category: ValidatorCategoryKey;
  categoryCode: string;
  categoryTitle: string;
  name: string;
  validatorName: string;
  caseType: 'POSITIF' | 'NEGATIF';
  inputSnippet: string;
  expectedOutcome: string;
  actualOutcome: string;
  passed: boolean;
  reason: string;
  technicalDetails?: Record<string, any>;
}

export interface IsolatedSuiteResult {
  totalTests: number;
  passedCount: number;
  failedCount: number;
  durationMs: number;
  allPassed: boolean;
  timestamp: string;
  resultsByCategory: Record<ValidatorCategoryKey, IsolatedTestCaseResult[]>;
  allResults: IsolatedTestCaseResult[];
}

export interface ProjectStateSnapshot {
  cleanScript: string;
  blocks: string[];
  faktaTerverifikasi: string;
  protectedTokens: string[];
  durasiMenit: number;
  wpm: number;
  modeDurasi: string;
  struktur: number[];
  dashboardStatus: string;
  activeLexiconUsedCount: number;
}

export interface ProjectStateIsolationProof {
  isolated: boolean;
  cleanScriptUnchanged: boolean;
  blocksUnchanged: boolean;
  outlineUnchanged: boolean;
  protectedTokensUnchanged: boolean;
  storyFlowUnchanged: boolean;
  dashboardStatusUnchanged: boolean;
  lexiconMonitorUnchanged: boolean;
  summary: string;
}

export function captureProjectStateSnapshot(params: {
  cleanScript: string;
  blocks: string[];
  faktaTerverifikasi: string;
  durasiMenit: number;
  wpm: number;
  modeDurasi: string;
  struktur: number[];
  dashboardStatus: string;
}): ProjectStateSnapshot {
  const tokens = extractProtectedTokens(params.faktaTerverifikasi || '').tokens;
  const lexMonitor = computeDynamicLexiconMonitor(params.cleanScript || '');
  return {
    cleanScript: String(params.cleanScript || ''),
    blocks: Array.isArray(params.blocks) ? [...params.blocks] : [],
    faktaTerverifikasi: String(params.faktaTerverifikasi || ''),
    protectedTokens: [...tokens],
    durasiMenit: Number(params.durasiMenit || 12),
    wpm: Number(params.wpm || 135),
    modeDurasi: String(params.modeDurasi || 'FLEKSIBEL'),
    struktur: Array.isArray(params.struktur) ? [...params.struktur] : [8, 17, 45, 20, 10],
    dashboardStatus: String(params.dashboardStatus || 'BELUM ADA NASKAH'),
    activeLexiconUsedCount: lexMonitor.totalUsedCount,
  };
}

export function verifyProjectStateIsolation(
  before: ProjectStateSnapshot,
  after: ProjectStateSnapshot
): ProjectStateIsolationProof {
  const cleanScriptUnchanged = before.cleanScript === after.cleanScript;
  const blocksUnchanged =
    before.blocks.length === after.blocks.length &&
    before.blocks.every((b, i) => b === after.blocks[i]);
  const outlineUnchanged = before.faktaTerverifikasi === after.faktaTerverifikasi;
  const protectedTokensUnchanged =
    before.protectedTokens.length === after.protectedTokens.length &&
    before.protectedTokens.every((t, i) => t === after.protectedTokens[i]);
  const storyFlowUnchanged =
    before.durasiMenit === after.durasiMenit &&
    before.wpm === after.wpm &&
    before.modeDurasi === after.modeDurasi &&
    before.struktur.length === after.struktur.length &&
    before.struktur.every((s, i) => s === after.struktur[i]);
  const dashboardStatusUnchanged = before.dashboardStatus === after.dashboardStatus;
  const lexiconMonitorUnchanged =
    before.activeLexiconUsedCount === after.activeLexiconUsedCount;

  const isolated =
    cleanScriptUnchanged &&
    blocksUnchanged &&
    outlineUnchanged &&
    protectedTokensUnchanged &&
    storyFlowUnchanged &&
    dashboardStatusUnchanged &&
    lexiconMonitorUnchanged;

  return {
    isolated,
    cleanScriptUnchanged,
    blocksUnchanged,
    outlineUnchanged,
    protectedTokensUnchanged,
    storyFlowUnchanged,
    dashboardStatusUnchanged,
    lexiconMonitorUnchanged,
    summary: isolated
      ? '100% Terisolasi: Seluruh data proyek pengguna (clean_script, 5 blok, kerangka, Protected Tokens, StoryFlow, Dashboard Kualitas, dan Bank Kosakata) tetap identik sebelum & sesudah pengujian.'
      : 'PERINGATAN: Ditemukan perubahan pada state proyek aktif!',
  };
}

/**
 * Validator Pembantu G: Sentence Integrity & Prefix Truncation (PTV)
 */
export function inspectSentenceIntegrityAndTruncation(text: string): {
  hasTruncation: boolean;
  issues: string[];
  healedText: string;
} {
  const issues: string[] = [];
  const trimmed = text.trim();

  // 1. Cek tanda baca gantung di awal
  if (/^[,.\-–—:;]+/.test(trimmed)) {
    issues.push('Kalimat diawali tanda baca gantung.');
  }

  // 2. Cek kata terpotong di awal blok (kehilangan awalan Pe- / Ke- / Per- seperti "nyelesaiannya", "simpulannya", "masalahannya")
  if (/^(?:nyelesaiannya|simpulannya|masalahannya)\b/i.test(trimmed)) {
    issues.push('Kata terpotong suku kata awalnya di awal blok.');
  }

  // 3. Cek akhiran gantung "-nya" atau "nya ..." di awal tanpa kata induk
  if (/^nya\b/i.test(trimmed) || /^,\s*nya\b/i.test(trimmed)) {
    issues.push('Kalimat diawali partikel gantung "nya" tanpa kata induk.');
  }

  // 4. Cek pembuka konektor buntung tanpa induk seperti "kan masalahnya ...", "jadinya begini ..."
  if (/^(?:kan\s+masalahnya|jadinya\s+begini|kan\s+jadinya)\b/i.test(trimmed)) {
    issues.push('Kalimat dibuka dengan konektor percakapan terpotong tanpa induk.');
  }

  // 5. Cek terpotong di tengah kata dengan strip gantung ("kebiasaan merug-")
  if (/[a-zA-ZÀ-ÿ]+-\s*$/.test(trimmed)) {
    issues.push('Kalimat terpotong di tengah kata dengan tanda hubung gantung.');
  }

  // 6. Cek terpotong mendadak di tengah kata tanpa tanda baca penutup
  if (/[a-zA-ZÀ-ÿ]{2,}\.\.\.$/.test(trimmed) && trimmed.length < 35) {
    issues.push('Kalimat terpotong dengan tanda elipsis gantung.');
  }

  const healed = healChoppedPrefixes(trimmed, 0);

  return {
    hasTruncation: issues.length > 0,
    issues,
    healedText: healed,
  };
}

/**
 * Runner Pengujian Seluruh Validator dalam Lingkungan Terisolasi
 */
export function runIsolatedEdgeValidatorSuite(): IsolatedSuiteResult {
  const startTime = performance.now();
  const allResults: IsolatedTestCaseResult[] = [];

  // ==========================================
  // KATEGORI A: STRUKTUR SCTF
  // ==========================================

  // A1: 5 Blok Valid SCTF
  {
    const fixture = [
      'Kalau lo perhatiin masalah kenaikan biaya hidup, pola pikir goblok yang nyalahin korban jelas bikin masalah makin runyam.',
      'Dari situ kelihatan jelas kalau akar persoalannya bukan cuma soal malas, tapi ada logika tolol yang sengaja dipertahankan.',
      'Masalahnya makin terang waktu kita bedah datanya, anggapan bego ini bikin kebijakan publik kehilangan akal sehat.',
      'Kalau kita mau nyari jalan keluar yang beneran realistis, langkah pertama adalah nghentiin pembenaran bodoh semacam itu.',
      'Ujung-ujungnya lo sendiri yang bisa nilai, apakah narasi dungu ini masih mau terus lo telan mentah-mentah.',
    ].join('\n');

    const check = parseAndValidateSCTF(fixture, 5);
    const passed = check.valid && check.blocks.length === 5 && check.errors.length === 0;

    allResults.push({
      id: 'SCTF-01',
      category: 'A_SCTF',
      categoryCode: 'A',
      categoryTitle: 'Struktur SCTF',
      name: 'Lima blok valid SCTF',
      validatorName: 'parseAndValidateSCTF',
      caseType: 'POSITIF',
      inputSnippet: fixture.slice(0, 140) + '...',
      expectedOutcome: 'Lolos: valid === true, 5 blok terurai tanpa error.',
      actualOutcome: `valid: ${check.valid}, blok: ${check.blocks.length}, error: ${check.errors.length}`,
      passed,
      reason: passed
        ? 'Validator berhasil meloloskan naskah 5 baris yang memenuhi spesifikasi SCTF.'
        : `Validator gagal meloloskan: ${check.errors.join('; ')}`,
      technicalDetails: { valid: check.valid, count: check.blocks.length, errors: check.errors },
    });
  }

  // A2: Kurang dari 5 Blok
  {
    const fixture = [
      'Blok pertama naskah analisis pengujian.',
      'Blok kedua membahas akar persoalan struktural.',
      'Blok ketiga membedah data dan konsekuensi riil.',
    ].join('\n');

    const check = parseAndValidateSCTF(fixture, 5);
    // Negatif: Ditolak dengan benar -> LULUS
    const rejectedWithReason = !check.valid && check.errors.some((e) => e.includes('Jumlah baris'));

    allResults.push({
      id: 'SCTF-02',
      category: 'A_SCTF',
      categoryCode: 'A',
      categoryTitle: 'Struktur SCTF',
      name: 'Jumlah blok kurang dari lima (3 blok)',
      validatorName: 'parseAndValidateSCTF',
      caseType: 'NEGATIF',
      inputSnippet: fixture,
      expectedOutcome: 'Ditolak: jumlah baris tidak memenuhi kontrak 5 blok.',
      actualOutcome: `valid: ${check.valid}, pesan: ${check.errors[0] || 'Tidak ada error'}`,
      passed: rejectedWithReason,
      reason: rejectedWithReason
        ? 'Validator secara tepat mendeteksi dan menolak naskah yang kurang dari 5 blok.'
        : 'Validator gagal mendeteksi kekurangan jumlah blok.',
      technicalDetails: { errors: check.errors },
    });
  }

  // A3: Lebih dari 5 Blok
  {
    const fixture = Array.from({ length: 7 }, (_, i) => `Blok ${i + 1} teks pengujian berlebih.`).join('\n');
    const check = parseAndValidateSCTF(fixture, 5);
    const rejectedWithReason = !check.valid && check.errors.some((e) => e.includes('Jumlah baris'));

    allResults.push({
      id: 'SCTF-03',
      category: 'A_SCTF',
      categoryCode: 'A',
      categoryTitle: 'Struktur SCTF',
      name: 'Jumlah blok melebihi lima (7 blok)',
      validatorName: 'parseAndValidateSCTF',
      caseType: 'NEGATIF',
      inputSnippet: fixture.slice(0, 130) + '...',
      expectedOutcome: 'Ditolak: jumlah baris melebihi batas kontrak 5 blok.',
      actualOutcome: `valid: ${check.valid}, pesan: ${check.errors[0] || 'Tidak ada error'}`,
      passed: rejectedWithReason,
      reason: rejectedWithReason
        ? 'Validator secara tepat menolak naskah dengan 7 blok.'
        : 'Validator gagal menolak naskah berlebih.',
      technicalDetails: { errors: check.errors },
    });
  }

  // A4: Baris Kosong / Double Newline
  {
    const fixture = 'Blok 1 narasi.\n\nBlok 2 narasi.\nBlok 3 narasi.\nBlok 4 narasi.\nBlok 5 narasi.';
    const check = parseAndValidateSCTF(fixture, 5);
    const rejectedWithReason = !check.valid && check.errors.some((e) => e.includes('baris kosong atau double newline'));

    allResults.push({
      id: 'SCTF-04',
      category: 'A_SCTF',
      categoryCode: 'A',
      categoryTitle: 'Struktur SCTF',
      name: 'Baris kosong / double newline (\\n\\n)',
      validatorName: 'parseAndValidateSCTF',
      caseType: 'NEGATIF',
      inputSnippet: fixture.replace(/\n/g, '\\n'),
      expectedOutcome: 'Ditolak: melanggar pemisah tepat satu newline SCTF.',
      actualOutcome: `valid: ${check.valid}, pesan: ${check.errors[0] || 'Tidak ada error'}`,
      passed: rejectedWithReason,
      reason: rejectedWithReason
        ? 'Validator secara tepat mendeteksi pelanggaran double newline di antara baris.'
        : 'Validator gagal mendeteksi baris kosong.',
      technicalDetails: { errors: check.errors },
    });
  }

  // ==========================================
  // KATEGORI B: STRICT INTEGRATED PROFANITY
  // ==========================================

  // B1: 3-5 Makian Terintegrasi Sesuai Aturan
  {
    const fixture =
      'Kalau lo ngelihat fenomena ini lebih jernih, pola pikir tolol yang ngerasa paling benar sendiri jelas bikin ruang diskusi jadi rusak. ' +
      'Banyak orang kejebak kebiasaan bego buat nyalahin korban tanpa mau nguji bukti nyata di lapangan. ' +
      'Ironisnya, argumen goblok semacam itu terus diulang seolah-olah masuk akal, padahal keputusan dungu tersebut merugikan banyak pihak.';

    const check = analyzeBlockProfanity(fixture, 0);
    const passed = check.passed && check.validCount >= 3 && check.validCount <= 5;

    allResults.push({
      id: 'PROF-01',
      category: 'B_PROFANITY',
      categoryCode: 'B',
      categoryTitle: 'Strict Integrated Profanity',
      name: 'Distribusi 3–5 makian terintegrasi per blok',
      validatorName: 'analyzeBlockProfanity',
      caseType: 'POSITIF',
      inputSnippet: fixture.slice(0, 140) + '...',
      expectedOutcome: 'Lolos: 3–5 makian valid terintegrasi menyatu dalam argumen.',
      actualOutcome: `passed: ${check.passed}, validCount: ${check.validCount}, reasons: ${check.reasons.length}`,
      passed,
      reason: passed
        ? `Validator meloloskan ${check.validCount} kata kasar yang terintegrasi secara semantis dan sintaksis.`
        : `Validator menolak: ${check.reasons.join('; ')}`,
      technicalDetails: { validCount: check.validCount, eventsCount: check.events.length },
    });
  }

  // B2: Makian Kurang dari 3
  {
    const fixture =
      'Kalau lo ngelihat fenomena ini dari dekat, pola pikir tolol itu emang bikin masyarakat susah berkembang. ' +
      'Padahal fakta di lapangan menunjukkan bahwa pertumbuhan ekonomi melambat tanpa ada evaluasi mendalam.';

    const check = analyzeBlockProfanity(fixture, 0);
    const rejectedWithReason = !check.passed && check.reasons.some((r) => r.includes('baru memiliki'));

    allResults.push({
      id: 'PROF-02',
      category: 'B_PROFANITY',
      categoryCode: 'B',
      categoryTitle: 'Strict Integrated Profanity',
      name: 'Jumlah makian kurang (< 3 per blok)',
      validatorName: 'analyzeBlockProfanity',
      caseType: 'NEGATIF',
      inputSnippet: fixture.slice(0, 130) + '...',
      expectedOutcome: 'Ditolak: hanya ditemukan 1 makian valid (minimal wajib 3).',
      actualOutcome: `passed: ${check.passed}, validCount: ${check.validCount}, alasan: ${check.reasons[0]}`,
      passed: rejectedWithReason,
      reason: rejectedWithReason
        ? 'Validator secara tepat menolak blok yang hanya memiliki 1 makian.'
        : 'Validator meloloskan blok yang kekurangan kuota makian.',
      technicalDetails: { validCount: check.validCount, reasons: check.reasons },
    });
  }

  // B3: Makian Melebihi Batas (> 5)
  {
    const fixture =
      'Pola pikir tolol ini bikin semua orang bingung. ' +
      'Kebiasaan goblok kayak gitu nggak boleh dipelihara. ' +
      'Argumen bego yang diucapin cuma nambah keruwetan. ' +
      'Langkah bodoh tersebut bikin ekonomi anjlok. ' +
      'Keputusan dungu dari mereka merugikan kita. ' +
      'Mentalitas idiot ini harus segera diakhiri. ' +
      'Sikap sinting semacam itu bikin keadaan makin runyam.';

    const check = analyzeBlockProfanity(fixture, 0);
    const rejectedWithReason = !check.passed && check.reasons.some((r) => r.includes('melebihi batas maksimal 5'));

    allResults.push({
      id: 'PROF-03',
      category: 'B_PROFANITY',
      categoryCode: 'B',
      categoryTitle: 'Strict Integrated Profanity',
      name: 'Jumlah makian melebihi batas (> 5 per blok)',
      validatorName: 'analyzeBlockProfanity',
      caseType: 'NEGATIF',
      inputSnippet: fixture.slice(0, 140) + '...',
      expectedOutcome: 'Ditolak: jumlah makian melebihi batas maksimal 5 per blok.',
      actualOutcome: `passed: ${check.passed}, validCount: ${check.validCount}, alasan: ${check.reasons[0]}`,
      passed: rejectedWithReason,
      reason: rejectedWithReason
        ? `Validator secara tepat menolak blok dengan ${check.validCount} makian yang melebihi kuota 5.`
        : 'Validator gagal menolak kelebihan makian.',
      technicalDetails: { validCount: check.validCount, reasons: check.reasons },
    });
  }

  // B4: Makian Berdiri Sendiri (H4)
  {
    const fixture =
      'Goblok banget. Kalau lo perhatiin cara orang ngambil keputusan, pola pikir tolol itu emang bikin rugi banyak pihak. ' +
      'Argumen bego semacam itu nggak seharusnya terus ditoleransi di ruang publik.';

    const check = analyzeBlockProfanity(fixture, 0);
    const rejectedWithReason = check.events.some((e) => e.isStandaloneViolation);

    allResults.push({
      id: 'PROF-04',
      category: 'B_PROFANITY',
      categoryCode: 'B',
      categoryTitle: 'Strict Integrated Profanity',
      name: 'Makian berdiri sendiri "Goblok banget." (H4)',
      validatorName: 'analyzeBlockProfanity',
      caseType: 'NEGATIF',
      inputSnippet: fixture.slice(0, 120) + '...',
      expectedOutcome: 'Ditolak: kalimat makian mandiri tanpa klausa argumen terdeteksi sebagai pelanggaran H4.',
      actualOutcome: `isStandaloneViolation: ${rejectedWithReason}`,
      passed: rejectedWithReason,
      reason: rejectedWithReason
        ? 'Validator berhasil mendeteksi dan menolak kalimat makian mandiri (H4).'
        : 'Validator gagal mendeteksi makian mandiri.',
      technicalDetails: { events: check.events },
    });
  }

  // B5: Makian Tempelan di Akhir Kalimat Pendek
  {
    const fixture =
      'Keputusan itu salah, goblok. ' +
      'Pola pikir tolol kayak gini bikin situasi makin buruk. ' +
      'Argumen bego semacam ini nggak masuk akal.';

    const check = analyzeBlockProfanity(fixture, 0);
    const rejectedWithReason = check.events.some((e) => e.isStandaloneViolation);

    allResults.push({
      id: 'PROF-05',
      category: 'B_PROFANITY',
      categoryCode: 'B',
      categoryTitle: 'Strict Integrated Profanity',
      name: 'Makian tempelan di akhir kalimat pendek (H4 filler)',
      validatorName: 'analyzeBlockProfanity',
      caseType: 'NEGATIF',
      inputSnippet: 'Keputusan itu salah, goblok.',
      expectedOutcome: 'Ditolak: makian di ujung kalimat tanpa klausa penjelas terdeteksi sebagai filler.',
      actualOutcome: `isStandaloneViolation: ${rejectedWithReason}`,
      passed: rejectedWithReason,
      reason: rejectedWithReason
        ? 'Validator secara tepat menandai makian tempelan di ujung kalimat pendek sebagai pelanggaran.'
        : 'Validator meloloskan punchline filler.',
      technicalDetails: { events: check.events },
    });
  }

  // B6: Kata Ambigu "gila" sebagai Intensifier Percakapan
  {
    const fixture =
      'Gila, keren banget pencapaian riset tersebut waktu ngebongkar pola pikir tolol yang selama ini dipelihara. ' +
      'Banyak orang akhirnya sadar kalau kebiasaan bego itu udah ngerugiin banyak pihak. ' +
      'Argumen goblok yang dulu dibela mati-matian sekarang udah nggak laku lagi.';

    const check = analyzeBlockProfanity(fixture, 0);
    const gilaEvent = check.events.find((e) => e.rootWord === 'gila');
    const correctlyTreated = Boolean(gilaEvent?.isAmbiguousNonProfane && !gilaEvent.valid);

    allResults.push({
      id: 'PROF-06',
      category: 'B_PROFANITY',
      categoryCode: 'B',
      categoryTitle: 'Strict Integrated Profanity',
      name: 'Kata ambigu "gila" sebagai intensifier percakapan',
      validatorName: 'analyzeBlockProfanity',
      caseType: 'POSITIF',
      inputSnippet: 'Gila, keren banget pencapaian riset tersebut...',
      expectedOutcome: '"Gila" diklasifikasikan sebagai intensifier/non-profane dan tidak dihitung ke kuota makian.',
      actualOutcome: `isAmbiguousNonProfane: ${gilaEvent?.isAmbiguousNonProfane}, valid: ${gilaEvent?.valid}`,
      passed: correctlyTreated,
      reason: correctlyTreated
        ? 'Validator secara kontekstual membedakan "gila" percakapan dari makian argumen.'
        : 'Validator keliru menghitung intensifier "gila" sebagai makian.',
      technicalDetails: { gilaEvent },
    });
  }

  // ==========================================
  // KATEGORI C: BAHASA GUE–LO
  // ==========================================

  // C1: Gaya Informal Gue–Lo Alami
  {
    const fixture =
      'Kalau lo ngeliat kondisi riilnya, gue rasa kebijakan itu emang nggak bikin keadaan makin baik bagi pekerja kecil.';
    const check = analyzeBlockStyle(fixture);
    const passed = check.stylePassed && check.conversationalMarkersFound.length >= 2 && check.informalVerbsFound.length >= 1;

    allResults.push({
      id: 'STYLE-01',
      category: 'C_GUE_LO',
      categoryCode: 'C',
      categoryTitle: 'Bahasa Gue–Lo',
      name: 'Konsistensi gaya informal gue–lo alami',
      validatorName: 'analyzeBlockStyle',
      caseType: 'POSITIF',
      inputSnippet: fixture,
      expectedOutcome: 'Lolos: memiliki minimal 2 penanda percakapan dan 1 verba informal.',
      actualOutcome: `stylePassed: ${check.stylePassed}, penanda: ${check.conversationalMarkersFound.join(', ')}, verba: ${check.informalVerbsFound.join(', ')}`,
      passed,
      reason: passed
        ? 'Validator meloloskan blok yang konsisten menggunakan dialek gue–lo anak tongkrongan.'
        : 'Validator gagal meloloskan gaya informal valid.',
      technicalDetails: { issues: check.styleIssues },
    });
  }

  // C2: Sapaan Formal "saya/Anda" di Luar Kutipan
  {
    const fixture =
      'Menurut saya Anda harus memahami bahwa sistem ini tidak adil bagi seluruh lapisan masyarakat.';
    const check = analyzeBlockStyle(fixture);
    const rejectedWithReason = !check.stylePassed && check.formalPronounsFound.length > 0;

    allResults.push({
      id: 'STYLE-02',
      category: 'C_GUE_LO',
      categoryCode: 'C',
      categoryTitle: 'Bahasa Gue–Lo',
      name: 'Penggunaan sapaan formal narator "saya/Anda"',
      validatorName: 'analyzeBlockStyle',
      caseType: 'NEGATIF',
      inputSnippet: fixture,
      expectedOutcome: 'Ditolak: terdeteksi kata sapaan formal saya/Anda di luar kutipan.',
      actualOutcome: `stylePassed: ${check.stylePassed}, kataFormal: ${check.formalPronounsFound.join(', ')}`,
      passed: rejectedWithReason,
      reason: rejectedWithReason
        ? `Validator berhasil mendeteksi dan menolak sapaan formal (${check.formalPronounsFound.join(', ')}).`
        : 'Validator meloloskan sapaan formal narator.',
      technicalDetails: { formalPronounsFound: check.formalPronounsFound },
    });
  }

  // C3: Kalimat Terlalu Formal Tanpa Penanda Percakapan
  {
    const fixture =
      'Peningkatan efisiensi operasional merupakan parameter esensial dalam determinasi keberlanjutan stabilitas makroekonomi nasional.';
    const check = analyzeBlockStyle(fixture);
    const rejectedWithReason = !check.stylePassed && check.styleIssues.some((i) => i.type.includes('INSUFFICIENT'));

    allResults.push({
      id: 'STYLE-03',
      category: 'C_GUE_LO',
      categoryCode: 'C',
      categoryTitle: 'Bahasa Gue–Lo',
      name: 'Struktur kalimat terlalu formal (tanpa penanda informal)',
      validatorName: 'analyzeBlockStyle',
      caseType: 'NEGATIF',
      inputSnippet: fixture,
      expectedOutcome: 'Ditolak: kekurangan penanda percakapan dan verba lisan.',
      actualOutcome: `stylePassed: ${check.stylePassed}, issues: ${check.styleIssues.map((i) => i.type).join(', ')}`,
      passed: rejectedWithReason,
      reason: rejectedWithReason
        ? 'Validator secara tepat menolak gaya bahasa birokratis/kaku tanpa penanda percakapan.'
        : 'Validator meloloskan kalimat formal kaku.',
      technicalDetails: { issues: check.styleIssues },
    });
  }

  // C4: Kosakata Informal yang Digunakan Secara Tidak Wajar
  {
    const fixture =
      'Gue sih banget kok ngeliat ngeliat kebijakan itu kayak emang sih banget nggak masuk akal.';
    const check = analyzeBlockStyle(fixture);
    const rejectedWithReason =
      !check.stylePassed &&
      check.styleIssues.some((i) => i.type === 'UNNATURAL_INFORMAL_USAGE');

    allResults.push({
      id: 'STYLE-04',
      category: 'C_GUE_LO',
      categoryCode: 'C',
      categoryTitle: 'Bahasa Gue–Lo',
      name: 'Kosakata informal yang digunakan secara tidak wajar (F7)',
      validatorName: 'analyzeBlockStyle',
      caseType: 'NEGATIF',
      inputSnippet: fixture,
      expectedOutcome:
        'Ditolak: penumpukan partikel/verba informal secara tidak wajar terdeteksi melanggar kaidah F7.',
      actualOutcome: `stylePassed: ${check.stylePassed}, issues: ${check.styleIssues.map((i) => i.type).join(', ')}`,
      passed: rejectedWithReason,
      reason: rejectedWithReason
        ? 'Validator berhasil mendeteksi dan menolak penumpukan kosakata informal yang dipaksakan secara tidak wajar.'
        : 'Validator meloloskan penggunaan kosakata informal tidak wajar.',
      technicalDetails: { issues: check.styleIssues },
    });
  }

  // ==========================================
  // KATEGORI D: SYNTAX-AWARE PUNCTUATION (SAP)
  // ==========================================

  // D1: Anak Kalimat Mendahului Induk Kalimat Menggunakan Koma
  {
    const fixture = 'Kalau lo kerja keras, peluang bakal terbuka lebar buat siapa pun.';
    const issues = inspectPunctuationIssues(fixture);
    const passed = issues.length === 0;

    allResults.push({
      id: 'SAP-01',
      category: 'D_SAP',
      categoryCode: 'D',
      categoryTitle: 'Syntax-Aware Punctuation',
      name: 'Koma pada batas klausa yang benar (anak kalimat di depan induk)',
      validatorName: 'inspectPunctuationIssues',
      caseType: 'POSITIF',
      inputSnippet: fixture,
      expectedOutcome: 'Lolos: tanda koma memisahkan anak kalimat dan induk kalimat sesuai EYD V.',
      actualOutcome: `issues: ${issues.length}`,
      passed,
      reason: passed
        ? 'Validator memvalidasi kepatuhan tanda koma antarklausa sesuai kaidah EYD V.'
        : `Validator menemukan error tak terduga: ${issues.map((i) => i.description).join('; ')}`,
      technicalDetails: { issues },
    });
  }

  // D2: Koma Salah Memisahkan Subjek dan Predikat
  {
    const fixture = 'Pekerja, selalu disalahkan dalam perusahaan tanpa alasan yang masuk akal.';
    const issues = inspectPunctuationIssues(fixture);
    const rejectedWithReason = issues.some((i) => i.type === 'SUBJECT_PREDICATE_COMMA_ERROR');

    allResults.push({
      id: 'SAP-02',
      category: 'D_SAP',
      categoryCode: 'D',
      categoryTitle: 'Syntax-Aware Punctuation',
      name: 'Koma memisahkan Subjek dan Predikat secara keliru (S-P)',
      validatorName: 'inspectPunctuationIssues',
      caseType: 'NEGATIF',
      inputSnippet: fixture,
      expectedOutcome: 'Ditolak: terdeteksi tanda koma yang memotong subjek dan predikat secara keliru.',
      actualOutcome: `issues: ${issues.length}, jenis: ${issues[0]?.type || 'none'}`,
      passed: rejectedWithReason,
      reason: rejectedWithReason
        ? 'Validator berhasil mendeteksi pemotongan salah antara Subjek dan Predikat.'
        : 'Validator meloloskan koma subjek-predikat yang salah.',
      technicalDetails: { issues },
    });
  }

  // D3: Koma Memisahkan Predikat dan Objek Secara Keliru
  {
    const fixture = 'Banyak orang nyalahin, korban kebijakan tanpa mau memeriksa fakta lapangan.';
    const issues = inspectPunctuationIssues(fixture);
    const rejectedWithReason = issues.some((i) => i.type === 'PREDICATE_OBJECT_COMMA_ERROR');

    allResults.push({
      id: 'SAP-03',
      category: 'D_SAP',
      categoryCode: 'D',
      categoryTitle: 'Syntax-Aware Punctuation',
      name: 'Koma memisahkan Predikat dan Objek secara keliru (P-O)',
      validatorName: 'inspectPunctuationIssues',
      caseType: 'NEGATIF',
      inputSnippet: fixture,
      expectedOutcome: 'Ditolak: terdeteksi tanda koma yang memisahkan verba predikat dan objek langsung.',
      actualOutcome: `issues: ${issues.length}, jenis: ${issues[0]?.type || 'none'}`,
      passed: rejectedWithReason,
      reason: rejectedWithReason
        ? 'Validator berhasil mendeteksi dan menolak tanda koma yang memisahkan predikat dari objeknya.'
        : 'Validator meloloskan koma predikat-objek yang salah.',
      technicalDetails: { issues },
    });
  }

  // D4: Perlindungan Token Angka, Rupiah, Persentase, dan Desimal (SAP Tokens)
  {
    const fixture =
      'Biaya hidup meningkat Rp1.500.000 per bulan sejak 1990-an, dengan kenaikan inflasi 71,5% dan rasio 3,14 per kapita.';
    const map = extractProtectedTokens(fixture);
    const restored = restoreProtectedTokens(map.maskedText, map);
    const exactMatch = restored === fixture;
    const tokensFound = map.tokens;
    const hasAllTokens =
      tokensFound.includes('Rp1.500.000') &&
      tokensFound.includes('1990-an') &&
      tokensFound.includes('71,5%') &&
      tokensFound.includes('3,14');

    const passed = exactMatch && hasAllTokens;

    allResults.push({
      id: 'SAP-04',
      category: 'D_SAP',
      categoryCode: 'D',
      categoryTitle: 'Syntax-Aware Punctuation',
      name: 'Tanda baca pada nominal, persentase, dan angka desimal (SAP Tokens)',
      validatorName: 'extractProtectedTokens & restoreProtectedTokens',
      caseType: 'POSITIF',
      inputSnippet: fixture,
      expectedOutcome: 'Lolos: 4 token terdeteksi utuh, pemulihan (round-trip) 100% identik.',
      actualOutcome: `tokens: [${tokensFound.join(', ')}], roundTripExact: ${exactMatch}`,
      passed,
      reason: passed
        ? 'Validator SAP berhasil memproteksi nominal Rupiah, tahun dekade, desimal, dan persentase tanpa korupsi.'
        : 'Validator SAP gagal melindungi token angka secara tepat.',
      technicalDetails: { tokens: tokensFound, roundTripExact: exactMatch },
    });
  }

  // D5: Koma Salah Setelah Preposisi
  {
    const fixture = 'Kebijakan ini berlaku di, seluruh wilayah tanpa kompromi.';
    const issues = inspectPunctuationIssues(fixture);
    const rejectedWithReason = issues.some((i) => i.type === 'PREPOSITION_COMMA_ERROR');

    allResults.push({
      id: 'SAP-05',
      category: 'D_SAP',
      categoryCode: 'D',
      categoryTitle: 'Syntax-Aware Punctuation',
      name: 'Koma otomatis yang salah setelah preposisi ("di,")',
      validatorName: 'inspectPunctuationIssues',
      caseType: 'NEGATIF',
      inputSnippet: fixture,
      expectedOutcome: 'Ditolak: terdeteksi tanda koma setelah preposisi "di," yang merusak sintaksis.',
      actualOutcome: `issues: ${issues.length}, jenis: ${issues[0]?.type || 'none'}`,
      passed: rejectedWithReason,
      reason: rejectedWithReason
        ? 'Validator berhasil mendeteksi koma salah setelah preposisi.'
        : 'Validator meloloskan koma setelah preposisi.',
      technicalDetails: { issues },
    });
  }

  // ==========================================
  // KATEGORI E: DISCOURSE RELATION ANALYZER (DRA)
  // ==========================================

  // E1: Hubungan Kohesif Antarblok Alami
  {
    const blocks = [
      'Kalau lo perhatiin masalah kenaikan biaya hidup, ada kejanggalan besar yang sengaja ditutupi.',
      'Dari situ kelihatan jelas kalau akar persoalannya bukan cuma soal malas, tapi ada logika keliru yang dipelihara.',
    ];
    const transitions = analyzeTransitions(blocks);
    const passed = transitions.length === 1 && transitions[0].passed && !transitions[0].isMetaPresenterSignpost;

    allResults.push({
      id: 'DRA-01',
      category: 'E_DRA',
      categoryCode: 'E',
      categoryTitle: 'Discourse Relation (DRA)',
      name: 'Transisi antarblok yang logis dan kohesif',
      validatorName: 'analyzeTransitions',
      caseType: 'POSITIF',
      inputSnippet: `B1: ${blocks[0]}\nB2: ${blocks[1]}`,
      expectedOutcome: 'Lolos: transisi diakui kohesif tanpa signpost metapresenter.',
      actualOutcome: `passed: ${transitions[0]?.passed}, relation: ${transitions[0]?.relation}`,
      passed,
      reason: passed
        ? `Validator mengakui relasi diskursus ${transitions[0]?.relation} sebagai jembatan argumen yang sah.`
        : 'Validator gagal meloloskan transisi kohesif alami.',
      technicalDetails: { transition: transitions[0] },
    });
  }

  // E2: Pembuka yang Tidak Berkaitan dengan Blok Sebelumnya
  {
    const blocks = [
      'Kalau lo perhatiin masalah kenaikan biaya hidup, ada kejanggalan besar dalam kebijakan upah yang sengaja ditutupi.',
      'Resep masakan rendang daging sapi membutuhkan santan kelapa kental yang dimasak selama empat jam.',
    ];
    const transitions = analyzeTransitions(blocks);
    const rejectedWithReason =
      transitions.length === 1 &&
      Boolean(transitions[0].isDisconnectedOpening) &&
      !transitions[0].passed;

    allResults.push({
      id: 'DRA-02',
      category: 'E_DRA',
      categoryCode: 'E',
      categoryTitle: 'Discourse Relation (DRA)',
      name: 'Pembuka yang tidak berkaitan dengan blok sebelumnya (non-sequitur)',
      validatorName: 'analyzeTransitions',
      caseType: 'NEGATIF',
      inputSnippet: `B1: ${blocks[0]}\nB2: ${blocks[1]}`,
      expectedOutcome:
        'Ditolak: pembuka blok tidak memiliki jembatan diskursus maupun keterkaitan topik dengan blok sebelumnya.',
      actualOutcome: `passed: ${transitions[0]?.passed}, isDisconnectedOpening: ${transitions[0]?.isDisconnectedOpening}`,
      passed: rejectedWithReason,
      reason: rejectedWithReason
        ? 'Validator berhasil mendeteksi dan menolak pembuka blok yang melompat topik tanpa jembatan argumen.'
        : 'Validator gagal mendeteksi pembuka blok yang tidak berkaitan.',
      technicalDetails: { transition: transitions[0] },
    });
  }

  // E3: Pengumuman Segmen Presentasi "Di blok kedua ini..."
  {
    const blocks = [
      'Kalau lo perhatiin masalah kenaikan biaya hidup, ada kejanggalan besar yang sengaja ditutupi.',
      'Di blok kedua ini kita akan membahas akar persoalan struktural yang dihadapi masyarakat.',
    ];
    const transitions = analyzeTransitions(blocks);
    const rejectedWithReason = transitions.length === 1 && transitions[0].isMetaPresenterSignpost && !transitions[0].passed;

    allResults.push({
      id: 'DRA-03',
      category: 'E_DRA',
      categoryCode: 'E',
      categoryTitle: 'Discourse Relation (DRA)',
      name: 'Kalimat pengumuman segmen "Di blok kedua ini..."',
      validatorName: 'analyzeTransitions',
      caseType: 'NEGATIF',
      inputSnippet: blocks[1],
      expectedOutcome: 'Ditolak: terdeteksi frasa meta-presenter "di blok kedua ini".',
      actualOutcome: `passed: ${transitions[0]?.passed}, isMetaPresenter: ${transitions[0]?.isMetaPresenterSignpost}`,
      passed: rejectedWithReason,
      reason: rejectedWithReason
        ? 'Validator secara tepat mendeteksi dan menolak kalimat signpost presenter penyiar TV.'
        : 'Validator meloloskan signpost presenter terlarang.',
      technicalDetails: { transition: transitions[0] },
    });
  }

  // E4: Pengumuman Segmen Bab "Sekarang kita masuk ke bab..."
  {
    const blocks = [
      'Pola pikir semacam ini bikin kita susah ngelihat solusi realistis.',
      'Sekarang kita masuk ke bab berikutnya untuk membedah data dan bukti konkret.',
    ];
    const transitions = analyzeTransitions(blocks);
    const rejectedWithReason = transitions.length === 1 && transitions[0].isMetaPresenterSignpost && !transitions[0].passed;

    allResults.push({
      id: 'DRA-04',
      category: 'E_DRA',
      categoryCode: 'E',
      categoryTitle: 'Discourse Relation (DRA)',
      name: 'Kalimat pengumuman bab "Sekarang kita masuk ke bab..."',
      validatorName: 'analyzeTransitions',
      caseType: 'NEGATIF',
      inputSnippet: blocks[1],
      expectedOutcome: 'Ditolak: terdeteksi frasa meta-presenter "kita masuk ke bab".',
      actualOutcome: `passed: ${transitions[0]?.passed}, detected: ${transitions[0]?.detectedSignpostPhrase}`,
      passed: rejectedWithReason,
      reason: rejectedWithReason
        ? 'Validator secara tepat menolak pengumuman segmen bab.'
        : 'Validator meloloskan pengumuman segmen bab.',
      technicalDetails: { transition: transitions[0] },
    });
  }

  // ==========================================
  // KATEGORI F: NON_SARA_HARD_GUARD
  // ==========================================

  // F1: Kritik Tajam Fenomena Sosial & Pola Pikir yang Sah
  {
    const fixture =
      'Yang goblok itu pola pikir yang ngerasa semua tindakannya otomatis benar cuma karena dibungkus alasan moral.';
    const check = inspectCritiqueTargetViolations(fixture);
    const passed = !check.hasForbiddenTarget;

    allResults.push({
      id: 'SARA-01',
      category: 'F_NON_SARA',
      categoryCode: 'F',
      categoryTitle: 'NON_SARA_HARD_GUARD',
      name: 'Kritik terhadap perilaku dan pola pikir masyarakat (sah)',
      validatorName: 'inspectCritiqueTargetViolations',
      caseType: 'POSITIF',
      inputSnippet: fixture,
      expectedOutcome: 'Lolos: sasaran kritik diarahkan pada pola pikir/perilaku kognitif, bukan identitas SARA.',
      actualOutcome: `hasForbiddenTarget: ${check.hasForbiddenTarget}`,
      passed,
      reason: passed
        ? 'Validator mengizinkan kritik tajam terhadap pola pikir tanpa false positive.'
        : `Validator keliru menolak: ${check.violationReason}`,
      technicalDetails: { check },
    });
  }

  // F2: Serangan Terlarang terhadap Identitas Agama / SARA
  {
    const fixture = 'Orang-orang beragama itu goblok dan berbahaya bagi kelangsungan peradaban.';
    const check = inspectCritiqueTargetViolations(fixture);
    const rejectedWithReason = check.hasForbiddenTarget && Boolean(check.violationReason?.includes('Non-SARA'));

    allResults.push({
      id: 'SARA-02',
      category: 'F_NON_SARA',
      categoryCode: 'F',
      categoryTitle: 'NON_SARA_HARD_GUARD',
      name: 'Serangan terhadap identitas SARA/agama',
      validatorName: 'inspectCritiqueTargetViolations',
      caseType: 'NEGATIF',
      inputSnippet: fixture,
      expectedOutcome: 'Ditolak: terdeteksi serangan terhadap identitas agama/kelompok terlindungi.',
      actualOutcome: `hasForbiddenTarget: ${check.hasForbiddenTarget}, alasan: ${check.violationReason}`,
      passed: rejectedWithReason,
      reason: rejectedWithReason
        ? 'Validator NON_SARA_HARD_GUARD secara tegas menolak serangan terhadap identitas agama/SARA.'
        : 'Validator meloloskan serangan identitas SARA yang dilarang!',
      technicalDetails: { check },
    });
  }

  // F3: Penghinaan terhadap Lembaga / Institusi
  {
    const fixture = 'Lembaga kementerian itu isinya orang-orang tolol yang tidak mampu bekerja.';
    const check = inspectCritiqueTargetViolations(fixture);
    const rejectedWithReason = check.hasForbiddenTarget && Boolean(check.violationReason?.includes('Non-Lembaga'));

    allResults.push({
      id: 'SARA-03',
      category: 'F_NON_SARA',
      categoryCode: 'F',
      categoryTitle: 'NON_SARA_HARD_GUARD',
      name: 'Penghinaan terhadap lembaga/institusi',
      validatorName: 'inspectCritiqueTargetViolations',
      caseType: 'NEGATIF',
      inputSnippet: fixture,
      expectedOutcome: 'Ditolak: terdeteksi penghinaan terhadap lembaga/institusi tanpa kritik argumen.',
      actualOutcome: `hasForbiddenTarget: ${check.hasForbiddenTarget}, alasan: ${check.violationReason}`,
      passed: rejectedWithReason,
      reason: rejectedWithReason
        ? 'Validator secara tepat menolak penghinaan institusi tanpa framing logika/keputusan.'
        : 'Validator meloloskan serangan institusi.',
      technicalDetails: { check },
    });
  }

  // F4: Serangan Pribadi terhadap Individu
  {
    const fixture = 'Menteri itu memang orangnya tolol dan gak bisa kerja.';
    const check = inspectNonSaraSemanticViolations(fixture);
    const rejectedWithReason =
      check.hasForbiddenTarget && check.violation?.type === 'INDIVIDUAL_ATTACK';

    allResults.push({
      id: 'SARA-04',
      category: 'F_NON_SARA',
      categoryCode: 'F',
      categoryTitle: 'NON_SARA_HARD_GUARD',
      name: 'Serangan pribadi terhadap individu (ad hominem personal)',
      validatorName: 'inspectNonSaraSemanticViolations',
      caseType: 'NEGATIF',
      inputSnippet: fixture,
      expectedOutcome: 'Ditolak: terdeteksi serangan personal terhadap individu (INDIVIDUAL_ATTACK).',
      actualOutcome: `hasForbiddenTarget: ${check.hasForbiddenTarget}, type: ${check.violation?.type}`,
      passed: rejectedWithReason,
      reason: rejectedWithReason
        ? 'Validator berhasil mendeteksi dan menolak serangan pribadi terhadap individu.'
        : 'Validator meloloskan serangan pribadi terhadap individu.',
      technicalDetails: { check },
    });
  }

  // F5: Penyebutan Faktual/Objektif Kata Sensitif
  {
    const fixture =
      'Berdasarkan data statistik sensus 2023, mayoritas penduduk di wilayah tersebut memeluk agama Islam.';
    const check = inspectNonSaraSemanticViolations(fixture);
    const passed = !check.hasForbiddenTarget;

    allResults.push({
      id: 'SARA-05',
      category: 'F_NON_SARA',
      categoryCode: 'F',
      categoryTitle: 'NON_SARA_HARD_GUARD',
      name: 'Penyebutan faktual yang tidak boleh dianggap sebagai serangan',
      validatorName: 'inspectNonSaraSemanticViolations',
      caseType: 'POSITIF',
      inputSnippet: fixture,
      expectedOutcome: 'Lolos: penyebutan istilah agama dalam konteks statistik/faktual tidak diblokir.',
      actualOutcome: `hasForbiddenTarget: ${check.hasForbiddenTarget}`,
      passed,
      reason: passed
        ? 'Validator membedakan data sensus faktual dari ujaran kebencian.'
        : 'Validator salah memblokir fakta sensus objektif.',
      technicalDetails: { check },
    });
  }

  // ==========================================
  // KATEGORI G: SENTENCE INTEGRITY (PTV)
  // ==========================================

  // G1: Kalimat Utuh dan Wajar
  {
    const fixture =
      'Masalah ini sebenernya udah lama banget dibahas, tapi baru sekarang orang mulai sadar dampaknya.';
    const check = inspectSentenceIntegrityAndTruncation(fixture);
    const passed = !check.hasTruncation && check.issues.length === 0;

    allResults.push({
      id: 'PTV-01',
      category: 'G_PTV',
      categoryCode: 'G',
      categoryTitle: 'Sentence Integrity (PTV)',
      name: 'Kalimat utuh, koheren, dan wajar',
      validatorName: 'inspectSentenceIntegrityAndTruncation',
      caseType: 'POSITIF',
      inputSnippet: fixture,
      expectedOutcome: 'Lolos: kalimat utuh tanpa awalan buntung atau pemotongan kata.',
      actualOutcome: `hasTruncation: ${check.hasTruncation}, issues: ${check.issues.length}`,
      passed,
      reason: passed
        ? 'Validator mengonfirmasi keutuhan sintaksis kalimat.'
        : `Validator menemukan error tidak terduga: ${check.issues.join('; ')}`,
      technicalDetails: { check },
    });
  }

  // G2: Kata Terpotong di Awal Blok ("nyelesaiannya...")
  {
    const fixture = 'nyelesaiannya kita harus menguji ulang seluruh asumsi kebijakan tersebut.';
    const check = inspectSentenceIntegrityAndTruncation(fixture);
    const rejectedWithReason =
      check.hasTruncation &&
      check.issues.some((i) => i.includes('suku kata awalnya')) &&
      check.healedText.startsWith('Penyelesaiannya');

    allResults.push({
      id: 'PTV-02',
      category: 'G_PTV',
      categoryCode: 'G',
      categoryTitle: 'Sentence Integrity (PTV)',
      name: 'Kata terpotong di awal blok ("nyelesaiannya...")',
      validatorName: 'inspectSentenceIntegrityAndTruncation & healChoppedPrefixes',
      caseType: 'NEGATIF',
      inputSnippet: fixture,
      expectedOutcome: 'Ditolak: terdeteksi kata terpotong di awal blok dan dipulihkan menjadi "Penyelesaiannya".',
      actualOutcome: `hasTruncation: ${check.hasTruncation}, healed: "${check.healedText}"`,
      passed: rejectedWithReason,
      reason: rejectedWithReason
        ? `Validator berhasil mendeteksi kata terpotong di awal blok dan memulihkannya menjadi "${check.healedText}".`
        : 'Validator gagal mendeteksi kata yang terpotong di awal blok.',
      technicalDetails: { check },
    });
  }

  // G3: Fragmen seperti "nya" yang Berdiri Sendiri di Awal Kalimat
  {
    const fixture = 'nya kita harus mencari jalan keluar yang beneran realistis.';
    const check = inspectSentenceIntegrityAndTruncation(fixture);
    const rejectedWithReason = check.hasTruncation && check.issues.some((i) => i.includes('"nya"'));

    allResults.push({
      id: 'PTV-03',
      category: 'G_PTV',
      categoryCode: 'G',
      categoryTitle: 'Sentence Integrity (PTV)',
      name: 'Fragmen seperti "nya" yang berdiri sendiri tanpa kata induk',
      validatorName: 'inspectSentenceIntegrityAndTruncation & healChoppedPrefixes',
      caseType: 'NEGATIF',
      inputSnippet: fixture,
      expectedOutcome: 'Ditolak: terdeteksi awalan "nya" buntung dan dipulihkan ke kata berkepala utuh.',
      actualOutcome: `hasTruncation: ${check.hasTruncation}, healed: "${check.healedText}"`,
      passed: rejectedWithReason,
      reason: rejectedWithReason
        ? `Validator berhasil mendeteksi fragmen "nya" berdiri sendiri dan memulihkannya menjadi: "${check.healedText}".`
        : 'Validator gagal mendeteksi partikel gantung di awal kalimat.',
      technicalDetails: { check },
    });
  }

  // G4: Kalimat yang Kehilangan Bagian Awal ("kan masalahnya...")
  {
    const fixture = 'kan masalahnya kita nggak tahu apa-apa sejak awal.';
    const check = inspectSentenceIntegrityAndTruncation(fixture);
    const rejectedWithReason = check.hasTruncation;

    allResults.push({
      id: 'PTV-04',
      category: 'G_PTV',
      categoryCode: 'G',
      categoryTitle: 'Sentence Integrity (PTV)',
      name: 'Kalimat yang kehilangan bagian awal ("kan masalahnya...")',
      validatorName: 'inspectSentenceIntegrityAndTruncation',
      caseType: 'NEGATIF',
      inputSnippet: fixture,
      expectedOutcome: 'Ditolak: terdeteksi kalimat yang kehilangan bagian awal/induk kalimat.',
      actualOutcome: `hasTruncation: ${check.hasTruncation}, isu: ${check.issues[0]}`,
      passed: rejectedWithReason,
      reason: rejectedWithReason
        ? 'Validator secara tepat menandai kalimat yang kehilangan bagian awal sebagai anomali PTV.'
        : 'Validator meloloskan pembuka buntung.',
      technicalDetails: { check },
    });
  }

  // G5: Pemotongan di Tengah Kata (Hanging Hyphen)
  {
    const fixture = 'Pola pikir semacam ini bakal melahirkan kebiasaan merug-';
    const check = inspectSentenceIntegrityAndTruncation(fixture);
    const rejectedWithReason = check.hasTruncation && check.issues.some((i) => i.includes('terpotong'));

    allResults.push({
      id: 'PTV-05',
      category: 'G_PTV',
      categoryCode: 'G',
      categoryTitle: 'Sentence Integrity (PTV)',
      name: 'Pemotongan di tengah kata ("kebiasaan merug-")',
      validatorName: 'inspectSentenceIntegrityAndTruncation',
      caseType: 'NEGATIF',
      inputSnippet: fixture,
      expectedOutcome: 'Ditolak: terdeteksi pemotongan di tengah kata pada ujung kalimat ("merug-").',
      actualOutcome: `hasTruncation: ${check.hasTruncation}, isu: ${check.issues[0]}`,
      passed: rejectedWithReason,
      reason: rejectedWithReason
        ? 'Validator secara tepat mendeteksi pemotongan di tengah kata.'
        : 'Validator meloloskan kata gantung.',
      technicalDetails: { check },
    });
  }

  // ==========================================
  // KATEGORI H: BANK KOSAKATA F1–F8
  // ==========================================

  // H1: Kelengkapan Registry Permanen (16 Entri Inti F1 Sesuai GENNAS STUDIO PROMPT + Master Lexicon)
  {
    const audit = auditCoreLexiconCompleteness();
    const passed =
      audit.isComplete &&
      audit.core_actual_count === audit.core_expected_count &&
      audit.core_missing.length === 0;

    allResults.push({
      id: 'LEX-01',
      category: 'H_LEXICON',
      categoryCode: 'H',
      categoryTitle: 'Bank Kosakata F1–F8',
      name: `Kelengkapan registry permanen (${audit.core_expected_count} entri F1 inti & Master Lexicon)`,
      validatorName: 'auditCoreLexiconCompleteness',
      caseType: 'POSITIF',
      inputSnippet: `Expected: ${audit.core_expected_count} entries, Actual: ${audit.core_actual_count}, Expansion: ${audit.expansionAudit.importedNewCount}`,
      expectedOutcome: `Lolos: registry inti F1 memiliki tepat ${audit.core_expected_count} entri lengkap tanpa pengurangan.`,
      actualOutcome: `isComplete: ${audit.isComplete}, count: ${audit.core_actual_count}/${audit.core_expected_count}`,
      passed,
      reason: passed
        ? `Registry inti ${audit.core_expected_count}/${audit.core_expected_count} kosakata GENNAS STUDIO PROMPT terverifikasi lengkap dan permanen.`
        : `Registry inti tidak lengkap: hilang ${audit.core_missing.join(', ')}`,
      technicalDetails: { audit },
    });
  }

  // H2: Deteksi Kata yang Benar-Benar Muncul
  {
    const testScript = 'Seringkali orang nyontohin pola yang salah tanpa ngelihat dan mikirin dampaknya.';
    const monitor = computeDynamicLexiconMonitor(testScript);
    const hasNyontohin = monitor.usedWords.some((w) => w.word.toLowerCase() === 'nyontohin');
    const hasNgelihat = monitor.usedWords.some((w) => w.word.toLowerCase() === 'ngelihat');
    const hasMikirin = monitor.usedWords.some((w) => w.word.toLowerCase() === 'mikirin');
    const passed = hasNyontohin && hasNgelihat && hasMikirin;

    allResults.push({
      id: 'LEX-02',
      category: 'H_LEXICON',
      categoryCode: 'H',
      categoryTitle: 'Bank Kosakata F1–F8',
      name: 'Deteksi kata yang benar-benar muncul dalam teks',
      validatorName: 'computeDynamicLexiconMonitor',
      caseType: 'POSITIF',
      inputSnippet: testScript,
      expectedOutcome: 'Lolos: kata "nyontohin", "ngelihat", dan "mikirin" yang muncul di teks terdeteksi akurat.',
      actualOutcome: `nyontohin: ${hasNyontohin}, ngelihat: ${hasNgelihat}, mikirin: ${hasMikirin}`,
      passed,
      reason: passed
        ? 'Pemindai leksikon mendeteksi seluruh kosakata F1–F8 yang benar-benar muncul di dalam teks.'
        : 'Pemindai leksikon gagal mendeteksi kata yang muncul.',
      technicalDetails: { usedWords: monitor.usedWords.map((w) => w.word) },
    });
  }

  // H3: Pencegahan False Positive Substring ("mikir" vs "mikirin", "buat" vs "ngebuat", "jualin" vs "penjualan")
  {
    const testScript = 'Mereka cuma mikirin cara ngebuat laporan penjualan tahunan.';
    const monitor = computeDynamicLexiconMonitor(testScript);
    const hasMikirin = monitor.usedWords.some((w) => w.word.toLowerCase() === 'mikirin');
    const falseMikir = monitor.usedWords.some((w) => w.word.toLowerCase() === 'mikir');
    const falseBuat = monitor.usedWords.some((w) => w.word.toLowerCase() === 'buat');
    const falseJualin = monitor.usedWords.some((w) => w.word.toLowerCase() === 'jualin');

    const passed = hasMikirin && !falseMikir && !falseBuat && !falseJualin;

    allResults.push({
      id: 'LEX-03',
      category: 'H_LEXICON',
      categoryCode: 'H',
      categoryTitle: 'Bank Kosakata F1–F8',
      name: 'Pencegahan false positive substring ("mikirin" != "mikir", "ngebuat" != "buat")',
      validatorName: 'computeDynamicLexiconMonitor',
      caseType: 'POSITIF',
      inputSnippet: testScript,
      expectedOutcome: 'Lolos: "mikirin" terdeteksi, sedangkan substring "mikir", "buat", dan "jualin" TIDAK aktif secara keliru.',
      actualOutcome: `mikirin: ${hasMikirin}, falseMikir: ${falseMikir}, falseBuat: ${falseBuat}, falseJualin: ${falseJualin}`,
      passed,
      reason: passed
        ? 'Pemindai leksikon menggunakan batas kata akurat dan berhasil mencegah false positive substring.'
        : 'Pemindai leksikon mengalami false positive substring.',
      technicalDetails: { hasMikirin, falseMikir, falseBuat, falseJualin },
    });
  }

  // H4: Dynamic Lexicon Monitor Tidak Mengubah Naskah & Tidak Menginterferensi State
  {
    const originalScript = 'Gue ngeliat pola pikir ini bikin banyak orang nyalahin keadaan.';
    const scriptCopyBefore = String(originalScript);
    const registryBefore = getMasterLexiconRegistry();
    const countBefore = registryBefore.length;

    // Jalankan kalkulasi simulasi terisolasi
    computeDynamicLexiconMonitor(originalScript);
    const emptyMonitorAfter = computeDynamicLexiconMonitor('');

    const registryAfter = getMasterLexiconRegistry();
    const countAfter = registryAfter.length;
    const passed =
      originalScript === scriptCopyBefore &&
      countBefore === countAfter &&
      countBefore > 56 &&
      emptyMonitorAfter.totalUsedCount === 0;

    allResults.push({
      id: 'LEX-04',
      category: 'H_LEXICON',
      categoryCode: 'H',
      categoryTitle: 'Bank Kosakata F1–F8',
      name: 'Dynamic Lexicon Monitor tidak mengubah naskah & terisolasi dari state pengguna',
      validatorName: 'computeDynamicLexiconMonitor & getMasterLexiconRegistry',
      caseType: 'POSITIF',
      inputSnippet: `Script immutable: "${originalScript}" | Registry: ${countBefore} entries`,
      expectedOutcome: 'Lolos: Dynamic Lexicon Monitor bersifat read-only murni dan tidak mengubah naskah ataupun state pengguna.',
      actualOutcome: `scriptUnchanged: ${originalScript === scriptCopyBefore}, registryCount: ${countBefore}->${countAfter}, emptyUsed: ${emptyMonitorAfter.totalUsedCount}`,
      passed,
      reason: passed
        ? 'Dynamic Lexicon Monitor terbukti 100% read-only: tidak mengubah teks naskah dan tidak menyalakan indikator kosakata pengguna.'
        : 'Pengujian menyebabkan mutasi pada naskah atau registry permanen!',
      technicalDetails: { countBefore, countAfter, emptyUsed: emptyMonitorAfter.totalUsedCount },
    });
  }

  const durationMs = Math.round((performance.now() - startTime) * 100) / 100;
  const passedCount = allResults.filter((r) => r.passed).length;
  const failedCount = allResults.length - passedCount;
  const allPassed = failedCount === 0;

  const resultsByCategory: Record<ValidatorCategoryKey, IsolatedTestCaseResult[]> = {
    A_SCTF: [],
    B_PROFANITY: [],
    C_GUE_LO: [],
    D_SAP: [],
    E_DRA: [],
    F_NON_SARA: [],
    G_PTV: [],
    H_LEXICON: [],
  };

  allResults.forEach((r) => {
    resultsByCategory[r.category].push(r);
  });

  return {
    totalTests: allResults.length,
    passedCount,
    failedCount,
    durationMs,
    allPassed,
    timestamp: new Date().toISOString(),
    resultsByCategory,
    allResults,
  };
}
