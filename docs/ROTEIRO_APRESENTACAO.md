# LAVBOX — Roteiro da apresentação (3 apresentadores, ~12 min + perguntas)

Deck: `docs/apresentacao/LAVBOX_apresentacao.pptx` (13 slides). **Definir quem é o Apresentador 1, 2 e 3** (ainda em aberto).
Site: https://diegorsmachado.github.io/lavbox/ · Palco (2 telas): `.../#/palco`

## Divisão e tempo
| Quem | Slides | Tempo | Objetivo |
|---|---|---|---|
| **Apresentador 1** | 1–6 (capa, time, considerações, problema, jornada, do protótipo ao app) | ~4 min | Mostrar a dor e que o protótipo virou aplicativo |
| **Apresentador 2** | 7–9 (dados do projeto, tempo real, app em funcionamento) + **demo ao vivo** | ~4 min | Provar que funciona, ao vivo |
| **Apresentador 3** | 10–13 (arquitetura, segurança, limites, solução) | ~4 min | Mostrar que é seguro, honesto e escalável |

## Apresentador 1 — a dor e a proposta (slides 1–6)
1. **Abertura (30 s):** "Quanto tempo você gasta levando o carro ao lava-jato e esperando?" Apresentar o time e o orientador.
2. **Problema (1 min):** deslocamento, fila, horário rígido, sem padrão e sem transparência sobre os produtos usados.
3. **Proposta (1 min):** lavagem no local que o cliente escolhe; ele define pacote, produtos, horário e ponto no mapa.
4. **Jornada (1 min):** "Vocês viram o protótipo de 12 telas. Hoje ele é um aplicativo funcionando em 5 telas de pedido + acompanhamento ao vivo." (slide 6: tabela 12 → 5).
5. **Gancho:** "Agora o [Apresentador 2] mostra isso rodando, com cliente e lavador ao mesmo tempo."

## Apresentador 2 — demonstração (slides 7–9 + demo)
Fala curta nos slides (1 min): inovação de processo, 3 perfis no mesmo app, tempo real e início comprovado.

**Demo ao vivo (~3 min), no Palco (`#/palco`), cliente à esquerda e lavador à direita:**
1. Em cada tela: **Entrar como Cliente** / **Entrar como Lavador** (modo demonstração).
2. Cliente: **Pedir lavagem** → veículo → **Completo** → extra → **endereço + pino no mapa** → confirmar. *Destacar: preço calculado pelo servidor.*
3. Lavador: o pedido **aparece sozinho** → **Aceitar**. *Destacar: o cliente mudou de tela sem recarregar.*
4. Lavador: **Sair para o atendimento** → cliente vê o carrinho no mapa com km e tempo (**simulado**, dizer em voz alta).
5. Lavador: **Cheguei** → cliente mostra o **código/QR** → lavador **Ler QR** (ou digita) → lavagem iniciada.
6. Lavador: **Finalizar** → cliente: **pagamento (simulado)** → **5 estrelas**.
7. Opcional (30 s): lavador abre **Roteiro do dia → Simular 5 paradas**: "economia de X% de quilometragem".
8. **Gancho:** "Tudo isso só é confiável se for seguro. O [Apresentador 3] mostra como."

**Plano B (se a internet cair):** abrir `.../?mode=local#/palco` (funciona offline; mostra o núcleo: pedido, etapas, código) e/ou o vídeo gravado.

## Apresentador 3 — arquitetura e segurança (slides 10–13)
1. **Arquitetura (1 min):** aplicativo web instalável (PWA) hospedado no GitHub Pages; Supabase com login, banco com controle por linha (RLS), funções no servidor e tempo real. Mapas gratuitos (OpenStreetMap). Sem servidor próprio.
2. **Segurança (1,5 min):** "O navegador nunca escreve direto nos pedidos: só funções do servidor que validam perfil, etapa, preço e código." Citar 3 ameaças da tabela: lavador pulando etapa, ver endereço sem aceitar, falso início (código + bloqueio de 5 tentativas).
3. **Prova (30 s), opcional:** entrar como **admin** (`#/admin`): "o painel só mostra números; não acessa endereço, telefone nem código". Dizer que os 120 pedidos do painel são **fictícios e rotulados**.
4. **Limites (30 s):** pagamento, posição do lavador e trânsito são simulados hoje; cada um já tem o ponto de troca definido (slide 12).
5. **Fechamento (30 s):** slide 13: o que está feito e o roadmap (pagamento real, GPS e trânsito, fotos, estoque, fidelidade/assinatura/Empresas, IA de demanda). Agradecer.

## Perguntas prováveis da banca (respostas curtas)
- **Por que aplicativo web (PWA) e não nativo?** Instala pela tela inicial, um código para todos os aparelhos, publica em minutos e permite validar a ideia antes do investimento em loja de aplicativos.
- **Como garantem que o lavador realmente chegou?** Só inicia com o código de 6 dígitos (ou QR) do cliente, conferido no servidor; 5 erros bloqueiam por 5 minutos. O QR é conveniência: a segurança está no servidor.
- **E se alguém abrir o DevTools e ver a chave do banco?** A chave é pública por desenho; quem protege os dados é o controle por linha (RLS) no banco. A chave de administração nunca vai ao navegador.
- **O pagamento é real?** Não. É simulado, sem coletar dado financeiro; em produção entra um gateway (PIX/cartão) com tokenização.
- **Quanto custa rodar?** Na demonstração, zero (planos gratuitos). Escala para infraestrutura dedicada quando houver demanda.
- **LGPD?** Dados mínimos, endereço só para cliente e lavador aceito, coordenada pública arredondada, painel sem dados pessoais, dados fictícios na demo e política de retenção prevista.
- **A economia de água (130 L) é real?** É uma estimativa: 150 L convencional (valor do documento do projeto) contra 20 L do EcoWash; os valores reais serão medidos com o método e os equipamentos adotados.
- **A rota é ótima?** Usa vizinho mais próximo: heurística simples e explicável. Em testes com 7 pontos ficou em média 7% acima do ótimo (pior caso 26%). Sem trânsito (linha reta).
- **E a inteligência artificial do projeto?** Está no roadmap (previsão de demanda); hoje o painel usa estatística descritiva.

## Checklist (quinta à noite e sexta cedo)
- [ ] Supabase `lavbox-demo` ativo (plano gratuito pausa por inatividade): abrir o painel do projeto e, se pausado, **Restore**.
- [ ] Abrir o site, entrar como **cliente**, **lavador** e **admin**; conferir que o painel mostra dados.
- [ ] Instalar o app no celular (Android: ⋮ → Instalar app; iPhone: Compartilhar → Adicionar à Tela de Início) e testar a **câmera** no "Ler QR".
- [ ] Internet: usar o **hotspot do celular**; testar o WebSocket (cliente muda sem recarregar).
- [ ] Plano B testado: `?mode=local#/palco` e vídeo gravado da demo completa.
- [ ] **Quinta à noite, depois que os parceiros terminarem de testar:** limpar os pedidos de teste com `supabase/reset_demo.sql` (preserva contas e o seed fictício; peça ao Claude ou rode no SQL Editor). **Não** rodar `purge_seed.sql` antes da apresentação: ele apaga os 120 pedidos do painel.
- [ ] Notebook no telão: zoom do navegador em 110–125%, modo tela cheia, notificações desligadas.
- [ ] Conferir: nome **LAVBOX** e data **02/10/2026** em todos os slides.
- [ ] Ensaiar com cronômetro: 4 min por pessoa.
