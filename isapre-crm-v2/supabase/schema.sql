-- Execute once in Supabase SQL Editor. Review before production.
create extension if not exists pgcrypto;
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null default '',
 role text not null default 'executive' check (role in ('admin','supervisor','executive')),
 created_at timestamptz not null default now()
);
create table if not exists public.leads (
 id uuid primary key default gen_random_uuid(),
 full_name text not null check (char_length(full_name) between 2 and 120),
 phone text not null check (char_length(phone) between 7 and 30),
 email text check (email is null or char_length(email)<=254),
 interest text not null check (interest in ('Cotizar un plan','Cambiar de Isapre','Recibir asesoría')),
 status text not null default 'nuevo' check (status in ('nuevo','contactado','cotizando','seguimiento','cerrado','descartado')),
 assigned_to uuid references public.profiles(id) on delete set null,
 consent_at timestamptz not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists leads_assigned_created_idx on public.leads(assigned_to,created_at desc);
create table if not exists public.lead_activities (
 id uuid primary key default gen_random_uuid(),
 lead_id uuid not null references public.leads(id) on delete cascade,
 actor_id uuid not null references public.profiles(id),
 note text not null check (char_length(note) between 1 and 3000),
 created_at timestamptz not null default now()
);
create or replace function public.is_manager() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('admin','supervisor'))
$$;
revoke all on function public.is_manager() from public;
grant execute on function public.is_manager() to authenticated;
alter table public.profiles enable row level security;
alter table public.leads enable row level security;
alter table public.lead_activities enable row level security;
create policy "profiles select own or managers" on public.profiles for select to authenticated using (id=(select auth.uid()) or public.is_manager());
create policy "leads select assigned or managers" on public.leads for select to authenticated using (assigned_to=(select auth.uid()) or public.is_manager());
-- Restrict update to status only via column-level privilege; no ability to reassign, edit consent or ownership.
revoke all on public.leads from anon, authenticated;
grant select on public.leads to authenticated;
grant update(status) on public.leads to authenticated;
create policy "leads update assigned or managers" on public.leads for update to authenticated using (assigned_to=(select auth.uid()) or public.is_manager()) with check (assigned_to=(select auth.uid()) or public.is_manager());
create policy "activities select visible leads" on public.lead_activities for select to authenticated using (exists(select 1 from public.leads l where l.id=lead_id));
create policy "activities insert visible leads" on public.lead_activities for insert to authenticated with check (actor_id=(select auth.uid()) and exists(select 1 from public.leads l where l.id=lead_id));
revoke all on public.profiles from anon,authenticated;
grant select on public.profiles to authenticated;
revoke all on public.lead_activities from anon,authenticated;
grant select,insert on public.lead_activities to authenticated;
-- Public intake: no anonymous SELECT access to leads. Deploy a rate-limited Cloudflare Worker before production.
create or replace function public.submit_public_lead(p_full_name text,p_phone text,p_email text,p_interest text,p_consent boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_consent is distinct from true then raise exception 'Consent required'; end if;
 if char_length(trim(coalesce(p_full_name,''))) not between 2 and 120 or char_length(trim(coalesce(p_phone,''))) not between 7 and 30 then raise exception 'Invalid contact'; end if;
 if p_email is not null and char_length(p_email)>254 then raise exception 'Invalid email'; end if;
 insert into public.leads(full_name,phone,email,interest,consent_at) values(trim(p_full_name),trim(p_phone),nullif(trim(p_email),''),p_interest,now());
end $$;
revoke all on function public.submit_public_lead(text,text,text,text,boolean) from public;
grant execute on function public.submit_public_lead(text,text,text,text,boolean) to anon,authenticated;
-- Create users manually in Authentication > Users, then provision profiles using the bootstrap SQL in README.
