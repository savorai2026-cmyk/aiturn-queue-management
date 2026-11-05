-- Owners already update businesses column-by-column. The cancellation rule
-- is written from business settings, so authenticated needs this column.

grant update (cancellation_policy) on public.businesses to authenticated;
