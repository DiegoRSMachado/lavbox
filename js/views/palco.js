// Palco: cliente e lavador lado a lado na MESMA tela (2 iframes, sessões isoladas via ?slot=).
// Ideal para o telão: um notebook basta para mostrar o tempo real entre os dois perfis.
import { mount, h } from '../ui.js';
import { mode } from '../api.js';

export async function palco({ root }) {
  const base = location.pathname;
  const q = (slot) => `${base}?slot=${slot}${mode === 'local' ? '&mode=local' : ''}#/`;
  const frame = (slot, title) => h('div', { class: 'stage-col' },
    h('div', { class: 'stage-label' }, title),
    h('div', { class: 'phone' }, h('iframe', { src: q(slot), title, loading: 'eager', allow: 'geolocation' })));
  mount(root, 
    h('div', { class: 'stage' },
      frame('cliente', '📱 Cliente'),
      h('div', { class: 'stage-mid' }, h('span', {}, '⇄'), h('small', {}, 'tempo real')),
      frame('lavador', '🧽 Lavador')),
    h('p', { class: 'muted center small' }, 'Cada tela tem sessão própria. Use “Entrar como Cliente / Lavador” em cada uma.'));
}
