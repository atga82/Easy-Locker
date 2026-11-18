# Easy Locker — validaciones y tarjeta de prueba

Este cambio añade validaciones de nombre, apellidos, matrícula numérica (6 a 10 dígitos), correo y contraseña tanto en el navegador como en las rutas de registro/edición del servidor. Además ofrece un formulario de tarjeta **ficticia** en Pago.html.

## Seguridad
- No introducir datos de tarjetas reales. La demo utiliza 4242 4242 4242 4242, fecha futura y CVC inventado como ejemplos.
- Número, titular, vencimiento y CVC nunca se envían a la API. La petición de pago contiene exclusivamente `{}` y las entradas se limpian antes de solicitar la confirmación.
- El backend rechaza cualquier contenido extra en `/api/rentas/:id/pagar`; la tabla `pagos` conserva solo la renta, monto, fecha y el estado **simulado**.
- Las comprobaciones de tarjeta son **solo de formato**: 16 dígitos y algoritmo Luhn, fecha MM/AA sin vencer y CVC de 3 dígitos. No se verifica que una tarjeta real exista ni se cobra dinero.
- Para un cobro verdadero se requiere una pasarela de pagos certificada, HTTPS y cumplir requisitos PCI; **no** conectar tarjetas reales a este proyecto.

## Aplicar sin reemplazar tu proyecto
1. Guarda tus cambios con un commit o copia local antes de empezar.
2. Desde la raíz del repositorio, ejecuta `git apply --check "RUTA_AL_PARChe.patch"`; si no marca errores, `git apply "RUTA_AL_PARChe.patch"`.
3. Ejecuta `npm run check` y `npm run test:validaciones` (ambos sin conectar Atlas). Reinicia el servidor con `npm start`.
4. En `registro.html`, prueba nombres con números (debe rechazar), matrícula con letras (rechazar), matrícula numérica de 6 a 10 dígitos (aceptar), contraseñas cortas, correo inválido, duplicado de matrícula (mensaje de error).
5. En `cuenta.html`, edita los datos, verifica que matrícula con letras se rechaza. Nota: una cuenta antigua con matrícula alfanumérica requerirá corregirla para actualizar el perfil.
6. Reserva un casillero y ve a `Pago.html`. Prueba `4242 4242 4242 4243` (rechazo), `4242 4242 4242 4242`, fecha vencida (rechazo), fecha futura y CVC 123 (aceptar). Comprueba que no haya nuevos campos de tarjeta en `pagos`.
7. En herramientas de desarrollador > Network > POST `/api/rentas/:id/pagar`, revisa que el cuerpo de la petición sea `{}`. No se envían datos de tarjeta.

## Compatibilidad
- El cambio no borra bases de datos ni modifica rentas activas. No requiere `npm run seed` ni `npm run planes:update`.
- El correo se valida por formato, no se obliga un dominio universitario concreto para no romper pruebas o cuentas de otros dominios.
- `seed.js` mantiene el administrador con matrícula especial `ADMIN-001`. La validación de matrícula numérica se aplica a alumnos en registro y edición de perfil; no se alteran cuentas antiguas.
- La interfaz de tarjeta es ficticia, no hay verificación bancaria ni pago real.
