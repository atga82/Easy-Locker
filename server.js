require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const mongoose = require('mongoose');

const connectDB = require('./config/db');
const seedDatabase = require('./utils/seeder');

const authRoutes = require('./routes/authRoutes');
const { router: casilleroRoutes } = require('./routes/casilleroRoutes');
const planRoutes = require('./routes/planRoutes');
const rentaRoutes = require('./routes/rentaRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
app.disable('x-powered-by');

// Middleware básicos
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '20kb' }));
app.use(express.urlencoded({ extended: true }));

// Configuración de sesiones
app.use(
  session({
    name: 'easylocker.sid',
    secret: process.env.SESSION_SECRET || 'solo-desarrollo-cambiar-esta-clave-antes-de-publicar',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 8, // 8 horas
    },
  })
);

// Verificación de estado de la API y de la Base de Datos
app.get('/api/estado', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const states = ['desconectado', 'conectado', 'conectando', 'desconectando'];
  res.json({
    mensaje: 'Servidor Easy Locker funcionando',
    baseDatos: 'MongoDB',
    estadoDB: states[dbState] || 'desconocido',
  });
});

// Rutas de la API
app.use('/api', authRoutes);
app.use('/api/casilleros', casilleroRoutes);
app.use('/api/planes', planRoutes);
app.use('/api', rentaRoutes);
app.use('/api/admin', adminRoutes);

// Proteger archivos sensibles para que no se descarguen estáticamente
app.use((req, res, next) => {
  if (
    /(^|\/)\.|\.sql$|\.json$|\.md$|\.js\.map$/i.test(decodeURIComponent(req.path)) ||
    ['/server.js', '/db.js'].includes(req.path)
  ) {
    return res.sendStatus(404);
  }
  next();
});

// Servir archivos estáticos del frontend (HTML, CSS, JS, imágenes)
app.use(express.static(path.join(__dirname), { index: 'index.html' }));

// Middleware centralizado de errores
app.use((err, req, res, next) => {
  console.error('[Error de Servidor]', err);

  if (err.name === 'CastError') {
    return res.status(400).json({ mensaje: 'Identificador con formato no válido.' });
  }

  if (err.code === 11000) {
    return res.status(409).json({ mensaje: 'El registro con estos datos ya existe.' });
  }

  res.status(500).json({
    mensaje: 'Error interno del servidor. Revisa los logs de la consola.',
  });
});

const PORT = Number(process.env.PORT) || 3000;

// Iniciar servidor y conectar a la base de datos
const startServer = async () => {
  const isConnected = await connectDB();
  if (isConnected) {
    await seedDatabase();
  }

  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 Easy Locker backend activo en http://localhost:${PORT}`);
    console.log(`📂 Frontend accesible en: http://localhost:${PORT}/index.html`);
    console.log(`====================================================`);
  });
};

startServer();
