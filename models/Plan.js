const mongoose = require('mongoose');

const planSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    descripcion: {
      type: String,
      trim: true,
    },
    duracion_valor: {
      type: Number,
      default: 1,
    },
    duracion_unidad: {
      type: String,
      enum: ['dia', 'semestre'],
      default: 'dia',
    },
    precio: {
      type: Number,
      required: true,
    },
    moneda: {
      type: String,
      default: 'MXN',
    },
    activo: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

planSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

module.exports = mongoose.model('Plan', planSchema);
