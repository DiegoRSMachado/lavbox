import { mount, h, go, money, actionButton, toast, stars, badge, fmtDateTime } from '../ui.js';
import { addonNames, AGUA_CONVENCIONAL, VEHICLE_TYPES, calcPrice, vehicleIcon, statusLabel } from '../config.js';
import { initMap, geocode, startTracking } from './map.js';
import { qrCanvas, qrPayload } from './qr.js';
import { orderCard, progressList, kv, isActive, makeRefresher } from './common.js';

// ============ HOME ============
export async function home({ root, me, api, live }) {
  const paint = ({ orders }) => {
    const active = orders.filter(isActive);
    const past = orders.filter((o) => !isActive(o));
    const saved = orders.filter((o) => ['pago', 'avaliado'].includes(o.status) && o.service?.ecologico)
      .reduce((s, o) => s + (AGUA_CONVENCIONAL - o.service.agua_litros), 0);
    mount(root, 
      h('section', {},
        h('h1', {}, `Olá, ${me.nome.split(' ')[0]} 👋`),
        h('p', { class: 'muted' }, 'Onde o seu carro estiver, a gente lava.'),
        h('a', { class: 'btn primary big', href: '#/cliente/novo' }, '＋ Pedir lavagem')),
      saved > 0 ? h('div', { class: 'card eco' }, '🌿 Você já economizou aproximadamente ', h('b', {}, `${saved} litros`), ' de água com o EcoWash.') : null,
      h('section', {}, h('h2', {}, 'Em andamento'),
        active.length ? active.map((o) => orderCard(o, { href: `#/cliente/pedido/${o.id}` }))
          : h('p', { class: 'muted empty' }, 'Nenhum pedido ativo. Que tal lavar o carro hoje?')),
      past.length ? h('section', {}, h('h2', {}, 'Histórico'), past.map((o) => orderCard(o, { href: `#/cliente/pedido/${o.id}` }))) : null);
  };
  const refresh = makeRefresher(async () => ({ orders: await api.myOrders() }), paint);
  await refresh();
  live(refresh);
}

// ============ WIZARD (jornada de 12 passos condensada em 5 telas) ============
export async function wizard({ root, api }) {
  const [services, addons] = await Promise.all([api.services(), api.addons()]);
  let vehicles = await api.vehicles();
  const w = {
    step: 0, vehicle_id: vehicles[0]?.id ?? null, service_id: 'completo', addons: [],
    endereco: '', bairro: '', lat: -15.794, lng: -47.882, quando: 'agora', when: '', metodo: 'pix', addingVehicle: !vehicles.length,
  };
  const veh = () => vehicles.find((v) => v.id === w.vehicle_id);
  const svc = () => services.find((s) => s.id === w.service_id);
  const total = () => calcPrice(svc(), veh()?.tipo, w.addons, addons);
  const titles = ['Veículo', 'Tipo de lavagem', 'Personalização', 'Local e horário', 'Conferência'];

  function stepVehicle() {
    const tipo = h('div', { class: 'chips' });
    let vt = 'carro';
    const modelo = h('input', { maxlength: 60, placeholder: 'Ex.: Honda Civic' });
    const cor = h('input', { maxlength: 30, placeholder: 'Ex.: Prata' });
    const paintTipo = () => tipo.replaceChildren(...VEHICLE_TYPES.map((t) =>
      h('button', { type: 'button', class: 'chip' + (vt === t.id ? ' on' : ''), onclick: () => { vt = t.id; paintTipo(); } }, `${t.icon} ${t.label}`)));
    paintTipo();
    const addForm = h('div', { class: 'card form inner' },
      h('h3', {}, 'Novo veículo'), tipo,
      h('label', { class: 'field' }, h('span', {}, 'Modelo'), modelo),
      h('label', { class: 'field' }, h('span', {}, 'Cor (opcional)'), cor),
      h('div', { class: 'row' },
        actionButton('Salvar veículo', async () => {
          if (modelo.value.trim().length < 2) throw new Error('Informe o modelo.');
          const v = await api.addVehicle({ tipo: vt, modelo: modelo.value.trim(), cor: cor.value.trim() });
          vehicles = await api.vehicles(); w.vehicle_id = v.id; w.addingVehicle = false; paint();
        }, 'btn primary sm'),
        vehicles.length ? h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { w.addingVehicle = false; paint(); } }, 'Cancelar') : null));
    if (w.addingVehicle) return addForm;
    return h('div', {},
      vehicles.map((v) => h('button', { type: 'button', class: 'card pick' + (w.vehicle_id === v.id ? ' on' : ''), onclick: () => { w.vehicle_id = v.id; paint(); } },
        h('span', { class: 'big-ico' }, vehicleIcon(v.tipo)), h('div', {}, h('strong', {}, v.modelo), h('div', { class: 'muted' }, `${v.tipo}${v.cor ? ' · ' + v.cor : ''}`)))),
      h('button', { class: 'btn ghost', type: 'button', onclick: () => { w.addingVehicle = true; paint(); } }, '＋ Adicionar veículo'));
  }

  function stepService() {
    return h('div', {}, services.map((s) => h('button', { type: 'button', class: 'card pick col' + (w.service_id === s.id ? ' on' : ''), onclick: () => { w.service_id = s.id; paint(); } },
      h('div', { class: 'between' }, h('strong', {}, s.nome), h('strong', { class: 'price' }, money(calcPrice(s, veh()?.tipo, [], addons)))),
      h('div', { class: 'muted' }, s.descricao),
      h('div', { class: 'row tags' }, badge(`⏱ ~${s.duracao_min} min`), s.ecologico ? badge(`🌿 usa ${s.agua_litros} L (−${AGUA_CONVENCIONAL - s.agua_litros} L)`, 'green') : null,
        s.id === 'completo' ? badge('mais escolhido', 'cyan') : null))));
  }

  function stepAddons() {
    return h('div', {}, h('p', { class: 'muted' }, 'Adicione cuidados extras. O preço é recalculado na hora.'),
      addons.map((a) => {
        const on = w.addons.includes(a.id);
        return h('button', { type: 'button', role: 'switch', 'aria-checked': String(on), class: 'card toggle' + (on ? ' on' : ''),
          onclick: () => { w.addons = on ? w.addons.filter((x) => x !== a.id) : [...w.addons, a.id]; paint(); } },
          h('div', {}, h('strong', {}, a.nome), h('div', { class: 'muted' }, `+ ${money(a.preco)}`)), h('span', { class: 'switch' }, h('i')));
      }));
  }

  function stepLocal() {
    const end = h('input', { value: w.endereco, maxlength: 200, placeholder: 'Rua/quadra, número, complemento', oninput: (e) => { w.endereco = e.target.value; } });
    const bai = h('input', { value: w.bairro, maxlength: 60, placeholder: 'Ex.: Asa Norte', oninput: (e) => { w.bairro = e.target.value; } });
    const when = h('input', { type: 'datetime-local', value: w.when, oninput: (e) => { w.when = e.target.value; } });
    const info = h('p', { class: 'muted small' }, w.geo ? '📍 Local marcado no mapa.' : 'Toque no mapa ou arraste o pino para marcar o local exato.');
    const box = h('div', { class: 'map' });
    let mm = null;
    const move = (p) => { w.lat = p.lat; w.lng = p.lng; w.geo = true; info.textContent = '📍 Local marcado no mapa.'; };
    setTimeout(() => { mm = initMap(box, { center: { lat: w.lat, lng: w.lng }, pin: { lat: w.lat, lng: w.lng }, draggable: true, onMove: move }); }, 0);
    const buscar = actionButton('🔎 Buscar pelo endereço', async () => {
      if (w.endereco.trim().length < 5) throw new Error('Digite o endereço antes de buscar.');
      const r = await geocode([w.endereco, w.bairro, 'Brasília, DF'].filter(Boolean).join(', '));
      if (!r) throw new Error('Endereço não encontrado. Toque no mapa para marcar o local.');
      move(r); mm?.setPin(r); toast('Local encontrado. Ajuste o pino se precisar.', 'ok');
    }, 'btn ghost sm');
    const gps = h('button', { class: 'btn ghost sm', type: 'button', onclick: () => {
      if (!navigator.geolocation) return toast('Geolocalização indisponível neste aparelho.', 'err');
      navigator.geolocation.getCurrentPosition(
        (p) => { const q = { lat: p.coords.latitude, lng: p.coords.longitude }; move(q); mm?.setPin(q); },
        () => toast('Não foi possível obter a localização. Toque no mapa.', 'err'), { timeout: 8000 });
    } }, '📍 Usar minha localização');
    return h('div', { class: 'card form inner' },
      h('label', { class: 'field' }, h('span', {}, 'Endereço do atendimento'), end),
      h('label', { class: 'field' }, h('span', {}, 'Bairro / região'), bai),
      h('div', { class: 'row' }, buscar, gps), box, info,
      h('div', { class: 'seg' },
        h('button', { type: 'button', class: w.quando === 'agora' ? 'on' : '', onclick: () => { w.quando = 'agora'; paint(); } }, 'Lavar agora'),
        h('button', { type: 'button', class: w.quando === 'agendar' ? 'on' : '', onclick: () => { w.quando = 'agendar'; paint(); } }, 'Agendar')),
      w.quando === 'agendar' ? h('label', { class: 'field' }, h('span', {}, 'Data e horário'), when) : null);
  }

  function stepReview() {
    const s = svc(); const v = veh();
    const chosen = addons.filter((a) => w.addons.includes(a.id));
    return h('div', {},
      h('div', { class: 'card' }, h('h3', {}, 'Resumo do pedido'),
        kv('Veículo', `${vehicleIcon(v.tipo)} ${v.modelo}`), kv('Serviço', s.nome),
        chosen.length ? kv('Extras', chosen.map((a) => a.nome).join(', ')) : null,
        kv('Local', `${w.bairro} — ${w.endereco}`),
        kv('Quando', w.quando === 'agora' ? 'Imediato' : fmtDateTime(w.when)),
        kv('Duração estimada', `~${s.duracao_min} min`),
        h('div', { class: 'kv total' }, h('span', {}, 'Total'), h('strong', {}, money(total())))),
      h('div', { class: 'card' }, h('h3', {}, 'Forma de pagamento'),
        h('div', { class: 'chips' }, [['pix', 'PIX'], ['cartao', 'Cartão'], ['carteira', 'Carteira digital']].map(([id, l]) =>
          h('button', { type: 'button', class: 'chip' + (w.metodo === id ? ' on' : ''), onclick: () => { w.metodo = id; paint(); } }, l))),
        h('p', { class: 'muted small' }, '🔒 Pagamento simulado nesta demonstração: nenhum dado de cartão é coletado. O valor fica autorizado e só é cobrado após a conclusão do serviço.')));
  }

  function valid() {
    if (w.step === 0) return !!veh();
    if (w.step === 3) {
      if (w.endereco.trim().length < 5) throw new Error('Informe o endereço do atendimento.');
      if (w.bairro.trim().length < 2) throw new Error('Informe o bairro.');
      if (w.quando === 'agendar' && (!w.when || new Date(w.when) < new Date())) throw new Error('Escolha uma data futura.');
    }
    return true;
  }

  const body = h('div', { class: 'wiz-body' });
  const bar = h('div', { class: 'wiz-bar' });
  const nav = h('div', { class: 'wiz-nav' });
  function paint() {
    bar.replaceChildren(h('div', { class: 'wiz-title' }, h('span', { class: 'muted' }, `Passo ${w.step + 1} de ${titles.length}`), h('h1', {}, titles[w.step])),
      h('div', { class: 'meter' }, h('i', { style: { width: `${((w.step + 1) / titles.length) * 100}%` } })));
    body.replaceChildren([stepVehicle, stepService, stepAddons, stepLocal, stepReview][w.step]());
    const last = w.step === titles.length - 1;
    nav.replaceChildren(
      w.step > 0 ? h('button', { class: 'btn ghost', type: 'button', onclick: () => { w.step--; paint(); } }, 'Voltar') : h('a', { class: 'btn ghost', href: '#/cliente' }, 'Cancelar'),
      last ? actionButton(`Confirmar · ${money(total())}`, async () => {
        const r = await api.createOrder({
          vehicle_id: w.vehicle_id, service_id: w.service_id, addons: w.addons, bairro: w.bairro.trim(), endereco: w.endereco.trim(),
          lat: w.lat, lng: w.lng, agendado_para: w.quando === 'agendar' ? new Date(w.when).toISOString() : null,
        });
        toast('Pedido enviado aos lavadores!', 'ok');
        go(`/cliente/pedido/${r.id}`);
      }) : actionButton(`Continuar · ${money(total())}`, async () => { if (valid()) { w.step++; paint(); window.scrollTo(0, 0); } }));
  }
  mount(root, bar, body, nav);
  paint();
}

// ============ ACOMPANHAMENTO (Live Progress) ============
export async function order({ root, params, api, live, onLeave }) {
  const id = params[0];
  let rating = 0; let comment = ''; let metodo = 'pix';

  const load = async () => {
    const o = await api.order(id);
    if (!o) return { o: null };
    const [events, priv] = await Promise.all([api.events(id), api.orderPrivate(id)]);
    const pin = ['solicitado', 'confirmado', 'a_caminho', 'chegou'].includes(o.status) ? await api.pin(id) : null;
    return { o, events, priv, pin };
  };

  let lastData = null;
  let stopTrack = null;
  onLeave(() => stopTrack?.());
  const paint = (data) => {
    stopTrack?.(); stopTrack = null;
    lastData = data;
    const { o, events, priv, pin } = data;
    if (!o) return mount(root, h('div', { class: 'card' }, h('p', {}, 'Pedido não encontrado.'), h('a', { class: 'btn ghost', href: '#/cliente' }, 'Voltar')));
    const eco = o.service?.ecologico ? AGUA_CONVENCIONAL - o.service.agua_litros : 0;
    const headline = {
      solicitado: 'Procurando um lavador para você…', confirmado: `${o.washer?.nome ?? 'Seu lavador'} aceitou o pedido`,
      a_caminho: 'O lavador está a caminho', chegou: 'O lavador chegou! Informe o código abaixo',
      em_servico: 'Lavagem em andamento', finalizado: 'Lavagem finalizada! Confirme o pagamento',
      pago: 'Pagamento concluído. Avalie o serviço', avaliado: 'Tudo certo! Obrigado ✨', cancelado: 'Pedido cancelado',
    }[o.status];
    const comentario = h('textarea', { maxlength: 300, rows: 2, placeholder: 'Comentário (opcional)', oninput: (e) => { comment = e.target.value; } });
    comentario.value = comment;
    const starsEl = stars(rating, (n) => { rating = n; paint(lastData); });

    const tracking = priv?.lat != null && ['solicitado', 'confirmado', 'a_caminho', 'chegou', 'em_servico'].includes(o.status);
    const mapBox = h('div', { class: 'map' }); const etaEl = h('p', { class: 'eta' });
    const trackCard = tracking ? h('div', { class: 'card' }, h('div', { class: 'between' }, h('strong', {}, 'Acompanhe no mapa'), badge('simulado', 'amber')), mapBox, etaEl) : null;
    if (tracking) {
      const tStart = events.find((e) => e.para === 'a_caminho')?.at;
      setTimeout(() => { stopTrack = startTracking(mapBox, etaEl, { dest: { lat: priv.lat, lng: priv.lng }, orderId: o.id, status: o.status, tStart: tStart ? new Date(tStart).getTime() : Date.now() }); }, 0);
    }

    mount(root, 
      h('a', { class: 'link back', href: '#/cliente' }, '← Meus pedidos'),
      h('div', { class: 'card live-card' },
        h('div', { class: 'between' }, h('h2', {}, 'Live Progress'), badge('● ao vivo', 'green')),
        h('p', { class: 'headline' }, headline), progressList(o, events)),
      trackCard,
      o.washer ? h('div', { class: 'card washer-card' }, h('span', { class: 'avatar' }, o.washer.nome?.[0] ?? '?'),
        h('div', {}, h('strong', {}, o.washer.nome), h('div', { class: 'muted' }, 'Seu profissional LAVBOX'))) : null,
      pin ? h('div', { class: 'card pin-card' }, h('div', { class: 'muted' }, 'Código de início do serviço'), h('div', { class: 'pin' }, pin), h('div', { class: 'qr-wrap' }, qrCanvas(qrPayload(o.id, pin))),
        h('p', { class: 'muted small' }, 'Só passe o código quando o lavador chegar. Ele confirma que o serviço realmente começou.')) : null,
      o.status === 'finalizado' ? h('div', { class: 'card' }, h('h3', {}, `Pagar ${money(o.preco_total)}`),
        h('div', { class: 'chips' }, [['pix', 'PIX'], ['cartao', 'Cartão'], ['carteira', 'Carteira']].map(([k, l]) =>
          h('button', { type: 'button', class: 'chip' + (metodo === k ? ' on' : ''), onclick: () => { metodo = k; paint(lastData); } }, l))),
        h('p', { class: 'muted small' }, 'Pagamento simulado: nenhum dado financeiro é coletado.'),
        actionButton('Confirmar pagamento', async () => { await api.pay(id); toast('Pagamento confirmado!', 'ok'); await refresh(); })) : null,
      o.status === 'pago' ? h('div', { class: 'card' }, h('h3', {}, 'Como foi o serviço?'), starsEl, comentario,
        actionButton('Enviar avaliação', async () => { if (!rating) throw new Error('Toque nas estrelas para dar uma nota.'); await api.rate(id, rating, comment); toast('Obrigado pela avaliação!', 'ok'); await refresh(); })) : null,
      o.status === 'avaliado' ? h('div', { class: 'card' }, h('div', { class: 'between' }, h('strong', {}, 'Sua avaliação'), stars(o.avaliacao)), o.comentario ? h('p', { class: 'muted' }, `“${o.comentario}”`) : null) : null,
      ['finalizado', 'pago', 'avaliado'].includes(o.status) && eco > 0 ? h('div', { class: 'card eco' }, `🌿 Nesta lavagem você economizou ~${eco} L de água.`) : null,
      h('div', { class: 'card' }, h('h3', {}, 'Detalhes'),
        kv('Serviço', o.service?.nome), kv('Veículo', `${vehicleIcon(o.vehicle?.tipo)} ${o.vehicle?.modelo}`),
        kv('Extras', o.addon_ids?.length ? addonNames(o.addon_ids) : '—'),
        kv('Local', priv?.endereco ? `${o.bairro} — ${priv.endereco}` : o.bairro),
        kv('Status', statusLabel(o.status)), h('div', { class: 'kv total' }, h('span', {}, 'Total'), h('strong', {}, money(o.preco_total)))),
      ['solicitado', 'confirmado'].includes(o.status) ? actionButton('Cancelar pedido', async () => {
        if (!confirm('Cancelar este pedido?')) return; await api.cancel(id); toast('Pedido cancelado.'); await refresh();
      }, 'btn danger') : null,
      ['avaliado', 'cancelado'].includes(o.status) ? h('a', { class: 'btn primary', href: '#/cliente/novo' }, 'Pedir outra lavagem') : null);
  };

  const refresh = makeRefresher(load, paint);
  await refresh();
  live(refresh);
}
