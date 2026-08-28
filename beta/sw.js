// Service worker minimale: cache dei file dell'app per uso offline (le chiamate API non vengono mai messe in cache).
// FAMILY tiene separate le installazioni che vivono sullo stesso dominio (app e beta): la pulizia qui sotto
// cancella solo le versioni vecchie della PROPRIA famiglia. Senza questo, aprire la beta avrebbe svuotato
// la cache dell'app gia' installata sull'iPad — cioe' le avrebbe tolto il funzionamento senza rete.
const FAMILY = 'vsm-coach-beta';
// Il numero dell'app sta in un file solo (js/version.js), letto anche dalla pagina.
// BUILD invece va scritto QUI dentro, e lo riscrive publish_beta.py a ogni pubblicazione: il browser
// decide se c'e' un service worker nuovo confrontando i BYTE DI QUESTO FILE, e con la sola versione
// importata da fuori questo file restava identico — il service worker non si aggiornava, e i
// dispositivi continuavano a servire dalla cache la build precedente. publish_beta.py controlla che i
// due timbri coincidano, cosi' non possono separarsi.
importScripts('./js/version.js');
importScripts('./js/manifest.js');
const BUILD = '20260828-1123';
const CACHE = FAMILY + '-v' + self.VSM_VERSION + '-' + BUILD;
const FILES = ['./', './index.html', './app.css', './manifest.webmanifest', './icon.svg',
  './icon-180.png', './icon-192.png', './icon-512.png', './js/manifest.js']
  .concat(self.VSM_FILES.map((f) => './' + f));
// Install atomico, di proposito: se un file manca, l'install FALLISCE e restano in servizio il service
// worker e la cache precedenti, completi e funzionanti. La variante "tollerante" (cache file per file)
// era peggio del male: una cache parziale si installava "con successo" e l'activate cancellava quella
// buona — un deploy sbagliato rompeva l'app offline in silenzio.
// `cache: 'reload'` su ogni file: senza, l'installazione li chiede alla cache HTTP del browser, e
// GitHub Pages li serve con max-age=600 — una pubblicazione fatta entro dieci minuti dalla precedente
// finiva in una cache col nome nuovo e i file VECCHI dentro. Sembrava un aggiornamento riuscito.
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k.startsWith(FAMILY + '-v')).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.includes('/proxy/') || url.origin !== location.origin) return;
  // Prima la cache, poi la rete (aggiornamento in sottofondo): l'app parte subito e non dipende dalla rete.
  // Conseguenza voluta: dopo un aggiornamento il dispositivo mostra la versione nuova al secondo avvio.
  e.respondWith(caches.match(e.request).then((hit) => {
    // offline dichiarato + file in cache: inutile tentare 16 fetch destinate a fallire a ogni avvio
    if (hit && self.navigator && self.navigator.onLine === false) return hit;
    // il catch va agganciato SUBITO: con `hit || fresh.catch(...)` l'|| corto-circuitava e la fetch di
    // sottofondo restava con la rejection non gestita (16+ errori a ogni avvio offline)
    // `cache: 'no-cache'` (C6 del triage debug 25/8, Grok #6): il refresh DEVE rivalidare con
    // l'origine. Senza, la fetch passava dalla cache HTTP del browser (GitHub Pages: max-age=600)
    // e poteva rimettere byte VECCHI sopra i file appena installati con cache:'reload' — build
    // miste dentro la stessa cache, e il timbro data-ora poteva mentire.
    const fresh = fetch(e.request, { cache: 'no-cache' })
      .then((r) => { if (r && r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); } return r; })
      .catch(() => hit);
    // niente respondWith(undefined): se cache e rete falliscono entrambe, un errore di rete esplicito
    return hit ? Promise.resolve(hit) : fresh.then((r) => r || Response.error());
  }));
});
