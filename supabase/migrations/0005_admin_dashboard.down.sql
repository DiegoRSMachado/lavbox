-- Desfaz 0005: remove o seed, a RPC e as colunas is_seed.
delete from public.orders where is_seed;
delete from auth.users where raw_user_meta_data->>'seed' = 'true';
drop function if exists public.admin_kpis();
alter table public.orders drop column is_seed;
alter table public.profiles drop column is_seed;
