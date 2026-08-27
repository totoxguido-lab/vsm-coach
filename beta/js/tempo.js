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
  /** il segnetto della provenienza (1B, D-08): davanti al testo del badge, e in NESSUN altro posto.
   *  Vive qui, dentro la stringa `text`, perche' quella e' l'unica via che alimenta insieme il
   *  disegno (R.badgeSVG) e il ritaglio (R.badgeExtent → contentBox → export SVG e stampa A3):
   *  scriverlo altrove vorrebbe dire due vie, e prima o poi due risposte diverse. */
  const SEGNO_ORIGINE = '≈ ';
  /** Le due parole dell'origine ASSENTE (UI-SPEC §2). Nel modello non c'e' etichetta per la chiave
   *  che non c'e' — e' una scelta del 02-05: «non dichiarata» e' uno stato, non una quinta voce.
   *  A schermo pero' una parola serve, e dev'essere la STESSA ovunque: vive qui, accanto a chi la
   *  usa per primo, e il pannello del passo (popover.js) la chiede a questo oggetto invece di
   *  tenerne una copia sua. Due copie, prima o poi, dicono due cose diverse. */
  T.FONTE_MUTA = { corta: 'origine?', piena: 'Origine non dichiarata' };
  const CLS_COLORE = { normale: '#1f4e79', particolare: '#b98900', eccezionale: '#c8321e' };
  const CLS_CICLO = { normale: 'particolare', particolare: 'eccezionale', eccezionale: 'normale' };

  /** il badge di un elemento: solo passi e attese con almeno una misura. Con la classe di
   *  variabilità (n≥2) il tono la segue; con una misura sola si dice il numero, non una classe. */
  T.badgeDi = (el, map) => {
    if (!el || (el.type !== 'box' && el.type !== 'delta')) return null;
    // solo le misure DI QUESTO giro (esito 13): le ereditate sono storia, non badge
    const obs = V.obsDelGiro(el, map);
    const st = A.obsStats(obs);
    if (!st.n) return null;
    const classe = A.variabilita(st.cv);
    // Davanti al numero c'e' UN solo segno possibile, e a due condizioni diverse da quelle del «~»
    // tolto all'esito 12. Quel «~» stava davanti a ogni media, sempre: non diceva niente che «media»
    // non dicesse gia', e si leggeva male. Questo e' il segnetto della provenienza (1B, D-08):
    // compare SOLO se almeno una misura di questo giro non e' stata vista di persona, e allora dice
    // una cosa che nessun altro segno sul foglio dice. Anche l'origine NON DICHIARATA lo fa
    // comparire: «nessuno l'ha detto» non e' «osservato», e ripiegare sarebbe la bugia che il 1B
    // esiste per impedire (D-07). Il tono non cambia: il segnetto non ha un colore suo.
    const nonVisto = obs.some(o => o.fonte !== 'osservato');
    return {
      text: (nonVisto ? SEGNO_ORIGINE : '') + tMis(st.mean, map) + (classe ? ' · ' + classe : ' (' + st.n + ')'),
      tone: TONO[classe]
    };
  };
  /** Il RESOCONTO del passo per la finestra di sola lettura di Misura (esito 12, E12-d):
   *  max · min · media in formato misurazione + il totale, e il pulsante che apre l'analisi. */
  T.resocontoHTML = (el, map) => {
    const st = A.obsStats(V.obsDelGiro(el, map));
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
    // le statistiche vive sono del GIRO (esito 13): le obs clonate da un giro precedente sono
    // STORIA — si leggono sotto, raggruppate per giro, e non entrano nei conti di questo foglio
    const tutte = V.obsOf(el);
    const righe = []; tutte.forEach((o, i) => { if (!o.giro || o.giro === map.id) righe.push({ o, i }); });
    const obs = righe.map(r => r.o);
    const st = A.obsStats(obs);
    const prec = {}; tutte.forEach(o => { if (o.giro && o.giro !== map.id) (prec[o.giro] = prec[o.giro] || []).push(o); });
    const giriPrec = Object.keys(prec);
    if (!st.n && !giriPrec.length) return '';
    const classe = A.variabilita(st.cv);
    const riga = (k, v) => `<div class="tmp-riga"><span>${k}</span><b>${v}</b></div>`;
    let h = '';
    if (st.n) {
      h += '<div class="tmp-stats">';
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
      // la ✓ del passo blocca ogni scrittura sulle sue props (toccaValidato, A2); e fuori da
      // Misura/Analizza le osservazioni non si riscrivono (porta delle fasi): in tutti e due i
      // casi i bottoni si spengono E dicono perche' — mai bottoni vivi che non fanno niente
      const fermo = !!(el.props && el.props.validated);
      const fuoriFase = !['misura', 'analizza'].includes(map.phase);
      const perche = fermo ? ' disabled title="Passo validato ✓: togli la ✓ per rileggere le misure."'
        : fuoriFase ? ' disabled title="Le misure si rileggono in Misura o Analizza."' : '';
      // data-obs-* portano l'indice nella lista sana COMPLETA (V.obsOf): e' quello che
      // V.setObs/posObs capiscono — con la storia davanti gli indici filtrati mentirebbero
      h += '<div class="tmp-obs-list">' + righe.map(({ o, i }) => {
        // il «chi o dove» dell'origine si legge in riga accanto al turno: un dettaglio scritto e
        // poi nascosto dietro un tocco e' un dettaglio che nessuno rilegge piu'
        const dettagli = [o.turno, o.fonteNota].filter(Boolean).join(' · ');
        // L'ORIGINE, con le parole di Gt (D-06): la corta sul bottone, la piena nel title. Le
        // etichette si leggono dal modello (V.FONTE_CORTA / V.FONTE_LABEL) e non si riscrivono
        // qui: un posto solo. La chiave assente non e' un buco da riempire — e' «origine?».
        const fCorta = V.FONTE_CORTA[o.fonte] || T.FONTE_MUTA.corta;
        const fPiena = V.FONTE_LABEL[o.fonte] || T.FONTE_MUTA.piena;
        return `<div class="tmp-obs"><b>${esc(tMis(o.s, map))}</b>`
          + (dettagli ? `<span class="k">${esc(dettagli)}</span>` : '')
          + `<button class="btn small tmp-cls" data-obs-cls="${i}" style="color:${CLS_COLORE[o.cls] || CLS_COLORE.normale}"${perche || ' title="Tocca per riclassificare (normale → particolare → eccezionale). Nessuna misura viene esclusa dai conti: è solo una marcatura."'}>${esc(o.cls)}</button>`
          + `<button class="btn small tmp-fonte" data-obs-fonte="${i}" aria-expanded="false"${perche || ` title="${esc(fPiena)} — tocca per dire da dove viene questo numero"`}>${esc(fCorta)}</button>`
          + `<button class="btn small ghost" data-obs-val="${i}"${perche || ' title="Correggi il valore di questa misura a mano"'}>🔢</button>`
          + `<button class="btn small ghost" data-obs-nota="${i}"${perche || ` title="${o.nota ? esc(o.nota) : 'Aggiungi una nota a questa misura'}"`}>${o.nota ? '📝' : '✎'}</button>`
          + (o.nota ? `<div class="tmp-nota k">${esc(o.nota)}</div>` : '')
          + '</div>'
          // la fascia delle quattro voci si apre QUI, sotto la riga, e solo quando la si chiede:
          // costruirla per ogni misura e tenerla nascosta vorrebbe dire quattro bottoni in piu'
          // per riga anche quando nessuno li guarda (T.mount la riempie a tocco)
          + `<div class="tmp-fonte-box" data-fonte-box="${i}"></div>`;
      }).join('') + '</div>';
      h += `<p class="hint tmp-soglie">Variabilità dal coefficiente di variazione: sotto ${fmt(A.CV_SOGLIE.stabile * 100)}% stabile, sotto ${fmt(A.CV_SOGLIE.moderata * 100)}% moderata, oltre alta. Soglie provvisorie: vanno validate sulle vostre misure.</p>`;
    } else {
      h += '<p class="hint">Nessuna misura di questo giro: il cronometro le prende in Misura.</p>';
    }
    if (giriPrec.length) {
      h += '<div class="pop-sec">Giri precedenti</div>';
      giriPrec.forEach(g => {
        const os = prec[g]; const st2 = A.obsStats(os);
        const mp = V.doc.maps[g];
        const nome = mp ? (mp.verName || mp.title || 'giro') : 'giro chiuso';
        h += `<div class="tmp-riga tmp-giroprec"><span>${esc(nome)}</span><b>${os.length} ${os.length === 1 ? 'misura' : 'misure'} · media ${esc(tMis(st2.mean, map))}</b></div>`;
      });
      h += '<p class="hint">La storia del passo sui giri precedenti: si legge, non entra nei conti di questo giro.</p>';
    }
    return h;
  };

  /** La fascia delle quattro voci dell'origine, che si apre SOTTO la riga della misura (D-06, D-21).
   *  Stampo di `kindPicker` (popover.js): `role="radiogroup"`, un `aria-checked` per pastiglia, le
   *  44px dell'idioma `.picker .pick`. Le parole sono quelle del modello — qui non se ne scrive
   *  nessuna nuova. `i` e' l'indice nella lista sana COMPLETA (V.obsOf), lo stesso che porta
   *  `data-obs-fonte`: e' quello che V.setObs/posObs capiscono.
   *  Toccare la pastiglia GIA' scelta toglie l'origine: e' la via per tornare a «non dichiarata»
   *  senza un quinto bottone che dica «nessuna» — e il title lo dice, invece di lasciarlo indovinare.
   *  Pura, come il resto del file: si prova in Node. */
  T.fonteFasciaHTML = (o, i) => {
    const cur = o && o.fonte;
    const pick = (f) => {
      const on = f === cur;
      const eti = V.FONTE_LABEL[f] || f;
      return `<button type="button" class="pick ${on ? 'on' : ''}" data-fonte-v="${esc(f)}" role="radio" aria-checked="${on}" aria-label="Origine: ${esc(eti)}" title="${esc(on ? eti + ' — tocca di nuovo per togliere l\'origine' : eti)}"><span>${esc(eti)}</span></button>`;
    };
    return `<div class="picker fonti" role="radiogroup" aria-label="Da dove viene questo numero">${V.FONTI.map(pick).join('')}</div>`
      + `<div class="field"><label for="tmp-fonte-nota-${esc(i)}">Chi o dove (facoltativo)`
      + `<button type="button" class="hintdot" data-hintdot aria-label="Spiegazione">ⓘ</button>`
      + `<span class="hintpop hidden">Meglio il ruolo o le iniziali, non il nome.</span></label>`
      + `<input id="tmp-fonte-nota-${esc(i)}" type="text" data-fonte-nota="${esc(i)}" value="${esc((o && o.fonteNota) || '')}" placeholder="es. la caposala, il turno di notte" autocomplete="off"></div>`
      + `<div class="actions"><button type="button" class="btn small ghost" data-fonte-x aria-label="Chiudi le origini" title="Chiudi">✕</button></div>`;
  };

  /** Il valore corretto a mano, letto dal campo della finestrella: virgola o punto (in reparto si
   *  scrive «1,5»), mai negativo, mai NaN — e restituito in SECONDI, l'unita' in cui il modello
   *  tiene le misure. `null` vuol dire «non e' un numero»: chi chiama non scrive niente.
   *  Sta qui, pura, e non dentro il gestore del clic: murata in una chiusura DOM nessuna prova in
   *  Node poteva arrivarci, e la lettura di un numero scritto a mano e' proprio la cosa che si
   *  sbaglia in silenzio (era gia' cosi' col prompt nativo — mai provata). */
  T.leggiValore = (testo, map) => {
    const v = parseFloat(String(testo == null ? '' : testo).trim().replace(',', '.'));
    if (!isFinite(v) || v < 0) return null;
    return v * V.unitSeconds(map.unit);
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
          // quale riga ha la fascia dell'origine aperta: vive fuori da disegna() perche' ogni
          // scrittura ridisegna la sezione, e la fascia non deve richiudersi sotto le dita
          let fonteAperta = null;
          const apriFonte = (i) => {
            const box = host.querySelector('[data-fonte-box="' + i + '"]');
            const o = box && V.obsOf(vivo())[i];
            if (!o) { fonteAperta = null; return; }
            box.innerHTML = T.fonteFasciaHTML(o, i);
            const b = host.querySelector('[data-obs-fonte="' + i + '"]'); if (b) b.setAttribute('aria-expanded', 'true');
            // un tocco = scritto: nessun bottone «Salva» (D-06), e la ↶ riporta indietro perche'
            // V.setObs fa un commit normale (D-21). La stessa pastiglia toccata due volte toglie
            // l'origine e si torna a «non dichiarata».
            box.querySelectorAll('[data-fonte-v]').forEach(p => p.onclick = () => {
              const scelta = p.dataset.fonteV;
              const ora = V.obsOf(vivo())[i]; if (!ora) return;
              if (V.setObs(map, el.id, i, { fonte: ora.fonte === scelta ? null : scelta })) disegna();
            });
            // il «chi o dove» si scrive al change (a campo lasciato): una voce di annulla per
            // frase, non una per lettera
            const nota = box.querySelector('[data-fonte-nota]');
            if (nota) nota.onchange = () => { if (V.setObs(map, el.id, i, { fonteNota: nota.value })) disegna(); };
            const x = box.querySelector('[data-fonte-x]');
            if (x) x.onclick = () => { fonteAperta = null; disegna(); };
          };
          const disegna = () => {
            host.innerHTML = T.sectionHTML(vivo(), map);
            host.querySelectorAll('[data-obs-cls]').forEach(b => b.onclick = () => {
              const i = +b.dataset.obsCls; const o = V.obsOf(vivo())[i]; if (!o) return;
              if (V.setObs(map, el.id, i, { cls: CLS_CICLO[o.cls] || 'particolare' })) disegna();
            });
            // il valore si corregge a mano (decisione Gt 26/8: flessibilita' — si puo' anche
            // scartare e rimisurare da solo, ma OGNI misura resta modificabile a posteriori).
            // Dal 27/8 lo chiede una FINESTRA DELL'APP (UI.chiediValore), non il pop-up del
            // browser: rilievo 2 del cancello 1B — «rendilo coerente con lo stile del canvas e
            // delle finestre». Erano gli ultimi due prompt() nativi rimasti.
            host.querySelectorAll('[data-obs-val]').forEach(b => b.onclick = () => {
              const i = +b.dataset.obsVal; const o = V.obsOf(vivo())[i]; if (!o) return;
              const adesso = fmt(V.toUnit(o.s, map.unit));
              V.ui.chiediValore({
                titolo: '\u{1F522} Correggi il valore',
                spiega: 'Adesso: ' + adesso + ' ' + map.unit + '.',
                etichetta: 'Nuovo valore in ' + map.unit,
                valore: adesso,
                numerico: true,
              }, (testo) => {
                const sec = T.leggiValore(testo, map);
                if (sec == null) return;   // non e' un numero: non si scrive niente
                if (V.setObs(map, el.id, i, { s: sec })) disegna();
              });
            });
            host.querySelectorAll('[data-obs-nota]').forEach(b => b.onclick = () => {
              const i = +b.dataset.obsNota; const o = V.obsOf(vivo())[i]; if (!o) return;
              V.ui.chiediValore({
                titolo: '\u{1F4DD} Nota su questa misura',
                spiega: 'Vuoto = nessuna nota.',
                etichetta: 'Nota',
                valore: o.nota || '',
              }, (testo) => { if (V.setObs(map, el.id, i, { nota: testo })) disegna(); });
            });
            // l'origine: il bottone-parola apre la fascia sotto la sua riga, e la richiude se era
            // gia' aperta (come la ✕). Una sola fascia aperta per volta: la sezione resta corta.
            host.querySelectorAll('[data-obs-fonte]').forEach(b => b.onclick = () => {
              const i = +b.dataset.obsFonte;
              fonteAperta = (fonteAperta === i) ? null : i;   // stessa parola due volte: si richiude
              disegna();   // una fascia aperta per volta: ridisegnare la chiude dov'era
            });
            if (fonteAperta != null) apriFonte(fonteAperta);
          };
          disegna();
  };
})(window.VSM);
