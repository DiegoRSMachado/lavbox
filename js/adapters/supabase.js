// Adapter de produção: Supabase (Auth + Postgres com RLS + Realtime).
// Mesma interface do local.js. Toda escrita em pedidos passa por RPC (SECURITY DEFINER).
import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';

const slot = new URLSearchParams(location.search).get('slot') || 'main';
// storageKey por "slot" permite 2 sessões diferentes no mesmo navegador (modo Palco).
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { storageKey: `lavbox-auth-${slot}`, persistSession: true, autoRefreshToken: true },
});

const unwrap = ({ data, error }) => {
  if (error) throw new Error(error.message);
  return data;
};

const ORDER_SELECT =
  '*, service:services(nome,agua_litros,ecologico,duracao_min),' +
  ' vehicle:vehicles(modelo,tipo,cor),' +
  ' washer:profiles!orders_washer_id_fkey(nome),' +
  ' client:profiles!orders_client_id_fkey(nome)';

// Mensagem amigável para o retorno de start_service (o servidor não lança erro, p/ o contador persistir).
function pinMessage(r = {}) {
  if (r.motivo === 'bloqueado') {
    const ate = r.bloqueado_ate ? new Date(r.bloqueado_ate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'alguns minutos';
    return `Muitas tentativas. Tente novamente às ${ate}.`;
  }
  if (r.motivo === 'formato') return 'Digite os 6 dígitos.';
  return `PIN incorreto. Restam ${r.restantes} tentativa(s).`;
}

let uidCache = null;
async function uid() {
  if (uidCache) return uidCache;
  const { data } = await sb.auth.getSession();
  uidCache = data.session?.user.id ?? null;
  return uidCache;
}

export const adapter = {
  name: 'supabase',

  // ---------- auth ----------
  async me() {
    uidCache = null;
    const id = await uid();
    if (!id) return null;
    const profile = unwrap(await sb.from('profiles').select('*').eq('id', id).maybeSingle());
    if (!profile) return null;
    let washer = null;
    if (profile.role === 'lavador') washer = unwrap(await sb.from('washers').select('*').eq('id', id).maybeSingle());
    return { ...profile, washer };
  },
  async signUp({ email, password, role, nome, telefone, washer }) {
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) throw new Error(error.message);
    if (!data.session) throw new Error('Confirme seu e-mail para ativar a conta (confirmação ligada no projeto).');
    uidCache = data.user.id;
    unwrap(await sb.from('profiles').insert({ id: data.user.id, role, nome, telefone: telefone || null }));
    if (role === 'lavador') unwrap(await sb.from('washers').insert({ id: data.user.id, ...washer }));
  },
  async signIn(email, password) {
    uidCache = null;
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message);
  },
  async signOut() { uidCache = null; await sb.auth.signOut(); },

  // ---------- catálogo ----------
  async services() { return unwrap(await sb.from('services').select('*').order('preco')); },
  async addons() { return unwrap(await sb.from('addons').select('*').order('preco')); },

  // ---------- veículos ----------
  async vehicles() { return unwrap(await sb.from('vehicles').select('*').order('created_at')); },
  async addVehicle({ tipo, modelo, cor }) {
    return unwrap(await sb.from('vehicles').insert({ owner_id: await uid(), tipo, modelo, cor: cor || null }).select().single());
  },

  // ---------- pedidos: leitura ----------
  async myOrders() {
    return unwrap(await sb.from('orders').select(ORDER_SELECT).eq('client_id', await uid()).order('created_at', { ascending: false }));
  },
  async availableOrders() {
    return unwrap(await sb.from('orders').select(ORDER_SELECT).eq('status', 'solicitado').order('created_at'));
  },
  async myJobs() {
    return unwrap(await sb.from('orders').select(ORDER_SELECT).eq('washer_id', await uid()).order('updated_at', { ascending: false }));
  },
  async order(id) { return unwrap(await sb.from('orders').select(ORDER_SELECT).eq('id', id).maybeSingle()); },
  async orderPrivate(id) { return unwrap(await sb.from('order_private').select('*').eq('order_id', id).maybeSingle()); },
  async events(id) { return unwrap(await sb.from('order_events').select('*').eq('order_id', id).order('id')); },
  async pin(id) { return unwrap(await sb.rpc('get_pin', { p_id: id })); },

  // ---------- pedidos: escrita (somente RPC) ----------
  async createOrder(o) {
    return unwrap(await sb.rpc('create_order', {
      p_vehicle: o.vehicle_id, p_service: o.service_id, p_addons: o.addons, p_bairro: o.bairro,
      p_lat: o.lat, p_lng: o.lng, p_endereco: o.endereco, p_agendado: o.agendado_para,
    }));
  },
  async accept(id) { unwrap(await sb.rpc('accept_order', { p_id: id })); },
  async advance(id) { unwrap(await sb.rpc('advance_order', { p_id: id })); },
  async startService(id, pin) {
    const r = unwrap(await sb.rpc('start_service', { p_id: id, p_pin: pin }));
    if (!r?.ok) throw new Error(pinMessage(r));
  },
  async pay(id) { unwrap(await sb.rpc('pay_order', { p_id: id })); },
  async rate(id, nota, comentario) { unwrap(await sb.rpc('rate_order', { p_id: id, p_nota: nota, p_comentario: comentario || null })); },
  async cancel(id) { unwrap(await sb.rpc('cancel_order', { p_id: id })); },
  async setAvailability(v) { unwrap(await sb.from('washers').update({ disponivel: v }).eq('id', await uid())); },

  // ---------- realtime ----------
  // cb() é chamado a cada mudança visível a este usuário (a RLS filtra no servidor).
  subscribe(cb, onState) {
    const ch = sb.channel('lb-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, cb)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_events' }, cb)
      .subscribe((s) => onState?.(s === 'SUBSCRIBED'));
    return () => sb.removeChannel(ch);
  },
};
