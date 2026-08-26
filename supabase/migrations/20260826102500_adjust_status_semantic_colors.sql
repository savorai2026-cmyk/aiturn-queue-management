update public.statuses
set color = case status_code
  when '01' then '#607482'
  when '09' then '#b45309'
  when '10' then '#b91c1c'
  else color
end
where status_code in ('01', '09', '10');
