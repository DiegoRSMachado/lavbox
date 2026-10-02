"""Testes de robustez (o que NÃO pode travar na apresentação).
Uso: python3 -m http.server 8765 &  ;  python3 tools/e2e_robustez.py [pasta_de_screenshots]
- modo offline (?mode=local): formulário de veículo aberto por engano, clique duplo no cadastro, navegação inválida
- modo Supabase SEM rede (o Supabase é bloqueado no teste): sessão aberta + queda de conexão, login sem rede
"""
import sys, os, json, base64, time
from playwright.sync_api import sync_playwright, expect

LOCAL = "http://localhost:8765/index.html?mode=local"
SB = "http://localhost:8765/index.html"
OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/e2e_robustez"
os.makedirs(OUT, exist_ok=True)
EXE = os.environ.get("CHROME", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome")
erros = []

def jwt(sub):
    b = lambda d: base64.urlsafe_b64encode(json.dumps(d).encode()).decode().rstrip("=")
    return f'{b({"alg": "HS256", "typ": "JWT"})}.{b({"sub": sub, "role": "authenticated", "exp": int(time.time()) + 3600})}.assinatura'

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE, args=["--no-sandbox"])

    # ---------- modo offline ----------
    ctx = b.new_context(viewport={"width": 390, "height": 844}, locale="pt-BR")
    A = ctx.new_page()
    A.on("pageerror", lambda e: erros.append(f"PAGEERROR {e}"))
    A.goto(LOCAL); A.get_by_role("button", name="Entrar como Cliente").click()
    expect(A.get_by_role("heading", name="Olá, Ana")).to_be_visible()
    # 1) abre "Adicionar veículo" por engano, não preenche e toca em Continuar: deve seguir com o veículo já escolhido
    A.get_by_role("link", name="＋ Pedir lavagem").click()
    A.get_by_role("button", name="＋ Adicionar veículo").click()
    expect(A.get_by_text("Novo veículo")).to_be_visible()
    A.get_by_role("button", name="Continuar").click()
    expect(A.get_by_role("heading", name="Tipo de lavagem")).to_be_visible()
    print("1 formulário de veículo aberto por engano não trava ✔")
    # 2) rota inexistente e pedido inexistente não quebram
    A.goto(LOCAL + "#/qualquer/coisa"); expect(A.get_by_role("heading", name="Olá, Ana")).to_be_visible()
    A.goto(LOCAL + "#/cliente/pedido/00000000-0000-0000-0000-000000000000"); expect(A.get_by_text("Pedido não encontrado.")).to_be_visible()
    # 3) cliente tentando abrir telas de outros perfis é redirecionado
    for rota in ["#/lavador", "#/admin", "#/lavador/rota"]:
        A.goto(LOCAL + rota); A.wait_for_timeout(400); assert "/cliente" in A.url, f"cliente acessou {rota}"
    print("2-3 rotas inválidas e de outros perfis redirecionam ✔")
    # 4) clique duplo em "Criar conta" cria a conta uma vez só e entra
    C = ctx.new_page(); C.goto(LOCAL + "#/cadastro?role=cliente")
    C.get_by_placeholder("Nome completo").fill("Duplo Clique"); C.get_by_placeholder("voce@email.com").fill("duplo@teste.com")
    C.get_by_placeholder("mínimo 8 caracteres").fill("senhaforte123")
    C.get_by_role("button", name="Criar conta").dblclick()
    expect(C.get_by_role("heading", name="Olá, Duplo")).to_be_visible()
    n = C.evaluate("JSON.parse(localStorage.getItem('lavbox-local-db')).users.filter(u => u.email === 'duplo@teste.com').length")
    assert n == 1, f"conta criada {n} vezes"
    print("4 clique duplo no cadastro cria uma conta só ✔")
    # 5) login com senha errada mostra mensagem (não trava)
    L = ctx.new_page(); L.goto(LOCAL + "#/entrar")
    L.get_by_placeholder("voce@email.com").fill("cliente.demo@lavbox.app"); L.locator("input[type=password]").fill("errada123")
    L.get_by_role("button", name="Entrar", exact=True).click(); expect(L.get_by_text("E-mail ou senha incorretos.")).to_be_visible()
    print("5 senha errada mostra mensagem ✔")
    ctx.close()

    # ---------- modo Supabase SEM rede ----------
    ctx2 = b.new_context(viewport={"width": 390, "height": 844}, locale="pt-BR")
    ctx2.route("**/*supabase.co/**", lambda r: r.abort())
    S = ctx2.new_page()
    S.on("pageerror", lambda e: erros.append(f"PAGEERROR(sb) {e}"))
    # 6) tela inicial abre mesmo sem rede
    S.goto(SB); expect(S.get_by_role("button", name="Entrar como Cliente")).to_be_visible()
    # 7) "Entrar como Cliente" sem rede: mensagem em português, sem travar
    S.get_by_role("button", name="Entrar como Cliente").click()
    expect(S.get_by_text("Sem conexão com o servidor. Verifique a internet e tente de novo.")).to_be_visible(timeout=15000)
    print("6-7 sem rede: tela inicial abre e o login avisa em português ✔")
    # 8) sessão aberta + queda de conexão: tela de aviso com "Tentar novamente" e atalho offline
    uid = "00000000-0000-4000-a000-00000000c001"
    sess = {"access_token": jwt(uid), "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600,
            "refresh_token": "x", "user": {"id": uid, "aud": "authenticated", "role": "authenticated", "email": "cliente.demo@lavbox.app"}}
    S.evaluate("(s) => localStorage.setItem('lavbox-auth-main', JSON.stringify(s))", sess)
    S.goto(SB + "#/cliente"); S.reload()
    expect(S.get_by_role("heading", name="Sem conexão com o servidor")).to_be_visible(timeout=15000)
    expect(S.get_by_role("link", name="Usar o modo offline (demonstração)")).to_be_visible()
    S.screenshot(path=f"{OUT}/sem_conexao.png")
    S.get_by_role("link", name="Usar o modo offline (demonstração)").click()
    expect(S.get_by_role("button", name="Entrar como Cliente")).to_be_visible()
    assert "mode=local" in S.url
    print("8 queda de conexão com sessão aberta: aviso + atalho para o modo offline ✔")
    b.close()

print("ERROS DE PÁGINA:", erros if erros else "nenhum ✔")
assert not erros
print("ROBUSTEZ OK")
