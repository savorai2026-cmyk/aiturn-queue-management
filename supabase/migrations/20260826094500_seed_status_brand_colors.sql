insert into public.statuses (business_code, status_code, status_text, color)
select
  businesses.business_code,
  seeded.status_code,
  seeded.status_text,
  seeded.color
from public.businesses
cross join (
  values
    ('waiting', 'ממתין', '#14b8a6'),
    ('scheduled', 'מתוזמן', '#0d9488'),
    ('completed', 'הושלם', '#073f67'),
    ('no_show', 'לא הגיע', '#12648f'),
    ('canceled', 'מבוטל', '#607482')
) as seeded(status_code, status_text, color)
on conflict (business_code, status_code) do update
set color = excluded.color;
