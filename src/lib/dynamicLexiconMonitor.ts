/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * DYNAMIC LEXICON MONITOR (READ-ONLY) — GenNAS Pro V6.4
 *
 * Sesuai Spesifikasi:
 * 1. PISAHKAN BANK PERMANEN DAN MONITOR DINAMIS:
 *    - MASTER_LEXICON_REGISTRY: Berisi seluruh kosakata F1–F8 dari Supabase Master Lexicon Repository
 *      (Single Source of Truth). Tidak ada data lokal hardcoded.
 *    - DYNAMIC_LEXICON_MONITOR: Menampilkan hingga 56 slot reaktif berdasarkan clean_script aktif.
 * 2. KONDISI SEBELUM GENERATE / SETELAH RESET:
 *    - Tampilkan entri awal dari Supabase Master Lexicon, seluruhnya berwarna gelap (isUsed = false).
 *    - Tidak ada indikator kuning atau label "Dipakai".
 *    - Jumlah kosakata digunakan = 0.
 * 3. SETELAH GENERATE / REAL-TIME EDITING:
 *    - Memindai clean_script aktif dengan tokenisasi batas kata akurat.
 *    - Kata yang digunakan ditandai KUNING ("Dipakai").
 * 4. ONE-WAY READ-ONLY DATA FLOW:
 *    - Modul ini 100% read-only terhadap generator, clean_script, dan validator.
 */

import {
  normalizeLexiconEntry,
} from './lexiconRegistry';
import { masterLexiconRepository } from './masterLexiconRepository';
import {
  getCanonicalDedupKey,
} from './expansionLexiconBank';
import { CustomLexiconState, getCustomLexiconState } from './customLexiconStore';

export type LexiconCategoryCode =
  | 'F1_CORE'
  | 'F2_SUFFIX_IN'
  | 'F3_PREFIX'
  | 'F4_MARKER'
  | 'F5_VERB'
  | 'F6_EXAMPLE'
  | 'EXPANSION'
  | 'CUSTOM';

export interface MasterLexiconItem {
  id: string;
  word: string;
  canonicalKey: string;
  category: LexiconCategoryCode;
  categoryLabel: string;
  isMultiWord: boolean;
}

export interface LexiconMonitorSlot {
  slotIndex: number;
  slotId: string;
  displayedWord: string;
  canonicalKey: string;
  category: LexiconCategoryCode;
  categoryLabel: string;
  isUsed: boolean;
  occurrencesCount: number;
  replacedOriginalWord?: string;
}

export interface UsedLexiconMatch {
  word: string;
  canonicalKey: string;
  category: LexiconCategoryCode;
  categoryLabel: string;
  occurrencesCount: number;
  firstIndexInScript: number;
}

export interface DynamicLexiconMonitorResult {
  hasActiveScript: boolean;
  totalSlots: number;
  totalUsedCount: number;
  usedWords: UsedLexiconMatch[];
  slots: LexiconMonitorSlot[];
  overflowUsedWords: UsedLexiconMatch[];
  masterRegistryCount: number;
  coreInventoryCount: number;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
}

export function buildAccurateWordBoundaryRegex(targetWord: string): RegExp {
  const cleanWord = targetWord.trim();
  const escaped = escapeRegex(cleanWord);
  return new RegExp(`(?:^|[^a-zA-Z0-9À-ÿ_\\-])${escaped}(?=[^a-zA-Z0-9À-ÿ_\\-]|\$)`, 'giu');
}

let cachedMasterRegistry: MasterLexiconItem[] | null = null;
let cachedCustomHash = '';

export function getMasterLexiconRegistry(customState?: CustomLexiconState): MasterLexiconItem[] {
  const currentCustom = customState || getCustomLexiconState();
  const customHash = JSON.stringify(currentCustom);

  if (cachedMasterRegistry && cachedCustomHash === customHash) {
    return cachedMasterRegistry;
  }

  const itemsMap = new Map<string, MasterLexiconItem>();

  const addEntry = (
    word: string,
    category: LexiconCategoryCode,
    categoryLabel: string,
    prefixId: string
  ) => {
    const normalized = normalizeLexiconEntry(word);
    if (!normalized) return;
    const key = getCanonicalDedupKey(normalized);
    if (!key) return;

    if (!itemsMap.has(key)) {
      itemsMap.set(key, {
        id: `${prefixId}:${key}`,
        word: normalized,
        canonicalKey: key,
        category,
        categoryLabel,
        isMultiWord: normalized.includes(' '),
      });
    }
  };

  masterLexiconRepository.getUnifiedEntries().forEach((e) => {
    let catCode: LexiconCategoryCode = 'EXPANSION';
    if (e.primary_category === 'F1') catCode = 'F1_CORE';
    else if (e.primary_category === 'F2') catCode = 'F2_SUFFIX_IN';
    else if (e.primary_category === 'F3') catCode = 'F3_PREFIX';
    else if (e.primary_category === 'F4') catCode = 'F4_MARKER';
    else if (e.primary_category === 'F5') catCode = 'F5_VERB';
    else if (e.primary_category === 'F6') catCode = 'F6_EXAMPLE';

    addEntry(e.entry, catCode, e.category_label || 'Master Repository', 'repo');
  });

  Object.entries(currentCustom).forEach(([sec, words]) => {
    (words as string[]).forEach((w: string) => {
      addEntry(w, 'CUSTOM', `Kustom ${sec}`, 'custom');
    });
  });

  const registry = Array.from(itemsMap.values());
  cachedMasterRegistry = registry;
  cachedCustomHash = customHash;
  return registry;
}

export function scanUsedLexiconInScript(
  cleanScript: string,
  customState?: CustomLexiconState
): UsedLexiconMatch[] {
  if (!cleanScript || typeof cleanScript !== 'string' || !cleanScript.trim()) {
    return [];
  }

  const registry = getMasterLexiconRegistry(customState);
  const matched: UsedLexiconMatch[] = [];

  const sortedRegistry = [...registry].sort((a, b) => {
    if (a.isMultiWord && !b.isMultiWord) return -1;
    if (!a.isMultiWord && b.isMultiWord) return 1;
    return b.word.length - a.word.length;
  });

  for (const item of sortedRegistry) {
    const rx = buildAccurateWordBoundaryRegex(item.word);
    let occurrencesCount = 0;
    let firstIndex = -1;
    let m: RegExpExecArray | null;

    while ((m = rx.exec(cleanScript)) !== null) {
      occurrencesCount += 1;
      if (firstIndex === -1) {
        firstIndex = m.index;
      }
    }

    if (occurrencesCount > 0) {
      matched.push({
        word: item.word,
        canonicalKey: item.canonicalKey,
        category: item.category,
        categoryLabel: item.categoryLabel,
        occurrencesCount,
        firstIndexInScript: firstIndex,
      });
    }
  }

  matched.sort((a, b) => a.firstIndexInScript - b.firstIndexInScript);
  return matched;
}

export function computeDynamicLexiconMonitor(
  cleanScript: string,
  customState?: CustomLexiconState
): DynamicLexiconMonitorResult {
  const masterRegistry = getMasterLexiconRegistry(customState);
  const masterRegistryMap = new Map(masterRegistry.map((item) => [item.canonicalKey, item]));
  const initial56Items = masterRegistry.slice(0, 56);
  const initial56Keys = initial56Items.map((item) => item.canonicalKey);

  const hasActiveScript = Boolean(cleanScript && cleanScript.trim().length > 0);

  if (!hasActiveScript) {
    const initialSlots: LexiconMonitorSlot[] = initial56Items.map((item, idx) => ({
      slotIndex: idx + 1,
      slotId: `slot-${idx + 1}-${item.canonicalKey}`,
      displayedWord: item.word,
      canonicalKey: item.canonicalKey,
      category: item.category,
      categoryLabel: item.categoryLabel,
      isUsed: false,
      occurrencesCount: 0,
    }));

    return {
      hasActiveScript: false,
      totalSlots: initialSlots.length,
      totalUsedCount: 0,
      usedWords: [],
      slots: initialSlots,
      overflowUsedWords: [],
      masterRegistryCount: masterRegistry.length,
      coreInventoryCount: initialSlots.length,
    };
  }

  const usedMatches = scanUsedLexiconInScript(cleanScript, customState);
  const usedMap = new Map(usedMatches.map((m) => [m.canonicalKey, m]));

  const usedCoreKeys = new Set(
    initial56Keys.filter((k) => usedMap.has(k))
  );

  const usedNonCoreMatches = usedMatches.filter(
    (m) => !initial56Keys.includes(m.canonicalKey)
  );

  const replacementQueue = [...usedNonCoreMatches];
  const slots: LexiconMonitorSlot[] = [];

  for (let idx = 0; idx < initial56Items.length; idx++) {
    const originalItem = initial56Items[idx];
    const originalKey = originalItem.canonicalKey;
    const isCoreWordUsed = usedCoreKeys.has(originalKey);

    if (isCoreWordUsed) {
      const matchData = usedMap.get(originalKey)!;
      slots.push({
        slotIndex: idx + 1,
        slotId: `slot-${idx + 1}-${originalKey}`,
        displayedWord: originalItem.word,
        canonicalKey: originalKey,
        category: matchData.category,
        categoryLabel: matchData.categoryLabel,
        isUsed: true,
        occurrencesCount: matchData.occurrencesCount,
      });
    } else {
      if (replacementQueue.length > 0) {
        const replacement = replacementQueue.shift()!;
        slots.push({
          slotIndex: idx + 1,
          slotId: `slot-${idx + 1}-${replacement.canonicalKey}`,
          displayedWord: replacement.word,
          canonicalKey: replacement.canonicalKey,
          category: replacement.category,
          categoryLabel: replacement.categoryLabel,
          isUsed: true,
          occurrencesCount: replacement.occurrencesCount,
          replacedOriginalWord: originalItem.word,
        });
      } else {
        slots.push({
          slotIndex: idx + 1,
          slotId: `slot-${idx + 1}-${originalKey}`,
          displayedWord: originalItem.word,
          canonicalKey: originalKey,
          category: originalItem.category,
          categoryLabel: originalItem.categoryLabel,
          isUsed: false,
          occurrencesCount: 0,
        });
      }
    }
  }

  const overflowUsedWords = [...replacementQueue];

  return {
    hasActiveScript: true,
    totalSlots: slots.length,
    totalUsedCount: usedMatches.length,
    usedWords: usedMatches,
    slots,
    overflowUsedWords,
    masterRegistryCount: masterRegistry.length,
    coreInventoryCount: slots.length,
  };
}
