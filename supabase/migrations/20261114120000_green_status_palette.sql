-- Status palette aligned with the green (teal) UI.
-- Only rows still carrying a previous default are recolored; business-chosen colors are kept.

update public.statuses
set color = case status_code
  when '01' then '#7c8b84'
  when '03' then '#115e59'
  when '04' then '#0e7490'
  when '05' then '#ca8a04'
  when '09' then '#c2410c'
  when '10' then '#b91c1c'
  else color
end
where (status_code = '01' and lower(color) in ('#607482', '#14b8a6', '#6c757d', '#808080'))
   or (status_code = '03' and lower(color) in ('#073f67', '#808080'))
   or (status_code = '04' and lower(color) in ('#0a527f', '#808080'))
   or (status_code = '05' and lower(color) in ('#14b8a6', '#808080'))
   or (status_code = '09' and lower(color) in ('#b45309', '#12648f', '#808080'))
   or (status_code = '10' and lower(color) in ('#607482', '#808080'));

update public.statuses
set color = '#0d9488'
where status_code = '02' and lower(color) = '#808080';

insert into public.statuses (business_code, status_code, status_text, color)
select businesses.business_code, seeded.status_code, seeded.status_text, seeded.color
from public.businesses
cross join (
  values
    ('01', 'ממתין לאישור העסק', '#7c8b84'),
    ('02', 'מתוזמן', '#0d9488'),
    ('03', 'הושלם', '#115e59'),
    ('04', 'ממתין לאישור הלקוח', '#0e7490'),
    ('05', 'ממתין לתשלום', '#ca8a04'),
    ('09', 'לא הגיע', '#c2410c'),
    ('10', 'מבוטל', '#b91c1c')
) as seeded(status_code, status_text, color)
on conflict (business_code, status_code) do nothing;

delete from public.statuses as legacy
where legacy.status_code in (
    'waiting', 'scheduled', 'canceled', 'completed', 'no_show',
    'pending_approval', 'reschedule_required'
  )
  and not exists (
    select 1
    from public.appointments
    where appointments.business_code = legacy.business_code
      and appointments.status = legacy.status_code
  );

create or replace function public.handle_new_business_statuses()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  insert into public.statuses (business_code, status_code, status_text, color)
  values
    (new.business_code, '01', 'ממתין לאישור העסק', '#7c8b84'),
    (new.business_code, '02', 'מתוזמן', '#0d9488'),
    (new.business_code, '03', 'הושלם', '#115e59'),
    (new.business_code, '09', 'לא הגיע', '#c2410c'),
    (new.business_code, '10', 'מבוטל', '#b91c1c')
  on conflict (business_code, status_code) do nothing;
  return new;
end;
$function$;

create or replace function private.seed_booking_policy_statuses()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  insert into public.statuses (business_code, status_code, status_text, color)
  values
    (new.business_code, '04', 'ממתין לאישור הלקוח', '#0e7490'),
    (new.business_code, '05', 'ממתין לתשלום', '#ca8a04')
  on conflict (business_code, status_code) do nothing;
  return new;
end;
$function$;

alter table public.statuses alter column color set default '#7c8b84';
