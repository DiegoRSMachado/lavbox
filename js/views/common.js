import { h, money, fmtDateTime, fmtTime, statusBadge } from '../ui.js';
import { STATUS, statusLabel, vehicleIcon } from '../config.js';

export const isActive = (o) => !['avaliado', 'cancelado'].includes(o.status);

export function orderCard(o, { href, extra } = {}) {
  const el = h(href ? 'a' : 'div', { class: 'card order-card', href },
    h('div', { class: 'oc-top' },
      h('div', {}, h('strong', {}, o.service?.nome ?? o.service_id), ' ',
        h('span', { class: 'muted' }, `${vehicleIcon(o.vehicle?.tipo)} ${o.vehicle?.modelo ?? ''}`)),
      statusBadge(o.status)),
    h('div', { class: 'oc-mid' }, h('span', { class: 'muted' }, `📍 ${o.bairro}`), h('strong', {}, money(o.preco_total))),
    h('div', { class: 'oc-bot muted' },
      o.agendado_para ? `Agendado: ${fmtDateTime(o.agendado_para)}` : 'Atendimento imediato',
      ' · ', statusLabel(o.status)),
    extra);
  return el;
}

export function progressList(order, events) {
  const at = {};
  for (const e of events) at[e.para] = e.at;
  const cancelled = order.status === 'cancelado';
  const idx = STATUS.findIndex((s) => s.id === order.status);
  return h('ol', { class: 'progress' },
    STATUS.map((s, i) => {
      const state = cancelled ? (at[s.id] ? 'done' : 'todo') : i < idx ? 'done' : i === idx ? 'current' : 'todo';
      return h('li', { class: state },
        h('span', { class: 'pdot' }, state === 'done' ? '✓' : ''),
        h('span', { class: 'plabel' }, s.label),
        at[s.id] ? h('time', {}, fmtTime(at[s.id])) : null);
    }),
    cancelled ? h('li', { class: 'current cancel' }, h('span', { class: 'pdot' }, '✕'), h('span', { class: 'plabel' }, 'Pedido cancelado'),
      at.cancelado ? h('time', {}, fmtTime(at.cancelado)) : null) : null);
}

export const kv = (k, v) => h('div', { class: 'kv' }, h('span', { class: 'muted' }, k), h('span', {}, v));

// Repinta só se os dados mudaram (evita perder foco/valor de inputs em eventos realtime repetidos).
export function makeRefresher(load, paint) {
  let last = '';
  return async () => {
    const data = await load();
    const sig = JSON.stringify(data);
    if (sig === last) return;
    last = sig;
    paint(data);
  };
}
