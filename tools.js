/* Códigos — herramientas complementarias */
const Tools = {
  list: [
    ['identify', 'Identificar e interpretar', 'Pega un contenido y descubre qué tipo es y qué haría un lector.', '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h0"/></svg>'],
    ['checkdigit', 'Dígito verificador', 'Calcula o comprueba el dígito de control de EAN, UPC e ITF-14.', '<svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>'],
    ['convert', 'Convertir formato', 'Lleva un contenido de la biblioteca a otro formato compatible.', '<svg viewBox="0 0 24 24"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>'],
    ['compare', 'Comparar dos códigos', 'Muestra diferencias carácter a carácter entre dos contenidos.', '<svg viewBox="0 0 24 24"><path d="M12 3v18M3 8l4-4 4 4M21 16l-4 4-4-4"/></svg>'],
    ['verify', 'Comprobar legibilidad', 'Elige una imagen de un código creado y verifica que se lea.', '<svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>'],
    ['labels', 'Hoja de etiquetas', 'Selecciona códigos de la biblioteca y arma una hoja imprimible.', '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 12h18M12 3v18"/></svg>'],
    ['dups', 'Limpiar duplicados', 'Detecta contenidos repetidos y conserva uno solo.', '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'],
    ['export', 'Exportar todo', 'Respaldo JSON, CSV del historial o PDF de la biblioteca.', '<svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>']
  ],
  render() {
    $('#toolList').innerHTML = this.list.map(([k, t, s, ic]) => `<button class="tool" data-k="${k}"><div class="ic">${ic}</div><div class="b"><div class="t">${t}</div><div class="s">${s}</div></div></button>`).join('');
    $$('#toolList .tool').forEach(b => b.onclick = () => this[b.dataset.k]());
    const live = S.items.filter(i => !i.deleted); const scans = live.filter(i => i.kind === 'scan'), creates = live.filter(i => i.kind === 'create');
    const week = Date.now() - 7 * 864e5; const byF = {}; live.forEach(i => byF[i.format] = (byF[i.format] || 0) + 1); const top = Object.entries(byF).sort((a, b) => b[1] - a[1])[0];
    $('#statsBox').innerHTML = [[live.length, 'Total'], [scans.length, 'Leídos'], [creates.length, 'Creados'], [live.filter(i => i.ts > week).length, 'Últimos 7 días'], [live.filter(i => i.fav).length, 'Favoritos'], [top ? fmtName(top[0]).split(' ')[0] : '—', 'Formato frecuente']].map(([v, l]) => `<div class="stat"><div class="v">${v}</div><div class="l">${l}</div></div>`).join('');
    $('#fmtHelp').innerHTML = Object.entries(FORMATS).map(([k, f]) => `<b>${f.name}</b><span>${f.help}${f.gen ? '' : k === 'QR' ? '' : ' <em style="color:var(--muted)">(solo lectura)</em>'}</span>`).join('');
  },
  identify() {
    openSheet('Identificar contenido', `<textarea id="tIn" placeholder="Pega aquí el contenido de un código"></textarea><div class="btns"><button class="btn p" id="tGo">Interpretar</button><button class="btn" id="tPaste">Pegar</button></div><div id="tOut"></div>`, () => {
      $('#tPaste').onclick = async () => { try { $('#tIn').value = await navigator.clipboard.readText(); } catch {} };
      $('#tGo').onclick = () => { const t = $('#tIn').value.trim(); if (!t) return; closeSheet(); Result.open(Lib.make('scan', /^\d{8}$|^\d{12,14}$/.test(t) ? (t.length === 8 ? 'EAN_8' : t.length === 12 ? 'UPC_A' : t.length === 13 ? 'EAN_13' : 'ITF_14') : 'MANUAL', t)); };
    });
  },
  checkdigit() {
    openSheet('Dígito verificador', `<label class="f">Formato</label><select id="cdF"><option value="EAN_13">EAN-13</option><option value="EAN_8">EAN-8</option><option value="UPC_A">UPC-A</option><option value="UPC_E">UPC-E</option><option value="ITF_14">ITF-14</option></select><label class="f">Número</label><input id="cdV" inputmode="numeric" placeholder="Con o sin dígito verificador"><div id="cdOut" style="margin-top:10px"></div><p class="note">Con el número completo se comprueba; sin el último dígito se calcula. El algoritmo suma los dígitos con pesos alternos 3 y 1 y completa a la decena.</p>`, () => {
      const go = () => { const r = validateBar($('#cdF').value, $('#cdV').value); $('#cdOut').innerHTML = $('#cdV').value ? `<div class="msg ${r.ok ? 'ok' : 'bad'}">${esc(r.msg)}${r.fix ? '<br>Número corregido: <b>' + r.fix + '</b>' : ''}</div>` : ''; };
      $('#cdV').oninput = go; $('#cdF').onchange = go;
    });
  },
  pickItem(title, cb) {
    const live = S.items.filter(i => !i.deleted);
    openSheet(title, `<input id="pkQ" placeholder="Buscar…"><div class="list" id="pkList"></div>`, b => {
      const draw = q => { const l = live.filter(i => !q || (i.data + ' ' + i.name).toLowerCase().includes(q.toLowerCase())).slice(0, 60); $('#pkList').innerHTML = l.map(i => Lib.itemHTML(i)).join('') || '<div class="empty">Sin resultados</div>'; $$('.item', b).forEach(el => el.onclick = () => cb(S.items.find(x => x.id === el.dataset.id))); };
      draw(''); $('#pkQ').oninput = e => draw(e.target.value);
    });
  },
  convert() {
    this.pickItem('Elige el código a convertir', it => {
      const compat = ['QR', 'DATA_MATRIX', 'PDF_417', 'AZTEC'].concat(GEN_BAR.filter(f => validateBar(f, it.data).ok));
      openSheet('Convertir a…', `<div class="pre mono">${esc(it.data)}</div><p class="lead">Formatos compatibles con este contenido:</p><div class="list">${compat.filter(f => f !== it.format).map(f => `<button class="act" data-f="${f}"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/></svg><div class="b"><div>${fmtName(f)}</div><div class="s">${esc(FORMATS[f].help)}</div></div></button>`).join('') || '<div class="empty">No hay otros formatos compatibles con este contenido.</div>'}</div>`, b => $$('.act', b).forEach(a => a.onclick = () => { closeSheet(); showView('create'); Creator.loadText(it.data, a.dataset.f); }));
    });
  },
  compare() {
    openSheet('Comparar dos códigos', `<label class="f">Código A</label><textarea id="cA" style="min-height:60px"></textarea><label class="f">Código B</label><textarea id="cB" style="min-height:60px"></textarea><div class="btns"><button class="btn" id="cPickA">Elegir A de biblioteca</button><button class="btn" id="cPickB">Elegir B</button></div><button class="btn p w" id="cGo">Comparar</button><div id="cOut"></div>`, () => {
      const pick = t => this.pickItem('Elegir código', it => { this.compare(); setTimeout(() => { $(t).value = it.data; }, 50); });
      $('#cPickA').onclick = () => pick('#cA'); $('#cPickB').onclick = () => pick('#cB');
      $('#cGo').onclick = () => {
        const a = $('#cA').value, b = $('#cB').value; if (a === b) return $('#cOut').innerHTML = '<div class="msg ok">Idénticos: los dos contenidos son exactamente iguales.</div>';
        let out = '', diff = 0; const n = Math.max(a.length, b.length);
        for (let i = 0; i < n; i++) { const x = a[i] ?? '', y = b[i] ?? ''; if (x === y) out += esc(x); else { diff++; out += `<span style="background:rgba(255,107,107,.3)">${esc(x || '·')}</span><span style="background:rgba(76,210,138,.3)">${esc(y || '·')}</span>`; } }
        $('#cOut').innerHTML = `<div class="msg warn">${diff} posiciones distintas · longitudes ${a.length} y ${b.length}</div><div class="pre mono">${out}</div><p class="note">Rojo: carácter de A · Verde: carácter de B</p>`;
      };
    });
  },
  verify() { showView('scan'); $('#fileImg').click(); toast('Elige la imagen del código a comprobar'); },
  labels() { showView('lib'); if (!Lib.selMode) $('#libSelMode').click(); toast('Selecciona los códigos y pulsa "Hoja"'); },
  dups() { Lib.dups(); },
  export() { openSheet('Exportar', `<div class="list"><button class="act" id="eJson"><svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/></svg><div class="b"><div>Respaldo completo (JSON)</div><div class="s">Recuperable en esta app, con cifrado opcional</div></div></button><button class="act" id="eCsv"><svg viewBox="0 0 24 24"><path d="M3 3h18v18H3z"/></svg><div class="b"><div>Historial en CSV</div><div class="s">Para hojas de cálculo</div></div></button><button class="act" id="ePdf"><svg viewBox="0 0 24 24"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/></svg><div class="b"><div>Biblioteca en PDF</div><div class="s">Hoja con todos los códigos activos</div></div></button></div>`, () => {
    $('#eJson').onclick = () => { closeSheet(); Lib.backup(); }; $('#eCsv').onclick = () => Lib.csv(S.items.filter(i => !i.deleted));
    $('#ePdf').onclick = () => { const l = S.items.filter(i => !i.deleted); if (!l.length) return toast('Biblioteca vacía', 'bad'); Printer.open(l.map(i => ({el: Lib.renderEl(i), title: i.name, text: i.data})), {cols: 3, rows: 4}); };
  }); }
};
