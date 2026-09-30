-- Matriz de segurança do Pacote A (admin, PIN de 6 dígitos, bloqueio de tentativas e regressão do fluxo).
-- Roda em uma transação com usuários fictícios e TERMINA COM ERRO PROPOSITAL: nada persiste; o relatório vai na mensagem.
do $$
declare
  c uuid := gen_random_uuid(); w uuid := gen_random_uuid(); a uuid := gen_random_uuid();
  v uuid; oid uuid; pin text; r jsonb; res text := ''; t int; wrong text;
begin
  insert into auth.users(id,instance_id,aud,role,email) values
    (c,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','c@t.test'),
    (w,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','w@t.test'),
    (a,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','a@t.test');

  perform set_config('request.jwt.claims', json_build_object('sub',a,'role','authenticated')::text, true);
  set local role authenticated;
  begin insert into public.profiles(id,role,nome) values (a,'admin','Invasor');
        res := res||'A1 auto-cadastro como admin: FALHOU (permitiu)'||E'\n';
  exception when others then res := res||'A1 auto-cadastro como admin: BLOQUEADO'||E'\n'; end;
  insert into public.profiles(id,role,nome) values (a,'cliente','Futuro Admin');
  begin update public.profiles set role='admin' where id=a; res := res||'A2 UPDATE role->admin: FALHOU'||E'\n';
  exception when others then res := res||'A2 UPDATE role->admin: BLOQUEADO'||E'\n'; end;
  reset role;

  update public.profiles set role='admin' where id=a;   -- promoção legítima (SQL privilegiado)
  perform set_config('request.jwt.claims', json_build_object('sub',c,'role','authenticated')::text, true);
  set local role authenticated;
  insert into public.profiles(id,role,nome,telefone) values (c,'cliente','Cliente','61999990000');
  insert into public.vehicles(owner_id,tipo,modelo) values (c,'carro','Civic') returning id into v;
  r := public.create_order(v,'basico','{}','Asa Sul',-15.8,-47.9,'SQS 308 bloco A',null);
  oid := (r->>'id')::uuid; pin := r->>'pin';
  res := res || format('A4 PIN tem 6 digitos: %s%s', pin ~ '^[0-9]{6}$', E'\n');
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub',w,'role','authenticated')::text, true);
  set local role authenticated;
  insert into public.profiles(id,role,nome) values (w,'lavador','Lavador');
  insert into public.washers(id,bairro) values (w,'Asa Sul');
  perform public.accept_order(oid); perform public.advance_order(oid); perform public.advance_order(oid);
  wrong := case when pin = '000000' then '111111' else '000000' end;
  res := res || format('A5 formato invalido: %s%s', public.start_service(oid,'abc'), E'\n');
  r := public.start_service(oid, wrong);  res := res || format('A6 1o erro: %s (esperado restantes=4)%s', r, E'\n');
  for t in 2..4 loop r := public.start_service(oid, wrong); end loop;
  res := res || format('A7 4o erro: %s (esperado restantes=1)%s', r, E'\n');
  r := public.start_service(oid, wrong);  res := res || format('A8 5o erro: %s (esperado bloqueado)%s', r, E'\n');
  r := public.start_service(oid, pin);    res := res || format('A9 PIN correto durante bloqueio: %s (esperado bloqueado)%s', r, E'\n');
  reset role;
  res := res || format('A10 bloqueio persistiu: %s%s', (select bloqueado_ate > now() from public.order_secrets where order_id=oid), E'\n');
  update public.order_secrets set bloqueado_ate = now() - interval '1 second' where order_id = oid;   -- simula os 5 min

  perform set_config('request.jwt.claims', json_build_object('sub',w,'role','authenticated')::text, true);
  set local role authenticated;
  r := public.start_service(oid, pin);  res := res || format('A11 apos expirar, PIN correto: %s (esperado ok=true)%s', r, E'\n');
  perform public.advance_order(oid);
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub',a,'role','authenticated')::text, true);
  set local role authenticated;
  res := res || format('A12 admin le order_private: %s, orders: %s (esperado 0/0)%s', (select count(*) from public.order_private), (select count(*) from public.orders), E'\n');
  res := res || format('A13 admin em order_secrets: %s%s', (case when has_table_privilege('authenticated','public.order_secrets','select') then 'PRIVILEGIO ABERTO' else 'sem privilegio' end), E'\n');
  begin insert into public.washers(id,bairro) values (a,'DF'); res := res||'A14 admin vira lavador: FALHOU'||E'\n';
  exception when others then res := res||'A14 admin vira lavador: BLOQUEADO'||E'\n'; end;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub',c,'role','authenticated')::text, true);
  set local role authenticated;
  perform public.pay_order(oid); perform public.rate_order(oid,5,'ok');
  res := res || format('A15 regressao: status=%s, eventos=%s (esperado avaliado, 8)%s', (select status from public.orders where id=oid), (select count(*) from public.order_events where order_id=oid), E'\n');
  reset role;
  raise exception E'RESULTADOS (rollback proposital):\n%', res;
end $$;
