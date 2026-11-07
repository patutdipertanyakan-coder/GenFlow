import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  AuditV0WorkflowData,
  BlockPostProductionMetadata,
  BlockPostProductionOperation,
  FullScriptAudit,
  GenerationStageStep,
  OperationMode,
  PreFinalQualityGateResult,
  WorkflowEngineState,
} from '../lib/types';
import { canDisplayFinalScriptInEditor } from '../lib/workflowEngine';
import { getActiveG1G11PhraseBank, G1G11_CATEGORY_METADATA } from '../lib/g1g11PhraseRepository';
import {
  Sparkles,
  Wrench,
  Layers,
  ArrowLeftRight,
  ShieldCheck,
  Volume2,
  VolumeX,
  Copy,
  Check,
  FileText,
  FileCode2,
  ChevronDown,
  ChevronUp,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { RacingCarLoadingAnimation } from './RacingCarLoadingAnimation';
import { BookLoadingAnimation } from './BookLoadingAnimation';

interface EditorAndQualityPanelProps {
  blocks: string[];
  cleanScript: string;
  audit: FullScriptAudit;
  isLoading: boolean;
  loadingStageStep: GenerationStageStep;
  activeOperation: OperationMode | null;
  lastModelUsed?: string;
  soundEnabled: boolean;
  isFinalApproved?: boolean;
  isDraftV0?: boolean;
  isStage8Passed?: boolean;
  auditV0?: AuditV0WorkflowData;
  preFinalQualityGate?: PreFinalQualityGateResult;
  finalAudit?: FullScriptAudit;
  workflowState?: WorkflowEngineState;
  activeBlockPostProd?: {
    blockIndex: number;
    operation: BlockPostProductionOperation;
  } | null;
  blockPostProdResults?: Record<number, BlockPostProductionMetadata>;
  onToggleSound: () => void;
  onBlockEdit: (index: number, newText: string) => void;
  onRawCleanScriptEdit: (newRawScript: string) => void;
  onExecuteOperation: (op: OperationMode) => void;
  onRepairSingleBlock: (blockIndex: number) => void;
  onBlockPostProduction?: (
    blockIndex: number,
    operation: BlockPostProductionOperation
  ) => void;
  onExportTxt: () => void;
  onExportDocx: () => void;
  onExportAuditJson: () => void;
}

export const EditorAndQualityPanel: React.FC<EditorAndQualityPanelProps> = ({
  blocks,
  cleanScript,
  audit,
  isLoading,
  loadingStageStep,
  activeOperation,
  soundEnabled,
  isFinalApproved = false,
  isDraftV0 = false,
  isStage8Passed,
  auditV0,
  preFinalQualityGate,
  finalAudit,
  workflowState,
  activeBlockPostProd = null,
  blockPostProdResults = {},
  onToggleSound,
  onBlockEdit,
  onRawCleanScriptEdit,
  onExecuteOperation,
  onRepairSingleBlock,
  onBlockPostProduction,
  onExportTxt,
  onExportDocx,
  onExportAuditJson,
}) => {
  const [editorMode, setEditorMode] = useState<'VISUAL_BLOCKS' | 'RAW_SCTF' | 'AUDIT_JSON' | 'MONITORING_LINGUISTIK'>('VISUAL_BLOCKS');
  const [copiedClean, setCopiedClean] = useState(false);
  const [expandedTechBlocks, setExpandedTechBlocks] = useState<Record<number, boolean>>({});

  const hasScript = Boolean(cleanScript && cleanScript.trim().length > 0);

  // KEPUTUSAN UTAMA & PENGAMANAN STATE (Instruksi 10 - FINAL-ONLY EDITOR DISPLAY + Post-Production Validation):
  // 1. Naskah hanya ditampilkan apabila Tahap 4 berstatus PASSED dan isFinalApproved === true.
  // 2. Setelah Tahap 4 PASSED, naskah tetap tampil di editor selama pascaproduksi agar pengguna dapat mengedit/memperbaiki per blok.
  // 3. Ekspor final tetap dikunci apabila audit kualitas wajib (audit.passed) belum terpenuhi.
  const stage3Status = (workflowState?.stages as any)?.[3]?.status || (isStage8Passed ? 'PASSED' : 'PENDING');
  const stage3Passed = stage3Status === 'PASSED';
  const stage3Failed = stage3Status === 'FAILED';
  const isWorkflowActive = Boolean(
    isLoading ||
    workflowState?.isRunning ||
    (workflowState?.currentStageId && workflowState.currentStageId >= 1 && workflowState.currentStageId < 4 && workflowState.stages?.[1]?.status === 'PASSED')
  );

  const canDisplayFinalScript = canDisplayFinalScriptInEditor({
    cleanScript,
    stage3Status,
    isFinalApproved,
    finalAuditPassed: audit.passed,
  });

  const canDisplayBlocksInEditor = Boolean(
    hasScript && (stage3Passed || isFinalApproved || canDisplayFinalScript || !isWorkflowActive)
  );

  const isAnyBlockPostProdRunning = Boolean(activeBlockPostProd);
  const isFinalExportLocked = !hasScript || isLoading || isAnyBlockPostProdRunning;
  const toggleBlockTechDetail = (id: number) => {
    setExpandedTechBlocks((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleCopyClean = async () => {
    if (!hasScript) return;
    try {
      await navigator.clipboard.writeText(cleanScript);
      setCopiedClean(true);
      setTimeout(() => setCopiedClean(false), 1800);
    } catch {
      // Fallback copy
    }
  };

  const totalValidProfanity = hasScript
    ? audit.stages.reduce((acc, s) => acc + s.validProfanityCount, 0)
    : 0;

  // Helper status progres per kartu saat loading (3-Stage Workflow)
  const getLoadingCardStatus = (cardMinStep: number) => {
    if (loadingStageStep < cardMinStep) {
      return { label: 'Menunggu', color: 'text-slate-500' };
    }
    if (loadingStageStep === cardMinStep && isLoading) {
      return { label: 'Memproses', color: 'text-amber-300' };
    }
    return { label: 'Selesai', color: 'text-emerald-400' };
  };

  const isSourceFidelityFailed = Boolean(
    hasScript && audit.sourceFidelity && !audit.sourceFidelity.passed
  );

  const isQuoteFreeFailed = Boolean(
    hasScript && audit.quoteFree && !audit.quoteFree.passed
  );

  const overallStatusLabel = isLoading
    ? 'SEDANG MEMPROSES / MEMBUAT NASKAH'
    : !hasScript
    ? 'BELUM ADA NASKAH'
    : stage3Passed && isFinalApproved
    ? 'LULUS & SIAP PAKAI'
    : isQuoteFreeFailed
    ? 'PERLU PERBAIKAN QUOTE-FREE'
    : audit.passed
    ? 'LULUS EVALUASI'
    : 'PERLU PERBAIKAN';

  const overallStatusClass = isLoading
    ? 'text-amber-300 font-semibold'
    : !hasScript
    ? 'text-slate-400 font-semibold'
    : stage3Passed && isFinalApproved
    ? 'text-emerald-400 font-bold'
    : isQuoteFreeFailed
    ? 'text-rose-400 font-semibold'
    : audit.passed
    ? 'text-emerald-400 font-semibold'
    : 'text-amber-400 font-semibold';

  return (
    <section
      aria-label="Panel Output, Editor Editor Visual SCTF, dan Dashboard Kualitas"
      className="space-y-4 min-w-0 h-full flex flex-col"
    >
      {/* D. DASHBOARD KUALITAS (8 Indikator Deterministik) */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3 mb-3.5">
          <div>
            <h2 className="text-base font-bold text-slate-100 tracking-tight">
              Status Kualitas
            </h2>
            <p className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-y-1">
              <span>Status: </span>
              <span
                data-testid="overall-dashboard-status"
                className={`ml-1 ${overallStatusClass}`}
              >
                {overallStatusLabel}
              </span>
              <span aria-hidden="true" className="mx-2 text-slate-600">
                ·
              </span>
              <span>
                Bebas Petik:{' '}
                <strong
                  data-testid="quote-free-status-badge"
                  className={
                    !hasScript || isLoading
                      ? 'text-slate-400 font-normal'
                      : audit.quoteFree?.passed
                      ? 'text-emerald-400 font-semibold'
                      : 'text-rose-400 font-semibold'
                  }
                >
                  {!hasScript || isLoading
                    ? 'Menunggu'
                    : audit.quoteFree?.passed
                    ? 'LULUS'
                    : 'REVISI'}
                </strong>
              </span>
              <span aria-hidden="true" className="mx-2 text-slate-600">
                ·
              </span>
              <span>
                Bahasa:{' '}
                <strong
                  data-testid="language-purity-status-badge"
                  className={
                    !hasScript || isLoading
                      ? 'text-slate-400 font-normal'
                      : (audit.languageIntegrity?.passed ?? true)
                      ? 'text-emerald-400 font-semibold'
                      : 'text-rose-400 font-semibold'
                  }
                >
                  {!hasScript || isLoading
                    ? 'Menunggu'
                    : (audit.languageIntegrity?.passed ?? true)
                    ? '100% Murni (Zero-Leakage)'
                    : 'PERLU PERBAIKAN'}
                </strong>
              </span>
              <span aria-hidden="true" className="mx-2 text-slate-600">
                ·
              </span>
              <span>
                {isDraftV0
                  ? 'Slot F1: Diproses'
                  : `Slot F1: ${audit.lexiconAudit.core_actual_count}/${audit.lexiconAudit.core_expected_count}`}
              </span>
            </p>
          </div>
        </div>

        {/* Banner Diagnosis Draft V0 jika sedang berada di Draft V0 */}
        {isDraftV0 && !isLoading && hasScript && (
          <div
            data-testid="draft-v0-diagnosis-banner"
            className="mb-3 px-3.5 py-2 rounded-lg border bg-sky-950/40 border-sky-800/70 text-sky-200 text-xs flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-400 shrink-0" />
              <span>
                <strong>Draft V0:</strong> Menunggu normalisasi bebas petik (SQNN) dan pengesahan Tahap 3.
              </span>
            </div>
          </div>
        )}

        {/* 2-COLUMN GRID UNTUK VALIDATOR UTAMA */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3.5">
          {/* NON_SARA_HARD_GUARD STATUS BANNER (KOLOM KIRI) */}
          <div
            data-testid="non-sara-hard-guard-banner"
            className={`p-3 rounded-xl border text-xs flex flex-col justify-between gap-2 ${
              !hasScript || isLoading
                ? 'bg-slate-950/90 border-slate-800 text-slate-300'
                : audit.nonSaraPassed
                ? 'bg-emerald-950/40 border-emerald-800/70 text-emerald-200'
                : 'bg-rose-950/70 border-rose-700 text-rose-200'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {!hasScript || isLoading ? (
                <Clock className="w-4 h-4 shrink-0 text-slate-400 mt-0.5" />
              ) : (
                <ShieldCheck
                  className={`w-4 h-4 shrink-0 mt-0.5 ${
                    audit.nonSaraPassed ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                />
              )}
              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-100 uppercase tracking-wider text-[11px]">
                    KEAMANAN KONTEN
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 shrink-0">
                    Prioritas 1
                  </span>
                </div>
                <div
                  className={`font-semibold text-xs ${
                    !hasScript || isLoading
                      ? 'text-slate-300'
                      : audit.nonSaraPassed
                      ? 'text-emerald-300'
                      : 'text-rose-300'
                  }`}
                >
                  {isLoading
                    ? 'Memeriksa sasaran Non-SARA...'
                    : !hasScript
                    ? 'Menunggu Naskah'
                    : audit.nonSaraPassed
                    ? 'LULUS — Aman'
                    : 'GAGAL — Pelanggaran Sasaran'}
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  {!hasScript || isLoading
                    ? 'Kritik wajib fokus pada pola pikir & perilaku tidak logis.'
                    : audit.nonSaraPassed
                    ? 'Kritik dan kata kasar murni menyasar perilaku & pola pikir tidak logis.'
                    : 'Terdeteksi serangan terhadap identitas SARA, lembaga, atau individu.'}
                </p>
              </div>
            </div>
          </div>

          {/* SOURCE_FIDELITY STATUS BANNER (KOLOM KANAN) */}
          <div
            data-testid="source-fidelity-status-banner"
            className={`p-3 rounded-xl border text-xs flex flex-col justify-between gap-2 ${
              !hasScript || isLoading
                ? 'bg-slate-950/90 border-slate-800 text-slate-300'
                : audit.sourceFidelity?.passed
                ? 'bg-emerald-950/40 border-emerald-800/70 text-emerald-200'
                : 'bg-rose-950/70 border-rose-700 text-rose-200'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {!hasScript || isLoading ? (
                <Clock className="w-4 h-4 shrink-0 text-slate-400 mt-0.5" />
              ) : (
                <FileText
                  className={`w-4 h-4 shrink-0 mt-0.5 ${
                    audit.sourceFidelity?.passed ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                />
              )}
              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-100 uppercase tracking-wider text-[11px]">
                    AKURASI FAKTA
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 shrink-0">
                    {audit.sourceFidelity ? `Skor ${audit.sourceFidelity.score}/100` : 'Prioritas 2'}
                  </span>
                </div>
                <div
                  className={`font-semibold text-xs ${
                    !hasScript || isLoading
                      ? 'text-slate-300'
                      : audit.sourceFidelity?.passed
                      ? 'text-emerald-300'
                      : 'text-rose-300'
                  }`}
                >
                  {isLoading
                    ? 'Memeriksa kesesuaian fakta...'
                    : !hasScript
                    ? 'Menunggu Naskah'
                    : audit.sourceFidelity?.passed
                    ? `LULUS (${audit.sourceFidelity.score}%) — Sesuai Sumber`
                    : `MELENCENG (${audit.sourceFidelity?.score ?? 0}%)`}
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  {!hasScript || isLoading
                    ? 'Memastikan topik dokumen dikembangkan utuh tanpa bocornya instruksi.'
                    : audit.sourceFidelity?.passed
                    ? `Topik "${audit.sourceFidelity.topicRelevance.mainTopic}" terjaga di 5 blok.`
                    : audit.sourceFidelity?.reasons.join(' · ') || 'Naskah melenceng dari topik sumber.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 8 Indikator Utama */}
        {/* 8 Indikator Utama */}
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2.5 w-full min-w-0">

          {/* 1. Paragraf */}
          <div
            data-tooltip="Indikator jumlah paragraf naskah sesuai kontrak Single Clean Text Flow (5 blok tanpa baris kosong)."
            className={`rounded-lg p-2.5 sm:p-3 border transition-colors min-w-0 overflow-hidden ${
              !hasScript || isLoading
                ? 'bg-slate-950/80 border-slate-800/90'
                : audit.sctfValid &&
                  audit.paragraphCount === audit.expectedParagraphCount
                ? 'bg-slate-950/80 border-emerald-500/30'
                : 'bg-slate-950/80 border-rose-500/40'
            }`}
          >
            <div className="text-xs text-slate-400 font-medium truncate">Struktur Blok</div>
            {!hasScript && !isLoading ? (
              <>
                <div
                  data-testid="metric-sctf"
                  className="text-lg font-mono font-semibold tabular-nums mt-0.5 text-slate-400 truncate"
                >
                  0/0
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                  Belum dicek
                </div>
              </>
            ) : isLoading ? (
              <>
                <div
                  data-testid="metric-sctf"
                  className={`text-lg font-mono font-semibold tabular-nums mt-0.5 truncate ${
                    getLoadingCardStatus(2).color
                  }`}
                >
                  {loadingStageStep >= 2
                    ? `${audit.expectedParagraphCount}/${audit.expectedParagraphCount}`
                    : '0/0'}{' '}
                  <span className="text-xs font-normal">
                    {getLoadingCardStatus(2).label}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                  1 newline · 0 kosong
                </div>
              </>
            ) : (
              <>
                <div
                  data-testid="metric-sctf"
                  className={`text-lg font-mono font-semibold tabular-nums mt-0.5 truncate ${
                    audit.sctfValid &&
                    audit.paragraphCount === audit.expectedParagraphCount
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }`}
                >
                  {audit.paragraphCount}/{audit.expectedParagraphCount}{' '}
                  <span className="text-xs font-normal">
                    {audit.sctfValid ? 'Valid' : 'Revisi'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                  1 newline · 0 kosong
                </div>
              </>
            )}
          </div>

          {/* 2. Gaya Kritik */}
          <div
            data-tooltip="Indikator kepatuhan distribusi 4–5 kritik terintegrasi per blok yang wajib menyatu dalam kalimat analisis."
            className={`rounded-lg p-2.5 sm:p-3 border transition-colors min-w-0 overflow-hidden ${
              !hasScript || isLoading
                ? 'bg-slate-950/80 border-slate-800/90'
                : audit.kritikPassCount === audit.expectedParagraphCount
                ? 'bg-slate-950/80 border-emerald-500/30'
                : 'bg-slate-950/80 border-amber-500/40'
            }`}
          >
            <div className="text-xs text-slate-400 font-medium truncate">Dosis Kritik</div>
            {!hasScript && !isLoading ? (
              <>
                <div
                  data-testid="metric-kritik"
                  className="text-lg font-mono font-semibold tabular-nums mt-0.5 text-slate-400 truncate"
                >
                  0/0
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                  Belum dicek
                </div>
              </>
            ) : isLoading ? (
              <>
                <div
                  data-testid="metric-kritik"
                  className={`text-lg font-mono font-semibold tabular-nums whitespace-nowrap mt-0.5 truncate ${
                    getLoadingCardStatus(2).color
                  }`}
                >
                  {loadingStageStep >= 2
                    ? `${audit.expectedParagraphCount}/${audit.expectedParagraphCount}`
                    : '0/0'}{' '}
                  <span className="text-xs font-normal">
                    {getLoadingCardStatus(2).label}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 font-mono tabular-nums truncate">
                  4–5 kritik/blok
                </div>
              </>
            ) : (
              <>
                <div
                  data-testid="metric-kritik"
                  className={`text-lg font-mono font-semibold tabular-nums whitespace-nowrap mt-0.5 truncate ${
                    audit.kritikPassCount === audit.expectedParagraphCount
                      ? 'text-emerald-400'
                      : 'text-amber-400'
                  }`}
                >
                  {audit.kritikPassCount}/{audit.expectedParagraphCount}{' '}
                  <span className="text-xs font-normal">
                    {audit.kritikPassCount === audit.expectedParagraphCount
                      ? 'Lulus'
                      : 'Revisi'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 font-mono tabular-nums truncate">
                  {totalValidProfanity} kritik (4–5/blok)
                </div>
              </>
            )}
          </div>

          {/* 3. Tanda Baca */}
          <div
            data-tooltip="Indikator kepatuhan Sentence-Aware Punctuation (EYD V) dan keutuhan token angka/tahun yang dilindungi."
            className={`rounded-lg p-2.5 sm:p-3 border transition-colors min-w-0 overflow-hidden ${
              !hasScript || isLoading
                ? 'bg-slate-950/80 border-slate-800/90'
                : audit.punctuationPassCount === audit.expectedParagraphCount
                ? 'bg-slate-950/80 border-emerald-500/30'
                : 'bg-slate-950/80 border-amber-500/40'
            }`}
          >
            <div className="text-xs text-slate-400 font-medium truncate">Ejaan (EYD)</div>
            {!hasScript && !isLoading ? (
              <>
                <div
                  data-testid="metric-sap"
                  className="text-lg font-mono font-semibold tabular-nums mt-0.5 text-slate-400 truncate"
                >
                  0/0
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                  Belum dicek
                </div>
              </>
            ) : isLoading ? (
              <>
                <div
                  data-testid="metric-sap"
                  className={`text-lg font-mono font-semibold tabular-nums mt-0.5 truncate ${
                    getLoadingCardStatus(2).color
                  }`}
                >
                  {loadingStageStep >= 2
                    ? `${audit.expectedParagraphCount}/${audit.expectedParagraphCount}`
                    : '0/0'}{' '}
                  <span className="text-xs font-normal">
                    {getLoadingCardStatus(2).label}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                  Angka & klausa aman
                </div>
              </>
            ) : (
              <>
                <div
                  data-testid="metric-sap"
                  className={`text-lg font-mono font-semibold tabular-nums mt-0.5 truncate ${
                    audit.punctuationPassCount === audit.expectedParagraphCount
                      ? 'text-emerald-400'
                      : 'text-amber-400'
                  }`}
                >
                  {audit.punctuationPassCount}/{audit.expectedParagraphCount}{' '}
                  <span className="text-xs font-normal">
                    {audit.punctuationPassCount === audit.expectedParagraphCount
                      ? 'EYD V'
                      : 'Revisi'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                  Angka & klausa aman
                </div>
              </>
            )}
          </div>

          {/* 4. Gaya Bahasa */}
          <div
            data-tooltip="Indikator konsistensi sapaan gue–lo anak tongkrongan serta penggunaan verba dan penanda percakapan Bank F1–F8."
            className={`rounded-lg p-2.5 sm:p-3 border transition-colors min-w-0 overflow-hidden ${
              !hasScript || isLoading
                ? 'bg-slate-950/80 border-slate-800/90'
                : audit.stylePassCount === audit.expectedParagraphCount
                ? 'bg-slate-950/80 border-emerald-500/30'
                : 'bg-slate-950/80 border-rose-500/40'
            }`}
          >
            <div className="text-xs text-slate-400 font-medium truncate">Gaya Bahasa</div>
            {!hasScript && !isLoading ? (
              <>
                <div
                  data-testid="metric-style"
                  className="text-lg font-mono font-semibold tabular-nums mt-0.5 text-slate-400 truncate"
                >
                  0/0
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                  Belum dicek
                </div>
              </>
            ) : isLoading ? (
              <>
                <div
                  data-testid="metric-style"
                  className={`text-lg font-mono font-semibold tabular-nums mt-0.5 truncate ${
                    getLoadingCardStatus(2).color
                  }`}
                >
                  {loadingStageStep >= 2
                    ? `${audit.expectedParagraphCount}/${audit.expectedParagraphCount}`
                    : '0/0'}{' '}
                  <span className="text-xs font-normal">
                    {getLoadingCardStatus(2).label}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                  Gaya lisan konsisten
                </div>
              </>
            ) : (
              <>
                <div
                  data-testid="metric-style"
                  className={`text-lg font-mono font-semibold tabular-nums mt-0.5 truncate ${
                    audit.stylePassCount === audit.expectedParagraphCount
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }`}
                >
                  {audit.stylePassCount}/{audit.expectedParagraphCount}{' '}
                  <span className="text-xs font-normal">
                    {audit.stylePassCount === audit.expectedParagraphCount
                      ? 'Informal'
                      : 'Revisi'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                  Gaya lisan konsisten
                </div>
              </>
            )}
          </div>

          {/* 5. Transisi (DRA+PTV) */}
          <div
            data-tooltip="Indikator kesinambungan logis antarblok (Discourse Relation Analyzer) dan bebas kalimat signpost presenter."
            className={`rounded-lg p-2.5 sm:p-3 border transition-colors min-w-0 overflow-hidden ${
              !hasScript || isLoading
                ? 'bg-slate-950/80 border-slate-800/90'
                : audit.transitionPassCount === audit.transitions.length
                ? 'bg-slate-950/80 border-emerald-500/30'
                : 'bg-slate-950/80 border-amber-500/40'
            }`}
          >
            <div className="text-xs text-slate-400 font-medium truncate">Alur Cerita</div>
            {!hasScript && !isLoading ? (
              <>
                <div
                  data-testid="metric-transisi"
                  className="text-lg font-mono font-semibold tabular-nums mt-0.5 text-slate-400 truncate"
                >
                  0/0
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                  Belum dicek
                </div>
              </>
            ) : isLoading ? (
              <>
                <div
                  data-testid="metric-transisi"
                  className={`text-lg font-mono font-semibold tabular-nums mt-0.5 ${
                    getLoadingCardStatus(2).color
                  }`}
                >
                  {loadingStageStep >= 2
                    ? `${audit.transitions.length}/${audit.transitions.length}`
                    : '0/0'}{' '}
                  <span className="text-xs font-normal">
                    {getLoadingCardStatus(2).label}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                  Alur logis & kohesif
                </div>
              </>
            ) : (
              <>
                <div
                  data-testid="metric-transisi"
                  className={`text-lg font-mono font-semibold tabular-nums mt-0.5 truncate ${
                    audit.transitionPassCount === audit.transitions.length
                      ? 'text-emerald-400'
                      : 'text-amber-400'
                  }`}
                >
                  {audit.transitionPassCount}/{audit.transitions.length}{' '}
                  <span className="text-xs font-normal">
                    {audit.transitionPassCount === audit.transitions.length
                      ? 'Kohesif'
                      : 'Revisi'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                  Alur logis & kohesif
                </div>
              </>
            )}
          </div>

          {/* 6. Kata / Estimasi Durasi */}
          <div
            data-tooltip="Indikator jumlah kata aktual naskah dibandingkan target kata serta estimasi durasi baca pada kecepatan 135 WPM."
            className={`rounded-lg p-2.5 sm:p-3 border transition-colors min-w-0 overflow-hidden ${
              !hasScript || isLoading
                ? 'bg-slate-950/80 border-slate-800/90'
                : audit.totalWords >= audit.targetTotalWords
                ? 'bg-slate-950/80 border-emerald-500/30'
                : 'bg-slate-950/80 border-amber-500/40'
            }`}
          >
            <div className="text-xs text-slate-400 font-medium truncate">Panjang Naskah</div>
            {!hasScript && !isLoading ? (
              <>
                <div
                  data-testid="metric-words"
                  className="text-lg font-mono font-semibold tabular-nums text-slate-400 mt-0.5 truncate"
                >
                  0/0
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 font-mono tabular-nums truncate">
                  Target: {audit.targetTotalWords} kt
                </div>
              </>
            ) : isLoading ? (
              <>
                <div
                  data-testid="metric-words"
                  className={`text-lg font-mono font-semibold tabular-nums mt-0.5 truncate ${
                    getLoadingCardStatus(2).color
                  }`}
                >
                  {loadingStageStep >= 2 ? audit.totalWords : 0}{' '}
                  <span className="text-xs font-normal opacity-80">
                    / {audit.targetTotalWords} kt
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 font-mono tabular-nums truncate">
                  Target: {audit.targetTotalWords} kt
                </div>
              </>
            ) : (
              <>
                <div
                  data-testid="metric-words"
                  className={`text-lg font-mono font-semibold tabular-nums mt-0.5 truncate ${
                    audit.totalWords >= audit.targetTotalWords
                      ? 'text-emerald-400'
                      : 'text-amber-400'
                  }`}
                >
                  {audit.totalWords}{' '}
                  <span className="text-xs font-normal opacity-80">
                    / {audit.targetTotalWords} kt
                  </span>
                </div>
                <div className="text-[11px] mt-0.5 flex flex-col font-mono tabular-nums leading-snug min-w-0">
                  <span
                    className={`truncate ${
                      audit.totalWords >= audit.targetTotalWords
                        ? 'text-emerald-400 font-semibold'
                        : 'text-amber-400 font-medium'
                    }`}
                  >
                    {audit.totalWords >= audit.targetTotalWords
                      ? 'Target Terpenuhi'
                      : 'Kurang Kata'}
                  </span>
                  <span className="text-slate-400 text-[10px] truncate" title={audit.estimatedDurationFormatted}>
                    {audit.estimatedDurationFormatted.replace(/\s*\(estimasi.*$/, '')} (135 WPM)
                  </span>
                </div>
              </>
            )}
          </div>

          {/* 7. Akurasi Sumber (Source Fidelity) */}
          <div
            data-tooltip="Indikator kesesuaian naskah terhadap topik dan argumen dokumen sumber serta bebas kebocoran teks instruksi/framework."
            className={`rounded-lg p-2.5 sm:p-3 border transition-colors min-w-0 overflow-hidden ${
              !hasScript || isLoading
                ? 'bg-slate-950/80 border-slate-800/90'
                : audit.sourceFidelity?.passed
                ? 'bg-slate-950/80 border-emerald-500/30'
                : 'bg-slate-950/80 border-rose-500/40'
            }`}
          >
            <div className="text-xs text-slate-400 font-medium truncate">Akurasi Fakta</div>
            {!hasScript && !isLoading ? (
              <>
                <div
                  data-testid="metric-source-fidelity"
                  className="text-lg font-mono font-semibold tabular-nums mt-0.5 text-slate-400 truncate"
                >
                  0%
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                  Belum dicek
                </div>
              </>
            ) : isLoading ? (
              <>
                <div
                  data-testid="metric-source-fidelity"
                  className={`text-lg font-mono font-semibold tabular-nums mt-0.5 truncate ${
                    getLoadingCardStatus(2).color
                  }`}
                >
                  {loadingStageStep >= 2 ? `${audit.sourceFidelity?.score ?? 100}%` : '0%'}{' '}
                  <span className="text-xs font-normal">
                    {getLoadingCardStatus(2).label}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                  Bebas kebocoran
                </div>
              </>
            ) : (
              <>
                <div
                  data-testid="metric-source-fidelity"
                  className={`text-lg font-mono font-semibold tabular-nums mt-0.5 truncate ${
                    audit.sourceFidelity?.passed
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }`}
                >
                  {audit.sourceFidelity?.score ?? 0}%{' '}
                  <span className="text-xs font-normal">
                    {audit.sourceFidelity?.passed ? 'Sesuai' : 'Melenceng'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                  {audit.sourceFidelity?.instructionLeakage.passed
                    ? 'Bebas kebocoran'
                    : 'Instruksi bocor'}
                </div>
              </>
            )}
          </div>

          {/* 8. Bebas Petik */}
          <div
            data-tooltip="Indikator kepatuhan Unified Quote-Free Narration System (SQNN): naskah final 100% bebas dari tanda petik ganda lurus maupun melengkung."
            className={`rounded-lg p-2.5 sm:p-3 border transition-colors min-w-0 overflow-hidden ${
              !hasScript || isLoading
                ? 'bg-slate-950/80 border-slate-800/90'
                : audit.quoteFree?.passed
                ? 'bg-slate-950/80 border-emerald-500/30'
                : 'bg-slate-950/80 border-rose-500/40'
            }`}
          >
            <div className="text-xs text-slate-400 font-medium truncate">Bebas Petik (SQNN)</div>
            {!hasScript && !isLoading ? (
              <>
                <div
                  data-testid="metric-quote-free"
                  className="text-lg font-mono font-semibold tabular-nums mt-0.5 text-slate-400 truncate"
                >
                  0/0
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                  Belum dicek
                </div>
              </>
            ) : isLoading ? (
              <>
                <div
                  data-testid="metric-quote-free"
                  className={`text-lg font-mono font-semibold tabular-nums mt-0.5 truncate ${
                    getLoadingCardStatus(3).color
                  }`}
                >
                  {loadingStageStep >= 3 ? (audit.quoteFree?.passed ? 'LULUS' : 'REVISI') : '0/0'}{' '}
                  <span className="text-xs font-normal">
                    {getLoadingCardStatus(3).label}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                  Bebas tanda petik
                </div>
              </>
            ) : (
              <>
                <div
                  data-testid="metric-quote-free"
                  className={`text-lg font-mono font-semibold tabular-nums mt-0.5 truncate ${
                    audit.quoteFree?.passed ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {audit.quoteFree?.passed ? 'LULUS' : 'REVISI'}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 font-mono tabular-nums truncate">
                  {audit.quoteFree?.passed
                    ? 'Bebas tanda petik'
                    : `${audit.quoteFree?.totalQuotesFound ?? 0} petik terdeteksi`}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Ringkasan Pelanggaran / Saran Repair jika ada dan naskah sudah tersedia */}
        {hasScript && !isLoading && audit.repairSuggestions.length > 0 && (
          <div className="mt-3.5 pt-3 border-t border-slate-800/80 text-xs text-amber-300 space-y-1">
            <div className="font-semibold text-amber-200">
              Temuan Audit yang Perlu Diperbaiki ({audit.repairSuggestions.length}):
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-slate-300">
              {audit.repairSuggestions.slice(0, 5).map((sug, i) => (
                <li key={i}>{sug}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* C. TOOLBAR STUDIO PENULISAN PROFESIONAL (Dikelompokkan berdasarkan fungsi) */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-3.5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Kelompok Kiri: Mode Tampilan Editor, Perbaiki Otomatis, & Status */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setEditorMode('VISUAL_BLOCKS')}
                data-tooltip="Editor visual 5 blok SCTF."
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  editorMode === 'VISUAL_BLOCKS'
                    ? 'bg-slate-800 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Visual
              </button>
              <button
                type="button"
                onClick={() => setEditorMode('RAW_SCTF')}
                data-tooltip="Teks mentah 5 baris tanpa baris kosong."
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  editorMode === 'RAW_SCTF'
                    ? 'bg-slate-800 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Polos
              </button>
              <button
                type="button"
                onClick={() => setEditorMode('AUDIT_JSON')}
                data-tooltip="Detail laporan audit JSON."
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  editorMode === 'AUDIT_JSON'
                    ? 'bg-slate-800 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Laporan
              </button>
              <button
                type="button"
                onClick={() => setEditorMode('MONITORING_LINGUISTIK')}
                data-tooltip="Statistik Kata penggunaan Leksikon & F7."
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  editorMode === 'MONITORING_LINGUISTIK'
                    ? 'bg-slate-800 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Data
              </button>
            </div>

            <button
              type="button"
              data-testid="auto-enforce-btn"
              disabled={isLoading || isAnyBlockPostProdRunning || !canDisplayBlocksInEditor}
              onClick={() => onExecuteOperation('AUTO_ENFORCE')}
              data-tooltip="Perbaiki otomatis aturan naskah."
              className="px-3 py-1.5 text-xs font-semibold text-emerald-200 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 disabled:opacity-40 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>
                {isLoading && activeOperation === 'AUTO_ENFORCE'
                  ? 'Memproses...'
                  : 'Oto-Revisi'}
              </span>
            </button>

            {/* Indikator Status Naskah di Editor */}
            {canDisplayFinalScript ? (
              <span
                data-testid="editor-script-status-badge"
                className="px-2 py-1 rounded-md text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1"
              >
                <Check className="w-3 h-3 text-emerald-400" />
                SIAP PAKAI
              </span>
            ) : canDisplayBlocksInEditor && !audit.passed ? (
              <span
                data-testid="editor-script-status-badge"
                className="px-2 py-1 rounded-md text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1"
              >
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                PERLU PERBAIKAN
              </span>
            ) : stage3Failed ? (
              <span
                data-testid="editor-script-status-badge"
                className="px-2 py-1 rounded-md text-[11px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1"
              >
                <AlertTriangle className="w-3 h-3 text-rose-400" />
                AUDIT GAGAL
              </span>
            ) : isWorkflowActive ? (
              <span
                data-testid="editor-script-status-badge"
                className="px-2 py-1 rounded-md text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1"
              >
                <Clock className="w-3 h-3 text-amber-400 animate-spin" />
                DIPROSES
              </span>
            ) : null}
          </div>

          {/* Kelompok Kanan: Salin, Ekspor, Animasi, & Suara */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              data-testid={
                !isFinalExportLocked
                  ? 'export-unlocked-badge'
                  : 'export-locked-badge'
              }
              className={`text-[10px] font-mono px-2 py-1 rounded flex items-center gap-1 shrink-0 ${
                !isFinalExportLocked
                  ? 'bg-emerald-950/60 border border-emerald-800/80 text-emerald-300'
                  : 'bg-amber-950/60 border border-amber-800/80 text-amber-300'
              }`}
            >
              {!isFinalExportLocked
                ? 'Ekspor Terbuka'
                : 'Ekspor Terkunci'}
            </span>

            <button
              type="button"
              disabled={!hasScript || isLoading}
              onClick={handleCopyClean}
              data-tooltip={
                !hasScript
                  ? 'Naskah belum tersedia. Jalankan alur naskah terlebih dahulu.'
                  : 'Salin naskah bersih 5 blok ke clipboard.'
              }
              className="px-2.5 py-1.5 text-xs font-medium text-slate-200 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copiedClean ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Tersalin</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin</span>
                </>
              )}
            </button>

            <button
              type="button"
              data-testid="export-txt-btn"
              disabled={isFinalExportLocked}
              onClick={onExportTxt}
              data-tooltip={
                isFinalExportLocked
                  ? 'Terkunci: Naskah belum tersedia.'
                  : 'Unduh naskah final (.txt).'
              }
              className={`px-2.5 py-1.5 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 ${
                !isFinalExportLocked
                  ? 'bg-emerald-600/20 text-emerald-200 border border-emerald-500/40 hover:bg-emerald-600/30 font-semibold cursor-pointer'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 cursor-not-allowed'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>.TXT</span>
            </button>

            <button
              type="button"
              data-testid="export-docx-btn"
              disabled={isFinalExportLocked}
              onClick={onExportDocx}
              data-tooltip={
                isFinalExportLocked
                  ? 'Terkunci: Naskah belum tersedia.'
                  : 'Unduh naskah Microsoft Word (.docx).'
              }
              className={`px-2.5 py-1.5 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 ${
                !isFinalExportLocked
                  ? 'bg-emerald-600/20 text-emerald-200 border border-emerald-500/40 hover:bg-emerald-600/30 font-semibold cursor-pointer'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 cursor-not-allowed'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>.DOCX</span>
            </button>

            <button
              type="button"
              data-testid="export-audit-json-btn"
              disabled={isFinalExportLocked}
              onClick={onExportAuditJson}
              data-tooltip={
                isFinalExportLocked
                  ? 'Terkunci: Laporan audit belum tersedia.'
                  : 'Unduh laporan audit (.json).'
              }
              className={`px-2.5 py-1.5 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 ${
                !isFinalExportLocked
                  ? 'bg-emerald-600/20 text-emerald-200 border border-emerald-500/40 hover:bg-emerald-600/30 font-semibold cursor-pointer'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 cursor-not-allowed'
              }`}
            >
              <FileCode2 className="w-3.5 h-3.5" />
              <span>.JSON</span>
            </button>

            <button
              type="button"
              data-testid="sound-notification-toggle"
              onClick={onToggleSound}
              data-tooltip={
                soundEnabled
                  ? 'Suara notifikasi aktif. Klik untuk mematikan.'
                  : 'Suara notifikasi nonaktif. Klik untuk mengaktifkan.'
              }
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer ${
                soundEnabled
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-200 hover:bg-amber-500/20'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {soundEnabled ? (
                <Volume2 className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 text-slate-500" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ANIMASI LOADING SAAT GENERATE / OPERASI */}
      {isLoading && (
        <div className="space-y-4">
          <BookLoadingAnimation
            label="Menyusun Naskah SCTF Berdasarkan Fakta Terverifikasi..."
            stageName="Alur Narasi & Struktur SCTF"
          />
          <RacingCarLoadingAnimation
            activeStep={loadingStageStep}
            totalSteps={3}
            stageName="Produksi Naskah"
            operation={activeOperation}
          />
        </div>
      )}

      {/* B. EDITOR 5 BLOK VISUAL / RAW CLEAN_SCRIPT / AUDIT JSON */}
      {editorMode === 'VISUAL_BLOCKS' && (
        canDisplayBlocksInEditor ? (
          <div className="space-y-4">
          {audit.stages.map((stageAudit, idx) => {
            const transitionFromPrev =
              idx > 0
                ? audit.transitions.find((t) => t.toBlock === idx + 1)
                : undefined;
            const blockText = blocks[idx] || '';
            const blockHasContent = blockText.trim().length > 0;
            const isTechOpen = Boolean(expandedTechBlocks[stageAudit.id]);

            const isThisBlockRunning =
              activeBlockPostProd !== null &&
              activeBlockPostProd.blockIndex === idx;
            const isOtherBlockRunning =
              activeBlockPostProd !== null &&
              activeBlockPostProd.blockIndex !== idx;
            const postProdMeta = blockPostProdResults[idx];

            return (
              <article
                key={stageAudit.id}
                data-testid={`sctf-block-card-${stageAudit.id}`}
                className={`bg-[#111827] border rounded-xl p-4 sm:p-5 space-y-3.5 shadow-sm transition-colors ${
                  isThisBlockRunning
                    ? 'border-amber-500/70 ring-1 ring-amber-500/30'
                    : 'border-slate-800'
                }`}
              >
                {/* Header Blok dengan Metadata Studio + Tombol PERDALAM & TRANSISI per Blok */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-800/80 pb-3">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs">
                    <span className="font-semibold text-slate-100 text-sm">
                      Blok {stageAudit.id} — {stageAudit.stageName}
                    </span>

                    {/* Tombol Pascaproduksi Individual per Blok: PERBAIKI, PERDALAM & TRANSISI */}
                    <div className="inline-flex flex-wrap items-center gap-1.5 ml-1">
                      <button
                        type="button"
                        data-testid={`block-repair-btn-${stageAudit.id}`}
                        disabled={
                          isLoading ||
                          isAnyBlockPostProdRunning
                        }
                        onClick={() => onRepairSingleBlock(idx)}
                        data-tooltip={`Perbaiki khusus Blok ${stageAudit.id} (4 blok lain tetap utuh).`}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-md border transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                          isThisBlockRunning
                            ? 'bg-emerald-500/30 border-emerald-400 text-emerald-100 shadow-sm'
                            : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/40'
                        }`}
                      >
                        <Wrench className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span>
                          {isThisBlockRunning
                            ? 'Memperbaiki...'
                            : 'Perbaiki'}
                        </span>
                      </button>

                      <button
                        type="button"
                        data-testid={`block-perdalam-btn-${stageAudit.id}`}
                        disabled={
                          isLoading ||
                          isAnyBlockPostProdRunning ||
                          !blockHasContent
                        }
                        onClick={() =>
                          onBlockPostProduction &&
                          onBlockPostProduction(idx, 'PERDALAM')
                        }
                        data-tooltip="Perdalam pembahasan blok ini tanpa mengubah fakta."
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                          isThisBlockRunning &&
                          activeBlockPostProd?.operation === 'PERDALAM'
                            ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                            : 'bg-slate-800/90 hover:bg-slate-700 text-slate-100 border-slate-700'
                        }`}
                      >
                        <Layers className="w-3 h-3 text-amber-400 shrink-0" />
                        <span>
                          {isThisBlockRunning &&
                          activeBlockPostProd?.operation === 'PERDALAM'
                            ? 'Memperdalam...'
                            : 'Perdalam'}
                        </span>
                      </button>

                      <button
                        type="button"
                        data-testid={`block-transisi-btn-${stageAudit.id}`}
                        disabled={
                          isLoading ||
                          isAnyBlockPostProdRunning ||
                          !blockHasContent
                        }
                        onClick={() =>
                          onBlockPostProduction &&
                          onBlockPostProduction(idx, 'TRANSISI')
                        }
                        data-tooltip="Haluskan jembatan transisi antarblok."
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                          isThisBlockRunning &&
                          activeBlockPostProd?.operation === 'TRANSISI'
                            ? 'bg-sky-500/25 border-sky-400 text-sky-200'
                            : 'bg-slate-800/90 hover:bg-slate-700 text-slate-100 border-slate-700'
                        }`}
                      >
                        <ArrowLeftRight className="w-3 h-3 text-sky-400 shrink-0" />
                        <span>
                          {isThisBlockRunning &&
                          activeBlockPostProd?.operation === 'TRANSISI'
                            ? 'Menghaluskan...'
                            : 'Transisi'}
                        </span>
                      </button>

                      {/* Badge Status Monitoring Eksekusi Blok (Section H) */}
                      {isThisBlockRunning && (
                        <span
                          data-testid={`block-postprod-status-${stageAudit.id}`}
                          className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500/20 border border-amber-500/40 text-amber-200 animate-pulse"
                        >
                          {activeBlockPostProd?.operation === 'PERDALAM'
                            ? 'MEMPERDALAM...'
                            : 'TRANSISI...'}
                        </span>
                      )}
                      {isOtherBlockRunning && (
                        <span
                          data-testid={`block-postprod-status-${stageAudit.id}`}
                          className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-900 border border-slate-700 text-slate-300"
                        >
                          TETAP
                        </span>
                      )}
                    </div>

                    <span aria-hidden="true" className="text-slate-600">
                      ·
                    </span>
                    <span className="font-mono tabular-nums text-amber-300/90">
                      Bobot {stageAudit.targetWeightPercent}%
                      {blockHasContent &&
                        typeof stageAudit.actualWeightPercent === 'number' && (
                          <span className="text-slate-400">
                            {' '}
                            ({stageAudit.actualWeightPercent}%)
                          </span>
                        )}
                    </span>
                    <span aria-hidden="true" className="text-slate-600">
                      ·
                    </span>
                    <span
                      data-testid={`block-word-counter-${stageAudit.id}`}
                      className="font-mono tabular-nums text-slate-300"
                    >
                      {blockHasContent ? stageAudit.words : 0}/{stageAudit.targetWords} kata
                    </span>
                    {blockHasContent && transitionFromPrev && (
                      <>
                        <span aria-hidden="true" className="text-slate-600">
                          ·
                        </span>
                        <span
                          className={
                            transitionFromPrev.passed
                              ? 'text-slate-400 font-mono'
                              : 'text-rose-400 font-mono'
                          }
                        >
                          B{transitionFromPrev.fromBlock}→B{transitionFromPrev.toBlock}: {transitionFromPrev.relation}
                        </span>
                      </>
                    )}
                  </div>

                  {blockHasContent ? (
                    <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono tabular-nums">
                      <span
                        className={
                          stageAudit.profanityPassed
                            ? 'text-emerald-400'
                            : 'text-amber-400'
                        }
                      >
                        Kritik: {stageAudit.validProfanityCount}/4–5
                      </span>
                      <span aria-hidden="true" className="text-slate-600">
                        ·
                      </span>
                      <span
                        className={
                          stageAudit.stylePassed
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }
                      >
                        Gue–Lo: {stageAudit.stylePassed ? 'Lulus' : 'Cek'}
                      </span>
                      <span aria-hidden="true" className="text-slate-600">
                        ·
                      </span>
                      <span
                        className={
                          stageAudit.punctuationPassed
                            ? 'text-emerald-400'
                            : 'text-amber-400'
                        }
                      >
                        SAP: {stageAudit.punctuationPassed ? 'Lulus' : 'Revisi'}
                      </span>
                      {audit.quoteFree && (
                        <>
                          <span aria-hidden="true" className="text-slate-600">
                            ·
                          </span>
                          <span
                            className={
                              audit.quoteFree.blockStatus[idx]?.passed ?? true
                                ? 'text-emerald-400'
                                : 'text-rose-400 font-semibold'
                            }
                          >
                            SQNN:{' '}
                            {(audit.quoteFree.blockStatus[idx]?.passed ?? true)
                              ? 'Lulus'
                              : 'Petik'}
                          </span>
                        </>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs font-mono text-slate-500">
                      Menunggu naskah
                    </span>
                  )}
                </div>

                {/* Indikator Keterlacakan Master Framework per Blok (Komponen & Batas Pembahasan) */}
                {workflowState?.traceabilityReport?.blockResults[idx] && (
                  <div className="px-3 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] font-mono flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-cyan-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                      <span>
                        Landasan Kerangka: Komponen{' '}
                        {workflowState.traceabilityReport.blockResults[idx].groundedComponentIds
                          .map((id) => `#${id}`)
                          .join(', ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      {workflowState.traceabilityReport.blockResults[idx].matchedMandatoryPoints.length > 0 && (
                        <span className="text-emerald-400 font-semibold">
                          ✓ {workflowState.traceabilityReport.blockResults[idx].matchedMandatoryPoints.length} Poin Wajib
                        </span>
                      )}
                      <span
                        className={
                          workflowState.traceabilityReport.blockResults[idx].boundaryCheck === 'LULUS'
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }
                      >
                        Batas: {workflowState.traceabilityReport.blockResults[idx].boundaryCheck}
                      </span>
                    </div>
                  </div>
                )}

                {/* Panel Ringkasan Monitoring Pascaproduksi Blok (Section H.1 & H.2) */}
                {postProdMeta && (
                  <div
                    data-testid={`block-postprod-summary-${stageAudit.id}`}
                    className={`px-3 py-2 rounded-lg border text-xs flex flex-wrap items-center justify-between gap-2 ${
                      postProdMeta.operation === 'PERDALAM'
                        ? 'bg-amber-950/30 border-amber-800/60 text-amber-100'
                        : 'bg-sky-950/30 border-sky-800/60 text-sky-100'
                    }`}
                  >
                    {postProdMeta.operation === 'PERDALAM' ? (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="font-bold uppercase tracking-wider text-[11px] text-amber-300">
                          PERDALAM BLOK {stageAudit.id}
                        </span>
                        <span className="font-mono">
                          {postProdMeta.wordsBefore} → <strong>{postProdMeta.wordsAfter}</strong> kata (
                          <strong className="text-emerald-300">
                            {postProdMeta.wordDelta >= 0
                              ? `+${postProdMeta.wordDelta}`
                              : postProdMeta.wordDelta}
                          </strong>
                          )
                        </span>
                        <span className="font-mono">
                          Target: <strong>{postProdMeta.targetWords}</strong> kata
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="font-bold uppercase tracking-wider text-[11px] text-sky-300">
                          TRANSISI BLOK {stageAudit.id}
                        </span>
                        <span>
                          Bagian: <strong>{postProdMeta.transitionPartsUpdated}</strong>
                        </span>
                        <span className="font-mono">
                          {postProdMeta.wordsBefore} → <strong>{postProdMeta.wordsAfter}</strong> kata
                        </span>
                      </div>
                    )}
                    <div className="text-[11px] font-mono text-emerald-300 flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Fakta Terjaga · 4 Blok Lain Tetap</span>
                    </div>
                  </div>
                )}

                {/* Textarea Editor Blok yang Lega & Nyaman Dibaca */}
                <div>
                  <label
                    htmlFor={`block-editor-${stageAudit.id}`}
                    className="sr-only"
                  >
                    Edit Narasi Blok {stageAudit.id} ({stageAudit.stageName})
                  </label>
                  <textarea
                    id={`block-editor-${stageAudit.id}`}
                    rows={5}
                    value={blockText}
                    placeholder={`Blok ${stageAudit.id} (${stageAudit.stageName} — target ${stageAudit.targetWords} kata / ${stageAudit.targetWeightPercent}%).`}
                    onChange={(e) => onBlockEdit(idx, e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3.5 text-sm text-slate-100 placeholder-slate-600 leading-relaxed focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>

                {/* Panel Teknis Collapsible agar Studio Tetap Rapi tanpa Menghilangkan Fitur */}
                {blockHasContent && (
                  <div className="pt-0.5">
                    <button
                      type="button"
                      onClick={() => toggleBlockTechDetail(stageAudit.id)}
                      data-tooltip="Rincian span makian dan kosakata F1–F8 pada blok ini."
                      className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-950/60 hover:bg-slate-950 border border-slate-800/80 rounded-lg transition-colors cursor-pointer"
                    >
                      <span className="font-mono">
                        Rincian Blok {stageAudit.id}:{' '}
                        <span className="text-amber-300">
                          {stageAudit.validProfanityCount} makian valid
                        </span>{' '}
                        ·{' '}
                        <span className="text-slate-300">
                          {stageAudit.coreLexiconUsed.length} kata F1
                        </span>{' '}
                        ·{' '}
                        <span className="text-slate-300">
                          {stageAudit.informalVerbsFound.length} verba lisan
                        </span>
                      </span>
                      <span className="flex items-center gap-1 text-[11px]">
                        {isTechOpen ? (
                          <>
                            <span>Tutup</span>
                            <ChevronUp className="w-3.5 h-3.5" />
                          </>
                        ) : (
                          <>
                            <span>Detail</span>
                            <ChevronDown className="w-3.5 h-3.5" />
                          </>
                        )}
                      </span>
                    </button>

                    {isTechOpen && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pt-2.5 text-xs">
                        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3 space-y-1.5">
                          <div className="font-medium text-slate-300 flex items-center justify-between">
                            <span>Span Makian Terintegrasi (4–5 Wajib):</span>
                            <span className="font-mono tabular-nums text-slate-400">
                              {stageAudit.validProfanityCount}/{stageAudit.profanityEvents.length} valid
                            </span>
                          </div>
                          {stageAudit.profanityEvents.length > 0 ? (
                            <div className="space-y-1">
                              {stageAudit.profanityEvents.map((ev) => (
                                <div
                                  key={ev.spanId}
                                  className="flex flex-wrap items-baseline justify-between gap-2 border-t border-slate-900 pt-1"
                                >
                                  <div>
                                    <span
                                      className={`font-mono font-medium ${
                                        ev.valid
                                          ? 'text-emerald-400'
                                          : 'text-rose-400 line-through'
                                      }`}
                                    >
                                      "{ev.text}"
                                    </span>
                                    <span className="text-slate-500 font-mono tabular-nums ml-1.5">
                                      [Kalimat {ev.sentenceIndex + 1}]
                                    </span>
                                  </div>
                                  <span className="text-slate-400">
                                    {ev.valid
                                      ? `Sasaran: ${ev.targetConcept}`
                                      : ev.reason}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-rose-400">
                              Belum ada makian terintegrasi di blok ini.
                            </p>
                          )}
                        </div>

                        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3 space-y-1.5">
                          <div className="font-medium text-slate-300">
                            Jejak Kosakata Lisan (F1–F8):
                          </div>
                          <div className="text-slate-400 leading-relaxed">
                            <span className="text-slate-500">Slot F1:</span>{' '}
                            <span className="font-mono text-amber-300">
                              {stageAudit.coreLexiconUsed.length > 0
                                ? stageAudit.coreLexiconUsed.join(', ')
                                : '-'}
                            </span>
                          </div>
                          <div className="text-slate-400 leading-relaxed">
                            <span className="text-slate-500">Verba Lisan:</span>{' '}
                            <span className="font-mono text-slate-200">
                              {stageAudit.informalVerbsFound
                                .slice(0, 12)
                                .join(', ') || '-'}
                            </span>
                          </div>
                          <div className="text-slate-400 leading-relaxed">
                            <span className="text-slate-500">Penanda (F4):</span>{' '}
                            <span className="font-mono text-slate-300">
                              {stageAudit.conversationalMarkersFound
                                .slice(0, 12)
                                .join(', ') || '-'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
          </div>
        ) : stage3Failed ? (
          <div
            data-testid="final-audit-failed-placeholder"
            className="bg-[#111827] border border-rose-800/80 rounded-xl p-8 text-center space-y-4 shadow-sm"
          >
            <div className="space-y-1.5 max-w-lg mx-auto">
              <h3
                data-testid="final-audit-failed-title"
                className="text-base sm:text-lg font-bold text-rose-200 tracking-tight"
              >
                FINAL AUDIT BELUM LULUS
              </h3>
              <p
                data-testid="final-audit-failed-desc"
                className="text-xs sm:text-sm text-slate-300 leading-relaxed"
              >
                Terdapat pelanggaran aturan kualitas. Periksa rincian temuan pada Validator Kualitas di atas.
              </p>
              <p className="text-xs text-rose-300/80 font-mono pt-1">
                Naskah dan fitur ekspor terkunci hingga perbaikan disahkan.
              </p>
            </div>

            <RacingCarLoadingAnimation
              activeStep={workflowState?.currentStageId || 3}
              totalSteps={3}
              stageName={(workflowState?.stages as any)?.[workflowState?.currentStageId || 3]?.name || 'Pengesahan Final'}
              isFailed={true}
              isFinished={false}
              errorMessage={(workflowState?.stages as any)?.[3]?.summary || 'Pengesahan Final ditolak karena terdapat pelanggaran kontrak kualitas.'}
            />
          </div>
        ) : isWorkflowActive ? (
          <div
            data-testid="workflow-processing-placeholder"
            className="flex-1 bg-[#111827] border border-amber-800/60 rounded-xl p-6 sm:p-8 text-center space-y-4 shadow-sm flex flex-col justify-center min-h-[360px]"
          >
            <div className="space-y-1.5 max-w-xl mx-auto">
              <h3
                data-testid="processing-placeholder-title"
                className="text-base sm:text-lg font-bold text-amber-200 tracking-tight"
              >
                NASKAH SEDANG DIPROSES
              </h3>
              <p
                data-testid="processing-placeholder-desc"
                className="text-xs sm:text-sm text-slate-300 leading-relaxed"
              >
                Menyusun dan memvalidasi 5 blok naskah berdasarkan kerangka sumber dan aturan kualitas.
              </p>
              <p
                data-testid="processing-placeholder-extra"
                className="text-xs text-slate-400 leading-relaxed"
              >
                Naskah final akan tampil otomatis setelah Tahap 3 dinyatakan LULUS.
              </p>
            </div>

            {/* Indikator Progres Workflow dengan Animasi Mobil Balap di Lintasan Horizontal */}
            <RacingCarLoadingAnimation
              activeStep={workflowState?.currentStageId || loadingStageStep}
              totalSteps={3}
              stageName={workflowState?.stages?.[workflowState.currentStageId]?.name || 'Produksi Naskah'}
              isFinished={stage3Passed}
              isFailed={Boolean(
                workflowState?.stages &&
                Object.values(workflowState.stages).some((st) => st.status === 'FAILED')
              )}
              errorMessage={
                workflowState?.stages
                  ? Object.values(workflowState.stages).find((st) => st.status === 'FAILED')?.summary
                  : undefined
              }
            />
          </div>
        ) : (
          <div
            data-testid="editor-empty-placeholder"
            className="flex-1 bg-[#111827] border border-slate-800 rounded-xl p-8 sm:p-10 text-center space-y-2.5 shadow-sm flex flex-col items-center justify-center min-h-[360px]"
          >
            <div className="w-11 h-11 rounded-full bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="text-sm sm:text-base font-semibold text-slate-200">
              BELUM ADA NASKAH FINAL
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Unggah kerangka naskah di panel kiri lalu klik &quot;GENERATE NASKAH&quot; untuk menjalankan 3 tahap otomatis.
            </p>
          </div>
        )
      )}

      {editorMode === 'RAW_SCTF' && (
        canDisplayBlocksInEditor ? (
          <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3 flex-1 flex flex-col">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>
                Teks Polos <code className="text-amber-300">clean_script</code> ({audit.expectedParagraphCount} baris tanpa baris kosong):
              </span>
              <span className="font-mono tabular-nums">
                Baris aktif: {cleanScript.split('\n').length}
              </span>
            </div>
            <textarea
              aria-label="Editor Raw Clean Script SCTF"
              data-testid="raw-sctf-textarea"
              rows={14}
              value={cleanScript}
              placeholder="Naskah final 5 baris SCTF..."
              onChange={(e) => onRawCleanScriptEdit(e.target.value)}
              className="w-full flex-1 min-h-[300px] bg-slate-950 border border-slate-800 rounded-lg p-3.5 font-mono text-xs text-slate-100 placeholder-slate-600 leading-relaxed focus:outline-none focus:border-amber-500"
            />
          </div>
        ) : (
          <div
            data-testid="raw-sctf-locked-placeholder"
            className="bg-[#111827] border border-slate-800 rounded-xl p-8 sm:p-10 text-center space-y-2.5 shadow-sm flex-1 flex flex-col items-center justify-center min-h-[360px]"
          >
            <div className="w-10 h-10 rounded-full bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <h4 className="text-xs sm:text-sm font-semibold text-slate-200">
              TEKS MENTAH TERKUNCI
            </h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {stage3Failed
                ? 'Terkunci karena Final Audit belum lulus.'
                : isWorkflowActive
                ? 'Sedang memproses naskah. Terbuka otomatis setelah Tahap 3 disahkan.'
                : 'Jalankan alur kerja 3 tahap untuk melihat teks mentah SCTF.'}
            </p>
          </div>
        )
      )}

      {editorMode === 'AUDIT_JSON' && (
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3 flex-1 flex flex-col">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Laporan Audit JSON:</span>
            <button
              type="button"
              data-testid="download-audit-json-tab-btn"
              disabled={!canDisplayFinalScript}
              onClick={onExportAuditJson}
              data-tooltip={
                !canDisplayFinalScript
                  ? 'Terkunci: Selesaikan Tahap 3 terlebih dahulu.'
                  : 'Unduh laporan audit (.json).'
              }
              className="text-amber-400 hover:text-amber-300 disabled:opacity-40 disabled:cursor-not-allowed font-medium cursor-pointer"
            >
              Unduh .JSON
            </button>
          </div>
          <pre className="w-full bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs text-slate-200 overflow-x-auto max-h-[540px]">
            {JSON.stringify(audit, null, 2)}
          </pre>
        </div>
      )}
      
      {editorMode === 'MONITORING_LINGUISTIK' && (
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4 flex-1 flex flex-col min-h-[500px]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                MONITORING LINGUISTIK (F7 & LEKSIKON)
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">
                Bukti sinkronisasi real-time sistem terhadap penggunaan kosakata lisan dan logika konteks.
              </p>
            </div>
            {!hasScript && (
               <span className="text-[10px] font-mono px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-500">
                 MENUNGGU NASKAH
               </span>
            )}
          </div>

          {!hasScript ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3 opacity-60">
              <ShieldCheck className="w-10 h-10 text-slate-700" />
              <p className="text-xs text-slate-500 max-w-xs">
                Jalankan alur kerja naskah untuk melihat bagaimana F7 Contextual Guard dan Master Lexicon bekerja.
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
              {/* SECTION 1: F7 CONTEXTUAL GUARD */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                   <h4 className="text-[11px] font-bold text-amber-400 uppercase tracking-widest flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    F7 Contextual Guard (Logika Konteks)
                  </h4>
                  <span className="text-[10px] font-mono text-slate-500">
                    {audit.f7ContextualGuard?.totalF7Triggered ?? 0} Kejadian Dipantau
                  </span>
                </div>

                <div className="space-y-2">
                  {(audit.f7ContextualGuard?.findings || workflowState?.draftV0?.f7Report?.findings || []).length > 0 ? (
                    (audit.f7ContextualGuard?.findings || workflowState?.draftV0?.f7Report?.findings || []).map((finding, fIdx) => (
                      <div key={fIdx} className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-slate-200">
                            "{finding.word}"
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                            finding.status === 'RETAINED' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                            finding.status === 'REPLACED' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' :
                            'bg-amber-500/10 border-amber-500/30 text-amber-400'
                          }`}>
                            {finding.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed italic">
                          "{finding.reason}"
                        </p>
                        {finding.replacementUsed && finding.status !== 'RETAINED' && (
                           <div className="text-[10px] font-mono text-emerald-300 bg-emerald-950/20 p-1.5 rounded border border-emerald-900/30">
                              Penyesuaian: {finding.originalSnippet} → <strong>{finding.replacementUsed}</strong>
                           </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="p-4 border border-dashed border-slate-800 rounded-lg text-center">
                      <p className="text-[11px] text-slate-500">
                        {isLoading ? 'Menganalisis konteks naskah...' : 'F7 Contextual Guard aktif: Tidak ditemukan risiko pelanggaran konteks pada draft ini.'}
                      </p>
                    </div>
                  )}
                </div>
              </section>

              {/* SECTION 2: LEXICON HITS */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                   <h4 className="text-[11px] font-bold text-sky-400 uppercase tracking-widest flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5" />
                    Master Lexicon Hits (Kosakata Lisan)
                  </h4>
                  <span className="text-[10px] font-mono text-slate-500">
                    Sinkron: 1476 Entri
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {audit.stages.map((st, sIdx) => (
                    <div key={sIdx} className="bg-slate-900/40 border border-slate-800/80 rounded-lg p-3 space-y-2">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                        Blok {st.id}: {st.stageName}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {st.coreLexiconUsed.map((w, wIdx) => (
                          <span key={`f1-${wIdx}`} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 font-mono">
                            {w}
                          </span>
                        ))}
                        {st.informalVerbsFound.slice(0, 10).map((w, wIdx) => (
                          <span key={`v-${wIdx}`} className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/20 text-sky-300 font-mono">
                            {w}
                          </span>
                        ))}
                        {st.expansionLexiconUsed.slice(0, 5).map((w, wIdx) => (
                          <span key={`ex-${wIdx}`} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-mono">
                            {w}
                          </span>
                        ))}
                      </div>
                      {st.coreLexiconUsed.length === 0 && st.informalVerbsFound.length === 0 && (
                        <p className="text-[10px] text-slate-600 italic">Menganalisis jejak leksikon...</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>

               {/* SECTION 3: LANGUAGE PURITY (POLICY 1-4) */}
              <section className="space-y-3">
                <h4 className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Language Purity Gate (Policy 1-4)
                </h4>
                <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-3">
                   <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between text-[11px]">
                         <span className="text-slate-300">Purity Status:</span>
                         <span className={`font-bold ${audit.languageIntegrity?.passed ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {audit.languageIntegrity?.passed ? 'LULUS (Clean)' : 'PERLU PERBAIKAN'}
                         </span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono leading-relaxed">
                         {audit.languageIntegrity?.summary || 'Naskah diproses melalui 4 kebijakan kemurnian bahasa Indonesia.'}
                      </div>
                      {!audit.languageIntegrity?.passed && audit.languageIntegrity?.findings && (
                        <div className="mt-2 space-y-1">
                          {audit.languageIntegrity.findings.map((f, fi) => (
                            <div key={fi} className="text-[10px] text-rose-300 bg-rose-950/20 p-1.5 rounded border border-rose-900/30">
                              {f}
                            </div>
                          ))}
                        </div>
                      )}
                   </div>
                </div>
              </section>

              {/* SECTION 4: BANK FRASA G2–G11 USAGE STATISTICS */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-bold text-violet-400 uppercase tracking-widest flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5" />
                    Statistik Bank Frasa Naratif G2–G11
                  </h4>
                  <span className="text-[10px] font-mono text-slate-500">
                    Contextual Dynamic Selection
                  </span>
                </div>
                <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-3 space-y-3">
                  {(() => {
                    const phraseBank = getActiveG1G11PhraseBank();
                    const lowerScript = cleanScript.toLowerCase();
                    const detectedHits: { catCode: string; catLabel: string; phrase: string; count: number }[] = [];
                    let totalHits = 0;

                    for (const [catCode, phrases] of Object.entries(phraseBank)) {
                      const meta = G1G11_CATEGORY_METADATA[catCode] || { label: catCode };
                      for (const phrase of phrases) {
                        if (!phrase || phrase.length < 3) continue;
                        const pLower = phrase.toLowerCase();
                        const regex = new RegExp(`\\b${pLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
                        const matches = lowerScript.match(regex);
                        if (matches && matches.length > 0) {
                          detectedHits.push({
                            catCode,
                            catLabel: meta.label,
                            phrase,
                            count: matches.length,
                          });
                          totalHits += matches.length;
                        }
                      }
                    }

                    if (detectedHits.length === 0) {
                      return (
                        <div className="text-center py-4 text-slate-500 text-xs">
                          Belum ada frasa G2–G11 yang terdeteksi aktif pada naskah ini (atau naskah mengutamakan kalimat alami 100%).
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-2">
                        <div className="text-xs text-slate-300 font-medium flex items-center justify-between pb-1 border-b border-slate-800">
                          <span>Frasa G2–G11 Digunakan dalam Naskah:</span>
                          <span className="font-mono text-violet-300">{totalHits} Total Penggunaan</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {detectedHits.map((hit, idx) => (
                            <div key={idx} className="bg-slate-900/50 border border-slate-800/70 rounded p-2 text-xs flex flex-col gap-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-mono text-violet-400 font-semibold">{hit.catLabel}</span>
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-violet-950/40 text-violet-300 border border-violet-900/40">
                                  {hit.count}x pakai
                                </span>
                              </div>
                              <p className="font-mono text-slate-200 text-[11px] bg-slate-950 px-2 py-1 rounded border border-slate-900">
                                "{hit.phrase}"
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </section>
            </div>
          )}
        </div>
      )}

    </section>
  );
};
