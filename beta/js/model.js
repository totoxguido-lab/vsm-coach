/* VSM Coach v2 — model.js: documento, mappe, elementi, undo a comandi, storage, calcoli, controlli. */
window.VSM = window.VSM || {};
(function (V) {
  'use strict';
  const uid = () => Math.random().toString(36).slice(2, 9);
  const today = () => new Date().toISOString().slice(0, 10);
  const num = (v) => { if (v == null || v === '') return null; const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : null; };
  const fmt = (n) => n == null ? '–' : (Math.round(n * 100) / 100).toString().replace('.', ',');
  const clone = (o) => o === undefined ? undefined : JSON.parse(JSON.stringify(o));
  V.util = { uid, today, num, fmt, clone };

  /** Foglio: non siamo vincolati all'A3 (era 1188x840). I fogli nuovi nascono grandi il doppio in entrambi i lati
   *  (stessa proporzione, così stampa ed export restano coerenti); le mappe già salvate tengono la loro misura,
   *  registrata in map.paper alla prima apertura, per non spostare nulla di quanto è già disegnato. */
  V.PAPER_A3 = { w: 1188, h: 840 };
  V.PAPER = { w: 2376, h: 1680 };
  V.paperOf = (map) => (map && map.paper && map.paper.w && map.paper.h) ? map.paper : V.PAPER;
  V.CHANNELS = ['telefono', 'fax', 'e-mail', 'verbale', 'di persona', 'sistema', 'cartaceo', 'inferita', 'altro'];
  /** Aspetto delle vie di richiesta: il colore dice *da che via* arriva la richiesta, non è decorazione.
   *  Il tratto raggruppa i canali per famiglia (a voce, elettronica, cartacea, supposta), perché il foglio si
   *  stampa spesso in bianco e nero e c'è chi non distingue certe coppie di tinte: il colore non è mai l'unico
   *  segno — accanto ci sono sempre l'icona del canale e il tratto, e ogni segno è dichiarato in legenda.
   *  Tinte sobrie, e mai il verde della timeline né il rosso dei delta, che hanno già un significato forte. */
  V.CHANNEL_LOOK = {
    telefono: { color: '#1f6f8b', dash: '', family: 'a voce' },
    verbale: { color: '#6b6f2f', dash: '', family: 'a voce' },
    'di persona': { color: '#2b2b2b', dash: '', family: 'in presenza' },
    'e-mail': { color: '#7a5ea8', dash: '5 4', family: 'elettronica' },
    sistema: { color: '#2f5fa5', dash: '5 4', family: 'elettronica' },
    fax: { color: '#a9611f', dash: '9 3 2 3', family: 'cartacea' },
    cartaceo: { color: '#8a6d3b', dash: '9 3 2 3', family: 'cartacea' },
    inferita: { color: '#9aa0a6', dash: '1 4', family: 'supposta' },
    altro: { color: '#57606a', dash: '', family: 'altro' }
  };
  V.channelLook = (ch) => V.CHANNEL_LOOK[ch] || V.CHANNEL_LOOK.altro;
  /** tinte ammesse quando si forza a mano l'aspetto di un collegamento (eccezione dichiarata, non tavolozza libera:
   *  due mappe dello stesso reparto devono restare confrontabili e la legenda deve poter spiegare ogni segno) */
  V.INK_COLORS = [
    { id: '', name: 'dal significato' }, { id: '#2b2b2b', name: 'matita' }, { id: '#c8321e', name: 'rosso' },
    { id: '#1f4e79', name: 'blu' }, { id: '#3f7d5a', name: 'verde' }, { id: '#b7791f', name: 'ocra' }, { id: '#7a5ea8', name: 'viola' }
  ];
  V.INK_DASHES = [{ id: '', name: 'dal significato' }, { id: 'none', name: 'pieno' }, { id: '6 5', name: 'tratteggiato' }, { id: '1 4', name: 'punteggiato' }, { id: '9 3 2 3', name: 'tratto-punto' }];
  V.MUDA = ['confusione', 'movimento/trasporto', 'attesa', 'sovra-processo', 'scorte', 'difetti', 'sovrapproduzione'];
  V.RULES = ['1 attività specificate', '2 richiesta semplice e diretta', '3 flusso semplice e diretto', '4 problemi affrontati subito'];
  V.MOODS = ['neutro', 'felice', 'soddisfatto', 'triste', 'stanco', 'confuso', 'arrabbiato', 'in attesa', 'preoccupato', 'sorpreso'];
  /** significato dichiarato di ogni espressione (cap. 7: il potere di includere le emozioni) */
  V.MOOD_MEANING = { neutro: 'né bene né male: esperienza ordinaria', felice: 'esperienza positiva in questo punto', soddisfatto: 'bisogno risolto, richiesta chiusa bene', triste: 'esperienza negativa, delusione', stanco: 'sovraccarico, fatica (operatore a fine turno, paziente spossato)', confuso: 'non sa cosa fare o dove andare: istruzioni poco chiare', arrabbiato: 'frustrazione: errori, ripetizioni, rimpalli', 'in attesa': 'aspetta senza sapere quanto né perché', preoccupato: 'ansia, incertezza (es. attesa di un referto)', sorpreso: 'imprevisto: qualcosa che non si aspettava' };
  V.DELTA_KINDS = ['attesa', 'in-box', 'coda', 'viaggio', 'sala d\'attesa'];
  V.BAD_WORDS = /\b(a volte|alle volte|talvolta|dipende|forse|magari|può darsi|puo darsi|qualche volta|di solito|in genere|se capita|se serve|se possibile)\b/i;

  // ---------- tipi di elemento: default e spiegazioni (dal libro, parole nostre) ----------
  V.TYPES = {
    box: { name: 'Process box', w: 150, h: 170, props: { title: '', activities: [], hi: '', lo: '', avg: '', cc: '', owner: '', gateIn: '', gateOut: '' },
      why: 'Un rettangolo verticale per ogni passo maggiore dell\'erogazione, con il titolo in alto e, se serve, le attività in ordine. Chiediti: che attività "apre la porta" del box e quale "la chiude"? Nel CSM le attività necessarie ora contano come valore. Più di 4-5 box: la complessità è necessaria o servono due mappe?' },
    delta: { name: 'Delta (attesa)', w: 30, h: 26, props: { note: '', kind: 'attesa', hi: '', lo: '', avg: '' },
      why: 'Il triangolo rovesciato rosso segna il tempo in cui nulla avanza (richiesta nel vassoio, campione in coda, viaggio, paziente in sala d\'attesa): è spreco reso visibile. Il tempo si ottiene per differenza tra la fine del box precedente e l\'inizio del successivo, non si cronometra. Aggancialo a una freccia di flusso per entrare nella timeline.' },
    person: { name: 'Persona', w: 40, h: 78, props: { label: 'richiedente', role: '', mood: 'neutro', requestor: true },
      why: 'L\'omino rappresenta chi origina la richiesta (a destra, nella fascia alta) o un operatore. L\'espressione (felice/neutro/triste) racconta l\'esperienza. Le vie di richiesta partono da qui.' },
    storm: { name: 'Nuvola temporalesca', w: 120, h: 50, props: { text: '', muda: '', rule: '', a3: false, collapsed: false },
      why: 'Un problema del processo, mai una colpa: "che cosa, del modo in cui il lavoro accade ora, non è ideale?". Etichettalo con il muda (confusione, movimento, attesa, sovra-processo, scorte, difetti, sovrapproduzione) e la regola violata. Le nuvole diventano candidate ad A3 (5 perché → contromisure → test → follow-up).' },
    fluffy: { name: 'Nuvola soffice', w: 120, h: 50, props: { text: '' },
      why: 'Una buona pratica o un\'idea da conservare: ciò che già funziona (e va replicato) o un\'idea per lo stato futuro.' },
    burst: { name: 'Kaizen burst', w: 110, h: 60, props: { text: '', priority: 'media', owner: '' },
      why: 'L\'esplosione segna un punto candidato a progetto di miglioramento (es. doppio inserimento dati). Ha un owner e una priorità: finisce nel piano What/Who/When/Outcome.' },
    inventory: { name: 'Scorta', w: 44, h: 40, props: { what: '', qty: '', days: '' },
      why: 'Il triangolo di inventario mostra una scorta (materiale o pazienti in attesa) con la quantità e i giorni di copertura all\'uso normale: se eccessivi, ridurre. Anche la sala d\'attesa è "scorta" che rivela il collo di bottiglia.' },
    inbox: { name: 'In-box / attesa', w: 44, h: 36, props: { kind: 'in-box', avg: '' },
      why: 'Il vassoio (informazione che aspetta di essere lavorata) o l\'orologio (persone che aspettano) con il tempo medio: attese che si vedono e si misurano.' },
    distance: { name: 'Distanza', w: 70, h: 24, props: { meters: '', from: '', to: '' },
      why: 'Dal diagramma spaghetti: quanti metri si percorrono per un passo. Il movimento è uno dei sette muda; disegna il lavoro in linea retta.' },
    lane: { name: 'Corsia (reparto)', w: 1100, h: 160, props: { name: 'Reparto', color: '' },
      why: 'Una corsia orizzontale per reparto quando il processo attraversa più reparti: rende visibile chi fa cosa e i passaggi di consegna. Se la mappa diventa illeggibile, meglio più mappe collegate (drill-down).' },
    text: { name: 'Testo', w: 140, h: 24, props: { text: 'nota', size: 12 },
      why: 'Una nota libera. Poche parole: sulla mappa deve lavorare l\'immagine.' },
    icon: { name: 'Icona', w: 30, h: 30, props: { icon: 'telefono', label: '' },
      why: 'Una piccola icona (canale, mezzo, documento, dispositivo, luogo, ruolo) messa dove serve: dice a colpo d\'occhio con che cosa o attraverso che cosa il lavoro passa. Bloccala a un passo o a una freccia perché lo segua. Poche icone, solo dove aiutano a leggere.' },
    face: { name: 'Faccia (esperienza)', w: 34, h: 34, props: { mood: 'neutro', who: 'paziente', label: '' },
      why: 'L\'esperienza di chi vive il processo in quel punto (cap. 7: includere le emozioni). Il paziente in sala d\'attesa è preoccupato? L\'infermiere al terzo rimpallo è arrabbiato? La faccia lo mette sulla mappa senza colpe: è il processo che produce quell\'emozione, e lo stato futuro deve cambiarla.' },
    legend: { name: 'Legenda', w: 170, h: 90, props: {},
      why: 'In alto a sinistra: le icone usate nella mappa, così chiunque la legge da solo.' },
    flow: { name: 'Freccia di flusso', props: { label: '', or: false, style: 'solid' },
      why: 'Collega due passi nell\'ordine in cui accadono, da sinistra a destra. Alternative: più frecce con "or". Tratteggiata = flusso di informazione. L\'ordine del flusso, e quindi la timeline, deriva da queste frecce.' },
    request: { name: 'Via di richiesta', props: { channel: 'telefono', to: '', hands: '', note: '' },
      why: 'Ogni via reale con cui la richiesta arriva (telefono, fax, e-mail, verbale, di persona, sistema…): disegnale tutte. Molte frecce nella fascia alta = richiesta non standardizzata: è la prima leva di miglioramento.' }
  };
  // Modalità di disegno dei collegamenti (come le "link render mode" di ComfyUI): riguarda il tracciato,
  // non il significato. Sta nella mappa e non nelle preferenze del dispositivo perché il foglio è un disegno:
  // deve arrivare uguale a chi lo apre, lo esporta o lo stampa.
  // La squadrata automatica e' stata tolta su richiesta di Gt: le frecce vanno dritte al bersaglio
  // e il percorso si piega A MANO trascinando la linea (props.via = punti di passaggio).
  // Le mappe salvate in "squadrata" ricadono su "dritta" (linkModeOf valida contro questa lista).
  V.LINK_MODES = [
    { id: 'dritta', name: 'dritta', hint: 'linea diretta; trascina la linea per piegarla dove serve' },
    { id: 'curva', name: 'curva', hint: 'come il disegno a mano del libro' }
  ];
  V.linkModeOf = (map) => { const m = map && map.links && map.links.mode; return V.LINK_MODES.some(x => x.id === m) ? m : 'dritta'; };

  V.CONNECTOR_TYPES = ['flow', 'request'];
  V.isConnector = (el) => V.CONNECTOR_TYPES.includes(el.type);

  V.newElement = (type, x, y, props = {}) => {
    const T = V.TYPES[type];
    return { id: uid(), type, x, y, w: T.w, h: T.h, z: 0, props: Object.assign(clone(T.props), props) };
  };
  V.newConnector = (type, from, to, props = {}) => ({ id: uid(), type, from, to, props: Object.assign(clone(V.TYPES[type].props), props) });

  V.newMap = (o = {}) => Object.assign({
    id: uid(), title: '', date: today(), authors: '', unitName: '', kind: 'current', pairId: null, parentId: null,
    // giri dell'attuale: verOf = versione precedente, verName = nome del giro; l'Ideale (kind 'future')
    // e' uno solo per catena e porta il lucchetto di validazione (validated). tint = tinta dello sfondo.
    verOf: null, verName: 'mappa iniziale', validated: false, tint: Math.floor(Math.random() * 360),
    unit: 'minuti', samples: '', scope: '', ideal: '', requestor: '',
    elements: [], strokes: [], plan: [],
    prep: { observable: false, frequent: false, worthy: false, drawer: '', owner: '', physicians: false, stable: false, staffing: false },
    validation: { walked: false, walkedBy: '', walkedDate: '', prepared: false, validatedBy: '', validatedDate: '', corrections: '' },
    data: { tool: false, boundariesAgreed: false, feedback: false, notes: '' },
    analysis: { goodEnough: '', questions: {} },
    futureCheck: { people: false, sponsor: '', date: '', constraints: '', validatedBy: '' },
    closure: { remeasureDate: '', notes: '', checks: {} },
    guidePhase: 0, view: null, overlays: true, paper: clone(V.PAPER), links: { mode: 'dritta' }, created: Date.now(), updated: Date.now()
  }, o);

  // ---------- documento ----------
  V.doc = { version: 2, activeMapId: null, maps: {} };
  V.map = () => V.doc.maps[V.doc.activeMapId];
  V.byId = (id, map = V.map()) => map.elements.find(e => e.id === id);

  // ---------- undo a comandi ----------
  const undoStack = [], redoStack = [];
  const listeners = [];
  V.onChange = (fn) => listeners.push(fn);
  const emit = (info) => listeners.forEach(fn => { try { fn(info); } catch (e) { console.error(e); } });

  function applyOp(op, map) {
    switch (op.t) {
      case 'add': map.elements.push(clone(op.el)); break;
      case 'remove': { const i = map.elements.findIndex(e => e.id === op.el.id); if (i >= 0) map.elements.splice(i, 1); break; }
      case 'update': { const el = map.elements.find(e => e.id === op.id); if (el) Object.assign(el, clone(op.after)); break; }
      case 'props': { const el = map.elements.find(e => e.id === op.id); if (el) Object.assign(el.props, clone(op.after)); break; }
      case 'stroke_add': map.strokes.push(op.s); break;
      case 'stroke_remove': { const i = map.strokes.findIndex(s => s.id === op.s.id); if (i >= 0) map.strokes.splice(i, 1); break; }
      case 'strokes_set': map.strokes = clone(op.after); break;
      case 'meta': Object.assign(map, clone(op.after)); break;
      case 'plan_set': map.plan = clone(op.after); break;
    }
  }
  function invert(op, mapBefore) {
    switch (op.t) {
      case 'add': return { t: 'remove', el: op.el };
      case 'remove': return { t: 'add', el: op.el };
      case 'update': return { t: 'update', id: op.id, after: op.before, before: op.after };
      case 'props': return { t: 'props', id: op.id, after: op.before, before: op.after };
      case 'stroke_add': return { t: 'stroke_remove', s: op.s };
      case 'stroke_remove': return { t: 'stroke_add', s: op.s };
      case 'strokes_set': return { t: 'strokes_set', after: op.before, before: op.after };
      case 'meta': return { t: 'meta', after: op.before, before: op.after };
      case 'plan_set': return { t: 'plan_set', after: op.before, before: op.after };
    }
  }
  /** commit(ops, label): applica le operazioni al modello, registra l'inversa, salva, notifica. */
  V.commit = (ops, label = '', opts = {}) => {
    const map = opts.map || V.map(); if (!map) return;
    // Ideale validato = lucchetto chiuso: nessuna modifica passa. Un solo posto di guardia per tutte
    // le vie di modifica (gesti, pop-up, azioni rapide, coach). Il lucchetto stesso non passa da qui.
    if (map.validated) { V.ui && V.ui.toast && V.ui.toast('Ideale validato \u{1F512}: apri il lucchetto in alto per modificarlo.'); return; }
    ops = Array.isArray(ops) ? ops : [ops];
    // fill "before" for update/props ops
    ops.forEach(op => {
      if ((op.t === 'update' || op.t === 'props') && !op.before) { const el = map.elements.find(e => e.id === op.id); if (el) { op.before = {}; Object.keys(op.after).forEach(k => { op.before[k] = clone(op.t === 'props' ? el.props[k] : el[k]); }); } }
      if (op.t === 'meta' && !op.before) { op.before = {}; Object.keys(op.after).forEach(k => op.before[k] = clone(map[k])); }
      if (op.t === 'plan_set' && !op.before) op.before = clone(map.plan);
      if (op.t === 'strokes_set' && !op.before) op.before = clone(map.strokes);
    });
    ops.forEach(op => applyOp(op, map));
    map.updated = Date.now();
    if (!opts.silent) { undoStack.push({ mapId: map.id, ops: ops.map(op => invert(op)).reverse(), redo: ops, label }); if (undoStack.length > 200) undoStack.shift(); redoStack.length = 0; }
    V.save();
    emit({ ops, label, mapId: map.id });
  };
  // anche annulla/ripeti rispettano il lucchetto: la voce resta in cima, si riprova dopo lo sblocco
  const lockedEntry = (e) => { const m = V.doc.maps[e.mapId]; if (m && m.validated) { V.ui && V.ui.toast && V.ui.toast('Ideale validato \u{1F512}: apri il lucchetto per annullare o ripetere lì.'); return true; } return false; };
  V.undo = () => { let e; while ((e = undoStack.pop())) { const map = V.doc.maps[e.mapId]; if (!map) continue; if (lockedEntry(e)) { undoStack.push(e); return false; } if (V.doc.activeMapId !== e.mapId) V.switchMap(e.mapId); e.ops.forEach(op => applyOp(op, map)); redoStack.push(e); V.save(); emit({ undo: true, label: e.label }); return true; } return false; };
  V.redo = () => { let e; while ((e = redoStack.pop())) { const map = V.doc.maps[e.mapId]; if (!map) continue; if (lockedEntry(e)) { redoStack.push(e); return false; } if (V.doc.activeMapId !== e.mapId) V.switchMap(e.mapId); e.redo.forEach(op => applyOp(op, map)); undoStack.push(e); V.save(); emit({ redo: true, label: e.label }); return true; } return false; };
  V.canUndo = () => undoStack.length > 0; V.canRedo = () => redoStack.length > 0;

  // ---------- mappe: crea, cambia, elimina ----------
  /** le nuvole si alzano quanto serve al loro testo (stesse costanti del disegno): senza, il testo sforava */
  const fitClouds = (m) => { const R2 = V.render; if (!m || !Array.isArray(m.elements) || !R2 || !R2.cloudFit) return m; m.elements.forEach(el => { if ((el.type === 'storm' || el.type === 'fluffy') && !el.props.collapsed && el.props.text) el.h = Math.max(el.h, R2.cloudFit(el.w, el.props.text)); }); return m; };
  V.addMap = (map) => { V.doc.maps[map.id] = fitClouds(map); return map; };
  V.switchMap = (id) => { if (!V.doc.maps[id]) return; V.doc.activeMapId = id; V.save(); emit({ switched: true }); };
  V.deleteMap = (id) => {
    const m = V.doc.maps[id]; if (!m) return;
    if (m.validated) { V.ui && V.ui.toast && V.ui.toast('Ideale validato \u{1F512}: apri il lucchetto prima di eliminarlo.'); return; }
    // un giro eliminato non deve rompere la catena (i giri successivi si riattaccano al precedente)
    // ne' orfanare l'Ideale (il pairId passa a un altro giro della catena)
    const heirs = Object.values(V.doc.maps).filter(o => o.verOf === id);
    heirs.forEach(o => { o.verOf = (m.verOf && V.doc.maps[m.verOf]) ? m.verOf : null; });
    if (m.kind === 'current' && m.pairId && V.doc.maps[m.pairId] && V.doc.maps[m.pairId].kind === 'future') {
      const f = V.doc.maps[m.pairId];
      const h = V.versionsOf(m).filter(x => x.id !== id).pop();
      if (h) { h.pairId = f.id; f.pairId = h.id; }
    }
    delete V.doc.maps[id];
    Object.values(V.doc.maps).forEach(o => { if (o.pairId === id) o.pairId = null; if (o.parentId === id) o.parentId = null; if (o.verOf === id) o.verOf = null; });
    if (V.doc.activeMapId === id) {
      const next = (m.verOf && V.doc.maps[m.verOf] && m.verOf) || (heirs[0] && heirs[0].id) || Object.keys(V.doc.maps)[0];
      V.doc.activeMapId = next || V.addMap(V.newMap({ title: '' })).id;
    }
    V.save(); emit({ switched: true });
  };
  V.currentOf = (map) => map.kind === 'current' ? map : (map.pairId ? V.doc.maps[map.pairId] : null);
  /** i giri dell'attuale: dalla mappa si risale alla radice (verOf) e si scende ai giri successivi, in ordine */
  V.versionsOf = (map) => {
    if (!map) return [];
    let m = map.kind === 'current' ? map : V.currentOf(map); if (!m) return [];
    const seen = new Set();
    while (m.verOf && V.doc.maps[m.verOf] && !seen.has(m.verOf)) { seen.add(m.verOf); m = V.doc.maps[m.verOf]; }
    const out = []; const walk = (x) => { if (out.includes(x)) return; out.push(x); Object.values(V.doc.maps).filter(y => y.verOf === x.id && y.kind === 'current').forEach(walk); };
    walk(m); return out;
  };
  /** l'Ideale e' UNO per catena di giri: si cerca su tutta la catena, non solo sulla mappa attiva */
  V.idealOf = (map) => {
    if (!map) return null; if (map.kind === 'future') return map;
    for (const m of V.versionsOf(map)) { const f = m.pairId && V.doc.maps[m.pairId]; if (f && f.kind === 'future') return f; }
    return null;
  };
  V.futureOf = (map) => V.idealOf(map);
  /** nuovo giro dell'attuale: copia della mappa attiva, stesso Ideale, nome proposto dal numero del giro */
  V.createVersion = (cur) => {
    const chain = V.versionsOf(cur); const n = chain.length + 1;
    const names = [null, null, 'secondo giro', 'terzo giro', 'quarto giro', 'quinto giro', 'sesto giro'];
    const f = V.newMap(Object.assign(clone(cur), { id: uid(), kind: 'current', verOf: cur.id, verName: names[n] || (n + 'º giro'), validated: false, tint: Math.floor(Math.random() * 360), created: Date.now() }));
    f.elements = clone(cur.elements); f.strokes = clone(cur.strokes); f.plan = clone(cur.plan);
    V.addMap(f); V.save(); return f;
  };
  V.createFuture = (cur) => {
    const have = V.idealOf(cur); if (have) return have;
    const f = V.newMap(Object.assign(clone(cur), { id: uid(), kind: 'future', pairId: cur.id, verOf: null, verName: 'ideale', validated: false, tint: Math.floor(Math.random() * 360), title: cur.title, validation: V.newMap().validation, created: Date.now() }));
    f.elements = clone(cur.elements); f.strokes = []; f.plan = clone(cur.plan);
    V.addMap(f); cur.pairId = f.id; V.save(); return f;
  };
  /** lucchetto dell'Ideale: non passa da commit (che a lucchetto chiuso rifiuta tutto) */
  V.setValidated = (map, on) => { map.validated = !!on; map.updated = Date.now(); V.save(); emit({ label: on ? 'validata' : 's-validata', mapId: map.id, ops: [] }); };
  /** etichetta leggibile del tipo di mappa (per testata, elenchi e sfondo del foglio) */
  V.kindLabel = (m) => m.kind === 'future' ? 'ideale' : m.kind === 'detail' ? 'dettaglio' : (m.verName || 'attuale');
  V.createDetail = (parent, title) => { const d = V.newMap({ kind: 'detail', parentId: parent.id, title: title || ('Dettaglio di ' + (parent.title || 'mappa')), unit: parent.unit, authors: parent.authors }); V.addMap(d); V.save(); return d; };

  // ---------- storage: IndexedDB con fallback localStorage ----------
  const DB = 'vsm-coach', STORE = 'kv';
  let idb = null;
  function openIdb() { return new Promise((res) => { if (!('indexedDB' in window)) return res(null); const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => res(r.result); r.onerror = () => res(null); }); }
  function idbGet(k) { return new Promise((res) => { if (!idb) return res(undefined); const tx = idb.transaction(STORE, 'readonly'); const rq = tx.objectStore(STORE).get(k); rq.onsuccess = () => res(rq.result); rq.onerror = () => res(undefined); }); }
  function idbSet(k, v) { return new Promise((res) => { if (!idb) return res(false); const tx = idb.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(v, k); tx.oncomplete = () => res(true); tx.onerror = () => res(false); }); }
  let saveTimer = null;
  V.save = () => { clearTimeout(saveTimer); saveTimer = setTimeout(async () => { const s = JSON.stringify(V.doc); const ok = await idbSet('doc', s); try { if (!ok) localStorage.setItem('vsm.doc', s); else localStorage.removeItem('vsm.doc'); localStorage.setItem('vsm.doc.meta', JSON.stringify({ at: Date.now(), active: V.doc.activeMapId })); } catch (e) { /* quota */ } }, 400); };
  V.load = async () => {
    idb = await openIdb();
    let s = await idbGet('doc'); if (!s) { try { s = localStorage.getItem('vsm.doc'); } catch (e) { } }
    if (s) { try { const d = JSON.parse(s); if (d && d.version === 2 && d.maps) { V.doc = d; Object.values(V.doc.maps).forEach(m => { keepLook(m); Object.assign(m, Object.assign(V.newMap(), m)); }); } } catch (e) { console.warn('doc non leggibile', e); } }
    if (!Object.keys(V.doc.maps).length) {
      const v1 = migrateV1(); if (v1) { v1.forEach(m => V.addMap(m)); V.doc.activeMapId = v1[0].id; }
      else { const m = V.addMap(V.newMap({ title: '' })); V.doc.activeMapId = m.id; }
    }
    if (!V.doc.maps[V.doc.activeMapId]) V.doc.activeMapId = Object.keys(V.doc.maps)[0];
    return V.doc;
  };
  /** una mappa salvata prima che il foglio diventasse grande resta della sua misura: spostarle gli elementi sarebbe peggio */
  /** aspetto ereditato: una mappa salvata prima che esistessero il foglio grande e le modalità dei
      collegamenti riprende il foglio A3. Il tratto invece viene normalizzato a "dritta", come ogni mappa
      nuova: è la lettura scelta per l'app, e la modalità resta cambiabile per singola mappa dal menu ⋯.
      (Le mappe che hanno già una modalità salvata non vengono toccate.) */
  const keepLook = (m) => { if (m && !m.paper) m.paper = clone(V.PAPER_A3); if (m && !m.links) m.links = { mode: 'dritta' }; if (m && Array.isArray(m.elements)) m.elements = m.elements.filter(e => e.type !== 'legend'); return fitClouds(m); };
  V.replaceDoc = (d) => { if (!d || d.version !== 2 || !d.maps) throw new Error('Formato non riconosciuto (serve un JSON di VSM Coach v2)'); V.doc = d; Object.values(V.doc.maps).forEach(m => { keepLook(m); Object.assign(m, Object.assign(V.newMap(), m)); }); if (!V.doc.maps[V.doc.activeMapId]) V.doc.activeMapId = Object.keys(V.doc.maps)[0]; undoStack.length = 0; redoStack.length = 0; V.save(); emit({ switched: true }); };
  V.importMaps = (d) => { // aggiunge le mappe di un altro documento senza sostituire (id già esistenti → rigenerati, per non perdere le modifiche fatte nel frattempo)
    if (d.version === 2 && d.maps) {
      const idRemap = new Map();
      Object.keys(d.maps).forEach(id => { if (V.doc.maps[id]) idRemap.set(id, uid()); });
      const imported = Object.values(d.maps).map(m => {
        const nm = Object.assign(V.newMap(), keepLook(m));
        if (idRemap.has(nm.id)) nm.id = idRemap.get(nm.id);
        if (nm.pairId && idRemap.has(nm.pairId)) nm.pairId = idRemap.get(nm.pairId);
        if (nm.parentId && idRemap.has(nm.parentId)) nm.parentId = idRemap.get(nm.parentId);
        return nm;
      });
      imported.forEach(m => { V.doc.maps[m.id] = m; });
      V.doc.activeMapId = imported[0].id; V.save(); emit({ switched: true }); return imported.length;
    }
    if (d.version === 1 || d.current) { const ms = V.fromV1(d); ms.forEach(m => V.addMap(m)); V.doc.activeMapId = ms[0].id; V.save(); emit({ switched: true }); return ms.length; }
    throw new Error('Formato non riconosciuto');
  };

  // ---------- migrazione dalla v1 (modulo → elementi posizionati) ----------
  V.fromV1 = (S) => {
    const build = (m, kind, meta) => {
      const map = V.newMap({ paper: clone(V.PAPER_A3), links: { mode: 'dritta' }, kind, title: (S.meta && S.meta.title) || '', date: S.meta?.date, authors: S.meta?.authors, unitName: S.meta?.unitName, scope: S.meta?.scope, ideal: S.meta?.ideal, unit: m.unit || 'minuti', samples: m.samples || '', requestor: m.requestor || '', prep: S.prep, validation: S.validation, data: S.data, analysis: S.analysis, futureCheck: S.futureCheck, closure: S.closure, plan: S.plan || [], guidePhase: S.ui?.phase || 0 });
      const n = m.boxes.length; const left = 90; let bw = 150, gap = 80; const avail = 1000; if (n * bw + (n - 1) * gap > avail) { const k = avail / (n * bw + (n - 1) * gap); bw *= k; gap *= k; }
      const boxes = m.boxes.map((b, i) => { const el = V.newElement('box', left + i * (bw + gap), 300, { title: b.title, activities: b.activities || [], hi: b.hi, lo: b.lo, avg: b.avg }); el.w = bw; map.elements.push(el); (b.clouds || []).forEach((c, j) => map.elements.push(V.newElement('storm', el.x + bw - 60, 232 - j * 40, { text: c.text, muda: c.muda, rule: c.rule }))); return el; });
      boxes.forEach((b, i) => { if (i < n - 1) { const c = V.newConnector('flow', { el: b.id }, { el: boxes[i + 1].id }); map.elements.push(c); const d = m.deltas[i]; if (d) { const de = V.newElement('delta', (b.x + b.w + boxes[i + 1].x) / 2 - 15, 328, { note: d.note, hi: d.hi, lo: d.lo, avg: d.avg }); de.props.attachedTo = c.id; map.elements.push(de); (d.clouds || []).forEach((cl, j) => map.elements.push(V.newElement('storm', de.x - 40, 232 - j * 40, { text: cl.text, muda: cl.muda, rule: cl.rule }))); } } });
      const p = V.newElement('person', 1080, 110, { label: m.requestor || 'richiedente', requestor: true }); map.elements.push(p);
      (m.requestSteps || []).forEach((r, i) => { const target = boxes[0]; const c = V.newConnector('request', { el: p.id }, target ? { el: target.id } : { x: 300, y: 150 + i * 30 }, { channel: r.channel, to: r.to, note: r.note }); c.props.offset = i; map.elements.push(c); if (r.cloud) map.elements.push(V.newElement('storm', 600, 60 + i * 44, { text: r.cloud })); });
      return map;
    };
    const cur = build(S.current, 'current');
    const out = [cur];
    if (S.future && S.future.boxes && S.future.boxes.length) { const f = build(S.future, 'future'); f.pairId = cur.id; cur.pairId = f.id; out.push(f); }
    return out;
  };
  function migrateV1() { try { const j = localStorage.getItem('vsm.state'); if (!j) return null; const S = JSON.parse(j); if (!S.current || !S.current.boxes || !S.current.boxes.length) return null; const ms = V.fromV1(S); localStorage.setItem('vsm.state.v1backup', j); localStorage.removeItem('vsm.state'); return ms; } catch (e) { return null; } }

  // ---------- geometria e grafo ----------
  V.center = (el) => ({ x: el.x + el.w / 2, y: el.y + el.h / 2 });
  V.anchor = (el, towards) => { // punto sul bordo del rettangolo verso "towards"
    const c = V.center(el); const dx = towards.x - c.x, dy = towards.y - c.y;
    if (el.type === 'person') return { x: c.x, y: dy > 0 ? el.y + el.h : el.y };
    if (Math.abs(dx) * el.h > Math.abs(dy) * el.w) return { x: dx > 0 ? el.x + el.w : el.x, y: c.y };
    return { x: c.x, y: dy > 0 ? el.y + el.h : el.y };
  };
  // il capo di una freccia sta dove l'elemento si VEDE: per un elemento bloccato e' R.elPos, non x/y grezzi
  V.endPoint = (end, map) => { if (end.el) { const e = V.byId(end.el, map); if (e) { const R2 = V.render; const p = (R2 && R2.elPos) ? R2.elPos(e, map) : e; return { x: p.x + e.w / 2, y: p.y + e.h / 2 }; } } return { x: end.x || 0, y: end.y || 0 }; };
  /** ordine del flusso: catena dei box seguendo le frecce di flusso; fallback per x (stima). */
  V.flowOrder = (map) => {
    const boxes = map.elements.filter(e => e.type === 'box');
    const flows = map.elements.filter(e => e.type === 'flow' && e.from.el && e.to.el);
    if (!flows.length) return { order: boxes.slice().sort((a, b) => a.x - b.x), estimated: boxes.length > 1, flows: [] };
    const outMap = new Map(), inCount = new Map(); boxes.forEach(b => { outMap.set(b.id, []); inCount.set(b.id, 0); });
    flows.forEach(f => { if (outMap.has(f.from.el) && inCount.has(f.to.el)) { outMap.get(f.from.el).push(f); inCount.set(f.to.el, inCount.get(f.to.el) + 1); } });
    const starts = boxes.filter(b => inCount.get(b.id) === 0).sort((a, b) => a.x - b.x);
    const order = [], seen = new Set(); const usedFlows = [];
    const visit = (b) => { if (seen.has(b.id)) return; seen.add(b.id); order.push(b); const outs = outMap.get(b.id).slice().sort((p, q) => (V.byId(p.to.el, map)?.x || 0) - (V.byId(q.to.el, map)?.x || 0)); outs.forEach(f => { usedFlows.push(f); const t = V.byId(f.to.el, map); if (t) visit(t); }); };
    (starts.length ? starts : boxes.slice().sort((a, b) => a.x - b.x)).forEach(visit);
    boxes.forEach(b => visit(b));
    return { order, estimated: order.length !== boxes.length, flows: usedFlows };
  };
  V.metrics = (map) => {
    const boxes = map.elements.filter(e => e.type === 'box');
    const deltas = map.elements.filter(e => e.type === 'delta');
    const va = boxes.map(b => num(b.props.avg)).filter(v => v != null).reduce((a, b) => a + b, 0);
    const nva = deltas.map(d => num(d.props.avg)).filter(v => v != null).reduce((a, b) => a + b, 0);
    const tot = va + nva; const hasData = boxes.some(b => num(b.props.avg) != null) || deltas.some(d => num(d.props.avg) != null);
    const ccs = boxes.map(b => num(b.props.cc)).filter(v => v != null);
    const ftq = ccs.length ? ccs.reduce((a, b) => a * (b / 100), 1) * 100 : null;
    const requests = map.elements.filter(e => e.type === 'request');
    return { va, nva, tot, vaPct: tot > 0 ? va / tot * 100 : null, nvaPct: tot > 0 ? nva / tot * 100 : null, hasData, ftq, boxes: boxes.length, deltas: deltas.length, requests: requests.length, storms: map.elements.filter(e => e.type === 'storm').length, flows: map.elements.filter(e => e.type === 'flow').length, persons: map.elements.filter(e => e.type === 'person').length, incompleteBoxes: boxes.filter(b => num(b.props.avg) == null).length, incompleteDeltas: deltas.filter(d => num(d.props.avg) == null).length };
  };

  // ---------- controlli offline (dal libro) ----------
  V.lint = (map) => {
    const out = []; const add = (level, phase, msg, elId) => out.push({ level, phase, msg, elId });
    const M = V.metrics(map); const boxes = map.elements.filter(e => e.type === 'box');
    if (!map.title) add('bad', 0, 'Manca il titolo (tocca l\'intestazione in barra: titolo, data, iniziali).');
    if (!map.authors) add('warn', 0, 'Mancano le iniziali degli autori.');
    if (!map.scope) add('warn', 0, 'Definisci lo scopo in una frase: "dalla richiesta X alla consegna Y".');
    if (map.kind === 'current' && !map.prep.drawer) add('warn', 0, 'Un solo responsabile del disegno: chi è?');
    const requestors = map.elements.filter(e => e.type === 'person' && e.props.requestor);
    if (M.boxes && !requestors.length) add('warn', 1, 'Chi è il richiedente? Metti l\'omino a destra, nella fascia alta.');
    if (M.boxes && requestors.length && !M.requests) add('warn', 1, 'Nessuna via di richiesta disegnata: come arriva la richiesta (telefono, fax, e-mail, verbale…)? Disegnale tutte.');
    if (!M.boxes) add('bad', 2, 'Nessun process box: qual è il primo passo maggiore?');
    if (M.boxes > 5) add('warn', 2, `${M.boxes} process box: la complessità è necessaria? Forse servono due mappe (turno, unità, caso).`);
    boxes.forEach(b => { if (!b.props.title) add('warn', 2, 'Un box non ha titolo.', b.id); });
    if (M.boxes >= 2 && !M.flows) add('warn', 2, 'I box non sono collegati da frecce di flusso: l\'ordine del flusso è solo stimato.');
    map.elements.filter(c => V.isConnector(c) && (!c.from.el || !c.to.el)).forEach(c => add('warn', c.type === 'request' ? 1 : 2, `Una ${c.type === 'request' ? 'via di richiesta' : 'freccia di flusso'} ha un capo staccato: trascina il cerchio su un elemento per ricollegarla.`, c.id));
    if (M.boxes >= 2 && !M.deltas) add('warn', 3, 'Nessun delta: tra un box e il successivo, quando nulla avanza? Dove sta ferma la cosa?');
    const blob = [map.scope, ...map.elements.flatMap(e => [e.props.title, e.props.text, e.props.note, ...(e.props.activities || [])])].filter(Boolean).join(' \n ');
    const bw = blob.match(V.BAD_WORDS); if (bw) add('warn', 6, `Parola cattiva trovata: "${bw[0]}" — qui il processo non è specificato (Regola 1). Che cosa succede davvero?`);
    if (map.kind === 'current' && M.boxes >= 1 && !map.validation.walked) add('warn', 4, 'Il processo non risulta ancora camminato (osservazione diretta): la mappa è provvisoria.');
    if (map.kind === 'current' && M.boxes >= 1 && !map.validation.validatedBy) add('warn', 4, 'La mappa non risulta validata da chi fa il lavoro ("ti sembra giusto? ho dimenticato qualcosa?").');
    if (M.boxes >= 1 && !M.hasData) add('warn', 5, 'Nessun dato Hi/Lo/Avg: senza tempi la mappa non mostra lo spreco (tocca un box o un delta per inserirli).');
    if (M.hasData) {
      const s = num(map.samples); if (s == null) add('warn', 5, 'Dichiara quante misure hai raccolto (~30; 8-10 per una vista rapida).'); else if (s < 8) add('warn', 5, `${s} misure sono poche: 8-10 per una vista rapida, ~30 per significatività.`);
      map.elements.filter(e => e.type === 'box' || e.type === 'delta').forEach(x => { const hi = num(x.props.hi), lo = num(x.props.lo), av = num(x.props.avg); if (hi != null && lo != null && av != null && !(lo <= av && av <= hi)) add('bad', 5, `Dati incoerenti (${x.props.title || x.props.note || 'delta'}): deve valere Lo ≤ Avg ≤ Hi.`, x.id); });
      if (M.incompleteBoxes + M.incompleteDeltas) add('warn', 5, `${M.incompleteBoxes + M.incompleteDeltas} elementi senza media: il riepilogo VA/NVA è parziale.`);
    }
    if (M.hasData && !M.storms) add('warn', 6, 'Nessuna nuvola temporalesca: che cosa, del modo in cui il lavoro accade ora, non è ideale?');
    const fo = V.flowOrder(map); if (fo.estimated && M.boxes >= 2 && M.flows) add('warn', 2, 'Alcuni box non sono nella catena delle frecce: la timeline li ordina per posizione (stima).');
    if (map.kind === 'future') {
      const cur = V.currentOf(map);
      if (cur) {
        const MC = V.metrics(cur);
        if (M.requests > MC.requests || M.boxes > MC.boxes) add('bad', 7, 'Lo stato futuro non è più semplice dell\'attuale (più vie di richiesta o più box): torna a osservare.');
        if (MC.requests > 1 && M.requests >= MC.requests) add('warn', 7, 'La prima leva è ridurre le vie della richiesta: nello stato futuro sono ancora ' + M.requests + '.');
        if (map.unit !== cur.unit) add('bad', 7, 'Unità di misura diversa tra stato attuale e futuro: usa la stessa.');
        if (M.hasData && MC.hasData && M.tot >= MC.tot) add('warn', 7, 'I tempi totali dello stato futuro non migliorano quelli attuali.');
      }
      if (!map.futureCheck.sponsor || !map.futureCheck.date) add('warn', 7, 'Stato futuro: chi è lo sponsor e qual è la data per sperimentare? Deve essere raggiungibile.');
      if (!map.plan.length) add('warn', 8, 'Nessuna riga nel piano: ogni cambiamento va scritto come What / Who / When / Outcome.');
    }
    map.plan.forEach((r, i) => { if (r.what && (!r.who || !r.when)) add('bad', 8, `Riga ${i + 1} del piano senza responsabile o data: non accadrà.`); });
    if (map.plan.length && !map.closure.remeasureDate) add('warn', 9, 'Quando si rimisura (nuova CSM a 1-3-6 mesi)?');
    return out;
  };

  // ---------- fasi della guida ----------
  V.PHASES = [
    { n: 0, t: 'Preparazione', s: 'scopo, team, ideale' }, { n: 1, t: 'Richiesta', s: 'fascia alta: tutte le vie' }, { n: 2, t: 'Process box', s: 'fascia centrale' },
    { n: 3, t: 'Delta', s: 'attese tra i box' }, { n: 4, t: 'Camminare e validare', s: 'osservazione diretta' }, { n: 5, t: 'Dati', s: 'Hi / Lo / Avg' },
    { n: 6, t: 'Analisi', s: 'che cosa non è ideale?' }, { n: 7, t: 'Stato futuro', s: 'raggiungibile, più vicino all\'ideale' }, { n: 8, t: 'Piano', s: 'What / Who / When / Outcome' }, { n: 9, t: 'Chiusura del ciclo', s: 'nuova CSM' }
  ];
  V.phaseDone = (map, n) => {
    const M = V.metrics(map); const f = V.futureOf(map);
    switch (n) {
      case 0: return !!(map.title && map.authors && map.scope && (map.kind !== 'current' || map.prep.drawer));
      case 1: return M.persons > 0 && M.requests > 0;
      case 2: return M.boxes >= 2 && map.elements.filter(e => e.type === 'box').every(b => b.props.title) && M.flows >= 1;
      case 3: return M.boxes >= 2 && M.deltas >= 1;
      case 4: return !!(map.validation.walked && map.validation.validatedBy);
      case 5: return M.hasData && M.incompleteBoxes === 0 && M.incompleteDeltas === 0;
      case 6: return M.storms > 0 && !!map.analysis.goodEnough;
      case 7: return !!(f && f !== map && f.elements.some(e => e.type === 'box') && f.futureCheck.sponsor && f.futureCheck.date) || (map.kind === 'future' && !!(map.futureCheck.sponsor && map.futureCheck.date));
      case 8: { const p = (f && f.plan.length ? f.plan : map.plan); return p.length > 0 && p.every(r => r.what && r.who && r.when && r.outcome); }
      case 9: return !!((f || map).closure.remeasureDate);
    }
    return false;
  };

  // ---------- esempio (visita ambulatoriale, numeri dalla Fig. 5.1 del libro) ----------
  V.example = () => {
    const m = V.newMap({ paper: clone(V.PAPER_A3), links: { mode: 'dritta' }, title: 'Visita ambulatoriale (esempio dal libro)', authors: 'AJ, CJ', unitName: 'Ambulatorio', scope: 'Dalla chiamata del paziente in sala d\'attesa alla programmazione del follow-up', ideal: 'Il paziente è visto all\'orario previsto, una sola raccolta dati, nessuna attesa tra i passi.', unit: 'minuti', samples: '30', requestor: 'Paziente con appuntamento' });
    m.prep = { observable: true, frequent: true, worthy: true, drawer: 'CJ', owner: 'Direttore ambulatori', physicians: true, stable: true, staffing: true };
    m.validation = { walked: true, walkedBy: 'CJ', walkedDate: today(), prepared: true, validatedBy: 'staff ambulatorio (2 RN, 1 MD, 1 segretaria)', validatedDate: today(), corrections: 'aggiunta la conferma telefonica come seconda via di richiesta' };
    m.data = { tool: true, boundariesAgreed: true, feedback: true, notes: 'i massimi del consulto medico coincidono con la fascia 11-12' };
    m.analysis = { goodEnough: 'No: circa il 60% del tempo del paziente è attesa; la variazione maggiore è prima del consulto medico (1-84 min).', questions: { q0: true, q1: true } };
    const E = m.elements;
    const b1 = V.newElement('box', 110, 300, { title: 'Check-in', activities: ['verifica nome, indirizzo, telefono, assicurazione', 'registrazione a sistema', 'stampa e posa della cartella', 'chiamata all\'infermiere'], hi: '8', lo: '3', avg: '5,5' });
    const b2 = V.newElement('box', 350, 300, { title: 'Consulto infermiere', activities: ['chiama il paziente', 'peso', 'allergie, dieta, farmaci, domande', 'pressione', 'polso', 'chiama il medico'], hi: '11', lo: '4', avg: '7,2' });
    const b3 = V.newElement('box', 590, 300, { title: 'Consulto medico', activities: ['visita (slot da 20 min)'], hi: '30', lo: '6', avg: '15,2' });
    const b4 = V.newElement('box', 830, 300, { title: 'Check-out', activities: ['appuntamento di follow-up', 'programmazione esami'], hi: '6', lo: '3', avg: '4,5' });
    E.push(b1, b2, b3, b4);
    const f1 = V.newConnector('flow', { el: b1.id }, { el: b2.id }), f2 = V.newConnector('flow', { el: b2.id }, { el: b3.id }), f3 = V.newConnector('flow', { el: b3.id }, { el: b4.id });
    E.push(f1, f2, f3);
    const d1 = V.newElement('delta', 290, 326, { note: 'paziente in sala d\'attesa', kind: 'sala d\'attesa', hi: '17', lo: '3', avg: '11,25' }); d1.props.attachedTo = f1.id;
    const d2 = V.newElement('delta', 530, 326, { note: 'attesa del medico in ambulatorio', hi: '84', lo: '1', avg: '32,2' }); d2.props.attachedTo = f2.id;
    const d3 = V.newElement('delta', 770, 326, { note: 'attesa allo sportello', hi: '10', lo: '3', avg: '7' }); d3.props.attachedTo = f3.id;
    E.push(d1, d2, d3);
    const p = V.newElement('person', 1080, 100, { label: 'Paziente con appuntamento', requestor: true, mood: 'triste' }); E.push(p);
    const r1 = V.newConnector('request', { el: p.id }, { el: b1.id }, { channel: 'di persona', to: 'accettazione', note: 'si presenta allo sportello' }); r1.props.offset = 0;
    const r2 = V.newConnector('request', { el: p.id }, { el: b1.id }, { channel: 'telefono', to: 'segreteria', note: 'a volte chiama per confermare' }); r2.props.offset = 1;
    E.push(r1, r2);
    E.push(V.newElement('storm', 640, 60, { text: 'conferme telefoniche non registrate', muda: 'confusione', rule: '2 richiesta semplice e diretta' }));
    E.push(V.newElement('storm', 150, 225, { text: 'stampa solo dalla postazione in area visite', muda: 'movimento/trasporto', rule: '3 flusso semplice e diretto' }));
    E.push(V.newElement('storm', 600, 225, { text: 'alle 11 tutti gli ambulatori pieni', muda: 'attesa', rule: '1 attività specificate' }));
    E.push(V.newElement('fluffy', 850, 225, { text: 'check-out rapido e costante: da replicare' }));
    E.push(V.newElement('text', 60, 560, { text: 'Come accade il lavoro adesso. È abbastanza buono?', size: 13 }));
    return m;
  };
})(window.VSM);
