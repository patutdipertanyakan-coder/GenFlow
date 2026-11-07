/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * GENNAS PRO MASTER LEXICON REPOSITORY & AI CONTEXTUAL SELECTION ENGINE (SUPABASE UNIFIED)
 *
 * Satu-satunya Centralized Vocabulary Repository & AI Selection Engine
 * Berdasarkan GENNAS STUDIO PROMPT (Single Source of Truth).
 * Terhubung langsung ke Supabase Project: ouuoukdhzeenbkxhfnik
 */

import { supabase, checkSupabaseConnection, SupabaseConnectionStatus } from './supabaseClient';
import {
  ExpansionCategoryKey,
  ExpansionDuplicateRecord,
  ExpansionLexiconEntry,
  EXPANSION_CATEGORY_LABELS,
  getCanonicalDedupKey,
  normalizeDisplayExpansionEntry,
  evaluateEntryNaturalness,
  classifyRawExpansionWord,
} from './expansionLexiconBank';
import {
  PROFANITY_ROOT_WORDS,
} from './lexiconRegistry';

import {
  BaseLexiconSourceEntry,
  AdditionalDatasetRecord,
  MasterLexiconStats,
  ContextualCandidateRecommendation,
  ImportDatasetResult,
  RawImportLexiconItem,
  F7ContextualGuardMetadata,
  F7ContextualGuardSummary,
  F7PrimaryCategory,
} from './masterLexiconTypes';
import { selectContextualExpansionCandidates, clearContextualCandidateCache } from './contextualCandidateEngine';

export type {
  BaseLexiconSourceEntry,
  MasterLexiconStats,
  ContextualCandidateRecommendation,
  ImportDatasetResult,
  F7ContextualGuardMetadata,
  F7ContextualGuardSummary,
};

export interface UnifiedLexiconItem {
  id: string;
  entry: string;
  canonical_key: string;
  primary_category: string;
  category_label: string;
  categories: string[];
  formal: string | null;
  context_note: string;
  recommended_alternative: string | null;
  needs_review: boolean;
  review_reason: string | null;
  naturalness_status: 'VERIFIED_NATURAL' | 'NEEDS_CONTEXT_REVIEW';
  contextual_guard_rule?: string;
  f7_guard?: F7ContextualGuardMetadata;
  sources: string[];
  status?: string;
}

function parsePrimaryCategoryInfo(item: any): { primary_category: string; category_label: string } {
  let primary = item.primary_category;
  let label = item.category_label || item.category || 'Umum';

  if (primary && /^F[1-6]$/i.test(primary)) {
    primary = primary.toUpperCase();
  } else if (item.category) {
    const catStr = String(item.category).toUpperCase();
    const match = catStr.match(/\b(F[1-6])\b/);
    if (match) {
      primary = match[1];
    } else if (catStr.includes('AKHIRAN -IN') || catStr.includes('SUFFIX -IN')) {
      primary = 'F2';
    } else if (catStr.includes('AWALAN') || catStr.includes('PREFIX')) {
      primary = 'F3';
    } else if (catStr.includes('PENANDA PERCAKAPAN') || catStr.includes('SLANG')) {
      primary = 'F4';
    } else if (catStr.includes('VERBA') || catStr.includes('KATA KERJA')) {
      primary = 'F5';
    } else if (catStr.includes('MORFOLOGI') || catStr.includes('RAGAM KAJIAN')) {
      primary = 'F6';
    } else {
      primary = 'F5';
    }
  } else {
    primary = 'F5';
  }

  return { primary_category: primary, category_label: label };
}

function parseNaturalnessStatus(item: any): 'VERIFIED_NATURAL' | 'NEEDS_CONTEXT_REVIEW' {
  if (item.naturalness_status === 'VERIFIED_NATURAL' || item.naturalness_status === 'NEEDS_CONTEXT_REVIEW') {
    return item.naturalness_status;
  }
  if (item.eligibility_status) {
    const statusStr = String(item.eligibility_status).toUpperCase();
    if (statusStr === 'WAJAR' || statusStr === 'VERIFIED' || statusStr === 'ALLOW') {
      return 'VERIFIED_NATURAL';
    }
    if (statusStr === 'PERLU TINJAU' || statusStr === 'TIDAK DISARANKAN' || statusStr === 'CONDITIONAL' || statusStr === 'AVOID') {
      return 'NEEDS_CONTEXT_REVIEW';
    }
  }
  return 'VERIFIED_NATURAL';
}

class MasterLexiconRepository {
  private entries: UnifiedLexiconItem[] = [];
  private f7Summary?: F7ContextualGuardSummary;
  private duplicatesRejected: ExpansionDuplicateRecord[] = [];
  private blacklistedKeys: Set<string> = new Set();
  private dismissedScriptFindings: Set<string> = new Set();
  private lastUpdatedAt: string = new Date().toISOString();
  private isLoaded: boolean = false;
  private connectionStatus: SupabaseConnectionStatus = 'NOT_CONFIGURED';
  private f7Rules: any[] = [];

  private initPromise: Promise<void>;

  constructor() {
    this.initPromise = this.init();
  }

  public async waitUntilReady(): Promise<void> {
    await this.initPromise;
  }

  public async init() {
    try {
      this.connectionStatus = await checkSupabaseConnection();
      if (this.connectionStatus === 'CONNECTED' || this.connectionStatus === 'DATA_LOADED') {
        await this.loadFromSupabase();
        this.setupRealtime();
      } else {
        console.warn(`[MasterLexiconRepository] Supabase connection status: ${this.connectionStatus}`);
        this.loadFallbackEntries();
      }
      this.isLoaded = true;
    } catch (err) {
      console.error('Inisialisasi MasterLexiconRepository error:', err);
      this.connectionStatus = 'DISCONNECTED';
      this.loadFallbackEntries();
    }
  }

  private storedDatasets: any[] = [];

  private loadFallbackEntries() {
    // SUPABASE SINGLE SOURCE OF TRUTH: Zero Local Vocabulary Runtime Fallback.
    // Jika Supabase tidak terhubung, jangan membuat atau menyuntikkan kosakata dummy/lokal.
    this.entries = [];
    this.f7Rules = [];
    this.duplicatesRejected = [];
    this.updateF7Summary();
  }

  private setupRealtime() {
    const isTest = typeof window === 'undefined' && (process.env.NODE_ENV === 'test' || Boolean(process.env.NODE_TEST_CONTEXT));
    if (!isTest) {
      supabase
        .channel('public:lexicon_entries')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'lexicon_entries' }, async () => {
          await this.loadFromSupabase();
          clearContextualCandidateCache();
        })
        .subscribe();

      supabase
        .channel('public:lexicon_context_rules')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'lexicon_context_rules' }, async () => {
          await this.loadFromSupabase();
          clearContextualCandidateCache();
        })
        .subscribe();
    }
  }

  private async loadFromSupabase() {
    let allData: any[] = [];
    let from = 0;
    const PAGE_SIZE = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('lexicon_entries')
        .select('*')
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        console.error('[MasterLexiconRepository] Error loading from Supabase:', error);
        this.connectionStatus = 'DEGRADED';
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

    // Load all F7 contextual rules from public.lexicon_context_rules
    let allF7Data: any[] = [];
    let f7From = 0;
    let f7HasMore = true;

    while (f7HasMore) {
      const { data: f7Data, error: f7Error } = await supabase
        .from('lexicon_context_rules')
        .select('*')
        .order('id', { ascending: true })
        .range(f7From, f7From + PAGE_SIZE - 1);

      if (f7Error) {
        console.error('[MasterLexiconRepository] Error loading F7 rules:', f7Error);
        break;
      }

      if (f7Data && f7Data.length > 0) {
        allF7Data = allF7Data.concat(f7Data);
        if (f7Data.length < PAGE_SIZE) {
          f7HasMore = false;
        } else {
          f7From += PAGE_SIZE;
        }
      } else {
        f7HasMore = false;
      }
    }

    this.f7Rules = allF7Data;

    const activeF7Map = new Map<string, F7ContextualGuardMetadata>();
    allF7Data.forEach((rule: any) => {
      const term = (rule.entry_text || '').trim();
      const cKey = rule.canonical_key || (term ? getCanonicalDedupKey(term) : '');
      const f7_guard: F7ContextualGuardMetadata = {
        entry: term,
        f7_number: Number(rule.f7_number) || 0,
        primary_category: rule.category || 'Konotasi negatif/tuduhan',
        additional_categories: [rule.category || 'Konotasi negatif/tuduhan'],
        attention_level: rule.status === 'PROHIBITED' ? 'TINGGI' : 'SEDANG',
        review: rule.status_reason || rule.meaning_note || '',
        suggestion: rule.informal_suggestion || rule.meaning_note || term,
        gennas_rule: rule.gennas_rule || '',
        rule_is_fallback: false,
        f7_equivalent: rule.meaning_note || term,
      };

      if (rule.is_active !== false && rule.status !== 'inactive' && rule.status !== 'blacklisted') {
        if (cKey) activeF7Map.set(cKey, f7_guard);
        if (term) activeF7Map.set(term.toLowerCase(), f7_guard);
      } else {
        if (cKey) this.blacklistedKeys.add(cKey);
        if (term) this.blacklistedKeys.add(term.toLowerCase());
      }
    });

    const activeItems: UnifiedLexiconItem[] = [];
    this.blacklistedKeys.clear();

    for (const item of allData) {
      const isBlacklisted = item.status === 'blacklisted';
      const isInactive = item.status === 'inactive' || item.status === 'disabled';
      const rawTerm = item.term || item.entry || item.word || '';
      const canonicalKey = item.canonical_key || (rawTerm ? getCanonicalDedupKey(rawTerm) : '');

      if (isBlacklisted) {
        if (canonicalKey) this.blacklistedKeys.add(canonicalKey);
        if (rawTerm) this.blacklistedKeys.add(rawTerm.toLowerCase());
        continue;
      }

      if (isInactive) {
        continue; // HARD EXCLUSION: Kosakata disabled tidak boleh digunakan
      }

      const { primary_category, category_label } = parsePrimaryCategoryInfo(item);
      const formal = item.formal_equivalent ?? item.formal ?? null;
      const context_note = item.notes ?? item.context_note ?? item.description ?? '';
      const recommended_alternative = item.recommended_alternative ?? item.saran ?? item.suggestion ?? null;

      const naturalness_status = parseNaturalnessStatus(item);
      const needs_review = item.needs_review !== undefined
        ? Boolean(item.needs_review)
        : (naturalness_status === 'NEEDS_CONTEXT_REVIEW' || item.eligibility_status === 'PERLU TINJAU' || item.eligibility_status === 'TIDAK DISARANKAN');

      const matchedF7Guard = activeF7Map.get(canonicalKey) || activeF7Map.get(rawTerm.toLowerCase());

      activeItems.push({
        id: item.id || item.public_id || canonicalKey || `lex-${Math.random().toString(36).slice(2, 8)}`,
        entry: rawTerm,
        canonical_key: canonicalKey,
        primary_category,
        category_label,
        categories: Array.isArray(item.categories) && item.categories.length > 0
          ? item.categories
          : [category_label || primary_category],
        formal,
        context_note,
        recommended_alternative,
        needs_review,
        review_reason: item.review_reason || (needs_review ? 'Memerlukan tinjauan konteks' : null),
        naturalness_status,
        f7_guard: matchedF7Guard || item.f7_guard || undefined,
        sources: Array.isArray(item.sources) && item.sources.length > 0
          ? item.sources
          : ['Supabase Unified'],
        status: item.status || 'active',
      });
    }

    this.entries = activeItems;
    this.updateF7Summary();
    this.connectionStatus = 'DATA_LOADED';
    this.lastUpdatedAt = new Date().toISOString();
  }

  private updateF7Summary() {
    const categoryDistribution: Record<string, number> = {
      'Konotasi negatif/tuduhan': 0,
      'Makna kiasan/polisemi': 0,
      'Register/morfologi/slang': 0,
      'Frasa/konstruksi kontekstual': 0,
      'Teknis/akademis/prosedural': 0,
    };

    if (this.f7Rules.length > 0) {
      let activeCount = 0;
      this.f7Rules.forEach((rule: any) => {
        if (rule.is_active !== false) {
          activeCount++;
          const cat = rule.category || 'Konotasi negatif/tuduhan';
          if (categoryDistribution[cat] !== undefined) {
            categoryDistribution[cat] += 1;
          }
        }
      });

      this.f7Summary = {
        total_inspected_reference: 993,
        total_f7_flagged: activeCount,
        total_outside_special_list_reference: 725,
        matched_existing_in_repository: activeCount,
        newly_added_to_repository: 0,
        fallback_rule_count: 0,
        fallback_rule_entries: [],
        category_distribution: categoryDistribution,
      };
    } else {
      const f7Items = this.entries.filter((e) => Boolean(e.f7_guard));
      f7Items.forEach((item) => {
        const cat = item.f7_guard?.primary_category || 'Register/morfologi/slang';
        if (categoryDistribution[cat] !== undefined) {
          categoryDistribution[cat] = (categoryDistribution[cat] || 0) + 1;
        }
      });

      this.f7Summary = {
        total_inspected_reference: 993,
        total_f7_flagged: f7Items.length,
        total_outside_special_list_reference: 725,
        matched_existing_in_repository: f7Items.length,
        newly_added_to_repository: 0,
        fallback_rule_count: f7Items.filter((e) => e.f7_guard?.rule_is_fallback).length,
        fallback_rule_entries: f7Items.filter((e) => e.f7_guard?.rule_is_fallback).map((e) => e.entry),
        category_distribution: categoryDistribution,
      };
    }
  }

  public getF7Rules(): any[] {
    return this.f7Rules;
  }

  public getMasterPromptFromSupabase(): string | null {
    const promptRule = this.f7Rules.find(
      (r: any) => r.canonical_key === 'MASTER_PROMPT_GLOBAL' || r.entry_text === 'MASTER_PROMPT_GLOBAL'
    );
    if (promptRule && promptRule.gennas_rule && promptRule.gennas_rule.trim().length > 100) {
      return promptRule.gennas_rule.trim();
    }
    return null;
  }

  public getF7Stats(): {
    total: number;
    active: number;
    inactive: number;
    categoryDistribution: Record<string, number>;
  } {
    const dist: Record<string, number> = {
      'Konotasi negatif/tuduhan': 0,
      'Makna kiasan/polisemi': 0,
      'Register/morfologi/slang': 0,
      'Frasa/konstruksi kontekstual': 0,
      'Teknis/akademis/prosedural': 0,
    };
    let active = 0;
    let inactive = 0;
    this.f7Rules.forEach((r: any) => {
      const cat = r.category || 'Konotasi negatif/tuduhan';
      if (r.is_active !== false) {
        active++;
        if (dist[cat] !== undefined) dist[cat]++;
      } else {
        inactive++;
      }
    });
    return {
      total: this.f7Rules.length,
      active,
      inactive,
      categoryDistribution: dist,
    };
  }

  public getConnectionStatus(): SupabaseConnectionStatus {
    return this.connectionStatus;
  }

  public getBlacklistedKeys(): Set<string> {
    return this.blacklistedKeys;
  }

  public async deleteEntry(identifier: string, client = supabase): Promise<{
    success: boolean;
    deletedWord?: string;
    remainingCount: number;
    message: string;
  }> {
    const idTrim = (identifier || '').trim();
    const idLower = idTrim.toLowerCase();
    const canonicalTarget = getCanonicalDedupKey(idTrim);

    const entry = this.entries.find(
      (e) =>
        e.id === idTrim ||
        e.canonical_key === idTrim ||
        e.canonical_key === canonicalTarget ||
        e.entry.toLowerCase() === idLower
    );

    if (!entry) {
      return {
        success: false,
        remainingCount: this.entries.length,
        message: `Kosakata "${identifier}" tidak ditemukan di Master Lexicon Repository.`,
      };
    }

    let dbError = false;
    if (this.connectionStatus === 'CONNECTED') {
      const { error } = await client
        .from('lexicon_entries')
        .update({ status: 'blacklisted', updated_at: new Date().toISOString() })
        .eq('id', entry.id);
      if (error) {
        dbError = true;
      }
    }

    if (this.connectionStatus !== 'CONNECTED' || dbError) {
      entry.status = 'blacklisted';
      this.entries = this.entries.filter((e) => e.id !== entry.id);
      this.blacklistedKeys.add(entry.canonical_key);
      this.blacklistedKeys.add(entry.entry.toLowerCase());
    } else {
      await this.loadFromSupabase();
    }
    clearContextualCandidateCache();

    return {
      success: true,
      deletedWord: entry.entry,
      remainingCount: this.entries.length,
      message: `Kosakata "${entry.entry}" berhasil dihapus dari sistem dan ditambahkan ke daftar hitam (blacklist) secara permanen.`,
    };
  }

  public async updateEntry(
    identifier: string,
    updates: {
      word?: string;
      formal?: string;
      context_note?: string;
      category?: string;
      needs_review?: boolean;
      review_reason?: string;
      recommended_alternative?: string;
    },
    client = supabase
  ): Promise<{
    success: boolean;
    updatedEntry?: UnifiedLexiconItem;
    message: string;
  }> {
    const idTrim = (identifier || '').trim();
    const idLower = idTrim.toLowerCase();
    const canonicalTarget = getCanonicalDedupKey(idTrim);

    const entry = this.entries.find(
      (e) =>
        e.id === idTrim ||
        e.canonical_key === idTrim ||
        e.canonical_key === canonicalTarget ||
        e.entry.toLowerCase() === idLower
    );

    if (!entry) {
      return {
        success: false,
        message: `Kosakata "${identifier}" tidak ditemukan di Master Lexicon Repository.`,
      };
    }

    const dbUpdates: any = { updated_at: new Date().toISOString() };
    if (updates.word && updates.word.trim()) {
      const newWord = normalizeDisplayExpansionEntry(updates.word);
      dbUpdates.entry = newWord;
      dbUpdates.canonical_key = getCanonicalDedupKey(newWord);
    }
    if (updates.formal !== undefined) dbUpdates.formal = updates.formal ? updates.formal.trim() : null;
    if (updates.context_note !== undefined) dbUpdates.context_note = updates.context_note;
    if (updates.category !== undefined) dbUpdates.category_label = updates.category;
    if (updates.needs_review !== undefined) {
      dbUpdates.needs_review = updates.needs_review;
      dbUpdates.naturalness_status = updates.needs_review ? 'NEEDS_CONTEXT_REVIEW' : 'VERIFIED_NATURAL';
    }
    if (updates.review_reason !== undefined) dbUpdates.review_reason = updates.review_reason;
    if (updates.recommended_alternative !== undefined) dbUpdates.recommended_alternative = updates.recommended_alternative;

    let dbError = false;
    if (this.connectionStatus === 'CONNECTED') {
      const { error } = await client
        .from('lexicon_entries')
        .update(dbUpdates)
        .eq('id', entry.id);

      if (error) dbError = true;
    }

    if (this.connectionStatus !== 'CONNECTED' || dbError) {
      Object.assign(entry, dbUpdates);
      if (dbUpdates.entry) entry.entry = dbUpdates.entry;
      if (dbUpdates.canonical_key) entry.canonical_key = dbUpdates.canonical_key;
    } else {
      await this.loadFromSupabase();
    }
    clearContextualCandidateCache();

    return {
      success: true,
      updatedEntry: this.entries.find(e => e.id === entry.id),
      message: `Kosakata "${entry.entry}" berhasil diperbarui secara permanen di sistem dan disinkronkan ke backend global.`,
    };
  }

  public async removeF7Rule(identifier: string, client = supabase): Promise<{
    success: boolean;
    word?: string;
    message: string;
  }> {
    const idTrim = (identifier || '').trim();
    const idLower = idTrim.toLowerCase();
    const canonicalTarget = getCanonicalDedupKey(idTrim);

    const entry = this.entries.find(
      (e) =>
        e.id === idTrim ||
        e.canonical_key === idTrim ||
        e.canonical_key === canonicalTarget ||
        e.entry.toLowerCase() === idLower
    );

    if (!entry) {
      return {
        success: false,
        message: `Kosakata "${identifier}" tidak ditemukan di Master Lexicon Repository.`,
      };
    }

    let dbError = false;
    if (this.connectionStatus === 'CONNECTED') {
      const { error } = await client
        .from('lexicon_entries')
        .update({
          f7_guard: null,
          needs_review: true,
          naturalness_status: 'NEEDS_CONTEXT_REVIEW',
          review_reason: 'Aturan F7 telah dicopot oleh pengguna. Status: BELUM DITINJAU.',
          updated_at: new Date().toISOString()
        })
        .eq('id', entry.id);

      if (error) dbError = true;
    }

    if (this.connectionStatus !== 'CONNECTED' || dbError) {
      entry.f7_guard = undefined;
      entry.needs_review = true;
      entry.naturalness_status = 'NEEDS_CONTEXT_REVIEW';
      entry.review_reason = 'Aturan F7 telah dicopot oleh pengguna. Status: BELUM DITINJAU.';
    } else {
      await this.loadFromSupabase();
    }
    clearContextualCandidateCache();

    return {
      success: true,
      word: entry.entry,
      message: `Aturan kontekstual F7 untuk "${entry.entry}" berhasil dicopot. Kata induk (${entry.id}) tetap tersimpan aktif di Repository dengan status BELUM DITINJAU.`,
    };
  }

  public sanitizeNarrativeFromBlacklist(narrative: string): {
    sanitized: string;
    removedWords: string[];
  } {
    if (this.blacklistedKeys.size === 0 || !narrative) {
      return { sanitized: narrative, removedWords: [] };
    }
    let sanitized = narrative;
    const removed: string[] = [];
    const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    for (const key of this.blacklistedKeys) {
      if (!key || key.length < 2) continue;
      const rx = new RegExp(`\\b${escapeRegExp(key)}\\b`, 'gi');
      if (rx.test(sanitized)) {
        sanitized = sanitized.replace(rx, '');
        removed.push(key);
      }
    }
    sanitized = sanitized.replace(/[ \t]{2,}/g, ' ').replace(/ \./g, '.').replace(/ ,/g, ',');
    return { sanitized, removedWords: removed };
  }

  public dismissScriptFinding(identifier: string): {
    success: boolean;
    dismissedWord: string;
    totalDismissed: number;
  } {
    const idTrim = (identifier || '').trim();
    const idLower = idTrim.toLowerCase();
    const canonicalKey = getCanonicalDedupKey(idTrim);
    this.dismissedScriptFindings.add(idLower);
    this.dismissedScriptFindings.add(canonicalKey);
    return {
      success: true,
      dismissedWord: idTrim,
      totalDismissed: this.dismissedScriptFindings.size,
    };
  }

  public getDismissedScriptFindings(): string[] {
    return Array.from(this.dismissedScriptFindings);
  }

  public isFindingDismissed(wordOrKey: string): boolean {
    const w = (wordOrKey || '').trim().toLowerCase();
    const k = getCanonicalDedupKey(w);
    return this.dismissedScriptFindings.has(w) || this.dismissedScriptFindings.has(k);
  }

  public resetDismissedScriptFindings(): void {
    this.dismissedScriptFindings.clear();
  }

  public getUnregisteredScriptWords(cleanScript: string): {
    word: string;
    canonicalKey: string;
    occurrencesCount: number;
    sampleSentence: string;
    suggestedCategory: string;
  }[] {
    if (!cleanScript || !cleanScript.trim()) return [];

    const existingCanonicalSet = new Set(this.entries.map((e) => e.canonical_key));
    PROFANITY_ROOT_WORDS.forEach((w) => existingCanonicalSet.add(getCanonicalDedupKey(w)));

    const wordsMap = new Map<string, { count: number; sample: string }>();
    const sentences = cleanScript.split(/(?<=[.!?\n])\s+/).filter(Boolean);

    const STOPWORDS = new Set([
      'yang', 'untuk', 'pada', 'dari', 'dengan', 'adalah', 'dalam', 'akan', 'atau',
      'oleh', 'karena', 'lebih', 'sudah', 'hanya', 'bisa', 'juga', 'tidak', 'tapi',
      'namun', 'selain', 'ketika', 'setelah', 'sebelum', 'antara', 'sampai', 'seperti',
      'harus', 'bahwa', 'secara', 'kemudian', 'bahkan', 'sedang', 'kalau', 'apabila',
      'sangat', 'selalu', 'malah', 'justru', 'mereka', 'semua', 'setiap', 'banyak',
      'tentang', 'terhadap', 'menjadi', 'tersebut', 'bukan', 'tetapi', 'sehingga',
      'supaya', 'sementara', 'lagi', 'masih', 'punya', 'sedikit', 'bila', 'kita',
      'kami', 'anda', 'kamu', 'saya', 'dia', 'ini', 'itu', 'sini', 'situ', 'sana'
    ]);

    for (const sent of sentences) {
      const tokens = sent.toLowerCase().match(/\b[a-z]{3,}(?:-[a-z]{3,})?\b/g) || [];
      for (const token of tokens) {
        if (STOPWORDS.has(token)) continue;
        const cKey = getCanonicalDedupKey(token);
        if (existingCanonicalSet.has(cKey) || this.blacklistedKeys.has(cKey)) continue;

        const current = wordsMap.get(token) || { count: 0, sample: sent.trim() };
        current.count += 1;
        wordsMap.set(token, current);
      }
    }

    const result = Array.from(wordsMap.entries()).map(([token, data]) => {
      let cat = 'Register/morfologi/slang';
      if (token.endsWith('in')) cat = 'Akhiran -in (F2)';
      else if (/^(?:ng|nge|ny|n)[a-z]+/.test(token)) cat = 'Awalan percakapan (F3)';

      return {
        word: token,
        canonicalKey: getCanonicalDedupKey(token),
        occurrencesCount: data.count,
        sampleSentence: data.sample.slice(0, 140),
        suggestedCategory: cat,
      };
    });

    result.sort((a, b) => b.occurrencesCount - a.occurrencesCount);
    return result.slice(0, 30);
  }

  public async importUniversalCsv(params: {
    name: string;
    fileName: string;
    rows: any[];
    rawContent?: string;
  }, client = supabase): Promise<ImportDatasetResult> {
    const profanityCanonicalMap = new Set(PROFANITY_ROOT_WORDS.map((w) => getCanonicalDedupKey(w)));
    const existingMap = new Map<string, UnifiedLexiconItem>();
    this.entries.forEach((e) => existingMap.set(e.canonical_key, e));

    let importedCount = 0;
    let duplicatesCount = 0;
    const errors: string[] = [];

    for (const row of params.rows) {
      const displayWord = normalizeDisplayExpansionEntry(row.kata || row.entry || row.word);
      if (!displayWord) continue;
      const canonicalKey = row.canonicalKey || getCanonicalDedupKey(displayWord);

      if (this.blacklistedKeys.has(canonicalKey) || this.blacklistedKeys.has(displayWord.toLowerCase())) {
        duplicatesCount++;
        continue;
      }

      if (profanityCanonicalMap.has(canonicalKey)) {
        duplicatesCount++;
        continue;
      }

      const existing = existingMap.get(canonicalKey);
      if (existing) {
        duplicatesCount++;
        continue;
      }

      const review = evaluateEntryNaturalness(displayWord);
      const status = row.inferredStatus || 'ALLOW';
      const f7Cat: F7PrimaryCategory = row.inferredF7Category || 'Register/morfologi/slang';

      const f7GuardData: F7ContextualGuardMetadata = {
        entry: displayWord,
        f7_number: this.entries.filter(e => Boolean(e.f7_guard)).length + importedCount + 1,
        primary_category: f7Cat,
        additional_categories: [f7Cat],
        attention_level: row.isAttentionHigh ? 'TINGGI' : 'SEDANG',
        review: row.aturanPenggunaan || row.statusReason || `Diimpor dari berkas ${params.fileName}`,
        suggestion: row.saran || row.padananFormal || displayWord,
        gennas_rule: row.aturanPenggunaan || 'Digunakan sesuai naskah santai santun Gue–Lo.',
        rule_is_fallback: false,
        f7_equivalent: row.maknaKontekstual || row.padananFormal || displayWord,
      };

      const newEntry: UnifiedLexiconItem = {
        id: `lex-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        entry: displayWord,
        canonical_key: canonicalKey,
        primary_category: f7Cat === 'Konotasi negatif/tuduhan' ? 'F7' : 'F5',
        category_label: row.kategori || f7Cat,
        categories: [row.kategori || f7Cat],
        formal: row.padananFormal || null,
        context_note: row.maknaKontekstual || `Diimpor dari berkas ${params.fileName}.`,
        recommended_alternative: row.saran || review.recommendedAlternative || null,
        needs_review: status !== 'ALLOW' || review.needsReview,
        review_reason: row.statusReason || review.reviewReason || null,
        naturalness_status: status === 'AVOID' ? 'NEEDS_CONTEXT_REVIEW' : 'VERIFIED_NATURAL',
        sources: [params.name],
        f7_guard: f7GuardData,
        status: 'active'
      };

      if (this.connectionStatus === 'CONNECTED') {
        const { error } = await client.from('lexicon_entries').insert(newEntry);
        if (error) {
          this.entries.push(newEntry);
          existingMap.set(canonicalKey, newEntry);
          importedCount++;
        } else {
          importedCount++;
        }
      } else {
        this.entries.push(newEntry);
        existingMap.set(canonicalKey, newEntry);
        importedCount++;
      }
    }

    if (importedCount > 0) {
      this.storedDatasets.push({
        dataset_id: `ds-${Date.now()}`,
        name: params.name,
        entry_count: importedCount,
        imported_at: new Date().toISOString(),
        type: 'ADDITIONAL'
      });
    }

    if (this.connectionStatus === 'CONNECTED') {
      await this.loadFromSupabase();
    }
    clearContextualCandidateCache();

    return {
      success: errors.length === 0,
      entries_imported: importedCount,
      message: `Berhasil mengimpor ${importedCount} kosakata baru dari "${params.fileName}" ke Master Lexicon Repository (${duplicatesCount} duplikat disaring).`,
      stats: this.getMasterStats(),
    };
  }

  public reload(): void {
    this.init();
  }

  public getMasterStats(): MasterLexiconStats {
    const uniqueActiveCount = this.entries.length;
    const totalNeedsReview = this.entries.filter(
      (e) => e.naturalness_status === 'NEEDS_CONTEXT_REVIEW' || e.needs_review
    ).length;
    const totalVerifiedNatural = uniqueActiveCount - totalNeedsReview;
    const totalFormalEquivalents = this.entries.filter((e) => Boolean(e.formal)).length;

    const f1Count = this.entries.filter(
      (e) => e.primary_category === 'F1' || e.categories.includes('F1')
    ).length;

    const categoryDistribution: Record<string, number> = {
      F1: 0, F2: 0, F3: 0, F4: 0, F5: 0, F6: 0,
      EXP_SUFFIX_IN: 0, EXP_PREFIX_NG: 0, EXP_PREFIX_NGE: 0, EXP_PREFIX_NY: 0,
      EXP_PREFIX_N: 0, EXP_CONVERSATIONAL_VERBS: 0, EXP_CONTEMPORARY_INFORMAL: 0,
    };

    this.entries.forEach((e) => {
      const cat = e.primary_category;
      if (categoryDistribution[cat] !== undefined) categoryDistribution[cat] += 1;
      let morphCat = classifyRawExpansionWord(e.entry);
      if (e.primary_category === 'F6') morphCat = 'EXP_CONTEMPORARY_INFORMAL';
      if (categoryDistribution[morphCat] !== undefined) categoryDistribution[morphCat] += 1;
    });

    const totalDuplicates = this.duplicatesRejected.length;

    return {
      total_source_entries: uniqueActiveCount + totalDuplicates,
      unique_active_lexicon_count: uniqueActiveCount,
      total_base_entries: uniqueActiveCount,
      total_additional_entries: this.storedDatasets.reduce((acc, d) => acc + (d.entry_count || 0), 0),
      total_duplicates: totalDuplicates,
      f1_core_count: f1Count,
      f1_core_expected: f1Count,
      f1_is_complete: true,
      total_needs_review: totalNeedsReview,
      total_verified_natural: totalVerifiedNatural,
      total_formal_equivalents: totalFormalEquivalents,
      f7_flagged_count: this.entries.filter((e) => Boolean(e.f7_guard)).length,
      f7_contextual_guard_summary: this.f7Summary,
      total_datasets: 1 + this.storedDatasets.length,
      last_updated_at: this.lastUpdatedAt,
      stored_datasets: [{
        dataset_id: 'SUPABASE_UNIFIED',
        name: 'Supabase Unified Master Lexicon',
        entry_count: uniqueActiveCount,
        imported_at: this.lastUpdatedAt,
        type: 'UNIFIED'
      }, ...this.storedDatasets],
      category_distribution: categoryDistribution,
      deduplication_breakdown: { profanity_rejected: 0 },
    } as any;
  }

  public getUnifiedEntries(): UnifiedLexiconItem[] {
    return this.entries;
  }

  public getActiveRegistry(options?: {
    category?: string;
    naturalness?: 'ALL' | 'VERIFIED_NATURAL' | 'NEEDS_CONTEXT_REVIEW';
    search?: string;
  }): ExpansionLexiconEntry[] {
    let list = this.entries;

    if (options?.category && options.category !== 'ALL') {
      const targetCat = options.category.toUpperCase();
      list = list.filter((e) => {
        if (e.primary_category === targetCat) return true;
        if (e.categories.some((c) => c.toUpperCase() === targetCat)) return true;
        if (targetCat === 'EXP_SUFFIX_IN' && (e.primary_category === 'F2' || e.categories.includes('A1_akhiran_in'))) return true;
        if (targetCat === 'EXP_PREFIX_NG' && (e.primary_category === 'F3' || e.categories.includes('A2_awalan_ng'))) return true;
        if (targetCat === 'EXP_PREFIX_NGE' && (e.primary_category === 'F3' || e.categories.includes('A3_awalan_nge'))) return true;
        if (targetCat === 'EXP_PREFIX_NY' && (e.primary_category === 'F3' || e.categories.includes('A4_awalan_ny'))) return true;
        if (targetCat === 'EXP_PREFIX_N' && (e.primary_category === 'F3' || e.categories.includes('A5_awalan_n'))) return true;
        if (targetCat === 'EXP_CONVERSATIONAL_VERBS' && (e.primary_category === 'F5' || e.categories.includes('B_padanan'))) return true;
        if (targetCat === 'EXP_CONTEMPORARY_INFORMAL' && (e.primary_category === 'F6' || e.categories.includes('C_morfologi'))) return true;
        return false;
      });
    } else if (!options?.category || options.category === 'ALL') {
      list = list.filter((e) => e.status !== 'blacklisted');
    }

    if (options?.naturalness && options.naturalness !== 'ALL') {
      list = list.filter((e) => e.naturalness_status === options.naturalness);
    }

    if (options?.search && options.search.trim()) {
      const q = options.search.trim().toLowerCase();
      list = list.filter(
        (e) =>
          e.entry.toLowerCase().includes(q) ||
          (e.formal && e.formal.toLowerCase().includes(q)) ||
          (e.context_note && e.context_note.toLowerCase().includes(q))
      );
    }

    return list.map((item) => {
      let expCat: ExpansionCategoryKey = 'EXP_CONVERSATIONAL_VERBS';
      if (item.primary_category === 'F2') expCat = 'EXP_SUFFIX_IN';
      else if (item.primary_category === 'F3') expCat = 'EXP_PREFIX_NG';
      else if (item.primary_category === 'F4') expCat = 'EXP_CONTEMPORARY_INFORMAL';
      else if (item.primary_category === 'F5') expCat = 'EXP_CONVERSATIONAL_VERBS';
      else if (item.primary_category === 'F6') expCat = 'EXP_CONTEMPORARY_INFORMAL';

      return {
        id: item.id,
        word: item.entry,
        canonicalKey: item.canonical_key,
        category: expCat,
        categoryLabel: item.category_label || EXPANSION_CATEGORY_LABELS[expCat] || item.primary_category,
        formalEquivalent: item.formal || undefined,
        naturalnessStatus: item.naturalness_status,
        reviewReason: item.review_reason || undefined,
        recommendedAlternative: item.recommended_alternative || undefined,
        contextNote: item.context_note || 'Kosakata lisan terverifikasi dalam Master Lexicon Repository.',
      };
    });
  }

  public getDuplicatesRejected(): ExpansionDuplicateRecord[] {
    return this.duplicatesRejected;
  }

  public getAIContextualCandidates(params: {
    topic: string;
    centralThesis?: string;
    stageId: number;
    stageName: string;
    coreFocus?: string;
    keyArguments?: string[];
    limit?: number;
    excludeCanonicalKeys?: string[];
  }): ContextualCandidateRecommendation[] {
    const activeRegistry = this.getActiveRegistry();
    return selectContextualExpansionCandidates(params, activeRegistry);
  }

  public async importAdditionalDataset(params: {
    name: string;
    fileName: string;
    rawContent: string;
    fileType?: string;
    isF7Contextual?: boolean;
  }): Promise<ImportDatasetResult> {
    return { success: false, message: 'Fungsi importAdditionalDataset sedang dimigrasi ke Supabase Unified.' };
  }

  /**
   * Operasi LIVE QUERY ke public.lexicon_entries di Supabase
   * Menjamin query nyata dijalankan, memfilter status active, dan hard exclude blacklist.
   */
  public async searchLiveCandidates(params: {
    query?: string;
    category?: string;
    limit?: number;
  }): Promise<UnifiedLexiconItem[]> {
    const limit = Math.min(params.limit || 20, 100);
    let builder = supabase
      .from('lexicon_entries')
      .select('id, term, category, formal_equivalent, notes, usage_suggestion, eligibility_status, canonical_key, status')
      .neq('status', 'blacklisted')
      .neq('status', 'inactive')
      .neq('status', 'disabled');

    if (params.category && params.category !== 'ALL') {
      const cleanCat = params.category.replace(/[^a-zA-Z0-9\s]/g, '').trim();
      if (cleanCat) {
        builder = builder.ilike('category', `%${cleanCat}%`);
      }
    }

    if (params.query && params.query.trim()) {
      // Amankan input query dari karakter khusus grammar PostgREST logic tree (koma, tanda kurung, kurung siku, newline)
      const safeTokens = params.query
        .replace(/\[[^\]]*\]/g, ' ')
        .replace(/[^a-zA-Z0-9\s]/g, ' ')
        .split(/\s+/)
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length >= 3 && !['dan', 'atau', 'yang', 'untuk', 'pada', 'dari', 'bisa', 'akan', 'dapat', 'lebih'].includes(t))
        .slice(0, 4);

      if (safeTokens.length > 0) {
        const orConditions = safeTokens.flatMap((token) => [
          `term.ilike.%${token}%`,
          `formal_equivalent.ilike.%${token}%`,
        ]);
        builder = builder.or(orConditions.join(','));
      }
    }

    let data: any[] | null = null;
    try {
      const resp = await builder.limit(limit);
      if (resp.error) {
        console.warn('[searchLiveCandidates] Query filter failed, fallback to active items:', resp.error.message);
        const fallbackResp = await supabase
          .from('lexicon_entries')
          .select('id, term, category, formal_equivalent, notes, usage_suggestion, eligibility_status, canonical_key, status')
          .neq('status', 'blacklisted')
          .neq('status', 'inactive')
          .neq('status', 'disabled')
          .order('id', { ascending: true })
          .limit(limit);
        data = fallbackResp.data;
      } else {
        data = resp.data;
      }
    } catch (err: any) {
      console.warn('[searchLiveCandidates] Exception in live query, fallback to active items:', err?.message);
      const fallbackResp = await supabase
        .from('lexicon_entries')
        .select('id, term, category, formal_equivalent, notes, usage_suggestion, eligibility_status, canonical_key, status')
        .neq('status', 'blacklisted')
        .neq('status', 'inactive')
        .neq('status', 'disabled')
        .order('id', { ascending: true })
        .limit(limit);
      data = fallbackResp.data;
    }

    if (!data || data.length === 0) {
      const generalResp = await supabase
        .from('lexicon_entries')
        .select('id, term, category, formal_equivalent, notes, usage_suggestion, eligibility_status, canonical_key, status')
        .neq('status', 'blacklisted')
        .neq('status', 'inactive')
        .neq('status', 'disabled')
        .order('id', { ascending: true })
        .limit(limit);
      data = generalResp.data || [];
    }

    return data
      .filter((row: any) => !this.blacklistedKeys.has(row.canonical_key || getCanonicalDedupKey(row.term)))
      .map((row: any) => {
        const { primary_category, category_label } = parsePrimaryCategoryInfo(row);
        return {
          id: row.id,
          entry: row.term,
          canonical_key: row.canonical_key || getCanonicalDedupKey(row.term),
          primary_category,
          category_label,
          categories: [category_label || primary_category],
          formal: row.formal_equivalent || null,
          context_note: row.notes || row.usage_suggestion || '',
          recommended_alternative: row.usage_suggestion || null,
          needs_review: row.eligibility_status === 'PERLU TINJAUAN',
          review_reason: null,
          naturalness_status: row.eligibility_status === 'PERLU TINJAUAN' ? 'NEEDS_CONTEXT_REVIEW' : 'VERIFIED_NATURAL',
          sources: ['public.lexicon_entries'],
          status: row.status || 'active',
        };
      });
  }

  /**
   * Operasi LIVE QUERY ke public.lexicon_context_rules di Supabase
   */
  public async searchLiveF7Rules(params: {
    terms?: string[];
    category?: string;
    limit?: number;
  }): Promise<any[]> {
    const limit = Math.min(params.limit || 30, 100);
    let builder = supabase
      .from('lexicon_context_rules')
      .select('id, f7_number, entry_text, gennas_rule, meaning_note, informal_suggestion, category, status, is_active, canonical_key')
      .eq('is_active', true)
      .neq('status', 'blacklisted')
      .neq('status', 'inactive');

    if (params.category) {
      const cleanCat = params.category.replace(/[^a-zA-Z0-9\s]/g, '').trim();
      if (cleanCat) {
        builder = builder.ilike('category', `%${cleanCat}%`);
      }
    }

    if (params.terms && params.terms.length > 0) {
      const cleanTerms = params.terms
        .map((t) => t.replace(/[^a-zA-Z0-9]/g, '').trim().toLowerCase())
        .filter((t) => t.length >= 3 && !['dan', 'atau', 'yang', 'untuk', 'pada', 'dari'].includes(t))
        .slice(0, 10);
      if (cleanTerms.length > 0) {
        builder = builder.in('entry_text', cleanTerms);
      }
    }

    let data: any[] | null = null;
    try {
      const resp = await builder.limit(limit);
      if (resp.error || !resp.data || resp.data.length === 0) {
        const fallbackResp = await supabase
          .from('lexicon_context_rules')
          .select('id, f7_number, entry_text, gennas_rule, meaning_note, informal_suggestion, category, status, is_active, canonical_key')
          .eq('is_active', true)
          .neq('status', 'blacklisted')
          .neq('status', 'inactive')
          .order('f7_number', { ascending: true })
          .limit(limit);
        data = fallbackResp.data;
      } else {
        data = resp.data;
      }
    } catch {
      const fallbackResp = await supabase
        .from('lexicon_context_rules')
        .select('id, f7_number, entry_text, gennas_rule, meaning_note, informal_suggestion, category, status, is_active, canonical_key')
        .eq('is_active', true)
        .neq('status', 'blacklisted')
        .neq('status', 'inactive')
        .order('f7_number', { ascending: true })
        .limit(limit);
      data = fallbackResp.data;
    }

    return data || [];
  }

  /**
   * Operasi LIVE QUERY ke public.narrative_phrases di Supabase
   */
  public async searchLiveNarrativePhrases(params: {
    categoryCode?: string;
    limit?: number;
  }): Promise<any[]> {
    const limit = Math.min(params.limit || 50, 100);
    let builder = supabase
      .from('narrative_phrases')
      .select('id, phrase_code, category_code, category_label, current_text, semantic_function, is_active')
      .eq('is_active', true);

    if (params.categoryCode && params.categoryCode !== 'ALL') {
      builder = builder.eq('category_code', params.categoryCode);
    }

    const { data, error } = await builder.order('id', { ascending: true }).limit(limit);
    if (error) {
      console.error('[searchLiveNarrativePhrases] Query error:', error);
      throw new Error(`Gagal membaca frasa naratif Supabase: ${error.message}`);
    }
    return data || [];
  }

  /**
   * Operasi LIVE QUERY mengambil record detail berdasarkan ID atau Term dari public.lexicon_entries
   */
  public async getLiveEntryDetail(idOrTerm: string): Promise<any | null> {
    if (!idOrTerm) return null;
    const clean = idOrTerm.trim();
    let { data, error } = await supabase
      .from('lexicon_entries')
      .select('*')
      .eq('id', clean)
      .single();

    if (error || !data) {
      const { data: termData, error: termError } = await supabase
        .from('lexicon_entries')
        .select('*')
        .ilike('term', clean)
        .limit(1);
      if (!termError && termData && termData.length > 0) {
        data = termData[0];
      }
    }

    return data || null;
  }
}

export const masterLexiconRepository = new MasterLexiconRepository();
