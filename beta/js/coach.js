/* VSM Coach v2 — coach.js: chat con endpoint OpenAI-compatibile, contesto del foglio, patch v2 applicabili, suggerimenti di strumento. */
(function (V) {
  'use strict';
  const I = V.interact, R = V.render, UI = V.ui; const { num, uid, clone } = V.util;
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const C = V.coach = {};
  const PRESETS = {
    kimi: { base: 'https://api.moonshot.ai/v1', model: 'kimi-k2.5', hint: 'Moonshot AI · verifica l\'ID modello con "Elenca modelli"' },
    glm: { base: 'https://api.z.ai/api/paas/v4', model: 'glm-5', hint: 'Z.ai (Zhipu) · endpoint OpenAI-compatibile' },
    openrouter: { base: 'https://openrouter.ai/api/v1', model: 'moonshotai/kimi-k2', hint: 'OpenRouter · CORS abilitato dal browser' },
    custom: { base: '', model: '', hint: '' }
  };
  const cfgDefault = { preset: 'kimi', base: PRESETS.kimi.base, model: PRESETS.kimi.model, key: '', temp: 0.4, max: 2000, proxy: false, stream: true, suggest: true };
  const readJSON = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch (e) { return fallback; } };
  C.cfg = Object.assign({}, cfgDefault, readJSON('vsm.cfg', {}));
  let CHAT = readJSON('vsm.chat', []); let busy = false;
  const saveCfg = () => localStorage.setItem('vsm.cfg', JSON.stringify(C.cfg));
  const saveChat = () => localStorage.setItem('vsm.chat', JSON.stringify(CHAT.slice(-40)));
  C.ready = () => !!(C.cfg.base && C.cfg.model && (C.cfg.key || C.cfg.proxy));
  const setStatus = (t, cls) => { $('#status-text').textContent = t; $('#status-dot').className = 'dot ' + (cls || ''); };
  C.refreshStatus = () => { if (!C.ready()) setStatus('Coach non configurato: ⚙︎ per endpoint e chiave.', ''); else setStatus((C.cfg.proxy ? 'proxy locale · ' : 'diretto · ') + C.cfg.model, 'on'); };

  // ---------- contesto: il foglio in JSON ----------
  C.sheet = () => {
    const map = V.map(); const M = V.metrics(map); const fo = V.flowOrder(map);
    const el = (e) => { const base = { id: e.id, type: e.type }; if (V.isConnector(e)) { const f = V.byId(e.from.el, map), t = V.byId(e.to.el, map); return Object.assign(base, { from: e.from.el, to: e.to.el, from_label: f ? (f.props.title || f.props.label) : null, to_label: t ? (t.props.title || t.props.label) : null }, e.props); } const pos = R.elPos(e, map); const p = clone(e.props); if (p.attachedTo) { const c = V.byId(p.attachedTo, map); if (c) p.attached_between = `${V.byId(c.from.el, map)?.props.title || '?'} → ${V.byId(c.to.el, map)?.props.title || '?'}`; } delete p.dx; delete p.dy; return Object.assign(base, { x: Math.round(pos.x), y: Math.round(pos.y), w: Math.round(e.w), h: Math.round(e.h) }, p); };
    const other = (m) => m ? { id: m.id, title: m.title, kind: m.kind, box: m.elements.filter(e => e.type === 'box').map(b => ({ id: b.id, title: b.props.title, avg: b.props.avg })), riepilogo: (() => { const k = V.metrics(m); return k.hasData ? { VA: k.va, NVA: k.nva, VA_pct: Math.round(k.vaPct) } : 'senza dati'; })() } : null;
    return {
      mappa: { id: map.id, titolo: map.title, tipo: map.kind, data: map.date, autori: map.authors, unita_organizzativa: map.unitName, scopo: map.scope, ideale: map.ideal, unita_misura: map.unit, misure: map.samples },
      guida: { attiva: !!UI.guideOn },
      elementi: map.elements.map(el),
      ordine_flusso: fo.order.map(b => b.props.title || b.id), ordine_stimato: fo.estimated,
      tratti_a_matita: map.strokes.length,
      riepilogo: M.hasData ? { VA: M.va, NVA: M.nva, VA_pct: Math.round(M.vaPct), NVA_pct: Math.round(M.nvaPct), FTQ: M.ftq == null ? undefined : Math.round(M.ftq) } : 'senza dati',
      conteggi: { box: M.boxes, delta: M.deltas, frecce_flusso: M.flows, vie_richiesta: M.requests, nuvole: M.storms, persone: M.persons },
      preparazione: map.prep, validazione: map.validation, raccolta_dati: map.data, analisi: map.analysis, realismo_futuro: map.futureCheck, chiusura: map.closure,
      piano: map.plan.map((r, i) => ({ n: i + 1, what: r.what, who: r.who, when: r.when, outcome: r.outcome, a3: r.a3 })),
      mappa_accoppiata: other(map.kind === 'current' ? V.futureOf(map) : V.currentOf(map)),
      mappe_collegate: Object.values(V.doc.maps).filter(m => m.parentId === map.id).map(m => ({ id: m.id, title: m.title })),
      controlli_offline: V.lint(map).map(x => `[${x.level}] fase ${x.phase}: ${x.msg}`),
      strumenti_disponibili: ['select', 'pan', 'ink', 'eraser', 'box', 'delta', 'flow', 'request', 'person', 'storm', 'fluffy', 'burst', 'inventory', 'inbox', 'distance', 'lane', 'text', 'legend']
    };
  };

  // ---------- rendering messaggi + patch ----------
  function addMsg(role, content, opts = {}) { const el = document.createElement('div'); el.className = 'msg ' + role; if (role === 'assistant') el.innerHTML = renderMd(content); else el.textContent = content; if (opts.typing) el.classList.add('typing'); $('#chat').appendChild(el); $('#chat').scrollTop = 1e9; return el; }
  function renderMd(md) {
    const patches = [], pres = [];
    let text = md.replace(/```vsm-patch\s*([\s\S]*?)```/g, (_, j) => { patches.push(j.trim()); return `\u0000PATCH${patches.length - 1}\u0000`; });
    text = text.replace(/```[\w-]*\s*([\s\S]*?)```/g, (_, c) => { pres.push(`<pre><code>${esc(c)}</code></pre>`); return `\u0000PRE${pres.length - 1}\u0000`; });
    const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|\W)\*(?!\s)(.+?)\*(?!\w)/g, '$1<i>$2</i>').replace(/`([^`]+)`/g, '<code>$1</code>');
    let out = '', inUl = false, inOl = false; const closeLists = () => { if (inUl) { out += '</ul>'; inUl = false; } if (inOl) { out += '</ol>'; inOl = false; } };
    text.split('\n').forEach(l => {
      if (/^\s*[-*•]\s+/.test(l)) { if (!inUl) { closeLists(); out += '<ul>'; inUl = true; } out += '<li>' + inline(l.replace(/^\s*[-*•]\s+/, '')) + '</li>'; return; }
      if (/^\s*\d+[.)]\s+/.test(l)) { if (!inOl) { closeLists(); out += '<ol>'; inOl = true; } out += '<li>' + inline(l.replace(/^\s*\d+[.)]\s+/, '')) + '</li>'; return; }
      closeLists(); const hm = l.match(/^(#{1,4})\s+(.*)/); if (hm) { out += `<h3>${inline(hm[2])}</h3>`; return; } if (l.trim() === '') return; out += '<p>' + inline(l) + '</p>';
    });
    closeLists();
    pres.forEach((p, i) => { out = out.replace(`<p>\u0000PRE${i}\u0000</p>`, p).replace(`\u0000PRE${i}\u0000`, p); });
    patches.forEach((p, i) => {
      let html; try { const ops = JSON.parse(p).ops || []; html = `<div class="patch"><b>Modifiche proposte</b><ul>${ops.map(o => `<li>${esc(describe(o))}</li>`).join('')}</ul><button class="btn small primary" data-patch='${esc(JSON.stringify(ops))}'>Applica al foglio</button></div>`; } catch (e) { html = `<div class="patch">Patch non leggibile: ${esc(e.message)}</div>`; }
      out = out.replace(`\u0000PATCH${i}\u0000`, html).replace(`<p>${esc('\u0000PATCH' + i + '\u0000')}</p>`, html);
    });
    return out;
  }
  const label = (id) => { const e = V.byId(id); return e ? (e.props.title || e.props.text || e.props.label || e.props.note || V.TYPES[e.type].name) : id; };
  function describe(o) {
    switch (o.op) {
      case 'add_element': return `Aggiungi ${V.TYPES[o.type]?.name || o.type}${o.props && (o.props.title || o.props.text || o.props.label) ? ': "' + (o.props.title || o.props.text || o.props.label) + '"' : ''}${o.near ? ' vicino a ' + label(o.near) : ''}`;
      case 'update_element': return `Modifica ${label(o.id)}: ${Object.entries(o.props || {}).map(([k, v]) => k + ' = ' + (Array.isArray(v) ? v.join(' | ') : v)).join(', ')}`;
      case 'remove_element': return `Rimuovi ${label(o.id)}`;
      case 'connect': return `${o.type === 'request' ? 'Via di richiesta' : 'Freccia di flusso'} ${label(o.from)} → ${label(o.to)}${o.props?.channel ? ' (' + o.props.channel + ')' : ''}`;
      case 'add_delta_on': return `Delta sulla freccia ${label(o.flow)}${o.props?.note ? ': ' + o.props.note : ''}`;
      case 'set_meta': return `Intestazione: ${Object.entries(o).filter(([k]) => k !== 'op').map(([k, v]) => k + ' = ' + v).join(', ')}`;
      case 'add_plan_row': return `Piano: ${o.what} — ${o.who || '?'} — ${o.when || '?'} — ${o.outcome || '?'}`;
      case 'create_future_map': return 'Crea lo stato futuro come copia dell\'attuale (le modifiche seguenti con map:"future" vi si applicano)';
      case 'suggest_tool': return `Suggerisci lo strumento "${o.tool}": ${o.reason || ''}`;
      case 'focus_element': return `Evidenzia ${label(o.id)}`;
      case 'set_analysis': return `Analisi: "${(o.goodEnough || '').slice(0, 80)}"`;
      default: return 'Operazione sconosciuta: ' + o.op;
    }
  }
  C.applyOps = (ops) => {
    let map = V.map(); const startMapId = map.id; let futureMap = null; let n = 0; const opsForMap = new Map();
    const push = (m, op) => { if (!opsForMap.has(m.id)) opsForMap.set(m.id, []); opsForMap.get(m.id).push(op); };
    const target = (o) => (o.map === 'future' ? (futureMap || V.futureOf(map) || map) : (o.map === 'current' ? (V.currentOf(map) || map) : map));
    ops.forEach(o => {
      try {
        switch (o.op) {
          case 'create_future_map': { futureMap = V.createFuture(V.currentOf(map) || map); n++; break; }
          case 'add_element': { const m = target(o); if (!V.TYPES[o.type] || V.isConnector({ type: o.type })) break; let x = o.x, y = o.y; if (o.near) { const ne = V.byId(o.near, m); if (ne) { const p = R.elPos(ne, m); x = p.x + (o.type === 'storm' || o.type === 'fluffy' ? ne.w - 60 : ne.w + 40); y = p.y + (o.type === 'storm' || o.type === 'fluffy' ? -60 : 0); } } if (x == null || y == null) { const P = V.paperOf(m); const boxes = m.elements.filter(e => e.type === 'box'); x = boxes.length ? Math.max(...boxes.map(b => b.x + b.w)) + 60 : 120; y = 300; if (o.type === 'person') { x = P.w - 108; y = 100; } if (o.type === 'storm') { y = 220; } x = Math.max(20, Math.min(x, P.w - 160)); y = Math.max(20, Math.min(y, P.h - 120)); } const el = V.newElement(o.type, Math.round(x), Math.round(y), o.props || {}); if (o.id && !V.byId(String(o.id), m)) el.id = String(o.id); push(m, { t: 'add', el }); n++; break; }
          case 'update_element': { const m = target(o); const el = V.byId(o.id, m); if (!el) break; const props = clone(o.props || {}); if (props.activities && !Array.isArray(props.activities)) props.activities = String(props.activities).split('\n'); push(m, { t: 'props', id: el.id, after: props }); if (o.x != null || o.y != null) push(m, { t: 'update', id: el.id, after: { x: o.x ?? el.x, y: o.y ?? el.y } }); n++; break; }
          case 'remove_element': { const m = target(o); const el = V.byId(o.id, m); if (!el) break; const conns = m.elements.filter(c => V.isConnector(c) && (c.from.el === el.id || c.to.el === el.id)); const removedIds = new Set([el.id, ...conns.map(c => c.id)]); [el, ...conns].forEach(r => R.children(r.id, m).forEach(k => { if (!removedIds.has(k.id)) I.unlockOps(k, m).forEach(op => push(m, op)); })); push(m, { t: 'remove', el: clone(el) }); conns.forEach(c => push(m, { t: 'remove', el: clone(c) })); n++; break; }
          case 'connect': { const m = target(o); if (!['flow', 'request'].includes(o.type)) break; const f = V.byId(o.from, m), t = V.byId(o.to, m); if (!f || !t) break; const c = V.newConnector(o.type, { el: f.id }, { el: t.id }, o.props || {}); if (o.type === 'request') c.props.offset = m.elements.filter(x => x.type === 'request' && x.from.el === f.id).length; if (o.id && !V.byId(String(o.id), m)) c.id = String(o.id); push(m, { t: 'add', el: c }); n++; break; }
          case 'add_delta_on': { const m = target(o); const c = V.byId(o.flow, m); if (!c || c.type !== 'flow') break; const d = V.newElement('delta', 0, 0, o.props || {}); d.props.attachedTo = c.id; d.props.dx = 0; d.props.dy = 0; push(m, { t: 'add', el: d }); n++; break; }
          case 'set_meta': { const m = target(o); const after = {}; ['title', 'scope', 'authors', 'unitName', 'ideal', 'unit', 'samples', 'date'].forEach(k => { if (o[k] != null) after[k] = String(o[k]); }); if (Object.keys(after).length) { push(m, { t: 'meta', after }); n++; } break; }
          case 'set_analysis': { const m = target(o); push(m, { t: 'meta', after: { analysis: Object.assign(clone(m.analysis), { goodEnough: String(o.goodEnough || '') }) } }); n++; break; }
          case 'add_plan_row': { const m = target(o); const plan = clone((opsForMap.get(m.id) || []).filter(x => x.t === 'plan_set').pop()?.after || m.plan); plan.push({ id: uid(), what: o.what || '', who: o.who || '', when: o.when || '', outcome: o.outcome || '', a3: !!o.a3 }); push(m, { t: 'plan_set', after: plan }); n++; break; }
          case 'suggest_tool': UI.showSuggest(o.tool, o.reason || 'Il coach suggerisce questo strumento.', null); n++; break;
          case 'focus_element': { const el = V.byId(o.id); if (el) { I.select([el.id]); R.flash(el.id); n++; } break; }
        }
      } catch (e) { console.warn('op fallita', o, e); }
    });
    // un solo commit per mappa (una voce di undo "patch coach")
    opsForMap.forEach((ops, mapId) => { const m = V.doc.maps[mapId]; if (m && ops.length) V.commit(ops, 'patch coach', { map: m }); });
    if (futureMap && V.map().id === startMapId && ops.some(o => o.map === 'future')) UI.openMap(futureMap.id);
    UI.toast(`${n} modifiche applicate.`);
  };

  // ---------- chiamata API ----------
  async function callLLM(messages, onDelta) {
    const cfg = C.cfg; const base = cfg.proxy ? (location.origin + '/proxy') : cfg.base.replace(/\/+$/, '');
    const headers = { 'Content-Type': 'application/json' }; if (cfg.key) headers['Authorization'] = 'Bearer ' + cfg.key; if (cfg.proxy) headers['X-Upstream-Base'] = cfg.base.replace(/\/+$/, ''); if (/openrouter/.test(cfg.base)) { headers['HTTP-Referer'] = location.origin; headers['X-Title'] = 'VSM Coach'; }
    const body = { model: cfg.model, messages, temperature: +cfg.temp || 0.4, max_tokens: +cfg.max || 2000, stream: !!cfg.stream };
    const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 150000);
    const res = await fetch(base + '/chat/completions', { method: 'POST', headers, body: JSON.stringify(body), signal: ctrl.signal }).catch(e => { throw new Error('Connessione fallita (' + e.message + '). Se è un blocco CORS, attiva "passa dal proxy locale" e avvia serve.py.'); });
    clearTimeout(to);
    if (!res.ok) { const t = await res.text().catch(() => ''); throw new Error(`HTTP ${res.status}: ${t.slice(0, 300)}`); }
    // senza streaming, o quando la risposta non è leggibile a pezzi (app nativa: la chiamata passa dal sistema)
    if (!cfg.stream || !res.body || typeof res.body.getReader !== 'function') { const j = await res.json(); return j.choices?.[0]?.message?.content || ''; }
    const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '', full = '';
    while (true) { const { value, done } = await reader.read(); if (done) break; buf += dec.decode(value, { stream: true }); const parts = buf.split('\n'); buf = parts.pop(); for (const line of parts) { const s = line.trim(); if (!s.startsWith('data:')) continue; const d = s.slice(5).trim(); if (d === '[DONE]') continue; try { const j = JSON.parse(d); const c = j.choices?.[0]?.delta?.content; if (c) { full += c; onDelta(full); } } catch (e) { /* frammento */ } } }
    return full;
  }
  C.send = async (text) => {
    if (busy) return; text = (text || '').trim(); if (!text) return;
    if (!C.ready()) { C.openSettings(); return; }
    UI.showTab('coach'); busy = true; $('#chat-send').disabled = true; $('#coach-fab').classList.add('busy');
    addMsg('user', text); CHAT.push({ role: 'user', content: text }); saveChat();
    const el = addMsg('assistant', '', { typing: true });
    const sys = window.VSM_COACH_PROMPT || 'Sei un coach di value stream mapping sanitario (metodo Jimmerson). Rispondi in italiano.';
    try {
      const history = CHAT.slice(-12).map(x => ({ role: x.role, content: x.content }));
      history[history.length - 1] = { role: 'user', content: 'FOGLIO CORRENTE (JSON):\n' + JSON.stringify(C.sheet()) + '\n\nMESSAGGIO DELL\'UTENTE:\n' + text };
      const out = await callLLM([{ role: 'system', content: sys }, ...history], (partial) => { el.innerHTML = renderMd(partial); $('#chat').scrollTop = 1e9; });
      el.classList.remove('typing'); el.innerHTML = renderMd(out || '(risposta vuota)'); CHAT.push({ role: 'assistant', content: out }); saveChat(); setStatus('Risposta ricevuta ' + new Date().toLocaleTimeString('it-CH', { hour: '2-digit', minute: '2-digit' }), 'on');
      // suggerimento di strumento in coda alla risposta (auto-applicato: non modifica il foglio)
      try { const m = out.match(/```vsm-patch\s*([\s\S]*?)```/); if (m) { const ops = JSON.parse(m[1]).ops || []; ops.filter(o => o.op === 'suggest_tool' || o.op === 'focus_element').forEach(o => { if (o.op === 'suggest_tool') UI.showSuggest(o.tool, o.reason || 'Il coach suggerisce questo strumento.', null); else { const e2 = V.byId(o.id); if (e2) R.flash(e2.id); } }); } } catch (e) { /* ignora */ }
    } catch (e) { el.classList.remove('typing'); el.innerHTML = `<b>Errore:</b> ${esc(e.message)}`; setStatus('Errore: ' + e.message.slice(0, 80), 'err'); }
    finally { busy = false; $('#chat-send').disabled = false; $('#coach-fab').classList.remove('busy'); $('#chat').scrollTop = 1e9; }
  };

  // ---------- impostazioni ----------
  C.openSettings = () => {
    const d = $('#dlg-settings'); const c = C.cfg;
    $('#s-base').value = c.base; $('#s-model').value = c.model; $('#s-key').value = c.key; $('#s-temp').value = c.temp; $('#s-max').value = c.max; $('#s-proxy').checked = !!c.proxy; $('#s-stream').checked = c.stream !== false; $('#s-suggest').checked = c.suggest !== false;
    $$('#presets .btn').forEach(b => b.setAttribute('aria-pressed', b.dataset.preset === c.preset)); $('#s-models').textContent = PRESETS[c.preset]?.hint || ''; d.showModal();
  };
  C.init = () => {
    $$('#presets .btn').forEach(b => b.addEventListener('click', () => { const p = PRESETS[b.dataset.preset]; C.cfg.preset = b.dataset.preset; if (p.base) { $('#s-base').value = p.base; $('#s-model').value = p.model; } $$('#presets .btn').forEach(x => x.setAttribute('aria-pressed', x === b)); $('#s-models').textContent = p.hint; }));
    $('#s-cancel').onclick = () => $('#dlg-settings').close();
    $('#s-ok').onclick = () => { Object.assign(C.cfg, { base: $('#s-base').value.trim(), model: $('#s-model').value.trim(), key: $('#s-key').value.trim(), temp: +$('#s-temp').value, max: +$('#s-max').value, proxy: $('#s-proxy').checked, stream: $('#s-stream').checked, suggest: $('#s-suggest').checked }); saveCfg(); UI.suggestOn = C.cfg.suggest; $('#dlg-settings').close(); C.refreshStatus(); UI.toast('Impostazioni salvate.'); };
    $('#s-list').onclick = async () => {
      const proxy = $('#s-proxy').checked; const base = proxy ? location.origin + '/proxy' : $('#s-base').value.trim().replace(/\/+$/, ''); const headers = {}; const key = $('#s-key').value.trim(); if (key) headers['Authorization'] = 'Bearer ' + key; if (proxy) headers['X-Upstream-Base'] = $('#s-base').value.trim().replace(/\/+$/, '');
      $('#s-models').textContent = 'Richiesta in corso…';
      try { const r = await fetch(base + '/models', { headers }); if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200)); const j = await r.json(); const ids = (j.data || j.models || []).map(x => x.id || x.name).filter(Boolean); $('#s-models').innerHTML = ids.length ? 'Modelli: ' + ids.slice(0, 40).map(i => `<a href="#" data-m="${esc(i)}">${esc(i)}</a>`).join(' · ') : 'Nessun modello elencato.'; $$('#s-models a').forEach(a => a.onclick = (e) => { e.preventDefault(); $('#s-model').value = a.dataset.m; }); }
      catch (e) { $('#s-models').textContent = 'Impossibile elencare: ' + e.message + (/(Failed to fetch|NetworkError)/.test(e.message) ? ' — probabile blocco CORS: usa il proxy locale.' : ''); }
    };
    $('#btn-settings').onclick = C.openSettings;
    $('#chat-send').onclick = () => { const t = $('#chat-input'); C.send(t.value); t.value = ''; t.style.height = 'auto'; };
    $('#chat-input').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#chat-send').click(); } });
    $('#chat-input').addEventListener('input', (e) => { e.target.style.height = 'auto'; e.target.style.height = Math.min(140, e.target.scrollHeight) + 'px'; });
    $$('.quick .btn').forEach(b => b.onclick = () => C.send(b.dataset.q));
    $('#chat').addEventListener('click', (e) => { const b = e.target.closest('[data-patch]'); if (b) { try { C.applyOps(JSON.parse(b.dataset.patch)); b.textContent = 'Applicate ✓'; b.disabled = true; } catch (err) { UI.toast('Patch non valida: ' + err.message); } } });
    $('#btn-clear-chat').onclick = () => { CHAT = []; saveChat(); $('#chat').innerHTML = ''; C.welcome(); };
    $('#coach-fab').onclick = () => { UI.showTab('coach'); if (!CHAT.length && C.ready()) C.send('Cosa faccio adesso? Guarda il foglio e dimmi il prossimo passo e lo strumento da usare.'); else if (!C.ready()) C.openSettings(); };
    UI.suggestOn = C.cfg.suggest !== false;
    C.welcome(); C.refreshStatus();
  };
  C.welcome = () => { addMsg('system', 'Il coach legge il foglio (elementi, tempi, nuvole, piano) e guida una fase alla volta secondo il metodo Jimmerson. Le modifiche che propone si applicano con un click e si annullano con ↶. Niente dati identificativi di pazienti.'); CHAT.forEach(x => addMsg(x.role, x.content)); };
})(window.VSM);
