import React, { useState, useEffect } from 'react';
import {
  X,
  Edit3,
  AlertTriangle,
  CheckCircle2,
  History,
  RotateCcw,
  Save,
  Lock,
  Sparkles,
} from 'lucide-react';
import {
  G1G11PhraseRecord,
  validatePhraseSemanticAlignment,
  PhraseSemanticAlignmentCheck,
} from '../lib/g1g11PhraseRepository';

interface LivePhraseEditorModalProps {
  isOpen: boolean;
  phrase: G1G11PhraseRecord | null;
  onClose: () => void;
  onSaveSuccess: (updatedRecord: G1G11PhraseRecord) => void;
}

export const LivePhraseEditorModal: React.FC<LivePhraseEditorModalProps> = ({
  isOpen,
  phrase,
  onClose,
  onSaveSuccess,
}) => {
  const [editText, setEditText] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmedOverride, setConfirmedOverride] = useState(false);
  const [alignmentCheck, setAlignmentCheck] = useState<PhraseSemanticAlignmentCheck>({
    isAligned: true,
    requiresConfirmation: false,
  });
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (phrase) {
      setEditText(phrase.currentText);
      setNote('');
      setErrorMessage(null);
      setConfirmedOverride(false);
      setShowHistory(false);
      const check = validatePhraseSemanticAlignment(phrase.categoryCode, phrase.currentText);
      setAlignmentCheck(check);
    }
  }, [phrase]);

  // Validasi real-time saat teks berubah
  const handleTextChange = (val: string) => {
    setEditText(val);
    setConfirmedOverride(false);
    if (phrase) {
      const check = validatePhraseSemanticAlignment(phrase.categoryCode, val);
      setAlignmentCheck(check);
    }
  };

  if (!isOpen || !phrase) return null;

  const isTextUnchanged = editText.trim() === phrase.currentText.trim();
  const hasWarning = !alignmentCheck.isAligned && alignmentCheck.requiresConfirmation;
  const canSave = editText.trim().length >= 3 && !isTextUnchanged && (!hasWarning || confirmedOverride);

  const handleSave = async () => {
    if (!canSave || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/phrases/g1g11/${encodeURIComponent(phrase.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newText: editText.trim(),
          note: note.trim() || undefined,
          confirmOverride: confirmedOverride,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.requiresConfirmation) {
          setAlignmentCheck({
            isAligned: false,
            warning: data.warning,
            requiresConfirmation: true,
          });
          setErrorMessage(data.message || 'Konfirmasi diperlukan sebelum menyimpan.');
        } else {
          setErrorMessage(data.error || 'Gagal menyimpan perubahan frasa.');
        }
        return;
      }

      onSaveSuccess(data.updatedRecord);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRollback = async (targetVersion: number) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/phrases/g1g11/${encodeURIComponent(phrase.id)}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetVersion,
          note: `Rollback ke v${targetVersion} dari modal editor`,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Gagal melakukan rollback.');
        return;
      }

      onSaveSuccess(data.rolledBackRecord);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetToOriginal = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/phrases/g1g11/${encodeURIComponent(phrase.id)}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Gagal mereset frasa ke bawaan.');
        return;
      }

      onSaveSuccess(data.record);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-[#0f172a] border border-slate-700/80 rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-slate-100">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#1e293b]/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-slate-100">
                  Edit Frasa Naratif (Content-Only Update)
                </h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-950/80 border border-indigo-700/60 text-indigo-300">
                  v{phrase.version}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Memperbarui redaksi teks tanpa mengubah struktur atau aturan bank G1–G11
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {/* Metadata Struktural Terkunci (Read-Only) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5 font-medium text-slate-300">
                <Lock className="w-3.5 h-3.5 text-amber-400/80" /> Metadata Terkunci
                (Permanen)
              </span>
              <span className="font-mono text-slate-400 text-[11px]">{phrase.id}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-950/60 p-2 rounded border border-slate-800/80">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">
                  Kategori
                </div>
                <div className="font-medium text-slate-200 mt-0.5">
                  {phrase.categoryLabel}
                </div>
              </div>
              <div className="bg-slate-950/60 p-2 rounded border border-slate-800/80">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">
                  Aturan Pengendali
                </div>
                <div className="font-medium text-emerald-400 mt-0.5">
                  G1 (Rotasi, Lisan, Non-Forcing)
                </div>
              </div>
            </div>
            <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800/80 text-xs">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-0.5">
                Fungsi Semantik Asli
              </span>
              <p className="text-slate-300 leading-relaxed text-xs">
                {phrase.semanticFunction}
              </p>
            </div>
          </div>

          {/* Form Input Teks Frasa (CONTENT-ONLY) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-200">
              Teks Redaksi Frasa (Aktif Digunakan Mesin Narasi):
            </label>
            <textarea
              rows={3}
              value={editText}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder="Masukkan redaksi frasa..."
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700/80 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition font-sans"
            />
          </div>

          {/* Indikator Validasi Keselarasan Fungsi Semantik (Ketentuan 14) */}
          {hasWarning ? (
            <div className="bg-amber-950/40 border border-amber-600/50 rounded-lg p-3.5 space-y-2.5 text-xs">
              <div className="flex items-start gap-2.5 text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold text-amber-200">
                    Peringatan Keselarasan Fungsi Semantik
                  </div>
                  <p className="text-amber-300/90 leading-relaxed">
                    {alignmentCheck.warning}
                  </p>
                </div>
              </div>
              <label className="flex items-center gap-2 pt-1.5 border-t border-amber-800/40 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={confirmedOverride}
                  onChange={(e) => setConfirmedOverride(e.target.checked)}
                  className="rounded border-amber-600 text-indigo-600 focus:ring-indigo-500 bg-slate-900 w-4 h-4"
                />
                <span className="text-amber-200 font-medium text-xs">
                  Saya memahami fungsi kategori ini dan ingin tetap menyimpan teks ini
                </span>
              </label>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-950/30 border border-emerald-700/40 rounded-lg text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Teks selaras dengan fungsi kategori {phrase.categoryNum}.</span>
            </div>
          )}

          {/* Catatan Pembaruan (Opsional) */}
          <div className="space-y-1">
            <label className="block text-[11px] text-slate-400">
              Catatan Pembaruan (Opsional):
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Contoh: Menyesuaikan intonasi percakapan santai"
              className="w-full px-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-md text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-xs text-rose-300">
              {errorMessage}
            </div>
          )}

          {/* Riwayat Versi (Accordion) (Ketentuan 12) */}
          <div className="border border-slate-800 rounded-lg bg-slate-950/60 overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 text-left text-slate-300 hover:bg-slate-900/60 transition"
            >
              <span className="flex items-center gap-2 font-medium">
                <History className="w-3.5 h-3.5 text-indigo-400" /> Riwayat Versi (
                {phrase.history.length + 1} versi)
              </span>
              <span className="text-[11px] text-slate-500">
                {showHistory ? 'Sembunyikan' : 'Tampilkan Riwayat'}
              </span>
            </button>

            {showHistory && (
              <div className="p-3 border-t border-slate-800/80 space-y-2 bg-slate-900/30">
                {/* Versi Sekarang */}
                <div className="p-2.5 bg-indigo-950/30 border border-indigo-700/40 rounded flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-indigo-300">
                        v{phrase.version} (Aktif)
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(phrase.updatedAt).toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div className="text-slate-200 italic">"{phrase.currentText}"</div>
                  </div>
                </div>

                {/* Versi-Versi Terdahulu */}
                {phrase.history.length > 0 ? (
                  phrase.history
                    .slice()
                    .reverse()
                    .map((h, i) => (
                      <div
                        key={i}
                        className="p-2.5 bg-slate-950 border border-slate-800 rounded flex items-start justify-between gap-2"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-400">
                              v{h.version}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {new Date(h.changedAt).toLocaleString('id-ID')}
                            </span>
                          </div>
                          <div className="text-slate-300 italic">"{h.text}"</div>
                          {h.note && (
                            <div className="text-[11px] text-slate-500">
                              Catatan: {h.note}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => handleRollback(h.version)}
                          className="px-2.5 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition flex items-center gap-1 shrink-0"
                        >
                          <RotateCcw className="w-3 h-3" /> Pulihkan
                        </button>
                      </div>
                    ))
                ) : (
                  <div className="text-slate-500 text-center py-2 text-xs">
                    Belum ada riwayat editan sebelumnya.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-800 bg-[#1e293b]/40">
          <div>
            {phrase.version > 1 || phrase.currentText !== phrase.originalText ? (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleResetToOriginal}
                className="px-3 py-1.5 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-950/40 rounded transition flex items-center gap-1.5 border border-amber-800/60"
              >
                <Sparkles className="w-3.5 h-3.5" /> Reset ke Bawaan
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 text-xs text-slate-300 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={!canSave || isSubmitting}
              onClick={handleSave}
              className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition ${
                canSave && !isSubmitting
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
