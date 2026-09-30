# LAVBOX — Revisão do que já existe (repo `DiegoRSMachado/lavbox` + Supabase `lavbox-demo`)

Revisão feita em 2026-09-30 lendo o repositório público (3 commits, o último `55306d1`), o schema real do Supabase, os advisors de segurança e rodando o E2E local.

## 1. Correção do que eu disse antes
Eu afirmei que o `lavbox-demo` estava vazio e propus preços novos sem saber que já havia trabalho feito. **Estava errado:** o banco já tem 9 tabelas com RLS, 3 migrations, 4 serviços, 4 extras e 2 contas demo. O catálogo do banco (Básico 35 · Completo 70 · Premium 140 · EcoWash 60; multiplicadores moto 0,7 · SUV 1,25 · caminhonete 1,4 · van 1,5) **prevalece** sobre os valores da minha spec.

## 2. O que já está pronto e é bom
- PWA vanilla (ES modules, sem build), instalável, CSP restritiva, DOM só por `textContent`.
- Supabase: Auth, RLS em todas as tabelas, **nenhuma escrita direta em pedidos** (só RPCs `SECURITY DEFINER` com `search_path` vazio), preço calculado no servidor, PIN fora do alcance da API, auditoria append-only (`order_events`), coordenada arredondada em `orders` e exata só em `order_private`.
- Máquina de estados completa (solicitado → … → avaliado + cancelado) em tempo real, com polling de segurança.
- Pagamento simulado, avaliação, contador de água economizada do cliente, modo **Palco** (`#/palco`: cliente e lavador lado a lado), modo offline `?mode=local`.
- E2E local (`tools/e2e_local.py`): **passou** (fluxo completo, XSS não executa, zero erro de console).

## 3. Achados (do mais importante ao menos)
| # | Achado | Impacto | Correção proposta |
|---|---|---|---|
| 1 | **`start_service` não limita tentativas e o PIN tem 4 dígitos.** O lavador que aceitou o pedido pode testar 0000–9999 sem estar no local. | Contradiz o controle "Registro falso de serviço iniciado" do README | PIN de 6 dígitos + contador de tentativas com bloqueio (ex.: 5) + QR |
| 2 | **O site está fora do ar:** `diegorsmachado.github.io/lavbox/` retorna 404. | Nada para demonstrar | Ativar Pages (`main` / raiz) |
| 3 | **Não existe perfil admin, dashboard, fotos, QR, rota, estoque, fidelidade, assinatura nem empresas.** `profiles.role` só aceita `cliente`/`lavador`. | É o núcleo da tese "melhoria operacional" | Ver plano (seção 5) |
| 4 | Cadastro exige confirmação de e-mail. O e-mail padrão do Supabase tem limite baixo de envios (confirmar o valor atual). | Três pessoas cadastrando durante a demo podem travar | Desligar confirmação na demo, ou usar só contas pré-criadas |
| 5 | Contas demo com senha no `config.js` de repo público. Hoje é aceitável (dados fictícios). **Com admin passa a ser risco:** qualquer pessoa da internet poderia mudar preços do catálogo. | Vandalismo da demo | **Sem botão público para admin**; a senha fica só com a equipe |
| 6 | Advisors de segurança: 9 avisos de `SECURITY DEFINER` executável por `authenticated` e 1 de `order_secrets` sem policy. **Ambos são intencionais** (as RPCs são a API de escrita; o PIN é privado por design). | Falso positivo, mas precisa estar documentado | Registrar como risco aceito no ADR |
| 7 | "Leaked password protection" desligada no Auth. | Senhas vazadas aceitas | Ligar se o plano free permitir (não tenho certeza) |
| 8 | Todo módulo novo teria de ser escrito **duas vezes** (adapter Supabase + adapter local). | Dobra o esforço de P1–P3 | Modo local cobre só o núcleo atual; módulos novos só no Supabase |
| 9 | "Lavar agora" hoje é um pool: todos os lavadores veem o pedido. | Não é o despacho por proximidade da spec | Manter o pool e **ordenar por distância**; é mais simples e explica igual |
| 10 | Sem mapa embutido; o link "Abrir no mapa" usa Google Maps. A CSP atual bloquearia tiles do OpenStreetMap. | Falta o mapa do PDF | Leaflet vendorizado + liberar tiles OSM na CSP |

## 4. Acesso ao GitHub — diagnóstico
- **Ler:** funciona. O repo é público, então cliono sem credencial.
- **Gravar:** bloqueado. O proxy de git só injeta credencial para repositórios que estão nas "fontes" da sessão, e esta sessão nasceu sem o `lavbox`. Erro real: *"DiegoRSMachado/lavbox is not in this session's authorized repository set … add the repository to the session's sources"*.
- **Por que funcionou no outro PC:** lá a sessão foi criada com o repositório como fonte (os commits do usuário `claude` vieram daí). O app do GitHub já instalado não precisa ser refeito; falta a sessão apontar para o repo.

## 5. Plano ajustado (camadas)
- **Já feito (P0 parcial):** auth cliente/lavador, wizard, tracking, PIN, pagamento simulado, avaliação, água (cliente), RLS/RPC, PWA, Palco.
- **Falta P0:** perfil admin + dashboard base.
- **P1:** PIN 6 dígitos + limite de tentativas + QR, fotos antes/depois, mapa Leaflet, KPIs e alertas de nota ≤ 3.
- **P3:** rota (vizinho mais próximo), estoque com alerta.
- **P2:** fidelidade, assinatura, Empresas (frota).
Ordem: correções (achados 1, 2, 4, 5) → P0 restante → P1 → P3 → P2.

## 6. Roteiro para 3 apresentadores (estrutura; o texto completo sai na Etapa 4)
| Pessoa | Bloco | Tempo | Mostra |
|---|---|---|---|
| 1 | Problema, proposta e experiência do cliente | ~4 min | Dor do lava-jato tradicional, os 12 passos, demo do cliente pedindo "agora" |
| 2 | Operação: prestador, rota, estoque e dashboard admin | ~4 min | Aceitar pedido, QR/fotos, rota otimizada, KPIs, fidelidade/assinatura/empresas |
| 3 | Arquitetura, segurança e decisões técnicas | ~4 min | Supabase + RLS + RPC, ameaças e controles, o que é simulado, roadmap e limites |
Ligação: a Pessoa 1 dispara o pedido no Palco, a Pessoa 2 o atende ao vivo, a Pessoa 3 abre o banco e o painel para provar que o dado é real. Cada um tem um "gancho" para passar a fala ao seguinte e todos conseguem responder as perguntas do próprio bloco.
