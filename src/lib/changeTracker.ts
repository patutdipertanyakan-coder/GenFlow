/**
 * GenNAS Pro Live Update Center — Change Tracker & Version Comparator Engine
 * 
 * Modul ini menangani:
 * 1. Pelacakan dan perbandingan data rilis secara deterministik
 * 2. Format waktu Asia/Jakarta (WIB)
 * 3. Kategorisasi modul kritis (CRITICAL SYSTEM CHANGE)
 * 4. Perhitungan status pembaruan yang belum dibaca
 * 5. Sanitasi catatan rilis untuk mencegah kebocoran informasi sensitif
 * 
 * DILARANG menyentuh naskah, validasi Non-SARA, atau logika penulisan.
 */

export type UpdateStatus =
  | 'DRAFT'
  | 'CODE UPDATED'
  | 'BUILD PASSED'
  | 'BUILD FAILED'
  | 'TESTING'
  | 'TEST FAILED'
  | 'READY'
  | 'DEPLOYED'
  | 'ACTIVE'
  | 'ROLLED BACK';

export type CriticalModule =
  | 'MASTER PROMPT'
  | 'NON_SARA_HARD_GUARD'
  | 'SCTF DAN STORYFLOW'
  | 'SOURCE FIDELITY'
  | 'SQNN / QUOTE-FREE'
  | 'SAP DAN PROTECTED TOKENS'
  | 'BANK KOSAKATA F1–F8'
  | 'DYNAMIC LEXICON MONITOR'
  | 'DRA / PTV'
  | 'VALIDATOR DETERMINISTIK'
  | 'GENERATOR DAN EDITOR NASKAH'
  | 'LIVE UPDATE CENTER';

export interface ChangedFileEntry {
  path: string;
  action: 'CREATED' | 'MODIFIED' | 'DELETED';
  summary: string;
}

export interface TestResultSummary {
  runner: string;
  command: string;
  totalSuites: number;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  lastRunJakarta: string;
  details?: string[];
}

export interface ReleaseRecord {
  release_id: string;
  version: string;
  release_title: string;
  description: string;
  created_at: string;
  updated_at: string;
  deployed_at: string;
  status: UpdateStatus;
  build_id: string;
  commit_hash: string;
  change_type: 'MAJOR' | 'MINOR' | 'PATCH';
  is_critical_system_change: boolean;
  critical_modules: CriticalModule[];
  affected_modules: string[];
  changed_files: ChangedFileEntry[];
  new_features: string[];
  fixes: string[];
  improvements: string[];
  backend_changes: string[];
  ui_changes: string[];
  validator_changes: string[];
  prompt_lexicon_changes: string[];
  breaking_changes: string[];
  test_results: TestResultSummary;
  known_issues: string[];
  risks_and_notes: string[];
  verification_status: 'VERIFIED' | 'UNVERIFIED' | 'FAILED';
}

export interface SystemChangelogManifest {
  manifest_version: string;
  app_name: string;
  current_version: string;
  active_release_id: string;
  releases: ReleaseRecord[];
}

export interface VersionComparisonResult {
  base_version: string;
  target_version: string;
  is_upgrade: boolean;
  semantic_jump: 'MAJOR' | 'MINOR' | 'PATCH' | 'IDENTICAL' | 'DOWNGRADE';
  new_features: string[];
  removed_features: string[];
  fixed_bugs: string[];
  files_changed: {
    added: string[];
    modified: string[];
    deleted: string[];
    total: number;
  };
  modules_affected: string[];
  critical_changes: CriticalModule[];
  test_comparison: {
    base_passed: number;
    target_passed: number;
    diff_tests: number;
    is_regression_free: boolean;
  };
  compatibility_risks: string[];
  breaking_changes: string[];
  verification_status: 'VERIFIED' | 'UNVERIFIED' | 'FAILED';
}

/**
 * Format timestamp ISO ke Waktu Indonesia Barat (Asia/Jakarta)
 */
export function formatJakartaTime(dateOrIso: string | Date | number): string {
  try {
    const d = typeof dateOrIso === 'string' || typeof dateOrIso === 'number' ? new Date(dateOrIso) : dateOrIso;
    if (isNaN(d.getTime())) return 'Waktu tidak valid';

    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d) + ' WIB';
  } catch {
    return String(dateOrIso);
  }
}

/**
 * Membandingkan nomor versi Semantic Versioning (vX.Y.Z)
 * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
export function compareSemVer(v1: string, v2: string): number {
  const clean = (v: string) => v.replace(/^v/i, '').trim();
  const p1 = clean(v1).split('.').map((n) => parseInt(n, 10) || 0);
  const p2 = clean(v2).split('.').map((n) => parseInt(n, 10) || 0);

  for (let i = 0; i < 3; i++) {
    const a = p1[i] ?? 0;
    const b = p2[i] ?? 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

/**
 * Mendeteksi jenis lonjakan semantik antara dua versi
 */
export function getSemanticJump(
  baseVer: string,
  targetVer: string
): 'MAJOR' | 'MINOR' | 'PATCH' | 'IDENTICAL' | 'DOWNGRADE' {
  const cmp = compareSemVer(targetVer, baseVer);
  if (cmp === 0) return 'IDENTICAL';
  if (cmp < 0) return 'DOWNGRADE';

  const clean = (v: string) => v.replace(/^v/i, '').trim();
  const p1 = clean(baseVer).split('.').map(Number);
  const p2 = clean(targetVer).split('.').map(Number);

  if ((p2[0] || 0) > (p1[0] || 0)) return 'MAJOR';
  if ((p2[1] || 0) > (p1[1] || 0)) return 'MINOR';
  return 'PATCH';
}

/**
 * Identifikasi apakah suatu file masuk kategori CRITICAL SYSTEM CHANGE
 */
export function identifyCriticalModulesForFiles(filePaths: string[]): CriticalModule[] {
  const criticalMap: Record<string, CriticalModule[]> = {
    'masterPrompt': ['MASTER PROMPT'],
    'sqnn': ['SQNN / QUOTE-FREE'],
    'quote': ['SQNN / QUOTE-FREE'],
    'sourceFidelity': ['SOURCE FIDELITY'],
    'nonSara': ['NON_SARA_HARD_GUARD'],
    'sctf': ['SCTF DAN STORYFLOW'],
    'storyflow': ['SCTF DAN STORYFLOW'],
    'lexicon': ['BANK KOSAKATA F1–F8'],
    'dynamicLexicon': ['DYNAMIC LEXICON MONITOR'],
    'sap': ['SAP DAN PROTECTED TOKENS'],
    'validator': ['VALIDATOR DETERMINISTIK'],
    'pipeline': ['VALIDATOR DETERMINISTIK'],
    'App.tsx': ['GENERATOR DAN EDITOR NASKAH'],
    'EditorAndQualityPanel': ['GENERATOR DAN EDITOR NASKAH', 'VALIDATOR DETERMINISTIK'],
    'changeTracker': ['LIVE UPDATE CENTER'],
    'LiveUpdateCenter': ['LIVE UPDATE CENTER'],
  };

  const results = new Set<CriticalModule>();

  for (const f of filePaths) {
    const lower = f.toLowerCase();
    if (lower.includes('masterprompt')) results.add('MASTER PROMPT');
    if (lower.includes('sqnn') || lower.includes('quote')) results.add('SQNN / QUOTE-FREE');
    if (lower.includes('sourcefidelity')) results.add('SOURCE FIDELITY');
    if (lower.includes('nonsara')) results.add('NON_SARA_HARD_GUARD');
    if (lower.includes('sctf') || lower.includes('storyflow')) results.add('SCTF DAN STORYFLOW');
    if (lower.includes('lexicon')) results.add('BANK KOSAKATA F1–F8');
    if (lower.includes('dynamiclexicon')) results.add('DYNAMIC LEXICON MONITOR');
    if (lower.includes('sap') || lower.includes('token')) results.add('SAP DAN PROTECTED TOKENS');
    if (lower.includes('validator') || lower.includes('pipeline')) results.add('VALIDATOR DETERMINISTIK');
    if (lower.includes('app.tsx') || lower.includes('editor')) results.add('GENERATOR DAN EDITOR NASKAH');
    if (lower.includes('changetracker') || lower.includes('liveupdate') || lower.includes('releasemanifest')) {
      results.add('LIVE UPDATE CENTER');
    }
  }

  return Array.from(results);
}

/**
 * Validasi integritas record rilis sebelum diterbitkan
 */
export function validateReleaseRecord(record: Partial<ReleaseRecord>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!record.version || !/^\d+\.\d+\.\d+$/.test(record.version.replace(/^v/i, ''))) {
    errors.push('Nomor versi harus mengikuti Semantic Versioning (contoh: 5.2.0)');
  }

  if (!record.release_id || record.release_id.trim().length === 0) {
    errors.push('release_id wajib diisi');
  }

  if (!record.release_title || record.release_title.trim().length === 0) {
    errors.push('release_title wajib diisi');
  }

  if (!record.status) {
    errors.push('Status pembaruan wajib ditentukan');
  }

  if (!record.test_results) {
    errors.push('test_results wajib dilampirkan');
  } else {
    if (record.test_results.failed > 0 && record.status === 'ACTIVE') {
      errors.push('Rilis tidak boleh berstatus ACTIVE jika ada pengujian yang gagal');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Membandingkan dua rilis secara komprehensif (Side-by-Side Version Comparator)
 */
export function compareReleases(
  base: ReleaseRecord,
  target: ReleaseRecord
): VersionComparisonResult {
  const jump = getSemanticJump(base.version, target.version);
  const isUpgrade = compareSemVer(target.version, base.version) > 0;

  // Fitur baru yang ada di target tapi belum ada di base
  const newFeatures = target.new_features.filter(
    (f) => !base.new_features.includes(f)
  );

  // Fitur yang ada di base tapi tidak lagi tercantum di target
  const removedFeatures = base.new_features.filter(
    (f) => !target.new_features.includes(f)
  );

  // Perbaikan bug
  const fixedBugs = target.fixes.filter((fx) => !base.fixes.includes(fx));

  // Perbandingan file
  const baseFiles = new Set(base.changed_files.map((cf) => cf.path));
  const targetFiles = new Set(target.changed_files.map((cf) => cf.path));

  const addedFiles: string[] = [];
  const modifiedFiles: string[] = [];
  const deletedFiles: string[] = [];

  target.changed_files.forEach((cf) => {
    if (cf.action === 'CREATED' || !baseFiles.has(cf.path)) {
      addedFiles.push(cf.path);
    } else if (cf.action === 'DELETED') {
      deletedFiles.push(cf.path);
    } else {
      modifiedFiles.push(cf.path);
    }
  });

  // Gabungan modul yang terpengaruh
  const affectedModules = Array.from(
    new Set([...base.affected_modules, ...target.affected_modules])
  );

  // Modul kritis yang berubah
  const criticalChanges = Array.from(
    new Set([...target.critical_modules])
  );

  // Perbandingan tes
  const basePassed = base.test_results?.passed ?? 0;
  const targetPassed = target.test_results?.passed ?? 0;
  const isRegressionFree =
    (target.test_results?.failed ?? 0) === 0 && targetPassed >= basePassed;

  return {
    base_version: base.version,
    target_version: target.version,
    is_upgrade: isUpgrade,
    semantic_jump: jump,
    new_features: newFeatures.length > 0 ? newFeatures : target.new_features,
    removed_features: removedFeatures,
    fixed_bugs: fixedBugs.length > 0 ? fixedBugs : target.fixes,
    files_changed: {
      added: addedFiles,
      modified: modifiedFiles,
      deleted: deletedFiles,
      total: target.changed_files.length,
    },
    modules_affected: affectedModules,
    critical_changes: criticalChanges,
    test_comparison: {
      base_passed: basePassed,
      target_passed: targetPassed,
      diff_tests: targetPassed - basePassed,
      is_regression_free: isRegressionFree,
    },
    compatibility_risks: target.risks_and_notes,
    breaking_changes: target.breaking_changes,
    verification_status: target.verification_status,
  };
}

/**
 * Menghitung rilis aktif yang belum pernah dibaca oleh pengguna
 */
export function calculateUnreadReleases(
  releases: ReleaseRecord[],
  readReleaseIds: string[]
): {
  unreadCount: number;
  unreadIds: string[];
} {
  const readSet = new Set(readReleaseIds);
  const unread = releases.filter((r) => !readSet.has(r.release_id));

  return {
    unreadCount: unread.length,
    unreadIds: unread.map((r) => r.release_id),
  };
}

/**
 * Sanitasi string untuk mencegah kebocoran informasi kredensial atau rahasia
 */
export function sanitizeChangeNotes(text: string): string {
  if (!text) return '';
  return text
    .replace(/AIza[A-Za-z0-9_-]{20,}/g, '[REDACTED_API_KEY]')
    .replace(/AQ\.[A-Za-z0-9_-]{20,}/g, '[REDACTED_GCP_AUTH_KEY]')
    .replace(/sb_secret_[A-Za-z0-9_-]+/g, '[REDACTED_SUPABASE_SECRET]')
    .replace(/(bearer\s+)[A-Za-z0-9._-]+/gi, '$1[REDACTED_TOKEN]')
    .replace(/(password|secret|key)=([^\s&]+)/gi, '$1=[REDACTED]');
}

