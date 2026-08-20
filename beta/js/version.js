/* La versione dell'app sta scritta QUI e in nessun altro posto: la legge la pagina (per mostrarla in
   fondo al menu ⋯ e per metterla nel JSON esportato) e la legge il service worker (importScripts) per
   il nome della cache. Finche' erano due numeri separati, si poteva pubblicare una build nuova
   lasciando invariato il nome della cache: nessun dispositivo si sarebbe aggiornato, e niente a
   schermo diceva quale build fosse in mano a chi provava l'app.

   VSM_BUILD e VSM_BUILD_LABEL li riscrive publish_beta.py al momento della pubblicazione: cosi' la
   riga nel menu dice l'ora esatta della build che si ha davanti, e il nome della cache cambia a ogni
   pubblicazione — cioe' l'aggiornamento parte sempre. */
self.VSM_VERSION = '0.9';
self.VSM_BUILD = '20260820-2005';           // identificatore breve, entra nel nome della cache
self.VSM_BUILD_LABEL = '20 ago 2026, 20:05';  // come si legge nel menu
