create or replace function public.appointments_enqueue_offer_outreach()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
    service_title text;
    offer_payload jsonb;
begin
    if tg_op <> 'INSERT' then
        return new;
    end if;
    if new.client_id is null or new.business_code is null or new.id is null then
        return new;
    end if;
    if coalesce(btrim(new.status::text), '') <> '04' then
        return new;
    end if;

    select title
      into service_title
      from public.services
     where id = new.service_id
       and business_code = new.business_code
     limit 1;

    offer_payload := jsonb_build_object(
        'new_date', new.appointment_date::text,
        'new_time', new.start_time::text,
        'new_end', new.end_time::text,
        'service_id', new.service_id,
        'service_title', coalesce(service_title, ''),
        'status', '04',
        'source', 'appointment_create'
    );

    begin
        insert into public.outreach_jobs (
            business_code,
            client_id,
            appointment_id,
            reason,
            payload
        ) values (
            new.business_code,
            new.client_id,
            new.id,
            'offer',
            offer_payload
        );
    exception
        when unique_violation then
            null;
    end;

    return new;
end;
$$;

comment on function public.appointments_enqueue_offer_outreach() is
    'Enqueue a customer offer when the calendar creates an appointment already waiting for the customer (status 04).';

revoke all on function public.appointments_enqueue_offer_outreach() from public, anon, authenticated;

drop trigger if exists appointments_offer_outreach_trg on public.appointments;
create trigger appointments_offer_outreach_trg
    after insert
    on public.appointments
    for each row
    execute procedure public.appointments_enqueue_offer_outreach();

comment on trigger appointments_offer_outreach_trg on public.appointments is
    'Insert status 04 inserts outreach_jobs reason=offer. Channel comes from the client preference.';
