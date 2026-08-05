-- Run only after the pilot administrator has authenticated once and called:
--   select public.bootstrap_parent('Parent name', 'Family display name', null);
--
-- Replace every REPLACE_ME value. This block intentionally refuses to run
-- while placeholders remain. It creates one pilot circle and promotes only
-- the selected existing family to circle administrator.

do $$
declare
  v_admin_email text := 'REPLACE_ME_ADMIN_EMAIL';
  v_circle_name text := 'REPLACE_ME_CIRCLE_NAME';
  v_circle_slug text := 'REPLACE_ME_CIRCLE_SLUG';
  v_location_label text := 'Gurgaon, Haryana';
  v_admin_user_id uuid;
  v_admin_family_id uuid;
  v_community_id uuid;
begin
  if v_admin_email like 'REPLACE_ME%'
    or v_circle_name like 'REPLACE_ME%'
    or v_circle_slug like 'REPLACE_ME%' then
    raise exception 'Replace all REPLACE_ME values before running this block';
  end if;

  select u.id into strict v_admin_user_id
  from auth.users u
  where lower(u.email) = lower(v_admin_email);

  select fm.family_id into strict v_admin_family_id
  from public.family_memberships fm
  where fm.user_id = v_admin_user_id and fm.status = 'active';

  insert into public.communities (name, slug, location_label, status, invite_only)
  values (v_circle_name, v_circle_slug, v_location_label, 'pilot', true)
  returning id into v_community_id;

  insert into public.community_memberships (
    community_id,
    family_id,
    role,
    status
  )
  values (v_community_id, v_admin_family_id, 'admin', 'active');
end;
$$;
