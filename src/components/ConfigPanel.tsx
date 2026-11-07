import React, { useRef, useState } from 'react';
import {
  GenNASConfig,
  LOCKED_CRITICAL_PERSPECTIVE,
  LOCKED_DURATION_MODE,
  LOCKED_WPM,
  StageConfig,
} from '../lib/types';
import {
  extractProtectedTokens,
  validateTextAndTokenIntegrity,
} from '../lib/validatorAndPipeline';
import { GenflowMasterFrameworkData } from '../lib/genflowMasterFramework';
import {
  Upload,
  RotateCcw,
  ShieldCheck,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Lock,
  FileCheck2,
} from 'lucide-react';
import { StoryFlowSpeedometer } from './StoryFlowSpeedometer';

interface ConfigPanelProps {
  config: GenNASConfig;
  stagePlan: { totalTargetWords: number; stages: StageConfig[] };
  hasScript?: boolean;
  onChange: (updated: Partial<GenNASConfig>) => void;
  onApplyStoryFlow?: (newWeights: number[]) => void;
  onResetWorkspace?: () => void;
  onOpenDevTools?: () => void;
  onFrameworkDetected?: (framework: GenflowMasterFrameworkData, policyResult?: any) => void;
}

export const ConfigPanel: React.FC<ConfigPanelProps> = ({
  config,
  stagePlan,
  hasScript = false,
  onChange,
  onResetWorkspace,
  onFrameworkDetected,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [uploadIsError, setUploadIsError] = useState<boolean>(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [showAllTokens, setShowAllTokens] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const outlineText = config.faktaTerverifikasi || '';
  const protectedMap = extractProtectedTokens(outlineText);
  const protectedItems = protectedMap.items;
  const integrityReport =
    protectedMap.integrity ||
    validateTextAndTokenIntegrity(outlineText, protectedMap);

  const executeResetAll = () => {
    setShowResetConfirm(false);
    setUploadedFileName('');
    setUploadStatus('');
    setUploadIsError(false);
    setShowAllTokens(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (onResetWorkspace) {
      onResetWorkspace();
    }
  };

  const handleResetButtonClick = () => {
    if (hasScript) {
      setShowResetConfirm(true);
    } else {
      executeResetAll();
    }
  };

  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i += chunkSize) {
      const sub = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(sub));
    }
    return btoa(binary);
  };

  const processUploadedFile = async (file: File) => {
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const isSupportedExt =
      lowerName.endsWith('.txt') ||
      lowerName.endsWith('.docx') ||
      lowerName.endsWith('.pdf') ||
      lowerName.endsWith('.md');

    if (!isSupportedExt) {
      setUploadIsError(true);
      setUploadStatus(
        `Format file "${file.name}" tidak didukung. Unggah dokumen .txt, .docx, atau .pdf.`
      );
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setUploadIsError(true);
      setUploadStatus('Ukuran dokumen maksimal 15 MB.');
      return;
    }

    setIsExtracting(true);
    setUploadIsError(false);
    setUploadStatus(`Mendeteksi & mengekstrak otomatis "${file.name}"...`);

    try {
      const buf = await file.arrayBuffer();
      const contentBase64 = arrayBufferToBase64(buf);

      const res = await fetch('/api/gennas/extract-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          contentBase64,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setUploadIsError(true);
        setUploadStatus(
          data.error ||
            'Gagal mengekstrak dokumen atau validasi integritas gagal.'
        );
      } else {
        setUploadIsError(false);
        setUploadStatus('');
        setUploadedFileName(file.name);
        onChange({
          faktaTerverifikasi: data.extractedText,
          topik: data.inferredTopic || '',
          konteks: LOCKED_CRITICAL_PERSPECTIVE,
          wpm: LOCKED_WPM,
          modeDurasi: LOCKED_DURATION_MODE,
        });

        // Jika terdeteksi dokumen kerangka, otomatis aktifkan dan buka modal konfirmasi
        if (onFrameworkDetected && data.masterFramework) {
          onFrameworkDetected(data.masterFramework, data.frameworkPolicyResult);
        }
      }
    } catch (err: any) {
      setUploadIsError(true);
      setUploadStatus(`Gagal membaca file: ${err?.message || 'Error'}`);
    } finally {
      setIsExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDocumentUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processUploadedFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingOver) setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processUploadedFile(file);
    }
  };

  const handleOutlineChange = (newOutline: string) => {
    onChange({
      faktaTerverifikasi: newOutline,
      topik: '',
      konteks: LOCKED_CRITICAL_PERSPECTIVE,
      wpm: LOCKED_WPM,
      modeDurasi: LOCKED_DURATION_MODE,
    });
  };

  return (
    <aside
      aria-label="Pengaturan Naskah"
      className="bg-[#111622] border border-slate-800/90 rounded-xl p-4 sm:p-5 space-y-4 h-full flex flex-col"
    >
      {/* KONTEKS & SUDUT PANDANG KRITIS (TERKUNCI PERMANEN / NON-SARA) */}
      <div className="space-y-1.5" data-testid="locked-perspective-section">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="input-konteks-locked"
            className="block text-xs font-semibold text-slate-200 uppercase tracking-wide"
          >
            Gaya Kritik
          </label>
          <span
            data-tooltip="Dikunci agar kritik tetap fokus pada logika & perilaku (Non-SARA)."
            className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 cursor-help"
          >
            <Lock className="w-3 h-3 shrink-0" />
            <span>Proteksi Aktif</span>
          </span>
        </div>
        <div
          className="relative"
          data-tooltip="Kritik menargetkan perilaku & logika, bukan identitas SARA."
        >
          <input
            id="input-konteks-locked"
            data-testid="locked-perspective-input"
            type="text"
            value={LOCKED_CRITICAL_PERSPECTIVE}
            readOnly
            disabled
            aria-readonly="true"
            className="w-full bg-slate-950/90 border border-emerald-800/60 rounded-lg px-3 py-2 pr-8 text-xs font-semibold text-emerald-300 cursor-not-allowed select-none"
          />
          <Lock className="w-3.5 h-3.5 text-emerald-400/80 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* KERANGKA NASKAH & SUMBER */}
      <div
        data-testid="kerangka-naskah-section"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`space-y-2.5 rounded-lg transition-colors ${
          isDraggingOver
            ? 'ring-2 ring-amber-400 bg-amber-500/5 p-2 -m-2'
            : ''
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label
            htmlFor="input-kerangka-naskah"
            className="block text-xs font-semibold tracking-wide text-slate-100 uppercase"
          >
            Bahan Naskah
          </label>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              data-testid="reset-workspace-button"
              data-tooltip="Hapus semua bahan dan naskah."
              onClick={handleResetButtonClick}
              className="px-2.5 py-1.5 text-xs font-medium text-rose-300 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
              <span>Hapus</span>
            </button>

            <button
              type="button"
              data-testid="upload-outline-button"
              data-tooltip="Upload dokumen (.txt, .docx, .pdf)."
              disabled={isExtracting}
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-1.5 text-xs font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/35 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {isExtracting ? 'Membaca...' : 'Pilih File'}
              </span>
            </button>
          </div>

          <input
            ref={fileInputRef}
            data-testid="upload-outline-input"
            type="file"
            accept=".txt,.docx,.pdf,.md"
            onChange={handleDocumentUpload}
            className="hidden"
            aria-label="Pilih Dokumen Bahan Naskah"
          />
        </div>

        {/* Konfirmasi Reset */}
        {showResetConfirm && (
          <div
            role="alertdialog"
            aria-label="Konfirmasi Reset Proyek"
            data-testid="reset-confirm-dialog"
            className="bg-rose-950/80 border border-rose-500/50 rounded-lg p-3 space-y-2 text-xs text-rose-100"
          >
            <p className="leading-relaxed">
              Hapus semua bahan dan naskah yang sudah dibuat?
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                data-testid="cancel-reset-button"
                onClick={() => setShowResetConfirm(false)}
                className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 font-medium cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                data-testid="confirm-reset-button"
                onClick={executeResetAll}
                className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-semibold cursor-pointer"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        )}

        {uploadedFileName && (
          <div
            data-testid="active-document-badge"
            className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs text-slate-300"
          >
            <div className="flex items-center gap-1.5 truncate">
              <FileCheck2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate font-mono text-[11px]">
                {uploadedFileName}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 shrink-0">
              Aktif
            </span>
          </div>
        )}

        {/* Textarea Kerangka */}
        <textarea
          id="input-kerangka-naskah"
          data-testid="kerangka-naskah-textarea"
          data-tooltip="Masukkan bahan naskah, data, atau fakta sumber di sini."
          rows={6}
          value={outlineText}
          onChange={(e) => handleOutlineChange(e.target.value)}
          placeholder="Tulis atau tempel bahan naskah di sini..."
          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-slate-100 leading-relaxed font-mono focus:outline-none focus:border-amber-500 transition-colors"
        />

        {uploadIsError && uploadStatus && (
          <div
            data-testid="upload-status-banner"
            className="text-xs px-2.5 py-1.5 rounded border bg-rose-950/60 border-rose-700/70 text-rose-200"
          >
            {uploadStatus}
          </div>
        )}

        {integrityReport.status === 'ERROR' && (
          <div
            data-testid="sap-integrity-error"
            className="text-xs px-2.5 py-2 rounded-lg border bg-rose-950/70 border-rose-700 text-rose-200 space-y-1"
          >
            <div className="flex items-center gap-1.5 font-semibold text-rose-300">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Integritas Dokumen Error</span>
            </div>
            <p className="text-[11px] text-rose-300/90 leading-relaxed">
              Dokumen mengandung karakter rusak. Harap unggah dokumen yang bersih.
            </p>
          </div>
        )}

        {/* SAP Protected Tokens Panel */}
        <div
          data-testid="sap-protected-tokens-panel"
          className="bg-slate-950/80 border border-slate-800/90 rounded-lg p-2.5 space-y-2"
        >
          <div className="flex items-center justify-between gap-2">
            <div
              className="flex items-center gap-1.5 text-xs"
              data-tooltip="Data atau fakta yang dikunci agar tidak diubah AI."
            >
              <ShieldCheck
                className={`w-3.5 h-3.5 shrink-0 ${
                  integrityReport.status === 'ERROR'
                    ? 'text-rose-400'
                    : 'text-emerald-400'
                }`}
              />
              <span className="font-medium text-slate-300">
                Data Terkunci
              </span>
              <span
                data-testid="sap-protected-tokens-count"
                className="font-mono text-[11px] text-slate-400 tabular-nums"
              >
                ({protectedItems.length})
              </span>
            </div>

            {protectedItems.length > 6 && (
              <button
                type="button"
                onClick={() => setShowAllTokens((prev) => !prev)}
                className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-0.5 font-medium cursor-pointer"
              >
                <span>
                  {showAllTokens
                    ? 'Ringkas'
                    : `Semua (${protectedItems.length})`}
                </span>
                {showAllTokens ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>
            )}
          </div>

          {protectedItems.length > 0 ? (
            <ul
              data-testid="sap-protected-tokens-list"
              className={`space-y-1 pr-1 ${
                showAllTokens || protectedItems.length > 6
                  ? 'max-h-40 overflow-y-auto'
                  : ''
              }`}
            >
              {(showAllTokens
                ? protectedItems
                : protectedItems.slice(0, 6)
              ).map((item, idx) => (
                <li
                  key={`${item.value}-${idx}`}
                  data-testid="sap-protected-token-item"
                  className="flex items-center justify-between gap-2 text-xs py-1 px-2 rounded bg-slate-900/70 border border-slate-800/70"
                >
                  <span className="font-mono text-slate-100 tabular-nums break-all">
                    {item.value}
                    <span className="text-slate-500"> — </span>
                    <span className="font-sans text-amber-300/90">
                      {item.category}
                    </span>
                  </span>
                  {item.count > 1 && (
                    <span className="text-[10px] font-mono text-slate-400 tabular-nums shrink-0">
                      {item.count}×
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-slate-500">
              Belum ada data penting terdeteksi.
            </p>
          )}

          {protectedMap.referenceMetadata &&
            protectedMap.referenceMetadata.filter(
              (r) => r.category !== 'Label Referensi'
            ).length > 0 && (
              <div
                data-testid="isolated-reference-metadata-panel"
                className="mt-2 pt-2 border-t border-slate-800/80 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Referensi Khusus ({
                      protectedMap.referenceMetadata.filter(
                        (r) => r.category !== 'Label Referensi'
                      ).length
                    })
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/25">
                    DIABAIKAN AI
                  </span>
                </div>
                <ul
                  data-testid="isolated-reference-metadata-list"
                  className="space-y-1 max-h-24 overflow-y-auto pr-1"
                >
                  {protectedMap.referenceMetadata
                    .filter((r) => r.category !== 'Label Referensi')
                    .map((ref, idx) => (
                      <li
                        key={`${ref.value}-${idx}`}
                        data-testid="isolated-reference-metadata-item"
                        className="flex items-center justify-between gap-2 text-[11px] py-1 px-2 rounded bg-slate-950/80 border border-slate-800/60 text-slate-400"
                      >
                        <span className="font-mono break-all line-through decoration-rose-500/50">
                          {ref.value}
                        </span>
                        <span className="text-[10px] font-sans text-rose-300/80 shrink-0">
                          {ref.category}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            )}
        </div>
      </div>

      {/* SPEEDOMETER INTERAKTIF DURASI & STORYFLOW (apply-storyflow-button: Ubah pembagian bobot) */}
      <StoryFlowSpeedometer
        durationMinutes={config.durasiMenit}
        wpm={config.wpm}
        stagePlan={stagePlan}
        onDurationChange={(newDuration) => onChange({ durasiMenit: newDuration })}
        onStructureChange={(newStruktur) => onChange({ struktur: newStruktur })}
      />
    </aside>
  );
};
