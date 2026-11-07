/**
 * Store & Registry untuk Kosakata Tambahan Pengguna (F1 - F6) - SUPABASE UNIFIED
 * Otomatis terintegrasi ke Master Prompt, Antarmuka Frontend, dan Pipeline Generasi Naskah.
 */

import { masterLexiconRepository } from './masterLexiconRepository';
import { getCanonicalDedupKey } from './expansionLexiconBank';
import { supabase } from './supabaseClient';

export interface CustomLexiconState {
  F1: string[];
  F2: string[];
  F3: string[];
  F4: string[];
  F5: string[];
  F6: string[];
}

/**
 * Mengambil state kosakata kustom yang ditambahkan pengguna.
 * Sekarang membaca langsung dari Master Lexicon Repository di Supabase.
 */
export function getCustomLexiconState(): CustomLexiconState {
  const entries = masterLexiconRepository.getUnifiedEntries();
  const state: CustomLexiconState = {
    F1: [], F2: [], F3: [], F4: [], F5: [], F6: [],
  };

  entries.forEach(item => {
    const cat = item.primary_category;
    if (state[cat as keyof CustomLexiconState]) {
      state[cat as keyof CustomLexiconState].push(item.entry);
    }
  });

  return state;
}

export function setCustomLexiconState(_newState: Partial<CustomLexiconState>) {
  // Operasi bulk set dihentikan untuk mendukung integritas database terpadu.
  // Gunakan addCustomWord untuk penambahan individual.
  console.warn('[CustomLexiconStore] setCustomLexiconState is deprecated in Unified Architecture.');
}

/**
 * Menambahkan kosakata kustom ke repository terpadu di Supabase.
 */
export async function addCustomWord(
  section: 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'F6',
  rawWord: string,
  client = supabase
): Promise<{ success: boolean; word: string; error?: string; updatedList: string[] }> {
  const cleanWord = rawWord
    .trim()
    .replace(/[.,;!?]+$/, '')
    .trim();

  if (!cleanWord) {
    return { success: false, word: '', error: 'Kata tidak boleh kosong.', updatedList: [] };
  }

  // Cek apakah sudah ada
  const state = getCustomLexiconState();
  if (state[section].some(w => w.toLowerCase() === cleanWord.toLowerCase())) {
    return { success: false, word: cleanWord, error: `Kata "${cleanWord}" sudah ada di ${section}.`, updatedList: state[section] };
  }

  // Impor ke repository (ini akan meng-insert ke Supabase)
  const result = await masterLexiconRepository.importUniversalCsv({
    name: 'Custom-User-Add',
    fileName: 'user_addition.csv',
    rows: [{
      kata: cleanWord,
      kategori: section,
      inferredStatus: 'ALLOW'
    }]
  }, client);

  const updatedState = getCustomLexiconState();
  return {
    success: result.success,
    word: cleanWord,
    error: result.success ? undefined : result.message,
    updatedList: updatedState[section]
  };
}

export function formatCustomLexiconForMasterPrompt(): string {
  const state = getCustomLexiconState();
  const allSections: string[] = [];

  if (state.F1.length > 0) allSections.push(`- KOSAKATA INTI F1 TAMBAHAN: ${state.F1.join(', ')}`);
  if (state.F2.length > 0) allSections.push(`- KOSAKATA F2 (-in) TAMBAHAN: ${state.F2.join(', ')}`);
  if (state.F3.length > 0) allSections.push(`- KOSAKATA F3 (ng/ny) TAMBAHAN: ${state.F3.join(', ')}`);
  if (state.F4.length > 0) allSections.push(`- PENANDA PERCAKAPAN F4 TAMBAHAN: ${state.F4.join(', ')}`);
  if (state.F5.length > 0) allSections.push(`- VERBA PERCAKAPAN F5 TAMBAHAN: ${state.F5.join(', ')}`);
  if (state.F6.length > 0) allSections.push(`- KAJIAN LISAN F6 TAMBAHAN: ${state.F6.join(', ')}`);

  if (allSections.length === 0) return '';

  return `\n\n==================== KOSAKATA TAMBAHAN PENGGUNA (AKTIF & PRIORITAS PILIHAN) ====================\nKata-kata berikut ditambahkan oleh pengguna secara sah ke dalam Bank Kosakata dan menjadi pilihan prioritas untuk diintegrasikan secara kontekstual ke dalam narasi naskah:\n${allSections.join('\n')}\n`;
}
