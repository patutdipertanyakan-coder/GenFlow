import type { ExpansionBankAudit } from './expansionLexiconBank';
import type { F7PostGenerationAuditReport } from './f7ContextualGuardEngine';
import type {
  GenflowMasterFrameworkData,
  FrameworkTraceabilityReport,
} from './genflowMasterFramework';
import type { HCLSETraceabilityAudit } from './hybridContextualLexiconSelectionEngine';

export type OperationMode =
  | 'NASKAH_FINAL'
  | 'AUTO_ENFORCE'
  | 'EXPANDER'
  | 'REVISI_KOMA'
  | 'REVISI_TRANSISI'
  | 'VOICE_SCRIPT'
  | 'AUDIT_JSON';

export type DurationMode = 'FLEKSIBEL' | 'KETAT';


export type DiscourseRelation =
  | 'CONTINUATION'
  | 'ELABORATION'
  | 'CAUSE_EFFECT'
  | 'CONTRAST'
  | 'EXAMPLE'
  | 'CONCLUSION'
  | 'NEW_TOPIC';

export interface StageConfig {
  id: number;
  name: string;
  weightPercent: number;
  targetWords: number;
  description: string;
}

export interface GenNASConfig {
  topik: string;
  konteks: string;
  faktaTerverifikasi: string;
  durasiMenit: number;
  wpm: number;
  modeDurasi: DurationMode;
  jumlahBlok: number;
  struktur: number[]; // Default [8, 17, 45, 20, 10]
  operasi: OperationMode;
  inputNaskah?: string;
  allowEditorialRewrite: boolean;
  judulOutput: boolean;
  primaryModel: string;
  fallbackModel: string;
  seed?: number;
}

export const LOCKED_CRITICAL_PERSPECTIVE =
  'Perilaku & Pola Pikir Masyarakat (Non-SARA)' as const;

export const LOCKED_WPM = 135 as const;
export const LOCKED_DURATION_MODE: DurationMode = 'FLEKSIBEL';

export interface StoryFlowRebalanceResult {
  valid: boolean;
  weights: number[];
  lockedIndices: number[];
  error?: string;
}

export type GenerationStageStep = 1 | 2 | 3;

export interface ProfanityEvent {
  spanId: string;
  blockIndex: number;
  sentenceIndex: number;
  startChar: number;
  endChar: number;
  text: string;
  rootWord: string;
  surroundingClause: string;
  targetConcept: string;
  valid: boolean;
  isStandaloneViolation: boolean;
  isAmbiguousNonProfane: boolean;
  isClusteredViolation: boolean;
  isForbiddenTargetViolation?: boolean;
  reason: string;
}

export interface PunctuationIssue {
  type:
    | 'MISSING_FRONTED_CLAUSE_COMMA'
    | 'UNNECESSARY_BACK_CLAUSE_COMMA'
    | 'PREPOSITION_COMMA_ERROR'
    | 'SUBJECT_PREDICATE_COMMA_ERROR'
    | 'PREDICATE_OBJECT_COMMA_ERROR'
    | 'COMMA_SPLICE_WARNING'
    | 'PROTECTED_NUMBER_ALTERED';
  sentence: string;
  suggestion: string;
  description: string;
}

export interface StyleIssue {
  type:
    | 'FORMAL_PRONOUN_DETECTED'
    | 'INSUFFICIENT_CONVERSATIONAL_MARKERS'
    | 'INSUFFICIENT_INFORMAL_VERBS'
    | 'UNNATURAL_INFORMAL_USAGE'
    | 'AUDIO_TAG_IN_CLEAN_SCRIPT'
    | 'ALL_CAPS_SHOUTING';
  description: string;
  tokensFound: string[];
}

export interface BlockAudit {
  id: number;
  stageName: string;
  targetWeightPercent: number;
  actualWeightPercent?: number;
  targetWords: number;
  words: number;
  sentenceCount: number;
  text: string;
  profanityEvents: ProfanityEvent[];
  validProfanityCount: number;
  totalProfanityCandidates: number;
  profanityPassed: boolean;
  profanityDistributionPassed: boolean;
  conversationalMarkersFound: string[];
  informalVerbsFound: string[];
  coreLexiconUsed: string[];
  extendedLexiconUsed: string[];
  expansionLexiconUsed: string[];
  formalPronounsFound: string[];
  stylePassed: boolean;
  styleIssues: StyleIssue[];
  punctuationIssues: PunctuationIssue[];
  punctuationPassed: boolean;
  passed: boolean;
  repairSuggestions: string[];
}

export interface TransitionAudit {
  fromBlock: number;
  toBlock: number;
  relation: DiscourseRelation;
  previousEnding: string;
  currentOpening: string;
  isMetaPresenterSignpost: boolean;
  isDisconnectedOpening?: boolean;
  detectedSignpostPhrase?: string;
  passed: boolean;
  suggestion?: string;
}

export interface LexiconCompletenessAudit {
  core_expected: string[];
  core_actual: string[];
  core_missing: string[];
  core_expected_count: number;
  core_actual_count: number;
  isComplete: boolean;
  separatedFromProfanity: boolean;
  separatedFromExtended: boolean;
  f2Count: number;
  f3Count: number;
  f4Count: number;
  f5Count: number;
  f6Count: number;
  f7RuleCount: number;
  f8RuleCount: number;
  profanityBankCount: number;
  phraseBankCount: number;
  expansionAudit: ExpansionBankAudit;
}

export type ProtectedTokenCategory =
  | 'Mata uang'
  | 'Persentase'
  | 'Desimal'
  | 'Periode'
  | 'Tanggal'
  | 'Angka ribuan'
  | 'Kode teknis'
  | 'Referensi'
  | 'Istilah ilmiah';

export interface ProtectedTokenItem {
  placeholder: string;
  value: string;
  category: ProtectedTokenCategory;
  startIndex: number;
  endIndex: number;
  count: number;
}

export type DocumentIntegrityStatus = 'VALID' | 'WARNING' | 'ERROR';

export interface SuspiciousTokenDetail {
  token: string;
  reason: string;
  category?: 'TYPOGRAPHIC_SYMBOL' | 'ISOLATED_SPECIAL_CHAR' | 'UNCOMMON_GLYPH' | 'POSSIBLE_CORRUPTION';
  index: number;
  snippet: string;
}

export interface DocumentIntegrityReport {
  status: DocumentIntegrityStatus;
  valid: boolean; // True jika dokumen siap digunakan (VALID atau WARNING)
  hasIllegalControlChars: boolean;
  hasReplacementChars: boolean;
  hasBinaryFragments: boolean;
  allTokensAreExactSubstrings: boolean;
  allTokenIndicesValid: boolean;
  roundTripRestoreExact: boolean;
  suspiciousGarbageRatio: number;
  suspiciousTokensCount: number;
  suspiciousTokens: SuspiciousTokenDetail[];
  warnings: string[];
  errors: string[];
}

export type ReferenceMetadataCategory =
  | 'DOI'
  | 'URL'
  | 'Domain / Website'
  | 'Path / Direktori'
  | 'Sitasi / Nomor Referensi'
  | 'Label Referensi';

export interface ReferenceMetadataItem {
  value: string;
  category: ReferenceMetadataCategory;
  startIndex: number;
  endIndex: number;
}

export interface ProtectedTokenMap {
  placeholders: Record<string, string>;
  tokens: string[];
  items: ProtectedTokenItem[];
  occurrences: ProtectedTokenItem[];
  maskedText: string;
  referenceMetadata?: ReferenceMetadataItem[];
  cleanedSubstantiveText?: string;
  integrity?: DocumentIntegrityReport;
}

export type NonSaraViolationType =
  | 'RELIGIOUS_IDENTITY_ATTACK'
  | 'SARA_GROUP_ATTACK'
  | 'INSTITUTION_ATTACK'
  | 'INDIVIDUAL_ATTACK'
  | 'PROMPT_INJECTION_OVERRIDE';

export interface NonSaraGuardViolation {
  type: NonSaraViolationType;
  culpritText: string;
  reason: string;
  reframedSuggestion?: string;
  isFactualMentionOnly: boolean;
}

export interface NonSaraGuardReport {
  passed: boolean;
  stage: 'PRE_GENERATION' | 'POST_GENERATION' | 'POST_REVISION';
  lockedPerspective: string;
  violationsCount: number;
  violations: NonSaraGuardViolation[];
  factualMentionsPreserved: string[];
  reframedCount: number;
  summary: string;
}

import type { LanguageIntegrityAuditResult } from './languageIntegrityEngine';

export interface FullScriptAudit {
  passed: boolean;
  sctfValid: boolean;
  sctfErrors: string[];
  paragraphCount: number;
  expectedParagraphCount: number;
  totalWords: number;
  targetTotalWords: number;
  wordTolerancePassed: boolean;
  estimatedDurationMinutes: number;
  estimatedDurationFormatted: string;
  wpmUsed: number;
  kritikPassCount: number; // n/5 blocks passing ALL 4-5 valid integrated profanity criteria
  stylePassCount: number;
  punctuationPassCount: number;
  transitionPassCount: number;
  stages: BlockAudit[];
  transitions: TransitionAudit[];
  factualWarnings: string[];
  protectedTokensChecked: string[];
  protectedTokensIntact: boolean;
  lockedPerspective: string;
  inferredTopic: string;
  critiqueTargetPassed: boolean;
  critiqueTargetWarnings: string[];
  nonSaraPassed: boolean;
  nonSaraGuard: NonSaraGuardReport;
  lexiconAudit: LexiconCompletenessAudit;
  repairSuggestions: string[];
  testsNotRun: string[];
  sourceFidelity?: SourceFidelityAuditReport;
  semanticClassification?: DocumentSemanticClassification;
  narrativePlan?: SourceGroundedPlan;
  quoteFree?: QuoteFreeAuditReport;
  f7ContextualGuard?: F7PostGenerationAuditReport;
  languageIntegrity?: LanguageIntegrityAuditResult;
  g1G11Audit?: G1G11AuditReport;
}

export interface G1G11PhraseOccurrence {
  category: string;
  categoryCode: 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6' | 'G7' | 'G8' | 'G9' | 'G10' | 'G11';
  phrase: string;
  matchedText: string;
}

export interface G1G11BlockAudit {
  blockId: number;
  stageName: string;
  expectedCategoryCodes?: string[];
  availableCategoryCodes: string[];
  foundPhrases: G1G11PhraseOccurrence[];
  foundCategoryCodes: string[];
  passed: boolean;
  targetMet: boolean;
  reasons: string[];
}

export interface G1G11AuditReport {
  passed: boolean;
  totalPhrasesFound: number;
  targetPhrasesTotal: number;
  blocksPassedCount: number;
  blockAudits: G1G11BlockAudit[];
  summary: string;
  reasons: string[];
}

export type QuoteType =
  | 'SLOGAN'
  | 'POPULAR_EXPRESSION'
  | 'DIRECT_QUOTE'
  | 'TERM'
  | 'RHETORICAL_EMPHASIS'
  | 'UNKNOWN';

export interface QuoteFreeFinding {
  blockId: number;
  quoteSnippet: string;
  quoteType: QuoteType;
  normalizedText?: string;
  hasAttribution: boolean;
  attributionName?: string;
  status: 'RESOLVED' | 'UNRESOLVED_CONFLICT';
  reason: string;
}

export interface QuoteFreeAuditReport {
  passed: boolean;
  status: 'QUOTE-FREE LULUS' | 'QUOTE-FREE PERLU PERBAIKAN';
  totalQuotesFound: number;
  unresolvedCount: number;
  findings: QuoteFreeFinding[];
  blockStatus: Array<{
    blockId: number;
    passed: boolean;
    quotesCount: number;
    hasQuoteCharacters: boolean;
  }>;
  integrityChecks: {
    noQuoteCharacters: boolean;
    sentenceIntegrityPassed: boolean;
    attributionPreserved: boolean;
    noFragmentedWords: boolean;
    protectedTokensIntact: boolean;
  };
  summary: string;
  details: string[];
}


export type DocumentSemanticCategory =
  | 'DOCUMENT_INSTRUCTIONS'
  | 'MAIN_TOPIC'
  | 'ARGUMENT_STRUCTURE'
  | 'SOURCE_EVIDENCE'
  | 'EDITORIAL_NOTES'
  | 'UNCERTAIN_CONTENT';

export interface SemanticSectionItem {
  id: string;
  category: DocumentSemanticCategory;
  rawText: string;
  lineIndex: number;
  summary: string;
  isInstruction: boolean;
}

export interface DocumentSemanticClassification {
  rawText: string;
  fileName?: string;
  sections: SemanticSectionItem[];
  instructions: string[];
  mainTopic: string;
  documentTitle: string | null;
  centralThesis: string;
  keyArguments: string[];
  supportingEvidence: string[];
  editorialNotes: string[];
  uncertainContent: string[];
  topicKeywords: string[];
  hasInstructions: boolean;
  instructionSignpostsFound: string[];
}

export interface StoryFlowStagePlanItem {
  blockId: number;
  stageName: string;
  weightPercent: number;
  targetWords: number;
  coreFocus: string;
  keyPoints: string[];
  groundedSourcePoints: string[];
}

export interface SourceGroundedPlan {
  main_topic: string;
  central_thesis: string;
  key_arguments: string[];
  supporting_evidence: string[];
  source_references: string[];
  storyflow_plan: StoryFlowStagePlanItem[];
  unresolved_claims: string[];
  target_word_count: number;
  wpm: number;
  duration_minutes: number;
  locked_perspective_boundary: string;
}

export interface SourceFidelityCheckResult {
  passed: boolean;
  reason: string;
  details?: string[];
}

export interface SourceFidelityAuditReport {
  passed: boolean;
  score: number; // 0 - 100
  status: 'SESUAI_KERANGKA' | 'TIDAK_SESUAI_KERANGKA';
  topicRelevance: {
    passed: boolean;
    mainTopic: string;
    matchedTerms: string[];
    missingKeyThemes: string[];
    reason: string;
  };
  argumentCoverage: {
    passed: boolean;
    coveredCount: number;
    totalCount: number;
    coveredArguments: string[];
    missingArguments: string[];
    reason: string;
  };
  sourceGrounding: {
    passed: boolean;
    supportedClaims: string[];
    unsupportedClaims: string[];
    protectedTokensFound: string[];
    protectedTokensMissing: string[];
    reason: string;
  };
  semanticConsistency: {
    passed: boolean;
    reason: string;
  };
  instructionLeakage: {
    passed: boolean;
    leakedPhrases: string[];
    reason: string;
  };
  hallucinationDetection: {
    passed: boolean;
    suspiciousClaims: string[];
    reason: string;
  };
  storyflowAlignment: {
    passed: boolean;
    progressionSummary: string[];
    reason: string;
  };
  detailedFindings: string[];
  reasons: string[];
}

// Perpanjang FullScriptAudit dengan sourceFidelity
export interface FullScriptAuditExtended extends FullScriptAudit {
  sourceFidelity: SourceFidelityAuditReport;
  semanticClassification?: DocumentSemanticClassification;
  narrativePlan?: SourceGroundedPlan;
}

export interface VoiceChunk {
  chunkId: string;
  blockId: number;
  sentenceRange: string;
  text: string;
  charCount: number;
  previous_text?: string;
  next_text?: string;
  estimatedSeconds: number;
}

export interface ElevenLabsVoiceSettings {
  voiceId: string;
  modelId: 'eleven_v4' | 'eleven_multilingual_v2' | 'eleven_turbo_v2_5';
  stability: number;
  similarityBoost: number;
  style: number;
  useSpeakerBoost: boolean;
  seed?: number;
  contextStrategy: 'previous_next_text' | 'request_ids_only' | 'none';
  enableSubtleAudioTags: boolean;
}

export interface ABTransitionVariant {
  variant: 'A' | 'B' | 'C' | 'D';
  label: string;
  description: string;
  p1Ending: string;
  p2Opening: string;
  separatorUsed: string;
  combinedPreview: string;
  prosodyContinuityNotes: {
    loudnessRisk: 'Rendah' | 'Sedang' | 'Tinggi';
    pitchResetRisk: 'Rendah' | 'Sedang' | 'Tinggi';
    timbreNotes: string;
    speedNotes: string;
  };
}

export interface FailoverStatus {
  status: 'safe' | 'switched';
  activeKeyIndex: number;
  label: string;
  previousLabel: string | null;
  activeModel: string;
  availableModels: string[];
  totalTiers: number;
  appVersion: string;
}

// ==========================================
// WORKFLOW ENGINE TYPES — ROADMAP PRODUKSI NASKAH V5.1
// ==========================================

export type WorkflowStageId = 1 | 2 | 3;

export type WorkflowStageStatus = 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED';

export interface WorkflowStageMeta {
  id: WorkflowStageId;
  number: number;
  name: string;
  shortName: string;
  description: string;
  mandatoryRule: string;
}

export interface ExtractionWorkflowData {
  fileName?: string;
  fileType?: string;
  extractedText: string;
  cleanedNarrativeSourceText?: string;
  wordCount: number;
  charCount: number;
  inferredTopic: string;
  documentTitleContext?: string | null;
  protectedTokens: string[];
  protectedTokenItems: ProtectedTokenItem[];
  referenceMetadata?: ReferenceMetadataItem[];
  integrityStatus: DocumentIntegrityStatus;
  semanticClassification?: DocumentSemanticClassification;
  narrativePlan?: SourceGroundedPlan;
  masterFramework?: GenflowMasterFrameworkData;
  frameworkPolicyResult?: any;
}

export interface DraftV0WorkflowData {
  script: string;
  blocks: string[];
  wordCount: number;
  modelUsed?: string;
  generatedAt: number;
  isDraft: true;
  traceabilityReport?: FrameworkTraceabilityReport;
  f7Report?: F7PostGenerationAuditReport;
  hclseAudit?: HCLSETraceabilityAudit;
}

export interface AuditV0WorkflowData {
  audit: FullScriptAudit;
  diagnosisSummary: {
    passed: boolean;
    profanityIssuesFound: boolean;
    styleIssuesFound: boolean;
    punctuationIssuesFound: boolean;
    sourceFidelityPassed: boolean;
    quoteFreePassed: boolean;
    gapWordsCount: number;
    recommendedActions: string[];
    diagnosedAt: number;
    diagnosedIndicators: {
      topicRelevance: 'LULUS' | 'PERLU_PERBAIKAN';
      sourceFidelity: 'LULUS' | 'PERLU_PERBAIKAN';
      nonSaraBaseline: 'LULUS' | 'PERLU_PERBAIKAN';
      sctfStructure: 'LULUS' | 'PERLU_PERBAIKAN';
    };
    uninspectedForDraftV0: string[];
  };
}

export type LexiconSourceMappingCode = 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'B' | 'C';

export type LexiconBankMembership =
  | 'F1_CORE'
  | 'F2_SUFFIX_IN'
  | 'F3_PREFIX_NG'
  | 'F4_MARKERS'
  | 'F5_VERBS'
  | 'F6_INFORMAL'
  | 'DATASET_299_LEGACY'
  | 'DATASET_945_EXPANSION'
  | 'ADDITIONAL_USER_DATASET';

export type LexiconValidationStatus =
  | 'VALIDATED_SELECTED'
  | 'REJECTED_GRAMMAR_SYNTAX'
  | 'REJECTED_F7_NATURALNESS'
  | 'REJECTED_F8_ROTATION';

export interface Stage4LexiconRegisterEntry {
  word: string;
  lexiconId: string;
  sourceCategory: LexiconSourceMappingCode;
  sourceCategoryLabel: string;
  bankMembership: LexiconBankMembership;
  blockId: number;
  blockName: string;
  grammaticalFunction: string;
  sentenceUsed: string;
  naturalnessVerified: boolean;
  validationStatus: LexiconValidationStatus;
  reason: string;
}

export interface F1F8BlockSelection {
  blockId: number;
  stageName: string;
  selectedF1Core: string[];
  selectedF2SuffixIn: string[];
  selectedF3Prefix: string[];
  selectedF4Markers: string[];
  selectedF5Verbs: string[];
  selectedF6Informal: string[];
  selectedExpansion: string[];
  contextRationale: string;
  integratedSentences?: string[];
  registerEntries?: Stage4LexiconRegisterEntry[];
  rejectedEntries?: Stage4LexiconRegisterEntry[];
}

export interface F1F8WorkflowSelection {
  coreAvailableCount: number; // 56/56
  isCoreComplete: boolean;
  totalWordsSelected: number;
  blockSelections: F1F8BlockSelection[];
  summary: string;
  register?: Stage4LexiconRegisterEntry[];
  rejectedRegister?: Stage4LexiconRegisterEntry[];
  registryStatsUsed?: {
    f1CoreCount: number;
    f2ToF6Count: number;
    dataset299Count: number;
    dataset945Count: number;
    additionalUserCount: number;
    totalRegistryQueried: number;
  };
  sourceMappingPreserved?: Record<LexiconSourceMappingCode, number>;
  f7GuardApplied?: boolean;
  f8RotationApplied?: boolean;
}

export interface ProfanityItemSelection {
  rootWord: string;
  integratedPhrase: string;
  critiqueTarget: string;
  syntacticRole: string;
  nonSaraCompliant: boolean;
}

export interface ProfanityBlockSelection {
  blockId: number;
  stageName: string;
  targetCount: number; // 3 to 5
  critiqueTargets: string[];
  selectedPhrases: ProfanityItemSelection[];
  rationale: string;
}

export interface ProfanityWorkflowSelection {
  totalCount: number; // 15 to 25
  isCountValid: boolean;
  isNonSaraStrict: boolean;
  blockSelections: ProfanityBlockSelection[];
  summary: string;
}

export interface PhraseItemSelection {
  category: string;
  categoryLabel: string;
  phrase: string;
  contextUsage: string;
}

export interface PhraseBlockSelection {
  blockId: number;
  stageName: string;
  selectedPhrases: PhraseItemSelection[];
  rationale: string;
}

export interface PhraseWorkflowSelection {
  totalPhrasesSelected: number;
  blockSelections: PhraseBlockSelection[];
  summary: string;
}

export interface PreFinalQualityGateChecklist {
  sourceOutlineAvailable: boolean;
  sourceIntegrityPassed: boolean;
  draftV0Available: boolean;
  auditV0DiagnosisAvailable: boolean;
  f1F8RegisterAvailable: boolean;
  profanityHRegisterAvailable: boolean;
  phrasesGRegisterAvailable: boolean;
  registersFromCurrentExecution: boolean;
  noEmptySelections: boolean;
  noStaleData: boolean;
  artifactsReadyForFinalGenerator: boolean;
}

export interface PreFinalQualityGateResult {
  passed: boolean;
  checkedAt: number;
  executionRunId: string;
  checklist: PreFinalQualityGateChecklist;
  summary: string;
  reasons: string[];
}

export interface WorkflowExecutionLogEntry {
  stageId: WorkflowStageId | 'QUALITY_GATE' | 'FINAL_AUDIT';
  stageName: string;
  status: 'STARTED' | 'PASSED' | 'FAILED';
  timestamp: number;
  details?: string;
}

export interface FinalScriptWorkflowData {
  script: string;
  blocks: string[];
  wordCount: number;
  modelUsed?: string;
  integratedElements: {
    sourceFidelity: boolean;
    draftV0Refined: boolean;
    f1F8AppliedCount: number;
    profanityIntegratedCount: number;
    phrasePatternsAppliedCount: number;
  };
  audit: FullScriptAudit;
  repairedAutomatically: boolean;
}

export interface FinalApprovalWorkflowData {
  isFinal: boolean;
  approvedAt: number;
  checklist: {
    allPriorStagesPassed: boolean;
    fiveBlocksSCTFValid: boolean;
    wpmAndDurationTargetMet: boolean;
    conversationalGueLoPassed: boolean;
    integratedProfanity3to5Passed: boolean;
    nonSaraGuardPassed: boolean;
    quoteFreePassed: boolean;
    sourceFidelityPassed: boolean;
    protectedTokensIntact: boolean;
  };
  summary: string;
}

export interface WorkflowStageData<T = any> {
  id: WorkflowStageId;
  number: number;
  name: string;
  shortName: string;
  description: string;
  status: WorkflowStageStatus;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  summary?: string;
  data?: T;
}

export interface WorkflowEngineState {
  currentStageId: WorkflowStageId;
  isRunning: boolean;
  isAutoAdvancing: boolean;
  stages: Record<WorkflowStageId, WorkflowStageData>;
  extractionData?: ExtractionWorkflowData;
  draftV0?: DraftV0WorkflowData;
  auditV0?: AuditV0WorkflowData;
  masterFramework?: GenflowMasterFrameworkData;
  traceabilityReport?: FrameworkTraceabilityReport;
  hclseAudit?: HCLSETraceabilityAudit;
  f1F8Selection?: F1F8WorkflowSelection;
  profanitySelection?: ProfanityWorkflowSelection;
  phraseSelection?: PhraseWorkflowSelection;
  preFinalQualityGate?: PreFinalQualityGateResult;
  finalScriptData?: FinalScriptWorkflowData;
  finalAudit?: FullScriptAudit;
  approvalData?: FinalApprovalWorkflowData;
  isFinalApproved: boolean;
  executionRunId?: string;
  executionLogs?: WorkflowExecutionLogEntry[];
  lastError?: string;
}

// ==========================================
// BLOCK-LEVEL POST-PRODUCTION ENGINE TYPES
// ==========================================

export type BlockPostProductionOperation = 'PERDALAM' | 'TRANSISI';

export interface BlockPostProductionMetadata {
  blockIndex: number; // 0..4
  blockId: number; // 1..5
  stageName: string;
  operation: BlockPostProductionOperation;
  wordsBefore: number;
  wordsAfter: number;
  wordDelta: number;
  targetWords: number;
  targetWeightPercent: number;
  actualWeightPercentBefore: number;
  actualWeightPercentAfter: number;
  targetMet: boolean;
  transitionPartsUpdated?: string;
  openingBefore?: string;
  openingAfter?: string;
  closingBefore?: string;
  closingAfter?: string;
  factsPreserved: boolean;
  protectedTokensChecked: string[];
  protectedTokensIntact: boolean;
  validationPassed: boolean;
  nonTargetBlocksUnchanged: boolean;
  workflowStagesUntouched: boolean;
  modelUsed?: string;
  timestamp: number;
  summary: string;
}


