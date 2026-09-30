# LAVBOX — Arquitetura e ADRs (Etapa 2 · APROVADA em 2026-09-30)

Base: o código que **já existe** no repo (`DiegoRSMachado/lavbox`, commit `55306d1`) + Supabase `lavbox-demo`. Não é reescrita: é evolução controlada. Escopo: abordagem C em camadas P0–P3 (ver `SPEC.md`).

## 1. Visão geral
```
GitHub Pages (estático, HTTPS)                      Supabase free (sa-east-1)
└─ PWA vanilla ES modules (sem build)  ── HTTPS ──► ├─ Auth (e-mail/senha)
   ├─ views: cliente · lavador · ADMIN (novo)       ├─ Postgres + RLS + RPCs SECURITY DEFINER
   ├─ lib/route.js (rota, função pura, testada)     ├─ Realtime (orders, order_events)
   ├─ Leaflet + OSM (vendorizado)                   └─ Storage privado (fotos antes/depois)
   ├─ adapters/supabase.js  (produção)
   └─ adapters/local.js     (offline, SÓ o núcleo atual)
```
Regra que não muda: **o navegador nunca escreve em tabelas de pedido; toda transição é RPC que valida papel e estado.** O preço, o saldo de pontos/créditos e os KPIs são calculados no servidor.

## 2. ADRs

### ADR-001 — Manter PWA vanilla + Supabase + GitHub Pages
**Contexto:** já existe, funciona e o E2E passa. **Decisão:** evoluir, sem React/build. **Alternativas:** reescrever em React+Vite (mais componentes, mas exige build, perde CSP simples e joga fora código testado); Next.js (precisa servidor, não roda no Pages). **Consequências:** + zero dependência de build, fácil de explicar; − UI manual em JS puro, sem componentes prontos. **Risco:** views ficarem grandes → separar por módulo (`views/admin/*.js`).

### ADR-002 — Papéis por tabela protegida; `admin` nunca nasce no cliente
**Decisão:** `profiles.role ∈ {cliente, lavador, admin}`. A policy `profiles_insert` passa a exigir `role in ('cliente','lavador')`. O admin é criado só por migration/SQL privilegiado. **Achado que motivou:** ao adicionar `admin` ao `CHECK`, sem a nova policy qualquer usuário poderia se cadastrar como admin. Conta empresarial = `profiles.account_type` (`pessoal|empresa`) + tabela `companies`, **não** um 4º papel. **Admin não lê `order_private` nem `order_secrets`** (não vê endereço nem PIN): menor privilégio e argumento de LGPD. Admin lê pedidos e perfis por policies de `SELECT` e altera catálogo/estados só por RPC com `is_admin()`. **Alternativa:** flag `is_admin` no JWT/metadata (rejeitada: editável se mal configurado, difícil de auditar).

### ADR-003 — PIN de 6 dígitos, com limite de tentativas, e QR
**Contexto:** hoje o PIN tem 4 dígitos e nenhum limite; o lavador aceito consegue forçar 0000–9999. **Decisão:** 6 dígitos; `order_secrets` ganha `tentativas` e `bloqueado_ate`; após 5 erros bloqueia por 5 min. **Pegadinha que a implementação precisa respeitar:** `raise exception` desfaz a transação e apaga o contador; por isso `start_service` **retorna** `{ok:false, restantes}` em vez de lançar erro. O QR só codifica o mesmo código (gerado no cliente, lib vendorizada); o prestador lê pela câmera ou **digita** (fallback obrigatório para a demo). **Alternativa:** token longo em QR (mais forte, mas sem fallback digitável).

### ADR-004 — Rota, "lavar agora" e estoque: lógica simples, pura e testável
**Decisão:** sem PostGIS. Distância = Haversine em JS (`lib/route.js`, função pura, teste em Node). "Lavar agora" continua sendo pool, com a lista do lavador **ordenada por distância** (`washers.lat/lng` = base). Rota = vizinho mais próximo sobre os pedidos aceitos do dia; o resultado é gravado em `route_runs` (km antes × depois) para o KPI. Estoque: `products`, `washer_stock`, `service_consumption`; a baixa acontece dentro da RPC de finalizar; alerta = view/consulta `estoque <= minimo`. **Alternativas:** PostGIS/earthdistance no banco (mais "real", mais difícil de explicar e testar); despacho automático pelo mais próximo (exige fila/timeout no servidor). **Limite declarado:** distância em linha reta, sem trânsito.

### ADR-005 — KPIs e admin por RPC, não por views abertas
**Decisão:** `admin_kpis()` e listas de admin são RPCs `SECURITY DEFINER` que checam `is_admin()` e devolvem `jsonb`. Nada de view exposta na API. Gráficos em **SVG feito à mão** (sem biblioteca), coerente com CSP e sem build. **Consequência:** cada KPI vira uma função SQL testável.

### ADR-006 — Fidelidade e assinatura como livros-razão
**Decisão:** `loyalty_ledger` (append-only; saldo = soma) e `subscriptions` com `creditos_restantes`; catálogos `rewards` e `plans`. Resgate e uso de crédito são RPCs atômicas dentro de `create_order`. Cobrança da assinatura **simulada**; "avançar mês" é RPC só de admin (demo de renovação). **Alternativa:** coluna `pontos` no perfil (rejeitada: sem trilha de auditoria, vulnerável a corrida).

### ADR-007 — Modo offline cobre só o núcleo atual
**Contexto:** cada módulo novo teria de existir nos dois adapters (Supabase e local). **Decisão:** `?mode=local` fica congelado no núcleo (cliente/lavador/PIN); módulos novos só no Supabase. **Consequência:** se a internet cair na apresentação, a demo offline mostra o núcleo, não admin/rota/estoque. **Mitigação:** roteiro de demo com plano B gravado (GIF/vídeo curto).

### ADR-008 — Segurança de operação da demo
1. **Admin sem botão público:** o login demo de admin não fica no `config.js`; a senha é só da equipe (repo é público e o admin pode editar preços).
2. **Cadastro sem confirmação de e-mail na demo** (decisão aprovada pelo Diego em 2026-09-30; aplicar só na Etapa 3 com liberação): o e-mail padrão do Supabase tem limite baixo de envios; em compensação o cadastro aberto aceita contas de qualquer pessoa. Contas novas só veem dados próprios (RLS), então o dano é sujeira de dados, não vazamento.
3. **Riscos aceitos e documentados:** 9 avisos de `SECURITY DEFINER` executável por `authenticated` (as RPCs são a API de escrita) e `order_secrets` sem policy (intencional).
4. **Supabase free:** projeto pausa após inatividade. Checklist pré-apresentação: reativar, rodar E2E, conferir advisors.
5. **Um só ambiente:** o plano free não tem branch de banco. Migrations devem ser pequenas, reversíveis e guardadas em `supabase/migrations/` no repo; nenhuma migration é aplicada sem sua liberação.

## 3. Modelo de dados (delta sobre o schema atual)
| Área | Mudança |
|---|---|
| Papéis | `profiles.role` + `admin`; `account_type`; `companies(id, owner_id, nome, cnpj)`; `is_admin()` |
| Segurança | `order_secrets.tentativas`, `bloqueado_ate`; PIN 6 dígitos |
| Pedido | `iniciado_em`, `finalizado_em`, `agua_economizada`, `desconto`, `credito_usado`, `pontos_usados` |
| Fotos | `order_photos(order_id, tipo antes/depois, path, enviado_por)` + bucket privado `order-photos` com policy por pedido |
| Frota | `vehicles.placa`, `company_id`, `periodicidade_dias` |
| Fidelidade/assinatura | `loyalty_ledger`, `rewards`, `plans`, `subscriptions` |
| Operação | `washers.lat/lng`, `route_runs`, `products`, `washer_stock`, `service_consumption` |
| Qualidade | `recovery_cases` (criado quando nota ≤ 3), `admin_audit` (append-only) |
| Demo | ~120 pedidos históricos, 6 prestadores, 25 clientes, 2 empresas, marcados como fictícios (usuários sem senha utilizável) |

## 4. Estratégia de testes
- **Unitário (Node):** `lib/route.js` (Haversine, vizinho mais próximo, casos de 0/1/N pontos).
- **Matriz RLS/RPC (SQL com usuários de teste):** cliente não lê pedido de outro; lavador não vê endereço antes de aceitar; auto-cadastro como admin falha; PIN bloqueia após 5 erros **e o contador persiste**; admin não lê PIN/endereço; estoque baixa uma vez ao finalizar.
- **E2E (Playwright, existente):** estender com admin, fotos, rota; XSS segue no teste.
- **Advisors do Supabase** depois de cada migration.

## 5. Plano da Etapa 3 (cada passo = migration + código + teste + commit, com liberação sua)
| Passo | Entrega | Camada |
|---|---|---|
| 3.0 | Ativar GitHub Pages e conferir o site no ar | — |
| 3.1 | ADR-002/003/008: `admin`, policy de cadastro, PIN 6 dígitos + bloqueio, cadastro sem confirmação | P0 |
| 3.2 | Dashboard admin + KPIs base + fila de alertas | P0/P1 |
| 3.3 | Fotos antes/depois, QR, mapa Leaflet | P1 |
| 3.4 | Rota otimizada + estoque com alerta | P3 |
| 3.5 | Fidelidade, assinatura, Empresas (frota) | P2 |
| 3.6 | Seed fictício, E2E completo, revisão de segurança, checklist de deploy | — |

## 6. Lacunas que eu não resolvo sozinho
- Se `leaked password protection` está disponível no plano free (confiança < 90%).
- Se o e-mail padrão do Supabase aguenta o cadastro da equipe na demo (por isso a decisão de desligar a confirmação).
- Câmera para ler QR em iOS Safari depende de HTTPS e permissão; o fallback digitável cobre.
