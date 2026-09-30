-- Contas DEMO (dados fictícios) usadas pelos botões "Entrar como Cliente / Lavador".
-- Senha: a mesma de js/config.js (DEMO). São contas sem valor; o admin NÃO tem conta demo.
do $$
declare c uuid := '00000000-0000-4000-a000-00000000c001'; w uuid := '00000000-0000-4000-a000-00000000d002';
begin
  insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
      raw_app_meta_data,raw_user_meta_data,created_at,updated_at,
      confirmation_token,recovery_token,email_change_token_new,email_change)
  values
   ('00000000-0000-0000-0000-000000000000',c,'authenticated','authenticated','cliente.demo@lavbox.app',
     extensions.crypt('Lavbox#Demo2026',extensions.gen_salt('bf')),now(),
     '{"provider":"email","providers":["email"]}','{}',now(),now(),'','','',''),
   ('00000000-0000-0000-0000-000000000000',w,'authenticated','authenticated','lavador.demo@lavbox.app',
     extensions.crypt('Lavbox#Demo2026',extensions.gen_salt('bf')),now(),
     '{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','')
  on conflict (id) do nothing;
  insert into auth.identities(id,user_id,identity_data,provider,provider_id,last_sign_in_at,created_at,updated_at)
  values
   (gen_random_uuid(),c,jsonb_build_object('sub',c::text,'email','cliente.demo@lavbox.app'),'email',c::text,now(),now(),now()),
   (gen_random_uuid(),w,jsonb_build_object('sub',w::text,'email','lavador.demo@lavbox.app'),'email',w::text,now(),now(),now())
  on conflict do nothing;
  insert into public.profiles(id,role,nome,telefone) values
    (c,'cliente','Ana Demo','(61) 90000-0001'),(w,'lavador','Carlos Demo','(61) 90000-0002')
  on conflict (id) do nothing;
  insert into public.washers(id,bairro,servicos,bio) values
    (w,'Asa Sul','{basico,completo,premium,ecowash}','Lavador de demonstração')
  on conflict (id) do nothing;
  insert into public.vehicles(owner_id,tipo,modelo,cor)
    select c,'suv','Jeep Compass','Preto' where not exists (select 1 from public.vehicles where owner_id=c);
end $$;
