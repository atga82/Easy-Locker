# Easy Locker: actualización de planes (A3)

**Antes de comenzar:** verifica que estás en tu rama `ajustes-planes` y que `.env` sigue ignorado por Git. Haz copia/commit del estado funcional. Este paquete modifica código y NO incluye credenciales ni datos de Atlas.

## Cambios implementados

- Diario: $25, 1 casillero por compra, se permiten varias compras. Código independiente por renta.
- Mensual: $270, 1 casillero fijo durante 1 mes desde la activación, sin cambios.
- Semestral: $650 (precio existente), hasta **2 casilleros seleccionados en la misma compra**, 6 meses desde el pago; máximo 1 renta semestral activa o pendiente por usuario.
- Cambio semestral: reemplazar **uno** de los casilleros cada **7 días contados desde el último cambio**. Exige aceptación de aviso; el anterior se libera y su código deja de figurar.
- `Mi cuenta` y `casilleros.html`: muestran códigos **de todos los casilleros activos**, no solo uno.
- Avisos: se muestran **dentro de la aplicación al navegar**, en los 3 días previos a vencer y hasta 7 días después. **No** son mensajes por correo ni notificaciones cuando la web está cerrada.
- Historial y reporte administrativo de rentas muestran ambos casilleros, si existen. Los reportes monetarios cuentan **una renta y un pago por compra**, no dos pagos por el semestral.

## Instalación en tu propio GitHub

1. Haz una rama: `git switch -c ajustes-planes` (si no existe).
2. Aplica el parche con `git apply --check ruta/al/parche.patch` y luego `git apply ruta/al/parche.patch`. Si tu app.js fue modificado desde la versión base, el parche puede necesitar fusión manual.
3. Ejecuta `npm install`, `npm run check` y `npm run planes:update` una sola vez para insertar el mensual y actualizar los datos de los planes; **no borra rentas ni usuarios**.
4. Ejecuta `npm start` y entra a `http://localhost:3000`.
5. Prueba como estudiante nuevo: compra un diario; compra otro diario distinto; comprueba dos códigos; compra mensual; compra un semestral con dos casilleros y verifica dos códigos; intenta adquirir otro semestral (debe negarse); cambia uno (debe funcionar) e intenta otro inmediatamente (debe negarse).
6. Prueba panel admin: informe de ocupación, ingresos mensuales, rentas por plan e historial.
7. Solo entonces ejecuta `git status`, `git add ...`, `git commit` y `git push -u origin ajustes-planes`; pide fusionar con la rama principal a tus compañeros.

## Seguridad y limitaciones de esta versión académica

- El control semanal y los límites se validan **en el backend**, no solo en los botones.
- La restricción de un semestral se comprueba antes de crear la renta. Dos peticiones verdaderamente simultáneas podrían superar esa comprobación; para producción haría falta reforzarla mediante un índice/operación atómica.
- La reserva y el pago modifican varios documentos. Para producción conviene usar transacciones MongoDB y controles de concurrencia.
- El vencimiento se procesa cuando algún endpoint consulta las rentas; no hay un planificador externo ni aviso por correo.
- Los códigos y pagos son **simulados** y no controlan cerraduras físicas.
- El mensaje sobre pertenencias es **texto de prototipo**; la institución debe aprobar cualquier política real de retiro o responsabilidad.
- Planes que ya tenían rentas conservan sus registros: `casillero_extra` es opcional.
- Si ya hay rentas previas activas, no se modifican sus duraciones o precios automáticamente.
