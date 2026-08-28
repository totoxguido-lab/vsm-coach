/* VSM Coach v2 — main.js: avvio, header, menu, libreria mappe, sincronizzazione render su ogni commit. */
(function (V) {
  'use strict';
  const I = V.interact, R = V.render, UI = V.ui, C = V.coach; const { clone, today } = V.util;
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  function fullRender() { const map = V.map(); R.all(map, { selection: I.selection.filter(id => V.byId(id, map)) }); UI.renderHeader(); UI.renderCartina && UI.renderCartina(); if (UI.guideVisible && UI.guideVisible()) UI.renderGuide(); if (!$('#drawer').classList.contains('closed') && !$('#pane-plan').classList.contains('hidden')) UI.renderPlan(); UI.renderMisCtl && UI.renderMisCtl(); }
  let sugTimer = null;
  V.onChange((info) => {
    if (info.switched) { I.selection = []; V.pop.close(); UI.hideQuick(); fullRender(); return; }
    // rendering incrementale quando possibile
    const map = V.map(); const ops = info.ops || [];
    const onlyProps = ops.length && ops.every(o => o.t === 'props' || o.t === 'update');
    // spostare o ricollegare una via di richiesta cambia il punto d'arrivo anche delle sue sorelle
    // (si dividono il bordo alto del passo): vanno ridisegnate tutte, o restano sovrapposte fino al
    // prossimo disegno completo
    const toccaVie = ops.some(o => { const el = o.id && V.byId(o.id, map); return el && el.type === 'request'; });
    if (onlyProps && !info.undo && !info.redo) { ops.forEach(o => R.updateEl(o.id, map)); if (toccaVie) map.elements.filter(e => e.type === 'request').forEach(r => R.updateEl(r.id, map)); R.overlay(map); R.selection(I.selection, map); UI.renderHeader(); if (V.pop.current && V.pop.current !== '__title__' && ops.some(o => o.id === V.pop.current)) { if (ops.every(o => o.t === 'update')) V.pop.place(V.byId(V.pop.current, map)); V.pop.refresh && V.pop.refresh(V.pop.current); } }
    else if (ops.length && ops.every(o => o.t === 'stroke_add' || o.t === 'stroke_remove') && !info.undo && !info.redo) { R.strokes(map); UI.renderHeader(); }
    // cambiare il tratto dei collegamenti tocca ogni freccia del foglio: il ramo leggero dei meta
    // ridisegnava solo carta e riepilogo, e la modalità nuova si vedeva solo alla prossima modifica
    else if (ops.length && ops.every(o => o.t === 'meta') && ops.some(o => o.after && o.after.links) && !info.undo && !info.redo) { R.paper(map); R.elements(map); R.overlay(map); R.selection(I.selection, map); UI.renderHeader(); }
    else if (ops.length && ops.every(o => o.t === 'meta') && !info.undo && !info.redo) { R.paper(map); R.overlay(map); UI.renderHeader(); /* la guida non si ridisegna sui meta: chi scrive nei suoi campi non deve perdere il cursore */ }
    else fullRender();
    if ((info.undo || info.redo) && V.pop.current && V.pop.current !== '__title__' && !V.byId(V.pop.current, map)) V.pop.close();
    // il pop-up SOPRAVVISSUTO a un annulla mostrava ancora i valori di prima (visto dal vivo su F1:
    // la classificazione annullata restava scritta nella sezione) — un refresh, non una chiusura
    else if ((info.undo || info.redo) && V.pop.current && V.pop.current !== '__title__' && V.pop.refresh) V.pop.refresh(V.pop.current);
    if (info.undo || info.redo) { I.selection = I.selection.filter(id => V.byId(id, map)); R.selection(I.selection, map); UI.onSelection(I.selection); }
    if (UI.guideVisible && UI.guideVisible() && !(ops.length && ops.every(o => o.t === 'meta'))) UI.renderGuide();
    clearTimeout(sugTimer); sugTimer = setTimeout(UI.evalSuggest, 1800);
  });

  /** Elimina una mappa leggendo l'esito che il modello restituisce, invece di dare per scontato che sia
   *  andata: a lucchetto chiuso non si elimina niente, e se se ne andrebbe l'ultimo Attuale di un Ideale
   *  la conferma nomina entrambi i fogli (prima l'Ideale restava senza nessuno stato attuale a cui tornare). */
  function deleteMapAsked(map) {
    let r = V.deleteMap(map.id);
    if (!r.ok && r.reason === 'pair') {
      const t = r.idealTitle ? `«${r.idealTitle}»` : 'senza titolo';
      if (!confirm(`Questo è l'ultimo giro dell'Attuale: da solo non si può eliminare, perché l'Ideale ${t} resterebbe senza uno stato attuale a cui tornare.\n\nEliminare Attuale e Ideale insieme? Non si può annullare.`)) return r;
      r = V.deleteMap(map.id, { withPair: true }); r.withPair = r.ok;
    }
    return r;
  }
  function download(name, content, type) { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000); }
  const slug = (s) => (s || 'vsm').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || 'vsm';

  /** Le note di V.migrate (spec fondamenta A8) in una frase per il toast: 'cronometro-chiuso:<mapId>'
   *  per ogni giro che aveva un cronometro rimasto aperto e non e' sopravvissuto alla migrazione
   *  (V.migrate, model.js: scartato perche' la fase risultante non e' 'misura'). Prima non la mostrava
   *  nessuno: chi riapriva o importava un file cosi' non sapeva che il cronometro s'era chiuso (rilievo
   *  del revisore finale). UNA frase sola anche con piu' mappe: si conta, non si elenca un giro per riga.*/
  function notaCronometriChiusi(note) {
    const n = (note || []).filter(x => typeof x === 'string' && x.indexOf('cronometro-chiuso:') === 0).length;
    if (!n) return '';
    return n === 1 ? 'Un cronometro rimasto aperto è stato chiuso.' : (n + ' cronometri rimasti aperti sono stati chiusi.');
  }

  /** Gli allegati di un foglio appena importato di cui su QUESTO iPad non ci sono i byte (F1-1C,
   *  D-14, 02-RESEARCH.md §Pitfall 6). Nel pannello del passo compariranno come segnaposti
   *  dichiarati; senza questa riga nessuno saprebbe perché, e «tre foto diventate riquadri vuoti»
   *  è esattamente la sparizione silenziosa che C-2 vieta.
   *  Il conto vero lo fa V.allegatiMancanti, che apre il database: qui c'è solo la frase, e arriva
   *  DOPO il toast dell'import perché quella è la risposta alla domanda che nasce guardandolo. */
  function notaAllegatiAltrove(mapIds) {
    if (!mapIds || !mapIds.length || !V.allegatiMancanti) return;
    V.allegatiMancanti(mapIds).then(n => {
      if (!n) return;
      setTimeout(() => UI.toast(n === 1
        ? '1 allegato è rimasto sull’iPad dove è stato preso: qui resta il segnaposto.'
        : n + ' allegati sono rimasti sull’iPad dove sono stati presi: qui restano i segnaposti.'), 2400);
    }).catch(() => { /* il conto non riuscito non deve rovinare un import andato bene */ });
  }

  function bindHeader() {
    // il titolo non si scrive piu' inline: il blocco in barra apre il pop-up con tutti i dati (e la modifica)
    $('#map-head').onclick = () => { if (V.pop.current === '__title__') V.pop.close(); else V.pop.openTitle(); };
    // Attuale a giri: un tocco porta all'ultimo giro; un tocco quando si e' gia' sull'attuale apre
    // l'elenco dei giri (apri, rinomina col ✎, «+ nuovo giro»). L'Ideale e' uno solo per catena.
    const escT = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const versList = $('#vers-list');
    const TRASH = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7h14M10 7V5h4v2"/><path d="M7 7l1 13h8l1-13"/><path d="M10.5 11v5M13.5 11v5"/></svg>';
    const renderVers = () => {
      const cur = V.map(); const chain = V.versionsOf(cur);
      // il cestino c'e' solo se i giri sono almeno due: l'ultimo attuale non si elimina da qui
      versList.innerHTML = chain.map(v => `<div class="vrow"><button data-v="${v.id}" aria-current="${v.id === cur.id}">${escT(v.verName || 'attuale')}</button><button class="vrn" data-rn="${v.id}" title="Rinomina questo giro" aria-label="Rinomina">✎</button>${chain.length > 1 ? `<button class="vrn vdel" data-del="${v.id}" title="Elimina questo giro" aria-label="Elimina il giro">${TRASH}</button>` : ''}</div>`).join('')
        + `<button class="vnew" data-vnew="1">+ nuovo giro (copia di questo)</button>`;
      $$('[data-v]', versList).forEach(b => b.onclick = () => { versList.classList.add('hidden'); if (b.dataset.v !== V.map().id) UI.openMap(b.dataset.v); });
      $$('[data-rn]', versList).forEach(b => b.onclick = () => {
        const v = V.doc.maps[b.dataset.rn]; if (!v) return; const row = b.closest('.vrow');
        row.innerHTML = `<input value="${escT(v.verName || '')}" maxlength="40" aria-label="Nome del giro">`;
        const inp = row.querySelector('input'); inp.focus(); inp.select();
        const done = () => { const nv = inp.value.trim(); if (nv) { v.verName = nv; v.rev = (v.rev | 0) + 1; V.save(); } renderVers(); UI.renderHeader(); };
        inp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') inp.blur(); if (ev.key === 'Escape') { inp.value = v.verName || ''; inp.blur(); } });
        inp.addEventListener('blur', done);
      });
      // doppio controllo: il cestino non elimina, trasforma la riga nella domanda con Elimina/Annulla
      $$('[data-del]', versList).forEach(b => b.onclick = () => {
        const v = V.doc.maps[b.dataset.del]; if (!v) return; const row = b.closest('.vrow');
        row.innerHTML = `<span class="vdel-q">Eliminare «${escT(v.verName || 'giro')}»?</span><button class="btn small danger" data-delyes="${v.id}">Elimina</button><button class="btn small" data-delno="1">Annulla</button>`;
        row.querySelector('[data-delno]').onclick = renderVers;
        // il messaggio segue l'esito: se il modello ha rifiutato, dirlo, non annunciare un'eliminazione
        // che non e' avvenuta
        row.querySelector('[data-delyes]').onclick = () => { const r = deleteMapAsked(v); if (r.ok) UI.toast(r.withPair ? 'Attuale e Ideale eliminati.' : `Giro «${v.verName || ''}» eliminato.`); renderVers(); };
      });
      $('[data-vnew]', versList).onclick = () => { versList.classList.add('hidden'); const base = V.map().kind === 'current' ? V.map() : V.currentOf(V.map()); if (!base) return; const nv = V.createVersion(base); UI.openMap(nv.id); UI.toast('Nuovo giro dell’attuale creato come copia: aggiorna quello che è cambiato.'); };
    };
    document.addEventListener('pointerdown', (ev) => { if (versList.classList.contains('hidden')) return; if (ev.target.closest && (ev.target.closest('#vers-list') || ev.target.closest('#tab-current'))) return; versList.classList.add('hidden'); }, true);
    // l'elenco dei giri si apre anche dal menu ⋯ (su telefono la testata non c'e')
    UI.openVersions = () => {
      const m = V.map();
      const base = m.kind === 'current' ? m : V.currentOf(m);
      if (!base) { UI.toast('Questa mappa non ha uno stato attuale collegato.'); return; }
      if (base !== m) { UI.openMap(base.id); }
      renderVers(); versList.classList.remove('hidden');
    };
    $('#tab-current').onclick = () => {
      const m = V.map();
      if (m.kind === 'current') { renderVers(); versList.classList.toggle('hidden'); return; }
      const chain = V.versionsOf(m);
      if (chain.length) UI.openMap(chain[chain.length - 1].id);
      else UI.toast('Questa mappa non ha uno stato attuale collegato.');
    };
    // "Ideale" apre l'unico ideale della catena, o lo crea come copia: niente conferme
    $('#tab-future').onclick = () => {
      const m = V.map(); const f = V.idealOf(m);
      if (f === m) return;
      if (f) { UI.openMap(f.id); return; }
      if (m.kind === 'current') { const nf = V.createFuture(m); UI.openMap(nf.id); UI.toast('Ideale creato come copia dell’attuale: disegna dove volete arrivare, poi validalo col lucchetto.'); }
      else UI.toast('I sotto-fogli non hanno un Ideale: torna alla mappa madre.');
    };
    $('#mh-phase').onclick = () => UI.openFase();
    $('#fase-close').onclick = () => $('#dlg-fase').close();
    // il «?» del dialogo delle fasi: mostra/nasconde la spiegazione (prova iPad 25/8)
    const fh = $('#fase-help'); if (fh) fh.onclick = () => { UI._faseAiuto = !UI._faseAiuto; UI.renderFase(); };
    $('#tab-lock').onclick = () => {
      const m = V.map(); if (m.kind !== 'future') return;
      V.setValidated(m, !m.validated);
      UI.toast(m.validated ? 'Ideale validato \u{1F512}: per modificarlo riapri il lucchetto.' : 'Lucchetto aperto \u{1F513}: l’Ideale si può modificare.');
    };
    // Le frecce rispondono SEMPRE (cancello 1B, rilievo 4 — «Grigia sì, ma che dica perché»):
    // quando non c'è da lavorare non succede niente in silenzio, si dice il perché.
    const freccia = (verso, fa) => () => { const m = V.motivoAnnulla(verso); if (m) UI.toast(m); else fa(); };
    $('#btn-undo').onclick = freccia('undo', () => V.undo()); $('#btn-redo').onclick = freccia('redo', () => V.redo());
    $('#drawer-close').onclick = UI.closeDrawer;
    ['coach', 'plan'].forEach(t => $('#tab-' + t).onclick = () => UI.showTab(t));
    // il bottone «Mappe» in barra non c'e' piu' (feedback iPad 25/8): la libreria vive in ⋯ → «Le tue mappe»
    $('#maps-close').onclick = () => $('#dlg-maps').close();
    $('#mis-close').onclick = () => UI.closeMisura();
    // il cronometro non deve continuare a girare dietro un dialogo chiuso col tasto Esc
    $('#dlg-misura').addEventListener('close', () => UI.closeMisura());
    const menuCheck = (id, on) => { const b = $(id); b.setAttribute('aria-pressed', on); b.textContent = (on ? '✓ ' : '○ ') + b.textContent.replace(/^[✓○] /, ''); };
    $('#btn-overlays').onclick = () => { const m = V.map(); V.layers.toggle(m, 'riepilogo'); R.overlay(m); menuCheck('#btn-overlays', !!(m.layers && m.layers.riepilogo)); };
    // il menu dei livelli (spec D): elenca solo quelli ammessi dalla fase corrente, in ordine di
    // registrazione — in fase 0 c'e' solo il riepilogo (gia' nel bottone sopra), ma il meccanismo
    // e' quello che ospitera' F1-F10 senza altre modifiche a questo file.
    $('#btn-layers-menu').onclick = () => { $('#menu').classList.add('hidden'); UI.layersMenu(); };
    $('#btn-pen-mode').onclick = () => { I.penDraws = !I.penDraws; localStorage.setItem('vsm.penDraws', I.penDraws ? '1' : '0'); menuCheck('#btn-pen-mode', I.penDraws); UI.toast(I.penDraws ? 'Penna: sulla carta vuota scrive a matita.' : 'Penna: usa lo strumento scelto.'); };
    $('#btn-tools-left').onclick = () => { UI.setToolsLeft(!$('#app').classList.contains('tools-left')); };
    // aspetto dei collegamenti: si cicla fra le modalità, così si confronta a colpo d'occhio quale si legge meglio
    const linkModeLabel = () => { const m = V.linkModeOf(V.map()); $('#btn-link-mode').textContent = 'Frecce: ' + ({ dritta: 'dritte', curva: 'curve' }[m] || m); };
    $('#btn-link-mode').onclick = () => {
      const map = V.map(); const ids = V.LINK_MODES.map(x => x.id); const cur = V.linkModeOf(map);
      const next = V.LINK_MODES[(ids.indexOf(cur) + 1) % ids.length];
      V.commit({ t: 'meta', after: { links: { mode: next.id } }, before: { links: { mode: cur } } }, 'aspetto dei collegamenti');
      linkModeLabel(); UI.toast('Frecce: ' + next.name + ' — ' + next.hint);
    };
    UI.linkModeLabel = linkModeLabel;
    $('#btn-trace').onclick = () => {
      R.traceOn = !R.traceOn; localStorage.setItem('vsm.trace', R.traceOn ? '1' : '0');
      menuCheck('#btn-trace', R.traceOn); R.selection(I.selection, V.map());
      UI.toast(R.traceOn ? 'Selezionando un elemento si illumina dove va a finire.' : 'Evidenziazione del percorso spenta.');
    };
    // formato delle misurazioni (esito 12, E12-b): convenzione cronometro (50″, 1′20″) di casa,
    // oppure l'unita' del foglio — la scelta vive in localStorage e ridisegna subito badge e viste
    $('#btn-timefmt').onclick = () => {
      const nuovo = V.timeFmt() === 'crono' ? 'unita' : 'crono';
      try { localStorage.setItem('vsm.timefmt', nuovo); } catch (e) { /* storage bloccato */ }
      menuCheck('#btn-timefmt', nuovo === 'crono');
      fullRender();
      UI.toast(nuovo === 'crono' ? 'Misurazioni in formato cronometro: 50″, 1′20″.' : 'Misurazioni nell\'unità del foglio (es. minuti).');
    };
    UI.menuCheck = menuCheck;
    $('#zoom-in').onclick = () => { const r = $('#stage').getBoundingClientRect(); I.zoomAt(1.2, r.left + r.width / 2, r.top + r.height / 2); };
    $('#zoom-out').onclick = () => { const r = $('#stage').getBoundingClientRect(); I.zoomAt(1 / 1.2, r.left + r.width / 2, r.top + r.height / 2); };
    $('#zoom-fit').onclick = () => I.fit();
    $('#ui-toggle').onclick = () => UI.toggleChrome();
    // La linguetta risponde al pointerup, non al click: su iPad il click sintetizzato dopo il tocco
    // puo' perdersi o raddoppiare vicino al bordo del foglio; cosi' il gesto e' deterministico.
    const ptog = $('#palette-toggle');
    ptog.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); });
    ptog.addEventListener('pointerup', (e) => { e.stopPropagation(); e.preventDefault(); UI.setPaletteHidden(!$('#app').classList.contains('palette-hidden')); });
    // menu: i sottogruppi (File, Opzioni, Coach) si aprono a fisarmonica, uno alla volta, e si richiudono a ogni apertura
    const menu = $('#menu');
    const closeSubs = () => { $$('#menu .submenu').forEach(s => s.classList.add('hidden')); $$('#menu .sub-head').forEach(h => h.setAttribute('aria-expanded', 'false')); };
    $$('#menu .sub-head').forEach(h => h.onclick = () => { const s = $('#sub-' + h.dataset.sub); const wasClosed = s.classList.contains('hidden'); closeSubs(); if (wasClosed) { s.classList.remove('hidden'); h.setAttribute('aria-expanded', 'true'); } });
    $('#btn-menu').onclick = (e) => { e.stopPropagation(); const opening = menu.classList.contains('hidden'); menu.classList.toggle('hidden'); if (opening) closeSubs(); };
    document.addEventListener('pointerdown', (e) => {
      if (!menu.classList.contains('hidden') && !menu.contains(e.target) && e.target !== $('#btn-menu')) menu.classList.add('hidden');
      if (!$('#more-tools').classList.contains('hidden') && !$('#more-tools').contains(e.target) && !e.target.closest('[data-tool="more"]')) $('#more-tools').classList.add('hidden');
      // il tocco sul vuoto chiude PRIMA la scheda flottante della guida (il pannello resta); solo un
      // secondo tocco fuori chiude anche il pannello
      if (UI.guideCardOpen && UI.guideCardOpen() && !e.target.closest('#gpcard')) { UI.closeGuideCard(); if (!$('#guidepop').contains(e.target)) return; }
      if (UI.guideVisible() && !$('#guidepop').contains(e.target) && !e.target.closest('#gpcard')) UI.toggleGuide(false);
    });
    // il menu resta aperto (si chiude toccando fuori): cosi' si spuntano piu' opzioni di fila.
    // Fa eccezione cio' che apre un'altra superficie in alto a destra (guida, legenda, dialoghi) o chiude la mappa.
    const CLOSE_ON = ['legend', 'guide', 'maps', 'help', 'settings', 'coach', 'delete', 'reset', 'exit', 'giri', 'lock', 'info', 'misura', 'attach', 'projects'];
    $$('#menu [data-m]').forEach(b => b.onclick = () => { if (CLOSE_ON.includes(b.dataset.m)) menu.classList.add('hidden'); menuAction(b.dataset.m); });
    UI.loadExample = () => { UI.toggleGuide(false); menuAction('example'); };
    $('#file-open').addEventListener('change', (e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { const prima = new Set(Object.keys(V.doc.maps)); const res = V.importMaps(JSON.parse(r.result)); I.restoreView(); const cron = notaCronometriChiusi(res.note); UI.toast(res.count + ' mappe importate' + (res.note && res.note.includes('v2') ? ' (convertito dalla 0.9)' : '') + '.' + (cron ? ' ' + cron : '')); notaAllegatiAltrove(Object.keys(V.doc.maps).filter(k => !prima.has(k))); } catch (err) { UI.toast('File non valido: ' + err.message); } }; r.readAsText(f); e.target.value = ''; });
  }
  function menuAction(a) {
    const map = V.map();
    switch (a) {
      case 'new': { UI.closeDrawer(); const m = V.addMap(V.newMap({ title: '', authors: map.authors, unit: map.unit })); UI.openMap(m.id); I.fit(); UI.toast('Nuovo foglio. Tocca il titolo in barra, in alto a sinistra, per intestarlo.'); break; }
      // solo su schermi piccoli, dove il selettore Attuale/Futuro in testata non c'è
      // su schermi piccoli il selettore in testata non c'e': i giri e il lucchetto dell'Ideale
      // (che e' un passaggio del metodo, non un dettaglio) si raggiungono da qui
      case 'giri': { UI.openVersions ? UI.openVersions() : UI.toast('I giri si vedono dalla testata.'); break; }
      case 'lock': {
        const f = map.kind === 'future' ? map : V.idealOf(map);
        if (!f) { UI.toast('Questa catena non ha ancora un Ideale: crealo con «Attuale ⇄ Ideale».'); break; }
        if (f !== map) UI.openMap(f.id);
        V.setValidated(f, !f.validated);
        UI.toast(f.validated ? 'Ideale validato \u{1F512}: per modificarlo riapri il lucchetto.' : 'Lucchetto aperto \u{1F513}: l’Ideale si può modificare.');
        break;
      }
      case 'info': {
        const m2 = V.map(); const M = V.metrics(m2);
        const at = V.lastSaved(); const salvato = at ? new Date(at).toLocaleString('it-CH') : '—';
        // Lo spazio (piano 02-11): sono le due righe che Gt legge sull'iPad alla stazione 6 della
        // checklist. Parole di reparto, non di database: «tenuto da parte», non «quota» ne'
        // «origine». Sono anche l'unico modo di sciogliere l'assunzione A3 della ricerca — le
        // fonti si contraddicono su che cosa serva a Safari per concedere la persistenza, quindi
        // l'esito si guarda invece di darlo per noto.
        const p = V.storage.persistente;
        const tenuto = p === true ? 'sì' : p === false ? 'no — il sistema può liberarlo se gli serve posto' : 'non richiesto';
        const misura = (n) => (typeof n === 'number' && isFinite(n) && n >= 0)
          ? (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' kB') : '?';
        const st = V.storage.stima;
        const usato = (st && typeof st.usage === 'number')
          ? misura(st.usage) + (typeof st.quota === 'number' ? ' su ' + misura(st.quota) + ' disponibili' : '')
          : 'non disponibile';
        // niente contenuti della mappa: solo come e' fatta e da dove viene la build
        const info = [
          'VSM Coach ' + V.versionLabel(),
          'indirizzo: ' + location.origin + location.pathname,
          'installata: ' + (window.matchMedia('(display-mode: standalone)').matches ? 'sì (schermata Home)' : 'no (scheda del browser)'),
          'browser: ' + navigator.userAgent,
          'mappa attiva: ' + V.kindLabel(m2) + (m2.validated ? ' 🔒' : '') + ' · ' + M.boxes + ' box, ' + M.deltas + ' delta, ' + M.requests + ' vie, ' + m2.strokes.length + ' tratti',
          'mappe in libreria: ' + Object.keys(V.doc.maps).length,
          'ultimo salvataggio: ' + salvato,
          'spazio tenuto da parte: ' + tenuto,
          'spazio usato: ' + usato,
          // Chi apre l'app puo' non essere in Safari: sull'iPad aziendale di Gt il browser e'
          // Web@Work (MobileIron), e un browser dentro un contenitore gestito puo' non offrire
          // affatto il service worker. Senza service worker NON c'e' apertura senza rete — cioe'
          // salta l'assunzione su cui poggia tutta la stazione 7, e nessuno se ne accorgerebbe
          // finche' qualcuno non prova a camminare in reparto col wi-fi assente. Qui la domanda
          // si risponde guardando, come per lo spazio tenuto da parte.
          'apertura senza rete: ' + (!('serviceWorker' in navigator)
            ? 'no — questo browser non offre il service worker'
            : (navigator.serviceWorker.controller ? 'sì' : 'non ancora: chiudi e riapri l\u2019app'))
        ].join('\n');
        const copia = () => { try { navigator.clipboard.writeText(info); UI.toast('Dati per la diagnosi copiati.'); } catch (e) { alert(info); } };
        copia();
        break;
      }
      case 'af': { if (map.kind === 'future') { const chain = V.versionsOf(map); if (chain.length) UI.openMap(chain[chain.length - 1].id); } else { const f = V.idealOf(map); if (f && f !== map) UI.openMap(f.id); else if (map.kind === 'current') { const nf = V.createFuture(map); UI.openMap(nf.id); UI.toast('Ideale creato come copia: disegna dove volete arrivare.'); } else UI.toast('I sotto-fogli non hanno un Ideale.'); } break; }
      case 'detail': { const d = V.createDetail(map, ''); if (!d) { UI.toast(V.DENIED_MSG.fase); break; } UI.openMap(d.id); I.fit(); UI.toast('Mappa di dettaglio: collegala da un box (pop-up → Collega a un\'altra mappa).'); break; }
      case 'example': { const m = V.addMap(V.example()); UI.openMap(m.id); I.fit(); UI.toast('Esempio caricato (numeri dalla Fig. 5.1 del libro).'); break; }
      case 'open': $('#file-open').click(); break;
      // il file porta con sé la versione che l'ha scritto: aprendo un JSON di mesi fa si sa con che build è nato
      case 'save': download(`vsm-coach-${slug(map.title)}-${today()}.json`, JSON.stringify(Object.assign({ appVersion: V.VERSION }, V.doc), null, 1), 'application/json'); UI.toast('JSON scaricato (tutte le mappe).'); break;
      case 'svg': download(`${slug(map.title)}-${map.kind}.svg`, R.exportSVG(map), 'image/svg+xml'); break;
      case 'print': window.print(); break;
      case 'legend': UI.toggleGuide(true, 'simboli'); break;
      case 'guide': UI.toggleGuide(true); break;
      case 'maps': UI.renderMaps(); $('#dlg-maps').showModal(); break;
      case 'misura': UI.openMisura(); break;
      case 'attach': UI.askAttach(); break;
      case 'projects': UI.askProjects(); break;
      case 'help': UI.toggleGuide(true, 'primi'); break;
      case 'coach': UI.showTab('coach'); break;
      case 'settings': C.openSettings(); break;
      case 'clear-ink': if (map.strokes.length && confirm('Cancellare tutti i tratti a matita di questa mappa?')) V.commit({ t: 'strokes_set', after: [] }, 'cancella inchiostro'); break;
      case 'reset': {
        // Doppio controllo, e il secondo dice quanto si perde: azzerare non si annulla, e chi lo tocca
        // per sbaglio deve avere due occasioni di fermarsi. Poi la pagina si ricarica: il documento in
        // memoria non vale piu' niente, e ripartire da zero e' il senso stesso della voce.
        const n = Object.keys(V.doc.maps).length;
        if (!confirm(`Azzerare la copia di prova?\n\nSi cancellano TUTTE le mappe di questa copia (${n}) e la sua cache. Non si può annullare.\n\nL'app installata (quella stabile) non viene toccata.`)) break;
        if (!confirm('Ultimo controllo: le mappe che vuoi tenere le hai salvate in JSON (⋯ → File e stampa → «Salva JSON»)?\n\nOK = azzera adesso.')) break;
        UI.toast('Azzero…');
        V.azzeraSpazio().then(() => location.reload()).catch(() => location.reload());
        break;
      }
      // Eliminare un foglio: la domanda la fa una finestra DELL'APP, non il pop-up del browser
      // (rilievo 2 del cancello 1B), e se sul foglio ci sono foto o memo lo dice prima — «spariscono
      // anche loro» (F1-1C, D-15, UI-SPEC §Copywriting). I numeri vengono da V.contaAllegati, che
      // legge i metadati dal documento: la domanda si risponde senza aprire un database.
      case 'delete': {
        const nFigli = Object.values(V.doc.maps).filter(o => o.parentId === map.id).length;
        const codaFigli = nFigli ? (nFigli === 1 ? '\n\nIl suo sotto-foglio non si perde: si riappende più in alto.' : `\n\nI suoi ${nFigli} sotto-fogli non si perdono: si riappendono più in alto.`) : '';
        const alleg = V.contaAllegati(map);
        const codaAlleg = alleg.totale ? ('\n\nSu questa mappa ci sono ' + V.fraseAllegati(alleg) + ': spariscono anche loro.') : '';
        const elimina = () => { const r = deleteMapAsked(map); if (r.ok) { I.restoreView(); V.saveNow(); UI.toast(r.withPair ? 'Attuale e Ideale eliminati.' : 'Mappa eliminata.'); } };
        UI.chiediConferma({
          titolo: 'Eliminare la mappa?',
          testo: `«${map.title || 'senza titolo'}» — non si può annullare.${codaFigli}${codaAlleg}`,
          conferma: 'Elimina lo stesso',
        }, elimina);
        break;
      }
      case 'exit': { // nell'app Android chiude davvero; nel browser/PWA la scheda non si puo' chiudere da codice
        const cap = window.Capacitor;
        if (cap && cap.Plugins && cap.Plugins.App && cap.Plugins.App.exitApp) { cap.Plugins.App.exitApp(); break; }
        window.close();
        setTimeout(() => UI.toast('Qui il foglio si chiude dalla schermata Home (le mappe sono gi\u00e0 salvate).'), 250);
        break;
      }
    }
  }

  /** Il cartello all'ingresso: questa copia è codice appena pubblicato, mai provato sul dispositivo.
   *  Si apre a OGNI avvio di proposito — non è un «leggi una volta e non ti disturbo più»: ogni
   *  pubblicazione è codice nuovo, e l'avviso vale per quello che si ha davanti adesso, non per la
   *  prima volta che si è aperta l'app. Sull'app STABILE non compare: là il codice ci arriva solo
   *  dopo che Gt l'ha provato, e un cartello di cantiere direbbe una cosa falsa. */
  function avvisoLavoriInCorso() {
    const d = $('#dlg-wip'); if (!d || !d.showModal) return;
    if ((V.storage().canale || 'sviluppo') === 'stabile') return;
    // Dopo un ricaricamento AUTOMATICO (aggiornamento del service worker, qui sotto) il cartello
    // non si riapre: l'avvio l'ha fatto l'app, non la persona — sull'iPad il 25/8 tre pubblicazioni
    // ravvicinate facevano rimbalzare cartello e ricaricamenti piu' volte alla stessa apertura.
    try { if (Date.now() - (+sessionStorage.getItem('vsm.autoreload') || 0) < 15000) return; } catch (e) { /* storage bloccato */ }
    const vr = $('#wip-ver'); if (vr) vr.textContent = 'VSM Coach ' + V.versionLabel();
    const ok = $('#wip-ok'); if (ok) ok.onclick = () => d.close();
    try { d.showModal(); } catch (e) { /* già aperto */ }
  }

  async function start() {
    R.init($('#canvas')); I.init($('#canvas'), $('#stage'));
    await V.load();
    I.penDraws = localStorage.getItem('vsm.penDraws') !== '0';
    UI.guideOn = localStorage.getItem('vsm.guideOn') !== '0';
    try { R.traceOn = localStorage.getItem('vsm.trace') !== '0'; } catch (e) { /* storage bloccato */ }
    { const vl = $('#ver-label'); if (vl) vl.textContent = 'VSM Coach ' + V.VERSION + (location.pathname.includes('/beta/') ? ' beta' : '') + ' · ' + V.BUILD; }
    UI.buildPalette(); bindHeader(); UI.bindCartina(); UI.renderCartina(); C.init(); UI.menuCheck('#btn-pen-mode', I.penDraws); UI.menuCheck('#btn-overlays', !!(V.map() && V.map().layers && V.map().layers.riepilogo)); UI.menuCheck('#btn-trace', R.traceOn); UI.menuCheck('#btn-timefmt', V.timeFmt() === 'crono');
    { let chrome = '1', tools = '0'; try { chrome = localStorage.getItem('vsm.chrome') ?? '1'; tools = localStorage.getItem('vsm.toolsLeft') ?? '0'; } catch (e) { /* storage bloccato */ }
      UI.setToolsLeft(tools === '1'); if (chrome === '0') UI.setChrome(false, { hint: false }); }
    try { if (localStorage.getItem('vsm.paletteHidden') === '1') UI.setPaletteHidden(true, { quiet: true }); } catch (e) { /* storage bloccato */ }
    fullRender(); I.restoreView();
    // la barra del giro e la legenda della misura devono esserci gia' al primo avvio, se il
    // documento riapre in Misura con un giro vivo (esito 12) — non solo dopo un cambio foglio
    UI.renderMisCtl && UI.renderMisCtl();
    // «Azzera la copia di prova» esiste solo dove ha senso: sull'app stabile la voce non compare,
    // cosi' nessuno puo' cancellare per sbaglio le mappe vere cercando di ripulire una prova
    if ((V.storage().canale || 'sviluppo') === 'stabile') $$('.prova-only').forEach(n => n.classList.add('hidden'));
    avvisoLavoriInCorso();
    // il documento aperto veniva dalla 0.9 (V.migrate, dentro V.load): lo si dice una volta, allo
    // stesso modo in cui lo dice «Apri JSON» — chi ritrova le sue mappe deve sapere che sono state convertite
    { const cron = notaCronometriChiusi(V.migrationNotes);
      const v2 = V.migrationNotes && V.migrationNotes.includes('v2') ? 'Documento convertito dalla 0.9.' : '';
      const msg = [v2, cron].filter(Boolean).join(' ');
      if (msg) UI.toast(msg); }
    if (!V.map().elements.length && Object.keys(V.doc.maps).length === 1) I.hint('Foglio nuovo: tocca il titolo in alto a destra, poi metti il richiedente e i process box. La Guida pratica (menu ⋯) ti accompagna se vuoi.', 6000);
    // Il foglio si scrive con un attimo di ritardo (V.save): ogni volta che l'app puo' sparire da sotto
    // i piedi — scheda chiusa, app mandata in sottofondo, iPadOS che libera memoria — si riversa subito
    // quello che e' in sospeso. Senza, l'ultima raffica di modifiche si perdeva senza un segnale.
    const flush = () => { V.saveNow(); };
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      // updateViaCache:'none' (C6): senza, sw.js E i suoi importScripts (version.js, manifest.js)
      // arrivavano dalla cache HTTP di Pages (max-age=600) — l'aggiornamento del service worker
      // poteva tardare di dieci minuti, e il canale test si prova a colpi di publish ravvicinati
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});
      // quando un service worker NUOVO prende il controllo (aggiornamento installato in sottofondo),
      // la pagina si ricarica da sola: senza questo la versione nuova si vedeva solo al secondo avvio,
      // e sull'iPad "chiudi davvero e riapri" non e' un gesto ovvio. Al primo install non si ricarica.
      // Il ricaricamento aspetta che il salvataggio sia finito: era il modo piu' facile per perdere
      // l'ultima modifica proprio mentre si andava a verificare la versione nuova.
      let hadSW = !!navigator.serviceWorker.controller;
      // C4 del triage debug 25/8: se sessionStorage lancia (navigazione privata, quota), la rete
      // anti-raffica resta almeno IN MEMORIA — copre i controllerchange multipli nella stessa
      // pagina; fra un reload e l'altro senza storage una memoria non esiste, e lo si accetta.
      let ultimoAutoreloadMem = 0;
      // Al massimo UN ricaricamento automatico al minuto (bug visto sull'iPad il 25/8): con piu'
      // pubblicazioni ravvicinate — o la CDN di Pages che serve byte diversi da edge diversi —
      // controllerchange puo' scattare piu' volte di fila, e la pagina si riavviava a ripetizione,
      // ogni volta col cartello di cantiere davanti. Il segno sta in sessionStorage: sopravvive al
      // reload (e' la stessa scheda), muore chiudendo davvero l'app — al prossimo vero avvio
      // l'aggiornamento si prende come sempre.
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadSW) { hadSW = true; return; }
        hadSW = true;
        let ultimo = ultimoAutoreloadMem; try { ultimo = Math.max(ultimo, +sessionStorage.getItem('vsm.autoreload') || 0); } catch (e) { /* storage bloccato */ }
        if (Date.now() - ultimo < 60000) { UI.toast('C\'è un altro aggiornamento: chiudi davvero l\'app e riaprila per usarlo.'); return; }
        ultimoAutoreloadMem = Date.now();
        try { sessionStorage.setItem('vsm.autoreload', String(Date.now())); } catch (e) { /* storage bloccato */ }
        V.saveNow().then(() => location.reload(), () => location.reload());
      });
    }
    let printViewBackup = null, printSafety = null;
    // «stampa in corso» (I.setPrinting): @media print ridimensiona davvero #stage, e il
    // ResizeObserver che lo osserva riscriverebbe il viewBox col rapporto dello schermo SOPRA
    // quello della carta appena scritto da I.fit({paper:true}) — rilievo Important della
    // revisione. Il flag si spegne in afterprint, PRIMA di I.applyView() (che deve tornare a
    // scrivere col rapporto dello schermo, stavolta di proposito).
    // Su iPad 'afterprint' a volte non scatta affatto (bug noto della piattaforma: capita quando si
    // stampa dal foglio di condivisione invece che dal tasto nativo, o se lo si annulla in certi modi):
    // senza una seconda strada il flag restava alzato per sempre, il ResizeObserver dello stage
    // restava muto fino al prossimo reload, e un cambio orientamento o l'apertura della tastiera
    // lasciavano il foglio storto (rilievo del revisore finale). Due reti, la prima che scatta chiude
    // la stampa — finishPrint e' idempotente (printViewBackup a null la seconda volta non fa nulla):
    //   - un timeout di sicurezza: piu' lungo del tempo di un dialogo di stampa vero, cosi' da non
    //     scattare mentre chi stampa sta ancora scegliendo la stampante;
    //   - il ritorno in primo piano (visibilitychange -> visible): su iPad il foglio di condivisione
    //     nasconde la pagina, e il suo ritorno e' un segnale forte che l'interazione e' comunque
    //     finita (stampato, condiviso o annullato) — di solito arriva PRIMA del timeout.
    const PRINT_SAFETY_MS = 12000;
    function finishPrint() {
      if (printSafety) { clearTimeout(printSafety); printSafety = null; }
      I.setPrinting(false);
      if (!printViewBackup) return;
      I.view = printViewBackup; printViewBackup = null; I.applyView();
      const m = V.map(); if (m) { m.view = clone(I.view); V.save(); }
    }
    window.addEventListener('beforeprint', () => {
      printViewBackup = clone(I.view); I.setPrinting(true); I.fit({ paper: true });
      clearTimeout(printSafety); printSafety = setTimeout(finishPrint, PRINT_SAFETY_MS);
    });
    window.addEventListener('afterprint', finishPrint);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && printViewBackup) finishPrint(); });
    setTimeout(UI.evalSuggest, 2500);
    if (!localStorage.getItem('vsm.welcomed')) setTimeout(() => { UI.toggleGuide(true, 'primi'); localStorage.setItem('vsm.welcomed', '1'); }, 400);
  }
  start();
})(window.VSM);
