/* VSM Coach v2 — legend.js: legenda completa fuori dal foglio (scheda del cassetto) — tutti i simboli del libro con significato, varianti e "Usa lo strumento". */
(function (V) {
  'use strict';
  const I = V.interact, R = V.render, UI = V.ui;
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /** glifo reale di un elemento (stesso codice del foglio) dentro un piccolo <svg> */
  const glyph = (type, props = {}, o = {}) => {
    const el = V.newElement(type, 0, 0, props); if (o.w) el.w = o.w; if (o.h) el.h = o.h;
    const pad = o.pad == null ? 6 : o.pad, extraB = o.extraB == null ? 0 : o.extraB, extraR = o.extraR == null ? 0 : o.extraR;
    const vb = o.vb || `${-pad} ${-pad} ${el.w + pad * 2 + extraR} ${el.h + pad * 2 + extraB}`;
    return `<svg class="lg-g" viewBox="${vb}" aria-hidden="true"><g class="el">${R.drawEl(el)}</g></svg>`;
  };
  const ARROW = (d, w = 60, h = 24) => `<svg class="lg-g" viewBox="0 0 ${w} ${h}" aria-hidden="true">${d}</svg>`;
  const head = (x, y, ang = 0) => `<path d="M${x - 8} ${y - 4} L${x} ${y} L${x - 8} ${y + 4} z" fill="#2b2b2b" transform="rotate(${ang} ${x} ${y})"/>`;
  /** campione di una via di richiesta: lo stesso segno del foglio (colore = canale, tratto = famiglia, più l'icona) */
  const chan = (ch) => {
    const k = V.channelLook(ch);
    return `<span class="lg-line"><svg class="lg-g" viewBox="0 0 54 24" aria-hidden="true"><path d="M2 12 H34" fill="none" stroke="${k.color}" stroke-width="1.6"${k.dash ? ` stroke-dasharray="${k.dash}"` : ''}/>${R.chanIcon(ch, 44, 12, 0.7)}</svg><span><b>${esc(ch)}</b> · ${esc(k.family)}</span></span>`;
  };
  const lockIcon = `<svg class="lg-g" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="11" width="12" height="9" rx="2" fill="#1f4e79"/><path d="M8 11V8a4 4 0 018 0v3" fill="none" stroke="#1f4e79" stroke-width="2"/></svg>`;

  const row = (o) => `<div class="lg-row"><div class="lg-ico">${o.g}</div><div class="lg-txt"><b>${esc(o.name)}</b> <span class="lg-mean">${o.mean}</span>${o.vars ? `<div class="lg-var">${o.vars}</div>` : ''}${o.why ? `<details class="lg-why"><summary>dal libro</summary>${esc(o.why)}</details>` : ''}</div>${o.tool ? `<button class="btn small" data-tool-go="${o.tool}" title="Attiva lo strumento">Usa</button>` : '<span></span>'}</div>`;
  const section = (title, rows) => `<h4 class="lg-h">${esc(title)}</h4>${rows.join('')}`;
  const T = () => V.TYPES;

  UI.legendHTML = () => {
    const S = [];
    S.push(section('Chi chiede, chi lavora', [
      row({ g: glyph('person', { label: 'richiedente', requestor: true }, { pad: 4, extraB: 10 }), name: T().person.name, tool: 'person', why: T().person.why,
        mean: 'l\'omino: il <b>richiedente</b> (in alto a destra; da lui partono le vie di richiesta) o un operatore. Etichetta in grassetto = richiedente.',
        vars: `<span>${glyph('person', { label: 'richiedente', requestor: true }, { pad: 2, extraB: 8 })}richiedente (grassetto)</span><span>${glyph('person', { label: 'operatore', requestor: false }, { pad: 2, extraB: 8 })}operatore</span>` }),
      row({ g: `<svg class="lg-g" viewBox="0 0 34 34" aria-hidden="true"><g class="pencil">${R.face('preoccupato', 17, 17, 14)}</g></svg>`, name: T().face.name, tool: 'face', why: T().face.why,
        mean: 'l\'esperienza di chi vive quel punto del flusso (paziente, operatore, famigliare). Le stesse espressioni valgono per la testa dell\'omino. Significato dichiarato:',
        vars: (V.MOODS || []).map(m => `<span class="lg-line"><svg class="lg-g" viewBox="0 0 30 30" aria-hidden="true"><g class="pencil">${R.face(m, 15, 15, 12)}</g></svg><span><b>${esc(m)}</b>: ${esc(V.MOOD_MEANING[m] || '')}</span></span>`).join('') })
    ]));
    S.push(section('Il flusso del lavoro (da sinistra a destra)', [
      row({ g: glyph('box', { title: 'Passo', activities: ['prima attività', '…', 'ultima'], hi: 20, lo: 5, avg: 10 }, { pad: 4, extraB: 30 }), name: T().box.name, tool: 'box', why: T().box.why,
        mean: 'un passo maggiore del processo; dentro, in ordine, le attività; sotto <b>Hi / Lo / Avg</b> (tempo massimo, minimo, medio) ed eventuale <b>C&amp;C %</b> (corretto e completo al primo colpo).' }),
      row({ g: ARROW(`<path class="pencil" d="M4 12 H50"/>${head(52, 12)}`), name: T().flow.name, tool: 'flow', why: T().flow.why,
        mean: 'collega un passo al successivo: da queste frecce nascono l\'ordine del processo e la timeline.',
        vars: `<span>${ARROW(`<path class="pencil" d="M2 12 H36" stroke-dasharray="6 5"/>${head(38, 12)}`, 42, 24)}informazione (tratteggiata)</span><span>${ARROW(`<path class="pencil" d="M2 12 H36" stroke-width="2.6"/>${head(38, 12)}`, 42, 24)}materiale / paziente (spessa)</span><span>${ARROW(`<path class="pencil" d="M2 12 H36"/>${head(38, 12)}<text class="hand" x="18" y="8" text-anchor="middle" font-size="9" font-style="italic">or</text>`, 42, 24)}alternativa ("or")</span><span>${ARROW(`<circle cx="6" cy="12" r="5" fill="#fff" stroke="#c8321e" stroke-dasharray="2 2"/><path class="pencil" d="M11 12 H36"/>${head(38, 12)}`, 42, 24)}estremità staccata (da riagganciare)</span>` }),
      row({ g: glyph('delta', { note: 'dove aspetta' }, { pad: 4, extraB: 16, extraR: 20 }), name: T().delta.name, tool: 'delta', why: T().delta.why,
        mean: 'triangolo rosso rovesciato: <b>tempo in cui nulla avanza</b> tra un passo e l\'altro (spreco). Agganciato a una freccia entra nella timeline; il glifo accanto dice <i>dove</i> si aspetta.',
        vars: (V.DELTA_KINDS || []).map(k => `<span>${glyph('delta', { kind: k }, { pad: 3, extraR: 20 })}${esc(k)}</span>`).join('') }),
      row({ g: ARROW(`<path class="pencil" d="M54 6 C 30 4, 20 6, 8 20"/>${head(8, 20, 135)}<circle class="chan" cx="30" cy="8" r="7"/>${R.chanIcon('telefono', 30, 8, 0.45)}`), name: T().request.name, tool: 'request', why: T().request.why,
        mean: 'dal richiedente al passo che riceve la richiesta: <b>una per ogni via reale</b>. L\'icona sulla freccia è il canale (si trascina lungo il tratto); sotto: canale → a chi, quante mani tocca. <b>Il colore dice il canale</b> e il tratto la famiglia (a voce, elettronica, cartacea, supposta): mai il colore da solo, perché il foglio si stampa anche in bianco e nero.',
        vars: (V.CHANNELS || []).map(chan).join('') })
    ]));
    S.push(section('Problemi, idee, progetti', [
      row({ g: glyph('storm', { text: 'problema…', muda: 'attesa', rule: '3 flusso semplice e diretto' }, { pad: 4, extraB: 12 }), name: T().storm.name, tool: 'storm', why: T().storm.why, mean: 'un problema del processo (mai di persone), etichettato con <b>muda</b> e <b>regola</b> violata; sotto: muda · R n · A3 se candidato ad A3.' }),
      row({ g: glyph('fluffy', { text: 'idea / funziona' }, { pad: 4 }), name: T().fluffy.name, tool: 'fluffy', why: T().fluffy.why, mean: 'ciò che funziona (da tenere) o un\'idea per lo stato futuro.' }),
      row({ g: glyph('burst', { text: 'kaizen', owner: 'chi', priority: 'alta' }, { pad: 4, extraB: 12 }), name: T().burst.name, tool: 'burst', why: T().burst.why, mean: 'punto candidato a progetto di miglioramento; owner e priorità, finisce nel piano.' })
    ]));
    S.push(section('Altri simboli del libro', [
      row({ g: glyph('inventory', { what: 'scorta', qty: 12, days: 3 }, { pad: 4, extraB: 22 }), name: T().inventory.name, tool: 'inventory', why: T().inventory.why, mean: 'triangolo con la I: scorta (materiale o pazienti in attesa) con quantità e giorni di copertura.' }),
      row({ g: glyph('inbox', { kind: 'in-box' }, { pad: 4, extraB: 12 }), name: T().inbox.name, tool: 'inbox', why: T().inbox.why, mean: 'dove informazione o persone aspettano, con l\'attesa media.',
        vars: ['in-box', 'orologio', 'coda'].map(k => `<span>${glyph('inbox', { kind: k }, { pad: 3, extraB: -4 })}${esc(k)}</span>`).join('') }),
      row({ g: glyph('distance', { meters: 120 }, { pad: 4, extraB: 6 }), name: T().distance.name, tool: 'distance', why: T().distance.why, mean: 'metri percorsi (diagramma spaghetti): il movimento è uno dei sette muda.' }),
      row({ g: glyph('lane', { name: 'Reparto' }, { pad: 4, w: 120, h: 40 }), name: T().lane.name, tool: 'lane', why: T().lane.why, mean: 'fascia orizzontale per reparto: chi fa cosa e i passaggi di consegna.' }),
      row({ g: glyph('icon', { icon: 'fax', label: 'fax' }, { pad: 4, extraB: 14 }), name: T().icon.name, tool: 'icon', why: T().icon.why,
        mean: 'piccolo simbolo posizionabile (e bloccabile a un passo o a una freccia) con etichetta opzionale: con che cosa, attraverso che cosa, dove.',
        vars: Object.entries(R.ICONS).filter(([g]) => g !== 'canali').map(([g, icons]) => `<span class="lg-grp">${esc(g)}:</span>` + Object.keys(icons).map(n => `<span><svg class="lg-g" viewBox="0 0 24 24" aria-hidden="true">${R.iconSVG(n, 12, 12, 0.8)}</svg>${esc(n)}</span>`).join('')).join('') }),
      row({ g: glyph('text', { text: 'nota' }, { pad: 4, w: 60 }), name: T().text.name, tool: 'text', why: T().text.why, mean: 'nota libera, poche parole.' }),
      row({ g: glyph('legend', {}, { pad: 4, w: 170, h: 104 }), name: T().legend.name, tool: 'legend', why: T().legend.why, mean: 'legenda compatta stampabile sul foglio (in alto a sinistra); questa scheda è la versione completa.' })
    ]));
    S.push(section('Sul foglio', [
      row({ g: lockIcon, name: 'Bloccato a…', mean: 'lucchetto sulla selezione: l\'elemento è <b>bloccato a un genitore</b> (passo, persona, corsia, scorta, freccia) e si muove con lui. Si blocca da solo se lo lasci cadere su un passo o vicino a una freccia; "Blocca a…" / "Sblocca" nelle azioni rapide. Selezionato, una linea tratteggiata mostra a chi è bloccato.' }),
      row({ g: ARROW(`<path class="nva" d="M4 6 H56"/><path class="va" d="M4 6 V18 H30 V6"/><text class="hand" x="17" y="16" text-anchor="middle" font-size="7" fill="#3f7d5a">10</text><text class="hand delta-txt" x="43" y="4.5" text-anchor="middle" font-size="7">20</text>`, 60, 22), name: 'Timeline', mean: 'sotto i passi: <span style="color:#3f7d5a">verde in basso</span> = tempo a valore (Avg dei box), <span style="color:#c8321e">rosso in alto</span> = attese (Avg dei delta agganciati). Il riepilogo in basso a destra calcola VA, NVA, VA % (value quotient) e First Time Quality.' }),
      row({ g: ARROW(`<rect x="4" y="3" width="52" height="18" rx="4" fill="rgba(31,78,121,.04)" stroke="#1f4e79" stroke-dasharray="6 5" stroke-width="1.2"/><text class="hand" x="30" y="15" text-anchor="middle" font-size="8" fill="#1f4e79">① Chi chiede?</text>`, 60, 24), name: 'Segnaposto', mean: 'sul foglio vuoto: toccali per mettere richiedente e primo passo.' }),
      row({ g: ARROW(`<circle cx="30" cy="12" r="8" fill="#1f4e79"/><text x="30" y="15" text-anchor="middle" font-size="9" font-weight="700" fill="#fff">↗</text>`, 60, 24), name: 'Mappa collegata', mean: 'badge ↗ su un elemento: apre la mappa di dettaglio / turno / futuro collegata.' }),
      row({ g: ARROW(`<text class="hand" x="30" y="15" text-anchor="middle" font-size="7" fill="#b7791f">provvisoria</text>`, 60, 24), name: 'Provvisoria', mean: 'accanto al titolo finché il processo non è stato camminato e validato (Guida, fase 4).' })
    ]));
    // se qualcuno ha forzato l'aspetto di un collegamento, la legenda non lo spiega più: va dichiarato qui
    const map = V.map();
    const forzati = map ? map.elements.filter(e => V.isConnector(e) && e.props.override && (e.props.override.stroke || e.props.override.dash || e.props.override.width)) : [];
    const nota = forzati.length ? `<div class="lg-intro hint">✱ ${forzati.length} ${forzati.length === 1 ? 'collegamento ha' : 'collegamenti hanno'} un aspetto scelto a mano: quel segno non è spiegato da questa legenda. Si torna al significato dal pop-up della freccia, in "Altre opzioni".</div>` : '';
    return `<div class="lg-intro hint">I simboli sono quelli di <i>Value Stream Mapping for Healthcare Made Easy</i> (Jimmerson). "Usa" attiva lo strumento; "dal libro" apre la spiegazione.</div>${nota}` + S.join('');
  };
  UI.renderLegend = () => {
    const body = $('#legend-body'); if (!body) return; body.innerHTML = UI.legendHTML();
    $$('[data-tool-go]', body).forEach(b => b.onclick = () => { I.setTool(b.dataset.toolGo); if (window.matchMedia('(max-width: 900px)').matches) UI.closeDrawer(); });
  };
})(window.VSM);
