const express = require('express');
const Casillero = require('../models/Casillero');
const Usuario = require('../models/Usuario');
const Renta = require('../models/Renta');
const { admin } = require('../middlewares/auth');

const router = express.Router();

// GET /api/admin/resumen
router.get('/resumen', admin, async (req, res, next) => {
  try {
    const [total, disponibles, ocupados, reservados] = await Promise.all([
      Casillero.countDocuments(),
      Casillero.countDocuments({ estado: 'disponible' }),
      Casillero.countDocuments({ estado: 'ocupado' }),
      Casillero.countDocuments({ estado: 'reservado' }),
    ]);

    const [usuarios, rentas] = await Promise.all([
      Usuario.countDocuments(),
      Renta.countDocuments(),
    ]);

    res.json({
      total,
      disponibles,
      ocupados,
      reservados,
      usuarios,
      rentas,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
