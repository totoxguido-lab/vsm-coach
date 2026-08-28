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
  /** L'ORIGINE di un numero (F1-1B, D-06): quattro voci dichiarate, dettate da Gt il 27/8/2026.
   *  Le CHIAVI (`osservato`… ) sono nomi interni e non compaiono mai a schermo: a schermo si leggono
   *  sempre e solo le etichette qui sotto — la piena nel pannello e nel menu, la corta sul bottone
   *  in riga. Un posto solo: nessuna vista riscrive queste parole per conto suo.
   *  La chiave ASSENTE e' uno stato legittimo e dichiarato — «origine non dichiarata» — e non
   *  significa «osservato»: l'app non dichiara mai un'origine che nessuno ha detto (D-07). */
  V.FONTI = ['osservato', 'dichiarato', 'documento', 'stima'];
  V.FONTE_LABEL = {
    osservato: 'osservato direttamente',
    dichiarato: 'osservato da altri',
    documento: 'documento',
    stima: 'presunto'
  };
  V.FONTE_CORTA = { osservato: 'diretto', dichiarato: 'da altri', documento: 'documento', stima: 'presunto' };
  /** La QUINTA voce, interna: 'calcolato'. La scrive solo «Calcola i tempi» (V.applyTimes) sulla
   *  terna Hi/Lo/Avg che ha riscritto lui — non e' una cosa che una persona sceglie, quindi NON
   *  entra in V.FONTI e non compare mai nel menu delle quattro voci di Gt; nel pannello la riga
   *  corrispondente e' di sola lettura (UI-SPEC §2). Vale solo per props.fonteDati: un'osservazione
   *  non si calcola, si osserva. */
  const FONTI_DATI = V.FONTI.concat(['calcolato']);
  /** I due TIPI di allegato (F1-1C, D-12): una foto scattata in reparto e un memo vocale
   *  dell'osservatore. E' un elenco CHIUSO, ed e' l'elenco che decide come una cosa si mostra —
   *  mai il `mime`, che in un file confezionato puo' dichiarare qualunque cosa (minaccia
   *  T-02-10-01: `mime:'text/html'` aperto come pagina). Fuori elenco la riga cade: un allegato
   *  di cui non si sa che forma abbia non si sa nemmeno come disegnarlo.
   *  Nel DOCUMENTO stanno solo i METADATI (id, tipo, mime, dimensione, istante, giro): i byte
   *  vivono in IndexedDB e non entrano mai in V.doc, che si serializza a ogni salvataggio (D-14). */
  V.ALLEGATI_TIPI = ['foto', 'memo'];
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
    'priority', 'muda', 'rule', 'kind', 'mood', 'icon', 'channel', 'style', 'fonteDatiNota'];
  /** I campi di testo del MAP BRIEF dentro la scheda `prep` (F1-1A, D-01). Il reparto non e' fra
   *  loro: sta in map.unitName (UI-SPEC §1). `vitali` non e' qui perche' e' una lista, non testo. */
  const PREP_BRIEF_TESTO = ['domanda', 'famiglia', 'esclusioni', 'inizio', 'fine', 'turnoBrief',
    'finestra', 'sponsor', 'ruoli', 'revisione'];
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
    // I campi del MAP BRIEF (F1-1A) sono testo libero come il resto della scheda: si parte
    // dall'oggetto ORIGINALE e si correggono i soli campi noti — le chiavi che questa versione
    // non conosce sopravvivono (regola A5, commento qui sopra).
    if (m.prep && typeof m.prep === 'object' && !Array.isArray(m.prep)) {
      PREP_BRIEF_TESTO.forEach(k => testo(m.prep, k));
      // Gli INDICATORI VITALI (D-04) sono una lista dentro una scheda: stesso stampo di m.plan
      // (riga sopra) e stessa ragione — `vitali` arrivato come stringa farebbe morire chiunque ci
      // iteri sopra (scheda del Brief, conteggio, salute della mappa). Con una differenza: qui la
      // lista si garantisce ANCHE quando manca. m.plan riceve il suo [] dal default di V.newMap
      // perche' e' una chiave di primo livello (Object.assign(V.newMap(), m) in load/replaceDoc);
      // una chiave annidata dentro `prep` no — la scheda del file vince intera, e un documento
      // 0.91 arriverebbe senza `vitali`, cioe' con un undefined su cui il primo .forEach muore.
      m.prep.vitali = Array.isArray(m.prep.vitali) ? m.prep.vitali.filter(r => r && typeof r === 'object' && !Array.isArray(r)) : [];
      m.prep.vitali.forEach(r => {
        if (typeof r.id !== 'string' || !r.id) r.id = uid();
        r.nome = (r.nome == null) ? '' : String(r.nome);
        // solo `true` e' vero: un «si» arrivato da un file non accende un interruttore
        r.bilanciamento = r.bilanciamento === true;
      });
    }
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
        // stessa sorte per «chi osserva» (F1-1C, D-11): e' della sessione viva come il turno, e un
        // «inf. MR» di ieri non deve firmare le misure di domani (minaccia T-02-09-03). E per il ⚠
        // pendente (D-10), che e' per definizione del passo che stava correndo: quel passo, alla
        // riapertura, non sta correndo piu'. Quello GIA' scritto sulle osservazioni resta: e' un
        // dato preso, e qui non si perde niente — si toglie solo cio' che era in sospeso.
        if (s.chi !== undefined) delete s.chi;
        if (s.diverso !== undefined) delete s.diverso;
        // e la NOTA VELOCE pendente di quel ⚠ (piano 02-12): senza il suo passo che corre non ha
        // piu' una misura a cui appartenere, e riattaccata domani direbbe di un altro passo.
        if (s.nota !== undefined) delete s.nota;
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
        if (s.sospeso !== undefined && typeof s.sospeso !== 'string') delete s.sospeso;
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
      // la firma dei tempi (esito 13): stringa (un id di mappa) o niente — senza, i tempi sono
      // del foglio (default sicuro per i documenti scritti prima della firma)
      if (p.tempiGiro !== undefined && typeof p.tempiGiro !== 'string') delete p.tempiGiro;
      // l'origine della TERNA Hi/Lo/Avg (F1-1B): un campo solo per i tre numeri, che si scrivono
      // insieme nel pannello. Elenco dichiarato piu' la quinta voce interna 'calcolato'; fuori
      // elenco si cancella la chiave, come per la fonte dell'osservazione.
      if (p.fonteDati !== undefined && !FONTI_DATI.includes(p.fonteDati)) delete p.fonteDati;
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
          // l'ORIGINE della misura (F1-1B): elenco dichiarato, e fuori elenco si CANCELLA la chiave
          // — la forma di p.intent, non quella di cls. Ripiegare su 'osservato' farebbe dire alla
          // mappa che qualcuno ha visto di persona una cosa che nessuno ha visto: e' esattamente
          // la bugia che il 1B esiste per impedire (D-06/D-07). Assente = origine non dichiarata.
          if (x.fonte !== undefined && !V.FONTI.includes(x.fonte)) delete x.fonte;
          // chi o dove: testo libero come la nota — non-stringa o vuoto, via
          if (x.fonteNota !== undefined && (typeof x.fonteNota !== 'string' || !x.fonteNota)) delete x.fonteNota;
          // il ⚠ «qui e' andata diversa» (F1-1C, D-10) e' BINARIO: solo `true` e' vero. Un 1, un
          // «si» o un oggetto arrivati da un file non accendono il segno — la forma di
          // prep.vitali[].bilanciamento. La chiave assente e' lo stato normale, non un difetto.
          if (x.diverso !== undefined && x.diverso !== true) delete x.diverso;
          // chi ha preso la misura (D-11): testo libero come la nota — non-stringa o vuoto, via
          if (x.chi !== undefined && (typeof x.chi !== 'string' || !x.chi)) delete x.chi;
          return x;
        }).filter(Boolean);
        if (o.length) p.obs = o; else delete p.obs;
      }
      // gli ALLEGATI del passo (F1-1C, D-12/D-14): SOLO i metadati, mai i byte — il documento si
      // serializza a ogni salvataggio, e una foto la' dentro finirebbe nell'export JSON e in una PR
      // (minaccia T-02-10-05). Stesso stampo delle obs qui sopra: si parte dall'oggetto ORIGINALE e
      // si correggono i soli campi noti, cosi' le chiavi che non conosciamo — una beta piu' nuova,
      // domani la trascrizione di un memo — sopravvivono (regola A5).
      // La riga CADE solo per il `tipo` fuori elenco: e' il tipo, non il `mime`, a decidere come
      // una cosa si mostra (T-02-10-01), e di un allegato senza tipo la UI non saprebbe che fare.
      // Tutto il resto si ripara sul posto: l'`id` mancante se ne fa dare uno (senza chiave i byte
      // non si ritroverebbero mai), gli altri campi fuori tipo perdono la loro chiave e basta —
      // buttare la riga per un `size` scritto male vorrebbe dire dimenticare che quella foto esiste,
      // che e' proprio la perdita silenziosa che C-2 vieta.
      if (p.allegati !== undefined) {
        const nonNeg = (v) => { const n = num(v); return (n != null && n >= 0) ? n : undefined; };
        const parola = (v) => (typeof v === 'string' && v.trim()) ? v : undefined;
        const A = (Array.isArray(p.allegati) ? p.allegati : []).map(x => {
          if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
          if (!V.ALLEGATI_TIPI.includes(x.tipo)) return null;
          x.id = parola(x.id) || uid();
          ['mime', 'giro'].forEach(k => { if (x[k] !== undefined && parola(x[k]) === undefined) delete x[k]; });
          // size/at/w/h/dur: numeri finiti non negativi, o la chiave se ne va. Un `w` negativo o un
          // `dur: Infinity` finirebbero in un attributo del disegno o in una barra di riproduzione.
          ['size', 'at', 'w', 'h', 'dur'].forEach(k => { if (x[k] !== undefined) { const n = nonNeg(x[k]); if (n === undefined) delete x[k]; else x[k] = n; } });
          return x;
        }).filter(Boolean);
        if (A.length) p.allegati = A; else delete p.allegati;
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
    // Gli ALLEGATI non hanno bisogno di niente qui, ed e' una scelta di schema, non una svista
    // (02-RESEARCH.md §Pitfall 10 punto 5 chiedeva una rimappa di `stepId`): i metadati vivono
    // DENTRO `el.props.allegati`, quindi l'id del passo non e' duplicato da nessuna parte e
    // rinominare l'elemento se li porta dietro da solo. Se un giorno il metadato tornasse a
    // portare uno `stepId`, la rimappa qui sopra diventerebbe obbligatoria anche per lui — e le
    // due prove di test/allegati.test.js (§Rimappa degli id: l'id marcio e la collisione fra due
    // passi) sono li' per accorgersene invece di scoprirlo su un foglio vero.
    // L'unico riferimento degli allegati che NON e' locale al passo e' `giro`, che e' un id di
    // FOGLIO: quello segue le mappe in V.importMaps, con lo stesso ext() di props.obs[].giro.
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
      // il SOSPESO (esito 12-ter) e' piu' mite: se il passo abbandonato non c'e' piu' cade solo
      // il campo — la sessione (numero del giro, turno) non ha colpe e resta
      else if (m.measure.sospeso && !live.has(m.measure.sospeso)) delete m.measure.sospeso;
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
    // La scheda di PREPARAZIONE e' anche il MAP BRIEF (F1-1A, D-01): i campi del Brief si
    // aggiungono qui, tutti con default vuoto — cosi' un file 0.91 li riceve da
    // Object.assign(V.newMap(), m) senza una migrazione dedicata. Nessuno e' obbligatorio: il
    // Brief documenta, non blocca (D-02). Il reparto NON e' qui: vive in map.unitName e non si
    // chiede due volte (UI-SPEC §1) — V.briefStato lo conta dove sta.
    prep: {
      observable: false, frequent: false, worthy: false, drawer: '', owner: '', physicians: false, stable: false, staffing: false,
      domanda: '', famiglia: '', esclusioni: '', inizio: '', fine: '', turnoBrief: '', finestra: '', sponsor: '', ruoli: '', revisione: '', vitali: []
    },
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
  /** L'ALBERO del progetto per il picker dei fogli (esito 16-b, 26/8): righe in ordine di visita
   *  — le radici, e sotto ognuna i suoi figli, indentati (depth). Ogni riga porta titolo, tipo
   *  leggibile e indirizzo. Guardia sugli anelli: un parentId circolare (file confezionato) non
   *  deve appendere la visita. */
  V.alberoMappe = (map) => {
    const tutte = V.mapsOfProject(map.projectId);
    const ids = new Set(tutte.map(m => m.id));
    const figli = new Map();
    tutte.forEach(m => {
      const p = (m.parentId && ids.has(m.parentId)) ? m.parentId : null;
      if (!figli.has(p)) figli.set(p, []);
      figli.get(p).push(m);
    });
    const out = []; const visti = new Set();
    const visita = (pid, depth) => {
      (figli.get(pid) || []).forEach(m => {
        if (visti.has(m.id)) return;
        visti.add(m.id);
        out.push({ id: m.id, depth, titolo: m.title || 'senza titolo', tipo: V.kindLabel(m), indirizzo: V.mapAddress(m), parentId: m.parentId || null });
        visita(m.id, depth + 1);
      });
    };
    visita(null, 0);
    // un anello puro (nessuna radice raggiungibile): le rimaste si elencano piatte, mai perse
    tutte.forEach(m => { if (!visti.has(m.id)) out.push({ id: m.id, depth: 0, titolo: m.title || 'senza titolo', tipo: V.kindLabel(m), indirizzo: V.mapAddress(m), parentId: m.parentId || null }); });
    return out;
  };
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
  /** Un livello che dichiara `phaseMin: X` e' il livello che NASCE con la fase X: prima non e'
   *  nemmeno ammesso (V.layers.ammesso), e quando la fase arriva e' l'unica cosa nuova che quella
   *  fase ha da mostrare. Finche' nessuno lo accendeva, la fase arrivava e il foglio restava
   *  identico: in Misura i badge dei tempi — e con loro il segnetto ≈ della provenienza (D-08, il
   *  criterio d'uscita F1-U1) — non si sono mai visti sul foglio di chi misura, perche' vivono
   *  tutti dentro V.layers.active. Si accende SOLO la chiave mai decisa (`undefined`): chi lo
   *  spegne dal menu resta con lui spento, e riattraversare la fase non gli scavalca la scelta.
   *  Generico apposta: model.js non conosce gli id dei livelli (li registra chi li scrive). */
  const accendiLivelliDellaFase = (map, fase) => {
    const L = map && map.layers;
    if (!L || typeof L !== 'object') return;
    Object.keys(V.LAYER_PHASE_MIN).forEach(k => {
      if (V.LAYER_PHASE_MIN[k] === fase && L[k] === undefined) L[k] = true;
    });
  };
  V.setPhase = (map, fase) => {
    const g = V.canSetPhase(map, fase);
    if (!g.ok) return g;
    map.phase = fase; accendiLivelliDellaFase(map, fase); map.updated = Date.now(); bump(map); V.save();
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
    // `allegati` e' classe OSSERVAZIONI, non contenuto — una parola, e senza di lei la cattura
    // durante il giro (D-13) NON funziona: il ripiego dichiarato «contenuto» due righe piu' sotto
    // in fase `misura` passa SOLO per i tipi annotazione (MISURA_LIBERI, riga ~1000), quindi
    // toccare 📷 su un passo mentre si cammina verrebbe rifiutato dalla porta delle fasi e a
    // schermo «non succederebbe niente» (02-RESEARCH.md §Pitfall 5). E' un allegato preso
    // camminando: sta sull'asse delle osservazioni insieme a `obs`, non su quello del disegno.
    // Chi passasse di qui per semplificare e la togliesse romperebbe D-13 senza vedere un rosso
    // fuori da test/allegati.test.js: la prima prova di quel file esiste apposta.
    if (key === 'allegati') return 'osservazioni';
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
    // D8: in un giro chiuso le EVIDENZE non entrano piu'. Il controllo sta qui, nella porta unica,
    // e non nei pannelli: una via di scrittura che non passasse di qua rimetterebbe in piedi
    // esattamente il difetto: un'evidenza raccolta oggi che il documento attribuisce a un giro
    // finito tre giri fa. Le altre classi passano: si chiude la raccolta, non il foglio.
    if (classe === 'osservazioni' && V.giroChiuso(map)) return { ok: false, reason: 'giro-chiuso' };
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
    'nuovo-giro': 'Da Misura o Analizza non si torna indietro a disegnare: crea un nuovo giro per cambiare il foglio.',
    'giro-chiuso': 'Questo giro è chiuso: da qui è nato il giro successivo. Puoi ancora spostare le cose e scrivere note — ma le misure, le foto e i memo si raccolgono nel giro di adesso.'
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
  /** PERCHE' la freccia non ha niente da fare (cancello 1B, rilievo 4 — «Grigia si', ma che dica
   *  perche'», decisione di Gt del 27/8). Le due frecce restano toccabili: il tocco a vuoto
   *  risponde invece di non succedere niente.
   *  Ritorna null quando c'e' da lavorare, altrimenti la frase da dire. Due frasi per la ↶ perche'
   *  ci sono due situazioni diverse, e dirle uguali sarebbe una mezza bugia:
   *  - foglio senza modifiche: non c'e' niente, e basta;
   *  - misure prese in questo giro: la pila e' vuota lo stesso, ma NON perche' non sia successo
   *    niente — le misure del cronometro sono commit silenziosi, deliberatamente non annullabili
   *    (quella scelta resta in piedi). Allora si dice anche dove si tolgono davvero: il 🗑 della
   *    barra del giro. Corta, perche' la regola di Gt e' che le spiegazioni stanno dietro un «?».
   *  Pura rispetto al documento: legge la pila e il foglio, non scrive niente. */
  V.motivoAnnulla = (verso, map) => {
    if (verso === 'redo' ? V.canRedo() : V.canUndo()) return null;
    if (verso === 'redo') return 'Niente da rifare: non hai annullato niente.';
    const m = map || V.map();
    const misurato = !!(m && ['misura', 'analizza'].includes(m.phase)
      && (m.elements || []).some(e => V.obsDelGiro(e, m).length));
    return misurato
      ? 'Niente da annullare: le misure del cronometro non passano da qui. Si tolgono col \u{1F5D1} della barra del giro.'
      : 'Niente da annullare: su questo foglio non c’è ancora una modifica da disfare.';
  };

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
  /** Un giro che ha gia' generato il giro successivo e' CHIUSO (D8, rilievo di Gt al cancello 1C).
   *  Non c'e' uno stato nuovo da salvare e non c'e' niente da migrare: ogni giro punta al padre con
   *  `verOf`, quindi «ha almeno un figlio» vuol dire «non e' piu' l'ultimo della catena», e quel
   *  fatto il documento lo dice gia' da se'.
   *  Perche' non si e' appeso alla fase: Misura e Analizza vanno e vengono apposta (FASE_AVANTI le
   *  ammette in tutte e due le direzioni), quindi entrare in Analizza non significa «ho finito».
   *  Il momento in cui un giro diventa storia e' quello in cui qualcuno crea il giro dopo — un
   *  gesto esplicito, con la sua conferma. Si chiude quando la persona ha gia' detto che ha finito.
   *  Che cosa chiude: la raccolta di EVIDENZE (misure, ⚠, foto, memo), non il foglio. Il layout e i
   *  commenti restano scrivibili (decisione di Gt), e quello che si scrive li' non entra nel giro
   *  gia' generato — la copia e' stata presa quando il giro nuovo e' nato. */
  V.giroChiuso = (map) => !!(map && map.kind === 'current' && map.id
    && Object.values(V.doc.maps).some(y => y && y.kind === 'current' && y.verOf === map.id));
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
  V.numMisure = (map) => Math.max(0, ...(map.elements || []).map(e => V.obsDelGiro(e, map).length));
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
      n: V.obsDelGiro(b, map).length
    }));
  };
  /** Il foglio che sta misurando ADESSO (C2 del triage debug 25/8, decisione Gt 26/8: la barra
   *  del giro segue chi misura anche sugli altri fogli — fermare e mettere in pausa si puo'
   *  sempre). Prima il foglio attivo, poi gli altri del documento. */
  /** «+ Passo dopo» col TIPO di attesa scelto (esito 13, 26/8): crea il passo successivo gia'
   *  collegato con la freccia e — se kind non e' null — l'attesa di quel tipo agganciata alla
   *  freccia. kind fuori elenco ripiega su 'attesa'; la porta delle fasi decide come per ogni
   *  struttura (fuori da Disegna: null, niente nasce). */
  V.addNextStep = (map, elId, kind) => {
    const el = V.byId(elId, map); if (!el || el.type !== 'box') return null;
    const nx = Math.min(el.x + el.w + 90, V.paperOf(map).w - V.TYPES.box.w - 20);
    const nb = V.newElement('box', nx, el.y, {});
    const f = V.newConnector('flow', { el: elId }, { el: nb.id });
    const ops = [{ t: 'add', el: nb }, { t: 'add', el: f }];
    let deltaId = null;
    if (kind !== null && kind !== undefined && kind !== '') {
      const k = V.DELTA_KINDS.includes(kind) ? kind : 'attesa';
      const d = V.newElement('delta', 0, 0, {}); d.props.attachedTo = f.id; d.props.dx = 0; d.props.dy = 0; d.props.kind = k;
      ops.push({ t: 'add', el: d }); deltaId = d.id;
    }
    if (!V.commit(ops, 'passo successivo', { map })) return null;
    return { boxId: nb.id, flowId: f.id, deltaId };
  };
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
  /** lo store dei BYTE degli allegati (foto e memo, piano 02-11): sta nello STESSO database del
   *  documento, in un cassetto a parte. Il nome vive qui accanto a DB e STORE, non scritto a mano
   *  dentro le query: un refuso in una sola di loro sarebbe un cassetto fantasma. */
  const ALLEG = 'allegati';
  /** La versione del database. Alzarla e' l'operazione piu' pericolosa dell'app: `onupgradeneeded`
   *  riparte su OGNI installazione esistente, e se sbaglia l'apertura fallisce, il documento finisce
   *  nel ripiego localStorage da 5 MB e nessuno se ne accorge finche' una mappa grande non smette di
   *  salvarsi. Chi la alzera' di nuovo: le prove dell'aggiornamento si scrivono PRIMA della riga
   *  (test/allegati.test.js, sezione del piano 02-11). */
  const DB_VER = 2;
  const LS_DOC = 'vsm.doc' + (SUFFIX ? '.' + SUFFIX : '');
  /** «questo spazio e' stato svuotato apposta»: sopravvive all'azzeramento, e impedisce che la
   *  prima apertura successiva ricopi il documento dallo spazio di origine (v. V.load) */
  const SEGNO_AZZERATO = 'vsm.azzerato' + (SUFFIX ? '.' + SUFFIX : '');
  const giaAzzerato = () => { try { return localStorage.getItem(SEGNO_AZZERATO) === '1'; } catch (e) { return false; } };
  /** dove questa installazione tiene le mappe: serve alla schermata di diagnosi e alle prove */
  V.storage = () => ({ canale: CHANNEL, db: DB, chiave: LS_DOC });
  let idb = null;
  /** IDEMPOTENTE, e non e' un vezzo (02-RESEARCH.md §Pitfall 1): `createObjectStore` su uno store
   *  che esiste gia' lancia ConstraintError, la transazione di aggiornamento aborta, l'apertura
   *  fallisce e da quel momento TUTTE le mappe vivono in localStorage — in silenzio, con la sola
   *  spia gialla del salvataggio a dirlo. Quindi ogni store si crea solo se manca: da 0 (installazione
   *  nuova) ne nascono due, da 1 (chi aveva gia' l'app) nasce solo `allegati` e `kv` non si tocca.
   *  Nessuna migrazione di dati: il documento resta dov'e' e com'e' (nota di Gt del 26/8).
   *  `onblocked`: se un'altra scheda tiene ancora aperta la versione vecchia l'aggiornamento non
   *  parte — senza questa riga la promessa non si risolverebbe MAI e l'app resterebbe muta all'avvio
   *  invece di aprirsi col ripiego. */
  function openIdb() {
    return new Promise((res) => {
      if (!('indexedDB' in window)) return res(null);
      const r = indexedDB.open(DB, DB_VER);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
        if (!db.objectStoreNames.contains(ALLEG)) {
          // keyPath 'id': la chiave sta DENTRO il record, ed e' lo stesso id che il documento porta
          // in props.allegati[].id — le due meta' si ritrovano da li'. Gli indici servono a chiedere
          // «di questa mappa» e «di questo passo» senza scorrere tutto lo store.
          const s = db.createObjectStore(ALLEG, { keyPath: 'id' });
          s.createIndex('mapId', 'mapId', { unique: false });
          s.createIndex('stepId', 'stepId', { unique: false });
        }
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
      r.onblocked = () => res(null);
    });
  }
  // onabort accanto a onerror anche in LETTURA (debito D6): una transazione interrotta dal browser
  // non emette onerror, e senza questa riga la promessa resta appesa — V.load() non si chiude e
  // l'app resta sulla schermata di avvio, senza nemmeno ripiegare su localStorage e senza spia.
  // E' una readonly, quindi aborta di rado; ma il prezzo di quel «di rado» e' l'avvio dell'app.
  function idbGet(k) { return new Promise((res) => { if (!idb) return res(undefined); const tx = idb.transaction(STORE, 'readonly'); const rq = tx.objectStore(STORE).get(k); rq.onsuccess = () => res(rq.result); rq.onerror = () => res(undefined); tx.onabort = () => res(undefined); }); }
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
  /** Lo spazio TENUTO DA PARTE (02-RESEARCH.md §Pitfall 9): WebKit cancella i dati di un'origine
   *  che non riceve interazione da sette giorni, e lo sfratto e' totale — mappe E allegati insieme.
   *  `true` = il sistema ha accettato di tenerli da parte; `false` = ha detto di no; `null` = non
   *  gliel'abbiamo ancora chiesto, che NON e' un rifiuto e non va raccontato come tale.
   *  Le fonti si contraddicono su che cosa serva a Safari per concederlo: l'esito si GUARDA nella
   *  riga di diagnosi sull'iPad (assunzione A3 della ricerca), non si assume qui. */
  V.storage.persistente = null;
  V.storage.stima = null;
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

  /** ---------- gli ALLEGATI: i BYTE nello store `allegati` (F1-1C, D-12/D-14, piano 02-11) --------
   *  L'ALTRA meta' del sottosistema. I metadati — id, tipo, mime, dimensione, istante, giro — stanno
   *  nel documento e ci arrivano da V.allegaMeta (piano 02-10); qui stanno SOLO i byte, e nessuna di
   *  queste cinque funzioni tocca V.doc. L'ordine fra le due meta' lo decide chi chiama, ed e'
   *  dichiarato nel commento di V.allegOrfani: prima il commit sul documento (annullabile), poi —
   *  al V.load successivo — la spazzata dei byte. Al contrario si perderebbero dati veri.
   *
   *  La forma e' quella di idbSet, riga per riga, e le due cose che copia sono le due che contano:
   *  1) la promessa NON LANCIA MAI (risolve null/false/0), col try/catch attorno alla transazione —
   *     `idb.transaction` lancia da sola se lo store non c'e' (un'installazione mai aggiornata);
   *  2) `onabort` ACCANTO a `onerror`. Una transazione interrotta — quota esaurita, scheda chiusa a
   *     meta' — non emette onerror: senza onabort la promessa resterebbe appesa PER SEMPRE e la foto
   *     sparirebbe in silenzio. E' il bug vero raccontato dal commento di idbSet qui sopra, e sui
   *     byte di una camminata in reparto costerebbe piu' caro.
   *
   *  `buf` si salva come ArrayBuffer con il `mime` accanto, non come Blob (WebKit ha avuto bug sui
   *  Blob dentro IndexedDB): il Blob si ricostruisce alla lettura, in UI. */
  /** Quanto diventa grande una foto ridotta (F1-1C, D-13, 02-RESEARCH.md §Pattern 6). PURA, e sta
   *  QUI e non accanto al canvas per la stessa ragione di V.allegOrfani: in Node si prova, sul
   *  vetro no. Una moltiplicazione sbagliata qui non la vedrebbe nessuno — la foto entrerebbe lo
   *  stesso, solo grande dieci volte, e una camminata riempirebbe l'iPad.
   *  Tre regole, tutte e tre provate: `k` non supera MAI 1 (una foto piccola non si ingrandisce:
   *  si guadagnerebbero pixel finti e si perderebbe spazio), nessun lato scende sotto 1 (un canvas
   *  0xN non disegna niente e `toBlob` darebbe null, cioe' la foto sparirebbe in silenzio), e
   *  misure che non sono numeri veri ritornano `null` invece di un canvas NaN. */
  V.misuraRidotta = (w, h, latoMax) => {
    const n = (x) => (typeof x === 'number' && isFinite(x) && x > 0) ? x : null;
    const lw = n(w), lh = n(h), max = n(latoMax);
    if (!lw || !lh || !max) return null;
    const k = Math.min(1, max / Math.max(lw, lh));
    return { w: Math.max(1, Math.round(lw * k)), h: Math.max(1, Math.round(lh * k)) };
  };
  /** In che CONTENITORE si registra un memo vocale (F1-1C, D-12, 02-RESEARCH.md §Pattern 7).
   *  Si sceglie a runtime, mai a colpo sicuro: Safari 14.3→18.3 registrava solo audio/mp4 (AAC),
   *  dalla 18.4 anche webm/opus. E `isTypeSupported` NON esisteva su Safari 14.x — chiamarla lì
   *  avrebbe lanciato, e il memo non sarebbe partito affatto su un iPad vecchio, in reparto, senza
   *  che nessuno capisse perché: la guardia `typeof … === 'function'` è quella riga lì.
   *  `audio/mp4` è la PRIMA scelta anche dove webm è disponibile: è il formato che qualunque
   *  strumento di trascrizione futuro legge senza conversione, ed è quello che D-12 chiama
   *  «formato accessibile» (predisposto scalabile, senza costruire niente di quel futuro adesso).
   *  Stringa vuota = «scegli tu», che è quello che MediaRecorder fa col suo default.
   *  Sta nel modello, e non accanto al bottone, perché così una prova può metterle in mano un
   *  browser finto e guardare che cosa sceglie (stessa ragione di V.allegOrfani). */
  V.mimeMemo = () => {
    const MR = (typeof window !== 'undefined' && window) ? window.MediaRecorder : null;
    const ok = (t) => !!MR && typeof MR.isTypeSupported === 'function' && !!MR.isTypeSupported(t);
    return ok('audio/mp4') ? 'audio/mp4'
      : ok('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
        : '';
  };
  V.alleg = {
    /** Scrive i byte e ritorna il META da passare a V.allegaMeta — ma NON lo scrive nel documento:
     *  le due meta' restano separate. null = non scritto (nessun database, dati incompleti, quota). */
    metti: (mapId, elId, dati) => new Promise((res) => {
      if (!idb) return res(null);
      if (!dati || typeof dati !== 'object' || Array.isArray(dati)) return res(null);
      const giro = (typeof mapId === 'string' && mapId.trim()) ? mapId.trim() : null;
      if (!giro) return res(null);          // senza il giro non si saprebbe piu' di quale camminata sono
      const passo = (typeof elId === 'string' && elId.trim()) ? elId.trim() : null;
      if (!V.ALLEGATI_TIPI.includes(dati.tipo)) return res(null);   // elenco chiuso, come nel documento
      const mime = (typeof dati.mime === 'string' && dati.mime.trim()) ? dati.mime.trim() : null;
      if (!mime) return res(null);          // senza mime non si saprebbe come rileggerli
      const buf = dati.buf;
      if (!buf || typeof buf !== 'object' || typeof buf.byteLength !== 'number') return res(null);
      const extra = (dati.extra && typeof dati.extra === 'object' && !Array.isArray(dati.extra)) ? dati.extra : {};
      // l'id lo genera il modello (uid, lo stesso generatore degli elementi) con l'istante davanti:
      // e' la CHIAVE dei byte, e due allegati che se la scambiassero vorrebbe dire una foto scritta
      // sopra un'altra — cioe' perdita silenziosa
      const meta = Object.assign({}, extra, {
        id: 'al' + Date.now().toString(36) + uid(),
        tipo: dati.tipo, mime, size: buf.byteLength, at: Date.now(),
      });
      const record = Object.assign({}, meta, { mapId: giro, stepId: passo, buf });
      try {
        const tx = idb.transaction(ALLEG, 'readwrite');
        tx.objectStore(ALLEG).put(record);
        tx.oncomplete = () => res(meta);
        tx.onerror = () => res(null);
        tx.onabort = () => res(null);
      } catch (e) { res(null); }
    }),
    /** I byte di un id. `null` NON e' un errore: e' lo stato «non su questo dispositivo» di un
     *  foglio importato da un altro iPad (Pitfall 6), e la UI lo disegna come segnaposto. */
    prendi: (id) => new Promise((res) => {
      const chiave = (typeof id === 'string' && id.trim()) ? id.trim() : null;
      if (!idb || !chiave) return res(null);
      try {
        const tx = idb.transaction(ALLEG, 'readonly');
        const rq = tx.objectStore(ALLEG).get(chiave);
        rq.onsuccess = () => { const v = rq.result; res((v && v.buf) ? { mime: v.mime, buf: v.buf } : null); };
        rq.onerror = () => res(null);
        tx.onabort = () => res(null);
      } catch (e) { res(null); }
    }),
    /** true = c'era e non c'e' piu'; false = non c'era niente da togliere (non e' un errore) */
    togli: (id) => new Promise((res) => {
      const chiave = (typeof id === 'string' && id.trim()) ? id.trim() : null;
      if (!idb || !chiave) return res(false);
      try {
        const tx = idb.transaction(ALLEG, 'readwrite');
        const os = tx.objectStore(ALLEG);
        let cera = false;
        const rq = os.get(chiave);
        rq.onsuccess = () => { if (rq.result) { cera = true; os.delete(chiave); } };
        rq.onerror = () => { };
        tx.oncomplete = () => res(cera);
        tx.onerror = () => res(false);
        tx.onabort = () => res(false);
      } catch (e) { res(false); }
    }),
    /** gli id dei byte di una mappa, dall'indice `mapId`: chiedere «di questa mappa» senza scorrere
     *  tutto lo store — serve all'eliminazione di un foglio e alla galleria del pannello */
    perMappa: (mapId) => new Promise((res) => {
      const giro = (typeof mapId === 'string' && mapId.trim()) ? mapId.trim() : null;
      if (!idb || !giro) return res([]);
      try {
        const tx = idb.transaction(ALLEG, 'readonly');
        const rq = tx.objectStore(ALLEG).index('mapId').getAllKeys(giro);
        rq.onsuccess = () => res(Array.isArray(rq.result) ? rq.result : []);
        rq.onerror = () => res([]);
        tx.onabort = () => res([]);
      } catch (e) { res([]); }
    }),
    /** La spazzata: riceve gli id VIVI (quelli che il documento ricorda) e cancella i byte che non
     *  compaiono da nessuna parte. Chi decide che cosa cancellare NON e' questa funzione: e'
     *  V.allegOrfani, che e' pura e provata in Node senza database (Pitfall 3). Qui si obbedisce e
     *  si conta. Il verso non si inverte mai: un metadato senza byte non e' un orfano. */
    spazza: (idsVivi) => new Promise((res) => {
      if (!idb) return res(0);
      try {
        const tx = idb.transaction(ALLEG, 'readwrite');
        const os = tx.objectStore(ALLEG);
        let quanti = 0;
        const rq = os.getAllKeys();
        rq.onsuccess = () => {
          const fuori = V.allegOrfani(idsVivi, rq.result);
          quanti = fuori.length;
          fuori.forEach(k => os.delete(k));
        };
        rq.onerror = () => { };
        tx.oncomplete = () => res(quanti);
        tx.onerror = () => res(0);
        tx.onabort = () => res(0);
      } catch (e) { res(0); }
    }),
  };
  /** Gli id degli allegati VIVI: quelli che almeno un passo di almeno una mappa ricorda. Si legge
   *  dal documento gia' caricato e riparato — mai prima, o si spazzerebbero i byte di mappe che non
   *  sono ancora state lette. */
  const idsAllegatiVivi = () => {
    const out = [];
    const maps = (V.doc && V.doc.maps) || {};
    Object.keys(maps).forEach(k => {
      const m = maps[k];
      ((m && Array.isArray(m.elements)) ? m.elements : []).forEach(el => V.allegatiDi(el).forEach(a => out.push(a.id)));
    });
    return out;
  };
  /** La spazzata al caricamento (Pitfall 10 punto 2), col suo silenzio deliberato: un guasto qui NON
   *  deve poter impedire l'apertura del foglio. Una pulizia mancata e' rumore innocuo che si rifa' il
   *  giro dopo; un caricamento fermo sarebbe il lavoro di ieri irraggiungibile. */
  async function spazzaAllegatiOrfani() {
    try { await V.alleg.spazza(idsAllegatiVivi()); } catch (e) { /* si riprova al prossimo avvio */ }
  }
  /** Chiede al sistema di tenere da parte i dati (Pitfall 9). Una volta sola, all'apertura, e senza
   *  attese: niente dialoghi, niente `await`, se non si ottiene pazienza. L'esito finisce nella riga
   *  di diagnosi, che e' l'unico modo di sapere davvero come si comporta l'iPad di Gt. */
  let spazioChiesto = false;
  function chiediSpazio() {
    if (spazioChiesto) return;
    spazioChiesto = true;
    try {
      if (typeof navigator === 'undefined' || !navigator || !navigator.storage) return;
      const st = navigator.storage;
      if (typeof st.persist === 'function') {
        Promise.resolve(st.persist()).then((ok) => { V.storage.persistente = !!ok; }, () => { V.storage.persistente = false; });
      }
      if (typeof st.estimate === 'function') {
        Promise.resolve(st.estimate()).then((s) => { if (s && typeof s === 'object') V.storage.stima = { usage: s.usage, quota: s.quota }; }, () => { });
      }
    } catch (e) { /* un'API che lancia non deve fermare il caricamento */ }
  }
  /** copia una tantum del documento dallo spazio dell'app principale (serve alla beta la prima volta:
   *  senza, aprirla avrebbe mostrato una libreria vuota). L'originale non viene toccato. */
  async function travasoDaOrigine() {
    /** l'altro posto in cui l'app di origine puo' aver lasciato il documento: il suo ripiego */
    const daRipiego = () => { try { return localStorage.getItem('vsm.doc'); } catch (e) { return null; } };
    try {
      const vecchio = await new Promise((res) => {
        if (!('indexedDB' in window)) return res(null);
        // SENZA numero di versione: apre alla versione corrente, qualunque sia (02-RESEARCH.md
        // §Pitfall 2). Con la versione cablata a 1, il giorno in cui la stabile passa alla 2
        // questa riga prende un VersionError, il travaso risponde «niente da copiare» e la beta
        // si apre con la libreria VUOTA — proprio il caso per cui il travaso esiste.
        const r = indexedDB.open('vsm-coach');
        r.onupgradeneeded = () => { try { r.transaction.abort(); } catch (e) { } res(null); }; // non esisteva: niente da copiare
        r.onsuccess = () => res(r.result); r.onerror = () => res(null);
        r.onblocked = () => res(null);   // la stabile aperta in un'altra scheda: non si resta appesi
      });
      if (!vecchio) return daRipiego();
      // lo store si legge solo se c'e': senza questa guardia la transazione lancia NotFoundError,
      // il travaso risponde null e si perde anche quello che l'origine aveva scritto nel ripiego
      if (!vecchio.objectStoreNames.contains(STORE)) { try { vecchio.close(); } catch (e) { } return daRipiego(); }
      // onabort come in idbGet, e per la stessa ragione (debito D6): qui la promessa appesa
      // fermerebbe l'avvio della beta al primo giro, quello in cui il travaso serve davvero.
      const s = await new Promise((res) => { try { const tx = vecchio.transaction(STORE, 'readonly'); const rq = tx.objectStore(STORE).get('doc'); rq.onsuccess = () => res(rq.result); rq.onerror = () => res(null); tx.onabort = () => res(null); } catch (e) { res(null); } });
      try { vecchio.close(); } catch (e) { }
      return s || daRipiego();
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
    // I byte degli allegati, DOPO che il documento e' stato letto e riparato (piano 02-11): prima
    // non si saprebbe quali id sono vivi, e si cancellerebbero le foto di mappe non ancora lette.
    await spazzaAllegatiOrfani();
    chiediSpazio();
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
          // stessa cura per gli allegati (F1-1C, D-12): `allegati[].giro` e' un riferimento a un
          // FOGLIO come obs[].giro, non a un elemento — senza ext() una foto importata resterebbe
          // appesa all'id della mappa di CASA, cioe' direbbe di essere stata scattata in un giro
          // che non e' il suo (minaccia T-02-10-03, dal lato delle mappe invece che degli elementi)
          if (el.props && Array.isArray(el.props.allegati)) el.props.allegati.forEach(o => { if (o && o.giro != null) o.giro = ext(o.giro); });
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
  /** Le misure DEL FOGLIO (esito 13, 26/8): un giro nuovo clona i passi con le obs del giro
   *  precedente — quella e' STORIA (si legge nell'analisi), non misura di questo giro. Le viste
   *  vive (badge, resoconto, dialogo Misura, parziali, calcola i tempi) contano solo qui:
   *  giro assente (migrate 0.9, scritte prima del timbro) o uguale al foglio. */
  V.obsDelGiro = (el, map) => V.obsOf(el).filter(o => !o.giro || o.giro === (map && map.id));
  V.timesDelGiro = (el, map) => V.obsDelGiro(el, map).map(o => o.s);
  /** Il nome LEGGIBILE di cio' che e' stato misurato. Per un passo e' quello che il modello gia'
   *  usa dappertutto (V.nomePasso: titolo, o «Passo N» dalla sequenza della catena). Per un'ATTESA
   *  un titolo non c'e' quasi mai, e V.nomePasso da sola direbbe «passo senza nome»: chi rilegge il
   *  resoconto non saprebbe di quale attesa si parla. Si dice allora dal passo che la precede —
   *  l'attesa E' per definizione il tempo fra la fine di quel passo e l'inizio del successivo. */
  const nomeMisurato = (el, map) => {
    if (!el) return '—';
    if (el.type !== 'delta') return V.nomePasso(el, map);
    const t = String((el.props && el.props.title) || '').trim();
    if (t) return t;
    const conn = V.byId(el.props && el.props.attachedTo, map);
    const from = (conn && conn.from) ? V.byId(conn.from.el, map) : null;
    return from ? 'attesa dopo «' + V.nomePasso(from, map) + '»' : 'attesa';
  };
  /** L'elenco di FINE GIRO (F1-1C, D-16): le osservazioni di QUESTO giro che chi camminava ha
   *  segnato col ⚠ «qui e' andata diversa», su passi (box) E attese (delta), nell'ordine in cui
   *  sono state prese. E' la sorgente del resoconto di fine giro (piano 02-12): la parte pura sta
   *  qui, il dialogo sta la'. Il gesto «crea il problema sul foglio» NON vive in questa funzione —
   *  decide Gt che cosa promuovere (D-16), e promuovere e' una scrittura.
   *  PURA: nessun DOM, nessuna scrittura, nessuna eccezione su un foglio vuoto, senza elementi o
   *  senza cronometro. Non e' scrupolo: se lancia, il dialogo di fine giro non si apre e il giro
   *  appena camminato non lo rilegge nessuno (minaccia T-02-09-05).
   *  Le righe sono COPIE — `{ elId, tipo, label, s, at, i, nota? }` — e `i` e' l'indice nella lista
   *  SANA (V.obsOf), cioe' quello che V.setObs e posObs capiscono: dalla riga si riscrive la nota
   *  senza correzioni a valle.
   *  Si attraversano TUTTI gli elementi che hanno osservazioni, non solo box e delta: se un file
   *  confezionato ne portasse addosso a un altro tipo, l'elenco lo direbbe invece di nasconderlo.
   *  L'ordine e' quello della sparkline (T.sparklineSVG): per `at` crescente, con le misure senza
   *  istante davanti nell'ordine loro — l'ordine dell'array da solo mentirebbe su un documento
   *  riordinato da fuori. */
  V.diversiDelGiro = (map) => {
    if (!map || !Array.isArray(map.elements)) return [];
    const righe = [];
    map.elements.forEach(el => {
      V.obsOf(el).forEach((o, i) => {
        if (o.diverso !== true) return;                       // il segno e' binario: solo `true`
        if (o.giro && o.giro !== map.id) return;              // stesso criterio di V.obsDelGiro: la storia non e' di oggi
        const r = { elId: el.id, tipo: el.type, label: nomeMisurato(el, map), s: o.s, i,
          at: (typeof o.at === 'number' && isFinite(o.at)) ? o.at : null };
        if (typeof o.nota === 'string' && o.nota) r.nota = o.nota;
        righe.push({ r, k: righe.length });
      });
    });
    return righe.sort((a, b) => {
      const aa = (a.r.at == null) ? -Infinity : a.r.at, bb = (b.r.at == null) ? -Infinity : b.r.at;
      return aa === bb ? a.k - b.k : aa - bb;
    }).map(x => x.r);
  };
  /** Gli allegati SANI di un elemento (F1-1C, D-12): il lettore che il pannello, il conteggio e
   *  domani la galleria usano — mai `null`, mai una stringa, mai un'eccezione. Gemello esatto di
   *  V.obsOf: sanitizeMap ripara gia' i campi noti a ogni ingresso, questo filtro e' la SECONDA
   *  rete per chi scrive nel documento in memoria senza passare di la'.
   *  Sana = un oggetto vero, con un `id` (senza, i byte non si ritroverebbero mai) e un `tipo`
   *  dell'elenco chiuso (senza, la UI non saprebbe che cosa disegnare). */
  V.allegatiDi = (el) => (el && Array.isArray(el.props && el.props.allegati))
    ? el.props.allegati.filter(a => a && typeof a === 'object' && !Array.isArray(a)
      && typeof a.id === 'string' && a.id.trim() && V.ALLEGATI_TIPI.includes(a.tipo)) : [];
  /** Di QUESTO giro, o ereditati da un giro precedente (rilievo R-1C-02 del cancello 1C).
   *  Criterio identico a V.obsDelGiro, e non per simmetria estetica: `allegati[].giro` e
   *  `obs[].giro` sono la stessa cosa — un riferimento a un FOGLIO (map.id), scritto quando la
   *  voce nasce e rimappato insieme alle mappe da V.importMaps. «Crea un nuovo giro» copia il
   *  foglio con dentro le sue props, quindi in un giro nuovo un passo si porta appresso le foto
   *  di quello prima: senza queste due funzioni la sezione le mostrava indistinguibili da quelle
   *  raccolte oggi, ed e' esattamente la bugia che il cancello 1B aveva gia' pagato una volta col
   *  contatore N×.
   *  Si SEPARA, non si cancella: un'evidenza di ieri resta guardabile, deve solo dire che e' di
   *  ieri. La chiave assente vale «di questo giro» — e' la marca che manca ai documenti nati prima
   *  che questa marca esistesse, e sono per definizione del giro in cui si trovano.
   *  PURE tutte e due, e incapaci di lanciare su qualunque cosa: le chiama il disegno del pannello,
   *  e un'eccezione li' vorrebbe dire un passo che non si apre. */
  V.allegatiDelGiro = (el, map) => V.allegatiDi(el).filter(a => !a.giro || a.giro === (map && map.id));
  V.allegatiPerGiroPrecedente = (el, map) => {
    const out = [], dove = Object.create(null);
    V.allegatiDi(el).forEach(a => {
      if (!a.giro || a.giro === (map && map.id)) return;
      if (dove[a.giro] == null) { dove[a.giro] = out.length; out.push({ giro: a.giro, allegati: [] }); }
      out[dove[a.giro]].allegati.push(a);
    });
    return out;
  };
  /** «Su questo passo ci sono 3 foto e 1 memo: spariscono anche loro.» (D-15) — QUI escono solo i
   *  numeri; la frase la compone la UI (UI-SPEC §Copywriting), perche' il singolare e il plurale
   *  sono cose da schermo, non da modello.
   *  Con `elId` conta un elemento solo (si elimina un passo); senza, tutta la mappa (si elimina il
   *  foglio). E' il motivo numero uno per cui i metadati stanno nel DOCUMENTO e non solo in
   *  IndexedDB: la domanda di conferma si risponde in modo sincrono, senza aprire un database.
   *  PURA e incapace di lanciare, su qualunque cosa le si dia — map nullo, `elements` fuori tipo,
   *  un documento non ancora sanato. Non e' scrupolo: se lanciasse, il dialogo «spariscono anche
   *  loro» non si aprirebbe e il passo si cancellerebbe in silenzio con dentro le foto di un giro. */
  V.contaAllegati = (map, elId) => {
    const out = {};
    V.ALLEGATI_TIPI.forEach(t => { out[t] = 0; });   // dall'elenco, non a mano: una voce nuova si conta da sola
    out.totale = 0;
    const els = (map && Array.isArray(map.elements)) ? map.elements : [];
    const scelti = (elId == null) ? els : els.filter(e => e && e.id === elId);
    scelti.forEach(el => V.allegatiDi(el).forEach(a => { out[a.tipo]++; out.totale++; }));
    return out;
  };
  /** Il `mime` con cui si ricostruisce il Blob di un allegato — e la ragione per cui NON si prende
   *  quello scritto nel documento (F1-1C, minaccia T-02-13-01). Un file JSON confezionato puo'
   *  dichiarare `mime: 'text/html'` o `image/svg+xml` su una sua foto: se il pannello costruisse il
   *  Blob con quello, un allegato diventerebbe una pagina che esegue. Qui il TIPO comanda — e' un
   *  elenco chiuso (V.ALLEGATI_TIPI) — e il formato dichiarato passa solo se e' davvero uno dei
   *  formati di quel tipo. Altrimenti si ripiega su quello di casa: una foto resta un'immagine e un
   *  memo resta audio, qualunque cosa dica il file.
   *  Il ripiego NON e' una bugia: i byte sono quelli che sono, e se non si aprono la UI lo dice
   *  («Questo file non si apre piu'»). La bugia sarebbe fidarsi della parola del file.
   *  `null` = tipo fuori dall'elenco: non si disegna niente, non si apre niente. */
  const MIME_ALLEGATI = {
    foto: { ok: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], casa: 'image/jpeg' },
    memo: { ok: ['audio/mp4', 'audio/webm', 'audio/mpeg', 'audio/ogg', 'audio/aac', 'audio/wav'], casa: 'audio/mp4' },
  };
  V.mimeAllegato = (tipo, mime) => {
    const regola = MIME_ALLEGATI[tipo];
    if (!regola || !V.ALLEGATI_TIPI.includes(tipo)) return null;
    const m = (typeof mime === 'string') ? mime.split(';')[0].trim().toLowerCase() : '';
    return regola.ok.includes(m) ? m : regola.casa;
  };
  /** «3 foto e 1 memo»: l'enumerazione che entra nelle conferme distruttive (D-15, UI-SPEC
   *  §Copywriting). I NUMERI li da' V.contaAllegati; qui ci sono le parole, coi loro singolari —
   *  e stanno accanto ai numeri, e non nel pannello, per la stessa ragione di V.allegOrfani: cosi'
   *  una prova in Node le legge. Le FRASI intere («Su questo passo ci sono …: spariscono anche
   *  loro.») restano dove vive la copy, cioe' nella UI: qui c'e' solo l'elenco.
   *  Stringa vuota quando non c'e' niente da elencare: la frase non nasce affatto. */
  V.fraseAllegati = (conta) => {
    const c = conta || {};
    const pezzi = [];
    const n = (x) => (typeof x === 'number' && isFinite(x) && x > 0) ? Math.round(x) : 0;
    const f = n(c.foto), m = n(c.memo);
    // «foto» e «memo» sono invariabili in italiano: il singolare vive nel VERBO della frase che le
    // ospita («ci sono» / «c'è»), e quello lo mette la UI insieme al resto della copy
    if (f) pezzi.push(f + ' foto');
    if (m) pezzi.push(m + ' memo');
    return pezzi.join(' e ');
  };
  /** Gli allegati che il DOCUMENTO ricorda e di cui su questo iPad NON ci sono i byte (D-14,
   *  Pitfall 6). E' il gemello speculare di V.allegOrfani qui sotto, e le due funzioni guardano
   *  nella stessa scatola da due lati opposti — per questo stanno vicine:
   *  - V.allegOrfani: byte senza metadato → si CANCELLANO (rumore innocuo);
   *  - V.allegSenzaByte: metadato senza byte → NON si tocca niente, si MOSTRA un segnaposto.
   *  Confonderle sarebbe la perdita silenziosa che C-2 vieta: sono proprio gli allegati di un
   *  foglio importato da un altro iPad, cioe' l'informazione che D-14 esiste per non buttare via.
   *  PURA, e incapace di lanciare su qualunque cosa le si dia. */
  V.allegSenzaByte = (idsInDocumento, idsInDatabase) => {
    const ci = new Set((Array.isArray(idsInDatabase) ? idsInDatabase : []).filter(x => typeof x === 'string' && x));
    const visti = new Set(), fuori = [];
    (Array.isArray(idsInDocumento) ? idsInDocumento : []).forEach(id => {
      if (typeof id !== 'string' || !id || ci.has(id) || visti.has(id)) return;
      visti.add(id); fuori.push(id);
    });
    return fuori;
  };
  /** Quanti allegati di queste mappe sono rimasti sull'iPad dove sono stati presi. La usa il toast
   *  dopo un import (D-14): senza, i segnaposti comparirebbero nei pannelli e nessuno saprebbe
   *  perche'. Legge lo store una mappa alla volta dall'indice `mapId` (V.alleg.perMappa), e la
   *  decisione la prende V.allegSenzaByte, che e' pura e provata. Non lancia mai: al peggio conta 0.
   *  Ritorna una promessa di NUMERO, non di elenco: chi chiama deve dire quanti, non quali.
   *  Si chiede id per id con `prendi` e non in blocco con `perMappa` per una ragione precisa: un
   *  record che ESISTE ma non ha i byte dentro (mezza scrittura, transazione interrotta) risponde
   *  `null` a `prendi` ma la sua chiave comparirebbe lo stesso in `perMappa`. Il conto deve dire
   *  quello che il pannello mostrera', non quello che lo store ricorda di avere. */
  V.allegatiMancanti = (mapIds) => {
    const ids = (Array.isArray(mapIds) ? mapIds : []).filter(x => typeof x === 'string' && x);
    if (!ids.length) return Promise.resolve(0);
    const nelDoc = [];
    ids.forEach(id => {
      const map = (V.doc && V.doc.maps) ? V.doc.maps[id] : null;
      ((map && Array.isArray(map.elements)) ? map.elements : []).forEach(el => V.allegatiDi(el).forEach(a => nelDoc.push(a.id)));
    });
    if (!nelDoc.length) return Promise.resolve(0);
    return Promise.all(nelDoc.map(id => V.alleg.prendi(id).then(r => (r ? id : null)).catch(() => null)))
      .then(esiti => V.allegSenzaByte(nelDoc, esiti.filter(Boolean)).length)
      .catch(() => 0);
  };
  /** Gli id dei byte rimasti SENZA metadato (F1-1C, 02-RESEARCH.md §Pitfall 10 punto 2): quello che
   *  il piano 02-11 dovra' spazzare dallo store al `V.load` successivo.
   *  PURA per costruzione — due liste in ingresso, gli id da cancellare in uscita, nessun I/O,
   *  nessuna mutazione degli array ricevuti. Sta qui, e non accanto al database, proprio per questo:
   *  cosi' si prova in Node, dove IndexedDB non esiste (Pitfall 3) — l'harness non lo apre, e una
   *  spazzata provata «a occhio chiuso» sarebbe una cancellazione di dati mai verificata.
   *  Il verso conta: si spazza SOLO nella direzione database → documento. Un metadato senza byte
   *  NON e' un orfano e non si tocca: e' lo stato normale «l'allegato non e' su questo dispositivo»
   *  di un foglio importato da un altro iPad, e cancellarlo sarebbe la perdita silenziosa che
   *  Pitfall 6 e C-2 vietano. Byte senza metadato e' rumore innocuo; metadato senza byte e' storia.
   *
   *  ORDINE DICHIARATO DELLE CANCELLAZIONI — il piano 02-11 lo deve rispettare, ed e' l'unico
   *  ordine sicuro: PRIMA il commit sul documento (annullabile con ↶, vedi V.togliAllegatoMeta),
   *  POI — e solo al V.load successivo, non subito dopo la 🗑 — la spazzata dei byte. Al contrario,
   *  cancellare i byte subito renderebbe l'annulla una bugia: ↶ riporterebbe un metadato che punta
   *  al vuoto. E se l'app muore in mezzo restano byte senza metadato, che si spazzano il giro dopo;
   *  l'ordine inverso lascerebbe metadati senza byte, cioe' perdita vera. */
  V.allegOrfani = (idsInDocumento, idsInDatabase) => {
    const tenuti = new Set((Array.isArray(idsInDocumento) ? idsInDocumento : []).filter(x => typeof x === 'string' && x));
    const visti = new Set(), fuori = [];
    (Array.isArray(idsInDatabase) ? idsInDatabase : []).forEach(id => {
      if (typeof id !== 'string' || !id || tenuti.has(id) || visti.has(id)) return;
      visti.add(id); fuori.push(id);
    });
    return fuori;
  };
  /** I tempi scritti (Hi/Lo/Avg) portano la FIRMA del foglio che li ha scritti (props.tempiGiro,
   *  esito 13): sul giro nuovo, clonati, sono EREDITATI — si mostrano attenuati con «giro prec.»
   *  finche' questo giro non li riscrive (calcola i tempi, o modifica a mano). Senza firma
   *  (documenti vecchi) sono del foglio: default sicuro, nessun fantasma inventato. */
  V.tempiEreditati = (el, map) => !!(el && el.props && typeof el.props.tempiGiro === 'string' && el.props.tempiGiro && map && el.props.tempiGiro !== map.id);
  /** Hi = massimo, Lo = minimo, Avg = media aritmetica (Fig. 5.1). Niente esclusione automatica degli
   *  outlier: chi ha osservato sa se quel 19 era un caso eccezionale o il sintomo di un problema a
   *  monte — l'app li mostra, non decide. */
  V.timeStats = (times) => {
    const t = (times || []).filter(x => typeof x === 'number' && isFinite(x) && x >= 0);
    if (!t.length) return { hi: null, lo: null, avg: null, n: 0 };
    return { hi: Math.max.apply(null, t), lo: Math.min.apply(null, t), avg: t.reduce((a, b) => a + b, 0) / t.length, n: t.length };
  };
  /** L'origine EFFETTIVA della terna Hi/Lo/Avg (F1-1B), come la legge chi la deve mostrare: una
   *  delle quattro voci, 'calcolato', oppure undefined = «origine non dichiarata».
   *  Quella dichiarata da una PERSONA vale l'ultimo valore e non si mette in discussione (D-21).
   *  'calcolato' invece e' una dichiarazione della macchina, e la macchina puo' ricontrollarla:
   *  vale finche' i tre numeri sono ancora quelli che «Calcola i tempi» scriverebbe dalle misure
   *  di questo giro. Se qualcuno ne riscrive uno a mano dal pannello, la terna non e' piu'
   *  calcolata e la marca decade DA SOLA — nessuno deve ricordarsi di toglierla, e l'app non
   *  finisce a dichiarare «calcolato» un numero che si e' inventato una persona.
   *  I tempi EREDITATI da un giro precedente (tempiGiro di un altro foglio) non si possono
   *  ricontrollare da qui: erano calcolati e restano tali, il fantasma «(giro prec.)» lo dice gia'.
   *  Pura: nessuna scrittura, si prova in Node. */
  V.fonteDatiDi = (el, map) => {
    const f = el && el.props && el.props.fonteDati;
    if (!FONTI_DATI.includes(f)) return undefined;
    if (f !== 'calcolato') return f;
    if (V.tempiEreditati(el, map)) return 'calcolato';
    const s = V.timeStats(V.timesDelGiro(el, map));
    if (!s.n) return undefined;
    const u = map && map.unit;
    const uguale = (k, v) => String(el.props[k] == null ? '' : el.props[k]) === fmt(V.toUnit(v, u));
    return (uguale('hi', s.hi) && uguale('lo', s.lo) && uguale('avg', s.avg)) ? 'calcolato' : undefined;
  };
  /** Che cosa c'è da scrivere, prima di scriverlo: un elenco di passi e attese con quante misure
   *  hanno, i conti già nell'unità del foglio, se avevano tempi scritti a mano (non si sovrascrive in
   *  silenzio) e se sono validati (quelli non si toccano). */
  V.timesReport = (map) => {
    if (!map) return [];
    // solo le misure DI QUESTO giro (esito 13): le ereditate dal giro precedente sono storia —
    // non si elencano, non si scartano da qui, non entrano in «calcola i tempi». idx = posizione
    // di ciascuna nella lista sana COMPLETA (V.obsOf): e' l'indice che dropTime/setObs capiscono.
    return map.elements.filter(e => (e.type === 'box' || e.type === 'delta') && V.obsDelGiro(e, map).length).map(e => {
      const idx = []; V.obsOf(e).forEach((o, i) => { if (!o.giro || o.giro === map.id) idx.push(i); });
      const t = V.timesDelGiro(e, map); const s = V.timeStats(t);
      return {
        id: e.id, type: e.type, n: t.length, times: t, idx, brevi: t.filter(x => x < V.MISURA_BREVE).length,
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
      // la FIRMA (tempiGiro, esito 13): questi numeri sono di questo giro — sul clone del
      // prossimo giro si mostreranno come ereditati finche' quello non li riscrive.
      // fonteDati:'calcolato' (F1-1B): chi calcola dichiara da se' l'origine della terna, nello
      // STESSO commit — nessun commit in piu', nessuna classe diversa, e niente da chiedere a
      // nessuno. E' la quinta voce interna (FONTI_DATI): non compare nel menu delle quattro.
      ops.push({ t: 'props', id: r.id, after: { hi: fmt(r.stats.hi), lo: fmt(r.stats.lo), avg: fmt(r.stats.avg), tempiGiro: map.id, fonteDati: 'calcolato' } });
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
  /** Ogni fase nuova del giro riparte pulita: le pause appartengono alla misura chiusa, e il ⚠
   *  «qui e' andata diversa» (F1-1C, D-10) appartiene al PASSO che l'ha meritato. Si chiamava
   *  senzaPause: adesso il nome dice la regola intera, perche' i due campi muoiono per lo stesso
   *  motivo — sono del segmento di misura appena finito, non della sessione. Dal piano 02-12 muore
   *  qui anche la NOTA VELOCE pendente (`nota`): e' la nota di quel ⚠, e senza il suo segno
   *  finirebbe addosso alla misura successiva, che nessuno ha segnato.
   *  ATTENZIONE, e' il punto in cui e' facile sbagliare: `turno` e `chi` vanno nella direzione
   *  OPPOSTA (sono della sessione e sopravvivono al lap, vedi chiudi()/measureAbort/measureStart).
   *  Un `diverso` che sopravvivesse qui marcherebbe come «diversi» passi che nessuno ha segnato. */
  const faseNuova = (s) => { const d = Object.assign({}, s); delete d.pausedAt; delete d.pausedTot; delete d.diverso; delete d.nota; return d; };
  /** Le chiavi della SESSIONE di misura: dichiarate una volta nel dialogo d'ingresso, viaggiano su
   *  ogni misura finche' la sessione vive — il turno (F1) e chi osserva (F1-1C, D-11). Sopravvivono
   *  al lap, alla misura eliminata e all'avvio successivo; muoiono con «chiudi il giro».
   *  ELENCO UNICO, e non e' pedanteria: i posti che ricostruiscono lo stato del cronometro sono
   *  cinque, e la volta scorsa che erano cinque ternari copiati uno se n'era dimenticato — il ramo
   *  di chiusura naturale del giro perdeva il turno (rilievo Kimi #1 di F1, GRAVE, sfuggito anche
   *  al round Codex). Aggiungere una chiave di sessione adesso vuol dire toccare una riga sola. */
  const dellaSessione = (s) => {
    const d = {};
    ['turno', 'chi'].forEach(k => { if (s && typeof s[k] === 'string' && s[k]) d[k] = s[k]; });
    return d;
  };
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
    // D8: e nemmeno su un giro chiuso. La barriera sta PRIMA di aprire il giro, non dopo: se il
    // cronometro partisse e poi V.allowed rifiutasse la scrittura, il tempo scorrerebbe per niente
    // e la misura sparirebbe alla chiusura — la perdita silenziosa che il cancello 1B ha gia'
    // pagato una volta (V.measureStop che buttava via la misura senza scriverla e senza dirlo).
    if (V.giroChiuso(map)) return null;
    const prec = V.measureState(map);
    // Una misura APERTA (passo o attesa, anche in pausa) non si straccia mai in silenzio (C5 del
    // triage debug 25/8, Grok #4): sul canvas misTap gia' rifiutava («chiudilo prima»), ma il
    // dialogo con «solo questo passo» sostituiva map.measure e il lap spariva senza scrivere
    // niente. La barriera sta qui, nel modello: ogni chiamante riceve lo stesso no.
    if (prec && prec.phase && prec.t0) return { ko: 'in-corso' };
    const s = { mode, giro: (prec && prec.giro) || 1, stepId, phase: 'box', t0: now, fromId: null, connId: null };
    // turno e chi osservano sono della SESSIONE di misura (F1 Task 4, F1-1C D-11): dichiarati a
    // giro pronto o in corso, sopravvivono agli avvii successivi finche' la sessione vive — sempre
    // visibili nei campi del dialogo Misura, mai un'eredita' silenziosa. Muoiono con «chiudi il
    // giro» (measureStop). Il ⚠ no: e' del passo, e uno stato fresco nasce senza.
    Object.assign(s, dellaSessione(prec));
    return setMeasure(map, s);
  };
  /** «Chiudi il giro». Chiudere e' sempre lecito, ma NON e' mai stato «butta via quello che sta
   *  correndo»: per quello ci sono due comandi che lo dicono a chiare lettere (il 🗑 della barra,
   *  V.measureAbort, e «scarta», V.measureDiscard). Finche' questa chiudeva e basta, il ⏹ era un
   *  terzo modo di perdere una misura, muto — e nella prova a mano del 27/8 se ne sono perse tre
   *  di fila: chi misurava vedeva il contatore del passo fermo a 1× dopo aver cronometrato due
   *  volte. Perdita silenziosa di dati, il primo rilievo di review dichiarato in AGENTS.md.
   *  Adesso: un PASSO che sta correndo si registra come lo registrerebbe «passo finito» (stesso
   *  addTime, nessuna via di scrittura nuova). Un'ATTESA no, e non per pigrizia: l'attesa e' per
   *  definizione il tempo fra la fine di un passo e l'INIZIO del successivo — chiudendo il giro
   *  quel passo non comincia mai, e scriverla vorrebbe dire inventarle una fine. Non si scrive, ma
   *  non si tace: il ritorno dice quanti secondi sono rimasti fuori, cosi' la barra puo' dirlo.
   *  Ritorna null se non correva niente; { scritta, elId, seconds } o { scritta:false, persa, seconds }. */
  V.measureStop = (map, now = Date.now()) => {
    const esito = registraCorrente(map, now);
    setMeasure(map, null);
    return esito;
  };
  /** La REGOLA di che cosa succede alla misura che sta correndo quando qualcosa la interrompe.
   *  Vive in un posto solo perche' i modi di interrompere sono due (il ⏹ della barra e, dal 27/8,
   *  il tocco su un altro passo per rimisurarlo) e devono rispondere allo stesso modo: se
   *  divergessero, uno dei due tornerebbe a essere un modo muto di perdere una misura.
   *  Non chiude e non apre niente: scrive (o dichiara di non aver potuto), e basta. */
  const registraCorrente = (map, now) => {
    const s = V.measureState(map);
    if (!s || !s.phase || !s.t0) return null;
    const sec = misuraNetta(s, now);
    if (s.phase === 'attesa') return { scritta: false, persa: 'attesa', seconds: sec };
    const passo = V.byId(s.stepId, map);
    // il passo cancellato sotto il cronometro, il foglio col lucchetto, la ✓ del passo:
    // addTime dice di no e il giro si chiude lo stesso — chiudere non si nega mai
    if (!passo || passo.type !== 'box') return { scritta: false, persa: 'passo', seconds: sec };
    if (map.validated || !addTime(map, s.stepId, sec)) return { scritta: false, persa: 'rifiutata', seconds: sec };
    return { scritta: true, elId: s.stepId, seconds: sec };
  };
  /** «Misura di nuovo quel passo» (decisione di Gt, 27/8 — rilievo 3 del cancello 1B). Toccare
   *  l'orologio di un passo mentre il giro corre su un altro rispondeva «C'e' un passo in corso:
   *  chiudilo prima di sceglierne un altro»: una frase fuorviante, perche' chi tocca non voleva
   *  sceglierne un altro — voleva rimisurare QUELLO. Adesso il cronometro si riapre li', e la
   *  misura nuova si accoda alle sue (addTime appende: il modello lo reggeva gia').
   *  Due guardie, e sono la sostanza:
   *  - si rimisura solo un passo GIA' MISURATO IN QUESTO GIRO (V.obsDelGiro, esito 13): su un
   *    passo mai misurato il tocco vorrebbe dire «salta la sequenza», che e' un'altra cosa e ha
   *    gia' la sua via (il giro, i bivi, measureJump). Le misure clonate dal giro precedente non
   *    contano: sono storia, non misure di oggi.
   *  - quello che stava correndo NON si perde: passa da registraCorrente, la stessa regola del ⏹.
   *  Ritorna { ok, elId, prima } dove `prima` e' l'esito di cio' che correva (null se niente),
   *  oppure { ko } — 'mai-misurato', 'fuori-fase', 'chiuso'. */
  V.measureRimisura = (map, stepId, now = Date.now()) => {
    const el = V.byId(stepId, map);
    if (!el || el.type !== 'box' || el.props.validated) return { ko: 'chiuso' };
    if (map.validated) return { ko: 'chiuso' };
    if (!['misura', 'analizza'].includes(map.phase)) return { ko: 'fuori-fase' };
    if (V.giroChiuso(map)) return { ko: 'giro-chiuso' };   // D8, stessa ragione di measureStart
    if (!V.obsDelGiro(el, map).length) return { ko: 'mai-misurato' };
    const s = V.measureState(map);
    const prima = registraCorrente(map, now);
    // il numero del giro, il turno e chi osserva appartengono alla SESSIONE, non al lap:
    // sopravvivono al cambio di passo esattamente come sopravvivono a measureStart
    const dopo = Object.assign({ mode: 'singolo', giro: (s && s.giro) || 1, stepId, phase: 'box', t0: now, fromId: null, connId: null }, dellaSessione(s));
    // 'singolo' e non 'giro': si e' usciti dalla catena per tornare su un passo gia' fatto, e da
    // qui nessuna attesa puo' nascere per differenza — inventarne una sarebbe un numero falso.
    // Chiuso il passo col ⏩, il giro resta PRONTO e la catena si riprende da dove si vuole.
    return setMeasure(map, dopo) ? { ok: true, elId: stepId, prima } : { ko: 'chiuso' };
  };
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
    // DUE TEMPI (esito 14, 26/8: «uno crede di selezionare il passo e in realtà fa partire il
    // timer»): il tocco sul passo GIÀ puntato avvia la misura (il flusso lineare di sempre);
    // il tocco su un ramo DIVERSO è solo la SCELTA — la strada si illumina (connId nuovo),
    // l'attesa continua a correre, e si parte col ▶ della barra (o ritoccando il passo scelto).
    if (stepId === s.stepId) return V.measureAdvance(map, now);
    const conn = map.elements.find(c => c.type === 'flow' && c.from && c.from.el === s.fromId && c.to && c.to.el === stepId);
    if (conn) {
      setMeasure(map, Object.assign({}, s, { stepId, connId: conn.id }));
      return { scelto: true, elId: stepId };
    }
    const persa = misuraNetta(s, now);
    setMeasure(map, faseNuova(Object.assign({}, s, { phase: 'box', stepId, t0: now, fromId: null, connId: null })));
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
  /** «Qui e' andata diversa» (F1-1C, D-10): un tocco in barra segna il passo CHE STA CORRENDO, e il
   *  giro non si ferma mai — l'esempio di Gt e' l'infermiere che deve correre a cercare la cartella
   *  mentre tu cronometri l'accettazione. Il segno e' BINARIO: se quella deviazione sia un problema,
   *  un'utilita' o niente lo decide la Phase 3, non l'app e non adesso.
   *  Vive in map.measure come il turno (fuori dall'annulla), ma con la vita OPPOSTA: e' del passo in
   *  corso, quindi muore al lap (faseNuova) e non c'e' negli elenchi di chi sopravvive.
   *  Senza una misura che corre non c'e' un passo a cui il segno appartenga: null, e non si scrive
   *  niente — un ⚠ appeso al giro fermo finirebbe addosso al passo successivo, che nessuno ha segnato.
   *  Non tocca t0 ne' le pause: il tempo viene dall'orologio di parete e questa funzione non lo sfiora. */
  V.measureDiverso = (map, on) => {
    const s = V.measureState(map); if (!s || !s.phase || !s.t0) return null;
    const dopo = Object.assign({}, s);
    if (on === true) dopo.diverso = true;
    // «Togli il segno» (UI-SPEC §3): se ne va anche la nota veloce che il segno aveva chiamato.
    // Una nota senza il suo ⚠ viaggerebbe lo stesso con addTime e finirebbe addosso a una misura
    // che nessuno ha segnato — la stessa famiglia di T-02-09-01, presa dal lato della nota.
    else { delete dopo.diverso; delete dopo.nota; }                   // solo `true`: il segno e' binario
    return setMeasure(map, dopo);
  };
  /** La NOTA VELOCE del ⚠ (F1-1C, D-10, piano 02-12): «che cosa e' andato diverso», dettata o
   *  scritta MENTRE il passo corre — quando l'osservazione non esiste ancora, perche' nascera' solo
   *  al lap. Sta quindi nel cronometro accanto al segno e la travasa addTime, esattamente come il
   *  turno: e' l'unica via che tiene in piedi la porta delle fasi, la ✓ del passo e l'annulla.
   *  Scrivere un'osservazione dalla UI, fuori da addTime/V.setObs, sarebbe la scorciatoia vietata
   *  (T-02-12-06). Quando l'osservazione ESISTE gia' — dal resoconto di fine giro, con l'indice che
   *  V.diversiDelGiro riporta — la nota si riscrive con V.setObs, non di qui.
   *  Vive come il ⚠, non come il turno: e' del passo in corso e muore al lap (faseNuova), con
   *  «scarta» (measureDiscard), col 🗑 (measureAbort) e all'ingresso successivo (sanitizeMap).
   *  Testo vuoto o soli spazi la tolgono; senza una misura che corre non c'e' dove scriverla. */
  V.measureNota = (map, testo) => {
    const s = V.measureState(map); if (!s || !s.phase || !s.t0) return null;
    const t = (typeof testo === 'string') ? testo.trim() : '';
    const dopo = Object.assign({}, s);
    if (t) dopo.nota = t; else delete dopo.nota;
    return setMeasure(map, dopo);
  };
  /** «Chi osserva» (F1-1C, D-11): chiesto nella stessa domanda d'ingresso del giro insieme al turno,
   *  facoltativo e saltabile. E' il RUOLO o le INIZIALI di chi guarda il processo — «caposala»,
   *  «inf. MR» — mai il nome di chi nel processo ci passa: l'invariante privacy vale qui come
   *  altrove, e il campo dell'interfaccia (piano 02-12) lo dice nel suo segnaposto.
   *  Gemello esatto di V.measureTurno, sessione compresa: testo vuoto lo toglie, e senza cronometro
   *  non c'e' dove scriverlo. Sopravvive al lap perche' e' della SESSIONE, non del passo. */
  V.measureOsservatore = (map, testo) => {
    const s = V.measureState(map); if (!s) return null;
    const t = (typeof testo === 'string') ? testo.trim() : '';
    const dopo = Object.assign({}, s);
    if (t) dopo.chi = t; else delete dopo.chi;
    return setMeasure(map, dopo);
  };
  /** Butta via la misura in corso e riparte da adesso: chi cammina si accorge subito quando la misura
   *  non vale (una telefonata, un'interruzione che non c'entra) e deve poterla annullare senza
   *  perdere il giro. */
  V.measureDiscard = (map, now = Date.now()) => {
    const s = V.measureState(map); if (!s || !s.phase) return null;
    return setMeasure(map, faseNuova(Object.assign({}, s, { t0: now })));
  };
  /** ELIMINA la misura in corso (esito 12-bis, caso 1: «era il passo sbagliato»): il lap si
   *  butta SENZA scrivere niente e il giro resta pronto — numero e turno sopravvivono, il
   *  cronometro non punta più a nulla. Diverso da measureDiscard (riparte da adesso sullo
   *  STESSO passo) e da measureStop (chiude la sessione). Lo chiama il cestino della barra,
   *  col doppio tocco. */
  V.measureAbort = (map) => {
    const s = V.measureState(map); if (!s || !s.phase || !s.t0) return null;
    const dopo = Object.assign({ mode: s.mode, giro: s.giro || 1, stepId: null, phase: null, t0: null, fromId: null, connId: null },
      dellaSessione(s));   // turno e chi osserva restano; il ⚠ no — segnava la misura appena buttata
    // il passo abbandonato resta scritto (esito 12-ter): la barra non sparisce — mostra il
    // cronometro SOSPESO con un ▶ che riavvia da qui. measureStart costruisce uno stato fresco,
    // quindi ripartendo (da qui o da un altro passo) il sospeso muore da solo.
    if (s.stepId) dopo.sospeso = s.stepId;
    return setMeasure(map, dopo) ? { ok: true } : null;
  };
  /** Scrive l'osservazione PIENA (spec A4): secondi, quando (Date.now, non null: non è una migrata
   *  dalla 0.9) e in che giro del foglio (map.id: il giro è il foglio su cui si sta misurando, non
   *  un numero — due giri diversi non condividono mai un measure, M8.4). Fuori dall'annulla, come
   *  il resto del cronometro: chi cammina il processo non deve poter disfare una misura con ↩. */
  const addTime = (map, elId, sec) => {
    const el = V.byId(elId, map); if (!el) return false;
    // fonte:'osservato' (F1-1B, D-05): il cronometro E' l'osservazione diretta — chi ha in mano il
    // tablet sta guardando il processo mentre succede. Non c'e' niente da chiedere, e una parola in
    // piu' nello stesso oggetto letterale evita l'unica origine che l'app puo' dichiarare da sola.
    const oss = { s: sec, at: Date.now(), giro: map.id, cls: 'normale', fonte: 'osservato' };
    // il turno dichiarato per il giro (V.measureTurno, F1) viaggia su ogni osservazione: e' un
    // attributo della misura presa, non del cronometro — e resta leggibile dopo che il giro chiude
    const t = map.measure && map.measure.turno;
    if (typeof t === 'string' && t) oss.turno = t;
    // il ⚠ del passo in corso (F1-1C, D-10) viaggia con la misura che nasce: e' di QUESTA misura,
    // e appena scritto muore nel cronometro (faseNuova) — la prossima non lo eredita.
    if (map.measure && map.measure.diverso === true) oss.diverso = true;
    // e con lui la sua NOTA VELOCE (D-10, piano 02-12): scritta mentre il passo correva, quando
    // questa osservazione non c'era ancora. Stessa vita del ⚠ — appena travasata muore nel
    // cronometro (faseNuova), e la misura successiva non se la ritrova addosso.
    const nt = map.measure && map.measure.nota;
    if (typeof nt === 'string' && nt) oss.nota = nt;
    // chi osserva (D-11), come il turno: un attributo della misura presa, non del cronometro —
    // resta leggibile dopo che il giro chiude, e dice a chi rilegge chi c'era col tablet in mano
    const chi = map.measure && map.measure.chi;
    if (typeof chi === 'string' && chi) oss.chi = chi;
    // si appende all'array ORIGINALE, non a V.obsOf: ricostruire dalla lista sana avrebbe fatto
    // sparire un'osservazione marcia alla prima misura nuova (rilievo Kimi #3, via sorella di Codex #1)
    const raw = Array.isArray(el.props.obs) ? el.props.obs : [];
    return V.commit({ t: 'props', id: elId, after: { obs: raw.concat([oss]) } }, 'misura', { map, silent: true });
  };
  /** Cambia cls, nota, valore o ORIGINE di UNA osservazione (F1 + F1-1B, interp. 6): un giudizio
   *  UMANO («questa era un'eccezione», «c'era un'interruzione», «questo me l'hanno detto»), non il
   *  cronometro — quindi commit NORMALE, con la sua voce di annulla (D-21). cls o fonte fuori
   *  elenco, o indice fuori posto: false, niente scritto.
   *  Con addTime e' l'UNICA via di scrittura di un'osservazione: chi vuole scrivere un'origine
   *  passa di qui, e quindi passa dalla porta delle fasi e dalla ✓ del passo. */
  V.setObs = (map, elId, i, campi) => {
    const el = V.byId(elId, map); if (!el) return false;
    const c = campi || {};
    if (c.cls !== undefined && !['normale', 'particolare', 'eccezionale'].includes(c.cls)) return false;
    if (c.nota !== undefined && typeof c.nota !== 'string') return false;
    // il VALORE si corregge a mano (decisione Gt 26/8, stazione 12-C: flessibilita', ogni misura
    // modificabile a posteriori): numeri veri non negativi, arrotondati al secondo come quelli
    // che scrive il cronometro
    if (c.s !== undefined && !(typeof c.s === 'number' && isFinite(c.s) && c.s >= 0)) return false;
    // l'ORIGINE (F1-1B): una delle quattro voci dichiarate, oppure null / '' per TOGLIERLA e
    // tornare a «origine non dichiarata». Fuori di li' non si scrive niente e si dice false —
    // l'app non ripiega mai su un'origine che nessuno ha detto (D-06/D-07).
    if (c.fonte !== undefined && c.fonte !== null && c.fonte !== '' && !V.FONTI.includes(c.fonte)) return false;
    if (c.fonteNota !== undefined && typeof c.fonteNota !== 'string') return false;
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
      if (c.fonte !== undefined) { if (c.fonte) n.fonte = c.fonte; else delete n.fonte; }
      if (c.fonteNota !== undefined) { if (c.fonteNota.trim()) n.fonteNota = c.fonteNota.trim(); else delete n.fonteNota; }
      if (c.s !== undefined) n.s = Math.round(c.s);
      return n;
    });
    return V.commit({ t: 'props', id: elId, after: { obs: dopo } }, 'osservazione riletta', { map });
  };
  /** ---------- gli ALLEGATI: le due vie di scrittura dei METADATI (F1-1C, D-12/D-13/D-15) ----------
   *  Qui dentro si tocca SOLO il documento: nessun accesso a IndexedDB, nessuna promessa, nessun
   *  byte. I byte li scrive e li cancella il piano 02-11, e l'ordine fra le due meta' e' dichiarato
   *  nel commento di V.allegOrfani — prima il documento (annullabile), poi i byte.
   *
   *  Commit NORMALE, non silenzioso: a differenza di addTime e dropTime — che sono gesti del
   *  cronometro — allegare e togliere un allegato sono gesti di una persona che decide, e la 🗑
   *  «facile» del pannello (D-15) dev'essere recuperabile con ↶ (D-21, Pitfall 10 punto 3).
   *  Passano quindi dalla porta unica delle fasi e dalla ✓ del passo, come V.setObs. */
  const metaAllegato = (v) => { const n = num(v); return (n != null && n >= 0) ? n : undefined; };
  V.allegaMeta = (map, elId, meta) => {
    if (!map || !Array.isArray(map.elements)) return false;
    const el = V.byId(elId, map); if (!el) return false;
    // si VALIDA prima di scrivere: dopo il commit sarebbe tardi, e mezza scrittura su una lista
    // di allegati vorrebbe dire una riga che non ritrova i suoi byte
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return false;
    const id = (typeof meta.id === 'string' && meta.id.trim()) ? meta.id.trim() : null;
    if (!id) return false;                                       // l'id E' la chiave dei byte nello store
    if (!V.ALLEGATI_TIPI.includes(meta.tipo)) return false;       // elenco chiuso: decide lui come si mostra, mai il mime
    if (typeof meta.mime !== 'string' || !meta.mime.trim()) return false;
    // si riscrive una COPIA dell'array ORIGINALE, non di V.allegatiDi (rilievo Codex #1 di F1,
    // stessa via di addTime e V.setObs): ricostruire dalla lista sana farebbe sparire in silenzio
    // una riga marcia arrivata da fuori — la sana sanitizeMap al prossimo ingresso, non una rilettura
    const raw = Array.isArray(el.props.allegati) ? el.props.allegati : [];
    // due metadati con lo stesso id sono un doppione, non due allegati: punterebbero allo stesso
    // record dello store, e togliendone uno l'altro resterebbe a indicare byte gia' cancellati
    if (raw.some(a => a && typeof a === 'object' && a.id === id)) return false;
    // dall'oggetto ORIGINALE, cosi' le chiavi che non conosciamo sopravvivono (A5), come in sanitize
    const riga = Object.assign({}, meta, { id, mime: meta.mime.trim() });
    ['size', 'w', 'h', 'dur'].forEach(k => { if (riga[k] !== undefined) { const n = metaAllegato(riga[k]); if (n === undefined) delete riga[k]; else riga[k] = n; } });
    // istante e giro si timbrano qui se non arrivano gia' scritti, come fa addTime nel suo oggetto
    // letterale: un allegato senza istante non si sa quando e' stato preso, e senza giro non si sa
    // di quale camminata e' — due cose che dopo, a foglio chiuso, non si ricostruiscono piu'
    const at = metaAllegato(meta.at); riga.at = (at === undefined) ? Date.now() : at;
    if (typeof riga.giro !== 'string' || !riga.giro.trim()) riga.giro = map.id;
    return V.commit({ t: 'props', id: elId, after: { allegati: raw.concat([riga]) } }, 'allega', { map });
  };
  V.togliAllegatoMeta = (map, elId, id) => {
    if (!map || !Array.isArray(map.elements)) return false;
    const el = V.byId(elId, map); if (!el) return false;
    if (typeof id !== 'string' || !id.trim()) return false;
    const raw = Array.isArray(el.props.allegati) ? el.props.allegati : null;
    if (!raw) return false;
    const chiave = id.trim();
    const suo = (a) => a && typeof a === 'object' && a.id === chiave;
    if (!raw.some(suo)) return false;                            // niente da togliere: si dice false, non si riscrive a vuoto
    // filter sull'array ORIGINALE: le righe marce che stanno in mezzo restano dove sono — togliere
    // un allegato non e' l'occasione per fare pulizia di dati che nessuno ha chiesto di buttare
    const dopo = raw.filter(a => !suo(a));
    // lista svuotata: la chiave se ne va (`undefined`), come fa l'igiene — props.allegati esiste
    // solo quando c'e' almeno un allegato, esattamente come props.obs. L'annulla la riporta intera:
    // op.before ha l'array di prima, e il commit sa ricordare anche un «questa chiave non c'era».
    return V.commit({ t: 'props', id: elId, after: { allegati: dopo.length ? dopo : undefined } }, 'togli un allegato', { map });
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
    // Elenco delle chiavi da TENERE: quello che non c'e' muore qui. Turno e chi osserva sono della
    // sessione, non del singolo giro (F1, F1-1C) e passano da dellaSessione; il ⚠ va nella direzione
    // opposta ed e' assente APPOSTA — e' del passo che sta chiudendo, e sopravvivere vorrebbe dire
    // marcare «diverso» il passo dopo, che nessuno ha segnato (D-10, minaccia T-02-09-01).
    const chiudi = () => setMeasure(map, Object.assign({ mode: s.mode, giro: s.giro || 1, stepId: null, phase: null, t0: null, fromId: null, connId: null },
      dellaSessione(s)));
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
      setMeasure(map, faseNuova(Object.assign({}, s, { phase: 'box', t0: now, fromId: null, connId: null })));
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
    if (s.mode === 'singolo') { setMeasure(map, faseNuova(Object.assign({}, s, { phase: null, t0: null }))); return { elId: s.stepId, seconds: sec, phase: null }; }
    const dopo = V.measureNext(map, s.stepId);
    // il turno resta anche qui: questo e' il ramo di chiusura NATURALE del giro — il flusso normale,
    // quello per cui il turno esiste — e perderlo proprio qui contraddiceva chiudi() e la promessa
    // del dialogo («va su ogni misura di questa sessione»). Rilievo Kimi #1 di F1, GRAVE: sfuggito
    // anche al round Codex perche' le prove coprivano solo mode 'singolo' e measureStop.
    if (!dopo) { setMeasure(map, Object.assign({ mode: s.mode, giro: (s.giro || 1) + 1, stepId: null, phase: null, t0: null, fromId: null, connId: null }, dellaSessione(s))); return { elId: s.stepId, seconds: sec, phase: null, chiuso: true }; }
    if (!dopo.conn) { setMeasure(map, faseNuova(Object.assign({}, s, { stepId: dopo.next.id, phase: 'box', t0: now, fromId: null, connId: null }))); return { elId: s.stepId, seconds: sec, phase: 'box' }; }
    setMeasure(map, faseNuova(Object.assign({}, s, { phase: 'attesa', t0: now, fromId: s.stepId, connId: dopo.conn.id, stepId: dopo.next.id })));
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

  /** Il MAP BRIEF in un numero (F1-1A, D-03): quante delle TREDICI voci sono compilate.
   *  Pura come V.phaseDone — nessun DOM, nessuna scrittura, provabile in Node.
   *  Le tredici voci, nell'ordine: domanda · famiglia · esclusioni · inizio · fine · REPARTO ·
   *  turno · finestra · owner · sponsor · ruoli · indicatori vitali · revisione.
   *  Il reparto si conta DOVE VIVE (map.unitName) invece di duplicarlo in `prep`: l'intestazione
   *  lo chiede gia', e un doppione farebbe dire al promemoria «manca» una cosa scritta due
   *  centimetri piu' su (UI-SPEC §1). Gli indicatori vitali valgono una voce sola: piena se la
   *  lista ha almeno una riga.
   *  Regge map nullo, `prep` assente o fuori tipo e `vitali` che non e' una lista: la chiamano la
   *  riga d'ingresso dell'intestazione e il promemoria del selettore fasi, che si aprono su
   *  QUALUNQUE foglio, compreso uno appena arrivato da fuori e non ancora sanato.
   *  Non e' una porta e non blocca niente (D-02): V.canSetPhase non la chiama e non deve. */
  V.briefStato = (map) => {
    const totale = 13;
    const m = (map && typeof map === 'object') ? map : {};
    const p = (m.prep && typeof m.prep === 'object' && !Array.isArray(m.prep)) ? m.prep : {};
    const pieno = (v) => String(v || '').trim() !== '';
    const testi = [p.domanda, p.famiglia, p.esclusioni, p.inizio, p.fine, m.unitName,
      p.turnoBrief, p.finestra, p.owner, p.sponsor, p.ruoli, p.revisione];
    const pieni = testi.filter(pieno).length + ((Array.isArray(p.vitali) && p.vitali.length) ? 1 : 0);
    return { pieni, totale };
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
