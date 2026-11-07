/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Definisi Tipe Data Master Lexicon Repository, F7 Contextual Guard & AI Selection Engine
 * Berdasarkan GENNAS STUDIO PROMPT (Single Source of Truth)
 */

import { ExpansionCategoryKey } from './expansionLexiconBank';

export type MasterLexiconCategoryCode = 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'F6';

export type F7PrimaryCategory =
  | 'Konotasi negatif/tuduhan'
  | 'Makna kiasan/polisemi'
  | 'Register/morfologi/slang'
  | 'Frasa/konstruksi kontekstual'
  | 'Teknis/akademis/prosedural';

export interface F7ContextualGuardMetadata {
  f7_number: number;
  entry: string;
  primary_category: F7PrimaryCategory | string;
  additional_categories: string[];
  attention_level: 'TINGGI' | 'SEDANG' | 'RENDAH' | string;
  review: string;
  suggestion: string;
  gennas_rule: string;
  f7_equivalent: string;
  rule_is_fallback: boolean;
}

export interface F7ContextualGuardSummary {
  total_inspected_reference: number;
  total_f7_flagged: number;
  total_outside_special_list_reference: number;
  matched_existing_in_repository: number;
  newly_added_to_repository: number;
  fallback_rule_count: number;
  fallback_rule_entries: string[];
  category_distribution: Record<string, number>;
}

export interface BaseLexiconSourceEntry {
  id: string;
  source_dataset?: string;
  source_id?: number;
  category: ExpansionCategoryKey | MasterLexiconCategoryCode | string;
  category_original?: string;
  entry: string;
  formal: string | null;
  needs_review: boolean;
  review_reason: string | null;
  recommended_alternative: string | null;
  context_note: string;
}

export interface MasterLexiconEntryRecord {
  id: string;
  entry: string;
  canonical_key: string;
  primary_category: MasterLexiconCategoryCode | string;
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
}

export interface MasterExpansionDatasetMeta {
  dataset_id: string;
  name: string;
  file_origin: string;
  entry_count: number;
  imported_at: string;
}

export interface AdditionalDatasetRecord {
  dataset_id: string;
  name: string;
  file_name: string;
  checksum: string;
  imported_at: string;
  entry_count: number;
  entries: BaseLexiconSourceEntry[];
}

export interface MasterLexiconStats {
  total_source_entries: number;
  unique_active_lexicon_count: number;
  total_duplicates: number;
  f1_core_count: number;
  f1_core_expected: number;
  f1_is_complete: boolean;
  total_formal_equivalents: number;
  total_verified_natural: number;
  total_needs_review: number;
  f7_flagged_count?: number;
  f7_contextual_guard_summary?: F7ContextualGuardSummary;
  category_distribution: Record<string, number>;
  deduplication_breakdown: {
    profanity_rejected: number;
    literal_duplicates?: number;
    case_variants?: number;
    hyphen_variants?: number;
    f1_duplicates?: number;
    f2_f6_duplicates?: number;
    internal_duplicates?: number;
    capital_variants?: number;
    [key: string]: number | undefined;
  };
  stored_datasets: Array<{
    dataset_id: string;
    name: string;
    entry_count: number;
    imported_at: string;
    type: 'BASE' | 'ADDITIONAL' | 'UNIFIED';
  }>;
  last_updated_at: string;
  // Kompatibilitas mundur
  total_base_entries: number;
  total_additional_entries: number;
  total_datasets: number;
}

export interface RawImportLexiconItem {
  id?: string;
  source_dataset?: string;
  source_id?: number;
  category?: ExpansionCategoryKey | string;
  category_original?: string;
  entry?: string;
  word?: string;
  formal?: string | null;
  needs_review?: boolean;
  review_reason?: string | null;
  recommended_alternative?: string | null;
  context_note?: string;
}

export interface ContextualCandidateQuery {
  topic: string;
  centralThesis?: string;
  stageId: number;
  stageName: string;
  coreFocus?: string;
  keyArguments?: string[];
  draftText?: string;
  excludeWords?: string[];
  excludeCanonicalKeys?: string[];
  limit?: number;
}

export interface ContextualCandidateRecommendation {
  word: string;
  canonicalKey: string;
  formalEquivalent: string | null;
  category: ExpansionCategoryKey | string;
  categoryLabel: string;
  suitabilityScore: number;
  recommendedBlockId: number;
  stageId?: number;
  contextNote?: string;
  stageName: string;
  usageSuggestion: string;
  rationale: string;
  f7Status?: 'PASS' | 'RETAINED' | 'CLARIFIED' | 'REVISED' | 'REPLACED' | 'NO_TRIGGER' | 'NEEDS_REVIEW';
  f7DecisionNote?: string;
}

export interface ImportDatasetResult {
  success: boolean;
  dataset_id?: string;
  entries_imported?: number;
  is_idempotent_duplicate?: boolean;
  message: string;
  stats?: MasterLexiconStats;
}
