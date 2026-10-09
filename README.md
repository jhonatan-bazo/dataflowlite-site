# DataFlow Lite — sitio de validación

Landing pública y demostración local de CSV para investigar la demanda de una herramienta de preparación de importaciones de inventario, ERP y POS.

## Abrir

- Página inicial: https://jhonatan-bazo.github.io/dataflowlite-site/.
- Demo de CSV: abre `demo.html` desde la landing.

## Estado y límites

- Prototipo comercial **en validación**. Todavía no hay un producto de escritorio disponible ni ventas.
- La demo admite **CSV hasta 5 MB** (UTF-8, Windows-1252 y UTF-16 con BOM), no XLSX; transforma tres campos a un esquema fijo de SKU, Nombre y Precio.
- Regla predeterminada: SKU único (sin distinguir mayúsculas); ante repetidos, bloquea **todas** las filas asociadas y permite exportar un CSV de errores.
- Casilla opcional «Permitir SKU repetidos si el nombre o el precio son diferentes»: admite variaciones con advertencia, pero sigue bloqueando duplicados idénticos y campos inválidos. La opción parte desactivada; úsala solo si tu ERP/POS admite múltiples filas por SKU.
- El CSV válido incluye las variaciones admitidas cuando se activa la opción. No realiza importaciones ni evita que el ERP/POS sobrescriba o rechace registros.
- Precio: coma o punto decimal, máximo dos decimales y **sin separadores de miles**. Los formatos ambiguos se rechazan.
- Cambiar el mapeo invalida las exportaciones hasta volver a validar. Se conserva la numeración física de líneas de CSV incluso si contiene saltos dentro de comillas.
- No conserva perfiles entre sesiones; no ejecuta cargas al ERP ni conexiones de red.
- El procesamiento de archivos ocurre en el navegador del usuario. No se recopilan ni almacenan archivos.
- El enlace de contacto utiliza `mailto:`; no existe formulario web ni lista automática.

- La demo identifica la versión **1.3** en la interfaz. Confirma el archivo cargado, muestra vista previa y limpia los encabezados tras errores; permite `sep=;` en CSV exportados desde Excel. Los archivos JavaScript usan parámetros de versión para evitar mezclar HTML actualizado con código cacheado. Al cambiar de modo, la pantalla muestra el modo activo y exige volver a validar.

## Desarrollo y pruebas

Es un sitio estático sin dependencias externas. Sirve `index.html`, `demo.html`, `logic.js` y `demo.js` desde cualquier hosting de archivos estáticos.

Para ejecutar las pruebas con Node.js (sin dependencias): `node test_logic.js` y `node test_demo.js`.

Además, `.github/workflows/quality.yml` ejecuta estas pruebas y una suite E2E de **Chromium real** (`tests/test_browser.py`) en cada push y PR. Pages despliega de forma independiente: verifica el resultado del flujo de calidad antes de distribuir una versión.

## Contacto

hola.dataflowlite@gmail.com. No envíes información comercial confidencial ni archivos de clientes.

Esta página presenta una propuesta de investigación, no una promesa de funciones disponibles.

## Hipótesis de precio inicial (Perú)

- Precio piloto en validación: **S/49 PEN, pago único** para una futura versión comercial que incluya CSV/XLSX y perfiles reutilizables.
- Segunda referencia a estudiar en entrevistas: **S/69 PEN**. Todavía no se ha validado la disposición a pagar.
- El sitio es una demo gratuita. **No habilitar checkout ni reservas** antes de construir y verificar el entregable comercial.
- La moneda de la licencia no determina la moneda de los campos CSV, que actualmente se interpretan sin símbolo monetario.

## Modo de validación general (1.4)

- La entrada principal de la demo es `general.html`, que conserva cualquier conjunto de columnas CSV de 1 o más campos.
- Reglas por columna: texto, entero, decimal, correo, fecha ISO, campo obligatorio y valor único.
- Opción para excluir filas completamente repetidas; sin inferencias automáticas de tipos ni obligatoriedad.
- Exporta todas las columnas originales en el CSV validado y un reporte de errores con las mismas columnas.
- El procesador específico `demo.html` continúa disponible como plantilla de inventario; conserva sus pruebas y comportamiento.
- La demo sigue siendo una prueba de concepto, no admite XLSX y no guarda perfiles.
