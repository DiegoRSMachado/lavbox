// Rota do prestador (ADR-004): funções puras, sem DOM. Distância em linha reta (Haversine), SEM trânsito.
import { haversine } from './geo.js';

/** Consumo e preço usados só para ESTIMAR economia (valores de referência, editáveis). */
export const COMBUSTIVEL = { kmPorLitro: 10, reaisPorLitro: 6.0, kmh: 30 };

/** Comprimento (km) do caminho aberto start -> stops[0] -> stops[1] ... (na ordem dada). */
export function routeLength(start, stops) {
  let km = 0, cur = start;
  for (const s of stops) { km += haversine(cur, s); cur = s; }
  return km;
}

/** Vizinho mais próximo: a cada passo vai ao ponto não visitado mais perto. Determinístico (empate = menor índice). */
export function nearestNeighbor(start, stops) {
  const left = stops.map((s, i) => ({ s, i }));
  const order = [];
  let cur = start;
  while (left.length) {
    let best = 0;
    for (let k = 1; k < left.length; k++) {
      if (haversine(cur, left[k].s) < haversine(cur, left[best].s)) best = k;
    }
    const [pick] = left.splice(best, 1);
    order.push(pick.s);
    cur = pick.s;
  }
  return order;
}

/** Compara a ordem original (ordem de aceite) com a otimizada. */
export function compareRoutes(start, stops, { kmPorLitro, reaisPorLitro, kmh } = COMBUSTIVEL) {
  const antes = routeLength(start, stops);
  const ordem = nearestNeighbor(start, stops);
  const depois = routeLength(start, ordem);
  const economiaKm = Math.max(0, antes - depois);
  return {
    ordem, antesKm: antes, depoisKm: depois, economiaKm,
    economiaPct: antes > 0 ? (economiaKm / antes) * 100 : 0,
    litros: economiaKm / kmPorLitro, reais: (economiaKm / kmPorLitro) * reaisPorLitro,
    minutosDepois: Math.round((depois / kmh) * 60),
  };
}

/** Melhor ordem possível por força bruta (só para n <= 8): usado em teste para medir a qualidade do heurístico. */
export function bestOrderBruteForce(start, stops) {
  if (stops.length > 8) throw new Error('força bruta só até 8 pontos');
  let best = Infinity;
  const go = (cur, rest, acc) => {
    if (!rest.length) { best = Math.min(best, acc); return; }
    rest.forEach((s, i) => go(s, rest.filter((_, j) => j !== i), acc + haversine(cur, s)));
  };
  go(start, stops, 0);
  return best;
}
