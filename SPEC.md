# LAVBOX — Spec de design (v2 · aprovada junto com a Etapa 2 em 2026-09-30 · reconciliada com o código existente)

**Data:** 2026-09-30 · **Escopo aprovado:** abordagem C (B + rota + estoque) · **Status:** aprovada. **Ajustes de reconciliação feitos pelo Claude após a revisão do repo (revisar na retomada):** catálogo e preços do banco, PIN 6 dígitos, sem taxa de deslocamento no MVP, Palco no lugar do 'modo demo', admin sem botão público.
**Catálogo e multiplicadores: os que JÁ estão no banco. Pontos e planos de assinatura: PROPOSTAS FICTÍCIAS, editáveis no admin.**

## 1. Objetivo e tese
PWA demonstrável de lavagem automotiva móvel (o serviço vai até o cliente). Tese: **inovação de processo / melhoria operacional** — digitalizar pedido → despacho → execução comprovada → pagamento → avaliação e medir a operação. Cada módulo abaixo está ligado a uma prova operacional (coluna "Prova").

## 2. Perfis (3 interfaces, 1 PWA, permissões por RLS)
| Perfil | Faz | Observação |
|---|---|---|
| Cliente | Pede, acompanha, paga (simulado), avalia, fidelidade, assinatura | Conta pessoal **ou empresarial** (mesma interface + tela "Frota") |
| Prestador | Recebe/aceita, roteiro do dia, QR, fotos, estoque, ganhos | Otimizar rota; disponibilidade on/off |
| Admin | Dashboard, prestadores, preços, alertas, assinaturas, auditoria | Gestor + administrador fundidos |

## 3. Camadas de entrega (garantem demo funcional mesmo se o tempo apertar)
- **P0 — Núcleo (nada de demo sem isso):** auth por perfil, 12 telas do cliente, painel do prestador, admin básico, pedido agendado e "lavar agora", tracking em tempo real, pagamento simulado, avaliação.
- **P1 — Prova de processo:** QR/código de início, fotos antes/depois, água economizada, KPIs operacionais no admin, alertas de nota baixa.
- **P2 — Módulos de negócio:** fidelidade, assinatura, Empresas (frota).
- **P3 — Operação avançada:** rota otimizada, estoque com alerta.
Ordem de construção: P0 → P1 → P3 → P2 (P2 é o menos ligado à tese de processo; entra por último, mas entra).

## 4. Regras de negócio (propostas)
**Serviços (já no banco):** Básico 35 (30 min, 120 L) · Completo 70 (60 min, 150 L) · Premium 140 (120 min, 150 L) · EcoWash 60 (45 min, 20 L).
**Multiplicador por veículo (já no banco):** carro 1,0 · moto 0,7 · SUV 1,25 · caminhonete 1,4 · van 1,5.
**Adicionais (já no banco):** polimento +80 · higienização interna +60 · cristalização +120 · enceramento +40.
**Produtos/perfume:** fora do MVP (o consumo de estoque usa a tabela `service_consumption`).
**Preço:** calculado no servidor (`create_order`); sem taxa de deslocamento no MVP.
**Lavar agora:** pedido vai para o pool; a lista do lavador é ordenada por distância (ADR-004). **Agendar:** data e hora; conflito de horário do prestador tratado no aceite.
**Status:** solicitado → confirmado → a caminho → chegou → iniciado (exige QR/código) → finalizado → pago → avaliado (+ cancelado). Atualização via Realtime.
**QR/PIN:** código de 6 dígitos com QR gerado no cliente; prestador lê a câmera ou digita; 5 erros bloqueiam 5 min (ADR-003).
**Fotos:** antes e depois no Storage privado (URL assinada), visíveis só para cliente, prestador do pedido e admin.
**Água:** convencional 150 L · ecológica 20 L (valores do docx, "a definir") → economia 130 L por lavagem ecológica; contador acumulado por cliente e total no admin.
**Avaliação:** 1–5 geral + pontualidade/qualidade/atendimento. Nota ≤ 3 cria **alerta de recuperação** na fila do admin (fecha o fluxo do PDF).
**Fidelidade:** 100 pontos por lavagem concluída. Resgates: desconto R$ 10 (200 pts) · upgrade Básica→Completa (400 pts) · Básica grátis (800 pts).
**Assinatura:** Basic 2 créditos/mês R$ 149 · Plus 4 créditos R$ 279 · Premium 4 créditos + prioridade em "agora" + 20% pontos bônus R$ 449. 1 crédito = Básica ou Completa; upgrades pagos à parte. Cobrança **simulada**; botão de admin "avançar mês" para demonstrar renovação.
**Empresas:** conta com CNPJ fictício, N veículos (placa), periodicidade por veículo (ex.: 15 dias) → tabela Frota (veículo · última lavagem · próxima · custo acumulado · prestador · situação) e botão "agendar vencidas" em lote.
**Rota (prestador):** lista do dia → "Otimizar" aplica **vizinho mais próximo** com Haversine; mostra km antes × depois e % de economia, combustível estimado. **Sem trânsito em tempo real** (exige API paga).
**Estoque (prestador):** produto · quantidade · mínimo. Cada tipo de serviço consome quantidades fixas; baixa automática ao finalizar; alerta ao chegar no mínimo; admin vê estoques críticos.

## 5. Dashboard admin — KPIs (calculados por views SQL sobre dados reais do banco)
Pedidos por status · receita e ticket médio · demanda por hora e por região (bairros do DF) · serviços mais pedidos · ranking de prestadores (nota, pontualidade) · tempo médio de atendimento · km e combustível economizados por rota · litros de água economizados · estoques críticos · assinaturas ativas e receita recorrente · fila de alertas de nota baixa.
Dados de demonstração (seed): ~120 pedidos históricos, 6 prestadores, 25 clientes, 2 empresas — **rotulados como fictícios**.

## 6. Simulado ou fora do escopo (declarar na apresentação)
| Item | Tratamento |
|---|---|
| Pagamento (PIX/cartão) | Simulado; **nenhum dado de cartão real é coletado ou guardado** |
| Trânsito real / rota por ruas | Fora; distância em linha reta |
| IA preditiva do docx | Fora; roadmap. Dashboard usa estatística descritiva |
| Push notification | Fora; notificações dentro do app via Realtime |
| Posição do prestador | GPS real do navegador **ou** botão "simular deslocamento" (modo demo) |
| Mapas | Leaflet + OpenStreetMap (sem chave/cartão) |

## 7. Segurança e LGPD (o que será demonstrável)
RLS por perfil (menor privilégio) · papel do usuário em tabela protegida, nunca no front · preço e status calculados no servidor · Storage privado · trilha de auditoria de ações admin · consentimento explícito de localização e política de retenção · CSP via meta tag (GitHub Pages não permite headers) · chave pública do Supabase exposta é normal; **a proteção é a RLS**. Contas de demo com dados fictícios; sign-up aberto será decidido na arquitetura (risco de spam × facilidade da demo).

## 8. Modo demonstração
Usar o modo **Palco** que já existe (`#/palco`, cliente e lavador lado a lado) + botão de simular deslocamento. **Admin sem botão público** (ADR-008); a senha fica só com a equipe.

## 9. Riscos
- Escopo C é grande: a divisão em camadas P0–P3 garante entrega parcial funcional.
- Supabase free pausa após ~1 semana sem uso (confirmar limite atual): reativar e testar antes da apresentação.
- Explicar tudo ao professor exige o documento final (Etapa 4) e um roteiro de demo de ~10 min.
