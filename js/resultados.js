/* ZonaLimaSegura · Tablero de resultados de la validación (6.2). Lee la hoja de Google Sheets cada 5 s. */
'use strict';

(() => {
  const ENDPOINT = window.ZLS_VAL_ENDPOINT || '';
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const SEG = { residentes: 'Residentes', brigadistas: 'Brigadistas', adultos: 'Adultos mayores' };
  const GOAL = 10;
  const MISSIONS = [
    ['R1', 'residentes', 'Conocer el riesgo de su zona', 'HU-01, HU-02'],
    ['R2', 'residentes', 'Revisar su vivienda con el autodiagnóstico', 'HU-04 a HU-07'],
    ['R3', 'residentes', 'Elegir una ruta de evacuación', 'HU-09, HU-10'],
    ['R4', 'residentes', 'Guardar su plan para usarlo sin internet', 'HU-13'],
    ['B1', 'brigadistas', 'Reportar una vía bloqueada', 'HU-22'],
    ['B2', 'brigadistas', 'Registrar un punto de reunión', 'HU-18'],
    ['B3', 'brigadistas', 'Validar una ruta', 'HU-24'],
    ['B4', 'brigadistas', 'Guardar el mapa para campo', 'HU-27'],
    ['A1', 'adultos', 'Agrandar la letra', 'HU-33'],
    ['A2', 'adultos', 'Encontrar una ruta sin escaleras', 'HU-35, HU-36, HU-39'],
    ['A3', 'adultos', 'Registrar un familiar de apoyo', 'HU-42'],
    ['A4', 'adultos', 'Compartir su ubicación', 'HU-43']
  ];

  const avg = a => (a.length ? a.reduce((t, v) => t + v, 0) / a.length : null);
  const fmt = (n, d = 0) => (n == null ? '—' : n.toLocaleString('es-PE', { minimumFractionDigits: d, maximumFractionDigits: d }));
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const grade = s => (s == null ? '' : s >= 80.3 ? 'Excelente' : s >= 68 ? 'Bueno' : s >= 51 ? 'Regular' : 'Deficiente');
  console.assert(grade(85) === 'Excelente' && grade(70) === 'Bueno' && grade(55) === 'Regular' && grade(40) === 'Deficiente', 'grade');

  let data = null, last = null;
  const demoBox = $('#dash-demo');
  demoBox.checked = new URLSearchParams(location.search).get('demo') === '1';
  demoBox.addEventListener('change', render);

  const base = new URL('index.html', location.href);
  $('#dash-url-real').textContent = base.href + '?modo=prueba';
  $('#dash-url-demo').textContent = base.href + '?modo=prueba&demo=1';

  async function load() {
    if (!/^https:\/\/script\.google\.com\//.test(ENDPOINT)) {
      showError('Falta configurar la URL de Apps Script en js/validacion-config.js.');
      return;
    }
    try {
      const res = await fetch(ENDPOINT, { cache: 'no-store' });
      data = await res.json();
      last = Date.now();
      $('#dash-error').hidden = true;
      render();
    } catch (e) {
      showError('No se pudo leer la hoja de resultados. Reintentando…');
    }
  }
  function showError(msg) { const el = $('#dash-error'); el.textContent = msg; el.hidden = false; }
  setInterval(() => { if (last) $('#dash-updated').textContent = `En vivo · actualizado hace ${Math.round((Date.now() - last) / 1000)} s`; }, 1000);

  function render() {
    if (!data) return;
    const keep = r => demoBox.checked || r.tipo === 'real';
    const ps = data.participantes.filter(keep);
    const ms = data.misiones.filter(keep);
    renderKpis(ps, ms);
    renderMissions(ms);
    renderSus(ps);
    renderComments(ps);
  }

  function renderKpis(ps, ms) {
    const segCount = k => ps.filter(p => p.segmento === k).length;
    const okRate = pct(ms.filter(m => m.resultado === 'Completada').length, ms.length);
    const sus = avg(ps.map(p => Number(p.sus_puntaje)));
    const t = avg(ms.map(m => Number(m.tiempo_s)).filter(Number.isFinite));
    $('#dash-kpis').innerHTML = `
      <div class="dash-card"><h3>Participantes</h3><p class="dash-kpi">${ps.length}<small> / ${GOAL * 3}</small></p>
        <div class="dash-meter dash-meter--accent"><span style="width:${Math.min(100, pct(ps.length, GOAL * 3))}%"></span></div>
        ${Object.entries(SEG).map(([k, l]) => `<p class="dash-sub">${l}: <strong>${segCount(k)}</strong> / ${GOAL}</p>`).join('')}</div>
      <div class="dash-card"><h3>Puntaje SUS promedio</h3><p class="dash-kpi">${fmt(sus, 1)}</p><p class="dash-sub">${grade(sus) || 'Sin respuestas aún'}</p></div>
      <div class="dash-card"><h3>Misiones completadas</h3><p class="dash-kpi">${ms.length ? okRate + '<small> %</small>' : '—'}</p><p class="dash-sub">${ms.filter(m => m.resultado === 'Completada').length} de ${ms.length} intentos</p></div>
      <div class="dash-card"><h3>Tiempo promedio por misión</h3><p class="dash-kpi">${fmt(t)}<small> s</small></p><p class="dash-sub">Errores promedio: ${fmt(avg(ms.map(m => Number(m.errores) || 0)), 1)}</p></div>`;
  }

  function renderMissions(ms) {
    if (!ms.length) { $('#dash-missions').innerHTML = '<p class="dash-empty">Aún no hay participaciones.</p>'; return; }
    let rows = '';
    Object.entries(SEG).forEach(([k, l]) => {
      rows += `<tr class="dash-group"><td colspan="6">${l}</td></tr>`;
      MISSIONS.filter(m => m[1] === k).forEach(([id, , name, hu]) => {
        const rs = ms.filter(m => m.mision === id);
        const ok = rs.filter(m => m.resultado === 'Completada').length;
        const p = pct(ok, rs.length);
        rows += `<tr><td><strong>${id}</strong> · ${esc(name)}</td><td>${hu}</td>
          <td class="num">${ok}/${rs.length}</td>
          <td><div class="dash-bar"><div class="dash-meter"><span style="width:${p}%"></span></div><span class="num">${rs.length ? p + ' %' : '—'}</span></div></td>
          <td class="num">${fmt(avg(rs.map(m => Number(m.tiempo_s)).filter(Number.isFinite)))} s</td>
          <td class="num">${fmt(avg(rs.map(m => Number(m.errores) || 0)), 1)}</td></tr>`;
      });
    });
    $('#dash-missions').innerHTML = `<div class="dash-table-wrap"><table class="dash-table">
      <caption class="sr-only">Resultados por misión</caption>
      <thead><tr><th scope="col">Misión</th><th scope="col">HU</th><th scope="col">Completaron</th><th scope="col">Tasa de éxito</th><th scope="col">Tiempo prom.</th><th scope="col">Errores prom.</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  }

  function susCard(title, list) {
    const s = avg(list.map(p => Number(p.sus_puntaje)));
    return `<div class="dash-card"><h3>${title}</h3>
      <p class="dash-kpi">${fmt(s, 1)}</p><p class="dash-sub">${s == null ? 'Sin respuestas' : `${grade(s)} · ${list.length} participante(s)`}</p>
      <div class="dash-scale" role="img" aria-label="Puntaje ${fmt(s, 1)} de 100">${s == null ? '' : `<span class="dash-scale__mark" style="left:${s}%"></span>`}</div>
      <div class="dash-scale__legend" aria-hidden="true"><span>0</span><span>51</span><span>68</span><span>100</span></div></div>`;
  }
  function renderSus(ps) {
    $('#dash-sus').innerHTML = susCard('Todos', ps) + Object.entries(SEG).map(([k, l]) => susCard(l, ps.filter(p => p.segmento === k))).join('');
  }

  function renderComments(ps) {
    const cs = ps.filter(p => String(p.comentario || '').trim()).slice(-8).reverse();
    $('#dash-comments').innerHTML = cs.length
      ? cs.map(p => `<div class="dash-comment"><p>“${esc(p.comentario)}”</p><p>${SEG[p.segmento] || ''} · ${new Date(p.fecha).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}${p.tipo === 'demo' ? ' · demostración' : ''}</p></div>`).join('')
      : '<p class="dash-empty">Aún no hay comentarios.</p>';
  }

  load();
  setInterval(load, 5000);
})();
