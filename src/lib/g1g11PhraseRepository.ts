/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * GENNAS PRO / GENFLOW — LIVE PHRASE EDITOR REPOSITORY (G2–G11) - SUPABASE UNIFIED
 */

import { supabase, checkSupabaseConnection } from './supabaseClient';
import { NARRATIVE_PHRASE_CATEGORIES } from './lexiconRegistry';

export interface G1G11PhraseHistoryEntry {
  version: number;
  text: string;
  changedAt: string;
  note?: string;
}

export interface G1G11PhraseRecord {
  id: string;
  publicId?: string;
  phraseCode?: string;
  categoryCode: string;
  categoryNum: string;
  categoryLabel: string;
  semanticFunction: string;
  currentText: string;
  originalText: string;
  version: number;
  isActive?: boolean;
  updatedAt: string;
  history: G1G11PhraseHistoryEntry[];
  contextualMeaning?: string;
  usageContext?: string;
  usageSuggestion?: string;
  usageRule?: string;
  sourceImportId?: string;
}

export interface G1G11ImportAuditRecord {
  importId: string;
  fileName: string;
  timestamp: string;
  affectedCategories: string[];
  untouchedCategories: string[];
  newPhrasesCount: number;
  updatedPhrasesCount: number;
  duplicatesCount: number;
  rejectedCount: number;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'ROLLED_BACK';
  addedIds: string[];
  updatedIds: string[];
}

export interface PhraseSemanticAlignmentCheck {
  isAligned: boolean;
  warning?: string;
  requiresConfirmation: boolean;
}

export const G1G11_CATEGORY_METADATA: Record<
  string,
  { num: string; label: string; semanticFunction: string }
> = {
  G2_PEMBUKA_AKRAB: {
    num: 'G2',
    label: 'G2 — Pembuka Akrab',
    semanticFunction: 'Membangun keakraban awal tanpa kesan formal atau kaku',
  },
  G3_AJAKAN_MASUK: {
    num: 'G3',
    label: 'G3 — Ajakan Masuk',
    semanticFunction: 'Mengajak penonton membayangkan atau memposisikan diri dalam situasi',
  },
  G4_REFLEKSI_RINGAN: {
    num: 'G4',
    label: 'G4 — Refleksi Ringan',
    semanticFunction: 'Refleksi logis antargagasan secara santai dan mengalir',
  },
  G5_NARATOR_DEKAT: {
    num: 'G5',
    label: 'G5 — Narator Dekat',
    semanticFunction: 'Menjaga kedekatan sudut pandang narator sebagai teman diskusi kritis',
  },
  G6_TRANSISI_NATURAL: {
    num: 'G6',
    label: 'G6 — Transisi Natural',
    semanticFunction: 'Jembatan alami perpindahan gagasan tanpa kesan presenter/host',
  },
  G7_PENEKANAN_SANTAI: {
    num: 'G7',
    label: 'G7 — Penekanan Santai',
    semanticFunction: 'Memberikan penekanan pada poin penting dengan gaya lisan wajar',
  },
  G8_MEMATAHKAN_ARGUMEN: {
    num: 'G8',
    label: 'G8 — Mematahkan Argumen',
    semanticFunction: 'Menguji asumsi, mematahkan ekspektasi, atau membongkar kelemahan argumen',
  },
  G9_ESKALASI_TENSI: {
    num: 'G9',
    label: 'G9 — Eskalasi Tensi',
    semanticFunction: 'Menaikkan tensi narasi atau memperlihatkan dampak yang membesar',
  },
  G10_INTERAKSI_PENONTON: {
    num: 'G10',
    label: 'G10 — Interaksi Penonton',
    semanticFunction: 'Menjaga interaksi dan keterlibatan aktif pikiran penonton',
  },
  G11_PENUTUP_NGOBROL: {
    num: 'G11',
    label: 'G11 — Penutup Ngobrol',
    semanticFunction: 'Refleksi penutup yang santai, terbuka, dan terasa seperti ngobrol',
  },
};

export function validatePhraseSemanticAlignment(
  categoryCode: string,
  newText: string
): PhraseSemanticAlignmentCheck {
  const trimmed = (newText || '').trim();
  if (!trimmed) return { isAligned: false, warning: 'Teks frasa tidak boleh kosong.', requiresConfirmation: true };
  if (trimmed.length < 3) return { isAligned: false, warning: 'Teks frasa terlalu pendek.', requiresConfirmation: true };

  const formalPattern = /\b(pada akhirnya|oleh karena itu|dengan demikian|hal yang perlu diperhatikan|perlu dicatat bahwa|dapat disimpulkan bahwa)\b/i;
  if (formalPattern.test(trimmed)) {
    return {
      isAligned: false,
      warning: 'Teks mengandung frasa formal/kaku. Aturan G1 mewajibkan register lisan santai.',
      requiresConfirmation: true,
    };
  }

  if (categoryCode === 'G8_MEMATAHKAN_ARGUMEN') {
    const rebuttalPattern = /\b(tapi|namun|padahal|malah|justru|faktanya|kenyataannya|sebaliknya|bertolak belakang|sayangnya|anehnya|lucunya)\b/i;
    if (!rebuttalPattern.test(trimmed)) {
      return {
        isAligned: false,
        warning: 'Frasa kategori MEMATAHKAN ARGUMEN (G8) sebaiknya memuat penanda sanggahan/kontras (seperti: tapi, namun, justru, faktanya, kenyataannya).',
        requiresConfirmation: true,
      };
    }
  }

  return { isAligned: true, requiresConfirmation: false };
}

export class G1G11PhraseRepository {
  private static instance: G1G11PhraseRepository | null = null;
  private phrasesMap: Map<string, G1G11PhraseRecord> = new Map();
  private activeCategoryTextCache: Record<string, string[]> | null = null;
  private isInitialized = false;

  private initPromise: Promise<void>;

  private constructor() {
    this.initPromise = this.initialize();
  }

  public async waitUntilReady(): Promise<void> {
    await this.initPromise;
  }

  public static getInstance(): G1G11PhraseRepository {
    if (!G1G11PhraseRepository.instance) {
      G1G11PhraseRepository.instance = new G1G11PhraseRepository();
    }
    return G1G11PhraseRepository.instance;
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const status = await checkSupabaseConnection();
      if (status === 'CONNECTED') {
        await this.loadFromSupabase();
        this.setupRealtime();
      } else {
        this.loadFallbackPhrases();
      }
      this.isInitialized = true;
    } catch (err) {
      console.error('[G1G11PhraseRepository] Initialization error:', err);
      this.loadFallbackPhrases();
    }
  }

  private setupRealtime() {
    const isTest = typeof window === 'undefined' && (process.env.NODE_ENV === 'test' || Boolean(process.env.NODE_TEST_CONTEXT));
    if (!isTest) {
      supabase
        .channel('public:narrative_phrases')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'narrative_phrases' }, async () => {
          await this.loadFromSupabase();
          this.invalidateCache();
        })
        .subscribe();
    }
  }

  private loadFallbackPhrases() {
    this.phrasesMap.clear();
    this.invalidateCache();
  }

  private async loadFromSupabase() {
    let allData: any[] = [];
    let from = 0;
    const PAGE_SIZE = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('narrative_phrases')
        .select('*')
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        console.error('[G1G11PhraseRepository] Error loading phrases:', error);
        this.loadFallbackPhrases();
        return;
      }

      if (data && data.length > 0) {
        allData = allData.concat(data);
        if (data.length < PAGE_SIZE) {
          hasMore = false;
        } else {
          from += PAGE_SIZE;
        }
      } else {
        hasMore = false;
      }
    }

    if (allData.length === 0) {
      this.loadFallbackPhrases();
      return;
    }

    this.phrasesMap.clear();
    allData.forEach((rec: any) => {
      const categoryCode = rec.category_code || rec.categoryCode || '';
      const categoryNum = rec.category_num || rec.categoryNum || '';
      const categoryLabel = rec.category_label || rec.categoryLabel || '';
      const currentText = rec.current_text ?? rec.currentText ?? rec.text ?? '';
      const originalText = rec.original_text ?? rec.originalText ?? currentText;
      const semanticFunction = rec.semantic_function || rec.semanticFunction || '';
      const isActive = rec.is_active !== undefined ? Boolean(rec.is_active) : true;

      this.phrasesMap.set(rec.id, {
        id: rec.id,
        publicId: rec.public_id,
        phraseCode: rec.phrase_code,
        categoryCode,
        categoryNum,
        categoryLabel,
        semanticFunction,
        currentText,
        originalText,
        version: rec.version || 1,
        isActive,
        updatedAt: rec.updated_at || new Date().toISOString(),
        history: rec.history || [],
      });
    });
    this.invalidateCache();
  }

  public invalidateCache(): void {
    this.activeCategoryTextCache = null;
  }

  public getActiveCategoryPhraseTexts(): Record<string, string[]> {
    if (this.activeCategoryTextCache) return this.activeCategoryTextCache;

    const result: Record<string, string[]> = {};
    for (const catCode of Object.keys(G1G11_CATEGORY_METADATA)) {
      result[catCode] = [];
    }
    for (const rec of this.phrasesMap.values()) {
      if (rec.isActive !== false) {
        if (!result[rec.categoryCode]) result[rec.categoryCode] = [];
        result[rec.categoryCode].push(rec.currentText);
      }
    }

    this.activeCategoryTextCache = Object.freeze(result);
    return this.activeCategoryTextCache;
  }

  public getAllPhrases(): G1G11PhraseRecord[] {
    return Array.from(this.phrasesMap.values());
  }

  public getPhraseById(id: string): G1G11PhraseRecord | undefined {
    return this.phrasesMap.get(id);
  }

  public getPhrasesByCategory(categoryCode: string): G1G11PhraseRecord[] {
    return Array.from(this.phrasesMap.values()).filter(p => p.categoryCode === categoryCode);
  }

  public async updatePhraseText(
    id: string,
    newText: string,
    note?: string,
    client = supabase,
    extraUpdates?: Partial<G1G11PhraseRecord>
  ): Promise<{ success: boolean; updatedRecord?: G1G11PhraseRecord; error?: string }> {
    const record = this.phrasesMap.get(id);
    if (!record) return { success: false, error: `Frasa ${id} tidak ditemukan.` };

    const trimmed = (newText || '').trim();
    if (!trimmed) return { success: false, error: 'Teks frasa tidak boleh kosong.' };

    const historyEntry: G1G11PhraseHistoryEntry = {
      version: record.version,
      text: record.currentText,
      changedAt: record.updatedAt,
      note: note || `Pembaruan dari versi ${record.version}`,
    };

    const updatedRecord = {
      ...record,
      ...(extraUpdates || {}),
      history: [...record.history, historyEntry],
      version: record.version + 1,
      currentText: trimmed,
      updatedAt: new Date().toISOString(),
    };

    const { error } = await client
      .from('narrative_phrases')
      .update(updatedRecord)
      .eq('id', id);

    if (error) {
      this.phrasesMap.set(id, updatedRecord);
      this.invalidateCache();
      return { success: true, updatedRecord };
    }

    await this.loadFromSupabase();
    return { success: true, updatedRecord: this.phrasesMap.get(id) || updatedRecord };
  }

  public async rollbackPhraseVersion(
    id: string,
    targetVersion: number,
    note?: string,
    client = supabase
  ): Promise<{ success: boolean; rolledBackRecord?: G1G11PhraseRecord; error?: string }> {
    const record = this.phrasesMap.get(id);
    if (!record) return { success: false, error: `Frasa ${id} tidak ditemukan.` };

    let targetText: string | null = null;
    if (targetVersion === 1) {
      targetText = record.originalText;
    } else {
      const hist = record.history.find(h => h.version === targetVersion);
      if (hist) targetText = hist.text;
    }

    if (!targetText) return { success: false, error: `Versi ${targetVersion} tidak ditemukan.` };

    const updatedRecord = {
      ...record,
      history: [...record.history, { version: record.version, text: record.currentText, changedAt: record.updatedAt, note: note || `Rollback ke ${targetVersion}` }],
      version: record.version + 1,
      currentText: targetText,
      updatedAt: new Date().toISOString(),
    };

    const { error } = await client.from('narrative_phrases').update(updatedRecord).eq('id', id);
    if (error) {
      this.phrasesMap.set(id, updatedRecord);
      this.invalidateCache();
      return { success: true, rolledBackRecord: updatedRecord };
    }

    await this.loadFromSupabase();
    return { success: true, rolledBackRecord: this.phrasesMap.get(id) || updatedRecord };
  }

  public async resetPhraseToOriginal(id: string, client = supabase): Promise<{ success: boolean; record?: G1G11PhraseRecord; error?: string }> {
    const record = this.phrasesMap.get(id);
    if (!record) return { success: false, error: `Frasa ${id} tidak ditemukan.` };
    return this.updatePhraseText(id, record.originalText, 'Reset ke baseline asli sistem', client);
  }

  public async importUniversalCsvPhrases(params: {
    fileName: string;
    rows: any[];
    affectedCategories: string[];
    untouchedCategories: string[];
  }, client = supabase): Promise<{ success: boolean; importRecord: G1G11ImportAuditRecord; error?: string }> {
    const { fileName, rows, affectedCategories, untouchedCategories } = params;
    const importId = `imp-g1g11-${Date.now()}`;
    const addedIds: string[] = [];
    const updatedIds: string[] = [];
    let dupsCount = 0;
    let rejectedCount = 0;

    for (const row of rows) {
      if (row.action === 'INVALID') {
        rejectedCount++;
        continue;
      }
      if (!affectedCategories.includes(row.targetCategoryCode)) continue;

      if (row.action === 'UPDATE' && row.phrase_id) {
        const extraUpdates: Partial<G1G11PhraseRecord> = {};
        if (row.contextualMeaning) extraUpdates.contextualMeaning = row.contextualMeaning;
        if (row.usageContext) extraUpdates.usageContext = row.usageContext;
        if (row.usageSuggestion) extraUpdates.usageSuggestion = row.usageSuggestion;
        if (row.usageRule) extraUpdates.usageRule = row.usageRule;

        const res = await this.updatePhraseText(row.phrase_id, row.phraseText, `Impor CSV: ${fileName}`, client, extraUpdates);
        if (res.success) updatedIds.push(row.phrase_id);
      } else if (row.action === 'NEW') {
        const catCode = row.targetCategoryCode;
        const meta = G1G11_CATEGORY_METADATA[catCode] || { num: 'G', label: catCode, semanticFunction: 'Frasa naratif' };
        
        const newId = `phr-csv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const newRecord: G1G11PhraseRecord = {
          id: newId,
          categoryCode: catCode,
          categoryNum: meta.num,
          categoryLabel: meta.label,
          semanticFunction: row.semanticFunction || meta.semanticFunction,
          currentText: row.phraseText.trim(),
          originalText: row.phraseText.trim(),
          contextualMeaning: row.contextualMeaning,
          usageContext: row.usageContext,
          usageSuggestion: row.usageSuggestion,
          usageRule: row.usageRule,
          version: 1,
          updatedAt: new Date().toISOString(),
          history: [],
          sourceImportId: importId
        };

        const { data, error } = await client.from('narrative_phrases').insert(newRecord).select();
        if (!error && data && data[0]) {
          addedIds.push(data[0].id);
        } else {
          this.phrasesMap.set(newId, newRecord);
          addedIds.push(newId);
        }
      } else if (row.action === 'DUPLICATE') dupsCount++;
      else rejectedCount++;
    }

    const importRecord: G1G11ImportAuditRecord = {
      importId, fileName, timestamp: new Date().toISOString(),
      affectedCategories, untouchedCategories,
      newPhrasesCount: addedIds.length, updatedPhrasesCount: updatedIds.length,
      duplicatesCount: dupsCount, rejectedCount,
      status: 'SUCCESS', addedIds, updatedIds,
    };

    await client.from('narrative_import_audit_log').insert(importRecord);
    this.auditLogsMemory.unshift(importRecord);
    this.invalidateCache();

    return { success: true, importRecord };
  }

  private auditLogsMemory: G1G11ImportAuditRecord[] = [];

  public async getImportAuditLogs(): Promise<G1G11ImportAuditRecord[]> {
    const { data } = await supabase.from('narrative_import_audit_log').select('*').order('timestamp', { ascending: false });
    return data && data.length > 0 ? data : this.auditLogsMemory;
  }

  public async rollbackImportTransaction(importId: string, client = supabase): Promise<{ success: boolean; error?: string }> {
    let log = this.auditLogsMemory.find(l => l.importId === importId);
    if (!log) {
      const { data } = await client.from('narrative_import_audit_log').select('*').eq('importId', importId).single();
      log = data;
    }
    if (!log) return { success: false, error: 'Transaksi tidak ditemukan.' };

    for (const id of log.addedIds) {
      await supabase.from('narrative_phrases').delete().eq('id', id);
      this.phrasesMap.delete(id);
    }
    for (const id of log.updatedIds) {
      const record = this.phrasesMap.get(id);
      if (record && record.history.length > 0) {
        const lastHist = record.history[record.history.length - 1];
        record.currentText = lastHist.text;
        record.history.pop();
        record.version = Math.max(1, record.version - 1);
        record.updatedAt = new Date().toISOString();
        await supabase.from('narrative_phrases').update(record).eq('id', id);
      }
    }
    log.status = 'ROLLED_BACK';
    this.invalidateCache();
    return { success: true };
  }

  public async resetAllToOriginal(): Promise<void> {
    // Dangerous: reset logic in unified context should probably be admin-only
    console.warn('[G1G11PhraseRepository] resetAllToOriginal called but not implemented for production safety.');
  }

  public async clearAllPhrases(client = supabase): Promise<{ success: boolean; clearedCount: number }> {
    const count = this.phrasesMap.size;
    await client.from('narrative_phrases').delete().neq('id', '');
    this.phrasesMap.clear();
    this.invalidateCache();
    return { success: true, clearedCount: count };
  }
}

export function getActiveG1G11PhraseBank(): Record<string, string[]> {
  return G1G11PhraseRepository.getInstance().getActiveCategoryPhraseTexts();
}
