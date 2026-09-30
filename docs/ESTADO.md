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
- **QR e rota (feito, frontend; sem mudança no banco):** cliente vê o QR do código de 6 dígitos (`LAVBOX|<id do pedido>|<pin>`, gerado no navegador); prestador lê pela câmera (jsQR, vendorizado) ou digita; QR de outro pedido ou inválido é recusado; o servidor segue validando o PIN e limitando tentativas (o QR **não** acrescenta segurança, é conveniência). Rota: `#/lavador/rota` compara ordem de aceite × vizinho mais próximo (`js/lib/route.js`, função pura): km antes/depois, % de economia, combustível (estimativa: 10 km/L, R$ 6,00/L), tempo a 30 km/h, mapa com as duas linhas; botão "Simular 5 paradas" para demonstrar sem 5 pedidos reais. Testes: `tools/test_route.mjs` (heurístico vs. ótimo por força bruta: média 1,07×, pior 1,26× em 30 casos de 7 pontos) e E2E com câmera falsa (QR → jsQR → início do serviço).
- **Validado pelo Diego no Supabase real (30/09):** `#/admin` com a conta admin mostra KPIs, gráficos, ranking e fila de recuperação; Pages no ar; cadastro sem confirmação. **Ajustes depois disso:** rótulos curtos no gráfico de status e estrelas legíveis na fila de recuperação; `supabase/reset_demo.sql` (limpa pedidos reais de teste, preserva seed) e `.github/workflows/keepalive.yml` (ping diário contra a pausa do plano gratuito). **Advisors de performance (riscos aceitos, 121 pedidos):** índices ausentes em `orders.service_id`/`vehicle_id` e duas policies permissivas em `vehicles`; sem migration para isso antes de sexta.
- **Versão final dos slides (30/09):** time identificado como Membro 1 a 4 (Rodrigo, Izabel, Magno, Diego); **notas do apresentador** em cada um dos 13 slides; roteiro usa Membro 1, 2 e 3 para falar e Membro 4 como apoio técnico/operador da demo. A divisão definitiva é na quinta (basta trocar os nomes).
- **Feito pelo Diego:** Pages ativo e "Confirm email" desligado (30/09). **Slides prontos:** `docs/apresentacao/LAVBOX_apresentacao.pptx` (13 slides, template SENAC; nome LAVBOX e data 02/10/2026 corrigidos; Diego incluído no time — conferir; capturas do app vindas dos testes automatizados, trocar por capturas reais se preferir) e `docs/ROTEIRO_APRESENTACAO.md` (3 apresentadores, demo, perguntas da banca, checklist). **Próximo:** testar `#/admin`, o QR (câmera real no celular) e `#/lavador/rota` no Supabase real; definir quem é o apresentador 1, 2 e 3; ensaiar e gravar o vídeo de backup.
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
