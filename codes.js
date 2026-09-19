/* Códigos — formatos, validación, interpretación, generación y decodificación */

// ---------- catálogo de formatos ----------
const FORMATS = {
  QR:        {name: 'QR Code', kind: '2d', help: 'Matriz bidimensional. Hasta ~4.000 caracteres alfanuméricos; admite texto, URL, Wi-Fi, contactos y más.'},
  MICRO_QR:  {name: 'Micro QR', kind: '2d', help: 'Variante compacta del QR. Lectura según soporte del dispositivo.'},
  DATA_MATRIX:{name: 'Data Matrix', kind: '2d', help: 'Matriz 2D muy densa, común en insumos médicos, electrónica y documentos.'},
  PDF_417:   {name: 'PDF417', kind: '2d', help: 'Código apilado usado en licencias, pasajes de embarque y documentos oficiales.'},
  AZTEC:     {name: 'Aztec', kind: '2d', help: 'Matriz 2D con patrón central; frecuente en boletos y transporte.'},
  EAN_13:    {name: 'EAN-13', kind: '1d', gen: 'EAN13', help: '13 dígitos (12 + dígito verificador). Estándar de productos de consumo.', digits: [12, 13], cd: 'ean'},
  EAN_8:     {name: 'EAN-8', kind: '1d', gen: 'EAN8', help: '8 dígitos (7 + verificador). Para envases pequeños.', digits: [7, 8], cd: 'ean'},
  UPC_A:     {name: 'UPC-A', kind: '1d', gen: 'UPC', help: '12 dígitos (11 + verificador). Estándar en Norteamérica.', digits: [11, 12], cd: 'ean'},
  UPC_E:     {name: 'UPC-E', kind: '1d', gen: 'UPCE', help: 'Versión comprimida de UPC-A: 6 dígitos de datos (o 8 con sistema y verificador).', digits: [6, 7, 8], cd: 'upce'},
  CODE_128:  {name: 'Code 128', kind: '1d', gen: 'CODE128', help: 'Alfanumérico completo (ASCII), alta densidad. Logística, etiquetas internas, pulseras.', re: /^[\x00-\x7F]+$/},
  CODE_39:   {name: 'Code 39', kind: '1d', gen: 'CODE39', help: 'Mayúsculas, dígitos y - . $ / + % espacio. Muy extendido en identificación interna.', re: /^[0-9A-Z\-\.\ \$\/\+\%]+$/, upper: true},
  CODE_93:   {name: 'Code 93', kind: '1d', help: 'Sucesor compacto de Code 39. Solo lectura en esta app.', re: /^[0-9A-Z\-\.\ \$\/\+\%]+$/},
  ITF:       {name: 'ITF (Interleaved 2 of 5)', kind: '1d', gen: 'ITF', help: 'Solo dígitos, cantidad par. Cajas y embalajes.', re: /^\d+$/, even: true},
  ITF_14:    {name: 'ITF-14', kind: '1d', gen: 'ITF14', help: '14 dígitos (13 + verificador). Unidades logísticas.', digits: [13, 14], cd: 'ean'},
  CODABAR:   {name: 'Codabar', kind: '1d', gen: 'codabar', help: 'Dígitos y - $ : / . +, con letras A–D como inicio/fin. Bancos de sangre, bibliotecas.', re: /^[A-Da-d]?[0-9\-\$\:\/\.\+]+[A-Da-d]?$/},
  MSI:       {name: 'MSI', kind: '1d', gen: 'MSI', help: 'Solo dígitos. Inventario de estanterías.', re: /^\d+$/},
  PHARMACODE:{name: 'Pharmacode', kind: '1d', gen: 'pharmacode', help: 'Número entre 3 y 131070. Envases farmacéuticos.', re: /^\d+$/, range: [3, 131070]}
};
const GEN_BAR = ['EAN_13', 'EAN_8', 'UPC_A', 'UPC_E', 'CODE_128', 'CODE_39', 'ITF', 'ITF_14', 'CODABAR', 'MSI', 'PHARMACODE'];
const ZX2APP = {QR_CODE: 'QR', DATA_MATRIX: 'DATA_MATRIX', PDF_417: 'PDF_417', AZTEC: 'AZTEC', EAN_13: 'EAN_13', EAN_8: 'EAN_8', UPC_A: 'UPC_A', UPC_E: 'UPC_E', CODE_128: 'CODE_128', CODE_39: 'CODE_39', CODE_93: 'CODE_93', ITF: 'ITF', CODABAR: 'CODABAR', RSS_14: 'GS1_DATABAR', RSS_EXPANDED: 'GS1_DATABAR', MAXICODE: 'MAXICODE'};
const BD2APP = {qr_code: 'QR', data_matrix: 'DATA_MATRIX', pdf417: 'PDF_417', aztec: 'AZTEC', ean_13: 'EAN_13', ean_8: 'EAN_8', upc_a: 'UPC_A', upc_e: 'UPC_E', code_128: 'CODE_128', code_39: 'CODE_39', code_93: 'CODE_93', itf: 'ITF', codabar: 'CODABAR'};
const fmtName = f => (FORMATS[f] || {name: f}).name;
const is2d = f => (FORMATS[f] || {}).kind !== '1d';

// ---------- dígitos verificadores ----------
function eanCheck(digits) { // digits sin verificador; pesos 3/1 desde la derecha
  let s = 0; for (let i = 0; i < digits.length; i++) s += (+digits[digits.length - 1 - i]) * (i % 2 === 0 ? 3 : 1);
  return (10 - s % 10) % 10;
}
function upceToA(e) {
  if (e.length === 6) e = '0' + e;
  const ns = e[0], d = e.slice(1, 7), last = d[5];
  let a;
  if ('012'.includes(last)) a = ns + d.slice(0, 2) + last + '0000' + d.slice(2, 5);
  else if (last === '3') a = ns + d.slice(0, 3) + '00000' + d.slice(3, 5);
  else if (last === '4') a = ns + d.slice(0, 4) + '00000' + d[4];
  else a = ns + d.slice(0, 5) + '0000' + last;
  return a + eanCheck(a);
}
// Devuelve {ok, msg, value(normalizado), cd}
function validateBar(fmt, v) {
  const F = FORMATS[fmt]; if (!F) return {ok: false, msg: 'Formato desconocido'};
  v = String(v || '').trim(); if (F.upper) v = v.toUpperCase();
  if (!v) return {ok: false, msg: 'Ingresa el contenido'};
  if (F.digits) {
    if (!/^\d+$/.test(v)) return {ok: false, msg: 'Solo se admiten dígitos (0–9).'};
    if (!F.digits.includes(v.length)) return {ok: false, msg: `Longitud inválida: ${v.length} dígitos. Se esperan ${F.digits.join(' o ')}.`};
    if (F.cd === 'ean') {
      const max = F.digits[F.digits.length - 1];
      if (v.length === max) { const c = eanCheck(v.slice(0, -1)); if (c !== +v[v.length - 1]) return {ok: false, msg: `Dígito verificador incorrecto: termina en ${v[v.length - 1]} pero debería ser ${c}.`, fix: v.slice(0, -1) + c}; return {ok: true, value: v, cd: c, msg: 'Dígito verificador correcto.'}; }
      const c = eanCheck(v); return {ok: true, value: v + c, cd: c, msg: `Dígito verificador calculado: ${c} → ${v + c}`};
    }
    if (F.cd === 'upce') {
      if (v.length === 8) { const a = upceToA(v.slice(0, 7)); if (a[11] !== v[7]) return {ok: false, msg: `Dígito verificador incorrecto; debería ser ${a[11]}.`, fix: v.slice(0, 7) + a[11]}; return {ok: true, value: v, cd: +v[7], msg: 'Dígito verificador correcto. Equivale a UPC-A ' + a}; }
      const a = upceToA(v); return {ok: true, value: v.length === 6 ? v : v, cd: +a[11], msg: 'Equivale a UPC-A ' + a};
    }
  }
  if (F.re && !F.re.test(v)) return {ok: false, msg: fmt === 'CODE_39' ? 'Caracteres no admitidos. Usa mayúsculas, dígitos, espacio y - . $ / + %.' : fmt === 'CODABAR' ? 'Usa dígitos y - $ : / . +; opcionalmente letras A–D al inicio y al final.' : fmt === 'CODE_128' ? 'Solo caracteres ASCII (sin acentos ni emojis).' : 'Solo se admiten dígitos.'};
  if (F.even && v.length % 2) return {ok: false, msg: 'ITF requiere una cantidad par de dígitos. Añade un 0 al inicio.', fix: '0' + v};
  if (F.range) { const n = +v; if (n < F.range[0] || n > F.range[1]) return {ok: false, msg: `Debe estar entre ${F.range[0]} y ${F.range[1]}.`}; }
  if (v.length > 80) return {ok: false, msg: 'Contenido demasiado largo para un código de barras legible (máx. 80).'};
  return {ok: true, value: v, msg: 'Contenido válido.'};
}
// Comprobación de dígito verificador de un contenido leído (solo formatos con CD)
function checkDigitInfo(fmt, v) {
  const F = FORMATS[fmt]; if (!F || !F.cd) return null;
  const r = validateBar(fmt, v); return r;
}

// ---------- interpretación de contenido ----------
const SHORTENERS = /^(bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly|is\.gd|buff\.ly|cutt\.ly|rb\.gy|shorturl\.at|tiny\.cc|lnkd\.in|s\.id|rebrand\.ly|qrco\.de|qr\.ae)$/i;
function parseContent(raw, fmt) {
  const t = String(raw || '').trim(); const p = {type: 'text', raw: t, fields: {}, actions: []};
  const low = t.toLowerCase();
  const kv = (s, sep = ';') => { const o = {}; s.split(sep).forEach(x => { const i = x.indexOf(':'); if (i > 0) o[x.slice(0, i).trim().toUpperCase()] = x.slice(i + 1).trim(); }); return o; };
  try {
    if (/^https?:\/\//i.test(t) || /^www\.[^\s]+\.[a-z]{2,}/i.test(t)) {
      const u = new URL(/^https?:/i.test(t) ? t : 'https://' + t);
      p.type = 'url'; p.fields = {url: u.href, host: u.hostname, scheme: u.protocol.replace(':', '')};
      p.warn = [];
      if (SHORTENERS.test(u.hostname)) p.warn.push('Enlace acortado: el destino real no es visible.');
      if (u.protocol === 'http:') p.warn.push('Conexión no cifrada (http).');
      if (/^\d{1,3}(\.\d{1,3}){3}$/.test(u.hostname)) p.warn.push('Apunta a una dirección IP, no a un dominio.');
      if (u.username || u.password) p.warn.push('Contiene credenciales en la URL.');
      if (/[^\x00-\x7F]/.test(u.hostname) || u.hostname.startsWith('xn--')) p.warn.push('Dominio con caracteres internacionales (posible homógrafo).');
      if (/\.(exe|apk|zip|dmg|pkg|bat|scr|js)(\?|$)/i.test(u.pathname)) p.warn.push('Enlaza a un archivo ejecutable o comprimido.');
    } else if (low.startsWith('wifi:')) {
      const o = kv(t.slice(5)); p.type = 'wifi'; p.fields = {ssid: (o.S || '').replace(/\\([;,:"\\])/g, '$1'), pass: (o.P || '').replace(/\\([;,:"\\])/g, '$1'), sec: o.T || 'nopass', hidden: o.H === 'true'};
    } else if (/^begin:vcard/i.test(t)) {
      p.type = 'vcard'; const o = {};
      t.split(/\r?\n/).forEach(l => { const m = l.match(/^([A-Z]+)(;[^:]*)?:(.*)$/i); if (m) { const k = m[1].toUpperCase(); if (!o[k]) o[k] = m[3]; } });
      p.fields = {name: o.FN || (o.N || '').split(';').reverse().join(' ').trim(), org: o.ORG || '', title: o.TITLE || '', tel: o.TEL || '', email: o.EMAIL || '', url: o.URL || '', adr: (o.ADR || '').replace(/;+/g, ', ').replace(/^, |, $/g, ''), note: o.NOTE || ''};
    } else if (/^mecard:/i.test(t)) {
      const o = kv(t.slice(7)); p.type = 'vcard'; p.fields = {name: (o.N || '').replace(',', ' '), tel: o.TEL || '', email: o.EMAIL || '', url: o.URL || '', adr: o.ADR || '', note: o.NOTE || '', org: o.ORG || ''};
    } else if (/^begin:vevent/im.test(t)) {
      p.type = 'event'; const o = {}; t.split(/\r?\n/).forEach(l => { const m = l.match(/^([A-Z]+)(;[^:]*)?:(.*)$/i); if (m) o[m[1].toUpperCase()] = m[3]; });
      p.fields = {summary: o.SUMMARY || '', start: o.DTSTART || '', end: o.DTEND || '', location: o.LOCATION || '', desc: o.DESCRIPTION || ''};
    } else if (/^tel:/i.test(t)) { p.type = 'tel'; p.fields = {tel: t.slice(4)}; }
    else if (/^(mailto:|matmsg:)/i.test(t)) {
      p.type = 'email';
      if (low.startsWith('matmsg:')) { const o = kv(t.slice(7)); p.fields = {to: o.TO || '', subject: o.SUB || '', body: o.BODY || ''}; }
      else { const u = new URL(t); p.fields = {to: u.pathname, subject: u.searchParams.get('subject') || '', body: u.searchParams.get('body') || ''}; }
    } else if (/^(sms|smsto|mms):/i.test(t)) {
      const rest = t.replace(/^(sms|smsto|mms):/i, ''); const i = rest.search(/[:?]/);
      p.type = 'sms'; p.fields = {to: i < 0 ? rest : rest.slice(0, i), body: i < 0 ? '' : decodeURIComponent(rest.slice(i + 1).replace(/^body=/, ''))};
    } else if (/^geo:/i.test(t)) {
      const m = t.slice(4).match(/^(-?[\d.]+),(-?[\d.]+)/); p.type = 'geo'; p.fields = {lat: m ? m[1] : '', lon: m ? m[2] : '', q: (t.match(/[?&]q=([^&]+)/) || [])[1] || ''};
    } else if (/^https?:\/\/(maps\.google|www\.google\.[a-z.]+\/maps|maps\.apple)/i.test(t)) { p.type = 'url'; p.fields = {url: t, host: new URL(t).hostname}; p.map = true; }
    else if (/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(t)) { p.type = 'email'; p.fields = {to: t, subject: '', body: ''}; }
    else if ((fmt && !is2d(fmt)) || /^\d{8}$|^\d{12,14}$/.test(t)) { p.type = 'product'; p.fields = {id: t}; }
    else if (/^\+?[\d\s\-().]{7,20}$/.test(t) && fmt && is2d(fmt)) { p.type = 'tel'; p.fields = {tel: t.replace(/[^\d+]/g, '')}; }
    else if (/^[a-z][a-z0-9+.-]{1,20}:\/\//i.test(t)) { p.type = 'app'; p.fields = {scheme: t.split(':')[0], url: t}; }
  } catch { p.type = 'text'; }
  return p;
}
const TYPE_LABEL = {text: 'Texto', url: 'Enlace web', wifi: 'Red Wi-Fi', vcard: 'Contacto', event: 'Evento', tel: 'Teléfono', email: 'Correo', sms: 'SMS', geo: 'Ubicación', app: 'Enlace a app', product: 'Identificador'};

// ---------- generación QR ----------
function qrMatrix(text, ecl = 'M') {
  qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
  const q = qrcode(0, ecl); q.addData(text, 'Byte'); q.make(); return q;
}
// opts: {fg,bg,trans,size,margin,shape,ecl,logo(img),title,caption}
function renderQR(text, o, target = 'canvas') {
  const q = qrMatrix(text, o.ecl || 'M'); const n = q.getModuleCount(), m = o.margin ?? 3;
  const total = n + m * 2; const size = o.size || 512; const cell = size / total;
  const fg = o.fg || '#111', bg = o.trans ? null : (o.bg || '#fff');
  const shape = o.shape || 'square';
  const logoRatio = o.logo ? 0.24 : 0; const lc = Math.round(n * logoRatio), l0 = Math.floor((n - lc) / 2), l1 = l0 + lc;
  const isLogo = (r, c) => o.logo && r >= l0 && r < l1 && c >= l0 && c < l1;
  if (target === 'svg') {
    let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (!q.isDark(r, c) || isLogo(r, c)) continue;
      const x = (c + m) * cell, y = (r + m) * cell;
      if (shape === 'dot') d += `<circle cx="${(x + cell / 2).toFixed(2)}" cy="${(y + cell / 2).toFixed(2)}" r="${(cell * 0.42).toFixed(2)}"/>`;
      else if (shape === 'round') d += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}" rx="${(cell * 0.3).toFixed(2)}"/>`;
      else d += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${(cell + 0.05).toFixed(2)}" height="${(cell + 0.05).toFixed(2)}"/>`;
    }
    let logo = '';
    if (o.logo) { const ls = lc * cell, lx = (l0 + m) * cell; logo = `<image href="${o.logo.src}" x="${lx}" y="${lx}" width="${ls}" height="${ls}" preserveAspectRatio="xMidYMid meet"/>`; }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">${bg ? `<rect width="100%" height="100%" fill="${bg}"/>` : ''}<g fill="${fg}">${d}</g>${logo}</svg>`;
  }
  const cv = document.createElement('canvas'); cv.width = cv.height = size; const ctx = cv.getContext('2d');
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, size, size); }
  ctx.fillStyle = fg;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (!q.isDark(r, c) || isLogo(r, c)) continue;
    const x = (c + m) * cell, y = (r + m) * cell;
    if (shape === 'dot') { ctx.beginPath(); ctx.arc(x + cell / 2, y + cell / 2, cell * 0.42, 0, Math.PI * 2); ctx.fill(); }
    else if (shape === 'round') { ctx.beginPath(); ctx.roundRect(x, y, cell, cell, cell * 0.3); ctx.fill(); }
    else ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(cell), Math.ceil(cell));
  }
  if (o.logo) { const ls = lc * cell, lx = (l0 + m) * cell; if (bg) { ctx.fillStyle = bg; ctx.fillRect(lx, lx, ls, ls); } ctx.drawImage(o.logo, lx + ls * 0.06, lx + ls * 0.06, ls * 0.88, ls * 0.88); }
  cv.dataset.modules = n; cv.dataset.version = q.typeNumber;
  return cv;
}

// ---------- generación barras ----------
function renderBar(fmt, value, o = {}, target = 'svg') {
  const F = FORMATS[fmt]; const el = target === 'svg' ? document.createElementNS('http://www.w3.org/2000/svg', 'svg') : document.createElement('canvas');
  JsBarcode(el, value, {format: F.gen, width: o.width || 2, height: o.height || 100, margin: o.margin ?? 10, displayValue: o.text !== false, lineColor: o.fg || '#111', background: o.trans ? 'transparent' : (o.bg || '#fff'), font: '-apple-system, Helvetica, Arial, sans-serif', fontSize: o.fontSize || 16, textMargin: 4, flat: fmt === 'ITF_14' ? false : undefined, valid: v => { o._valid = v; }});
  if (o.rotate === 90) { if (target === 'svg') { el.style.transform = 'rotate(90deg)'; el.dataset.rot = 90; } else { const c2 = document.createElement('canvas'); c2.width = el.height; c2.height = el.width; const x = c2.getContext('2d'); x.translate(c2.width, 0); x.rotate(Math.PI / 2); x.drawImage(el, 0, 0); return c2; } }
  return el;
}

// ---------- composición final (título + código + texto) para exportar ----------
function composeCanvas(codeEl, o = {}) { // codeEl: canvas o svg → canvas con título/caption
  return new Promise(async res => {
    let img = codeEl;
    if (codeEl.tagName === 'svg') { const s = new XMLSerializer().serializeToString(codeEl); img = await loadImg('data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(s)))); }
    const w = img.width, h = img.height; const pad = Math.round(w * 0.04); const fs = Math.max(14, Math.round(w * 0.045));
    const th = o.title ? fs * 1.6 : 0, ch = o.caption ? fs * 1.4 : 0;
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h + th + ch + (th || ch ? pad : 0); const x = cv.getContext('2d');
    if (!o.trans) { x.fillStyle = o.bg || '#fff'; x.fillRect(0, 0, cv.width, cv.height); }
    x.fillStyle = o.fg || '#111'; x.textAlign = 'center'; x.textBaseline = 'middle';
    if (o.title) { x.font = `700 ${fs}px -apple-system, Helvetica, Arial, sans-serif`; x.fillText(o.title, w / 2, th / 2 + pad / 2, w - pad * 2); }
    x.drawImage(img, 0, th + (th ? pad / 2 : 0));
    if (o.caption) { x.font = `${Math.round(fs * 0.8)}px Menlo, monospace`; x.fillText(o.caption.length > 60 ? o.caption.slice(0, 57) + '…' : o.caption, w / 2, cv.height - ch / 2 - pad / 4, w - pad * 2); }
    res(cv);
  });
}
const canvasBlob = (cv, type = 'image/png') => new Promise(r => cv.toBlob(r, type));

// ---------- decodificación ----------
const Decoder = {
  native: 'BarcodeDetector' in window ? null : false, worker: null, pending: new Map(), seq: 0,
  async init() {
    if (this.native === null) { try { const f = await BarcodeDetector.getSupportedFormats(); this.native = f.length ? new BarcodeDetector({formats: f}) : false; } catch { this.native = false; } }
    if (this.worker === null || this.worker === undefined) {
      try {
        this.worker = new Worker('worker.js');
        this.worker.onmessage = e => { const p = this.pending.get(e.data.id); if (p) { this.pending.delete(e.data.id); p(e.data.res); } };
        this.worker.onerror = () => { this.worker = false; this.pending.forEach(p => p(null)); this.pending.clear(); };
      } catch { this.worker = false; }
    }
  },
  // Decodifica un ImageData (en worker si existe; si no, en el hilo principal)
  decodeData(imgData, opts) {
    if (this.worker) return new Promise(res => { const id = ++this.seq; this.pending.set(id, res); const buf = imgData.data.buffer; this.worker.postMessage({id, buf, w: imgData.width, h: imgData.height, opts}, [buf]); });
    return Promise.resolve(ZXCore.decodeImageData(imgData.data, imgData.width, imgData.height, opts));
  },
  fmtOf(zx) { return ZX2APP[zx] || zx; },
  // decodifica una imagen (HTMLImageElement/canvas) y devuelve [{format,text}] con multi-detección
  async decodeImage(img) {
    await this.init(); const out = [], seen = new Set(); const push = (f, t) => { const k = f + '|' + t; if (!seen.has(k)) { seen.add(k); out.push({format: f, text: t}); } };
    if (this.native) { try { (await this.native.detect(img)).forEach(b => push(BD2APP[b.format] || b.format.toUpperCase(), b.rawValue)); } catch {} }
    if (out.length) return out;
    const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
    const cv = document.createElement('canvas'), ctx = cv.getContext('2d', {willReadFrequently: true});
    const tryCrop = async (x, y, w, h, scale = 1) => {
      cv.width = Math.max(1, Math.round(w * scale)); cv.height = Math.max(1, Math.round(h * scale));
      ctx.drawImage(img, x, y, w, h, 0, 0, cv.width, cv.height);
      const r = await this.decodeData(ctx.getImageData(0, 0, cv.width, cv.height), {invert: true, rotate: true});
      if (r) push(this.fmtOf(r.format), r.text);
    };
    const scale = Math.min(1, 1600 / Math.max(W, H));
    await tryCrop(0, 0, W, H, scale);
    if (!out.length || W > 900) { // varios códigos: recorrer cuadrantes y tercios
      for (const g of [2, 3]) for (let i = 0; i < g; i++) for (let j = 0; j < g; j++) await tryCrop(j * W / g, i * H / g, W / g, H / g, Math.min(2, 1200 / (W / g)));
      for (let i = 0; i < 3; i++) await tryCrop(0, i * H / 3, W, H / 3, Math.min(1.5, 1600 / W)); // franjas para barras
    }
    return out;
  }
};

// ---------- generación 2D adicional (Data Matrix, PDF417, Aztec) vía bwip-js, carga diferida ----------
const BWIP = {DATA_MATRIX: 'datamatrix', PDF_417: 'pdf417', AZTEC: 'azteccode'};
let bwipLoading = null;
function loadBwip() {
  if (window.bwipjs) return Promise.resolve();
  if (!bwipLoading) bwipLoading = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'vendor/bwip.min.js'; s.onload = res; s.onerror = () => { bwipLoading = null; rej(new Error('No se pudo cargar el generador 2D')); }; document.head.appendChild(s); });
  return bwipLoading;
}
// Devuelve canvas (o string SVG) del símbolo 2D; o: {fg,bg,trans,size,margin}
async function render2D(fmt, text, o = {}, target = 'canvas') {
  await loadBwip();
  const opts = {bcid: BWIP[fmt], text, scale: 1, padding: (o.margin ?? 3) * 2, barcolor: (o.fg || '#111111').replace('#', ''), includetext: false};
  if (!o.trans) opts.backgroundcolor = (o.bg || '#ffffff').replace('#', '');
  if (fmt === 'PDF_417') opts.columns = Math.min(10, Math.max(2, Math.ceil(text.length / 30)));
  if (target === 'svg') { const svg = bwipjs.toSVG(opts); return svg.replace(/<svg([^>]*)>/, (m, a) => `<svg${a.replace(/ (width|height)="[^"]*"/g, '')} width="${o.size || 512}" height="${o.size || 512}">`); }
  const tmp = document.createElement('canvas'); bwipjs.toCanvas(tmp, opts);
  const size = o.size || 512; const cv = document.createElement('canvas'); const ratio = tmp.width / tmp.height;
  cv.width = size; cv.height = Math.round(size / ratio); const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
  if (!o.trans) { ctx.fillStyle = o.bg || '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); }
  ctx.drawImage(tmp, 0, 0, cv.width, cv.height); cv.dataset.modules = tmp.width; return cv;
}

// ---------- consulta de producto por código de barras (Open *Facts, CORS abierto, sin clave) ----------
const PRODUCT_DBS = [['Open Food Facts', 'https://world.openfoodfacts.org'], ['Open Beauty Facts', 'https://world.openbeautyfacts.org'], ['Open Products Facts', 'https://world.openproductsfacts.org'], ['Open Pet Food Facts', 'https://world.openpetfoodfacts.org']];
async function lookupProduct(code) {
  const fields = 'product_name,product_name_es,brands,quantity,categories,image_small_url,generic_name,generic_name_es';
  for (const [name, base] of PRODUCT_DBS) {
    try {
      const r = await fetch(`${base}/api/v2/product/${encodeURIComponent(code)}.json?fields=${fields}`, {headers: {'User-Agent': 'CodigosPWA/1.1 (uso personal)'}});
      if (!r.ok) continue; const j = await r.json(); if (j.status !== 1 || !j.product) continue;
      const pr = j.product; const n = pr.product_name_es || pr.product_name || pr.generic_name_es || pr.generic_name || '';
      if (!n && !pr.brands) continue;
      return {source: name, name: n, brand: pr.brands || '', qty: pr.quantity || '', cat: (pr.categories || '').split(',').slice(-1)[0].trim(), img: pr.image_small_url || ''};
    } catch {}
  }
  return null;
}
