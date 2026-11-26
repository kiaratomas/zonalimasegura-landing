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
  ['sus_puntaje', 'Puntaje SUS'], ['completadas', 'Misiones completadas'], ['comentario', 'Comentario'],
  ['nombre', 'Nombre'], ['contacto', 'Correo o celular']
];
const P_PUBLICO = P.slice(0, -2); // nombre y contacto van al final y doGet no los devuelve (el tablero es público)
const M = [
  ['fecha', 'Fecha'], ['pid', 'Código'], ['tipo', 'Tipo'], ['segmento', 'Segmento'], ['mision', 'Misión'], ['hu', 'HU'],
  ['descripcion', 'Descripción'], ['resultado', 'Resultado'], ['tiempo_s', 'Tiempo (s)'], ['errores', 'Errores'], ['pista', 'Usó pista']
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
    if (hp.getRange(1, P.length).getValue() === '') hp.getRange(1, 1, 1, P.length).setValues([P.map(c => c[1])]); // columnas nuevas en hojas antiguas
    if (hm.getRange(1, M.length).getValue() === '') hm.getRange(1, 1, 1, M.length).setValues([M.map(c => c[1])]);
    const n = hp.getLastRow();
    if (n > 1 && hp.getRange(2, 2, n - 1, 1).getValues().some(r => r[0] === d.pid)) return json_({ ok: true, duplicado: true });
    const fecha = new Date();
    const tipo = d.tipo === 'real' ? 'real' : 'demo';
    const puntaje = sus.reduce((t, v, i) => t + (i % 2 === 0 ? v - 1 : 5 - v), 0) * 2.5;
    const mis = d.misiones.map(m => ({
      id: txt_(m.id, 4), hu: txt_(m.hu, 30), desc: txt_(m.mision, 200), ok: m.completada === true,
      t: num_(m.tiempo_s, 0, 36000), err: num_(m.errores, 0, 999), tip: m.pista === true
    }));
    hp.appendRow([fecha, d.pid, tipo, d.segmento, txt_(d.filtro, 2), txt_(d.edad, 10), txt_(d.uso, 30), txt_(d.distrito, 40),
      txt_(d.dispositivo, 12), num_(d.duracion_s, 0, 36000), ...sus, puntaje, mis.filter(m => m.ok).length + ' de ' + mis.length,
      txt_(d.comentario, 500), txt_(d.nombre, 60), txt_(d.contacto, 80)]);
    mis.forEach(m => hm.appendRow([fecha, d.pid, tipo, d.segmento, m.id, m.hu, m.desc, m.ok ? 'Completada' : 'No pudo', m.t, m.err, m.tip ? 'Sí' : 'No']));
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
  return json_({ actualizado: new Date().toISOString(), participantes: leer(HOJA_P, P_PUBLICO), misiones: leer(HOJA_M, M) });
}

/**
 * Crea (o rehace) el tablero de la validación (6.2) en dos pestañas:
 *  - "Resumen": tarjetas con los totales, avance por segmento y resultados por misión (con barras de color).
 *  - "Gráficos": participantes por segmento, resultado de las misiones, % por misión y SUS por segmento.
 * Son fórmulas: se actualiza solo con cada participante. Ejecutar a mano desde el editor cuando cambie el diseño.
 */
function crearResumen() {
  const ss = SpreadsheetApp.openById(HOJA_ID);
  hoja_(HOJA_P, P); hoja_(HOJA_M, M);
  ['Resumen', 'Gráficos'].forEach(n => { const v = ss.getSheetByName(n); if (v) ss.deleteSheet(v); });
  const C = { navy: '#14283C', orange: '#C4501A', green: '#2E7D5B', blue: '#2F6FB0', soft: '#F1F4F7', head: '#E4E9EF', muted: '#5F6E7E' };
  const h = ss.insertSheet('Resumen', 0);
  h.setHiddenGridlines(true);
  h.getRange('A1:J40').setFontFamily('Poppins').setVerticalAlignment('middle').setFontColor(C.navy);
  [150, 100, 250, 95, 110, 150, 90, 90, 110, 110].forEach((w, i) => h.setColumnWidth(i + 1, w));

  // Solo cuentan participantes reales; con la casilla J2 marcada también las demostraciones
  const okM = '((Misiones!$C$2:$C="real")+$J$2*(Misiones!$C$2:$C="demo"))';
  const okP = '((Participantes!$C$2:$C="real")+$J$2*(Participantes!$C$2:$C="demo"))';
  const bar = (cell, color, max) => '=IF(' + cell + '="","",SPARKLINE(' + cell + ',{"charttype","bar";"max",' + max + ';"color1","' + color + '"}))';
  const interp = cell => '=IF(' + cell + '="","",IFS(' + cell + '>=80.3,"Excelente",' + cell + '>=68,"Bueno",' + cell + '>=51,"Regular",TRUE,"Deficiente"))';
  const titulo = (a1, txt) => h.getRange(a1).merge().setValue(txt).setFontSize(13).setFontWeight('bold');
  const cab = a1 => h.getRange(a1).setFontWeight('bold').setBackground(C.head).setWrap(true).setHorizontalAlignment('center');

  // Encabezado
  h.getRange('A1:J1').merge().setValue('ZonaLimaSegura · Validación con usuarios').setBackground(C.navy).setFontColor('#FFFFFF')
    .setFontSize(18).setFontWeight('bold').setHorizontalAlignment('left');
  h.setRowHeight(1, 52);
  h.getRange('A2:H2').merge().setValue('Se actualiza sola con cada participante. Solo cuenta participantes reales.')
    .setFontColor(C.muted).setFontSize(9);
  h.getRange('I2').setValue('Incluir demo').setHorizontalAlignment('right').setFontColor(C.muted).setFontSize(9);
  h.getRange('J2').insertCheckboxes().setValue(false);

  // Fila de totales (segmentos) que alimenta las tarjetas: filas 10 a 13
  const segs = [['Residentes', 'residentes'], ['Brigadistas', 'brigadistas'], ['Adultos mayores', 'adultos']];
  const T = 13;

  // Tarjetas (filas 4 a 6)
  const tarjeta = (c1, c2, color, etiqueta, valor, formato, sub) => {
    const fila = n => { const r = h.getRange(c1 + n + ':' + c2 + n); return c1 === c2 ? r : r.merge(); };
    fila(4).setValue(etiqueta).setFontSize(9).setFontWeight('bold');
    fila(5).setFormula(valor).setNumberFormat(formato).setFontSize(24).setFontWeight('bold');
    fila(6).setFormula(sub).setFontSize(9);
    h.getRange(c1 + '4:' + c2 + '6').setBackground(color).setFontColor('#FFFFFF').setHorizontalAlignment('center');
  };
  tarjeta('A', 'B', C.navy, 'PARTICIPANTES', '=B' + T, '0', '="de 30 · meta 10 por segmento"');
  tarjeta('C', 'C', C.green, 'MISIONES COMPLETADAS', '=IF(E' + T + '="","—",E' + T + ')', '0%', '="de las misiones intentadas"');
  tarjeta('D', 'F', C.orange, 'SUS PROMEDIO (0 a 100)', '=IF(H' + T + '="","—",H' + T + ')', '0.0', '=IF(H' + T + '="","Aún sin respuestas",I' + T + ')');
  tarjeta('G', 'J', C.blue, 'TIEMPO PROMEDIO POR MISIÓN', '=IFERROR(SUMPRODUCT(' + okM + '*Misiones!$I$2:$I)/SUMPRODUCT(' + okM + '),"—")', '0" s"',
    '="Pistas usadas: "&SUMPRODUCT(' + okM + '*(Misiones!$K$2:$K="Sí"))');
  h.setRowHeight(5, 44);

  // Avance por segmento (filas 8 a 13)
  titulo('A8:J8', 'Avance por segmento');
  h.getRange('A9:J9').setValues([['Segmento', 'Participantes', 'Avance hacia la meta', 'Meta', '% misiones completadas', '', '"No pudo"', 'SUS promedio', 'Interpretación', '']]);
  h.getRange('E9:F9').merge(); h.getRange('I9:J9').merge();
  cab('A9:J9');
  segs.concat([['Total', '']]).forEach((s, i) => {
    const r = 10 + i;
    const sm = (s[1] ? '(Misiones!$D$2:$D="' + s[1] + '")*' : '') + okM;
    const sp = (s[1] ? '(Participantes!$D$2:$D="' + s[1] + '")*' : '') + okP;
    const meta = s[1] ? 10 : 30;
    h.getRange(r, 1).setValue(s[0]);
    h.getRange(r, 2, 1, 9).setFormulas([[
      '=SUMPRODUCT(' + sp + ')',
      '=SPARKLINE(MIN(1,B' + r + '/' + meta + '),{"charttype","bar";"max",1;"color1","' + C.orange + '";"color2","' + C.head + '"})',
      String(meta),
      '=IFERROR(SUMPRODUCT(' + sm + '*(Misiones!$H$2:$H="Completada"))/SUMPRODUCT(' + sm + '),"")',
      bar('E' + r, C.green, 1),
      '=SUMPRODUCT(' + sm + '*(Misiones!$H$2:$H="No pudo"))',
      '=IFERROR(SUMPRODUCT(' + sp + '*Participantes!$U$2:$U)/B' + r + ',"")',
      interp('H' + r),
      ''
    ]]);
    h.getRange(r, 9, 1, 2).merge();
  });
  h.getRange('A13:J13').setFontWeight('bold').setBorder(true, null, null, null, null, null, C.navy, SpreadsheetApp.BorderStyle.SOLID);

  // Resultados por misión (filas 15 a 28)
  titulo('A15:J15', 'Resultados por misión');
  h.getRange('A16:J16').setValues([['Segmento', 'Misión', 'Qué debía hacer', 'Intentos', '% completadas', '', '"No pudo"', 'Usó pista', 'Tiempo prom. (s)', 'Errores prom.']]);
  h.getRange('E16:F16').merge();
  cab('A16:J16');
  const mis = [
    ['Residentes', 'R1', 'Conocer el riesgo de su zona'], ['Residentes', 'R2', 'Revisar su vivienda'],
    ['Residentes', 'R3', 'Elegir su ruta de evacuación'], ['Residentes', 'R4', 'Ver su plan sin internet'],
    ['Brigadistas', 'B1', 'Avisar de una calle bloqueada'], ['Brigadistas', 'B2', 'Agregar un punto de reunión'],
    ['Brigadistas', 'B3', 'Validar una ruta de los vecinos'], ['Brigadistas', 'B4', 'Tener el mapa sin señal'],
    ['Adultos mayores', 'A1', 'Agrandar la letra'], ['Adultos mayores', 'A2', 'Encontrar una ruta sin escaleras'],
    ['Adultos mayores', 'A3', 'Registrar a un familiar'], ['Adultos mayores', 'A4', 'Avisar dónde está']
  ];
  h.getRange(17, 1, mis.length, 3).setValues(mis);
  h.getRange(17, 4, mis.length, 7).setFormulas(mis.map((m, i) => {
    const r = 17 + i, es = '(Misiones!$E$2:$E=$B' + r + ')*' + okM;
    return [
      '=SUMPRODUCT(' + es + ')',
      '=IF(D' + r + '=0,"",SUMPRODUCT(' + es + '*(Misiones!$H$2:$H="Completada"))/D' + r + ')',
      bar('E' + r, C.green, 1),
      '=IF(D' + r + '=0,"",SUMPRODUCT(' + es + '*(Misiones!$H$2:$H="No pudo")))',
      '=IF(D' + r + '=0,"",SUMPRODUCT(' + es + '*(Misiones!$K$2:$K="Sí")))',
      '=IF(D' + r + '=0,"",SUMPRODUCT(' + es + '*Misiones!$I$2:$I)/D' + r + ')',
      '=IF(D' + r + '=0,"",SUMPRODUCT(' + es + '*Misiones!$J$2:$J)/D' + r + ')'
    ];
  }));
  // Franjas suaves por segmento para leer la tabla de un vistazo
  [[17, '#FFFFFF'], [21, C.soft], [25, '#FFFFFF']].forEach(([r, c]) => h.getRange(r, 1, 4, 10).setBackground(c));
  h.getRange('A30:J30').merge().setValue('SUS: 80.3 o más = Excelente · 68 a 80.2 = Bueno (68 es el promedio mundial) · 51 a 67.9 = Regular · menos de 51 = Deficiente.')
    .setFontColor(C.muted).setFontSize(9);

  // Formatos
  h.getRange('E10:E13').setNumberFormat('0%'); h.getRange('E17:E28').setNumberFormat('0%');
  h.getRange('H10:H13').setNumberFormat('0.0'); h.getRange('I17:J28').setNumberFormat('0.0');
  h.getRange('B10:J13').setHorizontalAlignment('center'); h.getRange('B17:B28').setHorizontalAlignment('center');
  h.getRange('D17:J28').setHorizontalAlignment('center');
  h.getRange('A10:J13').setBorder(null, null, true, null, null, true, '#D3DBE3', SpreadsheetApp.BorderStyle.SOLID);
  h.getRange('A17:J28').setBorder(null, null, true, null, null, true, '#D3DBE3', SpreadsheetApp.BorderStyle.SOLID);
  for (let r = 10; r <= 28; r++) h.setRowHeight(r, 28);
  // Interpretación SUS en color
  const reglas = [['Excelente', '#D7EFE3', C.green], ['Bueno', '#DCE9F7', C.blue], ['Regular', '#FBE6DA', C.orange], ['Deficiente', '#F8D7D7', '#B42318']]
    .map(([t, bg, fg]) => SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(t).setBackground(bg).setFontColor(fg).setBold(true)
      .setRanges([h.getRange('I10:I13'), h.getRange('D6:F6')]).build());
  h.setConditionalFormatRules(reglas);
  h.setFrozenRows(2);

  // Pestaña de gráficos
  const g = ss.insertSheet('Gráficos', 1);
  g.setHiddenGridlines(true);
  g.getRange('A1:L1').merge().setValue('Gráficos de la validación').setBackground(C.navy).setFontColor('#FFFFFF')
    .setFontFamily('Poppins').setFontSize(18).setFontWeight('bold');
  g.setRowHeight(1, 52);
  // Datos de apoyo (columna A:B, abajo, para no estorbar)
  g.getRange('A40:B40').setValues([['Resultado', 'Misiones']]).setFontWeight('bold');
  g.getRange('A41:A42').setValues([['Completadas'], ['No pudo']]);
  g.getRange('B41:B42').setFormulas([['=SUMPRODUCT(' + okM.replace(/\$J\$2/g, 'Resumen!$J$2') + '*(Misiones!$H$2:$H="Completada"))'],
    ['=SUMPRODUCT(' + okM.replace(/\$J\$2/g, 'Resumen!$J$2') + '*(Misiones!$H$2:$H="No pudo"))']]);
  g.getRange('A40:B42').setFontColor(C.muted).setFontSize(9);
  for (let c = 1; c <= 12; c++) g.setColumnWidth(c, 100);
  const W = 560, H = 320;
  const graf = (b, fila, col) => g.insertChart(b.setOption('width', W).setOption('height', H).setOption('fontName', 'Poppins')
    .setOption('titleTextStyle', { fontSize: 14, bold: true, color: C.navy }).setPosition(fila, col, 0, 0).build());
  graf(g.newChart().setChartType(Charts.ChartType.PIE).addRange(ss.getRange('Resumen!A10:B12'))
    .setOption('title', 'Participantes por segmento').setOption('pieHole', 0.45)
    .setOption('colors', [C.orange, C.navy, C.blue]).setOption('legend', { position: 'right' }).setNumHeaders(0), 3, 1);
  graf(g.newChart().setChartType(Charts.ChartType.PIE).addRange(g.getRange('A41:B42'))
    .setOption('title', 'Resultado de todas las misiones').setOption('pieHole', 0.45)
    .setOption('colors', [C.green, '#B42318']).setOption('legend', { position: 'right' }).setNumHeaders(0), 3, 7);
  graf(g.newChart().setChartType(Charts.ChartType.COLUMN).addRange(ss.getRange('Resumen!B16:B28')).addRange(ss.getRange('Resumen!E16:E28'))
    .setOption('title', '% de personas que completó cada misión').setOption('legend', { position: 'none' }).setOption('colors', [C.green])
    .setOption('vAxis', { minValue: 0, maxValue: 1, format: 'percent' }).setNumHeaders(1), 20, 1);
  graf(g.newChart().setChartType(Charts.ChartType.COLUMN).addRange(ss.getRange('Resumen!A9:A12')).addRange(ss.getRange('Resumen!H9:H12'))
    .setOption('title', 'SUS promedio por segmento (68 = promedio)').setOption('legend', { position: 'none' }).setOption('colors', [C.orange])
    .setOption('vAxis', { minValue: 0, maxValue: 100 }).setNumHeaders(1), 20, 7);

  // Pestañas de datos: encabezado fijo y filas en franjas
  [hoja_(HOJA_P, P), hoja_(HOJA_M, M)].forEach(d => {
    d.getBandings().forEach(b => b.remove());
    d.getRange(1, 1, d.getMaxRows(), d.getLastColumn()).applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, true, false)
      .setHeaderRowColor(C.navy).setFirstRowColor('#FFFFFF').setSecondRowColor(C.soft);
    d.getRange(1, 1, 1, d.getLastColumn()).setFontColor('#FFFFFF').setFontWeight('bold');
    d.setFrozenRows(1);
  });
  ss.setActiveSheet(h);
}
