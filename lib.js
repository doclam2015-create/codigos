/* Códigos — biblioteca personal */
const Lib = {
  tab: 'all', q: '', sort: 'ts-desc', folder: '', fmtFilter: '', tagFilter: '', selMode: false, sel: new Set(), thumbs: new Map(),
  make(kind, format, data, extra = {}) { return Object.assign({id: uid(), kind, format, data, ts: Date.now(), name: '', note: '', tags: [], folder: '', fav: false, uses: 0, saved: false, deleted: null}, extra); },
  addScan(format, data) {
    const it = this.make('scan', format, data);
    if (S.settings.keepScans) { const dup = S.items.find(i => !i.deleted && i.kind === 'scan' && i.data === data && i.format === format); if (dup) { dup.ts = Date.now(); dup.uses = (dup.uses || 0) + 1; saveItems(); return dup; } this.persist(it, true); }
    return it;
  },
  persist(it, saved) {
    if (saved) it.saved = true;
    const i = S.items.findIndex(x => x.id === it.id); if (i < 0) S.items.unshift(it); else S.items[i] = it;
    saveItems(); if ($('#v-lib').classList.contains('on')) this.render();
  },
  thumb(it) {
    const k = it.id + '|' + it.data + '|' + it.format; if (this.thumbs.has(k)) return this.thumbs.get(k);
    let html = '';
    try {
      if (BWIP[it.format]) { html = ''; if (window.bwipjs) { const cv = document.createElement('canvas'); bwipjs.toCanvas(cv, {bcid: BWIP[it.format], text: it.data.slice(0, 300), scale: 1, padding: 2}); html = `<img src="${cv.toDataURL()}" style="max-width:48px;max-height:48px" alt="">`; } else loadBwip().then(() => { this.thumbs.delete(k); if ($('#v-lib').classList.contains('on')) this.render(); }).catch(() => {}); }
      else if (is2d(it.format) || it.format === 'MANUAL') { const cv = renderQR(it.data.slice(0, 500), {size: 96, margin: 1, fg: (it.style || {}).fg || '#111', bg: '#fff', ecl: 'L'}); html = `<img src="${cv.toDataURL()}" width="48" height="48" alt="">`; }
      else if (GEN_BAR.includes(it.format)) { const r = validateBar(it.format, it.data); if (r.ok) { const cv = renderBar(it.format, r.value, {width: 1, height: 30, margin: 2, text: false}, 'canvas'); html = `<img src="${cv.toDataURL()}" style="max-width:48px" alt="">`; } }
    } catch {}
    if (!html) html = `<span style="font-size:9px;font-weight:800;color:#555">${esc(fmtName(it.format).slice(0, 8))}</span>`;
    this.thumbs.set(k, html); return html;
  },
  itemHTML(it) {
    const p = parseContent(it.data, it.format);
    return `<div class="item ${this.sel.has(it.id) ? 'sel' : ''}" data-id="${it.id}">${this.selMode ? `<div class="cb ${this.sel.has(it.id) ? 'on' : ''}">${this.sel.has(it.id) ? '✓' : ''}</div>` : ''}<div class="th">${this.thumb(it)}</div><div class="b"><div class="n">${esc(it.name || p.fields.name || p.fields.ssid || p.fields.summary || p.fields.host || it.data)}</div><div class="c">${esc(it.data)}</div><div class="m"><span class="badge ${is2d(it.format) ? 'qr' : 'bar'}">${esc(fmtName(it.format))}</span><span class="badge">${it.kind === 'scan' ? 'leído' : 'creado'}</span>${it.folder ? `<span class="tag">▸ ${esc(it.folder)}</span>` : ''}${(it.tags || []).map(t => `<span class="tag">#${esc(t)}</span>`).join('')}<span class="dt">${fmtDate(it.ts)}</span></div></div>${it.fav ? '<span class="star">★</span>' : ''}</div>`;
  },
  filtered() {
    const q = this.q.toLowerCase();
    let l = S.items.filter(i => this.tab === 'trash' ? i.deleted : !i.deleted);
    if (this.tab === 'scan') l = l.filter(i => i.kind === 'scan'); if (this.tab === 'create') l = l.filter(i => i.kind === 'create'); if (this.tab === 'fav') l = l.filter(i => i.fav);
    if (this.folder) l = l.filter(i => i.folder === this.folder); if (this.fmtFilter) l = l.filter(i => i.format === this.fmtFilter); if (this.tagFilter) l = l.filter(i => (i.tags || []).includes(this.tagFilter));
    if (q) l = l.filter(i => [i.data, i.name, i.note, (i.tags || []).join(' '), fmtName(i.format), fmtDate(i.ts)].join(' ').toLowerCase().includes(q));
    const s = this.sort;
    l.sort((a, b) => s === 'ts-desc' ? b.ts - a.ts : s === 'ts-asc' ? a.ts - b.ts : s === 'name' ? (a.name || a.data).localeCompare(b.name || b.data) : s === 'fmt' ? a.format.localeCompare(b.format) || b.ts - a.ts : (b.uses || 0) - (a.uses || 0) || b.ts - a.ts);
    return l;
  },
  render() {
    const l = this.filtered(); const box = $('#libList');
    box.innerHTML = l.length ? l.slice(0, 200).map(i => this.itemHTML(i)).join('') + (l.length > 200 ? `<div class="empty">Mostrando 200 de ${l.length}. Afina la búsqueda.</div>` : '') : `<div class="empty"><svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg><br>${this.tab === 'trash' ? 'La papelera está vacía.' : 'No hay códigos aquí todavía.'}</div>`;
    $$('.item', box).forEach(el => el.onclick = () => { const it = S.items.find(x => x.id === el.dataset.id); if (this.selMode) { this.sel.has(it.id) ? this.sel.delete(it.id) : this.sel.add(it.id); this.render(); } else this.detail(it); });
    $('#libTrashBar').classList.toggle('hidden', this.tab !== 'trash'); $('#trashAuto').textContent = S.settings.trashDays ? ` o pasen ${S.settings.trashDays} días` : '';
    $('#libSelBar').classList.toggle('hidden', !this.selMode); $('#libSelCount').textContent = this.sel.size + ' seleccionados';
    // filtros
    const fmts = [...new Set(S.items.filter(i => !i.deleted).map(i => i.format))]; const tags = [...new Set(S.items.filter(i => !i.deleted).flatMap(i => i.tags || []))];
    $('#libFilters').innerHTML = `<button class="chip ${!this.fmtFilter && !this.tagFilter ? 'on' : ''}" data-f="" data-t="">Todo</button>` + fmts.map(f => `<button class="chip ${this.fmtFilter === f ? 'on' : ''}" data-f="${f}">${esc(fmtName(f))}</button>`).join('') + tags.map(t => `<button class="chip ${this.tagFilter === t ? 'on' : ''}" data-t="${t}">#${esc(t)}</button>`).join('');
    $$('#libFilters .chip').forEach(c => c.onclick = () => { this.fmtFilter = c.dataset.f || ''; this.tagFilter = c.dataset.t || ''; this.render(); });
    const fs = $('#libFolder'); const cur = fs.value; fs.innerHTML = '<option value="">Todas las carpetas</option>' + S.folders.map(f => `<option ${cur === f ? 'selected' : ''}>${esc(f)}</option>`).join('');
  },
  detail(it) {
    if (it.deleted) return openSheet('En papelera', `<div class="pre mono">${esc(it.data)}</div><div class="btns"><button class="btn p" id="tRestore">Recuperar</button><button class="btn d" id="tKill">Eliminar definitivamente</button></div>`, () => { $('#tRestore').onclick = () => { it.deleted = null; saveItems(); this.render(); closeSheet(); toast('Recuperado', 'ok'); }; $('#tKill').onclick = async () => { if (await ask('Eliminar definitivamente', 'No se podrá recuperar.', 'Eliminar', true)) { S.items = S.items.filter(x => x !== it); saveItems(); this.render(); closeSheet(); } }; });
    it.uses = (it.uses || 0) + 1; saveItems();
    if (it.kind === 'scan') return Result.open(it);
    const prev = document.createElement('div'); prev.className = 'preview';
    try { if (BWIP[it.format]) { render2D(it.format, it.data, Object.assign({}, it.style || {}, {size: 300})).then(cv => { cv.style.maxWidth = '260px'; cv.style.width = '100%'; prev.appendChild(cv); }); } else if (it.format === 'QR') { const st = it.style || {}; const cv = renderQR(it.data, Object.assign({}, st, {size: 300, logo: null})); cv.style.maxWidth = '260px'; cv.style.width = '100%'; prev.appendChild(cv); } else prev.appendChild(renderBar(it.format, it.data, Object.assign({}, it.style || {}, {rotate: 0}), 'svg')); } catch { prev.textContent = 'Vista previa no disponible'; }
    openSheet(it.name || 'Código creado', `<div id="dPrev"></div>
      <div class="row" style="flex-wrap:wrap;gap:6px"><span class="badge ${is2d(it.format) ? 'qr' : 'bar'}">${esc(fmtName(it.format))}</span><span class="badge">${fmtDate(it.ts)}</span>${(it.versions || []).length ? `<span class="badge info">${it.versions.length} versiones</span>` : ''}</div>
      <div class="pre mono">${esc(it.data)}</div>
      <div class="btns"><button class="btn p" id="dEdit">Editar</button><button class="btn" id="dDup">Duplicar</button><button class="btn" id="dShare">Compartir</button><button class="btn" id="dPrint">Imprimir</button><button class="btn" id="dCopy">Copiar contenido</button>${(it.versions || []).length ? '<button class="btn" id="dVers">Versiones</button>' : ''}</div>
      <div class="card"><h2>Organización</h2>
        <label class="f">Nombre</label><input id="rName" value="${esc(it.name || '')}"><label class="f">Nota</label><textarea id="rNote" style="min-height:60px">${esc(it.note || '')}</textarea><label class="f">Etiquetas</label><input id="rTags" value="${esc((it.tags || []).join(', '))}" placeholder="separadas por coma"><label class="f">Carpeta</label><select id="rFolder"><option value="">Sin carpeta</option>${S.folders.map(x => `<option ${it.folder === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>
        <div class="btns" style="margin-top:10px"><button class="btn p" id="rSave">Guardar cambios</button><button class="btn" id="rFav">${it.fav ? '★ Favorito' : '☆ Favorito'}</button><button class="btn d" id="rDel">Eliminar</button></div></div>`, b => {
      $('#dPrev').replaceWith(prev);
      const collect = () => { it.name = $('#rName').value.trim(); it.note = $('#rNote').value.trim(); it.tags = $('#rTags').value.split(',').map(x => x.trim()).filter(Boolean); it.folder = $('#rFolder').value; };
      $('#rSave').onclick = () => { collect(); this.persist(it, true); toast('Guardado', 'ok'); closeSheet(); };
      $('#rFav').onclick = () => { it.fav = !it.fav; this.persist(it, true); $('#rFav').textContent = it.fav ? '★ Favorito' : '☆ Favorito'; };
      $('#rDel').onclick = () => { closeSheet(); this.trash([it]); };
      $('#dEdit').onclick = () => { closeSheet(); Creator.loadItem(it, true); };
      $('#dDup').onclick = () => { closeSheet(); Creator.loadItem(it, false); };
      $('#dCopy').onclick = () => copyText(it.data);
      $('#dShare').onclick = async () => { const cv = await composeCanvas(prev.firstChild, {title: it.name}); const f = new File([await canvasBlob(cv)], (it.name || 'codigo') + '.png', {type: 'image/png'}); if (!await shareFiles([f], undefined, it.name)) download((it.name || 'codigo') + '.png', await canvasBlob(cv)); };
      $('#dPrint').onclick = () => Printer.open([{el: prev.firstChild, title: it.name, text: it.data}]);
      $('#dVers') && ($('#dVers').onclick = () => openSheet('Versiones anteriores', `<div class="list">${it.versions.map((v, i) => `<div class="item" data-i="${i}"><div class="b"><div class="n">${fmtDate(v.ts)}</div><div class="c">${esc(v.data)}</div></div><button class="btn sm" data-r="${i}">Restaurar</button></div>`).join('')}</div>`, bb => $$('[data-r]', bb).forEach(x => x.onclick = () => { const v = it.versions[+x.dataset.r]; it.versions.unshift({ts: it.ts, data: it.data, format: it.format, style: it.style}); it.data = v.data; it.format = v.format; it.style = v.style; it.ts = Date.now(); this.persist(it, true); closeSheet(); toast('Versión restaurada', 'ok'); })));
    });
  },
  trash(items) {
    const ids = items.map(i => i.id); items.forEach(i => i.deleted = Date.now()); saveItems(); this.sel.clear(); this.render();
    toast(`${items.length} elemento${items.length > 1 ? 's' : ''} a la papelera`, '', () => { S.items.filter(i => ids.includes(i.id)).forEach(i => i.deleted = null); saveItems(); this.render(); });
  },
  selected() { return S.items.filter(i => this.sel.has(i.id)); },
  async manageFolders() {
    openSheet('Carpetas', `<div class="row"><input id="fNew" placeholder="Nueva carpeta" class="grow"><button class="btn p sm" id="fAdd">Crear</button></div><div class="list" id="fList">${S.folders.map(f => `<div class="item"><div class="b"><div class="n">${esc(f)}</div><div class="c">${S.items.filter(i => !i.deleted && i.folder === f).length} códigos</div></div><button class="btn sm" data-ren="${esc(f)}">Renombrar</button><button class="btn sm d" data-del="${esc(f)}">Borrar</button></div>`).join('') || '<div class="empty">Sin carpetas. Crea una para organizar tus códigos.</div>'}</div>`, b => {
      $('#fAdd').onclick = () => { const n = $('#fNew').value.trim(); if (!n || S.folders.includes(n)) return; S.folders.push(n); saveFolders(); this.manageFolders(); };
      $$('[data-ren]', b).forEach(x => x.onclick = async () => { const n = await prompt2('Renombrar carpeta', x.dataset.ren); if (!n || n === x.dataset.ren) return; S.folders[S.folders.indexOf(x.dataset.ren)] = n; S.items.forEach(i => { if (i.folder === x.dataset.ren) i.folder = n; }); saveFolders(); saveItems(); this.manageFolders(); });
      $$('[data-del]', b).forEach(x => x.onclick = async () => { if (!await ask('Borrar carpeta', `Los códigos de "${x.dataset.del}" quedarán sin carpeta.`, 'Borrar', true)) return; S.folders = S.folders.filter(f => f !== x.dataset.del); S.items.forEach(i => { if (i.folder === x.dataset.del) i.folder = ''; }); saveFolders(); saveItems(); this.manageFolders(); });
    });
  },
  async pickFolder() { return new Promise(res => openSheet('Mover a carpeta', `<div class="list"><button class="act" data-f=""><svg viewBox="0 0 24 24"><path d="M3 7h18"/></svg><div class="b"><div>Sin carpeta</div></div></button>${S.folders.map(f => `<button class="act" data-f="${esc(f)}"><svg viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg><div class="b"><div>${esc(f)}</div></div></button>`).join('')}</div>`, b => $$('.act', b).forEach(a => a.onclick = () => { closeSheet(); res(a.dataset.f); }))); },
  async backup() {
    const pass = await confirmDlg({title: 'Crear respaldo', text: 'Opcional: contraseña para cifrar el archivo (AES-256). Déjala vacía para un respaldo sin cifrar.', input: {placeholder: 'Contraseña (opcional)', type: 'password'}, ok: 'Crear'});
    if (pass === null) return;
    const data = {app: 'codigos', version: VERSION, ts: Date.now(), items: S.items, folders: S.folders, settings: Object.assign({}, S.settings, {pin: null})};
    const out = pass ? await encryptJSON(data, pass) : data; out.app = 'codigos';
    const blob = new Blob([JSON.stringify(out)], {type: 'application/json'}); const name = `codigos-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
    const f = new File([blob], name, {type: 'application/json'}); if (!await shareFiles([f], undefined, 'Respaldo Códigos')) download(name, blob); logAction('Respaldo', name);
  },
  async restore(file) {
    try {
      let d = JSON.parse(await readFile(file));
      if (d.enc) { const pass = await confirmDlg({title: 'Respaldo cifrado', input: {placeholder: 'Contraseña', type: 'password'}, ok: 'Descifrar'}); if (pass === null) return; try { d = await decryptJSON(d, pass); } catch { return toast('Contraseña incorrecta', 'bad'); } }
      if (d.app !== 'codigos' || !Array.isArray(d.items)) return toast('El archivo no es un respaldo válido', 'bad');
      const mode = await confirmDlg({title: 'Restaurar respaldo', text: `${d.items.length} códigos y ${(d.folders || []).length} carpetas del ${fmtDate(d.ts)}. "Combinar" conserva lo actual y añade lo nuevo; "Reemplazar" borra la biblioteca actual.`, ok: 'Combinar'});
      if (mode === null) return;
      const replace = await ask('¿Reemplazar en vez de combinar?', 'Pulsa "Reemplazar" para borrar la biblioteca actual antes de restaurar, o "Cancelar" para combinar.', 'Reemplazar', true);
      if (replace) { S.items = d.items; S.folders = d.folders || []; }
      else { const ids = new Set(S.items.map(i => i.id)); d.items.forEach(i => { if (!ids.has(i.id)) S.items.push(i); }); (d.folders || []).forEach(f => { if (!S.folders.includes(f)) S.folders.push(f); }); }
      if (d.settings) { const pin = S.settings.pin; S.settings = Object.assign({}, DEFAULTS, d.settings, {pin}); saveSettings(); applyTheme(); }
      saveItems(); saveFolders(); this.thumbs.clear(); this.render(); toast('Biblioteca restaurada', 'ok');
    } catch (e) { toast('No se pudo leer el respaldo', 'bad'); }
  },
  csv(items) {
    const esc2 = s => '"' + String(s ?? '').replace(/"/g, '""') + '"';
    const rows = [['fecha', 'tipo', 'formato', 'contenido', 'nombre', 'nota', 'etiquetas', 'carpeta', 'favorito']].concat(items.map(i => [new Date(i.ts).toISOString(), i.kind === 'scan' ? 'leído' : 'creado', fmtName(i.format), i.data, i.name, i.note, (i.tags || []).join(' '), i.folder, i.fav ? 'sí' : 'no']));
    const blob = new Blob(['﻿' + rows.map(r => r.map(esc2).join(';')).join('\r\n')], {type: 'text/csv;charset=utf-8'});
    download(`codigos-${new Date().toISOString().slice(0, 10)}.csv`, blob);
  },
  dups() {
    const g = {}; S.items.filter(i => !i.deleted).forEach(i => { const k = i.format + '|' + i.data; (g[k] = g[k] || []).push(i); });
    const groups = Object.values(g).filter(x => x.length > 1);
    if (!groups.length) return toast('No hay duplicados', 'ok');
    openSheet('Duplicados', `<p class="lead">${groups.length} contenidos repetidos. "Limpiar" conserva el más antiguo de cada grupo (con nombre y notas combinados) y envía el resto a la papelera.</p><div class="list">${groups.map(x => `<div class="item"><div class="b"><div class="n">${esc(x[0].name || x[0].data)}</div><div class="c">${x.length} copias · ${esc(fmtName(x[0].format))}</div></div></div>`).join('')}</div><button class="btn p w" id="dupClean">Limpiar duplicados</button>`, () => $('#dupClean').onclick = () => {
      const rm = []; groups.forEach(x => { x.sort((a, b) => a.ts - b.ts); const keep = x[0]; x.slice(1).forEach(d => { if (!keep.name && d.name) keep.name = d.name; if (d.note) keep.note = [keep.note, d.note].filter(Boolean).join('\n'); keep.tags = [...new Set([...(keep.tags || []), ...(d.tags || [])])]; keep.fav = keep.fav || d.fav; rm.push(d); }); });
      closeSheet(); this.trash(rm);
    });
  },
  init() {
    seg('#segLib', k => { this.tab = k; this.render(); });
    $('#libQ').oninput = e => { this.q = e.target.value; this.render(); };
    $('#libSort').onchange = e => { this.sort = e.target.value; this.render(); };
    $('#libFolder').onchange = e => { this.folder = e.target.value; this.render(); };
    $('#libFolderMg').onclick = () => this.manageFolders();
    $('#libSelMode').onclick = () => { this.selMode = !this.selMode; this.sel.clear(); toggle($('#libSelMode'), this.selMode); this.render(); };
    $('#libSelAll').onclick = () => { const l = this.filtered(); if (this.sel.size === l.length) this.sel.clear(); else l.forEach(i => this.sel.add(i.id)); this.render(); };
    $('#selDel').onclick = async () => { const s = this.selected(); if (!s.length) return; if (this.tab === 'trash') { if (await ask('Eliminar definitivamente', `${s.length} elementos. No se podrá deshacer.`, 'Eliminar', true)) { S.items = S.items.filter(i => !this.sel.has(i.id)); saveItems(); this.sel.clear(); this.render(); } } else this.trash(s); };
    $('#selFav').onclick = () => { const s = this.selected(); const v = !s.every(i => i.fav); s.forEach(i => i.fav = v); saveItems(); this.render(); };
    $('#selMove').onclick = async () => { const s = this.selected(); if (!s.length) return; const f = await this.pickFolder(); s.forEach(i => i.folder = f); saveItems(); this.render(); toast('Movidos', 'ok'); };
    $('#selTag').onclick = async () => { const s = this.selected(); if (!s.length) return; const t = await prompt2('Añadir etiquetas', '', 'separadas por coma', 'Añadir'); if (!t) return; const tags = t.split(',').map(x => x.trim()).filter(Boolean); s.forEach(i => i.tags = [...new Set([...(i.tags || []), ...tags])]); saveItems(); this.render(); };
    $('#selExport').onclick = () => { const s = this.selected(); if (s.length) this.csv(s); };
    $('#selPrint').onclick = async () => { const s = this.selected(); if (!s.length) return; if (s.some(i => BWIP[i.format])) await loadBwip().catch(() => {}); Printer.open(s.map(i => ({el: this.renderEl(i), title: i.name, text: i.data}))); };
    $('#trashEmpty').onclick = async () => { if (await ask('Vaciar papelera', 'Se eliminarán definitivamente todos los elementos de la papelera.', 'Vaciar', true)) { S.items = S.items.filter(i => !i.deleted); saveItems(); this.render(); } };
    $('#libBackup').onclick = () => this.backup(); $('#libRestore').onclick = () => $('#fileBackup').click(); $('#fileBackup').onchange = e => { if (e.target.files[0]) this.restore(e.target.files[0]); e.target.value = ''; };
    $('#libCsv').onclick = () => this.csv(S.items.filter(i => !i.deleted)); $('#libDups').onclick = () => this.dups();
  },
  renderEl(i) { try { if (BWIP[i.format] && window.bwipjs) { const cv = document.createElement('canvas'); bwipjs.toCanvas(cv, {bcid: BWIP[i.format], text: i.data, scale: 3, padding: 6}); return cv; } if (is2d(i.format) || i.format === 'MANUAL') return renderQR(i.data, Object.assign({size: 400, margin: 2}, i.style || {}, {logo: null, size: 400})); const r = validateBar(i.format, i.data); return renderBar(i.format, r.ok ? r.value : i.data, Object.assign({}, i.style || {}, {rotate: 0}), 'svg'); } catch { return renderQR(i.data, {size: 400}); } }
};
Lib.init();
