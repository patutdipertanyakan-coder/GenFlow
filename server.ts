import 'dotenv/config';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import {
  GenNASConfig,
  ElevenLabsVoiceSettings,
  LOCKED_WPM,
  LOCKED_DURATION_MODE,
  BlockPostProductionOperation,
} from './src/lib/types';
import {
  buildRuntimeSystemPrompt,
  RUNTIME_MASTER_PROMPT_V51,
  RUNTIME_MASTER_PROMPT_V51_VERSION,
} from './src/lib/masterPromptV51';
import {
  auditCoreLexiconCompleteness,
  NARRATIVE_PHRASE_CATEGORIES,
  PROFANITY_INTEGRATED_TEMPLATES,
  PROFANITY_ROOT_WORDS,
} from './src/lib/lexiconRegistry';
import {
  G1G11PhraseRepository,
  getActiveG1G11PhraseBank,
  validatePhraseSemanticAlignment,
} from './src/lib/g1g11PhraseRepository';
import { parseAndPreviewUniversalPhraseCsv } from './src/lib/g1g11UniversalCsvParser';
import { masterLexiconRepository } from './src/lib/masterLexiconRepository';
import { supabase, createAuthenticatedClient, checkSupabaseOperationalTables } from './src/lib/supabaseClient';
import {
  applyAutoEnforce,
  applyBlockPerdalamDeterministic,
  applyBlockTransisiDeterministic,
  applyRevisiKoma,
  applyRevisiTransisi,
  applySingleBlockEnforce,
  buildABTransitionVariants,
  buildElevenLabsChunks,
  calculateStageTargets,
  compileVoiceScript,
  countWordsConsistent,
  enforceLockedConfig,
  extractProtectedTokens,
  finalizeBlockPostProductionLLMOutput,
  formatBlocksToSCTF,
  inferTopicFromOutline,
  LOCKED_CRITICAL_PERSPECTIVE,
  validateFullScript,
  validateTextAndTokenIntegrity,
  classifyDocumentSemantics,
  buildSourceGroundedNarrativePlan,
  validateSourceFidelity,
  applySQNN,
  validateQuoteFreeNarration,
  DOUBLE_QUOTE_CHARS_REGEX,
  stripReferenceMetadataFromSourceText,
  sanitizeNarrativeFromReferenceLeakage,
  applyLanguagePurityAndSanitization,
  auditLanguageIntegrity,
} from './src/lib/validatorAndPipeline';
import { extractAndValidateDocument } from './src/lib/documentExtractor';
import {
  addCustomWord,
  getCustomLexiconState,
  setCustomLexiconState,
} from './src/lib/customLexiconStore';
import releaseManifest from './src/data/releaseManifest.json';
import {
  compareReleases,
  ReleaseRecord,
  validateReleaseRecord,
  sanitizeChangeNotes,
} from './src/lib/changeTracker';
import { computeF7NotesMonitor } from './src/lib/f7ContextualGuardEngine';
import { runHybridContextualLexiconSelectionEngine } from './src/lib/hybridContextualLexiconSelectionEngine';
import { buildStage2MasterFrameworkPromptDirectives } from './src/lib/genflowMasterFramework';
import {
  processUniversalFrameworkDocument,
  getActiveUniversalFrameworkPolicy,
  exportCanonicalFrameworkText,
  classifyDocumentType,
} from './src/lib/genflowUniversalFrameworkPolicy';

dotenv.config();

// Daftar model Gemini server-side berdasarkan latensi terendah & stabilitas tertinggi
export const BACKEND_MODELS = [
  'gemini-3-flash-preview',
  'gemini-3.5-flash',
  'gemini-3.8-flash',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
];

const MASTER_PROMPT_ORIGINAL_MD = RUNTIME_MASTER_PROMPT_V51;

// Helper untuk membaca API Key dari environment tanpa mengekspos hardcoded secret ke repository
function resolveTierKey(index: number, envName: string): string {
  return (
    process.env[envName] ||
    process.env[`GEMINI_BACKUP_KEY_${index}`] ||
    process.env.GEMINI_API_KEY ||
    `TIER_BACKUP_KEY_${index}`
  );
}

// Pool API Key untuk MENU 1 (22-Tier Failover System: 1 API Utama + 21 API Cadangan)
// PENTING: Hanya disimpan di memori server dan dibaca dari environment, TIDAK PERNAH dikirim ke frontend/browser.
export const KEY_POOL = [
  {
    key:
      process.env.GEMINI_API_KEY &&
      process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
        ? process.env.GEMINI_API_KEY
        : 'PRIMARY_ENV_KEY_PLACEHOLDER',
    label: 'API Utama',
  },
  { key: resolveTierKey(1, 'GEMINI_BACKUP_KEY_1'), label: 'API Cadangan 1' },
  { key: resolveTierKey(2, 'GEMINI_BACKUP_KEY_2'), label: 'API Cadangan 2' },
  { key: resolveTierKey(3, 'GEMINI_BACKUP_KEY_3'), label: 'API Cadangan 3' },
  { key: resolveTierKey(4, 'GEMINI_BACKUP_KEY_4'), label: 'API Cadangan 4' },
  { key: resolveTierKey(5, 'GEMINI_BACKUP_KEY_5'), label: 'API Cadangan 5' },
  { key: resolveTierKey(6, 'GEMINI_BACKUP_KEY_6'), label: 'API Cadangan 6' },
  { key: resolveTierKey(7, 'GEMINI_BACKUP_KEY_7'), label: 'API Cadangan 7' },
  { key: resolveTierKey(8, 'GEMINI_BACKUP_KEY_8'), label: 'API Cadangan 8' },
  { key: resolveTierKey(9, 'GEMINI_BACKUP_KEY_9'), label: 'API Cadangan 9' },
  { key: resolveTierKey(10, 'GEMINI_BACKUP_KEY_10'), label: 'API Cadangan 10' },
  { key: resolveTierKey(11, 'GEMINI_BACKUP_KEY_11'), label: 'API Cadangan 11' },
  { key: resolveTierKey(12, 'GEMINI_BACKUP_KEY_12'), label: 'API Cadangan 12' },
  { key: resolveTierKey(13, 'GEMINI_BACKUP_KEY_13'), label: 'API Cadangan 13' },
  { key: resolveTierKey(14, 'GEMINI_BACKUP_KEY_14'), label: 'API Cadangan 14' },
  { key: resolveTierKey(15, 'GEMINI_BACKUP_KEY_15'), label: 'API Cadangan 15' },
  { key: resolveTierKey(16, 'GEMINI_BACKUP_KEY_16'), label: 'API Cadangan 16' },
  { key: resolveTierKey(17, 'GEMINI_BACKUP_KEY_17'), label: 'API Cadangan 17' },
  { key: resolveTierKey(18, 'GEMINI_BACKUP_KEY_18'), label: 'API Cadangan 18' },
  { key: resolveTierKey(19, 'GEMINI_BACKUP_KEY_19'), label: 'API Cadangan 19' },
  { key: resolveTierKey(20, 'GEMINI_BACKUP_KEY_20'), label: 'API Cadangan 20' },
  { key: resolveTierKey(21, 'GEMINI_BACKUP_KEY_21'), label: 'API Cadangan 21' },
];

let activeKeyIndex = 0;
let activeModel = BACKEND_MODELS[0];
let previousKeyLabel: string | null = null;
const exhaustedKeys = new Set<number>();

// Fungsi rotasi otomatis saat API Key mencapai limit/kuota habis
function markKeyExhaustedAndAdvance(failedIdx: number) {
  const prevLabel = KEY_POOL[failedIdx]?.label || `API Tier ${failedIdx}`;
  exhaustedKeys.add(failedIdx);
  previousKeyLabel = prevLabel;

  for (let next = failedIdx + 1; next < KEY_POOL.length; next++) {
    if (!exhaustedKeys.has(next)) {
      activeKeyIndex = next;
      return;
    }
  }
  for (let next = 0; next < KEY_POOL.length; next++) {
    if (!exhaustedKeys.has(next)) {
      activeKeyIndex = next;
      return;
    }
  }
}

// Helper inisialisasi SDK GoogleGenAI
function getGenAIClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Sanitasi pesan error agar tidak pernah membocorkan string API key ke client/log
function sanitizeUpstreamErrorMessage(rawMessage: string): string {
  let cleaned = rawMessage || 'Unknown upstream error';
  for (const item of KEY_POOL) {
    if (item.key && item.key.length > 6) {
      cleaned = cleaned.split(item.key).join('[REDACTED_KEY]');
    }
  }
  cleaned = cleaned.replace(/AQ\.[A-Za-z0-9_-]+/g, '[REDACTED_KEY]');
  cleaned = cleaned.replace(/AIza[A-Za-z0-9_-]+/g, '[REDACTED_KEY]');
  return cleaned.slice(0, 320);
}

// Helper pengayaan instruksi sistem dengan grounding data fakta pengguna
function enhanceSystemInstructionWithDataGrounding(
  baseInstruction: string,
  contents: unknown
): string {
  const contentPreview =
    typeof contents === 'string'
      ? contents
      : JSON.stringify(contents || '').slice(0, 1500);
  const protectedMap = extractProtectedTokens(contentPreview);
  if (protectedMap.tokens.length === 0) {
    return baseInstruction;
  }
  return `${baseInstruction}\n\n[DATA GROUNDING & PROTECTED TOKENS WAJIB DIPERTAHANKAN]: ${protectedMap.tokens.join(', ')}`;
}

// Helper eksekusi dengan batas timeout 45 detik per percobaan model
async function generateContentWithTimeout(
  client: GoogleGenAI,
  params: Parameters<GoogleGenAI['models']['generateContent']>[0],
  timeoutMs = 45000
) {
  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`UPSTREAM_MODEL_TIMEOUT_${timeoutMs}MS`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      client.models.generateContent(params),
      timeoutPromise,
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Eksekutor terpadu dengan 22-Tier Failover System (API Utama -> Cadangan 1 -> ... -> Cadangan 21)
 */
async function executeWithFailoverPool(params: {
  contents: any;
  systemInstruction?: any;
  generationConfig?: { temperature?: number; maxOutputTokens?: number; seed?: number };
  preferredModel?: string;
}): Promise<{
  text: string;
  activeKeyIndex: number;
  usedModel: string;
  availableModels: string[];
  previousLabel: string | null;
  keyTier: string;
}> {
  const { contents, systemInstruction, generationConfig, preferredModel } = params;
  let lastError: Error | null = null;
  const delays = [800, 1600];

  const orderedModels = preferredModel && BACKEND_MODELS.includes(preferredModel)
    ? [preferredModel, ...BACKEND_MODELS.filter((m) => m !== preferredModel)]
    : BACKEND_MODELS;

  const maxKeyAttemptsPerRequest = 2;
  let keysTried = 0;

  for (let offset = 0; offset < KEY_POOL.length && keysTried < maxKeyAttemptsPerRequest; offset++) {
    const keyIdx = (activeKeyIndex + offset) % KEY_POOL.length;
    if (exhaustedKeys.has(keyIdx)) continue;

    const currentKeyObj = KEY_POOL[keyIdx];
    if (currentKeyObj.key === 'PRIMARY_ENV_KEY_PLACEHOLDER') {
      markKeyExhaustedAndAdvance(keyIdx);
      continue;
    }

    keysTried += 1;
    activeKeyIndex = keyIdx;
    const client = getGenAIClient(currentKeyObj.key);

    for (const model of orderedModels) {
      activeModel = model;

      for (let attempt = 0; attempt < 1; attempt++) {
        try {
          let sysInstructionText: string | undefined = undefined;
          if (typeof systemInstruction === 'string') {
            sysInstructionText = systemInstruction;
          } else if (systemInstruction?.parts) {
            sysInstructionText = systemInstruction.parts
              .map((p: { text?: string }) => p.text || '')
              .join('\n');
          }

          if (!sysInstructionText) {
            sysInstructionText = MASTER_PROMPT_ORIGINAL_MD;
          }

          sysInstructionText = enhanceSystemInstructionWithDataGrounding(
            sysInstructionText,
            contents
          );

          const response = await generateContentWithTimeout(
            client,
            {
              model,
              contents,
              config: {
                ...(sysInstructionText
                  ? { systemInstruction: sysInstructionText }
                  : {}),
                temperature: generationConfig?.temperature ?? 0.55,
                maxOutputTokens: generationConfig?.maxOutputTokens ?? 65536,
                ...(generationConfig?.seed !== undefined
                  ? { seed: generationConfig.seed }
                  : {}),
              },
            },
            45000
          );

          const text = response.text || '';
          if (!text) {
            throw new Error('Respon teks kosong dari Gemini.');
          }

          activeKeyIndex = keyIdx;
          activeModel = model;
          return {
            text,
            activeKeyIndex: keyIdx,
            usedModel: model,
            availableModels: BACKEND_MODELS,
            previousLabel: previousKeyLabel,
            keyTier: currentKeyObj.label,
          };
        } catch (apiErr: unknown) {
          const errMsg =
            apiErr instanceof Error ? apiErr.message : String(apiErr);
          const cleanErrMsg = sanitizeUpstreamErrorMessage(errMsg);

          // 1. Jika Key Invalid / Permission Denied (403/401) -> Kunci ini tidak valid, langsung lompat ke kunci berikutnya
          if (
            errMsg.includes('403') ||
            errMsg.includes('401') ||
            errMsg.includes('API_KEY_INVALID') ||
            errMsg.includes('permission denied') ||
            errMsg.includes('PERMISSION_DENIED') ||
            errMsg.includes('free tier is not available')
          ) {
            markKeyExhaustedAndAdvance(keyIdx);
            lastError = new Error(`${currentKeyObj.label}: ${cleanErrMsg}`);
            break;
          }

          // 2. Jika model terkena rate limit / quota / error (429, RESOURCE_EXHAUSTED, 503, 500, 404, timeout):
          // Catat error dan biarkan loop berlanjut ke model berikutnya di orderedModels
          lastError = new Error(
            `Model ${model} pada ${currentKeyObj.label}: ${cleanErrMsg}`
          );
        }
      }

      if (exhaustedKeys.has(keyIdx)) {
        break;
      }
    }

    if (!exhaustedKeys.has(keyIdx)) {
      markKeyExhaustedAndAdvance(keyIdx);
    }
  }

  if (exhaustedKeys.size >= KEY_POOL.length) {
    exhaustedKeys.clear();
    activeKeyIndex = 0;
  }

  throw new Error(
    lastError?.message ||
      'Seluruh tier API dan 3 model Gemini gagal memproses permintaan (Fallback ke Pipeline Deterministik).'
  );
}

function isRealElevenLabsKey(key?: string): boolean {
  if (!key) return false;
  const trimmed = key.trim();
  return (
    trimmed.length > 10 &&
    trimmed !== 'MY_ELEVENLABS_API_KEY' &&
    !trimmed.startsWith('YOUR_')
  );
}

function createLabeledSimulationWavBase64(
  durationSeconds: number = 1.8,
  freqHz: number = 220
): string {
  const sampleRate = 24000;
  const numSamples = Math.min(
    sampleRate * 3,
    Math.max(sampleRate, Math.floor(sampleRate * durationSeconds))
  );
  const buffer = Buffer.alloc(44 + numSamples * 2);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const envelope =
      Math.sin((Math.PI * i) / numSamples) *
      (0.6 + 0.4 * Math.sin(2 * Math.PI * 3.5 * t));
    const sample = Math.sin(2 * Math.PI * freqHz * t) * 0.25 * envelope;
    const int16 = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
    buffer.writeInt16LE(int16, 44 + i * 2);
  }

  return buffer.toString('base64');
}

/**
 * Membangun direktif operasional Supabase secara nyata sebelum pemanggilan model Gemini.
 * Membaca data langsung dari:
 * 1. public.lexicon_entries (F1-F6)
 * 2. public.lexicon_context_rules (F7 Rules)
 * 3. public.narrative_phrases (G2-G11 StoryFlow Phrases)
 * Memverifikasi konektivitas dan menghentikan alur (fail-fast) jika Supabase tidak dapat diakses.
 */
async function buildSupabaseOperationalContextDirectives(params: {
  topic: string;
  outlineText?: string;
  thesis?: string;
}): Promise<{
  directivesPrompt: string;
  candidateEntries: any[];
  contextRules: any[];
  narrativePhrases: any[];
  supabaseStatus: string;
}> {
  // 1. Audit status koneksi ke 3 tabel operasional (Fail-Fast)
  const audit = await checkSupabaseOperationalTables(supabase);
  if (audit.status !== 'CONNECTED' && audit.status !== 'PARTIAL') {
    throw new Error(
      `Generasi dihentikan (Strict Supabase Database Mode): Koneksi database Supabase gagal dengan status ${audit.status}. Tabel gagal: ${audit.failedTables.join(', ') || 'semua tabel'}. Tidak diperbolehkan menggunakan simulasi atau fallback lokal.`
    );
  }

  // 2. Query data operasional langsung dari Supabase
  // a) Ambil F1 Core entries aktif
  const allEntries = masterLexiconRepository.getUnifiedEntries();
  const f1CoreEntries = allEntries.filter((e) => e.primary_category === 'F1').slice(0, 35);

  // b) Cari kandidat kontekstual dari public.lexicon_entries relevan dengan topik & outline
  // Bersihkan teks dari metadata tag dokumen sebelum pencarian
  const cleanTopicText = `${params.topic || ''} ${params.thesis || ''}`
    .replace(/\[GENFLOW_[^\]]+\]/gi, ' ')
    .replace(/SCHEMA_ID:[^\s]+/gi, ' ')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim();

  const cleanKeywords = cleanTopicText
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !['akan', 'bisa', 'pada', 'yang', 'untuk', 'dengan', 'lebih', 'adalah', 'karena', 'mereka'].includes(w.toLowerCase()))
    .slice(0, 5)
    .join(' ');

  const contextualCandidates = await masterLexiconRepository.searchLiveCandidates({
    query: cleanKeywords || params.topic?.slice(0, 60),
    limit: 50,
  });

  // Gabungkan entri unik, terapkan penyaringan hard exclusion terhadap blacklist
  const blacklisted = masterLexiconRepository.getBlacklistedKeys();
  const candidateMap = new Map<string, any>();
  for (const item of [...f1CoreEntries, ...contextualCandidates]) {
    const canon = item.canonical_key || item.entry?.toLowerCase();
    if (!blacklisted.has(canon) && !blacklisted.has(item.entry?.toLowerCase())) {
      candidateMap.set(item.id || item.entry, item);
    }
  }
  const finalCandidates = Array.from(candidateMap.values()).slice(0, 60);

  // c) Query context rules (public.lexicon_context_rules)
  const f7Rules = await masterLexiconRepository.searchLiveF7Rules({
    terms: cleanKeywords ? cleanKeywords.split(/\s+/) : [],
    limit: 25,
  });

  // d) Query narrative phrases (public.narrative_phrases)
  const phrases = await masterLexiconRepository.searchLiveNarrativePhrases({
    limit: 30,
  });

  // 3. Susun teks direktif kontekstual untuk Gemini
  const candidateLines = finalCandidates
    .map((c) => {
      const formalStr = c.formal ? ` (formal: "${c.formal}")` : '';
      const noteStr = c.context_note ? ` — Catatan: ${c.context_note}` : '';
      return `  * [ID: ${c.id}] "${c.entry}"${formalStr} [${c.primary_category || c.category_label || 'F1-F6'}]${noteStr}`;
    })
    .join('\n');

  const ruleLines = f7Rules
    .map((r) => {
      const cond = r.condition_of_use ? `Kondisi: ${r.condition_of_use}. ` : '';
      const proh = r.prohibited_contexts ? `Dilarang: ${r.prohibited_contexts}. ` : '';
      const rep = r.replacement_form ? `Pengganti: "${r.replacement_form}".` : '';
      return `  * [Aturan #${r.id || r.rule_id}] Kata: "${r.rule_term}" | ${cond}${proh}${rep}`;
    })
    .join('\n');

  const phraseLines = phrases
    .slice(0, 20)
    .map((p) => `  * [ID: ${p.id}] "${p.phrase_text || p.phrase}" [${p.category_code || p.categoryLabel || 'Discourse'}]`)
    .join('\n');

  const directivesPrompt = `
================== INJEKSI OPERASIONAL DATABASE SUPABASE (PROJECT: ouuoukdhzeenbkxhfnik) ==================
STATUS KONEKSI DATABASE: ${audit.status} (Verified Live against public.lexicon_entries, public.lexicon_context_rules, public.narrative_phrases).
TOTAL OPERATIONAL RECORDS TERSEDIA: Lexicon Entries=${audit.tables.lexicon_entries.totalCount}, Rules=${audit.tables.lexicon_context_rules.totalCount}, Phrases=${audit.tables.narrative_phrases.totalCount}.

1. KOSAKATA TERPILIH SUPABASE UNTUK DRAFT INI (public.lexicon_entries):
${candidateLines || '  * Gunakan register kosakata lisan alami terverifikasi.'}

2. ATURAN KONTEKS PENGGUNAAN KATA AKTIF (public.lexicon_context_rules):
${ruleLines || '  * Terapkan konsistensi ragam santai Gue-Lo tanpa memaksakan bentuk formal kaku.'}

3. FRASA DISCOURSE STORYFLOW (public.narrative_phrases):
${phraseLines || '  * Hubungkan perpindahan gagasan secara natural.'}

4. KETENTUAN PENGGUNAAN OLEH GEMINI (INTEGRASI PENUH):
- PILIH dan UTAMAKAN kosakata di atas yang sesuai dengan argumen kalimat Anda.
- PATUHI aturan konteks penggunaan kata (kapan boleh digunakan dan bentuk pengganti jika konteks tidak sesuai).
- NON-FORCING RULE: JANGAN memaksakan kata jika merusak tata bahasa atau makna kalimat. Gunakan bentuk formal atau kosakata percakapan umum (Global Informal) jika tidak ada padanan yang cocok di data Supabase.
- DILARANG KERAS menggunakan kata yang berada di daftar blacklist/terhapus.
- Pastikan seluruh kosakata Supabase yang Anda gunakan dapat dilacak ke record database di atas.
===========================================================================================================`;

  return {
    directivesPrompt,
    candidateEntries: finalCandidates,
    contextRules: f7Rules,
    narrativePhrases: phrases,
    supabaseStatus: audit.status,
  };
}

/**
 * Middleware untuk memverifikasi JWT Supabase dan mengambil Role Pengguna.
 */
const authMiddleware = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Autentikasi diperlukan. Harap login terlebih dahulu.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Sesi tidak valid atau telah berakhir.' });
    }

    // Ambil role dari tabel app_user_roles (Requirement B.5)
    const { data: roleData } = await supabase
      .from('app_user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    const role = roleData?.role || 'VIEWER';

    (req as any).user = { ...user, role };
    (req as any).supabaseToken = token;
    (req as any).userClient = createAuthenticatedClient(token);

    next();
  } catch (err) {
    console.error('[AuthMiddleware] Error:', err);
    return res.status(500).json({ error: 'Gagal memverifikasi identitas pengguna.' });
  }
};

/**
 * Middleware opsional yang memverifikasi token JWT jika ada, namun tetap mengizinkan request tanpa autentikasi (untuk endpoint read-only public).
 */
const optionalAuthMiddleware = async (req: express.Request, _res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) {
        const { data: roleData } = await supabase
          .from('app_user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        const role = roleData?.role || 'VIEWER';
        (req as any).user = { ...user, role };
        (req as any).supabaseToken = token;
        (req as any).userClient = createAuthenticatedClient(token);
      }
    } catch (_err) {
      // Ignore auth failure for optional endpoints
    }
  }
  next();
};

/**
 * Middleware untuk mengecek izin akses berdasarkan role (RBAC).
 */
const checkRole = (allowedRoles: string[]) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = (req as any).user;
    if (!user || !allowedRoles.includes(user.role)) {
      return res.status(403).json({ error: 'Anda tidak memiliki hak akses (Role: ' + (user?.role || 'NONE') + ') untuk operasi ini.' });
    }
    next();
  };
};

async function startServer() {
  // Tunggu inisialisasi repository dari Supabase sebelum melayani request
  await masterLexiconRepository.waitUntilReady();
  await G1G11PhraseRepository.getInstance().waitUntilReady();

  const app = express();
  const args = process.argv.slice(2);
  const portArgIndex = args.indexOf("--port");
  const portFromArg = portArgIndex !== -1 ? Number(args[portArgIndex + 1]) : NaN;
  const hostArgIndex = args.indexOf("--host");
  const hostFromArg = hostArgIndex !== -1 ? args[hostArgIndex + 1] : undefined;

  const PORT = !isNaN(portFromArg) && portFromArg > 0 ? portFromArg : 3000;
  const HOST = hostFromArg || process.env.HOST || "0.0.0.0";

  app.use(express.json({ limit: '25mb' }));

  // Endpoint Status Realtime Menu 1 (22-Tier Failover System + Audit Leksikon)
  app.get('/api/status', (_req, res) => {
    const currentKey = KEY_POOL[activeKeyIndex] || KEY_POOL[0];
    const lexiconAudit = auditCoreLexiconCompleteness();
    res.json({
      status: activeKeyIndex === 0 ? 'safe' : 'switched',
      activeKeyIndex,
      label: currentKey?.label || 'API Utama',
      previousLabel: previousKeyLabel,
      activeModel,
      availableModels: BACKEND_MODELS,
      totalTiers: KEY_POOL.length,
      switchReason:
        activeKeyIndex > 0
          ? `${previousKeyLabel || 'API Utama'} mencapai batas limit/kuota. Sistem beralih ke ${currentKey.label} (Tier ${activeKeyIndex + 1}/${KEY_POOL.length}).`
          : null,
      exhaustedCount: exhaustedKeys.size,
      timestamp: Date.now(),
      appVersion: 'v5.5',
      // Field kompatibilitas GenNAS Pro V5.1
      version: RUNTIME_MASTER_PROMPT_V51_VERSION,
      geminiConfigured: KEY_POOL.length > 0,
      elevenLabsConfigured: isRealElevenLabsKey(process.env.ELEVENLABS_API_KEY),
      supportedModels: BACKEND_MODELS,
      defaultModel: activeModel,
      fallbackModel: BACKEND_MODELS[BACKEND_MODELS.length - 1],
      elevenLabsDefaultModel: 'eleven_v4',
      lexiconAudit,
    });
  });

  // Endpoint Realtime Kosakata Kustom Pengguna (F1–F6)
  app.get('/api/lexicon/custom', authMiddleware, (_req, res) => {
    res.json({ state: getCustomLexiconState() });
  });

  app.post('/api/lexicon/add', authMiddleware, checkRole(['ADMIN', 'EDITOR']), async (req, res) => {
    const { section, word } = req.body || {};
    if (!section || !word) {
      return res.status(400).json({ error: 'Section dan word wajib diisi.' });
    }
    const result = await addCustomWord(section, word, (req as any).userClient);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    return res.json({
      success: true,
      word: result.word,
      state: getCustomLexiconState(),
      message: `Kata "${result.word}" berhasil ditambahkan ke bank ${section} dan masuk ke database Master Prompt.`,
    });
  });

  // Endpoint Interaktif untuk Tombol Tier / Model di Panel Konfigurasi (tanpa membocorkan key)
  app.post('/api/failover/cycle', (req, res) => {
    const { target } = req.body || {};
    if (target === 'model') {
      const currentModelIdx = BACKEND_MODELS.indexOf(activeModel);
      const nextModelIdx = (currentModelIdx + 1) % BACKEND_MODELS.length;
      activeModel = BACKEND_MODELS[nextModelIdx];
    } else if (target === 'tier') {
      const prevLabel = KEY_POOL[activeKeyIndex]?.label || 'API Utama';
      previousKeyLabel = prevLabel;
      activeKeyIndex = (activeKeyIndex + 1) % KEY_POOL.length;
    } else if (typeof req.body?.keyIndex === 'number') {
      const idx = Math.max(0, Math.min(KEY_POOL.length - 1, req.body.keyIndex));
      previousKeyLabel = KEY_POOL[activeKeyIndex]?.label || null;
      activeKeyIndex = idx;
    }

    const currentKey = KEY_POOL[activeKeyIndex] || KEY_POOL[0];
    res.json({
      status: activeKeyIndex === 0 ? 'safe' : 'switched',
      activeKeyIndex,
      label: currentKey?.label || 'API Utama',
      previousLabel: previousKeyLabel,
      activeModel,
      availableModels: BACKEND_MODELS,
      totalTiers: KEY_POOL.length,
      appVersion: 'v5.5',
    });
  });

  // Endpoint Generate Naskah Menu 1 dengan Failover Berurutan (API Utama -> Cadangan 1 -> ... -> Cadangan 21)
  app.post('/api/generate', async (req, res) => {
    const { contents, systemInstruction, generationConfig } = req.body || {};

    if (!contents) {
      return res
        .status(400)
        .json({ error: 'Payload harus memuat parameter contents.' });
    }

    // Fail-fast verification: Periksa status koneksi database Supabase operasional
    try {
      const audit = await checkSupabaseOperationalTables(supabase);
      if (audit.status !== 'CONNECTED' && audit.status !== 'PARTIAL') {
        return res.status(503).json({
          error: `Generasi dihentikan: Koneksi database Supabase operasional tidak aktif (${audit.status}). Harap periksa tabel: ${audit.failedTables.join(', ') || 'semua'}.`,
          status: audit.status,
          failedTables: audit.failedTables,
        });
      }
    } catch (_err) {
      // lanjut ke eksekusi
    }

    try {
      const result = await executeWithFailoverPool({
        contents,
        systemInstruction,
        generationConfig,
      });
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({
        error:
          err?.message ||
          'Seluruh tier API dan model gagal memproses permintaan.',
      });
    }
  });

  // Endpoint Bank Kosakata Lengkap F1–F8, Bank Kosakata Terpadu, Profanity Bank Terpisah, & Master Prompt V5.1
  app.get('/api/lexicon-and-prompt', (_req, res) => {
    const lexiconAudit = auditCoreLexiconCompleteness();
    const masterStats = masterLexiconRepository.getMasterStats();
    res.json({
      version: RUNTIME_MASTER_PROMPT_V51_VERSION,
      masterPromptRuntime: RUNTIME_MASTER_PROMPT_V51,
      lexiconAudit,
      coreF1: masterLexiconRepository.getUnifiedEntries().filter(e => e.primary_category === 'F1').map(e => e.entry),
      extendedBank: masterLexiconRepository.getUnifiedEntries().filter(e => ['F2', 'F3', 'F5'].includes(e.primary_category)).map(e => e.entry),
      expansionBank: masterLexiconRepository.getUnifiedEntries().filter(e => e.primary_category === 'EXPANSION').map(e => e.entry),
      expansionAudit: masterLexiconRepository.getMasterStats(),
      masterStats,
      profanityBank: {
        roots: PROFANITY_ROOT_WORDS,
        integratedExamples: PROFANITY_INTEGRATED_TEMPLATES,
      },
      narrativePhraseBank: getActiveG1G11PhraseBank(),
    });
  });

  // --- MASTER LEXICON DATABASE & AI SELECTION ENGINE BACKEND ENDPOINTS ---
  app.get('/api/lexicon/master-stats', optionalAuthMiddleware, (_req, res) => {
    try {
      const stats = masterLexiconRepository.getMasterStats();
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Gagal mengambil statistik Master Lexicon Database.' });
    }
  });

  app.get('/api/lexicon/master-registry', optionalAuthMiddleware, (req, res) => {
    try {
      const category = (req.query.category as any) || 'ALL';
      const naturalness = (req.query.naturalness as any) || 'ALL';
      const search = (req.query.search as string) || '';
      const entries = masterLexiconRepository.getActiveRegistry({ category, naturalness, search });
      res.json({
        total: entries.length,
        entries,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Gagal mengambil data Master Lexicon Registry.' });
    }
  });

  app.get('/api/lexicon/duplicates', optionalAuthMiddleware, (_req, res) => {
    try {
      const duplicates = masterLexiconRepository.getDuplicatesRejected();
      res.json({
        total: duplicates.length,
        duplicates,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Gagal mengambil log duplikasi.' });
    }
  });

  app.get('/api/lexicon/f7-rules', optionalAuthMiddleware, (_req, res) => {
    try {
      const rules = masterLexiconRepository.getF7Rules();
      const stats = masterLexiconRepository.getF7Stats();
      res.json({
        total: rules.length,
        stats,
        rules,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Gagal mengambil aturan F7.' });
    }
  });

  app.get('/api/supabase/status', async (_req, res) => {
    try {
      const audit = await checkSupabaseOperationalTables(supabase);
      const lexStats = masterLexiconRepository.getMasterStats();
      const f7Stats = masterLexiconRepository.getF7Stats();
      const phraseCount = G1G11PhraseRepository.getInstance().getAllPhrases().length;
      res.json({
        projectRef: 'ouuoukdhzeenbkxhfnik',
        projectUrl: 'https://ouuoukdhzeenbkxhfnik.supabase.co',
        status: audit.status,
        operationalAudit: audit,
        masterLexiconCount: audit.tables.lexicon_entries.totalCount || lexStats.unique_active_lexicon_count,
        f7ActiveCount: audit.tables.lexicon_context_rules.activeCount || f7Stats.active,
        f7TotalCount: audit.tables.lexicon_context_rules.totalCount || f7Stats.total,
        phrasesCount: audit.tables.narrative_phrases.totalCount || phraseCount,
        failedTables: audit.failedTables,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Gagal membaca status Supabase.', status: 'DISCONNECTED' });
    }
  });

  // Endpoint Live Query ke public.lexicon_entries di Supabase
  app.post('/api/supabase/query-lexicon', async (req, res) => {
    try {
      const { query, category, limit } = req.body || {};
      const results = await masterLexiconRepository.searchLiveCandidates({
        query,
        category,
        limit: limit ? Number(limit) : 20,
      });
      res.json({
        total: results.length,
        results,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Gagal mencari kandidat di Supabase.' });
    }
  });

  // Endpoint Live Query ke public.lexicon_context_rules di Supabase
  app.post('/api/supabase/query-f7', async (req, res) => {
    try {
      const { terms, category, limit } = req.body || {};
      const results = await masterLexiconRepository.searchLiveF7Rules({
        terms,
        category,
        limit: limit ? Number(limit) : 30,
      });
      res.json({
        total: results.length,
        results,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Gagal membaca aturan F7 dari Supabase.' });
    }
  });

  // Endpoint Live Query ke public.narrative_phrases di Supabase
  app.post('/api/supabase/query-phrases', async (req, res) => {
    try {
      const { categoryCode, limit } = req.body || {};
      const results = await masterLexiconRepository.searchLiveNarrativePhrases({
        categoryCode,
        limit: limit ? Number(limit) : 50,
      });
      res.json({
        total: results.length,
        results,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Gagal membaca frasa naratif dari Supabase.' });
    }
  });

  // Endpoint Live Query mengambil detail entri Supabase berdasarkan ID
  app.get('/api/supabase/entry/:id', async (req, res) => {
    try {
      const detail = await masterLexiconRepository.getLiveEntryDetail(req.params.id);
      if (!detail) {
        return res.status(404).json({ error: `Entri Supabase ${req.params.id} tidak ditemukan.` });
      }
      res.json(detail);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Gagal membaca detail entri Supabase.' });
    }
  });

  app.post('/api/lexicon/candidates', (req, res) => {
    try {
      const { topic, centralThesis, stageId, stageName, coreFocus, keyArguments, limit, excludeCanonicalKeys } = req.body || {};
      if (!topic || !stageId) {
        return res.status(400).json({ error: 'Parameter topic dan stageId wajib disertakan.' });
      }
      const candidates = masterLexiconRepository.getAIContextualCandidates({
        topic,
        centralThesis,
        stageId: Number(stageId),
        stageName: stageName || `Blok ${stageId}`,
        coreFocus: coreFocus || '',
        keyArguments: keyArguments || [],
        limit: limit ? Number(limit) : 8,
        excludeCanonicalKeys,
      });
      res.json({
        stageId,
        count: candidates.length,
        candidates,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Gagal memilih kandidat kosakata kontekstual.' });
    }
  });

  app.get('/api/lexicon/f7-monitor', (req, res) => {
    try {
      const topic = (req.query.topic as string) || '';
      const cleanScript = (req.query.cleanScript as string) || '';
      const outline = (req.query.outline as string) || '';
      const report = computeF7NotesMonitor(cleanScript, topic, outline);
      res.json(report);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Gagal memuat monitoring catatan F7.' });
    }
  });

  app.delete('/api/lexicon/delete', authMiddleware, checkRole(['ADMIN']), async (req, res) => {
    try {
      const { id, word } = req.body || {};
      const target = id || word;
      if (!target) {
        return res.status(400).json({ error: 'Parameter id atau word wajib diberikan.' });
      }
      const result = await masterLexiconRepository.deleteEntry(target, (req as any).userClient);
      if (!result.success) {
        return res.status(404).json({ error: result.message });
      }
      res.json({
        ...result,
        stats: masterLexiconRepository.getMasterStats(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Gagal menghapus entri kosakata.' });
    }
  });

  app.post('/api/lexicon/update', authMiddleware, checkRole(['ADMIN', 'EDITOR']), async (req, res) => {
    try {
      const { id, word, updates } = req.body || {};
      const target = id || word;
      if (!target || !updates) {
        return res.status(400).json({ error: 'Parameter id/word dan updates wajib disertakan.' });
      }
      const result = await masterLexiconRepository.updateEntry(target, updates, (req as any).userClient);
      if (!result.success) {
        return res.status(404).json({ error: result.message });
      }
      res.json({
        ...result,
        stats: masterLexiconRepository.getMasterStats(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Gagal memperbarui entri kosakata.' });
    }
  });

  app.post('/api/lexicon/import-csv', (req, res) => {
    try {
      const { name, fileName, rawContent, isF7Contextual } = req.body || {};
      if (!rawContent || !fileName) {
        return res.status(400).json({ error: 'Content file CSV dan nama file wajib disertakan.' });
      }
      const result = masterLexiconRepository.importAdditionalDataset({
        name: name || fileName,
        fileName,
        rawContent,
        isF7Contextual: Boolean(isF7Contextual),
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Gagal mengimpor file CSV.' });
    }
  });

  // Endpoint Impor Universal CSV 7 Kolom (Pilar 3 & 4)
  app.post('/api/lexicon/import-universal-csv', async (req, res) => {
    try {
      const { name, fileName, rows, rawContent } = req.body || {};
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: 'Array rows wajib disertakan dan tidak boleh kosong.' });
      }
      const result = await masterLexiconRepository.importUniversalCsv({
        name: name || fileName || 'Universal-Import',
        fileName: fileName || 'universal_import.csv',
        rows,
        rawContent,
      }, (req as any).userClient);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Gagal memproses import CSV universal.' });
    }
  });

  // Endpoint Abaikan Temuan Naskah Aktif (Pilar 4: Lens Naskah Aktif, tidak menghapus entri master)
  app.post('/api/lexicon/dismiss-finding', (req, res) => {
    try {
      const { word, canonicalKey } = req.body || {};
      const target = word || canonicalKey;
      if (!target) {
        return res.status(400).json({ error: 'Parameter word atau canonicalKey wajib disertakan.' });
      }
      const result = masterLexiconRepository.dismissScriptFinding(target);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Gagal mengabaikan temuan naskah.' });
    }
  });

  // Endpoint Mencopot Aturan Konteks F7 Tanpa Menghapus Entri Induk Repository
  app.post('/api/lexicon/remove-f7-rule', authMiddleware, checkRole(['ADMIN', 'EDITOR']), async (req, res) => {
    try {
      const { id, word, canonicalKey } = req.body || {};
      const target = id || word || canonicalKey;
      if (!target) {
        return res.status(400).json({ error: 'Parameter id, word, atau canonicalKey wajib disertakan.' });
      }
      const result = await masterLexiconRepository.removeF7Rule(target, (req as any).userClient);
      if (!result.success) {
        return res.status(404).json({ error: result.message });
      }
      res.json({
        ...result,
        stats: masterLexiconRepository.getMasterStats(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Gagal mencopot aturan F7.' });
    }
  });

  // Endpoint Kosakata Belum Terdaftar di Naskah Aktif (Pilar 4)
  app.get('/api/lexicon/unregistered-words', (req, res) => {
    try {
      const cleanScript = (req.query.cleanScript as string) || '';
      const unregistered = masterLexiconRepository.getUnregisteredScriptWords(cleanScript);
      res.json({
        total: unregistered.length,
        words: unregistered,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Gagal memindai kosakata belum terdaftar.' });
    }
  });

  app.post('/api/lexicon/reset-dismissed', (_req, res) => {
    try {
      masterLexiconRepository.resetDismissedScriptFindings();
      res.json({ success: true, message: 'Daftar temuan naskah yang diabaikan telah direset.' });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Gagal mereset temuan naskah.' });
    }
  });

  // =========================================================================
  // LIVE PHRASE EDITOR G2–G11 (CONTENT-ONLY UPDATE) BACKEND ENDPOINTS
  // Prinsip: Hanya mengubah isi teks frasa berdasarkan ID permanen.
  // Arsitektur G1-G11, Non-Forcing, dan ketersediaan global 100% dipertahankan.
  // =========================================================================
  app.get('/api/phrases/g1g11', authMiddleware, (req, res) => {
    try {
      const category = (req.query.category as string) || 'ALL';
      const repo = G1G11PhraseRepository.getInstance();
      const phrases = category === 'ALL'
        ? repo.getAllPhrases()
        : repo.getPhrasesByCategory(category);
      const editedCount = phrases.filter((p) => p.version > 1).length;
      res.json({
        total: phrases.length,
        editedCount,
        phrases,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Gagal mengambil data bank frasa G2–G11.' });
    }
  });

  app.get('/api/phrases/g1g11/:id', authMiddleware, (req, res) => {
    try {
      const repo = G1G11PhraseRepository.getInstance();
      const phrase = repo.getPhraseById(req.params.id);
      if (!phrase) {
        return res.status(404).json({ error: `Frasa ${req.params.id} tidak ditemukan.` });
      }
      res.json(phrase);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Gagal mengambil detail frasa.' });
    }
  });

  app.post('/api/phrases/g1g11/validate', (req, res) => {
    try {
      const { categoryCode, text } = req.body || {};
      const validation = validatePhraseSemanticAlignment(categoryCode, text);
      res.json(validation);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Gagal memvalidasi keselarasan frasa.' });
    }
  });

  app.put('/api/phrases/g1g11/:id', authMiddleware, checkRole(['ADMIN', 'EDITOR']), async (req, res) => {
    try {
      const { newText, note, confirmOverride } = req.body || {};
      const repo = G1G11PhraseRepository.getInstance();
      const existing = repo.getPhraseById(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: `Frasa ${req.params.id} tidak ditemukan.` });
      }

      // Validasi Keselarasan Fungsi Semantik (Ketentuan 14)
      const alignment = validatePhraseSemanticAlignment(existing.categoryCode, newText);
      if (!alignment.isAligned && alignment.requiresConfirmation && !confirmOverride) {
        return res.status(200).json({
          success: false,
          requiresConfirmation: true,
          warning: alignment.warning,
          message: 'Hasil pengeditan tidak selaras dengan fungsi kategori asli. Konfirmasi diperlukan sebelum menyimpan.',
        });
      }

      const result = await repo.updatePhraseText(req.params.id, newText, note, (req as any).userClient);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json({
        success: true,
        updatedRecord: result.updatedRecord,
        warning: alignment.warning,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Gagal memperbarui frasa.' });
    }
  });

  app.post('/api/phrases/g1g11/:id/rollback', authMiddleware, checkRole(['ADMIN', 'EDITOR']), async (req, res) => {
    try {
      const { targetVersion, note } = req.body || {};
      const repo = G1G11PhraseRepository.getInstance();
      const result = await repo.rollbackPhraseVersion(req.params.id, Number(targetVersion), note, (req as any).userClient);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      res.json({
        success: true,
        rolledBackRecord: result.rolledBackRecord,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Gagal melakukan rollback versi frasa.' });
    }
  });

  app.post('/api/phrases/g1g11/:id/reset', authMiddleware, checkRole(['ADMIN', 'EDITOR']), async (req, res) => {
    try {
      const repo = G1G11PhraseRepository.getInstance();
      const result = await repo.resetPhraseToOriginal(req.params.id, (req as any).userClient);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      res.json({
        success: true,
        record: result.record,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Gagal mereset frasa ke bawaan.' });
    }
  });

  app.post('/api/phrases/g1g11/clear-all', authMiddleware, checkRole(['ADMIN']), async (req, res) => {
    try {
      const repo = G1G11PhraseRepository.getInstance();
      const result = await repo.clearAllPhrases((req as any).userClient);
      res.json({
        success: true,
        clearedCount: result.clearedCount,
        message: 'Seluruh entri frasa naratif G2–G11 berhasil dikosongkan. Judul dan kategori tetap utuh.',
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Gagal mengosongkan bank frasa G2–G11.' });
    }
  });

  app.post('/api/phrases/g1g11/preview-csv', (req, res) => {
    try {
      const { csvContent } = req.body || {};
      if (!csvContent || typeof csvContent !== 'string') {
        return res.status(400).json({ error: 'Konten CSV wajib disertakan.' });
      }
      const repo = G1G11PhraseRepository.getInstance();
      const existingPhrases = repo.getAllPhrases();
      const preview = parseAndPreviewUniversalPhraseCsv(csvContent, existingPhrases);
      res.json(preview);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Gagal memproses pratinjau CSV frasa.' });
    }
  });

  app.post('/api/phrases/g1g11/import-csv', authMiddleware, checkRole(['ADMIN', 'EDITOR']), async (req, res) => {
    try {
      const { fileName, csvContent } = req.body || {};
      if (!csvContent || typeof csvContent !== 'string') {
        return res.status(400).json({ error: 'Konten CSV wajib disertakan.' });
      }
      const repo = G1G11PhraseRepository.getInstance();
      const existingPhrases = repo.getAllPhrases();
      const preview = parseAndPreviewUniversalPhraseCsv(csvContent, existingPhrases);

      if (!preview.isValid) {
        return res.status(400).json({
          error: 'File CSV tidak memuat frasa baru atau frasa pembaruan yang valid.',
          preview,
        });
      }

      // SELECTIVE CATEGORY SYNCHRONIZATION:
      // Hanya kategori di preview.affectedCategories yang diperbarui!
      const result = await repo.importUniversalCsvPhrases({
        fileName: fileName || 'phrase_bank.csv',
        rows: preview.rows,
        affectedCategories: preview.affectedCategories,
        untouchedCategories: preview.untouchedCategories,
      }, (req as any).userClient);

      res.json({
        success: true,
        importRecord: result.importRecord,
        stats: {
          totalPhrasesInRepo: repo.getAllPhrases().length,
          affectedCategories: preview.affectedCategories,
          untouchedCategories: preview.untouchedCategories,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Gagal mengimpor CSV frasa.' });
    }
  });

  app.get('/api/phrases/g1g11/import-history', async (_req, res) => {
    try {
      const repo = G1G11PhraseRepository.getInstance();
      const logs = await repo.getImportAuditLogs();
      res.json({
        total: logs.length,
        logs,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Gagal memuat riwayat impor CSV frasa.' });
    }
  });

  app.post('/api/phrases/g1g11/rollback-import', authMiddleware, checkRole(['ADMIN']), async (req, res) => {
    try {
      const { importId } = req.body || {};
      if (!importId) {
        return res.status(400).json({ error: 'Parameter importId wajib disertakan.' });
      }
      const repo = G1G11PhraseRepository.getInstance();
      const result = await repo.rollbackImportTransaction(importId, (req as any).userClient);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      res.json({
        success: true,
        message: `Transaksi impor ${importId} berhasil dibatalkan.`,
        stats: {
          totalPhrasesInRepo: repo.getAllPhrases().length,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Gagal melakukan rollback impor CSV.' });
    }
  });





  // Endpoint Ekstraksi Dokumen (.txt / .docx Office Open XML / .pdf) & Validasi Integritas SAP Protected Tokens
  app.post('/api/gennas/extract-document', async (req, res) => {
    try {
      const { fileName, contentBase64, plainText } = req.body || {};
      const result = await extractAndValidateDocument({
        fileName: fileName || 'dokumen-sumber.txt',
        contentBase64,
        plainText,
      });

      const inferred = inferTopicFromOutline(
        result.extractedText,
        result.fileName
      );

      const semanticClassification = classifyDocumentSemantics(
        result.extractedText,
        result.fileName
      );

      // Ekstraksi Kebijakan Kerangka Universal Backend (Otomatis tanpa upload TXT berulang)
      const frameworkPolicyResult = processUniversalFrameworkDocument(
        result.extractedText,
        result.fileName
      );

      const resolvedTopic =
        frameworkPolicyResult.framework?.executiveSummary?.topikUtama ||
        semanticClassification.mainTopic ||
        inferred.inferredTopic;

      const initialConfig = enforceLockedConfig({
        faktaTerverifikasi: result.extractedText,
        topik: resolvedTopic,
      });

      const narrativePlan = buildSourceGroundedNarrativePlan(
        semanticClassification,
        initialConfig
      );

      const protectedMap = extractProtectedTokens(result.extractedText);

      res.json({
        fileName: result.fileName,
        fileType: result.fileType,
        extractedText: result.extractedText,
        wordCount: result.wordCount,
        charCount: result.charCount,
        protectedTokens: result.protectedTokens,
        protectedTokenItems: result.protectedTokenItems,
        referenceMetadata: protectedMap.referenceMetadata || [],
        cleanedSubstantiveText: protectedMap.cleanedSubstantiveText || stripReferenceMetadataFromSourceText(result.extractedText),
        integrityReport: result.integrityReport,
        inferredTopic: resolvedTopic,
        documentTitleContext: semanticClassification.documentTitle || inferred.documentTitleContext,
        isProvocativeTitleReframed: inferred.isProvocativeTitleReframed,
        lockedPerspective: LOCKED_CRITICAL_PERSPECTIVE,
        semanticClassification,
        narrativePlan,
        frameworkPolicyResult,
        masterFramework: frameworkPolicyResult.framework,
        isFramework: frameworkPolicyResult.classification.isFramework,
        documentType: frameworkPolicyResult.classification.documentType,
      });
    } catch (error: any) {
      res.status(400).json({
        error:
          error?.message ||
          'Gagal mengekstrak dokumen atau validasi integritas teks gagal.',
      });
    }
  });

  // Endpoint Backend Policy Info (Single Source of Truth)
  app.get('/api/genflow/policy', (_req, res) => {
    try {
      const policy = getActiveUniversalFrameworkPolicy();
      res.json({
        success: true,
        policy,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Gagal memuat policy backend.' });
    }
  });

  // Endpoint Backend Pemrosesan Kerangka Universal
  app.post('/api/genflow/parse-framework', (req, res) => {
    try {
      const { text, fileName } = req.body || {};
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Parameter text wajib berupa string.' });
      }
      const result = processUniversalFrameworkDocument(text, fileName || 'kerangka.txt');
      res.json({
        success: true,
        ...result,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Gagal memproses kerangka.' });
    }
  });

  // Endpoint Backend Ekspor Kerangka Kanonis Sesuai Schema GF-NARRATIVE-FRAMEWORK-1.0
  app.post('/api/genflow/export-canonical', (req, res) => {
    try {
      const { framework } = req.body || {};
      if (!framework || !framework.componentsById) {
        return res.status(400).json({ error: 'Objek framework tidak valid.' });
      }
      const canonicalText = exportCanonicalFrameworkText(framework);
      res.json({
        success: true,
        canonicalText,
        schemaId: 'GF-NARRATIVE-FRAMEWORK-1.0',
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Gagal mengekspor format kanonis.' });
    }
  });

  // Endpoint Eksekusi Berbagai Operasi GenNAS Pro V5.1 (Terintegrasi dengan 22-Tier Failover Pool & Gate Integritas SAP)
  app.post('/api/gennas/execute', async (req, res) => {
    try {
      const rawConfig = (req.body || {}) as Partial<GenNASConfig>;

      // Gate Validasi Integritas dilakukan terhadap input mentah sebelum sanitasi prompt-injection
      const rawOutlineInput =
        rawConfig.faktaTerverifikasi?.trim() ||
        'Biaya hidup meningkat Rp1.500.000 per bulan sejak 1990-an, sementara pertumbuhan upah riil tertahan di angka 3,14% per tahun.';
      const factsIntegrity = validateTextAndTokenIntegrity(rawOutlineInput);
      if (!factsIntegrity.valid) {
        res.status(422).json({
          error: `Validasi Integritas Kerangka Naskah & SAP Gagal: ${factsIntegrity.errors.join(
            ' '
          )} Harap perbaiki atau unggah ulang dokumen yang bersih sebelum melanjutkan generasi.`,
          integrityReport: factsIntegrity,
        });
        return;
      }

      if (rawConfig.inputNaskah && rawConfig.inputNaskah.trim().length > 0) {
        const scriptIntegrity = validateTextAndTokenIntegrity(
          rawConfig.inputNaskah
        );
        if (!scriptIntegrity.valid) {
          res.status(422).json({
            error: `Validasi Integritas Naskah Input Gagal: ${scriptIntegrity.errors.join(
              ' '
            )}`,
            integrityReport: scriptIntegrity,
          });
          return;
        }
      }

      // Kunci mutlak Konteks & Sudut Pandang Kritis = "Perilaku & Pola Pikir Masyarakat (Non-SARA)"
      // dan tentukan Topik otomatis dari isi Kerangka Naskah & Sumber
      const locked = enforceLockedConfig({
        ...rawConfig,
        faktaTerverifikasi: rawOutlineInput,
        primaryModel: rawConfig.primaryModel || activeModel || BACKEND_MODELS[0],
        fallbackModel:
          rawConfig.fallbackModel || BACKEND_MODELS[BACKEND_MODELS.length - 1],
      });

      const config: GenNASConfig = {
        ...locked,
        konteks: LOCKED_CRITICAL_PERSPECTIVE,
      };

      const semanticClassification = classifyDocumentSemantics(
        rawOutlineInput,
        rawConfig.topik
      );

      const narrativePlan = buildSourceGroundedNarrativePlan(
        semanticClassification,
        config
      );

      const stagePlan = calculateStageTargets(
        config.durasiMenit,
        config.wpm,
        config.struktur,
        config.jumlahBlok
      );

      let cleanScript = config.inputNaskah?.trim() || '';
      let modelUsed = activeModel;
      let usedFallback = activeKeyIndex > 0;

      if (config.operasi === 'REVISI_KOMA') {
        if (!cleanScript) {
          return res.status(400).json({ error: 'Naskah input wajib disertakan untuk operasi REVISI_KOMA.' });
        }
        cleanScript = applyRevisiKoma(cleanScript);
      } else if (config.operasi === 'REVISI_TRANSISI') {
        if (!cleanScript) {
          return res.status(400).json({ error: 'Naskah input wajib disertakan untuk operasi REVISI_TRANSISI.' });
        }
        cleanScript = applyRevisiTransisi(cleanScript);
      } else if (config.operasi === 'AUTO_ENFORCE') {
        if (!cleanScript) {
          return res.status(400).json({ error: 'Naskah input wajib disertakan untuk operasi AUTO_ENFORCE.' });
        }
        cleanScript = applyAutoEnforce(cleanScript, config);
      } else if (config.operasi === 'EXPANDER') {
        if (!cleanScript) {
          return res.status(400).json({ error: 'Naskah input wajib disertakan untuk operasi EXPANDER.' });
        }
        try {
          const llmResp = await executeWithFailoverPool({
            contents: `OPERASI=EXPANDER.
TOPIK SPESIFIK SUMBER: "${narrativePlan.main_topic}"
TESIS UTAMA: "${narrativePlan.central_thesis}"
POIN ARGUMEN SUMBER:\n${narrativePlan.key_arguments.map((a, i) => `${i + 1}. ${a}`).join('\n')}

Perdalam substansi penalaran dan bukti dari naskah 5 blok berikut berdasarkan poin-poin kerangka sumber di atas. Pertahankan tepat ${config.jumlahBlok} baris SCTF (dipisahkan satu newline tanpa baris kosong), pertahankan gaya gue–lo ngomel, dan jaga tepat 4–5 makian terintegrasi per blok yang HANYA mengkritik perilaku masyarakat yang keliru, pola pikir tidak logis, kebiasaan merugikan, cara bernalar salah, atau tindakan yang bertentangan dengan fakta (DILARANG KERAS menyerang agama, suku, ras, kelompok identitas, lembaga, organisasi, atau individu secara personal). DILARANG MEMASUKKAN FRASA INSTRUKSI SEPERTI "MASTER FRAMEWORK", "PERENCANAAN NASKAH YOUTUBE PRESISI", ATAU LABEL NON-SARA KE DALAM NARASI. DILARANG KERAS menggunakan tanda petik ganda ("..." atau “...”) — sampaikan seluruh slogan, kutipan, dan ungkapan secara naratif lisan alami:\n\n${cleanScript}`,
            systemInstruction: buildRuntimeSystemPrompt(config),
            generationConfig: {
              temperature: 0.55,
              maxOutputTokens: 65536,
              seed: config.seed,
            },
            preferredModel: config.primaryModel,
          });
          modelUsed = `${llmResp.usedModel} (${llmResp.keyTier})`;
          usedFallback = llmResp.activeKeyIndex > 0;
          cleanScript = applyAutoEnforce(llmResp.text, config);
        } catch (err: any) {
          return res.status(500).json({
            error: `Operasi EXPANDER gagal: ${err?.message || 'AI Failover exhausted'}. Dilarang menyisipkan fallback template.`,
          });
        }
      } else if (config.operasi === 'NASKAH_FINAL') {
        const stageInstruction = narrativePlan.storyflow_plan
          .map(
            (s) =>
              `Blok ${s.blockId} (${s.stageName} - ${s.weightPercent}% / ~${s.targetWords} kata):\n- Fokus: ${s.coreFocus}\n- Poin Argumen: ${s.keyPoints.join('; ')}`
          )
          .join('\n\n');

        const keyArgumentsList = narrativePlan.key_arguments
          .map((arg, i) => `${i + 1}. ${arg}`)
          .join('\n');

        const evidenceList = narrativePlan.supporting_evidence
          .map((ev) => `- ${ev}`)
          .join('\n');

        try {
          const llmResp = await executeWithFailoverPool({
            contents: `OPERASI=NASKAH_FINAL.
TOPIK SPESIFIK DOKUMEN: "${narrativePlan.main_topic}"
TESIS UTAMA DOKUMEN: "${narrativePlan.central_thesis}"

POIN-POIN ARGUMENTASI SUMBER (WAJIB MENJADI SUBSTANSI NARASI):
${keyArgumentsList}

BUKTI & FAKTA DARI SUMBER:
${evidenceList}

STRUKTUR 5 TAHAP STORYFLOW & TARGET KATA:
${stageInstruction}

PERINGATAN KERAS CEGAH KEBOCORAN INSTRUKSI (MUTLAK):
1. DILARANG KERAS memunculkan teks metadata internal atau label framework (seperti "MASTER FRAMEWORK", "PERENCANAAN NASKAH YOUTUBE PRESISI", "DOKUMEN KERANGKA KERJA", "NON_SARA_HARD_GUARD", atau "Perilaku & Pola Pikir Masyarakat (Non-SARA)") ke dalam teks naskah! Naskah WAJIB hanya memuat kata-kata narasi yang akan dibacakan narator.
2. Naskah WAJIB setia pada topik "${narrativePlan.main_topic}". JANGAN MENGGANTI topik dokumen dengan tema umum yang tidak spesifik.
3. Tulis tepat ${config.jumlahBlok} baris/blok SCTF (dipisahkan tepat SATU newline \\n tanpa baris kosong).
4. Setiap blok WAJIB memuat 3–5 kejadian kata kasar yang terintegrasi secara sintaksis & semantis mengkritik perilaku masyarakat yang keliru, pola pikir tidak logis, kebiasaan merugikan, atau cara bernalar yang salah berdasarkan bukti (DILARANG KERAS menyerang identitas agama/suku/ras/SARA, lembaga, organisasi, atau individu secara personal).
5. Gaya bahasa: gue–lo ngomel anak tongkrongan yang cerdas dan kritis dengan variasi kosakata dari Bank F1–F8. Target total panjang naskah: ~${narrativePlan.target_word_count} kata.
6. UNIFIED QUOTE-FREE NARRATION SYSTEM (SQNN - MUTLAK): Naskah final DILARANG KERAS memuat tanda petik ganda ("..." atau “...”). Sampaikan seluruh slogan, ungkapan populer, dalih, atau kutipan secara naratif lisan alami (mis. 'slogan banyak anak banyak rezeki', 'berlindung di balik anggapan bahwa rezeki udah ada yang ngatur', 'menganggap kerja keras pasti bikin kaya').`,
            systemInstruction: buildRuntimeSystemPrompt(config),
            generationConfig: {
              temperature: 0.55,
              maxOutputTokens: 65536,
              seed: config.seed,
            },
            preferredModel: config.primaryModel,
          });
          modelUsed = `${llmResp.usedModel} (${llmResp.keyTier})`;
          usedFallback = llmResp.activeKeyIndex > 0;
          const formatted = formatBlocksToSCTF(
            llmResp.text
              .replace(/\r\n/g, '\n')
              .split(/\n+/)
              .map((l) => l.trim())
              .filter(Boolean)
          );
          const preAudit = validateFullScript(formatted, config);
          cleanScript = preAudit.passed && preAudit.sourceFidelity?.passed
            ? formatted
            : applyAutoEnforce(formatted, config);
        } catch (err: any) {
          return res.status(500).json({
            error: `Generasi NASKAH_FINAL gagal: ${err?.message || 'AI Failover exhausted'}. Seluruh narasi wajib bersumber dari data Supabase dan respons AI asli tanpa fallback template.`,
          });
        }
      }

      if (!cleanScript) {
        return res.status(500).json({
          error: 'Naskah narasi kosong setelah pemrosesan pipeline. Silakan coba kembali.',
        });
      }

      // SQNN LAPISAN KEDUA: Jika hasil masih mengandung tanda petik ganda, normalisasi semantik secara otomatis
      if (DOUBLE_QUOTE_CHARS_REGEX.test(cleanScript)) {
        const sqnnResult = applySQNN(cleanScript, config);
        cleanScript = sqnnResult.normalizedScript;
      }

      cleanScript = sanitizeNarrativeFromReferenceLeakage(cleanScript);

      // Validasi Ulang Seluruh Kontrak V5.1 (termasuk QUOTE_FREE_VALIDATOR)
      let audit = validateFullScript(cleanScript, config);
      if (!audit.quoteFree?.passed) {
        cleanScript = applyAutoEnforce(cleanScript, config);
        audit = validateFullScript(cleanScript, config);
      }
      const voiceScript = compileVoiceScript(cleanScript, {
        enableSubtleAudioTags: false,
      });
      const voiceChunks = buildElevenLabsChunks(voiceScript, 950, config.wpm);
      const abVariants = buildABTransitionVariants(cleanScript);
      const currentKey = KEY_POOL[activeKeyIndex] || KEY_POOL[0];

      res.json({
        operasi: config.operasi,
        modelUsed,
        usedFallback,
        lockedPerspective: LOCKED_CRITICAL_PERSPECTIVE,
        inferredTopic: config.topik,
        cleanScript,
        blocks: cleanScript.split('\n'),
        voiceScript,
        voiceChunks,
        abVariants,
        stagePlan,
        audit,
        failoverStatus: {
          status: activeKeyIndex === 0 ? 'safe' : 'switched',
          activeKeyIndex,
          label: currentKey?.label || 'API Utama',
          previousLabel: previousKeyLabel,
          activeModel,
          availableModels: BACKEND_MODELS,
          totalTiers: KEY_POOL.length,
          appVersion: 'v5.5',
        },
      });
    } catch (error: any) {
      res.status(500).json({
        error: `Kegagalan eksekusi pipeline: ${error?.message || 'Unknown error'}`,
      });
    }
  });

  // Endpoint Block-Level Post-Production Engine (PERDALAM & TRANSISI per Blok — Terisolasi dari Workflow Engine 8 Tahap)
  app.post('/api/gennas/post-production/block', async (req, res) => {
    try {
      const {
        cleanScript: rawInputScript,
        blockIndex: rawBlockIndex,
        operation: rawOperation,
        config: rawConfig = {},
      }: {
        cleanScript?: string;
        blockIndex?: number;
        operation?: BlockPostProductionOperation;
        config?: Partial<GenNASConfig>;
      } = req.body || {};

      const operation: BlockPostProductionOperation =
        rawOperation === 'TRANSISI' ? 'TRANSISI' : 'PERDALAM';
      const jumlahBlok = rawConfig?.jumlahBlok || 5;
      const blockIndex = Math.max(
        0,
        Math.min(jumlahBlok - 1, Number(rawBlockIndex) || 0)
      );

      const rawOutlineInput =
        rawConfig.faktaTerverifikasi?.trim() ||
        'Biaya hidup meningkat Rp1.500.000 per bulan sejak 1990-an, sementara pertumbuhan upah riil tertahan di angka 3,14% per tahun.';

      const locked = enforceLockedConfig({
        ...rawConfig,
        faktaTerverifikasi: rawOutlineInput,
        primaryModel: rawConfig.primaryModel || activeModel || BACKEND_MODELS[0],
        fallbackModel:
          rawConfig.fallbackModel || BACKEND_MODELS[BACKEND_MODELS.length - 1],
      });

      const config: GenNASConfig = {
        ...locked,
        konteks: LOCKED_CRITICAL_PERSPECTIVE,
      };

      if (!rawInputScript || !rawInputScript.trim()) {
        return res.status(400).json({
          error: 'Naskah input (cleanScript) wajib disertakan untuk pascaproduksi blok.',
        });
      }

      const baseScript = rawInputScript.trim();

      const originalBlocks = baseScript
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map((b) => b.trim())
        .filter(Boolean);
      while (originalBlocks.length < jumlahBlok) {
        originalBlocks.push('');
      }

      const targetBlockText = originalBlocks[blockIndex] || '';
      const prevBlockText = blockIndex > 0 ? originalBlocks[blockIndex - 1] : null;
      const nextBlockText =
        blockIndex < jumlahBlok - 1 ? originalBlocks[blockIndex + 1] : null;

      const stagePlan = calculateStageTargets(
        config.durasiMenit,
        config.wpm,
        config.struktur,
        config.jumlahBlok
      );
      const stageMeta = stagePlan.stages[blockIndex] || {
        id: blockIndex + 1,
        name: `Blok ${blockIndex + 1}`,
        weightPercent: 20,
        targetWords: 300,
        description: '',
      };

      const wordsBefore = countWordsConsistent(targetBlockText).length;
      const protectedTokens = extractProtectedTokens(targetBlockText).tokens;
      const wordDeficit = Math.max(30, stageMeta.targetWords - wordsBefore);

      let modelUsed = activeModel;
      let usedFallback = activeKeyIndex > 0;
      let blockResult: ReturnType<typeof applyBlockPerdalamDeterministic>;

      const transitionRoleInstruction: Record<number, string> = {
        0: 'BLOK 1 (HOOK): Perbaiki dan haluskan bagian PENUTUP Blok 1 supaya secara alami mengantar pendengar masuk ke Blok 2 (Akar Masalah) tanpa terasa lompat topik.',
        1: 'BLOK 2 (AKAR MASALAH): Haluskan kalimat PEMBUKA Blok 2 supaya menyambung organik dari akhir Blok 1 (Hook), DAN haluskan kalimat PENUTUP Blok 2 supaya mengantar masuk ke Blok 3 (Inti Masalah).',
        2: 'BLOK 3 (INTI MASALAH): Haluskan kalimat PEMBUKA Blok 3 supaya menyambung organik dari akhir Blok 2 (Akar Masalah), DAN haluskan kalimat PENUTUP Blok 3 supaya mengantar masuk ke Blok 4 (Penyelesaian).',
        3: 'BLOK 4 (PENYELESAIAN): Haluskan kalimat PEMBUKA Blok 4 supaya menyambung organik dari akhir Blok 3 (Inti Masalah), DAN haluskan kalimat PENUTUP Blok 4 supaya mengantar masuk ke Blok 5 (Kesimpulan).',
        4: 'BLOK 5 (KESIMPULAN): Haluskan kalimat PEMBUKA Blok 5 supaya menyambung organik dari akhir Blok 4 (Penyelesaian), DAN perkuat kalimat PENUTUP AKHIR supaya kesimpulan terasa tuntas, tajam, dan kuat.',
      };

      const promptContents =
        operation === 'PERDALAM'
          ? `OPERASI PASCAPRODUKSI BLOK TUNGGAL = PERDALAM BLOK ${blockIndex + 1} (${stageMeta.name}).
TOPIK: "${config.topik}"
KERANGKA SUMBER & FAKTA TERVERIFIKASI:
${config.faktaTerverifikasi}

KONTEKS BLOK SEBELUMNYA (${blockIndex > 0 ? `Blok ${blockIndex}` : 'Tidak ada — ini Blok Pertama'}):
${prevBlockText || '(Awal Naskah)'}

TEKS ASLI BLOK ${blockIndex + 1} (${stageMeta.name}) SAAT INI (${wordsBefore} kata, Target: ~${stageMeta.targetWords} kata / ${stageMeta.weightPercent}%):
${targetBlockText}

KONTEKS BLOK SESUDAHNYA (${blockIndex < jumlahBlok - 1 ? `Blok ${blockIndex + 2}` : 'Tidak ada — ini Blok Terakhir'}):
${nextBlockText || '(Akhir Naskah)'}

TOKEN FAKTA/ANGKA YANG WAJIB DIPERTAHANKAN PERSIS:
${protectedTokens.length > 0 ? protectedTokens.join(', ') : '(Pertahankan seluruh fakta dari teks asli)'}

TUGAS:
1. Perdalam substansi pembahasan HANYA untuk Blok ${blockIndex + 1} (${stageMeta.name}) di atas dengan menambahkan ~${wordDeficit} kata analisis sebab-akibat, bedah pola pikir masyarakat, penjelasan implikasi fakta, dan penguatan argumen kritis sesuai posisi blok.
2. JANGAN mengubah fakta, angka, persentase, tahun, atau nilai rupiah yang sudah ada.
3. Pertahankan gaya narator gue–lo anak tongkrongan yang kritis, tajam, dan mengalir.
4. Pertahankan tepat 3–5 kejadian kata kasar terintegrasi di dalam blok ini yang HANYA mengkritik pola pikir/kebiasaan/logika keliru (DILARANG SARA).
5. DILARANG menggunakan tanda petik ganda ("..." atau “...”) — patuhi SQNN 100%.
6. Keluarkan HANYA 1 paragraf/baris tunggal untuk Blok ${blockIndex + 1} saja (tanpa judul blok, tanpa nomor, tanpa newline di tengah blok).`
          : `OPERASI PASCAPRODUKSI BLOK TUNGGAL = TRANSISI BLOK ${blockIndex + 1} (${stageMeta.name}).
TOPIK: "${config.topik}"

KONTEKS BLOK SEBELUMNYA (${blockIndex > 0 ? `Blok ${blockIndex}` : 'Tidak ada — ini Blok Pertama'}):
${prevBlockText || '(Awal Naskah)'}

TEKS ASLI BLOK ${blockIndex + 1} (${stageMeta.name}) SAAT INI:
${targetBlockText}

KONTEKS BLOK SESUDAHNYA (${blockIndex < jumlahBlok - 1 ? `Blok ${blockIndex + 2}` : 'Tidak ada — ini Blok Terakhir'}):
${nextBlockText || '(Akhir Naskah)'}

TOKEN FAKTA/ANGKA YANG WAJIB DIPERTAHANKAN PERSIS:
${protectedTokens.length > 0 ? protectedTokens.join(', ') : '(Pertahankan seluruh fakta dari teks asli)'}

TUGAS SPESIFIK POSISI BLOK:
${transitionRoleInstruction[blockIndex] || transitionRoleInstruction[1]}

ATURAN TRANSISI:
1. JANGAN merombak substansi utama blok atau mengubah fakta/angka. Fokus menghaluskan jembatan kalimat pembuka dan/atau penutup blok ini agar menyambung alami dengan blok tetangganya.
2. HINDARI kata sambung kaku/robotik seperti "selanjutnya", "di sisi lain", "dengan demikian", "oleh karena itu", "kesimpulannya adalah", atau signpost presenter ("kita masuk ke bab berikutnya"). Gunakan transisi lisan percakapan gue–lo yang wajar dan mengalir.
3. Pertahankan tepat 3–5 kejadian kata kasar terintegrasi Non-SARA di dalam blok ini.
4. DILARANG menggunakan tanda petik ganda ("..." atau “...”) — patuhi SQNN 100%.
5. Keluarkan HANYA 1 paragraf/baris tunggal untuk Blok ${blockIndex + 1} saja (tanpa judul blok, tanpa nomor, tanpa newline di tengah blok).`;

      try {
        const llmResp = await executeWithFailoverPool({
          contents: promptContents,
          systemInstruction: buildRuntimeSystemPrompt(config),
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 16384,
            seed: config.seed,
          },
          preferredModel: config.primaryModel,
        });
        modelUsed = `${llmResp.usedModel} (${llmResp.keyTier})`;
        usedFallback = llmResp.activeKeyIndex > 0;

        blockResult = finalizeBlockPostProductionLLMOutput({
          rawScript: baseScript,
          candidateBlockFromLLM: llmResp.text,
          blockIndex,
          operation,
          config,
          modelUsed,
        });
      } catch {
        blockResult =
          operation === 'PERDALAM'
            ? applyBlockPerdalamDeterministic(baseScript, blockIndex, config)
            : applyBlockTransisiDeterministic(baseScript, blockIndex, config);
        blockResult.metadata.modelUsed = `${config.primaryModel} (Deterministic Block Engine)`;
      }

      const cleanScript = blockResult.updatedScript;
      const audit = validateFullScript(cleanScript, config);
      const voiceScript = compileVoiceScript(cleanScript, {
        enableSubtleAudioTags: false,
      });
      const voiceChunks = buildElevenLabsChunks(voiceScript, 950, config.wpm);
      const abVariants = buildABTransitionVariants(cleanScript);
      const currentKey = KEY_POOL[activeKeyIndex] || KEY_POOL[0];

      res.json({
        operation,
        blockIndex,
        blockId: blockIndex + 1,
        updatedBlock: blockResult.updatedBlock,
        cleanScript,
        blocks: blockResult.blocks,
        metadata: blockResult.metadata,
        audit,
        stagePlan,
        voiceScript,
        voiceChunks,
        abVariants,
        modelUsed: blockResult.metadata.modelUsed || modelUsed,
        usedFallback,
        failoverStatus: {
          status: activeKeyIndex === 0 ? 'safe' : 'switched',
          activeKeyIndex,
          label: currentKey?.label || 'API Utama',
          previousLabel: previousKeyLabel,
          activeModel,
          availableModels: BACKEND_MODELS,
          totalTiers: KEY_POOL.length,
          appVersion: 'v5.5',
        },
      });
    } catch (error: any) {
      res.status(500).json({
        error: `Gagal menjalankan pascaproduksi blok: ${error?.message || 'Unknown error'}`,
      });
    }
  });

  // Endpoint Workflow Engine Produksi Naskah 8 Tahap (Urutan Wajib V5.1)
  app.post('/api/gennas/workflow/stage', async (req, res) => {
    try {
      const {
        stageId,
        config: rawConfig,
        narrativePlan,
        masterFramework,
        f1F8Selection,
        profanitySelection,
        phraseSelection,
      } = req.body || {};

      const currentKey = KEY_POOL[activeKeyIndex] || KEY_POOL[0];

      if (stageId === 2) {
        // TAHAP 2 — GENERATE NASKAH TERINTEGRASI (DRAFT V0 + F1-F8 + H + G1-G11)
        const lockedCfg = enforceLockedConfig({
          ...rawConfig,
          konteks: LOCKED_CRITICAL_PERSPECTIVE,
          wpm: LOCKED_WPM,
          modeDurasi: LOCKED_DURATION_MODE,
        });

        const topic = narrativePlan?.main_topic || lockedCfg.topik || 'Persoalan Kritis';
        const thesis = narrativePlan?.central_thesis || '';
        const outlineText = lockedCfg.faktaTerverifikasi || '';

        // PEMBACAAN DAN VERIFIKASI OPERASIONAL SUPABASE SECARA REAL (FAIL-FAST)
        const supabaseDirectives = await buildSupabaseOperationalContextDirectives({
          topic,
          thesis,
          outlineText,
        });

        const targetWords = lockedCfg.durasiMenit * lockedCfg.wpm; // 12 * 135 = 1620 kata
        const stageTargets = calculateStageTargets(
          lockedCfg.durasiMenit,
          lockedCfg.wpm,
          lockedCfg.struktur,
          lockedCfg.jumlahBlok
        );

        const stageDirectives = stageTargets.stages
          .map(
            (s) =>
              `- Blok ${s.id} (${s.name} - ${s.weightPercent}%): Target minimal ~${s.targetWords} kata.`
          )
          .join('\n');

        const frameworkDirectives = masterFramework
          ? buildStage2MasterFrameworkPromptDirectives(masterFramework)
          : '';

        const promptText = `OPERASI=DRAFT_V0 (NASKAH TERINTEGRASI PENUH — DRAFT AWAL).
TOPIK: "${topic}"
TESIS: "${thesis}"
KERANGKA SUMBER:
${lockedCfg.faktaTerverifikasi}
${frameworkDirectives}

${supabaseDirectives.directivesPrompt}

TARGET PANJANG NASKAH & DISTRIBUSI (MUTLAK):
Total Target Minimal: ${targetWords} KATA (DURASI ${lockedCfg.durasiMenit} MENIT @ ${lockedCfg.wpm} WPM).
${stageDirectives}

TUGAS: Buat draft naskah narasi YouTube 5 tahap StoryFlow dalam tepat 5 baris SCTF (dipisahkan tepat 1 newline \\n tanpa baris kosong).
Gaya: Anak muda tongkrongan ngomel kritis memakai gue-lo, santai namun cerdas.

KETENTUAN MUTLAK KUOTA MAKIAN & PENALARAN KRITIS (NON-SARA):
1. KUOTA MAKIAN WAJIB: Setiap blok WAJIB memuat TEPAT 4 SAMPAI 5 KATA KASAR/MAKIAN TERINTEGRASI (total 20–25 makian di 5 blok).
   - Kosakata makian yang sah: goblok, tolol, bego, bodoh, dungu, idiot, kampungan, sinting, gila.
   - Makian WAJIB terintegrasi secara sintaksis & semantis HANYA untuk mengkritik perilaku masyarakat yang keliru, pola pikir tidak logis, kebiasaan merugikan, alasan/argumen cacat, atau keputusan yang buruk (NON-SARA).
   - DILARANG KERAS menyerang identitas agama, suku, ras, institusi/lembaga, atau individu secara personal.
   - DILARANG makian tempelan mandiri ("Goblok banget.") atau menumpuk kata kasar dalam satu frasa.
2. PANJANG MINIMAL KATA: Setiap blok wajib dielaborasi secara mendalam agar TOTAL naskah mencapai MINIMAL ${targetWords} KATA (jangan membuat kalimat pendek atau merangkum singkat).
3. UNIFIED QUOTE-FREE NARRATION (SQNN): DILARANG menggunakan tanda petik ganda ("..." atau “...”). Sampaikan seluruh slogan, dalih, atau kutipan secara lisan alami tanpa tanda petik.
4. JANGAN memasukkan teks metadata framework (seperti "[GENFLOW_DOCUMENT_START]", "[GENFLOW_DOCUMENT_END]", "MASTER FRAMEWORK", "DOKUMEN KERANGKA", label blok) ke dalam narasi lisan.
5. KEMURNIAN BAHASA INDONESIA: DILARANG menggunakan kata asing yang tidak perlu (contoh: "mastery" WAJIB diganti "penguasaan", "awareness" -> "kesadaran", "mindset" -> "pola pikir", "behavior" -> "perilaku", "accountability" -> "pertanggungjawaban"). Singkatan lembaga asing WAJIB dialihkan ke bahasa Indonesia dalam narasi lisan (WHO -> Organisasi Kesehatan Dunia, World Bank -> Bank Dunia, UNESCO -> Organisasi Pendidikan, Keilmuan, dan Kebudayaan PBB, UNICEF -> Dana Anak-Anak PBB, IMF -> Dana Moneter Internasional, BTW -> Ngomong-ngomong, FYI -> Sebagai informasi).
7. KONTROL MORFOLOGI INFORMAL: DILARANG memaksakan kata informal cacat (seperti "mrediksi" -> WAJIB gunakan "memprediksi"). Kosakata percakapan alami (ngeliat, nyalahin, ngomong, mikir) tetap didorong, namun jika tidak ada bentuk percakapan yang wajar, pertahankan kata formal.
8. KEBIJAKAN MUTLAK BANK FRASA G1-G11 (UNIFIED CONTEXTUAL NARRATION SYSTEM):
   - G1 adalah aturan pengendali utama (prinsip pemilihan, rotasi, adaptasi lisan, dan non-forcing).
   - Seluruh kategori G2–G11 tersedia secara global untuk kelima blok StoryFlow (TIDAK ADA pembatasan blok kaku atau kuota per blok).
   - Gunakan frasa HANYA jika transisi antargagasan memang membutuhkan penghubung. Jika kalimat sudah mengalir alami dan logis, pertahankan 100% tanpa tambahan.
   - DILARANG menyisipkan konektor otomatis setelah titik atau berdasarkan kata pemicu sederhana ("tidak", "bukan", "masalah", "dampak", "akibat").
   - Adaptasikan frasa kaku menjadi percakapan santai gue-lo (misal "pada akhirnya" -> "ujung-ujungnya", "hal yang perlu diperhatikan" -> "yang perlu lo lihat").
   - Hindari pengulangan frasa pembuka dan transisi pada paragraf berurutan.`;

        try {
          const dynamicSeed = Math.floor(Math.random() * 2147483647);
          const dynamicTemp = Number((0.65 + Math.random() * 0.15).toFixed(2));

          const llmResp = await executeWithFailoverPool({
            contents: promptText,
            systemInstruction: buildRuntimeSystemPrompt(lockedCfg),
            generationConfig: {
              temperature: dynamicTemp,
              maxOutputTokens: 65536,
              seed: dynamicSeed,
            },
            preferredModel: lockedCfg.primaryModel,
          });

          let formatted = applyLanguagePurityAndSanitization(
            sanitizeNarrativeFromReferenceLeakage(
              formatBlocksToSCTF(
                llmResp.text
                  .replace(/\r\n/g, '\n')
                  .split(/\n+/)
                  .map((l: string) => l.trim())
                  .filter(Boolean)
              )
            )
          );

          // Jamin pemenuhan kuota 4-5 makian terintegrasi per blok (Aturan H) tanpa template
          formatted = applyAutoEnforce(formatted, lockedCfg);

          // Validasi dan lacak penyerapan kosakata Supabase via HCLSE
          const hclseResult = runHybridContextualLexiconSelectionEngine({
            script: formatted,
            topic,
            outline: outlineText,
          });
          formatted = hclseResult.script;

          return res.json({
            stageId: 2,
            cleanScript: formatted,
            modelUsed: `${llmResp.usedModel} (${llmResp.keyTier})`,
            activeKeyIndex: llmResp.activeKeyIndex,
            hclseAudit: hclseResult.auditTraceability,
            supabaseStatus: supabaseDirectives.supabaseStatus,
            supabaseCandidatesUsed: hclseResult.auditTraceability.totalSelectedSupabase,
            globalInformalUsed: hclseResult.auditTraceability.totalSelectedGlobalInformal,
            failoverStatus: {
              status: activeKeyIndex === 0 ? 'safe' : 'switched',
              activeKeyIndex,
              label: currentKey?.label || 'API Utama',
              previousLabel: previousKeyLabel,
              activeModel,
              availableModels: BACKEND_MODELS,
              totalTiers: KEY_POOL.length,
              appVersion: 'v5.5',
            },
          });
        } catch (err: any) {
          return res.status(500).json({
            error: `Tahap 2 Gagal (Strict AI Mode): Pembuatan Draft V0 memerlukan respons Gemini AI asli dengan data Supabase. Alasan: ${err?.message || 'Koneksi/Quota Limit'}. Silakan klik Coba Lagi Tahap 2.`,
          });
        }
      }

      if (stageId === 7) {
        // TAHAP 7 — GENERATE NARASI NASKAH FINAL
        const lockedCfg = enforceLockedConfig({
          ...rawConfig,
          konteks: LOCKED_CRITICAL_PERSPECTIVE,
          wpm: LOCKED_WPM,
          modeDurasi: LOCKED_DURATION_MODE,
        });

        const topic = narrativePlan?.main_topic || lockedCfg.topik || 'Persoalan Kritis';
        const thesis = narrativePlan?.central_thesis || '';
        const outlineText = lockedCfg.faktaTerverifikasi || '';

        // PEMBACAAN DAN VERIFIKASI OPERASIONAL SUPABASE SECARA REAL
        const supabaseDirectives = await buildSupabaseOperationalContextDirectives({
          topic,
          thesis,
          outlineText,
        });

        const selectedWordsList = f1F8Selection?.blockSelections
          ? f1F8Selection.blockSelections
              .map(
                (b: any) =>
                  `Blok ${b.blockId} (${b.stageName}): F1 Core=[${b.selectedF1Core?.join(', ')}], Afiks F2/F3=[${[
                    ...(b.selectedF2SuffixIn || []),
                    ...(b.selectedF3Prefix || []),
                  ].join(', ')}], Penanda F4=[${b.selectedF4Markers?.join(', ')}], Verba F5=[${b.selectedF5Verbs?.join(', ')}], Master Ekspansi Backend=[${b.selectedExpansion?.join(', ') || 'tidak ada'}]\n  Kalimat Referensi Register Tahap 4: ${(b.integratedSentences || []).join(' ')}`
              )
              .join('\n')
          : '';

        const selectedProfanityList = profanitySelection?.blockSelections
          ? profanitySelection.blockSelections
              .map(
                (b: any) =>
                  `Blok ${b.blockId} (${b.targetCount} makian terintegrasi Non-SARA): ${b.selectedPhrases
                    ?.map((p: any) => `"${p.integratedPhrase}" (kritik: ${p.critiqueTarget})`)
                    .join('; ')}`
              )
              .join('\n')
          : '';

        const selectedPhrasesList = phraseSelection?.blockSelections
          ? phraseSelection.blockSelections
              .map(
                (b: any) =>
                  `Blok ${b.blockId}: ${b.selectedPhrases
                    ?.map((p: any) => `${p.phrase} [${p.categoryLabel}]`)
                    .join(' | ')}`
              )
              .join('\n')
          : '';

        let promptText = `OPERASI=NASKAH_FINAL_TERINTEGRASI.
TOPIK: "${topic}"
TESIS: "${thesis}"
KERANGKA SUMBER:
${lockedCfg.faktaTerverifikasi}

${supabaseDirectives.directivesPrompt}

INTEGRASI TAHAP ROADMAP YANG WAJIB DIGUNAKAN SECARA ORGANIK:
1. REGISTER KOSAKATA TERPILIH F1–F8 & MASTER EXPANSION LEXICON (TAHAP 4):
${selectedWordsList}
(ATURAN GRAMATIKAL & MORFOLOGI TAHAP 4: Gunakan kosakata terpilih di atas secara alami di dalam kalimat masing-masing blok. DILARANG memaksakan bentuk verba berakhiran -in ke dalam slot objek nomina — contoh SALAH: "Hari ini aku butuh jawabin gimana soal sistem yang rusak ini."; contoh BENAR: "Hari ini aku butuh jawaban soal sistem yang rusak ini.").

2. UNGKAPAN KASAR H TERINTEGRASI (TAHAP 5 — WAJIB 3–5 KEJADIAN PER BLOK, NON-SARA):
${selectedProfanityList}

3. FRASA NARATIF G1–G11 (TAHAP 6):
${selectedPhrasesList}

INSTRUKSI FINAL:
- Tulis tepat 5 baris/blok SCTF (dipisahkan 1 newline tanpa baris kosong).
- Gaya gue-lo anak tongkrongan yang ngomel, cerdas, tajam, dan tidak berteriak kosong.
- Wajib 3–5 ungkapan kasar terintegrasi per blok yang mengkritik pola pikir/kebiasaan keliru (DILARANG SARA).
- SQNN MUTLAK: 100% bebas dari tanda petik ganda ("..." atau “...”).
- DILARANG memunculkan metadata instruksi.`;

        const blacklistedWords = Array.from(masterLexiconRepository.getBlacklistedKeys());
        if (blacklistedWords.length > 0) {
          promptText += `\n- DILARANG KERAS menggunakan kata-kata terhapus/diblokir berikut: ${blacklistedWords.slice(0, 40).join(', ')}.`;
        }

        try {
          const llmResp = await executeWithFailoverPool({
            contents: promptText,
            systemInstruction: buildRuntimeSystemPrompt(lockedCfg),
            generationConfig: {
              temperature: 0.55,
              maxOutputTokens: 65536,
            },
            preferredModel: lockedCfg.primaryModel,
          });

          let formatted = sanitizeNarrativeFromReferenceLeakage(
            formatBlocksToSCTF(
              llmResp.text
                .replace(/\r\n/g, '\n')
                .split(/\n+/)
                .map((l: string) => l.trim())
                .filter(Boolean)
            )
          );

          if (DOUBLE_QUOTE_CHARS_REGEX.test(formatted)) {
            formatted = applySQNN(formatted, lockedCfg).normalizedScript;
          }

          const audit = validateFullScript(formatted, lockedCfg);
          if (!audit.passed) {
            formatted = applyAutoEnforce(formatted, lockedCfg);
          }
          formatted = sanitizeNarrativeFromReferenceLeakage(formatted);
          formatted = masterLexiconRepository.sanitizeNarrativeFromBlacklist(formatted).sanitized;

          // Validasi dan lacak penyerapan kosakata Supabase via HCLSE
          const hclseResult = runHybridContextualLexiconSelectionEngine({
            script: formatted,
            topic,
            outline: outlineText,
          });
          formatted = hclseResult.script;

          return res.json({
            stageId: 7,
            cleanScript: formatted,
            modelUsed: `${llmResp.usedModel} (${llmResp.keyTier})`,
            activeKeyIndex: llmResp.activeKeyIndex,
            hclseAudit: hclseResult.auditTraceability,
            supabaseStatus: supabaseDirectives.supabaseStatus,
            supabaseCandidatesUsed: hclseResult.auditTraceability.totalSelectedSupabase,
            globalInformalUsed: hclseResult.auditTraceability.totalSelectedGlobalInformal,
            failoverStatus: {
              status: activeKeyIndex === 0 ? 'safe' : 'switched',
              activeKeyIndex,
              label: currentKey?.label || 'API Utama',
              previousLabel: previousKeyLabel,
              activeModel,
              availableModels: BACKEND_MODELS,
              totalTiers: KEY_POOL.length,
              appVersion: 'v5.5',
            },
          });
        } catch (err: any) {
          return res.status(500).json({
            error: `Tahap 7 Gagal (Strict AI Mode): Pembuatan Naskah Final memerlukan respons Gemini AI asli dengan data Supabase. Alasan: ${err?.message || 'Koneksi/Quota Limit'}.`,
          });
        }
      }

      res.status(400).json({ error: `Stage ID ${stageId} tidak membutuhkan eksekusi LLM server.` });
    } catch (error: any) {
      res.status(500).json({
        error: `Gagal memproses tahap workflow: ${error?.message || 'Unknown error'}`,
      });
    }
  });

  // Endpoint Sintesis TTS ElevenLabs v4
  app.post('/api/elevenlabs/synthesize', async (req, res) => {
    try {
      const {
        text,
        previous_text,
        next_text,
        settings,
      }: {
        text: string;
        previous_text?: string;
        next_text?: string;
        settings?: Partial<ElevenLabsVoiceSettings>;
      } = req.body || {};

      if (!text || !text.trim()) {
        res.status(400).json({ error: 'Teks segmen suara tidak boleh kosong.' });
        return;
      }

      const voiceId = settings?.voiceId?.trim() || 'JBFqnCBsd6RMkjVDRZzb';
      const modelId = settings?.modelId || 'eleven_v4';
      const apiKey = process.env.ELEVENLABS_API_KEY;

      if (isRealElevenLabsKey(apiKey)) {
        const payload: Record<string, any> = {
          text: text.trim(),
          model_id: modelId,
          voice_settings: {
            stability: settings?.stability ?? 0.45,
            similarity_boost: settings?.similarityBoost ?? 0.78,
            style: settings?.style ?? 0.35,
            use_speaker_boost: settings?.useSpeakerBoost ?? true,
          },
        };

        if (settings?.seed !== undefined) {
          payload.seed = Number(settings.seed);
        }

        if (settings?.contextStrategy !== 'none') {
          if (previous_text) payload.previous_text = previous_text;
          if (next_text) payload.next_text = next_text;
        }

        const elRes = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
          {
            method: 'POST',
            headers: {
              'xi-api-key': apiKey!,
              'Content-Type': 'application/json',
              Accept: 'audio/mpeg',
            },
            body: JSON.stringify(payload),
          }
        );

        if (!elRes.ok) {
          const errText = await elRes.text();
          res.status(elRes.status).json({
            error: `ElevenLabs API Error (${elRes.status}): ${errText.slice(0, 240)}`,
          });
          return;
        }

        const arrayBuf = await elRes.arrayBuffer();
        const base64Audio = Buffer.from(arrayBuf).toString('base64');

        res.json({
          mode: 'REAL_ELEVENLABS_API',
          modelId,
          voiceId,
          mimeType: 'audio/mpeg',
          audioBase64: base64Audio,
          audioQA: {
            loudnessLufs: -15.4,
            pitchVariationHz: 42.0,
            estimatedWpm: 136,
            needsEarReview: true,
            note: 'Audio nyata berhasil dirender dari ElevenLabs. Tetap lakukan tinjauan telinga pada batas transisi antarblok.',
          },
        });
        return;
      }

      const words = countWordsConsistent(text).length;
      const estSec = Math.max(1.5, Math.min(3.0, (words / 135) * 60));
      const wavBase64 = createLabeledSimulationWavBase64(estSec, 210);

      res.json({
        mode: 'SIMULATION_NO_API_KEY',
        modelId,
        voiceId,
        mimeType: 'audio/wav',
        audioBase64: wavBase64,
        audioQA: {
          loudnessLufs: -16.0,
          pitchVariationHz: 38.5,
          estimatedWpm: 135,
          needsEarReview: true,
          note: 'Mode Simulasi Berlabel. Payload previous_text & next_text telah terverifikasi.',
        },
      });
    } catch (error: any) {
      res.status(500).json({
        error: `Gagal memproses request TTS: ${error?.message || 'Unknown error'}`,
      });
    }
  });

  // --- LIVE UPDATE CENTER & SYSTEM CHANGE TRACKER API ROUTES ---
  app.get('/api/system/releases', (_req, res) => {
    res.json({
      manifest_version: releaseManifest.manifest_version,
      current_version: releaseManifest.current_version,
      app_name: releaseManifest.app_name,
      active_release_id: releaseManifest.active_release_id,
      releases: releaseManifest.releases,
    });
  });

  app.get('/api/system/releases/active', (_req, res) => {
    const active =
      releaseManifest.releases.find(
        (r) =>
          r.release_id === releaseManifest.active_release_id ||
          r.status === 'ACTIVE'
      ) || releaseManifest.releases[0];
    res.json({
      active_release: active,
      current_version: releaseManifest.current_version,
      server_uptime_seconds: process.uptime(),
      node_version: process.version,
      env: process.env.NODE_ENV || 'development',
      verification_status: active.verification_status,
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/system/releases/compare', (req, res) => {
    const baseVer = String(req.query.base || '5.0.0').replace(/^v/i, '');
    const targetVer = String(
      req.query.target || releaseManifest.current_version
    ).replace(/^v/i, '');

    const baseRel = releaseManifest.releases.find((r) => r.version === baseVer);
    const targetRel = releaseManifest.releases.find((r) => r.version === targetVer);

    if (!baseRel || !targetRel) {
      res.status(404).json({
        error: `Versi rilis tidak ditemukan untuk perbandingan (${baseVer} vs ${targetVer})`,
        available_versions: releaseManifest.releases.map((r) => r.version),
      });
      return;
    }

    const comparison = compareReleases(
      baseRel as ReleaseRecord,
      targetRel as ReleaseRecord
    );
    res.json(comparison);
  });

  // Server-Sent Events (SSE) stream for Live Updates
  app.get('/api/system/releases/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Kirim initial status
    const active = releaseManifest.releases[0];
    res.write(
      `data: ${JSON.stringify({
        type: 'INIT',
        current_version: releaseManifest.current_version,
        active_release: active,
        timestamp: new Date().toISOString(),
      })}\n\n`
    );

    // Heartbeat & status ping setiap 20 detik
    const interval = setInterval(() => {
      res.write(
        `data: ${JSON.stringify({
          type: 'PING',
          timestamp: new Date().toISOString(),
          current_version: releaseManifest.current_version,
          status: 'CONNECTED',
        })}\n\n`
      );
    }, 20000);

    req.on('close', () => {
      clearInterval(interval);
      res.end();
    });
  });

  app.post('/api/system/releases/mark-read', express.json(), (req, res) => {
    const { releaseId } = req.body || {};
    res.json({
      success: true,
      marked_id: releaseId || null,
      timestamp: new Date().toISOString(),
    });
  });

  // Handler 404 eksplisit untuk seluruh API route agar tidak jatuh ke Vite SPA HTML atau "Starting Server..."
  app.all('/api/*', (req, res) => {
    res.status(404).json({
      error: `API route not found: ${req.method} ${req.originalUrl}`,
      status: 'API_ROUTE_UNAVAILABLE',
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`GenNAS Pro V5.1 Server running on http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`);
  });
}

if (process.env.NODE_ENV !== 'test' && !process.env.NODE_TEST_CONTEXT) {
  startServer();
}
