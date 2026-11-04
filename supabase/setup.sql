-- RR CDO Editable QR Manager
-- This creates a separate table and bucket. It does not alter packing_records.

create table if not exists public.editable_qr_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.editable_qr_codes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null default 'RR CDO Information',
  content jsonb not null default '[]'::jsonb,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.editable_qr_codes (slug, title, content, is_published)
values (
  'main',
  'RR CDO Information',
  '[{"id":"welcome-1","type":"text","heading":"Welcome","value":"This information can be edited by an administrator."}]'::jsonb,
  true
)
on conflict (slug) do nothing;

alter table public.editable_qr_admins enable row level security;
alter table public.editable_qr_codes enable row level security;

drop policy if exists "Admins can read their own QR admin row" on public.editable_qr_admins;
create policy "Admins can read their own QR admin row"
on public.editable_qr_admins for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Public can read published QR pages" on public.editable_qr_codes;
create policy "Public can read published QR pages"
on public.editable_qr_codes for select to anon, authenticated
using (is_published = true or exists (
  select 1 from public.editable_qr_admins a where a.user_id = (select auth.uid())
));

drop policy if exists "Admins can update QR pages" on public.editable_qr_codes;
create policy "Admins can update QR pages"
on public.editable_qr_codes for update to authenticated
using (exists (
  select 1 from public.editable_qr_admins a where a.user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.editable_qr_admins a where a.user_id = (select auth.uid())
));

-- Public image viewing; uploads are restricted to authorized administrators.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('editable-qr-assets', 'editable-qr-assets', true, 5242880,
        array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif'];

drop policy if exists "Public can view editable QR images" on storage.objects;
create policy "Public can view editable QR images"
on storage.objects for select to anon, authenticated
using (bucket_id = 'editable-qr-assets');

drop policy if exists "QR admins can upload images" on storage.objects;
create policy "QR admins can upload images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'editable-qr-assets'
  and exists (select 1 from public.editable_qr_admins a where a.user_id = (select auth.uid()))
);

drop policy if exists "QR admins can update images" on storage.objects;
create policy "QR admins can update images"
on storage.objects for update to authenticated
using (
  bucket_id = 'editable-qr-assets'
  and exists (select 1 from public.editable_qr_admins a where a.user_id = (select auth.uid()))
)
with check (
  bucket_id = 'editable-qr-assets'
  and exists (select 1 from public.editable_qr_admins a where a.user_id = (select auth.uid()))
);

-- After creating your admin account in Supabase Authentication > Users,
-- copy that user's UUID and run this separately:
-- insert into public.editable_qr_admins (user_id)
-- values ('PASTE-AUTH-USER-UUID-HERE');
