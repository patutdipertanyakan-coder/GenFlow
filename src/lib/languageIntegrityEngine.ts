/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * =========================================================================
 * ENGINE KONTROL BAHASA, KEMURNIAN NARASI, DAN VALIDASI OUTPUT GENFLOW
 * =========================================================================
 *
 * Menerapkan empat kebijakan mutlak:
 * 1. KEBIJAKAN KEMURNIAN BAHASA INDONESIA:
 *    - Menghilangkan kosakata bahasa asing yang tidak diperlukan (mis. mastery -> penguasaan).
 *    - Mengalihkan singkatan bahasa Inggris dan nama lembaga ke penamaan bahasa Indonesia
 *      dalam narasi lisan (mis. WHO -> Organisasi Kesehatan Dunia, World Bank -> Bank Dunia,
 *      BTW -> Ngomong-ngomong, FYI -> Sebagai informasi).
 * 2. LARANGAN MUTLAK KEBOCORAN MARKER DAN METADATA INTERNAL:
 *    - Menghapus [GENFLOW_DOCUMENT_START] dan marker sejenis bahkan jika berada di tengah kalimat,
 *      tanpa menghilangkan substansi kalimat di sekitarnya.
 * 3. LARANGAN MENYEBUT NAMA PENELITI DAN TIM PENELITIAN DALAM NARASI FINAL:
 *    - Meleburkan atribusi seperti "Greig Inglis dan timnya pada 14 Desember 2022 menemukan bahwa..."
 *      menjadi narasi substantif "Hasil penelitian menunjukkan bahwa..." dengan menjaga 100% fakta,
 *      angka, dan kesimpulan.
 * 4. KONTROL MORFOLOGI KOSAKATA INFORMAL:
 *    - Mencegah dan memperbaiki pemaksaan kata informal yang cacat (mis. "mrediksi" -> "memprediksi")
 *      sambil mempertahankan kosakata informal yang alami (ngeliat, nyalahin, ngomong, dll.).
 */

export interface LanguageIntegrityAuditResult {
  passed: boolean;
  status: 'KEMURNIAN BAHASA LULUS' | 'KEMURNIAN BAHASA PERLU PERBAIKAN';
  foreignWordsDetected: string[];
  oralAcronymsDetected: string[];
  leakedMarkersDetected: string[];
  researcherAttributionsDetected: string[];
  invalidMorphologyDetected: string[];
  findings: string[];
  summary: string;
}

// -------------------------------------------------------------------------
// 1. KAMUS PADANAN KOSAKATA ASING -> BAHASA INDONESIA
// -------------------------------------------------------------------------
export const FOREIGN_WORD_DICTIONARY: Record<string, string> = {
  mastery: 'penguasaan',
  awareness: 'kesadaran',
  mindset: 'pola pikir',
  behavior: 'perilaku',
  accountability: 'pertanggungjawaban',
  engagement: 'keterlibatan',
  impact: 'dampak',
  challenge: 'tantangan',
  insight: 'wawasan',
  framework: 'kerangka kerja',
  guideline: 'panduan',
  guidelines: 'panduan',
  timeline: 'linimasa',
  milestone: 'tonggak capaian',
  feedback: 'umpan balik',
  stakeholder: 'pemangku kepentingan',
  stakeholders: 'para pemangku kepentingan',
  opportunity: 'peluang',
  output: 'keluaran',
  outcome: 'hasil akhir',
  effort: 'upaya',
  value: 'nilai',
  goal: 'tujuan',
  budget: 'anggaran',
  struggle: 'perjuangan',
  struggling: 'kesulitan',
  struggles: 'kesulitan',
  shifting: 'pergeseran',
  flexibility: 'fleksibilitas',
  sustainability: 'keberlanjutan',
  urgency: 'kegentingan',
  leverage: 'daya ungkit',
  trigger: 'pemicu',
  triggers: 'pemicu',
  solution: 'solusi',
  gap: 'kesenjangan',
  issue: 'persoalan',
};

// -------------------------------------------------------------------------
// 2. KAMUS NAMA LEMBAGA & SINGKATAN ASING DALAM NARASI LISAN
// -------------------------------------------------------------------------
export const ORAL_ACRONYM_DICTIONARY: Record<string, string> = {
  WHO: 'Organisasi Kesehatan Dunia',
  UNESCO: 'Organisasi Pendidikan, Keilmuan, dan Kebudayaan PBB',
  UNICEF: 'Dana Anak-Anak PBB',
  FAO: 'Organisasi Pangan dan Pertanian PBB',
  IMF: 'Dana Moneter Internasional',
  'World Bank': 'Bank Dunia',
  'WORLD BANK': 'Bank Dunia',
  'world bank': 'Bank Dunia',
  WTO: 'Organisasi Perdagangan Dunia',
  NATO: 'Pakta Pertahanan Atlantik Utara',
  BTW: 'Ngomong-ngomong',
  btw: 'ngomong-ngomong',
  FYI: 'Sebagai informasi',
  fyi: 'sebagai informasi',
  ASAP: 'secepatnya',
  asap: 'secepatnya',
  COD: 'bayar di tempat',
  cod: 'bayar di tempat',
};

// -------------------------------------------------------------------------
// 3. MORFOLOGI INFORMAL CACAT & NORMALISASI
// -------------------------------------------------------------------------
export const INVALID_INFORMAL_MORPHOLOGY_MAP: Record<string, string> = {
  mrediksi: 'memprediksi',
  mperkirakan: 'memperkirakan',
  mperbaiki: 'memperbaiki',
  mrencanakan: 'merencanakan',
  mnganalisis: 'menganalisis',
  mngurangi: 'mengurangi',
  mnganggap: 'menganggap',
  mngingat: 'mengingat',
  mngabaikan: 'mengabaikan',
  mnyalahkan: 'menyalahkan',
  mnyelesaikan: 'menyelesaikan',
  mngatakan: 'mengatakan',
  mngambil: 'mengambil',
  mngembangkan: 'mengembangkan',
  mnghasilkan: 'menghasilkan',
  mngajak: 'mengajak',
  mngerti: 'ngerti',
  mproses: 'memproses',
  mprogram: 'memprogram',
  mproduksi: 'memproduksi',
  mprotes: 'memprotes',
  mpromosikan: 'mempromosikan',
  mpersiapkan: 'mempersiapkan',
  mpengaruhi: 'mempengaruhi',
  mperingatkan: 'memperingatkan',
  mpertahankan: 'mempertahankan',
  mpertanyakan: 'mempertanyakan',
  mperlakukan: 'memperlakukan',
  mperhatikan: 'memperhatikan',
  mperjelas: 'memperjelas',
  mperluas: 'memperluas',
  mpermudah: 'mempermudah',
  mperberat: 'memperberat',
  mpercepat: 'mempercepat',
  mperlambat: 'memperlambat',
};

/**
 * Mempertahankan huruf kapital jika kata asli diawali huruf kapital.
 */
function preserveCapitalization(original: string, replacement: string): string {
  if (!original || !replacement) return replacement;
  if (original[0] === original[0].toUpperCase() && original[0] !== original[0].toLowerCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement.toLowerCase();
}

/**
 * 1. PEMBERSIHAN KEBOCORAN MARKER DAN METADATA INTERNAL
 * Menghilangkan [GENFLOW_DOCUMENT_START] dan marker serupa secara mulus dari tengah kalimat
 * tanpa menghapus substansi di sekitarnya.
 */
export function eliminateInternalMarkers(text: string): string {
  if (!text || typeof text !== 'string') return '';

  return text
    // Hapus marker GENFLOW_DOCUMENT_START, GENFLOW_DOCUMENT_END, dan varian dokumen
    .replace(/\s*\[(?:GENFLOW|DOCUMENT)_[A-Z0-9_]+\]\s*/gi, ' ')
    // Hapus marker komponen GF-[...]
    .replace(/\s*\[GF-[0-9A-Z_-]+\]\s*/gi, ' ')
    // Hapus tag teknis internal bersiku
    .replace(/\s*\[(?:MASTER_FRAMEWORK|DATA_GROUNDING|KONTRAK_[A-Z_]+|OPERASI_[A-Z_]+)[^\]]*\]\s*/gi, ' ')
    // Rapikan spasi ganda
    .replace(/[ \t]{2,}/g, ' ')
    // Rapikan spasi di depan tanda baca
    .replace(/\s+([.,;:!?])/g, '$1')
    // Rapikan awal dan akhir baris
    .split('\n')
    .map((l) => l.trim())
    .join('\n');
}

/**
 * 2. PELEBURAN ATRIBUSI NAMA PENELITI & TIM RISET
 * Meleburkan atribusi seperti "Greig Inglis dan timnya pada 14 Desember 2022 menemukan bahwa..."
 * menjadi "Hasil penelitian menunjukkan bahwa..." dengan menjaga 100% fakta substantif.
 */
export function dissolveResearcherAttributions(text: string): string {
  if (!text || typeof text !== 'string') return '';

  let cleaned = text;

  // Pola 1: "[Nama Peneliti] dan timnya (pada [Tanggal/Tahun]) menemukan/menunjukkan bahwa..."
  // Contoh: "Greig Inglis dan timnya pada 14 Desember 2022 menemukan bahwa..."
  cleaned = cleaned.replace(
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s+(?:dan|bersama)\s+(?:tim(?:nya)?|kolega(?:nya)?)\s*(?:,\s*)?(?:pada\s+\d{1,2}\s+[A-Za-z]+\s+\d{4}\s+|pada\s+tahun\s+\d{4}\s+|\(\d{4}\)\s+)?(?:menemukan|menyimpulkan|mengungkapkan|membuktikan|menunjukkan|mencatat)\s+bahwa\b/gi,
    (match) => {
      const isStart = /^[A-Z]/.test(match);
      return isStart ? 'Hasil penelitian menunjukkan bahwa' : 'hasil penelitian menunjukkan bahwa';
    }
  );

  // Pola 2: "[Nama Peneliti] dkk. / et al. (pada [Tanggal/Tahun]) menemukan bahwa..."
  cleaned = cleaned.replace(
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s+(?:dkk\.?|et\s+al\.?)\s*(?:,\s*)?(?:pada\s+\d{1,2}\s+[A-Za-z]+\s+\d{4}\s+|pada\s+tahun\s+\d{4}\s+|\(\d{4}\)\s+)?(?:menemukan|menyimpulkan|mengungkapkan|membuktikan|menunjukkan|mencatat)\s+bahwa\b/gi,
    (match) => {
      const isStart = /^[A-Z]/.test(match);
      return isStart ? 'Temuan tersebut memperlihatkan bahwa' : 'temuan tersebut memperlihatkan bahwa';
    }
  );

  // Pola 3: "Menurut [peneliti] [Nama] (dan timnya) ([Tahun]), ..."
  cleaned = cleaned.replace(
    /\b(?:Menurut|Berdasarkan)\s+(?:peneliti\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s*(?:dan\s+tim(?:nya)?|dkk\.?|et\s+al\.?)?\s*(?:\([^)]*\)|pada\s+tahun\s+\d{4}|\(\d{4}\)|\d{4})?\s*,\s*/gi,
    (match) => {
      const isStart = /^[A-Z]/.test(match);
      return isStart ? 'Hasil penelitian menunjukkan bahwa ' : 'hasil penelitian menunjukkan bahwa ';
    }
  );

  // Pola 4: "Studi/penelitian oleh [Nama Peneliti] (dan timnya) menemukan/menunjukkan bahwa..."
  cleaned = cleaned.replace(
    /\b(?:studi|penelitian|riset)\s+(?:yang\s+dilakukan\s+oleh|oleh)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s*(?:dan\s+tim(?:nya)?|dkk\.?|et\s+al\.?)?\s*(?:pada\s+tahun\s+\d{4}|\(\d{4}\)|\d{4})?\s*(?:menemukan|menunjukkan|membuktikan|mengungkapkan)\s+bahwa\b/gi,
    (match) => {
      const isStart = /^[A-Z]/.test(match);
      return isStart ? 'Sejumlah hasil penelitian mengungkapkan bahwa' : 'sejumlah hasil penelitian mengungkapkan bahwa';
    }
  );

  // Pola 5: "[Nama Peneliti] pada [Tanggal/Tahun] menemukan bahwa..."
  cleaned = cleaned.replace(
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\s+(?:pada\s+\d{1,2}\s+[A-Za-z]+\s+\d{4}\s+|pada\s+tahun\s+\d{4}\s+|\(\d{4}\)\s+)(?:menemukan|menyimpulkan|mengungkapkan|membuktikan|menunjukkan)\s+bahwa\b/gi,
    (match) => {
      const isStart = /^[A-Z]/.test(match);
      return isStart ? 'Hasil penelitian menunjukkan bahwa' : 'hasil penelitian menunjukkan bahwa';
    }
  );

  // Rapikan spasi dan tanda baca
  return cleaned
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim();
}

/**
 * 3. PENGGANTIAN KOSAKATA ASING & PENGALIHAN SINGKATAN LEMBAGA KE BAHASA INDONESIA
 */
export function replaceForeignWordsAndAcronyms(text: string): string {
  if (!text || typeof text !== 'string') return '';

  let processed = text;

  // 1. Ganti singkatan lembaga & percakapan
  // Periksa frasa spesifik lebih panjang terlebih dahulu (mis. "World Bank")
  for (const [acronym, indoName] of Object.entries(ORAL_ACRONYM_DICTIONARY)) {
    const escaped = acronym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'g');
    processed = processed.replace(regex, (match) => {
      if (acronym.toLowerCase() === 'btw' || acronym.toLowerCase() === 'fyi') {
        return preserveCapitalization(match, indoName);
      }
      return indoName;
    });
  }

  // 2. Ganti kosakata asing yang tidak diperlukan
  for (const [foreign, indoEquivalent] of Object.entries(FOREIGN_WORD_DICTIONARY)) {
    const regex = new RegExp(`\\b${foreign}\\b`, 'gi');
    processed = processed.replace(regex, (match) => {
      return preserveCapitalization(match, indoEquivalent);
    });
  }

  return processed;
}

/**
 * 4. KONTROL MORFOLOGI KOSAKATA INFORMAL
 * Memperbaiki bentukan kata informal yang tidak sesuai kaidah (mis. "mrediksi" -> "memprediksi")
 * tanpa merusak kata informal alami ("ngeliat", "nyalahin", "ngomong", "mikir", dll.).
 */
export function normalizeInformalMorphology(text: string): string {
  if (!text || typeof text !== 'string') return '';

  let processed = text;

  // 1. Cek kamus bentuk cacat spesifik
  for (const [invalid, corrected] of Object.entries(INVALID_INFORMAL_MORPHOLOGY_MAP)) {
    const regex = new RegExp(`\\b${invalid}\\b`, 'gi');
    processed = processed.replace(regex, (match) => {
      return preserveCapitalization(match, corrected);
    });
  }

  // 2. Koreksi pola algoritmik awalan "m" + konsonan ganda tidak wajar
  // Bahasa Indonesia tidak mengenal awalan kata dengan gugus konsonan seperti "mr-", "mp-", "mng-", "mny-"
  // kecuali merupakan kerusakan pemenggalan awalan me- / mem- / meng-
  processed = processed.replace(
    /\b[Mm]r([a-z]{4,})\b/g,
    (match, stem) => {
      const isCap = match[0] === match[0].toUpperCase();
      const fixed = `mer${stem}`;
      return isCap ? fixed.charAt(0).toUpperCase() + fixed.slice(1) : fixed;
    }
  );

  processed = processed.replace(
    /\b[Mm]p([a-z]{4,})\b/g,
    (match, stem) => {
      const isCap = match[0] === match[0].toUpperCase();
      const fixed = `memp${stem}`;
      return isCap ? fixed.charAt(0).toUpperCase() + fixed.slice(1) : fixed;
    }
  );

  processed = processed.replace(
    /\b[Mm]ng([a-z]{3,})\b/g,
    (match, stem) => {
      const isCap = match[0] === match[0].toUpperCase();
      const fixed = `meng${stem}`;
      return isCap ? fixed.charAt(0).toUpperCase() + fixed.slice(1) : fixed;
    }
  );

  processed = processed.replace(
    /\b[Mm]ny([a-z]{3,})\b/g,
    (match, stem) => {
      const isCap = match[0] === match[0].toUpperCase();
      const fixed = `meny${stem}`;
      return isCap ? fixed.charAt(0).toUpperCase() + fixed.slice(1) : fixed;
    }
  );

  return processed;
}

/**
 * 5. CONVERSION SLASH (/) MENJADI 'ATAU'
 * Mengganti tanda garis miring (/) di antara kata menjadi kata 'atau'
 * (mis. Doktrin/Pola Pikir -> Doktrin atau Pola Pikir, pria/wanita -> pria atau wanita)
 * tanpa mengganggu angka/tanggal (1/2, 12/05/2024), URL (http://), DOI, atau path file.
 */
export function normalizeSlashedWords(text: string): string {
  if (!text || typeof text !== 'string') return '';

  let result = text
    .replace(/\bdan\s*\/\s*atau\b/gi, (match) => preserveCapitalization(match, 'dan atau'))
    .replace(/\bs\s*\/\s*d\b/gi, 'sampai dengan')
    .replace(/\bd\s*\/\s*a\b/gi, 'dengan alamat')
    .replace(/\bu\s*\/\s*p\b/gi, 'untuk perhatian');

  let previous = '';
  let iterations = 0;
  while (previous !== result && iterations < 5) {
    previous = result;
    result = result.replace(
      /\b([a-zA-Zá-ÿÁ-Ÿ]+)\s*\/\s*([a-zA-Zá-ÿÁ-Ÿ]+)\b/g,
      (_match, word1, word2) => {
        const isWord1Upper = word1.length > 1 && word1 === word1.toUpperCase() && word1 !== word1.toLowerCase();
        const isWord2Upper = word2.length > 1 && word2 === word2.toUpperCase() && word2 !== word2.toLowerCase();
        const conjunction = isWord1Upper && isWord2Upper ? 'ATAU' : 'atau';
        return `${word1} ${conjunction} ${word2}`;
      }
    );
    iterations++;
  }

  return result;
}

/**
 * 6. DEDUPLIKASI KALIMAT REPETITIF VERBATIM
 * Menghapus kalimat yang ditulis ulang secara berulang (duplikat) di dalam paragraf maupun antarblok.
 */
export function deduplicateRepeatedSentences(text: string): string {
  if (!text || typeof text !== 'string') return '';

  const lines = text.split('\n');
  const seenSentences = new Set<string>();

  const cleanedLines = lines.map((line) => {
    if (!line.trim()) return line;

    const rawSentences = line.split(/(?<=[.!?])\s+/);
    const uniqueSentencesInLine: string[] = [];

    for (const rawSentence of rawSentences) {
      const trimmed = rawSentence.trim();
      if (!trimmed) continue;

      const normalized = trimmed.toLowerCase().replace(/\s+/g, ' ');

      if (normalized.length > 15) {
        if (seenSentences.has(normalized)) {
          continue;
        }
        seenSentences.add(normalized);
      }
      uniqueSentencesInLine.push(trimmed);
    }

    return uniqueSentencesInLine.join(' ');
  });

  return cleanedLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * PEMBERSIHAN TOTAL TERPADU (UNIFIED SANITIZER)
 * Diterapkan pada Draft Tahap 2, Audit Tahap 3, Revisi, NASKAH_FINAL, VOICE_SCRIPT, dan Ekspor.
 */
export function applyLanguagePurityAndSanitization(text: string): string {
  if (!text || typeof text !== 'string') return '';

  let result = text;
  // Urutan operasi:
  // 1. Bersihkan marker internal
  result = eliminateInternalMarkers(result);
  // 2. Normalisasi kata bertanda garis miring (/) menjadi 'atau'
  result = normalizeSlashedWords(result);
  // 3. Eliminasi pengulangan kalimat duplikat (deduplikasi)
  result = deduplicateRepeatedSentences(result);
  // 4. Leburkan atribusi nama peneliti menjadi narasi substantif
  result = dissolveResearcherAttributions(result);
  // 5. Terjemahkan istilah asing & singkatan lembaga oral
  result = replaceForeignWordsAndAcronyms(result);
  // 6. Koreksi morfologi informal yang tidak valid
  result = normalizeInformalMorphology(result);
  // 7. Final clean spasi & tanda baca
  result = result
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1');

  return result;
}

/**
 * AUDIT KEMURNIAN BAHASA DAN VALIDASI OUTPUT
 * Memeriksa apakah naskah mematuhi 4 kebijakan mutlak.
 */
export function auditLanguageIntegrity(script: string): LanguageIntegrityAuditResult {
  if (!script || typeof script !== 'string') {
    return {
      passed: true,
      status: 'KEMURNIAN BAHASA LULUS',
      foreignWordsDetected: [],
      oralAcronymsDetected: [],
      leakedMarkersDetected: [],
      researcherAttributionsDetected: [],
      invalidMorphologyDetected: [],
      findings: [],
      summary: 'Naskah kosong atau tidak ada teks untuk diaudit.',
    };
  }

  const foreignWordsDetected: string[] = [];
  const oralAcronymsDetected: string[] = [];
  const leakedMarkersDetected: string[] = [];
  const researcherAttributionsDetected: string[] = [];
  const invalidMorphologyDetected: string[] = [];
  const findings: string[] = [];

  // 1. Cek kebocoran marker
  const markerMatch = script.match(/\[(?:GENFLOW|DOCUMENT)_[A-Z0-9_]+\]|\[GF-[0-9A-Z_-]+\]/gi);
  if (markerMatch) {
    markerMatch.forEach((m) => {
      if (!leakedMarkersDetected.includes(m)) leakedMarkersDetected.push(m);
    });
    findings.push(
      `[Kebocoran Marker Internal]: Ditemukan marker ${leakedMarkersDetected.join(', ')} di dalam naskah narasi. Marker ini dilarang tampil.`
    );
  }

  // 2. Cek kosakata asing yang dilarang (mis. mastery)
  for (const foreign of Object.keys(FOREIGN_WORD_DICTIONARY)) {
    const regex = new RegExp(`\\b${foreign}\\b`, 'i');
    if (regex.test(script)) {
      if (!foreignWordsDetected.includes(foreign)) foreignWordsDetected.push(foreign);
      findings.push(
        `[Kosakata Asing Dilarang]: Kata "${foreign}" ditemukan. Wajib diganti dengan padanan bahasa Indonesia ("${FOREIGN_WORD_DICTIONARY[foreign]}").`
      );
    }
  }

  // 3. Cek singkatan lembaga / singkatan asing dalam narasi lisan
  for (const acronym of Object.keys(ORAL_ACRONYM_DICTIONARY)) {
    const escaped = acronym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    if (regex.test(script)) {
      if (!oralAcronymsDetected.includes(acronym)) oralAcronymsDetected.push(acronym);
      findings.push(
        `[Singkatan/Nama Lembaga Asing]: "${acronym}" ditemukan. Dalam narasi lisan wajib menggunakan nama bahasa Indonesia ("${ORAL_ACRONYM_DICTIONARY[acronym]}").`
      );
    }
  }

  // 4. Cek atribusi nama peneliti
  const researcherPattern =
    /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}\s+(?:dan|bersama)\s+(?:tim(?:nya)?|kolega(?:nya)?)\s*(?:,\s*)?(?:pada\s+\d{1,2}\s+[A-Za-z]+\s+\d{4}\s+|pada\s+tahun\s+\d{4}\s+|\(\d{4}\)\s+)?(?:menemukan|menyimpulkan|mengungkapkan|membuktikan|menunjukkan|mencatat)\s+bahwa\b/i;
  if (researcherPattern.test(script)) {
    const matched = script.match(researcherPattern);
    const snippet = matched ? matched[0] : 'Nama peneliti';
    researcherAttributionsDetected.push(snippet);
    findings.push(
      `[Atribusi Peneliti Dalam Narasi]: Ditemukan penyebutan nama peneliti/tim ("${snippet}"). Nama peneliti wajib dileburkan menjadi narasi substantif (mis. "Hasil penelitian menunjukkan bahwa...").`
    );
  }

  // 5. Cek morfologi informal yang tidak valid (mis. mrediksi)
  for (const invalid of Object.keys(INVALID_INFORMAL_MORPHOLOGY_MAP)) {
    const regex = new RegExp(`\\b${invalid}\\b`, 'i');
    if (regex.test(script)) {
      if (!invalidMorphologyDetected.includes(invalid)) invalidMorphologyDetected.push(invalid);
      findings.push(
        `[Morfologi Informal Cacat]: Kata "${invalid}" ditemukan. Bentukan informal ini tidak sah, wajib gunakan "${INVALID_INFORMAL_MORPHOLOGY_MAP[invalid]}".`
      );
    }
  }

  const passed =
    foreignWordsDetected.length === 0 &&
    oralAcronymsDetected.length === 0 &&
    leakedMarkersDetected.length === 0 &&
    researcherAttributionsDetected.length === 0 &&
    invalidMorphologyDetected.length === 0;

  const status = passed ? 'KEMURNIAN BAHASA LULUS' : 'KEMURNIAN BAHASA PERLU PERBAIKAN';
  const summary = passed
    ? 'Audit Kemurnian Bahasa 100% LULUS: Bebas marker internal, bebas istilah asing yang tidak perlu, singkatan dialihkan ke bahasa Indonesia, bebas atribusi nama peneliti, dan morfologi lisan valid.'
    : `Audit Kemurnian Bahasa PERLU PERBAIKAN: Ditemukan ${findings.length} isu kemurnian narasi.`;

  return {
    passed,
    status,
    foreignWordsDetected,
    oralAcronymsDetected,
    leakedMarkersDetected,
    researcherAttributionsDetected,
    invalidMorphologyDetected,
    findings,
    summary,
  };
}
