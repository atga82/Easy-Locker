const mongoose = require('mongoose');

const pagoSchema = new mongoose.Schema(
  {
    renta: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Renta',
      required: true,
    },
    monto: {
      type: Number,
      required: true,
    },
    moneda: {
      type: String,
      default: 'MXN',
    },
    metodo_pago: {
      type: String,
      enum: ['tarjeta', 'transferencia', 'efectivo', 'otro'],
      default: 'otro',
    },
    estado: {
      type: String,
      enum: ['pendiente', 'aprobado', 'rechazado', 'cancelado', 'error'],
      default: 'aprobado',
    },
    proveedor: {
      type: String,
      default: 'SIMULACION',
    },
    referencia_externa: {
      type: String,
    },
    pagado_en: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

pagoSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

module.exports = mongoose.model('Pago', pagoSchema);
