# Reporte de migración y revisión de rúbrica — Easy Locker

- Fecha de revisión: 16 de noviembre de 2026
- Rama de trabajo: Segundo-avance
- Carpeta: Easy-Locker-main
- Base configurada y verificada: MongoDB Atlas
- Base de datos: easy_locker

## 1. Resultado general

Se migró el backend de consultas SQL directas con mysql2 a persistencia MongoDB mediante Mongoose. Se conservaron las páginas y el diseño de Easy Locker y se actualizó la autenticación para utilizar JWT.

La prueba automatizada final contra MongoDB Atlas terminó con estado APROBADO. Verificó conexión, autenticación, protección de rutas, lectura de las diez colecciones, ciclo CRUD, registro, reserva, pago simulado, historial, código de acceso, cuatro reportes y entrega de páginas HTML.

La revisión de código y las pruebas no equivalen todavía a una aprobación académica del 100 %. Quedan decisiones y entregables externos que se detallan en este documento.

## 2. Cambios realizados

- Sustitución de mysql2 y express-session por Mongoose y JWT.
- Diez modelos/colecciones: roles, facultades, usuarios, edificios, pisos, casilleros, planes, rentas, pagos y logs_sistema.
- Referencias ObjectId, validaciones de esquema, enums, campos requeridos e índices únicos/compuestos.
- Seed idempotente (npm run seed) que crea/verifica las diez colecciones, índices y datos base: 2 roles, 4 facultades, 6 edificios, 18 pisos, 864 casilleros y 2 planes. Se ejecuta por separado para que el backend no repita cientos de operaciones en cada inicio.
- Creación de cuenta administrativa local a partir de ADMIN_EMAIL y ADMIN_PASSWORD.
- Protección Bearer JWT de todas las rutas funcionales, excepto registro y login; las rutas de administración además verifican el rol.
- Validaciones de referencias y guardas de borrado en el backend.
- Conservación de registro, login, perfil, selección de casilleros, planes, reserva, pago simulado, historial y código de acceso demostrativo.
- Panel Admin.html con formularios CRUD dinámicos para las diez colecciones.
- Cuatro reportes de agregación MongoDB con cruces entre colecciones.
- Logs en la colección logs_sistema y en logs/backend.log para actividad, errores HTTP, inicio y cierre del backend y excepciones críticas.
- Configuración CORS, Helmet y límite de tamaño del JSON.
- README de instalación, ejecución y endpoints; archivo .env.example y reglas .gitignore.
- Suite CRUD adicional para las diez colecciones con pruebas negativas, permisos y borrados protegidos.
- Revisión automatizada en Edge de nueve páginas en escritorio/móvil, 18 capturas y verificación de diez formularios administrativos.
- PDF técnico/manual de 21 páginas con once capturas insertadas; fuente Markdown y HTML conservadas en docs/.
- Protección de archivos internos: /logs, /tests, /node_modules y /docs no se sirven por HTTP.

## 3. Pruebas ejecutadas

Comandos ejecutados correctamente:

~~~powershell
npm run seed  # inicialización de datos en Atlas
npm run check
npm test  # pruebas HTTP contra el backend conectado a Atlas
npm run test:crud  # CRUD de diez colecciones y pruebas negativas
~~~

Resultado de npm install: 0 vulnerabilidades reportadas por npm audit.

La prueba de integración final aprobó estos grupos:

1. Protección JWT de todas las rutas funcionales sin token.
2. Login administrativo, emisión de JWT y conexión MongoDB.
3. Lectura administrativa de las diez colecciones.
4. Ciclo administrativo POST, PUT y DELETE.
5. Consulta autenticada de casilleros y planes.
6. Registro, login y consulta protegida de perfil.
7. Reserva, pago simulado, historial y código de acceso.
8. Los cuatro reportes combinados devuelven datos.
9. Entrega de las páginas HTML principales.

Conteos de referencia observados durante la prueba:

| Colección / reporte | Registros de prueba |
|---|---:|
| roles | 2 |
| facultades | 4 |
| usuarios | 1 administrador |
| edificios | 6 |
| pisos | 18 |
| casilleros | 864 |
| planes | 2 |
| rentas | 0 al finalizar QA |
| pagos | 0 al finalizar QA |
| logs_sistema | Registros de actividad acumulados |
| Reporte de ocupación | 18 filas |
| Reporte de ingresos mensuales | 1 fila |
| Reporte de rentas por plan | 2 filas |
| Reporte de historial de rentas | 1 fila |

La renta y el pago usados para probar los reportes fueron temporales y se eliminaron al finalizar la prueba. Los reportes devolvieron datos antes de esa limpieza.

## 4. Matriz frente a los criterios del PDF

Esta matriz toma como base los requisitos del proyecto y de la entrega final descritos en las páginas 4, 5 y 6, así como la rúbrica de la entrega final de la página 13 del PDF FE-PW2-053-ABJ-AD2026 (1).

| Criterio del documento | Estado | Observación |
|---|---|---|
| Aplicación original y creativa | Implementado / conservar | Se conserva la identidad visual y la estructura de Easy Locker. La evaluación de originalidad corresponde al profesor. |
| Mínimo seis colecciones/tablas | Cumplido | La versión MongoDB define diez colecciones. |
| Interacción del backend mediante ORM | Pendiente de validar con el profesor | Se utiliza Mongoose, que técnicamente es un ODM para documentos MongoDB, no un ORM relacional. Debe confirmarse que el profesor acepta esta equivalencia. |
| Frontend sin conexión directa a la base de datos | Cumplido | El frontend consume rutas Express; no importa ni utiliza drivers de MongoDB. |
| Reportes con al menos cuatro consultas que combinen información | Cumplido en código y pruebas | Existen cuatro reportes con $lookup y agregaciones entre varias colecciones. Los cuatro devolvieron datos en la prueba integral. |
| Endpoints HTTP de creación, consulta, actualización y eliminación por entidad | Probado en diez colecciones | La suite adicional tests/crud-validation-test.js ejecutó POST, GET, PUT y DELETE para las diez colecciones con registros temporales, además de ocho borrados bloqueados por relaciones. |
| Validaciones independientes en el backend | Implementado y probado en casos representativos | Se probaron referencias inexistentes, campos obligatorios, contraseña corta, valores fuera de rango, estados inválidos, JSON inválido, duplicados, token inválido y acceso sin permisos. No implica cobertura exhaustiva de todos los campos. |
| Registro de excepciones y procesos críticos en archivo de logs | Implementado | El backend registra eventos en logs/backend.log y en logs_sistema. Se ha verificado la escritura de eventos de registro, login, renta y pago. Falta una prueba específica de parada/reinicio controlado que compruebe el evento BACKEND_STOP. |
| Pantallas CRUD por entidad | Implementado; inspección visual automatizada parcial | Se capturaron las nueve pantallas en escritorio y móvil (18 comprobaciones HTTP 200, sin errores JS ni desbordamiento horizontal) y se verificó en navegador la generación correcta de los diez formularios administrativos. Falta revisión humana de la experiencia y pruebas de interacción de todos los botones. |
| Comunicación Backend–Frontend por JSON | Cumplido | Los endpoints devuelven JSON y app.js consume la API. |
| Login y token para endpoints | Cumplido en la API | Registro y login son públicos; las demás rutas funcionales exigen Bearer JWT y las administrativas también requieren rol administrador. |
| Diseño con Material UI o equivalente | Parcial / requiere criterio del profesor | Se conserva la interfaz CSS existente y se mantiene su lenguaje visual. No se incorporó la biblioteca Material UI; debe confirmarse que el diseño actual se considera equivalente. |
| PDF de diseño técnico, endpoints y manual de usuario con capturas | Creado; revisión final pendiente | Se generó docs/DISENO-TECNICO-Y-MANUAL.pdf (21 páginas) con arquitectura, colecciones, relaciones, endpoints y manual de nueve pantallas con capturas reales. Faltan nombres/matrículas y revisión final del equipo. |
| Script SQL de tablas y relaciones para la entrega final | En conflicto con la migración MongoDB | Se conserva tablas y vistas.sql como referencia del esquema MySQL anterior. No es un script MongoDB. Debe preguntarse al profesor si acepta models.js + seed.js como artefacto equivalente o si requiere mantener/entregar también el SQL relacional. |
| README de GitHub con integrantes, aplicación, carpetas e instrucciones | Parcial | README.md contiene arquitectura, colecciones, instalación, comandos, páginas y rutas. Falta añadir nombres/matrículas del equipo y revisar que el documento final coincida con lo que se subirá. |
| Código fuente backend y frontend conectado | Implementado y probado | El servidor y las páginas trabajan mediante la API conectada a MongoDB Atlas; se aprobaron las pruebas de integración automatizadas. |
| Uso adecuado de Git/GitHub: commits, push y branches | Pendiente de entrega | Se trabajó sobre Segundo-avance, pero no se creó commit ni se hizo push. Esos pasos de colaboración deben realizarse por el equipo. |
| Hosting público | No requerido por la rúbrica de entrega final | La fila correspondiente aparece marcada como “No” en el documento. Atlas y hosting pueden configurarse para publicación, pero no los conté como requisito obligatorio. |

## 5. Pendientes para acercarse al 100 %

### Prioridad alta — confirmar con el profesor

1. Aceptación de Mongoose como ODM, dado que el documento usa expresamente el término ORM.
2. Resolver la exigencia de “Script de SQL” frente a la decisión de usar MongoDB. No debe presentarse tablas y vistas.sql como si inicializara MongoDB.
3. Confirmar que el panel administrativo único con formularios dinámicos satisface el requisito de pantallas CRUD por tabla/colección.

### Prioridad alta — entregables académicos

4. Revisar y aprobar el PDF ya generado en docs/DISENO-TECNICO-Y-MANUAL.pdf, incluyendo capturas y nombres del equipo.
5. Verificar que las capturas y el manual correspondan a la versión final que se entregará.
6. Completar README con nombres y matrículas de todos los integrantes.
7. Hacer commit y push de los cambios, y documentar la participación del equipo en GitHub.

### Prioridad media — validación y datos

8. Completar la inspección manual del flujo y la usabilidad: la revisión automatizada de nueve páginas en escritorio y móvil ya pasó.
9. Ampliar cobertura a escenarios límite específicos si el profesor los exige: el CRUD completo de las diez colecciones y los casos negativos representativos ya pasaron.
10. Probar el cierre controlado para verificar BACKEND_STOP en el archivo y la colección de logs.
11. Si la base MySQL anterior contiene usuarios, rentas o pagos que deban conservarse, hacer una exportación/importación controlada. Esta migración no importó datos transaccionales de MySQL; el seed crea estructura y datos maestros de demostración.
12. La conexión con MongoDB Atlas ya fue configurada y probada en el entorno de desarrollo. Para producción se deben usar un usuario, secretos y reglas de red propios del servidor de despliegue.

## 6. Notas importantes de configuración

- Base activa del proyecto: MongoDB Atlas, base easy_locker. MongoDB Community Server 9.0.8 permanece instalado en el equipo, pero el backend ya no lo utiliza como destino actual.
- El archivo .env.example contempla MONGODB_URI para Atlas. El archivo .env local contiene la URI privada y los secretos de desarrollo.
- En este equipo se configuró MONGODB_DNS_SERVERS=1.1.1.1,8.8.8.8 porque el resolutor DNS predeterminado rechazaba consultas SRV; la opción es local y puede omitirse en otras redes.
- El archivo .env real es local y está excluido de Git.
- Se agregó .gitignore y se retiraron del índice de Git el .env y node_modules, que no deben versionarse.
- Se creó respaldo previo a la migración en C:\Users\Leo\Downloads\Easy-Locker-backup-20261116.
- No se hicieron commits ni push.

## 7. Conclusión

La migración funcional a MongoDB Atlas está implementada; la prueba integral y la suite CRUD de las diez colecciones aprobaron. Se generó un PDF técnico/manual con capturas. No se puede afirmar que el proyecto ya cumple el 100 % de la rúbrica: siguen pendientes la aceptación docente de ODM/ORM y SQL, la revisión manual del documento/interfaz, los integrantes del equipo y la coordinación GitHub de la entrega final.
