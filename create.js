/* Códigos — creación de QR y códigos de barras */
const QR_TYPES = {
  text:   {n: 'Texto', f: [['text', 'Texto', 'textarea']], build: v => v.text},
  url:    {n: 'Enlace', f: [['url', 'Dirección web', 'url', 'https://']], build: v => /^[a-z]+:/i.test(v.url) ? v.url : (v.url ? 'https://' + v.url : '')},
  wifi:   {n: 'Wi-Fi', f: [['ssid', 'Nombre de red (SSID)'], ['pass', 'Contraseña'], ['sec', 'Seguridad', 'select', ['WPA|WPA/WPA2/WPA3', 'WEP|WEP', 'nopass|Sin contraseña']], ['hidden', 'Red oculta', 'select', ['false|No', 'true|Sí']]], build: v => { const e = s => s.replace(/([\\;,:"])/g, '\\$1'); return `WIFI:T:${v.sec};S:${e(v.ssid)};${v.sec !== 'nopass' ? 'P:' + e(v.pass) + ';' : ''}${v.hidden === 'true' ? 'H:true;' : ''};`; }},
  vcard:  {n: 'Contacto', f: [['name', 'Nombre completo'], ['org', 'Organización'], ['title', 'Cargo'], ['tel', 'Teléfono', 'tel'], ['email', 'Correo', 'email'], ['url', 'Web', 'url'], ['adr', 'Dirección'], ['note', 'Nota']], build: v => Creator.buildVcard(v)},
  tel:    {n: 'Teléfono', f: [['tel', 'Número', 'tel', '+56 9 …']], build: v => 'tel:' + v.tel.replace(/[^\d+]/g, '')},
  email:  {n: 'Correo', f: [['to', 'Destinatario', 'email'], ['subject', 'Asunto'], ['body', 'Mensaje', 'textarea']], build: v => `mailto:${v.to}${v.subject || v.body ? '?' : ''}${v.subject ? 'subject=' + encodeURIComponent(v.subject) : ''}${v.subject && v.body ? '&' : ''}${v.body ? 'body=' + encodeURIComponent(v.body) : ''}`},
  sms:    {n: 'SMS', f: [['to', 'Número', 'tel'], ['body', 'Mensaje', 'textarea']], build: v => `SMSTO:${v.to.replace(/[^\d+]/g, '')}:${v.body}`},
  geo:    {n: 'Ubicación', f: [['lat', 'Latitud', 'text', '-23.65'], ['lon', 'Longitud', 'text', '-70.40'], ['q', 'Nombre del lugar']], build: v => `geo:${v.lat},${v.lon}${v.q ? '?q=' + encodeURIComponent(v.q) : ''}`},
  event:  {n: 'Evento', f: [['summary', 'Título'], ['start', 'Inicio (AAAA-MM-DD HH:MM)', 'text', '2026-09-18 14:00'], ['end', 'Fin (AAAA-MM-DD HH:MM)', 'text'], ['location', 'Lugar'], ['desc', 'Descripción', 'textarea']], build: v => { const d = s => { const m = s.match(/(\d{4})-(\d{2})-(\d{2})[ T]?(\d{2})?:?(\d{2})?/); return m ? `${m[1]}${m[2]}${m[3]}T${m[4] || '00'}${m[5] || '00'}00` : ''; }; return `BEGIN:VEVENT\nSUMMARY:${v.summary}\nDTSTART:${d(v.start)}\n${v.end ? 'DTEND:' + d(v.end) + '\n' : ''}${v.location ? 'LOCATION:' + v.location + '\n' : ''}${v.desc ? 'DESCRIPTION:' + v.desc.replace(/\n/g, '\\n') + '\n' : ''}END:VEVENT`; }},
  app:    {n: 'App', f: [['url', 'Enlace de app o esquema', 'text', 'whatsapp://send?text=…']], build: v => v.url},
  clinical:{n: 'Ficha', f: [['id', 'Identificador (RUT, ficha, folio)'], ['name', 'Nombre'], ['extra', 'Datos adicionales', 'textarea']], build: v => [v.id && 'ID: ' + v.id, v.name && 'Nombre: ' + v.name, v.extra].filter(Boolean).join('\n')},
  custom: {n: 'Personalizado', f: [['raw', 'Contenido exacto', 'textarea', 'Se codifica tal cual, sin transformar']], build: v => v.raw}
};

const Creator = {
  mode: 'qr', qrType: 'text', vals: {}, logo: null, editing: null, lastEl: null, lastText: '', t: null,
  init() {
    const ch = $('#qrTypes'); ch.innerHTML = Object.entries(QR_TYPES).map(([k, t]) => `<button class="chip ${k === 'text' ? 'on' : ''}" data-k="${k}">${t.n}</button>`).join('');
    ch.onclick = e => { const b = e.target.closest('.chip'); if (!b) return; $$('.chip', ch).forEach(x => x.classList.toggle('on', x === b)); this.setType(b.dataset.k); };
    $('#barFmt').innerHTML = GEN_BAR.map(f => `<option value="${f}">${FORMATS[f].name}</option>`).join('');
    seg('#segCreate', k => { this.mode = k; $('#cQR').classList.toggle('hidden', k !== 'qr'); $('#cBar').classList.toggle('hidden', k !== 'bar'); this.render(); });
    // inputs de diseño
    const link = (c, t) => { $(c).oninput = e => { $(t).value = e.target.value; this.render(); }; $(t).oninput = e => { if (/^#[0-9a-f]{6}$/i.test(e.target.value)) { $(c).value = e.target.value; this.render(); } }; };
    link('#qrFg', '#qrFgT'); link('#qrBg', '#qrBgT'); link('#barFg', '#barFgT'); link('#barBg', '#barBgT');
    ['#qrEcl', '#qrShape', '#qrTitle', '#barFmt', '#barVal', '#barRot', '#barTitle'].forEach(s => $(s).oninput = () => this.render());
    [['#qrSize', '#qrSizeV'], ['#qrMargin', '#qrMarginV'], ['#barW', '#barWV'], ['#barH', '#barHV'], ['#barM', '#barMV']].forEach(([a, b]) => $(a).oninput = e => { $(b).textContent = e.target.value; this.render(); });
    ['#qrTrans', '#qrCaption', '#barText'].forEach(s => $(s).onclick = e => { e.currentTarget.classList.toggle('on'); this.render(); });
    $('#qrLogoBtn').onclick = () => $('#qrLogo').click();
    $('#qrLogo').onchange = async e => { const f = e.target.files[0]; if (!f) return; this.logo = await loadImg(await readFile(f, 'url')); $('#qrLogoClr').classList.remove('hidden'); $('#qrLogoBtn').textContent = f.name; if ($('#qrEcl').value !== 'H') { $('#qrEcl').value = 'H'; toast('Corrección ajustada a H por el logo'); } this.render(); e.target.value = ''; };
    $('#qrLogoClr').onclick = () => { this.logo = null; $('#qrLogoClr').classList.add('hidden'); $('#qrLogoBtn').textContent = 'Elegir imagen…'; this.render(); };
    $('#barFmt').onchange = () => { $('#barFmtHelp').textContent = FORMATS[$('#barFmt').value].help; this.render(); };
    $('#barFmtHelp').textContent = FORMATS.EAN_13.help;
    $('#qrSym').onchange = () => { const f = $('#qrSym').value; $('#qrSymHelp').textContent = f === 'QR' ? '' : FORMATS[f].help + ' Forma de módulos y logo solo aplican a QR.'; const isQR = f === 'QR'; ['#qrShape', '#qrEcl', '#qrLogoBtn'].forEach(x => $(x).disabled = !isQR); this.render(); };
    $('#barCalc').onclick = () => { const r = validateBar($('#barFmt').value, $('#barVal').value); if (r.fix) { $('#barVal').value = r.fix; } else if (r.ok && r.value) $('#barVal').value = r.value; this.render(); toast(r.msg, r.ok || r.fix ? 'ok' : 'bad'); };
    $('#barFromClip').onclick = async () => { try { $('#barVal').value = (await navigator.clipboard.readText()).trim(); this.render(); } catch { toast('Sin acceso al portapapeles', 'bad'); } };
    $('#cSave').onclick = () => this.save(); $('#cVerify').onclick = () => this.verify();
    $('#cPng').onclick = () => this.export('png'); $('#cSvg').onclick = () => this.export('svg'); $('#cPdf').onclick = () => this.export('pdf'); $('#cCopy').onclick = () => this.export('copy'); $('#cShare').onclick = () => this.export('share');
    this.setType('text');
    if (S.draft && !location.search) this.restoreDraft();
  },
  setType(k) {
    this.qrType = k; const t = QR_TYPES[k];
    $('#qrForm').innerHTML = t.f.map(([id, label, type = 'text', extra]) => `<label class="f">${label}</label>` + (type === 'textarea' ? `<textarea data-f="${id}" placeholder="${esc(extra || '')}">${esc(this.vals[id] || '')}</textarea>` : type === 'select' ? `<select data-f="${id}">${extra.map(o => { const [v, l] = o.split('|'); return `<option value="${v}" ${this.vals[id] === v ? 'selected' : ''}>${l}</option>`; }).join('')}</select>` : `<input data-f="${id}" type="${type}" value="${esc(this.vals[id] || '')}" placeholder="${esc(extra || '')}" ${type === 'url' || type === 'email' ? 'autocapitalize="off" autocorrect="off"' : ''}>`)).join('');
    $$('[data-f]', $('#qrForm')).forEach(el => el.oninput = () => { this.vals[el.dataset.f] = el.value; this.render(); });
    this.render();
  },
  qrText() { return QR_TYPES[this.qrType].build(Object.fromEntries(QR_TYPES[this.qrType].f.map(([id]) => [id, (this.vals[id] || '').trim()]))); },
  sym() { return $('#qrSym').value; },
  qrOpts() { return {fg: $('#qrFg').value, bg: $('#qrBg').value, trans: $('#qrTrans').classList.contains('on'), size: +$('#qrSize').value, margin: +$('#qrMargin').value, shape: $('#qrShape').value, ecl: $('#qrEcl').value, logo: this.logo, title: $('#qrTitle').value.trim(), caption: $('#qrCaption').classList.contains('on')}; },
  barOpts() { return {width: +$('#barW').value, height: +$('#barH').value, margin: +$('#barM').value, rotate: +$('#barRot').value, fg: $('#barFg').value, bg: $('#barBg').value, text: $('#barText').classList.contains('on'), title: $('#barTitle').value.trim()}; },
  render() {
    clearTimeout(this.t); this.t = setTimeout(() => this._render(), 60);
  },
  async _render() {
    if (this.mode === 'qr') {
      const text = this.qrText(); const o = this.qrOpts(); const prev = $('#qrPrev'); prev.classList.remove('err');
      $('#qrCheck').innerHTML = '';
      if (!text) { prev.innerHTML = '<div class="empty">Completa el formulario para ver el código.</div>'; $('#qrInfo').textContent = ''; this.lastEl = null; return; }
      try {
        const sym = this.sym();
        const cv = sym === 'QR' ? renderQR(text, Object.assign({}, o, {size: 320})) : await render2D(sym, text, Object.assign({}, o, {size: 320}));
        prev.innerHTML = ''; if (o.title) { const t = document.createElement('div'); t.className = 'cap ttl'; t.textContent = o.title; prev.appendChild(t); }
        cv.style.width = '100%'; cv.style.maxWidth = '300px'; prev.appendChild(cv);
        if (o.caption) { const c = document.createElement('div'); c.className = 'cap txt'; c.textContent = text.length > 80 ? text.slice(0, 77) + '…' : text; prev.appendChild(c); }
        $('#qrInfo').textContent = (sym === 'QR' ? `v${cv.dataset.version} · ${cv.dataset.modules}×${cv.dataset.modules}` : fmtName(sym)) + ` · ${new TextEncoder().encode(text).length} bytes`;
        this.lastText = text; this.lastEl = cv;
        const warn = [];
        if (this.contrast(o.fg, o.trans ? '#ffffff' : o.bg) < 3) warn.push('Contraste bajo entre color y fondo: puede fallar la lectura.');
        if (sym !== 'QR' && o.logo) warn.push('El logo solo se aplica a códigos QR.');
        if (o.logo && sym === 'QR' && o.ecl !== 'H') warn.push('Con logo se recomienda corrección de errores H.');
        if (text.length > 1500) warn.push('Contenido muy largo: el código será denso y difícil de leer.');
        if (o.margin < 2) warn.push('Margen menor a 2 módulos: algunos lectores fallan sin zona silenciosa.');
        $('#qrCheck').innerHTML = warn.map(w => `<div class="msg warn" style="margin-bottom:6px">⚠︎ ${w}</div>`).join('');
      } catch (e) { prev.innerHTML = `<div class="msg bad">No se pudo generar: ${esc(e.message || 'contenido demasiado largo')}</div>`; prev.classList.add('err'); this.lastEl = null; }
      this.saveDraft();
    } else {
      const fmt = $('#barFmt').value, v = $('#barVal').value; const r = validateBar(fmt, v); const prev = $('#barPrev'); const o = this.barOpts();
      $('#barMsg').innerHTML = v ? `<div class="msg ${r.ok ? 'ok' : 'bad'}">${r.ok ? '✓ ' : '✗ '}${esc(r.msg)}${r.fix ? ` <a href="#" id="barFix" style="color:inherit;font-weight:800">Corregir → ${esc(r.fix)}</a>` : ''}</div>` : '';
      $('#barFix') && ($('#barFix').onclick = e => { e.preventDefault(); $('#barVal').value = r.fix; this.render(); });
      prev.classList.toggle('err', !!v && !r.ok);
      if (!r.ok) { prev.innerHTML = '<div class="empty">' + (v ? 'Corrige el contenido para ver el código.' : 'Ingresa el contenido.') + '</div>'; this.lastEl = null; $('#barInfo').textContent = ''; return; }
      try {
        const svg = renderBar(fmt, r.value, o, 'svg'); prev.innerHTML = '';
        if (o.title) { const t = document.createElement('div'); t.className = 'cap ttl'; t.textContent = o.title; prev.appendChild(t); }
        if (o.rotate === 90) { const w = document.createElement('div'); w.style.cssText = 'display:grid;place-items:center;width:100%'; svg.style.transform = 'rotate(90deg)'; w.appendChild(svg); prev.appendChild(w); w.style.height = svg.getAttribute('width') + 'px'; } else prev.appendChild(svg);
        $('#barInfo').textContent = `${FORMATS[fmt].name} · ${r.value}`; this.lastText = r.value; this.lastEl = svg;
      } catch (e) { prev.innerHTML = `<div class="msg bad">Error al generar: ${esc(e.message)}</div>`; this.lastEl = null; }
      this.saveDraft();
    }
  },
  contrast(a, b) { const L = h => { const c = [1, 3, 5].map(i => { let v = parseInt(h.slice(i, i + 2), 16) / 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; }; const [x, y] = [L(a), L(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); },
  // canvas final a resolución de exportación
  async finalCanvas() {
    if (this.mode === 'qr') { const o = this.qrOpts(); const cv = this.sym() === 'QR' ? renderQR(this.lastText, o) : await render2D(this.sym(), this.lastText, o); return composeCanvas(cv, {title: o.title, caption: o.caption ? this.lastText : '', trans: o.trans, bg: o.bg, fg: o.fg}); }
    const o = this.barOpts(); const cv = renderBar($('#barFmt').value, this.lastText, Object.assign({}, o, {width: o.width * 2, height: o.height * 2, margin: o.margin * 2, fontSize: 32}), 'canvas');
    return composeCanvas(cv, {title: o.title, bg: o.bg, fg: o.fg});
  },
  async svgString() {
    if (this.mode === 'qr') return this.sym() === 'QR' ? renderQR(this.lastText, this.qrOpts(), 'svg') : await render2D(this.sym(), this.lastText, this.qrOpts(), 'svg');
    const o = this.barOpts(); const svg = renderBar($('#barFmt').value, this.lastText, o, 'svg'); svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); return new XMLSerializer().serializeToString(svg);
  },
  fileName(ext) { const base = (this.mode === 'qr' ? ($('#qrTitle').value.trim() || (this.sym() === 'QR' ? QR_TYPES[this.qrType].n : fmtName(this.sym()))) : ($('#barTitle').value.trim() || $('#barFmt').value)).replace(/[^\w\-áéíóúñ ]/gi, '').trim().replace(/\s+/g, '_') || 'codigo'; return `${base}.${ext}`; },
  async export(kind) {
    if (!this.lastEl) return toast('Nada que exportar', 'bad');
    if (kind === 'svg') return download(this.fileName('svg'), new Blob([await this.svgString()], {type: 'image/svg+xml'}));
    if (kind === 'pdf') return Printer.open([{el: this.lastEl.cloneNode(true), title: this.mode === 'qr' ? $('#qrTitle').value : $('#barTitle').value, text: this.lastText, svg: this.mode === 'qr' ? await this.svgString() : null}]);
    const cv = await this.finalCanvas(); const blob = await canvasBlob(cv);
    if (kind === 'png') return download(this.fileName('png'), blob);
    if (kind === 'copy') { try { await navigator.clipboard.write([new ClipboardItem({'image/png': blob})]); toast('Imagen copiada', 'ok'); } catch { copyText(this.lastText); } return; }
    if (kind === 'share') { const f = new File([blob], this.fileName('png'), {type: 'image/png'}); if (!await shareFiles([f], undefined, 'Código')) download(this.fileName('png'), blob); }
  },
  async verify() {
    if (!this.lastEl) return;
    const cv = await this.finalCanvas(); const res = await Decoder.decodeImage(cv);
    const ok = res.find(r => r.text === this.lastText);
    const box = this.mode === 'qr' ? $('#qrCheck') : $('#barMsg');
    box.innerHTML = (ok ? `<div class="msg ok">✓ Legible: el código se decodifica correctamente como ${fmtName(ok.format)}.</div>` : res.length ? `<div class="msg bad">✗ Se leyó un contenido distinto (${esc(res[0].text.slice(0, 40))}). Revisa colores y logo.</div>` : `<div class="msg bad">✗ No se pudo leer el código generado. Aumenta el contraste, el margen o quita el logo.</div>`) + box.innerHTML;
    haptic(ok ? 'ok' : 'bad');
  },
  async save() {
    if (!this.lastEl) return toast('Completa el contenido primero', 'bad');
    const fmt = this.mode === 'qr' ? this.sym() : $('#barFmt').value;
    const style = this.mode === 'qr' ? Object.assign(this.qrOpts(), {logo: this.logo ? this.logo.src : null, type: this.qrType, vals: Object.assign({}, this.vals)}) : this.barOpts();
    const title = this.mode === 'qr' ? style.title : style.title;
    if (this.editing) {
      const it = this.editing; it.versions = it.versions || []; it.versions.unshift({ts: it.ts, data: it.data, format: it.format, style: it.style}); it.versions = it.versions.slice(0, 10);
      it.data = this.lastText; it.format = fmt; it.style = style; it.ts = Date.now(); if (title) it.name = title;
      Lib.persist(it, true); toast('Código actualizado (versión anterior conservada)', 'ok'); this.editing = null; $('#cEditNote').textContent = ''; this.clearDraft(); return;
    }
    const dup = S.items.find(i => !i.deleted && i.kind === 'create' && i.data === this.lastText && i.format === fmt);
    if (dup && !await ask('Posible duplicado', `Ya existe "${dup.name || dup.data.slice(0, 40)}" con el mismo contenido. ¿Guardar de todas formas?`, 'Guardar')) return;
    const it = Lib.make('create', fmt, this.lastText, {name: title || '', style});
    Lib.persist(it, true); toast('Guardado en biblioteca', 'ok'); this.clearDraft();
  },
  // cargar contenido leído o ítem existente para editar/duplicar
  loadText(text, fmt) {
    const p = parseContent(text, fmt);
    if (fmt && FORMATS[fmt] && !is2d(fmt) && GEN_BAR.includes(fmt)) { $$('#segCreate button')[1].click(); $('#barFmt').value = fmt; $('#barFmtHelp').textContent = FORMATS[fmt].help; $('#barVal').value = text; this.render(); return; }
    $$('#segCreate button')[0].click(); $('#qrSym').value = BWIP[fmt] ? fmt : 'QR'; $('#qrSym').dispatchEvent(new Event('change'));
    const map = {url: ['url', {url: p.fields.url}], wifi: ['wifi', p.fields], vcard: ['vcard', p.fields], tel: ['tel', p.fields], email: ['email', p.fields], sms: ['sms', p.fields], geo: ['geo', p.fields], event: ['event', p.fields]};
    if (map[p.type] && p.type !== 'event') { this.vals = Object.assign({}, map[p.type][1]); if (p.type === 'wifi') this.vals.hidden = String(!!p.fields.hidden); this.selectChip(map[p.type][0]); }
    else { this.vals = {raw: text}; this.selectChip('custom'); }
  },
  selectChip(k) { $$('#qrTypes .chip').forEach(x => x.classList.toggle('on', x.dataset.k === k)); this.setType(k); },
  loadItem(it, asEdit) {
    showView('create'); this.editing = asEdit ? it : null; this.logo = null;
    const st = it.style || {};
    if (is2d(it.format)) {
      $$('#segCreate button')[0].click(); $('#qrSym').value = BWIP[it.format] ? it.format : 'QR'; $('#qrSym').dispatchEvent(new Event('change'));
      $('#qrFg').value = $('#qrFgT').value = st.fg || '#111111'; $('#qrBg').value = $('#qrBgT').value = st.bg || '#ffffff'; toggle($('#qrTrans'), !!st.trans); $('#qrSize').value = st.size || 768; $('#qrSizeV').textContent = $('#qrSize').value; $('#qrMargin').value = st.margin ?? 3; $('#qrMarginV').textContent = $('#qrMargin').value; $('#qrShape').value = st.shape || 'square'; $('#qrEcl').value = st.ecl || 'M'; $('#qrTitle').value = st.title || it.name || ''; toggle($('#qrCaption'), !!st.caption);
      if (st.logo) loadImg(st.logo).then(i => { this.logo = i; $('#qrLogoClr').classList.remove('hidden'); $('#qrLogoBtn').textContent = 'Logo guardado'; this.render(); });
      if (st.type && QR_TYPES[st.type]) { this.vals = Object.assign({}, st.vals || {}); this.selectChip(st.type); } else this.loadText(it.data, 'QR');
    } else {
      $$('#segCreate button')[1].click(); $('#barFmt').value = it.format; $('#barFmtHelp').textContent = FORMATS[it.format].help; $('#barVal').value = it.data;
      $('#barW').value = st.width || 2; $('#barH').value = st.height || 100; $('#barM').value = st.margin ?? 10; $('#barRot').value = st.rotate || 0; $('#barFg').value = $('#barFgT').value = st.fg || '#111111'; $('#barBg').value = $('#barBgT').value = st.bg || '#ffffff'; toggle($('#barText'), st.text !== false); $('#barTitle').value = st.title || it.name || '';
      ['#barW', '#barH', '#barM'].forEach(s => $(s + 'V').textContent = $(s).value); this.render();
    }
    $('#cEditNote').textContent = asEdit ? `Editando "${it.name || it.data.slice(0, 30)}". Al guardar se conserva la versión anterior.` : 'Duplicado: se guardará como un código nuevo.';
  },
  buildVcard(v) { return ['BEGIN:VCARD', 'VERSION:3.0', `N:${(v.name || '').split(' ').slice(1).join(' ')};${(v.name || '').split(' ')[0]};;;`, `FN:${v.name || ''}`, v.org && `ORG:${v.org}`, v.title && `TITLE:${v.title}`, v.tel && `TEL;TYPE=CELL:${v.tel}`, v.email && `EMAIL:${v.email}`, v.url && `URL:${v.url}`, v.adr && `ADR;TYPE=WORK:;;${v.adr};;;;`, v.note && `NOTE:${v.note}`, 'END:VCARD'].filter(Boolean).join('\n'); },
  saveDraft() { LS.set('draft', {mode: this.mode, qrType: this.qrType, vals: this.vals, bar: {fmt: $('#barFmt').value, val: $('#barVal').value}}); },
  clearDraft() { LS.del('draft'); this.vals = {}; $('#barVal').value = ''; this.setType(this.qrType); },
  restoreDraft() { const d = S.draft; if (!d) return; const has = Object.values(d.vals || {}).some(Boolean) || d.bar.val; if (!has) return; this.vals = d.vals || {}; $('#barFmt').value = d.bar.fmt; $('#barVal').value = d.bar.val; $$('#segCreate button')[d.mode === 'bar' ? 1 : 0].click(); this.selectChip(d.qrType || 'text'); toast('Borrador recuperado'); }
};

// ---------- impresión / PDF ----------
const Printer = {
  // items: [{el(canvas|svg), title, text}]
  open(items, opts) {
    const o = Object.assign({cols: 2, rows: 3, copies: 1, title: true, text: true, border: true, size: 'a4', margin: 10, gap: 6, orient: 'portrait'}, opts || {});
    openSheet('Imprimir / PDF', `
      <p class="lead">Configura la hoja y pulsa Imprimir. En la vista de impresión de iOS puedes elegir "Guardar en Archivos" para obtener un PDF.</p>
      <div class="grid3"><div><label class="f">Columnas</label><input type="number" id="pCols" value="${o.cols}" min="1" max="6" inputmode="numeric"></div><div><label class="f">Filas</label><input type="number" id="pRows" value="${o.rows}" min="1" max="12" inputmode="numeric"></div><div><label class="f">Copias c/u</label><input type="number" id="pCopies" value="${o.copies}" min="1" max="200" inputmode="numeric"></div></div>
      <div class="grid3"><div><label class="f">Papel</label><select id="pSize"><option value="a4">A4</option><option value="letter">Carta</option><option value="a5">A5</option><option value="label">Etiqueta 62×29 mm</option></select></div><div><label class="f">Orientación</label><select id="pOrient"><option value="portrait">Vertical</option><option value="landscape">Horizontal</option></select></div><div><label class="f">Margen (mm)</label><input type="number" id="pMargin" value="${o.margin}" min="0" max="40" inputmode="numeric"></div></div>
      <div class="sw"><div class="t">Mostrar título</div><button class="tog ${o.title ? 'on' : ''}" id="pTitle"></button></div>
      <div class="sw"><div class="t">Mostrar contenido</div><button class="tog ${o.text ? 'on' : ''}" id="pText"></button></div>
      <div class="sw"><div class="t">Bordes de corte</div><button class="tog ${o.border ? 'on' : ''}" id="pBorder"></button></div>
      <div id="pWarn"></div>
      <div class="btns"><button class="btn p" id="pGo">Imprimir / Guardar PDF</button></div>`, b => {
      ['#pTitle', '#pText', '#pBorder'].forEach(s => $(s).onclick = e => { e.currentTarget.classList.toggle('on'); check(); });
      $('#pSize').value = o.size; $('#pOrient').value = o.orient;
      const check = () => { const cols = +$('#pCols').value, rows = +$('#pRows').value; const wmm = ({a4: 210, letter: 216, a5: 148, label: 62})[$('#pSize').value]; const cell = (wmm - 2 * +$('#pMargin').value) / cols; $('#pWarn').innerHTML = cell < 25 ? '<div class="msg warn">Cada código medirá menos de 25 mm: puede ser difícil de leer. Reduce columnas o el margen.</div>' : cell < 40 && items.some(i => i.text && i.text.length > 60) ? '<div class="msg warn">Contenido largo en celdas pequeñas: usa menos columnas.</div>' : ''; };
      ['#pCols', '#pRows', '#pMargin', '#pSize'].forEach(s => $(s).oninput = check); check();
      $('#pGo').onclick = () => {
        const cols = Math.max(1, +$('#pCols').value), rows = Math.max(1, +$('#pRows').value), copies = Math.max(1, +$('#pCopies').value), per = cols * rows;
        const size = $('#pSize').value, orient = $('#pOrient').value, showT = $('#pTitle').classList.contains('on'), showX = $('#pText').classList.contains('on'), border = $('#pBorder').classList.contains('on');
        const list = []; items.forEach(i => { for (let c = 0; c < copies; c++) list.push(i); });
        const pa = $('#printArea'); pa.innerHTML = ''; pa.style.setProperty('--pmar', $('#pMargin').value + 'mm'); pa.style.setProperty('--pborder', border ? '0.2mm dashed #bbb' : 'none');
        let st = $('#printStyle'); if (!st) { st = document.createElement('style'); st.id = 'printStyle'; document.head.appendChild(st); }
        const dims = {a4: [210, 297], letter: [216, 279], a5: [148, 210], label: [62, 29]}[size]; const [pw, ph] = orient === 'landscape' ? [dims[1], dims[0]] : dims; const m = +$('#pMargin').value;
        st.textContent = `@page{size:${size === 'label' ? '62mm 29mm' : size + ' ' + orient};margin:0}#printArea .pg{grid-template-columns:repeat(${cols},1fr);grid-auto-rows:${((ph - 2 * m - (rows - 1) * 6) / rows).toFixed(1)}mm;width:${pw}mm;height:${ph}mm}`;
        for (let i = 0; i < list.length; i += per) {
          const pg = document.createElement('div'); pg.className = 'pg';
          list.slice(i, i + per).forEach(it => { const lab = document.createElement('div'); lab.className = 'lab'; if (showT && it.title) { const t = document.createElement('div'); t.className = 't'; t.textContent = it.title; lab.appendChild(t); } const el = it.svg ? (() => { const d = document.createElement('div'); d.innerHTML = it.svg; const s = d.firstChild; s.removeAttribute('width'); s.removeAttribute('height'); s.style.width = '100%'; s.style.maxHeight = '70%'; return s; })() : it.el.cloneNode(true); if (el.tagName === 'CANVAS') { el.getContext('2d').drawImage(it.el, 0, 0); } lab.appendChild(el); if (showX && it.text) { const c = document.createElement('div'); c.className = 'c'; c.textContent = it.text.length > 70 ? it.text.slice(0, 67) + '…' : it.text; lab.appendChild(c); } pg.appendChild(lab); });
          pa.appendChild(pg);
        }
        closeSheet(); logAction('Imprimir', list.length + ' etiquetas'); setTimeout(() => window.print(), 150);
      };
    });
  }
};
Creator.init();
