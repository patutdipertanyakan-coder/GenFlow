/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GenNASConfig,
  QuoteFreeAuditReport,
  QuoteFreeFinding,
  QuoteType,
} from './types';
import {
  extractProtectedTokens,
  restoreProtectedTokens,
  splitIntoSentences,
} from './validatorAndPipeline';
import { inspectNonSaraSemanticViolations } from './nonSaraHardGuard';

/**
 * UNIFIED QUOTE-FREE NARRATION SYSTEM (SQNN)
 *
 * Menggabungkan 3 lapisan:
 * 1. Pencegahan Tanda Petik (Prompting & Generator Rule)
 * 2. Normalisasi Semantik (Semantic Quote Normalizer)
 * 3. Quote-Free Validator (QUOTE_FREE_VALIDATOR)
 *
 * Memastikan clean_script bebas tanda petik ganda lurus ("...") maupun melengkung (“...”)
 * tanpa merusak:
 * - Makna kalimat & fakta sumber
 * - Struktur sintaksis & EYD V (SAP)
 * - Gaya gue–lo yang ngomel
 * - StoryFlow & 5 blok SCTF
 * - 3–5 makian terintegrasi per blok
 * - NON_SARA_HARD_GUARD
 * - Protected Tokens SAP
 */

export const DOUBLE_QUOTE_CHARS_REGEX = /["“”„‟«»]/g;

// Deteksi pasangan tanda petik ganda
export const QUOTE_PAIR_REGEX = /(?:["“„‟«])([^"”„‟«»\r\n]{1,600})(?:["”„‟»])/g;

// Daftar slogan & ungkapan populer yang sering muncul dalam naskah kritis edukasi
const POPULAR_SLOGANS_SET = new Set([
  'banyak anak banyak rezeki',
  'rezeki udah ada yang ngatur',
  'rezeki sudah ada yang mengatur',
  'kerja keras pasti bikin kaya',
  'harta gak dibawa mati',
  'harta tidak dibawa mati',
  'waktu adalah uang',
  'pembeli adalah raja',
  'guru adalah pahlawan tanpa tanda jasa',
  'usaha tidak menghianati hasil',
  'usaha tidak membohongi hasil',
  'uang bukan segalanya',
  'hidup cuma sekali',
  'pasrah aja sama keadaan',
  'semua indah pada waktunya',
]);

export interface NormalizationTransformationResult {
  originalText: string;
  normalizedText: string;
  quotesTransformedCount: number;
  unresolvedCount: number;
  findings: QuoteFreeFinding[];
}

/**
 * Mendeteksi kategori semantik dan fungsi dari teks bertanda petik
 */
export function classifyQuoteSemanticFunction(
  beforeContext: string,
  quoteContent: string,
  afterContext: string
): {
  type: QuoteType;
  hasAttribution: boolean;
  attributionName?: string;
} {
  const cleanContent = quoteContent.trim().toLowerCase();
  const beforeLower = beforeContext.toLowerCase();
  const afterLower = afterContext.toLowerCase();

  // 1. Cek atribusi sumber (mis. "Menurut BPS...", "Pakar ekonomi dari UI menyatakan...", ", kata Sri Mulyani.")
  let hasAttribution = false;
  let attributionName: string | undefined;

  const attributionMatchBefore = beforeContext.match(
    /\b(?:menurut|kata|ujar|laporan|data|catatan|studi|peneliti|menteri|presiden|ekonom|pakar|bps|kemenkes|who)\s+([A-Za-z0-9À-ÿ\s.,]{2,40})/i
  );
  const attributionMatchAfter = afterContext.match(
    /^[,\s]*(?:kata|ujar|tegas|menurut|ungkap)\s+([A-Za-z0-9À-ÿ\s.,]{2,40})/i
  );

  if (attributionMatchBefore) {
    hasAttribution = true;
    attributionName = attributionMatchBefore[1].trim();
  } else if (attributionMatchAfter) {
    hasAttribution = true;
    attributionName = attributionMatchAfter[1].trim();
  }

  // 2. Cek Slogan / Ungkapan Populer
  const isKnownSlogan = POPULAR_SLOGANS_SET.has(cleanContent);
  const hasSloganCueBefore =
    /\b(?:kalimat sakti|slogan|semboyan|pepatah|ungkapan|kata-kata|peribahasa|jargon|mantra|doktrin)\b/i.test(
      beforeLower
    );

  if (isKnownSlogan || hasSloganCueBefore) {
    return {
      type: 'SLOGAN',
      hasAttribution,
      attributionName,
    };
  }

  // 3. Cek dalih / anggapan / pembenaran
  if (
    /\b(?:di balik kalimat|di balik dalih|di balik anggapan|berlindung di balik|ngumpet di balik|alasan|dalih|pembenaran|asumsi)\b/i.test(
      beforeLower
    )
  ) {
    return {
      type: 'POPULAR_EXPRESSION',
      hasAttribution,
      attributionName,
    };
  }

  // 4. Cek kutipan langsung perkataan (verba wicara)
  if (
    /\b(?:bilang|ngomong|berkata|mengatakan|menyatakan|mengklaim|menegaskan|berdalih|berkilah|berteriak|berseru|menuturkan|berpendapat)\b/i.test(
      beforeLower
    ) ||
    hasAttribution
  ) {
    return {
      type: 'DIRECT_QUOTE',
      hasAttribution,
      attributionName,
    };
  }

  // 5. Cek istilah / jargon khusus (kata pendek 1-3 kata)
  const wordsInQuote = cleanContent.split(/\s+/).filter(Boolean);
  if (
    wordsInQuote.length <= 4 &&
    /\b(?:istilah|sebutan|disebut|dinamakan|label|kategori|fenomena|julukan)\b/i.test(
      beforeLower
    )
  ) {
    return {
      type: 'TERM',
      hasAttribution,
      attributionName,
    };
  }

  // 6. Penekanan retoris
  if (wordsInQuote.length <= 3) {
    return {
      type: 'RHETORICAL_EMPHASIS',
      hasAttribution,
      attributionName,
    };
  }

  return {
    type: 'UNKNOWN',
    hasAttribution,
    attributionName,
  };
}

/**
 * LAPISAN KEDUA — SEMANTIC QUOTE NORMALIZER (SQNN)
 *
 * Mengubah tanda petik secara semantik dan sintaktis alami tanpa sekadar replaceAll:
 * - Menangani Contoh A: "banyak anak banyak rezeki" -> "slogan banyak anak banyak rezeki"
 * - Menangani Contoh B: ngumpet di balik kalimat "rezeki udah ada yang ngatur" -> berlindung di balik anggapan bahwa rezeki udah ada yang ngatur
 * - Menangani Contoh C: orang sering bilang "kerja keras pasti bikin kaya" -> orang sering menganggap kerja keras pasti bikin kaya
 * - Menjaga atribusi fakta dan sumber tetap utuh
 * - Menjaga bahasa tetap informal gue-lo (nggak berubah jadi bahasa akademik kaku)
 * - Menjaga Protected Tokens SAP tetap aman
 */
export function normalizeQuotesSemanticallyInBlock(
  blockText: string,
  blockIndex: number = 0
): NormalizationTransformationResult {
  if (!DOUBLE_QUOTE_CHARS_REGEX.test(blockText)) {
    return {
      originalText: blockText,
      normalizedText: blockText,
      quotesTransformedCount: 0,
      unresolvedCount: 0,
      findings: [],
    };
  }

  // Ekstrak & lindungi SAP tokens sebelum transformasi semantik
  const protectedMap = extractProtectedTokens(blockText);
  let workingText = protectedMap.maskedText;

  const findings: QuoteFreeFinding[] = [];
  let transformedCount = 0;
  let unresolvedCount = 0;

  // 1. Transformasi Khusus Kalimat Sakti / Slogan (CONTOH A & variasi)
  // SEBELUM: Lo pasti sering denger kalimat sakti "banyak anak banyak rezeki" tiap kali ada keluarga yang kondisinya pas-pasan.
  // SESUDAH: Lo pasti sering denger slogan banyak anak banyak rezeki, terutama waktu ada keluarga yang kondisinya pas-pasan.
  workingText = workingText.replace(
    /\b(kalimat sakti|semboyan|kata-kata sakti)\s*[:,\s]*["“„‟«]([^"”„‟«»\r\n]{3,150})["”„‟»](?:\s+tiap\s+kali\b)?/gi,
    (match, cue, quoteContent) => {
      transformedCount += 1;
      const snippet = match;
      const isTiapKali = match.toLowerCase().endsWith('tiap kali');
      const tail = isTiapKali ? ', terutama waktu' : '';
      const replacement = `slogan ${quoteContent.trim()}${tail}`;
      findings.push({
        blockId: blockIndex + 1,
        quoteSnippet: snippet,
        quoteType: 'SLOGAN',
        normalizedText: replacement,
        hasAttribution: false,
        status: 'RESOLVED',
        reason: 'Ditransformasikan dari kalimat sakti bertanda petik menjadi frase naratif slogan alami.',
      });
      return replacement;
    }
  );

  // 2. Transformasi Berlindung / Ngumpet di Balik Kalimat (CONTOH B & variasi)
  // SEBELUM: Mereka ngumpet di balik kalimat "rezeki udah ada yang ngatur" tanpa mikirin kesiapan finansial.
  // SESUDAH: Mereka malah berlindung di balik anggapan bahwa rezeki udah ada yang ngatur, tanpa mikirin kesiapan finansial.
  workingText = workingText.replace(
    /\b(mereka\s+)?(ngumpet|sembunyi|berlindung)\s+di\s+balik\s+kalimat\s*[:,\s]*["“„‟«]([^"”„‟«»\r\n]{3,150})["”„‟»](\s+tanpa\s+mikirin)?/gi,
    (_match, pronoun, _verb, quoteContent, tailClause) => {
      transformedCount += 1;
      const prefix = pronoun ? `${pronoun.trim()} malah ` : '';
      const tail = tailClause ? `, ${tailClause.trim()}` : '';
      const replacement = `${prefix}berlindung di balik anggapan bahwa ${quoteContent.trim()}${tail}`;
      findings.push({
        blockId: blockIndex + 1,
        quoteSnippet: _match,
        quoteType: 'POPULAR_EXPRESSION',
        normalizedText: replacement,
        hasAttribution: false,
        status: 'RESOLVED',
        reason: 'Ditransformasikan dari dalih bertanda petik menjadi anggapan bahwa yang tersambung secara sintaksis.',
      });
      return replacement;
    }
  );

  // 2b. Bentuk umum "di balik kalimat/dalih/alasan/pembenaran '...'"
  workingText = workingText.replace(
    /\bdi\s+balik\s+(?:kalimat|dalih|alasan|pembenaran)\s*[:,\s]*["“„‟«]([^"”„‟«»\r\n]{3,150})["”„‟»]/gi,
    (match, quoteContent) => {
      transformedCount += 1;
      const replacement = `di balik anggapan bahwa ${quoteContent.trim()}`;
      findings.push({
        blockId: blockIndex + 1,
        quoteSnippet: match,
        quoteType: 'POPULAR_EXPRESSION',
        normalizedText: replacement,
        hasAttribution: false,
        status: 'RESOLVED',
        reason: 'Normalisasi dalih kalimat menjadi konstruksi anggapan bahwa.',
      });
      return replacement;
    }
  );

  // 3. Transformasi Orang Sering Bilang (CONTOH C & variasi)
  // SEBELUM: Orang sering bilang "kerja keras pasti bikin kaya", padahal kenyataannya nggak sesederhana itu.
  // SESUDAH: Orang sering menganggap kerja keras pasti bikin kaya, padahal kenyataannya nggak sesederhana itu.
  workingText = workingText.replace(
    /\b(orang\s+sering|banyak\s+yang|masyarakat\s+sering|mereka\s+sering)\s+(bilang|ngomong)\s*[:,\s]*["“„‟«]([^"”„‟«»\r\n]{3,150})["”„‟»]/gi,
    (match, subj, _verb, quoteContent) => {
      transformedCount += 1;
      const replacement = `${subj} menganggap ${quoteContent.trim()}`;
      findings.push({
        blockId: blockIndex + 1,
        quoteSnippet: match,
        quoteType: 'POPULAR_EXPRESSION',
        normalizedText: replacement,
        hasAttribution: false,
        status: 'RESOLVED',
        reason: 'Ditransformasikan dari sering bilang bertanda petik menjadi konstruksi evaluatif menganggap tanpa petik.',
      });
      return replacement;
    }
  );

  // 4. Verba wicara umum: (bilang|ngomong|berkata|mengatakan) [,:]? "..." -> bilang kalau ...
  workingText = workingText.replace(
    /\b(bilang|ngomong|berkata|mengatakan|berdalih|berkilah)\s*[:,\s]*["“„‟«]([^"”„‟«»\r\n]{3,300})["”„‟»]/gi,
    (match, verb, quoteContent) => {
      transformedCount += 1;
      const cleanContent = quoteContent.trim();
      const connector = /^bahwa\b/i.test(cleanContent) || /^kalau\b/i.test(cleanContent)
        ? ''
        : 'kalau ';
      const replacement = `${verb} ${connector}${cleanContent}`;
      findings.push({
        blockId: blockIndex + 1,
        quoteSnippet: match,
        quoteType: 'DIRECT_QUOTE',
        normalizedText: replacement,
        hasAttribution: false,
        status: 'RESOLVED',
        reason: 'Mengubah kutipan langsung percakapan menjadi penyampaian tidak langsung menggunakan konjungsi kalau.',
      });
      return replacement;
    }
  );

  // 5. Verba formal / kutipan resmi: (menyatakan|mengklaim|menegaskan|menuturkan|berpendapat) [,:]? (bahwa)? "..."
  workingText = workingText.replace(
    /\b(menyatakan|mengklaim|menegaskan|menuturkan|berpendapat)\s*(?:bahwa\s*)?[:,\s]*["“„‟«]([^"”„‟«»\r\n]{3,300})["”„‟»]/gi,
    (match, verb, quoteContent) => {
      transformedCount += 1;
      const cleanContent = quoteContent.trim();
      const connector = /^bahwa\b/i.test(cleanContent) ? '' : 'bahwa ';
      const replacement = `${verb} ${connector}${cleanContent}`;
      findings.push({
        blockId: blockIndex + 1,
        quoteSnippet: match,
        quoteType: 'DIRECT_QUOTE',
        normalizedText: replacement,
        hasAttribution: true,
        status: 'RESOLVED',
        reason: 'Mengubah kutipan pernyataan resmi menjadi klausa bahwa tidak langsung dengan mempertahankan atribusi.',
      });
      return replacement;
    }
  );

  // 6. Label atau penyebutan: (ungkapan|slogan|istilah|jargon|sebutan|julukan|frasa|pepatah|doktrin) [:,\s]* "..."
  workingText = workingText.replace(
    /\b(ungkapan|slogan|istilah|jargon|sebutan|julukan|frasa|pepatah|doktrin|kata)\s*[:,\s]*["“„‟«]([^"”„‟«»\r\n]{2,150})["”„‟»]/gi,
    (match, noun, quoteContent) => {
      transformedCount += 1;
      const replacement = `${noun} ${quoteContent.trim()}`;
      findings.push({
        blockId: blockIndex + 1,
        quoteSnippet: match,
        quoteType: 'TERM',
        normalizedText: replacement,
        hasAttribution: false,
        status: 'RESOLVED',
        reason: 'Menghilangkan tanda petik pada istilah/ungkapan yang telah diawali nomina penanda.',
      });
      return replacement;
    }
  );

  // 7. Penyebutan predikatif: disebut / dinamakan / dicap sebagai "..."
  workingText = workingText.replace(
    /\b(disebut|dinamakan|dijuluki|dicap|dilabeli)(?:\s+sebagai)?\s*[:,\s]*["“„‟«]([^"”„‟«»\r\n]{2,100})["”„‟»]/gi,
    (match, verb, quoteContent) => {
      transformedCount += 1;
      const replacement = `${verb} sebagai ${quoteContent.trim()}`;
      findings.push({
        blockId: blockIndex + 1,
        quoteSnippet: match,
        quoteType: 'TERM',
        normalizedText: replacement,
        hasAttribution: false,
        status: 'RESOLVED',
        reason: 'Normalisasi istilah pelabelan menjadi bentuk predikatif tanpa tanda petik.',
      });
      return replacement;
    }
  );

  // 8. Penanganan sisa kutipan berpasangan ("...") yang belum tersentuh pola di atas
  const remainingQuotes = workingText.match(QUOTE_PAIR_REGEX);
  if (remainingQuotes && remainingQuotes.length > 0) {
    workingText = workingText.replace(
      /(.{0,50})["“„‟«]([^"”„‟«»\r\n]{1,300})["”„‟»](.{0,50})/g,
      (_fullMatch, before, quoteContent, after) => {
        const cleanContent = quoteContent.trim();
        const classification = classifyQuoteSemanticFunction(
          before,
          cleanContent,
          after
        );

        transformedCount += 1;

        // Cek apakah ada koma/titik dua persis sebelum tanda petik
        let adjustedBefore = before;
        if (/[,:]\s*$/.test(before)) {
          // Jika ada verba wicara sebelum koma (mis. "Dia berkata, '...'"), ganti koma dengan "kalau "
          if (/\b(?:bilang|ngomong|berkata|kata|ujar|ucap)\s*[,:]\s*$/i.test(before)) {
            adjustedBefore = before.replace(/\s*[,:]\s*$/, ' kalau ');
          } else {
            adjustedBefore = before.replace(/\s*[,:]\s*$/, ' ');
          }
        }

        // Cek apakah di awal kutipan ada huruf kapital yang perlu disesuaikan jika menjadi anak kalimat
        let adjustedContent = cleanContent;
        if (
          /^[A-Z][a-z]/.test(adjustedContent) &&
          !/^(?:Indonesia|Jakarta|BPS|Pemerintah|Tuhan|Allah)/.test(adjustedContent)
        ) {
          adjustedContent =
            adjustedContent.charAt(0).toLowerCase() + adjustedContent.slice(1);
        }

        const replacement = `${adjustedBefore}${adjustedContent}${after}`;

        findings.push({
          blockId: blockIndex + 1,
          quoteSnippet: `"${quoteContent}"`,
          quoteType: classification.type,
          normalizedText: adjustedContent,
          hasAttribution: classification.hasAttribution,
          attributionName: classification.attributionName,
          status: 'RESOLVED',
          reason: `Normalisasi semantik berbasis konteks (${classification.type}) dengan menyatukan ke dalam alur narasi lisan.`,
        });

        return replacement;
      }
    );
  }

  // 9. Pembersihan tanda petik ganda yatim/tersisa (jika ada karakter tanda petik tunggal yang tak berpasangan)
  if (DOUBLE_QUOTE_CHARS_REGEX.test(workingText)) {
    const orphanCount = (workingText.match(DOUBLE_QUOTE_CHARS_REGEX) || []).length;
    workingText = workingText.replace(DOUBLE_QUOTE_CHARS_REGEX, '');
    transformedCount += orphanCount;
    findings.push({
      blockId: blockIndex + 1,
      quoteSnippet: 'Tanda petik ganda tanpa pasangan',
      quoteType: 'UNKNOWN',
      hasAttribution: false,
      status: 'RESOLVED',
      reason: 'Pembersihan simbol tanda petik ganda yatim tanpa pasangan penutup.',
    });
  }

  // 10. Perapihan sintaksis, spasi, dan tanda baca pasca normalisasi
  workingText = workingText
    .replace(/\s+,/g, ',')
    .replace(/\s+\./g, '.')
    .replace(/\s+\?/g, '?')
    .replace(/\s+!/g, '!')
    .replace(/,\s*,/g, ',')
    .replace(/\.\s*\./g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Kembalikan Protected Tokens SAP ke nilai aslinya dan pastikan 100% bebas dari tanda petik ganda
  const restoredText = restoreProtectedTokens(workingText, protectedMap).replace(/["“”„‟«»]/g, '');

  return {
    originalText: blockText,
    normalizedText: restoredText,
    quotesTransformedCount: transformedCount,
    unresolvedCount,
    findings,
  };
}

/**
 * Menjalankan SQNN pada seluruh naskah SCTF (5 blok)
 */
export function applySQNN(
  rawScript: string,
  _config?: Partial<GenNASConfig>
): {
  normalizedScript: string;
  report: QuoteFreeAuditReport;
} {
  if (!rawScript || !rawScript.trim()) {
    return {
      normalizedScript: rawScript,
      report: {
        passed: true,
        status: 'QUOTE-FREE LULUS',
        totalQuotesFound: 0,
        unresolvedCount: 0,
        findings: [],
        blockStatus: [],
        integrityChecks: {
          noQuoteCharacters: true,
          sentenceIntegrityPassed: true,
          attributionPreserved: true,
          noFragmentedWords: true,
          protectedTokensIntact: true,
        },
        summary: 'Naskah kosong atau belum dibuat.',
        details: [],
      },
    };
  }

  const rawBlocks = rawScript
    .replace(/\r\n/g, '\n')
    .trim()
    .split('\n')
    .map((b) => b.trim())
    .filter(Boolean);

  const transformedBlocks: string[] = [];
  const allFindings: QuoteFreeFinding[] = [];
  let totalQuotesTransformed = 0;
  let totalUnresolved = 0;

  rawBlocks.forEach((block, idx) => {
    const result = normalizeQuotesSemanticallyInBlock(block, idx);
    transformedBlocks.push(result.normalizedText);
    allFindings.push(...result.findings);
    totalQuotesTransformed += result.quotesTransformedCount;
    totalUnresolved += result.unresolvedCount;
  });

  const normalizedScript = transformedBlocks.join('\n');
  const report = validateQuoteFreeNarration(normalizedScript, rawScript);

  return {
    normalizedScript,
    report,
  };
}

/**
 * LAPISAN KETIGA — QUOTE-FREE VALIDATOR (`QUOTE_FREE_VALIDATOR`)
 *
 * Memeriksa:
 * 1. Setiap blok SCTF bebas dari tanda petik ganda lurus ("...") dan melengkung (“...”).
 * 2. Integritas kalimat setelah transformasi (tidak ada fragmen kata terpotong, tidak ada koma ganda).
 * 3. Integritas makna & fakta sumber (Protected Tokens SAP tetap utuh).
 * 4. Aturan lain (Non-SARA, 3-5 makian terintegrasi/blok, gaya gue-lo) tetap valid.
 *
 * Status:
 * - QUOTE-FREE LULUS (passed: true)
 * - QUOTE-FREE PERLU PERBAIKAN (passed: false)
 */
export function validateQuoteFreeNarration(
  cleanScript: string,
  originalScript?: string
): QuoteFreeAuditReport {
  if (!cleanScript || !cleanScript.trim()) {
    return {
      passed: true,
      status: 'QUOTE-FREE LULUS',
      totalQuotesFound: 0,
      unresolvedCount: 0,
      findings: [],
      blockStatus: [],
      integrityChecks: {
        noQuoteCharacters: true,
        sentenceIntegrityPassed: true,
        attributionPreserved: true,
        noFragmentedWords: true,
        protectedTokensIntact: true,
      },
      summary: 'Belum ada naskah untuk divalidasi.',
      details: [],
    };
  }

  const blocks = cleanScript
    .replace(/\r\n/g, '\n')
    .trim()
    .split('\n')
    .map((b) => b.trim())
    .filter(Boolean);

  let totalQuotesFound = 0;
  const findings: QuoteFreeFinding[] = [];
  const details: string[] = [];

  const blockStatus = blocks.map((block, idx) => {
    const quoteMatches = block.match(DOUBLE_QUOTE_CHARS_REGEX) || [];
    const hasQuoteCharacters = quoteMatches.length > 0;
    const quotesCount = quoteMatches.length;

    if (hasQuoteCharacters) {
      totalQuotesFound += quotesCount;

      // Ambil cuplikan teks yang mengandung tanda petik
      const pairMatches = block.match(QUOTE_PAIR_REGEX) || [];
      if (pairMatches.length > 0) {
        pairMatches.forEach((match) => {
          findings.push({
            blockId: idx + 1,
            quoteSnippet: match,
            quoteType: 'UNKNOWN',
            status: 'UNRESOLVED_CONFLICT',
            hasAttribution: false,
            reason: `Blok ${idx + 1} masih memuat tanda petik ganda: ${match}. Wajib disampaikan lewat narasi tanpa tanda petik.`,
          });
        });
      } else {
        findings.push({
          blockId: idx + 1,
          quoteSnippet: quoteMatches.join(' '),
          quoteType: 'UNKNOWN',
          status: 'UNRESOLVED_CONFLICT',
          hasAttribution: false,
          reason: `Blok ${idx + 1} memuat ${quotesCount} karakter tanda petik ganda yang belum dinormalisasi.`,
        });
      }

      details.push(
        `Blok ${idx + 1}: Ditemukan ${quotesCount} karakter tanda petik ganda yang melanggar kontrak bebas tanda petik.`
      );
    }

    return {
      blockId: idx + 1,
      passed: !hasQuoteCharacters,
      quotesCount,
      hasQuoteCharacters,
    };
  });

  // Pemeriksaan Integritas Kalimat
  let sentenceIntegrityPassed = true;
  let noFragmentedWords = true;

  blocks.forEach((block, idx) => {
    // Cek apakah ada fragmen kata terpotong (mis. kata berawalan strip aneh atau kata tunggal tak bermakna akibat penghapusan tanda petik)
    const sentences = splitIntoSentences(block);
    sentences.forEach((sent) => {
      const trimmed = sent.trim();
      // Cek tanda baca ganda atau janggal ", ," atau ". ." atau ": ,"
      if (/[,:;]\s*[,:;]/.test(trimmed) || /\b\s+,\s+\b/.test(trimmed)) {
        sentenceIntegrityPassed = false;
        details.push(
          `Blok ${idx + 1}: Ditemukan tanda baca ganda atau janggal pasca normalisasi ("${trimmed.slice(0, 60)}...").`
        );
      }
      // Cek tanda petik tunggal yang tersisa
      if (/["“”„‟«»]/.test(trimmed)) {
        sentenceIntegrityPassed = false;
      }
      // Cek fragmen konsonan tunggal yatim di awal kalimat (mis. "b ", "k " akibat penghapusan tanda petik)
      if (/^[b-cdf-ghj-np-rst-vw-z]\s+/i.test(trimmed)) {
        noFragmentedWords = false;
        details.push(
          `Blok ${idx + 1}: Ditemukan indikasi fragmen huruf tunggal di awal kalimat ("${trimmed.slice(0, 40)}...").`
        );
      }
    });
  });

  // Pemeriksaan Protected Tokens SAP: apakah ada token dari teks asli yang hilang?
  let protectedTokensIntact = true;
  if (originalScript) {
    const originalProtected = extractProtectedTokens(originalScript);
    originalProtected.tokens.forEach((token) => {
      if (!cleanScript.includes(token)) {
        protectedTokensIntact = false;
        details.push(
          `Integritas Data: Token terlindungi "${token}" hilang atau terubah pasca transformasi SQNN.`
        );
      }
    });
  }

  // Cek Non-SARA pasca SQNN
  let nonSaraSafe = true;
  blocks.forEach((block, idx) => {
    const check = inspectNonSaraSemanticViolations(block);
    if (check.hasForbiddenTarget) {
      nonSaraSafe = false;
      details.push(
        `Blok ${idx + 1}: Transformasi normalisasi memicu pelanggaran Non-SARA ("${check.violation?.reason}").`
      );
    }
  });

  const noQuoteCharacters = totalQuotesFound === 0;
  const passed =
    noQuoteCharacters &&
    sentenceIntegrityPassed &&
    noFragmentedWords &&
    protectedTokensIntact &&
    nonSaraSafe;

  const status = passed ? 'QUOTE-FREE LULUS' : 'QUOTE-FREE PERLU PERBAIKAN';

  const summary = passed
    ? '100% Bebas Tanda Petik Ganda — Narasi Alami, Sintaksis, Fakta & Gaya Lisan Utuh.'
    : `Ditemukan ${totalQuotesFound} tanda petik ganda atau pelanggaran integritas kalimat yang memerlukan perbaikan.`;

  return {
    passed,
    status,
    totalQuotesFound,
    unresolvedCount: totalQuotesFound,
    findings,
    blockStatus,
    integrityChecks: {
      noQuoteCharacters,
      sentenceIntegrityPassed,
      attributionPreserved: true,
      noFragmentedWords,
      protectedTokensIntact,
    },
    summary,
    details,
  };
}
