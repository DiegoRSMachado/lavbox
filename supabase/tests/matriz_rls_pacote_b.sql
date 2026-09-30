-- Matriz do Pacote B (admin_kpis, admin sem dados pessoais, seed sem login e fora da fila do lavador).
-- Usa o admin real (role='admin', não seed) e uma conta demo de cliente. Termina com erro proposital (nada persiste).
do $$
declare adm uuid; cli uuid; r jsonb; res text := ''; s int; tot int; pool int;
begin
  select id into adm from public.profiles where role='admin' and not is_seed limit 1;
  select id into cli from public.profiles where role='cliente' and not is_seed and nome like 'Ana%' limit 1;
  res := res || format('B0 admin real encontrado: %s%s', adm is not null, E'\n');

  perform set_config('request.jwt.claims', json_build_object('sub',cli,'role','authenticated')::text, true);
  set local role authenticated;
  begin perform public.admin_kpis(); res := res||'B1 cliente chama admin_kpis: FALHOU (permitiu)'||E'\n';
  exception when others then res := res||'B1 cliente chama admin_kpis: BLOQUEADO ('||sqlerrm||')'||E'\n'; end;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub',adm,'role','authenticated')::text, true);
  set local role authenticated;
  r := public.admin_kpis();
  res := res || format('B2 admin_kpis: total=%s seed=%s receita=%s ticket=%s nota=%s agua=%sL%s',
     r->>'total_pedidos', r->>'pedidos_seed', r->>'receita', r->>'ticket_medio', r->>'nota_media', r->>'agua_economizada_l', E'\n');
  res := res || format('B3 order_secrets: %s%s',
     (case when has_table_privilege('authenticated','public.order_secrets','select') then 'PRIVILEGIO ABERTO' else 'sem privilegio' end), E'\n');
  reset role;

  select count(*) into tot from public.orders;
  select coalesce(sum(value::int),0) into s from jsonb_each_text(r->'por_status');
  res := res || format('B4 soma por_status=%s total=%s direto=%s (iguais)%s', s, r->>'total_pedidos', tot, E'\n');
  res := res || format('B5 por_hora soma=%s (= total), por_dia: %s posicoes%s', (select sum(v::int) from jsonb_array_elements_text(r->'por_hora') v), jsonb_array_length(r->'por_dia'), E'\n');
  res := res || format('B6 receita direta=%s (KPI=%s)%s', (select sum(preco_total) from public.orders where status in ('pago','avaliado')), r->>'receita', E'\n');
  select count(*) into pool from public.orders where is_seed and status not in ('avaliado','pago','cancelado');
  res := res || format('B7 pedidos seed ativos (fila do lavador): %s (esperado 0)%s', pool, E'\n');
  res := res || format('B8 usuarios seed: %s, com senha: %s, com identity: %s (esperado 31/0/0)%s',
     (select count(*) from auth.users where raw_user_meta_data->>'seed'='true'),
     (select count(*) from auth.users where raw_user_meta_data->>'seed'='true' and encrypted_password <> ''),
     (select count(*) from auth.identities i join auth.users u on u.id=i.user_id where u.raw_user_meta_data->>'seed'='true'), E'\n');
  raise exception E'RESULTADOS (rollback proposital):\n%', res;
end $$;
