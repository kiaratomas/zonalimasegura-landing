/* =========================================================
   ZonaLimaSegura · Lógica de la Landing Page
   Cada bloque indica las Historias de Usuario (HU) que atiende.
   Los datos se guardan en el navegador (localStorage) para que
   la información siga disponible sin conexión.
   ========================================================= */
'use strict';

(() => {
  const D = ZLS_DATA;
  const M = ZLSMap;
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
  const ICONS = '../assets/icons/sprite.svg';
  const icon = (id, cls = 'icon') => `<svg class="${cls}" aria-hidden="true"><use href="${ICONS}#i-${id}"/></svg>`;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const clone = o => JSON.parse(JSON.stringify(o));
  const today = () => new Date().toISOString().slice(0, 10);
  const fmtDate = iso => new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  const fmtDay = iso => new Date(iso + (iso.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
  const uid = p => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

  /* ======================= Estado persistente ======================= */
  const STORE_KEY = 'zls-state-v1';
  const DEFAULT_STATE = {
    font: 1,
    profile: 'residentes',
    home: null,
    diag: null,
    plan: { puntoId: null, routeKey: null },
    puntosExtra: [],
    peligros: clone(D.PELIGROS),
    bloqueos: clone(D.BLOQUEOS),
    rutasCom: clone(D.RUTAS_COM),
    contacts: [{ id: 'c1', name: 'Carlos Quispe', rel: 'Hijo o hija', phone: '987654321', main: true }],
    sharing: null,
    offline: { res: null, brig: null, sen: null },
    senRouteKey: null
  };
  let state;
  try { state = Object.assign(clone(DEFAULT_STATE), JSON.parse(localStorage.getItem(STORE_KEY) || '{}')); }
  catch (e) { state = clone(DEFAULT_STATE); }
  const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* almacenamiento no disponible */ } };

  const EXAMPLE_HOME = { x: 430, y: 270, label: 'Jr. Las Flores 245 (dirección de ejemplo)', example: true };
  const homeOrExample = () => state.home || EXAMPLE_HOME;
  const allPuntos = () => D.PUNTOS.concat(state.puntosExtra);
  const puntoById = id => allPuntos().find(p => p.id === id);
  const streetNameAt = (x, y) => {
    const h = D.STREETS.find(s => s.dir === 'h' && s.at === y);
    const v = D.STREETS.find(s => s.dir === 'v' && s.at === x);
    return (h || v || { name: 'Calle local' }).name;
  };
  const nearestStreetName = (x, y) => { const s = M.snapToStreet(x, y); return streetNameAt(s.x, s.y); };
  const bloqueosWithLabels = () => state.bloqueos.map(b => {
    const e = M.allEdges().find(ed => ed.key === M.edgeKey(b.a, b.b));
    return Object.assign({}, b, { label: e ? M.edgeLabel(e) : '' });
  });

  /* ======================= Utilidades de interfaz ======================= */
  const toastEl = $('#toast');
  let toastTimer;
  function toast(msg) {
    toastEl.innerHTML = `${icon('check')}<span>${esc(msg)}</span>`;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), 3800);
  }

  const modal = $('#modal');
  function openModal({ title, body, actions = [] }) {
    $('#modal-title').textContent = title;
    const b = $('#modal-body');
    b.innerHTML = '';
    if (typeof body === 'string') b.innerHTML = body; else b.appendChild(body);
    const a = $('#modal-actions');
    a.innerHTML = '';
    actions.forEach(act => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `btn ${act.variant || 'btn--secondary'}`;
      btn.textContent = act.label;
      btn.addEventListener('click', () => { const keep = act.onClick && act.onClick() === false; if (!keep) modal.close(); });
      a.appendChild(btn);
    });
    if (typeof modal.showModal === 'function') modal.showModal(); else modal.setAttribute('open', '');
  }

  function setError(input, errEl, msg) {
    errEl.textContent = msg || '';
    if (input) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    return !msg;
  }

  /* ======================= Pestañas accesibles (ARIA) ======================= */
  function activateTab(tab, focus = true) {
    const list = tab.closest('[role="tablist"]');
    $$('[role="tab"]', list).forEach(t => {
      const on = t === tab;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
      $('#' + t.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) tab.focus();
    document.dispatchEvent(new CustomEvent('zls:tab', { detail: tab.id }));
  }
  $$('[role="tablist"]').forEach(list => {
    const tabs = $$('[role="tab"]', list);
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => activateTab(t));
      t.addEventListener('keydown', e => {
        let n = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = tabs[(i + 1) % tabs.length];
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = tabs[(i - 1 + tabs.length) % tabs.length];
        if (e.key === 'Home') n = tabs[0];
        if (e.key === 'End') n = tabs[tabs.length - 1];
        if (n) { e.preventDefault(); activateTab(n); }
      });
    });
  });
  function goToTab(tabId, focusSel) {
    const tab = $('#' + tabId);
    activateTab(tab, false);
    const section = tab.closest('section');
    section.scrollIntoView({ block: 'start' });
    const target = focusSel ? $(focusSel) : $('#' + tab.getAttribute('aria-controls'));
    setTimeout(() => target && target.focus({ preventScroll: true }), 60);
  }
  document.addEventListener('click', e => {
    const g = e.target.closest('[data-goto]');
    if (g) goToTab(g.dataset.goto);
  });

  /* ======================= Navegación principal ======================= */
  const navToggle = $('#nav-toggle');
  const nav = $('#site-nav');
  navToggle.addEventListener('click', () => {
    const open = navToggle.getAttribute('aria-expanded') !== 'true';
    navToggle.setAttribute('aria-expanded', open);
    nav.classList.toggle('is-open', open);
  });
  $$('a', nav).forEach(a => a.addEventListener('click', () => { navToggle.setAttribute('aria-expanded', 'false'); nav.classList.remove('is-open'); }));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) { navToggle.setAttribute('aria-expanded', 'false'); nav.classList.remove('is-open'); navToggle.focus(); }
  });
  if ('IntersectionObserver' in window) {
    const links = $$('a[href^="#"]', nav);
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        links.forEach(l => l.setAttribute('aria-current', l.getAttribute('href') === '#' + en.target.id ? 'true' : 'false'));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['inicio', 'residentes', 'brigadistas', 'adultos', 'nosotros'].forEach(id => io.observe($('#' + id)));
  }

  /* ======================= HU-33 · Letra grande ======================= */
  function applyFont(level) {
    state.font = level;
    document.documentElement.dataset.font = level;
    $$('.font-btn').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.font) === level)));
    save();
  }
  $$('.font-btn').forEach(b => b.addEventListener('click', () => {
    applyFont(Number(b.dataset.font));
    toast(['Letra normal', 'Letra grande activada', 'Letra muy grande activada'][Number(b.dataset.font) - 1]);
  }));

  /* ======================= Elección de perfil (UF-01) ======================= */
  const profileForm = $('#profile-form');
  const savedProfile = $(`input[name="perfil"][value="${state.profile}"]`, profileForm);
  if (savedProfile) savedProfile.checked = true;
  profileForm.addEventListener('submit', e => {
    e.preventDefault();
    const v = $('input[name="perfil"]:checked', profileForm).value;
    state.profile = v; save();
    const section = $('#' + v);
    section.scrollIntoView({ block: 'start' });
    setTimeout(() => $('.section-title', section).focus({ preventScroll: true }), 60);
  });

  /* =========================================================
     SEGMENTO 1 · RESIDENTES
     ========================================================= */

  /* ---------- HU-01 · Ubicar la vivienda ---------- */
  const homeSearch = $('#home-search');
  const homeErr = $('#home-search-error');
  const homeStatus = $('#home-status');
  const mapZona = $('#map-res-zona');
  $('#home-addresses').innerHTML = D.ADDRESSES.map(a => `<option value="${esc(a.label)}"></option>`).join('');
  let pickMode = false;
  let pickCursor = { x: 400, y: 270 };

  function setHome(home, how) {
    state.home = home; save();
    const zone = M.soilAt(home.x);
    homeStatus.innerHTML = `${icon('check')} <strong>Vivienda ubicada:</strong> ${esc(home.label)}. ${esc(how || '')} Tu zona tiene <strong>${D.RISK_LEVELS[zone.level].label}</strong>.`;
    setError(homeSearch, homeErr, '');
    renderAllResident();
    renderSenior();
  }

  $('#home-form').addEventListener('submit', e => {
    e.preventDefault();
    const q = norm(homeSearch.value);
    if (!q) { setError(homeSearch, homeErr, 'Escribe tu dirección para buscarla.'); homeSearch.focus(); return; }
    const found = D.ADDRESSES.find(a => norm(a.label) === q) || D.ADDRESSES.find(a => norm(a.label).includes(q) || q.includes(norm(a.label)));
    if (!found) {
      setError(homeSearch, homeErr, 'No encontramos esa dirección en el sector demostrativo. Elige una de la lista o márcala en el mapa.');
      homeSearch.focus();
      return;
    }
    homeSearch.value = found.label;
    setHome({ x: found.x, y: found.y, label: found.label }, 'La encontramos por búsqueda.');
  });

  $('#home-geo').addEventListener('click', () => {
    if (!('geolocation' in navigator)) { homeStatus.textContent = 'Tu navegador no permite usar la ubicación. Escribe tu dirección o márcala en el mapa.'; return; }
    homeStatus.textContent = 'Buscando tu ubicación…';
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude: lat, longitude: lon } = pos.coords;
      const i = Math.abs(Math.round(lat * 1000) + Math.round(lon * 1000)) % D.ADDRESSES.length;
      const a = D.ADDRESSES[i];
      homeSearch.value = a.label;
      setHome({ x: a.x, y: a.y, label: a.label }, 'Como tu ubicación real está fuera del sector demostrativo, te ubicamos de forma aproximada. Puedes corregirla marcándola en el mapa.');
    }, () => {
      homeStatus.textContent = 'No pudimos acceder a tu ubicación. Escribe tu dirección o márcala en el mapa.';
    }, { timeout: 8000, maximumAge: 60000 });
  });

  function setPickMode(on) {
    pickMode = on;
    const btn = $('#home-pick');
    btn.setAttribute('aria-pressed', String(on));
    btn.lastChild.textContent = on ? 'Cancelar marcado' : 'Marcar en el mapa';
    $('#pick-hint-res').hidden = !on;
    mapZona.classList.toggle('map--pick', on);
    if (on) { mapZona.setAttribute('tabindex', '0'); mapZona.setAttribute('aria-describedby', 'pick-hint-res'); pickCursor = state.home ? { x: state.home.x, y: state.home.y } : { x: 400, y: 270 }; mapZona.focus(); }
    else { mapZona.removeAttribute('tabindex'); mapZona.removeAttribute('aria-describedby'); }
    renderZona();
  }
  $('#home-pick').addEventListener('click', () => setPickMode(!pickMode));
  function placeHomeAt(p) {
    const s = M.snapToStreet(p.x, p.y);
    const name = streetNameAt(s.x, s.y);
    homeSearch.value = '';
    setPickMode(false);
    setHome({ x: s.x, y: s.y, label: `${name} (punto marcado en el mapa)` }, 'La marcaste en el mapa.');
    $('#home-pick').focus();
  }
  mapZona.addEventListener('click', e => { if (pickMode) placeHomeAt(M.svgPoint(mapZona, e)); });
  mapZona.addEventListener('keydown', e => {
    if (!pickMode) return;
    const step = e.shiftKey ? 40 : 15;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) {
      e.preventDefault();
      pickCursor = { x: Math.max(10, Math.min(790, pickCursor.x + moves[e.key][0])), y: Math.max(10, Math.min(490, pickCursor.y + moves[e.key][1])) };
      renderZona();
      mapZona.setAttribute('aria-label', `Marcador cerca de ${nearestStreetName(pickCursor.x, pickCursor.y)}. Pulsa Enter para ubicar tu vivienda aquí.`);
    } else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); placeHomeAt(pickCursor); }
    else if (e.key === 'Escape') { setPickMode(false); $('#home-pick').focus(); }
  });

  /* ---------- HU-02 · Nivel de riesgo  ·  HU-03 · Suelo simplificado ---------- */
  function renderRisk() {
    const chip = $('#risk-chip');
    if (!state.home) {
      chip.removeAttribute('data-level');
      $('#risk-chip-text').textContent = 'Ubica tu vivienda';
      $('#risk-headline').textContent = 'Cuando ubiques tu vivienda verás aquí el nivel de riesgo de tu zona.';
      $('#risk-text').textContent = '';
      $$('#risk-scale li').forEach(li => li.removeAttribute('data-active'));
      return;
    }
    const zone = M.soilAt(state.home.x);
    const lv = D.RISK_LEVELS[zone.level];
    chip.dataset.level = zone.level;
    $('#risk-chip-text').textContent = lv.label;
    $('#risk-headline').textContent = lv.title;
    $('#risk-text').textContent = lv.text;
    $$('#risk-scale li').forEach(li => {
      const on = Number(li.dataset.level) === zone.level;
      li.dataset.active = String(on);
      if (on) li.setAttribute('aria-current', 'true'); else li.removeAttribute('aria-current');
    });
  }

  function renderSoil() {
    const zone = state.home ? M.soilAt(state.home.x) : null;
    $('#soil-current').innerHTML = zone
      ? `Tu vivienda está sobre: <strong>${esc(zone.name)}</strong> (${esc(zone.short.toLowerCase())}).`
      : 'Ubica tu vivienda para conocer el tipo de suelo.';
    $('#soil-legend').innerHTML = D.SOIL_ZONES.slice().sort((a, b) => b.level - a.level).map(z => `
      <li data-current="${zone && zone.id === z.id}">
        <span class="soil-swatch soil-swatch--${z.id}" aria-hidden="true"></span>
        <span><strong>${esc(z.name)}</strong><br><span class="muted">Nivel ${z.level} · ${esc(z.short)}</span></span>
        <button type="button" class="link-btn" data-soil="${z.id}">¿Qué significa?<span class="sr-only"> ${esc(z.name)}</span></button>
      </li>`).join('');
  }
  $('#soil-legend').addEventListener('click', e => {
    const b = e.target.closest('[data-soil]');
    if (!b) return;
    const z = D.SOIL_ZONES.find(s => s.id === b.dataset.soil);
    openModal({
      title: `${z.name} · Nivel ${z.level}`,
      body: `<p>${esc(z.plain)}</p><h3 class="card__title">¿Qué puedes hacer?</h3><ul class="rec-list">${z.tips.map(t => `<li>${icon('check')}<span>${esc(t)}</span></li>`).join('')}</ul><p class="small muted">Información simplificada a partir del Mapa de Microzonificación Sísmica (CISMID). Datos de demostración.</p>`,
      actions: [{ label: 'Entendido', variant: 'btn--primary' }]
    });
  });
  $('#soil-toggle').addEventListener('change', renderZona);

  function renderZona() {
    M.draw(mapZona, {
      title: 'Mapa de mi zona con tipos de suelo',
      soil: $('#soil-toggle').checked,
      home: state.home,
      puntos: allPuntos(),
      peligros: state.peligros,
      pick: pickMode ? pickCursor : null
    });
    if (!pickMode) mapZona.setAttribute('aria-label', state.home ? `Mapa de mi zona. Vivienda en ${state.home.label}.` : 'Mapa de mi zona. Aún no ubicas tu vivienda.');
  }
  mapZona.addEventListener('mousemove', e => { if (!pickMode) return; pickCursor = M.svgPoint(mapZona, e); renderZona(); });

  /* ---------- HU-04/05/06/07 · Autodiagnóstico visual ---------- */
  const diag = { step: 0, answers: {} };
  const views = { intro: $('#diag-intro'), step: $('#diag-step'), result: $('#diag-result') };
  const showView = v => Object.entries(views).forEach(([k, el]) => { el.hidden = k !== v; });
  const ANSWER_TXT = { si: 'Sí la veo', no: 'No la veo', nose: 'No estoy seguro' };

  $('#signs-grid').innerHTML = D.SENALES.map(s => `
    <li><img src="../assets/images/${s.img}" width="320" height="220" alt="${esc(s.alt)}" loading="lazy">
      <strong>${esc(s.q)}</strong><p>${esc(s.example)}</p></li>`).join('');
  $('#diag-show-signs').addEventListener('click', e => {
    const cat = $('#signs-catalog');
    cat.hidden = !cat.hidden;
    e.currentTarget.setAttribute('aria-expanded', String(!cat.hidden));
    if (!cat.hidden) cat.querySelector('h4').setAttribute('tabindex', '-1'), cat.querySelector('h4').focus();
  });
  $('#diag-show-signs').setAttribute('aria-expanded', 'false');
  $('#diag-show-signs').setAttribute('aria-controls', 'signs-catalog');

  function renderDiagLast() {
    const box = $('#diag-last');
    if (!state.diag) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = `Tu último resultado (${esc(fmtDate(state.diag.date))}): <strong>${esc(state.diag.label)}</strong>. <button type="button" class="link-btn" id="diag-see-last">Ver resultado</button>`;
    $('#diag-see-last').addEventListener('click', () => { diag.answers = Object.assign({}, state.diag.answers); renderResult(); });
  }

  function renderStep() {
    const s = D.SENALES[diag.step];
    const n = diag.step + 1; const total = D.SENALES.length;
    $('#diag-progress-text').textContent = `Paso ${n} de ${total}`;
    const pb = $('#diag-step .progress');
    pb.setAttribute('aria-valuenow', n); pb.setAttribute('aria-valuemax', total);
    $('#diag-progress-bar').style.width = `${(n / total) * 100}%`;
    const img = $('#diag-img'); img.src = `../assets/images/${s.img}`; img.alt = s.alt;
    $('#diag-question').textContent = s.q;
    $('#diag-hint').textContent = s.hint;
    $$('input[name="diag-answer"]').forEach(r => { r.checked = diag.answers[s.id] === r.value; });
    $('#diag-error').textContent = '';
    $('#diag-prev').textContent = diag.step === 0 ? 'Volver' : 'Anterior';
    $('#diag-next').textContent = n === total ? 'Ver resultado' : 'Continuar';
  }
  $('#diag-start').addEventListener('click', () => {
    diag.step = 0; diag.answers = {};
    showView('step'); renderStep();
    $('#diag-question').setAttribute('tabindex', '-1'); $('#diag-question').focus();
  });
  $('#diag-example').addEventListener('click', () => {
    const s = D.SENALES[diag.step];
    openModal({ title: 'Ejemplo de la señal', body: `<img src="../assets/images/${s.img}" width="320" height="220" alt="${esc(s.alt)}"><p><strong>${esc(s.q)}</strong></p><p>${esc(s.example)}</p>`, actions: [{ label: 'Entendido', variant: 'btn--primary' }] });
  });
  $('#diag-prev').addEventListener('click', () => {
    if (diag.step === 0) { showView('intro'); $('#diag-start').focus(); return; }
    diag.step -= 1; renderStep(); $('#diag-question').focus();
  });
  $('#diag-step').addEventListener('submit', e => {
    e.preventDefault();
    const sel = $('input[name="diag-answer"]:checked');
    if (!sel) { $('#diag-error').textContent = 'Elige una opción para continuar.'; $('input[name="diag-answer"]').focus(); return; }
    diag.answers[D.SENALES[diag.step].id] = sel.value;
    if (diag.step < D.SENALES.length - 1) { diag.step += 1; renderStep(); $('#diag-question').focus(); }
    else finishDiag();
  });

  function evaluate(answers) {
    let score = 0;
    Object.values(answers).forEach(v => { score += v === 'si' ? 2 : v === 'nose' ? 1 : 0; });
    let level = score <= 2 ? 1 : score <= 6 ? 2 : 3;
    if (level === 1 && (answers.s1 === 'si' || answers.s3 === 'si')) level = 2;
    const info = {
      1: { label: 'Pocas señales de vulnerabilidad', text: 'No identificaste señales importantes. Mantén tu vivienda en buen estado y sigue preparándote.' },
      2: { label: 'Algunas señales de vulnerabilidad', text: 'Identificaste señales que conviene revisar. Te recomendamos pedir una evaluación técnica y reforzar tu plan de evacuación.' },
      3: { label: 'Varias señales de vulnerabilidad', text: 'Tu vivienda presenta varias señales que pueden hacerla más vulnerable ante un sismo. Solicita pronto la revisión de un profesional.' }
    }[level];
    return { level, score, ...info };
  }
  function finishDiag() {
    const r = evaluate(diag.answers);
    state.diag = { answers: Object.assign({}, diag.answers), level: r.level, label: r.label, date: new Date().toISOString() };
    save();
    renderResult();
    renderPlan();
  }
  function renderResult() {
    const r = evaluate(diag.answers);
    showView('result');
    $('#diag-gauge').style.setProperty('--angle', `${[-60, 0, 60][r.level - 1]}deg`);
    $('#diag-gauge span').style.setProperty('--angle', `${[-60, 0, 60][r.level - 1]}deg`);
    const chip = $('#diag-result-chip');
    chip.dataset.level = r.level;
    chip.innerHTML = `<span class="dot" aria-hidden="true"></span>Nivel ${r.level} de 3 · ${esc(r.label)}`;
    $('#diag-result-text').textContent = r.text;
    $('#diag-answers').innerHTML = D.SENALES.map(s => `<li><span>${esc(s.q)}</span><b>${esc(ANSWER_TXT[diag.answers[s.id]] || '—')}</b></li>`).join('');
    // HU-07 · Recomendaciones según las respuestas
    const recs = [];
    D.SENALES.forEach(s => {
      if (diag.answers[s.id] === 'si') recs.push({ t: s.rec, p: true });
      if (diag.answers[s.id] === 'nose') recs.push({ t: `Pide ayuda a un familiar o a un brigadista para revisar: “${s.q.replace(/[¿?]/g, '')}”.`, p: false });
    });
    if (state.home) M.soilAt(state.home.x).tips.forEach(t => recs.push({ t, p: false }));
    D.RECOMENDACIONES_BASE.forEach(t => recs.push({ t, p: false }));
    $('#diag-recs').innerHTML = recs.map(r2 => `<li class="${r2.p ? 'is-priority' : ''}">${icon(r2.p ? 'alert' : 'check')}<span>${r2.p ? '<strong>Prioridad:</strong> ' : ''}${esc(r2.t)}</span></li>`).join('');
    $('#diag-result-title').focus();
    renderDiagLast();
  }
  $('#diag-repeat').addEventListener('click', () => { diag.step = 0; diag.answers = {}; showView('step'); renderStep(); $('#diag-question').setAttribute('tabindex', '-1'); $('#diag-question').focus(); });

  /* ---------- HU-08/09/10 · Puntos de reunión y rutas de evacuación ---------- */
  let resView = 'rutas';
  let resSelectedKey = null;
  let resSelectedPunto = null;
  const mapRes = $('#map-res');

  function residentRoutes() {
    const routes = M.routesFor(homeOrExample(), allPuntos(), { bloqueos: state.bloqueos });
    return routes.slice(0, 3).map((r, i) => Object.assign(r, { n: i + 1, name: `Ruta ${i + 1} · ${r.street}` }));
  }

  function directions(route) {
    const steps = [];
    const pts = route.points;
    for (let i = 0; i < pts.length - 2; i++) {
      const a = pts[i]; const b = pts[i + 1];
      const name = a[1] === b[1] ? streetNameAt(-1, a[1]) : streetNameAt(a[0], -1);
      const m = Math.hypot(b[0] - a[0], b[1] - a[1]) * D.MAP.metersPerUnit;
      const last = steps[steps.length - 1];
      if (last && last.name === name) last.m += m; else steps.push({ name, m });
    }
    return steps.filter(s => s.m > 5).map(s => `Camina ${Math.max(10, Math.round(s.m / 10) * 10)} m por ${s.name}.`).concat(`Llega a ${route.punto.name}.`);
  }

  function renderResRoutes() {
    $('#res-need-home').hidden = !!state.home;
    const routes = residentRoutes();
    if (!routes.find(r => r.key === resSelectedKey)) resSelectedKey = (routes.find(r => r.key === state.plan.routeKey) || {}).key || null;
    $('#res-route-list').innerHTML = routes.map(r => `
      <li><button type="button" class="item" data-route="${esc(r.key)}" aria-pressed="${r.key === resSelectedKey}">
        <span class="item__num" aria-hidden="true">${r.n}</span>
        <span class="item__body"><strong>${esc(r.name)}</strong>
          <span>Hacia: ${esc(r.punto.name)}</span>
          <small>${r.meters} m · ${r.minutes} min a pie</small>
          <span class="item__tags">${r.stairs ? '<span class="chip chip--warn">Con escaleras</span>' : '<span class="chip">Sin escaleras</span>'}${r.key === state.plan.routeKey ? '<span class="chip chip--ok">Mi ruta</span>' : ''}</span>
        </span>${icon('chevron-right')}</button></li>`).join('');

    const sel = routes.find(r => r.key === resSelectedKey);
    const det = $('#res-route-detail');
    det.hidden = !sel;
    if (sel) {
      $('#res-route-title').textContent = sel.name;
      $('#res-route-facts').innerHTML = `<div><dt>Distancia</dt><dd>${sel.meters} m</dd></div><div><dt>A pie</dt><dd>${sel.minutes} min</dd></div><div><dt>Destino</dt><dd>${esc(sel.punto.name)}</dd></div>`;
      $('#res-route-steps').innerHTML = directions(sel).map(s => `<li>${esc(s)}</li>`).join('');
      const chosen = sel.key === state.plan.routeKey;
      const btn = $('#res-route-choose');
      btn.textContent = chosen ? 'Esta es tu ruta' : 'Elegir como mi ruta';
      btn.disabled = chosen;
    }
    // Puntos de reunión ordenados por distancia (HU-08)
    const all = M.routesFor(homeOrExample(), allPuntos(), { bloqueos: state.bloqueos });
    $('#res-point-list').innerHTML = all.map(r => {
      const p = r.punto; const mine = state.plan.puntoId === p.id;
      return `<li class="item" ${resSelectedPunto === p.id ? 'aria-current="true"' : ''}>
        <span class="item__num" aria-hidden="true">${icon('flag')}</span>
        <span class="item__body"><strong>${esc(p.name)}</strong>
          <span>${esc(p.type)} · a ${r.meters} m (${r.minutes} min) · capacidad ${p.capacity} personas</span>
          <span class="item__tags">${p.accessible ? '<span class="chip">Accesible</span>' : '<span class="chip chip--warn">Con escalinata</span>'}${mine ? '<span class="chip chip--ok">Mi punto</span>' : ''}</span>
          <span class="btn-row" style="margin-top:.5rem">
            <button type="button" class="btn btn--secondary btn--sm" data-showpoint="${p.id}">Ver en el mapa<span class="sr-only"> ${esc(p.name)}</span></button>
            ${mine ? '' : `<button type="button" class="btn btn--primary btn--sm" data-choosepoint="${p.id}">Elegir como mi punto<span class="sr-only"> ${esc(p.name)}</span></button>`}
          </span>
        </span></li>`;
    }).join('');
    renderResMap(routes, all);
  }

  function renderResMap(routes, all) {
    let drawRoutes;
    if (resView === 'puntos' && resSelectedPunto) {
      const r = all.find(x => x.puntoId === resSelectedPunto);
      drawRoutes = r ? [{ points: r.points }] : [];
    } else {
      drawRoutes = routes.map(r => ({ points: r.points, num: r.n, key: r.key, selectable: true, label: `${r.name}, ${r.meters} metros`, cls: resSelectedKey && r.key !== resSelectedKey ? 'is-faded' : '' }));
      drawRoutes.sort((a, b) => (a.key === resSelectedKey) - (b.key === resSelectedKey));
    }
    M.draw(mapRes, {
      title: 'Mapa preventivo con rutas de evacuación y puntos de reunión',
      home: homeOrExample(),
      puntos: allPuntos(),
      selectedPunto: resView === 'puntos' ? resSelectedPunto : (routes.find(r => r.key === resSelectedKey) || {}).puntoId,
      routes: drawRoutes,
      peligros: state.peligros,
      bloqueos: bloqueosWithLabels(),
      onSelect: (type, id) => {
        if (type === 'route') { resSelectedKey = id; setResView('rutas'); renderResRoutes(); $('#res-route-title').focus(); }
        if (type === 'punto') { resSelectedPunto = id; setResView('puntos'); renderResRoutes(); }
        if (type === 'peligro') { const p = state.peligros.find(x => x.id === id); openModal({ title: `Zona de peligro: ${p.type}`, body: `<p>${esc(p.desc || 'Sin descripción')}</p><p class="muted small">Reportado por la brigada el ${esc(fmtDay(p.date))}. Evita pasar cerca.</p>`, actions: [{ label: 'Entendido', variant: 'btn--primary' }] }); }
        if (type === 'bloqueo') { const b = bloqueosWithLabels().find(x => x.id === id); openModal({ title: 'Vía bloqueada', body: `<p><strong>${esc(b.label)}</strong></p><p>Motivo: ${esc(b.reason)}. Las rutas sugeridas evitan este tramo.</p>`, actions: [{ label: 'Entendido', variant: 'btn--primary' }] }); }
      }
    });
  }

  function setResView(v) {
    resView = v;
    $$('[data-resview]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.resview === v)));
    $('#res-rutas-view').hidden = v !== 'rutas';
    $('#res-puntos-view').hidden = v !== 'puntos';
  }
  $$('[data-resview]').forEach(b => b.addEventListener('click', () => { setResView(b.dataset.resview); renderResRoutes(); }));
  $('#res-route-list').addEventListener('click', e => {
    const b = e.target.closest('[data-route]'); if (!b) return;
    resSelectedKey = b.dataset.route; renderResRoutes(); $('#res-route-title').focus();
  });
  $('#res-route-choose').addEventListener('click', () => {
    const r = residentRoutes().find(x => x.key === resSelectedKey); if (!r) return;
    state.plan = { puntoId: r.puntoId, routeKey: r.key }; save();
    renderAllResident();
    toast('Ruta guardada en tu plan familiar');
    $('#res-route-title').focus();
  });
  $('#res-point-list').addEventListener('click', e => {
    const show = e.target.closest('[data-showpoint]');
    const choose = e.target.closest('[data-choosepoint]');
    if (show) { resSelectedPunto = show.dataset.showpoint; renderResRoutes(); mapRes.scrollIntoView({ block: 'nearest' }); }
    if (choose) {
      const p = puntoById(choose.dataset.choosepoint);
      const r = M.routeTo(homeOrExample(), p, { bloqueos: state.bloqueos });
      state.plan = { puntoId: p.id, routeKey: r ? r.key : null }; save();
      resSelectedPunto = p.id;
      renderAllResident();
      toast(`${p.name} es ahora tu punto de reunión`);
      const again = $(`[data-showpoint="${p.id}"]`); if (again) again.focus();
    }
  });

  /* ---------- HU-13 · HU-27 · HU-41 · Guardar para usar sin conexión ---------- */
  const OFFLINE_ASSETS = ['./', 'index.html', '../css/styles.css', '../js/data.js', '../js/map.js', '../js/main.js', '../assets/icons/sprite.svg', '../assets/images/logo.svg', '../assets/images/hero-barrio.svg',
    ...D.SENALES.map(s => `../assets/images/${s.img}`), '../assets/fonts/poppins-latin-400-normal.woff2', '../assets/fonts/poppins-latin-500-normal.woff2', '../assets/fonts/poppins-latin-600-normal.woff2', '../assets/fonts/poppins-latin-700-normal.woff2', '../favicon.ico'];

  async function cacheForOffline() {
    if (!('caches' in window)) return false;
    try { const c = await caches.open('zls-offline-v1'); await c.addAll(OFFLINE_ASSETS); return true; }
    catch (e) { return false; }
  }
  function animateProgress(bar) {
    return new Promise(resolve => {
      bar.hidden = false;
      let v = 0;
      const span = bar.querySelector('span');
      const t = setInterval(() => {
        v = Math.min(100, v + 12 + Math.random() * 14);
        span.style.width = v + '%'; bar.setAttribute('aria-valuenow', Math.round(v));
        if (v >= 100) { clearInterval(t); setTimeout(() => { bar.hidden = true; resolve(); }, 250); }
      }, 140);
    });
  }
  async function saveOffline(kind, btn) {
    const bar = { res: $('#res-off-progress'), brig: $('#brig-off-progress'), sen: $('#sen-off-progress') }[kind];
    btn.disabled = true;
    const label = btn.innerHTML;
    btn.innerHTML = `${icon('download')}Guardando…`;
    const [ok] = await Promise.all([cacheForOffline(), animateProgress(bar)]);
    const snap = { date: new Date().toISOString(), cached: ok };
    if (kind === 'sen') { const r = currentSenRoute(); if (r) Object.assign(snap, { routeKey: r.key, name: r.name, meters: r.meters, punto: r.punto.name }); }
    state.offline[kind] = snap; save();
    btn.disabled = false; btn.innerHTML = label;
    renderOfflineTexts();
    toast(kind === 'sen' ? 'Ruta guardada para usar sin conexión' : 'Mapa guardado para usar sin conexión');
  }
  function renderOfflineTexts() {
    const txt = (s, base) => s ? `Guardado el ${fmtDate(s.date)}. Disponible sin conexión en este dispositivo.` : base;
    $('#res-off-text').textContent = txt(state.offline.res, 'Guarda tu mapa con rutas y puntos de reunión para verlo aunque no haya internet.');
    $('#brig-off-text').textContent = txt(state.offline.brig, 'Guarda las rutas y puntos para consultarlos sin conexión durante tus recorridos.');
    $$('[data-offline]').forEach(b => { if (state.offline[b.dataset.offline]) b.lastChild.textContent = 'Actualizar mapa guardado'; });
  }
  $$('[data-offline]').forEach(b => b.addEventListener('click', () => saveOffline(b.dataset.offline, b)));

  const banner = $('#offline-banner');
  const updateOnline = () => { banner.hidden = navigator.onLine; };
  window.addEventListener('online', () => { updateOnline(); toast('Conexión restablecida'); });
  window.addEventListener('offline', updateOnline);
  updateOnline();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  /* ---------- HU-15 · Plan familiar ---------- */
  function renderPlan() {
    const home = state.home;
    const p = state.plan.puntoId ? puntoById(state.plan.puntoId) : null;
    const route = p ? M.routeTo(homeOrExample(), p, { bloqueos: state.bloqueos }) : null;
    const main = state.contacts.find(c => c.main) || state.contacts[0];
    const rows = [
      ['home', 'Mi vivienda', home ? home.label : 'Aún no la ubicas', !home],
      ['alert', 'Nivel de riesgo de la zona', home ? D.RISK_LEVELS[M.soilAt(home.x).level].label : 'Pendiente', !home],
      ['flag', 'Punto de reunión', p ? `${p.name} (${p.accessible ? 'accesible' : 'con escalinata'})` : 'Aún no lo eliges', !p],
      ['route', 'Ruta de evacuación', route ? `Por ${route.street} · ${route.meters} m · ${route.minutes} min a pie` : 'Aún no la eliges', !route],
      ['check-square', 'Autodiagnóstico de la vivienda', state.diag ? `${state.diag.label} (${fmtDate(state.diag.date)})` : 'Pendiente', !state.diag],
      ['users', 'Contacto de emergencia', main ? `${main.name} · ${main.rel} · ${main.phone}` : 'Sin registrar', !main],
      ['download', 'Mapa sin conexión', state.offline.res ? `Guardado el ${fmtDate(state.offline.res.date)}` : 'No guardado', !state.offline.res]
    ];
    $('#plan-list').innerHTML = rows.map(([ic, k, v, miss]) => `<div class="${miss ? 'is-missing' : ''}"><dt>${icon(ic)}${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
    M.draw($('#map-plan'), {
      title: 'Mapa de mi plan familiar',
      home: homeOrExample(),
      puntos: p ? [p] : [],
      selectedPunto: p && p.id,
      routes: route ? [{ points: route.points }] : [],
      peligros: state.peligros
    });
  }
  $('#plan-print').addEventListener('click', () => { goToTab('tab-res-plan'); setTimeout(() => window.print(), 150); });

  function renderAllResident() { renderZona(); renderRisk(); renderSoil(); renderResRoutes(); renderPlan(); }

  /* =========================================================
     SEGMENTO 2 · BRIGADISTAS
     ========================================================= */
  const layers = { rutas: true, puntos: true, peligros: true, vias: true };
  let brigSel = null;
  const STATUS = {
    validada: { txt: 'Validada', cls: 'chip--ok' },
    pendiente: { txt: 'Pendiente de validación', cls: 'chip--pend' },
    revision: { txt: 'Requiere revisión', cls: 'chip--warn' }
  };
  const statusChip = s => `<span class="chip ${STATUS[s].cls}">${STATUS[s].txt}</span>`;

  /* ---------- HU-26 · Mapa centralizado ---------- */
  $$('[data-layer]').forEach(b => b.addEventListener('click', () => {
    layers[b.dataset.layer] = !layers[b.dataset.layer];
    b.setAttribute('aria-pressed', String(layers[b.dataset.layer]));
    renderBrig();
  }));

  function renderBrig() {
    M.draw($('#map-brig'), {
      title: 'Mapa centralizado de la zona',
      layers,
      rutasCom: state.rutasCom,
      puntos: allPuntos(),
      peligros: state.peligros,
      bloqueos: bloqueosWithLabels(),
      selected: brigSel && brigSel.id,
      onSelect: (type, id) => selectBrig(type === 'route' ? 'ruta' : type, id, true)
    });
    const items = [];
    if (layers.rutas) state.rutasCom.forEach(r => items.push({ type: 'ruta', id: r.id, ic: 'route', name: r.name, sub: STATUS[r.status].txt }));
    if (layers.puntos) allPuntos().forEach(p => items.push({ type: 'punto', id: p.id, ic: 'flag', name: p.name, sub: `Punto de reunión · ${p.capacity} personas` }));
    if (layers.peligros) state.peligros.forEach(p => items.push({ type: 'peligro', id: p.id, ic: 'alert', name: p.type, sub: 'Zona de peligro' }));
    if (layers.vias) bloqueosWithLabels().forEach(b => items.push({ type: 'bloqueo', id: b.id, ic: 'block', name: b.label, sub: `Vía bloqueada · ${b.reason}` }));
    $('#brig-list').innerHTML = items.length ? items.map(i => `<li><button type="button" class="item" data-brig="${i.type}:${i.id}" aria-pressed="${!!(brigSel && brigSel.id === i.id)}">${icon(i.ic)}<span class="item__body"><strong>${esc(i.name)}</strong><span>${esc(i.sub)}</span></span>${icon('chevron-right')}</button></li>`).join('') : '<li class="muted">No hay capas activas.</li>';
    renderBrigDetail();
  }
  $('#brig-list').addEventListener('click', e => {
    const b = e.target.closest('[data-brig]'); if (!b) return;
    const [type, id] = b.dataset.brig.split(':');
    selectBrig(type, id, true);
  });
  function selectBrig(type, id, focus) {
    brigSel = { type, id };
    renderBrig();
    if (focus) $('#brig-detail-title').focus();
  }

  function renderBrigDetail() {
    const title = $('#brig-detail-title'); const body = $('#brig-detail-body');
    if (!brigSel) return;
    const { type, id } = brigSel;
    if (type === 'ruta') {
      const r = state.rutasCom.find(x => x.id === id); if (!r) { brigSel = null; return; }
      const dest = puntoById(r.dest);
      title.textContent = r.name;
      body.innerHTML = `${statusChip(r.status)}
        <dl class="kv" style="margin-top:.75rem"><div><dt>Destino</dt><dd>${esc(dest ? dest.name : '—')}</dd></div><div><dt>Validaciones</dt><dd>${r.validations}</dd></div><div><dt>Actualizada</dt><dd>${esc(fmtDay(r.updated))}</dd></div></dl>
        <p style="margin-top:.75rem">${esc(r.desc || 'Sin descripción.')}</p>
        <div class="btn-row" style="margin-top:1rem"><button type="button" class="btn btn--secondary btn--sm" data-edit-route="${r.id}">${icon('edit')}Editar ruta</button>
        ${r.status !== 'validada' ? `<button type="button" class="btn btn--primary btn--sm" data-validate="${r.id}">Revisar y validar</button>` : ''}</div>`;
    } else if (type === 'punto') {
      const p = puntoById(id); if (!p) { brigSel = null; return; }
      title.textContent = p.name;
      body.innerHTML = `<dl class="kv"><div><dt>Tipo</dt><dd>${esc(p.type)}</dd></div><div><dt>Capacidad</dt><dd>${p.capacity} personas</dd></div><div><dt>Accesible</dt><dd>${p.accessible ? 'Sí' : 'No'}</dd></div></dl><p style="margin-top:.75rem">${esc(p.access || '')}</p>`;
    } else if (type === 'peligro') {
      const p = state.peligros.find(x => x.id === id); if (!p) { brigSel = null; return; }
      title.textContent = `Peligro: ${p.type}`;
      body.innerHTML = `<p>${esc(p.desc || 'Sin descripción.')}</p><p class="muted small">Registrado el ${esc(fmtDay(p.date))} · cerca de ${esc(nearestStreetName(p.x, p.y))}</p>`;
    } else if (type === 'bloqueo') {
      const b = bloqueosWithLabels().find(x => x.id === id); if (!b) { brigSel = null; return; }
      title.textContent = 'Vía bloqueada';
      body.innerHTML = `<p><strong>${esc(b.label)}</strong></p><p>Motivo: ${esc(b.reason)}</p><p class="muted small">Registrada el ${esc(fmtDay(b.date))}. Las rutas de los vecinos evitan este tramo automáticamente.</p>
        <button type="button" class="btn btn--secondary btn--sm" style="margin-top:.75rem" data-unblock="${b.id}">Marcar como habilitada</button>`;
    }
  }
  document.addEventListener('click', e => {
    const ed = e.target.closest('[data-edit-route]');
    const va = e.target.closest('[data-validate]');
    const ub = e.target.closest('[data-unblock]');
    if (ed) editRoute(ed.dataset.editRoute);
    if (va) { gestSel = va.dataset.validate; gestFilter = 'todas'; syncGestFilter(); renderGest(); goToTab('tab-brig-gest', '#gest-title'); }
    if (ub) {
      state.bloqueos = state.bloqueos.filter(b => b.id !== ub.dataset.unblock); save();
      brigSel = null; $('#brig-detail-title').textContent = 'Selecciona un elemento'; $('#brig-detail-body').innerHTML = '<p class="muted">La vía fue marcada como habilitada.</p>';
      renderEverything(); toast('Vía marcada como habilitada');
    }
  });

  /* ---------- HU-20 · Actualizar rutas registradas ---------- */
  function editRoute(id) {
    const r = state.rutasCom.find(x => x.id === id);
    const f = document.createElement('div');
    f.className = 'stack';
    f.innerHTML = `
      <div><label class="label" for="ed-name">Nombre de la ruta</label><input class="input" id="ed-name" value="${esc(r.name)}" maxlength="60" aria-describedby="ed-name-err"><p class="error" id="ed-name-err"></p></div>
      <div><label class="label" for="ed-dest">Punto de reunión de destino</label><select class="input" id="ed-dest">${allPuntos().map(p => `<option value="${p.id}" ${p.id === r.dest ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
      <div><label class="label" for="ed-desc">Descripción</label><textarea class="input" id="ed-desc" rows="3" maxlength="160">${esc(r.desc || '')}</textarea></div>
      <p class="notice notice--info">${icon('info')}<span>Al guardar los cambios, la ruta volverá a quedar pendiente de validación.</span></p>`;
    openModal({
      title: 'Editar ruta', body: f, actions: [
        { label: 'Cancelar' },
        {
          label: 'Guardar cambios', variant: 'btn--primary', onClick: () => {
            const name = $('#ed-name').value.trim();
            if (name.length < 3) { setError($('#ed-name'), $('#ed-name-err'), 'Escribe un nombre de al menos 3 caracteres.'); $('#ed-name').focus(); return false; }
            const changes = { name, dest: $('#ed-dest').value, desc: $('#ed-desc').value.trim() };
            setTimeout(() => openModal({
              title: '¿Confirmar cambios?',
              body: `<p>Se actualizará <strong>${esc(r.name)}</strong>${changes.name !== r.name ? ` como <strong>${esc(changes.name)}</strong>` : ''}. La ruta quedará pendiente de una nueva validación.</p>`,
              actions: [{ label: 'Volver' }, {
                label: 'Confirmar', variant: 'btn--primary', onClick: () => {
                  Object.assign(r, changes, { status: 'pendiente', validations: 0, updated: today() }); save();
                  brigSel = { type: 'ruta', id: r.id }; renderBrig(); renderGest(); toast('Ruta actualizada');
                }
              }]
            }), 0);
          }
        }
      ]
    });
  }

  /* ---------- HU-17 / HU-18 / HU-19 / HU-22 · Registrar en el mapa ---------- */
  const mapReg = $('#map-reg');
  let regType = 'ruta';
  let regDraft = [];
  let regPos = null;
  let regCursor = { x: 400, y: 250 };
  const REG = {
    ruta: { title: 'Registrar ruta de evacuación', name: 'Nombre de la ruta', hint: 'Haz clic en el mapa para marcar cada tramo del recorrido, desde el inicio hasta el punto de reunión. Con teclado: enfoca el mapa, muévete con las flechas y pulsa Enter para añadir un punto.' },
    punto: { title: 'Registrar punto de reunión', name: 'Nombre del punto de reunión', hint: 'Haz clic en el mapa donde está el punto de reunión. Con teclado: enfoca el mapa, usa las flechas y pulsa Enter.' },
    peligro: { title: 'Registrar zona de peligro', name: 'Referencia del lugar (opcional)', hint: 'Haz clic en el mapa donde identificaste el peligro. Con teclado: enfoca el mapa, usa las flechas y pulsa Enter.' },
    via: { title: 'Marcar vía bloqueada', name: '', hint: 'Elige el tramo en la lista o haz clic sobre la calle bloqueada en el mapa.' }
  };
  $('#reg-dest').innerHTML = '';
  function fillRegSelects() {
    $('#reg-dest').innerHTML = '<option value="">Selecciona un punto</option>' + allPuntos().map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
    $('#reg-edge').innerHTML = '<option value="">Selecciona un tramo</option>' + M.allEdges().map(e => `<option value="${e.key}">${esc(M.edgeLabel(e))}</option>`).join('');
  }
  function setRegType(t) {
    regType = t; regDraft = []; regPos = null;
    $('#reg-form-title').textContent = REG[t].title;
    $('#reg-name-label').textContent = REG[t].name;
    $('#reg-hint-text').textContent = REG[t].hint;
    $$('.reg-fields').forEach(f => { f.hidden = !f.dataset.for.split(' ').includes(t); });
    $('#reg-submit').textContent = t === 'via' ? 'Marcar vía como bloqueada' : 'Guardar registro';
    ['#reg-name-error', '#reg-capacity-error', '#reg-hazard-error', '#reg-pos-error'].forEach(s => { $(s).textContent = ''; });
    $$('#reg-form [aria-invalid]').forEach(i => i.setAttribute('aria-invalid', 'false'));
    renderReg();
  }
  $$('input[name="reg-type"]').forEach(r => r.addEventListener('change', () => setRegType(r.value)));

  function regPosText() {
    if (regType === 'ruta') return regDraft.length ? `Recorrido: ${regDraft.length} punto(s) marcado(s). Último cerca de ${nearestStreetName(...regDraft[regDraft.length - 1])}.` : 'Recorrido: aún no marcas puntos en el mapa.';
    if (regType === 'via') { const k = $('#reg-edge').value; const e = M.allEdges().find(x => x.key === k); return e ? `Tramo seleccionado: ${M.edgeLabel(e)}.` : 'Tramo: aún no seleccionado.'; }
    return regPos ? `Ubicación marcada cerca de ${nearestStreetName(regPos.x, regPos.y)}.` : 'Ubicación: aún no marcada en el mapa.';
  }
  function renderReg() {
    const edgeK = $('#reg-edge').value;
    const draftEdge = regType === 'via' && edgeK ? [{ id: 'draft', a: edgeK.split('|')[0], b: edgeK.split('|')[1], reason: 'Nuevo bloqueo' }] : [];
    M.draw(mapReg, {
      title: 'Mapa para registrar',
      rutasCom: state.rutasCom,
      puntos: allPuntos(),
      peligros: state.peligros.concat(regPos && regType === 'peligro' ? [{ id: 'draft', type: 'Nuevo peligro', x: regPos.x, y: regPos.y }] : []),
      bloqueos: bloqueosWithLabels().concat(draftEdge),
      selected: 'draft',
      draft: regType === 'ruta' ? regDraft : (regType === 'punto' && regPos ? [[regPos.x, regPos.y]] : null),
      pick: regCursor
    });
    mapReg.setAttribute('aria-label', `Mapa para registrar. ${REG[regType].hint}`);
    $('#reg-pos').textContent = regPosText();
  }
  function regAt(p) {
    $('#reg-pos-error').textContent = '';
    if (regType === 'ruta') regDraft.push([p.x, p.y]);
    else if (regType === 'via') { const e = M.nearestEdge(p.x, p.y); $('#reg-edge').value = e.key; }
    else regPos = p;
    regCursor = p;
    renderReg();
  }
  mapReg.addEventListener('click', e => regAt(M.svgPoint(mapReg, e)));
  mapReg.addEventListener('mousemove', e => { regCursor = M.svgPoint(mapReg, e); renderReg(); });
  mapReg.addEventListener('keydown', e => {
    const step = e.shiftKey ? 40 : 15;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) { e.preventDefault(); regCursor = { x: Math.max(10, Math.min(790, regCursor.x + moves[e.key][0])), y: Math.max(10, Math.min(490, regCursor.y + moves[e.key][1])) }; renderReg(); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); regAt(regCursor); }
  });
  $('#reg-edge').addEventListener('change', renderReg);
  $('#reg-undo').addEventListener('click', () => { regDraft.pop(); renderReg(); });
  $('#reg-clear').addEventListener('click', () => { regDraft = []; renderReg(); });

  $('#reg-form').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#reg-name').value.trim();
    const desc = $('#reg-desc').value.trim();
    let firstBad = null;
    const bad = el => { if (!firstBad) firstBad = el; };
    $('#reg-pos-error').textContent = '';
    if (regType === 'ruta' || regType === 'punto') {
      if (!setError($('#reg-name'), $('#reg-name-error'), name.length < 3 ? 'Escribe un nombre de al menos 3 caracteres.' : '')) bad($('#reg-name'));
    }
    if (regType === 'ruta') {
      if (!$('#reg-dest').value) { $('#reg-pos-error').textContent = 'Elige el punto de reunión de destino.'; bad($('#reg-dest')); }
      else if (regDraft.length < 2) { $('#reg-pos-error').textContent = 'Marca al menos 2 puntos del recorrido en el mapa.'; bad(mapReg); }
    }
    if (regType === 'punto') {
      const cap = Number($('#reg-capacity').value);
      if (!setError($('#reg-capacity'), $('#reg-capacity-error'), !cap || cap < 10 || cap > 5000 ? 'Indica una capacidad entre 10 y 5000 personas.' : '')) bad($('#reg-capacity'));
      if (!regPos) { $('#reg-pos-error').textContent = 'Marca en el mapa la ubicación del punto de reunión.'; bad(mapReg); }
    }
    if (regType === 'peligro') {
      if (!setError($('#reg-hazard-type'), $('#reg-hazard-error'), $('#reg-hazard-type').value ? '' : 'Elige el tipo de peligro.')) bad($('#reg-hazard-type'));
      if (!regPos) { $('#reg-pos-error').textContent = 'Marca en el mapa dónde está el peligro.'; bad(mapReg); }
    }
    if (regType === 'via') {
      const k = $('#reg-edge').value;
      if (!k) { $('#reg-pos-error').textContent = 'Elige el tramo de calle bloqueado.'; bad($('#reg-edge')); }
      else if (state.bloqueos.some(b => M.edgeKey(b.a, b.b) === k)) { $('#reg-pos-error').textContent = 'Ese tramo ya está marcado como bloqueado.'; bad($('#reg-edge')); }
    }
    if (firstBad) { firstBad.focus(); return; }

    let created; let msg;
    if (regType === 'ruta') {
      const dest = puntoById($('#reg-dest').value);
      const pts = regDraft.slice(); const last = pts[pts.length - 1];
      if (Math.hypot(last[0] - dest.x, last[1] - dest.y) > 6) pts.push([dest.x, dest.y]);
      created = { id: uid('r'), name, dest: dest.id, status: 'pendiente', desc, points: pts, validations: 0, updated: today() };
      state.rutasCom.push(created); msg = 'Ruta registrada. Queda pendiente de validación.';
    } else if (regType === 'punto') {
      const xs = D.STREETS.filter(s => s.dir === 'v').map(s => s.at); const ys = D.STREETS.filter(s => s.dir === 'h').map(s => s.at);
      let node = null; let best = Infinity;
      xs.forEach(x => ys.forEach(y => { const d = Math.hypot(x - regPos.x, y - regPos.y); if (d < best) { best = d; node = `${x},${y}`; } }));
      created = { id: uid('p'), name, x: regPos.x, y: regPos.y, node, capacity: Number($('#reg-capacity').value), accessible: $('#reg-accessible').checked, access: desc || 'Registrado por la brigada', type: 'Registrado por la brigada' };
      state.puntosExtra.push(created); msg = 'Punto de reunión registrado.';
    } else if (regType === 'peligro') {
      created = { id: uid('z'), type: $('#reg-hazard-type').value, x: regPos.x, y: regPos.y, desc: [name, desc].filter(Boolean).join('. '), date: today() };
      state.peligros.push(created); msg = 'Zona de peligro registrada.';
    } else {
      const [a, b] = $('#reg-edge').value.split('|');
      created = { id: uid('b'), a, b, reason: $('#reg-reason').value, date: today() };
      state.bloqueos.push(created); msg = 'Vía marcada como bloqueada. Las rutas de los vecinos ya la evitan.';
    }
    save();
    const type = regType === 'via' ? 'bloqueo' : regType;
    $('#reg-form').reset(); fillRegSelects(); setRegType(regType);
    renderEverything();
    openModal({
      title: 'Registro guardado',
      body: `<p class="notice notice--ok">${icon('check')} ${esc(msg)}</p>`,
      actions: [
        { label: 'Registrar otro' },
        { label: 'Ver en el mapa', variant: 'btn--primary', onClick: () => { setTimeout(() => { goToTab('tab-brig-mapa'); selectBrig(type, created.id, true); }, 0); } }
      ]
    });
  });

  /* ---------- HU-24 · Validación de rutas ---------- */
  let gestFilter = 'pendientes';
  let gestSel = null;
  function syncGestFilter() { $$('[data-gest]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.gest === gestFilter))); }
  $$('[data-gest]').forEach(b => b.addEventListener('click', () => { gestFilter = b.dataset.gest; syncGestFilter(); renderGest(); }));
  function renderGest() {
    const list = state.rutasCom.filter(r => gestFilter === 'todas' || (gestFilter === 'validadas' ? r.status === 'validada' : r.status !== 'validada'));
    $('#gest-list').innerHTML = list.length ? list.map(r => {
      const dest = puntoById(r.dest);
      return `<li><button type="button" class="item" data-gest-route="${r.id}" aria-pressed="${gestSel === r.id}">${icon('route')}
        <span class="item__body"><strong>${esc(r.name)}</strong><span>Hacia ${esc(dest ? dest.name : '—')} · ${r.validations} validación(es)</span><span class="item__tags">${statusChip(r.status)}</span></span>${icon('chevron-right')}</button></li>`;
    }).join('') : `<li class="empty"><p><strong>No hay rutas en este filtro.</strong></p></li>`;
    const r = state.rutasCom.find(x => x.id === gestSel);
    const body = $('#gest-body');
    if (!r) { $('#gest-title').textContent = 'Selecciona una ruta'; body.innerHTML = '<p class="muted">Elige una ruta de la lista para revisarla y validarla.</p>'; return; }
    $('#gest-title').textContent = r.name;
    const dest = puntoById(r.dest);
    body.innerHTML = `${statusChip(r.status)}
      <dl class="kv" style="margin:.75rem 0"><div><dt>Destino</dt><dd>${esc(dest ? dest.name : '—')}</dd></div><div><dt>Validaciones</dt><dd>${r.validations}</dd></div><div><dt>Última actualización</dt><dd>${esc(fmtDay(r.updated))}</dd></div></dl>
      <p>${esc(r.desc || '')}</p>
      ${r.status === 'validada' ? `<p class="notice notice--ok" style="margin-top:.75rem">${icon('check')} Esta ruta ya está validada y visible para los vecinos.</p>` : `
      <form id="val-form" class="stack" style="margin-top:1rem" novalidate>
        <fieldset class="check-group"><legend class="label">Verificación en campo</legend>
          <label class="check"><input type="checkbox" name="val">Recorrí la ruta y está libre de bloqueos</label>
          <label class="check"><input type="checkbox" name="val">El punto de destino es seguro y está habilitado</label>
          <label class="check"><input type="checkbox" name="val">Las referencias y señales del recorrido son claras</label>
        </fieldset>
        <div><label class="label" for="val-obs">Observación (obligatoria si requiere revisión)</label><textarea class="input" id="val-obs" rows="2" maxlength="160"></textarea></div>
        <p class="error" id="val-error" role="alert"></p>
        <div class="btn-row"><button type="submit" class="btn btn--primary">Validar ruta</button><button type="button" class="btn btn--secondary" id="val-review">Requiere revisión</button></div>
      </form>`}
      <button type="button" class="link-btn" style="margin-top:1rem" data-edit-route="${r.id}">Editar ruta</button>`;
    const form = $('#val-form');
    if (form) {
      form.addEventListener('submit', ev => {
        ev.preventDefault();
        const checks = $$('input[name="val"]', form);
        if (checks.some(c => !c.checked)) { $('#val-error').textContent = 'Para validar, confirma los 3 puntos de verificación.'; checks.find(c => !c.checked).focus(); return; }
        Object.assign(r, { status: 'validada', validations: r.validations + 1, updated: today() });
        const obs = $('#val-obs').value.trim(); if (obs) r.desc = obs;
        save(); renderEverything(); $('#gest-title').focus(); toast('Ruta validada. Ya es visible para los vecinos.');
      });
      $('#val-review').addEventListener('click', () => {
        const obs = $('#val-obs').value.trim();
        if (!obs) { $('#val-error').textContent = 'Escribe qué debe revisarse en la ruta.'; $('#val-obs').focus(); return; }
        Object.assign(r, { status: 'revision', desc: obs, updated: today() });
        save(); renderEverything(); $('#gest-title').focus(); toast('Ruta marcada para revisión');
      });
    }
  }
  $('#gest-list').addEventListener('click', e => {
    const b = e.target.closest('[data-gest-route]'); if (!b) return;
    gestSel = b.dataset.gestRoute; renderGest(); $('#gest-title').focus();
  });

  /* =========================================================
     SEGMENTO 3 · ADULTOS MAYORES Y MOVILIDAD REDUCIDA
     ========================================================= */
  let senSelected = null;
  let senAlt = null;
  const mapSen = $('#map-sen');

  /* ---------- HU-35 · HU-36 · Rutas accesibles y filtro sin escaleras ---------- */
  function seniorRoutes() {
    const home = homeOrExample();
    const opt = { bloqueos: state.bloqueos };
    const seen = new Set(); const out = [];
    allPuntos().forEach(p => {
      [M.routeTo(home, p, opt), M.routeTo(home, p, Object.assign({ avoidStairs: true }, opt))].forEach(r => {
        if (r && !seen.has(r.key)) { seen.add(r.key); out.push(r); }
      });
    });
    out.sort((a, b) => a.meters - b.meters);
    out.forEach((r, i) => { r.n = i + 1; r.name = `Ruta ${i + 1} · ${r.street}`; r.accessibleOk = !r.stairs && r.punto.accessible; });
    return out;
  }
  function currentSenRoute() { return seniorRoutes().find(r => r.key === senSelected) || null; }

  function routeFeaturesHTML(r) {
    const slopes = r.slopes.length ? r.slopes.map(s => `<li><span class="badge badge--slope" aria-hidden="true">▲</span><span>${esc(s.text)}</span></li>`).join('') : '<li>Sin desniveles registrados</li>';
    const obs = r.obstacles.length ? r.obstacles.map((o, i) => `<li><span class="badge" aria-hidden="true">${i + 1}</span><span>${esc(o.text)}</span></li>`).join('') : '<li>Sin obstáculos registrados</li>';
    const stairs = r.stairs ? `<p class="notice notice--info">${icon('alert')}<span>Esta ruta tiene escaleras: ${esc(r.stairsNotes.join('; '))}.</span></p>` : '';
    return `<dl class="facts"><div><dt>Distancia</dt><dd>${r.meters} m</dd></div><div><dt>Caminando despacio</dt><dd>${r.minutesSlow} min</dd></div><div><dt>Destino</dt><dd>${esc(r.punto.name)}</dd></div></dl>${stairs}
      <h4>Desniveles</h4><ul class="feature-list">${slopes}</ul><h4>Obstáculos</h4><ul class="feature-list">${obs}</ul>`;
  }

  function renderSenior() {
    const onlyNoStairs = $('#sen-nostairs').checked;
    const all = seniorRoutes();
    const list = all.filter(r => !onlyNoStairs || r.accessibleOk);
    if (!senSelected && state.senRouteKey) senSelected = state.senRouteKey;
    if (senSelected && !all.find(r => r.key === senSelected)) senSelected = null;
    $('#sen-empty').hidden = list.length > 0;
    const savedKey = state.offline.sen && state.offline.sen.routeKey;
    $('#sen-route-list').innerHTML = list.map(r => `
      <li><button type="button" class="item" data-sen="${esc(r.key)}" aria-pressed="${r.key === senSelected}">
        <span class="item__num" aria-hidden="true">${r.n}</span>
        <span class="item__body"><strong>${esc(r.name)}</strong><span>Hacia: ${esc(r.punto.name)} · ${r.meters} m</span>
          <span class="item__tags">${r.stairs ? '<span class="chip chip--warn">Con escaleras</span>' : '<span class="chip">Sin escaleras</span>'}${r.punto.accessible ? '<span class="chip">Punto accesible</span>' : '<span class="chip chip--warn">Punto con escalinata</span>'}${r.key === state.senRouteKey ? '<span class="chip chip--ok">Mi ruta</span>' : ''}${r.key === savedKey ? '<span class="chip chip--ok">Guardada sin conexión</span>' : ''}</span>
        </span>${icon('chevron-right')}</button></li>`).join('');

    const sel = all.find(r => r.key === senSelected);
    $('#sen-detail').hidden = !sel;
    if (sel) {
      $('#sen-detail-title').textContent = sel.name;
      const chips = [sel.stairs ? 'Con escaleras' : 'Sin escaleras', sel.slopes.length ? `${sel.slopes.length} desnivel(es)` : 'Sin desniveles', sel.obstacles.length ? `${sel.obstacles.length} obstáculo(s)` : 'Sin obstáculos'];
      $('#sen-detail-chips').innerHTML = chips.map(c => `<li>${esc(c)}</li>`).join('');
      $('#sen-detail-body').innerHTML = routeFeaturesHTML(sel);
    }
    $('#sen-alt-box').hidden = !senAlt;
    // Mapa (HU-37/38 se muestran como marcas)
    const draw = [];
    list.forEach(r => { if (r.key !== senSelected) draw.push({ points: r.points, cls: 'is-faded', key: r.key, selectable: true, label: `${r.name}, ${r.meters} metros` }); });
    if (senAlt) draw.push({ points: senAlt.points, cls: 'is-alt' });
    if (sel) draw.push({ points: sel.points, key: sel.key });
    const marks = sel ? sel.slopes.map(s => ({ kind: 'slope', at: s.at, text: s.text })).concat(sel.obstacles.map((o, i) => ({ kind: 'obstacle', at: o.at, text: o.text, n: i + 1 }))) : null;
    M.draw(mapSen, {
      title: 'Mapa de rutas accesibles',
      home: homeOrExample(), puntos: allPuntos(), selectedPunto: sel && sel.puntoId,
      routes: draw, marks, peligros: state.peligros, bloqueos: bloqueosWithLabels(),
      onSelect: (type, id) => { if (type === 'route') selectSen(id); }
    });
    // Inicio accesible: textos de acceso rápido (HU-48)
    const mine = all.find(r => r.key === state.senRouteKey);
    $('#quick-route-sub').textContent = mine ? `${mine.name} · ${mine.meters} m` : 'Ve tu camino seguro';
    const nearAcc = all.find(r => r.accessibleOk);
    $('#quick-point-sub').textContent = nearAcc ? nearAcc.punto.name : 'Dónde encontrarte';
    $('#quick-support-sub').textContent = `${state.contacts.length} apoyo(s) registrado(s)`;
  }
  function selectSen(key) {
    senSelected = key; senAlt = null;
    renderSenior();
    $('#sen-status').textContent = '';
    $('#sen-detail-title').focus();
  }
  $('#sen-route-list').addEventListener('click', e => { const b = e.target.closest('[data-sen]'); if (b) selectSen(b.dataset.sen); });
  $('#sen-nostairs').addEventListener('change', () => { senAlt = null; renderSenior(); });
  $('#sen-empty-reset').addEventListener('click', () => { $('#sen-nostairs').checked = false; renderSenior(); });

  /* ---------- HU-39 · Selección  ·  HU-41 · Guardar sin conexión ---------- */
  $('#sen-save').addEventListener('click', async e => {
    const r = currentSenRoute(); if (!r) return;
    state.senRouteKey = r.key; save();
    await saveOffline('sen', e.currentTarget);
    $('#sen-status').innerHTML = `${icon('check')} <strong>Ruta guardada.</strong> Podrás verla sin conexión desde “Mi ruta” en Inicio.`;
    renderSenior();
  });

  /* ---------- HU-40 · Ruta alternativa accesible ---------- */
  $('#sen-alt').addEventListener('click', () => {
    const r = currentSenRoute(); if (!r) return;
    // Alternativa: otra ruta sin escaleras hacia un punto accesible (prioriza el mismo destino)
    const cands = seniorRoutes().filter(x => x.accessibleOk && x.key !== r.key);
    senAlt = cands.find(x => x.puntoId === r.puntoId) || cands[0] || null;
    if (!senAlt) { $('#sen-status').textContent = 'No encontramos otra ruta accesible desde tu vivienda.'; renderSenior(); return; }
    const diff = senAlt.meters - r.meters;
    $('#sen-alt-body').innerHTML = `<p>${diff === 0 ? 'Tiene la misma distancia que tu ruta.' : `Es ${Math.abs(diff)} m ${diff > 0 ? 'más larga' : 'más corta'} que tu ruta.`} No tiene escaleras.</p>${routeFeaturesHTML(senAlt)}`;
    renderSenior();
    $('#sen-alt-title').focus();
  });
  $('#sen-alt-choose').addEventListener('click', () => {
    if (!senAlt) return;
    senSelected = senAlt.key;
    state.senRouteKey = senSelected; save();
    senAlt = null; renderSenior();
    $('#sen-status').innerHTML = `${icon('check')} Elegiste la ruta alternativa como tu ruta.`;
    $('#sen-detail-title').focus();
  });
  $('#sen-alt-close').addEventListener('click', () => { senAlt = null; renderSenior(); $('#sen-alt').focus(); });

  /* ---------- HU-34 · HU-48 · Navegación sencilla y acceso rápido ---------- */
  $$('[data-quick]').forEach(b => b.addEventListener('click', () => {
    const q = b.dataset.quick;
    if (q === 'rutas') goToTab('tab-sen-rutas');
    if (q === 'mi-ruta') {
      const key = state.senRouteKey || (seniorRoutes().find(r => r.accessibleOk) || {}).key;
      goToTab('tab-sen-rutas'); if (key) setTimeout(() => selectSen(key), 80);
    }
    if (q === 'punto') {
      const r = seniorRoutes().find(x => x.accessibleOk);
      if (!r) return;
      openModal({
        title: 'Tu punto de reunión accesible',
        body: `<p><strong>${esc(r.punto.name)}</strong></p><p>${esc(r.punto.access)}. Está a ${r.meters} m de tu vivienda (unos ${r.minutesSlow} minutos caminando despacio).</p>`,
        actions: [{ label: 'Cerrar' }, { label: 'Ver cómo llegar', variant: 'btn--primary', onClick: () => { setTimeout(() => { goToTab('tab-sen-rutas'); selectSen(r.key); }, 0); } }]
      });
    }
    if (q === 'apoyos') goToTab('tab-sen-apoyos', '#sup-title');
    if (q === 'compartir') goToTab('tab-sen-apoyos', '#share-title');
  }));
  $('#sup-title').setAttribute('tabindex', '-1');

  /* ---------- HU-42 · Registrar familiar de apoyo ---------- */
  $('#fam-rel').innerHTML = '<option value="">Selecciona el parentesco</option>' + D.PARENTESCOS.map(p => `<option>${esc(p)}</option>`).join('');
  $('#fam-phone').addEventListener('input', e => {
    const d = e.target.value.replace(/\D/g, '').slice(0, 9);
    e.target.value = d.replace(/(\d{3})(\d{0,3})(\d{0,3})/, (m, a, b2, c) => [a, b2, c].filter(Boolean).join(' '));
  });
  $('#fam-form').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#fam-name').value.trim();
    const rel = $('#fam-rel').value;
    const phone = $('#fam-phone').value.replace(/\D/g, '');
    const okName = setError($('#fam-name'), $('#fam-name-error'), !name ? 'Escribe el nombre de tu familiar.' : !/^[A-Za-zÁÉÍÓÚáéíóúÑñÜü' ]{3,}$/.test(name) ? 'Usa solo letras (mínimo 3).' : '');
    const okRel = setError($('#fam-rel'), $('#fam-rel-error'), rel ? '' : 'Elige el parentesco.');
    const okPhone = setError($('#fam-phone'), $('#fam-phone-error'), !phone ? 'Escribe el número de celular.' : !/^9\d{8}$/.test(phone) ? 'El celular debe tener 9 dígitos y empezar con 9.' : '');
    if (!okName) return $('#fam-name').focus();
    if (!okRel) return $('#fam-rel').focus();
    if (!okPhone) return $('#fam-phone').focus();
    if (state.contacts.some(c => c.phone === phone)) { setError($('#fam-phone'), $('#fam-phone-error'), 'Ese número ya está registrado.'); return $('#fam-phone').focus(); }
    const main = $('#fam-main').checked || state.contacts.length === 0;
    if (main) state.contacts.forEach(c => { c.main = false; });
    state.contacts.push({ id: uid('c'), name, rel, phone, main });
    save();
    e.target.reset();
    $('#fam-status').innerHTML = `${icon('check')} <strong>Familiar guardado:</strong> ${esc(name)} (${esc(rel)}).`;
    renderSupports(); renderPlan(); renderSenior();
    toast('Familiar guardado');
  });

  function renderSupports() {
    $('#sup-list').innerHTML = state.contacts.length ? state.contacts.map(c => `
      <li class="item">${icon('user')}<span class="item__body"><strong>${esc(c.name)}</strong><span>${esc(c.rel)} · ${esc(c.phone.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3'))}</span>${c.main ? '<span class="item__tags"><span class="chip chip--ok">Contacto principal</span></span>' : ''}</span>
        <button type="button" class="btn btn--secondary btn--sm" data-del-contact="${c.id}">Eliminar<span class="sr-only"> a ${esc(c.name)}</span></button></li>`).join('')
      : '<li class="muted">Aún no registras apoyos.</li>';
    $('#share-contacts').innerHTML = state.contacts.length ? state.contacts.map(c => `<label class="check check--lg"><input type="checkbox" name="share-to" value="${c.id}" ${c.main ? 'checked' : ''}><span>${esc(c.name)} (${esc(c.rel)})</span></label>`).join('')
      : '<p class="muted">Registra un familiar para poder compartir tu ubicación.</p>';
  }
  $('#sup-list').addEventListener('click', e => {
    const b = e.target.closest('[data-del-contact]'); if (!b) return;
    const c = state.contacts.find(x => x.id === b.dataset.delContact);
    openModal({
      title: '¿Eliminar apoyo?', body: `<p>Se eliminará a <strong>${esc(c.name)}</strong> de tus apoyos.</p>`,
      actions: [{ label: 'Cancelar' }, { label: 'Eliminar', variant: 'btn--primary', onClick: () => { state.contacts = state.contacts.filter(x => x.id !== c.id); if (state.contacts.length && !state.contacts.some(x => x.main)) state.contacts[0].main = true; save(); renderSupports(); renderPlan(); renderSenior(); toast('Apoyo eliminado'); } }]
    });
  });

  /* ---------- HU-43 · Compartir ubicación con familiares ---------- */
  function getPosition() {
    return new Promise(resolve => {
      if (!('geolocation' in navigator)) return resolve(null);
      navigator.geolocation.getCurrentPosition(p => resolve(p.coords), () => resolve(null), { timeout: 6000, maximumAge: 60000 });
    });
  }
  $('#share-btn').addEventListener('click', async () => {
    const ids = $$('input[name="share-to"]:checked').map(i => i.value);
    if (!ids.length) { $('#share-error').textContent = 'Elige al menos a un familiar.'; const f = $('input[name="share-to"]'); if (f) f.focus(); return; }
    $('#share-error').textContent = '';
    const btn = $('#share-btn'); btn.disabled = true; btn.lastChild.textContent = 'Obteniendo ubicación…';
    const coords = await getPosition();
    btn.disabled = false; btn.lastChild.textContent = 'Compartir ubicación';
    const route = seniorRoutes().find(r => r.key === state.senRouteKey) || seniorRoutes().find(r => r.accessibleOk);
    const where = coords ? `https://maps.google.com/?q=${coords.latitude.toFixed(5)},${coords.longitude.toFixed(5)}` : `${homeOrExample().label.replace(' (dirección de ejemplo)', '')} (${D.SECTOR})`;
    const msg = `Hola, te comparto mi ubicación desde ZonaLimaSegura. Estoy en: ${where}.${route ? ` Mi punto de reunión es ${route.punto.name}.` : ''}`;
    const to = state.contacts.filter(c => ids.includes(c.id));
    state.sharing = { to: ids, date: new Date().toISOString(), msg }; save();
    $('#share-result').hidden = false;
    $('#share-status').innerHTML = `${icon('check')} Compartiendo tu ubicación con ${esc(to.map(c => c.name.split(' ')[0]).join(', '))} desde las ${new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false })}.${coords ? '' : ' No pudimos usar tu GPS, así que enviamos la dirección de tu vivienda.'}`;
    $('#share-msg').value = msg;
    $('#share-links').innerHTML = to.map(c => `<a class="btn btn--dark btn--sm" href="https://wa.me/51${c.phone}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">${icon('phone')}Enviar por WhatsApp a ${esc(c.name.split(' ')[0])}<span class="sr-only"> (se abre en otra pestaña)</span></a>`).join('')
      + `<button type="button" class="btn btn--secondary btn--sm" id="share-copy">${icon('copy')}Copiar mensaje</button>`
      + (navigator.share ? `<button type="button" class="btn btn--secondary btn--sm" id="share-native">${icon('share')}Otra aplicación</button>` : '');
    $('#share-copy').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(msg); toast('Mensaje copiado'); }
      catch (e) { $('#share-msg').select(); toast('Selecciona el mensaje y cópialo'); }
    });
    const nat = $('#share-native'); if (nat) nat.addEventListener('click', () => navigator.share({ title: 'Mi ubicación', text: msg }).catch(() => {}));
    $('#share-status').setAttribute('tabindex', '-1');
    $('#share-status').focus();
  });
  $('#share-stop').addEventListener('click', () => {
    state.sharing = null; save();
    $('#share-result').hidden = true;
    toast('Dejaste de compartir tu ubicación');
    $('#share-btn').focus();
  });

  /* ======================= Inicio ======================= */
  function renderEverything() { renderAllResident(); renderBrig(); fillRegSelects(); renderReg(); renderGest(); renderSenior(); renderSupports(); renderOfflineTexts(); renderDiagLast(); }

  applyFont(state.font || 1);
  if (state.home) { const a = D.ADDRESSES.find(x => x.x === state.home.x && x.y === state.home.y); if (a) homeSearch.value = a.label; }
  fillRegSelects();
  setRegType('ruta');
  renderEverything();
  if (state.sharing) {
    $('#share-result').hidden = false;
    $('#share-status').innerHTML = `${icon('check')} Sigues compartiendo tu ubicación (desde ${esc(fmtDate(state.sharing.date))}).`;
    $('#share-msg').value = state.sharing.msg;
  }
  document.addEventListener('zls:tab', e => { if (e.detail === 'tab-brig-reg') renderReg(); });
})();
