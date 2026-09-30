"""E2E do fluxo completo em modo offline (?mode=local): cliente e lavador em duas abas.
Uso: python3 -m http.server 8765 &  ;  python3 tools/e2e_local.py [pasta_de_screenshots]"""
import sys, os
from playwright.sync_api import sync_playwright, expect

BASE = "http://localhost:8765/index.html?mode=local"
OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/e2e"
os.makedirs(OUT, exist_ok=True)
EXE = os.environ.get("CHROME", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome")
errors = []

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE, args=["--no-sandbox"])
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, locale="pt-BR")
    A, B = ctx.new_page(), ctx.new_page()
    for pg, n in ((A, "cliente"), (B, "lavador")):
        pg.on("console", lambda m, n=n: errors.append(f"[{n}] {m.text}") if m.type in ("error", "warning") and "tile.openstreetmap" not in m.text and "ERR_" not in m.text and "Failed to load resource" not in m.text else None)
        pg.on("pageerror", lambda e, n=n: errors.append(f"[{n}] PAGEERROR {e}"))
    shot = lambda pg, name: pg.screenshot(path=f"{OUT}/{name}.png")

    # ---- cliente: login demo e pedido ----
    A.goto(BASE); shot(A, "01_landing")
    A.get_by_role("button", name="Entrar como Cliente").click()
    expect(A.get_by_role("heading", name="Olá, Ana")).to_be_visible(); shot(A, "02_cliente_home")
    A.get_by_role("link", name="＋ Pedir lavagem").click()
    shot(A, "03_wizard_veiculo")
    A.get_by_role("button", name="Continuar").click()                     # veículo
    expect(A.get_by_role("heading", name="Tipo de lavagem")).to_be_visible(); shot(A, "04_wizard_servico")
    A.get_by_role("button", name="Continuar").click()                     # serviço
    A.get_by_role("switch", name="Polimento").click(); shot(A, "05_wizard_extras")
    A.get_by_role("button", name="Continuar").click()
    A.get_by_placeholder("Rua/quadra, número, complemento").fill("SQN 308 bloco C ap 101")
    A.get_by_placeholder("Ex.: Asa Norte").fill("Asa Norte")
    expect(A.locator(".leaflet-container")).to_be_visible(); A.wait_for_timeout(500); shot(A, "06_wizard_local")
    A.get_by_role("button", name="Continuar").click()
    shot(A, "07_wizard_resumo")
    # Compass SUV: completo 70*1.25 + polimento 80 = 167,50
    expect(A.get_by_text("R$ 167,50").first).to_be_visible()
    A.get_by_role("button", name="Confirmar ·").click()
    expect(A.get_by_text("Procurando um lavador")).to_be_visible(); shot(A, "08_cliente_aguardando")

    # ---- lavador: recebe e aceita (tempo real entre abas) ----
    B.goto(BASE); B.get_by_role("button", name="Entrar como Lavador").click()
    expect(B.get_by_role("button", name="Aceitar pedido")).to_be_visible(timeout=10000); shot(B, "09_lavador_disponiveis")
    B.get_by_role("button", name="Aceitar pedido").click()
    expect(A.get_by_text("aceitou o pedido")).to_be_visible(timeout=10000); shot(A, "10_cliente_confirmado")
    expect(B.get_by_role("button", name="Sair para o atendimento")).to_be_visible(timeout=10000)
    expect(B.locator(".leaflet-container")).to_be_visible(); shot(B, "09b_lavador_mapa")
    B.get_by_role("button", name="Sair para o atendimento").click()
    expect(A.locator(".washer-pin")).to_be_visible(timeout=10000); A.wait_for_timeout(600); shot(A, "10b_cliente_mapa_carro")
    expect(A.get_by_text("a caminho", exact=False).first).to_be_visible(timeout=10000)
    B.get_by_role("button", name="Cheguei ao local").click()
    expect(A.locator(".pin")).to_be_visible(timeout=10000); shot(A, "11_cliente_pin")
    pin = A.locator(".pin").inner_text()
    # PIN errado deve falhar
    B.get_by_label("Código de 6 dígitos do cliente").fill("000000" if pin != "000000" else "111111")
    B.get_by_role("button", name="Iniciar lavagem").click()
    expect(B.get_by_text("PIN incorreto. Restam 4 tentativa(s).")).to_be_visible(); shot(B, "12_lavador_pin_errado")
    assert len(pin) == 6, "PIN deve ter 6 dígitos"
    B.get_by_label("Código de 6 dígitos do cliente").fill(pin)
    B.get_by_role("button", name="Iniciar lavagem").click()
    expect(A.get_by_text("Lavagem em andamento")).to_be_visible(timeout=10000)
    B.get_by_role("button", name="Finalizar lavagem").click()
    expect(A.get_by_role("button", name="Confirmar pagamento")).to_be_visible(timeout=10000); shot(A, "13_cliente_pagar")
    A.get_by_role("button", name="Confirmar pagamento").click()
    expect(A.get_by_text("Como foi o serviço?")).to_be_visible()
    A.get_by_role("button", name="5 estrelas").click()
    A.get_by_placeholder("Comentário (opcional)").fill("Ficou impecável!")
    A.get_by_role("button", name="Enviar avaliação").click()
    expect(A.get_by_text("Sua avaliação")).to_be_visible(); shot(A, "14_cliente_avaliado")
    expect(B.get_by_text("Avaliação do cliente")).to_be_visible(timeout=10000); shot(B, "15_lavador_avaliado")

    # ---- segurança no cliente: XSS armazenado não executa ----
    A.goto(BASE + "#/cliente/novo")
    A.evaluate("window.__xss = 0")
    A.get_by_role("button", name="Continuar").click(); A.get_by_role("button", name="Continuar").click(); A.get_by_role("button", name="Continuar").click()
    A.get_by_placeholder("Rua/quadra, número, complemento").fill('<img src=x onerror="window.__xss=1">')
    A.get_by_placeholder("Ex.: Asa Norte").fill("<b>Bairro</b>")
    A.get_by_role("button", name="Continuar").click()
    A.get_by_role("button", name="Confirmar ·").click()
    expect(A.get_by_text("<b>Bairro</b>").first).to_be_visible()
    assert A.evaluate("window.__xss") == 0, "XSS executou!"
    print("XSS: payload exibido como texto, não executado ✔")

    # ---- cadastro de novo lavador (fluxo de cadastro) ----
    C = ctx.new_page(); C.goto(BASE + "#/cadastro?role=lavador")
    C.get_by_placeholder("Nome completo").fill("Bruno Teste"); C.get_by_placeholder("voce@email.com").fill("bruno@teste.com")
    C.get_by_placeholder("mínimo 8 caracteres").fill("senhaforte123"); C.get_by_placeholder("Ex.: Asa Sul").fill("Lago Sul")
    shot(C, "16_cadastro_lavador")
    C.get_by_role("button", name="Criar conta").click()
    expect(C.get_by_role("heading", name="Olá, Bruno")).to_be_visible(); shot(C, "17_lavador_home")

    # ---- admin: painel de KPIs (conta e dados criados só no teste; nada disso existe no repo) ----
    D = ctx.new_page(); D.goto(BASE)
    D.evaluate("""() => {
      const k = 'lavbox-local-db'; const db = JSON.parse(localStorage.getItem(k));
      db.users.push({ id: 'adm-1', email: 'admin@teste.local', password: 'Senha#Admin1', role: 'admin', nome: 'Admin Teste' });
      const svc = ['basico', 'completo', 'premium', 'ecowash'], bai = ['Asa Sul', 'Asa Norte', 'Lago Sul', 'Guará'];
      for (let i = 0; i < 40; i++) {
        const d = new Date(Date.now() - (i % 13) * 86400000 - i * 3600000).toISOString();
        db.orders.push({ id: 'seed-' + i, client_id: 'demo-cliente', washer_id: 'demo-lavador', vehicle_id: 'v-demo', service_id: svc[i % 4],
          addon_ids: [], bairro: bai[i % 4], preco_total: 50 + i, status: 'avaliado', avaliacao: i % 7 === 0 ? 2 : 5,
          comentario: i % 7 === 0 ? 'Demorou' : null, created_at: d, updated_at: d, is_seed: true });
      }
      localStorage.setItem(k, JSON.stringify(db)); }""")
    D.goto(BASE + "#/entrar")
    D.get_by_placeholder("voce@email.com").fill("admin@teste.local"); D.locator("input[type=password]").fill("Senha#Admin1")
    D.get_by_role("button", name="Entrar", exact=True).click()
    expect(D.get_by_role("heading", name="Painel de operação")).to_be_visible()
    expect(D.locator("svg.chart").first).to_be_visible(); assert D.locator("svg.chart").count() >= 5, "faltam gráficos"
    expect(D.get_by_text("Dados de demonstração")).to_be_visible(); expect(D.get_by_text("Fila de recuperação")).to_be_visible()
    D.set_viewport_size({"width": 1400, "height": 1000}); D.wait_for_timeout(400); shot(D, "19_admin")
    # controle de acesso no front: cliente não entra em #/admin (no servidor a RPC também nega)
    A.goto(BASE + "#/admin"); A.wait_for_timeout(600)
    assert "/admin" not in A.url, "cliente alcançou /admin"
    print("Admin: painel renderizado e acesso de cliente barrado ✔")

    # ---- palco ----
    P = ctx.new_page(); P.set_viewport_size({"width": 1400, "height": 900}); P.goto(BASE + "#/palco"); P.wait_for_timeout(800); expect(P.frame_locator("iframe").first.get_by_role("button", name="Entrar como Cliente")).to_be_visible(); shot(P, "18_palco")
    b.close()

print("ERROS DE CONSOLE:", errors if errors else "nenhum ✔")
print("E2E OK")
