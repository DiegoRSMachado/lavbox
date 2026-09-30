// Geometria pura (sem DOM): testável em Node. Base da rota otimizada (ADR-004).
const R = 6371; // raio médio da Terra (km)
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

/** Distância em linha reta (km) entre {lat,lng} e {lat,lng}. Sem trânsito. */
export function haversine(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Ponto a `km` de `p` na direção `bearing` (graus, 0 = norte). */
export function offsetPoint(p, km, bearing) {
  const d = km / R, br = rad(bearing), lat1 = rad(p.lat), lng1 = rad(p.lng);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(br));
  const lng2 = lng1 + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return { lat: deg(lat2), lng: deg(lng2) };
}

export const lerpPoint = (a, b, t) => ({ lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t });
export const clamp01 = (x) => Math.min(1, Math.max(0, x));

/** Ângulo estável (0–359) derivado de um texto: o mesmo pedido sempre "vem" da mesma direção. */
export function hashAngle(str) {
  let h = 0;
  for (const c of String(str)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 360;
}

/** Tempo estimado de chegada (min) a `kmh` km/h (padrão urbano 30 km/h), mínimo 1. */
export const etaMinutes = (km, kmh = 30) => Math.max(1, Math.ceil((km / kmh) * 60));
