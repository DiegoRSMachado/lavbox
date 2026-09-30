# Banco de dados (Supabase) — como reproduzir e operar

Projeto: `lavbox-demo` · ref `kpgzmedfxmatmuvujdhv` · região `sa-east-1` · plano gratuito.
URL da API e chave **publishable** já estão em `js/config.js` (a chave é pública por desenho; `service_role` **nunca** vai ao repositório).

## Ordem para recriar do zero (em um projeto novo)
1. `schema.sql` — linha de base: tabelas, RLS, privilégios, RPCs, realtime (migrations 0001–0003 aplicadas no projeto).
2. `migrations/0004_admin_pin6.sql` — papel `admin` (nunca pelo cadastro), `is_admin()`, PIN de 6 dígitos, bloqueio de tentativas.
3. `migrations/0005_admin_dashboard.sql` — `is_seed`, `admin_kpis()` e **seed fictício** (25 clientes, 6 prestadores, 120 pedidos).
4. `seed_demo_accounts.sql` — contas demo (cliente e lavador) usadas pelos botões "Modo demonstração".
5. Painel do Supabase → Authentication → Providers → Email → **Confirm email: desligado** (cadastro sem e-mail de confirmação na demo).
6. Promover o admin (SQL Editor), trocando o nome pelo da conta cadastrada no app:
   ```sql
   update public.profiles set role = 'admin' where nome = 'NOME DA CONTA' and not is_seed returning nome, role;
   ```
Cada migration tem `.down.sql` para desfazer.

## Operação
| Arquivo | Para quê |
|---|---|
| `reset_demo.sql` | Apaga os pedidos **reais de teste** (mantém contas e o seed). Rodar na quinta à noite, antes da apresentação. |
| `purge_seed.sql` | Apaga **todo o seed fictício**. Não rodar antes da apresentação (esvazia o painel do admin). |
| `tests/matriz_rls_pacote_a.sql` | Testes de segurança do Pacote A (admin/PIN/bloqueio) — termina com erro proposital que desfaz tudo e mostra o resultado. |
| `tests/matriz_rls_pacote_b.sql` | Testes do Pacote B (KPIs, admin sem acesso a dados pessoais, seed sem login). |

Como ler os testes: cada arquivo cria usuários fictícios dentro de uma transação, executa os ataques e termina com `raise exception` contendo o relatório (nada persiste). O resultado aparece na mensagem de erro.

## Cuidados
- **Projeto gratuito pausa após ~1 semana sem uso.** O workflow `.github/workflows/keepalive.yml` faz um ping diário. Se pausar: painel → *Restore project*.
- Um único ambiente (sem branch de banco): migrations pequenas, reversíveis e guardadas aqui.
- Admin sem botão público: a senha é só da equipe.
