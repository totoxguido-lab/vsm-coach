/* VSM Coach v2 — interact.js: vista (pan/zoom), strumenti, gesti penna/dito/mouse, creazione, trascinamento, inchiostro. */
/* SCRITTURE FUORI COMMIT (censimento, spec fondamenta A6). Il trascinamento in corso scrive
 * x/y (o props.dx/dy per i bloccati) direttamente a ogni movimento (case 'drag', ~riga 326)
 * e committa al rilascio; idem 'via' (pieghe), 'chan' (props.t) e 'resize' (w/h). In quel
 * tratto map.rev NON si muove: il riepilogo si ridisegna con la chiave rev+':drag' (render).
 * Fuori dal gesto, chi scrive senza commit DEVE alzare rev da sé: attachUnder (model),
 * la rinomina del giro (main.js), sanitizeMap, buildDetailFromActivities (model.js) e
 * I.groupToDetail qui sotto (elements/parentStepId del sotto-foglio appena nato).
 * Unica eccezione dichiarata: i fogli appena nati, popolati prima del primo indice (V.example) —
 * V.index(map) non ha ancora nessuna memo per quell'oggetto, quindi la prima lettura e' già
 * fresca da sé e un bump non cambierebbe niente. Nessun'altra scrittura fuori censimento. */
(function (V) {
  'use strict';
  const R = V.render; const { uid, clone } = V.util;
  const I = V.interact = { tool: 'select', selection: [], view: { x: -40, y: -40, k: 1 }, penDraws: true, fingerPans: true, ink: { color: '#2b2b2b', width: 1.8 } };
  let svg, stage;
  const ptrs = new Map(); let gesture = null;
  // un dito (o la penna) e' a terra: il menu delle azioni rapide non deve comparire adesso ma al rilascio
  I.gestureBusy = () => ptrs.size > 0;
  let nudgeSession = null, nudgeTimer = null;
  /** Chiude la raffica di frecce da tastiera registrandone UNA voce da annullare. Va chiamata anche
   *  prima di un altro gesto o di un annulla: la voce ancora aperta avrebbe messo insieme lo spostamento
   *  da tastiera e quello che e' successo dopo, e l'annulla saltava troppo indietro. */
  function flushNudge() {
    clearTimeout(nudgeTimer); nudgeTimer = null;
    const s = nudgeSession; nudgeSession = null; if (!s) return;
    const map = s.map; if (!map || !V.doc.maps[map.id]) return;
    const ops = s.ids.split(',').map(id => {
      const el = V.byId(id, map); if (!el) return null; const b = s.before.get(id);
      return s.attached(el) ? { t: 'props', id, after: { dx: el.props.dx, dy: el.props.dy }, before: { dx: b.dx, dy: b.dy } }
        : { t: 'update', id, after: { x: el.x, y: el.y }, before: { x: b.x, y: b.y } };
    }).filter(Boolean).filter(op => JSON.stringify(op.after) !== JSON.stringify(op.before));
    if (ops.length) V.commit(ops, 'sposta (tastiera)', { map });
  }
  I.flushNudge = flushNudge;
  const TOOL_KINDS = { select: 'select', pan: 'pan', ink: 'ink', eraser: 'eraser', area: 'area', flow: 'connect', request: 'connect', whatis: 'whatis' };
  I.kindOf = (t) => TOOL_KINDS[t] || 'create';

  // ---------- vista ----------
  const applyView = () => { const W = stage.clientWidth || 800, H = stage.clientHeight || 600; svg.setAttribute('viewBox', `${I.view.x} ${I.view.y} ${W / I.view.k} ${H / I.view.k}`); if (V.ui && V.ui.onView) V.ui.onView(); };
  I.applyView = applyView;
  // «stampa in corso» (spec C, R7 del rapporto dom — rilievo Important della revisione): @media
  // print cambia davvero la misura di #stage (app.css: #stage{position:static}), e il
  // ResizeObserver qui sotto richiamava applyView() — che scrive il viewBox dal RAPPORTO DELLO
  // STAGE (W/I.view.k, H/I.view.k) — SOPRA il viewBox della carta appena scritto da I.fit({paper:
  // true}). Fra beforeprint e afterprint (main.js) il ResizeObserver dello stage non tocca piu'
  // il viewBox: la carta resta la carta finche' la stampa non e' finita.
  let printing = false;
  I.setPrinting = (on) => { printing = on; };
  I.toWorld = (cx, cy) => { const p = svg.createSVGPoint(); p.x = cx; p.y = cy; const m = svg.getScreenCTM(); if (!m) return { x: 0, y: 0 }; const q = p.matrixTransform(m.inverse()); return { x: q.x, y: q.y }; };
  I.toScreen = (x, y) => { const p = svg.createSVGPoint(); p.x = x; p.y = y; const q = p.matrixTransform(svg.getScreenCTM()); const r = stage.getBoundingClientRect(); return { x: q.x - r.left, y: q.y - r.top }; };
  I.zoomAt = (factor, cx, cy) => { const w0 = I.toWorld(cx, cy); I.view.k = Math.min(6, Math.max(0.15, I.view.k * factor)); applyView(); const w1 = I.toWorld(cx, cy); I.view.x += w0.x - w1.x; I.view.y += w0.y - w1.y; applyView(); saveView(); };
  /** riquadro del disegno (elementi + tratti); null se il foglio è vuoto */
  I.contentBox = (map) => {
    map = map || V.map(); if (!map) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    map.elements.forEach(el => { if (V.isConnector(el)) return; const p = R.elPos(el, map); x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x + el.w); y1 = Math.max(y1, p.y + el.h); });
    // il cartiglio non entra nel riquadro di proposito: su un foglio grande costringerebbe l'inquadratura
    // all'angolo in alto a destra rimpicciolendo il disegno, e il titolo si legge comunque nell'intestazione
    (map.strokes || []).forEach(s => s.points.forEach(([px, py]) => { x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py); }));
    if (!isFinite(x0)) return null;
    return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
  };
  /** inquadra il disegno (il foglio ora è grande: adattarlo tutto renderebbe il lavoro minuscolo).
   *  I.fit({ paper: true }) inquadra invece l'intero foglio — serve per la stampa. */
  I.fit = (opts = {}) => {
    const W = stage.clientWidth, H = stage.clientHeight; const P = V.paperOf(V.map());
    let box = opts.paper ? null : I.contentBox();
    if (box) { const m = 60; box = { x: box.x - m, y: box.y - m, w: box.w + m * 2, h: box.h + m * 2 }; }
    else box = { x: -40, y: -40, w: P.w + 80, h: P.h + 80 };
    const k = Math.min(W / box.w, H / box.h);
    I.view.k = k;
    if (opts.paper) {
      // La stampa inquadra le proporzioni della CARTA (spec C, R7 del rapporto dom), non quelle
      // dello schermo: applyView() scrive nel viewBox il rapporto W/H dello STAGE (e' giusto per
      // lo schermo, dove lo svg riempie proprio lo stage) — su un iPad in verticale (834×1112) il
      // foglio 2376×1680 veniva tagliato invece di stare intero. Qui il viewBox si scrive
      // DIRETTAMENTE dal box, che ha gia' il rapporto della carta (paper + margine), bypassando
      // il W/H dello schermo.
      I.view.x = box.x; I.view.y = box.y;
      svg.setAttribute('viewBox', `${box.x} ${box.y} ${box.w} ${box.h}`);
      if (V.ui && V.ui.onView) V.ui.onView();
    } else {
      I.view.x = box.x - (W / k - box.w) / 2; I.view.y = box.y - (H / k - box.h) / 2;
      applyView();
    }
    saveView();
  };
  const saveView = () => { const m = V.map(); if (m) { m.view = clone(I.view); V.save(); } };
  I.restoreView = () => { const m = V.map(); if (m && m.view) { I.view = clone(m.view); applyView(); } else I.fit(); };

  // ---------- selezione ----------
  I.select = (ids, opts = {}) => { I.selection = Array.from(new Set(ids)).filter(id => V.byId(id)); R.selection(I.selection, V.map()); if (!opts.keepPop) V.pop && V.pop.close(); V.ui && V.ui.onSelection && V.ui.onSelection(I.selection); };
  I.setTool = (t, opts = {}) => { if (I.pickConn) I.cancelPickConnect(); I.tool = t; svg.className.baseVal = 'tool-' + I.kindOf(t) + ' t-' + t; V.ui && V.ui.onTool && V.ui.onTool(t, opts); if (t !== 'select') { V.pop && V.pop.close(); V.ui.hideQuick && V.ui.hideQuick(); } else V.ui.onSelection && V.ui.onSelection(I.selection); };

  // ---------- helpers ----------
  const hitEl = (target) => { const g = target && target.closest && target.closest('[data-id]'); return g ? { id: g.dataset.id, g, type: g.dataset.type } : null; };
  // durante il pointer capture e.target è l'svg: usa elementFromPoint
  const hitAt = (e) => hitEl(document.elementFromPoint(e.clientX, e.clientY));
  /** Elemento piu' vicino al punto, entro `px` pixel di schermo. Col dito il bersaglio esatto non si
   *  prende sempre: chiedere il colpo perfetto costringeva a ripetere il gesto. Se il punto e' dentro
   *  un elemento la distanza e' 0, quindi il contenuto vince sempre sul semplice "vicino". */
  /** Che cosa puo' stare in fondo a un collegamento. Senza questo elenco si potevano tirare frecce
   *  verso la legenda, una nota di testo o una nuvola: agganciate per il programma, senza senso sul foglio. */
  I.CONN_TARGETS = { flow: ['box', 'inventory', 'inbox'], request: ['box', 'inventory', 'inbox'] };
  I.CONN_SOURCES = { flow: ['box', 'inventory', 'inbox'], request: ['person'] };
  /** Bersagli che hanno senso da una data partenza. Da scorta e in-box la freccia va a un passo:
   *  una scorta che nasce da una scorta (o un in-box da un in-box) sul foglio non dice niente.
   *  Lo strumento Flusso tirato a mano resta libero (carta e matita): la scelta assistita guida. */
  I.connTargetsFrom = (ctype, fromType) => {
    const all = I.CONN_TARGETS[ctype] || [];
    return ctype === 'flow' && (fromType === 'inventory' || fromType === 'inbox') ? all.filter(t => t === 'box') : all;
  };
  const nearEl = (w, map, px = 28, skip = [], only = null) => {
    // la tolleranza segue lo zoom, ma con un tetto: a foglio intero 28 px valevano ~190 unita' di mondo
    // e il rilascio si agganciava a qualunque cosa passasse di li'
    const tol = Math.min(px / I.view.k, 70); let best = null, bd = tol;
    (map.elements || []).forEach(el => {
      if (V.isConnector(el) || el.type === 'lane' || skip.includes(el.id)) return;
      if (only && !only.includes(el.type)) return;
      const q = R.elPos(el, map), z = R.elSize(el);
      const dx = Math.max(q.x - w.x, 0, w.x - (q.x + z.w)), dy = Math.max(q.y - w.y, 0, w.y - (q.y + z.h));
      const d = Math.hypot(dx, dy);
      if (d < bd) { bd = d; best = el; }
    });
    return best;
  };
  I.nearEl = nearEl;
  /** Connettore la cui linea passa entro `px` pixel dal punto (serve a non farsi rubare il tocco
   *  dal rettangolo invisibile di un elemento che ci sta sopra). */
  const nearConn = (w, map, px = 12, excludeEl = null) => {
    // tolleranza in soli pixel di schermo: il pavimento in unita' di mondo, a zoom panoramico,
    // trasformava il cerchio di cattura in un disco che copriva mezzo omino
    const tol = px / I.view.k; let best = null, bd = tol;
    (map.elements || []).forEach(c => {
      if (!V.isConnector(c)) return;
      // le frecce ancorate all'elemento stesso non gli rubano il tocco: vicino all'ancoraggio
      // vincerebbero sempre loro, e l'elemento tornerebbe imprendibile (il male che curiamo)
      if (excludeEl && (c.from.el === excludeEl || c.to.el === excludeEl)) return;
      const P = R.connPath(c, map); if (!P || !P.pts || P.pts.length < 2) return;
      const pts = P.pts;
      for (let i = 0; i < pts.length - 1; i++) { const d = distToSeg(w, pts[i], pts[i + 1]); if (d < bd) { bd = d; best = c; } }
    });
    return best;
  };
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const pinchInfo = () => { const [a, b] = Array.from(ptrs.values()); return { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; };
  const stagePt = (e) => { const r = stage.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  I.hint = (msg, ms = 2500) => { const h = document.getElementById('hint'); if (!msg) { h.classList.add('hidden'); return; } h.textContent = msg; h.classList.remove('hidden'); clearTimeout(I._ht); if (ms) I._ht = setTimeout(() => h.classList.add('hidden'), ms); };

  function effectiveTool(e, hit) {
    if (e.pointerType === 'pen' && I.penDraws && (I.tool === 'select' || I.tool === 'pan' || I.tool === 'ink')) { if (I.tool === 'ink' || !hit) return 'ink'; return 'select'; }
    return I.tool;
  }
  const seenOnce = (k, msg) => { try { if (localStorage.getItem('vsm.seen.' + k)) return; localStorage.setItem('vsm.seen.' + k, '1'); } catch (e) { /* storage bloccato */ } I.hint(msg, 6000); };

  // ---------- pointer FSM ----------
  function down(e) {
    if (e.button !== undefined && e.button > 0 && e.pointerType === 'mouse') { if (e.button === 1) { startPan(e); return; } return; }
    // Palmo appoggiato mentre si scrive con la penna: il dito non deve rubare il gesto alla punta.
    // Prima il tocco faceva ripulire l'elenco dei puntatori, il tratto in corso restava orfano nel
    // disegno (mai committato) e i movimenti successivi della penna finivano a spostare la vista.
    if (e.pointerType === 'touch' && gesture && gesture.type === 'ink' && gesture.pen) return;
    flushNudge(); // una raffica di frecce da tastiera si chiude qui: non deve inglobare il gesto che comincia
    // se la cattura del puntatore fallisce (succede con eventi sintetici e su qualche browser) il gesto
    // deve comunque partire: prima un'eccezione qui buttava via l'intero tocco
    try { svg.setPointerCapture(e.pointerId); } catch (err) { /* si prosegue senza cattura */ }
    // rete di sicurezza: il PRIMO dito di un tocco nuovo (isPrimary) certifica che non c'e' nessun altro
    // dito a terra. Un puntatore rimasto appeso (pointerup perso su un popup comparso sotto il dito)
    // faceva contare 2 puntatori a ogni tocco singolo: il pan diventava per sempre un pinch.
    // Un gesto rimasto appeso va ANNULLATO, non solo dimenticato: prima drag/resize/via avevano gia'
    // mosso la geometria e restavano cosi', senza nemmeno una voce da annullare.
    if (e.isPrimary && e.pointerType !== 'mouse' && ptrs.size) { ptrs.clear(); if (gesture) { const g = gesture; gesture = null; abortGesture(g); } }
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2) { // due dita: si passa allo zoom, e il gesto in corso si annulla per intero
      const g = gesture; gesture = null; abortGesture(g);
      const p = pinchInfo(); gesture = { type: 'pinch', d0: p.d, k0: I.view.k, c0: I.toWorld(p.cx, p.cy) }; return;
    }
    if (ptrs.size > 2) return;
    const map = V.map(); const w = I.toWorld(e.clientX, e.clientY);
    const handleTarget = e.target.closest && e.target.closest('[data-handle],[data-endhandle],[data-chan-handle]');
    let hit = hitEl(e.target);
    // Un nodo rimasto nel disegno di un'altra mappa non e' un bersaglio: senza questa riga
    // V.byId tornava undefined e il primo tocco moriva con un errore, bloccando tutto il foglio.
    if (hit && !V.byId(hit.id, map)) hit = null;
    // Il rettangolo invisibile sta in uno strato sopra i connettori: senza questo, una freccia che passa
    // sotto un omino (o sotto il suo nome) non si poteva piu' toccare. Se il tocco cade proprio sulla linea,
    // il connettore vince. Vale solo per il rettangolo di comodo, non per il disegno vero dell'elemento.
    const onPad = e.target.classList && e.target.classList.contains('el-hit');
    if (onPad && (I.tool === 'select' || I.tool === 'whatis')) {
      const near = nearConn(w, map, 12, hit && hit.id);
      if (near) hit = { id: near.id, g: null, type: near.type };
    }
    const t = effectiveTool(e, (onPad && e.pointerType === 'pen') ? null : (hit || handleTarget));
    const kind = I.kindOf(t);
    // Ideale validato (lucchetto chiuso): si naviga, si guarda, non si tocca. Il tocco di selezione
    // resta (per leggere i dettagli) ma non trascina; ogni modifica e' comunque rifiutata da V.commit.
    const frozen = !!map.validated;
    if (frozen && !['select', 'pan', 'whatis'].includes(t)) { I.hint('Ideale validato \u{1F512}: apri il lucchetto in alto per modificarlo.', 2500); gesture = { type: 'noop' }; return; }
    if (e.pointerType === 'pen') seenOnce('pen', 'Penna: sulla carta vuota scrivi a matita; sugli elementi selezioni e sposti. Cambia in ⋯ → "Penna = matita".');
    else if (e.pointerType === 'touch') seenOnce('touch', 'Un dito: tocca un elemento per le azioni rapide, trascina per spostarlo, sul vuoto sposti il foglio. Due dita: zoom.');
    // l'occhio prima del badge: i due si sfiorano e il colpo diretto deve vincere. Il pop-up si apre
    // al RILASCIO (case 'peek' in up): mai interfaccia nuova sotto il dito a meta' gesto.
    if (e.target.closest && e.target.closest('[data-peek]')) { const g2 = e.target.closest('[data-peek]'); gesture = { type: 'peek', boxId: g2.dataset.box, link: g2.dataset.peek }; return; }
    if (e.target.closest && e.target.closest('[data-link]')) { const link = e.target.closest('[data-link]').dataset.link; gesture = { type: 'link', link }; return; }
    // il badge di un livello (spec C): si apre al RILASCIO, come l'occhio e il collegamento — mai
    // un pop-up nuovo sotto il dito a meta' gesto.
    if (e.target.closest && e.target.closest('.badge[data-el]')) { const g2 = e.target.closest('.badge[data-el]'); gesture = { type: 'badge', elId: g2.dataset.el, layer: g2.dataset.layer }; return; }
    if (I.pickConn && !V.byId(I.pickConn.from, map)) I.cancelPickConnect(); // la partenza non c'e' piu' (undo/elimina): il tocco prosegue normale
    if (I.pickConn) {
      const pc = I.pickConn;
      // conta solo il colpo diretto: lo snap "al piu' vicino" trasformava il tocco sul vuoto
      // (che qui promette di ANNULLARE) in un collegamento a sorpresa
      const tgtEl = hit && V.byId(hit.id, map);
      const tgt = tgtEl && !V.isConnector(tgtEl) && tgtEl.id !== pc.from && (pc.okTypes || I.CONN_TARGETS[pc.ctype]).includes(tgtEl.type) ? hit.id : null;
      // colpo a segno: niente ritorno al menu, sta per aprirsi il pop-up del collegamento
      I.cancelPickConnect({ quiet: !!tgt });
      if (tgt) I.connectTo(pc.from, tgt, pc.ctype, { intent: pc.intent });
      gesture = { type: 'noop' }; return;
    }
    if (I.pickLock) { const kids = I.pickLock; if (hit && !kids.includes(hit.id)) { I.cancelPickLock(); if (!I.lockMany(kids, hit.id)) I.hint('Non si può legare a questo elemento.', 2500); } else if (!hit) I.cancelPickLock(); gesture = { type: 'noop' }; return; }
    if (e.target.closest && e.target.closest('[data-toggle-legend]')) { gesture = { type: 'legend', id: e.target.closest('[data-toggle-legend]').dataset.toggleLegend }; return; }
    if (e.target.closest && e.target.closest('[data-place]')) { const g = e.target.closest('[data-place]'); gesture = { type: 'place', kind: g.dataset.place, x: +g.dataset.px, y: +g.dataset.py }; return; }
    if (t === 'whatis') { // modalita' «?»: il tocco spiega l'elemento invece di selezionarlo; sul vuoto si sposta il foglio.
      // La scheda si apre al RILASCIO: aperta al pointerdown finiva sotto il dito e si mangiava il
      // pointerup dell'svg — il puntatore restava appeso e il pan successivo diventava un pinch.
      if (hit) { gesture = { type: 'whatis', hitId: hit.id }; return; }
      if (V.ui.closeGuideCard) V.ui.closeGuideCard(); startPan(e); return;
    }
    if ((t === 'select' || kind === 'create') && !frozen) {
      const ch = e.target.closest && e.target.closest('[data-chan-handle]'); if (ch) { const c = V.byId(ch.dataset.chanHandle, map); gesture = { type: 'chan', id: c.id, t0: c.props.t == null ? 0.5 : c.props.t, startClient: { x: e.clientX, y: e.clientY }, moved: false }; return; }
      const eh = e.target.closest && e.target.closest('[data-endhandle]'); if (eh) { gesture = { type: 'reconnect', id: eh.dataset.conn, end: eh.dataset.endhandle, moved: false }; V.ui.hideQuick && V.ui.hideQuick(); return; }
      const rh = e.target.closest && e.target.closest('[data-handle]'); if (rh) { const el = V.byId(rh.dataset.handle, map); if (el) { if (el.props.pinned) { I.hint('Bloccato sul foglio \u{1F512}: si sblocca dalle azioni rapide.', 2500); gesture = { type: 'noop' }; return; } gesture = { type: 'resize', id: el.id, start: w, w0: el.w, h0: el.h }; return; } }
    }
    if (t === 'pan' || (e.pointerType === 'touch' && I.fingerPans && (t === 'select' && !hit) )) { startPan(e); return; }
    if (t === 'area') { gesture = { type: 'lasso', start: w, startClient: { x: e.clientX, y: e.clientY }, shift: e.shiftKey, fromTool: true }; return; }
    if (t === 'ink') { const s = { id: uid(), color: I.ink.color, width: I.ink.width, points: [[+w.x.toFixed(1), +w.y.toFixed(1)]] }; gesture = { type: 'ink', s, pathEl: R.addStrokeEl(s), last: w, pen: e.pointerType === 'pen' }; return; }
    if (t === 'eraser') { gesture = { type: 'erase', removed: [] }; eraseAt(w, gesture); return; }
    if (kind === 'connect') {
      const src = hit && V.byId(hit.id, map);
      // la partenza si controlla subito: prima si poteva iniziare il gesto da una nuvola o dalla legenda,
      // e il rifiuto arrivava solo alla fine (o peggio, il menu rotondo creava il collegamento comunque)
      if (!src || V.isConnector(src) || !I.CONN_SOURCES[t].includes(src.type)) { I.hint(t === 'flow' ? 'Freccia di flusso: parti da un passo e trascina fino al passo successivo.' : 'Via di richiesta: parti dal richiedente (omino) e trascina fino al primo passo.'); gesture = { type: 'noop' }; return; }
      gesture = { type: 'connect', ctype: t, from: hit.id, start: w, moved: false }; return;
    }
    if (kind === 'create') { gesture = { type: 'create', ctype: t, start: w, startClient: { x: e.clientX, y: e.clientY }, connHit: (t === 'delta' && e.target.classList.contains('conn-hit')) ? hit && hit.id : null }; return; }
    // trascinare la LINEA di un connettore (non i cerchi alle estremita') piega il percorso:
    // si prende il punto di via piu' vicino, o se ne crea uno nuovo dove si e' toccato
    // vale sia il tocco diretto sulla linea (conn-hit) sia quello arrivato dal margine di un elemento
    // vicino via nearConn (caso tipico: il delta agganciato copre il centro della freccia)
    if (hit && t === 'select' && !frozen && V.isConnector(V.byId(hit.id, map)) && e.target.classList && (e.target.classList.contains('conn-hit') || e.target.classList.contains('el-hit'))) {
      const c = V.byId(hit.id, map); const via = Array.isArray(c.props.via) ? c.props.via.map(v2 => ({ x: v2.x, y: v2.y })) : [];
      const grab = 16 / I.view.k; let idx = -1;
      via.forEach((v2, i2) => { if (Math.hypot(v2.x - w.x, v2.y - w.y) < grab && idx < 0) idx = i2; });
      gesture = { type: 'via', id: c.id, via, idx, before: clone(c.props.via) || null, start: w, startClient: { x: e.clientX, y: e.clientY }, moved: false, hitId: c.id, wasSelected: I.selection.includes(c.id) };
      return;
    }
    // select
    if (hit) {
      const el = V.byId(hit.id, map); const wasSelected = I.selection.includes(hit.id);
      if (!wasSelected) I.select([hit.id], { keepPop: true });
      // gli elementi col lucchetto chiuso (pinned) non si trascinano: proteggono dagli spostamenti per sbaglio
      const moving = frozen ? [] : I.selection.map(id => V.byId(id, map)).filter(x => x && !V.isConnector(x) && !x.props.pinned);
      gesture = { type: 'drag', wasSelected, ids: moving.map(x => x.id), start: w, startClient: { x: e.clientX, y: e.clientY }, before: moving.map(x => (x.props.lockTo || (x.type === 'delta' && x.props.attachedTo)) && !moving.some(p => p.id === (x.props.lockTo || x.props.attachedTo)) ? { id: x.id, dx: x.props.dx || 0, dy: x.props.dy || 0, attached: true } : (x.props.lockTo || (x.type === 'delta' && x.props.attachedTo)) ? { id: x.id, skip: true } : { id: x.id, x: x.x, y: x.y }), moved: false, hitId: hit.id, isConn: V.isConnector(el), hitPinned: !!(el && el.props && el.props.pinned) };
      return;
    }
    gesture = { type: 'lasso', start: w, startClient: { x: e.clientX, y: e.clientY }, shift: e.shiftKey };
  }
  /** Annulla un gesto senza confermare niente: quel che era stato mosso torna dov'era, quel che stava
   *  per nascere non nasce. Serve a due situazioni che prima finivano dritte in up(), cioe' venivano
   *  CONFERMATE: il pointercancel del sistema (gesto del browser, notifica, app mandata in sottofondo,
   *  palmo) e il puntatore rimasto appeso. Un collegamento interrotto a meta' diventava una freccia
   *  vera, un elemento a meta' nasceva davvero, una piega si fissava. */
  function abortGesture(g) {
    if (!g) return;
    if (g.type === 'ink' && g.pathEl) g.pathEl.remove();
    if (g.type === 'erase') g.removed.forEach(s => { const elx = svg.querySelector(`[data-sid="${s.id}"]`); if (elx) elx.style.opacity = ''; });
    if (['drag', 'resize', 'chan', 'via'].includes(g.type)) rollback(g);
    if (g.type === 'pan' || g.type === 'pinch') saveView(); // la vista gia' spostata resta dov'e', ma va registrata
    svg.style.cursor = '';
    R.ghost('');
    // il fantasma e gli anelli di selezione dividono lo stesso strato: cancellando l'uno spariva l'altro
    R.selection(I.selection, V.map());
  }
  function rollback(g) {
    const map = V.map();
    if (g.type === 'drag') { g.before.forEach(b => { if (b.skip) return; const el = V.byId(b.id, map); if (!el) return; if (b.attached) { el.props.dx = b.dx; el.props.dy = b.dy; } else { el.x = b.x; el.y = b.y; } R.updateEl(el.id, map); }); }
    if (g.type === 'resize') { const el = V.byId(g.id, map); if (el) { el.w = g.w0; el.h = g.h0; R.updateEl(el.id, map); } }
    if (g.type === 'chan') { const c = V.byId(g.id, map); if (c) { c.props.t = g.t0; R.updateEl(c.id, map); } }
    if (g.type === 'via') { const c = V.byId(g.id, map); if (c) { c.props.via = g.before; R.updateEl(c.id, map); } }
    R.selection(I.selection, map);
  }
  /** Mette un elemento nuovo nel punto w del foglio, con tutto quello che il gesto di creazione ha
   *  sempre fatto: centrato sul punto e dentro il foglio, la corsia larga quanto la carta, l'attesa
   *  agganciata alla freccia vicina, la persona che non ruba il posto al richiedente, il legame
   *  automatico a chi sta sotto. Lo chiamano il gesto «crea» della palette e il menu del vuoto —
   *  due strade sole, stesso risultato: quando la creazione viveva in un posto solo, la seconda
   *  strada avrebbe rifatto le stesse regole a metà. */
  I.placeKind = (kind, w, o = {}) => {
    const map = V.map(); if (!map) return null;
    const T = V.TYPES[kind]; if (!T) return null;
    R.ghost('');
    let el;
    if (o.rect && o.rect.w > 20 && o.rect.h > 14) { el = V.newElement(kind, o.rect.x, o.rect.y); el.w = Math.round(o.rect.w); el.h = Math.round(o.rect.h); }
    else {
      const P = V.paperOf(map);
      // la corsia è una fascia del reparto: nasce larga quanto il foglio, non con una larghezza fissa da A3
      const tw = kind === 'lane' ? P.w - 80 : T.w;
      const nx = Math.max(0, Math.min(P.w - tw, Math.round(w.x - tw / 2))), ny = Math.max(0, Math.min(P.h - T.h, Math.round(w.y - T.h / 2)));
      el = V.newElement(kind, nx, ny); if (kind === 'lane') el.w = tw;
    }
    if (o.props) Object.assign(el.props, o.props);
    if (kind === 'delta') {
      // aggancia alla freccia di flusso più vicina (entro 40 unità)
      let best = null, bd = 44 / I.view.k; // 44 px a schermo
      // distanza misurata sul percorso disegnato (P.pts), non sulla corda a→b: con i gomiti la corda
      // passa lontano dalla linea vera e il delta si agganciava alla freccia sbagliata
      map.elements.filter(c => c.type === 'flow').forEach(c => { const P = R.connPath(c, map); if (!P.pts || P.pts.length < 2) return; let dd = Infinity; for (let i = 0; i < P.pts.length - 1; i++) dd = Math.min(dd, distToSeg(w, P.pts[i], P.pts[i + 1])); if (dd < bd) { bd = dd; best = c; } });
      if (o.connHit) best = V.byId(o.connHit, map) || best;
      if (best) { el.props.attachedTo = best.id; el.props.dx = 0; el.props.dy = 0; }
    }
    // un richiedente c'e' gia': la persona nuova non lo e'. L'etichetta pero' resta vuota — chi
    // disegna scrive chi e' (paziente, segretaria, corriere), l'app non gli mette in bocca «operatore»
    if (kind === 'person' && map.elements.some(x => x.type === 'person' && x.props.requestor)) el.props.requestor = false;
    // creato sopra un passo/persona o vicino a una freccia → nasce già bloccato (come quando lo si lascia cadere)
    if (kind !== 'delta') { const lk = I.findLockTarget(el, map); if (lk) I.lockOps(el, lk, map).forEach(op => Object.assign(op.t === 'props' ? el.props : el, op.after)); }
    if (!V.commit({ t: 'add', el }, 'aggiungi ' + T.name)) return null;
    I.setTool('select'); I.select([el.id], { keepPop: true }); V.pop.open(el.id);
    return el;
  };
  function startPan(e) { gesture = { type: 'pan', sx: e.clientX, sy: e.clientY, v0: clone(I.view), moved: false }; svg.style.cursor = 'grabbing'; }

  function move(e) {
    if (!ptrs.has(e.pointerId) && !(gesture && gesture.type === 'pan')) return;
    if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!gesture) return;
    const map = V.map(); const w = I.toWorld(e.clientX, e.clientY);
    switch (gesture.type) {
      case 'pinch': { if (ptrs.size < 2) return; const p = pinchInfo(); I.view.k = Math.min(6, Math.max(0.15, gesture.k0 * p.d / gesture.d0)); applyView(); const c1 = I.toWorld(p.cx, p.cy); I.view.x += gesture.c0.x - c1.x; I.view.y += gesture.c0.y - c1.y; applyView(); break; }
      case 'pan': { if (Math.hypot(e.clientX - gesture.sx, e.clientY - gesture.sy) > 4) gesture.moved = true; I.view.x = gesture.v0.x - (e.clientX - gesture.sx) / I.view.k; I.view.y = gesture.v0.y - (e.clientY - gesture.sy) / I.view.k; applyView(); break; }
      case 'ink': { if (dist(w, gesture.last) < 1.2 / I.view.k) return; gesture.s.points.push([+w.x.toFixed(1), +w.y.toFixed(1)]); gesture.last = w; gesture.pathEl.setAttribute('d', R.strokePath(gesture.s)); break; }
      case 'erase': eraseAt(w, gesture); break;
      case 'via': {
        if (!gesture.moved && Math.hypot(e.clientX - gesture.startClient.x, e.clientY - gesture.startClient.y) < 6) return;
        const c = V.byId(gesture.id, map); if (!c) return;
        if (!gesture.moved) {
          gesture.moved = true; V.ui.hideQuick && V.ui.hideQuick(); V.pop.close();
          if (gesture.idx < 0) {
            // nuovo punto: si inserisce sul segmento del percorso piu' vicino al tocco iniziale
            const P = R.connPath(c, map); const nodes = [P.a, ...gesture.via, P.b];
            let seg = 0, bd = Infinity;
            for (let i2 = 0; i2 < nodes.length - 1; i2++) { const d2 = distToSeg(gesture.start, nodes[i2], nodes[i2 + 1]); if (d2 < bd) { bd = d2; seg = i2; } }
            gesture.via.splice(seg, 0, { x: w.x, y: w.y }); gesture.idx = seg;
          }
        }
        gesture.via[gesture.idx] = { x: Math.round(w.x), y: Math.round(w.y) };
        c.props.via = gesture.via; R.updateEl(c.id, map); R.selection(I.selection, map);
        break;
      }
      case 'drag': {
        const dx = w.x - gesture.start.x, dy = w.y - gesture.start.y;
        if (!gesture.moved && Math.hypot(e.clientX - gesture.startClient.x, e.clientY - gesture.startClient.y) < 5) return;
        gesture.moved = true; V.ui.hideQuick && V.ui.hideQuick(); V.pop.close();
        gesture.before.forEach(b => { if (b.skip) return; const el = V.byId(b.id, map); if (!el) return; if (b.attached) { el.props.dx = b.dx + dx; el.props.dy = b.dy + dy; } else { el.x = b.x + dx; el.y = b.y + dy; } R.updateEl(el.id, map, false, null, { soloPosizione: true }); });
        R.selection(I.selection, map);
        // i gradini della timeline seguono il passo mentre lo si sposta, invece di restare indietro
        // fino al rilascio: e' il numero che si sta guardando proprio mentre si sistema il foglio
        R.overlaySoon(map);
        break;
      }
      case 'chan': { if (!gesture.moved && Math.hypot(e.clientX - gesture.startClient.x, e.clientY - gesture.startClient.y) < 4) return; gesture.moved = true; const c = V.byId(gesture.id, map); c.props.t = R.nearestT(c, map, w); R.updateEl(c.id, map); R.selection(I.selection, map); break; }
      case 'reconnect': { gesture.moved = true; const c = V.byId(gesture.id, map); const other = gesture.end === 'from' ? c.to : c.from; const o = V.endPoint(other, map); const over = hitAt(e); const okOver = over && !V.isConnector(V.byId(over.id, map)) && over.id !== (other.el || null) ? over.id : null; gesture.over = okOver; R.ghost(`<path class="ghost" d="M${o.x} ${o.y} L${w.x} ${w.y}"/>${okOver ? (() => { const el = V.byId(okOver, map); const p = R.elPos(el, map); return `<rect class="sel-ring" x="${p.x - 4}" y="${p.y - 4}" width="${el.w + 8}" height="${el.h + 8}"/>`; })() : ''}`); break; }
      case 'resize': { const el = V.byId(gesture.id, map); const min = el.type === 'text' ? 40 : 30; el.w = Math.max(min, gesture.w0 + (w.x - gesture.start.x)); el.h = Math.max(20, gesture.h0 + (w.y - gesture.start.y)); R.updateEl(el.id, map); R.selection(I.selection, map); break; }
      case 'lasso': { const x = Math.min(w.x, gesture.start.x), y = Math.min(w.y, gesture.start.y), ww = Math.abs(w.x - gesture.start.x), hh = Math.abs(w.y - gesture.start.y); gesture.rect = { x, y, w: ww, h: hh }; R.ghost(`<rect class="lasso" x="${x}" y="${y}" width="${ww}" height="${hh}"/>`); break; }
      case 'connect': { gesture.moved = true; const from = R.seenEl(V.byId(gesture.from, map), map);
        // il filo parte da dove partira' la freccia vera: per la via di richiesta e' il fianco del
        // richiedente (R.reqStart), non il bordo del riquadro verso il dito. Prima al rilascio la
        // linea saltava di una ventina di pixel e sembrava un aggancio fallito.
        const a = (gesture.ctype === 'request' && R.reqStart) ? R.reqStart(from) : V.anchor(from, w);
        const over = hitAt(e); const okDirect = over && over.id !== gesture.from && !V.isConnector(V.byId(over.id, map)) && I.CONN_TARGETS[gesture.ctype].includes((V.byId(over.id, map) || {}).type); gesture.over = (okDirect ? over.id : null) || (nearEl(w, map, 28, [gesture.from], I.CONN_TARGETS[gesture.ctype]) || {}).id || null; R.ghost(`<path class="ghost" d="M${a.x} ${a.y} L${w.x} ${w.y}"/>${gesture.over ? (() => { const oe = V.byId(gesture.over, map); const op = R.elPos(oe, map); return `<rect class="sel-ring ok" x="${op.x - 4}" y="${op.y - 4}" width="${oe.w + 8}" height="${oe.h + 8}"/>`; })() : ''}`); break; }
      case 'create': { if (['box', 'lane', 'storm', 'fluffy', 'burst', 'text'].includes(gesture.ctype) && Math.hypot(e.clientX - gesture.startClient.x, e.clientY - gesture.startClient.y) > 8) { gesture.rect = { x: Math.min(w.x, gesture.start.x), y: Math.min(w.y, gesture.start.y), w: Math.abs(w.x - gesture.start.x), h: Math.abs(w.y - gesture.start.y) }; R.ghost(`<rect class="ghost" x="${gesture.rect.x}" y="${gesture.rect.y}" width="${gesture.rect.w}" height="${gesture.rect.h}"/>`); } break; }
    }
  }

  function up(e) {
    const had = ptrs.has(e.pointerId); ptrs.delete(e.pointerId);
    if (!gesture) return;
    const map = V.map(); const w = I.toWorld(e.clientX, e.clientY);
    const g = gesture;
    if (g.type === 'pinch') { if (ptrs.size === 0) { gesture = null; saveView(); } return; }
    if (!had && g.type !== 'pan') { if (ptrs.size === 0) gesture = null; return; }
    gesture = null; svg.style.cursor = '';
    switch (g.type) {
      // col dito, toccare la carta vuota apre un pan: se non si è mosso è un tocco a vuoto → deseleziona e chiudi ciò che è aperto
      // (lo schermo intero si comanda solo dal pulsante: il foglio non deve cambiare da sé)
      case 'pan': {
        if (g.moved) { saveView(); break; }
        // Prima cosa, sgomberare: deselezionare e chiudere è la ragione per cui questo tocco esiste.
        if (I.selection.length || (V.pop && V.pop.current)) { I.select([]); V.pop.close(); break; }
        // Con la MANO in mano non si aggiunge niente: chi l'ha scelta sta spostando il foglio, e un
        // menu che compare a ogni tocco fermo sarebbe un dispetto.
        if (I.tool !== 'select') break;
        // Niente da sgomberare: si propone che cosa mettere qui. Solo al RILASCIO, e solo se il dito
        // non si è mosso — far comparire dei bottoni sotto un dito che sta ancora trascinando è quello
        // che trasformava il pan in zoom.
        if (V.ui && V.ui.openInsertMenu) V.ui.openInsertMenu(e.clientX, e.clientY, w);
        break;
      }
      case 'link': V.ui.openMap(g.link); break;
      case 'peek': if (V.ui.showPeek) V.ui.showPeek(g.boxId, e.clientX, e.clientY); break;
      case 'badge': if (V.byId(g.elId, map) && V.pop && V.pop.open) { I.select([g.elId], { keepPop: true }); V.pop.open(g.elId, { section: g.layer }); } break;
      case 'legend': { const el = V.byId(g.id, map); if (!el) break; const collapsed = !el.props.collapsed; V.commit([{ t: 'props', id: el.id, after: { collapsed } }, { t: 'update', id: el.id, after: { w: collapsed ? 74 : 170, h: collapsed ? 18 : 104 } }], 'legenda'); break; }
      // stessa regola del rilascio dopo il trascinamento: il richiedente e' uno solo, e chi arriva dopo
      // nasce senza la spunta (ma con l'etichetta vuota: chi e', lo scrive chi disegna)
      case 'place': { const T = V.TYPES[g.kind]; const el = V.newElement(g.kind, g.kind === 'person' ? g.x + 55 : g.x, g.kind === 'person' ? g.y + 8 : g.y); if (g.kind === 'person' && map.elements.some(x => x.type === 'person' && x.props.requestor)) el.props.requestor = false; V.commit({ t: 'add', el }, 'aggiungi ' + T.name); I.select([el.id], { keepPop: true }); V.pop.open(el.id); break; }
      case 'chan': { const c = V.byId(g.id, map); if (!g.moved) { I.select([c.id], { keepPop: true }); V.pop.open(c.id); break; } V.commit({ t: 'props', id: c.id, after: { t: c.props.t }, before: { t: g.t0 } }, 'sposta icona'); break; }
      case 'reconnect': {
        R.ghost(''); const c = V.byId(g.id, map); if (!c) break;
        const over = hitAt(e); const other = g.end === 'from' ? c.to : c.from;
        const okOver = (over && !V.isConnector(V.byId(over.id, map)) && over.id !== (other.el || null) ? over.id : g.over) || (g.moved ? (nearEl(w, map, 28, [c.id, other.el].filter(Boolean), (g.end === 'from' ? I.CONN_SOURCES : I.CONN_TARGETS)[c.type]) || {}).id : null);
        const before = clone(c[g.end]);
        const okList = (g.end === 'from' ? I.CONN_SOURCES : I.CONN_TARGETS)[c.type];
        const overEl = okOver && V.byId(okOver, map);
        const okType = !okList || (overEl && okList.includes(overEl.type));
        if (okOver && !okType) { I.hint('Quel capo non pu\u00f2 attaccarsi l\u00ec.', 3000); I.select([c.id], { keepPop: true }); break; }
        if (okOver) { V.commit({ t: 'update', id: c.id, after: { [g.end]: { el: okOver } }, before: { [g.end]: before } }, 'ricollega'); I.hint('Freccia ricollegata.', 1500); }
        else if (g.moved) { V.commit({ t: 'update', id: c.id, after: { [g.end]: { x: Math.round(w.x), y: Math.round(w.y) } }, before: { [g.end]: before } }, 'stacca'); I.hint('Estremità staccata: trascina il cerchio su un altro elemento per ricollegarla.', 3500); }
        I.select([c.id], { keepPop: true }); break;
      }
      case 'whatis': { const el2 = V.byId(g.hitId, map); if (el2 && V.ui.showWhatIs) V.ui.showWhatIs(el2, e.clientX, e.clientY); break; }
      case 'via': {
        const c = V.byId(g.id, map); if (!c) break;
        if (!g.moved) { // tocco fermo sulla linea: comportamento di sempre
          if (g.wasSelected && I.selection.length === 1) { V.pop.open(g.hitId); break; }
          I.select([g.hitId]); break;
        }
        // se il punto e' finito quasi in linea coi vicini, si toglie da solo (per "raddrizzare" un tratto)
        const P = R.connPath(c, map); const nodes = [P.a, ...g.via, P.b];
        const v2 = g.via[g.idx];
        if (v2 && distToSeg(v2, nodes[g.idx], nodes[g.idx + 2]) < 6 / I.view.k) g.via.splice(g.idx, 1);
        const after = g.via.length ? g.via : null;
        c.props.via = g.before; // torna com'era: il commit riapplica e registra l'undo
        V.commit({ t: 'props', id: c.id, after: { via: after }, before: { via: g.before } }, 'piega il percorso');
        I.select([c.id], { keepPop: true }); break;
      }
      case 'ink': { if (g.s.points.length < 2) { g.pathEl.remove(); break; } g.pathEl.remove(); V.commit({ t: 'stroke_add', s: g.s }, 'tratto'); break; }
      case 'erase': { if (g.removed.length) { V.commit(g.removed.map(s => ({ t: 'stroke_remove', s })), 'gomma'); } break; }
      case 'drag': {
        if (!g.moved) { // primo tap: seleziona (azioni rapide); tap su elemento già selezionato: popover
          if (g.wasSelected && I.selection.length === 1) { V.pop.open(g.hitId); break; }
          I.select([g.hitId]);
          // un problema ridotto al segno mostra il suo testo al PRIMO tocco: la «i» è lì per questo
          // (il secondo tocco apre il pannello, come per ogni altro elemento)
          const st = V.byId(g.hitId, map);
          if (st && st.type === 'storm' && st.props.collapsed && V.ui.showStormText) V.ui.showStormText(st, e.clientX, e.clientY);
          break;
        }
        const ops = g.before.filter(b => !b.skip).map(b => { const el = V.byId(b.id, map); return b.attached ? { t: 'props', id: b.id, after: { dx: el.props.dx, dy: el.props.dy }, before: { dx: b.dx, dy: b.dy } } : { t: 'update', id: b.id, after: { x: el.x, y: el.y }, before: { x: b.x, y: b.y } }; });
        // legame smart: un solo elemento legabile e non legato lasciato sopra/vicino a un genitore
        if (g.before.length === 1 && !g.before[0].attached) { const el = V.byId(g.before[0].id, map); const lk = I.findLockTarget(el, map); if (lk) ops.push(...I.lockOps(el, lk, map)); }
        if (ops.length) V.commit(ops, 'sposta');
        else if (g.hitPinned) I.hint('Bloccato sul foglio \u{1F512}: per spostarlo tocca «Sblocca» nelle azioni rapide.', 2500);
        break;
      }
      case 'resize': { const el = V.byId(g.id, map);
        // la nuvola non si stringe sotto il suo testo: niente troncamenti, l'altezza minima è quella che serve
        if ((el.type === 'storm' || el.type === 'fluffy') && !el.props.collapsed && el.props.text && R.cloudFit) el.h = Math.max(el.h, R.cloudFit(el.w, el.props.text));
        V.commit({ t: 'update', id: el.id, after: { w: el.w, h: el.h }, before: { w: g.w0, h: g.h0 } }, 'ridimensiona'); break; }
      case 'lasso': {
        R.ghost('');
        // col mouse il tocco sul vuoto apre un riquadro di selezione: fermo e senza niente da sgomberare,
        // vale come il tocco a vuoto del dito e propone che cosa mettere qui
        if (!g.rect || (g.rect.w < 4 && g.rect.h < 4)) {
          const c_era = I.selection.length || (V.pop && V.pop.current);
          I.select([]); V.pop.close();
          if (!c_era && !g.fromTool && V.ui && V.ui.openInsertMenu) V.ui.openInsertMenu(e.clientX, e.clientY, w);
          break;
        }
        const inside = map.elements.filter(el => !V.isConnector(el)).filter(el => { const p = R.elPos(el, map); return p.x + el.w >= g.rect.x && p.x <= g.rect.x + g.rect.w && p.y + el.h >= g.rect.y && p.y <= g.rect.y + g.rect.h && el.type !== 'lane'; }).map(el => el.id);
        if (g.fromTool) I.setTool('select');
        I.select(g.shift ? [...I.selection, ...inside] : inside);
        if (g.fromTool && !inside.length) I.hint('Nessun elemento nell\u2019area: riprova disegnando il riquadro intorno a un settore.', 2500);
        break;
      }
      case 'connect': {
        R.ghost('');
        const over = hitAt(e);
        const okType = (id) => { const oe = id && V.byId(id, map); return oe && I.CONN_TARGETS[g.ctype].includes(oe.type) ? id : null; };
        const okOver = okType(over && over.id !== g.from && !V.isConnector(V.byId(over.id, map)) ? over.id : null) || g.over;
        // se il dito non ha centrato nulla, si prende l'elemento piu' vicino invece di buttare via il gesto
        // — ma solo dopo un trascinamento vero: da un tocco fermo non deve mai nascere una freccia
        const toId = okOver || (g.moved ? (nearEl(w, map, 28, [g.from], I.CONN_TARGETS[g.ctype]) || {}).id : null);
        if (!toId) {
          // rilasciato nel vuoto: invece di far sparire tutto, si propone di mettere li' l'elemento di arrivo
          if (g.moved && V.ui && V.ui.proposePlace) V.ui.proposePlace(e.clientX, e.clientY, g.ctype, g.from, w);
          else if (g.moved) I.hint('Rilascia sopra l\'elemento di arrivo.');
          R.selection(I.selection, map); // il fantasma ha appena ripulito lo strato: gli anelli tornano
          break;
        }
        I.connectTo(g.from, toId, g.ctype); break;
      }
      case 'create': I.placeKind(g.ctype, g.start, { rect: g.rect, connHit: g.connHit }); break;
    }
    // 'noop' copre i tocchi delle modalita' pickConn/pickLock: la selezione cambia al pointerdown,
    // ma il menu delle azioni (che si apre solo al rilascio) va richiamato da qui
    if (V.ui && V.ui.onSelection && ['drag', 'resize', 'lasso', 'chan', 'reconnect', 'legend', 'noop'].includes(g.type)) V.ui.onSelection(I.selection);
  }
  function distToSeg(p, a, b) { const l2 = (a.x - b.x) ** 2 + (a.y - b.y) ** 2; if (!l2) return Math.hypot(p.x - a.x, p.y - a.y); let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2; t = Math.max(0, Math.min(1, t)); return Math.hypot(p.x - (a.x + t * (b.x - a.x)), p.y - (a.y + t * (b.y - a.y))); }
  function eraseAt(w, g) {
    const map = V.map(); const r = 10 / Math.sqrt(I.view.k);
    map.strokes.forEach(s => { if (g.removed.includes(s)) return; const pts = s.points; for (let k = 0; k < pts.length; k++) { const p = pts[k]; const q = pts[k + 1] || p; const d = distToSeg(w, { x: p[0], y: p[1] }, { x: q[0], y: q[1] }); if (d < r + s.width) { g.removed.push(s); const el = svg.querySelector(`[data-sid="${s.id}"]`); if (el) el.style.opacity = .15; break; } } });
  }

  // ---------- blocco (lock) di un elemento a un genitore ----------
  I.findLockTarget = (el, map) => {
    if (!el || V.isConnector(el) || !R.LOCKABLE.includes(el.type) || el.props.lockTo || (el.type === 'delta' && el.props.attachedTo)) return null;
    if (el.type === 'box' || el.type === 'person') return null; // box e persone: solo blocco esplicito
    const pos = R.elPos(el, map); const cx = pos.x + el.w / 2, cy = pos.y + el.h / 2;
    // 1) dentro un genitore (box, persona, scorta) — le corsie solo esplicitamente
    const inside = map.elements.filter(p => ['box', 'person', 'inventory'].includes(p.type) && p.id !== el.id && !p.props.lockTo).find(p => { const pp = R.elPos(p, map); const m = 24; return cx >= pp.x - m && cx <= pp.x + p.w + m && cy >= pp.y - m && cy <= pp.y + p.h + 60; });
    if (inside) return { id: inside.id };
    // 2) vicino a una freccia (entro 36 px a schermo) — ma MAI a una freccia che dipende gia' da lui:
    // una freccia che parte o arriva su questo elemento sta dove sta lui, e legarcelo chiudeva un
    // anello. A schermo il risultato era che la freccia finiva nel vuoto e l'elemento pendeva di
    // lato appeso alla catenella, pur essendo il capo di quella stessa freccia (video di Gt).
    // Il collegamento c'e' gia' ed e' piu' forte del legame: non serve incollarcelo sopra.
    let best = null, bd = 36 / I.view.k;
    map.elements.filter(c => V.isConnector(c) && !I.chiudeAnello(el, c, map)).forEach(c => { const P = R.connPath(c, map); for (let k = 0; k <= 30; k++) { const q = P.bez(k / 30); const d = Math.hypot(q.x - cx, q.y - cy); if (d < bd) { bd = d; best = { id: c.id, t: k / 30 }; } } });
    return best;
  };
  I.lockOps = (el, lk, map) => {
    const par = V.byId(lk.id, map); if (!par) return [];
    if (el.type === 'delta' && V.isConnector(par) && par.type === 'flow') { const P = R.connPath(par, map); const pos = R.elPos(el, map); return [{ t: 'props', id: el.id, after: { attachedTo: par.id, dx: pos.x - (P.mid.x - el.w / 2), dy: pos.y - (P.mid.y - 4) } }]; }
    const pos = R.elPos(el, map);
    if (V.isConnector(par)) { const P = R.connPath(par, map); const t = lk.t == null ? R.nearestT(par, map, { x: pos.x + el.w / 2, y: pos.y + el.h / 2 }) : lk.t; const q = P.bez(t); return [{ t: 'props', id: el.id, after: { lockTo: par.id, lockT: t, dx: pos.x - q.x, dy: pos.y - q.y } }, { t: 'update', id: el.id, after: { x: pos.x, y: pos.y } }]; }
    const pp = R.elPos(par, map); return [{ t: 'props', id: el.id, after: { lockTo: par.id, dx: pos.x - pp.x, dy: pos.y - pp.y } }, { t: 'update', id: el.id, after: { x: pos.x, y: pos.y } }];
  };
  I.lock = (childId, parentId) => I.lockMany([childId], parentId);
  const parName = (par) => par.props.title || par.props.label || par.props.name || V.TYPES[par.type].name;
  /** blocca più figli allo stesso genitore (salta chi non è bloccabile o è già il genitore/antenato); un solo undo */
  I.lockMany = (childIds, parentId) => {
    const map = V.map(); const par = V.byId(parentId, map); if (!par) return false;
    if (!R.LOCK_PARENTS.includes(par.type)) return false;
    const ops = []; const done = []; let rifiutati = 0;
    childIds.forEach(cid => { const el = V.byId(cid, map); if (!el || el.id === par.id || V.isConnector(el) || !R.LOCKABLE.includes(el.type)) return; if (el.props.lockTo === par.id || (el.type === 'delta' && el.props.attachedTo === par.id)) return; if (I.chiudeAnello(el, par, map)) { rifiutati++; return; } const cur = el.props.lockTo || (el.type === 'delta' && el.props.attachedTo); if (cur) ops.push(...I.unlockOps(el, map)); const lo = I.lockOps(el, { id: par.id }, map); if (lo.length) { ops.push(...lo); done.push(el.id); } });
    if (!done.length) {
      // detto, non taciuto: prima il tocco su una freccia legata all'elemento non faceva nulla e basta
      if (rifiutati) I.hint('Qui non si lega: questa freccia sta gia\u2019 dove sta lui (\u00e8 un suo capo, o ci arriva passando da lui).', 3500);
      return false;
    }
    V.commit(ops, done.length > 1 ? 'lega gruppo' : 'lega'); I.select(done);
    I.hint(done.length > 1 ? `${done.length} elementi legati a "${parName(par)}": spostando "${parName(par)}" si muovono con lui.` : `Legato \u26d3: spostando "${parName(par)}" si muove anche lui (da solo resta trascinabile). «Slega» nelle azioni rapide.`, 4500); return true;
  };
  /** Da chi dipende la posizione di questo elemento: la catena dei legami e, per una FRECCIA, i suoi
   *  due capi — una freccia sta dove la mettono gli elementi che collega. Contare anche i capi e' cio'
   *  che chiude il buco del 2026-08-21: legare un elemento alla freccia che arriva su di lui e' un
   *  anello, ma la vecchia risalita si fermava alla freccia e non lo vedeva. */
  const genitoriDi = (el, map) => (V.isConnector(el)
    ? [el.from && el.from.el, el.to && el.to.el]
    : [el.props && (el.props.lockTo || (el.type === 'delta' && el.props.attachedTo))]).filter(Boolean);
  /** risale i legami: serve a non chiudere un anello (A legato a B e B legato ad A).
   *  Si sale fino in cima segnando i passaggi: fermarsi al sesto anello lasciava passare una catena
   *  piu' lunga, e l'anello che ne usciva mandava in tilt il disegno durante il trascinamento. */
  const isAncestor = (id, el, map, seen) => {
    seen = seen || new Set();
    if (!el || seen.has(el.id)) return false;
    seen.add(el.id);
    return genitoriDi(el, map).some(p => p === id || isAncestor(id, V.byId(p, map), map, seen));
  };
  /** legare `el` a `par` chiuderebbe un anello? (usata sia dal legame automatico sia da «Lega a…») */
  I.chiudeAnello = (el, par, map) => !!el && !!par && (el.id === par.id || isAncestor(el.id, par, map));
  I.unlockOps = (el, map) => { const pos = R.elPos(el, map); const after = { lockTo: null, lockT: null, dx: 0, dy: 0 }; if (el.type === 'delta') after.attachedTo = null; return [{ t: 'update', id: el.id, after: { x: pos.x, y: pos.y } }, { t: 'props', id: el.id, after }]; };
  I.unlock = (id) => I.unlockMany([id]);
  I.unlockMany = (ids) => { const map = V.map(); const ops = []; const done = []; ids.forEach(id => { const el = V.byId(id, map); if (!el || !(el.props.lockTo || (el.type === 'delta' && el.props.attachedTo))) return; ops.push(...I.unlockOps(el, map)); done.push(id); }); if (!done.length) return; V.commit(ops, done.length > 1 ? 'slega gruppo' : 'slega'); I.select(done); I.hint(done.length > 1 ? `${done.length} elementi slegati: restano dove sono e non seguono più nessuno.` : 'Slegato: resta dov’è e non segue più il suo genitore.', 3500); };
  /** sblocca tutti i figli di un genitore */
  I.unlockChildren = (parentId) => { const map = V.map(); I.unlockMany(R.children(parentId, map).map(k => k.id)); I.select([parentId]); };
  I.selectWithChildren = (parentId) => { const map = V.map(); const kids = R.children(parentId, map).map(k => k.id); I.select([parentId, ...kids]); };
  I.pickLock = null; // modalità "Blocca a…": prossimo tocco su un elemento = genitore (per uno o più figli)
  /** Crea il collegamento fra due elementi. Sta qui da solo perche' ci si arriva in tre modi:
   *  trascinando, toccando il bersaglio dopo "Collega", e scegliendo un elemento nuovo dal menu a comparsa. */
  /** ogni via che parte dallo stesso richiedente prende una corsia diversa (anche verso box diversi) */
  // il numero d'ordine di una via nuova viene DOPO l'ultimo assegnato, non dal conteggio: eliminandone
  // una e rifacendola, il conteggio ridava un numero gia' in uso e l'ordine delle vie verso lo stesso
  // passo dipendeva da com'erano finite nell'elenco
  const reqOffset = (map, fromId) => {
    const usati = map.elements.filter(x => x.type === 'request' && x.from.el === fromId).map(x => x.props.offset || 0);
    return usati.length ? Math.max(...usati) + 1 : 0;
  };
  I.reqOffset = reqOffset;
  /** Scrive l'intento su una via appena nata, con il canale che ne consegue. Sta qui da solo perche' le
   *  vie nascono in tre modi (menu, tocco sul bersaglio, trascinamento nel vuoto) e la regola dev'essere
   *  una sola: «si reca» arriva di persona, salvo poi cambiarlo dal pop-up. */
  I.applyIntent = (c, intent) => {
    if (!intent || !V.INTENTS.some(x => x.id === intent)) return c;
    c.props.intent = intent;
    if (intent === 'si reca') c.props.channel = 'di persona';
    return c;
  };
  I.connectTo = (fromId, toId, ctype, opts = {}) => {
    const map = V.map();
    if (!fromId || !toId || fromId === toId) return null;
    const a = V.byId(fromId, map), b = V.byId(toId, map);
    if (!a || !b || V.isConnector(a) || V.isConnector(b)) return null;
    const okTo = I.CONN_TARGETS[ctype], okFrom = I.CONN_SOURCES[ctype];
    if (okFrom && !okFrom.includes(a.type)) { I.hint(ctype === 'request' ? 'La via di richiesta parte da una persona.' : 'La freccia di flusso parte da un passo.', 3000); return null; }
    if (okTo && !okTo.includes(b.type)) { I.hint('Qui non ci arriva un collegamento: scegli un passo (o una scorta/in-box).', 3000); return null; }
    const c = V.newConnector(ctype, { el: fromId }, { el: toId });
    if (ctype === 'request') { c.props.offset = reqOffset(map, fromId); I.applyIntent(c, opts.intent); }
    V.commit({ t: 'add', el: c }, 'collega'); I.setTool('select'); I.select([c.id], { keepPop: true }); V.pop.open(c.id);
    return c;
  };

  /** "Collega" senza trascinare: si tocca il bersaglio. Non blocca nulla — si esce toccando il vuoto o con Esc.
   *  Con opts.keepMenu il menu di «Collega» resta aperto: la scelta sul foglio è armata dentro di lui. */
  I.startPickConnect = (fromId, ctype, opts = {}) => {
    const map = V.map();
    // stessa lista usata dagli anelli e dalla validazione del tocco: gli anelli non mentono
    const okTypes = I.connTargetsFrom(ctype, (V.byId(fromId, map) || {}).type);
    I.pickConn = { from: fromId, ctype, intent: opts.intent, okTypes };
    svg.classList.add('picking');
    if (!opts.keepMenu) V.ui.hideQuick && V.ui.hideQuick();
    V.pop && V.pop.close();
    const rings = map.elements.filter(el => !V.isConnector(el) && el.id !== fromId && okTypes.includes(el.type))
      .map(el => { const q = R.elPos(el, map), z = R.elSize(el); return `<rect class="sel-ring ok" x="${q.x - 5}" y="${q.y - 5}" width="${z.w + 10}" height="${z.h + 10}"/>`; }).join('');
    R.ghost(rings);
    I.hint(opts.keepMenu ? 'Tocca l’elemento sul foglio, oppure scegli una voce del menu (tocco sul vuoto o Esc per annullare).'
      : ctype === 'flow' ? 'Tocca il passo di arrivo (tocca il foglio vuoto per annullare).'
      : opts.intent === 'si reca' ? 'Tocca il passo a cui si reca la persona (tocca il foglio vuoto per annullare).'
      : 'Tocca il passo a cui arriva la richiesta (tocca il foglio vuoto per annullare).', 0);
  };
  I.cancelPickConnect = (opts = {}) => {
    I.pickConn = null; svg.classList.remove('picking'); R.ghost(''); I.hint('');
    // gli anelli dei bersagli erano disegnati nello stesso strato di anello e maniglie della selezione:
    // svuotarlo lasciava l'elemento selezionato ma senza contorno, e il tocco dopo apriva il pop-up
    R.selection(I.selection, V.map());
    // quiet: chi ha annullato ridisegna da sé (colpo a segno, «Indietro», voce di menu);
    // altrimenti il menu di «Collega» torna alle azioni dell'elemento
    if (!opts.quiet && V.ui && V.ui.onPickCancel) V.ui.onPickCancel();
  };

  /** Trascinato nel vuoto: l'elemento nuovo nasce li' e il collegamento lo raggiunge, in un solo passo di undo. */
  I.placeAndConnect = (kind, w, fromId, ctype, opts = {}) => {
    const map = V.map(); const T = V.TYPES[kind]; const P = V.paperOf(map);
    // col menu aperto si puo' annullare (Ctrl+Z) la creazione dell'elemento di partenza: senza questo
    // controllo nascerebbe una freccia con un capo nel vuoto, e il percorso finirebbe a coordinate NaN
    const from = V.byId(fromId, map);
    if (!from) { I.hint('L\u2019elemento di partenza non c\u2019\u00e8 pi\u00f9.', 2500); return; }
    // le stesse regole di connectTo: il menu rotondo non deve creare cio' che il resto dell'app rifiuta
    if (!I.CONN_SOURCES[ctype].includes(from.type) || !I.CONN_TARGETS[ctype].includes(kind)) { I.hint('Questo collegamento non si puo\u2019 fare da qui.', 2500); return; }
    const nx = Math.max(0, Math.min(P.w - T.w, Math.round(w.x - T.w / 2)));
    const ny = Math.max(0, Math.min(P.h - T.h, Math.round(w.y - T.h / 2)));
    const el = V.newElement(kind, nx, ny);
    const c = V.newConnector(ctype, { el: fromId }, { el: el.id });
    if (ctype === 'request') { c.props.offset = reqOffset(map, fromId); I.applyIntent(c, opts.intent); }
    V.commit([{ t: 'add', el }, { t: 'add', el: c }], 'aggiungi ' + T.name + ' collegato');
    I.setTool('select'); I.select([el.id], { keepPop: true }); V.pop.open(el.id);
  };

  I.startPickLock = (childIds) => { I.pickLock = Array.isArray(childIds) ? childIds : [childIds]; svg.classList.add('picking'); I.hint(I.pickLock.length > 1 ? `Tocca il passo, la persona, la corsia o la freccia a cui legare i ${I.pickLock.length} elementi (Esc per annullare).` : 'Tocca il passo, la persona, la corsia o la freccia a cui legarlo (Esc per annullare).', 0); };
  I.cancelPickLock = () => { I.pickLock = null; svg.classList.remove('picking'); I.hint(''); };

  // ---------- da selezione a sotto-foglio ----------
  /** Porta gli elementi selezionati in una nuova mappa di dettaglio e li sostituisce, nel foglio madre,
   *  con un solo passo collegato (props.link): un settore affollato diventa un livello a parte.
   *  I collegamenti interamente dentro migrano; quelli a cavallo si riattaccano al passo riassuntivo.
   *  L'undo (una voce sola) ripristina il foglio madre; la mappa di dettaglio resta fra le mappe.
   *  Il nome arriva dalla scheda di conferma (lo scrive chi disegna, col titolo del passo proposto):
   *  lo prendono sia il sotto-foglio sia il passo riassuntivo, perché il passo È il sotto-foglio
   *  visto da sopra — chiamarli diversamente farebbe sembrare la cartina un elenco di estranei. */
  I.groupToDetail = (ids, nomeFoglio) => {
    const map = V.map();
    // la porta unica anche qui (rilievo: non si aggira passando fuori da commit): il settore che
    // migra in un sotto-foglio e' struttura pura (un passo nuovo, dei remove, un link) — se la fase
    // la ferma, si dice subito, prima di spostare niente.
    const g = V.allowed({ t: 'add', el: { type: 'box' } }, map);
    if (!g.ok) { if (V.ui && V.ui.toast) V.ui.toast(V.DENIED_MSG[g.reason] || 'Non si può, in questa fase.'); return; }
    const inside = new Set(ids.filter(id => { const el = V.byId(id, map); return el && !V.isConnector(el) && el.type !== 'lane'; }));
    if (inside.size < 2) { I.hint('Seleziona almeno due elementi (con lo strumento Area) per farne un sotto-foglio.', 3000); return; }
    // i figli bloccati/agganciati a chi migra vengono con lui (finche' l'insieme non cresce piu')
    let grew = true;
    while (grew) {
      grew = false;
      map.elements.forEach(el => {
        if (inside.has(el.id) || V.isConnector(el)) return;
        const par = el.props && (el.props.lockTo || (el.type === 'delta' && el.props.attachedTo));
        if (par && inside.has(par)) { inside.add(el.id); grew = true; }
      });
    }
    const conns = map.elements.filter(V.isConnector);
    const moveConns = conns.filter(c => inside.has(c.from.el) && inside.has(c.to.el));
    // i delta agganciati alle frecce che migrano
    map.elements.forEach(el => { if (el.type === 'delta' && el.props.attachedTo && moveConns.some(c => c.id === el.props.attachedTo)) inside.add(el.id); });
    const movingEls = map.elements.filter(e => inside.has(e.id));
    const crossConns = conns.filter(c => !moveConns.includes(c) && (inside.has(c.from.el) !== inside.has(c.to.el)));
    // riquadro del settore: il passo riassuntivo nasce al suo centro
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    movingEls.forEach(el => { const q = R.elPos(el, map); x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x + el.w); y1 = Math.max(y1, q.y + el.h); });
    // la mappa di dettaglio riceve copie normalizzate verso l'angolo in alto a sinistra
    const nome = String(nomeFoglio || '').trim() || 'Sotto-foglio';
    const d = V.createDetail(map, nome);
    // il passo riassuntivo nasce qui sotto: il sotto-foglio deve sapere di appartenere a LUI, o
    // resterebbe appeso alla mappa senza indirizzo (2.1 diventerebbe solo «sotto la 2»)
    const sx = 120 - x0, sy = 140 - y0;
    const shift = (o) => { const n = clone(o); if (!V.isConnector(n)) { n.x += sx; n.y += sy; } else { if (!n.from.el) { n.from.x += sx; n.from.y += sy; } if (!n.to.el) { n.to.x += sx; n.to.y += sy; } if (Array.isArray(n.props.via)) n.props.via = n.props.via.map(v2 => ({ x: v2.x + sx, y: v2.y + sy })); } return n; };
    d.elements = movingEls.map(shift).concat(moveConns.map(shift));
    // scrittura fuori commit sull'array degli elementi (censimento A6, in testa a questo file):
    // d.rev DEVE alzarsi da sé, come fa model.js con bump() sulle sue scritture dirette — bump e'
    // privato a model.js, quindi qui l'effetto si espone a mano.
    d.rev = (d.rev | 0) + 1;
    V.save();
    // nel foglio madre: un passo con il link, e le operazioni di sostituzione in UNA voce di undo
    const T = V.TYPES.box;
    const nb = V.newElement('box', Math.round((x0 + x1) / 2 - T.w / 2), Math.round((y0 + y1) / 2 - T.h / 2));
    nb.props.title = nome; nb.props.link = d.id;
    // niente V.save() qui: salva già il commit subito sotto (e se il commit venisse rifiutato,
    // repairDoc azzera da sé un parentStepId che punta a un box mai nato)
    d.parentStepId = nb.id;
    d.rev = (d.rev | 0) + 1;   // altra scrittura fuori commit sullo stesso foglio (censimento A6)
    const ops = [{ t: 'add', el: nb }];
    movingEls.forEach(el => ops.push({ t: 'remove', el: clone(el) }));
    moveConns.forEach(c => ops.push({ t: 'remove', el: clone(c) }));
    crossConns.forEach(c => { const end = inside.has(c.from.el) ? 'from' : 'to'; ops.push({ t: 'update', id: c.id, after: { [end]: { el: nb.id } }, before: { [end]: clone(c[end]) } }); });
    V.commit(ops, 'trasforma in sotto-foglio');
    I.select([nb.id], { keepPop: true }); V.pop.open(nb.id);
    if (V.ui && V.ui.toast) V.ui.toast('Settore spostato nel sotto-foglio: apri con \u2197 (annulla per tornare indietro).');
    if (V.ui && V.ui.renderCartina) V.ui.renderCartina();
  };

  // ---------- eliminazione / duplicazione ----------
  I.deleteSelection = () => {
    const map = V.map(); const ids = new Set(I.selection); if (!ids.size) return;
    const ops = [];
    map.elements.forEach(el => { if (ids.has(el.id)) ops.push({ t: 'remove', el: clone(el) }); });
    // connettori appesi a elementi rimossi
    map.elements.forEach(c => { if (V.isConnector(c) && !ids.has(c.id) && (ids.has(c.from.el) || ids.has(c.to.el))) { ops.push({ t: 'remove', el: clone(c) }); ids.add(c.id); } });
    // figli agganciati/bloccati a elementi rimossi → liberati mantenendo la posizione
    map.elements.forEach(d => { const par = d.props && (d.props.lockTo || (d.type === 'delta' && d.props.attachedTo)); if (par && ids.has(par) && !ids.has(d.id)) ops.push(...I.unlockOps(d, map)); });
    // la selezione si azzera solo se l'eliminazione e' passata davvero: a lucchetto chiuso il modello
    // rifiuta, e svuotarla prima lasciava a schermo l'anello di un elemento che il codice non
    // considerava piu' selezionato
    V.pop.close();
    if (!V.commit(ops, 'elimina')) return;
    I.selection = [];
    // P.close() qui sopra ha appena RIFATTO comparire il menu rapido per l'elemento ancora
    // selezionato (e' la sua regola: chiuso il pop-up, il menu torna) — ma l'elemento sta per
    // sparire: senza questo, «Blocca» ed «Elimina» restavano orfani sul foglio (bug iPad 25/8,
    // visto eliminando un reparto dal suo pannello).
    V.ui.onSelection && V.ui.onSelection([]);
  };
  /** duplica uno o più elementi; se un figlio bloccato/agganciato e il suo genitore sono entrambi nel gruppo, il legame viene ricreato tra le copie */
  I.duplicateMany = (ids) => {
    const map = V.map(); const uniq = Array.from(new Set(ids)).map(id => V.byId(id, map)).filter(el => el && !V.isConnector(el));
    if (!uniq.length) return;
    // la copia nasce col lucchetto aperto: si duplica per metterla altrove, inchiodata non si potrebbe.
    // Né col sigillo della ✓: «mappato e confermato» vale per quel passo, non per la sua fotocopia
    const idMap = new Map(); const clones = uniq.map(el => { const c = clone(el); c.id = uid(); c.props.pinned = false; if (c.props.validated) c.props.validated = false; idMap.set(el.id, c.id); return c; });
    clones.forEach((c, i) => {
      const orig = uniq[i];
      const par = c.props.lockTo || (c.type === 'delta' && c.props.attachedTo);
      if (par && idMap.has(par)) { if (c.props.lockTo) c.props.lockTo = idMap.get(par); else c.props.attachedTo = idMap.get(par); }
      else if (par) { const p = R.elPos(orig, map); c.x = p.x + 24; c.y = p.y + 24; c.props.attachedTo = null; c.props.lockTo = null; c.props.dx = 0; c.props.dy = 0; }
      else { c.x += 24; c.y += 24; }
    });
    V.commit(clones.map(c => ({ t: 'add', el: c })), clones.length > 1 ? 'duplica gruppo' : 'duplica');
    I.select(clones.map(c => c.id));
  };
  I.duplicate = (id) => I.duplicateMany([id]);

  // ---------- init ----------
  I.init = (svgEl, stageEl) => {
    svg = svgEl; stage = stageEl;
    svg.addEventListener('pointerdown', down); svg.addEventListener('pointermove', move); svg.addEventListener('pointerup', up);
    // pointercancel non e' un rilascio: qualunque sia il gesto, si annulla. Prima solo matita,
    // trascinamento, ridimensionamento e icona del canale tornavano indietro; tutti gli altri
    // (collegamento, ricollegamento, piega, creazione, gomma, lazo) passavano da up() e committavano.
    svg.addEventListener('pointercancel', (e) => { ptrs.delete(e.pointerId); const g = gesture; gesture = null; abortGesture(g); });
    // se il puntatore esce dalla cattura senza un rilascio (succede quando il sistema se lo riprende)
    // vale la stessa regola: meglio un gesto perso che un gesto confermato a meta'
    svg.addEventListener('lostpointercapture', (e) => { if (!gesture || !ptrs.has(e.pointerId)) return; if (gesture.type === 'pan' || gesture.type === 'pinch') return; ptrs.delete(e.pointerId); const g = gesture; gesture = null; abortGesture(g); });
    svg.addEventListener('wheel', (e) => { e.preventDefault(); const p = stagePt(e); if (e.ctrlKey || e.metaKey) I.zoomAt(e.deltaY < 0 ? 1.1 : 0.9, e.clientX, e.clientY); else { I.view.x += e.deltaX / I.view.k; I.view.y += e.deltaY / I.view.k; applyView(); saveView(); } }, { passive: false });
    svg.addEventListener('contextmenu', (e) => e.preventDefault());
    new ResizeObserver(() => { if (!printing) applyView(); }).observe(stage);
    document.addEventListener('keydown', (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (['input', 'textarea', 'select'].includes(tag) || e.target.isContentEditable) { if (e.key === 'Escape') { e.target.blur(); if (e.target.closest('#pop')) V.pop.close(); } return; }
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); flushNudge(); if (e.shiftKey) V.redo(); else V.undo(); return; }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); flushNudge(); V.redo(); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { if (I.selection.length) { e.preventDefault(); I.deleteSelection(); } return; }
      if (e.key === 'Escape') { if (I.pickConn) { I.cancelPickConnect(); return; } if (V.ui && V.ui.closePlaceMenu && V.ui.closePlaceMenu()) return; if (V.ui && V.ui.quickMenuBack && V.ui.quickMenuBack()) return; if (I.pickLock) { I.cancelPickLock(); return; } if (V.pop.current) { V.pop.close(); return; } if (I.tool !== 'select') { I.setTool('select'); return; } I.select([]); return; }
      if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); I.select(V.map().elements.filter(x => !V.isConnector(x) && x.type !== 'lane').map(x => x.id)); return; }
      if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); if (I.selection.length) I.duplicateMany(I.selection); return; }
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) && I.selection.length) {
        e.preventDefault(); const step = e.shiftKey ? 20 : 4;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0, dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        const map = V.map(); const movable = I.selection.map(id => V.byId(id, map)).filter(x => x && !V.isConnector(x) && !x.props.pinned);
        if (!movable.length) return;
        const attached = (x) => x.props.lockTo || (x.type === 'delta' && x.props.attachedTo);
        const ids = movable.map(x => x.id).join(',');
        // una raffica di frecce diventa UNA voce da annullare, chiusa dopo la pausa. La sessione porta
        // con se' la mappa su cui e' cominciata: cambiando foglio entro la pausa, la voce finiva sul
        // foglio sbagliato. E se il lucchetto rifiuta, non si apre nessuna sessione (prima ogni tasto
        // premuto mostrava un avviso mentre la geometria non si muoveva).
        if (!nudgeSession || nudgeSession.ids !== ids || nudgeSession.map !== map) { flushNudge(); nudgeSession = { ids, map, attached, before: new Map(movable.map(x => [x.id, attached(x) ? { dx: x.props.dx || 0, dy: x.props.dy || 0 } : { x: x.x, y: x.y }])) }; }
        const ops = movable.map(x => attached(x) ? { t: 'props', id: x.id, after: { dx: (x.props.dx || 0) + dx, dy: (x.props.dy || 0) + dy } } : { t: 'update', id: x.id, after: { x: x.x + dx, y: x.y + dy } });
        if (!V.commit(ops, 'sposta (tastiera)', { silent: true, map })) { nudgeSession = null; return; }
        clearTimeout(nudgeTimer); nudgeTimer = setTimeout(flushNudge, 600);
        return;
      }
      if (e.key === 'Enter' && I.selection.length === 1) { e.preventDefault(); V.pop.open(I.selection[0]); return; }
      if (!mod && e.key.toLowerCase() === 'u') { e.preventDefault(); V.ui.toggleChrome(); return; }
      const keys = { v: 'select', h: 'pan', p: 'ink', e: 'eraser', a: 'area', b: 'box', d: 'delta', f: 'flow', r: 'request', o: 'person', n: 'storm', t: 'text', l: 'lane' };
      if (!mod && keys[e.key.toLowerCase()]) I.setTool(keys[e.key.toLowerCase()]);
      if (e.key === '+' || e.key === '=') I.zoomAt(1.15, stage.clientWidth / 2 + stage.getBoundingClientRect().left, stage.clientHeight / 2 + stage.getBoundingClientRect().top);
      if (e.key === '-') I.zoomAt(1 / 1.15, stage.clientWidth / 2 + stage.getBoundingClientRect().left, stage.clientHeight / 2 + stage.getBoundingClientRect().top);
      if (e.key === '0') I.fit();
    });
  };
})(window.VSM);
