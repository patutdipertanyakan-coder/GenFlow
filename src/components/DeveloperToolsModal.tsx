import React, { useEffect, useState } from 'react';
import {
  IsolatedSuiteResult,
  ProjectStateIsolationProof,
  ProjectStateSnapshot,
  runIsolatedEdgeValidatorSuite,
  VALIDATOR_CATEGORIES,
  ValidatorCategoryKey,
  verifyProjectStateIsolation,
} from '../lib/isolatedEdgeValidator';
import {
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  Copy,
  Check,
  X,
  Terminal,
  ShieldCheck,
  Search,
  Clock,
} from 'lucide-react';

interface DeveloperToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  getProjectStateSnapshot?: () => ProjectStateSnapshot;
}

export const DeveloperToolsModal: React.FC<DeveloperToolsModalProps> = ({
  isOpen,
  onClose,
  getProjectStateSnapshot,
}) => {
  const [suiteResult, setSuiteResult] = useState<IsolatedSuiteResult | null>(null);
  const [isolationProof, setIsolationProof] =
    useState<ProjectStateIsolationProof | null>(null);
  const [snapshotBeforeRun, setSnapshotBeforeRun] =
    useState<ProjectStateSnapshot | null>(null);
  const [snapshotAfterRun, setSnapshotAfterRun] =
    useState<ProjectStateSnapshot | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<
    ValidatorCategoryKey | 'ALL'
  >('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedReport, setCopiedReport] = useState(false);

  // Jalankan test runner pada saat pertama kali modal dibuka jika belum pernah dijalankan
  useEffect(() => {
    if (isOpen && !suiteResult) {
      handleRunTests();
    }
  }, [isOpen]);

  // Dukungan Escape key untuk menutup modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleRunTests = () => {
    setIsRunning(true);
    const snapBefore = getProjectStateSnapshot ? getProjectStateSnapshot() : null;

    // Jalankan pengujian murni secara terisolasi tanpa memodifikasi state proyek
    setTimeout(() => {
      const res = runIsolatedEdgeValidatorSuite();
      const snapAfter = getProjectStateSnapshot ? getProjectStateSnapshot() : null;

      if (snapBefore && snapAfter) {
        setSnapshotBeforeRun(snapBefore);
        setSnapshotAfterRun(snapAfter);
        setIsolationProof(verifyProjectStateIsolation(snapBefore, snapAfter));
      }
      setSuiteResult(res);
      setIsRunning(false);
    }, 80);
  };

  const handleCopyReport = async () => {
    if (!suiteResult) return;
    const lines = [
      `# LAPORAN PENGUJIAN ISOLATED EDGE VALIDATOR — GenFLOW Studio`,
      `Waktu Pengujian: ${suiteResult.timestamp}`,
      `Ringkasan: ${suiteResult.passedCount}/${suiteResult.totalTests} Pengujian Lulus`,
      `Jumlah Pengujian: ${suiteResult.totalTests} | Lulus: ${suiteResult.passedCount} | Gagal: ${suiteResult.failedCount}`,
      `Durasi: ${suiteResult.durationMs}ms | Status: ${
        suiteResult.allPassed ? 'SEMUA LULUS (100%)' : 'ADA KEGAGALAN'
      }`,
      isolationProof ? `Bukti Isolasi State: ${isolationProof.summary}` : '',
      '',
      '---',
      ...suiteResult.allResults.map((tc) => {
        return [
          `### [${tc.id}] ${tc.name} (${tc.categoryTitle})`,
          `- Nama Validator: ${tc.validatorName}`,
          `- Tipe Kasus: ${tc.caseType}`,
          `- Status: ${tc.passed ? 'LULUS' : 'GAGAL'}`,
          `- Data Uji: ${tc.inputSnippet}`,
          `- Hasil yang Diharapkan: ${tc.expectedOutcome}`,
          `- Hasil Sebenarnya: ${tc.actualOutcome}`,
          `- Alasan / Evaluasi: ${tc.reason}`,
          '',
        ].join('\n');
      }),
    ];

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopiedReport(true);
      setTimeout(() => setCopiedReport(false), 2000);
    } catch {
      // Fallback
    }
  };

  // Filter hasil uji berdasarkan kategori dan query pencarian
  const filteredResults = suiteResult
    ? suiteResult.allResults.filter((item) => {
        const matchCategory =
          selectedCategory === 'ALL' || item.category === selectedCategory;
        const matchQuery =
          !searchQuery.trim() ||
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.validatorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.inputSnippet.toLowerCase().includes(searchQuery.toLowerCase());
        return matchCategory && matchQuery;
      })
    : [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dev-tools-title"
      data-testid="developer-tools-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-[#0f172a] border border-slate-700/90 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header Modal */}
        <header className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between gap-4 bg-[#111827]/90 shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              data-testid="back-to-studio-btn"
              onClick={onClose}
              data-tooltip="Kembali ke Studio Naskah."
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800/90 hover:bg-slate-700 text-amber-300 border border-amber-500/30 transition-colors cursor-pointer shrink-0 flex items-center gap-1.5"
            >
              <span>← Kembali</span>
            </button>
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="dev-tools-title"
                className="text-sm font-bold text-slate-100 flex items-center gap-2"
              >
                <span>Developer Tools — Uji Validator</span>
                <span className="text-[10px] font-mono font-normal px-2 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700">
                  V5.1
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Simulasi uji seluruh validator tanpa mengubah naskah aktif.
              </p>
            </div>
          </div>

          <button
            type="button"
            data-testid="close-dev-tools-btn"
            onClick={onClose}
            data-tooltip="Tutup Developer Tools (Esc)."
            aria-label="Tutup Developer Tools"
            className="w-8 h-8 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-slate-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Toolbar Tombol Aksi & Ringkasan Metrik Uji */}
        <div className="px-5 py-3 border-b border-slate-800 bg-[#0B0F17] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="run-validator-test-btn"
              disabled={isRunning}
              onClick={handleRunTests}
              data-tooltip="Jalankan simulasi uji 37 kasus validator terisolasi."
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm whitespace-nowrap cursor-pointer"
            >
              {isRunning ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                  <span>Menguji...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Jalankan Uji Validator</span>
                </>
              )}
            </button>

            {suiteResult && (
              <button
                type="button"
                data-testid="copy-validator-report-btn"
                onClick={handleCopyReport}
                data-tooltip="Salin laporan hasil uji ke clipboard."
                className="px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                {copiedReport ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-300">Tersalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin Laporan</span>
                  </>
                )}
              </button>
            )}
          </div>

          {suiteResult && (
            <div
              data-testid="validator-suite-summary"
              className="flex flex-wrap items-center gap-2 text-xs"
            >
              <div
                data-testid="validator-pass-headline"
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-mono font-semibold ${
                  suiteResult.allPassed
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}
              >
                {suiteResult.allPassed ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-rose-400" />
                )}
                <span>
                  {suiteResult.passedCount}/{suiteResult.totalTests} Lulus
                </span>
              </div>

              <div className="flex items-center gap-2 font-mono text-[11px] bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg text-slate-300">
                <span className="text-emerald-400">
                  Lulus: {suiteResult.passedCount}
                </span>
                <span className="text-slate-600">·</span>
                <span
                  className={
                    suiteResult.failedCount === 0
                      ? 'text-slate-400'
                      : 'text-rose-400 font-semibold'
                  }
                >
                  Gagal: {suiteResult.failedCount}
                </span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">{suiteResult.durationMs}ms</span>
              </div>
            </div>
          )}
        </div>

        {/* Bukti Isolasi State Proyek Sebelum & Sesudah Pengujian */}
        {isolationProof && snapshotBeforeRun && snapshotAfterRun && (
          <div
            data-testid="state-isolation-proof-banner"
            className={`px-5 py-2 border-b text-xs flex flex-wrap items-center justify-between gap-2 shrink-0 ${
              isolationProof.isolated
                ? 'bg-emerald-950/35 border-emerald-800/60 text-emerald-200'
                : 'bg-rose-950/60 border-rose-800 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-medium">{isolationProof.summary}</span>
            </div>
            <div className="font-mono text-[11px] text-emerald-300/90 flex flex-wrap items-center gap-2">
              <span>
                Status: {snapshotBeforeRun.dashboardStatus} → {snapshotAfterRun.dashboardStatus}
              </span>
              <span>·</span>
              <span>
                Token SAP: {snapshotBeforeRun.protectedTokens.length} → {snapshotAfterRun.protectedTokens.length}
              </span>
              <span>·</span>
              <span>
                Slot F1: {snapshotBeforeRun.activeLexiconUsedCount}/16 → {snapshotAfterRun.activeLexiconUsedCount}/16
              </span>
            </div>
          </div>
        )}

        {/* Filter Bar & Kategori */}
        <div className="px-5 py-2.5 border-b border-slate-800/80 bg-[#111827]/70 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-1.5 max-w-full">
            <button
              type="button"
              onClick={() => setSelectedCategory('ALL')}
              data-tooltip="Tampilkan seluruh kasus uji validator."
              className={`px-2.5 py-1 text-xs rounded-md font-medium whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === 'ALL'
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              Semua ({suiteResult ? suiteResult.totalTests : 0})
            </button>
            {VALIDATOR_CATEGORIES.map((cat) => {
              const count = suiteResult
                ? suiteResult.resultsByCategory[cat.key]?.length || 0
                : 0;
              const isSelected = selectedCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setSelectedCategory(cat.key)}
                  data-tooltip={cat.description}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {cat.code}. {cat.title} ({count})
                </button>
              );
            })}
          </div>

          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              aria-label="Cari kasus uji validator"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kasus uji..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Konten Daftar Kasus Pengujian (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3.5 bg-[#0B0F17]">
          {filteredResults.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              Tidak ada kasus uji yang cocok dengan filter.
            </div>
          ) : (
            filteredResults.map((tc) => (
              <article
                key={tc.id}
                data-testid={`test-case-${tc.id}`}
                className={`border rounded-xl p-4 transition-colors ${
                  tc.passed
                    ? 'bg-slate-900/60 border-slate-800/90 hover:border-slate-700'
                    : 'bg-rose-950/20 border-rose-800/60'
                }`}
              >
                {/* Header Kartu Kasus Uji */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/70 pb-2.5 mb-2.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono font-semibold px-2 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700">
                      {tc.id}
                    </span>
                    <span className="font-semibold text-slate-100">{tc.name}</span>
                    <span aria-hidden="true" className="text-slate-600">
                      ·
                    </span>
                    <span className="text-slate-400 font-mono text-[11px]">
                      {tc.categoryTitle}
                    </span>
                    <span aria-hidden="true" className="text-slate-600">
                      ·
                    </span>
                    <span className="text-indigo-400 font-mono text-[11px]">
                      Validator: {tc.validatorName}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
                        tc.caseType === 'POSITIF'
                          ? 'bg-blue-500/10 text-blue-300 border-blue-500/25'
                          : 'bg-purple-500/10 text-purple-300 border-purple-500/25'
                      }`}
                    >
                      {tc.caseType === 'POSITIF'
                        ? 'Kasus Positif'
                        : 'Kasus Negatif (Sengaja Salah → Wajib Ditolak)'}
                    </span>

                    <span
                      data-testid={`test-status-${tc.id}`}
                      className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${
                        tc.passed
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                      }`}
                    >
                      {tc.passed ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>LULUS</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3.5 h-3.5 text-rose-400" />
                          <span>GAGAL</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {/* Grid Rincian Evaluasi */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {/* Kolom 1: Data Uji */}
                  <div className="space-y-1">
                    <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                      Data Uji (Fixture Simulasi Terisolasi):
                    </div>
                    <pre className="w-full bg-slate-950 border border-slate-800/90 rounded-lg p-2.5 font-mono text-[11px] text-slate-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                      {tc.inputSnippet}
                    </pre>
                  </div>

                  {/* Kolom 2: Hasil Ekspektasi vs Aktual */}
                  <div className="space-y-1.5 flex flex-col justify-between">
                    <div>
                      <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                        Hasil yang Diharapkan:
                      </div>
                      <div className="text-slate-200 mt-0.5 text-xs">
                        {tc.expectedOutcome}
                      </div>
                    </div>

                    <div className="border-t border-slate-800/80 pt-1.5">
                      <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                        Hasil Sebenarnya:
                      </div>
                      <div className="font-mono text-xs text-amber-200/90 mt-0.5">
                        {tc.actualOutcome}
                      </div>
                    </div>

                    <div className="border-t border-slate-800/80 pt-1.5">
                      <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                        Alasan / Evaluasi Kelulusan:
                      </div>
                      <div className="text-slate-300 mt-0.5 text-xs">
                        {tc.reason}
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>

        {/* Footer Informasi Isolasi */}
        <footer className="px-5 py-3 border-t border-slate-800 bg-[#111827] text-xs text-slate-400 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Catatan: Kasus uji yang sengaja salah dinyatakan LULUS apabila validator berhasil menolaknya sesuai ekspektasi.
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </footer>
      </div>
    </div>
  );
};

