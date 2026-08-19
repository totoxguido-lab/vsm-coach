/* VSM Coach v2 — panels.js: palette, popover degli elementi, guida, piano, libreria mappe, menu, suggerimenti di strumento. */
(function (V) {
  'use strict';
  const I = V.interact, R = V.render; const { num, fmt, uid, clone, today } = V.util;
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const UI = V.ui = {};
  UI.toast = (m) => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(UI._t); UI._t = setTimeout(() => t.classList.remove('show'), 2200); };

  // ---------- icone ----------
  const IC = {
    select: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M5 3l14 8-6 2-3 6z"/></svg>',
    pan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8 11V5.5a1.5 1.5 0 013 0V11m0-4.5a1.5 1.5 0 013 0V11m0-3a1.5 1.5 0 013 0v7a6 6 0 01-6 6h-1a6 6 0 01-5-3l-2.5-4a1.5 1.5 0 012.5-1.6L8 13"/></svg>',
    ink: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l4-1L19 8a2 2 0 00-3-3L5 16z"/><path d="M13 6l4 4"/></svg>',
    eraser: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 16l9-9 5 5-6 6H8z"/><path d="M4 20h16" stroke-linecap="round"/></svg>',
    box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="6" y="3" width="12" height="18" rx="1"/><path d="M6 8h12"/></svg>',
    delta: '<svg viewBox="0 0 24 24"><path d="M4 5h16l-8 15z" fill="#c8321e"/></svg>',
    flow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h16M15 8l4 4-4 4"/></svg>',
    request: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M20 5c-6 0-10 4-16 12M7 14l-3 3 4 1"/><circle cx="20" cy="5" r="1.6" fill="currentColor"/></svg>',
    person: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="5" r="2.5"/><path d="M12 8v7M7 11h10M12 15l-4 6M12 15l4 6"/></svg>',
    storm: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 17h10a3 3 0 000-6 5 5 0 00-9.6-1.5A3.5 3.5 0 007 17z"/><path d="M11 18l-1.5 3M14 18l-1.5 3" stroke-linecap="round"/></svg>',
    fluffy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 18h10a3 3 0 000-6 5 5 0 00-9.6-1.5A3.5 3.5 0 007 18z"/></svg>',
    burst: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 3l1.8 3.6 4-.6-1.4 3.7 3.2 2.3-3.4 2 .8 3.9-3.8-1.3L12 20l-1.2-3.4L7 17.9l.8-3.9-3.4-2 3.2-2.3L6.2 6l4 .6z"/></svg>',
    inventory: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 5h16l-8 14z"/><path d="M12 9v4" stroke-linecap="round"/></svg>',
    inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 14l2-8h12l2 8v5H4z"/><path d="M4 14h5l1 2h4l1-2h5"/></svg>',
    distance: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h18M6 9l-3 3 3 3M18 9l3 3-3 3"/></svg>',
    lane: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="6" rx="1"/><rect x="3" y="13" width="18" height="6" rx="1" stroke-dasharray="3 2"/></svg>',
    text: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 6h14M12 6v13"/></svg>',
    legend: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5" stroke-linecap="round"/></svg>',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8.5 9h3l1.5 3-1.5 1a5 5 0 002.5 2.5l1-1.5 3 1.5v2a1.5 1.5 0 01-1.5 1.5A9 9 0 018.5 10.5 1.5 1.5 0 018.5 9z"/></svg>',
    face: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M8.5 14.5q3.5 3 7 0"/><circle cx="9" cy="9.5" r=".9" fill="currentColor"/><circle cx="15" cy="9.5" r=".9" fill="currentColor"/></svg>',
    more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="6" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="12" r="2"/></svg>'
  };
  // Seleziona e Mano non sono nella barra: col dito si seleziona toccando e si sposta il foglio trascinando
  // il vuoto, quindi erano due bottoni che non facevano nulla di nuovo. Matita e Gomma invece restano:
  // col dito non c'e' modo di distinguere "disegno" da "trascino" senza un interruttore (con la penna parte da se').
  const MAIN_TOOLS = [['box', 'Process box (B)'], ['delta', 'Delta / attesa (D)'], ['flow', 'Freccia di flusso (F)'], ['request', 'Via di richiesta (R)'], ['person', 'Persona / richiedente (O)'], ['storm', 'Nuvola temporalesca (N)'], null, ['ink', 'Matita (P)'], ['eraser', 'Gomma (E)'], null, ['more', 'Altri elementi del libro']];
  const MORE_TOOLS = [['fluffy', 'Nuvola soffice'], ['burst', 'Kaizen burst'], ['face', 'Faccia (esperienza)'], ['icon', 'Icona (canale, mezzo, documento…)'], ['inventory', 'Scorta'], ['inbox', 'In-box / attesa'], ['distance', 'Distanza'], ['lane', 'Corsia (reparto)'], ['text', 'Testo'], ['legend', 'Legenda']];
  const INK_COLORS = [['#2b2b2b', 'grafite'], ['#c8321e', 'rosso'], ['#1f4e79', 'blu'], ['#3f7d5a', 'verde']];

  UI.buildPalette = () => {
    const pal = $('#palette'); pal.innerHTML = '';
    const SHORT = { select: 'Seleziona', pan: 'Mano', ink: 'Matita', eraser: 'Gomma', box: 'Passo', delta: 'Attesa', flow: 'Flusso', request: 'Richiesta', person: 'Persona', storm: 'Problema', more: 'Altro' };
    // "✓ Fine" compare solo quando uno strumento e' attivo: e' l'uscita, al posto del vecchio tasto Seleziona
    const done = document.createElement('button');
    done.className = 'tool done hidden'; done.id = 'tool-done'; done.title = 'Torna a selezionare (Esc)';
    done.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 7"/></svg><span class="lbl">Fine</span>';
    done.onclick = () => { $('#more-tools').classList.add('hidden'); I.setTool('select'); };
    pal.appendChild(done);
    MAIN_TOOLS.forEach(t => { if (!t) { const s = document.createElement('div'); s.className = 'sep'; pal.appendChild(s); return; } const b = document.createElement('button'); b.className = 'tool'; b.dataset.tool = t[0]; b.title = t[1]; b.setAttribute('aria-label', t[1]); b.innerHTML = IC[t[0]] + `<span class="lbl">${SHORT[t[0]]}</span>`; b.onclick = () => { if (t[0] === 'more') { $('#more-tools').classList.toggle('hidden'); return; } $('#more-tools').classList.add('hidden'); if (t[0] === 'ink' && I.tool === 'ink') { UI.inkOptions(); return; } if (I.tool === t[0]) { I.setTool('select'); return; } I.setTool(t[0]); }; pal.appendChild(b); });
    const more = $('#more-tools'); more.innerHTML = '';
    MORE_TOOLS.forEach(t => { const b = document.createElement('button'); b.className = 'tool'; b.dataset.tool = t[0]; b.innerHTML = IC[t[0]] + '<span>' + t[1] + '</span>'; b.onclick = () => { I.setTool(t[0]); more.classList.add('hidden'); }; more.appendChild(b); });
    UI.onTool(I.tool);
  };
  UI.onTool = (t) => {
    $$('#palette .tool, #more-tools .tool').forEach(b => b.setAttribute('aria-pressed', b.dataset.tool === t));
    const dn = $('#tool-done'); if (dn) dn.classList.toggle('hidden', t === 'select');
    if (MORE_TOOLS.some(x => x[0] === t)) $('#palette [data-tool="more"]').setAttribute('aria-pressed', 'true');
    const hints = { ink: 'Matita attiva: tieni premuto e trascina sul foglio per tracciare (dito, mouse o penna). Tocca di nuovo la matita per colore e spessore; ✓ Fine per finire.', eraser: 'Gomma attiva: passa sui tratti da cancellare.', box: 'Passo: tocca il foglio dove vuoi il process box (o trascina per la dimensione).', delta: 'Attesa: tocca vicino a una freccia di flusso — il delta si aggancia ed entra nella timeline.', flow: 'Flusso: tieni premuto su un box e trascina fino al box successivo.', request: 'Richiesta: tieni premuto sull\'omino e trascina fino al primo passo; una freccia per ogni via reale.', person: 'Persona: tocca il foglio — il primo omino è il richiedente (in alto a destra).', storm: 'Problema: tocca dove sta il problema. Che cosa non è ideale?', fluffy: 'Nuvola soffice: tocca dove va l\'idea o la cosa che funziona.', burst: 'Kaizen: tocca dove va il candidato a progetto.', inventory: 'Scorta: tocca dove sta la scorta.', inbox: 'In-box/attesa: tocca dove aspetta l\'informazione o la persona.', distance: 'Distanza: tocca dove segnare i metri percorsi.', lane: 'Corsia: trascina per una fascia orizzontale (un reparto).', text: 'Testo: tocca per una nota.', icon: 'Icona: tocca dove metterla (su un passo o una freccia si blocca da sola), poi scegli il simbolo.', face: 'Faccia: tocca dove sta chi vive quel momento (paziente, operatore) e scegli l\'espressione.', legend: 'Legenda: tocca dove metterla (di solito in alto a sinistra).', pan: 'Mano: trascina per spostare il foglio; pinch (o Ctrl+rotella) per lo zoom.', select: '' };
    if (hints[t]) I.hint(hints[t], 0); else I.hint('');
    UI.hideSuggestIfTool(t);
  };
  /** Trascinato un flusso o una richiesta nel vuoto: invece di far sparire il gesto, si propone qui
   *  l'elemento di arrivo. Sceglierne uno lo crea sul punto gia' collegato; toccare fuori annulla tutto. */
  const PLACE_KINDS = { flow: ['box', 'inventory', 'inbox'], request: ['box', 'person'] };
  const PLACE_LBL = { box: 'Passo', inventory: 'Scorta', inbox: 'In-box', person: 'Persona' };
  UI.closePlaceMenu = () => { const m = $('#placemenu'); if (!m) return false; m.remove(); document.removeEventListener('pointerdown', UI._pmAway, true); return true; };
  UI.proposePlace = (clientX, clientY, ctype, fromId, w) => {
    UI.closePlaceMenu();
    const stage = $('#stage'); const r = stage.getBoundingClientRect();
    const kinds = PLACE_KINDS[ctype] || ['box'];
    const m = document.createElement('div'); m.id = 'placemenu'; m.className = 'placemenu';
    m.style.left = Math.min(Math.max(clientX - r.left, 78), r.width - 78) + 'px';
    m.style.top = Math.min(Math.max(clientY - r.top, 78), r.height - 78) + 'px';
    const n = kinds.length, RAD = 66;
    m.innerHTML = '<span class="pm-dot"></span>' + kinds.map((k, i) => {
      const a = -Math.PI / 2 + (i - (n - 1) / 2) * (Math.PI / 2.6);
      const x = Math.round(Math.cos(a) * RAD), y = Math.round(Math.sin(a) * RAD);
      return `<button class="pm-btn" data-kind="${k}" style="left:${x}px;top:${y}px" title="${V.TYPES[k].name} collegato">${IC[k] || ''}<span>${PLACE_LBL[k] || k}</span></button>`;
    }).join('');
    stage.appendChild(m);
    $$('.pm-btn', m).forEach(b => b.onclick = (ev) => { ev.stopPropagation(); const k = b.dataset.kind; UI.closePlaceMenu(); I.placeAndConnect(k, w, fromId, ctype); });
    // un tocco fuori dal menu annulla: niente elemento, niente freccia
    // Chiudere il menu non deve mangiarsi il tocco: se si tocca un comando (✓ Fine, Annulla, il cassetto)
    // quel tocco deve arrivare a destinazione. Si blocca solo quando il dito finisce sul foglio, dove
    // altrimenti partirebbe subito un altro gesto.
    UI._pmAway = (ev) => {
      if (ev.target.closest && ev.target.closest('#placemenu')) return;
      UI.closePlaceMenu();
      if (ev.target.closest && ev.target.closest('#canvas')) { ev.stopPropagation(); ev.preventDefault(); }
    };
    setTimeout(() => document.addEventListener('pointerdown', UI._pmAway, true), 0);
    I.hint("Scegli che cosa mettere qui: nasce gia' collegato. Tocca fuori per annullare.", 4000);
  };

  UI.inkOptions = () => { const p = $('#pop'); p.innerHTML = `<div class="pop-head"><b>Matita</b><button class="btn small ghost" id="pop-x" aria-label="Chiudi">✕</button></div><div class="actions">${INK_COLORS.map(c => `<button class="btn small" data-c="${c[0]}" style="border-color:${c[0]};${I.ink.color === c[0] ? 'background:' + c[0] + ';color:#fff' : ''}">${c[1]}</button>`).join('')}</div><div class="actions">${[1.2, 1.8, 3].map(w => `<button class="btn small" data-w="${w}" ${I.ink.width === w ? 'style="border-color:var(--accent);color:var(--accent)"' : ''}>${w === 1.2 ? 'sottile' : w === 1.8 ? 'media' : 'spessa'}</button>`).join('')}</div>`; p.classList.remove('hidden'); const st = $('#stage').getBoundingClientRect(); p.style.left = Math.max(10, st.width / 2 - 100) + 'px'; p.style.top = (st.height - 200) + 'px'; $$('[data-c]', p).forEach(b => b.onclick = () => { I.ink.color = b.dataset.c; UI.inkOptions(); }); $$('[data-w]', p).forEach(b => b.onclick = () => { I.ink.width = +b.dataset.w; UI.inkOptions(); }); $('#pop-x').onclick = () => V.pop.close(); };

  // ---------- popover degli elementi ----------
  const P = V.pop = {};
  let fid = 0;
  const field = (label, html, hint) => { const id = 'f' + (++fid); html = html.replace(/^<(input|select|textarea)\b/, `<$1 id="${id}"`); return `<div class="field"><label for="${id}">${label}</label>${html}${hint ? `<span class="hint">${hint}</span>` : ''}</div>`; };
  const inp = (k, v, attrs = '') => `<input data-k="${k}" value="${esc(v)}" autocomplete="off" ${attrs}>`;
  const ta = (k, v, attrs = '') => `<textarea data-k="${k}" ${attrs}>${esc(v)}</textarea>`;
  const sel = (k, v, opts) => `<select data-k="${k}">${opts.map(o => `<option value="${esc(o)}" ${o === v ? 'selected' : ''}>${esc(o || '—')}</option>`).join('')}</select>`;
  const chk = (k, v, label) => `<label class="check"><input type="checkbox" data-k="${k}" ${v ? 'checked' : ''}> <span>${label}</span></label>`;
  const selOv = (k, v, opts) => `<select data-ov="${k}">${opts.map(o => `<option value="${esc(o.id)}" ${o.id === v ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select>`;
  /** Eccezione dichiarata all'aspetto di un collegamento: di regola il tratto viene dal significato (canale o
      stile), qui si può forzare per questa freccia sola — serve in riunione ("guarda questa"), ma resta
      un'eccezione visibile, segnalata nel pop-up e contata in legenda. */
  const lookFields = (el) => {
    const ov = el.props.override || {}, custom = !!(ov.stroke || ov.dash || ov.width);
    const spiega = el.type === 'request'
      ? 'Di regola lo decide il canale: colore = canale, tratto = famiglia (a voce, elettronica, cartacea).'
      : 'Di regola lo decide lo stile: informazione tratteggiata, materiale/paziente spessa.';
    return `<div class="hint" style="margin:2px 0 6px">${spiega} Qui puoi forzarlo per questa freccia soltanto.</div>`
      + `<div class="row">${field('Colore', selOv('stroke', ov.stroke || '', V.INK_COLORS))}${field('Tratto', selOv('dash', ov.dash || '', V.INK_DASHES))}${field('Spessore', selOv('width', ov.width || '', [{ id: '', name: 'dal significato' }, { id: '1.3', name: 'sottile' }, { id: '2', name: 'medio' }, { id: '3', name: 'spesso' }]))}</div>`
      + (custom ? `<div class="hint lockrow">✱ Aspetto scelto a mano: sul foglio non lo spiega più la legenda. <button class="btn small" id="pop-ov-reset">Torna al significato</button></div>` : '');
  };
  /** griglia di facce (espressioni) — selezione visiva; data-k = mood */
  const facePicker = (cur) => `<div class="picker faces" role="radiogroup" aria-label="Espressione">${V.MOODS.map(m => `<button type="button" class="pick ${m === cur ? 'on' : ''}" data-pick="mood" data-v="${esc(m)}" role="radio" aria-checked="${m === cur}" title="${esc(V.MOOD_MEANING[m] || m)}"><svg viewBox="0 0 30 30" aria-hidden="true"><g class="pencil">${R.face(m, 15, 15, 12)}</g></svg><span>${esc(m)}</span></button>`).join('')}</div><div class="hint" data-mood-mean>${esc(V.MOOD_MEANING[cur] || '')}</div>`;
  /** griglia di icone per gruppo */
  const iconPicker = (cur) => Object.entries(R.ICONS).map(([g, icons]) => `<div class="pick-group">${esc(g)}</div><div class="picker icons">${Object.keys(icons).map(n => `<button type="button" class="pick ${n === cur ? 'on' : ''}" data-pick="icon" data-v="${esc(n)}" title="${esc(n)}" aria-pressed="${n === cur}"><svg viewBox="0 0 24 24" aria-hidden="true">${R.iconSVG(n, 12, 12, 0.85)}</svg><span>${esc(n)}</span></button>`).join('')}</div>`).join('');
  const dataRow = (p) => `<div class="row3">${field('Hi', inp('hi', p.hi, 'inputmode="decimal" placeholder="max"'))}${field('Lo', inp('lo', p.lo, 'inputmode="decimal" placeholder="min"'))}${field('Avg', inp('avg', p.avg, 'inputmode="decimal" placeholder="media"'))}</div>`;
  const mapOptions = (excludeId) => Object.values(V.doc.maps).filter(m => m.id !== excludeId).map(m => ({ id: m.id, label: (m.title || 'senza titolo') + ' · ' + m.kind }));

  P.close = () => { const pop = $('#pop'); const was = !pop.classList.contains('hidden'); pop.classList.add('hidden'); pop.classList.remove('sheet'); P.current = null; if (was && I.selection.length && UI.onSelection) UI.onSelection(I.selection); };
  /** rettangolo a schermo dell'elemento, allargato a maniglie e badge (px dello stage) */
  const elScreenRect = (el, map) => {
    if (V.isConnector(el)) { const Pc = R.connPath(el, map); const m = I.toScreen(Pc.mid.x, Pc.mid.y); return { x1: m.x - 34, y1: m.y - 34, x2: m.x + 34, y2: m.y + 44 }; } // attorno all'icona/punto centrale (la linea è sottile)
    const pos = R.elPos(el, map); const sz = R.elSize(el); const s1 = I.toScreen(pos.x, pos.y), s2 = I.toScreen(pos.x + sz.w, pos.y + sz.h); const k = I.view.k;
    return { x1: s1.x - 22, y1: s1.y - 26, x2: s2.x + 20, y2: s2.y + 20 + (el.type === 'box' ? 60 * k : el.type === 'delta' ? 40 * k : 24 * k) };
  };
  /** posiziona il pop-up accanto all'elemento senza coprirlo (né le maniglie, né la barra rapida): destra → sinistra → sotto → sopra; su schermi stretti diventa un foglio dal basso */
  /** margine sinistro libero dentro lo stage: con gli strumenti in colonna, niente deve finirci sopra */
  UI.leftInset = () => {
    const app = $('#app'), p = $('#palette'), stEl = $('#stage');
    if (!app.classList.contains('tools-left') || app.classList.contains('clean') || !p || !stEl) return 10;
    const r = p.getBoundingClientRect(), st = stEl.getBoundingClientRect();
    if (!r.width) return 10;
    return Math.round(r.right - st.left) + 10;
  };
  P.place = (el) => {
    const pop = $('#pop'); const st = $('#stage').getBoundingClientRect(); const map = V.map();
    if (st.width < 640) { pop.classList.add('sheet'); pop.style.left = ''; pop.style.top = ''; return; }
    pop.classList.remove('sheet');
    const r = elScreenRect(el, map); const pw = Math.min(pop.offsetWidth || 330, st.width - 20), ph = Math.min(pop.offsetHeight || 380, st.height - 20); const gap = 14, m = 10, mL = UI.leftInset();
    const q = $('#quick'); const qr = q && !q.classList.contains('hidden') ? { x1: q.offsetLeft, y1: q.offsetTop, x2: q.offsetLeft + q.offsetWidth, y2: q.offsetTop + q.offsetHeight } : null;
    const clampY = (y) => Math.max(m, Math.min(st.height - ph - m, y)); const clampX = (x) => Math.max(mL, Math.min(st.width - pw - m, x));
    const overlaps = (x, y, box) => box && x < box.x2 && x + pw > box.x1 && y < box.y2 && y + ph > box.y1;
    const cands = [
      { x: r.x2 + gap, y: clampY(r.y1 + 26) },            // destra, allineato in alto
      { x: r.x1 - gap - pw, y: clampY(r.y1 + 26) },       // sinistra
      { x: clampX(r.x1), y: r.y2 + gap },                 // sotto
      { x: clampX(r.x1), y: r.y1 - gap - ph }             // sopra
    ];
    let best = null;
    const fits = (c) => c.x >= mL && c.x + pw <= st.width - m && c.y >= m && c.y + ph <= st.height - m;
    for (const c of cands) { if (!fits(c)) continue; if (overlaps(c.x, c.y, r)) continue; if (overlaps(c.x, c.y, qr)) continue; best = c; break; }
    if (!best) { for (const c of cands) { if (!fits(c)) continue; if (overlaps(c.x, c.y, r)) continue; best = c; break; } }
    if (!best) { // niente spazio libero: mettilo dal lato con più spazio, dentro lo stage
      const right = st.width - r.x2, left = r.x1 - mL; best = right >= left ? { x: clampX(r.x2 + gap), y: clampY(r.y1) } : { x: clampX(r.x1 - gap - pw), y: clampY(r.y1) };
    }
    pop.style.left = Math.round(best.x) + 'px'; pop.style.top = Math.round(best.y) + 'px';
  };
  /** anteprima dell'elemento (stesso glifo del foglio) */
  const preview = (el, map) => {
    if (V.isConnector(el)) { const p = el.props; const dash = el.type === 'flow' && p.style === 'info' ? 'stroke-dasharray="6 5"' : el.type === 'flow' && p.style === 'material' ? 'stroke-width="2.6"' : ''; const d = el.type === 'request' ? 'M40 6 C 26 4, 16 8, 6 22' : 'M4 14 H40'; const hd = el.type === 'request' ? '<path d="M2 24 L11 21 L7 15 z" fill="#2b2b2b"/>' : '<path d="M34 10 L44 14 L34 18 z" fill="#2b2b2b"/>'; return `<svg class="pop-preview" viewBox="-2 -2 50 30" aria-hidden="true"><path class="pencil" d="${d}" ${dash}/>${hd}${el.type === 'request' ? `<circle class="chan" cx="24" cy="8" r="7"/>${R.chanIcon(p.channel, 24, 8, 0.45)}` : ''}</svg>`; }
    const pad = 6; const extra = { box: 44, delta: 22, person: 14, inventory: 14, inbox: 12, icon: 14, face: 14, distance: 8, storm: 12, burst: 12 }[el.type] || 6;
    return `<svg class="pop-preview" viewBox="${-pad} ${-pad} ${el.w + pad * 2} ${el.h + pad + extra}" aria-hidden="true"><g class="el">${R.drawEl(el)}</g></svg>`;
  };
  const subtitleOf = (el, map) => {
    const p = el.props;
    switch (el.type) {
      case 'box': return p.title || 'senza titolo';
      case 'delta': { const c = p.attachedTo ? V.byId(p.attachedTo, map) : null; return c ? `sulla freccia ${V.byId(c.from.el, map)?.props.title || '?'} → ${V.byId(c.to.el, map)?.props.title || '?'}` : 'non agganciato a una freccia'; }
      case 'person': return [p.label, p.role].filter(Boolean).join(' · ') || (p.requestor ? 'richiedente' : 'persona');
      case 'flow': return `${V.byId(el.from.el, map)?.props.title || (el.from.el ? '?' : 'staccata')} → ${V.byId(el.to.el, map)?.props.title || (el.to.el ? '?' : 'staccata')}`;
      case 'request': return `${p.channel}${p.to ? ' → ' + p.to : ''}`;
      case 'face': return [p.who, p.mood].filter(Boolean).join(' · ');
      case 'icon': return p.label || p.icon;
      case 'lane': return p.name || '';
      default: return (p.text || p.what || '').slice(0, 60);
    }
  };
  P.open = (id) => {
    const map = V.map(); const el = V.byId(id, map); if (!el) return; P.current = id;
    const T = V.TYPES[el.type]; const p = el.props;
    let h = `<div class="pop-head">${preview(el, map)}<div class="pop-title"><b>${T.name}</b><div class="pop-sub">${esc(subtitleOf(el, map))}</div></div><button class="btn small ghost" id="pop-why" title="Perché / cos'è (dal libro)" aria-label="Spiegazione dal libro" aria-expanded="false">?</button><button class="btn small ghost" id="pop-x" aria-label="Chiudi">✕</button></div><div class="why hidden" id="pop-whytext">${esc(T.why)}</div>`;
    let main = '', adv = '';
    switch (el.type) {
      case 'box': main += field('Titolo del passo', inp('title', p.title, 'placeholder="es. Accettazione" autofocus')) + `<div class="hint" style="margin:-4px 0 6px">Tempi (${esc(map.unit)}) dalla prima all'ultima attività</div>` + dataRow(p) + field('Attività dentro il box (una per riga, in ordine)', ta('activities', (p.activities || []).join('\n'), 'data-lines placeholder="prima attività (apre la porta)\n…\nultima attività (chiude la porta)"'));
        adv += `<div class="row">${field('Correct & Complete %', inp('cc', p.cc, 'inputmode="decimal" placeholder="es. 90"'))}${field('Chi / reparto', inp('owner', p.owner))}</div>`; break;
      case 'delta': { const c = p.attachedTo ? V.byId(p.attachedTo, map) : null; if (!c) main += `<div class="hint" style="margin-bottom:6px">Non agganciato a una freccia: conta nel totale NVA ma non nella timeline. Trascinalo vicino a una freccia o usa "Aggancia".</div>`; main += `<div class="hint" style="margin:0 0 6px">Attesa (${esc(map.unit)}) per differenza: fine box precedente → inizio successivo</div>` + dataRow(p) + field('Dove / perché sta ferma', inp('note', p.note, 'placeholder="richiesta nel vassoio; attesa del trasportatore…"')); adv += field('Tipo di attesa (cambia il glifo)', sel('kind', p.kind, V.DELTA_KINDS)); break; }
      case 'person': main += field('Nome / etichetta', inp('label', p.label)) + `<div class="field"><label>Espressione (come vive questo momento)</label>${facePicker(p.mood)}</div>` + chk('requestor', p.requestor, 'È il richiedente (origina la richiesta)'); adv += field('Ruolo', inp('role', p.role, 'placeholder="paziente, medico di reparto, segretaria…"')); break;
      case 'face': main += `<div class="field"><label>Espressione</label>${facePicker(p.mood)}</div>` + `<div class="row">${field('Di chi', sel('who', p.who, ['paziente', 'operatore', 'famigliare', 'medico', 'infermiere', 'segreteria', '']))}${field('Etichetta (opzionale)', inp('label', p.label, 'placeholder="es. dopo 40 min di attesa"'))}</div>`; break;
      case 'icon': main += `<div class="field"><label>Simbolo</label>${iconPicker(p.icon)}</div>`; adv += field('Etichetta', inp('label', p.label, 'placeholder="es. fax al laboratorio"')); break;
      case 'storm': main += field('Problema (di processo, non di persone)', ta('text', p.text, 'placeholder="che cosa non è ideale qui?" autofocus')) + `<div class="row">${field('Muda', sel('muda', p.muda, ['', ...V.MUDA]))}${field('Regola violata', sel('rule', p.rule, ['', ...V.RULES]))}</div>`; adv += chk('a3', p.a3, 'Candidato ad A3 (5 perché → contromisure → test → follow-up)'); break;
      case 'fluffy': main += field('Idea / cosa funziona', ta('text', p.text, 'autofocus')); break;
      case 'burst': main += field('Cosa migliorare', ta('text', p.text, 'autofocus')) + `<div class="row">${field('Priorità', sel('priority', p.priority, ['alta', 'media', 'bassa']))}${field('Owner', inp('owner', p.owner))}</div>`; break;
      case 'inventory': main += field('Cosa', inp('what', p.what)) + `<div class="row">${field('Quantità', inp('qty', p.qty, 'inputmode="decimal"'))}${field('Giorni di copertura', inp('days', p.days, 'inputmode="decimal"'))}</div>`; break;
      case 'inbox': main += `<div class="row">${field('Tipo', sel('kind', p.kind, ['in-box', 'orologio', 'coda']))}${field('Attesa media', inp('avg', p.avg, 'inputmode="decimal"'))}</div>`; break;
      case 'distance': main += `<div class="row">${field('Metri', inp('meters', p.meters, 'inputmode="decimal"'))}</div>`; adv += `<div class="row">${field('Da', inp('from', p.from))}${field('A', inp('to', p.to))}</div>`; break;
      case 'lane': main += field('Reparto / corsia', inp('name', p.name, 'autofocus')); adv += field('Colore (opzionale, es. #1f4e79)', inp('color', p.color)); break;
      case 'text': main += field('Testo', ta('text', p.text, 'autofocus')); adv += field('Dimensione', sel('size', String(p.size), ['10', '12', '14', '18', '24'])); break;
      case 'legend': main += `<div class="hint">Legenda compatta per la stampa: spostala in alto a sinistra. La legenda completa (tutti i simboli, varianti, significato) è nel cassetto.</div>`; break;
      case 'flow': adv += field('Etichetta (opzionale)', inp('label', p.label)) + field('Stile', sel('style', p.style, ['solid', 'info', 'material']), 'solid = flusso; info = tratteggiata (informazione); material = spessa (materiale/paziente)') + chk('or', p.or, '"or" — alternativa a un altro passo'); main += `<div class="hint">Per staccare o spostare un capo: trascina il cerchio all'estremità della freccia.</div>`; break;
      case 'request': main += field('Canale (una freccia per ogni via reale)', sel('channel', p.channel, V.CHANNELS)) + field('Verso chi', inp('to', p.to, 'placeholder="segreteria, laboratorio…"')); adv += `<div class="row">${field('Quante mani tocca', inp('hands', p.hands, 'inputmode="numeric"'))}</div>` + field('Nota (cosa si perde, quando)', inp('note', p.note)); break;
    }
    if (V.isConnector(el)) adv += lookFields(el);
    // stato di blocco (sempre visibile, una riga)
    if (!V.isConnector(el)) {
      const lk = el.props.lockTo || (el.type === 'delta' && el.props.attachedTo); const lpar = lk ? V.byId(lk, map) : null;
      if (lpar) main += `<div class="hint lockrow">🔒 Bloccato a <b>${esc(lpar.props.title || lpar.props.label || lpar.props.name || V.TYPES[lpar.type].name)}</b>: si muove con lui.</div>`;
      else if (R.LOCKABLE.includes(el.type) && el.type !== 'delta' && el.type !== 'box' && el.type !== 'person') main += `<div class="hint lockrow">🔓 Libero: lascialo cadere su un passo o vicino a una freccia per bloccarlo.</div>`;
      const opts = mapOptions(map.id);
      adv += field('Collega a un\'altra mappa (dettaglio, turno, futuro)', `<select data-k="link"><option value="">— nessuna —</option>${opts.map(o => `<option value="${o.id}" ${p.link === o.id ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}<option value="__new__">+ nuova mappa di dettaglio…</option></select>`);
      if (p.link && V.doc.maps[p.link]) main += `<div class="actions"><button class="btn small primary" id="pop-openlink">Apri la mappa collegata ↗</button></div>`;
    }
    const CONVERT = { storm: ['fluffy', 'burst', 'text'], fluffy: ['storm', 'burst', 'text'], burst: ['storm', 'fluffy', 'text'], text: ['storm', 'fluffy', 'burst'], inbox: ['delta', 'inventory'], inventory: ['inbox'] };
    if (CONVERT[el.type]) adv += field('Trasforma in…', `<select data-convert><option value="">— tipo attuale: ${T.name} —</option>${CONVERT[el.type].map(t => `<option value="${t}">${V.TYPES[t].name}</option>`).join('')}</select>`, 'Il testo e la posizione restano; cambia il disegno.');
    h += main;
    if (adv) h += `<details class="adv"><summary>Altre opzioni</summary>${adv}</details>`;
    // azioni: le stesse della barra rapida (senza "Dettagli"), più quelle proprie del pop-up
    const acts = UI.actionList(el, map);
    let extra = ''; if (el.type === 'burst') extra += '<button class="btn small" id="pop-toplan">→ Aggiungi al piano</button>'; if (el.type === 'legend') extra += '<button class="btn small" id="pop-legendfull">Legenda completa</button>';
    h += `<div class="actions pop-actions">${extra}${acts.map(a => `<button class="btn small ${a.id === 'del' ? 'danger' : ''}" data-pa="${a.id}" title="${esc(a.title)}">${a.label}</button>`).join('')}</div>`;
    UI.hideQuick(); // il pop-up contiene le stesse azioni della barra rapida
    const pop = $('#pop'); pop.innerHTML = h; pop.classList.remove('hidden'); P.place(el);
    $('#pop-x').onclick = P.close; $('#pop-why').onclick = () => { const w = $('#pop-whytext'); w.classList.toggle('hidden'); $('#pop-why').setAttribute('aria-expanded', !w.classList.contains('hidden')); };
    $$('[data-pa]', pop).forEach(b => b.onclick = () => { const a = b.dataset.pa; if (['dup', 'del', 'connect', 'reqtool', 'lockto', 'lockall'].includes(a)) P.close(); UI.quickAction(a, id); if (['invert', 'attach', 'unlock', 'legend'].includes(a) && V.byId(id)) P.open(id); });
    const tp = $('#pop-toplan'); if (tp) tp.onclick = () => { const plan = clone(map.plan); plan.push({ id: uid(), what: p.text || 'kaizen', who: p.owner || '', when: '', outcome: '', a3: true }); V.commit({ t: 'plan_set', after: plan }, 'piano'); UI.toast('Aggiunto al piano.'); UI.renderPlan(); };
    const ol = $('#pop-openlink'); if (ol) ol.onclick = () => UI.openMap(p.link);
    const lf = $('#pop-legendfull'); if (lf) lf.onclick = () => UI.showTab('legend');
    const cv = $('[data-convert]', pop); if (cv) cv.onchange = () => { const t = cv.value; if (!t) return; const before = clone(el); const T2 = V.TYPES[t]; const text = p.text || p.what || p.note || ''; const nprops = Object.assign(clone(T2.props), t === 'text' || t === 'storm' || t === 'fluffy' || t === 'burst' ? { text } : t === 'inventory' ? { what: text } : t === 'delta' ? { note: text, avg: p.avg || '' } : {}); if (p.link) nprops.link = p.link; const after = { type: t, w: T2.w, h: T2.h, props: nprops }; V.commit({ t: 'update', id, after, before: { type: before.type, w: before.w, h: before.h, props: before.props } }, 'trasforma'); P.open(id); };
    // aspetto forzato a mano: si scrive tutto insieme in props.override (assente = derivato dal significato)
    const applyOv = (o) => {
      const before = clone(V.byId(id).props.override) || null;
      const after = (o && (o.stroke || o.dash || o.width)) ? o : null;
      V.commit({ t: 'props', id, after: { override: after }, before: { override: before } }, 'aspetto del collegamento');
      P.open(id);
    };
    if ($('[data-ov]', pop)) {
      const readOv = () => { const o = {}; $$('[data-ov]', pop).forEach(s2 => { if (s2.value) o[s2.dataset.ov] = s2.value; }); return o; };
      $$('[data-ov]', pop).forEach(s2 => { s2.onchange = () => applyOv(readOv()); });
      const rs = $('#pop-ov-reset'); if (rs) rs.onclick = () => applyOv(null);
    }
    // binding campi
    $$('[data-k]', pop).forEach(inpEl => {
      const k = inpEl.dataset.k; let before;
      const val = () => { let v; if (inpEl.type === 'checkbox') v = inpEl.checked; else if (inpEl.dataset.lines != null) v = inpEl.value.split('\n').map(s => s.trim()).filter(Boolean); else v = inpEl.value; if (k === 'size') v = +v; return v; };
      const handler = (final) => {
        const v = val();
        if (k === 'link' && v === '__new__') { const d = V.createDetail(map, (p.title || p.text || 'dettaglio')); V.commit({ t: 'props', id, after: { link: d.id } }, 'collega mappa'); UI.toast('Mappa di dettaglio creata: apri con ↗'); P.open(id); return; }
        const cur = V.byId(id); if (!cur) return;
        if (!final) { V.commit({ t: 'props', id, after: { [k]: v } }, 'modifica', { silent: true }); return; } // anteprima: nessuna voce di undo
        // una sola voce di undo per campo (dal focus al cambio)
        V.commit({ t: 'props', id, after: { [k]: v }, before: { [k]: before === undefined ? cur.props[k] : before } }, 'modifica');
        before = undefined;
        if (k === 'link') P.open(id);
      };
      inpEl.addEventListener('focus', () => { const cur = V.byId(id); before = cur ? clone(cur.props[k]) : undefined; });
      if (inpEl.tagName === 'SELECT' || inpEl.type === 'checkbox') inpEl.addEventListener('change', () => handler(true));
      else { inpEl.addEventListener('input', () => handler(false)); inpEl.addEventListener('change', () => handler(true)); }
    });
    $$('[data-pick]', pop).forEach(b => b.onclick = () => { const k = b.dataset.pick, v = b.dataset.v; const cur = V.byId(id); if (!cur || cur.props[k] === v) return; V.commit({ t: 'props', id, after: { [k]: v } }, k === 'mood' ? 'espressione' : 'icona'); $$(`[data-pick="${k}"]`, pop).forEach(x => { const on = x.dataset.v === v; x.classList.toggle('on', on); x.setAttribute(x.hasAttribute('role') ? 'aria-checked' : 'aria-pressed', on); }); const mm = $('[data-mood-mean]', pop); if (mm && k === 'mood') mm.textContent = V.MOOD_MEANING[v] || ''; });
    const af = pop.querySelector('[autofocus]'); if (af && !('ontouchstart' in window)) af.focus();
  };
  /** aggiorna anteprima e sottotitolo del pop-up aperto (dopo una modifica ai campi) */
  P.refresh = (id) => { const pop = $('#pop'); if (pop.classList.contains('hidden') || P.current !== id) return; const map = V.map(); const el = V.byId(id, map); if (!el) return; const pv = $('.pop-preview', pop); if (pv) pv.outerHTML = preview(el, map); const sb = $('.pop-sub', pop); if (sb) sb.textContent = subtitleOf(el, map); };
  P.openTitle = () => {
    const map = V.map(); const pop = $('#pop'); P.current = '__title__';
    pop.innerHTML = `<div class="pop-head"><b>Titolo, data, autori</b><button class="btn small ghost" id="pop-x" aria-label="Chiudi">✕</button></div><div class="why">In alto a destra: titolo, data e iniziali di chi ha disegnato. Con la piega a metà e a un quarto restano visibili nel raccoglitore.</div>
      ${field('Titolo', `<input data-m="title" value="${esc(map.title)}" autofocus>`)}<div class="row">${field('Data', `<input data-m="date" type="date" value="${esc(map.date)}">`)}${field('Iniziali autori', `<input data-m="authors" value="${esc(map.authors)}">`)}</div>${field('Reparto / unità', `<input data-m="unitName" value="${esc(map.unitName)}">`)}${field('Scopo in una frase', `<textarea data-m="scope" placeholder="Dalla richiesta di … alla consegna di …">${esc(map.scope)}</textarea>`)}<div class="row">${field('Unità di misura (unica)', `<select data-m="unit">${['secondi', 'minuti', 'ore', 'giorni'].map(u => `<option ${u === map.unit ? 'selected' : ''}>${u}</option>`).join('')}</select>`)}${field('N. misure', `<input data-m="samples" inputmode="numeric" value="${esc(map.samples)}">`)}</div>`;
    pop.classList.remove('hidden'); const st = $('#stage').getBoundingClientRect(); const s = I.toScreen(V.paperOf(map).w - 470, 90); pop.style.left = Math.max(10, Math.min(st.width - 340, s.x)) + 'px'; pop.style.top = Math.max(10, s.y + 6) + 'px';
    $('#pop-x').onclick = P.close;
    $$('[data-m]', pop).forEach(e => {
      const k = e.dataset.m; let before;
      const commit = (final) => { if (!final) { V.commit({ t: 'meta', after: { [k]: e.value } }, 'intestazione', { silent: true }); return; } V.commit({ t: 'meta', after: { [k]: e.value }, before: { [k]: before === undefined ? V.map()[k] : before } }, 'intestazione'); before = undefined; };
      e.addEventListener('focus', () => { before = V.map()[k]; });
      if (e.tagName === 'SELECT') e.addEventListener('change', () => commit(true));
      else { e.addEventListener('input', () => commit(false)); e.addEventListener('change', () => commit(true)); }
    });
  };

  // ---------- header / mappe ----------
  UI.openMap = (id) => {
    // niente modalita' appese sulla mappa nuova: il primo tocco li' deve funzionare
    if (I.pickConn) I.cancelPickConnect(); if (I.pickLock) I.cancelPickLock(); UI.closePlaceMenu(); if (!V.doc.maps[id]) { UI.toast('Mappa non trovata.'); return; } P.close(); I.select([]); V.switchMap(id); I.restoreView(); };
  UI.renderHeader = () => {
    const map = V.map(); $('#map-title').value = map.title || ''; const k = $('#map-kind'); k.textContent = map.kind === 'future' ? 'stato futuro' : map.kind === 'detail' ? 'dettaglio' : 'stato attuale'; k.className = map.kind;
    $('#tab-current').setAttribute('aria-pressed', map.kind === 'current'); $('#tab-future').setAttribute('aria-pressed', map.kind === 'future');
    const crumbs = []; let m = map; let guard = 0; while (m && m.parentId && V.doc.maps[m.parentId] && guard++ < 6) { m = V.doc.maps[m.parentId]; crumbs.unshift(m); }
    $('#crumbs').innerHTML = crumbs.map(c => `<button data-open="${c.id}">${esc(c.title || 'mappa')}</button><span>›</span>`).join('');
    $$('#crumbs [data-open]').forEach(b => b.onclick = () => UI.openMap(b.dataset.open));
    $('#btn-undo').disabled = !V.canUndo(); $('#btn-redo').disabled = !V.canRedo();
    if (UI.menuCheck) UI.menuCheck('#btn-overlays', map.overlays !== false);
    if (UI.linkModeLabel) UI.linkModeLabel();
  };
  UI.renderMaps = () => {
    const list = $('#maplist'); const maps = Object.values(V.doc.maps).sort((a, b) => (b.updated || 0) - (a.updated || 0));
    list.innerHTML = maps.map(m => `<div class="maprow"><b>${esc(m.title || 'senza titolo')}<br><span class="k">${m.kind}${m.pairId ? ' · accoppiata' : ''}${m.parentId ? ' · dettaglio' : ''} · ${new Date(m.updated || m.created).toLocaleDateString('it-CH')} · ${m.elements.filter(e => e.type === 'box').length} box</span></b><button class="btn small primary" data-open="${m.id}">Apri</button></div>`).join('') || '<p class="hint">Nessuna mappa.</p>';
    $$('#maplist [data-open]').forEach(b => b.onclick = () => { $('#dlg-maps').close(); UI.openMap(b.dataset.open); });
  };

  // ---------- guida ----------
  UI.renderGuide = () => {
    const map = V.map(); const body = $('#guide-body'); const L = V.lint(map);
    let h = `<label class="check" style="margin:0 0 8px"><input type="checkbox" id="g-on" ${UI.guideOn ? 'checked' : ''}> <span><b>Guida attiva</b> — fasi del metodo, controlli e suggerimenti. Spegnila per lavorare libero.</span></label>`;
    if (UI.guideOn) {
      h += `<div class="phases">` + V.PHASES.map(p => { const done = V.phaseDone(map, p.n); const w = L.filter(x => x.phase === p.n).length; return `<button class="phase ${done ? 'done' : ''}" data-ph="${p.n}" ${map.guidePhase === p.n ? 'aria-current="step"' : ''}><span class="n">${done ? '✓' : p.n}</span><span>${p.t}${map.guidePhase === p.n ? `<br><span class="hint">${p.s}</span>` : ''}</span><span class="badge">${w ? w + ' ⚠' : ''}</span></button>`; }).join('') + `</div>`;
      h += UI.phaseForm(map, map.guidePhase);
    }
    h += `<h4 style="margin:12px 0 6px;font-size:13px">Controlli sul foglio</h4><div class="lint">${L.length ? L.slice(0, 14).map((x, i) => `<button class="chip ${x.level}" data-li="${i}">${x.level === 'bad' ? '✕' : '⚠'} ${esc(x.msg)}</button>`).join('') : '<span class="chip ok">✓ Nessun rilievo dai controlli offline. Chiedi al coach una revisione.</span>'}</div>`;
    body.innerHTML = h;
    $('#g-on').onchange = (e) => { UI.guideOn = e.target.checked; localStorage.setItem('vsm.guideOn', UI.guideOn ? '1' : '0'); UI.renderGuide(); };
    $$('[data-ph]', body).forEach(b => b.onclick = () => { V.commit({ t: 'meta', after: { guidePhase: +b.dataset.ph } }, '', { silent: true }); UI.renderGuide(); });
    $$('[data-li]', body).forEach(b => b.onclick = () => { const x = L[+b.dataset.li]; if (x.elId) { I.select([x.elId]); R.flash(x.elId); } else if (UI.guideOn) { V.commit({ t: 'meta', after: { guidePhase: x.phase } }, '', { silent: true }); UI.renderGuide(); } });
    bindMeta(body, map);
  };
  const mchk = (k, v, label) => `<label class="check"><input type="checkbox" data-mp="${k}" ${v ? 'checked' : ''}> <span>${label}</span></label>`;
  const minp = (k, v, attrs = '') => `<input data-mp="${k}" value="${esc(v)}" autocomplete="off" ${attrs}>`;
  const mta = (k, v, attrs = '') => `<textarea data-mp="${k}" ${attrs}>${esc(v)}</textarea>`;
  const note = (t) => `<div class="coachnote"><b>Il coach chiede</b>${t}</div>`;
  const getPath = (o, path) => path.split('.').reduce((a, k) => a == null ? undefined : a[k], o);
  function bindMeta(root, map) {
    $$('[data-mp]', root).forEach(el => {
      const path = el.dataset.mp; const handler = () => {
        const v = el.type === 'checkbox' ? el.checked : el.value; const [top, ...rest] = path.split('.');
        const after = clone(map[top]); if (rest.length) { let o = after; for (let i = 0; i < rest.length - 1; i++) { if (o[rest[i]] == null) o[rest[i]] = {}; o = o[rest[i]]; } o[rest[rest.length - 1]] = v; V.commit({ t: 'meta', after: { [top]: after } }, 'guida', { silent: true }); } else V.commit({ t: 'meta', after: { [top]: v } }, 'guida', { silent: true });
      }; el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', handler);
    });
  }
  UI.phaseForm = (map, ph) => {
    const M = V.metrics(map); let h = '';
    const q = (t) => `<div class="hint" style="margin-bottom:6px">${t}</div>`;
    switch (ph) {
      case 0: h += note('Qual è la <i>richiesta</i> che il processo soddisfa e chi la fa? È osservabile, frequente, degno? Chi disegna (uno solo)? Chi "possiede" l\'iniziativa in direzione?') + `<div class="card"><h4>Scopo</h4>${q('Tocca il titolo in alto a destra sul foglio per titolo, data, iniziali, scopo, unità.')}${mchk('prep.observable', map.prep.observable, 'Osservabile')}${mchk('prep.frequent', map.prep.frequent, 'Frequente')}${mchk('prep.worthy', map.prep.worthy, 'Degno (paziente, organizzazione, lavoratore)')}</div><div class="card"><h4>Team</h4><div class="field"><label>Responsabile unico del disegno</label>${minp('prep.drawer', map.prep.drawer)}</div><div class="field"><label>Owner amministrativo</label>${minp('prep.owner', map.prep.owner)}</div>${mchk('prep.physicians', map.prep.physicians, 'Medici coinvolti (se clinico)')}${mchk('prep.staffing', map.prep.staffing, 'Organico stabile')}${mchk('prep.stable', map.prep.stable, 'Nessun\'altra grande iniziativa in corso')}</div><div class="field"><label>L\'ideale per questo processo</label>${mta('ideal', map.ideal, 'placeholder="senza difetti · zero spreco · attenzione individuale · on-demand · risposta immediata"')}</div>`; break;
      case 1: h += note('Chi chiede? Con quali vie — tutte (telefono, fax, e-mail, verbale, di persona, sistema)? Quante mani tocca la richiesta? Dove si perde?') + `<div class="card">${q('Strumenti: <b>Persona</b> per il richiedente (in alto a destra), poi <b>Via di richiesta</b> trascinando dall\'omino al primo passo, una per ogni via reale.')}<div class="kv"><b>Richiedenti</b><span>${map.elements.filter(e => e.type === 'person' && e.props.requestor).length}</span><b>Vie di richiesta</b><span>${M.requests}</span></div><div class="actions"><button class="btn small" data-tool-go="person">Persona</button><button class="btn small" data-tool-go="request">Via di richiesta</button></div></div>`; break;
      case 2: h += note('Qual è il primo passo maggiore? Che attività "apre la porta" e quale "la chiude"? Nel CSM le attività necessarie ora sono valore: non giudicare ancora.') + `<div class="card">${q('Strumenti: <b>Process box</b> (tocca il foglio), poi <b>Freccia di flusso</b> da un box al successivo; alternative con "or".')}<div class="kv"><b>Box</b><span>${M.boxes}</span><b>Frecce di flusso</b><span>${M.flows}</span></div><div class="actions"><button class="btn small" data-tool-go="box">Process box</button><button class="btn small" data-tool-go="flow">Freccia</button></div></div>`; break;
      case 3: h += note('Tra un box e il successivo, quando nulla avanza? Dove sta ferma la cosa (vassoio, coda, viaggio, telefonata senza risposta)?') + `<div class="card">${q('Strumento: <b>Delta</b> — tocca vicino a una freccia di flusso: si aggancia ed entra nella timeline.')}<div class="kv"><b>Delta</b><span>${M.deltas}</span></div><div class="actions"><button class="btn small" data-tool-go="delta">Delta</button></div></div>`; break;
      case 4: h += note('Il processo è stato osservato dall\'inizio alla fine? Da chi? Gli osservati sapevano che non è un\'ispezione? Cosa hanno corretto vedendo la mappa?') + `<div class="card">${mchk('validation.prepared', map.validation.prepared, 'Osservati preparati (non punitivo; segnalano varianti)')}${mchk('validation.walked', map.validation.walked, 'Processo camminato dall\'inizio alla fine')}<div class="row"><div class="field"><label>Osservato da</label>${minp('validation.walkedBy', map.validation.walkedBy)}</div><div class="field"><label>Data</label>${minp('validation.walkedDate', map.validation.walkedDate, 'type="date"')}</div></div><div class="row"><div class="field"><label>Validato da (chi fa il lavoro)</label>${minp('validation.validatedBy', map.validation.validatedBy)}</div><div class="field"><label>Data</label>${minp('validation.validatedDate', map.validation.validatedDate, 'type="date"')}</div></div><div class="field"><label>Correzioni emerse</label>${mta('validation.corrections', map.validation.corrections)}</div></div>`; break;
      case 5: h += note('Inizio/fine di ogni box concordati con chi raccoglie? Strumento vistoso che viaggia con la cartella? Quante misure (~30; 8-10 per vista rapida)? Chi restituisce i risultati allo staff?') + `<div class="card">${q('Tocca ogni box e ogni delta per inserire Hi / Lo / Avg (una sola unità: ' + esc(map.unit) + '). Il riepilogo si aggiorna sul foglio.')}${mchk('data.boundariesAgreed', map.data.boundariesAgreed, 'Inizio/fine dei box concordati; glossario comune')}${mchk('data.tool', map.data.tool, 'Strumento di raccolta visibile + busta di consegna')}${mchk('data.feedback', map.data.feedback, 'Restituzione dei risultati allo staff prevista')}<div class="kv"><b>Box senza media</b><span>${M.incompleteBoxes}</span><b>Delta senza media</b><span>${M.incompleteDeltas}</span><b>VA / NVA</b><span>${fmt(M.va)} / ${fmt(M.nva)} → ${fmt(M.vaPct)} % a valore</span></div><div class="field"><label>Note sui massimi / outlier</label>${mta('data.notes', map.data.notes)}</div></div>`; break;
      case 6: h += note('Il processo serve? Ogni passo serve, aggiunge valore, è fatto sempre uguale, con il minimo di persone? Dove la variazione è maggiore: perché a volte veloce, cosa nel caso lento? Etichetta ogni problema con muda e regola.') + `<div class="card">${q('Strumento: <b>Nuvola temporalesca</b> sul punto del problema (muda + regola). Poi la domanda: "così accade adesso — è abbastanza buono?"')}<div class="kv"><b>Nuvole</b><span>${M.storms}</span></div><div class="actions"><button class="btn small" data-tool-go="storm">Nuvola</button></div><div class="field" style="margin-top:8px"><label>È abbastanza buono? Che cosa non è ideale</label>${mta('analysis.goodEnough', map.analysis.goodEnough)}</div></div>`; break;
      case 7: { const f = V.futureOf(map); const cur = V.currentOf(map) || map; const fm = f ? V.metrics(f) : null, cm = V.metrics(cur); h += note('Il processo va tenuto, reinventato o eliminato? Quante vie di richiesta restano (idealmente una)? Quali box si eliminano o combinano? Chi ha le risorse, chi è lo sponsor, entro quando si sperimenta? Non aspettare i "monumenti".') + `<div class="card">${map.kind !== 'future' ? `<div class="actions"><button class="btn small primary" id="g-mkfuture">${f ? 'Apri lo stato futuro' : 'Crea lo stato futuro (copia dell\'attuale)'}</button></div>` : ''}${f ? `<div class="cmp" style="margin-top:8px"><span class="h"></span><span class="h">Attuale</span><span class="h">Futuro</span><span class="h"></span>${cmpRow('Vie di richiesta', cm.requests, fm.requests)}${cmpRow('Process box', cm.boxes, fm.boxes)}${cmpRow('Tempo totale', cm.hasData ? cm.tot : null, fm.hasData ? fm.tot : null)}${cmpRow('NVA (attese)', cm.hasData ? cm.nva : null, fm.hasData ? fm.nva : null)}${cmpRow('VA %', cm.vaPct, fm.vaPct, false)}</div>` : ''}</div>` + (map.kind === 'future' ? `<div class="card"><h4>Realismo</h4>${mchk('futureCheck.people', map.futureCheck.people, 'Persone con tempo reale per portare a termine i cambiamenti')}<div class="field"><label>Sponsor / owner</label>${minp('futureCheck.sponsor', map.futureCheck.sponsor)}</div><div class="field"><label>Data per sperimentare</label>${minp('futureCheck.date', map.futureCheck.date, 'type="date"')}</div><div class="field"><label>Vincoli</label>${minp('futureCheck.constraints', map.futureCheck.constraints)}</div><div class="field"><label>Validato con lo staff da</label>${minp('futureCheck.validatedBy', map.futureCheck.validatedBy)}</div></div>` : ''); break; }
      case 8: h += note('Per ogni cambiamento: cosa, chi, entro quando, esito atteso. Quali richiedono un A3? Chi degli altri reparti deve sedere al tavolo?') + `<div class="card">${q('Il piano è nella scheda <b>Piano</b> del cassetto (What / Who / When / Outcome).')}<div class="actions"><button class="btn small" id="g-toplan">Apri il piano</button></div></div>`; break;
      case 9: h += note('Quando si rimisura (1-3-6 mesi)? Meno linee nella richiesta, meno box, meno loop, meno passaggi, delta più brevi, meno variazione? Accettare o iterare?') + `<div class="card"><div class="field"><label>Data di ri-misurazione</label>${minp('closure.remeasureDate', map.closure.remeasureDate, 'type="date"')}</div>${['Più leggibile', 'Meno linee di comunicazione nella richiesta', 'Meno process box', 'Meno loop', 'Meno attività ridondanti', 'Meno passaggi tra operatori', 'Delta più brevi', 'Meno variazione nei box', 'Correlazione con soddisfazione/throughput'].map((c, i) => mchk('closure.checks.c' + i, map.closure.checks['c' + i], c)).join('')}<div class="field"><label>Decisione (accettare o iterare)</label>${mta('closure.notes', map.closure.notes)}</div></div>`; break;
    }
    setTimeout(() => { $$('[data-tool-go]').forEach(b => b.onclick = () => I.setTool(b.dataset.toolGo)); const mk = $('#g-mkfuture'); if (mk) mk.onclick = () => { const f = V.createFuture(V.currentOf(map) || map); UI.openMap(f.id); }; const tp = $('#g-toplan'); if (tp) tp.onclick = () => UI.showTab('plan'); }, 0);
    return h;
  };
  function cmpRow(label, a, b, lowerBetter = true) { const cls = (a == null || b == null) ? '' : (lowerBetter ? (b < a ? 'good' : b > a ? 'badv' : '') : (b > a ? 'good' : b < a ? 'badv' : '')); return `<span>${label}</span><span>${a == null ? '–' : fmt(a)}</span><span>${b == null ? '–' : fmt(b)}</span><span class="${cls}">${cls === 'good' ? '▼ meglio' : cls === 'badv' ? '▲ peggio' : '='}</span>`; }

  // ---------- piano ----------
  UI.renderPlan = () => {
    const map = V.map(); const body = $('#plan-body');
    let h = `<div class="coachnote"><b>Piano dello stato futuro</b>Ogni riga: What / Who / When / Outcome. Nessun impegno verbale senza data ed esito. Revisione periodica: in tempo? ritardo e ripianificazione? da scartare?</div>`;
    h += `<table class="plan"><thead><tr><th>#</th><th>What</th><th>Who</th><th>When</th><th>Outcome</th><th>A3</th><th></th></tr></thead><tbody>${map.plan.map((r, i) => `<tr><td>${i + 1}</td><td><input data-pi="${i}" data-pk="what" value="${esc(r.what)}"></td><td><input data-pi="${i}" data-pk="who" value="${esc(r.who)}"></td><td><input data-pi="${i}" data-pk="when" type="date" value="${esc(r.when)}"></td><td><input data-pi="${i}" data-pk="outcome" value="${esc(r.outcome)}"></td><td><input type="checkbox" data-pi="${i}" data-pk="a3" ${r.a3 ? 'checked' : ''}></td><td><button class="btn small ghost danger" data-pdel="${i}" aria-label="Elimina riga ${i + 1}">×</button></td></tr>`).join('')}</tbody></table><p><button class="btn" id="plan-add">+ Aggiungi riga</button></p>`;
    body.innerHTML = h;
    $('#plan-add').onclick = () => { const plan = clone(map.plan); plan.push({ id: uid(), what: '', who: '', when: '', outcome: '', a3: false }); V.commit({ t: 'plan_set', after: plan }, 'piano'); UI.renderPlan(); };
    $$('[data-pdel]', body).forEach(b => b.onclick = () => { const plan = clone(map.plan); plan.splice(+b.dataset.pdel, 1); V.commit({ t: 'plan_set', after: plan }, 'piano'); UI.renderPlan(); });
    $$('[data-pi]', body).forEach(e => e.addEventListener(e.type === 'checkbox' || e.type === 'date' ? 'change' : 'input', () => { const plan = clone(map.plan); plan[+e.dataset.pi][e.dataset.pk] = e.type === 'checkbox' ? e.checked : e.value; V.commit({ t: 'plan_set', after: plan }, 'piano', { silent: true }); }));
  };

  // ---------- cassetto ----------
  UI.showTab = (name) => { $('#drawer').classList.remove('closed'); ['guide', 'coach', 'plan', 'legend'].forEach(t => { $('#tab-' + t).setAttribute('aria-selected', t === name); $('#pane-' + t).classList.toggle('hidden', t !== name); }); if (name === 'guide') UI.renderGuide(); if (name === 'plan') UI.renderPlan(); if (name === 'legend') UI.renderLegend(); if (name === 'coach') setTimeout(() => { const c = $('#chat'); c.scrollTop = 1e9; }, 0); $('#btn-guide').setAttribute('aria-pressed', name === 'guide'); $('#btn-legend').setAttribute('aria-pressed', name === 'legend'); };
  UI.closeDrawer = () => { $('#drawer').classList.add('closed'); $('#btn-guide').setAttribute('aria-pressed', 'false'); $('#btn-legend').setAttribute('aria-pressed', 'false'); };

  // ---------- interfaccia nascosta ("schermo pulito"): resta il foglio; si mostra e si nasconde solo col pulsante ----------
  UI.setChrome = (visible, opts = {}) => {
    const app = $('#app'); const hidden = !visible;
    app.classList.toggle('clean', hidden);
    const b = $('#ui-toggle');
    if (b) { b.setAttribute('aria-pressed', hidden ? 'true' : 'false'); b.textContent = hidden ? '⇲' : '⇱'; const lbl = hidden ? 'Mostra l\'interfaccia' : 'Nascondi l\'interfaccia (più foglio)'; b.title = lbl; b.setAttribute('aria-label', lbl); }
    if (hidden) { UI.closeDrawer(); UI.hideSuggest && UI.hideSuggest(); $('#more-tools').classList.add('hidden'); $('#menu').classList.add('hidden'); }
    try { localStorage.setItem('vsm.chrome', hidden ? '0' : '1'); } catch (e) { /* storage bloccato */ }
    if (opts.hint !== false && hidden) I.hint('Interfaccia nascosta: tocca ⇲ in alto a sinistra per riaverla. Resta così finché non lo ripremi.', 3500);
    if (V.render && V.interact) V.interact.applyView();
  };
  UI.chromeVisible = () => !$('#app').classList.contains('clean');
  UI.toggleChrome = () => UI.setChrome(!UI.chromeVisible());

  /** strumenti in colonna a sinistra invece che in basso al centro (in basso coprono la timeline) */
  UI.setToolsLeft = (on) => {
    $('#app').classList.toggle('tools-left', !!on);
    $('#more-tools').classList.add('hidden');
    UI.menuCheck && UI.menuCheck('#btn-tools-left', !!on);
    try { localStorage.setItem('vsm.toolsLeft', on ? '1' : '0'); } catch (e) { /* storage bloccato */ }
    if (V.pop && V.pop.current && V.pop.current !== '__title__') { const el = V.byId(V.pop.current); if (el) V.pop.place(el); }
    UI.onSelection && UI.onSelection(I.selection);
  };

  // ---------- suggerimenti di strumento (regole locali; il coach usa lo stesso canale) ----------
  const readSugDismissed = () => { try { return JSON.parse(localStorage.getItem('vsm.sug.off') || '{}'); } catch (e) { return {}; } };
  const SUG = { shownAt: {}, current: null, dismissed: readSugDismissed(), count: 0 };
  const RULESUG = [
    { id: 'requestor', when: (M, map) => M.boxes >= 1 && !map.elements.some(e => e.type === 'person' && e.props.requestor), tool: 'person', msg: 'Chi fa la richiesta? Metti l\'omino del richiedente in alto a destra.' },
    { id: 'request', when: (M, map) => map.elements.some(e => e.type === 'person' && e.props.requestor) && M.boxes >= 1 && M.requests === 0, tool: 'request', msg: 'Come arriva la richiesta? Traccia una via di richiesta dall\'omino al primo passo (una per ogni via reale).' },
    { id: 'flow', when: (M) => M.boxes >= 2 && M.flows === 0, tool: 'flow', msg: 'Collega i box con le frecce di flusso: da lì nasce l\'ordine del processo e la timeline.' },
    { id: 'delta', when: (M) => M.boxes >= 2 && M.flows >= 1 && M.deltas === 0, tool: 'delta', msg: 'Tra un box e il successivo, quando nulla avanza? Aggiungi un delta sulla freccia.' },
    { id: 'data', when: (M) => M.boxes >= 2 && M.deltas >= 1 && !M.hasData, tool: 'select', msg: 'Ora i tempi: tocca un box o un delta e inserisci Hi / Lo / Avg (una sola unità).' },
    { id: 'storm', when: (M) => M.hasData && M.storms === 0, tool: 'storm', msg: 'Che cosa non è ideale? Segna i problemi con le nuvole temporalesche (muda + regola).' },
    { id: 'future', when: (M, map) => map.kind === 'current' && M.storms >= 2 && M.hasData && !V.futureOf(map), tool: null, msg: 'Con nuvole e dati sei pronto per lo stato futuro: menu ⋯ → "Crea lo stato futuro".' }
  ];
  UI.evalSuggest = () => {
    if (!UI.suggestOn || !UI.guideOn) return; if (SUG.current) return; const map = V.map(); const M = V.metrics(map); const now = Date.now();
    for (const r of RULESUG) { if (SUG.dismissed[r.id]) continue; if (SUG.shownAt[r.id] && now - SUG.shownAt[r.id] < 10 * 60 * 1000) continue; if (r.when(M, map)) { UI.showSuggest(r.tool, r.msg, r.id); SUG.shownAt[r.id] = now; return; } }
  };
  UI.showSuggest = (tool, msg, ruleId) => {
    const s = $('#suggest'); SUG.current = { tool, ruleId }; $$('#palette .tool, #more-tools .tool').forEach(b => b.classList.toggle('suggest', b.dataset.tool === tool));
    s.innerHTML = `<span>${esc(msg)}</span>${tool ? `<button id="sug-go">Usa lo strumento</button>` : ''}${ruleId ? `<button class="x" id="sug-off" title="Non mostrare più questo suggerimento" aria-label="Non mostrare più">⊘</button>` : ''}<button class="x" id="sug-x" title="Chiudi" aria-label="Chiudi suggerimento">✕</button>`; s.classList.remove('hidden');
    const go = $('#sug-go'); if (go) go.onclick = () => { I.setTool(tool); UI.hideSuggest(); };
    $('#sug-x').onclick = UI.hideSuggest; const off = $('#sug-off'); if (off) off.onclick = () => { SUG.dismissed[ruleId] = true; localStorage.setItem('vsm.sug.off', JSON.stringify(SUG.dismissed)); UI.hideSuggest(); };
    clearTimeout(SUG.timer); SUG.timer = setTimeout(UI.hideSuggest, 14000);
  };
  UI.hideSuggest = () => { $('#suggest').classList.add('hidden'); $$('#palette .tool.suggest, #more-tools .tool.suggest').forEach(b => b.classList.remove('suggest')); SUG.current = null; };
  UI.hideSuggestIfTool = (t) => { if (SUG.current && SUG.current.tool === t) UI.hideSuggest(); };
  // ---------- azioni rapide contestuali (attaccate all'elemento selezionato) ----------
  const Q = { el: null };
  UI.hideQuick = () => { const q = $('#quick'); if (q) q.classList.add('hidden'); };
  UI.onView = () => { if (Q.el && !$('#quick').classList.contains('hidden')) UI.positionQuick(); if (V.pop.current && V.pop.current !== '__title__') { const el = V.byId(V.pop.current); if (el) V.pop.place(el); } };
  UI.positionQuick = () => {
    const q = $('#quick'); const map = V.map(); const el = V.byId(Q.el, map); if (!el) { q.classList.add('hidden'); return; }
    const st = $('#stage').getBoundingClientRect(); let ax, ay;
    if (V.isConnector(el)) { const Pc = R.connPath(el, map); ax = Pc.mid.x; ay = Math.min(Pc.a.y, Pc.b.y, Pc.mid.y) - 22; } else { const p = R.elPos(el, map); ax = p.x + el.w / 2; ay = p.y; }
    const s = I.toScreen(ax, ay); const w = q.offsetWidth || 260, h = q.offsetHeight || 40;
    let left = s.x - w / 2, top = s.y - h - 12; if (top < 8) top = s.y + (el.h || 20) * I.view.k + 12; left = Math.max(UI.leftInset(), Math.min(st.width - w - 8, left)); top = Math.max(8, Math.min(st.height - h - 8, top));
    q.style.left = left + 'px'; q.style.top = top + 'px';
  };
  UI.onSelection = (ids) => {
    const q = $('#quick'); if (!q) return; if (!ids.length) { q.classList.add('hidden'); Q.el = null; return; }
    // col pop-up dei dettagli aperto la barra rapida resta chiusa: sono le stesse azioni, e sovrapposte sono un caos.
    // (alla chiusura del pop-up, P.close richiama questa funzione e la barra torna)
    if (V.pop && V.pop.current) { q.classList.add('hidden'); Q.el = ids[0]; return; }
    const map = V.map();
    const A = []; const btn = (id, label, title) => A.push(`<button class="btn small" data-qa="${id}" title="${esc(title || label)}">${label}</button>`);
    if (ids.length > 1) { // selezione multipla: azioni di gruppo
      const els = ids.map(id => V.byId(id, map)).filter(Boolean); const lockable = els.filter(e => !V.isConnector(e) && R.LOCKABLE.includes(e.type)); const locked = els.filter(e => e.props && (e.props.lockTo || (e.type === 'delta' && e.props.attachedTo)));
      Q.el = ids[0]; A.push(`<span class="qinfo">${ids.length} selezionati</span>`);
      if (lockable.length) btn('lockall', '🔒 Blocca tutti a…', 'Blocca gli elementi selezionati a un passo, persona, corsia o freccia che tocchi'); if (locked.length) btn('unlockall', '🔓 Sblocca tutti'); btn('dupall', '⎘ Duplica tutti'); btn('del', 'Elimina');
      q.innerHTML = A.join(''); q.classList.remove('hidden'); UI.positionQuick(); $$('[data-qa]', q).forEach(b => b.onclick = () => UI.quickAction(b.dataset.qa, ids[0]));
      return;
    }
    const el = V.byId(ids[0], map); if (!el) { q.classList.add('hidden'); return; } Q.el = el.id;
    const acts = UI.actionList(el, map);
    // una barra con la sola "Elimina" non serve e invita al tocco sbagliato: per questi elementi basta il secondo tocco
    if (acts.length <= 1) { q.classList.add('hidden'); return; }
    acts.forEach(a => btn(a.id, a.label, a.title));
    q.innerHTML = A.join(''); q.classList.remove('hidden'); UI.positionQuick();
    $$('[data-qa]', q).forEach(b => b.onclick = () => UI.quickAction(b.dataset.qa, el.id));
  };
  /** azioni contestuali di un elemento: la stessa lista serve la barra rapida e il pop-up */
  UI.actionList = (el, map) => {
    const A = []; const btn = (id, label, title) => A.push({ id, label, title: title || label });
    const requestor = map.elements.find(e => e.type === 'person' && e.props.requestor);
    const outFlows = map.elements.filter(c => c.type === 'flow' && c.from.el === el.id);
    switch (el.type) {
      // niente "Dettagli" qui: i dettagli si aprono col secondo tocco sull'elemento (e chiudono questa barra)
      case 'box': btn('next', '+ Passo dopo', 'Crea il passo successivo già collegato, con l\'attesa'); if (outFlows.length) btn('delta', '+ Attesa', 'Aggiungi il delta sulla freccia in uscita'); btn('cloud', '+ Problema'); btn('connect', 'Collega →', 'Trascina da qui a un altro passo'); if (requestor && !map.elements.some(c => c.type === 'request' && c.to.el === el.id)) btn('request', '← Richiesta', 'Via di richiesta dal richiedente a questo passo'); break;
      case 'person': if (el.props.requestor) btn('reqtool', '+ Via di richiesta', 'Trascina dall\'omino al primo passo'); break;
      case 'delta': if (!el.props.attachedTo) btn('attach', 'Aggancia alla freccia'); break;
      case 'flow': btn('deltaOn', '+ Attesa qui'); btn('invert', 'Inverti'); break;
      case 'storm': btn('shrink', el.props.collapsed ? '▽ Espandi' : '⚠ Riduci a segnale', el.props.collapsed ? 'Torna nuvola con il testo visibile' : 'Diventa un triangolo di allerta: il foglio resta pulito, il testo si legge toccandolo'); btn('dup', 'Duplica'); break;
      case 'fluffy': case 'burst': case 'text': btn('dup', 'Duplica'); break;
      case 'icon': case 'face': btn('dup', 'Duplica'); break;
      case 'legend': btn('legend', el.props.collapsed ? 'Apri' : 'Chiudi'); btn('legendfull', 'Legenda completa', 'Tutti i simboli con significato e varianti, nel cassetto'); break;
    }
    const locked = el.props && (el.props.lockTo || (el.type === 'delta' && el.props.attachedTo));
    if (locked) { const par = V.byId(locked, map); btn('unlock', '🔓 Sblocca', 'Bloccato a ' + (par ? (par.props.title || par.props.label || par.props.name || V.TYPES[par.type].name) : '?') + ': smette di seguirlo'); }
    else if (!V.isConnector(el) && R.LOCKABLE.includes(el.type) && el.type !== 'delta') btn('lockto', '🔒 Blocca a…', 'Si muove insieme all\'elemento che tocchi (passo, freccia, persona, corsia)');
    const kids = R.children(el.id, map); if (kids.length) { btn('selkids', `⛶ Con i bloccati (${kids.length})`, 'Seleziona anche gli elementi bloccati a questo (per spostare, duplicare o eliminare tutto insieme)'); btn('unlockkids', '🔓 Sblocca i suoi', 'Libera tutti gli elementi bloccati a questo'); }
    btn('del', 'Elimina');
    return A;
  };
  UI.quickAction = (a, id) => {
    const map = V.map(); const el = V.byId(id, map); if (!el) return;
    switch (a) {
      case 'next': { const nx = Math.min(el.x + el.w + 90, V.paperOf(map).w - V.TYPES.box.w - 20); const nb = V.newElement('box', nx, el.y, {}); const f = V.newConnector('flow', { el: el.id }, { el: nb.id }); const d = V.newElement('delta', 0, 0, {}); d.props.attachedTo = f.id; d.props.dx = 0; d.props.dy = 0; V.commit([{ t: 'add', el: nb }, { t: 'add', el: f }, { t: 'add', el: d }], 'passo successivo'); I.select([nb.id], { keepPop: true }); V.pop.open(nb.id); UI.toast('Passo aggiunto con freccia e attesa: tocca il delta per i tempi.'); break; }
      case 'delta': { const f = map.elements.find(c => c.type === 'flow' && c.from.el === el.id); if (!f) return; const d = V.newElement('delta', 0, 0, {}); d.props.attachedTo = f.id; d.props.dx = 0; d.props.dy = 0; V.commit({ t: 'add', el: d }, 'attesa'); I.select([d.id], { keepPop: true }); V.pop.open(d.id); break; }
      case 'cloud': { const s = V.newElement('storm', el.x + el.w - 60, el.y - 62, {}); V.commit({ t: 'add', el: s }, 'nuvola'); I.select([s.id], { keepPop: true }); V.pop.open(s.id); break; }
      case 'connect': I.select([id], { keepPop: true }); I.startPickConnect(id, 'flow'); break;
      case 'request': { const r = map.elements.find(e => e.type === 'person' && e.props.requestor); if (!r) return; const c = V.newConnector('request', { el: r.id }, { el: el.id }); c.props.offset = map.elements.filter(x => x.type === 'request' && x.from.el === r.id).length; V.commit({ t: 'add', el: c }, 'via di richiesta'); I.select([c.id], { keepPop: true }); V.pop.open(c.id); break; }
      case 'reqtool': I.select([id], { keepPop: true }); I.startPickConnect(id, 'request'); break;
      case 'attach': { const pos = R.elPos(el, map); let best = null, bd = 120; map.elements.filter(c => c.type === 'flow').forEach(c => { const Pc = R.connPath(c, map); const d = Math.hypot(Pc.mid.x - (pos.x + el.w / 2), Pc.mid.y - pos.y); if (d < bd) { bd = d; best = c; } }); if (!best) { UI.toast('Nessuna freccia di flusso vicina: avvicina il delta a una freccia.'); return; } V.commit({ t: 'props', id, after: { attachedTo: best.id, dx: 0, dy: 0 } }, 'aggancia'); I.select([id]); break; }
      case 'deltaOn': { const d = V.newElement('delta', 0, 0, {}); d.props.attachedTo = id; d.props.dx = 0; d.props.dy = 0; V.commit({ t: 'add', el: d }, 'attesa'); I.select([d.id], { keepPop: true }); V.pop.open(d.id); break; }
      case 'invert': V.commit({ t: 'update', id, after: { from: clone(el.to), to: clone(el.from) }, before: { from: clone(el.from), to: clone(el.to) } }, 'inverti'); I.select([id]); break;
      case 'legend': { const collapsed = !el.props.collapsed; V.commit([{ t: 'props', id, after: { collapsed } }, { t: 'update', id, after: { w: collapsed ? 74 : 170, h: collapsed ? 18 : 104 } }], 'legenda'); I.select([id]); break; }
      case 'edit': V.pop.open(id); break;
      case 'legendfull': UI.showTab('legend'); break;
      case 'shrink': {
        const T = V.TYPES.storm; const collapsed = !el.props.collapsed;
        // la misura di prima si tiene da parte: chi allarga una nuvola non vuole ritrovarla piccola al ritorno
        const props = collapsed ? { collapsed, w0: el.w, h0: el.h } : { collapsed };
        const size = collapsed ? { w: 30, h: 26 } : { w: el.props.w0 || T.w, h: el.props.h0 || T.h };
        V.commit([{ t: 'props', id, after: props }, { t: 'update', id, after: size, before: { w: el.w, h: el.h } }], collapsed ? 'riduci a segnale' : 'espandi');
        I.select([id]); break;
      }
      case 'lockto': I.startPickLock([id]); break;
      case 'unlock': I.unlock(id); break;
      case 'lockall': I.startPickLock(I.selection.slice()); break;
      case 'unlockall': I.unlockMany(I.selection.slice()); break;
      case 'selkids': I.selectWithChildren(id); break;
      case 'unlockkids': I.unlockChildren(id); break;
      case 'dup': I.duplicate(id); break;
      case 'dupall': I.duplicateMany(I.selection.slice()); break;
      case 'del': if (I.selection.length <= 1) I.select([id], { keepPop: true }); I.deleteSelection(); break;
    }
  };

  // ---------- benvenuto / aiuto ----------
  UI.showHelp = (first) => {
    const d = $('#dlg-help'); if (!d) return; d.dataset.first = first ? '1' : ''; d.showModal();
  };
})(window.VSM);
