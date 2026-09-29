import { api, slot } from '../api.js';
import { mount, h, go, actionButton, toast } from '../ui.js';
import { DEMO, DEMO_LOGIN, SEED_SERVICES } from '../config.js';

const field = (label, input) => h('label', { class: 'field' }, h('span', {}, label), input);

async function enter(email, password) {
  await api.signIn(email, password);
  const me = await api.me();
  if (!me) { await api.signOut(); throw new Error('Conta sem perfil. Refaça o cadastro.'); }
  go(`/${me.role}`);
}

export async function landing({ root, me }) {
  if (me) return go(`/${me.role}`);
  mount(root, 
    h('section', { class: 'hero' },
      h('div', { class: 'logo big' }, h('span', {}, 'LAV'), h('b', {}, 'BOX')),
      h('p', { class: 'tag' }, 'Premium Car Care'),
      h('p', { class: 'lead' }, 'Lavagem automotiva onde o seu carro estiver. Escolha o serviço, acompanhe ao vivo.'),
      h('div', { class: 'stack' },
        h('a', { class: 'btn primary', href: '#/entrar' }, 'Entrar'),
        h('a', { class: 'btn ghost', href: '#/cadastro?role=cliente' }, 'Criar conta de cliente'),
        h('a', { class: 'btn ghost', href: '#/cadastro?role=lavador' }, 'Sou lavador — quero atender')),
      DEMO_LOGIN ? h('div', { class: 'card demo-card' },
        h('h3', {}, 'Modo demonstração'),
        h('p', { class: 'muted' }, 'Contas fictícias já cadastradas para a apresentação.'),
        h('div', { class: 'row' },
          actionButton('Entrar como Cliente', () => enter(DEMO.cliente.email, DEMO.cliente.password), 'btn primary sm'),
          actionButton('Entrar como Lavador', () => enter(DEMO.lavador.email, DEMO.lavador.password), 'btn primary sm')),
        slot ? null : h('a', { class: 'link', href: '#/palco' }, 'Abrir o Palco (cliente + lavador lado a lado) →')) : null));
}

export async function login({ root, me }) {
  if (me) return go(`/${me.role}`);
  const email = h('input', { type: 'email', autocomplete: 'username', required: true, placeholder: 'voce@email.com' });
  const pass = h('input', { type: 'password', autocomplete: 'current-password', required: true, placeholder: '••••••••' });
  const err = h('p', { class: 'form-err', role: 'alert' });
  const form = h('form', { class: 'card form', novalidate: true },
    h('h2', {}, 'Entrar'),
    field('E-mail', email), field('Senha', pass), err,
    h('button', { class: 'btn primary', type: 'submit' }, 'Entrar'),
    h('a', { class: 'link', href: '#/cadastro?role=cliente' }, 'Ainda não tenho conta'));
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); err.textContent = '';
    try { await enter(email.value.trim(), pass.value); } catch (x) { err.textContent = x.message; }
  });
  mount(root, form);
}

export async function signup({ root, me }) {
  if (me) return go(`/${me.role}`);
  const q = new URLSearchParams((location.hash.split('?')[1]) || '');
  let role = q.get('role') === 'lavador' ? 'lavador' : 'cliente';

  const nome = h('input', { required: true, maxlength: 80, autocomplete: 'name', placeholder: 'Nome completo' });
  const tel = h('input', { type: 'tel', maxlength: 20, autocomplete: 'tel', placeholder: '(61) 90000-0000' });
  const email = h('input', { type: 'email', required: true, autocomplete: 'email', placeholder: 'voce@email.com' });
  const pass = h('input', { type: 'password', required: true, minlength: 8, autocomplete: 'new-password', placeholder: 'mínimo 8 caracteres' });
  const bairro = h('input', { maxlength: 60, placeholder: 'Ex.: Asa Sul' });
  const bio = h('input', { maxlength: 200, placeholder: 'Ex.: 5 anos de experiência' });
  const svcChecks = SEED_SERVICES.map((s) => ({ s, cb: h('input', { type: 'checkbox', checked: true }) }));
  const err = h('p', { class: 'form-err', role: 'alert' });
  const washerBox = h('div', { class: 'washer-fields' },
    field('Bairro de atuação', bairro), field('Apresentação (opcional)', bio),
    h('div', { class: 'field' }, h('span', {}, 'Serviços que você oferece'),
      h('div', { class: 'checks' }, svcChecks.map(({ s, cb }) => h('label', { class: 'check' }, cb, s.nome)))));

  const tabs = h('div', { class: 'seg' });
  function paint() {
    tabs.replaceChildren(
      ...[['cliente', 'Sou cliente'], ['lavador', 'Sou lavador']].map(([r, l]) =>
        h('button', { type: 'button', class: role === r ? 'on' : '', onclick: () => { role = r; paint(); } }, l)));
    washerBox.hidden = role !== 'lavador';
    title.textContent = role === 'lavador' ? 'Cadastro de lavador' : 'Cadastro de cliente';
  }
  const title = h('h2');
  const form = h('form', { class: 'card form', novalidate: true },
    tabs, title,
    field('Nome', nome), field('Telefone', tel), field('E-mail', email), field('Senha', pass),
    washerBox, err,
    h('button', { class: 'btn primary', type: 'submit' }, 'Criar conta'),
    h('a', { class: 'link', href: '#/entrar' }, 'Já tenho conta'));
  paint();

  form.addEventListener('submit', async (e) => {
    e.preventDefault(); err.textContent = '';
    try {
      if (nome.value.trim().length < 2) throw new Error('Informe seu nome.');
      if (!/^\S+@\S+\.\S+$/.test(email.value)) throw new Error('E-mail inválido.');
      if (pass.value.length < 8) throw new Error('A senha precisa de pelo menos 8 caracteres.');
      const payload = { email: email.value.trim(), password: pass.value, role, nome: nome.value.trim(), telefone: tel.value.trim() };
      if (role === 'lavador') {
        if (bairro.value.trim().length < 2) throw new Error('Informe o bairro de atuação.');
        payload.washer = { bairro: bairro.value.trim(), bio: bio.value.trim() || null,
          servicos: svcChecks.filter(({ cb }) => cb.checked).map(({ s }) => s.id) };
        if (!payload.washer.servicos.length) throw new Error('Selecione ao menos um serviço.');
      }
      await api.signUp(payload);
      toast('Conta criada!', 'ok');
      go(`/${role}`);
    } catch (x) { err.textContent = x.message; }
  });
  mount(root, form);
}
