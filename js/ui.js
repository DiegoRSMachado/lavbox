// Helpers de UI. Regra de segurança: dados NUNCA entram via innerHTML —
// tudo passa por textContent/setAttribute (anti-XSS armazenado).

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);  // CSP: sem style inline
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}
function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

// Como replaceChildren, mas aceita arrays aninhados e ignora null/false.
export function mount(el, ...children) {
  el.replaceChildren(...children.flat(Infinity).filter((c) => c != null && c !== false));
}

export const money = (n) =>
  Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
export const fmtDateTime = (iso) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export function toast(msg, kind = 'info') {
  const t = h('div', { class: `toast ${kind}`, role: 'status' }, msg);
  document.body.append(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3200);
}

export const go = (path) => { location.hash = '#' + path; };

// Erro de rede cru ("Failed to fetch") vira uma frase que a pessoa entende.
export function amigavel(e) {
  const m = String(e?.message || e || '');
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Sem conexão com o servidor. Verifique a internet e tente de novo.';
  return m || 'Erro inesperado. Tente de novo.';
}

// Botão com estado "ocupado" e tratamento de erro padronizado.
export function actionButton(label, fn, cls = 'btn primary') {
  const b = h('button', { class: cls, type: 'button' }, label);
  b.addEventListener('click', async () => {
    if (b.disabled) return;
    b.disabled = true;
    b.classList.add('busy');
    try { await fn(); } catch (e) { toast(amigavel(e), 'err'); }
    finally { b.disabled = false; b.classList.remove('busy'); }
  });
  return b;
}

export function stars(value, onPick) {
  return h('div', { class: 'stars', role: 'radiogroup', 'aria-label': 'Nota' },
    [1, 2, 3, 4, 5].map((n) =>
      h('button', {
        type: 'button', class: 'star' + (n <= value ? ' on' : ''),
        'aria-label': `${n} estrela${n > 1 ? 's' : ''}`,
        onclick: onPick ? () => onPick(n) : null, disabled: !onPick,
      }, '★')));
}

export function badge(text, cls = '') { return h('span', { class: `badge ${cls}` }, text); }

export function statusBadge(status) {
  const done = ['pago', 'avaliado'].includes(status);
  const cls = status === 'cancelado' ? 'red' : done ? 'green' : status === 'solicitado' ? 'amber' : 'cyan';
  return badge(status === 'cancelado' ? 'Cancelado' : status === 'solicitado' ? 'Aguardando' : done ? 'Concluído' : 'Em andamento', cls);
}
