/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GENFLOW MASTER FRAMEWORK FINAL — MODAL PREVIEW & KONFIRMASI
 * Menampilkan 23 komponen kanonis dalam 7 kelompok A–G, ringkasan eksekutif,
 * status kesiapan isi, jejak sumber, dan fitur koreksi manual sebelum Tahap 2.
 */

import React, { useState } from 'react';
import {
  GenflowMasterFrameworkData,
  MasterFrameworkComponent,
  MasterFrameworkGroupCode,
  MasterFrameworkComponentStatus,
} from '../lib/genflowMasterFramework';
import { exportCanonicalFrameworkText } from '../lib/genflowUniversalFrameworkPolicy';
import {
  CheckCircle2,
  AlertTriangle,
  Download,
  X,
  Layers,
  ShieldCheck,
  Search,
  BookOpen,
  AlertCircle,
  Save,
  Check,
  ArrowRight,
  FileText,
  ChevronRight,
  Info
} from 'lucide-react';

interface MasterFrameworkModalProps {
  isOpen: boolean;
  onClose: () => void;
  framework: GenflowMasterFrameworkData;
  onSaveCorrections: (updated: GenflowMasterFrameworkData) => void;
  onConfirmAndProceed: (confirmedFramework: GenflowMasterFrameworkData) => void;
  proceedLabel?: string;
}

export const MasterFrameworkModal: React.FC<MasterFrameworkModalProps> = ({
  isOpen,
  onClose,
  framework,
  onSaveCorrections,
  onConfirmAndProceed,
  proceedLabel = 'Gunakan Kerangka Ini',
}) => {
  const [activeTab, setActiveTab] = useState<'SUMMARY' | 'GROUPS' | 'AUDIT'>('SUMMARY');
  const [selectedGroup, setSelectedGroup] = useState<MasterFrameworkGroupCode>('B');
  const [editingCompId, setEditingCompId] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState<string>('');
  const [acknowledgedWarning, setAcknowledgedWarning] = useState<boolean>(false);
  const [localFramework, setLocalFramework] = useState<GenflowMasterFrameworkData>(framework);

  // Sinkronisasi state lokal saat prop framework diperbarui
  React.useEffect(() => {
    setLocalFramework(framework);
  }, [framework]);

  const handleExportCanonical = () => {
    try {
      const canonicalText = exportCanonicalFrameworkText(localFramework);
      const blob = new Blob([canonicalText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeTitle =
        localFramework.executiveSummary.topikUtama
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '')
          .slice(0, 40) || 'kerangka';
      a.href = url;
      a.download = `KERANGKA_${safeTitle}_GENFLOW.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  };

  if (!isOpen) return null;

  const exec = localFramework.executiveSummary;
  const isReady = exec.statusKesiapan === 'SIAP DIKEMBANGKAN';

  // Hitung jumlah komponen kanonis (1..23) yang benar-benar terisi dari dokumen
  const filledCount = Object.values(localFramework.componentsById).filter(
    (c) => c.id <= 23 && c.status === 'DITEMUKAN' && (c.content || '').trim().length > 0
  ).length;

  const isDocumentUploaded =
    localFramework.documentIdentity.fileName !== 'BELUM ADA DOKUMEN' &&
    localFramework.documentIdentity.wordCount > 0 &&
    filledCount > 0;

  const handleStartEdit = (comp: MasterFrameworkComponent) => {
    setEditingCompId(comp.id);
    setEditingContent(comp.content);
  };

  const handleSaveEdit = (compId: number) => {
    const prevComp = localFramework.componentsById[compId];
    if (!prevComp) return;

    const originalText = prevComp.manualCorrection
      ? prevComp.manualCorrection.originalContent
      : prevComp.content;

    const updatedComp: MasterFrameworkComponent = {
      ...prevComp,
      content: editingContent,
      status: 'DITEMUKAN',
      statusNotes: 'Diedit & dikonfirmasi manual oleh pengguna',
      summary: editingContent.slice(0, 100) + '...',
      manualCorrection: {
        editedAt: Date.now(),
        editedBy: 'Pengguna',
        originalContent: originalText,
        updatedContent: editingContent,
      },
    };

    const nextComponentsById = {
      ...localFramework.componentsById,
      [compId]: updatedComp,
    };

    // Update dalam kelompok A-G
    const groupKey = updatedComp.groupCode;
    const nextGroups = {
      ...localFramework.groups,
      [groupKey]: {
        ...localFramework.groups[groupKey],
        components: localFramework.groups[groupKey].components.map((c) =>
          c.id === compId ? updatedComp : c
        ),
      },
    } as GenflowMasterFrameworkData['groups'];

    const updatedFramework: GenflowMasterFrameworkData = {
      ...localFramework,
      componentsById: nextComponentsById,
      groups: nextGroups,
      revisions: [
        ...localFramework.revisions,
        {
          timestamp: Date.now(),
          componentId: compId,
          field: 'content',
          prevValue: prevComp.content,
          newValue: editingContent,
        },
      ],
    };

    setLocalFramework(updatedFramework);
    onSaveCorrections(updatedFramework);
    setEditingCompId(null);
  };

  const handleConfirm = () => {
    if (!isDocumentUploaded) return;
    const confirmed: GenflowMasterFrameworkData = {
      ...localFramework,
      isConfirmed: true,
      confirmedAt: Date.now(),
      confirmationNotes: isReady
        ? 'Dikonfirmasi dengan status SIAP DIKEMBANGKAN.'
        : `Dikonfirmasi dengan catatan: ${exec.statusKesiapan} (${exec.readinessReason})`,
    };
    onConfirmAndProceed(confirmed);
  };

  const getStatusBadge = (status: MasterFrameworkComponentStatus) => {
    switch (status) {
      case 'MENUNGGU_DOKUMEN':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700/50">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500"></span>
            Menunggu dokumen
          </span>
        );
      case 'SEDANG_DIPINDAI':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
            Sedang dipindai
          </span>
        );
      case 'DITEMUKAN':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Ditemukan
          </span>
        );
      case 'TIDAK_DITEMUKAN':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-zinc-800/80 text-zinc-400 border border-zinc-700/60">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500"></span>
            Tidak ditemukan
          </span>
        );
      case 'PERLU_KONFIRMASI':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            Perlu konfirmasi
          </span>
        );
      case 'GAGAL_DIPINDAI':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
            Gagal dipindai
          </span>
        );
      case 'BERTENTANGAN':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
            Bertentangan
          </span>
        );
      case 'BELUM_TERVERIFIKASI':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
            Belum terverifikasi
          </span>
        );
    }
  };

  const getReadinessBadge = () => {
    if (!isDocumentUploaded) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700/60 uppercase whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-500"></span>
          Menunggu Bahan
        </span>
      );
    }
    if (isReady) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Siap Produksi
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 uppercase whitespace-nowrap">
        <AlertTriangle className="w-3.5 h-3.5" />
        Perlu Koreksi
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative flex flex-col w-full max-w-5xl max-h-[92vh] bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden">
        {/* HEADER MODAL */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-7 rounded-full bg-amber-500"></div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-zinc-100 tracking-tight font-mono">
                KERANGKA PRODUKSI
              </h2>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Struktur pembahasan sebelum menulis naskah.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportCanonical}
              className="h-9 px-3.5 text-[11px] font-bold rounded-lg border border-zinc-700 hover:border-amber-500/40 bg-zinc-900/80 text-zinc-400 hover:text-amber-300 transition-all flex items-center justify-center gap-1.5 cursor-pointer uppercase"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Ekspor</span>
            </button>
            <div className="h-9 flex items-center">
              {getReadinessBadge()}
            </div>
            <button
              onClick={onClose}
              className="h-9 w-9 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* SUBHEADER TABS */}
        <div className="flex items-center justify-between px-6 py-2 border-b border-zinc-800 bg-zinc-900/40 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('SUMMARY')}
              className={`px-3 py-1.5 rounded font-medium transition-colors ${
                activeTab === 'SUMMARY'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
              }`}
            >
              Inti Naskah
            </button>
            <button
              onClick={() => setActiveTab('GROUPS')}
              className={`px-3 py-1.5 rounded font-medium transition-colors ${
                activeTab === 'GROUPS'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
              }`}
            >
              Struktur Detail (A–G)
            </button>
            <button
              onClick={() => setActiveTab('AUDIT')}
              className={`px-3 py-1.5 rounded font-medium transition-colors ${
                activeTab === 'AUDIT'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
              }`}
            >
              Cek Kelayakan
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-3 text-zinc-400 text-[11px] font-mono">
            <span>File: <strong className={isDocumentUploaded ? 'text-zinc-200' : 'text-amber-400'}>{localFramework.documentIdentity.fileName}</strong></span>
            <span>•</span>
            <span>{localFramework.documentIdentity.wordCount} kata</span>
            <span>•</span>
            <span>Terisi: <strong className={filledCount > 0 ? 'text-emerald-400' : 'text-zinc-400'}>{filledCount}/23</strong></span>
          </div>
        </div>

        {/* NOTIFIKASI JIKA BELUM ADA DOKUMEN ATAU BELUM SIAP */}
        {!isDocumentUploaded ? (
          <div className="px-6 py-2.5 bg-zinc-900/90 border-b border-zinc-800 text-zinc-300 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span>
                <strong>Belum Ada Bahan:</strong> Unggah file dokumen untuk mengisi kerangka otomatis.
              </span>
            </div>
          </div>
        ) : !isReady ? (
          <div className="px-6 py-2.5 bg-amber-950/40 border-b border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>
                <strong>Audit:</strong> {exec.readinessReason} Koreksi manual poin di bawah jika diperlukan.
              </span>
            </div>
            <label className="flex items-center gap-1.5 text-[11px] text-amber-300/90 whitespace-nowrap cursor-pointer">
              <input
                type="checkbox"
                checked={acknowledgedWarning}
                onChange={(e) => setAcknowledgedWarning(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-0"
              />
              <span>Setujui & Lanjutkan dengan Catatan</span>
            </label>
          </div>
        ) : null}

        {/* ISI MODAL BODY BERDASARKAN TAB */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'SUMMARY' && (
            <div className="space-y-4">
              {/* GRID TOP 3 PENGUNCI UTAMA */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* TOPIK UTAMA & SUMBER */}
                <div className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-bold">
                      #1 Topik Utama
                    </span>
                    {getStatusBadge(localFramework.componentsById[1].status)}
                  </div>
                  <h3 className="text-sm font-semibold text-zinc-100 mb-1">
                    {exec.topikUtama || (
                      <span className="text-zinc-500 italic">
                        {isDocumentUploaded ? 'Tidak ditemukan dalam dokumen' : 'Menunggu dokumen kerangka...'}
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-2 border-t border-zinc-800/80 pt-2">
                    <strong className="text-zinc-300">Rujukan Sumber (#2):</strong>{' '}
                    {localFramework.componentsById[2].content || (
                      <span className="text-zinc-500 italic">
                        {isDocumentUploaded ? 'Tidak ditemukan dalam dokumen' : 'Menunggu dokumen...'}
                      </span>
                    )}
                  </p>
                </div>

                {/* KUNCI FOKUS BESAR */}
                <div className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 font-bold">
                      #3 Fokus Besar
                    </span>
                    {getStatusBadge(localFramework.componentsById[3].status)}
                  </div>
                  <p className="text-xs text-zinc-200 leading-relaxed">
                    {exec.fokusBesar || (
                      <span className="text-zinc-500 italic">
                        {isDocumentUploaded ? 'Tidak ditemukan dalam dokumen' : 'Menunggu dokumen kerangka...'}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* BATAS PEMBAHASAN (SCOPE BOUNDARY) - 3 KOLOM */}
              <div className="p-4 rounded-lg bg-zinc-900/70 border border-zinc-800">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-bold">
                    #4 Batas Pembahasan
                  </span>
                  {getStatusBadge(localFramework.componentsById[4].status)}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  {/* WAJIB DIBAHAS */}
                  <div className="p-3 rounded bg-zinc-950/60 border border-emerald-500/20">
                    <div className="font-semibold text-emerald-300 mb-1.5 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      Wajib Dibahas
                    </div>
                    {exec.batasPembahasan.wajibDibahas.length > 0 ? (
                      <ul className="space-y-1 text-zinc-300 text-[11px]">
                        {exec.batasPembahasan.wajibDibahas.map((w, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <span className="text-emerald-400">•</span>
                            <span>{w}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-zinc-500 italic text-[11px]">
                        {isDocumentUploaded ? 'Tidak ada poin wajib yang didefinisikan.' : 'Menunggu dokumen...'}
                      </p>
                    )}
                  </div>

                  {/* BOLEH DISINGGUNG */}
                  <div className="p-3 rounded bg-zinc-950/60 border border-blue-500/20">
                    <div className="font-semibold text-blue-300 mb-1.5 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                      Boleh Disinggung (Sekunder)
                    </div>
                    {exec.batasPembahasan.bolehDisinggung.length > 0 ? (
                      <ul className="space-y-1 text-zinc-300 text-[11px]">
                        {exec.batasPembahasan.bolehDisinggung.map((b, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <span className="text-blue-400">•</span>
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-zinc-500 italic text-[11px]">
                        {isDocumentUploaded ? 'Tidak ada batasan sekunder.' : 'Menunggu dokumen...'}
                      </p>
                    )}
                  </div>

                  {/* TIDAK BOLEH DIMASUKKAN */}
                  <div className="p-3 rounded bg-zinc-950/60 border border-rose-500/20">
                    <div className="font-semibold text-rose-300 mb-1.5 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                      Tidak Boleh Dimasukkan (Terlarang)
                    </div>
                    {exec.batasPembahasan.tidakBolehDimasukkan.length > 0 ? (
                      <ul className="space-y-1 text-zinc-300 text-[11px]">
                        {exec.batasPembahasan.tidakBolehDimasukkan.map((t, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <span className="text-rose-400">✕</span>
                            <span>{t}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-zinc-500 italic text-[11px]">
                        {isDocumentUploaded ? 'Tidak ada batasan terlarang.' : 'Menunggu dokumen...'}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* PERTANYAAN INTI & TESIS UTAMA & LOGIC PUNCH */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* PERTANYAAN INTI */}
                <div className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-bold">
                      #5 Core Question
                    </span>
                    {getStatusBadge(localFramework.componentsById[5].status)}
                  </div>
                  <p className="text-xs text-zinc-200 italic leading-relaxed">
                    {exec.pertanyaanInti ? (
                      `"${exec.pertanyaanInti}"`
                    ) : (
                      <span className="text-zinc-500 not-italic">
                        {isDocumentUploaded ? 'Tidak ditemukan dalam dokumen' : 'Menunggu dokumen...'}
                      </span>
                    )}
                  </p>
                </div>

                {/* TESIS UTAMA */}
                <div className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-purple-400 font-bold">
                      #7 Central Thesis
                    </span>
                    {getStatusBadge(localFramework.componentsById[7].status)}
                  </div>
                  <p className="text-xs text-zinc-200 leading-relaxed">
                    {exec.tesisUtama || (
                      <span className="text-zinc-500 italic">
                        {isDocumentUploaded ? 'Tidak ditemukan dalam dokumen' : 'Menunggu dokumen...'}
                      </span>
                    )}
                  </p>
                </div>

                {/* LOGIC PUNCH */}
                <div className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-amber-500 font-bold">
                      #8 Logic Punch
                    </span>
                    {getStatusBadge(localFramework.componentsById[8].status)}
                  </div>
                  <p className="text-xs font-semibold text-amber-300 leading-relaxed">
                    {exec.logicPunch ? (
                      `"${exec.logicPunch}"`
                    ) : (
                      <span className="text-zinc-500 font-normal italic">
                        {isDocumentUploaded ? 'Tidak ditemukan dalam dokumen' : 'Menunggu dokumen...'}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* NARRATIVE BLUEPRINT PREVIEW */}
              <div className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 font-bold">
                    #15 Alur Pembahasan
                  </span>
                  {getStatusBadge(localFramework.componentsById[15].status)}
                </div>
                <div className="whitespace-pre-wrap font-mono text-[11px] text-zinc-300 bg-zinc-950/80 p-3 rounded border border-zinc-850">
                  {localFramework.componentsById[15].content || (
                    <span className="text-zinc-500 italic">
                      {isDocumentUploaded ? 'Tidak ditemukan dalam dokumen' : 'Menunggu dokumen...'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'GROUPS' && (
            <div className="space-y-4">
              {/* SELECTOR KELOMPOK A - G */}
              <div className="flex flex-wrap gap-2 pb-2 border-b border-zinc-800">
                {(['A', 'B', 'C', 'D', 'E', 'F', 'G'] as MasterFrameworkGroupCode[]).map((grpKey) => {
                  const grp = localFramework.groups[grpKey];
                  const isSelected = selectedGroup === grpKey;
                  return (
                    <button
                      key={grpKey}
                      onClick={() => setSelectedGroup(grpKey)}
                      className={`px-3 py-1.5 rounded text-xs font-medium font-mono transition-colors flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-amber-500 text-zinc-950 font-bold shadow'
                          : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-850 border border-zinc-800'
                      }`}
                    >
                      <span>{grpKey}.</span>
                      <span>{grp.title}</span>
                      <span className={`px-1 py-0.2 rounded text-[10px] ${isSelected ? 'bg-zinc-950/30 text-zinc-900' : 'bg-zinc-800 text-zinc-400'}`}>
                        {grp.components.length}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* DAFTAR KOMPONEN DALAM KELOMPOK TERPILIH */}
              <div className="space-y-3">
                {localFramework.groups[selectedGroup].components.map((comp) => {
                  const isEditing = editingCompId === comp.id;
                  return (
                    <div
                      key={comp.id}
                      className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-amber-400">
                              #{comp.id}
                            </span>
                            <h4 className="text-sm font-semibold text-zinc-100">
                              {comp.canonicalTitle}
                            </h4>
                            {getStatusBadge(comp.status)}
                          </div>
                          <p className="text-xs text-zinc-400 mt-0.5">
                            {comp.subtitle}
                          </p>
                        </div>

                        {!isEditing && (
                          <button
                            onClick={() => handleStartEdit(comp)}
                            className="px-2.5 py-1 text-xs rounded font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-750 hover:text-white border border-zinc-700/60 transition-colors flex items-center gap-1"
                          >
                            <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                            Koreksi Manual
                          </button>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="mt-3 space-y-2">
                          <textarea
                            rows={5}
                            value={editingContent}
                            onChange={(e) => setEditingContent(e.target.value)}
                            className="w-full p-3 rounded-lg bg-zinc-950 border border-amber-500/40 text-xs font-mono text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                            placeholder="Koreksi atau lengkapi isi komponen..."
                          />
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setEditingCompId(null)}
                              className="px-3 py-1 rounded text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                            >
                              Batal
                            </button>
                            <button
                              onClick={() => handleSaveEdit(comp.id)}
                              className="px-3 py-1 rounded text-xs font-semibold text-zinc-950 bg-amber-400 hover:bg-amber-300"
                            >
                              Simpan Koreksi
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2">
                          <div className="p-3 rounded bg-zinc-950/70 border border-zinc-850/80 font-mono text-xs text-zinc-200 whitespace-pre-wrap leading-relaxed">
                            {comp.content || (
                              <span className="text-zinc-500 italic">Informasi tidak ditemukan dalam dokumen sumber.</span>
                            )}
                          </div>

                          {comp.sourceOrigin && (
                            <div className="mt-1.5 flex items-center gap-2 text-[10px] text-zinc-400">
                              <span className="font-mono text-zinc-400">Jejak Sumber:</span>
                              <span className="text-zinc-300">
                                {comp.sourceOrigin.documentName || 'Dokumen'} • {comp.sourceOrigin.sectionTitle || 'Teks Sumber'}
                              </span>
                              {comp.sourceOrigin.lineNumber && (
                                <span className="text-zinc-400 font-mono">(Baris ~{comp.sourceOrigin.lineNumber})</span>
                              )}
                              {comp.manualCorrection && (
                                <span className="ml-auto text-amber-400/90 font-mono">
                                  ✓ Telah dikoreksi manual
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'AUDIT' && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800">
                <h3 className="text-sm font-semibold text-zinc-100 mb-1">
                  Hasil Audit Kelayakan Kerangka Sebelum Penulisan Narasi (Komponen 19–23)
                </h3>
                <p className="text-xs text-zinc-400 mb-4">
                  Sistem mengevaluasi konsistensi, kelengkapan argumentasi, batas pembahasan, dan kelayakan alur sebelum Tahap 2 dimulai.
                </p>

                <div className="space-y-3">
                  {[19, 20, 21, 22, 23].map((auditId) => {
                    const comp = localFramework.componentsById[auditId];
                    if (!comp) return null;
                    return (
                      <div key={auditId} className="p-3 rounded bg-zinc-950/70 border border-zinc-800 flex items-start gap-3">
                        <div className="w-6 h-6 rounded flex items-center justify-center bg-zinc-800 text-amber-400 text-xs font-mono font-bold mt-0.5">
                          {auditId}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-zinc-200">
                              {comp.canonicalTitle}
                            </h4>
                            {getStatusBadge(comp.status)}
                          </div>
                          <p className="text-xs text-zinc-300 mt-1 whitespace-pre-wrap font-mono">
                            {comp.content}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-zinc-900/80">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span>Revisi Manual: <strong className="text-zinc-200">{localFramework.revisions.length}</strong></span>
            <span>•</span>
            <span>Unresolved: <strong className={exec.unresolvedCount > 0 ? 'text-amber-400' : 'text-emerald-400'}>{exec.unresolvedCount}</strong></span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="h-10 px-4 rounded-lg text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors flex items-center justify-center cursor-pointer"
            >
              Batal
            </button>

            <button
              onClick={handleConfirm}
              disabled={!isDocumentUploaded || (!isReady && !acknowledgedWarning)}
              title={
                !isDocumentUploaded
                  ? 'Unggah dokumen kerangka naskah terlebih dahulu'
                  : !isReady && !acknowledgedWarning
                  ? 'Beri tanda centang persetujuan catatan audit untuk melanjutkan'
                  : 'Konfirmasi kerangka dan lanjutkan ke Tahap 2'
              }
              className={`h-10 px-5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                isDocumentUploaded && (isReady || acknowledgedWarning)
                  ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-lg shadow-amber-500/20 active:scale-98 cursor-pointer'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/50'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              <span>{proceedLabel}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
