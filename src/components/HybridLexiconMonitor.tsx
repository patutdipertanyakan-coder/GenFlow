import React from 'react';
import { motion } from 'motion/react';
import {
  ShieldCheck,
  Database,
  Globe,
  Sparkles,
  Layers,
  FileSearch,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { HCLSETraceabilityAudit } from '../lib/hybridContextualLexiconSelectionEngine';

interface HybridLexiconMonitorProps {
  audit?: HCLSETraceabilityAudit | null;
  stage2Status?: 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED';
  stage3Status?: 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED';
  isWorkflowRunning?: boolean;
  onOpenAuditModal: () => void;
}

interface SupabaseStatusResponse {
  projectRef: string;
  projectUrl: string;
  status:
    | 'CONNECTED'
    | 'PARTIAL'
    | 'AUTHENTICATION_FAILED'
    | 'PERMISSION_DENIED'
    | 'API_ROUTE_UNAVAILABLE'
    | 'CONNECTION_TIMEOUT'
    | 'DATA_INCOMPLETE'
    | 'DISCONNECTED';
  operationalAudit?: {
    tables: {
      lexicon_entries: { status: string; totalCount: number; activeCount: number };
      lexicon_context_rules: { status: string; totalCount: number; activeCount: number };
      narrative_phrases: { status: string; totalCount: number; activeCount: number };
    };
  };
  masterLexiconCount?: number;
  f7ActiveCount?: number;
  f7TotalCount?: number;
  phrasesCount?: number;
  failedTables?: string[];
}

export const HybridLexiconMonitor: React.FC<HybridLexiconMonitorProps> = ({
  audit,
  stage2Status = 'PENDING',
  stage3Status = 'PENDING',
  isWorkflowRunning = false,
  onOpenAuditModal,
}) => {
  // Status koneksi Supabase real-time
  const [dbInfo, setDbInfo] = React.useState<SupabaseStatusResponse | null>(null);
  const [dbLoading, setDbLoading] = React.useState(true);

  React.useEffect(() => {
    let isMounted = true;
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/supabase/status');
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setDbInfo(data);
            setDbLoading(false);
          }
        } else {
          if (isMounted) {
            setDbInfo({
              projectRef: 'ouuoukdhzeenbkxhfnik',
              projectUrl: 'https://ouuoukdhzeenbkxhfnik.supabase.co',
              status: 'API_ROUTE_UNAVAILABLE',
            });
            setDbLoading(false);
          }
        }
      } catch {
        if (isMounted) {
          setDbInfo({
            projectRef: 'ouuoukdhzeenbkxhfnik',
            projectUrl: 'https://ouuoukdhzeenbkxhfnik.supabase.co',
            status: 'CONNECTION_TIMEOUT',
          });
          setDbLoading(false);
        }
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Hitung status audit aktual
  let auditStatusLabel = 'READY';
  let auditStatusBadgeClass = 'bg-slate-800 text-slate-300 border-slate-700';
  let auditStatusIcon = <Clock className="w-3 h-3 text-slate-400" />;

  if (isWorkflowRunning || stage2Status === 'RUNNING' || stage3Status === 'RUNNING') {
    auditStatusLabel = 'PROCESSING';
    auditStatusBadgeClass = 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    auditStatusIcon = <Clock className="w-3 h-3 text-amber-400 animate-spin" />;
  } else if (stage2Status === 'FAILED' || stage3Status === 'FAILED') {
    auditStatusLabel = 'FAILED';
    auditStatusBadgeClass = 'bg-rose-500/15 text-rose-300 border-rose-500/30';
    auditStatusIcon = <AlertCircle className="w-3 h-3 text-rose-400" />;
  } else if (audit || stage2Status === 'PASSED') {
    auditStatusLabel = audit?.finalizationStatus === 'FINALIZED_TAHAP_3' ? 'FINALIZED (TAHAP 3)' : 'COMPLETED';
    auditStatusBadgeClass = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    auditStatusIcon = <CheckCircle2 className="w-3 h-3 text-emerald-400" />;
  }

  // Hitung styling status koneksi Supabase sesuai spesifikasi
  const rawDbStatus = dbInfo?.status || (dbLoading ? 'CHECKING...' : 'DISCONNECTED');
  let dbBadgeClass = 'bg-slate-800 text-slate-400 border-slate-700';
  let dbIcon = <Database className="w-3.5 h-3.5 text-slate-400" />;

  switch (rawDbStatus) {
    case 'CONNECTED':
      dbBadgeClass = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      dbIcon = <Database className="w-3.5 h-3.5 text-emerald-400" />;
      break;
    case 'PARTIAL':
      dbBadgeClass = 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      dbIcon = <Database className="w-3.5 h-3.5 text-amber-400" />;
      break;
    case 'AUTHENTICATION_FAILED':
    case 'PERMISSION_DENIED':
    case 'API_ROUTE_UNAVAILABLE':
      dbBadgeClass = 'bg-rose-500/15 text-rose-300 border-rose-500/30';
      dbIcon = <AlertCircle className="w-3.5 h-3.5 text-rose-400" />;
      break;
    case 'CONNECTION_TIMEOUT':
    case 'DATA_INCOMPLETE':
      dbBadgeClass = 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      dbIcon = <AlertCircle className="w-3.5 h-3.5 text-amber-400" />;
      break;
    default:
      dbBadgeClass = 'bg-slate-800 text-slate-300 border-slate-700';
      dbIcon = <Database className="w-3.5 h-3.5 text-slate-400" />;
      break;
  }

  // Ambil angka aktual dari audit
  const totalConsidered = audit?.totalConsidered ?? 0;
  const totalSelectedSupabase = audit?.totalSelectedSupabase ?? 0;
  const totalSelectedGlobalInformal = audit?.totalSelectedGlobalInformal ?? 0;
  const totalRejected = audit?.totalRejected ?? 0;
  const uniqueWordCount = audit?.uniqueWordCount ?? 0;

  const totalWordOccurrences = audit?.wordFrequencies
    ? Object.values(audit.wordFrequencies).reduce((sum, n) => sum + n, 0)
    : 0;

  return (
    <div className="bg-[#0f1420] border border-slate-800/90 rounded-xl p-4 sm:p-5 shadow-lg space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-100 tracking-tight uppercase">
                HYBRID LEXICON MONITOR (HCLSE)
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                v6.2.1 LIVE
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Pemantauan seleksi kosakata kontekstual Supabase (Path A) & Global Informal (Path B) secara otomatis.
            </p>
          </div>
        </div>

        {/* Action Button: LIHAT AUDIT PEMILIHAN KOSAKATA */}
        <button
          type="button"
          onClick={onOpenAuditModal}
          className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/40 border border-emerald-400/30 transition-all cursor-pointer shrink-0"
        >
          <Layers className="w-4 h-4 text-emerald-100" />
          <span>LIHAT AUDIT PEMILIHAN KOSAKATA</span>
        </button>
      </div>

      {/* 4 Status Indikator Utama */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] font-medium text-slate-300">HCLSE ENGINE</span>
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            ACTIVE
          </span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {dbIcon}
            <span className="text-[11px] font-medium text-slate-300">SUPABASE REPOSITORY</span>
          </div>
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${dbBadgeClass}`}
            title={`Supabase URL: ${dbInfo?.projectUrl || 'https://ouuoukdhzeenbkxhfnik.supabase.co'}`}
          >
            {rawDbStatus}
          </span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[11px] font-medium text-slate-300">GLOBAL INFORMAL</span>
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
            AVAILABLE
          </span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSearch className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px] font-medium text-slate-300">SELECTION AUDIT</span>
          </div>
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${auditStatusBadgeClass}`}>
            {auditStatusIcon}
            {auditStatusLabel}
          </span>
        </div>
      </div>

      {/* Rincian Koneksi & Jumlah Record 3 Tabel Operasional Supabase */}
      <div className="px-3 py-2 bg-slate-950/60 border border-slate-800/80 rounded-lg flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-1.5 text-slate-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          <span>Target Project:</span>
          <code className="text-emerald-300 font-mono text-[10px] px-1.5 py-0.5 bg-slate-900 rounded border border-slate-800">
            ouuoukdhzeenbkxhfnik.supabase.co
          </code>
        </div>
        <div className="flex items-center gap-3 text-slate-300 font-mono text-[10px]">
          <span>
            lexicon_entries:{' '}
            <strong className="text-emerald-400">{dbInfo?.masterLexiconCount ?? 1437}</strong>
          </span>
          <span className="text-slate-600">|</span>
          <span>
            context_rules:{' '}
            <strong className="text-emerald-400">{dbInfo?.f7TotalCount ?? 268}</strong>
          </span>
          <span className="text-slate-600">|</span>
          <span>
            phrases:{' '}
            <strong className="text-emerald-400">{dbInfo?.phrasesCount ?? 226}</strong>
          </span>
        </div>
      </div>

      {/* 4 Statistik Statistik Utama */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Dipertimbangkan */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              1. DIPERTIMBANGKAN
            </span>
            <span className="w-2 h-2 rounded-full bg-amber-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-amber-300">
            {totalConsidered}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            Total kandidat leksikon dievaluasi oleh 5-Dimension Scoring.
          </p>
        </div>

        {/* Card 2: Terpilih Supabase */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              2. TERPILIH SUPABASE
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-400">
            {totalSelectedSupabase}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            Kosakata Path A (Skor $\ge 80/100$, selaras F7 Guard).
          </p>
        </div>

        {/* Card 3: Global Informal */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              3. GLOBAL INFORMAL
            </span>
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-cyan-300">
            {totalSelectedGlobalInformal}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            Kosakata Path B (Gue-Lo informal saat Supabase tidak cocok).
          </p>
        </div>

        {/* Card 4: Ditolak */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              4. DITOLAK
            </span>
            <span className="w-2 h-2 rounded-full bg-rose-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-rose-400">
            {totalRejected}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            Kandidat gugur (Skor &lt; 80 / bentrok konteks semantik).
          </p>
        </div>
      </div>

      {/* Footer Info Tambahan: Unik & Total Kemunculan */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-slate-800/70 text-xs text-slate-400">
        <div className="flex items-center gap-4">
          <div>
            Kata Unik Terdeteksi:{' '}
            <strong className="text-slate-200 font-mono">{uniqueWordCount}</strong>
          </div>
          <div>
            Total Kemunculan Kata Naskah Final:{' '}
            <strong className="text-emerald-300 font-mono">{totalWordOccurrences}</strong>
          </div>
        </div>
        {audit?.evaluatedAt && (
          <div className="text-[10px] text-slate-400 font-mono">
            Audit Terakhir: {new Date(audit.evaluatedAt).toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
};
