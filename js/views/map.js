// Mapa (Leaflet + OpenStreetMap, sem chave de API) e geocodificação (Nominatim, gratuito).
// Limites declarados: sem trânsito; posição do lavador é SIMULADA na demo.
import { haversine, offsetPoint, lerpPoint, clamp01, hashAngle, etaMinutes } from '../lib/geo.js';

const hasLeaflet = () => typeof window.L !== 'undefined';
const ICON_PATH = 'vendor/leaflet/images/';

/** Cria o mapa dentro de `el`. Retorna { map, setPin } ou null se o Leaflet não carregou. */
export function initMap(el, { center, zoom = 15, pin = null, draggable = false, onMove = null }) {
  if (!hasLeaflet()) { el.textContent = 'Mapa indisponível (sem conexão).'; return null; }
  const L = window.L;
  L.Icon.Default.imagePath = ICON_PATH;
  const map = L.map(el, { zoomControl: true }).setView([center.lat, center.lng], zoom);
  map.attributionControl.setPrefix(false);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);

  let marker = null;
  const place = (p) => {
    if (!marker) {
      marker = L.marker([p.lat, p.lng], { draggable }).addTo(map);
      if (draggable) marker.on('dragend', () => onMove?.(marker.getLatLng()));
    } else marker.setLatLng([p.lat, p.lng]);
  };
  if (pin) place(pin);
  if (draggable) map.on('click', (e) => { place(e.latlng); onMove?.(e.latlng); });
  setTimeout(() => map.invalidateSize(), 60);
  return {
    map,
    setPin(p) { place(p); map.setView([p.lat, p.lng], Math.max(map.getZoom(), 16)); },
  };
}

/** Endereço -> {lat,lng,label} via Nominatim (só sob demanda do usuário; 1 requisição por clique). */
export async function geocode(query) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&accept-language=pt-BR&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) throw new Error('serviço de busca indisponível');
    const [hit] = await res.json();
    return hit ? { lat: Number(hit.lat), lng: Number(hit.lon), label: hit.display_name } : null;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('A busca demorou demais. Toque no mapa para marcar o local.');
    throw e;
  } finally { clearTimeout(timer); }
}

const DURACAO_DEMO_MS = 90_000;   // o deslocamento simulado dura 90 s
const DISTANCIA_INICIAL_KM = 3;   // o lavador "sai" a ~3 km do cliente

/**
 * Mostra destino + lavador (SIMULADO) movendo-se até o destino.
 * A posição é função só de (id do pedido, hora do evento "a_caminho"): cliente e lavador veem o mesmo ponto.
 * Retorna uma função stop() que para o relógio.
 */
export function startTracking(box, etaEl, { dest, orderId, status, tStart }) {
  const m = initMap(box, { center: dest, zoom: 14, pin: dest });
  if (!m) { etaEl.textContent = ''; return () => {}; }
  const L = window.L;
  const start = offsetPoint(dest, DISTANCIA_INICIAL_KM, hashAngle(orderId));
  const carro = L.marker([start.lat, start.lng], {
    icon: L.divIcon({ className: 'washer-pin', html: '🚗', iconSize: [28, 28], iconAnchor: [14, 14] }),
    keyboard: false,
  });
  let fitted = false;

  const tick = () => {
    const andando = status === 'a_caminho';
    const chegou = ['chegou', 'em_servico', 'finalizado', 'pago', 'avaliado'].includes(status);
    if (!andando && !chegou) {
      etaEl.textContent = 'O lavador ainda não saiu para o atendimento.';
      if (m.map.hasLayer(carro)) m.map.removeLayer(carro);
      return;
    }
    const t = chegou ? 1 : clamp01((Date.now() - tStart) / DURACAO_DEMO_MS);
    const pos = lerpPoint(start, dest, t);
    if (!m.map.hasLayer(carro)) carro.addTo(m.map);
    carro.setLatLng([pos.lat, pos.lng]);
    if (!fitted) { m.map.fitBounds([[start.lat, start.lng], [dest.lat, dest.lng]], { padding: [30, 30], maxZoom: 16 }); fitted = true; }
    const km = haversine(pos, dest);
    etaEl.textContent = t >= 1
      ? '✅ O lavador chegou ao local.'
      : `🚗 Faltam ${km.toFixed(1)} km · chegada em ~${etaMinutes(km)} min (posição simulada)`;
  };
  tick();
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
}
