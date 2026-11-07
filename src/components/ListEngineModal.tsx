/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Cpu,
  ShieldCheck,
  Workflow,
  BookOpen,
  Sparkles,
  Layers,
  FileCheck,
  Activity,
  X,
  Search,
  CheckCircle2,
  Lock,
  Terminal,
  Server,
  Zap,
} from 'lucide-react';

export interface ListEngineModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface EngineItem {
  id: string;
  number: number;
  name: string;
  codeName: string;
  category: 'AI & Failover' | 'Workflow' | 'Lexicon & Context' | 'System & Protection';
  status: 'OPERATIONAL' | 'STRICT_ACTIVE';
  icon: React.ElementType;
  color: string;
  badgeBg: string;
  badgeText: string;
  description: string;
  capabilities: string[];
  architectureDetail: string;
}

const SYSTEM_ENGINES: EngineItem[] = [
  {
    id: 'eng-1',
    number: 1,
    name: '22-Tier API Failover Engine',
    codeName: 'executeWithFailoverPool',
    category: 'AI & Failover',
    status: 'OPERATIONAL',
    icon: Server,
    color: 'text-emerald-400',
    badgeBg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
    badgeText: '22 Tier Failover Pool',
    description:
      'Mengelola rotasi 22 tingkat Kunci API (1 API Utama + 21 API Cadangan) di memori server. Mencegah kegagalan sistem saat Kunci API Utama mengalami kuota limit (429) tanpa pernah membocorkan kunci ke frontend.',
    capabilities: [
      'Rotasi otomatis 22 Tier Kunci API tanpa jeda',
      'Proteksi kunci di sisi server (100% aman)',
      'Penanganan graceful fallback terisolasi',
    ],
    architectureDetail: '/server.ts → KEY_POOL & markKeyExhaustedAndAdvance',
  },
  {
    id: 'eng-2',
    number: 2,
    name: 'Cascading Multi-Model AI Engine',
    codeName: 'BACKEND_MODELS_CASCADE',
    category: 'AI & Failover',
    status: 'OPERATIONAL',
    icon: Cpu,
    color: 'text-sky-400',
    badgeBg: 'bg-sky-500/15 border-sky-500/30 text-sky-300',
    badgeText: '5 Model Cascade',
    description:
      'Mengeksekusi rotasi model Gemini AI secara bertingkat (gemini-3.8-flash → gemini-3.5-flash → gemini-3-flash-preview) saat terjadi limit kuota 429 pada satu model sebelum berganti kunci API.',
    capabilities: [
      'Fallback bertingkat antar-model Gemini AI',
      'Dynamic Seed & Temperature Rotation per generasi',
      'Monitoring model aktif secara realtime di Header UI',
    ],
    architectureDetail: '/server.ts → executeWithFailoverPool (orderedModels loop)',
  },
  {
    id: 'eng-3',
    number: 3,
    name: 'GenFLOW 8-Stage Production Workflow Engine',
    codeName: 'workflowEngine.ts',
    category: 'Workflow',
    status: 'STRICT_ACTIVE',
    icon: Workflow,
    color: 'text-amber-400',
    badgeBg: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
    badgeText: '8-Stage Strict Pipeline',
    description:
      'Mengendalikan alur kerja produksi naskah 8 tahap terarah secara berurutan. Mengunci ketergantungan antar-tahap (Tahap N wajib menunggu Tahap N-1 PASSED) serta menjaga aturan gating display.',
    capabilities: [
      'Strict gating rule: Tahap N wajib PASSED sebelum N+1',
      'Final-Only Display: Naskah hanya dipublikasikan setelah Tahap 8 PASSED',
      'Invalidasi otomatis saat kerangka/naskah diubah',
    ],
    architectureDetail: '/src/lib/workflowEngine.ts → runCompleteWorkflow & executeStageX',
  },
  {
    id: 'eng-4',
    number: 4,
    name: 'Master Lexicon Repository & AI Candidate Engine',
    codeName: 'masterLexiconRepository.ts',
    category: 'Lexicon & Context',
    status: 'OPERATIONAL',
    icon: BookOpen,
    color: 'text-teal-400',
    badgeBg: 'bg-teal-500/15 border-teal-500/30 text-teal-300',
    badgeText: '1.476+ Kosakata Unik',
    description:
      'Mengelola 1.476+ kosakata unik (F1–F8, Dataset 299, Dataset 945, dan Dataset Tambahan Pengguna) serta Tombstone Blacklist untuk memblokir kata terhapus secara permanen dari kandidat AI.',
    capabilities: [
      'Manajemen terpusat 7 pilar leksikon & CSV Universal',
      'Tombstone Blacklist yang mencegah kemunculan kata terhapus',
      'Indeksation canonical key & pencarian duplikat instan',
    ],
    architectureDetail: '/src/lib/masterLexiconRepository.ts → getAIContextualCandidates',
  },
  {
    id: 'eng-5',
    number: 5,
    name: 'F7 Contextual Guard & Semantic Domain Filtering Engine',
    codeName: 'f7ContextualGuardEngine.ts',
    category: 'Lexicon & Context',
    status: 'STRICT_ACTIVE',
    icon: ShieldCheck,
    color: 'text-purple-400',
    badgeBg: 'bg-purple-500/15 border-purple-500/30 text-purple-300',
    badgeText: 'Ranah Makna Topik',
    description:
      'Penyaring ranah makna topik (mencegah kata salah kaprah seperti frasa kuliner "nyicip dulu" pada naskah ekonomi/hukum) dan mengaudit keseimbangan konotasi status ALLOW, CONDITIONAL, dan AVOID.',
    capabilities: [
      'Semantic Domain Filtering berdasarkan topik naskah aktif',
      'Pencegahan frasa tidak cocok (mis. kuliner di naskah ekonomi)',
      'Evaluasi audit F7-1 s.d. F7-7 secara otomatis',
    ],
    architectureDetail: '/src/lib/f7ContextualGuardEngine.ts → computeF7NotesMonitor',
  },
  {
    id: 'eng-6',
    number: 6,
    name: 'Unified Quote-Free Narration Engine (SQNN Engine)',
    codeName: 'applySQNN',
    category: 'System & Protection',
    status: 'OPERATIONAL',
    icon: Sparkles,
    color: 'text-fuchsia-400',
    badgeBg: 'bg-fuchsia-500/15 border-fuchsia-500/30 text-fuchsia-300',
    badgeText: '100% Quote-Free',
    description:
      'Menjamin naskah lisan 100% bebas dari tanda petik ganda ("..." atau “...”) dengan menormalisasi kutipan, slogan, dan ungkapan menjadi narasi lisan alami yang siap dibacakan narator.',
    capabilities: [
      'Pembersihan tanda petik ganda tanpa merusak kalimat',
      'Konversi slogan/kutipan menjadi bentuk naratif lisan',
      'Dua lapisan pengamanan (LLM prompt + Normalizer lokal)',
    ],
    architectureDetail: '/src/lib/validatorAndPipeline.ts → applySQNN & validateQuoteFreeNarration',
  },
  {
    id: 'eng-7',
    number: 7,
    name: 'Block-Level Post-Production Engine',
    codeName: 'post-production/block',
    category: 'Workflow',
    status: 'OPERATIONAL',
    icon: Layers,
    color: 'text-indigo-400',
    badgeBg: 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300',
    badgeText: 'Post-Prod Terisolasi',
    description:
      'Mesin penyuntingan terisolasi tingkat blok (PERDALAM & TRANSISI) yang mampu memperdalam isi analisis atau menghaluskan jembatan transisi pada 1 blok spesifik tanpa merusak 4 blok naskah lainnya.',
    capabilities: [
      'Perbaikan terisolasi per blok (PERDALAM & TRANSISI)',
      'Jaminan 4 blok lainnya 100% tidak berubah',
      'Evaluasi transisi antarblok secara dinamis',
    ],
    architectureDetail: '/server.ts → /api/gennas/post-production/block',
  },
  {
    id: 'eng-8',
    number: 8,
    name: 'Document Extractor & Protected Token Engine',
    codeName: 'documentExtractor.ts',
    category: 'System & Protection',
    status: 'OPERATIONAL',
    icon: FileCheck,
    color: 'text-cyan-400',
    badgeBg: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300',
    badgeText: 'SAP Protection',
    description:
      'Mengekstrak dokumen .txt, .docx (Microsoft Word), dan .pdf serta melindungi token-token penting (fakta, angka desimal, persentase, nilai rupiah, dan nama tempat) agar tidak dirusak saat generasi.',
    capabilities: [
      'Ekstraksi dokumen multibentuk (.txt, .docx, .pdf)',
      'Ekstraksi & pemetaan Protected Tokens (fakta/angka)',
      'Validasi integritas dokumen sebelum generasi',
    ],
    architectureDetail: '/src/lib/documentExtractor.ts → extractAndValidateDocument',
  },
  {
    id: 'eng-9',
    number: 9,
    name: 'Live System Change Tracker & SSE Realtime Update Center',
    codeName: 'changeTracker.ts',
    category: 'System & Protection',
    status: 'OPERATIONAL',
    icon: Activity,
    color: 'text-rose-400',
    badgeBg: 'bg-rose-500/15 border-rose-500/30 text-rose-300',
    badgeText: 'SSE Realtime',
    description:
      'Melacak dan mendeteksi secara otomatis setiap rilis, pembaruan modul, dan perbaikan aplikasi, lalu menyiarkannya langsung ke layar pengguna via Server-Sent Events (SSE) secara realtime.',
    capabilities: [
      'Pelacakan otomatis versi & rilis aplikasi',
      'Penyiaran realtime via Server-Sent Events (SSE)',
      'Manajemen catatan perubahan & verifikasi status build',
    ],
    architectureDetail: '/src/lib/changeTracker.ts & /api/system/releases/stream',
  },
];

export interface ListEngineModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface WorkflowStageDetail {
  number: number;
  name: string;
  badge: string;
  badgeColor: string;
  purpose: string;
  functions: string[];
  mandatoryRule: string;
  output: string;
}

const WORKFLOW_STAGES_DETAILS: WorkflowStageDetail[] = [
  {
    number: 1,
    name: 'Tahap 1: Upload Kerangka Naskah & Ekstraksi Sumber',
    badge: 'Source Extraction & SAP',
    badgeColor: 'bg-sky-500/15 border-sky-500/30 text-sky-300',
    purpose: 'Membersihkan kerangka sumber, mengekstrak topik utama, serta memisahkan fakta substantif dari referensi eksternal.',
    functions: [
      'Mengekstrak topik utama dan argumen inti dari dokumen/kerangka.',
      'Menyaring DOI, URL, dan label referensi agar tidak bocor ke naskah.',
      'Melindungi token angka, persentase, tahun, dan rupiah (Protected Tokens SAP).',
    ],
    mandatoryRule: 'Kerangka sumber wajib bersih dan topik utama terdeteksi jelas.',
    output: 'Teks Sumber Bersih & Peta Token Terlindungi (SAP)',
  },
  {
    number: 2,
    name: 'Tahap 2: Generate Naskah Terintegrasi & F7 Contextual Guard',
    badge: 'Integrated 5-Block SCTF',
    badgeColor: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
    purpose: 'Menyusun 5 blok naskah lisan (SCTF) dengan gaya Gue–Lo, kosakata F1–F8, Frasa G, Makian H, dan filter konteks F7 dalam 1 siklus.',
    functions: [
      'Membagi target kata ke dalam 5 blok StoryFlow secara proporsional.',
      'Menyuntikkan kosakata lisan F1–F8, Frasa G2–G11, serta 4–5 makian Non-SARA per blok.',
      'Memastikan kesesuaian konteks kalimat melalui F7 Contextual Guard.',
    ],
    mandatoryRule: 'Wajib menghasilkan 5 blok SCTF utuh yang bebas SARA dan setia pada sumber.',
    output: 'Naskah 5 Blok SCTF Terintegrasi',
  },
  {
    number: 3,
    name: 'Tahap 3: Evaluasi Quote-Free & Pengesahan Status Final',
    badge: 'SQNN & Final Approval',
    badgeColor: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
    purpose: 'Memastikan naskah 100% bebas tanda petik ganda (SQNN), mengaudit kontrak kualitas, dan membuka fitur ekspor.',
    functions: [
      'Menghapus dan menormalisasi seluruh kutipan langsung menjadi kalimat tidak langsung (SQNN).',
      'Memverifikasi kelulusan 8 indikator Validator Kualitas.',
      'Mengesahkan status FINAL untuk membuka akses Salin, .TXT, .DOCX, dan .JSON.',
    ],
    mandatoryRule: 'Naskah wajib 100% bebas tanda petik (SQNN) dan lulus audit kualitas.',
    output: 'Status Final Disahkan + Ekspor Terbuka',
  },
];

export function ListEngineModal({ isOpen, onClose }: ListEngineModalProps) {
  const [modalTab, setModalTab] = useState<'ENGINES' | 'WORKFLOW_FUNCTIONS'>('ENGINES');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  if (!isOpen) return null;

  const categories = [
    'ALL',
    'AI & Failover',
    'Workflow',
    'Lexicon & Context',
    'System & Protection',
  ];

  const filteredEngines = SYSTEM_ENGINES.filter((eng) => {
    const matchesCategory =
      selectedCategory === 'ALL' || eng.category === selectedCategory;
    const matchesSearch =
      eng.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      eng.codeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      eng.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      eng.capabilities.some((cap) =>
        cap.toLowerCase().includes(searchQuery.toLowerCase())
      );
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-[#0d131f] border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-slate-800/90 bg-[#0B0F17]/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100 tracking-tight">
                  Daftar Engine &amp; Alur Kerja
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-mono font-semibold rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  9 ENGINE · 3 TAHAP
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Ringkasan mesin AI, failover pool, kosakata, dan alur produksi 3 tahap.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            data-tooltip="Tutup jendela."
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Sub-Navigation Tabs (Daftar Engine AI vs Fungsi Workflow) */}
        <div className="px-5 py-2 border-b border-slate-800 bg-[#0d131f] flex items-center gap-2">
          <button
            type="button"
            onClick={() => setModalTab('ENGINES')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              modalTab === 'ENGINES'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>9 Engine Utama</span>
          </button>

          <button
            type="button"
            onClick={() => setModalTab('WORKFLOW_FUNCTIONS')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              modalTab === 'WORKFLOW_FUNCTIONS'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Workflow className="w-3.5 h-3.5" />
            <span>Alur 3 Tahap</span>
          </button>
        </div>

        {/* Modal Body: ENGINES Tab */}
        {modalTab === 'ENGINES' && (
          <>
            {/* Filter & Search Controls */}
            <div className="px-5 py-2.5 border-b border-slate-800/80 bg-slate-900/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
              {/* Category Tabs */}
              <div className="flex flex-wrap items-center gap-1.5">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                    }`}
                  >
                    {cat === 'ALL' ? 'Semua (9)' : cat}
                  </button>
                ))}
              </div>

              {/* Search Input */}
              <div className="relative w-full sm:w-60">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari engine..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-900/90 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                />
              </div>
            </div>

            {/* Scrollable Engine Cards List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
              {filteredEngines.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs">
                  Tidak ada engine yang cocok dengan pencarian &quot;{searchQuery}&quot;.
                </div>
              ) : (
                filteredEngines.map((eng) => {
                  const IconComp = eng.icon;
                  return (
                    <div
                      key={eng.id}
                      className="group relative p-4 bg-slate-900/60 hover:bg-slate-900/90 border border-slate-800/90 hover:border-slate-700 rounded-xl transition-all shadow-sm"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-2.5">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 ${eng.color} shrink-0`}>
                            <IconComp className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-mono font-bold text-amber-400/90">
                                #{eng.number}
                              </span>
                              <h3 className="text-sm font-bold text-slate-100 group-hover:text-amber-300 transition-colors">
                                {eng.name}
                              </h3>
                              <span className="text-[10px] font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60">
                                {eng.codeName}
                              </span>
                            </div>
                            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                              {eng.description}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 flex sm:flex-col items-end gap-1.5">
                          <span className={`px-2 py-0.5 text-[10px] font-mono font-semibold rounded-md border ${eng.badgeBg}`}>
                            {eng.badgeText}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{eng.status}</span>
                          </span>
                        </div>
                      </div>

                      {/* Capabilities List */}
                      <div className="mt-2.5 pt-2.5 border-t border-slate-800/60 grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px]">
                        {eng.capabilities.map((cap, idx) => (
                          <div key={idx} className="flex items-start gap-1.5 text-slate-300">
                            <Zap className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                            <span>{cap}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* Modal Body: WORKFLOW_FUNCTIONS Tab */}
        {modalTab === 'WORKFLOW_FUNCTIONS' && (
          <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
            <div className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1">
              <h3 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <Workflow className="w-4 h-4 text-amber-400" />
                <span>Alur Produksi Naskah 3 Tahap</span>
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Setiap tahap bekerja berurutan sebagai gerbang kualitas otomatis dari ekstraksi sumber hingga pengesahan naskah final.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3.5">
              {WORKFLOW_STAGES_DETAILS.map((stage) => (
                <div
                  key={stage.number}
                  className="p-4 bg-slate-900/60 border border-slate-800/90 hover:border-slate-700 rounded-xl space-y-2.5 transition-all"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                        T{stage.number}
                      </span>
                      <h4 className="text-sm font-bold text-slate-100">
                        {stage.name}
                      </h4>
                    </div>

                    <span className={`px-2 py-0.5 text-[10px] font-mono font-semibold rounded-md border ${stage.badgeColor}`}>
                      {stage.badge}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300">
                    {stage.purpose}
                  </p>

                  <ul className="space-y-1">
                    {stage.functions.map((fn, idx) => (
                      <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
                        <span>{fn}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="pt-2 border-t border-slate-800/60 grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] font-mono">
                    <div className="p-2 bg-slate-950/80 rounded-lg border border-slate-800/80">
                      <span className="text-amber-400/90 font-bold block mb-0.5">Syarat Kelulusan:</span>
                      <span className="text-slate-300 font-sans text-xs">{stage.mandatoryRule}</span>
                    </div>

                    <div className="p-2 bg-slate-950/80 rounded-lg border border-slate-800/80">
                      <span className="text-emerald-400/90 font-bold block mb-0.5">Output:</span>
                      <span className="text-slate-300 font-sans text-xs">{stage.output}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-800/90 bg-[#0B0F17]/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>9 Engine &amp; 3 Tahap Aktif</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
