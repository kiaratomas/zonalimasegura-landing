/* =========================================================
   ZonaLimaSegura · Mapa del barrio (SVG) y cálculo de rutas
   - Grafo de calles y búsqueda de la ruta más corta (Dijkstra)
   - Dibujo accesible del mapa: cada elemento interactivo es
     enfocable con teclado y tiene nombre accesible.
   ========================================================= */
'use strict';

const ZLSMap = (() => {
  const D = ZLS_DATA;
  const NS = 'http://www.w3.org/2000/svg';
  const XS = D.STREETS.filter(s => s.dir === 'v').map(s => s.at);
  const YS = D.STREETS.filter(s => s.dir === 'h').map(s => s.at);

  const key = (x, y) => `${Math.round(x)},${Math.round(y)}`;
  const parse = k => k.split(',').map(Number);
  const edgeKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const toMeters = units => Math.round(units * D.MAP.metersPerUnit / 10) * 10;

  /* ---------- Grafo base ---------- */
  function baseGraph() {
    const adj = new Map();
    const edges = new Map();
    const addEdge = (a, b, street) => {
      const k = edgeKey(a, b);
      if (edges.has(k)) return;
      edges.set(k, { key: k, a, b, street, len: dist(parse(a), parse(b)) });
      if (!adj.has(a)) adj.set(a, new Set());
      if (!adj.has(b)) adj.set(b, new Set());
      adj.get(a).add(b); adj.get(b).add(a);
    };
    D.STREETS.forEach(s => {
      const stops = s.dir === 'h' ? [0, ...XS, D.MAP.w] : [0, ...YS, D.MAP.h];
      for (let i = 0; i < stops.length - 1; i++) {
        const a = s.dir === 'h' ? key(stops[i], s.at) : key(s.at, stops[i]);
        const b = s.dir === 'h' ? key(stops[i + 1], s.at) : key(s.at, stops[i + 1]);
        addEdge(a, b, s.id);
      }
    });
    return { adj, edges };
  }

  function features(edgeK) {
    const f = { stairs: false, slope: null, obstacle: null, note: null };
    D.EDGE_FEATURES.forEach(e => {
      if (edgeKey(e.a, e.b) === edgeK) Object.assign(f, { stairs: !!e.stairs, slope: e.slope || f.slope, obstacle: e.obstacle || f.obstacle, note: e.note || f.note });
    });
    return f;
  }

  /* Inserta la vivienda como nodo del grafo, dividiendo el tramo que la contiene. */
  function graphWithHome(home) {
    const g = baseGraph();
    const hk = key(home.x, home.y);
    if (g.adj.has(hk)) return { g, hk, splitFrom: null };
    for (const e of g.edges.values()) {
      const [ax, ay] = parse(e.a); const [bx, by] = parse(e.b);
      const onH = ay === by && ay === Math.round(home.y) && home.x > Math.min(ax, bx) && home.x < Math.max(ax, bx);
      const onV = ax === bx && ax === Math.round(home.x) && home.y > Math.min(ay, by) && home.y < Math.max(ay, by);
      if (onH || onV) {
        g.edges.delete(e.key);
        g.adj.get(e.a).delete(e.b); g.adj.get(e.b).delete(e.a);
        g.adj.set(hk, new Set([e.a, e.b]));
        g.adj.get(e.a).add(hk); g.adj.get(e.b).add(hk);
        [e.a, e.b].forEach(n => {
          const k = edgeKey(hk, n);
          g.edges.set(k, { key: k, a: hk, b: n, street: e.street, len: dist(parse(hk), parse(n)), parent: e.key });
        });
        return { g, hk, splitFrom: e.key };
      }
    }
    return { g, hk, splitFrom: null };
  }

  const parentKey = (g, k) => (g.edges.get(k) && g.edges.get(k).parent) || k;

  function dijkstra(g, start, target, opt = {}) {
    const blocked = opt.blocked || new Set();
    const penal = opt.penalize || new Set();
    const distM = new Map([[start, 0]]);
    const prev = new Map();
    const visited = new Set();
    while (true) {
      let u = null; let best = Infinity;
      distM.forEach((d, n) => { if (!visited.has(n) && d < best) { best = d; u = n; } });
      if (u === null) return null;
      if (u === target) break;
      visited.add(u);
      (g.adj.get(u) || []).forEach(v => {
        const ek = edgeKey(u, v);
        const pk = parentKey(g, ek);
        if (blocked.has(pk)) return;
        const f = features(pk);
        if (opt.avoidStairs && f.stairs) return;
        let w = g.edges.get(ek).len;
        if (penal.has(pk)) w *= 2.2;
        const nd = best + w;
        if (nd < (distM.has(v) ? distM.get(v) : Infinity)) { distM.set(v, nd); prev.set(v, u); }
      });
    }
    const path = [target];
    while (path[0] !== start) path.unshift(prev.get(path[0]));
    return path;
  }

  /* Calcula una ruta desde la vivienda hacia un punto de reunión. */
  function routeTo(home, punto, opt = {}) {
    if (!home) return null;
    const { g, hk } = graphWithHome(home);
    const blocked = new Set((opt.bloqueos || []).map(b => edgeKey(b.a, b.b)));
    const path = dijkstra(g, hk, punto.node, { blocked, avoidStairs: opt.avoidStairs, penalize: opt.penalize });
    if (!path) return null;
    const edgeKeys = [];
    let len = 0;
    const byStreet = {};
    for (let i = 0; i < path.length - 1; i++) {
      const ek = edgeKey(path[i], path[i + 1]);
      const e = g.edges.get(ek);
      len += e.len;
      byStreet[e.street] = (byStreet[e.street] || 0) + e.len;
      edgeKeys.push(parentKey(g, ek));
    }
    const points = path.map(parse);
    points.push([punto.x, punto.y]);
    len += dist(parse(punto.node), [punto.x, punto.y]);
    const main = Object.entries(byStreet).sort((a, b) => b[1] - a[1])[0];
    const street = main ? D.STREETS.find(s => s.id === main[0]).name : 'Calle local';
    const feats = edgeKeys.map(features);
    const slopes = []; const obstacles = [];
    edgeKeys.forEach((k, i) => {
      // Punto medio del tramo realmente recorrido (no del tramo completo)
      const a = parse(path[i]); const b = parse(path[i + 1]);
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (feats[i].slope) slopes.push({ text: feats[i].slope, at: mid });
      if (feats[i].obstacle) obstacles.push({ text: feats[i].obstacle, at: mid });
    });
    const meters = toMeters(len);
    return {
      key: `${punto.id}:${edgeKeys.join(';')}`,
      puntoId: punto.id, punto, points, edges: edgeKeys, meters, street,
      stairs: feats.some(f => f.stairs),
      stairsNotes: feats.filter(f => f.stairs).map(f => f.note),
      slopes, obstacles,
      minutes: Math.max(1, Math.round(meters / 75)),
      minutesSlow: Math.max(1, Math.round(meters / 40))
    };
  }

  /* Rutas hacia cada punto de reunión, ordenadas por distancia. */
  function routesFor(home, puntos, opt = {}) {
    return puntos
      .filter(p => !opt.onlyAccessiblePoints || p.accessible)
      .map(p => routeTo(home, p, opt))
      .filter(Boolean)
      .sort((a, b) => a.meters - b.meters);
  }

  /* Ajusta un punto a la calle más cercana (para ubicar la vivienda). */
  function snapToStreet(x, y) {
    let best = null;
    YS.forEach(sy => { const px = Math.min(Math.max(x, 10), D.MAP.w - 10); const d = Math.abs(y - sy); if (!best || d < best.d) best = { x: px, y: sy, d }; });
    XS.forEach(sx => { const py = Math.min(Math.max(y, 10), D.MAP.h - 10); const d = Math.abs(x - sx); if (!best || d < best.d) best = { x: sx, y: py, d }; });
    return { x: Math.round(best.x), y: Math.round(best.y) };
  }

  /* Tramo de calle más cercano (para marcar vías bloqueadas · HU-22). */
  function nearestEdge(x, y) {
    const g = baseGraph();
    let best = null;
    g.edges.forEach(e => {
      const [ax, ay] = parse(e.a); const [bx, by] = parse(e.b);
      const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
      const d = dist([x, y], [ax + t * (bx - ax), ay + t * (by - ay)]);
      if (!best || d < best.d) best = { d, e };
    });
    return best.e;
  }

  function allEdges() { return [...baseGraph().edges.values()]; }

  function edgeLabel(e) {
    const s = D.STREETS.find(st => st.id === e.street);
    const [a, b] = [parse(e.a), parse(e.b)];
    const cross = st => {
      const other = st.dir === 'h' ? D.STREETS.find(o => o.dir === 'v' && o.at === a[0]) : D.STREETS.find(o => o.dir === 'h' && o.at === a[1]);
      const other2 = st.dir === 'h' ? D.STREETS.find(o => o.dir === 'v' && o.at === b[0]) : D.STREETS.find(o => o.dir === 'h' && o.at === b[1]);
      const n1 = other ? other.name : 'inicio'; const n2 = other2 ? other2.name : 'final';
      return `entre ${n1} y ${n2}`;
    };
    return `${s.name} (${cross(s)})`;
  }

  function soilAt(x) { return D.SOIL_ZONES.find(z => x >= z.x0 && x < z.x1) || D.SOIL_ZONES[0]; }

  /* ---------- Dibujo ---------- */
  function el(name, attrs = {}, parent) {
    const n = document.createElementNS(NS, name);
    Object.entries(attrs).forEach(([k, v]) => { if (v !== undefined && v !== null) n.setAttribute(k, v); });
    if (parent) parent.appendChild(n);
    return n;
  }

  function makeInteractive(node, label, onActivate) {
    node.setAttribute('tabindex', '0');
    node.setAttribute('role', 'button');
    node.setAttribute('aria-label', label);
    node.classList.add('map-hit');
    const t = el('title', {}, node); t.textContent = label;
    node.addEventListener('click', e => { e.stopPropagation(); onActivate(); });
    node.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate(); } });
  }

  /**
   * Dibuja el mapa en un <svg>.
   * cfg: { title, soil, home, puntos, routes, peligros, bloqueos, rutasCom, layers, selected, onSelect, marks, pick, draft }
   */
  function draw(svg, cfg = {}) {
    const layers = Object.assign({ rutas: true, puntos: true, peligros: true, vias: true }, cfg.layers || {});
    svg.innerHTML = '';
    svg.setAttribute('viewBox', `0 0 ${D.MAP.w} ${D.MAP.h}`);
    svg.setAttribute('role', 'group');
    svg.setAttribute('aria-label', cfg.title || 'Mapa del barrio');
    const desc = el('desc', {}, svg);
    desc.textContent = 'Mapa esquemático del barrio. Los elementos del mapa también se listan en el panel junto al mapa.';

    el('rect', { x: 0, y: 0, width: D.MAP.w, height: D.MAP.h, fill: '#E4E9EF', rx: 18 }, svg);

    // Suelo (HU-03)
    if (cfg.soil) {
      const defs = el('defs', {}, svg);
      const pat = (id, d, color) => { const p = el('pattern', { id, width: 14, height: 14, patternUnits: 'userSpaceOnUse' }, defs); el('rect', { width: 14, height: 14, fill: color, opacity: .16 }, p); el('path', { d, stroke: color, 'stroke-width': 2, opacity: .45 }, p); };
      pat('soil-C', 'M0 14 14 0', '#F26A1F');
      pat('soil-B', 'M0 7h14', '#14283C');
      pat('soil-A', 'M7 0v14', '#5F6E7E');
      D.SOIL_ZONES.forEach(z => el('rect', { x: z.x0, y: 0, width: z.x1 - z.x0, height: D.MAP.h, fill: `url(#soil-${z.id})` }, svg));
    }

    // Manzanas y calles
    const blocks = el('g', { 'aria-hidden': 'true' }, svg);
    const xs = [0, ...XS, D.MAP.w]; const ys = [0, ...YS, D.MAP.h];
    for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < ys.length - 1; j++) {
      el('rect', { x: xs[i] + 12, y: ys[j] + 12, width: xs[i + 1] - xs[i] - 24, height: ys[j + 1] - ys[j] - 24, rx: 8, fill: cfg.soil ? 'rgba(255,255,255,.35)' : '#D9E0E8' }, blocks);
    }
    const streets = el('g', { 'aria-hidden': 'true' }, svg);
    D.STREETS.forEach(s => {
      if (s.dir === 'h') el('line', { x1: 0, y1: s.at, x2: D.MAP.w, y2: s.at, stroke: '#fff', 'stroke-width': 20 }, streets);
      else el('line', { x1: s.at, y1: 0, x2: s.at, y2: D.MAP.h, stroke: '#fff', 'stroke-width': 20 }, streets);
    });
    if (cfg.streetNames !== false) {
      D.STREETS.forEach(s => {
        const t = s.dir === 'h'
          ? el('text', { x: 18, y: s.at + 4, class: 'map-street' }, streets)
          : el('text', { x: s.at + 4, y: D.MAP.h - 18, class: 'map-street', transform: `rotate(-90 ${s.at + 4} ${D.MAP.h - 18})` }, streets);
        t.textContent = s.name;
      });
    }

    // Vías bloqueadas (HU-22)
    if (layers.vias && cfg.bloqueos) {
      const g = el('g', {}, svg);
      cfg.bloqueos.forEach(b => {
        const [a, c] = [parse(b.a), parse(b.b)];
        const grp = el('g', { class: 'map-block' + (cfg.selected === b.id ? ' is-selected' : '') }, g);
        el('line', { x1: a[0], y1: a[1], x2: c[0], y2: c[1], stroke: '#5F6E7E', 'stroke-width': 8, 'stroke-dasharray': '1 11', 'stroke-linecap': 'round' }, grp);
        const m = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
        el('circle', { cx: m[0], cy: m[1], r: 12, fill: '#fff', stroke: '#C4501A', 'stroke-width': 3 }, grp);
        el('path', { d: `M${m[0] - 5} ${m[1] - 5}l10 10M${m[0] + 5} ${m[1] - 5}l-10 10`, stroke: '#C4501A', 'stroke-width': 3, 'stroke-linecap': 'round' }, grp);
        if (cfg.onSelect) makeInteractive(grp, `Vía bloqueada: ${b.label || ''} ${b.reason}`, () => cfg.onSelect('bloqueo', b.id));
      });
    }

    // Rutas comunitarias (brigadista · HU-17/20/24/26)
    if (layers.rutas && cfg.rutasCom) {
      const g = el('g', {}, svg);
      cfg.rutasCom.forEach(r => {
        const grp = el('g', { class: 'map-route-com' + (cfg.selected === r.id ? ' is-selected' : '') }, g);
        const d = r.points.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ');
        el('path', { d, fill: 'none', stroke: 'transparent', 'stroke-width': 22 }, grp);
        el('path', { d, fill: 'none', stroke: '#14283C', 'stroke-width': cfg.selected === r.id ? 9 : 6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-dasharray': r.status === 'validada' ? null : '14 10' }, grp);
        if (cfg.onSelect) makeInteractive(grp, `Ruta ${r.name}, estado ${({ validada: 'validada', pendiente: 'pendiente de validación', revision: 'requiere revisión' })[r.status]}`, () => cfg.onSelect('ruta', r.id));
      });
    }

    // Rutas calculadas (residente / adulto mayor)
    if (cfg.routes) {
      const g = el('g', {}, svg);
      cfg.routes.forEach((r, idx) => {
        const grp = el('g', { class: 'map-route ' + (r.cls || '') }, g);
        const d = r.points.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ');
        el('path', { d, fill: 'none', stroke: r.cls === 'is-alt' ? '#C4501A' : '#14283C', 'stroke-width': r.cls === 'is-faded' ? 4 : 8, opacity: r.cls === 'is-faded' ? .45 : 1, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-dasharray': r.cls === 'is-alt' ? '16 10' : null }, grp);
        if (r.num) {
          const mid = r.points[Math.min(2, r.points.length - 2)];
          el('circle', { cx: mid[0], cy: mid[1], r: 13, fill: '#fff', stroke: '#14283C', 'stroke-width': 3 }, grp);
          const t = el('text', { x: mid[0], y: mid[1] + 5, class: 'map-num' }, grp); t.textContent = r.num;
        }
        if (cfg.onSelect && r.selectable) makeInteractive(grp, r.label || `Ruta ${idx + 1}`, () => cfg.onSelect('route', r.key));
      });
    }

    // Marcas de desniveles y obstáculos (HU-37/38)
    if (cfg.marks) {
      const g = el('g', {}, svg);
      cfg.marks.forEach((m, i) => {
        const grp = el('g', { class: 'map-mark' }, g);
        if (m.kind === 'slope') {
          el('path', { d: `M${m.at[0]} ${m.at[1] - 14}l13 22h-26z`, fill: '#C4501A', stroke: '#fff', 'stroke-width': 2 }, grp);
        } else {
          el('circle', { cx: m.at[0], cy: m.at[1], r: 12, fill: '#14283C', stroke: '#fff', 'stroke-width': 2 }, grp);
          const t = el('text', { x: m.at[0], y: m.at[1] + 4, class: 'map-num is-light' }, grp); t.textContent = m.n || i + 1;
        }
        const tt = el('title', {}, grp); tt.textContent = m.text;
      });
    }

    // Zonas de peligro (HU-19)
    if (layers.peligros && cfg.peligros) {
      const g = el('g', {}, svg);
      cfg.peligros.forEach(p => {
        const grp = el('g', { class: 'map-hazard' + (cfg.selected === p.id ? ' is-selected' : '') }, g);
        el('circle', { cx: p.x, cy: p.y, r: 22, fill: '#F26A1F', opacity: .18 }, grp);
        el('path', { d: `M${p.x} ${p.y - 14}l14 24h-28z`, fill: '#14283C', stroke: '#fff', 'stroke-width': 2, 'stroke-linejoin': 'round' }, grp);
        el('path', { d: `M${p.x} ${p.y - 5}v6`, stroke: '#fff', 'stroke-width': 2.5, 'stroke-linecap': 'round' }, grp);
        if (cfg.onSelect) makeInteractive(grp, `Zona de peligro: ${p.type}`, () => cfg.onSelect('peligro', p.id));
        else { const t = el('title', {}, grp); t.textContent = `Zona de peligro: ${p.type}`; }
      });
    }

    // Puntos de reunión (HU-08/18)
    if (layers.puntos && cfg.puntos) {
      const g = el('g', {}, svg);
      cfg.puntos.forEach(p => {
        const sel = cfg.selected === p.id || cfg.selectedPunto === p.id;
        const grp = el('g', { class: 'map-point' + (sel ? ' is-selected' : '') }, g);
        if (sel) el('circle', { cx: p.x, cy: p.y, r: 26, fill: '#F26A1F', opacity: .25 }, grp);
        el('rect', { x: p.x - 15, y: p.y - 15, width: 30, height: 30, rx: 7, fill: '#14283C', stroke: '#fff', 'stroke-width': 2.5 }, grp);
        el('path', { d: `M${p.x - 6} ${p.y}l4.5 4.5 8-8.5`, fill: 'none', stroke: '#fff', 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, grp);
        const label = `Punto de reunión: ${p.name}${p.accessible ? ', accesible' : ''}`;
        if (cfg.onSelect) makeInteractive(grp, label, () => cfg.onSelect('punto', p.id));
        else { const t = el('title', {}, grp); t.textContent = label; }
      });
    }

    // Borrador de ruta (registro brigadista)
    if (cfg.draft && cfg.draft.length) {
      const g = el('g', { 'aria-hidden': 'true' }, svg);
      if (cfg.draft.length > 1) el('path', { d: cfg.draft.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' '), fill: 'none', stroke: '#C4501A', 'stroke-width': 6, 'stroke-dasharray': '10 8', 'stroke-linecap': 'round' }, g);
      cfg.draft.forEach(p => el('circle', { cx: p[0], cy: p[1], r: 7, fill: '#fff', stroke: '#C4501A', 'stroke-width': 3 }, g));
    }

    // Vivienda
    if (cfg.home) {
      const g = el('g', { class: 'map-home' }, svg);
      el('circle', { cx: cfg.home.x, cy: cfg.home.y, r: 30, fill: '#F26A1F', opacity: .22 }, g);
      el('circle', { cx: cfg.home.x, cy: cfg.home.y, r: 19, fill: '#14283C', stroke: '#fff', 'stroke-width': 3 }, g);
      el('path', { d: `M${cfg.home.x - 8} ${cfg.home.y + 1}l8-7 8 7M${cfg.home.x - 5} ${cfg.home.y - 1}v8h10v-8`, fill: 'none', stroke: '#fff', 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
      const t = el('title', {}, g); t.textContent = 'Mi vivienda';
    }

    // Selector de posición (modo "marcar en el mapa")
    if (cfg.pick) {
      const g = el('g', { class: 'map-pick', 'aria-hidden': 'true' }, svg);
      el('circle', { cx: cfg.pick.x, cy: cfg.pick.y, r: 16, fill: 'none', stroke: '#C4501A', 'stroke-width': 3 }, g);
      el('path', { d: `M${cfg.pick.x} ${cfg.pick.y - 26}v14M${cfg.pick.x} ${cfg.pick.y + 12}v14M${cfg.pick.x - 26} ${cfg.pick.y}h14M${cfg.pick.x + 12} ${cfg.pick.y}h14`, stroke: '#C4501A', 'stroke-width': 3, 'stroke-linecap': 'round' }, g);
    }
  }

  /* Convierte un clic en coordenadas del mapa. */
  function svgPoint(svg, evt) {
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { x: Math.max(0, Math.min(D.MAP.w, Math.round(p.x))), y: Math.max(0, Math.min(D.MAP.h, Math.round(p.y))) };
  }

  return { routeTo, routesFor, snapToStreet, nearestEdge, allEdges, edgeLabel, edgeKey, soilAt, draw, svgPoint, toMeters };
})();
