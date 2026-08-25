/* VSM Coach v2 — layers.js: registro dei livelli di analisi (spec fondamenta B).
   Un livello e' { id, label, phaseMin, badge, section, overlay, extent }: la chiave in map.layers,
   la voce di menu, la fase minima per accenderlo (null = sempre, come il riepilogo), un badge per
   elemento, una sezione nel pop-up del passo, un disegno a livello di foglio, e rettangoli extra
   per il crop (contentBox). Solo questo in fase 0: aggregate/geometry entrano col primo livello
   che li usa (F3/F7/F4). Il riepilogo di oggi si registra come 'riepilogo' in render.js (Step 5). */
(function (V) {
  'use strict';
  const REG = [];
  const byId = new Map();
  const L = V.layers = {};

  /** Registra (o sostituisce, stesso id: comodo per i test che si ri-registrano) un livello.
   *  Alimenta anche V.LAYER_PHASE_MIN (model.js, la porta 'livelli' di V.allowed, A2): registro e
   *  porta leggono la STESSA soglia, non possono mai dire due cose diverse. */
  L.register = (def) => {
    const i = REG.findIndex(l => l.id === def.id);
    // Due moduli diversi con lo stesso id (o un modulo che cambia idea) abbassano/alzano la soglia
    // di fase in silenzio: la porta (V.allowed, A2) legge V.LAYER_PHASE_MIN e non direbbe mai due
    // cose diverse, ma prima di questo avviso non c'era modo di accorgersi CHE e' cambiata (rilievo
    // della revisione avversariale, seconda passata). Un modulo che si ri-registra IDENTICO (i test)
    // non stampa niente: solo un phaseMin diverso lo fa.
    if (i >= 0 && REG[i].phaseMin !== def.phaseMin) {
      console.warn('livello "' + def.id + '": ri-registrato con una soglia di fase diversa (' + REG[i].phaseMin + ' -> ' + def.phaseMin + ')');
    }
    if (i >= 0) REG[i] = def; else REG.push(def);
    byId.set(def.id, def);
    V.LAYER_PHASE_MIN[def.id] = def.phaseMin == null ? null : def.phaseMin;
    return def;
  };

  /** tutti i livelli registrati, nell'ordine di registrazione */
  L.all = () => REG.slice();
  L.get = (id) => byId.get(id);

  /** un livello e' ammesso quando la fase del foglio e' alla sua soglia o oltre (A2/B):
   *  phaseMin null = sempre ammesso, come il riepilogo. */
  L.ammesso = (l, map) => {
    if (!l || l.phaseMin == null) return true;
    const fase = (map && map.phase) || 'disegna';
    return V.PHASE_ORDER.indexOf(fase) >= V.PHASE_ORDER.indexOf(l.phaseMin);
  };

  /** livelli ACCESI (map.layers[id]) e AMMESSI dalla fase corrente, in ordine di registrazione */
  L.active = (map) => {
    if (!map) return [];
    const layers = map.layers || {};
    return REG.filter(l => layers[l.id] && L.ammesso(l, map));
  };

  /** accende/spegne un livello: passa dalla porta unica (V.commit -> V.allowed, classe 'livelli').
   *  {silent:true} come measure/obs (A4): non entra nell'annulla (interpretazione 5). */
  L.toggle = (map, id) => {
    const l = byId.get(id); if (!l || !map) return false;
    const on = !(map.layers && map.layers[id]);
    return V.commit({ t: 'meta', after: { layers: Object.assign({}, map.layers, { [id]: on }) } },
      (on ? 'livello acceso: ' : 'livello spento: ') + (l.label || id), { silent: true });
  };
})(window.VSM);
