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

/**
 * Crea (o rehace) la pestaña "Resumen" con las estadísticas que pide el handbook para 6.2:
 * resultados por misión y por segmento (%, tiempo, errores, "No pudo") y SUS por segmento, con gráficos.
 * Son fórmulas: se actualiza sola con cada participante. Ejecutar a mano una vez desde el editor.
 */
function crearResumen() {
  const ss = SpreadsheetApp.openById(HOJA_ID);
  hoja_(HOJA_P, P); hoja_(HOJA_M, M);
  const vieja = ss.getSheetByName('Resumen');
  if (vieja) ss.deleteSheet(vieja);
  const h = ss.insertSheet('Resumen', 0);
  const okM = '((Misiones!$C$2:$C="real")+($B$2*(Misiones!$C$2:$C="demo")))';
  const okP = '((Participantes!$C$2:$C="real")+($B$2*(Participantes!$C$2:$C="demo")))';
  const cab = a1 => h.getRange(a1).setFontWeight('bold').setBackground('#E4E9EF').setWrap(true).setVerticalAlignment('middle');

  h.getRange('A1').setValue('Resumen de la validación con usuarios (6.2)').setFontWeight('bold').setFontSize(14);
  h.getRange('A2').setValue('Incluir demostraciones');
  h.getRange('B2').insertCheckboxes().setValue(false);
  h.getRange('C2').setValue('Sin marcar = solo participantes reales (lo que va al informe). Se actualiza solo.').setFontColor('#666666');

  // Tabla 1: por misión
  h.getRange('A4').setValue('Resultados por misión').setFontWeight('bold');
  h.getRange('A5:J5').setValues([['Segmento', 'Misión', 'Qué debía hacer', 'HU', 'Intentos', 'Completadas', 'No pudo',
    '% completadas', 'Tiempo promedio (s)', 'Errores promedio']]);
  cab('A5:J5');
  const mis = [
    ['Residentes', 'R1', 'Conocer el riesgo de su zona', 'HU-01, HU-02'],
    ['Residentes', 'R2', 'Revisar su vivienda', 'HU-04 a HU-07'],
    ['Residentes', 'R3', 'Acordar por dónde evacuar', 'HU-09, HU-10'],
    ['Residentes', 'R4', 'Ver su plan sin internet', 'HU-13'],
    ['Brigadistas', 'B1', 'Avisar de una calle bloqueada', 'HU-22'],
    ['Brigadistas', 'B2', 'Agregar un punto de reunión', 'HU-18'],
    ['Brigadistas', 'B3', 'Dejar lista una ruta revisada', 'HU-24'],
    ['Brigadistas', 'B4', 'Tener el mapa sin señal', 'HU-27'],
    ['Adultos mayores', 'A1', 'Leer mejor la página', 'HU-33'],
    ['Adultos mayores', 'A2', 'Encontrar una ruta sin escaleras', 'HU-35, HU-36, HU-39'],
    ['Adultos mayores', 'A3', 'Registrar a un familiar', 'HU-42'],
    ['Adultos mayores', 'A4', 'Avisar dónde está', 'HU-43']
  ];
  h.getRange(6, 1, mis.length, 4).setValues(mis);
  h.getRange(6, 5, mis.length, 6).setFormulas(mis.map((m, i) => {
    const r = 6 + i, es = '(Misiones!$E$2:$E=$B' + r + ')*' + okM;
    return [
      '=SUMPRODUCT(' + es + ')',
      '=SUMPRODUCT(' + es + '*(Misiones!$H$2:$H="Completada"))',
      '=E' + r + '-F' + r,
      '=IF(E' + r + '=0,0,F' + r + '/E' + r + ')',
      '=IF(E' + r + '=0,"—",SUMPRODUCT(' + es + '*Misiones!$I$2:$I)/E' + r + ')',
      '=IF(E' + r + '=0,"—",SUMPRODUCT(' + es + '*Misiones!$J$2:$J)/E' + r + ')'
    ];
  }));

  // Tabla 2: por segmento y total
  h.getRange('A20').setValue('Resultados por segmento').setFontWeight('bold');
  h.getRange('A21:J21').setValues([['Segmento', 'Participantes', 'Meta', 'Misiones intentadas', '% misiones completadas',
    'Misiones "No pudo"', 'Tiempo promedio por misión (s)', 'Errores promedio por misión', 'SUS promedio', 'Interpretación SUS']]);
  cab('A21:J21');
  const segs = [['Residentes', 'residentes'], ['Brigadistas', 'brigadistas'], ['Adultos mayores', 'adultos'], ['Total', '']];
  h.getRange(22, 1, segs.length, 1).setValues(segs.map(s => [s[0]]));
  h.getRange(22, 2, segs.length, 9).setFormulas(segs.map((s, i) => {
    const r = 22 + i;
    const sm = (s[1] ? '(Misiones!$D$2:$D="' + s[1] + '")*' : '') + okM;
    const sp = (s[1] ? '(Participantes!$D$2:$D="' + s[1] + '")*' : '') + okP;
    return [
      '=SUMPRODUCT(' + sp + ')',
      '=' + (s[1] ? 10 : 30),
      '=SUMPRODUCT(' + sm + ')',
      '=IF(D' + r + '=0,0,SUMPRODUCT(' + sm + '*(Misiones!$H$2:$H="Completada"))/D' + r + ')',
      '=SUMPRODUCT(' + sm + '*(Misiones!$H$2:$H="No pudo"))',
      '=IF(D' + r + '=0,"—",SUMPRODUCT(' + sm + '*Misiones!$I$2:$I)/D' + r + ')',
      '=IF(D' + r + '=0,"—",SUMPRODUCT(' + sm + '*Misiones!$J$2:$J)/D' + r + ')',
      '=IF(B' + r + '=0,"—",SUMPRODUCT(' + sp + '*Participantes!$U$2:$U)/B' + r + ')',
      '=IF(ISNUMBER(I' + r + '),IFS(I' + r + '>=80.3,"Excelente",I' + r + '>=68,"Bueno",I' + r + '>=51,"Regular",TRUE,"Deficiente"),"—")'
    ];
  }));
  h.getRange('A25:J25').setFontWeight('bold');
  h.getRange('A27').setValue('SUS: 80.3 o más = Excelente · 68 a 80.2 = Bueno (68 es el promedio) · 51 a 67.9 = Regular · menos de 51 = Deficiente.')
    .setFontColor('#666666');

  // Formatos
  h.getRange('H6:H17').setNumberFormat('0%');
  h.getRange('E22:E25').setNumberFormat('0%');
  h.getRange('I6:J17').setNumberFormat('0.0');
  h.getRange('G22:I25').setNumberFormat('0.0');
  [h.getRange('A5:J17'), h.getRange('A21:J25')].forEach(r => r.setBorder(true, true, true, true, true, true, '#9AA8B6', null));
  h.setColumnWidth(1, 130); h.setColumnWidth(2, 90); h.setColumnWidth(3, 230); h.setColumnWidth(4, 130);
  h.setColumnWidths(5, 6, 110);
  h.setRowHeight(5, 42); h.setRowHeight(21, 42);
  h.setFrozenRows(2);

  // Gráficos (a la derecha de las tablas)
  const graf = (tipo, x, y, titulo, eje, color, fila) => h.insertChart(h.newChart().setChartType(tipo)
    .addRange(h.getRange(x)).addRange(h.getRange(y))
    .setOption('title', titulo).setOption('legend', { position: 'none' }).setOption('colors', [color])
    .setOption(tipo === Charts.ChartType.BAR ? 'hAxis' : 'vAxis', eje)
    .setPosition(fila, 12, 0, 0).build());
  graf(Charts.ChartType.BAR, 'B5:B17', 'H5:H17', '% de participantes que completó cada misión',
    { minValue: 0, maxValue: 1, format: 'percent' }, '#14283C', 4);
  graf(Charts.ChartType.COLUMN, 'A21:A24', 'E21:E24', '% de misiones completadas por segmento',
    { minValue: 0, maxValue: 1, format: 'percent' }, '#2E7D5B', 24);
  graf(Charts.ChartType.COLUMN, 'A21:A24', 'I21:I24', 'SUS promedio por segmento (68 = promedio)',
    { minValue: 0, maxValue: 100 }, '#C0392B', 44);
}
