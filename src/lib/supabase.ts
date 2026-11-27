import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function cleanEnvValue(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().replace(/^["']|["']$/g, '').trim();
}

function normalizeSupabaseUrl(raw: unknown): { url: string; error: string | null } {
  const cleaned = cleanEnvValue(raw);
  if (!cleaned) {
    return { url: '', error: null };
  }

  let candidate = cleaned;
  // Support users entering only the Supabase project ID (e.g. "ynzttreihlgnovgliuud")
  if (/^[a-z0-9]{15,32}$/i.test(candidate)) {
    candidate = `https://${candidate.toLowerCase()}.supabase.co`;
  } else if (/^[a-z0-9-]+\.supabase\.(co|in)\/?$/i.test(candidate)) {
    candidate = `https://${candidate.replace(/\/+$/, '')}`;
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        url: '',
        error: 'VITE_SUPABASE_URL must use https:// (for example https://<project-id>.supabase.co).',
      };
    }
    return { url: parsed.origin, error: null };
  } catch {
    return {
      url: '',
      error:
        'VITE_SUPABASE_URL is invalid. Set it to https://<project-id>.supabase.co (or your Supabase Project ID).',
    };
  }
}

const { url: supabaseUrl, error: supabaseUrlError } = normalizeSupabaseUrl(
  import.meta.env.VITE_SUPABASE_URL
);
const supabasePublishableKey = cleanEnvValue(
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY
);

const missingVars: string[] = [];
if (!supabaseUrl && !supabaseUrlError) missingVars.push('VITE_SUPABASE_URL');
if (!supabasePublishableKey) missingVars.push('VITE_SUPABASE_PUBLISHABLE_KEY');

let initializedClient: SupabaseClient | null = null;
let initError: string | null = supabaseUrlError;

if (!initError && supabaseUrl && supabasePublishableKey) {
  try {
    initializedClient = createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  } catch (err) {
    initError =
      err instanceof Error
        ? err.message
        : 'Failed to initialize Supabase client with the configured environment variables.';
    initializedClient = null;
  }
}

export const missingSupabaseEnvVars: string[] = missingVars;
export const supabaseInitError: string | null = initError;
export const isSupabaseConfigured = Boolean(initializedClient);
export const supabase: SupabaseClient | null = initializedClient;

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    const missingMsg =
      missingSupabaseEnvVars.length > 0
        ? `Supabase is not configured. Missing environment variable(s): ${missingSupabaseEnvVars.join(', ')}.`
        : 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in your environment.';
    throw new Error(supabaseInitError || missingMsg);
  }
  return supabase;
}

export function isSchemaMissingError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const record = err as { code?: unknown; message?: unknown };
  const code = typeof record.code === 'string' ? record.code : '';
  const msg = typeof record.message === 'string' ? record.message : '';
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    msg.includes('Could not find the table') ||
    msg.includes('schema cache')
  );
}

export function formatSupabaseError(err: unknown, fallback = 'Operation failed.'): string {
  if (!err) return fallback;
  if (err instanceof Error) {
    const msg = err.message || fallback;
    if (msg.includes('Invalid login credentials')) return 'Invalid email or password.';
    if (msg.includes('Email not confirmed')) {
      return 'Please verify your email address from your inbox before signing in.';
    }
    if (msg.includes('User already registered')) {
      return 'An account with this email is already registered.';
    }
    return msg;
  }
  if (typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return fallback;
}
