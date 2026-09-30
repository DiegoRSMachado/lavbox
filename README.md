# LAVBOX · Premium Car Care

PWA de demonstração do projeto **LAVBOX** (lavagem automotiva sob demanda) — SENAC Innovaday, Faculdade de Tecnologia e Inovação Senac-DF.
Cadastro de **clientes** e **lavadores**, pedido em 5 telas, **acompanhamento em tempo real**, mapa, código/QR de início, rota otimizada do prestador e painel do administrador.

> Ambiente de demonstração acadêmica. Use apenas dados fictícios. Pagamento simulado (nenhum dado financeiro é coletado).

## Endereços
- **App:** https://diegorsmachado.github.io/lavbox/ · **Palco:** `/#/palco` · **Offline:** `/?mode=local#/palco`
- **Supabase:** projeto `lavbox-demo` (ref `kpgzmedfxmatmuvujdhv`, região sa-east-1) · painel: https://supabase.com/dashboard/project/kpgzmedfxmatmuvujdhv
- **Documentação:** `docs/ESTADO.md` (**ler primeiro**), `docs/ARQUITETURA.md` (ADRs), `docs/SPEC.md`, `docs/ROTEIRO_APRESENTACAO.md`, slides em `docs/apresentacao/`.

## Continuar em casa (passo a passo)
```bash
git clone https://github.com/DiegoRSMachado/lavbox && cd lavbox
python3 -m http.server 8765                # abrir http://localhost:8765/?mode=local#/palco  (offline) ou sem ?mode=local (Supabase real)
node tools/test_geo.mjs && node tools/test_route.mjs        # testes unitários (Node 22+)
pip install playwright && python3 tools/e2e_local.py        # E2E completo em modo offline (precisa de Chromium)
```
- **Deploy:** cada `git push` na `main` publica sozinho no GitHub Pages (sem build). O service worker usa rede primeiro, então a versão nova aparece ao recarregar.
- **Banco:** ver `supabase/README.md` (ordem das migrations, conta admin, seed, testes SQL).
- **Sem build e sem CDN em runtime:** `vendor/` tem supabase-js, Leaflet, qrcode-generator e jsQR.

## Arquitetura
```
GitHub Pages (estático, HTTPS)
└─ PWA vanilla (ES modules, sem build)
   ├─ js/api.js ── escolhe o adapter: supabase.js (produção) ou local.js (?mode=local, offline)
   ├─ views/  cliente · lavador · admin · rota · palco · mapa · QR
   ├─ lib/    geo.js (Haversine, ETA) · route.js (vizinho mais próximo)
   └─ sw.js   rede-primeiro + fallback de cache

Supabase (free)
├─ Auth e-mail/senha (Confirm email DESLIGADO na demo)
├─ Postgres + RLS em todas as tabelas
├─ Funções SECURITY DEFINER = única porta de escrita (create/accept/advance/start_service/pay/rate/cancel, admin_kpis)
└─ Realtime em orders e order_events
```
Máquina de estados: `solicitado → confirmado → a_caminho → chegou → em_servico → finalizado → pago → avaliado` (+ `cancelado`).
`em_servico` só com o **código de 6 dígitos** (ou QR) do cliente, conferido no servidor, com **bloqueio de 5 min após 5 erros**.

## Modelo de ameaças (resumo)
| Ameaça | Controle |
|---|---|
| Ver dados de outro cliente | RLS por `auth.uid()` |
| Lavador pula etapas / finaliza sem chegar | Sem `UPDATE` direto; funções validam a sequência |
| Lavador vê endereço sem aceitar | `order_private` só para cliente e lavador aceito |
| Falso início do serviço | Código em `order_secrets` (sem policy), conferido no servidor, com bloqueio |
| Cadastro como admin | `admin` só por SQL privilegiado; `profiles_insert` aceita só cliente/lavador |
| Admin lendo dados pessoais | Admin não tem policy de leitura: só agregados via `admin_kpis()` |
| Preço adulterado | Calculado no servidor (`create_order`) |
| XSS | DOM só via `textContent` + CSP restritiva (sem script/estilo inline) |
| Segredo no repositório | Só a chave *publishable* no frontend; `service_role` nunca |

Riscos aceitos: avisos do linter sobre funções `SECURITY DEFINER` chamáveis por usuários logados (são a API de escrita por desenho); "leaked password protection" desligada (plano gratuito); 2 índices ausentes e 1 policy duplicada (irrelevante no volume da demo).

## Limites declarados (demonstração)
Pagamento simulado · posição do lavador simulada · distância em linha reta (sem trânsito) · painel com 120 pedidos fictícios rotulados (`is_seed`) · IA, estoque, fidelidade, assinatura, Empresas e fotos antes/depois ficam no roadmap.
