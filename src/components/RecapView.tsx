/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  FileText,
  Edit3,
  Sparkles,
  Search,
  Copy,
  Download,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Zap,
  Sliders,
  Type,
  X,
  Check,
} from 'lucide-react';
import { GenNASConfig, FullScriptAudit, WorkflowEngineState } from '../lib/types';
import { masterLexiconRepository } from '../lib/masterLexiconRepository';
import { exportCleanScriptTxt, exportScriptDocx } from '../lib/exportUtils';
import { compileVoiceScript } from '../lib/validatorAndPipeline';

export interface RecapViewProps {
  cleanScript: string;
  config: GenNASConfig;
  audit: FullScriptAudit;
  workflowState: WorkflowEngineState;
  onScriptChange: (newScript: string) => void;
  onBackToStudio: () => void;
}

type ActiveRecapTool = 'EDIT_KOSAKATA' | 'GENERATE_KOSAKATA' | 'CARI_KOSAKATA' | null;

export function RecapView({
  cleanScript,
  config,
  audit,
  workflowState,
  onScriptChange,
  onBackToStudio,
}: RecapViewProps) {
  const [activeTool, setActiveTool] = useState<ActiveRecapTool>(null);
  const [copied, setCopied] = useState(false);

  // State untuk Tool 1: Edit Kosakata (Find & Replace)
  const [findWord, setFindWord] = useState('');
  const [replaceWord, setReplaceWord] = useState('');
  const [replaceCountMessage, setReplaceCountMessage] = useState('');

  // State untuk Tool 2: Generate Kosakata (AI Candidate Generator)
  const [targetWordForGen, setTargetWordForGen] = useState('');
  const [genCandidates, setGenCandidates] = useState<Array<{ word: string; category: string; note: string }>>([]);
  const [isGeneratingCandidates, setIsGeneratingCandidates] = useState(false);

  // State untuk Tool 3: Cari Kosakata (Master Lexicon Registry Lookup & Highlight)
  const [searchLexiconQuery, setSearchLexiconQuery] = useState('');

  const wordCount = useMemo(() => {
    return cleanScript.trim() ? cleanScript.trim().split(/\s+/).length : 0;
  }, [cleanScript]);

  const estimatedDuration = useMemo(() => {
    return (wordCount / (config.wpm || 135)).toFixed(1);
  }, [wordCount, config.wpm]);

  // Handle Copy Full Script
  const handleCopyScript = async () => {
    if (!cleanScript) return;
    try {
      await navigator.clipboard.writeText(cleanScript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  // Handle Tool 1: Find & Replace
  const handleExecuteReplace = () => {
    if (!findWord.trim()) return;
    const regex = new RegExp(findWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = cleanScript.match(regex);
    const count = matches ? matches.length : 0;

    if (count === 0) {
      setReplaceCountMessage(`Kata "${findWord}" tidak ditemukan dalam naskah.`);
      return;
    }

    const updated = cleanScript.replace(regex, replaceWord);
    onScriptChange(updated);
    setReplaceCountMessage(`Berhasil mengganti ${count} kata "${findWord}" menjadi "${replaceWord}".`);
  };

  // Handle Tool 2: Generate Contextual AI Candidates
  const handleGenerateCandidates = async () => {
    if (!targetWordForGen.trim()) return;
    setIsGeneratingCandidates(true);
    setGenCandidates([]);

    try {
      const res = await fetch('/api/lexicon/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: config.topik || 'Persoalan Masyarakat',
          stageId: 4,
          limit: 8,
          coreFocus: targetWordForGen,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.candidates && Array.isArray(data.candidates)) {
          setGenCandidates(
            data.candidates.map((c: any) => ({
              word: c.word,
              category: c.categoryLabel || c.category || 'Kosakata Lisan',
              note: c.rationale || c.contextNote || 'Rekomendasi kontekstual AI',
            }))
          );
        }
      }
    } catch {
      // Fallback lokal padanan lisan/informal
      setGenCandidates([
        { word: 'ngebahas', category: 'Verba Lisan F5', note: 'Pengganti formal mendiskusikan/membahas' },
        { word: 'nunjukin', category: 'Verba Lisan F2', note: 'Pengganti formal menunjukkan' },
        { word: 'ngelihat', category: 'Verba Lisan F3', note: 'Pengganti formal melihat' },
        { word: 'ngupas', category: 'Verba Lisan F3', note: 'Pengganti formal mengulas' },
        { word: 'bikin', category: 'Verba Lisan F5', note: 'Pengganti formal membuat' },
        { word: 'ngasih', category: 'Verba Lisan F5', note: 'Pengganti formal memberikan' },
      ]);
    } finally {
      setIsGeneratingCandidates(false);
    }
  };

  // Kamus Pemetaan Kata Formal -> Lisan / Informal (Gue-Lo)
  const FORMAL_TO_INFORMAL_MAP: Array<{ formalRegex: RegExp; formalLabel: string; informalReplacement: string }> = useMemo(() => [
    { formalRegex: /\bSaya\b/g, formalLabel: 'Saya', informalReplacement: 'Gue' },
    { formalRegex: /\bsaya\b/g, formalLabel: 'saya', informalReplacement: 'gue' },
    { formalRegex: /\bAnda\b/g, formalLabel: 'Anda', informalReplacement: 'lo' },
    { formalRegex: /\banda\b/g, formalLabel: 'anda', informalReplacement: 'lo' },
    { formalRegex: /\bmelihat\b/gi, formalLabel: 'melihat', informalReplacement: 'ngelihat' },
    { formalRegex: /\bmembahas\b/gi, formalLabel: 'membahas', informalReplacement: 'ngebahas' },
    { formalRegex: /\bmembicarakan\b/gi, formalLabel: 'membicarakan', informalReplacement: 'ngomongin' },
    { formalRegex: /\bmenunjukkan\b/gi, formalLabel: 'menunjukkan', informalReplacement: 'nunjukin' },
    { formalRegex: /\bmembuat\b/gi, formalLabel: 'membuat', informalReplacement: 'bikin' },
    { formalRegex: /\bmemberikan\b/gi, formalLabel: 'memberikan', informalReplacement: 'ngasih' },
    { formalRegex: /\bmengurus\b/gi, formalLabel: 'mengurus', informalReplacement: 'ngurusin' },
    { formalRegex: /\bmengeluh\b/gi, formalLabel: 'mengeluh', informalReplacement: 'ngomel' },
    { formalRegex: /\bmenggunakan\b/gi, formalLabel: 'menggunakan', informalReplacement: 'pake' },
    { formalRegex: /\bmemikirkan\b/gi, formalLabel: 'memikirkan', informalReplacement: 'mikirin' },
    { formalRegex: /\bmenyusun\b/gi, formalLabel: 'menyusun', informalReplacement: 'nyusun' },
    { formalRegex: /\bmencari\b/gi, formalLabel: 'mencari', informalReplacement: 'nyari' },
    { formalRegex: /\bmenjawab\b/gi, formalLabel: 'menjawab', informalReplacement: 'nyaut' },
    { formalRegex: /\btidak\b/gi, formalLabel: 'tidak', informalReplacement: 'nggak' },
    { formalRegex: /\bsudah\b/gi, formalLabel: 'sudah', informalReplacement: 'udah' },
    { formalRegex: /\bmemang\b/gi, formalLabel: 'memang', informalReplacement: 'emang' },
    { formalRegex: /\bseperti\b/gi, formalLabel: 'seperti', informalReplacement: 'kayak' },
    { formalRegex: /\bkarena\b/gi, formalLabel: 'karena', informalReplacement: 'soalnya' },
    { formalRegex: /\bjustru\b/gi, formalLabel: 'justru', informalReplacement: 'malah' },
    { formalRegex: /\btetapi\b/gi, formalLabel: 'tetapi', informalReplacement: 'tapi' },
    { formalRegex: /\bapabila\b/gi, formalLabel: 'apabila', informalReplacement: 'kalau' },
    { formalRegex: /\bjika\b/gi, formalLabel: 'jika', informalReplacement: 'kalau' },
    { formalRegex: /\bhanya\b/gi, formalLabel: 'hanya', informalReplacement: 'cuma' },
  ], []);

  // Pemindaian Otomatis Kata Formal yang Masih Tersisa di Naskah
  const detectedFormalWords = useMemo(() => {
    if (!cleanScript.trim()) return [];
    const results: Array<{ formal: string; informal: string; count: number }> = [];

    FORMAL_TO_INFORMAL_MAP.forEach((item) => {
      const matches = cleanScript.match(item.formalRegex);
      if (matches && matches.length > 0) {
        results.push({
          formal: item.formalLabel,
          informal: item.informalReplacement,
          count: matches.length,
        });
      }
    });

    return results;
  }, [cleanScript, FORMAL_TO_INFORMAL_MAP]);

  // Handle 1-Click Batch Convert All Formal Words to Informal
  const handleConvertAllFormalToInformal = () => {
    if (!cleanScript.trim() || detectedFormalWords.length === 0) return;
    let updated = cleanScript;
    let totalCount = 0;

    FORMAL_TO_INFORMAL_MAP.forEach((item) => {
      const matches = updated.match(item.formalRegex);
      if (matches) {
        totalCount += matches.length;
        updated = updated.replace(item.formalRegex, item.informalReplacement);
      }
    });

    onScriptChange(updated);
    setReplaceCountMessage(`Berhasil mengonversi ${totalCount} kata formal menjadi lisan/informal (Gue-Lo) secara serentak.`);
  };

  const handleConvertSingleFormalWord = (formalWord: string, informalWord: string) => {
    const item = FORMAL_TO_INFORMAL_MAP.find((m) => m.formalLabel.toLowerCase() === formalWord.toLowerCase());
    if (!item) return;
    const matches = cleanScript.match(item.formalRegex);
    const count = matches ? matches.length : 0;
    if (count === 0) return;

    const updated = cleanScript.replace(item.formalRegex, informalWord);
    onScriptChange(updated);
    setReplaceCountMessage(`Berhasil mengubah ${count} kata formal "${formalWord}" menjadi lisan "${informalWord}".`);
  };

  const handleApplyCandidateReplacement = (newWord: string) => {
    if (!targetWordForGen.trim()) return;
    const regex = new RegExp(targetWordForGen.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const updated = cleanScript.replace(regex, newWord);
    onScriptChange(updated);
    setReplaceCountMessage(`Berhasil mengganti "${targetWordForGen}" dengan kandidat "${newWord}".`);
  };

  // Search Results for Tool 3: Cari Kosakata
  const lexiconSearchResults = useMemo(() => {
    if (!searchLexiconQuery.trim()) return [];
    return masterLexiconRepository.getActiveRegistry({
      search: searchLexiconQuery.trim(),
    }).slice(0, 10);
  }, [searchLexiconQuery]);

  const scriptOccurrencesCount = useMemo(() => {
    if (!searchLexiconQuery.trim() || !cleanScript) return 0;
    const regex = new RegExp(searchLexiconQuery.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = cleanScript.match(regex);
    return matches ? matches.length : 0;
  }, [searchLexiconQuery, cleanScript]);

  return (
    <div className="w-full max-w-none space-y-5 text-slate-100 animate-fadeIn">
      {/* HEADER RECAP PANEL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-[#0d131f] border border-slate-800 rounded-2xl shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <FileText className="w-4 h-4" />
            </div>
            <h1 className="text-lg font-bold tracking-tight text-slate-100">
              RECAP — Naskah Jadi Terpadu
            </h1>
            <span className="px-2 py-0.5 text-[10px] font-mono font-semibold rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
              SCTF 5 BLOK
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Area teks tunggal naskah jadi dengan 3 alat kosakata lisan: Edit, Generate AI, dan Cari Registry.
          </p>
        </div>

        {/* Action Buttons: Copy & Export */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopyScript}
            disabled={!cleanScript.trim()}
            data-tooltip="Salin seluruh naskah ke clipboard."
            className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-sky-400" />
            )}
            <span>{copied ? 'Tersalin!' : 'Salin'}</span>
          </button>

          <button
            type="button"
            onClick={() => exportCleanScriptTxt(cleanScript, config.topik, { isFinalApproved: true, workflowState })}
            disabled={!cleanScript.trim()}
            data-tooltip="Unduh naskah dalam format .txt."
            className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>.TXT</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const voiceScript = compileVoiceScript(cleanScript, { enableSubtleAudioTags: false });
              exportScriptDocx(cleanScript, voiceScript, config, audit, { isFinalApproved: true, workflowState });
            }}
            disabled={!cleanScript.trim()}
            data-tooltip="Unduh naskah dalam format Microsoft Word (.docx)."
            className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-amber-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" />
            <span>.DOCX</span>
          </button>
        </div>
      </div>

      {/* METRIK KUALITAS NASKAH RECAP */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
        <div className="p-3 bg-[#0d131f] border border-slate-800 rounded-xl space-y-0.5">
          <div className="text-[11px] text-slate-400">Total Kata</div>
          <div className="text-base font-bold text-slate-100">{wordCount} kata</div>
        </div>

        <div className="p-3 bg-[#0d131f] border border-slate-800 rounded-xl space-y-0.5">
          <div className="text-[11px] text-slate-400">Estimasi Durasi (135 WPM)</div>
          <div className="text-base font-bold text-amber-300">~{estimatedDuration} mnt</div>
        </div>

        <div className="p-3 bg-[#0d131f] border border-slate-800 rounded-xl space-y-0.5">
          <div className="text-[11px] text-slate-400">Status SQNN</div>
          <div className="text-base font-bold text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            <span>Bebas Petik</span>
          </div>
        </div>

        <div className="p-3 bg-[#0d131f] border border-slate-800 rounded-xl space-y-0.5">
          <div className="text-[11px] text-slate-400">Status Alur</div>
          <div className="text-base font-bold text-sky-400">
            {workflowState.isFinalApproved ? 'FINAL DISAHKAN' : 'DRAFT / MENUNGGU'}
          </div>
        </div>
      </div>

      {/* TOOLBAR TIGA MENU PENYUNTINGAN RECAP (Edit Kosakata | Generate Kosakata | Cari Kosakata) */}
      <div className="p-4 bg-[#0d131f] border border-slate-800 rounded-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-300 mr-1">ALAT KOSAKATA:</span>

            {/* Menu 1: Edit Kosakata */}
            <button
              type="button"
              onClick={() => setActiveTool(activeTool === 'EDIT_KOSAKATA' ? null : 'EDIT_KOSAKATA')}
              data-tooltip="Cari dan ganti kata di seluruh naskah."
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTool === 'EDIT_KOSAKATA'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-md'
                  : 'bg-slate-900/80 text-slate-300 border-slate-800 hover:bg-slate-800'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5 text-amber-400" />
              <span>Edit Kosakata</span>
            </button>

            {/* Menu 2: Generate Kosakata */}
            <button
              type="button"
              onClick={() => setActiveTool(activeTool === 'GENERATE_KOSAKATA' ? null : 'GENERATE_KOSAKATA')}
              data-tooltip="Dapatkan saran padanan lisan AI & ubah kata baku ke gaya Gue–Lo."
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTool === 'GENERATE_KOSAKATA'
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 shadow-md'
                  : 'bg-slate-900/80 text-slate-300 border-slate-800 hover:bg-slate-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              <span>Generate Kosakata</span>
            </button>

            {/* Menu 3: Cari Kosakata */}
            <button
              type="button"
              onClick={() => setActiveTool(activeTool === 'CARI_KOSAKATA' ? null : 'CARI_KOSAKATA')}
              data-tooltip="Cek kata di naskah & Master Lexicon Registry."
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTool === 'CARI_KOSAKATA'
                  ? 'bg-teal-500/20 text-teal-300 border-teal-500/50 shadow-md'
                  : 'bg-slate-900/80 text-slate-300 border-slate-800 hover:bg-slate-800'
              }`}
            >
              <Search className="w-3.5 h-3.5 text-teal-400" />
              <span>Cari Kosakata</span>
            </button>
          </div>

          {activeTool && (
            <button
              type="button"
              onClick={() => setActiveTool(null)}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Tutup</span>
            </button>
          )}
        </div>

        {/* PANEL INTERAKTIF DARI MENU YANG DIPILIH */}

        {/* PANEL 1: EDIT KOSAKATA (Find & Replace) */}
        {activeTool === 'EDIT_KOSAKATA' && (
          <div className="p-4 bg-slate-900/90 border border-amber-500/30 rounded-xl space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <Edit3 className="w-4 h-4" />
                <span>EDIT KOSAKATA (Cari & Ganti)</span>
              </div>
              <span className="text-[11px] text-slate-400">Ganti kata di seluruh naskah sekaligus</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-medium text-slate-300 mb-1">Kata Asli:</label>
                <input
                  type="text"
                  value={findWord}
                  onChange={(e) => setFindWord(e.target.value)}
                  placeholder="Misal: menunjukkan / mengatakan"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Kata Pengganti:</label>
                <input
                  type="text"
                  value={replaceWord}
                  onChange={(e) => setReplaceWord(e.target.value)}
                  placeholder="Misal: nunjukin / ngomong"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500/50"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              {replaceCountMessage ? (
                <span className="text-xs text-amber-300 font-medium">{replaceCountMessage}</span>
              ) : (
                <span className="text-xs text-slate-500">Perubahan langsung diterapkan ke naskah.</span>
              )}

              <button
                type="button"
                onClick={handleExecuteReplace}
                disabled={!findWord.trim()}
                className="px-4 py-1.5 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                Ganti Sekarang
              </button>
            </div>
          </div>
        )}

        {/* PANEL 2: GENERATE KOSAKATA (AI Candidate Suggestions) */}
        {activeTool === 'GENERATE_KOSAKATA' && (
          <div className="p-4 bg-slate-900/90 border border-sky-500/30 rounded-xl space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                <span>GENERATE KOSAKATA (Saran Padanan AI)</span>
              </div>
              <span className="text-[11px] text-slate-400">Padanan lisan santai dari Master Lexicon</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={targetWordForGen}
                onChange={(e) => setTargetWordForGen(e.target.value)}
                placeholder="Ketik kata formal (mis. membahas, menguji, membuktikan)"
                className="flex-1 px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-sky-500/50"
              />
              <button
                type="button"
                onClick={handleGenerateCandidates}
                disabled={!targetWordForGen.trim() || isGeneratingCandidates}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isGeneratingCandidates ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>Cari Padanan AI</span>
              </button>
            </div>

            {genCandidates.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="text-[11px] font-semibold text-slate-300">
                  Pilih kandidat untuk mengganti &quot;{targetWordForGen}&quot;:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {genCandidates.map((cand, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyCandidateReplacement(cand.word)}
                      className="text-left p-2.5 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-sky-500/40 rounded-xl transition-all group cursor-pointer flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-bold text-slate-200 group-hover:text-sky-300">
                          {cand.word}
                        </div>
                        <div className="text-[10px] text-slate-400">{cand.note}</div>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20">
                        {cand.category}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* SEKSI KONVERSI KOSAKATA FORMAL -> INFORMAL / LISAN (GUE-LO) */}
            <div className="space-y-2.5 pt-3 border-t border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" />
                    <span>Konversi Kata Baku ke Lisan (Gue–Lo)</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Deteksi otomatis kata formal di naskah untuk diubah ke gaya santai.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleConvertAllFormalToInformal}
                  disabled={detectedFormalWords.length === 0}
                  className="px-3 py-1.5 text-xs font-bold rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 transition-all flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Konversi Semua ({detectedFormalWords.reduce((s, x) => s + x.count, 0)})</span>
                </button>
              </div>

              {detectedFormalWords.length > 0 ? (
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                  <div className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                    <span>Kata Baku Terdeteksi:</span>
                    <span className="text-amber-300 font-mono text-[10px]">
                      {detectedFormalWords.length} kata ({detectedFormalWords.reduce((s, x) => s + x.count, 0)}x)
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {detectedFormalWords.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleConvertSingleFormalWord(item.formal, item.informal)}
                        data-tooltip={`Ubah ${item.count} kata "${item.formal}" menjadi "${item.informal}"`}
                        className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-900 hover:bg-slate-800 border border-amber-500/30 text-slate-200 transition-colors inline-flex items-center gap-1.5 cursor-pointer group"
                      >
                        <span className="font-semibold text-amber-300">{item.formal}</span>
                        <ArrowRight className="w-3 h-3 text-slate-500 group-hover:text-slate-300" />
                        <span className="font-bold text-emerald-400">{item.informal}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-200">
                          {item.count}x
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-xl text-xs text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Naskah sudah bebas dari kata baku utama (100% bergaya lisan Gue–Lo).</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PANEL 3: CARI KOSAKATA (Master Lexicon Registry Lookup) */}
        {activeTool === 'CARI_KOSAKATA' && (
          <div className="p-4 bg-slate-900/90 border border-teal-500/30 rounded-xl space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-teal-300 flex items-center gap-1.5">
                <Search className="w-4 h-4" />
                <span>CARI KOSAKATA (Master Registry)</span>
              </div>
              <span className="text-[11px] text-slate-400">Cek frekuensi kata di naskah & Master Repository</span>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchLexiconQuery}
                onChange={(e) => setSearchLexiconQuery(e.target.value)}
                placeholder="Ketik kata untuk dicari di naskah dan Master Lexicon..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-teal-500/50"
              />
            </div>

            {searchLexiconQuery.trim() && (
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300">
                    Kemunculan di Naskah: <strong className="text-teal-300 font-mono">{scriptOccurrencesCount}x</strong>
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    Hasil Registry: {lexiconSearchResults.length} entri
                  </span>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {lexiconSearchResults.length === 0 ? (
                    <div className="text-xs text-slate-500 py-2">
                      Kata &quot;{searchLexiconQuery}&quot; belum terdaftar di Master Lexicon Registry.
                    </div>
                  ) : (
                    lexiconSearchResults.map((item) => (
                      <div
                        key={item.id}
                        className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs flex items-center justify-between gap-3"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-200">{item.word}</span>
                            {item.formalEquivalent && (
                              <span className="text-[11px] text-slate-400 font-mono">
                                (Baku: {item.formalEquivalent})
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400">{item.contextNote}</p>
                        </div>

                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-500/10 text-teal-300 border border-teal-500/20 whitespace-nowrap">
                          {item.categoryLabel || item.category}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* AREA TEKS NASKAH JADI (FULL SINGLE TEXT AREA) */}
      <div className="p-5 bg-[#0d131f] border border-slate-800 rounded-2xl shadow-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <Type className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-slate-200 tracking-tight">
              Naskah Jadi (SCTF 5 Blok)
            </h2>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
            <span>5 Blok</span>
            <span>•</span>
            <span>{wordCount} Kata</span>
          </div>
        </div>

        {!cleanScript.trim() ? (
          <div className="text-center py-14 px-4 bg-slate-900/40 border border-dashed border-slate-800 rounded-xl space-y-3">
            <AlertCircle className="w-9 h-9 text-amber-400/80 mx-auto" />
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-200">Belum Ada Naskah Final</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Jalankan alur kerja 3 tahap di tab <strong>DRAFT</strong> hingga Tahap 3 disahkan.
              </p>
            </div>
            <button
              type="button"
              onClick={onBackToStudio}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors inline-flex items-center gap-1.5 cursor-pointer mt-1"
            >
              <span>Ke Tab DRAFT</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <textarea
            value={cleanScript}
            onChange={(e) => onScriptChange(e.target.value)}
            rows={14}
            placeholder="Area teks naskah jadi..."
            className="w-full p-4 text-sm sm:text-base font-sans leading-relaxed bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-xl text-slate-100 focus:outline-none resize-y transition-colors"
          />
        )}
      </div>
    </div>
  );
}
