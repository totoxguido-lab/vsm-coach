/* VSM Coach v2 — render.js: disegno SVG del foglio (carta, corsie, inchiostro, connettori, elementi, overlay calcolati, selezione). */
(function (V) {
  'use strict';
  const { num, fmt } = V.util;
  const NS = 'http://www.w3.org/2000/svg';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const R = V.render = {};
  let svg, L = {};
  // Il registro dei livelli disegna a gruppi (spec fondamenta C): un <g data-layer> per livello,
  // ridisegnato solo quando la sua chiave cambia. layerKeys e' AZZERATA in R.init (dopo L = nuovi):
  // l'svg staccato dell'export e il cambio di svg ripartono da zero, cosi' il primo R.overlay del
  // foglio vero dopo un giro di R.exportSVG/peekSVG ridisegna sempre (nessuna chiave stantia puo'
  // fargli "saltare" un gruppo che in realta' sta su un altro <g data-layer> — rilievo GRAVE della
  // revisione). I gruppi non si tengono in cache per riferimento (un Map id->elemento sopravviverebbe
  // allo scambio di svg e punterebbe a nodi staccati): si cercano ogni volta dentro L.layersG.children,
  // una manciata di nodi, costo trascurabile.
  let layerKeys = new Map();
  R._draws = {};   // contatore di ridisegni per livello (prova del drag: solo il riepilogo si muove)

  // ---------- aspetto dei collegamenti (deriva dal significato) ----------
  // due famiglie di punte: piena (la richiesta, com'e' sempre stata) e aperta a V (chi si reca di persona)
  const markerId = (col, head) => (head === 'aperta' ? 'arrv' : 'arr') + String(col).replace('#', '-');
  /** tutte le tinte che possono comparire su un collegamento: quelle dei canali e quelle ammesse come eccezione */
  R.inkColors = () => Array.from(new Set(Object.values(V.CHANNEL_LOOK).map(l => l.color).concat(V.INK_COLORS.map(c => c.id)).filter(Boolean)));
  /** Come si disegna un collegamento: la via di richiesta prende colore e tratto dal *canale*, la freccia di
      flusso resta a matita e prende il tratto dallo stile (materiale spesso, informazione tratteggiata).
      props.override è l'eccezione dichiarata a mano, per la riunione in cui serve dire "guarda questa". */
  R.connLook = (c) => {
    const p = c.props || {}, ov = p.override || {};
    let stroke = '#2b2b2b', dash = '', width = '', head = 'piena', start = false;
    // due dimensioni indipendenti, entrambe dichiarate in legenda: il canale decide colore e tratto,
    // l'intento decide la punta. La punta e' forma, non tinta: si legge anche in bianco e nero.
    if (c.type === 'request') { const k = V.channelLook(p.channel); stroke = k.color; dash = k.dash; const i = V.intentLook(c); head = i.head; start = i.start; }
    else if (p.style === 'info') dash = '6 5';
    else if (p.style === 'material') width = '2.6';
    if (ov.stroke) stroke = ov.stroke;
    if (ov.dash) dash = ov.dash === 'none' ? '' : ov.dash;
    if (ov.width) width = ov.width;
    return { stroke, dash, width, head, start, custom: !!(ov.stroke || ov.dash || ov.width), marker: markerId(stroke, head) };
  };
  /** attributi SVG del tratto (usati dal foglio e dalla legenda, così il campione è davvero lo stesso segno) */
  R.connAttrs = (c) => { const k = R.connLook(c); return `stroke="${esc(k.stroke)}"${k.dash ? ` stroke-dasharray="${k.dash}"` : ''}${k.width ? ` stroke-width="${k.width}"` : ''} marker-end="url(#${k.marker})"`; };

  R.init = (svgEl) => {
    svg = svgEl; svg.innerHTML = '';
    const defs = document.createElementNS(NS, 'defs');
    // una punta per ogni tinta in uso: la punta nera su una linea colorata si legge come un errore di stampa
    defs.innerHTML = `<marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#2b2b2b"/></marker>
      <marker id="arr-sel" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#1f4e79"/></marker>`
      + R.inkColors().map(col => `<marker id="${markerId(col)}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="${col}"/></marker>`).join('')
      // la punta di «si reca»: DOPPIA punta a V (»), stessa tinta del canale ma disegnata a tratto.
      // Una V sola, alla misura della legenda, si confondeva con la punta piena della richiesta: due
      // chevron non si confondono con niente, nemmeno in fotocopia, e dicono «qualcuno ci va».
      + R.inkColors().map(col => `<marker id="${markerId(col, 'aperta')}" viewBox="0 0 12 10" refX="11" refY="5" markerWidth="11" markerHeight="9" orient="auto-start-reverse"><path d="M1 1.5 L5 5 L1 8.5 M6 1.5 L10 5 L6 8.5" fill="none" stroke="${col}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></marker>`).join('');
    svg.appendChild(defs);
    // L si RIFA' da capo, non si riempie quello di prima: R.peekSVG disegna un'altra mappa su un svg
    // distaccato mettendo da parte `svg` e `L` e rimettendoli al loro posto dopo. Riempiendo lo stesso
    // oggetto, il «da parte» era un riferimento all'oggetto GIA' sovrascritto: da quel momento i livelli
    // puntavano all'svg distaccato, il foglio aperto non si ridisegnava piu' (restava il disegno della
    // mappa di prima) e il primo tocco su un elemento che li' non c'e' piu' bloccava tutto.
    const nuovi = {};
    ['paper', 'lanes', 'ink', 'conn', 'el', 'hand', 'overlay', 'ui'].forEach(k => { const g = document.createElementNS(NS, 'g'); g.id = 'L-' + k; svg.appendChild(g); nuovi[k] = g; });
    L = nuovi;
    layerKeys = new Map();
    L.ink.setAttribute('pointer-events', 'none');
    // Il riepilogo e la timeline sono un calcolo disegnato sopra il foglio, non roba da toccare: il
    // rettangolo pieno della card rubava il tocco a quello che ci stava sotto (note, nuvole) e faceva
    // partire il trascinamento della vista. I riquadri tratteggiati d'invito restano toccabili
    // (svg .placeholder{pointer-events:auto}, app.css) e i badge dei livelli pure (in linea, sotto).
    L.overlay.setAttribute('pointer-events', 'none');
    // dentro l'overlay: il gruppo dei livelli — <g class="layers"> con un <g data-layer="id"> per
    // livello (spec C). I segnaposti «① Chi chiede? / ② Primo passo» non esistono più: il foglio
    // vuoto è vuoto, punto (esito stazione 1, 25/8) — si comincia dal menu del vuoto o dalla palette.
    const layersG = document.createElementNS(NS, 'g'); layersG.setAttribute('class', 'layers'); L.overlay.appendChild(layersG); L.layersG = layersG;
  };
  R.layers = () => L;

  // ---------- helpers ----------
  function wrap(s, maxChars) { const words = String(s || '').split(/\s+/); const lines = []; let cur = ''; words.forEach(w => { if ((cur + ' ' + w).trim().length > maxChars && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }); if (cur) lines.push(cur); return lines; }
  function tspans(lines, x, y, lh) { return lines.map((l, i) => `<tspan x="${x}" y="${y + i * lh}">${esc(l)}</tspan>`).join(''); }
  /** taglia a `max` righe segnando il taglio con "…": il testo sparito senza segno fa credere che la mappa dica meno di quanto dice */
  function fitLines(lines, max) {
    if (lines.length <= max) return lines;
    const out = lines.slice(0, Math.max(1, max));
    const last = out[out.length - 1];
    out[out.length - 1] = /[…]$/.test(last) ? last : last.replace(/[\s,;:.]+$/, '') + '…';
    return out;
  }
  /** taglia una riga sola a `max` caratteri, con "…" se serve */
  R.wrap = wrap; R.fitLines = fitLines;
  /** Le attività dentro il passo, disegnate come righe DISTINTE e numerate. Il numero toglie
   *  l'ambiguità che aveva il vecchio elenco a «•»: un'attività lunga mandata a capo era
   *  indistinguibile da due attività. La riga di continuazione si rientra sotto il testo della
   *  sua attività (tanti spazi quanti ne occupa il numero), così a colpo d'occhio si conta quel
   *  che c'è. Il numero è anche la promessa del sotto-foglio: il «3» di qui diventa il passo 3
   *  di là sotto (V.buildDetailFromActivities). */
  R.activityLines = (activities, w, size = 10) => {
    const lines = [];
    (activities || []).forEach((a, i) => {
      const tag = (i + 1) + '. ';
      // 0.56 px per carattere per ogni px di corpo: a 10 e' il vecchio w/5.6, e le mappe gia'
      // disegnate non si spostano di un pixel finche' il corpo resta 10
      const inner = Math.max(8, Math.floor(w / (size * 0.56)) - tag.length);
      fitLines(wrap(a, inner), 2).forEach((l, j) => lines.push((j ? ' '.repeat(tag.length) : tag) + l));
    });
    return lines;
  };
  /** Quanto grande scrivere le attivita' dentro il passo. Tre attivita' scritte a 10 px in un box
   *  alto 170 lasciavano mezzo passo vuoto e si leggevano male: qui il corpo CRESCE finche' le righe
   *  ci stanno tutte, e torna al minimo quando le attivita' sono tante (con otto righe piccolo va
   *  bene, con tre no). Il minimo e' il 10 di sempre, con la prima riga a 58: senza attivita', o con
   *  tante, il disegno e' identico a prima. Logica pura: si prova a schermo, ma si misura qui. */
  R.activityBlock = (activities, w, h, roomForOwner = 0) => {
    const prova = (size) => {
      const lineH = Math.round(size * 1.2);
      const y0 = Math.max(58, 46 + size);            // la prima riga scende quel tanto che serve a stare sotto il filo del titolo
      const max = Math.max(1, Math.floor((h - y0 - 2 - roomForOwner) / lineH));
      return { size, lineH, y0, max, lines: R.activityLines(activities, w, size) };
    };
    if (!(activities || []).some(a => String(a || '').trim())) return prova(10);
    // Si cresce solo se NON si perde una parola: piu' grande vuol dire meno caratteri per riga, e
    // un'attivita' che a 10 si leggeva intera a 16 finirebbe in «…». Leggere tutto viene prima di
    // leggere in grande — se gia' a 10 il testo si taglia, si resta a 10 e non si peggiora.
    const taglia = (lines) => lines.some(l => /…$/.test(l));
    for (let size = 16; size > 10; size--) { const t = prova(size); if (t.lines.length <= t.max && !taglia(t.lines)) return t; }
    return prova(10);
  };
  /** righe di un elemento testo (a capo sulla larghezza scelta) */
  R.textLines = (el) => { const p = el.props, sz = p.size || 12; return wrap(p.text || '', Math.max(6, Math.floor(el.w / (sz * 0.5)))); };
  /** misura da usare per selezione e maniglie: per il testo l'altezza vera è quella delle righe, non quella memorizzata */
  R.elSize = (el) => {
    if (el.type !== 'text') return { w: el.w, h: el.h };
    const sz = el.props.size || 12; const need = Math.round(R.textLines(el).length * sz * 1.25 + 4);
    return { w: el.w, h: Math.max(el.h, need) };
  };
  const cloudPath = (w, h) => { // nuvola che riempie w×h
    const r = h / 2.6; return `M${r * 0.9} ${h - 6} H${w - r * 0.9} a${r} ${r} 0 0 0 ${r * 0.55} -${r * 1.6} a${r * 1.1} ${r * 1.1} 0 0 0 -${r * 1.4} -${r * 1.1} a${r * 1.3} ${r * 1.3} 0 0 0 -${Math.max(8, w - 2 * r * 2.6)} 0 a${r * 1.1} ${r * 1.1} 0 0 0 -${r * 1.5} ${r * 1.1} a${r} ${r} 0 0 0 ${r * 0.5} ${r * 1.6} z`; };
  /* Le altre tre forme del problema (richiesta di Gt, 2026-08-21). Restano disegnate «a matita» come
     la nuvola: cambia la sagoma, non il significato — è sempre un problema di processo. */
  const shapePath = (forma, w, h) => {
    if (forma === 'cerchio') { const rx = w / 2 - 1, ry = h / 2 - 1; return `M1 ${h / 2} a${rx} ${ry} 0 1 0 ${w - 2} 0 a${rx} ${ry} 0 1 0 -${w - 2} 0 z`; }
    if (forma === 'quadrato') { const r = 6; return `M${1 + r} 1 H${w - 1 - r} a${r} ${r} 0 0 1 ${r} ${r} V${h - 1 - r} a${r} ${r} 0 0 1 -${r} ${r} H${1 + r} a${r} ${r} 0 0 1 -${r} -${r} V${1 + r} a${r} ${r} 0 0 1 ${r} -${r} z`; }
    if (forma === 'triangolo') return `M${w / 2} 1 L${w - 1} ${h - 1} H1 z`;
    return cloudPath(w, h);
  };
  R.shapePath = (forma, w, h) => shapePath(forma, w, h); // serve al selettore nel pop-up
  const burstPath = (w, h) => { const cx = w / 2, cy = h / 2, n = 12; let d = ''; for (let i = 0; i < n * 2; i++) { const a = Math.PI * i / n - Math.PI / 2; const rx = (i % 2 ? 0.7 : 1) * cx, ry = (i % 2 ? 0.7 : 1) * cy; d += (i ? 'L' : 'M') + (cx + rx * Math.cos(a)).toFixed(1) + ' ' + (cy + ry * Math.sin(a)).toFixed(1) + ' '; } return d + 'z'; };

  // ---------- carta + titolo ----------
  R.paper = (map) => {
    const { w, h } = V.paperOf(map);
    let g = `<rect class="paper" x="0" y="0" width="${w}" height="${h}" rx="2"/>`;
    // ogni canvas ha la sua tinta leggera (map.tint, assegnata a caso alla creazione): si capisce a
    // colpo d'occhio su quale mappa si sta lavorando, e il foglio resta leggibile. La saturazione
    // resta nella famiglia del passo colorato (38%): col vecchio 60% il velo era piu' saturo del
    // bordo del passo stesso, e passo e sotto-foglio sembravano due parenti lontani invece dello
    // stesso colore.
    const tint = map.tint == null ? null : ((+map.tint || 0) % 360 + 360) % 360;
    if (tint != null) g += `<rect x="0" y="0" width="${w}" height="${h}" rx="2" fill="hsl(${tint} 40% 62%)" opacity="0.08"/>`;
    g += `<line class="fold" x1="${w / 2}" y1="0" x2="${w / 2}" y2="${h}"/><line class="fold" x1="${w * 0.75}" y1="0" x2="${w * 0.75}" y2="${h}"/>`;
    // in basso a sinistra, semitrasparente, l'identità del foglio (feedback iPad 25/8): titolo,
    // data e iniziali degli autori, poi il nome della mappa — il giro dell'attuale, «ideale» (con
    // lo stato del lucchetto) o «dettaglio»
    const giro = V.kindLabel(map) + (map.kind === 'future' ? (map.validated ? ' · validato \u{1F512}' : ' · da validare') : '');
    const dataIt = map.date ? String(map.date).split('-').reverse().join('/') : '';
    const lbl = [map.title, dataIt, map.authors].filter(Boolean).join(' · ') + ((map.title || dataIt || map.authors) ? ' — ' : '') + giro;
    g += `<text class="hand" x="30" y="${h - 26}" font-size="46" font-weight="800" fill="hsl(${tint == null ? 210 : tint} 45% 35%)" opacity="0.14">${esc(lbl)}</text>`;
    L.paper.innerHTML = g;
  };

  // ---------- elementi ----------
  /** Orologino tenue (stesso tratto del glifo «sala d'attesa»): sta al posto delle targhette
   *  «Hi / Lo / Avg ?» e «attesa ?» in fase disegna — ricorda che i tempi arriveranno dal
   *  cronometro senza chiedere numeri in una fase in cui non esistono. */
  const clockHint = (cx, cy) => `<g class="clock-hint" opacity=".4" fill="none" stroke="#2b2b2b" stroke-width="1.5" stroke-linecap="round"><circle cx="${cx}" cy="${cy - 3}" r="6"/><path d="M${cx - 2.4} ${cy - 11.6} h4.8 M${cx} ${cy - 11.2} v2 M${cx} ${cy - 3} v-3.2 M${cx} ${cy - 3} l2.4 1.6"/></g>`;
  // i controlli UI (il cronometro grande dei passi) vivono SOLO a schermo: l'export e la stampa
  // restituiscono il documento VSM, non lo stato transitorio dell'interfaccia (finding P2 Codex)
  let uiVivo = true;
  R.elMarkup = (el, map) => drawEl(el, map);   // la via «a schermo» per le prove
  function drawEl(el, map) {
    // la mappa serve al badge del collegamento (figlia o riferimento); la legenda disegna elementi
    // che non stanno in nessuna mappa, e per quelli vale il ripiego sulla mappa attiva
    map = map || V.map();
    const p = el.props; const w = el.w, h = el.h; let s = '';
    // figlia = il passo CONTIENE un sotto-foglio (bordo spesso, colore che il foglio ripete);
    // riferimento = lo cita soltanto. Calcolato una volta: bordo, badge e occhio dicono la stessa cosa.
    // (ogni elemento puo' richiamare una mappa; contenerla — repairDoc — e' cosa da soli box)
    const lk = p.link ? V.linkKind(el, map) : null;
    const H = V.tintHue(p.tint);
    switch (el.type) {
      case 'box': {
        // «deep» (bordo piu' spesso) dice: scendendo di qui si trova un foglio. E' un fatto del
        // disegno, non una preferenza, e resta una classe CSS (non uno stile in linea) cosi' il
        // blu di «scegli il bersaglio» continua a vincere mentre si traccia una freccia.
        // La tinta viaggia in due variabili: riempimento tenue, bordo appena piu' presente — stessa
        // famiglia, due intensita', e sempre leggibile il testo a matita sopra. Le intensita' sono
        // quelle decise da Gt a schermo (spec 2026-08-21): piu' sature di cosi' i passi colorati
        // tiravano l'occhio piu' del rosso d'allarme dei delta, che e' l'opposto di quel che serve.
        const cls = 'box' + (lk === 'figlia' ? ' deep' : '') + (H != null ? ' tinted' : '');
        const sty = H != null ? ` style="--tint-fill:hsl(${H} 38% 95.5%);--tint-ink:hsl(${H} 26% 64%)"` : '';
        s += `<rect class="${cls}" x="0" y="0" width="${w}" height="${h}" rx="2"${sty}/>`;
        s += `<text class="hand" x="${w / 2}" y="18" text-anchor="middle" font-size="13" font-weight="700">${tspans(fitLines(wrap(p.title || 'Passo', Math.max(8, Math.floor(w / 8))), 2), w / 2, 18, 15)}</text>`;
        s += `<line class="pencil-thin" x1="8" y1="42" x2="${w - 8}" y2="42"/>`;
        const roomForOwner = p.owner ? 12 : 0; // l'etichetta del responsabile sta in basso a destra: non farci finire sopra l'ultima riga
        const blk = R.activityBlock(p.activities, w, h, roomForOwner);
        s += `<text class="hand" x="8" y="${blk.y0}" font-size="${blk.size}">${tspans(fitLines(blk.lines, blk.max), 8, blk.y0, blk.lineH)}</text>`;
        if (p.owner) s += `<text class="hand muted" x="${w - 6}" y="${h - 6}" text-anchor="end" font-size="9">${esc(p.owner)}</text>`;
        const hasData = p.hi !== '' || p.lo !== '' || p.avg !== '';
        // in DISEGNA i numeri non ci sono per definizione: al posto della targhetta vuota un
        // orologino tenue ricorda che i tempi arriveranno dal cronometro (esito stazione 1, 25/8)
        if (!hasData && map.phase === 'disegna') s += clockHint(w / 2, h + 14);
        else s += `<text class="hand ${hasData ? '' : 'muted'}" x="${w / 2}" y="${h + 14}" text-anchor="middle" font-size="10">${hasData ? tspans(['Hi: ' + fmt(num(p.hi)), 'Lo: ' + fmt(num(p.lo)), 'Avg: ' + fmt(num(p.avg))], w / 2, h + 14, 12) : `<tspan x="${w / 2}" y="${h + 14}">Hi / Lo / Avg ?</tspan>`}</text>`;
        if (p.cc !== '' && p.cc != null) s += `<text class="hand" x="${w / 2}" y="${h + 52}" text-anchor="middle" font-size="9">C&amp;C ${esc(p.cc)} %</text>`;
        // In Misura/Analizza ogni passo porta il suo CRONOMETRO grande e toccabile (esito
        // stazione 3, 25/8): il tocco fa partire (o riprendere) la misura di quel passo — il
        // cablaggio sta in interact (data-mis). Verde pieno = sta misurando QUI; il conteggio
        // vivo (mm:ss) lo scrive il ticker (R.misuraOverlay), non questo render statico.
        if (uiVivo && (map.phase === 'misura' || map.phase === 'analizza')) {
          const ms = map.measure;
          const attivo = !!(ms && ms.phase === 'box' && ms.stepId === el.id);
          const nMis = V.timesOf(el).length;
          const cx2 = w - 2, ink2 = attivo ? '#fff' : '#2b2b2b';
          s += `<g class="mis-clock${attivo ? ' mis-attivo' : ''}" data-mis="${esc(el.id)}">`
            + `<circle class="mis-hit" cx="${cx2}" cy="2" r="24" fill="transparent"/>`
            + `<circle cx="${cx2}" cy="2" r="15" fill="${attivo ? '#2e7d32' : '#fffdf7'}" stroke="${attivo ? '#2e7d32' : '#2b2b2b'}" stroke-width="1.6"/>`
            + `<g fill="none" stroke="${ink2}" stroke-width="1.8" stroke-linecap="round">`
            + `<circle cx="${cx2}" cy="3.4" r="7"/>`
            + `<path d="M${cx2 - 2.6} -6.4 h5.2 M${cx2} -6 v2.2 M${cx2} 3.4 v-4 M${cx2} 3.4 l2.8 1.9"/>`
            + `</g>`
            + (nMis ? `<text class="hand" x="${cx2}" y="28" text-anchor="middle" font-size="9">${nMis}×</text>` : '')
            + `</g>`;
        }
        break;
      }
      case 'delta': {
        s += `<path class="delta" d="M0 0 h${w} l-${w / 2} ${h} z"/>`;
        // glifo del tipo di attesa (cap. 8): in-box = vassoio, coda = persone in fila, viaggio = freccia, sala d'attesa = orologio
        const gx = w + 4, gy = 2;
        if (p.kind === 'in-box') s += `<g class="pencil-thin"><path d="M${gx} ${gy + 10} h14 v5 h-14 z M${gx + 2} ${gy + 10} l2 -6 h6 l2 6" fill="#fffdf7"/><text class="hand" x="${gx + 7}" y="${gy + 8}" text-anchor="middle" font-size="5">IN</text></g>`;
        else if (p.kind === 'coda') s += `<g class="pencil-thin">${[0, 5, 10].map(o => `<circle cx="${gx + 3 + o}" cy="${gy + 4}" r="2" fill="#fffdf7"/><path d="M${gx + 3 + o} ${gy + 6} v6"/>`).join('')}</g>`;
        else if (p.kind === 'viaggio') s += `<g class="pencil-thin"><path d="M${gx} ${gy + 8} h12 M${gx + 9} ${gy + 5} l3 3 -3 3"/><path d="M${gx} ${gy + 8} q6 -8 12 0" stroke-dasharray="2 2"/></g>`;
        else if (p.kind === "sala d'attesa") s += `<g class="pencil-thin"><circle cx="${gx + 7}" cy="${gy + 8}" r="6.5" fill="#fffdf7"/><path d="M${gx + 7} ${gy + 8} V${gy + 4} M${gx + 7} ${gy + 8} H${gx + 10}"/></g>`;
        // nota stretta (13 caratteri, 2 righe): il delta è largo 30 px e due attese vicine si toccherebbero. Il testo intero resta nel pop-up
        const noteLines = p.note ? fitLines(wrap(p.note, 13), 2) : [];
        if (p.note) s += `<text class="hand delta-txt" x="${w / 2}" y="${h + 14}" text-anchor="middle" font-size="9">${tspans(noteLines, w / 2, h + 14, 10)}</text>`;
        const hasData = p.hi !== '' || p.lo !== '' || p.avg !== '';
        const dy = h + 14 + (p.note ? noteLines.length * 10 + 4 : 4);
        // stessa regola del box: in disegna niente «attesa ?», solo l'orologino (esito stazione 1)
        if (!hasData && map.phase === 'disegna') s += clockHint(w / 2, dy);
        else s += `<text class="hand delta-txt" x="${w / 2}" y="${dy}" text-anchor="middle" font-size="10" ${hasData ? '' : 'opacity=".55"'}>${hasData ? tspans(['Hi: ' + fmt(num(p.hi)), 'Lo: ' + fmt(num(p.lo)), 'Avg: ' + fmt(num(p.avg))], w / 2, dy, 12) : `<tspan x="${w / 2}" y="${dy}">attesa ?</tspan>`}</text>`;
        break;
      }
      case 'person': {
        const cx = w / 2;
        s += `<g class="pencil">${R.face(p.mood, cx, 9, 9)}<path d="M${cx} 18 V44 M${cx - 14} 28 H${cx + 14} M${cx} 44 L${cx - 12} 66 M${cx} 44 L${cx + 12} 66"/></g>`;
        // senza etichetta si vede un segnaposto tenue: l'app chiede chi è, non lo decide al posto tuo
        // (prima nasceva già scritto «richiedente», e quella parola restava lì anche quando era un paziente)
        s += `<text class="hand" x="${cx}" y="${h + 4}" text-anchor="middle" font-size="11" ${p.label && p.requestor ? 'font-weight="700"' : ''} ${p.label ? '' : 'opacity=".45"'}>${tspans(fitLines(wrap(p.label || 'chi?', 16), 2), cx, h + 4, 12)}</text>`;
        if (p.role) s += `<text class="hand muted" x="${cx}" y="${h + 30}" text-anchor="middle" font-size="9">${esc(p.role)}</text>`;
        break;
      }
      case 'storm': case 'fluffy': {
        const cls = el.type === 'storm' ? 'cloud' : 'fluffy';
        // la forma del problema si sceglie: nuvola (quella del libro), cerchio, quadrato, triangolo
        const forma = el.type === 'storm' ? V.shapeOf(el) : 'nuvola';
        // ridotto al segno: la forma resta, piccola, con una «i» dentro — il testo si legge toccandola
        if (el.type === 'storm' && p.collapsed) {
          s += `<path class="alert" d="${shapePath(forma, w, h)}"/>`;
          s += `<text class="hand alert-i" x="${w / 2}" y="${(h * (forma === 'triangolo' ? 0.9 : 0.72)).toFixed(1)}" text-anchor="middle" font-size="15" font-weight="700">i</text>`;
          break;
        }
        s += `<path class="${cls}" d="${shapePath(forma, w, h)}"/>`;
        // il problema porta un fulmine rosso: senza, nuvola e nuvoletta erano gemelle a colpo d'occhio.
        // Ogni forma ha il suo angolo buono: sul triangolo, in basso a destra, il fulmine finiva fuori.
        if (el.type === 'storm') {
          const fx = forma === 'nuvola' ? w - 12 : w + 6, fy = forma === 'nuvola' ? h - 13 : h / 2 - 7;
          s += `<path d="M${fx.toFixed(1)} ${fy.toFixed(1)} l-4.5 7 h3.6 l-4.5 8" fill="none" stroke="#c8321e" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;
        }
        // il testo sta dentro la pancia (ogni riga larga quanto la sua banda) e non si tronca MAI:
        // se non ci sta è la nuvola a essere troppo bassa, e la rialza cloudFit — alla scrittura,
        // al ridimensionamento e all'apertura del documento
        const lines = R.cloudLines(w, h, p.text || (el.type === 'storm' ? 'problema…' : 'idea…'), forma).lines;
        const cy = h * R.shapeCenter(forma) - (lines.length - 1) * 5.5 + 3;
        s += `<text class="hand ${cls}-txt" x="${w / 2}" y="${cy.toFixed(1)}" text-anchor="middle" font-size="9.5">${tspans(lines, w / 2, cy, 11)}</text>`;
        if (el.type === 'storm' && (p.muda || p.rule)) s += `<text class="hand cloud-txt" x="${w / 2}" y="${h + 10}" text-anchor="middle" font-size="8">${esc([p.muda, p.rule ? 'R' + p.rule[0] : ''].filter(Boolean).join(' · '))}${p.a3 ? ' · A3' : ''}</text>`;
        break;
      }
      case 'burst': {
        s += `<path class="burst" d="${burstPath(w, h)}"/>`;
        const lines = wrap(p.text || 'kaizen', Math.max(8, Math.floor(w / 6.5))).slice(0, 3);
        s += `<text class="hand burst-txt" x="${w / 2}" y="${h / 2 - (lines.length - 1) * 5 + 3}" text-anchor="middle" font-size="9">${tspans(lines, w / 2, h / 2 - (lines.length - 1) * 5 + 3, 10)}</text>`;
        if (p.owner) s += `<text class="hand burst-txt" x="${w / 2}" y="${h + 10}" text-anchor="middle" font-size="8">${esc(p.owner)} · ${esc(p.priority)}</text>`;
        break;
      }
      case 'inventory': {
        s += `<path class="inv" d="M0 0 h${w} l-${w / 2} ${h - 8} z"/><text class="hand" x="${w / 2}" y="${h / 2 - 2}" text-anchor="middle" font-size="11" font-weight="700">I</text>`;
        s += `<text class="hand" x="${w / 2}" y="${h + 10}" text-anchor="middle" font-size="9">${tspans([p.what || 'scorta', [p.qty ? p.qty + ' pz' : '', p.days ? p.days + ' gg' : ''].filter(Boolean).join(' · ')].filter(Boolean), w / 2, h + 10, 10)}</text>`;
        break;
      }
      case 'inbox': {
        if (p.kind === 'orologio') s += `<g class="pencil"><circle cx="${w / 2}" cy="${h / 2}" r="${h / 2 - 2}" fill="#fffdf7"/><path d="M${w / 2} ${h / 2} V${h / 2 - 9} M${w / 2} ${h / 2} H${w / 2 + 7}"/></g>`;
        else if (p.kind === 'coda') s += `<g class="pencil">${[0, 12, 24].map(o => `<circle cx="${8 + o}" cy="9" r="4" fill="#fffdf7"/><path d="M${8 + o} 13 v10 M${3 + o} 18 h10"/>`).join('')}</g>`;
        else s += `<g class="pencil"><path d="M2 ${h - 8} h${w - 4} v6 h-${w - 4} z M2 ${h - 8} l6 -${h - 12} h${w - 16} l6 ${h - 12}" fill="#fffdf7"/><text class="hand" x="${w / 2}" y="${h - 11}" text-anchor="middle" font-size="9">IN</text></g>`;
        s += `<text class="hand delta-txt" x="${w / 2}" y="${h + 11}" text-anchor="middle" font-size="9">${esc(p.avg ? 'attesa ' + p.avg : (p.kind || 'in-box'))}</text>`;
        break;
      }
      case 'distance': {
        s += `<path class="pencil-thin" d="M2 ${h / 2} H${w - 2} M6 ${h / 2 - 4} L2 ${h / 2} L6 ${h / 2 + 4} M${w - 6} ${h / 2 - 4} L${w - 2} ${h / 2} L${w - 6} ${h / 2 + 4}"/>`;
        s += `<text class="hand" x="${w / 2}" y="${h / 2 - 5}" text-anchor="middle" font-size="10">${esc(p.meters ? p.meters + ' m' : '… m')}</text>`;
        if (p.from || p.to) s += `<text class="hand muted" x="${w / 2}" y="${h + 8}" text-anchor="middle" font-size="8">${esc([p.from, p.to].filter(Boolean).join(' → '))}</text>`;
        break;
      }
      case 'lane': {
        s += `<rect class="lane" x="0" y="0" width="${w}" height="${h}" rx="4" ${p.color ? `style="fill:${esc(p.color)}22;stroke:${esc(p.color)}"` : ''}/>`;
        s += `<text class="hand" x="8" y="16" font-size="12" font-weight="700" fill="#1f4e79">${esc(p.name || 'Reparto')}</text>`;
        break;
      }
      case 'text': {
        const sz = p.size || 12, lh = sz * 1.25;
        // niente taglio: una nota scritta dall'utente va letta tutta. È invece l'altezza memorizzata a essere
        // sbagliata (resta quella di default), perciò il riquadro di selezione la ricalcola con R.elSize
        s += `<text class="hand" x="0" y="${sz}" font-size="${sz}">${tspans(R.textLines(el), 0, sz, lh)}</text>`;
        break;
      }
      case 'icon': {
        const r = Math.min(w, h) / 2;
        s += `<circle class="icon-bg" cx="${w / 2}" cy="${r}" r="${r}"/>${R.iconSVG(p.icon, w / 2, r, (r * 2 - 8) / 24)}`;
        if (p.label) s += `<text class="hand" x="${w / 2}" y="${r * 2 + 11}" text-anchor="middle" font-size="9">${tspans(fitLines(wrap(p.label, 16), 2), w / 2, r * 2 + 11, 10)}</text>`;
        break;
      }
      case 'face': {
        const r = Math.min(w, h) / 2;
        s += `<g class="pencil">${R.face(p.mood, w / 2, r, r - 1)}</g>`;
        const lab = p.label || (p.who ? p.who + (p.mood && p.mood !== 'neutro' ? ' · ' + p.mood : '') : (p.mood || ''));
        if (lab) s += `<text class="hand" x="${w / 2}" y="${r * 2 + 11}" text-anchor="middle" font-size="9">${tspans(wrap(lab, 18).slice(0, 2), w / 2, r * 2 + 11, 10)}</text>`;
        break;
      }
      case 'legend': {
        if (p.collapsed) { s += `<g data-toggle-legend="${el.id}" style="cursor:pointer"><rect x="0" y="0" width="${w}" height="${h}" rx="9" fill="#fffdf7" stroke="#5a5a5a" stroke-width="1"/><text class="hand" x="${w / 2}" y="13" text-anchor="middle" font-size="10">Legenda ▸</text></g>`; break; }
        s += `<rect x="-4" y="-4" width="${w + 8}" height="${h + 8}" rx="6" fill="transparent"/>`;
        s += `<g data-toggle-legend="${el.id}" style="cursor:pointer"><rect x="${w - 22}" y="-2" width="22" height="16" rx="6" fill="#fffdf7" stroke="#5a5a5a" stroke-width="1"/><text class="hand" x="${w - 11}" y="10" text-anchor="middle" font-size="10">▾</text></g>`;
        s += `<g font-size="10" class="hand"><text x="0" y="10" font-weight="700">Legenda</text>
          <rect x="0" y="18" width="16" height="12" class="box"/><text x="22" y="28">passo (process box)</text>
          <path d="M2 38 h12 l-6 10 z" class="delta"/><text x="22" y="46">attesa (delta) = spreco</text>
          <path class="cloud" d="M6 58 h10 a5 5 0 0 0 2 -8 a5 5 0 0 0 -8 -4 a6 6 0 0 0 -10 2 a5 5 0 0 0 0 10 z"/><text x="22" y="64">problema (nuvola)</text>
          <path class="pencil" d="M0 78 h14 M11 75 l3 3 -3 3"/><text x="22" y="82">flusso · richiesta con canale</text>
          ${R.chanIcon('telefono', 8, 96, 0.55)}${R.chanIcon('e-mail', 24, 96, 0.55)}${R.chanIcon('di persona', 40, 96, 0.55)}<text x="52" y="99">canali (telefono, e-mail, di persona…)</text>
          <text x="0" y="113" font-size="8.5" class="muted">colore della via = canale · tratto = famiglia</text></g>`;
        break;
      }
    }
    // ↗ = qui dentro c'è un sotto-foglio (l'albero scende di qui) · ⇉ = questo passo richiama una
    // mappa che sta altrove, e accanto c'è scritto DOVE: senza, aprirla lasciava spaesati
    if (p.link) {
      const dove = lk === 'riferimento' ? V.shortAddress(V.mapAddress(V.doc.maps[p.link])) : '';
      // badge e occhio si usano COL DITO (l'app dichiara --tap: 44px): i disegni restano piccoli per
      // non coprire il passo, ma le aree sensibili sono due dischi trasparenti da r=20 (~42 px allo
      // zoom di lavoro) con i centri a 48 unita' l'uno dall'altro. Misurati a schermo il 2026-08-21
      // erano 17 px e 11 px a 13 px fra i centri: si sbagliava bersaglio e invece di sbirciare si
      // cambiava foglio. Chi non azzecca comunque il disco ha «Sbircia» fra le azioni rapide.
      s += `<g class="link-badge-g" data-link="${esc(p.link)}"><circle class="link-hit" cx="${w - 2}" cy="2" r="20" fill="transparent"/><circle class="link-badge" cx="${w - 2}" cy="2" r="9"/><text class="link-badge-txt" x="${w - 2}" y="5.5" text-anchor="middle">${lk === 'riferimento' ? '⇉' : '↗'}</text></g>`;
      if (dove) s += `<text class="hand muted" x="${w - 12}" y="22" text-anchor="end" font-size="9">${esc(dove)}</text>`;
      // l'occhio: sbirciare il foglio senza entrarci. Sta a sinistra del badge e si apre al RILASCIO
      // (gesto 'peek' in interact.js): un pop-up nato sotto il dito al pointerdown ingoierebbe il
      // pointerup, e il pan successivo diventerebbe zoom — la lezione del sesto giro.
      if (V.doc.maps[p.link]) {
        const ex = w - 50;
        s += `<g class="peek-badge-g" data-peek="${esc(p.link)}" data-box="${esc(el.id)}"><circle class="peek-hit" cx="${ex}" cy="2" r="20" fill="transparent"/><circle class="peek-badge" cx="${ex}" cy="2" r="9.5"/><path class="peek-eye" d="M${ex - 5.5} 2 Q${ex} -3 ${ex + 5.5} 2 Q${ex} 7 ${ex - 5.5} 2 Z"/><circle class="peek-pupil" cx="${ex}" cy="2" r="1.8"/></g>`;
      }
    }
    return s;
  }
  R.drawEl = drawEl;

  // ---------- icone canale (24x24, monocromatiche) ----------
  const CHAN_ICONS = {
    'telefono': 'M6 3h4l2 5-2.5 1.5a11 11 0 005 5L16 12l5 2v4a2 2 0 01-2 2A16 16 0 013 5a2 2 0 012-2z',
    'fax': 'M6 8V4h9l3 3v1M4 8h16a2 2 0 012 2v6h-4v4H6v-4H2v-6a2 2 0 012-2zm4 6h8v4H8z',
    'e-mail': 'M3 6h18v12H3zM3 6l9 7 9-7',
    'verbale': 'M4 5h16v10H9l-5 4zM8 9h8M8 12h5',
    'di persona': 'M9 7a3 3 0 106 0 3 3 0 00-6 0zM4 21v-1a5 5 0 015-5h6a5 5 0 015 5v1',
    'sistema': 'M3 5h18v11H3zM8 20h8M12 16v4',
    'cartaceo': 'M6 3h9l4 4v14H6zM15 3v4h4M9 12h6M9 16h6',
    'inferita': 'M12 3a9 9 0 100 18 9 9 0 000-18zM9.5 9.5a2.5 2.5 0 015 0c0 2-2.5 2-2.5 4M12 17h.01',
    'altro': 'M5 12h.01M12 12h.01M19 12h.01'
  };
  /** libreria di icone inseribili (24×24, tratto): canali + mezzi, documenti, dispositivi, luoghi, ruoli */
  R.ICONS = {
    'canali': CHAN_ICONS,
    'mezzi e spostamenti': {
      'ambulanza': 'M2 8h11v9H2zM13 11h5l3 3v3h-8zM6 17a1.5 1.5 0 100 .01M17 17a1.5 1.5 0 100 .01M7 10v4M5 12h4',
      'letto': 'M3 7v11M3 12h18v6M6 12V9h6v3M21 18v-2',
      'sedia a rotelle': 'M8 5a1.5 1.5 0 100-.01M8 7v6h6l3 5M14 13l1 4M8 13a5 5 0 106 6',
      'carrello': 'M3 4h2l2 11h11l2-8H6M9 20a1 1 0 100 .01M17 20a1 1 0 100 .01',
      'ascensore': 'M5 3h14v18H5zM12 3v18M8 10l1.5-2 1.5 2M14 14l1.5 2 1.5-2',
      'a piedi': 'M13 4a1.5 1.5 0 100 .01M10 20l2-6 3 2 1 4M9 12l3-4 3 1 2 3M12 14l-3 6',
      'auto': 'M4 15l2-6h12l2 6v4H4zM7 19a1.5 1.5 0 100 .01M17 19a1.5 1.5 0 100 .01M4 15h16'
    },
    'documenti e campioni': {
      'cartella clinica': 'M6 3h9l4 4v14H6zM15 3v4h4M10 13h4M12 11v4',
      'referto': 'M6 3h9l4 4v14H6zM15 3v4h4M9 12h6M9 16h6M9 9h2',
      'ricetta': 'M6 3h12v18H6zM9 8h3a2 2 0 010 4H9V8M9 12l4 5M13 12l-4 5',
      'modulo': 'M5 4h14v16H5zM8 9h2v2H8zM12 10h4M8 14h2v2H8zM12 15h4',
      'etichetta': 'M3 7h11l5 5-5 5H3zM7 12h.01',
      'provetta': 'M9 3h6M10 3v11a2 2 0 104 0V3M10 10h4',
      'busta': 'M3 6h18v12H3zM3 6l9 7 9-7'
    },
    'dispositivi': {
      'computer': 'M3 5h18v11H3zM8 20h8M12 16v4',
      'tablet': 'M6 2h12v20H6zM12 19h.01',
      'stampante': 'M6 8V4h9l3 3v1M4 8h16a2 2 0 012 2v6h-4v4H6v-4H2v-6a2 2 0 012-2zm4 6h8v4H8z',
      'monitor paziente': 'M3 5h18v13H3zM6 12h3l2-4 2 8 2-4h3',
      'cercapersone': 'M5 7h14v10H5zM8 10h8M8 13h5',
      'scanner': 'M4 8h16v9H4zM4 12h16M8 5h8',
      'campanello': 'M6 17h12l-1.5-3V10a4.5 4.5 0 00-9 0v4zM10 20h4'
    },
    'luoghi': {
      'porta': 'M5 3h14v18H5zM15 12h.01M9 3v18',
      'sala d\'attesa': 'M4 12h6v6H4zM14 12h6v6h-6zM4 12V8h6v4M14 12V8h6v4M5 18v2M9 18v2M15 18v2M19 18v2',
      'ambulatorio': 'M4 21V9l8-6 8 6v12zM10 21v-6h4v6',
      'laboratorio': 'M9 3h6M10 3v6l-5 9h14l-5-9V3M8 15h8',
      'farmacia': 'M5 5h14v14H5zM12 8v8M8 12h8',
      'radiologia': 'M12 3v18M6 7h12M7 11h10M8 15h8',
      'sala operatoria': 'M4 12h16M12 12v6M8 6a4 4 0 018 0v6H8z',
      'archivio': 'M4 5h16v4H4zM4 9h16v10H4zM10 13h4'
    },
    'ruoli': {
      'medico': 'M6 3v6a6 6 0 0012 0V3M12 15v3a3 3 0 006 0v-2M18 14a1.5 1.5 0 100 .01',
      'infermiere': 'M9 7a3 3 0 106 0 3 3 0 00-6 0zM4 21v-1a5 5 0 015-5h6a5 5 0 015 5v1M12 2v3M10.5 3.5h3',
      'paziente a letto': 'M4 18h16M4 18V9M7 13a2 2 0 100 .01M10 15h10v3',
      'famigliare': 'M7 8a2.5 2.5 0 105 0 2.5 2.5 0 00-5 0zM14 9a2 2 0 104 0 2 2 0 00-4 0zM3 20v-1a4 4 0 014-4h4a4 4 0 014 4v1M15 20v-1a3 3 0 013-3h1a3 3 0 012 1',
      'segreteria': 'M9 7a3 3 0 106 0 3 3 0 00-6 0zM4 21v-1a5 5 0 015-5h6a5 5 0 015 5v1M17 6h4M19 4v4'
    }
  };
  R.iconPath = (name) => { for (const g of Object.values(R.ICONS)) if (g[name]) return g[name]; return CHAN_ICONS.altro; };
  R.ICON_NAMES = () => Object.values(R.ICONS).flatMap(g => Object.keys(g));
  R.iconSVG = (name, cx, cy, sc = 0.7) => `<g transform="translate(${cx - 12 * sc} ${cy - 12 * sc}) scale(${sc})"><path d="${R.iconPath(name)}" fill="none" stroke="#2b2b2b" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></g>`;
  /** faccia con espressione (testa r, centro cx,cy): usata dall'omino e dall'elemento "faccia" */
  R.face = (mood, cx, cy, r = 9) => {
    const k = r / 9; const P = (x, y) => `${(cx + x * k).toFixed(2)} ${(cy + y * k).toFixed(2)}`; const q = (dx, dy) => `${(dx * k).toFixed(2)} ${(dy * k).toFixed(2)}`;
    const dot = (x, y, rr = .9) => `<circle cx="${(cx + x * k).toFixed(2)}" cy="${(cy + y * k).toFixed(2)}" r="${(rr * k).toFixed(2)}" fill="#2b2b2b" stroke="none"/>`;
    const eyes = { std: dot(-3, -2) + dot(3, -2), side: dot(-2, -2.4) + dot(4, -2.4), wide: dot(-3, -2, 1.3) + dot(3, -2, 1.3), closed: `<path d="M${P(-4.5, -2)} q${q(1.5, 1.6)} ${q(3, 0)} M${P(1.5, -2)} q${q(1.5, 1.6)} ${q(3, 0)}" stroke-width="${(1.1 * k).toFixed(2)}"/>`, tired: `<path d="M${P(-4.5, -2.4)} h${(3 * k).toFixed(2)} M${P(1.5, -2.4)} h${(3 * k).toFixed(2)}" stroke-width="${(1.2 * k).toFixed(2)}"/>` + dot(-3, -1.2, .7) + dot(3, -1.2, .7) };
    const brow = (l, r2) => `<path d="M${P(-5, -5.2)} l${q(3.6, l)} M${P(5, -5.2)} l${q(-3.6, r2)}" stroke-width="${(1.1 * k).toFixed(2)}"/>`;
    const sw = `stroke-width="${(1.2 * k).toFixed(2)}"`;
    const M = { smile: `<path d="M${P(-4, 3)} q${q(4, 4)} ${q(8, 0)}" ${sw}/>`, big: `<path d="M${P(-4.5, 2.5)} q${q(4.5, 5.5)} ${q(9, 0)} z" ${sw} fill="#2b2b2b"/>`, flat: `<path d="M${P(-4, 4)} h${(8 * k).toFixed(2)}" ${sw}/>`, frown: `<path d="M${P(-4, 5)} q${q(4, -4)} ${q(8, 0)}" ${sw}/>`, wavy: `<path d="M${P(-4, 4.5)} q${q(2, -2.5)} ${q(4, 0)} q${q(2, 2.5)} ${q(4, 0)}" ${sw}/>`, small: `<path d="M${P(-2, 4.5)} h${(4 * k).toFixed(2)}" ${sw}/>`, o: `<circle cx="${(cx).toFixed(2)}" cy="${(cy + 4.2 * k).toFixed(2)}" r="${(1.8 * k).toFixed(2)}" ${sw} fill="none"/>`, tinyfrown: `<path d="M${P(-3, 5)} q${q(3, -2.5)} ${q(6, 0)}" ${sw}/>` };
    let f = '';
    switch (mood) {
      case 'felice': f = eyes.std + M.smile; break;
      case 'soddisfatto': f = eyes.closed + M.smile; break;
      case 'triste': f = eyes.std + M.frown; break;
      case 'stanco': f = eyes.tired + M.tinyfrown; break;
      case 'confuso': f = eyes.std + brow(-1.6, 0.4) + M.wavy + `<text x="${(cx + 6.5 * k).toFixed(2)}" y="${(cy - 6 * k).toFixed(2)}" font-size="${(7 * k).toFixed(2)}" font-weight="700" fill="#2b2b2b" stroke="none" style="font-family:var(--ui)">?</text>`; break;
      case 'arrabbiato': f = eyes.std + brow(1.8, 1.8) + M.frown; break;
      case 'in attesa': f = eyes.side + M.small + `<circle cx="${(cx + 6.5 * k).toFixed(2)}" cy="${(cy - 7 * k).toFixed(2)}" r="${(2.8 * k).toFixed(2)}" fill="#fffdf7" stroke-width="${(0.9 * k).toFixed(2)}"/><path d="M${P(6.5, -7)} v${(-1.9 * k).toFixed(2)} M${P(6.5, -7)} h${(1.4 * k).toFixed(2)}" stroke-width="${(0.9 * k).toFixed(2)}"/>`; break;
      case 'preoccupato': f = eyes.std + brow(-1.6, -1.6) + M.wavy; break;
      case 'sorpreso': f = eyes.wide + brow(-1.2, -1.2) + M.o; break;
      default: f = eyes.std + M.flat;
    }
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fffdf7"/>${f}`;
  };
  R.chanIcon = (ch, cx, cy, sc = 0.7, col) => `<g transform="translate(${cx - 12 * sc} ${cy - 12 * sc}) scale(${sc})"><path d="${CHAN_ICONS[ch] || CHAN_ICONS.altro}" fill="none" stroke="${col || (V.channelLook(ch) || {}).color || '#2b2b2b'}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></g>`;

  // ---------- percorsi dei collegamenti ----------
  // Un percorso espone sempre: d (stringa SVG), a/b (estremi), bez(t)/at(t) = punto alla frazione t,
  // pts (campioni lungo il tracciato) e len. Serve perché icona del canale, etichette, delta agganciati,
  // legami di blocco e maniglie chiedono "il punto a t" senza sapere se il tratto è curvo, dritto o squadrato.
  const NCAMP = 32; // campioni: abbastanza per misurare e per cercare il punto più vicino
  const lenOf = (pts) => { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); return L; };
  /** curva di Bézier cubica: t resta il parametro della curva (com'è sempre stato) */
  const mkCurve = (a, p1, p2, b) => {
    const at = (t) => { const mt = 1 - t; return { x: mt * mt * mt * a.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * b.x, y: mt * mt * mt * a.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * b.y }; };
    const pts = []; for (let i = 0; i <= NCAMP; i++) pts.push(at(i / NCAMP));
    return { d: `M${a.x} ${a.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${b.x} ${b.y}`, a, b, at, bez: at, pts, len: lenOf(pts), kind: 'curve' };
  };
  /** spezzata (retta o percorso squadrato): qui t è la frazione di *lunghezza*, l'unica misura
      che tiene ferma l'icona del canale dove l'utente l'ha lasciata anche cambiando forma del tratto */
  const mkPoly = (nodes) => {
    const pts = nodes.filter((p, i) => i === 0 || Math.hypot(p.x - nodes[i - 1].x, p.y - nodes[i - 1].y) > 0.01);
    if (pts.length < 2) pts.push({ x: pts[0].x, y: pts[0].y });
    const segs = []; let L = 0;
    for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); segs.push(d); L += d; }
    const at = (t) => {
      const u = Math.max(0, Math.min(1, t)) * L; let acc = 0;
      for (let i = 0; i < segs.length; i++) {
        if (acc + segs[i] >= u || i === segs.length - 1) { const k = segs[i] ? (u - acc) / segs[i] : 0; return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * k, y: pts[i].y + (pts[i + 1].y - pts[i].y) * k }; }
        acc += segs[i];
      }
      return { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y };
    };
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ');
    return { d, a: pts[0], b: pts[pts.length - 1], at, bez: at, pts: pts.slice(), len: L, kind: 'poly' };
  };
  R.mkCurve = mkCurve; R.mkPoly = mkPoly;

  // ---------- connettori ----------
  /** estremi di una via di richiesta: dal fianco del richiedente al bordo alto del bersaglio.
      Calcolati a parte perché servono anche per assegnare le corsie, prima di sapere che forma avrà il tratto. */
  /** L'elemento come lo si VEDE: un elemento bloccato sta a R.elPos, non ai suoi x/y grezzi. Centro e
   *  ancore delle frecce (e la timeline) devono usare questa proiezione: senza, su un box bloccato che
   *  segue il genitore le frecce restavano attaccate alla posizione vecchia. */
  const seenEl = (el, map) => { if (!el || !el.props || !(el.props.lockTo || (el.type === 'delta' && el.props.attachedTo))) return el; const p = R.elPos(el, map); return (p.x === el.x && p.y === el.y) ? el : Object.assign({}, el, p); };
  R.seenEl = seenEl;
  /** da dove esce una via di richiesta: il fianco del richiedente. Serve anche al filo che si vede
   *  mentre si trascina, cosi' il tratto provvisorio e la freccia vera partono dallo stesso punto. */
  R.reqStart = (from) => from ? { x: from.x, y: from.y + (from.type === 'person' ? 26 : from.h / 2) } : { x: 0, y: 0 };
  const reqEnds = (c, map, proj = true) => {
    const from0 = c.from.el ? V.byId(c.from.el, map) : null, to0 = c.to.el ? V.byId(c.to.el, map) : null;
    const from = proj ? seenEl(from0, map) : from0, to = proj ? seenEl(to0, map) : to0;
    // Punti d'arrivo distinti sul bordo alto del passo. L'indice è calcolato fra le vie che arrivano *lì*:
    // props.offset conta le vie dello stesso richiedente, quindi due richiedenti diversi che chiamano lo
    // stesso passo finivano entrambi sullo stesso punto, con i due percorsi sovrapposti.
    const same = c.to.el ? map.elements.filter(e => e.type === 'request' && e.to.el === c.to.el).sort((A, B) => (A.props.offset || 0) - (B.props.offset || 0)) : [];
    const i = Math.max(0, same.indexOf(c)), n = Math.max(1, same.length);
    // Gli arrivi si distribuiscono sul bordo alto del passo invece di scalare di 46 px fissi: con quel
    // passo, su un box da 150, il terzo e il quarto punto finivano tutti e due sul minimo di 10 px e le
    // vie si sovrapponevano. Ora la larghezza disponibile si divide fra quante sono, e i punti restano
    // dentro il box qualunque sia il loro numero.
    const passo = to ? Math.min(46, Math.max(12, (to.w - 20) / n)) : 46;
    const off = i * passo;
    const b = to ? { x: to.x + Math.max(10, Math.min(to.w - 10, to.w / 2 - ((n - 1) * passo) / 2 + off)), y: to.y } : { x: c.to.x, y: c.to.y };
    // Anche le partenze si sfalsano lungo il fianco del richiedente: partendo tutte dallo stesso punto,
    // vicino all'omino le vie si leggevano come un tratto solo e i tocchi se le contendevano.
    const sameFrom = c.from.el ? map.elements.filter(e => e.type === 'request' && e.from.el === c.from.el).sort((A, B) => (A.props.offset || 0) - (B.props.offset || 0)) : [];
    const j = Math.max(0, sameFrom.indexOf(c));
    const a = from ? { x: from.x, y: from.y + (from.type === 'person' ? 26 : from.h / 2) + (from.type === 'person' ? Math.min(j, 4) * 9 : 0) } : { x: c.from.x, y: c.from.y };
    return { a, b, off };
  };
  // L'instradamento automatico delle vie di richiesta (modalità «squadrata»: corsie, aggiramento
  // degli ostacoli, etichette in corsia) è stato tolto insieme alla modalità, che non è più fra
  // quelle scegliibili — le frecce vanno dritte al bersaglio e il percorso si piega a mano.
  // Erano ~180 righe che nessuna strada del codice poteva più raggiungere: chi leggeva il file si
  // trovava davanti soluzioni pronte (lo sfalsamento delle partenze) che non giravano mai.
  // La versione con le corsie sta nella storia di git, al commit che precede questa nota.
  // guardia di rientro: elPos di un elemento bloccato a un connettore richiama connPath — nel caso
  // patologico (capo bloccato al suo stesso connettore, o ciclo fra due frecce) il giro interno usa
  // le posizioni grezze invece di ricorrere all'infinito
  const _cpGuard = new Set();
  R.connPath = (c, map) => {
    const reent = _cpGuard.has(c.id); if (!reent) _cpGuard.add(c.id);
    try {
    const mode = V.linkModeOf(map);
    const from0 = c.from.el ? V.byId(c.from.el, map) : null, to0 = c.to.el ? V.byId(c.to.el, map) : null;
    const from = reent ? from0 : seenEl(from0, map), to = reent ? to0 : seenEl(to0, map);
    const pf = from ? V.center(from) : { x: c.from.x, y: c.from.y }, pt = to ? V.center(to) : { x: c.to.x, y: c.to.y };
    if (c.type === 'request') {
      const { a, b, off } = reqEnds(c, map, !reent);
      let P, tDef;
      if (mode === 'dritta') {
        // percorso piegato a mano: la linea passa per i punti che l'utente ha trascinato
        const via = Array.isArray(c.props.via) ? c.props.via : [];
        P = mkPoly([a, ...via, b]);
        tDef = 0.5 + (((c.props.offset || 0) % 3) - 1) * 0.14;
      } else {
        // curva dal richiedente (in alto a destra) verso il bordo alto del bersaglio; più vie stesso paio → offset
        const p1 = { x: a.x - 90 - off, y: a.y + off * 1.2 }, p2 = { x: b.x + 70 + off, y: b.y - 60 - off * 1.6 };
        P = mkCurve(a, p1, p2, b);
        // etichetta in un punto diverso della curva per ogni via: al centro si accavallerebbero,
        // perché due curve vicine hanno punti medi distanti molto meno della loro separazione
        tDef = 0.5 + (((c.props.offset || 0) % 3) - 1) * 0.14;
      }
      const t = c.props.t == null ? tDef : c.props.t;
      return Object.assign(P, { mid: P.at(t), off, tDef });
    }
    const via = Array.isArray(c.props.via) ? c.props.via : [];
    // le ancore guardano il primo/ultimo punto di via, cosi' la freccia esce dal lato giusto del box
    const a = from ? V.anchor(from, via[0] || pt) : pf, b = to ? V.anchor(to, via[via.length - 1] || pf) : pt;
    // «Frecce: curve» vale anche per le frecce di flusso: il menu lo prometteva ma si curvavano solo le
    // vie di richiesta. Una piega fatta a mano (props.via) comanda comunque: chi ha piegato una linea
    // vuole quel percorso, non una curva calcolata.
    let P;
    if (mode === 'curva' && !via.length) {
      const dx = (b.x - a.x), dy = (b.y - a.y);
      const orizz = Math.abs(dx) >= Math.abs(dy);
      const k = Math.max(28, Math.min(140, Math.hypot(dx, dy) * 0.34));
      const p1 = orizz ? { x: a.x + Math.sign(dx || 1) * k, y: a.y } : { x: a.x, y: a.y + Math.sign(dy || 1) * k };
      const p2 = orizz ? { x: b.x - Math.sign(dx || 1) * k, y: b.y } : { x: b.x, y: b.y - Math.sign(dy || 1) * k };
      P = mkCurve(a, p1, p2, b);
    } else P = mkPoly([a, ...via, b]);
    const t = c.props.t == null ? 0.5 : c.props.t;
    return Object.assign(P, { mid: P.at(t), tDef: 0.5 });
    } finally { if (!reent) _cpGuard.delete(c.id); }
  };
  /** t più vicino a un punto lungo il connettore (campionamento) */
  R.nearestT = (c, map, pt) => { const P = R.connPath(c, map); let best = 0.5, bd = Infinity; for (let i = 0; i <= 60; i++) { const t = i / 60; const q = P.bez(t); const d = Math.hypot(q.x - pt.x, q.y - pt.y); if (d < bd) { bd = d; best = t; } } return Math.min(0.92, Math.max(0.08, best)); };
  function drawConn(c, map) {
    const P = R.connPath(c, map); const p = c.props; let s = '';
    if (!c.from.el || !c.to.el) s += `<circle cx="${!c.from.el ? P.a.x : P.b.x}" cy="${!c.from.el ? P.a.y : P.b.y}" r="5" fill="#fff" stroke="#c8321e" stroke-dasharray="2 2"/>`;
    if (c.type === 'flow') {
      s += `<path class="pencil" d="${P.d}" ${R.connAttrs(c)}/>`;
      if (p.or) s += `<text class="hand" x="${P.mid.x}" y="${P.mid.y - 8}" text-anchor="middle" font-size="10" font-style="italic">or</text>`;
      // l'etichetta sta SOPRA la linea (esito stazione 2, 25/8): il triangolo rosso dell'attesa
      // pende dal punto di mezzo verso il basso e la copriva; sopra resta sempre leggibile, e
      // l'alone di carta (conn-label, app.css) la difende dalle linee che incrociano. Con «or»
      // presente sale di un altro gradino per non pestarlo.
      if (p.label) s += `<text class="hand muted conn-label" x="${P.mid.x}" y="${P.mid.y - (p.or ? 20 : 10)}" text-anchor="middle" font-size="9">${esc(p.label)}</text>`;
    } else {
      s += `<path class="pencil" d="${P.d}" ${R.connAttrs(c)}/>`;
      // «si reca»: il pallino alla partenza (il piede di chi si muove) affianca la punta a V — due segni
      // per un solo significato, così la via non si legge come una richiesta nemmeno di sfuggita
      const kk = R.connLook(c);
      if (kk.start) s += `<circle cx="${P.a.x}" cy="${P.a.y}" r="3.4" fill="${esc(kk.stroke)}"/>`;
      const sub = [p.channel, p.to ? '→ ' + p.to : ''].filter(Boolean).join(' ');
      s += `<text class="chan-txt hand" x="${P.mid.x}" y="${P.mid.y + 22}" text-anchor="middle">${esc(sub)}</text>`;
      if (p.note) s += `<text class="hand muted" x="${P.mid.x}" y="${P.mid.y + 35}" text-anchor="middle" font-size="8.5">${esc(p.note.slice(0, 60))}</text>`;
      if (p.hands) s += `<text class="hand muted" x="${P.mid.x}" y="${P.mid.y - 18}" text-anchor="middle" font-size="9">${esc(p.hands)} mani</text>`;
    }
    s += `<path class="conn-hit" d="${P.d}"/>`;
    return s;
  }
  /** icona del canale (livello sopra gli elementi), trascinabile lungo la curva (props.t) */
  const chanHandleSVG = (c, map) => { const P = R.connPath(c, map), k = R.connLook(c); return `<g class="chan-handle" data-chan-handle="${esc(c.id)}"><circle class="chan" cx="${P.mid.x}" cy="${P.mid.y}" r="13" stroke="${k.stroke}"/>${R.chanIcon(c.props.channel, P.mid.x, P.mid.y, 0.7, k.stroke)}</g>`; };
  R.handles = (map) => { L.hand.innerHTML = map.elements.filter(c => c.type === 'request').map(c => chanHandleSVG(c, map)).join(''); };
  /** posizione effettiva di un delta agganciato a un connettore */
  R.deltaPos = (d, map) => {
    if (d.props.attachedTo) { const c = V.byId(d.props.attachedTo, map); if (c && V.isConnector(c)) { const P = R.connPath(c, map); return { x: P.mid.x - d.w / 2 + (d.props.dx || 0), y: P.mid.y - 4 + (d.props.dy || 0) }; } }
    return { x: d.x, y: d.y };
  };
  /** posizione effettiva: delta agganciato → sulla freccia; elemento bloccato (props.lockTo) → genitore + scostamento (anche su una freccia, a t) */
  R.elPos = (el, map, depth = 0) => {
    if (el.type === 'delta' && el.props.attachedTo) return R.deltaPos(el, map);
    if (el.props.lockTo && depth < 8) {
      const par = V.byId(el.props.lockTo, map);
      if (par) {
        if (V.isConnector(par)) { const P = R.connPath(par, map); const q = P.bez(el.props.lockT == null ? 0.5 : el.props.lockT); return { x: q.x + (el.props.dx || 0), y: q.y + (el.props.dy || 0) }; }
        const pp = R.elPos(par, map, depth + 1); return { x: pp.x + (el.props.dx || 0), y: pp.y + (el.props.dy || 0) };
      }
    }
    return { x: el.x, y: el.y };
  };
  R.LOCK_PARENTS = ['box', 'person', 'lane', 'flow', 'request', 'inventory'];
  // 'box' non è più legabile come FIGLIO (esito stazione 1, 25/8): la catena serve agli oggetti
  // (problemi, note, icone…) per restare attaccati al loro passo — un passo legato a un altro passo
  // trascinava mezzo flusso per sbaglio. I lockTo legacy box→box restano posizionati (elPos non
  // guarda questa lista): si possono solo slegare, non crearne di nuovi.
  R.LOCKABLE = ['storm', 'fluffy', 'burst', 'text', 'inbox', 'inventory', 'distance', 'delta', 'person', 'icon', 'face'];
  // ---------- testo dentro la nuvola ----------
  // La pancia non è un rettangolo: la nuvola si stringe verso l'alto e verso il basso. La larghezza
  // utile di ogni riga segue un profilo a ellisse (con margine per il tratto a matita), così le righe
  // ai bordi sono più corte di quelle in mezzo — prima tutte contavano sul 72% della larghezza e il
  // testo sforava ai bordi, oppure spariva troncato con «…».
  const CLOUD_LH = 11, CLOUD_CHW = 5, CLOUD_MARGIN = 26; // interlinea, larghezza media di un carattere, margine verticale complessivo
  /* Quanto è larga la forma all'altezza t (0 = cima, 1 = fondo), in frazione della larghezza: è ciò
     che decide quanti caratteri stanno in ogni riga. Il triangolo, stretto in cima, tiene meno testo
     alla stessa misura — e infatti cresce di più. */
  const BANDE = {
    nuvola: (t) => 0.84 * Math.sqrt(Math.max(0, 1 - Math.pow(2 * t - 1, 2))),
    cerchio: (t) => 0.92 * Math.sqrt(Math.max(0, 1 - Math.pow(2 * t - 1, 2))),
    quadrato: () => 0.88,
    triangolo: (t) => Math.max(0.06, 0.86 * Math.max(0, t - 0.14))
  };
  // dove sta il blocco di testo dentro la forma: al centro, tranne nel triangolo, che in cima non ha posto
  const CENTRO = { nuvola: 0.5, cerchio: 0.5, quadrato: 0.5, triangolo: 0.6 };
  // quanta aria serve sopra e sotto il testo: nel triangolo l'ultima riga finiva seduta sulla base
  const MARGINI = { nuvola: 26, cerchio: 26, quadrato: 22, triangolo: 42 };
  const cloudBand = (t) => BANDE.nuvola(t);
  /** Distribuisce il testo nella nuvola w×h: ogni riga prende il budget di caratteri della sua banda.
   *  Restituisce SEMPRE tutto il testo (niente troncamenti silenziosi): fits=false dice che le righe
   *  non bastano, e allora è l'altezza a dover crescere (R.cloudFit), non il testo a sparire. */
  R.cloudLines = (w, h, text, forma) => {
    const banda = BANDE[forma] || BANDE.nuvola;
    const centro = CENTRO[forma] != null ? CENTRO[forma] : 0.5;
    const words = String(text || '').split(/\s+/).filter(Boolean);
    if (!words.length) return { lines: [], fits: true };
    const cap = Math.max(1, Math.round((h - (MARGINI[forma] != null ? MARGINI[forma] : CLOUD_MARGIN)) / CLOUD_LH));
    // i budget dipendono dalla posizione di ogni riga, che dipende da quante righe escono:
    // si itera fino a numero stabile (più righe = bordi più stretti = mai meno righe, quindi converge)
    let n = 1, lines = [];
    for (let guard = 0; guard < 40; guard++) {
      const y0 = h * centro - (n - 1) * CLOUD_LH / 2;
      const budget = (i) => Math.max(6, Math.floor(w * banda((y0 + i * CLOUD_LH) / h) / CLOUD_CHW));
      lines = [''];
      words.forEach(word => {
        const i = lines.length - 1;
        const cand = lines[i] ? lines[i] + ' ' + word : word;
        if (lines[i] && cand.length > budget(i)) lines.push(word);
        else lines[i] = cand;
      });
      if (lines.length === n) break;
      n = lines.length;
    }
    return { lines, fits: lines.length <= cap };
  };
  /** altezza necessaria perché il testo stia nella pancia della nuvola (stesse costanti del disegno):
   *  si cresce di un'interlinea alla volta finché cloudLines non dice che ci sta tutto */
  R.cloudFit = (w, text, forma) => {
    let h = 56;
    while (!R.cloudLines(w, h, text, forma).fits && h < 4000) h += CLOUD_LH;
    return h;
  };
  /** Dove va scritto il testo dentro la forma: il triangolo lo tiene più in basso, dove c'è posto. */
  R.shapeCenter = (forma) => (CENTRO[forma] != null ? CENTRO[forma] : 0.5);
  R.children = (id, map) => map.elements.filter(e => e.props && (e.props.lockTo === id || (e.type === 'delta' && e.props.attachedTo === id)));
  /** Il blocco 🔒 vince sulla catena ⛓ (esito stazione 1, 25/8): un figlio legato E bloccato non
   *  deve muoversi quando si sposta il suo genitore. La posizione di un legato è DERIVATA
   *  (ancora del genitore + dx/dy), quindi qui si compensa: per ogni elemento bloccato-e-legato la
   *  cui posizione vista non combacia più con la foto `pos0` (scattata a inizio drag), dx/dy si
   *  correggono dell'esatto scarto. Nessuna analisi delle dipendenze: se elPos è cambiata, il
   *  genitore (o un antenato, o la freccia a cui è agganciato) si è mosso — vale anche per le
   *  catene profonde e per i delta sulle frecce. Ritorna i cambiamenti per l'undo del drag. */
  R.freezePinned = (map, pos0) => {
    const changed = [];
    map.elements.forEach(el => {
      if (!el.props || !el.props.pinned) return;
      if (!(el.props.lockTo || (el.type === 'delta' && el.props.attachedTo))) return;
      const p0 = pos0[el.id]; if (!p0) return;
      const cur = R.elPos(el, map);
      if (cur.x === p0.x && cur.y === p0.y) return;
      el.props.dx = (el.props.dx || 0) + (p0.x - cur.x);
      el.props.dy = (el.props.dy || 0) + (p0.y - cur.y);
      changed.push({ id: el.id, dx: el.props.dx, dy: el.props.dy });
    });
    return changed;
  };

  /** Area sensibile: molti elementi sono disegnati a sole linee (l'omino ha tratti da 1.6 px su un
   *  riquadro di 40x78) e col dito diventano quasi impossibili da prendere — collegarne uno richiedeva
   *  piu' tentativi. Un rettangolo trasparente da' a ognuno un bersaglio pieno, un po' piu' grande del
   *  disegno. La corsia e' esclusa: e' gia' una fascia piena e coprirebbe tutto cio' che contiene. */
  const HIT_PAD = 3; // stretto: ogni pixel in piu' e' spazio rubato al lazo, alla matita e alle frecce sottostanti
  const hitRect = (el) => {
    if (el.type === 'lane') return '';
    const z = R.elSize(el);
    const extra = el.type === 'person' ? 30 : 0; // l'omino ha nome e ruolo scritti sotto la figura
    return `<rect class="el-hit" x="${-HIT_PAD}" y="${-HIT_PAD}" width="${z.w + HIT_PAD * 2}" height="${z.h + HIT_PAD * 2 + extra}"/>`;
  };
  R.hitRect = hitRect;

  R.elements = (map) => {
    const zOrder = { lane: 0, legend: 1, text: 2, box: 3, inventory: 3, inbox: 3, distance: 3, person: 3, delta: 4, icon: 4, face: 4, storm: 5, fluffy: 5, burst: 5 };
    const els = map.elements.filter(e => !V.isConnector(e)).slice().sort((a, b) => (zOrder[a.type] || 3) - (zOrder[b.type] || 3) || (a.z || 0) - (b.z || 0));
    let lanes = '', body = '';
    els.forEach(el => { const pos = R.elPos(el, map); const g = `<g class="el el-${el.type}" data-id="${esc(el.id)}" data-type="${el.type}" transform="translate(${pos.x} ${pos.y})">${hitRect(el)}${drawEl(el, map)}</g>`; if (el.type === 'lane') lanes += g; else body += g; });
    L.lanes.innerHTML = lanes; L.el.innerHTML = body;
    L.conn.innerHTML = map.elements.filter(V.isConnector).map(c => `<g class="conn" data-id="${esc(c.id)}" data-type="${c.type}">${drawConn(c, map)}</g>`).join('');
    R.handles(map);
  };
  const updHandle = (c, map) => { if (c.type !== 'request') return; const g = L.hand.querySelector(`[data-chan-handle="${c.id}"]`); if (g) g.outerHTML = chanHandleSVG(c, map); else L.hand.insertAdjacentHTML('beforeend', chanHandleSVG(c, map)); };
  /** aggiorna solo un elemento (e i connettori/delta legati) — usato durante il trascinamento.
   *  `seen` tiene il conto di chi e' gia' stato ridisegnato in questa passata: due elementi legati
   *  l'uno all'altro (un anello che un file importato o una patch possono introdurre) facevano
   *  richiamare il disegno all'infinito, e il trascinamento moriva con lo stack pieno. */
  R.updateEl = (id, map, isChild = false, seen, opts) => {
    const el = V.index(map).byId.get(id); if (!el) return;
    seen = seen || new Set();
    if (seen.has(id)) return;
    seen.add(id);
    if (V.isConnector(el)) { const g = L.conn.querySelector(`[data-id="${id}"]`); if (g) g.innerHTML = drawConn(el, map); updHandle(el, map); if (!isChild) R.children(el.id, map).forEach(d => R.updateEl(d.id, map, true, seen, opts)); return; }
    const g = (el.type === 'lane' ? L.lanes : L.el).querySelector(`[data-id="${id}"]`); const pos = R.elPos(el, map);
    if (g) {
      g.setAttribute('transform', `translate(${pos.x} ${pos.y})`);
      // Mentre si trascina, dentro il gruppo non cambia niente: il disegno e' relativo alla sua origine
      // e basta spostare il gruppo. Ricostruirlo a ogni movimento del dito — per l'elemento e per ogni
      // figlio legato — era il lavoro che faceva scattare il trascinamento su iPad.
      if (!(opts && opts.soloPosizione)) g.innerHTML = hitRect(el) + drawEl(el, map);
    }
    // connettori toccati (e i loro figli agganciati/bloccati): questi si ridisegnano comunque, il loro
    // percorso dipende da dove stanno adesso i capi
    map.elements.filter(c => V.isConnector(c) && (c.from.el === id || c.to.el === id)).forEach(c => { if (seen.has(c.id)) return; seen.add(c.id); const cg = L.conn.querySelector(`[data-id="${c.id}"]`); if (cg) cg.innerHTML = drawConn(c, map); updHandle(c, map); R.children(c.id, map).forEach(d => R.updateEl(d.id, map, true, seen, opts)); });
    // figli bloccati a questo elemento
    R.children(id, map).forEach(ch => R.updateEl(ch.id, map, true, seen, opts));
  };

  // ---------- inchiostro ----------
  R.strokePath = (s) => { const pts = s.points; if (!pts.length) return ''; if (pts.length < 3) return `M${pts[0][0]} ${pts[0][1]} L${(pts[pts.length - 1][0])} ${(pts[pts.length - 1][1])}`; let d = `M${pts[0][0]} ${pts[0][1]}`; for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; d += ` Q${pts[i][0]} ${pts[i][1]} ${mx.toFixed(1)} ${my.toFixed(1)}`; } const l = pts[pts.length - 1]; d += ` L${l[0]} ${l[1]}`; return d; };
  R.strokes = (map) => { L.ink.innerHTML = map.strokes.map(s => `<path class="stroke" data-sid="${esc(s.id)}" d="${R.strokePath(s)}" stroke="${esc(s.color)}" stroke-width="${esc(s.width)}"/>`).join(''); };
  R.addStrokeEl = (s) => { const p = document.createElementNS(NS, 'path'); p.setAttribute('class', 'stroke'); p.dataset.sid = s.id; p.setAttribute('stroke', s.color); p.setAttribute('stroke-width', s.width); p.setAttribute('d', R.strokePath(s)); L.ink.appendChild(p); return p; };

  // ---------- overlay calcolato: timeline + riepilogo ----------
  /** Il riepilogo di sempre (timeline + card dei percorsi, R6): oggi e' il primo livello (spec B/C),
   *  sempre acceso. Estratto dal vecchio R.overlay SENZA cambiare un byte dell'HTML prodotto (la
   *  fixture test/fixtures/riepilogo-baseline.txt lo prova), con una sola eccezione dichiarata: i
   *  due punti che leggevano V.metrics(map) e V.flowPaths(map) in diretta ora leggono
   *  V.analysis.pathTotals(map, ix), che restituisce ESATTAMENTE quei due oggetti — stessi byte in
   *  uscita, ma con la memo per rev che lavora (spec E). Ritorna { svg, extent }: extent e' il
   *  rettangolo della card, per R.contentBox (il taglio del riepilogo, rapporto dom R1). */
  R.riepilogoSVG = (map) => {
    const ix = V.index(map);
    const { metrics: M, paths: P } = V.analysis.pathTotals(map, ix);
    const { w, h } = V.paperOf(map); let g = '';
    // anche la timeline usa le posizioni VISTE: un box bloccato che segue il genitore porta con se' il suo gradino
    const fo = V.flowOrder(map); const order = fo.order.map(b => Object.assign({}, b, R.elPos(b, map)));
    let loY = null, contentRight = null;
    if (order.length && M.hasData) {
      // con più percorsi alternativi servono più corsie: la timeline parte più in alto per starci dentro
      const spazioCorsie = Math.max(0, (fo.lanes || 1) - 1) * 46;
      const bottom = Math.max(...order.map(b => b.y + b.h)) + 84; const hiY = Math.min(bottom, h - 140 - spazioCorsie); loY = hiY + 24;
      contentRight = Math.max(...order.map(b => b.x + b.w));
      let path = '', labels = '';
      // ogni percorso alternativo ha la sua corsia, una sotto l'altra: prima i rami paralleli finivano
      // disegnati nello stesso posto e i numeri si leggevano uno sopra l'altro
      const LANE = 46;
      const laneY = (id) => hiY + ((fo.lane && fo.lane.get(id)) || 0) * LANE;
      order.forEach((b) => {
        const y = laneY(b.id), y2 = y + (loY - hiY);
        path += `<path class="va" d="M${b.x} ${y} V${y2} H${b.x + b.w} V${y}"/>`;
        labels += `<text class="hand" x="${b.x + b.w / 2}" y="${y2 + 13}" text-anchor="middle" font-size="10" fill="#3f7d5a">${fmt(num(b.props.avg))}</text>`;
      });
      // Il tratto rosso si disegna per FRECCIA, non fra due gradini vicini nell'elenco: dove il processo
      // si biforca, i due rami finivano uno accanto all'altro e fra loro compariva un'attesa inventata.
      // E ora c'e' anche quando il passo dopo sta sotto o a sinistra: prima spariva dal disegno mentre
      // il riepilogo continuava a contarla, e i due numeri non tornavano.
      const seg = new Map(order.map(b => [b.id, b]));
      fo.segments.forEach(s => {
        const b = seg.get(s.from.id), nb = seg.get(s.to.id); if (!b || !nb) return;
        const ds = map.elements.filter(d => d.type === 'delta' && d.props.attachedTo === s.conn.id);
        const val = ds.length ? ds.map(d => num(d.props.avg)).filter(v => v != null).reduce((a, c) => a + c, 0) : null;
        const x1 = b.x + b.w, x2 = nb.x, y = hiY + (s.lane || 0) * LANE;
        if (x2 > x1) {
          path += `<path class="nva" d="M${x1} ${y} H${x2}"/>`;
          // se il ramo scende in una corsia sua, un gradino la collega alla corsia di partenza
          const yFrom = laneY(b.id); if (yFrom !== y) path += `<path class="nva" d="M${x1} ${yFrom} V${y}"/>`;
          // etichetta dell'attesa solo se il tratto è abbastanza largo: in un varco stretto finirebbe sopra i gradini verdi accanto
          if (x2 - x1 >= 34) labels += `<text class="hand delta-txt" x="${(x1 + x2) / 2}" y="${y - 5}" text-anchor="middle" font-size="10">${val == null ? (ds.length ? '?' : '') : fmt(val)}</text>`;
        } else if (val != null || ds.length) {
          // i due passi non sono in fila: l'attesa si segna come cappio sopra il gradino di partenza,
          // cosi' il tempo resta visibile invece di sparire
          const cx = b.x + b.w;
          path += `<path class="nva" d="M${cx - 12} ${y} q 12 -14 24 0"/>`;
          labels += `<text class="hand delta-txt" x="${cx}" y="${y - 16}" text-anchor="middle" font-size="10">${val == null ? '?' : fmt(val)}</text>`;
        }
      });
      g += path + labels;
      const note = fo.estimated ? ` · ${fo.loose.length} ${fo.loose.length === 1 ? 'passo fuori catena' : 'passi fuori catena'} (collegali con le frecce)` : (fo.flows.length ? '' : ' · ordine stimato (collega i box con le frecce)');
      g += `<text class="hand muted" x="${order[0].x}" y="${hiY - 20}" font-size="10">tempo a valore (verde, sotto) · attese (rosso, sopra) — ${esc(map.unit)}${note}</text>`;
    }
    // il riepilogo segue il contenuto (sotto la timeline, allineato a destra dei box): su un foglio grande,
    // ancorarlo all'angolo della carta lo lascerebbe lontano dalla mappa
    // il riquadro dichiara quello che NON ha contato: prima un delta lasciato sul foglio entrava nel
    // totale senza comparire sulla timeline, e i due artefatti dicevano numeri diversi senza spiegare perche'
    const fuoriParti = [];
    if (M.looseBoxes) fuoriParti.push(`${M.looseBoxes} ${M.looseBoxes === 1 ? 'passo' : 'passi'} fuori catena`);
    if (M.looseDeltas) fuoriParti.push(`${M.looseDeltas} ${M.looseDeltas === 1 ? 'attesa non agganciata' : 'attese non agganciate'}`);
    const fuori = fuoriParti.length ? esc('non contati: ' + fuoriParti.join(' · ')) : '';
    // I PERCORSI: dove il flusso si divide, il totale unico non e' il tempo di nessuno. Si elencano
    // i percorsi con i loro minuti, e in una riga sola la lettura «se i rami vanno insieme» — dove
    // il piu' lento detta il passo e l'altro RESTA FERMO ad aspettarlo (R6, deciso il 2026-08-22).
    const multi = P.paths.length > 1 && M.hasData;
    const righeP = multi ? P.paths.slice(0, 4) : [];
    const nomeP = (x) => { const t = String(x.label || '').trim(); return t.length > 16 ? t.slice(0, 15) + '…' : t; };
    const sw = 270, sh = (M.ftq != null ? 106 : 92) + (multi ? 22 + righeP.length * 16 + (P.together && P.together.waits.length ? 30 : 0) + (P.truncated ? 14 : 0) : 0);
    let sx = w - sw - 30, sy = h - sh - 30;
    if (loY != null) {
      // accanto al contenuto, non sotto: sotto la timeline ci sono spesso note e nuvole che verrebbero coperte
      sx = contentRight + 40; sy = loY - sh;
      if (sx + sw > w - 20) { sx = contentRight - sw; sy = loY + 34; } // non ci sta a destra: torna sotto
    }
    sx = Math.max(20, Math.min(sx, w - sw - 20)); sy = Math.max(20, Math.min(sy, h - sh - 20));
    g += `<g><rect class="box" x="${sx}" y="${sy}" width="${sw}" height="${sh}" rx="2"/>
      <text class="hand" x="${sx + 12}" y="${sy + 20}" font-size="12" font-weight="700">Riepilogo (${esc(map.unit)})${(V.numMisure(map) || +map.samples) ? ` · ${esc(String(V.numMisure(map) || +map.samples))} misure` : ''}</text>
      <text class="hand" x="${sx + 12}" y="${sy + 40}" font-size="11">Totale VA: <tspan font-weight="700">${fmt(M.va)}</tspan>   Totale NVA: <tspan font-weight="700" fill="#c8321e">${fmt(M.nva)}</tspan></text>
      <text class="hand" x="${sx + 12}" y="${sy + 58}" font-size="11">VA %: <tspan font-weight="700">${fmt(M.vaPct)} %</tspan>   NVA %: <tspan font-weight="700" fill="#c8321e">${fmt(M.nvaPct)} %</tspan></text>
      ${M.ftq != null ? `<text class="hand" x="${sx + 12}" y="${sy + 76}" font-size="11">First Time Quality: <tspan font-weight="700">${fmt(M.ftq)} %</tspan>${M.ftqPartial ? '<tspan class="muted" font-size="10"> · parziale</tspan>' : ''}</text>` : ''}
      <text class="hand muted" x="${sx + 12}" y="${sy + (M.ftq != null ? 94 : 78)}" font-size="10">${fuori || (multi ? (P.truncated ? `oltre ${V.MAX_PERCORSI} percorsi: i totali sono parziali` : 'i totali qui sopra sommano tutti i rami') : (M.hasData ? 'value quotient = VA / (VA + NVA)' : 'aggiungi Hi/Lo/Avg ai box e ai delta'))}</text>
      ${multi ? (() => {
        let y = sy + (M.ftq != null ? 94 : 78) + 20;
        let t = `<line x1="${sx + 12}" y1="${y - 12}" x2="${sx + sw - 12}" y2="${y - 12}" stroke="#d9d4c8"/>`
          + `<text class="hand" x="${sx + 12}" y="${y}" font-size="10.5">${P.common.boxes.length ? `In comune: <tspan font-weight="700">${fmt(P.common.va)}</tspan> a valore` : `${P.count} percorsi diversi`}</text>`;
        righeP.forEach((x) => {
          y += 16;
          t += `<text class="hand" x="${sx + 12}" y="${y}" font-size="10.5">via ${esc(nomeP(x))}</text>`
            + `<text class="hand" x="${sx + sw - 12}" y="${y}" font-size="10.5" text-anchor="end"><tspan font-weight="700">${fmt(x.tot)}</tspan>${x.vaPct != null ? ` · VA ${Math.round(x.vaPct)} %` : ''}</text>`;
        });
        if (P.truncated) { y += 14; t += `<text class="hand muted" x="${sx + 12}" y="${y}" font-size="9.5">…e altri: ${P.count} percorsi in tutto</text>`; }
        if (P.together && P.together.waits.length) {
          y += 18;
          const a = P.together.waits[0];
          t += `<text class="hand" x="${sx + 12}" y="${y}" font-size="10" fill="#c8321e">Se vanno insieme: ${fmt(P.together.tot)} in tutto,</text>`
            + `<text class="hand" x="${sx + 12}" y="${y + 12}" font-size="10" fill="#c8321e">e «${esc(nomeP(a))}» aspetta ${fmt(a.sec)}${P.together.waits.length > 1 ? ' (e non solo lui)' : ''}</text>`;
        }
        return t;
      })() : ''}</g>`;
    return { svg: g, extent: { x: sx, y: sy, w: sw, h: sh } };
  };

  /** posizione del badge di un elemento: quella VISTA (R.elPos), non x/y grezzi — un elemento legato
   *  (lockTo/attachedTo) si disegna altrove (rilievo della revisione). Funzione condivisa fra il
   *  disegno del badge e R.contentBox: non possono divergere perche' sono la STESSA chiamata. */
  R.badgeRect = (el, map) => { const p = R.elPos(el, map); return { x: p.x, y: p.y - 14, w: 0, h: 0 }; };
  /** larghezza del fondino del badge dal suo testo: UN posto solo — la usano il disegno
   *  (R.badgeSVG) e il ritaglio (R.badgeExtent → R.contentBox), che non possono divergere. */
  const badgeWidth = (text) => Math.max(28, String(text || '').length * 5.4 + 14);
  /** l'INGOMBRO vero del badge (obbligo F1 del ledger): badgeRect e' l'ancora (un punto, centro
   *  del fondino), qui c'e' il rettangolo disegnato davvero — senza, R.contentBox cresceva solo
   *  col punto e un badge con testo lungo usciva dal crop di anteprima/export (il margine di 48
   *  copriva solo i fondini corti). */
  R.badgeExtent = (el, map, b) => {
    const r = R.badgeRect(el, map);
    const bw = badgeWidth(b && b.text);
    return { x: r.x - bw / 2, y: r.y - 9, w: bw, h: 18 };
  };
  const BADGE_TONE = { alert: '#c8321e', warn: '#b98900', ok: '#3f7d5a' };
  /** disegno generico di un badge (spec C): <g class="badge" data-el data-layer>, pointer-events
   *  auto in linea (L.overlay li ha spenti: solo chi deve toccarsi li riaccende) — il tocco lo
   *  gestisce interact.js aprendo il pop-up del passo sulla sezione del livello. */
  R.badgeSVG = (l, el, b, map) => {
    const r = R.badgeRect(el, map);
    const txt = String((b && b.text) || '');
    const bw = badgeWidth(txt);
    const col = BADGE_TONE[b && b.tone] || '#1f4e79';
    return `<g class="badge" data-el="${esc(el.id)}" data-layer="${esc(l.id)}" style="pointer-events:auto;cursor:pointer" transform="translate(${r.x} ${r.y})">`
      + `<circle class="badge-hit" cx="0" cy="0" r="20" fill="transparent"/>`
      + `<rect x="${(-bw / 2).toFixed(1)}" y="-9" width="${bw.toFixed(1)}" height="18" rx="9" fill="${col}"/>`
      + `<text class="hand" x="0" y="3.5" text-anchor="middle" font-size="9" fill="#fffdf7">${esc(txt)}</text></g>`;
  };
  /** trova il gruppo gia' disegnato di un livello dentro L.layersG, senza tenerne un riferimento in
   *  cache (che sopravviverebbe a un cambio di svg — vedi la nota su layerKeys): un attributo
   *  letto ogni volta, su una manciata di nodi, costa nulla e non puo' mai puntare altrove. */
  const attrData = (el, name) => (el.attrs ? el.attrs[name] : (el.getAttribute && el.getAttribute(name)));
  const trovaGruppoLivello = (id) => Array.from(L.layersG.children).find(g => attrData(g, 'data-layer') === id);
  /** Disegna i livelli accesi e ammessi dalla fase (V.layers.active, spec B): un <g data-layer> per
   *  livello, ridisegnato SOLO se la sua chiave e' cambiata — niente innerHTML totale dell'overlay
   *  (spec C). opts.drag/opts.dragN: durante un trascinamento, solo il riepilogo prende una chiave
   *  nuova a ogni fotogramma (R.overlaySoon); gli altri livelli, la cui chiave dipende solo da
   *  map.id + map.rev, restano fermi — 0 ridisegni per loro durante il drag. */
  R.overlay = (map, opts = {}) => {
    if (!map) return;
    const ix = V.index(map);
    const attivi = V.layers.active(map);
    const attiviIds = new Set(attivi.map(l => l.id));
    // livelli spenti (o non piu' ammessi dalla fase): il gruppo si svuota, non resta disegnato
    Array.from(L.layersG.children).forEach(g => {
      const id = attrData(g, 'data-layer');
      if (id && !attiviIds.has(id)) { g.innerHTML = ''; layerKeys.delete(id); }
    });
    const chiaveDi = (l) => l.id + ':' + map.id + ':' + (map.rev | 0)
      + (opts.drag && l.id === 'riepilogo' ? ':drag:' + (opts.dragN || 0) : '');
    attivi.forEach(l => {
      const key = chiaveDi(l);
      if (layerKeys.get(l.id) === key) return;             // niente da ridisegnare
      let g = trovaGruppoLivello(l.id);
      if (!g) { g = document.createElementNS(NS, 'g'); g.setAttribute('data-layer', l.id); L.layersG.appendChild(g); }
      R._draws[l.id] = (R._draws[l.id] || 0) + 1;
      // Un livello e' registrato da un modulo terzo (F1-F10, dopo la fase 0): un badge o un overlay
      // che lancia non deve spegnere TUTTO il disegno (rilievo confermato della revisione avversaria
      // del Task 7, round 1, eseguendo — prima un badge rotto interrompeva R.overlay/R.contentBox/
      // exportSVG dell'intero foglio). Il livello guasto salta il suo giro e lo dice in console; gli
      // altri livelli, e il resto del disegno, restano in piedi.
      let body = '', guasto = false;
      try { body = l.overlay ? (l.overlay(map, ix) || '') : ''; }
      catch (e) { console.warn('livello "' + l.id + '": overlay() ha lanciato', e); guasto = true; }
      if (l.badge) map.elements.forEach(el => {
        if (V.isConnector(el)) return;
        let b; try { b = l.badge(el, map, ix); } catch (e) { console.warn('livello "' + l.id + '": badge() ha lanciato', e); guasto = true; return; }
        if (b) body += R.badgeSVG(l, el, b, map);
      });
      g.innerHTML = body;
      // La chiave si segna "fatta" SOLO se il livello non ha lanciato (round 2 della revisione
      // avversariale, Task 7: il round 1 marcava la chiave PRIMA di provare a disegnare — un
      // livello guasto veniva segnato "gia' fatto" anche dopo un fallimento, e restava vuoto in
      // silenzio finche' map.rev non cambiava, esattamente il difetto che il try/catch doveva
      // chiudere). Un livello guasto ora ci riprova a ogni chiamata, anche alla stessa rev: se
      // guarisce (uno stato esterno cambia, non il documento), il gruppo si riempie subito.
      if (!guasto) layerKeys.set(l.id, key);
    });
  };

  /** ridisegno del riepilogo al prossimo fotogramma: durante un trascinamento arrivano decine di
   *  movimenti al secondo, e rifare l'overlay a ognuno sarebbe lavoro buttato. Il riepilogo continua
   *  a seguire il passo (scelta di progetto): la chiave del SOLO gruppo riepilogo cambia a ogni
   *  fotogramma (rev + ':drag:' + dragN), gli altri livelli restano alla loro chiave. */
  let overlayFrame = null, dragN = 0;
  const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (fn) => { fn(); return 0; };
  R.overlaySoon = (map) => {
    if (overlayFrame) return;
    overlayFrame = raf(() => { overlayFrame = null; const m = map || V.map(); if (m) R.overlay(m, { drag: true, dragN: ++dragN }); });
  };

  // ---------- selezione / ui temporanea ----------
  // due segni distinti: la CATENA lega due elementi (si muovono insieme), il LUCCHETTO inchioda
  // un elemento al foglio (non si sposta trascinandolo). Stessa distinzione nelle azioni rapide.
  const lockGlyph = (x, y, sc = 1) => `<g transform="translate(${x} ${y}) scale(${sc})"><rect x="0" y="4" width="10" height="8" rx="1.5" fill="#1f4e79"/><path d="M2 4V3a3 3 0 016 0v1" fill="none" stroke="#1f4e79" stroke-width="1.5"/></g>`;
  R.lockGlyph = lockGlyph;
  const chainGlyph = (x, y, sc = 1) => `<g transform="translate(${x} ${y}) scale(${sc})" fill="none" stroke="#1f4e79" stroke-width="1.5" stroke-linecap="round"><path d="M4.6 7.4l2.8-2.8"/><path d="M4.2 5.2L2.9 6.5a2.1 2.1 0 103 3l1.3-1.3"/><path d="M7.8 6.8l1.3-1.3a2.1 2.1 0 10-3-3L4.8 3.8"/></g>`;
  R.chainGlyph = chainGlyph;
  /** punto di riferimento di un elemento per le linee di blocco: centro (o punto a lockT/mid sulle frecce) */
  const refPt = (el, map, t) => { if (V.isConnector(el)) { const P = R.connPath(el, map); return P.bez(t == null ? 0.5 : t); } const p = R.elPos(el, map); return { x: p.x + el.w / 2, y: p.y + el.h / 2 }; };
  /** legami di blocco visibili: figlio selezionato → linea al genitore; genitore selezionato → anelli sui figli */
  R.lockLinks = (ids, map) => {
    let s = ''; const shown = new Set();
    ids.forEach(id => {
      const el = V.byId(id, map); if (!el) return;
      const parId = el.props && (el.props.lockTo || (el.type === 'delta' && el.props.attachedTo)); const par = parId ? V.byId(parId, map) : null;
      if (par && !ids.includes(par.id)) { const a = refPt(el, map), b = refPt(par, map, el.props.lockT); s += `<line class="lock-link" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`; if (V.isConnector(par)) { const P = R.connPath(par, map); s += `<path class="lock-parent" d="${P.d}"/>`; } else { const pp = R.elPos(par, map); s += `<rect class="lock-parent" x="${pp.x - 3}" y="${pp.y - 3}" width="${par.w + 6}" height="${par.h + 6}" rx="4"/>`; } s += chainGlyph((a.x + b.x) / 2 - 6, (a.y + b.y) / 2 - 10, 1.1); }
      const kids = R.children(el.id, map).filter(k => !ids.includes(k.id));
      kids.forEach(k => { if (shown.has(k.id)) return; shown.add(k.id); const kp = R.elPos(k, map); s += `<rect class="lock-child" x="${kp.x - 3}" y="${kp.y - 3}" width="${k.w + 6}" height="${k.h + 6}" rx="4"/>`; });
      if (kids.length) { const a = refPt(el, map); const bx = V.isConnector(el) ? a.x - 12 : R.elPos(el, map).x - 6, by = V.isConnector(el) ? a.y - 30 : R.elPos(el, map).y - 24; s += `<g class="lock-count"><rect x="${bx}" y="${by}" width="${kids.length > 9 ? 36 : 30}" height="16" rx="8"/>${chainGlyph(bx + 4, by + 2, 1)}<text x="${bx + 24}" y="${by + 12}" text-anchor="middle">${kids.length}</text></g>`; }
    });
    return s;
  };
  /** Dove va a finire quello che si è selezionato: le frecce che partono di lì e i passi che toccano,
      seguendo prima le vie di richiesta e poi il flusso. Serve a rispondere, con un tocco, alla domanda
      "questa richiesta dove finisce?" quando le vie nella fascia alta sono tante. */
  R.traceFrom = (ids, map) => {
    const conns = new Set(), els = new Set();
    const out = (elId, type) => map.elements.filter(e => e.type === type && e.from.el === elId && e.to.el);
    const walk = (elId, depth) => {
      if (depth > 24) return;
      ['request', 'flow'].forEach(t => out(elId, t).forEach(c => {
        if (conns.has(c.id)) return;
        conns.add(c.id); els.add(c.to.el); walk(c.to.el, depth + 1);
      }));
    };
    ids.forEach(id => {
      const el = V.byId(id, map); if (!el) return;
      if (V.isConnector(el)) { conns.add(el.id); if (el.to.el) { els.add(el.to.el); walk(el.to.el, 0); } }
      else walk(id, 0);
    });
    map.elements.forEach(e => { if (e.type === 'delta' && conns.has(e.props.attachedTo)) els.add(e.id); }); // le attese stanno sulla catena
    ids.forEach(id => els.delete(id));
    return { conns: Array.from(conns), els: Array.from(els) };
  };
  R.traceOn = true;
  const traceSVG = (ids, map) => {
    if (!R.traceOn || ids.length !== 1) return '';
    const T = R.traceFrom(ids, map); if (!T.conns.length) return '';
    let s = '';
    T.conns.forEach(id => { const c = V.byId(id, map); if (c) s += `<path class="trace-line" d="${R.connPath(c, map).d}"/>`; });
    T.els.forEach(id => { const e = V.byId(id, map); if (!e) return; const p = R.elPos(e, map), z = R.elSize(e); s += `<rect class="trace-el" x="${p.x - 5}" y="${p.y - 5}" width="${z.w + 10}" height="${z.h + 10}" rx="5"/>`; });
    return s;
  };
  R.selection = (ids, map) => {
    let s = traceSVG(ids, map) + R.lockLinks(ids, map);
    ids.forEach(id => {
      const el = V.byId(id, map); if (!el) return;
      if (V.isConnector(el)) { const P = R.connPath(el, map); s += `<path class="sel-ring" d="${P.d}"/>`; if (ids.length === 1) { s += `<circle class="end-hit" data-endhandle="from" data-conn="${id}" cx="${P.a.x}" cy="${P.a.y}" r="18" fill="transparent"/><circle class="end-hit" data-endhandle="to" data-conn="${id}" cx="${P.b.x}" cy="${P.b.y}" r="18" fill="transparent"/><circle class="handle end" data-endhandle="from" data-conn="${id}" cx="${P.a.x}" cy="${P.a.y}" r="7"/><circle class="handle end" data-endhandle="to" data-conn="${id}" cx="${P.b.x}" cy="${P.b.y}" r="7"/>`; (el.props.via || []).forEach((v2) => { s += `<circle class="handle via" cx="${v2.x}" cy="${v2.y}" r="5"/>`; }); } return; }
      const pos = R.elPos(el, map); const pad = 6; const sz = R.elSize(el);
      s += `<rect class="sel-ring" x="${pos.x - pad}" y="${pos.y - pad}" width="${sz.w + pad * 2}" height="${sz.h + pad * 2}" rx="4"/>`;
      if (el.props.lockTo || (el.type === 'delta' && el.props.attachedTo)) s += chainGlyph(pos.x - pad - 15, pos.y - pad - 3, 1.15);
      if (el.props.pinned) s += lockGlyph(pos.x + sz.w + pad + 4, pos.y - pad - 2);
      if (ids.length === 1 && !el.props.pinned && ['box', 'lane', 'storm', 'fluffy', 'burst', 'text', 'legend'].includes(el.type)) s += `<circle data-handle="${id}" cx="${pos.x + sz.w + 5}" cy="${pos.y + sz.h + 5}" r="16" fill="transparent" style="cursor:nwse-resize"/><rect class="handle" data-handle="${id}" x="${pos.x + sz.w - 1}" y="${pos.y + sz.h - 1}" width="12" height="12" rx="2"/>`;
    });
    L.ui.innerHTML = s;
  };
  R.ghost = (html) => { L.ui.innerHTML = html; };
  R.flash = (id) => { const g = svg.querySelector(`[data-id="${id}"]`); if (!g) return; g.classList.add('flash'); setTimeout(() => g.classList.remove('flash'), 2600); };

  R.all = (map, opts = {}) => { R.paper(map); R.strokes(map); R.elements(map); R.overlay(map); R.selection(opts.selection || [], map); };

  // ---------- export SVG (solo il foglio) ----------
  /** Il rettangolo che contiene cio' che e' disegnato: elementi (alla posizione e misura VISTE, con
   *  i legati risolti), i punti dei connettori, e per ogni livello ATTIVO i rettangoli dei suoi
   *  badge (R.badgeRect, per ogni elemento con l.badge(el,map,ix) non nullo — cosi' un livello con
   *  badge entra nel crop ANCHE senza un extent) piu' gli extent extra del livello (il riquadro del
   *  riepilogo) — chiude il taglio del riepilogo, rapporto dom R1. Un margine, mai oltre il foglio.
   *  Serve all'anteprima dell'occhio: il foglio e' 2376×1680 e quasi sempre in gran parte vuoto —
   *  col viewBox intero tre passi in un angolo diventano un francobollo illeggibile. */
  R.contentBox = (map, margin = 48) => {
    const { w, h } = V.paperOf(map);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const grow = (x, y) => { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; };
    const growRect = (r) => { if (!r) return; grow(r.x, r.y); grow(r.x + (r.w || 0), r.y + (r.h || 0)); };
    map.elements.forEach(el => {
      if (V.isConnector(el)) { (R.connPath(el, map).pts || []).forEach(q => grow(q.x, q.y)); return; }
      const p = R.elPos(el, map), z = R.elSize(el);
      grow(p.x, p.y); grow(p.x + z.w, p.y + z.h + (el.type === 'person' ? 30 : 0)); // l'omino ha nome e ruolo sotto la figura
    });
    const ix = V.index(map);
    // Stessa guardia di R.overlay (Task 7): un badge/extent che lancia non deve rompere il ritaglio
    // (e quindi l'anteprima dell'occhio ed exportSVG, che lo usa per il crop) di TUTTO il foglio.
    V.layers.active(map).forEach(l => {
      if (l.badge) map.elements.forEach(el => {
        if (V.isConnector(el)) return;
        let b; try { b = l.badge(el, map, ix); } catch (e) { console.warn('livello "' + l.id + '": badge() ha lanciato', e); return; }
        if (b) growRect(R.badgeExtent(el, map, b));   // l'ingombro vero, non il punto (obbligo F1)
      });
      if (l.extent) {
        let ex; try { ex = l.extent(map, ix); } catch (e) { console.warn('livello "' + l.id + '": extent() ha lanciato', e); ex = null; }
        (Array.isArray(ex) ? ex : ex ? [ex] : []).forEach(growRect);
      }
    });
    if (!isFinite(x0) || x1 <= x0 || y1 <= y0) return { x: 0, y: 0, w, h }; // foglio vuoto: si ripiega sul foglio intero
    const x = Math.max(0, x0 - margin), y = Math.max(0, y0 - margin);
    return { x, y, w: Math.min(w, x1 + margin) - x, h: Math.min(h, y1 + margin) - y };
  };
  /** Disegna SEMPRE la mappa PASSATA (mai quella a schermo) su un svg staccato: scambia per un
   *  attimo i riferimenti del modulo, disegna, compone la stringa, e li ripristina nel `finally` —
   *  il foglio aperto non si accorge di niente. E' cosi' anche per l'export dal menu «File e
   *  stampa» (non solo per l'occhio): prima leggeva lo stato a schermo, e un export lanciato su una
   *  mappa diversa da quella aperta avrebbe mostrato il titolo sbagliato (rilievo della revisione).
   *  L'azzeramento di layerKeys in R.init fa si' che il ripristino non lasci chiavi stantie: al
   *  ritorno il primo R.overlay del foglio vero ridisegna, ed e' giusto cosi'. */
  R.exportSVG = (map, opts = {}) => { uiVivo = false; try { return exportSVGvero(map, opts); } finally { uiVivo = true; } };
  const exportSVGvero = (map, opts = {}) => {
    const keepSvg = svg, keepL = L;
    try {
      R.init(document.createElementNS(NS, 'svg'));
      R.paper(map); R.strokes(map); R.elements(map); R.overlay(map);
      const { w, h } = V.paperOf(map);
      // crop: solo per l'anteprima dell'occhio. L'export del menu «File e stampa» resta il foglio
      // intero, perche' e' quello che si stampa.
      const vb = opts.crop ? R.contentBox(map) : { x: 0, y: 0, w, h };
      const vw = Math.round(vb.w), vh = Math.round(vb.h);
      // Le regole del foglio, RINCHIUSE dentro questo svg. Lo <style> di un svg NON e' isolato: quando
      // l'anteprima finisce dentro la pagina (l'occhio, il pannellino «Sbircia»), il suo <style> diventa
      // un foglio di stile del documento come gli altri. Finche' le regole perdevano il prefisso — «svg
      // .ghost» che diventava «.ghost» — spegnevano ogni «.ghost» della pagina: i bottoni «.btn.ghost»,
      // ✕ della scheda dell'occhio compreso, restavano disegnati ma non si potevano piu' toccare
      // (pointer-events: none). Stessa storia per le variabili, dichiarate su «:root».
      // Ora tutto e' agganciato alla classe della radice: dentro l'svg vale, fuori non tocca niente.
      // Nel file esportato funziona uguale, perche' la classe sta proprio sull'svg che si esporta.
      const AMBITO = 'vsm-foglio';
      const css = Array.from(document.styleSheets).flatMap(ss => { try { return Array.from(ss.cssRules); } catch (e) { return []; } }).filter(r => r.selectorText && r.selectorText.startsWith('svg ')).map(r => r.cssText.replace(/^svg /, '.' + AMBITO + ' ')).join('\n');
      const vars = `.${AMBITO}{--paper:#fbf8f0;--pencil:#2b2b2b;--pencil-2:#5a5a5a;--paper-line:#c9c2b0;--delta:#c8321e;--cloud:#5b6472;--sage:#3f7d5a;--sel:#1f4e79;--accent:#1f4e79;--hand:"Chalkboard SE","Marker Felt","Segoe Print","Bradley Hand","Comic Neue","Patrick Hand",cursive}`;
      const defs = svg.querySelector('defs').outerHTML;
      const layers = ['paper', 'lanes', 'ink', 'conn', 'el', 'hand', 'overlay'].map(k => L[k].outerHTML).join('');
      return `<svg xmlns="http://www.w3.org/2000/svg" class="${AMBITO}" viewBox="${Math.round(vb.x)} ${Math.round(vb.y)} ${vw} ${vh}" width="${vw}" height="${vh}"><style>${vars}\n${css}</style>${defs}${layers}</svg>`;
    } finally { svg = keepSvg; L = keepL; }
  };

  /** L'immagine dell'occhio: lo stesso disegno del foglio, ma di UN'ALTRA mappa, ritagliato sul
   *  contenuto (crop): l'anteprima mostra i passi, non il vuoto che li circonda. E' un'immagine
   *  ferma, non un canvas vivo: niente gesti. */
  R.peekSVG = (map) => R.exportSVG(map, { crop: true });

  // ---------- registrazione dei livelli integrati (spec B) ----------
  // Il riepilogo di oggi diventa il primo livello: sempre acceso (phaseMin null), nessun badge/
  // sezione propri (e' una card di foglio, non una nota per elemento — spec E dice che il primo
  // livello VERO con badge/sezione arriva con F1). extent alimenta R.contentBox (il crop del
  // riepilogo, rapporto dom R1): la stessa geometria che R.overlay ha gia' disegnato.
  V.layers.register({
    id: 'riepilogo', label: 'Riepilogo', phaseMin: null,
    overlay: (map) => R.riepilogoSVG(map).svg,
    extent: (map) => { const e = R.riepilogoSVG(map).extent; return e ? [e] : []; }
  });
})(window.VSM);
