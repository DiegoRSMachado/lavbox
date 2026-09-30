// Painel do admin: só agregados (RPC admin_kpis). Nenhum endereço, telefone ou PIN chega aqui.
// Gráficos em SVG feito à mão (sem biblioteca), compatíveis com a CSP (sem estilo inline).
import { mount, h, money, badge, fmtDateTime } from '../ui.js';
import { STATUS } from '../config.js';
import { makeRefresher } from './common.js';

const NS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}, text) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  if (text != null) el.textContent = text;   // textContent: rótulo nunca vira HTML
  return el;
};
const cut = (t, n) => (String(t).length > n ? String(t).slice(0, n - 1) + '…' : String(t));

/** Barras horizontais: items = [{ label, value }] */
function barsH(items, fmt = (v) => String(v)) {
  const rowH = 24, labelW = 112, barW = 150, W = 320, H = Math.max(1, items.length) * rowH + 4;
  const max = Math.max(1, ...items.map((i) => i.value));
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img' });
  items.forEach((it, i) => {
    const y = i * rowH + 2;
    svg.append(s('text', { x: 0, y: y + 15, class: 'svg-label' }, cut(it.label, 17)));
    svg.append(s('rect', { x: labelW, y: y + 3, width: Math.max(2, (it.value / max) * barW), height: 14, rx: 3, class: 'bar' }));
    svg.append(s('text', { x: labelW + Math.max(2, (it.value / max) * barW) + 6, y: y + 15, class: 'svg-val' }, fmt(it.value)));
  });
  return svg;
}

/** Colunas: values = [n], labels = [texto] (mostra 1 a cada `step`) */
function barsV(values, labels, step = 1) {
  const W = 320, H = 130, pad = 18, bw = (W - pad) / values.length;
  const max = Math.max(1, ...values);
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img' });
  values.forEach((v, i) => {
    const bh = (v / max) * (H - 40);
    const x = pad / 2 + i * bw;
    svg.append(s('rect', { x: x + 1, y: H - 22 - bh, width: Math.max(2, bw - 3), height: bh, rx: 2, class: 'bar' }));
    if (v > 0 && values.length <= 14) svg.append(s('text', { x: x + bw / 2, y: H - 26 - bh, class: 'svg-val', 'text-anchor': 'middle' }, v));
    if (i % step === 0) svg.append(s('text', { x: x + bw / 2, y: H - 6, class: 'svg-label', 'text-anchor': 'middle' }, labels[i]));
  });
  return svg;
}

const tile = (valor, rotulo, dica) => h('div', { class: 'stat big' }, h('b', {}, valor), h('span', {}, rotulo), dica ? h('small', {}, dica) : null);
const panel = (titulo, ...filhos) => h('section', { class: 'card panel' }, h('h3', {}, titulo), ...filhos);

export async function home({ root, api, live }) {
  const paint = (k) => {
    const total = k.total_pedidos ?? 0;
    const seed = k.pedidos_seed ?? 0;
    const porStatus = k.por_status ?? {};
    const CURTO = { solicitado: 'Solicitado', confirmado: 'Confirmado', a_caminho: 'A caminho', chegou: 'Chegou', em_servico: 'Em serviço', finalizado: 'Finalizado', pago: 'Pago', avaliado: 'Avaliado' };
    const statusItems = [...STATUS.map((x) => ({ label: CURTO[x.id] ?? x.label, value: porStatus[x.id] ?? 0 })), { label: 'Cancelado', value: porStatus.cancelado ?? 0 }];
    const horas = k.por_hora ?? Array(24).fill(0);
    const dias = k.por_dia ?? [];

    mount(root, h('div', { class: 'admin' },
      h('div', { class: 'between' }, h('h1', {}, 'Painel de operação'), badge('ao vivo · atualiza a cada 8 s', 'green')),
      seed > 0 ? h('div', { class: 'card warn' }, '⚠️ Dados de demonstração: ', h('b', {}, `${seed} de ${total} pedidos`), ' são fictícios (seed) para ilustrar o painel. Os demais são reais do teste.') : null,
      h('div', { class: 'tiles' },
        tile(String(total), 'pedidos', `${k.em_andamento ?? 0} em andamento`),
        tile(money(k.receita ?? 0), 'receita (pago/avaliado)'),
        tile(money(k.ticket_medio ?? 0), 'ticket médio'),
        tile(k.nota_media != null ? Number(k.nota_media).toFixed(2) : '—', 'nota média', '★ de 1 a 5'),
        tile(k.tempo_medio_min != null ? `${k.tempo_medio_min} min` : '—', 'tempo médio de serviço', 'início → fim'),
        tile(`${(k.agua_economizada_l ?? 0).toLocaleString('pt-BR')} L`, 'água economizada', 'EcoWash vs. 150 L convencional')),
      h('div', { class: 'admin-grid' },
        panel('Pedidos por dia (14 dias)', barsV(dias.map((d) => d.qtd), dias.map((d) => d.dia), 2)),
        panel('Demanda por hora do dia', barsV(horas, horas.map((_, i) => String(i).padStart(2, '0')), 3)),
        panel('Serviços mais pedidos', barsH((k.por_servico ?? []).map((x) => ({ label: x.nome, value: x.qtd })))),
        panel('Demanda por região', barsH((k.por_bairro ?? []).map((x) => ({ label: x.nome, value: x.qtd })))),
        panel('Pedidos por status', barsH(statusItems)),
        panel('Ranking de prestadores',
          (k.ranking ?? []).length ? h('table', { class: 'table' },
            h('thead', {}, h('tr', {}, h('th', {}, 'Prestador'), h('th', {}, 'Atend.'), h('th', {}, 'Nota'))),
            h('tbody', {}, k.ranking.map((r) => h('tr', {}, h('td', {}, r.nome), h('td', {}, String(r.concluidos)), h('td', {}, r.nota != null ? `★ ${Number(r.nota).toFixed(2)}` : '—')))))
            : h('p', { class: 'muted' }, 'Sem atendimentos concluídos.'))),
      panel('Fila de recuperação (nota ≤ 3)',
        h('p', { class: 'muted small' }, 'Avaliação baixa abre um caso para a equipe de sucesso do cliente entrar em contato.'),
        (k.alertas ?? []).length ? (k.alertas).map((a) => h('div', { class: 'alert-row' },
          h('div', {}, h('b', {}, '★'.repeat(a.nota)), h('span', { class: 'stars-off' }, '★'.repeat(5 - a.nota)), ' ', h('b', {}, `${a.nota}/5`), ' · ',h('span', { class: 'muted' }, `${a.servico} · ${a.bairro}`)),
          a.comentario ? h('div', { class: 'muted' }, `“${a.comentario}”`) : null,
          h('div', { class: 'muted small' }, fmtDateTime(a.quando)))) : h('p', { class: 'muted' }, 'Nenhum alerta. 🎉')),
      h('p', { class: 'muted small center' }, 'Todos os números são calculados no servidor (função SQL restrita ao admin). Este painel não acessa endereço, telefone nem PIN.')));
  };
  // gerado_em muda a cada chamada: fora da assinatura, senão a tela repintaria à toa a cada 8 s
  const refresh = makeRefresher(async () => { const { gerado_em, ...resto } = await api.adminKpis(); return resto; }, paint);
  await refresh();
  live(refresh);
}
