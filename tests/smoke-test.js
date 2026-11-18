require('dotenv').config();
const assert = require('node:assert/strict');
const { connectDB, disconnectDB } = require('../db');
const { Usuario, Renta, Pago, Casillero, LogSistema } = require('../models');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:' + (process.env.PORT || 3000);
const results = [];

async function request(path, options = {}) {
    const response = await fetch(BASE_URL + path, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });
    const type = response.headers.get('content-type') || '';
    const body = type.includes('application/json') ? await response.json() : await response.text();
    return { response, body };
}

async function cleanTestUser(correo) {
    await connectDB();
    try {
        const user = await Usuario.findOne({ correo });
        if (!user) return;
        const rents = await Renta.find({ usuario: user._id }).select('_id casillero casillero_extra').lean();
        const rentIds = rents.map(rent => rent._id);
        const lockerIds = rents.flatMap(rent => [rent.casillero, rent.casillero_extra].filter(Boolean));
        if (rentIds.length) {
            await Pago.deleteMany({ renta: { $in: rentIds } });
            await Renta.deleteMany({ _id: { $in: rentIds } });
            await Casillero.updateMany(
                { _id: { $in: lockerIds }, estado: { $in: ['reservado', 'ocupado'] } },
                { $set: { estado: 'disponible' } }
            );
        }
        await LogSistema.deleteMany({ usuario: user._id });
        await Usuario.deleteOne({ _id: user._id });
    } finally {
        await disconnectDB();
    }
}

async function main() {
    const summary = {};
    const testEmail = 'qa.smoke.' + Date.now() + '@easylocker.local';

    const anonymousChecks = await Promise.all([
        request('/api/estado'),
        request('/api/admin/roles'),
        request('/api/planes'),
        request('/api/casilleros?facultad=FCFM&edificio=A&piso=1')
    ]);
    for (const result of anonymousChecks) {
        assert.equal(result.response.status, 401, 'Toda ruta funcional debe exigir JWT salvo registro y login.');
    }
    results.push('Protección JWT de todas las rutas funcionales sin token: OK');

    assert.ok(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD, 'Configura las credenciales administrativas en .env.');
    const adminLogin = await request('/api/login', {
        method: 'POST',
        body: JSON.stringify({
            correo: process.env.ADMIN_EMAIL,
            contrasena: process.env.ADMIN_PASSWORD
        })
    });
    assert.equal(adminLogin.response.status, 200);
    assert.ok(adminLogin.body.token);
    assert.equal(adminLogin.body.usuario.rol, 'administrador');
    const adminHeaders = { Authorization: 'Bearer ' + adminLogin.body.token };
    const health = await request('/api/estado', { headers: adminHeaders });
    assert.equal(health.response.status, 200);
    assert.equal(health.body.motor, 'MongoDB');
    assert.equal(health.body.estado, 'conectada');
    results.push('Login administrativo, emisión JWT y conexión MongoDB: OK');

    const resources = [
        'roles', 'facultades', 'usuarios', 'edificios', 'pisos',
        'casilleros', 'planes', 'rentas', 'pagos', 'logs'
    ];
    for (const resource of resources) {
        const result = await request('/api/admin/' + resource, { headers: adminHeaders });
        assert.equal(result.response.status, 200, 'Error al listar la colección ' + resource + '.');
        assert.ok(Array.isArray(result.body));
        summary[resource] = result.body.length;
    }
    results.push('Lectura administrativa de las diez colecciones: OK');

    const createdRole = await request('/api/admin/roles', {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
            nombre: 'qa-migracion-temporal',
            descripcion: 'Registro temporal para verificar CRUD'
        })
    });
    assert.equal(createdRole.response.status, 201);
    const roleId = createdRole.body.id;
    try {
        const updated = await request('/api/admin/roles/' + roleId, {
            method: 'PUT',
            headers: adminHeaders,
            body: JSON.stringify({ descripcion: 'CRUD verificado' })
        });
        assert.equal(updated.response.status, 200);
        const deleted = await request('/api/admin/roles/' + roleId, {
            method: 'DELETE',
            headers: adminHeaders
        });
        assert.equal(deleted.response.status, 200);
    } catch (error) {
        await request('/api/admin/roles/' + roleId, { method: 'DELETE', headers: adminHeaders }).catch(() => {});
        throw error;
    }
    results.push('Ciclo administrativo POST, PUT y DELETE: OK');

    const facultyName = 'Facultad de Ciencias Físico-Matemáticas';
    const facultyQuery = encodeURIComponent(facultyName);
    const lockerResult = await request(
        '/api/casilleros?facultad=' + facultyQuery + '&edificio=Edificio%20A&piso=1',
        { headers: adminHeaders }
    );
    assert.equal(lockerResult.response.status, 200);
    assert.equal(lockerResult.body.length, 48);
    const availableLocker = lockerResult.body.find(locker => locker.estado === 'disponible');
    assert.ok(availableLocker, 'Debe existir un casillero disponible para la prueba.');

    const plans = await request('/api/planes', { headers: adminHeaders });
    assert.equal(plans.response.status, 200);
    assert.equal(plans.body.length, 3);
    results.push('Consulta pública de casilleros y planes: OK');

    try {
        const registered = await request('/api/registro', {
            method: 'POST',
            body: JSON.stringify({
                nombre: 'Usuario',
                apellidos: 'Prueba QA',
                matricula: String(Date.now()).slice(-10),
                correo: testEmail,
                facultad: facultyName,
                contrasena: 'TemporalQA2026!'
            })
        });
        assert.equal(registered.response.status, 201);

        const userLogin = await request('/api/login', {
            method: 'POST',
            body: JSON.stringify({ correo: testEmail, contrasena: 'TemporalQA2026!' })
        });
        assert.equal(userLogin.response.status, 200);
        const userHeaders = { Authorization: 'Bearer ' + userLogin.body.token };
        const me = await request('/api/yo', { headers: userHeaders });
        assert.equal(me.response.status, 200);
        assert.equal(me.body.correo, testEmail);
        results.push('Registro, login y consulta protegida de perfil: OK');

        const createdRent = await request('/api/rentas', {
            method: 'POST',
            headers: userHeaders,
            body: JSON.stringify({
                casilleroId: availableLocker.id,
                planId: plans.body[0].id
            })
        });
        assert.equal(createdRent.response.status, 201);
        const rentId = createdRent.body.id;

        const pending = await request('/api/rentas', { headers: userHeaders });
        assert.equal(pending.response.status, 200);
        assert.ok(pending.body.some(rent => rent.id === rentId && rent.estado === 'pendiente_pago'));

        const paid = await request('/api/rentas/' + rentId + '/pagar', {
            method: 'POST',
            headers: userHeaders,
            body: JSON.stringify({})
        });
        assert.equal(paid.response.status, 200);



        const access = await request('/api/mi-acceso', { headers: userHeaders });
        assert.equal(access.response.status, 200);
        assert.equal(access.body.activo, true);
        assert.match(access.body.codigo, /^\d{6}$/);

        const activeRents = await request('/api/rentas', { headers: userHeaders });
        assert.ok(activeRents.body.some(rent => rent.id === rentId && rent.estado === 'activa'));
        results.push('Reserva, pago simulado, historial y código de acceso: OK');

        const reportPaths = [
            'ocupacion', 'ingresos-mensuales', 'rentas-por-plan', 'historial-rentas'
        ];
        for (const report of reportPaths) {
            const result = await request('/api/admin/reportes/' + report, { headers: adminHeaders });
            assert.equal(result.response.status, 200, 'Falló el reporte ' + report + '.');
            assert.ok(Array.isArray(result.body));
            summary['reporte_' + report.replaceAll('-', '_')] = result.body.length;
        }
        assert.ok(summary.reporte_ocupacion > 0);
        assert.ok(summary.reporte_ingresos_mensuales > 0);
        assert.ok(summary.reporte_rentas_por_plan > 0);
        assert.ok(summary.reporte_historial_rentas > 0);
        results.push('Los cuatro reportes combinados devuelven datos: OK');
    } finally {
        await cleanTestUser(testEmail);
    }

    for (const page of ['/index.html', '/registro.html', '/login.html', '/casilleros.html', '/Admin.html']) {
        const result = await request(page);
        assert.equal(result.response.status, 200, 'No se pudo servir ' + page + '.');
    }
    results.push('Entrega de las páginas HTML principales: OK');

    console.log(JSON.stringify({
        estado: 'APROBADO',
        pruebas: results,
        conteosInicialesColecciones: summary
    }, null, 2));
}

main().catch(error => {
    console.error('PRUEBA FALLIDA:', error);
    process.exitCode = 1;
});
