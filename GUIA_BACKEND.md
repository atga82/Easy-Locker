# 📦 Guía del Backend y Configuración con MongoDB — Easy Locker

## 1. ¿Qué hay en este proyecto?

**Easy Locker** es una plataforma universitaria para la reserva y gestión de casilleros (lockers) por facultad, edificio y piso.

### Frontend (Interfaz de usuario)
- **HTMLs**: `index.html`, `login.html`, `registro.html`, `casilleros.html`, `planes.html`, `Pago.html`, `Historial.html`, `cuenta.html`, `Admin.html`.
- **CSS**: `estilos.css` (diseño visual y responsivo).
- **JavaScript del Cliente**: `app.js` (se ejecuta en el navegador del usuario y se comunica con la API mediante peticiones `fetch`).

### ¿Por qué te dijeron que "solo era front"?
1. Si abrías los archivos `.html` haciendo doble clic desde el explorador de Windows (`file:///...`), el navegador bloqueaba las llamadas de red o no había ningún servidor respondiendo.
2. Originalmente existía un intento de servidor en un solo archivo minificado que requería **MySQL** (`mysql2`) con un script relacional `tablas y vistas.sql`.
3. El archivo `.env` estaba completamente vacío (0 bytes), MySQL no estaba corriendo ni conectado, y faltaban módulos de dependencias en `node_modules` (como `express-session`).

---

## 2. Nueva Arquitectura del Backend Real

Hemos transformado el backend en una arquitectura limpia, modular y profesional organizada por capas:

```
Easy-Locker/
│
├── config/
│   └── db.js                 # Conexión resiliente a MongoDB mediante Mongoose
│
├── models/                   # Modelos de datos NoSQL (Mongoose)
│   ├── Usuario.js            # Alumnos y administradores (con contraseñas encriptadas)
│   ├── Casillero.js          # Ubicación (facultad, edificio, piso), número, fila, columna y estado
│   ├── Plan.js               # Planes de renta (Diario, Semestral)
│   ├── Renta.js              # Rentas asociadas a usuarios y casilleros, fechas y estados
│   └── Pago.js               # Comprobantes y transacciones simuladas
│
├── routes/                   # Endpoints y controladores de la API REST
│   ├── authRoutes.js         # Registro, Login, Logout, Perfil (/api/yo)
│   ├── casilleroRoutes.js    # Consulta de disponibilidad con limpieza de reservas expiradas
│   ├── planRoutes.js         # Consulta de planes activos
│   ├── rentaRoutes.js        # Creación de reservas, pagos simulados, cancelación y código de acceso
│   └── adminRoutes.js        # Indicadores para el panel de administración
│
├── middlewares/
│   └── auth.js               # Protección de rutas por sesión y rol de administrador
│
├── utils/
│   └── seeder.js             # Sembrador automático de datos iniciales
│
├── .env                      # Variables de entorno (puerto, URL de MongoDB, secretos)
├── .env.example              # Plantilla documentada de variables de entorno
├── app.js                    # Cliente JS adaptado para soportar identificadores de MongoDB
└── server.js                 # Servidor principal Express
```

---

## 3. Preparación y Uso de MongoDB

### Opción A: Usar MongoDB Atlas (Recomendado - Gratis en la nube)
No necesitas instalar nada en tu computadora:
1. Crea una cuenta gratuita en [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Crea un clúster gratuito (*M0 Sandbox*).
3. En **Database Access**, crea un usuario y contraseña.
4. En **Network Access**, agrega la IP `0.0.0.0/0` (permitir acceso desde cualquier lugar).
5. Dale a **Connect** > **Drivers** y copia la cadena de conexión.
6. Pégala en tu archivo `.env`:
   ```env
   MONGODB_URI=mongodb+srv://tu_usuario:tu_password@cluster0.mongodb.net/easy_locker?retryWrites=true&w=majority
   ```

### Opción B: Usar MongoDB Local
1. Descarga e instala [MongoDB Community Server](https://www.mongodb.com/try/download/community) para Windows.
2. Inicia el servicio local de MongoDB (por defecto en el puerto `27017`).
3. En tu archivo `.env` mantén:
   ```env
   MONGODB_URI=mongodb://127.0.0.1:27017/easy_locker
   ```

---

## 4. ¿Cómo ejecutar el proyecto?

1. Abre una terminal en la carpeta del proyecto.
2. Ejecuta el servidor:
   ```bash
   npm start
   ```
   *(O si prefieres: `node server.js`)*
3. Al arrancar por primera vez, el servidor conectará a MongoDB y ejecutará automáticamente el **Seeder**, generando:
   - Los planes de renta predeterminados ($25 MXN / día, $650 MXN / semestre).
   - El inventario completo de casilleros (FCFM, FIME, FAV / Edificios A y B / Pisos 1, 2, 3 / Casilleros 1 al 48).
   - Usuarios de prueba listos para usar.
4. Abre en tu navegador:
   👉 **http://localhost:3000**

---

## 5. Cuentas de prueba preconfiguradas

| Rol | Correo | Contraseña | Matrícula |
|---|---|---|---|
| **Administrador** | `admin@uanl.edu.mx` | `admin12345` | `ADMIN001` |
| **Estudiante** | `alumno@uanl.edu.mx` | `alumno12345` | `2001234` |
