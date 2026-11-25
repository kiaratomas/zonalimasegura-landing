# Validación con usuarios (Capítulo VI · 6.2)

La Landing Page incluye un **modo validación** que guía a cada participante por 4 misiones de su segmento, detecta solo si las cumple, mide el tiempo y los errores, aplica el SUS y envía los resultados a una hoja de Google Sheets. El **tablero** muestra los resultados en vivo.

| Qué | Enlace |
|---|---|
| Prueba con usuarios | `pages/index.html?modo=prueba` (QR: `assets/images/qr-prueba.png`) |
| Demostración (no cuenta en los resultados) | `pages/index.html?modo=prueba&demo=1` (QR: `assets/images/qr-demo.png`) |
| Tablero en vivo | `pages/resultados.html` (`?demo=1` incluye las demostraciones) |

Sin `?modo=prueba` la página funciona exactamente igual que antes.

## Misiones

| Segmento | Misión | HU | Se cumple cuando… |
|---|---|---|---|
| Residentes | R1 Conocer el riesgo de su zona (Jr. Las Flores 245) | HU-01, HU-02 | Ubica la vivienda y ve el nivel de riesgo |
| | R2 Revisar su vivienda | HU-04 a HU-07 | Termina el autodiagnóstico |
| | R3 Acordar por dónde evacuar | HU-09, HU-10 | Elige una ruta como "mi ruta" |
| | R4 Ver su plan sin internet | HU-13 | Guarda el mapa sin conexión |
| Brigadistas | B1 Avisar de una calle bloqueada | HU-22 | Registra una vía bloqueada |
| | B2 Agregar un parque como punto de reunión | HU-18 | Registra un punto de reunión |
| | B3 Dejar lista una ruta revisada | HU-24 | Valida una ruta |
| | B4 Tener el mapa sin señal | HU-27 | Guarda el mapa para campo |
| Adultos mayores | A1 Leer mejor la página | HU-33 | Activa la letra grande |
| | A2 Encontrar una ruta sin escaleras | HU-35, HU-36, HU-39 | Abre el detalle de una ruta sin escaleras |
| | A3 Registrar a su nieta Rosa (912 345 678) | HU-42 | Guarda un familiar |
| | A4 Avisar dónde está | HU-43 | Comparte su ubicación |

Cada misión tiene el botón "No pude hacerlo". Los errores son los mensajes de validación que muestra la página durante la misión.

## Configurar la hoja (una sola vez)

1. Crear un proyecto en script.google.com (o desde la hoja: **Extensiones › Apps Script**) y poner en `HOJA_ID` el ID de la hoja (está en su URL).
2. Borrar el contenido de `Código.gs` y pegar `docs/validacion/apps-script.gs`. Guardar.
3. **Implementar › Nueva implementación › Aplicación web**: *Ejecutar como*: yo; *Quién tiene acceso*: cualquier persona. Autorizar con la cuenta del equipo.
4. Copiar la URL que termina en `/exec` y pegarla en `js/validacion-config.js`.

La hoja crea sola las pestañas **Participantes** (una fila por persona, con el SUS y su puntaje) y **Misiones** (una fila por misión). Las filas con Tipo = `demo` no cuentan en el informe.

## Datos y privacidad

No se piden nombres, correos ni teléfonos. El distrito es opcional. Cada participante recibe un código (por ejemplo, `P-4K7QZ`). En una estación de prueba compartida, el botón "Siguiente participante" borra los datos de la persona anterior.
