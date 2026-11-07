/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * GENNAS PRO / GENFLOW — UNIVERSAL CSV PHRASE PARSER (G2–G11)
 * 
 * Standar RFC-4180 Compliant:
 * - Mendukung UTF-8 dengan/tanpa BOM
 * - Quoted fields dengan escaped quotes ("") dan baris baru di dalam sel
 * - Toleransi terhadap variasi penamaan kolom (phrase_id, Kategori, Frasa, Fungsi Kategori, dll.)
 * - Zero Duplicate Policy & Selective Category Synchronization
 */

import {
  G1G11PhraseRecord,
  G1G11_CATEGORY_METADATA,
  validatePhraseSemanticAlignment,
} from './g1g11PhraseRepository';

export interface RawCsvPhraseItem {
  phrase_id?: string;
  category: string;
  phrase: string;
  categoryFunction?: string;
  contextualMeaning?: string;
  usageContext?: string;
  usageSuggestion?: string;
  usageRule?: string;
  lineNumber: number;
}

export type PhraseImportActionType = 'NEW' | 'UPDATE' | 'DUPLICATE' | 'INVALID';

export interface ValidatedPhraseImportRow {
  lineNumber: number;
  phrase_id?: string;
  targetCategoryCode: string; // e.g. "G3_AJAKAN_MASUK"
  categoryNum: string; // "G3"
  categoryLabel: string; // "G3 — Ajakan Masuk"
  phraseText: string;
  semanticFunction: string;
  contextualMeaning?: string;
  usageContext?: string;
  usageSuggestion?: string;
  usageRule?: string;
  action: PhraseImportActionType;
  actionReason: string;
  existingRecord?: G1G11PhraseRecord;
}

export interface UniversalPhraseCsvPreview {
  isValid: boolean;
  totalRows: number;
  affectedCategories: string[]; // e.g. ["G3_AJAKAN_MASUK", "G4_REFLEKSI_RINGAN"]
  untouchedCategories: string[]; // e.g. ["G2_PEMBUKA_AKRAB", ...]
  newPhrasesCount: number;
  updatedPhrasesCount: number;
  duplicatesCount: number;
  invalidCount: number;
  rows: ValidatedPhraseImportRow[];
  sampleRows: ValidatedPhraseImportRow[];
  validationErrors: string[];
}

/**
 * Resolusi Fleksibel Kategori G2–G11 dari teks kolom Kategori CSV
 * Mencegah tebakan acak; jika tidak valid mengembalikan null.
 */
export function resolveG1G11CategoryCode(input: string): string | null {
  if (!input) return null;
  const clean = input.trim().toUpperCase().replace(/[\s-]+/g, '_');

  // 1. Direct match with full category code
  if (G1G11_CATEGORY_METADATA[clean]) {
    return clean;
  }

  // 2. Exact match on G number (G2 .. G11)
  const gMatch = clean.match(/^G(1[01]|[2-9])$/);
  if (gMatch) {
    const targetNum = `G${gMatch[1]}`;
    for (const [code, meta] of Object.entries(G1G11_CATEGORY_METADATA)) {
      if (meta.num === targetNum) return code;
    }
  }

  // 3. Match prefix G2_ .. G11_
  for (const code of Object.keys(G1G11_CATEGORY_METADATA)) {
    const num = G1G11_CATEGORY_METADATA[code].num;
    if (clean.startsWith(`${num}_`)) {
      return code;
    }
  }

  // 4. Match Indonesian label keywords
  const lower = input.toLowerCase();
  if (lower.includes('pembuka') || lower.includes('akrab')) return 'G2_PEMBUKA_AKRAB';
  if (lower.includes('ajakan') || lower.includes('masuk')) return 'G3_AJAKAN_MASUK';
  if (lower.includes('refleksi') || lower.includes('ringan')) return 'G4_REFLEKSI_RINGAN';
  if (lower.includes('narator') || lower.includes('dekat')) return 'G5_NARATOR_DEKAT';
  if (lower.includes('transisi') || lower.includes('natural')) return 'G6_TRANSISI_NATURAL';
  if (lower.includes('penekanan') || lower.includes('santai')) return 'G7_PENEKANAN_SANTAI';
  if (lower.includes('patah') || lower.includes('argumen') || lower.includes('mematahkan')) return 'G8_MEMATAHKAN_ARGUMEN';
  if (lower.includes('eskalasi') || lower.includes('tensi')) return 'G9_ESKALASI_TENSI';
  if (lower.includes('interaksi') || lower.includes('penonton')) return 'G10_INTERAKSI_PENONTON';
  if (lower.includes('penutup') || lower.includes('ngobrol')) return 'G11_PENUTUP_NGOBROL';

  return null;
}

/**
 * Normalisasi teks frasa untuk deteksi duplikasi Zero Duplicate Policy
 */
export function normalizePhraseComparisonText(text: string): string {
  return (text || '')
    .trim()
    .toLowerCase()
    .replace(/^[–—\s]+/, '')
    .replace(/[,.!?…\s]+$/, '')
    .replace(/\s+/g, ' ');
}

/**
 * Tokenizer RFC-4180 untuk parsing CSV secara akurat
 */
export function tokenizeRfc4180PhraseCsv(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuotes = false;

  // Hapus UTF-8 BOM jika ada
  const cleanText = csvText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped quote
        currentCell += '"';
        i++;
      } else {
        // Toggle quote state
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if (char === '\n' && !insideQuotes) {
      currentRow.push(currentCell.trim());
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  // Push sel terakhir jika ada
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((cell) => cell.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Menemukan indeks kolom berdasarkan variasi nama header
 */
function findColumnIndices(headerRow: string[]): {
  idIndex: number;
  categoryIndex: number;
  phraseIndex: number;
  functionIndex: number;
  meaningIndex: number;
  contextIndex: number;
  suggestionIndex: number;
  ruleIndex: number;
} {
  const normalized = headerRow.map((h) => h.toLowerCase().trim().replace(/[\s_-]+/g, ''));

  return {
    idIndex: normalized.findIndex((h) => h === 'phraseid' || h === 'id' || h === 'idfrasa'),
    categoryIndex: normalized.findIndex(
      (h) => h === 'kategori' || h === 'category' || h === 'gcategory' || h === 'kategorig'
    ),
    phraseIndex: normalized.findIndex(
      (h) => h === 'frasa' || h === 'phrase' || h === 'kalimat' || h === 'teksfrasa'
    ),
    functionIndex: normalized.findIndex(
      (h) => h === 'fungsikategori' || h === 'fungsisemantik' || h === 'fungsi' || h === 'function'
    ),
    meaningIndex: normalized.findIndex(
      (h) => h === 'maknakontekstual' || h === 'makna' || h === 'meaning'
    ),
    contextIndex: normalized.findIndex(
      (h) => h === 'kontekspenggunaan' || h === 'konteks' || h === 'context'
    ),
    suggestionIndex: normalized.findIndex(
      (h) => h === 'saranpenggunaan' || h === 'saran' || h === 'suggestion'
    ),
    ruleIndex: normalized.findIndex(
      (h) => h === 'aturanpenggunaan' || h === 'aturan' || h === 'rule' || h === 'rules'
    ),
  };
}

/**
 * Memvalidasi dan membuat Pratinjau Universal CSV Frasa G2–G11
 */
export function parseAndPreviewUniversalPhraseCsv(
  csvContent: string,
  existingPhrases: G1G11PhraseRecord[]
): UniversalPhraseCsvPreview {
  const rawRows = tokenizeRfc4180PhraseCsv(csvContent);

  if (rawRows.length < 2) {
    return {
      isValid: false,
      totalRows: 0,
      affectedCategories: [],
      untouchedCategories: Object.keys(G1G11_CATEGORY_METADATA),
      newPhrasesCount: 0,
      updatedPhrasesCount: 0,
      duplicatesCount: 0,
      invalidCount: 0,
      rows: [],
      sampleRows: [],
      validationErrors: ['File CSV kosong atau tidak memiliki baris data setelah header.'],
    };
  }

  const headerRow = rawRows[0];
  const colIndices = findColumnIndices(headerRow);

  if (colIndices.categoryIndex === -1 || colIndices.phraseIndex === -1) {
    return {
      isValid: false,
      totalRows: rawRows.length - 1,
      affectedCategories: [],
      untouchedCategories: Object.keys(G1G11_CATEGORY_METADATA),
      newPhrasesCount: 0,
      updatedPhrasesCount: 0,
      duplicatesCount: 0,
      invalidCount: rawRows.length - 1,
      rows: [],
      sampleRows: [],
      validationErrors: [
        'Header CSV wajib memuat minimal kolom "Kategori" dan "Frasa". Ditemukan header: ' +
          headerRow.join(', '),
      ],
    };
  }

  // Bangun lookup database untuk deteksi duplikasi dan upsert
  const existingIdMap = new Map<string, G1G11PhraseRecord>();
  const existingCategoryPhraseLookup = new Map<string, Set<string>>();

  existingPhrases.forEach((p) => {
    existingIdMap.set(p.id, p);
    if (!existingCategoryPhraseLookup.has(p.categoryCode)) {
      existingCategoryPhraseLookup.set(p.categoryCode, new Set());
    }
    existingCategoryPhraseLookup
      .get(p.categoryCode)!
      .add(normalizePhraseComparisonText(p.currentText));
  });

  const parsedRows: ValidatedPhraseImportRow[] = [];
  const affectedCategoriesSet = new Set<string>();
  const validationErrors: string[] = [];
  const seenInThisImport = new Map<string, Set<string>>();

  let newCount = 0;
  let updatedCount = 0;
  let dupsCount = 0;
  let invalidCount = 0;

  for (let idx = 1; idx < rawRows.length; idx++) {
    const row = rawRows[idx];
    const lineNumber = idx + 1;

    // Ambil nilai per sel
    const phraseId =
      colIndices.idIndex !== -1 ? row[colIndices.idIndex]?.trim() : undefined;
    const rawCategory = row[colIndices.categoryIndex]?.trim() || '';
    const rawPhrase = row[colIndices.phraseIndex]?.trim() || '';
    const rawFunction =
      colIndices.functionIndex !== -1 ? row[colIndices.functionIndex]?.trim() : '';
    const rawMeaning =
      colIndices.meaningIndex !== -1 ? row[colIndices.meaningIndex]?.trim() : '';
    const rawContext =
      colIndices.contextIndex !== -1 ? row[colIndices.contextIndex]?.trim() : '';
    const rawSuggestion =
      colIndices.suggestionIndex !== -1 ? row[colIndices.suggestionIndex]?.trim() : '';
    const rawRule =
      colIndices.ruleIndex !== -1 ? row[colIndices.ruleIndex]?.trim() : '';

    // Resolusi Kategori
    const categoryCode = resolveG1G11CategoryCode(rawCategory);

    if (!categoryCode) {
      invalidCount++;
      parsedRows.push({
        lineNumber,
        phrase_id: phraseId,
        targetCategoryCode: 'UNKNOWN',
        categoryNum: '?',
        categoryLabel: 'Kategori Tidak Valid',
        phraseText: rawPhrase,
        semanticFunction: '',
        action: 'INVALID',
        actionReason: `Kategori "${rawCategory}" tidak dikenali sebagai bagian G2–G11.`,
      });
      continue;
    }

    if (!rawPhrase || rawPhrase.length < 3) {
      invalidCount++;
      parsedRows.push({
        lineNumber,
        phrase_id: phraseId,
        targetCategoryCode: categoryCode,
        categoryNum: G1G11_CATEGORY_METADATA[categoryCode]?.num || 'G?',
        categoryLabel: G1G11_CATEGORY_METADATA[categoryCode]?.label || categoryCode,
        phraseText: rawPhrase,
        semanticFunction: '',
        action: 'INVALID',
        actionReason: 'Teks frasa kosong atau terlalu pendek (minimal 3 karakter).',
      });
      continue;
    }

    // Rekam kategori yang terpengaruh (Section B Selective Category Synchronization)
    affectedCategoriesSet.add(categoryCode);
    const meta = G1G11_CATEGORY_METADATA[categoryCode];
    const normalizedText = normalizePhraseComparisonText(rawPhrase);

    // Inisialisasi lookup intra-file
    if (!seenInThisImport.has(categoryCode)) {
      seenInThisImport.set(categoryCode, new Set());
    }

    // 1. Cek apakah ada phrase_id permanen yang sudah terdaftar -> UPDATE (UPSERT)
    if (phraseId && existingIdMap.has(phraseId)) {
      const existingRec = existingIdMap.get(phraseId)!;

      // Cek apakah ada konflik kategori
      if (existingRec.categoryCode !== categoryCode) {
        invalidCount++;
        parsedRows.push({
          lineNumber,
          phrase_id: phraseId,
          targetCategoryCode: categoryCode,
          categoryNum: meta.num,
          categoryLabel: meta.label,
          phraseText: rawPhrase,
          semanticFunction: rawFunction || meta.semanticFunction,
          contextualMeaning: rawMeaning,
          usageContext: rawContext,
          usageSuggestion: rawSuggestion,
          usageRule: rawRule,
          action: 'INVALID',
          actionReason: `Konflik Kategori: ID ${phraseId} terdaftar pada ${existingRec.categoryCode}, namun CSV menargetkan ${categoryCode}. Menolak menimpa lintas kategori.`,
          existingRecord: existingRec,
        });
        continue;
      }

      updatedCount++;
      parsedRows.push({
        lineNumber,
        phrase_id: phraseId,
        targetCategoryCode: categoryCode,
        categoryNum: meta.num,
        categoryLabel: meta.label,
        phraseText: rawPhrase,
        semanticFunction: rawFunction || existingRec.semanticFunction,
        contextualMeaning: rawMeaning || existingRec.contextualMeaning,
        usageContext: rawContext || existingRec.usageContext,
        usageSuggestion: rawSuggestion || existingRec.usageSuggestion,
        usageRule: rawRule || existingRec.usageRule,
        action: 'UPDATE',
        actionReason: `Memperbarui record ID ${phraseId} (v${existingRec.version} -> v${existingRec.version + 1}).`,
        existingRecord: existingRec,
      });
      continue;
    }

    // 2. Cek apakah frasa sudah ada di repository atau di baris sebelumnya dalam file yang sama (Zero Duplicate Policy)
    const isExistingInDb = existingCategoryPhraseLookup.get(categoryCode)?.has(normalizedText);
    const isSeenInThisImport = seenInThisImport.get(categoryCode)?.has(normalizedText);

    if (isExistingInDb || isSeenInThisImport) {
      dupsCount++;
      parsedRows.push({
        lineNumber,
        phrase_id: phraseId,
        targetCategoryCode: categoryCode,
        categoryNum: meta.num,
        categoryLabel: meta.label,
        phraseText: rawPhrase,
        semanticFunction: rawFunction || meta.semanticFunction,
        contextualMeaning: rawMeaning,
        usageContext: rawContext,
        usageSuggestion: rawSuggestion,
        usageRule: rawRule,
        action: 'DUPLICATE',
        actionReason: isExistingInDb
          ? `Duplikat: Frasa ini sudah ada di dalam bank kategori ${meta.num} (Zero Duplicate Policy).`
          : `Duplikat berulang dalam file CSV yang sama.`,
      });
      continue;
    }

    // 3. Frasa baru yang sah
    seenInThisImport.get(categoryCode)!.add(normalizedText);
    newCount++;
    parsedRows.push({
      lineNumber,
      phrase_id: phraseId,
      targetCategoryCode: categoryCode,
      categoryNum: meta.num,
      categoryLabel: meta.label,
      phraseText: rawPhrase,
      semanticFunction: rawFunction || meta.semanticFunction,
      contextualMeaning: rawMeaning,
      usageContext: rawContext,
      usageSuggestion: rawSuggestion,
      usageRule: rawRule,
      action: 'NEW',
      actionReason: `Frasa baru akan ditambahkan ke kategori ${meta.num} (${meta.label}).`,
    });
  }

  const affectedCategories = Array.from(affectedCategoriesSet).sort();
  const allCategories = Object.keys(G1G11_CATEGORY_METADATA);
  const untouchedCategories = allCategories.filter((c) => !affectedCategoriesSet.has(c));

  return {
    isValid: newCount > 0 || updatedCount > 0,
    totalRows: parsedRows.length,
    affectedCategories,
    untouchedCategories,
    newPhrasesCount: newCount,
    updatedPhrasesCount: updatedCount,
    duplicatesCount: dupsCount,
    invalidCount: invalidCount,
    rows: parsedRows,
    sampleRows: parsedRows.slice(0, 10),
    validationErrors,
  };
}
