/* VSM Coach v2 — main.js: avvio, header, menu, libreria mappe, sincronizzazione render su ogni commit. */
(function (V) {
  'use strict';
  const I = V.interact, R = V.render, UI = V.ui, C = V.coach; const { clone, today } = V.util;
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  function fullRender() { const map = V.map(); R.all(map, { selection: I.selection.filter(id => V.byId(id, map)) }); UI.renderHeader(); UI.renderLevels && UI.renderLevels(); if (UI.guideVisible && UI.guideVisible()) UI.renderGuide(); if (!$('#drawer').classList.contains('closed') && !$('#pane-plan').classList.contains('hidden')) UI.renderPlan(); }
  let sugTimer = null;
  V.onChange((info) => {
    if (info.switched) { I.selection = []; V.pop.close(); UI.hideQuick(); fullRender(); return; }
    // rendering incrementale quando possibile
    const map = V.map(); const ops = info.ops || [];
    const onlyProps = ops.length && ops.every(o => o.t === 'props' || o.t === 'update');
    if (onlyProps && !info.undo && !info.redo) { ops.forEach(o => R.updateEl(o.id, map)); R.overlay(map, map.overlays !== false); R.selection(I.selection, map); UI.renderHeader(); if (V.pop.current && V.pop.current !== '__title__' && ops.some(o => o.id === V.pop.current)) { if (ops.every(o => o.t === 'update')) V.pop.place(V.byId(V.pop.current, map)); V.pop.refresh && V.pop.refresh(V.pop.current); } }
    else if (ops.length && ops.every(o => o.t === 'stroke_add' || o.t === 'stroke_remove') && !info.undo && !info.redo) { R.strokes(map); UI.renderHeader(); }
    else if (ops.length && ops.every(o => o.t === 'meta') && !info.undo && !info.redo) { R.paper(map); R.overlay(map, map.overlays !== false); UI.renderHeader(); /* la guida non si ridisegna sui meta: chi scrive nei suoi campi non deve perdere il cursore */ }
    else fullRender();
    if ((info.undo || info.redo) && V.pop.current && V.pop.current !== '__title__' && !V.byId(V.pop.current, map)) V.pop.close();
    if (info.undo || info.redo) { I.selection = I.selection.filter(id => V.byId(id, map)); R.selection(I.selection, map); UI.onSelection(I.selection); }
    if (UI.guideVisible && UI.guideVisible() && !(ops.length && ops.every(o => o.t === 'meta'))) UI.renderGuide();
    clearTimeout(sugTimer); sugTimer = setTimeout(UI.evalSuggest, 1800);
  });

  function download(name, content, type) { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000); }
  const slug = (s) => (s || 'vsm').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || 'vsm';

  function bindHeader() {
    $('#map-title').addEventListener('input', (e) => V.commit({ t: 'meta', after: { title: e.target.value } }, 'titolo', { silent: true }));
    $('#tab-current').onclick = () => { const m = V.map(); const c = V.currentOf(m); if (c && c !== m) UI.openMap(c.id); else if (m.kind !== 'current') UI.toast('Questa mappa non ha uno stato attuale accoppiato.'); };
    // "Futuro" crea direttamente la copia se non esiste: niente conferme, si annulla eliminando la mappa
    $('#tab-future').onclick = () => { const m = V.map(); const f = V.futureOf(m); if (f && f !== m) UI.openMap(f.id); else if (m.kind === 'current') { const nf = V.createFuture(m); UI.openMap(nf.id); UI.toast('Stato futuro creato come copia: ora semplifica. Se non serve: menu ⋯ → Elimina.'); } else if (m.kind !== 'future') UI.toast('I sotto-fogli non hanno uno stato futuro: torna alla mappa madre.'); };
    $('#btn-undo').onclick = () => V.undo(); $('#btn-redo').onclick = () => V.redo();
    $('#btn-guide').onclick = () => UI.toggleGuide();
    $('#drawer-close').onclick = UI.closeDrawer;
    ['coach', 'plan', 'legend'].forEach(t => $('#tab-' + t).onclick = () => UI.showTab(t));
    $('#btn-legend').onclick = () => { if ($('#drawer').classList.contains('closed') || $('#pane-legend').classList.contains('hidden')) UI.showTab('legend'); else UI.closeDrawer(); };
    $('#btn-maps').onclick = () => { UI.renderMaps(); $('#dlg-maps').showModal(); }; $('#maps-close').onclick = () => $('#dlg-maps').close();
    const menuCheck = (id, on) => { const b = $(id); b.setAttribute('aria-pressed', on); b.textContent = (on ? '✓ ' : '○ ') + b.textContent.replace(/^[✓○] /, ''); };
    $('#btn-overlays').onclick = () => { const m = V.map(); V.commit({ t: 'meta', after: { overlays: m.overlays === false } }, 'riepilogo', { silent: true }); R.overlay(V.map(), V.map().overlays !== false); menuCheck('#btn-overlays', V.map().overlays !== false); $('#menu').classList.add('hidden'); };
    $('#btn-pen-mode').onclick = () => { I.penDraws = !I.penDraws; localStorage.setItem('vsm.penDraws', I.penDraws ? '1' : '0'); menuCheck('#btn-pen-mode', I.penDraws); $('#menu').classList.add('hidden'); UI.toast(I.penDraws ? 'Penna: sulla carta vuota scrive a matita.' : 'Penna: usa lo strumento scelto.'); };
    $('#btn-tools-left').onclick = () => { UI.setToolsLeft(!$('#app').classList.contains('tools-left')); $('#menu').classList.add('hidden'); };
    // aspetto dei collegamenti: si cicla fra le modalità, così si confronta a colpo d'occhio quale si legge meglio
    const linkModeLabel = () => { const m = V.linkModeOf(V.map()); $('#btn-link-mode').textContent = 'Frecce: ' + ({ dritta: 'dritte', curva: 'curve' }[m] || m); };
    $('#btn-link-mode').onclick = () => {
      const map = V.map(); const ids = V.LINK_MODES.map(x => x.id); const cur = V.linkModeOf(map);
      const next = V.LINK_MODES[(ids.indexOf(cur) + 1) % ids.length];
      V.commit({ t: 'meta', after: { links: { mode: next.id } }, before: { links: { mode: cur } } }, 'aspetto dei collegamenti');
      linkModeLabel(); $('#menu').classList.add('hidden'); UI.toast('Collegamenti: ' + next.name + ' — ' + next.hint);
    };
    UI.linkModeLabel = linkModeLabel;
    $('#btn-trace').onclick = () => {
      R.traceOn = !R.traceOn; localStorage.setItem('vsm.trace', R.traceOn ? '1' : '0');
      menuCheck('#btn-trace', R.traceOn); R.selection(I.selection, V.map()); $('#menu').classList.add('hidden');
      UI.toast(R.traceOn ? 'Selezionando un elemento si illumina dove va a finire.' : 'Evidenziazione del percorso spenta.');
    };
    UI.menuCheck = menuCheck;
    $('#zoom-in').onclick = () => { const r = $('#stage').getBoundingClientRect(); I.zoomAt(1.2, r.left + r.width / 2, r.top + r.height / 2); };
    $('#zoom-out').onclick = () => { const r = $('#stage').getBoundingClientRect(); I.zoomAt(1 / 1.2, r.left + r.width / 2, r.top + r.height / 2); };
    $('#zoom-fit').onclick = () => I.fit();
    $('#btn-help').onclick = () => UI.showHelp(false);
    $('#ui-toggle').onclick = () => UI.toggleChrome();
    $('#help-close').onclick = () => { $('#dlg-help').close(); localStorage.setItem('vsm.welcomed', '1'); };
    $('#help-example').onclick = () => { $('#dlg-help').close(); localStorage.setItem('vsm.welcomed', '1'); menuAction('example'); };
    // menu: i sottogruppi (File, Opzioni, Coach) si aprono a fisarmonica, uno alla volta, e si richiudono a ogni apertura
    const menu = $('#menu');
    const closeSubs = () => { $$('#menu .submenu').forEach(s => s.classList.add('hidden')); $$('#menu .sub-head').forEach(h => h.setAttribute('aria-expanded', 'false')); };
    $$('#menu .sub-head').forEach(h => h.onclick = () => { const s = $('#sub-' + h.dataset.sub); const wasClosed = s.classList.contains('hidden'); closeSubs(); if (wasClosed) { s.classList.remove('hidden'); h.setAttribute('aria-expanded', 'true'); } });
    $('#btn-menu').onclick = (e) => { e.stopPropagation(); const opening = menu.classList.contains('hidden'); menu.classList.toggle('hidden'); if (opening) closeSubs(); };
    document.addEventListener('pointerdown', (e) => { if (!menu.classList.contains('hidden') && !menu.contains(e.target) && e.target !== $('#btn-menu')) menu.classList.add('hidden'); if (!$('#more-tools').classList.contains('hidden') && !$('#more-tools').contains(e.target) && !e.target.closest('[data-tool="more"]')) $('#more-tools').classList.add('hidden'); if (UI.guideVisible() && !$('#guidepop').contains(e.target) && !e.target.closest('#btn-guide')) UI.toggleGuide(false); });
    $$('#menu [data-m]').forEach(b => b.onclick = () => { menu.classList.add('hidden'); menuAction(b.dataset.m); });
    $('#file-open').addEventListener('change', (e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { const n = V.importMaps(JSON.parse(r.result)); I.restoreView(); UI.toast(n + ' mappe importate.'); } catch (err) { UI.toast('File non valido: ' + err.message); } }; r.readAsText(f); e.target.value = ''; });
  }
  function menuAction(a) {
    const map = V.map();
    switch (a) {
      case 'new': { UI.closeDrawer(); const m = V.addMap(V.newMap({ title: '', authors: map.authors, unit: map.unit })); m.elements.push(V.newElement('legend', 30, 20)); UI.openMap(m.id); I.fit(); UI.toast('Nuovo foglio. Tocca il titolo in alto a destra per intestarlo.'); break; }
      // solo su schermi piccoli, dove il selettore Attuale/Futuro in testata non c'è
      case 'af': { if (map.kind === 'future') { const c = V.currentOf(map); if (c && c !== map) UI.openMap(c.id); } else { const f = V.futureOf(map); if (f && f !== map) UI.openMap(f.id); else if (map.kind === 'current') { const nf = V.createFuture(map); UI.openMap(nf.id); UI.toast('Stato futuro creato come copia: ora semplifica.'); } else UI.toast('I sotto-fogli non hanno uno stato futuro.'); } break; }
      case 'detail': { const d = V.createDetail(map, ''); UI.openMap(d.id); I.fit(); UI.toast('Mappa di dettaglio: collegala da un box (pop-up → Collega a un\'altra mappa).'); break; }
      case 'example': { const m = V.addMap(V.example()); UI.openMap(m.id); I.fit(); UI.toast('Esempio caricato (numeri dalla Fig. 5.1 del libro).'); break; }
      case 'open': $('#file-open').click(); break;
      case 'save': download(`vsm-coach-${slug(map.title)}-${today()}.json`, JSON.stringify(V.doc, null, 1), 'application/json'); UI.toast('JSON scaricato (tutte le mappe).'); break;
      case 'svg': download(`${slug(map.title)}-${map.kind}.svg`, R.exportSVG(map), 'image/svg+xml'); break;
      case 'print': window.print(); break;
      case 'legend': UI.showTab('legend'); break;
      case 'guide': UI.toggleGuide(true); break;
      case 'maps': UI.renderMaps(); $('#dlg-maps').showModal(); break;
      case 'help': UI.showHelp(false); break;
      case 'coach': UI.showTab('coach'); break;
      case 'settings': C.openSettings(); break;
      case 'clear-ink': if (map.strokes.length && confirm('Cancellare tutti i tratti a matita di questa mappa?')) V.commit({ t: 'strokes_set', after: [] }, 'cancella inchiostro'); break;
      case 'delete': if (confirm(`Eliminare la mappa "${map.title || 'senza titolo'}"? Non si può annullare.`)) { V.deleteMap(map.id); I.restoreView(); UI.toast('Mappa eliminata.'); } break;
      case 'exit': { // nell'app Android chiude davvero; nel browser/PWA la scheda non si puo' chiudere da codice
        const cap = window.Capacitor;
        if (cap && cap.Plugins && cap.Plugins.App && cap.Plugins.App.exitApp) { cap.Plugins.App.exitApp(); break; }
        window.close();
        setTimeout(() => UI.toast('Qui il foglio si chiude dalla schermata Home (le mappe sono gi\u00e0 salvate).'), 250);
        break;
      }
    }
  }

  async function start() {
    R.init($('#canvas')); I.init($('#canvas'), $('#stage'));
    await V.load();
    I.penDraws = localStorage.getItem('vsm.penDraws') !== '0';
    UI.guideOn = localStorage.getItem('vsm.guideOn') !== '0';
    try { R.traceOn = localStorage.getItem('vsm.trace') !== '0'; } catch (e) { /* storage bloccato */ }
    UI.buildPalette(); bindHeader(); UI.bindLevels(); UI.renderLevels(); C.init(); UI.menuCheck('#btn-pen-mode', I.penDraws); UI.menuCheck('#btn-overlays', V.map().overlays !== false); UI.menuCheck('#btn-trace', R.traceOn);
    { let chrome = '1', tools = '0'; try { chrome = localStorage.getItem('vsm.chrome') ?? '1'; tools = localStorage.getItem('vsm.toolsLeft') ?? '0'; } catch (e) { /* storage bloccato */ }
      UI.setToolsLeft(tools === '1'); if (chrome === '0') UI.setChrome(false, { hint: false }); }
    fullRender(); I.restoreView();
    if (!V.map().elements.length && Object.keys(V.doc.maps).length === 1) { V.map().elements.push(V.newElement('legend', 30, 20)); V.save(); fullRender(); I.hint('Foglio nuovo: tocca il titolo in alto a destra, poi metti il richiedente e i process box. La Guida (in alto) ti accompagna se vuoi.', 6000); }
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
    let printViewBackup = null;
    window.addEventListener('beforeprint', () => { printViewBackup = clone(I.view); I.fit({ paper: true }); });
    window.addEventListener('afterprint', () => { if (!printViewBackup) return; I.view = printViewBackup; printViewBackup = null; I.applyView(); const m = V.map(); if (m) { m.view = clone(I.view); V.save(); } });
    setTimeout(UI.evalSuggest, 2500);
    if (!localStorage.getItem('vsm.welcomed')) setTimeout(() => UI.showHelp(true), 400);
  }
  start();
})(window.VSM);
