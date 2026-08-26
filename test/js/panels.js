/* VSM Coach v2 — panels.js: palette, popover degli elementi, guida, piano, libreria mappe, menu, suggerimenti di strumento. */
(function (V) {
  'use strict';
  const I = V.interact, R = V.render; const { num, fmt, uid, clone, today } = V.util;
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // get-or-create, non un nuovo oggetto: popover.js (si carica prima, spec fondamenta G) ha gia'
  // scritto V.ui.leftInset al proprio caricamento — un `= {}` incondizionato qui lo cancellerebbe.
  V.ui = V.ui || {}; const UI = V.ui;
  UI.toast = (m) => { const t = $('#toast'); t.classList.remove('toast-action'); t.textContent = m; t.classList.add('show'); clearTimeout(UI._t); UI._t = setTimeout(() => t.classList.remove('show'), 2200); };
  /** Un avviso con un bottone dentro (le proposte di fase: «Passa a Valida», «Passa a Misura»).
   *  ATTENZIONE: qui il toast si scrive con innerHTML, non textContent come UI.toast — serve per
   *  poter inserire il bottone. msg e label passano da esc() prima di finire nell'HTML: solo testo
   *  nostro (mai un valore preso da un file aperto) deve arrivare qui. Il bottone si aggancia con
   *  .onclick (proprietà JS, non un attributo onclick="…" nel markup): la CSP di index.html non lo
   *  tocca, e resta un solo posto — questo — dove il toast diventa HTML anziché testo puro.
   *  La classe 'toast-action' (app.css) e' quella che riaccende pointer-events sul bottone: il toast
   *  normale li ha spenti (nessuno lo doveva mai toccare), qui invece il bottone va toccato davvero. */
  UI.toastAction = (msg, label, fn) => {
    const t = $('#toast');
    t.innerHTML = `<span>${esc(msg)}</span> <button class="btn small primary" id="toast-act">${esc(label)}</button>`;
    t.classList.add('show', 'toast-action');
    clearTimeout(UI._t);
    const btn = $('#toast-act', t);
    if (btn) btn.onclick = (ev) => { ev.stopPropagation(); t.classList.remove('show', 'toast-action'); fn(); };
    UI._t = setTimeout(() => t.classList.remove('show', 'toast-action'), 6000);   // più a lungo: c'è un bottone da leggere e toccare
  };
  /** La spia del salvataggio in testata (spec fondamenta F): grigia/nascosta = 'ok' su IndexedDB,
   *  gialla = 'fallback' (solo su localStorage, si ritenta da sola), rossa = 'failed' (non scritto
   *  da nessuna parte). model.js chiama questa funzione UNA volta per ogni cambio di stato — il
   *  toast quindi non si ripete a ogni ritentativo che fallisce ancora allo stesso modo. */
  UI.saveState = (s) => {
    const dot = $('#save-dot');
    const MSG = {
      fallback: 'Salvo solo su questo browser: IndexedDB non risponde. Riprovo da solo.',
      failed: 'Non riesco a salvare: esporta il JSON dal menu ⋯ prima di chiudere.',
      ok: 'Il salvataggio è tornato regolare.'
    };
    if (dot) {
      dot.classList.toggle('hidden', s === 'ok');
      dot.classList.remove('fallback', 'failed');
      if (s !== 'ok') dot.classList.add(s);
      dot.title = s === 'ok' ? '' : MSG[s];
    }
    UI.toast(MSG[s] || '');
  };

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
    const SHORT = { ink: 'Matita', eraser: 'Gomma', area: 'Area', box: 'Passo', delta: 'Attesa', flow: 'Flusso', request: 'Richiesta', person: 'Persona', storm: 'Problema', more: 'Altro', whatis: 'Cos’è?', fluffy: 'Nuvola', text: 'Testo' };
    // In Misura/Analizza la palette si riduce alle sole funzioni che si usano davvero (esito
    // stazione 3): commenti, nuvolette, note e il «?» — il flusso e' fermo, disegnarci sopra
    // non ha senso e i bottoni in piu' sono tocchi sbagliati che aspettano.
    const mappa = V.map();
    const inMisura = !!(mappa && ['misura', 'analizza'].includes(mappa.phase));
    const TOOLS_ATTIVI = inMisura
      ? [['storm', 'Problema (nuvola temporalesca)'], ['fluffy', 'Nuvola soffice: idea, cosa che funziona'], ['text', 'Testo / nota'], null, ['whatis', 'Che cos’è? Tocca un elemento e te lo spiego']]
      : MAIN_TOOLS;
    // "✓ Fine" compare solo quando uno strumento e' attivo: e' l'uscita, al posto del vecchio tasto Seleziona
    const done = document.createElement('button');
    done.className = 'tool done hidden'; done.id = 'tool-done'; done.title = 'Torna a selezionare (Esc)';
    done.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 7"/></svg><span class="lbl">Fine</span>';
    done.onclick = () => { $('#more-tools').classList.add('hidden'); I.setTool('select'); };
    pal.appendChild(done);
    TOOLS_ATTIVI.forEach(t => { if (!t) { const s = document.createElement('div'); s.className = 'sep'; pal.appendChild(s); return; } const b = document.createElement('button'); b.className = 'tool'; b.dataset.tool = t[0]; b.title = t[1]; b.setAttribute('aria-label', t[1]); b.innerHTML = IC[t[0]] + `<span class="lbl">${SHORT[t[0]]}</span>`; b.onclick = () => { if (t[0] === 'more') { $('#more-tools').classList.toggle('hidden'); return; } $('#more-tools').classList.add('hidden'); if (t[0] === 'ink' && I.tool === 'ink') { UI.inkOptions(); return; } if (I.tool === t[0]) { I.setTool('select'); return; } I.setTool(t[0]); }; pal.appendChild(b); });
    if (inMisura && !TOOLS_ATTIVI.some(t => t && t[0] === I.tool) && I.tool !== 'select') I.setTool('select');   // niente matita fantasma (Codex P1)
    const more = $('#more-tools'); more.innerHTML = ''; more.classList.add('hidden');
    (inMisura ? [] : MORE_TOOLS).forEach(t => { const b = document.createElement('button'); b.className = 'tool'; b.dataset.tool = t[0]; b.innerHTML = IC[t[0]] + '<span>' + t[1] + '</span>'; b.onclick = () => { I.setTool(t[0]); more.classList.add('hidden'); }; more.appendChild(b); });
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
  // in Misura/Analizza il menu del vuoto offre solo cio' che serve osservando (esito Gt 25/8
  // sera): problema, nuvola, testo e le faccine — il resto e' disegno, e il flusso e' fermo
  const INS_MISURA = [
    { id: 'k:storm', label: 'Problema', icon: IC.storm, title: 'Un problema visto misurando (nuvola temporalesca)' },
    { id: 'k:fluffy', label: 'Idea', icon: IC.fluffy, title: 'Nuvoletta: un\'idea, o qualcosa che funziona' },
    { id: 'k:text', label: 'Testo', icon: IC.text, title: 'Una nota libera sul foglio' },
    { id: 'g:facce', label: 'Faccine', icon: IC.face, title: 'Come si vive questo punto, visto dal vero' }
  ];
  UI.openInsertMenu = (clientX, clientY, w) => {
    const map = V.map(); if (!map) return;
    if (map.validated) return; // Ideale col lucchetto: non si aggiunge niente, e il menu direbbe il contrario
    const mostra = (voci, hint) => apriRadiale(clientX, clientY, voci, (id) => {
      if (id === 'g:altro') return mostra(INS_ALTRO);
      if (id === 'g:primi') return mostra(['misura', 'analizza'].includes((V.map() || {}).phase) ? INS_MISURA : INS_PRIMI);
      if (id === 'g:facce') { UI.closePlaceMenu(); return UI.openFaceMenu(clientX, clientY, w); }
      UI.closePlaceMenu();
      I.placeKind(id.slice(2), w, { senzaLegame: true }); // dal menu del vuoto: niente legame automatico (bug iPad 25/8)
    }, hint);
    mostra(['misura', 'analizza'].includes((V.map() || {}).phase) ? INS_MISURA : INS_PRIMI, 'Che cosa metti qui? Tocca fuori per lasciare il foglio com’è.');
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
    $$('[data-mood]', card).forEach(b => b.onclick = (ev) => { ev.stopPropagation(); UI.closePlaceMenu(); I.placeKind('face', w, { props: { mood: b.dataset.mood }, senzaLegame: true }); });
    $('[data-pm]', card).onclick = (ev) => { ev.stopPropagation(); UI.closePlaceMenu(); UI.openInsertMenu(clientX, clientY, w); };
    chiudiToccandoFuori();
  };

  // V.pop.current a un sentinella (non un id vero, non null): senza, riusare #pop con l'id di un
  // elemento ancora appeso lì dentro (P.current) faceva scattare il ResizeObserver del pop-up
  // (popover.js) che riposiziona il pannello ACCANTO A QUELL'ELEMENTO — spostando la Matita (o i
  // Livelli di analisi) vicino a un passo qualunque toccato prima. Rilievo Important della
  // revisione, repro: tocca un passo → ⋯ → «Livelli di analisi…».
  UI.inkOptions = () => { const p = $('#pop'); V.pop.current = '__ink__'; p.innerHTML = `<div class="pop-head"><b>Matita</b><button class="btn small ghost" id="pop-x" aria-label="Chiudi">✕</button></div><div class="actions">${INK_COLORS.map(c => `<button class="btn small" data-c="${c[0]}" style="border-color:${c[0]};${I.ink.color === c[0] ? 'background:' + c[0] + ';color:#fff' : ''}">${c[1]}</button>`).join('')}</div><div class="actions">${[1.2, 1.8, 3].map(w => `<button class="btn small" data-w="${w}" ${I.ink.width === w ? 'style="border-color:var(--accent);color:var(--accent)"' : ''}>${w === 1.2 ? 'sottile' : w === 1.8 ? 'media' : 'spessa'}</button>`).join('')}</div>`; p.classList.remove('hidden'); const st = $('#stage').getBoundingClientRect(); p.style.left = Math.max(10, st.width / 2 - 100) + 'px'; p.style.top = (st.height - 200) + 'px'; $$('[data-c]', p).forEach(b => b.onclick = () => { I.ink.color = b.dataset.c; UI.inkOptions(); }); $$('[data-w]', p).forEach(b => b.onclick = () => { I.ink.width = +b.dataset.w; UI.inkOptions(); }); $('#pop-x').onclick = () => V.pop.close(); };

  /** Il menu dei livelli di analisi (spec D): elenca SOLO i livelli ammessi dalla fase corrente
   *  (V.layers.ammesso), in ordine di registrazione — un livello acceso ma non ancora ammesso (un
   *  foglio tornato indietro di fase non dovrebbe capitare, ma la lista non lo mostrerebbe comunque:
   *  V.layers.active fa la stessa scelta per il disegno). In fase 0 c'e' solo 'riepilogo'; il
   *  meccanismo e' quello che ospitera' F1-F10 senza toccare questo file. */
  UI.layersMenu = () => {
    const map = V.map(); if (!map) return;
    const p = $('#pop'); V.pop.current = '__layers__'; // vedi la nota sopra UI.inkOptions
    const ammessi = V.layers.all().filter(l => V.layers.ammesso(l, map));
    const righe = ammessi.map(l => {
      const on = !!(map.layers && map.layers[l.id]);
      return `<button class="btn small" data-lv="${esc(l.id)}" ${on ? 'style="border-color:var(--accent);color:var(--accent)"' : ''} aria-pressed="${on}">${on ? '✓ ' : '○ '}${esc(l.label || l.id)}</button>`;
    }).join('');
    p.innerHTML = `<div class="pop-head"><b>Livelli di analisi</b><button class="btn small ghost" id="pop-x" aria-label="Chiudi">✕</button></div>`
      + `<div class="actions">${righe || '<span class="hint">Nessun livello ammesso in questa fase.</span>'}</div>`;
    p.classList.remove('hidden'); p.classList.remove('step');
    const st = $('#stage').getBoundingClientRect(); p.style.left = Math.max(10, st.width / 2 - 100) + 'px'; p.style.top = (st.height - 200) + 'px';
    $$('[data-lv]', p).forEach(b => b.onclick = () => { V.layers.toggle(map, b.dataset.lv); R.overlay(map); UI.layersMenu(); });
    $('#pop-x').onclick = () => V.pop.close();
  };

  // ---------- popover degli elementi ----------
  // V.pop (P.open/close/place/openTitle/refresh/sections...) e' traslocato in
  // js/popover.js (spec fondamenta D, Task 5): si carica prima di questo file, cosi'
  // ospita anche le sezioni dei livelli senza che panels.js debba sapere di V.layers.
  // P resta un alias locale (non una nuova creazione: popover.js ha gia' scritto V.pop) per non
  // riscrivere ogni "P." rimasto piu' sotto in questo file.
  const P = V.pop;

  // ---------- header / mappe ----------
  UI.openMap = (id) => {
    // niente modalita' appese sulla mappa nuova: il primo tocco li' deve funzionare
    if (I.pickConn) I.cancelPickConnect(); if (I.pickLock) I.cancelPickLock(); UI.closePlaceMenu(); if (!V.doc.maps[id]) { UI.toast('Mappa non trovata.'); return; } P.close(); I.select([]); V.switchMap(id); I.restoreView();
    // la palette e la barra del giro seguono la FASE del foglio aperto (stazione 3)
    UI.buildPalette(); UI.renderMisCtl && UI.renderMisCtl(); };
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
    $('#mh-sub').textContent = [fdate(map.date), map.unitName, map.authors && ('di ' + map.authors)].filter(Boolean).join(' · ');
    // Il selettore di fase sostituisce «provvisoria» (spec D): il nome della fase sta sempre in
    // testata, non solo finché il foglio non è stato camminato.
    const faseBtn = $('#mh-phase');
    // «Fase:» davanti al nome (prova iPad 25/8): da solo, «Disegna» in testata sembrava un bottone
    // per disegnare, non lo STATO del foglio — la parola dice che cos'è quello che si legge.
    if (faseBtn) { faseBtn.innerHTML = '<small>Fase:</small> ' + esc(V.PHASE_LABEL[map.phase] || 'Disegna'); faseBtn.title = 'Fase del foglio: ' + (V.PHASE_HINT[map.phase] || '') + ' — tocca per vederla o cambiarla'; }
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
    if (UI.menuCheck) UI.menuCheck('#btn-overlays', !!(map.layers && map.layers.riepilogo));
    if (UI.linkModeLabel) UI.linkModeLabel();
  };

  // ---------- fase del foglio (spec fondamenta A1, Task 4 — ridisegnato dalla prova iPad 25/8) ----------
  /** Il selettore in testata, in DUE blocchi (V.PHASE_GROUPS): «1 · Pianificazione» dove ci si
   *  muove liberamente, la porta, «2 · Misura e analisi» da cui indietro serve un nuovo giro. La
   *  fase attuale è EVIDENZIATA (bordo verde, «✔ sei qui»), non un bottone spento uguale a quelli
   *  vietati — era proprio quella somiglianza a confondere selezione, stato e passaggio. Le fasi
   *  non raggiungibili restano in lista col perché sotto (V.DENIED_MSG), mai solo grigie. Toccare
   *  «Misura» dalla pianificazione NON cambia fase subito: arma una conferma nel dialogo, perché
   *  è l'unico tocco che non si disfa (da lì si esce solo col nuovo giro). Il «?» in testa apre
   *  la spiegazione delle fasi. Da Misura/Analizza sotto la lista compare UN bottone solo —
   *  «Crea un nuovo giro» — perché l'azione è la stessa per tutte e tre le righe chiuse. */
  UI.openFase = () => { UI._nuovoGiroConferma = false; UI._svalidaConferma = false; UI._faseAiuto = false; UI._calderoneAperto = false; UI.renderFase(); const d = $('#dlg-fase'); if (!d.open) d.showModal(); };
  /** Il CALDERONE si consulta (C1, decisione Gt 26/8): la svalida archivia obs, Hi/Lo/Avg e
   *  samples — qui si rileggono, in sola lettura, voce per voce. Il nome viene dal contesto
   *  salvato (voce.nomi); per le voci vecchie (prima del 26/8) si ripiega sull'elemento vivo. */
  const calderoneHTML = (map) => {
    const cald = Array.isArray(map.calderone) ? map.calderone : [];
    if (!cald.length) return '';
    if (!UI._calderoneAperto) return `<div class="actions" style="margin:2px 0 8px"><button class="btn" id="fase-calderone" style="opacity:.65;font-size:12px">\u{1F4E6} Calderone (${cald.length})… (avanzato)</button></div>`;
    const voce = (v) => {
      const quando = v.at ? new Date(v.at).toLocaleString('it-CH') : '?';
      const ids = Array.from(new Set(Object.keys(v.obs || {}).concat(Object.keys(v.dati || {}))));
      const righe = ids.map(id => {
        const ctx = v.nomi && v.nomi[id];
        const vivo = V.byId(id, map);
        const nome = (ctx && (ctx.nome || ctx.tipo)) || (vivo && String(vivo.props.title || vivo.props.note || '').trim()) || 'elemento non più sul foglio';
        const o = (v.obs && v.obs[id]) || [];
        const d = v.dati && v.dati[id];
        const pezzi = [];
        if (o.length) pezzi.push(o.length + (o.length === 1 ? ' misura' : ' misure') + ': ' + o.map(x => (x && x.s) + 's').slice(0, 10).join(', ') + (o.length > 10 ? '…' : ''));
        if (d) pezzi.push('Hi ' + (d.hi || '–') + ' · Lo ' + (d.lo || '–') + ' · Avg ' + (d.avg || '–'));
        return `<div class="k">• <b>${esc(nome)}</b> — ${esc(pezzi.join(' · ') || 'niente')}</div>`;
      }).join('');
      return `<div class="cald-voce"><div><b>${esc(quando)}</b> <span class="k">(svalidato da ${esc(v.da || '?')})</span></div>${righe}${v.samples ? `<div class="k">campioni dichiarati (campo vecchio): ${esc(v.samples)}</div>` : ''}</div>`;
    };
    return `<div class="fase-calderone"><b>\u{1F4E6} Calderone — misure archiviate dalle svalide</b><p class="hint">Sola lettura: sono fuori da conti, badge e viste. Restano qui come storia del foglio.</p>${cald.slice().reverse().map(voce).join('')}<div class="actions"><button class="btn small" id="fase-calderone-chiudi">chiudi</button></div></div>`;
  };
  UI.renderFase = () => {
    const map = V.map(); const body = $('#fase-body'); if (!map || !body) return;
    const ICONA = { disegna: '\u270F\uFE0F', valida: '\u2705', misura: '\u23F1\uFE0F', analizza: '\u{1F4CA}' };
    let nuovoGiro = false;
    const stato = (f) => { const cur = (map.phase || 'disegna') === f; const g = cur ? { ok: false, reason: null } : V.canSetPhase(map, f); if (!cur && g.reason === 'nuovo-giro') nuovoGiro = true; return { cur, g }; };
    // Niente sottotitoli sotto le righe e sotto i titoli dei blocchi (feedback 25/8, secondo giro:
    // «troppe frasi»): icona + nome e basta. Il perche' di ogni fase resta nel title= (pressione
    // lunga / mouse) e nella nuvoletta del «?». Valida NON sta in un blocco: e' il pulsante blu FRA
    // i due, perche' e' il passaggio che li separa (lo staff conferma il foglio).
    const riga = (f, extra) => { const { cur, g } = stato(f);
      return `<button class="btn big fase-riga${extra ? ' ' + extra : ''}${cur ? ' cur' : ''}" data-fase="${f}" ${cur || !g.ok ? 'disabled' : ''} title="${esc(V.PHASE_HINT[f] || '')}">`
        + `<span class="fase-icona" aria-hidden="true">${ICONA[f]}</span><b>${esc(V.PHASE_LABEL[f])}</b>${cur ? '<span class="fase-qui">\u2714 sei qui</span>' : ''}</button>`; };
    const gruppo = (t, fasi) => `<div class="fase-gruppo"><div class="fase-gruppo-t">${esc(t)}</div>${fasi.map(f => riga(f)).join('')}</div>`;
    // la nuvoletta del «?»: quattro frasi, non un pannello
    const nuvola = !UI._faseAiuto ? '' : `<div class="fase-nuvola" role="note"><p><b>1 · Pianificazione</b>: disegni il flusso e lo controlli sul campo — avanti e indietro liberamente.</p><p><b>\u2705 Valida</b>: lo staff che fa il lavoro conferma il foglio.</p><p><b>2 · Misura e analisi</b>: si cronometra e si analizza. \u23F1\uFE0F Misura è una porta: si entra da Valida, da lì il disegno è fermo e per ridisegnare serve un <b>nuovo giro</b>.</p><p>L'Ideale col lucchetto \u{1F512} chiuso non cambia fase: prima apri il lucchetto.</p></div>`;
    // la porta chiede conferma: il solo passaggio che \u21A9 non disfa non parte da un tocco solo
    // niente più «libretto di istruzioni» sulla porta di Misura (esito stazione 2, 25/8): si
    // entra diretti; la meccanica del valida (il disegno non si tocca più, nuovo giro per
    // ridisegnare) vive SOLO dietro il «?» della nuvoletta qui sotto.
    body.innerHTML = nuvola
      + gruppo('1 \u00B7 Pianificazione', ['disegna'])
      + `<div class="fase-valida-blocco"><span class="fase-freccia" aria-hidden="true">\u2193</span>${riga('valida', 'primary fase-valida')}<span class="fase-freccia" aria-hidden="true">validato \u2193</span></div>`
      + gruppo('2 \u00B7 Misura e analisi', ['misura', 'analizza'])
      + (['misura', 'analizza'].includes(map.phase) ? `<div class="actions" style="margin:8px 0 10px"><button class="btn big verde" id="fase-inizia">\u25B6 Inizia la misura</button></div>` : '')
      + (nuovoGiro ? (UI._nuovoGiroConferma
        ? `<div class="fase-conferma"><b>Creare un nuovo giro?</b><br><small>È una COPIA di questo foglio che riparte da Disegna: questo giro resta com'è, con le sue misure.</small><div class="actions"><button class="btn primary" id="fase-nuovo-giro-si">Sì, nuovo giro</button><button class="btn" id="fase-nuovo-giro-no">Annulla</button></div></div>`
        : `<div class="hint" style="margin:8px 2px 4px">${esc(V.DENIED_MSG['nuovo-giro'])}</div><div class="actions" style="margin:0 0 10px"><button class="btn" id="fase-nuovo-giro">Crea un nuovo giro\u2026</button></div>`) : '')
      + (['misura', 'analizza'].includes(map.phase) ? (UI._svalidaConferma
        ? `<div class="fase-conferma"><b>Svalidare il foglio?</b><br><small>\u00C8 la via d'emergenza: il foglio torna in pianificazione e le misure prese finiscono nel CALDERONE \u2014 recuperabili, ma fuori da conti e viste. Il giro in corso muore.</small><div class="actions"><button class="btn primary" id="fase-svalida-si">S\u00EC, svalida</button><button class="btn" id="fase-svalida-no">Annulla</button></div></div>`
        : `<div class="actions" style="margin:2px 0 8px"><button class="btn" id="fase-svalida" style="opacity:.65;font-size:12px">Svalida il foglio\u2026 (avanzato)</button></div>`) : '')
      + calderoneHTML(map)
      + (map.validated ? '<p class="notice">Ideale validato \u{1F512}: apri il lucchetto in alto per cambiare fase.</p>' : '');
    // la nuvoletta si chiude da sola: un tocco su di lei, o su una riga qualsiasi
    const nv = $('.fase-nuvola', body); if (nv) nv.onclick = () => { UI._faseAiuto = false; UI.renderFase(); };
    $$('[data-fase]', body).forEach(b => b.onclick = () => {
      UI._faseAiuto = false;
      const f = b.dataset.fase;
      const r = V.setPhase(map, f);
      if (!r.ok) { UI.toast(V.DENIED_MSG[r.reason] || 'Non si può.'); return; }
      UI._nuovoGiroConferma = false;
      UI.buildPalette(); UI.renderMisCtl();
      UI.renderHeader(); UI.renderFase(); UI.toast('Fase: ' + V.PHASE_LABEL[map.phase] + '.' + (map.phase === 'misura' ? ' Tocca «▶ Inizia la misura» quando sei pronto.' : ''));
    });
    // il nuovo giro in due tempi (esito stazione 2, 25/8: tre giri creati per sbaglio da un
    // bottone primario a portata di pollice): il primo tocco ARMA la conferma, il secondo crea.
    const ng = $('#fase-nuovo-giro', body);
    if (ng) ng.onclick = () => { UI._nuovoGiroConferma = true; UI.renderFase(); };
    const ngSi = $('#fase-nuovo-giro-si', body);
    if (ngSi) ngSi.onclick = () => {
      UI._nuovoGiroConferma = false;
      const nv = V.createVersion(map);
      $('#dlg-fase').close();
      UI.openMap(nv.id);
      UI.toast('Nuovo giro creato in Disegna: qui puoi cambiare il flusso, controllarlo sul campo e farlo validare di nuovo.');
    };
    const ngNo = $('#fase-nuovo-giro-no', body);
    if (ngNo) ngNo.onclick = () => { UI._nuovoGiroConferma = false; UI.renderFase(); };
    // svalida (esito Gt 25/8 sera: bottone NASCOSTO in avanzate, due tempi): la porta resta a
    // senso unico per il metodo, questa e' la maniglia d'emergenza dichiarata
    const sv = $('#fase-svalida', body);
    if (sv) sv.onclick = () => { UI._svalidaConferma = true; UI.renderFase(); };
    const svSi = $('#fase-svalida-si', body);
    if (svSi) svSi.onclick = () => {
      UI._svalidaConferma = false;
      const r = V.unvalidate(map);
      if (!r.ok) { UI.toast('Qui non c\u2019\u00E8 niente da svalidare.'); UI.renderFase(); return; }
      UI.buildPalette(); UI.renderMisCtl(); UI.renderHeader(); UI.renderFase();
      UI.toast('Foglio svalidato: ' + (r.elementi ? r.elementi + ' element' + (r.elementi === 1 ? 'o' : 'i') + ' con misure o tempi archiviat' + (r.elementi === 1 ? 'o' : 'i') + ' nel calderone.' : 'nessuna misura da archiviare.') + ' Sei in Valida.');
    };
    const svNo = $('#fase-svalida-no', body);
    if (svNo) svNo.onclick = () => { UI._svalidaConferma = false; UI.renderFase(); };
    // il calderone si apre e si chiude qui, in sola lettura
    const cd = $('#fase-calderone', body);
    if (cd) cd.onclick = () => { UI._calderoneAperto = true; UI.renderFase(); };
    const cdChiudi = $('#fase-calderone-chiudi', body);
    if (cdChiudi) cdChiudi.onclick = () => { UI._calderoneAperto = false; UI.renderFase(); };
    // il bottone verde della Misura: chiude il selettore e apre il cronometro sul foglio
    const inizia = $('#fase-inizia', body);
    if (inizia) inizia.onclick = () => { $('#dlg-fase').close(); UI.renderMisCtl(); I.hint('Tocca il cronometro \u23F1 sul PRIMO passo del flusso: parte il giro. \u00AB\u270B Passo finito\u00BB chiude il passo e l\u2019attesa corre da sola fino al prossimo.', 7000); };
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


  /* ---------- la barra del giro (Misura, esito stazione 3 + ricerca UX 25/8) ----------
   * Comandi grandi in zona pollice, al posto del pannello: [pausa osservatore] [tempo]
   * [passo finito / comincia il prossimo] [chiudi il giro, staccato e in due tempi].
   * Ogni tocco passa dal modello (measure*), che salva subito nel documento: un lap non
   * si perde nemmeno se Safari muore un istante dopo. Il tempo corre dall'orologio di
   * parete (t0), mai da un timer JS; il Wake Lock tiene lo schermo acceso mentre si misura. */
  let misTick = null, misWL = null, misStopArm = null;  // {mapId, giro}: la conferma armata non sopravvive al cambio di contesto (Codex P1)
  let misTrashArm = null;  // {mapId, t0}: il cestino armato vale per QUESTO lap — cambia il lap, si disarma
  // «attiva» e' GLOBALE, non del foglio a schermo (C2, decisione Gt 26/8): il giro puo' vivere su
  // un altro foglio, e finche' vive la barra resta (e il Wake Lock tiene lo schermo acceso)
  const misAttiva = () => !!V.measureActiveMap();
  let misWLPend = false;
  const misWake = async () => {
    if (misWL || misWLPend || !navigator.wakeLock || !misAttiva()) return;
    misWLPend = true;
    try {
      const wl = await navigator.wakeLock.request('screen');
      // la misura puo' essere finita mentre la richiesta era in volo (Codex P2): niente lock orfani
      if (!misAttiva()) { try { wl.release(); } catch (e2) { /* niente */ } return; }
      misWL = wl;
      wl.addEventListener('release', () => { if (misWL === wl) misWL = null; });
    } catch (e) { /* wake lock negato: si misura lo stesso */ }
    finally { misWLPend = false; }
  };
  const misWakeOff = () => { try { if (misWL) misWL.release(); } catch (e) { /* niente */ } misWL = null; };
  // al RIENTRO nell'app il cronometro torna visibile in primo piano, con l'avviso aggiornato
  // (decisione Gt 26/8, stazione 12-A/B): non solo il Wake Lock — anche la barra si ridisegna
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && misAttiva()) { misWake(); UI.renderMisCtl(); } });
  // oltre l'ora la barra scrive h:mm:ss (C18): la logica vive in V.fmtCrono, pura e provata
  const misMMSS = (sec) => V.fmtCrono(sec);
  // icone della barra del giro: SVG puliti, stessi tratti delle icone della palette — niente
  // scritte nei bottoni (esito di Gt del 25/8 sera); il nome vive in aria-label e title
  const MIS_IC = {
    pause: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M8.5 5v14M15.5 5v14"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M7.5 4.8l11.5 7.2-11.5 7.2z" fill="currentColor"/></svg>',
    lap: '<svg viewBox="0 0 24 24"><path d="M3.5 5.5l8 6.5-8 6.5z M12 5.5l8 6.5-8 6.5z" fill="currentColor"/></svg>',
    next: '<svg viewBox="0 0 24 24"><path d="M5.5 5l9.5 7-9.5 7z" fill="currentColor"/><path d="M18.5 5v14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
    stop: '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg>',
    no: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 7h15M9.5 7V4.8h5V7M7 7l1 12.5h8L17 7M10 10.5v6M14 10.5v6"/></svg>'
  };
  /** La schermata di ANALISI delle misurazioni di un passo (esito 12, E12-d): tutte le
   *  statistiche del livello «Tempi e variabilità» (F1) — istogramma, sparkline, elenco delle
   *  misure con riclassificazione, nota e correzione manuale (🔢) — in una finestra dedicata,
   *  aperta dal pulsante «🕐＋ Analisi delle misure» della finestra del passo o dal badge. */
  UI.openAnalisi = (elId) => {
    const map = V.map(); const el = map && V.byId(elId, map); if (!el) return;
    let d = $('#dlg-analisi');
    if (!d) {
      d = document.createElement('dialog'); d.id = 'dlg-analisi'; d.setAttribute('aria-labelledby', 'analisi-head');
      d.innerHTML = '<div class="d-head" id="analisi-head"></div><div class="d-body"><div id="analisi-body"></div></div><div class="d-foot"><button class="btn" id="analisi-close">Chiudi</button></div>';
      document.body.appendChild(d);
      $('#analisi-close', d).onclick = () => d.close();
    }
    $('#analisi-head', d).textContent = '🕐 Analisi delle misure — ' + V.nomePasso(el, map);
    const body = $('#analisi-body', d);
    if (V.tempo && V.tempo.mount && V.obsOf(el).length) V.tempo.mount(body, el, map);
    else body.innerHTML = '<p class="hint">Nessuna misura su questo passo.</p>';
    if (!d.open) d.showModal();
  };
  /** La legenda FISSA della misura (esito 12, E12-f): in basso a sinistra, spiega in piccolo i
   *  tasti del cronometro e quando/quali chiudono un giro — la ✕ NON cancella niente. */
  const misLegenda = (mCur) => {
    let leg = $('#mislegenda');
    if (!leg) { leg = document.createElement('div'); leg.id = 'mislegenda'; document.body.appendChild(leg); }
    const inFase = !!(mCur && ['misura', 'analizza'].includes(mCur.phase));
    leg.classList.toggle('hidden', !inFase);
    if (!inFase) return;
    // esito 12-ter: fissa era «troppo intralciante» — di casa sta RIDOTTA a icona (orologio col
    // «?»); un tocco la apre, ✕ la riporta a icona; la scelta si ricorda
    let aperta = false; try { aperta = localStorage.getItem('vsm.mislegenda') === '1'; } catch (e) { /* storage bloccato */ }
    leg.classList.toggle('aperta', aperta);
    if (!aperta) {
      leg.innerHTML = `<button id="misleg-apri" class="misleg-icona" aria-label="Legenda del cronometro" title="Legenda del cronometro">`
        + `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="9.6" y="1.4" width="4.8" height="2.6" rx="1" fill="currentColor" stroke="none"/><circle cx="12" cy="13.4" r="8.4"/><text x="12" y="17.2" text-anchor="middle" font-size="10" font-weight="700" stroke="none" fill="currentColor">?</text></svg></button>`;
      const ap = $('#misleg-apri', leg); if (ap) ap.onclick = () => { try { localStorage.setItem('vsm.mislegenda', '1'); } catch (e) { /* niente */ } misLegenda(mCur); };
      return;
    }
    leg.innerHTML = '<div class="misleg-testa"><b>Cronometro</b><button id="misleg-chiudi" class="btn small ghost" aria-label="Riduci a icona" title="Riduci a icona">✕</button></div>'
      + '<div>⏱ sul passo: parte (o riprende) il giro da lì</div>'
      + '<div>⏸ pausa di chi osserva — il tempo fermo non entra nel dato</div>'
      + '<div>⏩ passo finito · ▶ comincia il prossimo (l’attesa nasce da sola)</div>'
      + '<div>🗑 elimina la misura in corso (due tocchi) — niente viene scritto; ▶ la riavvia</div>'
      + '<div>⏹ chiude il giro: chiede conferma — ⏹ rosso = sì, ✕ = annulla (nulla si cancella)</div>'
      + '<div>Al bivio i cronometri lampeggiano: un tocco SCEGLIE la strada (anello verde), ▶ fa partire la misura.</div>'
      + '<div>Dopo l’ultimo passo della catena il giro si chiude da solo.</div>';
    const ch = $('#misleg-chiudi', leg); if (ch) ch.onclick = () => { try { localStorage.setItem('vsm.mislegenda', '0'); } catch (e) { /* niente */ } misLegenda(mCur); };
  };
  UI.renderMisCtl = () => {
    let bar = $('#misctl');
    if (!bar) { bar = document.createElement('div'); bar.id = 'misctl'; const pal = $('#palette'); pal.parentNode.insertBefore(bar, pal); }
    misLegenda(V.map());
    // la barra segue il GIRO, non il foglio a schermo (C2, decisione Gt 26/8): se il cronometro
    // vive su un altro foglio la barra resta — ridotta a pausa · tempo · chiudi — e il nome
    // riporta al foglio che sta misurando. «Non dovrebbe accadere», ma la possibilita' resta.
    const mCur = V.map();
    const m = V.measureActiveMap();
    const altrove = !!(m && mCur && m.id !== mCur.id);
    // il badge sul passo cambia stato (verde = sta misurando qui): l'op 'meta' del cronometro e'
    // silenziosa e non ridisegna gli elementi — qui si aggiornano il passo di prima e quello
    // attivo, ma SOLO sul foglio a schermo (R.updateEl disegna sul canvas corrente)
    const sNow = m && V.measureState(m);
    // fase+passo+freccia (Codex P2: attesa→box sullo stesso passo; esito 12: anche la freccia
    // dell'attesa si accende/spegne in blu e va ridisegnata al cambio)
    const attKey = (m && !altrove) ? (sNow.phase + ':' + sNow.stepId + ':' + (sNow.connId || '')) : null;
    if (UI._misPrev !== attKey) {
      // oltre a passo e freccia correnti si ridisegnano i CANDIDATI del bivio (esito 12-bis):
      // durante l'attesa i cronometri raggiungibili dal passo chiuso lampeggiano (mis-scelta),
      // e a scelta fatta devono spegnersi — l'elenco di prima si tiene per pulirlo
      const nuovi = (m && !altrove && sNow && sNow.phase) ? (() => {
        const out = [sNow.stepId, sNow.connId].filter(Boolean);
        if (sNow.phase === 'attesa' && sNow.fromId) mCur.elements.forEach(cc => {
          if (cc.type === 'flow' && cc.from && cc.from.el === sNow.fromId) { out.push(cc.id); if (cc.to && cc.to.el) out.push(cc.to.el); }
        });
        // esito 12-ter: il bivio si annuncia gia' col timer sul passo in comune — anche i suoi
        // rami vanno ridisegnati quando il lampeggio si accende o si spegne
        if (sNow.phase === 'box' && sNow.stepId) {
          const usc = mCur.elements.filter(cc => cc.type === 'flow' && cc.from && cc.from.el === sNow.stepId);
          if (usc.length >= 2) usc.forEach(cc => { if (cc.to && cc.to.el) out.push(cc.to.el); });
        }
        return out;
      })() : [];
      new Set((UI._misPrevIds || []).concat(nuovi)).forEach(ix => { if (mCur && V.byId(ix, mCur)) R.updateEl(ix, mCur); });
      UI._misPrev = attKey; UI._misPrevIds = nuovi;
    }
    if (!m) {
      // il cronometro SOSPESO (esito 12-ter): dopo il cestino la barra NON sparisce — resta
      // ferma sul passo abbandonato, col ▶ che riavvia da lì e ⏹ che chiude la sessione
      const sSosp = (mCur && ['misura', 'analizza'].includes(mCur.phase) && mCur.measure && !mCur.measure.phase && mCur.measure.sospeso) ? mCur.measure : null;
      const passoSosp = sSosp ? V.byId(sSosp.sospeso, mCur) : null;
      misStopArm = null; misTrashArm = null; misWakeOff();
      if (misTick) { clearInterval(misTick); misTick = null; }
      if (passoSosp) {
        bar.classList.remove('hidden'); bar.classList.remove('vecchia');
        bar.innerHTML = ''
          + `<button id="mis-play" class="mis-btn" aria-label="Riavvia la misura su questo passo" title="Riavvia la misura su questo passo">${MIS_IC.play}</button>`
          + `<div class="mis-info"><span class="mis-tempo pausa">${misMMSS(0)}</span><span class="mis-nome">${esc(V.nomePasso(passoSosp, mCur))} · misura eliminata</span></div>`
          + `<button id="mis-stop" class="mis-btn stop" aria-label="Chiudi il giro" title="Chiudi il giro (la barra si toglie)">${MIS_IC.stop}</button>`;
        $('#mis-play', bar).onclick = () => { const r = V.measureStart(mCur, sSosp.sospeso, sSosp.mode || 'giro'); if (r && r.ko === 'in-corso') UI.toast('C’è già una misura in corso.'); UI.renderMisCtl(); };
        $('#mis-stop', bar).onclick = () => { V.measureStop(mCur); UI.renderMisCtl(); };
        return;
      }
      bar.classList.add('hidden');
      return;
    }
    bar.classList.remove('hidden');
    const s = sNow;
    const inPausa = V.measurePaused(m);
    const armato = !!(misStopArm && misStopArm.mapId === m.id && misStopArm.giro === (s.giro || 1));
    if (misStopArm && !armato) misStopArm = null;
    // il cestino armato vale per QUESTO lap: cambiato passo o t0, torna opaco (doppio check vero)
    const trashArmato = !!(misTrashArm && misTrashArm.mapId === m.id && misTrashArm.t0 === s.t0);
    if (misTrashArm && !trashArmato) misTrashArm = null;
    const passo = V.byId(s.stepId, m);
    const nome = passo ? (String(passo.props.title || '').trim() || 'passo senza nome') : '?';
    const che = altrove
      ? ('\u23f1 su \u00ab' + (String(m.title || '').trim() || 'foglio senza titolo') + '\u00bb \u2014 tocca per aprirlo')
      : (s.phase === 'attesa' ? ('attesa \u2192 ' + nome) : nome);
    // l'avviso \u00abaperta da un pezzo\u00bb BEN VISIBILE in barra (decisione Gt 26/8, stazione 12-B):
    // prima viveva solo dentro il dialogo Misura, e una misura dimenticata invecchiava in silenzio
    const vecchia = V.measureElapsed(m) > VECCHIA;
    bar.classList.toggle('vecchia', vecchia);
    bar.innerHTML = ''
      + (vecchia ? `<div class="mis-warn" role="alert">\u26a0 Misura aperta da un pezzo: se il giro era rimasto a met\u00e0 (app chiusa, tablet spento), apri \u22ef \u2192 \u00abMisura i tempi \u23f1\u00bb e tocca \u00abscarta\u00bb \u2014 il tempo che vedi non \u00e8 il tempo del passo.</div>` : '')
      + `<button id="mis-pausa" class="mis-btn" aria-label="${inPausa ? 'Riprendi il conteggio' : 'Pausa dell’osservatore'}" title="${inPausa ? 'Riprendi il conteggio' : 'Pausa dell\u2019osservatore: il tempo NON finisce nel dato'}">${inPausa ? MIS_IC.play : MIS_IC.pause}</button>`
      + `<div class="mis-info${altrove ? ' altrove' : ''}"${altrove ? ' role="button" tabindex="0" title="Apri il foglio che sta misurando"' : ''}><span class="mis-tempo${inPausa ? ' pausa' : ''}" id="mis-tempo">${misMMSS(V.measureElapsed(m))}</span><span class="mis-nome">${esc(che)}${s.turno ? ' \u00B7 ' + esc(s.turno) : ''}</span></div>`
      + (altrove ? '' : `<button id="mis-avanti" class="mis-btn mis-fine" aria-label="${s.phase === 'attesa' ? 'Comincia il prossimo passo' : 'Passo finito'}" title="${s.phase === 'attesa' ? 'Comincia il prossimo passo' : 'Passo finito: chiude il passo, l\u2019attesa corre da sola'}">${s.phase === 'attesa' ? MIS_IC.next : MIS_IC.lap}</button>`)
      + `<button id="mis-trash" class="mis-btn trash${trashArmato ? ' armato' : ''}" aria-label="${trashArmato ? 'Tocca di nuovo: elimina la misura in corso' : 'Elimina la misura in corso (due tocchi)'}" title="${trashArmato ? 'Tocca di nuovo: la misura in corso si elimina, niente viene scritto' : 'Elimina la misura in corso (chiede un secondo tocco): per quando il passo era quello sbagliato'}">${MIS_IC.trash}</button>`
      + (armato
        ? `<span class="mis-stoparm"><button id="mis-stop-si" class="mis-btn stop" aria-label="S\u00EC, chiudi il giro" title="S\u00EC, chiudi il giro">${MIS_IC.stop}</button><button id="mis-stop-no" class="mis-btn" aria-label="Annulla" title="Annulla">${MIS_IC.no}</button></span>`
        : `<button id="mis-stop" class="mis-btn stop" aria-label="Chiudi il giro" title="Chiudi il giro (chiede conferma)">${MIS_IC.stop}</button>`);
    $('#mis-pausa', bar).onclick = () => { misTrashArm = null; if (V.measurePaused(m)) V.measureResume(m); else V.measurePause(m); UI.renderMisCtl(); };
    const av = $('#mis-avanti', bar); if (av) av.onclick = () => { misTrashArm = null; UI.misAdvance(); };
    // il CESTINO (esito 12-bis, caso 1): primo tocco arma (da opaco a colorato), secondo elimina
    // la misura in corso SENZA scrivere niente — il giro resta pronto per il passo giusto
    const tr = $('#mis-trash', bar);
    if (tr) tr.onclick = () => {
      misStopArm = null;
      if (!trashArmato) { misTrashArm = { mapId: m.id, t0: s.t0 }; UI.renderMisCtl(); return; }
      misTrashArm = null;
      if (V.measureAbort(m)) UI.toast('Misura eliminata: niente è stato scritto. Il giro è pronto — tocca il cronometro del passo giusto.');
      UI.renderMisCtl();
    };
    // da un altro foglio il tocco sull'info RIPORTA al foglio che misura: chiudere il passo
    // senza vederlo non ha senso, fermare e mettere in pausa sì (decisione Gt 26/8)
    const info = $('.mis-info', bar); if (info && altrove) info.onclick = () => UI.openMap(m.id);
    const st = $('#mis-stop', bar); if (st) st.onclick = () => { misTrashArm = null; misStopArm = { mapId: m.id, giro: s.giro || 1 }; UI.renderMisCtl(); };
    const stSi = $('#mis-stop-si', bar); if (stSi) stSi.onclick = () => { misStopArm = null; V.measureStop(m); I.hint('Giro chiuso. \u22EF \u2192 \u00ABMisura i tempi \u23F1\u00BB per le misure prese e \u00ABCalcola i tempi\u00BB.', 5000); UI.renderMisCtl(); };
    const stNo = $('#mis-stop-no', bar); if (stNo) stNo.onclick = () => { misStopArm = null; UI.renderMisCtl(); };
    if (!misTick) misTick = setInterval(() => {
      const t = $('#mis-tempo'); const mm = V.measureActiveMap();
      // quando la misura scavalca la soglia dell'avviso la barra si ridisegna intera (compare il
      // cartello «aperta da un pezzo»); altrimenti si aggiorna solo il numero
      if (t && mm && (V.measureElapsed(mm) > VECCHIA) === bar.classList.contains('vecchia')) t.textContent = misMMSS(V.measureElapsed(mm));
      else UI.renderMisCtl();
    }, 1000);
    misWake();
  };
  /** Il tocco sul cronometro grande di un passo (data-mis, interact). Ritorna true se gestito. */
  UI.misTap = (id) => {
    const m = V.map(); if (!m || !['misura', 'analizza'].includes(m.phase)) return false;
    misStopArm = null; misTrashArm = null;
    const s = V.measureState(m);
    if (!s || !s.phase) {
      const r = V.measureStart(m, id);
      if (r && r.ko === 'in-corso') UI.toast('C\u2019\u00E8 una misura in corso: chiudila (\u23E9) o chiudi il giro prima di ripartire.');
      else if (r) I.hint('Cronometro avviato \u23F1 \u2014 \u23E9 quando il passo chiude: l\u2019attesa poi corre da sola, e il PROSSIMO passo lo scegli toccando il suo cronometro (\u25B6 segue il flusso).', 6000);
      else UI.toast('Qui il cronometro non parte: passo validato \u2713 o lucchetto chiuso.');
      UI.renderMisCtl(); return true;
    }
    if (s.phase === 'attesa') {
      // il PROSSIMO passo lo sceglie chi misura (bivi compresi): il tocco sul cronometro decide
      const r = V.measureJump(m, id);
      // la SCELTA del ramo non avvia niente (esito 14): la strada si illumina, l'attesa corre \u2014
      // si parte col \u25B6 verde, o ritoccando il passo scelto
      if (r && r.scelto) UI.toast('Ramo scelto \u2714 \u2014 l\u2019attesa continua a correre: \u25B6 (o un altro tocco qui) quando il lavoro comincia davvero su questo passo.');
      else if (r && r.fuoriOrdine) { const dest = V.byId(id, m); UI.toast('\u26A0 Non hai rispettato l\u2019ordine di lavoro: nessuna freccia arriva a \u00AB' + ((dest.props.title || 'questo passo')) + '\u00BB dal passo precedente \u2014 ' + r.attesaPersa + 's di attesa non scritti.'); }
      else if (r && r.ko === 'validato') UI.toast('Questo passo ha la \u2713: la misura non si scrive.');
      UI.renderMisCtl(); return true;
    }
    if (s.phase === 'box' && s.stepId === id) { UI.toast('Sta gi\u00E0 misurando questo passo: \u23E9 quando chiude.'); return true; }
    UI.toast('C\u2019\u00E8 un passo in corso: chiudilo (\u23E9) prima di sceglierne un altro.');
    return true;
  };
  UI.misAdvance = () => {
    const m = V.map(); if (!m) return;
    misStopArm = null;   // qualsiasi altra azione disarma la conferma di chiusura
    const r = V.measureAdvance(m);
    if (!r) return;
    if (r.ko === 'sparito') UI.toast('Il ' + (r.cosa || 'pezzo') + ' non c\u2019\u00E8 pi\u00F9: il giro si \u00E8 chiuso da solo.');
    else if (r.ko === 'validato') UI.toast('Questo passo ha la \u2713: la misura non si scrive. Scarta o riapri la \u2713.');
    else if (r.ko === 'foglio') UI.toast('Lucchetto del foglio chiuso: nessuna misura si scrive.');
    else if (r.chiuso) I.hint('Fine della catena: giro chiuso e salvato. \u00ABCalcola i tempi\u00BB scrive Hi/Lo/Avg.', 5000);
    else if (r.phase === 'attesa') {
      // al BIVIO lo si dice (esito 12-bis, caso 2): il modello sapeva gi\u00E0 saltare (S3-b), ma
      // senza una parola e senza il lampeggio la strada sembrava decisa dall'app
      const s2 = V.measureState(m);
      const rami = (s2 && s2.fromId) ? m.elements.filter(cc => cc.type === 'flow' && cc.from && cc.from.el === s2.fromId).length : 0;
      if (rami > 1) I.hint('Bivio: tocca il cronometro di un ramo per SCEGLIERE la strada (si illumina, l\'attesa continua); poi \u25b6 quando il lavoro comincia davvero.', 6000);
    }
    UI.renderMisCtl();
  };
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
    // Il cronometro si apre solo in Misura e Analizza (A1, decisione di Gt: impedire, non solo
    // segnalare — V.measureStart lo impedisce comunque anche se questo pannello si aggirasse). Fuori
    // fase il dialogo dice il perché con la frase del libro, e propone «passa a Misura» quando la
    // transizione è a un tocco (di solito da Valida).
    if (!['misura', 'analizza'].includes(map.phase)) {
      $('#mis-head').textContent = 'Misura';
      // Il bottone compare solo quando la transizione E' quella proposta dal libro: fase Valida
      // E staff che ha guardato il foglio (validation.validatedBy non vuoto) — non basta "si potrebbe
      // tecnicamente", altrimenti il bottone comparirebbe anche appena entrati in Valida, prima che
      // qualcuno l'abbia davvero validato (allineato alla proposta di #gp-validated, sotto).
      const puoi = V.canSetPhase(map, 'misura').ok && !!(map.validation && String(map.validation.validatedBy || '').trim());
      body.innerHTML = `<p class="notice">${esc(V.PHASE_HINT.misura)}. ${esc('Il cronometro si apre solo in Misura o Analizza: prima il flusso va camminato e validato (cap. 5).')}</p>`
        + (puoi ? `<div class="mis-acts"><button class="btn big primary" id="mis-goto-misura">Passa a Misura</button></div>` : '');
      const gm = $('#mis-goto-misura'); if (gm) gm.onclick = () => { V.setPhase(map, 'misura'); UI.renderHeader(); UI.renderMisura(); };
      return;
    }
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
      // il turno della sessione di misura (F1): visibile appena il cronometro esiste, MAI ereditato
      // in silenzio — quello che c'e' scritto qui e' quello che finisce su ogni osservazione
      if (s) {
        h += `<div class="field mis-turno"><input id="mis-turno" type="text" placeholder="turno (es. mattina) — facoltativo" value="${esc(s.turno || '')}" autocomplete="off">`
          + `<span class="hint">Va su ogni misura di questa sessione (si legge poi nel livello «Tempi e variabilità»). Svuota il campo per toglierlo; «chiudi il giro» lo azzera.</span></div>`;
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
        + `<div class="mm-chips">` + r.times.map((t, i) => `<button class="mm-chip${t < V.MISURA_BREVE ? ' breve' : ''}" data-mis-drop="${r.id}" data-i="${r.idx[i]}" title="${t < V.MISURA_BREVE ? `Solo ${t} second${t === 1 ? 'o' : 'i'}: un tocco per sbaglio? Toccala per scartarla` : 'Scarta questa misura'}">${esc(fmt(V.toUnit(t, map.unit)))} <span aria-hidden="true">✕</span></button>`).join('') + `</div></div>`).join('');
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
      const r = V.measureStart(map, primo.id, 'giro');
      if (r && r.ko === 'in-corso') UI.toast('C’è già una misura in corso: chiudila (⏩) o chiudi il giro prima di cominciarne un altro.');
      ridisegna();
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
    // niente ridisegna: si scrive lo stato e basta (un re-render a ogni blur farebbe perdere il filo)
    const tu = $('#mis-turno', body); if (tu) tu.onchange = () => V.measureTurno(map, tu.value);
    // «solo questo passo» NON straccia piu' un giro aperto (C5, Grok #4): il modello rifiuta e
    // qui lo si dice — come gia' faceva il tocco sul canvas («chiudilo prima»)
    $$('[data-mis-solo]', body).forEach(b => b.onclick = () => {
      const r = V.measureStart(map, b.dataset.misSolo, 'singolo');
      if (r && r.ko === 'in-corso') UI.toast('C’è una misura in corso: chiudila (⏩ o «passo finito») o chiudi il giro, poi misura questo passo da solo.');
      ridisegna();
    });
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
    { id: 'prima', t: 'La prima mappa', body: 'Il foglio nuovo è vuoto: tocca il punto dove vuoi il primo elemento e scegli dal menu rotondo che compare (Passo, Attesa, Problema, Persona, «Altro…» e le faccine in un pannello a sé). Oppure scegli lo strumento nella barra in basso e tocca il punto del foglio. Per spostare il foglio: col dito basta trascinare il vuoto; col mouse c’è la <b>mano</b> in «Altro» (poi «✓ Fine» per tornare a selezionare). Le mappe si salvano da sole, non c’è un tasto salva. Errore tipico: progettare tutto prima di disegnare — parti dal richiedente e segui il processo.' },
    { id: 'modifica', t: 'Modificare e collegare', body: 'Un tocco su un elemento apre le azioni rapide (+ Passo dopo, Collega →…); un secondo tocco apre i dettagli. «Collega →» apre un secondo menu con che cosa collegare: un passo nuovo, una scorta, un in-box, o un elemento già sul foglio — e sull\'omino prima ancora il verbo («chiede a…» / «si reca a…»). Per una freccia di flusso o di richiesta tieni premuto e trascina fino all’altro elemento. Un’estremità staccata è segnata in rosso tratteggiato: riagganciala, altrimenti resta fuori dalla timeline.' },
    { id: 'matita', t: 'Matita, coach, annulla', body: 'Con la Matita scrivi e disegni a mano libera (l’Apple Pencil scrive da sé, le dita muovono gli elementi). ✦ legge il foglio e propone modifiche: è un secondo parere, non un correttore — valuta prima di accettare. ↶ annulla l’ultima azione, tutte le volte che serve.' },
    { id: 'foglio', t: 'Leggere il foglio', body: 'Sotto i passi la timeline: verde in basso il tempo a valore, rosso in alto le attese; il riepilogo in basso a destra fa i conti (VA, NVA, VA %, First Time Quality). La catena ⛓ dice che un elemento è legato a un altro: spostando quello, si muove anche lui («Lega a…» / «Slega» nelle azioni rapide). Il lucchetto 🔒 invece inchioda un elemento al foglio: non si sposta finché non lo sblocchi («Blocca» / «Sblocca»). Il badge ↗ apre la mappa collegata (dettaglio, turno, futuro). La fase del foglio (accanto al titolo, in barra) dice dov’è nel prima-e-poi del libro: parte da «Disegna» e sale solo quando la tocchi tu (vedi Controlla sul campo e valida).' },
    { id: 'livelli', t: 'Più fogli, senza perdersi', body: 'Un passo può contenere un foglio suo: aprilo col badge ↗. Da lì in poi ogni passo ha un <b>indirizzo</b> — il passo 2 contiene il 2.1, che contiene il 2.1.1 — e l\'indirizzo si vede sul badge, nelle briciole in barra e nella <b>cartina</b> (l\'icona a destra, sopra lo zoom): la cartina dice sempre dove sei. «↑ su» in barra risale, selezionando il passo da cui eri sceso; ⋯ → «Questo foglio diventa un passo di…» fa il contrario, e appende il foglio che stai guardando sotto un passo di un processo più grande. Il badge <b>⇉</b> è un\'altra cosa: quel passo <i>richiama</i> un foglio che sta altrove (stesso processo, già disegnato) e ti dice dove. I numeri si ricalcolano da soli quando cambi le frecce: sono una scaletta, non un\'etichetta. Tutte le mappe di un lavoro stanno in un <b>progetto</b> (⋯ → «Progetti…»): gli elenchi mostrano solo quello in cui sei, e due progetti si parlano solo se li colleghi.' },
  ];
  const METODO = [
    { id: 'testata', t: 'Intestazione e scopo', body: 'Titolo, data e iniziali vivono in barra, in alto a sinistra: tocca l’intestazione per vederli e cambiarli (sul foglio A3 del libro stavano in alto a destra). Lo scopo in una frase: dalla richiesta X alla consegna Y. Una mappa = un processo solo: se cambia turno o unità, fai un’altra mappa, non una variante.', q: 'Cosa soddisfa esattamente questa mappa?', acts: [['title', 'Apri l’intestazione']] },
    { id: 'richiesta', t: 'La richiesta', body: 'Disegna il richiedente e tutte le vie reali con cui la richiesta arriva: telefono, fax, e-mail, a voce, di persona. La giungla di frecce in alto non è disordine da nascondere: è il primo spreco da attaccare, perché ogni via in più è una richiesta che può perdersi o essere fraintesa.', q: 'Quante mani tocca la richiesta prima di arrivare a chi eroga?', tools: [['person', 'Persona'], ['request', 'Richiesta']] },
    { id: 'flusso', t: 'Flusso e attese', body: 'Disegna i passi nell’ordine in cui avvengono davvero, non come dovrebbero: nello stato attuale ciò che sta nei box è valore adesso, si giudica dopo. Tra due passi metti sempre un delta se la cosa sta ferma. Più di 4-5 passi? Forse lo scopo è troppo largo.', q: 'Quale attività apre la porta del passo e quale la chiude?', tools: [['box', 'Passo'], ['delta', 'Attesa']] },
    { id: 'valida', t: 'Controlla sul campo e valida', body: 'Una mappa fatta alla scrivania è una bozza. Cammina il processo dall’inizio alla fine osservando, poi mostrala a chi fa il lavoro: accuratezza e adesione arrivano insieme. Le domande da fare sono due: «Ti sembra giusto? Ho lasciato fuori qualcosa?». Finché non l’hai fatto, la fase resta prima di Dati: il cronometro si apre solo dopo (cap. 5).', valida: true },
    { id: 'dati', t: 'Dati', body: 'Vengono dopo «Disegna e controlla» e la validazione, non insieme: si cronometra solo un flusso già validato dallo staff, altrimenti il numero è falso senza che nessuno se ne accorga (cap. 5). Per ogni passo e ogni attesa raccogli Hi / Lo / Avg, un’unità sola per tutta la mappa. L’attesa non si cronometra: si calcola per differenza, fine del passo precedente → inizio del successivo. Servono ~30 misure per dati credibili, 8-10 per una prima vista; il massimo è dove si nascondono interruzioni e workaround. Per misurarli camminando il processo: ⋯ → «Misura i tempi ⏱» (o il ⏱ accanto ai tempi di un passo). Il cronometro segue la catena: tu chiudi il passo, l’attesa nasce da sé fino a quando cominci il successivo. Poi «Calcola i tempi» scrive Hi/Lo/Avg. Il livello «Tempi e variabilità» (⋯ → Livelli di analisi) mostra su ogni passo misurato la media e quanto ballano le misure: sotto il ' + (V.analysis.CV_SOGLIE.stabile * 100) + '% di variazione stabile, sotto il ' + (V.analysis.CV_SOGLIE.moderata * 100) + '% moderata, oltre alta — soglie provvisorie, da tarare sulle vostre misure.', acts: [['misura', 'Apri il cronometro ⏱']], q: 'Perché a volte 5 minuti e a volte 19?' },
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
      b += `<label class="check" style="margin-top:8px"><input type="checkbox" id="gp-walked" ${map.validation.walked ? 'checked' : ''}> <span>Controllato sul campo (camminato: osservazione diretta)</span></label>`
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
    // Cammina → Valida in un gesto (decisione di Gt, 22 agosto, A1): segnare «camminato» propone
    // SUBITO Valida, perché col foglio in mano è un solo gesto — l'app propone, non decide da sola.
    const wk = $('#gp-walked', c); if (wk) wk.onchange = () => {
      const after = Object.assign(clone(V.map().validation), { walked: wk.checked, walkedDate: wk.checked ? today() : '' });
      V.commit({ t: 'meta', after: { validation: after } }, 'validazione', { silent: true });
      const m = V.map();
      if (wk.checked && V.canSetPhase(m, 'valida').ok) UI.toastAction('Controllato sul campo: passiamo a Valida?', 'Passa a Valida', () => { V.setPhase(m, 'valida'); UI.renderHeader(); });
    };
    // «Validata da» compilato propone Misura: lo staff ha guardato il foglio, si può cronometrare.
    const vd = $('#gp-validated', c); if (vd) {
      vd.addEventListener('input', () => { const after = Object.assign(clone(V.map().validation), { validatedBy: vd.value, validatedDate: vd.value ? today() : '' }); V.commit({ t: 'meta', after: { validation: after } }, 'validazione', { silent: true }); });
      vd.addEventListener('change', () => { const m = V.map(); if (vd.value.trim() && V.canSetPhase(m, 'misura').ok) UI.toastAction('Validato dallo staff: passiamo a Misura?', 'Passa a Misura', () => { V.setPhase(m, 'misura'); UI.renderHeader(); }); });
    }
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
    // «+ → ▭» (esito 13): il piu', la freccia, il passo nuovo — si legge come il gesto che fa
    next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12h3.6M4.3 10.2v3.6M9 12h5.2M11.8 9.2l2.8 2.8-2.8 2.8"/><rect x="16.5" y="7.5" width="5.5" height="9" rx="1"/></svg>',
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
  /** Il bottone a icona di un'azione (esito 13: lo usano la barra rapida E le azioni del pop-up
   *  — stessa fonte, stessa lettura). attr dice a chi risponde: data-qa (barra) o data-pa (pop). */
  UI.quickBtnHTML = (a, el, attr = 'data-qa') => {
    // due azioni cambiano verso con lo stato dell'elemento: l'icona e l'etichetta seguono
    let key = a.id;
    if (a.id === 'shrink' && el && el.props.collapsed) key = 'expand';
    if (a.id === 'legend' && el && !el.props.collapsed) return `<button class="pm-btn" ${attr}="legend" title="${esc(a.title || a.label)}">${IC.legend}<span>Chiudi</span></button>`;
    return `<button class="pm-btn${a.id === 'del' ? ' danger' : ''}" ${attr}="${a.id}" title="${esc(a.title || a.label)}">${QICN[key] || ''}<span>${esc(QLBL[key] || a.label)}</span></button>`;
  };
  const qBtn = (a, el) => UI.quickBtnHTML(a, el, 'data-qa');
  UI.hideQuick = () => { const q = $('#quick'); if (q) { q.classList.add('hidden'); Q.menu = null; } };
  /** Esc dentro il menu di «Collega» torna all'arco precedente invece di chiudere tutto */
  UI.quickMenuBack = () => { if (!Q.menu || !Q.el || !V.byId(Q.el)) { Q.menu = null; return false; } UI.quickAction('cx-back', Q.el); return true; };
  // «Torna al foglio» (esito 15): trascinando ci si può perdere — quando nella vista non c'è
  // più NESSUN elemento compare il bottone, e un tocco (I.fit) riporta dove stanno i nodi.
  // Ricalcolato a ogni pan/zoom, ma al più una volta per fotogramma.
  let vistaRAF = 0;
  const checkVistaVuota = () => {
    if (vistaRAF) return;
    vistaRAF = requestAnimationFrame(() => {
      vistaRAF = 0;
      let btn = $('#btn-ritrova');
      if (!btn) {
        btn = document.createElement('button'); btn.id = 'btn-ritrova'; btn.className = 'btn primary hidden';
        btn.textContent = '⌖ Torna al foglio'; btn.title = 'Riporta la vista dove stanno gli elementi';
        btn.onclick = () => I.fit();
        document.body.appendChild(btn);
      }
      const st = $('#stage'); const map = V.map();
      btn.classList.toggle('hidden', !(st && map && R.vistaVuota && R.vistaVuota(map, I.view, st.clientWidth || 800, st.clientHeight || 600)));
    });
  };
  UI.onView = () => { checkVistaVuota(); if (Q.el && !$('#quick').classList.contains('hidden')) UI.positionQuick(); if (V.pop.current && V.pop.current !== '__title__') { const el = V.byId(V.pop.current); if (el) V.pop.place(el); } };
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
    $$('[data-qa]', q).forEach(b => b.onclick = (ev) => { ev.stopPropagation(); UI.quickAction(b.dataset.qa, Q.el, { x: ev.clientX, y: ev.clientY }); });
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
    // in Misura/Analizza il menu di un elemento del FLUSSO (fermo) non offre l'armamentario del
    // disegno (esito Gt 25/8 sera): sul passo restano «Misura da qui» e «+ Problema»; frecce,
    // attese, persone e corsie non hanno menu — il secondo tocco apre i dettagli come sempre.
    // Gli oggetti liberi (nuvole, note, icone, facce) tengono le loro azioni.
    if (['misura', 'analizza'].includes(map.phase) && !V.isConnector(el) && !V.MISURA_LIBERI.includes(el.type) && el.type !== 'legend') {
      // \u00ABMisura da qui\u00BB non si capiva (esito 12, E12-e): il nome ora dice che cosa fa davvero
      if (el.type === 'box') { btn('mis', '\u23F1 Comincia il giro da qui', 'Fa partire (o continuare) il giro del cronometro da questo passo'); btn('cloud', '+ Problema', 'Un problema visto misurando, gia\' legato al passo'); }
      return A;
    }
    if (['misura', 'analizza'].includes(map.phase) && V.isConnector(el)) return A;
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
  // le icone dei TIPI di attesa (esito 13): le usano il popup radiale di «+ Passo dopo» e il
  // picker nel pannello dell'attesa (popover, via UI.ICONE_ATTESA) — una fonte sola
  const svgA = (inner) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  UI.ICONE_ATTESA = {
    attesa: svgA('<path d="M5 6.5h14L12 18.5z"/>'),
    'in-box': svgA('<path d="M4 13l2.5-7h11L20 13v5H4zM4 13h5l1.5 2h3L15 13h5"/>'),
    coda: svgA('<circle cx="5.5" cy="12" r="2.3"/><circle cx="12" cy="12" r="2.3"/><circle cx="18.5" cy="12" r="2.3"/>'),
    viaggio: svgA('<path d="M3.5 11.5h13M13 7.5l4 4-4 4M5.5 17.5h2.6M11 17.5h2.6"/>'),
    "sala d'attesa": svgA('<circle cx="12" cy="12" r="7.5"/><path d="M12 8.5v3.8l2.7 1.7"/>')
  };
  const VOCI_ATTESA = V.DELTA_KINDS.map(k => ({ id: 'a:' + k, label: k === "sala d'attesa" ? 'sala' : k, icon: UI.ICONE_ATTESA[k], title: 'Attesa di tipo «' + k + '»' }))
    .concat([{ id: 'a:nessuna', label: 'nessuna', icon: svgA('<path d="M5 12h14"/>'), title: 'Solo la freccia: nessuna attesa fra i due passi' }]);
  UI.quickAction = (a, id, opts) => {
    const map = V.map(); const el = V.byId(id, map); if (!el) return;
    switch (a) {
      // il TIPO di attesa si sceglie PRIMA (esito 13): popup a cerchio nello stile del canvas,
      // «nessuna» compresa — solo dopo nascono passo, freccia e segnale sull'attesa
      case 'next': {
        const at = (opts && opts.x != null) ? opts : (() => { const r = $('#stage').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })();
        apriRadiale(at.x, at.y, VOCI_ATTESA, (vid) => {
          UI.closePlaceMenu();
          const r = V.addNextStep(map, el.id, vid === 'a:nessuna' ? null : vid.slice(2));
          if (!r) { UI.toast(V.DENIED_MSG.fase || 'Qui non si può.'); return; }
          I.select([r.boxId], { keepPop: true }); V.pop.open(r.boxId);
        }, 'Che attesa c\'è fra questo passo e il prossimo?');
        break; }
      case 'delta': { const f = map.elements.find(c => c.type === 'flow' && c.from.el === el.id); if (!f) return; const d = V.newElement('delta', 0, 0, {}); d.props.attachedTo = f.id; d.props.dx = 0; d.props.dy = 0; V.commit({ t: 'add', el: d }, 'attesa'); I.select([d.id], { keepPop: true }); V.pop.open(d.id); break; }
      // il problema creato DAL passo nasce gia' legato a quel passo (esito stazione 1, 25/8):
      // se si sposta il passo il problema lo segue e non si mescola con gli altri. Legato, non
      // bloccato: da solo resta trascinabile, e «Slega» lo libera. Stesso pattern di I.placeKind.
      case 'cloud': { const pp = R.elPos(el, map); const s = V.newElement('storm', pp.x + el.w - 60, pp.y - 62, {}); I.lockOps(s, { id: el.id }, map).forEach(op => Object.assign(op.t === 'props' ? s.props : s, op.after)); V.commit({ t: 'add', el: s }, 'nuvola'); I.select([s.id], { keepPop: true }); V.pop.open(s.id); break; }
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
      case 'mis': UI.misTap(id); break;
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
