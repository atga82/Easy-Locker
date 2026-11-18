// Easy Locker: el frontend solo consume la API; nunca se conecta directamente a MongoDB.
const $ = id => document.getElementById(id);
const message = (id, value) => { const element = $(id); if (element) element.textContent = value; };
const text = (id, value) => { if ($(id)) $(id).textContent = value ?? '—'; };
const field = id => $(id)?.value?.trim() || '';
const tokenKey = 'easyLockerToken';
const urlPage = window.location.pathname.toLowerCase();
const privatePages = [
    '/cuenta.html', '/datos.html', '/historial.html', '/pago.html',
    '/casilleros.html', '/planes.html', '/admin.html'
];

let currentUser = null;

async function api(url, options = {}) {
    const token = sessionStorage.getItem(tokenKey);
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token) headers.Authorization = 'Bearer ' + token;

    const response = await fetch(url, {
        credentials: 'same-origin',
        ...options,
        headers
    });
    const data = await response.json().catch(() => ({ mensaje: 'Respuesta no válida del servidor.' }));

    if (response.status === 401 && token) sessionStorage.removeItem(tokenKey);
    if (!response.ok) throw new Error(data.mensaje || 'No se pudo completar la operación.');
    return data;
}

const send = (url, data, method = 'POST') =>
    api(url, { method, body: JSON.stringify(data) });

async function getUser() {
    try {
        currentUser = await api('/api/yo');
        return currentUser;
    } catch {
        currentUser = null;
        return null;
    }
}

function setupNav() {
    const button = $('botonMenu');
    const navigation = $('navegacion');
    if (button && navigation) {
        button.addEventListener('click', () => navigation.classList.toggle('abierto'));
    }

    const menu = navigation || document.querySelector('header');
    if (!menu || $('navSesion')) return;

    const link = document.createElement('a');
    link.href = 'login.html';
    link.id = 'navSesion';
    link.textContent = 'Iniciar sesión';
    menu.appendChild(link);

    link.addEventListener('click', async event => {
        if (!currentUser) return;
        event.preventDefault();
        try { await send('/api/logout', {}); } catch {}
        sessionStorage.removeItem(tokenKey);
        currentUser = null;
        location.href = 'login.html';
    });
}

async function init() {
    setupNav();
    const user = await getUser();
    const navLink = $('navSesion');
    if (navLink) navLink.textContent = user ? 'Cerrar sesión' : 'Iniciar sesión';

    if (privatePages.includes(urlPage) && !user) {
        location.href = 'login.html?volver=' + encodeURIComponent(location.pathname);
        return;
    }
    if (urlPage === '/admin.html' && user.rol !== 'administrador') {
        location.href = 'cuenta.html';
        return;
    }

    if ($('formRegistro')) setupRegistro();
    if ($('formLogin')) setupLogin();
    if ($('cuentaNombre')) setupCuenta();
    if ($('filasCasilleros')) setupCasilleros();
    if (document.querySelector('.boton-plan')) setupPlanes();
    if ($('formPago')) setupPago();
    if ($('tablaHistorial')) setupHistorial();
    if ($('adminResumen')) setupAdmin();
}

function setupRegistro() {
    $('formRegistro').addEventListener('submit', async event => {
        event.preventDefault();
        const data = {
            nombre: field('nombre'),
            apellidos: field('apellidos'),
            matricula: field('matricula'),
            correo: field('correo'),
            facultad: field('facultad'),
            contrasena: $('contrasena').value
        };
        if (data.contrasena !== $('confirmar').value) {
            return message('mensajeRegistro', 'Las contraseñas no coinciden.');
        }
        try {
            const result = await send('/api/registro', data);
            message('mensajeRegistro', result.mensaje);
            setTimeout(() => location.href = 'login.html', 1000);
        } catch (error) {
            message('mensajeRegistro', error.message);
        }
    });
}

function setupLogin() {
    $('formLogin').addEventListener('submit', async event => {
        event.preventDefault();
        try {
            const result = await send('/api/login', {
                correo: field('loginCorreo'),
                contrasena: $('loginContrasena').value
            });
            sessionStorage.setItem(tokenKey, result.token);
            message('mensajeLogin', '¡Bienvenido!');
            const back = new URLSearchParams(location.search).get('volver');
            location.href = back && back.startsWith('/') && !back.startsWith('//')
                ? back
                : 'cuenta.html';
        } catch (error) {
            message('mensajeLogin', error.message);
        }
    });
}

async function cargarAcceso() {
    try {
        const result = await api('/api/mi-acceso');
        text('codigoAcceso', result.activo ? result.codigo : '------');
        text(
            'estadoAcceso',
            result.activo
                ? result.edificio + ' · Piso ' + result.piso + ' · Casillero ' + result.numero +
                  '. Código de demostración (no abre una cerradura física).'
                : result.mensaje
        );
    } catch (error) {
        text('estadoAcceso', error.message);
    }
}

function setupDatos() {
    const user = currentUser;
    for (const [id, key] of [
        ['datosNombre', 'nombre'],
        ['datosApellidos', 'apellidos'],
        ['datosMatricula', 'matricula'],
        ['datosCorreo', 'correo'],
        ['datosFacultad', 'facultad']
    ]) {
        if ($(id)) $(id).value = user[key] || '';
    }

    $('formDatos').addEventListener('submit', async event => {
        event.preventDefault();
        const password = $('datosContrasena')?.value || '';
        if (password !== ($('datosConfirmar')?.value || '')) {
            return message('mensajeDatos', 'Las contraseñas no coinciden.');
        }
        try {
            await send('/api/yo', {
                nombre: field('datosNombre'),
                apellidos: field('datosApellidos'),
                matricula: field('datosMatricula'),
                correo: field('datosCorreo'),
                facultad: field('datosFacultad'),
                contrasena: password
            }, 'PUT');
            message('mensajeDatos', 'Datos actualizados.');
            await getUser();
            text('cuentaNombre', currentUser.nombre + ' ' + currentUser.apellidos);
            text('cuentaCorreo', currentUser.correo);
            text('cuentaFacultad', currentUser.facultad);
            if ($('datosContrasena')) $('datosContrasena').value = '';
            if ($('datosConfirmar')) $('datosConfirmar').value = '';
        } catch (error) {
            message('mensajeDatos', error.message);
        }
    });
}

async function setupCuenta() {
    text('cuentaNombre', currentUser.nombre + ' ' + currentUser.apellidos);
    text('cuentaCorreo', currentUser.correo);
    text('cuentaFacultad', currentUser.facultad);
    if ($('formDatos')) setupDatos();

    try {
        const rents = await api('/api/rentas');
        const active = rents.find(rent => ['activa', 'pendiente_pago'].includes(rent.estado));
        if (active) {
            text(
                'cuentaCasillero',
                active.edificio + ' · Piso ' + active.piso + ' · #' + active.numero + ' (' + active.estado + ')'
            );
            text('cuentaPlan', active.plan);
        }
    } catch {}
    await cargarAcceso();
}

let selectedLocker = null;

async function setupCasilleros() {
    const faculty = $('facultadCasillero');
    const building = $('edificio');
    const floor = $('piso');

    if (currentUser.facultad && Array.from(faculty.options).some(option => option.value === currentUser.facultad)) {
        faculty.value = currentUser.facultad;
    }

    const load = async () => {
        selectedLocker = null;
        sessionStorage.removeItem('easyLockerCasilleroId');
        text('casilleroSeleccionado', 'Ninguno');
        const title = building.value + ' · Piso ' + floor.value;
        text('tituloPiso', title);
        const container = $('filasCasilleros');
        container.replaceChildren();

        try {
            const query = '?facultad=' + encodeURIComponent(faculty.value) +
                '&edificio=' + encodeURIComponent(building.value) +
                '&piso=' + encodeURIComponent(floor.value);
            const rows = await api('/api/casilleros' + query);
            if (!rows.length) {
                container.textContent = 'No hay casilleros para esta ubicación.';
                return;
            }

            const columns = 6;
            for (let index = 0; index < rows.length; index += columns) {
                const row = document.createElement('div');
                row.className = 'fila-casilleros';
                const label = document.createElement('span');
                label.className = 'numero-fila';
                label.textContent = 'Fila ' + (Math.floor(index / columns) + 1);
                row.appendChild(label);

                rows.slice(index, index + columns).forEach(locker => {
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'casillero';
                    button.innerHTML =
                        '<span class="casillero-numero">' + Number(locker.numero) +
                        '</span><span class="casillero-puerta" aria-hidden="true"></span>';
                    button.setAttribute('aria-label', 'Casillero ' + locker.numero + ', ' + locker.estado);
                    button.title = 'Casillero ' + locker.numero + ': ' + locker.estado;
                    button.disabled = locker.estado !== 'disponible';
                    if (button.disabled) button.classList.add('ocupado');

                    button.addEventListener('click', () => {
                        container.querySelectorAll('.seleccionado').forEach(element =>
                            element.classList.remove('seleccionado')
                        );
                        button.classList.add('seleccionado');
                        selectedLocker = locker;
                        sessionStorage.setItem('easyLockerCasilleroId', String(locker.id));
                        text('casilleroSeleccionado', title + ' · Casillero ' + locker.numero);
                        text(
                            'estadoAcceso',
                            'Casillero seleccionado. El código de demostración se habilita después de confirmar el pago.'
                        );
                    });
                    row.appendChild(button);
                });
                container.appendChild(row);
            }
        } catch (error) {
            container.textContent = error.message;
        }
    };

    [faculty, building, floor].forEach(element => element.addEventListener('change', load));
    $('continuarCasillero').addEventListener('click', event => {
        if (!selectedLocker) {
            event.preventDefault();
            text('casilleroSeleccionado', 'Primero selecciona un casillero disponible.');
        }
    });
    await load();
    await cargarAcceso();
}

function setupPlanes() {
    document.querySelectorAll('.boton-plan').forEach(button => {
        button.addEventListener('click', async () => {
            const lockerId = sessionStorage.getItem('easyLockerCasilleroId');
            if (!lockerId) return message('mensajePlan', 'Primero selecciona un casillero en el mapa.');

            try {
                const plans = await api('/api/planes');
                const plan = plans.find(item => item.nombre === button.dataset.plan);
                if (!plan) throw new Error('Plan no disponible.');
                const rent = await send('/api/rentas', {
                    casilleroId: lockerId,
                    planId: plan.id
                });
                sessionStorage.setItem('easyLockerRentaId', String(rent.id));
                location.href = 'Pago.html';
            } catch (error) {
                message('mensajePlan', error.message);
            }
        });
    });
}

async function setupPago() {
    const rentId = sessionStorage.getItem('easyLockerRentaId');
    try {
        const rents = await api('/api/rentas');
        const rent = rents.find(item => item.id === rentId && item.estado === 'pendiente_pago');
        if (!rent) {
            message('mensajePago', 'No hay reserva pendiente. Regresa a casilleros.');
            $('formPago').querySelector('button[type=submit]').disabled = true;
            return;
        }
        text('pagoPlan', rent.plan);
        text('pagoPrecio', '$' + Number(rent.precio_total).toFixed(2) + ' MXN');
        text(
            'pagoUbicacion',
            rent.facultad + ' · ' + rent.edificio + ' · Piso ' + rent.piso + ' · #' + rent.numero
        );

        $('formPago').addEventListener('submit', async event => {
            event.preventDefault();
            try {
                const result = await send('/api/rentas/' + rentId + '/pagar', {});
                message('mensajePago', result.mensaje);
                sessionStorage.removeItem('easyLockerRentaId');
                setTimeout(() => location.href = 'Historial.html', 1100);
            } catch (error) {
                message('mensajePago', error.message);
            }
        });
    } catch (error) {
        message('mensajePago', error.message);
    }
}

async function setupHistorial() {
    try {
        const rents = await api('/api/rentas');
        text('cantidadRentas', rents.length);
        const latest = rents[0];
        text('rentaActual', latest ? latest.plan + ' · ' + latest.estado : 'Sin renta');
        text('historialFacultad', latest?.facultad || 'Sin seleccionar');

        const body = $('tablaHistorial');
        body.replaceChildren();
        if (!rents.length) {
            const row = document.createElement('tr');
            row.innerHTML = '<td colspan="5">Todavía no hay rentas.</td>';
            body.appendChild(row);
            return;
        }

        rents.forEach(rent => {
            const row = document.createElement('tr');
            [
                rent.facultad,
                rent.edificio + ', piso ' + rent.piso + ', #' + rent.numero,
                rent.plan,
                rent.estado
            ].forEach(value => {
                const cell = document.createElement('td');
                cell.textContent = value;
                row.appendChild(cell);
            });

            const actionCell = document.createElement('td');
            if (rent.estado === 'pendiente_pago') {
                const button = document.createElement('button');
                button.type = 'button';
                button.textContent = 'Cancelar reserva';
                button.className = 'boton boton-secundario';
                button.addEventListener('click', async () => {
                    try {
                        await send('/api/rentas/' + rent.id + '/cancelar', {});
                        await setupHistorial();
                    } catch (error) {
                        message('historialMensaje', error.message);
                    }
                });
                actionCell.appendChild(button);
            } else {
                actionCell.textContent = '—';
            }
            row.appendChild(actionCell);
            body.appendChild(row);
        });
    } catch (error) {
        $('tablaHistorial').textContent = error.message;
    }
}

async function setupAdmin() {
    try {
        const data = await api('/api/admin/resumen');
        text(
            'adminResumen',
            'Casilleros: ' + data.total +
            ' · Disponibles: ' + data.disponibles +
            ' · Ocupados: ' + data.ocupados +
            ' · Reservados: ' + data.reservados +
            ' · Usuarios: ' + data.usuarios +
            ' · Rentas: ' + data.rentas +
            ' · Ingresos: $' + Number(data.ingresos || 0).toFixed(2) + ' MXN'
        );
    } catch (error) {
        text('adminResumen', error.message);
    }
}

init();
