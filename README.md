# DataFlow Lite — sitio de validación

Landing pública y demostración local de CSV para investigar la demanda de una herramienta de preparación de importaciones de inventario, ERP y POS.

## Abrir

- Página inicial: https://jhonatan-bazo.github.io/dataflowlite-site/ (cuando GitHub Pages esté habilitado).
- Demo de CSV: abre `demo.html` desde la landing.

## Estado y límites

- Prototipo comercial **en validación**. Todavía no hay un producto de escritorio disponible ni ventas.
- La demo admite **CSV UTF-8 hasta 5 MB**, no XLSX; transforma tres campos a un esquema fijo de SKU, Nombre y Precio.
- No conserva perfiles entre sesiones; no ejecuta cargas al ERP ni conexiones de red.
- El procesamiento de archivos ocurre en el navegador del usuario. No se recopilan ni almacenan archivos.
- El enlace de contacto utiliza `mailto:`; no existe formulario web ni lista automática.

## Desarrollo y pruebas

Es un sitio estático sin dependencias externas. Sirve `index.html`, `demo.html`, `logic.js` y `demo.js` desde cualquier hosting de archivos estáticos.

Para probar el parser en local con Node.js: `node test_logic.js`.

## Contacto

hola.dataflowlite@gmail.com. No envíes información comercial confidencial ni archivos de clientes.

Esta página presenta una propuesta de investigación, no una promesa de funciones disponibles.
