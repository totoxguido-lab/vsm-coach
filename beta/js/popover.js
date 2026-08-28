/* VSM Coach v2 — popover.js: il pop-up del passo/elemento selezionato (V.pop), traslocato verbatim
   da panels.js (spec fondamenta D, Task 5) perché ospita le sezioni dei livelli di analisi:
   `P.sections(el, map)` = le sezioni di base di sempre (questo file, spostate senza cambiarle) +
   `L.active(map).map(l => l.section(el, map, ix)).filter(Boolean)`, tutte collassabili con l'ultimo
   stato in localStorage. `P.place()` si richiama anche dopo l'ultimo riempimento delle sezioni (le
   render(host) dei livelli riempiono DOPO il primo posizionamento) e su ResizeObserver del pannello
   (rapporto dom R2: oggi misura 379 e il pannello vero è 580).
   Si carica PRIMA di panels.js (manifest: …render, interact, popover, panels…): V.ui nasce QUI
   (get-or-create — panels.js fa la stessa cosa, non lo sovrascrive), perché questo file assegna
   UI.leftInset al caricamento. Il resto dei riferimenti a UI.xxx (toast, hideQuick, actionList…)
   sono letture dentro funzioni: girano solo dopo che panels.js li ha scritti.
   Due glifi (IC.whatis, QICN.peek) sono privati alla chiusura di panels.js — un'altra IIFE, non
   raggiungibile da qui: sono solo due stringhe SVG fisse, duplicarle costa nulla e non lega i due
   moduli. */
(function (V) {
  'use strict';
  const I = V.interact, R = V.render; const { num, fmt, uid, clone, today } = V.util;
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // V.ui nasce qui SE non esiste gia' (get-or-create, mai un nuovo oggetto): questo file assegna
  // UI.leftInset AL CARICAMENTO (non dentro una funzione), e senza questa riga «UI» non esisterebbe
  // ancora (panels.js, che crea V.ui, si carica dopo) — ReferenceError trovato girando l'app vera in
  // Playwright (l'unico modo di scoprirlo: le prove su Node non toccano mai un DOM cosi' completo).
  // panels.js fa la STESSA cosa (get-or-create): chi carica per primo crea l'oggetto, l'altro lo trova.
  V.ui = V.ui || {}; const UI = V.ui;
  // duplicati da panels.js (IC.whatis, QICN.peek): vedi la nota in testa al file
  const IC_WHATIS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.6 2.6 0 1 1 3.6 2.4c-.9.4-1.2 1-1.2 1.8"/><circle cx="12" cy="17" r=".4" fill="currentColor"/></svg>';
  const QICN_PEEK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M2.5 12Q12 4.8 21.5 12Q12 19.2 2.5 12Z"/><circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none"/></svg>';
  /** Il nome proposto per un sotto-foglio (duplicato da panels.js, stessa logica: il titolo del
   *  passo, o l'indirizzo che V.stepNumbers calcola già). */
  const nomeProposto = (map, box) => {
    const p = (box && box.props) || {};
    const t = String(p.title || p.text || '').trim();
    if (t) return t;
    const n = V.stepNumbers(map).get(box && box.id);
    return n ? `Dentro il passo ${n}` : 'Sotto-foglio';
  };

  const P = V.pop = {};
  /** il pannellino aperto dentro il pannello del passo (tint/link/peek/setup), null = nessuno:
   *  sopravvive ai ridisegni del pannello sullo stesso elemento, si chiude col pannello */
  P._mini = null;
  // icone dei tondi del pannello del passo: il vocabolario resta quello dei menu rotondi (.pm-btn)
  const RIC = {
    tint: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3.5c3 4.6 5.5 7.7 5.5 10.7a5.5 5.5 0 01-11 0c0-3 2.5-6.1 5.5-10.7z"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M9.5 7H17v7.5"/></svg>',
    setup: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.6 18.1l-8.6-8.6c.8-2.1.3-4.6-1.5-6.4-1.8-1.8-4.5-2.3-6.8-1.4l3.9 3.9-2.7 2.7-3.9-3.9c-.9 2.3-.4 5 1.4 6.8 1.8 1.8 4.3 2.3 6.4 1.5l8.6 8.6c.4.4 1 .4 1.4 0l1.8-1.8c.4-.4.4-1 0-1.4z"/></svg>',
    valid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12.5l5 5L19.5 7"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };
  let fid = 0;
  // esito 16-a (26/8): gli appunti sotto i campi non stanno piu' distesi a rubare spazio —
  // vivono dietro una ⓘ accanto all'etichetta: un tocco apre la bolla, un tocco fuori la chiude
  const field = (label, html, hint) => { const id = 'f' + (++fid); html = html.replace(/^<(input|select|textarea)\b/, `<$1 id="${id}"`); return `<div class="field"><label for="${id}">${label}${hint ? `<button type="button" class="hintdot" data-hintdot aria-label="Spiegazione">ⓘ</button><span class="hintpop hidden">${hint}</span>` : ''}</label>${html}</div>`; };
  const inp = (k, v, attrs = '') => `<input data-k="${k}" value="${esc(v)}" autocomplete="off" ${attrs}>`;
  const ta = (k, v, attrs = '') => `<textarea data-k="${k}" ${attrs}>${esc(v)}</textarea>`;
  const sel = (k, v, opts) => `<select data-k="${k}">${opts.map(o => `<option value="${esc(o)}" ${o === v ? 'selected' : ''}>${esc(o || '—')}</option>`).join('')}</select>`;
  /** come sel, ma per elenchi in cui il valore salvato e il nome che si legge sono due cose diverse */
  const selId = (k, v, opts) => `<select data-k="${k}">${opts.map(o => `<option value="${esc(o.id)}" ${o.id === v ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select>`;
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
  /** la palette del passo: pastiglie di colore, non parole (il nome resta nel title, per chi legge
   *  lo schermo). La prima è «nessuna»: il ripiego, disegnata come pastiglia vuota barrata. La
   *  pastiglia mostra la tinta com'e' davvero (riempimento 38%/95.5%, bordo 26%/64%): quello che
   *  si sceglie e' quello che finisce sul foglio, senza sorprese. */
  const tintPicker = (cur) => `<div class="picker tints" role="radiogroup" aria-label="Colore del passo">${V.TINTS.map(t => {
    const on = (t.id == null && cur == null) || t.id === cur;
    const dot = t.id == null ? '<span class="sw none" aria-hidden="true"></span>' : `<span class="sw" style="background:hsl(${t.id} 38% 95.5%);border-color:hsl(${t.id} 26% 64%)" aria-hidden="true"></span>`;
    return `<button type="button" class="pick ${on ? 'on' : ''}" data-pick="tint" data-v="${t.id == null ? '' : t.id}" role="radio" aria-checked="${on}" title="${esc(t.name)}" aria-label="Colore: ${esc(t.name)}">${dot}</button>`;
  }).join('')}</div>`;
  /* La forma del problema (richiesta di Gt): quattro pastiglie che mostrano la sagoma vera, non il suo
     nome — si sceglie guardando. La nuvola resta quella del libro ed è il valore di partenza. */
  const FORME_NOMI = { nuvola: 'nuvola (come nel libro)', cerchio: 'cerchio', quadrato: 'quadrato', triangolo: 'triangolo' };
  const shapePicker = (cur) => `<div class="picker forme" role="radiogroup" aria-label="Forma del problema">${V.STORM_SHAPES.map(f => {
    const on = f === cur;
    return `<button type="button" class="pick ${on ? 'on' : ''}" data-pick="shape" data-v="${f}" role="radio" aria-checked="${on}" title="${esc(FORME_NOMI[f])}" aria-label="Forma: ${esc(FORME_NOMI[f])}"><svg viewBox="0 0 30 24" aria-hidden="true"><path d="${R.shapePath(f, 30, 24)}" fill="#fff" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg></button>`;
  }).join('')}</div>`;
  const dataRow = (p) => `<div class="row3">${field('Hi', inp('hi', p.hi, 'inputmode="decimal" placeholder="max"'))}${field('Lo', inp('lo', p.lo, 'inputmode="decimal" placeholder="min"'))}${field('Avg', inp('avg', p.avg, 'inputmode="decimal" placeholder="media"'))}</div>`;
  /** «Origine di questi numeri»: UNA riga sola per la terna Hi/Lo/Avg (D-05, UI-SPEC §2), non una
   *  per numero — la terna si scrive insieme, e tre righe sarebbero tre tocchi per dire una cosa
   *  sola. Un costruttore, due chiamanti: il passo (sotto la griglia .times) e l'attesa (sotto i
   *  suoi tre riquadri) — la terna è la stessa, e «Calcola i tempi» marca «calcolato» tutt'e due.
   *
   *  Legge `V.fonteDatiDi` e NON `props.fonteDati` a occhio nudo (contratto lasciato dal 02-05):
   *  la marca «calcolato» è una dichiarazione della macchina e vale finché i tre numeri sono
   *  ancora i suoi. Riscrittone uno a mano, decade da sola e la riga torna a chiedere l'origine —
   *  così l'app non dichiara mai «calcolato» un numero che si è inventato una persona.
   *  Quando è «calcolato» la riga si LEGGE e basta: non c'è niente da scegliere.
   *  Le parole vengono tutte da un posto solo: le quattro dal modello (V.FONTE_LABEL/CORTA),
   *  quelle dell'origine assente da V.tempo.FONTE_MUTA, dove le scrive la riga della misura. */
  const origineDati = (el, map) => {
    const eff = V.fonteDatiDi(el, map);
    if (eff === 'calcolato') return `<div class="hint" data-orig-calc>Calcolati dalle misure di questo giro</div>`;
    // spento e col PERCHÉ ogni volta che la porta delle fasi o la ✓ del passo rifiuterebbero la
    // scrittura: la frase è quella che il commit stesso mostrerebbe (V.DENIED_MSG) — mai un
    // bottone vivo che non fa niente, e mai una seconda copia della regola da tenere allineata
    const g = V.allowed({ t: 'props', id: el.id, after: { fonteDati: V.FONTI[0] } }, map);
    const ro = g.ok ? '' : ` disabled title="${esc(V.DENIED_MSG[g.reason] || '')}"`;
    const muta = (V.tempo && V.tempo.FONTE_MUTA) || {};
    const corta = V.FONTE_CORTA[eff] || muta.corta || '—';
    const piena = V.FONTE_LABEL[eff] || muta.piena || '';
    const nota = (typeof el.props.fonteDatiNota === 'string') ? el.props.fonteDatiNota : '';
    const pick = (f) => {
      const on = f === eff, eti = V.FONTE_LABEL[f] || f;
      return `<button type="button" class="pick ${on ? 'on' : ''}" data-pick="fonteDati" data-v="${esc(f)}" role="radio" aria-checked="${on}" aria-label="Origine: ${esc(eti)}" title="${esc(on ? eti + ' — tocca di nuovo per togliere l\'origine' : eti)}"${ro}><span>${esc(eti)}</span></button>`;
    };
    // il «chi o dove» si legge accanto alla parola anche a fascia chiusa: un dettaglio scritto e
    // poi nascosto è un dettaglio che nessuno rilegge più
    return `<div class="field"><label>Origine di questi numeri</label><div class="actions">`
      + `<button type="button" class="btn small" data-orig-apri aria-expanded="false"${ro || ` title="${esc(piena)} — tocca per dire da dove vengono questi numeri"`}>${esc(corta)}</button>`
      + (nota ? `<span class="hint">${esc(nota)}</span>` : '')
      + `</div></div>`
      + `<div class="picker fonti hidden" role="radiogroup" aria-label="Da dove vengono questi numeri" data-orig-fascia>${V.FONTI.map(pick).join('')}</div>`
      + `<div class="field hidden" data-orig-nota><label for="pop-fontedati-nota">Chi o dove (facoltativo)`
      + `<button type="button" class="hintdot" data-hintdot aria-label="Spiegazione">ⓘ</button>`
      + `<span class="hintpop hidden">Meglio il ruolo o le iniziali, non il nome.</span></label>`
      + `<input id="pop-fontedati-nota" data-k="fonteDatiNota" value="${esc(nota)}" placeholder="es. la caposala, il turno di notte" autocomplete="off"${ro}></div>`;
  };
  /** i TIPI di attesa a icone (esito 13): stesso pattern di shapePicker — il commit passa dal
   *  meccanismo generico data-pick. Le icone vivono in UI.ICONE_ATTESA (panels), una fonte sola. */
  const KIND_ETI = { attesa: 'attesa', 'in-box': 'in-box', coda: 'coda', viaggio: 'viaggio', "sala d'attesa": 'sala' };
  const kindPicker = (cur) => `<div class="picker kinds" role="radiogroup" aria-label="Tipo di attesa">${V.DELTA_KINDS.map(k => {
    const on = k === (cur || 'attesa');
    return `<button type="button" class="pick ${on ? 'on' : ''}" data-pick="kind" data-v="${esc(k)}" role="radio" aria-checked="${on}" title="${esc(k)}" aria-label="Tipo: ${esc(k)}">${(UI.ICONE_ATTESA || {})[k] || ''}<span>${esc(KIND_ETI[k] || k)}</span></button>`;
  }).join('')}</div>`;
  /** Le mappe che si possono scegliere: quelle del progetto corrente, più quelle dei progetti che vi
   *  sono stati collegati a mano. Prima c'erano TUTTE quelle del documento, esempio del libro compreso,
   *  etichettate con le parole grezze del codice (current/future/detail): un elenco in cui perdersi.
   *  L'indirizzo davanti dice dove sta ciascuna, così si sceglie sapendo. Gli indirizzi si calcolano
   *  UNA volta per mappa: mapAddress risale la catena dei padri a ogni chiamata, e dentro un
   *  comparatore di ordinamento verrebbe richiamata decine di volte per mappa. */
  const mapOptions = (excludeId) => {
    const mia = V.map(); const p = V.project();
    const visibili = p ? [p.id].concat(p.links || []) : [];
    return Object.values(V.doc.maps)
      .filter(m => m.id !== excludeId && (visibili.includes(m.projectId) || (mia && m.projectId === mia.projectId)))
      .map(m => ({ m, ind: V.mapAddress(m) }))
      .sort((a, b) => (a.ind || '~').localeCompare(b.ind || '~', undefined, { numeric: true }))
      .map(({ m, ind }) => {
        const prog = (mia && m.projectId !== mia.projectId) ? ' · ' + ((V.doc.projects[m.projectId] || {}).name || 'altro progetto') : '';
        // «libera» deve promettere solo ciò che avverrà: l'adozione (V.linkMap) richiede anche lo
        // STESSO progetto della mappa aperta — una mappa di un progetto collegato resta dov'è
        // e viene solo richiamata (⇉), e il menu non deve dire «diventa sotto-foglio» per poi smentirsi
        const libera = !m.parentId && mia && m.projectId === mia.projectId;
        return { id: m.id, label: (ind ? V.shortAddress(ind) + ' ' : '') + (m.title || 'senza titolo') + ' · ' + V.kindLabel(m) + prog, libera, ind };
      });
  };

  // chiudendo il pannello gli object URL delle miniature e dei memo tornano indietro: sono memoria
  // che non si libera da sola finché la pagina vive, e in una camminata di pannelli aperti e
  // chiusi si accumulerebbe senza che nessuno se ne accorga (T-02-13-08). `allegRevoca` è
  // dichiarata più sotto con la sezione degli allegati: qui si legge solo quando si chiude.
  P.close = () => { const pop = $('#pop'); const was = !pop.classList.contains('hidden'); pop.classList.add('hidden'); pop.classList.remove('sheet'); pop.classList.remove('step'); P.current = null; P._mini = null; allegRevoca(); if (was && I.selection.length && UI.onSelection) UI.onSelection(I.selection); };
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
  /** La ✓ verde si toglie solo confermando: un tocco per sbaglio non deve riaprire un passo già
   *  mappato — è la differenza col lucchetto (pinned), che costa un tocco solo. Riusa #gpcard,
   *  si apre al tocco sul tondo (gesto finito), mai a metà di un trascinamento. */
  const confermaRiapriPasso = (onOk) => {
    UI.closeGuideCard(); UI.hideQuick();
    const c = document.createElement('div'); c.id = 'gpcard';
    c.innerHTML = `<div class="gpc-head"><b>Riaprire il passo?</b><span class="spacer"></span><button class="btn small ghost" id="gpc-x" aria-label="Chiudi">✕</button></div>`
      + `<div class="gpc-body">Questo passo era stato validato: mappato, con attività e tempi. Riaprendolo torna modificabile — la ✓ si può rimettere quando vuoi.</div>`
      + `<div class="actions"><button class="btn small primary" data-rp-ok>Riapri</button><button class="btn small ghost" data-rp-no>Annulla</button></div>`;
    document.body.appendChild(c);
    const chW = c.offsetWidth, chH = c.offsetHeight;
    c.style.left = Math.round(Math.max(8, (window.innerWidth - chW) / 2)) + 'px';
    c.style.top = Math.round(Math.max(58, Math.min(window.innerHeight - chH - 10, 120))) + 'px';
    const no = () => UI.closeGuideCard();
    $('#gpc-x', c).onclick = no; $('[data-rp-no]', c).onclick = no;
    $('[data-rp-ok]', c).onclick = () => { UI.closeGuideCard(); onOk(); };
  };
  /* ---------- gli ALLEGATI nel pannello del passo (F1-1C, D-15, UI-SPEC §3) --------------------
   * Quello che si è raccolto camminando si rivede qui, e si toglie in modo recuperabile. Una
   * sezione a fisarmonica sola, costruita UNA volta e montata da DUE chiamanti — P.open (disegna,
   * valida) e openPassoMisura (misura, analizza) — sullo stampo di T.sectionHTML/T.mount: una
   * parte pura che fa la stringa, una che lega gli eventi. Due copie andrebbero alla deriva.
   *
   * IL PUNTO DELICATO: lo stampo di T.mount è SINCRONO, V.alleg.prendi no. I byte arrivano da una
   * promessa, e la regola è in tre parti:
   * 1. si disegna SUBITO tutto, leggendo i soli METADATI del documento (V.allegatiDi): la cornice
   *    vuota della miniatura, il ▶ spento con la durata. Il numero fra parentesi e il numero di
   *    voci non cambiano mai dopo — così il pannello non salta e P.place non deve riposizionarsi;
   * 2. al resolve si sostituisce SOLO il nodo di quella voce. Mai un ridisegno dell'host intero:
   *    chiuderebbe la fisarmonica e perderebbe lo scorrimento sotto le dita di chi sta guardando;
   * 3. prima di toccare il DOM si verifica che il nodo sia ANCORA nel documento, ancora dello
   *    stesso passo e ancora dello stesso disegno (la chiave {elId, seq}) — fra la richiesta e la
   *    risposta il pannello può essere stato chiuso, riaperto su un altro passo o ridisegnato. Se
   *    la guardia fallisce non si tocca niente e l'object URL appena creato si revoca SUBITO,
   *    altrimenti resterebbe appeso senza nessuno che lo mostri. È lo stesso ragionamento della
   *    guardia dopo l'attesa di misWake: la cosa può essere finita mentre la richiesta era in volo.
   *
   * Se il passo non ha niente, la sezione non compare affatto: nessuno stato vuoto (UI-SPEC). */
  const ALL_IC = {
    play: '<svg viewBox="0 0 24 24"><path d="M8 5.2l10 6.8-10 6.8z" fill="currentColor"/></svg>',
    pausa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M9.5 6v12M14.5 6v12"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 7h15M9.5 7V4.8h5V7M7 7l1 12.5h8L17 7"/></svg>',
  };
  let allegSeq = 0;        // la chiave di validità: cresce a ogni disegno della sezione
  let allegUrls = [];      // gli object URL vivi di ciò che è a schermo, da revocare al ridisegno
  let allegArm = null;     // {elId, id}: il 🗑 armato vale per QUELLA voce e muore a ogni ridisegno
  // la vista grande si chiude PRIMA di revocare: sta mostrando uno di questi URL, e lasciarla
  // aperta vorrebbe dire una finestra su un'immagine morta (R-1C-01)
  const allegRevoca = () => { if (UI && UI.chiudiFoto) UI.chiudiFoto(); allegUrls.forEach(u => { try { URL.revokeObjectURL(u); } catch (e) { /* niente */ } }); allegUrls = []; };
  const allegDurata = (a) => { const s = Math.max(0, Math.round(Number(a.dur) || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const allegNome = (a) => (a.tipo === 'foto' ? 'la foto' : 'il memo');
  /** PURA e SINCRONA: legge i soli metadati del documento e non chiede i byte a nessuno. */
  const allegatiHTML = (el, map, seq) => {
    const list = V.allegatiDi(el);
    if (!list.length) return '';
    const chiave = (a) => `data-alle="${esc(a.id)}" data-alle-el="${esc(el.id)}" data-alle-seq="${seq}"`;
    const cestino = (a) => {
      const armato = !!(allegArm && allegArm.elId === el.id && allegArm.id === a.id);
      const secondo = 'Tocca ancora per togliere ' + allegNome(a);
      return `<button type="button" class="alle-x${armato ? ' armato' : ''}" data-alle-x="${esc(a.id)}"`
        + ` aria-label="${armato ? esc(secondo) : 'Togli ' + esc(allegNome(a))}" title="${armato ? esc(secondo) : 'Togli ' + esc(allegNome(a)) + ' (chiede un secondo tocco)'}">${ALL_IC.trash}</button>`;
    };
    // un gruppo di voci: la griglia delle foto e le righe dei memo, come sono sempre state
    const gruppoHTML = (voci) => {
      const foto = voci.filter(a => a.tipo === 'foto'), memo = voci.filter(a => a.tipo === 'memo');
      let g = '';
      if (foto.length) g += '<div class="alle-griglia">' + foto.map(a =>
        `<div class="alle-voce" ${chiave(a)}><button type="button" class="alle-mini" disabled data-alle-vista aria-label="Apri ${esc(allegNome(a))} a schermo intero"></button>${cestino(a)}</div>`).join('') + '</div>';
      if (memo.length) g += '<div class="alle-righe">' + memo.map(a =>
        `<div class="alle-voce alle-riga" ${chiave(a)}>`
        + `<span data-alle-vista><button type="button" class="alle-ply" disabled aria-label="Riascolta ${esc(allegNome(a))}">${ALL_IC.play}</button></span>`
        + `<span class="alle-meta">${esc(allegDurata(a))}${a.turno ? ' · ' + esc(a.turno) : ''}</span>${cestino(a)}</div>`).join('') + '</div>';
      return g;
    };
    // R-1C-02: di questo giro sopra, gli ereditati sotto, ognuno col nome del giro da cui viene.
    // Si SEPARA e si dichiara, non si nasconde: una foto di ieri resta guardabile — deve solo
    // smettere di farsi passare per un'evidenza raccolta oggi. Stessa forma di js/tempo.js.
    let h = gruppoHTML(V.allegatiDelGiro(el, map));
    const prec = V.allegatiPerGiroPrecedente(el, map);
    if (prec.length) {
      h += '<div class="pop-sec">Giri precedenti</div>';
      prec.forEach(g => {
        const mp = V.doc.maps[g.giro];
        const nome = mp ? (mp.verName || mp.title || 'giro') : 'giro chiuso';
        h += `<div class="alle-giroprec">${esc(nome)}</div>` + gruppoHTML(g.allegati);
      });
      h += '<p class="hint">Raccolte in un giro precedente: si guardano, non contano come evidenza di questo giro.</p>';
    }
    return h;
  };
  /** Il <details> della sezione, o '' se il passo non ha niente da mostrare. Chiusa di suo: si apre
   *  solo se qualcuno l'ha aperta prima (lo stato lo ricorda localStorage, come le altre sezioni). */
  const allegatiSezioneHTML = (el, map) => {
    // il numero fra parentesi e' quello di QUESTO giro (R-1C-02): era il conto di tutto, ed e' il
    // modo in cui la sezione diceva «tre evidenze» a chi ne aveva raccolta una. Gli ereditati si
    // dichiarano a parte invece di sparire dal conto in silenzio — e la sezione si apre anche
    // quando di questo giro non c'e' niente, altrimenti le foto di ieri diventerebbero
    // irraggiungibili proprio mentre si prova a dire che esistono.
    const n = V.allegatiDelGiro(el, map).length;
    const eredit = V.allegatiPerGiroPrecedente(el, map).reduce((t, g) => t + g.allegati.length, 0);
    if (!n && !eredit) return '';
    let salvato = null; try { salvato = localStorage.getItem('vsm.pop.sec.allegati'); } catch (e) { /* storage bloccato */ }
    // il titolo si compone in UN posto: scritto due volte (un ramo con gli ereditati, uno senza)
    // erano due copie della stessa stringa, ed e' proprio quello che sorveglia la prova del 02-13
    const titolo = `Foto e memo (${n}${eredit ? ` · ${eredit} da giri precedenti` : ''})`;
    return `<details class="pop-section" data-sec="allegati"${salvato === '1' ? ' open' : ''}>`
      + `<summary>${titolo}</summary><div class="pop-sec-body" data-alle-body></div></details>`;
  };
  /** Il montaggio: lega gli eventi e va a prendere i byte, uno per voce. */
  const allegatiMonta = (pop, el, map) => {
    const d = pop && pop.querySelector('[data-sec="allegati"]');
    const host = d && d.querySelector('[data-alle-body]');
    if (!host) return;
    allegRevoca();                       // gli object URL del disegno di prima non servono più
    const seq = ++allegSeq;
    host.innerHTML = allegatiHTML(el, map, seq);
    d.addEventListener('toggle', () => {
      try { localStorage.setItem('vsm.pop.sec.allegati', d.open ? '1' : '0'); } catch (e) { /* storage bloccato */ }
      P.place(el);
    });
    const trova = (id) => Array.from(host.querySelectorAll('[data-alle]')).find(n => n.dataset.alle === id) || null;
    const vivo = (voce) => !!voce && document.contains(voce) && voce.dataset.alleEl === el.id && voce.dataset.alleSeq === String(seq);
    /** i tre stati dichiarati (Pitfall 6): mai una sparizione silenziosa, sempre una parola */
    const segnaposto = (voce, testo) => {
      const vista = voce && voce.querySelector('[data-alle-vista]');
      if (!vista) return;
      vista.innerHTML = `<span class="alle-manca">${esc(testo)}</span>`;
    };
    // il 🗑 in DUE tocchi: il primo arma questa voce, il secondo toglie. I BYTE NON SI CANCELLANO
    // QUI: il commit sul documento è annullabile con ↶, e cancellare i byte subito renderebbe
    // l'annulla una bugia (↶ riporterebbe un metadato che punta al vuoto). Se li porta via la
    // spazzata degli orfani del caricamento successivo — l'ordine dichiarato di V.allegOrfani.
    Array.from(host.querySelectorAll('[data-alle-x]')).forEach(b => b.onclick = () => {
      const id = b.dataset.alleX;
      const a = V.allegatiDi(el).find(x => x.id === id); if (!a) return;
      if (!(allegArm && allegArm.elId === el.id && allegArm.id === id)) {
        allegArm = { elId: el.id, id };
        b.classList.add('armato');
        UI.toast('Tocca ancora per togliere ' + allegNome(a));
        return;
      }
      allegArm = null;
      if (!V.togliAllegatoMeta(map, el.id, id)) { UI.toast('Non si è potuto togliere: il foglio ha il lucchetto o il passo ha la ✓.'); return; }
      UI.toast(a.tipo === 'foto' ? 'Tolta. ↶ per rimetterla' : 'Tolto. ↶ per rimetterlo');
      P.open(el.id);           // la sezione si ridisegna, e sparisce se quello era l'ultimo
    });
    V.allegatiDi(el).forEach(a => {
      V.alleg.prendi(a.id).then(r => {
        const voce = trova(a.id);
        // i byte non sono su questo iPad: NON è un errore, è lo stato normale di un foglio
        // importato da un'altra parte — e si dice, non si nasconde (D-14, C-2)
        if (!r) {
          if (vivo(voce)) segnaposto(voce, a.tipo === 'foto'
            ? 'Questa foto è rimasta sull’iPad dove è stata scattata.'
            : 'Questo memo è rimasto sull’iPad dove è stato registrato.');
          return;
        }
        // il mime NON si prende dal documento e nemmeno alla cieca dal record: elenco chiuso in
        // base al TIPO (V.mimeAllegato) — un allegato che si dichiara 'text/html' non deve poter
        // far aprire nulla (T-02-13-01). E nessun window.open di un object URL, mai.
        const mime = V.mimeAllegato(a.tipo, r.mime);
        let url = null;
        try { url = mime ? URL.createObjectURL(new Blob([r.buf], { type: mime })) : null; } catch (e) { url = null; }
        if (!vivo(voce) || !url) {
          // host stantio: si revoca SUBITO, o resta appeso senza nessuno che lo mostri (T-02-13-08)
          if (url) { try { URL.revokeObjectURL(url); } catch (e) { /* niente */ } }
          if (!url && vivo(voce)) segnaposto(voce, 'Questo file non si apre più.');
          return;
        }
        allegUrls.push(url);
        const vista = voce.querySelector('[data-alle-vista]');
        if (a.tipo === 'foto') {
          const img = document.createElement('img');
          img.alt = 'foto del passo'; img.decoding = 'async';
          // record presente ma illeggibile: il terzo stato, e si dice anche quello
          img.onerror = () => segnaposto(voce, 'Questo file non si apre più.');
          img.src = url;
          vista.innerHTML = ''; vista.appendChild(img);
          // i byte ci sono: adesso la miniatura si puo' aprire. Il bottone nasce spento apposta —
          // acceso prima di qui aprirebbe una finestra vuota (R-1C-01)
          if (vista.tagName === 'BUTTON') {
            vista.disabled = false;
            const nome = (el.props && el.props.title) ? String(el.props.title) : 'passo';
            vista.onclick = () => UI.mostraFoto(url, 'Foto \u00b7 ' + nome);
          }
          return;
        }
        const au = document.createElement('audio');
        au.preload = 'none'; au.src = url;
        au.onerror = () => segnaposto(voce, 'Questo file non si apre più.');
        const ply = vista.querySelector('.alle-ply');
        if (!ply) return;
        ply.disabled = false;
        au.onended = () => { ply.innerHTML = ALL_IC.play; };
        ply.onclick = () => {
          if (au.paused) { au.play().then(() => { ply.innerHTML = ALL_IC.pausa; }).catch(() => segnaposto(voce, 'Questo file non si apre più.')); }
          else { au.pause(); ply.innerHTML = ALL_IC.play; }
        };
      });
    });
  };
  /** ESITO 12 della prova iPad (E12-d, 26/8): in Misura/Analizza il passo si apre in una finestra
   *  SUA, di sola lettura — non il pannello dell'editing tutto disabilitato. Dentro: il nome (o
   *  «Passo N» dalla sequenza), le attività in elenco, il resoconto delle misure (max·min·media +
   *  totale) e il pulsante che apre l'analisi completa. Restano le azioni della fase (comincia il
   *  giro da qui, + problema) e le sezioni dei livelli DIVERSI da 'tempo', che vive per intero
   *  dietro «Analisi delle misure». */
  const openPassoMisura = (el, map, opts = {}) => {
    // il tocco sul badge dei tempi salta dritto all'analisi: la sezione 'tempo' non sta piu' qui
    if (opts.section === 'tempo' && UI.openAnalisi) { UI.openAnalisi(el.id); return; }
    const id = el.id; P.current = id; P._mini = null;
    const p = el.props;
    const atti = (p.activities || []).map(x => String(x || '').trim()).filter(Boolean);
    let h = `<div class="pop-head mis-ro"><div class="pop-title"><b>${esc(V.nomePasso(el, map))}</b><div class="pop-sub">in Misura il passo si legge, non si scrive</div></div><button class="btn small ghost" id="pop-x" aria-label="Chiudi">✕</button></div>`;
    h += atti.length
      ? `<div class="pop-sec">Attività</div><ol class="mis-ro-atti">${atti.map(a => `<li>${esc(a)}</li>`).join('')}</ol>`
      : `<div class="hint">Nessuna attività scritta su questo passo.</div>`;
    const res = (V.tempo && V.tempo.resocontoHTML) ? V.tempo.resocontoHTML(el, map) : '';
    h += `<div class="pop-sec">Tempi misurati</div>` + (res || `<div class="hint">Nessuna misura ancora: tocca il cronometro ⏱ sul passo per cominciare.</div>`);
    const acts = UI.actionList(el, map);
    if (acts.length) h += `<div class="actions pop-actions">${acts.map(a => UI.quickBtnHTML ? UI.quickBtnHTML(a, el, 'data-pa') : `<button class="btn small" data-pa="${a.id}" title="${esc(a.title)}">${a.label}</button>`).join('')}</div>`;
    const secDefs = P.sections(el, map).filter(s => s.id !== 'tempo').map(s => {
      let salvato = null; try { salvato = localStorage.getItem('vsm.pop.sec.' + s.id); } catch (e) { /* storage bloccato */ }
      const aperto = opts.section === s.id ? true : salvato !== '0';
      return Object.assign({}, s, { aperto });
    });
    if (secDefs.length) h += secDefs.map(s => `<details class="pop-section" data-sec="${esc(s.id)}" ${s.aperto ? 'open' : ''}><summary>${esc(s.title || '')}</summary><div class="pop-sec-body" data-sec-body></div></details>`).join('');
    h += allegatiSezioneHTML(el, map);   // in coda: quello che si è raccolto camminando (D-15)
    UI.hideQuick();
    const pop = $('#pop'); pop.innerHTML = h; pop.classList.remove('hidden'); pop.classList.add('step'); P.place(el);
    allegatiMonta(pop, el, map);
    if (secDefs.length) {
      const secEls = $$('.pop-section', pop);
      secDefs.forEach(s => {
        const d = secEls.find(x => x.dataset.sec === s.id); if (!d) return;
        const host = d.querySelector('[data-sec-body]');
        if (host) { try { s.render(host); } catch (e) { console.warn('livello "' + s.id + '": render() della sezione ha lanciato', e); } }
        d.addEventListener('toggle', () => { try { localStorage.setItem('vsm.pop.sec.' + s.id, d.open ? '1' : '0'); } catch (e) { /* storage bloccato */ } P.place(el); });
      });
      P.place(el);
    }
    ensurePopRO();
    $('#pop-x').onclick = P.close;
    $$('[data-pa]', pop).forEach(b => b.onclick = (ev) => UI.quickAction(b.dataset.pa, id, { x: ev.clientX, y: ev.clientY }));
    const an = $('[data-analisi]', pop); if (an) an.onclick = () => { if (UI.openAnalisi) { P.close(); UI.openAnalisi(id); } };
  };

  P.open = (id, opts = {}) => {
    const map = V.map(); const el = V.byId(id, map); if (!el) return;
    // il passo in Misura/Analizza ha la sua finestra di lettura (esito 12): niente pannello
    // dell'editing spento — quella strada resta per le altre fasi e per gli altri tipi
    if (el.type === 'box' && ['misura', 'analizza'].includes(map.phase)) { openPassoMisura(el, map, opts); return; }
    if (P.current !== id) P._mini = null; // elemento cambiato: i pannellini ripartono chiusi
    P.current = id;
    const T = V.TYPES[el.type]; const p = el.props;
    const isBox = el.type === 'box';
    // ✓ accesa: il contenuto del passo si legge, non si scrive (la guardia vera è in V.commit)
    const roStep = (isBox && p.validated) ? ' disabled' : '';
    let h;
    if (isBox) {
      // ESITO 15 (26/8, decisione di Gt): niente fila di tondi in cima — «il primo elemento è il
      // titolo», poi le attività, i tempi SOLO se esistono, le azioni a icone, e in fondo le
      // Avanzate (fogli, valida, C&C/chi, elimina col doppio tocco). Il «?» resta piccolo in testa.
      h = `<div class="pop-head passo"><input class="pop-ptitle" data-k="title" value="${esc(p.title)}" placeholder="Nome del passo (es. Accettazione)" autocomplete="off" autofocus${roStep}>`
        + `<button class="btn small ghost" id="pop-why" title="Perché / cos'è (dal libro)" aria-label="Spiegazione dal libro" aria-expanded="false">?</button>`
        + `<button class="btn small ghost" id="pop-x" aria-label="Chiudi">✕</button></div>`
        + `<div class="why hidden" id="pop-whytext">${esc(T.why)}</div>`;
    } else {
      const nomeTipo = el.type === 'storm' ? (V.shapeOf(el) === 'nuvola' ? 'Nuvola temporalesca' : 'Problema · ' + V.shapeOf(el)) : T.name;
      h = `<div class="pop-head">${preview(el, map)}<div class="pop-title"><b>${nomeTipo}</b><div class="pop-sub">${esc(subtitleOf(el, map))}</div></div><button class="btn small ghost" id="pop-why" title="Perché / cos'è (dal libro)" aria-label="Spiegazione dal libro" aria-expanded="false">?</button><button class="btn small ghost" id="pop-x" aria-label="Chiudi">✕</button></div><div class="why hidden" id="pop-whytext">${esc(T.why)}</div>`;
    }
    let main = '', adv = '', minis = '';
    switch (el.type) {
      // Il pannello del passo (variante B, spec 2026-08-21): in vista ciò che si compila sempre —
      // titolo, attività numerate, tempi a riquadri (inputmode decimal: su iPad esce la tastiera
      // numerica). Colore, collegamenti, sbircia ed extra stanno dietro i tondi, in pannellini che
      // si aprono DENTRO il pannello, sopra il contenuto: nessuna finestra sopra un'altra finestra.
      case 'box': {
        // il titolo sta gia' nella testata (esito 15); la dicitura «una per riga» e' sparita.
        // «Valida» sta SUBITO SOTTO le attività, come bottone (esito 16-c) — non in avanzate:
        // e' il gesto del metodo (mappato, con attivita' e tempi), non un'opzione rara
        main += `<div class="pop-sec">Attività</div><div class="acts" data-acts></div>`
          + `<div class="actions"><button class="btn small${p.validated ? ' primary' : ''}" data-valid title="${p.validated ? 'Validato: tocca per riaprirlo alle modifiche (con conferma)' : 'Segna come validato: mappato, con attività e tempi'}">${p.validated ? '✓ Validato — riapri' : '✓ Valida il passo'}</button></div>`;
        // ⏱ accanto ai tempi: da qui si apre il cronometro (spec 2026-08-21, Parte 2). Sta qui e non
        // fra i tondi perché è di quei tre riquadri che parla — e i tondi sono già sette.
        // esito 13: NIENTE cronometro qui (il ⏱ vive in Misura, dove serve) — al suo posto la
        // STORIA delle misure (questo giro e i precedenti, via l'analisi); i tempi ereditati dal
        // giro precedente si dichiarano e si mostrano da fantasma finche' non vengono riscritti
        // i TEMPI si vedono solo se esistono (esito 15): misure prese (anche di giri precedenti)
        // o Hi/Lo/Avg scritti — su un passo nuovo la sezione non compare affatto
        const misGiro = V.timesDelGiro(el, map); const misSt = V.timeStats(misGiro);
        const eredita = V.tempiEreditati(el, map);
        const hasTimes = !!(V.obsOf(el).length || p.hi !== '' || p.lo !== '' || p.avg !== '');
        if (hasTimes) {
          main += `<div class="pop-sec">Tempi (${esc(map.unit)})${V.obsOf(el).length ? `<button class="btn small" data-storia title="Tutte le misure di questo passo, giro per giro" aria-label="Storia delle misure">🕐 Storia</button>` : ''}</div>`
            + (eredita ? `<div class="hint" style="margin:-2px 0 6px">Tempi del giro precedente: restano come riferimento finché questo giro non li riscrive.</div>` : '')
            + (misGiro.length ? `<div class="hint" style="margin:-2px 0 6px">${misGiro.length} ${misGiro.length === 1 ? 'misura raccolta' : 'misure raccolte'} in questo giro · media ${esc(fmt(V.toUnit(misSt.avg, map.unit)))}.</div>` : '')
            + `<div class="times${eredita ? ' tempi-eredita' : ''}">`
            + [['hi', 'max'], ['lo', 'min'], ['avg', 'media']].map(([k, lab]) => `<label class="tbox"><span>${lab}</span><input data-k="${k}" value="${esc(p[k])}" inputmode="decimal" autocomplete="off"${roStep}></label>`).join('') + `</div>`
            + origineDati(el, map);   // una riga sola per la terna, subito sotto i tre numeri (D-05)
        }
        if (p.validated) main += `<div class="hint lockrow">✓ Passo validato: il contenuto è in sola lettura. Si sposta, si colora e si collega come prima — per modificarlo tocca la ✓ in alto.</div>`;
        // il colore è il filo fra il passo e il suo sotto-foglio: area e bordo qui, sfondo di là
        // (V.setTint li cambia insieme, in una sola voce di annulla). Nessuna scritta: pastiglie.
        minis += `<div class="pop-mini hidden" data-mini="tint"><h4>Colore del passo</h4>${tintPicker(V.tintHue(p.tint))}<div class="hint">${V.linkKind(el, map) === 'figlia' ? 'Il sotto-foglio ↗ ripete questo colore come sfondo.' : 'Se un giorno il passo avrà un sotto-foglio, ne diventerà lo sfondo.'}</div></div>`;
        // «Sbircia» dentro il pannello: la stessa anteprima della scheda flottante (UI.showPeek),
        // ma il contenuto del pannello resta visibile sotto in trasparenza
        const tgt = p.link ? V.doc.maps[p.link] : null;
        if (tgt) {
          const auto = V.describeMap(tgt);
          const custom = typeof p.summary === 'string' && p.summary.trim() ? p.summary : '';
          const ind = V.mapAddress(tgt);
          const strip = V.flowStrip(tgt);
          const striscia = strip.length ? `<div class="peek-strip">${strip.map(t => {
            if (t.kind === 'box') return `<span class="ps-box"><b>${esc(t.n)}</b> ${esc(t.title || 'passo')}</span>`;
            if (t.kind === 'delta') return `<span class="ps-delta" title="attesa fra i due passi">▼${t.avg != null ? esc(fmt(t.avg)) : ''}</span>`;
            return `<span class="ps-fork" title="Il flusso si divide qui (dal passo ${esc(t.n)})">⑂${esc(t.n)}</span>`;
          }).join('<span class="ps-sep">→</span>')}</div>` : '';
          const anteprima = tgt.elements.length ? `<div class="peek-view">${R.peekSVG(tgt)}</div>`
            : `<div class="peek-view peek-empty">Foglio ancora vuoto: appena ci disegni qualcosa, qui vedi l'anteprima.</div>`;
          minis += `<div class="pop-mini hidden" data-mini="peek"><h4>${ind ? `<span class="ind" title="${esc(ind)}">${esc(V.shortAddress(ind))}</span> ` : ''}${esc(tgt.title || 'senza titolo')}</h4>${striscia}${anteprima}`
            + field('Che cosa contiene', `<textarea data-peek-sum rows="2">${esc(custom || auto)}</textarea>`)
            + `<div class="hint">${custom ? 'Riscritta da te: non si aggiorna più da sola. ↻ la riporta a quella del foglio.' : 'Generata dal foglio: resta vera da sola finché non la riscrivi.'}</div>`
            + `<div class="actions"><button class="btn small ghost" data-peek-regen title="Rigenera la descrizione dal foglio" aria-label="Rigenera la descrizione">↻</button><span style="flex:1"></span><button class="btn small primary" data-peek-open>Apri il foglio ↗</button></div></div>`;
        }
        break;
      }
      // il pannello dell'attesa SFOLTITO (esito 13: «pieno di roba superflua»): il tipo si sceglie
      // a icone IN VISTA, i testi-guida vivono dietro il «?» (regola di Gt), restano tempi e nota
      case 'delta': {
        if (!p.attachedTo) main += `<div class="hint" style="margin-bottom:6px">Libera: trascinala vicino a una freccia, o «Aggancia».</div>`;
        main += `<div class="field"><label>Tipo di attesa</label>${kindPicker(p.kind)}</div>`
          + (V.tempiEreditati(el, map) ? `<div class="hint" style="margin:-2px 0 6px">Tempi del giro precedente.</div>` : '')
          + dataRow(p)
          + origineDati(el, map)   // anche i tempi dell'attesa dicono da dove vengono: «Calcola i tempi» li marca insieme a quelli dei passi
          + field('Dove / perché sta ferma', inp('note', p.note, 'placeholder="richiesta nel vassoio; attesa del trasportatore…"'));
        break; }
      // «chi è» e «ruolo» stanno tutti e due in vista: l'omino nasce senza etichetta, e la prima cosa
      // da fare è dire chi è. Prima «Ruolo» era sepolto sotto «Altre opzioni» e non lo trovava nessuno.
      case 'person': main += field('Chi è (si legge sul foglio)', inp('label', p.label, 'placeholder="paziente, segretaria, corriere…" autofocus')) + field('Ruolo o reparto (facoltativo)', inp('role', p.role, 'placeholder="medico di reparto, familiare, ditta esterna…"')) + `<div class="field"><label>Espressione (come vive questo momento)</label>${facePicker(p.mood)}</div>` + chk('requestor', p.requestor, 'È chi origina la richiesta (l\'omino della fascia alta)'); break;
      case 'face': main += `<div class="field"><label>Espressione</label>${facePicker(p.mood)}</div>` + `<div class="row">${field('Di chi', sel('who', p.who, ['paziente', 'operatore', 'famigliare', 'medico', 'infermiere', 'segreteria', '']))}${field('Etichetta (opzionale)', inp('label', p.label, 'placeholder="es. dopo 40 min di attesa"'))}</div>`; break;
      case 'icon': main += `<div class="field"><label>Simbolo</label>${iconPicker(p.icon)}</div>`; adv += field('Etichetta', inp('label', p.label, 'placeholder="es. fax al laboratorio"')); break;
      // Il problema si disegna nella forma che chi mappa preferisce, e può stare sul foglio come solo
      // segno: una «i» dentro la sagoma, che si tocca per leggere il testo. Il significato non cambia.
      case 'storm': main += field('Problema (di processo, non di persone)', ta('text', p.text, 'placeholder="che cosa non è ideale qui?" autofocus'))
        + `<div class="field"><label>Forma sul foglio</label>${shapePicker(V.shapeOf(el))}</div>`
        + `<label class="check"><input type="checkbox" data-mark ${p.collapsed ? '' : 'checked'}><span>Il testo si legge sul foglio${p.collapsed ? '' : ' (togli la spunta e resta la «i»: un tocco lo apre)'}</span></label>`
        + `<div class="row">${field('Muda', sel('muda', p.muda, ['', ...V.MUDA]))}${field('Regola violata', sel('rule', p.rule, ['', ...V.RULES]))}</div>`; adv += chk('a3', p.a3, 'Candidato ad A3 (5 perché → contromisure → test → follow-up)'); break;
      case 'fluffy': main += field('Idea / cosa funziona', ta('text', p.text, 'autofocus')); break;
      case 'burst': main += field('Cosa migliorare', ta('text', p.text, 'autofocus')) + `<div class="row">${field('Priorità', sel('priority', p.priority, ['alta', 'media', 'bassa']))}${field('Owner', inp('owner', p.owner))}</div>`; break;
      case 'inventory': main += field('Cosa', inp('what', p.what)) + `<div class="row">${field('Quantità', inp('qty', p.qty, 'inputmode="decimal"'))}${field('Giorni di copertura', inp('days', p.days, 'inputmode="decimal"'))}</div>`; break;
      case 'inbox': main += `<div class="row">${field('Tipo', sel('kind', p.kind, ['in-box', 'orologio', 'coda']))}${field('Attesa media', inp('avg', p.avg, 'inputmode="decimal"'))}</div>`; break;
      case 'distance': main += `<div class="row">${field('Metri', inp('meters', p.meters, 'inputmode="decimal"'))}</div>`; adv += `<div class="row">${field('Da', inp('from', p.from))}${field('A', inp('to', p.to))}</div>`; break;
      case 'lane': main += field('Reparto / corsia', inp('name', p.name, 'autofocus')); adv += field('Colore (opzionale, es. #1f4e79)', inp('color', p.color)); break;
      case 'text': main += field('Testo', ta('text', p.text, 'autofocus')); adv += field('Dimensione', sel('size', String(p.size), ['10', '12', '14', '18', '24'])); break;
      case 'legend': main += `<div class="hint">Legenda compatta per la stampa: spostala in alto a sinistra. Tutti i simboli con significato e varianti sono nella Guida pratica (menu ⋯).</div>`; break;
      case 'flow': adv += field('Etichetta (opzionale)', inp('label', p.label)) + field('Stile', sel('style', p.style, ['solid', 'info', 'material']), 'solid = flusso; info = tratteggiata (informazione); material = spessa (materiale/paziente)') + chk('or', p.or, '"or" — alternativa a un altro passo'); main += `<div class="hint">Per staccare o spostare un capo: trascina il cerchio all'estremità della freccia.</div>`; break;
      // l'intento sta PRIMA del canale: è la domanda che viene per prima ("che cosa fa questa persona?")
      // e da come si risponde dipende il canale proposto
      case 'request': main += field('Che cosa fa questa persona', selId('intent', V.intentOf(el), V.INTENTS), V.INTENTS.find(x => x.id === V.intentOf(el)).hint) + field('Canale (una freccia per ogni via reale)', sel('channel', p.channel, V.CHANNELS)) + field('Verso chi', inp('to', p.to, 'placeholder="segreteria, laboratorio…"')); adv += `<div class="row">${field('Quante mani tocca', inp('hands', p.hands, 'inputmode="numeric"'))}</div>` + field('Nota (cosa si perde, quando)', inp('note', p.note)); break;
    }
    if (V.isConnector(el)) adv += lookFields(el);
    // stato di blocco (sempre visibile, una riga)
    if (!V.isConnector(el)) {
      const lk = el.props.lockTo || (el.type === 'delta' && el.props.attachedTo); const lpar = lk ? V.byId(lk, map) : null;
      let lockHint = '';
      if (lpar) lockHint = `<div class="hint lockrow">⛓ Legato a <b>${esc(lpar.props.title || lpar.props.label || lpar.props.name || V.TYPES[lpar.type].name)}</b>: si muove con lui.</div>`;
      else if (R.LOCKABLE.includes(el.type) && el.type !== 'delta' && el.type !== 'box' && el.type !== 'person') lockHint = `<div class="hint lockrow">⛓ Libero: lascialo cadere su un passo o vicino a una freccia per legarlo.</div>`;
      const opts = mapOptions(map.id);
      // Il contenimento ↗ è dei SOLI passi (criterio di Gt, 25/8: un passo contiene sottoprocessi;
      // e nel libro chi scende di livello sono i process box). Per ogni altro elemento la voce è
      // sempre un richiamo ⇉ — V.linkMap applica la stessa regola alla fonte e non adotta. Le
      // NUVOLE non si collegano affatto: nel libro il problema scala all'A3, non a un sotto-foglio
      // (il menu resta solo, in sola uscita, su una nuvola che un link ce l'ha già dai tempi in cui
      // si poteva: per aprirlo o toglierlo).
      const suffisso = (o) => { if (!isBox) return ' — richiamata ⇉'; const m2 = V.doc.maps[o.id]; if (m2 && m2.parentStepId === el.id) return ' — sotto-foglio ↗'; return o.libera ? ' — diventa sotto-foglio ↗' : ' — richiamata ⇉'; };
      const nuovaVoce = isBox ? `<option value="__new__">+ nuovo sotto-foglio di questo passo…</option>` : '';
      const linkSel = `<select data-k="link"><option value="">— nessuna —</option>${nuovaVoce}${opts.map(o => `<option value="${o.id}" title="${esc(o.ind || '')}" ${p.link === o.id ? 'selected' : ''}>${esc(o.label)}${suffisso(o)}</option>`).join('')}</select>`;
      const linkHint = isBox
        ? 'Una mappa che non sta ancora sotto nessun passo diventa il sotto-foglio di questo. Una che ha già il suo posto resta dov\'è: qui viene solo richiamata.'
        : 'Richiamo ⇉: la mappa si apre da qui ma resta dov\'è. Solo un passo può contenerla.';
      const openLink = (p.link && V.doc.maps[p.link]) ? `<div class="actions"><button class="btn small primary" id="pop-openlink">Apri la mappa collegata ↗</button></div>` : '';
      const NUVOLE = ['storm', 'fluffy', 'burst'];
      if (isBox) {
        // ESITO 15: le AVANZATE del passo, in fondo — fogli (collega/sbircia), valida, i campi
        // dell'ex «Extra» (C&C per il First Time Quality, chi/reparto) ed elimina col doppio
        // tocco. La categoria «Extra» sparisce: erano campi senza casa, ora stanno qui.
        // esito 16-b: NIENTE tendina («mi ci perdo io stesso») — il bottone apre l'albero del
        // progetto (UI.openScegliMappa): righe indentate, parole chiare, un tocco per collegare
        adv += `<div class="actions"><button class="btn small" id="pop-fogli" title="Sotto-foglio e richiami: scegli dall'albero del progetto">↗ Fogli collegati…</button>${p.link && V.doc.maps[p.link] ? `<button class="btn small primary" id="pop-openlink">Apri ↗</button><button class="btn small" data-pa="peek" title="Sbircia il foglio collegato senza entrarci">👁</button>` : ''}</div>`;
        adv += `<div class="row">${field('Correct & Complete %', inp('cc', p.cc, 'inputmode="decimal" placeholder="es. 90"' + roStep))}${field('Chi / reparto', inp('owner', p.owner, roStep))}</div>${lockHint}`;
        if (!p.validated) adv += `<div class="actions"><button class="btn small danger" id="pop-del-arm" title="Elimina il passo: chiede un secondo tocco">Elimina il passo…</button></div>`;
      } else {
        main += lockHint;
        if (!NUVOLE.includes(el.type) || p.link) {
          main += field('Collega a un\'altra mappa', linkSel, linkHint);
          main += openLink;
        }
      }
    }
    const CONVERT = { storm: ['fluffy', 'burst', 'text'], fluffy: ['storm', 'burst', 'text'], burst: ['storm', 'fluffy', 'text'], text: ['storm', 'fluffy', 'burst'], inbox: ['delta', 'inventory'], inventory: ['inbox'] };
    if (CONVERT[el.type]) adv += field('Trasforma in…', `<select data-convert><option value="">— tipo attuale: ${T.name} —</option>${CONVERT[el.type].map(t => `<option value="${t}">${V.TYPES[t].name}</option>`).join('')}</select>`, 'Il testo e la posizione restano; cambia il disegno.');
    h += main;
    if (adv) h += `<details class="adv"><summary>Avanzate</summary>${adv}</details>`;
    // azioni: le stesse della barra rapida (senza "Dettagli"), più quelle proprie del pop-up.
    // Per il passo «Sbircia» non si ripete in coda: è il tondo 👁 in cima.
    // per il passo: «peek» vive in avanzate (fogli) e «del» pure, col doppio tocco (esito 15)
    const acts = UI.actionList(el, map).filter(a => !(isBox && (a.id === 'peek' || a.id === 'del')));
    const tintaPasso = isBox ? V.tintHue(p.tint) : null;
    const coloreBtn = isBox ? `<button class="pm-btn" data-round="tint" title="Colore del passo: il sotto-foglio ↗ lo ripete come sfondo" aria-label="Colore del passo"${tintaPasso != null ? ` style="background:hsl(${tintaPasso} 38% 95.5%);border-color:hsl(${tintaPasso} 26% 64%)"` : ''}>${RIC.tint}<span>Colore</span></button>` : '';
    let extra = ''; if (el.type === 'burst') extra += '<button class="btn small" id="pop-toplan">→ Aggiungi al piano</button>'; if (el.type === 'legend') extra += '<button class="btn small" id="pop-legendfull">Legenda completa</button>';
    // azioni a ICONE (esito 13): gli stessi tondi della barra rapida, una fonte sola (quickBtnHTML);
    // per il passo in coda c'è il Colore (esito 15: sceso dai tondi di testa)
    h += `<div class="actions pop-actions">${extra}${acts.map(a => UI.quickBtnHTML ? UI.quickBtnHTML(a, el, 'data-pa') : `<button class="btn small ${a.id === 'del' ? 'danger' : ''}" data-pa="${a.id}" title="${esc(a.title)}">${a.label}</button>`).join('')}${coloreBtn}</div>`;
    // le sezioni dei livelli (spec D): titolo gia' nell'HTML iniziale (cosi' l'altezza e' giusta
    // dal primo P.place), stato aperto/chiuso letto da localStorage PRIMA di scrivere l'HTML — un
    // livello toccato dal badge (opts.section) si apre sempre, qualunque fosse il suo stato salvato
    const secDefs = P.sections(el, map).map(s => {
      let salvato = null; try { salvato = localStorage.getItem('vsm.pop.sec.' + s.id); } catch (e) { /* storage bloccato */ }
      const aperto = opts.section === s.id ? true : salvato !== '0';
      return Object.assign({}, s, { aperto });
    });
    if (secDefs.length) h += secDefs.map(s => `<details class="pop-section" data-sec="${esc(s.id)}" ${s.aperto ? 'open' : ''}><summary>${esc(s.title || '')}</summary><div class="pop-sec-body" data-sec-body></div></details>`).join('');
    h += allegatiSezioneHTML(el, map);   // in coda: quello che si è raccolto camminando (D-15)
    h += minis; // i pannellini del passo: posizionati sopra il contenuto dal CSS, nascosti finché un tondo li chiama
    UI.hideQuick(); // il pop-up contiene le stesse azioni della barra rapida
    const pop = $('#pop'); pop.innerHTML = h; pop.classList.remove('hidden'); pop.classList.toggle('step', isBox); P.place(el);
    allegatiMonta(pop, el, map);
    // le sezioni si riempiono DOPO aver messo l'HTML nel DOM (render(host) chiede un host vero) —
    // e P.place si richiama alla fine, perche' SOLO ora si conosce l'altezza vera del pannello
    // (rapporto dom R2: «dopo l'ultimo riempimento»).
    if (secDefs.length) {
      const secEls = $$('.pop-section', pop);
      secDefs.forEach(s => {
        const d = secEls.find(x => x.dataset.sec === s.id); if (!d) return;
        const host = d.querySelector('[data-sec-body]');
        if (host) { try { s.render(host); } catch (e) { console.warn('livello "' + s.id + '": render() della sezione ha lanciato', e); } }
        d.addEventListener('toggle', () => { try { localStorage.setItem('vsm.pop.sec.' + s.id, d.open ? '1' : '0'); } catch (e) { /* storage bloccato */ } P.place(el); });
      });
      if (opts.section) { const target = secEls.find(x => x.dataset.sec === opts.section); if (target && target.scrollIntoView) target.scrollIntoView({ block: 'nearest' }); }
      P.place(el);
    }
    ensurePopRO();
    $('#pop-x').onclick = P.close; $('#pop-why').onclick = () => { const w = $('#pop-whytext'); w.classList.toggle('hidden'); $('#pop-why').setAttribute('aria-expanded', !w.classList.contains('hidden')); };
    $$('[data-pa]', pop).forEach(b => b.onclick = (ev) => { const a = b.dataset.pa; if (['dup', 'del', 'connect', 'lockto', 'lockall', 'peek', 'next'].includes(a)) P.close(); UI.quickAction(a, id, { x: ev.clientX, y: ev.clientY }); if (['invert', 'attach', 'unlock', 'legend'].includes(a) && V.byId(id)) P.open(id); });
    // il picker dei fogli (esito 16-b)
    const pf = $('#pop-fogli', pop);
    if (pf) pf.onclick = () => { P.close(); UI.openScegliMappa && UI.openScegliMappa(id); };
    // ELIMINA col doppio tocco (esito 15): il primo arma e si colora, il secondo elimina
    const delArm = $('#pop-del-arm', pop);
    if (delArm) delArm.onclick = () => {
      if (!delArm.classList.contains('armato')) { delArm.classList.add('armato'); delArm.textContent = 'Sicuro? Tocca di nuovo: elimina'; return; }
      P.close(); UI.quickAction('del', id);
    };
    // Ideale validato: il pop-up serve a leggere, i campi e le azioni restano spenti (la modifica riapre dal lucchetto)
    if (map.validated) $$('input,textarea,select,button', pop).forEach(x => { if (x.id !== 'pop-x' && x.id !== 'pop-why') x.disabled = true; });
    const tp = $('#pop-toplan'); if (tp) tp.onclick = () => { const plan = clone(map.plan); plan.push({ id: uid(), what: p.text || 'kaizen', who: p.owner || '', when: '', outcome: '', a3: true }); V.commit({ t: 'plan_set', after: plan }, 'piano'); UI.toast('Aggiunto al piano.'); UI.renderPlan(); };
    const ol = $('#pop-openlink'); if (ol) ol.onclick = () => UI.openMap(p.link);
    const lf = $('#pop-legendfull'); if (lf) lf.onclick = () => UI.toggleGuide(true, 'simboli');
    const cv = $('[data-convert]', pop); if (cv) cv.onchange = () => { const t = cv.value; if (!t) return; const before = clone(el); const T2 = V.TYPES[t]; const text = p.text || p.what || p.note || ''; const nprops = Object.assign(clone(T2.props), t === 'text' || t === 'storm' || t === 'fluffy' || t === 'burst' ? { text } : t === 'inventory' ? { what: text } : t === 'delta' ? { note: text, avg: p.avg || '' } : {}); if (p.link) nprops.link = p.link; const after = { type: t, w: T2.w, h: T2.h, props: nprops }; if ((t === 'storm' || t === 'fluffy') && text) after.h = Math.max(after.h, R.cloudFit(T2.w, text)); V.commit({ t: 'update', id, after, before: { type: before.type, w: before.w, h: before.h, props: before.props } }, 'trasforma'); P.open(id); };
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
        if (k === 'link' && v === '__new__') {
          // il nome del sotto-foglio si CHIEDE, col titolo del passo già scritto nel campo: un tocco
          // per confermare, due secondi per riscriverlo. Prima nasceva «dettaglio» in automatico e la
          // cartina diventava un elenco di rami tutti uguali. Il pop si chiude e si riapre alla fine:
          // se si tocca fuori dalla scheda, il select non resta fermo su una voce mai successa.
          P.close();
          UI.askNomeSottoFoglio(nomeProposto(map, el), (nome, indici) => {
            // l'elenco delle spunte c'era solo se il passo ha attività: in quel caso il foglio
            // nasce già con un passo per ogni spunta; altrimenti la creazione resta quella di sempre
            const d = indici ? V.buildDetailFromActivities(el, map, { nome, indici }) : V.createDetail(map, nome, id);
            // la struttura è ferma fuori da disegna/cammina (A2): un sotto-foglio nuovo non nasce, e va detto
            if (!d) { UI.toast(V.DENIED_MSG.fase); P.open(id); return; }
            V.commit({ t: 'props', id, after: { link: d.id } }, 'collega mappa');
            const nPassi = d.elements.filter(e => e.type === 'box').length;
            UI.toast(nPassi ? `Sotto-foglio creato con ${nPassi} ${nPassi === 1 ? 'passo' : 'passi'} già in fila: apri con ↗` : 'Sotto-foglio creato: apri con ↗');
            P.open(id);
          }, () => P.open(id), p.activities);
          return;
        }
        // scegliendo una mappa che non sta ancora sotto nessun passo, questo passo ne diventa il posto:
        // altrimenti l'albero avrebbe un ramo staccato e la cartina non saprebbe dove metterla.
        // Link e adozione stanno nella STESSA voce di annulla (V.linkMap): un annulla solo li riporta
        // indietro insieme, altrimenti la mappa restava appesa e il badge mentiva.
        if (k === 'link' && v) {
          V.linkMap(id, v);
          if (UI.renderCartina) UI.renderCartina();
          P.open(id); return;
        }
        const cur = V.byId(id); if (!cur) return;
        // chi «si reca» ci va quasi sempre di persona: il canale si mette da sé, in una sola voce di
        // undo, e resta cambiabile (c'è chi si reca in ambulanza). Il pop-up si ridisegna per mostrarlo.
        if (k === 'intent') {
          const after = { intent: v };
          if (v === 'si reca' && cur.props.channel !== 'di persona') after.channel = 'di persona';
          V.commit({ t: 'props', id, after }, 'intento della via');
          P.open(id); return;
        }
        // i tempi scritti a mano su passi e attese si FIRMANO col foglio (esito 13, tempiGiro):
        // sul giro nuovo un valore riscritto qui smette di essere «giro prec.»
        const firma = (cur.type === 'box' || cur.type === 'delta') && ['hi', 'lo', 'avg'].includes(k) ? { tempiGiro: map.id } : null;
        if (!final) { V.commit({ t: 'props', id, after: Object.assign({ [k]: v }, firma) }, 'modifica', { silent: true }); return; } // anteprima: nessuna voce di undo
        // una sola voce di undo per campo (dal focus al cambio)
        V.commit({ t: 'props', id, after: Object.assign({ [k]: v }, firma), before: Object.assign({ [k]: before === undefined ? cur.props[k] : before }, firma ? { tempiGiro: cur.props.tempiGiro } : null) }, 'modifica');
        before = undefined;
        // la nuvola cresce (o si stringe) da sola per far stare il testo: prima sforava sempre
        if (k === 'text' && ['storm', 'fluffy'].includes(cur.type) && !cur.props.collapsed) {
          const hh = R.cloudFit(cur.w, v);
          if (Math.abs(hh - cur.h) > 4) V.commit({ t: 'update', id, after: { h: hh }, before: { h: cur.h } }, 'misura della nuvola', { silent: true });
        }
        // la riga «Calcolati dalle misure di questo giro» smette di essere vera nell'istante in cui
        // uno dei tre numeri viene riscritto a mano: la marca decade da sola nel modello
        // (V.fonteDatiDi, contratto del 02-05) e la riga si ridisegna per dirlo. Solo in quel
        // passaggio, e solo se la riga c'era: un pannello che si ridisegna a ogni tasto perderebbe il filo.
        if (['hi', 'lo', 'avg'].includes(k) && $('[data-orig-calc]', pop) && V.fonteDatiDi(V.byId(id), map) !== 'calcolato') { P.open(id); return; }
        if (k === 'link') P.open(id);
      };
      inpEl.addEventListener('focus', () => { const cur = V.byId(id); before = cur ? clone(cur.props[k]) : undefined; });
      if (inpEl.tagName === 'SELECT' || inpEl.type === 'checkbox') inpEl.addEventListener('change', () => handler(true));
      else { inpEl.addEventListener('input', () => handler(false)); inpEl.addEventListener('change', () => handler(true)); }
    });
    $$('[data-pick]', pop).forEach(b => b.onclick = () => { const k = b.dataset.pick, v = b.dataset.v; const cur = V.byId(id); if (!cur) return;
      // la tinta non è una prop qualunque: V.setTint colora anche lo sfondo del sotto-foglio,
      // nella stessa voce di annulla — passare dal commit generico la lascerebbe a metà
      if (k === 'tint') {
        const hue = v === '' ? null : +v;
        if (V.tintHue(cur.props.tint) === hue) return;
        V.setTint(id, hue);
        $$('[data-pick="tint"]', pop).forEach(x => { const on = x.dataset.v === v; x.classList.toggle('on', on); x.setAttribute('aria-checked', on); });
        P.refresh(id);
        const rb = $('[data-round="tint"]', pop); // il tondo del colore indossa la tinta scelta
        if (rb) { if (hue == null) rb.removeAttribute('style'); else rb.style.cssText = `background:hsl(${hue} 38% 95.5%);border-color:hsl(${hue} 26% 64%)`; }
        return;
      }
      // l'ORIGINE della terna Hi/Lo/Avg (1B, D-06): un tocco = scritto, nessun bottone «Salva», e
      // la ↶ riporta indietro. La stessa pastiglia toccata due volte TOGLIE l'origine (undefined =
      // «togli la chiave», applyOp 'props'): è la via per tornare a «non dichiarata» senza un
      // quinto bottone. Passa dal commit generico dei props come ogni altra pastiglia del
      // pannello — nessuna via di scrittura nuova, e la porta delle fasi resta l'unica guardia.
      if (k === 'fonteDati') {
        const via = cur.props[k] === v;
        V.commit({ t: 'props', id, after: { [k]: via ? undefined : v } }, 'origine dei numeri');
        P.open(id); return;
      }
      if (k === 'shape') {
        if (V.shapeOf(cur) === v) return;
        V.setStormShape(V.map(), id, v);
        $$('[data-pick="shape"]', pop).forEach(x => { const on = x.dataset.v === v; x.classList.toggle('on', on); x.setAttribute('aria-checked', on); });
        return;
      }
      if (cur.props[k] === v) return; V.commit({ t: 'props', id, after: { [k]: v } }, k === 'mood' ? 'espressione' : 'icona'); $$(`[data-pick="${k}"]`, pop).forEach(x => { const on = x.dataset.v === v; x.classList.toggle('on', on); x.setAttribute(x.hasAttribute('role') ? 'aria-checked' : 'aria-pressed', on); }); const mm = $('[data-mood-mean]', pop); if (mm && k === 'mood') mm.textContent = V.MOOD_MEANING[v] || ''; });
    // la fascia delle quattro voci si apre SOTTO la riga dell'origine e si richiude toccando di
    // nuovo la parola: il pannello cresce, quindi si riposiziona (altrimenti la fascia nuova
    // finisce fuori dallo schermo, sotto il bordo)
    const oa = $('[data-orig-apri]', pop);
    if (oa) oa.onclick = () => {
      const apri = oa.getAttribute('aria-expanded') !== 'true';
      [$('[data-orig-fascia]', pop), $('[data-orig-nota]', pop)].forEach(x => { if (x) x.classList.toggle('hidden', !apri); });
      oa.setAttribute('aria-expanded', apri ? 'true' : 'false');
      P.place(el);
    };
    const mk = $('[data-mark]', pop);
    if (mk) mk.onchange = () => { V.setStormMark(V.map(), id, !mk.checked); P.open(id); };
    if (isBox) {
      // attività numerate, una riga ciascuna: svuotare una riga la toglie (come cancellare una riga
      // del vecchio testo unico). Una voce di annulla per riga, dal focus al cambio.
      const actsBox = $('[data-acts]', pop);
      const paintActs = (list, focusLast) => {
        const roA = (p.validated || map.validated) ? ' disabled' : '';
        actsBox.innerHTML = list.map((a, i) => `<div class="act-row"><span class="act-n">${i + 1}</span><input data-act-i="${i}" value="${esc(a)}" autocomplete="off" placeholder="${i === 0 ? 'prima attività (apre la porta)' : i === list.length - 1 && list.length > 1 ? 'ultima attività (chiude la porta)' : '…'}"${roA}></div>`).join('')
          + (roA ? '' : `<button class="btn small ghost act-add" data-act-add>+ aggiungi</button>`);
        $$('input[data-act-i]', actsBox).forEach(inpA => {
          let before;
          inpA.addEventListener('focus', () => { const cur = V.byId(id); before = cur ? clone(cur.props.activities || []) : []; });
          inpA.addEventListener('change', () => {
            const after = $$('input[data-act-i]', actsBox).map(x => x.value.trim()).filter(Boolean);
            V.commit({ t: 'props', id, after: { activities: after }, before: { activities: before } }, 'attività');
            // si ridisegna dal modello, non dai campi: una modifica rifiutata (✓ accesa) torna com'era
            const ora = V.byId(id); paintActs(ora ? (ora.props.activities || []).slice() : [], false);
          });
        });
        const add = $('[data-act-add]', actsBox);
        if (add) add.onclick = () => { const list2 = $$('input[data-act-i]', actsBox).map(x => x.value); list2.push(''); paintActs(list2, true); };
        if (focusLast) { const ins = $$('input[data-act-i]', actsBox); if (ins.length) ins[ins.length - 1].focus(); }
      };
      paintActs((p.activities || []).slice(), false);
      // i pannellini si aprono DENTRO il pannello, sotto la fila dei tondi e sopra il contenuto;
      // secondo tocco sullo stesso tondo richiude
      const paintMini = (name) => {
        $$('.pop-mini', pop).forEach(mn => mn.classList.toggle('hidden', mn.dataset.mini !== name));
        $$('[data-round]', pop).forEach(b => { const on = !!name && b.dataset.round === name; b.classList.toggle('aperto', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
        if (name) {
          const rr = $('.pop-rounds', pop), mn = $(`.pop-mini[data-mini="${name}"]`, pop);
          if (rr && mn) mn.style.top = (rr.offsetTop + rr.offsetHeight + 6) + 'px';
        }
      };
      $$('[data-round]', pop).forEach(b => b.onclick = () => { P._mini = (P._mini === b.dataset.round) ? null : b.dataset.round; paintMini(P._mini); });
      const stor = $('[data-storia]', pop);
      if (stor) stor.onclick = () => { P.close(); if (UI.openAnalisi) UI.openAnalisi(id); };
      if (P._mini && $(`.pop-mini[data-mini="${P._mini}"]`, pop)) paintMini(P._mini); else P._mini = null;
      // la ✓: validare costa un tocco; riaprire costa un tocco + conferma (è metodo, non interfaccia)
      const vb = $('[data-valid]', pop);
      if (vb) vb.onclick = () => {
        const cur = V.byId(id); if (!cur) return;
        if (cur.props.validated) confermaRiapriPasso(() => { V.setStepValidated(id, false); UI.toast('Passo riaperto: titolo, attività e tempi si modificano di nuovo.'); P.open(id); });
        else { V.setStepValidated(id, true); P._mini = null; P.open(id); UI.toast('Passo validato ✓: contenuto in sola lettura. Si sposta, si colora e si collega come prima.'); }
      };
      // «Sbircia» nel pannellino: stessa descrizione riscrivibile della scheda flottante — una voce
      // di annulla per riscrittura; vuota o uguale a quella automatica = chiave tolta, si ricalcola
      const sumMini = $('[data-peek-sum]', pop);
      if (sumMini) {
        const tgt = V.doc.maps[p.link]; const auto = V.describeMap(tgt);
        let beforeSum;
        sumMini.addEventListener('focus', () => { const cur = V.byId(id); beforeSum = cur && cur.props.summary; });
        sumMini.addEventListener('change', () => {
          const cur = V.byId(id); if (!cur) return;
          const v = sumMini.value.trim(); const after = (!v || v === auto) ? undefined : v;
          if (after === cur.props.summary || (after === undefined && cur.props.summary == null)) return;
          V.commit({ t: 'props', id, after: { summary: after }, before: { summary: beforeSum } }, 'descrizione del sotto-foglio');
        });
        const rg = $('[data-peek-regen]', pop);
        if (rg) rg.onclick = () => {
          const cur = V.byId(id); if (!cur) return;
          if (cur.props.summary == null) { sumMini.value = auto; return; }
          V.commit({ t: 'props', id, after: { summary: undefined }, before: { summary: cur.props.summary } }, 'descrizione del sotto-foglio');
          sumMini.value = auto;
        };
        const opk = $('[data-peek-open]', pop);
        if (opk) opk.onclick = () => UI.openMap(p.link);
      }
    }
    const af = pop.querySelector('[autofocus]'); if (af && !('ontouchstart' in window)) af.focus();
  };
  /** aggiorna anteprima e sottotitolo del pop-up aperto (dopo una modifica ai campi) */
  P.refresh = (id) => {
    const pop = $('#pop'); if (pop.classList.contains('hidden') || P.current !== id) return;
    const map = V.map(); const el = V.byId(id, map); if (!el) return;
    const pv = $('.pop-preview', pop); if (pv) pv.outerHTML = preview(el, map);
    const sb = $('.pop-sub', pop); if (sb) sb.textContent = subtitleOf(el, map);
    // anche i corpi delle sezioni dei livelli (F1): un commit esterno mentre il pop-up e' aperto
    // («Calcola i tempi», un annulla) lasciava la sezione con i numeri VECCHI — il foglio diceva
    // una cosa e il pannello un'altra. Solo i corpi: lo stato aperto/chiuso dei <details> e le
    // sezioni apparse/sparite si sistemano al prossimo P.open (il set cambia di rado).
    const secs = P.sections(el, map);
    $$('.pop-section', pop).forEach(d => {
      const s = secs.find(x => x.id === d.dataset.sec); const host = d.querySelector('[data-sec-body]');
      if (s && host) { try { s.render(host); } catch (e) { console.warn('livello "' + s.id + '": render() della sezione ha lanciato', e); } }
    });
  };
  /** Riscrive il SOLO numero della riga d'ingresso al Brief. Serve perché «Reparto / unità»
   *  (map.unitName) è una delle tredici voci contate da V.briefStato e si compila proprio qui
   *  dentro: senza questa riga chi lo riempie continuerebbe a leggere il numero dell'apertura
   *  finché non chiude e riapre. Si tocca solo lo <span>, non si ridisegna il pop-up: un ridisegno
   *  a ogni carattere fa perdere il filo e il cursore (stessa regola di briefVuotoAggiorna nel
   *  Brief e del campo del turno). textContent, non innerHTML: niente markup, niente da sfuggire. */
  const briefIngressoAggiorna = (pop) => { const k = pop && pop.querySelector('#pop-brief .k'); if (k) k.textContent = UI.briefConteggio(V.briefStato(V.map())); };
  P.openTitle = () => {
    const map = V.map(); const pop = $('#pop'); P.current = '__title__';
    const bs = V.briefStato(map);
    // Solo i campi, niente frasi-guida (feedback iPad 25/8, registrato anche in memoria): l'unità
    // di misura non si sceglie più qui (resta quella del foglio, il passaggio a h:mm:ss è un
    // lavoro a parte) e il numero di misure non si dichiara a mano: lo conta V.numMisure dalle
    // osservazioni del cronometro.
    pop.innerHTML = `<div class="pop-head"><b>Titolo, data, autori</b><button class="btn small ghost" id="pop-x" aria-label="Chiudi">✕</button></div>
      ${field('Titolo', `<input data-m="title" value="${esc(map.title)}" autofocus>`)}<div class="row">${field('Data', `<input data-m="date" type="date" value="${esc(map.date)}">`)}${field('Iniziali autori', `<input data-m="authors" value="${esc(map.authors)}">`)}</div>${field('Reparto / unità', `<input data-m="unitName" value="${esc(map.unitName)}">`)}${field('Scopo in una frase', `<textarea data-m="scope" placeholder="Dalla richiesta di … alla consegna di …">${esc(map.scope)}</textarea>`)}${field('Responsabile unico del disegno', `<input data-tdrawer value="${esc(map.prep.drawer || '')}" autocomplete="off">`)}`
      // La riga d'ingresso al MAP BRIEF (D-01, UI-SPEC §1): il mandato della mappa è una scheda a
      // parte, e da qui si raggiunge. Il conteggio è un promemoria, non un requisito (D-02) — nel
      // menu ⋯ non entra niente: D-20 gli assegna una voce sola, ed è della salute della mappa.
      + `<button type="button" class="brief-ingresso" id="pop-brief"><span>Brief della mappa</span>`
      // la frase del conteggio (singolare compreso) vive in panels.js, in un posto solo: qui si
      // chiede a UI, dentro il gestore — a runtime panels.js c'è già, come per UI.openBrief
      + `<span class="k">${esc(UI.briefConteggio(bs))}</span><span class="chev" aria-hidden="true">›</span></button>`;
    pop.classList.remove('hidden'); pop.classList.remove('step'); const st = $('#stage').getBoundingClientRect(); const hr = $('#map-head').getBoundingClientRect(); pop.style.left = Math.max(10, Math.min(st.width - 340, hr.left - st.left)) + 'px'; pop.style.top = '10px';
    $('#pop-x').onclick = P.close;
    // il Brief vive in panels.js (si carica DOPO questo file): la lettura sta dentro il gestore,
    // che gira quando UI.openBrief c'è già — stessa via di #pop-fogli → UI.openScegliMappa
    const pb = $('#pop-brief', pop); if (pb) pb.onclick = () => { P.close(); if (UI.openBrief) UI.openBrief(); };
    const td = $('[data-tdrawer]', pop); td.addEventListener('input', () => { const after = Object.assign(clone(V.map().prep), { drawer: td.value }); V.commit({ t: 'meta', after: { prep: after } }, 'intestazione', { silent: true }); });
    $$('[data-m]', pop).forEach(e => {
      const k = e.dataset.m; let before;
      const commit = (final) => { if (!final) { V.commit({ t: 'meta', after: { [k]: e.value } }, 'intestazione', { silent: true }); return; } V.commit({ t: 'meta', after: { [k]: e.value }, before: { [k]: before === undefined ? V.map()[k] : before } }, 'intestazione'); before = undefined; };
      e.addEventListener('focus', () => { before = V.map()[k]; });
      // il numero della riga d'ingresso si rinfresca a ogni scrittura: oggi lo muove solo
      // `unitName`, ma chiederlo sempre costa il testo di uno <span> e non lascia indietro
      // nessuno se un domani il Brief conterà anche un'altra voce dell'intestazione
      if (e.tagName === 'SELECT') e.addEventListener('change', () => { commit(true); briefIngressoAggiorna(pop); });
      else { e.addEventListener('input', () => { commit(false); briefIngressoAggiorna(pop); }); e.addEventListener('change', () => { commit(true); briefIngressoAggiorna(pop); }); }
    });
    if (map.validated) $$('input,textarea,select', pop).forEach(x => { x.disabled = true; });
  };


  /** Le sezioni dei livelli (spec B/D): un elenco { id, title, render(host) } per ogni livello
   *  ACCESO e ammesso dalla fase corrente (V.layers.active), nell'ordine di registrazione — la
   *  stessa lista che decide il disegno dei badge/overlay. render(host) riempie il DOM del suo host
   *  (non ritorna una stringa: un livello puo' avere bisogno di legare eventi ai suoi campi). In
   *  fase 0 questa lista e' quasi sempre vuota (il riepilogo non ha una sezione: e' una card di
   *  foglio, non un dettaglio per elemento — i livelli VERI con sezione arrivano con F1). */
  P.sections = (el, map) => {
    if (!el || !map) return [];
    const ix = V.index(map);
    return V.layers.active(map).map(l => {
      if (!l.section) return null;
      // Stessa guardia di R.overlay/R.contentBox (js/render.js, Task 7): un livello di terzi con
      // una section() che lancia non deve far sparire il resto del pop-up — ma qui, a differenza
      // di render.js, il catch era silenzioso (nessun console.warn): rilievo della revisione
      // avversariale, seconda passata (Kimi K3).
      let s; try { s = l.section(el, map, ix); } catch (e) { console.warn('livello "' + l.id + '": section() ha lanciato', e); s = null; }
      if (!s) return null;
      return { id: l.id, title: s.title, render: s.render };
    }).filter(Boolean);
  };

  /** Riavvia P.place quando il pannello cambia misura DA SOLO (rapporto dom R2): un carattere che
   *  finisce di caricare, una sezione di livello che si apre/chiude, 40 osservazioni che allungano
   *  il pannello — nessuno di questi passa da un tocco che richiamerebbe P.place per conto suo. */
  // sentinelle di P.current per i contenuti di #pop che non sono un elemento del foglio (spec D +
  // rilievo Important della revisione: senza, un pop-up non-elemento apparso mentre P.current
  // teneva ancora l'id di un passo faceva scattare P.place(quel passo) — il ResizeObserver sotto
  // spostava «Livelli di analisi…»/«Matita» accanto all'ultimo elemento aperto, non dov'era).
  // '__layers__' (UI.layersMenu) e '__ink__' (UI.inkOptions) vivono in panels.js: elencate qui per
  // chiarezza, anche se V.byId su una qualunque di queste stringhe non trova comunque nulla.
  const NON_ELEMENTO = new Set(['__title__', '__attach__', '__projects__', '__layers__', '__ink__']);
  // le bolle ⓘ (esito 16-a): delega globale — un tocco sulla ⓘ apre la sua bolla (e chiude le
  // altre), un tocco ovunque fuori le chiude tutte. Vale per ogni field con hint, ovunque appaia.
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('click', (e) => {
      const dot = e.target && e.target.closest ? e.target.closest('[data-hintdot]') : null;
      document.querySelectorAll('.hintpop').forEach(hp => { if (!dot || hp !== dot.nextElementSibling) hp.classList.add('hidden'); });
      if (dot) { const hp = dot.nextElementSibling; if (hp) hp.classList.toggle('hidden'); e.preventDefault(); e.stopPropagation(); }
    }, true);
  }
  let popRO = null;
  const ensurePopRO = () => {
    if (popRO || typeof ResizeObserver === 'undefined') return;
    const pop = $('#pop'); if (!pop) return;
    popRO = new ResizeObserver(() => {
      if (!P.current || NON_ELEMENTO.has(P.current)) return;
      const el = V.byId(P.current); if (el) P.place(el);
    });
    popRO.observe(pop);
  };
})(window.VSM);
