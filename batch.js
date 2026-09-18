/* Códigos — procesamiento por lotes */
const Batch = {
  results: [], scanRes: [],
  init() {
    seg('#segBatch', k => { $('#bGen').classList.toggle('hidden', k !== 'gen'); $('#bScan').classList.toggle('hidden', k !== 'scan'); });
    $('#bFmt').innerHTML = '<option value="QR">QR Code</option>' + GEN_BAR.map(f => `<option value="${f}">${FORMATS[f].name}</option>`).join('');
    $('#bList').oninput = () => $('#bCount').textContent = this.lines().length + ' líneas';
    $('#bPaste').onclick = async () => { try { $('#bList').value += (await navigator.clipboard.readText()); $('#bList').dispatchEvent(new Event('input')); } catch { toast('Sin acceso al portapapeles', 'bad'); } };
    $('#bClear').onclick = () => { $('#bList').value = ''; $('#bList').dispatchEvent(new Event('input')); };
    $('#bImport').onclick = () => $('#fileList').click();
    $('#fileList').onchange = async e => { const f = e.target.files[0]; if (!f) return; let t = await readFile(f); t = t.split(/\r?\n/).map(l => l.split(/[;,\t]/).map(x => x.trim().replace(/^"|"$/g, '')).filter(Boolean).slice(0, 2).join(' | ')).filter(Boolean).join('\n'); $('#bList').value = t; $('#bList').dispatchEvent(new Event('input')); e.target.value = ''; };
    $('#bRun').onclick = () => this.run();
    $('#bSave').onclick = () => this.save(); $('#bPrint').onclick = () => Printer.open(this.results.filter(r => r.ok).map(r => ({el: r.el, title: r.title, text: r.value, svg: r.svg})));
    $('#bZip').onclick = () => this.exportAll();
    $('#bPick').onclick = () => $('#fileBatch').click();
    $('#fileBatch').onchange = e => { this.scanFiles(Array.from(e.target.files)); e.target.value = ''; };
    $('#bScanSave').onclick = () => { this.scanRes.forEach(r => Lib.persist(Lib.make('scan', r.format, r.text, {note: 'Lote: ' + r.file}), true)); toast(this.scanRes.length + ' guardados', 'ok'); };
    $('#bScanCsv').onclick = () => { const blob = new Blob(['﻿' + 'archivo;formato;contenido\r\n' + this.scanRes.map(r => [r.file, fmtName(r.format), r.text].map(s => '"' + String(s).replace(/"/g, '""') + '"').join(';')).join('\r\n')], {type: 'text/csv'}); download('lectura-lote.csv', blob); };
  },
  fillFolders() { const s = $('#bFolder'); s.innerHTML = '<option value="">Sin carpeta</option>' + S.folders.map(f => `<option>${esc(f)}</option>`).join(''); },
  lines() { return $('#bList').value.split('\n').map(l => l.trim()).filter(Boolean).map(l => { const [v, ...t] = l.split('|'); return {value: v.trim(), title: t.join('|').trim()}; }); },
  run() {
    const lines = this.lines(); if (!lines.length) return toast('La lista está vacía', 'bad');
    const fmt = $('#bFmt').value, fg = $('#bFg').value, ecl = $('#bEcl').value, text = $('#bText').value === '1'; const seen = new Set();
    this.results = lines.map((l, i) => {
      const r = {line: i + 1, input: l.value, title: l.title, ok: false};
      if (fmt === 'QR') { try { r.value = l.value; r.el = renderQR(l.value, {size: 300, margin: 2, fg, ecl}); r.svg = renderQR(l.value, {size: 300, margin: 2, fg, ecl}, 'svg'); r.ok = true; } catch (e) { r.err = 'No se pudo generar'; } }
      else { const v = validateBar(fmt, l.value); if (v.ok) { r.value = v.value; r.el = renderBar(fmt, v.value, {width: 2, height: 70, margin: 6, fg, text}, 'svg'); r.ok = true; } else r.err = v.msg; }
      if (r.ok) { const k = fmt + '|' + r.value; if (seen.has(k)) r.dup = true; seen.add(k); if (S.items.some(x => !x.deleted && x.format === fmt && x.data === r.value)) r.inLib = true; }
      return r;
    });
    const ok = this.results.filter(r => r.ok && !r.dup), dup = this.results.filter(r => r.dup), err = this.results.filter(r => !r.ok);
    $('#bOk').textContent = ok.length; $('#bDup').textContent = dup.length; $('#bErr').textContent = err.length;
    $('#bErrList').innerHTML = err.map(r => `<div class="msg bad" style="margin-bottom:6px">Línea ${r.line} · <span class="mono">${esc(r.input)}</span><br>${esc(r.err)}</div>`).join('') + (this.results.some(r => r.inLib) ? `<div class="msg info">${this.results.filter(r => r.inLib).length} ya existen en la biblioteca.</div>` : '');
    const g = $('#bGrid'); g.innerHTML = '';
    this.results.forEach(r => { const c = document.createElement('div'); c.className = 'bcell' + (r.ok ? '' : ' err'); if (r.ok) { const el = r.el.cloneNode(true); if (el.tagName === 'CANVAS') el.getContext('2d').drawImage(r.el, 0, 0); c.appendChild(el); } c.insertAdjacentHTML('beforeend', `<div class="t">${esc(r.title || r.value || r.input)}</div>${r.dup ? '<span class="badge warn">duplicado</span>' : ''}${!r.ok ? '<span>línea ' + r.line + '</span>' : ''}`); g.appendChild(c); });
    $('#bReport').classList.remove('hidden'); $('#bReport').scrollIntoView({behavior: 'smooth'}); haptic();
  },
  save() {
    const fmt = $('#bFmt').value, tags = $('#bTags').value.split(',').map(x => x.trim()).filter(Boolean), folder = $('#bFolder').value;
    const list = this.results.filter(r => r.ok && !r.dup); if (!list.length) return toast('Nada que guardar', 'bad');
    list.forEach(r => Lib.persist(Lib.make('create', fmt, r.value, {name: r.title, tags, folder, style: fmt === 'QR' ? {fg: $('#bFg').value, ecl: $('#bEcl').value, margin: 2} : {fg: $('#bFg').value, text: $('#bText').value === '1'}}), true));
    toast(list.length + ' códigos guardados', 'ok'); logAction('Lote', list.length + ' códigos');
  },
  async exportAll() {
    const list = this.results.filter(r => r.ok); if (!list.length) return;
    if (!await ask('Exportar PNG', `Se descargarán ${list.length} imágenes, una por una. Con muchas, la hoja imprimible es más práctica.`, 'Descargar')) return;
    for (const r of list) { const cv = await composeCanvas(r.el, {title: r.title, caption: ''}); download((r.title || r.value).replace(/[^\w\-]/g, '_').slice(0, 40) + '.png', await canvasBlob(cv)); await new Promise(x => setTimeout(x, 300)); }
  },
  async scanFiles(files) {
    if (!files.length) return; toast('Analizando ' + files.length + ' imágenes…'); this.scanRes = [];
    for (const f of files) { try { const img = await loadImg(await readFile(f, 'url')); (await Decoder.decodeImage(img)).forEach(h => this.scanRes.push({file: f.name, format: h.format, text: h.text})); } catch {} }
    $('#bScanN').textContent = this.scanRes.length; $('#bScanRes').classList.remove('hidden');
    $('#bScanList').innerHTML = this.scanRes.length ? this.scanRes.map(r => `<div class="item"><div class="b"><div class="n">${esc(r.text)}</div><div class="c">${esc(r.file)}</div><div class="m"><span class="badge ${is2d(r.format) ? 'qr' : 'bar'}">${esc(fmtName(r.format))}</span></div></div></div>`).join('') : '<div class="empty">No se detectaron códigos en las imágenes seleccionadas.</div>';
    haptic(this.scanRes.length ? 'ok' : 'bad');
  }
};
Batch.init();
