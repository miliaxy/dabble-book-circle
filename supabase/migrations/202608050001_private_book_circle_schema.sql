-- Dabble Book Circle: private, parent-managed data model.
-- Run this only in the dedicated Book Circle Supabase project.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema private revoke execute on functions from public;

create type public.family_role as enum ('owner', 'caregiver');
create type public.membership_status as enum ('active', 'suspended', 'left');
create type public.community_role as enum ('admin', 'member');
create type public.community_status as enum ('pilot', 'active', 'archived');
create type public.book_copy_status as enum ('active', 'archived');
create type public.book_listing_status as enum ('active', 'removed');
create type public.borrow_request_status as enum ('waiting', 'accepted', 'cancelled', 'declined', 'expired');
create type public.loan_status as enum (
  'handover_ready',
  'awaiting_receipt',
  'borrowed',
  'return_pending',
  'feedback_pending',
  'completed',
  'cancelled'
);
create type public.age_band as enum ('age_3_5', 'age_6_8', 'age_9_12', 'age_13_plus');
create type public.book_category as enum (
  'picture_book',
  'early_reader',
  'chapter_book',
  'comic_graphic_novel',
  'mythology',
  'science_nature',
  'general_knowledge'
);
create type public.book_language as enum ('english', 'hindi', 'bilingual', 'other');
create type public.book_condition as enum ('like_new', 'good', 'well_loved');
create type public.return_condition as enum ('same_condition', 'minor_additional_wear', 'material_damage');
create type public.notification_kind as enum (
  'queue_joined',
  'request_accepted',
  'request_declined',
  'handover_ready',
  'receipt_confirmed',
  'due_reminder',
  'return_marked',
  'return_confirmed',
  'feedback_recorded',
  'loan_cancelled'
);

create table public.parent_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 100),
  whatsapp_e164 text check (whatsapp_e164 is null or whatsapp_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  share_whatsapp_during_active_loan boolean not null default true,
  email_reminders boolean not null default true,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

create table public.families (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (char_length(btrim(display_name)) between 2 and 80),
  created_by uuid not null references auth.users(id) on delete restrict,
  status public.membership_status not null default 'active',
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

create table public.family_memberships (
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.family_role not null default 'owner',
  status public.membership_status not null default 'active',
  joined_at timestamptz not null default statement_timestamp(),
  primary key (family_id, user_id)
);

create unique index family_memberships_one_active_family_per_user
  on public.family_memberships(user_id)
  where status = 'active';
create index family_memberships_family_status_idx
  on public.family_memberships(family_id, status);

create table public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 3 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  location_label text not null check (char_length(btrim(location_label)) between 2 and 120),
  status public.community_status not null default 'pilot',
  invite_only boolean not null default true,
  maximum_loan_days smallint not null default 7 check (maximum_loan_days = 7),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

create table public.community_memberships (
  community_id uuid not null references public.communities(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  role public.community_role not null default 'member',
  status public.membership_status not null default 'active',
  joined_at timestamptz not null default statement_timestamp(),
  invited_by uuid references auth.users(id) on delete set null,
  primary key (community_id, family_id)
);

create index community_memberships_family_status_idx
  on public.community_memberships(family_id, status, community_id);
create index community_memberships_community_status_idx
  on public.community_memberships(community_id, status, family_id);

create table public.community_invitations (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  recipient_email text check (
    recipient_email is null
    or recipient_email = lower(recipient_email)
  ),
  expires_at timestamptz not null,
  maximum_uses smallint not null default 1 check (maximum_uses = 1),
  use_count smallint not null default 0 check (use_count between 0 and maximum_uses),
  revoked_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  last_used_at timestamptz,
  check (expires_at > created_at)
);

create index community_invitations_admin_idx
  on public.community_invitations(community_id, created_at desc);

create table public.book_titles (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 240),
  author text not null default '' check (char_length(author) <= 200),
  description text not null default '' check (char_length(description) <= 2000),
  isbn_normalized text check (isbn_normalized is null or isbn_normalized ~ '^[0-9X]{10,13}$'),
  goodreads_url text check (
    goodreads_url is null
    or goodreads_url ~ '^https://(www\.)?goodreads\.com/'
  ),
  metadata_source text not null default 'parent' check (
    metadata_source in ('parent', 'google_books', 'open_library')
  ),
  metadata_confirmed_at timestamptz not null default statement_timestamp(),
  created_by_family_id uuid references public.families(id) on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

create unique index book_titles_unique_isbn_idx
  on public.book_titles(isbn_normalized)
  where isbn_normalized is not null;
create index book_titles_search_idx
  on public.book_titles using gin (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(author, ''))
  );

create table public.book_copies (
  id uuid primary key default gen_random_uuid(),
  book_title_id uuid not null references public.book_titles(id) on delete restrict,
  owner_family_id uuid not null references public.families(id) on delete restrict,
  age_band public.age_band not null,
  category public.book_category not null,
  language public.book_language not null,
  condition public.book_condition not null,
  photo_path text,
  status public.book_copy_status not null default 'active',
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (id, owner_family_id)
);

create index book_copies_owner_status_idx
  on public.book_copies(owner_family_id, status, created_at desc);
create index book_copies_title_idx on public.book_copies(book_title_id);
create unique index book_copies_photo_path_unique_idx
  on public.book_copies(photo_path)
  where photo_path is not null;

create table public.book_listings (
  id uuid primary key default gen_random_uuid(),
  book_copy_id uuid not null references public.book_copies(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  is_lendable boolean not null default true,
  status public.book_listing_status not null default 'active',
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  removed_at timestamptz,
  unique (book_copy_id, community_id),
  unique (id, book_copy_id)
);

create index book_listings_community_catalog_idx
  on public.book_listings(community_id, status, is_lendable, created_at desc);

create table public.borrow_requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null,
  book_copy_id uuid not null,
  borrower_family_id uuid not null references public.families(id) on delete restrict,
  status public.borrow_request_status not null default 'waiting',
  requested_at timestamptz not null default statement_timestamp(),
  accepted_at timestamptz,
  cancelled_at timestamptz,
  declined_at timestamptz,
  declined_by_family_id uuid references public.families(id) on delete restrict,
  decline_reason text check (decline_reason is null or char_length(btrim(decline_reason)) between 3 and 240),
  foreign key (listing_id, book_copy_id)
    references public.book_listings(id, book_copy_id) on delete restrict
);

create unique index borrow_requests_one_waiting_per_family_copy_idx
  on public.borrow_requests(book_copy_id, borrower_family_id)
  where status = 'waiting';
create index borrow_requests_global_fifo_idx
  on public.borrow_requests(book_copy_id, status, requested_at, id);
create index borrow_requests_borrower_idx
  on public.borrow_requests(borrower_family_id, status, requested_at desc);

create table public.loans (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.borrow_requests(id) on delete restrict,
  listing_id uuid not null,
  book_copy_id uuid not null,
  community_id uuid not null references public.communities(id) on delete restrict,
  lender_family_id uuid not null references public.families(id) on delete restrict,
  borrower_family_id uuid not null references public.families(id) on delete restrict,
  status public.loan_status not null default 'handover_ready',
  accepted_at timestamptz not null default statement_timestamp(),
  handed_over_at timestamptz,
  received_at timestamptz,
  due_at timestamptz,
  borrower_marked_returned_at timestamptz,
  lender_confirmed_returned_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  updated_at timestamptz not null default statement_timestamp(),
  foreign key (listing_id, book_copy_id)
    references public.book_listings(id, book_copy_id) on delete restrict,
  foreign key (book_copy_id, lender_family_id)
    references public.book_copies(id, owner_family_id) on delete restrict,
  check (lender_family_id <> borrower_family_id),
  check (
    (received_at is null and due_at is null)
    or (
      received_at is not null
      and due_at is not null
      and due_at >= received_at
      and due_at <= received_at + interval '7 days'
    )
  )
);

create unique index loans_one_active_per_copy_idx
  on public.loans(book_copy_id)
  where status in ('handover_ready', 'awaiting_receipt', 'borrowed', 'return_pending');
create index loans_lender_status_idx
  on public.loans(lender_family_id, status, updated_at desc);
create index loans_borrower_status_idx
  on public.loans(borrower_family_id, status, updated_at desc);
create index loans_due_idx
  on public.loans(due_at)
  where status = 'borrowed';

create table public.loan_feedback (
  loan_id uuid primary key references public.loans(id) on delete restrict,
  borrower_family_id uuid not null references public.families(id) on delete restrict,
  returned_on_time boolean not null,
  return_condition public.return_condition not null,
  submitted_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp()
);

create index loan_feedback_borrower_idx
  on public.loan_feedback(borrower_family_id, created_at desc);

create table private.loan_feedback_notes (
  loan_id uuid primary key references public.loan_feedback(loan_id) on delete cascade,
  lender_family_id uuid not null references public.families(id) on delete restrict,
  private_note text not null check (char_length(private_note) between 1 and 1000),
  created_at timestamptz not null default statement_timestamp()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_family_id uuid not null references public.families(id) on delete cascade,
  kind public.notification_kind not null,
  entity_type text not null check (entity_type in ('request', 'loan', 'book')),
  entity_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default statement_timestamp(),
  read_at timestamptz
);

create index notifications_recipient_unread_idx
  on public.notifications(recipient_family_id, created_at desc)
  where read_at is null;

create table private.audit_events (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_family_id uuid references public.families(id) on delete set null,
  community_id uuid references public.communities(id) on delete set null,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default statement_timestamp()
);

create index audit_events_entity_idx
  on private.audit_events(entity_type, entity_id, created_at desc);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

create trigger parent_profiles_set_updated_at
before update on public.parent_profiles
for each row execute function private.set_updated_at();
create trigger families_set_updated_at
before update on public.families
for each row execute function private.set_updated_at();
create trigger communities_set_updated_at
before update on public.communities
for each row execute function private.set_updated_at();
create trigger book_titles_set_updated_at
before update on public.book_titles
for each row execute function private.set_updated_at();
create trigger book_copies_set_updated_at
before update on public.book_copies
for each row execute function private.set_updated_at();
create trigger book_listings_set_updated_at
before update on public.book_listings
for each row execute function private.set_updated_at();
create trigger loans_set_updated_at
before update on public.loans
for each row execute function private.set_updated_at();

create or replace function private.current_family_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select fm.family_id
  from public.family_memberships fm
  where fm.user_id = (select auth.uid())
    and fm.status = 'active'
  order by fm.joined_at, fm.family_id
  limit 1
$$;

create or replace function private.is_family_member(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.family_memberships fm
    where fm.user_id = (select auth.uid())
      and fm.family_id = p_family_id
      and fm.status = 'active'
  )
$$;

create or replace function private.is_current_community_member(p_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.family_memberships fm
    join public.community_memberships cm on cm.family_id = fm.family_id
    join public.communities c on c.id = cm.community_id
    where fm.user_id = (select auth.uid())
      and fm.status = 'active'
      and cm.community_id = p_community_id
      and cm.status = 'active'
      and c.status <> 'archived'
  )
$$;

create or replace function private.is_community_admin(p_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.family_memberships fm
    join public.community_memberships cm on cm.family_id = fm.family_id
    join public.communities c on c.id = cm.community_id
    where fm.user_id = (select auth.uid())
      and fm.status = 'active'
      and cm.community_id = p_community_id
      and cm.status = 'active'
      and cm.role = 'admin'
      and c.status <> 'archived'
  )
$$;

create or replace function private.can_view_family(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_family_member(p_family_id) or exists (
    select 1
    from public.community_memberships target_cm
    join public.community_memberships current_cm
      on current_cm.community_id = target_cm.community_id
    join public.communities c on c.id = target_cm.community_id
    where target_cm.family_id = p_family_id
      and target_cm.status = 'active'
      and current_cm.family_id = private.current_family_id()
      and current_cm.status = 'active'
      and c.status <> 'archived'
  )
$$;

create or replace function private.is_book_owner(p_book_copy_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.book_copies bc
    where bc.id = p_book_copy_id
      and private.is_family_member(bc.owner_family_id)
  )
$$;

create or replace function private.can_view_book_title(p_book_title_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.book_copies bc
    left join public.book_listings bl on bl.book_copy_id = bc.id
    where bc.book_title_id = p_book_title_id
      and (
        private.is_family_member(bc.owner_family_id)
        or (
          bl.status = 'active'
          and private.is_current_community_member(bl.community_id)
        )
      )
  )
$$;

create or replace function private.can_access_loan(p_loan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.loans l
    where l.id = p_loan_id
      and (
        private.is_family_member(l.lender_family_id)
        or private.is_family_member(l.borrower_family_id)
        or private.is_community_admin(l.community_id)
      )
  )
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;
revoke all on function private.current_family_id() from public, anon;
revoke all on function private.is_family_member(uuid) from public, anon;
revoke all on function private.is_current_community_member(uuid) from public, anon;
revoke all on function private.is_community_admin(uuid) from public, anon;
revoke all on function private.can_view_family(uuid) from public, anon;
revoke all on function private.is_book_owner(uuid) from public, anon;
revoke all on function private.can_view_book_title(uuid) from public, anon;
revoke all on function private.can_access_loan(uuid) from public, anon;

grant execute on function private.current_family_id() to authenticated;
grant execute on function private.is_family_member(uuid) to authenticated;
grant execute on function private.is_current_community_member(uuid) to authenticated;
grant execute on function private.is_community_admin(uuid) to authenticated;
grant execute on function private.can_view_family(uuid) to authenticated;
grant execute on function private.is_book_owner(uuid) to authenticated;
grant execute on function private.can_view_book_title(uuid) to authenticated;
grant execute on function private.can_access_loan(uuid) to authenticated;

alter table public.parent_profiles enable row level security;
alter table public.families enable row level security;
alter table public.family_memberships enable row level security;
alter table public.communities enable row level security;
alter table public.community_memberships enable row level security;
alter table public.community_invitations enable row level security;
alter table public.book_titles enable row level security;
alter table public.book_copies enable row level security;
alter table public.book_listings enable row level security;
alter table public.borrow_requests enable row level security;
alter table public.loans enable row level security;
alter table public.loan_feedback enable row level security;
alter table public.notifications enable row level security;

create policy parent_profiles_select_self
on public.parent_profiles for select to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()));

create policy parent_profiles_update_self
on public.parent_profiles for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy families_select_shared_circle
on public.families for select to authenticated
using (private.can_view_family(id));

create policy family_memberships_select_own_family
on public.family_memberships for select to authenticated
using (private.is_family_member(family_id));

create policy communities_select_memberships
on public.communities for select to authenticated
using (private.is_current_community_member(id));

create policy community_memberships_select_circle
on public.community_memberships for select to authenticated
using (private.is_current_community_member(community_id));

create policy community_invitations_select_admin
on public.community_invitations for select to authenticated
using (private.is_community_admin(community_id));

create policy book_titles_select_circle_catalog
on public.book_titles for select to authenticated
using (private.can_view_book_title(id));

create policy book_copies_select_owner_or_circle
on public.book_copies for select to authenticated
using (
  private.is_family_member(owner_family_id)
  or exists (
    select 1
    from public.book_listings bl
    where bl.book_copy_id = id
      and bl.status = 'active'
      and private.is_current_community_member(bl.community_id)
  )
);

create policy book_listings_select_circle
on public.book_listings for select to authenticated
using (
  private.is_book_owner(book_copy_id)
  or (status = 'active' and private.is_current_community_member(community_id))
);

create policy borrow_requests_select_participants
on public.borrow_requests for select to authenticated
using (
  private.is_family_member(borrower_family_id)
  or private.is_book_owner(book_copy_id)
  or private.is_community_admin((
    select bl.community_id from public.book_listings bl where bl.id = listing_id
  ))
);

create policy loans_select_participants
on public.loans for select to authenticated
using (
  private.is_family_member(lender_family_id)
  or private.is_family_member(borrower_family_id)
  or private.is_community_admin(community_id)
);

create policy loan_feedback_select_participants
on public.loan_feedback for select to authenticated
using (private.can_access_loan(loan_id));

create policy notifications_select_own_family
on public.notifications for select to authenticated
using (private.is_family_member(recipient_family_id));

create policy notifications_mark_read_own_family
on public.notifications for update to authenticated
using (private.is_family_member(recipient_family_id))
with check (private.is_family_member(recipient_family_id));

revoke all on table public.parent_profiles from anon, authenticated;
revoke all on table public.families from anon, authenticated;
revoke all on table public.family_memberships from anon, authenticated;
revoke all on table public.communities from anon, authenticated;
revoke all on table public.community_memberships from anon, authenticated;
revoke all on table public.community_invitations from anon, authenticated;
revoke all on table public.book_titles from anon, authenticated;
revoke all on table public.book_copies from anon, authenticated;
revoke all on table public.book_listings from anon, authenticated;
revoke all on table public.borrow_requests from anon, authenticated;
revoke all on table public.loans from anon, authenticated;
revoke all on table public.loan_feedback from anon, authenticated;
revoke all on table public.notifications from anon, authenticated;

grant select on table public.parent_profiles to authenticated;
grant update (full_name, whatsapp_e164, share_whatsapp_during_active_loan, email_reminders)
  on table public.parent_profiles to authenticated;
grant select (id, display_name, status, created_at, updated_at)
  on table public.families to authenticated;
grant select (family_id, role, status, joined_at)
  on table public.family_memberships to authenticated;
grant select on table public.communities to authenticated;
grant select (community_id, family_id, role, status, joined_at)
  on table public.community_memberships to authenticated;
grant select (id, community_id, recipient_email, expires_at, maximum_uses, use_count, revoked_at, created_at, last_used_at)
  on table public.community_invitations to authenticated;
grant select on table public.book_titles to authenticated;
grant select on table public.book_copies to authenticated;
grant select on table public.book_listings to authenticated;
grant select on table public.borrow_requests to authenticated;
grant select on table public.loans to authenticated;
grant select (loan_id, borrower_family_id, returned_on_time, return_condition, created_at)
  on table public.loan_feedback to authenticated;
grant select on table public.notifications to authenticated;
grant update (read_at) on table public.notifications to authenticated;

create view public.community_invitation_summaries
with (security_invoker = true)
as
select
  id,
  community_id,
  recipient_email,
  expires_at,
  maximum_uses,
  use_count,
  revoked_at,
  created_at,
  last_used_at
from public.community_invitations;

revoke all on table public.community_invitation_summaries from anon, authenticated;
grant select on table public.community_invitation_summaries to authenticated;
