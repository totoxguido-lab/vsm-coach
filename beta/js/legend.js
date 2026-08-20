/* VSM Coach v2 — legend.js: i simboli del libro come dati per la Guida pratica (glifo reale + significato
   + quando si usa + errore tipico). Il pannello e le schede flottanti li disegna panels.js. */
(function (V) {
  'use strict';
  const R = V.render;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const UI = V.ui;

  /** glifo reale di un elemento (stesso codice del foglio) dentro un piccolo <svg> */
  const glyph = (type, props = {}, o = {}) => {
    const el = V.newElement(type, 0, 0, props); if (o.w) el.w = o.w; if (o.h) el.h = o.h;
    const pad = o.pad == null ? 6 : o.pad, extraB = o.extraB == null ? 0 : o.extraB, extraR = o.extraR == null ? 0 : o.extraR;
    const vb = o.vb || `${-pad} ${-pad} ${el.w + pad * 2 + extraR} ${el.h + pad * 2 + extraB}`;
    return `<svg class="lg-g" viewBox="${vb}" aria-hidden="true"><g class="el">${R.drawEl(el)}</g></svg>`;
  };
  const ARROW = (d, w = 60, h = 24) => `<svg class="lg-g" viewBox="0 0 ${w} ${h}" aria-hidden="true">${d}</svg>`;
  const head = (x, y, ang = 0) => `<path d="M${x - 8} ${y - 4} L${x} ${y} L${x - 8} ${y + 4} z" fill="#2b2b2b" transform="rotate(${ang} ${x} ${y})"/>`;
  /** campione di una via di richiesta: colore = canale, tratto = famiglia, più l'icona */
  const chan = (ch) => {
    const k = V.channelLook(ch);
    return `<span class="lg-line"><svg class="lg-g" viewBox="0 0 54 24" aria-hidden="true"><path d="M2 12 H34" fill="none" stroke="${k.color}" stroke-width="1.6"${k.dash ? ` stroke-dasharray="${k.dash}"` : ''}/>${R.chanIcon(ch, 44, 12, 0.7)}</svg><span><b>${esc(ch)}</b></span></span>`;
  };

  /** I sedici simboli del metodo. Testi dal report Kimi (docs/kimi-guida-pratica-report.md):
   *  ogni scheda si regge da sola — le regole condivise (formula del delta, C&C %, VA %) vivono
   *  nelle voci del metodo, qui solo cosa è, quando si usa, l'errore tipico. */
  UI.SYMBOLS = () => [
    { id: 'person', name: 'Persona', tool: 'person', glyph: glyph('person', { label: 'richiedente', requestor: true }, { pad: 4, extraB: 10 }),
      body: 'Il richiedente (in alto a destra, etichetta in grassetto) o un operatore del processo. Usala per chi innesca la richiesta e per le persone che contano nel flusso. Errore tipico: disegnare tutto il personale — solo chi tocca la richiesta.',
      vars: `<span>${glyph('person', { label: 'richiedente', requestor: true }, { pad: 2, extraB: 8 })}richiedente</span><span>${glyph('person', { label: 'operatore', requestor: false }, { pad: 2, extraB: 8 })}operatore</span>` },
    { id: 'face', name: 'Faccina', tool: 'face', glyph: `<svg class="lg-g" viewBox="0 0 34 34" aria-hidden="true"><g class="pencil">${R.face('preoccupato', 17, 17, 14)}</g></svg>`,
      body: 'L’esperienza di chi vive quel punto del flusso (paziente, familiare, operatore); le stesse espressioni valgono come testa dell’omino. Mettila dove l’attesa o il disagio si sentono. Errore: usarla come decorazione invece che come dato.',
      vars: (V.MOODS || []).map(m => `<span><svg class="lg-g" viewBox="0 0 30 30" aria-hidden="true"><g class="pencil">${R.face(m, 15, 15, 12)}</g></svg>${esc(m)}</span>`).join('') },
    { id: 'box', name: 'Passo', tool: 'box', glyph: glyph('box', { title: 'Passo', activities: ['prima attività', '…', 'ultima'], hi: 20, lo: 5, avg: 10 }, { pad: 4, extraB: 30 }),
      body: 'Un passo maggiore del processo: titolo, attività in ordine, sotto Hi / Lo / Avg ed eventualmente C&amp;C % (corretto e completo al primo colpo). Usalo per un blocco di attività senza interruzioni. Errore tipico: fondere due passi separati da un’attesa — l’attesa è un delta, non sta nel box.' },
    { id: 'flow', name: 'Freccia di flusso', tool: 'flow', glyph: ARROW(`<path class="pencil" d="M4 12 H50"/>${head(52, 12)}`),
      body: 'Collega un passo al successivo: da queste frecce nascono l’ordine del processo e la timeline. Varianti: tratteggiata = informazione, spessa = materiale o paziente, con «or» = alternativa. Errore: lasciarla staccata (cerchio rosso tratteggiato) — resta fuori dalla timeline.',
      vars: `<span>${ARROW(`<path class="pencil" d="M2 12 H36" stroke-dasharray="6 5"/>${head(38, 12)}`, 42, 24)}informazione</span><span>${ARROW(`<path class="pencil" d="M2 12 H36" stroke-width="2.6"/>${head(38, 12)}`, 42, 24)}materiale / paziente</span><span>${ARROW(`<path class="pencil" d="M2 12 H36"/>${head(38, 12)}<text class="hand" x="18" y="8" text-anchor="middle" font-size="9" font-style="italic">or</text>`, 42, 24)}alternativa</span><span>${ARROW(`<circle cx="6" cy="12" r="5" fill="#fff" stroke="#c8321e" stroke-dasharray="2 2"/><path class="pencil" d="M11 12 H36"/>${head(38, 12)}`, 42, 24)}staccata</span>` },
    { id: 'delta', name: 'Delta (attesa)', tool: 'delta', glyph: glyph('delta', { note: 'dove aspetta' }, { pad: 4, extraB: 16, extraR: 20 }),
      body: 'Triangolo rosso rovesciato: il tempo in cui nulla avanza tra un passo e l’altro. Aggancialo alla freccia, uno per ogni punto in cui la cosa aspetta; il glifo accanto dice dove (in-box, coda…). Errore tipico: dimenticare le attese «normali» (il vassoio pronto, il referto in coda) — sono proprio quelle che contano. Si misura come i passi: Hi / Lo / Avg.',
      vars: (V.DELTA_KINDS || []).map(k => `<span>${glyph('delta', { kind: k }, { pad: 3, extraR: 20 })}${esc(k)}</span>`).join('') },
    { id: 'request', name: 'Via di richiesta', tool: 'request', glyph: ARROW(`<path class="pencil" d="M54 6 C 30 4, 20 6, 8 20"/>${head(8, 20, 135)}<circle class="chan" cx="30" cy="8" r="7"/>${R.chanIcon('telefono', 30, 8, 0.45)}`),
      body: 'Dal richiedente al passo che riceve: una freccia per ogni via reale, con l’icona del canale. Il colore dice il canale e il tratto la famiglia (a voce, elettronica, cartacea): mai il colore da solo, il foglio si stampa anche in bianco e nero. Errore: disegnare solo la via «ufficiale» — servono tutte quelle che succedono davvero.',
      vars: (V.CHANNELS || []).map(chan).join('') },
    { id: 'storm', name: 'Nuvola', tool: 'storm', glyph: glyph('storm', { text: 'problema…', muda: 'attesa' }, { pad: 4, extraB: 12 }),
      body: 'Un problema del processo, mai di una persona: etichettala con muda e regola violata. Mettila sul punto esatto dove il flusso si rompe. Errore tipico: nuvole generiche («comunicazione scarsa») — senza muda e regola non è analisi, è un’opinione.' },
    { id: 'fluffy', name: 'Nuvoletta', tool: 'fluffy', glyph: glyph('fluffy', { text: 'idea / funziona' }, { pad: 4 }),
      body: 'Ciò che funziona (da tenere nel futuro) o un’idea di miglioramento. Usala per non perdere le cose buone mentre cacci i problemi. Errore: riempirla di idee prima di aver finito lo stato attuale — prima si capisce, poi si propone.' },
    { id: 'burst', name: 'Kaizen burst', tool: 'burst', glyph: glyph('burst', { text: 'kaizen', owner: 'chi', priority: 'alta' }, { pad: 4, extraB: 12 }),
      body: 'Punto candidato a un progetto di miglioramento, con owner e priorità: finisce nel piano. Usalo nello stato futuro, quando l’idea ha un padrone. Errore: burst senza nome — è la versione grafica di «lo facciamo tutti», cioè nessuno.' },
    { id: 'inventory', name: 'Scorta', tool: 'inventory', glyph: glyph('inventory', { what: 'scorta', qty: 12, days: 3 }, { pad: 4, extraB: 22 }),
      body: 'Triangolo con la I: materiale o pazienti in attesa, con quantità e giorni di copertura. Usala dove il lavoro si accumula fisicamente. Errore: dimenticare che anche la sala d’attesa piena è una scorta — segnala un collo di bottiglia a valle.' },
    { id: 'inbox', name: 'In-box / coda', tool: 'inbox', glyph: glyph('inbox', { kind: 'in-box' }, { pad: 4, extraB: 12 }),
      body: 'Dove informazione o persone aspettano, con l’attesa media. Errore: usarla al posto del delta — dice dove si aspetta, non quanto; il quanto lo dà il delta sulla timeline.',
      vars: ['in-box', 'orologio', 'coda'].map(k => `<span>${glyph('inbox', { kind: k }, { pad: 3, extraB: -4 })}${esc(k)}</span>`).join('') },
    { id: 'distance', name: 'Distanza', tool: 'distance', glyph: glyph('distance', { meters: 120 }, { pad: 4, extraB: 6 }),
      body: 'Metri percorsi (diagramma spaghetti): il movimento è uno dei sette muda. Usala quando il processo fa viaggiare persone o cose. Errore: stimarla a occhio — cammina il percorso e misura.' },
    { id: 'lane', name: 'Corsia', tool: 'lane', glyph: glyph('lane', { name: 'Reparto' }, { pad: 4, w: 120, h: 40 }),
      body: 'Fascia orizzontale per reparto o ruolo: chi fa cosa e dove avvengono i passaggi di consegna. Usala quando il processo attraversa più reparti. Errore: più di tre corsie in una mappa semplice — forse lo scopo è troppo largo.' },
    { id: 'icon', name: 'Icona', tool: 'icon', glyph: glyph('icon', { icon: 'fax', label: 'fax' }, { pad: 4, extraB: 14 }),
      body: 'Piccolo simbolo con etichetta opzionale: con che cosa, attraverso che cosa, dove; si blocca a un passo o a una freccia. La libreria completa è nel pop-up dell’elemento. Errore: icone senza etichetta che capisci solo tu — la mappa deve raccontarsi da sola.' },
    { id: 'text', name: 'Nota', tool: 'text', glyph: glyph('text', { text: 'nota' }, { pad: 4, w: 60 }),
      body: 'Poche parole dove il disegno non basta. Errore: usarla per spiegare il processo invece di disegnarlo — se servono molte note, manca un simbolo.' },
    { id: 'legend', name: 'Legenda sul foglio', tool: 'legend', glyph: glyph('legend', {}, { pad: 4, w: 170, h: 104 }),
      body: 'La legenda compatta stampabile, in alto a sinistra come nel libro. Mettila quando la mappa esce dalle tue mani (riunione, archivio); questa guida resta la versione completa.' }
  ];
})(window.VSM);
