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
  /** Intento di una via: che cosa fa la persona da cui la via parte. Il metodo conosce la richiesta
   *  (l'omino a destra che chiede), ma sul foglio finisce anche chi *si reca* di persona a un passo:
   *  sono due cose diverse e devono vedersi come due cose diverse, sempre allo stesso modo.
   *  Le due dimensioni restano indipendenti e dichiarate in legenda: il CANALE decide colore e tratto,
   *  l'INTENTO decide la punta della freccia — che è forma, non tinta, e si legge anche stampata in
   *  bianco e nero. Le vie disegnate prima che l'intento esistesse non hanno la proprietà: valgono
   *  «chiede», che è l'unica cosa che l'app sapesse disegnare fino a ieri. */
  V.INTENTS = [
    { id: 'chiede', name: 'chiede a…', hint: 'la richiesta del metodo: la persona chiede e il processo risponde' },
    { id: 'si reca', name: 'si reca a…', hint: 'la persona si presenta di persona a quel passo (paziente in accettazione, corriere allo sportello)' }
  ];
  // «chiede» tiene la punta piena di sempre: le mappe gia' disegnate non devono cambiare aspetto.
  // «si reca» prende la punta a V e un pallino alla partenza (il piede di chi si muove): due segni,
  // non uno, cosi' non si confonde con una richiesta nemmeno in fotocopia.
  V.INTENT_LOOK = {
    chiede: { head: 'piena', start: false },
    'si reca': { head: 'aperta', start: true }
  };
  V.intentOf = (el) => { const i = el && el.props && el.props.intent; return V.INTENTS.some(x => x.id === i) ? i : 'chiede'; };
  V.intentLook = (el) => V.INTENT_LOOK[V.intentOf(el)];
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
  /** La forma del problema si sceglie (richiesta di Gt, 2026-08-21): la nuvola temporalesca del libro
   *  resta il valore di partenza, ma su un foglio fitto un cerchio, un quadrato o un triangolo si
   *  distinguono meglio fra loro — e chi mappa usa la forma per dire «questi problemi sono la stessa
   *  famiglia». Il significato non cambia: è sempre un problema di processo. */
  V.STORM_SHAPES = ['nuvola', 'cerchio', 'quadrato', 'triangolo'];
  V.shapeOf = (el) => { const f = el && el.props && el.props.shape; return V.STORM_SHAPES.includes(f) ? f : 'nuvola'; };
  V.BAD_WORDS = /\b(a volte|alle volte|talvolta|dipende|forse|magari|può darsi|puo darsi|qualche volta|di solito|in genere|se capita|se serve|se possibile)\b/i;

  // ---------- tipi di elemento: default e spiegazioni (dal libro, parole nostre) ----------
  V.TYPES = {
    box: { name: 'Process box', w: 150, h: 170, props: { title: '', activities: [], hi: '', lo: '', avg: '', cc: '', owner: '', gateIn: '', gateOut: '', validated: false },
      why: 'Un rettangolo verticale per ogni passo maggiore dell\'erogazione, con il titolo in alto e, se serve, le attività in ordine. Chiediti: che attività "apre la porta" del box e quale "la chiude"? Nel CSM le attività necessarie ora contano come valore. Più di 4-5 box: la complessità è necessaria o servono due mappe?' },
    delta: { name: 'Delta (attesa)', w: 30, h: 26, props: { note: '', kind: 'attesa', hi: '', lo: '', avg: '' },
      why: 'Il triangolo rovesciato rosso segna il tempo in cui nulla avanza (richiesta nel vassoio, campione in coda, viaggio, paziente in sala d\'attesa): è spreco reso visibile. Il tempo si ottiene per differenza tra la fine del box precedente e l\'inizio del successivo, non si cronometra. Aggancialo a una freccia di flusso per entrare nella timeline.' },
    person: { name: 'Persona', w: 40, h: 78, props: { label: '', role: '', mood: 'neutro', requestor: true },
      why: 'L\'omino è chi sta nel processo: il richiedente (a destra, nella fascia alta), un paziente che si reca a un passo, un operatore. Scrivi chi è e che ruolo ha — l\'app non decide per te. L\'espressione (felice/neutro/triste) racconta l\'esperienza. Da qui partono le vie: «chiede a…» oppure «si reca a…».' },
    storm: { name: 'Nuvola temporalesca', w: 120, h: 50, props: { text: '', muda: '', rule: '', a3: false, collapsed: false, shape: 'nuvola' },
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
    request: { name: 'Via di richiesta', props: { channel: 'telefono', intent: 'chiede', to: '', hands: '', note: '' },
      why: 'Ogni via reale con cui una persona arriva al processo: disegnale tutte. L\'intento dice che cosa fa («chiede a…» oppure «si reca a…») e decide la punta della freccia; il canale (telefono, fax, e-mail, verbale, di persona, sistema…) decide colore e tratto. Molte frecce nella fascia alta = richiesta non standardizzata: è la prima leva di miglioramento.' }
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
  V.isConnector = (el) => !!el && V.CONNECTOR_TYPES.includes(el.type);

  // ---------- igiene di cio' che arriva da fuori (JSON aperto, patch del coach) ----------
  /** Un id non nasce solo da uid(): arriva anche dal JSON che si apre e dalle patch del coach, e finisce
   *  dritto dentro attributi SVG (data-id="…") e dentro i selettori con cui il disegno si ritrova
   *  (querySelector('[data-id="…"]')). Un id con virgolette o parentesi angolari romperebbe l'uno e
   *  l'altro. Qui si tiene un solo alfabeto, quello di uid(): chi non lo rispetta viene rinominato e i
   *  riferimenti interni (capi delle frecce, agganci, catene) seguono il nome nuovo. */
  const ID_RE = /^[A-Za-z0-9_-]{1,32}$/;
  V.idOk = (s) => typeof s === 'string' && ID_RE.test(s);
  const okWidth = (w, fallback) => { const n = num(w); return (n != null && n > 0 && n <= 12) ? n : fallback; };
  /** Le tinte del foglio sono dichiarate (canali + eccezioni ammesse) e la legenda deve poterle spiegare:
   *  un colore inventato da un file non entra nel disegno. */
  const okInk = (c) => V.INK_COLORS.some(x => x.id && x.id === c) || Object.values(V.CHANNEL_LOOK).some(l => l.color === c);
  /** rimette in riga id, riferimenti e tinte di una mappa che arriva da fuori */
  /** I campi di testo che arrivano da un file. Un JSON puo' portare un numero, un booleano o un
   *  oggetto dove l'app si aspetta una riga da leggere: il titolo finiva in slug() e «Salva JSON» ed
   *  «Esporta SVG» morivano con un TypeError, senza nemmeno un avviso (R1, debug del 2026-08-21).
   *  Si ripara all'ingresso, come gia' si fa per gli id duplicati e i capi fantasma.
   *  Regola stretta: si coercisce SOLO un valore presente e di tipo sbagliato. Una chiave assente
   *  resta assente — nel modello «assente» ha un significato suo (summary assente = ricalcola,
   *  tint assente = nessuna tinta scelta) e riempirla di stringa vuota cambierebbe comportamenti
   *  che oggi sono giusti. */
  const testo = (o, k) => { if (o && o[k] != null && typeof o[k] !== 'string') o[k] = String(o[k]); };
  /** le chiavi di props che sono testo in qualche tipo (V.TYPES). Fuori da qui restano fuori:
   *  size e offset sono numeri, or/validated/collapsed/a3 booleani, via/activities/times liste,
   *  link/lockTo/attachedTo riferimenti, tint/intent/shape/summary/override hanno gia' la loro guardia. */
  const PROPS_TESTO = ['title', 'label', 'text', 'note', 'to', 'hands', 'owner', 'role', 'what', 'qty',
    'days', 'meters', 'from', 'name', 'color', 'who', 'gateIn', 'gateOut', 'hi', 'lo', 'avg', 'cc',
    'priority', 'muda', 'rule', 'kind', 'mood', 'icon', 'channel', 'style'];
  V.sanitizeMap = (m) => {
    if (!m || typeof m !== 'object') return m;
    if (!Array.isArray(m.elements)) m.elements = [];
    if (!Array.isArray(m.strokes)) m.strokes = [];
    ['title', 'date', 'authors', 'unitName', 'verName', 'samples', 'scope', 'ideal', 'requestor'].forEach(k => testo(m, k));
    // l'unita' non e' testo libero: e' una delle quattro dichiarate. Fuori elenco si torna a quella
    // di partenza, come gia' fanno la modalita' dei collegamenti e la forma del problema.
    if (m.unit != null && !UNIT_SEC[m.unit]) m.unit = 'minuti';
    // Il piano è una lista di righe: `plan` arrivato come stringa faceva morire V.lint — che gira a
    // ogni apertura della Guida pratica e dentro il coach — e il pannello del Piano. Stessa cura
    // delle attività: una lista, sempre, e dentro solo righe vere.
    if (m.plan != null) m.plan = Array.isArray(m.plan) ? m.plan.filter(r => r && typeof r === 'object' && !Array.isArray(r)) : [];
    // Le schede del foglio (preparazione, validazione, dati, analisi, controllo del futuro, chiusura)
    // sono contenitori: da fuori può arrivarne una che è una stringa, e allora leggerla dà undefined
    // ma SCRIVERCI dentro lancia. Fuori tipo si torna a quella di casa, coi campi vuoti.
    ['prep', 'validation', 'data', 'analysis', 'futureCheck', 'closure'].forEach(k => {
      if (m[k] != null && (typeof m[k] !== 'object' || Array.isArray(m[k]))) m[k] = clone(V.newMap()[k]);
    });
    m.elements = m.elements.filter(el => el && typeof el === 'object' && V.TYPES[el.type]);
    const remap = new Map(), live = new Set();
    m.elements.forEach(el => {
      const old = el.id;
      let id = (V.idOk(old) && !live.has(old)) ? old : uid();
      while (live.has(id)) id = uid();
      live.add(id); if (id !== old) { if (typeof old === 'string') remap.set(old, id); el.id = id; }
    });
    const ref = (v) => remap.has(v) ? remap.get(v) : v;
    m.elements.forEach(el => {
      const p = el.props = (el.props && typeof el.props === 'object') ? el.props : {};
      if (V.isConnector(el)) {
        ['from', 'to'].forEach(k => {
          const end = (el[k] && typeof el[k] === 'object') ? el[k] : {};
          if (end.el != null) { const t = ref(end.el); if (live.has(t)) end.el = t; else { delete end.el; end.x = +end.x || 0; end.y = +end.y || 0; } }
          el[k] = end;
        });
      }
      PROPS_TESTO.forEach(k => testo(p, k));
      // le attivita' sono righe da leggere una sotto l'altra: una lista, sempre, e di testo
      if (p.activities != null) p.activities = Array.isArray(p.activities) ? p.activities.map(x => String(x ?? '')) : [];
      // un aggancio che punta nel vuoto lascia l'elemento dov'e' disegnato, invece di mandarlo all'origine
      ['attachedTo', 'lockTo'].forEach(k => { if (p[k] != null) { const t = ref(p[k]); if (live.has(t) && t !== el.id) p[k] = t; else delete p[k]; } });
      // Il link NON si giudica qui: sanitizeMap gira per mappa, prima che repairDoc rinomini gli id
      // delle mappe fuori alfabeto — e buttarlo adesso uccideva un collegamento buono verso una
      // mappa che di lì a un attimo sarebbe stata rinominata (verOf attraversava, props.link no).
      // Chi punta al nulla lo scioglie repairDoc, dopo la rinomina.
      if (p.link != null && typeof p.link !== 'string') delete p.link;
      // l'intento e' un segno dichiarato in legenda, non testo libero: fuori elenco si torna a «chiede»
      if (p.intent != null && !V.INTENTS.some(x => x.id === p.intent)) delete p.intent;
      // la tinta finisce dentro un attributo di stile del disegno: solo un numero la puo' scrivere,
      // normalizzato al giro 0-360. La descrizione finisce nel pop-up: solo testo, e mai vuoto
      // (vuota vorrebbe dire «ricalcola», che e' proprio il ripiego della chiave assente).
      if (p.tint != null) { const H = V.tintHue(p.tint); if (H == null) delete p.tint; else p.tint = H; }
      // la forma del problema è un segno dichiarato in legenda, non testo libero: fuori elenco si torna alla nuvola
      if (p.shape != null && !V.STORM_SHAPES.includes(p.shape)) delete p.shape;
      if (p.summary != null && (typeof p.summary !== 'string' || !p.summary.trim())) delete p.summary;
      // le misure del cronometro: numeri veri, in secondi, mai negativi — da un file di fuori puo'
      // arrivare qualunque cosa, e una media con dentro «due» non e' una media
      if (p.times != null) { const t = Array.isArray(p.times) ? p.times.filter(x => typeof x === 'number' && isFinite(x) && x >= 0) : []; if (t.length) p.times = t; else delete p.times; }
      if (p.override && typeof p.override === 'object') {
        const o = {};
        if (okInk(p.override.stroke)) o.stroke = p.override.stroke;
        if (V.INK_DASHES.some(d => d.id && d.id === p.override.dash)) o.dash = p.override.dash;
        const w = okWidth(p.override.width, null); if (w != null) o.width = w;
        if (Object.keys(o).length) p.override = o; else delete p.override;
      }
    });
    // Anelli di legami: due elementi legati l'uno all'altro si disegnerebbero a vicenda senza fine.
    // Il legame che chiude l'anello viene sciolto, l'elemento resta dov'e' disegnato.
    // Fra i «genitori» contano anche i CAPI di una freccia: una freccia sta dove la mettono gli
    // elementi che collega. Senza questo, legare un elemento alla freccia che ARRIVA su di lui
    // chiudeva un anello che la guardia non vedeva — e il disegno si contraddiceva: la freccia
    // finiva nel vuoto e l'elemento pendeva di lato appeso alla catenella (video di Gt, 2026-08-21).
    // L'attesa appesa a una freccia (attachedTo) non e' un anello: l'attesa non e' un capo.
    const trova = (id) => m.elements.find(x => x.id === id);
    const genitori = (el) => (V.isConnector(el)
      ? [el.from && el.from.el, el.to && el.to.el]
      : [el.props.lockTo || (el.type === 'delta' ? el.props.attachedTo : null)]).filter(Boolean);
    const dipendeDa = (id, el, visti) => {
      if (!el || visti.has(el.id)) return false;
      visti.add(el.id);
      return genitori(el).some(p => p === id || dipendeDa(id, trova(p), visti));
    };
    m.elements.forEach(el => {
      const p = el.props.lockTo || (el.type === 'delta' ? el.props.attachedTo : null);
      if (!p) return;
      if (dipendeDa(el.id, trova(p), new Set([el.id]))) { delete el.props.lockTo; if (el.type === 'delta') delete el.props.attachedTo; }
    });
    // Il giro del cronometro appeso a un passo (o a una freccia) che non c'e' piu' non e' un giro:
    // si scioglie qui, come i legami che puntano nel vuoto. Il foglio si riapre e la misura riparte.
    if (m.measure && typeof m.measure === 'object') {
      const c_e = (id) => !id || live.has(id);
      if (!c_e(m.measure.stepId) || !c_e(m.measure.connId) || !c_e(m.measure.fromId)) delete m.measure;
    } else if (m.measure != null) delete m.measure;
    const sLive = new Set();
    m.strokes = m.strokes.filter(s => s && typeof s === 'object' && Array.isArray(s.points)).map(s => {
      let id = (V.idOk(s.id) && !sLive.has(s.id)) ? s.id : uid();
      while (sLive.has(id)) id = uid();
      sLive.add(id); s.id = id;
      s.color = okInk(s.color) ? s.color : '#2b2b2b';
      s.width = okWidth(s.width, 1.8);
      s.points = s.points.filter(pt => Array.isArray(pt) && pt.length >= 2).map(pt => [+pt[0] || 0, +pt[1] || 0]);
      return s;
    });
    return m;
  };

  V.newElement = (type, x, y, props = {}) => {
    const T = V.TYPES[type];
    return { id: uid(), type, x, y, w: T.w, h: T.h, z: 0, props: Object.assign(clone(T.props), props) };
  };
  V.newConnector = (type, from, to, props = {}) => ({ id: uid(), type, from, to, props: Object.assign(clone(V.TYPES[type].props), props) });

  V.newMap = (o = {}) => Object.assign({
    id: uid(), title: '', date: today(), authors: '', unitName: '', kind: 'current', pairId: null, parentId: null, parentStepId: null, projectId: null,
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

  // ---------- progetti: ogni gruppo di mappe sta dentro il suo ----------
  /** Il progetto è il contenitore delle mappe che parlano dello stesso lavoro. Serve a una cosa sola,
   *  ma importante: gli elenchi (libreria, «collega a un'altra mappa», cartina) mostrano soltanto il
   *  progetto corrente. Senza, l'esempio del libro e i fogli di reparti diversi finivano in ogni menu
   *  e chi sceglieva si perdeva. Due progetti si parlano solo dopo essere stati collegati a mano. */
  V.newProject = (o = {}) => Object.assign({ id: uid(), name: 'Progetto', links: [], sample: false, created: Date.now() }, o);
  // sample: true marca il progetto degli esempi: da lì non si eredita mai il progetto attivo,
  // perché un foglio nuovo aperto mentre si guarda l'esempio del libro è lavoro vero

  /** Il progetto di lavoro di ripiego: «Progetto 1», riusato se c'è già, creato se manca.
   *  È l'unico rifugio delle mappe senza progetto (spec: «ogni mappa senza progetto valido finisce
   *  in "Progetto 1", creato se manca»): un progetto qualsiasi già esistente — «Esempi», nel caso
   *  tipico — fonderebbe le orfane con un lavoro che non c'entra, ed è successo davvero con i file
   *  importati. */
  const progettoDiRipiego = () => {
    if (!V.doc.projects || typeof V.doc.projects !== 'object') V.doc.projects = {};
    let p = Object.values(V.doc.projects).find(x => x.name === 'Progetto 1' && !x.sample);
    if (!p) { p = V.newProject({ name: 'Progetto 1' }); V.doc.projects[p.id] = p; }
    return p;
  };

  // ---------- documento ----------
  V.doc = { version: 2, activeMapId: null, activeProjectId: null, projects: {}, maps: {} };
  V.map = () => V.doc.maps[V.doc.activeMapId];
  /** il progetto attivo NON è uno stato a parte: è quello della mappa aperta, così non può disallinearsi */
  V.project = () => { const m = V.map(); return (m && V.doc.projects[m.projectId]) || V.doc.projects[V.doc.activeProjectId] || null; };
  V.mapsOfProject = (pid) => Object.values(V.doc.maps).filter(m => m.projectId === pid);
  V.addProject = (name) => { const p = V.newProject({ name: name || 'Progetto' }); V.doc.projects[p.id] = p; V.save(); return p; };
  V.renameProject = (id, nome) => { const p = V.doc.projects[id]; if (!p) return false; p.name = String(nome || '').trim() || p.name; V.save(); emit({ label: 'progetto', ops: [] }); return true; };
  /** Collega (o scollega) due progetti. Il collegamento vale nei DUE sensi: è una dichiarazione che i
   *  due lavori si toccano, non una freccia. Finché non c'è, un passo non può puntare a una mappa
   *  dell'altro — è la regola che tiene puliti gli elenchi. */
  V.linkProjects = (a, b, on) => {
    const pa = V.doc.projects[a], pb = V.doc.projects[b];
    if (!pa || !pb || a === b) return false;
    if (!Array.isArray(pa.links)) pa.links = []; if (!Array.isArray(pb.links)) pb.links = [];
    const metti = (x, y) => { if (!x.links.includes(y)) x.links.push(y); };
    const togli = (x, y) => { x.links = x.links.filter(i => i !== y); };
    if (on) { metti(pa, b); metti(pb, a); } else { togli(pa, b); togli(pb, a); }
    V.save(); emit({ label: 'collegamento fra progetti', ops: [] });
    return true;
  };
  /** Elimina un progetto vuoto. Con le mappe dentro non si elimina: sarebbe la perdita più grossa che
   *  l'app possa fare, e un tocco sbagliato non deve poterla causare. */
  V.deleteProject = (id) => {
    const p = V.doc.projects[id]; if (!p) return { ok: false, reason: 'assente' };
    if (V.mapsOfProject(id).length) return { ok: false, reason: 'non vuoto' };
    Object.values(V.doc.projects).forEach(q => { q.links = (q.links || []).filter(i => i !== id); });
    delete V.doc.projects[id];
    if (V.doc.activeProjectId === id) V.doc.activeProjectId = null;
    V.repairDoc(); V.save(); emit({ label: 'progetto eliminato', ops: [] });
    return { ok: true };
  };
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
      // undefined vuol dire «questa chiave non c'era»: il clone JSON la farebbe sparire dal before
      // e l'annulla non toglierebbe il valore (succedeva annullando il primo collegamento di un passo)
      case 'props': { const el = map.elements.find(e => e.id === op.id); if (el) Object.keys(op.after).forEach(k => { if (op.after[k] === undefined) delete el.props[k]; else el.props[k] = clone(op.after[k]); }); break; }
      // un campo di una mappa QUALUNQUE (per es. parentId di una mappa adottata): la voce di annulla
      // vive nella mappa attiva, ma l'operazione risolve da sé la mappa destinataria
      case 'mapfield': { const t = V.doc.maps[op.mapId]; if (t) t[op.key] = clone(op.after); break; }
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
      case 'mapfield': return { t: 'mapfield', mapId: op.mapId, key: op.key, after: op.before, before: op.after };
      case 'stroke_add': return { t: 'stroke_remove', s: op.s };
      case 'stroke_remove': return { t: 'stroke_add', s: op.s };
      case 'strokes_set': return { t: 'strokes_set', after: op.before, before: op.after };
      case 'meta': return { t: 'meta', after: op.before, before: op.after };
      case 'plan_set': return { t: 'plan_set', after: op.before, before: op.after };
    }
  }
  /** commit(ops, label): applica le operazioni al modello, registra l'inversa, salva, notifica.
   *  Ritorna true se le operazioni sono passate, false se il lucchetto le ha rifiutate: chi chiama non
   *  deve annunciare (ne' dare per scontato) una modifica prima di aver letto l'esito. */
  // Passo validato (✓, props.validated): il contenuto del passo non si tocca — titolo, attività,
  // tempi, C&C e chi/reparto sono «ciò che il passo dice». Restano liberi posizione, colore, legami
  // e collegamento a un foglio: quelli dicono DOVE sta il passo, non CHE COSA dice. Stessa idea del
  // lucchetto dell'Ideale (map.validated, qui sotto) ma sul singolo elemento, e nello stesso posto:
  // un solo punto di guardia per tutte le vie di modifica (gesti, pop-up, azioni rapide, coach).
  // La ✓ stessa non passa da qui: V.setStepValidated la tocca direttamente, come V.setValidated.
  const STEP_FREE = { props: ['tint', 'link', 'summary', 'pinned', 'validated', 'lockTo', 'lockT', 'dx', 'dy'], update: ['x', 'y'] };
  const toccaValidato = (map, op) => {
    if (op.t === 'remove') { const el = map.elements.find(e => e.id === op.el.id); return !!(el && el.props && el.props.validated); }
    if (op.t === 'props' || op.t === 'update') {
      const el = map.elements.find(e => e.id === op.id);
      if (!el || !el.props || !el.props.validated) return false;
      return Object.keys(op.after).some(k => !STEP_FREE[op.t].includes(k));
    }
    return false;
  };
  const toastValidato = () => { V.ui && V.ui.toast && V.ui.toast('Passo validato ✓: tocca la ✓ nel suo pannello per riaprirlo.'); };
  V.commit = (ops, label = '', opts = {}) => {
    const map = opts.map || V.map(); if (!map) return false;
    // Ideale validato = lucchetto chiuso: nessuna modifica passa. Un solo posto di guardia per tutte
    // le vie di modifica (gesti, pop-up, azioni rapide, coach). Il lucchetto stesso non passa da qui.
    if (map.validated) { V.ui && V.ui.toast && V.ui.toast('Ideale validato \u{1F512}: apri il lucchetto in alto per modificarlo.'); return false; }
    ops = Array.isArray(ops) ? ops : [ops];
    if (ops.some(op => toccaValidato(map, op))) { toastValidato(); return false; }
    // fill "before" for update/props ops
    ops.forEach(op => {
      if ((op.t === 'update' || op.t === 'props') && !op.before) { const el = map.elements.find(e => e.id === op.id); if (el) { op.before = {}; Object.keys(op.after).forEach(k => { op.before[k] = clone(op.t === 'props' ? el.props[k] : el[k]); }); } }
      if (op.t === 'meta' && !op.before) { op.before = {}; Object.keys(op.after).forEach(k => op.before[k] = clone(map[k])); }
      // before === undefined, non falsy: un parentId che era null va ricordato come null
      if (op.t === 'mapfield' && op.before === undefined) { const t = V.doc.maps[op.mapId]; op.before = t ? clone(t[op.key]) : undefined; }
      if (op.t === 'plan_set' && !op.before) op.before = clone(map.plan);
      if (op.t === 'strokes_set' && !op.before) op.before = clone(map.strokes);
    });
    ops.forEach(op => applyOp(op, map));
    map.updated = Date.now();
    if (!opts.silent) { undoStack.push({ mapId: map.id, ops: ops.map(op => invert(op)).reverse(), redo: ops, label }); if (undoStack.length > 200) undoStack.shift(); redoStack.length = 0; }
    V.save();
    emit({ ops, label, mapId: map.id });
    return true;
  };
  // anche annulla/ripeti rispettano il lucchetto: la voce resta in cima, si riprova dopo lo sblocco
  const lockedEntry = (e) => { const m = V.doc.maps[e.mapId]; if (m && m.validated) { V.ui && V.ui.toast && V.ui.toast('Ideale validato \u{1F512}: apri il lucchetto per annullare o ripetere lì.'); return true; } return false; };
  V.undo = () => { let e; while ((e = undoStack.pop())) { const map = V.doc.maps[e.mapId]; if (!map) continue; if (lockedEntry(e)) { undoStack.push(e); return false; } if (e.ops.some(op => toccaValidato(map, op))) { toastValidato(); undoStack.push(e); return false; } if (V.doc.activeMapId !== e.mapId) V.switchMap(e.mapId); e.ops.forEach(op => applyOp(op, map)); redoStack.push(e); V.save(); emit({ undo: true, label: e.label }); return true; } return false; };
  V.redo = () => { let e; while ((e = redoStack.pop())) { const map = V.doc.maps[e.mapId]; if (!map) continue; if (lockedEntry(e)) { redoStack.push(e); return false; } if (e.redo.some(op => toccaValidato(map, op))) { toastValidato(); redoStack.push(e); return false; } if (V.doc.activeMapId !== e.mapId) V.switchMap(e.mapId); e.redo.forEach(op => applyOp(op, map)); undoStack.push(e); V.save(); emit({ redo: true, label: e.label }); return true; } return false; };
  V.canUndo = () => undoStack.length > 0; V.canRedo = () => redoStack.length > 0;

  // ---------- mappe: crea, cambia, elimina ----------
  /** le nuvole si alzano quanto serve al loro testo (stesse costanti del disegno): senza, il testo sforava */
  const fitClouds = (m) => { const R2 = V.render; if (!m || !Array.isArray(m.elements) || !R2 || !R2.cloudFit) return m; m.elements.forEach(el => { if ((el.type === 'storm' || el.type === 'fluffy') && !el.props.collapsed && el.props.text) el.h = Math.max(el.h, R2.cloudFit(el.w, el.props.text, el.type === 'storm' ? V.shapeOf(el) : 'nuvola')); }); return m; };
  V.addMap = (map) => {
    if (!map.projectId) {
      // da un progetto di esempio non si eredita mai: un foglio nuovo aperto mentre si guarda
      // l'esempio del libro andrebbe mescolato agli esempi per sempre — va in «Progetto 1»
      const attivo = V.doc.projects && V.doc.projects[V.doc.activeProjectId];
      map.projectId = (attivo && !attivo.sample) ? attivo.id : progettoDiRipiego().id;
    }
    V.doc.maps[map.id] = fitClouds(map); return map;
  };
  V.switchMap = (id) => { if (!V.doc.maps[id]) return; V.doc.activeMapId = id; V.doc.activeProjectId = V.doc.maps[id].projectId || V.doc.activeProjectId; V.save(); emit({ switched: true }); };
  /** Elimina una mappa e ritorna l'esito: { ok, reason }. Chi chiama non deve annunciare l'eliminazione
   *  prima di averlo letto — a lucchetto chiuso, o quando andrebbe perso l'ultimo Attuale di un Ideale,
   *  qui non si elimina niente. Con { withPair: true } si eliminano Attuale e Ideale insieme. */
  V.deleteMap = (id, opts = {}) => {
    const m = V.doc.maps[id]; if (!m) return { ok: false, reason: 'assente' };
    if (m.validated) { V.ui && V.ui.toast && V.ui.toast('Ideale validato \u{1F512}: apri il lucchetto prima di eliminarlo.'); return { ok: false, reason: 'validata' }; }
    const chain = V.versionsOf(m);
    const rest = chain.filter(x => x.id !== id);
    const ideal = m.kind === 'current' ? V.idealOf(m) : null;
    // eliminare l'ultimo giro dell'Attuale lascerebbe l'Ideale senza nessun Attuale a cui tornare:
    // o si eliminano insieme (con una conferma che li nomina entrambi) o non si elimina niente
    if (ideal && !rest.length && !opts.withPair) return { ok: false, reason: 'pair', idealId: ideal.id, idealTitle: ideal.title || '' };
    if (ideal && ideal.validated && opts.withPair) { V.ui && V.ui.toast && V.ui.toast('Ideale validato \u{1F512}: apri il lucchetto prima di eliminarlo.'); return { ok: false, reason: 'validata' }; }
    // un giro eliminato non deve rompere la catena (i giri successivi si riattaccano al precedente)
    // ne' orfanare l'Ideale (il pairId passa a un altro giro della catena). L'erede si sceglie ORA,
    // finche' la catena e' ancora intera: staccando prima i giri successivi, la catena non li
    // conterrebbe piu' e l'Ideale resterebbe appeso al vuoto (succedeva eliminando il primo giro).
    const heir = rest.length ? rest[rest.length - 1] : null;
    const heirs = Object.values(V.doc.maps).filter(o => o.verOf === id);
    heirs.forEach(o => { o.verOf = (m.verOf && V.doc.maps[m.verOf]) ? m.verOf : null; });
    if (ideal && heir) { heir.pairId = ideal.id; ideal.pairId = heir.id; }
    delete V.doc.maps[id];
    if (opts.withPair && ideal) delete V.doc.maps[ideal.id];
    Object.values(V.doc.maps).forEach(o => { if (!V.doc.maps[o.pairId]) o.pairId = null; if (!V.doc.maps[o.parentId]) o.parentId = null; if (!V.doc.maps[o.verOf]) o.verOf = null; });
    if (!V.doc.maps[V.doc.activeMapId]) {
      // si atterra su un foglio su cui si puo' lavorare: mai su un Ideale col lucchetto chiuso
      const cands = [m.verOf, heir && heir.id, heirs[0] && heirs[0].id].concat(Object.keys(V.doc.maps)).filter(x => x && V.doc.maps[x]);
      const next = cands.find(x => !V.doc.maps[x].validated) || cands[0];
      V.doc.activeMapId = next || V.addMap(V.newMap({ title: '' })).id;
    }
    V.repairDoc();
    V.save(); emit({ switched: true });
    return { ok: true, activeMapId: V.doc.activeMapId };
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
    // pairId e updated NON si copiano: il legame con l'Ideale appartiene alla catena (lo rimette a posto
    // repairDoc sull'ultimo giro), e una data ereditata dal padre faceva comparire il giro nuovo in fondo
    // all'elenco delle mappe, con la data di quello vecchio
    const f = V.newMap(Object.assign(clone(cur), { id: uid(), kind: 'current', verOf: cur.id, verName: names[n] || (n + 'º giro'), validated: false, pairId: null, tint: Math.floor(Math.random() * 360), created: Date.now(), updated: Date.now() }));
    f.elements = clone(cur.elements); f.strokes = clone(cur.strokes); f.plan = clone(cur.plan);
    V.addMap(f); V.repairDoc(); V.save(); return f;
  };
  V.createFuture = (cur) => {
    const have = V.idealOf(cur); if (have) return have;
    const f = V.newMap(Object.assign(clone(cur), { id: uid(), kind: 'future', pairId: cur.id, verOf: null, verName: 'ideale', validated: false, tint: Math.floor(Math.random() * 360), title: cur.title, validation: V.newMap().validation, created: Date.now() }));
    f.elements = clone(cur.elements); f.strokes = []; f.plan = clone(cur.plan);
    V.addMap(f); cur.pairId = f.id; V.save(); return f;
  };
  /** lucchetto dell'Ideale: non passa da commit (che a lucchetto chiuso rifiuta tutto) */
  V.setValidated = (map, on) => { map.validated = !!on; map.updated = Date.now(); V.save(); emit({ label: on ? 'validata' : 's-validata', mapId: map.id, ops: [] }); };
  /** la ✓ di un passo: come il lucchetto dell'Ideale non passa da commit — che su un passo validato
   *  rifiuterebbe perfino la modifica che lo riapre. Nessuna voce di annulla: la conferma chiesta
   *  dal pannello è la sua protezione, non ↩. */
  V.setStepValidated = (id, on, map = V.map()) => {
    const el = map && V.byId(id, map); if (!el) return false;
    el.props.validated = !!on; map.updated = Date.now(); V.save();
    emit({ label: on ? 'passo validato' : 'passo riaperto', mapId: map.id, ops: [] });
    return true;
  };
  /** etichetta leggibile del tipo di mappa (per testata, elenchi e sfondo del foglio) */
  V.kindLabel = (m) => m.kind === 'future' ? 'ideale' : m.kind === 'detail' ? 'dettaglio' : (m.verName || 'attuale');
  /** Nuovo sotto-foglio. Non basta sapere da quale MAPPA nasce: serve da quale PASSO, perché è il passo
   *  a dargli l'indirizzo (il sotto-foglio del passo 2 è il 2.1, 2.2, …). Senza, la cartina saprebbe
   *  dire «sta sotto questa mappa» ma non «sta sotto questo passo», che è quello che chi mappa cerca. */
  /** Il sotto-foglio nasce con il COLORE del suo passo: il pannello del colore promette «il
   *  sotto-foglio ↗ ripete questo colore come sfondo», e finora la promessa valeva solo se il
   *  colore si sceglieva DOPO aver collegato (V.setTint lo propaga); creando il foglio da un passo
   *  gia' colorato usciva invece la tinta a caso di ogni mappa nuova. Un passo senza colore la
   *  tinta a caso se la tiene: serve a capire a colpo d'occhio su quale foglio si sta lavorando. */
  V.createDetail = (parent, title, stepId) => { const passo = stepId ? V.byId(stepId, parent) : null; const H = passo && passo.props ? V.tintHue(passo.props.tint) : null; const d = V.newMap(Object.assign({ kind: 'detail', parentId: parent.id, parentStepId: stepId || null, projectId: parent.projectId, title: title || ('Dettaglio di ' + (parent.title || 'mappa')), unit: parent.unit, authors: parent.authors }, H == null ? {} : { tint: H })); V.addMap(d); V.save(); return d; };
  /** Appende un foglio esistente a un passo di un altro foglio: è il «processo 0» — l'intera mappa di
   *  oggi diventa un passo di qualcosa di più grande. Ritorna l'esito invece di annunciare da sé: chi
   *  chiama non deve dire «fatto» prima di aver letto. Si rifiuta quando creerebbe un anello (una
   *  mappa sotto sé stessa non ha un «sopra») o quando attraverserebbe due progetti.
   *  La risalita segna i fogli visti invece di contare i giri: un contatore che si ferma a N direbbe
   *  «va bene» su una catena più lunga di N, ed è lo stesso errore dell'indirizzo che si fermava a 8. */
  V.attachUnder = (map, parentMap, stepId) => {
    if (!map || !parentMap) return { ok: false, reason: 'assente' };
    if (map.id === parentMap.id) return { ok: false, reason: 'sé stessa' };
    if (map.projectId !== parentMap.projectId) return { ok: false, reason: 'altro progetto' };
    const visti = new Set();
    for (let p = parentMap; p && !visti.has(p.id); p = p.parentId ? V.doc.maps[p.parentId] : null) {
      if (p.id === map.id) return { ok: false, reason: 'anello' };
      visti.add(p.id);
    }
    const step = parentMap.elements.find(e => e.id === stepId && e.type === 'box');
    if (!step) return { ok: false, reason: 'passo assente' };
    map.parentId = parentMap.id; map.parentStepId = step.id;
    step.props.link = map.id;
    map.updated = Date.now(); parentMap.updated = Date.now();
    V.repairDoc(); V.save(); emit({ label: 'appesa', mapId: map.id, ops: [] });
    return { ok: true };
  };
  /** Il ponte macro→micro: le attività elencate nel passo sono già la scaletta del suo sotto-foglio.
   *  Crea il foglio (come createDetail) e dentro un passo per ogni attività scelta, in fila e già
   *  collegati da frecce di flusso nell'ordine dell'elenco. Regole (spec 2026-08-21): i tempi del
   *  padre NON si spalmano sui figli — sono misure del padre, e inventare una divisione sarebbe un
   *  dato falso, quindi i figli nascono senza tempi; le attività RESTANO nel padre, perché sono la
   *  sua descrizione, non si spostano. `indici` vuoto = nessuna spunta = foglio vuoto, come crearlo
   *  a mano; `indici` omesso = tutte (uso da modello, senza pop-up). Gli indici contano sull'elenco
   *  già pulito (righe vuote tolte): lo stesso elenco che il pop-up mostra. I passi nascono mutati
   *  direttamente nella mappa nuova, senza commit: il foglio non esisteva un attimo fa, non c'è
   *  niente da annullare — la voce di annulla è quella del link, come per createDetail. */
  V.buildDetailFromActivities = (box, parent, { nome, indici } = {}) => {
    const d = V.createDetail(parent, nome, box && box.id);
    const acts = (((box && box.props.activities) || []).map(a => String(a).trim()).filter(Boolean));
    const scelti = (indici == null ? acts.map((_, i) => i) : indici).filter(i => acts[i] != null).sort((a, b) => a - b);
    const T = V.TYPES.box, gapX = 110; // fra un passo e il prossimo resta lo spazio per l'attesa (▼) che chi mappa aggiungerà
    let prec = null;
    scelti.forEach((ai, i) => {
      const b = V.newElement('box', 140 + i * (T.w + gapX), 300, { title: acts[ai] });
      d.elements.push(b);
      if (prec) d.elements.push(V.newConnector('flow', { el: prec.id }, { el: b.id }));
      prec = b;
    });
    if (scelti.length) V.save(); // createDetail ha già salvato il foglio: risalva solo se c'è contenuto
    return d;
  };
  /** Collega un passo a una mappa esistente. Se la mappa non ha ancora un posto nell'albero e sta
   *  nello STESSO progetto, questo passo ne diventa il posto (adozione) — e l'adozione entra nella
   *  STESSA voce di annulla del link: prima avveniva fuori dal commit, e un annulla riportava
   *  indietro il link ma lasciava la mappa appesa, facendo mentire il badge (difetto 1 del 2026-08-21). */
  V.linkMap = (boxId, targetId, map = V.map()) => {
    const t = V.doc.maps[targetId];
    const ops = [{ t: 'props', id: boxId, after: { link: targetId } }];
    if (t && !t.parentId && map && t.projectId === map.projectId && t.id !== map.id) {
      ops.push({ t: 'mapfield', mapId: t.id, key: 'parentId', after: map.id });
      ops.push({ t: 'mapfield', mapId: t.id, key: 'parentStepId', after: boxId });
    }
    return V.commit(ops, 'collega mappa');
  };

  // ---------- storage: IndexedDB con fallback localStorage ----------
  V.VERSION = (typeof self !== 'undefined' && self.VSM_VERSION) || '0.9';
  V.BUILD = (typeof self !== 'undefined' && self.VSM_BUILD_LABEL) || 'in sviluppo';
  /** come si legge la versione: numero dell'app e quando è stata pubblicata questa copia */
  V.versionLabel = () => V.VERSION + ' · ' + V.BUILD;
  /** IndexedDB e localStorage appartengono all'ORIGINE, non alla cartella: l'app pubblicata e la beta
   *  scrivevano sullo stesso identico documento, ognuna con il proprio codice. Ogni installazione ha
   *  ora il suo spazio, deciso dal canale dichiarato in version.js (non dal percorso, che su GitHub
   *  Pages porta dentro anche il nome del repo). La prima volta il documento che c'era viene copiato,
   *  così la beta parte da dove si era rimasti invece che da un foglio vuoto. */
  const CHANNEL = (typeof self !== 'undefined' && self.VSM_CHANNEL) || 'sviluppo';
  const SUFFIX = CHANNEL === 'stabile' ? '' : CHANNEL;
  const DB = 'vsm-coach' + (SUFFIX ? '-' + SUFFIX : ''), STORE = 'kv';
  const LS_DOC = 'vsm.doc' + (SUFFIX ? '.' + SUFFIX : '');
  /** «questo spazio e' stato svuotato apposta»: sopravvive all'azzeramento, e impedisce che la
   *  prima apertura successiva ricopi il documento dallo spazio di origine (v. V.load) */
  const SEGNO_AZZERATO = 'vsm.azzerato' + (SUFFIX ? '.' + SUFFIX : '');
  const giaAzzerato = () => { try { return localStorage.getItem(SEGNO_AZZERATO) === '1'; } catch (e) { return false; } };
  /** dove questa installazione tiene le mappe: serve alla schermata di diagnosi e alle prove */
  V.storage = () => ({ canale: CHANNEL, db: DB, chiave: LS_DOC });
  let idb = null;
  function openIdb() { return new Promise((res) => { if (!('indexedDB' in window)) return res(null); const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => res(r.result); r.onerror = () => res(null); }); }
  function idbGet(k) { return new Promise((res) => { if (!idb) return res(undefined); const tx = idb.transaction(STORE, 'readonly'); const rq = tx.objectStore(STORE).get(k); rq.onsuccess = () => res(rq.result); rq.onerror = () => res(undefined); }); }
  // onabort oltre a onerror: una transazione interrotta (quota esaurita, scheda chiusa a meta') non
  // emette onerror, e senza questo la promessa restava appesa per sempre — il salvataggio spariva in
  // silenzio, senza nemmeno ripiegare su localStorage
  function idbSet(k, v) { return new Promise((res) => { if (!idb) return res(false); try { const tx = idb.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(v, k); tx.oncomplete = () => res(true); tx.onerror = () => res(false); tx.onabort = () => res(false); } catch (e) { res(false); } }); }
  /** Salvataggio differito. Due tempi, non uno: si aspetta un attimo che il gesto finisca (400 ms), ma
   *  non oltre 1,2 s dalla prima modifica non ancora scritta — con il solo rinvio, chi scriveva o
   *  trascinava senza pause non vedeva mai partire una scrittura, e un riavvio in quel momento
   *  riportava il foglio all'ultima pausa. Le scritture sono in fila indiana: non si sorpassano. */
  let saveTimer = null, dirtyAt = 0, chain = Promise.resolve();
  const writeNow = () => {
    const s = JSON.stringify(V.doc);
    chain = chain.then(async () => {
      const ok = await idbSet('doc', s); let ls = false;
      try { if (!ok) { localStorage.setItem(LS_DOC, s); ls = true; } else localStorage.removeItem(LS_DOC); localStorage.setItem(LS_DOC + '.meta', JSON.stringify({ at: Date.now(), active: V.doc.activeMapId, v: V.VERSION })); } catch (e) { /* quota */ }
      if (!ok && !ls) V.ui && V.ui.toast && V.ui.toast('Non riesco a salvare su questo dispositivo: esporta il JSON dal menu ⋯ prima di chiudere.');
    });
    return chain;
  };
  /** Azzera lo spazio di QUESTA installazione: via le mappe, via il salvataggio in sospeso, via le
   *  cache del service worker della sua famiglia. Serve a rimettere la copia di prova come appena
   *  installata, per provare qualcosa senza i fogli di ieri fra i piedi. Sull'app STABILE non si
   *  chiama mai: la voce di menu non c'e' proprio (V.storage().canale). Chi chiama ricarica la
   *  pagina subito dopo: da qui in poi il documento in memoria non vale piu' niente, e infatti il
   *  salvataggio resta zittito per sempre — senza, il timer in sospeso riscriveva tutto un attimo
   *  dopo aver cancellato. */
  let azzerato = false;
  V.azzeraSpazio = async () => {
    azzerato = true;
    try { localStorage.setItem(SEGNO_AZZERATO, '1'); } catch (e) { /* storage bloccato */ }
    clearTimeout(saveTimer); saveTimer = null; dirtyAt = 0;
    // Via TUTTO quello che l'app potrebbe rileggere al prossimo avvio, non solo il documento: senza
    // togliere anche il vecchio formato v1, la prima apertura dopo l'azzeramento lo migrava di nuovo
    // e il foglio «azzerato» ricompariva con le mappe di un anno fa (visto eseguendo).
    try { [LS_DOC, LS_DOC + '.meta', 'vsm.state', 'vsm.state.v1backup'].forEach(k => localStorage.removeItem(k)); } catch (e) { /* storage bloccato */ }
    if (idb) { try { idb.close(); } catch (e) { /* gia' chiuso */ } idb = null; }
    await new Promise((res) => {
      if (!('indexedDB' in window)) return res();
      const r = indexedDB.deleteDatabase(DB);
      r.onsuccess = r.onerror = r.onblocked = () => res();
      setTimeout(res, 1500); // se un'altra scheda tiene il database aperto non si resta appesi
    });
    if (typeof caches !== 'undefined') {
      try { const ks = await caches.keys(); await Promise.all(ks.filter(k => k.startsWith('vsm-coach')).map(k => caches.delete(k))); } catch (e) { /* niente cache */ }
    }
    return true;
  };
  V.save = () => {
    if (azzerato) return;
    if (!dirtyAt) dirtyAt = Date.now();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { dirtyAt = 0; writeNow(); }, Math.max(0, Math.min(400, dirtyAt + 1200 - Date.now())));
  };
  /** scrive subito e restituisce la promessa: prima di un ricaricamento, quando l'app va in sottofondo,
   *  e dopo ogni operazione che l'utente considera conclusa (eliminazioni, cambio foglio) */
  V.saveNow = () => { if (azzerato) return Promise.resolve(); clearTimeout(saveTimer); dirtyAt = 0; return writeNow(); };
  V.saveIdle = () => chain;
  /** quando il documento e' stato scritto l'ultima volta (per la schermata di diagnosi) */
  V.lastSaved = () => { try { return JSON.parse(localStorage.getItem(LS_DOC + '.meta') || '{}').at || null; } catch (e) { return null; } };
  /** copia una tantum del documento dallo spazio dell'app principale (serve alla beta la prima volta:
   *  senza, aprirla avrebbe mostrato una libreria vuota). L'originale non viene toccato. */
  async function travasoDaOrigine() {
    try {
      const vecchio = await new Promise((res) => {
        if (!('indexedDB' in window)) return res(null);
        const r = indexedDB.open('vsm-coach', 1);
        r.onupgradeneeded = () => { try { r.transaction.abort(); } catch (e) { } res(null); }; // non esisteva: niente da copiare
        r.onsuccess = () => res(r.result); r.onerror = () => res(null);
      });
      if (!vecchio) { try { return localStorage.getItem('vsm.doc'); } catch (e) { return null; } }
      const s = await new Promise((res) => { try { const tx = vecchio.transaction(STORE, 'readonly'); const rq = tx.objectStore(STORE).get('doc'); rq.onsuccess = () => res(rq.result); rq.onerror = () => res(null); } catch (e) { res(null); } });
      try { vecchio.close(); } catch (e) { }
      return s || null;
    } catch (e) { return null; }
  }
  V.load = async () => {
    idb = await openIdb();
    let s = await idbGet('doc'); if (!s) { try { s = localStorage.getItem(LS_DOC); } catch (e) { } }
    // prima apertura di un'installazione con spazio proprio (la beta): si riparte dal documento che
    // c'era, invece di trovarsi davanti un foglio vuoto
    // Il travaso vale per la PRIMA apertura di un canale, non dopo un azzeramento chiesto a mano:
    // senza questo controllo, «Azzera la copia di prova» cancellava tutto e alla riapertura l'app
    // ricopiava allegramente il documento dallo spazio di origine — il foglio azzerato ricompariva
    // con le mappe di prima (visto eseguendo).
    if (!s && SUFFIX && !giaAzzerato()) { s = await travasoDaOrigine(); }
    if (s) {
      try {
        const d = JSON.parse(s);
        if (d && d.version === 2 && d.maps) {
          V.doc = d;
          const oldDoc = !d.cleaned; // le legende sul foglio si tolgono una volta sola, non a ogni avvio
          Object.values(V.doc.maps).forEach(m => { if (oldDoc) stripLegend(m); keepLook(m); Object.assign(m, Object.assign(V.newMap(), m)); });
          V.doc.cleaned = 2;
        }
      } catch (e) { console.warn('doc non leggibile', e); }
    }
    if (!Object.keys(V.doc.maps).length) {
      const v1 = migrateV1(); if (v1) { v1.forEach(m => V.addMap(m)); V.doc.activeMapId = v1[0].id; }
      else { const m = V.addMap(V.newMap({ title: '' })); V.doc.activeMapId = m.id; }
    }
    V.repairDoc();
    // quello che l'apertura ha normalizzato (tinte assegnate, id rimessi in riga, legami ricuciti) va
    // riscritto subito: altrimenti resta valido solo finche' la scheda e' aperta e alla riapertura
    // successiva cambia di nuovo — era il caso dello sfondo che si ricolorava a ogni avvio
    if (JSON.stringify(V.doc) !== s) V.saveNow();
    return V.doc;
  };
  /** una mappa salvata prima che il foglio diventasse grande resta della sua misura: spostarle gli elementi sarebbe peggio */
  /** aspetto ereditato: una mappa salvata prima che esistessero il foglio grande e le modalità dei
      collegamenti riprende il foglio A3. Il tratto invece viene normalizzato a "dritta", come ogni mappa
      nuova: è la lettura scelta per l'app, e la modalità resta cambiabile per singola mappa dal menu ⋯.
      (Le mappe che hanno già una modalità salvata non vengono toccate.) */
  /** la legenda sul foglio non e' piu' in tavolozza: le mappe disegnate quando c'era vengono ripulite
   *  una volta sola (con un segno sul documento), non a ogni apertura — altrimenti una legenda rimessa
   *  in seguito sparirebbe in silenzio al riavvio successivo */
  const stripLegend = (m) => { if (m && Array.isArray(m.elements)) m.elements = m.elements.filter(e => e.type !== 'legend'); };
  const keepLook = (m) => { if (m && !m.paper) m.paper = clone(V.PAPER_A3); if (m && !m.links) m.links = { mode: 'dritta' }; V.sanitizeMap(m); return fitClouds(m); };
  /** Gli invarianti della libreria, ricontrollati dopo ogni operazione che tocca la struttura delle mappe
   *  (apertura, import, eliminazione di un giro). Riparare e' meglio che lasciare un documento che l'app
   *  non sa piu' navigare: un Ideale che non ritrova il suo Attuale, un giro appeso a una mappa sparita,
   *  due Ideali sulla stessa catena. Ritorna l'elenco di cio' che ha corretto, cosi' i test lo leggono. */
  V.repairDoc = () => {
    const maps = V.doc.maps, fixes = [];
    // Ogni mappa sta in un progetto. Una mappa senza progetto valido — un documento salvato prima
    // che i progetti esistessero, un file importato da fuori — finisce in «Progetto 1», riusato se
    // c'è già e creato se manca (così le orfane restano TUTTE INSIEME, come stavano). Mai in un
    // progetto qualsiasi già esistente: quello fonderebbe le orfane con un lavoro che non c'entra.
    if (!V.doc.projects || typeof V.doc.projects !== 'object') V.doc.projects = {};
    Object.keys(V.doc.projects).forEach(k => { const p = V.doc.projects[k]; if (!p || typeof p !== 'object') { delete V.doc.projects[k]; return; } if (p.id !== k) p.id = k; if (!Array.isArray(p.links)) p.links = []; });
    // anche gli id dei progetti finiscono dentro attributi del DOM senza virgolettatura (le
    // briciole già scrivono data-open="..." così, gli elenchi e la cartina faranno lo stesso):
    // stessa regola degli id delle mappe qui sotto. Un id fuori alfabeto va rinominato, non
    // buttato — dentro il progetto ci sono mappe vere — e tutti i riferimenti lo seguono:
    // le mappe che ci abitano, i collegamenti fra progetti, il progetto attivo.
    const projRename = new Map();
    Object.keys(V.doc.projects).forEach(k => { if (!V.idOk(k)) projRename.set(k, uid()); });
    if (projRename.size) {
      projRename.forEach((nuovo, vecchio) => { const p = V.doc.projects[vecchio]; delete V.doc.projects[vecchio]; p.id = nuovo; V.doc.projects[nuovo] = p; });
      const rp = (v) => (v && projRename.has(v)) ? projRename.get(v) : v;
      Object.values(maps).forEach(m => { if (m && typeof m === 'object') m.projectId = rp(m.projectId); });
      Object.values(V.doc.projects).forEach(p => { p.links = p.links.map(rp); });
      V.doc.activeProjectId = rp(V.doc.activeProjectId);
      fixes.push('id di progetto fuori alfabeto');
    }
    const senzaProgetto = Object.values(maps).filter(m => !m.projectId || !V.doc.projects[m.projectId]);
    if (senzaProgetto.length) {
      const rifugio = progettoDiRipiego();
      senzaProgetto.forEach(m => { m.projectId = rifugio.id; });
      fixes.push('mappe adottate dal progetto ' + rifugio.name);
    }
    // un collegamento fra progetti vale nei due sensi e mai verso sé stessi
    Object.values(V.doc.projects).forEach(p => {
      p.links = Array.from(new Set(p.links)).filter(id => id !== p.id && V.doc.projects[id]);
      p.links.forEach(id => { const q = V.doc.projects[id]; if (!q.links.includes(p.id)) q.links.push(p.id); });
    });
    // anche gli id delle mappe finiscono dentro attributi (l'elenco, le briciole, il badge verso un
    // sotto-foglio): stessa regola degli elementi, e chi non la rispetta viene rinominato con i suoi
    // riferimenti al seguito
    const rename = new Map();
    Object.keys(maps).forEach(k => { const m = maps[k]; if (!m || typeof m !== 'object') { delete maps[k]; return; } if (m.id !== k) m.id = k; if (!V.idOk(k)) rename.set(k, uid()); });
    if (rename.size) {
      rename.forEach((nuovo, vecchio) => { const m = maps[vecchio]; delete maps[vecchio]; m.id = nuovo; maps[nuovo] = m; });
      const rf = (v) => (v && rename.has(v)) ? rename.get(v) : v;
      Object.values(maps).forEach(m => { m.pairId = rf(m.pairId); m.parentId = rf(m.parentId); m.verOf = rf(m.verOf); (m.elements || []).forEach(el => { if (el.props && el.props.link) el.props.link = rf(el.props.link); }); });
      V.doc.activeMapId = rf(V.doc.activeMapId);
      fixes.push('id di mappa fuori alfabeto');
    }
    const all = Object.values(maps);
    all.forEach(m => {
      if (m.verOf && (m.verOf === m.id || !maps[m.verOf] || maps[m.verOf].kind !== 'current')) { m.verOf = null; fixes.push('verOf ' + m.id); }
      // la gerarchia non attraversa i progetti: fra progetti diversi ci sono i collegamenti, non i padri
      if (m.parentId && (m.parentId === m.id || !maps[m.parentId] || maps[m.parentId].projectId !== m.projectId)) { m.parentId = null; m.parentStepId = null; fixes.push('parentId ' + m.id); }
      // il passo che conteneva la mappa può essere stato eliminato: la mappa resta figlia (eredita
      // l'indirizzo della madre) invece di staccarsi e sparire dall'albero
      if (m.parentStepId) { const par = maps[m.parentId]; const vivo = par && par.elements.some(e => e.id === m.parentStepId && e.type === 'box'); if (!vivo) { m.parentStepId = null; fixes.push('parentStepId ' + m.id); } }
      if (m.pairId && !maps[m.pairId]) { m.pairId = null; fixes.push('pairId assente ' + m.id); }
    });
    // Un ⇉ che punta a una mappa eliminata: il badge spariva gia' da solo a schermo (le guardie
    // ci sono), ma l'id morto restava nel documento per sempre — anche dopo il reload — e finiva
    // nel JSON esportato, dove un re-import con lo stesso id avrebbe «riacceso» un collegamento
    // che nessuno ha piu' chiesto. Stessa stanghetta di pairId/parentId/verOf, qui invece che in
    // deleteMap perche' repairDoc copre anche l'apertura di un file e l'import (R3, 2026-08-21).
    // Sta DOPO la rinomina degli id: un link appena rinominato non e' un link morto.
    all.forEach(m => (m.elements || []).forEach(el => {
      if (el.props && el.props.link && !maps[el.props.link]) { delete el.props.link; fixes.push('collegamento morto in ' + m.id); }
    }));
    // catene: nessun anello, altrimenti versionsOf girerebbe a vuoto
    all.forEach(m => { const seen = new Set([m.id]); let p = m.verOf; while (p && maps[p]) { if (seen.has(p)) { m.verOf = null; fixes.push('anello di giri ' + m.id); break; } seen.add(p); p = maps[p].verOf; } });
    // anelli di padri: una mappa figlia di sé stessa, anche per vie traverse, farebbe girare a vuoto
    // le briciole e la cartina
    all.forEach(m => { const visti = new Set([m.id]); let p = m.parentId; while (p && maps[p]) { if (visti.has(p)) { m.parentId = null; m.parentStepId = null; fixes.push('anello di padri ' + m.id); break; } visti.add(p); p = maps[p].parentId; } });
    // un solo Ideale per catena, e il legame vale nei due sensi: dall'Attuale si apre l'Ideale e viceversa
    const roots = all.filter(m => m.kind === 'current' && !m.verOf);
    const claimed = new Set();
    roots.forEach(r => {
      const chain = V.versionsOf(r);
      // se per un pasticcio la catena rivendica due Ideali, resta quello nato per primo: e' l'Ideale
      // della catena, quello su cui si e' lavorato. L'altro viene staccato, non eliminato: resta in
      // libreria e si apre da «Le tue mappe».
      const futures = chain.map(c => c.pairId && maps[c.pairId]).filter(f => f && f.kind === 'future')
        .sort((a, b) => (a.created || 0) - (b.created || 0));
      const keep = futures[0] || null;
      chain.forEach(c => { if (c.pairId && c.pairId !== (keep && keep.id)) { c.pairId = null; fixes.push('secondo Ideale ' + c.id); } });
      if (keep) {
        claimed.add(keep.id);
        // il pair sta sull'ultimo giro: e' quello che si apre tornando dall'Ideale
        const last = chain[chain.length - 1];
        chain.forEach(c => { if (c !== last && c.pairId) c.pairId = null; });
        if (last.pairId !== keep.id) { last.pairId = keep.id; fixes.push('pair ricucito ' + last.id); }
        if (keep.pairId !== last.id) { keep.pairId = last.id; fixes.push('pair inverso ' + keep.id); }
      }
    });
    // un Ideale che nessuna catena rivendica non deve restare col lucchetto chiuso: sarebbe una mappa
    // che non si puo' ne' modificare ne' collegare a niente
    all.filter(m => m.kind === 'future' && !claimed.has(m.id)).forEach(f => {
      if (f.pairId) { f.pairId = null; fixes.push('Ideale orfano ' + f.id); }
      if (f.validated) { f.validated = false; fixes.push('lucchetto aperto su Ideale orfano ' + f.id); }
    });
    if (!maps[V.doc.activeMapId]) { V.doc.activeMapId = Object.keys(maps)[0] || null; fixes.push('mappa attiva'); }
    // l'Ideale abita col suo Attuale: un Ideale in un altro progetto sparirebbe dagli elenchi del suo
    Object.values(maps).forEach(m => { if (m.kind === 'future' && m.pairId && maps[m.pairId] && m.projectId !== maps[m.pairId].projectId) { m.projectId = maps[m.pairId].projectId; fixes.push('Ideale riportato nel progetto del suo Attuale ' + m.id); } });
    if (!V.doc.projects[V.doc.activeProjectId]) { const am = maps[V.doc.activeMapId]; V.doc.activeProjectId = (am && am.projectId) || Object.keys(V.doc.projects)[0] || null; }
    return fixes;
  };
  V.replaceDoc = (d) => { if (!d || d.version !== 2 || !d.maps) throw new Error('Formato non riconosciuto (serve un JSON di VSM Coach v2)'); V.doc = d; Object.values(V.doc.maps).forEach(m => { keepLook(m); Object.assign(m, Object.assign(V.newMap(), m)); }); V.repairDoc(); if (!V.doc.maps[V.doc.activeMapId]) V.doc.activeMapId = Object.keys(V.doc.maps)[0]; undoStack.length = 0; redoStack.length = 0; V.save(); emit({ switched: true }); };
  V.importMaps = (d) => { // aggiunge le mappe di un altro documento senza sostituire (id già esistenti → rigenerati, per non perdere le modifiche fatte nel frattempo)
    if (d.version === 2 && d.maps) {
      const idRemap = new Map();
      Object.keys(d.maps).forEach(id => { if (V.doc.maps[id]) idRemap.set(id, uid()); });
      // Anche i progetti del file entrano, con la stessa tecnica del remap delle mappe: un id del
      // file non deve schiacciare un progetto di casa. Senza questo passaggio le mappe importate
      // arrivavano con un projectId sconosciuto e repairDoc le rifugiava nel primo progetto che
      // capitava («Esempi», nel caso tipico): mappe che non c'entravano niente, mescolate.
      // Entrano SOLO i progetti di cui arriva almeno una mappa: gli altri non servono a nessuno
      // e resterebbero negli elenchi come spazzatura. Fanno eccezione quelli collegati a un
      // progetto importato: senza di loro i collegamenti fra progetti non sopravviverebbero
      // al viaggio.
      const progettiDelFile = (d.projects && typeof d.projects === 'object') ? d.projects : {};
      const usati = new Set(Object.values(d.maps).map(m => m && m.projectId).filter(id => progettiDelFile[id]));
      const tenuti = new Set(usati);
      usati.forEach(id => { const p = progettiDelFile[id]; (Array.isArray(p.links) ? p.links : []).forEach(l => { if (progettiDelFile[l]) tenuti.add(l); }); });
      const projRemap = new Map();
      tenuti.forEach(id => {
        const p = progettiDelFile[id]; if (!p || typeof p !== 'object') return;
        // il progetto di esempio del file non si duplica: le sue mappe entrano in quello di
        // casa. Vale solo per gli esempi — due progetti di lavoro con lo stesso nome sono due
        // lavori diversi e restano separati.
        const casa = p.sample && Object.values(V.doc.projects).find(x => x.sample);
        const nuovo = casa ? casa.id : (V.doc.projects[id] ? uid() : id);
        projRemap.set(id, nuovo);
        if (casa) casa.links = casa.links.concat(Array.isArray(p.links) ? p.links : []);
        else V.doc.projects[nuovo] = Object.assign(clone(p), { id: nuovo });
      });
      // i collegamenti fra progetti puntano agli id del file: vanno rinominati insieme agli id,
      // altrimenti resterebbero appesi a progetti che qui non esistono
      projRemap.forEach(nuovo => { const p = V.doc.projects[nuovo]; p.links = (Array.isArray(p.links) ? p.links : []).map(x => projRemap.get(x) || x); });
      // Una mappa importata senza progetto valido NEL FILE non finisce in un progetto di casa:
      // sta in un progetto nuovo (uno solo per tutte, così restano insieme), con il nome che sta
      // nel file se c'è, altrimenti «Mappe importate».
      let progettoImportate = null;
      const progettoPer = (m) => {
        if (m.projectId && projRemap.has(m.projectId)) return projRemap.get(m.projectId);
        if (!progettoImportate) { progettoImportate = V.newProject({ name: d.name || d.title || 'Mappe importate' }); V.doc.projects[progettoImportate.id] = progettoImportate; }
        return progettoImportate.id;
      };
      // ogni riferimento fra mappe va rinominato insieme all'id, non solo la coppia attuale/ideale:
      // la catena dei giri (verOf) e il badge verso un sotto-foglio (props.link) puntavano alle mappe
      // gia' in libreria, e il file riaperto si cuciva addosso a quelle invece di restare una copia a se'.
      const ext = (v) => (v && idRemap.has(v)) ? idRemap.get(v) : v;
      const imported = Object.values(d.maps).map(m => {
        const nm = Object.assign(V.newMap(), keepLook(m));
        nm.id = ext(nm.id); nm.pairId = ext(nm.pairId); nm.parentId = ext(nm.parentId); nm.verOf = ext(nm.verOf);
        nm.projectId = progettoPer(m);
        nm.elements.forEach(el => { if (el.props && el.props.link) el.props.link = ext(el.props.link); });
        return nm;
      });
      imported.forEach(m => { V.doc.maps[m.id] = m; });
      V.doc.activeMapId = imported[0].id; V.repairDoc(); V.save(); emit({ switched: true }); return imported.length;
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
  /** Ordine del flusso: la catena dei box seguendo le frecce; senza frecce, l'ordine e' stimato per x.
   *  Restituisce anche i *tratti* (segments): uno per ogni freccia percorsa, from → to. La timeline si
   *  disegna su questi, non sulle coppie consecutive dell'elenco: dove il processo si biforca (A→B e
   *  A→C) B e C finivano uno dopo l'altro nell'elenco e fra i due rami compariva un'attesa che nella
   *  realta' non esiste. I box che nessuna freccia raggiunge restano fuori (loose): infilarli in coda
   *  alla catena li faceva entrare nel tempo a valore e spegneva l'avviso che li segnala. */
  V.flowOrder = (map) => {
    const byX = (a, b) => a.x - b.x;
    const boxes = map.elements.filter(e => e.type === 'box');
    // ordinano solo le frecce fra passi: una freccia che parte da una scorta o da un in-box collega,
    // ma non dice «questo passo viene dopo quello» — senza il filtro, un passo raggiunto solo da una
    // freccia del genere perdeva il numero e restava fuori dall'ordine stimato
    const flows = map.elements.filter(e => e.type === 'flow' && e.from.el && e.to.el)
      .filter(f => boxes.some(b => b.id === f.from.el) && boxes.some(b => b.id === f.to.el));
    if (!flows.length) return { order: boxes.slice().sort(byX), loose: [], estimated: boxes.length > 1, flows: [], segments: [], lane: new Map(), lanes: 1 };
    const outMap = new Map(), inCount = new Map(), touched = new Set(); boxes.forEach(b => { outMap.set(b.id, []); inCount.set(b.id, 0); });
    flows.forEach(f => { if (outMap.has(f.from.el) && inCount.has(f.to.el)) { outMap.get(f.from.el).push(f); inCount.set(f.to.el, inCount.get(f.to.el) + 1); touched.add(f.from.el); touched.add(f.to.el); } });
    // un passo che nessuna freccia tocca non e' l'inizio di un ramo: e' un passo lasciato da parte
    const starts = boxes.filter(b => touched.has(b.id) && inCount.get(b.id) === 0).sort(byX);
    const order = [], seen = new Set(), usedFlows = [], segments = [], lane = new Map();
    // ogni percorso alternativo prende una corsia sua: sulla timeline i rami stanno uno sotto l'altro,
    // invece di finire disegnati l'uno sopra l'altro alla stessa altezza
    let corsie = 0;
    // La visita e' in profondita' e va per pila esplicita, non per ricorsione: su una catena di
    // qualche migliaio di passi lo stack finiva e partiva un RangeError non catturato, che portava
    // giu' anche V.metrics e V.stepNumbers (R4, debug del 2026-08-21). Un contatore di profondita'
    // non sarebbe stato una guardia: qui il problema non e' un anello (per quello c'e' `seen`), e'
    // la profondita' vera.
    // Ogni ripresa tiene il punto in cui era arrivata (`i` fra i suoi rami), cosi' la sequenza con
    // cui si consumano le corsie resta IDENTICA a quella della ricorsione: il ramo successivo
    // prende il suo numero solo dopo che tutto il sotto-albero del ramo precedente e' stato
    // visitato. Mettere tutti i figli nella pila e poi toglierli ridisegnerebbe la timeline
    // diversa — le corsie sono le corsie del disegno, non un dettaglio interno.
    const visit = (b0, ln0) => {
      const pila = [{ b: b0, ln: ln0, outs: null, i: 0 }];
      while (pila.length) {
        const f = pila[pila.length - 1];
        if (f.outs === null) {
          if (seen.has(f.b.id)) { pila.pop(); continue; }
          seen.add(f.b.id); order.push(f.b); lane.set(f.b.id, f.ln);
          f.outs = outMap.get(f.b.id).slice().sort((p, q) => (V.byId(p.to.el, map)?.x || 0) - (V.byId(q.to.el, map)?.x || 0));
        }
        if (f.i >= f.outs.length) { pila.pop(); continue; }
        const c = f.outs[f.i], i = f.i++;
        const t = V.byId(c.to.el, map); if (!t) continue;
        const ramo = i === 0 ? f.ln : ++corsie;
        usedFlows.push(c); segments.push({ from: f.b, to: t, conn: c, lane: ramo });
        pila.push({ b: t, ln: ramo, outs: null, i: 0 });
      }
    };
    // se ogni passo toccato ha un ingresso (le frecce girano in tondo) si parte comunque da sinistra
    (starts.length ? starts : boxes.filter(b => touched.has(b.id)).sort(byX)).forEach((b, i) => visit(b, i ? ++corsie : 0));
    const loose = boxes.filter(b => !seen.has(b.id)).sort(byX);
    return { order, loose, estimated: loose.length > 0, flows: usedFlows, segments, lane, lanes: corsie + 1 };
  };
  /** Il numero di ogni passo dentro il foglio. Non si salva: si calcola dalle frecce, come una scaletta
   *  si ricalcola quando sposti un capitolo. Regola: il numero è la PROFONDITÀ dal primo passo contando
   *  le frecce percorse (col percorso più lungo, così un passo dove due rami si ricongiungono viene dopo
   *  entrambi); quando alla stessa profondità stanno più rami, si aggiunge una lettera (2a, 2b), perché
   *  numerarli 2 e 3 direbbe una bugia: non vengono uno dopo l'altro. */
  V.stepNumbers = (map) => {
    const out = new Map(); if (!map) return out;
    const fo = V.flowOrder(map);
    // senza frecce l'ordine è quello stimato da sinistra a destra: niente rami, niente lettere
    if (!fo.segments.length) { fo.order.forEach((b, i) => out.set(b.id, String(i + 1))); return out; }
    const prof = new Map(); fo.order.forEach(b => prof.set(b.id, 0));
    let cambia = true, giri = 0;
    while (cambia && giri++ <= fo.order.length) {
      cambia = false;
      fo.segments.forEach(s => { const d = (prof.get(s.from.id) || 0) + 1; if (d > (prof.get(s.to.id) || 0)) { prof.set(s.to.id, d); cambia = true; } });
    }
    const livelli = new Map();
    fo.order.forEach(b => { const d = prof.get(b.id) || 0; if (!livelli.has(d)) livelli.set(d, []); livelli.get(d).push(b); });
    Array.from(livelli.keys()).sort((a, b) => a - b).forEach(d => {
      const gruppo = livelli.get(d).slice().sort((a, b) => a.y - b.y || a.x - b.x);
      gruppo.forEach((b, j) => out.set(b.id, String(d + 1) + (gruppo.length > 1 ? ('abcdefghijklmnopqrstuvwxyz'[j] || String(j + 1)) : '')));
    });
    return out;
  };
  /** La striscia del flusso per l'occhio (UI.showPeek): la catena del sotto-foglio letta da flowOrder,
   *  ridotta a una fila di tessere — il passo (numero e titolo), l'attesa appesa alla freccia (▼ col
   *  suo tempo, null se nessuno l'ha misurato: si vede il triangolo, non un numero inventato).
   *  Dove il flusso si biforca compare una tessera «fork» col numero del passo da cui si divide:
   *  la striscia non deve mai far sembrare una catena semplice un flusso che semplice non è (usa
   *  segments, non order: in order i due rami finiscono uno in coda all'altro e sembrerebbero in
   *  fila). Quando due rami si ricongiungono il passo ricompare col suo stesso numero: chi legge
   *  vede «3 … 3» e capisce che si torna lì. Foglio senza frecce → striscia vuota: resta il disegno. */
  V.flowStrip = (map) => {
    if (!map) return [];
    const fo = V.flowOrder(map);
    if (!fo.flows.length) return [];
    const nums = V.stepNumbers(map);
    const atteseSu = new Map();
    map.elements.forEach(e => {
      if (e.type !== 'delta' || !e.props.attachedTo) return;
      if (!atteseSu.has(e.props.attachedTo)) atteseSu.set(e.props.attachedTo, []);
      atteseSu.get(e.props.attachedTo).push(e);
    });
    const tessera = (b) => ({ kind: 'box', n: nums.get(b.id) || '', title: String(b.props.title || '').trim() });
    const out = [tessera(fo.order[0])];
    let ultimo = fo.order[0].id;
    fo.segments.forEach(s => {
      // chi emette questa freccia non è l'ultimo passo della fila: si sta aprendo un altro ramo
      if (s.from.id !== ultimo) out.push({ kind: 'fork', n: nums.get(s.from.id) || '' });
      (atteseSu.get(s.conn.id) || []).forEach(d => out.push({ kind: 'delta', avg: num(d.props.avg) }));
      out.push(tessera(s.to));
      ultimo = s.to.id;
    });
    return out;
  };
  /* ---------- il cronometro: misurare i tempi camminando il processo ----------
   *  Dal libro (cap. 5): il tempo del passo va dalla PRIMA all'ULTIMA attività; l'attesa NON si
   *  cronometra, si ottiene per differenza (fine del passo → inizio del successivo). Misurando in
   *  sequenza, quindi, le attese escono da sole: è l'unico modo in cui il metodo vuole che nascano.
   *  Le misure si salvano in SECONDI (props.times): l'unità del foglio (map.unit) può cambiare
   *  dopo, e una misura registrata «in minuti» diventerebbe una bugia. Restano dentro il documento,
   *  perché chi ha camminato il processo non deve perdere il giro se il tablet si spegne. */
  const UNIT_SEC = { secondi: 1, minuti: 60, ore: 3600, giorni: 86400 };
  V.unitSeconds = (unit) => UNIT_SEC[unit] || 60;
  /** Sotto questa soglia una misura non è il tempo di un passo: è un tocco per sbaglio, o un giro
   *  cominciato e chiuso per sbaglio. La soglia è in SECONDI e non nell'unità del foglio — due secondi
   *  restano due secondi anche su un foglio in ore. L'app la SEGNALA e basta: scartarla è di chi ha
   *  osservato, come per l'outlier eccezionale (spec: «l'app li mostra, non decide»). */
  V.MISURA_BREVE = 5;
  V.toUnit = (sec, unit) => sec / V.unitSeconds(unit);
  /** Le misure buone di un elemento: numeri veri, mai negativi. Quello che arriva da un file di fuori
   *  può essere qualunque cosa, e una media con dentro «due» non è una media. */
  V.timesOf = (el) => (el && Array.isArray(el.props && el.props.times))
    ? el.props.times.filter(x => typeof x === 'number' && isFinite(x) && x >= 0) : [];
  /** Hi = massimo, Lo = minimo, Avg = media aritmetica (Fig. 5.1). Niente esclusione automatica degli
   *  outlier: chi ha osservato sa se quel 19 era un caso eccezionale o il sintomo di un problema a
   *  monte — l'app li mostra, non decide. */
  V.timeStats = (times) => {
    const t = (times || []).filter(x => typeof x === 'number' && isFinite(x) && x >= 0);
    if (!t.length) return { hi: null, lo: null, avg: null, n: 0 };
    return { hi: Math.max.apply(null, t), lo: Math.min.apply(null, t), avg: t.reduce((a, b) => a + b, 0) / t.length, n: t.length };
  };
  /** Che cosa c'è da scrivere, prima di scriverlo: un elenco di passi e attese con quante misure
   *  hanno, i conti già nell'unità del foglio, se avevano tempi scritti a mano (non si sovrascrive in
   *  silenzio) e se sono validati (quelli non si toccano). */
  V.timesReport = (map) => {
    if (!map) return [];
    return map.elements.filter(e => (e.type === 'box' || e.type === 'delta') && V.timesOf(e).length).map(e => {
      const t = V.timesOf(e); const s = V.timeStats(t);
      return {
        id: e.id, type: e.type, n: t.length, times: t, brevi: t.filter(x => x < V.MISURA_BREVE).length,
        label: e.type === 'box' ? (String(e.props.title || '').trim() || 'passo senza nome') : (String(e.props.note || '').trim() || 'attesa'),
        stats: { hi: V.toUnit(s.hi, map.unit), lo: V.toUnit(s.lo, map.unit), avg: V.toUnit(s.avg, map.unit), n: s.n },
        manual: !!(e.props.hi || e.props.lo || e.props.avg),
        validated: !!e.props.validated
      };
    });
  };
  /** «Calcola i tempi»: scrive Hi/Lo/Avg dove ci sono misure, in UNA sola voce di annulla. I passi
   *  validati restano fuori (e chi chiama lo dice a chi guarda): mandarli dentro il commit avrebbe
   *  fatto rifiutare l'intero blocco, e un solo passo validato avrebbe bloccato tutto il foglio. */
  V.applyTimes = (map) => {
    const rep = V.timesReport(map);
    const ops = []; let validati = 0;
    rep.forEach(r => {
      if (r.validated) { validati++; return; }
      ops.push({ t: 'props', id: r.id, after: { hi: fmt(r.stats.hi), lo: fmt(r.stats.lo), avg: fmt(r.stats.avg) } });
    });
    if (!ops.length) return { ok: false, written: 0, validati };
    const ok = V.commit(ops, 'calcola i tempi', { map });
    return { ok, written: ok ? ops.length : 0, validati };
  };
  /** Scarta una singola misura (il caso eccezionale che chi ha osservato riconosce). */
  V.dropTime = (map, elId, i) => {
    const el = V.byId(elId, map); if (!el) return false;
    const t = V.timesOf(el); if (i < 0 || i >= t.length) return false;
    const dopo = t.slice(0, i).concat(t.slice(i + 1));
    return V.commit({ t: 'props', id: elId, after: { times: dopo } }, 'scarta una misura', { map });
  };
  /** La catena del giro: si seguono le frecce, un passo dopo l'altro, prendendo il primo ramo a ogni
   *  biforcazione. I punti in cui il flusso si divide e i passi lasciati fuori si DICHIARANO: un giro
   *  che salta metà foglio senza avvisare produce dati che sembrano completi e non lo sono.
   *  Foglio senza frecce: la catena è l'ordine stimato da sinistra a destra, e fra un passo e l'altro
   *  non c'è attesa da misurare (non c'è freccia a cui appenderla). */
  V.measureChain = (map) => {
    const vuoto = { chain: [], forks: [], fuori: [] };
    if (!map) return vuoto;
    const fo = V.flowOrder(map);
    if (!fo.order.length) return vuoto;
    if (!fo.segments.length) return { chain: fo.order.slice(), forks: [], fuori: [] };
    const chain = [], forks = [], visti = new Set();
    let cur = fo.order[0];
    while (cur && !visti.has(cur.id)) {
      visti.add(cur.id); chain.push(cur);
      const outs = fo.segments.filter(s => s.from.id === cur.id);
      if (outs.length > 1) forks.push(cur.id);
      cur = outs.length ? outs[0].to : null;
    }
    return { chain, forks, fuori: fo.order.filter(b => !visti.has(b.id)) };
  };
  /** Il passo dopo, e la freccia da cui ci si passa (null se non c'è freccia: niente attesa). */
  V.measureNext = (map, stepId) => {
    const fo = V.flowOrder(map);
    const seg = fo.segments.find(s => s.from.id === stepId);
    if (seg) return { conn: seg.conn, next: seg.to };
    if (!fo.segments.length) { const i = fo.order.findIndex(b => b.id === stepId); const n = fo.order[i + 1]; return n ? { conn: null, next: n } : null; }
    return null;
  };
  /** Lo stato del giro vive nel foglio (map.measure), non in memoria: l'app si chiude, il tablet si
   *  spegne, il giro si ritrova dov'era. Non passa dall'annulla — è dove sei, non che cosa hai
   *  scritto — quindi si scrive diretto e si salva. */
  const setMeasure = (map, s) => { if (s) map.measure = s; else delete map.measure; V.save(); return s || null; };
  V.measureState = (map) => (map && map.measure) || null;
  V.measureElapsed = (map, now) => { const s = V.measureState(map); return (s && s.t0) ? Math.max(0, Math.round(((now || Date.now()) - s.t0) / 1000)) : 0; };
  /** Avvia la misura di un passo. mode 'giro' = la catena in sequenza (le attese nascono da sole);
   *  mode 'singolo' = quel passo e basta, ripetuto quante volte si vuole (niente attese). */
  V.measureStart = (map, stepId, mode = 'giro', now = Date.now()) => {
    const el = V.byId(stepId, map);
    if (!el || el.type !== 'box' || el.props.validated) return null;
    // col lucchetto del foglio chiuso nessuna misura potra' essere registrata: far partire il giro
    // vorrebbe dire far camminare qualcuno per niente
    if (map.validated) return null;
    const prec = V.measureState(map);
    return setMeasure(map, { mode, giro: (prec && prec.giro) || 1, stepId, phase: 'box', t0: now, fromId: null, connId: null });
  };
  V.measureStop = (map) => setMeasure(map, null);
  /** Butta via la misura in corso e riparte da adesso: chi cammina si accorge subito quando la misura
   *  non vale (una telefonata, un'interruzione che non c'entra) e deve poterla annullare senza
   *  perdere il giro. */
  V.measureDiscard = (map, now = Date.now()) => {
    const s = V.measureState(map); if (!s || !s.phase) return null;
    return setMeasure(map, Object.assign({}, s, { t0: now }));
  };
  const addTime = (map, elId, sec) => {
    const el = V.byId(elId, map); if (!el) return false;
    return V.commit({ t: 'props', id: elId, after: { times: V.timesOf(el).concat([sec]) } }, 'misura', { map });
  };
  /** L'attesa su cui scrivere la differenza: quella già appesa a questa freccia, o una nuova, messa
   *  fra i due passi. Nasce solo quando serve — misurare un passo alla volta non deve riempire il
   *  foglio di attese che nessuno ha osservato. */
  const attesaDi = (map, conn, from, to) => {
    const gia = map.elements.find(e => e.type === 'delta' && e.props.attachedTo === conn.id);
    if (gia) return gia;
    const x = Math.round(((from.x + from.w) + to.x) / 2 - 15), y = Math.round(from.y + 26);
    const d = V.newElement('delta', x, y, {}); d.props.attachedTo = conn.id;
    if (!V.commit({ t: 'add', el: d }, 'attesa misurata', { map })) return null;
    return V.byId(d.id, map);
  };
  /** Un tocco solo, che a seconda di dove sei vuol dire «passo finito» o «comincia il prossimo».
   *  Chiude la misura in corso, la registra, e apre la successiva: passo → attesa → passo dopo.
   *  Alla fine della catena il giro si chiude e il numero sale. */
  V.measureAdvance = (map, now = Date.now()) => {
    const s = V.measureState(map); if (!s || !s.phase || !s.t0) return null;
    const sec = Math.max(0, Math.round((now - s.t0) / 1000));
    // Il giro si chiude: non punta più a niente, il numero del giro resta. Il pannello torna a
    // «comincia il giro», invece di tenere una misura appesa a un elemento che non c'è più.
    const chiudi = () => setMeasure(map, { mode: s.mode, giro: s.giro || 1, stepId: null, phase: null, t0: null, fromId: null, connId: null });
    if (s.phase === 'attesa') {
      const from = V.byId(s.fromId, map), to = V.byId(s.stepId, map), conn = V.byId(s.connId, map);
      // Il passo, la freccia o il passo d'arrivo cancellati mentre l'attesa correva: il tempo misurato
      // non ha più dove essere scritto. Il giro si chiude e lo DICE — riavvolgere a 'box' in silenzio
      // faceva ripartire un cronometro che non misurava più niente di vero.
      // Tre cadaveri possibili, e vanno nominati per nome: dire «il passo non c'è più» mentre il
      // passo sta nell'elenco lì sotto è una contraddizione a schermo — la stessa famiglia di R2.
      if (!from || !to || !conn) { chiudi(); return { ko: 'sparito', cosa: !to ? 'passo' : (!conn ? 'freccia' : 'partenza') }; }
      const d = attesaDi(map, conn, from, to);
      if (d && !addTime(map, d.id, sec)) return { ko: 'validato' };
      setMeasure(map, Object.assign({}, s, { phase: 'box', t0: now, fromId: null, connId: null }));
      return { elId: d ? d.id : null, seconds: sec, phase: 'box' };
    }
    // Il passo CANCELLATO e il passo VALIDATO sono due «non si può» diversi, e vanno detti diversi:
    // addTime torna false per tutti e due (l'elemento assente, e il commit rifiutato dal lucchetto ✓),
    // quindi l'assenza si guarda PRIMA. Senza questa guardia il pannello annunciava «il passo è
    // validato ✓» anche davanti a un passo cancellato, e il giro restava appeso al fantasma per
    // sempre (R2 del debug 2026-08-21).
    // Non basta che l'elemento esista: dev'essere ancora un passo. Un giro che punta a un in-box
    // (un file confezionato ci arriva) scriveva la misura addosso a lui, dove nessun resoconto la
    // mostra: una misura persa in silenzio dentro il documento.
    const passo = V.byId(s.stepId, map);
    if (!passo || passo.type !== 'box') { chiudi(); return { ko: 'sparito', cosa: 'passo' }; }
    // Il lucchetto del FOGLIO e la ✓ del PASSO fermano tutti e due la scrittura, ma sono due cose
    // diverse e vanno dette diverse: annunciare «il passo è validato ✓» davanti a un passo che la ✓
    // non ce l'ha era di nuovo il foglio che dice il falso.
    if (map.validated) return { ko: 'foglio' };
    // il giro resta aperto: scartare la misura o riaprire il lucchetto del passo lo decide chi misura
    if (!addTime(map, s.stepId, sec)) return { ko: 'validato' };
    if (s.mode === 'singolo') { setMeasure(map, Object.assign({}, s, { phase: null, t0: null })); return { elId: s.stepId, seconds: sec, phase: null }; }
    const dopo = V.measureNext(map, s.stepId);
    if (!dopo) { setMeasure(map, { mode: s.mode, giro: (s.giro || 1) + 1, stepId: null, phase: null, t0: null, fromId: null, connId: null }); return { elId: s.stepId, seconds: sec, phase: null, chiuso: true }; }
    if (!dopo.conn) { setMeasure(map, Object.assign({}, s, { stepId: dopo.next.id, phase: 'box', t0: now, fromId: null, connId: null })); return { elId: s.stepId, seconds: sec, phase: 'box' }; }
    setMeasure(map, Object.assign({}, s, { phase: 'attesa', t0: now, fromId: s.stepId, connId: dopo.conn.id, stepId: dopo.next.id }));
    return { elId: s.stepId, seconds: sec, phase: 'attesa' };
  };
  /** Indirizzo del foglio: quello del passo che lo contiene, PER INTERO. Vuoto per la radice del
   *  progetto. La guardia serve solo contro gli anelli di un documento arrivato da fuori e mai
   *  passato per repairDoc (che gli anelli li scioglie): non deve mai tagliare una catena vera —
   *  quando era `guard > 8` (spec 2026-08-20) dal nono livello in giù fogli diversi si ritrovavano
   *  con lo STESSO indirizzo, e un indirizzo che non distingue non è un indirizzo. Quando è lungo
   *  si accorcia solo in mostra, con V.shortAddress: il valore qui resta quello vero. */
  V.mapAddress = (map, guard = 0) => {
    if (!map || !map.parentId || guard > 40) return '';
    const par = V.doc.maps[map.parentId]; if (!par) return '';
    const su = V.mapAddress(par, guard + 1);
    const n = map.parentStepId ? V.stepNumbers(par).get(map.parentStepId) : null;
    if (!n) return su; // il passo non c'è più: si eredita l'indirizzo della madre invece di perderlo
    return su ? su + '.' + n : n;
  };
  /** L'indirizzo come si mostra a schermo: oltre i quattro tratti si accorcia con l'ellissi davanti
   *  e la coda vera («…1.1.1») — chi legge capisce «sono in fondo a una catena lunga» invece di
   *  leggere un numero falso. Il valore intero resta in V.mapAddress: lo usano l'export e i title=
   *  dei pulsanti, che nelle prove e nell'export devono dire la verità. */
  V.shortAddress = (a) => {
    const tratti = String(a || '').split('.').filter(Boolean);
    return tratti.length <= 4 ? (a || '') : '…' + tratti.slice(-3).join('.');
  };
  /** Le briciole in barra hanno un limite, come i percorsi lunghi di un gestore di file: oltre i
   *  quattro anelli restano il primo, un'ellissi (null al suo posto) e gli ultimi due. La catena
   *  intera la risale chi serve; in barra conta leggere «da dove vengo» e «dove sono» senza
   *  affogare il titolo. */
  V.visibleCrumbs = (anelli) => anelli.length <= 4 ? anelli.slice() : [anelli[0], null, anelli[anelli.length - 2], anelli[anelli.length - 1]];
  /** Indirizzo di un passo: il foglio più il proprio numero. Vuoto se il passo è fuori catena. */
  V.addressOf = (box, map) => { const n = V.stepNumbers(map).get(box && box.id); if (!n) return ''; const su = V.mapAddress(map); return su ? su + '.' + n : n; };
  /** Che cosa significa il badge di un passo. Due cose diverse, e devono vedersi diverse:
   *  «figlia» = questo passo CONTIENE quella mappa (è il suo posto nell'albero, badge ↗);
   *  «riferimento» = questo passo RICHIAMA una mappa che sta altrove — il caso «ha lo stesso identico
   *  processo di 2.1.1» (badge ⇉, con l'indirizzo vero scritto accanto).
   *  Il badge segue SEMPRE il link, perché è il link ciò che si apre toccandolo: guardare l'albero
   *  (come prima) poteva mostrare ↗ mentre il tocco apriva una mappa che sta altrove — il badge
   *  diceva una cosa e ne faceva un'altra. Un passo con un sotto-foglio ma senza link non ha badge:
   *  il sotto-foglio si raggiunge dalla cartina. */
  V.linkKind = (box, map) => {
    if (!box || !map) return null;
    const id = box.props && box.props.link; if (!id) return null;
    const t = V.doc.maps[id]; if (!t) return null;
    return (t.parentId === map.id && t.parentStepId === box.id) ? 'figlia' : 'riferimento';
  };
  /** Un hue o null. E' l'unica forma in cui una tinta puo' stare salvata: il disegno la scrive dentro
   *  un attributo di stile, quindi tutto cio' che non e' un numero resta fuori (anche da sanitizeMap). */
  V.tintHue = (v) => { if (v == null) return null; const n = +v; return isFinite(n) ? ((n % 360) + 360) % 360 : null; };
  /** La palette dei passi: otto tinte tenui piu' «nessuna», decise da Gt guardandole a schermo
   *  (spec 2026-08-21, «Le otto tinte, decise guardandole»). Due vincoli: nessun hue vicino al rosso
   *  d'allarme dei delta e dei fulmini (9° — il primo mattone a 15° gli somigliava troppo), e colori
   *  riposanti che non coprano gli elementi gia' colorati del canvas: in una mappa VSM e' l'allarme
   *  la cosa che deve saltare addosso, non il contenitore. */
  V.TINTS = [
    { id: null, name: 'nessuna' },
    { id: 35, name: 'sabbia' }, { id: 80, name: 'oliva' }, { id: 125, name: 'salvia' }, { id: 170, name: 'acqua' },
    { id: 205, name: 'cielo' }, { id: 250, name: 'indaco' }, { id: 290, name: 'lavanda' }, { id: 330, name: 'rosa' }
  ];
  /** Colore di un passo E sfondo del suo sotto-foglio, nella stessa voce di annulla (mapfield, come
   *  l'adozione): il colore e' il filo che lega i due, e un annulla che li separasse lascerebbe il
   *  legame a meta'. Solo la figlia segue il colore: una mappa richiamata (⇉) ha la sua casa e il
   *  suo sfondo, qui viene solo citata. */
  V.setTint = (boxId, hue, map = V.map()) => {
    const box = V.byId(boxId, map); if (!box) return false;
    const H = V.tintHue(hue);
    const ops = [{ t: 'props', id: boxId, after: { tint: H } }];
    if (V.linkKind(box, map) === 'figlia') ops.push({ t: 'mapfield', mapId: box.props.link, key: 'tint', after: H });
    return V.commit(ops, 'colore del passo');
  };
  /** Il problema ridotto al segno: sul foglio resta la sua forma, piccola, con una «i» dentro — il
   *  testo non si perde, si legge toccandola. Serve quando i problemi sono tanti e il foglio non si
   *  legge più: il libro chiede di segnarli TUTTI, e nasconderli non è cancellarli.
   *  Riaprendolo torna alla misura di prima, e comunque alta quanto serve al suo testo: una nuvola
   *  riaperta più bassa del suo testo lo avrebbe fatto sforare. */
  V.setStormMark = (map, id, on, chi = 'segno') => {
    const el = V.byId(id, map); if (!el || el.type !== 'storm') return false;
    const R2 = V.render;
    const props = on ? { collapsed: true, w0: el.w, h0: el.h } : { collapsed: false };
    let size;
    if (on) size = { w: 34, h: 30 };
    else {
      const w = el.props.w0 || V.TYPES.storm.w;
      let h = el.props.h0 || V.TYPES.storm.h;
      if (R2 && R2.cloudFit && el.props.text) h = Math.max(h, R2.cloudFit(w, el.props.text, V.shapeOf(el)));
      size = { w, h };
    }
    return V.commit([
      { t: 'props', id, after: props },
      { t: 'update', id, after: size, before: { w: el.w, h: el.h } }
    ], on ? 'riduci al segno' : 'riapri il problema', { map });
  };
  /** Cambiare forma può cambiare quanto testo ci sta (il triangolo è stretto in cima): l'altezza si
   *  rifà nella stessa voce di annulla, o il testo sforerebbe fuori dal disegno. */
  V.setStormShape = (map, id, shape) => {
    const el = V.byId(id, map); if (!el || el.type !== 'storm') return false;
    const f = V.STORM_SHAPES.includes(shape) ? shape : 'nuvola';
    const ops = [{ t: 'props', id, after: { shape: f } }];
    const R2 = V.render;
    if (!el.props.collapsed && el.props.text && R2 && R2.cloudFit) {
      const h = Math.max(V.TYPES.storm.h, R2.cloudFit(el.w, el.props.text, f));
      if (h !== el.h) ops.push({ t: 'update', id, after: { h }, before: { h: el.h } });
    }
    return V.commit(ops, 'forma del problema', { map });
  };
  /** I PERCORSI del foglio, con i loro parziali.
   *  Dove il flusso si divide, sommare i rami in un totale solo dice una cosa che non succede a
   *  nessuno: sul foglio Accoglienza → (Prelievo | Visita) → Refertazione il totale unico vale 104
   *  minuti, mentre chi passa dal prelievo ne impiega 39 e chi va alla visita 81. Il libro conta il
   *  tempo che il PAZIENTE attraversa, e il paziente una strada sola la prende. Qui si elencano i
   *  percorsi interi, ognuno coi suoi minuti; il tratto che fanno tutti si dice a parte.
   *
   *  Due bivi diversi si disegnano uguali — due frecce che escono dallo stesso passo — e l'app non
   *  puo' sapere se sono alternative («o l'una o l'altra») o rami paralleli («tutti e due insieme»).
   *  Invece di chiederlo si mostrano tutte e due le letture: i percorsi separati, e in `together`
   *  l'attraversamento se i rami corrono insieme — dove il ramo lento detta il passo e quello veloce
   *  RESTA FERMO ad aspettarlo. Quell'attesa (42 minuti nell'esempio) oggi non si vede da nessuna
   *  parte, ed e' esattamente il tempo in cui nulla avanza che una value stream map deve mostrare.
   *
   *  Le attese contano solo se stanno sulle frecce di QUEL percorso. Il giro dei percorsi non
   *  ripassa mai dallo stesso passo (una rilavorazione che torna indietro non deve girare a vuoto),
   *  e sopra una manciata di percorsi si smette di elencarli dicendo quanti sono: con sei bivi in
   *  fila sarebbero sessantaquattro, e un riquadro con sessantaquattro righe non lo legge nessuno. */
  const MAX_PERCORSI = 8;
  V.flowPaths = (map) => {
    const vuoto = { paths: [], common: { boxes: [], va: 0, nva: 0 }, forks: [], count: 0, truncated: false, together: null };
    if (!map) return vuoto;
    const fo = V.flowOrder(map);
    if (!fo.order.length) return vuoto;
    const deltas = map.elements.filter(e => e.type === 'delta');
    const attesaSu = (connId) => { const d = deltas.find(x => x.props.attachedTo === connId); const v = d ? num(d.props.avg) : null; return v == null ? 0 : v; };
    const val = (b) => { const v = num(b.props.avg); return v == null ? 0 : v; };
    const uscite = new Map();
    fo.segments.forEach(s => { if (!uscite.has(s.from.id)) uscite.set(s.from.id, []); uscite.get(s.from.id).push(s); });
    const inizi = fo.order.filter(b => !fo.segments.some(s => s.to.id === b.id));
    const partenze = inizi.length ? inizi : [fo.order[0]];
    // enumerazione in profondita', con i passi gia' visti dentro QUESTO percorso: un ritorno
    // indietro chiude il percorso li', invece di ricominciare il giro
    // Iterativa, con una pila di riprese: una catena di qualche migliaio di passi finirebbe lo
    // stack, ed e' l'errore che flowOrder ha appena smesso di fare — non si reintroduce qui.
    const paths = []; let count = 0, troncati = false;
    const cammina = (p0) => {
      const visti = new Set([p0.id]), boxes = [p0], conns = [];
      const pila = [{ box: p0, out: null, i: 0 }];
      while (pila.length) {
        if (count > 4096) { troncati = true; return; }        // rete contro i fogli mostruosi
        const f = pila[pila.length - 1];
        if (f.out === null) {
          f.out = (uscite.get(f.box.id) || []).filter(s => !visti.has(s.to.id));
          if (!f.out.length) {                                 // qui il percorso finisce
            count++;
            if (paths.length < MAX_PERCORSI) paths.push({ boxes: boxes.slice(), conns: conns.slice() });
            else troncati = true;
          }
        }
        if (f.i >= f.out.length) {                             // tornando indietro si sfila il passo
          pila.pop();
          if (pila.length) { const uscito = boxes.pop(); conns.pop(); visti.delete(uscito.id); }
          continue;
        }
        const s = f.out[f.i++];
        if (visti.has(s.to.id)) continue;                      // un altro ramo ci e' gia' passato
        visti.add(s.to.id); boxes.push(s.to); conns.push(s.conn);
        pila.push({ box: s.to, out: null, i: 0 });
      }
    };
    partenze.forEach(cammina);
    if (!paths.length) return vuoto;
    // i conti di ogni percorso, e il nome: il primo passo che NON fanno tutti
    const inTutti = paths[0].boxes.filter(b => paths.every(p => p.boxes.some(x => x.id === b.id)));
    const comuni = new Set(inTutti.map(b => b.id));
    const conti = paths.map(p => {
      const va = p.boxes.reduce((a, b) => a + val(b), 0);
      const nva = p.conns.reduce((a, c) => a + attesaSu(c.id), 0);
      const suo = p.boxes.find(b => !comuni.has(b.id));
      return { boxes: p.boxes, conns: p.conns, va, nva, tot: va + nva,
        vaPct: (va + nva) > 0 ? va / (va + nva) * 100 : null,
        label: String((suo || p.boxes[p.boxes.length - 1] || {}).props?.title || '').trim() || 'percorso' };
    });
    const common = { boxes: inTutti, va: inTutti.reduce((a, b) => a + val(b), 0),
      nva: paths[0].conns.filter(c => paths.every(p => p.conns.some(x => x.id === c.id))).reduce((a, c) => a + attesaSu(c.id), 0) };
    // la lettura «se vanno insieme»: chi finisce prima aspetta il piu' lento
    let together = null;
    if (conti.length > 1) {
      const lento = conti.reduce((a, b) => (b.tot > a.tot ? b : a));
      together = { tot: lento.tot, slowest: lento.label,
        waits: conti.filter(c => c !== lento && lento.tot - c.tot > 0).map(c => ({ label: c.label, sec: lento.tot - c.tot })) };
    }
    return { paths: conti, common, forks: fo.segments.length ? Array.from(uscite.entries()).filter(([, v]) => v.length > 1).map(([k]) => k) : [],
      count: Math.max(count, conti.length), truncated: troncati, together };
  };
  V.metrics = (map) => {
    const boxes = map.elements.filter(e => e.type === 'box');
    const deltas = map.elements.filter(e => e.type === 'delta');
    const fo = V.flowOrder(map);
    // Il riepilogo conta quello che la timeline mostra: i passi della catena e le attese appese alle
    // frecce percorse. Un passo parcheggiato a lato o un delta lasciato sulla carta non gonfiano piu'
    // il totale in silenzio — si contano a parte, e il controllo li nomina. Senza nessuna freccia non
    // c'e' catena: li' si conta tutto, come prima, ed e' l'ordine per x a essere dichiarato stimato.
    const used = new Set(fo.flows.map(f => f.id));
    const counted = fo.flows.length ? deltas.filter(d => d.props.attachedTo && used.has(d.props.attachedTo)) : deltas.slice();
    const looseDeltas = deltas.filter(d => !counted.includes(d) && num(d.props.avg) != null);
    const va = fo.order.map(b => num(b.props.avg)).filter(v => v != null).reduce((a, b) => a + b, 0);
    const nva = counted.map(d => num(d.props.avg)).filter(v => v != null).reduce((a, b) => a + b, 0);
    const tot = va + nva; const hasData = boxes.some(b => num(b.props.avg) != null) || deltas.some(d => num(d.props.avg) != null);
    const ccs = fo.order.map(b => num(b.props.cc)).filter(v => v != null);
    const ftq = ccs.length ? ccs.reduce((a, b) => a * (b / 100), 1) * 100 : null;
    const requests = map.elements.filter(e => e.type === 'request');
    return {
      va, nva, tot, vaPct: tot > 0 ? va / tot * 100 : null, nvaPct: tot > 0 ? nva / tot * 100 : null, hasData,
      // ftqPartial: il prodotto dei soli C&C compilati e' sempre ottimista (un passo senza dato vale 100%)
      ftq, ftqPartial: ccs.length > 0 && ccs.length < fo.order.length,
      boxes: boxes.length, deltas: deltas.length, requests: requests.length,
      looseBoxes: fo.loose.length, looseDeltas: looseDeltas.length,
      storms: map.elements.filter(e => e.type === 'storm').length, flows: map.elements.filter(e => e.type === 'flow').length, persons: map.elements.filter(e => e.type === 'person').length,
      incompleteBoxes: boxes.filter(b => num(b.props.avg) == null).length, incompleteDeltas: deltas.filter(d => num(d.props.avg) == null).length
    };
  };
  /** Una riga che dice che cosa contiene un foglio: e' il testo dell'occhio (UI.showPeek) e nasce da
   *  metrics, cosi' resta vera da sola finche' nessuno la riscrive (props.summary). Si dicono solo le
   *  cose che ci sono — «0 problemi» e' rumore — e i tempi compaiono solo se qualcuno li ha misurati.
   *  Il tempo a valore si nomina solo se e' una PARTE del totale: «12 in tutto, 12 a valore» direbbe
   *  due volte la stessa cosa. */
  V.describeMap = (map) => {
    if (!map) return '';
    const M = V.metrics(map); const parti = [];
    if (M.boxes) parti.push(M.boxes + (M.boxes === 1 ? ' passo' : ' passi'));
    if (M.hasData) parti.push(fmt(M.tot) + ' ' + map.unit + ' in tutto' + (M.va > 0 && M.va < M.tot ? ', ' + fmt(M.va) + ' a valore' : ''));
    if (M.storms) parti.push(M.storms + (M.storms === 1 ? ' problema' : ' problemi'));
    if (M.persons) parti.push(M.persons + (M.persons === 1 ? ' persona' : ' persone'));
    if (M.requests) parti.push(M.requests + (M.requests === 1 ? ' via di richiesta' : ' vie di richiesta'));
    return parti.join(' · ');
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
    // non un rimprovero: sul foglio possono esserci persone che non chiedono niente (chi si reca, chi
    // lavora nel processo). Qui si segnala solo che nessuna è dichiarata come origine della richiesta.
    if (M.boxes && !requestors.length) add('warn', 1, M.persons ? 'Nessuna persona è segnata come richiedente: chi origina la richiesta? La spunta è nei suoi dettagli.' : 'Chi origina la richiesta? Metti l\'omino a destra, nella fascia alta.');
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
      if (M.looseDeltas) add('warn', 5, `${M.looseDeltas} ${M.looseDeltas === 1 ? 'delta non è agganciato' : 'delta non sono agganciati'} a una freccia della catena: ${M.looseDeltas === 1 ? 'resta fuori' : 'restano fuori'} dal riepilogo e dalla timeline. Trascina il triangolo sulla freccia fra i due passi.`);
      if (M.ftqPartial) add('warn', 5, 'First Time Quality parziale: senza il C&C di ogni passo della catena il dato esce più ottimista del vero.');
    }
    if (M.hasData && !M.storms) add('warn', 6, 'Nessuna nuvola temporalesca: che cosa, del modo in cui il lavoro accade ora, non è ideale?');
    // l'avviso ora scatta davvero: prima i box fuori catena venivano infilati in coda all'ordine, cosi'
    // "estimated" restava sempre falso e questo controllo non si accendeva mai
    if (M.looseBoxes && M.flows) add('warn', 2, `${M.looseBoxes} ${M.looseBoxes === 1 ? 'box non è collegato' : 'box non sono collegati'} alla catena delle frecce: ${M.looseBoxes === 1 ? 'resta fuori' : 'restano fuori'} dalla timeline e dal riepilogo.`);
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
    // l'esempio del libro sta in un progetto suo, marcato «di esempio»: prima si infilava in ogni
    // elenco di ogni reparto, e da un progetto di esempio non si eredita il progetto attivo
    let esempi = Object.values(V.doc.projects).find(p => p.name === 'Esempi');
    if (!esempi) { esempi = V.newProject({ name: 'Esempi', sample: true }); V.doc.projects[esempi.id] = esempi; }
    esempi.sample = true; // un «Esempi» nato prima di questo segno va riconosciuto lo stesso
    m.projectId = esempi.id;
    return m;
  };
})(window.VSM);
