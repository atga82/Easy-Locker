require('dotenv').config();

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');

const { connectDB } = require('./db');
const {
    Rol, Facultad, Usuario, Edificio, Piso, Casillero, Plan,
    Renta, Pago, LogSistema
} = require('./models');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const ACCESS_CODE_SECRET = process.env.ACCESS_CODE_SECRET || JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
    throw new Error('Configura JWT_SECRET con al menos 32 caracteres en .env.');
}

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '30kb' }));

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://127.0.0.1:3000')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);

app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('Origen no permitido por CORS.'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
    optionsSuccessStatus: 204
}));

const fail = (res, status, mensaje) => res.status(status).json({ mensaje });
const clean = value => typeof value === 'string' ? value.trim() : '';
const email = value => clean(value).toLowerCase();
const validEmail = value => /^\S+@\S+\.\S+$/.test(email(value));
const validId = value => mongoose.isValidObjectId(value);
const asyncRoute = handler => (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next);

async function writeLog({ usuario = null, nivel = 'INFO', evento, req, mensaje = '', contexto = null }) {
    const entry = {
        fecha: new Date().toISOString(),
        nivel,
        evento: String(evento || 'EVENTO').slice(0, 100),
        metodo_http: req?.method || '',
        endpoint: req?.originalUrl || '',
        usuario: validId(usuario) ? String(usuario) : null,
        mensaje: String(mensaje || evento || 'Evento del sistema').slice(0, 4000)
    };
    try {
        const directory = path.join(__dirname, 'logs');
        fs.mkdirSync(directory, { recursive: true });
        fs.appendFileSync(path.join(directory, 'backend.log'), JSON.stringify(entry) + os.EOL, 'utf8');
    } catch (fileError) {
        console.error('No se pudo escribir el archivo de logs:', fileError.message);
    }
    try {
        await LogSistema.create({
            usuario: validId(usuario) ? usuario : null,
            nivel,
            evento: String(evento || 'EVENTO').slice(0, 100),
            metodo_http: req?.method || '',
            endpoint: req?.originalUrl || '',
            mensaje: String(mensaje || evento || 'Evento del sistema').slice(0, 4000),
            contexto_json: contexto
        });
    } catch (error) {
        console.error('No se pudo guardar el log:', error.message);
    }
}

function issueToken(user) {
    return jwt.sign(
        { sub: user._id.toString() },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN, issuer: 'easy-locker' }
    );
}

async function getSafeUser(id) {
    const user = await Usuario.findById(id)
        .populate('facultad', 'nombre')
        .populate('rol', 'nombre');
    if (!user) return null;
    return {
        id: user._id.toString(),
        nombre: user.nombre,
        apellidos: user.apellidos,
        matricula: user.matricula,
        correo: user.correo,
        estado: user.estado,
        facultad: user.facultad?.nombre || '',
        facultadId: user.facultad?._id?.toString() || '',
        rol: user.rol?.nombre || '',
        rolId: user.rol?._id?.toString() || ''
    };
}

const requireAuth = asyncRoute(async (req, res, next) => {
    const header = req.get('authorization') || '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) return fail(res, 401, 'Inicia sesión para continuar.');
    let payload;
    try {
        payload = jwt.verify(match[1], JWT_SECRET, { issuer: 'easy-locker' });
    } catch {
        return fail(res, 401, 'La sesión venció o el token no es válido. Inicia sesión nuevamente.');
    }
    if (!validId(payload.sub)) return fail(res, 401, 'Token no válido.');
    const user = await Usuario.findById(payload.sub).populate('rol', 'nombre');
    if (!user || user.estado !== 'activo') return fail(res, 401, 'La cuenta no está disponible.');
    req.userId = user._id;
    req.authUser = user;
    next();
});

const requireAdmin = [
    requireAuth,
    asyncRoute(async (req, res, next) => {
        if (req.authUser.rol?.nombre !== 'administrador') {
            return fail(res, 403, 'Esta operación requiere una cuenta administradora.');
        }
        next();
    })
];

function accessCode(rentId) {
    return String(
        Number.parseInt(
            crypto.createHmac('sha256', ACCESS_CODE_SECRET)
                .update(String(rentId))
                .digest('hex')
                .slice(0, 12),
            16
        ) % 1000000
    ).padStart(6, '0');
}

async function expireRents() {
    const now = new Date();
    const pendingLimit = new Date(now.getTime() - 15 * 60 * 1000);
    const expiredPending = await Renta.find({
        estado: 'pendiente_pago',
        fecha_solicitud: { $lt: pendingLimit }
    }).select('_id casillero').lean();

    if (expiredPending.length) {
        await Renta.updateMany(
            { _id: { $in: expiredPending.map(item => item._id) }, estado: 'pendiente_pago' },
            { $set: { estado: 'cancelada' } }
        );
        await Casillero.updateMany(
            { _id: { $in: expiredPending.map(item => item.casillero) }, estado: 'reservado' },
            { $set: { estado: 'disponible' } }
        );
    }

    const expiredActive = await Renta.find({
        estado: 'activa',
        fecha_fin: { $lt: now, $ne: null }
    }).select('_id casillero').lean();

    if (expiredActive.length) {
        await Renta.updateMany(
            { _id: { $in: expiredActive.map(item => item._id) }, estado: 'activa' },
            { $set: { estado: 'vencida' } }
        );
        await Casillero.updateMany(
            { _id: { $in: expiredActive.map(item => item.casillero) }, estado: 'ocupado' },
            { $set: { estado: 'disponible' } }
        );
    }
}

async function rentalView(rent) {
    const item = rent.toObject ? rent.toObject() : rent;
    const locker = item.casillero || {};
    const floor = locker.piso || {};
    const building = floor.edificio || {};
    const faculty = building.facultad || {};
    const user = item.usuario || {};
    const plan = item.plan || {};
    return {
        id: String(item._id),
        estado: item.estado,
        precio_total: item.precio_total,
        moneda: item.moneda,
        fecha_solicitud: item.fecha_solicitud,
        fecha_inicio: item.fecha_inicio,
        fecha_fin: item.fecha_fin,
        numero: locker.numero,
        casillero_id: locker._id ? String(locker._id) : '',
        edificio: building.nombre || '',
        piso: floor.numero_piso,
        facultad: faculty.nombre || '',
        plan: plan.nombre || '',
        usuario: user.nombre ? user.nombre + ' ' + (user.apellidos || '') : '',
        correo: user.correo || ''
    };
}

const rentPopulate = [
    { path: 'usuario', select: 'nombre apellidos correo matricula' },
    { path: 'casillero', populate: { path: 'piso', populate: { path: 'edificio', populate: { path: 'facultad', select: 'nombre' } } } },
    { path: 'plan', select: 'nombre precio duracion_unidad duracion_valor' }
];

app.get('/api/estado', requireAuth, asyncRoute(async (req, res) => {
    res.json({
        mensaje: 'Servidor funcionando',
        baseDatos: mongoose.connection.name,
        motor: 'MongoDB',
        estado: mongoose.connection.readyState === 1 ? 'conectada' : 'desconectada'
    });
}));

app.post('/api/registro', asyncRoute(async (req, res) => {
    const { nombre, apellidos, matricula, correo, facultad, contrasena } = req.body;
    if ([nombre, apellidos, matricula, correo, facultad, contrasena].some(value => !clean(value))) {
        return fail(res, 400, 'Completa todos los campos.');
    }
    if (!validEmail(correo) || String(contrasena).length < 8) {
        return fail(res, 400, 'Correo inválido o contraseña menor a 8 caracteres.');
    }
    const faculty = await Facultad.findOne({ nombre: clean(facultad), activa: true });
    const role = await Rol.findOne({ nombre: 'estudiante' });
    if (!faculty || !role) return fail(res, 400, 'Facultad o rol no disponible.');

    const passwordHash = await bcrypt.hash(String(contrasena), 12);
    const user = await Usuario.create({
        rol: role._id,
        facultad: faculty._id,
        nombre: clean(nombre),
        apellidos: clean(apellidos),
        matricula: clean(matricula),
        correo: email(correo),
        passwordHash
    });
    await writeLog({
        usuario: user._id,
        evento: 'REGISTRO_USUARIO',
        req,
        mensaje: 'Se creó una cuenta de estudiante.'
    });
    res.status(201).json({ mensaje: 'Cuenta creada. Ahora inicia sesión.' });
}));

app.post('/api/login', asyncRoute(async (req, res) => {
    const user = await Usuario.findOne({ correo: email(req.body.correo) })
        .select('+passwordHash')
        .populate('rol', 'nombre');
    if (!user || !(await bcrypt.compare(String(req.body.contrasena || ''), user.passwordHash))) {
        await writeLog({
            nivel: 'WARNING',
            evento: 'LOGIN_FALLIDO',
            req,
            mensaje: 'Intento de inicio de sesión con credenciales no válidas.'
        });
        return fail(res, 401, 'Correo o contraseña incorrectos.');
    }
    if (user.estado !== 'activo') return fail(res, 403, 'Cuenta inactiva.');
    const token = issueToken(user);
    const safe = await getSafeUser(user._id);
    await writeLog({
        usuario: user._id,
        evento: 'LOGIN_CORRECTO',
        req,
        mensaje: 'Inicio de sesión correcto.'
    });
    res.json({ mensaje: 'Sesión iniciada.', token, usuario: safe });
}));

app.post('/api/logout', requireAuth, asyncRoute(async (req, res) => {
    await writeLog({
        usuario: req.userId,
        evento: 'LOGOUT',
        req,
        mensaje: 'El usuario cerró sesión en el cliente.'
    });
    res.json({ mensaje: 'Sesión cerrada.' });
}));

app.get('/api/yo', requireAuth, asyncRoute(async (req, res) => {
    const user = await getSafeUser(req.userId);
    if (!user) return fail(res, 404, 'Usuario no encontrado.');
    res.json(user);
}));

app.put('/api/yo', requireAuth, asyncRoute(async (req, res) => {
    const { nombre, apellidos, matricula, correo, facultad, contrasena } = req.body;
    if ([nombre, apellidos, matricula, correo, facultad].some(value => !clean(value))) {
        return fail(res, 400, 'Completa tus datos.');
    }
    if (!validEmail(correo)) return fail(res, 400, 'Correo electrónico inválido.');
    if (contrasena && String(contrasena).length < 8) {
        return fail(res, 400, 'La nueva contraseña debe tener al menos 8 caracteres.');
    }
    const faculty = await Facultad.findOne({ nombre: clean(facultad), activa: true });
    if (!faculty) return fail(res, 400, 'Facultad inválida.');
    const values = {
        nombre: clean(nombre),
        apellidos: clean(apellidos),
        matricula: clean(matricula),
        correo: email(correo),
        facultad: faculty._id
    };
    if (contrasena) values.passwordHash = await bcrypt.hash(String(contrasena), 12);
    await Usuario.findByIdAndUpdate(req.userId, { $set: values }, { runValidators: true });
    await writeLog({
        usuario: req.userId,
        evento: 'PERFIL_ACTUALIZADO',
        req,
        mensaje: 'El usuario actualizó sus datos.'
    });
    res.json({ mensaje: 'Datos actualizados.' });
}));

app.get('/api/casilleros', requireAuth, asyncRoute(async (req, res) => {
    await expireRents();
    const faculty = await Facultad.findOne({ nombre: clean(req.query.facultad), activa: true });
    if (!faculty) return res.json([]);
    const building = await Edificio.findOne({
        facultad: faculty._id,
        nombre: clean(req.query.edificio),
        activo: true
    });
    if (!building) return res.json([]);
    const floor = await Piso.findOne({
        edificio: building._id,
        numero_piso: Number(req.query.piso),
        activo: true
    });
    if (!floor) return res.json([]);
    const rows = await Casillero.find({ piso: floor._id }).sort({ numero: 1 }).lean();
    res.json(rows.map(row => ({
        id: String(row._id),
        numero: row.numero,
        fila: row.fila,
        columna: row.columna,
        estado: row.estado
    })));
}));

app.get('/api/planes', requireAuth, asyncRoute(async (req, res) => {
    const plans = await Plan.find({ activo: true }).sort({ precio: 1 }).lean();
    res.json(plans.map(plan => ({
        id: String(plan._id),
        nombre: plan.nombre,
        precio: plan.precio,
        moneda: plan.moneda,
        duracion_unidad: plan.duracion_unidad,
        duracion_valor: plan.duracion_valor
    })));
}));

app.post('/api/rentas', requireAuth, asyncRoute(async (req, res) => {
    await expireRents();
    const lockerId = String(req.body.casilleroId || '');
    const planId = String(req.body.planId || '');
    if (!validId(lockerId) || !validId(planId)) {
        return fail(res, 400, 'Selecciona un casillero y un plan válidos.');
    }
    const plan = await Plan.findOne({ _id: planId, activo: true });
    if (!plan) return fail(res, 404, 'El plan no existe o no está disponible.');

    const locker = await Casillero.findOneAndUpdate(
        { _id: lockerId, estado: 'disponible' },
        { $set: { estado: 'reservado' } },
        { returnDocument: 'after' }
    );
    if (!locker) return fail(res, 409, 'El casillero ya no está disponible.');

    try {
        const rent = await Renta.create({
            usuario: req.userId,
            casillero: locker._id,
            plan: plan._id,
            precio_total: plan.precio,
            moneda: plan.moneda,
            estado: 'pendiente_pago'
        });
        await writeLog({
            usuario: req.userId,
            evento: 'RENTA_CREADA',
            req,
            mensaje: 'Se creó una reserva pendiente de pago.',
            contexto: { rentaId: rent._id.toString(), casilleroId: locker._id.toString() }
        });
        res.status(201).json({
            id: rent._id.toString(),
            mensaje: 'Reserva creada. Completa el pago simulado antes de 15 minutos.'
        });
    } catch (error) {
        await Casillero.updateOne({ _id: locker._id, estado: 'reservado' }, { $set: { estado: 'disponible' } });
        throw error;
    }
}));

app.get('/api/mi-acceso', requireAuth, asyncRoute(async (req, res) => {
    await expireRents();
    const rent = await Renta.findOne({
        usuario: req.userId,
        estado: 'activa',
        fecha_fin: { $gt: new Date() }
    }).sort({ fecha_inicio: -1 }).populate({
        path: 'casillero',
        populate: { path: 'piso', populate: { path: 'edificio' } }
    });
    if (!rent) return res.json({
        activo: false,
        mensaje: 'El código se mostrará después de confirmar la renta.'
    });
    const locker = rent.casillero;
    const floor = locker?.piso;
    const building = floor?.edificio;
    res.set('Cache-Control', 'no-store');
    res.json({
        activo: true,
        codigo: accessCode(rent._id),
        numero: locker?.numero,
        edificio: building?.nombre || '',
        piso: floor?.numero_piso,
        vence: rent.fecha_fin,
        nota: 'Código de demostración; no abre una cerradura física.'
    });
}));

app.get('/api/rentas', requireAuth, asyncRoute(async (req, res) => {
    await expireRents();
    const rents = await Renta.find({ usuario: req.userId })
        .sort({ fecha_solicitud: -1 })
        .populate(rentPopulate);
    res.json(await Promise.all(rents.map(rentalView)));
}));

app.post('/api/rentas/:id/pagar', requireAuth, asyncRoute(async (req, res) => {
    const rentId = req.params.id;
    if (!validId(rentId)) return fail(res, 400, 'Identificador de renta inválido.');
    await expireRents();
    const rent = await Renta.findOne({ _id: rentId, usuario: req.userId, estado: 'pendiente_pago' })
        .populate('plan', 'duracion_unidad duracion_valor');
    if (!rent) return fail(res, 409, 'Esta reserva ya no admite pagos.');

    const now = new Date();
    const end = new Date(now);
    if (rent.plan.duracion_unidad === 'dia') {
        end.setDate(end.getDate() + rent.plan.duracion_valor);
    } else {
        end.setMonth(end.getMonth() + (rent.plan.duracion_valor * 6));
    }

    const activated = await Renta.findOneAndUpdate(
        { _id: rent._id, usuario: req.userId, estado: 'pendiente_pago' },
        { $set: { estado: 'activa', fecha_inicio: now, fecha_fin: end } },
        { returnDocument: 'after' }
    );
    if (!activated) return fail(res, 409, 'La reserva ya fue procesada.');

    const locker = await Casillero.findOneAndUpdate(
        { _id: rent.casillero, estado: 'reservado' },
        { $set: { estado: 'ocupado' } },
        { returnDocument: 'after' }
    );
    if (!locker) {
        await Renta.updateOne({ _id: rent._id, estado: 'activa' }, {
            $set: { estado: 'pendiente_pago', fecha_inicio: null, fecha_fin: null }
        });
        return fail(res, 409, 'No se pudo asignar el casillero. La reserva permanece pendiente.');
    }

    try {
        await Pago.create({
            renta: rent._id,
            monto: rent.precio_total,
            moneda: rent.moneda,
            metodo_pago: 'otro',
            estado: 'aprobado',
            proveedor: 'SIMULACION',
            pagado_en: now
        });
    } catch (error) {
        await Renta.updateOne({ _id: rent._id, estado: 'activa' }, {
            $set: { estado: 'pendiente_pago', fecha_inicio: null, fecha_fin: null }
        });
        await Casillero.updateOne({ _id: locker._id, estado: 'ocupado' }, { $set: { estado: 'reservado' } });
        throw error;
    }

    await writeLog({
        usuario: req.userId,
        evento: 'PAGO_SIMULADO_APROBADO',
        req,
        mensaje: 'Se confirmó un pago de demostración.',
        contexto: { rentaId: rent._id.toString(), monto: rent.precio_total }
    });
    res.json({ mensaje: 'Pago simulado aprobado. Casillero asignado.' });
}));

app.post('/api/rentas/:id/cancelar', requireAuth, asyncRoute(async (req, res) => {
    if (!validId(req.params.id)) return fail(res, 400, 'Identificador de renta inválido.');
    const rent = await Renta.findOneAndUpdate(
        { _id: req.params.id, usuario: req.userId, estado: 'pendiente_pago' },
        { $set: { estado: 'cancelada' } },
        { returnDocument: 'after' }
    );
    if (!rent) return fail(res, 409, 'Solo se cancelan reservas pendientes.');
    await Casillero.updateOne(
        { _id: rent.casillero, estado: 'reservado' },
        { $set: { estado: 'disponible' } }
    );
    await writeLog({
        usuario: req.userId,
        evento: 'RENTA_CANCELADA',
        req,
        mensaje: 'Se canceló una reserva pendiente.',
        contexto: { rentaId: rent._id.toString() }
    });
    res.json({ mensaje: 'Reserva cancelada.' });
}));

app.get('/api/admin/resumen', requireAdmin, asyncRoute(async (req, res) => {
    await expireRents();
    const [
        totalCasilleros, disponibles, ocupados, reservados,
        usuarios, rentas, pagos, ingresos
    ] = await Promise.all([
        Casillero.countDocuments(),
        Casillero.countDocuments({ estado: 'disponible' }),
        Casillero.countDocuments({ estado: 'ocupado' }),
        Casillero.countDocuments({ estado: 'reservado' }),
        Usuario.countDocuments(),
        Renta.countDocuments(),
        Pago.countDocuments(),
        Pago.aggregate([
            { $match: { estado: 'aprobado' } },
            { $group: { _id: null, total: { $sum: '$monto' } } }
        ])
    ]);
    res.json({
        total: totalCasilleros,
        disponibles,
        ocupados,
        reservados,
        usuarios,
        rentas,
        pagos,
        ingresos: ingresos[0]?.total || 0
    });
}));

app.get('/api/admin/reportes/ocupacion', requireAdmin, asyncRoute(async (req, res) => {
    const data = await Casillero.aggregate([
        { $lookup: { from: 'pisos', localField: 'piso', foreignField: '_id', as: 'pisoDoc' } },
        { $unwind: '$pisoDoc' },
        { $lookup: { from: 'edificios', localField: 'pisoDoc.edificio', foreignField: '_id', as: 'edificioDoc' } },
        { $unwind: '$edificioDoc' },
        { $lookup: { from: 'facultades', localField: 'edificioDoc.facultad', foreignField: '_id', as: 'facultadDoc' } },
        { $unwind: '$facultadDoc' },
        {
            $group: {
                _id: {
                    facultad: '$facultadDoc.nombre',
                    edificio: '$edificioDoc.nombre',
                    piso: '$pisoDoc.numero_piso'
                },
                total: { $sum: 1 },
                disponibles: { $sum: { $cond: [{ $eq: ['$estado', 'disponible'] }, 1, 0] } },
                reservados: { $sum: { $cond: [{ $eq: ['$estado', 'reservado'] }, 1, 0] } },
                ocupados: { $sum: { $cond: [{ $eq: ['$estado', 'ocupado'] }, 1, 0] } },
                mantenimiento: { $sum: { $cond: [{ $eq: ['$estado', 'mantenimiento'] }, 1, 0] } },
                inactivos: { $sum: { $cond: [{ $eq: ['$estado', 'inactivo'] }, 1, 0] } }
            }
        },
        {
            $project: {
                _id: 0,
                facultad: '$_id.facultad',
                edificio: '$_id.edificio',
                piso: '$_id.piso',
                total: 1,
                disponibles: 1,
                reservados: 1,
                ocupados: 1,
                mantenimiento: 1,
                inactivos: 1,
                porcentaje_ocupacion: {
                    $round: [
                        {
                            $multiply: [
                                { $divide: [{ $add: ['$reservados', '$ocupados'] }, '$total'] },
                                100
                            ]
                        },
                        2
                    ]
                }
            }
        },
        { $sort: { facultad: 1, edificio: 1, piso: 1 } }
    ]);
    res.json(data);
}));

app.get('/api/admin/reportes/ingresos-mensuales', requireAdmin, asyncRoute(async (req, res) => {
    const data = await Pago.aggregate([
        { $match: { estado: 'aprobado', pagado_en: { $ne: null } } },
        { $lookup: { from: 'rentas', localField: 'renta', foreignField: '_id', as: 'rentaDoc' } },
        { $unwind: '$rentaDoc' },
        { $lookup: { from: 'casilleros', localField: 'rentaDoc.casillero', foreignField: '_id', as: 'casilleroDoc' } },
        { $unwind: '$casilleroDoc' },
        { $lookup: { from: 'pisos', localField: 'casilleroDoc.piso', foreignField: '_id', as: 'pisoDoc' } },
        { $unwind: '$pisoDoc' },
        { $lookup: { from: 'edificios', localField: 'pisoDoc.edificio', foreignField: '_id', as: 'edificioDoc' } },
        { $unwind: '$edificioDoc' },
        { $lookup: { from: 'facultades', localField: 'edificioDoc.facultad', foreignField: '_id', as: 'facultadDoc' } },
        { $unwind: '$facultadDoc' },
        {
            $group: {
                _id: {
                    periodo: { $dateToString: { format: '%Y-%m', date: '$pagado_en' } },
                    facultad: '$facultadDoc.nombre',
                    moneda: '$moneda'
                },
                pagos_aprobados: { $sum: 1 },
                rentas_pagadas: { $addToSet: '$renta' },
                ingresos: { $sum: '$monto' }
            }
        },
        {
            $project: {
                _id: 0,
                periodo: '$_id.periodo',
                facultad: '$_id.facultad',
                moneda: '$_id.moneda',
                pagos_aprobados: 1,
                rentas_pagadas: { $size: '$rentas_pagadas' },
                ingresos: 1
            }
        },
        { $sort: { periodo: -1, facultad: 1 } }
    ]);
    res.json(data);
}));

app.get('/api/admin/reportes/rentas-por-plan', requireAdmin, asyncRoute(async (req, res) => {
    const data = await Plan.aggregate([
        {
            $lookup: {
                from: 'rentas',
                let: { planId: '$_id' },
                pipeline: [
                    { $match: { $expr: { $eq: ['$plan', '$$planId'] } } },
                    {
                        $lookup: {
                            from: 'pagos',
                            localField: '_id',
                            foreignField: 'renta',
                            as: 'pagos'
                        }
                    },
                    {
                        $addFields: {
                            ingresoConfirmado: {
                                $sum: {
                                    $map: {
                                        input: { $filter: { input: '$pagos', as: 'p', cond: { $eq: ['$$p.estado', 'aprobado'] } } },
                                        as: 'p',
                                        in: '$$p.monto'
                                    }
                                }
                            }
                        }
                    }
                ],
                as: 'rentas'
            }
        },
        {
            $project: {
                _id: 0,
                plan: '$nombre',
                precio_actual: '$precio',
                moneda: 1,
                total_rentas: { $size: '$rentas' },
                rentas_activas: { $size: { $filter: { input: '$rentas', as: 'r', cond: { $eq: ['$$r.estado', 'activa'] } } } },
                rentas_pendientes: { $size: { $filter: { input: '$rentas', as: 'r', cond: { $eq: ['$$r.estado', 'pendiente_pago'] } } } },
                rentas_finalizadas: { $size: { $filter: { input: '$rentas', as: 'r', cond: { $eq: ['$$r.estado', 'finalizada'] } } } },
                rentas_canceladas: { $size: { $filter: { input: '$rentas', as: 'r', cond: { $eq: ['$$r.estado', 'cancelada'] } } } },
                ingresos_confirmados: { $sum: '$rentas.ingresoConfirmado' }
            }
        },
        { $sort: { plan: 1 } }
    ]);
    res.json(data);
}));

app.get('/api/admin/reportes/historial-rentas', requireAdmin, asyncRoute(async (req, res) => {
    const data = await Renta.aggregate([
        { $lookup: { from: 'usuarios', localField: 'usuario', foreignField: '_id', as: 'usuarioDoc' } },
        { $unwind: '$usuarioDoc' },
        { $lookup: { from: 'casilleros', localField: 'casillero', foreignField: '_id', as: 'casilleroDoc' } },
        { $unwind: '$casilleroDoc' },
        { $lookup: { from: 'pisos', localField: 'casilleroDoc.piso', foreignField: '_id', as: 'pisoDoc' } },
        { $unwind: '$pisoDoc' },
        { $lookup: { from: 'edificios', localField: 'pisoDoc.edificio', foreignField: '_id', as: 'edificioDoc' } },
        { $unwind: '$edificioDoc' },
        { $lookup: { from: 'facultades', localField: 'edificioDoc.facultad', foreignField: '_id', as: 'facultadDoc' } },
        { $unwind: '$facultadDoc' },
        { $lookup: { from: 'planes', localField: 'plan', foreignField: '_id', as: 'planDoc' } },
        { $unwind: '$planDoc' },
        {
            $lookup: {
                from: 'pagos',
                let: { rentId: '$_id' },
                pipeline: [
                    { $match: { $expr: { $eq: ['$renta', '$$rentId'] } } },
                    { $sort: { creado_en: -1 } },
                    { $limit: 1 }
                ],
                as: 'ultimoPago'
            }
        },
        { $unwind: { path: '$ultimoPago', preserveNullAndEmptyArrays: true } },
        {
            $project: {
                _id: 0,
                renta_id: { $toString: '$_id' },
                matricula: '$usuarioDoc.matricula',
                alumno: { $concat: ['$usuarioDoc.nombre', ' ', '$usuarioDoc.apellidos'] },
                correo: '$usuarioDoc.correo',
                facultad: '$facultadDoc.nombre',
                edificio: '$edificioDoc.nombre',
                numero_piso: '$pisoDoc.numero_piso',
                numero_casillero: '$casilleroDoc.numero',
                plan: '$planDoc.nombre',
                estado_renta: '$estado',
                precio_total: '$precio_total',
                moneda: '$moneda',
                fecha_solicitud: '$fecha_solicitud',
                fecha_inicio: '$fecha_inicio',
                fecha_fin: '$fecha_fin',
                estado_ultimo_pago: '$ultimoPago.estado',
                monto_ultimo_pago: '$ultimoPago.monto'
            }
        },
        { $sort: { fecha_solicitud: -1 } },
        { $limit: 500 }
    ]);
    res.json(data);
}));

const resourceSpecs = {
    roles: { Model: Rol, fields: ['nombre', 'descripcion'] },
    facultades: { Model: Facultad, fields: ['nombre', 'activa'] },
    usuarios: {
        Model: Usuario,
        fields: ['rol', 'facultad', 'nombre', 'apellidos', 'matricula', 'correo', 'estado', 'password'],
        populate: [{ path: 'rol', select: 'nombre' }, { path: 'facultad', select: 'nombre' }]
    },
    edificios: { Model: Edificio, fields: ['facultad', 'nombre', 'activo'], populate: [{ path: 'facultad', select: 'nombre' }] },
    pisos: { Model: Piso, fields: ['edificio', 'numero_piso', 'activo'], populate: [{ path: 'edificio', select: 'nombre' }] },
    casilleros: { Model: Casillero, fields: ['piso', 'numero', 'fila', 'columna', 'estado'], populate: [{ path: 'piso', select: 'numero_piso' }] },
    planes: { Model: Plan, fields: ['nombre', 'descripcion', 'duracion_valor', 'duracion_unidad', 'precio', 'moneda', 'activo'] },
    rentas: {
        Model: Renta,
        fields: ['usuario', 'casillero', 'plan', 'estado', 'precio_total', 'moneda', 'fecha_inicio', 'fecha_fin'],
        populate: rentPopulate
    },
    pagos: { Model: Pago, fields: ['renta', 'monto', 'moneda', 'metodo_pago', 'estado', 'proveedor', 'referencia_externa', 'pagado_en'], populate: [{ path: 'renta', select: 'estado precio_total' }] },
    logs: { Model: LogSistema, fields: ['usuario', 'nivel', 'evento', 'metodo_http', 'endpoint', 'mensaje', 'contexto_json'], populate: [{ path: 'usuario', select: 'nombre apellidos correo' }] }
};

const referenceSpecs = {
    usuarios: { rol: Rol, facultad: Facultad },
    edificios: { facultad: Facultad },
    pisos: { edificio: Edificio },
    casilleros: { piso: Piso },
    rentas: { usuario: Usuario, casillero: Casillero, plan: Plan },
    pagos: { renta: Renta },
    logs: { usuario: Usuario }
};

const deleteGuards = {
    roles: [[Usuario, 'rol', 'Hay usuarios que utilizan este rol.']],
    facultades: [
        [Usuario, 'facultad', 'Hay usuarios asociados a esta facultad.'],
        [Edificio, 'facultad', 'Hay edificios asociados a esta facultad.']
    ],
    edificios: [[Piso, 'edificio', 'El edificio todavía contiene pisos.']],
    pisos: [[Casillero, 'piso', 'El piso todavía contiene casilleros.']],
    casilleros: [[Renta, 'casillero', 'El casillero tiene rentas registradas.']],
    planes: [[Renta, 'plan', 'El plan tiene rentas registradas.']],
    usuarios: [
        [Renta, 'usuario', 'El usuario tiene rentas registradas.'],
        [LogSistema, 'usuario', 'El usuario aparece en registros del sistema.']
    ],
    rentas: [[Pago, 'renta', 'La renta tiene pagos registrados.']]
};

function pickFields(source, fields) {
    const result = {};
    for (const field of fields) {
        if (Object.prototype.hasOwnProperty.call(source, field)) result[field] = source[field];
    }
    return result;
}

async function validateReferences(resource, data, isCreate) {
    const refs = referenceSpecs[resource] || {};
    for (const [field, Model] of Object.entries(refs)) {
        if (data[field] === undefined && !isCreate) continue;
        if (data[field] === undefined || data[field] === null || data[field] === '') {
            if (field === 'usuario' && resource === 'logs') continue;
            throw Object.assign(new Error('El campo de referencia ' + field + ' es obligatorio.'), { status: 400 });
        }
        if (!validId(data[field])) throw Object.assign(new Error('Identificador inválido en ' + field + '.'), { status: 400 });
        const exists = await Model.exists({ _id: data[field] });
        if (!exists) throw Object.assign(new Error('No existe el registro relacionado en ' + field + '.'), { status: 400 });
    }
}

async function prepareAdminData(resource, body, isCreate) {
    const spec = resourceSpecs[resource];
    const data = pickFields(body || {}, spec.fields);
    if (resource === 'usuarios') {
        if (data.correo !== undefined) data.correo = email(data.correo);
        if (data.password) {
            if (String(data.password).length < 8) throw Object.assign(new Error('La contraseña debe tener al menos 8 caracteres.'), { status: 400 });
            data.passwordHash = await bcrypt.hash(String(data.password), 12);
        } else if (isCreate) {
            throw Object.assign(new Error('La contraseña es obligatoria al crear un usuario.'), { status: 400 });
        }
        delete data.password;
    }
    if (resource === 'logs' && typeof data.contexto_json === 'string' && data.contexto_json.trim()) {
        try { data.contexto_json = JSON.parse(data.contexto_json); }
        catch { throw Object.assign(new Error('contexto_json debe contener JSON válido.'), { status: 400 }); }
    }
    if (resource === 'rentas' && data.precio_total !== undefined) data.precio_total = Number(data.precio_total);
    if (resource === 'pagos' && data.monto !== undefined) data.monto = Number(data.monto);
    if (resource === 'planes' && data.precio !== undefined) data.precio = Number(data.precio);
    if (resource === 'casilleros') {
        for (const field of ['numero', 'fila', 'columna']) if (data[field] !== undefined) data[field] = Number(data[field]);
    }
    if (resource === 'pisos' && data.numero_piso !== undefined) data.numero_piso = Number(data.numero_piso);
    if (resource === 'planes' && data.duracion_valor !== undefined) data.duracion_valor = Number(data.duracion_valor);
    return data;
}

app.get('/api/admin/:resource', requireAdmin, asyncRoute(async (req, res) => {
    const spec = resourceSpecs[req.params.resource];
    if (!spec) return fail(res, 404, 'Recurso administrativo no encontrado.');
    let query = spec.Model.find().sort({ creado_en: -1 }).limit(2000);
    for (const populate of spec.populate || []) query = query.populate(populate);
    const data = await query;
    res.json(data);
}));

app.post('/api/admin/:resource', requireAdmin, asyncRoute(async (req, res) => {
    const resource = req.params.resource;
    const spec = resourceSpecs[resource];
    if (!spec) return fail(res, 404, 'Recurso administrativo no encontrado.');
    const data = await prepareAdminData(resource, req.body, true);
    await validateReferences(resource, data, true);
    const created = await spec.Model.create(data);
    await writeLog({
        usuario: req.userId,
        evento: 'ADMIN_CREATE_' + resource.toUpperCase(),
        req,
        mensaje: 'Un administrador creó un registro.',
        contexto: { resource, id: created._id.toString() }
    });
    res.status(201).json({ mensaje: 'Registro creado correctamente.', id: created._id.toString() });
}));

app.put('/api/admin/:resource/:id', requireAdmin, asyncRoute(async (req, res) => {
    const resource = req.params.resource;
    const spec = resourceSpecs[resource];
    if (!spec) return fail(res, 404, 'Recurso administrativo no encontrado.');
    if (!validId(req.params.id)) return fail(res, 400, 'Identificador inválido.');
    const data = await prepareAdminData(resource, req.body, false);
    await validateReferences(resource, data, false);
    const doc = await spec.Model.findById(req.params.id);
    if (!doc) return fail(res, 404, 'Registro no encontrado.');
    Object.assign(doc, data);
    await doc.save();
    await writeLog({
        usuario: req.userId,
        evento: 'ADMIN_UPDATE_' + resource.toUpperCase(),
        req,
        mensaje: 'Un administrador actualizó un registro.',
        contexto: { resource, id: doc._id.toString() }
    });
    res.json({ mensaje: 'Registro actualizado correctamente.' });
}));

app.delete('/api/admin/:resource/:id', requireAdmin, asyncRoute(async (req, res) => {
    const resource = req.params.resource;
    const spec = resourceSpecs[resource];
    if (!spec) return fail(res, 404, 'Recurso administrativo no encontrado.');
    if (!validId(req.params.id)) return fail(res, 400, 'Identificador inválido.');
    for (const [Model, field, message] of deleteGuards[resource] || []) {
        if (await Model.exists({ [field]: req.params.id })) return fail(res, 409, message);
    }
    const deleted = await spec.Model.findByIdAndDelete(req.params.id);
    if (!deleted) return fail(res, 404, 'Registro no encontrado.');
    await writeLog({
        usuario: req.userId,
        evento: 'ADMIN_DELETE_' + resource.toUpperCase(),
        req,
        mensaje: 'Un administrador eliminó un registro.',
        contexto: { resource, id: req.params.id }
    });
    res.json({ mensaje: 'Registro eliminado correctamente.' });
}));

app.use((req, res, next) => {
    let decoded = req.path;
    try { decoded = decodeURIComponent(req.path); } catch { return res.sendStatus(400); }
    if (/(^|\/)\.|\.env|\.sql$|\.json$|\.md$|\.map$/i.test(decoded) ||
        /^\/(?:logs|tests|node_modules|docs)(?:\/|$)/i.test(decoded) ||
        ['/server.js', '/db.js', '/models.js', '/seed.js'].includes(decoded)) {
        return res.sendStatus(404);
    }
    next();
});

app.use(express.static(path.join(__dirname), { index: 'index.html' }));

app.use((req, res) => fail(res, 404, 'Ruta no encontrada.'));

app.use(async (err, req, res, next) => {
    console.error(err);
    const status = err.code === 11000 ? 409 : (err.status || (err.name === 'ValidationError' || err.name === 'CastError' || err.name === 'StrictModeError' ? 400 : 500));
    const safeMessage = status < 500 ? err.message : 'Error interno. Revisa los registros del servidor.';
    await writeLog({
        usuario: req.userId || null,
        nivel: status >= 500 ? 'ERROR' : 'WARNING',
        evento: 'ERROR_HTTP',
        req,
        mensaje: err.message || 'Error no identificado.',
        contexto: { status, code: err.code || null }
    });
    if (err.code === 11000) return fail(res, 409, 'El correo, matrícula o nombre ya está registrado.');
    if (err.name === 'ValidationError') return fail(res, 400, 'Los datos enviados no cumplen las validaciones: ' + err.message);
    if (err.name === 'CastError') return fail(res, 400, 'Uno de los identificadores o valores enviados no es válido.');
    return fail(res, status, safeMessage);
});

let httpServer = null;

async function start() {
    await connectDB();
    await writeLog({ nivel: 'INFO', evento: 'BACKEND_START', mensaje: 'Backend iniciado correctamente en el puerto ' + PORT + '.' });
    httpServer = app.listen(PORT, () => console.log('Easy Locker listo en http://localhost:' + PORT));
    return httpServer;
}

async function shutdown(signal) {
    await writeLog({ nivel: 'WARNING', evento: 'BACKEND_STOP', mensaje: 'El backend recibió la señal ' + signal + ' y está cerrando.' });
    if (httpServer) {
        httpServer.close(async () => {
            await mongoose.disconnect().catch(() => {});
            process.exit(0);
        });
    } else {
        await mongoose.disconnect().catch(() => {});
        process.exit(0);
    }
}

if (require.main === module) {
    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));
    start().catch(async error => {
        console.error('No se pudo iniciar Easy Locker:', error);
        await mongoose.disconnect().catch(() => {});
        process.exit(1);
    });

    process.on('unhandledRejection', async error => {
        console.error('Promesa no controlada:', error);
        await writeLog({
            nivel: 'CRITICAL',
            evento: 'UNHANDLED_REJECTION',
            mensaje: error?.message || String(error)
        });
    });
    process.on('uncaughtException', async error => {
        console.error('Excepción no controlada:', error);
        await writeLog({
            nivel: 'CRITICAL',
            evento: 'UNCAUGHT_EXCEPTION',
            mensaje: error?.message || String(error)
        });
        process.exit(1);
    });
}

module.exports = app;
