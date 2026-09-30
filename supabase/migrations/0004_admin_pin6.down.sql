-- Desfaz 0004 (só use se não houver usuário 'admin' nem pedidos com PIN de 6 dígitos).
drop function if exists public.start_service(uuid, text);
create function public.start_service(p_id uuid, p_pin text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_cur public.order_status;
begin
  select status into v_cur from public.orders where id = p_id and washer_id = auth.uid() for update;
  if v_cur is distinct from 'chegou' then raise exception 'pedido não está no estado "chegou"'; end if;
  if not exists (select 1 from public.order_secrets where order_id = p_id and pin = p_pin) then raise exception 'PIN inválido'; end if;
  update public.orders set status = 'em_servico', updated_at = now() where id = p_id;
end $$;
revoke all on function public.start_service(uuid, text) from public, anon;
grant execute on function public.start_service(uuid, text) to authenticated;

alter table public.order_secrets
  drop constraint order_secrets_pin_fmt, drop column tentativas, drop column bloqueado_ate;
-- create_order: reaplicar a versão de schema.sql (PIN de 4 dígitos) se necessário.

drop function if exists public.is_admin();
drop policy profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated with check (id = (select auth.uid()));
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('cliente','lavador'));
