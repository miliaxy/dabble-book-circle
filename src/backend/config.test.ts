import { describe, expect, it } from 'vitest';
import { assertBrowserSafeSupabaseKey, readBackendConfig } from './config';

function jwtWithRole(role: string) {
  const encode = (value: object) => btoa(JSON.stringify(value))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${encode({ alg: 'none' })}.${encode({ role })}.signature`;
}

describe('backend configuration', () => {
  it('keeps the application in preview mode without environment values', () => {
    expect(readBackendConfig({})).toEqual({ mode: 'preview' });
  });

  it('accepts a browser-safe publishable key', () => {
    expect(readBackendConfig({
      VITE_BOOK_CIRCLE_BACKEND: 'supabase',
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
    })).toEqual({
      mode: 'supabase',
      url: 'https://example.supabase.co',
      publishableKey: 'sb_publishable_example',
    });
  });

  it('rejects both new and legacy secret keys', () => {
    expect(() => assertBrowserSafeSupabaseKey('sb_secret_do_not_expose')).toThrow(/never/);
    expect(() => assertBrowserSafeSupabaseKey(jwtWithRole('service_role'))).toThrow(/never/);
  });
});
