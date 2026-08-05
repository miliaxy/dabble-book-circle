-- Private book-cover storage. Object paths must be:
-- <community-id>/<family-id>/<random-file-name>.<extension>

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'book-photos',
  'book-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.can_read_book_photo_path(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and (
    exists (
      select 1
      from public.family_memberships fm
      where fm.user_id = (select auth.uid())
        and fm.status = 'active'
        and fm.family_id::text = (storage.foldername(p_object_name))[2]
    )
    or exists (
      select 1
      from public.family_memberships fm
      join public.community_memberships viewer_cm on viewer_cm.family_id = fm.family_id
      join public.community_memberships owner_cm
        on owner_cm.community_id = viewer_cm.community_id
      join public.communities c on c.id = viewer_cm.community_id
      where fm.user_id = (select auth.uid())
        and fm.status = 'active'
        and viewer_cm.status = 'active'
        and owner_cm.status = 'active'
        and owner_cm.family_id::text = (storage.foldername(p_object_name))[2]
        and c.status <> 'archived'
    )
  )
$$;

create or replace function private.can_upload_book_photo_path(p_object_name text)
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
      and cm.status = 'active'
      and c.status <> 'archived'
      and cm.community_id::text = (storage.foldername(p_object_name))[1]
      and fm.family_id::text = (storage.foldername(p_object_name))[2]
  )
$$;

create or replace function private.can_manage_book_photo_path(p_object_name text)
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
      and fm.status = 'active'
      and fm.family_id::text = (storage.foldername(p_object_name))[2]
  )
$$;

revoke all on function private.can_read_book_photo_path(text) from public, anon;
revoke all on function private.can_upload_book_photo_path(text) from public, anon;
revoke all on function private.can_manage_book_photo_path(text) from public, anon;
grant execute on function private.can_read_book_photo_path(text) to authenticated;
grant execute on function private.can_upload_book_photo_path(text) to authenticated;
grant execute on function private.can_manage_book_photo_path(text) to authenticated;

create policy book_photos_circle_read
on storage.objects for select to authenticated
using (
  bucket_id = 'book-photos'
  and private.can_read_book_photo_path(name)
);

create policy book_photos_family_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'book-photos'
  and private.can_upload_book_photo_path(name)
);

create policy book_photos_family_update
on storage.objects for update to authenticated
using (
  bucket_id = 'book-photos'
  and private.can_manage_book_photo_path(name)
)
with check (
  bucket_id = 'book-photos'
  and private.can_manage_book_photo_path(name)
);

create policy book_photos_family_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'book-photos'
  and private.can_manage_book_photo_path(name)
);
