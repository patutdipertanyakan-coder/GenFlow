/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * GENFLOW UNIVERSAL FRAMEWORK PROCESSING POLICY
 * Policy ID: GENFLOW_UNIVERSAL_FRAMEWORK_POLICY
 * Schema ID: GF-NARRATIVE-FRAMEWORK-1.0
 * Version: 1.0.0
 *
 * Single Source of Truth untuk backend pemrosesan, pembacaan, validasi, dan standardisasi
 * dokumen kerangka naskah di GENFLOW Studio PRO.
 */

import basePolicyData from '../data/genflowUniversalFrameworkPolicy.json';
import {
  GenflowMasterFrameworkData,
  MasterFrameworkComponent,
  MasterFrameworkGroupCode,
  MasterFrameworkComponentStatus,
  FrameworkReadinessStatus,
  CANONICAL_COMPONENTS_SPEC,
  createEmptyMasterFramework,
  extractGenflowMasterFramework,
} from './genflowMasterFramework';

let nodeCrypto: any = null;
let nodeFs: any = null;
let nodePath: any = null;

if (typeof window === 'undefined') {
  try {
    const getModule = new Function(
      'name',
      'return typeof require !== "undefined" ? require(name) : null;'
    );
    nodeCrypto = getModule('node:crypto') || getModule('crypto');
    nodeFs = getModule('node:fs') || getModule('fs');
    nodePath = getModule('node:path') || getModule('path');
  } catch {
    // Ignore in browser
  }
}

export type DocumentClassificationType =
  | 'NARRATIVE_FRAMEWORK_STANDARD'
  | 'NARRATIVE_FRAMEWORK_LEGACY'
  | 'NARRATIVE_FRAMEWORK_FREEFORM'
  | 'SOURCE_DOCUMENT_ONLY';

export interface PolicyMetadata {
  policy_id: string;
  policy_name: string;
  schema_id: string;
  version: string;
  active_status: boolean;
  created_at: number;
  updated_at: number;
  source_filenames: string[];
  content_hash: string;
  rules: string[];
  change_history: Array<{
    version: string;
    timestamp: number;
    summary: string;
  }>;
}

export interface FrameworkValidationIssue {
  type: 'ERROR' | 'WARNING' | 'CONFLICT' | 'MISSING_SOURCE' | 'BROKEN_REFERENCE';
  componentId?: number;
  marker?: string;
  field?: string;
  message: string;
  suggestion?: string;
}

export interface FrameworkPolicyProcessResult {
  policyMetadata: PolicyMetadata;
  classification: {
    documentType: DocumentClassificationType;
    confidence: number;
    detectedMarkers: string[];
    isFramework: boolean;
    reason: string;
  };
  framework?: GenflowMasterFrameworkData;
  validationReport: {
    passed: boolean;
    readinessStatus: FrameworkReadinessStatus;
    readinessReason: string;
    issues: FrameworkValidationIssue[];
    totalDetectedComponents: number;
    crossReferenceCheck: {
      totalSources: number;
      totalEvidences: number;
      validReferences: number;
      brokenReferences: string[];
    };
    scopeBoundaryCheck: {
      mustCoverCount: number;
      mayMentionCount: number;
      outOfScopeCount: number;
      hasConflict: boolean;
    };
    storyFlowCheck: {
      hookValid: boolean;
      akarMasalahValid: boolean;
      intiMasalahValid: boolean;
      penyelesaianValid: boolean;
      kesimpulanValid: boolean;
    };
  };
}

/**
 * Singleton Policy State in-memory backed by persistent JSON file
 */
let activePolicyState: PolicyMetadata = (() => {
  const data = basePolicyData as any;
  return {
    policy_id: data.policy_id || 'GENFLOW_UNIVERSAL_FRAMEWORK_POLICY',
    policy_name: data.policy_name || 'GENFLOW UNIVERSAL FRAMEWORK PROCESSING POLICY',
    schema_id: data.schema_id || 'GF-NARRATIVE-FRAMEWORK-1.0',
    version: data.version || '1.0.0',
    active_status: Boolean(data.active_status ?? true),
    created_at: data.created_at || Date.now(),
    updated_at: data.updated_at || Date.now(),
    source_filenames: data.source_filenames || [
      'GENFLOW_FORMAT_KERANGKA_NASKAH_BAKU.txt',
      'INSTRUKSI_OUTPUT_KERANGKA_GENFLOW.txt',
    ],
    content_hash: data.content_hash || '',
    rules: Array.isArray(data.rules) ? data.rules : [],
    change_history: Array.isArray(data.change_history) ? data.change_history : [],
  };
})();

/**
 * Hitung SHA-256 hash untuk memastikan integritas policy
 */
export function calculatePolicyHash(policy: Partial<PolicyMetadata>): string {
  const content = JSON.stringify({
    id: policy.policy_id,
    schema: policy.schema_id,
    version: policy.version,
    rules: policy.rules,
  });
  if (nodeCrypto) {
    return nodeCrypto.createHash('sha256').update(content).digest('hex');
  }
  // Simple fallback hash for browser
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return 'poly-' + Math.abs(hash).toString(16);
}

// Inisialisasi hash saat startup
if (!activePolicyState.content_hash) {
  activePolicyState.content_hash = calculatePolicyHash(activePolicyState);
}

/**
 * Ambil policy aktif (Single Source of Truth)
 */
export function getActiveUniversalFrameworkPolicy(): PolicyMetadata {
  return { ...activePolicyState };
}

/**
 * Klasifikasi Dokumen: Membedakan kerangka standar, kerangka lama/bebas, atau dokumen sumber biasa.
 */
export function classifyDocumentType(
  rawText: string,
  fileName: string = ''
): {
  documentType: DocumentClassificationType;
  confidence: number;
  detectedMarkers: string[];
  isFramework: boolean;
  reason: string;
} {
  const text = (rawText || '').trim();
  const lowerName = fileName.toLowerCase();
  const detectedMarkers: string[] = [];

  // 1. Cek marker baku GF-01 s/d GF-23 dan SCHEMA_ID
  const hasSchemaId = /SCHEMA_ID:\s*GF-NARRATIVE-FRAMEWORK-1\.0/i.test(text);
  const hasDocStart = /\[GENFLOW_DOCUMENT_START\]/i.test(text);
  const gfMarkerMatches = text.match(/\[GF-(?:0[1-9]|1[0-9]|2[0-3])\]/g) || [];
  const uniqueGfMarkers = Array.from(new Set(gfMarkerMatches));

  if (hasSchemaId) detectedMarkers.push('SCHEMA_ID:GF-NARRATIVE-FRAMEWORK-1.0');
  if (hasDocStart) detectedMarkers.push('[GENFLOW_DOCUMENT_START]');
  uniqueGfMarkers.forEach((m) => detectedMarkers.push(m));

  if (hasSchemaId || uniqueGfMarkers.length >= 6 || (hasDocStart && uniqueGfMarkers.length >= 3)) {
    return {
      documentType: 'NARRATIVE_FRAMEWORK_STANDARD',
      confidence: hasSchemaId ? 0.99 : 0.92,
      detectedMarkers,
      isFramework: true,
      reason: `Dokumen kerangka naskah baku terdeteksi (${uniqueGfMarkers.length} marker GF teridentifikasi).`,
    };
  }

  // 2. Cek kerangka format lama / legacy (A-G terstruktur, Central Focus, Thesis, dsb.)
  const legacyStructuralSignatures = [
    { name: 'KELOMPOK_A_G', regex: /KELOMPOK\s+[A-G]|KUNCI\s+FOKUS\s+BESAR|PENGUNCI\s+SUBSTANSI/i },
    { name: 'SCOPE_BOUNDARY', regex: /BATAS\s+PEMBAHASAN|MUST_COVER|OUT_OF_SCOPE|WAJIB\s+DIBAHAS/i },
    { name: 'CENTRAL_THESIS', regex: /CENTRAL_THESIS|TESIS\s+UTAMA|KUNCI\s+TESIS/i },
    { name: 'CORE_QUESTION', regex: /CORE_QUESTION|PERTANYAAN\s+INTI/i },
    { name: 'LOGIC_PUNCH', regex: /LOGIC_PUNCH|KUNCI\s+LOGIC\s+PUNCH/i },
    { name: 'NARRATIVE_BLUEPRINT', regex: /NARRATIVE\s+BLUEPRINT|ALUR\s+PEMBAHASAN|STORYFLOW/i },
  ];

  const matchedLegacy = legacyStructuralSignatures.filter((sig) => sig.regex.test(text));
  matchedLegacy.forEach((sig) => detectedMarkers.push(sig.name));

  if (matchedLegacy.length >= 3) {
    return {
      documentType: 'NARRATIVE_FRAMEWORK_LEGACY',
      confidence: 0.85,
      detectedMarkers,
      isFramework: true,
      reason: `Dokumen kerangka naskah format lama terdeteksi (${matchedLegacy.length} struktur kerangka cocok).`,
    };
  }

  // 3. Cek kerangka bebas / freeform outline
  const isOutlineNamed =
    lowerName.includes('kerangka') ||
    lowerName.includes('outline') ||
    lowerName.includes('framework') ||
    lowerName.includes('draft-plan');

  const freeformSignatures = [
    /fokus\s+utama/i,
    /topik\s+utama/i,
    /tesis/i,
    /pertanyaan\s+inti/i,
    /akar\s+masalah/i,
    /inti\s+masalah/i,
    /logic\s+punch/i,
    /alur\s+cerita/i,
  ];

  const matchedFreeform = freeformSignatures.filter((regex) => regex.test(text));
  if (isOutlineNamed || matchedFreeform.length >= 3) {
    return {
      documentType: 'NARRATIVE_FRAMEWORK_FREEFORM',
      confidence: isOutlineNamed ? 0.75 : 0.65,
      detectedMarkers: matchedFreeform.map((_, i) => `FREEFORM_MATCH_${i + 1}`),
      isFramework: true,
      reason: 'Dokumen kerangka naskah format bebas terdeteksi.',
    };
  }

  // 4. Default: Dokumen sumber biasa (Bahan riset, artikel, transkrip)
  return {
    documentType: 'SOURCE_DOCUMENT_ONLY',
    confidence: 0.9,
    detectedMarkers: [],
    isFramework: false,
    reason: 'Dokumen merupakan bahan sumber/artikel biasa, bukan kerangka naskah.',
  };
}

/**
 * Ekstraksi nilai field terstruktur dari blok teks
 */
function extractFieldValue(text: string, fieldName: string): string {
  const pattern = new RegExp(
    `(?:^|\\n)\\s*${fieldName}\\s*:\\s*([\\s\\S]*?)(?=(?:\\n\\s*[A-Z0-9_]{3,35}\\s*:|\\[END_|\\[GF-|$))`,
    'i'
  );
  const match = text.match(pattern);
  if (!match) return '';
  return match[1].trim();
}

/**
 * Ekstraksi multi field (mis. MUST_COVER_01, MUST_COVER_02)
 */
function extractNumberedFieldList(text: string, prefix: string): string[] {
  const results: string[] = [];
  const pattern = new RegExp(
    `(?:^|\\n)\\s*${prefix}(?:_\\d+)?\\s*:\\s*([\\s\\S]*?)(?=(?:\\n\\s*[A-Z0-9_]{3,35}\\s*:|\\[END_|\\[GF-|$))`,
    'gi'
  );
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const val = match[1].trim();
    if (val && !val.startsWith('[') && !val.includes('BELUM TERSEDIA')) {
      results.push(val);
    }
  }
  return results;
}

/**
 * Helper untuk membersihkan ID dari komentar placeholder
 */
function cleanIdentifierToken(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/\[.*?\]/g, '')
    .replace(/—.*$/, '')
    .replace(/:\s*.*$/, '')
    .trim()
    .toUpperCase();
}

/**
 * Filter teks instruksi template dan placeholder prompt bracket
 */
function sanitizeComponentContentText(raw: string): string {
  if (!raw) return '';
  const lines = raw.split(/\r?\n/);
  const filtered = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return true;
    if (/^(?:CATATAN FORMAT|FORMAT_NOTE|ADDITIONAL_[A-Z_]+)\s*:/i.test(trimmed)) {
      return false;
    }
    if (/^\[(?:Jelaskan|Judul|Penulis|Tanggal|URL|Informasi|Batas|VERIFIED|Satu|Mengapa|Hal|Poin|Pertanyaan|Unsur|Masalah|Konteks|Faktor|Mekanisme|Pihak|Dampak|Pertentangan|Bukti|Klaim|Argumen|Puncak|Temuan|Hubungan|Cara|Temuan|Daftar|Bagian|Urutan|Kecukupan|Pemeriksaan|Catatan|Ulangi|Tambahkan|Isi|Perspektif|Rencana|Daftar|Apakah|Perbaikan|Vonis|Alasan|Hal|YES|Catatan).*?\]$/i.test(trimmed)) {
      return false;
    }
    return true;
  });
  const res = filtered.join('\n').trim();
  if (/^\[[^\]]+\]$/.test(res)) return '';
  return res;
}

/**
 * Validasi silang SOURCE_ID vs EVIDENCE_ID
 */
function validateCrossReferences(
  sources: Array<{ id: string; title: string }>,
  evidences: Array<{ evidenceId: string; claimId: string; sourceId: string; evidence: string }>
): {
  validReferences: number;
  brokenReferences: string[];
  issues: FrameworkValidationIssue[];
} {
  const sourceIds = new Set<string>();
  const duplicateSourceIds = new Set<string>();
  const brokenReferences: string[] = [];
  const issues: FrameworkValidationIssue[] = [];
  let validReferences = 0;

  sources.forEach((s) => {
    const cleanSid = cleanIdentifierToken(s.id);
    if (cleanSid) {
      if (sourceIds.has(cleanSid)) {
        duplicateSourceIds.add(cleanSid);
      } else {
        sourceIds.add(cleanSid);
      }
    }
  });

  if (duplicateSourceIds.size > 0) {
    duplicateSourceIds.forEach((dsid) => {
      issues.push({
        type: 'CONFLICT',
        componentId: 2,
        marker: 'GF-02',
        field: 'SOURCE_ID',
        message: `SOURCE_ID "${dsid}" terdeteksi duplikat pada GF-02. Setiap sumber wajib memiliki ID unik.`,
        suggestion: `Gunakan ID sumber unik seperti S01, S02, S03 secara berurutan.`,
      });
    });
  }

  const evidenceIds = new Set<string>();
  const duplicateEvidenceIds = new Set<string>();

  for (const ev of evidences) {
    const cleanEid = cleanIdentifierToken(ev.evidenceId || ev.claimId);
    if (cleanEid) {
      if (evidenceIds.has(cleanEid)) {
        duplicateEvidenceIds.add(cleanEid);
      } else {
        evidenceIds.add(cleanEid);
      }
    }

    const rawSid = cleanIdentifierToken(ev.sourceId);
    if (!rawSid || rawSid === 'BELUM TERSEDIA' || rawSid === 'NEEDS_VERIFICATION' || rawSid.startsWith('[')) {
      issues.push({
        type: 'WARNING',
        componentId: 10,
        marker: 'GF-10',
        field: 'SOURCE_ID',
        message: `Bukti ${ev.evidenceId || ev.claimId || 'fakta'} belum menautkan SOURCE_ID (status: NEEDS_VERIFICATION).`,
      });
      continue;
    }

    const normalized = rawSid.replace(/[^A-Z0-9]/g, '');
    const isDirectMatch = sourceIds.has(rawSid) || sourceIds.has(normalized);

    const hasLooseMatch = Array.from(sourceIds).some(
      (sid) =>
        sid === rawSid ||
        sid.includes(normalized) ||
        normalized.includes(sid.replace(/[^A-Z0-9]/g, '')) ||
        sid.endsWith(normalized)
    );

    if (isDirectMatch || hasLooseMatch) {
      validReferences++;
    } else {
      const msg = `Bukti [${ev.evidenceId || ev.claimId}] merujuk ke SOURCE_ID "${ev.sourceId}", tetapi sumber tersebut tidak ditemukan pada GF-02.`;
      brokenReferences.push(msg);
      issues.push({
        type: 'BROKEN_REFERENCE',
        componentId: 10,
        marker: 'GF-10',
        field: 'SOURCE_ID',
        message: msg,
        suggestion: `Pastikan ID sumber terdaftar pada komponen 2 (GF-02).`,
      });
    }
  }

  if (duplicateEvidenceIds.size > 0) {
    duplicateEvidenceIds.forEach((deid) => {
      issues.push({
        type: 'CONFLICT',
        componentId: 10,
        marker: 'GF-10',
        field: 'EVIDENCE_ID',
        message: `EVIDENCE_ID "${deid}" terdeteksi duplikat pada GF-10. Setiap bukti wajib memiliki ID unik.`,
        suggestion: `Gunakan ID bukti unik seperti EVIDENCE-01, EVIDENCE-02 secara berurutan.`,
      });
    });
  }

  return { validReferences, brokenReferences, issues };
}

/**
 * Engine Pemrosesan Kerangka Universal Backend
 * Menerapkan seluruh kebijakan dari GENFLOW UNIVERSAL FRAMEWORK PROCESSING POLICY secara otomatis
 */
export function processUniversalFrameworkDocument(
  rawText: string,
  fileName: string = 'kerangka.txt'
): FrameworkPolicyProcessResult {
  const policy = getActiveUniversalFrameworkPolicy();

  // 0. Cek dokumen kosong murni
  if (!rawText || rawText.trim().length === 0) {
    const emptyFw = createEmptyMasterFramework();
    return {
      policyMetadata: policy,
      classification: {
        documentType: 'SOURCE_DOCUMENT_ONLY',
        confidence: 0,
        detectedMarkers: [],
        isFramework: false,
        reason: 'Belum ada dokumen yang diunggah.',
      },
      framework: emptyFw,
      validationReport: {
        passed: false,
        readinessStatus: 'BELUM ADA DOKUMEN',
        readinessReason: 'Belum ada dokumen kerangka naskah yang diunggah.',
        issues: [],
        totalDetectedComponents: 0,
        crossReferenceCheck: {
          totalSources: 0,
          totalEvidences: 0,
          validReferences: 0,
          brokenReferences: [],
        },
        scopeBoundaryCheck: {
          mustCoverCount: 0,
          mayMentionCount: 0,
          outOfScopeCount: 0,
          hasConflict: false,
        },
        storyFlowCheck: {
          hookValid: false,
          akarMasalahValid: false,
          intiMasalahValid: false,
          penyelesaianValid: false,
          kesimpulanValid: false,
        },
      },
    };
  }

  const classification = classifyDocumentType(rawText, fileName);
  const issues: FrameworkValidationIssue[] = [];

  // Jika dokumen adalah sumber biasa, jangan paksakan 23 komponen
  if (!classification.isFramework) {
    return {
      policyMetadata: policy,
      classification,
      validationReport: {
        passed: true,
        readinessStatus: 'SIAP DIKEMBANGKAN',
        readinessReason: 'Dokumen diidentifikasi sebagai bahan sumber riset biasa.',
        issues: [],
        totalDetectedComponents: 0,
        crossReferenceCheck: {
          totalSources: 0,
          totalEvidences: 0,
          validReferences: 0,
          brokenReferences: [],
        },
        scopeBoundaryCheck: {
          mustCoverCount: 0,
          mayMentionCount: 0,
          outOfScopeCount: 0,
          hasConflict: false,
        },
        storyFlowCheck: {
          hookValid: false,
          akarMasalahValid: false,
          intiMasalahValid: false,
          penyelesaianValid: false,
          kesimpulanValid: false,
        },
      },
    };
  }

  const text = rawText || '';

  // Jika dokumen adalah kerangka lama (LEGACY) atau bebas (FREEFORM), petakan via parser kanonis
  if (
    classification.documentType === 'NARRATIVE_FRAMEWORK_LEGACY' ||
    classification.documentType === 'NARRATIVE_FRAMEWORK_FREEFORM'
  ) {
    const legacyFw = extractGenflowMasterFramework(text, fileName);
    const detectedCount = Object.values(legacyFw.componentsById).filter(
      (c) => c.status === 'DITEMUKAN' && (c.content || '').trim().length > 0
    ).length;

    return {
      policyMetadata: policy,
      classification,
      framework: legacyFw,
      validationReport: {
        passed: detectedCount > 0,
        readinessStatus: legacyFw.executiveSummary.statusKesiapan,
        readinessReason: legacyFw.executiveSummary.readinessReason,
        issues: legacyFw.documentIdentity.warnings.map((w) => ({
          type: 'WARNING',
          field: 'DOCUMENT',
          message: w,
        })),
        totalDetectedComponents: detectedCount,
        crossReferenceCheck: {
          totalSources: legacyFw.componentsById[2]?.content ? 1 : 0,
          totalEvidences: legacyFw.componentsById[10]?.content ? 1 : 0,
          validReferences: legacyFw.componentsById[2]?.content ? 1 : 0,
          brokenReferences: [],
        },
        scopeBoundaryCheck: {
          mustCoverCount: legacyFw.executiveSummary.batasPembahasan.wajibDibahas.length,
          mayMentionCount: legacyFw.executiveSummary.batasPembahasan.bolehDisinggung.length,
          outOfScopeCount: legacyFw.executiveSummary.batasPembahasan.tidakBolehDimasukkan.length,
          hasConflict: false,
        },
        storyFlowCheck: {
          hookValid: Boolean(legacyFw.componentsById[17]?.content),
          akarMasalahValid: Boolean(legacyFw.componentsById[6]?.content),
          intiMasalahValid: Boolean(legacyFw.componentsById[10]?.content),
          penyelesaianValid: Boolean(legacyFw.componentsById[14]?.content),
          kesimpulanValid: Boolean(legacyFw.componentsById[18]?.content),
        },
      },
    };
  }

  // 1. Ekstraksi Komponen Baku GF-01 s/d GF-23 (Standard)
  const componentsById: Record<number, MasterFrameworkComponent> = {};
  const sourcesExtracted: Array<{ id: string; title: string }> = [];
  const evidencesExtracted: Array<{ evidenceId: string; claimId: string; sourceId: string; evidence: string }> = [];

  // Topik Title dari Metadata atau GF-01 atau format legacy
  let topicTitle = extractFieldValue(text, 'TOPIC_TITLE');
  if (!topicTitle || topicTitle.startsWith('[')) {
    topicTitle = extractFieldValue(text, 'TOPIC_STATEMENT');
  }
  if (!topicTitle || topicTitle.startsWith('[')) {
    const legacyTopicMatch = text.match(/(?:1\.\s*TOPIK\s*UTAMA|TOPIK\s*UTAMA|TOPIK)\s*:\s*([^\n\r]+)/i);
    if (legacyTopicMatch) {
      topicTitle = legacyTopicMatch[1].trim();
    }
  }
  if (!topicTitle || topicTitle.startsWith('[')) {
    topicTitle = fileName.replace(/\.[^/.]+$/, '');
  }
  // Anti-slop: buang label template dari TOPIC_TITLE jika terbawa
  topicTitle = topicTitle
    .replace(/^GENFLOW_FORMAT_KERANGKA_NASKAH_BAKU.*?:/i, '')
    .replace(/^KERANGKA\s+NASKAH\s*[:-]?/i, '')
    .trim();

  // Ekstraksi 23 Komponen Kanonis
  CANONICAL_COMPONENTS_SPEC.forEach((spec) => {
    const marker = `GF-${spec.id < 10 ? '0' + spec.id : spec.id}`;
    const markerRegex = new RegExp(`\\[${marker}\\]([\\s\\S]*?)(?=\\[GF-(?:0[1-9]|1[0-9]|2[0-3])\\]|\\[GENFLOW_PROCESSING_RULES|\\[GENFLOW_DOCUMENT_END|$|G\\.\\s+ATURAN)`, 'i');
    const sectionMatch = text.match(markerRegex);
    const rawContent = sectionMatch ? sectionMatch[1].trim() : '';
    const sanitizedContent = sanitizeComponentContentText(rawContent);

    let status: MasterFrameworkComponentStatus = 'TIDAK_DITEMUKAN';
    let summary = '';
    let content = '';

    if (sanitizedContent && sanitizedContent.length > 5) {
      status = 'DITEMUKAN';
      summary = sanitizedContent.split('\n').filter((l) => l.trim() && !l.startsWith('['))[0] || spec.subtitle;
      content = sanitizedContent;
    } else {
      content = '';
      status = 'TIDAK_DITEMUKAN';
      summary = 'Tidak ditemukan dalam dokumen';
    }

    // Komponen khusus: GF-02 (Sumber)
    if (spec.id === 2 && rawContent) {
      const sourceBlocks = rawContent.split(/\[GF-02-SOURCE-\d+\]/i).slice(1);
      sourceBlocks.forEach((blk, idx) => {
        let sid = extractFieldValue(blk, 'SOURCE_ID');
        if (!sid || sid.startsWith('[')) {
          sid = `S0${idx + 1}`;
        }
        sid = cleanIdentifierToken(sid);
        const title = extractFieldValue(blk, 'SOURCE_TITLE') || `Sumber ${idx + 1}`;
        sourcesExtracted.push({ id: sid, title });
      });
      if (sourcesExtracted.length === 0) {
        // Fallback pencarian URL/DOI di teks
        const urls = rawContent.match(/https?:\/\/[^\s]+/g) || [];
        urls.forEach((u, i) => sourcesExtracted.push({ id: `S0${i + 1}`, title: u }));
      }
    }

    // Komponen khusus: GF-10 (Bukti / Evidence)
    if (spec.id === 10 && rawContent) {
      const evidenceBlocks = rawContent.split(/\[GF-10-EVIDENCE-\d+\]/i).slice(1);
      evidenceBlocks.forEach((blk, idx) => {
        let evidenceId = extractFieldValue(blk, 'EVIDENCE_ID');
        let claimId = extractFieldValue(blk, 'CLAIM_ID') || `C-0${idx + 1}`;
        if (!evidenceId || evidenceId.startsWith('[')) {
          evidenceId = `EVIDENCE-0${idx + 1}`;
        }
        evidenceId = cleanIdentifierToken(evidenceId);
        claimId = cleanIdentifierToken(claimId);

        let sourceId = extractFieldValue(blk, 'SOURCE_ID') || '';
        sourceId = cleanIdentifierToken(sourceId);

        const evidence = extractFieldValue(blk, 'EVIDENCE_OR_DATA') || '';
        evidencesExtracted.push({ evidenceId, claimId, sourceId, evidence });
      });
    }

    componentsById[spec.id] = {
      id: spec.id,
      groupCode: spec.groupCode,
      groupTitle: spec.groupTitle,
      canonicalTitle: spec.canonicalTitle,
      subtitle: spec.subtitle,
      status,
      summary,
      content,
      sourceOrigin: {
        documentName: fileName,
        sectionTitle: `[${marker}] ${spec.canonicalTitle}`,
        isExplicit: status === 'DITEMUKAN',
      },
    };
  });

  // Scope Boundary Check
  const gf04Text = componentsById[4]?.content || '';
  const mustCover = extractNumberedFieldList(gf04Text, 'MUST_COVER');
  const mayMention = extractNumberedFieldList(gf04Text, 'MAY_MENTION');
  const outOfScope = extractNumberedFieldList(gf04Text, 'OUT_OF_SCOPE');

  // Cek konflik Batas Pembahasan (poin wajib vs dilarang)
  let boundaryConflict = false;
  mustCover.forEach((mc) => {
    const normalizedMc = mc.toLowerCase().trim();
    outOfScope.forEach((oos) => {
      if (oos.toLowerCase().trim().includes(normalizedMc) || normalizedMc.includes(oos.toLowerCase().trim())) {
        boundaryConflict = true;
        issues.push({
          type: 'CONFLICT',
          componentId: 4,
          marker: 'GF-04',
          field: 'SCOPE_BOUNDARY',
          message: `Konflik Batas Pembahasan: Poin "${mc}" ada di MUST_COVER dan OUT_OF_SCOPE.`,
          suggestion: 'Pilih salah satu: jadikan wajib dibahas atau masukkan ke luar fokus.',
        });
      }
    });
  });

  if (boundaryConflict && componentsById[4]) {
    componentsById[4].status = 'BERTENTANGAN';
  }

  // Cross Reference Check (GF-02 vs GF-10)
  const crossRef = validateCrossReferences(sourcesExtracted, evidencesExtracted);
  issues.push(...crossRef.issues);

  // StoryFlow Blueprint Check (GF-15)
  const gf15Text = componentsById[15]?.content || '';
  const storyFlowCheck = {
    hookValid: /HOOK|STORYFLOW-01/i.test(gf15Text),
    akarMasalahValid: /AKAR_MASALAH|STORYFLOW-02/i.test(gf15Text),
    intiMasalahValid: /INTI_MASALAH|STORYFLOW-03/i.test(gf15Text),
    penyelesaianValid: /PENYELESAIAN|STORYFLOW-04/i.test(gf15Text),
    kesimpulanValid: /KESIMPULAN|STORYFLOW-05/i.test(gf15Text),
  };

  const missingStoryFlowBlocks = Object.entries(storyFlowCheck)
    .filter(([_, valid]) => !valid)
    .map(([key]) => key);

  if (missingStoryFlowBlocks.length > 0) {
    issues.push({
      type: 'WARNING',
      componentId: 15,
      marker: 'GF-15',
      field: 'STORYFLOW',
      message: `Blok StoryFlow belum lengkap: ${missingStoryFlowBlocks.join(', ')}.`,
      suggestion: 'Pastikan 5 blok StoryFlow (Hook, Akar, Inti, Solusi, Kesimpulan) terdefinisi.',
    });
  }

  // Hitung Kesiapan Kerangka
  let readinessStatus: FrameworkReadinessStatus = 'SIAP DIKEMBANGKAN';
  let readinessReason = 'Seluruh 23 komponen kanonis dan batas pembahasan valid.';

  if (boundaryConflict) {
    readinessStatus = 'PERLU MENYELESAIKAN KONTRADIKSI';
    readinessReason = 'Terdapat pertentangan antara poin wajib dan materi di luar fokus (Scope Boundary).';
  } else if (crossRef.brokenReferences.length > 0) {
    readinessStatus = 'PERLU SUMBER/DATA';
    readinessReason = `${crossRef.brokenReferences.length} referensi bukti ke sumber rujukan tidak valid.`;
  } else if (mustCover.length === 0) {
    readinessStatus = 'PERLU MEMPERSEMPIT FOKUS';
    readinessReason = 'Belum ada poin wajib dibahas (MUST_COVER) yang terdefinisi pada GF-04.';
  }

  // Susun struktur GenflowMasterFrameworkData kanonis
  const framework: GenflowMasterFrameworkData = {
    documentIdentity: {
      fileName,
      extractedAt: Date.now(),
      wordCount: text.split(/\s+/).filter(Boolean).length,
      readingStatus: issues.some((i) => i.type === 'ERROR' || i.type === 'CONFLICT')
        ? 'PERLU_PERHATIAN'
        : 'SUKSES',
      warnings: issues.map((i) => `[${i.marker || 'UMUM'}] ${i.message}`),
    },
    executiveSummary: {
      topikUtama: topicTitle,
      fokusBesar: extractFieldValue(componentsById[3]?.content || '', 'CENTRAL_FOCUS') || componentsById[3]?.content || '',
      batasPembahasan: {
        wajibDibahas: mustCover,
        bolehDisinggung: mayMention,
        tidakBolehDimasukkan: outOfScope,
      },
      pertanyaanInti:
        extractFieldValue(componentsById[5]?.content || '', 'CORE_QUESTION') ||
        componentsById[5]?.content ||
        '',
      tesisUtama:
        extractFieldValue(componentsById[7]?.content || '', 'CENTRAL_THESIS') ||
        componentsById[7]?.content ||
        '',
      logicPunch:
        extractFieldValue(componentsById[8]?.content || '', 'LOGIC_PUNCH') ||
        componentsById[8]?.content ||
        '',
      statusKesiapan: readinessStatus,
      readinessReason,
      unresolvedCount: issues.length,
    },
    groups: {
      A: {
        title: 'INPUT UTAMA',
        components: [componentsById[1], componentsById[2]],
      },
      B: {
        title: 'PENGUNCI SUBSTANSI',
        components: [
          componentsById[3],
          componentsById[4],
          componentsById[5],
          componentsById[6],
          componentsById[7],
          componentsById[8],
          componentsById[9],
        ],
      },
      C: {
        title: 'PENGUNCI FAKTA DAN ARGUMENTASI',
        components: [
          componentsById[10],
          componentsById[11],
          componentsById[12],
          componentsById[13],
        ],
      },
      D: {
        title: 'PERANCANGAN STRUKTUR NASKAH',
        components: [componentsById[14], componentsById[15]],
      },
      E: {
        title: 'PERANCANGAN PEMBUKA, JUDUL, DAN PENUTUP',
        components: [componentsById[16], componentsById[17], componentsById[18]],
      },
      F: {
        title: 'AUDIT KERANGKA SEBELUM PENULISAN NARASI',
        components: [
          componentsById[19],
          componentsById[20],
          componentsById[21],
          componentsById[22],
          componentsById[23],
        ],
      },
      G: {
        title: 'ATURAN WAJIB PENGERJAAN',
        components: [],
      },
    },
    componentsById,
    isConfirmed: false,
    revisions: [],
  };

  const detectedCount = Object.values(componentsById).filter((c) => c.status === 'DITEMUKAN').length;

  return {
    policyMetadata: policy,
    classification,
    framework,
    validationReport: {
      passed: issues.filter((i) => i.type === 'ERROR' || i.type === 'CONFLICT').length === 0,
      readinessStatus,
      readinessReason,
      issues,
      totalDetectedComponents: detectedCount,
      crossReferenceCheck: {
        totalSources: sourcesExtracted.length,
        totalEvidences: evidencesExtracted.length,
        validReferences: crossRef.validReferences,
        brokenReferences: crossRef.brokenReferences,
      },
      scopeBoundaryCheck: {
        mustCoverCount: mustCover.length,
        mayMentionCount: mayMention.length,
        outOfScopeCount: outOfScope.length,
        hasConflict: boundaryConflict,
      },
      storyFlowCheck,
    },
  };
}

/**
 * Menyusun format dokumen teks baku sesuai template GENFLOW_FORMAT_KERANGKA_NASKAH_BAKU
 */
export function exportCanonicalFrameworkText(
  framework: GenflowMasterFrameworkData
): string {
  const c = framework.componentsById;
  const top = framework.executiveSummary;

  return `[GENFLOW_DOCUMENT_START]

SCHEMA_ID: GF-NARRATIVE-FRAMEWORK-1.0
DOCUMENT_TYPE: NARRATIVE_FRAMEWORK
TOPIC_TITLE: ${top.topikUtama}
TOPIC_SUMMARY: ${top.fokusBesar}
DOCUMENT_STATUS: ${top.statusKesiapan === 'SIAP DIKEMBANGKAN' ? 'READY_FOR_STAGE_2' : 'NEEDS_REVISION'}

[GENFLOW_METADATA_END]

A. INPUT UTAMA

[GF-01]
1. TOPIK UTAMA
${c[1]?.content || 'TOPIC_STATEMENT: ' + top.topikUtama}

[GF-02]
2. BAHAN DAN SUMBER RUJUKAN
${c[2]?.content || 'BELUM TERSEDIA'}

B. PENGUNCI SUBSTANSI

[GF-03]
3. KUNCI FOKUS BESAR — CENTRAL FOCUS
${c[3]?.content || 'CENTRAL_FOCUS: ' + top.fokusBesar}

[GF-04]
4. KUNCI BATAS PEMBAHASAN — SCOPE BOUNDARY
${c[4]?.content || `MUST_COVER_01: ${top.batasPembahasan.wajibDibahas.join(', ')}\nOUT_OF_SCOPE_01: ${top.batasPembahasan.tidakBolehDimasukkan.join(', ')}`}

[GF-05]
5. KUNCI PERTANYAAN INTI — CORE QUESTION
${c[5]?.content || 'CORE_QUESTION: ' + top.pertanyaanInti}

[GF-06]
6. KUNCI KERANGKA MASALAH — PROBLEM FRAMEWORK
${c[6]?.content || 'BELUM TERSEDIA'}

[GF-07]
7. KUNCI TESIS UTAMA — CENTRAL THESIS
${c[7]?.content || 'CENTRAL_THESIS: ' + top.tesisUtama}

[GF-08]
8. KUNCI LOGIC PUNCH
${c[8]?.content || 'LOGIC_PUNCH: ' + top.logicPunch}

[GF-09]
9. KUNCI TUJUAN PERUBAHAN PERSPEKTIF
${c[9]?.content || 'BELUM TERSEDIA'}

C. PENGUNCI FAKTA DAN ARGUMENTASI

[GF-10]
10. PEMETAAN LANDASAN FAKTA — EVIDENCE MAPPING
${c[10]?.content || 'BELUM TERSEDIA'}

[GF-11]
11. PEMETAAN RANTAI LOGIKA — ARGUMENT CHAIN
${c[11]?.content || 'BELUM TERSEDIA'}

[GF-12]
12. PEMETAAN KONTRAARGUMEN DAN ALTERNATIF PENJELASAN
${c[12]?.content || 'BELUM TERSEDIA'}

[GF-13]
13. PENENTUAN PLOT TWIST — PERSPECTIVE SHIFT
${c[13]?.content || 'BELUM TERSEDIA'}

D. PERANCANGAN STRUKTUR NASKAH

[GF-14]
14. PENENTUAN FUNGSI SETIAP BAGIAN
${c[14]?.content || 'BELUM TERSEDIA'}

[GF-15]
15. PENYUSUNAN ALUR PEMBAHASAN — NARRATIVE BLUEPRINT
${c[15]?.content || 'BELUM TERSEDIA'}

E. PERANCANGAN PEMBUKA, JUDUL, DAN PENUTUP

[GF-16]
16. PERUMUSAN JUDUL
${c[16]?.content || 'PRIMARY_TITLE: ' + top.topikUtama}

[GF-17]
17. PERANCANGAN HOOK
${c[17]?.content || 'BELUM TERSEDIA'}

[GF-18]
18. PERANCANGAN KLIMAKS DAN PENUTUP
${c[18]?.content || 'BELUM TERSEDIA'}

F. AUDIT KERANGKA SEBELUM PENULISAN NARASI

[GF-19]
19. AUDIT KONSISTENSI SUBSTANSI
${c[19]?.content || 'FOCUS_TO_QUESTION_ALIGNMENT: Konsisten'}

[GF-20]
20. AUDIT KELENGKAPAN ARGUMENTASI
${c[20]?.content || 'REQUIRED_POINTS_COVERAGE: Lengkap'}

[GF-21]
21. AUDIT POTENSI PENYIMPANGAN
${c[21]?.content || 'OUT_OF_SCOPE_CHECK: Lulus'}

[GF-22]
22. AUDIT KELAYAKAN STRUKTUR
${c[22]?.content || 'SEQUENCE_CHECK: Masuk akal'}

[GF-23]
23. KEPUTUSAN KESIAPAN KERANGKA
READINESS_STATUS: ${top.statusKesiapan === 'SIAP DIKEMBANGKAN' ? 'READY_FOR_STAGE_2' : 'NEEDS_REVISION'}
READINESS_REASON: ${top.readinessReason}

G. ATURAN WAJIB PENGERJAAN
[GENFLOW_PROCESSING_RULES_START]
Dokumen ini adalah KERANGKA PERENCANAAN, bukan naskah narasi final.
Pertahankan seluruh 23 komponen GF-01 sampai GF-23 dan urutan A–G.
Setiap klaim faktual harus mempunyai SOURCE_ID atau ditandai NEEDS_VERIFICATION.
Pertahankan batas Wajib Dibahas, Boleh Disinggung, dan Di Luar Fokus.
[GENFLOW_PROCESSING_RULES_END]

[GENFLOW_DOCUMENT_END]`;
}
