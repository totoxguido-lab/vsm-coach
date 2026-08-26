/* VSM Coach v2 — tempo.js: F1 «Tempi e variabilità» (piano 2026-08-24-f1-tempi.md).
   Il livello 'tempo' del registro (spec fondamenta B): un badge su ogni passo e ogni attesa con
   misure (media + classe di variabilità, soglie PROVVISORIE dichiarate in V.analysis.CV_SOGLIE)
   e una sezione nel pop-up con statistiche, istogramma, sparkline cronologica e l'elenco delle
   osservazioni (cls a tocco, nota, turno). Il livello LEGGE e basta: le uniche scritture passano
   da V.setObs (commit normale, annullabile — un giudizio umano). Le parti che producono testo/SVG
   sono funzioni pure esposte su V.tempo, provate in Node (test/tempo.test.js); render(host) è
   solo la cucitura DOM. */
(function (V) {
  'use strict';
  const A = V.analysis;
  const T = V.tempo = {};
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => n == null ? '–' : (Math.round(n * 100) / 100).toString().replace('.', ',');
  /** unità corta per il badge (il posto è poco): l'unità del foglio, abbreviata */
  const UNITA_CORTA = { secondi: 's', minuti: 'min', ore: 'h', giorni: 'g' };
  const inUnita = (sec, map) => fmt(V.toUnit(sec, map.unit)) + ' ' + (UNITA_CORTA[map.unit] || map.unit);
  /** OGNI misurazione si scrive cosi' (esito 12, 26/8): convenzione dei cronometri (50″ · 1′20″)
   *  di casa; l'impostazione vsm.timefmt='unita' riporta all'unita' del foglio. */
  const tMis = (sec, map) => V.timeFmt() === 'crono' ? V.fmtMisura(sec) : inUnita(sec, map);
  const TONO = { stabile: 'ok', moderata: 'warn', alta: 'alert' };
  const CLS_COLORE = { normale: '#1f4e79', particolare: '#b98900', eccezionale: '#c8321e' };
  const CLS_CICLO = { normale: 'particolare', particolare: 'eccezionale', eccezionale: 'normale' };

  /** il badge di un elemento: solo passi e attese con almeno una misura. Con la classe di
   *  variabilità (n≥2) il tono la segue; con una misura sola si dice il numero, non una classe. */
  T.badgeDi = (el, map) => {
    if (!el || (el.type !== 'box' && el.type !== 'delta')) return null;
    const st = A.obsStats(V.obsOf(el));
    if (!st.n) return null;
    const classe = A.variabilita(st.cv);
    // niente «~» davanti (esito 12: illeggibile e non aggiunge nulla — la media resta una media)
    return {
      text: tMis(st.mean, map) + (classe ? ' · ' + classe : ' (' + st.n + ')'),
      tone: TONO[classe]
    };
  };
  /** Il RESOCONTO del passo per la finestra di sola lettura di Misura (esito 12, E12-d):
   *  max · min · media in formato misurazione + il totale, e il pulsante che apre l'analisi. */
  T.resocontoHTML = (el, map) => {
    const st = A.obsStats(V.obsOf(el));
    if (!st.n) return '';
    const riga = (k, v) => `<div class="tmp-riga"><span>${k}</span><b>${v}</b></div>`;
    return '<div class="tmp-stats tmp-resoconto">'
      + riga('max', esc(tMis(st.max, map)))
      + riga('min', esc(tMis(st.min, map)))
      + riga('media', esc(tMis(st.mean, map)))
      + riga('misurazioni', String(st.n))
      + '</div>'
      + `<div class="actions"><button class="btn primary" data-analisi="${esc(el.id)}" title="Tutte le statistiche delle misurazioni di questo passo">🕐＋ Analisi delle misure</button></div>`;
  };

  /** istogramma SVG disegnato a mano (zero dipendenze): bin alla Sturges (⌈log2 n⌉+1), barre
   *  piene, min e max scritti sotto. vals in SECONDI, etichette nell'unità del foglio. */
  T.istogrammaSVG = (vals, map, w = 228, h = 64) => {
    const v = (vals || []).filter(x => typeof x === 'number' && isFinite(x)).sort((a, b) => a - b);
    if (!v.length) return '';
    const min = v[0], max = v[v.length - 1];
    const k = (max === min) ? 1 : Math.min(12, Math.ceil(Math.log2(v.length)) + 1);
    const passo = (max - min) / k || 1;
    const bins = new Array(k).fill(0);
    v.forEach(x => { let i = Math.floor((x - min) / passo); if (i >= k) i = k - 1; bins[i]++; });
    const top = Math.max.apply(null, bins);
    const areaH = h - 14, bw = w / k;
    let bars = '';
    bins.forEach((n, i) => {
      const bh = top ? Math.round(n / top * (areaH - 2)) : 0;
      bars += `<rect x="${(i * bw + 1).toFixed(1)}" y="${areaH - bh}" width="${Math.max(1, bw - 2).toFixed(1)}" height="${bh}" rx="1.5" fill="#1f4e79" opacity="0.85"><title>${n} misur${n === 1 ? 'a' : 'e'}</title></rect>`;
    });
    return `<svg class="tmp-histo" viewBox="0 0 ${w} ${h}" role="img" aria-label="istogramma delle misure">${bars}`
      + `<text x="1" y="${h - 2}" font-size="9" fill="#6b6b6b">${esc(tMis(min, map))}</text>`
      + `<text x="${w - 1}" y="${h - 2}" font-size="9" text-anchor="end" fill="#6b6b6b">${esc(tMis(max, map))}</text></svg>`;
  };

  /** sparkline cronologica: per `at` crescente, con l'indice d'inserimento a parimerito — le
   *  misure senza data (le migrate dalla 0.9, at null) restano DAVANTI, nell'ordine loro: sono le
   *  piu' vecchie per costruzione. L'ordine dell'array da solo non bastava (rilievo Codex #3: un
   *  file confezionato, o un riordino futuro, disegnava una cronologia invertita). */
  T.sparklineSVG = (obs, w = 228, h = 44) => {
    const o = (obs || []).filter(x => x && typeof x.s === 'number' && isFinite(x.s))
      .map((x, i) => ({ x, i }))
      .sort((a, b) => {
        const aa = (typeof a.x.at === 'number' && isFinite(a.x.at)) ? a.x.at : -Infinity;
        const bb = (typeof b.x.at === 'number' && isFinite(b.x.at)) ? b.x.at : -Infinity;
        return aa === bb ? a.i - b.i : aa - bb;
      })
      .map(p => p.x);
    if (o.length < 2) return '';
    const vals = o.map(x => x.s);
    const min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    const span = (max - min) || 1;
    const px = (i) => (o.length === 1 ? w / 2 : 6 + i * (w - 12) / (o.length - 1));
    const py = (s) => 5 + (h - 10) * (1 - (s - min) / span);
    const pts = o.map((x, i) => `${px(i).toFixed(1)},${py(x.s).toFixed(1)}`).join(' ');
    const dots = o.map((x, i) => `<circle cx="${px(i).toFixed(1)}" cy="${py(x.s).toFixed(1)}" r="2.6" fill="${CLS_COLORE[x.cls] || CLS_COLORE.normale}"><title>${esc(String(x.s))} s${x.turno ? ' · ' + esc(x.turno) : ''}</title></circle>`).join('');
    return `<svg class="tmp-spark" viewBox="0 0 ${w} ${h}" role="img" aria-label="misure nel tempo">`
      + `<polyline points="${pts}" fill="none" stroke="#1f4e79" stroke-width="1.3" opacity="0.6"/>${dots}</svg>`;
  };

  /** la sezione del pop-up, come stringa (pura, provabile): statistiche, grafici, elenco delle
   *  osservazioni, e le soglie SCRITTE — con il loro stato provvisorio, non spacciate per legge. */
  T.sectionHTML = (el, map) => {
    const obs = V.obsOf(el);
    const st = A.obsStats(obs);
    if (!st.n) return '';
    const classe = A.variabilita(st.cv);
    const riga = (k, v) => `<div class="tmp-riga"><span>${k}</span><b>${v}</b></div>`;
    let h = '<div class="tmp-stats">';
    h += riga('misure', String(st.n));
    h += riga('min – max', esc(tMis(st.min, map)) + ' – ' + esc(tMis(st.max, map)));
    h += riga('mediana', esc(tMis(st.median, map)));
    h += riga('media', esc(tMis(st.mean, map)));
    // da n≥2 (rilievo Codex #4: erano nascosti fino a 3 — statistiche calcolate e non mostrate);
    // con n=1 restano fuori: sarebbero il valore stesso, una riga che non dice niente
    if (st.n >= 2) h += riga('p10 – p90', esc(tMis(st.p10, map)) + ' – ' + esc(tMis(st.p90, map)));
    if (st.cv != null) h += riga('variabilità', 'CV ' + fmt(st.cv * 100) + '% · <span class="tmp-classe ' + esc(classe) + '">' + esc(classe) + '</span>');
    h += '</div>';
    h += T.istogrammaSVG(obs.map(o => o.s), map);
    h += T.sparklineSVG(obs);
    // la ✓ del passo blocca ogni scrittura sulle sue props (toccaValidato, A2): senza questo
    // 'disabled' i bottoni restavano vivi ma V.setObs tornava false in silenzio — un bottone che
    // non fa niente e non dice perche' (verificato eseguendo, rilievo del committente di F1)
    const fermo = !!(el.props && el.props.validated);
    const perche = fermo ? ' disabled title="Passo validato ✓: togli la ✓ per rileggere le misure."' : '';
    h += '<div class="tmp-obs-list">' + obs.map((o, i) => {
      const giroDi = (o.giro && o.giro !== map.id && V.doc.maps[o.giro]) ? V.doc.maps[o.giro] : null;
      const dettagli = [o.turno, giroDi ? 'giro: ' + (giroDi.verName || giroDi.title || '?') : null].filter(Boolean).join(' · ');
      return `<div class="tmp-obs"><b>${esc(tMis(o.s, map))}</b>`
        + (dettagli ? `<span class="k">${esc(dettagli)}</span>` : '')
        + `<button class="btn small tmp-cls" data-obs-cls="${i}" style="color:${CLS_COLORE[o.cls] || CLS_COLORE.normale}"${perche || ' title="Tocca per riclassificare (normale → particolare → eccezionale). Nessuna misura viene esclusa dai conti: è solo una marcatura."'}>${esc(o.cls)}</button>`
        + `<button class="btn small ghost" data-obs-val="${i}"${perche || ' title="Correggi il valore di questa misura a mano"'}>🔢</button>`
        + `<button class="btn small ghost" data-obs-nota="${i}"${perche || ` title="${o.nota ? esc(o.nota) : 'Aggiungi una nota a questa misura'}"`}>${o.nota ? '📝' : '✎'}</button>`
        + (o.nota ? `<div class="tmp-nota k">${esc(o.nota)}</div>` : '')
        + '</div>';
    }).join('') + '</div>';
    h += `<p class="hint tmp-soglie">Variabilità dal coefficiente di variazione: sotto ${fmt(A.CV_SOGLIE.stabile * 100)}% stabile, sotto ${fmt(A.CV_SOGLIE.moderata * 100)}% moderata, oltre alta. Soglie provvisorie: vanno validate sulle vostre misure.</p>`;
    return h;
  };

  V.layers.register({
    id: 'tempo',
    label: 'Tempi e variabilità',
    phaseMin: 'misura',
    badge: (el, map) => T.badgeDi(el, map),
    section: (el, map) => {
      // il controllo economico, senza costruire l'HTML due volte (osservazione Codex: section()
      // piu' render() calcolavano tutto due volte a ogni apertura)
      if ((el.type !== 'box' && el.type !== 'delta') || !V.obsOf(el).length) return null;   // spec D, sezioni vuote
      return {
        title: 'Tempi e variabilità',
        render: (host) => T.mount(host, el, map)
      };
    }
  });

  /** Cuce la sezione «Tempi e variabilità» dentro un host DOM: la usano il pop-up (sezione del
   *  livello) e la schermata di analisi del passo (esito 12, E12-d) — stessa vista, stesse
   *  scritture (V.setObs), un solo posto. */
  T.mount = (host, el, map) => {
          const vivo = () => V.byId(el.id, map) || el;
          const disegna = () => {
            host.innerHTML = T.sectionHTML(vivo(), map);
            host.querySelectorAll('[data-obs-cls]').forEach(b => b.onclick = () => {
              const i = +b.dataset.obsCls; const o = V.obsOf(vivo())[i]; if (!o) return;
              if (V.setObs(map, el.id, i, { cls: CLS_CICLO[o.cls] || 'particolare' })) disegna();
            });
            // il valore si corregge a mano (decisione Gt 26/8: flessibilita' — si puo' anche
            // scartare e rimisurare da solo, ma OGNI misura resta modificabile a posteriori);
            // il prompt() nativo e' la via che Gt ha provato e tenuto (S4-a)
            host.querySelectorAll('[data-obs-val]').forEach(b => b.onclick = () => {
              const i = +b.dataset.obsVal; const o = V.obsOf(vivo())[i]; if (!o) return;
              const t = prompt('Nuovo valore in ' + map.unit + ' (adesso: ' + fmt(V.toUnit(o.s, map.unit)) + '):', fmt(V.toUnit(o.s, map.unit)));
              if (t == null) return;   // annullato
              const v = parseFloat(String(t).trim().replace(',', '.'));
              if (!isFinite(v) || v < 0) return;
              if (V.setObs(map, el.id, i, { s: v * V.unitSeconds(map.unit) })) disegna();
            });
            host.querySelectorAll('[data-obs-nota]').forEach(b => b.onclick = () => {
              const i = +b.dataset.obsNota; const o = V.obsOf(vivo())[i]; if (!o) return;
              const t = prompt('Nota su questa misura (vuoto = nessuna nota):', o.nota || '');
              if (t == null) return;   // annullato
              if (V.setObs(map, el.id, i, { nota: t })) disegna();
            });
          };
          disegna();
  };
})(window.VSM);
