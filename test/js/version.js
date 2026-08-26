/* La versione dell'app sta scritta QUI e in nessun altro posto: la legge la pagina (per mostrarla in
   fondo al menu ⋯ e per metterla nel JSON esportato) e la legge il service worker (importScripts) per
   il nome della cache. Finche' erano due numeri separati, si poteva pubblicare una build nuova
   lasciando invariato il nome della cache: nessun dispositivo si sarebbe aggiornato, e niente a
   schermo diceva quale build fosse in mano a chi provava l'app.

   VSM_BUILD e VSM_BUILD_LABEL li riscrive publish_beta.py al momento della pubblicazione: cosi' la
   riga nel menu dice l'ora esatta della build che si ha davanti, e il nome della cache cambia a ogni
   pubblicazione — cioe' l'aggiornamento parte sempre. */
self.VSM_VERSION = '0.91x';
/* Quale installazione è questa: 'stabile', 'beta' o 'sviluppo'. Da qui dipende lo spazio in cui l'app
   tiene le mappe: IndexedDB appartiene all'ORIGINE, non alla cartella, quindi senza questa distinzione
   l'app pubblicata e la beta scrivevano sullo stesso identico documento, ognuna col proprio codice.
   Lo imposta publish_beta.py nella copia pubblicata; nei sorgenti resta 'sviluppo'. */
self.VSM_CHANNEL = 'test';
self.VSM_BUILD = '20260826-1531';           // identificatore breve, entra nel nome della cache
self.VSM_BUILD_LABEL = '26 ago 2026, 15:31';  // come si legge nel menu
