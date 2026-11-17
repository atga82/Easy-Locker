const bcrypt = require('bcryptjs');
const Usuario = require('../models/Usuario');
const Plan = require('../models/Plan');
const Casillero = require('../models/Casillero');

const seedDatabase = async () => {
  try {
    // 1. Seed Planes
    const totalPlanes = await Plan.countDocuments();
    if (totalPlanes === 0) {
      console.log('[Seeder] Creando planes de renta predeterminados...');
      await Plan.insertMany([
        {
          nombre: 'Renta diaria',
          descripcion: 'Uso del casillero durante un día.',
          duracion_valor: 1,
          duracion_unidad: 'dia',
          precio: 25.0,
          moneda: 'MXN',
          activo: true,
        },
        {
          nombre: 'Renta semestral',
          descripcion: 'Uso del casillero durante todo el semestre académico.',
          duracion_valor: 1,
          duracion_unidad: 'semestre',
          precio: 650.0,
          moneda: 'MXN',
          activo: true,
        },
      ]);
      console.log('[Seeder] Planes creados exitosamente.');
    }

    // 2. Seed Usuarios (Admin y Alumno de prueba)
    const adminExiste = await Usuario.findOne({ correo: 'admin@uanl.edu.mx' });
    if (!adminExiste) {
      console.log('[Seeder] Creando usuario administrador predeterminado...');
      const adminPassHash = await bcrypt.hash('admin12345', 10);
      await Usuario.create({
        nombre: 'Administrador',
        apellidos: 'Easy Locker',
        matricula: 'ADMIN001',
        correo: 'admin@uanl.edu.mx',
        password: adminPassHash,
        facultad: 'Facultad de Ciencias Físico-Matemáticas',
        rol: 'administrador',
        estado: 'activo',
      });
      console.log('[Seeder] Usuario administrador creado (admin@uanl.edu.mx / admin12345).');
    }

    const alumnoExiste = await Usuario.findOne({ correo: 'alumno@uanl.edu.mx' });
    if (!alumnoExiste) {
      console.log('[Seeder] Creando alumno de prueba...');
      const alumnoPassHash = await bcrypt.hash('alumno12345', 10);
      await Usuario.create({
        nombre: 'Juan',
        apellidos: 'Pérez García',
        matricula: '2001234',
        correo: 'alumno@uanl.edu.mx',
        password: alumnoPassHash,
        facultad: 'Facultad de Ciencias Físico-Matemáticas',
        rol: 'estudiante',
        estado: 'activo',
      });
      console.log('[Seeder] Alumno de prueba creado (alumno@uanl.edu.mx / alumno12345).');
    }

    // 3. Seed Casilleros
    const totalCasilleros = await Casillero.countDocuments();
    if (totalCasilleros === 0) {
      console.log('[Seeder] Generando inventario de casilleros iniciales...');
      const facultades = [
        'Facultad de Ciencias Físico-Matemáticas',
        'Facultad de Ingeniería Mecánica y Eléctrica',
        'Facultad de Artes Visuales',
      ];
      const edificios = ['Edificio A', 'Edificio B'];
      const pisos = [1, 2, 3];
      const casilleros = [];

      for (const facultad of facultades) {
        for (const edificio of edificios) {
          for (const piso of pisos) {
            for (let num = 1; num <= 48; num++) {
              casilleros.push({
                facultad,
                edificio,
                piso,
                numero: num,
                fila: Math.floor((num - 1) / 12) + 1,
                columna: ((num - 1) % 12) + 1,
                estado: 'disponible',
              });
            }
          }
        }
      }

      await Casillero.insertMany(casilleros);
      console.log(`[Seeder] Se registraron ${casilleros.length} casilleros correctamente.`);
    }
  } catch (error) {
    console.error('[Seeder ERROR] Error al sembrar datos iniciales:', error.message);
  }
};

// Permite ejecutar directamente via: node utils/seeder.js
if (require.main === module) {
  require('dotenv').config();
  const connectDB = require('../config/db');
  (async () => {
    const ok = await connectDB();
    if (ok) {
      await seedDatabase();
      console.log('[Seeder] Datos listos. Cerrando conexión.');
      process.exit(0);
    } else {
      process.exit(1);
    }
  })();
}

module.exports = seedDatabase;
