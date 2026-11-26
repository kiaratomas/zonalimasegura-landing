/* =========================================================
   ZonaLimaSegura · Modo validación con usuarios (Capítulo VI · 6.2)
   Se activa solo con pages/index.html?modo=prueba (o &demo=1 para
   participaciones de demostración). Guía al participante por misiones,
   detecta si las cumple leyendo el estado que guarda la Landing Page,
   cuenta los mensajes de error, aplica el SUS y envía los resultados
   a la hoja de Google Sheets del equipo. La página normal no cambia.
   ========================================================= */
'use strict';

(() => {
  const ENDPOINT = window.ZLS_VAL_ENDPOINT || ''; // definida en js/validacion-config.js

  const SESSION_KEY = 'zls-val-sesion';
  const QUEUE_KEY = 'zls-val-pendientes';
  const APP_KEY = 'zls-state-v1';
  const params = new URLSearchParams(location.search);
  let flushing = null;
  let ses = null;
  try { ses = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch (e) { ses = null; }
  if (params.get('modo') !== 'prueba' && !ses) { flushQueue(); return; }

  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const appState = () => { try { return JSON.parse(localStorage.getItem(APP_KEY) || '{}'); } catch (e) { return {}; } };
  const saveSes = () => { try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(ses)); } catch (e) { /* sin almacenamiento */ } };
  const now = () => Date.now();

  /* ---------------- Segmentos, filtros y misiones ---------------- */
  const SEGMENTS = {
    residentes: {
      label: 'Vivo en Lima y quiero proteger mi casa',
      filter: '¿Vives en Lima?'
    },
    brigadistas: {
      label: 'Soy brigadista o ayudo en emergencias de mi barrio',
      filter: '¿Participas o has participado en una brigada, junta vecinal, Defensa Civil o en la gestión de riesgo de desastres?'
    },
    adultos: {
      label: 'Soy adulto mayor, me cuesta caminar o cuido a alguien así',
      filter: '¿Tienes 60 años o más, alguna dificultad para caminar, o cuidas a una persona en esa situación?'
    }
  };

  // ok(base, st): true cuando la misión está cumplida. base = estado al empezar la misión.
  const MISSIONS = {
    residentes: [
      { id: 'R1', hu: 'HU-01, HU-02', text: 'Averigua qué tan riesgosa es tu zona. Tu dirección: Jr. Las Flores 245.',
        tip: 'Pestaña «Mi zona»: escribe la dirección y pulsa «Buscar dirección».',
        ok: (b, s) => !!s.home && !$('#risk-card')?.hidden },
      { id: 'R2', hu: 'HU-04 a HU-07', text: 'Revisa si tu casa tiene señales de daño ante un sismo.',
        tip: 'Pestaña «Autodiagnóstico» → «Empezar autodiagnóstico».',
        ok: (b, s) => !!s.diag && s.diag.date !== (b.diag && b.diag.date) },
      { id: 'R3', hu: 'HU-09, HU-10', text: 'Elige la ruta por la que tu familia evacuaría.',
        tip: 'Pestaña «Mapa y rutas»: toca una ruta y pulsa «Elegir como mi ruta».',
        ok: (b, s) => !!(s.plan && s.plan.routeKey) && s.plan.routeKey !== (b.plan && b.plan.routeKey) },
      { id: 'R4', hu: 'HU-13', text: 'Haz que tu plan se pueda ver sin internet.',
        tip: 'Pestaña «Mapa y rutas» → botón «Guardar mapa».',
        ok: (b, s) => !!(s.offline && s.offline.res) && s.offline.res.date !== (b.offline && b.offline.res && b.offline.res.date) }
    ],
    brigadistas: [
      { id: 'B1', hu: 'HU-22', text: 'Viste cables caídos que bloquean una calle. Avisa a los vecinos.',
        tip: 'Pestaña «Registrar» → «Vía bloqueada» → márcala en el mapa → «Guardar registro».',
        ok: (b, s) => len(s.bloqueos) > len(b.bloqueos) },
      { id: 'B2', hu: 'HU-18', text: 'Agrega un parque como punto de reunión.',
        tip: 'Pestaña «Registrar» → «Punto de reunión» → márcalo en el mapa → «Guardar registro».',
        ok: (b, s) => len(s.puntosExtra) > len(b.puntosExtra) },
      { id: 'B3', hu: 'HU-24', text: 'Aprueba una ruta que propusieron los vecinos.',
        tip: 'Pestaña «Gestión y validación» → elige una ruta → «Validar ruta».',
        ok: (b, s) => validadas(s) > validadas(b) },
      { id: 'B4', hu: 'HU-27', text: 'Guarda el mapa para usarlo donde no hay señal.',
        tip: 'Pestaña «Mapa de la zona» → botón «Guardar mapa».',
        ok: (b, s) => !!(s.offline && s.offline.brig) && s.offline.brig.date !== (b.offline && b.offline.brig && b.offline.brig.date) }
    ],
    adultos: [
      { id: 'A1', hu: 'HU-33', text: 'Haz que las letras se vean más grandes.',
        tip: 'Botones «A+» del menú de arriba, o en la pestaña «Inicio».',
        ok: (b, s) => (s.font || 1) > 1 },
      { id: 'A2', hu: 'HU-35, HU-36, HU-39', text: 'No puedes subir escaleras. Busca una ruta para ti y mira por dónde va.',
        tip: 'Pestaña «Rutas accesibles» → toca una ruta «Sin escaleras».',
        ok: () => seniorPicked },
      { id: 'A3', hu: 'HU-42', text: 'Registra a tu nieta Rosa (912 345 678) como tu apoyo.',
        tip: 'Pestaña «Mis apoyos» → «Guardar familiar».',
        ok: (b, s) => len(s.contacts) > len(b.contacts) },
      { id: 'A4', hu: 'HU-43', text: 'Avísale a un familiar dónde estás.',
        tip: 'Pestaña «Mis apoyos» → «Compartir ubicación».',
        ok: (b, s) => !!s.sharing && s.sharing.date !== (b.sharing && b.sharing.date) }
    ]
  };
  const len = a => (Array.isArray(a) ? a.length : 0);
  const validadas = s => (s.rutasCom || []).filter(r => r.status === 'validada').length;

  // A2: se cumple al abrir el detalle de una ruta sin escaleras hacia un punto accesible
  let seniorPicked = false;
  document.addEventListener('click', e => {
    if (!e.target.closest('#sen-route-list [data-sen], #map-sen .map-route, #panel-sen-inicio button')) return;
    setTimeout(() => {
      const d = $('#sen-detail'), chips = ($('#sen-detail-chips') || {}).textContent || '';
      if (d && !d.hidden && !$('#panel-sen-rutas').hidden && /Sin escaleras/.test(chips)) seniorPicked = true;
    }, 400);
  }, true);

  /* ---------------- SUS (10 ítems estándar) ---------------- */
  const SUS = [
    'Creo que me gustaría usar esta página con frecuencia.',
    'Encontré la página innecesariamente compleja.',
    'Pensé que la página era fácil de usar.',
    'Creo que necesitaría el apoyo de una persona con conocimientos técnicos para poder usar esta página.',
    'Encontré que las diversas funciones de esta página estaban bien integradas.',
    'Pensé que había demasiada inconsistencia en esta página.',
    'Imagino que la mayoría de las personas aprendería a usar esta página muy rápidamente.',
    'Encontré la página muy complicada de usar.',
    'Me sentí muy seguro(a) usando la página.',
    'Necesité aprender muchas cosas antes de poder empezar a usar esta página.'
  ];
  const susScore = r => r.reduce((t, v, i) => t + (i % 2 === 0 ? v - 1 : 5 - v), 0) * 2.5;
  console.assert(susScore([5, 1, 5, 1, 5, 1, 5, 1, 5, 1]) === 100 && susScore([3, 3, 3, 3, 3, 3, 3, 3, 3, 3]) === 50, 'SUS mal calculado');

  /* ---------------- Interfaz ---------------- */
  const css = document.createElement('link');
  css.rel = 'stylesheet'; css.href = '../css/validacion.css';
  document.head.appendChild(css);

  const root = document.createElement('div');
  root.id = 'val-root';
  document.body.appendChild(root);

  function overlay(html) {
    root.innerHTML = `<div class="val-overlay" role="dialog" aria-modal="true" aria-labelledby="val-title"><div class="val-sheet">${html}</div></div>`;
    document.documentElement.classList.add('val-locked');
    const t = $('#val-title'); if (t) { t.tabIndex = -1; t.focus(); }
  }
  function closeOverlay() { root.innerHTML = ''; document.documentElement.classList.remove('val-locked'); }

  const demo = () => (ses ? ses.demo : params.get('demo') === '1');
  const badge = () => demo() ? '<span class="val-badge">Demostración</span>' : '';

  /* ---------- 1. Bienvenida, consentimiento y filtro ---------- */
  function renderIntro() {
    overlay(`
      <p class="val-eyebrow">Prueba de ZonaLimaSegura ${badge()}</p>
      <h2 id="val-title">Ayúdanos a probar esta página</h2>
      <ol class="val-how">
        <li><strong>Haz 4 misiones</strong> cortas en la página.</li>
        <li><strong>Responde 10 preguntas</strong> sobre qué te pareció.</li>
      </ol>
      <p class="muted small">Unos 7 minutos. Evaluamos la página, no a ti.</p>
      <form id="val-form" novalidate>
        <div id="val-step1" class="val-step">
          <p class="val-step__n">Paso 1 de 2</p>
          <fieldset class="val-q"><legend>¿Quién eres?</legend>
            ${Object.entries(SEGMENTS).map(([k, s]) => `<label class="val-opt"><input type="radio" name="seg" value="${k}"> <span>${s.label}</span></label>`).join('')}
            <label class="val-opt"><input type="radio" name="seg" value="ninguno"> <span>Ninguna de estas</span></label>
          </fieldset>
          <fieldset class="val-q" id="val-filter" hidden><legend id="val-filter-q"></legend>
            <label class="val-opt val-opt--inline"><input type="radio" name="filtro" value="Sí"> <span>Sí</span></label>
            <label class="val-opt val-opt--inline"><input type="radio" name="filtro" value="No"> <span>No</span></label>
          </fieldset>
          <button type="button" class="btn btn--primary btn--lg btn--block" id="val-next">Siguiente</button>
        </div>
        <div id="val-step2" class="val-step" hidden>
          <p class="val-step__n">Paso 2 de 2</p>
          <label class="val-field">Nombre y apellido
            <input type="text" name="nombre" maxlength="60" autocomplete="name">
          </label>
          <label class="val-field">Correo o celular
            <input type="text" name="contacto" maxlength="80" autocomplete="email">
          </label>
          <fieldset class="val-q"><legend>Tu edad</legend>
            ${['18 a 29', '30 a 44', '45 a 59', '60 a 69', '70 o más'].map(v => `<label class="val-opt val-opt--inline"><input type="radio" name="edad" value="${v}"> <span>${v}</span></label>`).join('')}
          </fieldset>
          <fieldset class="val-q"><legend>¿Cada cuánto usas internet?</legend>
            ${['Todos los días', 'Algunas veces por semana', 'Casi nunca'].map(v => `<label class="val-opt"><input type="radio" name="uso" value="${v}"> <span>${v}</span></label>`).join('')}
          </fieldset>
          <label class="val-field"><span>Distrito <span class="muted">(opcional)</span></span>
            <input type="text" name="distrito" maxlength="40" autocomplete="off">
          </label>
          <label class="val-check"><input type="checkbox" name="acepto"> <span>Acepto participar. Mi nombre y contacto no se publican.</span></label>
          <button type="submit" class="btn btn--primary btn--lg btn--block">Empezar misiones</button>
          <button type="button" class="link-btn val-back" id="val-back">← Atrás</button>
        </div>
        <p class="val-error" id="val-form-error" role="alert"></p>
        <p class="small" style="text-align:center;margin:0"><a href="${location.pathname}#validar">Ahora no, volver a la página</a></p>
      </form>`);
    const form = $('#val-form');
    const err = $('#val-form-error');
    const step = n => { $('#val-step1').hidden = n !== 1; $('#val-step2').hidden = n !== 2; err.textContent = ''; $('#val-title').focus(); };
    form.addEventListener('change', e => {
      if (e.target.name !== 'seg') return;
      const s = SEGMENTS[e.target.value];
      $('#val-filter').hidden = !s;
      if (s) $('#val-filter-q').textContent = s.filter;
      form.querySelectorAll('input[name=filtro]').forEach(i => { i.checked = false; });
    });
    $('#val-next').addEventListener('click', () => {
      const f = new FormData(form), seg = f.get('seg');
      if (!seg) return (err.textContent = 'Elige la opción que te describe.');
      if (seg !== 'ninguno' && !f.get('filtro')) return (err.textContent = 'Responde Sí o No.');
      if (!(seg !== 'ninguno' && f.get('filtro') === 'Sí') && !demo()) return renderNotFit();
      step(2);
    });
    $('#val-back').addEventListener('click', () => step(1));
    form.addEventListener('submit', e => {
      e.preventDefault();
      const f = new FormData(form);
      const seg = f.get('seg');
      if (!seg) return step(1);
      const nombre = String(f.get('nombre') || '').trim(), contacto = String(f.get('contacto') || '').trim();
      if (!/\S{2,}\s+\S{2,}/.test(nombre)) return (err.textContent = 'Escribe tu nombre y apellido.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contacto) && !/^\+?(51)?\s?9\d{2}\s?\d{3}\s?\d{3}$/.test(contacto)) return (err.textContent = 'Escribe un correo válido o un celular de 9 dígitos.');
      if (!f.get('edad') || !f.get('uso')) return (err.textContent = 'Responde tu edad y cada cuánto usas internet.');
      if (!f.get('acepto')) return (err.textContent = 'Marca que aceptas participar.');
      const fits = seg !== 'ninguno' && f.get('filtro') === 'Sí';
      ses = {
        pid: 'P-' + Math.random().toString(36).slice(2, 7).toUpperCase(),
        demo: demo(), seg: fits ? seg : (seg === 'ninguno' ? 'residentes' : seg),
        filtro: f.get('filtro') || 'No', edad: f.get('edad'), uso: f.get('uso'),
        distrito: String(f.get('distrito') || '').trim().slice(0, 40), nombre, contacto,
        started: now(), idx: 0, phase: 'mission', missions: [], fresh: true
      };
      saveSes();
      try { localStorage.removeItem(APP_KEY); } catch (er) { /* sin almacenamiento */ }
      location.replace(location.pathname + location.search); // la Landing arranca con sus datos de demostración
    });
  }
  function renderNotFit() {
    overlay(`<h2 id="val-title">¡Gracias por tu interés!</h2>
      <p>Esta prueba está pensada para residentes de Lima, brigadistas y adultos mayores o personas con movilidad reducida. Igual puedes explorar la página libremente.</p>
      <button type="button" class="btn btn--primary btn--lg btn--block" id="val-explore">Explorar la página</button>`);
    $('#val-explore').addEventListener('click', () => { closeOverlay(); history.replaceState(null, '', location.pathname); });
  }

  /* ---------- 2. Misiones ---------- */
  let ticker = null, base = null, tipShown = false;
  const list = () => MISSIONS[ses.seg];
  const cur = () => list()[ses.idx];
  const rec = () => ses.missions[ses.idx];

  function startMission() {
    if (ses.fresh) { ses.fresh = false; location.hash = ses.seg; } // va directo a la sección de su perfil
    base = appState();
    seniorPicked = false; tipShown = false;
    if (!rec()) ses.missions[ses.idx] = { id: cur().id, start: now(), errors: 0, ok: null, secs: null };
    saveSes();
    renderBar(false);
    clearInterval(ticker);
    ticker = setInterval(check, 600);
  }
  function renderBar(collapsed) {
    const m = cur();
    root.innerHTML = `
      <section class="val-bar${collapsed ? ' is-collapsed' : ''}" aria-label="Misión de la prueba">
        <div class="val-bar__head">
          <p class="val-eyebrow">Misión ${ses.idx + 1} de ${list().length} ${badge()}
            <span class="val-dots" aria-hidden="true">${list().map((_, i) => `<i class="${i < ses.idx ? 'is-done' : i === ses.idx ? 'is-now' : ''}"></i>`).join('')}</span></p>
          <button type="button" class="val-icon-btn" id="val-toggle" aria-expanded="${!collapsed}">${collapsed ? 'Ver misión' : 'Ocultar'}</button>
        </div>
        <div class="val-bar__body">
          <p class="val-mission" id="val-mission-text">${esc(m.text)}</p>
          <p class="val-tip" id="val-tip"${tipShown ? '' : ' hidden'}>Pista: ${esc(m.tip)}</p>
          <p class="val-hint">Cuando lo logres, pasamos solos a la siguiente.</p>
          <div class="val-bar__actions">
            ${tipShown ? '' : '<button type="button" class="btn btn--secondary btn--sm" id="val-tip-btn">Ver pista</button>'}
            <button type="button" class="link-btn" id="val-giveup">No pude hacerlo</button>
          </div>
        </div>
        <p class="sr-only" aria-live="polite" id="val-live"></p>
      </section>`;
    $('#val-toggle').addEventListener('click', () => renderBar(!collapsed));
    $('#val-giveup').addEventListener('click', () => finishMission(false));
    const tb = $('#val-tip-btn'); if (tb) tb.addEventListener('click', () => { tipShown = true; rec().tip = true; saveSes(); renderBar(false); });
  }
  function check() {
    if (!ses || ses.phase !== 'mission') return;
    let ok = false;
    try { ok = cur().ok(base, appState()); } catch (e) { ok = false; }
    if (ok) finishMission(true);
  }
  function finishMission(ok) {
    clearInterval(ticker);
    const r = rec();
    r.ok = ok; r.secs = Math.round((now() - r.start) / 1000);
    ses.idx += 1;
    if (ses.idx >= list().length) ses.phase = 'sus';
    saveSes();
    root.innerHTML = `<div class="val-toast${ok ? '' : ' is-skip'}" role="status">${ok ? '¡Misión cumplida!' : 'Pasamos a la siguiente.'}</div>`;
    setTimeout(() => (ses.phase === 'sus' ? renderSus() : startMission()), ok ? 1600 : 900);
  }

  // Cuenta cada mensaje de error que aparece en la página durante la misión
  const errText = new Map();
  new MutationObserver(() => {
    if (!ses || ses.phase !== 'mission' || !rec()) return;
    document.querySelectorAll('[id$="-error"]:not(#val-form-error)').forEach(el => {
      const t = el.textContent.trim();
      if (t && t !== errText.get(el.id)) { rec().errors += 1; saveSes(); }
      errText.set(el.id, t);
    });
  }).observe(document.body, { subtree: true, childList: true, characterData: true });

  /* ---------- 3. SUS y comentario ---------- */
  function renderSus() {
    const scale = [1, 2, 3, 4, 5];
    overlay(`
      <p class="val-eyebrow">Último paso ${badge()}</p>
      <h2 id="val-title">¿Qué te pareció la página?</h2>
      <p><strong>1</strong> = nada de acuerdo · <strong>5</strong> = totalmente de acuerdo.</p>
      <form id="val-sus" novalidate>
        ${SUS.map((q, i) => `
          <fieldset class="val-q val-sus">
            <legend><span class="val-num">${i + 1}.</span> ${q}</legend>
            <div class="val-scale">${scale.map(v => `<label><input type="radio" name="s${i}" value="${v}"><span>${v}</span></label>`).join('')}</div>
            <div class="val-scale__ends" aria-hidden="true"><span>Totalmente en desacuerdo</span><span>Totalmente de acuerdo</span></div>
          </fieldset>`).join('')}
        <label class="val-field"><span>¿Qué fue lo más difícil o qué cambiarías? <span class="muted">(opcional)</span></span>
          <textarea name="comentario" rows="3" maxlength="500"></textarea>
        </label>
        <p class="val-error" id="val-sus-error" role="alert"></p>
        <button type="submit" class="btn btn--primary btn--lg btn--block">Enviar respuestas</button>
      </form>`);
    $('#val-sus').addEventListener('submit', e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const r = SUS.map((_, i) => Number(f.get('s' + i)));
      const missing = r.findIndex(v => !v);
      if (missing >= 0) {
        $('#val-sus-error').textContent = `Falta responder la frase ${missing + 1}.`;
        e.target.querySelector(`input[name=s${missing}]`).focus();
        return;
      }
      submit(r, String(f.get('comentario') || '').trim().slice(0, 500));
    });
  }

  /* ---------- 4. Envío a Google Sheets ---------- */
  function submit(sus, comentario) {
    const ms = list();
    const payload = {
      pid: ses.pid, fecha: new Date().toISOString(), tipo: ses.demo ? 'demo' : 'real',
      segmento: ses.seg, filtro: ses.filtro, edad: ses.edad, uso: ses.uso, distrito: ses.distrito, nombre: ses.nombre, contacto: ses.contacto,
      dispositivo: window.innerWidth <= 640 ? 'Celular' : window.innerWidth <= 1024 ? 'Tablet' : 'Computadora',
      duracion_s: Math.round((now() - ses.started) / 1000),
      misiones: ses.missions.map((m, i) => ({ id: m.id, hu: ms[i].hu, mision: ms[i].text, completada: !!m.ok, tiempo_s: m.secs, errores: m.errors, pista: !!m.tip })),
      sus, sus_puntaje: susScore(sus), comentario
    };
    enqueue(payload);
    ses.phase = 'done'; saveSes();
    flushQueue().finally(renderThanks);
  }
  function enqueue(p) {
    try { const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); q.push(p); localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch (e) { /* sin almacenamiento */ }
  }
  function renderThanks() {
    overlay(`<h2 id="val-title">¡Gracias por participar!</h2>
      <p>Tus respuestas nos ayudan a que más familias estén preparadas ante un sismo.</p>
      <p class="muted small">Código de participación: ${esc(ses.pid)}</p>
      <button type="button" class="btn btn--primary btn--lg btn--block" id="val-next">Siguiente participante</button>
      <button type="button" class="btn btn--secondary btn--block" id="val-free">Seguir explorando la página</button>`);
    $('#val-next').addEventListener('click', () => {
      try { sessionStorage.removeItem(SESSION_KEY); localStorage.removeItem(APP_KEY); } catch (e) { /* sin almacenamiento */ }
      location.replace(location.pathname + '?modo=prueba' + (ses.demo ? '&demo=1' : ''));
    });
    $('#val-free').addEventListener('click', () => {
      try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* sin almacenamiento */ }
      ses = null; closeOverlay(); history.replaceState(null, '', location.pathname);
    });
  }

  /* ---------- Arranque ---------- */
  function boot() {
    if (!ses) renderIntro();
    else if (ses.phase === 'mission') startMission();
    else if (ses.phase === 'sus') renderSus();
    else renderThanks();
    flushQueue();
  }
  window.addEventListener('online', () => flushQueue());
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 50));
  else setTimeout(boot, 50);

  /* Envía los resultados guardados en el dispositivo; si falla (sin conexión), quedan para el próximo intento. */
  function flushQueue() {
    if (flushing) return flushing;
    if (!/^https:\/\/script\.google\.com\//.test(ENDPOINT)) return Promise.resolve();
    flushing = (async () => {
      let q = [];
      try { q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch (e) { q = []; }
      const rest = [];
      for (const p of q) {
        try {
          // no-cors: Apps Script no devuelve cabeceras CORS en POST; el envío llega igual
          await fetch(ENDPOINT, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(p) });
        } catch (e) { rest.push(p); }
      }
      try { localStorage.setItem(QUEUE_KEY, JSON.stringify(rest)); } catch (e) { /* sin almacenamiento */ }
    })().finally(() => { flushing = null; });
    return flushing;
  }
})();
