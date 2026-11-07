import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Database,
  Globe,
  Search,
  BookOpen,
  Sliders,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';
import { HCLSETraceabilityAudit } from '../lib/hybridContextualLexiconSelectionEngine';

interface HCLSEAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  audit?: HCLSETraceabilityAudit | null;
}

export const HCLSEAuditModal: React.FC<HCLSEAuditModalProps> = ({
  isOpen,
  onClose,
  audit,
}) => {
  const [activeTab, setActiveTab] = useState<number>(1); // 1..5
  const [searchQuery, setSearchQuery] = useState<string>('');

  if (!isOpen) return null;

  const blockNames: Record<number, string> = {
    1: 'Blok 1: Hook',
    2: 'Blok 2: Akar Masalah',
    3: 'Blok 3: Inti Masalah',
    4: 'Blok 4: Solusi',
    5: 'Blok 5: Kesimpulan',
  };

  const blockData = audit?.blockBreakdown?.[activeTab];
  const consideredItems = blockData?.considered || [];

  const supabaseSelected = consideredItems.filter(
    (item) => item.status === 'SELECTED_SUPABASE'
  );
  const globalInformalSelected = consideredItems.filter(
    (item) => item.status === 'SELECTED_GLOBAL_INFORMAL'
  );
  const rejectedItems = consideredItems.filter(
    (item) => item.status === 'REJECTED'
  );

  const blockWordFrequencies = blockData?.wordFrequencies || {};
  const overallWordFrequencies = audit?.wordFrequencies || {};

  // Group frequencies and sort descending
  const sortedBlockFrequencies = Object.entries(blockWordFrequencies)
    .filter(([word]) => (searchQuery ? word.includes(searchQuery.toLowerCase()) : true))
    .sort((a, b) => b[1] - a[1]);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-[#0f1420] border border-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden text-slate-100"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-900/60">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                  <span>AUDIT PEMILIHAN KOSAKATA HCLSE</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    V6.2.1
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Rincian evaluasi 5-Dimension Scoring, Path A Supabase, Path B Global Informal, & Frekuensi Kata.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 5 Block Tabs */}
          <div className="flex border-b border-slate-800/80 bg-slate-900/40 px-4 pt-2 overflow-x-auto no-scrollbar gap-1">
            {[1, 2, 3, 4, 5].map((blockId) => {
              const isActive = activeTab === blockId;
              const curBlockData = audit?.blockBreakdown?.[blockId];
              const supCount = curBlockData?.selectedSupabase?.length || 0;
              const globCount = curBlockData?.selectedGlobalInformal?.length || 0;

              return (
                <button
                  key={blockId}
                  onClick={() => setActiveTab(blockId)}
                  className={`px-4 py-2.5 rounded-t-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap border-t border-x ${
                    isActive
                      ? 'bg-[#0f1420] text-emerald-400 border-slate-700/80 border-b-transparent shadow-sm'
                      : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <Layers className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
                  <span>{blockNames[blockId]}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {supCount + globCount} kata
                  </span>
                </button>
              );
            })}
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {!audit ? (
              <div className="py-16 text-center text-slate-400 space-y-3">
                <Info className="w-10 h-10 mx-auto text-slate-600" />
                <p className="text-sm">
                  Belum ada data audit HCLSE yang tersedia. Silakan jalankan **Tahap 2** terlebih dahulu.
                </p>
              </div>
            ) : (
              <>
                {/* Section A: Kosakata Supabase Terpilih */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-emerald-400" />
                      <h3 className="text-sm font-bold text-emerald-300 uppercase tracking-wider">
                        A. KOSAKATA SUPABASE TERPILIH (PATH A)
                      </h3>
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        {supabaseSelected.length} Entri
                      </span>
                    </div>
                  </div>

                  {supabaseSelected.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-2">
                      Tidak ada kosakata Supabase terpilih pada blok ini.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {supabaseSelected.map((item, idx) => (
                        <div
                          key={idx}
                          className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-2 hover:border-emerald-500/30 transition-all"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="text-base font-bold font-mono text-emerald-400">
                                {item.candidateWord}
                              </span>
                              {item.formalEquivalent && (
                                <span className="text-xs text-slate-400 ml-2 italic">
                                  (Formal: {item.formalEquivalent})
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
                              Skor: {item.totalScore}/100
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-slate-300">
                            <div>
                              <span className="text-slate-400">Sumber:</span> public.lexicon_entries
                            </div>
                            <div>
                              <span className="text-slate-400">ID / Kategori:</span>{' '}
                              <span className="font-mono text-emerald-300">{item.supabaseId || item.category}</span>
                            </div>
                            {item.appliedF7Rule && (
                              <div className="col-span-2 text-amber-300/90 text-[10px] mt-0.5">
                                Aturan F7: {item.appliedF7Rule}
                              </div>
                            )}
                          </div>

                          <p className="text-[11px] text-slate-300 bg-slate-950/60 p-2 rounded border border-slate-800/80 leading-relaxed">
                            {item.selectionReason || 'Diksi alami, presisi makna, dan selaras F7 Guard.'}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Section B: Global Informal Terpilih */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-cyan-400" />
                      <h3 className="text-sm font-bold text-cyan-300 uppercase tracking-wider">
                        B. GLOBAL INFORMAL TERPILIH (PATH B)
                      </h3>
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                        {globalInformalSelected.length} Entri
                      </span>
                    </div>
                  </div>

                  {globalInformalSelected.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-2">
                      Tidak ada kata Global Informal yang dipicu pada blok ini.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {globalInformalSelected.map((item, idx) => (
                        <div
                          key={idx}
                          className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 space-y-2 hover:border-cyan-500/30 transition-all"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-base font-bold font-mono text-cyan-300">
                              {item.candidateWord}
                            </span>
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                              GLOBAL_INFORMAL
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-300 bg-slate-950/60 p-2 rounded border border-slate-800/80 leading-relaxed">
                            {item.selectionReason || 'Digunakan dari Global Informal karena tidak ada kandidat Supabase yang cocok tanpa merusak alur narasi.'}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Section C: Kandidat Ditolak */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-400" />
                      <h3 className="text-sm font-bold text-rose-300 uppercase tracking-wider">
                        C. KANDIDAT DITOLAK (NON-MATCH)
                      </h3>
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30">
                        {rejectedItems.length} Entri
                      </span>
                    </div>
                  </div>

                  {rejectedItems.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-2">
                      Semua kandidat dievaluasi memenuhi ambang batas pada blok ini.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {rejectedItems.map((item, idx) => (
                        <div
                          key={idx}
                          className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-3 space-y-1.5 opacity-80 hover:opacity-100 transition-opacity"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold font-mono text-rose-300 line-through">
                              {item.candidateWord}
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30">
                              Skor: {item.totalScore}/100
                            </span>
                          </div>
                          <p className="text-[11px] text-rose-300/80 bg-rose-950/30 p-2 rounded border border-rose-900/40">
                            {item.rejectionReason || 'DITOLAK HCLSE: Makna bertentangan atau kaku dalam konteks.'}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Section D: Frekuensi Kata Aktual di Naskah Final */}
                <div className="space-y-3 pt-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-amber-400" />
                      <h3 className="text-sm font-bold text-amber-300 uppercase tracking-wider">
                        D. FREKUENSI KATA AKTUAL DI NASKAH FINAL ({blockNames[activeTab]})
                      </h3>
                    </div>

                    {/* Filter Search Box */}
                    <div className="relative w-full sm:w-64">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Cari kata dalam blok..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/60"
                      />
                    </div>
                  </div>

                  <p className="text-xs text-slate-400">
                    Menampilkan hitungan berulang kata-kata yang benar-benar terdapat dalam teks naskah final untuk {blockNames[activeTab]}.
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-56 overflow-y-auto p-1">
                    {sortedBlockFrequencies.length === 0 ? (
                      <p className="col-span-full text-xs text-slate-500 italic py-2">
                        Tidak ada kata yang sesuai dengan pencarian.
                      </p>
                    ) : (
                      sortedBlockFrequencies.map(([word, freq]) => {
                        const totalInOverall = overallWordFrequencies[word] || freq;
                        return (
                          <div
                            key={word}
                            className="bg-slate-900/90 border border-slate-800 rounded-lg p-2 flex items-center justify-between"
                          >
                            <span className="text-xs font-mono font-medium text-slate-200 truncate pr-1">
                              {word}
                            </span>
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 shrink-0">
                              {freq}x <span className="text-slate-400 font-normal">({totalInOverall}x total)</span>
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-800/80 bg-slate-900/60 text-xs text-slate-400">
            <div>
              Status Audit:{' '}
              <strong className="text-emerald-400 font-mono">
                {audit?.finalizationStatus || 'DRAFT_TAHAP_2'}
              </strong>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors cursor-pointer"
            >
              Tutup Modal
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
