/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BlockPostProductionMetadata,
  BlockPostProductionOperation,
  FailoverStatus,
  GenNASConfig,
  GenerationStageStep,
  LOCKED_CRITICAL_PERSPECTIVE,
  LOCKED_DURATION_MODE,
  LOCKED_WPM,
  OperationMode,
  WorkflowEngineState,
  WorkflowStageId,
} from './lib/types';
import {
  applyAutoEnforce,
  applyBlockPerdalamDeterministic,
  applyBlockTransisiDeterministic,
  applyRevisiKoma,
  applyRevisiTransisi,
  applySingleBlockEnforce,
  applySQNN,
  countWordsConsistent,
  DOUBLE_QUOTE_CHARS_REGEX,
  calculateStageTargets,
  compileVoiceScript,
  enforceLockedConfig,
  inferTopicFromOutline,
  validateFullScript,
} from './lib/validatorAndPipeline';
import {
  canExecuteStage,
  createInitialWorkflowState,
  executeStage1Sync,
  executeStage2DraftV0,
  executeStage3AuditV0,
  executeStage4AutomaticF1F8Selection,
  executeStage5AutomaticProfanitySelection,
  executeStage6AutomaticPhraseSelection,
  executeStage7FinalScript,
  executeStage8FinalApproval,
  invalidateWorkflowFromStage,
  runCompleteWorkflow,
} from './lib/workflowEngine';
import { ConfigPanel } from './components/ConfigPanel';
import { EditorAndQualityPanel } from './components/EditorAndQualityPanel';
import { WorkflowEnginePanel } from './components/WorkflowEnginePanel';
import { HybridLexiconMonitor } from './components/HybridLexiconMonitor';
import { HCLSEAuditModal } from './components/HCLSEAuditModal';
import { finalizeHCLSEAuditForScript } from './lib/hybridContextualLexiconSelectionEngine';
import { LexiconBankView } from './components/LexiconBankView';
import { MasterPromptView } from './components/MasterPromptView';
import { MasterFrameworkModal } from './components/MasterFrameworkModal';
import {
  extractGenflowMasterFramework,
  createEmptyMasterFramework,
  GenflowMasterFrameworkData,
} from './lib/genflowMasterFramework';
import { GlobalTooltipManager } from './components/SmartTooltip';
import {
  exportAuditJsonFile,
  exportCleanScriptTxt,
  exportScriptDocx,
} from './lib/exportUtils';
import { FireworksCelebration } from './components/FireworksCelebration';
import {
  getSoundNotificationPreference,
  playGenerationSuccessSound,
  setSoundNotificationPreference,
} from './lib/soundNotification';
import { DeveloperToolsModal } from './components/DeveloperToolsModal';
import { LiveUpdateCenterModal } from './components/LiveUpdateCenterModal';
import { ListEngineModal } from './components/ListEngineModal';
import { RecapView } from './components/RecapView';
import releaseManifest from './data/releaseManifest.json';
import {
  ReleaseRecord,
  calculateUnreadReleases,
} from './lib/changeTracker';
import { captureProjectStateSnapshot } from './lib/isolatedEdgeValidator';
import { Key, Cpu, CheckCircle2, AlertTriangle, Terminal, SlidersHorizontal, ChevronDown, BookOpen, FileText, Sparkles, ArrowLeft, Library, Workflow } from 'lucide-react';

const STORAGE_KEY = 'gennas_pro_v53_studio_state';

const DEFAULT_MODELS = [
  'gemini-3-flash-preview',
  'gemini-3.5-flash',
  'gemini-3.8-flash',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
];

// Mapping 22 warna visual unik untuk tiap Tier API Failover
const TIER_COLOR_MAP = [
  { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30', dot: 'bg-emerald-400' }, // Tier 1
  { bg: 'bg-teal-500/15', text: 'text-teal-400', border: 'border-teal-500/30', dot: 'bg-teal-400' }, // Tier 2
  { bg: 'bg-cyan-500/15', text: 'text-cyan-400', border: 'border-cyan-500/30', dot: 'bg-cyan-400' }, // Tier 3
  { bg: 'bg-sky-500/15', text: 'text-sky-400', border: 'border-sky-500/30', dot: 'bg-sky-400' }, // Tier 4
  { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30', dot: 'bg-blue-400' }, // Tier 5
  { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30', dot: 'bg-indigo-400' }, // Tier 6
  { bg: 'bg-violet-500/15', text: 'text-violet-400', border: 'border-violet-500/30', dot: 'bg-violet-400' }, // Tier 7
  { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30', dot: 'bg-purple-400' }, // Tier 8
  { bg: 'bg-fuchsia-500/15', text: 'text-fuchsia-400', border: 'border-fuchsia-500/30', dot: 'bg-fuchsia-400' }, // Tier 9
  { bg: 'bg-pink-500/15', text: 'text-pink-400', border: 'border-pink-500/30', dot: 'bg-pink-400' }, // Tier 10
  { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30', dot: 'bg-rose-400' }, // Tier 11
  { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30', dot: 'bg-amber-400' }, // Tier 12
  { bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/30', dot: 'bg-yellow-400' }, // Tier 13
  { bg: 'bg-lime-500/15', text: 'text-lime-400', border: 'border-lime-500/30', dot: 'bg-lime-400' }, // Tier 14
  { bg: 'bg-green-500/15', text: 'text-green-400', border: 'border-green-500/30', dot: 'bg-green-400' }, // Tier 15
  { bg: 'bg-emerald-600/15', text: 'text-emerald-300', border: 'border-emerald-600/30', dot: 'bg-emerald-300' }, // Tier 16
  { bg: 'bg-cyan-600/15', text: 'text-cyan-300', border: 'border-cyan-600/30', dot: 'bg-cyan-300' }, // Tier 17
  { bg: 'bg-blue-600/15', text: 'text-blue-300', border: 'border-blue-600/30', dot: 'bg-blue-300' }, // Tier 18
  { bg: 'bg-purple-600/15', text: 'text-purple-300', border: 'border-purple-600/30', dot: 'bg-purple-300' }, // Tier 19
  { bg: 'bg-pink-600/15', text: 'text-pink-300', border: 'border-pink-600/30', dot: 'bg-pink-300' }, // Tier 20
  { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30', dot: 'bg-orange-400' }, // Tier 21
  { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30', dot: 'bg-red-400' }, // Tier 22
];

function getTierStyle(index: number) {
  const safeIdx = Math.max(0, Math.min(index, TIER_COLOR_MAP.length - 1));
  return TIER_COLOR_MAP[safeIdx];
}

const DEFAULT_CONFIG: GenNASConfig = enforceLockedConfig({
  topik: '',
  konteks: LOCKED_CRITICAL_PERSPECTIVE,
  faktaTerverifikasi: '', // Kosong secara default per Instruksi H
  durasiMenit: 12,
  wpm: LOCKED_WPM,
  modeDurasi: LOCKED_DURATION_MODE,
  jumlahBlok: 5,
  struktur: [8, 17, 45, 20, 10],
  operasi: 'NASKAH_FINAL',
  allowEditorialRewrite: false,
  judulOutput: false,
  primaryModel: 'gemini-3-flash-preview',
  fallbackModel: 'gemini-3.8-flash',
});

const INITIAL_FAILOVER_STATUS: FailoverStatus = {
  status: 'safe',
  activeKeyIndex: 0,
  label: 'Server 1',
  previousLabel: null,
  activeModel: 'gemini-3-flash-preview',
  availableModels: DEFAULT_MODELS,
  totalTiers: 22,
  appVersion: 'v5.5',
};

type ActiveTab = 'STUDIO' | 'LEXICON' | 'MASTER_PROMPT';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('STUDIO');
  const [workspaceMode, setWorkspaceMode] = useState<'DRAFT' | 'RECAP'>('DRAFT');
  const [showDevTools, setShowDevTools] = useState(false);
  const [showListEngine, setShowListEngine] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [config, setConfig] = useState<GenNASConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.config) {
          const merged = enforceLockedConfig({
            ...DEFAULT_CONFIG,
            ...parsed.config,
            konteks: LOCKED_CRITICAL_PERSPECTIVE,
            wpm: LOCKED_WPM,
            modeDurasi: LOCKED_DURATION_MODE,
          });
          if (!DEFAULT_MODELS.includes(merged.primaryModel)) {
            merged.primaryModel = 'gemini-3-flash-preview';
          }
          if (!DEFAULT_MODELS.includes(merged.fallbackModel)) {
            merged.fallbackModel = 'gemini-3.8-flash';
          }
          return merged;
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_CONFIG;
  });

  // Kondisi A — Sebelum Generate: cleanScript kosong secara default hingga tombol Generate ditekan
  const [cleanScript, setCleanScript] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.cleanScript === 'string') {
          return parsed.cleanScript;
        }
      }
    } catch {
      // ignore
    }
    return '';
  });

  const [activeSourceDocumentName, setActiveSourceDocumentName] =
    useState<string>(() => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed.activeSourceDocumentName === 'string') {
            return parsed.activeSourceDocumentName;
          }
        }
      } catch {
        // ignore
      }
      return '';
    });

  const [workflowState, setWorkflowState] = useState<WorkflowEngineState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          parsed.workflowState &&
          parsed.workflowState.stages &&
          parsed.config?.faktaTerverifikasi?.trim()
        ) {
          return parsed.workflowState;
        }
      }
    } catch {
      // ignore
    }
    return createInitialWorkflowState('', '');
  });

  const [masterFramework, setMasterFramework] = useState<GenflowMasterFrameworkData>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          parsed.masterFramework &&
          parsed.masterFramework.documentIdentity?.fileName !== 'BELUM ADA DOKUMEN' &&
          parsed.config?.faktaTerverifikasi?.trim()
        ) {
          return parsed.masterFramework;
        }
      }
    } catch {
      // ignore
    }
    return createEmptyMasterFramework();
  });
  const [isFrameworkConfirmed, setIsFrameworkConfirmed] = useState<boolean>(false);
  const [showMasterFrameworkModal, setShowMasterFrameworkModal] = useState<boolean>(false);
  const [showHCLSEAuditModal, setShowHCLSEAuditModal] = useState<boolean>(false);

  const [soundEnabled, setSoundEnabled] = useState<boolean>(() =>
    getSoundNotificationPreference()
  );
  const [failoverStatus, setFailoverStatus] = useState<FailoverStatus>(
    INITIAL_FAILOVER_STATUS
  );
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStageStep, setLoadingStageStep] =
    useState<GenerationStageStep>(1);
  const [activeOperation, setActiveOperation] = useState<OperationMode | null>(
    null
  );
  const [lastModelUsed, setLastModelUsed] = useState<string>(
    'gemini-3-flash-preview (API Utama · Tier 1/22)'
  );
  const [statusBanner, setStatusBanner] = useState<string>('');
  const [statusBannerType, setStatusBannerType] = useState<
    'success' | 'warning' | 'info'
  >('info');

  // State Monitoring Pascaproduksi per Blok (PERDALAM & TRANSISI)
  const [activeBlockPostProd, setActiveBlockPostProd] = useState<{
    blockIndex: number;
    operation: BlockPostProductionOperation;
  } | null>(null);
  const [blockPostProdResults, setBlockPostProdResults] = useState<
    Record<number, BlockPostProductionMetadata>
  >({});

  // State Live Update Center & System Change Tracker
  const [showUpdateCenter, setShowUpdateCenter] = useState(false);
  const [releases, setReleases] = useState<ReleaseRecord[]>(
    () => (releaseManifest.releases as ReleaseRecord[]) || []
  );
  const [currentVersion, setCurrentVersion] = useState<string>(
    () => releaseManifest.current_version || '5.2.0'
  );
  const [readReleaseIds, setReadReleaseIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('gennas_read_releases');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return ['rel-5.0.0-20261025', 'rel-5.1.0-20261029'];
  });
  const [sseStatus, setSseStatus] = useState<
    'CONNECTED' | 'RECONNECTING' | 'OFFLINE'
  >('CONNECTED');
  const [showFireworks, setShowFireworks] = useState(false);

  const { unreadCount } = useMemo(
    () => calculateUnreadReleases(releases, readReleaseIds),
    [releases, readReleaseIds]
  );
  const hasUnreadUpdates = unreadCount > 0;

  const handleMarkReleaseRead = (releaseId: string) => {
    setReadReleaseIds((prev) => {
      if (prev.includes(releaseId)) return prev;
      const next = [...prev, releaseId];
      try {
        localStorage.setItem('gennas_read_releases', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });

    fetch('/api/system/releases/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ releaseId }),
    }).catch(() => {});
  };

  // Real-time synchronization via Server-Sent Events (SSE) with graceful fallback
  useEffect(() => {
    let evtSource: EventSource | null = null;
    let fallbackInterval: NodeJS.Timeout | null = null;

    try {
      evtSource = new EventSource('/api/system/releases/stream');

      evtSource.onopen = () => {
        setSseStatus('CONNECTED');
      };

      evtSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data?.current_version) {
            setCurrentVersion(data.current_version);
          }
          if (data?.active_release) {
            setReleases((prev) => {
              const exists = prev.some(
                (r) => r.release_id === data.active_release.release_id
              );
              if (!exists) {
                return [data.active_release, ...prev];
              }
              return prev;
            });
          }
        } catch {
          // ignore
        }
      };

      evtSource.onerror = () => {
        setSseStatus('RECONNECTING');
      };
    } catch {
      setSseStatus('OFFLINE');
    }

    const syncReleases = async () => {
      try {
        const res = await fetch('/api/system/releases');
        if (res.ok) {
          const data = await res.json();
          if (data?.releases) setReleases(data.releases);
          if (data?.current_version) setCurrentVersion(data.current_version);
        }
      } catch {
        // offline
      }
    };

    fallbackInterval = setInterval(syncReleases, 45000);

    return () => {
      if (evtSource) evtSource.close();
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  }, []);

  // Ref untuk membatalkan proses generasi yang masih berjalan saat Reset ditekan
  const generationRequestIdRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Simpan state proyek ke localStorage secara aman
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          config,
          cleanScript,
          activeSourceDocumentName,
          workflowState,
        })
      );
    } catch {
      // ignore quota error
    }
  }, [config, cleanScript, activeSourceDocumentName, workflowState]);

  // Cek status koneksi & 22-Tier Failover System secara realtime
  useEffect(() => {
    let isMounted = true;
    const fetchStatus = () => {
      fetch('/api/status')
        .then((r) => r.json())
        .then((data) => {
          if (!isMounted) return;
          if (typeof data.activeKeyIndex === 'number') {
            setFailoverStatus((prev) => {
              if (
                prev.activeKeyIndex !== data.activeKeyIndex &&
                data.activeKeyIndex > 0
              ) {
                setStatusBannerType('warning');
                setStatusBanner(
                  data.switchReason ||
                    `Failover aktif: Kuota limit tercapai. Beralih ke ${data.label} (Tier ${data.activeKeyIndex + 1}/${data.totalTiers || 22}).`
                );
              }
              return {
                status: data.status || 'safe',
                activeKeyIndex: data.activeKeyIndex,
                label: data.label || 'API Utama',
                previousLabel: data.previousLabel || null,
                activeModel: data.activeModel || 'gemini-3-flash-preview',
                availableModels: data.availableModels || DEFAULT_MODELS,
                totalTiers: data.totalTiers || 22,
                appVersion: data.appVersion || 'v5.5',
              };
            });
            setLastModelUsed(
              `${data.activeModel || 'gemini-3-flash-preview'} (${data.label || 'API Utama'} · Tier ${(data.activeKeyIndex ?? 0) + 1}/${data.totalTiers || 22})`
            );
          }
        })
        .catch(() => {
          // Fallback offline tetap berjalan
        });
    };

    fetchStatus();
    const timer = setInterval(fetchStatus, 2000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  const handleToggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      setSoundNotificationPreference(next);
      return next;
    });
  };

  // Fungsi Tombol Reset di bagian KERANGKA NASKAH & SUMBER
  const handleResetOutlineAndWorkspace = () => {
    // 1. Batalkan proses generasi yang sedang berjalan dan cegah hasil lama muncul kembali
    generationRequestIdRef.current += 1;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setActiveOperation(null);
    setLoadingStageStep(1);
    setShowFireworks(false);

    // 2. Kosongkan kerangka naskah, nama dokumen aktif, token terlindungi SAP, dan topik otomatis
    //    Tanpa menghapus Master Prompt, Bank Kosakata F1–F8, aturan Non-SARA, WPM=135, atau FLEKSIBEL
    setActiveSourceDocumentName('');
    setConfig((prev) =>
      enforceLockedConfig({
        ...prev,
        faktaTerverifikasi: '',
        topik: '',
        konteks: LOCKED_CRITICAL_PERSPECTIVE,
        wpm: LOCKED_WPM,
        modeDurasi: LOCKED_DURATION_MODE,
      })
    );

    // 3. Kosongkan seluruh blok SCTF 1–5, indikator kualitas, dan reset alur kerja ke Tahap 1
    setCleanScript('');
    setStatusBanner('');
    setActiveBlockPostProd(null);
    setBlockPostProdResults({});
    setIsFrameworkConfirmed(false);
    setMasterFramework(createEmptyMasterFramework());
    setWorkflowState(createInitialWorkflowState('', ''));

    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const handleCycleTier = async () => {
    try {
      const res = await fetch('/api/failover/cycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'tier' }),
      });
      const data = await res.json();
      if (res.ok && typeof data.activeKeyIndex === 'number') {
        setFailoverStatus(data);
        setLastModelUsed(
          `${data.activeModel} (${data.label} · Tier ${data.activeKeyIndex + 1}/${data.totalTiers})`
        );
      }
    } catch {
      // ignore
    }
  };

  const handleCycleModel = async () => {
    try {
      const res = await fetch('/api/failover/cycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'model' }),
      });
      const data = await res.json();
      if (res.ok && data.activeModel) {
        setFailoverStatus(data);
        setConfig((prev) => ({ ...prev, primaryModel: data.activeModel }));
        setLastModelUsed(
          `${data.activeModel} (${data.label} · Tier ${data.activeKeyIndex + 1}/${data.totalTiers})`
        );
      }
    } catch {
      // ignore
    }
  };

  const stagePlan = useMemo(
    () =>
      calculateStageTargets(
        config.durasiMenit,
        LOCKED_WPM,
        config.struktur,
        config.jumlahBlok
      ),
    [config.durasiMenit, config.struktur, config.jumlahBlok]
  );

  const audit = useMemo(
    () => validateFullScript(cleanScript, config),
    [cleanScript, config]
  );

  const blocks = useMemo(() => {
    // FINAL-ONLY DISPLAY (Instruksi 10):
    // Blok narasi hanya diisi naskah apabila Tahap 3 sudah PASSED dan isFinalApproved === true
    if (
      !cleanScript.trim() ||
      !workflowState.isFinalApproved ||
      workflowState.stages[3]?.status !== 'PASSED'
    ) {
      return Array.from({ length: config.jumlahBlok }, () => '');
    }
    const rawLines = cleanScript.replace(/\r\n/g, '\n').split('\n');
    while (rawLines.length < config.jumlahBlok) {
      rawLines.push('');
    }
    return rawLines;
  }, [cleanScript, config.jumlahBlok, workflowState.isFinalApproved, workflowState.stages]);

  const voiceScript = useMemo(
    () => compileVoiceScript(cleanScript, { enableSubtleAudioTags: false }),
    [cleanScript]
  );

  const handleConfigChange = (updated: Partial<GenNASConfig>) => {
    setConfig((prev) =>
      enforceLockedConfig({
        ...prev,
        ...updated,
        konteks: LOCKED_CRITICAL_PERSPECTIVE,
        wpm: LOCKED_WPM,
        modeDurasi: LOCKED_DURATION_MODE,
      })
    );

    // Invalidation jika kerangka sumber berubah
    if (updated.faktaTerverifikasi !== undefined) {
      // FINAL-ONLY DISPLAY: Mengunggah/mengubah kerangka langsung mengosongkan tampilan naskah sebelumnya
      setCleanScript('');
      setActiveBlockPostProd(null);
      setBlockPostProdResults({});
      const trimmed = updated.faktaTerverifikasi.trim();
      if (trimmed.length > 15) {
        try {
          const stage1Data = executeStage1Sync(
            trimmed,
            activeSourceDocumentName || 'kerangka-sumber.txt'
          );
          if (stage1Data.masterFramework) {
            setMasterFramework(stage1Data.masterFramework);
            setIsFrameworkConfirmed(false);
          }
          setWorkflowState((prev) => {
            const next = invalidateWorkflowFromStage(prev, 2);
            next.extractionData = stage1Data;
            next.masterFramework = stage1Data.masterFramework;
            next.stages[1].status = 'PASSED';
            next.stages[1].completedAt = Date.now();
            next.stages[1].summary = `Kerangka berhasil diekstrak (${stage1Data.wordCount} kata, topik: "${stage1Data.inferredTopic}")`;
            next.stages[1].data = stage1Data;
            next.currentStageId = 2;
            return next;
          });
        } catch {
          setMasterFramework(createEmptyMasterFramework());
          setWorkflowState((prev) => invalidateWorkflowFromStage(prev, 1));
        }
      } else {
        setMasterFramework(createEmptyMasterFramework());
        setWorkflowState((prev) => invalidateWorkflowFromStage(prev, 1));
      }
    }

    if (updated.primaryModel) {
      setFailoverStatus((prev) => ({
        ...prev,
        activeModel: updated.primaryModel!,
      }));
    }
  };

  const syncPostProductionScriptToWorkflow = (nextScript: string, effectiveCfg: GenNASConfig) => {
    const nextAudit = validateFullScript(nextScript, effectiveCfg);
    setWorkflowState((prev) => {
      if (!prev.isFinalApproved || (prev.stages as any)[6]?.status !== 'PASSED') {
        return prev;
      }
      return {
        ...prev,
        finalAudit: nextAudit,
        finalScriptData: prev.finalScriptData
          ? {
              ...prev.finalScriptData,
              script: nextScript,
              blocks: nextScript.split('\n'),
              wordCount: countWordsConsistent(nextScript).length,
              audit: nextAudit,
            }
          : undefined,
      };
    });
    return nextAudit;
  };

  const handleBlockEdit = (index: number, newText: string) => {
    const sanitizedBlock = newText.replace(/\r?\n/g, ' ');
    const nextBlocks = [...blocks];
    while (nextBlocks.length < config.jumlahBlok) {
      nextBlocks.push('');
    }
    nextBlocks[index] = sanitizedBlock;
    const joined = nextBlocks.join('\n');
    const nextScript = joined.trim() ? joined : '';
    setCleanScript(nextScript);
    syncPostProductionScriptToWorkflow(nextScript, config);
  };

  const handleRawCleanScriptEdit = (newRawScript: string) => {
    setCleanScript(newRawScript);
    syncPostProductionScriptToWorkflow(newRawScript, config);
  };

  const finalizeGenerationOutput = (
    op: OperationMode,
    producedScript: string,
    effectiveConfig: GenNASConfig
  ) => {
    let safeScript = producedScript;
    if (DOUBLE_QUOTE_CHARS_REGEX.test(safeScript)) {
      safeScript = applySQNN(safeScript, effectiveConfig).normalizedScript;
    }
    setCleanScript(safeScript);
    const finalAudit = syncPostProductionScriptToWorkflow(safeScript, effectiveConfig);

    if (op === 'NASKAH_FINAL') {
      setShowFireworks(true);
      if (soundEnabled) {
        playGenerationSuccessSound();
      }
      if (finalAudit.passed && finalAudit.nonSaraPassed && finalAudit.quoteFree?.passed) {
        setStatusBannerType('success');
        setStatusBanner('Naskah final selesai dibuat dan lulus audit.');
      } else if (!finalAudit.quoteFree?.passed) {
        setStatusBannerType('warning');
        setStatusBanner('Naskah selesai. Status: Quote-Free perlu perbaikan.');
      } else {
        setStatusBannerType('warning');
        setStatusBanner('Naskah selesai. Beberapa bagian perlu diperbaiki.');
      }
    } else if (op === 'AUTO_ENFORCE') {
      setStatusBannerType(finalAudit.passed ? 'success' : 'warning');
      setStatusBanner(
        finalAudit.passed
          ? 'Perbaikan otomatis selesai dan lulus semua indikator.'
          : 'Perbaikan selesai. Beberapa indikator masih perlu dicek.'
      );
    } else if (op === 'EXPANDER') {
      setStatusBannerType(finalAudit.passed ? 'success' : 'warning');
      setStatusBanner('Pembahasan berhasil diperdalam.');
    } else if (op === 'REVISI_TRANSISI') {
      setStatusBannerType(finalAudit.passed ? 'success' : 'warning');
      setStatusBanner('Transisi antarblok berhasil diperhalus.');
    } else if (op === 'AUDIT_JSON') {
      setStatusBannerType(finalAudit.passed ? 'success' : 'warning');
      setStatusBanner(
        finalAudit.passed
          ? 'Audit selesai: Naskah lulus semua aturan.'
          : 'Audit selesai: Ditemukan bagian yang perlu diperbaiki.'
      );
    }
  };

  const handleExecuteOperation = async (op: OperationMode) => {
    if (isLoading) return;
    setShowFireworks(false);

    if (op === 'NASKAH_FINAL') {
      return handleRunFullWorkflow();
    }

    const effectiveOutline = config.faktaTerverifikasi.trim();
    if (!effectiveOutline) {
      setStatusBannerType('warning');
      setStatusBanner('Silakan unggah dokumen kerangka naskah terlebih dahulu.');
      return;
    }
    const lockedPayload = enforceLockedConfig({
      ...config,
      faktaTerverifikasi: effectiveOutline,
      topik: config.topik || inferTopicFromOutline(effectiveOutline).inferredTopic,
      konteks: LOCKED_CRITICAL_PERSPECTIVE,
      wpm: LOCKED_WPM,
      modeDurasi: LOCKED_DURATION_MODE,
    });

    generationRequestIdRef.current += 1;
    const reqId = generationRequestIdRef.current;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Kondisi B — Tombol Generate Ditekan: Reset hasil validasi sebelumnya & aktifkan animasi buku
    setIsLoading(true);
    setActiveOperation(op);
    setStatusBanner('');
    setLoadingStageStep(1);

    const waitStage = (ms: number, nextStep: GenerationStageStep) =>
      new Promise<void>((resolve) => {
        setTimeout(() => {
          if (generationRequestIdRef.current === reqId) {
            setLoadingStageStep(nextStep);
          }
          resolve();
        }, ms);
      });

    try {
      // Tahap 1 -> 2 -> 3 sesuai proses aktual persiapan kerangka & StoryFlow
      await waitStage(140, 2);
      if (generationRequestIdRef.current !== reqId) return;
      await waitStage(140, 3);
      if (generationRequestIdRef.current !== reqId) return;

      let producedScript = '';
      let nextCfg = lockedPayload;

      try {
        const res = await fetch('/api/gennas/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            ...lockedPayload,
            operasi: op,
            inputNaskah: cleanScript,
          }),
        });

        if (generationRequestIdRef.current !== reqId) return;

        const data = await res.json();
        if (res.ok && data.cleanScript) {
          producedScript = data.cleanScript;
          if (data.inferredTopic) {
            nextCfg = enforceLockedConfig({
              ...lockedPayload,
              topik: data.inferredTopic,
              konteks: LOCKED_CRITICAL_PERSPECTIVE,
              wpm: LOCKED_WPM,
              modeDurasi: LOCKED_DURATION_MODE,
            });
            setConfig(nextCfg);
          }
          if (data.failoverStatus) {
            setFailoverStatus(data.failoverStatus);
          }
          if (data.modelUsed) {
            setLastModelUsed(data.modelUsed);
          }
        }
      } catch (err: any) {
        if (err?.name === 'AbortError' || generationRequestIdRef.current !== reqId) {
          return;
        }
      }

      if (generationRequestIdRef.current !== reqId) return;

      // Jika backend gagal dan ada naskah input yang valid, terapkan formatting/enforce tanpa template
      if (!producedScript) {
        const baseScript = cleanScript.trim();
        if (!baseScript) {
          setStatusBannerType('warning');
          setStatusBanner('Gagal menghasilkan naskah dari AI/Supabase. Pembuatan narasi tidak boleh menggunakan kalimat template lokal.');
          return;
        }
        if (op === 'REVISI_KOMA') {
          producedScript = applyRevisiKoma(baseScript);
        } else if (op === 'REVISI_TRANSISI') {
          producedScript = applyRevisiTransisi(baseScript);
        } else if (op === 'AUTO_ENFORCE' || op === 'EXPANDER') {
          producedScript = applyAutoEnforce(baseScript, nextCfg);
        } else {
          producedScript = baseScript;
        }
      }

      // Tahap 2 (Integrated Draft & F7 Guard) -> 3 (Audit & Status Final)
      await waitStage(160, 2);
      if (generationRequestIdRef.current !== reqId) return;
      await waitStage(160, 3);
      if (generationRequestIdRef.current !== reqId) return;

      finalizeGenerationOutput(op, producedScript, nextCfg);
    } finally {
      if (generationRequestIdRef.current === reqId) {
        setIsLoading(false);
        setActiveOperation(null);
      }
    }
  };

  const handleRepairSingleBlock = async (blockIndex: number) => {
    if (isLoading || activeBlockPostProd) return;
    setShowFireworks(false);

    const currentBlocks = [...blocks];
    const originalBlocksSnapshot = [...currentBlocks];
    const lockedCfg = enforceLockedConfig({
      ...config,
      konteks: LOCKED_CRITICAL_PERSPECTIVE,
      wpm: LOCKED_WPM,
      modeDurasi: LOCKED_DURATION_MODE,
    });

    setActiveBlockPostProd({ blockIndex, operation: 'PERDALAM' });
    setStatusBannerType('info');
    setStatusBanner(`Memperbaiki Blok ${blockIndex + 1} (blok lain tetap utuh)...`);

    try {
      let updatedScript = '';
      const originalBlock = currentBlocks[blockIndex] || '';

      // Coba panggil server endpoint untuk regenerasi AI terisolasi khusus blok ini
      if (cleanScript.trim()) {
        try {
          const res = await fetch('/api/gennas/post-production/block', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              cleanScript,
              blockIndex,
              operation: 'PERDALAM',
              config: lockedCfg,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.cleanScript) {
              updatedScript = data.cleanScript;
              if (data.failoverStatus) {
                setFailoverStatus(data.failoverStatus);
              }
              if (data.modelUsed) {
                setLastModelUsed(data.modelUsed);
              }
            }
          }
        } catch {
          // Offline / network fallback
        }
      }

      if (!updatedScript) {
        const repairedSingle = applySingleBlockEnforce(
          originalBlock,
          blockIndex,
          lockedCfg,
          originalBlock
        );
        const tempBlocks = [...originalBlocksSnapshot];
        tempBlocks[blockIndex] = repairedSingle || originalBlock;
        updatedScript = tempBlocks.join('\n');
      }

      // Hard Safety Verification: Pastikan 4 blok selain blockIndex 100% tidak berubah
      const candidateLines = updatedScript.replace(/\r\n/g, '\n').split('\n');
      const safeBlocks = originalBlocksSnapshot.map((orig, idx) =>
        idx === blockIndex ? candidateLines[idx] || orig : orig
      );
      const safeScript = safeBlocks.join('\n');

      setCleanScript(safeScript);
      syncPostProductionScriptToWorkflow(safeScript, lockedCfg);

      setStatusBannerType('success');
      setStatusBanner(`Blok ${blockIndex + 1} berhasil diperbaiki.`);
    } catch (err: any) {
      setStatusBannerType('warning');
      setStatusBanner(
        err?.message ||
          `Gagal memperbarui Blok ${blockIndex + 1}. Teks sebelumnya tetap dipertahankan.`
      );
    } finally {
      setActiveBlockPostProd(null);
    }
  };

  // Handler Block-Level Post-Production Engine (PERDALAM & TRANSISI per Blok — Terisolasi dari Workflow Engine)
  const handleBlockPostProduction = async (
    blockIndex: number,
    operation: BlockPostProductionOperation
  ) => {
    if (isLoading || activeBlockPostProd) return;
    setShowFireworks(false);
    if (!cleanScript.trim()) return;

    const effectiveOutline = config.faktaTerverifikasi.trim();
    const lockedPayload = enforceLockedConfig({
      ...config,
      faktaTerverifikasi: effectiveOutline,
      topik: config.topik || inferTopicFromOutline(effectiveOutline).inferredTopic,
      konteks: LOCKED_CRITICAL_PERSPECTIVE,
      wpm: LOCKED_WPM,
      modeDurasi: LOCKED_DURATION_MODE,
    });

    const originalBlocksSnapshot = [...blocks];
    setActiveBlockPostProd({ blockIndex, operation });
    setStatusBannerType('info');
    setStatusBanner(
      operation === 'PERDALAM'
        ? `Memperdalam Blok ${blockIndex + 1}...`
        : `Menghaluskan transisi Blok ${blockIndex + 1}...`
    );

    try {
      let updatedScript = '';
      let metadata: BlockPostProductionMetadata | null = null;

      try {
        const res = await fetch('/api/gennas/post-production/block', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cleanScript,
            blockIndex,
            operation,
            config: lockedPayload,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.cleanScript && data.metadata) {
            updatedScript = data.cleanScript;
            metadata = data.metadata;
            if (data.failoverStatus) {
              setFailoverStatus(data.failoverStatus);
            }
            if (data.modelUsed) {
              setLastModelUsed(data.modelUsed);
            }
          }
        }
      } catch {
        // Fallback ke deterministic block engine
      }

      if (!updatedScript || !metadata) {
        const localResult =
          operation === 'PERDALAM'
            ? applyBlockPerdalamDeterministic(cleanScript, blockIndex, lockedPayload)
            : applyBlockTransisiDeterministic(cleanScript, blockIndex, lockedPayload);
        updatedScript = localResult.updatedScript;
        metadata = localResult.metadata;
      }

      // Hard Safety Verification: Pastikan 4 blok selain blockIndex 100% tidak berubah
      const candidateLines = updatedScript.replace(/\r\n/g, '\n').split('\n');
      const safeBlocks = originalBlocksSnapshot.map((orig, idx) =>
        idx === blockIndex ? candidateLines[idx] || orig : orig
      );
      const safeScript = safeBlocks.join('\n');

      setCleanScript(safeScript);
      syncPostProductionScriptToWorkflow(safeScript, lockedPayload);
      setBlockPostProdResults((prev) => ({
        ...prev,
        [blockIndex]: metadata!,
      }));

      setStatusBannerType('success');
      setStatusBanner(metadata.summary);
    } catch (err: any) {
      // Jika proses gagal, pertahankan teks blok sebelumnya tanpa merusak naskah yang sudah ada
      setStatusBannerType('warning');
      setStatusBanner(
        err?.message ||
          `Gagal memproses ${operation} pada Blok ${blockIndex + 1}. Teks blok sebelumnya tetap dipertahankan.`
      );
    } finally {
      setActiveBlockPostProd(null);
    }
  };

  // Helper pemanggilan server stage dengan failover pool
  const serverWorkflowCall = async (payload: any) => {
    try {
      const res = await fetch('/api/gennas/workflow/stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.failoverStatus) {
          setFailoverStatus(data.failoverStatus);
        }
        if (data.modelUsed) {
          setLastModelUsed(data.modelUsed);
        }
        return data;
      }
    } catch {
      // offline fallback
    }
    return null;
  };

  // Eksekusi alur lengkap setelah Master Framework dikonfirmasi
  const executeRunFullWorkflow = async (confirmedFramework?: GenflowMasterFrameworkData) => {
    if (workflowState.isRunning) return;
    setShowFireworks(false);

    const outline = config.faktaTerverifikasi?.trim() || '';
    if (!outline) {
      setStatusBannerType('warning');
      setStatusBanner('Silakan unggah dokumen kerangka naskah terlebih dahulu.');
      return;
    }
    const effectiveFramework = confirmedFramework || masterFramework;
    const effectiveConfig = enforceLockedConfig({
      ...config,
      faktaTerverifikasi: outline,
      topik: effectiveFramework?.executiveSummary?.topikUtama || config.topik || inferTopicFromOutline(outline).inferredTopic,
      konteks: LOCKED_CRITICAL_PERSPECTIVE,
      wpm: LOCKED_WPM,
      modeDurasi: LOCKED_DURATION_MODE,
    });

    setIsLoading(true);
    setActiveOperation('NASKAH_FINAL');
    setStatusBannerType('info');
    setStatusBanner('Menjalankan alur produksi 3 tahap dengan Master Framework terkonfirmasi...');

    try {
      const stateWithFramework: WorkflowEngineState = {
        ...workflowState,
        masterFramework: effectiveFramework,
      };
      if (stateWithFramework.extractionData) {
        stateWithFramework.extractionData.masterFramework = effectiveFramework;
      }

      const finalState = await runCompleteWorkflow(
        stateWithFramework,
        effectiveConfig,
        serverWorkflowCall,
        (stageId, status, currentState) => {
          setWorkflowState(currentState);
          if (stageId === 1) setLoadingStageStep(1);
          else if (stageId === 2) setLoadingStageStep(2);
          else if (stageId >= 3) setLoadingStageStep(3);
        }
      );

      // Pastikan state final tersinkronisasi penuh
      setWorkflowState(finalState);
      const generatedScript =
        finalState.finalScriptData?.script ||
        finalState.draftV0?.script ||
        '';
      if (generatedScript) {
        setCleanScript(generatedScript);
      }

      if (finalState.isFinalApproved) {
        setShowFireworks(true);
        if (soundEnabled) {
          playGenerationSuccessSound();
        }
        setStatusBannerType('success');
        setStatusBanner('Alur produksi selesai: Naskah final telah disahkan sesuai Master Framework.');
      } else if (finalState.lastError) {
        setStatusBannerType('warning');
        setStatusBanner(
          `Alur terhenti di Tahap ${finalState.currentStageId}: ${finalState.lastError}`
        );
      }
    } catch (err: any) {
      const errorMsg = err?.message || 'Terjadi kesalahan pada workflow engine.';
      setWorkflowState((prev) => ({
        ...prev,
        isRunning: false,
        isAutoAdvancing: false,
        lastError: errorMsg,
      }));
      setStatusBannerType('warning');
      setStatusBanner(`Workflow Error: ${errorMsg}`);
    } finally {
      setIsLoading(false);
      setActiveOperation(null);
    }
  };

  // Handler eksekusi alur lengkap: Wajib konfirmasi Master Framework sebelum Tahap 2 dijalankan
  const handleRunFullWorkflow = async () => {
    if (workflowState.isRunning) return;

    if (!isFrameworkConfirmed) {
      setShowMasterFrameworkModal(true);
      setStatusBannerType('info');
      setStatusBanner('Silakan periksa dan konfirmasi Master Framework (23 Komponen A–G) sebelum Tahap 2 dijalankan.');
      return;
    }

    return executeRunFullWorkflow(masterFramework);
  };

  const handleConfirmFrameworkAndProceed = (confirmed: GenflowMasterFrameworkData) => {
    setMasterFramework(confirmed);
    setIsFrameworkConfirmed(true);
    setShowMasterFrameworkModal(false);
    executeRunFullWorkflow(confirmed);
  };

  const handleSaveFrameworkCorrections = (updated: GenflowMasterFrameworkData) => {
    setMasterFramework(updated);
    setStatusBannerType('success');
    setStatusBanner('Koreksi Master Framework berhasil disimpan.');
  };

  // Handler eksekusi satu tahap terarah dengan kontrol kunci gating
  const handleExecuteSingleWorkflowStage = async (stageId: WorkflowStageId) => {
    setShowFireworks(false);
    const check = canExecuteStage(workflowState, stageId);
    if (!check.allowed) {
      setStatusBannerType('warning');
      setStatusBanner(
        check.reason || `Tahap ${stageId} belum diizinkan untuk dieksekusi.`
      );
      return;
    }

    const outline = config.faktaTerverifikasi?.trim() || '';
    if (!outline) {
      setStatusBannerType('warning');
      setStatusBanner('Silakan unggah dokumen kerangka naskah terlebih dahulu.');
      return;
    }
    const effectiveConfig = enforceLockedConfig({
      ...config,
      faktaTerverifikasi: outline,
      topik: config.topik || inferTopicFromOutline(outline).inferredTopic,
      konteks: LOCKED_CRITICAL_PERSPECTIVE,
      wpm: LOCKED_WPM,
      modeDurasi: LOCKED_DURATION_MODE,
    });

    setWorkflowState((prev) => {
      const next = { ...prev, isRunning: true, lastError: undefined };
      next.stages[stageId] = {
        ...next.stages[stageId],
        status: 'RUNNING',
        startedAt: Date.now(),
        error: undefined,
      };
      return next;
    });

    try {
      if (stageId === 1) {
        const extraction = executeStage1Sync(
          outline,
          activeSourceDocumentName || 'kerangka-sumber.txt'
        );
        setWorkflowState((prev) => {
          const next = { ...prev, isRunning: false, extractionData: extraction };
          next.stages[1] = {
            ...next.stages[1],
            status: 'PASSED',
            completedAt: Date.now(),
            summary: `Kerangka berhasil diekstrak (${extraction.wordCount} kata, topik: "${extraction.inferredTopic}")`,
            data: extraction,
          };
          next.currentStageId = 2;
          return next;
        });
        setStatusBannerType('success');
        setStatusBanner(
          'Tahap 1 Selesai: Dokumen kerangka berhasil diekstrak dan siap untuk Tahap 2.'
        );
      } else if (stageId === 2) {
        if (!isFrameworkConfirmed) {
          setShowMasterFrameworkModal(true);
          setStatusBannerType('info');
          setStatusBanner('Silakan periksa dan konfirmasi Master Framework (23 Komponen A–G) sebelum Tahap 2 dijalankan.');
          setWorkflowState((prev) => ({ ...prev, isRunning: false }));
          return;
        }
        setIsLoading(true);
        setActiveOperation('NASKAH_FINAL');
        const extraction =
          workflowState.extractionData ||
          executeStage1Sync(outline, activeSourceDocumentName);
        if (masterFramework) {
          extraction.masterFramework = masterFramework;
        }
        const draft = await executeStage2DraftV0(
          effectiveConfig,
          extraction,
          serverWorkflowCall
        );

        const profanity = executeStage5AutomaticProfanitySelection(
          draft.script,
          extraction.narrativePlan!,
          effectiveConfig
        );

        const phrases = executeStage6AutomaticPhraseSelection(
          draft.script,
          extraction.narrativePlan!,
          effectiveConfig
        );

        const f1F8 = executeStage4AutomaticF1F8Selection(
          draft.script,
          extraction.narrativePlan!,
          effectiveConfig
        );

        setWorkflowState((prev) => {
          const next = {
            ...prev,
            isRunning: false,
            draftV0: draft,
            hclseAudit: draft.hclseAudit,
            traceabilityReport: draft.traceabilityReport,
            profanitySelection: profanity,
            phraseSelection: phrases,
            f1F8Selection: f1F8,
          };
          next.stages[2] = {
            ...next.stages[2],
            status: 'PASSED',
            completedAt: Date.now(),
            summary: `Naskah Terintegrasi dibuat (${draft.wordCount} kata, F1-F8, H, & G1-G11 diserap)`,
            data: draft,
          };
          next.currentStageId = 3;
          return next;
        });
        setIsLoading(false);
        setActiveOperation(null);
        setStatusBannerType('success');
        setStatusBanner(
          'Tahap 2 Selesai: Naskah Terintegrasi berhasil dibuat (Menyerap Leksikon F1-F8, Makian H, & Frasa G).'
        );
      } else if (stageId === 3) {
        const scriptToAudit = workflowState.draftV0?.script || cleanScript;
        const auditV0 = executeStage3AuditV0(scriptToAudit, effectiveConfig);
        const finalizedHCLSE = finalizeHCLSEAuditForScript(
          scriptToAudit,
          workflowState.hclseAudit || workflowState.draftV0?.hclseAudit,
          effectiveConfig.topik
        );
        setWorkflowState((prev) => {
          const next = {
            ...prev,
            isRunning: false,
            auditV0,
            hclseAudit: finalizedHCLSE,
          };
          next.stages[3] = {
            ...next.stages[3],
            status: 'PASSED',
            completedAt: Date.now(),
            summary: `Audit Diagnostik selesai: ${auditV0.diagnosisSummary.recommendedActions[0]}`,
            data: auditV0,
          };
          return next;
        });
        setStatusBannerType('success');
        setStatusBanner(
          'Tahap 3 Selesai: Audit diagnostik Dashboard 02 & pengesahan status final selesai.'
        );
      }
    } catch (err: any) {
      const errorMsg = err?.message || 'Terjadi kesalahan.';
      setWorkflowState((prev) => {
        const next = { ...prev, isRunning: false, isAutoAdvancing: false, lastError: errorMsg };
        next.stages[stageId] = {
          ...next.stages[stageId],
          status: 'FAILED',
          error: errorMsg,
        };
        return next;
      });
      setStatusBannerType('warning');
      setStatusBanner(`Tahap ${stageId} Gagal: ${errorMsg}`);
    } finally {
      setIsLoading(false);
      setActiveOperation(null);
    }
  };

  // Reset Alur Kerja
  const handleResetWorkflow = () => {
    setWorkflowState(createInitialWorkflowState('', ''));
    setCleanScript('');
    setActiveBlockPostProd(null);
    setBlockPostProdResults({});
    setIsLoading(false);
    setActiveOperation(null);
    setShowFireworks(false);
    setStatusBannerType('info');
    setStatusBanner('Workflow Engine telah di-reset ke Tahap 1.');
  };

  const handleExportTxt = () => {
    try {
      exportCleanScriptTxt(cleanScript, config.topik, {
        isFinalApproved: workflowState.isFinalApproved,
        stage3Status: workflowState.stages[3]?.status,
        isDraftV0:
          workflowState.stages[2]?.status === 'PASSED' &&
          workflowState.stages[3]?.status !== 'PASSED',
        audit,
        workflowState,
      });
      setStatusBannerType('success');
      setStatusBanner('Naskah final (.txt) berhasil diunduh.');
    } catch (err: any) {
      setStatusBannerType('warning');
      setStatusBanner(err?.message || 'Ekspor naskah final ditolak.');
    }
  };

  const handleExportDocx = () => {
    try {
      exportScriptDocx(cleanScript, voiceScript, config, audit, {
        isFinalApproved: workflowState.isFinalApproved,
        stage3Status: (workflowState.stages as any)[3]?.status,
        isDraftV0:
          workflowState.stages[2]?.status === 'PASSED' &&
          (workflowState.stages as any)[3]?.status !== 'PASSED',
        audit,
        workflowState,
      });
      setStatusBannerType('success');
      setStatusBanner('Naskah final Microsoft Word (.docx) berhasil diunduh.');
    } catch (err: any) {
      setStatusBannerType('warning');
      setStatusBanner(err?.message || 'Ekspor naskah final ditolak.');
    }
  };

  const hasExistingScript = cleanScript.trim().length > 0;

  const getProjectStateSnapshot = () => {
    const dashboardStatus = isLoading
      ? 'SEDANG MEMPROSES'
      : !hasExistingScript
      ? 'BELUM ADA NASKAH'
      : audit.passed
      ? 'LULUS SEMUA KONTRAK V5.1'
      : 'PERLU PERBAIKAN PRESISI';

    return captureProjectStateSnapshot({
      cleanScript,
      blocks,
      faktaTerverifikasi: config.faktaTerverifikasi,
      durasiMenit: config.durasiMenit,
      wpm: config.wpm,
      modeDurasi: config.modeDurasi,
      struktur: config.struktur,
      dashboardStatus,
    });
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col w-full max-w-none overflow-x-hidden">
      {/* Sistem Global Smart Tooltip (Portal) */}
      <GlobalTooltipManager />

      {/* Modal Developer Tools Terisolasi */}
      <DeveloperToolsModal
        isOpen={showDevTools}
        onClose={() => setShowDevTools(false)}
        getProjectStateSnapshot={getProjectStateSnapshot}
      />

      {/* Modal Live Update Center & System Change Tracker */}
      <LiveUpdateCenterModal
        isOpen={showUpdateCenter}
        onClose={() => setShowUpdateCenter(false)}
        releases={releases}
        activeRelease={
          releases.find((r) => r.status === 'ACTIVE') || releases[0] || null
        }
        currentVersion={currentVersion}
        onMarkRead={handleMarkReleaseRead}
        sseStatus={sseStatus}
      />

      {/* Modal Master Framework 23 Komponen Kanonis (Kelompok A–G) */}
      <MasterFrameworkModal
        isOpen={showMasterFrameworkModal}
        onClose={() => setShowMasterFrameworkModal(false)}
        framework={masterFramework}
        onSaveCorrections={handleSaveFrameworkCorrections}
        onConfirmAndProceed={handleConfirmFrameworkAndProceed}
      />

      {/* Modal List Engine AI & Arsitektur Sistem */}
      <ListEngineModal
        isOpen={showListEngine}
        onClose={() => setShowListEngine(false)}
      />

      {/* HEADER UTAMA GENNAS STUDIO */}
      <header className="w-full max-w-none flex items-center justify-between gap-3 px-4 sm:px-6 py-2.5 border-b border-slate-800/90 bg-[#0B0F17]/95 sticky top-0 z-30 backdrop-blur">
        {/* Kiri: Brand | DRAFT & RECAP | Versi & Status API */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={() => {
              setActiveTab('STUDIO');
              setWorkspaceMode('DRAFT');
            }}
            data-tooltip="Kembali ke ruang kerja utama."
            className="text-base font-bold tracking-tight text-slate-100 hover:text-amber-400 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <span>GenFLOW Studio</span>
          </button>

          <span className="text-slate-800 font-mono text-xs select-none">|</span>

          {/* DRAFT & RECAP Tab Switcher */}
          <div className="flex items-center gap-1 bg-slate-900/90 p-0.5 border border-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setActiveTab('STUDIO');
                setWorkspaceMode('DRAFT');
              }}
              data-tooltip="Mode penyusunan & audit 5 blok naskah."
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'STUDIO' && workspaceMode === 'DRAFT'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Workflow className="w-3.5 h-3.5" />
              <span>Tulis</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('STUDIO');
                setWorkspaceMode('RECAP');
              }}
              data-tooltip="Mode rekap naskah utuh & edit kosakata."
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'STUDIO' && workspaceMode === 'RECAP'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Hasil</span>
            </button>
          </div>

          <span className="text-slate-800 font-mono text-xs select-none">|</span>

          {/* Badge Versi App (Live Update Center Trigger) */}
          <button
            type="button"
            data-testid="version-badge-btn"
            onClick={() => setShowUpdateCenter(true)}
            data-tooltip="Lihat catatan rilis dan status sistem."
            className="group relative inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-mono font-medium rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 text-slate-300 hover:text-amber-300 transition-all cursor-pointer"
          >
            {hasUnreadUpdates && (
              <span
                data-testid="unread-update-indicator"
                className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0"
              />
            )}
            <span className="font-semibold">v{currentVersion}</span>
          </button>

          {/* Status API Active & Tier Color Badge */}
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border select-none ${
                getTierStyle(failoverStatus.activeKeyIndex).bg
              } ${getTierStyle(failoverStatus.activeKeyIndex).text} ${
                getTierStyle(failoverStatus.activeKeyIndex).border
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  getTierStyle(failoverStatus.activeKeyIndex).dot
                }`}
              />
              <span className="font-semibold">
                {failoverStatus.label} · T{failoverStatus.activeKeyIndex + 1}/{failoverStatus.totalTiers}
              </span>
              {failoverStatus.activeKeyIndex > 0 && (
                <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1 py-0.2 rounded font-sans ml-0.5">
                  Failover
                </span>
              )}
            </div>

            <div
              className="hidden md:inline-flex items-center gap-1 text-slate-400 px-2 py-1 rounded-md bg-slate-900 border border-slate-800 select-none"
            >
              <Cpu className="w-3 h-3 text-indigo-400 shrink-0" />
              <span className="text-slate-300 font-mono text-[11px]">
                {failoverStatus.activeModel || 'gemini-3-flash-preview'}
              </span>
            </div>
          </div>
        </div>

        {/* Kanan: OPTIONS Dropdown Menu */}
        <div className="relative shrink-0">
          <button
            type="button"
            data-testid="options-menu-button"
            onClick={() => setShowOptionsMenu((prev) => !prev)}
            data-tooltip="Menu Master Lexicon, Master Prompt, dan Alat Sistem."
            className="px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
            <span>Menu</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {showOptionsMenu && (
            <div
              data-testid="options-dropdown-menu"
              className="absolute right-0 mt-1.5 w-48 bg-[#0d131f] border border-slate-800 rounded-xl shadow-2xl p-1.5 z-50 space-y-0.5"
            >
              <button
                type="button"
                data-testid="option-master-lexicon-btn"
                onClick={() => {
                  setActiveTab('LEXICON');
                  setShowOptionsMenu(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs font-medium rounded-lg flex items-center gap-2.5 transition-colors cursor-pointer ${
                  activeTab === 'LEXICON'
                    ? 'bg-amber-500/15 text-amber-300 font-semibold'
                    : 'text-slate-200 hover:bg-slate-800/80'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span>Bank Kata</span>
              </button>

              <button
                type="button"
                data-testid="option-master-prompt-btn"
                onClick={() => {
                  setActiveTab('MASTER_PROMPT');
                  setShowOptionsMenu(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs font-medium rounded-lg flex items-center gap-2.5 transition-colors cursor-pointer ${
                  activeTab === 'MASTER_PROMPT'
                    ? 'bg-amber-500/15 text-amber-300 font-semibold'
                    : 'text-slate-200 hover:bg-slate-800/80'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span>Instruksi</span>
              </button>

              <button
                type="button"
                data-testid="option-list-engine-btn"
                onClick={() => {
                  setShowListEngine(true);
                  setShowOptionsMenu(false);
                }}
                className="w-full text-left px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800/80 rounded-lg flex items-center gap-2.5 transition-colors cursor-pointer"
              >
                <Cpu className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Status Mesin</span>
              </button>

              <div className="border-t border-slate-800/80 my-1" />

              <button
                type="button"
                data-testid="option-dev-tools-btn"
                onClick={() => {
                  setShowDevTools(true);
                  setShowOptionsMenu(false);
                }}
                className="w-full text-left px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800/80 rounded-lg flex items-center gap-2.5 transition-colors cursor-pointer"
              >
                <Terminal className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Developer Tools</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* NOTIFIKASI VISUAL SELESAI GENERASI / OPERASI */}
      {statusBanner && (
        <div
          role="status"
          data-testid="generation-status-banner"
          className={`w-full max-w-none border-b px-4 sm:px-6 py-2.5 text-xs flex items-center justify-between gap-4 ${
            statusBannerType === 'success'
              ? 'bg-emerald-950/70 border-emerald-800/80 text-emerald-200'
              : statusBannerType === 'warning'
              ? 'bg-amber-950/70 border-amber-800/80 text-amber-200'
              : 'bg-slate-900/95 border-slate-800 text-amber-200'
          }`}
        >
          <div className="flex items-center gap-2 font-medium">
            {statusBannerType === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span>{statusBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusBanner('')}
            data-tooltip="Tutup pesan pemberitahuan status."
            className="text-slate-400 hover:text-slate-200 font-mono whitespace-nowrap"
          >
            Tutup
          </button>
        </div>
      )}

      {/* AREA UTAMA FULL-WIDTH DESKTOP (grid-template-columns: minmax(360px, 34%) minmax(0, 1fr)) */}
      <main
        data-testid="studio-main-container"
        className="flex-1 w-full max-w-none px-4 sm:px-6 py-5"
      >
        {activeTab === 'STUDIO' && workspaceMode === 'DRAFT' && (
          <div className="space-y-6">
            <WorkflowEnginePanel
              workflowState={workflowState}
              hasScript={hasExistingScript}
              hasOutline={Boolean(
                config.faktaTerverifikasi &&
                  config.faktaTerverifikasi.trim().length >= 15
              )}
              isFrameworkConfirmed={isFrameworkConfirmed}
              onOpenMasterFrameworkModal={() => setShowMasterFrameworkModal(true)}
              onRunFullWorkflow={handleRunFullWorkflow}
              onResetWorkflow={handleResetWorkflow}
            />

            <HybridLexiconMonitor
              audit={workflowState.hclseAudit || workflowState.draftV0?.hclseAudit}
              stage2Status={workflowState.stages[2]?.status}
              stage3Status={workflowState.stages[3]?.status}
              isWorkflowRunning={workflowState.isRunning}
              onOpenAuditModal={() => setShowHCLSEAuditModal(true)}
            />

            <div
              data-testid="studio-two-column-grid"
              className="w-full max-w-none grid grid-cols-1 lg:grid-cols-[minmax(360px,34%)_minmax(0,1fr)] gap-6 items-stretch"
            >
              <div className="min-w-0 w-full flex flex-col">
                <ConfigPanel
                  config={config}
                  stagePlan={stagePlan}
                  hasScript={hasExistingScript}
                  onResetWorkspace={handleResetOutlineAndWorkspace}
                  onChange={handleConfigChange}
                  onFrameworkDetected={(fw, policyRes) => {
                    // SINKRONISASI KETAT ANTARDOKUMEN:
                    // Kosongkan seluruh naskah dan sesi dokumen lama
                    setCleanScript('');
                    setActiveBlockPostProd(null);
                    setBlockPostProdResults({});
                    setMasterFramework(fw);
                    setIsFrameworkConfirmed(false);
                    // Buka modal peninjauan otomatis jika dokumen terdeteksi sebagai kerangka
                    if (policyRes?.classification?.isFramework !== false) {
                      setShowMasterFrameworkModal(true);
                    }
                  }}
                  onOpenDevTools={() => setShowDevTools(true)}
                />
              </div>

              <div className="min-w-0 w-full flex flex-col">
                <EditorAndQualityPanel
                  blocks={blocks}
                  cleanScript={cleanScript}
                  audit={audit}
                  isLoading={isLoading}
                  loadingStageStep={loadingStageStep}
                  activeOperation={activeOperation}
                  lastModelUsed={lastModelUsed}
                  soundEnabled={soundEnabled}
                  isFinalApproved={workflowState.isFinalApproved}
                  isDraftV0={
                    workflowState.stages[2].status === 'PASSED' &&
                    (workflowState.stages as any)[6]?.status !== 'PASSED'
                  }
                  isStage8Passed={(workflowState.stages as any)[6]?.status === 'PASSED'}
                  auditV0={workflowState.auditV0}
                  preFinalQualityGate={workflowState.preFinalQualityGate}
                  finalAudit={workflowState.finalAudit}
                  workflowState={workflowState}
                  activeBlockPostProd={activeBlockPostProd}
                  blockPostProdResults={blockPostProdResults}
                  onToggleSound={handleToggleSound}
                  onBlockEdit={handleBlockEdit}
                  onRawCleanScriptEdit={handleRawCleanScriptEdit}
                  onExecuteOperation={handleExecuteOperation}
                  onRepairSingleBlock={handleRepairSingleBlock}
                  onBlockPostProduction={handleBlockPostProduction}
                  onExportTxt={handleExportTxt}
                  onExportDocx={handleExportDocx}
                  onExportAuditJson={() =>
                    exportAuditJsonFile(audit, config, cleanScript, {
                      isFinalApproved: workflowState.isFinalApproved,
                      stage8Status: (workflowState.stages as any)[6]?.status,
                      audit,
                      workflowState,
                    })
                  }
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'STUDIO' && workspaceMode === 'RECAP' && (
          <RecapView
            cleanScript={cleanScript}
            config={config}
            audit={audit}
            workflowState={workflowState}
            onScriptChange={handleRawCleanScriptEdit}
            onBackToStudio={() => setWorkspaceMode('DRAFT')}
          />
        )}

        {activeTab === 'LEXICON' && (
          <LexiconBankView
            audit={audit}
            cleanScript={cleanScript}
            onNavigateToMasterPrompt={() => setActiveTab('MASTER_PROMPT')}
            onBackToStudio={() => setActiveTab('STUDIO')}
          />
        )}

        {activeTab === 'MASTER_PROMPT' && (
          <MasterPromptView
            config={config}
            onNavigateToLexicon={() => setActiveTab('LEXICON')}
            onBackToStudio={() => setActiveTab('STUDIO')}
          />
        )}
      </main>

      <footer className="w-full max-w-none border-t border-slate-900 px-4 sm:px-6 py-3.5 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-3">
        <div>GenFLOW Studio · Sistem 22 Server</div>
        <div className="font-mono tabular-nums">
          SCTF 5 Blok · 135 WPM · Slot F1 ({audit.lexiconAudit.core_actual_count}/{audit.lexiconAudit.core_expected_count})
        </div>
      </footer>
      {showFireworks && (
        <FireworksCelebration
          soundEnabled={soundEnabled}
          onComplete={() => setShowFireworks(false)}
        />
      )}

      <HCLSEAuditModal
        isOpen={showHCLSEAuditModal}
        onClose={() => setShowHCLSEAuditModal(false)}
        audit={workflowState.hclseAudit || workflowState.draftV0?.hclseAudit}
      />
    </div>
  );
}
