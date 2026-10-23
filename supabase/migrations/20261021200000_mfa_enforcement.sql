create or replace function private.mfa_satisfied()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2'
    or not exists (
      select 1
      from auth.mfa_factors f
      where f.user_id = (select auth.uid())
        and f.status = 'verified'
    );
$$;

-- A user who turned on two-step verification reaches business data only with an aal2 session.

revoke all on function private.mfa_satisfied() from public, anon;

create or replace function private.is_business_member(target_business_code uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_members bm
    where bm.business_code = target_business_code
      and bm.user_id = (select auth.uid())
      and bm.status = 'active'
  )
  and private.mfa_satisfied();
$$;

create or replace function private.has_business_role(target_business_code uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_members bm
    where bm.business_code = target_business_code
      and bm.user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.role = any(allowed_roles)
  )
  and private.mfa_satisfied();
$$;
