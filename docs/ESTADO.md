# LAVBOX — ESTADO DO PROJETO (leia isto primeiro)

**Atualizado:** 2026-09-30 (noite) · **Fase:** Etapa 3 em andamento · **Pacotes A e B e mapa publicados** · site em teste com parceiros · **Próximo:** testar o painel admin; depois QR + rota (Pacote C) e slides

## Quem e o quê
Projeto acadêmico do SENAC-DF (Innovaday). Equipe de 4: Diego Rodrigo dos Santos Machado, Rodrigo Andrade da Ponte, Izabel Cristina Alves de Oliveira, Magno Guimaraes da Silva. A explicação ao professor será feita por **3 pessoas** (quem apresenta ainda a definir). Diego trabalha à noite em casa e de dia em um PC do trabalho: **tudo precisa estar no repo e na memória, nunca só numa sessão**.

## Regras de trabalho (do Diego)
Passo a passo. Perguntas claras e objetivas. **Nenhuma migration no Supabase, nenhum commit/push e nenhuma publicação sem a liberação dele**, um passo por vez. Idioma: português do Brasil. Respostas densas e diretas.

## Decisões fechadas
| # | Decisão |
|---|---|
| D1 | Nome: **LAVBOX** |
| D2 | Módulos funcionando além do núcleo: fidelidade + assinatura + Empresas (frota) |
| D3 | Fluxo: agendado + "Lavar agora" |
| D4 | Visual: escuro com neon azul/verde |
| D5 | Escopo: **abordagem C** (núcleo + QR/fotos + água + KPIs + rota + estoque), em camadas P0–P3 |
| D6 | Banco: Supabase `lavbox-demo` (ref `kpgzmedfxmatmuvujdhv`, sa-east-1) |
| D7 | Arquitetura e ADR-001 a 008 aprovados (`ARQUITETURA.md`) |
| D8 | Cadastro **sem confirmação de e-mail** na demo (aplicar só na Etapa 3, com liberação) |
| D9 | Documentos vivem em `docs/` do repo (SPEC, ARQUITETURA, REVISAO, ESTADO) — movidos da raiz em 2026-09-30 |
| D10 | **Prazo:** apresentação sexta 02/10; Diego pode mexer até quinta à noite (01/10); sem migration depois do congelamento |
| D11 | **Escopo ENXUTO** (substitui a abordagem C só para a sexta): Pages, admin, PIN 6 dígitos + bloqueio, seed, dashboard de KPIs, QR, mapa Leaflet, rota (km antes × depois). **Roadmap nos slides, sem código:** estoque, fidelidade, assinatura, Empresas e (se apertar) fotos |
| D12 | Aprovação **por pacote**: A = 3.0+3.1 · B = seed + 3.2 (dashboard) · C = 3.3 (QR+mapa) + rota |
| D13 | Admin: Diego cadastra conta normal e o Claude **promove por SQL** (`role='admin'`); nenhuma senha passa pelo Claude nem vai para o repo |
| D14 | Fluxo do cliente fica **condensado em 5 passos**; o slide mapeia os 12 passos do PDF para os 5 do app |
| D15 | Registro: tudo em `docs/` no GitHub; ao fim da sessão o Claude entrega um resumo em `.md` para WhatsApp |

## O que já existe (não refazer)
Repo `github.com/DiegoRSMachado/lavbox` (público, 3 commits, último `55306d1`): PWA vanilla, cliente + lavador em tempo real, PIN, pagamento simulado, avaliação, água (cliente), modo Palco (`#/palco`), modo offline (`?mode=local`), `supabase/schema.sql`, `tools/e2e_local.py` (passa). Supabase: 9 tabelas com RLS, RPCs, catálogo, 2 contas demo. **Site no ar: NÃO** (GitHub Pages retorna 404 até ser ativado).

## Progresso da Etapa 3
- **Pacote A (feito localmente, não commitado até a liberação):** `supabase/migrations/0004_admin_pin6.sql` (+ `.down.sql`) **já aplicada no banco**: papel `admin` (nunca pelo cadastro público), `is_admin()`, PIN de 6 dígitos, `tentativas`/`bloqueado_ate`, `start_service` retorna `jsonb` (5 erros → bloqueio de 5 min; contador persiste). Código: adapters supabase/local, tela do lavador (6 dígitos), E2E, README.
- **Testes do Pacote A (todos passaram):** matriz SQL com rollback (15 casos: auto-cadastro admin bloqueado, PIN 6 dígitos, bloqueio persiste e expira, admin sem acesso a `order_secrets`/`order_private`, regressão do fluxo completo com 8 eventos) · E2E local (fluxo, XSS inerte, zero erro de console) · advisors (só riscos aceitos + "leaked password protection" desligada).
- **Mapa e acompanhamento (feito, frontend; sem mudança no banco):** Leaflet + OpenStreetMap vendorizado; passo 4 do pedido com pino arrastável, busca de endereço (Nominatim, gratuito, só sob clique) e GPS; cliente e lavador veem o lavador **simulado** a caminho com km e ETA (posição derivada de `order.id` + hora do evento `a_caminho`: os dois veem o mesmo ponto); `js/lib/geo.js` (Haversine, testado em `tools/test_geo.mjs`). Causa do "local errado" relatado: coordenada padrão de Brasília quando o cliente não marcava o local.
- **Pacote B (feito e aplicado):** `supabase/migrations/0005_admin_dashboard.sql` (+ `.down.sql`, `supabase/purge_seed.sql`): colunas `is_seed`, RPC `admin_kpis()` (só admin; o admin **não** tem policy de leitura em tabelas, só agregados), seed fictício (25 clientes, 6 prestadores, 120 pedidos em 30 dias; usuários sem senha nem identity, fora da fila do lavador). Tela `#/admin` (KPIs, gráficos SVG, ranking, fila de recuperação nota ≤ 3, aviso "dados fictícios"). Conta admin = a conta de Diego (antes lavador), promovida por SQL em 30/09. Testes: matriz SQL (KPI = contagens diretas; não-admin negado; seed sem login) + E2E local com painel. Admin não recebe realtime (sem policy): o painel atualiza por polling de 8 s. Para apagar o seed: rodar `supabase/purge_seed.sql`.
- **Feito pelo Diego:** Pages ativo e "Confirm email" desligado (30/09). **Próximo:** testar `#/admin` no PC com a conta admin; depois Pacote C restante (QR + rota km antes × depois) e slides.
- **Limitação:** o container do Claude não alcança `supabase.co`; UI contra o Supabase real só é testada no PC/celular do Diego. Testes de banco são por SQL (MCP).

## Achados abertos (detalhes em `REVISAO.md`)
1. ~~PIN de 4 dígitos sem limite~~ **corrigido no Pacote A**. 2. Pages 404 (depende do Diego). 3. Falta admin, dashboard, fotos, QR, rota, estoque, fidelidade, assinatura, Empresas. 4. Confirmação de e-mail no cadastro. 5. Admin sem botão público. 6. Avisos de advisors são riscos aceitos e documentados.

## Plano da Etapa 3 (um passo por vez, cada um com liberação)
3.0 Ativar Pages e conferir o site · 3.1 `admin` + policy de cadastro + PIN 6 dígitos com bloqueio + cadastro sem confirmação · 3.2 Dashboard admin e KPIs · 3.3 Fotos, QR, mapa Leaflet · 3.4 Rota e estoque · 3.5 Fidelidade, assinatura, Empresas · 3.6 Seed fictício, E2E completo, revisão de segurança, checklist de deploy. Etapa 4: documento explicativo e **roteiro para 3 apresentadores** (~4 min cada; estrutura em `REVISAO.md` §6).

## Pendências que dependem do Diego
- Definir quais 3 dos 4 membros apresentam.
- Conferir se "leaked password protection" existe no plano free (Claude não tem certeza).

## Como retomar (prompt para colar na nova tarefa com o repo lavbox como fonte)
> Retome o projeto LAVBOX. Leia `docs/ESTADO.md`, `docs/ARQUITETURA.md`, `docs/SPEC.md` e `docs/REVISAO.md` do repositório e a memória. Etapas 1 e 2 estão aprovadas. Antes de qualquer coisa, teste se você consegue gravar no repo (`git push --dry-run`) e se o Supabase `lavbox-demo` aparece. Depois me proponha o passo 3.0 e espere minha liberação. Não altere o repo nem o banco sem eu liberar.
