const mongoose = require('mongoose');

const casilleroSchema = new mongoose.Schema(
  {
    facultad: {
      type: String,
      required: true,
      trim: true,
    },
    edificio: {
      type: String,
      required: true,
      trim: true,
    },
    piso: {
      type: Number,
      required: true,
    },
    numero: {
      type: Number,
      required: true,
    },
    fila: {
      type: Number,
      required: true,
    },
    columna: {
      type: Number,
      required: true,
    },
    estado: {
      type: String,
      enum: ['disponible', 'reservado', 'ocupado', 'mantenimiento'],
      default: 'disponible',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

casilleroSchema.index({ facultad: 1, edificio: 1, piso: 1, numero: 1 }, { unique: true });

casilleroSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

module.exports = mongoose.model('Casillero', casilleroSchema);
