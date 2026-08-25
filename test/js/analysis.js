/* VSM Coach v2 — analysis.js: calcoli puri sulle osservazioni e sul foglio (spec fondamenta E).
   Funzioni pure (map, ix, opts): nessuna scrittura. In fase 0 entrano solo obsStats (le dieci
   funzioni vere arrivano da F1 in poi, sulle soglie di variabilita' NON prima della validazione
   sui dati veri di Gt — nessuna soglia qui) e pathTotals, che e' il riepilogo di sempre (V.metrics
   + V.flowPaths) spostato qui con una memo per map.rev (A6): il riepilogo lo consuma DAVVERO
   (R.riepilogoSVG legge V.analysis.pathTotals, non piu' V.metrics/V.flowPaths in diretta).
   Nome deliberatamente DIVERSO da V.timeStats (model.js): quello e' vivo, accetta un array di
   NUMERI e ritorna {hi,lo,avg,n} (usato da js/popover.js sul box). V.analysis.obsStats accetta le
   OSSERVAZIONI intere ({s,at,giro,cls}, A4) e ritorna n/min/max/media/mediana/p10/p90/cv. Stesso
   nome coi due contratti avrebbe fatto passare `V.analysis.timeStats(V.timesOf(el))` in silenzio
   (un array di numeri: `o.s` su un numero e' undefined, il filtro lo scarta, esce {n:0,...} senza
   errore) — rilievo Important della revisione, 2026-08-24. */
(function (V) {
  'use strict';
  const A = V.analysis = {};

  /** percentile a interpolazione lineare sul rango (metodo R-7: lo stesso di numpy/Excel
   *  PERCENTILE.INC) su un vettore GIA' ordinato. p in [0,1]. */
  function percentileOrdinato(vals, p) {
    const n = vals.length;
    if (!n) return null;
    if (n === 1) return vals[0];
    const rank = p * (n - 1);
    const lo = Math.floor(rank), hi = Math.ceil(rank);
    if (lo === hi) return vals[lo];
    return vals[lo] + (vals[hi] - vals[lo]) * (rank - lo);
  }
  A.percentile = percentileOrdinato;

  /** Statistiche di una serie di osservazioni (props.obs, A4): n, min, max, media, mediana,
   *  p10/p90 (interpolazione lineare sul rango), coefficiente di variazione (deviazione standard
   *  CAMPIONARIA / media — n-1: sono misure prese, non l'intera popolazione dei tempi possibili).
   *  Mai eliminare gli outlier (spec F1): qui si leggono e basta, la marcatura `cls` non filtra
   *  niente. Osservazioni senza un `s` numerico finito non entrano nel conto (guardia di igiene:
   *  un file rovinato non deve produrre NaN silenziosi). */
  A.obsStats = (obs) => {
    const vals = (obs || [])
      .map(o => o && o.s)
      .filter(v => typeof v === 'number' && isFinite(v))
      .sort((a, b) => a - b);
    const n = vals.length;
    if (!n) return { n: 0, min: null, max: null, mean: null, median: null, p10: null, p90: null, cv: null };
    const min = vals[0], max = vals[n - 1];
    const mean = vals.reduce((a, b) => a + b, 0) / n;
    const median = percentileOrdinato(vals, 0.5);
    const p10 = percentileOrdinato(vals, 0.1);
    const p90 = percentileOrdinato(vals, 0.9);
    // Con UNA misura la dispersione non esiste: un cv 0 avrebbe fatto dire «stabile» a un passo
    // misurato una volta sola (F1, interpretazione 3 del piano) — null, come per la serie vuota.
    const variance = n > 1 ? vals.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (n - 1) : null;
    const sd = variance == null ? null : Math.sqrt(variance);
    const cv = (sd != null && mean) ? sd / mean : null;
    return { n, min, max, mean, median, p10, p90, cv };
  };

  /** Le soglie della classe di variabilità (F1) — PROVVISORIE: la proposta del piano VMIN
   *  (CV < 0,15 stabile · < 0,35 moderata · oltre alta), adottata come costanti dichiarate in
   *  QUESTO punto solo, da validare sui dati veri di Gt (decisione aperta §6 del piano, chiusa
   *  come provvisoria il 2026-08-24). Chi le mostra (sezione del pop-up, Guida) le legge da qui. */
  A.CV_SOGLIE = { stabile: 0.15, moderata: 0.35 };

  /** La classe di variabilità dal coefficiente di variazione: null (cv null: n<2, serie vuota)
   *  = nessuna classe — mai inventata. La soglia appartiene alla classe sopra (< 0,15 stabile). */
  A.variabilita = (cv) => {
    if (cv == null || typeof cv !== 'number' || !isFinite(cv)) return null;
    return cv < A.CV_SOGLIE.stabile ? 'stabile' : cv < A.CV_SOGLIE.moderata ? 'moderata' : 'alta';
  };

  /** V.metrics + V.flowPaths (il riepilogo R6) in un solo calcolo, con memo per map.rev (A6/A7):
   *  chi ridisegna a ogni frame durante un trascinamento non li ricalcola se la mappa non e'
   *  davvero cambiata. `ix` non serve alle due funzioni di sotto (calcolano gia' il loro V.index),
   *  ma resta nella firma perche' e' quella di tutte le funzioni di analysis (spec E) — un livello
   *  futuro che ne avesse bisogno lo trova gia' pronto senza cambiare il contratto. */
  const memo = new WeakMap();
  A.pathTotals = (map, ix) => {
    if (!map) return { metrics: V.metrics(map), paths: V.flowPaths(map) };
    const rev = map.rev | 0;
    const hit = memo.get(map);
    if (hit && hit.rev === rev) return hit.val;
    const val = { metrics: V.metrics(map), paths: V.flowPaths(map) };
    memo.set(map, { rev, val });
    return val;
  };
})(window.VSM);
