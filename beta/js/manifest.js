/* js/manifest.js — L'UNICA lista dei moduli dell'app (spec fondamenta, G).
   La leggono: index.html (che da qui inserisce gli script, nell'ordine), sw.js
   (importScripts, per la cache offline), build.py, build_android.py e publish_beta.py
   (regex su questo file). Un modulo nuovo si aggiunge QUI e da nessun'altra parte:
   test/build.test.js fa fallire la suite se le liste non dicono la stessa cosa.
   `self` e non `window`: dentro il service worker window non esiste. */
self.VSM_FILES = ['js/version.js', 'prompt.js', 'js/model.js', 'js/analysis.js', 'js/layers.js',
  'js/render.js', 'js/tempo.js', 'js/interact.js', 'js/popover.js', 'js/panels.js', 'js/legend.js',
  'js/coach.js', 'js/main.js'];
