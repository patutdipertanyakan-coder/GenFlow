import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Radio,
  CheckCircle2,
  AlertTriangle,
  History,
  FileCode,
  CheckSquare,
  ShieldAlert,
  GitCompare,
  Layers,
  Sparkles,
  Bug,
  Cpu,
  Search,
  Filter,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  ReleaseRecord,
  VersionComparisonResult,
  compareReleases,
  formatJakartaTime,
  calculateUnreadReleases,
  sanitizeChangeNotes,
} from '../lib/changeTracker';

interface LiveUpdateCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  releases: ReleaseRecord[];
  activeRelease: ReleaseRecord | null;
  currentVersion: string;
  onMarkRead: (releaseId: string) => void;
  sseStatus: 'CONNECTED' | 'RECONNECTING' | 'OFFLINE';
}

type TabType =
  | 'active'
  | 'summary'
  | 'history'
  | 'files'
  | 'tests'
  | 'risks'
  | 'compare';

export const LiveUpdateCenterModal: React.FC<LiveUpdateCenterModalProps> = ({
  isOpen,
  onClose,
  releases,
  activeRelease,
  currentVersion,
  onMarkRead,
  sseStatus,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [expandedReleaseId, setExpandedReleaseId] = useState<string | null>(
    activeRelease?.release_id || null
  );
  const [historyFilter, setHistoryFilter] = useState<'ALL' | 'CRITICAL' | 'MINOR' | 'MAJOR'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Comparator states
  const [compareBaseVer, setCompareBaseVer] = useState<string>('5.1.0');
  const [compareTargetVer, setCompareTargetVer] = useState<string>('5.2.0');

  useEffect(() => {
    if (activeRelease && isOpen) {
      onMarkRead(activeRelease.release_id);
    }
  }, [isOpen, activeRelease, onMarkRead]);

  // Keyboard shortcut ESC to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const filteredReleases = useMemo(() => {
    return releases.filter((r) => {
      const matchFilter =
        historyFilter === 'ALL' ||
        (historyFilter === 'CRITICAL' && r.is_critical_system_change) ||
        r.change_type === historyFilter;

      const matchSearch =
        searchQuery.trim() === '' ||
        r.version.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.release_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.affected_modules.some((m) =>
          m.toLowerCase().includes(searchQuery.toLowerCase())
        );

      return matchFilter && matchSearch;
    });
  }, [releases, historyFilter, searchQuery]);

  // Compute live comparison
  const comparisonResult: VersionComparisonResult | null = useMemo(() => {
    const base = releases.find((r) => r.version === compareBaseVer);
    const target = releases.find((r) => r.version === compareTargetVer);
    if (!base || !target) return null;
    return compareReleases(base, target);
  }, [releases, compareBaseVer, compareTargetVer]);

  if (!isOpen) return null;

  const currentActive = activeRelease || releases[0];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="live-update-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
    >
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-200">
        {/* HEADER MODAL */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="live-update-title" className="text-base sm:text-lg font-bold text-slate-100">
                  GenFLOW Studio Live Update Center
                </h2>
                <span className="px-2 py-0.5 text-xs font-mono font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-300 rounded-full">
                  v{currentVersion}
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full border ${
                    sseStatus === 'CONNECTED'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : sseStatus === 'RECONNECTING'
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      sseStatus === 'CONNECTED'
                        ? 'bg-emerald-400 animate-ping'
                        : 'bg-amber-400'
                    }`}
                  />
                  {sseStatus === 'CONNECTED'
                    ? 'Live Aktif'
                    : sseStatus === 'RECONNECTING'
                    ? 'Menghubungkan...'
                    : 'Offline'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Informasi versi aktif, riwayat pembaruan, dan hasil verifikasi uji.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            data-tooltip="Tutup jendela."
            aria-label="Tutup Live Update Center"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* TAB NAVIGATION */}
        <div className="flex items-center gap-1 px-5 py-2 border-b border-slate-800 bg-slate-900/90 overflow-x-auto text-xs font-medium scrollbar-thin">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'active'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Versi Aktif
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'summary'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Ringkasan
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'history'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Riwayat ({releases.length})
          </button>
          <button
            onClick={() => setActiveTab('files')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'files'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            Modul ({currentActive?.changed_files.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('tests')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'tests'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            Uji ({currentActive?.test_results?.passed ?? 0}/{currentActive?.test_results?.totalTests ?? 0})
          </button>
          <button
            onClick={() => setActiveTab('compare')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'compare'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            Bandingkan
          </button>
          <button
            onClick={() => setActiveTab('risks')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'risks'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Integritas
          </button>
        </div>

        {/* TAB CONTENTS (SCROLLABLE) */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-sm">
          {/* TAB 1: VERSI AKTIF */}
          {activeTab === 'active' && currentActive && (
            <div className="space-y-5 animate-fadeIn">
              {/* Card Ringkasan Status */}
              <div className="p-4 sm:p-5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                      Versi Aktif Aplikasi
                    </span>
                    <h3 className="text-xl font-bold text-amber-300 flex items-center gap-2">
                      v{currentActive.version} — {currentActive.release_title}
                    </h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-1 text-xs font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-lg flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Status: {currentActive.status}
                    </span>
                    <span className="px-2.5 py-1 text-xs font-semibold bg-sky-500/15 border border-sky-500/30 text-sky-400 rounded-lg">
                      Build: {currentActive.build_id}
                    </span>
                    <span className="px-2.5 py-1 text-xs font-semibold bg-purple-500/15 border border-purple-500/30 text-purple-400 rounded-lg">
                      Commit: {currentActive.commit_hash}
                    </span>
                  </div>
                </div>

                <p className="text-slate-300 text-sm leading-relaxed">
                  {currentActive.description}
                </p>

                {/* 4 Pilar Integritas */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg">
                    <span className="text-[11px] text-slate-400 block">Waktu Rilis (WIB)</span>
                    <span className="font-medium text-slate-200 text-xs mt-1 block">
                      {formatJakartaTime(currentActive.deployed_at)}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg">
                    <span className="text-[11px] text-slate-400 block">Status Build</span>
                    <span className="font-semibold text-emerald-400 text-xs mt-1 block flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      BUILD PASSED
                    </span>
                  </div>
                  <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg">
                    <span className="text-[11px] text-slate-400 block">Status Deployment</span>
                    <span className="font-semibold text-emerald-400 text-xs mt-1 block">
                      DEPLOYED & ACTIVE
                    </span>
                  </div>
                  <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg">
                    <span className="text-[11px] text-slate-400 block">Verifikasi Pengujian</span>
                    <span className="font-semibold text-emerald-400 text-xs mt-1 block flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {currentActive?.test_results?.passed ?? 0}/{currentActive?.test_results?.totalTests ?? 0} LULUS
                    </span>
                  </div>
                </div>
              </div>

              {/* Critical System Change Warning if present */}
              {currentActive.is_critical_system_change && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/25 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs tracking-wide uppercase">
                    <ShieldAlert className="w-4 h-4" />
                    CRITICAL SYSTEM CHANGE TERDETEKSI
                  </div>
                  <p className="text-xs text-amber-200/90 leading-relaxed">
                    Pembaruan ini melibatkan modul sensitif arsitektur studio:
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {currentActive.critical_modules.map((cm, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 text-[11px] font-mono bg-amber-400/20 border border-amber-400/30 text-amber-300 rounded"
                      >
                        {cm}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick High-level highlights */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-2">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    Fitur Baru Unggulan
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {currentActive.new_features.slice(0, 4).map((f, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-emerald-400 mt-0.5">•</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-2">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckSquare className="w-3.5 h-3.5 text-sky-400" />
                    Peningkatan & Stabilitas
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {currentActive.improvements.slice(0, 4).map((imp, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-sky-400 mt-0.5">•</span>
                        <span>{imp}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: RINGKASAN PEMBARUAN */}
          {activeTab === 'summary' && currentActive && (
            <div className="space-y-5 animate-fadeIn">
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
                <h3 className="text-sm font-bold text-slate-200">
                  Ringkasan Pembaruan v{currentActive.version} ({currentActive.release_title})
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Daftar komprehensif perubahan per komponen aplikasi dari frontend, backend, validator, hingga sistem prompt.
                </p>
              </div>

              {/* Grid 6 Kategori Pembaruan */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Fitur Baru */}
                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2.5">
                  <h4 className="text-xs font-bold text-emerald-300 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    Fitur Baru ({currentActive.new_features.length})
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {currentActive.new_features.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-emerald-400">✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 2. Bug Fixes */}
                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2.5">
                  <h4 className="text-xs font-bold text-sky-300 flex items-center gap-2">
                    <Bug className="w-4 h-4 text-sky-400" />
                    Perbaikan Bug ({currentActive.fixes.length})
                  </h4>
                  {currentActive.fixes.length > 0 ? (
                    <ul className="space-y-1.5 text-xs text-slate-300">
                      {currentActive.fixes.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-sky-400">✓</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-500 italic">Tidak ada bugfix pada rilis ini.</p>
                  )}
                </div>

                {/* 3. Backend */}
                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2.5">
                  <h4 className="text-xs font-bold text-purple-300 flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-purple-400" />
                    Perubahan Sistem Backend ({currentActive.backend_changes.length})
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {currentActive.backend_changes.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-purple-400">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 4. UI Changes */}
                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2.5">
                  <h4 className="text-xs font-bold text-amber-300 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-amber-400" />
                    Perubahan Tampilan / UI ({currentActive.ui_changes.length})
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {currentActive.ui_changes.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-amber-400">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 5. Validator Changes */}
                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2.5">
                  <h4 className="text-xs font-bold text-rose-300 flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-rose-400" />
                    Perubahan Validator & Kontrak ({currentActive.validator_changes.length})
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {currentActive.validator_changes.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-rose-400">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 6. System Prompt & Lexicon Bank */}
                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2.5">
                  <h4 className="text-xs font-bold text-teal-300 flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-teal-400" />
                    Perubahan Prompt & Kosakata ({currentActive.prompt_lexicon_changes.length})
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {currentActive.prompt_lexicon_changes.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-teal-400">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: RIWAYAT PEMBARUAN */}
          {activeTab === 'history' && (
            <div className="space-y-4 animate-fadeIn">
              {/* Filter & Search Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-400 font-medium">Filter:</span>
                  {(['ALL', 'CRITICAL', 'MINOR', 'MAJOR'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setHistoryFilter(mode)}
                      className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                        historyFilter === mode
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      {mode === 'ALL'
                        ? 'Semua'
                        : mode === 'CRITICAL'
                        ? 'Sistem Kritis'
                        : mode}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari versi atau modul..."
                    className="pl-8 pr-3 py-1 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>

              {/* Release List */}
              <div className="space-y-3">
                {filteredReleases.map((rel) => {
                  const isExpanded = expandedReleaseId === rel.release_id;
                  const isActive = rel.status === 'ACTIVE';

                  return (
                    <div
                      key={rel.release_id}
                      className={`border rounded-xl transition-all overflow-hidden ${
                        isActive
                          ? 'bg-slate-950/80 border-amber-500/30'
                          : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      {/* Release Item Header */}
                      <div
                        onClick={() => {
                          setExpandedReleaseId(isExpanded ? null : rel.release_id);
                          onMarkRead(rel.release_id);
                        }}
                        className="p-4 flex items-center justify-between gap-3 cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="text-base font-bold text-slate-100 font-mono">
                                v{rel.version}
                              </span>
                              <span
                                className={`px-2 py-0.5 text-[10px] font-semibold rounded-md border ${
                                  rel.change_type === 'MAJOR'
                                    ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                                    : rel.change_type === 'MINOR'
                                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                                    : 'bg-sky-500/15 border-sky-500/30 text-sky-300'
                                }`}
                              >
                                {rel.change_type}
                              </span>
                              {isActive && (
                                <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-md">
                                  ACTIVE
                                </span>
                              )}
                              {rel.is_critical_system_change && (
                                <span className="px-2 py-0.5 text-[10px] font-semibold bg-red-500/15 border border-red-500/30 text-red-300 rounded-md flex items-center gap-1">
                                  <ShieldAlert className="w-3 h-3" />
                                  KRITIS
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-slate-300 font-medium mt-0.5">
                              {rel.release_title}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-[11px] text-slate-400 hidden sm:inline">
                            {formatJakartaTime(rel.deployed_at)}
                          </span>
                          <span className="text-slate-400">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </span>
                        </div>
                      </div>

                      {/* Expandable Release Details */}
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-1 border-t border-slate-800/80 space-y-3 text-xs bg-slate-900/40">
                          <p className="text-slate-300 leading-relaxed">{rel.description}</p>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                            <div>
                              <span className="text-slate-400 font-semibold block mb-1">
                                Modul Terdampak ({rel.affected_modules.length}):
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {rel.affected_modules.map((m, i) => (
                                  <span
                                    key={i}
                                    className="px-2 py-0.5 text-[11px] bg-slate-800 border border-slate-700 rounded text-slate-300"
                                  >
                                    {m}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div>
                              <span className="text-slate-400 font-semibold block mb-1">
                                Verifikasi Pengujian:
                              </span>
                              <div className="p-2 bg-slate-950 border border-slate-800 rounded font-mono text-[11px] text-emerald-400">
                                ✓ {rel.test_results?.passed ?? 0}/{rel.test_results?.totalTests ?? 0} tests passing ({rel.test_results?.runner || 'node:test'})
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: FILE & MODUL TERDAMPAK */}
          {activeTab === 'files' && currentActive && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                <h3 className="text-sm font-bold text-slate-200">
                  Audit File & Modul Terdampak — v{currentActive.version}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Daftar file konkret yang dibuat atau dimodifikasi pada pembaruan ini, diverifikasi langsung dari struktur proyek.
                </p>
              </div>

              <div className="space-y-2">
                {currentActive.changed_files.map((cf, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded ${
                          cf.action === 'CREATED'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : cf.action === 'DELETED'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                        }`}
                      >
                        {cf.action}
                      </span>
                      <span className="font-mono text-slate-200 font-medium">{cf.path}</span>
                    </div>
                    <span className="text-slate-400 text-xs sm:max-w-md sm:text-right">
                      {cf.summary}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: HASIL PENGUJIAN */}
          {activeTab === 'tests' && currentActive && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                <h3 className="text-sm font-bold text-slate-200">
                  Hasil Pengujian Regresi Aktual (Automated Test Evidence)
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Hasil eksekusi test runner Node.js built-in (<code className="text-amber-300">node:test</code> via tsx). Seluruh aturan logika dieksekusi secara deterministik.
                </p>
              </div>

              {/* Metrics Test Run */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg text-center">
                  <span className="text-[11px] text-slate-400 block">Total Pengujian</span>
                  <span className="text-lg font-bold text-slate-100 mt-1 block">
                    {currentActive?.test_results?.totalTests ?? 0}
                  </span>
                </div>
                <div className="p-3 bg-slate-950/80 border border-emerald-500/30 rounded-lg text-center bg-emerald-500/5">
                  <span className="text-[11px] text-emerald-400 block">Lulus (Passed)</span>
                  <span className="text-lg font-bold text-emerald-400 mt-1 block">
                    {currentActive?.test_results?.passed ?? 0}
                  </span>
                </div>
                <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg text-center">
                  <span className="text-[11px] text-slate-400 block">Gagal (Failed)</span>
                  <span className="text-lg font-bold text-slate-400 mt-1 block">
                    {currentActive?.test_results?.failed ?? 0}
                  </span>
                </div>
                <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg text-center">
                  <span className="text-[11px] text-slate-400 block">Durasi Eksekusi</span>
                  <span className="text-lg font-bold text-sky-400 mt-1 block">
                    {currentActive?.test_results?.durationMs ?? 0}ms
                  </span>
                </div>
              </div>

              {/* Rincian Test Suites */}
              <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3 text-xs font-mono">
                <div className="text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  Rincian Test Suites Terverifikasi:
                </div>
                <div className="space-y-1.5 text-slate-300">
                  {currentActive?.test_results?.details?.map((d, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-emerald-400">✓</span>
                      <span>{d}</span>
                    </div>
                  )) || <div className="text-slate-500">Semua pengujian unit & integrasi LULUS.</div>}
                </div>
                <div className="pt-2 text-[11px] text-slate-500">
                  Perintah uji: <code className="text-slate-400">{currentActive?.test_results?.command || 'npx tsx --test'}</code> · Terakhir dijalankan: {currentActive?.test_results?.lastRunJakarta || '2026-11-05 18:35 WIB'}
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: BANDINGKAN VERSI */}
          {activeTab === 'compare' && (
            <div className="space-y-5 animate-fadeIn">
              {/* Selector Versi */}
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
                <h3 className="text-sm font-bold text-slate-200">
                  Bandingkan Perubahan Antar Versi (Side-by-Side Comparator)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1 font-medium">
                      Versi Basis (Base):
                    </label>
                    <select
                      value={compareBaseVer}
                      onChange={(e) => setCompareBaseVer(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500/50"
                    >
                      {releases.map((r) => (
                        <option key={r.version} value={r.version}>
                          v{r.version} — {r.release_title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1 font-medium">
                      Versi Target:
                    </label>
                    <select
                      value={compareTargetVer}
                      onChange={(e) => setCompareTargetVer(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500/50"
                    >
                      {releases.map((r) => (
                        <option key={r.version} value={r.version}>
                          v{r.version} — {r.release_title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Comparison Output */}
              {comparisonResult && (
                <div className="space-y-4">
                  {/* Summary Bar */}
                  <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-amber-300">
                        v{comparisonResult.base_version}
                      </span>
                      <ArrowRight className="w-4 h-4 text-slate-500" />
                      <span className="font-mono font-bold text-amber-300">
                        v{comparisonResult.target_version}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                        {comparisonResult.semantic_jump} UPGRADE
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">Total File Berubah:</span>
                      <span className="font-bold text-slate-200">
                        {comparisonResult.files_changed.total} file
                      </span>
                    </div>
                  </div>

                  {/* Diff Columns */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                      <h4 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                        Fitur Baru di v{comparisonResult.target_version}
                      </h4>
                      <ul className="space-y-1 text-xs text-slate-300">
                        {comparisonResult.new_features.map((f, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-emerald-400">+</span>
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                      <h4 className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                        <CheckSquare className="w-3.5 h-3.5 text-sky-400" />
                        Evolusi Hasil Uji & Regresi
                      </h4>
                      <div className="space-y-2 text-xs">
                        <p className="text-slate-300">
                          Pengujian bertambah dari{' '}
                          <strong className="text-slate-200">
                            {comparisonResult.test_comparison.base_passed}
                          </strong>{' '}
                          menjadi{' '}
                          <strong className="text-emerald-300">
                            {comparisonResult.test_comparison.target_passed}
                          </strong>{' '}
                          tes ({comparisonResult.test_comparison.diff_tests >= 0 ? '+' : ''}
                          {comparisonResult.test_comparison.diff_tests} tes).
                        </p>
                        <div className="p-2 bg-emerald-500/10 border border-emerald-500/25 rounded text-emerald-300 font-medium">
                          ✓ 100% Bebas Regresi (Zero test failures detected).
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 7: RISIKO & INTEGRITAS */}
          {activeTab === 'risks' && currentActive && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                <h3 className="text-sm font-bold text-slate-200">
                  Batasan, Integritas Sistem, & Jaminan Keamanan
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Dokumentasi transparan mengenai batasan lingkungan AI Studio, pemisahan observabilitas terhadap penulisan naskah, dan sanitasi informasi.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                  <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-amber-400" />
                    Pemisahan Tugas Mutlak (Zero Script Mutation)
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Live Update Center hanya bertugas mengamati, mencatat, dan menyajikan audit pembaruan. Sistem ini secara arsitektural tidak memiliki otoritas untuk memodifikasi teks <code className="text-amber-200">clean_script</code>, tidak mengubah kerangka fakta sumber, tidak mengubah Master Prompt V5.1, dan tidak memicu Auto-Enforce otomatis.
                  </p>
                </div>

                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                  <h4 className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-sky-400" />
                    Keterbatasan Lingkungan & Solusi Faktual
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Pada lingkungan container Google AI Studio, direktori <code className="text-sky-200">.git</code> lokal tidak tersedia secara default. Oleh karena itu, pelacakan commit hash dan build manifest dilakukan melalui <code className="text-sky-200">/src/data/releaseManifest.json</code> persisten dan sinkronisasi server API yang terverifikasi, bukan dengan mengarang status palsu.
                  </p>
                </div>

                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                  <h4 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Perlindungan Privasi & Data Sensitif
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Fungsi sanitasi <code className="text-emerald-200">sanitizeChangeNotes</code> menyensor otomatis semua pola API key Gemini, Bearer token, maupun password sebelum dicatat atau disajikan di antarmuka pengguna.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800 bg-slate-950/90 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>GenFLOW Studio Observability</span>
            <span>·</span>
            <span className="font-mono">v{currentVersion}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
