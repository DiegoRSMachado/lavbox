-- 0004 · Pacote A (ADR-002, ADR-003)
--  1) papel 'admin' existe, mas NUNCA nasce pelo cadastro público (policy de INSERT restringe a cliente/lavador)
--  2) is_admin() para as policies/RPCs do Pacote B
--  3) PIN de 6 dígitos + limite de tentativas (5 erros => bloqueio de 5 min)
-- start_service agora RETORNA jsonb em vez de lançar erro: `raise exception` desfaria a transação
-- e apagaria o contador de tentativas (o bloqueio nunca persistiria).
-- Base: schema.sql (0001–0003). Desfazer: 0004_admin_pin6.down.sql

-- 1) papel admin ---------------------------------------------------------------------------
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('cliente','lavador','admin'));

drop policy profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = (select auth.uid()) and role in ('cliente','lavador'));

-- 2) is_admin() ----------------------------------------------------------------------------
create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = (select auth.uid()) and role = 'admin');
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- 3) PIN 6 dígitos + bloqueio ---------------------------------------------------------------
alter table public.order_secrets
  add column tentativas int not null default 0,
  add column bloqueado_ate timestamptz,
  add constraint order_secrets_pin_fmt check (pin ~ '^[0-9]{6}$');   -- hoje: 0 linhas, sem backfill

create or replace function public.create_order(
  p_vehicle uuid, p_service text, p_addons text[], p_bairro text,
  p_lat double precision, p_lng double precision, p_endereco text,
  p_agendado timestamptz default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid(); v_tipo text; v_base numeric; v_mult numeric; v_add numeric;
  v_id uuid; v_pin text; v_addons text[] := coalesce(p_addons, '{}');
begin
  if v_uid is null then raise exception 'não autenticado'; end if;
  if not exists (select 1 from public.profiles where id = v_uid and role = 'cliente') then
    raise exception 'apenas clientes podem criar pedidos'; end if;
  select tipo into v_tipo from public.vehicles where id = p_vehicle and owner_id = v_uid;
  if v_tipo is null then raise exception 'veículo inválido'; end if;
  select preco into v_base from public.services where id = p_service;
  if v_base is null then raise exception 'serviço inválido'; end if;
  if char_length(coalesce(p_endereco,'')) < 5 or char_length(coalesce(p_bairro,'')) < 2 then
    raise exception 'endereço inválido'; end if;
  v_mult := case v_tipo when 'moto' then 0.7 when 'suv' then 1.25
            when 'caminhonete' then 1.4 when 'van' then 1.5 else 1 end;
  select coalesce(sum(preco),0) into v_add from public.addons where id = any(v_addons);
  insert into public.orders(client_id, vehicle_id, service_id, addon_ids, bairro, lat, lng, agendado_para, preco_total)
  values (v_uid, p_vehicle, p_service, v_addons, left(p_bairro,60),
          round(p_lat::numeric,3), round(p_lng::numeric,3), p_agendado, round(v_base*v_mult + v_add, 2))
  returning id into v_id;
  -- 6 dígitos de CSPRNG (viés do módulo desprezível p/ este uso)
  v_pin := lpad(((('x' || encode(extensions.gen_random_bytes(4),'hex'))::bit(32)::bigint) % 1000000)::text, 6, '0');
  insert into public.order_private(order_id, endereco, telefone, lat, lng)
    select v_id, left(p_endereco,200), telefone, p_lat, p_lng from public.profiles where id = v_uid;
  insert into public.order_secrets(order_id, pin) values (v_id, v_pin);
  return jsonb_build_object('id', v_id, 'pin', v_pin);
end $$;

drop function public.start_service(uuid, text);
create function public.start_service(p_id uuid, p_pin text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_cur public.order_status; v_sec public.order_secrets%rowtype; v_novo int;
begin
  select status into v_cur from public.orders where id = p_id and washer_id = auth.uid() for update;
  if v_cur is null then raise exception 'pedido não encontrado'; end if;
  if v_cur <> 'chegou' then raise exception 'pedido não está no estado "chegou"'; end if;
  if p_pin is null or p_pin !~ '^[0-9]{6}$' then
    return jsonb_build_object('ok', false, 'motivo', 'formato'); end if;

  select * into v_sec from public.order_secrets where order_id = p_id for update;
  if v_sec.bloqueado_ate is not null and v_sec.bloqueado_ate > now() then
    return jsonb_build_object('ok', false, 'motivo', 'bloqueado', 'restantes', 0, 'bloqueado_ate', v_sec.bloqueado_ate);
  end if;

  if v_sec.pin = p_pin then
    update public.order_secrets set tentativas = 0, bloqueado_ate = null where order_id = p_id;
    update public.orders set status = 'em_servico', updated_at = now() where id = p_id;
    return jsonb_build_object('ok', true);
  end if;

  v_novo := v_sec.tentativas + 1;
  if v_novo >= 5 then
    update public.order_secrets set tentativas = 0, bloqueado_ate = now() + interval '5 minutes' where order_id = p_id;
    return jsonb_build_object('ok', false, 'motivo', 'bloqueado', 'restantes', 0, 'bloqueado_ate', now() + interval '5 minutes');
  end if;
  update public.order_secrets set tentativas = v_novo where order_id = p_id;
  return jsonb_build_object('ok', false, 'motivo', 'incorreto', 'restantes', 5 - v_novo);
end $$;
revoke all on function public.start_service(uuid, text) from public, anon;
grant execute on function public.start_service(uuid, text) to authenticated;
