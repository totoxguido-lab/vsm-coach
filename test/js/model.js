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
  /** map.rev: si alza a ogni scrittura del modello (A7), cosi' V.index sa quando rifarsi. Chi scrive
   *  fuori da commit/undo/redo deve chiamarla da se' — censimento in testa a interact.js e qui sotto
   *  a ogni punto che tocca il foglio senza passare da commit. */
  const bump = (map) => { map.rev = ((map.rev | 0) + 1); };

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
  /** Regola generale: le chiavi che questa versione non conosce si conservano intatte — un documento
   *  scritto da una beta più nuova non perde niente. Vale anche DENTRO gli oggetti conosciuti che si
   *  normalizzano campo per campo (le `obs` del Task 3): si parte dall'oggetto originale e si
   *  correggono i soli campi noti, non si ricostruisce. */
  V.sanitizeMap = (m) => {
    if (!m || typeof m !== 'object') return m;
    // l'igiene E' una scrittura (A7): senza questo l'indice non potrebbe mai risultare stantio
    // DENTRO l'igiene stessa, che tocca il foglio prima di restituirlo.
    bump(m);
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
    // Campi del foglio: `!== undefined`, NON `!= null` — un null arrivato da un file e' «presente e
    // sbagliato» (Object.assign(V.newMap(), m) nel replaceDoc non lo correggerebbe: il null della
    // mappa sovrascriverebbe il default). Si corregge qui, non si conserva.
    if (m.validated !== undefined && typeof m.validated !== 'boolean') m.validated = false;
    if (m.kind !== undefined && !['current', 'future', 'detail'].includes(m.kind)) m.kind = 'current';
    // Il lucchetto e' dell'IDEALE (kind:'future', A1): un current/detail con validated:true
    // (0.9 marcio, file confezionato, restore, o un'installazione precedente al round 2 della
    // revisione avversariale del Task 7) NON e' solo un dato "sospetto" — e' un foglio morto per
    // NOVE lettori che leggono map.validated senza controllare kind (interact.js, panels.js,
    // popover.js, model.js:V.deleteMap...) e per l'interfaccia di sblocco, che esiste solo sui
    // future (main.js, panels.js). V.allowed/V.canSetPhase/V.setValidated ignorano gia' 'validated'
    // fuori da kind:'future' (seconda difesa, round 2), ma quella guardia da sola lasciava lo
    // SCHERMO morto: la porta diceva ok, i pannelli restavano bloccati. La cura vera e' qui, dove
    // gia' si sana ogni altro campo del foglio (righe sopra): il dato si corregge alla fonte, a
    // ogni ingresso (load, replaceDoc, importMaps), cosi' tutti i lettori vedono lo stesso vero.
    if (m.validated === true && m.kind !== 'future') m.validated = false;
    // la fase e' un elenco dichiarato, come map.kind: fuori elenco (o null, "presente e sbagliato"
    // come sopra) si torna a 'disegna', che e' anche la fase piu' permissiva
    if (m.phase !== undefined && !V.PHASE_ORDER.includes(m.phase)) m.phase = 'disegna';
    // il calderone (V.unvalidate) e' un archivio per giro: array o niente
    if (m.calderone !== undefined && !Array.isArray(m.calderone)) delete m.calderone;
    // I livelli accesi (spec fondamenta B) vivono in map.layers, un oggetto { <idLivello>: true|false }.
    // Un valore non-oggetto (es. "boh" da un file scombinato) sopravviveva intatto fino al primo
    // L.toggle: Object.assign({}, map.layers, {...}) tratta una stringa come un iterabile e ne copia
    // i caratteri come chiavi numeriche ("0":"b","1":"o","2":"h") dentro il documento vero (layers.js).
    // Fuori tipo si torna al livello di casa (solo 'riepilogo' acceso, come fa V.migrate quando la
    // chiave manca del tutto); dentro un oggetto si tengono solo le chiavi con valore booleano — una
    // chiave sconosciuta resta (A5: il censimento e' permissivo sui nomi), un valore sporco no.
    if (m.layers !== undefined) {
      if (!m.layers || typeof m.layers !== 'object' || Array.isArray(m.layers)) m.layers = { riepilogo: true };
      else { const pulito = {}; Object.keys(m.layers).forEach(k => { if (typeof m.layers[k] === 'boolean') pulito[k] = m.layers[k]; }); m.layers = pulito; }
    }
    // la carta e la vista sono geometria: numeri veri o si torna a quelli di casa
    if (m.paper !== undefined) { const w = num(m.paper && m.paper.w), h = num(m.paper && m.paper.h); if (w > 0 && h > 0) m.paper = { w, h }; else delete m.paper; }
    if (m.view !== undefined && m.view !== null) { const v = m.view; if (typeof v !== 'object' || Array.isArray(v) || num(v.x) == null || num(v.y) == null || !(num(v.k) > 0)) delete m.view; else m.view = { x: num(v.x), y: num(v.y), k: num(v.k) }; }
    // map.tint == null (esplicito) e' lo stato raggiungibile «nessuna tinta» (V.setTint(id, null) sul
    // passo propaga il null anche al sotto-foglio, panels.js: hue = v === '' ? null : +v): non e'
    // «presente e sbagliato», va lasciato passare intatto, mai sostituito da una tinta a caso. Un
    // valore sporco (ne' null ne' un numero) diventa null — deterministico, non un colore inventato.
    if (m.tint != null) { const H = V.tintHue(m.tint); m.tint = (H == null) ? null : H; }
    if (m.guidePhase !== undefined) { const g = num(m.guidePhase); m.guidePhase = (g != null && g >= 0) ? Math.min(9, Math.round(g)) : 0; }
    // Il giro del cronometro appeso a un t0 marcio ("ieri"): oggi si controllano solo gli id (sotto,
    // dopo che live e' pronto); un t0 non-numero produce `now - t0 = NaN` e un'osservazione `s: null`
    // scritta nel documento. Meglio sciogliere il giro che scrivere un dato falso.
    if (m.measure && typeof m.measure === 'object') {
      const s = m.measure;
      if (s.t0 !== undefined && s.t0 !== null && (typeof s.t0 !== 'number' || !isFinite(s.t0))) delete m.measure;
      else {
        if (!['giro', 'singolo'].includes(s.mode)) s.mode = 'giro';
        const g = num(s.giro); s.giro = (g != null && g >= 1) ? Math.round(g) : 1;
        // il turno PENDENTE del cronometro muore a ogni ingresso (rilievo Codex #2 di F1): il
        // turno e' della sessione VIVA — sanitize gira a load/replaceDoc/importMaps, cioe' quando
        // il documento entra in una sessione nuova, e un «mattina» di ieri non deve riattaccarsi
        // da solo alle misure di oggi (la sola visibilita' del campo non e' una conferma). Quello
        // GIA' scritto sulle osservazioni e' un dato preso: resta.
        if (s.turno !== undefined) delete s.turno;
        // pause dell'osservatore (stazione 3, indurite dal finding P1 di Codex): numeri veri E
        // coerenti con t0 e con l'orologio, o via — un pausedAt prima dell'inizio (o nel futuro)
        // e un pausedTot piu' lungo dell'intera durata avrebbero prodotto misure a ZERO in
        // silenzio via Math.max: meglio perdere la pausa (il tempo torna pieno, visibile) che
        // scrivere un dato falso.
        if (s.pausedAt !== undefined && (typeof s.pausedAt !== 'number' || !isFinite(s.pausedAt) || (typeof s.t0 === 'number' && s.pausedAt < s.t0) || s.pausedAt > Date.now() + 60000)) delete s.pausedAt;
        if (s.pausedTot !== undefined && (typeof s.pausedTot !== 'number' || !isFinite(s.pausedTot) || s.pausedTot < 0 || (typeof s.t0 === 'number' && s.pausedTot > Math.max(0, Date.now() - s.t0)))) delete s.pausedTot;
        // Coerenza CONGIUNTA (C8 del triage debug 25/8, Codex DBG-05): pausedAt e pausedTot possono
        // essere leciti UNO PER UNO e insieme dire piu' pausa di quanta durata esista — misuraNetta
        // avrebbe scritto 0 s in silenzio via Math.max. Come sopra: meglio perdere la pausa (il
        // tempo torna pieno, visibile) che scrivere un dato falso.
        if (s.pausedAt !== undefined && s.pausedTot !== undefined && typeof s.t0 === 'number'
          && s.pausedTot + Math.max(0, Date.now() - s.pausedAt) > Math.max(0, Date.now() - s.t0)) { delete s.pausedAt; delete s.pausedTot; }
        if (s.phase !== null && s.phase !== undefined && !['box', 'attesa'].includes(s.phase)) delete m.measure;
      }
    }
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
      // La geometria del foglio (x, y, w, h, z) non è mai «assente per scelta»: newElement la scrive
      // sempre e ogni lettura (center, anchor, le sort dell'ordine del flusso) la usa come numero.
      // Da un file può arrivare altro — una parola, un null, un infinito — e quel valore usciva dalle
      // formule come NaN o come concatenazione («abcNaN»): la freccia diventava d="MNaN…" e l'elemento
      // spariva dal disegno senza alcun errore (debug numeric-props-unsanitized, 2026-08-22). A
      // differenza dei testi, qui l'assente non ha un significato suo: si rimette in riga col valore
      // di casa — TYPES per le misure, zero per la posizione — come già fanno i capi staccati e i
      // punti della matita. Una coordinata negativa invece è legittima (pan e zoom): si tiene.
      if (!V.isConnector(el)) {
        const T = V.TYPES[el.type], g = (v, dif) => { const n = num(v); return (n != null && n > 0) ? n : dif; };
        el.x = num(el.x) ?? 0;
        el.y = num(el.y) ?? 0;
        el.z = num(el.z) ?? 0;
        el.w = g(el.w, T.w);
        el.h = g(el.h, T.h);
      }
      if (V.isConnector(el)) {
        ['from', 'to'].forEach(k => {
          const end = (el[k] && typeof el[k] === 'object') ? el[k] : {};
          if (end.el != null) { const t = ref(end.el); if (live.has(t)) end.el = t; else delete end.el; }
          // Un capo senza elemento sta dove dice il suo punto: anche quelle coordinate devono essere
          // numeri, oppure pf/pt in connPath diventano NaN e la freccia muore lì. Prima la cura
          // toccava solo il capo di un elemento SPARITO; quello nato staccato dal file passava intatto.
          if (end.el == null) { end.x = num(end.x) ?? 0; end.y = num(end.y) ?? 0; }
          el[k] = end;
        });
        // Le pieghe fatte a mano (via) sono punti del percorso: da un file può arrivare qualunque cosa
        // al posto di una coppia di coordinate — e un punto null faceva morire connPath con un
        // TypeError, gli altri finivano nel d come «MNaN…». Vale come per times: restano i punti veri;
        // se non ne resta nessuno la freccia torna dritta, che è il ripiego previsto.
        if (p.via != null) {
          const v = (Array.isArray(p.via) ? p.via : [])
            .map(pt => (pt && typeof pt === 'object') ? { x: num(pt.x), y: num(pt.y) } : null)
            .filter(pt => pt && pt.x != null && pt.y != null);
          if (v.length) p.via = v; else delete p.via;
        }
        // L'offset distribuisce le vie sul bordo del bersaglio e sceglie dove sta l'etichetta
        // ((offset % 3) - 1): un valore che non sia un intero >= 0 rendeva quel conto NaN e il punto
        // medio della via usciva dal disegno. Fuori posto si cancella: ogni lettura ha già il || 0.
        if (p.offset != null) { const off = num(p.offset); if (off != null && off >= 0) p.offset = Math.round(off); else delete p.offset; }
        // Il punto dell'icona lungo la freccia vive fra 0.08 e 0.92 — è nearestT a scriverlo così:
        // fuori intervallo, o non-numero, non è una posizione che l'app abbia mai messo. Stessa clip,
        // perché il contratto è uno solo.
        if (p.t != null) { const tt = num(p.t); if (tt == null) delete p.t; else p.t = Math.min(0.92, Math.max(0.08, tt)); }
      }
      PROPS_TESTO.forEach(k => testo(p, k));
      // le attivita' sono righe da leggere una sotto l'altra: una lista, sempre, e di testo
      if (p.activities != null) p.activities = Array.isArray(p.activities) ? p.activities.map(x => String(x ?? '')) : [];
      // un aggancio che punta nel vuoto lascia l'elemento dov'e' disegnato, invece di mandarlo all'origine
      ['attachedTo', 'lockTo'].forEach(k => { if (p[k] != null) { const t = ref(p[k]); if (live.has(t) && t !== el.id) p[k] = t; else delete p[k]; } });
      // lockT dice «a che punto della freccia sono legato», e l'app lo scrive sempre clampato fra
      // 0.08 e 0.92 (nearestT): un valore arrivato da fuori mandava bez(lockT) in NaN e l'elemento
      // legato spariva. Stesso contratto: numero si ricalpea nell'intervallo, altrimenti si toglie
      // (chi legge ha già il ripiego a metà freccia).
      if (p.lockT != null) { const lt = num(p.lockT); if (lt == null) delete p.lockT; else p.lockT = Math.min(0.92, Math.max(0.08, lt)); }
      // Gli scostamenti di chi è legato si SOMMANO alle coordinate dell'aggancio: un dx che è testo
      // trasformava la somma in una concatenazione («123abc» nell'attributo del disegno), non solo in
      // NaN. Numero finito o niente: le letture hanno tutte il || 0.
      ['dx', 'dy'].forEach(k => { if (p[k] != null) { const n2 = num(p[k]); if (n2 == null) delete p[k]; else p[k] = n2; } });
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
      // Il corpo del testo moltiplica larghezze e interlinea (textLines/elSize): «grosso» al posto di
      // 14 rendeva NaN ogni misura della nota. Solo un numero positivo è un corpo; fuori, via — le
      // letture ricadono sui 12 di casa.
      if (p.size != null) { const s = num(p.size); if (s != null && s > 0) p.size = s; else delete p.size; }
      // Le misure ricordate della nuvola ridotta al segno tornano in campo alla riapertura: qui
      // «w0 || default» teneva il sporco come se fosse vero. Numero positivo o niente: si riparte
      // dalla misura di casa.
      ['w0', 'h0'].forEach(k => { if (p[k] != null) { const n3 = num(p[k]); if (n3 != null && n3 > 0) p[k] = n3; else delete p[k]; } });
      // le osservazioni del cronometro (props.times non esiste piu' dopo la migrazione, V.migrate):
      // si parte dall'oggetto ORIGINALE e si correggono i soli campi noti, come sopra — le chiavi che
      // non conosciamo (una beta piu' nuova) sopravvivono (regola A5, rilievo di entrambi i revisori).
      // s: numero vero in secondi, mai negativo, obbligatorio (senza, l'osservazione non e' un tempo);
      // at: numero (Date.now()) o null (data sconosciuta, le migrate dalla 0.9); giro: stringa o null;
      // cls: elenco dichiarato, fuori elenco torna 'normale'.
      if (p.obs !== undefined) {
        const o = (Array.isArray(p.obs) ? p.obs : []).map(x => {
          if (!x || typeof x !== 'object') return null;
          const s = num(x.s); if (s == null || s < 0) return null;
          x.s = s;
          x.at = (typeof x.at === 'number' && isFinite(x.at)) ? x.at : null;
          x.giro = (typeof x.giro === 'string') ? x.giro : null;
          x.cls = ['normale', 'particolare', 'eccezionale'].includes(x.cls) ? x.cls : 'normale';
          if (x.nota !== undefined && (typeof x.nota !== 'string' || !x.nota)) delete x.nota;
          // il turno del giro (F1): testo libero come la nota — non-stringa o vuoto, via
          if (x.turno !== undefined && (typeof x.turno !== 'string' || !x.turno)) delete x.turno;
          return x;
        }).filter(Boolean);
        if (o.length) p.obs = o; else delete p.obs;
      }
      if (p.override && typeof p.override === 'object') {
        const o = {};
        if (okInk(p.override.stroke)) o.stroke = p.override.stroke;
        if (V.INK_DASHES.some(d => d.id && d.id === p.override.dash)) o.dash = p.override.dash;
        const w = okWidth(p.override.width, null); if (w != null) o.width = w;
        if (Object.keys(o).length) p.override = o; else delete p.override;
      }
      // I booleani del tipo (la ✓ del passo validato, il segno ridotto, l'A3, l'«oppure» di una
      // freccia, il richiedente): un file puo' far arrivare un 1, una stringa o un oggetto al posto
      // di true/false, e chi legge (`if (el.props.validated)`) tratterebbe qualunque valore troncato
      // come vero. Si torna al default dichiarato dal tipo — che e' sempre un booleano, mai altro.
      ['validated', 'collapsed', 'a3', 'or', 'requestor'].forEach(k => {
        if (p[k] !== undefined && typeof p[k] !== 'boolean') { const dif = V.TYPES[el.type].props[k]; if (typeof dif === 'boolean') p[k] = dif; else delete p[k]; }
      });
      if (p.pinned !== undefined && typeof p.pinned !== 'boolean') delete p.pinned;
    });
    // Il CALDERONE parla per id di elementi (C11 del triage debug 25/8, Codex DBG-03): se il
    // sanitize li ha rinominati, le chiavi di obs/dati/nomi li seguono — un archivio che punta a
    // id morti non si puo' piu' leggere ne' consultare. Solo le chiavi rimappate si toccano; il
    // resto della voce (comprese chiavi sconosciute, regola A5) passa intatto.
    if (remap.size && Array.isArray(m.calderone)) {
      m.calderone.forEach(voce => {
        if (!voce || typeof voce !== 'object') return;
        ['obs', 'dati', 'nomi'].forEach(k => {
          const o = voce[k];
          if (!o || typeof o !== 'object' || Array.isArray(o)) return;
          Object.keys(o).forEach(chiave => { if (remap.has(chiave)) { o[remap.get(chiave)] = o[chiave]; delete o[chiave]; } });
        });
      });
    }
    // Anelli di legami: due elementi legati l'uno all'altro si disegnerebbero a vicenda senza fine.
    // Il legame che chiude l'anello viene sciolto, l'elemento resta dov'e' disegnato.
    // Fra i «genitori» contano anche i CAPI di una freccia: una freccia sta dove la mettono gli
    // elementi che collega. Senza questo, legare un elemento alla freccia che ARRIVA su di lui
    // chiudeva un anello che la guardia non vedeva — e il disegno si contraddiceva: la freccia
    // finiva nel vuoto e l'elemento pendeva di lato appeso alla catenella (video di Gt, 2026-08-21).
    // L'attesa appesa a una freccia (attachedTo) non e' un anello: l'attesa non e' un capo.
    // L'indice una tantum al posto del find lineare: la risalita dei genitori interroga trova()
    // a ogni passo della catena, e il find lineare rendeva l'igiene cubica sui fogli fitti
    // (misurato: ~14 s su una catena di 2000 legami). La risposta non cambia: gli id qui dentro
    // non cambiano più, la cura degli anelli sotto si limita a sciogliere props.
    const indiceEl = new Map(m.elements.map(x => [x.id, x]));
    const trova = (id) => indiceEl.get(id);
    const genitori = (el) => (V.isConnector(el)
      ? [el.from && el.from.el, el.to && el.to.el]
      : [el.props.lockTo || (el.type === 'delta' ? el.props.attachedTo : null)]).filter(Boolean);
    // La risalita dei genitori va per pila esplicita, non per ricorsione: su una catena di legami
    // di qualche migliaio di elementi lo stack finiva e sanitizeMap moriva di RangeError mentre
    // il foglio si apriva — lo stesso difetto già curato in flowOrder (R4, debug del 2026-08-21).
    // Qui non c'è un ordine di visita da preservare (a differenza delle corsie della timeline, la
    // risposta è un sì/no: «questo elemento dipende da sé stesso attraverso i genitori?»), quindi
    // i rami si possono consumare in qualsiasi ordine. Il `visti` di partenza non cambia:
    // new Set([el.id]), perché l'anello da vedere è quello che rientra nell'elemento chiesto.
    const dipendeDa = (id, el, visti) => {
      const pila = [el];
      while (pila.length) {
        const cur = pila.pop();
        if (!cur || visti.has(cur.id)) continue;
        visti.add(cur.id);
        const gs = genitori(cur);
        for (let i = 0; i < gs.length; i++) {
          if (gs[i] === id) return true;
          const nodo = trova(gs[i]);
          if (nodo && !visti.has(nodo.id)) pila.push(nodo);
        }
      }
      return false;
    };
    // Doppia pelatura (obiettivo H: dipendeDa su 3000 legami ≤ 1/8 di prima): la risalita per elemento
    // resta — è lei che decide, in sequenza, quale legame si scioglie — ma la si paga SOLO per chi può
    // stare su un anello. Un elemento senza genitori non sta su un anello; toltolo, chi restava
    // aggrappato solo a lui nemmeno: si pela via a strati (Kahn), come i gradi entranti di
    // stepNumbers. Quel che sopravvive è un SOPRAINSIEME dei possibili anelli — nel caso patologico
    // (nessuno si pela) si degrada al comportamento di oggi, tutti sospetti.
    const gradi = new Map(m.elements.map(el => [el.id, 0]));       // quanti genitori vivi ho
    const figliDi = new Map();                                      // chi mi ha come genitore
    m.elements.forEach(el => genitori(el).forEach(g => {
      if (!gradi.has(g)) return;
      gradi.set(el.id, (gradi.get(el.id) || 0) + 1);
      if (!figliDi.has(g)) figliDi.set(g, []);
      figliDi.get(g).push(el.id);
    }));
    const coda = m.elements.filter(el => !gradi.get(el.id)).map(el => el.id);
    for (let i = 0; i < coda.length; i++) {
      (figliDi.get(coda[i]) || []).forEach(f => { const g = gradi.get(f) - 1; gradi.set(f, g); if (!g) coda.push(f); });
    }
    const sospetti = new Set(m.elements.filter(el => gradi.get(el.id) > 0).map(el => el.id));
    m.elements.forEach(el => {
      const p = el.props.lockTo || (el.type === 'delta' ? el.props.attachedTo : null);
      if (!p || !sospetti.has(el.id)) return;
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
    // fase (spec fondamenta A1): dove sta il foglio nel prima-e-poi del libro. Il registro dei
    // livelli (js/layers.js, Task 5) sostituisce map.overlays: la spunta del riepilogo vive in
    // map.layers.riepilogo, e V.layers.active(map) la legge insieme alla fase. Nessun ponte qui:
    // model.js si carica prima di layers.js (ordine del manifest), i lettori sono nei moduli di
    // disegno/pannelli, che si caricano dopo.
    guidePhase: 0, view: null, phase: 'disegna', layers: { riepilogo: true }, paper: clone(V.PAPER), links: { mode: 'dritta' }, created: Date.now(), updated: Date.now(), rev: 0
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
  V.doc = { version: 3, activeMapId: null, activeProjectId: null, projects: {}, maps: {} };
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

  /** Indice del foglio, memo per map.rev (A7): byId, genitori/figli dei legami e dei capi,
   *  frecce di flusso in uscita per passo. Chi scrive il modello passa da commit/undo/redo
   *  (o fa bump da sé: censimento in testa a interact.js), quindi l'indice si rifà da solo.
   *  Il trascinamento in corso NON alza rev: lì le posizioni si rileggono dagli elementi,
   *  mai dall'indice. */
  const IX = new WeakMap();
  V.index = (map) => {
    const hit = IX.get(map);
    if (hit && hit.rev === (map.rev | 0)) return hit.ix;
    const byId = new Map(), parents = new Map(), children = new Map(), flows = new Map();
    map.elements.forEach(el => byId.set(el.id, el));
    map.elements.forEach(el => {
      let gs;
      if (V.isConnector(el)) {
        gs = [el.from && el.from.el, el.to && el.to.el].filter(Boolean);
        if (el.type === 'flow' && el.from.el && el.to.el) {
          if (!flows.has(el.from.el)) flows.set(el.from.el, []);
          flows.get(el.from.el).push(el);
        }
      } else gs = [el.props.lockTo || (el.type === 'delta' ? el.props.attachedTo : null)].filter(Boolean);
      parents.set(el.id, gs);
      gs.forEach(g => { if (!children.has(g)) children.set(g, []); children.get(g).push(el.id); });
    });
    const ix = { byId, parents, children, flows };
    IX.set(map, { rev: map.rev | 0, ix });
    return ix;
  };

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

  // ---------- fase del foglio (spec fondamenta A1): dove sta nel prima-e-poi del libro ----------
  // «Disegna» e «cammina» erano la stessa cosa alla prova (esito stazione 2, 25/8): fuse in una
  // sola fase 'disegna' con l'etichetta «Disegna e controlla». I documenti vecchi con phase
  // 'cammina' atterrano su 'disegna' da soli: sanitizeMap riporta a 'disegna' ogni fase fuori da
  // PHASE_ORDER (riga piu' sotto), quindi la fusione e' anche la migrazione.
  V.PHASE_ORDER = ['disegna', 'valida', 'misura', 'analizza'];
  V.PHASE_LABEL = { disegna: 'Disegna e controlla', valida: 'Valida', misura: 'Misura', analizza: 'Analizza' };
  /** Che cosa vuol dire ciascuna fase e che cosa si può fare (Parte I §1 della spec): il selettore in
   *  testata e il cronometro chiuso fuori fase la usano per dire il perché con la frase del libro. */
  V.PHASE_HINT = {
    disegna: 'costruisci il flusso e lo controlli sul campo, dal vero, col foglio in mano: tutto, tranne il cronometro',
    valida: 'lo staff guarda il foglio: testi, note, colori e spostare i box per leggere meglio. Non si aggiungono né si tolgono passi, frecce o vie',
    misura: 'il flusso è validato, si cronometra: cronometro, note e spostamenti per leggere meglio. Niente altro',
    analizza: 'come Misura, più i livelli di analisi'
  };
  /** I due blocchi del lavoro (prova iPad 25/8): dentro un blocco ci si muove, fra i blocchi c'è
   *  una porta. Il selettore in testata li disegna così, e la Guida li racconta con queste frasi. */
  V.PHASE_GROUPS = [
    { t: '1 · Pianificazione', s: 'il flusso si costruisce e si controlla sul campo, poi si fa validare: qui ti muovi avanti e indietro liberamente', fasi: ['disegna', 'valida'] },
    { t: '2 · Misura e analisi', s: 'il flusso è validato e fermo: si cronometra e si analizza. Per ridisegnare serve un nuovo giro', fasi: ['misura', 'analizza'] }
  ];
  /** Transizioni ammesse (A1, rivista due volte dalla prova iPad del 25/8): nella pianificazione
   *  (disegna ⇄ valida) si va e si viene liberamente — un tocco sbagliato non deve bloccare
   *  nessuno. Misura è la PORTA a senso unico: la si raggiunge solo da valida, e da
   *  misura/analizza non si torna alla pianificazione: serve un nuovo giro (il foglio misurato
   *  non si ridisegna — decisione di Gt del 22 agosto, che resta; la via d'emergenza è
   *  V.unvalidate, il calderone). Misura ⇄ Analizza vanno e vengono. */
  const FASE_AVANTI = {
    disegna: ['valida'],
    valida: ['disegna', 'misura'],
    misura: ['analizza'],
    analizza: ['misura']
  };
  /** Verifica pura (non scrive nulla): usata da V.setPhase e dal selettore in testata per sapere,
   *  senza tentare, se un tocco su una fase sarebbe accolto. */
  V.canSetPhase = (map, fase) => {
    if (!map) return { ok: false, reason: 'fase' };
    // A1: il lucchetto blocca tutto, fase compresa — ma e' il lucchetto dell'IDEALE (kind:'future').
    // La cura VERA e' alla fonte (sanitizeMap, model.js:~190: validated===true su un non-future
    // torna false a ogni ingresso, cosi' anche i nove lettori fuori da questa porta — interact.js,
    // panels.js, popover.js — vedono lo stesso dato corretto). Questo controllo su kind e' una
    // SECONDA difesa (round 2 della revisione avversariale, Task 7): da solo NON basta a sbloccare
    // lo schermo (il pannello resta disabilitato leggendo map.validated a parte), ma copre un
    // documento gia' in memoria che un bug futuro sporcasse dopo l'ultimo sanitize.
    if (map.validated && map.kind === 'future') return { ok: false, reason: 'ideale' };
    if (!V.PHASE_ORDER.includes(fase)) return { ok: false, reason: 'fase' };
    const cur = map.phase || 'disegna';
    if (cur === fase) return { ok: false, reason: 'fase' };
    if ((cur === 'misura' || cur === 'analizza') && ['disegna', 'valida'].includes(fase)) return { ok: false, reason: 'nuovo-giro' };
    return (FASE_AVANTI[cur] || []).includes(fase) ? { ok: true } : { ok: false, reason: 'fase' };
  };
  V.setPhase = (map, fase) => {
    const g = V.canSetPhase(map, fase);
    if (!g.ok) return g;
    map.phase = fase; map.updated = Date.now(); bump(map); V.save();
    emit({ label: 'fase', mapId: map.id, ops: [] });
    return { ok: true };
  };
  /** SVALIDARE un foglio — la via d'emergenza (esito stazione 2, 25/8; dal 25/8 sera la UI e' il
   *  bottone nascosto in «avanzate» del selettore fasi). La porta di Misura resta a senso unico per il metodo,
   *  ma «in extremis» si può tornare in pianificazione: le osservazioni raccolte NON si buttano
   *  e NON restano in uso — finiscono nel CALDERONE del foglio (map.calderone, un archivio per
   *  giro di misura), rievocabili ma fuori da statistiche, badge e livelli. La sessione di
   *  cronometro in corso muore. Torna { ok:false, reason:'fase' } fuori da misura/analizza. */
  V.unvalidate = (map) => {
    const cur = map.phase || 'disegna';
    if (cur !== 'misura' && cur !== 'analizza') return { ok: false, reason: 'fase' };
    // Nel calderone finisce TUTTO cio' che il giro aveva prodotto o che parlava dei suoi tempi
    // (C1 del triage debug 25/8, Codex DBG-01 ≡ Grok #5, decisione Gt 26/8): non solo le obs —
    // anche Hi/Lo/Avg scritti sui passi e sulle attese (calcolati O a mano: svalidare vuol dire
    // che il disegno era proprio sbagliato) e il ripiego map.samples, che altrimenti riaffiorava
    // nel riepilogo e nel lint appena numMisure tornava 0. Il foglio torna pulito; la storia
    // resta consultabile: ogni voce porta anche il CONTESTO (tipo e nome dell'elemento), perche'
    // un archivio di soli id non si puo' leggere (C11).
    const obs = {}, dati = {}, nomi = {};
    const pieno = (v) => v !== undefined && v !== null && String(v).trim() !== '';
    map.elements.forEach(el => {
      const p = el.props || {};
      const conObs = Array.isArray(p.obs) && p.obs.length;
      const conDati = (el.type === 'box' || el.type === 'delta') && (pieno(p.hi) || pieno(p.lo) || pieno(p.avg));
      if (!conObs && !conDati) return;
      if (conObs) { obs[el.id] = p.obs; p.obs = []; }
      if (conDati) { dati[el.id] = { hi: p.hi, lo: p.lo, avg: p.avg }; p.hi = ''; p.lo = ''; p.avg = ''; }
      nomi[el.id] = { tipo: el.type, nome: String(p.title || p.note || p.text || '').trim() };
    });
    if (!Array.isArray(map.calderone)) map.calderone = [];
    const voce = { at: Date.now(), da: cur, obs };
    if (Object.keys(dati).length) voce.dati = dati;
    if (Object.keys(nomi).length) voce.nomi = nomi;
    if (pieno(map.samples)) { voce.samples = map.samples; map.samples = ''; }
    map.calderone.push(voce);
    if (map.measure) delete map.measure;
    map.phase = 'valida'; map.updated = Date.now(); bump(map); V.save();
    emit({ label: 'svalida', mapId: map.id, ops: [] });
    return { ok: true, archiviate: Object.keys(obs).length, elementi: Object.keys(nomi).length };
  };

  // ---------- V.allowed: la porta unica dei permessi (A2) ----------
  /** Ogni tipo di elemento porta la sua classe per add/remove. «delta» è struttura, non contenuto:
   *  è un anello della catena del flusso (buco della tabella iniziale, pescato dalla prova di
   *  completezza — interpretazione 4 del piano di fase 0). */
  const TIPO_CLASSE = { box: 'struttura', flow: 'struttura', request: 'struttura', lane: 'struttura',
    person: 'struttura', inventory: 'struttura', inbox: 'struttura', distance: 'struttura',
    delta: 'struttura',
    storm: 'contenuto', fluffy: 'contenuto', burst: 'contenuto', text: 'contenuto',
    icon: 'contenuto', face: 'contenuto', legend: 'contenuto' };
  // chiavi di props che sono annotazione su OGNI tipo: toccano l'aspetto o la lettura, mai il flusso
  const ANNOT_UNIVERSALI = ['tint', 'pinned', 'collapsed', 'shape', 'summary'];
  // testo libero che su questi quattro tipi resta annotazione (un post-it), non contenuto del passo
  const ANNOT_TESTO_TIPI = ['storm', 'fluffy', 'burst', 'text'];
  // 'or' e' solo di flow (V.TYPES.flow.props): dichiarare o togliere un ramo alternativo di flusso
  // cambia il flusso stesso, non e' un dettaglio di lettura — struttura, come from/to (interp. 4,
  // rilievo della revisione: la casella "or" del pannello (panels.js) restava toccabile in Valida).
  const STRUTTURA_PROPS = ['lockTo', 'attachedTo', 'link', 'or'];
  const POSIZIONE_PROPS = ['dx', 'dy', 'via', 'offset', 't'];
  /** classeProp(type, key): la classe di UNA chiave di props, per l'elemento di quel tipo. Ripiego
   *  dichiarato «contenuto» — REGOLA, non omissione (rilievo della revisione): una chiave non
   *  altrimenti classificata è comunque un campo del passo o dell'elemento, non una posizione né
   *  un'osservazione, quindi si comporta come il resto del contenuto. */
  const classeProp = (type, key) => {
    if (key === 'obs') return 'osservazioni';
    if (ANNOT_UNIVERSALI.includes(key)) return 'annotazioni';
    if (ANNOT_TESTO_TIPI.includes(type) && ['text', 'note', 'summary'].includes(key)) return 'annotazioni';
    if (STRUTTURA_PROPS.includes(key)) return 'struttura';
    if (POSIZIONE_PROPS.includes(key)) return 'posizione';
    return 'contenuto';
  };
  /** Campo del FOGLIO (op 'meta'): ripiego «annotazioni» — i campi dell'intestazione, dello scopo,
   *  della validazione, del piano… si scrivono in ogni fase (tabella A2). measure e layers sono le
   *  due eccezioni dichiarate. */
  const CAMPO_FOGLIO_ECCEZIONI = { measure: 'osservazioni', layers: 'livelli' };
  const campoFoglio = (key) => CAMPO_FOGLIO_ECCEZIONI[key] || 'annotazioni';
  /** Ordine di restrizione: riduce più chiavi di classi diverse toccate in UNA op a una sola classe
   *  rappresentativa, quella che decide (se lei non passa la fase, l'intera op si ferma comunque).
   *  struttura (disegna,cammina) ⊂ contenuto (disegna,cammina,valida) ⊂ annotazioni/posizione
   *  (sempre): è un'inclusione vera. osservazioni/livelli vivono su un asse loro (tardi, non presto)
   *  e nelle op vere dell'app non si mescolano mai con struttura/contenuto nella stessa op. */
  const RANGO = { struttura: 0, contenuto: 1, osservazioni: 2, livelli: 2, inchiostro: 2, annotazioni: 3, posizione: 3 };
  const piuStretta = (a, b) => { if (a == null) return b; if (b == null) return a; return (RANGO[a] ?? 9) <= (RANGO[b] ?? 9) ? a : b; };
  /** La classe di un'operazione (per la porta unica e per i pannelli): null quando la chiave non è
   *  dichiarata in nessuna classe — la porta la rifiuta (reason 'fase'), e la prova di completezza la
   *  pesca sugli add/remove di ogni tipo. */
  V.classOfOp = (op, map) => {
    if (!op || !op.t) return null;
    if (op.t === 'add' || op.t === 'remove') return TIPO_CLASSE[op.el && op.el.type] || null;
    if (op.t === 'update') {
      const ks = Object.keys(op.after || {});
      if (ks.includes('type') || ks.includes('from') || ks.includes('to')) return 'struttura';   // conversione e capi
      return ks.every(k => ['x', 'y', 'z', 'w', 'h', 'props'].includes(k) && k !== 'props') ? 'posizione'
        : ks.every(k => ['x', 'y', 'z', 'w', 'h'].includes(k)) ? 'posizione' : null;
    }
    if (op.t === 'props') {
      const el = map && V.byId(op.id, map);
      const ks = Object.keys(op.after || {});
      if (!ks.length) return 'annotazioni';
      let cls = null;
      ks.forEach(k => { cls = piuStretta(cls, classeProp(el && el.type, k)); });
      return cls;
    }
    if (op.t === 'meta') {
      const ks = Object.keys(op.after || {});
      if (!ks.length) return 'annotazioni';
      let cls = null;
      ks.forEach(k => { cls = piuStretta(cls, campoFoglio(k)); });
      return cls;
    }
    if (op.t === 'mapfield') return 'struttura';   // adozione/albero: parentId/parentStepId di un'altra mappa
    // la matita e la gomma sono DISEGNO, non annotazione (finding P1 di Codex): in Misura/Analizza
    // il modello le ferma anche se la palette non le mostra — la garanzia sta qui, non nella UI
    if (op.t === 'stroke_add' || op.t === 'stroke_remove' || op.t === 'strokes_set') return 'inchiostro';
    if (op.t === 'plan_set') return 'annotazioni';
    return null;
  };
  const AMMESSE = {
    disegna: ['struttura', 'contenuto', 'annotazioni', 'posizione', 'inchiostro'],
    valida: ['contenuto', 'annotazioni', 'posizione', 'inchiostro'],
    // REVOCA del 22/8 (esito stazione 3, 25/8): in Misura/Analizza il flusso e' FERMO — niente
    // 'posizione' generica ne' 'contenuto' generico. Il ramo MISURA_LIBERI in V.allowed apre
    // entrambe le classi ai soli tipi-annotazione (nuvole, note, icone, facce): si aggiungono,
    // si scrivono e si spostano anche misurando.
    misura: ['annotazioni', 'osservazioni'],
    analizza: ['annotazioni', 'osservazioni']
  };
  const MISURA_LIBERI = ['storm', 'fluffy', 'burst', 'text', 'icon', 'face'];
  V.MISURA_LIBERI = MISURA_LIBERI;   // la leggono interact (drag) e panels (palette di misura)
  /** Registro minimo dei livelli (spec B: arriva con js/layers.js al Task 5). Oggi c'è solo il
   *  riepilogo, sempre acceso (phaseMin null = nessun requisito di fase). La chiave è quella di
   *  map.layers; L.register scriverà qui — o sostituirà questo oggetto — la soglia vera di ogni
   *  livello quando i livelli nasceranno. */
  V.LAYER_PHASE_MIN = { riepilogo: null };
  /** V.allowed: LA porta unica (A2) — la consultano commit, undo, redo, e le vie strutturali fuori
   *  commit (attachUnder, createDetail, buildDetailFromActivities, I.groupToDetail). Dentro ci sono
   *  anche i lucchetti (un chiamante diretto deve avere la risposta intera, non doverli controllare a
   *  parte) e i livelli (soglia di fase per CHIAVE toccata, non per l'intera classe 'livelli': un
   *  livello acceso prima del suo phaseMin non passa, gli altri sì). */
  V.allowed = (op, map, opts = {}) => {
    // Stessa seconda difesa di V.canSetPhase qui sopra (la cura vera e' in sanitizeMap): il
    // lucchetto e' dell'Ideale, non di 'validated' e basta (kind:'future' e' la condizione vera, A1).
    if (map && map.validated && map.kind === 'future') return { ok: false, reason: 'ideale' };
    if (toccaValidato(map, op)) return { ok: false, reason: 'validato' };
    const fase = (map && map.phase) || 'disegna';
    const classe = opts.classe || V.classOfOp(op, map);   // opts.classe: SOLO attesaDi e applyTimes (interp. 6)
    if (!classe) return { ok: false, reason: 'fase' };
    if (classe === 'livelli') {
      const prima = (map && map.layers) || {};
      const dopo = (op.after && op.after.layers) || {};
      const idxFase = V.PHASE_ORDER.indexOf(fase);
      const bloccato = Object.keys(dopo).some(k => {
        if (dopo[k] === prima[k]) return false;              // chiave non toccata davvero da quest'op
        const min = V.LAYER_PHASE_MIN[k];
        return min != null && idxFase < V.PHASE_ORDER.indexOf(min);
      });
      return bloccato ? { ok: false, reason: 'fase' } : { ok: true };
    }
    // In Misura/Analizza le annotazioni restano vive (esito stazione 3): posizione e contenuto
    // passano SOLO se il tipo interessato e' un'annotazione — il flusso (box, frecce, attese,
    // persone, corsie…) resta fermo. opts.classe (attesaDi/applyTimes) non passa di qui.
    if ((fase === 'misura' || fase === 'analizza') && !opts.classe && (classe === 'posizione' || classe === 'contenuto')) {
      const tipo = (op.t === 'add' || op.t === 'remove') ? (op.el && op.el.type) : ((V.byId(op.id, map) || {}).type);
      return MISURA_LIBERI.includes(tipo) ? { ok: true } : { ok: false, reason: 'fase' };
    }
    return (AMMESSE[fase] || []).includes(classe) ? { ok: true } : { ok: false, reason: 'fase' };
  };
  /** Una frase per ciascun «non si può» (A2): i pannelli e il commit generico la mostrano. Le frasi
   *  di 'ideale' e 'validato' sono quelle di sempre — un solo posto le scrive, non compaiono doppie. */
  V.DENIED_MSG = {
    fase: 'In questa fase del foglio questo non si può fare: tocca la fase in alto per saperne di più.',
    validato: 'Passo validato ✓: tocca la ✓ nel suo pannello per riaprirlo.',
    ideale: 'Ideale validato \u{1F512}: apri il lucchetto in alto per modificarlo.',
    'nuovo-giro': 'Da Misura o Analizza non si torna indietro a disegnare: crea un nuovo giro per cambiare il foglio.'
  };

  V.commit = (ops, label = '', opts = {}) => {
    const map = opts.map || V.map(); if (!map) return false;
    // Clonazione alla registrazione (M7): chi chiama continua a tenere in mano l'oggetto che ha
    // passato (op.el, op.after, op.s) e puo' mutarlo dopo il commit — succedeva davvero coi props
    // costruiti al volo dai pop-up. Senza un clone qui, l'annulla e il ripeti avrebbero riletto quella
    // mutazione invece del valore registrato al momento del commit.
    ops = Array.isArray(ops) ? ops : [ops];
    const originali = ops;
    ops = originali.map(op => {
      const c = Object.assign({}, op);
      if (op.el !== undefined) c.el = clone(op.el);
      if (op.after !== undefined) c.after = clone(op.after);
      if (op.s !== undefined) c.s = clone(op.s);
      return c;
    });
    // undefined nel dopo vuol dire «togli la chiave»: il clone JSON la perderebbe (annulla del
    // primo collegamento, applyOp 'props'). Si rimette dov'era.
    ops.forEach((op, i) => {
      const oa = originali[i].after;
      if (op.t === 'props' && oa) Object.keys(oa).forEach(k => { if (oa[k] === undefined) op.after[k] = undefined; });
    });
    // la porta unica (A2): un controllo solo, per ogni op, qui — non più sparso fra lucchetto
    // dell'Ideale e ✓ del passo come prima (un solo posto di guardia per ogni via di scrittura)
    for (const op of ops) {
      const g = V.allowed(op, map, opts);
      if (!g.ok) { const msg = V.DENIED_MSG[g.reason]; if (msg) { V.ui && V.ui.toast && V.ui.toast(msg); } return false; }
    }
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
    bump(map);
    // opts.classe si registra sulla voce: un annulla/ripeti di un artefatto della misura (interp. 6)
    // deve poter passare la STESSA porta con la STESSA classe forzata, non quella naturale dell'op
    // (hi/lo/avg scritti da «Calcola i tempi» sono 'contenuto' per classOfOp, fermo in misura — ma
    // l'artefatto e' passato come 'osservazioni' al commit, e l'annulla deve poterlo rifare).
    if (!opts.silent) { undoStack.push({ mapId: map.id, ops: ops.map(op => invert(op)).reverse(), redo: ops, label, classe: opts.classe }); if (undoStack.length > 200) undoStack.shift(); redoStack.length = 0; }
    V.save();
    emit({ ops, label, mapId: map.id });
    return true;
  };
  // Anche annulla/ripeti passano dalla porta unica (A2): stessa consulta di V.commit, un'op alla
  // volta, sulle op DELL'ENTRY registrata — così un lucchetto (Ideale o ✓ del passo) o una fase che
  // nel frattempo è cambiata (avanti verso Misura, per esempio) fermano l'annulla/ripeti come
  // fermerebbero la stessa scrittura fatta di nuovo. Il pattern lockedEntry di prima si assorbe qui.
  V.undo = () => { let e; while ((e = undoStack.pop())) { const map = V.doc.maps[e.mapId]; if (!map) continue; const bloc = e.ops.map(op => V.allowed(op, map, { classe: e.classe })).find(g => !g.ok); if (bloc) { const msg = V.DENIED_MSG[bloc.reason]; if (msg) V.ui && V.ui.toast && V.ui.toast(msg); undoStack.push(e); return false; } if (V.doc.activeMapId !== e.mapId) V.switchMap(e.mapId); e.ops.forEach(op => applyOp(op, map)); bump(map); redoStack.push(e); V.save(); emit({ undo: true, label: e.label }); return true; } return false; };
  V.redo = () => { let e; while ((e = redoStack.pop())) { const map = V.doc.maps[e.mapId]; if (!map) continue; const bloc = e.redo.map(op => V.allowed(op, map, { classe: e.classe })).find(g => !g.ok); if (bloc) { const msg = V.DENIED_MSG[bloc.reason]; if (msg) V.ui && V.ui.toast && V.ui.toast(msg); redoStack.push(e); return false; } if (V.doc.activeMapId !== e.mapId) V.switchMap(e.mapId); e.redo.forEach(op => applyOp(op, map)); bump(map); undoStack.push(e); V.save(); emit({ redo: true, label: e.label }); return true; } return false; };
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
    // Le figlie dirette NON si disperdono (rilievi R4/R5 del brute force, 25/8: prima repairDoc
    // azzerava il loro parentId e l'albero costruito si dissolveva in silenzio). In ordine:
    // 1) se un'altra mappa della catena (giro erede, altri giri, l'Ideale) ha ANCORA il passo che
    //    le conteneva — gli id degli elementi sono clonati fra i giri — si riappendono lì;
    // 2) altrimenti salgono al padre della mappa eliminata (senza passo: l'indirizzo resta suo,
    //    per lettera — v. trattoDi);
    // 3) senza un padre restano di primo livello, ma con un indirizzo che le distingue.
    // con withPair muoiono in DUE: anche le figlie dell'Ideale vanno riappese (C7 del triage
    // debug 25/8, Codex DBG-04 — prima solo quelle dell'Attuale, e il cleanup qui sotto azzerava
    // i parentId delle altre in silenzio)
    const morte = [id].concat(opts.withPair && ideal ? [ideal.id] : []);
    const figlie = Object.values(V.doc.maps).filter(o => morte.includes(o.parentId) && !morte.includes(o.id));
    const candidate = [heir].concat(rest, ideal ? [ideal] : []).filter(Boolean).filter(x => !morte.includes(x.id));
    figlie.forEach(f => {
      let nuovoPar = null, nuovoStep = null;
      if (f.parentStepId) { const cand = candidate.find(x => (x.elements || []).some(e => e.id === f.parentStepId && e.type === 'box')); if (cand) { nuovoPar = cand.id; nuovoStep = f.parentStepId; } }
      // senza un passo superstite si sale: prima al padre della PROPRIA madre (l'Ideale ha il
      // suo), poi a quello dell'Attuale — mai un genitore che sta anch'esso morendo
      if (!nuovoPar) {
        const madre = (f.parentId === id) ? m : ideal;
        const su = [madre && madre.parentId, m.parentId].find(x => x && !morte.includes(x) && V.doc.maps[x]);
        if (su) nuovoPar = su;
      }
      f.parentId = nuovoPar; f.parentStepId = nuovoStep; bump(f);
    });
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
    // Per pila esplicita, non per ricorsione: una catena di qualche migliaio di giri mandava in
    // RangeError lo stack (lo stesso difetto gia' curato in flowOrder e sanitizeMap/dipendeDa).
    // Stesso filtro e stesso ordine di visita del vecchio `walk` ricorsivo: i figli si spingono al
    // contrario, cosi' la pila (LIFO) li ripesca nell'ordine in cui li avrebbe visitati la ricorsione.
    const out = []; const pila = [m];
    while (pila.length) {
      const x = pila.pop(); if (out.includes(x)) continue; out.push(x);
      const figli = Object.values(V.doc.maps).filter(y => y.verOf === x.id && y.kind === 'current');
      for (let i = figli.length - 1; i >= 0; i--) pila.push(figli[i]);
    }
    return out;
  };
  /** l'Ideale e' UNO per catena di giri: si cerca su tutta la catena, non solo sulla mappa attiva */
  V.idealOf = (map) => {
    if (!map) return null; if (map.kind === 'future') return map;
    for (const m of V.versionsOf(map)) { const f = m.pairId && V.doc.maps[m.pairId]; if (f && f.kind === 'future') return f; }
    return null;
  };
  V.futureOf = (map) => V.idealOf(map);
  /** Le osservazioni ereditate da un clone (createVersion, createFuture) che non portano un giro
   *  proprio sono quelle migrate dalla 0.9 (V.migrate le scrive con giro:null): SOLO quelle prendono
   *  l'id della mappa di partenza (interpretazione 7). Le altre tengono il giro vero in cui furono
   *  prese — e' la storia che si vuole vedere, non va riscritta. */
  const stampGiro = (elements, curId) => elements.forEach(el => { if (el.props && Array.isArray(el.props.obs)) el.props.obs.forEach(o => { if (o && o.giro == null) o.giro = curId; }); });
  /** nuovo giro dell'attuale: copia della mappa attiva, stesso Ideale, nome proposto dal numero del giro */
  V.createVersion = (cur) => {
    const chain = V.versionsOf(cur); const n = chain.length + 1;
    const names = [null, null, 'secondo giro', 'terzo giro', 'quarto giro', 'quinto giro', 'sesto giro'];
    // pairId e updated NON si copiano: il legame con l'Ideale appartiene alla catena (lo rimette a posto
    // repairDoc sull'ultimo giro), e una data ereditata dal padre faceva comparire il giro nuovo in fondo
    // all'elenco delle mappe, con la data di quello vecchio. rev riparte da 0: e' un foglio nuovo, la
    // sua storia di scritture non e' quella del padre.
    // phase: 'disegna' — un giro nuovo nasce da disegnare (A1/A3), anche se il giro da cui viene
    // era in Misura o Analizza: senza questa riga il clone(cur) portava dietro la fase vecchia.
    const f = V.newMap(Object.assign(clone(cur), { id: uid(), kind: 'current', verOf: cur.id, verName: names[n] || (n + 'º giro'), validated: false, pairId: null, phase: 'disegna', tint: Math.floor(Math.random() * 360), created: Date.now(), updated: Date.now(), rev: 0 }));
    f.elements = clone(cur.elements); f.strokes = clone(cur.strokes); f.plan = clone(cur.plan);
    stampGiro(f.elements, cur.id);
    delete f.measure;   // il giro del cronometro appartiene al foglio su cui e' partito (M8.4)
    V.addMap(f); V.repairDoc(); V.save(); return f;
  };
  V.createFuture = (cur) => {
    // il kind si controlla PRIMA di idealOf (A3 letterale): solo un Attuale puo' avere un Ideale
    if (!cur || cur.kind !== 'current') return null;
    const have = V.idealOf(cur); if (have) return have;
    // l'Ideale nasce in disegna (A1), a prescindere dalla fase dell'Attuale da cui è copiato
    const f = V.newMap(Object.assign(clone(cur), { id: uid(), kind: 'future', pairId: cur.id, verOf: null, verName: 'ideale', validated: false, phase: 'disegna', tint: Math.floor(Math.random() * 360), title: cur.title, validation: V.newMap().validation, created: Date.now(), rev: 0 }));
    f.elements = clone(cur.elements); f.strokes = []; f.plan = clone(cur.plan);
    stampGiro(f.elements, cur.id);
    delete f.measure;   // il giro del cronometro appartiene al foglio su cui e' partito (M8.4)
    V.addMap(f); cur.pairId = f.id; V.save(); return f;
  };
  /** lucchetto dell'Ideale: non passa da commit (che a lucchetto chiuso rifiuta tutto). Solo
   *  kind:'future' lo puo' accendere (A1) — l'interfaccia di sblocco vive SOLO sull'Ideale, quindi
   *  un current/detail acceso per errore non avrebbe modo di riaprirsi da schermo (rilievo
   *  confermato dalla revisione avversariale del Task 7, round 2). La cura VERA di un documento gia'
   *  sporco e' in sanitizeMap (model.js:~190, gira a ogni load/replaceDoc/importMaps): questa e' la
   *  guardia alla SCRITTURA, per non produrne di nuovi in memoria fra un sanitize e l'altro. */
  V.setValidated = (map, on) => { if (on && map && map.kind !== 'future') return; map.validated = !!on; map.updated = Date.now(); bump(map); V.save(); emit({ label: on ? 'validata' : 's-validata', mapId: map.id, ops: [] }); };
  /** la ✓ di un passo: come il lucchetto dell'Ideale non passa da commit — che su un passo validato
   *  rifiuterebbe perfino la modifica che lo riapre. Nessuna voce di annulla: la conferma chiesta
   *  dal pannello è la sua protezione, non ↩. */
  V.setStepValidated = (id, on, map = V.map()) => {
    const el = map && V.byId(id, map); if (!el) return false;
    el.props.validated = !!on; map.updated = Date.now(); bump(map); V.save();
    emit({ label: on ? 'passo validato' : 'passo riaperto', mapId: map.id, ops: [] });
    return true;
  };
  /** etichetta leggibile del tipo di mappa (per testata, elenchi e sfondo del foglio) */
  V.kindLabel = (m) => m.kind === 'future' ? 'ideale' : m.kind === 'detail' ? 'dettaglio' : (m.verName || 'attuale');
  /** Quante volte si è misurato: il massimo delle osservazioni su un singolo elemento. Non si
   *  dichiara a mano (feedback iPad 25/8): il campo dell'intestazione è sparito, il numero nasce
   *  dal cronometro. map.samples resta solo come ripiego per le mappe vecchie che l'avevano scritto. */
  V.numMisure = (map) => Math.max(0, ...(map.elements || []).map(e => (e.props && Array.isArray(e.props.obs)) ? e.props.obs.length : 0));
  /** I PARZIALI per passo (C16 del triage debug 25/8, decisione Gt 26/8): un giro incompleto non
   *  si racconta col massimo («10 misure» quando un passo ne ha 2) — il conteggio si dice passo
   *  per passo. Ordine: la catena del flusso, poi i passi fuori catena. Riepilogo e lint leggono
   *  da qui; il massimo (V.numMisure) resta per i lettori che vogliono solo sapere se si e'
   *  misurato. */
  V.misurePerPasso = (map) => {
    const fo = V.flowOrder(map);
    const inCatena = new Set(fo.order.map(b => b.id));
    const boxes = fo.order.concat((map.elements || []).filter(e => e.type === 'box' && !inCatena.has(e.id)));
    return boxes.map(b => ({
      id: b.id,
      nome: String((b.props && b.props.title) || '').trim() || 'passo senza nome',
      n: (b.props && Array.isArray(b.props.obs)) ? b.props.obs.length : 0
    }));
  };
  /** Il foglio che sta misurando ADESSO (C2 del triage debug 25/8, decisione Gt 26/8: la barra
   *  del giro segue chi misura anche sugli altri fogli — fermare e mettere in pausa si puo'
   *  sempre). Prima il foglio attivo, poi gli altri del documento. */
  V.measureActiveMap = () => {
    const attiva = (m) => { const s = m && m.measure; return !!(m && ['misura', 'analizza'].includes(m.phase) && s && s.phase && s.t0); };
    const cur = V.map();
    if (attiva(cur)) return cur;
    const maps = (V.doc && V.doc.maps) || {};
    for (const id of Object.keys(maps)) if (attiva(maps[id])) return maps[id];
    return null;
  };
  /** Nuovo sotto-foglio. Non basta sapere da quale MAPPA nasce: serve da quale PASSO, perché è il passo
   *  a dargli l'indirizzo (il sotto-foglio del passo 2 è il 2.1, 2.2, …). Senza, la cartina saprebbe
   *  dire «sta sotto questa mappa» ma non «sta sotto questo passo», che è quello che chi mappa cerca. */
  /** Il sotto-foglio nasce con il COLORE del suo passo: il pannello del colore promette «il
   *  sotto-foglio ↗ ripete questo colore come sfondo», e finora la promessa valeva solo se il
   *  colore si sceglieva DOPO aver collegato (V.setTint lo propaga); creando il foglio da un passo
   *  gia' colorato usciva invece la tinta a caso di ogni mappa nuova. Un passo senza colore la
   *  tinta a caso se la tiene: serve a capire a colpo d'occhio su quale foglio si sta lavorando. */
  // La porta unica anche qui (rilievo: la porta non si deve aggirare passando fuori da commit):
  // un sotto-foglio nuovo è struttura, come qualunque add di un passo — un'op sintetica basta a
  // chiederlo a V.allowed, senza bisogno di un elemento vero.
  // il passo del legame dev'essere un BOX: con l'id di un altro elemento (persona, nuvola…) il
  // foglio nasce senza passo — repairDoc riconosce il contenimento solo sui box, e un parentStepId
  // marcio sarebbe stato sciolto in silenzio alla prima riparazione (regola di Gt, 25/8)
  V.createDetail = (parent, title, stepId) => { if (!V.allowed({ t: 'add', el: { type: 'box' } }, parent).ok) return null; const passo = stepId ? V.byId(stepId, parent) : null; const passoBox = passo && passo.type === 'box' ? passo : null; const H = passoBox && passoBox.props ? V.tintHue(passoBox.props.tint) : null; const d = V.newMap(Object.assign({ kind: 'detail', parentId: parent.id, parentStepId: passoBox ? passoBox.id : null, projectId: parent.projectId, title: title || ('Dettaglio di ' + (parent.title || 'mappa')), unit: parent.unit, authors: parent.authors }, H == null ? {} : { tint: H })); V.addMap(d); V.save(); return d; };
  /** Appende un foglio esistente a un passo di un altro foglio: è il «processo 0» — l'intera mappa di
   *  oggi diventa un passo di qualcosa di più grande. Ritorna l'esito invece di annunciare da sé: chi
   *  chiama non deve dire «fatto» prima di aver letto. Si rifiuta quando creerebbe un anello (una
   *  mappa sotto sé stessa non ha un «sopra») o quando attraverserebbe due progetti.
   *  La risalita segna i fogli visti invece di contare i giri: un contatore che si ferma a N direbbe
   *  «va bene» su una catena più lunga di N, ed è lo stesso errore dell'indirizzo che si fermava a 8. */
  V.attachUnder = (map, parentMap, stepId) => {
    if (!map || !parentMap) return { ok: false, reason: 'assente' };
    // porta unica anche fuori da commit (A2): appendere aggiunge un passo (il riassuntivo) SUL
    // PADRE e scrive l'albero (parentId/parentStepId) SULLA FIGLIA — struttura su tutte e due le
    // mappe (rilievo della revisione: un foglio in Misura poteva ancora essere appeso sotto un
    // padre in Disegna, perché solo il padre veniva chiesto).
    const g = V.allowed({ t: 'add', el: { type: 'box' } }, parentMap);
    if (!g.ok) return g;
    const g2 = V.allowed({ t: 'add', el: { type: 'box' } }, map);
    if (!g2.ok) return g2;
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
    bump(map); bump(parentMap);
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
    // stessa guardia di createDetail (che la ripete anche lei: questa funzione la chiama, ma un
    // ritorno null da lì andrebbe letto PRIMA di toccare d.elements sotto)
    if (!V.allowed({ t: 'add', el: { type: 'box' } }, parent).ok) return null;
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
    // scrittura fuori commit sull'array degli elementi (censimento A6, interact.js): d.rev DEVE
    // alzarsi qui, o V.index(d) resterebbe memo su un foglio vuoto per chi lo avesse già letto
    // prima di questa chiamata (a differenza di V.example, che popola una mappa mai ancora indicizzata).
    if (scelti.length) bump(d);
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
    // L'adozione (l'albero scritto sulla mappa) e' dei SOLI passi: un box contiene sottoprocessi
    // (criterio di Gt, prova iPad 25/8 — e il libro: chi scende di livello sono i process box).
    // Ogni altro elemento al massimo RICHIAMA ⇉: senza questa guardia una persona «adottava» la
    // mappa, e repairDoc — che il contenimento lo riconosce solo sui box — scioglieva il legame in
    // silenzio alla prima riparazione: il sotto-foglio sembrava sparire a caso.
    const chi = map && V.byId(boxId, map);
    if (chi && chi.type === 'box' && t && !t.parentId && t.projectId === map.projectId && t.id !== map.id) {
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
  let retryTimer = null, tentativi = 0;
  /** Stato dichiarato del salvataggio (spec fondamenta F), proprieta' sulla funzione V.storage —
   *  non un modulo a parte: chi gia' chiamava V.storage() per canale/db/chiave non si accorge di
   *  nulla. 'ok' = scritto su IndexedDB; 'fallback' = solo su localStorage (spia gialla, si
   *  ritenta IndexedDB da sola); 'failed' = non scritto da nessuna parte (spia rossa). */
  V.storage.state = 'ok';
  const setStato = (s) => {
    if (V.storage.state === s) return;
    V.storage.state = s;
    V.ui && V.ui.saveState && V.ui.saveState(s);   // spia + toast: una volta per cambio di stato
  };
  const writeNow = () => {
    let s;
    try { s = JSON.stringify(V.doc); }
    catch (e) {
      // M13: un documento non serializzabile (un ciclo, es. m.anello = m) non deve sparire in
      // silenzio — stato rosso e ritentativo, come un fallimento di scrittura qualunque.
      setStato('failed'); riprovaFra(); return chain;
    }
    chain = chain.then(async () => {
      const ok = await idbSet('doc', s); let ls = false;
      try { if (!ok) { localStorage.setItem(LS_DOC, s); ls = true; } else localStorage.removeItem(LS_DOC); } catch (e) { /* quota */ }
      // il .meta si scrive SOLO se il documento e' davvero finito da qualche parte (ok || ls):
      // altrimenti la schermata di diagnosi (V.lastSaved) direbbe «salvato: adesso» per una
      // scrittura che non e' mai avvenuta — proprio la bugia che questo commit doveva chiudere.
      if (ok || ls) { try { localStorage.setItem(LS_DOC + '.meta', JSON.stringify({ at: Date.now(), active: V.doc.activeMapId, v: V.VERSION })); } catch (e) { /* quota */ } }
      if (ok) { tentativi = 0; clearTimeout(retryTimer); setStato('ok'); }
      else if (ls) { setStato('fallback'); riprovaFra(); }   // il documento e' salvo, ma IndexedDB si riprova
      else { setStato('failed'); riprovaFra(); }
    });
    return chain;
  };
  /** Ritentativo con backoff esponenziale (1s, 2s, 4s, ... tetto 30s), sia da 'failed' sia da
   *  'fallback' — da fallback si riprova IndexedDB: e' cosi' che la spia gialla puo' rientrare da
   *  sola (spec F). unref(): il timer non deve tenere viva la pagina ne', nelle prove, il processo
   *  Node. V._retryNow scavalca l'attesa (gancio di prova). */
  const riprovaFra = () => {
    const pausa = Math.min(30000, 1000 * Math.pow(2, tentativi++));
    clearTimeout(retryTimer); retryTimer = setTimeout(() => { if (!azzerato) writeNow(); }, pausa);
    if (retryTimer && retryTimer.unref) retryTimer.unref();
  };
  V._retryNow = () => { clearTimeout(retryTimer); return writeNow(); };
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
    clearTimeout(saveTimer); saveTimer = null; dirtyAt = 0; clearTimeout(retryTimer);
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
  /** Migrazione una tantum, in un posto solo (spec fondamenta A8): fino alla versione 3 di oggi.
   *  Chi arriva da fuori — «Apri JSON», il travaso dallo spazio di origine, un file importato — passa
   *  sempre da qui prima di toccare il documento. Idempotente: un documento già alla versione 3 esce
   *  identico, con `note` vuoto — rifarla non deve MAI raddoppiare una conversione già fatta.
   *    - props.times → props.obs ({s, at:null, giro:null, cls:'normale'}: «data sconosciuta», come
   *      dice la Parte I §2 — la nota e la classificazione vere arrivano solo dal cronometro nuovo);
   *    - map.phase, se assente, si deduce SOLO da booleani veri (M12: un file può portare
   *      validated:"no", truthy ma corrotto — === true non ci casca);
   *    - map.layers, se assente, eredita la spunta da map.overlays (poi cancellato: non e' una
   *      chiave sconosciuta da conservare, e' quella che questa stessa funzione ha appena sostituito);
   *    - un cronometro lasciato aperto (map.measure) sopravvive SOLO se la fase risultante e' 'misura'
   *      (altrimenti scriverebbe osservazioni su un foglio che non dovrebbe poter cronometrare):
   *      altrimenti si scarta e lo si dice, una nota per mappa scartata, cosi' chi apre lo sa.
   *  Ritorna { doc, note }: note contiene 'v2' se ha convertito, e 'cronometro-chiuso:<mapId>' per
   *  ogni giro scartato — sono le frasi del toast di chi chiama (V.load, V.replaceDoc, V.importMaps). */
  V.migrate = (d) => {
    const note = [];
    if (!d || typeof d !== 'object' || !d.maps || typeof d.maps !== 'object') return { doc: d, note };
    if (d.version !== 3) {
      Object.keys(d.maps).forEach(id => {
        const m = d.maps[id]; if (!m || typeof m !== 'object') return;
        if (Array.isArray(m.elements)) {
          m.elements.forEach(el => {
            const p = el && el.props;
            if (p && Array.isArray(p.times)) {
              const nuove = p.times.map(s => ({ s, at: null, giro: null, cls: 'normale' }));
              p.obs = Array.isArray(p.obs) ? p.obs.concat(nuove) : nuove;
              delete p.times;
            }
          });
        }
        if (m.phase === undefined) {
          // Sull'Ideale (kind:'future') 'validated' e' il LUCCHETTO, non «flusso validato, si
          // misura»: dedurne 'misura' lo chiudeva in una fase da cui un future non esce (da misura
          // si torna indietro solo col «nuovo giro», che e' della catena dell'Attuale) — sbloccato
          // il lucchetto, ogni modifica restava rifiutata per fase. La 1.0 dichiara l'invariante in
          // createFuture («l'Ideale nasce in disegna, a prescindere dalla fase dell'Attuale»): la
          // migrazione lo rispetta, e cosi' il suo cronometro clonato dalla 0.9 si chiude dalla
          // regola qui sotto, con la sua nota (trovato sul primo export REALE della 0.91,
          // test/fixture-091.test.js).
          m.phase = (m.kind === 'future') ? 'disegna'
            : (m.validated === true) ? 'misura'
            : (m.validation && m.validation.walked === true) ? 'valida' : 'disegna';
        }
        // 'validated' e' il lucchetto dell'Ideale (kind:'future', A1/interp.1): il valore vecchio
        // di una mappa 0.9 (appena letto qui sopra per dedurre la fase) non deve restare come
        // lucchetto su un current/detail. RIDONDANTE con la cura di sanitizeMap (model.js:~190,
        // che gira su OGNI mappa dopo migrate, in load/replaceDoc/importMaps): tenuta qui a scopo
        // di chiarezza — proprio dove si legge 'validated' per la fase, resettarlo e' il posto piu'
        // leggibile — ma la cura che copre davvero tutti i lettori (interact.js, panels.js,
        // popover.js) e' quella in sanitizeMap, non questa (round 2 della revisione avversariale).
        if (m.kind !== 'future' && m.validated) m.validated = false;
        if (m.layers === undefined) m.layers = { riepilogo: m.overlays !== false };
        if ('overlays' in m) delete m.overlays;
        if (m.measure && typeof m.measure === 'object' && m.phase !== 'misura') {
          delete m.measure; note.push('cronometro-chiuso:' + id);
        }
        bump(m);
      });
      d.version = 3; note.push('v2');
    }
    return { doc: d, note };
  };
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
    V.migrationNotes = [];
    if (s) {
      try {
        const d0 = JSON.parse(s);
        if (d0 && d0.maps && [1, 2, 3].includes(d0.version)) {
          const { doc, note } = V.migrate(d0);
          V.doc = doc; V.migrationNotes = note;
          const oldDoc = !d0.cleaned; // le legende sul foglio si tolgono una volta sola, non a ogni avvio
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
   *  due Ideali sulla stessa catena. Ritorna l'elenco di cio' che ha corretto, cosi' i test lo leggono.
   *  Non fa bump(map) per ogni mappa che tocca: gira sull'intero documento a ogni apertura, e farlo
   *  qui vorrebbe dire alzare rev su mappe che nessuno ha davvero scritto. ATTENZIONE (corretto dopo
   *  la revisione avversariale del Task 7, che l'ha trovato falso eseguendo): non e' vero che ogni
   *  chiamata arrivi sempre insieme a un sanitizeMap/load che il bump l'ha gia' fatto —
   *  V.deleteMap, V.deleteProject, V.attachUnder e V.createVersion chiamano repairDoc SENZA un
   *  sanitize prima, e repairDoc puo' correggere `link/pairId/parentId/verOf/projectId` senza
   *  alzare rev. Oggi e' innocuo per un motivo diverso: V.index (WeakMap per rev) contiene solo
   *  byId/parents/children/flows — nessuno di quei campi — quindi un memo vecchio resta comunque
   *  corretto. Se l'indice arrivasse a inglobare uno di quei campi, il bump mancante su QUESTI
   *  quattro cammini diventerebbe un bug silenzioso. */
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
  /** Sostituisce l'intero documento (Ripristina da backup). Accetta v2 e v3 — passa sempre da
   *  V.migrate, che per un v3 è un no-op — e restituisce le note di migrazione: chi chiama (oggi
   *  nessuno le mostra ancora, ma la firma è la stessa di importMaps) le può usare per lo stesso toast. */
  V.replaceDoc = (d) => {
    if (!d || !d.maps || ![2, 3].includes(d.version)) throw new Error('Formato non riconosciuto (serve un JSON di VSM Coach v2 o v3)');
    const { doc, note } = V.migrate(d);
    V.doc = doc;
    Object.values(V.doc.maps).forEach(m => { keepLook(m); Object.assign(m, Object.assign(V.newMap(), m)); });
    // un backup con ZERO mappe (file editato a mano) lasciava activeMapId nullo e il render
    // esplodeva su V.map() undefined (rilievo R3 del brute force, 25/8): si atterra su un foglio nuovo
    if (!Object.keys(V.doc.maps).length) V.addMap(V.newMap({ title: '' }));
    V.repairDoc(); if (!V.doc.maps[V.doc.activeMapId]) V.doc.activeMapId = Object.keys(V.doc.maps)[0];
    undoStack.length = 0; redoStack.length = 0;
    V.save(); emit({ switched: true });
    return note;
  };
  V.importMaps = (d) => { // aggiunge le mappe di un altro documento senza sostituire (id già esistenti → rigenerati, per non perdere le modifiche fatte nel frattempo)
    if (d && d.maps && (d.version === 2 || d.version === 3)) {
      const { doc, note } = V.migrate(d); d = doc;
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
      // Stessa cura per props.obs[].giro (Task 3): e' un riferimento a un FOGLIO (map.id, non un
      // elemento), quindi segue le mappe con lo stesso ext() — senza, un'osservazione migrata resta
      // appesa al vecchio id, che dopo l'import e' la mappa di CASA, non la copia appena arrivata.
      const ext = (v) => (v && idRemap.has(v)) ? idRemap.get(v) : v;
      const imported = Object.values(d.maps).map(m => {
        const nm = Object.assign(V.newMap(), keepLook(m));
        nm.id = ext(nm.id); nm.pairId = ext(nm.pairId); nm.parentId = ext(nm.parentId); nm.verOf = ext(nm.verOf);
        nm.projectId = progettoPer(m);
        nm.elements.forEach(el => {
          if (el.props && el.props.link) el.props.link = ext(el.props.link);
          if (el.props && Array.isArray(el.props.obs)) el.props.obs.forEach(o => { if (o && o.giro != null) o.giro = ext(o.giro); });
        });
        return nm;
      });
      imported.forEach(m => { V.doc.maps[m.id] = m; });
      V.doc.activeMapId = imported[0].id; V.repairDoc(); V.save(); emit({ switched: true });
      return { count: imported.length, note };
    }
    if (d.version === 1 || d.current) { const ms = V.fromV1(d); ms.forEach(m => V.addMap(m)); V.doc.activeMapId = ms[0].id; V.save(); emit({ switched: true }); return { count: ms.length, note: [] }; }
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
    const ix = V.index(map);
    const byX = (a, b) => a.x - b.x;
    const boxes = map.elements.filter(e => e.type === 'box');
    // ordinano solo le frecce fra passi: una freccia che parte da una scorta o da un in-box collega,
    // ma non dice «questo passo viene dopo quello» — senza il filtro, un passo raggiunto solo da una
    // freccia del genere perdeva il numero e restava fuori dall'ordine stimato
    // Il filtro era quadratico (boxes.some dentro un filter su map.elements): su un pettine di
    // qualche migliaio di frecce costava secondi interi. Un Set delle chiavi vive lo rende lineare.
    const boxIds = new Set(boxes.map(b => b.id));
    const flows = map.elements.filter(e => e.type === 'flow' && e.from.el && e.to.el)
      .filter(f => boxIds.has(f.from.el) && boxIds.has(f.to.el));
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
          f.outs = outMap.get(f.b.id).slice().sort((p, q) => (ix.byId.get(p.to.el)?.x || 0) - (ix.byId.get(q.to.el)?.x || 0));
        }
        if (f.i >= f.outs.length) { pila.pop(); continue; }
        const c = f.outs[f.i], i = f.i++;
        const t = ix.byId.get(c.to.el); if (!t) continue;
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
    // La profondità è il percorso più lungo che arriva al passo. Se i tratti non girano in tondo,
    // basta una passata in ordine topologico (Kahn): il vecchio rilassamento lì converge comunque
    // entro il tetto delle passate, quindi il risultato è lo stesso — ma in una passata sola
    // invece che fino a N volte su tutti i tratti. Se le frecce girano in tondo non esiste ordine
    // topologico: lì resta il rilassamento di sempre, anelli compresi. Quei numeri (una
    // rilavorazione dà 1, 10, 9) sono quelli che il foglio ha sempre mostrato: non si cambiano
    // alle spalle di chi ha già fogli così.
    const nodi = new Set(); fo.segments.forEach(s => { nodi.add(s.from.id); nodi.add(s.to.id); });
    const uscenti = new Map(), gradi = new Map();
    nodi.forEach(id => { uscenti.set(id, []); gradi.set(id, 0); });
    fo.segments.forEach(s => { uscenti.get(s.from.id).push(s.to.id); gradi.set(s.to.id, gradi.get(s.to.id) + 1); });
    const fila = [], resto = new Map();
    nodi.forEach(id => { resto.set(id, gradi.get(id)); if (gradi.get(id) === 0) fila.push(id); });
    const topo = [];
    for (let i = 0; i < fila.length; i++) {
      const u = fila[i]; topo.push(u); const d = (prof.get(u) || 0) + 1;
      uscenti.get(u).forEach(v => { if (d > (prof.get(v) || 0)) prof.set(v, d); resto.set(v, resto.get(v) - 1); if (resto.get(v) === 0) fila.push(v); });
    }
    if (topo.length < nodi.size) {
      // tondo: il rilassamento riparte da zero, com'era — stesso giro, stessi numeri
      fo.order.forEach(b => prof.set(b.id, 0));
      let cambia = true, giri = 0;
      while (cambia && giri++ <= fo.order.length) {
        cambia = false;
        fo.segments.forEach(s => { const d = (prof.get(s.from.id) || 0) + 1; if (d > (prof.get(s.to.id) || 0)) { prof.set(s.to.id, d); cambia = true; } });
      }
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
   *  Ogni passata salva un'OSSERVAZIONE, non solo un numero (props.obs, spec fondamenta A4): i
   *  secondi, quando è stata presa e in che giro del foglio — la classificazione (normale/particolare/
   *  eccezionale) esiste già nel dato ma la interfaccia che la scrive è di una fase successiva (F1);
   *  qui il cronometro scrive sempre 'normale'. props.times non esiste più: V.migrate lo converte una
   *  tantum. Le osservazioni restano in SECONDI: l'unità del foglio (map.unit) può cambiare dopo, e
   *  una misura registrata «in minuti» diventerebbe una bugia. Restano dentro il documento, perché chi
   *  ha camminato il processo non deve perdere il giro se il tablet si spegne. */
  const UNIT_SEC = { secondi: 1, minuti: 60, ore: 3600, giorni: 86400 };
  V.unitSeconds = (unit) => UNIT_SEC[unit] || 60;
  /** Sotto questa soglia una misura non è il tempo di un passo: è un tocco per sbaglio, o un giro
   *  cominciato e chiuso per sbaglio. La soglia è in SECONDI e non nell'unità del foglio — due secondi
   *  restano due secondi anche su un foglio in ore. L'app la SEGNALA e basta: scartarla è di chi ha
   *  osservato, come per l'outlier eccezionale (spec: «l'app li mostra, non decide»). */
  V.MISURA_BREVE = 5;
  V.toUnit = (sec, unit) => sec / V.unitSeconds(unit);
  /** Le osservazioni buone di un elemento: oggetti veri, con un `s` numero e mai negativo. Quello che
   *  arriva da un file di fuori può essere qualunque cosa, e una media con dentro «due» non è una
   *  media — sanitizeMap già ripara i campi noti all'apertura, questo filtro è la seconda rete per chi
   *  scrive nel documento in memoria senza passare da lì. */
  V.obsOf = (el) => (el && Array.isArray(el.props && el.props.obs))
    ? el.props.obs.filter(o => o && typeof o === 'object' && typeof o.s === 'number' && isFinite(o.s) && o.s >= 0) : [];
  /** I soli secondi, per i calcoli che non hanno bisogno di sapere quando o in che giro sono stati
   *  presi: i chiamanti di prima di V.migrate (timeStats, timesReport, applyTimes, dropTime) non
   *  cambiano — leggono ancora un array di numeri. */
  V.timesOf = (el) => V.obsOf(el).map(o => o.s);
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
    // classe:'osservazioni' (interpretazione 6): artefatto della misura, non un gesto di chi disegna —
    // la fase Misura lo ammette anche se hi/lo/avg sarebbero normalmente 'contenuto' (fermo in misura).
    const ok = V.commit(ops, 'calcola i tempi', { map, classe: 'osservazioni' });
    return { ok, written: ok ? ops.length : 0, validati };
  };
  /** Scarta una singola misura (il caso eccezionale che chi ha osservato riconosce). Come addTime,
   *  fuori dall'annulla (silent: true): scartare un'osservazione non è una modifica al disegno da
   *  poter ripetere con ↩, e' un gesto del cronometro. */
  /** posizione nell'array ORIGINALE della i-esima osservazione SANA (quella che gli elenchi e la
   *  sezione mostrano, V.obsOf): le marce non si contano e NON si toccano — «mai perdere dati»
   *  (rilievo Codex #1, esteso alle vie sorelle dal rilievo Kimi #3). -1 = indice fuori posto. */
  const obsSana = (o) => o && typeof o === 'object' && typeof o.s === 'number' && isFinite(o.s) && o.s >= 0;
  const posObs = (el, i) => {
    if (!Number.isInteger(i) || i < 0) return -1;
    const raw = Array.isArray(el.props.obs) ? el.props.obs : [];
    let k = -1;
    for (let j = 0; j < raw.length; j++) { if (obsSana(raw[j])) { k++; if (k === i) return j; } }
    return -1;
  };
  V.dropTime = (map, elId, i) => {
    const el = V.byId(elId, map); if (!el) return false;
    const pos = posObs(el, i); if (pos < 0) return false;
    const raw = el.props.obs;
    const dopo = raw.slice(0, pos).concat(raw.slice(pos + 1));
    return V.commit({ t: 'props', id: elId, after: { obs: dopo } }, 'scarta una misura', { map, silent: true });
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
   *  scritto. Interpretazione 9: la SCRITTURA di uno stato passa dal commit (così il lucchetto del
   *  foglio la ferma come ogni altra scrittura), ma la CHIUSURA resta diretta — oggi measureStop
   *  funziona anche a lucchetto chiuso, e non deve smettere: chiudere un cronometro non è mai
   *  una modifica al foglio che il lucchetto debba impedire. */
  const setMeasure = (map, s) => {
    if (!s) { delete map.measure; bump(map); V.save(); return null; }   // chiudere è sempre lecito
    const ok = V.commit({ t: 'meta', after: { measure: s } }, 'cronometro', { map, silent: true });
    return ok ? s : null;
  };
  /** Ogni fase nuova del giro riparte pulita: le pause appartengono alla misura chiusa. */
  const senzaPause = (s) => { const d = Object.assign({}, s); delete d.pausedAt; delete d.pausedTot; return d; };
  V.measureState = (map) => (map && map.measure) || null;
  /** Secondi VERI della misura in corso: dall'orologio di parete (t0), al netto delle pause
   *  dell'osservatore (esito stazione 3 + ricerca 25/8: la pausa di CHI misura — una telefonata —
   *  non e' tempo del processo; l'attesa del processo invece corre da sola ed E' il dato). */
  const misuraNetta = (s, now) => {
    if (!s || !s.t0) return 0;
    const pausa = (s.pausedTot || 0) + (s.pausedAt ? Math.max(0, now - s.pausedAt) : 0);
    return Math.max(0, Math.round((now - s.t0 - pausa) / 1000));
  };
  V.measureElapsed = (map, now) => misuraNetta(V.measureState(map), now || Date.now());
  /** Il tempo del cronometro come lo mostra la barra (C18 del triage debug 25/8): mm:ss con lo
   *  zero davanti sotto l'ora, h:mm:ss dall'ora in su — un giro riaperto dopo due ore scriveva
   *  «120:04», che non si legge. Pura, provata in Node; la barra del giro la usa. */
  V.fmtCrono = (sec) => {
    const s2 = Math.max(0, Math.floor(sec || 0));
    const h = Math.floor(s2 / 3600), mm = Math.floor(s2 / 60) % 60, ss = s2 % 60;
    const pad = (n) => (n < 10 ? '0' : '') + n;
    return h ? h + ':' + pad(mm) + ':' + pad(ss) : pad(Math.floor(s2 / 60)) + ':' + pad(ss);
  };
  /** Il FORMATO delle misurazioni (esito 12 della prova iPad, 26/8): di casa la convenzione dei
   *  cronometri — minuti ′ e secondi ″ (50″ · 1′20″ · 1h01′05″; sotto i 10 secondi un decimale,
   *  se c'e') — scelta da Gt («scegli quello convenzionale»); in impostazioni si puo' tornare
   *  all'unita' del foglio (vsm.timefmt='unita'), e allora le viste ripiegano su inUnita. */
  V.timeFmt = () => { try { return localStorage.getItem('vsm.timefmt') === 'unita' ? 'unita' : 'crono'; } catch (e) { return 'crono'; } };
  V.fmtMisura = (sec) => {
    const s2 = Math.max(0, sec || 0);
    const pad = (n) => (n < 10 ? '0' : '') + n;
    if (s2 < 10) { const dec = Math.round(s2 * 10) / 10; return String(dec).replace('.', ',') + '″'; }
    const tondi = Math.round(s2);
    if (tondi < 60) return tondi + '″';
    const h = Math.floor(tondi / 3600), mm = Math.floor(tondi / 60) % 60, ss = tondi % 60;
    return h ? h + 'h' + pad(mm) + '′' + pad(ss) + '″' : mm + '′' + pad(ss) + '″';
  };
  /** Il nome del passo come lo dicono le viste di Misura (esito 12): il titolo se c'e', altrimenti
   *  «Passo N» dalla sequenza della catena — mai un passo anonimo davanti a chi misura. */
  V.nomePasso = (el, map) => {
    const t = String((el && el.props && el.props.title) || '').trim();
    if (t) return t;
    const n = V.stepNumbers(map).get(el && el.id);
    return n ? 'Passo ' + n : 'passo senza nome';
  };
  V.measurePaused = (map) => { const s = V.measureState(map); return !!(s && s.pausedAt); };
  /** Pausa dell'OSSERVATORE: ferma il conteggio (passo O attesa) senza chiudere niente.
   *  Gia' in pausa, o niente in corso: null. */
  V.measurePause = (map, now = Date.now()) => {
    const s = V.measureState(map);
    if (!s || !s.phase || !s.t0 || s.pausedAt) return null;
    return setMeasure(map, Object.assign({}, s, { pausedAt: now }));
  };
  V.measureResume = (map, now = Date.now()) => {
    const s = V.measureState(map);
    if (!s || !s.pausedAt) return null;
    const dopo = Object.assign({}, s, { pausedTot: (s.pausedTot || 0) + Math.max(0, now - s.pausedAt) });
    delete dopo.pausedAt;
    return setMeasure(map, dopo);
  };
  /** Avvia la misura di un passo. mode 'giro' = la catena in sequenza (le attese nascono da sole);
   *  mode 'singolo' = quel passo e basta, ripetuto quante volte si vuole (niente attese). */
  V.measureStart = (map, stepId, mode = 'giro', now = Date.now()) => {
    const el = V.byId(stepId, map);
    if (!el || el.type !== 'box' || el.props.validated) return null;
    // col lucchetto del foglio chiuso nessuna misura potra' essere registrata: far partire il giro
    // vorrebbe dire far camminare qualcuno per niente
    if (map.validated) return null;
    // Il cronometro si apre SOLO in Misura e Analizza (A1, decisione di Gt 22 agosto: impedire, non
    // solo segnalare). Fuori fase il giro non parte nemmeno: UI.openMisura dice il perché con la
    // frase del libro, qui e' la barriera vera — un chiamante che aggirasse il pannello non riesce
    // comunque a far partire un cronometro che poi scriverebbe osservazioni bloccate da V.allowed.
    if (!['misura', 'analizza'].includes(map.phase)) return null;
    const prec = V.measureState(map);
    // Una misura APERTA (passo o attesa, anche in pausa) non si straccia mai in silenzio (C5 del
    // triage debug 25/8, Grok #4): sul canvas misTap gia' rifiutava («chiudilo prima»), ma il
    // dialogo con «solo questo passo» sostituiva map.measure e il lap spariva senza scrivere
    // niente. La barriera sta qui, nel modello: ogni chiamante riceve lo stesso no.
    if (prec && prec.phase && prec.t0) return { ko: 'in-corso' };
    const s = { mode, giro: (prec && prec.giro) || 1, stepId, phase: 'box', t0: now, fromId: null, connId: null };
    // il turno e' della SESSIONE di misura (F1, Task 4): dichiarato a giro pronto o in corso,
    // sopravvive agli avvii successivi finche' la sessione vive — sempre visibile nel campo del
    // dialogo Misura, mai un'eredita' silenziosa. Muore con «chiudi il giro» (measureStop).
    if (prec && typeof prec.turno === 'string' && prec.turno) s.turno = prec.turno;
    return setMeasure(map, s);
  };
  V.measureStop = (map) => setMeasure(map, null);
  /** Il percorso del giro lo sceglie CHI MISURA (esito Gt 25/8 sera): durante l'attesa, il tocco
   *  sul cronometro di un passo dice «il prossimo e' questo». Se dal passo precedente parte una
   *  freccia verso il passo scelto (bivio vero), l'attesa si scrive su QUELLA freccia e il passo
   *  parte. Se la freccia non c'e', l'ordine di lavoro non e' stato rispettato: lo si DICE
   *  (fuoriOrdine), l'attesa non ha dove essere scritta (attesaPersa, in secondi netti) e la
   *  misura riparte comunque sul passo scelto — chi cammina decide, l'app non lo blocca. */
  V.measureJump = (map, stepId, now = Date.now()) => {
    const s = V.measureState(map); if (!s || !s.t0) return null;
    const dest = V.byId(stepId, map);
    if (!dest || dest.type !== 'box' || dest.props.validated) return null;
    if (s.phase === 'box') return { ko: 'in-corso' };
    if (s.phase !== 'attesa') return null;
    const conn = map.elements.find(c => c.type === 'flow' && c.from && c.from.el === s.fromId && c.to && c.to.el === stepId);
    if (conn) {
      setMeasure(map, Object.assign({}, s, { stepId, connId: conn.id }));
      return V.measureAdvance(map, now);
    }
    const persa = misuraNetta(s, now);
    setMeasure(map, senzaPause(Object.assign({}, s, { phase: 'box', stepId, t0: now, fromId: null, connId: null })));
    return { fuoriOrdine: true, attesaPersa: persa, phase: 'box', elId: stepId };
  };
  /** Il turno del giro (F1): «mattina», «notte», quello che il reparto usa — dichiarato nel dialogo
   *  Misura, copiato da addTime su ogni osservazione del giro. Vive nel cronometro (fuori annulla,
   *  come il resto di measure); testo vuoto lo toglie. Senza cronometro non c'e' dove scriverlo. */
  V.measureTurno = (map, testo) => {
    const s = V.measureState(map); if (!s) return null;
    const t = (typeof testo === 'string') ? testo.trim() : '';
    const dopo = Object.assign({}, s);
    if (t) dopo.turno = t; else delete dopo.turno;
    return setMeasure(map, dopo);
  };
  /** Butta via la misura in corso e riparte da adesso: chi cammina si accorge subito quando la misura
   *  non vale (una telefonata, un'interruzione che non c'entra) e deve poterla annullare senza
   *  perdere il giro. */
  V.measureDiscard = (map, now = Date.now()) => {
    const s = V.measureState(map); if (!s || !s.phase) return null;
    return setMeasure(map, senzaPause(Object.assign({}, s, { t0: now })));
  };
  /** ELIMINA la misura in corso (esito 12-bis, caso 1: «era il passo sbagliato»): il lap si
   *  butta SENZA scrivere niente e il giro resta pronto — numero e turno sopravvivono, il
   *  cronometro non punta più a nulla. Diverso da measureDiscard (riparte da adesso sullo
   *  STESSO passo) e da measureStop (chiude la sessione). Lo chiama il cestino della barra,
   *  col doppio tocco. */
  V.measureAbort = (map) => {
    const s = V.measureState(map); if (!s || !s.phase || !s.t0) return null;
    const dopo = Object.assign({ mode: s.mode, giro: s.giro || 1, stepId: null, phase: null, t0: null, fromId: null, connId: null },
      (typeof s.turno === 'string' && s.turno) ? { turno: s.turno } : {});
    return setMeasure(map, dopo) ? { ok: true } : null;
  };
  /** Scrive l'osservazione PIENA (spec A4): secondi, quando (Date.now, non null: non è una migrata
   *  dalla 0.9) e in che giro del foglio (map.id: il giro è il foglio su cui si sta misurando, non
   *  un numero — due giri diversi non condividono mai un measure, M8.4). Fuori dall'annulla, come
   *  il resto del cronometro: chi cammina il processo non deve poter disfare una misura con ↩. */
  const addTime = (map, elId, sec) => {
    const el = V.byId(elId, map); if (!el) return false;
    const oss = { s: sec, at: Date.now(), giro: map.id, cls: 'normale' };
    // il turno dichiarato per il giro (V.measureTurno, F1) viaggia su ogni osservazione: e' un
    // attributo della misura presa, non del cronometro — e resta leggibile dopo che il giro chiude
    const t = map.measure && map.measure.turno;
    if (typeof t === 'string' && t) oss.turno = t;
    // si appende all'array ORIGINALE, non a V.obsOf: ricostruire dalla lista sana avrebbe fatto
    // sparire un'osservazione marcia alla prima misura nuova (rilievo Kimi #3, via sorella di Codex #1)
    const raw = Array.isArray(el.props.obs) ? el.props.obs : [];
    return V.commit({ t: 'props', id: elId, after: { obs: raw.concat([oss]) } }, 'misura', { map, silent: true });
  };
  /** Cambia cls o nota di UNA osservazione (F1, interp. 6): un giudizio UMANO («questa era
   *  un'eccezione», «c'era un'interruzione»), non il cronometro — quindi commit NORMALE, con la sua
   *  voce di annulla. cls fuori elenco o indice fuori posto: false, niente scritto. */
  V.setObs = (map, elId, i, campi) => {
    const el = V.byId(elId, map); if (!el) return false;
    const c = campi || {};
    if (c.cls !== undefined && !['normale', 'particolare', 'eccezionale'].includes(c.cls)) return false;
    if (c.nota !== undefined && typeof c.nota !== 'string') return false;
    // il VALORE si corregge a mano (decisione Gt 26/8, stazione 12-C: flessibilita', ogni misura
    // modificabile a posteriori): numeri veri non negativi, arrotondati al secondo come quelli
    // che scrive il cronometro
    if (c.s !== undefined && !(typeof c.s === 'number' && isFinite(c.s) && c.s >= 0)) return false;
    // Si riscrive una copia dell'array ORIGINALE, non di V.obsOf (rilievo Codex #1 di F1):
    // ricostruire da obsOf avrebbe fatto sparire in silenzio un'osservazione marcia arrivata da
    // fuori — «mai perdere dati», la sana sanitizeMap al prossimo ingresso, non una rilettura.
    // L'indice i pero' E' quello della lista sana (la stessa che la sezione mostra): posObs
    // (condivisa con dropTime, rilievo Kimi #3) risale alla posizione vera.
    const pos = posObs(el, i); if (pos < 0) return false;
    const raw = el.props.obs;
    const dopo = raw.map((o, j) => {
      if (j !== pos) return o;
      const n = Object.assign({}, o);
      if (c.cls !== undefined) n.cls = c.cls;
      if (c.nota !== undefined) { if (c.nota.trim()) n.nota = c.nota.trim(); else delete n.nota; }
      if (c.s !== undefined) n.s = Math.round(c.s);
      return n;
    });
    return V.commit({ t: 'props', id: elId, after: { obs: dopo } }, 'osservazione riletta', { map });
  };
  /** L'attesa su cui scrivere la differenza: quella già appesa a questa freccia, o una nuova, messa
   *  fra i due passi. Nasce solo quando serve — misurare un passo alla volta non deve riempire il
   *  foglio di attese che nessuno ha osservato. */
  const attesaDi = (map, conn, from, to) => {
    const gia = map.elements.find(e => e.type === 'delta' && e.props.attachedTo === conn.id);
    if (gia) return gia;
    const x = Math.round(((from.x + from.w) + to.x) / 2 - 15), y = Math.round(from.y + 26);
    const d = V.newElement('delta', x, y, {}); d.props.attachedTo = conn.id;
    // classe:'osservazioni' (interpretazione 6): l'attesa qui non nasce da chi disegna — nasce dal
    // giro, come artefatto della misura. La fase Misura la ammette anche se un add di delta sarebbe
    // normalmente 'struttura' (fermo fuori da disegna/cammina).
    if (!V.commit({ t: 'add', el: d }, 'attesa misurata', { map, classe: 'osservazioni' })) return null;
    return V.byId(d.id, map);
  };
  /** Un tocco solo, che a seconda di dove sei vuol dire «passo finito» o «comincia il prossimo».
   *  Chiude la misura in corso, la registra, e apre la successiva: passo → attesa → passo dopo.
   *  Alla fine della catena il giro si chiude e il numero sale. */
  V.measureAdvance = (map, now = Date.now()) => {
    const s = V.measureState(map); if (!s || !s.phase || !s.t0) return null;
    const sec = misuraNetta(s, now);   // al netto delle pause dell'osservatore
    // Il giro si chiude: non punta più a niente, il numero del giro resta. Il pannello torna a
    // «comincia il giro», invece di tenere una misura appesa a un elemento che non c'è più.
    const chiudi = () => setMeasure(map, Object.assign({ mode: s.mode, giro: s.giro || 1, stepId: null, phase: null, t0: null, fromId: null, connId: null },
      (typeof s.turno === 'string' && s.turno) ? { turno: s.turno } : {}));   // il turno e' della sessione, non del singolo giro (F1)
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
      setMeasure(map, senzaPause(Object.assign({}, s, { phase: 'box', t0: now, fromId: null, connId: null })));
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
    if (s.mode === 'singolo') { setMeasure(map, senzaPause(Object.assign({}, s, { phase: null, t0: null }))); return { elId: s.stepId, seconds: sec, phase: null }; }
    const dopo = V.measureNext(map, s.stepId);
    // il turno resta anche qui: questo e' il ramo di chiusura NATURALE del giro — il flusso normale,
    // quello per cui il turno esiste — e perderlo proprio qui contraddiceva chiudi() e la promessa
    // del dialogo («va su ogni misura di questa sessione»). Rilievo Kimi #1 di F1, GRAVE: sfuggito
    // anche al round Codex perche' le prove coprivano solo mode 'singolo' e measureStop.
    if (!dopo) { setMeasure(map, Object.assign({ mode: s.mode, giro: (s.giro || 1) + 1, stepId: null, phase: null, t0: null, fromId: null, connId: null }, (typeof s.turno === 'string' && s.turno) ? { turno: s.turno } : {})); return { elId: s.stepId, seconds: sec, phase: null, chiuso: true }; }
    if (!dopo.conn) { setMeasure(map, senzaPause(Object.assign({}, s, { stepId: dopo.next.id, phase: 'box', t0: now, fromId: null, connId: null }))); return { elId: s.stepId, seconds: sec, phase: 'box' }; }
    setMeasure(map, senzaPause(Object.assign({}, s, { phase: 'attesa', t0: now, fromId: s.stepId, connId: dopo.conn.id, stepId: dopo.next.id })));
    return { elId: s.stepId, seconds: sec, phase: 'attesa' };
  };
  /** Indirizzo del foglio: quello del passo che lo contiene, PER INTERO. Vuoto per la radice del
   *  progetto. Iterativa (non ricorsiva): una catena di qualche migliaio di sotto-fogli mandava in
   *  RangeError lo stack, e prima ancora un `guard > 8` (spec 2026-08-20) tagliava la catena a meta'
   *  strada — dal nono livello in giu' fogli diversi si ritrovavano con lo STESSO indirizzo, e un
   *  indirizzo che non distingue non e' un indirizzo. Si risale una volta sola, tenendo gli anelli
   *  (`visti`: contro un documento arrivato da fuori e mai passato per repairDoc, che gli anelli li
   *  scioglie), poi si ridiscende componendo i tratti. Quando e' lungo si accorcia solo in mostra,
   *  con V.shortAddress: il valore qui resta quello vero. */
  /** Il tratto di UN anello: il numero del passo che contiene la mappa — ma UNIVOCO fra i
   *  fratelli (rilievi R1/R2 del brute force, 25/8: due figlie dello stesso passo avevano lo
   *  stesso indirizzo, e una figlia senza passo EREDITAVA l'indirizzo della madre — un indirizzo
   *  che non distingue non e' un indirizzo). Regola: i figli del foglio, in ordine di creazione,
   *  reclamano il numero del proprio passo; chi lo trova gia' preso, o un passo non ce l'ha,
   *  riceve una lettera (a, b, … aa) da una sequenza unica del foglio. Le lettere non collidono
   *  mai coi numeri di passo (che cominciano sempre con una cifra). */
  const lettTratto = (i) => { let s = ''; i += 1; while (i > 0) { i--; s = String.fromCharCode(97 + i % 26) + s; i = Math.floor(i / 26); } return s; };
  const trattoDi = (m, par) => {
    const nums = V.stepNumbers(par);
    const figli = Object.values(V.doc.maps).filter(o => o.parentId === par.id)
      .sort((a, b) => (a.created || 0) - (b.created || 0) || String(a.id).localeCompare(String(b.id)));
    const presi = new Set(); let li = 0;
    for (const o of figli) {
      const n = o.parentStepId ? nums.get(o.parentStepId) : null;
      const t = (n && !presi.has(n)) ? (presi.add(n), n) : lettTratto(li++);
      if (o.id === m.id) return t;
    }
    return lettTratto(li); // mai raggiunto per un figlio vero: m sta in figli per costruzione
  };
  V.mapAddress = (map) => {
    if (!map) return '';
    const anelli = [], visti = new Set();
    for (let m = map; m && m.parentId && V.doc.maps[m.parentId] && !visti.has(m.id); m = V.doc.maps[m.parentId]) { visti.add(m.id); anelli.push(m); }
    let su = '';
    for (let i = anelli.length - 1; i >= 0; i--) {
      const m = anelli[i], par = V.doc.maps[m.parentId];
      const t = trattoDi(m, par);
      su = su ? su + '.' + t : t;
    }
    return su;
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
  V.MAX_PERCORSI = MAX_PERCORSI;   // il riquadro (R.overlay) lo cita quando i percorsi sono troncati
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
    const arrivi = new Set(fo.segments.map(s => s.to.id));
    const inizi = fo.order.filter(b => !arrivi.has(b.id));
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
    if (map.kind === 'current' && M.boxes >= 1 && !map.validation.walked) add('warn', 4, 'Il processo non risulta ancora controllato sul campo (camminato: osservazione diretta): la mappa è provvisoria.');
    if (map.kind === 'current' && M.boxes >= 1 && !map.validation.validatedBy) add('warn', 4, 'La mappa non risulta validata da chi fa il lavoro ("ti sembra giusto? ho dimenticato qualcosa?").');
    if (M.boxes >= 1 && !M.hasData) add('warn', 5, 'Nessun dato Hi/Lo/Avg: senza tempi la mappa non mostra lo spreco (tocca un box o un delta per inserirli).');
    if (M.hasData) {
      // i PARZIALI (C16): un giro incompleto non si giudica dal passo piu' misurato — il lint
      // guarda il passo MENO misurato, e quando i conteggi divergono lo dice con l'intervallo
      const mp = V.misurePerPasso(map).filter(x => x.n > 0);
      const sMax = mp.length ? Math.max(...mp.map(x => x.n)) : (V.numMisure(map) || num(map.samples));
      const sMin = mp.length ? Math.min(...mp.map(x => x.n)) : sMax;
      if (!sMax) add('warn', 5, 'Nessuna misura raccolta: il cronometro le conta da sé (~30; 8-10 per una vista rapida).');
      else if (sMin !== sMax && sMin < 8) add('warn', 5, `Misure diseguali fra i passi (da ${sMin} a ${sMax}): per i passi meno misurati valgono le solite soglie — 8-10 per una vista rapida, ~30 per significatività.`);
      else if (sMax < 8) add('warn', 5, `${sMax} misure sono poche: 8-10 per una vista rapida, ~30 per significatività.`);
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
    { n: 3, t: 'Delta', s: 'attese tra i box' }, { n: 4, t: 'Controllare sul campo e validare', s: 'camminare il processo: osservazione diretta — prima dei Dati, non insieme' }, { n: 5, t: 'Dati', s: 'Hi / Lo / Avg — solo dopo aver camminato e validato' },
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
