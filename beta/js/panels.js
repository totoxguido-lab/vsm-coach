/* VSM Coach v2 — panels.js: palette, popover degli elementi, guida, piano, libreria mappe, menu, suggerimenti di strumento. */
(function (V) {
  'use strict';
  const I = V.interact, R = V.render; const { num, fmt, uid, clone, today } = V.util;
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const UI = V.ui = {};
  UI.toast = (m) => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(UI._t); UI._t = setTimeout(() => t.classList.remove('show'), 2200); };

  // ---------- icone ----------
  const IC = {
    select: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M5 3l14 8-6 2-3 6z"/></svg>',
    pan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8 11V5.5a1.5 1.5 0 013 0V11m0-4.5a1.5 1.5 0 013 0V11m0-3a1.5 1.5 0 013 0v7a6 6 0 01-6 6h-1a6 6 0 01-5-3l-2.5-4a1.5 1.5 0 012.5-1.6L8 13"/></svg>',
    ink: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l4-1L19 8a2 2 0 00-3-3L5 16z"/><path d="M13 6l4 4"/></svg>',
    eraser: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 16l9-9 5 5-6 6H8z"/><path d="M4 20h16" stroke-linecap="round"/></svg>',
    box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="6" y="3" width="12" height="18" rx="1"/><path d="M6 8h12"/></svg>',
    delta: '<svg viewBox="0 0 24 24"><path d="M4 5h16l-8 15z" fill="#c8321e"/></svg>',
    flow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h16M15 8l4 4-4 4"/></svg>',
    request: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M20 5c-6 0-10 4-16 12M7 14l-3 3 4 1"/><circle cx="20" cy="5" r="1.6" fill="currentColor"/></svg>',
    person: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="5" r="2.5"/><path d="M12 8v7M7 11h10M12 15l-4 6M12 15l4 6"/></svg>',
    storm: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 17h10a3 3 0 000-6 5 5 0 00-9.6-1.5A3.5 3.5 0 007 17z"/><path d="M11 18l-1.5 3M14 18l-1.5 3" stroke-linecap="round"/></svg>',
    fluffy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 18h10a3 3 0 000-6 5 5 0 00-9.6-1.5A3.5 3.5 0 007 18z"/></svg>',
    burst: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 3l1.8 3.6 4-.6-1.4 3.7 3.2 2.3-3.4 2 .8 3.9-3.8-1.3L12 20l-1.2-3.4L7 17.9l.8-3.9-3.4-2 3.2-2.3L6.2 6l4 .6z"/></svg>',
    inventory: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 5h16l-8 14z"/><path d="M12 9v4" stroke-linecap="round"/></svg>',
    inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 14l2-8h12l2 8v5H4z"/><path d="M4 14h5l1 2h4l1-2h5"/></svg>',
    distance: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h18M6 9l-3 3 3 3M18 9l3 3-3 3"/></svg>',
    lane: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="6" rx="1"/><rect x="3" y="13" width="18" height="6" rx="1" stroke-dasharray="3 2"/></svg>',
    text: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 6h14M12 6v13"/></svg>',
    legend: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5" stroke-linecap="round"/></svg>',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8.5 9h3l1.5 3-1.5 1a5 5 0 002.5 2.5l1-1.5 3 1.5v2a1.5 1.5 0 01-1.5 1.5A9 9 0 018.5 10.5 1.5 1.5 0 018.5 9z"/></svg>',
    face: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M8.5 14.5q3.5 3 7 0"/><circle cx="9" cy="9.5" r=".9" fill="currentColor"/><circle cx="15" cy="9.5" r=".9" fill="currentColor"/></svg>',
    area: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-dasharray="4 3"><rect x="4" y="5" width="16" height="14" rx="1.5"/></svg>',
    more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="6" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="12" r="2"/></svg>',
    whatis: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.6 2.6 0 1 1 3.6 2.4c-.9.4-1.2 1-1.2 1.8"/><circle cx="12" cy="17" r=".4" fill="currentColor"/></svg>'
  };
  // Seleziona e Mano non sono nella barra: col dito si seleziona toccando e si sposta il foglio trascinando
  // il vuoto, quindi erano due bottoni che non facevano nulla di nuovo. Matita e Gomma invece restano:
  // col dito non c'e' modo di distinguere "disegno" da "trascino" senza un interruttore (con la penna parte da se').
  const MAIN_TOOLS = [['box', 'Process box (B)'], ['delta', 'Delta / attesa (D)'], ['flow', 'Freccia di flusso (F)'], ['request', 'Via di richiesta (R)'], ['person', 'Persona / richiedente (O)'], ['storm', 'Nuvola temporalesca (N)'], null, ['area', 'Seleziona un\u2019area (A)'], ['ink', 'Matita (P)'], ['eraser', 'Gomma (E)'], null, ['whatis', 'Che cos’è? Tocca un elemento e te lo spiego'], ['more', 'Altri elementi del libro']];
  // La mano non è un elemento del foglio: è un modo di muoverlo, e sta in «Altro» perché col mouse
  // (dove non c'è il dito che fa pan da sé) senza di lei si sposta il foglio solo con le barre e la
  // rotella. Col dito continua a non servire: sul vuoto il dito fa pan comunque.
  const MORE_TOOLS = [['pan', 'Mano: sposta il foglio'], ['fluffy', 'Nuvola soffice'], ['burst', 'Kaizen burst'], ['face', 'Faccia (esperienza)'], ['icon', 'Icona (canale, mezzo, documento…)'], ['inventory', 'Scorta'], ['inbox', 'In-box / attesa'], ['distance', 'Distanza'], ['lane', 'Corsia (reparto)'], ['text', 'Testo']];
  const INK_COLORS = [['#2b2b2b', 'grafite'], ['#c8321e', 'rosso'], ['#1f4e79', 'blu'], ['#3f7d5a', 'verde']];

  UI.buildPalette = () => {
    const pal = $('#palette'); pal.innerHTML = '';
    const SHORT = { ink: 'Matita', eraser: 'Gomma', area: 'Area', box: 'Passo', delta: 'Attesa', flow: 'Flusso', request: 'Richiesta', person: 'Persona', storm: 'Problema', more: 'Altro', whatis: 'Cos’è?' };
    // "✓ Fine" compare solo quando uno strumento e' attivo: e' l'uscita, al posto del vecchio tasto Seleziona
    const done = document.createElement('button');
    done.className = 'tool done hidden'; done.id = 'tool-done'; done.title = 'Torna a selezionare (Esc)';
    done.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 7"/></svg><span class="lbl">Fine</span>';
    done.onclick = () => { $('#more-tools').classList.add('hidden'); I.setTool('select'); };
    pal.appendChild(done);
    MAIN_TOOLS.forEach(t => { if (!t) { const s = document.createElement('div'); s.className = 'sep'; pal.appendChild(s); return; } const b = document.createElement('button'); b.className = 'tool'; b.dataset.tool = t[0]; b.title = t[1]; b.setAttribute('aria-label', t[1]); b.innerHTML = IC[t[0]] + `<span class="lbl">${SHORT[t[0]]}</span>`; b.onclick = () => { if (t[0] === 'more') { $('#more-tools').classList.toggle('hidden'); return; } $('#more-tools').classList.add('hidden'); if (t[0] === 'ink' && I.tool === 'ink') { UI.inkOptions(); return; } if (I.tool === t[0]) { I.setTool('select'); return; } I.setTool(t[0]); }; pal.appendChild(b); });
    const more = $('#more-tools'); more.innerHTML = '';
    MORE_TOOLS.forEach(t => { const b = document.createElement('button'); b.className = 'tool'; b.dataset.tool = t[0]; b.innerHTML = IC[t[0]] + '<span>' + t[1] + '</span>'; b.onclick = () => { I.setTool(t[0]); more.classList.add('hidden'); }; more.appendChild(b); });
    UI.onTool(I.tool);
  };
  UI.onTool = (t) => {
    $$('#palette .tool, #more-tools .tool').forEach(b => b.setAttribute('aria-pressed', b.dataset.tool === t));
    if (t !== 'whatis' && !UI.guideVisible() && UI.guideCardOpen && UI.guideCardOpen()) UI.closeGuideCard();
    const dn = $('#tool-done'); if (dn) dn.classList.toggle('hidden', t === 'select');
    if (MORE_TOOLS.some(x => x[0] === t)) $('#palette [data-tool="more"]').setAttribute('aria-pressed', 'true');
    const hints = { ink: 'Matita attiva: tieni premuto e trascina sul foglio per tracciare (dito, mouse o penna). Tocca di nuovo la matita per colore e spessore; ✓ Fine per finire.', eraser: 'Gomma attiva: passa sui tratti da cancellare.', area: 'Area: disegna un riquadro intorno a un settore. Poi puoi eliminarlo, duplicarlo o trasformarlo in un sotto-foglio.', box: 'Passo: tocca il foglio dove vuoi il process box (o trascina per la dimensione).', delta: 'Attesa: tocca vicino a una freccia di flusso — il delta si aggancia ed entra nella timeline.', flow: 'Flusso: tieni premuto su un box e trascina fino al box successivo.', request: 'Richiesta: tieni premuto sull\'omino e trascina fino al passo; una freccia per ogni via reale. Dal menu «Collega» dell\'omino scegli anche il verbo: chiede, oppure si reca.', person: 'Persona: tocca il foglio, poi scrivi chi è (paziente, segretaria, corriere). Il primo omino nasce come richiedente, in alto a destra: la spunta si toglie dai suoi dettagli.', storm: 'Problema: tocca dove sta il problema. Che cosa non è ideale?', fluffy: 'Nuvola soffice: tocca dove va l\'idea o la cosa che funziona.', burst: 'Kaizen: tocca dove va il candidato a progetto.', inventory: 'Scorta: tocca dove sta la scorta.', inbox: 'In-box/attesa: tocca dove aspetta l\'informazione o la persona.', distance: 'Distanza: tocca dove segnare i metri percorsi.', lane: 'Corsia: trascina per una fascia orizzontale (un reparto).', text: 'Testo: tocca per una nota.', icon: 'Icona: tocca dove metterla (su un passo o una freccia si blocca da sola), poi scegli il simbolo.', face: 'Faccia: tocca dove sta chi vive quel momento (paziente, operatore) e scegli l\'espressione.', whatis: 'Che cos’è? Tocca un elemento sul foglio: ti dico cosa è e a che serve. ✓ Fine per uscire.', pan: 'Mano: trascina per spostare il foglio; pinch (o Ctrl+rotella) per lo zoom.', select: '' };
    if (hints[t]) I.hint(hints[t], 0); else I.hint('');
    UI.hideSuggestIfTool(t);
  };
  /** La cartina del progetto: l'albero dei fogli con il loro indirizzo, la mappa aperta evidenziata,
   *  la catena verso l'alto sempre visibile. È la risposta a «dove sono»: prima c'era un elenco piatto
   *  di due livelli che non lo diceva mai. I riusi (⇉) compaiono come righe sottili sotto il passo che
   *  li richiama, così si vede che rimandano altrove senza far credere che stiano lì.
   *  La gerarchia si LEGGE: i figli stanno in un contenitore (.cart-kids) con una linea verticale lungo
   *  il rientro che li collega al padre — prima il rientro era solo padding (14 px per livello), troppo
   *  timido per dire «questo sta dentro quello» senza contare i pixel. */
  UI.renderCartina = () => {
    const box = $('#cartina'); if (!box) return;
    const mia = V.map(); if (!mia) return;
    const prog = V.project();
    const maps = V.mapsOfProject(mia.projectId).filter(m => m.kind !== 'future');
    // gli indirizzi si calcolano UNA volta per foglio: mapAddress risale la catena dei padri (e
    // rinumera i passi di ciascuna madre) a ogni chiamata — a farlo per riga e per confronto
    // dell'ordinamento, su iPad la cartina si aprirebbe con un ritardo visibile
    const ind = new Map(maps.map(m => [m.id, V.mapAddress(m)]));
    const indDi = (m) => ind.has(m.id) ? ind.get(m.id) : V.mapAddress(m); // un riferimento può puntare a un progetto collegato, fuori dalla mappa
    // numeric: gli indirizzi sono numeri a tratti («2.1» sta fra «2» e «10»), non parole
    const figlie = (id) => maps.filter(m => m.parentId === id).sort((a, b) => (ind.get(a.id) || '').localeCompare(ind.get(b.id) || '', undefined, { numeric: true }));
    const riga = (m) => {
      const i = ind.get(m.id);
      const qui = m.id === mia.id;
      let h = `<button data-lv="${m.id}" class="cart-row${qui ? ' qui' : ''}" aria-current="${qui}" title="${esc(i || '')}">${i ? `<span class="ind">${esc(V.shortAddress(i))}</span>` : ''}<span class="t">${esc(m.title || 'senza titolo')}</span>${qui ? '<span class="cart-here">sei qui</span>' : ''}</button>`;
      // i riferimenti partiti da questo foglio: dicono dove mandano, non fingono di stare qui.
      // Subito dopo la riga del foglio che li richiama: stampati in fondo (dopo le figlie)
      // sembravano appartenere ai nipoti
      m.elements.filter(e => e.type === 'box' && V.linkKind(e, m) === 'riferimento').forEach(e => {
        const t = V.doc.maps[e.props.link]; if (!t) return;
        const ti = indDi(t);
        h += `<button data-lv="${t.id}" class="cart-row cart-ref" title="${esc(ti || '')}">⇉ ${ti ? `<span class="ind">${esc(V.shortAddress(ti))}</span>` : ''}<span class="t">${esc(t.title || 'senza titolo')}</span></button>`;
      });
      const kids = figlie(m.id);
      if (kids.length) h += `<div class="cart-kids">${kids.map(riga).join('')}</div>`;
      return h;
    };
    const radici = maps.filter(m => !m.parentId || !V.doc.maps[m.parentId]);
    const altri = Object.values(V.doc.projects).filter(p => !prog || p.id !== prog.id);
    box.innerHTML = `<div class="cart-head">${esc((prog || {}).name || 'progetto')}</div>`
      + radici.map(riga).join('')
      + (altri.length ? `<div class="cart-sep">altri progetti</div>` + altri.map(p => `<button data-pj="${p.id}" class="cart-row cart-prj">${esc(p.name)}</button>`).join('') : '');
    $$('[data-lv]', box).forEach(b => b.onclick = () => { box.classList.add('hidden'); if (b.dataset.lv !== mia.id) UI.openMap(b.dataset.lv); });
    $$('[data-pj]', box).forEach(b => b.onclick = () => {
      box.classList.add('hidden');
      const prima = V.mapsOfProject(b.dataset.pj)[0];
      if (prima) UI.openMap(prima.id); else UI.toast('Quel progetto non ha ancora nessuna mappa.');
    });
  };
  /** «Questo foglio diventa un passo di…»: si sale, invece di scendere soltanto. Le candidate sono i
   *  fogli dello stesso progetto che non discendono da questo (appenderlo a un suo discendente farebbe
   *  un anello) e che hanno almeno un passo a cui agganciarlo. Se non ce n'è nessuna lo dice, invece
   *  di mostrare un elenco vuoto. */
  UI.askAttach = () => {
    const map = V.map(); if (!map) return;
    const discende = (m) => { const visti = new Set(); for (let p = m; p && !visti.has(p.id); p = p.parentId ? V.doc.maps[p.parentId] : null) { if (p.id === map.id) return true; visti.add(p.id); } return false; };
    // due «non si può» diversi, e vanno detti diversi: «non c'è nessun foglio con dei passi» e «i
    // fogli con dei passi stanno tutti SOTTO questo». Dire il primo quando vale il secondo è una
    // bugia davanti a un foglio pieno di passi (prova utente su iPad, 2026-08-21).
    const conPassi = V.mapsOfProject(map.projectId).filter(m => m.id !== map.id && m.kind !== 'future' && m.elements.some(e => e.type === 'box'));
    const cand = conPassi.filter(m => !discende(m));
    const pop = $('#pop'); V.pop.current = '__attach__'; pop.classList.remove('step');
    const opts = cand.map(m => `<optgroup label="${esc((V.mapAddress(m) ? V.mapAddress(m) + ' ' : '') + (m.title || 'senza titolo'))}">${m.elements.filter(e => e.type === 'box').map(e => `<option value="${m.id}:${e.id}">${esc((V.addressOf(e, m) || '?') + ' ' + (e.props.title || 'passo senza nome'))}</option>`).join('')}</optgroup>`).join('');
    const gia = map.parentId ? V.doc.maps[map.parentId] : null;
    pop.innerHTML = `<div class="pop-head"><b>Questo foglio diventa un passo di…</b><button class="btn small ghost" id="pop-x" aria-label="Chiudi">✕</button></div>
      <div class="why">Il foglio che stai guardando può essere un passo di un processo più grande. Scegli sotto quale passo metterlo: da lì in poi avrà il suo indirizzo (per esempio 2.1) e la cartina saprà dove sei.</div>
      ${gia ? `<div class="hint">Adesso sta sotto <b>${esc(gia.title || 'senza titolo')}</b>${V.mapAddress(map) ? ' come ' + esc(V.mapAddress(map)) : ''}: scegliendo un altro passo si sposta lì.</div>` : ''}
      ${cand.length ? `<div class="field"><label for="att-sel">Passo che lo conterrà</label><select id="att-sel">${opts}</select></div><div class="actions"><button class="btn small primary" id="att-ok">Appendi qui</button></div>`
        : conPassi.length
          ? `<p class="hint">In questo progetto i fogli con dei passi (${conPassi.length}) stanno <b>tutti sotto questo</b>: appenderlo a uno di loro chiuderebbe un anello — un foglio non può stare sotto sé stesso. Per salire serve un foglio <b>più grande</b> di questo: ⋯ → «Nuova mappa», disegna il passo che rappresenta questo lavoro, e torna qui.</p>`
          : '<p class="hint">In questo progetto non c\'è ancora un foglio con dei passi a cui appenderlo. Creane uno più grande (⋯ → «Nuova mappa»), disegna il passo che rappresenta questo lavoro, e torna qui.</p>'}`;
    pop.classList.remove('hidden');
    const st = $('#stage').getBoundingClientRect(); pop.style.left = Math.max(10, st.width / 2 - 170) + 'px'; pop.style.top = '20px';
    $('#pop-x').onclick = V.pop.close;
    const ok = $('#att-ok'); if (ok) ok.onclick = () => {
      const [mid, sid] = $('#att-sel').value.split(':');
      const r = V.attachUnder(map, V.doc.maps[mid], sid);
      if (!r.ok) { UI.toast(r.reason === 'anello' ? 'Non si può: quel foglio sta già sotto questo.' : r.reason === 'altro progetto' ? 'Quel foglio è di un altro progetto.' : 'Non si può appendere lì.'); return; }
      V.pop.close(); UI.renderHeader(); UI.renderCartina();
      UI.toast('Appeso: ora questo foglio è il ' + (V.mapAddress(map) || 'sotto-foglio') + '.');
    };
  };
  /** I progetti: crearne, rinominarli, dichiarare quali si toccano. Il collegamento è ciò che permette
   *  a un passo di puntare a una mappa dell'altro progetto: senza, gli elenchi restano separati — ed è
   *  la ragione per cui l'esempio del libro non si infila più in ogni menu. */
  UI.askProjects = () => {
    const map = V.map(); const mio = map && V.doc.projects[map.projectId];
    const pop = $('#pop'); V.pop.current = '__projects__'; pop.classList.remove('step');
    const altri = Object.values(V.doc.projects).filter(p => !mio || p.id !== mio.id);
    pop.innerHTML = `<div class="pop-head"><b>Progetti</b><button class="btn small ghost" id="pop-x" aria-label="Chiudi">✕</button></div>
      <div class="why">Ogni gruppo di mappe sta dentro un progetto, e gli elenchi mostrano solo il progetto in cui sei. Due progetti si parlano — cioè un passo può puntare a una mappa dell'altro — solo se li colleghi qui.</div>
      ${mio ? `<div class="field"><label for="pj-name">Progetto di questo foglio</label><input id="pj-name" value="${esc(mio.name)}" autocomplete="off"></div>` : ''}
      ${altri.length ? `<div class="field"><label>Collegato a</label>${altri.map(p => { const n = V.mapsOfProject(p.id).length; return `<label class="check"><input type="checkbox" data-pjlink="${p.id}" ${mio && (mio.links || []).includes(p.id) ? 'checked' : ''}> <span>${esc(p.name)} <small>(${n} ${n === 1 ? 'mappa' : 'mappe'})</small></span></label>`; }).join('')}</div>` : '<p class="hint">Non c\'è ancora nessun altro progetto.</p>'}
      <div class="actions"><button class="btn small" id="pj-new">+ Nuovo progetto</button></div>`;
    pop.classList.remove('hidden');
    const st = $('#stage').getBoundingClientRect(); pop.style.left = Math.max(10, st.width / 2 - 170) + 'px'; pop.style.top = '20px';
    $('#pop-x').onclick = V.pop.close;
    const nm = $('#pj-name'); if (nm) nm.addEventListener('change', () => { V.renameProject(mio.id, nm.value); nm.value = V.doc.projects[mio.id].name; UI.renderCartina(); UI.renderMaps(); UI.renderHeader(); });
    $$('[data-pjlink]', pop).forEach(c => c.onchange = () => { V.linkProjects(mio.id, c.dataset.pjlink, c.checked); });
    $('#pj-new').onclick = () => {
      // un progetto nuovo nasce con un foglio dentro: un progetto vuoto non si potrebbe nemmeno aprire
      const p = V.addProject('Progetto ' + (Object.keys(V.doc.projects).length + 1));
      const m = V.addMap(V.newMap({ title: '', projectId: p.id }));
      V.pop.close(); UI.openMap(m.id); UI.toast('Progetto «' + p.name + '» creato: sei nel suo primo foglio.');
    };
  };
  UI.bindCartina = () => {
    const btn = $('#levels-btn'); if (!btn) return;
    btn.onclick = () => { const box = $('#cartina'); UI.renderCartina(); box.classList.toggle('hidden'); };
    // un tocco altrove chiude il pannello
    document.addEventListener('pointerdown', (ev) => { const box = $('#cartina'); if (!box || box.classList.contains('hidden')) return; if (!ev.target.closest || !ev.target.closest('#levelsctl')) box.classList.add('hidden'); }, true);
  };

  /** Trascinato un flusso o una richiesta nel vuoto: invece di far sparire il gesto, si propone qui
   *  l'elemento di arrivo. Sceglierne uno lo crea sul punto gia' collegato; toccare fuori annulla tutto. */
  // le voci vengono da I.CONN_TARGETS, la stessa lista della validazione: offrire "Persona" a una
  // richiesta creava un collegamento che poi il ricollegamento rifiutava per sempre
  const PLACE_LBL = { box: 'Passo', inventory: 'Scorta', inbox: 'In-box' };
  UI.closePlaceMenu = () => { const m = $('#placemenu'); if (!m) return false; m.remove(); document.removeEventListener('pointerdown', UI._pmAway, true); return true; };
  UI.proposePlace = (clientX, clientY, ctype, fromId, w) => {
    UI.closePlaceMenu();
    const stage = $('#stage'); const r = stage.getBoundingClientRect();
    const kinds = I.CONN_TARGETS[ctype] || ['box'];
    const m = document.createElement('div'); m.id = 'placemenu'; m.className = 'placemenu';
    m.style.left = Math.min(Math.max(clientX - r.left, 78), r.width - 78) + 'px';
    m.style.top = Math.min(Math.max(clientY - r.top, 78), r.height - 78) + 'px';
    const n = kinds.length, RAD = 66;
    m.innerHTML = '<span class="pm-dot"></span>' + kinds.map((k, i) => {
      const a = -Math.PI / 2 + (i - (n - 1) / 2) * (Math.PI / 2.6);
      const x = Math.round(Math.cos(a) * RAD), y = Math.round(Math.sin(a) * RAD);
      return `<button class="pm-btn" data-kind="${k}" style="left:${x}px;top:${y}px" title="${V.TYPES[k].name} collegato">${IC[k] || ''}<span>${PLACE_LBL[k] || k}</span></button>`;
    }).join('');
    stage.appendChild(m);
    $$('.pm-btn', m).forEach(b => b.onclick = (ev) => { ev.stopPropagation(); const k = b.dataset.kind; UI.closePlaceMenu(); I.placeAndConnect(k, w, fromId, ctype); });
    chiudiToccandoFuori(); // un tocco fuori annulla: niente elemento, niente freccia
    I.hint('Scegli che cosa mettere qui: nasce gi\u00e0 collegato. Tocca fuori per annullare.', 4000);
  };

  /* ---------- Il menu del vuoto: che cosa metto qui (punto 5 del resoconto di Gt) ----------
     Si apre toccando la carta vuota, ma solo al RILASCIO, col dito fermo e senza niente da
     deselezionare: il primo tocco sul vuoto continua a voler dire «sgombera», e far comparire dei
     bottoni sotto un dito che sta ancora trascinando è ciò che trasformava il pan in zoom.
     Le voci stanno in gruppi: in vista i quattro elementi del libro che si usano sempre, dietro
     «Altro» quelli di contorno, e le faccine in un pannello a sé — sono dieci, in un arco non ci
     stanno e sceglierle è un'altra cosa dal mettere un elemento sul foglio. */
  const RAGGIO_MIN = 74, MEZZO_BTN = 29;
  /** l'arco (o il cerchio) dei bottoni rotondi attorno al punto toccato */
  const apriRadiale = (clientX, clientY, voci, onPick, hint) => {
    UI.closePlaceMenu();
    const stage = $('#stage'); const r = stage.getBoundingClientRect();
    const n = voci.length;
    const step = Math.min(0.84, (Math.PI * 2) / Math.max(n, 3));
    const R0 = Math.max(RAGGIO_MIN, Math.ceil(MEZZO_BTN / Math.sin(step / 2)));
    const bordo = R0 + 32;
    const m = document.createElement('div'); m.id = 'placemenu'; m.className = 'placemenu';
    m.style.left = Math.min(Math.max(clientX - r.left, bordo), Math.max(bordo, r.width - bordo)) + 'px';
    m.style.top = Math.min(Math.max(clientY - r.top, bordo), Math.max(bordo, r.height - bordo)) + 'px';
    m.innerHTML = '<span class="pm-dot"></span>' + voci.map((v, i) => {
      const a = -Math.PI / 2 + (i - (n - 1) / 2) * step;
      const x = Math.round(Math.cos(a) * R0), y = Math.round(Math.sin(a) * R0);
      return `<button class="pm-btn" data-pm="${esc(v.id)}" style="left:${x}px;top:${y}px" title="${esc(v.title || v.label)}" aria-label="${esc(v.title || v.label)}">${v.icon || ''}<span>${esc(v.label)}</span></button>`;
    }).join('');
    stage.appendChild(m);
    $$('.pm-btn', m).forEach(b => b.onclick = (ev) => { ev.stopPropagation(); onPick(b.dataset.pm); });
    chiudiToccandoFuori();
    if (hint) I.hint(hint, 4000);
    return m;
  };
  /** un tocco fuori chiude. Chiudere il menu non deve mangiarsi il tocco: se si tocca un comando
   *  (✓ Fine, Annulla, il cassetto) quel tocco deve arrivare a destinazione. Si blocca solo quando il
   *  dito finisce sul foglio, dove altrimenti partirebbe subito un altro gesto. */
  const chiudiToccandoFuori = () => {
    UI._pmAway = (ev) => {
      if (ev.target.closest && ev.target.closest('#placemenu')) return;
      // il secondo dito di un pinch non chiude ne' blocca nulla: bloccarlo spezzava il conteggio
      // dei puntatori e il pinch degenerava in un pan a scatti
      if (ev.isPrimary === false) return;
      UI.closePlaceMenu();
      if (ev.target.closest && ev.target.closest('#canvas')) { ev.stopPropagation(); ev.preventDefault(); }
    };
    setTimeout(() => document.addEventListener('pointerdown', UI._pmAway, true), 0);
  };
  // i quattro del libro in vista, il resto dietro «Altro»: un arco di quindici bottoni non si legge
  const INS_PRIMI = [
    { id: 'k:box', label: 'Passo', icon: IC.box, title: 'Process box: un passo del processo' },
    { id: 'k:delta', label: 'Attesa', icon: IC.delta, title: 'Delta: il tempo in cui non succede niente' },
    { id: 'k:storm', label: 'Problema', icon: IC.storm, title: 'Un problema del processo (nuvola temporalesca)' },
    { id: 'k:person', label: 'Persona', icon: IC.person, title: 'Chi chiede, chi lavora, chi si reca' },
    { id: 'g:altro', label: 'Altro…', icon: IC.more, title: 'Scorta, in-box, distanza, corsia, nota, icona, idee' },
    { id: 'g:facce', label: 'Faccine', icon: IC.face, title: 'Come si vive questo punto: le faccine, in un pannello a sé' }
  ];
  const INS_ALTRO = [
    { id: 'k:fluffy', label: 'Idea', icon: IC.fluffy, title: 'Nuvoletta: un\'idea, o qualcosa che funziona' },
    { id: 'k:burst', label: 'Kaizen', icon: IC.burst, title: 'Kaizen burst: un miglioramento con un padrone' },
    { id: 'k:inventory', label: 'Scorta', icon: IC.inventory, title: 'Materiale o persone che si accumulano' },
    { id: 'k:inbox', label: 'In-box', icon: IC.inbox, title: 'In-box, coda, orologio' },
    { id: 'k:distance', label: 'Distanza', icon: IC.distance, title: 'Quanti metri si percorrono' },
    { id: 'k:lane', label: 'Corsia', icon: IC.lane, title: 'La fascia di un reparto' },
    { id: 'k:text', label: 'Nota', icon: IC.text, title: 'Una nota scritta sul foglio' },
    { id: 'k:icon', label: 'Icona', icon: IC.icon, title: 'Un simbolo dalla libreria (telefono, referto, letto…)' },
    { id: 'g:primi', label: 'Indietro', icon: IC.select, title: 'Torna alle voci principali' }
  ];
  UI.openInsertMenu = (clientX, clientY, w) => {
    const map = V.map(); if (!map) return;
    if (map.validated) return; // Ideale col lucchetto: non si aggiunge niente, e il menu direbbe il contrario
    const mostra = (voci, hint) => apriRadiale(clientX, clientY, voci, (id) => {
      if (id === 'g:altro') return mostra(INS_ALTRO);
      if (id === 'g:primi') return mostra(INS_PRIMI);
      if (id === 'g:facce') { UI.closePlaceMenu(); return UI.openFaceMenu(clientX, clientY, w); }
      UI.closePlaceMenu();
      I.placeKind(id.slice(2), w);
    }, hint);
    mostra(INS_PRIMI, 'Che cosa metti qui? Tocca fuori per lasciare il foglio com’è.');
  };
  /** Le faccine in un pannello a sé: sono dieci e in un arco non ci starebbero, ma soprattutto qui non
   *  si sceglie un elemento — si sceglie *come si vive* quel punto del processo, ed è la faccia stessa
   *  a essere la voce del menu. */
  UI.openFaceMenu = (clientX, clientY, w) => {
    UI.closePlaceMenu();
    const stage = $('#stage'); const r = stage.getBoundingClientRect();
    const m = document.createElement('div'); m.id = 'placemenu'; m.className = 'placemenu facce';
    const card = document.createElement('div'); card.className = 'pm-card';
    card.innerHTML = `<div class="pm-card-h">Come si vive questo punto?<button class="btn small ghost" data-pm="g:primi" title="Torna alle voci principali" aria-label="Indietro">‹</button></div>`
      + `<div class="picker faces">${V.MOODS.map(mo => `<button type="button" class="pick" data-mood="${esc(mo)}" title="${esc(V.MOOD_MEANING[mo] || mo)}"><svg viewBox="0 0 30 30" aria-hidden="true"><g class="pencil">${R.face(mo, 15, 15, 12)}</g></svg><span>${esc(mo)}</span></button>`).join('')}</div>`;
    m.appendChild(card);
    stage.appendChild(m);
    const cw = card.offsetWidth, ch = card.offsetHeight;
    m.style.left = Math.round(Math.min(Math.max(clientX - r.left, cw / 2 + 8), Math.max(cw / 2 + 8, r.width - cw / 2 - 8))) + 'px';
    m.style.top = Math.round(Math.min(Math.max(clientY - r.top, ch / 2 + 8), Math.max(ch / 2 + 8, r.height - ch / 2 - 8))) + 'px';
    $$('[data-mood]', card).forEach(b => b.onclick = (ev) => { ev.stopPropagation(); UI.closePlaceMenu(); I.placeKind('face', w, { props: { mood: b.dataset.mood } }); });
    $('[data-pm]', card).onclick = (ev) => { ev.stopPropagation(); UI.closePlaceMenu(); UI.openInsertMenu(clientX, clientY, w); };
    chiudiToccandoFuori();
  };

  UI.inkOptions = () => { const p = $('#pop'); p.innerHTML = `<div class="pop-head"><b>Matita</b><button class="btn small ghost" id="pop-x" aria-label="Chiudi">✕</button></div><div class="actions">${INK_COLORS.map(c => `<button class="btn small" data-c="${c[0]}" style="border-color:${c[0]};${I.ink.color === c[0] ? 'background:' + c[0] + ';color:#fff' : ''}">${c[1]}</button>`).join('')}</div><div class="actions">${[1.2, 1.8, 3].map(w => `<button class="btn small" data-w="${w}" ${I.ink.width === w ? 'style="border-color:var(--accent);color:var(--accent)"' : ''}>${w === 1.2 ? 'sottile' : w === 1.8 ? 'media' : 'spessa'}</button>`).join('')}</div>`; p.classList.remove('hidden'); const st = $('#stage').getBoundingClientRect(); p.style.left = Math.max(10, st.width / 2 - 100) + 'px'; p.style.top = (st.height - 200) + 'px'; $$('[data-c]', p).forEach(b => b.onclick = () => { I.ink.color = b.dataset.c; UI.inkOptions(); }); $$('[data-w]', p).forEach(b => b.onclick = () => { I.ink.width = +b.dataset.w; UI.inkOptions(); }); $('#pop-x').onclick = () => V.pop.close(); };

  // ---------- popover degli elementi ----------
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
  const field = (label, html, hint) => { const id = 'f' + (++fid); html = html.replace(/^<(input|select|textarea)\b/, `<$1 id="${id}"`); return `<div class="field"><label for="${id}">${label}</label>${html}${hint ? `<span class="hint">${hint}</span>` : ''}</div>`; };
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

  P.close = () => { const pop = $('#pop'); const was = !pop.classList.contains('hidden'); pop.classList.add('hidden'); pop.classList.remove('sheet'); pop.classList.remove('step'); P.current = null; P._mini = null; if (was && I.selection.length && UI.onSelection) UI.onSelection(I.selection); };
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
  P.open = (id) => {
    const map = V.map(); const el = V.byId(id, map); if (!el) return;
    if (P.current !== id) P._mini = null; // elemento cambiato: i pannellini ripartono chiusi
    P.current = id;
    const T = V.TYPES[el.type]; const p = el.props;
    const isBox = el.type === 'box';
    // ✓ accesa: il contenuto del passo si legge, non si scrive (la guardia vera è in V.commit)
    const roStep = (isBox && p.validated) ? ' disabled' : '';
    let h;
    if (isBox) {
      // Il pannello del passo (variante B, spec 2026-08-21): una fila di tondi in cima — gli stessi
      // .pm-btn del menu rotondo — con dietro ciò che si tocca di rado; in vista resta ciò che si
      // compila sempre (titolo, attività, tempi). Il tondo del colore indossa la tinta attuale.
      const tinta = V.tintHue(p.tint);
      const rb = (k, icon, lab, tit) => `<button class="pm-btn" data-round="${k}" title="${esc(tit)}" aria-label="${esc(tit)}" aria-pressed="false">${icon}<span>${esc(lab)}</span></button>`;
      h = `<div class="pop-rounds">`
        + `<button class="pm-btn" data-round="tint" title="Colore del passo: il sotto-foglio ↗ lo ripete come sfondo" aria-label="Colore del passo" aria-pressed="false"${tinta != null ? ` style="background:hsl(${tinta} 38% 95.5%);border-color:hsl(${tinta} 26% 64%)"` : ''}>${RIC.tint}<span>Colore</span></button>`
        + rb('link', RIC.link, 'Fogli', 'Collega a un\'altra mappa: sotto-foglio ↗ o richiamo ⇉')
        + (p.link && V.doc.maps[p.link] ? rb('peek', QICN.peek, 'Sbircia', 'Sbircia il foglio collegato senza entrarci') : '')
        + rb('setup', RIC.setup, 'Extra', 'Correct & Complete, chi/reparto e legami')
        + `<button class="pm-btn a-destra" id="pop-why" title="Perché / cos'è (dal libro)" aria-label="Spiegazione dal libro" aria-expanded="false">${IC.whatis}<span>Perché</span></button>`
        + `<button class="pm-btn${p.validated ? ' validata' : ''}" data-valid title="${p.validated ? 'Validato: tocca per riaprirlo alle modifiche (con conferma)' : 'Segna come validato: mappato, con attività e tempi'}" aria-label="Valida il passo" aria-pressed="${p.validated ? 'true' : 'false'}">${RIC.valid}<span>${p.validated ? 'Validato' : 'Valida'}</span></button>`
        + `<button class="pm-btn" id="pop-x" title="Chiudi il pannello" aria-label="Chiudi">${RIC.close}<span>Chiudi</span></button>`
        + `</div><div class="why hidden" id="pop-whytext">${esc(T.why)}</div>`;
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
        main += `<input class="pop-ptitle" data-k="title" value="${esc(p.title)}" placeholder="Nome del passo (es. Accettazione)" autocomplete="off" autofocus${roStep}>`;
        main += `<div class="pop-sec">Attività, una per riga</div><div class="acts" data-acts></div>`;
        // ⏱ accanto ai tempi: da qui si apre il cronometro (spec 2026-08-21, Parte 2). Sta qui e non
        // fra i tondi perché è di quei tre riquadri che parla — e i tondi sono già sette.
        const mis = V.timesOf(el); const misSt = V.timeStats(mis);
        main += `<div class="pop-sec">Tempi (${esc(map.unit)}) · dalla prima all'ultima attività<button class="btn small" data-misura title="Misura i tempi col cronometro" aria-label="Misura i tempi">⏱${mis.length ? ' ' + mis.length : ''}</button></div>`
          + (mis.length ? `<div class="hint" style="margin:-2px 0 6px">${mis.length} ${mis.length === 1 ? 'misura raccolta' : 'misure raccolte'} · media ${esc(fmt(V.toUnit(misSt.avg, map.unit)))}: da ⏱ si scrivono qui sotto.</div>` : '')
          + `<div class="times">`
          + [['hi', 'max'], ['lo', 'min'], ['avg', 'media']].map(([k, lab]) => `<label class="tbox"><span>${lab}</span><input data-k="${k}" value="${esc(p[k])}" inputmode="decimal" autocomplete="off"${roStep}></label>`).join('') + `</div>`;
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
      case 'delta': { const c = p.attachedTo ? V.byId(p.attachedTo, map) : null; if (!c) main += `<div class="hint" style="margin-bottom:6px">Non agganciato a una freccia: conta nel totale NVA ma non nella timeline. Trascinalo vicino a una freccia o usa "Aggancia".</div>`; main += `<div class="hint" style="margin:0 0 6px">Attesa (${esc(map.unit)}) per differenza: fine box precedente → inizio successivo</div>` + dataRow(p) + field('Dove / perché sta ferma', inp('note', p.note, 'placeholder="richiesta nel vassoio; attesa del trasportatore…"')); adv += field('Tipo di attesa (cambia il glifo)', sel('kind', p.kind, V.DELTA_KINDS)); break; }
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
      // Il menu dice PRIMA che cosa succederà: una mappa senza posto diventa il sotto-foglio di questo
      // passo (↗); una che un posto ce l'ha già resta dov'è e viene solo richiamata (⇉). Il foglio che
      // sta già sotto QUESTO passo è il suo sotto-foglio e basta: dirgli «richiamata ⇉» smentiva il
      // badge ↗ che il passo porta sul foglio.
      const suffisso = (o) => { const m2 = V.doc.maps[o.id]; if (m2 && m2.parentStepId === el.id) return ' — sotto-foglio ↗'; return o.libera ? ' — diventa sotto-foglio ↗' : ' — richiamata ⇉'; };
      const linkSel = `<select data-k="link"><option value="">— nessuna —</option><option value="__new__">+ nuovo sotto-foglio di questo passo…</option>${opts.map(o => `<option value="${o.id}" title="${esc(o.ind || '')}" ${p.link === o.id ? 'selected' : ''}>${esc(o.label)}${suffisso(o)}</option>`).join('')}</select>`;
      const linkHint = 'Una mappa che non sta ancora sotto nessun passo diventa il sotto-foglio di questo. Una che ha già il suo posto resta dov\'è: qui viene solo richiamata.';
      const openLink = (p.link && V.doc.maps[p.link]) ? `<div class="actions"><button class="btn small primary" id="pop-openlink">Apri la mappa collegata ↗</button></div>` : '';
      if (isBox) {
        // Per il passo il collegamento sta dietro il tondo ↗ in cima al pannello (variante B della
        // spec 2026-08-21): NON sepolto in «Altre opzioni» — la richiesta di Gt («non deve stare in
        // altre opzioni») resta onorata, il tondo è in vista quanto il campo di prima.
        minis += `<div class="pop-mini hidden" data-mini="link"><h4>Collega a un'altra mappa</h4><div class="field">${linkSel}<span class="hint">${linkHint}</span></div>${openLink}</div>`;
        minis += `<div class="pop-mini hidden" data-mini="setup"><h4>Extra del passo</h4><div class="row">${field('Correct & Complete %', inp('cc', p.cc, 'inputmode="decimal" placeholder="es. 90"' + roStep))}${field('Chi / reparto', inp('owner', p.owner, roStep))}</div>${lockHint}</div>`;
      } else {
        main += lockHint;
        main += field('Collega a un\'altra mappa', linkSel, linkHint);
        main += openLink;
      }
    }
    const CONVERT = { storm: ['fluffy', 'burst', 'text'], fluffy: ['storm', 'burst', 'text'], burst: ['storm', 'fluffy', 'text'], text: ['storm', 'fluffy', 'burst'], inbox: ['delta', 'inventory'], inventory: ['inbox'] };
    if (CONVERT[el.type]) adv += field('Trasforma in…', `<select data-convert><option value="">— tipo attuale: ${T.name} —</option>${CONVERT[el.type].map(t => `<option value="${t}">${V.TYPES[t].name}</option>`).join('')}</select>`, 'Il testo e la posizione restano; cambia il disegno.');
    h += main;
    if (adv) h += `<details class="adv"><summary>Altre opzioni</summary>${adv}</details>`;
    // azioni: le stesse della barra rapida (senza "Dettagli"), più quelle proprie del pop-up.
    // Per il passo «Sbircia» non si ripete in coda: è il tondo 👁 in cima.
    const acts = UI.actionList(el, map).filter(a => !(isBox && a.id === 'peek'));
    let extra = ''; if (el.type === 'burst') extra += '<button class="btn small" id="pop-toplan">→ Aggiungi al piano</button>'; if (el.type === 'legend') extra += '<button class="btn small" id="pop-legendfull">Legenda completa</button>';
    h += `<div class="actions pop-actions">${extra}${acts.map(a => `<button class="btn small ${a.id === 'del' ? 'danger' : ''}" data-pa="${a.id}" title="${esc(a.title)}">${a.label}</button>`).join('')}</div>`;
    h += minis; // i pannellini del passo: posizionati sopra il contenuto dal CSS, nascosti finché un tondo li chiama
    UI.hideQuick(); // il pop-up contiene le stesse azioni della barra rapida
    const pop = $('#pop'); pop.innerHTML = h; pop.classList.remove('hidden'); pop.classList.toggle('step', isBox); P.place(el);
    $('#pop-x').onclick = P.close; $('#pop-why').onclick = () => { const w = $('#pop-whytext'); w.classList.toggle('hidden'); $('#pop-why').setAttribute('aria-expanded', !w.classList.contains('hidden')); };
    $$('[data-pa]', pop).forEach(b => b.onclick = () => { const a = b.dataset.pa; if (['dup', 'del', 'connect', 'lockto', 'lockall', 'peek'].includes(a)) P.close(); UI.quickAction(a, id); if (['invert', 'attach', 'unlock', 'legend'].includes(a) && V.byId(id)) P.open(id); });
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
        if (!final) { V.commit({ t: 'props', id, after: { [k]: v } }, 'modifica', { silent: true }); return; } // anteprima: nessuna voce di undo
        // una sola voce di undo per campo (dal focus al cambio)
        V.commit({ t: 'props', id, after: { [k]: v }, before: { [k]: before === undefined ? cur.props[k] : before } }, 'modifica');
        before = undefined;
        // la nuvola cresce (o si stringe) da sola per far stare il testo: prima sforava sempre
        if (k === 'text' && ['storm', 'fluffy'].includes(cur.type) && !cur.props.collapsed) {
          const hh = R.cloudFit(cur.w, v);
          if (Math.abs(hh - cur.h) > 4) V.commit({ t: 'update', id, after: { h: hh }, before: { h: cur.h } }, 'misura della nuvola', { silent: true });
        }
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
      if (k === 'shape') {
        if (V.shapeOf(cur) === v) return;
        V.setStormShape(V.map(), id, v);
        $$('[data-pick="shape"]', pop).forEach(x => { const on = x.dataset.v === v; x.classList.toggle('on', on); x.setAttribute('aria-checked', on); });
        return;
      }
      if (cur.props[k] === v) return; V.commit({ t: 'props', id, after: { [k]: v } }, k === 'mood' ? 'espressione' : 'icona'); $$(`[data-pick="${k}"]`, pop).forEach(x => { const on = x.dataset.v === v; x.classList.toggle('on', on); x.setAttribute(x.hasAttribute('role') ? 'aria-checked' : 'aria-pressed', on); }); const mm = $('[data-mood-mean]', pop); if (mm && k === 'mood') mm.textContent = V.MOOD_MEANING[v] || ''; });
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
      const mb = $('[data-misura]', pop);
      if (mb) mb.onclick = () => { P.close(); UI.openMisura(id); };
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
  P.refresh = (id) => { const pop = $('#pop'); if (pop.classList.contains('hidden') || P.current !== id) return; const map = V.map(); const el = V.byId(id, map); if (!el) return; const pv = $('.pop-preview', pop); if (pv) pv.outerHTML = preview(el, map); const sb = $('.pop-sub', pop); if (sb) sb.textContent = subtitleOf(el, map); };
  P.openTitle = () => {
    const map = V.map(); const pop = $('#pop'); P.current = '__title__';
    pop.innerHTML = `<div class="pop-head"><b>Titolo, data, autori</b><button class="btn small ghost" id="pop-x" aria-label="Chiudi">✕</button></div><div class="why">L'intestazione vive qui in barra: sul foglio digitale occupava solo spazio. Titolo, data e iniziali di chi ha disegnato restano salvati con la mappa.</div>
      ${field('Titolo', `<input data-m="title" value="${esc(map.title)}" autofocus>`)}<div class="row">${field('Data', `<input data-m="date" type="date" value="${esc(map.date)}">`)}${field('Iniziali autori', `<input data-m="authors" value="${esc(map.authors)}">`)}</div>${field('Reparto / unità', `<input data-m="unitName" value="${esc(map.unitName)}">`)}${field('Scopo in una frase', `<textarea data-m="scope" placeholder="Dalla richiesta di … alla consegna di …">${esc(map.scope)}</textarea>`)}<div class="row">${field('Unità di misura (unica)', `<select data-m="unit">${['secondi', 'minuti', 'ore', 'giorni'].map(u => `<option ${u === map.unit ? 'selected' : ''}>${u}</option>`).join('')}</select>`)}${field('N. misure', `<input data-m="samples" inputmode="numeric" value="${esc(map.samples)}">`)}</div>${field('Responsabile unico del disegno', `<input data-tdrawer value="${esc(map.prep.drawer || '')}" autocomplete="off">`)}`;
    pop.classList.remove('hidden'); pop.classList.remove('step'); const st = $('#stage').getBoundingClientRect(); const hr = $('#map-head').getBoundingClientRect(); pop.style.left = Math.max(10, Math.min(st.width - 340, hr.left - st.left)) + 'px'; pop.style.top = '10px';
    $('#pop-x').onclick = P.close;
    const td = $('[data-tdrawer]', pop); td.addEventListener('input', () => { const after = Object.assign(clone(V.map().prep), { drawer: td.value }); V.commit({ t: 'meta', after: { prep: after } }, 'intestazione', { silent: true }); });
    $$('[data-m]', pop).forEach(e => {
      const k = e.dataset.m; let before;
      const commit = (final) => { if (!final) { V.commit({ t: 'meta', after: { [k]: e.value } }, 'intestazione', { silent: true }); return; } V.commit({ t: 'meta', after: { [k]: e.value }, before: { [k]: before === undefined ? V.map()[k] : before } }, 'intestazione'); before = undefined; };
      e.addEventListener('focus', () => { before = V.map()[k]; });
      if (e.tagName === 'SELECT') e.addEventListener('change', () => commit(true));
      else { e.addEventListener('input', () => commit(false)); e.addEventListener('change', () => commit(true)); }
    });
    if (map.validated) $$('input,textarea,select', pop).forEach(x => { x.disabled = true; });
  };

  // ---------- header / mappe ----------
  UI.openMap = (id) => {
    // niente modalita' appese sulla mappa nuova: il primo tocco li' deve funzionare
    if (I.pickConn) I.cancelPickConnect(); if (I.pickLock) I.cancelPickLock(); UI.closePlaceMenu(); if (!V.doc.maps[id]) { UI.toast('Mappa non trovata.'); return; } P.close(); I.select([]); V.switchMap(id); I.restoreView(); };
  /** Sale al foglio che contiene questo. Se il passo che lo conteneva esiste ancora, lo seleziona:
   *  tornando su ci si ritrova dove si era scesi, invece che in mezzo al foglio. */
  UI.goUp = () => {
    const map = V.map(); const par = map && map.parentId && V.doc.maps[map.parentId];
    if (!par) { UI.toast('Questo foglio è già in cima al progetto.'); return; }
    const stepId = map.parentStepId;
    UI.openMap(par.id);
    if (stepId && V.byId(stepId)) I.select([stepId]);
  };
  UI.renderHeader = () => {
    const map = V.map();
    $('#mh-title').textContent = map.title || '';
    const fdate = (iso) => { if (!iso) return ''; const d = new Date(iso + 'T00:00:00'); return isNaN(d) ? iso : new Intl.DateTimeFormat('it-CH', { day: 'numeric', month: 'short', year: 'numeric' }).format(d); };
    const provv = map.kind === 'current' && !map.validation.walked && map.elements.some(e => e.type === 'box');
    $('#mh-sub').textContent = [fdate(map.date), map.unitName, map.authors && ('di ' + map.authors), provv ? 'provvisoria' : ''].filter(Boolean).join(' · ');
    $('#tab-current').setAttribute('aria-pressed', map.kind === 'current'); $('#tab-future').setAttribute('aria-pressed', map.kind === 'future');
    const curM = map.kind === 'current' ? map : V.currentOf(map);
    $('#cur-ver').textContent = curM ? (curM.verName || 'mappa iniziale') : '—';
    const ideal = V.idealOf(map);
    $('#ideal-state').classList.toggle('hidden', !(ideal && ideal.validated));
    const lk = $('#tab-lock'); lk.classList.toggle('hidden', map.kind !== 'future'); lk.textContent = map.validated ? '\u{1F512}' : '\u{1F513}';
    // Le briciole rispondono a «dove sono»: solo la strada percorsa (la catena verso l'alto con gli
    // indirizzi). Il foglio aperto NON si ripete qui: stava scritto due volte, nelle briciole e nel
    // titolo accanto — il suo indirizzo invece serve, e sta davanti al titolo in #map-head.
    // La catena si raccoglie intera (la guardia è quella di mapAddress: solo contro gli anelli),
    // poi V.visibleCrumbs decide che cosa entra in barra: oltre i 4 anelli restano il primo,
    // un'ellissi e gli ultimi due — prima la barra affogava in una collana di «1.1.1.1…».
    const crumbs = []; let m = map; let guard = 0; while (m && m.parentId && V.doc.maps[m.parentId] && guard++ < 40) { m = V.doc.maps[m.parentId]; crumbs.unshift(m); }
    const briciola = (c) => { const i = V.mapAddress(c); return `<button data-open="${c.id}" title="${esc((i ? i + ' · ' : '') + (c.title || 'mappa'))}">${i ? '<span class="ind">' + esc(V.shortAddress(i)) + '</span>' : ''}${esc(c.title || 'mappa')}</button>`; };
    $('#crumbs').innerHTML = V.visibleCrumbs(crumbs).map(c => c ? briciola(c) : '<span class="crumb-gap" title="Anelli di mezzo nascosti: la strada intera è nella cartina">…</span>').join('<span>›</span>');
    // l'indirizzo davanti al titolo si mostra corto; quello vero resta nel title= (export e prove)
    const indEl = $('#mh-ind'); if (indEl) { const pieno = V.mapAddress(map); indEl.textContent = V.shortAddress(pieno); indEl.title = pieno; }
    $$('#crumbs [data-open]').forEach(b => b.onclick = () => UI.openMap(b.dataset.open));
    const su = $('#btn-up'); if (su) { su.classList.toggle('hidden', !crumbs.length); su.onclick = () => UI.goUp(); }
    // Le sottoschede rispondono a «che cosa c'è SOTTO di me»: i figli diretti del foglio aperto, con
    // l'indirizzo davanti. Servono a ridiscendere senza aprire la cartina — prima le briciole e ↑
    // portavano solo verso l'alto. Senza figli la riga resta vuota e non occupa un pixel (#subtabs:empty
    // è display:none). I riusi ⇉ restano fuori: sono fogli che stanno altrove, non sotto questo.
    const st = $('#subtabs');
    if (st) {
      const figli = V.mapsOfProject(map.projectId).filter(x => x.parentId === map.id && x.kind !== 'future')
        .sort((a, b) => V.mapAddress(a).localeCompare(V.mapAddress(b), undefined, { numeric: true }));
      st.innerHTML = figli.length ? '<span class="st-lead" aria-hidden="true">⤷</span>' + figli.map(f => { const i = V.mapAddress(f); return `<button data-open="${f.id}" title="${esc(i)}"><span class="ind">${esc(V.shortAddress(i))}</span>${esc(f.title || 'senza titolo')}</button>`; }).join('') : '';
      $$('#subtabs [data-open]').forEach(b => b.onclick = () => UI.openMap(b.dataset.open));
    }
    $('#btn-undo').disabled = !V.canUndo(); $('#btn-redo').disabled = !V.canRedo();
    if (UI.menuCheck) UI.menuCheck('#btn-overlays', map.overlays !== false);
    if (UI.linkModeLabel) UI.linkModeLabel();
  };
  UI.renderMaps = () => {
    const list = $('#maplist'); const mia = V.map();
    // la libreria è la libreria DI QUESTO progetto: gli altri si raggiungono dalla cartina
    const maps = V.mapsOfProject(mia ? mia.projectId : V.doc.activeProjectId).sort((a, b) => (b.updated || 0) - (a.updated || 0));
    const nome = (V.project() || {}).name || 'progetto';
    list.innerHTML = `<p class="hint">Progetto: <b>${esc(nome)}</b></p>` + (maps.map(m => { const ind = V.mapAddress(m); return `<div class="maprow"><b>${ind ? '<span class="ind" title="' + esc(ind) + '">' + esc(V.shortAddress(ind)) + '</span> ' : ''}${esc(m.title || 'senza titolo')}<br><span class="k">${esc(V.kindLabel(m))}${m.kind === 'future' && m.validated ? ' \u{1F512}' : ''} · ${new Date(m.updated || m.created).toLocaleDateString('it-CH')} · ${m.elements.filter(e => e.type === 'box').length} box</span></b><button class="btn small primary" data-open="${m.id}">Apri</button></div>`; }).join('') || '<p class="hint">Nessuna mappa in questo progetto.</p>');
    $$('#maplist [data-open]').forEach(b => b.onclick = () => { $('#dlg-maps').close(); UI.openMap(b.dataset.open); });
  };

  // ---------- Misura: il cronometro del giro (spec 2026-08-21, Parte 2) ----------
  /* Lo strumento è per CHI FA IL LAVORO, non per chi lo osserva da fuori (libro, cap. 5: dati falsati
   * se lo staff si sente sorvegliato): niente parole da sorveglianza, e i tocchi grandi perché si usa
   * camminando. Il giro sequenziale è l'unico modo in cui il metodo vuole che le attese nascano —
   * per differenza, mai cronometrate a parte. */
  let misuraTick = null;
  // oltre l'ora si scrive h:mm:ss — un giro riaperto il giorno dopo mostrava «1387:12», che non si legge
  const mmss = (sec) => {
    const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s2 = sec % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : String(Math.floor(sec / 60))) + ':' + String(s2).padStart(2, '0');
  };
  const VECCHIA = 2 * 3600; // una misura aperta da due ore e' quasi sempre un giro lasciato a meta'
  const nomePasso = (b, nums) => (b ? ((nums.get(b.id) ? nums.get(b.id) + ' ' : '') + (String(b.props.title || '').trim() || 'passo senza nome')) : '—');
  const SOGLIA = 8; // il libro: 8-10 misure per una vista rapida, ~30 per significatività

  UI.openMisura = (stepId) => {
    const map = V.map(); if (!map) return;
    UI.renderMisura();
    const d = $('#dlg-misura');
    if (!d.open) d.showModal();
    // il tocco su ⏱ nel pannello di un passo arriva qui con l'id: si propone quel passo, non parte da sé
    if (stepId) { const r = $(`[data-mis-solo="${stepId}"]`, d); if (r) r.scrollIntoView({ block: 'center' }); }
    clearInterval(misuraTick);
    // solo il numero si aggiorna: ridisegnare tutto ogni mezzo secondo farebbe saltare lo scorrimento
    misuraTick = setInterval(() => {
      const m = V.map(); const s = V.measureState(m); const t = $('#mis-crono');
      if (t && s && s.t0) t.textContent = mmss(V.measureElapsed(m));
    }, 500);
  };
  UI.closeMisura = () => { clearInterval(misuraTick); misuraTick = null; const d = $('#dlg-misura'); if (d && d.open) d.close(); };

  UI.renderMisura = () => {
    const map = V.map(); const body = $('#mis-body'); if (!map || !body) return;
    const s = V.measureState(map);
    const c = V.measureChain(map);
    const nums = V.stepNumbers(map);
    const st = (el) => V.timeStats(V.timesOf(el));
    $('#mis-head').textContent = 'Misura' + (s && s.giro ? ' — giro ' + s.giro : '') + ' · ' + map.unit;
    let h = '';
    if (!c.chain.length) {
      h += `<p class="hint">Su questo foglio non c'è ancora un passo da misurare: disegna almeno un process box, poi torna qui.</p>`;
    } else {
      const cur = s && s.stepId ? V.byId(s.stepId, map) : null;
      const from = s && s.fromId ? V.byId(s.fromId, map) : null;
      // Il passo (o la freccia) cancellato sotto la misura: senza questo ramo il pannello scriveva
      // «sto misurando: —», e il trattino è ancora una mezza bugia. Qui lo si dice, e l'unica via
      // d'uscita è a portata di dito invece che da indovinare.
      const vivoPasso = !!(cur && cur.type === 'box');
      const fantasma = !!(s && s.phase && (!vivoPasso || (s.phase === 'attesa' && (!from || !V.byId(s.connId, map)))));
      // si nomina il pezzo che manca davvero: dire «il passo» mentre il passo sta nell'elenco qui
      // sotto è una contraddizione che si vede a colpo d'occhio
      const cosaManca = !vivoPasso ? 'Il passo che stavi misurando non c\'è più: è stato cancellato'
        : (s && s.phase === 'attesa' && !V.byId(s.connId, map)) ? 'La freccia su cui nasceva questa attesa non c\'è più: è stata cancellata'
        : 'Il passo da cui eri partito non c\'è più: è stato cancellato';
      if (fantasma) {
        h += `<div class="mis-crono"><div class="mis-what">${cosaManca} mentre il cronometro correva.</div>`
          + `<p class="notice warn">Questa misura non si può salvare: non c'è più dove scriverla. Chiudi il giro e riparti quando vuoi — le misure già raccolte restano.</p>`
          + `<div class="mis-acts"><button class="btn big primary" data-mis-stop>chiudi il giro</button></div></div>`;
      } else if (s && s.phase) {
        h += `<div class="mis-crono"><div class="mis-time" id="mis-crono">${mmss(V.measureElapsed(map))}</div>`
          + `<div class="mis-what">${s.phase === 'attesa'
            ? `attesa fra <b>${esc(nomePasso(from, nums))}</b> e <b>${esc(nomePasso(cur, nums))}</b>`
            : `sto misurando: <b>${esc(nomePasso(cur, nums))}</b>`}</div>`
          + `<div class="mis-acts"><button class="btn big primary" data-mis-ok>${s.phase === 'attesa' ? 'comincia il prossimo' : 'passo finito'}</button>`
          + `<button class="btn big" data-mis-scarta title="Butta via questa misura e riparti da adesso">scarta</button></div>`
          + (V.measureElapsed(map) > VECCHIA ? `<p class="notice warn">Questa misura è aperta da un pezzo: se il giro era rimasto a metà (app chiusa, tablet spento), tocca «scarta» per ripartire da adesso — il tempo che vedi non è il tempo del passo.</p>` : '')
          + `<div class="hint">${s.phase === 'attesa'
            ? 'L\'attesa non si cronometra: nasce da qui, per differenza — fine del passo → inizio del successivo.'
            : (s.mode === 'singolo' ? 'Un passo alla volta: così le attese non nascono (nascono solo misurando in sequenza).' : 'Dalla prima all\'ultima attività del passo.')}</div>`
          + `<div class="mis-acts"><button class="btn small ghost" data-mis-stop>chiudi il giro</button></div></div>`;
      } else {
        h += `<div class="mis-crono"><div class="mis-time">0:00</div>`
          + `<div class="mis-what">${s && s.giro > 1 ? 'Giro ' + s.giro + ': pronto a partire.' : 'Il giro parte dal primo passo e segue le frecce.'}</div>`
          + `<div class="mis-acts"><button class="btn big primary" data-mis-giro>comincia il giro</button></div>`
          + `<div class="hint">Oppure tocca ⏱ accanto a un passo qui sotto per misurare solo quello, quante volte vuoi.</div></div>`;
      }
      if (c.forks.length) {
        const dove = c.forks.map(id => nums.get(id) || '?').join(', ');
        h += `<p class="notice warn">Il flusso si divide (dopo il passo ${esc(dove)}): il giro segue un ramo solo${c.fuori.length ? `, e ${c.fuori.length === 1 ? 'un passo resta fuori' : c.fuori.length + ' passi restano fuori'}` : ''}. ${c.fuori.length === 1 ? 'Quello si misura' : 'Quelli si misurano'} a parte, con ⏱.</p>`;
      }
      h += '<div class="mis-list">' + c.chain.map(b => {
        const k = st(b); const corrente = s && s.phase === 'box' && s.stepId === b.id;
        return `<div class="mis-row${corrente ? ' now' : ''}">`
          + `<b>${esc(nomePasso(b, nums))}</b>`
          + `<span class="k">${corrente ? '⏱ in corso' : (k.n ? `✓ ${esc(fmt(V.toUnit(k.avg, map.unit)))} · ${k.n} ${k.n === 1 ? 'misura' : 'misure'}` : '—')}</span>`
          + (b.props.validated ? '<span class="k" title="Passo validato: il contenuto non si modifica">✓</span>'
            : `<button class="btn small" data-mis-solo="${b.id}" title="Misura solo questo passo">⏱</button>`)
          + '</div>';
      }).join('') + '</div>';
      if (c.fuori.length) h += `<div class="mis-list">` + c.fuori.map(b => {
        const k = st(b);
        return `<div class="mis-row fuori"><b>${esc(nomePasso(b, nums))}</b><span class="k">fuori dalla catena${k.n ? ` · ${k.n} misure` : ''}</span><button class="btn small" data-mis-solo="${b.id}" title="Misura solo questo passo">⏱</button></div>`;
      }).join('') + '</div>';
    }
    // Le misure raccolte, una per una: si guardano e si scartano (il caso eccezionale lo riconosce
    // chi ha osservato, non l'app). Il conto si rifà da solo.
    const rep = V.timesReport(map);
    if (rep.length) {
      const poche = rep.filter(r => r.n < SOGLIA).length;
      h += `<div class="pop-sec">Misure raccolte</div>`;
      const sospette = rep.reduce((n, r) => n + r.brevi, 0);
      h += rep.map(r => `<div class="mis-mis"><div class="mm-head"><b>${esc(r.label)}</b>`
        + `<span class="k">max ${esc(fmt(r.stats.hi))} · min ${esc(fmt(r.stats.lo))} · media ${esc(fmt(r.stats.avg))} · ${r.n} ${r.n === 1 ? 'misura' : 'misure'}${r.validated ? ' · validato' : ''}</span></div>`
        + `<div class="mm-chips">` + r.times.map((t, i) => `<button class="mm-chip${t < V.MISURA_BREVE ? ' breve' : ''}" data-mis-drop="${r.id}" data-i="${i}" title="${t < V.MISURA_BREVE ? `Solo ${t} second${t === 1 ? 'o' : 'i'}: un tocco per sbaglio? Toccala per scartarla` : 'Scarta questa misura'}">${esc(fmt(V.toUnit(t, map.unit)))} <span aria-hidden="true">✕</span></button>`).join('') + `</div></div>`).join('');
      // un tocco per sbaglio scrive «0,02 minuti» su un'accoglienza: il numero è vero e la mappa è falsa
      if (sospette) h += `<p class="notice warn">${sospette === 1 ? 'Una misura dura' : sospette + ' misure durano'} meno di ${V.MISURA_BREVE} secondi: ${sospette === 1 ? 'è' : 'sono'} un tocco per sbaglio, o un giro chiuso subito? ${sospette === 1 ? 'È segnata in arancione' : 'Sono segnate in arancione'} qui sotto — toccala${sospette === 1 ? '' : 'e'} per scartarla${sospette === 1 ? '' : 'e'}. Nessun tempo di un passo vero dura due secondi.</p>`;
      if (poche) h += `<p class="hint">${poche === rep.length ? 'Sono' : 'Per qualcuno sono'} poche per farci un ragionamento: il libro consiglia 8-10 misure per una vista rapida, una trentina per parlare di significatività. Non fissarti sul numero: guarda se i valori si somigliano.</p>`;
      h += `<div class="mis-acts"><button class="btn primary" data-mis-calc>Calcola i tempi</button></div>`
        + `<p class="hint">Scrive max / min / media su ogni passo e ogni attesa che ha misure. È una sola voce di annulla.</p>`;
    } else {
      h += `<p class="hint">Nessuna misura ancora. Il tempo del passo va dalla prima all'ultima attività; l'attesa non si cronometra: esce da sola misurando i passi in fila.</p>`;
    }
    body.innerHTML = h;

    const ridisegna = () => UI.renderMisura();
    const btn = (sel, fn) => { const b = $(sel, body); if (b) b.onclick = fn; };
    btn('[data-mis-giro]', () => {
      if (map.validated) return UI.toast('Questo foglio è validato 🔒: finché il lucchetto è chiuso le misure non si possono scrivere. Aprilo in alto, poi comincia il giro.');
      const primo = c.chain.find(b => !b.props.validated);
      if (!primo) return UI.toast('Tutti i passi di questa catena sono validati ✓: non c\'è niente da misurare.');
      V.measureStart(map, primo.id, 'giro'); ridisegna();
    });
    btn('[data-mis-ok]', () => {
      const r = V.measureAdvance(map);
      // Tre esiti diversi, tre frasi diverse: dire «è validato ✓» davanti a un passo cancellato era
      // una bugia detta proprio a chi sta camminando il processo (R2 del debug 2026-08-21).
      if (r && r.ko === 'sparito') UI.toast(
        r.cosa === 'freccia' ? 'La freccia fra i due passi non c\'è più: è stata cancellata. Il giro si è fermato e questa attesa è persa — l\'attesa nasce sulla freccia, e senza quella non c\'è dove scriverla.'
        : r.cosa === 'partenza' ? 'Il passo da cui eri partito non c\'è più: è stato cancellato. Il giro si è fermato e questa attesa è persa — un\'attesa si calcola fra due passi, e uno dei due non c\'è.'
        : 'Il passo che stavi misurando non c\'è più: è stato cancellato. Il giro si è fermato e questa misura è persa — non c\'era più dove scriverla.');
      else if (r && r.ko === 'foglio') UI.toast('Questo foglio è validato 🔒: finché il lucchetto è chiuso le misure non si possono scrivere. Aprilo in alto, poi riprendi il giro.');
      else if (r && r.ko === 'validato') UI.toast('Questa misura non è stata registrata: il passo è validato ✓.');
      else if (r && r.chiuso) UI.toast('Giro finito. Le misure sono salvate: «Calcola i tempi» le scrive sul foglio.');
      ridisegna();
    });
    btn('[data-mis-scarta]', () => { V.measureDiscard(map); ridisegna(); });
    btn('[data-mis-stop]', () => { V.measureStop(map); ridisegna(); });
    $$('[data-mis-solo]', body).forEach(b => b.onclick = () => { V.measureStart(map, b.dataset.misSolo, 'singolo'); ridisegna(); });
    $$('[data-mis-drop]', body).forEach(b => b.onclick = () => { V.dropTime(map, b.dataset.misDrop, +b.dataset.i); ridisegna(); });
    btn('[data-mis-calc]', () => {
      const brevi = rep.reduce((n, r) => n + r.brevi, 0);
      if (brevi && !confirm(`${brevi === 1 ? 'Una misura dura' : brevi + ' misure durano'} meno di ${V.MISURA_BREVE} secondi.\n\nSe ${brevi === 1 ? 'è' : 'sono'} un tocco per sbaglio, ${brevi === 1 ? 'scartala' : 'scartale'} prima: ${brevi === 1 ? 'finirebbe' : 'finirebbero'} nel minimo e nella media, e il foglio direbbe una cosa falsa.\n\nOK = scrivi i tempi lo stesso.`)) return;
      const manuali = rep.filter(r => r.manual && !r.validated);
      if (manuali.length && !confirm(`${manuali.length === 1 ? 'Un elemento ha' : manuali.length + ' elementi hanno'} già tempi scritti a mano (${manuali.slice(0, 3).map(r => r.label).join(', ')}${manuali.length > 3 ? '…' : ''}).\n\nCalcolando i tempi vengono sostituiti da quelli misurati. Si annulla con ↶.\n\nOK = scrivi i tempi.`)) return;
      const r = V.applyTimes(map);
      if (!r.ok && !r.written) UI.toast(r.validati ? 'Solo passi validati ✓: nessun tempo scritto.' : 'Niente da scrivere.');
      else UI.toast(`Tempi scritti su ${r.written} ${r.written === 1 ? 'elemento' : 'elementi'}${r.validati ? ` (${r.validati} validati ✓, non toccati)` : ''}. Annulla con ↶.`);
      ridisegna();
    });
  };

  // ---------- Guida pratica: primi passi, metodo e simboli in un solo pannello ----------
  // Fusione di guida, «come si usa» e legenda (report Kimi K3, docs/kimi-guida-pratica-report.md).
  // Il pannello elenca le voci; il tocco apre una scheda flottante autosufficiente che si chiude con ✕
  // o toccando il vuoto — il pannello resta aperto. Ogni regola è scritta in un posto solo: la formula
  // del delta in «Dati», C&C % in «Passo», VA %/FTQ in «Leggere il foglio».
  const PRIMI = [
    { id: 'prima', t: 'La prima mappa', body: 'Sul foglio vuoto tocca i segnaposto ① Chi chiede? e ② Primo passo: è il modo più rapido per iniziare. Un altro modo: tocca il foglio dove vuoi l’elemento e scegli dal menu rotondo che compare (Passo, Attesa, Problema, Persona, «Altro…» e le faccine in un pannello a sé). Oppure scegli lo strumento nella barra in basso e tocca il punto del foglio. Per spostare il foglio: col dito basta trascinare il vuoto; col mouse c’è la <b>mano</b> in «Altro» (poi «✓ Fine» per tornare a selezionare). Le mappe si salvano da sole, non c’è un tasto salva. Errore tipico: progettare tutto prima di disegnare — parti dal richiedente e segui il processo.' },
    { id: 'modifica', t: 'Modificare e collegare', body: 'Un tocco su un elemento apre le azioni rapide (+ Passo dopo, Collega →…); un secondo tocco apre i dettagli. «Collega →» apre un secondo menu con che cosa collegare: un passo nuovo, una scorta, un in-box, o un elemento già sul foglio — e sull\'omino prima ancora il verbo («chiede a…» / «si reca a…»). Per una freccia di flusso o di richiesta tieni premuto e trascina fino all’altro elemento. Un’estremità staccata è segnata in rosso tratteggiato: riagganciala, altrimenti resta fuori dalla timeline.' },
    { id: 'matita', t: 'Matita, coach, annulla', body: 'Con la Matita scrivi e disegni a mano libera (l’Apple Pencil scrive da sé, le dita muovono gli elementi). ✦ legge il foglio e propone modifiche: è un secondo parere, non un correttore — valuta prima di accettare. ↶ annulla l’ultima azione, tutte le volte che serve.' },
    { id: 'foglio', t: 'Leggere il foglio', body: 'Sotto i passi la timeline: verde in basso il tempo a valore, rosso in alto le attese; il riepilogo in basso a destra fa i conti (VA, NVA, VA %, First Time Quality). La catena ⛓ dice che un elemento è legato a un altro: spostando quello, si muove anche lui («Lega a…» / «Slega» nelle azioni rapide). Il lucchetto 🔒 invece inchioda un elemento al foglio: non si sposta finché non lo sblocchi («Blocca» / «Sblocca»). Il badge ↗ apre la mappa collegata (dettaglio, turno, futuro). «Provvisoria» nell’intestazione in barra resta finché non cammini e validi il processo (vedi Cammina e valida).' },
    { id: 'livelli', t: 'Più fogli, senza perdersi', body: 'Un passo può contenere un foglio suo: aprilo col badge ↗. Da lì in poi ogni passo ha un <b>indirizzo</b> — il passo 2 contiene il 2.1, che contiene il 2.1.1 — e l\'indirizzo si vede sul badge, nelle briciole in barra e nella <b>cartina</b> (l\'icona a destra, sopra lo zoom): la cartina dice sempre dove sei. «↑ su» in barra risale, selezionando il passo da cui eri sceso; ⋯ → «Questo foglio diventa un passo di…» fa il contrario, e appende il foglio che stai guardando sotto un passo di un processo più grande. Il badge <b>⇉</b> è un\'altra cosa: quel passo <i>richiama</i> un foglio che sta altrove (stesso processo, già disegnato) e ti dice dove. I numeri si ricalcolano da soli quando cambi le frecce: sono una scaletta, non un\'etichetta. Tutte le mappe di un lavoro stanno in un <b>progetto</b> (⋯ → «Progetti…»): gli elenchi mostrano solo quello in cui sei, e due progetti si parlano solo se li colleghi.' },
  ];
  const METODO = [
    { id: 'testata', t: 'Intestazione e scopo', body: 'Titolo, data e iniziali vivono in barra, in alto a sinistra: tocca l’intestazione per vederli e cambiarli (sul foglio A3 del libro stavano in alto a destra). Lo scopo in una frase: dalla richiesta X alla consegna Y. Una mappa = un processo solo: se cambia turno o unità, fai un’altra mappa, non una variante.', q: 'Cosa soddisfa esattamente questa mappa?', acts: [['title', 'Apri l’intestazione']] },
    { id: 'richiesta', t: 'La richiesta', body: 'Disegna il richiedente e tutte le vie reali con cui la richiesta arriva: telefono, fax, e-mail, a voce, di persona. La giungla di frecce in alto non è disordine da nascondere: è il primo spreco da attaccare, perché ogni via in più è una richiesta che può perdersi o essere fraintesa.', q: 'Quante mani tocca la richiesta prima di arrivare a chi eroga?', tools: [['person', 'Persona'], ['request', 'Richiesta']] },
    { id: 'flusso', t: 'Flusso e attese', body: 'Disegna i passi nell’ordine in cui avvengono davvero, non come dovrebbero: nello stato attuale ciò che sta nei box è valore adesso, si giudica dopo. Tra due passi metti sempre un delta se la cosa sta ferma. Più di 4-5 passi? Forse lo scopo è troppo largo.', q: 'Quale attività apre la porta del passo e quale la chiude?', tools: [['box', 'Passo'], ['delta', 'Attesa']] },
    { id: 'valida', t: 'Cammina e valida', body: 'Una mappa fatta alla scrivania è una bozza. Cammina il processo dall’inizio alla fine osservando, poi mostrala a chi fa il lavoro: accuratezza e adesione arrivano insieme. Le domande da fare sono due: «Ti sembra giusto? Ho lasciato fuori qualcosa?». Finché non l’hai fatto, la mappa resta provvisoria.', valida: true },
    { id: 'dati', t: 'Dati', body: 'Per ogni passo e ogni attesa raccogli Hi / Lo / Avg, un’unità sola per tutta la mappa. L’attesa non si cronometra: si calcola per differenza, fine del passo precedente → inizio del successivo. Servono ~30 misure per dati credibili, 8-10 per una prima vista; il massimo è dove si nascondono interruzioni e workaround. Per misurarli camminando il processo: ⋯ → «Misura i tempi ⏱» (o il ⏱ accanto ai tempi di un passo). Il cronometro segue la catena: tu chiudi il passo, l’attesa nasce da sé fino a quando cominci il successivo. Poi «Calcola i tempi» scrive Hi/Lo/Avg.', acts: [['misura', 'Apri il cronometro ⏱']], q: 'Perché a volte 5 minuti e a volte 19?' },
    { id: 'analisi', t: 'Analisi', body: 'Una nuvola su ogni punto debole, con muda e regola violata: una riga, non un tema. Comincia dalle nuvole a monte: correggere la richiesta rende più di quanto sembri. Quando senti «a volte, dipende, forse» il processo non è specificato — è già una nuvola.', q: 'Così accade adesso: è abbastanza buono?', tools: [['storm', 'Nuvola']] },
    { id: 'futuro', t: 'Ideale (stato futuro)', body: 'L’Ideale è dove volete arrivare: uno solo per processo, col lucchetto — una volta validato non si modifica finché non lo riapri. Dev’essere raggiungibile (persone, sponsor, data). Prima mossa quasi sempre: ridurre le vie della richiesta; poi eliminare o combinare passi; tempi standard solo dai dati raccolti. Se il futuro non è visibilmente più semplice dell’attuale, torna a osservare. E niente monumenti: non automatizzare ciò che non funziona a mano.', acts: [['future', 'Apri / crea l’Ideale']], cmp: true },
    { id: 'piano', t: 'Piano e follow-up', body: 'Ogni riga del piano: cosa, chi, entro quando, esito atteso; senza chi e quando non accadrà. L’ostacolo grosso merita un A3, non una riga di piano. A piano eseguito si rimisura: nuova mappa dello stato attuale e confronto fianco a fianco.', q: 'Chi fa cosa, entro quando?', acts: [['plan', 'Apri il piano']] }
  ];
  UI.guideFocusSec = null;
  UI.guideVisible = () => { const g = $('#guidepop'); return !!g && !g.classList.contains('hidden'); };
  UI.toggleGuide = (show, section) => {
    const g = $('#guidepop'); const want = show != null ? !!show : g.classList.contains('hidden');
    if (!want) UI.closeGuideCard();
    g.classList.toggle('hidden', !want);
    if (want) { UI.guideFocusSec = section || null; UI.renderGuide(); }
  };
  UI.renderGuide = () => {
    if (!UI.guideVisible()) return;
    const map = V.map(); const g = $('#guidepop'); const L = V.lint(map);
    const row = (sec, it, i) => `<button class="gp-item" data-card="${sec}:${it.id}">${sec === 'metodo' ? `<span class="gp-n">${i + 1}</span>` : '<span class="gp-dot"></span>'}${esc(it.t)}</button>`;
    let h = `<div class="gp-head"><b>Guida pratica</b><span class="spacer"></span><button class="btn small ghost" id="gp-x" aria-label="Chiudi">✕</button></div>`;
    h += `<div class="gp-sechead" data-sec="primi">Primi passi</div>` + PRIMI.map((it, i) => row('primi', it, i)).join('');
    h += `<div class="gp-sechead" data-sec="metodo">Il metodo</div>` + METODO.map((it, i) => row('metodo', it, i)).join('');
    h += `<div class="gp-sechead" data-sec="simboli">I simboli</div><div class="gp-grid">` + UI.SYMBOLS().map(s => `<button class="gp-chip" data-card="simboli:${s.id}"><span class="gp-glyph">${s.glyph}</span><span>${esc(s.name)}</span></button>`).join('') + `</div>`;
    h += `<div class="actions" style="padding:8px 10px 0"><button class="btn small" id="gp-example">Esempio</button></div>`;
    h += `<div class="gp-lint">${L.length ? L.slice(0, 10).map((x, i) => `<button class="chip ${x.level}" data-li="${i}">${x.level === 'bad' ? '✕' : '⚠'} ${esc(x.msg)}</button>`).join('') : '<span class="chip ok">✓ Nessun rilievo dai controlli. Chiedi al coach una revisione.</span>'}</div>`;
    h += `<label class="check gp-foot"><input type="checkbox" id="gp-sug" ${UI.guideOn ? 'checked' : ''}> <span>Suggerimenti discreti mentre disegni</span></label>`;
    g.innerHTML = h;
    $('#gp-x').onclick = () => UI.toggleGuide(false);
    $$('[data-card]', g).forEach(b => b.onclick = () => { const [sec, id] = b.dataset.card.split(':'); UI.openGuideCard(sec, id, b); });
    const ex = $('#gp-example'); if (ex) ex.onclick = () => { if (UI.loadExample) UI.loadExample(); };
    $$('[data-li]', g).forEach(b => b.onclick = () => { const x = L[+b.dataset.li]; if (x.elId) { UI.toggleGuide(false); I.select([x.elId]); R.flash(x.elId); } });
    $('#gp-sug').onchange = (e) => { UI.guideOn = e.target.checked; localStorage.setItem('vsm.guideOn', UI.guideOn ? '1' : '0'); };
    if (UI.guideFocusSec) { const s = g.querySelector(`[data-sec="${UI.guideFocusSec}"]`); if (s) g.scrollTop = UI.guideFocusSec === 'primi' ? 0 : Math.max(0, s.offsetTop - 44); UI.guideFocusSec = null; }
  };
  // ----- scheda flottante di una voce -----
  UI.guideCardOpen = () => !!$('#gpcard');
  UI.closeGuideCard = () => { const c = $('#gpcard'); if (c) c.remove(); };
  /** modalità «?» della barra: scheda che spiega l'elemento toccato, con gli stessi contenuti della Guida pratica */
  UI.showWhatIs = (el, cx, cy) => {
    const sym = UI.SYMBOLS().find(s => s.id === el.type);
    const T = V.TYPES[el.type];
    const name = sym ? sym.name : (T ? T.name : el.type);
    const body = sym ? sym.body : (T && T.why ? esc(T.why) : '');
    // dopo il giro del pointerdown globale (che chiude la scheda precedente), mai prima:
    // altrimenti la scheda appena aperta viene chiusa dallo stesso tocco che l'ha chiesta
    setTimeout(() => {
      UI.closeGuideCard();
      const c = document.createElement('div'); c.id = 'gpcard';
      c.innerHTML = `<div class="gpc-head">${sym ? `<span class="gp-glyph">${sym.glyph}</span>` : ''}<b>${esc(name)}</b><span class="spacer"></span><button class="btn small ghost" id="gpc-x" aria-label="Chiudi">✕</button></div><div class="gpc-body">${body}${sym && sym.vars ? `<div class="lg-var">${sym.vars}</div>` : ''}</div>`;
      document.body.appendChild(c);
      const chW = c.offsetWidth, chH = c.offsetHeight;
      c.style.left = Math.round(Math.max(8, Math.min(window.innerWidth - chW - 8, cx + 16))) + 'px';
      c.style.top = Math.round(Math.max(58, Math.min(window.innerHeight - chH - 10, cy - 24))) + 'px';
      $('#gpc-x').onclick = UI.closeGuideCard;
    }, 0);
  };
  /** Il testo di un problema ridotto al segno: un tocco sulla «i» e si legge, senza aprire il pannello
   *  (richiesta di Gt: «un tocco apre il testo, due aprono il menu»). Nasconderlo non è cancellarlo —
   *  il libro chiede di segnare TUTTI i problemi, e questa è la via per rileggerli sul foglio fitto. */
  UI.showStormText = (el, cx, cy) => {
    const p = el.props || {};
    const testo = String(p.text || '').trim();
    const sotto = [p.muda, p.rule ? 'regola ' + p.rule[0] : '', p.a3 ? 'candidato ad A3' : ''].filter(Boolean).join(' · ');
    setTimeout(() => {
      UI.closeGuideCard();
      const c = document.createElement('div'); c.id = 'gpcard';
      c.innerHTML = `<div class="gpc-head"><span class="gp-glyph">ⓘ</span><b>Problema</b><span class="spacer"></span><button class="btn small ghost" id="gpc-x" aria-label="Chiudi">✕</button></div>`
        + `<div class="gpc-body">${testo ? esc(testo) : '<i>Nessun testo scritto: aprilo con un secondo tocco e raccontalo.</i>'}${sotto ? `<div class="lg-var">${esc(sotto)}</div>` : ''}</div>`
        + `<div class="actions"><button class="btn small ghost" data-st-apri title="Rimetti il testo sul foglio">▽ Apri sul foglio</button><span style="flex:1"></span><button class="btn small primary" data-st-mod>Modifica</button></div>`;
      document.body.appendChild(c);
      const chW = c.offsetWidth, chH = c.offsetHeight;
      c.style.left = Math.round(Math.max(8, Math.min(window.innerWidth - chW - 8, cx + 16))) + 'px';
      c.style.top = Math.round(Math.max(58, Math.min(window.innerHeight - chH - 10, cy - 24))) + 'px';
      $('#gpc-x').onclick = UI.closeGuideCard;
      $('[data-st-mod]', c).onclick = () => { UI.closeGuideCard(); V.pop.open(el.id); };
      $('[data-st-apri]', c).onclick = () => { UI.closeGuideCard(); V.setStormMark(V.map(), el.id, false); };
    }, 0);
  };
  /** Il pop-up dell'occhio: si sbircia il foglio dietro il link senza entrarci. Dentro ci sono
   *  l'anteprima in piccolo (R.peekSVG: un'immagine ferma, non un canvas vivo — un canvas dentro un
   *  canvas è una trappola di gesti), la riga che dice che cosa contiene e il pulsante per aprire
   *  davvero. La riga nasce da V.describeMap e si ricalcola a ogni apertura; se qualcuno la riscrive
   *  diventa props.summary del passo e da quel momento è sua (↻ la rigenera). Si apre al RILASCIO
   *  del tocco (gesto 'peek'): mai interfaccia nuova sotto il dito a metà gesto. Riusa #gpcard,
   *  quindi si chiude toccando fuori come la scheda di «Cos'è?». */
  UI.showPeek = (boxId, cx, cy) => {
    const map = V.map(); const box = V.byId(boxId, map);
    const target = box && box.props.link && V.doc.maps[box.props.link];
    if (!target) { UI.toast('Mappa non trovata.'); return; }
    UI.closeGuideCard();
    const auto = V.describeMap(target);
    const custom = typeof box.props.summary === 'string' && box.props.summary.trim() ? box.props.summary : '';
    const ind = V.mapAddress(target);
    const c = document.createElement('div'); c.id = 'gpcard'; c.classList.add('peek');
    // la striscia del flusso (scelta di Gt: striscia sopra, disegno sotto): la catena del foglio
    // in una riga — passi numerati, ▼ col tempo dell'attesa fra l'uno e l'altro, ⑂ dove si divide.
    // Scorre di lato se è lunga. Senza frecce non c'è striscia: resta solo il disegno.
    const strip = V.flowStrip(target);
    const striscia = strip.length ? `<div class="peek-strip">${strip.map(t => {
      if (t.kind === 'box') return `<span class="ps-box"><b>${esc(t.n)}</b> ${esc(t.title || 'passo')}</span>`;
      if (t.kind === 'delta') return `<span class="ps-delta" title="attesa fra i due passi">▼${t.avg != null ? esc(fmt(t.avg)) : ''}</span>`;
      return `<span class="ps-fork" title="Il flusso si divide qui (dal passo ${esc(t.n)})">⑂${esc(t.n)}</span>`;
    }).join('<span class="ps-sep">→</span>')}</div>` : '';
    // foglio senza elementi: niente immagine del nulla, lo si dice a parole
    const anteprima = target.elements.length ? `<div class="peek-view">${R.peekSVG(target)}</div>`
      : `<div class="peek-view peek-empty">Foglio ancora vuoto: appena ci disegni qualcosa, qui vedi l'anteprima.</div>`;
    c.innerHTML = `<div class="gpc-head"><b>${ind ? `<span class="ind" title="${esc(ind)}">${esc(V.shortAddress(ind))}</span> ` : ''}${esc(target.title || 'senza titolo')}</b><span class="spacer"></span><button class="btn small ghost" id="gpc-x" aria-label="Chiudi">✕</button></div>`
      + striscia
      + anteprima
      + `<div class="field"><label for="peek-sum">Che cosa contiene</label><textarea id="peek-sum" rows="2">${esc(custom || auto)}</textarea></div>`
      + `<div class="hint">${custom ? 'Riscritta da te: non si aggiorna più da sola. ↻ la riporta a quella del foglio.' : 'Generata dal foglio: resta vera da sola finché non la riscrivi.'}</div>`
      + `<div class="actions"><button class="btn small ghost" id="peek-regen" title="Rigenera la descrizione dal foglio" aria-label="Rigenera la descrizione">↻</button><span style="flex:1"></span><button class="btn small primary" id="peek-open">Apri il foglio ↗</button></div>`;
    document.body.appendChild(c);
    const chW = c.offsetWidth, chH = c.offsetHeight;
    c.style.left = Math.round(Math.max(8, Math.min(window.innerWidth - chW - 8, (cx == null ? window.innerWidth / 2 : cx) + 16))) + 'px';
    c.style.top = Math.round(Math.max(58, Math.min(window.innerHeight - chH - 10, (cy == null ? 120 : cy) - 24))) + 'px';
    $('#gpc-x', c).onclick = UI.closeGuideCard;
    $('#peek-open', c).onclick = () => { UI.closeGuideCard(); UI.openMap(box.props.link); };
    const sum = $('#peek-sum', c), regen = $('#peek-regen', c);
    if (map.validated) { sum.disabled = true; regen.disabled = true; } // lucchetto chiuso: si guarda, non si scrive
    // una voce di annulla per riscrittura (dal focus al cambio), come i campi del pop-up. Vuota o
    // uguale a quella automatica = chiave tolta: la descrizione torna a ricalcolarsi a ogni sguardo,
    // perché una descrizione scritta a mano invecchia quando il foglio sotto cambia.
    let before;
    sum.addEventListener('focus', () => { before = box.props.summary; });
    sum.addEventListener('change', () => {
      const v = sum.value.trim();
      const after = (!v || v === auto) ? undefined : v;
      if (after === box.props.summary || (after === undefined && box.props.summary == null)) return;
      V.commit({ t: 'props', id: boxId, after: { summary: after }, before: { summary: before } }, 'descrizione del sotto-foglio');
    });
    regen.onclick = () => {
      if (box.props.summary == null) { sum.value = auto; return; }
      V.commit({ t: 'props', id: boxId, after: { summary: undefined }, before: { summary: box.props.summary } }, 'descrizione del sotto-foglio');
      sum.value = auto;
    };
  };
  /** Il nome proposto per un sotto-foglio: il titolo del passo, se c'è. Un passo appena disegnato il
   *  titolo non ce l'ha quasi mai, e «dettaglio» ripetuto rendeva la cartina un elenco di rami tutti
   *  uguali: al suo posto va l'indirizzo che V.stepNumbers calcola già («Dentro il passo 2»). */
  const nomeProposto = (map, box) => {
    const p = (box && box.props) || {};
    const t = String(p.title || p.text || '').trim();
    if (t) return t;
    const n = V.stepNumbers(map).get(box && box.id);
    return n ? `Dentro il passo ${n}` : 'Sotto-foglio';
  };
  /** Scheda che chiede il nome di un sotto-foglio prima di crearlo: il campo contiene già il nome
   *  proposto, selezionato — un tocco su «Crea» conferma, riscrivere cancella e sostituisce.
   *  Se il passo ha attività, sotto il nome compaiono con una spunta ciascuna (tutte spuntate):
   *  ogni spunta diventa un passo del foglio nuovo, in fila e già collegato (spec 2026-08-21 —
   *  le attività sono la scaletta del sotto-foglio). Nessuna spunta = foglio vuoto, come oggi.
   *  Gli indici degli spuntati vanno al chiamante come secondo argomento: null se l'elenco non
   *  c'era (passo senza attività → creazione identica a prima).
   *  Riusa #gpcard (si chiude anche toccando fuori). Si apre alla scelta di una voce di menu o di un
   *  pulsante (gesto finito), mai a metà di un trascinamento sul canvas. */
  UI.askNomeSottoFoglio = (proposto, onOk, onNo, attivita) => {
    UI.closeGuideCard(); UI.hideQuick();
    // lo stesso elenco pulito su cui conta V.buildDetailFromActivities: indici allineati
    const acts = (attivita || []).map(a => String(a).trim()).filter(Boolean);
    const c = document.createElement('div'); c.id = 'gpcard';
    c.innerHTML = `<div class="gpc-head"><b>Nome del sotto-foglio</b><span class="spacer"></span><button class="btn small ghost" id="gpc-x" aria-label="Chiudi">✕</button></div>`
      + `<div class="gpc-body">È il nome che si leggerà nella cartina e nelle sottoschede. Quello del passo è già scritto: confermalo, o riscrivilo.</div>`
      + `<div class="field"><label>Nome</label><input data-dn value="${esc(proposto)}" autocomplete="off"></div>`
      + (acts.length ? `<div class="field"><label>Dentro ci metto un passo per ogni attività:</label><div class="dn-acts">${acts.map((a, i) => `<label class="check"><input type="checkbox" data-act="${i}" checked><span>${i + 1}. ${esc(a)}</span></label>`).join('')}</div></div>` : '')
      + `<div class="actions"><button class="btn small primary" id="dn-ok">Crea ↗</button><button class="btn small ghost" id="dn-no">Annulla</button></div>`;
    document.body.appendChild(c);
    const chW = c.offsetWidth, chH = c.offsetHeight;
    c.style.left = Math.round(Math.max(8, (window.innerWidth - chW) / 2)) + 'px';
    c.style.top = Math.round(Math.max(58, Math.min(window.innerHeight - chH - 10, 120))) + 'px';
    const inp = c.querySelector('[data-dn]');
    // su touch niente focus automatico: la tastiera coprirebbe la scheda prima ancora di leggerla
    if (!('ontouchstart' in window)) { inp.focus(); inp.select(); }
    const no = () => { UI.closeGuideCard(); if (onNo) onNo(); };
    $('#gpc-x', c).onclick = no;
    $('#dn-no', c).onclick = no;
    const ok = () => {
      const v = inp.value.trim() || proposto;
      const indici = acts.length ? $$('input[data-act]', c).filter(x => x.checked).map(x => +x.dataset.act) : null;
      UI.closeGuideCard(); onOk(v, indici);
    };
    $('#dn-ok', c).onclick = ok;
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ok(); } });
  };
  /** «In un sotto-foglio» sposta davvero: gli elementi spariscono dal foglio e al loro posto resta
   *  un passo con ↗. Prima di farlo lo si dice a parole, con la via d'uscita («Annulla» qui,
   *  ↩ dopo). Riusa #gpcard: si chiude anche toccando fuori, come la scheda di «Cos'è?».
   *  Si apre al clic sulla voce del menu (gesto finito), mai a metà di un trascinamento. */
  UI.confirmSheetify = (ids) => {
    const map = V.map();
    const n = ids.filter(id => { const el = V.byId(id, map); return el && !V.isConnector(el) && el.type !== 'lane'; }).length;
    UI.closeGuideCard(); UI.hideQuick();
    // il nome proposto è quello del primo passo della selezione (per indirizzo): è lui che il passo
    // riassuntivo andrà a sostituire nella catena, quindi è il suo nome che la cartina deve ereditare
    const nums = V.stepNumbers(map);
    const prima = ids.map(x => V.byId(x, map)).filter(e => e && e.type === 'box')
      .sort((a, b) => (nums.get(a.id) || '999').localeCompare(nums.get(b.id) || '999', undefined, { numeric: true }))[0];
    const c = document.createElement('div'); c.id = 'gpcard';
    c.innerHTML = `<div class="gpc-head"><b>In un sotto-foglio</b><span class="spacer"></span><button class="btn small ghost" id="gpc-x" aria-label="Chiudi">✕</button></div>`
      + `<div class="gpc-body">${n} elementi si spostano in un nuovo foglio di dettaglio. Al loro posto, su questo foglio, resta un passo con ↗ che porta lì. Se non era quello che volevi: «Annulla» qui, o ↩ dopo lo spostamento.</div>`
      + `<div class="field"><label>Nome del sotto-foglio (e del passo che resta)</label><input data-shf-nome value="${esc(nomeProposto(map, prima))}" autocomplete="off"></div>`
      + `<div class="actions"><button class="btn small primary" id="shf-ok">Sposta ↗</button><button class="btn small ghost" id="shf-no">Annulla</button></div>`;
    document.body.appendChild(c);
    const chW = c.offsetWidth, chH = c.offsetHeight;
    c.style.left = Math.round(Math.max(8, (window.innerWidth - chW) / 2)) + 'px';
    c.style.top = Math.round(Math.max(58, Math.min(window.innerHeight - chH - 10, 120))) + 'px';
    // chiudere senza spostare riporta il menu del gruppo: la selezione non si è mossa
    const chiudi = () => { UI.closeGuideCard(); UI.onSelection(I.selection); };
    $('#gpc-x', c).onclick = chiudi;
    $('#shf-no', c).onclick = chiudi;
    $('#shf-ok', c).onclick = () => { const nome = c.querySelector('[data-shf-nome]').value; UI.closeGuideCard(); I.groupToDetail(ids, nome); };
  };
  UI.openGuideCard = (sec, id, anchor) => {
    UI.closeGuideCard();
    const map = V.map();
    const it = sec === 'simboli' ? UI.SYMBOLS().find(s => s.id === id) : (sec === 'primi' ? PRIMI : METODO).find(s => s.id === id);
    if (!it) return;
    let b = `<div class="gpc-body">${it.body}`;
    if (it.q) b += `<div class="gp-q">${esc(it.q)}</div>`;
    if (it.valida) {
      b += `<label class="check" style="margin-top:8px"><input type="checkbox" id="gp-walked" ${map.validation.walked ? 'checked' : ''}> <span>Processo camminato (osservazione diretta)</span></label>`
        + `<div class="field" style="margin-top:4px"><label>Validata da (chi fa il lavoro)</label><input id="gp-validated" value="${esc(map.validation.validatedBy || '')}" autocomplete="off"></div>`;
    }
    if (it.cmp) {
      const f = V.futureOf(map); const cur = V.currentOf(map) || map;
      if (f) { const fm = V.metrics(f), cm = V.metrics(cur); b += `<div class="cmp" style="margin-top:8px"><span class="h"></span><span class="h">Attuale</span><span class="h">Futuro</span><span class="h"></span>${cmpRow('Vie di richiesta', cm.requests, fm.requests)}${cmpRow('Process box', cm.boxes, fm.boxes)}${cmpRow('Tempo totale', cm.hasData ? cm.tot : null, fm.hasData ? fm.tot : null)}${cmpRow('NVA (attese)', cm.hasData ? cm.nva : null, fm.hasData ? fm.nva : null)}${cmpRow('VA %', cm.vaPct, fm.vaPct, false)}</div>`; }
    }
    if (it.vars) b += `<div class="lg-var">${it.vars}</div>`;
    const btns = (it.tools || []).map(t => `<button class="btn small" data-tool-go="${t[0]}">${t[1]}</button>`)
      .concat((it.acts || []).map(a => `<button class="btn small" data-ga="${a[0]}">${a[1]}</button>`)
      .concat(sec === 'simboli' && it.tool ? [`<button class="btn small primary" data-tool-go="${it.tool}">Usa lo strumento</button>`] : []));
    if (btns.length) b += `<div class="actions" style="margin-top:10px">${btns.join('')}</div>`;
    b += '</div>';
    const c = document.createElement('div'); c.id = 'gpcard';
    c.innerHTML = `<div class="gpc-head">${sec === 'simboli' ? `<span class="gp-glyph">${it.glyph}</span>` : ''}<b>${esc(it.t || it.name)}</b><span class="spacer"></span><button class="btn small ghost" id="gpc-x" aria-label="Chiudi">✕</button></div>` + b;
    document.body.appendChild(c);
    // accanto al pannello, allineata alla voce toccata; su schermi stretti diventa un foglio centrale
    const pr = $('#guidepop').getBoundingClientRect(); const ar = anchor.getBoundingClientRect();
    if (window.innerWidth < 700 || pr.left < 300) c.classList.add('sheet');
    else {
      c.style.right = Math.round(window.innerWidth - pr.left + 8) + 'px';
      const chH = c.offsetHeight;
      c.style.top = Math.round(Math.max(58, Math.min(window.innerHeight - chH - 10, ar.top - 8))) + 'px';
    }
    $('#gpc-x').onclick = UI.closeGuideCard;
    $$('[data-tool-go]', c).forEach(x => x.onclick = () => { UI.closeGuideCard(); UI.toggleGuide(false); I.setTool(x.dataset.toolGo); });
    $$('[data-ga]', c).forEach(x => x.onclick = () => { const a = x.dataset.ga; UI.closeGuideCard(); UI.toggleGuide(false); if (a === 'title') V.pop.openTitle(); else if (a === 'plan') UI.showTab('plan'); else if (a === 'future') $('#tab-future').click(); else if (a === 'misura') UI.openMisura(); });
    const wk = $('#gp-walked', c); if (wk) wk.onchange = () => { const after = Object.assign(clone(V.map().validation), { walked: wk.checked, walkedDate: wk.checked ? today() : '' }); V.commit({ t: 'meta', after: { validation: after } }, 'validazione', { silent: true }); };
    const vd = $('#gp-validated', c); if (vd) vd.addEventListener('input', () => { const after = Object.assign(clone(V.map().validation), { validatedBy: vd.value, validatedDate: vd.value ? today() : '' }); V.commit({ t: 'meta', after: { validation: after } }, 'validazione', { silent: true }); });
  };
  function cmpRow(label, a, b, lowerBetter = true) { const cls = (a == null || b == null) ? '' : (lowerBetter ? (b < a ? 'good' : b > a ? 'badv' : '') : (b > a ? 'good' : b < a ? 'badv' : '')); return `<span>${label}</span><span>${a == null ? '–' : fmt(a)}</span><span>${b == null ? '–' : fmt(b)}</span><span class="${cls}">${cls === 'good' ? '▼ meglio' : cls === 'badv' ? '▲ peggio' : '='}</span>`; }

  // ---------- piano ----------
  UI.renderPlan = () => {
    const map = V.map(); const body = $('#plan-body');
    let h = `<div class="coachnote"><b>Piano dello stato futuro</b>Ogni riga: What / Who / When / Outcome. Nessun impegno verbale senza data ed esito. Revisione periodica: in tempo? ritardo e ripianificazione? da scartare?</div>`;
    h += `<table class="plan"><thead><tr><th>#</th><th>What</th><th>Who</th><th>When</th><th>Outcome</th><th>A3</th><th></th></tr></thead><tbody>${map.plan.map((r, i) => `<tr><td>${i + 1}</td><td><input data-pi="${i}" data-pk="what" value="${esc(r.what)}"></td><td><input data-pi="${i}" data-pk="who" value="${esc(r.who)}"></td><td><input data-pi="${i}" data-pk="when" type="date" value="${esc(r.when)}"></td><td><input data-pi="${i}" data-pk="outcome" value="${esc(r.outcome)}"></td><td><input type="checkbox" data-pi="${i}" data-pk="a3" ${r.a3 ? 'checked' : ''}></td><td><button class="btn small ghost danger" data-pdel="${i}" aria-label="Elimina riga ${i + 1}">×</button></td></tr>`).join('')}</tbody></table><p><button class="btn" id="plan-add">+ Aggiungi riga</button></p>`;
    h += `<div class="field" style="max-width:220px"><label>Rimisurazione (nuova mappa attuale, a 1-3-6 mesi)</label><input id="plan-remeasure" type="date" value="${esc(map.closure.remeasureDate || '')}"></div>`;
    body.innerHTML = h;
    $('#plan-add').onclick = () => { const plan = clone(map.plan); plan.push({ id: uid(), what: '', who: '', when: '', outcome: '', a3: false }); V.commit({ t: 'plan_set', after: plan }, 'piano'); UI.renderPlan(); };
    $('#plan-remeasure').onchange = (e) => { const after = Object.assign(clone(V.map().closure), { remeasureDate: e.target.value }); V.commit({ t: 'meta', after: { closure: after } }, 'piano', { silent: true }); };
    $$('[data-pdel]', body).forEach(b => b.onclick = () => { const plan = clone(map.plan); plan.splice(+b.dataset.pdel, 1); V.commit({ t: 'plan_set', after: plan }, 'piano'); UI.renderPlan(); });
    $$('[data-pi]', body).forEach(e => e.addEventListener(e.type === 'checkbox' || e.type === 'date' ? 'change' : 'input', () => { const plan = clone(map.plan); plan[+e.dataset.pi][e.dataset.pk] = e.type === 'checkbox' ? e.checked : e.value; V.commit({ t: 'plan_set', after: plan }, 'piano', { silent: true }); }));
  };

  // ---------- cassetto ----------
  UI.showTab = (name) => { $('#drawer').classList.remove('closed'); ['coach', 'plan'].forEach(t => { $('#tab-' + t).setAttribute('aria-selected', t === name); $('#pane-' + t).classList.toggle('hidden', t !== name); }); if (name === 'plan') UI.renderPlan(); if (name === 'coach') setTimeout(() => { const c = $('#chat'); c.scrollTop = 1e9; }, 0); };
  UI.closeDrawer = () => { $('#drawer').classList.add('closed'); };

  // ---------- interfaccia nascosta ("schermo pulito"): resta il foglio; si mostra e si nasconde solo col pulsante ----------
  UI.setChrome = (visible, opts = {}) => {
    const app = $('#app'); const hidden = !visible;
    app.classList.toggle('clean', hidden);
    const b = $('#ui-toggle');
    if (b) { b.setAttribute('aria-pressed', hidden ? 'true' : 'false'); b.textContent = hidden ? '⇲' : '⇱'; const lbl = hidden ? 'Mostra l\'interfaccia' : 'Nascondi l\'interfaccia (più foglio)'; b.title = lbl; b.setAttribute('aria-label', lbl); }
    if (hidden) { UI.closeDrawer(); UI.hideSuggest && UI.hideSuggest(); $('#more-tools').classList.add('hidden'); $('#menu').classList.add('hidden'); UI.toggleGuide && UI.toggleGuide(false); }
    try { localStorage.setItem('vsm.chrome', hidden ? '0' : '1'); } catch (e) { /* storage bloccato */ }
    if (opts.hint !== false && hidden) I.hint('Interfaccia nascosta: tocca ⇲ in alto a sinistra per riaverla. Resta così finché non lo ripremi.', 3500);
    if (V.render && V.interact) V.interact.applyView();
  };
  UI.chromeVisible = () => !$('#app').classList.contains('clean');
  UI.toggleChrome = () => UI.setChrome(!UI.chromeVisible());

  /** barra strumenti ripiegata: resta solo la linguetta a bordo schermo, un tocco la riapre */
  UI.setPaletteHidden = (on, opts = {}) => {
    $('#app').classList.toggle('palette-hidden', !!on);
    if (on) $('#more-tools').classList.add('hidden');
    const b = $('#palette-toggle');
    if (b) { b.setAttribute('aria-pressed', on ? 'true' : 'false'); const lbl = on ? 'Mostra gli strumenti' : 'Nascondi gli strumenti'; b.title = lbl; b.setAttribute('aria-label', lbl); }
    if (!opts.quiet) UI.toast(on ? 'Strumenti ripiegati: la linguetta › li riporta.' : 'Strumenti aperti.');
    try { localStorage.setItem('vsm.paletteHidden', on ? '1' : '0'); } catch (e) { /* storage bloccato */ }
  };

  /** strumenti in colonna a sinistra invece che in basso al centro (in basso coprono la timeline) */
  UI.setToolsLeft = (on) => {
    $('#app').classList.toggle('tools-left', !!on);
    $('#more-tools').classList.add('hidden');
    UI.menuCheck && UI.menuCheck('#btn-tools-left', !!on);
    try { localStorage.setItem('vsm.toolsLeft', on ? '1' : '0'); } catch (e) { /* storage bloccato */ }
    if (V.pop && V.pop.current && V.pop.current !== '__title__') { const el = V.byId(V.pop.current); if (el) V.pop.place(el); }
    UI.onSelection && UI.onSelection(I.selection);
  };

  // ---------- suggerimenti di strumento (regole locali; il coach usa lo stesso canale) ----------
  const readSugDismissed = () => { try { return JSON.parse(localStorage.getItem('vsm.sug.off') || '{}'); } catch (e) { return {}; } };
  const SUG = { shownAt: {}, current: null, dismissed: readSugDismissed(), count: 0 };
  const RULESUG = [
    { id: 'requestor', when: (M, map) => M.boxes >= 1 && !map.elements.some(e => e.type === 'person' && e.props.requestor), tool: 'person', msg: 'Chi fa la richiesta? Metti l\'omino del richiedente in alto a destra.' },
    { id: 'request', when: (M, map) => map.elements.some(e => e.type === 'person' && e.props.requestor) && M.boxes >= 1 && M.requests === 0, tool: 'request', msg: 'Come arriva la richiesta? Traccia una via di richiesta dall\'omino al primo passo (una per ogni via reale).' },
    { id: 'flow', when: (M) => M.boxes >= 2 && M.flows === 0, tool: 'flow', msg: 'Collega i box con le frecce di flusso: da lì nasce l\'ordine del processo e la timeline.' },
    { id: 'delta', when: (M) => M.boxes >= 2 && M.flows >= 1 && M.deltas === 0, tool: 'delta', msg: 'Tra un box e il successivo, quando nulla avanza? Aggiungi un delta sulla freccia.' },
    { id: 'data', when: (M) => M.boxes >= 2 && M.deltas >= 1 && !M.hasData, tool: 'select', msg: 'Ora i tempi: tocca un box o un delta e inserisci Hi / Lo / Avg (una sola unità).' },
    { id: 'storm', when: (M) => M.hasData && M.storms === 0, tool: 'storm', msg: 'Che cosa non è ideale? Segna i problemi con le nuvole temporalesche (muda + regola).' },
    { id: 'future', when: (M, map) => map.kind === 'current' && M.storms >= 2 && M.hasData && !V.futureOf(map), tool: null, msg: 'Con nuvole e dati sei pronto per l’Ideale (lo stato futuro): tocca «Ideale» in alto.' }
  ];
  UI.evalSuggest = () => {
    if (!UI.suggestOn || !UI.guideOn) return; if (SUG.current) return; const map = V.map(); const M = V.metrics(map); const now = Date.now();
    for (const r of RULESUG) { if (SUG.dismissed[r.id]) continue; if (SUG.shownAt[r.id] && now - SUG.shownAt[r.id] < 10 * 60 * 1000) continue; if (r.when(M, map)) { UI.showSuggest(r.tool, r.msg, r.id); SUG.shownAt[r.id] = now; return; } }
  };
  UI.showSuggest = (tool, msg, ruleId) => {
    const s = $('#suggest'); SUG.current = { tool, ruleId }; $$('#palette .tool, #more-tools .tool').forEach(b => b.classList.toggle('suggest', b.dataset.tool === tool));
    s.innerHTML = `<span>${esc(msg)}</span>${tool ? `<button id="sug-go">Usa lo strumento</button>` : ''}${ruleId ? `<button class="x" id="sug-off" title="Non mostrare più questo suggerimento" aria-label="Non mostrare più">⊘</button>` : ''}<button class="x" id="sug-x" title="Chiudi" aria-label="Chiudi suggerimento">✕</button>`; s.classList.remove('hidden');
    const go = $('#sug-go'); if (go) go.onclick = () => { I.setTool(tool); UI.hideSuggest(); };
    $('#sug-x').onclick = UI.hideSuggest; const off = $('#sug-off'); if (off) off.onclick = () => { SUG.dismissed[ruleId] = true; localStorage.setItem('vsm.sug.off', JSON.stringify(SUG.dismissed)); UI.hideSuggest(); };
    clearTimeout(SUG.timer); SUG.timer = setTimeout(UI.hideSuggest, 14000);
  };
  UI.hideSuggest = () => { $('#suggest').classList.add('hidden'); $$('#palette .tool.suggest, #more-tools .tool.suggest').forEach(b => b.classList.remove('suggest')); SUG.current = null; };
  UI.hideSuggestIfTool = (t) => { if (SUG.current && SUG.current.tool === t) UI.hideSuggest(); };
  // ---------- azioni rapide contestuali: menu di icone rotonde attorno all'elemento selezionato ----------
  // Q.menu: quando «Collega» apre il suo arco, il menu delle azioni lascia il posto a quello dei
  // bersagli (stesso stile, stessa posizione). null = si vedono le azioni normali dell'elemento.
  const Q = { el: null, menu: null };
  // un'icona per azione (la lista delle azioni resta UI.actionList: la stessa fonte serve anche il pop-up)
  const QICN = {
    next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h6M7 9l3 3-3 3"/><rect x="13" y="5" width="8" height="14" rx="1"/></svg>',
    delta: IC.delta, deltaOn: IC.delta,
    cloud: IC.storm,
    connect: IC.flow,
    request: IC.request,
    attach: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 14.5l5-5"/><path d="M8.5 11.5l-2.2 2.2a3.2 3.2 0 104.5 4.5l2.2-2.2"/><path d="M15.5 12.5l2.2-2.2a3.2 3.2 0 10-4.5-4.5L11 8"/></svg>',
    invert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h12M13 5l3 3-3 3M20 16H8M11 13l-3 3 3 3"/></svg>',
    shrink: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4l9 16H3z"/><path d="M12 11v4"/><circle cx="12" cy="17.6" r=".4" fill="currentColor"/></svg>',
    expand: IC.storm,
    dup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="1.5"/><path d="M16 4.5H6A1.5 1.5 0 004.5 6v10" stroke-linecap="round"/></svg>',
    legend: IC.legend,
    legendfull: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/></svg>',
    straighten: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none"/><path d="M7 12h10"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="6" y="11" width="12" height="9" rx="1.5"/><path d="M9 11V8a3 3 0 016 0v3"/></svg>',
    unpin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="6" y="11" width="12" height="9" rx="1.5"/><path d="M9 11V8a3 3 0 015.6-1.5" stroke-linecap="round"/></svg>',
    lockto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 14.5l5-5"/><path d="M8.5 11.5l-2.2 2.2a3.2 3.2 0 104.5 4.5l2.2-2.2"/><path d="M15.5 12.5l2.2-2.2a3.2 3.2 0 10-4.5-4.5L11 8"/></svg>',
    unlock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7.5 13.5l-1.2 1.2a3.2 3.2 0 104.5 4.5l1.2-1.2"/><path d="M16.5 10.5l1.2-1.2a3.2 3.2 0 10-4.5-4.5L12 6"/><path d="M10.2 10.2l.9.9M13 13l.9.9" stroke-width="1.4"/></svg>',
    selkids: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="16" height="16" rx="2" stroke-dasharray="3 2"/><rect x="8.5" y="8.5" width="7" height="7" rx="1"/></svg>',
    sheetify: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/></svg>',
    del: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7h14M10 7V5h4v2"/><path d="M7 7l1 13h8l1-13"/><path d="M10.5 11v5M13.5 11v5"/></svg>',
    peek: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M2.5 12Q12 4.8 21.5 12Q12 19.2 2.5 12Z"/><circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none"/></svg>'
  };
  QICN.lockall = QICN.lockto; QICN.unlockall = QICN.unlock; QICN.unlockkids = QICN.unlock; QICN.dupall = QICN.dup;
  // voci del menu di «Collega» (secondo arco): i verbi dell'omino e i bersagli
  QICN['cx-chiede'] = IC.request; QICN['cx-sireca'] = IC.person;
  QICN['cx-box'] = IC.box; QICN['cx-inventory'] = IC.inventory; QICN['cx-inbox'] = IC.inbox;
  QICN['cx-back'] = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12H5M10 7l-5 5 5 5"/></svg>';
  // etichette corte sotto l'icona (poche parole: la spiegazione intera resta nel title)
  const QLBL = { next: 'Passo', delta: 'Attesa', deltaOn: 'Attesa', cloud: 'Problema', connect: 'Collega', request: 'Richiesta', attach: 'Aggancia', invert: 'Inverti', shrink: 'Segnale', expand: 'Espandi', dup: 'Duplica', dupall: 'Duplica', legend: 'Apri', legendfull: 'Simboli', straighten: 'Raddrizza', pin: 'Blocca', unpin: 'Sblocca', lockto: 'Lega', lockall: 'Lega', unlock: 'Slega', unlockall: 'Slega', unlockkids: 'Slega', selkids: 'Gruppo', sheetify: 'Dettaglio', peek: 'Sbircia', del: 'Elimina',
    'cx-chiede': 'Chiede', 'cx-sireca': 'Si reca', 'cx-box': 'Passo', 'cx-inventory': 'Scorta', 'cx-inbox': 'In-box', 'cx-back': 'Indietro' };
  const qBtn = (a, el) => {
    // due azioni cambiano verso con lo stato dell'elemento: l'icona e l'etichetta seguono
    let key = a.id;
    if (a.id === 'shrink' && el && el.props.collapsed) key = 'expand';
    if (a.id === 'legend' && el && !el.props.collapsed) return `<button class="pm-btn" data-qa="legend" title="${esc(a.title || a.label)}">${IC.legend}<span>Chiudi</span></button>`;
    return `<button class="pm-btn${a.id === 'del' ? ' danger' : ''}" data-qa="${a.id}" title="${esc(a.title || a.label)}">${QICN[key] || ''}<span>${esc(QLBL[key] || a.label)}</span></button>`;
  };
  UI.hideQuick = () => { const q = $('#quick'); if (q) { q.classList.add('hidden'); Q.menu = null; } };
  /** Esc dentro il menu di «Collega» torna all'arco precedente invece di chiudere tutto */
  UI.quickMenuBack = () => { if (!Q.menu || !Q.el || !V.byId(Q.el)) { Q.menu = null; return false; } UI.quickAction('cx-back', Q.el); return true; };
  UI.onView = () => { if (Q.el && !$('#quick').classList.contains('hidden')) UI.positionQuick(); if (V.pop.current && V.pop.current !== '__title__') { const el = V.byId(V.pop.current); if (el) V.pop.place(el); } };
  /** dispone i bottoni rotondi ad arco attorno all'ancora (sopra l'elemento): pochi = ventaglio in alto
   *  come il menu del vuoto; tanti = l'arco si allarga fin quasi al cerchio pieno, col raggio che cresce
   *  quel tanto che basta a non farli toccare. Ricalcolato a ogni pan/zoom (UI.onView). */
  UI.positionQuick = () => {
    const q = $('#quick'); const map = V.map(); const el = V.byId(Q.el, map); if (!el) { q.classList.add('hidden'); return; }
    const btns = $$('.pm-btn', q); const n = btns.length; if (!n) return;
    const st = $('#stage').getBoundingClientRect(); let ax, ay, hpx;
    if (V.isConnector(el)) { const Pc = R.connPath(el, map); ax = Pc.mid.x; ay = Math.min(Pc.a.y, Pc.b.y, Pc.mid.y) - 22; hpx = 44 * I.view.k; }
    else { const p = R.elPos(el, map); ax = p.x + el.w / 2; ay = p.y; hpx = ((R.elSize ? R.elSize(el).h : el.h) || 20) * I.view.k; }
    const s = I.toScreen(ax, ay);
    // L'arco resta sopra la testa dell'elemento: quando le azioni sono tante si allarga il RAGGIO,
    // non l'apertura. Con 300° i bottoni scendevano ai fianchi e - su un passo alto 78 - due di essi
    // finivano in mezzo al disegno, col dito che copriva proprio quello su cui si stava lavorando.
    const MAXARC = Math.PI * 1.1; // poco oltre il mezzo giro: gli estremi restano all'altezza dell'ancora
    const RMAX = 150;
    let step = 0.84, R0 = 74; // ~48° a raggio 74: bottoni da 54 px che non si toccano
    if (n > 1 && (n - 1) * step > MAXARC) {
      step = MAXARC / (n - 1);
      R0 = Math.min(RMAX, Math.max(74, Math.ceil(29 / Math.sin(step / 2))));
    }
    const reach = R0 + 30;
    const wraps = (n - 1) * step > Math.PI; // l'arco scende anche sotto l'ancora
    let base = -Math.PI / 2, cx = s.x, cy = s.y - 10;
    if (!wraps && cy - reach < 8) { base = Math.PI / 2; cy = s.y + hpx + 14; } // niente spazio sopra: si apre sotto
    if (st.width > 2 * reach + UI.leftInset()) cx = Math.max(UI.leftInset() + reach, Math.min(st.width - reach, cx));
    else cx = Math.max(UI.leftInset() + 8, Math.min(st.width - 8, cx)); // schermo stretto: almeno non si taglia
    if (wraps) cy = Math.max(reach + 8, Math.min(st.height - reach - 8, cy));
    else cy = base < 0 ? Math.max(reach + 8, cy) : Math.min(st.height - reach - 8, cy);
    q.style.left = cx + 'px'; q.style.top = cy + 'px';
    btns.forEach((b, i) => { const a = base + (i - (n - 1) / 2) * step; b.style.left = Math.round(Math.cos(a) * R0) + 'px'; b.style.top = Math.round(Math.sin(a) * R0) + 'px'; });
  };
  /** mette in scena un arco di bottoni: una sola strada per le azioni normali e per i menu di «Collega» */
  const paintQuick = (html) => {
    const q = $('#quick'); q.innerHTML = html; q.classList.remove('hidden'); UI.positionQuick();
    $$('[data-qa]', q).forEach(b => b.onclick = (ev) => { ev.stopPropagation(); UI.quickAction(b.dataset.qa, Q.el); });
  };
  UI.showQuick = (el, acts) => { Q.el = el.id; paintQuick(acts.map(a => qBtn(a, el)).join('')); };
  /** Il menu di «Collega». Non è mai vuoto: «Passo» c'è sempre, anche quando sul foglio non c'è nessun
   *  altro bersaglio da toccare — era il caso del passo unico, in cui «Collega» accendeva la modalità di
   *  puntamento e non restava niente da puntare. Per l'omino il primo arco sono i verbi: da lui parte
   *  una via che «chiede» oppure una in cui la persona «si reca», e sono due segni diversi sul foglio.
   *  «Sul foglio» non è più una voce: se c'è qualcosa da toccare la scelta è GIÀ armata all'apertura
   *  (armSheetPick), e il menu resta lì per le altre strade — toccare un elemento collega e basta. */
  UI.connectMenu = (el, map, bersagli) => {
    const A = []; const btn = (id, label, title) => A.push({ id, label, title: title || label });
    if (el.type === 'person' && !bersagli) {
      V.INTENTS.forEach(x => btn('cx-' + (x.id === 'si reca' ? 'sireca' : x.id), x.name, x.hint));
      return A;
    }
    const ctype = el.type === 'person' ? 'request' : 'flow';
    const kinds = I.connTargetsFrom(ctype, el.type); // da scorta/in-box ha senso solo il passo
    kinds.forEach(k => btn('cx-' + k, PLACE_LBL[k] || V.TYPES[k].name, V.TYPES[k].name + ' nuovo, che nasce già collegato'));
    btn('cx-back', 'Indietro', el.type === 'person' ? 'Torna alla scelta del verbo' : 'Torna alle azioni di questo elemento');
    return A;
  };
  /** Arma la scelta sul foglio senza chiudere il menu: il menu sta in un elemento HTML sopra
   *  l'svg, quindi i suoi bottoni restano toccabili e non si confondono con un tocco «sul foglio». */
  const armSheetPick = (el, map, ctype, intent) => {
    const kinds = I.connTargetsFrom(ctype, el.type);
    const some = map.elements.some(x => !V.isConnector(x) && x.id !== el.id && kinds.includes(x.type));
    if (some) I.startPickConnect(el.id, ctype, { intent, keepMenu: true });
  };
  /** la scelta sul foglio si spegne (tocco sul vuoto, Esc, cambio strumento): il giro «Collega»
   *  è finito e si torna alle azioni dell'elemento, come con «Indietro» */
  UI.onPickCancel = () => { if (!Q.menu) return; Q.menu = null; UI.onSelection(I.selection); };
  UI.onSelection = (ids) => {
    const q = $('#quick'); if (!q) return; Q.menu = null; if (!ids.length) { q.classList.add('hidden'); Q.el = null; return; }
    // col pop-up dei dettagli aperto il menu resta chiuso: sono le stesse azioni, e sovrapposte sono un caos.
    // (alla chiusura del pop-up, P.close richiama questa funzione e il menu torna)
    if (V.pop && V.pop.current) { q.classList.add('hidden'); Q.el = ids[0]; return; }
    // mai far comparire UI sotto il dito durante un gesto: il menu si apre al RILASCIO (up() richiama qui)
    if (I.gestureBusy && I.gestureBusy()) { q.classList.add('hidden'); Q.el = ids[0]; return; }
    // Ideale validato: si legge (secondo tocco = dettagli), non si agisce — niente menu di azioni
    if (V.map().validated) { q.classList.add('hidden'); Q.el = ids[0]; return; }
    const map = V.map();
    let html = '';
    if (ids.length > 1) { // selezione multipla: azioni di gruppo
      const els = ids.map(id => V.byId(id, map)).filter(Boolean); const lockable = els.filter(e => !V.isConnector(e) && R.LOCKABLE.includes(e.type)); const locked = els.filter(e => e.props && (e.props.lockTo || (e.type === 'delta' && e.props.attachedTo)));
      Q.el = ids[0];
      const acts = [];
      if (lockable.length) acts.push({ id: 'lockall', label: 'Lega tutti a…', title: 'Lega gli elementi selezionati a un passo, persona, corsia o freccia che tocchi: si muoveranno con lui' });
      if (locked.length) acts.push({ id: 'unlockall', label: 'Slega tutti', title: 'Slega tutti gli elementi selezionati: smettono di seguire i loro genitori' });
      if (els.filter(e => !V.isConnector(e) && e.type !== 'lane').length >= 2) acts.push({ id: 'sheetify', label: 'In un sotto-foglio', title: 'Sposta il settore in una nuova mappa collegata: al suo posto resta un passo con ↗' });
      acts.push({ id: 'dupall', label: 'Duplica tutti', title: 'Duplica tutti gli elementi selezionati' });
      acts.push({ id: 'del', label: 'Elimina', title: 'Elimina gli elementi selezionati' });
      html = `<span class="qinfo">${ids.length} selezionati</span>` + acts.map(a => qBtn(a, null)).join('');
    } else {
      const el = V.byId(ids[0], map); if (!el) { q.classList.add('hidden'); return; } Q.el = el.id;
      const acts = UI.actionList(el, map);
      // un menu con la sola "Elimina" non serve e invita al tocco sbagliato: per questi elementi basta il secondo tocco
      if (acts.length <= 1) { q.classList.add('hidden'); return; }
      html = acts.map(a => qBtn(a, el)).join('');
    }
    paintQuick(html);
  };
  /** azioni contestuali di un elemento: la stessa lista serve la barra rapida e il pop-up */
  UI.actionList = (el, map) => {
    const A = []; const btn = (id, label, title) => A.push({ id, label, title: title || label });
    const requestor = map.elements.find(e => e.type === 'person' && e.props.requestor);
    const outFlows = map.elements.filter(c => c.type === 'flow' && c.from.el === el.id);
    switch (el.type) {
      // niente "Dettagli" qui: i dettagli si aprono col secondo tocco sull'elemento (e chiudono questa barra)
      case 'box': btn('next', '+ Passo dopo', 'Crea il passo successivo già collegato, con l\'attesa'); if (outFlows.length) btn('delta', '+ Attesa', 'Aggiungi il delta sulla freccia in uscita'); btn('cloud', '+ Problema'); btn('connect', 'Collega →', 'Trascina da qui a un altro passo'); if (requestor && !map.elements.some(c => c.type === 'request' && c.to.el === el.id)) btn('request', '← Richiesta', 'Via di richiesta dal richiedente a questo passo'); break;
      // ogni persona può collegare, non solo il richiedente: il paziente che si reca al passo 2 è una
      // persona qualunque del foglio. Il verbo si sceglie nel menu che si apre.
      case 'person': btn('connect', 'Collega →', 'Da qui parte una via: «chiede a…» oppure «si reca a…»'); break;
      // scorta e in-box collegano come i passi: la freccia va da loro al passo che alimentano,
      // senza dover tirare la freccia a mano con lo strumento Flusso
      case 'inbox': case 'inventory': btn('connect', 'Collega →', 'Fai partire una freccia di flusso da qui verso un passo'); break;
      case 'delta': if (!el.props.attachedTo) btn('attach', 'Aggancia alla freccia'); break;
      case 'flow': btn('deltaOn', '+ Attesa qui'); btn('invert', 'Inverti'); break;
      case 'storm': btn('shrink', el.props.collapsed ? '▽ Apri il testo' : 'ⓘ Riduci al segno', el.props.collapsed ? 'Torna grande, col testo scritto dentro' : 'Resta la sua forma, piccola, con la «i»: il foglio si legge, e il testo si apre con un tocco'); btn('dup', 'Duplica'); break;
      case 'fluffy': case 'burst': case 'text': btn('dup', 'Duplica'); break;
      case 'icon': case 'face': btn('dup', 'Duplica'); break;
      case 'legend': btn('legend', el.props.collapsed ? 'Apri' : 'Chiudi'); btn('legendfull', 'Tutti i simboli', 'Ogni simbolo con significato e varianti, nella Guida pratica'); break;
    }
    if (V.isConnector(el) && Array.isArray(el.props.via) && el.props.via.length) btn('straighten', '― Raddrizza', 'Toglie le pieghe fatte a mano: la freccia torna diretta');
    // «Sbircia» e' la stessa anteprima dell'occhio disegnato sul passo, ma col bersaglio grande del
    // menu: i due dischetti sul disegno restano la via corta, questa la strada per chi non li azzecca
    if (el.props.link && V.doc.maps[el.props.link]) btn('peek', '👁 Sbircia', 'Sbircia il foglio collegato senza entrarci: anteprima e descrizione');
    // la CATENA lega due elementi (si muovono insieme); il LUCCHETTO inchioda l'elemento al foglio
    const locked = el.props && (el.props.lockTo || (el.type === 'delta' && el.props.attachedTo));
    if (locked) { const par = V.byId(locked, map); btn('unlock', '⛓ Slega', 'Legato a ' + (par ? (par.props.title || par.props.label || par.props.name || V.TYPES[par.type].name) : '?') + ': smette di seguirlo'); }
    else if (!V.isConnector(el) && R.LOCKABLE.includes(el.type) && el.type !== 'delta') btn('lockto', '⛓ Lega a…', 'Si muove insieme all\'elemento che tocchi (passo, freccia, persona, corsia)');
    const kids = R.children(el.id, map); if (kids.length) { btn('selkids', `⛶ Con i legati (${kids.length})`, 'Seleziona anche gli elementi legati a questo (per spostare, duplicare o eliminare tutto insieme)'); btn('unlockkids', '⛓ Slega i suoi', 'Slega tutti gli elementi legati a questo'); }
    if (!V.isConnector(el)) { if (el.props.pinned) btn('unpin', '🔓 Sblocca', 'Il lucchetto si apre: si può spostare e ridimensionare di nuovo'); else btn('pin', '🔒 Blocca', 'Inchioda l\'elemento al foglio: se lo trascini per sbaglio non si muove'); }
    // un passo validato (✓) non offre «Elimina» fra le azioni: prima si riapre dal tondo ✓, poi si
    // elimina. Offrirla inviterebbe al tocco sbagliato — e il modello la rifiuterebbe comunque.
    if (!(el.props && el.props.validated)) btn('del', 'Elimina');
    return A;
  };
  UI.quickAction = (a, id) => {
    const map = V.map(); const el = V.byId(id, map); if (!el) return;
    switch (a) {
      case 'next': { const nx = Math.min(el.x + el.w + 90, V.paperOf(map).w - V.TYPES.box.w - 20); const nb = V.newElement('box', nx, el.y, {}); const f = V.newConnector('flow', { el: el.id }, { el: nb.id }); const d = V.newElement('delta', 0, 0, {}); d.props.attachedTo = f.id; d.props.dx = 0; d.props.dy = 0; V.commit([{ t: 'add', el: nb }, { t: 'add', el: f }, { t: 'add', el: d }], 'passo successivo'); I.select([nb.id], { keepPop: true }); V.pop.open(nb.id); UI.toast('Passo aggiunto con freccia e attesa: tocca il delta per i tempi.'); break; }
      case 'delta': { const f = map.elements.find(c => c.type === 'flow' && c.from.el === el.id); if (!f) return; const d = V.newElement('delta', 0, 0, {}); d.props.attachedTo = f.id; d.props.dx = 0; d.props.dy = 0; V.commit({ t: 'add', el: d }, 'attesa'); I.select([d.id], { keepPop: true }); V.pop.open(d.id); break; }
      case 'cloud': { const s = V.newElement('storm', el.x + el.w - 60, el.y - 62, {}); V.commit({ t: 'add', el: s }, 'nuvola'); I.select([s.id], { keepPop: true }); V.pop.open(s.id); break; }
      // «Collega» apre il suo arco al posto del precedente e, se c'è qualcosa da toccare,
      // arma subito la scelta sul foglio: toccare un elemento collega senza altri passaggi
      case 'connect': { Q.menu = { bersagli: el.type !== 'person', intent: null }; UI.showQuick(el, UI.connectMenu(el, map, Q.menu.bersagli)); if (Q.menu.bersagli) armSheetPick(el, map, 'flow', null); break; }
      case 'cx-chiede': case 'cx-sireca': { Q.menu = { bersagli: true, intent: a === 'cx-sireca' ? 'si reca' : 'chiede' }; UI.showQuick(el, UI.connectMenu(el, map, true)); armSheetPick(el, map, 'request', Q.menu.intent); break; }
      case 'cx-back': {
        // dai bersagli si torna ai verbi (omino) o alle azioni normali dell'elemento;
        // la scelta sul foglio si spegne in silenzio: a ridisegnare ci pensa questo ramo
        const m = Q.menu; if (I.pickConn) I.cancelPickConnect({ quiet: true });
        if (el.type === 'person' && m && m.bersagli) { Q.menu = { bersagli: false, intent: null }; UI.showQuick(el, UI.connectMenu(el, map, false)); break; }
        Q.menu = null; UI.onSelection(I.selection); break;
      }
      case 'cx-box': case 'cx-inventory': case 'cx-inbox': {
        const kind = a.slice(3), it = Q.menu && Q.menu.intent; Q.menu = null;
        // la strada scelta dal menu sostituisce la scelta sul foglio: niente anelli rimasti appesi
        if (I.pickConn) I.cancelPickConnect({ quiet: true });
        // da un passo a un passo è esattamente «+ Passo dopo»: stesso pulsante, stesso risultato
        // (passo, freccia e attesa in una voce sola), invece di una seconda strada che diverge.
        // Da scorta/in-box no: un'attesa appiccicata alla loro freccia non avrebbe senso.
        if (el.type === 'box' && kind === 'box') { UI.quickAction('next', id); break; }
        const T = V.TYPES[kind], pos = R.elPos(el, map);
        // l'omino sta in alto a destra: quello che nasce da lui va verso la fascia dei passi, non oltre il bordo
        const w = el.type === 'person' ? { x: pos.x - 200, y: pos.y + 200 } : { x: pos.x + el.w + 90 + T.w / 2, y: pos.y + T.h / 2 };
        I.placeAndConnect(kind, w, id, el.type === 'person' ? 'request' : 'flow', { intent: it });
        break;
      }
      case 'request': { const r = map.elements.find(e => e.type === 'person' && e.props.requestor); if (!r) return; const c = V.newConnector('request', { el: r.id }, { el: el.id }); c.props.offset = I.reqOffset(map, r.id); V.commit({ t: 'add', el: c }, 'via di richiesta'); I.select([c.id], { keepPop: true }); V.pop.open(c.id); break; }
      case 'attach': { const pos = R.elPos(el, map); let best = null, bd = 120; map.elements.filter(c => c.type === 'flow').forEach(c => { const Pc = R.connPath(c, map); const d = Math.hypot(Pc.mid.x - (pos.x + el.w / 2), Pc.mid.y - pos.y); if (d < bd) { bd = d; best = c; } }); if (!best) { UI.toast('Nessuna freccia di flusso vicina: avvicina il delta a una freccia.'); return; } V.commit({ t: 'props', id, after: { attachedTo: best.id, dx: 0, dy: 0 } }, 'aggancia'); I.select([id]); break; }
      case 'deltaOn': { const d = V.newElement('delta', 0, 0, {}); d.props.attachedTo = id; d.props.dx = 0; d.props.dy = 0; V.commit({ t: 'add', el: d }, 'attesa'); I.select([d.id], { keepPop: true }); V.pop.open(d.id); break; }
      case 'invert': V.commit({ t: 'update', id, after: { from: clone(el.to), to: clone(el.from) }, before: { from: clone(el.from), to: clone(el.to) } }, 'inverti'); I.select([id]); break;
      case 'legend': { const collapsed = !el.props.collapsed; V.commit([{ t: 'props', id, after: { collapsed } }, { t: 'update', id, after: { w: collapsed ? 74 : 170, h: collapsed ? 18 : 104 } }], 'legenda'); I.select([id]); break; }
      case 'edit': V.pop.open(id); break;
      // sbirciare non chiede una posizione: senza coordinate il pop-up si apre al centro-alto
      case 'peek': UI.hideQuick(); UI.showPeek(id); break;
      case 'legendfull': UI.toggleGuide(true, 'simboli'); break;
      // la misura di prima si tiene da parte (V.setStormMark): chi allarga un problema non vuole
      // ritrovarlo piccolo al ritorno, ne' piu' basso del suo testo
      case 'shrink': { V.setStormMark(V.map(), id, !el.props.collapsed); I.select([id]); break; }
      case 'lockto': I.startPickLock([id]); break;
      case 'unlock': I.unlock(id); break;
      case 'pin': V.commit({ t: 'props', id, after: { pinned: true } }, 'blocca sul foglio'); I.select([id]); I.hint('Bloccato sul foglio \u{1F512}: trascinarlo non lo sposta più. «Sblocca» nelle azioni rapide per liberarlo.', 3500); break;
      case 'unpin': V.commit({ t: 'props', id, after: { pinned: false } }, 'sblocca dal foglio'); I.select([id]); I.hint('Lucchetto aperto \u{1F513}: si può spostare di nuovo.', 2000); break;
      case 'lockall': I.startPickLock(I.selection.slice()); break;
      case 'unlockall': I.unlockMany(I.selection.slice()); break;
      case 'selkids': I.selectWithChildren(id); break;
      case 'unlockkids': I.unlockChildren(id); break;
      case 'dup': I.duplicate(id); break;
      case 'dupall': I.duplicateMany(I.selection.slice()); break;
      case 'sheetify': UI.confirmSheetify(I.selection.slice()); break;
      case 'straighten': { const c = V.byId(id); if (!c) break; V.commit({ t: 'props', id, after: { via: null }, before: { via: clone(c.props.via) || null } }, 'raddrizza'); I.select([id]); break; }
      case 'del': if (I.selection.length <= 1) I.select([id], { keepPop: true }); I.deleteSelection(); break;
    }
  };

})(window.VSM);
