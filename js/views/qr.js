// QR de início do serviço (ADR-003): gera (cliente) e lê (prestador). O QR só transporta o MESMO código de 6
// dígitos que o cliente também pode ditar: a segurança vem do limite de tentativas no servidor, não do QR.
import { h, toast } from '../ui.js';

const PREFIXO = 'LAVBOX';
export const qrPayload = (orderId, pin) => `${PREFIXO}|${orderId}|${pin}`;

/** Valida o texto lido; retorna o PIN ou lança erro amigável. */
export function parseQr(text, orderId) {
  const [p, id, pin] = String(text).split('|');
  if (p !== PREFIXO || !/^[0-9a-f-]{36}$/i.test(id || '') || !/^[0-9]{6}$/.test(pin || '')) throw new Error('Este QR não é do LAVBOX.');
  if (id !== orderId) throw new Error('Este QR é de outro pedido.');
  return pin;
}

/** Desenha o QR num <canvas> (sem innerHTML). */
export function qrCanvas(text, px = 176) {
  const canvas = h('canvas', { class: 'qr', width: px, height: px, role: 'img', 'aria-label': 'QR Code de início do serviço' });
  if (typeof window.qrcode !== 'function') return h('p', { class: 'muted small' }, 'QR indisponível.');
  const qr = window.qrcode(0, 'M'); qr.addData(text); qr.make();
  const n = qr.getModuleCount(), quiet = 2, cell = Math.floor(px / (n + quiet * 2));
  const size = cell * (n + quiet * 2);
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#000';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) ctx.fillRect((c + quiet) * cell, (r + quiet) * cell, cell, cell);
  return canvas;
}

/**
 * Abre a câmera e chama onCode(texto) na 1ª leitura válida. Retorna close().
 * Precisa de HTTPS + permissão; se falhar, o prestador digita o código (fallback obrigatório).
 */
export function openScanner(onCode) {
  let stream = null, raf = 0, stopped = false;
  const video = h('video', { class: 'scan-video', playsinline: true, muted: true, autoplay: true });
  const status = h('p', { class: 'muted small center' }, 'Aponte a câmera para o QR do cliente…');
  const overlay = h('div', { class: 'scan-overlay', role: 'dialog', 'aria-label': 'Leitor de QR Code' },
    h('div', { class: 'scan-box' }, h('h3', {}, 'Ler QR do cliente'), video, status,
      h('button', { class: 'btn ghost', type: 'button', onclick: () => close() }, 'Cancelar (digitar o código)')));
  document.body.append(overlay);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  let last = 0;

  function close() {
    stopped = true; cancelAnimationFrame(raf);
    stream?.getTracks().forEach((t) => t.stop());
    overlay.remove();
  }

  function tick(ts) {
    if (stopped) return;
    raf = requestAnimationFrame(tick);
    if (ts - last < 120 || video.readyState < 2 || !video.videoWidth) return;   // ~8 leituras/s
    last = ts;
    const w = Math.min(480, video.videoWidth), hh = Math.round((w / video.videoWidth) * video.videoHeight);
    canvas.width = w; canvas.height = hh;
    ctx.drawImage(video, 0, 0, w, hh);
    const img = ctx.getImageData(0, 0, w, hh);
    const res = window.jsQR?.(img.data, w, hh, { inversionAttempts: 'dontInvert' });
    if (res?.data) { close(); onCode(res.data); }
  }

  (async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('sem câmera');
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
      video.srcObject = stream;
      await video.play().catch(() => {});
      raf = requestAnimationFrame(tick);
    } catch {
      close();
      toast('Não foi possível abrir a câmera. Digite o código de 6 dígitos.', 'err');
    }
  })();
  return close;
}
