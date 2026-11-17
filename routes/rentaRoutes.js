const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');
const Renta = require('../models/Renta');
const Casillero = require('../models/Casillero');
const Plan = require('../models/Plan');
const Pago = require('../models/Pago');
const { auth, fail } = require('../middlewares/auth');
const { limpiarRentasExpiradas } = require('./casilleroRoutes');

const router = express.Router();

const accessCode = (rentId) => {
  const secret = process.env.ACCESS_CODE_SECRET || process.env.SESSION_SECRET || 'easy-locker-demo-local';
  const hash = crypto.createHmac('sha256', secret).update(String(rentId)).digest('hex').slice(0, 12);
  return String(Number.parseInt(hash, 16) % 1000000).padStart(6, '0');
};

// GET /api/mi-acceso
router.get('/mi-acceso', auth, async (req, res, next) => {
  try {
    const ahora = new Date();
    const rentaActiva = await Renta.findOne({
      usuario: req.session.userId,
      estado: 'activa',
      fecha_fin: { $gt: ahora },
    })
      .populate('casillero')
      .sort({ fecha_inicio: -1 });

    if (!rentaActiva || !rentaActiva.casillero) {
      return res.json({
        activo: false,
        mensaje: 'El código se mostrará después de confirmar la renta.',
      });
    }

    res.set('Cache-Control', 'no-store');
    res.json({
      activo: true,
      codigo: accessCode(rentaActiva._id),
      numero: rentaActiva.casillero.numero,
      edificio: rentaActiva.casillero.edificio,
      piso: rentaActiva.casillero.piso,
      vence: rentaActiva.fecha_fin,
      nota: 'Código de demostración; no abre una cerradura física.',
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/rentas
router.get('/rentas', auth, async (req, res, next) => {
  try {
    await limpiarRentasExpiradas();

    const rentas = await Renta.find({ usuario: req.session.userId })
      .populate('casillero')
      .populate('plan')
      .sort({ fecha_solicitud: -1 });

    const resultado = rentas.map((r) => ({
      id: r._id.toString(),
      estado: r.estado,
      precio_total: r.precio_total,
      fecha_solicitud: r.fecha_solicitud,
      fecha_inicio: r.fecha_inicio,
      fecha_fin: r.fecha_fin,
      numero: r.casillero?.numero || 'N/A',
      casillero_id: r.casillero?._id ? r.casillero._id.toString() : null,
      edificio: r.casillero?.edificio || 'N/A',
      piso: r.casillero?.piso || 'N/A',
      facultad: r.casillero?.facultad || 'N/A',
      plan: r.plan?.nombre || 'Plan desconocido',
    }));

    res.json(resultado);
  } catch (error) {
    next(error);
  }
});

// POST /api/rentas
router.post('/rentas', auth, async (req, res, next) => {
  try {
    const { casilleroId, planId } = req.body;

    if (!casilleroId || !planId) {
      return fail(res, 400, 'Selecciona casillero y plan.');
    }

    if (!mongoose.Types.ObjectId.isValid(casilleroId) || !mongoose.Types.ObjectId.isValid(planId)) {
      return fail(res, 400, 'Identificador de casillero o plan no válido.');
    }

    await limpiarRentasExpiradas();

    const casillero = await Casillero.findById(casilleroId);
    const plan = await Plan.findById(planId);

    if (!casillero || casillero.estado !== 'disponible' || !plan || !plan.activo) {
      return fail(res, 409, 'El casillero ya no está disponible o el plan no existe.');
    }

    // Verificar si ya existe una renta pendiente o activa para este casillero
    const rentaExistente = await Renta.findOne({
      casillero: casillero._id,
      estado: { $in: ['pendiente_pago', 'activa'] },
    });

    if (rentaExistente) {
      return fail(res, 409, 'Este casillero ya está reservado.');
    }

    const nuevaRenta = await Renta.create({
      usuario: req.session.userId,
      casillero: casillero._id,
      plan: plan._id,
      precio_total: plan.precio,
      moneda: plan.moneda || 'MXN',
      estado: 'pendiente_pago',
      fecha_solicitud: new Date(),
    });

    casillero.estado = 'reservado';
    await casillero.save();

    res.status(201).json({
      id: nuevaRenta._id.toString(),
      mensaje: 'Reserva creada. Completa el pago simulado antes de 15 minutos.',
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/rentas/:id/pagar
router.post('/rentas/:id/pagar', auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return fail(res, 400, 'ID de renta inválido.');
    }

    await limpiarRentasExpiradas();

    const renta = await Renta.findOne({
      _id: id,
      usuario: req.session.userId,
    }).populate('plan');

    if (!renta || renta.estado !== 'pendiente_pago') {
      return fail(res, 409, 'Esta reserva ya no admite pagos.');
    }

    const ahora = new Date();
    const unidad = renta.plan?.duracion_unidad || 'dia';
    const valor = renta.plan?.duracion_valor || 1;

    let fechaFin = new Date(ahora.getTime());
    if (unidad === 'dia') {
      fechaFin.setDate(fechaFin.getDate() + valor);
    } else if (unidad === 'semestre') {
      fechaFin.setMonth(fechaFin.getMonth() + valor * 6);
    } else {
      fechaFin.setDate(fechaFin.getDate() + 1);
    }

    renta.estado = 'activa';
    renta.fecha_inicio = ahora;
    renta.fecha_fin = fechaFin;
    await renta.save();

    await Casillero.findByIdAndUpdate(renta.casillero, { estado: 'ocupado' });

    await Pago.create({
      renta: renta._id,
      monto: renta.precio_total,
      moneda: renta.moneda,
      metodo_pago: 'otro',
      estado: 'aprobado',
      proveedor: 'SIMULACION',
      pagado_en: ahora,
    });

    res.json({ mensaje: 'Pago simulado aprobado. Casillero asignado.' });
  } catch (error) {
    next(error);
  }
});

// POST /api/rentas/:id/cancelar
router.post('/rentas/:id/cancelar', auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return fail(res, 400, 'ID de renta inválido.');
    }

    const renta = await Renta.findOne({
      _id: id,
      usuario: req.session.userId,
    });

    if (!renta || renta.estado !== 'pendiente_pago') {
      return fail(res, 409, 'Solo se cancelan reservas pendientes.');
    }

    renta.estado = 'cancelada';
    await renta.save();

    await Casillero.findByIdAndUpdate(renta.casillero, { estado: 'disponible' });

    res.json({ mensaje: 'Reserva cancelada.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
