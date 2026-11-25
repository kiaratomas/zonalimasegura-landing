/**
 * ZonaLimaSegura · Recepción de resultados de la validación con usuarios (6.2)
 * Se pega en la hoja de Google Sheets: Extensiones › Apps Script, y se publica
 * como aplicación web (Ejecutar como: yo · Quién tiene acceso: cualquier persona).
 *  - doPost: la Landing Page (modo prueba) envía cada participación.
 *  - doGet: el tablero de resultados lee todas las filas en JSON.
 */
const HOJA_ID = '1QuIjwI_r_VE7V94-uhh4RSREHf1KttU0Ru3bbG_npwQ'; // ID de la hoja (está en su URL)
const HOJA_P = 'Participantes';
const HOJA_M = 'Misiones';
const P = [
  ['fecha', 'Fecha'], ['pid', 'Código'], ['tipo', 'Tipo'], ['segmento', 'Segmento'], ['filtro', 'Filtro (Sí/No)'],
  ['edad', 'Edad'], ['uso', 'Uso de internet'], ['distrito', 'Distrito'], ['dispositivo', 'Dispositivo'], ['duracion_s', 'Duración (s)'],
  ['sus1', 'SUS 1'], ['sus2', 'SUS 2'], ['sus3', 'SUS 3'], ['sus4', 'SUS 4'], ['sus5', 'SUS 5'],
  ['sus6', 'SUS 6'], ['sus7', 'SUS 7'], ['sus8', 'SUS 8'], ['sus9', 'SUS 9'], ['sus10', 'SUS 10'],
  ['sus_puntaje', 'Puntaje SUS'], ['completadas', 'Misiones completadas'], ['comentario', 'Comentario']
];
const M = [
  ['fecha', 'Fecha'], ['pid', 'Código'], ['tipo', 'Tipo'], ['segmento', 'Segmento'], ['mision', 'Misión'], ['hu', 'HU'],
  ['descripcion', 'Descripción'], ['resultado', 'Resultado'], ['tiempo_s', 'Tiempo (s)'], ['errores', 'Errores']
];
const SEGMENTOS = ['residentes', 'brigadistas', 'adultos'];

function hoja_(nombre, cols) {
  const ss = SpreadsheetApp.openById(HOJA_ID);
  let h = ss.getSheetByName(nombre);
  if (!h) {
    h = ss.insertSheet(nombre);
    h.appendRow(cols.map(c => c[1]));
    h.setFrozenRows(1);
    h.getRange(1, 1, 1, cols.length).setFontWeight('bold').setBackground('#E4E9EF');
  }
  return h;
}
const txt_ = (v, n) => String(v == null ? '' : v).replace(/^[=+\-@]/, "'$&").slice(0, n); // evita fórmulas inyectadas
const num_ = (v, min, max) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : ''; };
const json_ = o => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);

function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'JSON inválido' }); }
  const sus = Array.isArray(d.sus) ? d.sus.map(Number) : [];
  if (!SEGMENTOS.includes(d.segmento) || sus.length !== 10 || sus.some(v => !(v >= 1 && v <= 5 && v % 1 === 0))
      || !Array.isArray(d.misiones) || !d.misiones.length || d.misiones.length > 6 || !/^P-[A-Z0-9]{3,8}$/.test(d.pid)) {
    return json_({ ok: false, error: 'Datos incompletos' });
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const hp = hoja_(HOJA_P, P), hm = hoja_(HOJA_M, M);
    const n = hp.getLastRow();
    if (n > 1 && hp.getRange(2, 2, n - 1, 1).getValues().some(r => r[0] === d.pid)) return json_({ ok: true, duplicado: true });
    const fecha = new Date();
    const tipo = d.tipo === 'real' ? 'real' : 'demo';
    const puntaje = sus.reduce((t, v, i) => t + (i % 2 === 0 ? v - 1 : 5 - v), 0) * 2.5;
    const mis = d.misiones.map(m => ({
      id: txt_(m.id, 4), hu: txt_(m.hu, 30), desc: txt_(m.mision, 200), ok: m.completada === true,
      t: num_(m.tiempo_s, 0, 36000), err: num_(m.errores, 0, 999)
    }));
    hp.appendRow([fecha, d.pid, tipo, d.segmento, txt_(d.filtro, 2), txt_(d.edad, 10), txt_(d.uso, 30), txt_(d.distrito, 40),
      txt_(d.dispositivo, 12), num_(d.duracion_s, 0, 36000), ...sus, puntaje, mis.filter(m => m.ok).length + ' de ' + mis.length,
      txt_(d.comentario, 500)]);
    mis.forEach(m => hm.appendRow([fecha, d.pid, tipo, d.segmento, m.id, m.hu, m.desc, m.ok ? 'Completada' : 'No pudo', m.t, m.err]));
    return json_({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  const leer = (nombre, cols) => {
    const h = SpreadsheetApp.openById(HOJA_ID).getSheetByName(nombre);
    if (!h || h.getLastRow() < 2) return [];
    return h.getRange(2, 1, h.getLastRow() - 1, cols.length).getValues()
      .map(r => Object.fromEntries(cols.map((c, i) => [c[0], r[i] instanceof Date ? r[i].toISOString() : r[i]])));
  };
  return json_({ actualizado: new Date().toISOString(), participantes: leer(HOJA_P, P), misiones: leer(HOJA_M, M) });
}
