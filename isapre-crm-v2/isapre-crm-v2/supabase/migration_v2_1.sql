-- CRM 2.1: run after schema.sql. Administrator-only RPCs; no secret keys in browser.
create table if not exists public.user_permissions (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 view_all_leads boolean not null default false,
 manage_assigned_leads boolean not null default true,
 assign_leads boolean not null default false,
 view_reports boolean not null default false,
 manage_users boolean not null default false,
 updated_at timestamptz not null default now()
);
alter table public.user_permissions enable row level security;
revoke all on public.user_permissions from anon, authenticated;
grant select on public.user_permissions to authenticated;
-- This check deliberately uses profiles.role, not user-configurable permissions.
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin')
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;
create policy "permissions self or admin" on public.user_permissions for select to authenticated
 using (user_id=(select auth.uid()) or public.is_admin());
-- Remove manager-wide policies from v2.0. Permissions must be enforced at the database.
drop policy if exists "profiles select own or managers" on public.profiles;
create policy "profiles select self or admin" on public.profiles for select to authenticated
 using (id=(select auth.uid()) or public.is_admin());
drop policy if exists "leads select assigned or managers" on public.leads;
create policy "leads read permitted" on public.leads for select to authenticated using (
 public.is_admin() or assigned_to=(select auth.uid()) or exists (
  select 1 from public.user_permissions p where p.user_id=(select auth.uid()) and p.view_all_leads
 )
);
drop policy if exists "leads update assigned or managers" on public.leads;
create policy "leads update permitted" on public.leads for update to authenticated using (
 public.is_admin() or exists (select 1 from public.user_permissions p where p.user_id=(select auth.uid())
 and (p.view_all_leads or (p.manage_assigned_leads and assigned_to=(select auth.uid()))))
) with check (
 public.is_admin() or exists (select 1 from public.user_permissions p where p.user_id=(select auth.uid())
 and (p.view_all_leads or (p.manage_assigned_leads and assigned_to=(select auth.uid()))))
);
-- Admin management functions; validate caller against immutable admin role.
create or replace function public.admin_save_user_permissions(
 p_user_id uuid, p_view_all_leads boolean, p_manage_assigned_leads boolean,
 p_assign_leads boolean, p_view_reports boolean, p_manage_users boolean
) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Not authorized' using errcode='42501'; end if;
 if not exists(select 1 from public.profiles where id=p_user_id) then raise exception 'Profile not found'; end if;
 if p_user_id=(select auth.uid()) then raise exception 'Admin permissions are managed by role'; end if;
 insert into public.user_permissions(user_id,view_all_leads,manage_assigned_leads,assign_leads,view_reports,manage_users,updated_at)
 values(p_user_id,p_view_all_leads,p_manage_assigned_leads,p_assign_leads,p_view_reports,p_manage_users,now())
 on conflict(user_id) do update set view_all_leads=excluded.view_all_leads,
 manage_assigned_leads=excluded.manage_assigned_leads,assign_leads=excluded.assign_leads,
 view_reports=excluded.view_reports,manage_users=excluded.manage_users,updated_at=now();
end $$;
revoke all on function public.admin_save_user_permissions(uuid,boolean,boolean,boolean,boolean,boolean) from public;
grant execute on function public.admin_save_user_permissions(uuid,boolean,boolean,boolean,boolean,boolean) to authenticated;
create or replace function public.admin_assign_lead(p_lead_id uuid,p_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not (public.is_admin() or exists(select 1 from public.user_permissions p where p.user_id=(select auth.uid()) and p.assign_leads))
 then raise exception 'Not authorized' using errcode='42501'; end if;
 if p_user_id is not null and not exists(select 1 from public.profiles where id=p_user_id) then raise exception 'Profile not found'; end if;
 update public.leads set assigned_to=p_user_id,updated_at=now() where id=p_lead_id;
 if not found then raise exception 'Lead not found'; end if;
end $$;
revoke all on function public.admin_assign_lead(uuid,uuid) from public;
grant execute on function public.admin_assign_lead(uuid,uuid) to authenticated;
-- Only an administrator can provision a profile for an already-created Auth user.
create or replace function public.admin_provision_profile(p_user_id uuid,p_full_name text,p_role text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Not authorized' using errcode='42501'; end if;
 if p_role not in ('executive','supervisor') then raise exception 'Invalid role'; end if;
 if char_length(trim(coalesce(p_full_name,''))) not between 2 and 120 then raise exception 'Invalid name'; end if;
 if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'Auth user not found'; end if;
 insert into public.profiles(id,full_name,role) values(p_user_id,trim(p_full_name),p_role)
 on conflict(id) do update set full_name=excluded.full_name,role=excluded.role;
 insert into public.user_permissions(user_id) values(p_user_id) on conflict(user_id) do nothing;
end $$;
revoke all on function public.admin_provision_profile(uuid,text,text) from public;
grant execute on function public.admin_provision_profile(uuid,text,text) to authenticated;
-- Initial permissions for existing non-admin profiles.
insert into public.user_permissions(user_id)
select id from public.profiles where role <> 'admin'
on conflict(user_id) do nothing;
-- Revoke public RPC until a protected, rate-limited intake endpoint is deployed.
revoke execute on function public.submit_public_lead(text,text,text,text,boolean) from anon,authenticated;
