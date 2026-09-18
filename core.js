/* Códigos — núcleo: estado, almacenamiento, UI compartida */
const VERSION = '1.1.0';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const fmtDate = ts => { const d = new Date(ts); return d.toLocaleDateString('es-CL', {day:'2-digit',month:'short',year:'numeric'}) + ' ' + d.toLocaleTimeString('es-CL', {hour:'2-digit',minute:'2-digit'}); };

// ---------- almacenamiento ----------
const LS = {
  get(k, d) { try { const v = localStorage.getItem('codigos_' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('codigos_' + k, JSON.stringify(v)); return true; } catch (e) { toast('No se pudo guardar (almacenamiento lleno)', 'bad'); return false; } },
  del(k) { try { localStorage.removeItem('codigos_' + k); } catch {} }
};
const DEFAULTS = {
  theme: 'auto', sound: true, haptic: true, keepScans: true, keepCreated: true, keepLog: false,
  privacyBlur: true, trashDays: 0, continuous: false, searchEngine: 'https://www.google.com/search?q=',
  productLookup: 'https://www.google.com/search?q=', pin: null, autoCopy: false
};
const S = {
  settings: Object.assign({}, DEFAULTS, LS.get('settings', {})),
  items: [],
  folders: LS.get('folders', []),
  log: [],
  draft: LS.get('draft', null)
};
const saveSettings = () => LS.set('settings', S.settings);
// Biblioteca y registro viven en IndexedDB (sin límite práctico); escritura diferida
let saveT;
const saveItems = () => { clearTimeout(saveT); saveT = setTimeout(() => IDB.set('items', S.items), 150); };
const saveFolders = () => LS.set('folders', S.folders);
const logAction = (a, detail) => { if (!S.settings.keepLog) return; S.log.unshift({ts: Date.now(), a, d: String(detail).slice(0, 200)}); S.log = S.log.slice(0, 500); IDB.set('log', S.log); };
async function loadStore() {
  let items = await IDB.get('items');
  if (items === undefined) { // migración desde localStorage (versión 1.0)
    items = LS.get('items', []); if (items.length) { await IDB.set('items', items); LS.del('items'); }
  }
  S.items = Array.isArray(items) ? items : [];
  S.log = (await IDB.get('log')) || LS.get('log', []);
}
window.addEventListener('pagehide', () => { if (saveT) { clearTimeout(saveT); IDB.set('items', S.items); } });

// ---------- toast / undo ----------
let toastT, undoFn = null;
function toast(msg, cls = '', undo) {
  const t = $('#toast'); clearTimeout(toastT);
  undoFn = undo || null;
  t.className = 'toast on ' + cls;
  t.innerHTML = esc(msg) + (undo ? '<span class="u" id="undoBtn">Deshacer</span>' : '');
  if (undo) $('#undoBtn').onclick = () => { undoFn && undoFn(); undoFn = null; t.classList.remove('on'); };
  toastT = setTimeout(() => t.classList.remove('on'), undo ? 5000 : 2200);
}
function haptic(kind = 'ok') { if (!S.settings.haptic || !navigator.vibrate) return; navigator.vibrate(kind === 'ok' ? 40 : [30, 40, 30]); }
let audioCtx;
function beep(ok = true) {
  if (!S.settings.sound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sine'; o.frequency.value = ok ? 1320 : 330; g.gain.value = 0.12;
    o.connect(g); g.connect(audioCtx.destination); o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.15); o.stop(audioCtx.currentTime + 0.16);
  } catch {}
}

// ---------- sheet / modal ----------
function openSheet(title, html, after) {
  $('#sheetTitle').textContent = title; $('#sheetBody').innerHTML = html;
  $('#sheetBg').classList.add('on'); $('#sheet').classList.add('on'); $('#sheetBody').scrollTop = 0;
  after && after($('#sheetBody'));
}
function closeSheet() { $('#sheetBg').classList.remove('on'); $('#sheet').classList.remove('on'); }
$('#sheetBg').onclick = closeSheet; $('#sheetClose').onclick = closeSheet;

function confirmDlg({title, text, dom, ok = 'Confirmar', danger = false, input = null}) {
  return new Promise(res => {
    const m = $('#modal');
    m.innerHTML = `<h3>${esc(title)}</h3><p>${text ? esc(text) : ''}${dom ? `<span class="dom">${esc(dom)}</span>` : ''}</p>
      ${input !== null ? `<input id="mInput" value="${esc(input.value || '')}" placeholder="${esc(input.placeholder || '')}" ${input.type ? `type="${input.type}"` : ''} style="margin-bottom:12px">` : ''}
      <div class="btns"><button class="btn" id="mNo">Cancelar</button><button class="btn ${danger ? 'd' : 'p'}" id="mOk">${esc(ok)}</button></div>`;
    $('#modalBg').classList.add('on');
    const done = v => { $('#modalBg').classList.remove('on'); res(v); };
    $('#mNo').onclick = () => done(null);
    $('#mOk').onclick = () => done(input !== null ? $('#mInput').value : true);
    if (input !== null) { setTimeout(() => $('#mInput').focus(), 50); $('#mInput').onkeydown = e => { if (e.key === 'Enter') $('#mOk').click(); }; }
  });
}
const ask = (title, text, ok, danger) => confirmDlg({title, text, ok, danger});
const prompt2 = (title, value, placeholder, ok = 'Aceptar') => confirmDlg({title, input: {value, placeholder}, ok});

// ---------- tabs / tema ----------
function showView(v) {
  $$('.view').forEach(x => x.classList.toggle('on', x.id === 'v-' + v));
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  window.scrollTo(0, 0);
  if (v !== 'scan' && window.Scanner && Scanner.active) Scanner.stop();
  if (v === 'lib') Lib.render();
  if (v === 'tools') Tools.render();
  if (v === 'batch') Batch.fillFolders();
  location.hash = v;
}
$('#tabs').addEventListener('click', e => { const b = e.target.closest('button'); b && showView(b.dataset.v); });

function applyTheme() {
  let t = S.settings.theme;
  if (t === 'auto') t = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  document.documentElement.dataset.theme = t;
  $('meta[name=theme-color]').content = t === 'light' ? '#f4f5f8' : '#0b0f17';
}
$('#btnTheme').onclick = () => { const cur = document.documentElement.dataset.theme; S.settings.theme = cur === 'dark' ? 'light' : 'dark'; saveSettings(); applyTheme(); };
matchMedia('(prefers-color-scheme: light)').addEventListener('change', applyTheme);

// ---------- segmentos genéricos ----------
function seg(id, fn) {
  const el = $(id);
  el.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $$('button', el).forEach(x => x.classList.toggle('on', x === b)); fn(b.dataset.k); });
}
function toggle(el, on) { el.classList.toggle('on', on); }
function bindTog(id, key, cb) { const el = $(id); toggle(el, !!S.settings[key]); el.onclick = () => { S.settings[key] = !S.settings[key]; toggle(el, S.settings[key]); saveSettings(); cb && cb(S.settings[key]); }; }

// ---------- archivos ----------
function download(name, blobOrUrl) {
  const a = document.createElement('a');
  const url = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl);
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  if (typeof blobOrUrl !== 'string') setTimeout(() => URL.revokeObjectURL(url), 4000);
}
async function shareFiles(files, text, title) {
  if (navigator.canShare && files && navigator.canShare({files})) { try { await navigator.share({files, text, title}); return true; } catch (e) { return e.name === 'AbortError'; } }
  if (navigator.share && text) { try { await navigator.share({text, title}); return true; } catch (e) { return e.name === 'AbortError'; } }
  return false;
}
async function copyText(t) { try { await navigator.clipboard.writeText(t); toast('Copiado', 'ok'); return true; } catch { toast('No se pudo copiar', 'bad'); return false; } }
const readFile = (f, as = 'text') => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; as === 'text' ? r.readAsText(f) : r.readAsDataURL(f); });
const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

// ---------- cifrado de respaldos (AES-GCM / PBKDF2) ----------
async function deriveKey(pass, salt) {
  const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256'}, km, {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']);
}
const b64 = u8 => btoa(String.fromCharCode(...u8)); const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function encryptJSON(obj, pass) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pass, salt);
  const ct = await crypto.subtle.encrypt({name: 'AES-GCM', iv}, key, new TextEncoder().encode(JSON.stringify(obj)));
  return {enc: 'aes-gcm', salt: b64(salt), iv: b64(iv), data: b64(new Uint8Array(ct))};
}
async function decryptJSON(pkg, pass) {
  const key = await deriveKey(pass, unb64(pkg.salt));
  const pt = await crypto.subtle.decrypt({name: 'AES-GCM', iv: unb64(pkg.iv)}, key, unb64(pkg.data));
  return JSON.parse(new TextDecoder().decode(pt));
}
async function sha256(s) { const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return b64(new Uint8Array(h)); }

// ---------- bloqueo por PIN y privacidad ----------
const Lock = {
  buf: '',
  init() {
    const pad = $('#pad'); pad.innerHTML = '';
    '123456789⌫0✕'.split('').forEach(k => { const b = document.createElement('button'); b.textContent = k; b.onclick = () => Lock.key(k); pad.appendChild(b); });
    if (S.settings.pin) Lock.show();
  },
  show() { Lock.buf = ''; Lock.draw(); $('#lock').classList.add('on'); $('#lockMsg').textContent = 'Ingresa tu PIN'; },
  draw() { $$('#lock .dots i').forEach((d, i) => d.classList.toggle('f', i < Lock.buf.length)); },
  async key(k) {
    if (k === '⌫') Lock.buf = Lock.buf.slice(0, -1);
    else if (k === '✕') Lock.buf = '';
    else if (Lock.buf.length < 4) Lock.buf += k;
    Lock.draw();
    if (Lock.buf.length === 4) {
      if (await sha256(Lock.buf) === S.settings.pin) { $('#lock').classList.remove('on'); haptic(); }
      else { $('#lockMsg').textContent = 'PIN incorrecto'; haptic('bad'); Lock.buf = ''; setTimeout(Lock.draw, 250); }
    }
  }
};
document.addEventListener('visibilitychange', () => {
  if (!S.settings.privacyBlur) return;
  $('#privacy').classList.toggle('on', document.hidden);
  if (!document.hidden && S.settings.pin && Lock.lastHide && Date.now() - Lock.lastHide > 60000) Lock.show();
  if (document.hidden) Lock.lastHide = Date.now();
});

// ---------- ajustes ----------
function openSettings() {
  const sw = (id, t, s) => `<div class="sw"><div><div class="t">${t}</div>${s ? `<div class="s">${s}</div>` : ''}</div><button class="tog" id="${id}"></button></div>`;
  openSheet('Ajustes', `
    <div class="card"><h2>Apariencia</h2>
      <label class="f">Tema</label><select id="setTheme"><option value="auto">Automático (sistema)</option><option value="dark">Oscuro</option><option value="light">Claro</option></select></div>
    <div class="card"><h2>Escáner</h2>
      ${sw('setSound', 'Sonido al detectar')}${sw('setHaptic', 'Vibración al detectar')}${sw('setCont', 'Lectura continua por defecto', 'No cierra el escáner tras leer')}${sw('setAutoCopy', 'Copiar automáticamente al leer', 'Solo el contenido, nunca se ejecuta')}</div>
    <div class="card"><h2>Historial</h2>
      ${sw('setKeepScans', 'Guardar códigos leídos', 'Si está desactivado, las lecturas solo viven en la sesión')}${sw('setKeepCreated', 'Guardar códigos creados')}${sw('setKeepLog', 'Registro de acciones', 'Anota qué acciones ejecutas (abrir enlace, llamar…)')}
      <label class="f">Vaciar papelera automáticamente</label><select id="setTrash"><option value="0">Nunca</option><option value="7">A los 7 días</option><option value="30">A los 30 días</option><option value="90">A los 90 días</option></select>
      <div class="btns" style="margin-top:10px"><button class="btn sm" id="setViewLog">Ver registro</button><button class="btn sm d" id="setClearLog">Borrar registro</button></div></div>
    <div class="card"><h2>Privacidad y seguridad</h2>
      ${sw('setBlur', 'Ocultar contenido en apps recientes')}
      <div class="sw"><div><div class="t">PIN de bloqueo</div><div class="s">Face ID no está disponible en apps web; el PIN protege la biblioteca al abrir la app</div></div><button class="btn sm" id="setPin">${S.settings.pin ? 'Cambiar / quitar' : 'Activar'}</button></div>
      <label class="f">Servicio de búsqueda</label><select id="setSearch"><option value="https://www.google.com/search?q=">Google</option><option value="https://duckduckgo.com/?q=">DuckDuckGo</option><option value="https://www.bing.com/search?q=">Bing</option><option value="https://www.ecosia.org/search?q=">Ecosia</option></select>
      <label class="f">Búsqueda de productos (código de barras)</label><select id="setProduct"><option value="https://www.google.com/search?q=">Google</option><option value="https://world.openfoodfacts.org/product/">Open Food Facts</option><option value="https://www.barcodelookup.com/">Barcode Lookup</option><option value="https://duckduckgo.com/?q=">DuckDuckGo</option></select>
      <p class="note" style="margin:10px 0 0">Funciones que requieren internet: abrir enlaces, buscar identificadores y mapas. Todo lo demás funciona sin conexión.</p></div>
    <div class="card"><h2>Datos</h2>
      <div class="btns"><button class="btn sm d" id="setWipe">Borrar todos los datos</button></div>
      <p class="note" style="margin:8px 0 0">Códigos v${VERSION} · ${S.items.length} elementos · uso personal, sin publicidad ni rastreo.</p></div>
  `, () => {
    $('#setTheme').value = S.settings.theme; $('#setTheme').onchange = e => { S.settings.theme = e.target.value; saveSettings(); applyTheme(); };
    bindTog('#setSound', 'sound'); bindTog('#setHaptic', 'haptic'); bindTog('#setCont', 'continuous', v => Scanner.setCont(v)); bindTog('#setAutoCopy', 'autoCopy');
    bindTog('#setKeepScans', 'keepScans'); bindTog('#setKeepCreated', 'keepCreated'); bindTog('#setKeepLog', 'keepLog'); bindTog('#setBlur', 'privacyBlur');
    $('#setTrash').value = String(S.settings.trashDays); $('#setTrash').onchange = e => { S.settings.trashDays = +e.target.value; saveSettings(); };
    $('#setSearch').value = S.settings.searchEngine; $('#setSearch').onchange = e => { S.settings.searchEngine = e.target.value; saveSettings(); };
    $('#setProduct').value = S.settings.productLookup; $('#setProduct').onchange = e => { S.settings.productLookup = e.target.value; saveSettings(); };
    $('#setViewLog').onclick = () => openSheet('Registro de acciones', S.log.length ? `<div class="list">${S.log.map(l => `<div class="item"><div class="b"><div class="n">${esc(l.a)}</div><div class="c">${esc(l.d)}</div><div class="m"><span class="dt">${fmtDate(l.ts)}</span></div></div></div>`).join('')}</div>` : '<div class="empty">Sin registros. Actívalo en Ajustes → Historial.</div>');
    $('#setClearLog').onclick = async () => { if (await ask('Borrar registro', 'Se eliminará el registro de acciones.', 'Borrar', true)) { S.log = []; IDB.del('log'); toast('Registro borrado'); } };
    $('#setPin').onclick = async () => {
      if (S.settings.pin) {
        const cur = await confirmDlg({title: 'PIN actual', input: {placeholder: '4 dígitos', type: 'password'}, ok: 'Continuar'});
        if (cur === null) return; if (await sha256(cur) !== S.settings.pin) return toast('PIN incorrecto', 'bad');
        const n = await confirmDlg({title: 'Nuevo PIN', text: 'Déjalo vacío para quitar el bloqueo.', input: {placeholder: '4 dígitos', type: 'password'}, ok: 'Guardar'});
        if (n === null) return;
        if (!n) { S.settings.pin = null; saveSettings(); return toast('Bloqueo desactivado'); }
        if (!/^\d{4}$/.test(n)) return toast('El PIN debe tener 4 dígitos', 'bad');
        S.settings.pin = await sha256(n); saveSettings(); toast('PIN actualizado', 'ok');
      } else {
        const n = await confirmDlg({title: 'Nuevo PIN', text: 'Se pedirá al abrir la app y al volver tras un minuto en segundo plano. No hay recuperación: si lo olvidas deberás borrar los datos.', input: {placeholder: '4 dígitos', type: 'password'}, ok: 'Activar'});
        if (n === null) return; if (!/^\d{4}$/.test(n)) return toast('El PIN debe tener 4 dígitos', 'bad');
        S.settings.pin = await sha256(n); saveSettings(); toast('Bloqueo activado', 'ok'); closeSheet();
      }
    };
    $('#setWipe').onclick = async () => {
      if (!await ask('Borrar todos los datos', 'Se eliminarán biblioteca, carpetas, registro y ajustes. Esta acción no se puede deshacer. ¿Creaste un respaldo?', 'Borrar todo', true)) return;
      Object.keys(localStorage).filter(k => k.startsWith('codigos_')).forEach(k => localStorage.removeItem(k)); location.reload();
    };
  });
}
$('#btnSettings').onclick = openSettings;

// ---------- arranque ----------
function purgeTrash() {
  const d = S.settings.trashDays; if (!d) return;
  const lim = Date.now() - d * 864e5; const n = S.items.length;
  S.items = S.items.filter(i => !i.deleted || i.deleted > lim);
  if (S.items.length !== n) saveItems();
}
window.addEventListener('DOMContentLoaded', async () => {
  applyTheme(); Lock.init();
  await loadStore(); purgeTrash();
  $('#verTag').textContent = 'v' + VERSION;
  const h = location.hash.replace('#', '');
  if (['scan', 'create', 'lib', 'batch', 'tools'].includes(h)) showView(h);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  // Share target / atajos: ?view=create&data=...
  const p = new URLSearchParams(location.search);
  if (p.get('view')) showView(p.get('view'));
  if (p.get('data')) { showView('create'); Creator.loadText(p.get('data')); }
});
