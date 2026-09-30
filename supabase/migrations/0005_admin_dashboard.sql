-- 0005 · Pacote B (ADR-005): KPIs do admin por RPC + seed FICTÍCIO rotulado.
-- O admin NÃO tem policy de leitura em nenhuma tabela: só enxerga agregados via admin_kpis()
-- (menor privilégio; endereço e PIN continuam fora de alcance). Desfazer: 0005_admin_dashboard.down.sql
-- Apagar só o seed: supabase/purge_seed.sql

alter table public.profiles add column is_seed boolean not null default false;
alter table public.orders   add column is_seed boolean not null default false;

-- ===================== KPIs (somente admin) =====================
create function public.admin_kpis() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'acesso negado'; end if;
  select jsonb_build_object(
    'gerado_em', now(),
    'total_pedidos', (select count(*) from public.orders),
    'pedidos_seed', (select count(*) from public.orders where is_seed),
    'em_andamento', (select count(*) from public.orders where status not in ('avaliado','cancelado')),
    'por_status', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
                     from (select status, count(*) n from public.orders group by status) s),
    'receita', (select coalesce(sum(preco_total),0) from public.orders where status in ('pago','avaliado')),
    'ticket_medio', (select coalesce(round(avg(preco_total),2),0) from public.orders where status in ('pago','avaliado')),
    'nota_media', (select round(avg(avaliacao),2) from public.orders where avaliacao is not null),
    'agua_economizada_l', (select coalesce(sum(150 - s.agua_litros),0)
                             from public.orders o join public.services s on s.id = o.service_id
                            where s.ecologico and o.status in ('pago','avaliado')),
    'tempo_medio_min', (select round((avg(extract(epoch from (f.at - i.at))) / 60)::numeric, 1)
                          from public.order_events i
                          join public.order_events f on f.order_id = i.order_id and f.para = 'finalizado'
                         where i.para = 'em_servico'),
    'por_servico', (select coalesce(jsonb_agg(jsonb_build_object('nome', s.nome, 'qtd', x.n, 'receita', x.rec) order by x.n desc), '[]'::jsonb)
                      from (select service_id, count(*) n,
                                   coalesce(sum(preco_total) filter (where status in ('pago','avaliado')),0) rec
                              from public.orders group by service_id) x
                      join public.services s on s.id = x.service_id),
    'por_bairro', (select coalesce(jsonb_agg(jsonb_build_object('nome', b.bairro, 'qtd', b.n) order by b.n desc), '[]'::jsonb)
                     from (select initcap(bairro) as bairro, count(*) n from public.orders group by 1 order by 2 desc limit 8) b),
    'por_hora', (select jsonb_agg(coalesce(c.n, 0) order by g.h)
                   from generate_series(0, 23) g(h)
                   left join (select extract(hour from created_at at time zone 'America/Sao_Paulo')::int hr, count(*) n
                                from public.orders group by 1) c on c.hr = g.h),
    'por_dia', (select jsonb_agg(jsonb_build_object('dia', to_char(g.d, 'DD/MM'), 'qtd', coalesce(c.n, 0)) order by g.d)
                  from generate_series(((now() at time zone 'America/Sao_Paulo')::date - 13)::timestamp,
                                       ((now() at time zone 'America/Sao_Paulo')::date)::timestamp, interval '1 day') g(d)
                  left join (select (created_at at time zone 'America/Sao_Paulo')::date dia, count(*) n
                               from public.orders group by 1) c on c.dia = g.d::date),
    'ranking', (select coalesce(jsonb_agg(jsonb_build_object('nome', t.nome, 'concluidos', t.conc, 'nota', t.nota)
                                          order by t.nota desc nulls last, t.conc desc), '[]'::jsonb)
                  from (select p.nome, count(*) conc, round(avg(o.avaliacao), 2) nota
                          from public.orders o join public.profiles p on p.id = o.washer_id
                         where o.status in ('pago','avaliado')
                         group by p.id, p.nome order by 3 desc nulls last, 2 desc limit 6) t),
    'alertas', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'servico', s.nome, 'bairro', a.bairro,
                                          'nota', a.avaliacao, 'comentario', a.comentario, 'quando', a.updated_at)
                                          order by a.updated_at desc), '[]'::jsonb)
                  from (select * from public.orders where avaliacao <= 3 order by updated_at desc limit 8) a
                  join public.services s on s.id = a.service_id)
  ) into r;
  return r;
end $$;
revoke all on function public.admin_kpis() from public, anon;
grant execute on function public.admin_kpis() to authenticated;

-- ===================== SEED FICTÍCIO (is_seed = true) =====================
-- 25 clientes, 6 prestadores, ~120 pedidos (30 dias) em estados finais. Usuários sem senha utilizável
-- (encrypted_password vazio, sem identity): não conseguem logar. Não aparecem na fila do lavador.
do $$
declare
  nomes_c text[] := array['Ana Beatriz Lima','Bruno Carvalho','Camila Ferreira','Daniel Souza','Eduarda Alves','Felipe Rocha','Gabriela Nunes',
    'Henrique Dias','Isabela Martins','João Pedro Gomes','Karina Barbosa','Lucas Teixeira','Mariana Costa','Nicolas Pereira','Olívia Ramos',
    'Paulo Henrique Melo','Quésia Araújo','Rafael Monteiro','Sabrina Cardoso','Thiago Freitas','Úrsula Campos','Vinícius Lopes','Wanessa Reis',
    'Xavier Duarte','Yasmin Moura'];
  nomes_l text[] := array['Carlos Eduardo (seed)','Marcos Vinícius (seed)','Rogério Silva (seed)','Patrícia Gomes (seed)','Anderson Lima (seed)','Jéssica Tavares (seed)'];
  qual numeric[] := array[0.9,0.8,0.7,0.6,0.5,0.4];
  bairros text[] := array['Asa Sul','Asa Norte','Lago Sul','Lago Norte','Sudoeste','Águas Claras','Taguatinga','Guará','Noroeste','Park Way','Octogonal','Cruzeiro'];
  modelos jsonb := '{"carro":["Onix","HB20","Civic","Corolla"],"moto":["CG 160","Fazer 250"],"suv":["Compass","Creta","T-Cross"],"caminhonete":["Hilux","S10"],"van":["Sprinter","Master"]}';
  horas int[] := array[7,8,8,9,9,9,10,10,10,11,11,12,13,14,14,15,15,16,16,17,18];
  ruins text[] := array['Atrasou um pouco','Faltou cuidado nos vidros','Esperava um acabamento melhor','Demorou mais que o previsto'];
  cli uuid[] := '{}'; vid uuid[] := '{}'; vtipo text[] := '{}'; lav uuid[] := '{}';
  uid uuid; v uuid; tipo text; i int; n int; ci int; li int; k int;
  svc text; sp numeric; dur int; adds text[]; addsum numeric; mult numeric; price numeric;
  created timestamptz; tc timestamptz; ta timestamptz; tch timestamptz; ti timestamptz; tf timestamptz; tp timestamptz; tav timestamptz; last_at timestamptz;
  oid uuid; r numeric; nota int; st public.order_status; cancel boolean;
begin
  perform setseed(0.42);
  for i in 1..25 loop
    uid := gen_random_uuid();
    insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,
                           created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change)
    values ('00000000-0000-0000-0000-000000000000',uid,'authenticated','authenticated','seed.cliente'||i||'@seed.lavbox.test','',now(),
            '{"provider":"email","providers":["email"]}','{"seed":true}',now(),now(),'','','','');
    insert into public.profiles(id,role,nome,is_seed) values (uid,'cliente',nomes_c[i],true);
    tipo := (array['carro','carro','carro','carro','carro','suv','suv','suv','moto','caminhonete','van'])[1 + floor(random()*11)::int];
    v := gen_random_uuid();
    insert into public.vehicles(id,owner_id,tipo,modelo)
      values (v, uid, tipo, (modelos->tipo)->>(floor(random()*jsonb_array_length(modelos->tipo))::int));
    cli := cli || uid; vid := vid || v; vtipo := vtipo || tipo;
  end loop;

  for i in 1..6 loop
    uid := gen_random_uuid();
    insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,
                           created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change)
    values ('00000000-0000-0000-0000-000000000000',uid,'authenticated','authenticated','seed.lavador'||i||'@seed.lavbox.test','',now(),
            '{"provider":"email","providers":["email"]}','{"seed":true}',now(),now(),'','','','');
    insert into public.profiles(id,role,nome,is_seed) values (uid,'lavador',nomes_l[i],true);
    insert into public.washers(id,bairro,servicos,bio)
      values (uid, bairros[1 + floor(random()*12)::int], '{basico,completo,premium,ecowash}', 'Prestador fictício (seed)');
    lav := lav || uid;
  end loop;

  alter table public.orders disable trigger trg_order_events;   -- os eventos do seed levam timestamps históricos

  for n in 1..120 loop
    ci := 1 + floor(random()*25)::int; li := 1 + floor(random()*6)::int;
    svc := (array['basico','completo','completo','completo','premium','ecowash','ecowash'])[1 + floor(random()*7)::int];
    select preco, duracao_min into sp, dur from public.services where id = svc;
    adds := '{}';
    if random() < 0.3 then
      k := 1 + floor(random()*2)::int;
      select array_agg(id) into adds from (select id from public.addons order by random() limit k) a;
    end if;
    select coalesce(sum(preco),0) into addsum from public.addons where id = any(adds);
    mult := case vtipo[ci] when 'moto' then 0.7 when 'suv' then 1.25 when 'caminhonete' then 1.4 when 'van' then 1.5 else 1 end;
    price := round(sp * mult + addsum, 2);

    created := ((date_trunc('day', now() at time zone 'America/Sao_Paulo') - ((1 + floor(random()*30)::int) || ' days')::interval
               + (horas[1 + floor(random()*array_length(horas,1))::int] || ' hours')::interval
               + (floor(random()*60) || ' minutes')::interval) at time zone 'America/Sao_Paulo');
    oid := gen_random_uuid();
    cancel := random() < 0.06;

    if cancel then
      insert into public.orders(id,client_id,washer_id,vehicle_id,service_id,addon_ids,bairro,lat,lng,preco_total,status,created_at,updated_at,is_seed)
      values (oid,cli[ci],null,vid[ci],svc,adds,bairros[1 + floor(random()*12)::int],
              round((-15.79 + (random()-0.5)*0.2)::numeric,3), round((-47.89 + (random()-0.5)*0.2)::numeric,3),
              price,'cancelado',created,created + interval '5 minutes',true);
      insert into public.order_events(order_id,de,para,actor,at) values
        (oid,null,'solicitado',cli[ci],created),(oid,'solicitado','cancelado',cli[ci],created + interval '5 minutes');
    else
      tc  := created + ((2 + random()*6)   || ' minutes')::interval;
      ta  := tc      + ((1 + random()*3)   || ' minutes')::interval;
      tch := ta      + ((8 + random()*17)  || ' minutes')::interval;
      ti  := tch     + ((1 + random()*2)   || ' minutes')::interval;
      tf  := ti      + ((dur * (0.8 + random()*0.5)) || ' minutes')::interval;
      tp  := tf      + ((1 + random()*4)   || ' minutes')::interval;
      r := random() + (qual[li] - 0.65) * 0.5;
      nota := case when r > 0.55 then 5 when r > 0.25 then 4 when r > 0.05 then 3 when r > -0.1 then 2 else 1 end;
      if random() < 0.93 then
        st := 'avaliado'; tav := tp + ((5 + random()*55) || ' minutes')::interval; last_at := tav;
      else
        st := 'pago'; nota := null; last_at := tp;
      end if;
      insert into public.orders(id,client_id,washer_id,vehicle_id,service_id,addon_ids,bairro,lat,lng,preco_total,status,avaliacao,comentario,created_at,updated_at,is_seed)
      values (oid,cli[ci],lav[li],vid[ci],svc,adds,bairros[1 + floor(random()*12)::int],
              round((-15.79 + (random()-0.5)*0.2)::numeric,3), round((-47.89 + (random()-0.5)*0.2)::numeric,3),
              price,st,nota, case when nota is not null and nota <= 3 then ruins[1 + floor(random()*4)::int] end,
              created,last_at,true);
      insert into public.order_events(order_id,de,para,actor,at) values
        (oid,null,'solicitado',cli[ci],created),(oid,'solicitado','confirmado',lav[li],tc),(oid,'confirmado','a_caminho',lav[li],ta),
        (oid,'a_caminho','chegou',lav[li],tch),(oid,'chegou','em_servico',lav[li],ti),(oid,'em_servico','finalizado',lav[li],tf),
        (oid,'finalizado','pago',cli[ci],tp);
      if st = 'avaliado' then
        insert into public.order_events(order_id,de,para,actor,at) values (oid,'pago','avaliado',cli[ci],tav);
      end if;
    end if;
  end loop;

  alter table public.orders enable trigger trg_order_events;
end $$;
