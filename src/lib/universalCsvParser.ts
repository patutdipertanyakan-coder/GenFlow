/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * UNIVERSAL 7-COLUMN CSV PARSER & SEMANTIC RULE CLASSIFIER (RFC-4180 COMPLIANT)
 * 
 * Mendukung format tepat 7 kolom:
 * Kata,Kategori,Padanan Formal,Fungsi Kata,Makna Kontekstual,Saran,Aturan Penggunaan
 * 
 * Fitur:
 * - Standar RFC-4180: Mendukung teks di dalam tanda kutip dua, koma di dalam teks, dan UTF-8
 * - Pratinjau interaktif sebelum impor (baris valid, duplikat, sampel 5 baris)
 * - Anti-duplikasi berbasis canonical key + fungsi kata + kategori
 * - Klasifikasi semantik terstruktur (ALLOW, CONDITIONAL, AVOID)
 */

import { getCanonicalDedupKey, normalizeDisplayExpansionEntry } from './expansionLexiconBank';
import { F7PrimaryCategory } from './masterLexiconTypes';

export interface UniversalCsvRow {
  kata: string;
  kategori: string;
  padananFormal: string;
  fungsiKata: string;
  maknaKontekstual: string;
  saran: string;
  aturanPenggunaan: string;
  // Derived metadata
  canonicalKey: string;
  inferredStatus: 'ALLOW' | 'CONDITIONAL' | 'AVOID';
  inferredF7Category: F7PrimaryCategory;
  isAttentionHigh: boolean;
  statusReason: string;
}

export interface UniversalCsvPreviewResult {
  isValid: boolean;
  totalRows: number;
  validRows: UniversalCsvRow[];
  sampleRows: UniversalCsvRow[];
  duplicatesCount: number;
  tombstoneDuplicatesCount: number;
  errorMessages: string[];
}

/**
 * Tokenizer CSV standar RFC-4180 yang menangani tanda kutip ganda, koma di dalam sel, dan newline
 */
export function tokenizeRfc4180Csv(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuotes = false;

  const text = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (insideQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote: "" -> "
          currentCell += '"';
          i++;
        } else {
          insideQuotes = false;
        }
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
      } else if (char === ',' || char === ';') {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if (char === '\n') {
        currentRow.push(currentCell.trim());
        if (currentRow.some((c) => Boolean(c))) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => Boolean(c))) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Mengklasifikasikan status ALLOW/CONDITIONAL/AVOID secara terstruktur
 * berdasarkan relasi Kategori, Fungsi Kata, dan Aturan Penggunaan
 */
export function evaluateStructuredContextualRule(params: {
  kata: string;
  kategori: string;
  fungsiKata: string;
  maknaKontekstual: string;
  aturanPenggunaan: string;
}): {
  status: 'ALLOW' | 'CONDITIONAL' | 'AVOID';
  f7Category: F7PrimaryCategory;
  isAttentionHigh: boolean;
  reason: string;
} {
  const combinedRules = `${params.aturanPenggunaan} ${params.maknaKontekstual} ${params.kategori}`.toLowerCase();
  const katLower = params.kategori.toLowerCase();

  // 1. Tentukan Kategori F7 Terstruktur
  let f7Category: F7PrimaryCategory = 'Register/morfologi/slang';
  if (katLower.includes('tuduhan') || katLower.includes('negatif') || katLower.includes('peyoratif')) {
    f7Category = 'Konotasi negatif/tuduhan';
  } else if (katLower.includes('kiasan') || katLower.includes('polisemi') || katLower.includes('metafora')) {
    f7Category = 'Makna kiasan/polisemi';
  } else if (katLower.includes('frasa') || katLower.includes('konstruksi') || katLower.includes('idiom')) {
    f7Category = 'Frasa/konstruksi kontekstual';
  } else if (katLower.includes('teknis') || katLower.includes('akademis') || katLower.includes('prosedural')) {
    f7Category = 'Teknis/akademis/prosedural';
  }

  // 2. Tentukan Status Berdasarkan Evaluasi Terstruktur Aturan Penggunaan
  const hasStrictProhibition =
    /\b(?:dilarang|jangan\s+gunakan|hindari\s+total|tidak\s+boleh|tabu|merusak\s+nada|hindari)\b/i.test(
      combinedRules
    );
  const hasConditionalRequirement =
    /\b(?:bersyarat|hanya\s+jika|tergantung\s+konteks|wajib\s+ada\s+bukti|bila\s+disertai|perhatikan\s+objek|hati-hati|pastikan\s+fakta)\b/i.test(
      combinedRules
    ) || f7Category === 'Konotasi negatif/tuduhan' || f7Category === 'Makna kiasan/polisemi';

  let status: 'ALLOW' | 'CONDITIONAL' | 'AVOID' = 'ALLOW';
  let isAttentionHigh = false;
  let reason = 'Dapat digunakan secara natural dan luwes dalam gaya percakapan santai Gue–Lo.';

  if (hasStrictProhibition) {
    status = 'AVOID';
    isAttentionHigh = true;
    reason = `Dibatasi / Hindari: ${params.aturanPenggunaan || 'Memiliki risiko peyoratif atau merusak nada kritis rasional.'}`;
  } else if (hasConditionalRequirement) {
    status = 'CONDITIONAL';
    isAttentionHigh = true;
    reason = `Bersyarat (${f7Category}): ${params.aturanPenggunaan || 'Wajib didukung konteks pembuktian yang jelas.'}`;
  }

  return {
    status,
    f7Category,
    isAttentionHigh,
    reason,
  };
}

/**
 * Parsing dan validasi berkas CSV 7 Kolom Universal dengan deteksi duplikat dan pratinjau
 */
export function parseUniversalCsvWithPreview(
  csvText: string,
  existingCanonicalKeys: Set<string> = new Set(),
  tombstoneKeys: Set<string> = new Set()
): UniversalCsvPreviewResult {
  const tokenized = tokenizeRfc4180Csv(csvText);
  if (tokenized.length === 0) {
    return {
      isValid: false,
      totalRows: 0,
      validRows: [],
      sampleRows: [],
      duplicatesCount: 0,
      tombstoneDuplicatesCount: 0,
      errorMessages: ['File CSV kosong atau tidak memuat data yang dapat dibaca.'],
    };
  }

  // Baris pertama sebagai header
  const headerRow = tokenized[0].map((h) => h.toLowerCase().trim());
  const expectedHeaderKeywords = [
    'kata',
    'kategori',
    'padanan',
    'fungsi',
    'makna',
    'saran',
    'aturan',
  ];

  const isHeader = headerRow.some((h) => expectedHeaderKeywords.some((k) => h.includes(k)));
  const dataRows = isHeader ? tokenized.slice(1) : tokenized;

  // Pemetaan indeks kolom
  let idxKata = 0;
  let idxKategori = 1;
  let idxFormal = 2;
  let idxFungsi = 3;
  let idxMakna = 4;
  let idxSaran = 5;
  let idxAturan = 6;

  if (isHeader) {
    headerRow.forEach((col, idx) => {
      if (col.includes('kata') && !col.includes('fungsi')) idxKata = idx;
      else if (col.includes('kategori')) idxKategori = idx;
      else if (col.includes('padanan') || col.includes('formal') || col.includes('baku')) idxFormal = idx;
      else if (col.includes('fungsi')) idxFungsi = idx;
      else if (col.includes('makna') || col.includes('arti') || col.includes('konteks')) idxMakna = idx;
      else if (col.includes('saran') || col.includes('lisan') || col.includes('rekomendasi')) idxSaran = idx;
      else if (col.includes('aturan') || col.includes('kaidah') || col.includes('ketentuan')) idxAturan = idx;
    });
  }

  const validRows: UniversalCsvRow[] = [];
  const seenInBatch = new Set<string>();
  let duplicatesCount = 0;
  let tombstoneDuplicatesCount = 0;
  const errorMessages: string[] = [];

  dataRows.forEach((parts, rowNum) => {
    const rawKata = parts[idxKata] || '';
    const displayWord = normalizeDisplayExpansionEntry(rawKata);

    if (!displayWord) return;

    const canonicalKey = getCanonicalDedupKey(displayWord);
    const kategori = parts[idxKategori] || 'Register/morfologi/slang';
    const padananFormal = parts[idxFormal] || '';
    const fungsiKata = parts[idxFungsi] || 'Verba Percakapan';
    const maknaKontekstual = parts[idxMakna] || 'Kosakata lisan percakapan.';
    const saran = parts[idxSaran] || padananFormal || displayWord;
    const aturanPenggunaan = parts[idxAturan] || 'Gunakan secara wajar sesuai naskah santai Gue–Lo.';

    // Kunci gabungan untuk membedakan bentuk sama tapi beda fungsi kata
    const compositeKey = `${canonicalKey}:::${fungsiKata.toLowerCase()}:::${kategori.toLowerCase()}`;

    // 1. Cek Deletion Tombstone
    if (tombstoneKeys.has(canonicalKey) || tombstoneKeys.has(displayWord.toLowerCase())) {
      tombstoneDuplicatesCount++;
      return;
    }

    // 2. Cek duplikasi di dalam batch CSV itu sendiri
    if (seenInBatch.has(compositeKey)) {
      duplicatesCount++;
      return;
    }

    // 3. Cek duplikasi terhadap repository yang sudah ada
    if (existingCanonicalKeys.has(canonicalKey)) {
      duplicatesCount++;
      return;
    }
    seenInBatch.add(compositeKey);

    const { status, f7Category, isAttentionHigh, reason } = evaluateStructuredContextualRule({
      kata: displayWord,
      kategori,
      fungsiKata,
      maknaKontekstual,
      aturanPenggunaan,
    });

    validRows.push({
      kata: displayWord,
      kategori,
      padananFormal,
      fungsiKata,
      maknaKontekstual,
      saran,
      aturanPenggunaan,
      canonicalKey,
      inferredStatus: status,
      inferredF7Category: f7Category,
      isAttentionHigh,
      statusReason: reason,
    });
  });

  return {
    isValid: validRows.length > 0,
    totalRows: dataRows.length,
    validRows,
    sampleRows: validRows.slice(0, 5),
    duplicatesCount,
    tombstoneDuplicatesCount,
    errorMessages,
  };
}
