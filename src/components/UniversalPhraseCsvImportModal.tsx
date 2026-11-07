import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Layers,
  History,
  FileText,
  ShieldCheck,
  ArrowRight,
  Filter,
} from 'lucide-react';
import {
  UniversalPhraseCsvPreview,
  ValidatedPhraseImportRow,
} from '../lib/g1g11UniversalCsvParser';
import { G1G11ImportAuditRecord } from '../lib/g1g11PhraseRepository';

interface UniversalPhraseCsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (result: {
    importRecord: G1G11ImportAuditRecord;
    affectedCategories: string[];
  }) => void;
}

export const UniversalPhraseCsvImportModal: React.FC<
  UniversalPhraseCsvImportModalProps
> = ({ isOpen, onClose, onImportSuccess }) => {
  const [activeTab, setActiveTab] = useState<'UPLOAD' | 'HISTORY'>('UPLOAD');
  const [fileName, setFileName] = useState<string>('');
  const [csvContent, setCsvContent] = useState<string>('');
  const [preview, setPreview] = useState<UniversalPhraseCsvPreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rowStatusFilter, setRowStatusFilter] = useState<
    'ALL' | 'NEW' | 'UPDATE' | 'DUPLICATE' | 'INVALID'
  >('ALL');

  // History state
  const [historyLogs, setHistoryLogs] = useState<G1G11ImportAuditRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [rollingBackId, setRollingBackId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen]);

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch('/api/phrases/g1g11/import-history');
      if (res.ok) {
        const data = await res.json();
        setHistoryLogs(data.logs || []);
      }
    } catch {
      // Fallback
    } finally {
      setIsLoadingHistory(false);
    }
  };

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setErrorMessage(null);
    setIsLoadingPreview(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = (event.target?.result as string) || '';
      setCsvContent(text);

      try {
        const res = await fetch('/api/phrases/g1g11/preview-csv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csvContent: text }),
        });

        const data: UniversalPhraseCsvPreview = await res.json();
        if (!res.ok) {
          setErrorMessage((data as any).error || 'Gagal memproses file CSV.');
          setPreview(null);
        } else {
          setPreview(data);
          if (!data.isValid && data.validationErrors?.length) {
            setErrorMessage(data.validationErrors.join('; '));
          }
        }
      } catch (err: any) {
        setErrorMessage(err?.message || 'Gagal menghubungi server.');
      } finally {
        setIsLoadingPreview(false);
      }
    };

    reader.onerror = () => {
      setErrorMessage('Gagal membaca file.');
      setIsLoadingPreview(false);
    };

    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    if (!preview || !preview.isValid || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/phrases/g1g11/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName,
          csvContent,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Gagal melakukan transaksi impor CSV.');
        return;
      }

      onImportSuccess({
        importRecord: data.importRecord,
        affectedCategories: data.importRecord.affectedCategories,
      });
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRollbackImport = async (importId: string) => {
    if (rollingBackId) return;
    setRollingBackId(importId);

    try {
      const res = await fetch('/api/phrases/g1g11/rollback-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importId }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Gagal membatalkan transaksi.');
      } else {
        await fetchHistory();
        onImportSuccess({
          importRecord: { importId } as any,
          affectedCategories: [],
        });
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Terjadi kesalahan saat rollback.');
    } finally {
      setRollingBackId(null);
    }
  };

  const filteredPreviewRows = preview
    ? preview.rows.filter((r) =>
        rowStatusFilter === 'ALL' ? true : r.action === rowStatusFilter
      )
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl bg-[#0f172a] border border-slate-700/80 rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-slate-100">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#1e293b]/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-slate-100">
                  Universal CSV Phrase Importer (G2–G11)
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-700/60 text-emerald-300">
                  Selective Upsert
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Pembaruan hanya pada kategori yang terdapat dalam file CSV; kategori lain 100% utuh
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('UPLOAD')}
                className={`px-3 py-1 rounded-md transition font-medium ${
                  activeTab === 'UPLOAD'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Impor CSV
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('HISTORY')}
                className={`px-3 py-1 rounded-md transition font-medium flex items-center gap-1.5 ${
                  activeTab === 'HISTORY'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Riwayat ({historyLogs.length})</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body Modal */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'UPLOAD' ? (
            <>
              {/* Petunjuk Format Standar Universal */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3.5 text-xs text-slate-300 space-y-1.5">
                <div className="flex items-center gap-2 font-medium text-slate-200">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Format Kolom Universal CSV (RFC-4180):</span>
                </div>
                <div className="bg-slate-950 px-3 py-1.5 rounded font-mono text-[11px] text-indigo-300 overflow-x-auto whitespace-nowrap border border-slate-800/80">
                  phrase_id, Kategori, Frasa, Fungsi Kategori, Makna Kontekstual, Konteks Penggunaan, Saran Penggunaan, Aturan Penggunaan
                </div>
                <p className="text-[11px] text-slate-400">
                  * <strong>Kategori</strong> (misal: "G3" atau "G3_AJAKAN_MASUK") & <strong>Frasa</strong> wajib diisi. Kolom <strong>phrase_id</strong> opsional untuk memperbarui (upsert) frasa yang sudah terdaftar.
                </p>
              </div>

              {/* Upload Input Area */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700/80 hover:border-indigo-500/80 rounded-xl p-6 text-center cursor-pointer transition bg-slate-950/40 hover:bg-slate-950/80"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Upload className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
                <div className="text-sm font-semibold text-slate-200">
                  {fileName ? fileName : 'Pilih atau Tarik File CSV ke Sini'}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Mendukung UTF-8, tanda kutip dua, koma di dalam teks, dan karakter khusus
                </p>
              </div>

              {/* Status Loading */}
              {isLoadingPreview && (
                <div className="text-center py-4 text-xs text-indigo-300 animate-pulse">
                  Menganalisis isi CSV dan memverifikasi duplikasi...
                </div>
              )}

              {/* Error Box */}
              {errorMessage && (
                <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-xs text-rose-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Hasil Pratinjau Interaktif */}
              {preview && (
                <div className="space-y-4 pt-2">
                  {/* Status Selective Category Synchronization (Section B) */}
                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
                    <div className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                      Sinkronisasi Kategori Selektif (Additive Merge):
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      {/* Kategori yang diperbarui */}
                      <div className="p-3 bg-indigo-950/30 border border-indigo-700/40 rounded-lg space-y-1.5">
                        <span className="font-semibold text-indigo-300 flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5" /> Kategori yang Diperbarui ({preview.affectedCategories.length}):
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {preview.affectedCategories.length > 0 ? (
                            preview.affectedCategories.map((c) => (
                              <span
                                key={c}
                                className="px-2 py-0.5 rounded bg-indigo-900/60 border border-indigo-600/50 text-indigo-200 font-mono text-[11px]"
                              >
                                {c.split('_')[0]} ({c})
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-500 italic">Tidak ada</span>
                          )}
                        </div>
                      </div>

                      {/* Kategori yang dipertahankan 100% utuh */}
                      <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1.5">
                        <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Kategori Tetap Utuh ({preview.untouchedCategories.length}):
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {preview.untouchedCategories.map((c) => (
                            <span
                              key={c}
                              className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 font-mono text-[11px]"
                            >
                              {c.split('_')[0]}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Ringkasan Angka Metrik */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800 text-center text-xs">
                      <div className="bg-emerald-950/30 border border-emerald-800/40 p-2.5 rounded-lg">
                        <div className="text-[10px] text-emerald-400 font-medium">Frasa Baru</div>
                        <div className="text-base font-bold text-emerald-300 font-mono">
                          +{preview.newPhrasesCount}
                        </div>
                      </div>
                      <div className="bg-amber-950/30 border border-amber-800/40 p-2.5 rounded-lg">
                        <div className="text-[10px] text-amber-400 font-medium">Diperbarui (ID)</div>
                        <div className="text-base font-bold text-amber-300 font-mono">
                          {preview.updatedPhrasesCount}
                        </div>
                      </div>
                      <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-lg">
                        <div className="text-[10px] text-slate-400 font-medium">Duplikat Dilewati</div>
                        <div className="text-base font-bold text-slate-400 font-mono">
                          {preview.duplicatesCount}
                        </div>
                      </div>
                      <div className="bg-rose-950/20 border border-rose-900/30 p-2.5 rounded-lg">
                        <div className="text-[10px] text-rose-400 font-medium">Ditolak / Invalid</div>
                        <div className="text-base font-bold text-rose-300 font-mono">
                          {preview.invalidCount}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Filter & Tabel Pratinjau Baris */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-300">
                        Pratinjau Data ({filteredPreviewRows.length} dari {preview.rows.length} baris):
                      </span>
                      <div className="flex gap-1">
                        {(['ALL', 'NEW', 'UPDATE', 'DUPLICATE', 'INVALID'] as const).map(
                          (status) => (
                            <button
                              key={status}
                              type="button"
                              onClick={() => setRowStatusFilter(status)}
                              className={`px-2 py-0.5 rounded text-[11px] font-mono transition ${
                                rowStatusFilter === status
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                              }`}
                            >
                              {status === 'ALL'
                                ? 'Semua'
                                : status === 'NEW'
                                ? 'Baru'
                                : status === 'UPDATE'
                                ? 'Update'
                                : status === 'DUPLICATE'
                                ? 'Duplikat'
                                : 'Ditolak'}
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    <div className="border border-slate-800 rounded-lg overflow-x-auto max-h-56 overflow-y-auto bg-slate-950 text-xs">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-900/90 text-slate-400 sticky top-0 border-b border-slate-800 text-[11px]">
                          <tr>
                            <th className="py-2 px-3 w-12">Baris</th>
                            <th className="py-2 px-3 w-28">Kategori</th>
                            <th className="py-2 px-3">Teks Frasa</th>
                            <th className="py-2 px-3 w-24">Status</th>
                            <th className="py-2 px-3">Keterangan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-sans">
                          {filteredPreviewRows.map((row, i) => (
                            <tr key={i} className="hover:bg-slate-900/40">
                              <td className="py-2 px-3 font-mono text-slate-500 text-[11px]">
                                #{row.lineNumber}
                              </td>
                              <td className="py-2 px-3 font-mono text-[11px] text-indigo-300">
                                {row.categoryNum}
                              </td>
                              <td className="py-2 px-3 text-slate-200 font-medium">
                                {row.phraseText}
                              </td>
                              <td className="py-2 px-3">
                                {row.action === 'NEW' && (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60 text-[10px] font-mono">
                                    BARU
                                  </span>
                                )}
                                {row.action === 'UPDATE' && (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800/60 text-[10px] font-mono">
                                    UPDATE
                                  </span>
                                )}
                                {row.action === 'DUPLICATE' && (
                                  <span className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800 text-[10px] font-mono">
                                    DUPLIKAT
                                  </span>
                                )}
                                {row.action === 'INVALID' && (
                                  <span className="px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800/60 text-[10px] font-mono">
                                    DITOLAK
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-[11px] text-slate-400">
                                {row.actionReason}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* TAB RIWAYAT IMPOR (Section J) */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Catatan Transaksi Impor Universal CSV ke Backend:</span>
                <span className="font-mono">{historyLogs.length} transaksi</span>
              </div>

              {isLoadingHistory ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  Memuat riwayat transaksi...
                </div>
              ) : historyLogs.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 border border-slate-800 rounded-lg">
                  Belum ada transaksi impor CSV yang tercatat.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {historyLogs.map((log) => (
                    <div
                      key={log.importId}
                      className="p-3.5 bg-slate-900 border border-slate-800 rounded-lg text-xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-200">
                            {log.fileName}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500">
                            {new Date(log.timestamp).toLocaleString('id-ID')}
                          </span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded font-mono text-[10px] ${
                            log.status === 'ROLLED_BACK'
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          }`}
                        >
                          {log.status}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
                        <span>
                          Kategori:{' '}
                          <strong className="text-slate-200">
                            {log.affectedCategories
                              .map((c) => c.split('_')[0])
                              .join(', ') || '-'}
                          </strong>
                        </span>
                        <span>•</span>
                        <span>
                          Baru: <strong className="text-emerald-400">+{log.newPhrasesCount}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Diperbarui: <strong className="text-amber-400">{log.updatedPhrasesCount}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Duplikat Dilewati: <strong>{log.duplicatesCount}</strong>
                        </span>
                      </div>

                      {log.status !== 'ROLLED_BACK' && (
                        <div className="pt-2 border-t border-slate-800/80 flex justify-end">
                          <button
                            type="button"
                            disabled={rollingBackId === log.importId}
                            onClick={() => handleRollbackImport(log.importId)}
                            className="px-2.5 py-1 text-[11px] bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-200 rounded border border-slate-700 hover:border-rose-800 transition flex items-center gap-1.5"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>
                              {rollingBackId === log.importId
                                ? 'Membatalkan...'
                                : 'Batalkan Transaksi (Rollback)'}
                            </span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-[#1e293b]/60">
          <div className="text-xs text-slate-400">
            {activeTab === 'UPLOAD' && preview?.isValid ? (
              <span className="text-emerald-300 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Siap disimpan secara permanen ke Master Phrase Repository backend
              </span>
            ) : (
              <span>Prinsip Selective Upsert & Zero Duplicate aktif</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 text-xs text-slate-300 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition"
            >
              Tutup
            </button>

            {activeTab === 'UPLOAD' && (
              <button
                type="button"
                disabled={!preview || !preview.isValid || isSubmitting}
                onClick={handleConfirmImport}
                className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition ${
                  preview && preview.isValid && !isSubmitting
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 cursor-pointer'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                }`}
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>
                  {isSubmitting
                    ? 'Menyimpan ke Backend...'
                    : 'Konfirmasi & Simpan Permanen'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
