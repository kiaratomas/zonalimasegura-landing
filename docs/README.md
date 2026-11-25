# ZonaLimaSegura · Landing Page

Landing Page responsive de **ZonaLimaSegura**, startup que ayuda a las familias de Lima Metropolitana y el Callao a prepararse ante un sismo de gran magnitud: conocer el riesgo de su zona, revisar su vivienda con un autodiagnóstico visual y planificar su evacuación.

Proyecto del curso **HCI for UX Design (1ASI0784)** · UPC · ciclo 2026-20 · NRC 15340.

- **Sitio publicado (GitHub Pages):** https://kiaratomas.github.io/zonalimasegura-landing/
- **Repositorio:** https://github.com/kiaratomas/zonalimasegura-landing
- **Diseño de referencia (Figma):** prototipo web `WEB-TP` y prototipo móvil `APP-TP` del TB1.

## Tecnologías

- HTML5 semántico, CSS3 (Grid, Flexbox, media queries) y JavaScript sin frameworks.
- Mapa del barrio dibujado en SVG desde JavaScript, con cálculo de rutas (algoritmo de Dijkstra) sobre el grafo de calles.
- `localStorage` para guardar la información del usuario y un *Service Worker* con Cache API para usar la página sin conexión.
- Tipografía Poppins alojada en el propio repositorio (`assets/fonts`).

## Estructura del repositorio

```
zonalimasegura-landing/
├── assets/
│   ├── fonts/        Poppins 400, 500, 600 y 700 (woff2) + licencia OFL
│   ├── icons/        sprite.svg con los íconos de la guía de estilos
│   └── images/       logo, ilustración principal y señales del autodiagnóstico (SVG)
├── css/
│   └── styles.css    estilos y adaptación responsive (Desktop, Tablet y Mobile)
├── js/
│   ├── data.js       datos de demostración (calles, suelos, puntos, rutas, señales)
│   ├── map.js        grafo de calles, cálculo de rutas y dibujo accesible del mapa
│   └── main.js       interacciones de las 30 Historias de Usuario
├── pages/
│   ├── index.html    página principal de la Landing Page
│   └── sw.js         Service Worker para el uso sin conexión
├── docs/
│   └── README.md     este documento
├── favicon.ico
├── index.html        redirección a pages/index.html (raíz de GitHub Pages)
└── .gitignore
```

## Historias de Usuario implementadas (30 HU core)

| Segmento | HU | Nombre | Sección de la Landing | Interacción implementada |
|---|---|---|---|---|
| Residente | HU-01 | Ubicación de la vivienda | Residentes › Mi zona | Búsqueda con validación, uso de la ubicación del dispositivo y marcado en el mapa (mouse o teclado) |
| Residente | HU-02 | Nivel de riesgo de la zona | Residentes › Mi zona | Escala de 3 niveles con número, texto y color según la ubicación |
| Residente | HU-03 | Microzonificación simplificada | Residentes › Mi zona | Capa de suelo activable en el mapa, leyenda y explicación "¿Qué significa?" |
| Residente | HU-04 | Inicio del autodiagnóstico | Residentes › Autodiagnóstico | Inicio guiado, paso a paso con barra de progreso |
| Residente | HU-05 | Señales de vulnerabilidad | Residentes › Autodiagnóstico | Catálogo de 6 señales ilustradas y "Ver ejemplo de la señal" |
| Residente | HU-06 | Resultado del autodiagnóstico | Residentes › Autodiagnóstico | Cálculo del resultado (3 niveles) y resumen de respuestas |
| Residente | HU-07 | Recomendaciones de preparación | Residentes › Autodiagnóstico | Recomendaciones según las respuestas y el tipo de suelo |
| Residente | HU-08 | Puntos de reunión | Residentes › Mapa y rutas | Lista por distancia, capacidad y accesibilidad; "Elegir como mi punto" |
| Residente | HU-09 | Rutas de evacuación | Residentes › Mapa y rutas | 3 rutas calculadas desde la vivienda, evitando vías bloqueadas |
| Residente | HU-10 | Selección de una ruta | Residentes › Mapa y rutas | Detalle con distancia, tiempo e indicaciones; "Elegir como mi ruta" |
| Residente | HU-13 | Mapa sin conexión | Residentes › Mapa y rutas | Guardado con progreso, caché del Service Worker y aviso "Sin conexión" |
| Residente | HU-15 | Plan familiar | Residentes › Mi plan familiar | Resumen de vivienda, riesgo, punto, ruta, autodiagnóstico y contacto; impresión |
| Brigadista | HU-17 | Registro de rutas | Brigadistas › Registrar | Trazado de la ruta en el mapa y formulario validado |
| Brigadista | HU-18 | Registro de puntos de reunión | Brigadistas › Registrar | Ubicación en el mapa, capacidad y accesibilidad validadas |
| Brigadista | HU-19 | Registro de zonas de peligro | Brigadistas › Registrar | Ubicación en el mapa y tipo de peligro |
| Brigadista | HU-20 | Actualización de rutas | Brigadistas › Mapa / Gestión | Edición en diálogo con validación y confirmación |
| Brigadista | HU-22 | Registro de vías bloqueadas | Brigadistas › Registrar | Selección del tramo (lista o mapa); las rutas de los vecinos lo evitan |
| Brigadista | HU-24 | Validación de rutas | Brigadistas › Gestión y validación | Lista de verificación obligatoria; validar o marcar para revisión |
| Brigadista | HU-26 | Mapa centralizado | Brigadistas › Mapa de la zona | Filtros por capa, leyenda, lista de elementos y detalle |
| Brigadista | HU-27 | Rutas sin conexión | Brigadistas › Mapa de la zona | "Mapa para campo" guardado para usar sin conexión |
| Adulto mayor | HU-33 | Letra grande | Cabecera y Adultos mayores › Inicio | 3 tamaños de letra para toda la página, recordados en el dispositivo |
| Adulto mayor | HU-34 | Navegación sencilla | Adultos mayores › Inicio | Tarjetas grandes con texto e ícono, pestañas simples |
| Adulto mayor | HU-35 | Rutas accesibles | Adultos mayores › Rutas accesibles | Rutas con su accesibilidad (escaleras y punto de destino) |
| Adulto mayor | HU-36 | Filtro sin escaleras | Adultos mayores › Rutas accesibles | Interruptor de filtro y estado vacío "Sin resultados" |
| Adulto mayor | HU-39 | Selección de ruta accesible | Adultos mayores › Rutas accesibles | Detalle con desniveles y obstáculos marcados en el mapa |
| Adulto mayor | HU-40 | Ruta alternativa accesible | Adultos mayores › Rutas accesibles | Comparación con la ruta actual y opción de elegirla |
| Adulto mayor | HU-41 | Ruta accesible sin conexión | Adultos mayores › Rutas accesibles | Guardado de la ruta para usarla sin internet |
| Adulto mayor | HU-42 | Registro de familiar de apoyo | Adultos mayores › Mis apoyos | Formulario validado (nombre, parentesco, celular de 9 dígitos) |
| Adulto mayor | HU-43 | Compartir ubicación | Adultos mayores › Mis apoyos | Ubicación del dispositivo, mensaje, enlace de WhatsApp y copiar |
| Adulto mayor | HU-48 | Acceso rápido a la evacuación | Adultos mayores › Inicio | Accesos directos a "Mi ruta", punto de reunión, apoyos y compartir |

## Accesibilidad

- Contraste AA: textos en azul marino `#14283C` (15:1) y botones principales en naranja de acción `#C4501A` con texto blanco (4.66:1). El naranja de marca `#F26A1F` se reserva para bordes, selección y acentos.
- Estructura semántica (`header`, `nav`, `main`, `section`, `footer`), enlace "Saltar al contenido" y títulos jerárquicos.
- Pestañas con roles ARIA y navegación con flechas, diálogos nativos (`<dialog>`) y mensajes en regiones `aria-live`.
- Todos los formularios tienen etiquetas visibles, mensajes de error asociados (`aria-describedby`, `aria-invalid`) y foco en el primer campo con error.
- Los elementos del mapa son enfocables con Tab y se activan con Enter; el marcado en el mapa también funciona con las flechas del teclado. Cada mapa tiene una lista equivalente en texto.
- Textos alternativos en imágenes, íconos siempre acompañados de texto, áreas táctiles de 44 px o más y respeto de `prefers-reduced-motion`.
- Verificado con axe-core (WCAG 2.1 A/AA): 0 incumplimientos.

## Cómo ejecutarlo localmente

El Service Worker solo funciona con un servidor HTTP:

```bash
python3 -m http.server 8000
```

Luego abre `http://localhost:8000/pages/index.html`.

## Datos de demostración

El mapa, las direcciones, los niveles de riesgo y las rutas corresponden a un **sector esquemático de demostración**. La información se basa de forma simplificada en el Mapa de Microzonificación Sísmica del CISMID y no reemplaza una evaluación técnica ni la información oficial.

## Equipo

- Lescano Pajuelo, Stephano Jhamill
- Quispe Perez, Karin Mirella
- Ramos Loayza, Sergio Daniel
- Reyes Trujillo, Yery Benjamin
- Rodriguez Diaz, Marcelo Fabian
- Tomas Bautista, Kiara Alexandra
