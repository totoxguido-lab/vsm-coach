/* VSM Coach v2 — render.js: disegno SVG del foglio (carta, corsie, inchiostro, connettori, elementi, overlay calcolati, selezione). */
(function (V) {
  'use strict';
  const { num, fmt } = V.util;
  const NS = 'http://www.w3.org/2000/svg';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const R = V.render = {};
  let svg, L = {};

  // ---------- aspetto dei collegamenti (deriva dal significato) ----------
  const markerId = (col) => 'arr' + String(col).replace('#', '-');
  /** tutte le tinte che possono comparire su un collegamento: quelle dei canali e quelle ammesse come eccezione */
  R.inkColors = () => Array.from(new Set(Object.values(V.CHANNEL_LOOK).map(l => l.color).concat(V.INK_COLORS.map(c => c.id)).filter(Boolean)));
  /** Come si disegna un collegamento: la via di richiesta prende colore e tratto dal *canale*, la freccia di
      flusso resta a matita e prende il tratto dallo stile (materiale spesso, informazione tratteggiata).
      props.override è l'eccezione dichiarata a mano, per la riunione in cui serve dire "guarda questa". */
  R.connLook = (c) => {
    const p = c.props || {}, ov = p.override || {};
    let stroke = '#2b2b2b', dash = '', width = '';
    if (c.type === 'request') { const k = V.channelLook(p.channel); stroke = k.color; dash = k.dash; }
    else if (p.style === 'info') dash = '6 5';
    else if (p.style === 'material') width = '2.6';
    if (ov.stroke) stroke = ov.stroke;
    if (ov.dash) dash = ov.dash === 'none' ? '' : ov.dash;
    if (ov.width) width = ov.width;
    return { stroke, dash, width, custom: !!(ov.stroke || ov.dash || ov.width), marker: markerId(stroke) };
  };
  /** attributi SVG del tratto (usati dal foglio e dalla legenda, così il campione è davvero lo stesso segno) */
  R.connAttrs = (c) => { const k = R.connLook(c); return `stroke="${k.stroke}"${k.dash ? ` stroke-dasharray="${k.dash}"` : ''}${k.width ? ` stroke-width="${k.width}"` : ''} marker-end="url(#${k.marker})"`; };

  R.init = (svgEl) => {
    svg = svgEl; svg.innerHTML = '';
    const defs = document.createElementNS(NS, 'defs');
    // una punta per ogni tinta in uso: la punta nera su una linea colorata si legge come un errore di stampa
    defs.innerHTML = `<marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#2b2b2b"/></marker>
      <marker id="arr-sel" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#1f4e79"/></marker>`
      + R.inkColors().map(col => `<marker id="${markerId(col)}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="${col}"/></marker>`).join('');
    svg.appendChild(defs);
    ['paper', 'lanes', 'ink', 'conn', 'el', 'hand', 'overlay', 'ui'].forEach(k => { const g = document.createElementNS(NS, 'g'); g.id = 'L-' + k; svg.appendChild(g); L[k] = g; });
    L.ink.setAttribute('pointer-events', 'none');
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
  const cut = (s, max) => { s = String(s || ''); return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s; };
  R.wrap = wrap; R.fitLines = fitLines;
  /** righe di un elemento testo (a capo sulla larghezza scelta) */
  R.textLines = (el) => { const p = el.props, sz = p.size || 12; return wrap(p.text || '', Math.max(6, Math.floor(el.w / (sz * 0.5)))); };
  /** misura da usare per selezione e maniglie: per il testo l'altezza vera è quella delle righe, non quella memorizzata */
  R.elSize = (el) => {
    if (el.type !== 'text') return { w: el.w, h: el.h };
    const sz = el.props.size || 12; const need = Math.round(R.textLines(el).length * sz * 1.25 + 4);
    return { w: el.w, h: Math.max(el.h, need) };
  };
  const fmtDate = (iso) => { if (!iso) return ''; const d = new Date(iso + 'T00:00:00'); return isNaN(d) ? iso : new Intl.DateTimeFormat('it-CH', { day: 'numeric', month: 'long', year: 'numeric' }).format(d); };
  const cloudPath = (w, h) => { // nuvola che riempie w×h
    const r = h / 2.6; return `M${r * 0.9} ${h - 6} H${w - r * 0.9} a${r} ${r} 0 0 0 ${r * 0.55} -${r * 1.6} a${r * 1.1} ${r * 1.1} 0 0 0 -${r * 1.4} -${r * 1.1} a${r * 1.3} ${r * 1.3} 0 0 0 -${Math.max(8, w - 2 * r * 2.6)} 0 a${r * 1.1} ${r * 1.1} 0 0 0 -${r * 1.5} ${r * 1.1} a${r} ${r} 0 0 0 ${r * 0.5} ${r * 1.6} z`; };
  const burstPath = (w, h) => { const cx = w / 2, cy = h / 2, n = 12; let d = ''; for (let i = 0; i < n * 2; i++) { const a = Math.PI * i / n - Math.PI / 2; const rx = (i % 2 ? 0.7 : 1) * cx, ry = (i % 2 ? 0.7 : 1) * cy; d += (i ? 'L' : 'M') + (cx + rx * Math.cos(a)).toFixed(1) + ' ' + (cy + ry * Math.sin(a)).toFixed(1) + ' '; } return d + 'z'; };

  // ---------- carta + titolo ----------
  R.paper = (map) => {
    const { w, h } = V.paperOf(map);
    let g = `<rect class="paper" x="0" y="0" width="${w}" height="${h}" rx="2"/>`;
    g += `<line class="fold" x1="${w / 2}" y1="0" x2="${w / 2}" y2="${h}"/><line class="fold" x1="${w * 0.75}" y1="0" x2="${w * 0.75}" y2="${h}"/>`;
    const tx = w - 30; const kind = map.kind === 'future' ? ' — stato futuro' : map.kind === 'detail' ? ' — dettaglio' : '';
    g += `<g class="titleblock" data-title="1" style="cursor:text"><rect x="${w - 470}" y="14" width="450" height="76" fill="transparent"/>
      <text class="hand" x="${tx}" y="42" text-anchor="end" font-size="20" font-weight="700">${esc(cut(map.title || 'Titolo della mappa', 44))}${kind}</text>
      <text class="hand" x="${tx}" y="62" text-anchor="end" font-size="12">Data: ${esc(fmtDate(map.date))}${map.unitName ? '   ·   ' + esc(map.unitName) : ''}</text>
      <text class="hand" x="${tx}" y="78" text-anchor="end" font-size="12">Di: ${esc(map.authors || '—')}${map.validation.validatedBy && map.kind === 'current' ? '   ·   validata da ' + esc(map.validation.validatedBy) : ''}</text></g>`;
    if (map.kind === 'current' && !map.validation.walked && map.elements.some(e => e.type === 'box')) g += `<text class="hand" x="${w - 30}" y="96" text-anchor="end" font-size="11" fill="#b7791f">provvisoria: processo non ancora camminato</text>`;
    if (map.scope) g += `<text class="hand muted" x="30" y="${h - 14}" font-size="10">${esc('Scopo: ' + map.scope.slice(0, 150))}</text>`;
    L.paper.innerHTML = g;
  };

  // ---------- elementi ----------
  function drawEl(el) {
    const p = el.props; const w = el.w, h = el.h; let s = '';
    switch (el.type) {
      case 'box': {
        s += `<rect class="box" x="0" y="0" width="${w}" height="${h}" rx="2"/>`;
        s += `<text class="hand" x="${w / 2}" y="18" text-anchor="middle" font-size="13" font-weight="700">${tspans(fitLines(wrap(p.title || 'Passo', Math.max(8, Math.floor(w / 8))), 2), w / 2, 18, 15)}</text>`;
        s += `<line class="pencil-thin" x1="8" y1="42" x2="${w - 8}" y2="42"/>`;
        const lines = []; (p.activities || []).forEach(a => fitLines(wrap('• ' + a, Math.max(10, Math.floor(w / 5.6))), 2).forEach(l => lines.push(l)));
        const roomForOwner = p.owner ? 12 : 0; // l'etichetta del responsabile sta in basso a destra: non farci finire sopra l'ultima riga
        s += `<text class="hand" x="8" y="58" font-size="10">${tspans(fitLines(lines, Math.max(1, Math.floor((h - 60 - roomForOwner) / 12))), 8, 58, 12)}</text>`;
        if (p.owner) s += `<text class="hand muted" x="${w - 6}" y="${h - 6}" text-anchor="end" font-size="9">${esc(p.owner)}</text>`;
        const hasData = p.hi !== '' || p.lo !== '' || p.avg !== '';
        s += `<text class="hand ${hasData ? '' : 'muted'}" x="${w / 2}" y="${h + 14}" text-anchor="middle" font-size="10">${hasData ? tspans(['Hi: ' + fmt(num(p.hi)), 'Lo: ' + fmt(num(p.lo)), 'Avg: ' + fmt(num(p.avg))], w / 2, h + 14, 12) : `<tspan x="${w / 2}" y="${h + 14}">Hi / Lo / Avg ?</tspan>`}</text>`;
        if (p.cc !== '' && p.cc != null) s += `<text class="hand" x="${w / 2}" y="${h + 52}" text-anchor="middle" font-size="9">C&amp;C ${esc(p.cc)} %</text>`;
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
        s += `<text class="hand delta-txt" x="${w / 2}" y="${dy}" text-anchor="middle" font-size="10" ${hasData ? '' : 'opacity=".55"'}>${hasData ? tspans(['Hi: ' + fmt(num(p.hi)), 'Lo: ' + fmt(num(p.lo)), 'Avg: ' + fmt(num(p.avg))], w / 2, dy, 12) : `<tspan x="${w / 2}" y="${dy}">attesa ?</tspan>`}</text>`;
        break;
      }
      case 'person': {
        const cx = w / 2;
        s += `<g class="pencil">${R.face(p.mood, cx, 9, 9)}<path d="M${cx} 18 V44 M${cx - 14} 28 H${cx + 14} M${cx} 44 L${cx - 12} 66 M${cx} 44 L${cx + 12} 66"/></g>`;
        s += `<text class="hand" x="${cx}" y="${h + 4}" text-anchor="middle" font-size="11" ${p.requestor ? 'font-weight="700"' : ''}>${tspans(fitLines(wrap(p.label || (p.requestor ? 'richiedente' : 'persona'), 16), 2), cx, h + 4, 12)}</text>`;
        if (p.role) s += `<text class="hand muted" x="${cx}" y="${h + 30}" text-anchor="middle" font-size="9">${esc(p.role)}</text>`;
        break;
      }
      case 'storm': case 'fluffy': {
        const cls = el.type === 'storm' ? 'cloud' : 'fluffy';
        // ridotta a segnale: il problema resta sul foglio ma non occupa spazio; il testo si legge toccandolo
        if (el.type === 'storm' && p.collapsed) {
          s += `<path class="alert" d="M${w / 2} 2 L${w - 2} ${h - 3} H2 z"/>`;
          s += `<path class="alert-mark" d="M${w / 2} ${h * 0.38} V${h * 0.66}"/><circle class="alert-dot" cx="${w / 2}" cy="${h * 0.82}" r="1.5"/>`;
          break;
        }
        s += `<path class="${cls}" d="${cloudPath(w, h)}"/>`;
        const lines = wrap(p.text || (el.type === 'storm' ? 'problema…' : 'idea…'), Math.max(10, Math.floor(w / 5.4))).slice(0, Math.max(1, Math.floor((h - 14) / 11)));
        s += `<text class="hand ${cls}-txt" x="${w / 2}" y="${h / 2 - (lines.length - 1) * 5.5 + 3}" text-anchor="middle" font-size="9.5">${tspans(lines, w / 2, h / 2 - (lines.length - 1) * 5.5 + 3, 11)}</text>`;
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
    if (p.link) s += `<g class="link-badge-g" data-link="${esc(p.link)}"><circle class="link-badge" cx="${w - 2}" cy="2" r="8"/><text class="link-badge-txt" x="${w - 2}" y="5" text-anchor="middle">↗</text></g>`;
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
  const reqEnds = (c, map) => {
    const from = c.from.el ? V.byId(c.from.el, map) : null, to = c.to.el ? V.byId(c.to.el, map) : null;
    // Punti d'arrivo distinti sul bordo alto del passo. L'indice è calcolato fra le vie che arrivano *lì*:
    // props.offset conta le vie dello stesso richiedente, quindi due richiedenti diversi che chiamano lo
    // stesso passo finivano entrambi sullo stesso punto, con i due percorsi sovrapposti.
    const same = c.to.el ? map.elements.filter(e => e.type === 'request' && e.to.el === c.to.el).sort((A, B) => (A.props.offset || 0) - (B.props.offset || 0)) : [];
    const off = Math.max(0, same.indexOf(c)) * 46;
    const a = from ? { x: from.x, y: from.y + (from.type === 'person' ? 26 : from.h / 2) } : { x: c.from.x, y: c.from.y };
    const b = to ? { x: to.x + Math.max(10, to.w / 2 - off), y: to.y } : { x: c.to.x, y: c.to.y };
    return { a, b, off };
  };
  /** Corsie delle vie di richiesta (modalità squadrata).
      La via che arriva più a destra scende per prima: le si dà la corsia più bassa e il tratto d'uscita più corto.
      Così nessuna discesa verticale attraversa la corsia di un'altra via — è da lì che nascono quasi tutti gli incroci. */
  R.reqLanes = (map) => {
    const reqs = map.elements.filter(e => e.type === 'request');
    if (!reqs.length) return { lane: {}, n: 0, y: () => 0, step: 0 };
    const info = reqs.map((c, i) => ({ id: c.id, i, c, e: reqEnds(c, map) }));
    const ord = info.slice().sort((A, B) => B.e.b.x - A.e.b.x || A.i - B.i);
    ord.forEach((r, k) => { r.k = k; });
    // Partenze sfalsate lungo il fianco del richiedente: uscendo tutte dallo stesso punto, i primi tratti
    // restano sovrapposti e tre vie si leggono come una riga sola. Chi va più lontano parte più in alto,
    // così il suo tratto orizzontale non incontra le discese delle vie che si fermano prima.
    const aStart = {}, byFrom = {};
    info.forEach(r => { const key = r.c.from.el || ('#' + r.id); (byFrom[key] = byFrom[key] || []).push(r); });
    Object.values(byFrom).forEach(list => {
      if (list.length === 1) { aStart[list[0].id] = list[0].e.a; return; }
      const el = V.byId(list[0].c.from.el, map);
      const span = Math.max(24, Math.min(56, ((el && el.h) || 78) - 24));
      list.slice().sort((A, B) => B.k - A.k).forEach((r, i) => { aStart[r.id] = { x: r.e.a.x, y: r.e.a.y - span / 2 + span * i / (list.length - 1) }; });
    });
    // Tutte le corsie stanno nella fascia fra il richiedente più basso e il passo più alto: se una corsia
    // finisse sopra un punto di partenza, quella via dovrebbe risalire e taglierebbe le corsie sottostanti.
    const yLow = Math.min(...info.map(r => r.e.b.y)) - 46;           // la corsia più bassa lascia sopra il passo lo spazio della sua etichetta e della nota
    const yTop = Math.max(...info.map(r => aStart[r.id].y)) + 18;    // e la più alta resta sotto le partenze
    const step = Math.max(14, Math.min(52, (yLow - yTop) / Math.max(1, ord.length - 1))); // ~46 px quando c'è spazio: sotto i 44 le etichette si toccano
    const y = (k) => yLow - k * step;
    // Dove ogni via scende verso la propria corsia. Scendendo attraversa le corsie più alte, cioè quelle
    // già collocate: il punto di discesa va tenuto fuori dal tratto orizzontale di quelle, altrimenti nasce
    // un incrocio. Con un solo richiedente basta accorciare l'uscita corsia dopo corsia; con richiedenti a
    // x diverse (uno più a sinistra dell'altro) serve spostare la discesa oltre le corsie che coprono quel punto.
    const lane = {}, xDrop = {}, busy = [];
    for (let k = ord.length - 1; k >= 0; k--) {
      const r = ord[k], a = aStart[r.id], b = r.e.b;
      const dir = b.x <= a.x ? -1 : 1;
      let x = a.x + dir * (26 + k * 16);
      for (let guard = 0; guard < 4; guard++) {
        const bad = busy.filter(s => x >= s.x1 - 3 && x <= s.x2 + 3);
        if (!bad.length) break;
        const right = Math.max(...bad.map(s => s.x2)) + 18, left = Math.min(...bad.map(s => s.x1)) - 18;
        x = Math.abs(right - a.x) <= Math.abs(left - a.x) ? right : left; // il minimo scostamento dal richiedente
      }
      lane[r.id] = k; xDrop[r.id] = x;
      busy.push({ x1: Math.min(x, b.x), x2: Math.max(x, b.x) });
    }
    return { lane, xDrop, aStart, n: ord.length, step, y, ord };
  };
  /** riquadri da non attraversare: gli elementi del foglio, tolti gli estremi del collegamento stesso,
      i delta che stanno sulla freccia per costruzione, le corsie di reparto (sono sfondi) e la legenda. */
  // (gli elementi appesi a un connettore sono esclusi tutti, non solo quelli di questo: la loro posizione
  //  dipende dal percorso di un'altra freccia, e chiederla qui farebbe girare in tondo il calcolo)
  R.obstacles = (map, c) => map.elements.filter(e => !V.isConnector(e) && e.type !== 'lane' && e.type !== 'legend'
    && e.id !== (c.from && c.from.el) && e.id !== (c.to && c.to.el)
    && !(e.type === 'delta' && e.props.attachedTo) && !(e.props.lockTo && V.isConnector(V.byId(e.props.lockTo, map) || { type: 'x' })))
    .map(e => { const p = R.elPos(e, map), s = R.elSize(e); return { x1: p.x, y1: p.y, x2: p.x + s.w, y2: p.y + s.h }; });
  const overlaps = (r, o, m = 0) => r.x2 > o.x1 - m && r.x1 < o.x2 + m && r.y2 > o.y1 - m && r.y1 < o.y2 + m;
  /** un segmento (orizzontale o verticale) che incontra ostacoli li scavalca dal lato più vicino,
      restando squadrato: è il modo in cui si aggira un ingombro senza rinunciare alla leggibilità del gomito. */
  const avoidSeg = (p, q, obs, m) => {
    const horiz = Math.abs(p.y - q.y) < 0.5, vert = Math.abs(p.x - q.x) < 0.5;
    if (!horiz && !vert) return [q];
    const lo = horiz ? Math.min(p.x, q.x) : Math.min(p.y, q.y), hi = horiz ? Math.max(p.x, q.x) : Math.max(p.y, q.y);
    const seg = horiz ? { x1: lo, x2: hi, y1: p.y, y2: p.y } : { x1: p.x, x2: p.x, y1: lo, y2: hi };
    let hits = obs.filter(o => overlaps(seg, o, m));
    if (!hits.length) return [q];
    // Fondi gli ostacoli vicini lungo la marcia in una deviazione sola: scavalcarli uno per uno, tornando
    // ogni volta sulla riga, disegna un serpente — illeggibile anche se non tocca niente.
    const GAP = 70;
    hits = hits.map(o => ({ a1: (horiz ? o.x1 : o.y1) - m, a2: (horiz ? o.x2 : o.y2) + m, b1: (horiz ? o.y1 : o.x1) - m, b2: (horiz ? o.y2 : o.x2) + m }))
      .sort((A, B) => A.a1 - B.a1)
      .reduce((acc, o) => { const last = acc[acc.length - 1]; if (last && o.a1 <= last.a2 + GAP) { last.a2 = Math.max(last.a2, o.a2); last.b1 = Math.min(last.b1, o.b1); last.b2 = Math.max(last.b2, o.b2); } else acc.push(Object.assign({}, o)); return acc; }, []);
    const dir = horiz ? Math.sign(q.x - p.x) : Math.sign(q.y - p.y);
    if (dir < 0) hits.reverse();
    const base = horiz ? p.y : p.x, end = horiz ? q.x : q.y;
    const pnt = (along, across) => horiz ? { x: along, y: across } : { x: across, y: along };
    const clamp = (v) => Math.max(Math.min(lo, hi), Math.min(Math.max(lo, hi), v));
    const ahead = (v, w) => dir > 0 ? v > w : v < w;   // "più avanti nella marcia": il percorso non torna mai indietro
    const out = [];
    let cur = horiz ? p.x : p.y;
    hits.forEach(g => {
      const side = Math.abs(g.b1 - base) <= Math.abs(g.b2 - base) ? g.b1 : g.b2;   // si scavalca dal lato più vicino
      const e1 = clamp(dir > 0 ? g.a1 : g.a2), e2 = clamp(dir > 0 ? g.a2 : g.a1);
      if (!ahead(e2, cur)) return;                                                  // gruppo già superato
      const enter = ahead(e1, cur) ? e1 : cur;                                      // già dentro: si esce di lato subito
      if (ahead(enter, cur)) out.push(pnt(enter, base));
      out.push(pnt(enter, side), pnt(e2, side));
      if (ahead(end, e2)) out.push(pnt(e2, base));                                  // se l'ostacolo arriva in fondo, si entra di lato
      cur = e2;
    });
    out.push(q);
    return out;
  };
  /** applica l'aggiramento a tutta la spezzata */
  const routeAvoid = (nodes, obs, m = 10) => {
    if (!obs.length) return nodes;
    const out = [nodes[0]];
    for (let i = 1; i < nodes.length; i++) avoidSeg(out[out.length - 1], nodes[i], obs, m).forEach(p => out.push(p));
    return out;
  };
  /** spazio che serve alla scritta di una via (canale, nota, mani) attorno al punto scelto */
  const labelBox = (q) => ({ x1: q.x - 78, y1: q.y - 20, x2: q.x + 78, y2: q.y + 40 });
  /** punto dove scrivere canale e nota: il primo, andando verso l'arrivo, il cui spazio di scrittura è libero */
  const labelT = (P, obs) => {
    const cands = [0.78, 0.72, 0.84, 0.66, 0.9, 0.6, 0.54, 0.48, 0.42, 0.36, 0.3, 0.24];
    let best = 0.78, bestCost = Infinity;
    for (const t of cands) {
      const r = labelBox(P.at(t));
      let cost = 0;
      obs.forEach(o => { const ix = Math.min(r.x2, o.x2) - Math.max(r.x1, o.x1), iy = Math.min(r.y2, o.y2) - Math.max(r.y1, o.y1); if (ix > 0 && iy > 0) cost += ix * iy; });
      if (!cost) return t;                       // primo posto del tutto libero, andando verso l'arrivo
      if (cost < bestCost) { bestCost = cost; best = t; }
    }
    return best;                                 // foglio affollato: si sceglie il male minore, non un punto fisso
  };

  /** Instrada tutte le vie di richiesta di una mappa in un colpo solo (modalità squadrata).
      Insieme e non una per volta, perché le scelte si condizionano: le corsie, i punti di discesa e perfino
      il posto dove sta scritto il canale vanno decisi guardando anche le altre vie, altrimenti due scritte
      finiscono una sull'altra. Il risultato è messo in cache: connPath viene chiamato molte volte per disegno. */
  let routeCache = { sig: '', val: null }, routing = false;
  const routeSig = (map) => map.id + '|' + V.linkModeOf(map) + '|' + map.elements.map(e => [e.id, e.type, Math.round(e.x), Math.round(e.y), e.w, e.h,
    e.props.lockTo || '', Math.round(e.props.dx || 0), Math.round(e.props.dy || 0), e.props.attachedTo || '', e.props.offset || 0, e.props.t == null ? '' : e.props.t,
    e.from ? (e.from.el || Math.round(e.from.x) + '_' + Math.round(e.from.y)) : '', e.to ? (e.to.el || Math.round(e.to.x) + '_' + Math.round(e.to.y)) : '',
    (e.props.text || '').length, e.props.size || ''].join(',')).join(';');
  R.reqRoutes = (map) => {
    if (routing) return null;                 // richiamata mentre calcola (un elemento appeso a una freccia): si usa il ripiego
    const sig = routeSig(map);
    if (routeCache.sig === sig) return routeCache.val;
    routing = true;
    let val = null;
    try { val = computeRoutes(map); } finally { routing = false; }
    routeCache = { sig, val };
    return val;
  };
  function computeRoutes(map) {
    const L = R.reqLanes(map);
    const routes = {}, taken = [];
    (L.ord || []).forEach((r) => {
      const c = r.c, k = r.k, b = r.e.b;
      const s = L.aStart[c.id] || r.e.a, xExit = L.xDrop[c.id] == null ? s.x - 26 : L.xDrop[c.id];
      const obs = R.obstacles(map, c);
      // Prima di scavalcare, si prova a spostare la corsia in una fascia libera (entro mezzo passo, così
      // l'ordine delle corsie non cambia e non nascono incroci): una riga sola si legge molto meglio di un
      // tratto che scavalca tre nuvole di fila.
      // il margine di aggiramento cresce con la corsia: due vie che scavalcano la stessa nuvola dallo stesso
      // lato, con lo stesso margine, tornerebbero a correre appaiate proprio sopra l'ostacolo
      const mAvoid = 10 + k * 6;
      const x1 = Math.min(xExit, b.x), x2 = Math.max(xExit, b.x);
      const busyAt = (yy) => obs.some(o => overlaps({ x1, x2, y1: yy, y2: yy }, o, mAvoid));
      // verso l'alto ci si sposta al massimo di mezzo passo (oltre si scavalcherebbe la corsia vicina);
      // verso il basso la corsia più bassa può scendere di più, perché sotto di lei non c'è nessuno
      const y0 = Math.min(L.y(k), b.y - 14), limSu = Math.max(12, L.step / 2), limGiu = k === 0 ? 80 : limSu;
      const cands = [0]; for (let d = 4; d <= Math.max(limSu, limGiu); d += 4) { if (d <= limGiu) cands.push(d); if (d <= limSu) cands.push(-d); }
      const yFree = cands.map(d => Math.min(b.y - 14, Math.max(46, y0 + d))).find(yy => !busyAt(yy));
      const yl = yFree == null ? y0 : yFree;
      const nodes = [s, { x: xExit, y: s.y }, { x: xExit, y: yl }, { x: b.x, y: yl }, b];
      // nuvola (o nota) appoggiata proprio sopra il passo di arrivo: la discesa la attraverserebbe e non
      // basta scavalcarla, perché il gomito cadrebbe dentro. Si scende di fianco e si entra nel passo di lato.
      const mb = mAvoid + 2 + k * 5, block = obs.filter(o => b.x > o.x1 - mb && b.x < o.x2 + mb && b.y > o.y1 - mb && yl < o.y2 + mb);
      if (block.length) {
        const xL = Math.min(...block.map(o => o.x1)) - mb, xR = Math.max(...block.map(o => o.x2)) + mb;
        const xd = Math.abs(xL - b.x) <= Math.abs(xR - b.x) ? xL : xR;
        const ye = Math.min(Math.max(...block.map(o => o.y2)) + mAvoid + 2, b.y - 8); // stesso margine dell'aggiramento, se no si rientra dentro la fascia che si stava evitando
        nodes.splice(3, 1, { x: xd, y: yl }, { x: xd, y: ye }, { x: b.x, y: ye });
      }
      const P = mkPoly(routeAvoid(nodes, obs, mAvoid));
      // la scritta schiva gli elementi, i due estremi della via e le scritte delle vie già collocate
      const ends = [c.from.el, c.to.el].map(id => V.byId(id, map)).filter(Boolean)
        .map(e => { const p = R.elPos(e, map), z = R.elSize(e); return { x1: p.x, y1: p.y, x2: p.x + z.w, y2: p.y + z.h }; });
      const tDef = labelT(P, obs.concat(ends, taken));
      taken.push(labelBox(P.at(tDef)));
      routes[c.id] = { nodes: P.pts, tDef };
    });
    return { routes, lane: L.lane, y: L.y, step: L.step, n: L.n };
  }
  /** frazione di lunghezza che cade a `f` del segmento `seg` di una spezzata (per mettere l'etichetta in corsia) */
  const tOnSeg = (pts, seg, f) => {
    let acc = 0, tot = 0, before = 0;
    for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); if (i - 1 < seg) before += d; if (i - 1 === seg) acc = d; tot += d; }
    return tot ? (before + acc * f) / tot : 0.5;
  };
  R.connPath = (c, map) => {
    const mode = V.linkModeOf(map);
    const from = c.from.el ? V.byId(c.from.el, map) : null, to = c.to.el ? V.byId(c.to.el, map) : null;
    const pf = from ? V.center(from) : { x: c.from.x, y: c.from.y }, pt = to ? V.center(to) : { x: c.to.x, y: c.to.y };
    if (c.type === 'request') {
      const { a, b, off } = reqEnds(c, map);
      let P, tDef;
      if (mode === 'squadrata') {
        const RT = R.reqRoutes(map), r = RT && RT.routes[c.id];
        P = mkPoly(r ? r.nodes : [a, { x: a.x - 26, y: a.y }, { x: a.x - 26, y: b.y - 30 }, { x: b.x, y: b.y - 30 }, b]);
        tDef = r ? r.tDef : 0.7;
      } else if (mode === 'dritta') {
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
    const P = mkPoly([a, ...via, b]);
    const t = c.props.t == null ? 0.5 : c.props.t;
    return Object.assign(P, { mid: P.at(t), tDef: 0.5 });
  };
  /** t più vicino a un punto lungo il connettore (campionamento) */
  R.nearestT = (c, map, pt) => { const P = R.connPath(c, map); let best = 0.5, bd = Infinity; for (let i = 0; i <= 60; i++) { const t = i / 60; const q = P.bez(t); const d = Math.hypot(q.x - pt.x, q.y - pt.y); if (d < bd) { bd = d; best = t; } } return Math.min(0.92, Math.max(0.08, best)); };
  function drawConn(c, map) {
    const P = R.connPath(c, map); const p = c.props; let s = '';
    if (!c.from.el || !c.to.el) s += `<circle cx="${!c.from.el ? P.a.x : P.b.x}" cy="${!c.from.el ? P.a.y : P.b.y}" r="5" fill="#fff" stroke="#c8321e" stroke-dasharray="2 2"/>`;
    if (c.type === 'flow') {
      s += `<path class="pencil" d="${P.d}" ${R.connAttrs(c)}/>`;
      if (p.or) s += `<text class="hand" x="${P.mid.x}" y="${P.mid.y - 8}" text-anchor="middle" font-size="10" font-style="italic">or</text>`;
      if (p.label) s += `<text class="hand muted" x="${P.mid.x}" y="${P.mid.y + 14}" text-anchor="middle" font-size="9">${esc(p.label)}</text>`;
    } else {
      s += `<path class="pencil" d="${P.d}" ${R.connAttrs(c)}/>`;
      const sub = [p.channel, p.to ? '→ ' + p.to : ''].filter(Boolean).join(' ');
      s += `<text class="chan-txt hand" x="${P.mid.x}" y="${P.mid.y + 22}" text-anchor="middle">${esc(sub)}</text>`;
      if (p.note) s += `<text class="hand muted" x="${P.mid.x}" y="${P.mid.y + 35}" text-anchor="middle" font-size="8.5">${esc(p.note.slice(0, 60))}</text>`;
      if (p.hands) s += `<text class="hand muted" x="${P.mid.x}" y="${P.mid.y - 18}" text-anchor="middle" font-size="9">${esc(p.hands)} mani</text>`;
    }
    s += `<path class="conn-hit" d="${P.d}"/>`;
    return s;
  }
  /** icona del canale (livello sopra gli elementi), trascinabile lungo la curva (props.t) */
  const chanHandleSVG = (c, map) => { const P = R.connPath(c, map), k = R.connLook(c); return `<g class="chan-handle" data-chan-handle="${c.id}"><circle class="chan" cx="${P.mid.x}" cy="${P.mid.y}" r="13" stroke="${k.stroke}"/>${R.chanIcon(c.props.channel, P.mid.x, P.mid.y, 0.7, k.stroke)}</g>`; };
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
  R.LOCKABLE = ['storm', 'fluffy', 'burst', 'text', 'inbox', 'inventory', 'distance', 'delta', 'person', 'box', 'icon', 'face'];
  R.children = (id, map) => map.elements.filter(e => e.props && (e.props.lockTo === id || (e.type === 'delta' && e.props.attachedTo === id)));

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
    els.forEach(el => { const pos = R.elPos(el, map); const g = `<g class="el el-${el.type}" data-id="${el.id}" data-type="${el.type}" transform="translate(${pos.x} ${pos.y})">${hitRect(el)}${drawEl(el)}</g>`; if (el.type === 'lane') lanes += g; else body += g; });
    L.lanes.innerHTML = lanes; L.el.innerHTML = body;
    L.conn.innerHTML = map.elements.filter(V.isConnector).map(c => `<g class="conn" data-id="${c.id}" data-type="${c.type}">${drawConn(c, map)}</g>`).join('');
    R.handles(map);
  };
  const updHandle = (c, map) => { if (c.type !== 'request') return; const g = L.hand.querySelector(`[data-chan-handle="${c.id}"]`); if (g) g.outerHTML = chanHandleSVG(c, map); else L.hand.insertAdjacentHTML('beforeend', chanHandleSVG(c, map)); };
  /** aggiorna solo un elemento (e i connettori/delta legati) — usato durante il trascinamento */
  R.updateEl = (id, map, isChild = false) => {
    const el = V.byId(id, map); if (!el) return;
    if (V.isConnector(el)) { const g = L.conn.querySelector(`[data-id="${id}"]`); if (g) g.innerHTML = drawConn(el, map); updHandle(el, map); if (!isChild) R.children(el.id, map).forEach(d => R.updateEl(d.id, map, true)); return; }
    const g = (el.type === 'lane' ? L.lanes : L.el).querySelector(`[data-id="${id}"]`); const pos = R.elPos(el, map);
    if (g) { g.setAttribute('transform', `translate(${pos.x} ${pos.y})`); g.innerHTML = hitRect(el) + drawEl(el); }
    // connettori toccati (e i loro figli agganciati/bloccati)
    map.elements.filter(c => V.isConnector(c) && (c.from.el === id || c.to.el === id)).forEach(c => { const cg = L.conn.querySelector(`[data-id="${c.id}"]`); if (cg) cg.innerHTML = drawConn(c, map); updHandle(c, map); R.children(c.id, map).forEach(d => R.updateEl(d.id, map, true)); });
    // figli bloccati a questo elemento
    R.children(id, map).forEach(ch => R.updateEl(ch.id, map, true));
  };

  // ---------- inchiostro ----------
  R.strokePath = (s) => { const pts = s.points; if (!pts.length) return ''; if (pts.length < 3) return `M${pts[0][0]} ${pts[0][1]} L${(pts[pts.length - 1][0])} ${(pts[pts.length - 1][1])}`; let d = `M${pts[0][0]} ${pts[0][1]}`; for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; d += ` Q${pts[i][0]} ${pts[i][1]} ${mx.toFixed(1)} ${my.toFixed(1)}`; } const l = pts[pts.length - 1]; d += ` L${l[0]} ${l[1]}`; return d; };
  R.strokes = (map) => { L.ink.innerHTML = map.strokes.map(s => `<path class="stroke" data-sid="${s.id}" d="${R.strokePath(s)}" stroke="${s.color}" stroke-width="${s.width}"/>`).join(''); };
  R.addStrokeEl = (s) => { const p = document.createElementNS(NS, 'path'); p.setAttribute('class', 'stroke'); p.dataset.sid = s.id; p.setAttribute('stroke', s.color); p.setAttribute('stroke-width', s.width); p.setAttribute('d', R.strokePath(s)); L.ink.appendChild(p); return p; };

  // ---------- overlay calcolato: timeline + riepilogo ----------
  R.placeholders = (map) => {
    const hasBox = map.elements.some(e => e.type === 'box'), hasPerson = map.elements.some(e => e.type === 'person' && e.props.requestor);
    if (hasBox && hasPerson) return '';
    let g = '';
    const ph = (x, y, w, h, label, kind, sub) => `<g class="placeholder" data-place="${kind}" data-px="${x}" data-py="${y}" style="cursor:pointer"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="rgba(31,78,121,.04)" stroke="#1f4e79" stroke-dasharray="6 5" stroke-width="1.2"/><text class="hand" x="${x + w / 2}" y="${y + h / 2 - 4}" text-anchor="middle" font-size="12" fill="#1f4e79">${esc(label)}</text><text class="hand" x="${x + w / 2}" y="${y + h / 2 + 12}" text-anchor="middle" font-size="9.5" fill="#1f4e79" opacity=".8">${esc(sub)}</text></g>`;
    // il richiedente va nella fascia alta a destra del foglio, qualunque sia la misura del foglio
    const P = V.paperOf(map);
    if (!hasPerson) g += ph(P.w - 188, 96, 150, 100, '① Chi chiede?', 'person', 'tocca: mette il richiedente');
    if (!hasBox) g += ph(110, 300, 150, 170, '② Primo passo', 'box', 'tocca: crea un process box');
    if (!hasBox) g += `<text class="hand" x="300" y="360" font-size="11" fill="#1f4e79" opacity=".8">poi: Freccia di flusso ➜ passo successivo, Delta per le attese, Matita per scrivere a mano</text>`;
    return g;
  };
  R.overlay = (map, show) => {
    if (!show) { L.overlay.innerHTML = R.placeholders(map); return; }
    const M = V.metrics(map); const { w, h } = V.paperOf(map); let g = R.placeholders(map);
    const fo = V.flowOrder(map); const order = fo.order;
    let loY = null, contentRight = null;
    if (order.length && M.hasData) {
      const bottom = Math.max(...order.map(b => b.y + b.h)) + 84; const hiY = Math.min(bottom, h - 140); loY = hiY + 24;
      contentRight = Math.max(...order.map(b => b.x + b.w));
      let path = '', labels = '';
      order.forEach((b, i) => {
        path += `<path class="va" d="M${b.x} ${hiY} V${loY} H${b.x + b.w} V${hiY}"/>`;
        labels += `<text class="hand" x="${b.x + b.w / 2}" y="${loY + 13}" text-anchor="middle" font-size="10" fill="#3f7d5a">${fmt(num(b.props.avg))}</text>`;
        if (i < order.length - 1) {
          const nb = order[i + 1]; const conn = fo.flows.find(f => f.from.el === b.id && f.to.el === nb.id);
          const ds = map.elements.filter(d => d.type === 'delta' && conn && d.props.attachedTo === conn.id);
          const val = ds.length ? ds.map(d => num(d.props.avg)).filter(v => v != null).reduce((a, c) => a + c, 0) : null;
          // etichetta dell'attesa solo se il tratto è abbastanza largo: in un varco stretto finirebbe sopra i gradini verdi accanto
          const x1 = b.x + b.w, x2 = nb.x; if (x2 > x1) { path += `<path class="nva" d="M${x1} ${hiY} H${x2}"/>`; if (x2 - x1 >= 34) labels += `<text class="hand delta-txt" x="${(x1 + x2) / 2}" y="${hiY - 5}" text-anchor="middle" font-size="10">${val == null ? (ds.length ? '?' : '') : fmt(val)}</text>`; }
        }
      });
      g += path + labels;
      g += `<text class="hand muted" x="${order[0].x}" y="${hiY - 20}" font-size="10">tempo a valore (verde, sotto) · attese (rosso, sopra) — ${esc(map.unit)}${fo.estimated ? ' · ordine stimato (collega i box con le frecce)' : ''}</text>`;
    }
    // il riepilogo segue il contenuto (sotto la timeline, allineato a destra dei box): su un foglio grande,
    // ancorarlo all'angolo della carta lo lascerebbe lontano dalla mappa
    const sw = 270, sh = M.ftq != null ? 106 : 92;
    let sx = w - sw - 30, sy = h - sh - 30;
    if (loY != null) {
      // accanto al contenuto, non sotto: sotto la timeline ci sono spesso note e nuvole che verrebbero coperte
      sx = contentRight + 40; sy = loY - sh;
      if (sx + sw > w - 20) { sx = contentRight - sw; sy = loY + 34; } // non ci sta a destra: torna sotto
    }
    sx = Math.max(20, Math.min(sx, w - sw - 20)); sy = Math.max(20, Math.min(sy, h - sh - 20));
    g += `<g><rect class="box" x="${sx}" y="${sy}" width="${sw}" height="${sh}" rx="2"/>
      <text class="hand" x="${sx + 12}" y="${sy + 20}" font-size="12" font-weight="700">Riepilogo (${esc(map.unit)})${map.samples ? ` · ${esc(map.samples)} misure` : ''}</text>
      <text class="hand" x="${sx + 12}" y="${sy + 40}" font-size="11">Totale VA: <tspan font-weight="700">${fmt(M.va)}</tspan>   Totale NVA: <tspan font-weight="700" fill="#c8321e">${fmt(M.nva)}</tspan></text>
      <text class="hand" x="${sx + 12}" y="${sy + 58}" font-size="11">VA %: <tspan font-weight="700">${fmt(M.vaPct)} %</tspan>   NVA %: <tspan font-weight="700" fill="#c8321e">${fmt(M.nvaPct)} %</tspan></text>
      ${M.ftq != null ? `<text class="hand" x="${sx + 12}" y="${sy + 76}" font-size="11">First Time Quality: <tspan font-weight="700">${fmt(M.ftq)} %</tspan></text>` : ''}
      <text class="hand muted" x="${sx + 12}" y="${sy + (M.ftq != null ? 94 : 78)}" font-size="10">${M.hasData ? 'value quotient = VA / (VA + NVA)' : 'aggiungi Hi/Lo/Avg ai box e ai delta'}</text></g>`;
    L.overlay.innerHTML = g;
  };

  // ---------- selezione / ui temporanea ----------
  const lockGlyph = (x, y, sc = 1) => `<g transform="translate(${x} ${y}) scale(${sc})"><rect x="0" y="4" width="10" height="8" rx="1.5" fill="#1f4e79"/><path d="M2 4V3a3 3 0 016 0v1" fill="none" stroke="#1f4e79" stroke-width="1.5"/></g>`;
  R.lockGlyph = lockGlyph;
  /** punto di riferimento di un elemento per le linee di blocco: centro (o punto a lockT/mid sulle frecce) */
  const refPt = (el, map, t) => { if (V.isConnector(el)) { const P = R.connPath(el, map); return P.bez(t == null ? 0.5 : t); } const p = R.elPos(el, map); return { x: p.x + el.w / 2, y: p.y + el.h / 2 }; };
  /** legami di blocco visibili: figlio selezionato → linea al genitore; genitore selezionato → anelli sui figli */
  R.lockLinks = (ids, map) => {
    let s = ''; const shown = new Set();
    ids.forEach(id => {
      const el = V.byId(id, map); if (!el) return;
      const parId = el.props && (el.props.lockTo || (el.type === 'delta' && el.props.attachedTo)); const par = parId ? V.byId(parId, map) : null;
      if (par && !ids.includes(par.id)) { const a = refPt(el, map), b = refPt(par, map, el.props.lockT); s += `<line class="lock-link" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`; if (V.isConnector(par)) { const P = R.connPath(par, map); s += `<path class="lock-parent" d="${P.d}"/>`; } else { const pp = R.elPos(par, map); s += `<rect class="lock-parent" x="${pp.x - 3}" y="${pp.y - 3}" width="${par.w + 6}" height="${par.h + 6}" rx="4"/>`; } s += lockGlyph((a.x + b.x) / 2 - 5, (a.y + b.y) / 2 - 8, 0.9); }
      const kids = R.children(el.id, map).filter(k => !ids.includes(k.id));
      kids.forEach(k => { if (shown.has(k.id)) return; shown.add(k.id); const kp = R.elPos(k, map); s += `<rect class="lock-child" x="${kp.x - 3}" y="${kp.y - 3}" width="${k.w + 6}" height="${k.h + 6}" rx="4"/>`; });
      if (kids.length) { const a = refPt(el, map); const bx = V.isConnector(el) ? a.x - 12 : R.elPos(el, map).x - 6, by = V.isConnector(el) ? a.y - 30 : R.elPos(el, map).y - 24; s += `<g class="lock-count"><rect x="${bx}" y="${by}" width="${kids.length > 9 ? 36 : 30}" height="16" rx="8"/>${lockGlyph(bx + 4, by + 1, 0.9)}<text x="${bx + 24}" y="${by + 12}" text-anchor="middle">${kids.length}</text></g>`; }
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
      if (el.props.lockTo || (el.type === 'delta' && el.props.attachedTo)) s += lockGlyph(pos.x - pad - 14, pos.y - pad - 2);
      if (ids.length === 1 && ['box', 'lane', 'storm', 'fluffy', 'burst', 'text', 'legend'].includes(el.type)) s += `<circle data-handle="${id}" cx="${pos.x + sz.w + 5}" cy="${pos.y + sz.h + 5}" r="16" fill="transparent" style="cursor:nwse-resize"/><rect class="handle" data-handle="${id}" x="${pos.x + sz.w - 1}" y="${pos.y + sz.h - 1}" width="12" height="12" rx="2"/>`;
    });
    L.ui.innerHTML = s;
  };
  R.ghost = (html) => { L.ui.innerHTML = html; };
  R.flash = (id) => { const g = svg.querySelector(`[data-id="${id}"]`); if (!g) return; g.classList.add('flash'); setTimeout(() => g.classList.remove('flash'), 2600); };

  R.all = (map, opts = {}) => { R.paper(map); R.strokes(map); R.elements(map); R.overlay(map, map.overlays !== false); R.selection(opts.selection || [], map); };

  // ---------- export SVG (solo il foglio) ----------
  R.exportSVG = (map) => {
    const { w, h } = V.paperOf(map);
    const css = Array.from(document.styleSheets).flatMap(ss => { try { return Array.from(ss.cssRules); } catch (e) { return []; } }).filter(r => r.selectorText && r.selectorText.startsWith('svg ')).map(r => r.cssText.replace(/^svg /, '')).join('\n');
    const vars = `:root{--paper:#fbf8f0;--pencil:#2b2b2b;--pencil-2:#5a5a5a;--paper-line:#c9c2b0;--delta:#c8321e;--cloud:#5b6472;--sage:#3f7d5a;--sel:#1f4e79;--accent:#1f4e79;--hand:"Chalkboard SE","Marker Felt","Segoe Print","Bradley Hand","Comic Neue","Patrick Hand",cursive}`;
    const defs = svg.querySelector('defs').outerHTML;
    const layers = ['paper', 'lanes', 'ink', 'conn', 'el', 'hand', 'overlay'].map(k => L[k].outerHTML).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><style>${vars}\n${css}</style>${defs}${layers}</svg>`;
  };
})(window.VSM);
