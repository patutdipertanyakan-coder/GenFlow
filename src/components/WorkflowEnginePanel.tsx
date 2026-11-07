import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  WorkflowEngineState,
  WorkflowStageId,
  WorkflowStageStatus,
} from '../lib/types';
import {
  isWorkflowCompleted,
} from '../lib/workflowEngine';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Sparkles,
  FileText,
  Layers,
  Flame,
  MessageSquare,
  FileCheck2,
} from 'lucide-react';

interface WorkflowEnginePanelProps {
  workflowState: WorkflowEngineState;
  hasScript: boolean;
  hasOutline: boolean;
  isFrameworkConfirmed?: boolean;
  onOpenMasterFrameworkModal?: () => void;
  onRunFullWorkflow: () => void;
  onResetWorkflow: () => void;
}

export const WorkflowEnginePanel: React.FC<WorkflowEnginePanelProps> = ({
  workflowState,
  hasScript,
  hasOutline,
  isFrameworkConfirmed = false,
  onOpenMasterFrameworkModal,
  onRunFullWorkflow,
}) => {
  const [expandedStageId, setExpandedStageId] = useState<WorkflowStageId | null>(null);

  const isCompleted = isWorkflowCompleted(workflowState, hasScript);

  // Hitung jumlah tahap yang LULUS (PASSED)
  const passedStagesCount = Object.values(workflowState.stages).filter(
    (s) => s.status === 'PASSED'
  ).length;
  const progressPercentage = Math.round((passedStagesCount / 3) * 100);

  const getStatusBadge = (status: WorkflowStageStatus) => {
    switch (status) {
      case 'PASSED':
        return (
          <motion.span
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
          >
            <CheckCircle2 className="w-3 h-3" />
            Selesai
          </motion.span>
        );
      case 'RUNNING':
        return (
          <motion.span
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30"
          >
            <Clock className="w-3 h-3 animate-spin" />
            Proses
          </motion.span>
        );
      case 'FAILED':
        return (
          <motion.span
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30"
          >
            <AlertCircle className="w-3 h-3" />
            Gagal
          </motion.span>
        );
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-800/80 text-slate-400 border border-slate-700/60">
            <Clock className="w-2.5 h-2.5" />
            Antre
          </span>
        );
    }
  };

  const getStageIcon = (id: WorkflowStageId) => {
    switch (id) {
      case 1:
        return <FileText className="w-4 h-4 text-amber-400" />;
      case 2:
        return <Sparkles className="w-4 h-4 text-sky-400" />;
      case 3:
        return <ShieldCheck className="w-4 h-4 text-emerald-300" />;
    }
  };

  const toggleExpand = (stageId: WorkflowStageId) => {
    setExpandedStageId((prev) => (prev === stageId ? null : stageId));
  };

  return (
    <section
      aria-label="Workflow Engine Alur Produksi Naskah"
      className="bg-[#0f1420] border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg space-y-3.5"
    >
      {/* Header Panel Workflow Engine */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/90">
        <div>
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                workflowState.isRunning
                  ? 'bg-amber-400 animate-ping'
                  : isCompleted
                  ? 'bg-emerald-400'
                  : 'bg-amber-400'
              }`}
            />
            <h2 className="text-sm sm:text-base font-bold text-slate-100 tracking-tight">
              LANGKAH KERJA
            </h2>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-emerald-400">
              {passedStagesCount}/3 Tahap ({progressPercentage}%)
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Alur otomatis: Baca Sumber → Buat Naskah → Cek Kualitas.
          </p>
        </div>

        {/* Global Generate Button */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            data-testid="run-full-workflow-btn"
            aria-label="MULAI TULIS — JALANKAN SEMUA TAHAP (1–3)"
            disabled={workflowState.isRunning || !hasOutline}
            onClick={onRunFullWorkflow}
            data-tooltip={
              !hasOutline
                ? 'Isi bahan naskah dulu.'
                : workflowState.isRunning
                ? `Proses Tahap ${workflowState.currentStageId}/3...`
                : isCompleted
                ? 'Buat ulang naskah dari awal.'
                : 'Mulai buat naskah otomatis.'
            }
            className={`px-4 py-2 text-xs font-bold rounded-lg shadow-md transition-all flex items-center gap-2 cursor-pointer ${
              workflowState.isRunning
                ? 'bg-amber-500/80 text-slate-950 cursor-wait'
                : !hasOutline && !isCompleted
                ? 'bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed opacity-60'
                : isCompleted
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 border border-emerald-500/40'
                : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-amber-500/20'
            }`}
          >
            {workflowState.isRunning ? (
              <>
                <Clock className="w-3.5 h-3.5 animate-spin" />
                <span>{`Tahap ${workflowState.currentStageId}/3...`}</span>
              </>
            ) : isCompleted ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                <span>TULIS ULANG</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-slate-950" />
                <span>MULAI TULIS</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Progress Bar Visual Ringkas */}
      <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800/80">
        <motion.div
          className="h-full bg-gradient-to-r from-amber-500 via-emerald-400 to-emerald-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progressPercentage}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>

      {/* Grid 3 Stage Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {([1, 2, 3] as WorkflowStageId[]).map((stageId) => {
          const stage = workflowState.stages[stageId];
          const isExpanded = expandedStageId === stageId;
          const isCurrent = workflowState.currentStageId === stageId && workflowState.isRunning;

          return (
            <motion.div
              key={stageId}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: stageId * 0.03 }}
              data-testid={`workflow-stage-card-${stageId}`}
              className={`rounded-xl border p-3 space-y-2 transition-colors duration-300 relative overflow-hidden ${
                stage.status === 'PASSED'
                  ? 'bg-slate-950/90 border-emerald-500/40'
                  : stage.status === 'RUNNING' || isCurrent
                  ? 'bg-amber-500/15 border-amber-400 ring-1 ring-amber-400/50'
                  : stage.status === 'FAILED'
                  ? 'bg-rose-950/40 border-rose-500/50'
                  : 'bg-slate-950/60 border-slate-800/80'
              }`}
            >
              {isCurrent && (
                <motion.div
                  className="absolute inset-0 bg-amber-400/5 pointer-events-none"
                  animate={{ opacity: [0.3, 0.8, 0.3] }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                />
              )}

              <div className="flex items-center justify-between gap-1.5 relative z-10">
                <div className="flex items-center gap-1.5 min-w-0">
                  {getStageIcon(stageId)}
                  <span className="font-mono text-xs font-bold text-slate-200 truncate">
                    {stageId}. {stage.name}
                  </span>
                </div>
                {getStatusBadge(stage.status)}
              </div>

              <p className="text-[11px] text-slate-400 leading-snug line-clamp-2 relative z-10">
                {stage.description}
              </p>

              {stage.summary && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  transition={{ duration: 0.2 }}
                  className="text-[10px] font-mono text-slate-300 bg-slate-900/90 rounded px-2 py-1 border border-slate-800/80 truncate relative z-10"
                >
                  {stage.summary}
                </motion.div>
              )}

              {stageId === 1 && (
                <div className="pt-1.5 border-t border-slate-800/80 relative z-10">
                  <button
                    type="button"
                    onClick={onOpenMasterFrameworkModal}
                    data-testid="open-master-framework-btn"
                    className={`w-full py-1.5 px-2 rounded-lg text-[10px] font-mono font-semibold flex items-center justify-between border transition-all cursor-pointer ${
                      isFrameworkConfirmed
                        ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/40'
                        : 'bg-amber-950/50 border-amber-500/40 text-amber-300 hover:bg-amber-900/50 shadow-sm'
                    }`}
                  >
                    <span className="flex items-center gap-1 truncate">
                      <Layers className="w-3 h-3 text-amber-400 shrink-0" />
                      <span>Aturan Dasar</span>
                    </span>
                    <span className={`px-1.5 py-0.2 rounded uppercase text-[9px] font-bold tracking-wider ${
                      isFrameworkConfirmed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                    }`}>
                      {isFrameworkConfirmed ? 'TERKONFIRMASI' : 'TINJAU & KUNCI'}
                    </span>
                  </button>
                </div>
              )}

              {stageId === 2 && workflowState.traceabilityReport && (
                <div className="pt-1 text-[10px] font-mono text-cyan-300 flex items-center gap-1 relative z-10">
                  <CheckCircle2 className="w-3 h-3 text-cyan-400 shrink-0" />
                  <span className="truncate">Traceability: 5 blok terhubung</span>
                </div>
              )}

              {stage.data && (
                <button
                  type="button"
                  onClick={() => toggleExpand(stageId)}
                  className="w-full flex items-center justify-between text-[10px] text-amber-400 hover:text-amber-300 font-medium pt-1 border-t border-slate-800/60 cursor-pointer relative z-10"
                >
                  <span>{isExpanded ? 'Tutup Detail' : 'Lihat Log'}</span>
                  {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              )}

              <AnimatePresence>
                {isExpanded && stage.data && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="text-[10px] font-mono text-slate-300 bg-slate-900 p-2 rounded border border-slate-800 max-h-36 overflow-y-auto space-y-1 relative z-10"
                  >
                    <pre className="whitespace-pre-wrap break-all text-slate-400">
                      {JSON.stringify(stage.data, null, 2)}
                    </pre>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
};
