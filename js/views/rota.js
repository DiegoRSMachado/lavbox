// Roteiro do dia do prestador: compara a ordem de aceite com a ordem otimizada (vizinho mais próximo).
// Limites declarados: distância em linha reta (sem trânsito); economia de combustível é ESTIMATIVA.
import { mount, h, money, toast, actionButton } from '../ui.js';
import { COMBUSTIVEL, compareRoutes } from '../lib/route.js';
import { haversine, offsetPoint } from '../lib/geo.js';
import { drawRoute } from './map.js';

const BASE_PADRAO = { lat: -15.794, lng: -47.882 };   // centro de Brasília
// Paradas FICTÍCIAS em "zigue-zague" (ordem de aceite ruim de propósito) para demonstrar sem precisar de 5 pedidos reais.
const DEMO = [[6, 30, 'Lago Norte'], [1.5, 200, 'Asa Sul'], [7, 100, 'Águas Claras'], [2.5, 310, 'Asa Norte'], [5, 250, 'Taguatinga']];

export async function rota({ root, api }) {
  let start = BASE_PADRAO, origem = 'centro de Brasília (padrão)', demo = false;

  const reais = async () => (await api.myJobs())
    .filter((o) => o.status === 'confirmado' && o.lat != null)
    .map((o) => ({ lat: Number(o.lat), lng: Number(o.lng), label: `${o.service?.nome ?? ''} · ${o.bairro}` }));
  const fake = () => DEMO.map(([km, ang, bairro], i) => ({ ...offsetPoint(start, km, ang), label: `Cliente fictício ${i + 1} · ${bairro}` }));

  async function paint() {
    let stops;
    try { stops = demo ? fake() : await reais(); }
    catch (e) { toast(e.message || 'Não foi possível carregar seus pedidos.', 'err'); stops = []; }
    const mapBox = h('div', { class: 'map map-tall' });
    const cmp = stops.length >= 2 ? compareRoutes(start, stops) : null;

    mount(root,
      h('a', { class: 'link back', href: '#/lavador' }, '← Painel'),
      h('h1', {}, 'Roteiro do dia'),
      h('p', { class: 'muted' }, `Partida: ${origem}. Paradas: ${demo ? 'simuladas' : 'seus pedidos confirmados'}.`),
      h('div', { class: 'row' },
        h('button', { class: 'btn ghost sm', type: 'button', onclick: () => {
          if (!navigator.geolocation) return toast('Geolocalização indisponível.', 'err');
          navigator.geolocation.getCurrentPosition(
            (p) => { start = { lat: p.coords.latitude, lng: p.coords.longitude }; origem = 'sua posição atual'; paint(); },
            () => toast('Não foi possível obter a posição. Usando o centro de Brasília.', 'err'), { timeout: 8000 });
        } }, '📍 Partir da minha posição'),
        h('button', { class: 'btn ' + (demo ? 'primary' : 'ghost') + ' sm', type: 'button', onclick: () => { demo = !demo; paint(); } },
          demo ? '✔ Simulação ligada (voltar aos pedidos)' : '🧪 Simular 5 paradas')),
      !cmp ? h('div', { class: 'card empty' }, h('p', {}, 'Você precisa de pelo menos 2 pedidos confirmados para otimizar.'),
        h('p', { class: 'muted small' }, 'Para demonstrar agora, toque em “Simular 5 paradas”.')) : [
        h('div', { class: 'tiles' },
          h('div', { class: 'stat big' }, h('b', {}, `${cmp.antesKm.toFixed(1)} km`), h('span', {}, 'ordem de aceite')),
          h('div', { class: 'stat big' }, h('b', {}, `${cmp.depoisKm.toFixed(1)} km`), h('span', {}, 'ordem otimizada')),
          h('div', { class: 'stat big eco-tile' }, h('b', {}, `−${cmp.economiaPct.toFixed(0)}%`), h('span', {}, `${cmp.economiaKm.toFixed(1)} km a menos`)),
          h('div', { class: 'stat big' }, h('b', {}, `${cmp.litros.toFixed(1)} L · ${money(cmp.reais)}`), h('span', {}, 'combustível economizado'), h('small', {}, 'estimativa')),
          h('div', { class: 'stat big' }, h('b', {}, `~${cmp.minutosDepois} min`), h('span', {}, 'deslocamento total'), h('small', {}, `a ${COMBUSTIVEL.kmh} km/h, sem trânsito`))),
        h('div', { class: 'card' }, h('div', { class: 'between' }, h('strong', {}, 'Mapa da rota'), h('span', { class: 'legend' }, h('i', { class: 'lg before' }), ' aceite ', h('i', { class: 'lg after' }), ' otimizada')), mapBox),
        h('div', { class: 'card' }, h('h3', {}, 'Ordem sugerida'),
          h('ol', { class: 'legs' }, cmp.ordem.map((p, i) => h('li', {}, h('span', { class: 'n' }, String(i + 1)), h('span', {}, p.label),
            h('span', { class: 'muted' }, `${haversine(i ? cmp.ordem[i - 1] : start, p).toFixed(1)} km`))))),
        h('p', { class: 'muted small center' }, `Vizinho mais próximo, distância em linha reta (sem trânsito). Combustível: ${COMBUSTIVEL.kmPorLitro} km/L e ${money(COMBUSTIVEL.reaisPorLitro)}/L como referência.`)]);
    if (cmp) setTimeout(() => drawRoute(mapBox, { start, antes: stops, depois: cmp.ordem }), 0);
  }
  await paint();
}
