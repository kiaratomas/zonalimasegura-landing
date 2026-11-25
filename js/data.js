/* =========================================================
   ZonaLimaSegura · Datos de demostración
   Barrio esquemático usado en la Landing Page. Los valores
   son referenciales (no reemplazan una evaluación técnica).
   ========================================================= */
'use strict';

const ZLS_DATA = (() => {
  /* ---- Calles del barrio (coordenadas del mapa SVG 800 x 500) ---- */
  const MAP = { w: 800, h: 500, metersPerUnit: 1.2 };

  const STREETS = [
    { id: 'H1', name: 'Av. Los Pinos', dir: 'h', at: 120 },
    { id: 'H2', name: 'Jr. Las Flores', dir: 'h', at: 270 },
    { id: 'H3', name: 'Calle Central', dir: 'h', at: 420 },
    { id: 'V1', name: 'Jr. Huáscar', dir: 'v', at: 130 },
    { id: 'V2', name: 'Av. Grau', dir: 'v', at: 330 },
    { id: 'V3', name: 'Jr. Lampa', dir: 'v', at: 530 },
    { id: 'V4', name: 'Av. El Sol', dir: 'v', at: 700 }
  ];

  /* ---- Tipos de suelo (microzonificación simplificada · HU-03) ---- */
  const SOIL_ZONES = [
    {
      id: 'C', level: 3, x0: 0, x1: 230,
      name: 'Ladera y relleno',
      short: 'Suelo blando o de relleno',
      color: '#F26A1F',
      plain: 'Es tierra suelta o rellenada. Durante un sismo puede moverse más y hacer que tu casa se sacuda con más fuerza.',
      tips: ['Revisa que tu casa no esté construida sobre relleno sin compactar.', 'Ten lista tu ruta hacia una zona plana y abierta.']
    },
    {
      id: 'B', level: 2, x0: 230, x1: 610,
      name: 'Arena y limo',
      short: 'Suelo intermedio',
      color: '#14283C',
      plain: 'Es un suelo arenoso. El movimiento del sismo se siente con fuerza moderada; las casas con buena construcción resisten mejor.',
      tips: ['Haz el autodiagnóstico para revisar señales en tu vivienda.', 'Acuerda un punto de reunión con tu familia.']
    },
    {
      id: 'A', level: 1, x0: 610, x1: 800,
      name: 'Grava compacta',
      short: 'Suelo firme',
      color: '#8FA3B5',
      plain: 'Es un suelo firme, como el de la grava de Lima. El movimiento del sismo se amplifica menos.',
      tips: ['Aunque el suelo sea firme, una casa mal construida puede dañarse.', 'Mantén tu mochila de emergencia lista.']
    }
  ];

  const RISK_LEVELS = {
    1: { label: 'Nivel 1 · Bajo', title: 'Tu zona podría sentir un sismo moderado.', text: 'El suelo es firme y el movimiento se amplifica poco. Igual es importante preparar tu vivienda y a tu familia.' },
    2: { label: 'Nivel 2 · Medio', title: 'Tu zona podría sentir un sismo fuerte.', text: 'El suelo puede amplificar el movimiento. Revisa el estado de tu vivienda y define con tu familia por dónde evacuar.' },
    3: { label: 'Nivel 3 · Alto', title: 'Tu zona podría sentir un sismo muy fuerte.', text: 'El suelo es blando o de relleno y el movimiento puede ser mayor. Es prioritario revisar tu vivienda y conocer tu ruta de evacuación.' }
  };

  /* ---- Direcciones de ejemplo para ubicar la vivienda (HU-01) ---- */
  const ADDRESSES = [
    { id: 'd1', label: 'Jr. Las Flores 245', x: 430, y: 270 },
    { id: 'd2', label: 'Av. Los Pinos 120', x: 190, y: 120 },
    { id: 'd3', label: 'Jr. Huáscar 318', x: 130, y: 350 },
    { id: 'd4', label: 'Av. Grau 560', x: 330, y: 200 },
    { id: 'd5', label: 'Jr. Lampa 402', x: 530, y: 190 },
    { id: 'd6', label: 'Av. El Sol 150', x: 700, y: 200 },
    { id: 'd7', label: 'Calle Central 780', x: 640, y: 420 }
  ];
  const SECTOR = 'Sector demostrativo · San Juan de Lurigancho';

  /* ---- Puntos de reunión (HU-08 · HU-18) ---- */
  const PUNTOS = [
    { id: 'p1', name: 'Parque Zonal Norte', x: 752, y: 72, node: '700,120', capacity: 800, accessible: true, access: 'Ingreso con rampa y piso plano', type: 'Parque' },
    { id: 'p2', name: 'Losa deportiva Las Flores', x: 70, y: 66, node: '130,120', capacity: 300, accessible: false, access: 'Ingreso por escalinata de 12 peldaños', type: 'Losa deportiva' },
    { id: 'p3', name: 'Plaza Central', x: 392, y: 468, node: '330,420', capacity: 500, accessible: true, access: 'Plaza a nivel de vereda', type: 'Plaza' },
    { id: 'p4', name: 'Colegio San Martín', x: 600, y: 468, node: '530,420', capacity: 650, accessible: true, access: 'Portón amplio y patio plano', type: 'Colegio' }
  ];

  /* ---- Características de los tramos (accesibilidad · HU-36/37/38) ---- */
  // Clave: 'x1,y1|x2,y2' (ordenada). Se resuelve en map.js
  const EDGE_FEATURES = [
    { a: '130,120', b: '130,270', stairs: true, note: 'Escalera en ladera (Jr. Huáscar cdra. 2)' },
    { a: '0,120', b: '130,120', stairs: true, note: 'Pasaje con escalinata' },
    { a: '330,270', b: '530,270', slope: 'Rampa suave (Jr. Las Flores cdra. 4)' },
    { a: '530,120', b: '530,270', slope: 'Pendiente leve (Jr. Lampa cdra. 1)' },
    { a: '330,270', b: '330,420', obstacle: 'Poste en vereda (Av. Grau cdra. 3)' },
    { a: '530,120', b: '700,120', obstacle: 'Vereda angosta por comercio (Av. Los Pinos cdra. 6)' },
    { a: '130,270', b: '330,270', obstacle: 'Kiosco que reduce la vereda (Jr. Las Flores cdra. 2)' }
  ];

  /* ---- Estado inicial de vías, peligros y rutas comunitarias ---- */
  const BLOQUEOS = [
    { id: 'b1', a: '530,270', b: '530,420', reason: 'Cables caídos', date: '2026-11-20' }
  ];

  const PELIGROS = [
    { id: 'z1', type: 'Poste inclinado', x: 470, y: 340, desc: 'Poste de alumbrado inclinado con cables sueltos.', date: '2026-11-18' },
    { id: 'z2', type: 'Muro en mal estado', x: 200, y: 190, desc: 'Muro de contención con grietas en la ladera.', date: '2026-11-15' }
  ];

  const RUTAS_COM = [
    { id: 'r1', name: 'Ruta Av. Los Pinos', dest: 'p1', status: 'validada', desc: 'Recorrido principal hacia el parque.', points: [[250, 270], [330, 270], [330, 120], [700, 120], [752, 72]], validations: 2, updated: '2026-11-19' },
    { id: 'r2', name: 'Ruta Calle Central', dest: 'p3', status: 'pendiente', desc: 'Ruta propuesta por vecinos del sector bajo.', points: [[130, 420], [330, 420], [392, 468]], validations: 0, updated: '2026-11-22' },
    { id: 'r3', name: 'Ruta Jr. Lampa', dest: 'p4', status: 'revision', desc: 'Revisar: tramo con cables caídos.', points: [[530, 190], [530, 420], [600, 468]], validations: 1, updated: '2026-11-21' }
  ];

  /* ---- Autodiagnóstico visual (HU-04 · HU-05 · HU-06 · HU-07) ---- */
  const SENALES = [
    {
      id: 's1', img: 'senal-grietas.svg', q: '¿Ves grietas en los muros?', hint: 'Revisa las paredes de tu casa con calma, sobre todo cerca de puertas y ventanas.',
      example: 'Grietas en diagonal o en forma de “X” que atraviesan el muro. Las fisuras muy finas del tarrajeo son menos preocupantes.',
      alt: 'Muro de ladrillos con una grieta en zigzag marcada con un círculo naranja',
      rec: 'Pide a un ingeniero civil o a tu municipalidad que revise las grietas de tus muros.'
    },
    {
      id: 's2', img: 'senal-humedad.svg', q: '¿Hay humedad o salitre en la base de los muros?', hint: 'Mira la parte baja de las paredes, cerca del piso.',
      example: 'Manchas oscuras, pintura que se cae o polvo blanco (salitre) en la parte baja del muro.',
      alt: 'Parte baja de un muro con manchas de humedad marcadas con un círculo naranja',
      rec: 'Corrige filtraciones de agua: la humedad debilita el ladrillo y el fierro.'
    },
    {
      id: 's3', img: 'senal-fierro.svg', q: '¿Ves fierro expuesto u oxidado en columnas o vigas?', hint: 'Observa columnas, vigas y el techo.',
      example: 'Partes donde el concreto se cayó y se ven las varillas de fierro, a veces con óxido.',
      alt: 'Columna de concreto con varillas de fierro expuestas marcadas con un círculo naranja',
      rec: 'El fierro expuesto debe ser reparado por un especialista; no lo cubras solo con yeso.'
    },
    {
      id: 's4', img: 'senal-pisos.svg', q: '¿Tu casa tiene pisos agregados sin asesoría técnica?', hint: 'Piensa en ampliaciones hechas con el tiempo.',
      example: 'Pisos construidos después, sin planos ni ingeniero, o con fierros “en espera” en el techo.',
      alt: 'Casa de dos pisos con un tercer piso punteado sin terminar marcado con un círculo naranja',
      rec: 'Antes de construir otro piso, consulta a un profesional y tramita tu licencia.'
    },
    {
      id: 's5', img: 'senal-pandereta.svg', q: '¿Los muros que cargan el techo son de ladrillo pandereta?', hint: 'El ladrillo pandereta tiene huecos alargados a lo largo.',
      example: 'Ladrillos con agujeros horizontales. Son livianos y no deben usarse para muros que cargan peso.',
      alt: 'Muro de ladrillos pandereta con huecos horizontales marcado con un círculo naranja',
      rec: 'Consulta si tus muros portantes necesitan refuerzo: el ladrillo pandereta es frágil ante sismos.'
    },
    {
      id: 's6', img: 'senal-techo.svg', q: '¿El techo tiene fisuras o se ve hundido?', hint: 'Mira el techo desde distintos ángulos.',
      example: 'Techo que se ve curvado hacia abajo o con fisuras que crecen con el tiempo.',
      alt: 'Techo de concreto curvado con fisuras marcado con un círculo naranja',
      rec: 'Evita colocar peso extra sobre el techo y solicita una revisión técnica.'
    }
  ];

  const RECOMENDACIONES_BASE = [
    'Prepara una mochila de emergencia con agua, linterna, botiquín y documentos.',
    'Acuerda con tu familia un punto de reunión y una ruta de evacuación.',
    'Identifica las zonas seguras dentro de tu casa (columnas, lejos de ventanas).'
  ];

  const PARENTESCOS = ['Hijo o hija', 'Nieto o nieta', 'Esposo o esposa', 'Hermano o hermana', 'Sobrino o sobrina', 'Otro familiar'];

  return { MAP, STREETS, SOIL_ZONES, RISK_LEVELS, ADDRESSES, SECTOR, PUNTOS, EDGE_FEATURES, BLOQUEOS, PELIGROS, RUTAS_COM, SENALES, RECOMENDACIONES_BASE, PARENTESCOS };
})();
