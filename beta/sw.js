// Service worker minimale: cache dei file dell'app per uso offline (le chiamate API non vengono mai messe in cache).
// FAMILY tiene separate le installazioni che vivono sullo stesso dominio (app e beta): la pulizia qui sotto
// cancella solo le versioni vecchie della PROPRIA famiglia. Senza questo, aprire la beta avrebbe svuotato
// la cache dell'app gia' installata sull'iPad — cioe' le avrebbe tolto il funzionamento senza rete.
const FAMILY = 'vsm-coach-beta';
const CACHE = FAMILY + '-v10';
const FILES = ['./', './index.html', './app.css', './prompt.js', './js/model.js', './js/render.js', './js/interact.js', './js/panels.js', './js/legend.js', './js/coach.js', './js/main.js', './manifest.webmanifest', './icon.svg', './icon-180.png', './icon-192.png', './icon-512.png'];
// addAll e' tutto-o-niente: un solo file mancante lasciava l'app SENZA cache, quindi senza offline,
// e in silenzio. Si mette in cache file per file: quel che c'e' si salva comunque.
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE)
  .then((c) => Promise.all(FILES.map((f) => c.add(f).catch(() => null))))
  .then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k.startsWith(FAMILY + '-v')).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.includes('/proxy/') || url.origin !== location.origin) return;
  // Prima la cache, poi la rete (aggiornamento in sottofondo): l'app parte subito e non dipende dalla rete.
  // Conseguenza voluta: dopo un aggiornamento il dispositivo mostra la versione nuova al secondo avvio.
  e.respondWith(caches.match(e.request).then((hit) => {
    const fresh = fetch(e.request).then((r) => { if (r && r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); } return r; });
    return hit || fresh.catch(() => hit);
  }));
});
