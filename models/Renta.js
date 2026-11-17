const mongoose = require('mongoose');

const rentaSchema = new mongoose.Schema(
  {
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
    },
    casillero: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Casillero',
      required: true,
    },
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plan',
      required: true,
    },
    estado: {
      type: String,
      enum: ['pendiente_pago', 'activa', 'finalizada', 'cancelada', 'vencida'],
      default: 'pendiente_pago',
    },
    precio_total: {
      type: Number,
      required: true,
    },
    moneda: {
      type: String,
      default: 'MXN',
    },
    fecha_solicitud: {
      type: Date,
      default: Date.now,
    },
    fecha_inicio: {
      type: Date,
    },
    fecha_fin: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

rentaSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

module.exports = mongoose.model('Renta', rentaSchema);
