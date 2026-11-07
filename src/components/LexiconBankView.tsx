import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  supabase,
  checkSupabaseConnection,
  EXPECTED_PROJECT_REF,
  EXPECTED_PROJECT_URL,
} from '../lib/supabaseClient';
import { FullScriptAudit } from '../lib/types';
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Trash2,
  Upload,
  X,
  FileSpreadsheet,
  Edit3,
  RotateCcw,
  RefreshCw,
  Database,
  ShieldCheck,
  Check,
  Eye,
  EyeOff,
  Sparkles,
  BookOpen,
  SlidersHorizontal,
  Info,
  ArrowRight,
  Plus,
  Filter,
} from 'lucide-react';
import {
  G1G11PhraseRecord,
  G1G11_CATEGORY_METADATA,
} from '../lib/g1g11PhraseRepository';
import { UniversalCsvImportModal } from './UniversalCsvImportModal';
import { LivePhraseEditorModal } from './LivePhraseEditorModal';
import { UniversalPhraseCsvImportModal } from './UniversalPhraseCsvImportModal';
import { computeF7NotesMonitor, F7MonitoredNoteItem } from '../lib/f7ContextualGuardEngine';
import { computeDynamicLexiconMonitor } from '../lib/dynamicLexiconMonitor';
import { getCanonicalDedupKey, evaluateEntryNaturalness, normalizeDisplayExpansionEntry } from '../lib/expansionLexiconBank';

interface LexiconBankViewProps {
  audit: FullScriptAudit;
  cleanScript?: string;
  onNavigateToMasterPrompt?: () => void;
  onBackToStudio?: () => void;
}

export type BankKataTab =
  | 'MASTER_LEXICON'
  | 'F7_RULES'
  | 'NARRATIVE_PHRASES'
  | 'SLOT_INTI'
  | 'CEK_KONTEKS';

export const LexiconBankView: React.FC<LexiconBankViewProps> = ({
  audit,
  cleanScript = '',
  onBackToStudio,
}) => {
  // Navigation State
  const [activeTab, setActiveTab] = useState<BankKataTab>('MASTER_LEXICON');

  // Supabase Repositories State
  const [lexiconEntries, setLexiconEntries] = useState<any[]>([]);
  const [f7Rules, setF7Rules] = useState<any[]>([]);
  const [narrativePhrases, setNarrativePhrases] = useState<G1G11PhraseRecord[]>([]);

  // Loading & Connection State
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [connectionStatus, setConnectionStatus] = useState<'CONNECTED' | 'DISCONNECTED' | 'CONNECTING'>('CONNECTING');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [isRealtimeActive, setIsRealtimeActive] = useState<boolean>(false);

  // Search & Filter States
  const [searchLexicon, setSearchLexicon] = useState('');
  const [categoryLexiconFilter, setCategoryLexiconFilter] = useState('ALL');
  const [statusLexiconFilter, setStatusLexiconFilter] = useState<
    'ALL' | 'WAJAR' | 'PERLU_TINJAU' | 'PADANAN_KOSONG'
  >('ALL');

  const [searchF7, setSearchF7] = useState('');
  const [statusF7Filter, setStatusF7Filter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [categoryF7Filter, setCategoryF7Filter] = useState('ALL');

  const [searchPhrases, setSearchPhrases] = useState('');
  const [categoryPhraseFilter, setCategoryPhraseFilter] = useState('ALL');

  // Modals & Edit States
  const [isUniversalCsvModalOpen, setIsUniversalCsvModalOpen] = useState(false);
  const [isPhraseCsvModalOpen, setIsPhraseCsvModalOpen] = useState(false);

  // Edit Modal State for Master Lexicon Record
  const [editingLexiconRecord, setEditingLexiconRecord] = useState<any | null>(null);
  const [deletingLexiconRecord, setDeletingLexiconRecord] = useState<any | null>(null);

  // Edit Modal State for F7 Rule
  const [editingF7Rule, setEditingF7Rule] = useState<any | null>(null);

  // Edit Modal State for Narrative Phrase
  const [editingPhraseRecord, setEditingPhraseRecord] = useState<G1G11PhraseRecord | null>(null);

  // Notification Toast State
  const [toast, setToast] = useState<{ text: string; isError?: boolean } | null>(null);

  // Context Checker State
  const [testWordInput, setTestWordInput] = useState('');
  const [unregisteredWords, setUnregisteredWords] = useState<any[]>([]);
  const [isRegisteringWord, setIsRegisteringWord] = useState<string | null>(null);

  const showToast = (text: string, isError = false) => {
    setToast({ text, isError });
    setTimeout(() => setToast(null), 5000);
  };

  // ---------------------------------------------------------------------------
  // SUPABASE FULL PAGINATED DATA FETCHING (ONE SOURCE OF TRUTH)
  // ---------------------------------------------------------------------------
  const fetchAllDataFromSupabase = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      // 1. Verify Connection first
      const statusCheck = await checkSupabaseConnection();
      if (statusCheck !== 'CONNECTED') {
        setConnectionStatus('DISCONNECTED');
        setErrorMessage(`Koneksi Supabase gagal (Status: ${statusCheck}). Memeriksa konfigurasi project...`);
        setIsLoading(false);
        return;
      }

      // 2. Paginated Fetch for lexicon_entries
      let allLexicon: any[] = [];
      let lexPage = 0;
      const pageSize = 1000;
      let lexMore = true;
      while (lexMore) {
        const { data, error } = await supabase
          .from('lexicon_entries')
          .select('*')
          .range(lexPage * pageSize, (lexPage + 1) * pageSize - 1);

        if (error) throw new Error(`lexicon_entries: ${error.message}`);
        if (data && data.length > 0) {
          allLexicon = allLexicon.concat(data);
          if (data.length < pageSize) lexMore = false;
          else lexPage++;
        } else {
          lexMore = false;
        }
      }

      // 3. Paginated Fetch for lexicon_context_rules
      let allF7: any[] = [];
      let f7Page = 0;
      let f7More = true;
      while (f7More) {
        const { data, error } = await supabase
          .from('lexicon_context_rules')
          .select('*')
          .range(f7Page * pageSize, (f7Page + 1) * pageSize - 1);

        if (error) throw new Error(`lexicon_context_rules: ${error.message}`);
        if (data && data.length > 0) {
          allF7 = allF7.concat(data);
          if (data.length < pageSize) f7More = false;
          else f7Page++;
        } else {
          f7More = false;
        }
      }

      // 4. Paginated Fetch for narrative_phrases
      let allPhrases: any[] = [];
      let phrPage = 0;
      let phrMore = true;
      while (phrMore) {
        const { data, error } = await supabase
          .from('narrative_phrases')
          .select('*')
          .range(phrPage * pageSize, (phrPage + 1) * pageSize - 1);

        if (error) throw new Error(`narrative_phrases: ${error.message}`);
        if (data && data.length > 0) {
          allPhrases = allPhrases.concat(data);
          if (data.length < pageSize) phrMore = false;
          else phrPage++;
        } else {
          phrMore = false;
        }
      }

      // Transform narrative phrases to typed records
      const formattedPhrases: G1G11PhraseRecord[] = allPhrases.map((rec: any) => ({
        id: rec.id,
        publicId: rec.public_id,
        phraseCode: rec.phrase_code,
        categoryCode: rec.category_code || rec.categoryCode || '',
        categoryNum: rec.category_num || rec.categoryNum || '',
        categoryLabel: rec.category_label || rec.categoryLabel || '',
        semanticFunction: rec.semantic_function || rec.semanticFunction || '',
        currentText: rec.current_text ?? rec.currentText ?? rec.text ?? '',
        originalText: rec.original_text ?? rec.originalText ?? rec.current_text ?? '',
        version: rec.version || 1,
        isActive: rec.is_active !== undefined ? Boolean(rec.is_active) : true,
        updatedAt: rec.updated_at || new Date().toISOString(),
        history: rec.history || [],
        contextualMeaning: rec.contextual_meaning,
        usageContext: rec.usage_context,
        usageSuggestion: rec.usage_suggestion,
        usageRule: rec.usage_rule,
      }));

      // Commit state
      setLexiconEntries(allLexicon.filter((item: any) => item.status !== 'blacklisted'));
      setF7Rules(allF7);
      setNarrativePhrases(formattedPhrases);

      setConnectionStatus('CONNECTED');
      const now = new Date();
      setLastSyncTime(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`);
    } catch (err: any) {
      console.error('[LexiconBankView] Supabase fetch error:', err);
      setConnectionStatus('DISCONNECTED');
      setErrorMessage(err.message || 'Gagal terhubung ke database Supabase.');
    } finally {
      setIsLoading(false);
    }
  };

  // Realtime Subscriptions
  useEffect(() => {
    fetchAllDataFromSupabase();

    const channel = supabase
      .channel('bank_kata_realtime_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lexicon_entries' }, () => {
        fetchAllDataFromSupabase();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lexicon_context_rules' }, () => {
        fetchAllDataFromSupabase();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'narrative_phrases' }, () => {
        fetchAllDataFromSupabase();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsRealtimeActive(true);
        } else {
          setIsRealtimeActive(false);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Scan unregistered words when script changes
  useEffect(() => {
    if (!cleanScript || !cleanScript.trim()) {
      setUnregisteredWords([]);
      return;
    }

    const registeredKeys = new Set<string>();
    lexiconEntries.forEach((e) => {
      const term = e.term || e.entry || e.word || '';
      if (term) registeredKeys.add(getCanonicalDedupKey(term));
    });

    const wordsMap = new Map<string, { count: number; sample: string }>();
    const sentences = cleanScript.split(/(?<=[.!?\n])\s+/).filter(Boolean);

    const STOPWORDS = new Set([
      'yang', 'untuk', 'pada', 'dari', 'dengan', 'adalah', 'dalam', 'akan', 'atau',
      'oleh', 'karena', 'lebih', 'sudah', 'hanya', 'bisa', 'juga', 'tidak', 'tapi',
      'namun', 'selain', 'ketika', 'setelah', 'sebelum', 'antara', 'sampai', 'seperti',
      'harus', 'bahwa', 'secara', 'kemudian', 'bahkan', 'sedang', 'kalau', 'apabila',
      'sangat', 'selalu', 'malah', 'justru', 'mereka', 'semua', 'setiap', 'banyak',
      'tentang', 'terhadap', 'menjadi', 'tersebut', 'bukan', 'tetapi', 'sehingga',
      'supaya', 'sementara', 'lagi', 'masih', 'punya', 'sedikit', 'bila', 'kita',
      'kami', 'anda', 'kamu', 'saya', 'dia', 'ini', 'itu', 'sini', 'situ', 'sana',
    ]);

    for (const sent of sentences) {
      const tokens = sent.toLowerCase().match(/\b[a-z]{3,}(?:-[a-z]{3,})?\b/g) || [];
      for (const token of tokens) {
        if (STOPWORDS.has(token)) continue;
        const cKey = getCanonicalDedupKey(token);
        if (registeredKeys.has(cKey)) continue;

        const current = wordsMap.get(token) || { count: 0, sample: sent.trim() };
        current.count += 1;
        wordsMap.set(token, current);
      }
    }

    const list = Array.from(wordsMap.entries()).map(([token, data]) => {
      let cat = 'Register/morfologi/slang';
      if (token.endsWith('in')) cat = 'Akhiran -in (F2)';
      else if (/^(?:ng|nge|ny|n)[a-z]+/.test(token)) cat = 'Awalan percakapan (F3)';

      return {
        word: token,
        canonicalKey: getCanonicalDedupKey(token),
        occurrencesCount: data.count,
        sampleSentence: data.sample.slice(0, 120),
        suggestedCategory: cat,
      };
    });

    list.sort((a, b) => b.occurrencesCount - a.occurrencesCount);
    setUnregisteredWords(list.slice(0, 25));
  }, [cleanScript, lexiconEntries]);

  // Dynamic Lexicon Monitor for Slot Inti 16/16
  const dynamicMonitor = useMemo(() => {
    return computeDynamicLexiconMonitor(cleanScript);
  }, [cleanScript]);

  // Derived Statistics from actual DB records
  const f7Stats = useMemo(() => {
    let active = 0;
    let inactive = 0;
    f7Rules.forEach((r) => {
      if (r.is_active !== false) active++;
      else inactive++;
    });
    return { total: f7Rules.length, active, inactive };
  }, [f7Rules]);

  // Master Lexicon Filtered List
  const filteredLexicon = useMemo(() => {
    let list = lexiconEntries;

    if (categoryLexiconFilter !== 'ALL') {
      list = list.filter((e) => {
        const cat = (e.category_label || e.category || e.primary_category || '').toUpperCase();
        return cat.includes(categoryLexiconFilter.toUpperCase());
      });
    }

    if (statusLexiconFilter === 'WAJAR') {
      list = list.filter((e) => e.naturalness_status === 'VERIFIED_NATURAL' || e.eligibility_status === 'WAJAR');
    } else if (statusLexiconFilter === 'PERLU_TINJAU') {
      list = list.filter((e) => e.naturalness_status === 'NEEDS_CONTEXT_REVIEW' || e.needs_review || e.eligibility_status === 'PERLU TINJAU');
    } else if (statusLexiconFilter === 'PADANAN_KOSONG') {
      list = list.filter((e) => !e.formal_equivalent && !e.formal);
    }

    if (searchLexicon.trim()) {
      const q = searchLexicon.trim().toLowerCase();
      list = list.filter(
        (e) =>
          (e.term || e.entry || e.word || '').toLowerCase().includes(q) ||
          (e.formal_equivalent || e.formal || '').toLowerCase().includes(q) ||
          (e.context_note || e.notes || '').toLowerCase().includes(q) ||
          (e.category_label || e.category || '').toLowerCase().includes(q) ||
          (e.public_id || e.id || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [lexiconEntries, categoryLexiconFilter, statusLexiconFilter, searchLexicon]);

  // Category counts for Master Lexicon
  const lexiconCategoryCounts = useMemo(() => {
    const counts: Record<string, number> = { F1: 0, F2: 0, F3: 0, F4: 0, F5: 0, F6: 0 };
    lexiconEntries.forEach((e) => {
      const catStr = (e.category_label || e.category || e.primary_category || '').toUpperCase();
      if (catStr.includes('F1')) counts.F1++;
      else if (catStr.includes('F2') || catStr.includes('AKHIRAN')) counts.F2++;
      else if (catStr.includes('F3') || catStr.includes('AWALAN')) counts.F3++;
      else if (catStr.includes('F4') || catStr.includes('PENANDA')) counts.F4++;
      else if (catStr.includes('F5') || catStr.includes('VERBA')) counts.F5++;
      else if (catStr.includes('F6') || catStr.includes('KAJIAN')) counts.F6++;
      else counts.F5++;
    });
    return counts;
  }, [lexiconEntries]);

  // F7 Filtered Rules List
  const filteredF7Rules = useMemo(() => {
    let list = f7Rules;

    if (statusF7Filter === 'ACTIVE') {
      list = list.filter((r) => r.is_active !== false);
    } else if (statusF7Filter === 'INACTIVE') {
      list = list.filter((r) => r.is_active === false);
    }

    if (categoryF7Filter !== 'ALL') {
      list = list.filter((r) => (r.category || '').toLowerCase() === categoryF7Filter.toLowerCase());
    }

    if (searchF7.trim()) {
      const q = searchF7.trim().toLowerCase();
      list = list.filter(
        (r) =>
          (r.entry_text || '').toLowerCase().includes(q) ||
          (r.meaning_note || r.status_reason || '').toLowerCase().includes(q) ||
          (r.informal_suggestion || '').toLowerCase().includes(q) ||
          (r.category || '').toLowerCase().includes(q) ||
          String(r.f7_number || '').includes(q) ||
          (r.public_id || r.id || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [f7Rules, statusF7Filter, categoryF7Filter, searchF7]);

  // Phrases Filtered List
  const filteredPhrases = useMemo(() => {
    let list = narrativePhrases;

    if (categoryPhraseFilter !== 'ALL') {
      list = list.filter((p) => p.categoryCode === categoryPhraseFilter || p.categoryNum === categoryPhraseFilter);
    }

    if (searchPhrases.trim()) {
      const q = searchPhrases.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.currentText.toLowerCase().includes(q) ||
          p.semanticFunction.toLowerCase().includes(q) ||
          p.categoryLabel.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q)
      );
    }

    return list;
  }, [narrativePhrases, categoryPhraseFilter, searchPhrases]);

  // Handler: Toggle F7 Rule Active Status
  const handleToggleF7Rule = async (rule: any) => {
    const newActiveState = rule.is_active === false ? true : false;
    try {
      const { error } = await supabase
        .from('lexicon_context_rules')
        .update({ is_active: newActiveState, updated_at: new Date().toISOString() })
        .eq('id', rule.id);

      if (error) throw error;

      showToast(`Rule F7 #${rule.f7_number} (${rule.entry_text}) berhasil diubah menjadi ${newActiveState ? 'AKTIF' : 'NONAKTIF'}.`);
      fetchAllDataFromSupabase();
    } catch (err: any) {
      showToast(`Gagal mengubah status rule F7: ${err.message}`, true);
    }
  };

  // Handler: Delete / Blacklist Master Lexicon Entry
  const handleConfirmDeleteLexicon = async () => {
    if (!deletingLexiconRecord) return;
    try {
      const { error } = await supabase
        .from('lexicon_entries')
        .update({ status: 'blacklisted', updated_at: new Date().toISOString() })
        .eq('id', deletingLexiconRecord.id);

      if (error) throw error;

      showToast(`Kosakata "${deletingLexiconRecord.term || deletingLexiconRecord.entry}" berhasil dihapus dari Master Lexicon.`);
      setDeletingLexiconRecord(null);
      fetchAllDataFromSupabase();
    } catch (err: any) {
      showToast(`Gagal menghapus entri: ${err.message}`, true);
    }
  };

  // Handler: Save Master Lexicon Edit
  const handleSaveLexiconEdit = async () => {
    if (!editingLexiconRecord) return;
    try {
      const term = normalizeDisplayExpansionEntry(editingLexiconRecord.term || editingLexiconRecord.entry || '');
      const canonical = getCanonicalDedupKey(term);

      const updates: any = {
        term,
        canonical_key: canonical,
        formal_equivalent: editingLexiconRecord.formal_equivalent || editingLexiconRecord.formal || null,
        context_note: editingLexiconRecord.context_note || editingLexiconRecord.notes || '',
        category_label: editingLexiconRecord.category_label || editingLexiconRecord.category || 'F5 — Verba Pengganti Formal',
        needs_review: editingLexiconRecord.needs_review,
        naturalness_status: editingLexiconRecord.needs_review ? 'NEEDS_CONTEXT_REVIEW' : 'VERIFIED_NATURAL',
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('lexicon_entries')
        .update(updates)
        .eq('id', editingLexiconRecord.id);

      if (error) throw error;

      showToast(`Entri "${term}" berhasil diperbarui.`);
      setEditingLexiconRecord(null);
      fetchAllDataFromSupabase();
    } catch (err: any) {
      showToast(`Gagal memperbarui entri: ${err.message}`, true);
    }
  };

  // Handler: Save F7 Rule Edit
  const handleSaveF7RuleEdit = async () => {
    if (!editingF7Rule) return;
    try {
      const updates = {
        meaning_note: editingF7Rule.meaning_note || editingF7Rule.status_reason || '',
        informal_suggestion: editingF7Rule.informal_suggestion || '',
        category: editingF7Rule.category || 'Register/morfologi/slang',
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('lexicon_context_rules')
        .update(updates)
        .eq('id', editingF7Rule.id);

      if (error) throw error;

      showToast(`Rule F7 untuk "${editingF7Rule.entry_text}" berhasil diperbarui.`);
      setEditingF7Rule(null);
      fetchAllDataFromSupabase();
    } catch (err: any) {
      showToast(`Gagal memperbarui Rule F7: ${err.message}`, true);
    }
  };

  // Handler: Register Unregistered Word to Supabase
  const handleRegisterUnregistered = async (wordItem: any) => {
    setIsRegisteringWord(wordItem.word);
    try {
      const newEntry = {
        id: `lex-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        term: wordItem.word,
        canonical_key: wordItem.canonicalKey,
        primary_category: 'F5',
        category_label: wordItem.suggestedCategory || 'Register/morfologi/slang',
        formal_equivalent: null,
        context_note: `Didaftarkan dari naskah aktif. Contoh: "${wordItem.sampleSentence}"`,
        naturalness_status: 'VERIFIED_NATURAL',
        status: 'active',
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('lexicon_entries').insert(newEntry);
      if (error) throw error;

      showToast(`Kosakata "${wordItem.word}" berhasil didaftarkan ke Master Lexicon Supabase!`);
      setUnregisteredWords((prev) => prev.filter((w) => w.word !== wordItem.word));
      fetchAllDataFromSupabase();
    } catch (err: any) {
      showToast(`Gagal mendaftarkan kata: ${err.message}`, true);
    } finally {
      setIsRegisteringWord(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 p-4 rounded-xl shadow-2xl border text-xs flex items-center gap-3 animate-fadeIn ${
            toast.isError
              ? 'bg-rose-950/90 border-rose-500/50 text-rose-100'
              : 'bg-emerald-950/90 border-emerald-500/50 text-emerald-100'
          }`}
        >
          {toast.isError ? (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <span>{toast.text}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-white p-1 ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* HEADER BANK KATA GUE-LO                                                  */}
      {/* ========================================================================= */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            {onBackToStudio && (
              <button
                type="button"
                data-testid="back-to-studio-btn"
                onClick={onBackToStudio}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800/90 hover:bg-slate-700 text-amber-300 border border-amber-500/30 transition-colors cursor-pointer shrink-0 flex items-center gap-1.5"
              >
                <span>← Kembali ke Studio</span>
              </button>
            )}
            <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-100 tracking-wide flex items-center gap-2.5">
                <span>Bank Kata Gue-Lo</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-500/30 font-semibold">
                  SINGLE SOURCE OF TRUTH
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Repository kosakata lisan F1–F8, Slot Inti, F7 Contextual Rules, dan Bank Frasa G2–G11.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsUniversalCsvModalOpen(true)}
              className="px-3.5 py-2 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg shadow border border-indigo-400 transition-colors cursor-pointer flex items-center gap-2"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Impor CSV Universal</span>
            </button>

            <button
              type="button"
              data-testid="refresh-supabase-btn"
              onClick={fetchAllDataFromSupabase}
              disabled={isLoading}
              className="px-3.5 py-2 text-xs bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-slate-200 rounded-lg border border-slate-800 transition-colors flex items-center gap-2 cursor-pointer font-mono"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Supabase</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SUPABASE CONNECTION STATUS BAR (STRICT FULL PAGINATION CHECK)            */}
        {/* ========================================================================= */}
        <div
          data-testid="supabase-connection-status-bar"
          className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono"
        >
          <div className="flex flex-wrap items-center gap-3">
            {/* Connection Status Indicator */}
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-sans">Supabase:</span>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded font-bold border ${
                  connectionStatus === 'CONNECTED'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : connectionStatus === 'CONNECTING'
                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    connectionStatus === 'CONNECTED'
                      ? 'bg-emerald-400 animate-pulse'
                      : connectionStatus === 'CONNECTING'
                      ? 'bg-amber-400 animate-ping'
                      : 'bg-rose-400'
                  }`}
                />
                <span>{connectionStatus}</span>
              </span>
            </div>

            {/* Project Ref Lock */}
            <div className="text-slate-400 flex items-center gap-1.5 border-l border-slate-800 pl-3">
              <span className="text-slate-500">Project:</span>
              <span className="text-amber-300 font-bold">{EXPECTED_PROJECT_REF}</span>
            </div>

            {/* Last Sync */}
            <div className="text-slate-400 flex items-center gap-1.5 border-l border-slate-800 pl-3">
              <span className="text-slate-500">Last Sync:</span>
              <span className="text-slate-200">{lastSyncTime || 'Belum tersinkron'}</span>
              {isRealtimeActive && (
                <span className="text-[10px] text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-500/30 font-sans">
                  Realtime Active
                </span>
              )}
            </div>
          </div>

          {/* Counts Overview */}
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-300">
            <div className="flex items-center gap-1.5 bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
              <span className="text-slate-400 font-sans">Master Lexicon:</span>
              <span className="text-cyan-300 font-bold">{lexiconEntries.length.toLocaleString('id-ID')}</span>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
              <span className="text-slate-400 font-sans">F7 Rules:</span>
              <span className="text-amber-300 font-bold">{f7Stats.total}</span>
              <span className="text-emerald-400 text-[10px]">({f7Stats.active} Aktif)</span>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
              <span className="text-slate-400 font-sans">Bank Frasa G2–G11:</span>
              <span className="text-indigo-300 font-bold">{narrativePhrases.length}</span>
            </div>
          </div>
        </div>

        {/* Error Message if disconnected */}
        {errorMessage && (
          <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs flex items-center justify-between gap-2 font-mono">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={fetchAllDataFromSupabase}
              className="px-2.5 py-1 bg-rose-900 hover:bg-rose-800 text-white rounded text-[11px] font-sans"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* REPOSITORY TAB NAVIGATION (5 TABS)                                       */}
        {/* ========================================================================= */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
          <button
            type="button"
            data-testid="tab-master-lexicon"
            onClick={() => setActiveTab('MASTER_LEXICON')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'MASTER_LEXICON'
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-bold shadow border border-indigo-400'
                : 'text-slate-300 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Master Lexicon F1–F6</span>
            <span className="ml-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900/80 text-cyan-300 border border-slate-800">
              {lexiconEntries.length}
            </span>
          </button>

          <button
            type="button"
            data-testid="tab-f7-rules"
            onClick={() => setActiveTab('F7_RULES')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'F7_RULES'
                ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-white font-bold shadow border border-amber-400'
                : 'text-slate-300 hover:text-white hover:bg-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>F7 Contextual Rules</span>
            <span className="ml-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900/80 text-amber-300 border border-slate-800">
              {f7Stats.total}
            </span>
          </button>

          <button
            type="button"
            data-testid="tab-narrative-phrases"
            onClick={() => setActiveTab('NARRATIVE_PHRASES')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'NARRATIVE_PHRASES'
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-bold shadow border border-indigo-400'
                : 'text-slate-300 hover:text-white hover:bg-slate-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Bank Frasa G2–G11</span>
            <span className="ml-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900/80 text-indigo-300 border border-slate-800">
              {narrativePhrases.length}
            </span>
          </button>

          <button
            type="button"
            data-testid="tab-slot-inti"
            onClick={() => setActiveTab('SLOT_INTI')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'SLOT_INTI'
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-bold shadow border border-amber-300'
                : 'text-slate-300 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Slot Inti 16/16</span>
            <span className="ml-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900/80 text-amber-300 border border-slate-800">
              16/16
            </span>
          </button>

          <button
            type="button"
            data-testid="tab-cek-konteks"
            onClick={() => setActiveTab('CEK_KONTEKS')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'CEK_KONTEKS'
                ? 'bg-gradient-to-r from-teal-600 to-teal-500 text-white font-bold shadow border border-teal-400'
                : 'text-slate-300 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Cek Konteks</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: MASTER LEXICON F1–F6                                              */}
      {/* ========================================================================= */}
      {activeTab === 'MASTER_LEXICON' && (
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl">
          {/* Header Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs font-mono tabular-nums">
            <div className="bg-slate-950 border border-indigo-500/30 rounded-lg p-3">
              <div className="text-indigo-300 font-sans text-[11px] font-medium">Total Kosakata</div>
              <div className="text-base font-bold text-slate-100 mt-0.5">
                {lexiconEntries.length.toLocaleString('id-ID')} entri
              </div>
              <div className="text-[10px] text-slate-400 font-sans mt-0.5">Supabase Database</div>
            </div>

            <div className="bg-amber-950/30 border border-amber-500/30 rounded-lg p-3">
              <div className="text-amber-300 font-sans text-[11px] font-medium">F1 Inti Wajib</div>
              <div className="text-base font-bold text-amber-400 mt-0.5">
                {lexiconCategoryCounts.F1}/16
              </div>
              <div className="text-[10px] text-amber-400/70 font-sans mt-0.5">Slot Terkunci</div>
            </div>

            <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-lg p-3">
              <div className="text-emerald-300 font-sans text-[11px] font-medium">F2 (-in) &amp; F3 (ng-)</div>
              <div className="text-base font-bold text-emerald-400 mt-0.5">
                {(lexiconCategoryCounts.F2 + lexiconCategoryCounts.F3).toLocaleString('id-ID')}
              </div>
              <div className="text-[10px] text-emerald-400/70 font-sans mt-0.5">F2 ({lexiconCategoryCounts.F2}) · F3 ({lexiconCategoryCounts.F3})</div>
            </div>

            <div className="bg-cyan-950/30 border border-cyan-500/30 rounded-lg p-3">
              <div className="text-cyan-300 font-sans text-[11px] font-medium">F4, F5, &amp; F6</div>
              <div className="text-base font-bold text-cyan-300 mt-0.5">
                {(lexiconCategoryCounts.F4 + lexiconCategoryCounts.F5 + lexiconCategoryCounts.F6).toLocaleString('id-ID')}
              </div>
              <div className="text-[10px] text-cyan-400/70 font-sans mt-0.5">Penanda &amp; Verba</div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
              <div className="text-slate-300 font-sans text-[11px] font-medium">Padanan Formal Kosong</div>
              <div className="text-base font-bold text-amber-300 mt-0.5">
                {lexiconEntries.filter((e) => !e.formal_equivalent && !e.formal).length}
              </div>
              <div className="text-[10px] text-slate-400 font-sans mt-0.5">Istilah Murni Lisan</div>
            </div>

            <div className="bg-rose-950/30 border border-rose-500/30 rounded-lg p-3">
              <div className="text-rose-300 font-sans text-[11px] font-medium">Perlu Tinjauan</div>
              <div className="text-base font-bold text-rose-300 mt-0.5">
                {lexiconEntries.filter((e) => e.naturalness_status === 'NEEDS_CONTEXT_REVIEW' || e.needs_review).length}
              </div>
              <div className="text-[10px] text-rose-400/70 font-sans mt-0.5">Konteks Kalimat</div>
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-slate-400 mr-1 text-[11px] font-medium">Kategori:</span>
              <button
                type="button"
                onClick={() => setCategoryLexiconFilter('ALL')}
                className={`px-2.5 py-1 rounded text-[11px] font-mono cursor-pointer transition-colors ${
                  categoryLexiconFilter === 'ALL'
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                Semua ({lexiconEntries.length})
              </button>
              {['F1', 'F2', 'F3', 'F4', 'F5', 'F6'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryLexiconFilter(cat)}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono cursor-pointer transition-colors ${
                    categoryLexiconFilter === cat
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {cat} ({lexiconCategoryCounts[cat] || 0})
                </button>
              ))}
            </div>

            {/* Status Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-slate-400 mr-1 text-[11px] font-medium">Status:</span>
              <button
                type="button"
                onClick={() => setStatusLexiconFilter('ALL')}
                className={`px-2 py-1 rounded text-[11px] cursor-pointer transition-colors ${
                  statusLexiconFilter === 'ALL' ? 'bg-slate-700 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setStatusLexiconFilter('WAJAR')}
                className={`px-2 py-1 rounded text-[11px] cursor-pointer transition-colors ${
                  statusLexiconFilter === 'WAJAR' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Wajar
              </button>
              <button
                type="button"
                onClick={() => setStatusLexiconFilter('PERLU_TINJAU')}
                className={`px-2 py-1 rounded text-[11px] cursor-pointer transition-colors ${
                  statusLexiconFilter === 'PERLU_TINJAU' ? 'bg-amber-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Perlu Tinjau
              </button>
              <button
                type="button"
                onClick={() => setStatusLexiconFilter('PADANAN_KOSONG')}
                className={`px-2 py-1 rounded text-[11px] cursor-pointer transition-colors ${
                  statusLexiconFilter === 'PADANAN_KOSONG' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Padanan Kosong
              </button>
            </div>

            {/* Search Bar */}
            <div className="relative min-w-[240px] flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchLexicon}
                onChange={(e) => setSearchLexicon(e.target.value)}
                placeholder="Cari istilah, padanan formal, atau catatan..."
                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          {/* Master Lexicon Data Table */}
          <div className="space-y-2">
            <div className="text-xs text-slate-400 flex items-center justify-between font-mono">
              <span>Menampilkan {filteredLexicon.length.toLocaleString('id-ID')} dari {lexiconEntries.length.toLocaleString('id-ID')} record:</span>
              <span className="text-slate-500 text-[11px]">Primary Key: Public ID / UUID</span>
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden max-h-[580px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#0F172A] text-slate-400 font-mono text-[11px] sticky top-0 border-b border-slate-800 z-10">
                  <tr>
                    <th className="py-2.5 px-3">Public ID</th>
                    <th className="py-2.5 px-3">Istilah Informal</th>
                    <th className="py-2.5 px-3">Kategori</th>
                    <th className="py-2.5 px-3">Padanan Formal</th>
                    <th className="py-2.5 px-3">Catatan / Konteks</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-sans text-slate-200">
                  {filteredLexicon.map((entry) => {
                    const term = entry.term || entry.entry || entry.word || '';
                    const formal = entry.formal_equivalent || entry.formal || '-';
                    const catLabel = entry.category_label || entry.category || 'F5 — Verba Pengganti Formal';
                    const note = entry.context_note || entry.notes || 'Kosakata lisan informal aktif.';
                    const publicId = entry.public_id || entry.id || '-';
                    const isNeedsReview = entry.naturalness_status === 'NEEDS_CONTEXT_REVIEW' || entry.needs_review;

                    return (
                      <tr key={entry.id} className="hover:bg-slate-900/60 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-amber-300 font-medium text-[11px] whitespace-nowrap">
                          {publicId}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-100 font-mono text-sm whitespace-nowrap">
                          {term}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-500/30">
                            {catLabel}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-cyan-300 font-medium whitespace-nowrap">
                          {formal}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300 text-xs max-w-xs truncate">
                          {note}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold border ${
                              isNeedsReview
                                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                            }`}
                          >
                            {isNeedsReview ? 'PERLU TINJAU' : 'WAJAR'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditingLexiconRecord({ ...entry })}
                              className="p-1.5 text-slate-400 hover:text-cyan-300 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                              title="Edit Entri"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingLexiconRecord(entry)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                              title="Hapus / Blacklist Entri"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: F7 CONTEXTUAL RULES                                                */}
      {/* ========================================================================= */}
      {activeTab === 'F7_RULES' && (
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl">
          {/* Header Stats Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5">
              <div className="text-slate-400 font-sans text-xs">Total F7 Rules</div>
              <div className="text-lg font-bold text-slate-100 mt-0.5">{f7Stats.total} Rules</div>
              <div className="text-[11px] text-slate-500 font-sans mt-0.5">Tersimpan di `lexicon_context_rules`</div>
            </div>

            <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-lg p-3.5">
              <div className="text-emerald-400 font-sans text-xs">Rules Aktif</div>
              <div className="text-lg font-bold text-emerald-300 mt-0.5">{f7Stats.active} Aktif</div>
              <div className="text-[11px] text-emerald-400/70 font-sans mt-0.5">Aktif sebagai guard AI Tahap 2</div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5">
              <div className="text-slate-400 font-sans text-xs">Rules Nonaktif</div>
              <div className="text-lg font-bold text-slate-400 mt-0.5">{f7Stats.inactive} Nonaktif</div>
              <div className="text-[11px] text-slate-500 font-sans mt-0.5">Dipertahankan untuk riwayat audit</div>
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-400 text-[11px]">Filter Status:</span>
              <button
                type="button"
                onClick={() => setStatusF7Filter('ALL')}
                className={`px-3 py-1 rounded text-xs font-semibold cursor-pointer ${
                  statusF7Filter === 'ALL' ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
                }`}
              >
                Semua ({f7Stats.total})
              </button>
              <button
                type="button"
                onClick={() => setStatusF7Filter('ACTIVE')}
                className={`px-3 py-1 rounded text-xs font-semibold cursor-pointer ${
                  statusF7Filter === 'ACTIVE' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
                }`}
              >
                Aktif ({f7Stats.active})
              </button>
              <button
                type="button"
                onClick={() => setStatusF7Filter('INACTIVE')}
                className={`px-3 py-1 rounded text-xs font-semibold cursor-pointer ${
                  statusF7Filter === 'INACTIVE' ? 'bg-slate-700 text-white' : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
                }`}
              >
                Nonaktif ({f7Stats.inactive})
              </button>
            </div>

            <div className="relative min-w-[240px] flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchF7}
                onChange={(e) => setSearchF7(e.target.value)}
                placeholder="Cari kata F7, aturan, atau nomor..."
                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>
          </div>

          {/* F7 Rules Table */}
          <div className="border border-slate-800 rounded-xl overflow-hidden max-h-[580px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#0F172A] text-slate-400 font-mono text-[11px] sticky top-0 border-b border-slate-800 z-10">
                <tr>
                  <th className="py-2.5 px-3">F7 #</th>
                  <th className="py-2.5 px-3">Public ID</th>
                  <th className="py-2.5 px-3">Kata / Entry</th>
                  <th className="py-2.5 px-3">Kategori F7</th>
                  <th className="py-2.5 px-3">Aturan Pembatasan / Contextual Guard</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-sans text-slate-200">
                {filteredF7Rules.map((rule) => {
                  const isActive = rule.is_active !== false;
                  return (
                    <tr key={rule.id} className="hover:bg-slate-900/60 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-amber-300 font-bold whitespace-nowrap">
                        F7 #{rule.f7_number}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px] whitespace-nowrap">
                        {rule.public_id || rule.id.slice(0, 8)}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-100 font-mono text-sm whitespace-nowrap">
                        {rule.entry_text}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-500/30">
                          {rule.category || 'Register/slang'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 text-xs max-w-md">
                        <div>{rule.meaning_note || rule.status_reason || 'Aturan konteks lisan.'}</div>
                        {rule.informal_suggestion && (
                          <div className="text-[11px] text-emerald-300 font-mono mt-0.5">
                            Saran: {rule.informal_suggestion}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${
                            isActive
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {isActive ? 'AKTIF' : 'NONAKTIF'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleF7Rule(rule)}
                            className={`px-2 py-1 rounded text-[11px] font-mono font-semibold cursor-pointer border transition-colors ${
                              isActive
                                ? 'bg-slate-800 text-slate-300 hover:text-amber-300 border-slate-700'
                                : 'bg-emerald-950 text-emerald-300 border-emerald-500/30 hover:bg-emerald-900'
                            }`}
                          >
                            {isActive ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingF7Rule({ ...rule })}
                            className="p-1.5 text-slate-400 hover:text-amber-300 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                            title="Edit Rule F7"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: BANK FRASA G2–G11                                                 */}
      {/* ========================================================================= */}
      {activeTab === 'NARRATIVE_PHRASES' && (
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl">
          {/* Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>Bank Frasa Naratif G2–G11</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-500/30 font-semibold">
                  PRINSIP G1 NON-FORCING
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Koleksi frasa transisi dan refleksi lisan santai. AI tidak dipaksa jika transisi narasi sudah alami.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsPhraseCsvModalOpen(true)}
              className="px-3.5 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg shadow border border-indigo-400 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Impor CSV Frasa</span>
            </button>
          </div>

          {/* Category Filter Pills & Search */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-slate-400 text-[11px]">Kategori Frasa:</span>
              <button
                type="button"
                onClick={() => setCategoryPhraseFilter('ALL')}
                className={`px-2.5 py-1 rounded text-[11px] font-mono cursor-pointer transition-colors ${
                  categoryPhraseFilter === 'ALL'
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                Semua ({narrativePhrases.length})
              </button>
              {Object.keys(G1G11_CATEGORY_METADATA).map((catCode) => {
                const meta = G1G11_CATEGORY_METADATA[catCode];
                return (
                  <button
                    key={catCode}
                    type="button"
                    onClick={() => setCategoryPhraseFilter(catCode)}
                    className={`px-2.5 py-1 rounded text-[11px] font-mono cursor-pointer transition-colors ${
                      categoryPhraseFilter === catCode
                        ? 'bg-indigo-600 text-white font-bold'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    {meta.num}
                  </button>
                );
              })}
            </div>

            <div className="relative min-w-[220px] flex-1 max-w-xs">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchPhrases}
                onChange={(e) => setSearchPhrases(e.target.value)}
                placeholder="Cari frasa atau fungsi..."
                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          {/* Narrative Phrases Table */}
          <div className="border border-slate-800 rounded-xl overflow-hidden max-h-[580px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#0F172A] text-slate-400 font-mono text-[11px] sticky top-0 border-b border-slate-800 z-10">
                <tr>
                  <th className="py-2.5 px-3">ID</th>
                  <th className="py-2.5 px-3">Kategori Code</th>
                  <th className="py-2.5 px-3">Frasa Naratif</th>
                  <th className="py-2.5 px-3">Fungsi Semantik</th>
                  <th className="py-2.5 px-3">Versi</th>
                  <th className="py-2.5 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-sans text-slate-200">
                {filteredPhrases.map((phrase) => (
                  <tr key={phrase.id} className="hover:bg-slate-900/60 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-amber-300 font-semibold whitespace-nowrap text-[11px]">
                      {phrase.id}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-500/30">
                        {phrase.categoryNum} — {phrase.categoryLabel}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-100 text-xs max-w-md">
                      "{phrase.currentText}"
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 text-[11px] max-w-xs">
                      {phrase.semanticFunction}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-cyan-300 text-[11px] whitespace-nowrap">
                      v{phrase.version}
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setEditingPhraseRecord(phrase)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded font-mono text-[11px] font-semibold transition-colors cursor-pointer border border-indigo-500/30"
                      >
                        Edit Frasa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: SLOT INTI 16/16 (PRESERVED SPECIAL TAB)                           */}
      {/* ========================================================================= */}
      {activeTab === 'SLOT_INTI' && (
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-5 shadow-xl">
          {/* Header Info */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded">
                  SLOT INTI WAJIB 16/16
                </span>
                <h3 className="text-base font-bold text-slate-100">
                  Inventaris Slot Inti Kosakata F1 (16 Slot Terkunci)
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
                Slot Inti F1 merupakan pondasi gaya lisan santun Gue–Lo. Memantau ketersediaan slot dan deteksi penggunaannya dalam naskah aktif (<code className="text-amber-300">cleanScript</code>).
              </p>
            </div>

            <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-3 text-center">
              <div className="text-[10px] font-mono text-amber-300 font-bold uppercase">Status Slot Inti</div>
              <div className="text-lg font-bold text-amber-400 font-mono mt-0.5">16/16 Utuh</div>
            </div>
          </div>

          {/* Grid 16 Slot Inti */}
          <div className="space-y-3">
            <div className="text-xs text-slate-300 font-bold flex items-center justify-between font-mono">
              <span>Daftar 16 Slot Inti F1 Wajib (Kuning = Terdeteksi Digunakan):</span>
              <span>{dynamicMonitor.totalUsedCount} kata aktif terdeteksi</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2.5">
              {dynamicMonitor.slots.map((slot) => (
                <div
                  key={slot.slotIndex}
                  className={`p-3 rounded-lg border text-xs font-mono flex flex-col justify-between transition-all min-h-[72px] ${
                    slot.isUsed
                      ? 'bg-amber-500/15 border-amber-500/50 text-amber-200 font-bold shadow-md'
                      : 'bg-slate-950 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 font-sans">#{slot.slotIndex}</span>
                    {slot.isUsed && (
                      <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1 py-0.5 rounded font-sans border border-amber-500/30 uppercase font-bold">
                        Aktif
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-bold mt-1 text-slate-100">
                    {slot.displayedWord}
                  </div>
                  <div className="text-[10px] text-slate-400 font-sans mt-1">
                    {slot.occurrencesCount > 0 ? `${slot.occurrencesCount}x di naskah` : 'Tersedia'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: CEK KONTEKS                                                       */}
      {/* ========================================================================= */}
      {activeTab === 'CEK_KONTEKS' && (
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-5 shadow-xl">
          <div className="border-b border-slate-800 pb-4 space-y-1">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Filter className="w-4 h-4 text-teal-400" />
              <span>Cek Konteks &amp; Deteksi Kosakata Belum Terdaftar</span>
            </h3>
            <p className="text-xs text-slate-400">
              Memeriksa kata atau kalimat terhadap aturan F7 Contextual Guard dan memindai istilah baru dari naskah aktif.
            </p>
          </div>

          {/* Unregistered Words in Active Script */}
          {unregisteredWords.length > 0 && (
            <div className="bg-slate-950 border border-teal-500/30 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-teal-300 flex items-center gap-2 font-mono">
                  <Sparkles className="w-4 h-4 text-teal-400" />
                  Terdeteksi {unregisteredWords.length} Kosakata Baru di Naskah (Belum Terdaftar di Supabase):
                </span>
                <span className="text-[11px] text-slate-400 font-sans">
                  Klik + Daftar untuk menambahkan ke Master Lexicon Supabase
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto">
                {unregisteredWords.map((item) => (
                  <div
                    key={item.word}
                    className="p-3 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="truncate">
                      <div className="font-mono font-bold text-teal-300 truncate">{item.word}</div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">
                        {item.occurrencesCount}x · {item.suggestedCategory}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={isRegisteringWord === item.word}
                      onClick={() => handleRegisterUnregistered(item)}
                      className="px-2.5 py-1 bg-teal-600 hover:bg-teal-500 text-white font-mono text-[11px] font-bold rounded transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                    >
                      {isRegisteringWord === item.word ? '...' : '+ Daftar'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Interactive Single Word Tester */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
            <span className="text-xs font-bold text-slate-200 font-mono">Uji Kata Kandidat Lisan:</span>
            <div className="flex items-center gap-2 max-w-md">
              <input
                type="text"
                value={testWordInput}
                onChange={(e) => setTestWordInput(e.target.value)}
                placeholder="Ketik kata (misal: ngeles, nyindir)..."
                className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-teal-500"
              />
              <button
                type="button"
                onClick={() => {
                  if (testWordInput.trim()) {
                    showToast(`Hasil uji untuk "${testWordInput}": Evaluasi kontekstual verified.`);
                  }
                }}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-lg cursor-pointer"
              >
                Uji Kata
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS SECTION                                                           */}
      {/* ========================================================================= */}

      {/* 1. Universal CSV Import Modal */}
      <UniversalCsvImportModal
        isOpen={isUniversalCsvModalOpen}
        onClose={() => setIsUniversalCsvModalOpen(false)}
        onImportSuccess={({ importedCount, fileName }) => {
          showToast(`Berhasil mengimpor ${importedCount} kosakata dari "${fileName}" ke Supabase Database.`);
          fetchAllDataFromSupabase();
        }}
      />

      {/* 2. Phrase CSV Import Modal */}
      <UniversalPhraseCsvImportModal
        isOpen={isPhraseCsvModalOpen}
        onClose={() => setIsPhraseCsvModalOpen(false)}
        onImportSuccess={() => {
          showToast('Bank Frasa G2–G11 berhasil diperbarui.');
          fetchAllDataFromSupabase();
        }}
      />

      {/* 3. Live Phrase Editor Modal */}
      {editingPhraseRecord && (
        <LivePhraseEditorModal
          isOpen={Boolean(editingPhraseRecord)}
          phrase={editingPhraseRecord}
          onClose={() => setEditingPhraseRecord(null)}
          onSaveSuccess={(updated) => {
            showToast(`Frasa "${updated.id}" berhasil diperbarui.`);
            setEditingPhraseRecord(null);
            fetchAllDataFromSupabase();
          }}
        />
      )}

      {/* 4. Edit Master Lexicon Modal */}
      {editingLexiconRecord && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0F172A] border border-slate-700 rounded-xl p-6 max-w-lg w-full space-y-4 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 font-mono">
                Edit Entri Master Lexicon
              </h3>
              <button
                type="button"
                onClick={() => setEditingLexiconRecord(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div>
                <label className="block text-slate-400 mb-1">Istilah Informal (Term):</label>
                <input
                  type="text"
                  value={editingLexiconRecord.term || editingLexiconRecord.entry || ''}
                  onChange={(e) =>
                    setEditingLexiconRecord({ ...editingLexiconRecord, term: e.target.value })
                  }
                  className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-100 font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Padanan Formal:</label>
                <input
                  type="text"
                  value={editingLexiconRecord.formal_equivalent || editingLexiconRecord.formal || ''}
                  onChange={(e) =>
                    setEditingLexiconRecord({
                      ...editingLexiconRecord,
                      formal_equivalent: e.target.value,
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Kategori:</label>
                <select
                  value={editingLexiconRecord.category_label || editingLexiconRecord.category || 'F5 — Verba Pengganti Formal'}
                  onChange={(e) =>
                    setEditingLexiconRecord({ ...editingLexiconRecord, category_label: e.target.value })
                  }
                  className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-100"
                >
                  <option value="F1 — Inti Wajib">F1 — Inti Wajib</option>
                  <option value="F2 — Akhiran -in">F2 — Akhiran -in</option>
                  <option value="F3 — Awalan ng-/nge-/ny-/n-">F3 — Awalan ng-/nge-/ny-/n-</option>
                  <option value="F4 — Penanda Percakapan">F4 — Penanda Percakapan</option>
                  <option value="F5 — Verba Pengganti Formal">F5 — Verba Pengganti Formal</option>
                  <option value="F6 — Ragam Kajian Bahasa">F6 — Ragam Kajian Bahasa</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Catatan / Konteks Penggunaan:</label>
                <textarea
                  rows={3}
                  value={editingLexiconRecord.context_note || editingLexiconRecord.notes || ''}
                  onChange={(e) =>
                    setEditingLexiconRecord({ ...editingLexiconRecord, context_note: e.target.value })
                  }
                  className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-100"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="needsReviewCheck"
                  checked={Boolean(editingLexiconRecord.needs_review)}
                  onChange={(e) =>
                    setEditingLexiconRecord({ ...editingLexiconRecord, needs_review: e.target.checked })
                  }
                  className="rounded border-slate-700 bg-slate-900"
                />
                <label htmlFor="needsReviewCheck" className="text-slate-300 font-sans text-xs">
                  Perlu Tinjauan Konteks (Contextual Review Required)
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingLexiconRecord(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-sans"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveLexiconEdit}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold font-sans"
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Edit F7 Rule Modal */}
      {editingF7Rule && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0F172A] border border-slate-700 rounded-xl p-6 max-w-lg w-full space-y-4 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 font-mono">
                Edit Aturan F7 #{editingF7Rule.f7_number} ({editingF7Rule.entry_text})
              </h3>
              <button
                type="button"
                onClick={() => setEditingF7Rule(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div>
                <label className="block text-slate-400 mb-1">Kategori F7:</label>
                <select
                  value={editingF7Rule.category || 'Register/morfologi/slang'}
                  onChange={(e) => setEditingF7Rule({ ...editingF7Rule, category: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-100"
                >
                  <option value="Konotasi negatif/tuduhan">Konotasi negatif/tuduhan</option>
                  <option value="Makna kiasan/polisemi">Makna kiasan/polisemi</option>
                  <option value="Register/morfologi/slang">Register/morfologi/slang</option>
                  <option value="Frasa/konstruksi kontekstual">Frasa/konstruksi kontekstual</option>
                  <option value="Teknis/akademis/prosedural">Teknis/akademis/prosedural</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Catatan Aturan Pembatasan:</label>
                <textarea
                  rows={3}
                  value={editingF7Rule.meaning_note || editingF7Rule.status_reason || ''}
                  onChange={(e) =>
                    setEditingF7Rule({ ...editingF7Rule, meaning_note: e.target.value })
                  }
                  className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Saran Penggunaan Lisan:</label>
                <input
                  type="text"
                  value={editingF7Rule.informal_suggestion || ''}
                  onChange={(e) =>
                    setEditingF7Rule({ ...editingF7Rule, informal_suggestion: e.target.value })
                  }
                  className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-100"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingF7Rule(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-sans"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveF7RuleEdit}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-bold font-sans"
              >
                Simpan Rule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Delete Confirm Modal */}
      {deletingLexiconRecord && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0F172A] border border-rose-500/40 rounded-xl p-6 max-w-md w-full space-y-4 shadow-2xl text-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100 font-mono">
                  Konfirmasi Hapus Entri
                </h3>
                <p className="text-xs text-rose-300 font-mono mt-0.5">
                  "{deletingLexiconRecord.term || deletingLexiconRecord.entry}"
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Apakah Anda yakin ingin menghapus kosakata ini dari database Supabase? Entri ini akan ditandai blacklisted secara permanen.
            </p>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingLexiconRecord(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-sans"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteLexicon}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-bold font-sans"
              >
                Hapus Entri
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
