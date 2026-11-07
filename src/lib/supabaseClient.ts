import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase Client configuration for GenFLOW Unified Architecture.
 * Targets operational project reference: ouuoukdhzeenbkxhfnik
 * Single Source of Truth — Zero Local Operational Repositories.
 */

export const EXPECTED_PROJECT_REF = 'ouuoukdhzeenbkxhfnik';
export const EXPECTED_PROJECT_URL = 'https://ouuoukdhzeenbkxhfnik.supabase.co';

export type SupabaseOperationalStatus =
  | 'CONNECTED'
  | 'PARTIAL'
  | 'AUTHENTICATION_FAILED'
  | 'PERMISSION_DENIED'
  | 'API_ROUTE_UNAVAILABLE'
  | 'CONNECTION_TIMEOUT'
  | 'DATA_INCOMPLETE'
  | 'NOT_CONFIGURED';

// Backwards compatibility alias
export type SupabaseConnectionStatus =
  | SupabaseOperationalStatus
  | 'DATA_LOADING'
  | 'DATA_LOADED'
  | 'EMPTY_RESULT'
  | 'DISCONNECTED'
  | 'AUTH_ERROR'
  | 'QUERY_ERROR'
  | 'DEGRADED';

export interface TableAuditResult {
  tableName: 'lexicon_entries' | 'lexicon_context_rules' | 'narrative_phrases';
  success: boolean;
  totalCount: number;
  activeCount: number;
  disabledCount: number;
  error?: string;
  errorCode?: string;
}

export interface SupabaseFullAudit {
  projectRef: string;
  projectUrl: string;
  status: SupabaseOperationalStatus;
  timestamp: string;
  tables: {
    lexicon_entries: TableAuditResult;
    lexicon_context_rules: TableAuditResult;
    narrative_phrases: TableAuditResult;
  };
  failedTables: string[];
  totalActiveLexicon: number;
  totalActiveRules: number;
  totalActivePhrases: number;
  blacklistCount: number;
}

function resolveEnvUrl(): string {
  let url: string | undefined;
  if (typeof process !== 'undefined' && process.env) {
    url =
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (!url && typeof import.meta !== 'undefined' && import.meta.env) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      url = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
    }
  } catch (_e) {
    // ignore in environments where import.meta is unavailable
  }
  return url || EXPECTED_PROJECT_URL;
}

function resolveEnvPublishableKey(): string {
  let key: string | undefined;
  if (typeof process !== 'undefined' && process.env) {
    key =
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (!key && typeof import.meta !== 'undefined' && import.meta.env) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      key =
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
        import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        import.meta.env.VITE_SUPABASE_ANON_KEY;
    }
  } catch (_e) {
    // ignore in environments where import.meta is unavailable
  }
  return key || 'NOT_CONFIGURED';
}

function resolveEnvSecretKey(): string | null {
  // Never expose secret key to browser environment
  if (typeof window !== 'undefined') {
    return null;
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env.SUPABASE_SECRET_KEY || null;
  }
  return null;
}

export const isProjectRefValid = resolveEnvUrl().includes(EXPECTED_PROJECT_REF);
export const supabaseUrl = isProjectRefValid ? resolveEnvUrl() : EXPECTED_PROJECT_URL;
export const supabasePublishableKey = resolveEnvPublishableKey();

/**
 * Mendapatkan client Supabase dinamis.
 * Jika preferAdmin=true dan berada di server-side dengan SUPABASE_SECRET_KEY,
 * gunakan secret key untuk operasi backend berotoritas.
 */
export function getActiveSupabaseClient(preferAdmin = false): SupabaseClient {
  const url = resolveEnvUrl();
  const secretKey = preferAdmin ? resolveEnvSecretKey() : null;
  const pubKey = resolveEnvPublishableKey();
  const selectedKey = secretKey || pubKey;

  return createClient(url, selectedKey === 'NOT_CONFIGURED' ? 'INVALID_KEY' : selectedKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// Client default untuk operasi umum
export const supabase: SupabaseClient = getActiveSupabaseClient(true);

/**
 * Client untuk server backend yang memanfaatkan secret key jika ada
 */
export const supabaseAdmin: SupabaseClient = getActiveSupabaseClient(true);

/**
 * Creates a new Supabase client with the user's JWT token.
 * Used for user-scoped CRUD operations to satisfy RLS requirements.
 */
export function createAuthenticatedClient(token: string): SupabaseClient {
  const pubKey = resolveEnvPublishableKey();
  return createClient(
    supabaseUrl,
    pubKey === 'NOT_CONFIGURED' ? 'INVALID_KEY' : pubKey,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  );
}

/**
 * Diagnostic check to verify connectivity to all 3 operational tables:
 * 1. public.lexicon_entries
 * 2. public.lexicon_context_rules
 * 3. public.narrative_phrases
 *
 * Mengembalikan status akurat:
 * - CONNECTED
 * - PARTIAL
 * - AUTHENTICATION_FAILED
 * - PERMISSION_DENIED
 * - API_ROUTE_UNAVAILABLE
 * - CONNECTION_TIMEOUT
 * - DATA_INCOMPLETE
 */
export async function checkSupabaseOperationalTables(
  client: SupabaseClient = supabase
): Promise<SupabaseFullAudit> {
  const now = new Date().toISOString();
  const url = resolveEnvUrl();
  const pubKey = resolveEnvPublishableKey();

  if (!url.includes(EXPECTED_PROJECT_REF) || pubKey === 'NOT_CONFIGURED') {
    return {
      projectRef: EXPECTED_PROJECT_REF,
      projectUrl: EXPECTED_PROJECT_URL,
      status: 'NOT_CONFIGURED',
      timestamp: now,
      tables: {
        lexicon_entries: { tableName: 'lexicon_entries', success: false, totalCount: 0, activeCount: 0, disabledCount: 0, error: 'Project ref atau Key belum terkonfigurasi' },
        lexicon_context_rules: { tableName: 'lexicon_context_rules', success: false, totalCount: 0, activeCount: 0, disabledCount: 0, error: 'Project ref atau Key belum terkonfigurasi' },
        narrative_phrases: { tableName: 'narrative_phrases', success: false, totalCount: 0, activeCount: 0, disabledCount: 0, error: 'Project ref atau Key belum terkonfigurasi' },
      },
      failedTables: ['lexicon_entries', 'lexicon_context_rules', 'narrative_phrases'],
      totalActiveLexicon: 0,
      totalActiveRules: 0,
      totalActivePhrases: 0,
      blacklistCount: 0,
    };
  }

  const tableAudits: Record<'lexicon_entries' | 'lexicon_context_rules' | 'narrative_phrases', TableAuditResult> = {
    lexicon_entries: { tableName: 'lexicon_entries', success: false, totalCount: 0, activeCount: 0, disabledCount: 0 },
    lexicon_context_rules: { tableName: 'lexicon_context_rules', success: false, totalCount: 0, activeCount: 0, disabledCount: 0 },
    narrative_phrases: { tableName: 'narrative_phrases', success: false, totalCount: 0, activeCount: 0, disabledCount: 0 },
  };

  const failedTables: string[] = [];
  let isAuthFailed = false;
  let isPermissionDenied = false;
  let isTimeout = false;
  let blacklistCount = 0;

  // 1. Audit public.lexicon_entries
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('CONNECTION_TIMEOUT')), 9000)
    );

    const queryPromise = client
      .from('lexicon_entries')
      .select('status, eligibility_status', { count: 'exact' });

    const { data, count, error } = await Promise.race([queryPromise, timeoutPromise]);

    if (error) {
      if (error.code === 'PGRST301' || error.message?.includes('JWT') || error.message?.includes('auth')) {
        isAuthFailed = true;
      } else if (error.code === '42501' || error.message?.includes('permission') || error.message?.includes('policy')) {
        isPermissionDenied = true;
      }
      tableAudits.lexicon_entries.error = error.message;
      tableAudits.lexicon_entries.errorCode = error.code;
      failedTables.push('lexicon_entries');
    } else {
      tableAudits.lexicon_entries.success = true;
      tableAudits.lexicon_entries.totalCount = count || 0;
      let active = 0;
      let disabled = 0;
      data?.forEach((row: any) => {
        if (row.status === 'blacklisted') {
          blacklistCount++;
          disabled++;
        } else if (row.status === 'inactive' || row.status === 'disabled') {
          disabled++;
        } else {
          active++;
        }
      });
      tableAudits.lexicon_entries.activeCount = active;
      tableAudits.lexicon_entries.disabledCount = disabled;
    }
  } catch (err: any) {
    if (err.message === 'CONNECTION_TIMEOUT') isTimeout = true;
    tableAudits.lexicon_entries.error = err.message || 'Timeout/Network error';
    failedTables.push('lexicon_entries');
  }

  // 2. Audit public.lexicon_context_rules
  try {
    const { data, count, error } = await client
      .from('lexicon_context_rules')
      .select('is_active, status', { count: 'exact' });

    if (error) {
      if (error.code === 'PGRST301' || error.message?.includes('JWT') || error.message?.includes('auth')) {
        isAuthFailed = true;
      } else if (error.code === '42501' || error.message?.includes('permission') || error.message?.includes('policy')) {
        isPermissionDenied = true;
      }
      tableAudits.lexicon_context_rules.error = error.message;
      tableAudits.lexicon_context_rules.errorCode = error.code;
      failedTables.push('lexicon_context_rules');
    } else {
      tableAudits.lexicon_context_rules.success = true;
      tableAudits.lexicon_context_rules.totalCount = count || 0;
      let active = 0;
      let disabled = 0;
      data?.forEach((row: any) => {
        if (row.is_active === false || row.status === 'inactive') {
          disabled++;
        } else if (row.status === 'blacklisted') {
          blacklistCount++;
          disabled++;
        } else {
          active++;
        }
      });
      tableAudits.lexicon_context_rules.activeCount = active;
      tableAudits.lexicon_context_rules.disabledCount = disabled;
    }
  } catch (err: any) {
    tableAudits.lexicon_context_rules.error = err.message || 'Error';
    failedTables.push('lexicon_context_rules');
  }

  // 3. Audit public.narrative_phrases
  try {
    const { data, count, error } = await client
      .from('narrative_phrases')
      .select('is_active', { count: 'exact' });

    if (error) {
      if (error.code === 'PGRST301' || error.message?.includes('JWT') || error.message?.includes('auth')) {
        isAuthFailed = true;
      } else if (error.code === '42501' || error.message?.includes('permission') || error.message?.includes('policy')) {
        isPermissionDenied = true;
      }
      tableAudits.narrative_phrases.error = error.message;
      tableAudits.narrative_phrases.errorCode = error.code;
      failedTables.push('narrative_phrases');
    } else {
      tableAudits.narrative_phrases.success = true;
      tableAudits.narrative_phrases.totalCount = count || 0;
      let active = 0;
      let disabled = 0;
      data?.forEach((row: any) => {
        if (row.is_active === false) {
          disabled++;
        } else {
          active++;
        }
      });
      tableAudits.narrative_phrases.activeCount = active;
      tableAudits.narrative_phrases.disabledCount = disabled;
    }
  } catch (err: any) {
    tableAudits.narrative_phrases.error = err.message || 'Error';
    failedTables.push('narrative_phrases');
  }

  // Evaluasi Status Komprehensif
  let finalStatus: SupabaseOperationalStatus = 'CONNECTED';
  if (isAuthFailed) {
    finalStatus = 'AUTHENTICATION_FAILED';
  } else if (isPermissionDenied) {
    finalStatus = 'PERMISSION_DENIED';
  } else if (isTimeout) {
    finalStatus = 'CONNECTION_TIMEOUT';
  } else if (failedTables.length === 3) {
    finalStatus = 'API_ROUTE_UNAVAILABLE';
  } else if (failedTables.length > 0) {
    finalStatus = 'PARTIAL';
  } else if (
    tableAudits.lexicon_entries.totalCount === 0 ||
    tableAudits.lexicon_context_rules.totalCount === 0 ||
    tableAudits.narrative_phrases.totalCount === 0
  ) {
    finalStatus = 'DATA_INCOMPLETE';
  }

  return {
    projectRef: EXPECTED_PROJECT_REF,
    projectUrl: EXPECTED_PROJECT_URL,
    status: finalStatus,
    timestamp: now,
    tables: tableAudits,
    failedTables,
    totalActiveLexicon: tableAudits.lexicon_entries.activeCount,
    totalActiveRules: tableAudits.lexicon_context_rules.activeCount,
    totalActivePhrases: tableAudits.narrative_phrases.activeCount,
    blacklistCount,
  };
}

/**
 * Backward compatibility check function.
 */
export async function checkSupabaseConnection(): Promise<SupabaseConnectionStatus> {
  const audit = await checkSupabaseOperationalTables();
  if (audit.status === 'CONNECTED') return 'CONNECTED';
  if (audit.status === 'AUTHENTICATION_FAILED') return 'AUTH_ERROR';
  if (audit.status === 'PERMISSION_DENIED') return 'PERMISSION_DENIED';
  if (audit.status === 'NOT_CONFIGURED') return 'NOT_CONFIGURED';
  if (audit.status === 'DATA_INCOMPLETE') return 'EMPTY_RESULT';
  if (audit.status === 'PARTIAL') return 'DEGRADED';
  return 'DISCONNECTED';
}
