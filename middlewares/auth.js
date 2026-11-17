const Usuario = require('../models/Usuario');

const fail = (res, status, mensaje) => res.status(status).json({ mensaje });

const auth = async (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return fail(res, 401, 'Inicia sesión para continuar.');
  }

  try {
    const user = await Usuario.findById(req.session.userId).select('-password');
    if (!user || user.estado !== 'activo') {
      req.session.destroy();
      return fail(res, 401, 'Sesión no válida o usuario inactivo.');
    }
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

const admin = async (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return fail(res, 401, 'Inicia sesión para continuar.');
  }

  try {
    const user = await Usuario.findById(req.session.userId);
    if (!user || user.rol !== 'administrador') {
      return fail(res, 403, 'Acceso restringido solo para administradores.');
    }
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { auth, admin, fail };
