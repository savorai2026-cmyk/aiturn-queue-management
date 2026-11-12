-- Removing the saved card turns agents off. The calendar stays view-only
-- until another card is saved, which the app detects from a revoked method
-- with no active replacement.

create or replace function public.revoke_business_payment_method(p_business_code uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if not private.has_business_role(p_business_code, array['owner', 'admin']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.payment_methods
    where business_code = p_business_code
      and status = 'active'
  ) then
    raise exception 'אין כרטיס פעיל להסרה.' using errcode = 'P0002';
  end if;

  perform set_config('app.closing_business', 'on', true);

  update public.payment_methods
  set status = 'revoked', updated_at = now()
  where business_code = p_business_code
    and status = 'active';

  update public.businesses
  set is_active = false, updated_at = now()
  where business_code = p_business_code;
end;
$$;

revoke all on function public.revoke_business_payment_method(uuid) from public, anon;
grant execute on function public.revoke_business_payment_method(uuid) to authenticated, service_role;
