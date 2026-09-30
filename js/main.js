// Shell do app: router por hash (compatível com GitHub Pages), guarda de perfil,
// realtime + polling de segurança e registro do Service Worker.
import { api, mode, slot } from './api.js';
import { h, go } from './ui.js';
import * as auth from './views/auth.js';
import * as cliente from './views/cliente.js';
import * as lavador from './views/lavador.js';
import * as admin from './views/admin.js';
import { rota } from './views/rota.js';
import { palco } from './views/palco.js';

const routes = [
  [/^\/$/, auth.landing, { public: true }],
  [/^\/entrar$/, auth.login, { public: true }],
  [/^\/cadastro$/, auth.signup, { public: true }],
  [/^\/palco$/, palco, { public: true }],
  [/^\/cliente$/, cliente.home, { role: 'cliente' }],
  [/^\/cliente\/novo$/, cliente.wizard, { role: 'cliente' }],
  [/^\/cliente\/pedido\/([\w-]+)$/, cliente.order, { role: 'cliente' }],
  [/^\/lavador$/, lavador.home, { role: 'lavador' }],
  [/^\/lavador\/pedido\/([\w-]+)$/, lavador.job, { role: 'lavador' }],
  [/^\/admin$/, admin.home, { role: 'admin' }],
  [/^\/lavador\/rota$/, rota, { role: 'lavador' }],
];

const dot = h('span', { class: 'live-dot', title: 'Conexão em tempo real' });
const liveTxt = h('span', { class: 'live-txt' }, '');
const userChip = h('div', { class: 'user-chip' });
const view = h('main', { id: 'view' });
const app = document.getElementById('app');
app.replaceChildren(
  h('header', { class: 'topbar' },
    h('a', { class: 'logo', href: '#/' }, h('span', {}, 'LAV'), h('b', {}, 'BOX')),
    h('div', { class: 'top-right' }, h('span', { class: 'live' }, dot, liveTxt), userChip)),
  view,
  h('footer', { class: 'demo-banner' },
    'Ambiente de demonstração acadêmica · use apenas dados fictícios · pagamento simulado',
    mode === 'local' ? h('b', {}, ' · MODO OFFLINE (local)') : null),
);

function setLive(ok) {
  dot.classList.toggle('on', !!ok);
  liveTxt.textContent = ok ? 'ao vivo' : 'sincronizando…';
}

let teardown = [];
let seq = 0;

function makeLive() {
  return (refresh) => {
    let t = null;
    const run = () => { clearTimeout(t); t = setTimeout(() => refresh().catch(console.error), 200); };
    setLive(false);
    const unsub = api.subscribe(run, setLive);
    // Polling de segurança: se o WebSocket for bloqueado ou um evento se perder, a tela se corrige sozinha.
    const poll = setInterval(run, 8000);
    teardown.push(unsub, () => clearInterval(poll), () => clearTimeout(t));
  };
}

async function render() {
  const mine = ++seq;
  teardown.forEach((f) => { try { f(); } catch { /* noop */ } });
  teardown = [];
  dot.classList.remove('on'); liveTxt.textContent = '';

  const path = (location.hash.slice(1) || '/').split('?')[0];
  const hit = routes.map(([re, fn, opts]) => [path.match(re), fn, opts]).find(([m]) => m);
  if (!hit) return go('/');
  const [m, fn, opts] = hit;

  let me = null;
  try { me = await api.me(); } catch (e) { console.error(e); }
  if (mine !== seq) return;

  if (!opts.public && (!me || (opts.role && me.role !== opts.role))) return go(me ? `/${me.role}` : '/');

  userChip.replaceChildren();
  if (me) {
    userChip.append(
      h('span', { class: 'who' }, me.nome.split(' ')[0], h('small', {}, ` · ${me.role}`)),
      h('button', { class: 'btn ghost sm', type: 'button', onclick: async () => { await api.signOut(); if ((location.hash || '#/') === '#/') render(); else go('/'); } }, 'Sair'));
  }

  view.replaceChildren();
  const ctx = { root: view, me, params: m.slice(1), live: makeLive(), api, onLeave: (fn) => teardown.push(fn) };
  try { await fn(ctx); } catch (e) {
    console.error(e);
    if (mine !== seq) return;
    view.replaceChildren(h('div', { class: 'card err-card' },
      h('h2', {}, 'Algo deu errado'), h('p', { class: 'muted' }, e.message || String(e)),
      h('button', { class: 'btn primary', type: 'button', onclick: render }, 'Tentar novamente')));
  }
}

window.addEventListener('hashchange', render);
render();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW', e));
}
if (slot) document.body.classList.add('embedded');
