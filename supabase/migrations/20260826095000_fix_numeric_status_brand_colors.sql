update public.statuses
set color = case status_code
  when '01' then '#14b8a6'
  when '02' then '#0d9488'
  when '03' then '#073f67'
  when '09' then '#12648f'
  when '10' then '#607482'
  else color
end
where status_code in ('01', '02', '03', '09', '10');

delete from public.statuses
where status_code in ('waiting', 'scheduled', 'completed', 'no_show', 'canceled');
