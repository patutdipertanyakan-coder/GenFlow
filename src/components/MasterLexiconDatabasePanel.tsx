import React, { useEffect, useMemo, useState } from 'react';
import { MasterLexiconStats } from '../lib/masterLexiconTypes';
import {
  ExpansionCategoryKey,
  EXPANSION_CATEGORY_LABELS,
  ExpansionDuplicateRecord,
  ExpansionLexiconEntry,
} from '../lib/expansionLexiconBank';
import {
  getCanonicalDedupKey,
  normalizeDisplayExpansionEntry,
} from '../lib/expansionLexiconBank';
import { supabase } from '../lib/supabaseClient';
import { masterLexiconRepository } from '../lib/masterLexiconRepository';
import {
  Database,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ShieldCheck,
  X,
  Info,
  Layers,
  ArrowRight,
  Upload,
  Trash2,
} from 'lucide-react';
import { UniversalCsvImportModal } from './UniversalCsvImportModal';

interface MasterLexiconDatabasePanelProps {
  onCandidateSelected?: (word: string) => void;
  cleanScript?: string;
}

export type DetailModalType =
  | 'TOTAL_SOURCE'
  | 'UNIQUE_ACTIVE'
  | 'DUPLICATES_CLEANED'
  | 'F1_CORE'
  | 'FORMAL_EQUIVALENTS'
  | 'NEEDS_REVIEW'
  | null;

// Entri akan dimuat secara dinamis dari API Master Lexicon
const INITIAL_ACTIVE_ENTRIES: ExpansionLexiconEntry[] = [];
const INITIAL_DUPLICATES: ExpansionDuplicateRecord[] = [];

const DEFAULT_INITIAL_STATS: MasterLexiconStats = {
  total_source_entries: 0,
  unique_active_lexicon_count: 0,
  total_base_entries: 0,
  total_additional_entries: 0,
  total_duplicates: 0,
  f1_core_count: 0,
  f1_core_expected: 0,
  f1_is_complete: true,
  total_needs_review: 0,
  total_verified_natural: 0,
  total_formal_equivalents: 0,
  total_datasets: 0,
  category_distribution: { F1: 0, F2: 0, F3: 0, F4: 0, F5: 0, F6: 0 },
  deduplication_breakdown: { profanity_rejected: 0 },
  stored_datasets: [],
  last_updated_at: new Date().toISOString(),
};

const STANDARD_F_CATEGORIES = [
  { code: 'F1', label: 'F1 — Inti Wajib' },
  { code: 'F2', label: 'F2 — Akhiran -in' },
  { code: 'F3', label: 'F3 — Awalan ng-/nge-/ny-/n-' },
  { code: 'F4', label: 'F4 — Penanda Percakapan' },
  { code: 'F5', label: 'F5 — Verba Pengganti Formal' },
  { code: 'F6', label: 'F6 — Ragam Kajian Bahasa' },
];

/**
 * Helper fetch terautentikasi untuk integrasi Supabase (Requirement B.1 & B.2).
 */
const authFetch = async (url: string, options: RequestInit = {}) => {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const headers = {
    ...options.headers,
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
  return fetch(url, { ...options, headers });
};

export const MasterLexiconDatabasePanel: React.FC<MasterLexiconDatabasePanelProps> = () => {
  const activeEntries = masterLexiconRepository.getUnifiedEntries();
  const [stats, setStats] = useState<MasterLexiconStats>(DEFAULT_INITIAL_STATS);
  const [backendEntries, setBackendEntries] = useState<ExpansionLexiconEntry[]>(INITIAL_ACTIVE_ENTRIES);
  const [backendDuplicates, setBackendDuplicates] = useState<ExpansionDuplicateRecord[]>(INITIAL_DUPLICATES);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUniversalCsvModalOpen, setIsUniversalCsvModalOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<{ id: string; word: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastNotification, setToastNotification] = useState<{
    text: string;
    isError?: boolean;
  } | null>(null);

  // Modal State for Interactive Stat Cards
  const [activeModal, setActiveModal] = useState<DetailModalType>(null);
  const [modalSearchQuery, setModalSearchQuery] = useState('');

  // Filters
  const [activeTabMode, setActiveTabMode] = useState<
    'ALL_ACTIVE' | 'HAS_FORMAL' | 'VERIFIED_NATURAL' | 'NEEDS_REVIEW' | 'DUPLICATES_LOG'
  >('ALL_ACTIVE');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch live stats, registry, and duplicates from backend
  const refreshAllData = async () => {
    setIsRefreshing(true);
    try {
      const [resStats, resReg, resDup] = await Promise.all([
        authFetch('/api/lexicon/master-stats'),
        authFetch('/api/lexicon/master-registry'),
        authFetch('/api/lexicon/duplicates'),
      ]);

      if (resStats.ok) {
        const statsData = await resStats.json();
        setStats(statsData);
      }
      if (resReg.ok) {
        const regData = await resReg.json();
        if (Array.isArray(regData.entries)) {
          setBackendEntries(regData.entries);
        }
      }
      if (resDup.ok) {
        const dupData = await resDup.json();
        if (Array.isArray(dupData.duplicates)) {
          setBackendDuplicates(dupData.duplicates);
        }
      }
    } catch (err) {
      console.warn('Gagal menghubungi backend lexicon API:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const executeDeleteEntry = async () => {
    if (!entryToDelete) return;
    setIsDeleting(true);
    try {
      const res = await authFetch('/api/lexicon/delete', {
        method: 'DELETE',
        body: JSON.stringify({ id: entryToDelete.id, word: entryToDelete.word }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setToastNotification({
          text: `Kosakata "${entryToDelete.word}" berhasil dihapus dari Master Lexicon dan dicatat dalam daftar hitam tombstones (AI tidak akan pernah menggunakannya lagi).`,
          isError: false,
        });
        setEntryToDelete(null);
        refreshAllData();
      } else {
        setToastNotification({
          text: `Gagal menghapus: ${data.error || data.message || 'Terjadi kesalahan server.'}`,
          isError: true,
        });
      }
    } catch (err: any) {
      setToastNotification({
        text: `Gagal menghapus entri kosakata: ${err.message || 'Koneksi gagal.'}`,
        isError: true,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    refreshAllData();
  }, []);

  const allActiveEntries = useMemo(() => {
    return backendEntries.length > 0 ? backendEntries : INITIAL_ACTIVE_ENTRIES;
  }, [backendEntries]);

  const allDuplicates = useMemo(() => {
    return backendDuplicates.length > 0 ? backendDuplicates : INITIAL_DUPLICATES;
  }, [backendDuplicates]);

  // Unified Filtered entries across all repository fields
  const filteredEntries = useMemo(() => {
    let list = allActiveEntries;

    if (activeTabMode === 'HAS_FORMAL') {
      list = list.filter((e) => Boolean(e.formalEquivalent));
    } else if (activeTabMode === 'VERIFIED_NATURAL') {
      list = list.filter((e) => e.naturalnessStatus === 'VERIFIED_NATURAL');
    } else if (activeTabMode === 'NEEDS_REVIEW') {
      list = list.filter((e) => e.naturalnessStatus === 'NEEDS_CONTEXT_REVIEW');
    }

    if (selectedCategory !== 'ALL') {
      list = list.filter(
        (e) =>
          e.categoryLabel.startsWith(`${selectedCategory} `) ||
          e.category === selectedCategory
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (e) =>
          e.word.toLowerCase().includes(q) ||
          (e.formalEquivalent && e.formalEquivalent.toLowerCase().includes(q)) ||
          e.contextNote.toLowerCase().includes(q) ||
          e.categoryLabel.toLowerCase().includes(q) ||
          e.id.toLowerCase().includes(q) ||
          (e.reviewReason && e.reviewReason.toLowerCase().includes(q))
      );
    }

    return list;
  }, [allActiveEntries, activeTabMode, selectedCategory, searchQuery]);

  // Filtered duplicates
  const filteredDuplicates = useMemo(() => {
    if (!searchQuery.trim()) return allDuplicates;
    const q = searchQuery.trim().toLowerCase();
    return allDuplicates.filter(
      (d) =>
        d.rawInput.toLowerCase().includes(q) ||
        d.matchedExisting.toLowerCase().includes(q) ||
        d.explanation.toLowerCase().includes(q) ||
        d.reasonType.toLowerCase().includes(q) ||
        d.canonicalKey.toLowerCase().includes(q)
    );
  }, [allDuplicates, searchQuery]);

  const f1ActualCount = stats.f1_core_count ?? 0;
  const f1ExpectedCount = stats.f1_core_expected ?? 0;

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* MASTER LEXICON REPOSITORY — SATU SUMBER DATA TUNGGAL BACKEND               */}
      {/* ========================================================================= */}
      <div
        data-testid="master-lexicon-database-panel"
        className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3.5 shadow-xl"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/30 rounded-lg text-indigo-400">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-sm sm:text-base font-bold text-slate-100 tracking-wide">
                  Master Lexicon Repository ({allActiveEntries.length} Entri)
                </h2>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>ouuoukdhzeenbkxhfnik • Live</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mt-0.5">
                Database kosakata lisan F1–F8, padanan baku, dan aturan konteks F7 terpusat.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsUniversalCsvModalOpen(true)}
              data-tooltip="Impor data kosakata baru dari file CSV 7 kolom."
              className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg shadow border border-indigo-400 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Impor CSV</span>
            </button>

            <button
              type="button"
              data-testid="refresh-stats-btn"
              onClick={refreshAllData}
              disabled={isRefreshing}
              data-tooltip="Muat ulang data kosakata dari server."
              className="px-3 py-1.5 text-xs bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-slate-300 rounded-lg border border-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Muat Ulang</span>
            </button>
          </div>
        </div>

        {/* Notifikasi Tindakan */}
        {toastNotification && (
          <div
            className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-2 ${
              toastNotification.isError
                ? 'bg-rose-950/40 border-rose-500/50 text-rose-200'
                : 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {toastNotification.isError ? (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              <span>{toastNotification.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setToastNotification(null)}
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TABEL BROWSER MASTER LEXICON REPOSITORY DENGAN TOMBOL HAPUS ENTRI          */}
      {/* ========================================================================= */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
          <div className="flex flex-wrap gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setActiveTabMode('ALL_ACTIVE')}
              data-tooltip="Tampilkan seluruh kosakata aktif."
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                activeTabMode === 'ALL_ACTIVE'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              Semua ({allActiveEntries.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTabMode('HAS_FORMAL')}
              data-tooltip="Kosakata yang memiliki padanan kata baku."
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                activeTabMode === 'HAS_FORMAL'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              Padanan Baku ({stats.total_formal_equivalents})
            </button>
            <button
              type="button"
              onClick={() => setActiveTabMode('VERIFIED_NATURAL')}
              data-tooltip="Kosakata yang terverifikasi wajar untuk percakapan."
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                activeTabMode === 'VERIFIED_NATURAL'
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              Wajar ({stats.total_verified_natural})
            </button>
            <button
              type="button"
              onClick={() => setActiveTabMode('NEEDS_REVIEW')}
              data-tooltip="Kosakata yang memerlukan tinjauan konteks kalimat."
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                activeTabMode === 'NEEDS_REVIEW'
                  ? 'bg-amber-600 text-slate-950 font-semibold'
                  : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              Perlu Tinjau ({stats.total_needs_review})
            </button>
            <button
              type="button"
              onClick={() => setActiveTabMode('DUPLICATES_LOG')}
              data-tooltip="Daftar duplikasi kosakata yang telah disaring."
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                activeTabMode === 'DUPLICATES_LOG'
                  ? 'bg-rose-600 text-white font-semibold'
                  : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              Duplikat ({stats.total_duplicates})
            </button>
          </div>

          {/* UNIFIED SEARCH BAR */}
          <div className="relative min-w-[220px] flex-1 max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kata, padanan, atau catatan..."
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Filter Kategori Referensi F1–F6 */}
        {activeTabMode !== 'DUPLICATES_LOG' && (
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-slate-400 mr-1 text-[11px]">Kategori Referensi:</span>
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                className={`px-2.5 py-1 rounded text-[11px] font-mono ${
                  selectedCategory === 'ALL'
                    ? 'bg-indigo-500 text-white font-semibold'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                Semua ({allActiveEntries.length})
              </button>
              {STANDARD_F_CATEGORIES.map((cat) => (
                <button
                  key={cat.code}
                  type="button"
                  onClick={() => setSelectedCategory(cat.code)}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono ${
                    selectedCategory === cat.code
                      ? 'bg-indigo-500 text-white font-semibold'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {cat.label} ({stats.category_distribution[cat.code] || 0})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tampilan Konten: Log Duplikasi Dibersihkan */}
        {activeTabMode === 'DUPLICATES_LOG' ? (
          <div className="space-y-3">
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>
                Total {filteredDuplicates.length} duplikasi literal terdeteksi dan dibersihkan secara deterministik:
              </span>
              <span className="text-slate-500 font-mono text-[11px]">
                Varian bermakna berbeda tetap dipertahankan utuh
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[460px] overflow-y-auto pr-1">
              {filteredDuplicates.map((dup, i) => (
                <div
                  key={`${dup.canonicalKey}-${i}`}
                  className="bg-slate-900/90 border border-rose-500/30 rounded-lg p-3 space-y-1.5 text-xs font-mono"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-rose-300">{dup.rawInput}</span>
                    <span className="text-[9px] px-1.5 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded font-sans">
                      {dup.reasonType}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-sans">
                    Disatukan ke: <strong className="text-slate-200">{dup.matchedExisting}</strong>
                  </div>
                  <div className="text-[10px] text-slate-500 font-sans border-t border-slate-800 pt-1">
                    {dup.explanation}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Tampilan Konten: Entri Kosakata Aktif DENGAN TOMBOL HAPUS ENTRI */
          <div className="space-y-3">
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>
                Menampilkan {filteredEntries.length} kosakata unik dalam Master Lexicon Repository:
              </span>
              <span className="text-slate-500 font-mono text-[11px]">
                {filteredEntries.filter((e) => e.formalEquivalent).length} memuat padanan formal
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[500px] overflow-y-auto pr-1">
              {filteredEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg p-3 space-y-1.5 text-xs font-mono transition-colors relative group"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-sm font-bold text-slate-100">{entry.word}</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-sans font-semibold border ${
                        entry.naturalnessStatus === 'VERIFIED_NATURAL'
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                          : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                      }`}
                    >
                      {entry.naturalnessStatus === 'VERIFIED_NATURAL' ? 'Wajar' : 'Perlu Tinjau'}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-300 font-sans">
                    Formal : <span className="text-cyan-300 font-medium">{entry.formalEquivalent || '-'}</span>
                  </div>

                  <div className="text-[11px] text-slate-400 font-sans leading-snug">
                    <span className="text-slate-500 font-medium">Catatan :</span>{' '}
                    <span className="text-slate-300">{entry.contextNote || 'Kosakata lisan informal aktif.'}</span>
                  </div>

                  {/* BOTTOM ACTION BAR WITH DELETE BUTTON */}
                  <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-800 pt-1.5 font-sans">
                    <span className="truncate max-w-[170px]">{entry.categoryLabel}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="px-1 py-0.5 bg-slate-950 rounded text-slate-400 font-mono text-[9px]">
                        {entry.id}
                      </span>
                      <button
                        type="button"
                        data-testid={`delete-entry-btn-${entry.id}`}
                        onClick={() => setEntryToDelete({ id: entry.id, word: entry.word })}
                        className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded border border-transparent hover:border-rose-500/30 transition-colors cursor-pointer"
                        title={`Hapus kata "${entry.word}" secara permanen dari sistem`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {entry.reviewReason && (
                    <div className="text-[10px] text-amber-400/90 font-sans bg-amber-950/30 p-1.5 rounded border border-amber-500/20">
                      <span className="font-semibold text-amber-300">Contextual Guard:</span> {entry.reviewReason}
                      {entry.recommendedAlternative && (
                        <div className="text-emerald-300 text-[10px] mt-0.5">
                          Saran: <code>{entry.recommendedAlternative}</code>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* INTERACTIVE DETAIL MODAL FOR THE 6 STAT CARDS                              */}
      {/* ========================================================================= */}
      {activeModal !== null && (
        <div
          data-testid="stat-detail-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <div className="bg-[#0F172A] border border-slate-700 rounded-xl p-5 sm:p-6 max-w-4xl w-full max-h-[85vh] flex flex-col space-y-4 shadow-2xl relative text-slate-100">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 pr-8">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded uppercase tracking-wider">
                    Detail Ringkasan Leksikon
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    Master Lexicon Repository
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2 mt-1">
                  {activeModal === 'TOTAL_SOURCE' && '1. Detail Total Entri Sumber (Mentah)'}
                  {activeModal === 'UNIQUE_ACTIVE' && '2. Detail Total Kosakata Unik (Aktif)'}
                  {activeModal === 'DUPLICATES_CLEANED' && '3. Detail Log Duplikasi Dibersihkan'}
                  {activeModal === 'F1_CORE' && '4. Detail Entri Inti F1 Wajib (16/16 Slot)'}
                  {activeModal === 'FORMAL_EQUIVALENTS' && '5. Detail Daftar Padanan Formal'}
                  {activeModal === 'NEEDS_REVIEW' && '6. Detail Entri Perlu Tinjau Kewajaran (~81 Entri)'}
                </h3>
              </div>

              <button
                type="button"
                data-testid="modal-close-btn"
                onClick={() => {
                  setActiveModal(null);
                  setModalSearchQuery('');
                }}
                className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                title="Tutup Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Internal Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={modalSearchQuery}
                onChange={(e) => setModalSearchQuery(e.target.value)}
                placeholder="Cari di dalam modal detail ini..."
                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            {/* Modal Body Container */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-3 font-mono text-xs">
              {/* MODAL 1: TOTAL SOURCE ENTRIES */}
              {activeModal === 'TOTAL_SOURCE' && (() => {
                const q = modalSearchQuery.trim().toLowerCase();
                const list = allActiveEntries.filter(
                  (e) =>
                    !q ||
                    e.word.toLowerCase().includes(q) ||
                    e.categoryLabel.toLowerCase().includes(q) ||
                    (e.formalEquivalent && e.formalEquivalent.toLowerCase().includes(q)) ||
                    e.contextNote.toLowerCase().includes(q)
                );
                return (
                  <div className="space-y-3">
                    <div className="bg-slate-900/80 p-3 rounded-lg border border-indigo-500/30 text-slate-300 font-sans text-xs flex items-center justify-between">
                      <span>Total {stats.total_source_entries} entri sumber mentah sebelum dikonsolidasikan dan dibersihkan dari duplikasi.</span>
                      <span className="font-mono text-indigo-300 font-bold">{list.length} ditampilkan</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto pr-1">
                      {list.map((item, i) => (
                        <div key={`src-${item.id}-${i}`} className="p-3 bg-slate-900 border border-slate-800 rounded-lg space-y-1">
                          <div className="flex items-center justify-between text-xs font-bold text-slate-100">
                            <span>{item.word}</span>
                            <span className="text-[10px] px-1.5 py-0.5 bg-indigo-950 text-indigo-300 border border-indigo-500/30 rounded font-sans">
                              {item.categoryLabel}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-sans">
                            Padanan Formal: <strong className="text-cyan-300">{item.formalEquivalent || '-'}</strong>
                          </div>
                          <div className="text-[10px] text-slate-500 font-sans">
                            Sumber Data: <span className="text-slate-300">Master Lexicon Repository</span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-sans truncate">
                            Catatan: {item.contextNote}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* MODAL 2: UNIQUE ACTIVE LEXICON */}
              {activeModal === 'UNIQUE_ACTIVE' && (() => {
                const q = modalSearchQuery.trim().toLowerCase();
                const list = allActiveEntries.filter(
                  (e) =>
                    !q ||
                    e.word.toLowerCase().includes(q) ||
                    e.categoryLabel.toLowerCase().includes(q) ||
                    (e.formalEquivalent && e.formalEquivalent.toLowerCase().includes(q)) ||
                    e.contextNote.toLowerCase().includes(q)
                );
                return (
                  <div className="space-y-3">
                    <div className="bg-emerald-950/30 p-3 rounded-lg border border-emerald-500/30 text-emerald-200 font-sans text-xs flex items-center justify-between">
                      <span>{stats.unique_active_lexicon_count} kosakata unik aktif tersimpan permanen dalam Master Lexicon Repository.</span>
                      <span className="font-mono text-emerald-400 font-bold">{list.length} ditampilkan</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[50vh] overflow-y-auto pr-1">
                      {list.map((item) => (
                        <div key={`uniq-${item.id}`} className="p-3 bg-slate-900 border border-slate-800 rounded-lg space-y-1">
                          <div className="flex items-center justify-between text-xs font-bold text-slate-100">
                            <span>{item.word}</span>
                            <span className="text-[9px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 rounded font-sans">
                              {item.naturalnessStatus === 'VERIFIED_NATURAL' ? 'Wajar' : 'Tinjau'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-sans">
                            Formal: <span className="text-cyan-300">{item.formalEquivalent || '-'}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-sans truncate">
                            Kategori: {item.categoryLabel}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* MODAL 3: DUPLICATES CLEANED LOG */}
              {activeModal === 'DUPLICATES_CLEANED' && (() => {
                const q = modalSearchQuery.trim().toLowerCase();
                const list = allDuplicates.filter(
                  (d) =>
                    !q ||
                    d.rawInput.toLowerCase().includes(q) ||
                    d.matchedExisting.toLowerCase().includes(q) ||
                    d.explanation.toLowerCase().includes(q) ||
                    d.reasonType.toLowerCase().includes(q)
                );
                return (
                  <div className="space-y-3">
                    <div className="bg-rose-950/30 p-3 rounded-lg border border-rose-500/30 text-rose-200 font-sans text-xs flex items-center justify-between">
                      <span>Total {stats.total_duplicates} duplikasi literal, variasi kapital, dan penulisan dibersihkan secara deterministik.</span>
                      <span className="font-mono text-rose-300 font-bold">{list.length} ditampilkan</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto pr-1">
                      {list.map((dup, idx) => (
                        <div key={`dup-${dup.canonicalKey}-${idx}`} className="p-3 bg-slate-900 border border-rose-500/30 rounded-lg space-y-1">
                          <div className="flex items-center justify-between text-xs font-bold text-rose-300">
                            <span>{dup.rawInput}</span>
                            <span className="text-[9px] px-1.5 py-0.5 bg-rose-500/20 text-rose-200 rounded font-sans">
                              {dup.reasonType}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-300 font-sans">
                            Disatukan ke: <strong className="text-emerald-300">{dup.matchedExisting}</strong>
                          </div>
                          <div className="text-[10px] text-slate-400 font-sans">
                            Kunci Kanonik: <code>{dup.canonicalKey}</code>
                          </div>
                          <div className="text-[10px] text-slate-500 font-sans border-t border-slate-800 pt-1">
                            Alasan: {dup.explanation}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* MODAL 4: F1 CORE AVAILABLE */}
              {activeModal === 'F1_CORE' && (() => {
                const q = modalSearchQuery.trim().toLowerCase();
                const f1Entries = activeEntries.filter((e: any) => e.primary_category === 'F1' || e.categories.includes('F1')).map((e: any) => e.entry);
                const list = f1Entries.filter(
                  (w: string) => !q || w.toLowerCase().includes(q)
                );
                return (
                  <div className="space-y-3">
                    <div className="bg-cyan-950/30 p-3 rounded-lg border border-cyan-500/30 text-cyan-200 font-sans text-xs flex items-center justify-between">
                      <span>Entri F1 Master Lexicon Repository (Sinkron Supabase).</span>
                      <span className="font-mono text-cyan-300 font-bold">{f1Entries.length} Entri</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 max-h-[50vh] overflow-y-auto pr-1">
                      {list.map((word: string, idx: number) => (
                        <div key={`f1-${word}`} className="p-3 bg-slate-900 border border-cyan-500/30 rounded-lg space-y-1">
                          <div className="text-[10px] text-cyan-400 font-sans font-bold">
                            Slot Inti #{idx + 1}
                          </div>
                          <div className="text-base font-bold text-slate-100">
                            {word}
                          </div>
                          <div className="text-[10px] text-emerald-400 font-sans flex items-center gap-1 pt-1 border-t border-slate-800">
                            <CheckCircle2 className="w-3 h-3 shrink-0" />
                            <span>TERSEDIA (UTUH)</span>
                          </div>
                          <div className="text-[9px] text-slate-500 font-sans">
                            Sumber: GENNAS STUDIO PROMPT — Lampiran F1 Inti
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* MODAL 5: FORMAL EQUIVALENTS */}
              {activeModal === 'FORMAL_EQUIVALENTS' && (() => {
                const q = modalSearchQuery.trim().toLowerCase();
                const formalList = allActiveEntries
                  .filter((e) => Boolean(e.formalEquivalent))
                  .filter(
                    (e) =>
                      !q ||
                      e.word.toLowerCase().includes(q) ||
                      (e.formalEquivalent && e.formalEquivalent.toLowerCase().includes(q)) ||
                      e.categoryLabel.toLowerCase().includes(q) ||
                      e.contextNote.toLowerCase().includes(q)
                  );
                return (
                  <div className="space-y-3">
                    <div className="bg-purple-950/30 p-3 rounded-lg border border-purple-500/30 text-purple-200 font-sans text-xs flex items-center justify-between">
                      <span>Total {stats.total_formal_equivalents} kosakata lisan dengan pemetaan padanan formal resmi.</span>
                      <span className="font-mono text-purple-300 font-bold">{formalList.length} ditampilkan</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[50vh] overflow-y-auto pr-1">
                      {formalList.map((item) => (
                        <div key={`formal-${item.id}`} className="p-3 bg-slate-900 border border-purple-500/30 rounded-lg space-y-1">
                          <div className="flex items-center justify-between text-xs font-bold text-slate-100">
                            <span>{item.word}</span>
                            <span className="text-cyan-300 text-[11px] font-medium">→ {item.formalEquivalent}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-sans">
                            Kategori: <span className="text-slate-300">{item.categoryLabel}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-sans leading-snug">
                            Catatan: {item.contextNote}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* MODAL 6: NEEDS REVIEW ENTRIES (~81 ENTRIES) */}
              {activeModal === 'NEEDS_REVIEW' && (() => {
                const q = modalSearchQuery.trim().toLowerCase();
                const reviewList = allActiveEntries
                  .filter(
                    (e) =>
                      e.naturalnessStatus === 'NEEDS_CONTEXT_REVIEW' ||
                      Boolean(e.reviewReason)
                  )
                  .filter(
                    (e) =>
                      !q ||
                      e.word.toLowerCase().includes(q) ||
                      (e.reviewReason && e.reviewReason.toLowerCase().includes(q)) ||
                      (e.recommendedAlternative && e.recommendedAlternative.toLowerCase().includes(q)) ||
                      e.categoryLabel.toLowerCase().includes(q) ||
                      e.contextNote.toLowerCase().includes(q)
                  );
                return (
                  <div className="space-y-3">
                    <div className="bg-amber-950/30 p-3 rounded-lg border border-amber-500/30 text-amber-200 font-sans text-xs flex items-center justify-between">
                      <span>Daftar {reviewList.length} entri yang memerlukan perhatian/pemeriksaan konteks (F7 Contextual Guard Rules).</span>
                      <span className="font-mono text-amber-300 font-bold">{reviewList.length} Entri Perhatian</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[50vh] overflow-y-auto pr-1">
                      {reviewList.map((item) => (
                        <div key={`review-${item.id}`} className="p-3 bg-slate-900 border border-amber-500/30 rounded-lg space-y-1.5">
                          <div className="flex items-center justify-between text-xs font-bold text-amber-300">
                            <span>{item.word}</span>
                            <span className="text-[9px] px-1.5 py-0.5 bg-amber-500/20 text-amber-200 rounded font-sans border border-amber-500/30">
                              PERLU TINJAU KONTEKS
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-300 font-sans">
                            Kategori: <strong>{item.categoryLabel}</strong>
                          </div>
                          <div className="text-[11px] text-amber-200/90 font-sans bg-amber-950/40 p-2 rounded border border-amber-500/20">
                            <strong>Alasan Peninjauan:</strong> {item.reviewReason || 'Leksikon khusus perlu penyesuaian konteks.'}
                            {item.recommendedAlternative && (
                              <div className="text-emerald-300 text-[10px] mt-1">
                                Saran Penggunaan: <code>{item.recommendedAlternative}</code>
                              </div>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-sans">
                            Catatan Linguistik: {item.contextNote}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setActiveModal(null);
                  setModalSearchQuery('');
                }}
                className="px-4 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors"
              >
                Tutup Detail Modal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Entri Induk (Tombstone Blacklist) */}
      {entryToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <div className="bg-[#0f172a] border border-rose-500/40 rounded-xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">
                  Hapus Entri Induk Master
                </h3>
                <p className="text-xs text-rose-300 font-mono">
                  "{entryToDelete.word}" ({entryToDelete.id})
                </p>
              </div>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 text-xs text-slate-300 space-y-2">
              <p>
                Apakah Anda yakin ingin menghapus kosakata ini secara permanen dari <strong>Master Lexicon Repository</strong>?
              </p>
              <div className="p-2 rounded bg-rose-950/30 border border-rose-500/30 text-rose-200 text-[11px]">
                <strong>Efek Permanen:</strong> Kata yang dihapus akan dicatat dalam daftar hitam (tombstones) dan <strong>tidak akan pernah digunakan lagi</strong> oleh AI dalam proses pemilihan kata naskah.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setEntryToDelete(null)}
                className="px-3.5 py-1.5 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={executeDeleteEntry}
                className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Menghapus...' : 'Ya, Hapus Permanen'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Import CSV Universal 7 Kolom Tetap untuk Repository */}
      <UniversalCsvImportModal
        isOpen={isUniversalCsvModalOpen}
        onClose={() => setIsUniversalCsvModalOpen(false)}
        targetMenuName="Repository"
        onImportSuccess={(result) => {
          setToastNotification({
            text: `Berhasil mengimpor ${result.importedCount} kosakata baru dari "${result.fileName}" ke Master Lexicon Repository (${result.duplicatesCount} duplikat disaring).`,
            isError: false,
          });
          refreshAllData();
        }}
      />
    </div>
  );
};
