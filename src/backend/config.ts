export type BackendMode = 'preview' | 'supabase';

export interface BackendEnvironment {
  VITE_BOOK_CIRCLE_BACKEND?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}

export type BackendConfig =
  | { mode: 'preview' }
  | { mode: 'supabase'; url: string; publishableKey: string };

function decodeJwtPayload(key: string) {
  const segments = key.split('.');
  if (segments.length !== 3) return null;

  try {
    const normalized = segments[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(globalThis.atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function assertBrowserSafeSupabaseKey(key: string) {
  const normalized = key.trim();
  const jwtPayload = decodeJwtPayload(normalized);
  const role = typeof jwtPayload?.role === 'string' ? jwtPayload.role : null;

  if (
    !normalized
    || normalized.startsWith('sb_secret_')
    || role === 'service_role'
    || normalized.toLowerCase().includes('service_role')
  ) {
    throw new Error(
      'A Supabase secret or service-role key must never be exposed in the browser.',
    );
  }

  return normalized;
}

function isAllowedSupabaseUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:'
      || ((url.hostname === 'localhost' || url.hostname === '127.0.0.1') && url.protocol === 'http:')
    );
  } catch {
    return false;
  }
}

export function readBackendConfig(environment: BackendEnvironment): BackendConfig {
  const requestedMode = (environment.VITE_BOOK_CIRCLE_BACKEND ?? 'preview').trim();
  if (requestedMode === 'preview') return { mode: 'preview' };
  if (requestedMode !== 'supabase') {
    throw new Error(`Unsupported Book Circle backend mode: ${requestedMode}`);
  }

  const url = environment.VITE_SUPABASE_URL?.trim() ?? '';
  const candidateKey = (
    environment.VITE_SUPABASE_PUBLISHABLE_KEY
    ?? environment.VITE_SUPABASE_ANON_KEY
    ?? ''
  ).trim();

  if (!isAllowedSupabaseUrl(url)) {
    throw new Error('Supabase mode requires a valid HTTPS project URL.');
  }

  return {
    mode: 'supabase',
    url,
    publishableKey: assertBrowserSafeSupabaseKey(candidateKey),
  };
}

export function getBackendConfig() {
  return readBackendConfig({
    VITE_BOOK_CIRCLE_BACKEND: import.meta.env.VITE_BOOK_CIRCLE_BACKEND,
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
  });
}
