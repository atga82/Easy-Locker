# Easy Locker

Aplicación web para consultar y rentar casilleros universitarios. Esta versión utiliza Node.js, Express, MongoDB y Mongoose.

## Requisitos

- Node.js 20 o posterior.
- MongoDB Community Server (si se usa una base local) o MongoDB Atlas.
- npm.

## Instalación en Windows

1. Si vas a trabajar con una base local, instala e inicia MongoDB Community Server. Si usarás Atlas, puedes omitir este paso.
2. Abre PowerShell en la carpeta del proyecto e instala las dependencias:

~~~powershell
npm install
~~~

3. Crea el archivo de configuración local:

~~~powershell
Copy-Item .env.example .env
~~~

4. Edita .env y configura valores propios para JWT_SECRET, ACCESS_CODE_SECRET y ADMIN_PASSWORD. Usa secretos aleatorios de al menos 32 caracteres para las claves JWT y del código de acceso, y una contraseña administrativa de al menos 12 caracteres.
5. Configura MONGODB_URI con tu conexión local o con la URI privada de Atlas. Si tu DNS no puede resolver los registros SRV de Atlas, puedes añadir MONGODB_DNS_SERVERS=1.1.1.1,8.8.8.8 en .env; no es necesario en todas las redes.
6. Inicializa las colecciones y los datos base una vez:

~~~powershell
npm run seed
~~~

7. Inicia el servidor:

~~~powershell
npm start
~~~

La inicialización se ejecuta por separado para que el servidor no tenga que insertar cientos de registros cada vez que arranca. El seed es idempotente y puede volver a ejecutarse sin duplicar los registros maestros.

Abre http://localhost:3000 en el navegador.

## Cuenta administrativa de desarrollo

El seed crea una cuenta administrativa solo cuando ADMIN_EMAIL y ADMIN_PASSWORD están configurados y el correo todavía no existe.

- Usuario inicial de desarrollo: admin@easylocker.local
- Contraseña: el valor de ADMIN_PASSWORD guardado en el archivo local .env.

No publiques ni compartas .env. El archivo está excluido de Git.

## MongoDB Atlas

El backend puede trabajar tanto con MongoDB Community Server como con MongoDB Atlas. Para Atlas:

1. Crea un clúster y un usuario de base de datos con los permisos mínimos necesarios.
2. Añade a la lista de acceso de red la IP desde la que se conectará el backend.
3. Guarda la URI de conexión en la variable MONGODB_URI del archivo .env local.
4. Usa una base de datos llamada easy_locker para conservar los nombres esperados por la aplicación.
5. Mantén .env y atlas-credentials.env fuera de GitHub; ambos están excluidos en .gitignore.
6. En producción, configura la URI, CORS_ORIGIN y secretos independientes en las variables de entorno del servidor. No reutilices las credenciales de desarrollo.

En el entorno de desarrollo actual, la conexión a Atlas fue probada y los datos base se inicializaron en la base easy_locker. La configuración DNS alternativa se utiliza solo porque el resolutor DNS predeterminado de esta red rechaza las consultas SRV; puedes quitar MONGODB_DNS_SERVERS si la aplicación se ejecuta en una red que resuelva Atlas normalmente.

## Comandos

~~~powershell
npm install       # Instalar dependencias
npm run seed      # Crear/verificar colecciones y datos base
npm start         # Iniciar el servidor
npm run dev       # Reinicio automático durante desarrollo
npm run check     # Verificar sintaxis de los archivos JavaScript
npm test          # Ejecutar pruebas de integración contra MONGODB_URI
npm run test:crud # CRUD de las diez colecciones, validaciones y permisos
~~~

## Documentación y evidencias

- [Diseño técnico y manual de usuario (PDF)](docs/DISENO-TECNICO-Y-MANUAL.pdf): 21 páginas con arquitectura, colecciones, endpoints, instrucciones y capturas.
- [Manual editable en Markdown](docs/DISENO-TECNICO-Y-MANUAL.md).
- [Capturas de escritorio y móvil](docs/capturas/): nueve pantallas en dos tamaños.
- [Reporte de migración y rúbrica](REPORTE-MIGRACION-Y-RUBRICA.md).

**Integrantes del equipo:** pendiente de completar con nombres y matrículas oficiales antes de entregar.

## Colecciones de MongoDB

| Colección | Contenido |
|---|---|
| roles | Roles estudiante y administrador |
| facultades | Facultades disponibles |
| usuarios | Cuentas, referencias y hash de contraseña |
| edificios | Edificios por facultad |
| pisos | Pisos por edificio |
| casilleros | Inventario, posición y estado |
| planes | Planes de renta y precio |
| rentas | Reservas y periodos de renta |
| pagos | Pagos simulados y su estado |
| logs_sistema | Registro de actividad, advertencias y errores |

Los modelos están definidos en models.js; las referencias entre colecciones usan ObjectId y ref. La capa de persistencia se concentra en Mongoose, en el backend.

## Arquitectura y seguridad

- El navegador consume endpoints HTTP del backend; no se conecta directamente a MongoDB.
- La comunicación de la API utiliza JSON.
- Registro y login son los únicos endpoints funcionales sin JWT.
- Los demás endpoints requieren Authorization: Bearer token.
- Las operaciones administrativas requieren además que el usuario tenga el rol administrador.
- Las contraseñas se guardan como hash bcrypt.
- Las validaciones del backend se ejecutan además de las validaciones HTML del navegador.
- CORS restringe los orígenes según CORS_ORIGIN.
- Las excepciones y procesos importantes se guardan en la colección logs_sistema y en logs/backend.log.
- La reserva pendiente expira después de 15 minutos.
- El pago y el código de acceso son funciones de demostración; no procesan dinero real ni abren una cerradura física.

## Pantallas

- index.html: inicio.
- registro.html: registro.
- login.html: inicio de sesión.
- casilleros.html: búsqueda y selección de casilleros.
- planes.html: planes de renta.
- Pago.html: confirmación de pago simulado.
- cuenta.html: datos de usuario y acceso de demostración.
- Historial.html: historial de rentas.
- Admin.html: panel administrativo con formularios CRUD para las diez colecciones y cuatro reportes.

## API principal

| Método | Endpoint | Acceso |
|---|---|---|
| POST | /api/registro | Público |
| POST | /api/login | Público |
| POST | /api/logout | JWT |
| GET / PUT | /api/yo | JWT |
| GET | /api/estado | JWT |
| GET | /api/casilleros | JWT |
| GET | /api/planes | JWT |
| GET / POST | /api/rentas | JWT |
| POST | /api/rentas/:id/pagar | JWT |
| POST | /api/rentas/:id/cancelar | JWT |
| GET | /api/mi-acceso | JWT |
| GET | /api/admin/resumen | Administrador |
| GET | /api/admin/reportes/ocupacion | Administrador |
| GET | /api/admin/reportes/ingresos-mensuales | Administrador |
| GET | /api/admin/reportes/rentas-por-plan | Administrador |
| GET | /api/admin/reportes/historial-rentas | Administrador |
| GET / POST / PUT / DELETE | /api/admin/:resource[/:id] | Administrador |

resource acepta: roles, facultades, usuarios, edificios, pisos, casilleros, planes, rentas, pagos y logs.

## Base de datos anterior MySQL

tablas y vistas.sql se conserva como referencia del esquema MySQL anterior. No es un script de inicialización de MongoDB y no debe ejecutarse contra MongoDB. La creación de las colecciones y los datos de arranque de esta versión se realiza mediante models.js y seed.js.

La migración implementa la estructura y los datos maestros de demostración en MongoDB. No se importaron registros transaccionales de una instancia MySQL existente. Si se requiere conservar usuarios, rentas o pagos reales, debe hacerse una importación controlada desde esa instancia antes de publicar la aplicación.
