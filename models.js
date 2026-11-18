const mongoose = require('mongoose');

const { Schema } = mongoose;
const common = {
    timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' },
    versionKey: false,
    strict: 'throw'
};

const objectId = Schema.Types.ObjectId;

const RolSchema = new Schema({
    nombre: { type: String, required: true, trim: true, lowercase: true, unique: true, maxlength: 30 },
    descripcion: { type: String, trim: true, maxlength: 150, default: '' }
}, common);

const FacultadSchema = new Schema({
    nombre: { type: String, required: true, trim: true, unique: true, maxlength: 150 },
    activa: { type: Boolean, default: true }
}, common);

const UsuarioSchema = new Schema({
    rol: { type: objectId, ref: 'Rol', required: true, index: true },
    facultad: { type: objectId, ref: 'Facultad', required: true, index: true },
    nombre: { type: String, required: true, trim: true, maxlength: 80 },
    apellidos: { type: String, required: true, trim: true, maxlength: 120 },
    matricula: { type: String, required: true, trim: true, unique: true, maxlength: 30 },
    correo: { type: String, required: true, trim: true, lowercase: true, unique: true, maxlength: 150 },
    passwordHash: { type: String, required: true, select: false },
    estado: { type: String, enum: ['activo', 'inactivo', 'bloqueado'], default: 'activo', index: true }
}, common);

const EdificioSchema = new Schema({
    facultad: { type: objectId, ref: 'Facultad', required: true, index: true },
    nombre: { type: String, required: true, trim: true, maxlength: 80 },
    activo: { type: Boolean, default: true }
}, common);
EdificioSchema.index({ facultad: 1, nombre: 1 }, { unique: true });

const PisoSchema = new Schema({
    edificio: { type: objectId, ref: 'Edificio', required: true, index: true },
    numero_piso: { type: Number, required: true, min: 1, max: 99 },
    activo: { type: Boolean, default: true }
}, common);
PisoSchema.index({ edificio: 1, numero_piso: 1 }, { unique: true });

const CasilleroSchema = new Schema({
    piso: { type: objectId, ref: 'Piso', required: true, index: true },
    numero: { type: Number, required: true, min: 1, max: 9999 },
    fila: { type: Number, required: true, min: 1, max: 255 },
    columna: { type: Number, required: true, min: 1, max: 255 },
    estado: {
        type: String,
        enum: ['disponible', 'reservado', 'ocupado', 'mantenimiento', 'inactivo'],
        default: 'disponible',
        index: true
    }
}, common);
CasilleroSchema.index({ piso: 1, numero: 1 }, { unique: true });
CasilleroSchema.index({ piso: 1, fila: 1, columna: 1 }, { unique: true });

const PlanSchema = new Schema({
    nombre: { type: String, required: true, trim: true, unique: true, maxlength: 80 },
    descripcion: { type: String, trim: true, maxlength: 255, default: '' },
    duracion_valor: { type: Number, required: true, min: 1, default: 1 },
    duracion_unidad: { type: String, required: true, enum: ['dia', 'semestre'] },
    precio: { type: Number, required: true, min: 0 },
    moneda: { type: String, uppercase: true, trim: true, default: 'MXN', minlength: 3, maxlength: 3 },
    activo: { type: Boolean, default: true }
}, common);

const RentaSchema = new Schema({
    usuario: { type: objectId, ref: 'Usuario', required: true, index: true },
    casillero: { type: objectId, ref: 'Casillero', required: true, index: true },
    plan: { type: objectId, ref: 'Plan', required: true, index: true },
    estado: {
        type: String,
        enum: ['pendiente_pago', 'activa', 'finalizada', 'cancelada', 'vencida'],
        default: 'pendiente_pago',
        index: true
    },
    precio_total: { type: Number, required: true, min: 0 },
    moneda: { type: String, uppercase: true, trim: true, default: 'MXN', minlength: 3, maxlength: 3 },
    fecha_solicitud: { type: Date, default: Date.now, index: true },
    fecha_inicio: { type: Date, default: null },
    fecha_fin: { type: Date, default: null }
}, common);
RentaSchema.index({ usuario: 1, fecha_solicitud: -1 });
RentaSchema.index({ casillero: 1, estado: 1 });
RentaSchema.index({ estado: 1, fecha_fin: 1 });

const PagoSchema = new Schema({
    renta: { type: objectId, ref: 'Renta', required: true, index: true },
    monto: { type: Number, required: true, min: 0 },
    moneda: { type: String, uppercase: true, trim: true, default: 'MXN', minlength: 3, maxlength: 3 },
    metodo_pago: { type: String, enum: ['tarjeta', 'transferencia', 'efectivo', 'otro'], default: 'tarjeta' },
    estado: { type: String, enum: ['pendiente', 'aprobado', 'rechazado', 'cancelado', 'error'], default: 'pendiente', index: true },
    proveedor: { type: String, trim: true, maxlength: 60, default: '' },
    referencia_externa: { type: String, trim: true, maxlength: 150, default: undefined },
    pagado_en: { type: Date, default: null }
}, common);
PagoSchema.index({ referencia_externa: 1 }, { unique: true, sparse: true });
PagoSchema.index({ pagado_en: 1, estado: 1 });

const LogSistemaSchema = new Schema({
    usuario: { type: objectId, ref: 'Usuario', default: null, index: true },
    nivel: { type: String, enum: ['INFO', 'WARNING', 'ERROR', 'CRITICAL'], default: 'INFO', index: true },
    evento: { type: String, required: true, trim: true, maxlength: 100 },
    metodo_http: { type: String, trim: true, maxlength: 10, default: '' },
    endpoint: { type: String, trim: true, maxlength: 180, default: '' },
    mensaje: { type: String, required: true, maxlength: 4000 },
    contexto_json: { type: Schema.Types.Mixed, default: null }
}, { ...common, timestamps: { createdAt: 'creado_en', updatedAt: false } });
LogSistemaSchema.index({ nivel: 1, creado_en: -1 });
LogSistemaSchema.index({ usuario: 1, creado_en: -1 });

const model = (name, schema, collection) =>
    mongoose.models[name] || mongoose.model(name, schema, collection);

module.exports = {
    Rol: model('Rol', RolSchema, 'roles'),
    Facultad: model('Facultad', FacultadSchema, 'facultades'),
    Usuario: model('Usuario', UsuarioSchema, 'usuarios'),
    Edificio: model('Edificio', EdificioSchema, 'edificios'),
    Piso: model('Piso', PisoSchema, 'pisos'),
    Casillero: model('Casillero', CasilleroSchema, 'casilleros'),
    Plan: model('Plan', PlanSchema, 'planes'),
    Renta: model('Renta', RentaSchema, 'rentas'),
    Pago: model('Pago', PagoSchema, 'pagos'),
    LogSistema: model('LogSistema', LogSistemaSchema, 'logs_sistema')
};
