do $$
declare
  target_table text;
  sequence_name text;
  maximum_id bigint;
begin
  foreach target_table in array array[
    'appointments',
    'clients',
    'services'
  ]
  loop
    sequence_name := pg_get_serial_sequence(
      format('public.%I', target_table),
      'id'
    );

    if sequence_name is null then
      raise notice 'No sequence found for public.%.id', target_table;
      continue;
    end if;

    execute format(
      'select coalesce(max(id), 0) from public.%I',
      target_table
    )
    into maximum_id;

    if maximum_id = 0 then
      perform pg_catalog.setval(sequence_name::regclass, 1, false);
    else
      perform pg_catalog.setval(
        sequence_name::regclass,
        maximum_id,
        true
      );
    end if;
  end loop;
end;
$$;
