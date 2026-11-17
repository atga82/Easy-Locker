const express = require('express');
const Plan = require('../models/Plan');

const router = express.Router();

// GET /api/planes
router.get('/', async (req, res, next) => {
  try {
    const planes = await Plan.find({ activo: true }).sort({ precio: 1 });

    const resultado = planes.map((p) => ({
      id: p._id.toString(),
      nombre: p.nombre,
      precio: p.precio,
      moneda: p.moneda,
      duracion_unidad: p.duracion_unidad,
      duracion_valor: p.duracion_valor,
      descripcion: p.descripcion,
    }));

    res.json(resultado);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
