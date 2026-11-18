require('dotenv').config();
const { connectDB, disconnectDB } = require('../db');
const { Plan } = require('../models');

async function ejecutar() {
    try {
        await connectDB();
        const planes = [
            { nombre: 'Renta diaria', descripcion: 'Un casillero durante 24 horas.', duracion_valor: 1, duracion_unidad: 'dia', precio: 25, max_casilleros: 1, cambios_por_semana: 0, moneda: 'MXN', activo: true },
            { nombre: 'Plan mensual', descripcion: 'Un casillero fijo durante un mes. No se permite cambiarlo.', duracion_valor: 1, duracion_unidad: 'mes', precio: 270, max_casilleros: 1, cambios_por_semana: 0, moneda: 'MXN', activo: true },
            { nombre: 'Renta semestral', descripcion: 'Hasta dos casilleros durante seis meses. Un cambio de un casillero cada siete días.', duracion_valor: 1, duracion_unidad: 'semestre', precio: 650, max_casilleros: 2, cambios_por_semana: 1, moneda: 'MXN', activo: true }
        ];
        for (const plan of planes) {
            await Plan.findOneAndUpdate({ nombre: plan.nombre }, { $set: plan }, { upsert: true, new: true, runValidators: true });
        }
        console.log('Planes actualizados: diario $25, mensual $270, semestral $650.');
        console.log('Las rentas existentes no fueron modificadas.');
    } finally {
        await disconnectDB();
    }
}
ejecutar().catch(err => { console.error('Error actualizando planes:', err.message); process.exitCode = 1; });
