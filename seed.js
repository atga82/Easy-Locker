require('dotenv').config();
const bcrypt = require('bcryptjs');
const { connectDB, disconnectDB } = require('./db');
const {
    Rol, Facultad, Usuario, Edificio, Piso, Casillero, Plan, Renta, Pago, LogSistema
} = require('./models');

async function upsertBy(Model, filter, values) {
    return Model.findOneAndUpdate(
        filter,
        { $setOnInsert: values },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
}

async function seedDatabase() {
    const allModels = [Rol, Facultad, Usuario, Edificio, Piso, Casillero, Plan, Renta, Pago, LogSistema];
    for (const Model of allModels) {
        try {
            await Model.createCollection();
        } catch (error) {
            if (error.code !== 48 && error.codeName !== 'NamespaceExists') throw error;
        }
    }

    const studentRole = await upsertBy(Rol, { nombre: 'estudiante' }, {
        nombre: 'estudiante',
        descripcion: 'Usuario que solicita y administra rentas de casilleros'
    });
    const adminRole = await upsertBy(Rol, { nombre: 'administrador' }, {
        nombre: 'administrador',
        descripcion: 'Administra inventario, usuarios, rentas y reportes'
    });

    const facultyNames = [
        'Facultad de Ciencias Físico-Matemáticas',
        'Facultad de Ingeniería Mecánica y Eléctrica',
        'Facultad de Artes Visuales',
        'Otra facultad'
    ];
    const faculties = [];
    for (const nombre of facultyNames) {
        faculties.push(await upsertBy(Facultad, { nombre }, { nombre, activa: true }));
    }

    const planData = [
        {
            nombre: 'Renta diaria',
            descripcion: 'Uso del casillero durante un día.',
            duracion_valor: 1,
            duracion_unidad: 'dia',
            precio: 25,
            max_casilleros: 1,
            cambios_por_semana: 0,
            moneda: 'MXN',
            activo: true
        },
        {
            nombre: 'Plan mensual',
            descripcion: 'Un casillero fijo durante un mes. Incluye un código de acceso.',
            duracion_valor: 1,
            duracion_unidad: 'mes',
            precio: 270,
            max_casilleros: 1,
            cambios_por_semana: 0,
            moneda: 'MXN',
            activo: true
        },
        {
            nombre: 'Renta semestral',
            descripcion: 'Hasta dos casilleros durante seis meses; se permite cambiar uno cada siete días.',
            duracion_valor: 1,
            duracion_unidad: 'semestre',
            precio: 650,
            max_casilleros: 2,
            cambios_por_semana: 1,
            moneda: 'MXN',
            activo: true
        }
    ];
    for (const plan of planData) {
        await upsertBy(Plan, { nombre: plan.nombre }, plan);
    }

    for (const faculty of faculties.filter(f => f.nombre !== 'Otra facultad')) {
        for (const buildingName of ['Edificio A', 'Edificio B']) {
            const building = await upsertBy(
                Edificio,
                { facultad: faculty._id, nombre: buildingName },
                { facultad: faculty._id, nombre: buildingName, activo: true }
            );

            for (const number of [1, 2, 3]) {
                const floor = await upsertBy(
                    Piso,
                    { edificio: building._id, numero_piso: number },
                    { edificio: building._id, numero_piso: number, activo: true }
                );

                for (let lockerNumber = 1; lockerNumber <= 48; lockerNumber += 1) {
                    const fila = Math.floor((lockerNumber - 1) / 12) + 1;
                    const columna = ((lockerNumber - 1) % 12) + 1;
                    await upsertBy(
                        Casillero,
                        { piso: floor._id, numero: lockerNumber },
                        {
                            piso: floor._id,
                            numero: lockerNumber,
                            fila,
                            columna,
                            estado: 'disponible'
                        }
                    );
                }
            }
        }
    }

    const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const adminPassword = String(process.env.ADMIN_PASSWORD || '');
    if (adminEmail && adminPassword) {
        if (!/^\S+@\S+\.\S+$/.test(adminEmail) || adminPassword.length < 12) {
            throw new Error('ADMIN_EMAIL inválido o ADMIN_PASSWORD debe tener al menos 12 caracteres.');
        }
        const faculty = faculties[0];
        const hash = await bcrypt.hash(adminPassword, 12);
        await Usuario.findOneAndUpdate(
            { correo: adminEmail },
            {
                $setOnInsert: {
                    rol: adminRole._id,
                    facultad: faculty._id,
                    nombre: 'Administrador',
                    apellidos: 'Easy Locker',
                    matricula: 'ADMIN-001',
                    correo: adminEmail,
                    passwordHash: hash,
                    estado: 'activo'
                }
            },
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        );
        console.log('Cuenta administrativa verificada:', adminEmail);
    } else {
        console.log('ADMIN_EMAIL/ADMIN_PASSWORD no configurados: no se creó una cuenta administrativa.');
    }

    console.log('Datos iniciales verificados: 2 roles, 4 facultades, 2 planes y ubicaciones/casilleros de demostración.');
    return { studentRole, adminRole };
}

if (require.main === module) {
    connectDB()
        .then(seedDatabase)
        .then(() => disconnectDB())
        .catch(async error => {
            console.error('Error al inicializar MongoDB:', error);
            await disconnectDB();
            process.exitCode = 1;
        });
}

module.exports = { seedDatabase };
