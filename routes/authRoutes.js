const express = require('express');
const bcrypt = require('bcryptjs');
const Usuario = require('../models/Usuario');
const { auth, fail } = require('../middlewares/auth');

const router = express.Router();

const clean = (v) => (typeof v === 'string' ? v.trim() : '');
const emailClean = (v) => clean(v).toLowerCase();

// POST /api/registro
router.post('/registro', async (req, res, next) => {
  try {
    const { nombre, apellidos, matricula, correo, facultad, contrasena } = req.body;

    if ([nombre, apellidos, matricula, correo, facultad, contrasena].some((x) => !clean(x))) {
      return fail(res, 400, 'Completa todos los campos obligatorios.');
    }

    const emailFormateado = emailClean(correo);
    if (!/^\S+@\S+\.\S+$/.test(emailFormateado) || clean(contrasena).length < 8) {
      return fail(res, 400, 'Correo inválido o contraseña menor a 8 caracteres.');
    }

    const usuarioExiste = await Usuario.findOne({
      $or: [{ correo: emailFormateado }, { matricula: clean(matricula) }],
    });

    if (usuarioExiste) {
      return fail(res, 409, 'El correo o la matrícula ya están registrados.');
    }

    const passwordHash = await bcrypt.hash(clean(contrasena), 12);

    await Usuario.create({
      nombre: clean(nombre),
      apellidos: clean(apellidos),
      matricula: clean(matricula),
      correo: emailFormateado,
      facultad: clean(facultad),
      password: passwordHash,
      rol: 'estudiante',
      estado: 'activo',
    });

    res.status(201).json({ mensaje: 'Cuenta creada. Ahora inicia sesión.' });
  } catch (error) {
    if (error.code === 11000) {
      return fail(res, 409, 'El correo o la matrícula ya se encuentran registrados.');
    }
    next(error);
  }
});

// POST /api/login
router.post('/login', async (req, res, next) => {
  try {
    const correo = emailClean(req.body.correo);
    const contrasena = String(req.body.contrasena || '');

    const user = await Usuario.findOne({ correo });
    if (!user || !(await bcrypt.compare(contrasena, user.password))) {
      return fail(res, 401, 'Correo o contraseña incorrectos.');
    }

    if (user.estado !== 'activo') {
      return fail(res, 403, 'Tu cuenta no está activa. Contacta al administrador.');
    }

    req.session.regenerate((err) => {
      if (err) return fail(res, 500, 'Error al iniciar sesión.');
      req.session.userId = user._id;
      res.json({ mensaje: 'Sesión iniciada.' });
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/logout
router.post('/logout', auth, (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('easylocker.sid');
    res.json({ mensaje: 'Sesión cerrada.' });
  });
});

// GET /api/yo
router.get('/yo', auth, (req, res) => {
  const u = req.user;
  res.json({
    id: u._id.toString(),
    nombre: u.nombre,
    apellidos: u.apellidos,
    matricula: u.matricula,
    correo: u.correo,
    facultad: u.facultad,
    rol: u.rol,
    estado: u.estado,
  });
});

// PUT /api/yo
router.put('/yo', auth, async (req, res, next) => {
  try {
    const { nombre, apellidos, matricula, correo, facultad, contrasena } = req.body;

    if ([nombre, apellidos, matricula, correo, facultad].some((x) => !clean(x))) {
      return fail(res, 400, 'Completa todos tus datos.');
    }

    const user = await Usuario.findById(req.session.userId);
    if (!user) return fail(res, 404, 'Usuario no encontrado.');

    // Verificar si el nuevo correo o matrícula pertenecen a otro usuario
    const duplicado = await Usuario.findOne({
      _id: { $ne: user._id },
      $or: [{ correo: emailClean(correo) }, { matricula: clean(matricula) }],
    });
    if (duplicado) {
      return fail(res, 409, 'El correo o matrícula ya pertenecen a otra cuenta.');
    }

    user.nombre = clean(nombre);
    user.apellidos = clean(apellidos);
    user.matricula = clean(matricula);
    user.correo = emailClean(correo);
    user.facultad = clean(facultad);

    if (contrasena) {
      if (clean(contrasena).length < 8) {
        return fail(res, 400, 'La nueva contraseña debe tener al menos 8 caracteres.');
      }
      user.password = await bcrypt.hash(clean(contrasena), 12);
    }

    await user.save();
    res.json({ mensaje: 'Datos actualizados.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
