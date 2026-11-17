const mongoose = require('mongoose');

const usuarioSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: true,
      trim: true,
    },
    apellidos: {
      type: String,
      required: true,
      trim: true,
    },
    matricula: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    correo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    facultad: {
      type: String,
      required: true,
      trim: true,
    },
    rol: {
      type: String,
      enum: ['estudiante', 'administrador'],
      default: 'estudiante',
    },
    estado: {
      type: String,
      enum: ['activo', 'inactivo', 'bloqueado'],
      default: 'activo',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

usuarioSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

module.exports = mongoose.model('Usuario', usuarioSchema);
