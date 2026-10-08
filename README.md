# DataFlow Lite — sitio de validación

Landing pública y demostración local de CSV para investigar la demanda de una herramienta de preparación de importaciones de inventario, ERP y POS.

## Abrir

- Página inicial: https://jhonatan-bazo.github.io/dataflowlite-site/.
- Demo de CSV: abre `demo.html` desde la landing.

## Estado y límites

- Prototipo comercial **en validación**. Todavía no hay un producto de escritorio disponible ni ventas.
- La demo admite **CSV UTF-8 hasta 5 MB**, no XLSX; transforma tres campos a un esquema fijo de SKU, Nombre y Precio.
- Regla predeterminada: SKU único (sin distinguir mayúsculas); ante repetidos, bloquea **todas** las filas asociadas y permite exportar un CSV de errores.
- Casilla opcional «Permitir SKU repetidos si el nombre o el precio son diferentes»: admite variaciones con advertencia, pero sigue bloqueando duplicados idénticos y campos inválidos. La opción parte desactivada; úsala solo si tu ERP/POS admite múltiples filas por SKU.
- El CSV válido incluye las variaciones admitidas cuando se activa la opción. No realiza importaciones ni evita que el ERP/POS sobrescriba o rechace registros.
- Precio: coma o punto decimal, máximo dos decimales y **sin separadores de miles**. Los formatos ambiguos se rechazan.
- Cambiar el mapeo invalida las exportaciones hasta volver a validar. Se conserva la numeración física de líneas de CSV incluso si contiene saltos dentro de comillas.
- No conserva perfiles entre sesiones; no ejecuta cargas al ERP ni conexiones de red.
- El procesamiento de archivos ocurre en el navegador del usuario. No se recopilan ni almacenan archivos.
- El enlace de contacto utiliza `mailto:`; no existe formulario web ni lista automática.

## Desarrollo y pruebas

Es un sitio estático sin dependencias externas. Sirve `index.html`, `demo.html`, `logic.js` y `demo.js` desde cualquier hosting de archivos estáticos.

Para ejecutar las pruebas con Node.js (sin dependencias): `node test_logic.js` y `node test_demo.js`.

## Contacto

hola.dataflowlite@gmail.com. No envíes información comercial confidencial ni archivos de clientes.

Esta página presenta una propuesta de investigación, no una promesa de funciones disponibles.
