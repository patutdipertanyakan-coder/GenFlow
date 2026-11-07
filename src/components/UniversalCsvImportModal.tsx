/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * MODAL IMPORT CSV UNIVERSAL 7 KOLOM DENGAN PRATINJAU INTERAKTIF
 * 
 * Mendukung 7 Kolom Baku:
 * Kata,Kategori,Padanan Formal,Fungsi Kata,Makna Kontekstual,Saran,Aturan Penggunaan
 */

import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Info,
  ShieldAlert,
} from 'lucide-react';
import {
  parseUniversalCsvWithPreview,
  UniversalCsvPreviewResult,
  UniversalCsvRow,
} from '../lib/universalCsvParser';

interface UniversalCsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (result: {
    importedCount: number;
    duplicatesCount: number;
    fileName: string;
  }) => void;
  existingKeys?: Set<string>;
  tombstoneKeys?: Set<string>;
  targetMenuName?: 'Repository' | 'MONITORING CATATAN';
}

export const UniversalCsvImportModal: React.FC<UniversalCsvImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
  existingKeys = new Set(),
  tombstoneKeys = new Set(),
  targetMenuName = 'Repository',
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState<string>('');
  const [preview, setPreview] = useState<UniversalCsvPreviewResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const fetchLiveKeysAndParse = async (fileText: string) => {
    let activeKeysSet = new Set<string>(existingKeys);
    let tombSet = new Set<string>(tombstoneKeys);

    try {
      const [resReg, resStats] = await Promise.all([
        fetch('/api/lexicon/master-registry'),
        fetch('/api/lexicon/master-stats'),
      ]);

      if (resReg.ok) {
        const regData = await resReg.json();
        if (Array.isArray(regData.entries)) {
          regData.entries.forEach((e: any) => {
            if (e.canonicalKey) activeKeysSet.add(e.canonicalKey);
            if (e.word) activeKeysSet.add(e.word.toLowerCase());
          });
        }
      }

      if (resStats.ok) {
        const statsData = await resStats.json();
        if (Array.isArray(statsData.stored_datasets)) {
          // Add extra datasets keys if any
        }
      }
    } catch (err) {
      console.warn('Fallback to prop keys:', err);
    }

    return parseUniversalCsvWithPreview(fileText, activeKeysSet, tombSet);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      setErrorMessage('Hanya menerima format file CSV (.csv) berstandar UTF-8.');
      return;
    }

    setErrorMessage(null);
    setSelectedFile(file);

    try {
      const text = await file.text();
      setRawText(text);
      const parsedPreview = await fetchLiveKeysAndParse(text);
      setPreview(parsedPreview);
    } catch (err: any) {
      setErrorMessage(`Gagal membaca file: ${err?.message || 'Format tidak valid'}`);
      setPreview(null);
    }
  };

  const handleConfirmImport = async () => {
    if (!preview || preview.validRows.length === 0 || !selectedFile) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/lexicon/import-universal-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: selectedFile.name.replace(/\.[^/.]+$/, ''),
          fileName: selectedFile.name,
          rawContent: rawText,
          rows: preview.validRows,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || 'Gagal menyimpan ke Master Data.');
      }

      onImportSuccess({
        importedCount: data.entries_imported ?? preview.validRows.length,
        duplicatesCount: data.total_duplicates ?? preview.duplicatesCount,
        fileName: selectedFile.name,
      });
      handleClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan saat mengimpor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setRawText('');
    setPreview(null);
    setErrorMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
    >
      <div className="bg-[#0f172a] border border-slate-700/80 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">
                Import CSV Universal (7 Kolom Tetap)
              </h3>
              <p className="text-xs text-slate-400">
                Master Data terpusat — Diimpor melalui {targetMenuName} & langsung tersinkron ke seluruh sistem.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Isi Modal */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Format Kolom Info Banner */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
              <Info className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>Format 7 Kolom Wajib CSV Universal (RFC-4180):</span>
            </div>
            <div className="text-[11px] font-mono text-slate-300 bg-slate-900/90 p-2 rounded border border-slate-800 overflow-x-auto">
              Kata,Kategori,Padanan Formal,Fungsi Kata,Makna Kontekstual,Saran,Aturan Penggunaan
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Mendukung tanda kutip ganda untuk koma di dalam kalimat, variasi morfologi yang berbeda fungsi gramatikal, serta encoding UTF-8.
            </p>
          </div>

          {/* Area Pemilih Berkas (File Picker) */}
          {!selectedFile ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-emerald-500/60 rounded-xl p-8 text-center cursor-pointer bg-slate-950/40 hover:bg-slate-900/40 transition-all space-y-3 group"
            >
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-12 h-12 mx-auto rounded-full bg-slate-800/80 group-hover:bg-emerald-500/20 text-slate-400 group-hover:text-emerald-300 flex items-center justify-center transition-colors">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200">
                  Klik untuk memilih file CSV
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Format .csv dengan pemisah koma atau titik koma (UTF-8)
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400 shrink-0" />
                <div className="truncate">
                  <div className="text-xs font-mono font-semibold text-slate-200 truncate">
                    {selectedFile.name}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  setPreview(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="text-xs text-slate-400 hover:text-rose-400 px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors"
              >
                Ganti File
              </button>
            </div>
          )}

          {/* Pesan Error */}
          {errorMessage && (
            <div className="p-3.5 rounded-lg border border-rose-500/40 bg-rose-950/30 text-rose-200 text-xs flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Hasil Pratinjau Interaktif */}
          {preview && (
            <div className="space-y-4">
              {/* Statistik Pratinjau */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="bg-slate-950 border border-slate-800 rounded p-2.5">
                  <div className="text-slate-400 font-sans text-[11px]">Total Baris</div>
                  <div className="text-sm font-bold text-slate-200 mt-0.5">{preview.totalRows} baris</div>
                </div>
                <div className="bg-slate-950 border border-emerald-500/30 rounded p-2.5">
                  <div className="text-emerald-400 font-sans text-[11px]">Valid Siap Impor</div>
                  <div className="text-sm font-bold text-emerald-300 mt-0.5">{preview.validRows.length} entri baru</div>
                </div>
                <div className="bg-slate-950 border border-amber-500/30 rounded p-2.5">
                  <div className="text-amber-400 font-sans text-[11px]">Duplikat Terdeteksi</div>
                  <div className="text-sm font-bold text-amber-300 mt-0.5">{preview.duplicatesCount} disaring</div>
                </div>
                <div className="bg-slate-950 border border-rose-500/30 rounded p-2.5">
                  <div className="text-rose-400 font-sans text-[11px]">Daftar Hitam (Tombstone)</div>
                  <div className="text-sm font-bold text-rose-300 mt-0.5">{preview.tombstoneDuplicatesCount} ditolak</div>
                </div>
              </div>

              {/* Tabel Pratinjau 5 Baris Pertama */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Pratinjau Data (Sampel {preview.sampleRows.length} Baris Pertama):</span>
                  <span className="text-[11px] text-slate-400 font-mono font-normal">
                    Format 7 Kolom Terpetakan
                  </span>
                </div>
                <div className="border border-slate-800 rounded-lg overflow-x-auto max-h-64">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-900/90 text-slate-400 font-mono text-[11px] sticky top-0 border-b border-slate-800">
                      <tr>
                        <th className="py-2 px-3">Kata</th>
                        <th className="py-2 px-3">Kategori</th>
                        <th className="py-2 px-3">Padanan Formal</th>
                        <th className="py-2 px-3">Fungsi Kata</th>
                        <th className="py-2 px-3">Makna Kontekstual</th>
                        <th className="py-2 px-3">Saran</th>
                        <th className="py-2 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 font-sans text-slate-200">
                      {preview.sampleRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/40">
                          <td className="py-2 px-3 font-mono font-bold text-emerald-300 whitespace-nowrap">
                            {row.kata}
                          </td>
                          <td className="py-2 px-3 text-slate-300 text-[11px] whitespace-nowrap">
                            {row.kategori}
                          </td>
                          <td className="py-2 px-3 text-cyan-300 font-mono text-[11px] whitespace-nowrap">
                            {row.padananFormal || '-'}
                          </td>
                          <td className="py-2 px-3 text-slate-400 text-[11px] whitespace-nowrap">
                            {row.fungsiKata}
                          </td>
                          <td className="py-2 px-3 text-slate-300 text-[11px] min-w-[160px] max-w-xs truncate">
                            {row.maknaKontekstual}
                          </td>
                          <td className="py-2 px-3 text-amber-300 font-mono text-[11px] whitespace-nowrap">
                            {row.saran || '-'}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span
                              className={`text-[10px] font-mono px-1.5 py-0.5 rounded border font-semibold ${
                                row.inferredStatus === 'ALLOW'
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                  : row.inferredStatus === 'CONDITIONAL'
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                  : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                              }`}
                            >
                              {row.inferredStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Tombol Aksi */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/60">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            Batal
          </button>

          <button
            type="button"
            data-testid="confirm-universal-csv-import-btn"
            disabled={!preview || preview.validRows.length === 0 || isSubmitting}
            onClick={handleConfirmImport}
            className="px-5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50 border border-emerald-400"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>
                  Memproses Impor: {preview?.validRows.length || 0} Ditambahkan VS {preview ? preview.duplicatesCount + preview.tombstoneDuplicatesCount : 0} Ditolak Duplikat...
                </span>
              </span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Konfirmasi & Simpan ke Master Data</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
