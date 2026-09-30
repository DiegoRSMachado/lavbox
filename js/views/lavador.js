import { mount, h, go, money, actionButton, toast, badge, stars } from '../ui.js';
import { addonNames, vehicleIcon, statusLabel } from '../config.js';
import { startTracking } from './map.js';
import { orderCard, kv, isActive, makeRefresher, progressList } from './common.js';

// ============ PAINEL ============
export async function home({ root, me, api, live }) {
  let tab = 'disp';
  let known = null; // ids já vistos, para avisar de pedido novo
  let washer = me.washer;

  const paint = ({ available, jobs }) => {
    const mine = jobs.filter(isActive);
    const done = jobs.filter((j) => ['pago', 'avaliado'].includes(j.status));
    const earned = done.reduce((s, j) => s + Number(j.preco_total), 0);
    const list = available.filter((o) => !washer?.servicos?.length || washer.servicos.includes(o.service_id));

    const toggle = h('button', { type: 'button', role: 'switch', 'aria-checked': String(!!washer?.disponivel),
      class: 'card toggle' + (washer?.disponivel ? ' on' : ''),
      onclick: async () => {
        try { await api.setAvailability(!washer.disponivel); washer = { ...washer, disponivel: !washer.disponivel }; paint({ available, jobs }); }
        catch (e) { toast(e.message, 'err'); }
      } },
      h('div', {}, h('strong', {}, washer?.disponivel ? 'Você está disponível' : 'Você está offline'),
        h('div', { class: 'muted' }, washer?.disponivel ? 'Recebendo novos pedidos' : 'Ative para receber pedidos')),
      h('span', { class: 'switch' }, h('i')));

    mount(root, 
      h('h1', {}, `Olá, ${me.nome.split(' ')[0]}`),
      h('div', { class: 'stats' },
        h('div', { class: 'stat' }, h('b', {}, String(done.length)), h('span', {}, 'concluídos')),
        h('div', { class: 'stat' }, h('b', {}, money(earned)), h('span', {}, 'faturado')),
        h('div', { class: 'stat' }, h('b', {}, String(list.length)), h('span', {}, 'disponíveis'))),
      toggle,
      h('div', { class: 'seg' },
        h('button', { type: 'button', class: tab === 'disp' ? 'on' : '', onclick: () => { tab = 'disp'; paint({ available, jobs }); } }, `Disponíveis (${list.length})`),
        h('button', { type: 'button', class: tab === 'meus' ? 'on' : '', onclick: () => { tab = 'meus'; paint({ available, jobs }); } }, `Meus serviços (${mine.length})`)),
      tab === 'disp'
        ? (washer?.disponivel
          ? (list.length ? list.map((o) => orderCard(o, {
            extra: h('div', { class: 'row' },
              actionButton('Aceitar pedido', async () => { await api.accept(o.id); toast('Pedido aceito!', 'ok'); go(`/lavador/pedido/${o.id}`); }, 'btn primary sm'),
              o.service?.duracao_min ? badge(`⏱ ~${o.service.duracao_min} min`) : null),
          })) : h('p', { class: 'muted empty' }, 'Nenhum pedido no momento. Novos pedidos aparecem aqui ao vivo.'))
          : h('p', { class: 'muted empty' }, 'Você está offline. Ative a disponibilidade para ver pedidos.'))
        : (mine.length ? mine.map((o) => orderCard(o, { href: `#/lavador/pedido/${o.id}` }))
          : h('p', { class: 'muted empty' }, 'Você não tem serviços em andamento.')),
      done.length && tab === 'meus' ? h('section', {}, h('h2', {}, 'Concluídos'), done.map((o) => orderCard(o, { href: `#/lavador/pedido/${o.id}` }))) : null);
  };

  const refresh = makeRefresher(async () => {
    const [available, jobs, m] = await Promise.all([api.availableOrders(), api.myJobs(), api.me()]);
    if (m?.washer) washer = m.washer;
    const ids = available.map((o) => o.id);
    if (known && ids.some((id) => !known.has(id)) && washer?.disponivel) {
      toast('🔔 Novo pedido disponível!', 'ok');
      navigator.vibrate?.(200);
    }
    known = new Set(ids);
    return { available, jobs };
  }, paint);
  await refresh();
  live(refresh);
}

// ============ SERVIÇO EM ANDAMENTO ============
export async function job({ root, params, api, live, onLeave }) {
  const id = params[0];
  let pin = '';
  let stopTrack = null;
  onLeave(() => stopTrack?.());

  const load = async () => {
    const o = await api.order(id);
    if (!o) return { o: null };
    const [events, priv] = await Promise.all([api.events(id), api.orderPrivate(id)]);
    return { o, events, priv };
  };

  const paint = ({ o, events, priv }) => {
    if (!o) return mount(root, h('div', { class: 'card' }, h('p', {}, 'Pedido não encontrado ou indisponível.'), h('a', { class: 'btn ghost', href: '#/lavador' }, 'Voltar')));
    stopTrack?.(); stopTrack = null;
    const pinInput = h('input', { class: 'pin-input', inputmode: 'numeric', maxlength: 6, autocomplete: 'one-time-code', placeholder: '••••••', 'aria-label': 'Código de 6 dígitos do cliente',
      oninput: (e) => { pin = e.target.value.replace(/\D/g, '').slice(0, 6); e.target.value = pin; } });
    pinInput.value = pin;

    const step = {
      confirmado: () => actionButton('🚗 Sair para o atendimento', () => api.advance(id).then(() => refresh())),
      a_caminho: () => actionButton('📍 Cheguei ao local', () => api.advance(id).then(() => refresh())),
      chegou: () => h('div', { class: 'card' }, h('h3', {}, 'Iniciar com o código do cliente'),
        h('p', { class: 'muted small' }, 'Peça o código de 6 dígitos ao cliente. O serviço só inicia com ele (5 erros bloqueiam por 5 min).'), pinInput,
        actionButton('▶ Iniciar lavagem', async () => { if (pin.length !== 6) throw new Error('Digite os 6 dígitos.'); await api.startService(id, pin); pin = ''; toast('Serviço iniciado!', 'ok'); await refresh(); })),
      em_servico: () => actionButton('✅ Finalizar lavagem', () => api.advance(id).then(() => refresh())),
    }[o.status];
    const stepEl = step ? step() : null;
    const showMap = priv?.lat != null && ['confirmado', 'a_caminho', 'chegou', 'em_servico'].includes(o.status);
    const mapBox = h('div', { class: 'map' }); const etaEl = h('p', { class: 'eta' });
    const mapCard = showMap ? h('div', { class: 'card' }, h('div', { class: 'between' }, h('strong', {}, 'Rota até o cliente'), badge('simulado', 'amber')), mapBox, etaEl) : null;
    if (showMap) {
      const tStart = events.find((e) => e.para === 'a_caminho')?.at;
      setTimeout(() => { stopTrack = startTracking(mapBox, etaEl, { dest: { lat: priv.lat, lng: priv.lng }, orderId: o.id, status: o.status, tStart: tStart ? new Date(tStart).getTime() : Date.now() }); }, 0);
    }
    const wait = {
      solicitado: 'Pedido ainda não aceito.', finalizado: 'Aguardando o cliente confirmar o pagamento…',
      pago: 'Pagamento recebido. Aguardando avaliação do cliente…',
    }[o.status];

    mount(root, 
      h('a', { class: 'link back', href: '#/lavador' }, '← Painel'),
      h('div', { class: 'card live-card' }, h('div', { class: 'between' }, h('h2', {}, statusLabel(o.status)), badge(money(o.preco_total), 'cyan')), progressList(o, events)),
      stepEl,
      mapCard,
      wait ? h('p', { class: 'muted empty' }, wait) : null,
      o.status === 'avaliado' ? h('div', { class: 'card' }, h('div', { class: 'between' }, h('strong', {}, 'Avaliação do cliente'), stars(o.avaliacao)), o.comentario ? h('p', { class: 'muted' }, `“${o.comentario}”`) : null) : null,
      h('div', { class: 'card' }, h('h3', {}, 'Dados do atendimento'),
        kv('Cliente', o.client?.nome ?? '—'), kv('Veículo', `${vehicleIcon(o.vehicle?.tipo)} ${o.vehicle?.modelo ?? ''}${o.vehicle?.cor ? ' · ' + o.vehicle.cor : ''}`),
        kv('Serviço', o.service?.nome), kv('Extras', o.addon_ids?.length ? addonNames(o.addon_ids) : '—'), kv('Bairro', o.bairro),
        priv ? kv('Endereço', priv.endereco) : null, priv?.telefone ? kv('Telefone', priv.telefone) : null,
        priv?.lat != null ? h('a', { class: 'btn ghost sm', target: '_blank', rel: 'noopener noreferrer',
          href: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(priv.lat + ',' + priv.lng)}` }, '🗺 Abrir rota no Google Maps') : null));
  };

  const refresh = makeRefresher(load, paint);
  await refresh();
  live(refresh);
}
