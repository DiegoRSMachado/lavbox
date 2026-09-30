-- Apaga TODOS os dados fictícios (is_seed) do LAVBOX. Seguro de rodar a qualquer momento:
-- não toca em pedidos nem contas reais. Usuários seed removem em cascata perfil, prestador e veículos.
delete from public.orders where is_seed;   -- order_events sai em cascata
delete from auth.users where raw_user_meta_data->>'seed' = 'true';
