# LAVBOX — ESTADO DO PROJETO (leia isto primeiro)

**Atualizado:** 2026-09-30 · **Fase:** Etapas 1 e 2 CONCLUÍDAS e aprovadas pelo Diego · **Próximo:** Etapa 3, passo 3.0

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
| D9 | Documentos vivem em `docs/` do repo (SPEC, ARQUITETURA, REVISAO, ESTADO) |

## O que já existe (não refazer)
Repo `github.com/DiegoRSMachado/lavbox` (público, 3 commits, último `55306d1`): PWA vanilla, cliente + lavador em tempo real, PIN, pagamento simulado, avaliação, água (cliente), modo Palco (`#/palco`), modo offline (`?mode=local`), `supabase/schema.sql`, `tools/e2e_local.py` (passa). Supabase: 9 tabelas com RLS, RPCs, catálogo, 2 contas demo. **Site no ar: NÃO** (GitHub Pages retorna 404 até ser ativado).

## Achados abertos (detalhes em `REVISAO.md`)
1. PIN de 4 dígitos sem limite de tentativas (ADR-003 corrige). 2. Pages 404. 3. Falta admin, dashboard, fotos, QR, rota, estoque, fidelidade, assinatura, Empresas. 4. Confirmação de e-mail no cadastro. 5. Admin sem botão público. 6. Avisos de advisors são riscos aceitos e documentados.

## Plano da Etapa 3 (um passo por vez, cada um com liberação)
3.0 Ativar Pages e conferir o site · 3.1 `admin` + policy de cadastro + PIN 6 dígitos com bloqueio + cadastro sem confirmação · 3.2 Dashboard admin e KPIs · 3.3 Fotos, QR, mapa Leaflet · 3.4 Rota e estoque · 3.5 Fidelidade, assinatura, Empresas · 3.6 Seed fictício, E2E completo, revisão de segurança, checklist de deploy. Etapa 4: documento explicativo e **roteiro para 3 apresentadores** (~4 min cada; estrutura em `REVISAO.md` §6).

## Pendências que dependem do Diego
- Definir quais 3 dos 4 membros apresentam.
- Conferir se "leaked password protection" existe no plano free (Claude não tem certeza).

## Como retomar (prompt para colar na nova tarefa com o repo lavbox como fonte)
> Retome o projeto LAVBOX. Leia `docs/ESTADO.md`, `docs/ARQUITETURA.md`, `docs/SPEC.md` e `docs/REVISAO.md` do repositório e a memória. Etapas 1 e 2 estão aprovadas. Antes de qualquer coisa, teste se você consegue gravar no repo (`git push --dry-run`) e se o Supabase `lavbox-demo` aparece. Depois me proponha o passo 3.0 e espere minha liberação. Não altere o repo nem o banco sem eu liberar.
