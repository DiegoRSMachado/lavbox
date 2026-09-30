// Teste unitário (Node) da rota. Uso: node tools/test_route.mjs
import assert from 'node:assert/strict';
import { routeLength, nearestNeighbor, compareRoutes, bestOrderBruteForce } from '../js/lib/route.js';
import { haversine } from '../js/lib/geo.js';

const start = { lat: -15.794, lng: -47.882 };
// 0 e 1 pontos
assert.deepEqual(nearestNeighbor(start, []), []);
assert.equal(routeLength(start, []), 0);
const one = [{ lat: -15.83, lng: -47.9 }];
assert.deepEqual(nearestNeighbor(start, one), one);

// caso construído: ordem de aceite em "zigue-zague" (longe, perto, longe, perto)
const perto1 = { lat: -15.80, lng: -47.885 }, perto2 = { lat: -15.805, lng: -47.89 };
const longe1 = { lat: -15.90, lng: -48.05 }, longe2 = { lat: -15.92, lng: -48.06 };
const aceite = [longe1, perto1, longe2, perto2];
const c = compareRoutes(start, aceite);
assert.ok(c.depoisKm < c.antesKm, 'NN deve reduzir o zigue-zague');
assert.equal(c.ordem.length, 4);
assert.ok(c.economiaPct > 10, `economia esperada > 10%, veio ${c.economiaPct.toFixed(1)}%`);
assert.ok(Math.abs(c.economiaKm - (c.antesKm - c.depoisKm)) < 1e-9);

// determinismo e permutação (mesmos pontos, sem perda nem duplicata)
assert.deepEqual(nearestNeighbor(start, aceite), nearestNeighbor(start, aceite));
assert.equal(new Set(c.ordem.map((p) => `${p.lat},${p.lng}`)).size, 4);

// qualidade vs ótimo (força bruta) em 30 instâncias aleatórias reprodutíveis
let seed = 7; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
let pior = 1, soma = 0; const N = 30;
for (let t = 0; t < N; t++) {
  const pts = Array.from({ length: 7 }, () => ({ lat: -15.794 + (rnd() - 0.5) * 0.3, lng: -47.882 + (rnd() - 0.5) * 0.3 }));
  const nn = routeLength(start, nearestNeighbor(start, pts)), opt = bestOrderBruteForce(start, pts);
  assert.ok(nn >= opt - 1e-9, 'heurístico não pode ser melhor que o ótimo');
  const razao = nn / opt; soma += razao; pior = Math.max(pior, razao);
}
console.log(`vizinho mais próximo vs. ótimo (n=7, ${N} casos): média ${(soma / N).toFixed(3)}×, pior ${pior.toFixed(3)}×`);
assert.ok(soma / N < 1.25, 'média deve ficar a menos de 25% do ótimo');
console.log('route OK');
