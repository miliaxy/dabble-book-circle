import { describe, expect, it } from 'vitest';
import schemaMigration from '../../supabase/migrations/202608050001_private_book_circle_schema.sql?raw';
import photoMigration from '../../supabase/migrations/202608050002_private_book_photos.sql?raw';
import apiMigration from '../../supabase/migrations/202608050003_book_circle_api.sql?raw';

const exposedTables = [
  'parent_profiles',
  'families',
  'family_memberships',
  'communities',
  'community_memberships',
  'community_invitations',
  'book_titles',
  'book_copies',
  'book_listings',
  'borrow_requests',
  'loans',
  'loan_feedback',
  'notifications',
];

describe('production database security contract', () => {
  it('enables RLS on every private table exposed through the public schema', () => {
    for (const table of exposedTables) {
      expect(schemaMigration).toContain(
        `alter table public.${table} enable row level security;`,
      );
    }
  });

  it('keeps workflow mutations behind authenticated database functions', () => {
    expect(schemaMigration).toContain(
      'revoke all on table public.borrow_requests from anon, authenticated;',
    );
    expect(schemaMigration).toContain(
      'revoke all on table public.loans from anon, authenticated;',
    );
    expect(apiMigration).toContain(
      'grant execute on function public.request_book(uuid) to authenticated;',
    );
    expect(apiMigration).toContain(
      'grant execute on function public.decline_book_request(uuid, text) to authenticated;',
    );
    expect(apiMigration).toContain("set status = 'declined'");
    expect(apiMigration).toContain("'request_declined'");
    expect(apiMigration).toContain("'reason', v_reason");
    expect(apiMigration).not.toMatch(/grant execute[^;]+\bto anon\b/i);
  });

  it('enforces FIFO, one active loan, and a receipt-based seven-day maximum', () => {
    expect(schemaMigration).toContain('loans_one_active_per_copy_idx');
    expect(schemaMigration).toContain("due_at <= received_at + interval '7 days'");
    expect(apiMigration).toContain('order by br.requested_at, br.id');
    expect(apiMigration).toContain("v_due_at := v_received_at + interval '7 days';");
  });

  it('persists optional series metadata and exposes it in the private catalog', () => {
    expect(schemaMigration).toContain('series_name text');
    expect(schemaMigration).toContain('series_number text');
    expect(schemaMigration).toContain("coalesce(series_name, '')");
    expect(apiMigration).toContain('p_series_name text');
    expect(apiMigration).toContain('p_series_number text');
    expect(apiMigration).toContain('bt.series_name');
    expect(apiMigration).toContain('bt.series_number');
  });

  it('stores only invitation hashes and keeps photos private', () => {
    expect(schemaMigration).toContain('token_hash text not null unique');
    expect(apiMigration).toContain("extensions.digest(v_token, 'sha256')");
    expect(apiMigration).toContain('Invitation must be issued to a parent email');
    expect(apiMigration).toContain('recipient_email is distinct from v_user_email');
    expect(apiMigration).toContain('use_count >= v_invitation.maximum_uses');
    expect(photoMigration).toMatch(/'book-photos',[\s\S]*?false,/);
    expect(photoMigration).toContain('private.can_read_book_photo_path(name)');
    expect(photoMigration).toContain('private.can_manage_book_photo_path(name)');
  });

  it('reveals WhatsApp only through the active-loan contact function', () => {
    expect(schemaMigration).not.toMatch(/grant select[^;]*whatsapp_e164[^;]*families/i);
    expect(apiMigration).toContain('create or replace function public.get_handover_contact');
    expect(apiMigration).toContain('share_whatsapp_during_active_loan');
    expect(apiMigration).toContain(
      "'handover_ready', 'awaiting_receipt', 'borrowed', 'return_pending'",
    );
  });

  it('pins every security-definer function to an empty search path', () => {
    const migrations = `${schemaMigration}\n${photoMigration}\n${apiMigration}`;
    const securityDefiners = migrations.match(/security definer/gi) ?? [];
    const pinnedSearchPaths = migrations.match(/security definer\s+set search_path = ''/gi) ?? [];
    expect(securityDefiners.length).toBeGreaterThan(10);
    expect(pinnedSearchPaths).toHaveLength(securityDefiners.length);
  });
});
