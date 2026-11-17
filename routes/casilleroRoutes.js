const express = require('express');
const Casillero = require('../models/Casillero');
const Renta = require('../models/Renta');

const router = express.Router();
const clean = (v) => (typeof v === 'string' ? v.trim() : '');

// Función utilitaria para liberar casilleros con rentas vencidas o pendientes expiradas (>15 min)
const limpiarRentasExpiradas = async () => {
  const ahora = new Date();
  const hace15Min = new Date(ahora.getTime() - 15 * 60 * 1000);

  // 1. Rentas activas vencidas
  const rentasVencidas = await Renta.find({
    estado: 'activa',
    fecha_fin: { $lt: ahora },
  });

  for (const r of rentasVencidas) {
    r.estado = 'vencida';
    await r.save();
    await Casillero.findByIdAndUpdate(r.casillero, { estado: 'disponible' });
  }

  // 2. Rentas pendientes de pago con más de 15 minutos
  const rentasCanceladas = await Renta.find({
    estado: 'pendiente_pago',
    fecha_solicitud: { $lt: hace15Min },
  });

  for (const r of rentasCanceladas) {
    r.estado = 'cancelada';
    await r.save();
    await Casillero.findByIdAndUpdate(r.casillero, { estado: 'disponible' });
  }
};

// GET /api/casilleros
router.get('/', async (req, res, next) => {
  try {
    await limpiarRentasExpiradas();

    const { facultad, edificio, piso } = req.query;
    const filtro = {};

    if (facultad) filtro.facultad = clean(facultad);
    if (edificio) filtro.edificio = clean(edificio);
    if (piso) filtro.piso = Number(piso) || 1;

    const casilleros = await Casillero.find(filtro).sort({ numero: 1 });

    const resultado = casilleros.map((c) => ({
      id: c._id.toString(),
      numero: c.numero,
      fila: c.fila,
      columna: c.columna,
      estado: c.estado,
      edificio: c.edificio,
      piso: c.piso,
      facultad: c.facultad,
    }));

    res.json(resultado);
  } catch (error) {
    next(error);
  }
});

module.exports = { router, limpiarRentasExpiradas };
