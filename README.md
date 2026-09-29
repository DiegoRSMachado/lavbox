# LAVBOX · Premium Car Care

PWA de demonstração do projeto **LAVBOX** (lavagem automotiva sob demanda) — SENAC Innovaday, Faculdade de Tecnologia e Inovação Senac-DF.
Mostra cadastro de **clientes** e **lavadores**, a jornada de pedido e o **acompanhamento em tempo real** entre os dois perfis.

> Ambiente de demonstração acadêmica. Use apenas dados fictícios. Pagamento simulado (nenhum dado financeiro é coletado).

## Arquitetura

```
GitHub Pages (estático, HTTPS)
└─ PWA vanilla (ES modules, sem build)
   ├─ js/api.js ── escolhe o adapter
   │    ├─ adapters/supabase.js   produção da demo (Auth + Postgres/RLS + Realtime)
   │    └─ adapters/local.js      fallback OFFLINE (?mode=local): localStorage + BroadcastChannel
   ├─ views/  cliente · lavador · palco (2 telas lado a lado)
   ├─ sw.js   rede-primeiro + fallback de cache (app abre offline)
   └─ vendor/supabase.js  (vendorizado: sem CDN em runtime)

Supabase (free)
├─ Auth e-mail/senha
├─ Postgres: profiles, washers, vehicles, services, addons,
│            orders, order_private, order_secrets, order_events (auditoria append-only)
├─ RLS em todas as tabelas + RPCs SECURITY DEFINER para toda transição de estado
└─ Realtime (postgres_changes) em orders e order_events
```

Máquina de estados: `solicitado → confirmado → a_caminho → chegou → em_servico → finalizado → pago → avaliado` (+ `cancelado`).
`em_servico` só acontece com o **PIN de 4 dígitos** do cliente, validado no servidor.

## Modelo de ameaças (resumo)

| Ameaça | Controle |
|---|---|
| IDOR entre clientes | RLS por `auth.uid()` |
| Lavador pula etapas / finaliza sem chegar | Sem `UPDATE` direto; RPC valida a máquina de estados |
| Lavador vê PII sem aceitar o pedido | `order_private` só para cliente e lavador aceito |
| Registro falso de "serviço iniciado" | PIN em `order_secrets` (sem policy), conferido no servidor |
| Escalada de papel | `role` sem privilégio de UPDATE e `CHECK (cliente\|lavador)` |
| XSS armazenado | DOM só via `textContent` + CSP restritiva (sem inline) |
| Vazamento de segredo | Só a chave *publishable* no frontend; `service_role` nunca |
| Preço adulterado | Preço calculado no servidor (`create_order`) |

`supabase/schema.sql` contém o schema, as policies e as RPCs. `tools/e2e_local.py` executa o fluxo completo (cliente + lavador) em modo offline, incluindo teste de XSS.

## Rodar local

```bash
python3 -m http.server 8765        # e abra http://localhost:8765/?mode=local
pip install playwright && python3 tools/e2e_local.py   # E2E (requer Chromium)
```

## Modos de apresentação

- `#/palco` — cliente e lavador lado a lado no mesmo navegador (sessões isoladas por `?slot=`).
- `?mode=local` — 100% offline, sem depender de rede (fallback da demo).
- Contas demo na tela inicial ("Entrar como Cliente / Lavador").

## Publicar

Settings → Pages → *Deploy from a branch* → `main` / `/ (root)`.
