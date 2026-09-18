# Códigos

Aplicación web personal (PWA) para iPhone y iPad: lee, crea, organiza, exporta e imprime códigos QR y códigos de barras. Sin publicidad, sin cuentas, sin rastreadores. Todo el procesamiento ocurre en el dispositivo.

## Instalación en iPhone / iPad

1. Abre la URL publicada en Safari.
2. Compartir (□↑) → **Añadir a pantalla de inicio**.
3. Al abrir desde el icono funciona a pantalla completa y sin conexión (la cámara requiere HTTPS, por eso se sirve desde GitHub Pages).

## Funciones

**Escanear** — cámara en tiempo real (nativo `BarcodeDetector` con respaldo ZXing), linterna, zoom, toque para enfocar, pausa, lectura continua, selección cuando hay varios códigos, lectura desde Fotos/Archivos/portapapeles, ingreso manual. Formatos: QR, Data Matrix, PDF417, Aztec, EAN-13/8, UPC-A/E, Code 128/39/93, ITF, Codabar.

**Resultado seguro** — muestra tipo y contenido exacto antes de actuar; verifica dígito verificador; advierte enlaces acortados, http, IP, homógrafos; nunca ejecuta acciones automáticamente (abrir enlace, llamar, correo, SMS, mapa, Wi-Fi, contacto .vcf, evento .ics, búsqueda de producto) — cada una pide confirmación y muestra el dominio completo.

**Crear 2D** — QR, Data Matrix, PDF417 y Aztec. Texto, enlace, Wi-Fi, contacto, teléfono, correo, SMS, ubicación, evento, app, ficha, personalizado. Colores, fondo transparente, forma de módulos, corrección de errores, margen, tamaño, título, contenido bajo el código, logo central. Verificación de legibilidad (decodifica lo generado). Exporta PNG, SVG, PDF/impresión, copiar, compartir.

**Crear código de barras** — EAN-13, EAN-8, UPC-A, UPC-E, Code 128, Code 39, ITF, ITF-14, Codabar, MSI, Pharmacode. Validación de longitud y caracteres, cálculo y comprobación de dígito verificador con corrección sugerida, ancho/alto/margen/orientación/color, texto legible.

**Biblioteca** — leídos, creados, favoritos, papelera con recuperación y vaciado automático opcional; carpetas, etiquetas, notas, renombrar; búsqueda y filtros; orden por fecha/nombre/formato/uso; selección múltiple (etiquetar, mover, favoritos, hoja imprimible, CSV, eliminar); duplicar y editar con historial de versiones; detección y limpieza de duplicados; respaldo JSON (cifrado AES-256 opcional) y restauración; exportación CSV.

**Lotes** — lista pegada o importada (CSV/TXT, `contenido | título`), generación masiva QR o barras, informe de correctos/duplicados/errores, guardado con carpeta y etiquetas, hoja imprimible con columnas/filas/copias/papel/márgenes, lectura de varios códigos en varias imágenes.

**Herramientas** — identificar contenido, dígito verificador, convertir formato, comparar dos códigos, comprobar legibilidad, hoja de etiquetas, limpiar duplicados, exportar todo, estadísticas locales, guía de formatos.

**Privacidad** — bloqueo por PIN, ocultación en apps recientes, registro de acciones opcional, control independiente de historiales, borrado total. Solo requieren internet: abrir enlaces, buscar identificadores y mapas.

## Estructura

`index.html` · `idb.js` (IndexedDB) · `decode-core.js` + `worker.js` (decodificación ZXing en Web Worker) · `core.js` (estado, ajustes, UI) · `codes.js` (formatos, validación, interpretación, generación, decodificación) · `scan.js` · `create.js` (incluye impresión) · `lib.js` · `batch.js` · `tools.js` · `sw.js` · `vendor/` (qrcode-generator, JsBarcode, ZXing, bwip-js — locales, sin CDN; bwip-js se carga solo al generar Data Matrix/PDF417/Aztec).
