-- Atomic Book Circle operations. Browser clients receive EXECUTE only on these
-- functions; direct writes to workflow tables remain blocked.

create or replace function private.record_audit(
  p_event_type text,
  p_entity_type text,
  p_entity_id uuid,
  p_community_id uuid default null,
  p_details jsonb default '{}'::jsonb
)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into private.audit_events (
    actor_user_id,
    actor_family_id,
    community_id,
    event_type,
    entity_type,
    entity_id,
    details
  )
  values (
    (select auth.uid()),
    private.current_family_id(),
    p_community_id,
    p_event_type,
    p_entity_type,
    p_entity_id,
    coalesce(p_details, '{}'::jsonb)
  )
$$;

create or replace function private.create_notification(
  p_recipient_family_id uuid,
  p_kind public.notification_kind,
  p_entity_type text,
  p_entity_id uuid,
  p_payload jsonb default '{}'::jsonb
)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.notifications (
    recipient_family_id,
    kind,
    entity_type,
    entity_id,
    payload
  )
  values (
    p_recipient_family_id,
    p_kind,
    p_entity_type,
    p_entity_id,
    coalesce(p_payload, '{}'::jsonb)
  )
$$;

revoke all on function private.record_audit(text, text, uuid, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function private.create_notification(uuid, public.notification_kind, text, uuid, jsonb)
  from public, anon, authenticated;

create or replace function public.bootstrap_parent(
  p_full_name text,
  p_family_display_name text,
  p_whatsapp_e164 text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_family_id uuid;
  v_phone text := nullif(btrim(p_whatsapp_e164), '');
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if char_length(btrim(p_full_name)) not between 2 and 100 then
    raise exception 'Parent name must be between 2 and 100 characters';
  end if;
  if char_length(btrim(p_family_display_name)) not between 2 and 80 then
    raise exception 'Family display name must be between 2 and 80 characters';
  end if;
  if v_phone is not null and v_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'WhatsApp number must use E.164 format';
  end if;

  insert into public.parent_profiles (user_id, full_name, whatsapp_e164)
  values (v_user_id, btrim(p_full_name), v_phone)
  on conflict (user_id) do nothing;

  select fm.family_id
  into v_family_id
  from public.family_memberships fm
  where fm.user_id = v_user_id
    and fm.status = 'active'
  limit 1;

  if v_family_id is null then
    insert into public.families (display_name, created_by)
    values (btrim(p_family_display_name), v_user_id)
    returning id into v_family_id;

    insert into public.family_memberships (family_id, user_id, role)
    values (v_family_id, v_user_id, 'owner');

    perform private.record_audit(
      'parent_bootstrapped',
      'family',
      v_family_id,
      null,
      '{}'::jsonb
    );
  end if;

  return v_family_id;
end;
$$;

create or replace function public.create_circle_invitation(
  p_community_id uuid,
  p_recipient_email text default null,
  p_expires_at timestamptz default statement_timestamp() + interval '7 days'
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_token text;
  v_invitation_id uuid;
  v_email text := nullif(lower(btrim(p_recipient_email)), '');
begin
  if not private.is_community_admin(p_community_id) then
    raise exception 'Circle administrator access required' using errcode = '42501';
  end if;
  if p_expires_at <= statement_timestamp()
    or p_expires_at > statement_timestamp() + interval '30 days' then
    raise exception 'Invitation expiry must be within the next 30 days';
  end if;
  if v_email is null then
    raise exception 'Invitation must be issued to a parent email';
  end if;
  if v_email is not null and v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Recipient email is not valid';
  end if;

  -- Reissuing an invitation invalidates older unused codes for this email.
  update public.community_invitations ci
  set revoked_at = statement_timestamp()
  where ci.community_id = p_community_id
    and ci.recipient_email = v_email
    and ci.revoked_at is null
    and ci.use_count = 0;

  v_token := 'dbc_' || encode(extensions.gen_random_bytes(24), 'hex');

  insert into public.community_invitations (
    community_id,
    token_hash,
    recipient_email,
    expires_at,
    created_by
  )
  values (
    p_community_id,
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    v_email,
    p_expires_at,
    (select auth.uid())
  )
  returning id into v_invitation_id;

  perform private.record_audit(
    'invitation_created',
    'invitation',
    v_invitation_id,
    p_community_id,
    jsonb_build_object('email_bound', v_email is not null, 'expires_at', p_expires_at)
  );

  -- This plaintext token is returned once and is never stored.
  return v_token;
end;
$$;

create or replace function public.redeem_circle_invitation(p_token text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_family_id uuid := private.current_family_id();
  v_user_email text;
  v_invitation public.community_invitations%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if v_family_id is null then
    raise exception 'Create the parent family profile before joining a circle';
  end if;
  if nullif(btrim(p_token), '') is null then
    raise exception 'Invitation code is required';
  end if;

  select *
  into v_invitation
  from public.community_invitations ci
  where ci.token_hash = encode(
    extensions.digest(lower(btrim(p_token)), 'sha256'),
    'hex'
  )
  for update;

  if not found
    or v_invitation.revoked_at is not null
    or v_invitation.expires_at <= statement_timestamp()
    or v_invitation.use_count >= v_invitation.maximum_uses then
    raise exception 'Invitation is invalid, expired, or already used' using errcode = '22023';
  end if;

  select lower(u.email)
  into v_user_email
  from auth.users u
  where u.id = v_user_id;

  if v_invitation.recipient_email is not null
    and v_invitation.recipient_email is distinct from v_user_email then
    raise exception 'Invitation was issued to a different email address' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.communities c
    where c.id = v_invitation.community_id and c.status = 'archived'
  ) then
    raise exception 'This circle is no longer accepting members' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.community_memberships cm
    where cm.community_id = v_invitation.community_id
      and cm.family_id = v_family_id
      and cm.status = 'active'
  ) then
    return v_invitation.community_id;
  end if;

  insert into public.community_memberships (
    community_id,
    family_id,
    role,
    status,
    invited_by
  )
  values (
    v_invitation.community_id,
    v_family_id,
    'member',
    'active',
    v_invitation.created_by
  )
  on conflict (community_id, family_id) do update
  set
    status = 'active',
    role = 'member',
    joined_at = statement_timestamp(),
    invited_by = excluded.invited_by;

  update public.community_invitations
  set
    use_count = use_count + 1,
    last_used_at = statement_timestamp()
  where id = v_invitation.id;

  perform private.record_audit(
    'invitation_redeemed',
    'invitation',
    v_invitation.id,
    v_invitation.community_id,
    '{}'::jsonb
  );

  return v_invitation.community_id;
end;
$$;

create or replace function public.create_book_listing(
  p_community_id uuid,
  p_title text,
  p_author text,
  p_description text,
  p_series_name text,
  p_series_number text,
  p_isbn text,
  p_goodreads_url text,
  p_metadata_source text,
  p_age_band public.age_band,
  p_category public.book_category,
  p_language public.book_language,
  p_condition public.book_condition,
  p_photo_path text default null
)
returns table (book_copy_id uuid, listing_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_family_id uuid := private.current_family_id();
  v_book_title_id uuid;
  v_book_copy_id uuid;
  v_listing_id uuid;
  v_isbn text := nullif(upper(regexp_replace(coalesce(p_isbn, ''), '[^0-9X]', '', 'g')), '');
  v_photo_path text := nullif(btrim(p_photo_path), '');
begin
  if v_family_id is null or not private.is_current_community_member(p_community_id) then
    raise exception 'Active circle membership required' using errcode = '42501';
  end if;
  if char_length(btrim(p_title)) not between 1 and 240 then
    raise exception 'Book title is required';
  end if;
  if char_length(coalesce(p_author, '')) > 200
    or char_length(coalesce(p_description, '')) > 2000
    or char_length(coalesce(p_series_name, '')) > 200
    or char_length(coalesce(p_series_number, '')) > 40 then
    raise exception 'Book metadata is too long';
  end if;
  if v_isbn is not null and v_isbn !~ '^[0-9X]{10,13}$' then
    raise exception 'ISBN must contain 10 or 13 digits';
  end if;
  if p_metadata_source not in ('parent', 'google_books', 'open_library') then
    raise exception 'Metadata source is not supported';
  end if;
  if nullif(btrim(p_goodreads_url), '') is not null
    and btrim(p_goodreads_url) !~ '^https://(www\.)?goodreads\.com/' then
    raise exception 'Goodreads link must use goodreads.com';
  end if;
  if v_photo_path is not null and (
    not private.can_manage_book_photo_path(v_photo_path)
    or not exists (
      select 1
      from storage.objects so
      where so.bucket_id = 'book-photos' and so.name = v_photo_path
    )
  ) then
    raise exception 'Book photo path is not accessible to this family';
  end if;

  if v_isbn is not null then
    insert into public.book_titles (
      title,
      author,
      description,
      series_name,
      series_number,
      isbn_normalized,
      goodreads_url,
      metadata_source,
      created_by_family_id
    )
    values (
      btrim(p_title),
      btrim(coalesce(p_author, '')),
      btrim(coalesce(p_description, '')),
      nullif(btrim(p_series_name), ''),
      nullif(btrim(p_series_number), ''),
      v_isbn,
      nullif(btrim(p_goodreads_url), ''),
      p_metadata_source,
      v_family_id
    )
    on conflict (isbn_normalized) where isbn_normalized is not null
    do update set
      isbn_normalized = excluded.isbn_normalized,
      series_name = coalesce(public.book_titles.series_name, excluded.series_name),
      series_number = coalesce(public.book_titles.series_number, excluded.series_number)
    returning id into v_book_title_id;
  else
    insert into public.book_titles (
      title,
      author,
      description,
      series_name,
      series_number,
      goodreads_url,
      metadata_source,
      created_by_family_id
    )
    values (
      btrim(p_title),
      btrim(coalesce(p_author, '')),
      btrim(coalesce(p_description, '')),
      nullif(btrim(p_series_name), ''),
      nullif(btrim(p_series_number), ''),
      nullif(btrim(p_goodreads_url), ''),
      p_metadata_source,
      v_family_id
    )
    returning id into v_book_title_id;
  end if;

  insert into public.book_copies (
    book_title_id,
    owner_family_id,
    age_band,
    category,
    language,
    condition,
    photo_path
  )
  values (
    v_book_title_id,
    v_family_id,
    p_age_band,
    p_category,
    p_language,
    p_condition,
    v_photo_path
  )
  returning id into v_book_copy_id;

  insert into public.book_listings (book_copy_id, community_id)
  values (v_book_copy_id, p_community_id)
  returning id into v_listing_id;

  perform private.record_audit(
    'book_listed',
    'book_copy',
    v_book_copy_id,
    p_community_id,
    jsonb_build_object('listing_id', v_listing_id)
  );

  return query select v_book_copy_id, v_listing_id;
end;
$$;

create or replace function public.attach_book_photo(
  p_book_copy_id uuid,
  p_photo_path text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_copy public.book_copies%rowtype;
  v_path text := nullif(btrim(p_photo_path), '');
begin
  select * into v_copy
  from public.book_copies bc
  where bc.id = p_book_copy_id
  for update;

  if not found or not private.is_family_member(v_copy.owner_family_id) then
    raise exception 'Book owner access required' using errcode = '42501';
  end if;
  if v_path is null
    or not private.can_manage_book_photo_path(v_path)
    or not exists (
      select 1 from storage.objects so
      where so.bucket_id = 'book-photos' and so.name = v_path
    ) then
    raise exception 'Book photo path is not accessible to this family';
  end if;

  update public.book_copies
  set photo_path = v_path
  where id = p_book_copy_id;

  perform private.record_audit('book_photo_attached', 'book_copy', p_book_copy_id);
end;
$$;

create or replace function public.set_listing_lendable(
  p_listing_id uuid,
  p_is_lendable boolean
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_listing public.book_listings%rowtype;
begin
  select * into v_listing
  from public.book_listings bl
  where bl.id = p_listing_id
  for update;

  if not found or not private.is_book_owner(v_listing.book_copy_id) then
    raise exception 'Book owner access required' using errcode = '42501';
  end if;
  if not private.is_current_community_member(v_listing.community_id) then
    raise exception 'Active circle membership required' using errcode = '42501';
  end if;

  update public.book_listings
  set is_lendable = p_is_lendable
  where id = p_listing_id;

  perform private.record_audit(
    case when p_is_lendable then 'book_lending_resumed' else 'book_lending_paused' end,
    'listing',
    p_listing_id,
    v_listing.community_id
  );
end;
$$;

create or replace function public.request_book(p_listing_id uuid)
returns table (request_id uuid, queue_position integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_family_id uuid := private.current_family_id();
  v_listing public.book_listings%rowtype;
  v_copy public.book_copies%rowtype;
  v_request_id uuid;
  v_position integer;
begin
  if v_family_id is null then
    raise exception 'Parent family profile required' using errcode = '42501';
  end if;

  select * into v_listing
  from public.book_listings bl
  where bl.id = p_listing_id
  for share;

  if not found
    or v_listing.status <> 'active'
    or not v_listing.is_lendable
    or not private.is_current_community_member(v_listing.community_id) then
    raise exception 'Book is not available to request in this circle';
  end if;

  select * into v_copy
  from public.book_copies bc
  where bc.id = v_listing.book_copy_id
  for share;

  if v_copy.status <> 'active' then
    raise exception 'Book is not active';
  end if;
  if v_copy.owner_family_id = v_family_id then
    raise exception 'A family cannot borrow its own book';
  end if;

  insert into public.borrow_requests (
    listing_id,
    book_copy_id,
    borrower_family_id
  )
  values (v_listing.id, v_copy.id, v_family_id)
  returning id into v_request_id;

  select count(*)::integer
  into v_position
  from public.borrow_requests br
  where br.book_copy_id = v_copy.id
    and br.status = 'waiting'
    and (
      br.requested_at < (select requested_at from public.borrow_requests where id = v_request_id)
      or (
        br.requested_at = (select requested_at from public.borrow_requests where id = v_request_id)
        and br.id <= v_request_id
      )
    );

  perform private.create_notification(
    v_copy.owner_family_id,
    'queue_joined',
    'request',
    v_request_id,
    jsonb_build_object('book_copy_id', v_copy.id)
  );
  perform private.record_audit(
    'book_requested',
    'request',
    v_request_id,
    v_listing.community_id,
    jsonb_build_object('queue_position', v_position)
  );

  return query select v_request_id, v_position;
exception
  when unique_violation then
    raise exception 'This family is already waiting for this book' using errcode = '23505';
end;
$$;

create or replace function public.cancel_book_request(p_request_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_request public.borrow_requests%rowtype;
  v_community_id uuid;
begin
  select * into v_request
  from public.borrow_requests br
  where br.id = p_request_id
  for update;

  if not found or not private.is_family_member(v_request.borrower_family_id) then
    raise exception 'Borrower family access required' using errcode = '42501';
  end if;
  if v_request.status <> 'waiting' then
    raise exception 'Only a waiting request can be cancelled';
  end if;

  update public.borrow_requests
  set status = 'cancelled', cancelled_at = statement_timestamp()
  where id = p_request_id;

  select bl.community_id into v_community_id
  from public.book_listings bl where bl.id = v_request.listing_id;

  perform private.record_audit(
    'request_cancelled',
    'request',
    p_request_id,
    v_community_id
  );
end;
$$;

create or replace function public.decline_book_request(p_request_id uuid, p_reason text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_request public.borrow_requests%rowtype;
  v_owner_family_id uuid;
  v_community_id uuid;
  v_reason text := nullif(btrim(p_reason), '');
begin
  select * into v_request
  from public.borrow_requests br
  where br.id = p_request_id
  for update;

  if not found then
    raise exception 'Borrow request not found';
  end if;

  select bc.owner_family_id, bl.community_id
  into v_owner_family_id, v_community_id
  from public.book_copies bc
  join public.book_listings bl
    on bl.book_copy_id = bc.id and bl.id = v_request.listing_id
  where bc.id = v_request.book_copy_id;

  if v_owner_family_id is null or not private.is_family_member(v_owner_family_id) then
    raise exception 'Book owner access required' using errcode = '42501';
  end if;
  if v_request.status <> 'waiting' then
    raise exception 'Only a waiting request can be declined';
  end if;
  if v_reason is null or char_length(v_reason) < 3 or char_length(v_reason) > 240 then
    raise exception 'A decline reason between 3 and 240 characters is required';
  end if;

  update public.borrow_requests
  set status = 'declined',
      declined_at = statement_timestamp(),
      declined_by_family_id = v_owner_family_id,
      decline_reason = v_reason
  where id = p_request_id;

  perform private.create_notification(
    v_request.borrower_family_id,
    'request_declined',
    'request',
    p_request_id,
    jsonb_build_object('book_copy_id', v_request.book_copy_id, 'reason', v_reason)
  );
  perform private.record_audit(
    'request_declined',
    'request',
    p_request_id,
    v_community_id
  );
end;
$$;

create or replace function public.accept_next_request(p_listing_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_listing public.book_listings%rowtype;
  v_copy public.book_copies%rowtype;
  v_request public.borrow_requests%rowtype;
  v_request_community_id uuid;
  v_loan_id uuid;
begin
  select * into v_listing
  from public.book_listings bl
  where bl.id = p_listing_id;

  if not found or not private.is_book_owner(v_listing.book_copy_id) then
    raise exception 'Book owner access required' using errcode = '42501';
  end if;

  select * into v_copy
  from public.book_copies bc
  where bc.id = v_listing.book_copy_id
  for update;

  if v_copy.status <> 'active' then
    raise exception 'Book is not active';
  end if;
  if exists (
    select 1 from public.loans l
    where l.book_copy_id = v_copy.id
      and l.status in ('handover_ready', 'awaiting_receipt', 'borrowed', 'return_pending')
  ) then
    raise exception 'Book already has an active loan';
  end if;

  select br, bl.community_id
  into v_request, v_request_community_id
  from public.borrow_requests br
  join public.book_listings bl
    on bl.id = br.listing_id and bl.book_copy_id = br.book_copy_id
  join public.community_memberships cm
    on cm.community_id = bl.community_id
   and cm.family_id = br.borrower_family_id
   and cm.status = 'active'
  where br.book_copy_id = v_copy.id
    and br.status = 'waiting'
    and bl.status = 'active'
    and bl.is_lendable
  order by br.requested_at, br.id
  limit 1
  for update of br;

  if not found then
    raise exception 'No eligible waiting request for this book';
  end if;

  update public.borrow_requests
  set status = 'accepted', accepted_at = statement_timestamp()
  where id = v_request.id;

  insert into public.loans (
    request_id,
    listing_id,
    book_copy_id,
    community_id,
    lender_family_id,
    borrower_family_id,
    status
  )
  values (
    v_request.id,
    v_request.listing_id,
    v_request.book_copy_id,
    v_request_community_id,
    v_copy.owner_family_id,
    v_request.borrower_family_id,
    'handover_ready'
  )
  returning id into v_loan_id;

  perform private.create_notification(
    v_request.borrower_family_id,
    'request_accepted',
    'loan',
    v_loan_id,
    jsonb_build_object('book_copy_id', v_copy.id)
  );
  perform private.record_audit(
    'request_accepted',
    'loan',
    v_loan_id,
    v_request_community_id,
    jsonb_build_object('request_id', v_request.id)
  );

  return v_loan_id;
end;
$$;

create or replace function public.cancel_loan_before_receipt(p_loan_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_loan public.loans%rowtype;
  v_other_family_id uuid;
begin
  select * into v_loan
  from public.loans l
  where l.id = p_loan_id
  for update;

  if not found or not (
    private.is_family_member(v_loan.lender_family_id)
    or private.is_family_member(v_loan.borrower_family_id)
    or private.is_community_admin(v_loan.community_id)
  ) then
    raise exception 'Loan participant access required' using errcode = '42501';
  end if;
  if v_loan.status not in ('handover_ready', 'awaiting_receipt') then
    raise exception 'Only an unreceived handover can be cancelled';
  end if;

  update public.loans
  set status = 'cancelled', cancelled_at = statement_timestamp()
  where id = p_loan_id;

  v_other_family_id := case
    when private.is_family_member(v_loan.lender_family_id) then v_loan.borrower_family_id
    else v_loan.lender_family_id
  end;
  perform private.create_notification(
    v_other_family_id,
    'loan_cancelled',
    'loan',
    p_loan_id,
    '{}'::jsonb
  );
  perform private.record_audit(
    'loan_cancelled_before_receipt',
    'loan',
    p_loan_id,
    v_loan.community_id
  );
end;
$$;

create or replace function public.mark_book_handed_over(p_loan_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_loan public.loans%rowtype;
begin
  select * into v_loan from public.loans l where l.id = p_loan_id for update;
  if not found or not private.is_family_member(v_loan.lender_family_id) then
    raise exception 'Lender family access required' using errcode = '42501';
  end if;
  if v_loan.status <> 'handover_ready' then
    raise exception 'Loan is not ready for handover';
  end if;

  update public.loans
  set status = 'awaiting_receipt', handed_over_at = statement_timestamp()
  where id = p_loan_id;

  perform private.create_notification(
    v_loan.borrower_family_id,
    'handover_ready',
    'loan',
    p_loan_id,
    '{}'::jsonb
  );
  perform private.record_audit('book_handed_over', 'loan', p_loan_id, v_loan.community_id);
end;
$$;

create or replace function public.confirm_book_received(p_loan_id uuid)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_loan public.loans%rowtype;
  v_received_at timestamptz := statement_timestamp();
  v_due_at timestamptz;
begin
  select * into v_loan from public.loans l where l.id = p_loan_id for update;
  if not found or not private.is_family_member(v_loan.borrower_family_id) then
    raise exception 'Borrower family access required' using errcode = '42501';
  end if;
  if v_loan.status <> 'awaiting_receipt' then
    raise exception 'Loan is not awaiting receipt confirmation';
  end if;

  v_due_at := v_received_at + interval '7 days';
  update public.loans
  set
    status = 'borrowed',
    received_at = v_received_at,
    due_at = v_due_at
  where id = p_loan_id;

  perform private.create_notification(
    v_loan.lender_family_id,
    'receipt_confirmed',
    'loan',
    p_loan_id,
    jsonb_build_object('due_at', v_due_at)
  );
  perform private.record_audit(
    'book_received',
    'loan',
    p_loan_id,
    v_loan.community_id,
    jsonb_build_object('due_at', v_due_at)
  );

  return v_due_at;
end;
$$;

create or replace function public.mark_book_returned(p_loan_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_loan public.loans%rowtype;
begin
  select * into v_loan from public.loans l where l.id = p_loan_id for update;
  if not found or not private.is_family_member(v_loan.borrower_family_id) then
    raise exception 'Borrower family access required' using errcode = '42501';
  end if;
  if v_loan.status <> 'borrowed' then
    raise exception 'Only a borrowed book can be marked returned';
  end if;

  update public.loans
  set status = 'return_pending', borrower_marked_returned_at = statement_timestamp()
  where id = p_loan_id;

  perform private.create_notification(
    v_loan.lender_family_id,
    'return_marked',
    'loan',
    p_loan_id,
    '{}'::jsonb
  );
  perform private.record_audit('borrower_marked_returned', 'loan', p_loan_id, v_loan.community_id);
end;
$$;

create or replace function public.confirm_book_returned(p_loan_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_loan public.loans%rowtype;
begin
  select * into v_loan from public.loans l where l.id = p_loan_id for update;
  if not found or not private.is_family_member(v_loan.lender_family_id) then
    raise exception 'Lender family access required' using errcode = '42501';
  end if;
  if v_loan.status <> 'return_pending' then
    raise exception 'Borrower must mark the book returned first';
  end if;

  update public.loans
  set
    status = 'feedback_pending',
    lender_confirmed_returned_at = statement_timestamp()
  where id = p_loan_id;

  perform private.create_notification(
    v_loan.borrower_family_id,
    'return_confirmed',
    'loan',
    p_loan_id,
    '{}'::jsonb
  );
  perform private.record_audit('lender_confirmed_return', 'loan', p_loan_id, v_loan.community_id);
end;
$$;

create or replace function public.submit_loan_feedback(
  p_loan_id uuid,
  p_return_condition public.return_condition,
  p_private_note text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_loan public.loans%rowtype;
  v_note text := nullif(btrim(p_private_note), '');
  v_returned_on_time boolean;
begin
  select * into v_loan from public.loans l where l.id = p_loan_id for update;
  if not found or not private.is_family_member(v_loan.lender_family_id) then
    raise exception 'Lender family access required' using errcode = '42501';
  end if;
  if v_loan.status <> 'feedback_pending' then
    raise exception 'Return must be confirmed before feedback';
  end if;
  if v_note is not null and char_length(v_note) > 1000 then
    raise exception 'Private note must be 1000 characters or fewer';
  end if;

  v_returned_on_time := v_loan.borrower_marked_returned_at <= v_loan.due_at;

  insert into public.loan_feedback (
    loan_id,
    borrower_family_id,
    returned_on_time,
    return_condition,
    submitted_by_user_id
  )
  values (
    p_loan_id,
    v_loan.borrower_family_id,
    v_returned_on_time,
    p_return_condition,
    (select auth.uid())
  );

  if v_note is not null then
    insert into private.loan_feedback_notes (loan_id, lender_family_id, private_note)
    values (p_loan_id, v_loan.lender_family_id, v_note);
  end if;

  update public.loans
  set status = 'completed', completed_at = statement_timestamp()
  where id = p_loan_id;

  perform private.create_notification(
    v_loan.borrower_family_id,
    'feedback_recorded',
    'loan',
    p_loan_id,
    '{}'::jsonb
  );
  perform private.record_audit(
    'feedback_submitted',
    'loan',
    p_loan_id,
    v_loan.community_id,
    jsonb_build_object(
      'returned_on_time', v_returned_on_time,
      'return_condition', p_return_condition,
      'has_private_note', v_note is not null
    )
  );
end;
$$;

create or replace function public.get_queue_position(p_request_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_request public.borrow_requests%rowtype;
  v_position integer;
  v_community_id uuid;
begin
  select * into v_request
  from public.borrow_requests br
  where br.id = p_request_id;

  select bl.community_id into v_community_id
  from public.book_listings bl
  where bl.id = v_request.listing_id;

  if not found or not (
    private.is_family_member(v_request.borrower_family_id)
    or private.is_book_owner(v_request.book_copy_id)
    or private.is_community_admin(v_community_id)
  ) then
    raise exception 'Request participant access required' using errcode = '42501';
  end if;
  if v_request.status <> 'waiting' then
    return null;
  end if;

  select count(*)::integer into v_position
  from public.borrow_requests br
  where br.book_copy_id = v_request.book_copy_id
    and br.status = 'waiting'
    and (
      br.requested_at < v_request.requested_at
      or (br.requested_at = v_request.requested_at and br.id <= v_request.id)
    );

  return v_position;
end;
$$;

create or replace function public.get_handover_contact(p_loan_id uuid)
returns table (counterpart_family_name text, whatsapp_e164 text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_loan public.loans%rowtype;
  v_counterpart_family_id uuid;
begin
  select * into v_loan from public.loans l where l.id = p_loan_id;
  if not found or v_loan.status not in (
    'handover_ready', 'awaiting_receipt', 'borrowed', 'return_pending'
  ) then
    raise exception 'Contact is available only during an active matched loan' using errcode = '42501';
  end if;

  if private.is_family_member(v_loan.lender_family_id) then
    v_counterpart_family_id := v_loan.borrower_family_id;
  elsif private.is_family_member(v_loan.borrower_family_id) then
    v_counterpart_family_id := v_loan.lender_family_id;
  else
    raise exception 'Loan participant access required' using errcode = '42501';
  end if;

  return query
  select
    f.display_name,
    case
      when pp.share_whatsapp_during_active_loan then pp.whatsapp_e164
      else null
    end
  from public.families f
  left join public.family_memberships fm
    on fm.family_id = f.id
   and fm.role = 'owner'
   and fm.status = 'active'
  left join public.parent_profiles pp on pp.user_id = fm.user_id
  where f.id = v_counterpart_family_id
  order by fm.joined_at
  limit 1;
end;
$$;

create or replace function public.get_family_reliability(p_family_id uuid)
returns table (
  completed_loans bigint,
  on_time_returns bigint,
  good_condition_returns bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.can_view_family(p_family_id) then
    raise exception 'Shared circle membership required' using errcode = '42501';
  end if;

  return query
  select
    count(*)::bigint,
    count(*) filter (where lf.returned_on_time)::bigint,
    count(*) filter (
      where lf.return_condition in ('same_condition', 'minor_additional_wear')
    )::bigint
  from public.loan_feedback lf
  where lf.borrower_family_id = p_family_id;
end;
$$;

create or replace function public.list_circle_books(p_community_id uuid)
returns table (
  listing_id uuid,
  book_copy_id uuid,
  book_title_id uuid,
  title text,
  author text,
  description text,
  series_name text,
  series_number text,
  isbn_normalized text,
  goodreads_url text,
  owner_family_id uuid,
  owner_display_name text,
  age_band public.age_band,
  category public.book_category,
  language public.book_language,
  condition public.book_condition,
  photo_path text,
  is_lendable boolean,
  circulation_status text,
  waiting_count bigint,
  listed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_current_community_member(p_community_id) then
    raise exception 'Active circle membership required' using errcode = '42501';
  end if;

  return query
  select
    bl.id,
    bc.id,
    bt.id,
    bt.title,
    bt.author,
    bt.description,
    bt.series_name,
    bt.series_number,
    bt.isbn_normalized,
    bt.goodreads_url,
    bc.owner_family_id,
    f.display_name,
    bc.age_band,
    bc.category,
    bc.language,
    bc.condition,
    bc.photo_path,
    bl.is_lendable,
    case
      when not bl.is_lendable then 'paused'
      when active_loan.status in ('borrowed', 'return_pending') then 'borrowed'
      when active_loan.status in ('handover_ready', 'awaiting_receipt') then 'reserved'
      when request_totals.waiting_count > 0 then 'queued'
      else 'available'
    end,
    request_totals.waiting_count,
    bl.created_at
  from public.book_listings bl
  join public.book_copies bc on bc.id = bl.book_copy_id
  join public.book_titles bt on bt.id = bc.book_title_id
  join public.families f on f.id = bc.owner_family_id
  left join lateral (
    select l.status
    from public.loans l
    where l.book_copy_id = bc.id
      and l.status in ('handover_ready', 'awaiting_receipt', 'borrowed', 'return_pending')
    order by l.accepted_at desc
    limit 1
  ) active_loan on true
  left join lateral (
    select count(*)::bigint as waiting_count
    from public.borrow_requests br
    where br.book_copy_id = bc.id and br.status = 'waiting'
  ) request_totals on true
  where bl.community_id = p_community_id
    and bl.status = 'active'
    and bc.status = 'active'
  order by bl.created_at desc, bl.id;
end;
$$;

revoke all on function public.bootstrap_parent(text, text, text) from public, anon;
revoke all on function public.create_circle_invitation(uuid, text, timestamptz) from public, anon;
revoke all on function public.redeem_circle_invitation(text) from public, anon;
revoke all on function public.create_book_listing(
  uuid, text, text, text, text, text, text, text, text,
  public.age_band, public.book_category, public.book_language, public.book_condition, text
) from public, anon;
revoke all on function public.attach_book_photo(uuid, text) from public, anon;
revoke all on function public.set_listing_lendable(uuid, boolean) from public, anon;
revoke all on function public.request_book(uuid) from public, anon;
revoke all on function public.cancel_book_request(uuid) from public, anon;
revoke all on function public.decline_book_request(uuid, text) from public, anon;
revoke all on function public.accept_next_request(uuid) from public, anon;
revoke all on function public.cancel_loan_before_receipt(uuid) from public, anon;
revoke all on function public.mark_book_handed_over(uuid) from public, anon;
revoke all on function public.confirm_book_received(uuid) from public, anon;
revoke all on function public.mark_book_returned(uuid) from public, anon;
revoke all on function public.confirm_book_returned(uuid) from public, anon;
revoke all on function public.submit_loan_feedback(uuid, public.return_condition, text) from public, anon;
revoke all on function public.get_queue_position(uuid) from public, anon;
revoke all on function public.get_handover_contact(uuid) from public, anon;
revoke all on function public.get_family_reliability(uuid) from public, anon;
revoke all on function public.list_circle_books(uuid) from public, anon;

grant execute on function public.bootstrap_parent(text, text, text) to authenticated;
grant execute on function public.create_circle_invitation(uuid, text, timestamptz) to authenticated;
grant execute on function public.redeem_circle_invitation(text) to authenticated;
grant execute on function public.create_book_listing(
  uuid, text, text, text, text, text, text, text, text,
  public.age_band, public.book_category, public.book_language, public.book_condition, text
) to authenticated;
grant execute on function public.attach_book_photo(uuid, text) to authenticated;
grant execute on function public.set_listing_lendable(uuid, boolean) to authenticated;
grant execute on function public.request_book(uuid) to authenticated;
grant execute on function public.cancel_book_request(uuid) to authenticated;
grant execute on function public.decline_book_request(uuid, text) to authenticated;
grant execute on function public.accept_next_request(uuid) to authenticated;
grant execute on function public.cancel_loan_before_receipt(uuid) to authenticated;
grant execute on function public.mark_book_handed_over(uuid) to authenticated;
grant execute on function public.confirm_book_received(uuid) to authenticated;
grant execute on function public.mark_book_returned(uuid) to authenticated;
grant execute on function public.confirm_book_returned(uuid) to authenticated;
grant execute on function public.submit_loan_feedback(uuid, public.return_condition, text) to authenticated;
grant execute on function public.get_queue_position(uuid) to authenticated;
grant execute on function public.get_handover_contact(uuid) to authenticated;
grant execute on function public.get_family_reliability(uuid) to authenticated;
grant execute on function public.list_circle_books(uuid) to authenticated;
