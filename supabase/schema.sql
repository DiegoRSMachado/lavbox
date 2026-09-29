-- LAVBOX · schema, RLS e RPCs (espelha as migrations aplicadas no projeto Supabase).
-- Princípio: nenhuma escrita direta em orders/order_private/order_secrets/order_events;
-- toda transição passa por RPC SECURITY DEFINER (search_path vazio) que valida papel e estado.

create extension if not exists pgcrypto with schema extensions;
create type public.order_status as enum
  ('solicitado','confirmado','a_caminho','chegou','em_servico','finalizado','pago','avaliado','cancelado');

-- ========== TABELAS ==========
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('cliente','lavador')),
  nome text not null check (char_length(nome) between 2 and 80),
  telefone text check (telefone is null or char_length(telefone) <= 20),
  created_at timestamptz not null default now());
create table public.washers (
  id uuid primary key references public.profiles(id) on delete cascade,
  bairro text not null check (char_length(bairro) between 2 and 60),
  servicos text[] not null default '{}',
  bio text check (bio is null or char_length(bio) <= 200),
  disponivel boolean not null default true);
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  tipo text not null check (tipo in ('carro','moto','suv','caminhonete','van')),
  modelo text not null check (char_length(modelo) between 2 and 60),
  cor text check (cor is null or char_length(cor) <= 30),
  created_at timestamptz not null default now());
create index on public.vehicles(owner_id);
create table public.services (
  id text primary key, nome text not null, descricao text not null,
  duracao_min int not null, preco numeric(8,2) not null, agua_litros int not null, ecologico boolean not null default false);
create table public.addons (id text primary key, nome text not null, preco numeric(8,2) not null);
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id),
  washer_id uuid references public.profiles(id),
  vehicle_id uuid not null references public.vehicles(id),
  service_id text not null references public.services(id),
  addon_ids text[] not null default '{}',
  bairro text not null, lat numeric(7,3), lng numeric(7,3),      -- coordenada arredondada (~100 m) p/ minimizar dado
  agendado_para timestamptz,
  preco_total numeric(8,2) not null,
  status public.order_status not null default 'solicitado',
  avaliacao int check (avaliacao between 1 and 5),
  comentario text check (comentario is null or char_length(comentario) <= 300),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index on public.orders(client_id); create index on public.orders(washer_id); create index on public.orders(status);
create table public.order_private (   -- só cliente dono e lavador aceito
  order_id uuid primary key references public.orders(id) on delete cascade,
  endereco text not null, telefone text, lat double precision, lng double precision);
create table public.order_secrets (   -- PIN: sem policy, acessível só por RPC
  order_id uuid primary key references public.orders(id) on delete cascade, pin text not null);
create table public.order_events (    -- auditoria append-only
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  de public.order_status, para public.order_status not null, actor uuid, at timestamptz not null default now());
create index on public.order_events(order_id);

-- ========== CATÁLOGO (valores de demonstração) ==========
insert into public.services(id,nome,descricao,duracao_min,preco,agua_litros,ecologico) values
 ('basico','Básico','Lavagem externa, rodas, secagem e vidros',30,35,120,false),
 ('completo','Completo','Externa + interna: aspiração, painel, vidros, rodas e acabamento',60,70,150,false),
 ('premium','Premium','Completo + cera, hidratação interna, pneus e proteção de pintura',120,140,150,false),
 ('ecowash','EcoWash','Lavagem a seco com produtos biodegradáveis (economia de água)',45,60,20,true);
insert into public.addons(id,nome,preco) values
 ('polimento','Polimento',80),('higienizacao','Higienização interna',60),('cristalizacao','Cristalização',120),('enceramento','Enceramento',40);

-- ========== AUDITORIA + HELPERS ==========
create function public.log_order_event() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then insert into public.order_events(order_id,de,para,actor) values (new.id,null,new.status,auth.uid());
  elsif new.status is distinct from old.status then insert into public.order_events(order_id,de,para,actor) values (new.id,old.status,new.status,auth.uid());
  end if; return null; end $$;
create trigger trg_order_events after insert or update on public.orders for each row execute function public.log_order_event();
create function public.is_washer() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = (select auth.uid()) and role = 'lavador'); $$;

-- ========== RLS ==========
alter table public.profiles enable row level security;   alter table public.washers enable row level security;
alter table public.vehicles enable row level security;   alter table public.services enable row level security;
alter table public.addons enable row level security;     alter table public.orders enable row level security;
alter table public.order_private enable row level security; alter table public.order_secrets enable row level security;
alter table public.order_events enable row level security;

create policy profiles_select on public.profiles for select to authenticated using (
  id = (select auth.uid())
  or id in (select washer_id from public.orders where client_id = (select auth.uid()))
  or id in (select client_id from public.orders where washer_id = (select auth.uid())));
create policy profiles_insert on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy washers_select on public.washers for select to authenticated using (
  id = (select auth.uid()) or id in (select washer_id from public.orders where client_id = (select auth.uid())));
create policy washers_insert on public.washers for insert to authenticated with check (id = (select auth.uid()) and public.is_washer());
create policy washers_update on public.washers for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy vehicles_all on public.vehicles for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy vehicles_washer_read on public.vehicles for select to authenticated using (
  exists (select 1 from public.orders o where o.vehicle_id = vehicles.id and (
    o.washer_id = (select auth.uid()) or (o.status = 'solicitado' and public.is_washer()))));
create policy services_read on public.services for select to anon, authenticated using (true);
create policy addons_read on public.addons for select to anon, authenticated using (true);
create policy orders_select on public.orders for select to authenticated using (
  client_id = (select auth.uid()) or washer_id = (select auth.uid()) or (status = 'solicitado' and public.is_washer()));
create policy order_private_select on public.order_private for select to authenticated using (
  exists (select 1 from public.orders o where o.id = order_id and (
    o.client_id = (select auth.uid()) or (o.washer_id = (select auth.uid()) and o.status <> 'solicitado'))));
create policy order_events_select on public.order_events for select to authenticated using (
  exists (select 1 from public.orders o where o.id = order_id and (o.client_id = (select auth.uid()) or o.washer_id = (select auth.uid()))));

-- ========== PRIVILÉGIOS (menor privilégio) ==========
revoke all on all tables in schema public from anon, authenticated;
grant select on public.services, public.addons to anon, authenticated;
grant select, insert on public.profiles to authenticated;
grant update (nome, telefone) on public.profiles to authenticated;      -- role imutável
grant select, insert, update on public.washers to authenticated;
grant select, insert, update, delete on public.vehicles to authenticated;
grant select on public.orders, public.order_private, public.order_events to authenticated;

-- ========== RPCs (única porta de escrita em pedidos) ==========
create function public.create_order(p_vehicle uuid, p_service text, p_addons text[], p_bairro text,
  p_lat double precision, p_lng double precision, p_endereco text, p_agendado timestamptz default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_tipo text; v_base numeric; v_mult numeric; v_add numeric; v_id uuid; v_pin text;
        v_addons text[] := coalesce(p_addons, '{}');
begin
  if v_uid is null then raise exception 'não autenticado'; end if;
  if not exists (select 1 from public.profiles where id = v_uid and role = 'cliente') then raise exception 'apenas clientes podem criar pedidos'; end if;
  select tipo into v_tipo from public.vehicles where id = p_vehicle and owner_id = v_uid;
  if v_tipo is null then raise exception 'veículo inválido'; end if;
  select preco into v_base from public.services where id = p_service;
  if v_base is null then raise exception 'serviço inválido'; end if;
  if char_length(coalesce(p_endereco,'')) < 5 or char_length(coalesce(p_bairro,'')) < 2 then raise exception 'endereço inválido'; end if;
  v_mult := case v_tipo when 'moto' then 0.7 when 'suv' then 1.25 when 'caminhonete' then 1.4 when 'van' then 1.5 else 1 end;
  select coalesce(sum(preco),0) into v_add from public.addons where id = any(v_addons);
  insert into public.orders(client_id, vehicle_id, service_id, addon_ids, bairro, lat, lng, agendado_para, preco_total)
  values (v_uid, p_vehicle, p_service, v_addons, left(p_bairro,60), round(p_lat::numeric,3), round(p_lng::numeric,3), p_agendado, round(v_base*v_mult + v_add, 2))
  returning id into v_id;
  v_pin := lpad(((('x' || encode(extensions.gen_random_bytes(3),'hex'))::bit(24)::int) % 10000)::text, 4, '0');
  insert into public.order_private(order_id, endereco, telefone, lat, lng)
    select v_id, left(p_endereco,200), telefone, p_lat, p_lng from public.profiles where id = v_uid;
  insert into public.order_secrets(order_id, pin) values (v_id, v_pin);
  return jsonb_build_object('id', v_id, 'pin', v_pin);
end $$;

create function public.accept_order(p_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  if not public.is_washer() then raise exception 'apenas lavadores'; end if;
  update public.orders set washer_id = auth.uid(), status = 'confirmado', updated_at = now()
   where id = p_id and status = 'solicitado' and washer_id is null;
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'pedido indisponível'; end if;
end $$;

create function public.advance_order(p_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare v_cur public.order_status; v_next public.order_status;
begin
  select status into v_cur from public.orders where id = p_id and washer_id = auth.uid() for update;
  if v_cur is null then raise exception 'pedido não encontrado'; end if;
  v_next := case v_cur when 'confirmado' then 'a_caminho'::public.order_status when 'a_caminho' then 'chegou'::public.order_status
                       when 'em_servico' then 'finalizado'::public.order_status else null end;
  if v_next is null then raise exception 'transição inválida a partir de %', v_cur; end if;
  update public.orders set status = v_next, updated_at = now() where id = p_id;
end $$;

create function public.start_service(p_id uuid, p_pin text) returns void language plpgsql security definer set search_path = '' as $$
declare v_cur public.order_status;
begin
  select status into v_cur from public.orders where id = p_id and washer_id = auth.uid() for update;
  if v_cur is distinct from 'chegou' then raise exception 'pedido não está no estado "chegou"'; end if;
  if not exists (select 1 from public.order_secrets where order_id = p_id and pin = p_pin) then raise exception 'PIN inválido'; end if;
  update public.orders set status = 'em_servico', updated_at = now() where id = p_id;
end $$;

create function public.pay_order(p_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  update public.orders set status = 'pago', updated_at = now() where id = p_id and client_id = auth.uid() and status = 'finalizado';
  get diagnostics v_n = row_count; if v_n = 0 then raise exception 'pagamento indisponível'; end if;
end $$;

create function public.rate_order(p_id uuid, p_nota int, p_comentario text default null) returns void language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  if p_nota not between 1 and 5 then raise exception 'nota inválida'; end if;
  update public.orders set status = 'avaliado', avaliacao = p_nota, comentario = left(p_comentario,300), updated_at = now()
   where id = p_id and client_id = auth.uid() and status = 'pago';
  get diagnostics v_n = row_count; if v_n = 0 then raise exception 'avaliação indisponível'; end if;
end $$;

create function public.cancel_order(p_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  update public.orders set status = 'cancelado', updated_at = now() where id = p_id and client_id = auth.uid() and status in ('solicitado','confirmado');
  get diagnostics v_n = row_count; if v_n = 0 then raise exception 'cancelamento indisponível'; end if;
end $$;

create function public.get_pin(p_id uuid) returns text language sql stable security definer set search_path = '' as $$
  select s.pin from public.order_secrets s join public.orders o on o.id = s.order_id where s.order_id = p_id and o.client_id = (select auth.uid()); $$;

-- somente autenticados executam as RPCs; o trigger não é chamável pela API
revoke all on function public.create_order(uuid,text,text[],text,double precision,double precision,text,timestamptz),
  public.accept_order(uuid), public.advance_order(uuid), public.start_service(uuid,text), public.pay_order(uuid),
  public.rate_order(uuid,int,text), public.cancel_order(uuid), public.get_pin(uuid), public.is_washer(), public.log_order_event()
  from public, anon;
revoke all on function public.log_order_event() from authenticated;
grant execute on function public.create_order(uuid,text,text[],text,double precision,double precision,text,timestamptz),
  public.accept_order(uuid), public.advance_order(uuid), public.start_service(uuid,text), public.pay_order(uuid),
  public.rate_order(uuid,int,text), public.cancel_order(uuid), public.get_pin(uuid), public.is_washer() to authenticated;

-- ========== REALTIME ==========
alter publication supabase_realtime add table public.orders, public.order_events;
