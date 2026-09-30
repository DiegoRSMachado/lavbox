// Teste unitário (Node) da geometria pura. Uso: node tools/test_geo.mjs
import assert from 'node:assert/strict';
import { haversine, offsetPoint, lerpPoint, hashAngle, etaMinutes } from '../js/lib/geo.js';
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);
close(haversine({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }), 111.19, 0.05, '1° de longitude no equador');
close(haversine({ lat: -15.79, lng: -47.88 }, { lat: -15.79, lng: -47.88 }), 0, 1e-9, 'mesmo ponto');
const p = { lat: -15.794, lng: -47.882 };
for (const b of [0, 90, 180, 270, 123]) close(haversine(p, offsetPoint(p, 3, b)), 3, 0.01, `offset 3 km @${b}°`);
assert.deepEqual(lerpPoint({ lat: 0, lng: 0 }, { lat: 10, lng: 20 }, 0.5), { lat: 5, lng: 10 });
assert.equal(hashAngle('abc'), hashAngle('abc')); assert.ok(hashAngle('x') >= 0 && hashAngle('x') < 360);
assert.equal(etaMinutes(0.01), 1); assert.equal(etaMinutes(3), 6);
console.log('geo OK');
