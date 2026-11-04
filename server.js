
const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

app.get('/api/estado', async (req, res) => {
  try {
    const [resultado] = await db.query(
      'SELECT DATABASE() AS baseDatos'
    );

    res.json({
      mensaje: 'Servidor funcionando',
      baseDatos: resultado[0].baseDatos
    });
  } catch (error) {
    console.error('Error de MySQL:', error.message);

    res.status(500).json({
      error: 'No se pudo conectar con MySQL'
    });
  }
});


const bcrypt = require('bcryptjs');

app.post('/api/registro', async (req, res) => {
  try {
    const {
      nombre, apellidos, matricula,
      correo, facultad, contrasena
    } = req.body;

    if (!nombre || !apellidos || !matricula ||
        !correo || !facultad || !contrasena) {
      return res.status(400).json({
        mensaje: 'Completa todos los campos.'
      });
    }

    if (contrasena.length < 8) {
      return res.status(400).json({
        mensaje: 'La contraseña debe tener al menos 8 caracteres.'
      });
    }

    const [facultades] = await db.execute(
      'SELECT id FROM facultades WHERE nombre = ? AND activa = 1',
      [facultad]
    );

    if (facultades.length === 0) {
      return res.status(400).json({
        mensaje: 'La facultad no es válida.'
      });
    }

    const [roles] = await db.execute(
      'SELECT id FROM roles WHERE nombre = ?',
      ['estudiante']
    );

    if (roles.length === 0) {
      return res.status(500).json({
        mensaje: 'No está configurado el rol de estudiante.'
      });
    }

    const passwordHash = await bcrypt.hash(contrasena, 12);

    await db.execute(
      `INSERT INTO usuarios
       (rol_id, facultad_id, nombre, apellidos,
        matricula, correo, password_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        roles[0].id,
        facultades[0].id,
        nombre.trim(),
        apellidos.trim(),
        matricula.trim(),
        correo.trim().toLowerCase(),
        passwordHash
      ]
    );

    res.status(201).json({
      mensaje: 'Usuario registrado correctamente.'
    });

  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        mensaje: 'El correo o matrícula ya están registrados.'
      });
    }

    console.error('Error de registro:', error.message);
    res.status(500).json({
      mensaje: 'Error interno al registrar el usuario.'
    });
  }
});


app.post('/api/login', async (req, res) => {
  try {
    const { correo, contrasena } = req.body;

    if (typeof correo !== 'string' ||
        typeof contrasena !== 'string' ||
        !correo.trim() || !contrasena) {
      return res.status(400).json({
        mensaje: 'Ingresa tu correo y contraseña.'
      });
    }

    const [usuarios] = await db.execute(
      `SELECT id, nombre, apellidos, correo,
              password_hash, estado
       FROM usuarios
       WHERE correo = ?
       LIMIT 1`,
      [correo.trim().toLowerCase()]
    );

    if (usuarios.length === 0) {
      return res.status(401).json({
        mensaje: 'Correo o contraseña incorrectos.'
      });
    }

    const usuario = usuarios[0];

    const contrasenaValida = await bcrypt.compare(
      contrasena,
      usuario.password_hash
    );

    if (!contrasenaValida) {
      return res.status(401).json({
        mensaje: 'Correo o contraseña incorrectos.'
      });
    }

    if (usuario.estado !== 'activo') {
      return res.status(403).json({
        mensaje: 'Esta cuenta no está activa.'
      });
    }

    res.json({
      mensaje: 'Inicio de sesión correcto.',
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        apellidos: usuario.apellidos,
        correo: usuario.correo
      }
    });

  } catch (error) {
    console.error('Error de login:', error.message);
    res.status(500).json({
      mensaje: 'Error interno al iniciar sesión.'
    });
  }
});


app.listen(PORT, () => {
  console.log(`Servidor en http://localhost:${PORT}`);
});
