/* Códigos — escáner y acciones tras la lectura */
const Scanner = {
  active: false, paused: false, stream: null, track: null, facing: 'environment', cont: S.settings.continuous, session: [], lastKey: '', lastTs: 0, loop: null,
  async start() {
    if (!location.protocol.startsWith('https') && location.hostname !== 'localhost') { $('#camMsg').textContent = 'La cámara solo funciona con HTTPS (GitHub Pages, Netlify) o desde un servidor local.'; return; }
    try {
      await Decoder.init();
      this.stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: {ideal: this.facing}, width: {ideal: 1920}, height: {ideal: 1080}}, audio: false});
    } catch (e) { $('#camMsg').textContent = e.name === 'NotAllowedError' ? 'Permiso de cámara denegado. Actívalo en Ajustes → Safari → Cámara.' : 'No se pudo acceder a la cámara: ' + e.message; return; }
    const v = $('#video'); v.srcObject = this.stream; await v.play().catch(() => {});
    this.track = this.stream.getVideoTracks()[0]; this.active = true; this.paused = false;
    $('#camOff').classList.add('hidden'); $('#camTop').classList.remove('hidden'); $('#camStatus').classList.remove('hidden'); $('#cam').classList.remove('paused');
    this.setupCaps(); toggle($('#btnCont'), this.cont); this.runLoop();
    $('#camStatus').textContent = 'Buscando código…';
  },
  setupCaps() {
    const caps = this.track.getCapabilities ? this.track.getCapabilities() : {};
    $('#btnTorch').classList.toggle('hidden', !caps.torch); toggle($('#btnTorch'), false);
    const z = $('#zoom');
    if (caps.zoom) { z.min = caps.zoom.min; z.max = caps.zoom.max; z.step = caps.zoom.step || 0.1; z.value = this.track.getSettings().zoom || caps.zoom.min; $('#camBottom').classList.remove('hidden'); $('#zoomV').textContent = (+z.value).toFixed(1) + '×'; }
    else $('#camBottom').classList.add('hidden');
  },
  runLoop() {
    const v = $('#video'); const cv = document.createElement('canvas'); const ctx = cv.getContext('2d', {willReadFrequently: true}); let busy = false, n = 0;
    const tick = async () => {
      if (!this.active) return;
      if (!this.paused && !busy && v.readyState >= 2) {
        busy = true;
        try {
          if (Decoder.native) { const r = await Decoder.native.detect(v); if (r.length) this.onHits(r.map(b => ({format: BD2APP[b.format] || b.format.toUpperCase(), text: b.rawValue}))); }
          else {
            // ZXing en Web Worker: región central (ancho completo, 70 % del alto) como ImageData, sin JPEG intermedio
            const W = v.videoWidth, H = v.videoHeight; const sh = H * 0.7, sy = (H - sh) / 2;
            const scale = Math.min(1, 960 / W); cv.width = Math.round(W * scale); cv.height = Math.round(sh * scale);
            ctx.drawImage(v, 0, sy, W, sh, 0, 0, cv.width, cv.height); n++;
            const r = await Decoder.decodeData(ctx.getImageData(0, 0, cv.width, cv.height), {invert: n % 3 === 0, rotate: n % 2 === 0});
            if (r) this.onHits([{format: Decoder.fmtOf(r.format), text: r.text}]);
          }
        } catch {}
        busy = false;
      }
      this.loop = setTimeout(tick, Decoder.native ? 120 : 60);
    };
    tick();
  },
  onHits(hits) {
    if (!hits.length || this.paused) return;
    if (hits.length > 1) { this.pauseScan(true); this.pickMultiple(hits); return; }
    const h = hits[0]; const key = h.format + '|' + h.text;
    if (key === this.lastKey && Date.now() - this.lastTs < 2500) return;
    this.lastKey = key; this.lastTs = Date.now();
    this.hit(h);
  },
  hit(h) {
    $('#cam').classList.add('hit'); $('#camStatus').textContent = fmtName(h.format) + ' detectado'; setTimeout(() => { $('#cam').classList.remove('hit'); if (this.active && !this.paused) $('#camStatus').textContent = 'Buscando código…'; }, 900);
    beep(true); haptic();
    const item = Lib.addScan(h.format, h.text); this.session.unshift(item); this.renderSession();
    if (S.settings.autoCopy) navigator.clipboard && navigator.clipboard.writeText(h.text).catch(() => {});
    if (!this.cont) { this.pauseScan(true); Result.open(item); }
  },
  pickMultiple(hits) {
    openSheet('Varios códigos detectados', `<p class="lead">Elige cuál usar. Se detectaron ${hits.length} códigos en el encuadre.</p><div class="list">${hits.map((h, i) => `<button class="act" data-i="${i}"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/></svg><div class="b"><div>${esc(h.text)}</div><div class="s">${fmtName(h.format)}</div></div></button>`).join('')}</div><button class="btn w" id="pickAll">Guardar todos</button>`, b => {
      $$('.act', b).forEach(a => a.onclick = () => { closeSheet(); this.hit(hits[+a.dataset.i]); });
      $('#pickAll', b).onclick = () => { closeSheet(); hits.forEach(h => { const it = Lib.addScan(h.format, h.text); this.session.unshift(it); }); this.renderSession(); toast(hits.length + ' códigos guardados', 'ok'); this.pauseScan(false); };
    });
    $('#sheetBg').onclick = () => { closeSheet(); this.pauseScan(false); $('#sheetBg').onclick = closeSheet; };
  },
  pauseScan(p) { this.paused = p; $('#cam').classList.toggle('paused', p); toggle($('#btnPause'), p); $('#camStatus').textContent = p ? 'En pausa' : 'Buscando código…'; },
  stop() {
    this.active = false; clearTimeout(this.loop);
    if (this.stream) this.stream.getTracks().forEach(t => t.stop()); this.stream = null; $('#video').srcObject = null;
    $('#camOff').classList.remove('hidden'); $('#camTop').classList.add('hidden'); $('#camStatus').classList.add('hidden'); $('#camBottom').classList.add('hidden');
  },
  setCont(v) { this.cont = v; toggle($('#btnCont'), v); },
  async torch() { if (!this.track) return; const on = !$('#btnTorch').classList.contains('on'); try { await this.track.applyConstraints({advanced: [{torch: on}]}); toggle($('#btnTorch'), on); } catch { toast('Linterna no disponible', 'bad'); } },
  async focusAt(x, y) {
    if (!this.track) return; const caps = this.track.getCapabilities ? this.track.getCapabilities() : {};
    const f = document.createElement('div'); f.className = 'focus'; f.style.left = x + 'px'; f.style.top = y + 'px'; $('#cam').appendChild(f); setTimeout(() => f.remove(), 700);
    try {
      const adv = {};
      if (caps.focusMode && caps.focusMode.includes('continuous')) adv.focusMode = 'continuous';
      if (caps.pointsOfInterest) { const r = $('#video').getBoundingClientRect(); adv.pointsOfInterest = [{x: x / r.width, y: y / r.height}]; }
      if (Object.keys(adv).length) await this.track.applyConstraints({advanced: [adv]});
    } catch {}
  },
  renderSession() {
    $('#scanCount').textContent = this.session.length;
    const l = $('#scanList'); if (!this.session.length) { l.innerHTML = '<div class="empty">Aún no hay lecturas. Activa la cámara o elige una imagen.</div>'; return; }
    l.innerHTML = this.session.slice(0, 30).map(i => Lib.itemHTML(i)).join('');
    $$('.item', l).forEach(el => el.onclick = () => Result.open(S.items.find(x => x.id === el.dataset.id) || this.session.find(x => x.id === el.dataset.id)));
  },
  async fromFiles(files) {
    if (!files.length) return; toast('Analizando ' + (files.length > 1 ? files.length + ' imágenes' : 'imagen') + '…');
    const all = [];
    for (const f of files) { try { const img = await loadImg(await readFile(f, 'url')); const r = await Decoder.decodeImage(img); r.forEach(h => all.push(h)); } catch {} }
    if (!all.length) { beep(false); haptic('bad'); return openSheet('Sin resultados', '<div class="msg warn">No se detectó ningún código en la imagen.<br><br>Sugerencias: usa una foto nítida y bien iluminada, sin reflejos; recorta la imagen para que el código ocupe más espacio; asegúrate de que el código esté completo y sin deformaciones.</div>'); }
    beep(true); haptic();
    if (all.length === 1) { const it = Lib.addScan(all[0].format, all[0].text); this.session.unshift(it); this.renderSession(); Result.open(it); }
    else { const items = all.map(h => Lib.addScan(h.format, h.text)); items.forEach(i => this.session.unshift(i)); this.renderSession(); toast(items.length + ' códigos detectados', 'ok'); showView('scan'); }
  },
  async fromClipboard() {
    try {
      if (navigator.clipboard.read) { const its = await navigator.clipboard.read(); for (const it of its) { const t = it.types.find(t => t.startsWith('image/')); if (t) { const b = await it.getType(t); return this.fromFiles([b]); } } }
      const t = await navigator.clipboard.readText(); if (t) { const it = Lib.addScan('MANUAL', t.trim()); this.session.unshift(it); this.renderSession(); Result.open(it); return; }
      toast('El portapapeles no contiene imagen ni texto', 'bad');
    } catch { toast('Sin acceso al portapapeles', 'bad'); }
  }
};
$('#btnStart').onclick = () => Scanner.start();
$('#btnStop').onclick = () => Scanner.stop();
$('#btnPause').onclick = () => Scanner.pauseScan(!Scanner.paused);
$('#btnTorch').onclick = () => Scanner.torch();
$('#btnCont').onclick = () => { Scanner.setCont(!Scanner.cont); toast(Scanner.cont ? 'Lectura continua activada' : 'Lectura individual'); };
$('#btnFlip').onclick = () => { Scanner.facing = Scanner.facing === 'environment' ? 'user' : 'environment'; Scanner.stop(); Scanner.start(); };
$('#zoom').oninput = e => { const z = +e.target.value; $('#zoomV').textContent = z.toFixed(1) + '×'; Scanner.track && Scanner.track.applyConstraints({advanced: [{zoom: z}]}).catch(() => {}); };
$('#video').addEventListener('click', e => { const r = e.currentTarget.getBoundingClientRect(); Scanner.focusAt(e.clientX - r.left, e.clientY - r.top); });
$('#btnPickImg').onclick = () => $('#fileImg').click();
$('#fileImg').onchange = e => { Scanner.fromFiles(Array.from(e.target.files)); e.target.value = ''; };
$('#btnPaste').onclick = () => Scanner.fromClipboard();
$('#btnManual').onclick = async () => { const t = await prompt2('Ingresar contenido manualmente', '', 'Texto, número o URL', 'Interpretar'); if (t) { const it = Lib.addScan('MANUAL', t.trim()); Scanner.session.unshift(it); Scanner.renderSession(); Result.open(it); } };

// ---------- resultado y acciones ----------
const Result = {
  open(item) {
    if (!item) return;
    const p = parseContent(item.data, item.format); const f = p.fields; const cd = checkDigitInfo(item.format, item.data);
    const A = (id, title, sub, icon) => `<button class="act" id="${id}">${icon}<div class="b"><div>${title}</div>${sub ? `<div class="s">${esc(sub)}</div>` : ''}</div></button>`;
    const I = {link: '<svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>', copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>', share: '<svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>', wifi: '<svg viewBox="0 0 24 24"><path d="M5 12.6a11 11 0 0 1 14 0M8.5 16a6 6 0 0 1 7 0M2 8.8a15 15 0 0 1 20 0"/><circle cx="12" cy="20" r="1"/></svg>', user: '<svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>', cal: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>', tel: '<svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.9 2z"/></svg>', mail: '<svg viewBox="0 0 24 24"><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M22 6l-10 7L2 6"/></svg>', sms: '<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>', map: '<svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>', search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>', qr: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h7v7h-7z"/></svg>', save: '<svg viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/></svg>', text: '<svg viewBox="0 0 24 24"><path d="M4 7V4h16v3M9 20h6M12 4v16"/></svg>'};
    let info = '';
    if (p.type === 'url') info = `<div class="kv"><b>Dominio</b><span class="mono">${esc(f.host)}</span><b>Protocolo</b><span>${esc(f.scheme)}</span></div>${(p.warn || []).map(w => `<div class="msg warn">⚠︎ ${esc(w)}</div>`).join('')}`;
    else if (p.type === 'wifi') info = `<div class="kv"><b>Red</b><span>${esc(f.ssid)}</span><b>Seguridad</b><span>${esc(f.sec)}</span><b>Contraseña</b><span class="mono">${f.pass ? '•'.repeat(Math.min(12, f.pass.length)) + ' <a href="#" id="showPass" style="color:var(--accent)">mostrar</a>' : '(sin contraseña)'}</span>${f.hidden ? '<b>Oculta</b><span>Sí</span>' : ''}</div>`;
    else if (p.type === 'vcard') info = `<div class="kv">${Object.entries({Nombre: f.name, Organización: f.org, Cargo: f.title, Teléfono: f.tel, Correo: f.email, Web: f.url, Dirección: f.adr, Nota: f.note}).filter(([, v]) => v).map(([k, v]) => `<b>${k}</b><span>${esc(v)}</span>`).join('')}</div>`;
    else if (p.type === 'event') info = `<div class="kv">${Object.entries({Evento: f.summary, Inicio: f.start, Fin: f.end, Lugar: f.location, Detalle: f.desc}).filter(([, v]) => v).map(([k, v]) => `<b>${k}</b><span>${esc(v)}</span>`).join('')}</div>`;
    else if (p.type === 'geo') info = `<div class="kv"><b>Latitud</b><span>${esc(f.lat)}</span><b>Longitud</b><span>${esc(f.lon)}</span></div>`;
    else if (p.type === 'product') info = `<div class="msg info">Este código representa un identificador numérico. El nombre del producto o documento no está en el código: solo puede obtenerse consultando una base de datos externa.</div>`;
    else if (p.type === 'app') info = `<div class="msg warn">Enlace a una app (esquema <b>${esc(f.scheme)}</b>). Solo se abrirá si confirmas y la app está instalada.</div>`;
    const cdHtml = cd ? `<div class="msg ${cd.ok ? 'ok' : 'bad'}">${cd.ok ? '✓ ' : '✗ '}${esc(cd.msg)}</div>` : '';
    const special = /[^\x20-\x7E\n\r\táéíóúñÁÉÍÓÚÑüÜ¿¡]/.test(item.data);
    const hex = special ? `<details class="help"><summary>Ver caracteres especiales (hex)</summary><div class="note mono">${esc(Array.from(new TextEncoder().encode(item.data)).map(b => b.toString(16).padStart(2, '0')).join(' '))}</div></details>` : '';
    const acts = [];
    if (p.type === 'url') { acts.push(A('aOpen', 'Abrir enlace', f.host, I.link)); if (p.map) acts.push(A('aMap', 'Abrir en Mapas', '', I.map)); }
    if (p.type === 'wifi') acts.push(A('aWifi', 'Conectar a la red', 'Copia la contraseña y abre Ajustes de Wi-Fi', I.wifi));
    if (p.type === 'vcard') acts.push(A('aVcard', 'Añadir contacto', 'Genera una tarjeta .vcf para Contactos', I.user));
    if (p.type === 'event') acts.push(A('aEvent', 'Añadir al calendario', 'Genera un archivo .ics', I.cal));
    if (p.type === 'tel') acts.push(A('aTel', 'Llamar', f.tel, I.tel));
    if (p.type === 'email') acts.push(A('aMail', 'Redactar correo', f.to, I.mail));
    if (p.type === 'sms') acts.push(A('aSms', 'Redactar SMS', f.to, I.sms));
    if (p.type === 'geo') acts.push(A('aGeo', 'Abrir en Mapas', `${f.lat}, ${f.lon}`, I.map));
    if (p.type === 'app') acts.push(A('aApp', 'Abrir en la app', f.scheme, I.link));
    if (p.type === 'product') acts.push(A('aLookup', 'Buscar producto en internet', 'Requiere conexión · servicio elegido en Ajustes', I.search));
    if (['text', 'product'].includes(p.type) || is2d(item.format)) acts.push(A('aSearch', 'Buscar en internet', 'Requiere conexión', I.search));
    acts.push(A('aCopy', 'Copiar contenido', 'Sin interpretarlo', I.copy), A('aShare', 'Compartir', '', I.share), A('aNew', 'Crear código a partir del contenido', '', I.qr));
    openSheet(TYPE_LABEL[p.type] || 'Resultado', `
      <div class="row" style="flex-wrap:wrap;gap:6px"><span class="badge ${is2d(item.format) ? 'qr' : 'bar'}">${esc(fmtName(item.format))}</span><span class="badge info">${TYPE_LABEL[p.type]}</span>${item.saved ? '<span class="badge ok">En biblioteca</span>' : ''}<span class="badge">${item.data.length} car.</span></div>
      <div class="pre mono" id="rawBox">${esc(item.data)}</div>
      ${cdHtml}${info}${hex}
      <div class="list">${acts.join('')}</div>
      <div class="card"><h2>Biblioteca</h2>
        <label class="f">Nombre</label><input id="rName" value="${esc(item.name || '')}" placeholder="Nombre descriptivo">
        <label class="f">Nota</label><textarea id="rNote" placeholder="Nota personal" style="min-height:60px">${esc(item.note || '')}</textarea>
        <label class="f">Etiquetas</label><input id="rTags" value="${esc((item.tags || []).join(', '))}" placeholder="separadas por coma">
        <label class="f">Carpeta</label><select id="rFolder"><option value="">Sin carpeta</option>${S.folders.map(x => `<option ${item.folder === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>
        <div class="btns" style="margin-top:10px"><button class="btn p" id="rSave">${item.saved ? 'Actualizar' : 'Guardar en biblioteca'}</button><button class="btn" id="rFav">${item.fav ? '★ Favorito' : '☆ Favorito'}</button></div>
      </div>`, b => {
      const go = async (title, text, dom, url, what) => { if (await confirmDlg({title, text, dom, ok: 'Abrir'})) { logAction(what, url); window.open(url, '_blank'); } };
      const q = s => encodeURIComponent(s);
      $('#showPass') && ($('#showPass').onclick = e => { e.preventDefault(); e.target.parentElement.innerHTML = esc(f.pass); });
      $('#aOpen') && ($('#aOpen').onclick = () => go('Abrir enlace', (p.warn || []).length ? 'Este enlace tiene advertencias. Revisa el dominio completo antes de continuar.' : 'Se abrirá en el navegador:', f.url, f.url, 'Abrir enlace'));
      $('#aMap') && ($('#aMap').onclick = () => go('Abrir en Mapas', '', f.url, f.url, 'Abrir mapa'));
      $('#aWifi') && ($('#aWifi').onclick = async () => { if (await ask('Conectar a Wi-Fi', `iOS no permite unirse a redes desde una app web. Se copiará la contraseña de "${f.ssid}" para que la pegues en Ajustes → Wi-Fi.`, 'Copiar contraseña')) { await copyText(f.pass); logAction('Wi-Fi', f.ssid); } });
      $('#aVcard') && ($('#aVcard').onclick = () => { const v = /^begin:vcard/i.test(item.data) ? item.data : Creator.buildVcard(f); download((f.name || 'contacto').replace(/\s+/g, '_') + '.vcf', new Blob([v], {type: 'text/vcard'})); logAction('Contacto', f.name); toast('Abre el archivo .vcf para añadirlo a Contactos'); });
      $('#aEvent') && ($('#aEvent').onclick = () => { const ics = /^begin:vcalendar/i.test(item.data) ? item.data : 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\n' + item.data + '\r\nEND:VCALENDAR'; download('evento.ics', new Blob([ics], {type: 'text/calendar'})); logAction('Evento', f.summary); toast('Abre el archivo .ics para añadirlo al Calendario'); });
      $('#aTel') && ($('#aTel').onclick = () => go('Llamar', 'Se abrirá el marcador con el número:', f.tel, 'tel:' + f.tel, 'Llamada'));
      $('#aMail') && ($('#aMail').onclick = () => go('Redactar correo', 'Se abrirá tu app de correo para:', f.to, `mailto:${f.to}?subject=${q(f.subject)}&body=${q(f.body)}`, 'Correo'));
      $('#aSms') && ($('#aSms').onclick = () => go('Redactar SMS', 'Se abrirá Mensajes para:', f.to, `sms:${f.to}${f.body ? '&body=' + q(f.body) : ''}`, 'SMS'));
      $('#aGeo') && ($('#aGeo').onclick = () => go('Abrir en Mapas', '', `${f.lat}, ${f.lon}`, `https://maps.apple.com/?ll=${f.lat},${f.lon}&q=${q(f.q || 'Ubicación')}`, 'Mapa'));
      $('#aApp') && ($('#aApp').onclick = () => go('Abrir en la app', 'Solo continúa si reconoces la aplicación de destino.', f.url, f.url, 'Abrir app'));
      $('#aLookup') && ($('#aLookup').onclick = () => go('Buscar producto', 'Se enviará el identificador a un servicio externo:', item.data, S.settings.productLookup + q(item.data), 'Buscar producto'));
      $('#aSearch') && ($('#aSearch').onclick = () => go('Buscar en internet', 'Se enviará el contenido al buscador elegido en Ajustes:', item.data.slice(0, 120), S.settings.searchEngine + q(item.data), 'Buscar'));
      $('#aCopy').onclick = () => copyText(item.data);
      $('#aShare').onclick = async () => { if (!await shareFiles(null, item.data, 'Código')) copyText(item.data); };
      $('#aNew').onclick = () => { closeSheet(); showView('create'); Creator.loadText(item.data, item.format); };
      const collect = () => { item.name = $('#rName').value.trim(); item.note = $('#rNote').value.trim(); item.tags = $('#rTags').value.split(',').map(x => x.trim()).filter(Boolean); item.folder = $('#rFolder').value; };
      $('#rSave').onclick = () => { collect(); Lib.persist(item, true); toast('Guardado en biblioteca', 'ok'); closeSheet(); };
      $('#rFav').onclick = () => { collect(); item.fav = !item.fav; Lib.persist(item, true); $('#rFav').textContent = item.fav ? '★ Favorito' : '☆ Favorito'; };
    });
  }
};
