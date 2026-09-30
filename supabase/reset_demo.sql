-- Zera os pedidos de TESTE (reais) antes da apresentação, preservando contas, veículos e o seed fictício.
-- Rode no SQL Editor do Supabase (ou peça ao Claude). Não afeta pedidos com is_seed = true.
-- Efeito: a fila do lavador e os históricos das contas demo ficam limpos; o painel continua com os 120 pedidos fictícios.
delete from public.orders where not is_seed;   -- order_events, order_private e order_secrets saem em cascata
