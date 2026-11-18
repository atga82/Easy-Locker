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

    if (user?.rol === 'administrador') {
        const nav = $('navegacion');

        if (nav && !$('navAdmin')) {
            const adminLink = document.createElement('a');

            adminLink.id = 'navAdmin';
            adminLink.href = 'Admin.html';
            adminLink.textContent = 'Administración';

            nav.appendChild(adminLink);
        }
    }

    if (privatePages.includes(urlPage) && !user) {
        location.href = 'login.html?volver=' + encodeURIComponent(location.pathname);
        return;
    }
    if (urlPage === '/admin.html' && user.rol !== 'administrador') {
        location.href = 'cuenta.html';
        return;
    }

    if (user) cargarAvisos().catch(console.error);

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
        const errorDatos = window.EasyLockerValidaciones.errorAlumno(data, true);
        if (errorDatos) return message('mensajeRegistro', errorDatos);
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
            if (back && back.startsWith('/') && !back.startsWith('//')) {
                location.href = back;
            } else if (result.usuario?.rol === 'administrador') {
                location.href = 'Admin.html';
            } else {
                location.href = 'cuenta.html';
            }
            
        } catch (error) {
            message('mensajeLogin', error.message);
        }
    });
}

async function cargarAvisos() {
    const avisos = await api('/api/avisos');
    if (!avisos.length || $('avisosRenta')) return;
    const banner = document.createElement('section');
    banner.id = 'avisosRenta';
    banner.className = 'avisos-renta';
    const heading = document.createElement('strong');
    heading.textContent = 'Avisos de vencimiento';
    banner.appendChild(heading);
    for (const aviso of avisos) {
        const paragraph = document.createElement('p');
        paragraph.textContent = aviso.mensaje;
        banner.appendChild(paragraph);
    }
    document.querySelector('header')?.insertAdjacentElement('afterend', banner);
}

async function cargarAcceso() {
    try {
        const result = await api('/api/mi-acceso');
        const codigos = result.codigos || [];
        const first = codigos[0];
        text('codigoAcceso', first ? first.codigo : '------');
        text('estadoAcceso', first
            ? (codigos.length === 1
                ? 'Tienes 1 casillero activo. Consulta tu código de acceso.'
                : 'Tienes ' + codigos.length + ' casilleros activos. Consulta los códigos de acceso de cada uno.')
            : result.mensaje);
        const section = $('codigoAcceso')?.closest('.codigo-acceso');
        if (!section) return;
        let list = $('listaCodigos');
        if (!list) {
            list = document.createElement('div');
            list.id = 'listaCodigos';
            list.className = 'lista-codigos';
            section.insertAdjacentElement('afterend', list);
        }
        list.replaceChildren();
        codigos.forEach(info => {
            const item = document.createElement('article');
            item.className = 'tarjeta-codigo';
            const title = document.createElement('strong');
            title.textContent = info.plan + ' · ' + info.edificio + ' · Piso ' + info.piso + ' · Casillero #' + info.numero;
            const code = document.createElement('span');
            code.className = 'numero-codigo';
            code.textContent = info.codigo;
            const expiration = document.createElement('small');
            expiration.textContent = 'Vence: ' + new Date(info.vence).toLocaleString('es-MX');
            item.append(title, code, expiration);
            list.appendChild(item);
        });
        // Ocultamos el código antiguo porque la lista ya muestra TODOS los códigos.
        const oldCard = section.querySelector('.codigo-visual');
        if (oldCard) oldCard.hidden = codigos.length > 0;
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
        const datos = {
            nombre: field('datosNombre'), apellidos: field('datosApellidos'),
            matricula: field('datosMatricula'), correo: field('datosCorreo'), contrasena: password
        };
        const errorDatos = window.EasyLockerValidaciones.errorAlumno(datos, Boolean(password));
        if (errorDatos) return message('mensajeDatos', errorDatos);
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
        const active = rents.filter(rent => ['activa', 'pendiente_pago'].includes(rent.estado));
        if (active.length) {
            const slots = active.flatMap(rent => rent.casilleros.map(locker =>
                locker.edificio + ' · Piso ' + locker.piso + ' · #' + locker.numero + ' (' + rent.estado + ')'));
            text('cuentaCasillero', slots.join(' | '));
            text('cuentaPlan', [...new Set(active.map(rent => rent.plan))].join(' · '));
        }
    } catch {}
    await cargarAcceso();
}

// El usuario puede seleccionar hasta dos casilleros; el servidor valida el límite real según el plan.
async function setupCasilleros() {
    const faculty = $('facultadCasillero');
    const building = $('edificio');
    const floor = $('piso');
    const queryParams = new URLSearchParams(location.search);
    const rentToChange = queryParams.get('cambiar');
    const oldLocker = queryParams.get('anterior');
    const semesterToComplete = queryParams.get('agregarSemestral');

    const changing = Boolean(rentToChange && oldLocker);
    const completingSemester = Boolean(semesterToComplete);
    const selected = new Map();

    if (currentUser.facultad && Array.from(faculty.options).some(option => option.value === currentUser.facultad)) {
        faculty.value = currentUser.facultad;
    }
    const changeNotice = $('avisoCambio');
    if (changing && changeNotice) {
        changeNotice.hidden = false;
        $('continuarCasillero').textContent = 'Confirmar cambio de casillero';
    }
    // Al completar un semestral NO se compra otro plan ni se paga de nuevo.
    // Mostramos un aviso propio para que cualquier error del servidor sea visible.
    if (completingSemester) {
        const notice = $('avisoAgregarSemestral');
        if (notice) notice.hidden = false;
        $('continuarCasillero').textContent = 'Agregar sin costo';
    }

    function updateSelected() {
        const lockers = [...selected.values()];
        text('casilleroSeleccionado', lockers.length
            ? lockers.map(l => l.edificio + ' · Piso ' + l.piso + ' · #' + l.numero).join(' | ')
            : 'Ninguno');
        if (!changing) {
            sessionStorage.setItem('easyLockerCasillerosIds', JSON.stringify(lockers.map(l => l.id)));
            if (lockers[0]) sessionStorage.setItem('easyLockerCasilleroId', lockers[0].id);
            else sessionStorage.removeItem('easyLockerCasilleroId');
        }
    }
    if (!changing) {
        sessionStorage.removeItem('easyLockerCasilleroId');
        sessionStorage.removeItem('easyLockerCasillerosIds');
    }
    const load = async () => {
        const title = building.value + ' · Piso ' + floor.value;
        text('tituloPiso', title);
        const container = $('filasCasilleros');
        container.replaceChildren();
        try {
            const query = '?facultad=' + encodeURIComponent(faculty.value) +
                '&edificio=' + encodeURIComponent(building.value) + '&piso=' + encodeURIComponent(floor.value);
            const rows = await api('/api/casilleros' + query);
            if (!rows.length) {
                container.textContent = 'No hay casilleros para esta ubicación.';
                return;
            }
            for (let index = 0; index < rows.length; index += 6) {
                const row = document.createElement('div');
                row.className = 'fila-casilleros';
                const label = document.createElement('span');
                label.className = 'numero-fila';
                label.textContent = 'Fila ' + (Math.floor(index / 6) + 1);
                row.appendChild(label);
                rows.slice(index, index + 6).forEach(locker => {
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'casillero';
                    button.innerHTML = '<span class="casillero-numero">' + Number(locker.numero) +
                        '</span><span class="casillero-puerta" aria-hidden="true"></span>';
                    button.setAttribute('aria-label', 'Casillero ' + locker.numero + ', ' + locker.estado);
                    button.title = 'Casillero ' + locker.numero + ': ' + locker.estado;
                    button.disabled = locker.estado !== 'disponible';
                    if (button.disabled) button.classList.add('ocupado');
                    if (selected.has(locker.id)) button.classList.add('seleccionado');
                    button.addEventListener('click', () => {
                        if (selected.has(locker.id)) {
                            selected.delete(locker.id);
                            button.classList.remove('seleccionado');
                        } else {
                           const maxSelection = (changing || completingSemester) ? 1 : 2;

                            if (selected.size >= maxSelection) {
                                text('casilleroSeleccionado', 'Máximo ' + maxSelection +
                                    ' casillero(s). Deselecciona uno antes de elegir otro.');
                                return;
                            }
                            selected.set(locker.id, { ...locker, edificio: building.value, piso: floor.value });
                            button.classList.add('seleccionado');
                        }
                        updateSelected();
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
   $('continuarCasillero').addEventListener('click', async event => {
        if (selected.size === 0) {
            event.preventDefault();
            text('casilleroSeleccionado', 'Primero selecciona un casillero disponible.');
            return;
        }

        if (changing) {
            event.preventDefault();
            if (!$('aceptaRetiro')?.checked) {
                message('mensajeCambio', 'Confirma que retirarás tus pertenencias antes del cambio.');
                return;
            }
            try {
                const selectedId = [...selected.keys()][0];
                const result = await send('/api/rentas/' + encodeURIComponent(rentToChange) + '/cambiar-casillero', {
                    casilleroAnteriorId: oldLocker,
                    casilleroNuevoId: selectedId,
                    aceptaRetiro: true
                });
                message('mensajeCambio', result.mensaje);
                location.href = 'Historial.html';
            } catch (error) {
                message('mensajeCambio', error.message);
            }
            return;
        }

        if (completingSemester) {
            event.preventDefault();
            try {
                const selectedId = [...selected.keys()][0];
                const result = await send(
                    '/api/rentas/' + encodeURIComponent(semesterToComplete) + '/agregar-casillero-semestral',
                    { casilleroNuevoId: selectedId }
                );
                message('mensajeAgregarSemestral', result.mensaje);
                location.href = 'Historial.html';
            } catch (error) {
                message('mensajeAgregarSemestral', error.message);
            }
            return;
        }
    });
    await load();
    await cargarAcceso();
}

async function setupPlanes() {
    const plans = await api('/api/planes').catch(error => {
        message('mensajePlan', error.message);
        return [];
    });
    document.querySelectorAll('.boton-plan').forEach(button => {
        const plan = plans.find(item => item.nombre === button.dataset.plan);
        if (plan?.bloqueado) {
            button.disabled = true;
            button.title = 'Ya tienes una renta semestral activa o pendiente';
            button.textContent = 'Ya cuentas con plan semestral';
        }
        button.addEventListener('click', async () => {
            let lockerIds = [];
            try { lockerIds = JSON.parse(sessionStorage.getItem('easyLockerCasillerosIds') || '[]'); } catch {}
            if (!lockerIds.length && sessionStorage.getItem('easyLockerCasilleroId')) {
                lockerIds = [sessionStorage.getItem('easyLockerCasilleroId')];
            }
            if (!lockerIds.length) return message('mensajePlan', 'Primero selecciona un casillero en el mapa.');
            if (!plan) return message('mensajePlan', 'Plan no disponible.');
            if (lockerIds.length > plan.max_casilleros) {
                return message('mensajePlan', 'Este plan admite ' + plan.max_casilleros +
                    ' casillero(s). Regresa al mapa y deselecciona uno.');
            }
            try {
                const rent = await send('/api/rentas', { casilleroIds: lockerIds, planId: plan.id });
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
    const numberInput = $('tarjetaNumero');
    const expiryInput = $('tarjetaVencimiento');
    const cvcInput = $('tarjetaCvc');
    const titularInput = $('tarjetaTitular');
    if (!numberInput || !expiryInput || !cvcInput || !titularInput) {
        message('mensajePago', 'No se pudo cargar el formulario de pago.');
        return;
    }
    numberInput.addEventListener('input', () => {
        const digits = numberInput.value.replace(/\D/g, '').slice(0, 16);
        numberInput.value = digits.replace(/(.{4})/g, '$1 ').trim();
    });
    expiryInput.addEventListener('input', () => {
        const digits = expiryInput.value.replace(/\D/g, '').slice(0, 4);
        expiryInput.value = digits.length > 2 ? digits.slice(0, 2) + '/' + digits.slice(2) : digits;
    });
    cvcInput.addEventListener('input', () => {
        cvcInput.value = cvcInput.value.replace(/\D/g, '').slice(0, 3);
    });
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
            rent.casilleros.map(l => l.edificio + ' · Piso ' + l.piso + ' · #' + l.numero).join(' | ')
        );

        $('formPago').addEventListener('submit', async event => {
            event.preventDefault();
            const errorTarjeta = window.EasyLockerValidaciones.errorTarjeta({
                titular: titularInput.value,
                numero: numberInput.value,
                vencimiento: expiryInput.value,
                cvc: cvcInput.value
            });
            if (errorTarjeta) return message('mensajePago', errorTarjeta);
            $('formPago').reset();
            const submitButton = $('formPago').querySelector('button[type=submit]');
            submitButton.disabled = true;
            try {
                const result = await send('/api/rentas/' + rentId + '/pagar', {});
                message('mensajePago', result.mensaje);
                sessionStorage.removeItem('easyLockerRentaId');
                setTimeout(() => location.href = 'Historial.html', 1100);
            } catch (error) {
                message('mensajePago', error.message);
                submitButton.disabled = false;
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

        const enUso = rents
            .filter(r => ['activa', 'pendiente_pago'].includes(r.estado))
            .reduce((total, r) => total + (r.casilleros?.length || 0), 0);

        rents.forEach(rent => {
            const row = document.createElement('tr');
            [
                rent.facultad,
                rent.casilleros.map(l => l.edificio + ', piso ' + l.piso + ', #' + l.numero).join(' | '),
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
            } else if (rent.estado === 'activa' && rent.plan === 'Renta semestral') {
                if (rent.casilleros.length === 1) {
                    const addButton = document.createElement('button');
                    addButton.type = 'button';
                    addButton.className = 'boton boton-principal admin-small-button';
                    if (enUso >= 4) {
                        addButton.textContent = 'Sin cupo (4 de 4)';
                        addButton.title = 'Podrás agregar tu segundo casillero gratis cuando venza otra renta.';
                        addButton.disabled = true;
                    } else {
                        addButton.textContent = 'Agregar segundo incluido';
                        addButton.addEventListener('click', () => {
                            location.href = 'casilleros.html?agregarSemestral=' + encodeURIComponent(rent.id);
                        });
                    }
                    actionCell.appendChild(addButton);
                }
                if (!rent.puede_cambiar) {
                    const next = document.createElement('small');
                    next.className = 'detalle-cambio';
                    next.textContent = 'Próximo cambio: ' + new Date(rent.proximo_cambio).toLocaleString('es-MX');
                    actionCell.appendChild(next);
                } else {
                    rent.casilleros.forEach(locker => {
                        const button = document.createElement('button');
                        button.type = 'button';
                        button.textContent = 'Cambiar #' + locker.numero;
                        button.className = 'boton boton-secundario admin-small-button';
                        button.addEventListener('click', () => {
                            location.href = 'casilleros.html?cambiar=' + encodeURIComponent(rent.id) +
                                '&anterior=' + encodeURIComponent(locker.id);
                        });
                        actionCell.appendChild(button);
                    });
                }
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
