# Reservas para eventos

Aplicación web sencilla para cotizar y administrar reservas de sillas, mesas, decoración y entrega.

## Cómo abrir

1. Inicia un servidor local desde la carpeta `VIBE_5`, por ejemplo con `py -m http.server 8000`.
2. Abre `http://localhost:8000` en un navegador moderno. También puedes usar una extensión de servidor local en VS Code.
3. Completa los datos del evento y las cantidades para consultar el desglose de la cotización.
4. Usa el formulario de reserva y la tabla para administrar y consultar los registros.

La aplicación no requiere dependencias externas. El servidor local solo permite que el navegador cargue correctamente los módulos de JavaScript.

## Tecnologías

- HTML5 semántico
- CSS3 adaptable a pantallas pequeñas
- JavaScript Vanilla (módulos ES)
- `localStorage` del navegador

## Estructura

- `index.html`: formulario, cotización, disponibilidad y consulta de reservas.
- `css/styles.css`: estilos y diseño adaptable.
- `js/storage.js`: lectura y escritura persistente de las reservas.
- `js/calculations.js`: cálculos económicos y disponibilidad por fecha.
- `js/app.js`: interacciones, validación y renderizado de la aplicación.
- `docs/BITACORA.md`: bitácora para los momentos de trabajo.
- `docs/PRUEBAS.md`: registro de pruebas funcionales.

## Datos y privacidad

Las reservas viven únicamente en el `localStorage` del navegador y del origen desde el que se abre la aplicación. La clave utilizada es `mievento_reservas_v2`. Los datos no se envían a un servidor ni se sincronizan entre navegadores o dispositivos.

**Advertencia:** el almacenamiento puede borrarse al limpiar los datos del navegador, cambiar de navegador o dispositivo, o modificar el origen desde el que se abre el archivo. Exporta o respalda los datos por separado si necesitas conservarlos.
