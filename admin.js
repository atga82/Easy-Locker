const adminResource = document.getElementById('adminResource');
const adminFields = document.getElementById('adminFields');
const adminForm = document.getElementById('adminForm');
const adminFormMessage = document.getElementById('adminFormMessage');
const adminTokenKey = 'easyLockerToken';

const definitions = {
    roles: [
        { name: 'nombre', label: 'Nombre del rol', required: true },
        { name: 'descripcion', label: 'Descripción', type: 'textarea' }
    ],
    facultades: [
        { name: 'nombre', label: 'Nombre', required: true },
        { name: 'activa', label: 'Activa', type: 'checkbox' }
    ],
    usuarios: [
        { name: 'rol', label: 'Rol', type: 'select', source: 'roles', required: true },
        { name: 'facultad', label: 'Facultad', type: 'select', source: 'facultades', required: true },
        { name: 'nombre', label: 'Nombre', required: true },
        { name: 'apellidos', label: 'Apellidos', required: true },
        { name: 'matricula', label: 'Matrícula', required: true },
        { name: 'correo', label: 'Correo', type: 'email', required: true },
        { name: 'password', label: 'Contraseña (mínimo 8 caracteres)', type: 'password', required: true },
        { name: 'estado', label: 'Estado', type: 'select-static', options: ['activo', 'inactivo', 'bloqueado'], required: true }
    ],
    edificios: [
        { name: 'facultad', label: 'Facultad', type: 'select', source: 'facultades', required: true },
        { name: 'nombre', label: 'Nombre del edificio', required: true },
        { name: 'activo', label: 'Activo', type: 'checkbox' }
    ],
    pisos: [
        { name: 'edificio', label: 'Edificio', type: 'select', source: 'edificios', required: true },
        { name: 'numero_piso', label: 'Número de piso', type: 'number', required: true },
        { name: 'activo', label: 'Activo', type: 'checkbox' }
    ],
    casilleros: [
        { name: 'piso', label: 'Piso', type: 'select', source: 'pisos', required: true },
        { name: 'numero', label: 'Número', type: 'number', required: true },
        { name: 'fila', label: 'Fila', type: 'number', required: true },
        { name: 'columna', label: 'Columna', type: 'number', required: true },
        { name: 'estado', label: 'Estado', type: 'select-static', options: ['disponible', 'reservado', 'ocupado', 'mantenimiento', 'inactivo'], required: true }
    ],
    planes: [
        { name: 'nombre', label: 'Nombre del plan', required: true },
        { name: 'descripcion', label: 'Descripción', type: 'textarea' },
        { name: 'duracion_valor', label: 'Duración (valor)', type: 'number', required: true },
        { name: 'duracion_unidad', label: 'Unidad', type: 'select-static', options: ['dia', 'semestre'], required: true },
        { name: 'precio', label: 'Precio', type: 'number', required: true, step: '0.01' },
        { name: 'moneda', label: 'Moneda', required: true },
        { name: 'activo', label: 'Activo', type: 'checkbox' }
    ],
    rentas: [
        { name: 'usuario', label: 'Usuario', type: 'select', source: 'usuarios', required: true },
        { name: 'casillero', label: 'Casillero', type: 'select', source: 'casilleros', required: true },
        { name: 'plan', label: 'Plan', type: 'select', source: 'planes', required: true },
        { name: 'estado', label: 'Estado', type: 'select-static', options: ['pendiente_pago', 'activa', 'finalizada', 'cancelada', 'vencida'], required: true },
        { name: 'precio_total', label: 'Precio total', type: 'number', required: true, step: '0.01' },
        { name: 'moneda', label: 'Moneda', required: true },
        { name: 'fecha_inicio', label: 'Fecha de inicio', type: 'datetime' },
        { name: 'fecha_fin', label: 'Fecha de fin', type: 'datetime' }
    ],
    pagos: [
        { name: 'renta', label: 'Renta', type: 'select', source: 'rentas', required: true },
        { name: 'monto', label: 'Monto', type: 'number', required: true, step: '0.01' },
        { name: 'moneda', label: 'Moneda', required: true },
        { name: 'metodo_pago', label: 'Método de pago', type: 'select-static', options: ['tarjeta', 'transferencia', 'efectivo', 'otro'], required: true },
        { name: 'estado', label: 'Estado', type: 'select-static', options: ['pendiente', 'aprobado', 'rechazado', 'cancelado', 'error'], required: true },
        { name: 'proveedor', label: 'Proveedor' },
        { name: 'referencia_externa', label: 'Referencia externa' },
        { name: 'pagado_en', label: 'Fecha de pago', type: 'datetime' }
    ],
    logs: [
        { name: 'usuario', label: 'Usuario (opcional)', type: 'select', source: 'usuarios', optional: true },
        { name: 'nivel', label: 'Nivel', type: 'select-static', options: ['INFO', 'WARNING', 'ERROR', 'CRITICAL'], required: true },
        { name: 'evento', label: 'Evento', required: true },
        { name: 'metodo_http', label: 'Método HTTP' },
        { name: 'endpoint', label: 'Endpoint' },
        { name: 'mensaje', label: 'Mensaje', type: 'textarea', required: true },
        { name: 'contexto_json', label: 'Contexto JSON', type: 'textarea' }
    ]
};

const reportTargets = {
    ocupacion: 'reportOcupacion',
    'ingresos-mensuales': 'reportIngresos',
    'rentas-por-plan': 'reportPlanes',
    'historial-rentas': 'reportHistorial'
};

async function adminApi(url, options = {}) {
    const token = sessionStorage.getItem(adminTokenKey);
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token) headers.Authorization = 'Bearer ' + token;
    const response = await fetch(url, { ...options, headers });
    const data = await response.json().catch(() => ({ mensaje: 'Respuesta no válida del servidor.' }));
    if (!response.ok) throw new Error(data.mensaje || 'No se pudo completar la operación.');
    return data;
}

function adminMessage(value, isError = false) {
    adminFormMessage.textContent = value || '';
    adminFormMessage.classList.toggle('mensaje-error', isError);
}

function relationId(value) {
    if (!value) return '';
    return typeof value === 'object' ? (value._id || value.id || '') : value;
}

function optionLabel(resource, item) {
    if (resource === 'usuarios') return item.nombre + ' ' + item.apellidos + ' · ' + item.correo;
    if (resource === 'edificios') return (item.facultad?.nombre || '') + ' · ' + item.nombre;
    if (resource === 'pisos') return (item.edificio?.nombre || 'Edificio') + ' · Piso ' + item.numero_piso;
    if (resource === 'casilleros') return 'Casillero ' + item.numero + ' · ' + (item.piso?.numero_piso ? 'Piso ' + item.piso.numero_piso : '');
    if (resource === 'rentas') return 'Renta ' + String(item._id).slice(-6) + ' · ' + item.estado;
    return item.nombre || item.evento || String(item._id).slice(-8);
}

async function createField(definition, resource) {
    const wrapper = document.createElement('div');
    wrapper.className = 'campo admin-field';
    const label = document.createElement('label');
    label.htmlFor = 'field-' + definition.name;
    label.textContent = definition.label;
    wrapper.appendChild(label);

    let input;
    if (definition.type === 'textarea') {
        input = document.createElement('textarea');
        input.rows = 3;
    } else if (definition.type === 'select' || definition.type === 'select-static') {
        input = document.createElement('select');
        const blank = document.createElement('option');
        blank.value = '';
        blank.textContent = definition.optional ? 'Sin asignar' : 'Selecciona una opción';
        input.appendChild(blank);
        if (definition.type === 'select-static') {
            definition.options.forEach(value => {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = value;
                input.appendChild(option);
            });
        } else {
            const data = await adminApi('/api/admin/' + definition.source);
            data.forEach(item => {
                const option = document.createElement('option');
                option.value = item._id;
                option.textContent = optionLabel(definition.source, item);
                input.appendChild(option);
            });
        }
    } else {
        input = document.createElement('input');
        input.type = definition.type || 'text';
        if (definition.type === 'number') input.step = definition.step || '1';
    }

    input.id = 'field-' + definition.name;
    input.name = definition.name;
    if (definition.required) input.required = true;
    if (definition.type === 'checkbox') {
        input.checked = true;
        input.className = 'admin-checkbox';
        wrapper.classList.add('admin-checkbox-field');
        label.htmlFor = input.id;
        wrapper.replaceChildren(input, label);
    } else {
        wrapper.appendChild(input);
    }
    return wrapper;
}

let renderFieldsVersion = 0;
async function renderFields(resource) {
    const version = ++renderFieldsVersion;
    const fragment = document.createDocumentFragment();
    for (const definition of definitions[resource]) {
        const element = await createField(definition, resource);
        if (version !== renderFieldsVersion || adminResource.value !== resource) return false;
        fragment.appendChild(element);
    }
    adminFields.replaceChildren(fragment);
    adminFields.dataset.resource = resource;
    resetAdminForm();
    return true;
}

function resetAdminForm() {
    adminForm.reset();
    document.getElementById('adminEditId').value = '';
    document.getElementById('adminFormTitle').textContent = 'Nuevo registro';
    document.getElementById('adminSave').textContent = 'Crear registro';
    const password = document.getElementById('field-password');
    if (password) password.required = true;
    adminMessage('');
}

function cellValue(record, key) {
    const value = record[key];
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    if (typeof value === 'object' && !Array.isArray(value)) {
        return value.nombre || value.correo || value.evento || String(value._id || JSON.stringify(value));
    }
    if (Array.isArray(value)) return value.join(', ');
    if (key.startsWith('fecha') || key === 'creado_en' || key === 'pagado_en') {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
    }
    return String(value);
}

async function loadResource() {
    const resource = adminResource.value;
    const config = definitions[resource];
    if (!config) return;
    try {
        const rows = await adminApi('/api/admin/' + resource);
        if (adminResource.value !== resource) return;
        const columns = config.filter(field => field.name !== 'password').slice(0, 6);
        const head = document.getElementById('adminTableHead');
        const body = document.getElementById('adminTableBody');
        head.replaceChildren();
        body.replaceChildren();

        const headerRow = document.createElement('tr');
        columns.forEach(field => {
            const cell = document.createElement('th');
            cell.textContent = field.label;
            headerRow.appendChild(cell);
        });
        const actionHeader = document.createElement('th');
        actionHeader.textContent = 'Acciones';
        headerRow.appendChild(actionHeader);
        head.appendChild(headerRow);

        if (!rows.length) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = columns.length + 1;
            cell.textContent = 'No hay registros en esta colección.';
            row.appendChild(cell);
            body.appendChild(row);
        }

        rows.forEach(record => {
            const row = document.createElement('tr');
            columns.forEach(field => {
                const cell = document.createElement('td');
                cell.textContent = cellValue(record, field.name);
                row.appendChild(cell);
            });
            const actions = document.createElement('td');
            actions.className = 'admin-actions-cell';
            const edit = document.createElement('button');
            edit.type = 'button';
            edit.className = 'boton boton-secundario admin-small-button';
            edit.textContent = 'Editar';
            edit.addEventListener('click', () => editRecord(record));
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'boton boton-secundario admin-small-button';
            remove.textContent = 'Eliminar';
            remove.addEventListener('click', () => deleteRecord(record._id));
            actions.append(edit, remove);
            row.appendChild(actions);
            body.appendChild(row);
        });

        document.getElementById('adminRecordCount').textContent = rows.length + ' registros';
    } catch (error) {
        adminMessage(error.message, true);
    }
}

function editRecord(record) {
    document.getElementById('adminEditId').value = record._id;
    document.getElementById('adminFormTitle').textContent = 'Editar registro';
    document.getElementById('adminSave').textContent = 'Guardar cambios';

    for (const definition of definitions[adminResource.value]) {
        const input = document.getElementById('field-' + definition.name);
        if (!input) continue;
        let value = record[definition.name];
        if (definition.type === 'checkbox') {
            input.checked = Boolean(value);
        } else if (definition.type === 'datetime' && value) {
            const date = new Date(value);
            input.value = Number.isNaN(date.getTime())
                ? ''
                : new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        } else if (definition.type === 'textarea' && definition.name === 'contexto_json' && value) {
            input.value = JSON.stringify(value, null, 2);
        } else if (definition.type === 'password') {
            input.value = '';
            input.required = false;
        } else {
            input.value = relationId(value);
        }
    }
    adminMessage('Editando el registro ' + String(record._id).slice(-8) + '.');
    window.scrollTo({ top: adminForm.getBoundingClientRect().top + window.scrollY - 120, behavior: 'smooth' });
}

async function deleteRecord(id) {
    if (!window.confirm('¿Eliminar este registro? La operación no se puede deshacer.')) return;
    try {
        const result = await adminApi('/api/admin/' + adminResource.value + '/' + id, { method: 'DELETE' });
        adminMessage(result.mensaje);
        await loadResource();
    } catch (error) {
        adminMessage(error.message, true);
    }
}

adminForm.addEventListener('submit', async event => {
    event.preventDefault();
    const resource = adminResource.value;
    const data = {};
    try {
        for (const definition of definitions[resource]) {
            const input = document.getElementById('field-' + definition.name);
            if (!input) continue;
            let value;
            if (definition.type === 'checkbox') value = input.checked;
            else value = input.value.trim();

            if (definition.type === 'password' && !value) continue;
            if (value === '' && definition.optional) continue;
            if (value === '' && !definition.required) continue;
            if (definition.type === 'number') value = Number(value);
            if (definition.type === 'datetime') value = value ? new Date(value).toISOString() : null;
            if (definition.name === 'contexto_json' && value) value = JSON.parse(value);
            data[definition.name] = value;
        }

        const editId = document.getElementById('adminEditId').value;
        const url = editId
            ? '/api/admin/' + resource + '/' + editId
            : '/api/admin/' + resource;
        const result = await adminApi(url, {
            method: editId ? 'PUT' : 'POST',
            body: JSON.stringify(data)
        });
        adminMessage(result.mensaje);
        resetAdminForm();
        await loadResource();
        await loadSummary();
    } catch (error) {
        adminMessage(error.message, true);
    }
});

document.getElementById('adminCancel').addEventListener('click', resetAdminForm);
document.getElementById('adminRefresh').addEventListener('click', loadResource);
adminResource.addEventListener('change', async () => {
    const resource = adminResource.value;
    resetAdminForm();
    try {
        if (await renderFields(resource)) await loadResource();
    } catch (error) {
        if (adminResource.value === resource) adminMessage(error.message, true);
    }
});

async function loadSummary() {
    try {
        const data = await adminApi('/api/admin/resumen');
        document.getElementById('adminCasilleros').textContent = data.total;
        document.getElementById('adminDisponibles').textContent = data.disponibles;
        document.getElementById('adminUsuarios').textContent = data.usuarios;
        document.getElementById('adminRentas').textContent = data.rentas;
        document.getElementById('adminIngresos').textContent = '$' + Number(data.ingresos || 0).toFixed(2) + ' MXN';
        document.getElementById('adminResumen').textContent =
            'Ocupados: ' + data.ocupados + ' · Reservados: ' + data.reservados + ' · Pagos: ' + data.pagos;
    } catch (error) {
        document.getElementById('adminResumen').textContent = error.message;
    }
}

function renderReportTable(targetId, rows) {
    const body = document.getElementById(targetId);
    const table = body.closest('table');
    const head = table.querySelector('thead');
    body.replaceChildren();
    head.replaceChildren();

    if (!rows.length) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.textContent = 'No hay datos suficientes para este reporte.';
        row.appendChild(cell);
        body.appendChild(row);
        return;
    }

    const columns = Object.keys(rows[0]);
    const headerRow = document.createElement('tr');
    columns.forEach(key => {
        const cell = document.createElement('th');
        cell.textContent = key.replaceAll('_', ' ');
        headerRow.appendChild(cell);
    });
    head.appendChild(headerRow);

    rows.forEach(record => {
        const row = document.createElement('tr');
        columns.forEach(key => {
            const cell = document.createElement('td');
            cell.textContent = cellValue(record, key);
            row.appendChild(cell);
        });
        body.appendChild(row);
    });
}

document.querySelectorAll('.admin-report-button').forEach(button => {
    button.addEventListener('click', async () => {
        const report = button.dataset.report;
        button.disabled = true;
        button.textContent = 'Consultando...';
        try {
            const rows = await adminApi('/api/admin/reportes/' + report);
            renderReportTable(reportTargets[report], rows);
        } catch (error) {
            const target = document.getElementById(reportTargets[report]);
            target.textContent = error.message;
        } finally {
            button.disabled = false;
            button.textContent = 'Consultar reporte';
        }
    });
});

(async function initAdmin() {
    try {
        const user = await adminApi('/api/yo');
        if (user.rol !== 'administrador') {
            location.href = 'cuenta.html';
            return;
        }
        await renderFields(adminResource.value);
        await Promise.all([loadSummary(), loadResource()]);
    } catch (error) {
        document.getElementById('adminResumen').textContent = error.message;
    }
})();
