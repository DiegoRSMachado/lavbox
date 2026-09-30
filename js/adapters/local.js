// Adapter de fallback OFFLINE (?mode=local): mesma interface do supabase.js,
// mas o "banco" vive no localStorage e a sincronização entre abas usa BroadcastChannel.
// Cada aba tem sua própria sessão (sessionStorage) => dá para logar cliente e lavador em abas diferentes.
// Espelha a máquina de estados das RPCs do Postgres.
import { SEED_SERVICES, SEED_ADDONS, DEMO, calcPrice } from '../config.js';

const KEY = 'lavbox-local-db';
const SESSION = 'lavbox-local-session';
const bc = 'BroadcastChannel' in window ? new BroadcastChannel('lavbox-local') : null;

const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));

function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw); } catch { /* ignore */ }
  const c = 'demo-cliente', w = 'demo-lavador';
  const db = {
    users: [
      { id: c, email: DEMO.cliente.email, password: DEMO.cliente.password, role: 'cliente', nome: 'Ana Demo', telefone: '(61) 90000-0001' },
      { id: w, email: DEMO.lavador.email, password: DEMO.lavador.password, role: 'lavador', nome: 'Carlos Demo', telefone: '(61) 90000-0002',
        washer: { id: w, bairro: 'Asa Sul', servicos: ['basico', 'completo', 'premium', 'ecowash'], bio: 'Lavador de demonstração', disponivel: true } },
    ],
    vehicles: [{ id: 'v-demo', owner_id: c, tipo: 'suv', modelo: 'Jeep Compass', cor: 'Preto' }],
    orders: [], priv: {}, secrets: {}, events: [],
  };
  save(db, false);
  return db;
}
function save(db, notify = true) {
  localStorage.setItem(KEY, JSON.stringify(db));
  if (notify) bc?.postMessage('change');
}
const cur = () => sessionStorage.getItem(SESSION);
const need = () => { const id = cur(); if (!id) throw new Error('não autenticado'); return id; };
const userOf = (db, id) => db.users.find((u) => u.id === id);

function decorate(db, o) {
  const s = SEED_SERVICES.find((x) => x.id === o.service_id);
  const v = db.vehicles.find((x) => x.id === o.vehicle_id);
  return {
    ...o,
    service: s && { nome: s.nome, agua_litros: s.agua_litros, ecologico: s.ecologico, duracao_min: s.duracao_min },
    vehicle: v && { modelo: v.modelo, tipo: v.tipo, cor: v.cor },
    washer: o.washer_id ? { nome: userOf(db, o.washer_id)?.nome } : null,
    client: { nome: userOf(db, o.client_id)?.nome },
  };
}
function setStatus(db, o, to, actor) {
  db.events.push({ id: db.events.length + 1, order_id: o.id, de: o.status, para: to, actor, at: new Date().toISOString() });
  o.status = to; o.updated_at = new Date().toISOString();
}
const fail = (m) => { throw new Error(m); };
// secrets[id] = { pin, tentativas, bloqueado_ate }  (tolera formato antigo: string)
const secOf = (db, id) => {
  const s = db.secrets[id];
  return typeof s === 'string' ? (db.secrets[id] = { pin: s, tentativas: 0, bloqueado_ate: null }) : s;
};

export const adapter = {
  name: 'local',

  async me() {
    const db = load(); const u = userOf(db, cur());
    return u ? { id: u.id, role: u.role, nome: u.nome, telefone: u.telefone, washer: u.washer ?? null } : null;
  },
  async signUp({ email, password, role, nome, telefone, washer }) {
    const db = load();
    if (db.users.some((u) => u.email === email)) fail('E-mail já cadastrado.');
    const id = uuid();
    db.users.push({ id, email, password, role, nome, telefone, washer: role === 'lavador' ? { id, disponivel: true, ...washer } : undefined });
    save(db); sessionStorage.setItem(SESSION, id);
  },
  async signIn(email, password) {
    const u = load().users.find((x) => x.email === email && x.password === password);
    if (!u) fail('E-mail ou senha incorretos.');
    sessionStorage.setItem(SESSION, u.id);
  },
  async signOut() { sessionStorage.removeItem(SESSION); },

  async services() { return SEED_SERVICES; },
  async addons() { return SEED_ADDONS; },

  async vehicles() { const id = need(); return load().vehicles.filter((v) => v.owner_id === id); },
  async addVehicle({ tipo, modelo, cor }) {
    const db = load(); const v = { id: uuid(), owner_id: need(), tipo, modelo, cor }; db.vehicles.push(v); save(db); return v;
  },

  async myOrders() {
    const db = load(); const id = need();
    return db.orders.filter((o) => o.client_id === id).sort((a, b) => b.created_at.localeCompare(a.created_at)).map((o) => decorate(db, o));
  },
  async availableOrders() {
    const db = load();
    return db.orders.filter((o) => o.status === 'solicitado').map((o) => decorate(db, o));
  },
  async myJobs() {
    const db = load(); const id = need();
    return db.orders.filter((o) => o.washer_id === id).sort((a, b) => b.updated_at.localeCompare(a.updated_at)).map((o) => decorate(db, o));
  },
  async order(id) {
    const db = load(); const me = cur(); const o = db.orders.find((x) => x.id === id);
    if (!o) return null;
    const visible = o.client_id === me || o.washer_id === me || (o.status === 'solicitado' && userOf(db, me)?.role === 'lavador');
    return visible ? decorate(db, o) : null;
  },
  async orderPrivate(id) {
    const db = load(); const me = cur(); const o = db.orders.find((x) => x.id === id);
    if (!o) return null;
    const ok = o.client_id === me || (o.washer_id === me && o.status !== 'solicitado');
    return ok ? db.priv[id] : null;
  },
  async events(id) { return load().events.filter((e) => e.order_id === id); },
  async pin(id) {
    const db = load(); const o = db.orders.find((x) => x.id === id);
    return o && o.client_id === cur() ? secOf(db, id).pin : null;
  },

  async createOrder(p) {
    const db = load(); const me = need(); const u = userOf(db, me);
    if (u.role !== 'cliente') fail('apenas clientes podem criar pedidos');
    const veh = db.vehicles.find((v) => v.id === p.vehicle_id && v.owner_id === me) ?? fail('veículo inválido');
    const svc = SEED_SERVICES.find((s) => s.id === p.service_id) ?? fail('serviço inválido');
    if ((p.endereco || '').length < 5 || (p.bairro || '').length < 2) fail('endereço inválido');
    const id = uuid(); const now = new Date().toISOString();
    const pin = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
    db.orders.push({
      id, client_id: me, washer_id: null, vehicle_id: veh.id, service_id: svc.id, addon_ids: p.addons ?? [],
      bairro: p.bairro.slice(0, 60), lat: p.lat && +p.lat.toFixed(3), lng: p.lng && +p.lng.toFixed(3),
      agendado_para: p.agendado_para, preco_total: calcPrice(svc, veh.tipo, p.addons ?? [], SEED_ADDONS),
      status: 'solicitado', avaliacao: null, comentario: null, created_at: now, updated_at: now,
    });
    db.events.push({ id: db.events.length + 1, order_id: id, de: null, para: 'solicitado', actor: me, at: now });
    db.priv[id] = { order_id: id, endereco: p.endereco.slice(0, 200), telefone: u.telefone, lat: p.lat, lng: p.lng };
    db.secrets[id] = { pin, tentativas: 0, bloqueado_ate: null }; save(db);
    return { id, pin };
  },
  async accept(id) {
    const db = load(); const me = need(); const o = db.orders.find((x) => x.id === id);
    if (userOf(db, me)?.role !== 'lavador') fail('apenas lavadores');
    if (!o || o.status !== 'solicitado' || o.washer_id) fail('pedido indisponível');
    o.washer_id = me; setStatus(db, o, 'confirmado', me); save(db);
  },
  async advance(id) {
    const db = load(); const me = need(); const o = db.orders.find((x) => x.id === id && x.washer_id === me) ?? fail('pedido não encontrado');
    const next = { confirmado: 'a_caminho', a_caminho: 'chegou', em_servico: 'finalizado' }[o.status] ?? fail(`transição inválida a partir de ${o.status}`);
    setStatus(db, o, next, me); save(db);
  },
  async startService(id, pin) {
    const db = load(); const me = need(); const o = db.orders.find((x) => x.id === id && x.washer_id === me) ?? fail('pedido não encontrado');
    if (o.status !== 'chegou') fail('pedido não está no estado "chegou"');
    if (!/^[0-9]{6}$/.test(pin || '')) fail('Digite os 6 dígitos.');
    const s = secOf(db, id);
    if (s.bloqueado_ate && new Date(s.bloqueado_ate) > new Date()) {
      fail(`Muitas tentativas. Tente novamente às ${new Date(s.bloqueado_ate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`);
    }
    if (s.pin !== pin) {
      s.tentativas += 1;
      if (s.tentativas >= 5) { s.tentativas = 0; s.bloqueado_ate = new Date(Date.now() + 5 * 60000).toISOString(); save(db); fail('Muitas tentativas. Tente novamente em 5 minutos.'); }
      save(db); fail(`PIN incorreto. Restam ${5 - s.tentativas} tentativa(s).`);
    }
    s.tentativas = 0; s.bloqueado_ate = null;
    setStatus(db, o, 'em_servico', me); save(db);
  },
  async pay(id) {
    const db = load(); const me = need(); const o = db.orders.find((x) => x.id === id && x.client_id === me && x.status === 'finalizado') ?? fail('pagamento indisponível');
    setStatus(db, o, 'pago', me); save(db);
  },
  async rate(id, nota, comentario) {
    const db = load(); const me = need();
    if (!(nota >= 1 && nota <= 5)) fail('nota inválida');
    const o = db.orders.find((x) => x.id === id && x.client_id === me && x.status === 'pago') ?? fail('avaliação indisponível');
    o.avaliacao = nota; o.comentario = (comentario || '').slice(0, 300) || null; setStatus(db, o, 'avaliado', me); save(db);
  },
  async cancel(id) {
    const db = load(); const me = need();
    const o = db.orders.find((x) => x.id === id && x.client_id === me && ['solicitado', 'confirmado'].includes(x.status)) ?? fail('cancelamento indisponível');
    setStatus(db, o, 'cancelado', me); save(db);
  },
  async setAvailability(v) {
    const db = load(); const u = userOf(db, need()); if (u.washer) u.washer.disponivel = v; save(db);
  },

  subscribe(cb, onState) {
    const fn = (e) => { if (!e.key || e.key === KEY) cb(); };
    bc?.addEventListener('message', cb);
    window.addEventListener('storage', fn);
    onState?.(true);
    return () => { bc?.removeEventListener('message', cb); window.removeEventListener('storage', fn); };
  },
};
